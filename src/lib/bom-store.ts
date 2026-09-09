/**
 * Persistering av en stycklista till boms + bom_items.
 *
 * Bakgrund: boms/bom_items modellerades en gång med rätt nycklar men fick
 * aldrig någon skrivväg -- 0 rader, ingen INSERT i kodbasen, och /bom/:bomId
 * läste tomma tabeller. Maskinbyggaren sparade istället en JSON-snapshot i
 * projects.bom_lines, som dessutom tappar `reason` (den tekniska motiveringen).
 *
 * Den normaliserade vägen behövs för att canvasen ska ha stabila id:n att
 * hänga kopplingar på: byter användaren en komponent får den nya raden ett
 * eget bom_items.id, och kopplingarna kan följa med. En JSON-blob kan inte ge
 * det.
 *
 * FALLBACK -- viktigast i hela filen: ingenting här får kunna hindra att ett
 * projekt sparas. JSON-vägen i projects.bom_lines lämnas orörd och är kvar som
 * skyddsnät. Därför kastar den här funktionen aldrig; den returnerar null och
 * låter anroparen spara projektet ändå, med bom_id = null. En användare ska
 * aldrig förlora sitt arbete för att den nya vägen strular.
 */
import { supabase } from "@/integrations/supabase/client";

/** En kant i maskingrafen, med index in i raderna. */
export interface BomConnectionInput {
  fromIndex: number;
  toIndex: number;
  relation: string;
}

export interface BomLineInput {
  sku: string;
  quantity: number;
  role: string;
  reason?: string;
  /** Katalogprodukten, när SKU:n motsvarar en. Saknas för SPECIFY,
   *  CUSTOM-SOLUTION och rena varningsrader -- de sparas ändå, med sku satt
   *  och product_id null. */
  product?: { id: string } | null;
  kind?: string;
  subsystem?: string | null;
}

/**
 * Skriver stycklistan och returnerar dess bom-id, eller null om något gick
 * fel. Kastar aldrig.
 */
export async function saveBomNormalized(
  userId: string,
  lines: BomLineInput[],
  notes?: string | null,
  connections: BomConnectionInput[] = [],
): Promise<string | null> {
  if (!userId || lines.length === 0) return null;

  try {
    const { data: bom, error: bomErr } = await supabase
      .from("boms")
      .insert({
        user_id: userId,
        mode: "best",
        notes: notes?.trim() || null,
        total_items: lines.length,
      })
      .select("id")
      .single();

    if (bomErr || !bom) {
      console.warn("[bom-store] kunde inte skapa boms-rad, faller tillbaka på JSON:", bomErr?.message);
      return null;
    }

    const { data: insertedItems, error: itemsErr } = await supabase.from("bom_items").insert(
      lines.map((l, i) => ({
        bom_id: bom.id,
        // Sätts bara när SKU:n finns i katalogen. FK till products är NO ACTION,
        // så ett felaktigt id skulle avvisa hela insert:en -- därför ?? null.
        product_id: l.product?.id ?? null,
        sku: l.sku,
        qty: l.quantity,
        role: l.role,
        reason: l.reason ?? null,
        // Radordningen bär information: primär aktuator först, varningsrader
        // sist. Utan sort_order kommer raderna tillbaka i godtycklig ordning.
        sort_order: i,
        subsystem: l.subsystem ?? null,
      })),
    ).select("id, sort_order");

    if (itemsErr) {
      // Lämna ingen tom stycklista efter oss -- den skulle dyka upp som ett
      // innehållslöst projekt. Kräver delete-policyn på boms som lades till i
      // migration 20260908180000.
      await supabase.from("boms").delete().eq("id", bom.id);
      console.warn("[bom-store] kunde inte skriva bom_items, rullade tillbaka:", itemsErr.message);
      return null;
    }

    // Kopplingarna. Utan dem tappar ett sparat projekt sin topologi: bom_lines
    // -snapshotten bär bara raderna, och `connections` sätts idag bara av det
    // live-svaret från rådgivaren. Öppnar man ett sparat projekt igen står
    // detaljraden tom där det borde stå "Sitter på FRL-enhet".
    //
    // sort_order är bryggan mellan serverns index och radernas uuid -- SKU:er
    // kan upprepas i en stycklista, så de duger inte som nyckel.
    if (connections.length > 0 && insertedItems && insertedItems.length > 0) {
      const idByIndex = new Map<number, string>();
      for (const row of insertedItems) {
        if (typeof row.sort_order === "number") idByIndex.set(row.sort_order, row.id);
      }
      const edges = connections.flatMap(c => {
        const from = idByIndex.get(c.fromIndex);
        const to = idByIndex.get(c.toIndex);
        // Kant vars ändpunkt inte sparats hoppas över hellre än att bryta
        // insert:en -- bom_connections har en trigger som avvisar den ändå.
        return from && to && from !== to
          ? [{ bom_id: bom.id, from_item_id: from, to_item_id: to, relation_type: c.relation }]
          : [];
      });
      if (edges.length > 0) {
        const { error: connErr } = await supabase.from("bom_connections").insert(edges);
        // Stycklistan är värd att behålla även om grafen inte gick in.
        if (connErr) console.warn("[bom-store] kopplingar sparades inte:", connErr.message);
      }
    }

    return bom.id;
  } catch (e) {
    console.warn("[bom-store] oväntat fel, faller tillbaka på JSON:", e);
    return null;
  }
}

/**
 * Läser tillbaka en sparad stycklista med sin topologi.
 *
 * Motstycket till saveBomNormalized. Utan den här tappar ett sparat projekt
 * sina kopplingar: bom_lines-snapshotten bär bara raderna, och `connections`
 * sätts annars bara av rådgivarens live-svar.
 *
 * Index i de returnerade kopplingarna pekar in i den returnerade radlistan,
 * samma kontrakt som servern använder -- så anroparen kan mata dem rakt in i
 * samma state som ett live-svar.
 *
 * Kastar aldrig. Returnerar null när något saknas, och anroparen faller då
 * tillbaka på JSON-snapshotten precis som förut.
 */
export async function loadBomNormalized(bomId: string): Promise<{
  lines: Array<{ sku: string; quantity: number; role: string; reason: string; subsystem: string | null }>;
  connections: BomConnectionInput[];
} | null> {
  if (!bomId) return null;
  try {
    const { data: items, error: itemsErr } = await supabase
      .from("bom_items")
      .select("id, sku, qty, role, reason, subsystem, sort_order")
      .eq("bom_id", bomId)
      .order("sort_order", { ascending: true });
    if (itemsErr || !items || items.length === 0) return null;

    const indexById = new Map(items.map((r, i) => [r.id, i]));
    const { data: conns } = await supabase
      .from("bom_connections")
      .select("from_item_id, to_item_id, relation_type")
      .eq("bom_id", bomId);

    return {
      lines: items.map(r => ({
        sku: r.sku ?? "",
        quantity: r.qty ?? 1,
        role: r.role ?? "",
        reason: r.reason ?? "",
        subsystem: r.subsystem ?? null,
      })),
      connections: (conns ?? []).flatMap(c => {
        const from = indexById.get(c.from_item_id);
        const to = indexById.get(c.to_item_id);
        return from === undefined || to === undefined
          ? []
          : [{ fromIndex: from, toIndex: to, relation: c.relation_type }];
      }),
    };
  } catch (e) {
    console.warn("[bom-store] kunde inte läsa sparad stycklista:", e);
    return null;
  }
}

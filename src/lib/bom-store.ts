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

export interface BomLineInput {
  sku: string;
  quantity: number;
  role: string;
  reason?: string;
  /** Katalogprodukten, när SKU:n motsvarar en. Saknas för SPECIFY,
   *  CUSTOM-SOLUTION och rena varningsrader -- de sparas ändå, med sku satt
   *  och product_id null. */
  product?: { id: string } | null;
}

/**
 * Skriver stycklistan och returnerar dess bom-id, eller null om något gick
 * fel. Kastar aldrig.
 */
export async function saveBomNormalized(
  userId: string,
  lines: BomLineInput[],
  notes?: string | null,
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

    const { error: itemsErr } = await supabase.from("bom_items").insert(
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
      })),
    );

    if (itemsErr) {
      // Lämna ingen tom stycklista efter oss -- den skulle dyka upp som ett
      // innehållslöst projekt. Kräver delete-policyn på boms som lades till i
      // migration 20260908180000.
      await supabase.from("boms").delete().eq("id", bom.id);
      console.warn("[bom-store] kunde inte skriva bom_items, rullade tillbaka:", itemsErr.message);
      return null;
    }

    return bom.id;
  } catch (e) {
    console.warn("[bom-store] oväntat fel, faller tillbaka på JSON:", e);
    return null;
  }
}

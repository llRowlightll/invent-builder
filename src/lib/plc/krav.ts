/**
 * Kraven i ett maskinprojekt, hämtade ur kravbilden
 * (supabase/functions/groq-advisor/kravbild.ts) -- samma tolkning som
 * maskinbyggaren visar och motorn använder, så att PLC-underlaget och
 * stycklistan aldrig läser samma beskrivning på två sätt.
 *
 * Varje krav bär föremål, egenskap, ursprung och bekräftelse. Intervall står
 * kvar som intervall ("0,5–3 kg"); ett dimensionerande värde är ett eget,
 * härlett krav. "24/7" är en drifttid, aldrig en takt. Det maskinprojektet
 * saknar följer med som luckor, och osäkra tolkningar som inte avgjorts som
 * öppna frågor -- inget fylls i med påhittade värden.
 */
import { delaSvar, kravetsVarde, tolkaKravbild } from "../../../supabase/functions/groq-advisor/kravbild.ts";
import type { Importerat, ImporteradKomponent, ImporteratKrav } from "./modell.ts";

export interface ProjektKalla {
  name: string;
  description: string | null;
  answers: Record<string, string>;
  bom_lines: Array<{ sku: string; role: string; qty: number; name?: string }>;
  revision: number;
}

export function importeraKrav(p: ProjektKalla, nu: Date = new Date()): Importerat {
  const beskrivning = (p.description ?? p.name ?? "").trim();
  const { svar, tolkning } = delaSvar(p.answers ?? {});
  const kb = tolkaKravbild(beskrivning, svar, tolkning);

  const krav: ImporteratKrav[] = kb.krav.map((k) => ({
    id: k.id,
    varde: kravetsVarde(k, "sv"),
    kalla: k.kalla.typ,
    ...(k.kalla.svarId ? { kallaDetalj: k.kalla.svarId } : {}),
    objekt: k.objektId,
    egenskap: k.egenskap,
    ursprung: k.ursprung,
    bekraftelse: k.bekraftelse,
    ...(k.metod ? { metod: k.metod } : {}),
  }));

  const komponenter: ImporteradKomponent[] = (p.bom_lines ?? []).map((l) => ({
    sku: l.sku, roll: l.role, antal: l.qty, ...(l.name ? { namn: l.name } : {}),
  }));

  return {
    kallrevision: p.revision,
    hamtat: nu.toISOString(),
    krav,
    komponenter,
    saknas: kb.saknas.map((s) => ({ id: s.id, sv: s.sv, en: s.en })),
    osakra: kb.osakra.map((o) => ({ id: o.id, sv: o.fraga.sv, en: o.fraga.en })),
    processbeskrivning: beskrivning,
  };
}

export interface KravAndring {
  id: string;
  /** Värdet före, eller null om kravet är nytt. */
  fore: string | null;
  /** Värdet efter, eller null om kravet inte längre finns i projektet. */
  efter: string | null;
}

/**
 * Vad som ändrats mellan två hämtningar av kraven, nyckel för nyckel.
 * Oförändrade krav utelämnas; gamla och nya värden visas sida vid sida.
 */
export function jamforKrav(fore: ImporteratKrav[], efter: ImporteratKrav[]): KravAndring[] {
  const a = new Map(fore.map((k) => [k.id, k.varde]));
  const b = new Map(efter.map((k) => [k.id, k.varde]));
  const ut: KravAndring[] = [];
  for (const [id, v] of b) if (a.get(id) !== v) ut.push({ id, fore: a.get(id) ?? null, efter: v });
  for (const [id, v] of a) if (!b.has(id)) ut.push({ id, fore: v, efter: null });
  return ut;
}

export interface KomponentAndring {
  sku: string;
  roll: string;
  fore: number | null;
  efter: number | null;
}

/** Komponenter som tillkommit, försvunnit eller fått ett annat antal, per artikel och roll. */
export function jamforKomponenter(fore: ImporteradKomponent[], efter: ImporteradKomponent[]): KomponentAndring[] {
  const nyckel = (k: ImporteradKomponent) => JSON.stringify([k.sku, k.roll]);
  const summa = (lista: ImporteradKomponent[]) => {
    const m = new Map<string, { sku: string; roll: string; antal: number }>();
    for (const k of lista) {
      const n = nyckel(k);
      const fanns = m.get(n);
      m.set(n, { sku: k.sku, roll: k.roll, antal: (fanns?.antal ?? 0) + k.antal });
    }
    return m;
  };
  const a = summa(fore);
  const b = summa(efter);
  const ut: KomponentAndring[] = [];
  for (const [n, k] of b) {
    const gammal = a.get(n);
    if (!gammal || gammal.antal !== k.antal) ut.push({ sku: k.sku, roll: k.roll, fore: gammal?.antal ?? null, efter: k.antal });
  }
  for (const [n, k] of a) if (!b.has(n)) ut.push({ sku: k.sku, roll: k.roll, fore: k.antal, efter: null });
  return ut;
}

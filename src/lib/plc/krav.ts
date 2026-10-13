/**
 * Kraven i ett maskinprojekt, hämtade med motorns egna detektorer
 * (supabase/functions/groq-advisor/signals.ts) -- samma som maskinbyggaren
 * använde när den valde komponenterna, så att PLC-underlaget och stycklistan
 * aldrig läser samma beskrivning på två sätt.
 *
 * Värdena tolkas inte om. "24/7" är en drifttid, aldrig en takt: en takt
 * finns bara om kunden angett den (följdfrågan om hur ofta rörelsen görs, eller
 * en cykeltid i texten). Varje krav bär sitt ursprung.
 */
import { arHorisontellRorelse, detectHazards } from "../../../supabase/functions/groq-advisor/signals.ts";
import type { Importerat, ImporteradKomponent, ImporteratKrav } from "./modell.ts";

export interface ProjektKalla {
  name: string;
  description: string | null;
  answers: Record<string, string>;
  bom_lines: Array<{ sku: string; role: string; qty: number; name?: string }>;
  revision: number;
}

function tal(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

/** Kategoriska krav lagras som koder; gränssnittet visar dem på kundens språk. */
export const KRAVKODER = {
  miljo: ["damm", "spolning", "livsmedel", "atex", "utomhus", "kyla", "varme"],
  drift: ["24_7"],
  riktning: ["lodrat", "sidled"],
  sakerhet: ["sakerhetskrav"],
  teknik: ["elaxel"],
} as const;

export function importeraKrav(p: ProjektKalla, nu: Date = new Date()): Importerat {
  const beskrivning = (p.description ?? p.name ?? "").trim();
  const svar = p.answers ?? {};
  // Samma sammanfogning som motorn: beskrivningen och alla svar.
  const helt = `${beskrivning} ${Object.values(svar).join(" ")}`;
  const h = detectHazards(helt, svar, "sv");
  const hb = detectHazards(beskrivning, {}, "sv");
  const fran = (iBeskrivning: boolean): Pick<ImporteratKrav, "kalla"> => ({ kalla: iBeskrivning ? "beskrivning" : "svar" });

  const krav: ImporteratKrav[] = [];
  if (h.loadKg > 0) krav.push({ id: "massa", varde: `${tal(h.loadKg)} kg`, ...fran(hb.loadKg > 0) });
  const slag = h.requiredStrokeMm || h.minStrokeMm;
  if (slag > 0) krav.push({ id: "slag", varde: `${tal(slag)} mm`, ...fran((hb.requiredStrokeMm || hb.minStrokeMm) > 0) });
  if (h.speedMs > 0) krav.push({ id: "hastighet", varde: `${tal(h.speedMs)} m/s`, ...fran(hb.speedMs > 0) });
  if (h.precisionMm > 0) krav.push({ id: "noggrannhet", varde: `±${tal(h.precisionMm)} mm`, ...fran(hb.precisionMm > 0) });
  if ((h.statedForceN ?? 0) > 0) krav.push({ id: "kraft", varde: `${tal(h.statedForceN ?? 0)} N`, ...fran((hb.statedForceN ?? 0) > 0) });
  if (h.torqueNm > 0 && !h.torqueUppskattat) krav.push({ id: "vridmoment", varde: `${tal(h.torqueNm)} Nm`, ...fran(hb.torqueNm > 0) });
  if (h.rotationDeg > 0) krav.push({ id: "vinkel", varde: `${h.rotationDeg}°`, ...fran(hb.rotationDeg > 0) });

  const riktning = h.isVerticalLoad ? "lodrat" : arHorisontellRorelse(helt) ? "sidled" : "";
  if (riktning) krav.push({ id: "riktning", varde: riktning, ...fran(riktning === "lodrat" ? hb.isVerticalLoad : arHorisontellRorelse(beskrivning)) });

  const miljo: Array<[string, boolean, boolean]> = [
    ["damm", h.isDirtyEnv, hb.isDirtyEnv],
    ["spolning", !!h.isSpolmiljo, !!hb.isSpolmiljo],
    ["livsmedel", h.isFoodGrade, hb.isFoodGrade],
    ["atex", h.isAtex || h.isAtexDust, hb.isAtex || hb.isAtexDust],
    ["utomhus", h.isOutdoor, hb.isOutdoor],
    ["kyla", h.isLowTemp, hb.isLowTemp],
    ["varme", h.isHighTemp, hb.isHighTemp],
  ];
  for (const [kod, finns, iBeskrivning] of miljo) {
    if (finns) krav.push({ id: `miljo_${kod}`, varde: kod, ...fran(iBeskrivning) });
  }

  // Drifttid och takt hålls isär. 24/7 säger hur länge maskinen går, inte
  // hur ofta en rörelse görs.
  if (h.is24x7) krav.push({ id: "drift", varde: "24_7", ...fran(hb.is24x7) });
  if (h.cycleTimeS > 0) krav.push({ id: "cykeltid", varde: `${tal(h.cycleTimeS)} s`, ...fran(hb.cycleTimeS > 0) });
  if (svar.takt && !/vet inte|don't know/i.test(svar.takt)) {
    krav.push({ id: "takt", varde: svar.takt, kalla: "svar", kallaDetalj: "takt" });
  }

  if (h.isSilSafety || h.sakerhetsniva) {
    krav.push({ id: "sakerhet", varde: h.sakerhetsniva ?? "sakerhetskrav", ...fran(hb.isSilSafety || !!hb.sakerhetsniva) });
  }
  if (h.elaxel) krav.push({ id: "teknik", varde: "elaxel", ...fran(!!hb.elaxel) });

  const komponenter: ImporteradKomponent[] = (p.bom_lines ?? []).map((l) => ({
    sku: l.sku, roll: l.role, antal: l.qty, ...(l.name ? { namn: l.name } : {}),
  }));

  return { kallrevision: p.revision, hamtat: nu.toISOString(), krav, komponenter };
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

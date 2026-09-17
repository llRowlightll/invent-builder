/**
 * SMC JMHZ2 — kompakt parallellgripdon (två fingrar) ø8–20, dubbelverkande
 * eller enkelverkande (normalt öppet/stängt), med inbyggd magnet för givare.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Compact Type Parallel Style Air Gripper JMHZ2 Series" (kapitlet ur
 *   webbkatalogen, 24 sidor, katalogsidor 1–22). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-mhz2.pdf' (filen hämtades som MHZ2 men är JMHZ2;
 *   standardserien MHZ2 ligger i smc-kat-mhz2-std.pdf).
 *     - How to Order och givartabellen               sida 9
 *     - data, modelltabell, specialutföranden        sida 10
 *     - givarmontering                               sida 16–18
 *     - -X6900 styrpinnar                            sida 20
 *     - -X7460 sidomonterad givare                   sida 21
 *
 * VAD FAMILJEN ÄR. JMHZ2 kompakt: ø8/12/16/20 motsvarar MHZ2-10/16/20/25
 * (sida 4). Standardserien MHZ2 är familjen mhz2.
 *
 * KODENS FORM (sida 9):
 *
 *   JMHZ2 - 16 D   - M9BW          nyckelns exempel: ø16, dubbelverkande, två D-M9BW
 *   JMHZ2 - 8  D   - X6900 A       styrpinnar på sidan A (sida 20; ingen givarposition i nyckeln)
 *   JMHZ2 - 8  D   - M9BW - X7460  sidomonterad givare (sida 21)
 *   JMHZ2-{ø}{verkan}{finger}-{givare}{kabel}{antal}-{special}
 */

export const JMHZ2_SOURCE = {
  file: "smc-kat-mhz2.pdf",
  edition: "SMC JMHZ2 series catalogue chapter (catalogue pages 1–22, web catalogue 2026)",
  title: "SMC Compact Type Parallel Style Air Gripper JMHZ2 Series",
  brand: "SMC",
} as const;

export interface JMHZ2Value {
  code: string;
  label_sv: string;
}

export interface JMHZ2Bore extends JMHZ2Value {
  bore_mm: number;
  /** Arbetstryck [MPa] dubbelverkande respektive enkelverkande (sida 10). */
  pressure_d: [number, number];
  pressure_s: [number, number];
  /** Gripkraft per finger [N] vid 0,5 MPa, L = 20 mm: yttre/inre dubbelverkande, yttre NO, inre NC (sida 10). */
  force_d: [number, number];
  force_no: number;
  force_nc: number;
  stroke_mm: number;
  /** Vikt utan givare [g]: dubbelverkande, enkelverkande (sida 10). */
  weight_g: [number, number];
  /** Motsvarar MHZ2-storleken (sida 4). */
  mhz2: string;
}
const bore = (code: string, pd: [number, number], ps: [number, number], fd: [number, number], fno: number, fnc: number, st: number, w: [number, number], mhz2: string): JMHZ2Bore =>
  ({ code, bore_mm: Number(code), pressure_d: pd, pressure_s: ps, force_d: fd, force_no: fno, force_nc: fnc, stroke_mm: st, weight_g: w, mhz2, label_sv: `ø${code} mm (motsvarar MHZ2-${mhz2})` });
export const JMHZ2_BORES: JMHZ2Bore[] = [
  bore("8", [0.15, 0.7], [0.35, 0.7], [7.8, 10.5], 4.5, 7.8, 4, [31, 35], "10"),
  bore("12", [0.1, 0.7], [0.3, 0.7], [17.5, 23.3], 11.2, 19.3, 6, [65, 72], "16"),
  bore("16", [0.1, 0.7], [0.25, 0.7], [32.7, 43.5], 22.9, 36.0, 10, [128, 142], "20"),
  bore("20", [0.1, 0.7], [0.25, 0.7], [54.2, 72.2], 38.3, 57.4, 14, [240, 270], "25"),
];
export const JMHZ2_ACTIONS: JMHZ2Value[] = [
  { code: "D", label_sv: "Dubbelverkande" },
  { code: "S", label_sv: "Enkelverkande, normalt öppet" },
  { code: "C", label_sv: "Enkelverkande, normalt stängt" },
];
export const JMHZ2_FINGERS: JMHZ2Value[] = [
  { code: "1", label_sv: "Fingrar med sidogängad montering" },
  { code: "2", label_sv: "Fingrar med genomgående hål i öppnings-/stängningsriktningen" },
];
export interface JMHZ2Switch extends JMHZ2Value {
  /** Kabellängder 0,5 m, 1 m (M), 3 m (L), 5 m (Z): S standard, O på beställning (sida 9). */
  leads: string;
  water_resistant: boolean;
}
const sw = (code: string, label: string, leads: string, water = false): JMHZ2Switch[] => [
  { code, leads, water_resistant: water, label_sv: `D-${code}, ${label}` },
  { code: `${code}V`, leads, water_resistant: water, label_sv: `D-${code}V, ${label}, vinkelrät anslutning` },
];
/** Givartabellen sida 9: solid state, grommet, 24 V DC. */
export const JMHZ2_SWITCHES: JMHZ2Switch[] = [
  ...sw("M9N", "3-tråd NPN", "SSSO"),
  ...sw("M9P", "3-tråd PNP", "SSSO"),
  ...sw("M9B", "2-tråd", "SSSO"),
  ...sw("M9NW", "3-tråd NPN, tvåfärgsindikering", "SSSO"),
  ...sw("M9PW", "3-tråd PNP, tvåfärgsindikering", "SSSO"),
  ...sw("M9BW", "2-tråd, tvåfärgsindikering", "SSSO"),
  ...sw("M9NA", "3-tråd NPN, vattentät, tvåfärgsindikering", "OOSO", true),
  ...sw("M9PA", "3-tråd PNP, vattentät, tvåfärgsindikering", "OOSO", true),
  ...sw("M9BA", "2-tråd, vattentät, tvåfärgsindikering", "OOSO", true),
];
export const JMHZ2_LEADS: JMHZ2Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
export const JMHZ2_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3 };
export interface JMHZ2Count extends JMHZ2Value {
  n: boolean;
}
export const JMHZ2_COUNTS: JMHZ2Count[] = [
  { code: "S", n: false, label_sv: "En givare (standard är två)" },
  { code: "3", n: true, label_sv: "Tre givare (n st)" },
  { code: "4", n: true, label_sv: "Fyra givare (n st)" },
];
export interface JMHZ2Mto extends JMHZ2Value {
  no_magnet?: boolean;
  /** -X6900: nyckeln på sida 20 har ingen givarposition. */
  no_switch?: boolean;
  /** -X7460: tre eller fler givare efter förfrågan (sida 21). */
  max_two_switches?: boolean;
}
/** Specialutförande sida 10 och de individuella sida 20–21. */
export const JMHZ2_MTO: JMHZ2Mto[] = [
  { code: "X50", no_magnet: true, label_sv: "-X50 Utan magnet" },
  { code: "X6900A", no_switch: true, label_sv: "-X6900A Styrpinnar på sidomonteringsytan A (portsidan)" },
  { code: "X6900B", no_switch: true, label_sv: "-X6900B Styrpinnar på sidomonteringsytan B" },
  { code: "X7460", max_two_switches: true, label_sv: "-X7460 Sidomonterad givare (plåt på två sidoytor, egen kropp)" },
];
export const JMHZ2_LIMITS = {
  max_pressure_mpa: 0.7,
  temp_c: [-10, 60],
  repeatability_mm: 0.01,
  max_frequency_cpm: 120,
} as const;

export interface JMHZ2Config {
  bore: string;
  action: string;
  finger?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

export function jmhz2BuildCode(c: JMHZ2Config): string | null {
  const b = JMHZ2_BORES.find((x) => x.code === c.bore);
  const a = JMHZ2_ACTIONS.find((x) => x.code === c.action);
  if (!b || !a) return null;
  const finger = c.finger ?? "";
  if (finger && !har(JMHZ2_FINGERS, finger)) return null;
  const mto = c.mto ?? "";
  const x = mto ? JMHZ2_MTO.find((y) => y.code === mto) : undefined;
  if (mto && !x) return null;
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = JMHZ2_SWITCHES.find((y) => y.code === sw);
    if (!g || x?.no_magnet || x?.no_switch) return null;
    if (lead && !har(JMHZ2_LEADS, lead)) return null;
    if (g.leads[JMHZ2_LEAD_INDEX[lead]] === "-") return null;
    if (count) {
      const n = JMHZ2_COUNTS.find((y) => y.code === count);
      if (!n || (n.n && x?.max_two_switches)) return null;
    }
  } else if (lead || count) return null;
  return [`JMHZ2-${b.code}${a.code}${finger}`, `${sw}${lead}${count}`, mto].filter((g) => g).join("-");
}

export function jmhz2ParseCode(raw: string): { config: JMHZ2Config } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...JMHZ2_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^JMHZ2-(8|12|16|20)([DSC])([12])?(?:-(${givare})([MLZ])?(S|3|4)?)?(?:-(X[A-Z0-9]+))?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, bore, action, finger, sw, lead, count, mto] = m;
  const c: JMHZ2Config = { bore, action, finger: finger || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined };
  if (jmhz2BuildCode(c) !== k) return null;
  return { config: c };
}

export const JMHZ2_ORDER_CODE_TEMPLATE = "JMHZ2-{bore}{action}{finger}-{switch}{lead}{count}-{mto}";

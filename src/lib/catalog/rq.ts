/**
 * SMC RQ — kompaktcylinder med luftdämpning ø20–100, standardtyp och
 * långslagstyp (gummibuffert), med eller utan magnet för givare (RDQ).
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Compact Cylinder with Air Cushion RQ Series" (kapitlet ur webb-
 *   katalogen, 37 sidor, katalogsidor 1035–1057, hämtad 2026-09-16 från
 *   seriesList/?id=RQ-RDQ-E). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-rq.pdf'.
 *     - How to Order, standardtyp, givartabell     sida 1039
 *     - data, standardslag, mellanslag, special    sida 1040
 *     - How to Order, långslagstyp                 sida 1053-2
 *     - data långslagstyp, mellanslag              sida 1053-3
 *
 * VAD FAMILJEN ÄR. RQ/RDQ. Familjen hette 'rdqb' i databasen — det är bara
 * magnetutförandet med genomgående hål (R D Q B), en av kombinationerna.
 *
 * KODENS FORM (sida 1039 och 1053-2):
 *
 *   RQ  B 32   - 50           standard, genomgående hål, ø32, 50 mm (nyckelns exempel)
 *   RDQ B 32   - 50   - M9BW  med magnet och två D-M9BW
 *   RDQ L 40   - 50           magnetcylinder utan givare (sida 1039, "RDQL40-50")
 *   RQ  A 32   - 300 C        långslagstyp med gummibuffert (sida 1053-2; A = genomgående
 *                              hål i långslagsnyckeln)
 *   RDQ F 32   - 200 C M      viktexemplet (sida 1053-3): magnet, fläns, buffert, hangänga
 *   RQ  B 32   - 47           mellanslag i 1 mm-steg, egen tub (sida 1040)
 *   Katalogens mellanslagsexempel för långslagstypen är tryckt "RQA32-115DC"
 *   (sida 1053-3) — D finns inte i nyckeln (sida 1053-2), så vi läser det
 *   som RQA32-115C.
 *   R{magnet}Q{fäste}{ø}{gänga}-{slag}{buffert}{stångände}-{givare}{kabel}{antal}-{special}
 */

export const RQ_SOURCE = {
  file: "smc-kat-rq.pdf",
  edition: "SMC RQ series catalogue chapter (catalogue pages 1035–1057, web catalogue 2026)",
  title: "SMC Compact Cylinder with Air Cushion RQ Series",
  brand: "SMC",
} as const;

export interface RQValue {
  code: string;
  label_sv: string;
}

export interface RQBore extends RQValue {
  bore_mm: number;
  /** Standardslag standardtyp och långslagstyp (sida 1040, 1053-3). */
  standard: number[];
  long: number[];
  /** Mellanslag i 1 mm-steg: [min, max] standardtyp respektive långslagstyp. */
  intermediate: [number, number];
  intermediate_long: [number, number];
  /** Gängan i basutförandet (sida 1039) och portstorleken (måttabellerna sida 1043, 1046, 1049). */
  thread: "M" | "Rc";
  port: string;
  /** Fäste A (båda ändar gängade) finns i standardtyp (sida 1039, not 2: inte ø20/25). */
  tapped_ok: boolean;
  /** D-P3DWA passar (sida 1039: ø25–100). */
  p3dwa_ok: boolean;
  /** -XC35 finns (sida 1040: ø32–100). */
  xc35_ok: boolean;
  /** Effektiv dämpningslängd [mm] och teoretisk kraft ut/in vid 0,5 MPa [N] (sida 1040). */
  cushion_mm: number;
  force_out_n: number;
  force_in_n: number;
}
const bore = (code: string, standard: number[], long: number[], im: [number, number], iml: [number, number], port: string, cushion: number, fout: number, fin: number): RQBore => {
  const thread = port.startsWith("Rc") ? "Rc" : "M";
  return { code, bore_mm: Number(code), standard, long, intermediate: im, intermediate_long: iml, thread, port, tapped_ok: thread === "Rc", p3dwa_ok: code !== "20", xc35_ok: thread === "Rc", cushion_mm: cushion, force_out_n: fout, force_in_n: fin, label_sv: `ø${code} mm (${port})` };
};
const L1 = [75, 100, 125, 150, 175, 200];
const L2 = [125, 150, 175, 200, 250, 300];
export const RQ_BORES: RQBore[] = [
  bore("20", [15, 20, 25, 30, 40, 50], L1, [16, 49], [51, 199], "M5 x 0,8", 5.8, 157, 118),
  bore("25", [15, 20, 25, 30, 40, 50], L1, [16, 49], [51, 199], "M5 x 0,8", 6.1, 245, 189),
  bore("32", [20, 25, 30, 40, 50, 75, 100], L2, [21, 99], [101, 299], "Rc 1/8", 6.6, 402, 302),
  bore("40", [20, 25, 30, 40, 50, 75, 100], L2, [21, 99], [101, 299], "Rc 1/8", 6.6, 628, 528),
  bore("50", [30, 40, 50, 75, 100], L2, [31, 99], [101, 299], "Rc 1/4", 7.1, 982, 825),
  bore("63", [30, 40, 50, 75, 100], L2, [31, 99], [101, 299], "Rc 1/4", 7, 1560, 1400),
  bore("80", [40, 50, 75, 100], L2, [41, 99], [101, 299], "Rc 3/8", 7.5, 2510, 2270),
  bore("100", [40, 50, 75, 100], L2, [41, 99], [101, 299], "Rc 3/8", 8, 3930, 3570),
];
export const RQ_MAGNET: RQValue = { code: "D", label_sv: "Inbyggd magnet för givare (RDQ)" };
export interface RQMounting extends RQValue {
  /** Finns i standardtyp respektive långslagstyp (sida 1039, 1053-2). */
  standard: boolean;
  long: boolean;
  /** Fästets artikelnummer per borrning: CQS-…0xx för ø20/25, CQ-…0xx för ø32–100 (sida 1040). */
  bracket?: string;
}
export const RQ_MOUNTINGS: RQMounting[] = [
  { code: "B", standard: true, long: false, label_sv: "Genomgående hål (standardtyp)" },
  { code: "A", standard: true, long: true, label_sv: "Båda ändar gängade (standardtyp ø32–100); genomgående hål i långslagstypen" },
  { code: "L", standard: true, long: true, bracket: "L", label_sv: "Fotfäste (medföljer omonterat)" },
  { code: "LC", standard: true, long: true, bracket: "LC", label_sv: "Kompakt fotfäste (medföljer omonterat)" },
  { code: "F", standard: true, long: true, bracket: "F", label_sv: "Fläns vid kolvstången (medföljer omonterad)" },
  { code: "G", standard: true, long: true, bracket: "F", label_sv: "Fläns vid gaveln (medföljer omonterad)" },
  { code: "D", standard: true, long: true, bracket: "D", label_sv: "Dubbelt gaffelfäste (medföljer omonterat)" },
];
export const RQ_THREADS: RQValue[] = [
  { code: "TN", label_sv: "Portgänga NPT (ø32–100; standard är Rc)" },
  { code: "TF", label_sv: "Portgänga G (ø32–100; standard är Rc)" },
];
export const RQ_BUMPER: RQValue = { code: "C", label_sv: "Långslagstyp med gummibuffert (slag över standardtypens område)" };
export const RQ_ROD_END: RQValue = { code: "M", label_sv: "Hangängad kolvstångsände (standard är hongänga)" };
export interface RQSwitch extends RQValue {
  kind: "solid" | "reed";
  /** Kabellängder 0,5 m, 1 m (M), 3 m (L), 5 m (Z): S standard, O på beställning, - finns inte (sida 1039). */
  leads: string;
  water_resistant: boolean;
  /** Bara ø25–100 (sida 1039, ∗∗). */
  not_20: boolean;
}
const sw = (code: string, label: string, leads: string, kind: "solid" | "reed", water = false, vleads = leads): RQSwitch[] => [
  { code, kind, leads, water_resistant: water, not_20: false, label_sv: `D-${code}, ${label}` },
  { code: `${code}V`, kind, leads: vleads, water_resistant: water, not_20: false, label_sv: `D-${code}V, ${label}, vinkelrät anslutning` },
];
export const RQ_SWITCHES: RQSwitch[] = [
  ...sw("M9N", "3-tråd NPN", "SSSO", "solid"),
  ...sw("M9P", "3-tråd PNP", "SSSO", "solid"),
  ...sw("M9B", "2-tråd", "SSSO", "solid"),
  ...sw("M9NW", "3-tråd NPN, tvåfärgsindikering", "SSSO", "solid"),
  ...sw("M9PW", "3-tråd PNP, tvåfärgsindikering", "SSSO", "solid"),
  ...sw("M9BW", "2-tråd, tvåfärgsindikering", "SSSO", "solid"),
  ...sw("M9NA", "3-tråd NPN, vattentät, tvåfärgsindikering", "OOSO", "solid", true),
  ...sw("M9PA", "3-tråd PNP, vattentät, tvåfärgsindikering", "OOSO", "solid", true),
  ...sw("M9BA", "2-tråd, vattentät, tvåfärgsindikering", "OOSO", "solid", true),
  { code: "P3DWA", kind: "solid", leads: "S-SS", water_resistant: false, not_20: true, label_sv: "D-P3DWA, 2-tråd opolär, magnetfältsokänslig (ø25–100)" },
  ...sw("A96", "reed 3-tråd", "S-S-", "reed"),
  ...sw("A93", "reed 2-tråd", "SSSS", "reed", false, "S-SS"),
  ...sw("A90", "reed utan indikering", "S-S-", "reed"),
];
export const RQ_LEADS: RQValue[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
export const RQ_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3 };
export const RQ_COUNTS: RQValue[] = [
  { code: "S", label_sv: "En givare (standard är två)" },
  { code: "3", label_sv: "Tre givare (n st)" },
  { code: "4", label_sv: "Fyra givare (n st)" },
];
export interface RQMto extends RQValue {
  /** Bara ø32–100 (sida 1040). */
  large_only: boolean;
}
/** Specialutföranden sida 1040 (standardtypen; långslagsnyckeln har ingen specialposition). */
export const RQ_MTO: RQMto[] = [
  { code: "XA", large_only: false, label_sv: "-XA□ Ändrad kolvstångsände" },
  { code: "XC4", large_only: false, label_sv: "-XC4 Kraftig avstrykare" },
  { code: "XC35", large_only: true, label_sv: "-XC35 Spiralavstrykare (ø32–100)" },
];
export const RQ_LIMITS = {
  max_pressure_mpa: 1.0,
  min_pressure_mpa: 0.05,
  proof_pressure_mpa: 1.5,
  temp_c: [-10, 70],
  temp_magnet_c: [-10, 60],
  speed_mm_s: [50, 500],
} as const;

export interface RQConfig {
  bore: string;
  mounting: string;
  stroke_mm: number;
  magnet?: boolean;
  thread?: string;
  bumper?: string;
  rod_end?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

/** Standardtypens största slag; över det är cylindern långslagstyp med C (sida 1040, 1053-3). */
export function rqStandardMax(b: RQBore): number {
  return b.intermediate[1] + 1;
}
export function rqLongMax(b: RQBore): number {
  return b.intermediate_long[1] + 1;
}
export function rqIsStandardStroke(b: RQBore, st: number): boolean {
  return b.standard.includes(st) || b.long.includes(st);
}

export function rqBuildCode(c: RQConfig): string | null {
  const b = RQ_BORES.find((x) => x.code === c.bore);
  const mt = RQ_MOUNTINGS.find((x) => x.code === c.mounting);
  if (!b || !mt) return null;
  const st = c.stroke_mm;
  if (!Number.isInteger(st) || st < b.standard[0] || st > rqLongMax(b)) return null;
  const long = st > rqStandardMax(b);
  const bumper = c.bumper ?? "";
  if (bumper && bumper !== RQ_BUMPER.code) return null;
  if ((bumper === "C") !== long) return null;
  if (long ? !mt.long : !mt.standard) return null;
  if (!long && mt.code === "A" && !b.tapped_ok) return null;
  const magnet = c.magnet === true;
  const thread = c.thread ?? "";
  if (thread && (!har(RQ_THREADS, thread) || b.thread !== "Rc")) return null;
  const rod = c.rod_end ?? "";
  if (rod && rod !== RQ_ROD_END.code) return null;
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = RQ_SWITCHES.find((x) => x.code === sw);
    if (!g || !magnet) return null;
    if (g.not_20 && b.code === "20") return null;
    if (lead && !har(RQ_LEADS, lead)) return null;
    if (g.leads[RQ_LEAD_INDEX[lead]] === "-") return null;
    if (count && !har(RQ_COUNTS, count)) return null;
  } else if (lead || count) return null;
  const mto = c.mto ?? "";
  if (mto) {
    const x = RQ_MTO.find((y) => y.code === mto);
    if (!x || long || (x.large_only && !b.xc35_ok)) return null;
  }
  const g1 = `R${magnet ? "D" : ""}Q${mt.code}${b.code}${thread}`;
  const g2 = `${st}${bumper}${rod}`;
  const g3 = `${sw}${lead}${count}`;
  return [g1, g2, g3, mto].filter((g, i) => i < 2 || g).join("-");
}

export function rqParseCode(raw: string): { config: RQConfig } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...RQ_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^R(D?)Q(LC|[BALFGD])(20|25|32|40|50|63|80|100)(TN|TF)?-(\\d{1,3})(C?)(M?)(?:-(${givare})([MLZ])?(S|3|4)?)?(?:-(X[A-Z0-9]+))?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, magnet, mounting, boreCode, thread, stroke, bumper, rod, sw, lead, count, mto] = m;
  const c: RQConfig = {
    bore: boreCode, mounting, stroke_mm: Number(stroke), magnet: magnet === "D", thread: thread || undefined, bumper: bumper || undefined, rod_end: rod || undefined,
    switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined,
  };
  if (rqBuildCode(c) !== k) return null;
  return { config: c };
}

export const RQ_ORDER_CODE_TEMPLATE = "R{magnet}Q{mounting}{bore}{thread}-{stroke_mm}{bumper}{rod_end}-{switch}{lead}{count}-{mto}";

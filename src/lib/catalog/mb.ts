/**
 * SMC MB — dragstångscylinder ø32–125, dubbelverkande enkel kolvstång,
 * luftdämpning eller gummibuffert.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Air Cylinder MB Series" (katalogutdrag, 48 sidor, katalogsidor
 *   477–524). Ligger i knowledge_chunks som source_file = 'smc-kat-mb.pdf'.
 *     - kombinationstabell standard/special        sida 480
 *     - How to Order och givartabell                sida 482
 *     - data, standardslag, special, beställexempel sida 483
 *     - minsta slag för givare                      sida 518–520
 *
 * VAD FAMILJEN ÄR. MB (och magnetcylindern MDB) med enkel kolvstång.
 * MBW (dubbel kolvstång), MBK/MBKW (roterings-säkrad) och MBB (ändlås)
 * är egna nycklar; de justerbara/dubbla slagen -XC8…-XC11 och tappfästets
 * flyttade läge -XC14 beställs med extra mått och ingår inte.
 *
 * KODENS FORM (sida 482–483):
 *
 *   MB  B 32   - 50   Z          bas ø32, 50 mm, luftdämpning
 *   MDB D 32   - 50   Z - NW - M9BW      beställexemplet sida 483: dubbelt
 *                                        gaffelfäste, pivotfäste, dubbel
 *                                        knäled, två M9BW
 *   M{magnet}B{fäste}{ø}{gänga}-{slag}{dämpning}{bälg}Z-{pivot}{knäled}-{givare}{kabel}{antal}-{special}
 */

export const MB_SOURCE = {
  file: "smc-kat-mb.pdf",
  edition: "SMC MB catalogue (catalogue pages 477–524)",
  title: "SMC Air Cylinder MB Series",
  brand: "SMC",
} as const;

export interface MBValue {
  code: string;
  label_sv: string;
}

export interface MBBore extends MBValue {
  bore_mm: number;
  /** Standardslag (sida 483, slagområde 1). */
  standard: number[];
  /** Slagområde 2 (sida 483): upp till detta är artikelnumret standardformat. */
  range2_mm: number;
  /** Största tillverkbara slag; däröver rådgör med SMC (sida 483, not 3). */
  max_mm: number;
  /** Portstorlek Rc (sida 483). */
  port: string;
  /** Gummibuffertens tillägg till längden [mm] (sida 482). */
  bumper_add_mm: number;
}
const bore = (code: string, standard: number[], range2: number, port: string, bumper: number): MBBore =>
  ({ code, bore_mm: Number(code), standard, range2_mm: range2, max_mm: 2700, port, bumper_add_mm: bumper, label_sv: `ø${code} mm` });
const S1 = [25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500];
export const MB_BORES: MBBore[] = [
  bore("32", S1, 1000, "Rc 1/8", 6),
  bore("40", S1, 1000, "Rc 1/8", 6),
  bore("50", [...S1, 600], 1800, "Rc 1/4", 8),
  bore("63", [...S1, 600], 1800, "Rc 1/4", 8),
  bore("80", [...S1, 600, 700, 800], 1800, "Rc 3/8", 10),
  bore("100", [...S1, 600, 700, 800], 1800, "Rc 3/8", 10),
  bore("125", [...S1, 600, 700, 800, 900, 1000], 2000, "Rc 1/2", 12),
];
export interface MBMounting extends MBValue {
  /** Pivotfästet N finns (sida 482: bara D och T). */
  pivot: boolean;
  /** Centrerat tappfäste: egen tabell för minsta slag (sida 519–520). */
  trunnion: boolean;
}
export const MB_MOUNTINGS: MBMounting[] = [
  { code: "B", pivot: false, trunnion: false, label_sv: "Basutförande" },
  { code: "L", pivot: false, trunnion: false, label_sv: "Fotfäste" },
  { code: "F", pivot: false, trunnion: false, label_sv: "Fläns vid kolvstången" },
  { code: "G", pivot: false, trunnion: false, label_sv: "Fläns vid gaveln" },
  { code: "C", pivot: false, trunnion: false, label_sv: "Enkelt gaffelfäste" },
  { code: "D", pivot: true, trunnion: false, label_sv: "Dubbelt gaffelfäste" },
  { code: "T", pivot: true, trunnion: true, label_sv: "Centrerat tappfäste (monterat vid leverans)" },
];
export const MB_MAGNET: MBValue = { code: "D", label_sv: "Inbyggd magnet för givare (MDB)" };
export const MB_PORTS: MBValue[] = [
  { code: "TN", label_sv: "Portgänga NPT (standard är Rc)" },
  { code: "TF", label_sv: "Portgänga G (standard är Rc)" },
];
export const MB_CUSHION: MBValue = { code: "N", label_sv: "Gummibuffert i stället för luftdämpning (cylindern blir 6–12 mm längre)" };
export const MB_BOOTS: MBValue[] = [
  { code: "J", label_sv: "Bälg i nylonduk" },
  { code: "K", label_sv: "Värmebeständig bälg" },
];
export const MB_PIVOT: MBValue = { code: "N", label_sv: "Pivotfäste, medföljer (bara dubbelt gaffelfäste D och tappfäste T)" };
export const MB_KNUCKLES: MBValue[] = [
  { code: "V", label_sv: "Enkel knäled på kolvstången (sprint ingår inte)" },
  { code: "W", label_sv: "Dubbel knäled på kolvstången" },
];

export interface MBSwitch extends MBValue {
  kind: "reed" | "solid";
  /** Kabellängder 0,5 m, 1 m (M), 3 m (L), 5 m (Z): S standard, O på beställning, - finns inte, T plintutförande utan kabel (bara Nil). */
  leads: string;
  /**
   * Minsta slag utan tappfäste [en givare, två givare] per borrgrupp
   * ø32–63, ø80–100, ø125 (sida 518–519).
   */
  min: [[number, number], [number, number], [number, number]];
  /** Två givare på samma sida kräver detta (bara A3/A4-typerna, sida 518). */
  min_same_side?: number;
  /** Minsta slag med tappfäste T per ø32/40/50/63/80/100/125 (sida 519–520). */
  min_trunnion: number[];
}
type Min3 = [number, number, number];
const sw = (code: string, label: string, leads: string, kind: "reed" | "solid", min: number | Min3 | { one: Min3; two: Min3 }, trunnion: number[], sameSide?: number): MBSwitch => {
  const one: Min3 = typeof min === "number" ? [min, min, min] : Array.isArray(min) ? min : min.one;
  const two: Min3 = typeof min === "number" ? [min, min, min] : Array.isArray(min) ? min : min.two;
  return { code, kind, leads, label_sv: label, min: [[one[0], two[0]], [one[1], two[1]], [one[2], two[2]]], min_trunnion: trunnion, min_same_side: sameSide };
};
/** Givartabellen sida 482 (bara raka dragstångsmonterade modeller står i nyckeln). */
export const MB_SWITCHES: MBSwitch[] = [
  sw("M9N", "D-M9N, 3-tråd NPN", "SSSO", "solid", 15, [75, 80, 80, 85, 90, 95, 105]),
  sw("M9P", "D-M9P, 3-tråd PNP", "SSSO", "solid", 15, [75, 80, 80, 85, 90, 95, 105]),
  sw("M9B", "D-M9B, 2-tråd", "SSSO", "solid", 15, [75, 80, 80, 85, 90, 95, 105]),
  sw("M9NW", "D-M9NW, NPN, tvåfärgsindikering", "SSSO", "solid", 15, [75, 80, 80, 85, 90, 95, 105]),
  sw("M9PW", "D-M9PW, PNP, tvåfärgsindikering", "SSSO", "solid", 15, [75, 80, 80, 85, 90, 95, 105]),
  sw("M9BW", "D-M9BW, 2-tråd, tvåfärgsindikering", "SSSO", "solid", 15, [75, 80, 80, 85, 90, 95, 105]),
  sw("M9NA", "D-M9NA, NPN, vattentät", "OOSO", "solid", 15, [80, 85, 85, 90, 95, 100, 110]),
  sw("M9PA", "D-M9PA, PNP, vattentät", "OOSO", "solid", 15, [80, 85, 85, 90, 95, 100, 110]),
  sw("M9BA", "D-M9BA, 2-tråd, vattentät", "OOSO", "solid", 15, [80, 85, 85, 90, 95, 100, 110]),
  sw("F59F", "D-F59F, 4-tråd NPN med diagnosutgång", "S-SO", "solid", { one: [10, 25, 25], two: [15, 25, 25] }, [90, 95, 95, 110, 115, 120, 130]),
  sw("P3DWA", "D-P3DWA, 2-tråd, magnetfältsokänslig", "S-SS", "solid", 15, [80, 85, 90, 90, 95, 100, 100]),
  sw("P4DW", "D-P4DW, 2-tråd, magnetfältsokänslig", "--SS", "solid", [15, 15, 20], [120, 120, 130, 130, 140, 140, 150]),
  sw("A96", "D-A96, reed 3-tråd", "SSSS", "reed", 15, [70, 75, 75, 80, 85, 95, 100]),
  sw("A93", "D-A93, reed 2-tråd", "SSSS", "reed", 15, [70, 75, 75, 80, 85, 95, 100]),
  sw("A90", "D-A90, reed utan indikering", "SSSS", "reed", 15, [70, 75, 75, 80, 85, 95, 100]),
  sw("A54", "D-A54, reed 100/200 V", "S-SS", "reed", [15, 20, 20], [60, 60, 80, 105, 110, 115, 115]),
  sw("A64", "D-A64, reed 200 V utan indikering", "S-S-", "reed", [15, 20, 20], [60, 60, 80, 105, 110, 115, 115]),
  sw("A33", "D-A33, reed med plintanslutning (bandmontering)", "T---", "reed", 10, [60, 65, 65, 75, 80, 85, 90], 100),
  sw("A34", "D-A34, reed med plintanslutning (bandmontering)", "T---", "reed", 10, [60, 65, 65, 75, 80, 85, 90], 100),
  sw("A44", "D-A44, reed med DIN-plint (bandmontering)", "T---", "reed", 10, [70, 75, 75, 80, 80, 85, 90], 55),
  sw("A59W", "D-A59W, reed tvåfärgsindikering", "S-S-", "reed", { one: [15, 25, 25], two: [20, 25, 25] }, [60, 70, 85, 110, 115, 120, 120]),
];
// A3/A4: två givare på olika sidor kräver 35 mm (sida 518); tabellen ovan
// bär värdet för en givare, min_same_side värdet för samma sida.
for (const g of MB_SWITCHES) if (g.min_same_side) g.min = [[10, 35], [10, 35], [10, 35]];
export const MB_LEADS: MBValue[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
export const MB_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3 };
export const MB_COUNTS: MBValue[] = [
  { code: "S", label_sv: "En givare (standard är två)" },
  { code: "3", label_sv: "Tre givare" },
];

export interface MBMto extends MBValue {
  /**
   * Kombinationstabellen sida 480, enkel kolvstång: [luft ø32–100, luft ø125,
   * gummi ø32–100, gummi ø125] med M = specialutförande (◎), S = specialprodukt
   * (○, varning), - = finns inte.
   */
  marks: string;
}
const m = (code: string, marks: string, label: string): MBMto => ({ code, marks, label_sv: label });
export const MB_MTO: MBMto[] = [
  m("XA", "MMMM", "-XA□ Ändrad kolvstångsände (mått anges vid beställning)"),
  m("XB5", "MSSS", "-XB5 Grov kolvstång"),
  m("XB6", "MMSS", "-XB6 Värmebeständig –10…150 °C"),
  m("XB13", "MSMS", "-XB13 Låg hastighet 5–50 mm/s"),
  m("XC3", "MSMS", "-XC3 Speciell portplacering"),
  m("XC4", "MSMS", "-XC4 Kraftig avstrykare"),
  m("XC5", "MMSS", "-XC5 Värmebeständig –10…110 °C"),
  m("XC6", "-M-M", "-XC6 Rostfritt utförande (bara ø125)"),
  m("XC7", "MSMS", "-XC7 Dragstänger, dämpventil och muttrar i rostfritt stål"),
  m("XC12", "MSMS", "-XC12 Tandemcylinder"),
  m("XC22", "MMSS", "-XC22 Fluorgummitätningar"),
  m("XC26", "-M-M", "-XC26 Saxpinnar och planbrickor till gaffel-/knäledssprint (bara ø125)"),
  m("XC27", "MMMM", "-XC27 Rostfria gaffel-/knäledssprintar"),
  m("XC29", "MSMS", "-XC29 Dubbel knäled med fjädersprint"),
  m("XC30", "MSMS", "-XC30 Tappfäste vid kolvstången"),
  m("XC35", "MSMS", "-XC35 Spiralavstrykare"),
  m("XC65", "MSMS", "-XC65 Rostfritt (XC7 + XC68)"),
  m("XC68", "MSMS", "-XC68 Rostfritt med hårdkromad kolvstång"),
  m("XC88", "MSMS", "-XC88 Svetsstänkskyddad spiralavstrykare, smörjhållare, svetsfett (rostfri kolvstång 304)"),
  m("XC89", "MSMS", "-XC89 Svetsstänkskyddad spiralavstrykare, smörjhållare, svetsfett (kolvstång S45C)"),
  m("XC91", "MSMS", "-XC91 Svetsstänkskyddad spiralavstrykare, svetsfett (kolvstång S45C)"),
  m("X1184", "MSSS", "-X1184 Med värmebeständig reedgivare –10…120 °C"),
];

export const MB_LIMITS = {
  max_pressure_mpa: 1.0,
  min_pressure_mpa: 0.05,
  proof_pressure_mpa: 1.5,
  temp_c: [-10, 70],
  temp_switch_c: [-10, 60],
  speed_mm_s: [50, 1000],
  boot_max_stroke_mm: 1000,
  min_stroke_mm: 1,
} as const;

export interface MBConfig {
  bore: string;
  mounting: string;
  stroke_mm: number;
  magnet?: boolean;
  port?: string;
  cushion?: string;
  boot?: string;
  pivot?: string;
  knuckle?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);
const grupp = (b: MBBore) => (b.bore_mm <= 63 ? 0 : b.bore_mm <= 100 ? 1 : 2);

/** Kombinationstabellens tecken för ett specialutförande, borrning och dämpning (sida 480). */
export function mbMtoMark(mto: MBMto, b: MBBore, rubber: boolean): string {
  return mto.marks[(rubber ? 2 : 0) + (b.bore_mm === 125 ? 1 : 0)];
}

/** Minsta slag för givaren: [en givare, två givare] (sida 518–520). */
export function mbMinStroke(g: MBSwitch, b: MBBore, trunnion: boolean): [number, number] {
  if (trunnion) {
    const v = g.min_trunnion[MB_BORES.indexOf(b)];
    return [v, v];
  }
  return g.min[grupp(b)];
}

export function mbBuildCode(c: MBConfig): string | null {
  const b = MB_BORES.find((x) => x.code === c.bore);
  const mt = MB_MOUNTINGS.find((x) => x.code === c.mounting);
  if (!b || !mt) return null;
  const st = c.stroke_mm;
  if (!Number.isInteger(st) || st < MB_LIMITS.min_stroke_mm || st > b.max_mm) return null;
  const magnet = c.magnet === true;
  const port = c.port ?? "";
  if (port && !har(MB_PORTS, port)) return null;
  const cushion = c.cushion ?? "";
  if (cushion && cushion !== MB_CUSHION.code) return null;
  const boot = c.boot ?? "";
  if (boot && !har(MB_BOOTS, boot)) return null;
  const pivot = c.pivot ?? "";
  if (pivot && (pivot !== MB_PIVOT.code || !mt.pivot)) return null;
  const knuckle = c.knuckle ?? "";
  if (knuckle && !har(MB_KNUCKLES, knuckle)) return null;
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = MB_SWITCHES.find((x) => x.code === sw);
    if (!g || !magnet) return null;
    if (lead && !har(MB_LEADS, lead)) return null;
    if (g.leads[MB_LEAD_INDEX[lead]] === "-") return null;
    if (count && !har(MB_COUNTS, count)) return null;
    const [en, tva] = mbMinStroke(g, b, mt.trunnion);
    if (st < (count === "S" ? en : tva)) return null;
  } else if (lead || count) return null;
  const mto = c.mto ?? "";
  if (mto) {
    const x = MB_MTO.find((y) => y.code === mto);
    if (!x || mbMtoMark(x, b, cushion === "N") === "-") return null;
  }
  const g1 = `M${magnet ? "D" : ""}B${mt.code}${b.code}${port}`;
  const g2 = `${st}${cushion}${boot}Z`;
  const g3 = `${pivot}${knuckle}`;
  const g4 = `${sw}${lead}${count}`;
  return [g1, g2, g3, g4, mto].filter((g, i) => i < 2 || g).join("-");
}

export function mbParseCode(raw: string): { config: MBConfig } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...MB_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^M(D?)B([BLFGCDT])(32|40|50|63|80|100|125)(TN|TF)?-(\\d{1,4})(N?)([JK]?)Z(?:-(N?)([VW]?))?(?:-(${givare})([MLZ])?(S|3)?)?(?:-(X[A-Z0-9]+))?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, magnet, mounting, bore, port, stroke, cushion, boot, pivot, knuckle, sw, lead, count, mto] = m;
  const c: MBConfig = {
    bore, mounting, stroke_mm: Number(stroke), magnet: magnet === "D", port: port || undefined, cushion: cushion || undefined, boot: boot || undefined,
    pivot: pivot || undefined, knuckle: knuckle || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined,
  };
  if (mbBuildCode(c) !== k) return null;
  return { config: c };
}

export const MB_ORDER_CODE_TEMPLATE =
  "M{magnet}B{mounting}{bore}{port}-{stroke_mm}{cushion}{boot}Z-{pivot}{knuckle}-{switch}{lead}{count}-{mto}";

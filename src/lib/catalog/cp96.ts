/**
 * SMC CP96 — ISO 15552-cylinder, dubbelverkande enkel eller dubbel
 * kolvstång, ø32–125.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "ISO Cylinder ISO Standard (15552) CP96 Series" (katalogutdrag,
 *   35 sidor). Ligger i knowledge_chunks som source_file = 'smc-kat-cp96.pdf'.
 *   PDF-sidor (katalogsidor inom parentes; meddelandena citerar katalogsidan):
 *     - How to Order, givartabell                     sida 4  (129)
 *     - specifikationer, standardslag, special, tillbehör sida 5 (130)
 *     - givarnas minsta slag                          sida 22 (144)
 *     - specialutföranden -XB6…-XC89                  sida 25–34 (148–155)
 *
 * VAD FAMILJEN ÄR. CP96S (standard, enkel eller dubbel kolvstång W) — CP96K
 * (ej roterande) är en egen nyckel. Dubbelslagscylindrarna -XC10/-XC11 tar två
 * slaglängder (A + B) och ingår inte; de beställs enligt sida 151–152.
 *
 * KODENS FORM (sida 4):
 *
 *   CP96S D B 32 - 100 C J W - M9BW S - □
 *   CP96S{magnet}{fäste}{ø}-{slag}{dämpning}{bälg}{stång}-{givare}{kabel}{antal}-{special}
 *
 * Dämpningen C (luftdämpning + gummi) skrivs för ø32–100; ø125 har bara
 * luftdämpning och ingen bokstav (sida 4). Bälg på båda ändar (JJ/KK)
 * förutsätter dubbel kolvstång W. Dubbel kolvstång tillverkas till 1000 mm
 * (sida 154, "Same as standard type"), enkel till 2000 (sida 5).
 */

export const CP96_SOURCE = {
  file: "smc-kat-cp96.pdf",
  edition: "SMC CP96 catalogue (catalogue pages 126–160)",
  title: "SMC ISO Cylinder CP96 Series (ISO 15552)",
  brand: "SMC",
} as const;

export interface CP96Value {
  code: string;
  label_sv: string;
}

export interface CP96Bore extends CP96Value {
  bore_mm: number;
  /** Standardslag (sida 5); ø125 har inga, allt är på beställning. */
  standard_strokes: number[];
  /** Största slag enkel kolvstång (sida 5). */
  max_stroke_mm: number;
  /** C = luftdämpning + gummidämpning finns (ø32–100); ø125 har bara luft (sida 4). */
  cushion_c: boolean;
  /** Portgänga (sida 5). */
  port: string;
  /** Största hastighet (sida 5). */
  max_speed_mm_s: number;
}
const bas = [25, 50, 80, 100, 125, 160, 200, 250, 320, 400, 500];
export const CP96_BORES: CP96Bore[] = [
  { code: "32", bore_mm: 32, standard_strokes: bas, max_stroke_mm: 2000, cushion_c: true, port: "G1/8", max_speed_mm_s: 1000, label_sv: "ø32 mm" },
  { code: "40", bore_mm: 40, standard_strokes: bas, max_stroke_mm: 2000, cushion_c: true, port: "G1/4", max_speed_mm_s: 1000, label_sv: "ø40 mm" },
  { code: "50", bore_mm: 50, standard_strokes: [...bas, 600], max_stroke_mm: 2000, cushion_c: true, port: "G1/4", max_speed_mm_s: 1000, label_sv: "ø50 mm" },
  { code: "63", bore_mm: 63, standard_strokes: [...bas, 600], max_stroke_mm: 2000, cushion_c: true, port: "G3/8", max_speed_mm_s: 1000, label_sv: "ø63 mm" },
  { code: "80", bore_mm: 80, standard_strokes: [...bas, 600, 700, 800], max_stroke_mm: 2000, cushion_c: true, port: "G3/8", max_speed_mm_s: 1000, label_sv: "ø80 mm" },
  { code: "100", bore_mm: 100, standard_strokes: [...bas, 600, 700, 800], max_stroke_mm: 2000, cushion_c: true, port: "G1/2", max_speed_mm_s: 1000, label_sv: "ø100 mm" },
  { code: "125", bore_mm: 125, standard_strokes: [], max_stroke_mm: 2000, cushion_c: false, port: "G1/2", max_speed_mm_s: 700, label_sv: "ø125 mm" },
];

export const CP96_MOUNTINGS: CP96Value[] = [
  { code: "B", label_sv: "Basutförande" },
  { code: "L", label_sv: "Axiellt fotfäste" },
  { code: "F", label_sv: "Fläns vid kolvstången" },
  { code: "G", label_sv: "Fläns vid gaveln" },
  { code: "C", label_sv: "Enkelt gaffelfäste" },
  { code: "D", label_sv: "Dubbelt gaffelfäste (med gaffelsprint)" },
  { code: "V", label_sv: "Ställbart tappfäste" },
];
export const CP96_MAGNET: CP96Value = { code: "D", label_sv: "Inbyggd magnet för givare (CP96SD)" };
export const CP96_CUSHION: CP96Value = { code: "C", label_sv: "Luftdämpning i båda ändar plus gummidämpning (ø32–100)" };
export interface CP96Boot extends CP96Value {
  both_ends: boolean;
}
export const CP96_BOOTS: CP96Boot[] = [
  { code: "J", both_ends: false, label_sv: "Bälg i nylonduk, en ände" },
  { code: "JJ", both_ends: true, label_sv: "Bälg i nylonduk, båda ändar (dubbel kolvstång)" },
  { code: "K", both_ends: false, label_sv: "Värmebeständig bälg, en ände" },
  { code: "KK", both_ends: true, label_sv: "Värmebeständig bälg, båda ändar (dubbel kolvstång)" },
];
export const CP96_ROD: CP96Value = { code: "W", label_sv: "Dubbel kolvstång (genomgående; slag ≤ 1000)" };
export const CP96_DOUBLE_ROD_MAX_STROKE_MM = 1000;

/** Kabellängd [0,5 m, M, L, Z]: S standard, O på beställning (sida 4). */
export interface CP96Switch extends CP96Value {
  kind: "reed" | "solid";
  leads: string;
  /** Minsta slag för en eller två givare på olika sidor, per borrning (sida 22). */
  min_stroke: (bore: string) => number;
}
const tio = () => 10;
const s = (code: string, label: string, leads: string, min: (b: string) => number = tio, kind: "reed" | "solid" = "solid"): CP96Switch =>
  ({ code, kind, leads, min_stroke: min, label_sv: label });
export const CP96_SWITCHES: CP96Switch[] = [
  s("M9N", "D-M9N, 3-tråd NPN", "SSSO"), s("M9P", "D-M9P, 3-tråd PNP", "SSSO"), s("M9B", "D-M9B, 2-tråd", "SSSO"),
  s("M9NW", "D-M9NW, NPN, tvåfärgsindikering", "SSSO"), s("M9PW", "D-M9PW, PNP, tvåfärgsindikering", "SSSO"), s("M9BW", "D-M9BW, 2-tråd, tvåfärgsindikering", "SSSO"),
  s("M9NA", "D-M9NA, NPN, vattentät", "OOSO", (b) => (b === "32" ? 15 : 10)), s("M9PA", "D-M9PA, PNP, vattentät", "OOSO", (b) => (b === "32" ? 15 : 10)), s("M9BA", "D-M9BA, 2-tråd, vattentät", "OOSO", (b) => (b === "32" ? 15 : 10)),
  s("A96", "D-A96, reed 3-tråd", "SSSS", tio, "reed"), s("A93", "D-A93, reed 2-tråd", "SSSS", tio, "reed"), s("A90", "D-A90, reed utan indikering", "SSSS", tio, "reed"),
];
export const CP96_LEADS: CP96Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
export const CP96_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3 };
export const CP96_COUNTS: CP96Value[] = [
  { code: "S", label_sv: "En givare (standard är två)" },
  { code: "3", label_sv: "Tre givare" },
];
/** Minsta slag för tre givare: 10 + 40 (n − 2) = 50, M9A ø32 55 (sida 22). */
export function cp96MinStroke(sw: CP96Switch, bore: string, count: string): number {
  const en = sw.min_stroke(bore);
  return count === "3" ? en + 40 : en;
}

export interface CP96Mto extends CP96Value {
  /** Bara ø32–100 (sida 148–155, "Applicable series"). */
  bores?: string[];
  /** Inte magnetcylinder eller givare (sida 148). */
  no_magnet?: boolean;
  /** Största slag enkel kolvstång per borrning (sida 154). */
  max_single?: Record<string, number>;
}
const smaBorrningar = ["32", "40", "50", "63", "80", "100"];
const rostfriMax = { "32": 1800, "40": 1700, "50": 1700, "63": 1700, "80": 1700, "100": 1700, "125": 1600 };
/** Specialutföranden (sida 5 och 148–155). -XC10/-XC11 (dubbelslag) ingår inte. */
export const CP96_MTO: CP96Mto[] = [
  { code: "XA", label_sv: "-XA□ Ändrad kolvstångsände (XA0–30, mått anges vid beställning)" },
  { code: "XB6", no_magnet: true, label_sv: "-XB6 Värmebeständig –10…150 °C (utan magnet och givare; 50–500 mm/s)" },
  { code: "XC4", bores: smaBorrningar, label_sv: "-XC4 Kraftig avstrykare (ø32–100)" },
  { code: "XC7", label_sv: "-XC7 Dragstänger, muttrar m.m. i rostfritt" },
  { code: "XC22", label_sv: "-XC22 Fluorgummitätningar" },
  { code: "XC35", bores: smaBorrningar, label_sv: "-XC35 Spiralavstrykare (ø32–100)" },
  { code: "XC65", max_single: rostfriMax, label_sv: "-XC65 Rostfritt (XC7 + XC68; slag ≤ 1800/1700/1600)" },
  { code: "XC68", max_single: rostfriMax, label_sv: "-XC68 Rostfri hårdkromad kolvstång och stångmutter (slag ≤ 1800/1700/1600)" },
  { code: "XC85", bores: smaBorrningar, label_sv: "-XC85 Fett för livsmedelsindustrin, NSF-H1 (ø32–100)" },
  { code: "XC88", bores: smaBorrningar, label_sv: "-XC88 Svetssprutskydd: spiralavstrykare, smörjhållare, svetsfett, rostfri stång (ø32–100)" },
  { code: "XC89", bores: smaBorrningar, label_sv: "-XC89 Svetssprutskydd: spiralavstrykare, smörjhållare, svetsfett, stång S45C (ø32–100)" },
];

export const CP96_LIMITS = {
  max_pressure_mpa: 1.0,
  min_pressure_mpa: 0.05,
  proof_pressure_mpa: 1.5,
  temp_c: { without_switch: [-20, 70], with_switch: [-10, 60] },
  min_speed_mm_s: 50,
  min_stroke_mm: 1,
} as const;

export interface CP96Config {
  bore: string;
  mounting: string;
  stroke_mm: number;
  magnet?: boolean;
  cushion?: boolean;
  boot?: string;
  rod?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string | undefined) =>
  kod !== undefined && lista.some((v) => v.code === kod);

export function cp96BuildCode(c: CP96Config): string | null {
  const bore = CP96_BORES.find((b) => b.code === c.bore);
  if (!bore || !har(CP96_MOUNTINGS, c.mounting)) return null;
  const mto = c.mto ?? "";
  const m = mto ? CP96_MTO.find((x) => x.code === mto) : undefined;
  if (mto && !m) return null;
  const st = c.stroke_mm;
  if (!Number.isInteger(st) || st < CP96_LIMITS.min_stroke_mm || st > bore.max_stroke_mm) return null;
  const rod = c.rod ?? "";
  if (rod && rod !== CP96_ROD.code) return null;
  if (rod && st > CP96_DOUBLE_ROD_MAX_STROKE_MM) return null;
  const cushion = c.cushion === true;
  if (cushion !== bore.cushion_c) return null;
  const boot = c.boot ?? "";
  if (boot) {
    const b = CP96_BOOTS.find((x) => x.code === boot);
    if (!b || (b.both_ends && !rod)) return null;
  }
  const magnet = c.magnet === true;
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = CP96_SWITCHES.find((x) => x.code === sw);
    if (!g || !magnet) return null;
    if (lead && !har(CP96_LEADS, lead)) return null;
    if (count && !har(CP96_COUNTS, count)) return null;
  } else if (lead || count) return null;
  if (m) {
    if (m.bores && !m.bores.includes(bore.code)) return null;
    if (m.no_magnet && magnet) return null;
    if (m.max_single && !rod && st > m.max_single[bore.code]) return null;
  }
  const g1 = `CP96S${magnet ? "D" : ""}${c.mounting}${bore.code}`;
  const g2 = `${st}${cushion ? "C" : ""}${boot}${rod}`;
  const g3 = `${sw}${lead}${count}`;
  return [g1, g2, g3, mto].filter((g, i) => i < 2 || g).join("-");
}

export function cp96ParseCode(raw: string): { config: CP96Config } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...CP96_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^CP96S(D?)([BLFGCDV])(32|40|50|63|80|100|125)-(\\d{1,4})(C?)(JJ|KK|J|K)?(W?)(?:-(${givare})([MLZ])?(S|3)?)?(?:-(X[A-Z0-9]+))?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, magnet, mounting, bore, stroke, cushion, boot, rod, sw, lead, count, mto] = m;
  const c: CP96Config = {
    bore, mounting, stroke_mm: Number(stroke), magnet: magnet === "D", cushion: cushion === "C", boot: boot || undefined,
    rod: rod || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined,
  };
  if (cp96BuildCode(c) !== k) return null;
  return { config: c };
}

export const CP96_ORDER_CODE_TEMPLATE = "CP96S{magnet}{mounting}{bore}-{stroke_mm}{cushion}{boot}{rod}-{switch}{lead}{count}-{mto}";

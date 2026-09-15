/**
 * SMC ZH — vakuumejektor, kroppsmonterad (ZH□D□A) eller boxtyp med inbyggd
 * ljuddämpare (ZH□B□A), munstycke ø0,5–2,0.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Vacuum Ejector ZH Series, Body Ported Type/Box Type (Built-in
 *   Silencer)" (katalogkapitel, 24 sidor, katalogsidor 745–768). Ligger i
 *   knowledge_chunks som source_file = 'smc-kat-zh-a.pdf'. (Filen
 *   smc-kat-zh.pdf är fyrsidingen för helrostfria ZH-X267, en egen nyckel.)
 *   PDF-sidor (katalogsidor inom parentes; meddelandena citerar katalogsidan):
 *     - How to Order kroppsmonterad, tabell 1, tillbehör   sida 5  (749)
 *     - How to Order boxtyp, tabell 2                     sida 6  (750)
 *     - specifikationer, ejektordata                      sida 8  (752)
 *     - minsta C-värde för matningsventilen               sida 23 (767)
 *
 * KODENS FORM (sida 5 och 6):
 *
 *   ZH 10 D S A - 06 - 06 - 08 □        kroppsmonterad: SUP, VAC, EXH, tillbehör
 *   ZH 10 B S A - 06 - 06               boxtyp: SUP, VAC
 *   ZH{munstycke}{kropp}{vakuum}A-{sup}-{vac}-{exh}{tillbehör}
 *
 * Portkombinationerna är fasta (tabell 1 och 2): SUP-porten bestämmer vilka
 * VAC-portar som finns, och för den kroppsmonterade bestäms EXH helt av SUP
 * och VAC. Boxtypen har ingen EXH-position och inget tillbehör.
 * Tillbehöret (standardfäste/ljuddämpare) finns bara med EXH som
 * snabbkoppling, och ljuddämpare finns inte för tumstorleken 13.
 * Katalogens exempel ZH10DSA-06-06-08 (sida 5), ZH10BSA-06-06 (sida 6) och
 * ZH10DSA-06-06-08N (sida 7) byggs tecken för tecken.
 *
 * Produkten SMC-ZH05DS-06-06-06 bär den äldre koden utan A; katalogen kallar
 * ZH05D-06-06-06 "existing model" (sida 1) och den nya ZH05DA-06-06-06.
 */

export const ZH_SOURCE = {
  file: "smc-kat-zh-a.pdf",
  edition: "SMC ZH catalogue chapter (catalogue pages 745–768)",
  title: "SMC Vacuum Ejector ZH Series, Body Ported Type/Box Type",
  brand: "SMC",
} as const;

export interface ZHValue {
  code: string;
  label_sv: string;
}

export interface ZHNozzle extends ZHValue {
  nozzle_mm: number;
  /** Sugflöde S/L och luftförbrukning vid 0,45 MPa (sida 8). */
  flow_s: number;
  flow_l: number;
  air: number;
  /** Minsta C-värde [dm³/(s·bar)] för matningsventilen (sida 23). */
  valve_c: number;
  /** Uppnått vakuum [kPa] per kropp och typ (sida 8). */
  vacuum: { D: { S: number; L: number }; B: { S: number; L: number } };
}

export const ZH_NOZZLES: ZHNozzle[] = [
  { code: "05", nozzle_mm: 0.5, flow_s: 6, flow_l: 13, air: 13, valve_c: 0.12, vacuum: { D: { S: -90, L: -48 }, B: { S: -89, L: -48 } }, label_sv: "Munstycke ø0,5 mm" },
  { code: "07", nozzle_mm: 0.7, flow_s: 12, flow_l: 28, air: 27, valve_c: 0.23, vacuum: { D: { S: -90, L: -48 }, B: { S: -89, L: -48 } }, label_sv: "Munstycke ø0,7 mm" },
  { code: "10", nozzle_mm: 1.0, flow_s: 26, flow_l: 52, air: 52, valve_c: 0.47, vacuum: { D: { S: -90, L: -48 }, B: { S: -89, L: -48 } }, label_sv: "Munstycke ø1,0 mm" },
  { code: "13", nozzle_mm: 1.3, flow_s: 40, flow_l: 78, air: 88, valve_c: 0.80, vacuum: { D: { S: -90, L: -48 }, B: { S: -89, L: -48 } }, label_sv: "Munstycke ø1,3 mm" },
  { code: "15", nozzle_mm: 1.5, flow_s: 58, flow_l: 78, air: 117, valve_c: 1.06, vacuum: { D: { S: -90, L: -66 }, B: { S: -90, L: -66 } }, label_sv: "Munstycke ø1,5 mm" },
  { code: "18", nozzle_mm: 1.8, flow_s: 76, flow_l: 128, air: 165, valve_c: 1.53, vacuum: { D: { S: -90, L: -66 }, B: { S: -90, L: -66 } }, label_sv: "Munstycke ø1,8 mm" },
  { code: "20", nozzle_mm: 2.0, flow_s: 90, flow_l: 155, air: 201, valve_c: 1.88, vacuum: { D: { S: -90, L: -66 }, B: { S: -90, L: -62 } }, label_sv: "Munstycke ø2,0 mm" },
];

export const ZH_BODIES: ZHValue[] = [
  { code: "D", label_sv: "Kroppsmonterad (SUP, VAC och EXH-port)" },
  { code: "B", label_sv: "Boxtyp med inbyggd ljuddämpare (SUP och VAC)" },
];
export const ZH_VACUUMS: ZHValue[] = [
  { code: "S", label_sv: "Typ S — högt vakuum (−90 kPa), lägre sugflöde" },
  { code: "L", label_sv: "Typ L — lägre vakuum (−48…−66 kPa), högre sugflöde" },
];

/** Portkoder (sida 5): snabbkoppling metrisk/tum, invändig gänga Rc/G/NPT. */
export interface ZHPort extends ZHValue {
  kind: "one-touch" | "thread";
}
export const ZH_PORT_CODES: ZHPort[] = [
  { code: "06", kind: "one-touch", label_sv: "Snabbkoppling ø6" },
  { code: "08", kind: "one-touch", label_sv: "Snabbkoppling ø8" },
  { code: "10", kind: "one-touch", label_sv: "Snabbkoppling ø10" },
  { code: "12", kind: "one-touch", label_sv: "Snabbkoppling ø12" },
  { code: "07", kind: "one-touch", label_sv: "Snabbkoppling ø1/4 tum" },
  { code: "09", kind: "one-touch", label_sv: "Snabbkoppling ø5/16 tum" },
  { code: "11", kind: "one-touch", label_sv: "Snabbkoppling ø3/8 tum" },
  { code: "13", kind: "one-touch", label_sv: "Snabbkoppling ø1/2 tum" },
  { code: "01", kind: "thread", label_sv: "Gänga Rc1/8" },
  { code: "02", kind: "thread", label_sv: "Gänga Rc1/4" },
  { code: "03", kind: "thread", label_sv: "Gänga Rc3/8" },
  { code: "04", kind: "thread", label_sv: "Gänga Rc1/2" },
  { code: "F01", kind: "thread", label_sv: "Gänga G1/8" },
  { code: "F02", kind: "thread", label_sv: "Gänga G1/4" },
  { code: "F03", kind: "thread", label_sv: "Gänga G3/8" },
  { code: "F04", kind: "thread", label_sv: "Gänga G1/2" },
  { code: "N01", kind: "thread", label_sv: "Gänga NPT1/8" },
  { code: "N02", kind: "thread", label_sv: "Gänga NPT1/4" },
  { code: "N03", kind: "thread", label_sv: "Gänga NPT3/8" },
  { code: "N04", kind: "thread", label_sv: "Gänga NPT1/2" },
];

/**
 * Tabell 1 och 2 (sida 5–6): per munstycke, per SUP-port de VAC-portar som
 * finns, och EXH-porten som den kroppsmonterade får. SUP/VAC-paren är
 * identiska för kropps- och boxtyp.
 */
export interface ZHPortCombo {
  sup: string;
  vacs: string[];
  exh: string;
}
const rad = (sup: string, vacs: string[], exh: string): ZHPortCombo => ({ sup, vacs, exh });
export const ZH_PORTS: Record<string, ZHPortCombo[]> = {
  "05": [rad("06", ["06", "01", "F01"], "06"), rad("01", ["01"], "01"), rad("F01", ["F01"], "F01"), rad("07", ["07", "N01"], "07"), rad("N01", ["N01"], "N01")],
  "07": [rad("06", ["06", "01", "F01"], "06"), rad("01", ["01"], "01"), rad("F01", ["F01"], "F01"), rad("07", ["07", "N01"], "07"), rad("N01", ["N01"], "N01")],
  "10": [rad("06", ["06", "01", "F01"], "08"), rad("01", ["01"], "01"), rad("F01", ["F01"], "F01"), rad("07", ["07", "N01"], "09"), rad("N01", ["N01"], "N01")],
  "13": [rad("08", ["10", "02", "F02"], "10"), rad("01", ["02"], "02"), rad("F01", ["F02"], "F02"), rad("09", ["11", "N02"], "11"), rad("N01", ["N02"], "N02")],
  "15": [rad("08", ["10", "03", "F03"], "10"), rad("02", ["03"], "03"), rad("F02", ["F03"], "F03"), rad("09", ["11", "N03"], "11"), rad("N02", ["N03"], "N03")],
  "18": [rad("10", ["12", "03", "F03"], "12"), rad("03", ["03"], "03"), rad("F03", ["F03"], "F03"), rad("11", ["13", "N03"], "13"), rad("N03", ["N03"], "N03")],
  "20": [rad("10", ["12", "04", "F04"], "12"), rad("03", ["04"], "04"), rad("F03", ["F04"], "F04"), rad("11", ["13", "N04"], "13"), rad("N03", ["N04"], "N04")],
};

/** Tillbehör (sida 5, punkt 4): Nil = standardfäste, N = inget, S = fäste + ljuddämpare, NS = bara ljuddämpare. */
export interface ZHAccessory extends ZHValue {
  bracket: boolean;
  silencer: boolean;
}
export const ZH_ACCESSORIES: ZHAccessory[] = [
  { code: "N", bracket: false, silencer: false, label_sv: "Utan standardfäste" },
  { code: "S", bracket: true, silencer: true, label_sv: "Standardfäste och ljuddämpare (EXH som snabbkoppling)" },
  { code: "NS", bracket: false, silencer: true, label_sv: "Bara ljuddämpare, utan fäste (EXH som snabbkoppling)" },
];
/** Ljuddämparens artikelnummer per EXH-port (sida 5); tum 13 saknar. */
export const ZH_SILENCERS: Record<string, string> = {
  "06": "AN10-C06", "07": "AN10-C07", "08": "AN15-C08", "09": "AN15-C08", "10": "AN20-C10", "11": "AN20-C11", "12": "AN30-C12",
};
/** Standardfästet per munstycke (sida 5). */
export function zhBracket(nozzle: string): string {
  return ["05", "07", "10"].includes(nozzle) ? "ZH2-BK1A-1-A" : ["13", "15"].includes(nozzle) ? "ZH2-BK1A-2-A" : "ZH2-BK1A-3-A";
}

export const ZH_LIMITS = {
  pressure_mpa: [0.1, 0.6],
  standard_pressure_mpa: 0.45,
  temp_c: [-5, 50],
} as const;

export interface ZHConfig {
  nozzle: string;
  body: string;
  vacuum: string;
  sup: string;
  vac: string;
  exh?: string;
  accessory?: string;
}

export function zhPortKind(code: string): "one-touch" | "thread" | null {
  return ZH_PORT_CODES.find((p) => p.code === code)?.kind ?? null;
}

export function zhBuildCode(c: ZHConfig): string | null {
  const nozzle = ZH_NOZZLES.find((n) => n.code === c.nozzle);
  if (!nozzle || !ZH_BODIES.some((b) => b.code === c.body) || !ZH_VACUUMS.some((v) => v.code === c.vacuum)) return null;
  const combo = ZH_PORTS[nozzle.code].find((r) => r.sup === c.sup);
  if (!combo || !combo.vacs.includes(c.vac)) return null;
  const exh = c.exh ?? "";
  const acc = c.accessory ?? "";
  if (c.body === "B") {
    if (exh || acc) return null;
    return `ZH${nozzle.code}B${c.vacuum}A-${c.sup}-${c.vac}`;
  }
  if (exh !== combo.exh) return null;
  if (acc) {
    const a = ZH_ACCESSORIES.find((x) => x.code === acc);
    if (!a) return null;
    if (a.silencer && (zhPortKind(exh) !== "one-touch" || !ZH_SILENCERS[exh])) return null;
  }
  return `ZH${nozzle.code}D${c.vacuum}A-${c.sup}-${c.vac}-${exh}${acc}`;
}

export function zhParseCode(raw: string): { config: ZHConfig } | null {
  const k = raw.trim().toUpperCase();
  const port = "N?0[1-9]|1[0-3]|F0[1-4]";
  const m = new RegExp(`^ZH(05|07|10|13|15|18|20)([DB])([SL])A-(${port})-(${port})(?:-(${port})(N|S|NS)?)?$`).exec(k);
  if (!m) return null;
  const [, nozzle, body, vacuum, sup, vac, exh, acc] = m;
  const c: ZHConfig = { nozzle, body, vacuum, sup, vac, exh: exh || undefined, accessory: acc || undefined };
  if (zhBuildCode(c) !== k) return null;
  return { config: c };
}

export const ZH_ORDER_CODE_TEMPLATE = "ZH{nozzle}{body}{vacuum}A-{sup}-{vac}-{exh}{accessory}";

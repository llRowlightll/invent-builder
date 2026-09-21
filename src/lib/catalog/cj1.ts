/**
 * SMC CJ1 — stiftcylinder ("pin cylinder"): dubbelverkande ø4 och
 * enkelverkande med fjäderretur ø2,5 och ø4, bastyp, slag 5–20 mm.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Air Cylinder Series CJ1" (katalogutdrag, 5 sidor, katalogsidor
 *   15–19, hämtat 2026-09-21 från content2.smcetech.com/pdf/cj1.pdf). Ligger i
 *   knowledge_chunks som source_file = 'smc-kat-cj1.pdf'.
 *     - serieöversikt (utföranden, borrningar, standardslag)   sida 15
 *     - dubbelverkande: How to Order, data, kraft, vikt        sida 16
 *     - dubbelverkande: delar och mått                         sida 17
 *     - enkelverkande: How to Order, data, fjäderkraft, vikt   sida 18
 *     - enkelverkande: delar och mått                          sida 19
 *
 * VAD FAMILJEN ÄR. Familjen cj1 hade mallen 'CJ1-{bore_mm}-{stroke_mm}-
 * {cushioning}{sensing}' med ø4/ø6, dämpning och givare — inget av det finns:
 * CJ1 tillverkas i ø2,5 och ø4, utan dämpning och utan givare (sida 15–18).
 * ø6 är CJ2/CJP. Produktraden SMC-CJ1B6 ("ø6, slag 30") saknar motsvarighet.
 *
 * KODENS FORM (sida 16 och 18):
 *
 *   CJ1B 4 - 5   U4        nyckelns exempel: dubbelverkande ø4, slag 5 mm
 *   CJ1B 4 - 10 S U4       nyckelns exempel: enkelverkande fjäderretur ø4, slag 10 mm
 *   CJ1B 2 - 10 S U4       enkelverkande ø2,5, slag 10 mm
 *   CJ1B{borrning}-{slag}{funktion}U4
 *
 * B (bastyp) och U4 (slang ø4/ø2,5 polyuretan TU0425 eller mjuk nylon TS0425)
 * är nyckelns enda värden och ligger fast i mallen.
 */

export const CJ1_SOURCE = {
  file: "smc-kat-cj1.pdf",
  edition: "SMC Air Cylinder Series CJ1 catalogue extract (catalogue pages 15–19)",
  title: "SMC Air Cylinder Series CJ1 (Pin Cylinder)",
  brand: "SMC",
} as const;

export interface CJ1Value {
  code: string;
  label_sv: string;
}

export interface CJ1Bore extends CJ1Value {
  bore_mm: number;
  rod_mm: number;
  /** Kolvarea ut/in [mm²] (sida 16 och 18). */
  area_out_mm2: number;
  area_in_mm2: number;
}
/** Borrningens siffra i koden: 2 = ø2,5 mm, 4 = ø4 mm (sida 18). */
export const CJ1_BORES: CJ1Bore[] = [
  { code: "2", bore_mm: 2.5, rod_mm: 1, area_out_mm2: 4.9, area_in_mm2: 4.9, label_sv: "ø2,5 mm (bara enkelverkande)" },
  { code: "4", bore_mm: 4, rod_mm: 2, area_out_mm2: 12.6, area_in_mm2: 9.4, label_sv: "ø4 mm" },
];

export interface CJ1Action extends CJ1Value {
  /** Arbetstryck [MPa] (sida 16 och 18). */
  pressure_mpa: [number, number];
  page: number;
  dims_page: number;
}
export const CJ1_ACTIONS: CJ1Action[] = [
  { code: "", pressure_mpa: [0.2, 0.7], page: 16, dims_page: 17, label_sv: "Dubbelverkande (bara ø4)" },
  { code: "S", pressure_mpa: [0.3, 0.7], page: 18, dims_page: 19, label_sv: "Enkelverkande, fjäderretur (ø2,5 och ø4)" },
];
/** Funktionen i databasen: valfri position, tomt = dubbelverkande (nyckelns Nil). */
export const CJ1_ACTION_S: CJ1Action = CJ1_ACTIONS[1];

/** Etiketterna börjar inte med koden: "5 mm" med koden 5 klipps av stripLeadingCode. */
export const CJ1_STROKES: CJ1Value[] = [5, 10, 15, 20].map((s) => ({ code: String(s), label_sv: `Slag ${s} mm${s > 10 ? " (bara ø4)" : ""}` }));

export interface CJ1Model {
  bore: string;
  action: string;
  strokes: number[];
  /** Vikt per standardslag [g], samma ordning som strokes (sida 16 och 18). */
  weight_g: number[];
  /** Mått S (indragen) och Z (utskjuten) per standardslag [mm] (sida 17 och 19). */
  dim_s_mm: number[];
  dim_z_mm: number[];
  /** Teoretisk kraft ut vid 0,5 MPa och in vid 0,5 MPa respektive fjäderns kraft [N]. */
  force_out_05_n: number;
  force_in_05_n: number;
  /** Fjäderkraft indragen/utskjuten [N], bara enkelverkande (sida 18). */
  spring_ret_n: number | null;
  spring_ext_n: number | null;
}
/** Data sida 16 (dubbelverkande) och 18 (enkelverkande); mått sida 17 och 19. */
export const CJ1_MODELS: CJ1Model[] = [
  { bore: "4", action: "", strokes: [5, 10, 15, 20], weight_g: [12.0, 12.4, 12.8, 13.2], dim_s_mm: [18, 23, 28, 33], dim_z_mm: [51, 56, 61, 66], force_out_05_n: 6.30, force_in_05_n: 4.70, spring_ret_n: null, spring_ext_n: null },
  { bore: "2", action: "S", strokes: [5, 10], weight_g: [1.5, 2], dim_s_mm: [16.5, 25.5], dim_z_mm: [29, 38], force_out_05_n: 1.32, force_in_05_n: 0.64, spring_ret_n: 1.13, spring_ext_n: 0.64 },
  { bore: "4", action: "S", strokes: [5, 10, 15, 20], weight_g: [3.7, 4.6, 5.6, 6.5], dim_s_mm: [19.5, 28.5, 37.5, 46.5], dim_z_mm: [40, 49, 58, 67], force_out_05_n: 3.26, force_in_05_n: 1.47, spring_ret_n: 3.04, spring_ext_n: 1.47 },
];

/** Gemensamt för alla utföranden (sida 16 och 18). */
export const CJ1_LIMITS = {
  proof_pressure_mpa: 1.05,
  temp_c: [-10, 70],
  speed_mm_s: [50, 500],
  stroke_tolerance: "+0,5/0 mm",
  tubing: "ø4/ø2,5 polyuretan TU0425 eller mjuk nylon TS0425",
} as const;

export interface CJ1Config {
  bore: string;
  stroke: string;
  action?: string;
}

export function cj1Model(bore: string, action: string): CJ1Model | undefined {
  return CJ1_MODELS.find((x) => x.bore === bore && x.action === action);
}

export function cj1BuildCode(c: CJ1Config): string | null {
  const action = c.action ?? "";
  if (!CJ1_ACTIONS.some((a) => a.code === action)) return null;
  const mod = cj1Model(c.bore, action);
  if (!mod) return null;
  if (!/^\d+$/.test(c.stroke) || !mod.strokes.includes(Number(c.stroke))) return null;
  return `CJ1B${c.bore}-${Number(c.stroke)}${action}U4`;
}

export function cj1ParseCode(raw: string): { config: CJ1Config } | null {
  const k = raw.trim().toUpperCase();
  const mm = /^CJ1B([24])-(\d{1,2})(S?)U4$/.exec(k);
  if (!mm) return null;
  const c: CJ1Config = { bore: mm[1], stroke: String(Number(mm[2])), action: mm[3] || undefined };
  if (cj1BuildCode(c) !== k) return null;
  return { config: c };
}

export const CJ1_ORDER_CODE_TEMPLATE = "CJ1B{bore}-{stroke}{action}U4";

/**
 * SMC RB — hydrauliska stötdämpare: RB (standard, M6–M27), RBL (kylvätske-
 * tålig, M10–M27) och RBQ (kort typ, M16–M32), med eller utan kåpa/buffert
 * och med muttertillval.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Shock Absorber RB Series / RBQ Series" (kapitlet ur webbkatalogen,
 *   23 sidor, katalogsidor 1295–1317). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-rb.pdf'.
 *     - serieöversikten (kåpa/buffert, muttrar, fotfäste)   sida 1295
 *     - RB: data och How to Order                            sida 1299
 *     - RB: muttrar, stoppmuttrar, kåpor, fotfästen          sida 1301–1302
 *     - RBL: data och How to Order                           sida 1306
 *     - RBL: muttrar, stoppmuttrar, fotfästen                sida 1307
 *     - RBQ: data och How to Order                           sida 1310
 *     - RBQ: muttrar, stoppmuttrar, buffertar                sida 1311
 *
 * VAD FAMILJEN ÄR. Produkterna hette "RBQ0806W" osv. i databasen — RBQ har
 * storlekarna 1604–3213 och W finns inte i nyckeln; de fyra raderna är
 * RB-storlekar (0806, 1006, 1412, 20xx) och döps om till RB0806, RB1006,
 * RB1412 och RB2015.
 *
 * KODENS FORM (sida 1299, 1306, 1310):
 *
 *   RB   C 14 12          nyckelns exempel: RB, med kåpa, M14 x 1,5, slag 12 mm
 *   RB L C 14 12          kylvätsketålig med kåpa (sida 1306)
 *   RB Q C 20 07          kort typ med gummibuffert (sida 1310)
 *   RB     06 04          minsta: utan kåpa och utan tillval (sida 1295, 1299)
 *   RB   C 14 12 SJ       tre sexkantmuttrar och en stoppmutter
 *   {serie}{typ}{storlek}{tillval}
 */

export const RB_SOURCE = {
  file: "smc-kat-rb.pdf",
  edition: "SMC RB/RBQ series catalogue chapter (catalogue pages 1295–1317, web catalogue 2026)",
  title: "SMC Shock Absorber RB/RBL/RBQ Series",
  brand: "SMC",
} as const;

export interface RBValue {
  code: string;
  label_sv: string;
}

export interface RBSeries extends RBValue {
  /** Kollisionshastighet [m/s] (sida 1299, 1306, 1310); RB0604 har eget område. */
  speed_m_s: [number, number];
  /** Vad C betyder i serien. */
  c_sv: string;
  c_en: string;
  /** Data/How to Order respektive muttrar, stoppmuttrar, kåpor och fotfästen. */
  page: number;
  parts_page: number;
}
export const RB_SERIES: RBSeries[] = [
  { code: "RB", speed_m_s: [0.05, 5], c_sv: "kåpa", c_en: "cap", page: 1299, parts_page: 1302, label_sv: "RB standard, M6–M27" },
  { code: "RBL", speed_m_s: [0.05, 5], c_sv: "kåpa", c_en: "cap", page: 1306, parts_page: 1307, label_sv: "RBL kylvätsketålig (icke vattenlöslig skärolja), M10–M27" },
  { code: "RBQ", speed_m_s: [0.05, 3], c_sv: "gummibuffert", c_en: "bumper", page: 1310, parts_page: 1311, label_sv: "RBQ kort typ, M16–M32, tillåten excentricitet 5°" },
];

export const RB_TYPE_C: RBValue = { code: "C", label_sv: "Med kåpa (RB/RBL) respektive gummibuffert (RBQ) — kan inte eftermonteras" };

export interface RBOption extends RBValue {
  hex_nuts: number;
  stopper_nut: boolean;
}
/** Tillval (sida 1299, 1306, 1310): sexkantmuttrar och stoppmutter. */
export const RB_OPTIONS: RBOption[] = [
  { code: "J", hex_nuts: 3, stopper_nut: false, label_sv: "Tre sexkantmuttrar (standard är två)" },
  { code: "N", hex_nuts: 0, stopper_nut: false, label_sv: "Utan sexkantmuttrar" },
  { code: "S", hex_nuts: 2, stopper_nut: true, label_sv: "Två sexkantmuttrar och en stoppmutter" },
  { code: "SJ", hex_nuts: 3, stopper_nut: true, label_sv: "Tre sexkantmuttrar och en stoppmutter" },
  { code: "SN", hex_nuts: 0, stopper_nut: true, label_sv: "Bara en stoppmutter" },
];

export interface RBModel {
  series: string;
  size: string;
  /** Yttergängan. */
  thread: string;
  stroke_mm: number;
  /** Största energiupptagning per slag [J] vid 20–25 °C. */
  energy_j: number;
  /** Största arbetsfrekvens [slag/min]. */
  freq_per_min: number;
  /** Största tillåtna axialkraft [N]. */
  thrust_n: number;
  /** Returfjäderns kraft utskjuten/intryckt [N]. */
  spring_ext_n: number;
  spring_ret_n: number;
  /** Vikt bastyp respektive med kåpa/buffert [g]. */
  weight_g: number;
  weight_c_g: number | null;
  /** Kåpa/buffert finns (RB0604: nej, sida 1299). */
  c_ok: boolean;
  /** Tillvalen finns (M6: nej, sida 1295; ingen stoppmutter RB06S, sida 1302). */
  options_ok: boolean;
  /** Reservdelskåpa/-buffert, stoppmutter (bastyp), fotfäste (sida 1302, 1307, 1311). */
  cap_part: string | null;
  stopper_part: string | null;
  foot_part: string | null;
}
const m = (series: string, size: string, thread: string, stroke: number, energy: number, freq: number, thrust: number, ext: number, ret: number, w: number, wc: number | null, parts: [string | null, string | null, string | null]): RBModel => ({
  series, size, thread, stroke_mm: stroke, energy_j: energy, freq_per_min: freq, thrust_n: thrust, spring_ext_n: ext, spring_ret_n: ret, weight_g: w, weight_c_g: wc,
  c_ok: wc !== null, options_ok: size !== "0604", cap_part: parts[0], stopper_part: parts[1], foot_part: parts[2],
});
/** Data sida 1299 (RB), 1306 (RBL), 1310 (RBQ); delar sida 1302, 1307, 1311. */
export const RB_MODELS: RBModel[] = [
  m("RB", "0604", "M6 x 0,75", 4, 0.5, 80, 150, 3.05, 5.59, 5.5, null, [null, null, null]),
  m("RB", "0805", "M8 x 1,0", 5, 0.98, 80, 245, 1.96, 3.83, 15, 16, ["RBC08C", "RB08S", "RB08-X331"]),
  m("RB", "0806", "M8 x 1,0", 6, 2.94, 80, 245, 1.96, 4.22, 15, 16, ["RBC08C", "RB08S", "RB08-X331"]),
  m("RB", "1006", "M10 x 1,0", 6, 3.92, 70, 422, 4.22, 6.18, 23, 25, ["RBC10C", "RB10S", "RB10-X331"]),
  m("RB", "1007", "M10 x 1,0", 7, 5.88, 70, 422, 4.22, 6.86, 23, 25, ["RBC10C", "RB10S", "RB10-X331"]),
  m("RB", "1411", "M14 x 1,5", 11, 14.7, 45, 814, 6.86, 15.3, 65, 70, ["RBC14C", "RB14S", "RB14-X331"]),
  m("RB", "1412", "M14 x 1,5", 12, 19.6, 45, 814, 6.86, 15.98, 65, 70, ["RBC14C", "RB14S", "RB14-X331"]),
  m("RB", "2015", "M20 x 1,5", 15, 58.8, 25, 1961, 8.34, 20.5, 150, 165, ["RBC20C", "RB20S", "RB20-X331"]),
  m("RB", "2725", "M27 x 1,5", 25, 147, 10, 2942, 8.83, 20.01, 350, 400, ["RBC27C", "RB27S", "RB27-X331"]),
  m("RBL", "1006", "M10 x 1,0", 6, 3.92, 70, 422, 4.22, 6.18, 26, 28, ["RBC10C", "RB10S", "RB10-X331"]),
  m("RBL", "1007", "M10 x 1,0", 7, 5.88, 70, 422, 4.22, 6.86, 26, 28, ["RBC10C", "RB10S", "RB10-X331"]),
  m("RBL", "1411", "M14 x 1,5", 11, 14.7, 45, 814, 8.73, 14.12, 70, 75, ["RBC14C", "RB14S", "RB14-X331"]),
  m("RBL", "1412", "M14 x 1,5", 12, 19.6, 45, 814, 8.73, 14.61, 70, 75, ["RBC14C", "RB14S", "RB14-X331"]),
  m("RBL", "2015", "M20 x 1,5", 15, 58.8, 25, 1961, 11.57, 17.65, 150, 165, ["RBC20C", "RB20S", "RB20-X331"]),
  m("RBL", "2725", "M27 x 1,5", 25, 147, 10, 2942, 22.16, 38.05, 365, 410, ["RBC27C", "RB27S", "RB27-X331"]),
  m("RBQ", "1604", "M16 x 1,5", 4, 1.96, 60, 294, 6.08, 13.45, 28, 28, ["RBQC16C", "RBQ16S", null]),
  m("RBQ", "2007", "M20 x 1,5", 7, 11.8, 60, 490, 12.75, 27.75, 60, 60, ["RBQC20C", "RB20S", null]),
  m("RBQ", "2508", "M25 x 1,5", 8, 19.6, 45, 686, 15.69, 37.85, 110, 110, ["RBQC25C", "RBQ25S", null]),
  m("RBQ", "3009", "M30 x 1,5", 8.5, 33.3, 45, 981, 21.57, 44.23, 182, 182, ["RBQC30C", "RBQ30S", null]),
  m("RBQ", "3213", "M32 x 1,5", 13, 49.0, 30, 1177, 24.52, 54.23, 240, 240, ["RBQC32C", "RBQ32S", null]),
];
/** RBQ:s vikt anges bara en gång (sida 1310); bufferten finns för alla fem. */

/** Storleksvärdena i databasen: varje kod en gång, med gänga och slag. */
export const RB_SIZES: RBValue[] = RB_MODELS.filter((x, i, a) => a.findIndex((y) => y.size === x.size) === i)
  .sort((a, b) => Number(a.size) - Number(b.size))
  .map((x) => ({
    code: x.size,
    label_sv: `${x.thread}, slag ${String(x.stroke_mm).replace(".", ",")} mm (${RB_MODELS.filter((y) => y.size === x.size).map((y) => y.series).join("/")})`,
  }));

export const RB_LIMITS = {
  temp_c: [-10, 80],
} as const;

export interface RBConfig {
  series: string;
  size: string;
  type?: string;
  option?: string;
}

export function rbModel(series: string, size: string): RBModel | undefined {
  return RB_MODELS.find((x) => x.series === series && x.size === size);
}

export function rbBuildCode(c: RBConfig): string | null {
  const s = RB_SERIES.find((x) => x.code === c.series);
  const mod = rbModel(c.series, c.size);
  if (!s || !mod) return null;
  const type = c.type ?? "";
  if (type && (type !== RB_TYPE_C.code || !mod.c_ok)) return null;
  const option = c.option ?? "";
  if (option && (!RB_OPTIONS.some((o) => o.code === option) || !mod.options_ok)) return null;
  return `${s.code}${type}${mod.size}${option}`;
}

export function rbParseCode(raw: string): { config: RBConfig } | null {
  const k = raw.trim().toUpperCase();
  const mm = /^RB(L|Q)?(C?)(\d{4})(SJ|SN|J|N|S)?$/.exec(k);
  if (!mm) return null;
  const [, serie, type, size, option] = mm;
  const c: RBConfig = { series: `RB${serie ?? ""}`, size, type: type || undefined, option: option || undefined };
  if (rbBuildCode(c) !== k) return null;
  return { config: c };
}

export const RB_ORDER_CODE_TEMPLATE = "{series}{type}{size}{option}";

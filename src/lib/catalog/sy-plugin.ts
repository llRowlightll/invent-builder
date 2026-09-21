/**
 * SMC SY3000/5000/7000 — plug-in-ventilen som monteras på ventilramperna
 * typ 10/11 (basmonterad, SY□1□0) och typ 12 (topportad, SY□1□3, bär A/B-
 * porten), även metallbasramperna typ 50/51/52. Familjen sy (ventilrampen)
 * pekar hit för ventilerna per station.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "5-Port Solenoid Valve SY3000/5000/7000 Series" (katalogkapitlet,
 *   katalogsidor 387–720, SMC:s SY.New.pdf). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-sy-new.pdf'.
 *     - ventildata: tryck, frekvens, effekt, kapsling                sida 404
 *     - responstider                                                 sida 405
 *     - ventilvikter                                                 sida 406
 *     - How to Order Valves, basmonterad (D-sub-kitet: spänning 5/6,
 *       ljus/skyddsdiod Nil–NZ)                                      sida 432
 *     - How to Order Valves för EX600-rampen (24 V, R/U/S/Z/NS/NZ)   sida 504
 *     - How to Order Valves, topportad (port, gänga)                 sida 513
 *
 * KODENS FORM (sida 432, 504 och 513):
 *
 *   SY 3 1 0 0        - 5 U   1          nyckelns exempel: SY3000, 2-läges enkel,
 *                                         basmonterad, gummitätning, 24 V DC,
 *                                         ljus + skyddsdiod opolär
 *   SY 5 1 0 0 R      - 5 U F 1          extern pilot, glidlås (SY5100R-5UF1)
 *   SY 3 1 0 0 H      - 5 U   1          inbyggd backventil (SY3100H-5U1)
 *   SY 3 1 3 0        - 5 U   1 - C6     topportad med ø6-port (sida 513)
 *   SY 5 1 3 0        - 5 U   1 - 01 F   topportad, gänga 1/8 G
 *   SY{serie}{funktion}{kropp}{tätning}{pilot}{backventil}{tillval}{spole}-{spänning}{ljus}{manöver}1-{port}{gänga}{skruv}
 *
 * Siffran 1 efter manöverdonet ligger fast i nyckeln. Tredje tecknet är
 * KROPPEN (0 basmonterad, 3 topportad) och fjärde TÄTNINGEN — SY3131 är den
 * topportade metalltätade (sida 405–406).
 */

export const SYP_SOURCE = {
  file: "smc-kat-sy-new.pdf",
  edition: "SMC SY3000/5000/7000 catalogue chapter (catalogue pages 387–720, SY.New 2024-12)",
  title: "SMC 5-Port Solenoid Valve SY3000/5000/7000 Series",
  brand: "SMC",
} as const;

export interface SYPValue {
  code: string;
  label_sv: string;
}

export const SYP_SERIES: SYPValue[] = [
  { code: "3", label_sv: "SY3000" },
  { code: "5", label_sv: "SY5000" },
  { code: "7", label_sv: "SY7000" },
];

export interface SYPActuation extends SYPValue {
  positions: 2 | 3 | 4;
  /** Arbetstryck intern pilot [MPa], gummitätning (sida 404). */
  pressure: [number, number];
  /** Bara gummitätning (4-läges dubbel 3-portsventil, sida 404 och 432). */
  rubber_only: boolean;
  /** Inbyggd backventil finns inte för 3-läges (sida 432). */
  check_ok: boolean;
  name_en: string;
}
export const SYP_ACTUATIONS: SYPActuation[] = [
  { code: "1", positions: 2, pressure: [0.15, 0.7], rubber_only: false, check_ok: true, name_en: "2-position single", label_sv: "2-läges, enkel magnet (monostabil)" },
  { code: "2", positions: 2, pressure: [0.1, 0.7], rubber_only: false, check_ok: true, name_en: "2-position double", label_sv: "2-läges, dubbel magnet (bistabil)" },
  { code: "3", positions: 3, pressure: [0.2, 0.7], rubber_only: false, check_ok: false, name_en: "3-position closed center", label_sv: "3-läges, stängt mittläge" },
  { code: "4", positions: 3, pressure: [0.2, 0.7], rubber_only: false, check_ok: false, name_en: "3-position exhaust center", label_sv: "3-läges, avluftat mittläge" },
  { code: "5", positions: 3, pressure: [0.2, 0.7], rubber_only: false, check_ok: false, name_en: "3-position pressure center", label_sv: "3-läges, trycksatt mittläge" },
  { code: "A", positions: 4, pressure: [0.15, 0.7], rubber_only: true, check_ok: true, name_en: "4-position dual 3-port N.C./N.C.", label_sv: "4-läges dubbel 3-portsventil, NC/NC (bara gummitätning)" },
  { code: "B", positions: 4, pressure: [0.15, 0.7], rubber_only: true, check_ok: true, name_en: "4-position dual 3-port N.O./N.O.", label_sv: "4-läges dubbel 3-portsventil, NO/NO (bara gummitätning)" },
  { code: "C", positions: 4, pressure: [0.15, 0.7], rubber_only: true, check_ok: true, name_en: "4-position dual 3-port N.C./N.O.", label_sv: "4-läges dubbel 3-portsventil, NC/NO (bara gummitätning)" },
];

export interface SYPBody extends SYPValue {
  /** Rampens typ (familjen sy) och metallbasrampen med samma ventil. */
  manifold_types: string;
  metal_base: string;
  page: number;
}
export const SYP_BODIES: SYPBody[] = [
  { code: "0", manifold_types: "10/11", metal_base: "50/51", page: 504, label_sv: "Basmonterad, för ramp typ 10/11 (A/B-portar på basen)" },
  { code: "3", manifold_types: "12", metal_base: "52", page: 513, label_sv: "Topportad, för ramp typ 12 (A/B-porten sitter på ventilen)" },
];

export const SYP_SEALS: SYPValue[] = [
  { code: "0", label_sv: "Gummitätning" },
  { code: "1", label_sv: "Metalltätning (högre frekvens, −100 kPa…0,7 MPa extern pilot)" },
];

export const SYP_PILOT_R: SYPValue = { code: "R", label_sv: "Extern pilot (vakuum/lågtryck; pilottryck 0,25–0,7 MPa)" };
export const SYP_CHECK_H: SYPValue = { code: "H", label_sv: "Inbyggd backventil (gummitätning, 2-/4-läges, SY3000/5000)" };
export interface SYPOption extends SYPValue {
  metal_only: boolean;
  max_mpa: number;
}
export const SYP_OPTIONS: SYPOption[] = [
  { code: "B", metal_only: false, max_mpa: 0.7, label_sv: "Snabb respons (0,7 MPa)" },
  { code: "K", metal_only: true, max_mpa: 1.0, label_sv: "Högtryck 1,0 MPa (bara metalltätning)" },
];
export const SYP_COIL_T: SYPValue = { code: "T", label_sv: "Strömsparkrets, kontinuerlig drift (bara med ljus Z eller NZ)" };
export const SYP_VOLTAGES: SYPValue[] = [
  { code: "5", label_sv: "24 V DC" },
  { code: "6", label_sv: "12 V DC" },
];
export interface SYPLight extends SYPValue {
  light: boolean;
  common: "non-polar" | "positive" | "negative";
}
/** Ljus/skyddsdiod och kommun (sida 432); Nil = utan (finns inte för EX600-rampen, sida 504). */
export const SYP_LIGHTS: SYPLight[] = [
  { code: "R", light: false, common: "non-polar", label_sv: "Skyddsdiod, opolär" },
  { code: "U", light: true, common: "non-polar", label_sv: "Ljus och skyddsdiod, opolär" },
  { code: "S", light: false, common: "positive", label_sv: "Skyddsdiod, pluskommun" },
  { code: "Z", light: true, common: "positive", label_sv: "Ljus och skyddsdiod, pluskommun" },
  { code: "NS", light: false, common: "negative", label_sv: "Skyddsdiod, minuskommun" },
  { code: "NZ", light: true, common: "negative", label_sv: "Ljus och skyddsdiod, minuskommun" },
];
export const SYP_OVERRIDES: SYPValue[] = [
  { code: "D", label_sv: "Tryck-vrid-lås, spårförsett (standard är tryckknapp utan lås)" },
  { code: "E", label_sv: "Tryck-vrid-lås med spak" },
  { code: "F", label_sv: "Glidlås" },
];
export interface SYPPort extends SYPValue {
  series: string[];
  /** Gängad port (M5, 1/8, 1/4) — gängtypen F/N/T gäller bara 01 och 02 (sida 513). */
  thread: boolean;
  threadable: boolean;
}
/** Topportade ventilens A/B-port (sida 513). */
export const SYP_PORTS: SYPPort[] = [
  { code: "M5", series: ["3"], thread: true, threadable: false, label_sv: "Gänga M5 x 0,8 (SY3000)" },
  { code: "01", series: ["5"], thread: true, threadable: true, label_sv: "Gänga 1/8 (SY5000)" },
  { code: "02", series: ["7"], thread: true, threadable: true, label_sv: "Gänga 1/4 (SY7000)" },
  { code: "C2", series: ["3"], thread: false, threadable: false, label_sv: "Snabbkoppling ø2" },
  { code: "C3", series: ["3"], thread: false, threadable: false, label_sv: "Snabbkoppling ø3,2" },
  { code: "C4", series: ["3", "5"], thread: false, threadable: false, label_sv: "Snabbkoppling ø4" },
  { code: "C6", series: ["3", "5", "7"], thread: false, threadable: false, label_sv: "Snabbkoppling ø6" },
  { code: "C8", series: ["5", "7"], thread: false, threadable: false, label_sv: "Snabbkoppling ø8" },
  { code: "C10", series: ["7"], thread: false, threadable: false, label_sv: "Snabbkoppling ø10" },
  { code: "C12", series: ["7"], thread: false, threadable: false, label_sv: "Snabbkoppling ø12" },
  { code: "N1", series: ["3"], thread: false, threadable: false, label_sv: "Snabbkoppling ø1/8\"" },
  { code: "N3", series: ["3", "5"], thread: false, threadable: false, label_sv: "Snabbkoppling ø5/32\"" },
  { code: "N7", series: ["3", "5", "7"], thread: false, threadable: false, label_sv: "Snabbkoppling ø1/4\"" },
  { code: "N9", series: ["5", "7"], thread: false, threadable: false, label_sv: "Snabbkoppling ø5/16\"" },
  { code: "N11", series: ["7"], thread: false, threadable: false, label_sv: "Snabbkoppling ø3/8\"" },
];
export const SYP_THREADS: SYPValue[] = [
  { code: "F", label_sv: "G-gänga (standard är Rc)" },
  { code: "N", label_sv: "NPT-gänga" },
  { code: "T", label_sv: "NPTF-gänga" },
];
export const SYP_SCREWS: SYPValue[] = [
  { code: "B", label_sv: "Insexskruv (standard är kombiskruv med rundat huvud)" },
  { code: "K", label_sv: "Kombiskruv, tappsäkrad" },
  { code: "H", label_sv: "Insexskruv, tappsäkrad" },
];

export interface SYPData {
  series: string;
  positions: 2 | 3 | 4;
  /** Vikt basmonterad, gummi/metall [g] (sida 406); 4-läges saknar metall. */
  weight_rubber_g: number;
  weight_metal_g: number | null;
  /** Högsta manöverfrekvens [Hz], gummi/metall (sida 404). */
  freq_rubber_hz: number;
  freq_metal_hz: number | null;
  /** Responstid standard utan ljus [ms], gummi/metall, för enkel/dubbel/3-/4-läges (sida 405). */
  response_ms: Record<string, [number, number | null]>;
}
/** Data per serie (sida 404–406). */
export const SYP_DATA: Record<string, { weight: Record<string, [number, number | null]>; freq: Record<string, [number, number | null]>; response: Record<string, [number, number | null]> }> = {
  "3": { weight: { "1": [74, 76], "2": [83, 86], "3": [87, 90], "4": [83, null] }, freq: { "2": [5, 20], "3": [3, 10], "4": [5, null] }, response: { "1": [15, 15], "2": [12, 12], "3": [18, 18], "4": [18, null] } },
  "5": { weight: { "1": [82, 91], "2": [90, 101], "3": [100, 111], "4": [90, null] }, freq: { "2": [5, 20], "3": [3, 10], "4": [5, null] }, response: { "1": [24, 24], "2": [12, 12], "3": [30, 28], "4": [35, null] } },
  "7": { weight: { "1": [110, 122], "2": [118, 133], "3": [133, 150], "4": [114, null] }, freq: { "2": [5, 10], "3": [3, 10], "4": [3, null] }, response: { "1": [47, 39], "2": [18, 17], "3": [52, 38], "4": [52, null] } },
};

export const SYP_LIMITS = {
  temp_c: [-10, 50],
  enclosure: "IP67",
  power_w: 0.35,
  power_light_w: 0.4,
  power_hp_w: 0.9,
  power_saving_w: 0.1,
  external_pilot_mpa: [0.25, 0.7],
} as const;

export interface SYPConfig {
  series: string;
  actuation: string;
  body: string;
  seal: string;
  pilot?: string;
  check?: string;
  option?: string;
  coil?: string;
  voltage: string;
  light?: string;
  override?: string;
  port?: string;
  thread?: string;
  screw?: string;
}

export function sypBuildCode(c: SYPConfig): string | null {
  if (!SYP_SERIES.some((x) => x.code === c.series)) return null;
  const a = SYP_ACTUATIONS.find((x) => x.code === c.actuation);
  if (!a) return null;
  const b = SYP_BODIES.find((x) => x.code === c.body);
  if (!b) return null;
  if (!SYP_SEALS.some((x) => x.code === c.seal)) return null;
  const metal = c.seal === "1";
  if (a.rubber_only && metal) return null;
  const pilot = c.pilot ?? "";
  if (pilot && pilot !== SYP_PILOT_R.code) return null;
  const check = c.check ?? "";
  if (check) {
    if (check !== SYP_CHECK_H.code || metal || !a.check_ok || c.series === "7") return null;
  }
  const option = c.option ?? "";
  if (option) {
    const o = SYP_OPTIONS.find((x) => x.code === option);
    if (!o || (o.metal_only && !metal)) return null;
  }
  const coil = c.coil ?? "";
  const light = c.light ?? "";
  if (light && !SYP_LIGHTS.some((x) => x.code === light)) return null;
  if (coil) {
    if (coil !== SYP_COIL_T.code || !["Z", "NZ"].includes(light)) return null;
  }
  if (!SYP_VOLTAGES.some((x) => x.code === c.voltage)) return null;
  const ov = c.override ?? "";
  if (ov && !SYP_OVERRIDES.some((x) => x.code === ov)) return null;
  const port = c.port ?? "";
  const thread = c.thread ?? "";
  if (b.code === "0") {
    if (port || thread) return null;
  } else {
    const p = SYP_PORTS.find((x) => x.code === port);
    if (!p || !p.series.includes(c.series)) return null;
    if (thread && (!p.threadable || !SYP_THREADS.some((x) => x.code === thread))) return null;
  }
  const screw = c.screw ?? "";
  if (screw && !SYP_SCREWS.some((x) => x.code === screw)) return null;
  const tail = `${port}${thread}${screw}`;
  return `SY${c.series}${a.code}${b.code}${c.seal}${pilot}${check}${option}${coil}-${c.voltage}${light}${ov}1${tail ? `-${tail}` : ""}`;
}

export function sypParseCode(raw: string): { config: SYPConfig } | null {
  const k = raw.trim().toUpperCase();
  const mm = /^SY([357])([1-5ABC])([03])([01])(R?)(H?)([BK]?)(T?)-([56])(NS|NZ|R|U|S|Z)?([DEF]?)1(?:-(M5|01|02|C2|C3|C4|C6|C8|C10|C12|N1|N3|N7|N9|N11)?([FNT]?)([BKH]?))?$/.exec(k);
  if (!mm) return null;
  const [, series, actuation, body, seal, pilot, check, option, coil, voltage, light, override, port, thread, screw] = mm;
  const c: SYPConfig = {
    series, actuation, body, seal, voltage,
    pilot: pilot || undefined, check: check || undefined, option: option || undefined, coil: coil || undefined,
    light: light || undefined, override: override || undefined, port: port || undefined, thread: thread || undefined, screw: screw || undefined,
  };
  if (sypBuildCode(c) !== k) return null;
  return { config: c };
}

export const SYP_ORDER_CODE_TEMPLATE = "SY{series}{actuation}{body}{seal}{pilot}{check}{option}{coil}-{voltage}{light}{override}1-{port}{thread}{screw}";

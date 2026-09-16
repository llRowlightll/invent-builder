/**
 * SMC SY3000/5000/7000/9000 — 5-portsventil, enkelventil, kroppsportad eller
 * basmonterad (med eller utan underplatta).
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "5 Port Solenoid Valve SY3000/5000/7000/9000 Series" (katalogutdrag,
 *   245 sidor, katalogsidor 723–967). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-sy3000.pdf'.
 *     - How to Order, kroppsportad enkelventil    sida 732
 *     - data, magnetdata, responstider            sida 733
 *     - How to Order, basmonterad enkelventil      sida 748
 *     - specialutföranden X20/X90                 sida 942
 *     - X701 dubbel 3-portsventil                 sida 942-1
 *     - M8-kontaktens kabellängder                sida 961
 *
 * VAD FAMILJEN ÄR. Enkelventilen. Ventilramperna (sida 766–935), kassett-
 * typen (kroppstyp 6) och de manifoldmonterade varianterna är egna nycklar.
 *
 * KODENS FORM (sida 732 och 748):
 *
 *   SY 5 1 20   - 5 L     - 01          kroppsportad SY5000, 2-läges enkel, 24 V DC,
 *                                        L-plugg, Rc 1/8 (nyckelns exempel)
 *   SY 5 2 40   - 5 L                   basmonterad SY5000, dubbel magnet, utan underplatta
 *   SY 3 1 40   - 5 L O Z - 01 F        basmonterad SY3000 på underplatta G 1/8, plugg
 *                                        utan kontakt, ljus/spärrdiod
 *   SY 5 A 20   - 5 W 1 Z E - C6 - X701 dubbel 3-portsventil, M8 med 300 mm kabel
 *   SY{serie}{funktion}{kropp}{pilot}{spole}-{spänning}{anslutning}{ljus}{manöver}-{port}{gänga}-{fäste}-{special}-{ce}
 */

export const SY_SOURCE = {
  file: "smc-kat-sy3000.pdf",
  edition: "SMC SY3000/5000/7000/9000 catalogue (catalogue pages 723–967)",
  title: "SMC 5 Port Solenoid Valve SY3000/5000/7000/9000 Series",
  brand: "SMC",
} as const;

export interface SYValue {
  code: string;
  label_sv: string;
}

export interface SYSeries extends SYValue {
  /** Portar kroppsportad: gänga, metriska och tum-snabbkopplingar (sida 732). */
  ports_thread: string[];
  ports_metric: string[];
  ports_inch: string[];
  /** Underplattor basmonterad (sida 748). */
  ports_base: string[];
  /** Fästen F1/F2 finns (sida 732: inte SY9000). */
  bracket_ok: boolean;
  /** -X701 finns (sida 942-1: SY5000/7000). */
  x701_ok: boolean;
  /** -X20 finns (sida 942: inte SY9000). */
  x20_ok: boolean;
  /** DIN-kontakten kan inte monteras på standardunderplattan; extern pilot R finns inte med DIN (sida 748). */
  din_no_subplate: boolean;
  /** Högsta manöverfrekvens [Hz] 2-läges/3-läges (sida 733). */
  freq_hz: [number, number];
}
export const SY_SERIES: SYSeries[] = [
  { code: "3", ports_thread: ["M5"], ports_metric: ["C4", "C6"], ports_inch: ["N3", "N7"], ports_base: ["01"], bracket_ok: true, x701_ok: false, x20_ok: true, din_no_subplate: true, freq_hz: [10, 3], label_sv: "SY3000 (M5 eller ø4/ø6; underplatta 1/8)" },
  { code: "5", ports_thread: ["01"], ports_metric: ["C4", "C6", "C8"], ports_inch: ["N3", "N7", "N9"], ports_base: ["02"], bracket_ok: true, x701_ok: true, x20_ok: true, din_no_subplate: false, freq_hz: [5, 3], label_sv: "SY5000 (1/8 eller ø4/ø6/ø8; underplatta 1/4)" },
  { code: "7", ports_thread: ["02"], ports_metric: ["C8", "C10"], ports_inch: ["N9", "N11"], ports_base: ["02", "03"], bracket_ok: true, x701_ok: true, x20_ok: true, din_no_subplate: false, freq_hz: [5, 3], label_sv: "SY7000 (1/4 eller ø8/ø10; underplatta 1/4 eller 3/8)" },
  { code: "9", ports_thread: ["02", "03"], ports_metric: ["C8", "C10", "C12"], ports_inch: ["N9", "N11"], ports_base: ["03", "04"], bracket_ok: false, x701_ok: false, x20_ok: false, din_no_subplate: false, freq_hz: [5, 3], label_sv: "SY9000 (1/4, 3/8 eller ø8/ø10/ø12; underplatta 3/8 eller 1/2; inget fäste)" },
];
export interface SYActuation extends SYValue {
  /** Dubbel 3-portsventil: bara -X701 (sida 942-1). */
  dual: boolean;
  /** Arbetstryck [MPa], intern pilot (sida 733). */
  pressure: [number, number];
  three_pos: boolean;
}
export const SY_ACTUATIONS: SYActuation[] = [
  { code: "1", dual: false, pressure: [0.15, 0.7], three_pos: false, label_sv: "2-läges, enkel magnet (monostabil)" },
  { code: "2", dual: false, pressure: [0.1, 0.7], three_pos: false, label_sv: "2-läges, dubbel magnet (bistabil)" },
  { code: "3", dual: false, pressure: [0.2, 0.7], three_pos: true, label_sv: "3-läges, stängt mittläge" },
  { code: "4", dual: false, pressure: [0.2, 0.7], three_pos: true, label_sv: "3-läges, avluftat mittläge" },
  { code: "5", dual: false, pressure: [0.2, 0.7], three_pos: true, label_sv: "3-läges, trycksatt mittläge" },
  { code: "A", dual: true, pressure: [0.1, 0.7], three_pos: false, label_sv: "4-läges dubbel 3-portsventil, två NC (bara -X701, SY5000/7000)" },
  { code: "B", dual: true, pressure: [0.1, 0.7], three_pos: false, label_sv: "4-läges dubbel 3-portsventil, två NO (bara -X701, SY5000/7000)" },
  { code: "C", dual: true, pressure: [0.1, 0.7], three_pos: false, label_sv: "4-läges dubbel 3-portsventil, NC + NO (bara -X701, SY5000/7000)" },
];
export const SY_BODIES: SYValue[] = [
  { code: "20", label_sv: "Kroppsportad" },
  { code: "40", label_sv: "Basmonterad (med eller utan underplatta)" },
];
export const SY_PILOT: SYValue = { code: "R", label_sv: "Extern pilot (bara basmonterad; inte SY3000 med DIN-kontakt)" };
export const SY_COIL: SYValue = { code: "T", label_sv: "Strömsparande krets (bara 24/12 V DC; inte DIN eller M8; ljus/spärrdiod Z)" };
export interface SYVoltage extends SYValue {
  ac: boolean;
  /** 6/5/3 V DC: inte DIN-kontakt (sida 732) och inte strömsparkrets T. */
  low_dc: boolean;
}
export const SY_VOLTAGES: SYVoltage[] = [
  { code: "5", ac: false, low_dc: false, label_sv: "24 V DC" },
  { code: "6", ac: false, low_dc: false, label_sv: "12 V DC" },
  { code: "V", ac: false, low_dc: true, label_sv: "6 V DC (inte DIN-kontakt)" },
  { code: "S", ac: false, low_dc: true, label_sv: "5 V DC (inte DIN-kontakt)" },
  { code: "R", ac: false, low_dc: true, label_sv: "3 V DC (inte DIN-kontakt)" },
  { code: "1", ac: true, low_dc: false, label_sv: "100 V AC 50/60 Hz" },
  { code: "2", ac: true, low_dc: false, label_sv: "200 V AC 50/60 Hz" },
  { code: "3", ac: true, low_dc: false, label_sv: "110 V AC [115 V AC] 50/60 Hz" },
  { code: "4", ac: true, low_dc: false, label_sv: "220 V AC [230 V AC] 50/60 Hz" },
];
export interface SYEntry extends SYValue {
  kind: "grommet" | "plug" | "din" | "m8";
  no_connector: boolean;
}
const e = (code: string, kind: SYEntry["kind"], label: string, noConn = false): SYEntry => ({ code, kind, no_connector: noConn, label_sv: label });
const M8_LENGTHS: Array<[string, number]> = [["1", 300], ["2", 500], ["3", 1000], ["4", 2000], ["5", 3000], ["6", 4000], ["7", 5000]];
export const SY_ENTRIES: SYEntry[] = [
  e("G", "grommet", "Grommet, kabel 300 mm"),
  e("H", "grommet", "Grommet, kabel 600 mm"),
  e("L", "plug", "L-plugg med kabel 300 mm"),
  e("LN", "plug", "L-plugg utan kabel (två stift)"),
  e("LO", "plug", "L-plugg utan kontakt", true),
  e("M", "plug", "M-plugg med kabel 300 mm"),
  e("MN", "plug", "M-plugg utan kabel (två stift)"),
  e("MO", "plug", "M-plugg utan kontakt", true),
  e("D", "din", "DIN-kontakt med kontaktdon (IP65; DC 24/12 V)"),
  e("DO", "din", "DIN-kontakt utan kontaktdon (IP65; DC 24/12 V)", true),
  e("Y", "din", "DIN EN 175301-803C med kontaktdon (IP65; DC 24/12 V)"),
  e("YO", "din", "DIN EN 175301-803C utan kontaktdon (IP65; DC 24/12 V)", true),
  e("WO", "m8", "M8-kontakt utan kabel (IP65; bara DC)", true),
  ...M8_LENGTHS.map(([k, mm]) => e(`W${k}`, "m8", `M8-kontakt med kabel ${mm} mm (IP65; bara DC)`)),
  ...M8_LENGTHS.map(([k, mm]) => e(`WA${k}`, "m8", `M8-kontakt IEC 60947-2 med kabel ${mm} mm (IP65; bara DC)`)),
];
export interface SYLight extends SYValue {
  ac: boolean;
  /** Med ljus: finns inte i DIN utan kontaktdon (DOZ/YOZ, sida 732). */
  light: boolean;
  /** Finns för DIN-kontakten D/Y (sida 732: bara S och Z, opolära). */
  din_ok: boolean;
}
export const SY_LIGHTS: SYLight[] = [
  { code: "S", ac: false, light: false, din_ok: true, label_sv: "Spärrdiod (bara DC; DIN: opolär)" },
  { code: "Z", ac: true, light: true, din_ok: true, label_sv: "Ljus och spärrdiod (DIN: opolär)" },
  { code: "R", ac: false, light: false, din_ok: false, label_sv: "Spärrdiod, opolär (bara DC; inte DIN)" },
  { code: "U", ac: false, light: true, din_ok: false, label_sv: "Ljus och spärrdiod, opolär (bara DC; inte DIN)" },
];
export const SY_OVERRIDES: SYValue[] = [
  { code: "D", label_sv: "Låsbar manöver, spårskruv (tryck och vrid)" },
  { code: "E", label_sv: "Låsbar manöver, spak (tryck och vrid)" },
];
export interface SYPort extends SYValue {
  kind: "thread" | "metric" | "inch" | "base";
  size: string;
}
export const SY_PORTS: SYPort[] = [
  { code: "M5", kind: "thread", size: "M5 x 0.8", label_sv: "M5 x 0,8 kroppsportad (SY3000; bara Rc-utförandet)" },
  { code: "01", kind: "thread", size: "1/8", label_sv: "1/8: kroppsportad SY5000, underplatta SY3000" },
  { code: "02", kind: "thread", size: "1/4", label_sv: "1/4: kroppsportad SY7000/9000, underplatta SY5000/7000" },
  { code: "03", kind: "thread", size: "3/8", label_sv: "3/8: kroppsportad SY9000, underplatta SY7000/9000" },
  { code: "04", kind: "thread", size: "1/2", label_sv: "1/2: underplatta SY9000" },
  { code: "C4", kind: "metric", size: "ø4", label_sv: "Snabbkoppling ø4 (SY3000/5000)" },
  { code: "C6", kind: "metric", size: "ø6", label_sv: "Snabbkoppling ø6 (SY3000/5000)" },
  { code: "C8", kind: "metric", size: "ø8", label_sv: "Snabbkoppling ø8 (SY5000/7000/9000)" },
  { code: "C10", kind: "metric", size: "ø10", label_sv: "Snabbkoppling ø10 (SY7000/9000)" },
  { code: "C12", kind: "metric", size: "ø12", label_sv: "Snabbkoppling ø12 (SY9000)" },
  { code: "N3", kind: "inch", size: "ø5/32\"", label_sv: "Snabbkoppling ø5/32\" (SY3000/5000)" },
  { code: "N7", kind: "inch", size: "ø1/4\"", label_sv: "Snabbkoppling ø1/4\" (SY3000/5000)" },
  { code: "N9", kind: "inch", size: "ø5/16\"", label_sv: "Snabbkoppling ø5/16\" (SY5000/7000/9000)" },
  { code: "N11", kind: "inch", size: "ø3/8\"", label_sv: "Snabbkoppling ø3/8\" (SY7000/9000)" },
];
export const SY_THREADS: SYValue[] = [
  { code: "F", label_sv: "G-gänga (standard är Rc)" },
  { code: "N", label_sv: "NPT-gänga" },
  { code: "T", label_sv: "NPTF-gänga" },
];
export const SY_BRACKETS: SYValue[] = [
  { code: "F1", label_sv: "Fotfäste (bara 2-läges enkel, kroppsportad; inte SY9000)" },
  { code: "F2", label_sv: "Sidofäste (kroppsportad; inte SY9000)" },
];
export const SY_MTO: SYValue[] = [
  { code: "X20", label_sv: "-X20 Extern pilot, kroppsportad (inte SY9000)" },
  { code: "X90", label_sv: "-X90 Huvudventil i fluorgummi" },
  { code: "X701", label_sv: "-X701 4-läges dubbel 3-portsventil (funktion A/B/C, SY5000/7000)" },
];
export const SY_CE: SYValue = { code: "Q", label_sv: "CE/UKCA-märkt (AC bara med DIN-kontakt)" };
export const SY_LIMITS = {
  temp_c: [-10, 50],
  impact_vibration: "150/30 m/s²",
  power_w: 0.35,
  power_w_saving: 0.1,
} as const;

export interface SYConfig {
  series: string;
  actuation: string;
  body: string;
  pilot?: string;
  coil?: string;
  voltage: string;
  entry: string;
  light?: string;
  override?: string;
  port?: string;
  thread?: string;
  bracket?: string;
  mto?: string;
  ce?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

export function syBodyPorts(s: SYSeries): string[] {
  return [...s.ports_thread, ...s.ports_metric, ...s.ports_inch];
}

export function syBuildCode(c: SYConfig): string | null {
  const s = SY_SERIES.find((x) => x.code === c.series);
  const a = SY_ACTUATIONS.find((x) => x.code === c.actuation);
  const v = SY_VOLTAGES.find((x) => x.code === c.voltage);
  const en = SY_ENTRIES.find((x) => x.code === c.entry);
  if (!s || !a || !v || !en || !har(SY_BODIES, c.body)) return null;
  const base = c.body === "40";
  const mto = c.mto ?? "";
  if (mto && !har(SY_MTO, mto)) return null;
  if (a.dual !== (mto === "X701")) return null;
  if (mto === "X701" && !s.x701_ok) return null;
  if (mto === "X20" && (base || !s.x20_ok)) return null;
  const pilot = c.pilot ?? "";
  if (pilot && (pilot !== SY_PILOT.code || !base || mto === "X701")) return null;
  if (pilot && s.din_no_subplate && en.kind === "din") return null;
  const coil = c.coil ?? "";
  if (coil && coil !== SY_COIL.code) return null;
  if (coil && (v.ac || v.low_dc || en.kind === "din" || en.kind === "m8")) return null;
  if (en.kind === "m8" && v.ac) return null;
  if (en.kind === "din" && v.low_dc) return null;
  if (base && s.din_no_subplate && en.kind === "din" && c.port) return null;
  const light = c.light ?? "";
  const li = light ? SY_LIGHTS.find((x) => x.code === light) : undefined;
  if (light && !li) return null;
  if (li) {
    if (v.ac && !li.ac) return null;
    if (en.kind === "din" && (!li.din_ok || (en.no_connector && li.light))) return null;
  }
  if (coil && light !== "Z") return null;
  const ov = c.override ?? "";
  if (ov && !har(SY_OVERRIDES, ov)) return null;
  const port = c.port ?? "";
  const p = port ? SY_PORTS.find((x) => x.code === port) : undefined;
  if (port && !p) return null;
  if (base) {
    if (port && !s.ports_base.includes(port)) return null;
  } else if (!port || !syBodyPorts(s).includes(port)) return null;
  const thread = c.thread ?? "";
  if (thread) {
    if (!har(SY_THREADS, thread) || !p || p.kind !== "thread" || port === "M5") return null;
    if (mto === "X701" && thread !== "F") return null;
  }
  const bracket = c.bracket ?? "";
  if (bracket) {
    if (!har(SY_BRACKETS, bracket) || base || !s.bracket_ok) return null;
    if (bracket === "F1" && a.code !== "1") return null;
  }
  const ce = c.ce ?? "";
  if (ce && (ce !== SY_CE.code || (v.ac && en.kind !== "din"))) return null;
  const g1 = `SY${s.code}${a.code}${c.body}${pilot}${coil}`;
  const g2 = `${v.code}${en.code}${light}${ov}`;
  return [g1, g2, `${port}${thread}`, bracket, mto, ce].filter((g, i) => i < 2 || g).join("-");
}

export function syParseCode(raw: string): { config: SYConfig } | null {
  const k = raw.trim().toUpperCase();
  const entries = [...SY_ENTRIES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const ports = [...SY_PORTS].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^SY([3579])([1-5ABC])(20|40)(R?)(T?)-([56VSR1-4])(${entries})([SZRU]?)([DE]?)(?:-(${ports})?([FNT])?)?(?:-(F[12]))?(?:-(X20|X90|X701))?(?:-(Q))?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, series, actuation, body, pilot, coil, voltage, entry, light, ov, port, thread, bracket, mto, ce] = m;
  const c: SYConfig = {
    series, actuation, body, pilot: pilot || undefined, coil: coil || undefined, voltage, entry, light: light || undefined, override: ov || undefined,
    port: port || undefined, thread: thread || undefined, bracket: bracket || undefined, mto: mto || undefined, ce: ce || undefined,
  };
  if (syBuildCode(c) !== k) return null;
  return { config: c };
}

export const SY_ORDER_CODE_TEMPLATE =
  "SY{series}{actuation}{body}{pilot}{coil}-{voltage}{entry}{light}{override}-{port}{thread}-{bracket}-{mto}-{ce}";

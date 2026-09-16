/**
 * SMC VF1000/3000/5000 — pilotstyrd 5-portsventil, enkelventil, kroppsportad
 * (VF1000/3000/5000) eller basmonterad med underplatta (VF3000/5000).
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "5 Port Solenoid Valve VF1000/3000/5000 Series" (katalogutdrag,
 *   62 sidor, katalogsidor 287–348). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-vf3000.pdf'.
 *     - How to Order, kroppsportad enkelventil    sida 292
 *     - data, magnetdata, responstider            sida 293–294
 *     - How to Order, basmonterad enkelventil      sida 306
 *     - specialutföranden X500/X600               sida 305
 *     - plugganslutningens kabellängder, DIN       sida 340–341
 *
 * VAD FAMILJEN ÄR. Enkelventilen. Ventilrampen (manifold, sida 322 och 333)
 * med sina basplattor och block är egna nycklar.
 *
 * KODENS FORM (sida 292 och 306; siffran 1 före portstorleken är fast):
 *
 *   VF 3 1 3 0     - 5 G     1 - 01           kroppsportad VF3000, 2-läges enkel,
 *                                              24 V DC, grommet, Rc 1/8
 *   VF 3 1 4 0 K T - 5 G Z D 1 - 02           basmonterad, 1 MPa, strömsparande,
 *                                              ljus/spärrdiod Z, låsbar manöver D,
 *                                              underplatta 1/4 (sida 306)
 *   VF 3 1 3 0     - 5 L O   1 - 02           plugg L utan kontakt (sida 340)
 *   VF{serie}{funktion}{kropp}{avluftning}{tryck}{spole}-{spänning}{anslutning}{ljus}{manöver}1-{port}{gänga}-{fäste}-{special}
 */

export const VF_SOURCE = {
  file: "smc-kat-vf3000.pdf",
  edition: "SMC VF1000/3000/5000 catalogue (catalogue pages 287–348)",
  title: "SMC 5 Port Solenoid Valve VF1000/3000/5000 Series",
  brand: "SMC",
} as const;

export interface VFValue {
  code: string;
  label_sv: string;
}

export interface VFSeries extends VFValue {
  /** Kroppsmodellens siffra för kroppsportad (sida 292: 2 för VF1000/5000, 3 för VF3000). */
  body_ported: string;
  /** Basmonterad (4) finns (sida 306: inte VF1000). */
  base_ok: boolean;
  /** 3-lägesfunktionerna 3/4/5 finns (sida 292: bara 1 och 2 för VF1000). */
  three_pos: boolean;
  /** Gemensam avluftning 3 finns (sida 292: inte VF1000). */
  common_exhaust: boolean;
  /** Fästet F finns för kroppsportad (sida 292: inte VF5000). */
  bracket_ok: boolean;
  /** Portstorlekar kroppsportad respektive underplatta (sida 292, 306). */
  ports_body: string[];
  ports_base: string[];
  /** Högsta manöverfrekvens [Hz] 2-läges/3-läges (sida 293). */
  freq_hz: [number, number | null];
}
export const VF_SERIES: VFSeries[] = [
  { code: "1", body_ported: "2", base_ok: false, three_pos: false, common_exhaust: false, bracket_ok: true, ports_body: ["M5", "01"], ports_base: [], freq_hz: [10, null], label_sv: "VF1000 (bara 2-läges, kroppsportad, M5 eller 1/8)" },
  { code: "3", body_ported: "3", base_ok: true, three_pos: true, common_exhaust: true, bracket_ok: true, ports_body: ["01", "02"], ports_base: ["02", "03"], freq_hz: [10, 3], label_sv: "VF3000 (1/8 eller 1/4; underplatta 1/4 eller 3/8)" },
  { code: "5", body_ported: "2", base_ok: true, three_pos: true, common_exhaust: true, bracket_ok: false, ports_body: ["02", "03"], ports_base: ["02", "03", "04"], freq_hz: [5, 3], label_sv: "VF5000 (1/4 eller 3/8; underplatta 1/4, 3/8 eller 1/2)" },
];
export interface VFActuation extends VFValue {
  /** Arbetstryck [MPa] standard och högtryck K (sida 293). */
  pressure: [number, number];
  pressure_k: [number, number];
  three_pos: boolean;
}
export const VF_ACTUATIONS: VFActuation[] = [
  { code: "1", pressure: [0.15, 0.7], pressure_k: [0.15, 1.0], three_pos: false, label_sv: "2-läges, enkel magnet (monostabil)" },
  { code: "2", pressure: [0.1, 0.7], pressure_k: [0.1, 1.0], three_pos: false, label_sv: "2-läges, dubbel magnet (bistabil)" },
  { code: "3", pressure: [0.15, 0.7], pressure_k: [0.15, 1.0], three_pos: true, label_sv: "3-läges, stängt mittläge" },
  { code: "4", pressure: [0.15, 0.7], pressure_k: [0.15, 1.0], three_pos: true, label_sv: "3-läges, avluftat mittläge" },
  { code: "5", pressure: [0.15, 0.7], pressure_k: [0.15, 1.0], three_pos: true, label_sv: "3-läges, trycksatt mittläge" },
];
export const VF_BODIES: VFValue[] = [
  { code: "2", label_sv: "Kroppsportad (VF1000 och VF5000)" },
  { code: "3", label_sv: "Kroppsportad (VF3000)" },
  { code: "4", label_sv: "Basmonterad med underplatta (VF3000 och VF5000)" },
];
export const VF_BODY_OPTS: VFValue[] = [
  { code: "0", label_sv: "Pilotventilens avluftning separat (PE-port)" },
  { code: "3", label_sv: "Huvud- och pilotventil med gemensam avluftning (krävs för IP65; inte VF1000)" },
];
export const VF_PRESSURE: VFValue = { code: "K", label_sv: "Högtryckstyp 1 MPa (inte UL-listad)" };
export const VF_COIL: VFValue = { code: "T", label_sv: "Strömsparande krets (bara DC; ljus/spärrdiod Z, med DO/YO bara S)" };
export interface VFVoltage extends VFValue {
  ac: boolean;
  /** CE/UKCA-märkning bara med DIN- och rörgängeanslutning (sida 292, tabellen och not 2: 24 VAC som DC med alla). */
  ce_din_only: boolean;
  ul: boolean;
}
export const VF_VOLTAGES: VFVoltage[] = [
  { code: "5", ac: false, ce_din_only: false, ul: true, label_sv: "24 V DC" },
  { code: "6", ac: false, ce_din_only: false, ul: true, label_sv: "12 V DC" },
  { code: "1", ac: true, ce_din_only: true, ul: false, label_sv: "100 V AC 50/60 Hz" },
  { code: "2", ac: true, ce_din_only: true, ul: false, label_sv: "200 V AC 50/60 Hz" },
  { code: "3", ac: true, ce_din_only: true, ul: false, label_sv: "110 V AC [115 V AC] 50/60 Hz" },
  { code: "4", ac: true, ce_din_only: true, ul: false, label_sv: "220 V AC [230 V AC] 50/60 Hz" },
  { code: "7", ac: true, ce_din_only: true, ul: false, label_sv: "240 V AC 50/60 Hz" },
  { code: "B", ac: true, ce_din_only: false, ul: true, label_sv: "24 V AC 50/60 Hz (CE/UKCA med alla anslutningar, som DC)" },
];
export interface VFEntry extends VFValue {
  kind: "grommet" | "plug" | "din" | "conduit";
  /** Utan kontakt (LO/MO/DO/YO): DIN utan kontakt saknar ljuset i kontakten. */
  no_connector: boolean;
  ip65: boolean;
}
const e = (code: string, kind: VFEntry["kind"], label: string, noConn = false): VFEntry => ({ code, kind, no_connector: noConn, ip65: kind === "din" || kind === "conduit", label_sv: label });
export const VF_ENTRIES: VFEntry[] = [
  e("G", "grommet", "Grommet, kabel 300 mm"),
  e("H", "grommet", "Grommet, kabel 600 mm"),
  e("L", "plug", "L-plugg med kabel 300 mm"),
  e("LN", "plug", "L-plugg utan kabel (två stift)"),
  e("LO", "plug", "L-plugg utan kontakt", true),
  e("M", "plug", "M-plugg med kabel 300 mm"),
  e("MN", "plug", "M-plugg utan kabel (två stift)"),
  e("MO", "plug", "M-plugg utan kontakt", true),
  e("D", "din", "DIN-kontakt med kontaktdon (IP65)"),
  e("DO", "din", "DIN-kontakt utan kontaktdon (IP65)", true),
  e("Y", "din", "DIN EN 175301-803 med kontaktdon (IP65)"),
  e("YO", "din", "DIN EN 175301-803 utan kontaktdon (IP65)", true),
  e("T", "conduit", "Rörgängeanslutning (IP65)"),
];
export interface VFLight extends VFValue {
  dc: boolean;
  ac: boolean;
  /** Ljus i typen: finns inte i DIN utan kontaktdon (DOZ/DOU/YOZ/YOU, sida 292). */
  light: boolean;
}
export const VF_LIGHTS: VFLight[] = [
  { code: "S", dc: true, ac: false, light: false, label_sv: "Spärrdiod (bara DC)" },
  { code: "Z", dc: true, ac: true, light: true, label_sv: "Ljus och spärrdiod" },
  { code: "R", dc: true, ac: false, light: false, label_sv: "Spärrdiod, opolär (bara DC)" },
  { code: "U", dc: true, ac: false, light: true, label_sv: "Ljus och spärrdiod, opolär (bara DC)" },
];
export const VF_OVERRIDES: VFValue[] = [
  { code: "D", label_sv: "Låsbar manöver, spårskruv (tryck och vrid)" },
  { code: "E", label_sv: "Låsbar manöver, spak (tryck och vrid)" },
];
export interface VFPort extends VFValue {
  size: string;
}
export const VF_PORTS: VFPort[] = [
  { code: "M5", size: "M5 x 0.8", label_sv: "M5 x 0,8 (bara VF1000, bara Rc-utförandet)" },
  { code: "01", size: "1/8", label_sv: "1/8 (VF1000 och VF3000 kroppsportad)" },
  { code: "02", size: "1/4", label_sv: "1/4 (VF3000 och VF5000; underplatta VF3000/5000)" },
  { code: "03", size: "3/8", label_sv: "3/8 (VF5000 kroppsportad; underplatta VF3000/5000)" },
  { code: "04", size: "1/2", label_sv: "1/2 (underplatta VF5000)" },
];
export const VF_THREADS: VFValue[] = [
  { code: "F", label_sv: "G-gänga (standard är Rc)" },
  { code: "N", label_sv: "NPT-gänga" },
  { code: "T", label_sv: "NPTF-gänga" },
];
export const VF_BRACKET: VFValue = { code: "F", label_sv: "Med fäste (kroppsportad VF1000/3000; kan inte eftermonteras)" };
export interface VFMto extends VFValue {
  ul: boolean;
}
export const VF_MTO: VFMto[] = [
  { code: "X500", ul: true, label_sv: "-X500 Pilotavluftning med rörgänga M3 (kroppsportad, avluftning 0, inte med T)" },
  { code: "X600", ul: false, label_sv: "-X600 TRIAC-utgång (bara AC, inte med T; inte UL-listad)" },
];
export const VF_LIMITS = {
  temp_c: [-10, 50],
  impact_vibration: "300/50 m/s²",
  power_w_dc: 1.5,
  power_w_saving: 0.55,
} as const;

export interface VFConfig {
  series: string;
  actuation: string;
  body: string;
  body_opt: string;
  pressure?: string;
  coil?: string;
  voltage: string;
  entry: string;
  light?: string;
  override?: string;
  port?: string;
  thread?: string;
  bracket?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

export function vfBuildCode(c: VFConfig): string | null {
  const s = VF_SERIES.find((x) => x.code === c.series);
  const a = VF_ACTUATIONS.find((x) => x.code === c.actuation);
  const v = VF_VOLTAGES.find((x) => x.code === c.voltage);
  const en = VF_ENTRIES.find((x) => x.code === c.entry);
  if (!s || !a || !v || !en) return null;
  if (a.three_pos && !s.three_pos) return null;
  const body = c.body;
  const base = body === "4";
  if (base ? !s.base_ok : body !== s.body_ported) return null;
  const opt = c.body_opt;
  if (!har(VF_BODY_OPTS, opt)) return null;
  if (opt === "3" && !s.common_exhaust) return null;
  const pressure = c.pressure ?? "";
  if (pressure && pressure !== VF_PRESSURE.code) return null;
  const coil = c.coil ?? "";
  if (coil && coil !== VF_COIL.code) return null;
  if (coil && v.ac) return null;
  const light = c.light ?? "";
  const li = light ? VF_LIGHTS.find((x) => x.code === light) : undefined;
  if (light && !li) return null;
  if (li && (v.ac ? !li.ac : !li.dc)) return null;
  if (li?.light && en.kind === "din" && en.no_connector) return null;
  if (coil && light !== (en.kind === "din" && en.no_connector ? "S" : "Z")) return null;
  const ov = c.override ?? "";
  if (ov && !har(VF_OVERRIDES, ov)) return null;
  const port = c.port ?? "";
  if (base) {
    if (port && !s.ports_base.includes(port)) return null;
  } else if (!s.ports_body.includes(port)) return null;
  const thread = c.thread ?? "";
  if (thread && (!har(VF_THREADS, thread) || port === "M5" || !port)) return null;
  const bracket = c.bracket ?? "";
  if (bracket && (bracket !== VF_BRACKET.code || base || !s.bracket_ok)) return null;
  const mto = c.mto ?? "";
  if (mto) {
    if (!har(VF_MTO, mto)) return null;
    if (mto === "X500" && (base || opt !== "0" || coil)) return null;
    if (mto === "X600" && (!v.ac || coil)) return null;
  }
  const g1 = `VF${s.code}${a.code}${body}${opt}${pressure}${coil}`;
  const g2 = `${v.code}${en.code}${light}${ov}1`;
  const g3 = `${port}${thread}`;
  return [g1, g2, g3, bracket, mto].filter((g, i) => i < 2 || g).join("-");
}

export function vfParseCode(raw: string): { config: VFConfig } | null {
  const k = raw.trim().toUpperCase();
  const entries = [...VF_ENTRIES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^VF([135])([1-5])([234])([03])(K?)(T?)-([1-7B])(${entries})([SZRU]?)([DE]?)1(?:-(M5|0[1-4])?([FNT])?)?(?:-(F))?(?:-(X[56]00))?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, series, actuation, body, body_opt, pressure, coil, voltage, entry, light, ov, port, thread, bracket, mto] = m;
  const c: VFConfig = {
    series, actuation, body, body_opt, pressure: pressure || undefined, coil: coil || undefined, voltage, entry, light: light || undefined, override: ov || undefined,
    port: port || undefined, thread: thread || undefined, bracket: bracket || undefined, mto: mto || undefined,
  };
  if (vfBuildCode(c) !== k) return null;
  return { config: c };
}

export const VF_ORDER_CODE_TEMPLATE =
  "VF{series}{actuation}{body}{body_opt}{pressure}{coil}-{voltage}{entry}{light}{override}1-{port}{thread}-{bracket}-{mto}";

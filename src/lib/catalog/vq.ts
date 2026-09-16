/**
 * SMC VQ1000/2000 — 5-portsventil, basmonterad plug-in-ventil för
 * ventilrampen VV5Q11/VV5Q21, och VQ2000 som enkelventil på underplatta.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "5 Port Solenoid Valve VQ1000/2000 Series" (katalogutdrag, 71 sidor,
 *   katalogsidor 359–427). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-vq1000.pdf'.
 *     - How to Order Valves VQ1000 / VQ2000     sida 367 / 371
 *     - data (tryck, temperatur, effekt)         sida 375
 *     - underplatta, enkelventil VQ2000           sida 403
 *     - halvstandard: extern pilot, negativ common sida 405–406
 *
 * VAD FAMILJEN ÄR. Ventilen. Ventilramperna VV5Q11/VV5Q21 med kit F/P/T/L/S/M
 * (sida 366, 370, 376–401) är egna nycklar; ventilens val som beror på
 * rampens kit (E inte i S-kit, 200/220 V AC bara F/L-kit, W bara T/L/S/M-kit)
 * ges som råd.
 *
 * KODENS FORM (sida 367, 371, 403; nollan efter funktionen och ettan efter
 * manövern är fasta tecken):
 *
 *   VQ 1 1 0 0      - 5      1           VQ1100-51: metalltätning, 2-läges enkel, 24 V DC
 *   VQ 1 2 0 0      - 5      1           VQ1200-51: dubbel magnet (sida 367, exemplet)
 *   VQ 2 1 0 0      - 5 W    1 - 02      VQ2100-5W1-02: IP65 på underplatta 1/4 (sida 403)
 *   VQ 1 3 0 1 KN   - 6 E C  1 - Q       gummi, 3-läges, högtryck + negativ common är
 *                                         inte tillåtet (N och E) — se reglerna
 *   VQ{serie}{funktion}0{tätning}{tillval}-{spänning}{ljus}{manöver}{kapsling}1-{port}{gänga}-{ce}
 */

export const VQ_SOURCE = {
  file: "smc-kat-vq1000.pdf",
  edition: "SMC VQ1000/2000 catalogue (catalogue pages 359–427)",
  title: "SMC 5 Port Solenoid Valve VQ1000/2000 Series",
  brand: "SMC",
} as const;

export interface VQValue {
  code: string;
  label_sv: string;
}

export interface VQSeries extends VQValue {
  /** Kapsling W (IP65) och underplatta finns (sida 371, 403: bara VQ2000). */
  ip65: boolean;
  subplate: boolean;
  /** Flöde C [dm³/(s·bar)] 1→4/2 metalltätning, standard (sida 375). */
  flow_c: number;
}
export const VQ_SERIES: VQSeries[] = [
  { code: "1", ip65: false, subplate: false, flow_c: 0.70, label_sv: "VQ1000 (ventilramp VV5Q11)" },
  { code: "2", ip65: true, subplate: true, flow_c: 1.0, label_sv: "VQ2000 (ventilramp VV5Q21 eller underplatta; IP65 möjlig)" },
];
export interface VQActuation extends VQValue {
  /** Bara gummitätning (sida 367: 4-läges dubbla 3-portsventiler A/B/C). */
  rubber_only: boolean;
  /** Extern pilot R går inte (sida 367, not 5). */
  no_external_pilot: boolean;
  /** Lägsta arbetstryck [MPa] metall-/gummitätning (sida 375). */
  min_mpa: [number | null, number];
}
export const VQ_ACTUATIONS: VQActuation[] = [
  { code: "1", rubber_only: false, no_external_pilot: false, min_mpa: [0.1, 0.15], label_sv: "2-läges, enkel magnet (monostabil)" },
  { code: "2", rubber_only: false, no_external_pilot: false, min_mpa: [0.1, 0.1], label_sv: "2-läges, dubbel magnet (bistabil)" },
  { code: "3", rubber_only: false, no_external_pilot: false, min_mpa: [0.1, 0.2], label_sv: "3-läges, stängt mittläge" },
  { code: "4", rubber_only: false, no_external_pilot: false, min_mpa: [0.1, 0.2], label_sv: "3-läges, avluftat mittläge" },
  { code: "5", rubber_only: false, no_external_pilot: false, min_mpa: [0.1, 0.2], label_sv: "3-läges, trycksatt mittläge" },
  { code: "A", rubber_only: true, no_external_pilot: true, min_mpa: [null, 0.15], label_sv: "4-läges dubbel 3-portsventil, två NC (bara gummitätning)" },
  { code: "B", rubber_only: true, no_external_pilot: true, min_mpa: [null, 0.15], label_sv: "4-läges dubbel 3-portsventil, två NO (bara gummitätning)" },
  { code: "C", rubber_only: true, no_external_pilot: true, min_mpa: [null, 0.15], label_sv: "4-läges dubbel 3-portsventil, NC + NO (bara gummitätning)" },
];
export const VQ_SEALS: VQValue[] = [
  { code: "0", label_sv: "Metalltätning" },
  { code: "1", label_sv: "Gummitätning" },
];
export interface VQFunctionSymbol {
  code: "B" | "K" | "N" | "R";
  dc_only: boolean;
  label_sv: string;
}
/** Tillvalssymbolerna (sida 367, "Function"); flera skrivs i bokstavsordning, B och K går inte ihop (not 4). */
export const VQ_FUNCTION_SYMBOLS: VQFunctionSymbol[] = [
  { code: "B", dc_only: true, label_sv: "snabb respons (0,95 W)" },
  { code: "K", dc_only: true, label_sv: "högtryck 1,0 MPa (0,95 W, bara metalltätning)" },
  { code: "N", dc_only: true, label_sv: "negativ common" },
  { code: "R", dc_only: false, label_sv: "extern pilot" },
];
export interface VQFunction extends VQValue {
  symbols: string[];
}
function kombinationer(): VQFunction[] {
  const out: VQFunction[] = [];
  const syms = VQ_FUNCTION_SYMBOLS;
  for (let mask = 1; mask < 1 << syms.length; mask++) {
    const valda = syms.filter((_, i) => mask & (1 << i));
    const koder = valda.map((s) => s.code);
    if (koder.includes("B") && koder.includes("K")) continue;
    out.push({ code: koder.join(""), symbols: koder, label_sv: valda.map((s) => `${s.code}: ${s.label_sv}`).join(" + ") });
  }
  return out;
}
export const VQ_FUNCTIONS: VQFunction[] = kombinationer();
export interface VQVoltage extends VQValue {
  ac: boolean;
  /** 200/220 V AC: bara F/L-kit (sida 367, not) och kräver W på underplattan (sida 403, not 2). */
  fl_kit_only: boolean;
}
export const VQ_VOLTAGES: VQVoltage[] = [
  { code: "5", ac: false, fl_kit_only: false, label_sv: "24 V DC" },
  { code: "6", ac: false, fl_kit_only: false, label_sv: "12 V DC" },
  { code: "1", ac: true, fl_kit_only: false, label_sv: "100 V AC 50/60 Hz" },
  { code: "3", ac: true, fl_kit_only: false, label_sv: "110 V AC 50/60 Hz" },
  { code: "2", ac: true, fl_kit_only: true, label_sv: "200 V AC 50/60 Hz (bara F/L-kit)" },
  { code: "4", ac: true, fl_kit_only: true, label_sv: "220 V AC 50/60 Hz (bara F/L-kit)" },
];
export const VQ_LIGHT: VQValue = { code: "E", label_sv: "Utan ljus/spärrdiod, opolär (standard är med; inte S-kit, inte med N)" };
export const VQ_OVERRIDES: VQValue[] = [
  { code: "B", label_sv: "Låsbar manöver, spårskruv (verktyg)" },
  { code: "C", label_sv: "Låsbar manöver, manuell" },
  { code: "D", label_sv: "Skjutlåsbar manöver, manuell" },
];
export const VQ_ENCLOSURE: VQValue = { code: "W", label_sv: "IP65 dammtät och spolsäker (bara VQ2000; T/L/S/M-kit eller underplatta)" };
export const VQ_PORT: VQValue = { code: "02", label_sv: "Underplatta 1/4 (enkelventil, bara VQ2000)" };
export const VQ_THREADS: VQValue[] = [
  { code: "N", label_sv: "NPT-gänga på underplattan" },
  { code: "T", label_sv: "NPTF-gänga på underplattan" },
  { code: "F", label_sv: "G-gänga på underplattan (standard är Rc)" },
];
export const VQ_CE: VQValue = { code: "Q", label_sv: "CE/UKCA-märkt (bara DC)" };
export const VQ_LIMITS = {
  max_mpa: 0.7,
  max_mpa_k: 1.0,
  temp_c: [-10, 50],
  impact_vibration: "150/30 m/s²",
  power_w: 0.4,
  power_w_bk: 0.95,
} as const;

export interface VQConfig {
  series: string;
  actuation: string;
  seal: string;
  func?: string;
  voltage: string;
  light?: string;
  override?: string;
  enclosure?: string;
  port?: string;
  thread?: string;
  ce?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

export function vqBuildCode(c: VQConfig): string | null {
  const s = VQ_SERIES.find((x) => x.code === c.series);
  const a = VQ_ACTUATIONS.find((x) => x.code === c.actuation);
  const v = VQ_VOLTAGES.find((x) => x.code === c.voltage);
  if (!s || !a || !v || !har(VQ_SEALS, c.seal)) return null;
  if (a.rubber_only && c.seal !== "1") return null;
  const fn = c.func ?? "";
  const f = fn ? VQ_FUNCTIONS.find((x) => x.code === fn) : undefined;
  if (fn && !f) return null;
  if (f) {
    if (f.symbols.includes("K") && c.seal !== "0") return null;
    if (f.symbols.includes("R") && a.no_external_pilot) return null;
    if (v.ac && f.symbols.some((k) => VQ_FUNCTION_SYMBOLS.find((y) => y.code === k)!.dc_only)) return null;
  }
  const light = c.light ?? "";
  if (light && light !== VQ_LIGHT.code) return null;
  if (light && f?.symbols.includes("N")) return null;
  const ov = c.override ?? "";
  if (ov && !har(VQ_OVERRIDES, ov)) return null;
  const enc = c.enclosure ?? "";
  if (enc && (enc !== VQ_ENCLOSURE.code || !s.ip65)) return null;
  const port = c.port ?? "";
  if (port && (port !== VQ_PORT.code || !s.subplate)) return null;
  const thread = c.thread ?? "";
  if (thread && (!har(VQ_THREADS, thread) || !port)) return null;
  if (port && v.fl_kit_only && !enc) return null;
  const ce = c.ce ?? "";
  if (ce && (ce !== VQ_CE.code || v.ac)) return null;
  const g1 = `VQ${s.code}${a.code}0${c.seal}${fn}`;
  const g2 = `${v.code}${light}${ov}${enc}1`;
  return [g1, g2, `${port}${thread}`, ce].filter((g, i) => i < 2 || g).join("-");
}

export function vqParseCode(raw: string): { config: VQConfig } | null {
  const k = raw.trim().toUpperCase();
  const re = /^VQ([12])([1-5ABC])0([01])([BKNR]{0,3})-([1-6])(E?)([BCD]?)(W?)1(?:-(02)([NTF])?)?(?:-(Q))?$/;
  const m = re.exec(k);
  if (!m) return null;
  const [, series, actuation, seal, fn, voltage, light, ov, enc, port, thread, ce] = m;
  const c: VQConfig = {
    series, actuation, seal, func: fn || undefined, voltage, light: light || undefined, override: ov || undefined, enclosure: enc || undefined,
    port: port || undefined, thread: thread || undefined, ce: ce || undefined,
  };
  if (vqBuildCode(c) !== k) return null;
  return { config: c };
}

export const VQ_ORDER_CODE_TEMPLATE = "VQ{series}{actuation}0{seal}{func}-{voltage}{light}{override}{enclosure}1-{port}{thread}-{ce}";

/**
 * SMC MHC2 — vinkelgripdon (två fingrar), standardtyp, ø10/16/20/25,
 * dubbel- eller enkelverkande, med eller utan magnetgivare.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Angular Type Air Gripper/Standard Type MHC2 Series" (katalogutdrag,
 *   9 sidor, katalogsidor 807–815). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-mhc2.pdf'.
 *     - How to Order och givartabell         sida 807
 *     - data, modelltabell, specialutförande  sida 808
 *     - gripkraft (diagram) och gripunkt      sida 809
 *     - konstruktion och material             sida 810
 *     - mått, portar, fästgängor              sida 811–812
 *     - givarmontering, hysteres, utstick     sida 813–814
 *     - montering, åtdragningsmoment          sida 815
 *
 * VAD FAMILJEN ÄR. MHC2 med två fingrar och öppningsvinkel 30° till −10°.
 * Det treffingriga radialgripdonet (MHS3) och parallellgripdonen (MHZ2 m.fl.)
 * är egna nycklar. Förkopplad kontakt ("pre-wired connector") står bara
 * som ○ i givartabellen och saknar kod i nyckeln; den ingår inte.
 *
 * KODENS FORM (sida 807):
 *
 *   MHC2 - 20 D - M9BW         nyckelns exempel: ø20, dubbelverkande, två D-M9BW
 *   MHC2 - 10 S                 ø10, enkelverkande (normalt öppen), utan givare
 *   MHC2 - 25 D - M9NWLS - X4   en D-M9NW med 3 m kabel, värmebeständig
 *   MHC2-{ø}{verkan}-{givare}{kabel}{antal}-{special}
 */

export const MHC2_SOURCE = {
  file: "smc-kat-mhc2.pdf",
  edition: "SMC MHC2 catalogue (catalogue pages 807–815)",
  title: "SMC Angular Type Air Gripper MHC2 Series",
  brand: "SMC",
} as const;

export interface MHC2Value {
  code: string;
  label_sv: string;
}

export interface MHC2Bore extends MHC2Value {
  bore_mm: number;
  /** Effektivt gripmoment [N·m] vid 0,5 MPa, dubbel-/enkelverkande (sida 808, not 1). */
  moment_nm: { D: number; S: number };
  /** Vikt utan givare [g], dubbel-/enkelverkande (sida 808, not 2). */
  weight_g: { D: number; S: number };
  /** Givarens hysteres, största värde [°] (sida 814). */
  hysteresis_deg: number;
  /** Gänga för fingerfästet (4 st genomgående) och kroppens fästgänga (sida 811–812, 815). */
  attachment_thread: string;
  body_thread: string;
  /** Port (sida 811–812). */
  port: string;
}
const bore = (code: string, moment: [number, number], weight: [number, number], hyst: number, att: string, body: string, port: string): MHC2Bore =>
  ({ code, bore_mm: Number(code), moment_nm: { D: moment[0], S: moment[1] }, weight_g: { D: weight[0], S: weight[1] }, hysteresis_deg: hyst, attachment_thread: att, body_thread: body, port, label_sv: `ø${code} mm` });
export const MHC2_BORES: MHC2Bore[] = [
  bore("10", [0.10, 0.070], [39, 39], 4, "M2.5 x 0.45", "M3 x 0.5", "M3 x 0.5"),
  bore("16", [0.39, 0.31], [91, 92], 3, "M3 x 0.5", "M4 x 0.7", "M5 x 0.8"),
  bore("20", [0.70, 0.54], [180, 183], 2, "M4 x 0.7", "M5 x 0.8", "M5 x 0.8"),
  bore("25", [1.36, 1.08], [311, 316], 2, "M5 x 0.8", "M6 x 1", "M5 x 0.8"),
];
export interface MHC2Action extends MHC2Value {
  /** Arbetstryck [MPa] (sida 808). */
  pressure_mpa: [number, number];
}
export const MHC2_ACTIONS: MHC2Action[] = [
  { code: "D", pressure_mpa: [0.1, 0.6], label_sv: "Dubbelverkande" },
  { code: "S", pressure_mpa: [0.25, 0.6], label_sv: "Enkelverkande, normalt öppen (yttre grepp)" },
];

export interface MHC2Switch extends MHC2Value {
  /** Kabellängder 0,5 m, 1 m (M), 3 m (L), 5 m (Z): S standard, O på beställning (sida 807). */
  leads: string;
  /** Vattentät typ: SMC garanterar inte vattentätheten på MHC2 (sida 807, ∗∗). */
  water_resistant: boolean;
  /** Elektrisk anslutning: I i linje, V vinkelrät. */
  entry: "I" | "V";
}
const sw = (code: string, label: string, leads: string, water = false): MHC2Switch[] => [
  { code, leads, water_resistant: water, entry: "I", label_sv: `D-${code}, ${label}` },
  { code: `${code}V`, leads, water_resistant: water, entry: "V", label_sv: `D-${code}V, ${label}, vinkelrät anslutning` },
];
/** Givartabellen sida 807: solid state, grommet, 24 V DC. */
export const MHC2_SWITCHES: MHC2Switch[] = [
  ...sw("M9N", "3-tråd NPN", "SSSO"),
  ...sw("M9P", "3-tråd PNP", "SSSO"),
  ...sw("M9B", "2-tråd", "SSSO"),
  ...sw("M9NW", "3-tråd NPN, tvåfärgsindikering", "SSSO"),
  ...sw("M9PW", "3-tråd PNP, tvåfärgsindikering", "SSSO"),
  ...sw("M9BW", "2-tråd, tvåfärgsindikering", "SSSO"),
  ...sw("M9NA", "3-tråd NPN, vattentät, tvåfärgsindikering", "OOSO", true),
  ...sw("M9PA", "3-tråd PNP, vattentät, tvåfärgsindikering", "OOSO", true),
  ...sw("M9BA", "2-tråd, vattentät, tvåfärgsindikering", "OOSO", true),
];
export const MHC2_LEADS: MHC2Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
export const MHC2_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3 };
export const MHC2_COUNT: MHC2Value = { code: "S", label_sv: "En givare (standard är två)" };

export interface MHC2Mto extends MHC2Value {
  /** -X50 saknar magnet: ingen givare kan användas (sida 807–808). */
  no_magnet?: boolean;
}
/** Specialutföranden sida 808. */
export const MHC2_MTO: MHC2Mto[] = [
  { code: "X4", label_sv: "-X4 Värmebeständig (100 °C)" },
  { code: "X5", label_sv: "-X5 Fluorgummitätning" },
  { code: "X50", no_magnet: true, label_sv: "-X50 Utan magnet" },
  { code: "X53", label_sv: "-X53 EPDM-tätning och fluorfett" },
  { code: "X56", label_sv: "-X56 Axiella portar" },
  { code: "X63", label_sv: "-X63 Fluorfett" },
  { code: "X64", label_sv: "-X64 Finger med sidogängat fäste" },
  { code: "X65", label_sv: "-X65 Finger med genomgående fästhål" },
  { code: "X79", label_sv: "-X79 Fett för livsmedelsmaskiner och fluorfett" },
  { code: "X79A", label_sv: "-X79A Fett för livsmedelsmaskiner" },
  { code: "X81A", label_sv: "-X81A Korrosionsskyddade fingrar" },
];

/** Data sida 808 och 813–815. */
export const MHC2_LIMITS = {
  max_pressure_mpa: 0.6,
  temp_c: [-10, 60],
  repeatability_mm: 0.01,
  max_frequency_cpm: 180,
  angle_deg: [30, -10],
  /** Givarfäste som medföljer när gripdonet beställs med givare (sida 807, not 2; sida 814). */
  switch_bracket: "BMG2-012",
  /** Riktvärde: gripkraft 10–20 gånger arbetsstyckets massa (sida 809). */
  grip_force_factor: [10, 20],
} as const;

export interface MHC2Config {
  bore: string;
  action: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

export function mhc2BuildCode(c: MHC2Config): string | null {
  const b = MHC2_BORES.find((x) => x.code === c.bore);
  const a = MHC2_ACTIONS.find((x) => x.code === c.action);
  if (!b || !a) return null;
  const mto = c.mto ?? "";
  const x = mto ? MHC2_MTO.find((y) => y.code === mto) : undefined;
  if (mto && !x) return null;
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = MHC2_SWITCHES.find((y) => y.code === sw);
    if (!g || x?.no_magnet) return null;
    if (lead && !har(MHC2_LEADS, lead)) return null;
    if (g.leads[MHC2_LEAD_INDEX[lead]] === "-") return null;
    if (count && count !== MHC2_COUNT.code) return null;
  } else if (lead || count) return null;
  return [`MHC2-${b.code}${a.code}`, `${sw}${lead}${count}`, mto].filter((g) => g).join("-");
}

export function mhc2ParseCode(raw: string): { config: MHC2Config } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...MHC2_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^MHC2-(10|16|20|25)([DS])(?:-(${givare})([MLZ])?(S)?)?(?:-(X[A-Z0-9]+))?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, bore, action, sw, lead, count, mto] = m;
  const c: MHC2Config = { bore, action, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined };
  if (mhc2BuildCode(c) !== k) return null;
  return { config: c };
}

export const MHC2_ORDER_CODE_TEMPLATE = "MHC2-{bore}{action}-{switch}{lead}{count}-{mto}";

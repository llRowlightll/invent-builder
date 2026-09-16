/**
 * SMC MHZ2 — parallellgripdon (två fingrar), standardtyp, ø6–40,
 * dubbelverkande eller enkelverkande (normalt öppen/stängd), med eller
 * utan magnetgivare.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Parallel Type Air Gripper MHZ Series" (kapitlet ur webbkatalogen,
 *   81 sidor, katalogsidor 469–549, hämtad 2026-09-16 från
 *   seriesList/?id=MHZ_2-E). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-mhz2-std.pdf'. Filen smc-kat-mhz2.pdf är
 *   kompaktserien JMHZ2 (ø8–20), en egen nyckel.
 *     - How to Order ø6 / ø10–25 / ø32–40     sida 496 / 497 / 498
 *     - data, modelltabell, kroppsalternativ,
 *       specialutförande                        sida 499
 *     - konstruktion och material               sida 501–503
 *     - kroppsalternativ E/W/K/M                sida 512–513
 *     - givarfästen                             sida 545
 *     - -X46 strypskruv, -X51 platta fingrar    sida 547–548
 *
 * VAD FAMILJEN ÄR. MHZ2 standard. Långslag MHZL2, med dammskydd MHZJ2,
 * ø6-varianterna MHZA2/MHZAJ2, renrumsutförandet 11-MHZ2 och kompaktserien
 * JMHZ2 är egna nycklar. Förkopplad kontakt saknar kod i nyckeln.
 *
 * KODENS FORM (sida 496–498):
 *
 *   MHZ2 - 16 D     - M9BW          nyckelns exempel: ø16, dubbelverkande, två D-M9BW
 *   MHZ2 - 10 D W                   ø10, axiella portar med ø4-koppling (sida 512)
 *   MHZ2 - 25 S N1 E - M9NWLS - X4  smal typ sidogängad, sidoportad, en D-M9NW 3 m, värmebeständig
 *   MHZ2-{ø}{verkan}{finger}{kropp}-{givare}{kabel}{antal}-{special}
 */

export const MHZ2_SOURCE = {
  file: "smc-kat-mhz2-std.pdf",
  edition: "SMC MHZ series catalogue chapter (catalogue pages 469–549, web catalogue 2026)",
  title: "SMC Parallel Type Air Gripper MHZ2 Series",
  brand: "SMC",
} as const;

export interface MHZ2Value {
  code: string;
  label_sv: string;
}

export interface MHZ2Bore extends MHZ2Value {
  bore_mm: number;
  /** Arbetstryck [MPa] dubbel-/enkelverkande (sida 499). */
  pressure_d: [number, number];
  pressure_s: [number, number];
  /** Gripkraft per finger [N] vid 0,5 MPa, L = 20 mm: yttre/inre grepp dubbelverkande, yttre NO, inre NC (sida 499). */
  force_d: [number, number];
  force_no: number;
  force_nc: number;
  /** Öppnings-/stängningsslag, båda sidor [mm]. */
  stroke_mm: number;
  /** Vikt utan givare [g]: dubbelverkande, enkelverkande (NO och NC lika). */
  weight_g: [number, number];
  repeatability_mm: number;
  max_frequency_cpm: number;
  /** Smal typ N/N1/N2 (MHQ2-kompatibel) och kroppsalternativen E/W/K/M finns (sida 497, 499). */
  narrow: boolean;
  body_options: boolean;
  /** Givarna D-F8N/F8P/F8B passar (sida 497: inte ø10). */
  f8_ok: boolean;
  /** Portgänga basutförande (sida 499). */
  port: string;
  /** Portgänga sidoportad E (sida 499). */
  port_e?: string;
}
const bore = (code: string, pd: [number, number], ps: [number, number], fd: [number, number], fno: number, fnc: number, stroke: number, w: [number, number], rep: number, cpm: number, narrow: boolean, body: boolean, f8: boolean, port: string, portE?: string): MHZ2Bore =>
  ({ code, bore_mm: Number(code), pressure_d: pd, pressure_s: ps, force_d: fd, force_no: fno, force_nc: fnc, stroke_mm: stroke, weight_g: w, repeatability_mm: rep, max_frequency_cpm: cpm, narrow, body_options: body, f8_ok: f8, port, port_e: portE, label_sv: `ø${code} mm` });
export const MHZ2_BORES: MHZ2Bore[] = [
  bore("6", [0.15, 0.7], [0.3, 0.7], [3.3, 6.1], 1.9, 3.7, 4, [27, 27], 0.01, 180, false, false, true, "M3 x 0.5"),
  bore("10", [0.2, 0.7], [0.35, 0.7], [11, 17], 7.1, 13, 4, [55, 55], 0.01, 180, true, true, false, "M5 x 0.8", "M3 x 0.5"),
  bore("16", [0.1, 0.7], [0.25, 0.7], [34, 45], 27, 38, 6, [115, 115], 0.01, 180, true, true, true, "M5 x 0.8", "M5 x 0.8"),
  bore("20", [0.1, 0.7], [0.25, 0.7], [42, 66], 33, 57, 10, [230, 235], 0.01, 180, true, true, true, "M5 x 0.8", "M5 x 0.8"),
  bore("25", [0.1, 0.7], [0.25, 0.7], [65, 104], 45, 83, 14, [420, 425], 0.01, 180, true, true, true, "M5 x 0.8", "M5 x 0.8"),
  bore("32", [0.1, 0.7], [0.25, 0.7], [158, 193], 131, 161, 22, [715, 760], 0.02, 60, false, false, true, "M5 x 0.8"),
  bore("40", [0.1, 0.7], [0.25, 0.7], [254, 318], 217, 267, 30, [1275, 1370], 0.02, 60, false, false, true, "M5 x 0.8"),
];
export const MHZ2_ACTIONS: MHZ2Value[] = [
  { code: "D", label_sv: "Dubbelverkande" },
  { code: "S", label_sv: "Enkelverkande, normalt öppen (yttre grepp)" },
  { code: "C", label_sv: "Enkelverkande, normalt stängd (inre grepp)" },
];
export interface MHZ2Finger extends MHZ2Value {
  /** Smal typ (MHQ2-kompatibel): bara ø10–25 (sida 497). */
  narrow: boolean;
}
export const MHZ2_FINGERS: MHZ2Finger[] = [
  { code: "1", narrow: false, label_sv: "Sidogängat fingerfäste" },
  { code: "2", narrow: false, label_sv: "Genomgående hål i öppnings-/stängningsriktningen" },
  { code: "3", narrow: false, label_sv: "Platta fingrar" },
  { code: "N", narrow: true, label_sv: "Smal typ, basutförande (MHQ2-kompatibel; ø10–25)" },
  { code: "N1", narrow: true, label_sv: "Smal typ, sidogängat fingerfäste (ø10–25)" },
  { code: "N2", narrow: true, label_sv: "Smal typ, genomgående hål (ø10–25)" },
];
export interface MHZ2Body extends MHZ2Value {
  /** Verkan alternativet finns för (sida 499, 512). */
  actions: string[];
}
/** Kroppsalternativ, ändtapp ("end boss"), bara ø10–25 (sida 499, 512–513). */
export const MHZ2_BODIES: MHZ2Body[] = [
  { code: "E", actions: ["D", "S", "C"], label_sv: "Ändtapp, sidoportad (ø10: M3, ø16–25: M5)" },
  { code: "W", actions: ["D"], label_sv: "Ändtapp, axiella portar med ø4-koppling för koaxialslang (bara dubbelverkande)" },
  { code: "K", actions: ["S", "C"], label_sv: "Ändtapp, axiell port med ø4-koppling (bara enkelverkande)" },
  { code: "M", actions: ["S", "C"], label_sv: "Ändtapp, axiell port M5 (bara enkelverkande)" },
];

export interface MHZ2Switch extends MHZ2Value {
  /** Kabellängder 0,5 m, 1 m (M), 3 m (L), 5 m (Z): S standard, O på beställning, - finns inte (sida 496–498). */
  leads: string;
  water_resistant: boolean;
  /** D-F8: bara vinkelrät anslutning, inte ø10, 10 mm från magnetiska material (sida 496–497). */
  f8: boolean;
}
const sw = (code: string, label: string, leads: string, water = false): MHZ2Switch[] => [
  { code, leads, water_resistant: water, f8: false, label_sv: `D-${code}, ${label}` },
  { code: `${code}V`, leads, water_resistant: water, f8: false, label_sv: `D-${code}V, ${label}, vinkelrät anslutning` },
];
const f8 = (code: string, label: string): MHZ2Switch => ({ code, leads: "S-SO", water_resistant: false, f8: true, label_sv: `D-${code}, ${label}, vinkelrät anslutning (inte ø10)` });
/** Givartabellen sida 496–498: solid state, grommet, 24 V DC. */
export const MHZ2_SWITCHES: MHZ2Switch[] = [
  ...sw("M9N", "3-tråd NPN", "SSSO"),
  f8("F8N", "3-tråd NPN, kort"),
  ...sw("M9P", "3-tråd PNP", "SSSO"),
  f8("F8P", "3-tråd PNP, kort"),
  ...sw("M9B", "2-tråd", "SSSO"),
  f8("F8B", "2-tråd, kort"),
  ...sw("M9NW", "3-tråd NPN, tvåfärgsindikering", "SSSO"),
  ...sw("M9PW", "3-tråd PNP, tvåfärgsindikering", "SSSO"),
  ...sw("M9BW", "2-tråd, tvåfärgsindikering", "SSSO"),
  ...sw("M9NA", "3-tråd NPN, vattentät, tvåfärgsindikering", "OOSO", true),
  ...sw("M9PA", "3-tråd PNP, vattentät, tvåfärgsindikering", "OOSO", true),
  ...sw("M9BA", "2-tråd, vattentät, tvåfärgsindikering", "OOSO", true),
];
export const MHZ2_LEADS: MHZ2Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
export const MHZ2_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3 };
export interface MHZ2Count extends MHZ2Value {
  /** "n st" finns bara för ø10–40 (sida 497–498); ø6 har Nil/S (sida 496). */
  n: boolean;
}
export const MHZ2_COUNTS: MHZ2Count[] = [
  { code: "S", n: false, label_sv: "En givare (standard är två)" },
  { code: "3", n: true, label_sv: "Tre givare (n st; ø10–40)" },
  { code: "4", n: true, label_sv: "Fyra givare (n st; ø10–40)" },
];

export interface MHZ2Mto extends MHZ2Value {
  no_magnet?: boolean;
  /** Individuella specifikationer sida 547–548: bara ø10–25. */
  bores?: string[];
  actions?: string[];
  /** -X46: kroppsalternativ Nil/E/W; -X51: fingerläge bara Nil eller N. */
  bodies?: string[];
  fingers?: string[];
}
/** Specialutföranden sida 499 och de individuella sida 547–548. */
export const MHZ2_MTO: MHZ2Mto[] = [
  { code: "X4", label_sv: "-X4 Värmebeständig (100 °C)" },
  { code: "X5", label_sv: "-X5 Fluorgummitätning" },
  { code: "X7", label_sv: "-X7 Fjäderassistans i stängningsriktningen" },
  { code: "X12", label_sv: "-X12 Fjäderassistans i öppningsriktningen" },
  { code: "X46", bores: ["10", "16", "20", "25"], actions: ["D"], bodies: ["", "E", "W"], label_sv: "-X46 Inbyggd strypskruv för fingerhastigheten (ø10–25, dubbelverkande)" },
  { code: "X50", no_magnet: true, label_sv: "-X50 Utan magnet" },
  { code: "X51", bores: ["10", "16", "20", "25"], fingers: ["", "N"], label_sv: "-X51 Platta fingrar kompatibla med MHQG2 (Nil) eller MHQ2 (N) (ø10–25)" },
  { code: "X53", label_sv: "-X53 EPDM-tätning och fluorfett" },
  { code: "X56", label_sv: "-X56 Axiella portar" },
  { code: "X63", label_sv: "-X63 Fluorfett" },
  { code: "X79", label_sv: "-X79 Fett för livsmedelsmaskiner och fluorfett" },
  { code: "X79A", label_sv: "-X79A Fett för livsmedelsmaskiner" },
  { code: "X81A", label_sv: "-X81A Korrosionsskyddade fingrar" },
  { code: "X81B", label_sv: "-X81B Korrosionsskyddade fingrar och styrning" },
];

export const MHZ2_LIMITS = {
  max_pressure_mpa: 0.7,
  temp_c: [-10, 60],
  switch_bracket: "BMG2-012",
  /** Riktvärde: gripkraft 10–20 gånger arbetsstyckets massa (sida 499, diagram). */
  grip_force_factor: [10, 20],
} as const;

export interface MHZ2Config {
  bore: string;
  action: string;
  finger?: string;
  body?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

export function mhz2BuildCode(c: MHZ2Config): string | null {
  const b = MHZ2_BORES.find((x) => x.code === c.bore);
  const a = MHZ2_ACTIONS.find((x) => x.code === c.action);
  if (!b || !a) return null;
  const finger = c.finger ?? "";
  if (finger) {
    const f = MHZ2_FINGERS.find((x) => x.code === finger);
    if (!f || (f.narrow && !b.narrow)) return null;
  }
  const body = c.body ?? "";
  if (body) {
    const k = MHZ2_BODIES.find((x) => x.code === body);
    if (!k || !b.body_options || !k.actions.includes(a.code)) return null;
  }
  const mto = c.mto ?? "";
  const x = mto ? MHZ2_MTO.find((y) => y.code === mto) : undefined;
  if (mto && !x) return null;
  if (x) {
    if (x.bores && !x.bores.includes(b.code)) return null;
    if (x.actions && !x.actions.includes(a.code)) return null;
    if (x.bodies && !x.bodies.includes(body)) return null;
    if (x.fingers && !x.fingers.includes(finger)) return null;
  }
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = MHZ2_SWITCHES.find((y) => y.code === sw);
    if (!g || x?.no_magnet) return null;
    if (g.f8 && !b.f8_ok) return null;
    if (lead && !har(MHZ2_LEADS, lead)) return null;
    if (g.leads[MHZ2_LEAD_INDEX[lead]] === "-") return null;
    if (count) {
      const n = MHZ2_COUNTS.find((y) => y.code === count);
      if (!n || (n.n && b.code === "6")) return null;
    }
  } else if (lead || count) return null;
  return [`MHZ2-${b.code}${a.code}${finger}${body}`, `${sw}${lead}${count}`, mto].filter((g) => g).join("-");
}

export function mhz2ParseCode(raw: string): { config: MHZ2Config } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...MHZ2_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^MHZ2-(6|10|16|20|25|32|40)([DSC])(N1|N2|N|1|2|3)?([EWKM])?(?:-(${givare})([MLZ])?(S|3|4)?)?(?:-(X[A-Z0-9]+))?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, bore, action, finger, body, sw, lead, count, mto] = m;
  const c: MHZ2Config = {
    bore, action, finger: finger || undefined, body: body || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined,
  };
  if (mhz2BuildCode(c) !== k) return null;
  return { config: c };
}

export const MHZ2_ORDER_CODE_TEMPLATE = "MHZ2-{bore}{action}{finger}{body}-{switch}{lead}{count}-{mto}";

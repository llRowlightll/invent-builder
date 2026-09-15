/**
 * SMC CY1 — magnetkopplade kolvstångslösa cylindrar, slidtyperna.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Fyra serier ur tre katalogutdrag, alla i knowledge_chunks:
 *     CY1S  "Magnetically Coupled Rodless Cylinder, Slider Type: Slide Bearing"
 *           source_file 'smc-kat-cy1s.pdf' (28 sidor, katalogsidor 1197–1224)
 *           How to Order sida 1214, data/slag/special sida 1215,
 *           givarmontering sida 1220, specialutföranden sida 1221–1222.
 *     CY1L  "Slider Type: Ball Bushing Bearing" och
 *     CY1H  "Linear Guide Type" — båda i 'smc-kat-cy1.pdf' (33 sidor,
 *           katalogsidor 1225–1253). CY1L: How to Order 1230, data 1231,
 *           givarmontering 1234. CY1H: How to Order 1242, data 1243,
 *           givarmontering 1249. Specialutföranden för båda: 1252–1253.
 *     CY1F  "Low Profile Guide Type" — 'smc-kat-cy1f.pdf' (20 sidor,
 *           katalogsidor 1255–1274). How to Order 1265, data 1266,
 *           givarmontering 1270.
 *
 * VARFÖR FYRA FAMILJER. Familjen 'cy1r' med produktraden SMC-CY1R var
 * påhittad: strängen CY1R finns inte i någon av katalogerna (SMC:s
 * nuvarande serier är CY1S, CY1L, CY1H och CY1F; direktmonterade
 * CY3B/CY3R är ett eget kapitel som inte är hämtat). De fyra nycklarna
 * har olika positioner (rörsymbol, hållkraft, styrning, anslutningssida),
 * så de blir fyra familjer ur en modell — samma mönster som OSP-E.
 *
 * KODERNAS FORM:
 *
 *   CY1S G 25 TN - 300 B  Z - M9BW L S - X431     (sida 1214)
 *   CY1L   25 TN H - 300 BS  - J79W L S - X168     (sida 1230)
 *   CY1H T 32 TN   - 500 B   - Y7BW Z S - XB22     (sida 1242)
 *   CY1F   25 TN R - 300 AL  - M9BW L S - XB10     (sida 1265)
 *
 * Alla har inbyggd magnet: givaren kräver inget magnetval. Standardslagen
 * står i tabell per borrning; mellanslag tillverkas i 1 mm-steg. För CY1S
 * och CY1L "på beställning" (varning), för CY1H och CY1F med suffixet
 * -XB10 (inom standardområdet) eller -XB11 (över det, upp till max).
 */

export type CY1Series = "cy1s" | "cy1l" | "cy1h" | "cy1f";

export interface CY1Value {
  code: string;
  label_sv: string;
}

export interface CY1Bore extends CY1Value {
  bore_mm: number;
  /** Standardslag (mm), katalogens tabell. */
  standard: number[];
  /** Största tillverkbara slag (mm). */
  max_mm: number;
  /** Magnetisk hållkraft (N); CY1L: typ H. */
  holding_n: number;
  /** CY1L typ L (låg hållkraft), 0 = finns inte (sida 1231). */
  holding_l_n?: number;
  /** CY1H: enaxlig styrning finns (sida 1243). */
  one_axis?: boolean;
  /** CY1H: tvåaxlig styrning T, med egna standardslag (sida 1243). */
  two_axis?: { standard: number[]; max_mm: number };
}

const st = (from: number, to: number, step: number, ...extra: number[]) => {
  const out: number[] = [];
  for (let s = from; s <= to; s += step) out.push(s);
  return [...out, ...extra];
};
const bore = (code: string, standard: number[], max_mm: number, holding_n: number, extra: Partial<CY1Bore> = {}): CY1Bore =>
  ({ code, bore_mm: Number(code), standard, max_mm, holding_n, label_sv: `ø${code} mm`, ...extra });

/** CY1S sida 1215 och CY1L sida 1231 har samma standardslag och maxslag. */
const SLIDER_BORES = (holdingL: number[]): CY1Bore[] => [
  bore("6", st(50, 200, 50), 300, 19.6, { holding_l_n: holdingL[0] }),
  bore("10", st(50, 300, 50), 500, 53.9, { holding_l_n: holdingL[1] }),
  bore("15", st(50, 500, 50), 750, 137, { holding_l_n: holdingL[2] }),
  bore("20", st(100, 500, 50, 600, 700, 800), 1000, 231, { holding_l_n: holdingL[3] }),
  bore("25", st(100, 500, 50, 600, 700, 800), 1500, 363, { holding_l_n: holdingL[4] }),
  bore("32", st(100, 500, 50, 600, 700, 800), 1500, 588, { holding_l_n: holdingL[5] }),
  bore("40", st(100, 500, 50, 600, 700, 800, 900, 1000), 1500, 922, { holding_l_n: holdingL[6] }),
];

export interface CY1Switch extends CY1Value {
  kind: "reed" | "solid";
  /** Kabellängder i seriens ordning (se lead_index): S standard, O på beställning, - finns inte. */
  leads: string;
  /** CY1F sida 1270: minsta slag med en givare respektive två (mönster 3 / mönster 1–2). */
  min_one_mm?: number;
  min_two_mm?: [number, number];
}
const sw = (code: string, label: string, leads: string, kind: "reed" | "solid" = "solid", min?: Min): CY1Switch =>
  ({ code, kind, leads, label_sv: label, min_one_mm: min?.one, min_two_mm: min?.two });

/** D-M9/D-A9-familjen (CY1S sida 1214, CY1F sida 1265); ordningen 0,5 m, 1 m (M), 3 m (L), 5 m (Z). */
type Min = { one: number; two: [number, number] };
/**
 * CY1F sida 1270, minsta slag: en givare 5 mm (D-A9, D-M9) eller 10 mm
 * (D-M9□W, D-M9□A); två givare med monteringsmönster 3 respektive 1–2.
 */
const CY1F_MIN: Record<string, Min> = {
  m9: { one: 5, two: [12, 32] },
  m9v: { one: 5, two: [12, 20] },
  m9w: { one: 10, two: [12, 32] },
  m9wv: { one: 10, two: [12, 20] },
  m9a: { one: 10, two: [12, 20] },
  a9: { one: 5, two: [20, 35] },
  a9v: { one: 5, two: [20, 22] },
};
const M9_SWITCHES = (min = false): CY1Switch[] => {
  const mm = (k: keyof typeof CY1F_MIN) => (min ? CY1F_MIN[k] : undefined);
  return [
    sw("M9N", "D-M9N, 3-tråd NPN, rak", "SSSO", "solid", mm("m9")), sw("M9NV", "D-M9NV, 3-tråd NPN, vinklad", "SSSO", "solid", mm("m9v")),
    sw("M9P", "D-M9P, 3-tråd PNP, rak", "SSSO", "solid", mm("m9")), sw("M9PV", "D-M9PV, 3-tråd PNP, vinklad", "SSSO", "solid", mm("m9v")),
    sw("M9B", "D-M9B, 2-tråd, rak", "SSSO", "solid", mm("m9")), sw("M9BV", "D-M9BV, 2-tråd, vinklad", "SSSO", "solid", mm("m9v")),
    sw("M9NW", "D-M9NW, NPN, tvåfärgsindikering, rak", "SSSO", "solid", mm("m9w")), sw("M9NWV", "D-M9NWV, NPN, tvåfärgsindikering, vinklad", "SSSO", "solid", mm("m9wv")),
    sw("M9PW", "D-M9PW, PNP, tvåfärgsindikering, rak", "SSSO", "solid", mm("m9w")), sw("M9PWV", "D-M9PWV, PNP, tvåfärgsindikering, vinklad", "SSSO", "solid", mm("m9wv")),
    sw("M9BW", "D-M9BW, 2-tråd, tvåfärgsindikering, rak", "SSSO", "solid", mm("m9w")), sw("M9BWV", "D-M9BWV, 2-tråd, tvåfärgsindikering, vinklad", "SSSO", "solid", mm("m9wv")),
    sw("M9NA", "D-M9NA, NPN, vattentät, rak", "OOSO", "solid", mm("m9a")), sw("M9NAV", "D-M9NAV, NPN, vattentät, vinklad", "OOSO", "solid", mm("m9a")),
    sw("M9PA", "D-M9PA, PNP, vattentät, rak", "OOSO", "solid", mm("m9a")), sw("M9PAV", "D-M9PAV, PNP, vattentät, vinklad", "OOSO", "solid", mm("m9a")),
    sw("M9BA", "D-M9BA, 2-tråd, vattentät, rak", "OOSO", "solid", mm("m9a")), sw("M9BAV", "D-M9BAV, 2-tråd, vattentät, vinklad", "OOSO", "solid", mm("m9a")),
    sw("A96", "D-A96, reed 3-tråd, rak", "SSSS", "reed", mm("a9")), sw("A96V", "D-A96V, reed 3-tråd, vinklad", "SSSS", "reed", mm("a9v")),
    sw("A93", "D-A93, reed 2-tråd, rak", "SSSS", "reed", mm("a9")), sw("A93V", "D-A93V, reed 2-tråd, vinklad", "SSSS", "reed", mm("a9v")),
    sw("A90", "D-A90, reed utan indikering, rak", "SSSS", "reed", mm("a9")), sw("A90V", "D-A90V, reed utan indikering, vinklad", "SSSS", "reed", mm("a9v")),
  ];
};
const M9_LEADS: CY1Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
const M9_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3 };

/** D-F7/J7/A7/A8-familjen (CY1L sida 1230); ordningen 0,5 m, 3 m (L), 5 m (Z), ingen kabel (N). */
const F7_SWITCHES: CY1Switch[] = [
  sw("F79", "D-F79, 3-tråd NPN, rak", "SSO-"), sw("F7NV", "D-F7NV, 3-tråd NPN, vinklad", "SSO-"),
  sw("F7P", "D-F7P, 3-tråd PNP, rak", "SSO-"), sw("F7PV", "D-F7PV, 3-tråd PNP, vinklad", "SSO-"),
  sw("J79", "D-J79, 2-tråd, rak", "SSO-"), sw("F7BV", "D-F7BV, 2-tråd, vinklad", "SSO-"),
  sw("J79C", "D-J79C, 2-tråd, kontakt (vinklad)", "SSSS"),
  sw("F79W", "D-F79W, NPN, tvåfärgsindikering, rak", "SSO-"), sw("F7NWV", "D-F7NWV, NPN, tvåfärgsindikering, vinklad", "SSO-"),
  sw("F7PW", "D-F7PW, PNP, tvåfärgsindikering, rak", "SSO-"),
  sw("J79W", "D-J79W, 2-tråd, tvåfärgsindikering, rak", "SSO-"), sw("F7BWV", "D-F7BWV, 2-tråd, tvåfärgsindikering, vinklad", "SSO-"),
  sw("F7BA", "D-F7BA, 2-tråd, vattentät, rak", "-SO-"), sw("F7BAV", "D-F7BAV, 2-tråd, vattentät, vinklad", "-SO-"),
  sw("F79F", "D-F79F, 4-tråd NPN med diagnosutgång, rak", "SSO-"),
  sw("A76H", "D-A76H, reed 3-tråd, rak", "SS--", "reed"),
  sw("A72H", "D-A72H, reed 200 V, rak", "SS--", "reed"), sw("A72", "D-A72, reed 200 V, vinklad", "SS--", "reed"),
  sw("A73H", "D-A73H, reed 100 V, rak", "SSS-", "reed"), sw("A73", "D-A73, reed 100 V, vinklad", "SSS-", "reed"),
  sw("A80H", "D-A80H, reed utan indikering, rak", "SS--", "reed"), sw("A80", "D-A80, reed utan indikering, vinklad", "SS--", "reed"),
  sw("A73C", "D-A73C, reed 100 V, kontakt (vinklad)", "SSSS", "reed"),
  sw("A80C", "D-A80C, reed utan indikering, kontakt (vinklad)", "SSSS", "reed"),
];
const F7_LEADS: CY1Value[] = [
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
  { code: "N", label_sv: "Utan kabel (bara kontaktgivarna J79C, A73C och A80C)" },
];
const F7_LEAD_INDEX: Record<string, number> = { "": 0, L: 1, Z: 2, N: 3 };

/** D-Y5/Y6/Y7/Z7/Z8-familjen (CY1H sida 1242); ordningen 0,5 m, 3 m (L), 5 m (Z). */
const Y7_SWITCHES: CY1Switch[] = [
  sw("Y59A", "D-Y59A, 3-tråd NPN, rak", "SSO"), sw("Y69A", "D-Y69A, 3-tråd NPN, vinklad", "SSO"),
  sw("Y7P", "D-Y7P, 3-tråd PNP, rak", "SSO"), sw("Y7PV", "D-Y7PV, 3-tråd PNP, vinklad", "SSO"),
  sw("Y59B", "D-Y59B, 2-tråd, rak", "SSO"), sw("Y69B", "D-Y69B, 2-tråd, vinklad", "SSO"),
  sw("Y7NW", "D-Y7NW, NPN, tvåfärgsindikering, rak", "SSO"), sw("Y7NWV", "D-Y7NWV, NPN, tvåfärgsindikering, vinklad", "SSO"),
  sw("Y7PW", "D-Y7PW, PNP, tvåfärgsindikering, rak", "SSO"), sw("Y7PWV", "D-Y7PWV, PNP, tvåfärgsindikering, vinklad", "SSO"),
  sw("Y7BW", "D-Y7BW, 2-tråd, tvåfärgsindikering, rak", "SSO"), sw("Y7BWV", "D-Y7BWV, 2-tråd, tvåfärgsindikering, vinklad", "SSO"),
  sw("Y7BA", "D-Y7BA, 2-tråd, vattentät, rak", "-SO"),
  sw("Z76", "D-Z76, reed 3-tråd", "SS-", "reed"),
  sw("Z73", "D-Z73, reed 2-tråd 100 V", "SSS", "reed"),
  sw("Z80", "D-Z80, reed utan indikering", "SS-", "reed"),
];
const Y7_LEADS: CY1Value[] = [
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
const Y7_LEAD_INDEX: Record<string, number> = { "": 0, L: 1, Z: 2 };

export const CY1_COUNTS: CY1Value[] = [
  { code: "S", label_sv: "En givare (standard är två)" },
  { code: "3", label_sv: "Tre givare" },
];
export const CY1_PORTS: CY1Value[] = [
  { code: "TN", label_sv: "Portgänga NPT (standard är Rc)" },
  { code: "TF", label_sv: "Portgänga G (standard är Rc)" },
];

export interface CY1Mto extends CY1Value {
  /** Borrningar utförandet finns för; saknas = alla. */
  bores?: string[];
  /** Kräver stötdämpare (justering B eller BS): -XB22 byter dem till RJ-serien. */
  needs_absorber?: boolean;
  /** CY1S -X116: bara dubbelsidig anslutning (sida 1221, not 1). */
  not_centralized?: boolean;
  /** Slagpolicyn: -XB10 mellanslag inom standardområdet, -XB11 över det. */
  stroke?: "intermediate" | "long";
}

export interface CY1SeriesDef {
  slug: CY1Series;
  prefix: string;
  name: string;
  title_sv: string;
  title_en: string;
  description_en: string;
  source: { file: string; title: string; pages: string; key_page: number; spec_page: number; mounting_page: number; mto_page: string };
  bores: CY1Bore[];
  /** CY1S: G centraliserad anslutning (valfri). */
  piping?: CY1Value;
  /** CY1L: hållkraft H/L (obligatorisk). */
  holding?: CY1Value[];
  /** CY1H: T tvåaxlig styrning (valfri; Nil = enaxlig). */
  guide?: CY1Value;
  /** CY1F: anslutningssida R/L (obligatorisk). */
  dirs?: CY1Value[];
  /** Borrningar med gängvalet TN/TF (övriga har M-gänga). */
  port_bores: string[];
  adjust: CY1Value[];
  adjust_title_sv: string;
  adjust_title_en: string;
  /** Fast tecken efter justeringen (CY1S: Z). */
  fixed_suffix: string;
  switches: CY1Switch[];
  leads: CY1Value[];
  lead_index: Record<string, number>;
  mto: CY1Mto[];
  /** Mellanslag: "warn" tillverkas på beställning, "xb" kräver -XB10/-XB11. */
  stroke_policy: "warn" | "xb";
  /** Minsta slag utan givare eller med en (CY1S sida 1215: 15). */
  min_stroke_mm: number;
  /** Minsta slag med två givare; CY1S: 25, eller 15 med -X431 (sida 1215). */
  min_two_switches_mm: number;
  limits: { pressure_mpa: [number, number]; temp_c: [number, number]; speed_mm_s: [number, number] };
  template: string;
}

const SLIDER_ADJUST_S: CY1Value[] = [
  { code: "B", label_sv: "Stötdämpare och justerbult i båda ändar (i stället för gummibuffertar)" },
  { code: "BS", label_sv: "Stötdämpare och justerbult på plåt A, gummibuffert på plåt B/C" },
];
const SLIDER_ADJUST_L: CY1Value[] = [
  { code: "B", label_sv: "Stötdämpare i båda ändar (2 st)" },
  { code: "BS", label_sv: "Stötdämpare på plåt A-sidan (monterad på A-sidan vid leverans)" },
];

export const CY1_SERIES: Record<CY1Series, CY1SeriesDef> = {
  cy1s: {
    slug: "cy1s",
    prefix: "CY1S",
    name: "CY1S",
    title_sv: "Magnetkopplad kolvstångslös cylinder, slidtyp med glidlager ø6–40",
    title_en: "Magnetically coupled rodless cylinder, slider type with slide bearing ø6–40",
    description_en: "SMC CY1S magnetically coupled rodless cylinder, slider type with slide bearing, ø6–40 mm, bilateral or centralized piping, rubber bumpers or shock absorbers, strokes up to 1500 mm.",
    source: { file: "smc-kat-cy1s.pdf", title: "SMC Magnetically Coupled Rodless Cylinder CY1S Series", pages: "1197–1224", key_page: 1214, spec_page: 1215, mounting_page: 1220, mto_page: "1221–1222" },
    bores: SLIDER_BORES([0, 0, 0, 0, 0, 0, 0]),
    piping: { code: "G", label_sv: "Centraliserad anslutning, båda portarna på plåt A (standard är en port per plåt)" },
    port_bores: ["20", "25", "32", "40"],
    adjust: SLIDER_ADJUST_S,
    adjust_title_sv: "Ändstopp (standard är gummibuffert i båda ändar)",
    adjust_title_en: "Stopper type (rubber bumper both ends is standard)",
    fixed_suffix: "Z",
    switches: M9_SWITCHES(),
    leads: M9_LEADS,
    lead_index: M9_LEAD_INDEX,
    mto: [
      { code: "X116", bores: ["25", "32", "40"], not_centralized: true, label_sv: "-X116 Lufthydraulisk, turbinolja 15–300 mm/s (ø25–40, bara dubbelsidig anslutning)" },
      { code: "X168", bores: ["20", "25", "32", "40"], label_sv: "-X168 Helicoil-gängor i sliden (ø20–40)" },
      { code: "X210", label_sv: "-X210 Osmord utsida, utan dammtätning" },
      { code: "X322", bores: ["15", "20", "25", "32", "40"], label_sv: "-X322 Hårdkromat cylinderrör (ø15–40)" },
      { code: "X324", bores: ["10", "15", "20", "25", "32", "40"], label_sv: "-X324 Osmord utsida, med filtdammtätning (ø10–40)" },
      { code: "X431", label_sv: "-X431 Givarskenor på båda sidor (2 st), för korta slag med två givare" },
      { code: "X2423", label_sv: "-X2423 Gängade monteringshål i plåtarna" },
      { code: "XB9", label_sv: "-XB9 Låg hastighet 15–50 mm/s" },
      { code: "XB13", label_sv: "-XB13 Mycket låg hastighet 7–50 mm/s" },
    ],
    stroke_policy: "warn",
    min_stroke_mm: 15,
    min_two_switches_mm: 25,
    limits: { pressure_mpa: [0.18, 0.7], temp_c: [-10, 60], speed_mm_s: [50, 400] },
    template: "CY1S{piping}{bore}{port}-{stroke_mm}{adjust}Z-{switch}{lead}{count}-{mto}",
  },
  cy1l: {
    slug: "cy1l",
    prefix: "CY1L",
    name: "CY1L",
    title_sv: "Magnetkopplad kolvstångslös cylinder, slidtyp med kulbussning ø6–40",
    title_en: "Magnetically coupled rodless cylinder, slider type with ball bushing bearing ø6–40",
    description_en: "SMC CY1L magnetically coupled rodless cylinder, slider type with ball bushing bearing, ø6–40 mm, high or low magnetic holding force, adjusting bolts or shock absorbers, strokes up to 1500 mm.",
    source: { file: "smc-kat-cy1.pdf", title: "SMC Magnetically Coupled Rodless Cylinder CY1L Series", pages: "1225–1236", key_page: 1230, spec_page: 1231, mounting_page: 1234, mto_page: "1252–1253" },
    bores: SLIDER_BORES([0, 0, 81.4, 154, 221, 358, 569]),
    holding: [
      { code: "H", label_sv: "Hög magnetisk hållkraft" },
      { code: "L", label_sv: "Låg magnetisk hållkraft (ø15–40)" },
    ],
    port_bores: ["20", "25", "32", "40"],
    adjust: SLIDER_ADJUST_L,
    adjust_title_sv: "Justering (standard är justerbult)",
    adjust_title_en: "Adjustment type (adjusting bolt is standard)",
    fixed_suffix: "",
    switches: F7_SWITCHES,
    leads: F7_LEADS,
    lead_index: F7_LEAD_INDEX,
    mto: [
      { code: "X116", bores: ["25", "32", "40"], label_sv: "-X116 Hydraulisk, turbinolja 15–300 mm/s (ø25–40)" },
      { code: "X168", bores: ["20", "25", "32", "40"], label_sv: "-X168 Helicoil-gängor i sliden (ø20–40)" },
      { code: "X322", bores: ["15", "20", "25", "32", "40"], label_sv: "-X322 Hårdkromat cylinderrör (ø15–40)" },
      { code: "X431", label_sv: "-X431 Givarskenor på båda sidor (2 st), för korta slag med två givare" },
      { code: "XB9", label_sv: "-XB9 Låg hastighet 15–50 mm/s" },
      { code: "XB13", label_sv: "-XB13 Mycket låg hastighet 7–50 mm/s" },
      { code: "XB22", bores: ["6", "10", "15", "20", "25"], needs_absorber: true, label_sv: "-XB22 Mjuka stötdämpare RJ-serien (ø6–25, med B eller BS)" },
    ],
    stroke_policy: "warn",
    min_stroke_mm: 1,
    min_two_switches_mm: 50,
    limits: { pressure_mpa: [0.18, 0.7], temp_c: [-10, 60], speed_mm_s: [50, 500] },
    template: "CY1L{bore}{port}{holding}-{stroke_mm}{adjust}-{switch}{lead}{count}-{mto}",
  },
  cy1h: {
    slug: "cy1h",
    prefix: "CY1H",
    name: "CY1H",
    title_sv: "Magnetkopplad kolvstångslös cylinder med linjärstyrning ø10–32",
    title_en: "Magnetically coupled rodless cylinder, linear guide type ø10–32",
    description_en: "SMC CY1H magnetically coupled rodless cylinder with linear guide, ø10–32 mm, one or two guide axes, adjusting bolts or shock absorbers, strokes up to 1500 mm.",
    source: { file: "smc-kat-cy1.pdf", title: "SMC Magnetically Coupled Rodless Cylinder CY1H Series", pages: "1237–1253", key_page: 1242, spec_page: 1243, mounting_page: 1249, mto_page: "1252" },
    bores: [
      bore("10", [100, 200, 300], 500, 53.9, { one_axis: true }),
      bore("15", st(100, 500, 100), 750, 137, { one_axis: true }),
      bore("20", st(100, 600, 100), 1000, 231, { one_axis: true }),
      bore("25", st(100, 600, 100, 800), 1200, 363, { one_axis: true, two_axis: { standard: st(100, 600, 100, 800, 1000), max_mm: 1500 } }),
      bore("32", st(100, 600, 100, 800, 1000), 1500, 588, { two_axis: { standard: st(100, 600, 100, 800, 1000), max_mm: 1500 } }),
    ],
    guide: { code: "T", label_sv: "Tvåaxlig linjärstyrning (ø25 och 32; standard är enaxlig ø10–25)" },
    port_bores: ["20", "25", "32"],
    adjust: [
      { code: "B", label_sv: "Stötdämpare i båda ändar (2 st)" },
      { code: "BS", label_sv: "Stötdämpare på portsidan (1 st)" },
    ],
    adjust_title_sv: "Justering (standard är justerbult)",
    adjust_title_en: "Adjustment type (adjusting bolt is standard)",
    fixed_suffix: "",
    switches: Y7_SWITCHES,
    leads: Y7_LEADS,
    lead_index: Y7_LEAD_INDEX,
    mto: [
      { code: "X168", bores: ["20", "25", "32"], label_sv: "-X168 Helicoil-gängor i sliden (ø20–32)" },
      { code: "XB10", stroke: "intermediate", label_sv: "-XB10 Mellanslag inom standardområdet (egen kropp)" },
      { code: "XB11", stroke: "long", label_sv: "-XB11 Långt slag, över största standardslaget upp till max" },
      { code: "XB22", bores: ["10", "15", "20", "25"], needs_absorber: true, label_sv: "-XB22 Mjuka stötdämpare RJ-serien (ø10–25, med B eller BS)" },
    ],
    stroke_policy: "xb",
    min_stroke_mm: 1,
    min_two_switches_mm: 50,
    limits: { pressure_mpa: [0.2, 0.7], temp_c: [-10, 60], speed_mm_s: [70, 500] },
    template: "CY1H{guide}{bore}{port}-{stroke_mm}{adjust}-{switch}{lead}{count}-{mto}",
  },
  cy1f: {
    slug: "cy1f",
    prefix: "CY1F",
    name: "CY1F",
    title_sv: "Magnetkopplad kolvstångslös cylinder, låg styrd typ ø10–25",
    title_en: "Magnetically coupled rodless cylinder, low profile guide type ø10–25",
    description_en: "SMC CY1F magnetically coupled rodless cylinder, low profile guide type, ø10–25 mm, concentrated piping on the right or left, built-in shock absorbers, strokes up to 1200 mm.",
    source: { file: "smc-kat-cy1f.pdf", title: "SMC Magnetically Coupled Rodless Cylinder CY1F Series", pages: "1255–1274", key_page: 1265, spec_page: 1266, mounting_page: 1270, mto_page: "1266" },
    bores: [
      bore("10", st(50, 300, 50), 500, 53.9),
      bore("15", st(50, 500, 50), 750, 137),
      bore("25", st(100, 600, 50), 1200, 363),
    ],
    dirs: [
      { code: "R", label_sv: "Anslutningarna samlade på höger sida" },
      { code: "L", label_sv: "Anslutningarna samlade på vänster sida" },
    ],
    port_bores: ["25"],
    adjust: [
      { code: "AL", label_sv: "25 mm slagjustering på vänster sida, höger standard" },
      { code: "AR", label_sv: "25 mm slagjustering på höger sida, vänster standard" },
      { code: "A", label_sv: "25 mm slagjustering på båda sidor" },
    ],
    adjust_title_sv: "Justerbult (standard i båda ändar)",
    adjust_title_en: "Adjustment bolt (standard both sides)",
    fixed_suffix: "",
    switches: M9_SWITCHES(true),
    leads: M9_LEADS,
    lead_index: M9_LEAD_INDEX,
    mto: [
      { code: "XB10", stroke: "intermediate", label_sv: "-XB10 Mellanslag inom standardområdet (egen kropp)" },
      { code: "XB11", stroke: "long", label_sv: "-XB11 Långt slag, över största standardslaget upp till max" },
    ],
    stroke_policy: "xb",
    min_stroke_mm: 1,
    min_two_switches_mm: 0,
    limits: { pressure_mpa: [0.2, 0.7], temp_c: [-10, 60], speed_mm_s: [50, 500] },
    template: "CY1F{bore}{port}{dir}-{stroke_mm}{adjust}-{switch}{lead}{count}-{mto}",
  },
};

export const CY1_SERIES_LIST: CY1Series[] = ["cy1s", "cy1l", "cy1h", "cy1f"];

export interface CY1Config {
  bore: string;
  stroke_mm: number;
  piping?: string;
  holding?: string;
  guide?: string;
  dir?: string;
  port?: string;
  adjust?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }> | undefined, kod: string) => !!lista && lista.some((v) => v.code === kod);

/** Standardslag och maxslag för borrning och (CY1H) styrning. */
export function cy1Strokes(series: CY1Series, b: CY1Bore, guide = ""): { standard: number[]; max_mm: number } | null {
  if (series === "cy1h") {
    if (guide === "T") return b.two_axis ?? null;
    return b.one_axis ? { standard: b.standard, max_mm: b.max_mm } : null;
  }
  return { standard: b.standard, max_mm: b.max_mm };
}

/** Minsta slag med två eller fler givare (CY1S: 15 med -X431). */
export function cy1MinTwoSwitches(series: CY1Series, mto: string): number {
  const s = CY1_SERIES[series];
  if (series === "cy1s" && mto === "X431") return s.min_stroke_mm;
  return s.min_two_switches_mm;
}

export function cy1BuildCode(series: CY1Series, c: CY1Config): string | null {
  const s = CY1_SERIES[series];
  const b = s.bores.find((x) => x.code === c.bore);
  if (!b) return null;
  const piping = c.piping ?? "";
  if (piping && (!s.piping || piping !== s.piping.code)) return null;
  const holding = c.holding ?? "";
  if (s.holding) {
    if (!har(s.holding, holding)) return null;
    if (holding === "L" && !b.holding_l_n) return null;
  } else if (holding) return null;
  const guide = c.guide ?? "";
  if (guide && (!s.guide || guide !== s.guide.code)) return null;
  const dir = c.dir ?? "";
  if (s.dirs) {
    if (!har(s.dirs, dir)) return null;
  } else if (dir) return null;
  const slag = cy1Strokes(series, b, guide);
  if (!slag) return null;
  const st = c.stroke_mm;
  if (!Number.isInteger(st) || st < s.min_stroke_mm || st > slag.max_mm) return null;
  const port = c.port ?? "";
  if (port && (!har(CY1_PORTS, port) || !s.port_bores.includes(b.code))) return null;
  const adjust = c.adjust ?? "";
  if (adjust && !har(s.adjust, adjust)) return null;
  const mto = c.mto ?? "";
  const m = mto ? s.mto.find((x) => x.code === mto) : undefined;
  if (mto && !m) return null;
  if (m) {
    if (m.bores && !m.bores.includes(b.code)) return null;
    if (m.needs_absorber && !adjust) return null;
    if (m.not_centralized && piping) return null;
  }
  if (s.stroke_policy === "xb") {
    const maxStd = Math.max(...slag.standard);
    const standard = slag.standard.includes(st);
    const behov = standard ? undefined : st <= maxStd ? "intermediate" : "long";
    if ((m?.stroke ?? undefined) !== behov) return null;
  }
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = s.switches.find((x) => x.code === sw);
    if (!g) return null;
    if (lead && !har(s.leads, lead)) return null;
    if (g.leads[s.lead_index[lead]] === "-") return null;
    if (count && !har(CY1_COUNTS, count)) return null;
    if (count === "S") {
      if (g.min_one_mm && st < g.min_one_mm) return null;
    } else if (g.min_two_mm) {
      if (st < g.min_two_mm[0]) return null;
    } else if (st < cy1MinTwoSwitches(series, mto)) return null;
  } else if (lead || count) return null;
  const g1 = `${s.prefix}${piping}${guide}${b.code}${port}${holding}${dir}`;
  const g2 = `${st}${adjust}${s.fixed_suffix}`;
  const g3 = `${sw}${lead}${count}`;
  return [g1, g2, g3, mto].filter((g, i) => i < 2 || g).join("-");
}

const alt = (lista: ReadonlyArray<{ code: string }>) => [...lista].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");

export function cy1ParseCode(raw: string): { series: CY1Series; config: CY1Config } | null {
  const k = raw.trim().toUpperCase();
  for (const series of CY1_SERIES_LIST) {
    const s = CY1_SERIES[series];
    if (!k.startsWith(s.prefix)) continue;
    const bores = alt(s.bores);
    const givare = alt(s.switches);
    const leads = alt(s.leads);
    const adjust = alt(s.adjust);
    const port = alt(CY1_PORTS);
    const huvud = series === "cy1s"
      ? `CY1S(G?)(${bores})(${port})?`
      : series === "cy1l"
      ? `CY1L(${bores})(${port})?([HL])`
      : series === "cy1h"
      ? `CY1H(T?)(${bores})(${port})?`
      : `CY1F(${bores})(${port})?([RL])`;
    const re = new RegExp(`^${huvud}-(\\d{1,4})(${adjust})?${s.fixed_suffix}(?:-(${givare})(${leads})?(S|3)?)?(?:-(X[A-Z0-9]+))?$`);
    const m = re.exec(k);
    if (!m) return null;
    const c: CY1Config = { bore: "", stroke_mm: 0 };
    let i = 1;
    if (series === "cy1s") { c.piping = m[i++] || undefined; c.bore = m[i++]; c.port = m[i++] || undefined; }
    else if (series === "cy1l") { c.bore = m[i++]; c.port = m[i++] || undefined; c.holding = m[i++]; }
    else if (series === "cy1h") { c.guide = m[i++] || undefined; c.bore = m[i++]; c.port = m[i++] || undefined; }
    else { c.bore = m[i++]; c.port = m[i++] || undefined; c.dir = m[i++]; }
    c.stroke_mm = Number(m[i++]);
    c.adjust = m[i++] || undefined;
    c.switch = m[i++] || undefined;
    c.lead = m[i++] || undefined;
    c.count = m[i++] || undefined;
    c.mto = m[i++] || undefined;
    if (cy1BuildCode(series, c) !== k) return null;
    return { series, config: c };
  }
  return null;
}

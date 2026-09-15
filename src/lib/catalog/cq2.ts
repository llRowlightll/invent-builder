/**
 * SMC CQ2 — kompaktcylinder, standard, dubbel- eller enkelverkande, enkel
 * kolvstång, ø12–ø100.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Compact Cylinder Series CQ2" (katalogutdrag, 247 sidor). Ligger i
 *   knowledge_chunks som source_file = 'smc-kat-cq2.pdf'. PDF-sidor:
 *     - How to Order, dubbelverkande         sida 11 (katalogsida 785)
 *     - specifikationer, standardslag, fästen sida 12 (786)
 *     - mellanslag med distans               sida 13 (787)
 *     - teoretisk kraft                       sida 15 (789)
 *     - How to Order, enkelverkande           sida 65 (823), data sida 66 (824)
 *     - minsta slag för givarmontage          sida 232 (958)
 *
 * VAD FAMILJEN ÄR. Katalogen har tolv beställnycklar: standard, dubbel
 * kolvstång (CQ2W), stor borrning (ø125–200), långt slag, ej roterande (CQ2K,
 * CQ2KW), axiell anslutning (CQP2), sidolast (CQ2S), ändlägeslås (CBQ2) och
 * vattentät (CQ2R/V). Familjen `cq2` i databasen är den STANDARDCYLINDER
 * produkterna SMC-CQ2B12…B63 är, med dubbel- och enkelverkande i samma nyckel
 * (sida 11 och 65 har samma form; enkelverkande är verkningssätt S/T med
 * färre borrningar och slag). De övriga serierna är egna nycklar och ingår
 * inte här.
 *
 * KODENS FORM (sida 11, tre rader):
 *
 *   CQ2  B □ 20 □ - 30 D □   - □ □ - □          ø12–25 utan givare
 *   CQ2  B □ 32 □ - 30 D □ Z - □ □ - □          ø32–100 utan givare
 *   CDQ2 B □ 32 □ - 30 D M Z - L W - M9BW □ - □ med givare
 *
 *   C[D]Q2 {fäste}{typ}{ø}{gänga}-{slag}{verkan}{kropp}{Z}-{bult}{stångfäste}-{givare}{kabel}{antal}-{special}
 *
 * "D" efter C är inbyggd magnet (CDQ2). "Z" är givarspåret: ø32–100 har det
 * alltid, ø12–25 bara med magnet -- fästtabellen på sida 12 skriver "CQ2-D"
 * utan och "CDQ2-DZ" med givare för ø12–25 men "C(D)Q2-DZ" för ø32–100.
 * Bindestrecken före tomma grupper faller bort: CQ2B20-30D, CDQ2L32-25DZ,
 * CDQ2B32-30DMZ-LW-M9BW och CQ2B32-57DZ-XB10A är alla katalogens egna
 * exempel.
 *
 * SMC:s "Nil" är ingenting i koden. Sådana positioner är VALFRIA parametrar:
 * ovald = utelämnad, precis som DSBC:s. Bara borrning, verkan och slag är
 * obligatoriska.
 */

export const CQ2_SOURCE = {
  file: "smc-kat-cq2.pdf",
  edition: "SMC CQ2 catalogue (catalogue pages 785–958)",
  title: "SMC Compact Cylinder Series CQ2",
  brand: "SMC",
} as const;

export interface Cq2Value {
  code: string;
  label_sv: string;
}

export interface Cq2Bore extends Cq2Value {
  bore_mm: number;
  /** Största slag i mm för dubbelverkande pneumatik (standard 30/50/100, mellanslag därunder). */
  da_stroke_max_mm: number;
  /** Standardslag dubbelverkande (sida 12). */
  da_standard_strokes: number[];
  /** Minsta arbetstryck dubbelverkande, MPa (sida 12). */
  da_min_pressure_mpa: number;
  /** Teoretisk kraft plus-sidan vid 0,5 MPa, N (sida 15). */
  force_out_n_05mpa: number;
  /** Enkelverkande: standardslag, eller null om storleken saknas (sida 66). */
  sa_standard_strokes: number[] | null;
  /** Enkelverkande fjäderutskjut (T): mellanslag i 1 mm-steg upp till detta (sida 66). */
  sa_t_intermediate_max_mm: number | null;
  sa_min_pressure_mpa: number | null;
  /** Luft-hydraulik finns ø20–100 (sida 11, not 1). */
  air_hydro: boolean;
}

const s5 = (max: number, from = 5) => Array.from({ length: (max - from) / 5 + 1 }, (_, i) => from + i * 5);

export const CQ2_BORES: Cq2Bore[] = [
  { code: "12", bore_mm: 12, da_stroke_max_mm: 30, da_standard_strokes: s5(30), da_min_pressure_mpa: 0.07, force_out_n_05mpa: 57, sa_standard_strokes: [5, 10], sa_t_intermediate_max_mm: 9, sa_min_pressure_mpa: 0.25, air_hydro: false, label_sv: "ø12 mm" },
  { code: "16", bore_mm: 16, da_stroke_max_mm: 30, da_standard_strokes: s5(30), da_min_pressure_mpa: 0.07, force_out_n_05mpa: 101, sa_standard_strokes: [5, 10], sa_t_intermediate_max_mm: 9, sa_min_pressure_mpa: 0.25, air_hydro: false, label_sv: "ø16 mm" },
  { code: "20", bore_mm: 20, da_stroke_max_mm: 50, da_standard_strokes: s5(50), da_min_pressure_mpa: 0.05, force_out_n_05mpa: 157, sa_standard_strokes: [5, 10], sa_t_intermediate_max_mm: 9, sa_min_pressure_mpa: 0.18, air_hydro: true, label_sv: "ø20 mm" },
  { code: "25", bore_mm: 25, da_stroke_max_mm: 50, da_standard_strokes: s5(50), da_min_pressure_mpa: 0.05, force_out_n_05mpa: 245, sa_standard_strokes: [5, 10], sa_t_intermediate_max_mm: 9, sa_min_pressure_mpa: 0.18, air_hydro: true, label_sv: "ø25 mm" },
  { code: "32", bore_mm: 32, da_stroke_max_mm: 100, da_standard_strokes: [...s5(50), 75, 100], da_min_pressure_mpa: 0.05, force_out_n_05mpa: 402, sa_standard_strokes: [5, 10], sa_t_intermediate_max_mm: 9, sa_min_pressure_mpa: 0.17, air_hydro: true, label_sv: "ø32 mm" },
  { code: "40", bore_mm: 40, da_stroke_max_mm: 100, da_standard_strokes: [...s5(50), 75, 100], da_min_pressure_mpa: 0.05, force_out_n_05mpa: 628, sa_standard_strokes: [5, 10], sa_t_intermediate_max_mm: 9, sa_min_pressure_mpa: 0.15, air_hydro: true, label_sv: "ø40 mm" },
  { code: "50", bore_mm: 50, da_stroke_max_mm: 100, da_standard_strokes: [...s5(50, 10), 75, 100], da_min_pressure_mpa: 0.05, force_out_n_05mpa: 982, sa_standard_strokes: [10, 20], sa_t_intermediate_max_mm: 19, sa_min_pressure_mpa: 0.13, air_hydro: true, label_sv: "ø50 mm" },
  { code: "63", bore_mm: 63, da_stroke_max_mm: 100, da_standard_strokes: [...s5(50, 10), 75, 100], da_min_pressure_mpa: 0.05, force_out_n_05mpa: 1560, sa_standard_strokes: null, sa_t_intermediate_max_mm: null, sa_min_pressure_mpa: null, air_hydro: true, label_sv: "ø63 mm" },
  { code: "80", bore_mm: 80, da_stroke_max_mm: 100, da_standard_strokes: [...s5(50, 10), 75, 100], da_min_pressure_mpa: 0.05, force_out_n_05mpa: 2510, sa_standard_strokes: null, sa_t_intermediate_max_mm: null, sa_min_pressure_mpa: null, air_hydro: true, label_sv: "ø80 mm" },
  { code: "100", bore_mm: 100, da_stroke_max_mm: 100, da_standard_strokes: [...s5(50, 10), 75, 100], da_min_pressure_mpa: 0.05, force_out_n_05mpa: 3930, sa_standard_strokes: null, sa_t_intermediate_max_mm: null, sa_min_pressure_mpa: null, air_hydro: true, label_sv: "ø100 mm" },
];

export const CQ2_ACTIONS: Cq2Value[] = [
  { code: "D", label_sv: "Dubbelverkande" },
  { code: "S", label_sv: "Enkelverkande, fjäderretur (ø12–50)" },
  { code: "T", label_sv: "Enkelverkande, fjäderutskjut (ø12–50)" },
];

/** Fäste (sida 11). Fästen levereras löst; cylinderns fästbultar beställs separat. */
export const CQ2_MOUNTINGS: Cq2Value[] = [
  { code: "B", label_sv: "Genomgående hål (standard)" },
  { code: "A", label_sv: "Gängade båda ändar" },
  { code: "L", label_sv: "Fotfäste" },
  { code: "LC", label_sv: "Kompakt fotfäste" },
  { code: "F", label_sv: "Fläns vid kolvstång" },
  { code: "G", label_sv: "Fläns vid gavel" },
  { code: "D", label_sv: "Dubbelt gaffelfäste" },
];

/** Position efter fästet: luft-hydraulik "H" (ø20–100, bara dubbelverkande). Tom = pneumatik. */
export const CQ2_TYPES: Cq2Value[] = [
  { code: "H", label_sv: "Luft-hydraulik, olja 5–50 mm/s (ø20–100)" },
];

export interface Cq2Port extends Cq2Value {
  bores: string[];
  air_hydro_ok: boolean;
}
/**
 * Gängtyp (sida 11). Tom = M-gänga ø12–25 / Rc ø32–100. TN och TF finns
 * bara ø32–100; F (inbyggda snabbkopplingar) ø32–63 dubbelverkande och
 * ø32–50 enkelverkande. TF och F går inte med luft-hydraulik (not 2, 3).
 */
export const CQ2_PORTS: Cq2Port[] = [
  { code: "TN", bores: ["32", "40", "50", "63", "80", "100"], air_hydro_ok: true, label_sv: "NPT-gänga (ø32–100)" },
  { code: "TF", bores: ["32", "40", "50", "63", "80", "100"], air_hydro_ok: false, label_sv: "G-gänga (ø32–100)" },
  { code: "F", bores: ["32", "40", "50", "63"], air_hydro_ok: false, label_sv: "Inbyggda snabbkopplingar (ø32–63)" },
];
export const CQ2_PORT_F_SA_BORES = ["32", "40", "50"];

/**
 * Kroppsoption (sida 11): F gavelnav, C gummidämpare, M utvändig
 * kolvstångsgänga; kombinationer i ordningen F, C, M. Enkelverkande (sida 65)
 * saknar C. Luft-hydraulik saknar C (not 4).
 */
export const CQ2_BODY_OPTIONS: Cq2Value[] = [
  { code: "F", label_sv: "Nav på gaveln" },
  { code: "C", label_sv: "Gummidämpare" },
  { code: "M", label_sv: "Utvändig kolvstångsgänga" },
  { code: "FC", label_sv: "Nav på gaveln + gummidämpare" },
  { code: "FM", label_sv: "Nav på gaveln + utvändig gänga" },
  { code: "CM", label_sv: "Gummidämpare + utvändig gänga" },
  { code: "FCM", label_sv: "Nav + gummidämpare + utvändig gänga" },
];

export const CQ2_MAGNET: Cq2Value = { code: "D", label_sv: "Inbyggd magnet för givare (CDQ2)" };
export const CQ2_GROOVE: Cq2Value = { code: "Z", label_sv: "Givarspår Z (ø32–100 alltid; ø12–25 med magnet)" };
export const CQ2_BOLT: Cq2Value = { code: "L", label_sv: "Fästbultar medlevererade (bara med fäste B)" };

/** Kolvstångsfäste (sida 11). Öga/gaffel kräver utvändig gänga; ledfästena kräver invändig. */
export const CQ2_ROD_BRACKETS: Array<Cq2Value & { needs_male_thread: boolean }> = [
  { code: "D", needs_male_thread: false, label_sv: "Ledfäste typ A + led (invändig gänga)" },
  { code: "E", needs_male_thread: false, label_sv: "Ledfäste typ B + led (invändig gänga)" },
  { code: "V", needs_male_thread: true, label_sv: "Enkelt knäled (utvändig gänga)" },
  { code: "W", needs_male_thread: true, label_sv: "Dubbelt knäled (utvändig gänga)" },
];

export interface Cq2Switch extends Cq2Value {
  /** reed eller solid state */
  kind: "reed" | "solid";
  /** Minsta slag med 1 respektive 2 givare, mm (sida 232). */
  min_stroke_1: number;
  min_stroke_2: number;
  /** Bara ø32–100 (D-P3DW). */
  bores?: string[];
  /** Inte för enkelverkande (D-P3DW, sida 232). */
  single_acting_ok: boolean;
}

const solid = (code: string, label: string, m1: number, m2: number): Cq2Switch =>
  ({ code, kind: "solid", min_stroke_1: m1, min_stroke_2: m2, single_acting_ok: true, label_sv: label });

/**
 * Tillämpliga givare (sida 11) med minsta slag för montage (sida 232). Värdena
 * utan parentes; katalogens parentesvärde gäller när givaren får sticka ut
 * utanför cylinderkroppen.
 */
export const CQ2_SWITCHES: Cq2Switch[] = [
  solid("M9N", "D-M9N, 3-tråd NPN, rak", 15, 15),
  solid("M9P", "D-M9P, 3-tråd PNP, rak", 15, 15),
  solid("M9B", "D-M9B, 2-tråd, rak", 15, 15),
  solid("M9NV", "D-M9NV, 3-tråd NPN, vinklad", 5, 5),
  solid("M9PV", "D-M9PV, 3-tråd PNP, vinklad", 5, 5),
  solid("M9BV", "D-M9BV, 2-tråd, vinklad", 5, 5),
  solid("M9NW", "D-M9NW, NPN, tvåfärgsindikering, rak", 15, 15),
  solid("M9PW", "D-M9PW, PNP, tvåfärgsindikering, rak", 15, 15),
  solid("M9BW", "D-M9BW, 2-tråd, tvåfärgsindikering, rak", 15, 15),
  solid("M9NWV", "D-M9NWV, NPN, tvåfärgsindikering, vinklad", 10, 15),
  solid("M9PWV", "D-M9PWV, PNP, tvåfärgsindikering, vinklad", 10, 15),
  solid("M9BWV", "D-M9BWV, 2-tråd, tvåfärgsindikering, vinklad", 10, 15),
  solid("M9NA", "D-M9NA, NPN, vattentät, rak", 15, 15),
  solid("M9PA", "D-M9PA, PNP, vattentät, rak", 15, 15),
  solid("M9BA", "D-M9BA, 2-tråd, vattentät, rak", 15, 15),
  solid("M9NAV", "D-M9NAV, NPN, vattentät, vinklad", 10, 15),
  solid("M9PAV", "D-M9PAV, PNP, vattentät, vinklad", 10, 15),
  solid("M9BAV", "D-M9BAV, 2-tråd, vattentät, vinklad", 10, 15),
  { code: "P3DW", kind: "solid", min_stroke_1: 15, min_stroke_2: 15, bores: ["32", "40", "50", "63", "80", "100"], single_acting_ok: false, label_sv: "D-P3DW, 2-tråd, magnetfältstålig (ø32–100)" },
  { code: "A96", kind: "reed", min_stroke_1: 10, min_stroke_2: 10, single_acting_ok: true, label_sv: "D-A96, reed 3-tråd, rak" },
  { code: "A93", kind: "reed", min_stroke_1: 10, min_stroke_2: 10, single_acting_ok: true, label_sv: "D-A93, reed 2-tråd, rak" },
  { code: "A90", kind: "reed", min_stroke_1: 10, min_stroke_2: 10, single_acting_ok: true, label_sv: "D-A90, reed 2-tråd utan indikering, rak" },
  { code: "A96V", kind: "reed", min_stroke_1: 5, min_stroke_2: 10, single_acting_ok: true, label_sv: "D-A96V, reed 3-tråd, vinklad" },
  { code: "A93V", kind: "reed", min_stroke_1: 5, min_stroke_2: 10, single_acting_ok: true, label_sv: "D-A93V, reed 2-tråd, vinklad" },
  { code: "A90V", kind: "reed", min_stroke_1: 5, min_stroke_2: 10, single_acting_ok: true, label_sv: "D-A90V, reed 2-tråd utan indikering, vinklad" },
];

/** Kabellängd (sida 11). Tom = 0,5 m. 1 m finns bland reedgivarna bara för D-A93 (not 2). */
export const CQ2_LEADS: Cq2Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
export const CQ2_LEAD_M_REED_ONLY = ["A93"];

/** Antal givare (sida 11). Tom = 2 st. */
export const CQ2_COUNTS: Cq2Value[] = [
  { code: "S", label_sv: "1 givare (standard är 2)" },
];

export interface Cq2Mto extends Cq2Value {
  bores?: string[];
  /** Bara utan givare. */
  no_switch?: boolean;
  /** Bara luft-hydraulik. */
  air_hydro_only?: boolean;
  /** Bara med givare (X144). */
  needs_switch?: boolean;
  /** Bara dubbelverkande (står bara i nyckeln på sida 12, inte på sida 66). */
  da_only?: boolean;
  /** Enkelverkande: bara fjäderretur S, inte fjäderutskjut T (sida 66). */
  not_for_t?: boolean;
}
/** Specialutföranden (sida 12 och 66). Detaljerna står på katalogsidor som inte ingår här. */
export const CQ2_MTO: Cq2Mto[] = [
  { code: "XA", not_for_t: true, label_sv: "-XA Ändrad kolvstångsände (enkelverkande: bara fjäderretur)" },
  { code: "XB6", no_switch: true, da_only: true, label_sv: "-XB6 Värmebeständig –10…150 °C (utan givare)" },
  { code: "XB7", no_switch: true, da_only: true, label_sv: "-XB7 Köldbeständig –40…70 °C (utan givare)" },
  { code: "XB9", da_only: true, label_sv: "-XB9 Låg hastighet 10–50 mm/s" },
  { code: "XB10", not_for_t: true, label_sv: "-XB10 Mellanslag, egen kropp (enkelverkande: bara fjäderretur)" },
  { code: "XB10A", da_only: true, bores: ["32", "40", "50", "63", "80", "100"], label_sv: "-XB10A Mellanslag 51 mm eller mer, distans (ø32–100)" },
  { code: "XB11", air_hydro_only: true, label_sv: "-XB11 Långt slag (bara luft-hydraulik)" },
  { code: "XB13", da_only: true, label_sv: "-XB13 Låg hastighet 5–50 mm/s" },
  { code: "XB14", da_only: true, bores: ["16", "20", "25", "32", "40", "50", "63"], label_sv: "-XB14 Värmebeständig givare (ø16–63)" },
  { code: "XC2", label_sv: "-XC2 Kolvstångsände 10 mm längre (fot- och flänsfäste)" },
  { code: "XC4", da_only: true, bores: ["20", "25", "32", "40", "50", "63", "80", "100"], label_sv: "-XC4 Kraftig avstrykare (ø20–100)" },
  { code: "XC6", label_sv: "-XC6 Kolvstång, låsring och mutter i rostfritt" },
  { code: "XC8", da_only: true, label_sv: "-XC8 Justerbart slag, utskjut" },
  { code: "XC9", da_only: true, label_sv: "-XC9 Justerbart slag, retur" },
  { code: "XC10", da_only: true, label_sv: "-XC10 Dubbelslag, dubbel kolvstång" },
  { code: "XC11", da_only: true, label_sv: "-XC11 Dubbelslag, enkel kolvstång" },
  { code: "XC26", label_sv: "-XC26 Saxsprintar och brickor till gaffel-/knäledstapp" },
  { code: "XC27", label_sv: "-XC27 Gaffel-/knäledstapp i rostfritt 304" },
  { code: "XC35", da_only: true, bores: ["32", "40", "50", "63", "80", "100"], label_sv: "-XC35 Spiralavstrykare (ø32–100)" },
  { code: "XC36", label_sv: "-XC36 Nav på kolvstångsänden" },
  { code: "XC85", label_sv: "-XC85 Fett för livsmedelsutrustning" },
  { code: "XC92", da_only: true, label_sv: "-XC92 Dammtät" },
  { code: "X144", needs_switch: true, bores: ["12", "16", "20", "25"], label_sv: "-X144 Special portläge, med givare (ø12–25)" },
  { code: "X202", label_sv: "-X202 Samma totallängd som CQ1" },
  { code: "X203", bores: ["20", "32"], label_sv: "-X203 Samma L-mått som CQ1 (ø20, ø32)" },
  { code: "X271", label_sv: "-X271 Fluorgummitätningar" },
  { code: "X525", da_only: true, label_sv: "-X525 Långt slag, justerbart utskjut (-XC8)" },
  { code: "X526", da_only: true, label_sv: "-X526 Långt slag, justerbar retur (-XC9)" },
  { code: "X636", da_only: true, label_sv: "-X636 Långt slag, dubbelslag enkel kolvstång" },
  { code: "X1876", label_sv: "-X1876 Konkavt nav på gaveln" },
];

export const CQ2_LIMITS = {
  max_pressure_mpa: 1.0,
  temp_c: { without_switch: [-10, 70], with_switch: [-10, 60], air_hydro: [5, 60] },
  speed_mm_s: { pneumatic: [50, 500], air_hydro: [5, 50] },
} as const;

export function cq2Bore(code: string): Cq2Bore | null {
  return CQ2_BORES.find((b) => b.code === code) ?? null;
}

/**
 * Giltiga slag för borrning, verkan och typ. Dubbelverkande pneumatik tar
 * vilket heltal som helst 1–max (mellanslag byggs med distans, sida 13);
 * luft-hydraulik bara standardslagen; fjäderretur bara standardslagen;
 * fjäderutskjut standard plus mellanslag 1–9/1–19 (sida 66).
 */
export function cq2StrokeOk(bore: Cq2Bore, action: string, airHydro: boolean, stroke: number): boolean {
  if (!Number.isInteger(stroke) || stroke < 1) return false;
  if (action === "D") {
    if (airHydro) return bore.air_hydro && bore.da_standard_strokes.includes(stroke);
    return stroke <= bore.da_stroke_max_mm;
  }
  if (!bore.sa_standard_strokes) return false;
  if (action === "S") return bore.sa_standard_strokes.includes(stroke);
  if (action === "T") return bore.sa_standard_strokes.includes(stroke) || stroke <= (bore.sa_t_intermediate_max_mm ?? 0);
  return false;
}

export interface Cq2Config {
  bore: string;
  action: string;
  stroke_mm: number;
  mounting?: string;
  air_hydro?: boolean;
  port?: string;
  body?: string;
  magnet?: boolean;
  groove?: boolean;
  bolt?: boolean;
  bracket?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string | undefined) =>
  kod !== undefined && lista.some((v) => v.code === kod);

/** Bygger koden, eller null om katalogen inte har kombinationen. */
export function cq2BuildCode(c: Cq2Config): string | null {
  const bore = cq2Bore(c.bore);
  if (!bore) return null;
  if (!har(CQ2_ACTIONS, c.action)) return null;
  const sa = c.action !== "D";
  if (sa && !bore.sa_standard_strokes) return null;
  const mounting = c.mounting ?? "B";
  if (!har(CQ2_MOUNTINGS, mounting)) return null;
  const airHydro = c.air_hydro === true;
  if (airHydro && (!bore.air_hydro || sa)) return null;
  if (!cq2StrokeOk(bore, c.action, airHydro, c.stroke_mm)) return null;

  const port = c.port ?? "";
  if (port) {
    const p = CQ2_PORTS.find((x) => x.code === port);
    if (!p || !p.bores.includes(bore.code)) return null;
    if (airHydro && !p.air_hydro_ok) return null;
    if (sa && port === "F" && !CQ2_PORT_F_SA_BORES.includes(bore.code)) return null;
  }
  const body = c.body ?? "";
  if (body) {
    if (!har(CQ2_BODY_OPTIONS, body)) return null;
    if ((sa || airHydro) && body.includes("C")) return null;
  }
  const magnet = c.magnet === true;
  const groove = c.groove === true;
  const behoverZ = bore.bore_mm >= 32 || magnet;
  if (groove !== behoverZ) return null;

  const bolt = c.bolt === true;
  if (bolt && mounting !== "B") return null;
  const bracket = c.bracket ?? "";
  if (bracket) {
    const b = CQ2_ROD_BRACKETS.find((x) => x.code === bracket);
    if (!b) return null;
    if (b.needs_male_thread !== body.includes("M")) return null;
  }
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const s = CQ2_SWITCHES.find((x) => x.code === sw);
    if (!s || !magnet) return null;
    if (s.bores && !s.bores.includes(bore.code)) return null;
    if (sa && !s.single_acting_ok) return null;
    if (lead && !har(CQ2_LEADS, lead)) return null;
    if (lead === "M" && s.kind === "reed" && !CQ2_LEAD_M_REED_ONLY.includes(sw)) return null;
    if (count && !har(CQ2_COUNTS, count)) return null;
  } else if (lead || count) return null;

  const mto = c.mto ?? "";
  if (mto) {
    const m = CQ2_MTO.find((x) => x.code === mto);
    if (!m) return null;
    if (m.bores && !m.bores.includes(bore.code)) return null;
    if (m.no_switch && sw) return null;
    if (m.needs_switch && !sw) return null;
    if (m.air_hydro_only && !airHydro) return null;
    if (m.da_only && sa) return null;
    if (m.not_for_t && c.action === "T") return null;
  }

  const grupp1 = `C${magnet ? "D" : ""}Q2${mounting}${airHydro ? "H" : ""}${bore.code}${port}`;
  const grupp2 = `${c.stroke_mm}${c.action}${body}${groove ? "Z" : ""}`;
  const grupp3 = `${bolt ? "L" : ""}${bracket}`;
  const grupp4 = `${sw}${lead}${count}`;
  return [grupp1, grupp2, grupp3, grupp4, mto].filter((g, i) => i < 2 || g).join("-");
}

export interface Cq2Reading {
  config: Cq2Config;
}

/** Läser en kod i katalogens form. Returnerar null om den inte bygger tillbaka till sig själv. */
export function cq2ParseCode(raw: string): Cq2Reading | null {
  const k = raw.trim().toUpperCase();
  // Givarmodellerna räknas upp, längst först, så att "-XB10A" inte läses som
  // en givare och "M9BWL" delas som M9BW + L.
  const givare = [...CQ2_SWITCHES].map((s) => s.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(
    "^C(D?)Q2(LC|[BALFGD])(H?)(12|16|20|25|32|40|50|63|80|100)(TN|TF|F)?-(\\d{1,3})([DST])(FCM|FC|FM|CM|F|C|M)?(Z?)" +
      `(?:-(L?)(D|E|V|W)?)?(?:-(${givare})([MLZ])?(S)?)?(?:-(X[A-Z0-9]+))?$`,
  );
  const m = re.exec(k);
  if (!m) return null;
  const [, magnet, mounting, hydro, bore, port, stroke, action, body, groove, bolt, bracket, sw, lead, count, mto] = m;
  const c: Cq2Config = {
    bore, action, stroke_mm: Number(stroke), mounting, air_hydro: hydro === "H", port: port || undefined,
    body: body || undefined, magnet: magnet === "D", groove: groove === "Z", bolt: bolt === "L",
    bracket: bracket || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined,
    mto: mto || undefined,
  };
  if (cq2BuildCode(c) !== k) return null;
  return { config: c };
}

/**
 * Mallen i databasen. Valfria positioner faller bort, och mallmotorn städar
 * dubbla och avslutande bindestreck -- så "CQ2B20-30D" blir just det.
 */
export const CQ2_ORDER_CODE_TEMPLATE =
  "C{magnet}Q2{mounting}{air_hydro}{bore}{port}-{stroke_mm}{action}{body}{groove}" +
  "-{bolt}{bracket}-{switch}{lead}{count}-{mto}";

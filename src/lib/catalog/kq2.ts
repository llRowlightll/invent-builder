/**
 * SMC KQ2 — snabbkopplingar (One-touch fittings) för metrisk slang ø2–ø16
 * och tumslang ø1/8"–ø1/2": gängade kopplingar (M, R/Rc, G, Uni, 10-32 UNF,
 * NPT), slang-mot-slang-skarvar, instickskopplingar, reduceringar, nipplar
 * och slanglock, med rund eller oval frigöringsknapp.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "One-touch Fittings KQ2 Series", CAT.ES50-37D, 228 sidor. Ligger i
 *   knowledge_chunks som source_file = 'smc-kat-kq2.pdf'.
 *     - serieöversikt, tätningsmetoder och knapptyper           sida 3
 *     - data (tryck, temperatur, material)                      sida 4
 *     - How to Order metriskt, M/R/Rc, oval knapp               sida 6
 *     - How to Order metriskt, G (plantätning), oval            sida 58
 *     - How to Order metriskt, R/Rc plantätning (P), oval       sida 66
 *     - How to Order metriskt, Uni-gänga, oval                  sida 88
 *     - samma fyra nycklar med rund knapp                       sida 102, 166, 174, 202
 *     - How to Order tumslang, 10-32 UNF och NPT, oval            sida 31 (rund sida 134)
 *     - How to Order tumslang, M5/R/Rc, oval                      sida 51 (rund sida 160)
 *     - How to Order tumslang, NPT med plantätning (P), oval      sida 75 (rund sida 188)
 *     - How to Order tumslang, R med plantätning (P), oval        sida 83 (rund sida 198)
 *     - How to Order tumslang, Uni-gänga, oval                    sida 97 (rund sida 212)
 *     - måttabellerna med varje modellnummer, metriskt            sida 9–27, 60–64, 68–72, 90–94,
 *                                                               105–132, 168–172, 176–184, 204–208
 *     - måttabellerna, tumslang                                   sida 34–47, 53–55, 77–80, 85–86, 99–100,
 *                                                               138–158, 163–165, 191–197, 201–202, 215–216
 *   Modellnumren i måttabellerna är lästa av scripts/extract-kq2-models.py
 *   till kq2-models.ts. Tumslangen har udda koder (01 = ø1/8" … 13 = ø1/2"),
 *   den metriska jämna (02–16), så typ- och portkoderna delas: R3/8 heter 03
 *   för alla typer, och samma 03 är reducernippeln till ø5/32" när typen är N
 *   och slangen tum (KQ2N01-03, sida 152).
 *     - Clean-serien, prefix 10- (förnicklade mässingsdelar)       sida 28 (tum sida 49)
 *     - specialutföranden -X12/-X35/-X41                          sida 28 och 132
 *     - Q-utförandet KQ2□08-01□Q□ (KQ-seriens effektiva area)      sida 132
 *     - KJE-utbytbar skottgenomföring KQ2E□□-00□J                  sida 129 (tum sida 154)
 *   Inte med: pluggen KQ2P-□□ (egen kodform utan portposition, sida 26, 47,
 *   130, 155), de äldre specialutförandena X17/X29/X34/X39/X94 ("provided
 *   based on previous models, contact SMC", sida 28) och konverterings-
 *   kopplingarna KQ2H□-□A-X562 (sida 132).
 *
 * KODENS FORM (sida 6 och 102):
 *
 *   KQ2 H 06 - 01 A S 1     nyckelns exempel: hankoppling, ø6, R1/8, mässing, tätningsmedel, oval knapp
 *   KQ2 H 06 - 01 A S       samma med rund knapp (sida 102)
 *   KQ2 H 06 - G01 A 1      G1/8 med plantätning (sida 58)
 *   KQ2 H 06 - 01 A P 1     R1/8 med plantätning (sida 66)
 *   KQ2 H 06 - U01 A 1      Uni 1/8 (sida 88)
 *   KQ2 H 06 - 00 A 1       rak skarv ø6 (sida 6, "Tube type")
 *   KQ2 H 23 - M3 G 1       M3 finns bara i rostfritt 303 (sida 6)
 *   KQ2 N 04 - 99           nippel utan materialbokstav (sida 129)
 *   KQ2 H 05 - 34 A S 1     tumslang ø3/16", NPT1/8, mässing, tätningsmedel, oval (sida 31)
 *   KQ2 H 05 - 34 A P 1     samma med plantätning (sida 75)
 *   KQ2 H 05 - 32 A 1       10-32 UNF med gasket (sida 31)
 *   KQ2 H 05 - 01 A S 1     tumslang med R1/8 (sida 51)
 *   KQ2 H 05 - U01 A 1      tumslang med Uni 1/8 (sida 97)
 *   10-KQ2 H 06 - 02 N S 1   Clean-serien: förnicklat (sida 28)
 *   KQ2 L 08 - 01 A Q S     Q-utförandet: ø8/R1/8 med KQ-seriens area (sida 132)
 *   KQ2 E 04 - 00 A J       skottgenomföring utbytbar mot KJE (sida 129)
 *   KQ2 H 06 - 01 A S 1 -X12 vit knapp, vit vaselin (sida 28)
 *   {clean}KQ2{typ}{slang}-{port}{material}{q}{tätning}{kje}{knapp}{special}
 */
import { KQ2_MODELS } from "./kq2-models";

export const KQ2_SOURCE = {
  file: "smc-kat-kq2.pdf",
  edition: "SMC CAT.ES50-37D (One-touch Fittings KQ2 Series, web catalogue 2026)",
  title: "SMC One-touch Fittings KQ2 Series",
  brand: "SMC",
} as const;

export interface KQ2Value {
  code: string;
  label_sv: string;
}

/** Oval frigöringsknapp: bara ø3,2, ø4 och ø6 (sida 1 och 3). */
export const KQ2_BUTTON: KQ2Value = { code: "1", label_sv: "Oval frigöringsknapp (ø3,2, ø4, ø6; standard är rund)" };

/** Kopplingstyperna (sida 6, 102 och måttabellernas rubriker). Bokstaven betyder olika saker med gänga, skarv (00) och slang på andra sidan. */
export const KQ2_TYPES: KQ2Value[] = [
  { code: "H", label_sv: "Rak: hankoppling (gänga), rak skarv (00) eller reducerad rak (slangmått)" },
  { code: "S", label_sv: "Rak hankoppling med insexfattning" },
  { code: "F", label_sv: "Rak honkoppling (Rc, M, G)" },
  { code: "L", label_sv: "Vinkel: hankoppling, vinkelskarv (00), instick (99) eller reducerad vinkel" },
  { code: "LU", label_sv: "Grenvinkel: han (gänga) eller skarv (00); bara rund knapp" },
  { code: "K", label_sv: "45° hankoppling" },
  { code: "V", label_sv: "Svivelvinkel, han" },
  { code: "VS", label_sv: "Svivelvinkel, han, med insexfattning" },
  { code: "VF", label_sv: "Svivelvinkel, hon" },
  { code: "LF", label_sv: "Vinkel honkoppling (Rc, M)" },
  { code: "VD", label_sv: "Dubbel svivelvinkel, han" },
  { code: "VT", label_sv: "Trippel svivelvinkel, han" },
  { code: "Z", label_sv: "Gren-svivelvinkel, han; bara rund knapp" },
  { code: "ZF", label_sv: "Gren-svivelvinkel, hon; bara rund knapp" },
  { code: "ZD", label_sv: "Dubbel gren-svivelvinkel, han; bara rund knapp" },
  { code: "ZT", label_sv: "Trippel gren-svivelvinkel, han; bara rund knapp" },
  { code: "W", label_sv: "Förlängd vinkel: han (gänga) eller instick (99)" },
  { code: "T", label_sv: "T: han-T (gänga), T-skarv (00) eller reducerad T (slangmått)" },
  { code: "Y", label_sv: "Han-T i löpriktningen (run tee)" },
  { code: "D", label_sv: "Delta: han-delta (gänga) eller delta-skarv (00)" },
  { code: "TW", label_sv: "Korsskarv (00)" },
  { code: "TX", label_sv: "Reducerad korsskarv, typ X (slangmått)" },
  { code: "TY", label_sv: "Reducerad korsskarv, typ Y (slangmått)" },
  { code: "U", label_sv: "Y: han-Y (gänga), Y-skarv (00), instick-Y (99) eller reducerad Y-skarv; bara rund knapp" },
  { code: "UD", label_sv: "Reducerad gren-Y; bara rund knapp" },
  { code: "X", label_sv: "Reducerad instick-Y; bara rund knapp" },
  { code: "XD", label_sv: "Dubbel instick-Y; bara rund knapp" },
  { code: "R", label_sv: "Instick-reducering (slangmått)" },
  { code: "E", label_sv: "Skottgenomföring: skarv (00) eller hankoppling (Rc/G)" },
  { code: "LE", label_sv: "Skottgenomföring, vinkelskarv (00)" },
  { code: "N", label_sv: "Nippel (99), reducernippel (slangmått) eller adapter (gänga); bara rund knapp" },
  { code: "C", label_sv: "Slanglock (00)" },
];

/** Slangmått: metriska (sida 6, 102) med jämna koder, tum (sida 31, 134) med udda; mm är ytterdiametern. */
export const KQ2_TUBES: Array<KQ2Value & { mm: number; inch: boolean }> = [
  { code: "02", mm: 2, inch: false, label_sv: "ø2 mm" },
  { code: "23", mm: 3.2, inch: false, label_sv: "ø3,2 mm" },
  { code: "04", mm: 4, inch: false, label_sv: "ø4 mm" },
  { code: "06", mm: 6, inch: false, label_sv: "ø6 mm" },
  { code: "08", mm: 8, inch: false, label_sv: "ø8 mm" },
  { code: "10", mm: 10, inch: false, label_sv: "ø10 mm" },
  { code: "12", mm: 12, inch: false, label_sv: "ø12 mm" },
  { code: "16", mm: 16, inch: false, label_sv: "ø16 mm" },
  { code: "01", mm: 3.18, inch: true, label_sv: "ø1/8\" (tum)" },
  { code: "03", mm: 3.97, inch: true, label_sv: "ø5/32\" (tum)" },
  { code: "05", mm: 4.76, inch: true, label_sv: "ø3/16\" (tum)" },
  { code: "07", mm: 6.35, inch: true, label_sv: "ø1/4\" (tum)" },
  { code: "09", mm: 7.94, inch: true, label_sv: "ø5/16\" (tum)" },
  { code: "11", mm: 9.53, inch: true, label_sv: "ø3/8\" (tum)" },
  { code: "13", mm: 12.7, inch: true, label_sv: "ø1/2\" (tum)" },
];
export const KQ2_INCH_TUBES = KQ2_TUBES.filter((t) => t.inch).map((t) => t.code);

export type KQ2PortKind = "thread" | "tube" | "bulkhead" | "nipple";
export interface KQ2Port extends KQ2Value {
  kind: KQ2PortKind;
  /** Gängan som tätningsmedel (S) och plantätning (P) finns för (sida 6, 66). */
  r_thread: boolean;
}
const gänga = (code: string, label: string, r = false): KQ2Port => ({ code, kind: "thread", r_thread: r, label_sv: label });
const slang = (code: string, label: string): KQ2Port => ({ code, kind: "tube", r_thread: false, label_sv: label });
const nippel = (code: string, label: string): KQ2Port => ({ code, kind: "nipple", r_thread: false, label_sv: label });
/** Portpositionen: gänga, slang på andra sidan, skottgenomföring eller nippelns andra sida (sida 6, 58, 66, 88, 129). */
export const KQ2_PORTS: KQ2Port[] = [
  gänga("M3", "M3 x 0,5 med gasket (bara rostfritt G)"),
  gänga("M5", "M5 x 0,8 med gasket"),
  gänga("M6", "M6 x 1,0 med gasket"),
  gänga("01", "R1/8 (han) / Rc1/8 (hon)", true),
  gänga("02", "R1/4 (han) / Rc1/4 (hon)", true),
  gänga("03", "R3/8 (han) / Rc3/8 (hon); nippel N med tumslang: reducernippel till ø5/32\"", true),
  gänga("04", "R1/2 (han) / Rc1/2 (hon)", true),
  gänga("G01", "G1/8 med plantätning"),
  gänga("G02", "G1/4 med plantätning"),
  gänga("G03", "G3/8 med plantätning"),
  gänga("G04", "G1/2 med plantätning"),
  gänga("U01", "Uni 1/8 (passar Rc, G, NPT, NPTF) med gasket"),
  gänga("U02", "Uni 1/4 med gasket"),
  gänga("U03", "Uni 3/8 med gasket"),
  gänga("U04", "Uni 1/2 med gasket"),
  gänga("32", "10-32 UNF med gasket (tumslang)"),
  gänga("33", "NPT1/16 (tumslang)", true),
  gänga("34", "NPT1/8 (tumslang)", true),
  gänga("35", "NPT1/4 (tumslang)", true),
  gänga("36", "NPT3/8 (tumslang)", true),
  gänga("37", "NPT1/2 (tumslang)", true),
  slang("00A", "Slang på båda sidor, samma mått (skarv)"),
  slang("99A", "Instick (rörände), samma mått"),
  slang("23A", "Slang ø3,2 på andra sidan (reducering)"),
  slang("04A", "Slang ø4 på andra sidan (reducering)"),
  slang("06A", "Slang ø6 på andra sidan (reducering)"),
  slang("08A", "Slang ø8 på andra sidan (reducering)"),
  slang("10A", "Slang ø10 på andra sidan (reducering)"),
  slang("12A", "Slang ø12 på andra sidan (reducering)"),
  slang("16A", "Slang ø16 på andra sidan (reducering)"),
  slang("03A", "Slang ø5/32\" på andra sidan (reducering, tum)"),
  slang("05A", "Slang ø3/16\" på andra sidan (reducering, tum)"),
  slang("07A", "Slang ø1/4\" på andra sidan (reducering, tum)"),
  slang("09A", "Slang ø5/16\" på andra sidan (reducering, tum)"),
  slang("11A", "Slang ø3/8\" på andra sidan (reducering, tum)"),
  slang("13A", "Slang ø1/2\" på andra sidan (reducering, tum)"),
  { code: "00", kind: "bulkhead", r_thread: false, label_sv: "Skottgenomföring med slang på båda sidor (E, LE)" },
  nippel("99", "Nippel, samma mått (N)"),
  nippel("06", "Reducernippel till ø6 (N)"),
  nippel("08", "Reducernippel till ø8 (N)"),
  nippel("10", "Reducernippel till ø10 (N)"),
  nippel("12", "Reducernippel till ø12 (N)"),
  nippel("16", "Reducernippel till ø16 (N)"),
  nippel("05", "Reducernippel till ø3/16\" (N, tum)"),
  nippel("07", "Reducernippel till ø1/4\" (N, tum)"),
  nippel("09", "Reducernippel till ø5/16\" (N, tum)"),
  nippel("11", "Reducernippel till ø3/8\" (N, tum)"),
  nippel("13", "Reducernippel till ø1/2\" (N, tum)"),
];
/** Porten 03 är R3/8 — utom för nippeln N med tumslang, där den är reducernippeln till ø5/32" (KQ2N05-03, sida 152). */
export const KQ2_NIPPLE_03 = "03";

/** Gängmaterial (sida 6): väljs för gängade kopplingar och skottgenomföringar; M3 bara i rostfritt; tumslangens kopplingar i A eller N (sida 31). */
export const KQ2_MATERIALS: KQ2Value[] = [
  { code: "A", label_sv: "Mässing" },
  { code: "N", label_sv: "Mässing, kemiskt förnicklad" },
  { code: "G", label_sv: "Rostfritt stål 303 (bara M3)" },
];

/** Tätning på R- och NPT-gängan: tätningsmedel (sida 6, 31) eller plantätning (sida 66, 75); utan bokstav = utan (sida 6, Nil). */
export const KQ2_SEALS: KQ2Value[] = [
  { code: "S", label_sv: "Tätningsmedel på R-gängan" },
  { code: "P", label_sv: "Plantätning på R-gängan (face seal)" },
];

/** Clean-serien (sida 28, 49): prefix 10-; mässingsdelarna förnicklade, fluorfett, luftblåst i renrum, dubbelförpackad, vit resinkropp/knapp. */
export const KQ2_CLEAN: KQ2Value = { code: "10-", label_sv: "Clean-serien: förnicklat, fluorfett, renrumsblåst, dubbelförpackad" };
/** Q-utförandet (sida 132): effektiv area utbytbar med KQ-serien; bara ø8/R1/8 och typerna L, K, LF, W, T, Y. */
export const KQ2_Q: KQ2Value = { code: "Q", label_sv: "Q: KQ-seriens effektiva area (ø8 med R1/8; L, K, LF, W, T, Y)" };
export const KQ2_Q_TYPES = ["L", "K", "LF", "W", "T", "Y"];
export const KQ2_Q_TUBE = "08";
export const KQ2_Q_PORT = "01";
/** KJE-utbytbar skottgenomföring (sida 129 och 154): KQ2E□□-00□J, rund knapp, gänga M7–M11 x 0,75. */
export const KQ2_KJE: KQ2Value = { code: "J", label_sv: "J: skottgenomföring utbytbar mot KJE (E, 00; ø2–ø6, ø1/8\", ø5/32\", ø1/4\")" };
export const KQ2_KJE_TUBES = ["02", "23", "04", "06", "01", "03", "07"];
/** Specialutföranden (sida 28 och 132); X35 finns inte för S, E, N, H, F, C och pluggen. */
export interface KQ2Mto extends KQ2Value {
  not_types: string[];
  contact: boolean;
}
export const KQ2_MTO: KQ2Mto[] = [
  { code: "-X12", not_types: [], contact: false, label_sv: "-X12: vit frigöringsknapp, vit vaselin" },
  { code: "-X35", not_types: ["S", "E", "N", "H", "F", "C"], contact: false, label_sv: "-X35: svart kropp, ljusgrå/orange knapp" },
  { code: "-X41", not_types: [], contact: true, label_sv: "-X41: fast strypning (fråga SMC om tillgänglighet)" },
];

export const KQ2_LIMITS = {
  pressure_kpa: [-100, 1000],
  proof_mpa: 3,
  temp_c: [-5, 60],
  temp_water_c: [0, 40],
} as const;

/** Honkopplingarnas Rc-gänga har ingen tätning (måttabellerna sida 9–27: KQ2F, KQ2E, KQ2LF utan S). */
export const KQ2_FEMALE_TYPES = ["E", "F", "LF"];

export interface KQ2Config {
  type: string;
  tube: string;
  port: string;
  material?: string;
  seal?: string;
  button?: string;
  clean?: string;
  q?: string;
  kje?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

/** Portposterna ur måttabellerna för knapp, typ och slang: portkod -> fast material (A/G/-) eller "" (A eller N väljs). */
export function kq2Entries(button: "round" | "oval", type: string, tube: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const ch of ["MR", "G", "RP", "U", "UN", "IMR", "INP", "IR", "IU"]) {
    for (const e of KQ2_MODELS[`${button}|${ch}`]?.[type]?.[tube] ?? []) {
      const m = /^([GU]?\d{2}|M[356])([AG-]?)([SP]?)$/.exec(e)!;
      const [, port, fixed, seal] = m;
      if (seal === "P") continue; // plantätningen är tätningsvalet P på samma R-gänga (sida 66 = sida 6 utan S)
      const key = fixed === "A" ? `${port}A` : port;
      out.set(key, fixed === "A" ? "A" : fixed);
    }
  }
  return out;
}

export function kq2Allowed(button: "round" | "oval", type: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const t of KQ2_TUBES) {
    const e = kq2Entries(button, type, t.code);
    if (e.size) out[t.code] = [...e.keys()];
  }
  return out;
}

export function kq2BuildCode(c: KQ2Config): string | null {
  if (!har(KQ2_TYPES, c.type) || !har(KQ2_TUBES, c.tube)) return null;
  const button = c.button ?? "";
  if (button && button !== KQ2_BUTTON.code) return null;
  const entries = kq2Entries(button ? "oval" : "round", c.type, c.tube);
  const port = KQ2_PORTS.find((p) => p.code === c.port);
  if (!port || !entries.has(port.code)) return null;
  const fixed = entries.get(port.code)!;
  const material = c.material ?? "";
  const seal = c.seal ?? "";
  if (fixed === "A" || fixed === "-") {
    if (material || seal) return null;
  } else {
    if (fixed === "G" ? material !== "G" : !["A", "N"].includes(material)) return null;
    if (seal) {
      if (!har(KQ2_SEALS, seal) || !port.r_thread || KQ2_FEMALE_TYPES.includes(c.type)) return null;
    }
  }
  const clean = c.clean ?? "";
  // Clean-serien: mässingsdelarna förnicklade -> gängade kopplingar bara i N (sida 28).
  if (clean && (clean !== KQ2_CLEAN.code || material === "A")) return null;
  const q = c.q ?? "";
  if (q && (q !== KQ2_Q.code || !KQ2_Q_TYPES.includes(c.type) || c.tube !== KQ2_Q_TUBE || port.code !== KQ2_Q_PORT || button)) return null;
  const kje = c.kje ?? "";
  if (kje && (kje !== KQ2_KJE.code || c.type !== "E" || port.code !== "00" || !KQ2_KJE_TUBES.includes(c.tube) || button)) return null;
  const mto = c.mto ?? "";
  if (mto) {
    const m = KQ2_MTO.find((x) => x.code === mto);
    if (!m || m.not_types.includes(c.type)) return null;
  }
  return `${clean}KQ2${c.type}${c.tube}-${port.code}${fixed === "A" || fixed === "-" ? "" : material}${q}${seal}${kje}${button}${mto}`;
}

export function kq2ParseCode(raw: string): { config: KQ2Config } | null {
  const k = raw.trim().toUpperCase();
  const typer = [...KQ2_TYPES].map((t) => t.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^(10-)?KQ2(${typer})(\\d{2})-([GU]?\\d{2}|M[356])(A|N|G)?(Q)?(S|P)?(J)?(1)?(-X12|-X35|-X41)?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, clean, type, tube, portRaw, material, q, seal, kje, button, mto] = m;
  const tillval = { clean: clean || undefined, q: q || undefined, kje: kje || undefined, mto: mto || undefined };
  // Slangkopplingens A är en del av portkoden (00A, 06A …); gängans material är ett val.
  const kandidater: KQ2Config[] = [];
  if (material === "A" && !seal && !q && !kje && /^\d{2}$/.test(portRaw) && KQ2_PORTS.some((p) => p.code === `${portRaw}A`)) {
    kandidater.push({ type, tube, port: `${portRaw}A`, button: button || undefined, ...tillval });
  }
  kandidater.push({ type, tube, port: portRaw, material: material || undefined, seal: seal || undefined, button: button || undefined, ...tillval });
  for (const c of kandidater) if (kq2BuildCode(c) === k) return { config: c };
  return null;
}

export const KQ2_ORDER_CODE_TEMPLATE = "{clean}KQ2{type}{tube}-{port}{material}{q}{seal}{kje}{button}{mto}";

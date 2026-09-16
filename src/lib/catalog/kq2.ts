/**
 * SMC KQ2 — snabbkopplingar (One-touch fittings) för metrisk slang ø2–ø16:
 * gängade kopplingar (M, R/Rc, G, Uni), slang-mot-slang-skarvar, insticks-
 * kopplingar, reduceringar, nipplar och slanglock, med rund eller oval
 * frigöringsknapp.
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
 *     - måttabellerna med varje modellnummer                    sida 9–27, 60–64, 68–72, 90–94,
 *                                                               105–132, 168–172, 176–184, 204–208
 *   Modellnumren i måttabellerna är lästa av scripts/extract-kq2-models.py
 *   till kq2-models.ts. Tumslangens kapitel (UNF/NPT, tum med M/R, NPT- och
 *   R-plantätning, tum-Uni; sida 29–56, 73–86, 95–100, 133–164, 185–200,
 *   209–216) följer samma nyckel men är inte med. Inte heller Clean-serien
 *   (prefix 10-), specialutföranden (-X…), skottgenomföringens KJE-utbytbara
 *   variant (…J) eller pluggen KQ2P-□□ (egen kodform).
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
 *   KQ2{typ}{slang}-{port}{material}{tätning}{knapp}
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

/** Metriska slangmått (sida 6, 102). */
export const KQ2_TUBES: Array<KQ2Value & { mm: number }> = [
  { code: "02", mm: 2, label_sv: "ø2 mm" },
  { code: "23", mm: 3.2, label_sv: "ø3,2 mm" },
  { code: "04", mm: 4, label_sv: "ø4 mm" },
  { code: "06", mm: 6, label_sv: "ø6 mm" },
  { code: "08", mm: 8, label_sv: "ø8 mm" },
  { code: "10", mm: 10, label_sv: "ø10 mm" },
  { code: "12", mm: 12, label_sv: "ø12 mm" },
  { code: "16", mm: 16, label_sv: "ø16 mm" },
];

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
  gänga("03", "R3/8 (han) / Rc3/8 (hon)", true),
  gänga("04", "R1/2 (han) / Rc1/2 (hon)", true),
  gänga("G01", "G1/8 med plantätning"),
  gänga("G02", "G1/4 med plantätning"),
  gänga("G03", "G3/8 med plantätning"),
  gänga("G04", "G1/2 med plantätning"),
  gänga("U01", "Uni 1/8 (passar Rc, G, NPT, NPTF) med gasket"),
  gänga("U02", "Uni 1/4 med gasket"),
  gänga("U03", "Uni 3/8 med gasket"),
  gänga("U04", "Uni 1/2 med gasket"),
  slang("00A", "Slang på båda sidor, samma mått (skarv)"),
  slang("99A", "Instick (rörände), samma mått"),
  slang("23A", "Slang ø3,2 på andra sidan (reducering)"),
  slang("04A", "Slang ø4 på andra sidan (reducering)"),
  slang("06A", "Slang ø6 på andra sidan (reducering)"),
  slang("08A", "Slang ø8 på andra sidan (reducering)"),
  slang("10A", "Slang ø10 på andra sidan (reducering)"),
  slang("12A", "Slang ø12 på andra sidan (reducering)"),
  slang("16A", "Slang ø16 på andra sidan (reducering)"),
  { code: "00", kind: "bulkhead", r_thread: false, label_sv: "Skottgenomföring med slang på båda sidor (E, LE)" },
  nippel("99", "Nippel, samma mått (N)"),
  nippel("06", "Reducernippel till ø6 (N)"),
  nippel("08", "Reducernippel till ø8 (N)"),
  nippel("10", "Reducernippel till ø10 (N)"),
  nippel("12", "Reducernippel till ø12 (N)"),
  nippel("16", "Reducernippel till ø16 (N)"),
];

/** Gängmaterial (sida 6): väljs för gängade kopplingar och skottgenomföringar; M3 bara i rostfritt. */
export const KQ2_MATERIALS: KQ2Value[] = [
  { code: "A", label_sv: "Mässing" },
  { code: "N", label_sv: "Mässing, kemiskt förnicklad" },
  { code: "G", label_sv: "Rostfritt stål 303 (bara M3)" },
];

/** Tätning på R-gängan: tätningsmedel (sida 6) eller plantätning (sida 66); utan bokstav = utan (sida 6, Nil). */
export const KQ2_SEALS: KQ2Value[] = [
  { code: "S", label_sv: "Tätningsmedel på R-gängan" },
  { code: "P", label_sv: "Plantätning på R-gängan (face seal)" },
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
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

/** Portposterna ur måttabellerna för knapp, typ och slang: portkod -> fast material (A/G/-) eller "" (A eller N väljs). */
export function kq2Entries(button: "round" | "oval", type: string, tube: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const ch of ["MR", "G", "RP", "U"]) {
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
  return `KQ2${c.type}${c.tube}-${port.code}${fixed === "A" || fixed === "-" ? "" : material}${seal}${button}`;
}

export function kq2ParseCode(raw: string): { config: KQ2Config } | null {
  const k = raw.trim().toUpperCase();
  const typer = [...KQ2_TYPES].map((t) => t.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^KQ2(${typer})(\\d{2})-([GU]?\\d{2}|M[356])(A|N|G)?(S|P)?(1)?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, type, tube, portRaw, material, seal, button] = m;
  // Slangkopplingens A är en del av portkoden (00A, 06A …); gängans material är ett val.
  const kandidater: KQ2Config[] = [];
  if (material === "A" && !seal && /^\d{2}$/.test(portRaw) && KQ2_PORTS.some((p) => p.code === `${portRaw}A`)) {
    kandidater.push({ type, tube, port: `${portRaw}A`, button: button || undefined });
  }
  kandidater.push({ type, tube, port: portRaw, material: material || undefined, seal: seal || undefined, button: button || undefined });
  for (const c of kandidater) if (kq2BuildCode(c) === k) return { config: c };
  return null;
}

export const KQ2_ORDER_CODE_TEMPLATE = "KQ2{type}{tube}-{port}{material}{seal}{button}";

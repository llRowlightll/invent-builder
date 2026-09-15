/**
 * SMC CJ2 — rund minicylinder, dubbelverkande enkel kolvstång, ø6/10/16.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Air Cylinder CJ2 Series" (katalogutdrag CJ2-Z, 119 sidor).
 *   Ligger i knowledge_chunks som source_file = 'smc-kat-cj2.pdf'.
 *   PDF-sidor (katalogsidor inom parentes; meddelandena citerar katalogsidan):
 *     - kombinationstabell standard/special         sida 8   (72)
 *     - How to Order, dubbelverkande CJ2            sida 10  (74)
 *     - specifikationer, standardslag, special,
 *       beställningsexempel, fästen                 sida 11  (75)
 *     - minsta slag för givarmontage                sida 113 (177)
 *     - -X2838 dubbelt gaffelfäste med snabbsprint  sida 118 (182)
 *
 * VAD FAMILJEN ÄR. Katalogen har tolv nycklar: CJ2 standard DA, CJ2W dubbel
 * kolvstång, CJ2 enkelverkande (S/T), CJ2K ej roterande (DA/SA), CJ2Z med
 * inbyggd strypning (och CJ2ZW), CJ2R direktmonterad (DA/SA), CJ2RK, CBJ2
 * med ändlås. Familjen `cj2` är standardcylindern DA enkel kolvstång, det
 * produkterna SMC-CJ2B10/B16 är. De övriga är egna nycklar. Prefixserierna
 * 10-/11- (renrum) och 25A- (koppar-/zinkfri) är egna beställningsformer.
 *
 * KODENS FORM (sida 10):
 *
 *   C D J2 B 16 - 60 A □ Z - □ □ - M9BW □ - B - □
 *   C{magnet}J2{fäste}{ø}-{slag}{dämpning}{port}Z-{pivot}{kolvstångsände}-{givare}{kabel}{antal}-{givarfäste}-{special}
 *
 * Magneten "D" gör CJ2 till CDJ2. Givarfästet (A skena / B band) anges bara
 * med magnet ("Enter the auto switch mounting type even when a built-in
 * magnet cylinder without an auto switch is required"). Katalogens
 * beställningsexempel CDJ2D16-60Z-NW-M9BW-B (sida 11) och -X2838-exemplet
 * CDJ2D10-60Z-N-M9BW-B-X2838 (sida 118) byggs tecken för tecken.
 *
 * ø20 FINNS INTE. CJ2 är ø6, 10 och 16 (sida 10). Produkten SMC-CJ2B20 är
 * påhittad.
 */

export const CJ2_SOURCE = {
  file: "smc-kat-cj2.pdf",
  edition: "SMC CJ2-Z catalogue (catalogue pages 69–187)",
  title: "SMC Air Cylinder CJ2 Series",
  brand: "SMC",
} as const;

export interface CJ2Value {
  code: string;
  label_sv: string;
}

export interface CJ2Bore extends CJ2Value {
  bore_mm: number;
  /** Standardslag (sida 11); mellanslag i 1 mm-steg tillverkas på beställning. */
  standard_strokes: number[];
  /** "Maximum manufacturable stroke" (sida 11). */
  max_stroke_mm: number;
  min_pressure_rubber_mpa: number;
  /** null = luftdämpning finns inte (ø6, sida 10 not). */
  min_pressure_cushion_mpa: number | null;
  /** ø6 är bara bandmontage (sida 10, punkt 10). */
  rail_ok: boolean;
  /** Dubbelt gaffelfäste D och knäleder V/W är ø10 och ø16 (sida 10). */
  clevis_ok: boolean;
}

export const CJ2_BORES: CJ2Bore[] = [
  { code: "6", bore_mm: 6, standard_strokes: [15, 30, 45, 60], max_stroke_mm: 200, min_pressure_rubber_mpa: 0.12, min_pressure_cushion_mpa: null, rail_ok: false, clevis_ok: false, label_sv: "ø6 mm" },
  { code: "10", bore_mm: 10, standard_strokes: [15, 30, 45, 60, 75, 100, 125, 150], max_stroke_mm: 400, min_pressure_rubber_mpa: 0.06, min_pressure_cushion_mpa: 0.1, rail_ok: true, clevis_ok: true, label_sv: "ø10 mm" },
  { code: "16", bore_mm: 16, standard_strokes: [15, 30, 45, 60, 75, 100, 125, 150, 175, 200], max_stroke_mm: 400, min_pressure_rubber_mpa: 0.06, min_pressure_cushion_mpa: 0.1, rail_ok: true, clevis_ok: true, label_sv: "ø16 mm" },
];

/** Fäste (sida 10, punkt 1). */
export interface CJ2Mounting extends CJ2Value {
  /** Porten sitter fast vinkelrätt — axiell port R går inte (sida 10, punkt 5, noterna). */
  port_fixed: boolean;
  /** Bara ø10 och ø16 (dubbelt gaffelfäste). */
  large_only: boolean;
}
export const CJ2_MOUNTINGS: CJ2Mounting[] = [
  { code: "B", port_fixed: false, large_only: false, label_sv: "Basutförande" },
  { code: "E", port_fixed: true, large_only: false, label_sv: "Dubbelsidig gänghals (double-side bossed)" },
  { code: "D", port_fixed: true, large_only: true, label_sv: "Dubbelt gaffelfäste (ø10, ø16)" },
  { code: "L", port_fixed: false, large_only: false, label_sv: "Enkelt fotfäste" },
  { code: "M", port_fixed: false, large_only: false, label_sv: "Dubbelt fotfäste" },
  { code: "F", port_fixed: false, large_only: false, label_sv: "Fläns vid kolvstången" },
  { code: "G", port_fixed: false, large_only: false, label_sv: "Fläns vid gaveln" },
];

export const CJ2_MAGNET: CJ2Value = { code: "D", label_sv: "Inbyggd magnet för givare (CDJ2)" };
export const CJ2_CUSHION: CJ2Value = { code: "A", label_sv: "Luftdämpning (ø10, ø16)" };
export const CJ2_PORT: CJ2Value = { code: "R", label_sv: "Axiell port i gaveln (ej fäste D och E)" };
export const CJ2_PIVOT: CJ2Value = { code: "N", label_sv: "Pivotfäste (T-fäste) medlevererat, bara fäste D" };
export interface CJ2RodEnd extends CJ2Value {
  large_only: boolean;
}
export const CJ2_ROD_ENDS: CJ2RodEnd[] = [
  { code: "V", large_only: true, label_sv: "Enkel knäled (ø10, ø16)" },
  { code: "W", large_only: true, label_sv: "Dubbel knäled (ø10, ø16)" },
  { code: "T", large_only: false, label_sv: "Kolvstångskåpa, platt" },
  { code: "U", large_only: false, label_sv: "Kolvstångskåpa, rund" },
];
export const CJ2_SWITCH_MOUNTS: CJ2Value[] = [
  { code: "A", label_sv: "Givarfäste för skena (ø10, ø16)" },
  { code: "B", label_sv: "Givarfäste för band" },
];

/**
 * Kabellängdens tillgänglighet per givare (sida 10, tabellen): fem tecken
 * för 0,5 m (Nil), 1 m (M), 3 m (L), 5 m (Z), ingen (N):
 *   S = standard (●), O = tillverkas på beställning (○), - = finns inte (—).
 */
export type CJ2LeadAvail = "S" | "O" | "-";
export interface CJ2Switch extends CJ2Value {
  kind: "reed" | "solid";
  band: boolean;
  rail: boolean;
  leads: string;
  /** Minsta slag [en givare, två givare] på band (sida 113, "olika sidor"). */
  band_min: [number, number] | null;
  /** Minsta slag [en givare, två givare] på skena (sida 113, "samma sida"). */
  rail_min: [number, number] | null;
}
const s = (code: string, label: string, leads: string, band_min: [number, number] | null, rail_min: [number, number] | null): CJ2Switch =>
  ({ code, kind: "solid", band: band_min !== null, rail: rail_min !== null, leads, band_min, rail_min, label_sv: label });
const r = (code: string, label: string, leads: string, band_min: [number, number] | null, rail_min: [number, number] | null): CJ2Switch =>
  ({ code, kind: "reed", band: band_min !== null, rail: rail_min !== null, leads, band_min, rail_min, label_sv: label });
/**
 * Tillämpliga givare (sida 10). H7C/H7NF/C73C/C80C är bandtyper; J79C,
 * F79F, A72, A72H, A73C, A80C och A79W är skentyper. Minsta slag ur sida 113.
 */
export const CJ2_SWITCHES: CJ2Switch[] = [
  s("M9N", "D-M9N, 3-tråd NPN, rak", "SSSO-", [10, 15], [10, 10]), s("M9P", "D-M9P, 3-tråd PNP, rak", "SSSO-", [10, 15], [10, 10]), s("M9B", "D-M9B, 2-tråd, rak", "SSSO-", [10, 15], [10, 10]),
  s("M9NV", "D-M9NV, 3-tråd NPN, vinklad", "SSSO-", [5, 15], [5, 5]), s("M9PV", "D-M9PV, 3-tråd PNP, vinklad", "SSSO-", [5, 15], [5, 5]), s("M9BV", "D-M9BV, 2-tråd, vinklad", "SSSO-", [5, 15], [5, 5]),
  s("H7C", "D-H7C, 2-tråd, kontakt (band)", "S-SSS", [10, 15], null), s("J79C", "D-J79C, 2-tråd, kontakt (skena)", "S-SSS", null, [5, 5]),
  s("M9NW", "D-M9NW, NPN, tvåfärgsindikering, rak", "SSSO-", [10, 15], [15, 15]), s("M9PW", "D-M9PW, PNP, tvåfärgsindikering, rak", "SSSO-", [10, 15], [15, 15]), s("M9BW", "D-M9BW, 2-tråd, tvåfärgsindikering, rak", "SSSO-", [10, 15], [15, 15]),
  s("M9NWV", "D-M9NWV, NPN, tvåfärgsindikering, vinklad", "SSSO-", [10, 15], [10, 15]), s("M9PWV", "D-M9PWV, PNP, tvåfärgsindikering, vinklad", "SSSO-", [10, 15], [10, 15]), s("M9BWV", "D-M9BWV, 2-tråd, tvåfärgsindikering, vinklad", "SSSO-", [10, 15], [10, 15]),
  s("M9NA", "D-M9NA, NPN, vattentät, rak", "OOSO-", [10, 15], [15, 20]), s("M9PA", "D-M9PA, PNP, vattentät, rak", "OOSO-", [10, 15], [15, 20]), s("M9BA", "D-M9BA, 2-tråd, vattentät, rak", "OOSO-", [10, 15], [15, 20]),
  s("M9NAV", "D-M9NAV, NPN, vattentät, vinklad", "OOSO-", [10, 15], [10, 15]), s("M9PAV", "D-M9PAV, PNP, vattentät, vinklad", "OOSO-", [10, 15], [10, 15]), s("M9BAV", "D-M9BAV, 2-tråd, vattentät, vinklad", "OOSO-", [10, 15], [10, 15]),
  s("H7NF", "D-H7NF, 4-tråd NPN, diagnostikutgång (band)", "S-SO-", [10, 15], null), s("F79F", "D-F79F, 4-tråd NPN, diagnostikutgång (skena)", "S-SO-", null, [10, 15]),
  r("A96", "D-A96, reed 3-tråd, rak", "SSSS-", [10, 15], [10, 10]), r("A96V", "D-A96V, reed 3-tråd, vinklad", "SSSS-", [5, 10], [5, 10]),
  r("A72", "D-A72, reed 200 V, vinklad (skena)", "S-S--", null, [5, 10]), r("A72H", "D-A72H, reed 200 V, rak (skena)", "S-S--", null, [5, 10]),
  r("A93", "D-A93, reed 2-tråd, rak", "SSSS-", [10, 15], [10, 10]), r("A93V", "D-A93V, reed 2-tråd, vinklad", "SSSS-", [5, 10], [5, 10]),
  r("A90", "D-A90, reed utan indikering, rak", "SSSS-", [10, 15], [10, 10]), r("A90V", "D-A90V, reed utan indikering, vinklad", "SSSS-", [5, 10], [5, 10]),
  r("C73C", "D-C73C, reed kontakt (band)", "S-SSS", [10, 15], null), r("A73C", "D-A73C, reed kontakt (skena)", "S-SSS", null, [5, 10]),
  r("C80C", "D-C80C, reed kontakt utan indikering (band)", "S-SSS", [10, 15], null), r("A80C", "D-A80C, reed kontakt utan indikering (skena)", "S-SSS", null, [5, 10]),
  r("A79W", "D-A79W, reed tvåfärgsindikering (skena)", "S-S--", null, [10, 15]),
];

export const CJ2_LEADS: CJ2Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
  { code: "N", label_sv: "Utan kabel (kontaktgivare)" },
];
/** Index i givarens `leads`-sträng: "" (0,5 m) = 0, M = 1, L = 2, Z = 3, N = 4. */
export const CJ2_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3, N: 4 };
export function cj2LeadAvail(sw: CJ2Switch, lead: string): CJ2LeadAvail {
  return sw.leads[CJ2_LEAD_INDEX[lead] ?? 0] as CJ2LeadAvail;
}

export const CJ2_COUNTS: CJ2Value[] = [{ code: "S", label_sv: "1 givare (standard är 2)" }];

export interface CJ2Mto extends CJ2Value {
  bores?: string[];
  /** Går inte med luftdämpning (sida 8, not 4; sida 11). */
  no_cushion?: boolean;
  /** Går inte med givare (sida 8, not 3; sida 11). */
  no_switch?: boolean;
  /** Givare bara på band (sida 8, not 2 och 11). */
  band_only?: boolean;
  /** Kräver fästet D (sida 118: "Applicable cylinders: double clevis type"). */
  mounting?: string;
}
/**
 * Specialutföranden för dubbelverkande CJ2 (sida 11, kryssad mot
 * kombinationstabellen sida 8). -X773 finns bara för enkelverkande
 * fjäderretur (sida 8: "—" för DA; sida 117) och ingår inte. -X446 är ø10/16
 * enligt sida 8, fast sida 11 inte skriver ut det.
 */
export const CJ2_MTO: CJ2Mto[] = [
  { code: "XA", label_sv: "-XA□ Ändrad kolvstångsände (XA-nummer anges vid beställning)" },
  { code: "XB6", no_cushion: true, no_switch: true, label_sv: "-XB6 Värmebeständig –10…150 °C (utan givare och luftdämpning)" },
  { code: "XB7", no_cushion: true, no_switch: true, label_sv: "-XB7 Köldbeständig –40…70 °C (utan givare och luftdämpning)" },
  { code: "XB9", no_cushion: true, label_sv: "-XB9 Låg hastighet 10–50 mm/s (utan luftdämpning)" },
  { code: "XB13", bores: ["6"], no_cushion: true, label_sv: "-XB13 Låg hastighet 5–50 mm/s (ø6, utan luftdämpning)" },
  { code: "XC3", no_cushion: true, band_only: true, label_sv: "-XC3 Speciell portplacering (utan luftdämpning; givare bara på band)" },
  { code: "XC8", bores: ["10", "16"], no_cushion: true, label_sv: "-XC8 Justerbart slag, plus-sidan (ø10, ø16, utan luftdämpning)" },
  { code: "XC9", bores: ["10", "16"], no_cushion: true, label_sv: "-XC9 Justerbart slag, minus-sidan (ø10, ø16, utan luftdämpning)" },
  { code: "XC10", bores: ["10", "16"], no_cushion: true, label_sv: "-XC10 Dubbelslag, dubbel kolvstång (ø10, ø16, utan luftdämpning)" },
  { code: "XC11", bores: ["10", "16"], no_cushion: true, label_sv: "-XC11 Dubbelslag, enkel kolvstång (ø10, ø16, utan luftdämpning)" },
  { code: "XC22", no_cushion: true, label_sv: "-XC22 Fluorgummitätningar (utan luftdämpning)" },
  { code: "XC51", label_sv: "-XC51 Med slangnippel" },
  { code: "XC85", label_sv: "-XC85 Fett för livsmedelsindustrin" },
  { code: "X446", bores: ["10", "16"], label_sv: "-X446 PTFE-fett (ø10, ø16)" },
  { code: "X2838", bores: ["10", "16"], no_cushion: true, mounting: "D", band_only: true, label_sv: "-X2838 Dubbelt gaffelfäste med snabbsprint och T-fäste (fäste D, ø10/16, utan luftdämpning, givare bara på band)" },
];

export const CJ2_LIMITS = {
  max_pressure_mpa: 0.7,
  proof_pressure_mpa: 1.0,
  temp_c: { without_switch: [-10, 70], with_switch: [-10, 60] },
  speed_mm_s: { rubber: [50, 750], cushion: [50, 1000] },
} as const;

export interface CJ2Config {
  bore: string;
  mounting: string;
  stroke_mm: number;
  magnet?: boolean;
  cushion?: boolean;
  port?: string;
  pivot?: string;
  rod_end?: string;
  switch_mount?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string | undefined) =>
  kod !== undefined && lista.some((v) => v.code === kod);

export function cj2BuildCode(c: CJ2Config): string | null {
  const bore = CJ2_BORES.find((b) => b.code === c.bore);
  const mounting = CJ2_MOUNTINGS.find((x) => x.code === c.mounting);
  if (!bore || !mounting) return null;
  if (mounting.large_only && !bore.clevis_ok) return null;
  const mto = c.mto ?? "";
  const m = mto ? CJ2_MTO.find((x) => x.code === mto) : undefined;
  if (mto && !m) return null;
  const st = c.stroke_mm;
  if (!Number.isInteger(st) || st < 1 || st > bore.max_stroke_mm) return null;
  const cushion = c.cushion === true;
  if (cushion && bore.min_pressure_cushion_mpa === null) return null;
  const port = c.port ?? "";
  if (port && (port !== CJ2_PORT.code || mounting.port_fixed)) return null;
  const pivot = c.pivot ?? "";
  if (pivot && (pivot !== CJ2_PIVOT.code || mounting.code !== "D")) return null;
  const rodEnd = c.rod_end ?? "";
  if (rodEnd) {
    const re = CJ2_ROD_ENDS.find((x) => x.code === rodEnd);
    if (!re || (re.large_only && !bore.clevis_ok)) return null;
  }
  const magnet = c.magnet === true;
  const mount = c.switch_mount ?? "";
  if (mount && !har(CJ2_SWITCH_MOUNTS, mount)) return null;
  if (magnet !== (mount !== "")) return null;
  if (mount === "A" && !bore.rail_ok) return null;
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = CJ2_SWITCHES.find((x) => x.code === sw);
    if (!g || !mount) return null;
    if (mount === "B" && !g.band) return null;
    if (mount === "A" && !g.rail) return null;
    if (lead && (!har(CJ2_LEADS, lead) || cj2LeadAvail(g, lead) === "-")) return null;
    if (count && !har(CJ2_COUNTS, count)) return null;
  } else if (lead || count) return null;
  if (m) {
    if (m.bores && !m.bores.includes(bore.code)) return null;
    if (m.no_cushion && cushion) return null;
    if (m.no_switch && sw) return null;
    if (m.band_only && mount === "A") return null;
    if (m.mounting && mounting.code !== m.mounting) return null;
  }
  const g1 = `C${magnet ? "D" : ""}J2${mounting.code}${bore.code}`;
  const g2 = `${st}${cushion ? "A" : ""}${port}Z`;
  const g3 = `${pivot}${rodEnd}`;
  const g4 = `${sw}${lead}${count}`;
  return [g1, g2, g3, g4, mount, mto].filter((g, i) => i < 2 || g).join("-");
}

export function cj2ParseCode(raw: string): { config: CJ2Config } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...CJ2_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(
    `^C(D?)J2([BEDLMFG])(6|10|16)-(\\d{1,3})(A?)(R?)Z(?:-(N?)([VWTU]?))?(?:-(${givare})([MLZN])?(S)?)?(?:-([AB]))?(?:-(X[A-Z0-9]+))?$`,
  );
  const m = re.exec(k);
  if (!m) return null;
  const [, magnet, mounting, bore, stroke, cushion, port, pivot, rodEnd, sw, lead, count, mount, mto] = m;
  const c: CJ2Config = {
    bore, mounting, stroke_mm: Number(stroke), magnet: magnet === "D", cushion: cushion === "A", port: port || undefined,
    pivot: pivot || undefined, rod_end: rodEnd || undefined, switch: sw || undefined, lead: lead || undefined,
    count: count || undefined, switch_mount: mount || undefined, mto: mto || undefined,
  };
  if (cj2BuildCode(c) !== k) return null;
  return { config: c };
}

export const CJ2_ORDER_CODE_TEMPLATE =
  "C{magnet}J2{mounting}{bore}-{stroke_mm}{cushion}{port}Z-{pivot}{rod_end}-{switch}{lead}{count}-{switch_mount}-{mto}";

/**
 * SMC CJP — stiftcylinder (pin cylinder), enkelverkande fjäderretur,
 * ø4/6/10/16, slag 5/10/15.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Pin Cylinder: Single Acting, Spring Return CJP Series" (katalog,
 *   10 sidor). Ligger i knowledge_chunks som source_file = 'smc-kat-cjp.pdf'.
 *   PDF-sidor (katalogsidor inom parentes; meddelandena citerar katalogsidan):
 *     - How to Order, specifikationer               sida 2 (1)
 *     - vikt, teoretisk kraft, fjäderkraft           sida 3 (2)
 *     - specialutföranden -XC17, -XC22               sida 8 (7)
 *
 * KODENS FORM (sida 2):
 *
 *   CJP B 16 - 15 H4 Z - □ T - □
 *   CJP{fäste}{ø}-{slag}{slangnippel}Z-{gänga}{kolvstångskåpa}-{special}
 *
 * Nyckelns exempel CJPB16-15H4Z-T byggs tecken för tecken. Gängan är
 * standard (Nil); B betyder utan gänga, och kåpan T/U förutsätter gänga
 * ("Applicable for rod end with thread type"). Slangnippeln H4/H6 finns bara
 * för panelmontaget B och inte för ø4. Specialutförandena är ø6–16; -XC17
 * levereras utan gänga men B skrivs inte ("The symbol B for the rod end
 * type is not used any more", sida 8).
 */

export const CJP_SOURCE = {
  file: "smc-kat-cjp.pdf",
  edition: "SMC CJP catalogue (10 pages)",
  title: "SMC Pin Cylinder CJP Series",
  brand: "SMC",
} as const;

export interface CJPValue {
  code: string;
  label_sv: string;
}

export interface CJPBore extends CJPValue {
  bore_mm: number;
  min_pressure_mpa: number;
  /** Teoretisk kraft ut vid 0,5 MPa och fjäderns returkraft (sida 3). */
  force_out_05_n: number;
  force_in_n: number;
  /** Slangnippel och specialutföranden är ø6–16 (sida 2). */
  nipple_ok: boolean;
  mto_ok: boolean;
}

export const CJP_BORES: CJPBore[] = [
  { code: "4", bore_mm: 4, min_pressure_mpa: 0.3, force_out_05_n: 3.48, force_in_n: 1.0, nipple_ok: false, mto_ok: false, label_sv: "ø4 mm" },
  { code: "6", bore_mm: 6, min_pressure_mpa: 0.2, force_out_05_n: 10.2, force_in_n: 1.42, nipple_ok: true, mto_ok: true, label_sv: "ø6 mm" },
  { code: "10", bore_mm: 10, min_pressure_mpa: 0.15, force_out_05_n: 33.3, force_in_n: 2.45, nipple_ok: true, mto_ok: true, label_sv: "ø10 mm" },
  { code: "16", bore_mm: 16, min_pressure_mpa: 0.15, force_out_05_n: 84.7, force_in_n: 5.04, nipple_ok: true, mto_ok: true, label_sv: "ø16 mm" },
];

export const CJP_MOUNTINGS: CJPValue[] = [
  { code: "B", label_sv: "Panelmontage (två fästmuttrar)" },
  { code: "S", label_sv: "Inbyggt montage (fästmutter och packning)" },
];
/** Standardslag, samma för alla borrningar (sida 2). Inga mellanslag. */
export const CJP_STROKES = [5, 10, 15];
export const CJP_NIPPLES: CJPValue[] = [
  { code: "H4", label_sv: "Slangnippel för ø4/ø2,5-slang (panelmontage B, ø6–16)" },
  { code: "H6", label_sv: "Slangnippel för ø6/ø4-slang (panelmontage B, ø6–16)" },
];
export const CJP_ROD_THREAD: CJPValue = { code: "B", label_sv: "Kolvstång utan gänga (standard är gängad)" };
export const CJP_CAPS: CJPValue[] = [
  { code: "T", label_sv: "Kolvstångskåpa, platt (kräver gängad kolvstång)" },
  { code: "U", label_sv: "Kolvstångskåpa, rund (kräver gängad kolvstång)" },
];
export const CJP_MTO: CJPValue[] = [
  { code: "XC17", label_sv: "-XC17 Härdad kolvstångsände, utan gänga (ø6–16)" },
  { code: "XC22", label_sv: "-XC22 Fluorgummitätningar (ø6–16)" },
];

export const CJP_LIMITS = {
  max_pressure_mpa: 0.7,
  proof_pressure_mpa: 1.0,
  temp_c: [-10, 70],
  speed_mm_s: [50, 500],
} as const;

export interface CJPConfig {
  bore: string;
  mounting: string;
  stroke_mm: number;
  nipple?: string;
  rod_thread?: string;
  cap?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string | undefined) =>
  kod !== undefined && lista.some((v) => v.code === kod);

export function cjpBuildCode(c: CJPConfig): string | null {
  const bore = CJP_BORES.find((b) => b.code === c.bore);
  if (!bore || !har(CJP_MOUNTINGS, c.mounting)) return null;
  if (!CJP_STROKES.includes(c.stroke_mm)) return null;
  const nipple = c.nipple ?? "";
  if (nipple && (!har(CJP_NIPPLES, nipple) || c.mounting !== "B" || !bore.nipple_ok)) return null;
  const thread = c.rod_thread ?? "";
  if (thread && thread !== CJP_ROD_THREAD.code) return null;
  const cap = c.cap ?? "";
  if (cap && (!har(CJP_CAPS, cap) || thread)) return null;
  const mto = c.mto ?? "";
  if (mto) {
    if (!har(CJP_MTO, mto) || !bore.mto_ok) return null;
    if (mto === "XC17" && (thread || cap)) return null;
  }
  const g1 = `CJP${c.mounting}${bore.code}`;
  const g2 = `${c.stroke_mm}${nipple}Z`;
  const g3 = `${thread}${cap}`;
  return [g1, g2, g3, mto].filter((g, i) => i < 2 || g).join("-");
}

export function cjpParseCode(raw: string): { config: CJPConfig } | null {
  const k = raw.trim().toUpperCase();
  const m = /^CJP([BS])(4|6|10|16)-(5|10|15)(H4|H6)?Z(?:-(B)?([TU])?)?(?:-(XC17|XC22))?$/.exec(k);
  if (!m) return null;
  const [, mounting, bore, stroke, nipple, thread, cap, mto] = m;
  const c: CJPConfig = {
    bore, mounting, stroke_mm: Number(stroke), nipple: nipple || undefined, rod_thread: thread || undefined,
    cap: cap || undefined, mto: mto || undefined,
  };
  if (cjpBuildCode(c) !== k) return null;
  return { config: c };
}

export const CJP_ORDER_CODE_TEMPLATE = "CJP{mounting}{bore}-{stroke_mm}{nipple}Z-{rod_thread}{cap}-{mto}";

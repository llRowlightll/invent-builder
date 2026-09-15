/**
 * SMC C85 — rund cylinder enligt ISO 6432, dubbelverkande enkel kolvstång,
 * ø8–ø25.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "ISO Standards Air Cylinder C85/C75 Series" (katalogutdrag, 121
 *   sidor). Ligger i knowledge_chunks som source_file = 'smc-kat-c85.pdf'.
 *   PDF-sidor:
 *     - How to Order, dubbelverkande C85     sida 3 (katalogsida 6)
 *     - specifikationer, slag, special       sida 4 (7)
 *     - fästen och tillbehör                 sida 5 (8)
 *
 * VAD FAMILJEN ÄR. Katalogen har tolv nycklar: C85 standard DA, C85W dubbel
 * kolvstång, C85-S/T enkelverkande, C85K ej roterande (DA och SA), C85R
 * direktmonterad, samt C75-serien (samma sex nycklar, en rundcylinder utan
 * ISO-mått). Familjen `c85` är standardcylindern DA enkel kolvstång, det
 * produkterna SMC-C85N16…N25 är. De övriga är egna nycklar.
 *
 * KODENS FORM (sida 3):
 *
 *   C D 85 N 20 - 40 C J L V - B - M9BW S - □
 *   C{magnet}85{gavel}{ø}-{slag}{dämpning}{bälg}{fäste}{tillbehör}-{givarfäste}-{givare}{kabel}{antal}-{special}
 *
 * Magneten "D" gör C85 till CD85. Givarfästet (A skena / B band) anges bara
 * med magnet: "The symbol is Nil for no magnet". Katalogens exempel
 * CD85N20-50CNW-B-M9BW (sida 4) byggs tecken för tecken.
 *
 * ø32 OCH ø40 FINNS INTE. ISO 6432 slutar vid ø25, och katalogens C85 går
 * ø8–25. Produkterna SMC-C85N32 och SMC-C85N40 är påhittade.
 */

export const C85_SOURCE = {
  file: "smc-kat-c85.pdf",
  edition: "SMC C85/C75 catalogue (catalogue pages 6–124)",
  title: "SMC ISO Standards Air Cylinder C85 Series",
  brand: "SMC",
} as const;

export interface C85Value {
  code: string;
  label_sv: string;
}

export interface C85Bore extends C85Value {
  bore_mm: number;
  standard_strokes: number[];
  /** Största slag i standardnyckeln; därutöver -X2018 (sida 4, not 3). */
  max_stroke_mm: number;
  min_pressure_rubber_mpa: number;
  /** null = luftdämpning finns inte (ø8). */
  min_pressure_cushion_mpa: number | null;
}

export const C85_BORES: C85Bore[] = [
  { code: "8", bore_mm: 8, standard_strokes: [10, 25, 40, 50, 80, 100], max_stroke_mm: 200, min_pressure_rubber_mpa: 0.1, min_pressure_cushion_mpa: null, label_sv: "ø8 mm" },
  { code: "10", bore_mm: 10, standard_strokes: [10, 25, 40, 50, 80, 100], max_stroke_mm: 200, min_pressure_rubber_mpa: 0.08, min_pressure_cushion_mpa: 0.08, label_sv: "ø10 mm" },
  { code: "12", bore_mm: 12, standard_strokes: [10, 25, 40, 50, 80, 100, 125, 160, 200], max_stroke_mm: 400, min_pressure_rubber_mpa: 0.08, min_pressure_cushion_mpa: 0.08, label_sv: "ø12 mm" },
  { code: "16", bore_mm: 16, standard_strokes: [10, 25, 40, 50, 80, 100, 125, 160, 200], max_stroke_mm: 400, min_pressure_rubber_mpa: 0.05, min_pressure_cushion_mpa: 0.05, label_sv: "ø16 mm" },
  { code: "20", bore_mm: 20, standard_strokes: [10, 25, 40, 50, 80, 100, 125, 160, 200, 250, 300], max_stroke_mm: 1000, min_pressure_rubber_mpa: 0.05, min_pressure_cushion_mpa: 0.05, label_sv: "ø20 mm" },
  { code: "25", bore_mm: 25, standard_strokes: [10, 25, 40, 50, 80, 100, 125, 160, 200, 250, 300], max_stroke_mm: 1000, min_pressure_rubber_mpa: 0.05, min_pressure_cushion_mpa: 0.05, label_sv: "ø25 mm" },
];

/** Gaveltyp (sida 3). Luftdämpning finns bara med N. */
export interface C85Cover extends C85Value {
  air_cushion_ok: boolean;
  /** Fästen som går med gaveln (sida 3, "Applicable mounting bracket"). */
  brackets: string[];
}
export const C85_COVERS: C85Cover[] = [
  { code: "N", air_cushion_ok: true, brackets: ["L", "M", "G", "U", "N"], label_sv: "Basgavel med integrerat gaffelfäste" },
  { code: "E", air_cushion_ok: false, brackets: ["L", "M", "G", "U"], label_sv: "Dubbel ände utan nav (boss-cut)" },
  { code: "F", air_cushion_ok: false, brackets: ["L", "G", "U"], label_sv: "Boss-cut/basgavel" },
  { code: "Y", air_cushion_ok: false, brackets: ["L", "G", "U"], label_sv: "Gavel med axiell anslutning" },
];

export const C85_MAGNET: C85Value = { code: "D", label_sv: "Inbyggd magnet för givare (CD85)" };
export const C85_CUSHION: C85Value = { code: "C", label_sv: "Luftdämpning (ej ø8, bara gavel N, slag ≥ 25 mm)" };
export const C85_BOOTS: C85Value[] = [
  { code: "J", label_sv: "Bälg i nylon (ø20, ø25)" },
  { code: "K", label_sv: "Värmebeständig bälg (ø20, ø25)" },
];
export const C85_BOOT_BORES = ["20", "25"];
export const C85_BRACKETS: C85Value[] = [
  { code: "L", label_sv: "Enkelt fotfäste" },
  { code: "M", label_sv: "Dubbelt fotfäste" },
  { code: "G", label_sv: "Fläns" },
  { code: "U", label_sv: "Tappfäste" },
  { code: "N", label_sv: "Gaffelfäste" },
];
export const C85_ACCESSORIES: C85Value[] = [
  { code: "V", label_sv: "Kolvstångsände (rod end)" },
  { code: "W", label_sv: "Dubbelt knäled" },
];
export const C85_SWITCH_MOUNTS: C85Value[] = [
  { code: "A", label_sv: "Givarfäste för skena (rail)" },
  { code: "B", label_sv: "Givarfäste för band" },
];

export interface C85Switch extends C85Value {
  kind: "reed" | "solid";
  band: boolean;
  rail: boolean;
  /** Borrningar där modellen INTE går på band respektive skena (sida 3, noterna). */
  band_not: string[];
  rail_not: string[];
}
const SMA = ["8", "10", "12"];
const STORA = ["20", "25"];
const s = (code: string, label: string, o: Partial<C85Switch> = {}): C85Switch =>
  ({ code, kind: "solid", band: true, rail: true, band_not: [], rail_not: [], label_sv: label, ...o });
const r = (code: string, label: string, o: Partial<C85Switch> = {}): C85Switch =>
  ({ code, kind: "reed", band: true, rail: true, band_not: [], rail_not: [], label_sv: label, ...o });
/**
 * Tillämpliga givare (sida 3). M9-familjen går inte på skena i ø20/25;
 * A9-familjen går inte i ø8–12; A79W inte på skena i ø8–12. A72 och A72H
 * är båda skentyper (kolumnerna "Rail mounting", vinklad respektive rak);
 * bandkolumnerna är tomma för 200 V-reeden.
 */
export const C85_SWITCHES: C85Switch[] = [
  s("M9N", "D-M9N, 3-tråd NPN, rak", { rail_not: STORA }), s("M9P", "D-M9P, 3-tråd PNP, rak", { rail_not: STORA }), s("M9B", "D-M9B, 2-tråd, rak", { rail_not: STORA }),
  s("M9NV", "D-M9NV, 3-tråd NPN, vinklad", { rail_not: STORA }), s("M9PV", "D-M9PV, 3-tråd PNP, vinklad", { rail_not: STORA }), s("M9BV", "D-M9BV, 2-tråd, vinklad", { rail_not: STORA }),
  s("H7C", "D-H7C, 2-tråd, kontakt (band)", { rail: false }), s("J79C", "D-J79C, 2-tråd, kontakt (skena)", { band: false }),
  s("M9NW", "D-M9NW, NPN, tvåfärgsindikering, rak", { rail_not: STORA }), s("M9PW", "D-M9PW, PNP, tvåfärgsindikering, rak", { rail_not: STORA }), s("M9BW", "D-M9BW, 2-tråd, tvåfärgsindikering, rak", { rail_not: STORA }),
  s("M9NWV", "D-M9NWV, NPN, tvåfärgsindikering, vinklad", { rail_not: STORA }), s("M9PWV", "D-M9PWV, PNP, tvåfärgsindikering, vinklad", { rail_not: STORA }), s("M9BWV", "D-M9BWV, 2-tråd, tvåfärgsindikering, vinklad", { rail_not: STORA }),
  s("M9NA", "D-M9NA, NPN, vattentät, rak", { rail_not: STORA }), s("M9PA", "D-M9PA, PNP, vattentät, rak", { rail_not: STORA }), s("M9BA", "D-M9BA, 2-tråd, vattentät, rak", { rail_not: STORA }),
  s("M9NAV", "D-M9NAV, NPN, vattentät, vinklad", { rail_not: STORA }), s("M9PAV", "D-M9PAV, PNP, vattentät, vinklad", { rail_not: STORA }), s("M9BAV", "D-M9BAV, 2-tråd, vattentät, vinklad", { rail_not: STORA }),
  s("H7NF", "D-H7NF, 4-tråd NPN, diagnostikutgång (band)", { rail: false }), s("F79F", "D-F79F, 4-tråd NPN, diagnostikutgång (skena)", { band: false }),
  r("A96", "D-A96, reed 3-tråd, rak (ø16–25)", { band_not: SMA, rail_not: SMA }), r("A96V", "D-A96V, reed 3-tråd, vinklad (ø16–25)", { band_not: SMA, rail_not: SMA }),
  r("A72", "D-A72, reed 200 V, vinklad (skena)", { band: false }), r("A72H", "D-A72H, reed 200 V, rak (skena)", { band: false }),
  r("A93", "D-A93, reed 2-tråd, rak (ø16–25)", { band_not: SMA, rail_not: SMA }), r("A93V", "D-A93V, reed 2-tråd, vinklad (ø16–25)", { band_not: SMA, rail_not: SMA }),
  r("A90", "D-A90, reed utan indikering, rak (ø16–25)", { band_not: SMA, rail_not: SMA }), r("A90V", "D-A90V, reed utan indikering, vinklad (ø16–25)", { band_not: SMA, rail_not: SMA }),
  r("C73C", "D-C73C, reed kontakt (band)", { rail: false }), r("A73C", "D-A73C, reed kontakt (skena)", { band: false }),
  r("C80C", "D-C80C, reed kontakt utan indikering (band)", { rail: false }), r("A80C", "D-A80C, reed kontakt utan indikering (skena)", { band: false }),
  r("A79W", "D-A79W, reed tvåfärgsindikering (skena, ø16–25)", { band: false, rail_not: SMA }),
];

export const C85_LEADS: C85Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
  { code: "N", label_sv: "Utan kabel (kontaktgivare)" },
];
export const C85_COUNTS: C85Value[] = [{ code: "S", label_sv: "1 givare (standard är 2)" }];

export interface C85Mto extends C85Value {
  rubber_only?: boolean;
  bores?: string[];
  no_accessory?: boolean;
  /** -XA går inte med ø8 luftdämpning -- vilket inte finns ändå. */
  long_stroke?: boolean;
}
/** Specialutföranden (sida 4). */
export const C85_MTO: C85Mto[] = [
  { code: "XA", label_sv: "-XA Ändrad kolvstångsände" },
  { code: "XB6", rubber_only: true, bores: ["10", "12", "16", "20", "25"], no_accessory: true, label_sv: "-XB6 Värmebeständig –10…150 °C (gummidämpning ø10–25, utan tillbehör)" },
  { code: "XB7", rubber_only: true, bores: ["20", "25"], no_accessory: true, label_sv: "-XB7 Köldbeständig –40…70 °C (gummidämpning ø20–25, utan tillbehör)" },
  { code: "XB9", rubber_only: true, bores: ["20", "25"], label_sv: "-XB9 Låg hastighet 10–50 mm/s (gummidämpning ø20–25)" },
  { code: "XC4", rubber_only: true, bores: ["20", "25"], label_sv: "-XC4 Kraftig avstrykare (gummidämpning ø20–25)" },
  { code: "XC6", label_sv: "-XC6 Rostfritt utförande" },
  { code: "X2018", long_stroke: true, label_sv: "-X2018 Slag utöver standardområdet" },
];

export const C85_LIMITS = {
  max_pressure_mpa: 1.0,
  temp_c: { without_switch: [-20, 80], with_switch: [-10, 60] },
  speed_mm_s: [50, 1500],
  cushion_min_stroke_mm: 25,
} as const;

export interface C85Config {
  bore: string;
  cover: string;
  stroke_mm: number;
  magnet?: boolean;
  cushion?: boolean;
  boot?: string;
  bracket?: string;
  accessory?: string;
  switch_mount?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string | undefined) =>
  kod !== undefined && lista.some((v) => v.code === kod);

export function c85BuildCode(c: C85Config): string | null {
  const bore = C85_BORES.find((b) => b.code === c.bore);
  const cover = C85_COVERS.find((x) => x.code === c.cover);
  if (!bore || !cover) return null;
  const mto = c.mto ?? "";
  const m = mto ? C85_MTO.find((x) => x.code === mto) : undefined;
  if (mto && !m) return null;
  const s = c.stroke_mm;
  if (!Number.isInteger(s) || s < 1) return null;
  if (s > bore.max_stroke_mm && !m?.long_stroke) return null;
  if (m?.long_stroke && s <= bore.max_stroke_mm) return null;
  const cushion = c.cushion === true;
  if (cushion) {
    if (bore.min_pressure_cushion_mpa === null || !cover.air_cushion_ok || s < C85_LIMITS.cushion_min_stroke_mm) return null;
  }
  const boot = c.boot ?? "";
  if (boot && (!har(C85_BOOTS, boot) || !C85_BOOT_BORES.includes(bore.code))) return null;
  const bracket = c.bracket ?? "";
  if (bracket && (!har(C85_BRACKETS, bracket) || !cover.brackets.includes(bracket))) return null;
  const accessory = c.accessory ?? "";
  if (accessory && !har(C85_ACCESSORIES, accessory)) return null;
  const magnet = c.magnet === true;
  const mount = c.switch_mount ?? "";
  if (mount && !har(C85_SWITCH_MOUNTS, mount)) return null;
  if (magnet !== (mount !== "")) return null;
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = C85_SWITCHES.find((x) => x.code === sw);
    if (!g || !mount) return null;
    if (mount === "B" && (!g.band || g.band_not.includes(bore.code))) return null;
    if (mount === "A" && (!g.rail || g.rail_not.includes(bore.code))) return null;
    if (lead && !har(C85_LEADS, lead)) return null;
    if (count && !har(C85_COUNTS, count)) return null;
  } else if (lead || count) return null;
  if (m) {
    if (m.rubber_only && cushion) return null;
    if (m.bores && !m.bores.includes(bore.code)) return null;
    if (m.no_accessory && accessory) return null;
  }
  const g1 = `C${magnet ? "D" : ""}85${cover.code}${bore.code}`;
  const g2 = `${s}${cushion ? "C" : ""}${boot}${bracket}${accessory}`;
  const g4 = `${sw}${lead}${count}`;
  return [g1, g2, mount, g4, mto].filter((g, i) => i < 2 || g).join("-");
}

export function c85ParseCode(raw: string): { config: C85Config } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...C85_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(
    `^C(D?)85([NEFY])(8|10|12|16|20|25)-(\\d{1,4})(C?)([JK]?)([LMGUN]?)([VW]?)(?:-([AB]))?(?:-(${givare})([MLZN])?(S)?)?(?:-(X[A-Z0-9]+))?$`,
  );
  const m = re.exec(k);
  if (!m) return null;
  const [, magnet, cover, bore, stroke, cushion, boot, bracket, accessory, mount, sw, lead, count, mto] = m;
  const c: C85Config = {
    bore, cover, stroke_mm: Number(stroke), magnet: magnet === "D", cushion: cushion === "C", boot: boot || undefined,
    bracket: bracket || undefined, accessory: accessory || undefined, switch_mount: mount || undefined, switch: sw || undefined,
    lead: lead || undefined, count: count || undefined, mto: mto || undefined,
  };
  if (c85BuildCode(c) !== k) return null;
  return { config: c };
}

export const C85_ORDER_CODE_TEMPLATE =
  "C{magnet}85{cover}{bore}-{stroke_mm}{cushion}{boot}{bracket}{accessory}-{switch_mount}-{switch}{lead}{count}-{mto}";

/**
 * SMC CM2 (Z1) — rund cylinder, dubbelverkande enkel kolvstång, ø20–40.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Air Cylinder CM2 Series" (CM2-Z1, katalog, 76 sidor). Ligger i
 *   knowledge_chunks som source_file = 'smc-kat-cm2-z1.pdf'.
 *   PDF-sidor (katalogsidor inom parentes; meddelandena citerar katalogsidan):
 *     - kombinationstabell standard/special         sida 5  (4)
 *     - How to Order, dubbelverkande CM2, givare     sida 6  (5)
 *     - specifikationer, standardslag, special,
 *       beställningsexempel                          sida 7  (6)
 *     - montage och tillbehör                        sida 8  (7)
 *     - minsta slag för givarmontage                 sida 63 (62)
 *     - -XC4□ och -XC6□                              sida 71–72 (70–71)
 *
 * VARFÖR Z1 OCH INTE Z. Katalogen på disk (smc-kat-cm2.pdf) är CM2-Z, och
 * dess sida 234 markerar standardcylindern (dubbelverkande enkel kolvstång,
 * med och utan magnet, gummi och luft) som utgången i november 2025:
 * "Please select the CM2-Z1 series instead". Familjen modelleras därför ur
 * efterföljaren, hämtad 2026-09-15. CM2W, enkelverkande, CM2K, CM2KW, CM2R
 * är egna nycklar; lufthydraul-typen H finns inte i Z1.
 *
 * KODENS FORM (sida 6):
 *
 *   C D M2 B 40 □ - 150 A □ □ Z1 - □ □ - M9BW □ - □
 *   C{magnet}M2{fäste}{ø}{gänga}-{slag}{dämpning}{stångände}{bälg}Z1-{pivot}{kolvstångstillbehör}-{givare}{kabel}{antal}-{special}
 *
 * Beställningsexemplet CDM2C20-50Z1-NV-M9BW (sida 7) byggs tecken för tecken.
 * Honstång F utesluter bälg och kolvstångstillbehör; pivotfästet N finns
 * bara för C, T, U, E, V och UZ (sida 6).
 */

export const CM2_SOURCE = {
  file: "smc-kat-cm2-z1.pdf",
  edition: "SMC CM2-Z1 catalogue (76 pages)",
  title: "SMC Air Cylinder CM2 Series (CM2-Z1)",
  brand: "SMC",
} as const;

export interface CM2Value {
  code: string;
  label_sv: string;
}

export interface CM2Bore extends CM2Value {
  bore_mm: number;
  /** "Manufacturable stroke" 5–max (sida 7); med bälg högst 1000. */
  max_stroke_mm: number;
}
/** Standardslag, samma för alla borrningar (sida 7). Mellanslag i 1 mm-steg på beställning. */
export const CM2_STANDARD_STROKES = [25, 50, 75, 100, 125, 150, 200, 250, 300];
export const CM2_BORES: CM2Bore[] = [
  { code: "20", bore_mm: 20, max_stroke_mm: 1000, label_sv: "ø20 mm" },
  { code: "25", bore_mm: 25, max_stroke_mm: 1500, label_sv: "ø25 mm" },
  { code: "32", bore_mm: 32, max_stroke_mm: 2000, label_sv: "ø32 mm" },
  { code: "40", bore_mm: 40, max_stroke_mm: 2000, label_sv: "ø40 mm" },
];

/** Fäste (sida 6, punkt 1). */
export interface CM2Mounting extends CM2Value {
  /** Pivotfästet N finns bara för dessa (sida 6). */
  pivot_ok: boolean;
  /** Fästmutter monterad på kroppen (sida 8) — förutsättning för -XC52. */
  mounting_nut: boolean;
  /** Gaffel-/tapptyper: bara med -XC6A, inte -XC6B (sida 72, not 1). */
  clevis_or_trunnion: boolean;
}
const f = (code: string, label: string, pivot_ok: boolean, mounting_nut: boolean, clevis_or_trunnion: boolean): CM2Mounting =>
  ({ code, pivot_ok, mounting_nut, clevis_or_trunnion, label_sv: label });
export const CM2_MOUNTINGS: CM2Mounting[] = [
  f("B", "Basutförande (dubbelsidig gänghals)", false, true, false),
  f("L", "Axiellt fotfäste", false, true, false),
  f("F", "Fläns vid kolvstången", false, true, false),
  f("G", "Fläns vid gaveln", false, true, false),
  f("C", "Enkelt gaffelfäste", true, false, true),
  f("D", "Dubbelt gaffelfäste", false, false, true),
  f("U", "Tappfäste vid kolvstången", true, false, true),
  f("T", "Tappfäste vid gaveln", true, false, true),
  f("E", "Integrerat gaffelfäste", true, false, true),
  f("V", "Integrerat gaffelfäste, 90°", true, false, true),
  f("BZ", "Boss-cut, basutförande", false, true, false),
  f("FZ", "Boss-cut, fläns vid kolvstången", false, true, false),
  f("UZ", "Boss-cut, tappfäste vid kolvstången", true, false, true),
];

export const CM2_PORTS: CM2Value[] = [
  { code: "TN", label_sv: "Portgänga NPT (standard är Rc)" },
  { code: "TF", label_sv: "Portgänga G (standard är Rc)" },
];
export const CM2_MAGNET: CM2Value = { code: "D", label_sv: "Inbyggd magnet för givare (CDM2)" };
export const CM2_CUSHION: CM2Value = { code: "A", label_sv: "Luftdämpning (standard är gummidämpning)" };
export const CM2_ROD_THREAD: CM2Value = { code: "F", label_sv: "Honstång (invändig gänga; utan bälg och tillbehör)" };
export const CM2_BOOTS: CM2Value[] = [
  { code: "J", label_sv: "Bälg i nylonduk, max 70 °C" },
  { code: "K", label_sv: "Värmebeständig bälg, max 110 °C" },
];
export const CM2_BOOT_MAX_STROKE_MM = 1000;
export const CM2_PIVOT: CM2Value = { code: "N", label_sv: "Pivotfäste medlevererat (bara fäste C, T, U, E, V, UZ)" };
export const CM2_ROD_ENDS: CM2Value[] = [
  { code: "V", label_sv: "Enkel knäled (utan sprint)" },
  { code: "W", label_sv: "Dubbel knäled" },
  { code: "Q", label_sv: "Kolvstångsände (rod end)" },
];

/** Kabellängdens tillgänglighet [0,5 m, M, L, Z]: S standard, O beställning. */
export interface CM2Switch extends CM2Value {
  kind: "reed" | "solid";
  leads: string;
  /** Minsta slag [en givare, två givare på olika sidor] (sida 63). */
  min: [number, number];
}
const s = (code: string, label: string, leads: string, min: [number, number], kind: "reed" | "solid" = "solid"): CM2Switch =>
  ({ code, kind, leads, min, label_sv: label });
/** Tillämpliga givare (sida 6); minsta slag ur sida 63. */
export const CM2_SWITCHES: CM2Switch[] = [
  s("M9N", "D-M9N, 3-tråd NPN, rak", "SSSO", [5, 15]), s("M9P", "D-M9P, 3-tråd PNP, rak", "SSSO", [5, 15]), s("M9B", "D-M9B, 2-tråd, rak", "SSSO", [5, 15]),
  s("M9NV", "D-M9NV, 3-tråd NPN, vinklad", "SSSO", [5, 15]), s("M9PV", "D-M9PV, 3-tråd PNP, vinklad", "SSSO", [5, 15]), s("M9BV", "D-M9BV, 2-tråd, vinklad", "SSSO", [5, 15]),
  s("M9NW", "D-M9NW, NPN, tvåfärgsindikering, rak", "SSSO", [10, 15]), s("M9PW", "D-M9PW, PNP, tvåfärgsindikering, rak", "SSSO", [10, 15]), s("M9BW", "D-M9BW, 2-tråd, tvåfärgsindikering, rak", "SSSO", [10, 15]),
  s("M9NWV", "D-M9NWV, NPN, tvåfärgsindikering, vinklad", "SSSO", [10, 15]), s("M9PWV", "D-M9PWV, PNP, tvåfärgsindikering, vinklad", "SSSO", [10, 15]), s("M9BWV", "D-M9BWV, 2-tråd, tvåfärgsindikering, vinklad", "SSSO", [10, 15]),
  s("M9NA", "D-M9NA, NPN, vattentät, rak", "OOSO", [10, 15]), s("M9PA", "D-M9PA, PNP, vattentät, rak", "OOSO", [10, 15]), s("M9BA", "D-M9BA, 2-tråd, vattentät, rak", "OOSO", [10, 15]),
  s("M9NAV", "D-M9NAV, NPN, vattentät, vinklad", "OOSO", [10, 15]), s("M9PAV", "D-M9PAV, PNP, vattentät, vinklad", "OOSO", [10, 15]), s("M9BAV", "D-M9BAV, 2-tråd, vattentät, vinklad", "OOSO", [10, 15]),
  s("A96", "D-A96, reed 3-tråd, rak", "SSSS", [5, 15], "reed"), s("A96V", "D-A96V, reed 3-tråd, vinklad", "SSSS", [5, 15], "reed"),
  s("A93", "D-A93, reed 2-tråd, rak", "SSSS", [5, 15], "reed"), s("A93V", "D-A93V, reed 2-tråd, vinklad", "SSSS", [5, 15], "reed"),
  s("A90", "D-A90, reed utan indikering, rak", "SSSS", [5, 15], "reed"), s("A90V", "D-A90V, reed utan indikering, vinklad", "SSSS", [5, 15], "reed"),
];
export const CM2_LEADS: CM2Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
export const CM2_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3 };
export const CM2_COUNTS: CM2Value[] = [{ code: "S", label_sv: "1 givare (standard är 2)" }];

export interface CM2Mto extends CM2Value {
  /** Gummidämpning bara (sida 7, not 1 / sida 71). */
  rubber_only?: boolean;
  /** Luftdämpning på begäran (sida 5, ○). */
  air_on_request?: boolean;
  /** Inte med givare (sida 5, not 2). */
  no_switch?: boolean;
  /** Inte med bälg (sida 71). */
  no_boot?: boolean;
  /** Största slag (sida 72, tabell 1). */
  max_stroke_mm?: number;
  /** Gaffel-/tappfästen bara med -XC6A (sida 72, not 1). */
  no_clevis?: boolean;
  /** Kräver dubbel knäled W (sida 73). */
  needs_rod_end?: string;
  /** Kräver fäste med fästmutter (sida 74 och 8). */
  needs_mounting_nut?: boolean;
}
/** Specialutföranden för dubbelverkande CM2 (sida 7, kryssade mot sida 5). */
export const CM2_MTO: CM2Mto[] = [
  { code: "XB6", no_switch: true, label_sv: "-XB6 Värmebeständig –10…150 °C (utan givare)" },
  { code: "XB7", no_switch: true, rubber_only: true, label_sv: "-XB7 Köldbeständig –40…70 °C (utan givare, gummidämpning)" },
  { code: "XB9", air_on_request: true, label_sv: "-XB9 Låg hastighet 10–50 mm/s (gummidämpning; luft på begäran)" },
  { code: "XC3", label_sv: "-XC3 Speciell portplacering" },
  { code: "XC4A", rubber_only: true, no_boot: true, label_sv: "-XC4A Dammtålig med två smörjhållare (gummidämpning, utan bälg)" },
  { code: "XC4B", rubber_only: true, no_boot: true, label_sv: "-XC4B Dammtålig med smörjhållare och kraftig avstrykare (gummidämpning, utan bälg)" },
  { code: "XC4C", no_boot: true, label_sv: "-XC4C Dammtålig med kraftig avstrykare (utan bälg)" },
  { code: "XC6A", max_stroke_mm: 1000, label_sv: "-XC6A Rostfri kolvstång och stångmutter (slag ≤ 1000)" },
  { code: "XC6B", max_stroke_mm: 1000, no_clevis: true, label_sv: "-XC6B Rostfri kolvstång, muttrar, låsring och fäste (slag ≤ 1000; ej gaffel-/tappfäste)" },
  { code: "XC29", needs_rod_end: "W", label_sv: "-XC29 Dubbel knäled med fjädersprint (kräver tillbehör W)" },
  { code: "XC52", needs_mounting_nut: true, label_sv: "-XC52 Fästmutter med stoppskruv (fäste B, L, F, G, BZ, FZ)" },
  { code: "XC85", label_sv: "-XC85 Fett för livsmedelsindustrin" },
  { code: "X446", label_sv: "-X446 PTFE-fett" },
];

export const CM2_LIMITS = {
  max_pressure_mpa: 1.0,
  min_pressure_mpa: 0.05,
  proof_pressure_mpa: 1.5,
  temp_c: { without_switch: [-10, 70], with_switch: [-10, 60] },
  speed_mm_s: { rubber: [50, 750], cushion: [50, 1000] },
  min_stroke_mm: 5,
} as const;

export interface CM2Config {
  bore: string;
  mounting: string;
  stroke_mm: number;
  magnet?: boolean;
  port?: string;
  cushion?: boolean;
  rod_thread?: string;
  boot?: string;
  pivot?: string;
  rod_end?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string | undefined) =>
  kod !== undefined && lista.some((v) => v.code === kod);

export function cm2BuildCode(c: CM2Config): string | null {
  const bore = CM2_BORES.find((b) => b.code === c.bore);
  const mounting = CM2_MOUNTINGS.find((m) => m.code === c.mounting);
  if (!bore || !mounting) return null;
  const mto = c.mto ?? "";
  const m = mto ? CM2_MTO.find((x) => x.code === mto) : undefined;
  if (mto && !m) return null;
  const st = c.stroke_mm;
  if (!Number.isInteger(st) || st < CM2_LIMITS.min_stroke_mm || st > bore.max_stroke_mm) return null;
  const port = c.port ?? "";
  if (port && !har(CM2_PORTS, port)) return null;
  const cushion = c.cushion === true;
  const thread = c.rod_thread ?? "";
  if (thread && thread !== CM2_ROD_THREAD.code) return null;
  const boot = c.boot ?? "";
  if (boot && (!har(CM2_BOOTS, boot) || thread || st > CM2_BOOT_MAX_STROKE_MM)) return null;
  const pivot = c.pivot ?? "";
  if (pivot && (pivot !== CM2_PIVOT.code || !mounting.pivot_ok)) return null;
  const rodEnd = c.rod_end ?? "";
  if (rodEnd && (!har(CM2_ROD_ENDS, rodEnd) || thread)) return null;
  const magnet = c.magnet === true;
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = CM2_SWITCHES.find((x) => x.code === sw);
    if (!g || !magnet) return null;
    if (lead && (!har(CM2_LEADS, lead) || g.leads[CM2_LEAD_INDEX[lead]] === "-")) return null;
    if (count && !har(CM2_COUNTS, count)) return null;
  } else if (lead || count) return null;
  if (m) {
    if (m.rubber_only && cushion) return null;
    if (m.no_switch && sw) return null;
    if (m.no_boot && boot) return null;
    if (m.max_stroke_mm !== undefined && st > m.max_stroke_mm) return null;
    if (m.no_clevis && mounting.clevis_or_trunnion) return null;
    if (m.needs_rod_end && rodEnd !== m.needs_rod_end) return null;
    if (m.needs_mounting_nut && !mounting.mounting_nut) return null;
  }
  const g1 = `C${magnet ? "D" : ""}M2${mounting.code}${bore.code}${port}`;
  const g2 = `${st}${cushion ? "A" : ""}${thread}${boot}Z1`;
  const g3 = `${pivot}${rodEnd}`;
  const g4 = `${sw}${lead}${count}`;
  return [g1, g2, g3, g4, mto].filter((g, i) => i < 2 || g).join("-");
}

export function cm2ParseCode(raw: string): { config: CM2Config } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...CM2_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(
    `^C(D?)M2(BZ|FZ|UZ|[BLFGCDUTEV])(20|25|32|40)(TN|TF)?-(\\d{1,4})(A?)(F?)([JK]?)Z1(?:-(N?)([VWQ]?))?(?:-(${givare})([MLZ])?(S)?)?(?:-(X[A-Z0-9]+))?$`,
  );
  const m = re.exec(k);
  if (!m) return null;
  const [, magnet, mounting, bore, port, stroke, cushion, thread, boot, pivot, rodEnd, sw, lead, count, mto] = m;
  const c: CM2Config = {
    bore, mounting, stroke_mm: Number(stroke), magnet: magnet === "D", port: port || undefined, cushion: cushion === "A",
    rod_thread: thread || undefined, boot: boot || undefined, pivot: pivot || undefined, rod_end: rodEnd || undefined,
    switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined,
  };
  if (cm2BuildCode(c) !== k) return null;
  return { config: c };
}

export const CM2_ORDER_CODE_TEMPLATE =
  "C{magnet}M2{mounting}{bore}{port}-{stroke_mm}{cushion}{rod_thread}{boot}Z1-{pivot}{rod_end}-{switch}{lead}{count}-{mto}";

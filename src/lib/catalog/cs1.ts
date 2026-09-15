/**
 * SMC CS1 — dragstångscylinder med stor borrning ø125–300, dubbelverkande
 * enkel kolvstång, smord/osmord eller lufthydraulisk.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Air Cylinder CS1 Series" (katalogutdrag, 38 sidor). Ligger i
 *   knowledge_chunks som source_file = 'smc-kat-cs1.pdf'.
 *   PDF-sidor (katalogsidor inom parentes; meddelandena citerar katalogsidan):
 *     - kombinationstabell standard/special         sida 2  (618)
 *     - How to Order CS1, rörmaterial, maxslag        sida 4–5 (620–621)
 *     - tryckkärlslagen (klass 2), viktexempel        sida 6  (622)
 *     - How to Order CDS1 (magnet), maxslag med magnet sida 9–10 (625–626)
 *
 * VAD FAMILJEN ÄR. CS1 (och magnetcylindern CDS1) med enkel kolvstång.
 * CS1W (dubbel kolvstång) och CS1□Q (lågfriktion) är egna nycklar; de
 * justerbara/dubbla slagen -XC8…-XC11 och måttändringarna -XC14/-XC15
 * beställs med extra mått och ingår inte.
 *
 * KODENS FORM (sida 4 och 9):
 *
 *   CS1  L F N 160 TN - 300 JN - XC6 - V       utan magnet
 *   CDS1 L   N 160 TN - 300 JN - M9BW S - XC6  med magnet och givare
 *   C{magnet}S1{fäste}{rör}{typ}{ø}{gänga}-{slag}{tillägg}-{givare}{kabel}{antal}-{special}-{tryckkärl}
 *
 * Rörsymbolen F (stålrör där aluminium är standard) och tryckkärlssymbolen
 * -V finns bara i nyckeln utan magnet; magnetcylindern CDS1 finns till ø200.
 * Tillägget (bälg J/K och dämpning N/R/H) skrivs i bokstavsordning, så det
 * är ett fält med de elva giltiga kombinationerna. -V sätts bara på slag
 * som omfattas av Japans tryckkärlslag klass 2 (sida 6) och betyder
 * "används inte i Japan".
 */

export const CS1_SOURCE = {
  file: "smc-kat-cs1.pdf",
  edition: "SMC CS1 catalogue (catalogue pages 617–654)",
  title: "SMC Air Cylinder CS1 Series",
  brand: "SMC",
} as const;

export interface CS1Value {
  code: string;
  label_sv: string;
}

export interface CS1Bore extends CS1Value {
  bore_mm: number;
  /** Aluminiumrör som standard upp till detta slag (sida 4); 0 = alltid stålrör. */
  alu_max_mm: number;
  /** Lufthydraul H finns (sida 4). */
  hydro_ok: boolean;
  /** Magnetcylindern CDS1 finns (sida 2 och 9). */
  magnet_ok: boolean;
  /** Största slag utan magnet: fäste B/G/C/D/T respektive L/F (sida 5). */
  max_basic_mm: number;
  max_foot_mm: number;
  /** Största slag med magnet (sida 10); 0 = ingen magnet. */
  max_magnet_basic_mm: number;
  max_magnet_foot_mm: number;
  /** Slag över detta omfattas av tryckkärlslagen klass 2 (sida 6); 0 = aldrig. */
  vessel_over_mm: number;
}
const b = (code: string, alu: number, hydro: boolean, magnet: boolean, mb: number, mf: number, mmb: number, mmf: number, vessel: number): CS1Bore =>
  ({ code, bore_mm: Number(code), alu_max_mm: alu, hydro_ok: hydro, magnet_ok: magnet, max_basic_mm: mb, max_foot_mm: mf, max_magnet_basic_mm: mmb, max_magnet_foot_mm: mmf, vessel_over_mm: vessel, label_sv: `ø${code} mm` });
export const CS1_BORES: CS1Bore[] = [
  b("125", 1000, true, true, 1000, 1600, 1000, 1400, 0),
  b("140", 1000, true, true, 1000, 1600, 1000, 1400, 0),
  b("160", 1200, true, true, 1200, 1600, 1200, 1400, 0),
  b("180", 0, false, true, 1200, 2000, 1200, 1500, 1569),
  b("200", 0, false, true, 1200, 2000, 998, 998, 998),
  b("250", 0, false, false, 1200, 2400, 0, 0, 813),
  b("300", 0, false, false, 1200, 2400, 0, 0, 564),
];

export interface CS1Mounting extends CS1Value {
  /** Fot och kolvstångsfläns tar de längre slagen (sida 5). */
  long: boolean;
}
export const CS1_MOUNTINGS: CS1Mounting[] = [
  { code: "B", long: false, label_sv: "Basutförande" },
  { code: "L", long: true, label_sv: "Fotfäste" },
  { code: "F", long: true, label_sv: "Fläns vid kolvstången" },
  { code: "G", long: false, label_sv: "Fläns vid gaveln" },
  { code: "C", long: false, label_sv: "Enkelt gaffelfäste" },
  { code: "D", long: false, label_sv: "Dubbelt gaffelfäste (med sprint och saxpinne)" },
  { code: "T", long: false, label_sv: "Centrerat tappfäste" },
];
export const CS1_MAGNET: CS1Value = { code: "D", label_sv: "Inbyggd magnet för givare (CDS1, ø125–200)" };
export const CS1_TUBING: CS1Value = { code: "F", label_sv: "Stålrör där aluminiumrör är standard (ø125/140 ≤ 1000, ø160 ≤ 1200; ej magnetcylinder)" };
export const CS1_TYPES: CS1Value[] = [
  { code: "N", label_sv: "Osmord (non-lube)" },
  { code: "H", label_sv: "Lufthydraulisk, turbinolja (ø125–160, utan dämpning)" },
];
export const CS1_PORTS: CS1Value[] = [
  { code: "TN", label_sv: "Portgänga NPT (standard är Rc)" },
  { code: "TF", label_sv: "Portgänga G (standard är Rc)" },
];
/** Tillägget i bokstavsordning (sida 4): bälg J/K, dämpning N/R/H, Nil = dämpning i båda ändar. */
export interface CS1Suffix extends CS1Value {
  boot: string;
  cushion: string;
}
const sx = (boot: string, cushion: string, label: string): CS1Suffix =>
  ({ code: [boot, cushion].filter(Boolean).sort().join(""), boot, cushion, label_sv: label });
export const CS1_SUFFIXES: CS1Suffix[] = [
  sx("", "N", "Utan dämpning"),
  sx("", "R", "Dämpning bara vid kolvstången"),
  sx("", "H", "Dämpning bara vid gaveln"),
  sx("J", "", "Bälg i nylonduk (max 70 °C)"),
  sx("K", "", "Värmebeständig bälg (max 110 °C)"),
  sx("J", "N", "Bälg i nylonduk, utan dämpning"),
  sx("J", "R", "Bälg i nylonduk, dämpning bara vid kolvstången"),
  sx("J", "H", "Bälg i nylonduk, dämpning bara vid gaveln"),
  sx("K", "N", "Värmebeständig bälg, utan dämpning"),
  sx("K", "R", "Värmebeständig bälg, dämpning bara vid kolvstången"),
  sx("K", "H", "Värmebeständig bälg, dämpning bara vid gaveln"),
];

export interface CS1Switch extends CS1Value {
  kind: "reed" | "solid";
  leads: string;
}
const s = (code: string, label: string, leads: string, kind: "reed" | "solid" = "solid"): CS1Switch => ({ code, kind, leads, label_sv: label });
/** Tillämpliga givare (sida 9). */
export const CS1_SWITCHES: CS1Switch[] = [
  s("M9N", "D-M9N, 3-tråd NPN", "SSSO"), s("M9P", "D-M9P, 3-tråd PNP", "SSSO"), s("M9B", "D-M9B, 2-tråd", "SSSO"),
  s("M9NW", "D-M9NW, NPN, tvåfärgsindikering", "SSSO"), s("M9PW", "D-M9PW, PNP, tvåfärgsindikering", "SSSO"), s("M9BW", "D-M9BW, 2-tråd, tvåfärgsindikering", "SSSO"),
  s("M9NA", "D-M9NA, NPN, vattentät", "OOSO"), s("M9PA", "D-M9PA, PNP, vattentät", "OOSO"), s("M9BA", "D-M9BA, 2-tråd, vattentät", "OOSO"),
  s("A96", "D-A96, reed 3-tråd", "SSSS", "reed"), s("A93", "D-A93, reed 2-tråd", "SSSS", "reed"), s("A90", "D-A90, reed utan indikering", "SSSS", "reed"),
];
export const CS1_LEADS: CS1Value[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel" },
];
export const CS1_LEAD_INDEX: Record<string, number> = { "": 0, M: 1, L: 2, Z: 3 };
export const CS1_COUNTS: CS1Value[] = [
  { code: "S", label_sv: "En givare (standard är två)" },
  { code: "3", label_sv: "Tre givare" },
];
export const CS1_VESSEL: CS1Value = { code: "V", label_sv: "Används inte i Japan — undantag från tryckkärlslagen klass 2 (bara slag som omfattas; ej magnetcylinder)" };

export interface CS1Mto extends CS1Value {
  /** Borrningar (sida 2). */
  bores?: string[];
  /** Typer (Nil smord, N osmord, H lufthydraul) som är ◎ standardspecial. */
  types: string[];
  /** Typer där utförandet är ○ "special product" (varning). */
  special_types?: string[];
  /** Osmord ø250/300 på begäran (sida 2, not 1). */
  request_large_nonlube?: boolean;
}
const STORA = ["250", "300"];
export const CS1_MTO: CS1Mto[] = [
  { code: "XA", types: ["", "N", "H"], label_sv: "-XA□ Ändrad kolvstångsände (mått anges vid beställning)" },
  { code: "XB5", bores: ["125", "140", "160", "180", "200"], types: ["", "N"], special_types: ["H"], label_sv: "-XB5 Grov kolvstång (ø125–200)" },
  { code: "XB6", bores: ["125", "140", "160", "180", "200"], types: ["N"], label_sv: "-XB6 Värmebeständig –10…150 °C (bara osmord, ø125–200)" },
  { code: "XC3", types: ["", "N"], special_types: ["H"], label_sv: "-XC3 Speciell portplacering" },
  { code: "XC4", types: ["", "N"], special_types: ["H"], label_sv: "-XC4 Kraftig avstrykare" },
  { code: "XC5", types: ["", "N"], request_large_nonlube: true, label_sv: "-XC5 Värmebeständig –10…110 °C (ej lufthydraul)" },
  { code: "XC6", types: ["", "N"], special_types: ["H"], label_sv: "-XC6 Rostfritt utförande" },
  { code: "XC22", types: ["", "N"], special_types: ["H"], request_large_nonlube: true, label_sv: "-XC22 Fluorgummitätningar" },
  { code: "XC26", types: ["", "N"], special_types: ["H"], label_sv: "-XC26 Gaffelsprintar med planbricka" },
  { code: "XC27", types: ["", "N"], special_types: ["H"], label_sv: "-XC27 Rostfria gaffelsprintar (SS304)" },
  { code: "XC30", types: ["", "N"], special_types: ["H"], label_sv: "-XC30 Tappfäste vid kolvstången, monterat på gavelns front" },
  { code: "XC35", types: ["", "N"], special_types: ["H"], label_sv: "-XC35 Spiralavstrykare" },
  { code: "XC68", types: ["", "N"], special_types: ["H"], label_sv: "-XC68 Hårdkromad rostfri kolvstång" },
  { code: "XC86", types: ["", "N"], special_types: ["H"], label_sv: "-XC86 Med kolvstångsände (rod end bracket)" },
];

export const CS1_LIMITS = {
  max_pressure_mpa: 0.97,
  min_pressure_mpa: { air: 0.05, hydro: 0.06 },
  proof_pressure_mpa: 1.57,
  temp_c: { air: [0, 70], hydro: [5, 60] },
  speed_mm_s: { air: [50, 500], hydro: [0.5, 200] },
  min_stroke_mm: 1,
} as const;

export interface CS1Config {
  bore: string;
  mounting: string;
  stroke_mm: number;
  magnet?: boolean;
  tubing?: string;
  type?: string;
  port?: string;
  suffix?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
  vessel?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string | undefined) =>
  kod !== undefined && lista.some((v) => v.code === kod);

/** Största slag för borrning, fäste och magnet (sida 5 och 10). */
export function cs1MaxStroke(bore: CS1Bore, mounting: CS1Mounting, magnet: boolean): number {
  if (magnet) return mounting.long ? bore.max_magnet_foot_mm : bore.max_magnet_basic_mm;
  return mounting.long ? bore.max_foot_mm : bore.max_basic_mm;
}

export function cs1BuildCode(c: CS1Config): string | null {
  const bore = CS1_BORES.find((x) => x.code === c.bore);
  const mounting = CS1_MOUNTINGS.find((x) => x.code === c.mounting);
  if (!bore || !mounting) return null;
  const magnet = c.magnet === true;
  if (magnet && !bore.magnet_ok) return null;
  const st = c.stroke_mm;
  if (!Number.isInteger(st) || st < CS1_LIMITS.min_stroke_mm || st > cs1MaxStroke(bore, mounting, magnet)) return null;
  const tubing = c.tubing ?? "";
  if (tubing && (tubing !== CS1_TUBING.code || magnet || bore.alu_max_mm === 0 || st > bore.alu_max_mm)) return null;
  const type = c.type ?? "";
  if (type && !har(CS1_TYPES, type)) return null;
  if (type === "H" && !bore.hydro_ok) return null;
  const port = c.port ?? "";
  if (port && !har(CS1_PORTS, port)) return null;
  const suffix = c.suffix ?? "";
  const sfx = suffix ? CS1_SUFFIXES.find((x) => x.code === suffix) : undefined;
  if (suffix && !sfx) return null;
  if (sfx && type === "H" && sfx.cushion) return null;
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    const g = CS1_SWITCHES.find((x) => x.code === sw);
    if (!g || !magnet) return null;
    if (lead && !har(CS1_LEADS, lead)) return null;
    if (count && !har(CS1_COUNTS, count)) return null;
  } else if (lead || count) return null;
  const mto = c.mto ?? "";
  if (mto) {
    const m = CS1_MTO.find((x) => x.code === mto);
    if (!m) return null;
    if (m.bores && !m.bores.includes(bore.code)) return null;
    if (!m.types.includes(type) && !(m.special_types ?? []).includes(type)) return null;
  }
  const vessel = c.vessel ?? "";
  if (vessel && (vessel !== CS1_VESSEL.code || magnet || bore.vessel_over_mm === 0 || st <= bore.vessel_over_mm)) return null;
  const g1 = `C${magnet ? "D" : ""}S1${mounting.code}${tubing}${type}${bore.code}${port}`;
  const g2 = `${st}${suffix}`;
  const g3 = `${sw}${lead}${count}`;
  return [g1, g2, g3, mto, vessel].filter((g, i) => i < 2 || g).join("-");
}

export function cs1ParseCode(raw: string): { config: CS1Config } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...CS1_SWITCHES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const tillagg = [...CS1_SUFFIXES].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(
    `^C(D?)S1([BLFGCDT])(F?)([NH]?)(125|140|160|180|200|250|300)(TN|TF)?-(\\d{1,4})(${tillagg})?(?:-(${givare})([MLZ])?(S|3)?)?(?:-(X[A-Z0-9]+))?(?:-(V))?$`,
  );
  const m = re.exec(k);
  if (!m) return null;
  const [, magnet, mounting, tubing, type, bore, port, stroke, suffix, sw, lead, count, mto, vessel] = m;
  const c: CS1Config = {
    bore, mounting, stroke_mm: Number(stroke), magnet: magnet === "D", tubing: tubing || undefined, type: type || undefined,
    port: port || undefined, suffix: suffix || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined,
    mto: mto || undefined, vessel: vessel || undefined,
  };
  if (cs1BuildCode(c) !== k) return null;
  return { config: c };
}

export const CS1_ORDER_CODE_TEMPLATE =
  "C{magnet}S1{mounting}{tubing}{type}{bore}{port}-{stroke_mm}{suffix}-{switch}{lead}{count}-{mto}-{vessel}";

/**
 * Festo MFH — Tiger Classic, magnet- och pneumatikmanövrerade ventiler.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Festo, "Tiger Classic valve", utgåva 2026/07. Ligger i knowledge_chunks
 *   som source_file = 'festo-MFH-203756.pdf'.
 *     - typkod         sida 3
 *     - tekniska data  sida 4-9 (3/2) och 10-15 (5/2)
 *     - beställdata    sida 35-40
 *
 * FAMILJEN VAR KOPPLAD TILL FEL DOKUMENT. Databasen pekade på
 * festo-MH1-203291.pdf, "Solenoid valves MH1, miniature" -- en helt annan
 * ventil. Strängen "MFH" förekommer noll gånger i den. Kopplingen stod som en
 * familjeslug i ingest-skriptet, och den slugen är dokumentation, inte en
 * utsaga om att någon undersökt saken.
 *
 * EN TABELLFAMILJ, inte en räknebar nyckel. Katalogen trycker 76 FÄRDIGA
 * artiklar med artikelnummer, och det är dem man beställer.
 *
 * TVÅ KODSYSTEM SOM INTE ÄR SAMMA SAK. Katalogen har BÅDE en modulär typkod
 * (sida 3) och artikelnamn (sida 35-40), och de skiljer sig på tre punkter:
 *
 *   typkod:      MFH - 3 - G18 - EX4 - S
 *   artikelnamn: MFH - 3 - 1/8 - S   - EX
 *
 * gängan skrivs G18 mot 1/8, ATEX heter EX4 mot EX, och de två sista
 * positionerna kommer i OMVÄND ORDNING. Den som antar att typkoden och
 * artikelnamnet är samma sträng har fel i tre avseenden samtidigt.
 *
 * Modellen bygger ARTIKELNAMNET, eftersom det är det katalogen parar med ett
 * artikelnummer. Typkoden står med som `MFH_TYPE_CODE_POSITIONS` för att den
 * är källans egen och någon kommer att undra.
 *
 * MCH OCH MOCH står i typkoden men har NOLL artiklar i beställdatan. De är
 * C-spolevarianter, och det här dokumentet listar dem inte som färdiga
 * produkter. De modelleras därför inte.
 */

export const MFH_SOURCE = {
  file: "festo-MFH-203756.pdf",
  edition: "2026/07",
  title: "Festo Tiger Classic valve (MFH and related series)",
  brand: "Festo",
} as const;

export interface MfhValue {
  code: string;
  label_sv: string;
}

/**
 * Serierna som har färdiga artiklar i beställdatan.
 *
 * MCH och MOCH finns i typkoden men saknar artiklar och står därför inte här.
 */
export const MFH_SERIES: Array<MfhValue & { solenoid: boolean; bistable: boolean }> = [
  { code: "MFH", label_sv: "Magnetventil, monostabil, normalt stängd", solenoid: true, bistable: false },
  { code: "MOFH", label_sv: "Magnetventil, monostabil, normalt öppen", solenoid: true, bistable: false },
  { code: "JMFH", label_sv: "Magnetventil, bistabil", solenoid: true, bistable: true },
  { code: "JMFDH", label_sv: "Magnetventil, bistabil, dominerande signal", solenoid: true, bistable: true },
  { code: "JH", label_sv: "Pneumatventil, bistabil", solenoid: false, bistable: true },
  { code: "JDH", label_sv: "Pneumatventil, bistabil, dominerande signal", solenoid: false, bistable: true },
  { code: "VL", label_sv: "Pneumatventil, monostabil", solenoid: false, bistable: false },
  { code: "VL/O", label_sv: "Pneumatventil, monostabil, normalt öppen eller stängd", solenoid: false, bistable: false },
];

/** Position 002 i typkoden. */
export const MFH_FUNCTIONS: MfhValue[] = [
  { code: "3", label_sv: "3/2-vägs" },
  { code: "5", label_sv: "5/2-vägs" },
];

/** Gängorna, i artikelnamnets skrivsätt. */
export const MFH_THREADS: Array<MfhValue & { type_code: string }> = [
  { code: "1/8", type_code: "G18", label_sv: "G1/8" },
  { code: "1/4", type_code: "G14", label_sv: "G1/4" },
  { code: "1/2", type_code: "G12", label_sv: "G1/2" },
  { code: "3/4", type_code: "G34", label_sv: "G3/4" },
];

/**
 * Typkodens fem positioner, sida 3.
 *
 * STÅR HÄR SOM KÄLLA, INTE SOM BYGGREGEL. Se filens huvud: typkoden och
 * artikelnamnet är olika strängar, och det är artikelnamnet som paras med ett
 * artikelnummer.
 */
export const MFH_TYPE_CODE_POSITIONS = [
  { pos: "001", name: "Series", codes: ["MCH", "MFH", "MOCH", "JMFH", "MOFH", "JMFDH", "JH", "JDH", "VL/O", "VL"] },
  { pos: "002", name: "Valve function", codes: ["3", "5"] },
  { pos: "003", name: "Pneumatic connection", codes: ["G18", "G14", "G12", "G34"] },
  { pos: "004", name: "EX certification EU", codes: ["", "EX4"] },
  { pos: "005", name: "Pilot air", codes: ["", "S"] },
] as const;

export interface MfhTechData {
  /** "3" eller "5". */
  fn: string;
  thread: string;
  /** Nominell vidd, mm. */
  nominal_size_mm: number;
  /** Nominellt flöde enligt DIN 1343, l/min. */
  flow_lmin: number;
  weight_g: number;
  pressure_max_bar: number;
}

/**
 * Tekniska data per funktion och gänga (sida 4 och 10).
 *
 * ETT OBEROENDE KRYSS: 5/2 finns inte i G3/4, vilket syns på TVÅ ställen --
 * tekniska data har bara tre kolumner för 5/2, och beställdatan har ingen
 * enda 5/2-artikel i G3/4. Två tabeller, samma slutsats. Se `mfh.test.ts`.
 *
 * Och ett värde som är lätt att missa: 5/2 i G1/4 tål 8 bar, inte 10 som de
 * andra.
 */
export const MFH_TECH: MfhTechData[] = [
  { fn: "3", thread: "1/8", nominal_size_mm: 5, flow_lmin: 500, weight_g: 240, pressure_max_bar: 10 },
  { fn: "3", thread: "1/4", nominal_size_mm: 7, flow_lmin: 800, weight_g: 320, pressure_max_bar: 10 },
  { fn: "3", thread: "1/2", nominal_size_mm: 14, flow_lmin: 3700, weight_g: 1100, pressure_max_bar: 10 },
  { fn: "3", thread: "3/4", nominal_size_mm: 19, flow_lmin: 7500, weight_g: 1260, pressure_max_bar: 10 },
  { fn: "5", thread: "1/8", nominal_size_mm: 5, flow_lmin: 500, weight_g: 270, pressure_max_bar: 10 },
  { fn: "5", thread: "1/4", nominal_size_mm: 7, flow_lmin: 1000, weight_g: 290, pressure_max_bar: 8 },
  { fn: "5", thread: "1/2", nominal_size_mm: 14, flow_lmin: 3700, weight_g: 1135, pressure_max_bar: 10 },
];

/** Kopplingstider för 3/2, ms (sida 5). */
export const MFH_SWITCHING_MS: Record<string, { on: number; off: number }> = {
  "1/8": { on: 9, off: 33 },
  "1/4": { on: 10, off: 29 },
  "1/2": { on: 18, off: 90 },
  "3/4": { on: 36, off: 32 },
};

/** Gemensamma gränser (sida 4-5). */
export const MFH_LIMITS = {
  /** 3/2 klarar undertryck; katalogen anger -0,95 bar. */
  pressure_min_bar: -0.95,
  pilot_pressure_min_bar: 1,
  pilot_pressure_max_bar: 8,
  temp_ambient_min_c: -5,
  temp_ambient_max_c: 40,
  temp_media_min_c: -10,
  temp_media_max_c: 60,
  ip_rating: "IP65",
  atex_gas: "II 2G Ex h IIC T4 Gb",
  atex_dust: "II 2D Ex h IIIC T130°C Db",
  atex_temp_min_c: -5,
  atex_temp_max_c: 40,
  housing: "Pressgjuten aluminium",
  seals: "NBR",
} as const;

export interface MfhArticle {
  part_no: string;
  /** Artikelnamnet som katalogen trycker det. */
  type: string;
  series: string;
  fn: string;
  thread: string;
  /** Extern pilotluft, suffix -S. */
  ext_pilot?: boolean;
  /** ATEX, suffix -EX. */
  atex?: boolean;
  /**
   * Suffixet -B. Finns BARA på VL/O i G1/8 och står inte i typkodstabellen.
   * Vad det betyder går inte att utläsa ur dokumentet, så det skrivs av som
   * det står i stället för att tolkas.
   */
  b_variant?: boolean;
}

/** Katalogens 76 artiklar, sida 35-40. */
export const MFH_ARTICLES: MfhArticle[] = [
  { part_no: "7802", type: "MFH-3-1/8", series: "MFH", fn: "3", thread: "1/8" },
  { part_no: "535897", type: "MFH-3-1/8-EX", series: "MFH", fn: "3", thread: "1/8", atex: true },
  { part_no: "7958", type: "MFH-3-1/8-S", series: "MFH", fn: "3", thread: "1/8", ext_pilot: true },
  { part_no: "535900", type: "MFH-3-1/8-S-EX", series: "MFH", fn: "3", thread: "1/8", ext_pilot: true, atex: true },
  { part_no: "9964", type: "MFH-3-1/4", series: "MFH", fn: "3", thread: "1/4" },
  { part_no: "535898", type: "MFH-3-1/4-EX", series: "MFH", fn: "3", thread: "1/4", atex: true },
  { part_no: "7959", type: "MFH-3-1/4-S", series: "MFH", fn: "3", thread: "1/4", ext_pilot: true },
  { part_no: "535901", type: "MFH-3-1/4-S-EX", series: "MFH", fn: "3", thread: "1/4", ext_pilot: true, atex: true },
  { part_no: "9857", type: "MFH-3-1/2", series: "MFH", fn: "3", thread: "1/2" },
  { part_no: "535899", type: "MFH-3-1/2-EX", series: "MFH", fn: "3", thread: "1/2", atex: true },
  { part_no: "7960", type: "MFH-3-1/2-S", series: "MFH", fn: "3", thread: "1/2", ext_pilot: true },
  { part_no: "535902", type: "MFH-3-1/2-S-EX", series: "MFH", fn: "3", thread: "1/2", ext_pilot: true, atex: true },
  { part_no: "11967", type: "MFH-3-3/4", series: "MFH", fn: "3", thread: "3/4" },
  { part_no: "536190", type: "MFH-3-3/4-EX", series: "MFH", fn: "3", thread: "3/4", atex: true },
  { part_no: "11968", type: "MFH-3-3/4-S", series: "MFH", fn: "3", thread: "3/4", ext_pilot: true },
  { part_no: "536191", type: "MFH-3-3/4-S-EX", series: "MFH", fn: "3", thread: "3/4", ext_pilot: true, atex: true },
  { part_no: "9982", type: "MFH-5-1/8", series: "MFH", fn: "5", thread: "1/8" },
  { part_no: "535906", type: "MFH-5-1/8-EX", series: "MFH", fn: "5", thread: "1/8", atex: true },
  { part_no: "10348", type: "MFH-5-1/8-S", series: "MFH", fn: "5", thread: "1/8", ext_pilot: true },
  { part_no: "535909", type: "MFH-5-1/8-S-EX", series: "MFH", fn: "5", thread: "1/8", ext_pilot: true, atex: true },
  { part_no: "6211", type: "MFH-5-1/4", series: "MFH", fn: "5", thread: "1/4" },
  { part_no: "535907", type: "MFH-5-1/4-EX", series: "MFH", fn: "5", thread: "1/4", atex: true },
  { part_no: "10349", type: "MFH-5-1/4-S", series: "MFH", fn: "5", thread: "1/4", ext_pilot: true },
  { part_no: "535910", type: "MFH-5-1/4-S-EX", series: "MFH", fn: "5", thread: "1/4", ext_pilot: true, atex: true },
  { part_no: "6420", type: "MFH-5-1/2", series: "MFH", fn: "5", thread: "1/2" },
  { part_no: "535908", type: "MFH-5-1/2-EX", series: "MFH", fn: "5", thread: "1/2", atex: true },
  { part_no: "35547", type: "MFH-5-1/2-S", series: "MFH", fn: "5", thread: "1/2", ext_pilot: true },
  { part_no: "535911", type: "MFH-5-1/2-S-EX", series: "MFH", fn: "5", thread: "1/2", ext_pilot: true, atex: true },
  { part_no: "7877", type: "MOFH-3-1/8", series: "MOFH", fn: "3", thread: "1/8" },
  { part_no: "535903", type: "MOFH-3-1/8-EX", series: "MOFH", fn: "3", thread: "1/8", atex: true },
  { part_no: "7876", type: "MOFH-3-1/4", series: "MOFH", fn: "3", thread: "1/4" },
  { part_no: "535904", type: "MOFH-3-1/4-EX", series: "MOFH", fn: "3", thread: "1/4", atex: true },
  { part_no: "7884", type: "MOFH-3-1/2", series: "MOFH", fn: "3", thread: "1/2" },
  { part_no: "535905", type: "MOFH-3-1/2-EX", series: "MOFH", fn: "3", thread: "1/2", atex: true },
  { part_no: "11969", type: "MOFH-3-3/4", series: "MOFH", fn: "3", thread: "3/4" },
  { part_no: "536192", type: "MOFH-3-3/4-EX", series: "MOFH", fn: "3", thread: "3/4", atex: true },
  { part_no: "8820", type: "JMFH-5-1/8", series: "JMFH", fn: "5", thread: "1/8" },
  { part_no: "535912", type: "JMFH-5-1/8-EX", series: "JMFH", fn: "5", thread: "1/8", atex: true },
  { part_no: "14008", type: "JMFH-5-1/8-S", series: "JMFH", fn: "5", thread: "1/8", ext_pilot: true },
  { part_no: "535915", type: "JMFH-5-1/8-S-EX", series: "JMFH", fn: "5", thread: "1/8", ext_pilot: true, atex: true },
  { part_no: "10410", type: "JMFH-5-1/4", series: "JMFH", fn: "5", thread: "1/4" },
  { part_no: "535913", type: "JMFH-5-1/4-EX", series: "JMFH", fn: "5", thread: "1/4", atex: true },
  { part_no: "14009", type: "JMFH-5-1/4-S", series: "JMFH", fn: "5", thread: "1/4", ext_pilot: true },
  { part_no: "535916", type: "JMFH-5-1/4-S-EX", series: "JMFH", fn: "5", thread: "1/4", ext_pilot: true, atex: true },
  { part_no: "10166", type: "JMFH-5-1/2", series: "JMFH", fn: "5", thread: "1/2" },
  { part_no: "535914", type: "JMFH-5-1/2-EX", series: "JMFH", fn: "5", thread: "1/2", atex: true },
  { part_no: "35548", type: "JMFH-5-1/2-S", series: "JMFH", fn: "5", thread: "1/2", ext_pilot: true },
  { part_no: "535917", type: "JMFH-5-1/2-S-EX", series: "JMFH", fn: "5", thread: "1/2", ext_pilot: true, atex: true },
  { part_no: "8821", type: "JMFDH-5-1/8", series: "JMFDH", fn: "5", thread: "1/8" },
  { part_no: "536193", type: "JMFDH-5-1/8-EX", series: "JMFDH", fn: "5", thread: "1/8", atex: true },
  { part_no: "10411", type: "JMFDH-5-1/4", series: "JMFDH", fn: "5", thread: "1/4" },
  { part_no: "536194", type: "JMFDH-5-1/4-EX", series: "JMFDH", fn: "5", thread: "1/4", atex: true },
  { part_no: "8823", type: "JH-5-1/8", series: "JH", fn: "5", thread: "1/8" },
  { part_no: "536035", type: "JH-5-1/8-EX", series: "JH", fn: "5", thread: "1/8", atex: true },
  { part_no: "10408", type: "JH-5-1/4", series: "JH", fn: "5", thread: "1/4" },
  { part_no: "536036", type: "JH-5-1/4-EX", series: "JH", fn: "5", thread: "1/4", atex: true },
  { part_no: "10165", type: "JH-5-1/2", series: "JH", fn: "5", thread: "1/2" },
  { part_no: "536037", type: "JH-5-1/2-EX", series: "JH", fn: "5", thread: "1/2", atex: true },
  { part_no: "8824", type: "JDH-5-1/8", series: "JDH", fn: "5", thread: "1/8" },
  { part_no: "536038", type: "JDH-5-1/8-EX", series: "JDH", fn: "5", thread: "1/8", atex: true },
  { part_no: "10409", type: "JDH-5-1/4", series: "JDH", fn: "5", thread: "1/4" },
  { part_no: "536039", type: "JDH-5-1/4-EX", series: "JDH", fn: "5", thread: "1/4", atex: true },
  { part_no: "9764", type: "VL-5-1/8", series: "VL", fn: "5", thread: "1/8" },
  { part_no: "536032", type: "VL-5-1/8-EX", series: "VL", fn: "5", thread: "1/8", atex: true },
  { part_no: "9199", type: "VL-5-1/4", series: "VL", fn: "5", thread: "1/4" },
  { part_no: "536033", type: "VL-5-1/4-EX", series: "VL", fn: "5", thread: "1/4", atex: true },
  { part_no: "9445", type: "VL-5-1/2", series: "VL", fn: "5", thread: "1/2" },
  { part_no: "536034", type: "VL-5-1/2-EX", series: "VL", fn: "5", thread: "1/2", atex: true },
  { part_no: "7803", type: "VL/O-3-1/8-B", series: "VL/O", fn: "3", thread: "1/8", b_variant: true },
  { part_no: "536028", type: "VL/O-3-1/8-B-EX", series: "VL/O", fn: "3", thread: "1/8", atex: true, b_variant: true },
  { part_no: "9984", type: "VL/O-3-1/4", series: "VL/O", fn: "3", thread: "1/4" },
  { part_no: "536029", type: "VL/O-3-1/4-EX", series: "VL/O", fn: "3", thread: "1/4", atex: true },
  { part_no: "9983", type: "VL/O-3-1/2", series: "VL/O", fn: "3", thread: "1/2" },
  { part_no: "536030", type: "VL/O-3-1/2-EX", series: "VL/O", fn: "3", thread: "1/2", atex: true },
  { part_no: "10049", type: "VL/O-3-3/4", series: "VL/O", fn: "3", thread: "3/4" },
  { part_no: "536031", type: "VL/O-3-3/4-EX", series: "VL/O", fn: "3", thread: "3/4", atex: true },
];

/** Slår upp en artikel på dess namn. */
export function mfhByType(type: string): MfhArticle | null {
  const t = type.trim().toUpperCase();
  return MFH_ARTICLES.find((a) => a.type.toUpperCase() === t) ?? null;
}

/** Slår upp en artikel på Festos artikelnummer. */
export function mfhByPartNo(partNo: string): MfhArticle | null {
  const n = partNo.trim().replace(/^FESTO-/i, "");
  return MFH_ARTICLES.find((a) => a.part_no === n) ?? null;
}

export interface MfhSelection {
  series: string;
  fn: string;
  thread: string;
  ext_pilot?: boolean;
  atex?: boolean;
}

/**
 * Slår upp artikeln som svarar mot ett val. Null när kombinationen inte finns.
 *
 * Det här är uppslaget, inte en beräkning. Katalogen listar färdiga artiklar,
 * och en kombination som inte står där går inte att beställa hur rimlig den än
 * ser ut -- det finns till exempel ingen 5/2 i G3/4.
 */
export function mfhFind(s: MfhSelection): MfhArticle | null {
  return MFH_ARTICLES.find((a) =>
    a.series === s.series && a.fn === s.fn && a.thread === s.thread &&
    Boolean(a.ext_pilot) === Boolean(s.ext_pilot) &&
    Boolean(a.atex) === Boolean(s.atex)
  ) ?? null;
}

/** Tekniska data för en funktion och gänga. */
export function mfhTech(fn: string, thread: string): MfhTechData | null {
  return MFH_TECH.find((t) => t.fn === fn && t.thread === thread) ?? null;
}

/** Gängorna som finns för en serie och funktion. */
export function mfhThreadsFor(series: string, fn: string): string[] {
  return [...new Set(
    MFH_ARTICLES.filter((a) => a.series === series && a.fn === fn).map((a) => a.thread),
  )];
}

/** Funktionerna som finns för en serie. */
export function mfhFunctionsFor(series: string): string[] {
  return [...new Set(MFH_ARTICLES.filter((a) => a.series === series).map((a) => a.fn))];
}

/**
 * Konfiguratorns mall.
 *
 * KOMPONERAD, inte uppslagen -- till skillnad från RTC-HD och VME, som har en
 * enda rullgardin med hela artikellistan. Skälet är att MFH har 76 artiklar,
 * och 76 knappar är en vägg; fem korta listor är ett val.
 *
 * Det är tillåtet bara därför att kompositionen bevisligen ger EXAKT
 * katalogens namn för alla 76 -- se testet "varje artikelnamn stämmer med sina
 * egna fält" och "kompositionen ger katalogens namn för alla 76" i
 * mfh.test.ts. Priset är att mallen kan producera kombinationer katalogen inte
 * har, och det är vad `mfh-db-rules.ts` stoppar: hela korsprodukten på 512
 * kombinationer prövas mot de 76 som finns.
 *
 * Tomma positioner faller bort genom mallmotorns vanliga städning av dubbla
 * bindestreck, precis som i DSBC:s modulära kod.
 */
export const MFH_ORDER_CODE_TEMPLATE =
  "{series}-{fn}-{thread}-{b_variant}-{ext_pilot}-{atex}";

/** Bygger artikelnamnet ur delarna. Används av testet som binder mallen. */
export function mfhComposeType(a: MfhArticle): string {
  return [
    a.series, a.fn, a.thread,
    a.b_variant ? "B" : "", a.ext_pilot ? "S" : "", a.atex ? "EX" : "",
  ].filter((x) => x !== "").join("-");
}

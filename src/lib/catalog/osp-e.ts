/**
 * Parker OSP-E — ORIGA modulära elektriska linjäraktuatorer, sju varianter.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Parker Hannifin, Pneumatic Division Europe, "Modular Electric Actuators
 *   OSP-E", katalog P-A4P017GB (2014). Ligger i knowledge_chunks som
 *   source_file = 'parker-OSP-E-PA4P017GB.pdf', 434 chunkar. Sidnumren nedan
 *   är PDF-sidor (tryckt sida + 1).
 *
 *     variant      typ   Order Instructions   tekniska data
 *     OSP-E..BHD   5/6   sida 25-26 (chunk 78-82)   sida 17 och 22 (chunk 40, 62)
 *     OSP-E..BV    7     sida 37-38 (chunk 105)     sida 33 (chunk 91)
 *     OSP-E..B     0     sida 51-52 (chunk 137-142) sida 45 (chunk 118)
 *     OSP-E..SB    1     sida 65-66 (chunk 169)     sida 59 (chunk 152)
 *     OSP-E..ST    2     sida 77-78 (chunk 193)     sida 73 (chunk 184)
 *     OSP-E..SBR   4     sida 87-88 (chunk 216)     sida 85 (chunk 208)
 *     OSP-E..STR   3     sida 97-98 (chunk 235)     sida 95 (chunk 230)
 *
 *   Översiktstabellen med kraft, hastighet och slag per variant och storlek
 *   står på sida 4-5 (chunk 7 och 14).
 *
 * SJU NYCKLAR, INTE EN. Databasen hade en enda familj "osp-e" med storlekarna
 * 40-125 (finns inte -- OSP-E är 20, 25, 32 och 50) och mallen
 * 'OSP-E-{size}-{stroke_mm}-{drive}' som gav "OSP-E-63-500-belt". Katalogen
 * har sju beställnycklar med olika betydelse på samma position: tecken tre i
 * första gruppen är drivaxel på B, stigning på skruvarna och rörelseriktning
 * på BHD. Det går inte att uttrycka i EN mall med EN etikett per position,
 * och Parkers egen sajt har också en konfigurator per variant. Därför sju
 * konfiguratorfamiljer ur en gemensam modell.
 *
 * KODENS FORM. Katalogen ritar nyckeln med tankstreck mellan grupperna:
 *
 *   OSPE25 — 0 0 0 0 0— 00000 — 0 0 0 0 0 0        (B, sida 51)
 *   OSPE20 — 6 0 0 02 — 00000 — 0 00 0 0 0         (BHD, sida 25)
 *
 * men Parkers konfigurator (econfig.parker.com, kontrollerad 2026-09-14)
 * skriver artikelnumret UTAN dem: `OSPE2500000-00500000000` respektive
 * `OSPE256000A00500000000`. Det enda bindestrecket som finns kvar är det i
 * "0-": monteringssatsens position på B och skruvarna är TVÅ tecken, och
 * "utan sats" heter bokstavligen "0-" (sida 51: "0 -  without"; sida 65:
 * "0 —  Plain Shaft"). Med en sats står satsens kod där i stället, utan
 * bindestreck: `OSPE25-0000AB02000-…` hos en distributör är "0000" + "AB" +
 * "02000". Samma konvention som OSP-P, vars kod också är ren sammanskrivning.
 *
 * "1X" ÄR BOKSTAVLIGT. BHD:s integrerade växel skrivs "1 x**" till "6 x**" i
 * katalogen (sida 25), och det går inte att läsa ut vad x är. Konfiguratorn
 * listar dem som [1X]…[6X] och bygger `OSPE256001X00500…`. Bokstaven är X.
 *
 * NIRO ÄR 0/1, INTE P/Q. Amerikanska distributörskoder har "P" först i
 * svansen (`OSPE25-60002-00000-P00000`). Parkers konfigurator förklarar:
 * [0] standardskruvar, [1] Niro, [P] standard "for USA", [Q] Niro "for USA".
 * Vi säljer i Europa och följer katalogen: 0 och 1.
 *
 * VAD SOM ÄR KONSTANT. Positioner utan pil i nyckeln står som fasta nollor i
 * mallen, precis som katalogens exempel: vagnen på SBR/STR, position tre på
 * BV, styrläget på SB/ST (bara "0 Standard" finns), tredje svanspositionen
 * på SBR/STR och tredje-fjärde på BV. Det är OSP-P:s och HMR:s gräns.
 */

export const OSPE_SOURCE = {
  file: "parker-OSP-E-PA4P017GB.pdf",
  edition: "P-A4P017GB",
  title: "Parker ORIGA Modular Electric Actuators OSP-E",
  brand: "Parker",
} as const;

export const OSPE_SERIES = "OSPE";

export interface OspeValue {
  code: string;
  label_sv: string;
}

export type OspeSlug =
  | "osp-e-b"
  | "osp-e-sb"
  | "osp-e-st"
  | "osp-e-sbr"
  | "osp-e-str"
  | "osp-e-bhd"
  | "osp-e-bv";

/**
 * Nyckelns FORM per variant. Tre former finns:
 *   "B"     typ vagn drivaxel(1) växel sats(2)          svans: niro styrning läge ändlock profil givare
 *   "SCREW" typ vagn stigning växel axel-eller-sats(2)  svans: niro styrning 0    ändlock profil givare
 *   "ROD"   typ 0    stigning växel axel-eller-sats(2)  svans: niro stångfäste 0  ändlock profil givare
 *   "BHD"   typ vagn riktning drivaxel(2)               svans: niro sats(2) ändlock profil givare
 *   "BV"    typ huvud 0 drivaxel(2)                     svans: niro sats(2) 0 0 givare
 */
export type OspeLayout = "B" | "SCREW" | "ROD" | "BHD" | "BV";

export interface OspeVariant {
  slug: OspeSlug;
  /** Position 7: typ av aktuator. BHD har två (5 rullstyrning, 6 kullager). */
  types: string[];
  name: string;
  title_sv: string;
  title_en: string;
  layout: OspeLayout;
  sizes: string[];
  /** PDF-sida där beställnyckeln står. */
  page_key: number;
  /** Befintlig familjerad i products, om någon. */
  product_sku: string | null;
}

export const OSPE_VARIANTS: OspeVariant[] = [
  {
    slug: "osp-e-bhd", types: ["5", "6"], name: "OSP-E..BHD", layout: "BHD",
    title_sv: "Remdriven aktuator med integrerad kullagrad styrning eller rullstyrning",
    title_en: "Belt actuator with integrated ball bearing or roller guide",
    sizes: ["20", "25", "32", "50"], page_key: 25, product_sku: "PARKER-OSPE-BHD",
  },
  {
    slug: "osp-e-bv", types: ["7"], name: "OSP-E..BV", layout: "BV",
    title_sv: "Vertikal remdriven aktuator med integrerad kullagrad styrning",
    title_en: "Vertical belt actuator with integrated ball bearing guide",
    sizes: ["20", "25"], page_key: 37, product_sku: null,
  },
  {
    slug: "osp-e-b", types: ["0"], name: "OSP-E..B", layout: "B",
    title_sv: "Remdriven aktuator med inbyggd glidstyrning",
    title_en: "Belt actuator with internal plain bearing guide",
    sizes: ["25", "32", "50"], page_key: 51, product_sku: "PARKER-OSPE-B",
  },
  {
    slug: "osp-e-sb", types: ["1"], name: "OSP-E..SB", layout: "SCREW",
    title_sv: "Kulskruvsaktuator med inbyggd glidstyrning",
    title_en: "Ball screw actuator with internal plain bearing guide",
    sizes: ["25", "32", "50"], page_key: 65, product_sku: "PARKER-OSPE-SB",
  },
  {
    slug: "osp-e-st", types: ["2"], name: "OSP-E..ST", layout: "SCREW",
    title_sv: "Trapetsskruvsaktuator med inbyggd glidstyrning",
    title_en: "Trapezoidal screw actuator with internal plain bearing guide",
    sizes: ["25", "32", "50"], page_key: 77, product_sku: "PARKER-OSPE-ST",
  },
  {
    slug: "osp-e-sbr", types: ["4"], name: "OSP-E..SBR", layout: "ROD",
    title_sv: "Kulskruvsaktuator med glidstyrning och kolvstång",
    title_en: "Ball screw actuator with plain bearing guide and piston rod",
    sizes: ["25", "32", "50"], page_key: 87, product_sku: null,
  },
  {
    slug: "osp-e-str", types: ["3"], name: "OSP-E..STR", layout: "ROD",
    title_sv: "Trapetsskruvsaktuator med glidstyrning och kolvstång",
    title_en: "Trapezoidal screw actuator with plain bearing guide and piston rod",
    sizes: ["25", "32", "50"], page_key: 97, product_sku: null,
  },
];

export function ospeVariant(slug: string): OspeVariant | null {
  return OSPE_VARIANTS.find((v) => v.slug === slug) ?? null;
}

export function ospeVariantByType(type: string): OspeVariant | null {
  return OSPE_VARIANTS.find((v) => v.types.includes(type)) ?? null;
}

/** Position 5-6: storleken. Bara BHD (typ 6) och BV finns i 20. */
export const OSPE_SIZES: OspeValue[] = [
  { code: "20", label_sv: "Storlek 20" },
  { code: "25", label_sv: "Storlek 25" },
  { code: "32", label_sv: "Storlek 32" },
  { code: "50", label_sv: "Storlek 50" },
];

/** BHD:s typ av aktuator (sida 25). Typ 5 finns inte i storlek 20. */
export const OSPE_BHD_TYPES: Array<OspeValue & { sizes: string[] }> = [
  { code: "5", sizes: ["25", "32", "50"], label_sv: "Integrerad rullstyrning (storlek 25, 32, 50)" },
  { code: "6", sizes: ["20", "25", "32", "50"], label_sv: "Integrerad kullagrad styrning" },
];

// ── vagnar ─────────────────────────────────────────────────────────────────

export const OSPE_CARRIAGES_B: OspeValue[] = [
  { code: "0", label_sv: "Standardvagn" },
  { code: "1", label_sv: "Tandemvagn (option)" },
  { code: "2", label_sv: "Delad vagn, motriktad rörelse (option)" },
];
export const OSPE_CARRIAGES_SB: OspeValue[] = [
  { code: "0", label_sv: "Standardvagn" },
  { code: "1", label_sv: "Tandemvagn (option)" },
  { code: "3", label_sv: "Renrumsutförande (option)" },
  { code: "4", label_sv: "Med mätsystem SFI-plus (option)" },
];
export const OSPE_CARRIAGES_ST: OspeValue[] = [
  { code: "0", label_sv: "Standardvagn" },
  { code: "4", label_sv: "Med mätsystem SFI-plus (option)" },
];
export const OSPE_CARRIAGES_BHD: OspeValue[] = OSPE_CARRIAGES_B;
export const OSPE_HEADS_BV: OspeValue[] = [
  { code: "0", label_sv: "Standardhuvud" },
  { code: "1", label_sv: "Tandem (option)" },
];

/** BHD position 9: rörelseriktning (sida 25). 2 och 3 är den delade vagnens. */
export const OSPE_BHD_DIRECTIONS: Array<OspeValue & { biparting: boolean }> = [
  { code: "0", biparting: false, label_sv: "Standard, höger" },
  { code: "1", biparting: false, label_sv: "Standard, vänster" },
  { code: "2", biparting: true, label_sv: "Delad vagn, höger" },
  { code: "3", biparting: true, label_sv: "Delad vagn, vänster" },
];

// ── stigningar ─────────────────────────────────────────────────────────────
//
// Fyra skruvvarianter, fyra kodtabeller. Samma stigning har OLIKA kod i olika
// varianter: 5 mm är "3" på SB men "5" på SBR. Avskrivet per sida.

export interface OspePitch extends OspeValue {
  pitch_mm: number;
  sizes: string[];
}

export const OSPE_PITCHES: Record<"osp-e-sb" | "osp-e-st" | "osp-e-sbr" | "osp-e-str", OspePitch[]> = {
  "osp-e-sb": [
    { code: "3", pitch_mm: 5, sizes: ["25", "32", "50"], label_sv: "Stigning 5 mm" },
    { code: "4", pitch_mm: 10, sizes: ["32", "50"], label_sv: "Stigning 10 mm (storlek 32, 50)" },
    { code: "5", pitch_mm: 25, sizes: ["50"], label_sv: "Stigning 25 mm (storlek 50)" },
  ],
  "osp-e-st": [
    { code: "4", pitch_mm: 4, sizes: ["25", "32"], label_sv: "Stigning 4 mm (storlek 25, 32)" },
    { code: "6", pitch_mm: 6, sizes: ["50"], label_sv: "Stigning 6 mm (storlek 50)" },
  ],
  "osp-e-sbr": [
    { code: "5", pitch_mm: 5, sizes: ["25", "32", "50"], label_sv: "Stigning 5 mm" },
    { code: "7", pitch_mm: 10, sizes: ["32", "50"], label_sv: "Stigning 10 mm (storlek 32, 50)" },
    { code: "8", pitch_mm: 25, sizes: ["50"], label_sv: "Stigning 25 mm (storlek 50)" },
  ],
  "osp-e-str": [
    { code: "3", pitch_mm: 3, sizes: ["25"], label_sv: "Stigning 3 mm (storlek 25)" },
    { code: "4", pitch_mm: 4, sizes: ["32"], label_sv: "Stigning 4 mm (storlek 32)" },
    { code: "5", pitch_mm: 5, sizes: ["50"], label_sv: "Stigning 5 mm (storlek 50)" },
  ],
};

// ── växel och monteringssats (B och skruvarna) ─────────────────────────────

export interface OspeGear extends OspeValue {
  sizes: string[];
  /** Vilken motorsats växeln kräver: "För växlar måste motorns sats anges." */
  kits: string[];
}

/** Sida 51/65/77/87/97, samma tabell. */
export const OSPE_GEARS: OspeGear[] = [
  { code: "0", sizes: ["25", "32", "50"], kits: [], label_sv: "Utan växel" },
  { code: "1", sizes: ["25", "32"], kits: ["A0", "A1", "A2"], label_sv: "LP050, i = 5 (storlek 25, 32)" },
  { code: "2", sizes: ["25", "32"], kits: ["A0", "A1", "A2"], label_sv: "LP050, i = 10 (storlek 25, 32)" },
  { code: "3", sizes: ["32", "50"], kits: ["A1", "A2", "A3"], label_sv: "LP070, i = 3 (storlek 32, 50)" },
  { code: "4", sizes: ["32", "50"], kits: ["A1", "A2", "A3"], label_sv: "LP070, i = 5 (storlek 32, 50)" },
  { code: "5", sizes: ["32", "50"], kits: ["A1", "A2", "A3"], label_sv: "LP070, i = 10 (storlek 32, 50)" },
];

export interface OspeKit extends OspeValue {
  sizes: string[];
}

/**
 * "Mounting Kit for Motor and Gear", två tecken. A4 står bara på B:s sida
 * (51); skruvarnas sidor saknar den. "0-" är katalogens egen kod för "utan".
 */
export const OSPE_KITS_MOTOR: OspeKit[] = [
  { code: "A0", sizes: ["25", "32"], label_sv: "Motorfäste SY563T" },
  { code: "A1", sizes: ["25", "32", "50"], label_sv: "Motorfäste SY873T" },
  { code: "A2", sizes: ["25", "32"], label_sv: "Motorfäste SMx60 (fläns 60, axel 8/11)" },
  { code: "A3", sizes: ["32", "50"], label_sv: "Motorfäste SMx82 (fläns 80, axel 8/14)" },
  { code: "A4", sizes: ["50"], label_sv: "Motorfäste SMx100 (fläns 100, axel 5/19)" },
  { code: "A7", sizes: ["32", "50"], label_sv: "Växelfäste PS60" },
  { code: "C0", sizes: ["25", "32"], label_sv: "Växelfäste LP050 / PV40-TA" },
  { code: "C1", sizes: ["32", "50"], label_sv: "Växelfäste LP070 / PV60-TA" },
];
export const OSPE_KIT_NONE = "0-";

export function ospeKitsForLayout(layout: OspeLayout): OspeKit[] {
  return layout === "B" ? OSPE_KITS_MOTOR : OSPE_KITS_MOTOR.filter((k) => k.code !== "A4");
}

/** B position 9: drivaxel, ett tecken (sida 51). */
export const OSPE_SHAFTS_B: OspeValue[] = [
  { code: "0", label_sv: "Slät axel, motor i standardläge" },
  { code: "1", label_sv: "Slät axel, motor 180°" },
  { code: "2", label_sv: "Dubbel slät axel (option)" },
];

/**
 * Skruvarnas position 11-12: ANTINGEN drivaxel ELLER monteringssats. Samma
 * ruta i nyckeln: "0 —" slät axel, "3 —" kil, "4 —" lång med kil, och därunder
 * satserna med fotnoten "väljs en sats är drivaxeln en slät axel" (sida 65).
 */
export const OSPE_SHAFTS_SCREW: OspeValue[] = [
  { code: "0-", label_sv: "Slät axel, utan monteringssats" },
  { code: "3-", label_sv: "Axel med kilspår (option)" },
  { code: "4-", label_sv: "Lång axel med kilspår (option)" },
];

// ── BHD och BV: drivaxel med två tecken ────────────────────────────────────

export interface OspeShaft2 extends OspeValue {
  /** plain: 0A/0B(/0C/0D); clamp: 02-05; hollow: 06/07; gear: 1X-6X. */
  kind: "plain" | "clamp" | "hollow" | "gear";
  /** Bara BHD:s integrerade växel är storleksbegränsad ("** for sizes 25, 32 and 50"). */
  sizes?: string[];
}

export const OSPE_SHAFTS_BHD: OspeShaft2[] = [
  { code: "0A", kind: "plain", label_sv: "Slät axel, motor i standardläge" },
  { code: "0B", kind: "plain", label_sv: "Slät axel, motor 180°" },
  { code: "02", kind: "clamp", label_sv: "Klämaxel, motor i standardläge" },
  { code: "03", kind: "clamp", label_sv: "Klämaxel med slät axel, motor i standardläge (option)" },
  { code: "04", kind: "clamp", label_sv: "Klämaxel, motor 180°" },
  { code: "05", kind: "clamp", label_sv: "Klämaxel med slät axel, motor 180° (option)" },
  { code: "06", kind: "hollow", label_sv: "Hålaxel med kilspår, motor i standardläge (option)" },
  { code: "07", kind: "hollow", label_sv: "Hålaxel med kilspår, motor 180° (option)" },
  { code: "1X", kind: "gear", sizes: ["25", "32", "50"], label_sv: "Integrerad växel i = 3, motor i standardläge" },
  { code: "2X", kind: "gear", sizes: ["25", "32", "50"], label_sv: "Integrerad växel i = 5, motor i standardläge" },
  { code: "3X", kind: "gear", sizes: ["25", "32", "50"], label_sv: "Integrerad växel i = 10, motor i standardläge" },
  { code: "4X", kind: "gear", sizes: ["25", "32", "50"], label_sv: "Integrerad växel i = 3, motor 180°" },
  { code: "5X", kind: "gear", sizes: ["25", "32", "50"], label_sv: "Integrerad växel i = 5, motor 180°" },
  { code: "6X", kind: "gear", sizes: ["25", "32", "50"], label_sv: "Integrerad växel i = 10, motor 180°" },
];

export const OSPE_SHAFTS_BV: OspeShaft2[] = [
  { code: "0A", kind: "plain", label_sv: "Slät axel, motor i standardläge" },
  { code: "0B", kind: "plain", label_sv: "Slät axel, motor 180°" },
  { code: "0C", kind: "plain", label_sv: "Dubbel slät axel, motor i standardläge (option)" },
  { code: "0D", kind: "plain", label_sv: "Dubbel slät axel, motor 180° (option)" },
  { code: "02", kind: "clamp", label_sv: "Klämaxel, motor i standardläge" },
  { code: "03", kind: "clamp", label_sv: "Klämaxel med slät axel, motor i standardläge (option)" },
  { code: "04", kind: "clamp", label_sv: "Klämaxel, motor 180°" },
  { code: "05", kind: "clamp", label_sv: "Klämaxel med slät axel, motor 180° (option)" },
  { code: "06", kind: "hollow", label_sv: "Hålaxel, motor i standardläge (option)" },
  { code: "07", kind: "hollow", label_sv: "Hålaxel, motor 180° (option)" },
];

/**
 * BHD:s och BV:s svanssats, två tecken. Kryssmatrisen har två sorters kryss:
 * x1 = satsen passar en KLÄMAXEL (02-05), x2 = en SLÄT axel (0A/0B, på BV
 * även 0C/0D). Avskrivet cell för cell från sida 26 respektive 38.
 */
export interface OspeGearKit extends OspeValue {
  /** storlek -> vilken axeltyp satsen kräver */
  fits: Record<string, "plain" | "clamp">;
}
export const OSPE_GEARKIT_NONE = "00";

export const OSPE_KITS_BHD: OspeGearKit[] = [
  { code: "A7", fits: { "20": "plain", "25": "clamp" }, label_sv: "Växelfäste PS60" },
  { code: "A8", fits: { "32": "clamp" }, label_sv: "Växelfäste PS90" },
  { code: "A9", fits: { "50": "clamp" }, label_sv: "Växelfäste PS115" },
  { code: "C0", fits: { "20": "clamp" }, label_sv: "Växelfäste LP050 / PV40-TA" },
  { code: "C1", fits: { "20": "plain", "25": "clamp" }, label_sv: "Växelfäste LP070 / PV60-TA" },
  { code: "C2", fits: { "32": "clamp" }, label_sv: "Växelfäste LP090 / PV90-TA" },
  { code: "C3", fits: { "50": "clamp" }, label_sv: "Växelfäste LP120" },
];

export const OSPE_KITS_BV: OspeGearKit[] = [
  { code: "A3", fits: { "20": "plain", "25": "plain" }, label_sv: "Motorfäste SMx82 (fläns 80, axel 8/14)" },
  { code: "A7", fits: { "20": "plain", "25": "clamp" }, label_sv: "Växelfäste PS60" },
  { code: "C0", fits: { "20": "clamp" }, label_sv: "Växelfäste LP050 / PV40-TA" },
  { code: "C1", fits: { "20": "plain", "25": "clamp" }, label_sv: "Växelfäste LP070 / PV60-TA" },
];

// ── svansen ────────────────────────────────────────────────────────────────

export const OSPE_NIRO: OspeValue[] = [
  { code: "0", label_sv: "Standardskruvar" },
  { code: "1", label_sv: "Rostfria skruvar, Niro (option)" },
];

/** B:s yttre styrning (sida 52). Powerslide-storlekarna står i namnet. */
export interface OspeGuide extends OspeValue {
  sizes: string[] | null;
}
const ALLA = ["25", "32", "50"];
const PS: OspeGuide[] = [
  { code: "E", sizes: ["25"], label_sv: "PS Powerslide 25/25 (storlek 25)" },
  { code: "F", sizes: ["25", "32"], label_sv: "PS Powerslide 25/35 eller 32/35 (storlek 25, 32)" },
  { code: "G", sizes: ["25", "32"], label_sv: "PS Powerslide 25/44 eller 32/44 (storlek 25, 32)" },
  { code: "H", sizes: ["50"], label_sv: "PS Powerslide 50/60 (storlek 50)" },
  { code: "I", sizes: ["50"], label_sv: "PS Powerslide 50/76 (storlek 50)" },
];
const KOMP: OspeGuide[] = [
  { code: "M", sizes: ALLA, label_sv: "Inverterad vagn" },
  { code: "R", sizes: ALLA, label_sv: "Kompensationskoppling" },
  { code: "S", sizes: ALLA, label_sv: "Kompensationskoppling, lågt glapp" },
];
export const OSPE_GUIDES_B: OspeGuide[] = [
  { code: "0", sizes: ALLA, label_sv: "Utan yttre styrning" },
  { code: "6", sizes: ALLA, label_sv: "PL Proline" },
  ...PS,
  ...KOMP,
];
/** SB och ST (sida 66, 78) har därtill Slideline och HD. */
export const OSPE_GUIDES_SCREW: OspeGuide[] = [
  { code: "0", sizes: ALLA, label_sv: "Utan yttre styrning" },
  { code: "2", sizes: ALLA, label_sv: "SL Slideline" },
  { code: "6", sizes: ALLA, label_sv: "PL Proline" },
  { code: "D", sizes: ALLA, label_sv: "HD Heavy Duty" },
  ...PS,
  ...KOMP,
];

/** B:s styrläge (sida 52). SB/ST har bara "0 Standard" och får en fast nolla. */
export const OSPE_GUIDE_POSITIONS_B: OspeValue[] = [
  { code: "0", label_sv: "Styrning på standardsidan" },
  { code: "1", label_sv: "Styrning 180°" },
];

/** SBR/STR: kolvstångens fäste (sida 88, 98). */
export const OSPE_ROD_MOUNTINGS: OspeValue[] = [
  { code: "0", label_sv: "Utan stångfäste" },
  { code: "T", label_sv: "Kolvstångsöga" },
  { code: "U", label_sv: "Kolvstångsgaffel" },
  { code: "V", label_sv: "Kompensationskoppling för kolvstång" },
];

export interface OspeEndCap extends OspeValue {
  sizes: string[] | null;
}
/** B, SB, ST (sida 52, 66, 78). Typ B4 finns bara i 25 och 32. */
export const OSPE_END_CAPS_STD: OspeEndCap[] = [
  { code: "0", sizes: null, label_sv: "Utan ändlocksfäste" },
  { code: "1", sizes: null, label_sv: "Ett par typ A1 (storlek 25, 32) / C1 (storlek 50)" },
  { code: "2", sizes: null, label_sv: "Ett par typ A2 (storlek 25, 32) / C2 (storlek 50)" },
  { code: "3", sizes: null, label_sv: "Ett par typ A3 (storlek 25, 32) / C3 (storlek 50)" },
  { code: "4", sizes: null, label_sv: "Ett par typ B1 (storlek 25, 32) / C4 (storlek 50)" },
  { code: "5", sizes: ["25", "32"], label_sv: "Ett par typ B4 (storlek 25, 32)" },
];
/** SBR, STR (sida 88, 98). */
export const OSPE_END_CAPS_ROD: OspeEndCap[] = [
  { code: "0", sizes: null, label_sv: "Utan ändlocksfäste" },
  { code: "1", sizes: null, label_sv: "Ett fäste typ A1SR (storlek 25, 32) / C1SR (storlek 50)" },
  { code: "2", sizes: null, label_sv: "Ett flänsfäste typ C-E" },
];
/** BHD (sida 26). */
export const OSPE_END_CAPS_BHD: OspeEndCap[] = [
  { code: "0", sizes: null, label_sv: "Utan ändlocksfäste" },
  { code: "A", sizes: null, label_sv: "Ett par typ CN" },
  { code: "B", sizes: null, label_sv: "Ett par typ CO" },
];

// ANTALEN SKRIVS MED ORD. Konfiguratorn klipper bort etikettens inledande
// kod ("1 par typ E1" med koden 1 visades som "par typ E1"), så "Ett par",
// "Två" och "Tre" -- inte "1 par", "2 st".
const PROFIL_1_9: OspeValue[] = [
  { code: "1", label_sv: "Ett par typ E1" },
  { code: "2", label_sv: "Ett par typ D1" },
  { code: "3", label_sv: "Ett par typ MAE" },
  { code: "4", label_sv: "Två par typ E1" },
  { code: "5", label_sv: "Två par typ D1" },
  { code: "6", label_sv: "Två par typ MAE" },
  { code: "7", label_sv: "Tre par typ E1" },
  { code: "8", label_sv: "Tre par typ D1" },
  { code: "9", label_sv: "Tre par typ MAE" },
];
const UTAN_PROFIL: OspeValue = { code: "0", label_sv: "Utan profilfäste" };

/** B, SB, ST (sida 52, 66, 78): E2-E4 med bokstäver. Bokstaven O används inte. */
export const OSPE_PROFILES_STD: OspeValue[] = [
  UTAN_PROFIL,
  ...PROFIL_1_9,
  { code: "K", label_sv: "Ett par typ E2" },
  { code: "L", label_sv: "Ett par typ E3" },
  { code: "M", label_sv: "Ett par typ E4" },
  { code: "N", label_sv: "Två par typ E2" },
  { code: "P", label_sv: "Två par typ E3" },
  { code: "Q", label_sv: "Två par typ E4" },
  { code: "R", label_sv: "Tre par typ E2" },
  { code: "S", label_sv: "Tre par typ E3" },
  { code: "T", label_sv: "Tre par typ E4" },
];
/** SBR, STR (sida 88, 98): tapplagring i stället för E2-E4. */
export const OSPE_PROFILES_ROD: OspeValue[] = [
  UTAN_PROFIL,
  ...PROFIL_1_9,
  { code: "K", label_sv: "Ett par tapplagring EN" },
  { code: "L", label_sv: "Ett par tapplagring EN och svängfäste EL" },
];
/** BHD (sida 26): upp till fyra par. */
export const OSPE_PROFILES_BHD: OspeValue[] = [
  UTAN_PROFIL,
  ...PROFIL_1_9,
  { code: "A", label_sv: "Fyra par typ E1" },
  { code: "B", label_sv: "Fyra par typ D1" },
  { code: "C", label_sv: "Fyra par typ MAE" },
];

/** Magnetgivare, hela listan (sida 26, 52, 66, 78, 88). */
export const OSPE_SENSORS_FULL: OspeValue[] = [
  { code: "0", label_sv: "Utan givare" },
  { code: "1", label_sv: "En RST-K 2NO, 5 m kabel" },
  { code: "2", label_sv: "En RST-K 2NC, 5 m kabel" },
  { code: "3", label_sv: "Två RST-K 2NC, 5 m kabel" },
  { code: "4", label_sv: "Två RST-K 2NC + en RST-K 2NO, 5 m kabel" },
  { code: "5", label_sv: "En RST-S 2NO, M8-kontakt" },
  { code: "6", label_sv: "En RST-S 2NC, M8-kontakt" },
  { code: "7", label_sv: "Två RST-S 2NC, M8-kontakt" },
  { code: "8", label_sv: "Två RST-S 2NC + en RST-S 2NO, M8-kontakt" },
  { code: "A", label_sv: "En EST-S NPN, M8-kontakt" },
  { code: "B", label_sv: "Två EST-S NPN, M8-kontakt" },
  { code: "C", label_sv: "Tre EST-S NPN, M8-kontakt" },
  { code: "D", label_sv: "En EST-S PNP, M8-kontakt" },
  { code: "E", label_sv: "Två EST-S PNP, M8-kontakt" },
  { code: "F", label_sv: "Tre EST-S PNP, M8-kontakt" },
];
/** STR (sida 98) har en kortare lista: reed 0-4 och PNP D-F. */
export const OSPE_SENSORS_STR: OspeValue[] = [
  { code: "0", label_sv: "Utan givare" },
  { code: "1", label_sv: "En RS-K 2NO, 5 m kabel" },
  { code: "2", label_sv: "En RS-K 2NC, 5 m kabel" },
  { code: "3", label_sv: "Två RS-K 2NC, 5 m kabel" },
  { code: "4", label_sv: "Två RS-K 2NC + en RS-K 2NO, 5 m kabel" },
  { code: "D", label_sv: "En ES-S PNP, M8-kontakt" },
  { code: "E", label_sv: "Två ES-S PNP, M8-kontakt" },
  { code: "F", label_sv: "Tre ES-S PNP, M8-kontakt" },
];
/** BV (sida 38): utan, eller två NC-givare med magneter. */
export const OSPE_SENSORS_BV: OspeValue[] = [
  { code: "0", label_sv: "Utan givare" },
  { code: "2", label_sv: "Två RST-S NC, M8-kontakt, med magneter (option)" },
];

// ── tekniska data ──────────────────────────────────────────────────────────
//
// "Performance Overview" per variant. För remdrifterna gäller kraften vid
// < 1 m/s; för skruvarna är hastigheten stigningen gånger 3 000 varv/min.
// Slaget är "Max. Standard Stroke Length" -- längre finns på begäran, men
// inte i beställnyckeln.

export interface OspeTech {
  slug: OspeSlug;
  /** BHD: 5 eller 6 (olika styrning ger olika tak). Annars null. */
  type: string | null;
  size: string;
  /** Skruvarna: stigningens kod. Annars null. */
  pitch: string | null;
  max_speed_ms: number;
  max_force_n: number;
  max_stroke_mm: number;
}

export const OSPE_TECH: OspeTech[] = [
  // BHD, kullagrad styrning (sida 17). Hastighet 10 m/s finns på begäran.
  { slug: "osp-e-bhd", type: "6", size: "20", pitch: null, max_speed_ms: 3, max_force_n: 550, max_stroke_mm: 5760 },
  { slug: "osp-e-bhd", type: "6", size: "25", pitch: null, max_speed_ms: 5, max_force_n: 1070, max_stroke_mm: 5700 },
  { slug: "osp-e-bhd", type: "6", size: "32", pitch: null, max_speed_ms: 5, max_force_n: 1870, max_stroke_mm: 5600 },
  { slug: "osp-e-bhd", type: "6", size: "50", pitch: null, max_speed_ms: 5, max_force_n: 3120, max_stroke_mm: 5500 },
  // BHD, rullstyrning (sida 22).
  { slug: "osp-e-bhd", type: "5", size: "25", pitch: null, max_speed_ms: 10, max_force_n: 1070, max_stroke_mm: 7000 },
  { slug: "osp-e-bhd", type: "5", size: "32", pitch: null, max_speed_ms: 10, max_force_n: 1870, max_stroke_mm: 7000 },
  { slug: "osp-e-bhd", type: "5", size: "50", pitch: null, max_speed_ms: 10, max_force_n: 3120, max_stroke_mm: 7000 },
  // BV (sida 33).
  { slug: "osp-e-bv", type: null, size: "20", pitch: null, max_speed_ms: 3, max_force_n: 650, max_stroke_mm: 1000 },
  { slug: "osp-e-bv", type: null, size: "25", pitch: null, max_speed_ms: 5, max_force_n: 1430, max_stroke_mm: 1500 },
  // B (sida 45).
  { slug: "osp-e-b", type: null, size: "25", pitch: null, max_speed_ms: 2, max_force_n: 50, max_stroke_mm: 3000 },
  { slug: "osp-e-b", type: null, size: "32", pitch: null, max_speed_ms: 3, max_force_n: 150, max_stroke_mm: 5000 },
  { slug: "osp-e-b", type: null, size: "50", pitch: null, max_speed_ms: 5, max_force_n: 425, max_stroke_mm: 5000 },
  // SB (sida 59).
  { slug: "osp-e-sb", type: null, size: "25", pitch: "3", max_speed_ms: 0.25, max_force_n: 250, max_stroke_mm: 1100 },
  { slug: "osp-e-sb", type: null, size: "32", pitch: "3", max_speed_ms: 0.25, max_force_n: 600, max_stroke_mm: 2000 },
  { slug: "osp-e-sb", type: null, size: "32", pitch: "4", max_speed_ms: 0.5, max_force_n: 600, max_stroke_mm: 2000 },
  { slug: "osp-e-sb", type: null, size: "50", pitch: "3", max_speed_ms: 0.25, max_force_n: 1500, max_stroke_mm: 3200 },
  { slug: "osp-e-sb", type: null, size: "50", pitch: "4", max_speed_ms: 0.5, max_force_n: 1500, max_stroke_mm: 3200 },
  { slug: "osp-e-sb", type: null, size: "50", pitch: "5", max_speed_ms: 1.25, max_force_n: 1500, max_stroke_mm: 3200 },
  // ST (sida 73).
  { slug: "osp-e-st", type: null, size: "25", pitch: "4", max_speed_ms: 0.1, max_force_n: 600, max_stroke_mm: 1100 },
  { slug: "osp-e-st", type: null, size: "32", pitch: "4", max_speed_ms: 0.1, max_force_n: 1300, max_stroke_mm: 2000 },
  { slug: "osp-e-st", type: null, size: "50", pitch: "6", max_speed_ms: 0.15, max_force_n: 2500, max_stroke_mm: 2500 },
  // SBR (sida 85).
  { slug: "osp-e-sbr", type: null, size: "25", pitch: "5", max_speed_ms: 0.25, max_force_n: 260, max_stroke_mm: 500 },
  { slug: "osp-e-sbr", type: null, size: "32", pitch: "5", max_speed_ms: 0.25, max_force_n: 900, max_stroke_mm: 500 },
  { slug: "osp-e-sbr", type: null, size: "32", pitch: "7", max_speed_ms: 0.5, max_force_n: 900, max_stroke_mm: 500 },
  { slug: "osp-e-sbr", type: null, size: "50", pitch: "5", max_speed_ms: 0.25, max_force_n: 1200, max_stroke_mm: 500 },
  { slug: "osp-e-sbr", type: null, size: "50", pitch: "7", max_speed_ms: 0.5, max_force_n: 1200, max_stroke_mm: 500 },
  { slug: "osp-e-sbr", type: null, size: "50", pitch: "8", max_speed_ms: 1.25, max_force_n: 1200, max_stroke_mm: 500 },
  // STR (sida 95).
  { slug: "osp-e-str", type: null, size: "25", pitch: "3", max_speed_ms: 0.075, max_force_n: 800, max_stroke_mm: 500 },
  { slug: "osp-e-str", type: null, size: "32", pitch: "4", max_speed_ms: 0.1, max_force_n: 1600, max_stroke_mm: 500 },
  { slug: "osp-e-str", type: null, size: "50", pitch: "5", max_speed_ms: 0.125, max_force_n: 3300, max_stroke_mm: 500 },
];

/** Skruvarnas max varvtal på drivaxeln, alla storlekar (sida 59, 73, 85, 95). */
export const OSPE_SCREW_RPM: Record<"osp-e-sb" | "osp-e-st" | "osp-e-sbr" | "osp-e-str", number> = {
  "osp-e-sb": 3000,
  "osp-e-st": 1500,
  "osp-e-sbr": 3000,
  "osp-e-str": 1500,
};

export function ospeTech(slug: OspeSlug, size: string, opts: { type?: string; pitch?: string } = {}): OspeTech | null {
  return OSPE_TECH.find((t) =>
    t.slug === slug && t.size === size &&
    (t.type === null || t.type === opts.type) &&
    (t.pitch === null || t.pitch === opts.pitch)
  ) ?? null;
}

export function ospeMaxStroke(slug: OspeSlug, size: string, opts: { type?: string; pitch?: string } = {}): number | null {
  // Skruvarnas slagtak är per storlek, inte per stigning; vilken rad som helst duger.
  const rad = OSPE_TECH.find((t) =>
    t.slug === slug && t.size === size && (t.type === null || t.type === opts.type)
  );
  return rad?.max_stroke_mm ?? null;
}

export const OSPE_LIMITS = {
  /** Slaglängden skrivs med fem siffror i mm ("5 digits input in mm"). */
  stroke_digits: 5,
  stroke_min_mm: 1,
} as const;

// ── listor per variant ─────────────────────────────────────────────────────

export function ospePitches(slug: OspeSlug): OspePitch[] {
  return slug in OSPE_PITCHES ? OSPE_PITCHES[slug as keyof typeof OSPE_PITCHES] : [];
}

export function ospePitchesForSize(slug: OspeSlug, size: string): string[] {
  return ospePitches(slug).filter((p) => p.sizes.includes(size)).map((p) => p.code);
}

export function ospeCarriages(slug: OspeSlug): OspeValue[] {
  switch (slug) {
    case "osp-e-b": return OSPE_CARRIAGES_B;
    case "osp-e-sb": return OSPE_CARRIAGES_SB;
    case "osp-e-st": return OSPE_CARRIAGES_ST;
    case "osp-e-bhd": return OSPE_CARRIAGES_BHD;
    case "osp-e-bv": return OSPE_HEADS_BV;
    default: return [];
  }
}

export function ospeGuides(slug: OspeSlug): OspeGuide[] {
  if (slug === "osp-e-b") return OSPE_GUIDES_B;
  if (slug === "osp-e-sb" || slug === "osp-e-st") return OSPE_GUIDES_SCREW;
  return [];
}

export function ospeEndCaps(slug: OspeSlug): OspeEndCap[] {
  const v = ospeVariant(slug)!;
  if (v.layout === "ROD") return OSPE_END_CAPS_ROD;
  if (v.layout === "BHD") return OSPE_END_CAPS_BHD;
  if (v.layout === "BV") return [];
  return OSPE_END_CAPS_STD;
}

export function ospeProfiles(slug: OspeSlug): OspeValue[] {
  const v = ospeVariant(slug)!;
  if (v.layout === "ROD") return OSPE_PROFILES_ROD;
  if (v.layout === "BHD") return OSPE_PROFILES_BHD;
  if (v.layout === "BV") return [];
  return OSPE_PROFILES_STD;
}

export function ospeSensors(slug: OspeSlug): OspeValue[] {
  if (slug === "osp-e-str") return OSPE_SENSORS_STR;
  if (slug === "osp-e-bv") return OSPE_SENSORS_BV;
  return OSPE_SENSORS_FULL;
}

/** Skruvarnas position 11-12: axelvalen följt av satserna. */
export function ospeShaftOrKitOptions(slug: OspeSlug): OspeValue[] {
  const v = ospeVariant(slug)!;
  return [...OSPE_SHAFTS_SCREW, ...ospeKitsForLayout(v.layout)];
}

/** B:s sats-position: "0-" följt av satserna. */
export function ospeMotorKitOptions(): OspeValue[] {
  return [{ code: OSPE_KIT_NONE, label_sv: "Utan monteringssats" }, ...OSPE_KITS_MOTOR];
}

export function ospeGearKitOptions(slug: OspeSlug): OspeValue[] {
  const lista = slug === "osp-e-bv" ? OSPE_KITS_BV : OSPE_KITS_BHD;
  return [{ code: OSPE_GEARKIT_NONE, label_sv: "Utan monteringssats" }, ...lista];
}

export function ospeShafts2(slug: OspeSlug): OspeShaft2[] {
  return slug === "osp-e-bv" ? OSPE_SHAFTS_BV : OSPE_SHAFTS_BHD;
}

/** Vilka satser (två tecken) som passar storleken och axeln på BHD/BV. */
export function ospeGearKitsFor(slug: OspeSlug, size: string, shaft: string): string[] {
  const axel = ospeShafts2(slug).find((s) => s.code === shaft);
  if (!axel) return [];
  const lista = slug === "osp-e-bv" ? OSPE_KITS_BV : OSPE_KITS_BHD;
  return lista.filter((k) => k.fits[size] === axel.kind).map((k) => k.code);
}

// ── bygga och läsa koden ───────────────────────────────────────────────────

export interface OspeConfig {
  slug: OspeSlug;
  size: string;
  stroke_mm: number;
  /** BHD: 5 eller 6. Övriga sätts av varianten. */
  type?: string;
  carriage?: string;
  /** B: ett tecken. BHD/BV: två. */
  drive_shaft?: string;
  pitch?: string;
  gear?: string;
  /** B: "0-" eller sats. Skruvar: "0-"/"3-"/"4-" eller sats. BHD/BV: svansens sats "00"/A7… */
  kit?: string;
  op_direction?: string;
  niro?: string;
  ext_guide?: string;
  guide_position?: string;
  rod_mounting?: string;
  end_cap?: string;
  profile_mounting?: string;
  sensors?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string | undefined) =>
  kod !== undefined && lista.some((v) => v.code === kod);

/**
 * Bygger koden, eller null om något val inte finns i katalogen för den
 * varianten och storleken. Ovalda optionsfält blir sitt "utan"-värde: koden
 * är positionell och tål inga tomrum.
 */
export function ospeBuildCode(c: OspeConfig): string | null {
  const v = ospeVariant(c.slug);
  if (!v) return null;
  if (!v.sizes.includes(c.size)) return null;
  const s = Math.trunc(c.stroke_mm);
  const tak = ospeMaxStroke(c.slug, c.size, { type: c.type ?? v.types[0], pitch: c.pitch });
  if (!Number.isFinite(s) || s < OSPE_LIMITS.stroke_min_mm || tak === null || s > tak) return null;
  const slag = String(s).padStart(OSPE_LIMITS.stroke_digits, "0");

  const niro = c.niro ?? "0";
  if (!har(OSPE_NIRO, niro)) return null;
  const sensors = c.sensors ?? "0";
  if (!har(ospeSensors(c.slug), sensors)) return null;

  const skruv = () => {
    const pitch = c.pitch ?? "";
    if (!ospePitchesForSize(c.slug, c.size).includes(pitch)) return null;
    const gear = c.gear ?? "0";
    const g = OSPE_GEARS.find((x) => x.code === gear);
    if (!g || !g.sizes.includes(c.size)) return null;
    const kit = c.kit ?? OSPE_KIT_NONE;
    const satser = ospeKitsForLayout(v.layout);
    const arSats = satser.some((k) => k.code === kit);
    if (!arSats && !har(OSPE_SHAFTS_SCREW, kit)) return null;
    if (arSats && !satser.find((k) => k.code === kit)!.sizes.includes(c.size)) return null;
    if (g.kits.length > 0 && !g.kits.includes(kit)) return null;
    return { pitch, gear, kit };
  };

  const stdSvans = () => {
    const endCap = c.end_cap ?? "0";
    const e = ospeEndCaps(c.slug).find((x) => x.code === endCap);
    if (!e || (e.sizes && !e.sizes.includes(c.size))) return null;
    const profile = c.profile_mounting ?? "0";
    if (!har(ospeProfiles(c.slug), profile)) return null;
    return { endCap, profile };
  };

  switch (v.layout) {
    case "B": {
      const carriage = c.carriage ?? "0";
      if (!har(OSPE_CARRIAGES_B, carriage)) return null;
      const shaft = c.drive_shaft ?? "0";
      if (!har(OSPE_SHAFTS_B, shaft)) return null;
      const gear = c.gear ?? "0";
      const g = OSPE_GEARS.find((x) => x.code === gear);
      if (!g || !g.sizes.includes(c.size)) return null;
      const kit = c.kit ?? OSPE_KIT_NONE;
      if (kit !== OSPE_KIT_NONE) {
        const k = OSPE_KITS_MOTOR.find((x) => x.code === kit);
        if (!k || !k.sizes.includes(c.size)) return null;
      }
      if (g.kits.length > 0 && !g.kits.includes(kit)) return null;
      const guide = c.ext_guide ?? "0";
      const gd = OSPE_GUIDES_B.find((x) => x.code === guide);
      if (!gd || (gd.sizes && !gd.sizes.includes(c.size))) return null;
      const pos = c.guide_position ?? "0";
      if (!har(OSPE_GUIDE_POSITIONS_B, pos)) return null;
      const sv = stdSvans();
      if (!sv) return null;
      return `${OSPE_SERIES}${c.size}0${carriage}${shaft}${gear}${kit}${slag}${niro}${guide}${pos}${sv.endCap}${sv.profile}${sensors}`;
    }
    case "SCREW": {
      const carriage = c.carriage ?? "0";
      if (!har(ospeCarriages(c.slug), carriage)) return null;
      const sk = skruv();
      if (!sk) return null;
      const guide = c.ext_guide ?? "0";
      const gd = OSPE_GUIDES_SCREW.find((x) => x.code === guide);
      if (!gd || (gd.sizes && !gd.sizes.includes(c.size))) return null;
      const sv = stdSvans();
      if (!sv) return null;
      return `${OSPE_SERIES}${c.size}${v.types[0]}${carriage}${sk.pitch}${sk.gear}${sk.kit}${slag}${niro}${guide}0${sv.endCap}${sv.profile}${sensors}`;
    }
    case "ROD": {
      const sk = skruv();
      if (!sk) return null;
      const rod = c.rod_mounting ?? "0";
      if (!har(OSPE_ROD_MOUNTINGS, rod)) return null;
      const sv = stdSvans();
      if (!sv) return null;
      return `${OSPE_SERIES}${c.size}${v.types[0]}0${sk.pitch}${sk.gear}${sk.kit}${slag}${niro}${rod}0${sv.endCap}${sv.profile}${sensors}`;
    }
    case "BHD": {
      const type = c.type ?? "";
      const t = OSPE_BHD_TYPES.find((x) => x.code === type);
      if (!t || !t.sizes.includes(c.size)) return null;
      const carriage = c.carriage ?? "0";
      if (!har(OSPE_CARRIAGES_BHD, carriage)) return null;
      const dir = c.op_direction ?? "0";
      const d = OSPE_BHD_DIRECTIONS.find((x) => x.code === dir);
      if (!d || d.biparting !== (carriage === "2")) return null;
      const shaft = c.drive_shaft ?? "";
      const sh = OSPE_SHAFTS_BHD.find((x) => x.code === shaft);
      if (!sh || (sh.sizes && !sh.sizes.includes(c.size))) return null;
      const kit = c.kit ?? OSPE_GEARKIT_NONE;
      if (kit !== OSPE_GEARKIT_NONE && !ospeGearKitsFor(c.slug, c.size, shaft).includes(kit)) return null;
      const sv = stdSvans();
      if (!sv) return null;
      return `${OSPE_SERIES}${c.size}${type}${carriage}${dir}${shaft}${slag}${niro}${kit}${sv.endCap}${sv.profile}${sensors}`;
    }
    case "BV": {
      const head = c.carriage ?? "0";
      if (!har(OSPE_HEADS_BV, head)) return null;
      const shaft = c.drive_shaft ?? "";
      if (!har(OSPE_SHAFTS_BV, shaft)) return null;
      const kit = c.kit ?? OSPE_GEARKIT_NONE;
      if (kit !== OSPE_GEARKIT_NONE && !ospeGearKitsFor(c.slug, c.size, shaft).includes(kit)) return null;
      return `${OSPE_SERIES}${c.size}7${head}0${shaft}${slag}${niro}${kit}00${sensors}`;
    }
  }
}

export interface OspeReading {
  slug: OspeSlug;
  type: string;
  size: string;
  /** Första gruppen efter typen: fyra tecken (BHD/BV) eller fem (B/skruvar). */
  group: string;
  stroke_mm: number;
  tail: string;
  config: OspeConfig;
}

/**
 * Läser en kod i konfiguratorns form (utan tankstreck). Distributörernas
 * form med tankstreck och USA-bokstav ("OSPE25-60002-00000-P00000") tas
 * emot också: strecken tas bort och P/Q blir 0/1, det är samma kod.
 */
export function ospeParseCode(raw: string): OspeReading | null {
  let k = raw.trim().toUpperCase();
  // OSPE25-00000-00500-P00000 -> OSPE2500000-00500000000. På typ 0-4 är
  // strecket efter första gruppen satsens andra tecken och ska vara kvar; på
  // typ 5-7 är det bara en avskiljare. USA-bokstaven P/Q blir 0/1.
  const us = /^(OSPE\d{2})-([0-4][0-9A-Z]{3}(?:[0-9A-Z]{2}|[0-9A-Z]-)|[5-7][0-9A-Z]{4})-?(\d{5})-([PQ01][0-9A-Z]{5})$/.exec(k);
  if (us) {
    const svans = us[4].replace(/^P/, "0").replace(/^Q/, "1");
    k = `${us[1]}${us[2]}${us[3]}${svans}`;
  }
  const m = /^OSPE(\d{2})(\d)([0-9A-Z\-]{4,5})(\d{5})([0-9A-Z]{6})$/.exec(k);
  if (!m) return null;
  const [, size, type, group, slagStr, tail] = m;
  const v = ospeVariantByType(type);
  if (!v) return null;
  const stroke_mm = Number(slagStr);
  const c: OspeConfig = { slug: v.slug, size, stroke_mm, type, niro: tail[0], sensors: tail[5] };
  switch (v.layout) {
    case "B":
      if (group.length !== 5) return null;
      Object.assign(c, {
        carriage: group[0], drive_shaft: group[1], gear: group[2], kit: group.slice(3, 5),
        ext_guide: tail[1], guide_position: tail[2], end_cap: tail[3], profile_mounting: tail[4],
      });
      break;
    case "SCREW":
      if (group.length !== 5) return null;
      Object.assign(c, {
        carriage: group[0], pitch: group[1], gear: group[2], kit: group.slice(3, 5),
        ext_guide: tail[1], end_cap: tail[3], profile_mounting: tail[4],
      });
      if (tail[2] !== "0") return null;
      break;
    case "ROD":
      if (group.length !== 5 || group[0] !== "0") return null;
      Object.assign(c, {
        pitch: group[1], gear: group[2], kit: group.slice(3, 5),
        rod_mounting: tail[1], end_cap: tail[3], profile_mounting: tail[4],
      });
      if (tail[2] !== "0") return null;
      break;
    case "BHD":
      if (group.length !== 4) return null;
      Object.assign(c, {
        carriage: group[0], op_direction: group[1], drive_shaft: group.slice(2, 4),
        kit: tail.slice(1, 3), end_cap: tail[3], profile_mounting: tail[4],
      });
      break;
    case "BV":
      if (group.length !== 4 || group[1] !== "0") return null;
      Object.assign(c, { carriage: group[0], drive_shaft: group.slice(2, 4), kit: tail.slice(1, 3) });
      if (tail.slice(3, 5) !== "00") return null;
      break;
  }
  if (ospeBuildCode(c) !== k) return null;
  return { slug: v.slug, type, size, group, stroke_mm, tail, config: c };
}

// ── mallarna ───────────────────────────────────────────────────────────────
//
// En per familj. Konstanta positioner står som literaler, precis som CCIV:s
// "0" och "P": en tom platshållare hade fallit bort och gett en kod som är
// ett tecken för kort och ser nästan rätt ut.

export const OSPE_ORDER_CODE_TEMPLATES: Record<OspeSlug, string> = {
  "osp-e-b":
    "OSPE{size}0{carriage}{drive_shaft}{gear}{kit}{stroke_mm#5}" +
    "{niro}{ext_guide}{guide_position}{end_cap}{profile_mounting}{sensors}",
  "osp-e-sb":
    "OSPE{size}1{carriage}{pitch}{gear}{kit}{stroke_mm#5}" +
    "{niro}{ext_guide}0{end_cap}{profile_mounting}{sensors}",
  "osp-e-st":
    "OSPE{size}2{carriage}{pitch}{gear}{kit}{stroke_mm#5}" +
    "{niro}{ext_guide}0{end_cap}{profile_mounting}{sensors}",
  "osp-e-sbr":
    "OSPE{size}40{pitch}{gear}{kit}{stroke_mm#5}" +
    "{niro}{rod_mounting}0{end_cap}{profile_mounting}{sensors}",
  "osp-e-str":
    "OSPE{size}30{pitch}{gear}{kit}{stroke_mm#5}" +
    "{niro}{rod_mounting}0{end_cap}{profile_mounting}{sensors}",
  "osp-e-bhd":
    "OSPE{size}{type}{carriage}{op_direction}{drive_shaft}{stroke_mm#5}" +
    "{niro}{kit}{end_cap}{profile_mounting}{sensors}",
  "osp-e-bv":
    "OSPE{size}7{carriage}0{drive_shaft}{stroke_mm#5}" +
    "{niro}{kit}00{sensors}",
};

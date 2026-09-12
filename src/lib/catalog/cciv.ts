/**
 * Metal Work CCIV — kompaktcylinder med integrerad 5/2-magnetventil.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Metal Work, "General Catalogue", avsnitt A1.136-A1.140, "COMPACT CYLINDER
 *   WITH INTEGRATED VALVE, SERIES CCIV". Utgåva Cod. 9910204 - IM37 - 09/2026,
 *   hämtad från media.metalwork.it/media/catalogues/catalogue-eng/catalogue.pdf.
 *     - tekniska data   sida A1.136 (PDF-sida 150)
 *     - KEY TO CODES    sida A1.140 (PDF-sida 154)
 *
 * DEN HÄR FAMILJEN STOD SOM BLOCKERAD med motiveringen att "cylinderns egen
 * beställtabell inte finns i den inlästa texten". Den fanns. Jag hade läst
 * `left(content, 700)` av de sex stycken som nämner CCIV, sett
 * fixeringsalternativ och reservdelar, och dragit slutsatsen att nyckeln
 * saknades. Den låg 3 000 tecken in i stycke 49.
 *
 * FJORTON TECKEN, NIO POSITIONER:
 *
 *   23  0  0  32  0050  C  P  2  2
 *   └┬┘ │  │  └┬┘ └─┬┘  │  │  │  └─ pneumatisk anslutning
 *  typ  │  │ borr  slag │  │  └──── elektrisk anslutning
 *       │  │            │  └─────── tätningar
 *       │  └─ magnet    └────────── kolvstångsmaterial
 *       └──── verkningssätt
 *
 * Positionerna tre och fyra har INGEN egen rubrik i katalogens tabell -- bara
 * värdelistor ("0 Double-acting", "0 Magnetic / S Non-magnetic / G No
 * stick-slip"). Att läsa dem rätt krävde sidan som bild; textutvinningen
 * lägger kolumnerna i en ordning som inte är tabellens.
 *
 * TRE FOTNOTER SOM ÄR RIKTIGA BEGRÄNSNINGAR:
 *   ■  Endast för Ø32 och Ø40  -- gäller typ 25, 26 och material C
 *   ▲  Rostfri kolvstång       -- gäller borrning 20 och 25
 *   ◆  Standard för Ø20 och 25 -- gäller magnet G
 *
 * De två första är förbud; den tredje är ett STANDARDVAL, inte ett förbud.
 * Katalogen skriver "Standard for", inte "Only for", och jag tolkar inte om
 * den. Se `CCIV_DEFAULT_MAGNET`.
 *
 * VÅRA TVÅ PRODUKTRADER ÄR FAMILJERADER: MW-CCIV-20 och MW-CCIV-32 saknar
 * slaglängd, som är obligatorisk i nyckeln. Samma sak som EGC-FA och ELEKTRO.
 */

export const CCIV_SOURCE = {
  file: "Metal_Work_General_Catalogue.pdf",
  edition: "Cod. 9910204 - IM37 - 09/2026",
  title: "Metal Work Compact Cylinder with Integrated Valve, Series CCIV",
  brand: "Metal Work",
  section: "A1.136–A1.140",
} as const;

export interface CcivValue {
  code: string;
  label_sv: string;
}

// ── Position 1-2: typ ───────────────────────────────────────────────────────

export interface CcivType extends CcivValue {
  /** Katalogens ■: bara Ø32 och Ø40. */
  only_large_bores: boolean;
}

/**
 * Typkoden anger CENTRUMAVSTÅND och kolvstångsgänga, inte något annat.
 *
 * UNITOP är Metal Works eget mönster, ISO det standardiserade. Male/female
 * syftar på kolvstångens gänga.
 */
export const CCIV_TYPES: CcivType[] = [
  { code: "23", label_sv: "UNITOP-centrumavstånd, hangängad kolvstång", only_large_bores: false },
  { code: "24", label_sv: "UNITOP-centrumavstånd, hongängad kolvstång", only_large_bores: false },
  { code: "25", label_sv: "ISO-centrumavstånd, hangängad kolvstång", only_large_bores: true },
  { code: "26", label_sv: "ISO-centrumavstånd, hongängad kolvstång", only_large_bores: true },
];

// ── Position 3: verkningssätt ───────────────────────────────────────────────

/**
 * Katalogen listar ETT värde. Positionen finns ändå, och den måste skrivas ut.
 *
 * Att en position bara har ett val betyder inte att den kan utelämnas -- koden
 * är positionell, och ett tecken för lite gör den obeställbar.
 */
export const CCIV_ACTIONS: CcivValue[] = [
  { code: "0", label_sv: "Dubbelverkande" },
];

// ── Position 4: magnet ──────────────────────────────────────────────────────

export const CCIV_MAGNETS: CcivValue[] = [
  { code: "0", label_sv: "Magnetisk kolv" },
  { code: "S", label_sv: "Omagnetisk kolv" },
  { code: "G", label_sv: "Utan stick-slip" },
];

/**
 * Katalogens ◆: G är STANDARD för Ø20 och Ø25.
 *
 * Ett standardval, inte ett förbud. Noten i tekniska data förklarar varför:
 * "For speeds lower than 0.2 m/s to prevent surging, use the version No
 * stick-slip and non-lubricated air."
 */
export const CCIV_DEFAULT_MAGNET: Record<string, string> = {
  "20": "G", "25": "G", "32": "0", "40": "0",
};

// ── Position 5-6: borrning ──────────────────────────────────────────────────

export interface CcivBore {
  code: string;
  bore_mm: number;
  /** Katalogens ▲: Ø20 och Ø25 har alltid rostfri kolvstång. */
  stainless_rod_only: boolean;
  /** "Standard strokes", mm (sida A1.136). */
  stroke_standard_max_mm: number;
  /** "Maximum recommended strokes", mm. Står även i nyckelns borrkolumn. */
  stroke_max_mm: number;
  /** Egenvikt vid 0 mm slag, gram. */
  weight_base_g: number;
  /** Tillkommande vikt per mm slag, gram. */
  weight_per_mm_g: number;
  /** Största hastighet vid 6 bar, ut/in, m/s. */
  speed_out_ms: number;
  speed_in_ms: number;
  /** Tillslagstryck, bar. */
  inrush_bar: number;
}

/**
 * De fyra borrningarna.
 *
 * ETT OBEROENDE KRYSS: taket för slaglängden står på TVÅ ställen i katalogen,
 * i två olika tabeller på två olika sidor -- i nyckelns borrkolumn
 * ("Ø 20 - 25: max 200 mm, Ø 32 - 40: max 300 mm") och i tekniska data
 * ("Maximum recommended strokes 200 200 300 300"). De stämmer överens, och
 * det är den kontrollen som säger att jag läst kolumnerna rätt.
 */
export const CCIV_BORES: CcivBore[] = [
  { code: "20", bore_mm: 20, stainless_rod_only: true, stroke_standard_max_mm: 50, stroke_max_mm: 200, weight_base_g: 220, weight_per_mm_g: 2.35, speed_out_ms: 1.4, speed_in_ms: 1.2, inrush_bar: 0.6 },
  { code: "25", bore_mm: 25, stainless_rod_only: true, stroke_standard_max_mm: 50, stroke_max_mm: 200, weight_base_g: 250, weight_per_mm_g: 2.73, speed_out_ms: 1.0, speed_in_ms: 0.8, inrush_bar: 0.6 },
  { code: "32", bore_mm: 32, stainless_rod_only: false, stroke_standard_max_mm: 80, stroke_max_mm: 300, weight_base_g: 295, weight_per_mm_g: 3.17, speed_out_ms: 0.6, speed_in_ms: 0.5, inrush_bar: 0.6 },
  { code: "40", bore_mm: 40, stainless_rod_only: false, stroke_standard_max_mm: 80, stroke_max_mm: 300, weight_base_g: 420, weight_per_mm_g: 4.41, speed_out_ms: 0.4, speed_in_ms: 0.4, inrush_bar: 0.4 },
];

/** Minsta slag, mm. Katalogen: "Standard strokes from 5 to …". */
export const CCIV_STROKE_MIN_MM = 5;

// ── Position 11: kolvstångsmaterial ─────────────────────────────────────────

export interface CcivMaterial extends CcivValue {
  only_large_bores: boolean;
}

export const CCIV_MATERIALS: CcivMaterial[] = [
  { code: "C", label_sv: "Kolvstång i hårdförkromat C45", only_large_bores: true },
  { code: "X", label_sv: "Kolvstång och mutter i rostfritt", only_large_bores: false },
];

// ── Position 12: tätningar ──────────────────────────────────────────────────

export const CCIV_GASKETS: CcivValue[] = [
  { code: "P", label_sv: "Polyuretantätningar" },
];

// ── Position 13: elektrisk anslutning ───────────────────────────────────────

export interface CcivConnection extends CcivValue {
  /** Kapslingsklassen följer av kontakten (sida A1.136). */
  ip: string;
}

export const CCIV_CONNECTIONS: CcivConnection[] = [
  { code: "2", label_sv: "Plug-in-kontakt", ip: "IP51" },
  { code: "M", label_sv: "M8-kontakt", ip: "IP65" },
];

// ── Position 14: pneumatisk anslutning ──────────────────────────────────────

export const CCIV_FITTINGS: CcivValue[] = [
  { code: "1", label_sv: "M7-gängade portar" },
  { code: "2", label_sv: "Insticksanslutning Ø4 och ljuddämpare" },
  { code: "3", label_sv: "Insticksanslutning Ø4 och dämpade utloppsstryp" },
  { code: "4", label_sv: "Insticksanslutning Ø6 och ljuddämpare" },
  { code: "5", label_sv: "Insticksanslutning Ø6 och dämpade utloppsstryp" },
];

/** Gemensamma gränser ur sida A1.136. */
export const CCIV_LIMITS = {
  pressure_min_bar: 3,
  pressure_max_bar: 7,
  temp_min_c: -10,
  temp_max_c: 50,
  voltage: "24 VDC ±10 %",
  power_w: 0.9,
  duty: "100 % ED",
  insulation_class: "F155",
  air_quality: "ISO 8573-1 klass 4-7-3",
  /** Under den här hastigheten rekommenderar katalogen no-stick-slip. */
  stick_slip_speed_ms: 0.2,
  code_length: 14,
} as const;

/**
 * Konfiguratorns mall.
 *
 * VERKNINGSSÄTT OCH TÄTNINGAR STÅR SOM FASTA TECKEN, inte som platshållare.
 * Katalogen har ett enda värde på var och en -- "0 Double-acting" och
 * "P Polyurethane gaskets" -- så de erbjuds inte som val. En rullgardin med
 * ett alternativ är brus.
 *
 * Men de MÅSTE stå i koden: den är positionell, och ett tecken för lite gör
 * den obeställbar. Skrevs de som `{action}` och `{gaskets}` utan motsvarande
 * parameter skulle mallmotorn ersätta dem med tomt och producera tretton
 * tecken i stället för fjorton. Det är precis den sortens tysta bortfall som
 * DSBC:s gamla mall gjorde med korrosionsskydd och ATEX.
 */
export const CCIV_ORDER_CODE_TEMPLATE =
  "{type}0{magnet}{bore}{stroke_mm#4}{material}P{connection}{fittings}";

// ── Bygg och läs ────────────────────────────────────────────────────────────

export interface CcivConfig {
  type: string;
  magnet: string;
  bore: string;
  stroke_mm: number;
  material: string;
  connection: string;
  fittings: string;
  /** Katalogen har ett enda värde på varje. Går att utelämna. */
  action?: string;
  gaskets?: string;
}

/**
 * Bygger ett CCIV-artikelnummer. Null när något inte är beställbart.
 *
 * De två fotnotsförbuden kontrolleras här: ISO-typerna 25/26 och materialet C
 * finns bara för Ø32 och Ø40. En Ø20 i C45 går alltså inte att beställa, hur
 * rimlig den än ser ut i en rullgardin.
 */
export function ccivBuildCode(c: CcivConfig): string | null {
  const t = CCIV_TYPES.find((x) => x.code === c.type);
  const b = CCIV_BORES.find((x) => x.code === c.bore);
  const m = CCIV_MATERIALS.find((x) => x.code === c.material);
  if (!t || !b || !m) return null;
  if (!CCIV_MAGNETS.some((x) => x.code === c.magnet)) return null;
  if (!CCIV_CONNECTIONS.some((x) => x.code === c.connection)) return null;
  if (!CCIV_FITTINGS.some((x) => x.code === c.fittings)) return null;

  const action = c.action ?? CCIV_ACTIONS[0].code;
  const gaskets = c.gaskets ?? CCIV_GASKETS[0].code;
  if (!CCIV_ACTIONS.some((x) => x.code === action)) return null;
  if (!CCIV_GASKETS.some((x) => x.code === gaskets)) return null;

  // Katalogens ■: bara de stora borrningarna.
  const stor = b.bore_mm >= 32;
  if (t.only_large_bores && !stor) return null;
  if (m.only_large_bores && !stor) return null;
  // Katalogens ▲: Ø20 och Ø25 har rostfri kolvstång, alltså material X.
  if (b.stainless_rod_only && m.code !== "X") return null;

  if (!Number.isInteger(c.stroke_mm)) return null;
  if (c.stroke_mm < CCIV_STROKE_MIN_MM || c.stroke_mm > b.stroke_max_mm) return null;

  return t.code + action + c.magnet + b.code +
    String(c.stroke_mm).padStart(4, "0") + m.code + gaskets + c.connection + c.fittings;
}

export interface CcivReading {
  type: string;
  action: string;
  magnet: string;
  bore: string;
  bore_mm: number;
  stroke_mm: number;
  material: string;
  gaskets: string;
  connection: string;
  fittings: string;
  ip: string;
}

/** Läser ett CCIV-artikelnummer. */
export function ccivParseCode(raw: string): CcivReading | null {
  const k = raw.trim().toUpperCase();
  if (k.length !== CCIV_LIMITS.code_length) return null;

  const type = k.slice(0, 2);
  const t = CCIV_TYPES.find((x) => x.code === type);
  if (!t) return null;

  const action = k[2];
  if (!CCIV_ACTIONS.some((x) => x.code === action)) return null;

  const magnet = k[3];
  if (!CCIV_MAGNETS.some((x) => x.code === magnet)) return null;

  const bore = k.slice(4, 6);
  const b = CCIV_BORES.find((x) => x.code === bore);
  if (!b) return null;

  const slag = k.slice(6, 10);
  if (!/^\d{4}$/.test(slag)) return null;
  const stroke_mm = Number(slag);
  if (stroke_mm < CCIV_STROKE_MIN_MM || stroke_mm > b.stroke_max_mm) return null;

  const material = k[10];
  const m = CCIV_MATERIALS.find((x) => x.code === material);
  if (!m) return null;

  const gaskets = k[11];
  if (!CCIV_GASKETS.some((x) => x.code === gaskets)) return null;

  const connection = k[12];
  const conn = CCIV_CONNECTIONS.find((x) => x.code === connection);
  if (!conn) return null;

  const fittings = k[13];
  if (!CCIV_FITTINGS.some((x) => x.code === fittings)) return null;

  // Samma två förbud som vid byggandet -- en kod som bryter mot dem finns inte.
  const stor = b.bore_mm >= 32;
  if (t.only_large_bores && !stor) return null;
  if (m.only_large_bores && !stor) return null;
  if (b.stainless_rod_only && material !== "X") return null;

  return {
    type, action, magnet, bore, bore_mm: b.bore_mm, stroke_mm,
    material, gaskets, connection, fittings, ip: conn.ip,
  };
}

/**
 * Cylinderns vikt, gram.
 *
 * Katalogen ger den som en bas plus ett tillägg per millimeter slag
 * ("Weights: stroke = 0 [g] … each mm stroke [g] …"). Formeln står inte
 * utskriven men tabellens två rader betyder ingenting annat.
 */
export function ccivWeightG(bore: string, strokeMm: number): number | null {
  const b = CCIV_BORES.find((x) => x.code === bore);
  if (!b) return null;
  return Math.round((b.weight_base_g + strokeMm * b.weight_per_mm_g) * 10) / 10;
}

/**
 * Teoretisk tryckkraft vid ett givet tryck, newton.
 *
 * RÄKNAD, inte avskriven: katalogens CCIV-sida hänvisar till kapitlets
 * allmänna tabell i stället för att trycka egna siffror ("Forces generated at
 * 6 bar thrust/retraction: See cylinder General technical data"). Kraften är
 * kolvarean gånger trycket, och den geometrin är densamma för varje cylinder.
 *
 * Dragkraften kräver kolvstångens diameter, som inte står på de här sidorna,
 * och beräknas därför inte. Att gissa den vore att uppfinna en siffra.
 */
export function ccivThrustForceN(bore: string, pressureBar: number): number | null {
  const b = CCIV_BORES.find((x) => x.code === bore);
  if (!b) return null;
  if (pressureBar < CCIV_LIMITS.pressure_min_bar || pressureBar > CCIV_LIMITS.pressure_max_bar) {
    return null;
  }
  const area_m2 = Math.PI / 4 * (b.bore_mm / 1000) ** 2;
  return Math.round(area_m2 * pressureBar * 1e5 * 10) / 10;
}

/** Kapslingsklassen som följer av den elektriska anslutningen. */
export function ccivIpRating(connection: string): string | null {
  return CCIV_CONNECTIONS.find((c) => c.code === connection)?.ip ?? null;
}

/** Typkoder som går att beställa för en borrning. */
export function ccivTypesForBore(bore: string): string[] {
  const b = CCIV_BORES.find((x) => x.code === bore);
  if (!b) return [];
  return CCIV_TYPES.filter((t) => !t.only_large_bores || b.bore_mm >= 32).map((t) => t.code);
}

/** Materialkoder som går att beställa för en borrning. */
export function ccivMaterialsForBore(bore: string): string[] {
  const b = CCIV_BORES.find((x) => x.code === bore);
  if (!b) return [];
  if (b.stainless_rod_only) return ["X"];
  return CCIV_MATERIALS.filter((m) => !m.only_large_bores || b.bore_mm >= 32).map((m) => m.code);
}

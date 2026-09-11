/**
 * Parker P5T — styrd cylinder, beställnyckel ur katalogen.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Parker Hannifin, Pneumatic Division, "Guided Pneumatic Cylinders",
 *   katalog 0900P-7, avsnitt E. Dokumentet ligger i knowledge_chunks som
 *   source_file = '0900P_Guided.pdf'. Beställnyckeln står i chunk 6-8.
 *
 * Katalogens eget exempel (chunk 6):
 *
 *   P5T – J 032 D H S N 100
 *   └┬┘   │ └┬┘ │ │ │ │ └┬┘
 *  serie  │ borr│ │ │ │  slag
 *      lager   │ │ │ optioner
 *          portläge│ tätning
 *              portgänga
 *
 * ETT LITET MEN VERKLIGT AVSTEG. Våra sju artiklar heter "P5T-J016DHS-N025" --
 * med ett EXTRA bindestreck före optionspositionen. Katalogen har bara ett
 * bindestreck, efter serienamnet: "P5T-J032DHSN100". Allt annat stämmer, så
 * raderna är inte påhittade som KPZ:s var; de har bara ett tecken för mycket.
 * parseP5tCode() läser därför båda formerna, medan buildP5tCode() alltid
 * skriver katalogens.
 */

export const P5T_SERIE = "P5T";

export const P5T_SOURCE = {
  file: "0900P_Guided.pdf",
  edition: "0900P-7",
  title: "Parker Guided Pneumatic Cylinders, P5T Series",
  brand: "Parker",
} as const;

export interface P5tValue { code: string; label_sv: string }

/** Position 2 — Shaft / Bearing Type. */
export const P5T_BEARINGS: P5tValue[] = [
  { code: "J", label_sv: "Glidlager, hårdförkromad axel (standard)" },
  { code: "H", label_sv: "Kullager, rostfri axel" },
  { code: "C", label_sv: "Glidlager, rostfri axel" },
];

/** Position 3 — Bore Size. Nio borrningar (chunk 7). */
export const P5T_BORES = [16, 20, 25, 32, 40, 50, 63, 80, 100];

/** Position 4 — Port Location / Mounting. */
export const P5T_PORT_LOCATIONS: P5tValue[] = [
  { code: "D", label_sv: "Styrhål, portar upptill (standard)" },
  { code: "R", label_sv: "Styrhål, portar bak, topp pluggad" },
  { code: "S", label_sv: "Styrhål, portar på sidan och upptill" },
];

/** Position 5 — Port Style. */
export const P5T_PORT_STYLES: P5tValue[] = [
  { code: "H", label_sv: "NPTF (standard)" },
  { code: "G", label_sv: "BSPP" },
];

/** Position 6 — Seals. */
export const P5T_SEALS: P5tValue[] = [
  { code: "S", label_sv: "Nitril (standard)" },
  { code: "F", label_sv: "Fluorkarbon, hög temperatur" },
];

/** Position 7 — Options. */
export const P5T_OPTIONS: P5tValue[] = [
  { code: "N", label_sv: "Inga (standard)" },
  { code: "B", label_sv: "Höglastlager" },
  { code: "A", label_sv: "Stötdämpare, justerbara stoppkragar och dubbel verktygsplatta" },
  { code: "E", label_sv: "Stötdämpare och justerbara stoppkragar" },
  { code: "G", label_sv: "Höglastlager, stötdämpare och justerbara stoppkragar" },
  { code: "D", label_sv: "Dubbel verktygsplatta" },
  { code: "X", label_sv: "Special" },
];

/**
 * Slaglängd. Katalogen: "Strokes 10 to 400mm depending on model" (chunk 8).
 * Databasen sa 5-400; undre gränsen var alltså fel.
 */
export const P5T_STROKE = { min: 10, max: 400, unit: "mm" } as const;

/**
 * Standardslaglängderna, kolumnrubrikerna i tabellen (chunk 8).
 *
 * VILKA som gäller per borrning är markerat med punkter i katalogen, och
 * punkterna överlever inte textutvinningen tillförlitligt -- jag räknade dem
 * och fick en fördelning som inte går ihop med att någon borrning når 400 mm,
 * vilket features-texten säger att någon gör. Listan är därför unionen, och
 * per-borrning-tabellen är inte modellerad. Att räkna prickar i en förstörd
 * tabell är att gissa med extra steg.
 */
export const P5T_STANDARD_STROKES = [10, 25, 40, 50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400];

export interface P5tReading {
  bearing: string;
  bore_mm: number;
  port_location: string;
  port_style: string;
  seals: string;
  options: string;
  stroke_mm: number;
  /** Sant när koden skrevs med vårt extra bindestreck före optionerna. */
  legacy_hyphen: boolean;
}

/** Bygger en P5T-kod i katalogens form. */
export function buildP5tCode(c: {
  bearing?: string; bore_mm: number; port_location?: string;
  port_style?: string; seals?: string; options?: string; stroke_mm: number;
}): string | null {
  if (!P5T_BORES.includes(c.bore_mm)) return null;
  if (!Number.isInteger(c.stroke_mm) || c.stroke_mm < P5T_STROKE.min || c.stroke_mm > P5T_STROKE.max) {
    return null;
  }
  const finns = (l: P5tValue[], k: string) => l.some((x) => x.code === k);
  const b = c.bearing ?? "J";
  const pl = c.port_location ?? "D";
  const ps = c.port_style ?? "H";
  const se = c.seals ?? "S";
  const op = c.options ?? "N";
  if (!finns(P5T_BEARINGS, b) || !finns(P5T_PORT_LOCATIONS, pl)) return null;
  if (!finns(P5T_PORT_STYLES, ps) || !finns(P5T_SEALS, se) || !finns(P5T_OPTIONS, op)) return null;

  return `${P5T_SERIE}-${b}${String(c.bore_mm).padStart(3, "0")}${pl}${ps}${se}${op}${String(c.stroke_mm).padStart(3, "0")}`;
}

/**
 * Läser en P5T-kod. Accepterar både katalogens form och vår med ett extra
 * bindestreck före optionspositionen.
 */
export function parseP5tCode(raw: string): P5tReading | null {
  const s = raw.trim().toUpperCase();
  const m = /^P5T-([JHC])(\d{3})([DRS])([HG])([SF])(-?)([NBAEGDX])(\d{3})$/.exec(s);
  if (!m) return null;
  const bore_mm = Number(m[2]);
  const stroke_mm = Number(m[8]);
  if (!P5T_BORES.includes(bore_mm)) return null;
  if (stroke_mm < P5T_STROKE.min || stroke_mm > P5T_STROKE.max) return null;
  return {
    bearing: m[1], bore_mm, port_location: m[3], port_style: m[4],
    seals: m[5], legacy_hyphen: m[6] === "-", options: m[7], stroke_mm,
  };
}

/**
 * Norgren LINTRA Plus — kolvstångslös cylinder, beställnyckel ur katalogen.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Norgren / IMI, "LINTRA Plus rodless cylinders", dokument 8.200.350.03
 *   (02/21). Ligger i knowledge_chunks som
 *   source_file = '09_Lintra Plus Rodless cylinders.pdf'. Beställnyckeln och
 *   tillgänglighetstabellen står i chunk 1-2, optionerna i chunk 4.
 *
 * FORMEN:
 *
 *   M / 146 0 32 / M / 3000
 *   │    └─┬─┘ │ └┬┘   └─┬─┘
 *   │     146  │  │      slaglängd
 *   │      │   │  magnetkolv
 *   │      │   borrning (två siffror)
 *   │      styrningstyp: 0 intern, 1 extern, 2 precisionsrulle
 *   måttsystem: M = millimeter, C = tum
 *
 * DEN TREDJE FAMILJEN I RAD DÄR PRODUKTRADERNA ÄR RÄTT. Revisionen flaggade
 * lintra-plus som "noll av sju hittade i katalogen", men katalogen trycker
 * mönstret "M/146016/M/*" med en asterisk där slaglängden ska stå -- det finns
 * alltså inga fullständiga artikelnummer att slå upp emot. Våra sju följer
 * mönstret exakt, inklusive den som heter "External-Guide" och mycket riktigt
 * har en etta på styrningspositionen (M/146125/M/500).
 *
 * Fel var konfiguratorn: mallen "146{series_code}/{bore_mm}/{stroke_mm}/M"
 * producerar "146146000/16/200/M".
 */

export const LINTRA_SOURCE = {
  file: "09 Lintra Plus Rodless cylinders.pdf",
  edition: "8.200.350.03 (02/21)",
  title: "Norgren LINTRA Plus rodless cylinders",
  brand: "Norgren",
} as const;

export interface LintraGuide {
  /** Siffran på styrningspositionen. */
  code: string;
  label_sv: string;
  /** Borrningar styrningen finns för (chunk 1-2). */
  bores: number[];
}

/**
 * Styrningstyperna och vilka borrningar de finns i.
 *
 * Precisionsrullstyrningen saknas för Ø16, Ø20 och Ø80 -- katalogens tabell
 * skriver "–" i de rutorna.
 */
export const LINTRA_GUIDES: LintraGuide[] = [
  { code: "0", label_sv: "Intern styrning", bores: [16, 20, 25, 32, 40, 50, 63, 80] },
  { code: "1", label_sv: "Extern styrning", bores: [16, 20, 25, 32, 40, 50, 63, 80] },
  { code: "2", label_sv: "Precisionsrullstyrning", bores: [25, 32, 40, 50, 63] },
];

export interface LintraBore {
  bore_mm: number;
  /** Anslutning enligt tabellen i chunk 1-2. */
  port: string;
  /** Största slaglängd, mm (chunk 1). */
  stroke_max_mm: number;
}

/**
 * Borrningarna med sin anslutning och sitt slagtak.
 *
 * Slagtaket är BORRNINGSBEROENDE, vilket databasen inte visste: den hade ett
 * enda maxvärde på 8500 mm för alla. Ø80 går bara till 5500.
 */
export const LINTRA_BORES: LintraBore[] = [
  { bore_mm: 16, port: "M5", stroke_max_mm: 8500 },
  { bore_mm: 20, port: "G 1/8", stroke_max_mm: 8500 },
  { bore_mm: 25, port: "G 1/8", stroke_max_mm: 8500 },
  { bore_mm: 32, port: "G 1/4", stroke_max_mm: 8500 },
  { bore_mm: 40, port: "G 1/4", stroke_max_mm: 8500 },
  { bore_mm: 50, port: "G 3/8", stroke_max_mm: 8000 },
  { bore_mm: 63, port: "G 1/2", stroke_max_mm: 8000 },
  { bore_mm: 80, port: "G 1/2", stroke_max_mm: 5500 },
];

/** Temperaturområde ur chunk 1. */
export const LINTRA_LIMITS = { temp_min_c: -30, temp_max_c: 80 } as const;

/**
 * Tillvalen ur chunk 4.
 *
 * De modelleras som LÄSBARA men inte valbara: katalogen skriver dem som
 * tillägg efter magnetkolvspositionen, och exakt hur de fogas in i koden
 * framgår inte av den inlästa texten. Katalogens eget exempel är
 * "C/146032/MC/120", där optionsfältet står som "MC" -- alltså magnetkolv plus
 * något mer, men sambandet mellan "MC" och listans "MC1" går inte att avgöra.
 */
export const LINTRA_OPTIONS: Array<{ code: string; label_sv: string; bores?: number[] }> = [
  { code: "M", label_sv: "Magnetkolv (standard på Ø16, Ø20 och Ø80)" },
  { code: "MC1", label_sv: "Alternativa anslutningar", bores: [25, 32, 40, 50, 63] },
  { code: "L3", label_sv: "Aktiv broms", bores: [25, 32, 40, 50, 63] },
  { code: "L4", label_sv: "Passiv broms", bores: [25, 32, 40, 50, 63] },
  { code: "F1", label_sv: "Linjär lägesgivare", bores: [32, 40, 50, 63] },
  { code: "MD", label_sv: "Dubbla vagnar (endast extern styrning och rullstyrning)" },
];

export interface LintraReading {
  /** M = millimeter, C = tum. */
  units: string;
  guide: string;
  bore_mm: number;
  options: string;
  stroke: number;
  port: string;
}

/** Bygger en LINTRA Plus-kod i metrisk form. */
export function buildLintraCode(c: {
  guide?: string; bore_mm: number; stroke_mm: number; options?: string;
}): string | null {
  const g = LINTRA_GUIDES.find((x) => x.code === (c.guide ?? "0"));
  const b = LINTRA_BORES.find((x) => x.bore_mm === c.bore_mm);
  if (!g || !b) return null;
  if (!g.bores.includes(c.bore_mm)) return null;
  if (!Number.isInteger(c.stroke_mm) || c.stroke_mm < 1 || c.stroke_mm > b.stroke_max_mm) return null;
  return `M/146${g.code}${String(c.bore_mm).padStart(2, "0")}/${c.options ?? "M"}/${c.stroke_mm}`;
}

/** Läser en LINTRA Plus-kod. Null när formen inte stämmer. */
export function parseLintraCode(raw: string): LintraReading | null {
  const m = /^([MC])\/146([012])(\d{2})\/([A-Z0-9]+)\/(\d+)$/.exec(raw.trim().toUpperCase());
  if (!m) return null;
  const bore_mm = Number(m[3]);
  const b = LINTRA_BORES.find((x) => x.bore_mm === bore_mm);
  const g = LINTRA_GUIDES.find((x) => x.code === m[2]);
  if (!b || !g || !g.bores.includes(bore_mm)) return null;
  const stroke = Number(m[5]);
  // Taket gäller millimeterversionen. Tumversionen anger slaget i tum, och
  // den omräkningen modelleras inte här.
  if (m[1] === "M" && (stroke < 1 || stroke > b.stroke_max_mm)) return null;
  return { units: m[1], guide: m[2], bore_mm, options: m[4], stroke, port: b.port };
}

/** Största slaglängd för en borrning, mm. */
export function lintraMaxStroke(bore_mm: number): number | null {
  return LINTRA_BORES.find((b) => b.bore_mm === bore_mm)?.stroke_max_mm ?? null;
}

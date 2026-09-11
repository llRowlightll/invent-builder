/**
 * Parker OSP-P — kolvstångslös bandcylinder, beställnyckel ur katalogen.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Parker Hannifin, Pneumatic Division, "Rodless Pneumatic Cylinders",
 *   katalog 0900P-7, avsnitt G. Dokumentet ligger i knowledge_chunks som
 *   source_file = '0900P_Rodless.pdf'. Beställnyckeln står i chunk 22-26,
 *   tekniska data i chunk 8 och 20-21.
 *
 * TREDJE FAMILJEN, och en tredje sorts nyckel:
 *   DSBC  — avgränsad typkod, ovalda positioner utelämnas
 *   P1D   — positionell typkod, 15 eller 20 tecken
 *   KPZ   — ingen kod alls, uppslag i en tabell
 *   OSP-P — positionell kod med FAST längd: exakt 25 tecken, alltid
 *
 * Katalogen trycker positionslistan "1-4 5-6 7 8 9 10 11 12-16 17 18 19 20 21
 * 22 23 24 25" och ett exempel (chunk 24):
 *
 *   OSPP 25 0 1 0 0 0 01 100 0 0 0 0 0 0 1 0 0
 *   └─┬┘ └┬┘ └───┬───┘ └──┬──┘ └──────┬──────┘
 *    1-4 5-6   7-11     12-16        17-25
 *    serie borr optioner  slag        optioner
 *
 * VAD SOM INTE GÅR ATT UTLÄSA. Katalogen listar sexton optionsfält -- Piston
 * Style, Seals, Lubrication, Hardware, Piston Mounting, Additional Carriages,
 * Dovetail Cover, Endcap Mounting, Switches, Guides/Brakes, Version, Endcap
 * Position, Porting Configurations, Cushioning & Stops med flera -- men
 * textutvinningen har lagt fältnamnen i en annan ordning än kolumnerna, så
 * VILKET fält som sitter på vilken position går inte att avgöra ur den inlästa
 * texten.
 *
 * Därför modelleras bara det som är verifierat: seriens fyra tecken,
 * borrningen, slaglängden och kodens längd. Varje optionsfält har ett
 * "0 = standard/ingen" i katalogen, så en standardcylinder kan byggas med
 * nollor rakt igenom. Det är sant och beställbart. Att gissa mappningen vore
 * precis det fel P1D:s position 10 redan gjort en gång i det här projektet.
 */

export const OSPP_SERIE = "OSPP";

export const OSPP_SOURCE = {
  file: "0900P_Rodless.pdf",
  edition: "0900P-7",
  title: "Parker Rodless Pneumatic Cylinders, OSP-P Series",
  brand: "Parker",
} as const;

/** Kodens längd. Katalogen tillåter ingen annan. */
export const OSPP_CODE_LENGTH = 25;

export interface OsppBore {
  bore_mm: number;
  /** Positionerna 5-6, alltid två tecken. */
  code: string;
  /** Egenvikt vid 0 mm slag, kg (chunk 20). */
  weight_base_kg: number;
  /** Tillkommande vikt per 100 mm slag, kg (chunk 20). */
  weight_per_100mm_kg: number;
}

/**
 * Katalogens åtta borrningar (chunk 24: "Bore 10 16 25 32 40 50 63 80").
 *
 * Databasen listade 16, 20, 25, 32, 40, 50, 63, 80 -- alltså SAKNADES Ø10
 * medan Ø20 var påhittad. OSP-P har ingen Ø20.
 */
export const OSPP_BORES: OsppBore[] = [
  { bore_mm: 10, code: "10", weight_base_kg: 0.087, weight_per_100mm_kg: 0.052 },
  { bore_mm: 16, code: "16", weight_base_kg: 0.22, weight_per_100mm_kg: 0.1 },
  { bore_mm: 25, code: "25", weight_base_kg: 0.65, weight_per_100mm_kg: 0.197 },
  { bore_mm: 32, code: "32", weight_base_kg: 1.44, weight_per_100mm_kg: 0.354 },
  { bore_mm: 40, code: "40", weight_base_kg: 1.95, weight_per_100mm_kg: 0.415 },
  { bore_mm: 50, code: "50", weight_base_kg: 3.53, weight_per_100mm_kg: 0.566 },
  { bore_mm: 63, code: "63", weight_base_kg: 6.41, weight_per_100mm_kg: 0.925 },
  { bore_mm: 80, code: "80", weight_base_kg: 12.46, weight_per_100mm_kg: 1.262 },
];

/**
 * Slaglängd, positionerna 12-16: "5 digits in whole millimeters
 * (ex. 1100mm = 01 100)".
 *
 * Intervallet 1-5500 står i egenskapstabellen per borrning (chunk 8) och
 * gäller alla åtta. Specifikationsrutan (chunk 20) sammanfattar det som
 * "Stroke length 5.5m, Minimum 5mm" -- de två går isär i undre änden, och
 * tabellen per borrning får gälla eftersom den är den detaljerade. Längre slag
 * finns "upon request" och ligger utanför nyckeln.
 *
 * Databasen sa 100-14000 mm. Maxvärdet var alltså 2,5 gånger för högt.
 */
export const OSPP_STROKE = { min: 1, max: 5500, unit: "mm" } as const;

/** Tekniska data ur chunk 8 och 21, gemensamma för alla borrningar. */
export const OSPP_LIMITS = {
  pressure_max_bar: 8,
  temp_min_c: -10,
  temp_max_c: 80,
} as const;

/**
 * Antalet optionstecken före respektive efter slaglängden.
 * Positionerna 7-11 är fem, positionerna 17-25 är nio.
 */
export const OSPP_OPTIONS_BEFORE = 5;
export const OSPP_OPTIONS_AFTER = 9;

/**
 * Bygger en standardkod: varje optionsposition satt till "0".
 *
 * Alla optionsfält i katalogen har ett nolläge ("0 Standard", "0 None"), så
 * nollor rakt igenom är en riktig, beställbar standardcylinder.
 */
export function buildOsppCode(bore_mm: number, stroke_mm: number): string | null {
  const b = OSPP_BORES.find((x) => x.bore_mm === bore_mm);
  if (!b) return null;
  if (!Number.isInteger(stroke_mm) || stroke_mm < OSPP_STROKE.min || stroke_mm > OSPP_STROKE.max) {
    return null;
  }
  return (
    OSPP_SERIE +
    b.code +
    "0".repeat(OSPP_OPTIONS_BEFORE) +
    String(stroke_mm).padStart(5, "0") +
    "0".repeat(OSPP_OPTIONS_AFTER)
  );
}

export interface OsppReading {
  bore_mm: number;
  stroke_mm: number;
  /** Optionstecknen positionerna 7-11, som de stod i koden. */
  options_before: string;
  /** Optionstecknen positionerna 17-25. */
  options_after: string;
  /** Sant när varje optionsposition är "0". */
  is_standard: boolean;
}

/**
 * Läser en OSP-P-kod. Returnerar null när formen inte stämmer.
 *
 * Kräver exakt 25 tecken. Våra egna produktrader var 22 -- de hade alltså
 * varken rätt längd eller rätt slagkodning, och motsade dessutom sina egna
 * namn: OSPP160000001000000000 bär "01000" på slagpositionerna, alltså
 * 1000 mm, medan raden hette "Ø16 100mm".
 */
export function parseOsppCode(raw: string): OsppReading | null {
  const s = raw.trim().toUpperCase();
  if (s.length !== OSPP_CODE_LENGTH) return null;
  const m = /^OSPP(\d{2})([0-9A-Z]{5})(\d{5})([0-9A-Z]{9})$/.exec(s);
  if (!m) return null;

  const b = OSPP_BORES.find((x) => x.code === m[1]);
  const stroke_mm = Number(m[3]);
  if (!b) return null;
  if (stroke_mm < OSPP_STROKE.min || stroke_mm > OSPP_STROKE.max) return null;

  return {
    bore_mm: b.bore_mm,
    stroke_mm,
    options_before: m[2],
    options_after: m[4],
    is_standard: /^0+$/.test(m[2]) && /^0+$/.test(m[4]),
  };
}

/** Egenvikt för en given borrning och slaglängd, kg (chunk 20). */
export function osppWeightKg(bore_mm: number, stroke_mm: number): number | null {
  const b = OSPP_BORES.find((x) => x.bore_mm === bore_mm);
  if (!b) return null;
  return b.weight_base_kg + (stroke_mm / 100) * b.weight_per_100mm_kg;
}

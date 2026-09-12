/**
 * Parker GPR — miniatyrgripdon med vingmotor, parallellgrepp.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Parker Hannifin, Actuator Division, "Parallel Grippers", katalog
 *   1900-2/US. Ligger i knowledge_chunks som
 *   source_file = '1900-2_Gripper-Catalog.pdf'. Modellkoden står i chunk 9,
 *   tekniska data per storlek i chunk 4-8.
 *
 * Den enklaste nyckeln i hela genomgången — tre tecken, ett val:
 *
 *   GPR  1  A
 *   └┬┘  │  │
 * serie  │  funktion: A = standard
 *        storlek: 1 = Ø18, 3 = Ø24, 10 = Ø30 mm
 *
 * VÅRA TRE PRODUKTRADER ÄR KORREKTA -- GPR1A, GPR3A och GPR10A är precis de
 * tre modeller katalogen listar. Det var mallen som var fel:
 * "gpr-{size}-{grip_type}{options}" ger "gpr-1" med gemener, bindestreck som
 * koden inte har, och två positioner som inte finns i nyckeln.
 *
 * Femte falska larmet i revisionen, och det säger något om metoden: när
 * artikelnumret är KORT och katalogen bara trycker en modellkod finns det
 * ingenting att slå upp emot, hur riktig artikeln än är.
 */

export const GPR_SERIES = "GPR";

export const GPR_SOURCE = {
  file: "1900-2_Gripper-Catalog.pdf",
  edition: "1900-2/US",
  title: "Parker Parallel Grippers, GPR Series",
  brand: "Parker",
} as const;

export interface GprModel {
  /** Storlekskoden i artikelnumret. */
  size: string;
  bore_mm: number;
  stroke_mm: number;
  /** Total greppkraft vid 5 bar (72,5 PSI) med 1 tums verktygslängd, newton. */
  grip_force_n: number;
  weight_kg: number;
  pressure_min_bar: number;
  pressure_max_bar: number;
}

/**
 * Katalogens tre modeller.
 *
 * GPR10A skiljer sig på en punkt värd att notera: den går ned till 2 bar,
 * medan de två mindre kräver minst 3. Ett gripdon som stannar vid 2,5 bar är
 * inte samma sak som ett som inte får användas där.
 */
export const GPR_MODELS: GprModel[] = [
  { size: "1", bore_mm: 18, stroke_mm: 10, grip_force_n: 33.8, weight_kg: 0.09, pressure_min_bar: 3, pressure_max_bar: 6 },
  { size: "3", bore_mm: 24, stroke_mm: 14, grip_force_n: 62, weight_kg: 0.14, pressure_min_bar: 3, pressure_max_bar: 6 },
  { size: "10", bore_mm: 30, stroke_mm: 20, grip_force_n: 142, weight_kg: 0.245, pressure_min_bar: 2, pressure_max_bar: 6 },
];

/** Funktionspositionen. Katalogen listar ett enda värde. */
export const GPR_FUNCTION = "A";

/** Gemensamma data ur chunk 4-8. */
export const GPR_LIMITS = {
  temp_min_c: -5,
  temp_max_c: 60,
  repeatability_mm: 0.01,
  filtration_micron: 40,
} as const;

/** Bygger ett GPR-artikelnummer. Null när storleken inte finns. */
export function buildGprCode(size: string): string | null {
  if (!GPR_MODELS.some((m) => m.size === size)) return null;
  return `${GPR_SERIES}${size}${GPR_FUNCTION}`;
}

/** Läser ett GPR-artikelnummer. */
export function parseGprCode(raw: string): GprModel | null {
  const m = /^GPR(\d{1,2})A$/.exec(raw.trim().toUpperCase());
  if (!m) return null;
  return GPR_MODELS.find((x) => x.size === m[1]) ?? null;
}

/**
 * Greppkraft vid ett givet tryck, newton.
 *
 * Katalogen anger kraften vid 5 bar och ritar den som en rät linje mot trycket
 * i diagrammet. Kraften skalas därför linjärt, och funktionen finns för att
 * slippa lagra en tabell som ändå bara är en multiplikation.
 */
export function gprGripForceN(size: string, pressureBar: number): number | null {
  const m = GPR_MODELS.find((x) => x.size === size);
  if (!m) return null;
  if (pressureBar < m.pressure_min_bar || pressureBar > m.pressure_max_bar) return null;
  return Math.round((m.grip_force_n * pressureBar / 5) * 10) / 10;
}

/**
 * Camozzi Serie 6E — elektromekanisk cylinder med kulskruv.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Camozzi Automation, "Electromechanical cylinders, Series 6E", utgåva
 *   2026/05. Ligger i knowledge_chunks som source_file = 'camozzi-6E.pdf'.
 *   Kodexemplet står i chunk 3-5, den mekaniska tabellen i chunk 5.
 *
 * Katalogens eget kodexempel (chunk 3):
 *
 *   6E   032   BS   0200   P05   A   P
 *   └┬┘  └─┬┘  └┬┘  └─┬─┘  └─┬┘  │   │
 *  serie storlek│   slag  stigning│  version (P = IP65)
 *          transmission          konstruktion
 *
 * VÅRA FYRA PRODUKTRADER ÄR PÅHITTADE, på tre sätt samtidigt:
 *   1. De heter "6E-025-0100-24" -- med bindestreck. Katalogens kod har inga.
 *   2. Storlek 025 FINNS INTE. Katalogen har 32, 40, 50, 63, 80 och 100.
 *   3. Suffixet "-24" motsvarar ingen position i nyckeln. Troligen menades
 *      24 volt, men spänningen ingår inte i cylinderns kod -- motorn beställs
 *      separat.
 *
 * STIGNINGEN ÄR STORLEKSBEROENDE, och det är den intressanta delen av nyckeln:
 * P16 finns bara för storlek 40, P25 bara för 63, P32 bara för 80 och P40 bara
 * för 100. Tabellen i chunk 5 listar varje giltig kombination, och de står i
 * SIZE_PITCHES nedan.
 */

export const SERIE_6E_SOURCE = {
  file: "camozzi-6E.pdf",
  edition: "2026/05",
  title: "Camozzi Electromechanical cylinders, Series 6E",
  brand: "Camozzi",
} as const;

/** Transmissionen. Katalogen listar bara en. */
export const SERIE_6E_TRANSMISSION = "BS";

/** Konstruktion: "A = standard with rod nut". */
export const SERIE_6E_CONSTRUCTION = "A";

/** Version: "P = IP65". */
export const SERIE_6E_VERSION = "P";

/**
 * Storlekarna och de skruvstigningar var och en finns i.
 *
 * Ur den mekaniska tabellen i chunk 5, som listar dynamisk last per
 * kombination -- alltså exakt de kombinationer som tillverkas:
 *
 *   Size  32  32  40  40  40  50  50  50  63  63  63  80  80  80  80  100 100 100 100
 *   P     5   10  5   10  16  5   10  20  5   10  25  5   10  20  32  5   10  20  40
 */
export const SERIE_6E_SIZES: Array<{ size: number; code: string; pitches: number[] }> = [
  { size: 32, code: "032", pitches: [5, 10] },
  { size: 40, code: "040", pitches: [5, 10, 16] },
  { size: 50, code: "050", pitches: [5, 10, 20] },
  { size: 63, code: "063", pitches: [5, 10, 25] },
  { size: 80, code: "080", pitches: [5, 10, 20, 32] },
  { size: 100, code: "100", pitches: [5, 10, 20, 40] },
];

/** Slaglängd. Katalogen: "STROKE 100 ÷ 1500 mm". */
export const SERIE_6E_STROKE = { min: 100, max: 1500, unit: "mm" } as const;

export interface Serie6eReading {
  size: number;
  transmission: string;
  stroke_mm: number;
  pitch_mm: number;
  construction: string;
  version: string;
}

/** Stigningens kod, t.ex. 5 -> "P05". */
export function pitchCode(pitch_mm: number): string {
  return `P${String(pitch_mm).padStart(2, "0")}`;
}

/** Bygger en Serie 6E-kod. Null när kombinationen inte finns i katalogen. */
export function build6eCode(c: {
  size: number; stroke_mm: number; pitch_mm?: number;
}): string | null {
  const s = SERIE_6E_SIZES.find((x) => x.size === c.size);
  if (!s) return null;
  const pitch = c.pitch_mm ?? 5;
  if (!s.pitches.includes(pitch)) return null;
  if (!Number.isInteger(c.stroke_mm) ||
      c.stroke_mm < SERIE_6E_STROKE.min || c.stroke_mm > SERIE_6E_STROKE.max) {
    return null;
  }
  return `6E${s.code}${SERIE_6E_TRANSMISSION}${String(c.stroke_mm).padStart(4, "0")}` +
    `${pitchCode(pitch)}${SERIE_6E_CONSTRUCTION}${SERIE_6E_VERSION}`;
}

/** Läser en Serie 6E-kod. Null när formen eller kombinationen inte stämmer. */
export function parse6eCode(raw: string): Serie6eReading | null {
  const m = /^6E(\d{3})(BS)(\d{4})P(\d{2})([A])([P])$/.exec(raw.trim().toUpperCase());
  if (!m) return null;
  const s = SERIE_6E_SIZES.find((x) => x.code === m[1]);
  const pitch_mm = Number(m[4]);
  const stroke_mm = Number(m[3]);
  if (!s || !s.pitches.includes(pitch_mm)) return null;
  if (stroke_mm < SERIE_6E_STROKE.min || stroke_mm > SERIE_6E_STROKE.max) return null;
  return {
    size: s.size, transmission: m[2], stroke_mm, pitch_mm,
    construction: m[5], version: m[6],
  };
}

/** Alla giltiga (storlek, stigning)-par. */
export function serie6eCombinations(): Array<{ size: number; pitch_mm: number }> {
  return SERIE_6E_SIZES.flatMap((s) => s.pitches.map((p) => ({ size: s.size, pitch_mm: p })));
}

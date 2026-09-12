/**
 * Bosch Rexroth RTC-HD — kolvstångslös cylinder med kulskenestyrning.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Bosch Rexroth AG, "Rodless cylinders, Series RTC-HD", pneumatikkatalog
 *   online-PDF per 2013-04-11. Ligger i knowledge_chunks som
 *   source_file = 'RTC-HD.pdf'. Artikelnummertabellen står i chunk 3-4,
 *   tekniska data i chunk 0-1.
 *
 * SAMMA SORT SOM KPZ: ingen modulär beställnyckel, utan en TABELL med färdiga
 * artikelnummer per borrning och slaglängd. Men till skillnad från KPZ är
 * numren INTE regelbundna -- R480156949, R480149659, R480154726 ligger inte i
 * någon räknebar ordning. Tabellen måste därför skrivas av, inte räknas fram,
 * och den står i RTC_HD_TABLE nedan precis som katalogen trycker den.
 *
 * VÅRA SEX PRODUKTRADER ÄR PÅHITTADE. De heter R400769016, R400769025,
 * R400769032, R400769040, R400769050, R400769063 -- alltså samma nummer med
 * borrningen påklistrad. Slaglängden är inte kodad någonstans, trots att
 * raderna påstår sex olika slag (200, 500, 500, 500, 1000, 1000). Katalogens
 * riktiga nummer börjar på R480 och är olika för varje kombination.
 */

export const RTC_HD_SOURCE = {
  file: "RTC-HD.pdf",
  edition: "2013-04-11",
  title: "Bosch Rexroth Rodless cylinders, Series RTC-HD",
  brand: "Bosch Rexroth",
} as const;

/**
 * Tekniska data ur chunk 0-1.
 *
 * Trycket är värt att lägga märke till: katalogen räknar kolvkrafter vid
 * 6,3 bar, inte 6. Skillnaden är 5 %, och den förklarar varför Ø16 anges som
 * 127 N och inte 121.
 */
export const RTC_HD_LIMITS = {
  pressure_min_bar: 4,
  pressure_max_bar: 8,
  force_reference_bar: 6.3,
  temp_min_c: -10,
  temp_max_c: 60,
  speed_max_ms: 2,
} as const;

export interface RtcHdBore {
  bore_mm: number;
  port: string;
}

/** Borrningarna med sin anslutning (chunk 3-4). */
export const RTC_HD_BORES: RtcHdBore[] = [
  { bore_mm: 16, port: "M7" },
  { bore_mm: 25, port: "G 1/8" },
  { bore_mm: 32, port: "G 1/8" },
  { bore_mm: 40, port: "G 1/4" },
  { bore_mm: 50, port: "G 1/4" },
  { bore_mm: 63, port: "G 3/8" },
];

/** Slaglängderna i tabellens kolumnordning. */
export const RTC_HD_STROKES = [200, 300, 400, 500, 600, 700, 800, 900, 1000];

/**
 * Artikelnummertabellen, avskriven ur chunk 3-4.
 *
 * null = katalogen skriver "-", alltså ingen lagerförd artikel. Ø16 slutar vid
 * 700 mm, Ø25 vid 800, och Ø50 och Ø63 börjar först vid 400.
 *
 * Numren är INTE räknebara -- de måste stå här. Det är skillnaden mot KPZ,
 * där hela tabellen faller ut ur en regel.
 */
export const RTC_HD_TABLE: Record<number, Array<string | null>> = {
  //      200           300           400           500           600           700           800           900           1000
  16: ["R480156949", "R480156950", "R480156951", "R480147724", "R480156953", "R480156954", null, null, null],
  25: ["R480149659", "R480149553", "R480150759", "R480147725", "R480153574", "R480156959", "R480155572", null, null],
  32: ["R480154726", "R480148820", "R480148602", "R480147726", "R480148603", "R480154001", "R480150325", "R480156963", "R480148582"],
  40: ["R480155259", "R480154424", "R480154425", "R480147727", "R480148971", "R480149554", "R480156710", "R480156969", "R480150515"],
  50: [null, null, "R480155175", "R480147728", "R480146987", "R480156943", "R480149774", "R480156944", "R480149030"],
  63: [null, null, "R480156946", "R480147729", "R480156947", "R480149638", "R480154379", "R480149592", "R480149031"],
};

export interface RtcHdArticle {
  part_no: string;
  bore_mm: number;
  stroke_mm: number;
  port: string;
}

/** Hela den lagerförda tabellen som rader. */
export function rtcHdCatalogue(): RtcHdArticle[] {
  const ut: RtcHdArticle[] = [];
  for (const b of RTC_HD_BORES) {
    const rad = RTC_HD_TABLE[b.bore_mm];
    rad.forEach((nr, i) => {
      if (nr) ut.push({ part_no: nr, bore_mm: b.bore_mm, stroke_mm: RTC_HD_STROKES[i], port: b.port });
    });
  }
  return ut;
}

/** Slår upp artikelnumret. Null = kombinationen är inte lagerförd. */
export function rtcHdPartNo(bore_mm: number, stroke_mm: number): string | null {
  const i = RTC_HD_STROKES.indexOf(stroke_mm);
  if (i < 0) return null;
  return RTC_HD_TABLE[bore_mm]?.[i] ?? null;
}

/** Läser ett RTC-HD-artikelnummer tillbaka till borrning och slag. */
export function parseRtcHdPartNo(raw: string): RtcHdArticle | null {
  const nr = raw.trim().toUpperCase();
  return rtcHdCatalogue().find((a) => a.part_no === nr) ?? null;
}

/**
 * Teoretisk kolvkraft vid katalogens referenstryck.
 *
 * Lagras inte per borrning: den går att räkna, och projektets regel är att det
 * som kan räknas aldrig ska lagras. Katalogens egna värden (127, 309, 507,
 * 792, 1237 N) faller ut ur den här formeln på tiondelen.
 */
export function rtcHdForceN(
  bore_mm: number,
  // Typas som number, inte som literalen 6,3: `as const` på RTC_HD_LIMITS gör
  // annars defaultvärdet till parameterns TYP, och då går det inte att räkna
  // om vid ett annat tryck.
  pressureBar: number = RTC_HD_LIMITS.force_reference_bar,
): number {
  return Math.round((Math.PI / 4) * bore_mm ** 2 * pressureBar * 0.1);
}

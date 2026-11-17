/**
 * Säljpris ur inköpspris och marginal.
 *
 * Marginalen är bruttomarginal i PROCENT (products.margin, migration
 * 20260603000300): säljpris = inköpspris ÷ (1 − marginal/100). Ägaren
 * 2026-11-12: 20 % på allt, alltså köper för 100 kr, säljer för 125 kr.
 * Samma formel som databasfunktionen publika_priser (20261112140000).
 *
 * Ingen import av supabase-klienten, så att filen kan provas med deno test.
 */
export const STANDARD_MARGINAL = 20;

/**
 * Under 1 % är ett misstag: kolumnens gamla bråktalsstandard 0,35 gav
 * artiklar inlagda efter juni 0,35 % -- säljpriset blev inköpspriset.
 */
export function misstankMarginal(margin: string | number | null | undefined): boolean {
  const mg = typeof margin === "string" ? Number(margin) : margin;
  return mg != null && !isNaN(mg) && mg > 0 && mg < 1;
}

/**
 * Artikelns marginal när den är ett rimligt procenttal (1–95, samma gräns som
 * publika_priser), annars standarden 20.
 */
export function giltigMarginal(margin: number | null | undefined): number {
  return margin != null && Number.isFinite(margin) && margin >= 1 && margin <= 95 ? margin : STANDARD_MARGINAL;
}

/** Inköpspris ÷ (1 − marginal/100), utan avrundning. */
export function saljpris(inkop: number, marginalProcent: number): number {
  return inkop / (1 - marginalProcent / 100);
}

/** Marginalen ett pris faktiskt ger, i procent; null utan pris. */
export function faktiskMarginal(inkop: number, pris: number): number | null {
  if (!(pris > 0) || !Number.isFinite(inkop)) return null;
  return ((pris - inkop) / pris) * 100;
}

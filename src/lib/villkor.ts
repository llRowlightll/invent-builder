/**
 * Allmänna villkoren: version och offertens giltighetstid på ett ställe, så
 * att villkorssidan, offerten, orderbekräftelsen och beställningssteget säger
 * samma sak.
 */
export const VILLKOR_VERSION = "1.2";
export const VILLKOR_DATUM: Record<string, string> = { sv: "8 oktober 2026", en: "8 October 2026" };

/** Villkoren avsnitt 3: en offert gäller i 30 dagar från offertdatum. */
export const OFFERT_GILTIG_DAGAR = 30;

export function offertGiltigTill(offertdatum: string | Date): Date {
  const d = new Date(offertdatum);
  d.setDate(d.getDate() + OFFERT_GILTIG_DAGAR);
  return d;
}

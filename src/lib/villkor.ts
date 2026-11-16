/**
 * Allmänna villkoren: version och offertens giltighetstid på ett ställe, så
 * att villkorssidan, offerten, orderbekräftelsen och beställningssteget säger
 * samma sak.
 */
export const VILLKOR_VERSION = "1.5";
export const VILLKOR_DATUM: Record<string, string> = { sv: "16 november 2026", en: "16 November 2026" };

/**
 * Villkoren avsnitt 6 (ägaren 2026-11-16): en ny kund betalar första ordern i
 * förskott -- Maskinval beställer hos leverantören när betalningen kommit in --
 * därefter 30 dagar netto. "Ny" = ingen tidigare levererad, fakturerad eller
 * betald order med samma e-post.
 */
export const BETALVILLKOR_NY = "Förskott: betalas innan vi beställer hos leverantören";
export const BETALVILLKOR_KAND = "30 dagar netto";
export const AVSLUTADE_ORDERSTATUS = ["delivered", "invoiced", "paid"];

/** Villkoren avsnitt 3: en offert gäller i 30 dagar från offertdatum. */
export const OFFERT_GILTIG_DAGAR = 30;

export function offertGiltigTill(offertdatum: string | Date): Date {
  const d = new Date(offertdatum);
  d.setDate(d.getDate() + OFFERT_GILTIG_DAGAR);
  return d;
}

/**
 * Fabrikat med en loggofil i /public/brands/. Övriga visas som ordmärke.
 *
 * En lista i stället för onError: en serverrenderad <img> som saknar fil
 * hinner fela innan React hydrerat, så onError-reserven körs aldrig och
 * sidan står med en trasig bild (AVENTICS på produktsidan, 2026-10-14).
 */
export const BRAND_LOGOS = new Set(["festo", "smc", "parker", "bosch-rexroth", "norgren", "metal-work", "camozzi"]);

export function harLogga(slug: string): boolean {
  return BRAND_LOGOS.has(slug);
}

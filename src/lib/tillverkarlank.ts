/**
 * Länk till tillverkarens CAD och datablad för en katalograd.
 *
 * Bara mönster som provats i webbläsare 2026-10-06 finns med:
 *
 *   Festo     festo.com-sökningen hittar artikelnummer (1376433), modulnummer
 *             (193986 → DSNU-8) och typkoder, även med "14" för "1/4"
 *             (MS4-LR-14-D7 → MS4-LR-1/4-D7). Artikeladressen /a/{nr}/ fungerar
 *             inte för modulnummer, så sökningen används för alla rader.
 *   AVENTICS  TraceParts hittar artikelnumret (0822120004 → PRA Ø32×100) med
 *             CAD. Alla 169 AVENTICS-rader har formen 0xxxxxxxxx eller Rxxxxxxxxx.
 *   SMC       smc.eu-sökningen (parametern searchTerm, provad 2026-10-07)
 *             hittar artikelnummer (KQ2H06-01AS, TU0604BU-20) med "Ladda ned
 *             CAD" och leder serienamn (CQ2B32, AW) till serien. Svenska sidor
 *             länkar till sv-se, övriga till en-eu.
 *
 * Parker, Camozzi och Metal Work saknar ett provat adressmönster, och
 * TraceParts saknar deras artiklar. Norgrens sökning fungerar men visar pris
 * och köpknapp; den väntar på ett affärsbeslut. Hellre ingen länk än en som
 * leder fel.
 */
export interface Tillverkarlank {
  href: string;
  text: string;
}

const TEXT: Record<string, { festo: string; traceparts: string; smc: string }> = {
  sv: { festo: "CAD och datablad hos Festo", traceparts: "CAD och data hos TraceParts", smc: "CAD och datablad hos SMC" },
  en: { festo: "CAD and datasheet at Festo", traceparts: "CAD and data at TraceParts", smc: "CAD and datasheet at SMC" },
  de: { festo: "CAD und Datenblatt bei Festo", traceparts: "CAD und Daten bei TraceParts", smc: "CAD und Datenblatt bei SMC" },
  es: { festo: "CAD y hoja de datos en Festo", traceparts: "CAD y datos en TraceParts", smc: "CAD y hoja de datos en SMC" },
};

/** Sökordet hos Festo: artikelnummer, modulnummer eller typkod ur SKU:n. */
export function festoSokord(sku: string): string {
  return /^(?:FESTO|FE)-(.+)$/i.exec(sku)?.[1] ?? sku;
}

/** Sökordet hos SMC: SKU:n utan "SMC-" (sju rader, t.ex. TU0604BU-20, saknar prefixet). */
export function smcSokord(sku: string): string {
  return /^SMC-(.+)$/i.exec(sku)?.[1] ?? sku;
}

export function tillverkarlank(p: { sku: string; brand: { slug: string } }, locale: string): Tillverkarlank | null {
  const t = TEXT[locale] ?? TEXT.en;
  if (p.brand.slug === "festo") {
    return { href: `https://www.festo.com/se/en/search?text=${encodeURIComponent(festoSokord(p.sku))}`, text: t.festo };
  }
  if (p.brand.slug === "aventics" && /^(0\d{9}|R\d{9})$/.test(p.sku)) {
    return { href: `https://www.traceparts.com/en/search?Keywords=${p.sku}`, text: t.traceparts };
  }
  if (p.brand.slug === "smc") {
    const region = locale === "sv" ? "sv-se" : "en-eu";
    return { href: `https://www.smc.eu/${region}/search?searchTerm=${encodeURIComponent(smcSokord(p.sku))}`, text: t.smc };
  }
  return null;
}

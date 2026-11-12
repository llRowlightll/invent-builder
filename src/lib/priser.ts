/**
 * Publika priser på produktsidan.
 *
 * Säljpriset kommer ur databasfunktionen publika_priser (migration
 * 20261112140000): hela kronor exkl. moms, bara för aktiva artiklar med
 * inköpspris, en marginal på 1–95 % och ett prisdatum inom 365 dagar -- och
 * bara när ägaren slagit på "Visa priser" i admin. Inköpspris och marginal
 * lämnar aldrig databasen. Här finns bara tolkning och text; hämtningen ligger
 * i priser-hamta.ts så att proven inte behöver Supabase-klienten.
 *
 * Villkoren (avsnitt 3) säger att priser på plattformen är indikativa och att
 * priset i offerten eller orderbekräftelsen gäller; texten säger detsamma.
 */
// Samma värden som Locale i i18n.ts; därifrån importeras inte, eftersom
// i18n.ts läser JSON-filerna och proven (Deno) då inte kan ladda modulen.
type Locale = "sv" | "en" | "de" | "es";

export interface PubliktPris {
  sku: string;
  /** Hela kronor exkl. moms. */
  pris: number;
  /** En serie utan artikelnummer: priset är ett "från"-pris. */
  fran: boolean;
  /** ÅÅÅÅ-MM-DD, när inköpspriset sattes. */
  prisdatum: string | null;
}

/** En rad ur publika_priser, eller null om den inte går att lita på. */
export function tolkaPrisrad(r: unknown): PubliktPris | null {
  if (!r || typeof r !== "object") return null;
  const rad = r as Record<string, unknown>;
  const sku = typeof rad.sku === "string" ? rad.sku : "";
  const pris = Number(rad.pris_exkl_moms);
  if (!sku || !Number.isFinite(pris) || pris <= 0) return null;
  const datum = typeof rad.prisdatum === "string" && /^\d{4}-\d{2}-\d{2}/.test(rad.prisdatum)
    ? rad.prisdatum.slice(0, 10)
    : null;
  return { sku, pris: Math.round(pris), fran: rad.fran === true, prisdatum: datum };
}

const TAL: Record<Locale, string> = { sv: "sv-SE", en: "en-GB", de: "de-DE", es: "es-ES" };

/** "1 558 kr" på svenska, "SEK 1,558" på engelska, "1.558 SEK" på tyska. */
export function formatBelopp(kr: number, locale: Locale): string {
  const tal = new Intl.NumberFormat(TAL[locale] ?? "sv-SE", { maximumFractionDigits: 0 }).format(kr);
  if (locale === "sv") return `${tal} kr`;
  if (locale === "en") return `SEK ${tal}`;
  return `${tal} SEK`;
}

/**
 * schema.org-erbjudandet för ett pris. En serie ("från") får inget: Google
 * läser Offer.price som priset för just den artikeln, och ett från-pris är
 * inte det.
 */
export function prisErbjudande(p: PubliktPris | null, url: string): Record<string, unknown> | null {
  if (!p || p.fran) return null;
  return {
    "@type": "Offer",
    price: p.pris,
    priceCurrency: "SEK",
    url,
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: p.pris,
      priceCurrency: "SEK",
      valueAddedTaxIncluded: false,
    },
    seller: { "@type": "Organization", name: "Maskinval" },
  };
}

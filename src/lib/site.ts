/** Canonical production origin — update this when the domain changes */
export const SITE = "https://maskinval.se";

export const LOCALES = ["sv", "en", "de", "es"] as const;

/**
 * Delningsbilden (og:image) per språk, 1200x630. LinkedIn, Facebook och X
 * visar inte SVG -- med den gamla og-image.svg fick en delad länk ingen bild.
 */
export function delningsbild(locale: string): string {
  const sprak = (LOCALES as readonly string[]).includes(locale) ? locale : "sv";
  return `${SITE}/og-${sprak}.jpg`;
}

const DELNINGSBILD_ALT: Record<string, string> = {
  sv: "Maskinval: Beskriv vad den ska göra. Få artikelnumret.",
  en: "Maskinval: Describe what it needs to do. Get the part number.",
  de: "Maskinval: Beschreiben Sie, was es tun soll. Erhalten Sie die Artikelnummer.",
  es: "Maskinval: Describe lo que debe hacer. Obtén la referencia.",
};

export function delningsbildMeta(locale: string) {
  return [
    { property: "og:image", content: delningsbild(locale) },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: DELNINGSBILD_ALT[locale] ?? DELNINGSBILD_ALT.sv },
  ];
}

/** Build hreflang alternate links for a given path (without locale prefix) */
export function hreflangLinks(path: string = "") {
  const suffix = path ? `/${path}` : "";
  return [
    { rel: "alternate", hrefLang: "sv", href: `${SITE}/sv${suffix}` },
    { rel: "alternate", hrefLang: "en", href: `${SITE}/en${suffix}` },
    { rel: "alternate", hrefLang: "de", href: `${SITE}/de${suffix}` },
    { rel: "alternate", hrefLang: "es", href: `${SITE}/es${suffix}` },
    { rel: "alternate", hrefLang: "x-default", href: `${SITE}/sv${suffix}` },
  ];
}

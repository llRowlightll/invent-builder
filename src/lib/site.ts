/** Canonical production origin — update this when the domain changes */
export const SITE = "https://maskinval.se";

export const LOCALES = ["sv", "en", "de", "es"] as const;

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

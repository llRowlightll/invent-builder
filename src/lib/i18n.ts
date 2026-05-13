import en from "@/locales/en.json";
import sv from "@/locales/sv.json";
import de from "@/locales/de.json";
import es from "@/locales/es.json";

export const SUPPORTED_LOCALES = ["en", "sv", "de", "es"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const dictionaries = { en, sv, de, es } as const;

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const lang = (navigator.language || "en").toLowerCase();
  if (lang.startsWith("sv")) return "sv";
  if (lang.startsWith("de")) return "de";
  if (lang.startsWith("es")) return "es";
  return "en";
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `lifemap_locale=${locale}; Max-Age=${oneYear}; Path=/; SameSite=Lax`;
}

type Dict = typeof en;
type DotPath<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends object
    ? DotPath<T[K], `${P}${K}.`>
    : `${P}${K}`;
}[keyof T & string];
export type TKey = DotPath<Dict>;

function get(obj: unknown, path: string): string {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object" && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj) as string;
}

export function translate(locale: Locale, key: TKey): string {
  const v = get(dictionaries[locale], key);
  if (typeof v === "string") return v;
  const fallback = get(dictionaries[DEFAULT_LOCALE], key);
  return typeof fallback === "string" ? fallback : key;
}

export function makeT(locale: Locale) {
  return (key: TKey) => translate(locale, key);
}

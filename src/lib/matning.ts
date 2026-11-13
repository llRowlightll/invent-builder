/**
 * Egen, anonym mätning: händelsetyp, sida, språk och ett litet faktaobjekt.
 * Inga cookies, ingen IP-adress, inget användar-id -- se migrationen
 * 20261006210000_egen_matning.sql. Skickas och glöms: mätningen får aldrig
 * fördröja eller fälla det kunden håller på med.
 *
 * Finns Google Analytics laddat (samtycke + VITE_GA_ID) skickas händelsen dit
 * också, med samma namn.
 */
import { supabase } from "@/integrations/supabase/client";

export type Handelse = "besok" | "sok" | "ai_fraga" | "stycklista" | "offert" | "ersatt";

export function logga(typ: Handelse, data: Record<string, string | number | boolean | null> = {}) {
  try {
    if (typeof window === "undefined") return;
    // Dev-servern skriver mot samma databas; provbesök hör inte hemma i statistiken.
    if (/^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(window.location.hostname)) return;
    // Ägarens egna enheter räknas inte (se markeraIntern).
    if (arIntern()) return;
    // Leverantörslänkens token är hemlig och sparas inte i mätningen.
    const sida = window.location.pathname.replace(/\/leverantor\/[^/]+/, "/leverantor/[token]");
    const sprak = sida.split("/")[1] || null;
    void supabase.rpc("logga_handelse" as never, { p_typ: typ, p_sida: sida, p_sprak: sprak, p_data: data } as never)
      .then(() => undefined, () => undefined);
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (gtag) gtag("event", typ, data);
  } catch {
    // Mätningen får aldrig störa sidan.
  }
}

/** Var besöket kom ifrån: värddelen av referer och utm-taggarna, inget mer. */
export function besoksKalla(): Record<string, string | null> {
  const ref = document.referrer;
  let fran = "direkt";
  try {
    if (ref) {
      const host = new URL(ref).hostname.replace(/^www\./, "");
      fran = host === window.location.hostname.replace(/^www\./, "") ? "intern" : host;
    }
  } catch { /* ogiltig referer */ }
  const p = new URLSearchParams(window.location.search);
  return {
    fran,
    utm_source: p.get("utm_source"),
    utm_medium: p.get("utm_medium"),
    utm_campaign: p.get("utm_campaign"),
  };
}

/**
 * Egna besök ska inte se ut som kunder. Ägaren 2026-11-13: "hur många av
 * besöken utifrån är verkligen andra kunder, vi har ju varit inne en del".
 * En enhet blir intern när en admin loggar in där, eller med ?intern=1 i
 * adressen (t.ex. på mobilen utan inloggning); ?intern=0 tar bort det.
 * Bara en flagga i webbläsarens lagring -- ingen identitet sparas.
 */
const INTERN = "mv_intern";

export function arIntern(): boolean {
  try { return window.localStorage.getItem(INTERN) === "1"; } catch { return false; }
}

export function markeraIntern(pa: boolean): void {
  try {
    if (pa) window.localStorage.setItem(INTERN, "1");
    else window.localStorage.removeItem(INTERN);
  } catch { /* privat läge: inget att göra */ }
}

/** Läser ?intern=1 / ?intern=0 i adressen. */
export function lasInternFranAdressen(): void {
  try {
    const v = new URLSearchParams(window.location.search).get("intern");
    if (v === "1") markeraIntern(true);
    if (v === "0") markeraIntern(false);
  } catch { /* ingen adress */ }
}

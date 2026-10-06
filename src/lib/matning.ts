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
    const sida = window.location.pathname;
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

/**
 * Anropen till fortnox-anslut från admin. Nycklarna syns aldrig i
 * webbläsaren: funktionen ger bara en inloggningslänk till Fortnox och status.
 */
import { supabase } from "@/integrations/supabase/client";
import { FORTNOX_ANSLUT, type FortnoxStatus } from "./fortnox";

export async function fortnoxAnrop(action: "start" | "status"): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(FORTNOX_ANSLUT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify({ action }),
  }).catch(() => null);
  if (!res) return { fel: "Kunde inte nå Fortnox-kopplingen." };
  return await res.json().catch(() => ({ fel: `Svar ${res.status}` }));
}

export async function fortnoxStatus(): Promise<FortnoxStatus | null> {
  const s = await fortnoxAnrop("status");
  return typeof s.ansluten === "boolean" ? (s as unknown as FortnoxStatus) : null;
}

/**
 * Skickar webbläsaren till Fortnox inloggning. Lyckas det lämnar sidan, och
 * Fortnox skickar tillbaka till Integrationer. Annars kommer felet tillbaka.
 */
export async function startaFortnox(): Promise<string> {
  const svar = await fortnoxAnrop("start");
  if (typeof svar.url === "string") {
    window.location.href = svar.url;
    return "";
  }
  return typeof svar.fel === "string" ? svar.fel : "Kunde inte starta anslutningen.";
}

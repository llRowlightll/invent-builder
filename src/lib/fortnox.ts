/**
 * Fortnox-kopplingen, det som både admin-översikten och Integrationer
 * behöver: adressen till fortnox-anslut, länkarna till Fortnox och en
 * begriplig förklaring av Fortnox felkoder.
 *
 * Ingen import av supabase-klienten här, så att filen kan provas med deno test.
 */

export const FORTNOX_ANSLUT = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/fortnox-anslut";

/** Inloggningen i Fortnox. Därifrån når man Köp & Aktivera och Utvecklarportal. */
export const FORTNOX_INLOGGNING = "https://apps.fortnox.se/fs/fs/login.php";

export type FortnoxStatus = {
  ansluten: boolean;
  nycklar: boolean;
  foretag?: string | null;
  fel?: string | null;
};

/**
 * Vad ägaren ska göra när Fortnox svarar med ett fel. null = felet förklarar
 * sig självt (eller är okänt) och visas som det är.
 *
 * 2026-11-12: "An unsupported scope was requested" berodde på att appen i
 * utvecklarportalen saknade behörigheter och redirect-adress. Ändringar där
 * slår igenom först efter ungefär en minut.
 */
export function fortnoxRad(fel: string | null | undefined): string | null {
  if (!fel) return null;
  const t = fel.toLowerCase();
  if (t.includes("not licensed") || t.includes("licens")) {
    return "Företaget du valde i Fortnox saknar licens för detta. Aktivera Fakturering under Köp & Aktivera i Fortnox och tryck Anslut Fortnox igen.";
  }
  if (t.includes("unsupported scope") || t.includes("invalid_scope")) {
    return "Appen i Fortnox utvecklarportal saknar behörigheter. Kryssa i Artikel, Faktura, Företagsinformation, Kund och Order, spara, vänta en minut och försök igen.";
  }
  if (t.includes("redirect")) {
    return `Redirect URI i Fortnox utvecklarportal ska vara exakt ${FORTNOX_ANSLUT}.`;
  }
  if (t.includes("access_denied") || t.includes("denied")) {
    return "Anslutningen avbröts i Fortnox. Tryck Anslut Fortnox igen när du vill koppla.";
  }
  return null;
}

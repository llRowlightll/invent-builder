/**
 * fortnox-anslut -- kopplar Fortnox med OAuth, utan att någon hanterar en
 * nyckel för hand.
 *
 *   POST { action: "start" }   (admin)  -> { url } till Fortnox inloggning
 *   POST { action: "status" }  (admin)  -> { ansluten, foretag, fel }
 *   GET  ?code&state                   <- Fortnox skickar tillbaka hit; koden
 *                                         byts mot access- och refresh-token
 *                                         som sparas i integration_tokens
 *                                         (samma rad som fortnox-order läser).
 *
 * verify_jwt är AV (config.toml): Fortnox anrop tillbaka bär ingen inloggning.
 * POST-vägarna kräver därför admin själva, och GET-vägen gör ingenting utan
 * ett state som skapats av en admin de senaste 15 minuterna och inte använts.
 *
 * Kräver FORTNOX_CLIENT_ID och FORTNOX_CLIENT_SECRET i Supabase Secrets, och
 * att integrationen i Fortnox utvecklarportal har exakt de behörigheter som
 * SCOPES nedan och redirect-adressen REDIRECT.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/admin-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("FORTNOX_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("FORTNOX_CLIENT_SECRET") ?? "";
const REDIRECT = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/fortnox-anslut";
const SCOPES = "companyinformation customer order invoice article";
const TILLBAKA = "https://maskinval.se/sv/admin/integrations";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function tillbaka(utfall: "ok" | "fel", text?: string) {
  const url = `${TILLBAKA}?fortnox=${utfall}${text ? `&meddelande=${encodeURIComponent(text.slice(0, 200))}` : ""}`;
  return new Response(null, { status: 302, headers: { Location: url } });
}

function slumpState(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Fortnox skickar tillbaka webbläsaren hit ──────────────────────────────
  if (req.method === "GET") {
    const u = new URL(req.url);
    const fel = u.searchParams.get("error");
    if (fel) return tillbaka("fel", `Fortnox: ${u.searchParams.get("error_description") ?? fel}`);
    const code = u.searchParams.get("code") ?? "";
    const state = u.searchParams.get("state") ?? "";
    if (!code || !/^[0-9a-f]{48}$/.test(state)) return tillbaka("fel", "Svaret från Fortnox saknade kod eller state.");

    // Engångs: raden tas bort i samma steg som den läses.
    const { data: rader } = await db.from("oauth_states").delete()
      .eq("state", state).eq("provider", "fortnox")
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .select("state");
    if (!rader || rader.length === 0) return tillbaka("fel", "Anslutningen hade gått ut. Tryck på Anslut Fortnox igen.");

    if (!CLIENT_ID || !CLIENT_SECRET) return tillbaka("fel", "FORTNOX_CLIENT_ID eller FORTNOX_CLIENT_SECRET saknas i Supabase Secrets.");
    const svar = await fetch("https://apps.fortnox.se/oauth-v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT }),
    });
    const kropp = await svar.json().catch(() => ({}));
    if (!svar.ok || !kropp.access_token || !kropp.refresh_token) {
      // Själva svaret kan innehålla känsliga fält; bara status och felkod sparas.
      const felkod = `${svar.status} ${String(kropp.error ?? "")} ${String(kropp.error_description ?? "")}`.trim();
      await db.from("integration_tokens").upsert({ provider: "fortnox", last_error: `Anslutning misslyckades: ${felkod}`, updated_at: new Date().toISOString() });
      return tillbaka("fel", `Fortnox godtog inte koden (${felkod}).`);
    }
    const { error: skrivFel } = await db.from("integration_tokens").upsert({
      provider: "fortnox",
      access_token: kropp.access_token,
      refresh_token: kropp.refresh_token,
      expires_at: new Date(Date.now() + (Number(kropp.expires_in) || 3600) * 1000).toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    if (skrivFel) return tillbaka("fel", `Kunde inte spara anslutningen: ${skrivFel.message}`);
    return tillbaka("ok");
  }

  // ── Admin-knapparna ───────────────────────────────────────────────────────
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const body = await req.json().catch(() => ({})) as { action?: string };

  if (body.action === "start") {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return json({ fel: "FORTNOX_CLIENT_ID och FORTNOX_CLIENT_SECRET måste finnas i Supabase Secrets först." }, 409);
    }
    const state = slumpState();
    await db.from("oauth_states").delete().lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    const { error } = await db.from("oauth_states").insert({ state, provider: "fortnox", created_by: admin.userId });
    if (error) return json({ fel: error.message }, 500);
    const url = new URL("https://apps.fortnox.se/oauth-v1/auth");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("response_type", "code");
    return json({ url: url.toString() });
  }

  if (body.action === "status") {
    const { data: rad } = await db.from("integration_tokens")
      .select("access_token, refresh_token, expires_at, last_error, updated_at")
      .eq("provider", "fortnox").maybeSingle();
    const r = rad as { access_token: string | null; refresh_token: string | null; expires_at: string | null; last_error: string | null; updated_at: string } | null;
    if (!r?.refresh_token) {
      return json({ ansluten: false, nycklar: Boolean(CLIENT_ID && CLIENT_SECRET), fel: r?.last_error ?? null });
    }
    // Företagsnamnet bekräftar att kopplingen fungerar. En utgången access
    // token förnyas av fortnox-order vid nästa anrop; här räcker datumet.
    let foretag: string | null = null;
    if (r.access_token && r.expires_at && new Date(r.expires_at).getTime() > Date.now() + 30_000) {
      const svar = await fetch("https://api.fortnox.se/3/companyinformation", {
        headers: { Authorization: `Bearer ${r.access_token}`, Accept: "application/json" },
      }).catch(() => null);
      const k = svar && svar.ok ? await svar.json().catch(() => null) : null;
      foretag = k?.CompanyInformation?.CompanyName ?? null;
    }
    return json({ ansluten: true, nycklar: true, foretag, fel: r.last_error, uppdaterad: r.updated_at });
  }

  return json({ fel: "Okänd action." }, 400);
});

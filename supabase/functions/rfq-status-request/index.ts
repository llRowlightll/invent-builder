/**
 * rfq-status-request — customer clicks "Fråga om status" on their own RFQ.
 *
 * Inserts a customer-triggered row into rfq_status_log and emails the admin
 * inbox so a real, unanswered question doesn't just sit silently in a table
 * nobody looks at (rfq_status_log itself has no admin-facing UI outside the
 * RFQ detail page — this is the notification that gets someone to open it).
 *
 * SECURITY: verify_jwt: true — the gateway already rejects anonymous callers.
 * This additionally confirms the authenticated caller actually OWNS the
 * rfq_id they're asking about (not just any logged-in customer) before
 * writing anything, using the service-role client so the insert itself
 * isn't gated by rfq_status_log's RLS (customers have no direct table
 * access — see the rfq_status_log_secure_rls migration). Only rfq_id is
 * trusted from the request body, matching the pattern already used in
 * rfq-notify and order-status-email.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { skickaMejl } from "../_shared/notify.ts";
import { escapeHtml } from "../_shared/html.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const RESEND_API = "https://api.resend.com/emails";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Maskinval <noreply@maskinval.se>";
const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "alexandrooden@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userErr } = await anon.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const rfq_id = body?.rfq_id;
    if (!rfq_id || typeof rfq_id !== "string") {
      return new Response(JSON.stringify({ error: "rfq_id required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    // Optional short note from the customer — capped and escaped before it
    // ever reaches the admin notification email.
    const note = typeof body?.note === "string" ? body.note.slice(0, 500) : "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: rfq, error: rfqErr } = await supabase
      .from("rfqs")
      .select("id, user_id, status, title, contact_name, contact_email")
      .eq("id", rfq_id)
      .single();

    if (rfqErr || !rfq) {
      return new Response(JSON.stringify({ error: "rfq not found" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (rfq.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const message = note
      ? `Kunden efterfrågar en statusuppdatering: "${note}"`
      : "Kunden efterfrågar en statusuppdatering.";

    const { error: insErr } = await supabase.from("rfq_status_log").insert({
      rfq_id,
      status: rfq.status,
      message,
      triggered_by: "customer",
    });
    if (insErr) throw new Error(`Failed to log status request: ${insErr.message}`);

    // Nattkörningen i customer-flow-tests.yml skapar en riktig rfq-rad och
    // anropar den här funktionen för att prova ÄGARKONTROLLEN — att en ägd
    // rfq_id ger 200 och en främmande ger 403. Den provar inte utskicket.
    // Utan det här undantaget skickades ett "Statusfråga"-mejl till
    // adminlådan varje natt, och 43 sådana hann skickas innan någon
    // kopplade ihop dem med testet. Loggraden skrivs fortfarande, så det
    // testet faktiskt kontrollerar är orört.
    const arProvrad = (rfq.title ?? "").startsWith("[TEST]");

    // Best-effort notification — the request already succeeded from the
    // customer's point of view even if the email send fails.
    if (RESEND_KEY) {
      const ref = rfq_id.slice(0, 8).toUpperCase();
      const html = `
        <p><strong>Kund efterfrågar statusuppdatering</strong></p>
        <p>RFQ #${ref} — ${escapeHtml(rfq.contact_name ?? "")} (${escapeHtml(rfq.contact_email ?? "")})</p>
        <p>Nuvarande status: ${escapeHtml(rfq.status ?? "")}</p>
        ${note ? `<p>Meddelande: "${escapeHtml(note)}"</p>` : ""}
        <p><a href="https://maskinval.se/sv/rfq/${rfq_id}">Öppna förfrågan →</a></p>
      `;
      // En kund kan fråga om status flera gånger, och varje fråga är sin egen
      // händelse -- nyckeln får därför tiden i sig. Det är rätt: två frågor
      // ska ge två mejl, men ett anrop som körs om ska inte ge ett andra.
      await skickaMejl({
        kind: "status_request",
        to: ADMIN_EMAIL,
        subject: `🔔 Statusfråga — RFQ #${ref}`,
        html,
        idempotencyKey: `status_request:${rfq_id}:${new Date().toISOString().slice(0, 16)}`,
        ref: { table: "rfqs", id: rfq_id },
        torrkorning: arProvrad,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("rfq-status-request error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

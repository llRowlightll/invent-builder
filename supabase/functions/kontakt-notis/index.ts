/**
 * kontakt-notis -- mejl till ägaren när någon skriver på kontaktsidan (/talk).
 *
 * Före 2026-11-17 sparades meddelandet "till en människa" i inquiries utan att
 * någon fick veta det; sajten lovar ett personligt svar inom 1–2 arbetsdagar.
 *
 * Anropas av databasen (pg_net, trigger på inquiries). verify_jwt är AV, men
 * anropet betros inte: bara inquiry_id läses, resten läses om ur databasen,
 * och ett mejl går en gång per meddelande (idempotensnyckeln kontakt:<id>).
 * Svarsadressen är kundens, så ägaren kan svara direkt ur inkorgen.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { skickaMejl } from "../_shared/notify.ts";
import { escapeHtml } from "../_shared/html.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "alexandro@maskinval.se";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EPOST = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function svar(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return svar({ fel: "POST" }, 405);
  const b = await req.json().catch(() => ({})) as { inquiry_id?: string };
  const id = String(b.inquiry_id ?? "");
  if (!UUID.test(id)) return svar({ fel: "inquiry_id krävs" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: m } = await db.from("inquiries")
    .select("id, name, email, message, locale, created_at").eq("id", id).maybeSingle();
  if (!m) return svar({ ok: true, hoppade: "inget meddelande" });

  const namn = String(m.name ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 100) || "okänd";
  const kund = String(m.email ?? "").trim();
  const tid = new Date(m.created_at ?? Date.now()).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1f;line-height:1.55">
<p><strong>Nytt meddelande via kontaktsidan</strong> (${escapeHtml(tid)}, språk ${escapeHtml(String(m.locale ?? "sv"))})</p>
<p>Från: ${escapeHtml(namn)} &lt;${escapeHtml(kund)}&gt;</p>
<div style="white-space:pre-wrap;border-left:3px solid #d0d6e2;padding:8px 12px;margin:12px 0;background:#f6f8fb">${escapeHtml(String(m.message ?? ""))}</div>
<p style="color:#555;font-size:13px">Svara på det här mejlet så går svaret till kunden. Sajten lovar svar inom 1–2 arbetsdagar.</p>
</body></html>`;

  const ut = await skickaMejl({
    kind: "kontakt_admin",
    to: ADMIN_EMAIL,
    subject: `Nytt meddelande från ${namn} via kontaktsidan`,
    html,
    idempotencyKey: `kontakt:${id}`,
    replyTo: EPOST.test(kund) ? kund : undefined,
    ref: { table: "inquiries", id },
  });
  return ut.ok ? svar({ ok: true, redanSkickat: ut.redanSkickat }) : svar({ fel: ut.fel }, 502);
});

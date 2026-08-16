/**
 * rfq-notify — körs när en kund skickar en RFQ från maskinbyggaren.
 *
 * Skickar TWO mejl via Resend:
 *   1. Admin-notis  → ADMIN_NOTIFY_EMAIL (intern; default alexandrooden@gmail.com)
 *   2. Orderbekräftelse → kunden (professionell HTML)
 *
 * SECURITY: this endpoint has no auth (verify_jwt=false) because it's called
 * right after an anonymous/just-created RFQ — so it must not trust caller-
 * supplied contact_email/message/items wholesale, or it's an open relay
 * (anyone could make it email arbitrary content to an arbitrary address).
 * Only rfq_id is trusted from the request; everything else is re-read from
 * the rfqs/rfq_items rows that the frontend just inserted, using the
 * service-role client — a caller can only trigger a notification for a
 * real RFQ that genuinely exists, with its real, already-stored content.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API = "https://api.resend.com/emails";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM        = "Maskinval <noreply@maskinval.se>";
// Company notification inbox — configurable so the upcoming firmwide address can
// be set without a code change (Supabase → Edge Functions → Secrets).
const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "alexandrooden@gmail.com";
const SITE        = "https://maskinval.se";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Item { sku: string; name: string; qty: number; unit_price?: number; role?: string; }

interface Payload {
  rfq_id:        string;
  order_ref:     string;
  contact_name:  string;
  contact_email: string;
  contact_phone?: string | null;
  company?:      string | null;
  po_number?:    string | null;
  message:       string;
  items:         Item[];
  total_ex_vat?: number | null;
}

function docRef(rfqId: string) {
  return rfqId.slice(0, 8).toUpperCase();
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("Resend error:", res.status, txt);
  }
  return res.ok;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
const emailWrap = (body: string) => `<!DOCTYPE html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maskinval</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#1e293b;padding:24px 32px;border-radius:12px 12px 0 0;">
    <span style="color:#f59e0b;font-size:22px;font-weight:700;letter-spacing:-0.5px;">M</span>
    <span style="color:#fff;font-size:18px;font-weight:600;margin-left:8px;">Maskinval</span>
    <span style="color:#94a3b8;font-size:12px;margin-left:8px;">· Industriell automation</span>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
    ${body}
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 32px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      © ${new Date().getFullYear()} Maskinval AB · <a href="${SITE}" style="color:#94a3b8;">maskinval.se</a>
      · <a href="${SITE}/sv/privacy" style="color:#94a3b8;">Integritetspolicy</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

function itemsTable(items: Item[]): string {
  if (!items.length) return "";
  const rows = items.map(it => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#6366f1;">${it.sku}</td>
      <td style="padding:10px 12px;font-size:13px;color:#1e293b;">${it.name || it.role || ""}</td>
      <td style="padding:10px 12px;text-align:center;font-size:13px;color:#475569;">${it.qty}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;color:#475569;">
        ${it.unit_price ? (it.unit_price * it.qty).toLocaleString("sv-SE") + " kr" : "—"}
      </td>
    </tr>`).join("");

  return `
  <table width="100%" cellpadding="0" cellspacing="0"
    style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:collapse;margin:16px 0;overflow:hidden;">
    <thead>
      <tr style="background:#f8fafc;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Art.nr</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Benämning</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Ant.</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Pris exkl. moms</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── Customer confirmation email ───────────────────────────────────────────────
function customerHtml(p: Payload): string {
  const total = p.total_ex_vat
    ? `<p style="text-align:right;font-size:13px;margin:4px 0 16px;color:#64748b;">
        Indikativt totalpris exkl. moms: <strong>${p.total_ex_vat.toLocaleString("sv-SE")} kr</strong>
        <br><span style="font-size:11px;">Slutpris bekräftas i orderbekräftelse från oss</span>
       </p>`
    : "";

  return emailWrap(`
    <h1 style="margin:0 0 4px;font-size:22px;color:#1e293b;font-weight:700;">
      Tack för din förfrågan, ${p.contact_name.split(" ")[0]}!
    </h1>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Vi har tagit emot din förfrågan och återkommer inom <strong>1–2 arbetsdagar</strong> med bekräftad leveranstid och slutpris.</p>

    <!-- Reference box -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">Referens</td>
          <td style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">${p.po_number ? "Ditt PO-nummer" : ""}</td>
        </tr>
        <tr>
          <td style="font-size:20px;font-weight:700;font-family:monospace;color:#1e293b;">#${p.order_ref}</td>
          <td style="font-size:16px;font-weight:600;font-family:monospace;color:#6366f1;">${p.po_number ?? ""}</td>
        </tr>
      </table>
    </div>

    <!-- What you ordered -->
    <h2 style="font-size:14px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">Din beställning</h2>
    ${itemsTable(p.items)}
    ${total}

    <!-- Next steps -->
    <div style="background:#eff6ff;border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;padding:14px 16px;margin:24px 0;">
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">Nästa steg</p>
      <ol style="margin:8px 0 0;padding-left:20px;color:#1e40af;font-size:13px;line-height:1.7;">
        <li>Vi verifierar lagerstatus och bekräftar leveranstid</li>
        <li>Du får en orderbekräftelse med exakt pris och leveransdatum</li>
        <li>Leverans sker med DHL eller PostNord — spårningsnummer skickas</li>
        <li>Faktura skickas via mejl med 30 dagars betalningsvillkor</li>
      </ol>
    </div>

    <!-- Contact -->
    <p style="font-size:13px;color:#64748b;margin:0;">
      Frågor? Svara på detta mejl eller kontakta oss på
      <a href="mailto:info@maskinval.se" style="color:#3b82f6;">info@maskinval.se</a>
    </p>
  `);
}

// ── Admin notification email ──────────────────────────────────────────────────
function adminHtml(p: Payload): string {
  return emailWrap(`
    <h2 style="margin:0 0 16px;font-size:18px;color:#1e293b;">🔔 Ny RFQ från maskinbyggaren</h2>

    <table width="100%" cellpadding="0" cellspacing="6" style="margin-bottom:20px;">
      ${[
        ["Referens", `#${p.order_ref}`],
        ["Namn", p.contact_name],
        ["E-post", `<a href="mailto:${p.contact_email}" style="color:#3b82f6;">${p.contact_email}</a>`],
        ["Telefon", p.contact_phone ?? "—"],
        ["Företag", p.company ?? "—"],
        ["PO-nummer", p.po_number ?? "—"],
        ["Totalt exkl. moms", p.total_ex_vat ? p.total_ex_vat.toLocaleString("sv-SE") + " kr" : "—"],
      ].map(([k, v]) => `
        <tr>
          <td style="font-size:12px;color:#94a3b8;white-space:nowrap;padding-right:16px;vertical-align:top;">${k}</td>
          <td style="font-size:13px;color:#1e293b;font-weight:500;">${v}</td>
        </tr>`).join("")}
    </table>

    ${itemsTable(p.items)}

    <div style="margin-top:16px;background:#fef9c3;border-radius:8px;padding:12px 16px;">
      <p style="margin:0;font-size:13px;color:#713f12;">${p.message}</p>
    </div>

    <div style="margin-top:20px;">
      <a href="https://maskinval.se/sv/admin/orders"
        style="display:inline-block;background:#1e293b;color:#fff;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">
        Öppna adminpanel →
      </a>
    </div>
  `);
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { rfq_id } = await req.json();
    if (!rfq_id || typeof rfq_id !== "string") {
      return new Response(JSON.stringify({ error: "rfq_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Only rfq_id is trusted from the request — everything else is re-read from
    // the row the frontend just inserted, so a caller can't make this send
    // arbitrary content to an arbitrary address (see file header).
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const [{ data: rfq, error: rfqErr }, { data: items }] = await Promise.all([
      supabase.from("rfqs").select("*").eq("id", rfq_id).single(),
      supabase.from("rfq_items").select("qty, unit_price, role, products(sku, name)").eq("rfq_id", rfq_id),
    ]);
    if (rfqErr || !rfq) {
      return new Response(JSON.stringify({ error: "rfq not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!rfq.contact_email) {
      return new Response(JSON.stringify({ error: "rfq has no contact_email" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const mappedItems: Item[] = (items ?? []).map((it: Record<string, unknown>) => {
      const product = it.products as { sku?: string; name?: string } | null;
      return {
        sku: product?.sku ?? "—",
        name: product?.name ?? (it.role as string) ?? "",
        qty: (it.qty as number) ?? 1,
        unit_price: it.unit_price as number | undefined,
        role: it.role as string | undefined,
      };
    });
    const totalExVat = mappedItems.reduce((s, it) => s + (it.unit_price ?? 0) * it.qty, 0) || null;

    const payload: Payload = {
      rfq_id,
      order_ref: docRef(rfq_id),
      contact_name: rfq.contact_name ?? "",
      contact_email: rfq.contact_email,
      contact_phone: rfq.contact_phone,
      company: rfq.company,
      po_number: rfq.po_number,
      message: rfq.message ?? "",
      items: mappedItems,
      total_ex_vat: totalExVat,
    };

    // Fire both emails in parallel
    await Promise.all([
      sendEmail(ADMIN_EMAIL,        `🔔 Ny RFQ #${payload.order_ref} — ${payload.contact_name}`, adminHtml(payload)),
      sendEmail(payload.contact_email, `Orderbekräftelse #${payload.order_ref} — Maskinval`,        customerHtml(payload)),
    ]);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

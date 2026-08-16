/**
 * order-status-email — skickas när en RFQ:s eller orders status ändras.
 * Kunden får ett kortfattat statusmejl med relevant info per status.
 *
 * SECURITY: verify_jwt is false — legitimately anonymous callers
 * (offert.$rfqId.tsx, rfq.$rfqId.tsx) fire this right after a customer
 * accepts/declines their own quote, with no session guaranteed at that
 * point. This used to trust the caller's ENTIRE payload — contact_email,
 * amounts, tracking numbers, even the invoice_url behind the "download
 * invoice" button — making it a full open relay (fixed once already, by
 * escaping/restricting what could land in the HTML; this is the deeper fix
 * flagged at the time: who can trigger it, and for which real order).
 *
 * Now the caller sends only { id, kind, locale? } — an rfq_id or order_id
 * and which table it belongs to. Everything else (contact info, amounts,
 * tracking, invoice/oc links) is re-read here from that row using the
 * service-role client, so a caller can only ever trigger a notification
 * that reflects a real row's actual current state — never fabricated
 * content, and never a status transition that didn't really happen (a
 * bonus fix: some frontend callers used to fire this off a client-side
 * `decision` variable without checking whether the DB update it depended on
 * actually succeeded; reading the real row sidesteps that class of bug too).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, safeHref } from "../_shared/html.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RESEND_API = "https://api.resend.com/emails";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM        = "Maskinval <noreply@maskinval.se>";
const SITE        = "https://maskinval.se";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "info@maskinval.se";
const LOCALES = ["sv", "en", "de", "es"];
const RFQ_STATUSES = new Set(["quoted", "accepted", "rejected"]);
const ORDER_STATUSES = new Set(["confirmed", "picking", "shipped", "delivered", "invoiced", "paid", "cancelled"]);

function docRef(id: string) {
  return id.slice(0, 8).toUpperCase();
}

interface Payload {
  order_ref:        string;
  contact_email:    string;
  contact_name:     string;
  status:           string;
  quote_amount?:    number | null;   // for "quoted" status
  po_number?:       string | null;
  estimated_delivery?: string | null;
  tracking_number?: string | null;
  carrier?:         string | null;
  invoice_number?:  string | null;
  invoice_url?:     string | null;
  invoice_due_date?: string | null;
  total_inc_vat?:   number | null;
  currency?:        string;
  locale?:          string;
  oc_url?:          string | null;   // link to the order confirmation page
}

const STATUS_SV: Record<string, { emoji: string; label: string; body: string }> = {
  // ── RFQ statuses ───────────────────────────────────────────────
  quoted: {
    emoji: "📋", label: "Offert skickad",
    body: "Vi har granskat din förfrågan och skickar nu en offert. Se detaljer nedan."
  },
  accepted: {
    emoji: "✅", label: "Accepterad",
    body: "Tack för att du accepterade offerten! Vi bekräftar ordern och återkommer med leveransinfo."
  },
  rejected: {
    emoji: "❌", label: "Avvisad",
    body: "Vi har tyvärr inte möjlighet att lämna offert på denna förfrågan. Kontakta oss om du har frågor."
  },
  // ── Order statuses ─────────────────────────────────────────────
  confirmed: {
    emoji: "✅", label: "Bekräftad",
    body: "Din order är nu bekräftad. Vi förbereder leveransen."
  },
  picking: {
    emoji: "📦", label: "Plockas",
    body: "Vi plockar din order i lagret just nu. Leverans beräknas ske snart."
  },
  shipped: {
    emoji: "🚚", label: "Skickad",
    body: "Din order är skickad!"
  },
  delivered: {
    emoji: "🎉", label: "Levererad",
    body: "Din order är nu levererad. Hoppas allt ser bra ut!"
  },
  invoiced: {
    emoji: "🧾", label: "Fakturerad",
    body: "Din faktura är skickad."
  },
  paid: {
    emoji: "💚", label: "Betald",
    body: "Vi har registrerat din betalning. Tack!"
  },
  cancelled: {
    emoji: "❌", label: "Avbruten",
    body: "Din order har avbrutits. Kontakta oss om du har frågor."
  },
};

const emailWrap = (body: string) => `<!DOCTYPE html>
<html lang="sv"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#1e293b;padding:24px 32px;border-radius:12px 12px 0 0;">
    <span style="color:#f59e0b;font-size:22px;font-weight:700;">M</span>
    <span style="color:#fff;font-size:18px;font-weight:600;margin-left:8px;">Maskinval</span>
  </td></tr>
  <tr><td style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">${body}</td></tr>
  <tr><td style="padding:20px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      © ${new Date().getFullYear()} Maskinval AB · <a href="${SITE}" style="color:#94a3b8;">maskinval.se</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

function buildEmail(p: Payload): { subject: string; html: string } {
  // All caller-supplied strings that land in the HTML go through escapeHtml;
  // invoice_url/oc_url through safeHref (https-only) — see file header.
  const orderRef = escapeHtml(p.order_ref ?? "");
  const poNumber = p.po_number ? escapeHtml(p.po_number) : null;
  const trackingNumber = p.tracking_number ? escapeHtml(p.tracking_number) : null;
  const carrier = p.carrier ? escapeHtml(p.carrier) : null;
  const invoiceNumber = p.invoice_number ? escapeHtml(p.invoice_number) : null;
  const invoiceUrl = safeHref(p.invoice_url);
  const ocUrl = safeHref(p.oc_url);

  const info = STATUS_SV[p.status];
  if (!info) return { subject: `Order #${orderRef} — uppdatering`, html: emailWrap(`<p>Din order #${orderRef} har uppdaterats till: <strong>${escapeHtml(p.status ?? "")}</strong></p>`) };

  const firstName = escapeHtml((p.contact_name ?? "").split(" ")[0]);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("sv-SE", { weekday:"long", month:"long", day:"numeric" });
  const fmtMoney = (n: number) => n.toLocaleString("sv-SE", { style:"currency", currency: p.currency || "SEK", maximumFractionDigits:0 });

  // Extra info blocks per status
  let extra = "";

  if (p.status === "quoted" && p.quote_amount) {
    const fmtMoney2 = (n: number) => n.toLocaleString("sv-SE", { style: "currency", currency: p.currency || "SEK", maximumFractionDigits: 0 });
    extra = `
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:12px;color:#0369a1;font-weight:600;">OFFERTBELOPP (exkl. moms)</p>
      <p style="margin:0 0 12px;font-size:28px;font-weight:700;color:#0c4a6e;">${fmtMoney2(p.quote_amount)}</p>
      <p style="margin:0;font-size:12px;color:#0369a1;">
        Offerten är giltig i 30 dagar. Svara på detta mejl för att acceptera eller ställa frågor.
      </p>
    </div>`;
  }

  if (p.status === "shipped" && (trackingNumber || p.estimated_delivery)) {
    extra = `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:20px 0;">
      ${trackingNumber ? `
        <p style="margin:0 0 4px;font-size:12px;color:#166534;font-weight:600;">SPÅRNINGSNUMMER</p>
        <p style="margin:0 0 12px;font-size:20px;font-weight:700;font-family:monospace;color:#15803d;">${trackingNumber}${carrier ? ` (${carrier})` : ""}</p>` : ""}
      ${p.estimated_delivery ? `
        <p style="margin:0 0 4px;font-size:12px;color:#166534;font-weight:600;">BERÄKNAD LEVERANS</p>
        <p style="margin:0;font-size:14px;color:#166534;">${fmtDate(p.estimated_delivery)}</p>` : ""}
    </div>`;
  }

  if (p.status === "invoiced" || p.status === "confirmed") {
    extra = `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <table width="100%" cellpadding="4" cellspacing="0">
        ${poNumber ? `<tr><td style="font-size:12px;color:#94a3b8;">Ditt PO-nummer</td><td style="font-size:14px;font-weight:600;font-family:monospace;color:#1e293b;">${poNumber}</td></tr>` : ""}
        ${invoiceNumber ? `<tr><td style="font-size:12px;color:#94a3b8;">Fakturanummer</td><td style="font-size:14px;font-weight:600;color:#1e293b;">${invoiceNumber}</td></tr>` : ""}
        ${p.invoice_due_date ? `<tr><td style="font-size:12px;color:#94a3b8;">Förfallodatum</td><td style="font-size:14px;font-weight:600;color:#dc2626;">${fmtDate(p.invoice_due_date)}</td></tr>` : ""}
        ${p.total_inc_vat ? `<tr><td style="font-size:12px;color:#94a3b8;">Att betala (inkl. moms)</td><td style="font-size:16px;font-weight:700;color:#1e293b;">${fmtMoney(p.total_inc_vat)}</td></tr>` : ""}
      </table>
      ${invoiceUrl ? `
        <div style="margin-top:12px;">
          <a href="${invoiceUrl}" style="display:inline-block;background:#1e293b;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">
            📄 Ladda ned faktura
          </a>
        </div>` : ""}
      ${ocUrl && !invoiceUrl ? `
        <div style="margin-top:12px;">
          <a href="${ocUrl}" style="display:inline-block;background:#1e293b;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">
            📄 Visa orderbekräftelse
          </a>
        </div>` : ""}
    </div>`;
  }

  if (p.status === "accepted" && ocUrl) {
    extra = `
    <div style="margin:20px 0;">
      <a href="${ocUrl}" style="display:inline-block;background:#1e293b;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">
        📄 Visa orderbekräftelse
      </a>
    </div>`;
  }

  const html = emailWrap(`
    <div style="font-size:32px;margin-bottom:12px;">${info.emoji}</div>
    <h1 style="margin:0 0 4px;font-size:22px;color:#1e293b;font-weight:700;">
      Order ${info.label.toLowerCase()}
    </h1>
    <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Hej ${firstName},</p>
    <p style="margin:0 0 20px;color:#334155;font-size:15px;">${info.body}</p>

    <!-- Reference -->
    <div style="display:inline-block;background:#f1f5f9;border-radius:6px;padding:6px 14px;margin-bottom:16px;">
      <span style="font-size:12px;color:#94a3b8;">Referens </span>
      <span style="font-size:14px;font-weight:700;font-family:monospace;color:#1e293b;">#${orderRef}</span>
      ${poNumber ? `<span style="font-size:12px;color:#94a3b8;margin-left:12px;">PO </span><span style="font-size:13px;font-family:monospace;color:#6366f1;">${poNumber}</span>` : ""}
    </div>

    ${extra}

    <p style="font-size:13px;color:#64748b;margin:20px 0 0;">
      Frågor? Svara på detta mejl eller kontakta
      <a href="mailto:info@maskinval.se" style="color:#3b82f6;">info@maskinval.se</a>
    </p>
  `);

  return {
    subject: `${info.emoji} Order #${orderRef} — ${info.label}`,
    html,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    const kind = body.kind === "rfq" || body.kind === "order" ? body.kind : "";
    const locale = LOCALES.includes(body.locale) ? body.locale : "sv";
    if (!id || !kind) {
      return new Response(JSON.stringify({ error: "id and kind ('rfq'|'order') required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let payload: Payload;

    if (kind === "rfq") {
      const { data: rfq, error } = await supabase.from("rfqs").select("*").eq("id", id).single();
      if (error || !rfq) {
        return new Response(JSON.stringify({ error: "rfq not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      }
      // Only a real, notification-worthy RFQ status sends anything — this also
      // means a caller can't force a notification for a transition that never
      // actually happened (e.g. respond_to_quote() rejected the update).
      if (!RFQ_STATUSES.has(rfq.status) || !rfq.contact_email) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      let ocUrl: string | null = null;
      if (rfq.status === "accepted") {
        const { data: order } = await supabase.from("orders").select("id").eq("rfq_id", id).maybeSingle();
        if (order) ocUrl = `${SITE}/${locale}/oc/${order.id}`;
      }
      payload = {
        order_ref: docRef(id),
        contact_email: rfq.contact_email,
        contact_name: rfq.contact_name ?? "",
        status: rfq.status,
        quote_amount: rfq.quote_amount,
        po_number: rfq.po_number,
        currency: rfq.quote_currency ?? "SEK",
        oc_url: ocUrl,
      };
    } else {
      const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).single();
      if (error || !order) {
        return new Response(JSON.stringify({ error: "order not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!ORDER_STATUSES.has(order.status) || !order.customer_email) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      payload = {
        order_ref: docRef(id),
        contact_email: order.customer_email,
        contact_name: order.customer_name ?? "",
        status: order.status,
        po_number: order.po_number,
        estimated_delivery: order.estimated_delivery,
        tracking_number: order.tracking_number,
        carrier: order.carrier,
        invoice_number: order.invoice_number,
        invoice_url: order.invoice_url,
        invoice_due_date: order.invoice_due_date,
        total_inc_vat: order.total_inc_vat,
        currency: order.currency ?? "SEK",
        oc_url: `${SITE}/${locale}/oc/${id}`,
      };
    }

    const { subject, html } = buildEmail(payload);

    // BCC admin on quote + acceptance so they see both sides of the conversation
    const bcc = (payload.status === "quoted" || payload.status === "accepted") ? [ADMIN_EMAIL] : undefined;

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: payload.contact_email, bcc, subject, html }),
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, data }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

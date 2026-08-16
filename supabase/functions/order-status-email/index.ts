/**
 * order-status-email — skickas av admin när orderstatus ändras.
 * Kunden får ett kortfattat statusmejl med relevant info per status.
 *
 * SECURITY: verify_jwt is false and there's no auth check — legitimately
 * anonymous callers (offert.$rfqId.tsx, rfq.$rfqId.tsx) fire this right after
 * a customer accepts/declines their own quote, with no session guaranteed at
 * that point. That means the whole Payload below is caller-supplied and
 * unverified, not just contact_email/status. Every string field that lands in
 * the HTML is now escaped, and invoice_url/oc_url are restricted to https —
 * before this, anyone could POST here and get a genuine "Maskinval" email,
 * with a fabricated amount and a "📄 Ladda ned faktura" button pointing
 * anywhere, sent to any address. Closing *that* (who can trigger this, and
 * for which real order) needs re-deriving the payload from a trusted
 * order_id/rfq_id server-side instead of trusting the client's copy — same
 * pattern as rfq-notify — across all 6 call sites; flagged as a follow-up,
 * not done here.
 */
import { escapeHtml, safeHref } from "../_shared/html.ts";

const RESEND_API = "https://api.resend.com/emails";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM        = "Maskinval <noreply@maskinval.se>";
const SITE        = "https://maskinval.se";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "info@maskinval.se";

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
    const payload: Payload = await req.json();
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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { skickaMejl } from "../_shared/notify.ts";
import { escapeHtml } from "../_shared/html.ts";

/**
 * welcome-email — sends the "Välkommen till Maskinval" onboarding email.
 *
 * Called from two places:
 *   - signup.tsx, right after a real signup (fire-and-forget). No auth check
 *     is possible here: Supabase may require email confirmation, in which case
 *     there is no session yet at this point — so verify_jwt must stay false,
 *     and there's no trusted ID to re-derive a recipient from either (unlike
 *     rfq-notify/order-status-email, which anchor to a real rfq/order row).
 *   - admin.crm.tsx's "send test email" button (an admin testing the template
 *     against an arbitrary address) — previously "gated" by an x-hook-secret
 *     header the deployed code never actually read (dead check either side).
 *
 * SECURITY: this file previously didn't exist in the repo — it was deployed
 * directly (drifted from source control) with `name` interpolated into the
 * email HTML unescaped. That let anyone make Maskinval's own transactional
 * sender inject arbitrary markup/links into a "Maskinval"-branded email sent
 * to any address — phishing-as-a-service riding this domain's sender
 * reputation. Fixed by always HTML-escaping name.
 *
 * Texten 2026-11-17: länkarna gick till workers.dev-adressen, "tusentals
 * produkter" (katalogen har ≈ 800), "ett team av ingenjörer" (en människa
 * och AI, som Om oss säger) och "kontot är aktiverat" innan bekräftelsen.
 *
 * Residual, NOT fixed here: any caller can still trigger the canned template
 * for an arbitrary recipient (spam/reputation risk, no longer an injection
 * risk). Closing that needs either verifying the confirmation-email setting
 * is off (session would then always exist here) or moving the trigger
 * server-side (a DB hook on auth.users insert) — flagged for the user, not
 * done speculatively.
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Was "onboarding@resend.dev" (Resend's sandbox domain) — Resend silently
// restricts sandbox sends to only the account owner's own address, so this
// email has never actually reached a real signup. maskinval.se is verified
// (rfq-notify/order-status-email already send from it successfully), so
// matching that fixes delivery, not just the injection issue below.
const FROM = "Maskinval <info@maskinval.se>";
const BASE_URL = "https://maskinval.se";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildHtml(name: string, locale: string = "sv"): string {
  const lang = ["sv", "en", "de", "es"].includes(locale) ? locale : "sv";
  const startUrl = `${BASE_URL}/${lang}/products`;
  const chatUrl  = `${BASE_URL}/${lang}/chat`;
  const talkUrl = `${BASE_URL}/${lang}/talk`;
  const firstName = name?.split(" ")[0] || "där";

  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Välkommen till Maskinval</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">Din AI-drivna komponentkatalog — med en människa bakom.</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f9;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

<!-- Header -->
<tr><td style="background:#1F3864;padding:36px 40px 28px;text-align:center;">
  <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;"><tr>
    <td style="background:#E8752A;border-radius:10px;width:44px;height:44px;text-align:center;vertical-align:middle;"><span style="font-size:24px;font-weight:900;color:#ffffff;line-height:44px;display:block;">M</span></td>
    <td style="padding-left:12px;vertical-align:middle;"><span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-.5px;">Maskinval</span></td>
  </tr></table>
  <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;line-height:1.3;">Välkommen, ${firstName}! 👋</h1>
  <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,.75);line-height:1.5;">Tack för att du registrerade dig — här är allt du behöver veta.</p>
  <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.6);line-height:1.5;">Har du inte bekräftat din e-postadress än? Klicka först på länken i bekräftelsemejlet.</p>
</td></tr>

<!-- Intro -->
<tr><td style="padding:36px 40px 24px;">
  <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Maskinval är din smarta katalog för industriell automation — byggd för maskinkonstruktörer, inköpare och tekniker som arbetar med Festo, SMC, AVENTICS, Parker, Camozzi, Metal Work, Norgren och Bosch Rexroth.</p>
  <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">Vi kombinerar en katalog med drygt 800 artiklar i åtta fabrikat med AI, så att du hittar rätt komponent, räknar fram rätt cylinderstorlek och bygger en stycklista på minuter i stället för timmar.</p>
</td></tr>

<tr><td style="padding:0 40px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

<!-- Features -->
<tr><td style="padding:28px 40px 8px;">
  <p style="margin:0 0 20px;font-size:12px;font-weight:700;color:#6b7280;letter-spacing:.15em;text-transform:uppercase;">Vad kan du göra?</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding-bottom:16px;vertical-align:top;"><table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:14px;vertical-align:top;"><div style="width:40px;height:40px;background:#EFF6FF;border-radius:10px;text-align:center;line-height:40px;font-size:18px;">🔍</div></td>
      <td style="vertical-align:top;"><p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#111827;">AI-sökning</p><p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Beskriv vad du behöver på vanlig svenska — AI:n letar bland drygt 800 artiklar och förklarar varför.</p></td>
    </tr></table></td></tr>
    <tr><td style="padding-bottom:16px;vertical-align:top;"><table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:14px;vertical-align:top;"><div style="width:40px;height:40px;background:#F0FDF4;border-radius:10px;text-align:center;line-height:40px;font-size:18px;">⚙️</div></td>
      <td style="vertical-align:top;"><p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#111827;">Dimensionering &amp; fysikberäkning</p><p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Ange last och tryck — cylinderräknaren visar minsta borrning och vilka cylindrar som räcker.</p></td>
    </tr></table></td></tr>
    <tr><td style="padding-bottom:16px;vertical-align:top;"><table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:14px;vertical-align:top;"><div style="width:40px;height:40px;background:#FFF7ED;border-radius:10px;text-align:center;line-height:40px;font-size:18px;">📊</div></td>
      <td style="vertical-align:top;"><p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#111827;">Jämför produkter</p><p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Ställ komponenter mot varandra — bra när du väljer mellan fabrikat.</p></td>
    </tr></table></td></tr>
    <tr><td style="padding-bottom:8px;vertical-align:top;"><table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:14px;vertical-align:top;"><div style="width:40px;height:40px;background:#FFF1F2;border-radius:10px;text-align:center;line-height:40px;font-size:18px;">📋</div></td>
      <td style="vertical-align:top;"><p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#111827;">Stycklista &amp; offertförfrågan</p><p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Bygg din inköpslista och skicka offertförfrågan med ett klick.</p></td>
    </tr></table></td></tr>
  </table>
</td></tr>

<!-- CTA -->
<tr><td style="padding:24px 40px 32px;text-align:center;">
  <a href="${startUrl}" style="display:inline-block;background:#1F3864;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;">Utforska katalogen →</a><br>
  <a href="${chatUrl}" style="display:inline-block;margin-top:10px;color:#1F3864;text-decoration:none;font-size:13px;font-weight:600;">✦ Testa AI-ingenjören</a>
</td></tr>

<tr><td style="padding:0 40px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

<!-- Human support -->
<tr><td style="padding:28px 40px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F0FDF4;border-radius:10px;border:1px solid #BBF7D0;"><tr><td style="padding:20px 24px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="vertical-align:top;padding-right:16px;width:40px;">
        <div style="width:40px;height:40px;background:#D1FAE5;border-radius:50%;text-align:center;line-height:40px;font-size:20px;">👷</div>
      </td>
      <td style="vertical-align:top;">
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#065F46;">Vi finns här — på riktigt</p>
        <p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6;">Bakom AI:n finns en människa som läser varje fråga. Undrar du något om produktval, dimensionering eller priser? Du får ett personligt svar inom 1–2 arbetsdagar.</p>
        <a href="${talkUrl}" style="display:inline-block;background:#065F46;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 18px;border-radius:6px;">👷 Skicka en fråga till oss</a>
        <span style="display:inline-block;margin-left:12px;font-size:12px;color:#6b7280;">eller <a href="mailto:info@maskinval.se" style="color:#065F46;text-decoration:none;font-weight:600;">info@maskinval.se</a></span>
      </td>
    </tr></table>
  </td></tr></table>
</td></tr>

<tr><td style="padding:0 40px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

<!-- CEO note -->
<tr><td style="padding:28px 40px 32px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
    <td style="padding-right:16px;vertical-align:top;width:56px;">
      <div style="width:52px;height:52px;background:#1F3864;border-radius:50%;text-align:center;line-height:52px;"><span style="font-size:22px;font-weight:900;color:#E8752A;">A</span></div>
    </td>
    <td style="vertical-align:top;">
      <p style="margin:0 0 10px;font-size:14px;color:#374151;line-height:1.7;font-style:italic;">&ldquo;Vi byggde Maskinval för att göra det enklare för ingenjörer att hitta rätt komponent — men vi vet att teknik aldrig ersätter en bra mänsklig dialog. Tveka inte att höra av dig, vi svarar alltid personligen.&rdquo;</p>
      <p style="margin:0;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Alexandro</strong> — grundare, Maskinval</p>
    </td>
  </tr></table>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;border-radius:0 0 12px 12px;">
  <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">Maskinval • Industriell automationskatalog</p>
  <p style="margin:0;font-size:12px;color:#9ca3af;">Du får detta mejl för att du registrerade ett konto på Maskinval.</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  try {
    const { email, name, locale } = await req.json();
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ error: "Missing or invalid email" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.warn("[welcome-email] RESEND_API_KEY not set");
      return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const safeName = escapeHtml(typeof name === "string" ? name : "");
    const firstName = safeName.split(" ")[0] || "";
    const subject = firstName ? `Välkommen till Maskinval, ${firstName}! 🎉` : "Välkommen till Maskinval! 🎉";

    // Nyckeln är adressen: ett välkomstmejl per konto, hur många gånger
    // funktionen än råkar anropas vid registreringen.
    const svar = await skickaMejl({
      kind: "welcome",
      to: email,
      subject,
      html: buildHtml(safeName, locale || "sv"),
      idempotencyKey: `welcome:${String(email).toLowerCase()}`,
    });
    if (!svar.ok) {
      return new Response(JSON.stringify({ error: svar.fel }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, redanSkickat: svar.redanSkickat }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[welcome-email] Exception:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

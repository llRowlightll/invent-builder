/**
 * supplier-po — inköpsordern som PDF, och som mejl till leverantören.
 *
 * SÄKERHET: verify_jwt är på, och requireAdmin kräver dessutom admin-rollen.
 * Funktionen läser ALDRIG innehåll ur anropet: bara spo_id är betrott, resten
 * hämtas ur databasen med service-nyckeln. En anropare kan alltså bara skicka
 * en inköpsorder som verkligen finns, med dess verkliga innehåll, till den
 * adress som står på leverantören -- inte till en adress den själv hittar på.
 *
 * DUBBELSKICK: sent_at reserveras FÖRE utskicket och nollställs om Resend
 * misslyckas. Två klick samtidigt kan därför inte lägga samma order två gånger
 * hos leverantören -- och det är den allvarligare riktningen att ha fel på.
 *
 * Inköpspriser lämnar systemet här. Mottagaren är leverantören själv, som
 * redan känner sina egna priser; mejlet går bara till suppliers.order_email.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { byggPoDokument, faarSkickas, amnesrad, type PoForetag } from "./po-document.ts";
import { renderaPoPdf } from "./pdf.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API = "https://api.resend.com/emails";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("SUPPLIER_PO_FROM") ?? "Maskinval <noreply@maskinval.se>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORETAG_FALLBACK: PoForetag = {
  name: "Maskinval AB", org: "", address: "", postal: "",
  email: "info@maskinval.se", phone: "", web: "maskinval.se", vat: "",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function hamtaForetag(db: any): Promise<PoForetag> {
  const { data } = await db.from("site_content").select("key, value").like("key", "company.%");
  const rader = (data ?? []) as Array<{ key: string; value: string | null }>;
  const karta = new Map<string, string>(rader.map((r) => [r.key, r.value ?? ""]));
  const v = (k: string, fallback: string) => (karta.get(`company.${k}`) || fallback);
  return {
    name: v("name", FORETAG_FALLBACK.name),
    org: v("org", ""),
    address: v("address", ""),
    postal: v("postal", ""),
    email: v("email", FORETAG_FALLBACK.email),
    phone: v("phone", ""),
    web: v("web", FORETAG_FALLBACK.web),
    vat: v("vat", ""),
  };
}

function base64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function mejlHtml(poNumber: string, foretag: PoForetag, leverantorsNamn: string, kundnummer: string | null): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1f;line-height:1.55">
<p>Hej ${leverantorsNamn},</p>
<p>Bifogat finner ni vår inköpsorder <strong>${poNumber}</strong>${kundnummer ? ` (vårt kundnummer hos er: ${kundnummer})` : ""}.</p>
<p><strong>Ange ${poNumber} i ämnesraden när ni svarar.</strong> Det är så er bekräftelse hittar tillbaka till rätt order hos oss.</p>
<p>Bekräfta gärna per rad: artikelnummer, antal, pris och leveransdatum. Hör av er om något i ordern behöver ändras innan ni bekräftar.</p>
<p>Med vänlig hälsning<br>${foretag.name}<br>${foretag.email}${foretag.phone ? ` &middot; ${foretag.phone}` : ""}</p>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  let body: { spo_id?: string; action?: string; bekrafta_varningar?: boolean; skicka_om?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ fel: "Trasig JSON i anropet." }, 400);
  }

  const spoId = (body.spo_id ?? "").trim();
  const action = body.action ?? "preview";
  if (!spoId) return json({ fel: "spo_id saknas." }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: spo, error: spoFel } = await db
    .from("supplier_purchase_orders")
    .select("*, suppliers(*), orders(order_number)")
    .eq("id", spoId)
    .maybeSingle();
  if (spoFel) return json({ fel: spoFel.message }, 500);
  if (!spo) return json({ fel: "Inköpsordern finns inte." }, 404);

  const { data: rader } = await db
    .from("supplier_purchase_order_items")
    .select("line_no, sku, supplier_sku, name, qty, unit_purchase_price, line_total_ex_vat")
    .eq("spo_id", spoId)
    .order("line_no");

  const s = spo as Record<string, unknown>;
  const lev = (s.suppliers ?? null) as Record<string, unknown> | null;

  const dok = byggPoDokument({
    huvud: {
      po_number: s.po_number as string | null,
      created_at: s.created_at as string,
      expected_delivery: s.expected_delivery as string | null,
      currency: (s.currency as string) ?? "SEK",
      status: s.status as string,
      sent_at: s.sent_at as string | null,
      needs_review: Boolean(s.needs_review),
      review_reason: s.review_reason as string | null,
    },
    leverantor: lev
      ? {
          name: lev.name as string,
          is_active: Boolean(lev.is_active),
          order_email: lev.order_email as string | null,
          customer_number: lev.customer_number as string | null,
          currency: lev.currency as string | null,
          payment_terms: lev.payment_terms as string | null,
          incoterms: lev.incoterms as string | null,
          agreement_status: lev.agreement_status as string | null,
          contact_name: lev.contact_name as string | null,
          contact_email: lev.contact_email as string | null,
          min_order_value: lev.min_order_value as number | null,
        }
      : null,
    rader: (rader ?? []) as never,
    kundorder: { order_number: ((s.orders as { order_number?: string } | null)?.order_number) ?? null },
    foretag: await hamtaForetag(db),
  });

  if (action === "check") {
    const beslut = faarSkickas(dok, { sent_at: s.sent_at as string | null }, {
      bekraftaVarningar: body.bekrafta_varningar, skickaOm: body.skicka_om,
    });
    return json({ po_number: dok.poNumber, hinder: dok.hinder, varningar: dok.varningar, beslut, amnesrad: amnesrad(dok) });
  }

  if (action === "preview") {
    const pdf = await renderaPoPdf(dok);
    return new Response(pdf.buffer as ArrayBuffer, {
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${dok.poNumber}.pdf"`,
      },
    });
  }

  if (action !== "send") return json({ fel: `Okänd action: ${action}` }, 400);

  const beslut = faarSkickas(dok, { sent_at: s.sent_at as string | null }, {
    bekraftaVarningar: body.bekrafta_varningar, skickaOm: body.skicka_om,
  });
  if (!beslut.ok) {
    return json({ ok: false, skal: beslut.skal, kan_bekraftas: beslut.kanBekraftas, varningar: dok.varningar, hinder: dok.hinder }, 409);
  }
  if (!RESEND_KEY) {
    return json({ ok: false, skal: "RESEND_API_KEY saknas i funktionens miljö -- inget mejl kan skickas." }, 503);
  }

  const till = (dok.leverantor!.order_email ?? "").trim();
  const tidigareStatus = (s.status as string) ?? "draft";

  // PDF:en först: går renderingen fel ska ingenting ha reserverats.
  const pdf = await renderaPoPdf(dok);

  // Reservera FÖRE utskicket. Två samtidiga klick: bara det ena får en rad
  // tillbaka, det andra ser 0 och avbryter.
  const reservation = db
    .from("supplier_purchase_orders")
    .update({ sent_at: new Date().toISOString(), sent_to: till, sent_method: "email", status: "sent" })
    .eq("id", spoId);
  const { data: reserverad, error: resFel } = await (body.skicka_om
    ? reservation.select("id")
    : reservation.is("sent_at", null).select("id"));
  if (resFel) return json({ ok: false, skal: resFel.message }, 500);
  if (!reserverad || reserverad.length === 0) {
    return json({ ok: false, skal: "Inköpsordern hann skickas av någon annan.", kan_bekraftas: false }, 409);
  }

  const svar = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: till,
      reply_to: dok.foretag.email,
      subject: amnesrad(dok),
      html: mejlHtml(dok.poNumber, dok.foretag, dok.leverantor!.name, dok.leverantor!.customer_number),
      attachments: [{ filename: `${dok.poNumber}.pdf`, content: base64(pdf) }],
    }),
  });

  if (!svar.ok) {
    const text = await svar.text();
    // Rulla tillbaka reservationen: ingenting gick iväg, och nästa försök ska
    // inte mötas av "redan skickad". Statusen återställs till den den HADE --
    // "draft" hade varit fel för en inköpsorder som skickas om.
    await db.from("supplier_purchase_orders")
      .update({
        sent_at: (s.sent_at as string | null) ?? null,
        sent_to: (s.sent_to as string | null) ?? null,
        sent_method: (s.sent_method as string | null) ?? null,
        status: tidigareStatus,
      })
      .eq("id", spoId);
    return json({ ok: false, skal: `Resend avvisade utskicket: ${text.slice(0, 300)}` }, 502);
  }

  return json({ ok: true, po_number: dok.poNumber, skickad_till: till, varningar: dok.varningar });
});

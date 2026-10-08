/**
 * fortnox-order — Fas 3
 * Skapar en inköpsorder i Fortnox från en vunnen affär.
 *
 * Credentials att sätta i Supabase Secrets:
 *   FORTNOX_CLIENT_ID      — OAuth2 client ID
 *   FORTNOX_CLIENT_SECRET  — OAuth2 client secret
 *   FORTNOX_ACCESS_TOKEN   — Aktuell access token (uppdateras via refresh)
 *   FORTNOX_REFRESH_TOKEN  — Refresh token
 *
 * Auth: verify_jwt (admin only, via has_role RPC — see _shared/admin-auth.ts).
 *
 * Fortnox API-dokumentation: https://apps.fortnox.se/apidocs
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/admin-auth.ts";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FORTNOX_CLIENT_ID          = Deno.env.get("FORTNOX_CLIENT_ID") ?? "";
const FORTNOX_CLIENT_SECRET      = Deno.env.get("FORTNOX_CLIENT_SECRET") ?? "";
// Används BARA för att så raden i integration_tokens första gången. Efter det
// äger tabellen sanningen, eftersom Fortnox roterar refresh-token.
const FORTNOX_REFRESH_SEED       = Deno.env.get("FORTNOX_REFRESH_TOKEN") ?? "";
const FN_BASE                    = "https://api.fortnox.se/3";
const FN_TOKEN_URL               = "https://apps.fortnox.se/oauth-v1/token";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function fnHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

/**
 * Giltig access token, förnyad vid behov.
 *
 * Fortnox access token lever en timme och refresh-token ROTERAR: varje
 * förnyelse ger ett nytt och ogiltigförklarar det gamla. Det nya måste därför
 * skrivas tillbaka direkt, annars är kedjan bruten för gott och någon får
 * logga in i utvecklarportalen och börja om.
 *
 * Miljövariabeln FORTNOX_REFRESH_TOKEN sår bara raden första gången.
 */
interface TokenRad {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
}

/**
 * Bara det den här funktionen faktiskt rör. De genererade databastyperna
 * känner inte integration_tokens (tabellen är nyare än typgenereringen), och
 * en bred any här hade dolt fel i resten av filen.
 */
interface TokenLager {
  from(tabell: "integration_tokens"): {
    select(kolumner: string): {
      eq(kolumn: string, varde: string): { maybeSingle(): Promise<{ data: TokenRad | null }> };
    };
    upsert(rad: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  };
}

async function giltigToken(
  db: TokenLager,
): Promise<{ token: string } | { fel: string }> {
  const { data: rad } = await db
    .from("integration_tokens").select("access_token, refresh_token, expires_at")
    .eq("provider", "fortnox").maybeSingle();

  // Marginal: en token som går ut om trettio sekunder hinner löpa ut mitt i
  // anropet, och då hade felet sett ut som ett API-fel i stället för ett
  // utgånget token.
  const marginalMs = 120_000;
  if (rad?.access_token && rad.expires_at &&
      new Date(rad.expires_at).getTime() - Date.now() > marginalMs) {
    return { token: rad.access_token };
  }

  const refresh = rad?.refresh_token || FORTNOX_REFRESH_SEED;
  if (!refresh) {
    return { fel: "Inget refresh-token. Sätt FORTNOX_REFRESH_TOKEN i Supabase Secrets en gång, sedan sköter tabellen resten." };
  }
  if (!FORTNOX_CLIENT_ID || !FORTNOX_CLIENT_SECRET) {
    return { fel: "FORTNOX_CLIENT_ID eller FORTNOX_CLIENT_SECRET saknas i Supabase Secrets." };
  }

  const svar = await fetch(FN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${FORTNOX_CLIENT_ID}:${FORTNOX_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  });
  const kropp = await svar.json().catch(() => ({}));
  if (!svar.ok || !kropp.access_token) {
    const fel = `Fortnox förnyelse misslyckades (${svar.status}): ${JSON.stringify(kropp).slice(0, 300)}`;
    await db.from("integration_tokens").upsert({
      provider: "fortnox", last_error: fel, updated_at: new Date().toISOString(),
    });
    return { fel };
  }

  // Det NYA refresh-token skrivs i samma andetag. Faller det här ledet är
  // nästa förnyelse död, så det får inte vara best-effort.
  const { error: skrivFel } = await db.from("integration_tokens").upsert({
    provider: "fortnox",
    access_token: kropp.access_token,
    refresh_token: kropp.refresh_token ?? refresh,
    expires_at: new Date(Date.now() + (Number(kropp.expires_in) || 3600) * 1000).toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  if (skrivFel) {
    return { fel: `Kunde inte spara det nya refresh-token (${skrivFel.message}). Avbryter hellre än att bränna det.` };
  }
  return { token: kropp.access_token as string };
}

function mapSkuToFortnox(sku: string): string {
  return sku.replace(/\s+/g, "-").slice(0, 50);
}

/** Fraktraden till Fortnox: frakten är ett belopp på ordern, ingen orderrad. */
const FRAKTARTIKEL = "FRAKT";

async function ensureFortnoxArticle(token: string, sku: string, description: string) {
  const fnSku = mapSkuToFortnox(sku);
  const checkRes = await fetch(
    `${FN_BASE}/articles/${encodeURIComponent(fnSku)}`,
    { headers: fnHeaders(token) }
  );
  if (checkRes.ok) return fnSku;

  const createRes = await fetch(`${FN_BASE}/articles`, {
    method: "POST",
    headers: fnHeaders(token),
    body: JSON.stringify({
      Article: {
        ArticleNumber: fnSku,
        Description: description.slice(0, 100),
        // Frakt är en tjänst, inget lagerförs.
        Type: sku === FRAKTARTIKEL ? "SERVICE" : "STOCK",
        Unit: "ST",
      },
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Fortnox create article failed: ${await createRes.text()}`);
  }
  return fnSku;
}

async function createFortnoxOrder(
  token: string,
  referens: string,
  items: Array<{ sku: string; qty: number; description: string; pris?: number | null }>,
) {
  const orderRows = await Promise.all(
    items.map(async (item) => {
      const fnSku = await ensureFortnoxArticle(token, item.sku, item.description);
      return {
        ArticleNumber: fnSku,
        OrderedQuantity: item.qty,
        Description: item.description.slice(0, 100),
        // Priset är en ÖGONBLICKSBILD ur orderraden, inte ett uppslag mot
        // katalogen. Ordern är sanningen om vad kunden ska betala.
        ...(item.pris != null ? { Price: item.pris } : {}),
      };
    })
  );

  const orderRes = await fetch(`${FN_BASE}/orders`, {
    method: "POST",
    headers: fnHeaders(token),
    body: JSON.stringify({
      Order: {
        Comments: referens,
        OrderRows: orderRows,
      },
    }),
  });
  if (!orderRes.ok) {
    throw new Error(`Fortnox create order failed: ${await orderRes.text()}`);
  }
  const data = await orderRes.json();
  return data.Order.DocumentNumber as string;
}

// ─ Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const body = await req.json().catch(() => ({}));
  const { order_id, rfq_id } = body;
  if (!order_id && !rfq_id) {
    return new Response(JSON.stringify({ error: "order_id eller rfq_id krävs" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = await giltigToken(supabase as unknown as TokenLager);
  if ("fel" in token) {
    return new Response(JSON.stringify({ error: token.fel }), {
      status: 503, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ORDERN är källan, inte offerten.
  //
  // Funktionen läste tidigare rfq_items. Det var rimligt innan ordermotorn
  // fanns, men nu är ordern sanningen om vad kunden ska betala: dess rader
  // bär frysta priser och namn som inte rör sig när katalogen ändras. En
  // offert kan dessutom ändras efter att den accepterats, och då hade Fortnox
  // fått ett annat belopp än kunden sagt ja till.
  //
  // rfq_id tas fortfarande emot och slås upp till sin order, så den gamla
  // knappen i admin fortsätter fungera.
  const { data: order } = order_id
    ? await supabase.from("orders").select("id, order_number, customer_name, customer_company, customer_org_nr, po_number, rfq_id, freight_ex_vat").eq("id", order_id).maybeSingle()
    : await supabase.from("orders").select("id, order_number, customer_name, customer_company, customer_org_nr, po_number, rfq_id, freight_ex_vat").eq("rfq_id", rfq_id).maybeSingle();

  if (!order) {
    return new Response(
      JSON.stringify({
        error: rfq_id
          ? "Offerten har ingen order ännu. Skapa ordern först -- Fortnox ska spegla ordern, inte förfrågan."
          : "Ordern finns inte.",
      }),
      { status: 404, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const { data: rader } = await supabase
    .from("order_items")
    .select("sku, name, qty, unit_price_ex_vat")
    .eq("order_id", order.id)
    .order("line_no", { ascending: true });

  if (!rader?.length) {
    return new Response(JSON.stringify({ error: "Ordern har inga rader." }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const items = rader.map((row: Record<string, unknown>) => ({
    sku: (row.sku as string) ?? "UNKNOWN",
    qty: (row.qty as number) ?? 1,
    description: (row.name as string) ?? "",
    pris: (row.unit_price_ex_vat as number | null) ?? null,
  }));
  // Frakten (villkoren avsnitt 3) som egen fakturarad.
  const frakt = Number((order as { freight_ex_vat?: number | null }).freight_ex_vat ?? 0);
  if (frakt > 0) items.push({ sku: FRAKTARTIKEL, qty: 1, description: "Frakt", pris: frakt });

  try {
    const referens = `Maskinval ${order.order_number ?? order.id}` +
                     (order.po_number ? ` · kundens PO ${order.po_number}` : "");
    const orderNumber = await createFortnoxOrder(token.token, referens, items);

    await supabase.from("orders").update({
      fortnox_order_id: orderNumber,
    }).eq("id", order.id);

    if (order.rfq_id) {
      await supabase.from("rfqs").update({
        fortnox_order_id: orderNumber,
        integration_synced_at: new Date().toISOString(),
      }).eq("id", order.rfq_id);
    }

    await supabase.from("integration_logs").insert({
      source: "fortnox",
      event: "order_created",
      ref_id: order.id,
      payload: body,
      response: { orderNumber, order_number: order.order_number },
      success: true,
    });

    return new Response(
      JSON.stringify({ ok: true, orderNumber }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errMsg = String(err);
    await supabase.from("integration_logs").insert({
      source: "fortnox",
      event: "order_created",
      ref_id: order.id,
      payload: body,
      success: false,
      error: errMsg,
    });
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

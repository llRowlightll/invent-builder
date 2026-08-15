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
const FORTNOX_ACCESS_TOKEN       = Deno.env.get("FORTNOX_ACCESS_TOKEN") ?? "";
const FN_BASE                    = "https://api.fortnox.se/3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function fnHeaders() {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${FORTNOX_ACCESS_TOKEN}`,
  };
}

function mapSkuToFortnox(sku: string): string {
  return sku.replace(/\s+/g, "-").slice(0, 50);
}

async function ensureFortnoxArticle(sku: string, description: string) {
  const fnSku = mapSkuToFortnox(sku);
  const checkRes = await fetch(
    `${FN_BASE}/articles/${encodeURIComponent(fnSku)}`,
    { headers: fnHeaders() }
  );
  if (checkRes.ok) return fnSku;

  const createRes = await fetch(`${FN_BASE}/articles`, {
    method: "POST",
    headers: fnHeaders(),
    body: JSON.stringify({
      Article: {
        ArticleNumber: fnSku,
        Description: description.slice(0, 100),
        Type: "STOCK",
        Unit: "ST",
      },
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Fortnox create article failed: ${await createRes.text()}`);
  }
  return fnSku;
}

async function createFortnoxOrder(rfqId: string, items: Array<{ sku: string; qty: number; description: string }>) {
  const orderRows = await Promise.all(
    items.map(async (item) => {
      const fnSku = await ensureFortnoxArticle(item.sku, item.description);
      return {
        ArticleNumber: fnSku,
        OrderedQuantity: item.qty,
        Description: item.description.slice(0, 100),
      };
    })
  );

  const orderRes = await fetch(`${FN_BASE}/orders`, {
    method: "POST",
    headers: fnHeaders(),
    body: JSON.stringify({
      Order: {
        Comments: `Maskinval RFQ ${rfqId}`,
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

  if (!FORTNOX_ACCESS_TOKEN) {
    return new Response(
      JSON.stringify({ error: "FORTNOX_ACCESS_TOKEN saknas. Sätt den i Supabase Secrets." }),
      { status: 503, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { rfq_id } = body;
  if (!rfq_id) {
    return new Response(JSON.stringify({ error: "rfq_id krävs" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: rfqItems } = await supabase
    .from("rfq_items")
    .select("qty, role, products(sku, name)")
    .eq("rfq_id", rfq_id);

  if (!rfqItems?.length) {
    return new Response(JSON.stringify({ error: "Inga rader i RFQ" }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const items = rfqItems.map((row: any) => ({
    sku: row.products?.sku ?? "UNKNOWN",
    qty: row.qty ?? 1,
    description: row.products?.name ?? row.role ?? "",
  }));

  try {
    const orderNumber = await createFortnoxOrder(rfq_id, items);

    await supabase.from("rfqs").update({
      fortnox_order_id: orderNumber,
      integration_synced_at: new Date().toISOString(),
    }).eq("id", rfq_id);

    await supabase.from("integration_logs").insert({
      source: "fortnox",
      event: "order_created",
      ref_id: rfq_id,
      payload: body,
      response: { orderNumber },
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
      ref_id: rfq_id,
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

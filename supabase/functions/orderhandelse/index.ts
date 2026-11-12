/**
 * orderhandelse -- mejlet till kunden vid varje steg i orderns resa.
 *
 * Anropas av databasen (pg_net, skicka_orderhandelse) när en order skapas,
 * när leverantören bekräftat, när en försändelse registreras och när ordern
 * är levererad. verify_jwt är AV, men anropet betros inte: bara order_id,
 * händelsen och försändelsens id läses, allt annat läses om ur databasen
 * (orderns_resa), och ett mejl går bara om händelsen faktiskt har inträffat --
 * en gång per händelse (notifications.idempotency_key).
 *
 * "mottagen" skickas inte för en accepterad offert: kunden får redan
 * offertacceptens mejl (order-status-email, med länken till spårningen).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { skickaMejl } from "../_shared/notify.ts";
import { borSkickas, byggMejl, idempotensnyckel, type Handelse, type Resa } from "./mejl.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HANDELSER = new Set(["mottagen", "bekraftad", "skickad", "levererad"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function svar(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return svar({ fel: "POST" }, 405);
  const b = await req.json().catch(() => ({})) as { order_id?: string; handelse?: string; shipment_id?: string | null };
  const orderId = String(b.order_id ?? "");
  const handelse = String(b.handelse ?? "") as Handelse;
  const shipmentId = b.shipment_id && UUID.test(String(b.shipment_id)) ? String(b.shipment_id) : null;
  if (!UUID.test(orderId) || !HANDELSER.has(handelse)) return svar({ fel: "order_id och handelse krävs" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: order } = await db.from("orders").select("id, customer_email, rfq_id").eq("id", orderId).maybeSingle();
  if (!order?.customer_email) return svar({ ok: true, hoppade: "ingen order eller ingen e-post" });

  if (handelse === "mottagen" && order.rfq_id) {
    const { data: rfq } = await db.from("rfqs").select("intent").eq("id", order.rfq_id).maybeSingle();
    if (rfq && rfq.intent !== "order") return svar({ ok: true, hoppade: "offertaccepten har redan mejlats" });
  }

  const { data: resa, error } = await db.rpc("orderns_resa", { p_order_id: orderId });
  if (error || !resa) return svar({ fel: error?.message ?? "ingen resa" }, 500);
  const r = resa as Resa;
  if (!borSkickas(r, handelse, shipmentId)) return svar({ ok: true, hoppade: "händelsen har inte inträffat" });

  const { amne, html } = byggMejl(r, handelse, orderId, shipmentId);
  const ut = await skickaMejl({
    kind: "order_resa",
    to: order.customer_email,
    subject: amne,
    html,
    idempotencyKey: idempotensnyckel(orderId, handelse, shipmentId),
    ref: { table: "orders", id: orderId },
  });
  return svar({ ok: ut.ok, redanSkickat: ut.redanSkickat, fel: ut.fel });
});

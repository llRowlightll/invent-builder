import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShipmentRequest {
  rfq_id: string;
  weight_kg?: number;
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  service?: "mypack_collect" | "business_parcel" | "parcel";
}

// Determine best PostNord service based on weight
function selectService(weight_kg: number): string {
  if (weight_kg <= 20) return "mypack_collect";
  return "business_parcel";
}

// Calculate total weight from RFQ items product data
async function calcWeight(supabase: any, rfq_id: string): Promise<number> {
  const { data: items } = await supabase
    .from("rfq_items")
    .select("qty, product:products(weight_kg)")
    .eq("rfq_id", rfq_id);

  if (!items?.length) return 1.0;
  return items.reduce((sum: number, item: any) => {
    const w = item.product?.weight_kg ?? 0.5;
    return sum + (w * (item.qty ?? 1));
  }, 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // SECURITY: verify_jwt=true only proves the caller is SOME logged-in user —
  // booking a real, paid shipment for any rfq_id is an admin action, not
  // something any authenticated customer should be able to trigger.
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: ShipmentRequest = await req.json();
    const { rfq_id } = body;

    if (!rfq_id) throw new Error("rfq_id is required");

    // Fetch RFQ + customer profile
    const { data: rfq, error: rfqErr } = await supabase
      .from("rfqs")
      .select("*, company:company_profiles(display_name, company_name, address_street, address_postal, address_city, address_country, phone, email)")
      .eq("id", rfq_id)
      .single();

    if (rfqErr || !rfq) throw new Error(`RFQ not found: ${rfqErr?.message}`);

    const weight = body.weight_kg ?? await calcWeight(supabase, rfq_id);
    const service = body.service ?? selectService(weight);

    // PostNord API credentials from env
    const PN_API_KEY = Deno.env.get("POSTNORD_API_KEY");
    const PN_CUSTOMER_NUMBER = Deno.env.get("POSTNORD_CUSTOMER_NUMBER");
    const PN_SENDER_NAME = Deno.env.get("POSTNORD_SENDER_NAME") ?? "Maskinval AB";
    const PN_SENDER_STREET = Deno.env.get("POSTNORD_SENDER_STREET") ?? "Industrivägen 1";
    const PN_SENDER_POSTAL = Deno.env.get("POSTNORD_SENDER_POSTAL") ?? "11230";
    const PN_SENDER_CITY = Deno.env.get("POSTNORD_SENDER_CITY") ?? "Stockholm";

    const company = rfq.company;

    // Build PostNord shipment order payload
    const pnPayload = {
      shipment: {
        orderReference: rfq_id.slice(0, 16),
        sender: {
          quickAddressCode: PN_CUSTOMER_NUMBER,
          name: PN_SENDER_NAME,
          address: { streetName: PN_SENDER_STREET, city: PN_SENDER_CITY, postalCode: PN_SENDER_POSTAL, countryCode: "SE" },
        },
        receiver: {
          name: company?.company_name || company?.display_name || rfq.contact_name || "Kund",
          address: {
            streetName: company?.address_street ?? "Okänd",
            city: company?.address_city ?? "Stockholm",
            postalCode: company?.address_postal ?? "00000",
            countryCode: (company?.address_country ?? "SE").slice(0, 2).toUpperCase(),
          },
          contact: {
            name: company?.display_name ?? rfq.contact_name ?? "",
            email: company?.email ?? rfq.contact_email ?? "",
            phone: company?.phone ?? "",
          },
          notification: { email: company?.email ?? rfq.contact_email ?? "" },
        },
        parcels: [{
          copies: 1,
          weight: { value: Math.max(weight, 0.1), unit: "kg" },
          ...(body.length_mm ? {
            dimension: { length: body.length_mm, width: body.width_mm ?? 200, height: body.height_mm ?? 200 }
          } : {}),
        }],
        serviceCode: service,
        labelFormat: "PDF",
      },
    };

    // If no PostNord API key, run in simulation mode
    let trackingNumber: string;
    let labelUrl: string | null = null;
    let rawResponse: any;

    if (!PN_API_KEY) {
      // Simulation: generate fake tracking number
      trackingNumber = `SIM-${Date.now().toString(36).toUpperCase()}`;
      rawResponse = { simulated: true, service, weight, payload: pnPayload };
    } else {
      const pnRes = await fetch(
        "https://atapi2.postnord.com/rest/shipment/v5/shipment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": PN_API_KEY,
          },
          body: JSON.stringify(pnPayload),
        }
      );
      rawResponse = await pnRes.json();
      if (!pnRes.ok) throw new Error(`PostNord error ${pnRes.status}: ${JSON.stringify(rawResponse)}`);

      const item = rawResponse?.compositeShipmentResponse?.shipmentResult?.[0];
      trackingNumber = item?.primaryTrackingNumber ?? item?.parcels?.[0]?.trackingNumber ?? "";

      // Label PDF — base64 if present
      const labelBase64 = item?.label?.[0]?.base64EncodedLabel;
      if (labelBase64) {
        const stored = await supabase.storage
          .from("shipment-labels")
          .upload(`${rfq_id}/${trackingNumber}.pdf`, Uint8Array.from(atob(labelBase64), c => c.charCodeAt(0)), {
            contentType: "application/pdf", upsert: true,
          });
        if (!stored.error) {
          const { data: urlData } = supabase.storage.from("shipment-labels").getPublicUrl(`${rfq_id}/${trackingNumber}.pdf`);
          labelUrl = urlData.publicUrl;
        }
      }
    }

    // Estimate delivery: 1-3 business days
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + (service === "mypack_collect" ? 3 : 2));

    // Save shipment record
    const { data: shipment, error: shipErr } = await supabase.from("shipments").insert({
      rfq_id,
      carrier: "postnord",
      service_code: service,
      tracking_number: trackingNumber,
      label_url: labelUrl,
      weight_kg: weight,
      raw_response: rawResponse,
      status: "booked",
    }).select().single();

    if (shipErr) throw new Error(`Failed to save shipment: ${shipErr.message}`);

    // Update RFQ with tracking info
    await supabase.from("rfqs").update({
      shipment_status: "shipped",
      carrier: "postnord",
      tracking_number: trackingNumber,
      label_url: labelUrl,
      shipped_at: new Date().toISOString(),
      estimated_delivery: estimatedDelivery.toISOString().split("T")[0],
    }).eq("id", rfq_id);

    // Log to integration_logs
    await supabase.from("integration_logs").insert({
      source: "postnord",
      event: "shipment_booked",
      ref_id: rfq_id,
      payload: pnPayload,
      response: rawResponse,
      success: true,
    });

    return new Response(JSON.stringify({
      success: true,
      tracking_number: trackingNumber,
      label_url: labelUrl,
      service,
      weight_kg: weight,
      estimated_delivery: estimatedDelivery.toISOString().split("T")[0],
      shipment_id: shipment.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("book-shipment error:", err);

    // Log failure
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("integration_logs").insert({
        source: "postnord", event: "shipment_error",
        payload: null, response: null, success: false, error: err.message,
      });
    } catch (_) {}

    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

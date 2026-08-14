import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// SECURITY: both of these were hardcoded fallbacks before (a live HubSpot API key,
// and a guessable webhook secret) - a real credential sitting in deployed source,
// and the ONLY auth gate on this endpoint (verify_jwt is false) defaulting to a
// public string. Fail closed on both - no fallback values.
const HUBSPOT_API_KEY           = Deno.env.get("HUBSPOT_API_KEY") ?? "";
const HOOK_SECRET               = Deno.env.get("HUBSPOT_HOOK_SECRET");
const HS_BASE                   = "https://api.hubapi.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-hook-secret",
};

function hsHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${HUBSPOT_API_KEY}`,
  };
}

// ─ HubSpot helpers ─────────────────────────────────────────────────
async function upsertContact(email: string, name: string, company: string) {
  // Try to find existing contact first
  const searchRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: hsHeaders(),
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email", "firstname", "lastname", "company"],
      limit: 1,
    }),
  });
  const searchData = await searchRes.json();
  if (searchData.results?.length > 0) {
    return searchData.results[0].id as string;
  }

  // Create new contact
  const [firstname, ...rest] = (name || "Unknown").split(" ");
  const lastname = rest.join(" ") || "-";
  const createRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: hsHeaders(),
    body: JSON.stringify({
      properties: { email, firstname, lastname, company },
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`HubSpot contact create failed: ${err}`);
  }
  const contact = await createRes.json();
  return contact.id as string;
}

async function createDeal(
  contactId: string,
  company: string,
  message: string,
  rfqId: string
) {
  const dealRes = await fetch(`${HS_BASE}/crm/v3/objects/deals`, {
    method: "POST",
    headers: hsHeaders(),
    body: JSON.stringify({
      properties: {
        dealname:    `Maskinval offert — ${company || "Okänt företag"}`,
        dealstage:   "appointmentscheduled",
        pipeline:    "default",
        description: message || "",
      },
    }),
  });
  if (!dealRes.ok) {
    const err = await dealRes.text();
    throw new Error(`HubSpot deal create failed: ${err}`);
  }
  const deal = await dealRes.json();
  const dealId = deal.id as string;

  await fetch(
    `${HS_BASE}/crm/v4/objects/deals/${dealId}/associations/contacts/${contactId}`,
    {
      method: "PUT",
      headers: hsHeaders(),
      body: JSON.stringify([{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }]),
    }
  );

  return dealId;
}

// ─ Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const secret = req.headers.get("x-hook-secret");
  if (!HOOK_SECRET || secret !== HOOK_SECRET) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { rfq_id, contact_name, contact_email, company, message } = body;

  if (!contact_email) {
    return new Response(JSON.stringify({ error: "Missing contact_email" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const contactId = await upsertContact(contact_email, contact_name ?? "", company ?? "");
    const dealId = await createDeal(contactId, company ?? "", message ?? "", rfq_id ?? "");

    if (rfq_id) {
      await supabase.from("rfqs").update({
        hubspot_contact_id: contactId,
        hubspot_deal_id:    dealId,
        integration_synced_at: new Date().toISOString(),
        integration_error: null,
      }).eq("id", rfq_id);
    }

    await supabase.from("integration_logs").insert({
      source:  "hubspot",
      event:   "rfq_created",
      ref_id:  rfq_id ?? null,
      payload: body,
      response: { contactId, dealId },
      success: true,
    });

    console.log(`✓ HubSpot: contact=${contactId}, deal=${dealId}`);
    return new Response(
      JSON.stringify({ ok: true, contactId, dealId }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errMsg = String(err);
    console.error("HubSpot sync error:", errMsg);

    if (rfq_id) {
      await supabase.from("rfqs").update({
        integration_error: errMsg,
        integration_synced_at: new Date().toISOString(),
      }).eq("id", rfq_id);
    }

    await supabase.from("integration_logs").insert({
      source:  "hubspot",
      event:   "rfq_created",
      ref_id:  rfq_id ?? null,
      payload: body,
      success: false,
      error:   errMsg,
    });

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

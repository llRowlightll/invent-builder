/**
 * document-ai — Extracts structured data from uploaded documents/images
 * using Claude vision. Supports three modes:
 *   "po"       — Customer purchase order → extract PO#, org.nr, company, delivery, items
 *   "quote"    — Supplier quote → extract prices per line item
 *   "identify" — Component/machine photo → identify + suggest products
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5"; // Fast + cheap for extraction tasks

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS = {
  po: `You are a document data extraction assistant. The user has uploaded a Purchase Order (PO) document.

Extract all relevant fields and return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "po_number": "string or null",
  "company_name": "string or null",
  "org_number": "string or null",
  "contact_name": "string or null",
  "contact_email": "string or null",
  "contact_phone": "string or null",
  "billing_address": {
    "street": "string or null",
    "postal": "string or null",
    "city": "string or null",
    "country": "string or null"
  },
  "delivery_date": "ISO date string or null",
  "payment_terms": "string or null",
  "items": [
    { "description": "string", "qty": number, "unit": "string or null", "unit_price": number or null, "total": number or null }
  ],
  "notes": "any special instructions or null",
  "currency": "string e.g. SEK EUR USD or null"
}

If a field is not present in the document, use null. For org_number, look for Swedish format (XXXXXX-XXXX) or similar company registration numbers.`,

  quote: `You are a procurement data extraction assistant. The user has uploaded a supplier quote/offer.

Extract pricing information and return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "supplier_name": "string or null",
  "quote_reference": "string or null",
  "valid_until": "ISO date string or null",
  "currency": "string or null",
  "delivery_weeks": "string or null",
  "payment_terms": "string or null",
  "items": [
    {
      "article_number": "string or null",
      "description": "string",
      "qty": number,
      "unit_price_ex_vat": number or null,
      "total_ex_vat": number or null,
      "delivery_time": "string or null",
      "note": "string or null"
    }
  ],
  "total_ex_vat": number or null,
  "notes": "string or null"
}`,

  identify: `You are an industrial automation expert. The user has uploaded an image of a component, machine, or technical drawing.

Analyze the image and return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "identified": true/false,
  "component_type": "e.g. pneumatic cylinder, linear actuator, valve, sensor, etc.",
  "manufacturer": "string or null",
  "model_number": "string or null",
  "description": "2-3 sentence description of what this is and what it does",
  "specifications": {
    "bore_mm": number or null,
    "stroke_mm": number or null,
    "voltage": "string or null",
    "ip_rating": "string or null",
    "other": { }
  },
  "condition": "new / used / damaged / unknown",
  "damage_description": "string or null — describe visible damage/wear if any",
  "replacement_search": "best search query to find a replacement in a product catalog",
  "category_slug": "one of: pneumatic-cylinders, linear-actuators, grippers, valves, sensors, or null",
  "urgency": "critical / normal / planned",
  "recommendation": "brief recommendation for next steps"
}`
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 503, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  let body: { data: string; mime_type: string; mode: "po" | "quote" | "identify" };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const { data, mime_type, mode } = body;
  if (!data || !mode) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: data, mode" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const prompt = PROMPTS[mode];
  if (!prompt) {
    return new Response(
      JSON.stringify({ error: `Unknown mode: ${mode}` }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  try {
    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mime_type || "image/jpeg",
                  data,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error("Anthropic API error:", err);
      return new Response(
        JSON.stringify({ error: "AI extraction failed", detail: err }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const result = await anthropicRes.json() as {
      content: Array<{ type: string; text: string }>;
    };
    const text = result.content?.[0]?.text ?? "";

    // Parse the JSON out of the response
    let parsed: unknown;
    try {
      // Strip any accidental markdown fences
      const clean = text.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // If JSON parse fails, return the raw text so the client can handle it
      parsed = { raw: text };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("document-ai error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

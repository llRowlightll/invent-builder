import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// SECURITY: no hardcoded fallback — a live secret was hardcoded here before and
// exposed in source. Fail closed (empty string -> Groq call 401s) instead of a key.
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://buqfbcztspswezwyafxo.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cWZiY3p0c3Bzd2V6d3lhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDY2NjksImV4cCI6MjA5NDEyMjY2OX0.U3MdNO-2XXDNjtiIBbfiC9TRiLoPY94afwp9-MF2HME";
// llama-3.3-70b-versatile decommissioned by Groq 2026-08-16 -> openai/gpt-oss-120b.
const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Product {
  sku: string;
  name: string;
  family: string;
  category: string;
  brand: string;
  key_specs: Record<string, unknown>;
}

/** Detect relevant category slugs from free-text query */
function detectCategories(query: string): string[] {
  const t = query.toLowerCase();
  const cats = new Set<string>();
  if (/cylind|kolvdiameter|kolvkraft|pneumatisk|ISO 15552|DSBC|DNC|kompakt/i.test(t)) cats.add("cylinder");
  if (/elektrisk|servo|linjär|stepper|elaktuator/i.test(t)) cats.add("electric-actuator");
  if (/linj.r.*modul|modul|slide|guide|rail/i.test(t)) cats.add("linear-module");
  if (/roter|svängcylinder|rotary|vrid/i.test(t)) cats.add("rotary-actuator");
  if (/vakuum|sugg|vacuum|sug/i.test(t)) cats.add("vacuum");
  if (/gripper|kläm|grib|gripdon/i.test(t)) cats.add("gripper");
  if (/ventil|valve|solenoid|pneumatisk styrning/i.test(t)) cats.add("valve");
  if (/sensor|prox|BERO|detek|avstånd|position/i.test(t)) cats.add("sensor");
  if (/filter|regul|FRL|luftberedning|air prep/i.test(t)) cats.add("air-preparation");
  if (cats.size === 0) cats.add("cylinder"); // most common default
  return Array.from(cats);
}

async function fetchProducts(categories: string[], limit = 25): Promise<Product[]> {
  const results = await Promise.all(
    categories.map(async (slug) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fetch_products_for_advisor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ p_category_slug: slug, p_limit: limit }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    })
  );
  return results.flat() as Product[];
}

async function searchKnowledge(query: string, limit = 4): Promise<string> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_knowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ query_text: query, match_limit: limit }),
    });
    if (!res.ok) return "";
    const chunks = await res.json();
    if (!Array.isArray(chunks) || chunks.length === 0) return "";
    return chunks
      .map((c: { content: string; source?: string }) => `[${c.source ?? "doc"}] ${c.content}`)
      .join("\n---\n");
  } catch {
    return "";
  }
}

async function rerank(
  query: string,
  products: Product[],
  pdfContext: string,
  limit: number
): Promise<Array<{ sku: string; name: string; category: string; brand: string; match_reason: string; score: number }>> {
  if (products.length === 0) return [];

  const productList = products
    .map((p) => `${p.sku}: ${p.name} [${p.category}] brand=${p.brand}`)
    .join("\n");

  const messages = [
    {
      role: "system",
      content: `Du är en teknisk sökmotor för industriella komponenter. Hitta och ranka de produkter som bäst matchar sökningen. Returnera exakt JSON:\n{ "results": [ { "sku": "...", "name": "...", "category": "...", "brand": "...", "match_reason": "Kort motivering på svenska", "score": 0-100 } ] }${pdfContext ? `\n\nTeknisk referens:\n${pdfContext}` : ""}`,
    },
    {
      role: "user",
      content: `Sökfråga: "${query}"\n\nProdukter att bedöma (välj de ${limit} bästa):\n${productList}`,
    },
  ];

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: 1200,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    // Fallback: return products as-is
    return products.slice(0, limit).map((p) => ({
      sku: p.sku, name: p.name, category: p.category, brand: p.brand,
      match_reason: "", score: 70,
    }));
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return (parsed.results ?? []).slice(0, limit);
  } catch {
    return products.slice(0, limit).map((p) => ({
      sku: p.sku, name: p.name, category: p.category, brand: p.brand,
      match_reason: "", score: 70,
    }));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const { query, limit = 10 } = await req.json();
    if (!query || typeof query !== "string") {
      return Response.json({ error: "query is required" }, { status: 400, headers: CORS });
    }

    const categories = detectCategories(query);
    const [products, pdfContext] = await Promise.all([
      fetchProducts(categories, 30),
      searchKnowledge(query, 4),
    ]);

    const results = await rerank(query, products, pdfContext, limit);

    return Response.json(
      { query, results, pdf_context_found: pdfContext.length > 0 },
      { headers: CORS }
    );
  } catch (e) {
    console.error("ai-search error:", e);
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});

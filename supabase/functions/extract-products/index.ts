/**
 * extract-products — AI extraction of catalog PRODUCTS from supplier catalog text
 * (typically PDF text pasted by the client).
 *
 * POST { text } → { products: ParsedProduct[] }
 *
 * Mirrors extract-prices, but returns full product records (sku/name/brand_slug/
 * category_slug/family/description/ip_rating/fieldbus/voltage) for the admin
 * import preview. The valid brand + category slugs are injected into the prompt so
 * the model maps to slugs the importer accepts; invalid ones are dropped here too.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SB_URL   = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedProduct {
  sku: string; name: string; brand_slug: string; category_slug: string;
  family: string; description: string; ip_rating: string; fieldbus: string; voltage: string;
}

async function fetchSlugs(): Promise<{ brands: { slug: string; name: string }[]; categories: { slug: string; name: string }[] }> {
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  const [b, c] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/brands?select=slug,name&order=slug`, { headers }),
    fetch(`${SB_URL}/rest/v1/categories?select=slug,name&order=slug`, { headers }),
  ]);
  return { brands: await b.json(), categories: await c.json() };
}

async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0.05, max_tokens: 8000, messages }),
  });
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "[]";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json() as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return Response.json({ products: [] }, { headers: CORS });

    const { brands, categories } = await fetchSlugs();
    const brandSlugs = brands.map((b) => b.slug).join(", ");
    const catLines = categories.map((c) => `${c.slug} — ${c.name}`).join("\n");

    const systemPrompt = `You are a product-catalog extraction assistant for an industrial automation distributor in Sweden.
Extract EVERY distinct product / order code from the supplier catalog text below.

OUTPUT: return ONLY a raw JSON array — no markdown fences, no prose.
Format per item:
{"sku":"...","name":"...","brand_slug":"...","category_slug":"...","family":"...","description":"...","ip_rating":"...","fieldbus":"...","voltage":"..."}

Rules:
- sku: the manufacturer order/type code; prefix with the brand for uniqueness (e.g. "FESTO-EMMT-AS"). Must be unique.
- brand_slug: EXACTLY one of: ${brandSlugs}
- category_slug: EXACTLY one slug from the list below — pick the best fit.
- family: the product series (e.g. EMMT-AS, CMMT-AS, CPX-E).
- description: a SHORT Swedish description (≤160 chars): what it is + key specs.
- ip_rating / fieldbus / voltage: fill if stated in the text, else "".
- For a configurable product FAMILY, emit ONE row for the family unless distinct order codes are clearly listed.
- Only real products. Skip prices, marketing text, accessory-spanner/tool tables, and tables of contents.
- If nothing usable, return [].

CATEGORIES (slug — name):
${catLines}`;

    const userMsg = `Extract all products from this supplier catalog text:\n\n${text.slice(0, 40000)}`;

    const raw = await callGroq([
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMsg },
    ]);

    const brandSet = new Set(brands.map((b) => b.slug));
    const catSet = new Set(categories.map((c) => c.slug));
    let products: ParsedProduct[] = [];
    try {
      const clean = raw.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
      const arr = JSON.parse(clean) as Partial<ParsedProduct>[];
      const seen = new Set<string>();
      products = arr
        .filter((p) => p.sku && p.name && p.brand_slug && p.category_slug
          && brandSet.has(p.brand_slug) && catSet.has(p.category_slug))
        .filter((p) => { const k = p.sku!.trim(); if (seen.has(k)) return false; seen.add(k); return true; })
        .map((p) => ({
          sku: p.sku!.trim(), name: p.name!.trim(),
          brand_slug: p.brand_slug!, category_slug: p.category_slug!,
          family: (p.family ?? "").trim(), description: (p.description ?? "").trim(),
          ip_rating: (p.ip_rating ?? "").trim(), fieldbus: (p.fieldbus ?? "").trim(), voltage: (p.voltage ?? "").trim(),
        }));
    } catch (e) {
      console.error("JSON parse error:", e, "\nRaw:", raw.slice(0, 300));
    }

    return Response.json({ products }, { headers: CORS });
  } catch (err) {
    console.error("extract-products error:", err);
    return Response.json({ error: String(err), products: [] }, { status: 500, headers: CORS });
  }
});

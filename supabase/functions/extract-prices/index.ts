/**
 * extract-prices — AI-driven price extraction from text / email / PDF text.
 *
 * POST { text: string }
 * → { proposals: Proposal[] }
 *
 * The caller sends free-form text (pasted email, quote body, PDF text).
 * This function:
 *   1. Fetches the full product catalog from Supabase (sku + name + brand).
 *   2. Sends the text + catalog to Groq (openai/gpt-oss-120b — llama-3.3-70b-versatile
 *      was decommissioned by Groq 2026-08-16).
 *   3. Returns structured price proposals for admin confirmation.
 */

const GROQ_URL  = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY  = Deno.env.get("GROQ_API_KEY") ?? "";
const SB_URL    = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface Proposal {
  sku:            string;
  name:           string;
  brand:          string;
  purchase_price: number;
  confidence:     "high" | "medium" | "low";
  evidence:       string;   // the raw text that triggered this match
  currency_note?: string;   // e.g. "converted from EUR @ 11.5"
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function fetchProducts(): Promise<{ sku: string; name: string; brand: string }[]> {
  const res = await fetch(
    `${SB_URL}/rest/v1/products?select=sku,name,brands(name)&order=name&limit=2000`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  const raw = await res.json() as { sku: string; name: string; brands?: { name: string } }[];
  return raw.map((p) => ({ sku: p.sku, name: p.name, brand: p.brands?.name ?? "" }));
}

async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model:       "openai/gpt-oss-120b",
      temperature: 0.05,
      max_tokens:  4096,
      messages,
    }),
  });
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "[]";
}

// ── main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json() as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return Response.json({ proposals: [] }, { headers: CORS });

    const products = await fetchProducts();

    // Compact catalog: one line per product (max ~6 000 tokens for 700 products)
    const catalog = products
      .map((p) => `${p.sku}\t${p.brand}\t${p.name}`)
      .join("\n");

    const systemPrompt = `You are a price extraction assistant for an industrial automation distributor in Sweden.
Your job: extract NET PURCHASE PRICES (inköpspriser) from supplier quotes / emails / price lists.

OUTPUT: return ONLY a raw JSON array — no markdown fences, no explanation.
Format: [{"sku":"...","purchase_price":1234.50,"confidence":"high","evidence":"...","currency_note":"..."}]

Rules:
- sku must exactly match one of the SKUs in the catalog below
- purchase_price is the unit NET price the distributor pays, in SEK
  - If currency is EUR, multiply by 11.5
  - If currency is USD, multiply by 10.5
  - If currency is already SEK, use as-is
- confidence:
    "high"   = SKU or part number directly matched in document
    "medium" = product name / description matched
    "low"    = inferred / partial match (only include if fairly certain)
- evidence: the raw text snippet (≤80 chars) that led to this match
- currency_note: empty string if SEK, else e.g. "converted EUR→SEK ×11.5"
- Skip any product not in the catalog
- Return [] if nothing found

CATALOG (tab-separated: SKU | Brand | Name):
${catalog}`;

    const userMsg = `Extract all purchase prices from this document:\n\n${text}`;

    const raw = await callGroq([
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMsg },
    ]);

    // Parse — strip any accidental markdown fences
    let proposals: Proposal[] = [];
    try {
      const clean = raw.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
      const arr = JSON.parse(clean) as {
        sku: string; purchase_price: number; confidence: string;
        evidence: string; currency_note?: string;
      }[];

      proposals = arr
        .filter((item) => item.sku && !isNaN(Number(item.purchase_price)) && Number(item.purchase_price) > 0)
        .map((item) => {
          const p = products.find((x) => x.sku === item.sku);
          return {
            sku:            item.sku,
            name:           p?.name  ?? item.sku,
            brand:          p?.brand ?? "",
            purchase_price: Number(item.purchase_price),
            confidence:     (["high","medium","low"].includes(item.confidence) ? item.confidence : "medium") as Proposal["confidence"],
            evidence:       item.evidence ?? "",
            currency_note:  item.currency_note ?? "",
          };
        });
    } catch (e) {
      console.error("JSON parse error:", e, "\nRaw:", raw.slice(0, 300));
    }

    return Response.json({ proposals }, { headers: CORS });
  } catch (err) {
    console.error("extract-prices error:", err);
    return Response.json({ error: String(err), proposals: [] }, { status: 500, headers: CORS });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// v40 — SERVER-SIDE DETERMINISTIC ARCHITECTURE: scoreProduct() + buildMandatoryBomRows() ensure correct BOM even when LLM is rate-limited. handleBom() builds skeleton first, LLM only writes title/explanation/extras. handleOptions() server-selects top 3 products, LLM writes badge/why/pros/cons only.
// v39 — T09: catalogSkus filter; T11: ventilramp detection + valve terminal injection; T12: FRL injection; T14: family warning; T17: extractPerAxisStrokes axis key fix; T19: questions≤6; T08: needsHighSpeed detects mm/s≥1000; T20: directional valve injection
// v38 — normalizeKeySpecs(): unify 5 stroke keys→stroke_mm, bore variants→bore_mm, compute force_n from bore; isFamilyProduct() detects FESTO-*/SMC-* families; SKU validation replaces hallucinated BOM SKUs with SPECIFY; richer product list sent to LLM
// v37 — extractMinStroke: exclude "NNN mm/s" (speed) from stroke extraction — prevents 400mm/s overriding 200mm stroke
// v36 — BOM completeness: inject end-position sensors when detection requested but absent from BOM; rule 9 in system prompt
// v35 — Fix duplicate questions: add server-side dedup by id+label, add explicit "no duplicate" rule to prompt
// v34 — Fix all remaining engineering issues:
//   1. Horizontal precision filter (≤0.1mm removes belt+pneumatic for ALL axes, not just vertical)
//   2. High-speed hard pre-filter: ball screws removed from catalog when speed>0.8m/s AND precision=0
//   3. BOM electric servo + vertical → inject SPECIFY brake motor row (not pneumatic check valve)
//   4. Terminology fix: forbid "rack-and-pinion/kuggstång" for precision; define "ball screw = kulskruv"
//   5. Multi-axis prompt: X-axis high speed → belt; Z-axis precision → ball screw (differentiated)
//   6. Post-process: belt drive at ≤0.1mm → CRITICAL FAILURE badge (backlash violation)
//   7. requirementLines: merged vertical+precision rule to cover all axes
//   8. BOM: SPECIFY rows now have explicit material/spec justification; check-valve vs brake-motor logic
// v33 — Hard engineering-logic layer: precision×vertical pre-filter (removes pneumatic+belt when
//        ≤0.1 mm + vertical), extractPrecisionMm detector, isBeltDrivenProduct, isPneumaticActuator,
//        isAllowedForPrecisionVertical; 7-step self-validation system prompt; per-axis BOM rules;
//        post-process: remove rodless cylinders from vertical precision apps
// v32 — V10/10 questions upgrade: SIL/PL + NSF-H1 questions when vertical+washdown detected;
//        buildCustomSolutionOption now generates context-specific product-family recommendations
//        (SMC HY, Parker P1S, Bosch Rexroth EMC-HD-XC, two architectural paths for washdown+vertical)
// v31 — V10/10 upgrade: dryroom/battery detector (Cu/Zn/Ni ban), ball-screw×high-speed post-filter,
//        upgraded system prompt to "Unbeatable Automation Engineer" spec with strict numerical validation
// v30 — switch back to Groq (new account key, generous quota) — faster latency than Gemini
// v29 — switch LLM provider from Groq to Google Gemini 2.0 Flash (OpenAI-compatible API)
//        Groq free tier: 100K tokens/day. Gemini free tier: 1500 req/day + 1M tokens/min — far more generous.
// v28 — fix parseProductTempMax regression: "5-60°C" parsed max=5 (treated hyphen as negative sign)
//        → all standard products filtered out → only CUSTOM-SOLUTION shown for any application.
//        Fix: split on range separators first, then extract digits, avoiding sign confusion.
// v27 — hard numerical temperature validation (catches hallucinated "✓ Hög temperaturbeständighet")
// v26 — Proactive safety: 13 new hazard detectors (vertical load, high/low temp, hydraulic, high force,
//        oxygen-clean, high-cycle, high-speed, SIL, outdoor, pharma/GMP, ATEX dust Zone 20/21/22)
// v25 — ATEX/EX-zone safety block: three-layer filter prevents electric components in explosive atmospheres
// v24 — fix "same answer regardless of input" bug
// Root cause: detectCategories always fell back to ["cylinder"] → same 45 catalog products → Groq at temp 0.2 always picked same 3.
// Fix: sort catalog by stroke-match relevance, reduce to 25 products, temperature 0.35 for options, requirements block at top of system prompt.
// Inherits v23: SKU validation in options, primarySku guaranteed first in BOM.
// Inherits v22: washdown/food-grade environment support.

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
// Primary: 70b for full engineering quality. Fast: 8b fallback (500K TPD separate pool)
const LLM_MODEL = "llama-3.3-70b-versatile";
const LLM_MODEL_FAST = "llama-3.1-8b-instant";
const LLM_URL = "https://api.groq.com/openai/v1/chat/completions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// callGroq: tries primary model first, falls back to fast model on 429
async function callGroq(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 2000,
  jsonMode = true,
  temperature = 0.2,
  model = LLM_MODEL
): Promise<string | null> {
  const tryModel = async (m: string): Promise<{ ok: boolean; text: string; rateLimited: boolean }> => {
    const body: Record<string, unknown> = { model: m, messages, max_tokens: maxTokens, temperature };
    if (jsonMode) body.response_format = { type: "json_object" };
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("LLM error:", res.status, m, text.slice(0, 200));
      return { ok: false, text, rateLimited: res.status === 429 };
    }
    return { ok: true, text, rateLimited: false };
  };

  // 1. Try primary model
  const primary = await tryModel(model);
  if (primary.ok) {
    const data = JSON.parse(primary.text);
    return data.choices?.[0]?.message?.content ?? null;
  }

  // 2. If rate-limited AND primary wasn't already the fast model, retry with fast model
  if (primary.rateLimited && model !== LLM_MODEL_FAST) {
    console.log("Primary model rate-limited, falling back to", LLM_MODEL_FAST);
    const fallback = await tryModel(LLM_MODEL_FAST);
    if (fallback.ok) {
      const data = JSON.parse(fallback.text);
      return data.choices?.[0]?.message?.content ?? null;
    }
    if (fallback.rateLimited) throw new Error("RATE_LIMITED");
    return null;
  }

  if (primary.rateLimited) throw new Error("RATE_LIMITED");
  return null;
}

async function searchKnowledge(query: string, limit = 6): Promise<string> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ query_text: query, match_count: limit }),
    });
    if (!res.ok) return "";
    const chunks = await res.json();
    if (!Array.isArray(chunks) || !chunks.length) return "";
    return chunks.map((c: { content: string; source_file?: string; brand?: string }) =>
      `[${c.brand ?? "doc"} — ${c.source_file ?? ""}]\n${c.content}`
    ).join("\n\n---\n\n");
  } catch { return ""; }
}

interface CatalogProduct {
  sku: string; name: string; category: string; brand: string;
  key_specs: Record<string, unknown>; purchase_price?: number;
}

/**
 * v38: Normalize raw key_specs from the RPC into consistent keys:
 *   stroke_mm (numeric string), bore_mm (numeric string), force_n (numeric string).
 * Also computes force_n from bore_mm × 6 bar if missing.
 * Sets is_family=true when product covers a range (stroke_range) rather than a fixed value.
 */
function normalizeKeySpecs(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  // ── Stroke ─────────────────────────────────────────────────────────────────
  // Canonical output key: stroke_mm (max value as "NNN mm")
  if (!out.stroke_mm) {
    for (const k of ["stroke_max", "max_stroke_mm", "max_stroke"]) {
      if (raw[k] != null) { out.stroke_mm = raw[k]; delete out[k]; break; }
    }
  }
  if (!out.stroke_mm && raw.stroke_range) {
    const m = String(raw.stroke_range).match(/(\d+(?:[.,]\d+)?)[–—\-](\d+(?:[.,]\d+)?)/);
    if (m) {
      out.stroke_mm = m[2] + " mm"; // use max of range
      out.is_family = true;         // family product — not a single orderable SKU
    } else {
      const single = parseFloat(String(raw.stroke_range));
      if (!isNaN(single)) out.stroke_mm = single + " mm";
    }
  }
  // Strip " mm" suffix so parseFloat works cleanly downstream
  if (typeof out.stroke_mm === "string") {
    const n = parseFloat(out.stroke_mm);
    if (!isNaN(n)) out.stroke_mm = n + " mm";
  }

  // ── Bore ──────────────────────────────────────────────────────────────────
  // Canonical output key: bore_mm (first/lowest numeric value)
  if (!out.bore_mm) {
    for (const k of ["bore_diameter_mm", "bore_diameter"]) {
      if (raw[k] != null) { out.bore_mm = raw[k]; delete out[k]; break; }
    }
  }
  if (!out.bore_mm && raw.bore_range) {
    // e.g. "32,40,50,63,80,100" or "32–100" — take first value
    const first = parseFloat(String(raw.bore_range).replace(/[^0-9.]/g, "0").split("0")[0]);
    if (!isNaN(first) && first > 0) { out.bore_mm = first + " mm"; out.is_family = true; }
  }
  if (typeof out.bore_mm === "string" && out.bore_mm.includes(",")) {
    // e.g. "8,12,16,20,25,32,40,50,63" → take first
    const first = parseFloat(out.bore_mm);
    if (!isNaN(first)) { out.bore_mm = first + " mm"; out.is_family = true; }
  }

  // ── Force ─────────────────────────────────────────────────────────────────
  // Canonical output key: force_n
  if (!out.force_n) {
    for (const k of ["piston_force_6bar_N", "thrust_force", "clamping_force", "gripping_force_N"]) {
      if (raw[k] != null) { out.force_n = raw[k]; delete out[k]; break; }
    }
  }
  // Calculate from bore if still missing
  if (!out.force_n && out.bore_mm) {
    const bore = parseFloat(String(out.bore_mm));
    if (!isNaN(bore) && bore > 0) {
      const force = Math.round(Math.PI / 4 * bore * bore * 6 * 0.1); // 6 bar in N/mm²=0.6 MPa, area mm²
      out.force_n = force + " N";
    }
  }

  return out;
}

/** Returns true for "family" products — product families covering a range, not a specific orderable SKU. */
function isFamilyProduct(p: CatalogProduct): boolean {
  if (p.key_specs?.is_family) return true;
  // SKU pattern: FESTO-*, SMC-*, PARKER-*, NORGREN-* (family placeholders)
  if (/^(FESTO|SMC|PARKER|NORGREN|CAMOZZI|METAL[-_]WORK|BOSCH)-/i.test(p.sku)) return true;
  return false;
}

async function fetchProducts(categorySlugs: string[], limit = 30): Promise<CatalogProduct[]> {
  const results = await Promise.all(
    categorySlugs.map(async (slug) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fetch_products_for_advisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ p_category_slug: slug, p_limit: limit }),
      });
      if (!res.ok) {
        console.error(`[fetchProducts] slug=${slug} status=${res.status}`);
        return [];
      }
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      // v38: normalize specs on every product
      return data.map((p: CatalogProduct) => ({ ...p, key_specs: normalizeKeySpecs(p.key_specs ?? {}) }));
    })
  );
  return results.flat() as CatalogProduct[];
}

function balancedSlice(products: CatalogProduct[], maxTotal: number): CatalogProduct[] {
  const byCategory = new Map<string, CatalogProduct[]>();
  for (const p of products) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push(p);
  }
  const numCats = byCategory.size;
  if (numCats === 0) return [];
  const perCat = Math.max(8, Math.ceil(maxTotal / numCats));
  const result: CatalogProduct[] = [];
  for (const ps of byCategory.values()) {
    result.push(...ps.slice(0, perCat));
    if (result.length >= maxTotal * 1.5) break;
  }
  return result.slice(0, maxTotal);
}

/**
 * v24: Sort products so the most requirement-relevant ones appear first.
 * Products with stroke matching requiredStroke go first (ascending overshoot).
 * Products with no stroke spec (accessories, sensors) are appended at the end.
 * Products that DON'T meet the stroke are sorted by descending stroke (closest fallback).
 */
function sortByStrokeMatch(products: CatalogProduct[], requiredStroke: number): CatalogProduct[] {
  if (requiredStroke === 0) return products;
  return [...products].sort((a, b) => {
    const sA = parseStrokeFromSpecs(a.key_specs ?? {});
    const sB = parseStrokeFromSpecs(b.key_specs ?? {});
    // Accessories (no stroke) — keep at end
    if (sA === 0 && sB === 0) return 0;
    if (sA === 0) return 1;
    if (sB === 0) return -1;
    const aOk = sA >= requiredStroke;
    const bOk = sB >= requiredStroke;
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    if (aOk && bOk) return sA - sB; // both qualify → prefer smallest (least oversized)
    return sB - sA; // both too short → prefer longest (closest to requirement)
  });
}

function detectCategories(text: string): string[] {
  const t = text.toLowerCase();
  const slugs = new Set<string>();
  if (/lyft|press|klämm|stansa|trycka|cylinder|pneumatisk|luft|piston|double.act/i.test(t))
    slugs.add("cylinder");
  if (/elektrisk|servo|stepper|präcis|positionering|linjäraxel|electric|ball.screw|kuggrem|kuggremsaxel|elaxel|eldriven/i.test(t)) {
    slugs.add("electric-actuator");
    slugs.add("linear-module");
  }
  if (/linjär.*modul|slide|guidning|linear.*module|linear.*axis|linjär.*axel|linjärmodul|egc\b|lefs\b|lesh\b|egsk\b|egsp\b|hmr\b|osp.e|lbb\b|hlr\b|elga\b/i.test(t))
    slugs.add("linear-module");
  if (/roter|vrida|sväng|rotary/i.test(t)) slugs.add("rotary-actuator");
  if (/vakuum|sugg|sugkopp|vacuum|suction|plocka|pick.*place|pick.and.place|lyft.*upp|grepp|grip|känslig|inte.*repa|skada.*inte|kretskort|pcb|elektronik|glas|optik/i.test(t))
    slugs.add("vacuum");
  if (/gripper|klämma|jaw|parallel.grip/i.test(t)) slugs.add("gripper");
  if (/ventil(?!terminal)|valve(?!.terminal)|solenoid/i.test(t)) slugs.add("valve");
  if (/ventilterminal|valve.terminal|vtug|vtsa|mpa\b|cpv\b|ventilblock|manifold|fördelare|ventilramp/i.test(t))
    slugs.add("valve-terminal");
  if (/sensor|detek|proximity|reed/i.test(t)) slugs.add("sensor");
  // Cleanroom (actual ISO-class rooms): switch to electric-only
  // Note: use \bclean\b to avoid matching "clean design" product names
  if (/\brenrum\b|\bcleanroom\b|\bclean\s+room\b|programmera|mjukstart|mjukstopp/i.test(t)) {
    slugs.delete("cylinder");
    slugs.add("electric-actuator");
    slugs.add("linear-module");
  }
  // ATEX / EX-zone: electric actuators are FORBIDDEN — strip them from categories
  if (needsAtex(t)) {
    slugs.delete("electric-actuator");
    slugs.delete("linear-module");
    if (slugs.size === 0) slugs.add("cylinder");
  }
  // Pick & place: cylinders + vacuum + linear-module (electric option)
  if (/pick.and.place|pick.*place|plocka.*placera|plocka.*flytta|lyfter.*flytta|flytta.*lyft|transfer.*station|montering|montage/i.test(t)) {
    slugs.add("cylinder");
    slugs.add("vacuum");
    slugs.add("linear-module");
  }
  if (slugs.size === 0) slugs.add("cylinder");
  return Array.from(slugs);
}

/**
 * Parse the maximum operating temperature from a product's key_specs.
 * Handles formats: "5-60", "-10 to 80", "5…60°C", "T: -10...+80°C"
 * Returns 0 if unknown (no spec present).
 */
function parseProductTempMax(specs: Record<string, unknown>): number {
  for (const key of ["temp_max", "temp_range", "operating_temp", "temperature_range", "temperature_max", "temp_rating", "ambient_temp"]) {
    const v = specs[key];
    if (v == null) continue;
    const s = String(v).replace(/[°Cc]/g, "").trim();
    // Split on range separators (dash/en-dash/to/bis) then extract all positive integers.
    // "5-60"   → ["5","60"]  → max 60   ✓
    // "-10-80" → ["-10","80"] split → keep 10,80 → max 80  ✓
    // "-10 to 80" → same → max 80  ✓
    const parts = s.split(/(?:\s+to\s+|\s+bis\s+|[–—]|\s*-\s*(?=\d))/i);
    const positiveNums = parts.flatMap(p => (p.match(/\d+(?:\.\d+)?/g) ?? [])).map(parseFloat);
    if (positiveNums.length > 0) return Math.max(...positiveNums);
  }
  return 0; // unknown — do not block
}

/**
 * Extract the highest temperature requirement from description + answers.
 * Returns 0 if no temperature mentioned or below standard threshold (80°C).
 * We use 80°C as threshold because standard NBR seals are rated to ~80°C;
 * anything above warrants a spec check.
 */
function extractRequiredMaxTemp(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const matches = [...allText.matchAll(/(\d{2,3})\s*°?\s*[cC]\b/gi)].map(m => parseInt(m[1]));
  const grad = allText.match(/(\d{2,3})\s*grad/i);
  if (grad) matches.push(parseInt(grad[1]));
  const relevant = matches.filter(t => t > 80 && t < 1200);
  return relevant.length > 0 ? Math.max(...relevant) : 0;
}

function parseStrokeFromSpecs(specs: Record<string, unknown>): number {
  for (const key of ["stroke_mm", "stroke_max", "max_stroke_mm", "max_stroke"]) {
    const v = specs[key];
    if (v != null) { const n = parseFloat(String(v)); if (!isNaN(n) && n > 0) return n; }
  }
  const rangeStr = specs["stroke_range"];
  if (rangeStr) {
    const m = String(rangeStr).match(/(\d+)[–—\-](\d+)/);
    if (m) return parseInt(m[2]);
    const single = parseFloat(String(rangeStr));
    if (!isNaN(single) && single > 0) return single;
  }
  return 0;
}

function strokeLabel(specs: Record<string, unknown>): string {
  for (const key of ["stroke_mm", "stroke_max", "max_stroke_mm", "max_stroke"]) {
    const v = specs[key]; if (v != null) return `${v} mm`;
  }
  if (specs["stroke_range"]) return String(specs["stroke_range"]);
  return "?";
}

function extractMinStroke(answers: Record<string, string>, description: string): number {
  for (const [k, v] of Object.entries(answers)) {
    if (/stroke|slag|sträcka|avstånd|rörelse|längd|travel|distance/i.test(k)) {
      const digits = v.replace(/[^0-9.]/g, "");
      const n = parseFloat(digits);
      if (!isNaN(n) && n >= 5 && n <= 15000) return n;
    }
  }
  const allText = Object.values(answers).join(" ") + " " + description;
  let maxFound = 0;
  // Match "NNN mm" but NOT "NNN mm/s" (speed), "NNN mm²" (area), "NNN mm³" (volume)
  for (const m of allText.matchAll(/(\d{2,5})\s*mm(?![\s]*(\/|per|²|³|s\b))/gi)) {
    const v = parseInt(m[1]);
    if (v >= 50 && v <= 10000 && v > maxFound) maxFound = v;
  }
  if (maxFound > 0) return maxFound;
  const rangeMatch = allText.match(/(\d+)[–—\-](\d+)\s*mm/);
  if (rangeMatch) return parseInt(rangeMatch[2]);
  if (/> 500|mer.{0,5}500/i.test(allText)) return 500;
  if (/300.{0,5}500/i.test(allText)) return 300;
  if (/150.{0,5}300/i.test(allText)) return 150;
  if (/50.{0,5}150/i.test(allText)) return 50;
  return 0;
}

function extractPerAxisStrokes(answers: Record<string, string>): { axis: string; stroke: number }[] {
  const result: { axis: string; stroke: number }[] = [];
  for (const [k, v] of Object.entries(answers)) {
    if (/stroke|slag|sträcka|avstånd|rörelse|längd|travel|distance/i.test(k)) {
      const digits = v.replace(/[^0-9.]/g, "");
      const n = parseFloat(digits);
      if (!isNaN(n) && n >= 5 && n <= 15000) {
        // Match x/y/z anywhere in the key name (e.g. "x_stroke", "stroke_z", "x")
        const axisMatch = k.match(/([xyz])/i);
        result.push({ axis: axisMatch ? axisMatch[1].toUpperCase() : "?", stroke: n });
      }
    }
  }
  return result;
}

function needsMultiAxis(text: string): boolean {
  return /x.*z|z.*x|x.*y|y.*x|två axl|två rörel|horisontell.*vertikal|vertikal.*horisontell|pick.and.place|pick.*place|plocka.*placera|plocka.*flytta|lyfter.*flytta|flytta.*lyft|2-axl|2 axl|multi.*axl|cartesian|portalsystem|lyfter.*flyttar|lyfter.*och.*flyttar/i.test(text);
}

function needsVacuumGrip(text: string): boolean {
  return /kretskort|pcb|elektronik|glas|optik|repas|inte.*repa|skada.*grepp|känslig.*yta|vacuum.grip|sugkopp|suction.cup/i.test(text);
}

function needsValveTerminal(text: string): boolean {
  return (
    needsMultiAxis(text) ||
    /ventilterminal|valve.terminal|vtug|vtsa|mpa\b|cpv\b|ventilblock|manifold|ventilramp/i.test(text) ||
    /tre.*cylindr|fyra.*cylindr|3\s*cylindr|4\s*cylindr|3\s*cyl|4\s*cyl|several.*actuat|multiple.*actuat|multiple.*cyl|två.*cylindr|två cyl/i.test(text)
  );
}

/**
 * Detects ATEX / explosive-atmosphere requirements (Zone 1 or Zone 2).
 * In these zones ALL standard electrical components (motors, servo axes, 24V sensors)
 * are strictly forbidden unless explicitly ATEX/NAMUR-certified.
 */
function needsAtex(text: string): boolean {
  return /\batex\b|\bex[.\s-]?zon[e]?\b|\bexplosionsskyddad\b|\bexplosionsfarlig\b|\bflammable[.\s]?gas\b|\bbrännbar[.\s]?gas\b|\bnamur\b|\bzone\s?[12]\b|\bzon\s?[12]\b|\bii\s?[23]\s?[gd]\b|\bii[abc]\b|\bex\s?klass\b|\bex[.\s]?klassad\b/i.test(text);
}

// ── Safety & environment detectors ────────────────────────────────────────────

/** Vertical / suspended load: cylinder holds weight against gravity.
 *  On air-pressure loss the load WILL fall unless a lock valve is fitted. */
function needsVerticalLoad(text: string): boolean {
  return /\blyft|\bhissa\b|\bhäng.*last\b|\blast.*häng\b|\bvertikal|\bcylinder.*vertikal\b|\bz[.-]?axel\b|\bz[.-]?axis\b|\bpress.*ner\b|\bpress.*ned\b|\bnedåt\b|\buppåt\b|\bvertical.*load\b|\bhanging.*load\b|\bsuspended.*load\b|\blifting.*cyl\b|\bcylinder.*lyft\b/i.test(text);
}

/** High temperature environment (>80°C). Standard NBR seals fail — need PTFE/FKM/HT variants. */
function needsHighTemp(text: string): boolean {
  return /\bugn\b|\bfornace\b|\bautoklav\b|\bsteam\b|\bånga\b|\bvulk\b|\bsintr\b|\bsmält\b|\bhög.*temp\b|\bhigh.*temp\b|\bvarm.*milj\b|\bhet.*milj\b|\b[89]\d\s*°?\s*[cC]\b|\b1[0-9]\d\s*°?\s*[cC]\b|\b200\s*°?\s*[cC]\b|\bhögtemperatur\b|\bheat.*treat\b|\bvärmebehandl\b/i.test(text);
}

/** Low temperature environment (<-10°C). Standard seals crack/harden — need LT/FKM variants. */
function needsLowTemp(text: string): boolean {
  return /\bfrys\b|\bfrysrum\b|\bkylanläggn\b|\bcold.*room\b|\bcold.*stor\b|\bkylrum\b|\bcryogen\b|\bdjupfrys\b|\bfryscell\b|\bkyla.*milj\b|\b-[1-9]\d\s*°?\s*[cC]\b|\b-\s*[1-9]\d\s*°?\s*[cC]\b|\bbelow.*freez\b|\bsubzero\b|\bfrost.*milj\b/i.test(text);
}

/** Hydraulic application — entirely different product family (100–350 bar oil). NOT in pneumatic catalog. */
function isHydraulicApplication(text: string): boolean {
  return /\bhydraulisk\b|\bhydraulic\b|\bhydraul\b|\bolje.*cylinder\b|\bcylinder.*olja\b|\bolje.*tryck\b|\bhydro.*cyl\b|\bhydro.*press\b/i.test(text);
}

/** Force requirement that likely exceeds pneumatic capability (>8 000 N at reasonable bore/pressure). */
function needsVeryHighForce(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.values(answers).join(" ");
  const knMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*kN/i);
  if (knMatch) return parseFloat(knMatch[1].replace(",", ".")) >= 8;
  const nMatch = allText.match(/(\d{5,})\s*[nN]\b/);
  if (nMatch) return parseInt(nMatch[1]) >= 8000;
  return false;
}

/** Oxygen-enriched atmosphere (>25% O2). Standard oil-lubricated pneumatics → fire/explosion risk. */
function needsOxygenClean(text: string): boolean {
  return /\bsyrgas\b|\boxygen[.\s-]?enrich\b|\boxygen[.\s-]?clean\b|\bo2[.\s-]?ren\b|\bhög.*syrgashal\b|\boxygen.*atmosf\b|\bmedical.*oxygen\b|\boxidations.*milj\b|\breact.*oxygen\b|\boi?l[.\s-]?free.*oxygen\b/i.test(text);
}

/** High cycle frequency (>60 cycles/min) — thermal and lubrication issues with standard cylinders. */
function needsHighCycle(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.values(answers).join(" ");
  return /\b[6-9]\d\s*(?:cyk|slag|cykel|cyc|stroke|takt).*(?:min|s)\b|\b1[0-9]\d\s*(?:cyk|slag|cykel|cyc|stroke|takt)\b|\bhög.*frekvens\b|\bhigh.*freq\b|\bhigh.*cycle\b|\bsnabb.*takt\b|\brapid.*cycling\b|\bfastcycl\b/i.test(allText);
}

/** High speed > 1 m/s without deceleration control — end-stop impact damage. */
function needsHighSpeed(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.values(answers).join(" ");
  // \b[1-9]\d{3,}\s*mm\/s\b catches "1200mm/s", "2000 mm/s" etc (≥1000 mm/s = >1 m/s)
  return /\b[1-9](?:[.,]\d+)?\s*m\/s\b|\b[1-9]\d{3,}\s*mm\/s\b|\bsnabb.*rörelse\b|\bhigh.*speed\b|\bhög.*hastighet\b|\bfast.*actuat\b|\bsnabb.*stans\b|\bslaghastighet.*[1-9]\b/i.test(allText);
}

/** SIL/functional safety required — safety relay, guard interlock, emergency stop function. */
function needsSilSafety(text: string): boolean {
  return /\bsil\s*[1-4]\b|\bsäkerhetsfunktion\b|\bsafety.*function\b|\bnödstopp\b|\bemergency.*stop\b|\bguard.*interlock\b|\bskyddsgrind\b|\bplt\b|\biso\s*13849\b|\biec\s*62061\b|\bperformance.*level\b|\bplr\b|\bple\b|\bpld\b|\bsafety.*relay\b|\bsäkerhetsrelä\b|\bPNOZ\b|\bfail.*safe\b/i.test(text);
}

/** Outdoor / marine / harsh UV + weather environment. */
function needsOutdoor(text: string): boolean {
  return /\butomhus\b|\boutdoor\b|\bexterior.*install\b|\bsalt.*milj\b|\bmarin\b|\bmarine\b|\boffshore\b|\bsalt.*spray\b|\bsalt.*dimma\b|\bväder.*skydd\b|\buv.*exponering\b|\bregn.*milj\b|\bkorrosiv.*milj\b/i.test(text);
}

/** Pharmaceutical / GMP / FDA — validated materials, no dead-spaces, 316L, PTFE. */
function needsPharmaGmp(text: string): boolean {
  return /\bgmp\b|\bfda\b|\b21\s*cfr\b|\bläkemedel\b|\bpharma\b|\bpharmaceut\b|\bsterilit\b|\bsteril.*milj\b|\bvalidat\b|\biso\s*14159\b|\behedg\b|\bbioprocess\b|\bapi\b.*\bprodukt\b|\bcip\b|\bsip\b/i.test(text);
}

/** ATEX Dust (Zone 20/21/22) — combustible dust explosion. Different from gas zones (different group/category). */
function needsAtexDust(text: string): boolean {
  return /\bzon\s*2[012]\b|\bzone\s*2[012]\b|\bdamm.*explosion\b|\bexplosivt.*damm\b|\bcombustible.*dust\b|\bbrännbart.*damm\b|\bsädes\b.*\bexplos\b|\bmjöl.*explos\b|\bträ.*damm.*explos\b|\bcoal.*dust\b|\bkol.*damm\b|\bii[i]?\s*[23][d]\b|\bdust.*atex\b|\batex.*dust\b/i.test(text);
}

/**
 * Battery manufacturing / Dryroom environment.
 * Prohibits copper (Cu), zinc (Zn) and nickel (Ni) in any wetted or moving part.
 * Standard ball screws, zinc-coated guides and most greases are FORBIDDEN.
 * Dew point typically -40 to -60 °C — particle generation is a critical risk.
 */
function needsBatteryDryroom(text: string): boolean {
  return /\bdryroom\b|\bdry\s*room\b|\btorrkammare\b|\blitiumjon\b|\blithium[-\s]?ion\b|\bli[-\s]?ion\b|\bbatterifabrik\b|\bbattery\s*(?:manufactur|produc|cell|fabrik)\b|\bbatteriproduk\b|\bbattericell\b|\bkatod(?:material)?\b|\banod(?:material)?\b|\belektrod(?:material)?\b|\belectrode\b|\bpouch\s*cell\b|\blitiumbatteri\b|\bcell\s*monter\b|\bcu\/zn\/ni\b|\bkoppar.*zink.*nickel\b/i.test(text);
}

/** Returns true if a product is ball-screw driven (not belt or direct linear motor). */
function isBallScrewProduct(p: CatalogProduct): boolean {
  const s = (p.name + " " + p.sku + " " + JSON.stringify(p.key_specs ?? {})).toLowerCase();
  return /\begsk\b|\bkulskruv\b|\bball\s*screw\b|\bspindel\b|\bspindle\b|\blead\s*screw\b|\bleadscrew\b/i.test(s);
}

/** Extract numeric speed in m/s from free text + answers (for mechanism compatibility check). */
function extractSpeedMs(text: string, answers: Record<string, string>): number {
  const all = text + " " + Object.values(answers).join(" ");
  // Match e.g. "1.2 m/s", "0,8m/s", "800 mm/s"
  const msMatch = all.match(/(\d+(?:[.,]\d+)?)\s*m\/s/i);
  if (msMatch) return parseFloat(msMatch[1].replace(",", "."));
  const mmMatch = all.match(/(\d+(?:[.,]\d+)?)\s*mm\/s/i);
  if (mmMatch) return parseFloat(mmMatch[1].replace(",", ".")) / 1000;
  return 0;
}

/**
 * Extract precision requirement (mm) from free text + answers.
 * Handles: "±0.02 mm", "0.1mm precision", "repeterbarhet ±0.003mm", "20µm", "50 mikrometer"
 * Returns 0 if not found (unknown → do not apply precision filter).
 */
function extractPrecisionMm(text: string, answers: Record<string, string>): number {
  const all = text + " " + Object.values(answers).join(" ");
  // µm / mikrometer → convert to mm
  const umMatch = all.match(/(\d+(?:[.,]\d+)?)\s*(?:µm|um|mikrometer|micrometer)/i);
  if (umMatch) return parseFloat(umMatch[1].replace(",", ".")) / 1000;
  // "±0.02 mm", "0.02mm", "0,02 mm" — look for small decimal numbers near precision keywords
  const precMatch = all.match(/(?:precision|accuracy|repeatability|noggrannhet|repeterbarhet|genomen|toleran)[^\d]{0,10}[±+\-]?\s*(\d+(?:[.,]\d+)?)\s*mm/i)
    || all.match(/[±]\s*(\d+(?:[.,]\d+)?)\s*mm/i)
    || all.match(/(\d+(?:[.,]\d+)?)\s*mm\s*(?:precision|accuracy|repeatability|noggrannhet|repeterbarhet)/i);
  if (precMatch) return parseFloat(precMatch[1].replace(",", "."));
  return 0;
}

/** Returns true if a product is belt-driven (not ball screw, not pneumatic). */
function isBeltDrivenProduct(p: CatalogProduct): boolean {
  const s = (p.name + " " + p.sku + " " + JSON.stringify(p.key_specs ?? {})).toLowerCase();
  return /\bkuggrem\b|\btiming[\s-]?belt\b|\bsynchronous[\s-]?belt\b|\belgc[-.]?tb\b|\begsc\b|\belt[-\s]driv/i.test(s);
}

/** Returns true if a product is a pneumatic cylinder (actuator) — NOT an electric axis. */
function isPneumaticActuatorProduct(p: CatalogProduct): boolean {
  // Items without stroke spec are accessories — they are neither pneumatic nor electric actuators
  if (parseStrokeFromSpecs(p.key_specs ?? {}) === 0) return false;
  return !isElectricActuator(p);
}

/**
 * PRECISION RULE (ALL AXES, v34): if precision ≤ 0.1 mm, belt drives and pneumatics
 * are physically excluded regardless of axis orientation.
 * • Pneumatic repeatability: ±0.1–0.5 mm → cannot achieve ≤0.1 mm
 * • Belt backlash: 0.05–0.3 mm → violates ≤0.1 mm precision budget
 * • Ball screw / spindle: 0.003–0.05 mm → physically capable
 * Returns true if product is ALLOWED for high-precision application.
 */
function isAllowedForHighPrecision(p: CatalogProduct): boolean {
  const hasStroke = parseStrokeFromSpecs(p.key_specs ?? {}) > 0;
  if (!hasStroke) return true; // accessories always included
  if (!isElectricActuator(p)) return false; // no pneumatics (repeatability too poor)
  if (isBeltDrivenProduct(p)) return false; // no belt (backlash too high)
  return true; // electric ball screw / spindle / linear motor only
}

/**
 * Alias kept for backward compat — same logic, used for vertical+precision specifically.
 */
function isAllowedForPrecisionVertical(p: CatalogProduct): boolean {
  return isAllowedForHighPrecision(p);
}

/**
 * HIGH-SPEED RULE (v34): if speed > 0.8 m/s AND no precision constraint,
 * ball-screw drives are excluded (vibration, wear, resonance above ~800 mm/s).
 * Only applies when precision is NOT the limiting factor (if precision ≤ 0.1mm,
 * ball screw may still be needed despite high speed).
 * Returns true if product is ALLOWED for high-speed, low-precision application.
 */
function isAllowedForHighSpeed(p: CatalogProduct): boolean {
  const hasStroke = parseStrokeFromSpecs(p.key_specs ?? {}) > 0;
  if (!hasStroke) return true;
  if (!isElectricActuator(p)) return true; // pneumatic at high speed = fine (add cushions)
  if (isBallScrewProduct(p)) return false; // ball screw resonates / wears above 800 mm/s
  return true; // belt drive, linear motor = ideal for high speed
}

/** Returns true if a product is an electric actuator/motor/drive — forbidden in ATEX zones. */
function isElectricActuator(p: CatalogProduct): boolean {
  const name = (p.name + " " + p.brand).toLowerCase();
  return (
    p.category === "electric-actuator" ||
    p.category === "linear-module" ||
    /\begsk\b|\belgc\b|\belga\b|\blesh\b|\blefs\b|\bosp[-.]?e\b|\bhmr\b|\blbb\b|\bhlr\b/i.test(name) ||
    /servo|stepper|ball.screw|kuggrem|electric.*axis|linjärmodul.*el|eldriven/i.test(name)
  );
}

/**
 * Detects washdown / food-grade / wet-environment requirements.
 * These applications require IP67/IP69K and stainless or food-grade plastic —
 * standard aluminum cylinders will corrode immediately.
 */
function needsWashdown(text: string): boolean {
  return /washdown|wash[-\s]down|livsmedel|food[-\s]grade|food[-\s]safe|mejeri|dairy|slakteri|slakter|livsmedelsgodkänd|livsmedelsgodkand|ip[-\s]?69|högtrycksspolning|högtryck.*spol|spol.*kemik|kemisk.*reng|cip\b|sip\b|hygienic|hygienisk|clean[-\s]design|cleandesign|rostfri|stainless|korrosionsskyddad|vätsk.*milj|blot.*milj/i.test(text);
}

/** Returns true if the user requested end-position / stroke-end detection (sensors). */
function needsEndPositionDetection(text: string): boolean {
  return /detekt|givare|sensor|ändläge|end.pos|end.stop|stroke.end|reed|proximity|närhets|position.*detect|detect.*position|elektron.*detekt|signalera|signal.*läge|läges.*signal|kontrollera.*läge|läge.*kontroll|home.*detect|detect.*home|smcm|smc.*sensor|piston.*sens/i.test(text);
}

/** Returns true if a product is suitable for washdown environments. */
function isWashdownProduct(p: CatalogProduct): boolean {
  const ip = String(p.key_specs?.ip_rating ?? "").toLowerCase();
  const name = (p.name + " " + p.brand).toLowerCase();
  // Products without stroke spec are support items (sensors, fittings) — include regardless
  if (parseStrokeFromSpecs(p.key_specs ?? {}) === 0) return true;
  return (
    ip.includes("ip67") || ip.includes("ip69") ||
    name.includes("stainless") || name.includes("rostfri") ||
    name.includes("corrosion") || name.includes("crdsnu") ||
    name.includes("clean design") || name.includes("cleandesign") ||
    name.includes("serie 90") || name.includes("washdown") ||
    name.includes("food grade") || name.includes("hygienic")
  );
}

interface CustomSolutionContext {
  isWashdown?: boolean;
  isVertical?: boolean;
  isFoodGrade?: boolean;
  isBatteryDryroom?: boolean;
  isHydraulic?: boolean;
  isAtex?: boolean;
  isSilSafety?: boolean;
  maxCatalogStroke?: number;
  catalogCanHandle?: boolean;
}

function buildCustomSolutionOption(
  minStroke: number, isSv: boolean, maxCatalogStroke: number, catalogCanHandle: boolean,
  ctx: CustomSolutionContext = {}
) {
  const { isWashdown, isVertical, isFoodGrade, isBatteryDryroom, isHydraulic, isAtex, isSilSafety } = ctx;

  // Build a context-specific "why" with product family recommendations
  let whyLines: string[] = [];

  if (!catalogCanHandle && maxCatalogStroke > 0 && minStroke > 0) {
    whyLines.push(isSv
      ? `Längsta katalogprodukten når ${maxCatalogStroke} mm — kravet är ${minStroke} mm.`
      : `Longest catalog product reaches ${maxCatalogStroke} mm — requirement is ${minStroke} mm.`);
  }

  // Washdown + vertical + food = most demanding scenario — give two explicit architectural paths
  if (isWashdown && isVertical && isFoodGrade) {
    whyLines.push(isSv
      ? `⚙️ Rekommenderade arkitekturval för slakteri/IP69K-miljö:\n` +
        `▸ ALT A – Pneumatisk rostfri cylinder (316L): SMC HY-serien (IP69K, NSF-H1-smörjning, EHEDG-hygienisk design) eller Parker P1S Stainless Washdown Cylinder. Komplettera med pneumatisk stångbroms (rod lock) för säker hållning vid strömavbrott.\n` +
        `▸ ALT B – Kapslad el-cylinder IP69K: Bosch Rexroth EMC-HD-XC (IP69K rostfritt, PROFINET-nativ) eller Parker ETH-serie Washdown. Kräver integrerad motorbroms + säkerhetsventil för SIL 2/PLd.`
      : `⚙️ Recommended architectural paths for slaughterhouse/IP69K:\n` +
        `▸ ALT A – Stainless pneumatic cylinder (316L): SMC HY-Series (IP69K, NSF-H1 lube, EHEDG hygienic design) or Parker P1S Stainless Washdown. Add pneumatic rod lock for safe holding on power loss.\n` +
        `▸ ALT B – Enclosed IP69K electric cylinder: Bosch Rexroth EMC-HD-XC (IP69K stainless, native PROFINET) or Parker ETH Washdown series. Requires integrated motor brake + safety valve for SIL 2/PLd.`);
  } else if (isWashdown && isFoodGrade) {
    whyLines.push(isSv
      ? `Miljökrav IP69K + livsmedel kräver: SMC HY-serien (316L, NSF-H1) eller Parker P1S Washdown. Verifierat EHEDG-utförande rekommenderas.`
      : `IP69K + food-grade requires: SMC HY-Series (316L, NSF-H1) or Parker P1S Washdown. EHEDG-certified design recommended.`);
  } else if (isWashdown) {
    whyLines.push(isSv
      ? `IP69K-krav: Festo CRDSNU (rostfri), Camozzi Serie 90 (IP67+), SMC CDQ2-serien (IP67) eller Parker P1S. Inga standardaluminiumcylindrar.`
      : `IP69K requirement: Festo CRDSNU (stainless), Camozzi Serie 90 (IP67+), SMC CDQ2-series (IP67) or Parker P1S. No standard aluminum.`);
  }

  if (isVertical && isSilSafety) {
    whyLines.push(isSv
      ? `⚠️ Vertikal last + säkerhetsfunktion: Mekanisk stångbroms (t.ex. SMC MHF2 rod lock) eller integrerad motorbroms OBLIGATORISK. Säkerhetsventil SIL 2-certifierad krävs per ISO 13849 PLd.`
      : `⚠️ Vertical load + safety function: Mechanical rod lock (e.g. SMC MHF2) or integrated motor brake MANDATORY. SIL 2-certified safety valve required per ISO 13849 PLd.`);
  } else if (isVertical) {
    whyLines.push(isSv
      ? `⚠️ Vertikal rörelse: Pilotmanövrerad backslagsventil eller stångbroms OBLIGATORISK för att förhindra fall vid lufttrycksfall.`
      : `⚠️ Vertical movement: Pilot-operated check valve or rod lock MANDATORY to prevent drop on air loss.`);
  }

  if (isBatteryDryroom) {
    whyLines.push(isSv
      ? `⛔ Dryroom Cu/Zn/Ni-fritt: SMC 25-serien (Cu/Zn/Ni-fri, PFPE-smörjd). Begär materialdeklerationsintyg.`
      : `⛔ Dryroom Cu/Zn/Ni-free: SMC 25-Series (Cu/Zn/Ni-free, PFPE-lubricated). Request material declaration.`);
  }

  if (isHydraulic) {
    whyLines.push(isSv
      ? `Hydraulisk applikation (100-350 bar): Parker HMI/HYD-serien, Bosch Rexroth CDL1 eller SMC CH-serien. Utanför pneumatisk standardkatalog.`
      : `Hydraulic application (100-350 bar): Parker HMI/HYD-series, Bosch Rexroth CDL1 or SMC CH-series. Outside pneumatic standard catalog.`);
  }

  if (isAtex) {
    whyLines.push(isSv
      ? `ATEX-zon: Alla komponenter måste vara NAMUR/IECEx-certifierade. Parker P1X ATEX, SMC CDQMB-ATEX eller Norgren Excelon ATEX-serien.`
      : `ATEX zone: All components must be NAMUR/IECEx-certified. Parker P1X ATEX, SMC CDQMB-ATEX or Norgren Excelon ATEX-series.`);
  }

  if (whyLines.length === 0) {
    whyLines.push(isSv
      ? `Vill du ha en lösning helt anpassad efter era exakta krav? Vi sköter leverantörsdialogen och levererar en komplett offert med exakt pris och leveranstid.`
      : `Want a solution fully tailored to your exact requirements? We manage the supplier dialogue and deliver a complete quote with exact pricing and lead time.`);
  }

  return {
    sku: "CUSTOM-SOLUTION",
    name: isSv ? "Kundspecifik lösning" : "Custom engineered solution",
    badge: isSv ? "Kundlösning" : "Custom solution",
    bore_mm: null, stroke_mm: minStroke > 0 ? minStroke : null, force_n: null,
    why: whyLines.join(" "),
    pros: isSv
      ? ["Exakt anpassad till era krav", "Vi kör dialogen med leverantören", "Offert med pris och leveranstid"]
      : ["Exactly matched to your requirements", "We manage the supplier dialogue", "Quote with pricing and lead time"],
    cons: isSv
      ? ["Längre ledtid än lagerprodukt", "Kräver offertförfrågan"]
      : ["Longer lead time than stock items", "Requires a quote request"],
  };
}

function sanitizeSingleAxisBom(
  bom: Array<{ sku: string; quantity: number; role: string; reason: string }>,
  primarySku: string
): Array<{ sku: string; quantity: number; role: string; reason: string }> {
  const SECOND_AXIS = /\b(z|y)[-\s]?axel\b|\b(z|y)[-\s]?axis\b|axel\s*[2-9]|axis\s*[2-9]|second.axis|andre.axel/i;
  let result = bom.filter(line => {
    if (line.sku === primarySku) return true;
    if (SECOND_AXIS.test(line.role)) return false;
    return true;
  });
  const primaryRows = result.filter(l => l.sku === primarySku);
  const otherRows   = result.filter(l => l.sku !== primarySku);
  if (primaryRows.length > 1) {
    result = [{ ...primaryRows[0], quantity: 1 }, ...otherRows];
  } else if (primaryRows.length === 1 && primaryRows[0].quantity > 1) {
    result = [{ ...primaryRows[0], quantity: 1 }, ...otherRows];
  }
  result = result.map(line => ({
    ...line,
    role: line.role
      .replace(/\s*\/\s*[XYZ][-\s]?axel[^,/]*/gi, '')
      .replace(/[XYZ][-\s]?axel\s*/gi, '')
      .trim(),
  }));
  const SINGLE_PER_AXIS = /motor(?!\s*kabel)|controller|kontroller|\bdrive\b|styrenhet/i;
  result = result.map(line => {
    if (line.sku === primarySku) return line;
    if (line.quantity === 2 && SINGLE_PER_AXIS.test(line.role)) return { ...line, quantity: 1 };
    return line;
  });
  const merged = new Map<string, { sku: string; quantity: number; role: string; reason: string }>();
  for (const line of result) {
    const ex = merged.get(line.sku);
    if (ex) {
      ex.quantity += line.quantity;
      if (!ex.role.includes(line.role)) ex.role = ex.role + " / " + line.role;
    } else {
      merged.set(line.sku, { ...line });
    }
  }
  return Array.from(merged.values());
}

// ── v40: Deterministic product scoring ────────────────────────────────────────

interface ScoringCtx {
  requiredStroke: number;
  isHighPrecision: boolean;
  isHighSpeed: boolean;
  isVertical: boolean;
  isWashdown: boolean;
  isAtex: boolean;
}

/**
 * v40: Score a catalog product 0–100 for ranking (deterministic, no LLM).
 * Higher = better match for the application requirements.
 */
function scoreProduct(p: CatalogProduct, ctx: ScoringCtx): number {
  if (ctx.isAtex && isElectricActuator(p)) return -9999;

  let score = 50;
  const maxStroke = parseStrokeFromSpecs(p.key_specs ?? {});

  // ── Stroke fit (±30 points) ───────────────────────────────────────
  if (ctx.requiredStroke > 0 && maxStroke > 0) {
    if (maxStroke >= ctx.requiredStroke) {
      const overshoot = (maxStroke - ctx.requiredStroke) / ctx.requiredStroke;
      score += Math.max(0, 25 - overshoot * 50); // 25 at 0% overshoot, 0 at 50%+
    } else {
      score -= 30; // below requirement
    }
  } else if (maxStroke === 0) {
    score -= 5; // no stroke spec = accessory/family
  }

  // ── Technology match (±25 points) ────────────────────────────────
  const isBallScrew = isBallScrewProduct(p);
  const isBelt     = isBeltDrivenProduct(p);
  const isPneu     = isPneumaticActuatorProduct(p);
  if (ctx.isHighPrecision) {
    if (isBallScrew)        score += 25;
    else if (isPneu || isBelt) score -= 25;
  }
  if (ctx.isHighSpeed && !ctx.isHighPrecision) {
    if (isBelt)       score += 20;
    else if (isBallScrew) score -= 15;
  }

  // ── Washdown fit (±15 points) ─────────────────────────────────────
  if (ctx.isWashdown) {
    if (isWashdownProduct(p)) score += 15;
    else if (maxStroke > 0)   score -= 20;
  }

  // ── Penalties ────────────────────────────────────────────────────
  if (isFamilyProduct(p))    score -= 5;
  const price = p.purchase_price ?? 9999;
  if (price < 150) score += 4;
  else if (price < 400) score += 2;

  return score;
}

/**
 * v40: Find the best catalog product of a given component type.
 * Returns null if no catalog match exists — caller should use SPECIFY.
 */
function findCatalogProductByType(
  type: "valve" | "frl" | "check-valve" | "shock-absorber" | "sensor" | "valve-terminal",
  products: CatalogProduct[]
): CatalogProduct | null {
  for (const p of products) {
    const nameSkuLower = (p.name + " " + p.sku).toLowerCase();
    switch (type) {
      case "valve":
        if (p.category === "valve" || /\bsolenoid\b|\b5\/2\b|\b4\/2\b|\bmagnetventil\b|\bdirektional/i.test(p.name)) return p;
        break;
      case "frl":
        if (p.category === "frl" || /\bFRL\b|\bMS4\b|\bMS6\b|\bLFR\b|\bHFR\b/i.test(p.name + " " + p.sku)) return p;
        break;
      case "check-valve":
        if (/backslagsventil|check.valve|pilot.operated.check|sperrventil/i.test(nameSkuLower)) return p;
        break;
      case "shock-absorber":
        if (/stötdämpare|shock.absorber|dämpare|dämpning/i.test(nameSkuLower)) return p;
        break;
      case "sensor":
        if (p.category === "sensor" || /\bSME\b|\bSMT\b|\bgivare\b|\breed.switch\b|\bproximity\b|\bend.pos/i.test(p.name + " " + p.sku)) return p;
        break;
      case "valve-terminal":
        if (p.category === "valve-terminal" || /\bCPV\b|\bVTSA\b|\bMPA\b|\bventilramp\b|\bventilterminal\b/i.test(p.name + " " + p.sku)) return p;
        break;
    }
  }
  return null;
}

interface BomCtx {
  primarySku: string;
  primaryIsFamilyProd: boolean;
  isElectric: boolean;
  isAtex: boolean;
  isAtexDust: boolean;
  isVerticalLoad: boolean;
  isHighSpeed: boolean;
  valveTerminal: boolean;
  isEndPosDetect: boolean;
  isVacuum: boolean;
  isSv: boolean;
  products: CatalogProduct[];
}

/**
 * v40: Build ALL mandatory BOM rows using deterministic engineering rules.
 * This replaces per-component injections scattered across handleBom().
 * The LLM cannot affect these rows — they are always present.
 */
function buildMandatoryBomRows(ctx: BomCtx): Array<{ sku: string; quantity: number; role: string; reason: string }> {
  const { primarySku, primaryIsFamilyProd, isElectric, isAtex, isAtexDust,
          isVerticalLoad, isHighSpeed, valveTerminal, isEndPosDetect, isSv, products } = ctx;
  const isPneumatic = !isElectric && !isAtex && !isAtexDust;
  const rows: Array<{ sku: string; quantity: number; role: string; reason: string }> = [];

  // ── 1. Primary actuator (ALWAYS first) ───────────────────────────
  const famNote = primaryIsFamilyProd ? (isSv
    ? " ⚠️ Produktfamilj — ange komplett beställningskod (bore + stroke + varianter) vid order."
    : " ⚠️ Product family — specify full ordering code (bore + stroke + variants) when ordering.")
    : "";
  rows.push({
    sku: primarySku, quantity: 1,
    role: isSv ? "Primär aktuator" : "Primary actuator",
    reason: (isSv ? "Vald primär aktuator" : "Selected primary actuator") + famNote,
  });

  // ── 2. Brake motor (vertical electric) ───────────────────────────
  if (isVerticalLoad && isElectric) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: isSv ? "Bromsmotor — Z-axel (vertikal säkerhet)" : "Brake motor — Z-axis (vertical safety)",
      reason: isSv
        ? "OBLIGATORISK för vertikal elektrisk servoaxel — integrerad hållbroms säkerställer att lasten hålls kvar vid strömavbrott eller nödstopp. Standard servomotor utan broms är EJ tillräcklig."
        : "MANDATORY for vertical electric servo axis — integrated holding brake ensures load is held on power loss or emergency stop. Standard servo motor without brake is NOT sufficient.",
    });
  }

  // ── 3. Check valve (vertical pneumatic) ──────────────────────────
  if (isVerticalLoad && isPneumatic) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: isSv ? "Pilotmanövrerad backslagsventil" : "Pilot-operated check valve",
      reason: isSv
        ? "OBLIGATORISK vid pneumatisk vertikal last — förhindrar att lasten faller vid lufttrycksförlust (IEC 60947-5-1)"
        : "MANDATORY for pneumatic vertical load — prevents load drop on air pressure loss (IEC 60947-5-1)",
    });
  }

  // ── 4. Valve terminal (multi-actuator / fieldbus) OR single directional valve ─
  if (valveTerminal && isPneumatic) {
    const vtMatch = findCatalogProductByType("valve-terminal", products);
    rows.push({
      sku: vtMatch?.sku ?? "SPECIFY", quantity: 1,
      role: isSv ? "Ventilramp (ventilterminal)" : "Valve terminal (manifold)",
      reason: isSv
        ? "OBLIGATORISK för fältbussanslutning (PROFINET/EtherCAT) — ventilramp (CPV, VTSA, MPA) samlar alla ventiler i en enhet och reducerar kabelkostnad. Specificera bussmodul och ventilantal."
        : "MANDATORY for fieldbus (PROFINET/EtherCAT) — valve terminal (CPV, VTSA, MPA) consolidates all valves, reduces wiring. Specify bus module and valve count.",
    });
  } else if (isPneumatic) {
    const valveMatch = findCatalogProductByType("valve", products);
    rows.push({
      sku: valveMatch?.sku ?? "SPECIFY", quantity: 1,
      role: isSv ? "Magnetventil (5/2-vägs styrventil)" : "Solenoid valve (5/2-way directional)",
      reason: isSv
        ? "OBLIGATORISK för pneumatisk cylinder — 5/2-vägs magnetventil styr cylinderns riktning (fram/åter). Välj spänning 24 V DC och anslutning G1/4."
        : "MANDATORY for pneumatic cylinder — 5/2-way solenoid valve controls cylinder direction (extend/retract). Select 24 V DC coil and G1/4 port.",
    });
  }

  // ── 5. FRL (all pneumatic) ────────────────────────────────────────
  if (isPneumatic) {
    const frlMatch = findCatalogProductByType("frl", products);
    rows.push({
      sku: frlMatch?.sku ?? "SPECIFY", quantity: 1,
      role: isSv ? "FRL-enhet (Filter-Regulator-Smörjare)" : "FRL unit (Filter-Regulator-Lubricator)",
      reason: isSv
        ? "OBLIGATORISK för pneumatiskt system — luftberedning säkerställer rätt arbetstryck, filtrerad luft (≥40 µm) och smörjning av cylindertätningar. Välj regulator med manometer 0–10 bar."
        : "MANDATORY for pneumatic system — air preparation ensures correct working pressure, filtered air (≥40 µm) and seal lubrication. Select regulator with pressure gauge 0–10 bar.",
    });
  }

  // ── 6. Shock absorbers (high speed ≥1000 mm/s) ───────────────────
  if (isHighSpeed) {
    rows.push({
      sku: "SPECIFY", quantity: 2,
      role: isSv ? "Hydraulisk stötdämpare" : "Hydraulic shock absorber",
      reason: isSv
        ? "OBLIGATORISK vid slaghastighet >1 m/s — förhindrar skador på cylinderände och maskinkonstruktion. Välj justerbar hydraulisk stötdämpare dimensionerad för cylinderkraft och massa."
        : "MANDATORY at stroke speed >1 m/s — prevents end-stop damage to cylinder and machine frame. Select adjustable hydraulic shock absorber sized for cylinder force and mass.",
    });
  }

  // ── 7. End-position sensors (2 pcs, one per end) ─────────────────
  if (isEndPosDetect && isPneumatic) {
    const sensorMatch = findCatalogProductByType("sensor", products);
    rows.push({
      sku: sensorMatch?.sku ?? "SPECIFY", quantity: 2,
      role: isSv ? "Ändlägesgivare (hemläge + utsträckt läge)" : "End-position sensor (home + extended)",
      reason: isSv
        ? "OBLIGATORISK — 2 st magnetgivare för T-spår (en per ändläge) krävs för PLC-feedback. Välj givare kompatibel med cylinderprofil och styrsystem (24 V DC NPN/PNP)."
        : "MANDATORY — 2 T-slot magnetic sensors (one per end position) required for PLC feedback. Select sensor matching cylinder profile and control voltage (24 V DC NPN/PNP).",
    });
  }

  return rows;
}

// ── ACTION: questions ─────────────────────────────────────────────────────────
async function handleQuestions(description: string, locale: string): Promise<Response> {
  const isSv = locale === "sv";
  // Skip PDF context for questions step — questions are short and context bloats tokens.
  // PDF context is more valuable in the options step where catalog matching matters.
  const pdfCtx = "";
  const lang = isSv ? "svenska" : "English";
  const isMulti = needsMultiAxis(description);
  const isVac = needsVacuumGrip(description);
  const isWashdown = needsWashdown(description);
  const isVertical = needsVerticalLoad(description);
  const isFoodGrade = /livsmedel|food|slakteri|chark|mejeri|kött|meat|poultry|fjäderfä|dairy|fisk|fish|bageri|brewery|nsf|h1\b/i.test(description);
  const isSafetyMentioned = /livsfara|fallskydd|safe.stop|nödstopp|låsenhet|locking|sil\b|pl[bcd]\b|skyddsdörr|skyddsgrind|guard/i.test(description);
  const isElectric = /elektrisk|electric|servo|stepper|elaxel|eldriven|kuggrem|ball.screw/i.test(description);
  const isCylinder = !isElectric;
  const strokeStated = /(\d{2,4})\s*mm/i.test(description);
  const isCleanroom = !isWashdown && /\brenrum\b|\bcleanroom\b|\bclean\s+room\b/i.test(description);
  const hasProtocol = /profinet|ethercat|ethernet.ip|devicenet|canopen/i.test(description);

  const contextRules = [
    isMulti ? `- MULTI-AXIS SYSTEM DETECTED. Ask about EACH axis separately (stroke X, stroke Z/lift). Make clear in summary that multiple axes are needed.` : "",
    isVac   ? `- SENSITIVE ITEM DETECTED (PCB/glass/delicate). Ask about gripper type: recommend vacuum suction cups, ask if ESD-safe materials are required.` : "",
    (isCylinder || isElectric) && !strokeStated
      ? `- STROKE NOT STATED: You MUST include a question asking for the required stroke/travel length (mm). This is mandatory for actuator selection.` : "",
    isElectric
      ? `- ELECTRIC SYSTEM: Ask about required repeatability/accuracy (±0.05 mm? ±0.5 mm?), max speed (m/s), and drive type preference (ball screw = precise, belt = fast).` : "",
    // Washdown / food-grade: ask about IP class and material — NOT cleanroom ISO class
    isWashdown
      ? `- WASHDOWN / FOOD-GRADE ENVIRONMENT DETECTED. Do NOT ask about cleanroom ISO class. Instead ask:\n  (1) Required IP protection class: IP67 (splash/immersion) or IP69K (high-pressure steam/chemical jets, 100 bar, 80°C)?\n  (2) Material class: Stainless steel 316L, food-grade plastic (POM/PA), or standard with coating?\n  (3) Certifications needed: FDA / EC 1935/2004 / EHEDG?\n  (4) Lubrication requirement: Standard grease or NSF-H1 food-grade lubricant (mandatory for direct food contact zones)?`
      : "",
    // Vertical + safety — ALWAYS ask about SIL/PL if vertical load with safety mention
    isVertical && isSafetyMentioned
      ? `- VERTICAL AXIS WITH SAFETY HAZARD DETECTED. You MUST ask:\n  (1) Required safety integrity level: SIL 1 / SIL 2 / SIL 3 (IEC 62061) or Performance Level PL c / PL d / PL e (ISO 13849)?\n  (2) Mechanical holding requirement: Spring-applied rod lock (pneumatic cylinder) OR integrated motor brake (electric axis) OR external locking unit?\n  (3) Fail-safe behavior: Hold position on power loss (spring-set brake) or controlled retract?`
      : (isVertical
        ? `- VERTICAL AXIS DETECTED. Ask about mechanical holding: spring-applied brake or external locking unit required?`
        : ""),
    // Food + washdown: explicitly probe for NSF-H1 and EHEDG if not already covered
    isFoodGrade && !isWashdown
      ? `- FOOD INDUSTRY APPLICATION: Ask about lubrication (NSF-H1 required for food contact zones?) and surface finish (Ra ≤ 0.8 µm for EHEDG?).`
      : "",
    // Cleanroom (only if NOT washdown — they are different environments)
    isCleanroom
      ? `- CLEANROOM DETECTED: ask about ISO class, note pneumatics may be excluded in high-class rooms.` : "",
    hasProtocol
      ? `- COMMUNICATION PROTOCOL ALREADY STATED in description. Do NOT ask about it again unless clarification is needed. Accept the stated protocol.`
      : "",
    `- If stroke is already stated, do NOT ask if they want a longer stroke. Accept stated value as absolute.`,
    `- Do NOT ask hypothetical questions. Only ask what is needed to select the right product.`,
    `- If programmable stops: ask about number of positions and accuracy.`,
    `- CRITICAL: Every question MUST have a completely unique id AND unique label. NEVER repeat the same question twice. No duplicates allowed.`,
  ].filter(Boolean).join("\n");

  const system = `You are a senior automation engineer. Generate 4-6 precise technical questions. All text in ${lang}.\n\nRULES:\n${contextRules}\n\nJSON:\n{ "summary": "one precise sentence in ${lang}", "questions": [ { "id": "snake_case", "label": "question in ${lang}", "hint": "why this matters", "type": "choice", "options": ["opt1","opt2"] } ] }\ntype = 'choice' (with options) or 'number' (with unit).${pdfCtx ? "\n\nDocs:\n" + pdfCtx : ""}`;

  try {
    const raw = await callGroq([
      { role: "system", content: system },
      { role: "user", content: `Application: ${description}` },
    ], 1200, true, 0.2, LLM_MODEL_FAST);
    if (!raw) return Response.json({ summary: "", questions: [] }, { headers: CORS });
    try {
      const parsed = JSON.parse(raw);
      // Deduplicate by id first, then by label prefix
      const seenIds = new Set<string>();
      const seenLabels = new Set<string>();
      parsed.questions = (parsed.questions ?? []).filter((q: { id: string; label: string }) => {
        const labelKey = q.label?.toLowerCase().replace(/\s+/g, " ").slice(0, 40) ?? "";
        if (seenIds.has(q.id) || seenLabels.has(labelKey)) return false;
        seenIds.add(q.id);
        seenLabels.add(labelKey);
        return true;
      }).slice(0, 6); // T19: hard cap at 6 questions
      return Response.json(parsed, { headers: CORS });
    }
    catch { return Response.json({ summary: "", questions: [] }, { headers: CORS }); }
  } catch (e) {
    if ((e as Error).message === "RATE_LIMITED") {
      return Response.json({ error: "rate_limited" }, { status: 503, headers: CORS });
    }
    return Response.json({ summary: "", questions: [] }, { headers: CORS });
  }
}

// ── ACTION: options (v40) ─────────────────────────────────────────────────────
// v40: Server selects top 3 products deterministically; LLM only writes badge/why/pros/cons.
// This eliminates hallucinated SKUs and inconsistent product selection.
async function handleOptions(
  description: string, answers: Record<string, string>, locale: string
): Promise<Response> {
  const isSv = locale === "sv";
  const combinedText = description + " " + Object.values(answers).join(" ");
  const categories = detectCategories(combinedText);
  const minStroke = extractMinStroke(answers, description);
  const isCleanroom = /\brenrum\b|\bcleanroom\b|\bclean\s+room\b/i.test(combinedText);
  const needsProgrammable = /programmer|stopp-position|servo|positioner/i.test(combinedText);
  const isMultiAxis = needsMultiAxis(combinedText);
  const isVacuum = needsVacuumGrip(combinedText);
  const valveTerminal = needsValveTerminal(combinedText);
  const isWashdown = needsWashdown(combinedText);
  const isAtex = needsAtex(combinedText);
  const isAtexDust = needsAtexDust(combinedText);
  const isVerticalLoad = needsVerticalLoad(combinedText);
  const isHighTemp = needsHighTemp(combinedText);
  const isLowTemp = needsLowTemp(combinedText);
  const isHydraulic = isHydraulicApplication(combinedText);
  const isVeryHighForce = needsVeryHighForce(combinedText, answers);
  const isOxygenClean = needsOxygenClean(combinedText);
  const isHighCycle = needsHighCycle(combinedText, answers);
  const isHighSpeed = needsHighSpeed(combinedText, answers);
  const isSilSafety = needsSilSafety(combinedText);
  const isOutdoor = needsOutdoor(combinedText);
  const isPharmaGmp = needsPharmaGmp(combinedText);
  const isBatteryDryroom = needsBatteryDryroom(combinedText);
  const speedMs = extractSpeedMs(combinedText, answers);
  const precisionMm = extractPrecisionMm(combinedText, answers);
  const isHighPrecision = precisionMm > 0 && precisionMm <= 0.1;
  const isHighPrecisionVertical = isVerticalLoad && isHighPrecision;
  const requiredTemp = extractRequiredMaxTemp(combinedText, answers);

  const perAxisStrokes = isMultiAxis ? extractPerAxisStrokes(answers) : [];
  const maxRequiredStroke = perAxisStrokes.length > 0
    ? Math.max(...perAxisStrokes.map(a => a.stroke))
    : minStroke;

  const [allProducts, pdfCtx] = await Promise.all([
    fetchProducts(categories, 80),
    searchKnowledge(combinedText, 5),
  ]);
  const productMap = new Map<string, CatalogProduct>(allProducts.map(p => [p.sku, p]));

  // ── Hard pre-filters (unchanged from v39) ────────────────────────
  const atexFiltered = isAtex ? allProducts.filter(p => !isElectricActuator(p)) : allProducts;
  const washdownFiltered = isWashdown ? atexFiltered.filter(p => isWashdownProduct(p)) : atexFiltered;
  const applyPrecisionFilter = isHighPrecision && (!isMultiAxis || isHighPrecisionVertical);
  const precisionFiltered = applyPrecisionFilter ? washdownFiltered.filter(p => isAllowedForHighPrecision(p)) : washdownFiltered;
  const applySpeedFilter = speedMs > 0.8 && !isHighPrecision && !isAtex;
  const speedFiltered = applySpeedFilter ? precisionFiltered.filter(p => isAllowedForHighSpeed(p)) : precisionFiltered;

  const qualified: CatalogProduct[] = [];
  let bestFallback: CatalogProduct | null = null;
  let bestFallbackStroke = 0;
  let maxCatalogStroke = 0;
  for (const p of speedFiltered) {
    const maxStroke = parseStrokeFromSpecs(p.key_specs ?? {});
    if (maxStroke > maxCatalogStroke) maxCatalogStroke = maxStroke;
    if (maxRequiredStroke === 0 || maxStroke === 0) qualified.push(p);
    else if (maxStroke >= maxRequiredStroke) qualified.push(p);
    else if (maxStroke > bestFallbackStroke) { bestFallbackStroke = maxStroke; bestFallback = p; }
  }
  const showProducts = qualified.length > 0 ? qualified : (bestFallback ? [bestFallback] : (isWashdown ? allProducts : []));
  const catalogCanHandle = qualified.length > 0;

  const tempFiltered = requiredTemp > 0
    ? showProducts.filter(p => { const t = parseProductTempMax(p.key_specs ?? {}); return t === 0 || t >= requiredTemp; })
    : showProducts;

  const sortedProducts = sortByStrokeMatch(tempFiltered.length > 0 ? tempFiltered : showProducts, maxRequiredStroke);
  const catalogProducts = sortedProducts.slice(0, 25);
  console.log(`[options v40] categories=${categories} stroke=${maxRequiredStroke} qualified=${qualified.length} catalog=${catalogProducts.length}`);

  // ── v40: Server-side product selection ───────────────────────────
  // Score every product deterministically, pick top 3 actuators
  const scoringCtx: ScoringCtx = { requiredStroke: maxRequiredStroke, isHighPrecision, isHighSpeed, isVertical: isVerticalLoad, isWashdown, isAtex };
  const scoredActuators = catalogProducts
    .filter(p => parseStrokeFromSpecs(p.key_specs ?? {}) > 0 || maxRequiredStroke === 0)
    .map(p => ({ p, s: scoreProduct(p, scoringCtx) }))
    .sort((a, b) => b.s - a.s);

  const topProducts = scoredActuators.slice(0, 3).map(x => x.p);

  // Build server-side option objects (correct data, LLM fills in text)
  const lang = isSv ? "svenska" : "English";
  const badgeList = isSv
    ? "'Bästa valet'|'Kompakt alternativ'|'Budgetalternativ'|'Premium alternativ'|'Närmaste katalogalternativ'"
    : "'Best choice'|'Compact option'|'Budget option'|'Premium option'|'Closest catalog option'";

  const serverOptions = topProducts.map((p, i) => {
    const ms = parseStrokeFromSpecs(p.key_specs ?? {});
    return {
      sku: p.sku, name: p.name,
      badge: isSv ? ["Bästa valet","Kompakt alternativ","Budgetalternativ"][i] : ["Best choice","Compact option","Budget option"][i],
      bore_mm: parseFloat(String(p.key_specs?.bore_mm ?? "0")) || null,
      stroke_mm: ms > 0 ? ms : null,
      force_n: parseFloat(String(p.key_specs?.force_n ?? "0")) || null,
      why: "", pros: [] as string[], cons: [] as string[],
    };
  });

  // ── LLM enrichment: text only, SKUs are pre-locked ───────────────
  const reqSummary = [
    maxRequiredStroke > 0 ? `Stroke: ${maxRequiredStroke} mm` : "",
    precisionMm > 0 ? `Precision: ±${precisionMm} mm` : "",
    isVerticalLoad ? (isSv ? "Vertikal last" : "Vertical load") : "",
    isWashdown ? "Washdown/IP69K" : "",
    isAtex ? "ATEX Zone 1/2" : "",
    isHighSpeed ? `Hög hastighet ${(speedMs*1000).toFixed(0)} mm/s` : "",
  ].filter(Boolean).join(" | ");

  const preselectedStr = topProducts.map((p, i) =>
    `${i+1}. SKU="${p.sku}" | ${p.name} [${p.brand}/${p.category}] stroke=${strokeLabel(p.key_specs??{})} specs:${JSON.stringify(p.key_specs??{})}`
  ).join("\n");

  const optSystem = `You are a senior automation engineer. Write product descriptions for 3 pre-selected products. All text in ${lang}.

MANDATORY RULES:
1. Use EXACTLY these SKUs: ${topProducts.map(p => p.sku).join(", ")} — do NOT change them
2. First product gets badge ${isSv ? "'Bästa valet'" : "'Best choice'"}, others get appropriate badges from: ${badgeList}
3. "why" = engineering justification (mechanism, stroke fit, safety, material) — be specific, mention numbers
4. pros: 2-3 items, cons: 1-2 items

JSON: { "summary": "1-2 sentences: mechanism + safety", "options": [ { "sku": "EXACT_SKU", "badge": "...", "why": "...", "pros": [...], "cons": [...] } ] }`;

  const optUser = `Application: ${description}\nRequirements: ${reqSummary || "standard"}\n${Object.entries(answers).map(([k,v])=>`${k}: ${v}`).join(", ")}\n\nPre-selected products (write descriptions for these ONLY):\n${preselectedStr}${pdfCtx ? `\n\nDocs:\n${pdfCtx}` : ""}`;

  let rawOptions: string | null = null;
  let optRateLimited = false;
  try { rawOptions = await callGroq([{ role: "system", content: optSystem }, { role: "user", content: optUser }], 1200, true, 0.3); }
  catch (e) { if ((e as Error).message === "RATE_LIMITED") optRateLimited = true; }

  // Merge: server data (authoritative) + LLM text
  let finalOptions = [...serverOptions] as Array<Record<string, unknown>>;
  let llmSummary = "";
  if (rawOptions) {
    try {
      const llm = JSON.parse(rawOptions);
      llmSummary = typeof llm.summary === "string" ? llm.summary : "";
      const llmBySkuMap = new Map<string, Record<string, unknown>>();
      for (const o of (llm.options ?? [])) if (o?.sku) llmBySkuMap.set(o.sku as string, o);
      finalOptions = finalOptions.map(opt => {
        const llmOpt = llmBySkuMap.get(opt.sku as string);
        if (!llmOpt) return opt;
        return {
          ...opt,
          badge: (typeof llmOpt.badge === "string" && llmOpt.badge) ? llmOpt.badge : opt.badge,
          why:   (typeof llmOpt.why === "string" && llmOpt.why)     ? llmOpt.why   : opt.why,
          pros:  (Array.isArray(llmOpt.pros) && llmOpt.pros.length) ? llmOpt.pros  : opt.pros,
          cons:  (Array.isArray(llmOpt.cons) && llmOpt.cons.length) ? llmOpt.cons  : opt.cons,
        };
      });
    } catch { /* ignore — use server defaults */ }
  }

  // ── Server-side post-validation (stroke, washdown, precision, temp) ──
  finalOptions = finalOptions.map(opt => {
    const sku = opt.sku as string;
    if (sku === "CUSTOM-SOLUTION") return opt;
    const cat = productMap.get(sku);
    if (!cat) return opt;
    const actualMax = parseStrokeFromSpecs(cat.key_specs ?? {});
    opt.stroke_mm = actualMax > 0 ? actualMax : null;
    if (maxRequiredStroke > 0 && actualMax > 0 && actualMax < maxRequiredStroke) {
      opt.badge = isSv ? "Närmaste katalogalternativ" : "Closest catalog option";
      opt.why = `${opt.why} ⚠️ Max stroke ${actualMax} mm — krav ${maxRequiredStroke} mm.`;
    }
    if (isWashdown && !isWashdownProduct(cat)) {
      opt.badge = isSv ? "Närmaste katalogalternativ" : "Closest catalog option";
      opt.why = `${opt.why} ⚠️ Standardprodukt — verifiera korrosionsskydd för washdown-miljö.`;
    }
    if (isHighPrecision && !isAllowedForHighPrecision(cat)) {
      const ft = isPneumaticActuatorProduct(cat) ? "pneumatisk cylinder" : "kuggremsdrift";
      const crit = isSv
        ? `⛔ KRITISKT FEL: ${ft} kan INTE uppnå ±${precisionMm} mm. Krävs: kulskruvsaxel.`
        : `⛔ CRITICAL FAILURE: ${ft} CANNOT achieve ±${precisionMm} mm. Required: ball-screw axis.`;
      opt.badge = isSv ? "Närmaste katalogalternativ" : "Closest catalog option";
      opt.why = crit + " " + opt.why;
      opt.cons = [...((opt.cons as string[]) ?? []), crit];
    }
    if (isHighSpeed && isBallScrewProduct(cat)) {
      const warn = isSv
        ? `⚠️ Kulskruvsaxel vid ${(speedMs*1000).toFixed(0)} mm/s — risk för vibration och slitage. Överväg kuggremsdrift (EGSC/ELGC-TB).`
        : `⚠️ Ball-screw at ${(speedMs*1000).toFixed(0)} mm/s — vibration and wear risk. Consider belt drive (EGSC/ELGC-TB).`;
      opt.cons = [...((opt.cons as string[]) ?? []), warn];
    }
    if (isBatteryDryroom) {
      const warn = isSv
        ? `⚠️ Dryroom: Verifiera Cu/Zn/Ni-frihet i alla rörliga delar. Begär materialcertifikat.`
        : `⚠️ Dryroom: Verify Cu/Zn/Ni-free in all moving parts. Request material certificate.`;
      opt.cons = [...((opt.cons as string[]) ?? []), warn];
    }
    if (requiredTemp > 0) {
      const tMax = parseProductTempMax(cat.key_specs ?? {});
      if (tMax > 0 && tMax < requiredTemp) {
        opt.badge = isSv ? "Närmaste katalogalternativ" : "Closest catalog option";
        opt.why = `⛔ Temp ${tMax}°C < krav ${requiredTemp}°C. ` + opt.why;
      }
    }
    return opt;
  });

  // Always append CUSTOM-SOLUTION
  const customCtx: CustomSolutionContext = {
    isWashdown, isVertical: isVerticalLoad,
    isFoodGrade: isPharmaGmp || /livsmedel|food|slakteri|chark|mejeri|kött|meat|poultry|fjäderfä|dairy|fisk|fish|bageri|brewery/i.test(combinedText),
    isBatteryDryroom, isHydraulic, isAtex, isSilSafety,
  };
  finalOptions.push(buildCustomSolutionOption(maxRequiredStroke, isSv, maxCatalogStroke, catalogCanHandle, customCtx));

  const summary = llmSummary || (isSv
    ? `${topProducts.length} alternativ valda baserat på krav${maxRequiredStroke > 0 ? ` (slag ${maxRequiredStroke} mm)` : ""}.`
    : `${topProducts.length} options selected for ${maxRequiredStroke > 0 ? `${maxRequiredStroke} mm stroke` : "this application"}.`);

  if (optRateLimited) return Response.json({ error: "rate_limited" }, { status: 503, headers: CORS });
  return Response.json({ summary, options: finalOptions }, { headers: CORS });
}

// ── ACTION: bom (v40) ─────────────────────────────────────────────────────────
// v40: Mandatory BOM is built deterministically BEFORE calling LLM.
// If LLM is rate-limited, the BOM skeleton is returned as-is — never an empty BOM.
async function handleBom(
  description: string, answers: Record<string, string>, primarySku: string, locale: string
): Promise<Response> {
  const isSv = locale === "sv";
  const combinedText = (description ?? "") + " " + Object.values(answers).join(" ");
  const categories = detectCategories(combinedText);
  const isAtex = needsAtex(combinedText);
  const isAtexDust = needsAtexDust(combinedText);
  const isVerticalLoad = needsVerticalLoad(combinedText);
  const isHighTemp = needsHighTemp(combinedText);
  const isLowTemp = needsLowTemp(combinedText);
  const isHydraulic = isHydraulicApplication(combinedText);
  const isVeryHighForce = needsVeryHighForce(combinedText, answers);
  const isOxygenClean = needsOxygenClean(combinedText);
  const isHighCycle = needsHighCycle(combinedText, answers);
  const isHighSpeed = needsHighSpeed(combinedText, answers);
  const isSilSafety = needsSilSafety(combinedText);
  const isOutdoor = needsOutdoor(combinedText);
  const isPharmaGmp = needsPharmaGmp(combinedText);
  const isBatteryDryroom = needsBatteryDryroom(combinedText);
  const speedMs = extractSpeedMs(combinedText, answers);
  const precisionMm = extractPrecisionMm(combinedText, answers);
  const isHighPrecision = precisionMm > 0 && precisionMm <= 0.1;
  const isElectric = !isAtex && !isAtexDust && categories.some(c => c === "electric-actuator" || c === "linear-module");
  const isCleanroom = /\brenrum\b|\bcleanroom\b|\bclean\s+room\b/i.test(combinedText);
  const isMultiAxis = needsMultiAxis(combinedText);
  const isVacuum = needsVacuumGrip(combinedText);
  const valveTerminal = needsValveTerminal(combinedText);
  const isWashdown = needsWashdown(combinedText);
  const isEndPosDetect = needsEndPositionDetection(combinedText);
  const minStroke = extractMinStroke(answers, description);
  const primaryIsFamilyProd = isFamilyProduct({ sku: primarySku, name: "", category: "", brand: "", key_specs: {} });

  const bomCategories = [
    ...categories,
    isVacuum      ? "vacuum" : null,
    valveTerminal ? "valve-terminal" : null,
    "sensor",
    isElectric    ? "cable" : "fitting",
    !isElectric   ? "frl" : null,
  ].filter(Boolean) as string[];

  const [products, pdfCtx] = await Promise.all([
    fetchProducts([...new Set(bomCategories)], 30),
    searchKnowledge(combinedText + " BOM komplett system", 5),
  ]);

  // ATEX: strip electric actuators
  const atexSafeProducts = (isAtex || isAtexDust) ? products.filter(p => !isElectricActuator(p)) : products;
  const validBomSkus = new Set(atexSafeProducts.map(p => p.sku));
  validBomSkus.add("SPECIFY");
  validBomSkus.add(primarySku);

  // ── v40: Build complete mandatory BOM deterministically ─────────────────────
  const bomCtx: BomCtx = {
    primarySku, primaryIsFamilyProd, isElectric, isAtex, isAtexDust,
    isVerticalLoad, isHighSpeed, valveTerminal, isEndPosDetect, isVacuum, isSv,
    products: atexSafeProducts,
  };
  const mandatoryBom = buildMandatoryBomRows(bomCtx);
  console.log(`[bom v40] primary=${primarySku} electric=${isElectric} vertical=${isVerticalLoad} highSpeed=${isHighSpeed} valveTerminal=${valveTerminal} mandatoryRows=${mandatoryBom.length}`);

  // ── LLM enrichment: title + explanation + optional extras ─────────────────
  const lang = isSv ? "svenska" : "English";
  const perAxisStrokes = isMultiAxis ? extractPerAxisStrokes(answers) : [];
  const axisStrokeNote = isMultiAxis && perAxisStrokes.length > 0
    ? `Per-axis strokes: ${perAxisStrokes.map(a => `${a.axis}=${a.stroke}mm`).join(", ")}.`
    : "";

  // ── Accessory catalog for LLM ─────────────────────────────────────────────
  // For multi-axis systems, include actuators; for single-axis, accessories only
  const accessoryCatalog = balancedSlice(atexSafeProducts, isMultiAxis ? 30 : 20)
    .filter(p => isMultiAxis || parseStrokeFromSpecs(p.key_specs ?? {}) === 0)
    .slice(0, isMultiAxis ? 20 : 10)
    .map(p => {
      const ks = p.key_specs ?? {};
      const s = ks.stroke_mm ? ` stroke=${String(ks.stroke_mm).replace(/\s*mm/i,"")}mm` : "";
      const b = ks.bore_mm ? ` bore=${String(ks.bore_mm).replace(/\s*mm/i,"")}mm` : "";
      const fam = isFamilyProduct(p) ? " [FAMILY]" : "";
      return `${p.sku}: ${p.name} [${p.brand}/${p.category}]${s}${b}${fam}`;
    }).join("\n");

  // Build skeleton description for LLM context
  const skeletonStr = mandatoryBom.map(r => `  SKU="${r.sku}" qty=${r.quantity} | ${r.role}`).join("\n");

  const reqLines = Object.entries(answers)
    .map(([k, v]) => { let l = k.replace(/_/g, " "); if (!isMultiAxis) l = l.replace(/\s*[xyz]$/i, "").trim(); return `${l}: ${v}`; })
    .join(", ");

  const specialConstraints = [
    isAtex    ? (isSv ? "⛔ ATEX Zone 1/2 — inga elektriska komponenter." : "⛔ ATEX Zone 1/2 — no electric components.") : "",
    isAtexDust ? (isSv ? "⛔ ATEX Zone 20/21/22 damm." : "⛔ ATEX Zone 20/21/22 dust.") : "",
    isHighPrecision ? (isSv ? `⛔ Precision ±${precisionMm}mm — kulskruv obligatorisk.` : `⛔ Precision ±${precisionMm}mm — ball screw mandatory.`) : "",
    isWashdown ? (isSv ? "⚠️ Washdown IP69K." : "⚠️ Washdown IP69K.") : "",
    isPharmaGmp ? (isSv ? "⚠️ GMP/FDA — 316L, PTFE, EPDM." : "⚠️ GMP/FDA — 316L, PTFE, EPDM.") : "",
    isBatteryDryroom ? (isSv ? "⛔ Dryroom — absolut Cu/Zn/Ni-förbud." : "⛔ Dryroom — Cu/Zn/Ni ban.") : "",
    isHydraulic || isVeryHighForce ? (isSv ? "⚠️ Hydraulik/hög kraft — utanför pneumatisk katalog." : "⚠️ Hydraulic/high force — outside pneumatic catalog.") : "",
    isHighTemp ? (isSv ? "⚠️ Hög temp >80°C — PTFE/FKM-tätning krävs." : "⚠️ High temp >80°C — PTFE/FKM seals required.") : "",
    isOxygenClean ? (isSv ? "⛔ Syrgasmiljö — oljefria komponenter." : "⛔ Oxygen atmosphere — oil-free only.") : "",
    isSilSafety ? (isSv ? "⚠️ SIL/PL säkerhetsfunktion — certifierad ventil krävs." : "⚠️ SIL/PL safety function — certified valve required.") : "",
  ].filter(Boolean).join(" ");

  const multiAxisInstructions = isMultiAxis
    ? `\nMULTI-AXIS: Add per-axis rows for secondary actuators (one per axis). Role labels: "Aktuator — X-axel", "Aktuator — Z-axel", "Servomodul — Z-axel" etc. ${axisStrokeNote}`
    : `\nSINGLE AXIS: Add 0-2 accessories (fittings, cables, brackets) if genuinely needed. Do NOT add extra actuators.`;

  const bomSystem = `You are a senior automation engineer writing a BOM description. All text in ${lang}.

MANDATORY BOM skeleton — DO NOT MODIFY THESE ROWS (built by engineering rules):
${skeletonStr}

Your tasks:
1. Write a concise technical title (5-8 words)
2. Write explanation (2-3 sentences): system type, safety approach, key spec
3. Add extra rows as instructed below${multiAxisInstructions}
4. Do NOT remove, replace or re-order mandatory rows
${specialConstraints ? `\nConstraints: ${specialConstraints}` : ""}

Available catalog items for extras:
${accessoryCatalog || "(none — use SPECIFY if needed)"}

JSON: { "title": "...", "explanation": "...", "extras": [ { "sku": "SKU_OR_SPECIFY", "quantity": 1, "role": "...", "reason": "..." } ] }`;

  const bomUser = `Application: ${description}\nRequirements: ${reqLines || "standard"}\nPrimary: ${primarySku}${pdfCtx ? `\n\nDocs:\n${pdfCtx}` : ""}`;

  // ── Call LLM — if rate-limited, skip gracefully (mandatory BOM is already built) ──
  let raw: string | null = null;
  let wasRateLimited = false;
  try { raw = await callGroq([{ role: "system", content: bomSystem }, { role: "user", content: bomUser }], 1000, true); }
  catch (e) { if ((e as Error).message === "RATE_LIMITED") wasRateLimited = true; }

  // Parse LLM enrichment
  let title = "";
  let explanation = "";
  let extras: Array<{ sku: string; quantity: number; role: string; reason: string }> = [];
  if (raw) {
    try {
      const llm = JSON.parse(raw);
      title = typeof llm.title === "string" ? llm.title : "";
      explanation = typeof llm.explanation === "string" ? llm.explanation : "";
      if (Array.isArray(llm.extras)) {
        extras = llm.extras.filter((e: { sku: string }) => e?.sku && (e.sku === "SPECIFY" || validBomSkus.has(e.sku))).slice(0, isMultiAxis ? 6 : 2);
      }
    } catch { /* ignore */ }
  }

  // Auto-generate title/explanation when LLM is unavailable
  if (!title) {
    title = isSv
      ? `${isElectric ? "Elektrisk" : "Pneumatisk"}${isVerticalLoad ? " vertikal" : ""}${isMultiAxis ? " flerraxlad" : ""} aktuator — ${primarySku}`
      : `${isElectric ? "Electric" : "Pneumatic"}${isVerticalLoad ? " vertical" : ""}${isMultiAxis ? " multi-axis" : ""} actuator — ${primarySku}`;
  }
  if (!explanation) {
    explanation = isSv
      ? `System baserat på ${primarySku}. ${isElectric ? "Elektrisk servoaxel för precision och repeterbarhet." : "Pneumatisk cylinder med komplett luftberedning (FRL + ventil)."} ${isVerticalLoad ? (isElectric ? "Bromsmotor obligatorisk för lastsäkerhet vid strömavbrott." : "Backslagsventil förhindrar lastfall vid lufttrycksförlust.") : ""}${wasRateLimited ? " [Automatgenererad — AI tillfälligt otillgänglig]" : ""}`
      : `System based on ${primarySku}. ${isElectric ? "Electric servo axis for precision and repeatability." : "Pneumatic cylinder with complete air preparation (FRL + valve)."} ${isVerticalLoad ? (isElectric ? "Brake motor mandatory for load safety on power loss." : "Check valve prevents load drop on air pressure loss.") : ""}${wasRateLimited ? " [Auto-generated — AI temporarily unavailable]" : ""}`;
  }

  // Validate extras SKUs
  const validExtras = extras.map(e => validBomSkus.has(e.sku) || e.sku === "SPECIFY" ? e : { ...e, sku: "SPECIFY", reason: e.reason + " [SKU ej verifierad]" });

  // Final BOM = mandatory rows + validated extras
  // For ATEX: strip any electric SKU that might have slipped in via extras
  const electricSKUs = new Set(products.filter(p => isElectricActuator(p)).map(p => p.sku));
  const finalBom = [...mandatoryBom, ...validExtras].filter(row => {
    if (!isAtex && !isAtexDust) return true;
    if (row.sku === primarySku || row.sku === "SPECIFY") return true;
    if (electricSKUs.has(row.sku)) { console.warn(`[bom v40] ATEX stripped: ${row.sku}`); return false; }
    return true;
  });

  return Response.json({ title, explanation, bom: finalBom }, { headers: CORS });
}


// ── ACTION: chat ──────────────────────────────────────────────────────────────
async function handleChat(
  messages: Array<{ role: string; content: string }>, contextQuery?: string
): Promise<Response> {
  const pdfCtx = contextQuery ? await searchKnowledge(contextQuery, 5) : "";
  const system = `Du är Maskinvals AI-assistent, expert på industriell automation. Hjälper ingenjörer välja komponenter och lösa tekniska problem. Svar på svenska.${pdfCtx ? `\n\nReferensdokumentation:\n${pdfCtx}` : ""}`;
  const raw = await callGroq([{ role: "system", content: system }, ...messages], 4000, false);
  if (!raw) return Response.json({ reply: "Kunde inte svara just nu. Försök igen." }, { headers: CORS });
  return Response.json({ reply: raw }, { headers: CORS });
}

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    const body = await req.json();
    const { action, description, answers, messages, primarySku, contextQuery, locale } = body;
    const loc = locale ?? "sv";
    if (action === "questions") return handleQuestions(description ?? "", loc);
    if (action === "options")   return handleOptions(description ?? "", answers ?? {}, loc);
    if (action === "bom")       return handleBom(description ?? "", answers ?? {}, primarySku ?? "", loc);
    if (action === "chat")      return handleChat(messages ?? [], contextQuery);
    return Response.json({ error: "Unknown action" }, { status: 400, headers: CORS });
  } catch (e) {
    console.error("groq-advisor error:", e);
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});

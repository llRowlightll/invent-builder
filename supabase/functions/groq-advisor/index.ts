import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
// Groq models — separate TPD pools per model
const LLM_MODEL = "llama-3.3-70b-versatile";   // options + BOM (needs full intelligence)
const LLM_MODEL_FAST = "llama-3.1-8b-instant";  // questions only (500K TPD, separate pool)
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
      return Array.isArray(data) ? data : [];
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
  if (/ventilterminal|valve.terminal|vtug|vtsa|mpa\b|cpv\b|ventilblock|manifold|fördelare/i.test(t))
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
  for (const m of allText.matchAll(/(\d{2,5})\s*mm/gi)) {
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
        const axisMatch = k.match(/[xyz]$/i);
        result.push({ axis: axisMatch ? axisMatch[0].toUpperCase() : "?", stroke: n });
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
    /ventilterminal|valve.terminal|vtug|vtsa|mpa\b|cpv\b|ventilblock|manifold/i.test(text) ||
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
  return /\b[1-9](?:[.,]\d+)?\s*m\/s\b|\bsnabb.*rörelse\b|\bhigh.*speed\b|\bhög.*hastighet\b|\bfast.*actuat\b|\bsnabb.*stans\b|\bslaghastighet.*[1-9]\b/i.test(allText);
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
  ].filter(Boolean).join("\n");

  const system = `You are a senior automation engineer. Generate 4-6 precise technical questions. All text in ${lang}.\n\nRULES:\n${contextRules}\n\nJSON:\n{ "summary": "one precise sentence in ${lang}", "questions": [ { "id": "snake_case", "label": "question in ${lang}", "hint": "why this matters", "type": "choice", "options": ["opt1","opt2"] } ] }\ntype = 'choice' (with options) or 'number' (with unit).${pdfCtx ? "\n\nDocs:\n" + pdfCtx : ""}`;

  try {
    const raw = await callGroq([
      { role: "system", content: system },
      { role: "user", content: `Application: ${description}` },
    ], 1200, true, 0.2, LLM_MODEL_FAST);
    if (!raw) return Response.json({ summary: "", questions: [] }, { headers: CORS });
    try { return Response.json(JSON.parse(raw), { headers: CORS }); }
    catch { return Response.json({ summary: "", questions: [] }, { headers: CORS }); }
  } catch (e) {
    if ((e as Error).message === "RATE_LIMITED") {
      return Response.json({ error: "rate_limited" }, { status: 503, headers: CORS });
    }
    return Response.json({ summary: "", questions: [] }, { headers: CORS });
  }
}

// ── ACTION: options ───────────────────────────────────────────────────────────
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
  // CRITICAL: vertical + precision ≤ 0.1 mm → ONLY ball-screw electric actuators allowed
  const isHighPrecisionVertical = isVerticalLoad && precisionMm > 0 && precisionMm <= 0.1;
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

  // ATEX: strip all electric actuators BEFORE any other filtering — they are categorically forbidden.
  const atexFiltered = isAtex
    ? allProducts.filter(p => !isElectricActuator(p))
    : allProducts;

  // For washdown environments: actuators (products WITH stroke spec) must be IP67/IP69K or stainless.
  // Support items (no stroke spec) are always included.
  const washdownFiltered = isWashdown
    ? atexFiltered.filter(p => isWashdownProduct(p))
    : atexFiltered;

  // PRECISION HARD FILTER (v34 — extended from vertical-only to ALL axes):
  // precision ≤ 0.1 mm → remove pneumatic + belt regardless of orientation.
  // Pneumatic repeatability ~±0.1–0.5 mm. Belt backlash ~0.05–0.3 mm. Both violate ≤0.1 mm budget.
  // Exception: for multi-axis systems, only filter when primary axis has the precision requirement.
  const isHighPrecision = precisionMm > 0 && precisionMm <= 0.1;
  const applyPrecisionFilter = isHighPrecision && (!isMultiAxis || isHighPrecisionVertical);
  const precisionFiltered = applyPrecisionFilter
    ? washdownFiltered.filter(p => isAllowedForHighPrecision(p))
    : washdownFiltered;
  const precisionFilteredCount = washdownFiltered.length - precisionFiltered.length;
  if (applyPrecisionFilter && precisionFilteredCount > 0) {
    console.log(`[options] precision pre-filter: removed ${precisionFilteredCount} pneumatic/belt products (precision=${precisionMm}mm ≤ 0.1mm)`);
  }

  // HIGH-SPEED HARD FILTER (v34): speed > 0.8 m/s AND no precision requirement
  // → remove ball-screw products (resonance, wear, unsuitable for fast cycling).
  // NOT applied when precision ≤ 0.1 mm (precision requirement overrides — ball screw still needed).
  const applySpeedFilter = speedMs > 0.8 && !isHighPrecision && !isAtex;
  const precisionVerticalFiltered = applySpeedFilter
    ? precisionFiltered.filter(p => isAllowedForHighSpeed(p))
    : precisionFiltered;
  const speedFilteredCount = precisionFiltered.length - precisionVerticalFiltered.length;
  if (applySpeedFilter && speedFilteredCount > 0) {
    console.log(`[options] high-speed pre-filter: removed ${speedFilteredCount} ball-screw products (speed=${(speedMs*1000).toFixed(0)}mm/s > 800mm/s, no precision req)`);
  }

  const qualified: CatalogProduct[] = [];
  let bestFallback: CatalogProduct | null = null;
  let bestFallbackStroke = 0;
  let maxCatalogStroke = 0;

  for (const p of precisionVerticalFiltered) {
    const maxStroke = parseStrokeFromSpecs(p.key_specs ?? {});
    if (maxStroke > maxCatalogStroke) maxCatalogStroke = maxStroke;
    if (maxRequiredStroke === 0 || maxStroke === 0) {
      qualified.push(p);
    } else if (maxStroke >= maxRequiredStroke) {
      qualified.push(p);
    } else {
      if (maxStroke > bestFallbackStroke) { bestFallbackStroke = maxStroke; bestFallback = p; }
    }
  }

  // If washdown filter left no qualified actuators, fall back to full list with a warning
  const showProducts = qualified.length > 0 ? qualified : (bestFallback ? [bestFallback] : (isWashdown ? allProducts : []));
  const catalogCanHandle = qualified.length > 0;

  let catalogNote = "";
  if (isWashdown && qualified.length === 0) {
    catalogNote = `CATALOG: No IP67/IP69K or stainless product meets ${maxRequiredStroke}mm stroke. Show closest available and note limitation.`;
  } else if (qualified.length === 0 && bestFallback) {
    catalogNote = `CATALOG: No product meets ${maxRequiredStroke}mm stroke. Longest available: ${bestFallback.name} at ${bestFallbackStroke}mm. Use badge 'Närmaste katalogalternativ'.`;
  } else if (maxRequiredStroke > 0 && precisionVerticalFiltered.length - qualified.length > 0) {
    catalogNote = `CATALOG: ${precisionVerticalFiltered.length - qualified.length} products excluded (stroke < ${maxRequiredStroke}mm).`;
  }
  if (isWashdown) {
    catalogNote = (catalogNote ? catalogNote + " " : "") +
      `WASHDOWN: Only IP67/IP69K or stainless products are shown (${washdownFiltered.length} of ${allProducts.length} total).` +
      (isHighPrecisionVertical ? ` PRECISION-VERTICAL: ${precisionFilteredCount} pneumatic/belt products removed (≤${precisionMm}mm requires ball screw only).` : "");
  }

  // v27: Temperature filter — remove products whose known max temp is below the requirement.
  // Products with NO temp spec (tempMax=0) are kept (we don't block on unknown data).
  const tempFiltered = requiredTemp > 0
    ? showProducts.filter(p => {
        const tempMax = parseProductTempMax(p.key_specs ?? {});
        return tempMax === 0 || tempMax >= requiredTemp;
      })
    : showProducts;
  const tempFilteredCount = showProducts.length - tempFiltered.length;
  if (tempFilteredCount > 0) {
    console.log(`[options] temp filter: removed ${tempFilteredCount} products (tempMax < ${requiredTemp}°C)`);
  }

  // Sort by stroke-relevance, then take top 25.
  const sortedProducts = sortByStrokeMatch(tempFiltered.length > 0 ? tempFiltered : showProducts, maxRequiredStroke);
  const catalogProducts = sortedProducts.slice(0, 25);
  console.log(
    `[options] categories=${categories} minStroke=${minStroke} requiredTemp=${requiredTemp} qualified=${qualified.length}` +
    ` catalog=${catalogProducts.length}/${showProducts.length} isWashdown=${isWashdown}`
  );

  const productList = catalogProducts
    .map(p => `${p.sku}: ${p.name} [${p.brand}/${p.category}] stroke=${strokeLabel(p.key_specs ?? {})} ip=${p.key_specs?.ip_rating ?? "std"} specs:${JSON.stringify(p.key_specs ?? {})}`)
    .join("\n");

  const lang = isSv ? "svenska" : "English";
  const badges = isSv
    ? "'Bästa valet'|'Kompakt alternativ'|'Budgetalternativ'|'Premium alternativ'|'Närmaste katalogalternativ'"
    : "'Best choice'|'Compact option'|'Budget option'|'Premium option'|'Closest catalog option'";

  const multiAxisRule = isMultiAxis
    ? perAxisStrokes.length > 0
      ? `MULTI-AXIS SYSTEM — axis requirements: ${perAxisStrokes.map(a => `${a.axis}-axis ${a.stroke}mm`).join(", ")}.
Show 2-3 options for the PRIMARY actuator only (largest axis = ${maxRequiredStroke}mm).
AXIS TECHNOLOGY SELECTION RULES:
• X-axis (horizontal, high speed >800 mm/s): belt-driven actuator (EGSC, ELGC-TB, OSP-E-B) — NOT ball screw
• Z-axis (vertical, precision ≤0.1mm): ball-screw electric axis (EGSK, EGC-BS) + brake motor — NOT belt, NOT pneumatic
• Z-axis (vertical, no precision): pneumatic cylinder with rod lock OR electric with brake motor
• NEVER show the same actuator type for both X and Z — they have different optimal technologies
The BOM step handles secondary axes. Show ONLY the primary actuator here.`
      : `MULTI-AXIS: Show 2-3 options for the primary (longest-stroke) actuator. BOM handles secondary axes.`
    : "";

  const washdownRule = isWashdown
    ? `WASHDOWN / FOOD-GRADE ENVIRONMENT — SAFETY CRITICAL:\n` +
      `Standard aluminum cylinders corrode within days under chemical washdown. NEVER recommend them here.\n` +
      `ONLY recommend products with IP67/IP69K rating OR stainless steel / corrosion-resistant construction.\n` +
      `Preferred products: Festo CRDSNU (corrosion-resistant stainless), Camozzi Serie 90 (stainless IP67).\n` +
      `If no washdown product meets the stroke requirement, say so clearly and recommend the custom solution.`
    : "";

  const rules = [
    isCleanroom      ? "CRITICAL: cleanroom — ONLY electric actuators, NO pneumatic cylinders." : "",
    needsProgrammable ? "CRITICAL: programmable stops — only servo/stepper with controller." : "",
    !isMultiAxis && maxRequiredStroke > 0
      ? `STROKE RULE: Required stroke = ${maxRequiredStroke}mm. ONLY recommend products with max_stroke >= ${maxRequiredStroke}mm.`
      : "",
    washdownRule,
    multiAxisRule,
    isVacuum
      ? `VACUUM GRIP: Sensitive items. For vacuum-handled parts, primary actuator handles transport — vacuum system goes in BOM.`
      : "",
    valveTerminal
      ? `VALVE TERMINAL: Multi-actuator system. This will be in the BOM — do NOT list it as a primary option.`
      : "",
    catalogNote,
  ].filter(Boolean).join("\n\n");

  // v24: requirements block at the very top so Groq can't ignore them
  const requirementLines = [
    maxRequiredStroke > 0
      ? `• Required stroke/travel: ${maxRequiredStroke} mm — DISQUALIFY any product with max_stroke < ${maxRequiredStroke} mm`
      : "",
    precisionMm > 0
      ? `• Required precision/repeatability: ±${precisionMm} mm`
      : "",
    isHighPrecision
      ? `• ⛔ HIGH PRECISION ±${precisionMm} mm — PHYSICS RULES (applies to ALL axes):\n` +
        `  ▸ FORBIDDEN: pneumatic cylinders — repeatability ±0.1–0.5 mm, CANNOT achieve ±${precisionMm} mm\n` +
        `  ▸ FORBIDDEN: belt-driven axes — belt backlash 0.05–0.3 mm, EXCEEDS ±${precisionMm} mm budget\n` +
        `  ▸ FORBIDDEN: rack-and-pinion (kuggstång) — backlash 0.05–0.5 mm, NOT suitable for precision\n` +
        `  ▸ ALLOWED: ball screw (kulskruvsaxel) — repeatability 0.003–0.05 mm ✓\n` +
        `  ▸ ALLOWED: linear motor — repeatability <0.001 mm ✓\n` +
        `  ▸ TERMINOLOGY: "kulskruvsaxel" = ball screw = correct. "kuggstång" = rack-and-pinion = WRONG for precision.`
      : "",
    isHighPrecisionVertical
      ? `• ⛔ VERTICAL + PRECISION: ball-screw axis MANDATORY + servo motor with INTEGRATED BRAKE (not check valve — electric axis needs electric brake)`
      : (isVerticalLoad
        ? `• ⚠️ VERTICAL AXIS:\n  ▸ Electric servo system → servo motor with integrated holding brake (elektrisk bromsmotor)\n  ▸ Pneumatic system → pilot-operated check valve (backslagsventil) + rod lock`
        : ""),
    speedMs > 0.8 && !isHighPrecision
      ? `• ⛔ HIGH SPEED ${(speedMs*1000).toFixed(0)} mm/s + NO precision req:\n` +
        `  ▸ FORBIDDEN: ball-screw drives — resonance and rapid wear above 800 mm/s\n` +
        `  ▸ REQUIRED: belt-driven axis (EGSC, ELGC-TB, OSP-E-B) or linear motor`
      : (speedMs > 0.8 && isHighPrecision
        ? `• ⚠️ HIGH SPEED ${(speedMs*1000).toFixed(0)} mm/s + PRECISION ±${precisionMm} mm: requires high-lead ball screw or linear motor`
        : ""),
    isAtex    ? `• ⛔ ATEX Zone 1/2 (gas) — NO electric actuators, NO servo, NO standard sensors. Pneumatic/NAMUR-certified ONLY.` : "",
    isAtexDust ? `• ⛔ ATEX Zone 20/21/22 (DUST explosion) — Equipment Group III, Category 2D/3D required. Different from gas zones — verify dust ignition temperature and MIE.` : "",
    isHydraulic ? `• ⚠️ HYDRAULIC APPLICATION — pneumatic catalog does NOT cover hydraulic (100–350 bar oil) systems. Recommend CUSTOM-SOLUTION.` : "",
    isVeryHighForce ? `• ⚠️ HIGH FORCE (>8 kN) — may exceed pneumatic actuator capability. Verify bore size or consider hydraulics/custom.` : "",
    isVerticalLoad ? `• ⚠️ VERTICAL/HANGING LOAD — cylinder holds weight. A lock valve (pilot-operated check valve) is MANDATORY to prevent load drop on air-pressure loss.` : "",
    requiredTemp > 0
      ? `• Required operating temperature: ${requiredTemp}°C — DISQUALIFY any product whose temp_range max < ${requiredTemp}°C. Compare EXACT numbers. Do NOT mark a product as "temperature resistant" if its spec (e.g. 60°C) is below the requirement (${requiredTemp}°C).`
      : (isHighTemp ? `• ⚠️ HIGH TEMPERATURE (>80°C) — standard NBR seals fail. PTFE or FKM (Viton) seals required.` : ""),
    isLowTemp  ? `• ⚠️ LOW TEMPERATURE (<-10°C) — standard seals harden/crack. LT-rated or FKM seals required.` : "",
    isOxygenClean ? `• ⛔ OXYGEN-ENRICHED ATMOSPHERE — oil-lubricated pneumatics create fire/explosion risk. Oil-free components ONLY.` : "",
    isSilSafety ? `• ⚠️ SAFETY FUNCTION (SIL/PLe) — components in safety circuits require IEC 62061 / ISO 13849 certification.` : "",
    isWashdown ? `• Environment: WASHDOWN / FOOD-GRADE — IP67/IP69K or stainless steel ONLY` : "",
    isPharmaGmp ? `• Environment: PHARMACEUTICAL/GMP — FDA 21 CFR / ISO 14159 materials (316L stainless, PTFE, EPDM). No dead zones, validated.` : "",
    isOutdoor  ? `• Environment: OUTDOOR — minimum IP65, UV-resistant, stainless or coated construction.` : "",
    isHighCycle ? `• ⚠️ HIGH CYCLE RATE (>60/min) — standard lubrication and bearings may overheat. Oil-free or high-cycle rated variants.` : "",
    isHighSpeed ? `• ⚠️ HIGH SPEED (>1 m/s) — end-stop cushioning or external deceleration MANDATORY to prevent impact damage.` : "",
    isBatteryDryroom
      ? `• ⛔ BATTERY PRODUCTION / DRYROOM — CRITICAL MATERIAL RESTRICTIONS:\n` +
        `  1. ABSOLUTE BAN on copper (Cu), zinc (Zn), and nickel (Ni) in any moving or wetted part. Standard ball screws and zinc-plated guides are FORBIDDEN — they shed particles that short-circuit lithium cells, causing thermal runaway.\n` +
        `  2. Standard greases evaporate or solidify in dryroom conditions (dew point -40 to -60°C). Require PFPE-lubricated or dry-running variants ONLY.\n` +
        `  3. For speeds >800 mm/s + high precision: ONLY belt-driven axes or linear motors. Ball screw drives cannot sustain these speeds without particle contamination.\n` +
        `  4. PRIORITIZE SMC 25-Series or equivalent Cu/Zn/Ni-free product lines. If no catalog product meets material restrictions, output CUSTOM-SOLUTION with explicit Cu/Zn/Ni-free specification.`
      : "",
    speedMs > 0.8 && !isBatteryDryroom
      ? `• ⚠️ HIGH SPEED ${(speedMs * 1000).toFixed(0)} mm/s — ball-screw drives (EGSK etc.) vibrate and wear rapidly above 800 mm/s under continuous cycling. Prefer belt-driven axes (EGSC, ELGC-TB) or linear motors at this speed.`
      : "",
    isCleanroom ? `• Environment: CLEANROOM — electric actuators ONLY, NO pneumatics` : "",
    needsProgrammable ? `• Control: programmable stops — servo/stepper + controller ONLY` : "",
    isMultiAxis ? `• System: MULTI-AXIS — show PRIMARY actuator only; BOM handles secondary axes` : "",
  ].filter(Boolean).join("\n");

  const system = `You are a Senior Automation & Mechanical Design Engineer AND a strict system validator. Your output is used directly by engineers to build real machines — it must be physically correct, safe, and complete. All text in ${lang}.
${requirementLines ? `\nAPPLICATION REQUIREMENTS — HARD CONSTRAINTS:\n${requirementLines}` : ""}
${rules ? `\n${rules}` : ""}

═══ 7-STEP ENGINEERING VALIDATION — MANDATORY BEFORE OUTPUT ═══

STEP 1 — AXIS IDENTIFICATION
Identify every axis in this system. For each axis: type (vertical/horizontal/rotary), mechanism technology required, load, stroke.

STEP 2 — TECHNOLOGY SELECTION (ONE ACTUATOR PER AXIS)
Apply strict selection rules:
• Vertical + precision ≤ 0.1 mm → ONLY ball-screw electric axis + servo brake motor. FORBIDDEN: pneumatic, belt-driven.
• Vertical + no precision req → pneumatic cylinder with rod lock OR electric with brake.
• Horizontal + high speed (>0.8 m/s) → belt-driven or linear motor.
• Horizontal + high precision (≤0.1 mm) → ball screw.
• Simple short-stroke secondary movement (<100 mm) → smaller pneumatic cylinder (do NOT over-engineer).
• ONE actuator per axis. NEVER mix actuator types within one axis role.

STEP 3 — SAFETY VALIDATION
• Vertical axis: brake motor or rod lock is NON-NEGOTIABLE — prevents load drop on power loss.
• Multi-axis: central controller required for synchronization.
• Eccentric load: linear guide or integrated guide rail required.

STEP 4 — MECHANISM HONESTY CHECK
• If "why" field mentions ball screw → SKU MUST be a ball screw product. If belt → belt SKU. NO mismatches.
• If catalog has no valid product → output CUSTOM-SOLUTION with exact specification (brand series, mechanism type).

STEP 5 — COMPLETENESS CHECK
Per axis: actuator ✓, motor ✓, drive ✓
System: controller ✓ (if multi-axis), sensors ✓, safety ✓ (if vertical/hazardous)

STEP 6 — DETECT AND FIX ERRORS
Before finalizing:
□ Is any pneumatic/belt product selected for vertical + precision ≤ 0.1 mm? → REPLACE with ball screw.
□ Is vertical axis missing brake? → ADD brake note to cons.
□ Is there more than one actuator per axis? → REMOVE duplicates.
□ Does text say one mechanism but SKU is another? → FIX SKU or FIX text.

STEP 7 — FINAL OUTPUT
Return a VERIFIED solution. Confident tone. No vague language. No "it may" or "could be". State facts.
Example: "This system uses a ball-screw servo axis (EGSK) on Z for ±0.02 mm precision, with integrated brake motor for safe vertical load holding."

═══════════════════════════════════════════════════════════════

BRAND SPECIFICITY: Name the exact series when relevant (SMC HY, Parker P1S, Bosch Rexroth EMC-HD-XC, SMC 25-series, etc.)
COMPATIBILITY: If control protocol specified (EtherCAT, PROFINET, ctrlX), state drive compatibility explicitly.
NUMERICAL VALIDATION: Hard math — if product spec < requirement, it FAILS. Do not mark failing products "Best Choice".

Return ONLY JSON (no markdown):
{ "summary": "1–2 sentences — confident, specific, state mechanism + safety approach",
  "options": [ { "sku": "CATALOG_SKU_OR_CUSTOM-SOLUTION", "name": "product name", "badge": ${badges}, "bore_mm": null|number, "stroke_mm": null|number, "force_n": null|number, "why": "engineering justification: mechanism chosen, precision achievable, safety feature, protocol/material verified — in ${lang}", "pros": ["..."], "cons": ["..."] } ] }`;

  const userMsg = `Application: ${description}\nAnswers: ${Object.entries(answers).map(([k,v])=>`${k}=${v}`).join(", ")}\n\nCatalog (${catalogProducts.length} products, sorted by stroke relevance${maxRequiredStroke > 0 ? ` for ${maxRequiredStroke} mm` : ""}${isWashdown ? ", IP67/IP69K+stainless only" : ""}):\n${productList}${pdfCtx ? `\n\nDocs:\n${pdfCtx}` : ""}`;

  // v24: temperature 0.35 (was 0.2) — more context-sensitive, less "always pick same top 3"
  let rawOptions: string | null;
  try { rawOptions = await callGroq([{ role: "system", content: system }, { role: "user", content: userMsg }], 1500, true, 0.35); }
  catch (e) {
    if ((e as Error).message === "RATE_LIMITED") return Response.json({ error: "rate_limited" }, { status: 503, headers: CORS });
    rawOptions = null;
  }
  const raw = rawOptions;

  let parsed: { summary: string; options: Array<Record<string, unknown>> };
  try { parsed = raw ? JSON.parse(raw) : { summary: "", options: [] }; }
  catch { parsed = { summary: "", options: [] }; }

  // v23: remove any option where SKU was hallucinated (not in catalog)
  parsed.options = (parsed.options ?? []).filter(opt => {
    const sku = opt.sku as string;
    if (sku === "CUSTOM-SOLUTION") return true;
    return productMap.has(sku);
  }).map(opt => {
    const sku = opt.sku as string;
    if (sku === "CUSTOM-SOLUTION") return opt;
    const cat = productMap.get(sku)!;
    const actualMax = parseStrokeFromSpecs(cat.key_specs ?? {});
    opt.stroke_mm = actualMax > 0 ? actualMax : null;
    if (maxRequiredStroke > 0 && actualMax > 0 && actualMax < maxRequiredStroke) {
      opt.badge = isSv ? "Närmaste katalogalternativ" : "Closest catalog option";
      opt.why = `${opt.why ?? ""} ⚠️ Max stroke ${actualMax} mm — krav ${maxRequiredStroke} mm.`;
    }
    // Flag if AI somehow picked a non-washdown product in a washdown scenario
    if (isWashdown && !isWashdownProduct(cat)) {
      opt.badge = isSv ? "Närmaste katalogalternativ" : "Closest catalog option";
      opt.why = `${opt.why ?? ""} ⚠️ Standardprodukt — verifiera korrosionsskydd för washdown-miljö.`;
    }
    // PRECISION hard post-validation (v34 — ALL axes, not just vertical)
    if (isHighPrecision && !isAllowedForHighPrecision(cat)) {
      const failType = isPneumaticActuatorProduct(cat)
        ? (isSv ? "pneumatisk cylinder (repeterbarhet ±0.1–0.5 mm)" : "pneumatic cylinder (repeatability ±0.1–0.5 mm)")
        : (isBeltDrivenProduct(cat)
          ? (isSv ? "kuggremsdrift (backlash 0.05–0.3 mm)" : "belt drive (backlash 0.05–0.3 mm)")
          : "incompatible mechanism");
      const criticalFail = isSv
        ? `⛔ KRITISKT FEL: ${failType} kan INTE uppnå ±${precisionMm} mm repeterbarhet. Krävs: kulskruvsaxel (ball screw) eller linjärmotor.`
        : `⛔ CRITICAL FAILURE: ${failType} CANNOT achieve ±${precisionMm} mm repeatability. Required: ball-screw axis or linear motor.`;
      opt.badge = isSv ? "Närmaste katalogalternativ" : "Closest catalog option";
      opt.why = criticalFail + (opt.why ? " " + opt.why : "");
      opt.cons = [...((opt.cons as string[]) ?? []), criticalFail];
      console.warn(`[options] precision violation: ${sku} is ${failType} — precision=${precisionMm}mm`);
    }
    // Ball-screw × high-speed incompatibility check
    if (isHighSpeed && isBallScrewProduct(cat)) {
      const speedStr = speedMs > 0 ? `${(speedMs * 1000).toFixed(0)} mm/s` : ">1000 mm/s";
      const warn = isSv
        ? `⚠️ VARNING: Kulskruvsaxel vid ${speedStr} — risk för vibrationer, snabbt slitage och partikelkontamination vid kontinuerlig cykling. Överväg kuggremsdrift (EGSC/ELGC-TB) eller linjärmotor.`
        : `⚠️ WARNING: Ball-screw drive at ${speedStr} — risk of vibration, rapid wear and particle contamination under continuous cycling. Consider belt drive (EGSC/ELGC-TB) or linear motor.`;
      opt.cons = [...((opt.cons as string[]) ?? []), warn];
    }
    // Dryroom/battery: flag any product with potential Cu/Zn/Ni content
    if (isBatteryDryroom && sku !== "CUSTOM-SOLUTION") {
      const materialWarn = isSv
        ? `⚠️ DRYROOM VARNING: Verifiera att ${cat.name} är fri från koppar (Cu), zink (Zn) och nickel (Ni) i alla rörliga delar. Begär materialcertifikat (RoHS/material declaration). SMC 25-serien är primärt alternativ om Cu/Zn/Ni-frihet inte kan verifieras.`
        : `⚠️ DRYROOM WARNING: Verify ${cat.name} is free of copper (Cu), zinc (Zn), and nickel (Ni) in all moving parts. Request material certificate (RoHS/material declaration). SMC 25-Series is the primary alternative if Cu/Zn/Ni-freedom cannot be confirmed.`;
      opt.cons = [...((opt.cons as string[]) ?? []), materialWarn];
    }
    // v27: Hard numerical temperature validation — catches hallucinated "✓ Hög temperaturbeständighet"
    if (requiredTemp > 0) {
      const productTempMax = parseProductTempMax(cat.key_specs ?? {});
      if (productTempMax > 0 && productTempMax < requiredTemp) {
        opt.badge = isSv ? "Närmaste katalogalternativ" : "Closest catalog option";
        const warn = isSv
          ? `⛔ VARNING: Produktens temperaturområde (max ${productTempMax}°C) understiger applikationskravet (${requiredTemp}°C). EJ godkänd för denna temperatur.`
          : `⛔ WARNING: Product temp range (max ${productTempMax}°C) is below requirement (${requiredTemp}°C). NOT approved for this temperature.`;
        opt.why = warn + (opt.why ? " " + opt.why : "");
        console.warn(`[options] temp mismatch: ${sku} max=${productTempMax}°C < required=${requiredTemp}°C`);
      }
    }
    return opt;
  });

  // Always append a CUSTOM-SOLUTION card — with full context so it names the right product families
  const customCtx: CustomSolutionContext = {
    isWashdown,
    isVertical: isVerticalLoad,
    isFoodGrade: isPharmaGmp || /livsmedel|food|slakteri|chark|mejeri|kött|meat|poultry|fjäderfä|dairy|fisk|fish|bageri|brewery/i.test(combinedText),
    isBatteryDryroom,
    isHydraulic,
    isAtex,
    isSilSafety,
  };
  parsed.options = [...parsed.options, buildCustomSolutionOption(maxRequiredStroke, isSv, maxCatalogStroke, catalogCanHandle, customCtx)];

  return Response.json(parsed, { headers: CORS });
}

// ── ACTION: bom ───────────────────────────────────────────────────────────────
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
  // In ATEX zones, electric actuators are forbidden — detectCategories already strips them,
  // but force isElectric=false to prevent electric accessories (cables, drives) being fetched.
  const isElectric = !isAtex && !isAtexDust && categories.some(c => c === "electric-actuator" || c === "linear-module");
  const isCleanroom = /\brenrum\b|\bcleanroom\b|\bclean\s+room\b/i.test(combinedText);
  const isMultiAxis = needsMultiAxis(combinedText);
  const isVacuum = needsVacuumGrip(combinedText);
  const valveTerminal = needsValveTerminal(combinedText);
  const isWashdown = needsWashdown(combinedText);
  const minStroke = extractMinStroke(answers, description);

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

  // ATEX/Dust: strip ALL electric actuators from the catalog before Groq sees it — hard block layer 2
  const atexSafeProducts = (isAtex || isAtexDust)
    ? products.filter(p => !isElectricActuator(p))
    : products;

  const productList = balancedSlice(atexSafeProducts, 60)
    .map(p => `${p.sku}: ${p.name} [${p.brand}/${p.category}] ip=${p.key_specs?.ip_rating ?? "std"}`).join("\n");

  const lang = isSv ? "svenska" : "English";

  const perAxisStrokes = isMultiAxis ? extractPerAxisStrokes(answers) : [];
  const axisStrokeNote = isMultiAxis && perAxisStrokes.length > 0
    ? `Axis strokes from requirements: ${perAxisStrokes.map(a => `${a.axis}=${a.stroke}mm`).join(", ")}. Size each axis actuator to meet its stroke.`
    : "";

  const rules = [
    isElectric
      ? `ELECTRIC BOM: MUST include linear axis + motor + motor controller + motor cable + encoder cable. FORBIDDEN: pneumatic valves, valve terminals, FRL, air fittings, silencers.`
      : "",
    isAtex
      ? `⛔ ATEX Zone 1/2 (GAS EXPLOSION): ABSOLUTE BAN on electric actuators (EGSK/EGC/ELGA/LESH/LEFS/OSP-E/HMR/LBB/HLR), servos, steppers, motor drives, and standard 24V sensors. ALL components must be pneumatic/mechanical or explicitly ATEX/NAMUR-certified. Synchronization: use 2× pneumatic cylinders with mechanical coupling — NEVER electric axes. Missing ATEX sensor → SPECIFY with reason "ATEX-certifierad sensor krävs (Ex ia IIC / NAMUR)".`
      : "",
    isAtexDust
      ? `⛔ ATEX Zone 20/21/22 (DUST EXPLOSION): Equipment must be Group III / Category 2D or 3D. Maximum surface temperature must be below dust layer ignition temperature (typically T135°C for grain/flour dust). Verify dust class (IIIA/IIIB/IIIC). All sensors SPECIFY with "ATEX IIIb T135°C krävs".`
      : "",
    isHydraulic || isVeryHighForce
      ? `⛔ HYDRAULIC / VERY HIGH FORCE: Pneumatic cylinders (max ~16 bar) cannot deliver hydraulic forces (100–350 bar). For this application ALL actuator rows MUST be SPECIFY with reason "Hydraulisk komponent — utanför pneumatisk katalog. Kontakta Maskinval för hydraulisk offert." Include a note in explanation that hydraulic engineering is required.`
      : "",
    isVerticalLoad && !isElectric
      ? `⚠️ VERTICAL LOAD (PNEUMATIC SYSTEM): Add a pilot-operated check valve (backslagsventil) for EACH lifting/vertical cylinder. If not in catalog: SPECIFY "Pilotmanövrerad backslagsventil — obligatorisk för vertikal last". Do NOT add a check valve for electric servo axes — that is a pneumatic component and would be wrong.`
      : "",
    isVerticalLoad && isElectric
      ? `⚠️ VERTICAL LOAD (ELECTRIC SERVO SYSTEM): MANDATORY — add a servo motor WITH INTEGRATED HOLDING BRAKE for the vertical axis. The brake engages automatically on power loss, preventing load drop. SPECIFY row: "Bromsmotor (servo med integrerad hållbroms) — vertikal axel, obligatorisk för lastsäkerhet". Do NOT add a pneumatic check valve — this is an electric system.`
      : "",
    isHighTemp
      ? `⚠️ HIGH TEMPERATURE: Standard NBR seals fail above 80°C. Mark any standard cylinder as SPECIFY with reason "Kräver PTFE/FKM-tätning för >80°C — beställ HT-variant". Recommend Festo HT- or Parker H-series if available in catalog.`
      : "",
    isLowTemp
      ? `⚠️ LOW TEMPERATURE: Standard seals harden/crack below -10°C. Mark any standard cylinder as SPECIFY with reason "Kräver LT-tätning för <-10°C". Check temp_range spec before recommending any product.`
      : "",
    isOxygenClean
      ? `⛔ OXYGEN-ENRICHED ATMOSPHERE: Oil-lubricated pneumatics create ignition/fire risk. ALL components must be oil-free (no standard lubricated FRL). Use clean-room/oil-free cylinders and components only. Mark any standard oiled FRL as SPECIFY with reason "Oljefri version krävs — syrgasmiljö (brandfarlig med olja)".`
      : "",
    isSilSafety
      ? `⚠️ SAFETY FUNCTION (SIL/PL): Valves and actuators in the safety function must be certified per IEC 62061 (SIL) or ISO 13849 (PL). Add SPECIFY for safety valve with reason "SIL 2-certifierad ventil krävs (t.ex. Festo VSNB/VSVA-SIL eller Parker SIL-variant) — standard ventil EJ godkänd". Do NOT use standard valve SKUs for the safety circuit.`
      : "",
    isPharmaGmp
      ? `⚠️ PHARMACEUTICAL/GMP: All wetted parts must be 316L stainless steel or PTFE/EPDM. No dead zones, no particle-shedding materials, validated. Add note "FDA 21 CFR / ISO 14159 materialkrav gäller" in each BOM reason. Recommend EHEDG-certified variants.`
      : "",
    isOutdoor
      ? `⚠️ OUTDOOR ENVIRONMENT: All components minimum IP65 (IP67 preferred), UV-resistant polymer or stainless. Standard aluminum cylinders will corrode. Check ip_rating field — if not IP65+, mark as SPECIFY.`
      : "",
    isHighCycle
      ? `⚠️ HIGH CYCLE RATE (>60/min): Standard cylinders may overheat. Use oil-free or high-cycle rated variants. Add note in reason field for any actuator. Include air-quality accessories (FRL with high-flow).`
      : "",
    isHighSpeed
      ? `⚠️ HIGH SPEED (>1 m/s): End-stop cushioning MANDATORY — add adjustable cushions or external shock absorbers (stötdämpare) to BOM. SPECIFY with reason "Justerbar hydraulisk stötdämpare krävs vid höga slaghastigheter (>1 m/s)" if not in catalog.`
      : "",
    isHighPrecision
      ? `⛔ HIGH PRECISION ±${precisionMm} mm — BOM RULES:\n` +
        `1. Primary actuator MUST be ball-screw (kulskruvsaxel). If it is not, replace with SPECIFY "Kulskruvsaxel ±${precisionMm}mm — belt/pneumatic forbidden".\n` +
        `2. Do NOT add belt-drive components to a precision axis.\n` +
        `3. TERMINOLOGY: if you write "ball screw" or "kulskruv" — the SKU must match a ball-screw product. Do NOT use rack-and-pinion (kuggstång) SKUs.\n` +
        `4. Linear encoder or encoder feedback SPECIFY row recommended for verification of ±${precisionMm} mm.`
      : "",
    isBatteryDryroom
      ? `⛔ BATTERY PRODUCTION / DRYROOM — MATERIAL CRITICAL:\n` +
        `1. ABSOLUTE BAN on Cu/Zn/Ni in any BOM component. Verify each SKU's material declaration before including.\n` +
        `2. Standard greases are FORBIDDEN in dryroom — every lubricated component must use PFPE or be dry-running. Add SPECIFY row "PFPE-smörjkit / dryroom-smörjmedel" if not in catalog.\n` +
        `3. Ball-screw primary actuator at high speed: flag with reason "⚠️ Verifiera Cu/Zn/Ni-frihet — kulskruv kan generera metallopartiklar i dryroom-miljö. Primärt alternativ: SMC 25-serien."\n` +
        `4. Add a SPECIFY row for "Materialdeklerationsintyg (RoHS + Cu/Zn/Ni-fri)" as the LAST BOM row.`
      : "",
    speedMs > 0.8
      ? `⚠️ HIGH SPEED ${(speedMs * 1000).toFixed(0)} mm/s: If BOM includes a ball-screw axis, add SPECIFY row "Kuggremsdrift eller linjärmotor rekommenderas vid >${(speedMs * 1000).toFixed(0)} mm/s — kulskruv slits snabbt och vibrerar".`
      : "",
    isCleanroom ? `CLEANROOM: All parts cleanroom-compatible.` : "",
    isVacuum ? `VACUUM: Include suction cups (qty = number of items handled simultaneously if stated) + ejector + vacuum sensor.` : "",
    isWashdown
      ? `WASHDOWN / FOOD-GRADE: ALL components must be IP67/IP69K or stainless steel / food-grade plastic. ` +
        `NO standard aluminum cylinders. NO standard plastic fittings. ` +
        `Prefer Festo CRDSNU, Camozzi Serie 90, stainless FRL, IP67 sensors. ` +
        `Add a note in the reason field for each BOM line confirming its washdown compatibility.`
      : "",
    !isMultiAxis
      ? `SINGLE-AXIS: ONE actuator (${primarySku}) only. No X/Z/Y axis split.`
      : `MULTI-AXIS: Primary actuator = ${primarySku} (largest axis). Also add a separate actuator for each additional axis. ${axisStrokeNote}`,
    valveTerminal && !isElectric ? `VALVE TERMINAL: ONE combined unit, not individual valves.` : "",
    `MANDATORY: The FIRST row of the BOM MUST be sku="${primarySku}" with quantity=1. Do NOT substitute a different product for this row.`,
    `SKU RULES: Only use SKUs that appear verbatim in the catalog list below. Use SPECIFY only if a truly needed component (not the primary actuator) is absent from catalog. One row per SKU.`,
  ].filter(Boolean).join(" | ");

  const isBomHighPrecisionVertical = needsVerticalLoad(combinedText) &&
    extractPrecisionMm(combinedText, answers) > 0 &&
    extractPrecisionMm(combinedText, answers) <= 0.1;

  const axisStructureRule = isMultiAxis
    ? `MULTI-AXIS BOM STRUCTURE — MANDATORY:\n` +
      `The BOM MUST be structured per axis. Use clear role labels:\n` +
      `  • "Aktuator — Z-axel (vertikal)" / "Actuator — Z-axis (vertical)"\n` +
      `  • "Aktuator — X-axel (horisontell)" / "Actuator — X-axis (horizontal)"\n` +
      `  • "Servomodul — Z-axel" / "Servo drive — Z-axis"\n` +
      `  • "Servomodul — X-axel" / "Servo drive — X-axis"\n` +
      `  • "Bromsmotor — Z-axel (vertikal säkerhet)" / "Brake motor — Z-axis (vertical safety)"\n` +
      `  • "Centralenhet / PLC" / "Central controller / PLC" — ONE shared unit\n` +
      `FORBIDDEN: listing components without a clear axis assignment. FORBIDDEN: mixing two actuators under one axis role.`
    : "";

  const system = `You are a hyper-critical Senior Automation Engineer. Build a complete, physically correct Bill of Materials. All text in ${lang}.

ENGINEERING RULES — NON-NEGOTIABLE:
1. ONE actuator per axis. A linear guide is NOT an actuator. If a secondary axis exists → add a second actuator.
2. Mechanism match: if role says "kulskruvsaxel" or "ball-screw" → SKU must be a ball-screw product. No mismatches.
3. Vertical axis → servo motor with integrated brake MANDATORY (prevents load drop on power loss). Label clearly.
4. Multi-axis → central controller / PLC MANDATORY for synchronization.
5. High precision (≤ 0.1 mm) → ONLY ball-screw actuators. NO belt drives in BOM for precision axes.
6. Material restrictions are absolute (Cu/Zn/Ni ban, IP rating, ATEX, pharma) — any violation → SPECIFY row.
7. BOM must be COMPLETE: actuator + motor + drive + controller + sensors + safety per axis.
8. Confident language: "This system uses..." not "This could use...". State facts.

${axisStructureRule ? axisStructureRule + "\n" : ""}${rules}

JSON: { "title": "short technical title in ${lang}", "explanation": "2-3 sentences — confident, specific architecture description with safety rationale", "bom": [ { "sku": "SKU or SPECIFY", "quantity": 1, "role": "axis-specific function in ${lang}", "reason": "engineering justification: mechanism verified, spec checked, safety addressed — in ${lang}" } ] }`;

  const reqLines = Object.entries(answers)
    .map(([k, v]) => {
      let label = k.replace(/_/g, " ");
      if (!isMultiAxis) label = label.replace(/\s*[xyz]$/i, "").replace(/\s*(stroke)\s*/i, "stroke").trim();
      return `${label}: ${v}`;
    }).join(", ");

  const userMsg = `Application: ${description}\nRequirements: ${reqLines}\nPrimary actuator: ${primarySku}\n\nCatalog:\n${productList}${pdfCtx ? `\n\nDocs:\n${pdfCtx}` : ""}`;

  let raw: string | null;
  try { raw = await callGroq([{ role: "system", content: system }, { role: "user", content: userMsg }], 1500, true); }
  catch (e) {
    if ((e as Error).message === "RATE_LIMITED") return Response.json({ error: "rate_limited" }, { status: 503, headers: CORS });
    raw = null;
  }
  if (!raw) return Response.json({ title: "", explanation: "", bom: [] }, { headers: CORS });

  let parsed: { title: string; explanation: string; bom: Array<{ sku: string; quantity: number; role: string; reason: string }> };
  try { parsed = JSON.parse(raw); }
  catch { return Response.json({ title: "", explanation: "", bom: [] }, { headers: CORS }); }

  if (!isMultiAxis) {
    parsed.bom = sanitizeSingleAxisBom(parsed.bom ?? [], primarySku);
  } else {
    const merged = new Map<string, { sku: string; quantity: number; role: string; reason: string }>();
    for (const line of (parsed.bom ?? [])) {
      const ex = merged.get(line.sku);
      if (ex) {
        ex.quantity += line.quantity;
        if (!ex.role.includes(line.role)) ex.role += " / " + line.role;
      } else {
        merged.set(line.sku, { ...line });
      }
    }
    parsed.bom = Array.from(merged.values());
  }

  // v34: Vertical load safety — differentiate electric (brake motor) vs pneumatic (check valve)
  if (isVerticalLoad) {
    if (isElectric) {
      // Electric servo system: needs brake motor — NOT a pneumatic check valve
      const hasBrakeMotor = parsed.bom.some(l =>
        /broms.*motor|brake.*motor|holding.*brake|hållbroms|motor.*broms|servo.*broms|broms.*servo|integrated.*brake/i.test(l.role + " " + l.reason + " " + l.sku)
      );
      if (!hasBrakeMotor) {
        console.warn("[bom] electric vertical: injecting mandatory brake motor");
        parsed.bom.splice(1, 0, {  // insert after primary actuator
          sku: "SPECIFY",
          quantity: 1,
          role: isSv ? "Bromsmotor — Z-axel (vertikal säkerhet)" : "Brake motor — Z-axis (vertical safety)",
          reason: isSv
            ? "OBLIGATORISK för vertikal elektrisk servoaxel — integrerad hållbroms säkerställer att lasten hålls kvar vid strömavbrott eller nödstopp. Standard servomotor utan broms är EJ tillräcklig."
            : "MANDATORY for vertical electric servo axis — integrated holding brake ensures load is held on power loss or emergency stop. Standard servo motor without brake is NOT sufficient.",
        });
      }
    } else {
      // Pneumatic system: needs pilot-operated check valve
      const hasLockValve = parsed.bom.some(l =>
        /backslagsventil|lock.*valve|check.*valve|sperrventil|läsventil|pilot.*check|hållventil|rod.*lock|stånglås/i.test(l.role + " " + l.reason + " " + l.sku)
      );
      if (!hasLockValve) {
        console.warn("[bom] pneumatic vertical: injecting mandatory check valve");
        parsed.bom.push({
          sku: "SPECIFY",
          quantity: 1,
          role: isSv ? "Pilotmanövrerad backslagsventil" : "Pilot-operated check valve",
          reason: isSv
            ? "OBLIGATORISK vid pneumatisk vertikal last — förhindrar att lasten faller vid lufttrycksförlust (IEC 60947-5-1)"
            : "MANDATORY for pneumatic vertical load — prevents load drop on air pressure loss (IEC 60947-5-1)",
        });
      }
    }
  }

  // v26: High speed — guarantee cushioning/shock absorber mention
  if (isHighSpeed) {
    const hasCushion = parsed.bom.some(l =>
      /stötdämpare|cushion|dämpning|shock.*absorb|dämp/i.test(l.role + " " + l.reason)
    );
    if (!hasCushion) {
      console.warn("[bom] high speed: injecting mandatory cushioning");
      parsed.bom.push({
        sku: "SPECIFY",
        quantity: 2,
        role: isSv ? "Hydraulisk stötdämpare" : "Hydraulic shock absorber",
        reason: isSv
          ? "OBLIGATORISK vid slaghastighet >1 m/s — förhindrar skador på cylinderände och maskinkonstruktion"
          : "MANDATORY at stroke speed >1 m/s — prevents end-stop damage to cylinder and machine frame",
      });
    }
  }

  // v25/v26: ATEX/Dust hard block (layer 3) — strip any electric actuator that slipped through
  if (isAtex || isAtexDust) {
    const electricSKUs = new Set(products.filter(p => isElectricActuator(p)).map(p => p.sku));
    const stripped = parsed.bom.filter(l => {
      if (l.sku === primarySku) return true; // never remove the selected primary
      if (electricSKUs.has(l.sku)) {
        console.warn(`[bom] ATEX: stripped electric component ${l.sku} (${l.role})`);
        return false;
      }
      // Also catch by name pattern for any hallucinated SKUs
      const nameUpper = l.role.toUpperCase() + " " + l.sku.toUpperCase();
      if (/EGSK|ELGA|EGC|LESH|LEFS|OSP-E|HMR|LBB|HLR|SERVO|STEPPER|24V|MOTOR.*DRIVE|ELECTRIC.*SLIDE/i.test(nameUpper)) {
        console.warn(`[bom] ATEX: stripped by name pattern ${l.sku} (${l.role})`);
        return false;
      }
      return true;
    });
    parsed.bom = stripped;
  }

  // v23: guarantee primarySku is always the first BOM row, injecting it if the AI omitted it
  if (primarySku && primarySku !== "CUSTOM-SOLUTION") {
    const hasPrimary = parsed.bom.some(l => l.sku === primarySku);
    if (!hasPrimary) {
      // AI omitted the primary actuator entirely — inject it
      parsed.bom = [
        {
          sku: primarySku,
          quantity: 1,
          role: isSv ? "Primär aktuator" : "Primary actuator",
          reason: isSv ? "Vald primär komponent (tillagd automatiskt)" : "Selected primary component (auto-injected)",
        },
        ...parsed.bom,
      ];
    } else {
      // Primary is somewhere in the BOM — move it to position 0
      const primaryRow = parsed.bom.find(l => l.sku === primarySku)!;
      parsed.bom = [primaryRow, ...parsed.bom.filter(l => l.sku !== primarySku)];
    }
  }

  return Response.json(parsed, { headers: CORS });
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

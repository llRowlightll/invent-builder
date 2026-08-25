import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  type CatalogProduct,
  type ScoringCtx,
  normalizeKeySpecs,
  isFamilyProduct,
  parseStrokeFromSpecs,
  isBallScrewProduct,
  isBeltDrivenProduct,
  isPneumaticActuatorProduct,
  isAllowedForHighPrecision,
  isAllowedForPrecisionVertical,
  isAllowedForHighSpeed,
  isElectricActuator,
  isWashdownProduct,
  rankActuators,
} from "./scoring.ts";

// v51 — Engineering-correctness pass (reported via boss-tests): (1) multi-axis precision
//        hole — applyPrecisionFilter no longer disables on multi-axis non-vertical, so a
//        ±0.05mm pick-and-place can't pick a pneumatic; (2) extractPrecisionMm catches bare
//        sub-0.5mm values ("0,05 mm", no ±/keyword); (3) P0 secondary axes match a REAL
//        catalog SKU (findAxisActuator) instead of "ej i katalog" placeholders; (4) P1
//        conflict/feasibility flags (precision×env, precision×cost, speed×precision, 24/7);
//        (5) P2 first-order dynamics sizing (computeDynamics) appended to the explanation.
// v50 — Bore/force gating: calcMinBoreMm(loadKg), extractLoadKg(), minBoreMm in ScoringCtx (±40pts), hard bore pre-filter before scoring. Catalog: 12 new ISO cylinders at 250/300mm stroke Ø40-Ø80 (BR/Parker/Camozzi). Eval: test-options-accuracy.sh.
// v49 — FULLY DETERMINISTIC BOM: LLM extras removed entirely. LLM writes title+explanation only. Mandatory BOM now includes fitting, cable, mounting rows. All SKU selection is server-side.
// v48 — needsMounting detector + mounting category in bomCategories; LLM multi-axis prompt no longer asks for axis actuators; L3/L4 merged: all actuator SKUs banned from extras unconditionally.
// v47 — 5-layer extras validation: unique SKU, no actuator-SKU in sensor/mounting role, no extra actuators on single-axis.
// v49 — Invariant-eval finding #2: pneumatic slides (MW-S, SMC) miscategorized as "linear-module" passed the high-precision filter (category said electric). Added isPneumaticByDrive() — detects air-driven products by operating_pressure spec (not category) and excludes them from precision selection regardless of miscategorization.
// v48 — Invariant-eval finding: vertical ATEX had no anti-drop device (brake motor forbidden in zone, check-valve row gated on isPneumatic which excludes ATEX). Added ATEX-rated anti-drop row (pilot check valve / rod lock) for vertical ATEX loads.
// v47 — AI-correctness audit (Opus 4.8): (1) precision ≤0.1mm now force-fetches electric actuator categories regardless of free-text wording — fixes "precision ±0.02mm" returning empty CUSTOM-SOLUTION; (2) broadened detectCategories precision triggers (precision/positioner/repeterbar/noggrann/µm); (3) ATEX pneumatic BOM now includes ATEX valve + air-prep + zone-certification warning rows instead of just the bare primary.
// v46 — Add isWashdown to BomCtx; mandatory IP69K warning row in BOM.
// v45 — Mandatory BOM rows for: multi-axis secondary actuators (Y/Z-axel), high-temp PTFE/FKM warning, SIL/PLd safety valve warning, hydraulic out-of-scope warning. All deterministic — independent of LLM.
// v44 — Telemetry: fire-and-forget logAdvisorEvent() logs every bom/options/questions call to integration_logs (duration_ms, rate_limited, bom_rows, specify_rows).
// v43 — Wire check-valve + shock-absorber to findCatalogProductByType (were hardcoded SPECIFY); now returns real SKUs from catalog.
// v42 — Catalog: 9 shock absorbers (Festo YSR, SMC RBQ, Norgren SA) + 5 check valves (Festo HGL, SMC AKH, MW NRV) added to DB. Code: fetch shock-absorber/check-valve categories when needed; FRL prefers Festo MS4 over Camozzi; non-return pattern in check-valve matcher.
// v41 — Fix T08: test ensure_ascii=False (Swedish chars now matchable); Fix T15: MC- prefix added to known SKUs; Dedup: LLM extras cannot re-add mandatory-row SKUs.
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
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? SUPABASE_ANON_KEY;
// Primary: 70b for full engineering quality. Fast: 8b fallback (500K TPD separate pool)
// llama-3.3-70b-versatile was decommissioned by Groq on 2026-08-16 (deprecation
// notice 2026-08-14). Moved to openai/gpt-oss-120b, Groq's recommended PRODUCTION
// replacement — NOT qwen/qwen3.6-27b (Groq's docs mark that one "preview... should
// not be used in production", which would trade one instability for another).
const LLM_MODEL = "openai/gpt-oss-120b";
// Production-log finding 2026-08-17: this was still "llama-3.1-8b-instant",
// deprecated and gone (every fallback attempt 404'd "model does not exist").
// The 2026-08-14 migration above fixed the PRIMARY model's deprecation but
// missed this one, since it only fires once the primary gets rate-limited —
// which normal testing doesn't reliably trigger. Net effect: the rate-limit
// safety net had been silently dead — every primary rate-limit (an 8000 TPM
// cap, hit within ~4 rapid calls) fell all the way through to bare server
// defaults with zero LLM enrichment, not just a slower fallback model.
// openai/gpt-oss-20b is Groq's current documented fast/cheap production tier
// (same family as the primary, so behavior is well understood).
const LLM_MODEL_FAST = "openai/gpt-oss-20b";
const LLM_URL = "https://api.groq.com/openai/v1/chat/completions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Found 2026-08-19: every LLM-facing "write your answer in ${lang}" instruction
// derived its language name from `isSv` (locale === "sv" ? "svenska" : "English"),
// which silently collapsed de/es into English — the site's de/es UI is fully
// translated, but the AI questions/options/BOM text was English-only for those
// two locales. This is the single source of truth for that instruction now.
const LLM_LANG_NAME: Record<string, string> = { sv: "svenska", en: "English", de: "Deutsch", es: "español" };
function langName(locale: string): string {
  return LLM_LANG_NAME[locale] ?? LLM_LANG_NAME.en;
}

// Found 2026-08-21: task tracked as "translate the remaining ~75 hardcoded
// isSv ? svenska : English strings" (BOM role/reason text, option pros/cons,
// badges) — everything the langName() fix above doesn't reach because it's
// not LLM-generated, it's fixed text the server writes directly. Closing it
// now: same single-lookup pattern as langName(), just for a whole string set
// per call site instead of one language name.
function pick<T>(locale: string, t: { sv: T; en: T; de: T; es: T }): T {
  return t[locale as keyof typeof t] ?? t.en;
}

/** Fire-and-forget telemetry — never throws, never delays the response. */
function logAdvisorEvent(
  event: string,
  payload: Record<string, unknown>,
  success: boolean,
  error?: string
): void {
  void fetch(`${SUPABASE_URL}/rest/v1/integration_logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({
      source: "groq-advisor",
      event,
      payload,
      success,
      error: error ?? null,
    }),
  }).catch(() => {/* telemetry must never affect main flow */});
}

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

/**
 * Supplementary fetch to guarantee the primary actuator's own brand is
 * actually represented in a category pool. fetch_products_for_advisor()
 * (used by fetchProducts above) caps at `limit` per category, ordered by
 * brand slug then SKU — fine for small categories, but "cylinder" alone
 * has 325 products across 7 brands (bosch-rexroth's 45 already exceed the
 * default cap of 30 on its own), so a brand sorting late alphabetically
 * (smc, norgren, parker, metal-work) can be entirely absent from the pool
 * regardless of how many of ITS OWN products exist.
 *
 * Confirmed empirically 2026-08-21: an SMC multi-axis job's secondary-axis
 * lookup (findAxisActuator, fed by brandSorted) returned a Bosch Rexroth
 * cylinder for the Z-axis — not because no SMC cylinder could have fit, but
 * because zero SMC cylinders survived fetchProducts' cutoff in the first
 * place, so brandSorted had nothing of the primary's own brand to sort
 * forward. This doesn't go through the shared RPC (which has no brand
 * parameter) — same reasoning fetchEndEffectorProducts already used for a
 * different gap: a direct, narrowly-scoped query beats widening a shared
 * fetch path that other callers also rely on for its current shape/cost.
 */
async function fetchProductsByCategoryAndBrand(categorySlug: string, brandSlug: string, limit = 15): Promise<CatalogProduct[]> {
  if (!categorySlug || !brandSlug) return [];
  try {
    const q = `select=sku,name,family,categories!inner(slug),brands!inner(slug),specs:product_specs(key,value)` +
      `&categories.slug=eq.${encodeURIComponent(categorySlug)}&brands.slug=eq.${encodeURIComponent(brandSlug)}&status=eq.active&limit=${limit}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?${q}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((p: { sku: string; name: string; family?: string; specs?: Array<{ key: string; value: unknown }> }) => ({
      sku: p.sku,
      name: p.name,
      category: categorySlug,
      brand: brandSlug,
      key_specs: normalizeKeySpecs(Object.fromEntries((p.specs ?? []).map((s) => [s.key, s.value]))),
    }));
  } catch {
    return [];
  }
}

// Grippers/vacuum are sized by spec keys (clamping_force, grip_force_kgf,
// cup_diameter_mm, …) that the shared advisor RPC curates away. Fetch the FULL
// product_specs directly so the end-effector branch can size on real grip/holding
// force instead of falling back to fetch order.
async function fetchEndEffectorProducts(slug: string, limit: number): Promise<CatalogProduct[]> {
  try {
    const q = `select=sku,name,categories!inner(slug),specs:product_specs(key,value)&categories.slug=eq.${encodeURIComponent(slug)}&status=eq.active&limit=${limit}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?${q}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((p: { sku: string; name: string; specs?: Array<{ key: string; value: unknown }> }) => ({
      sku: p.sku,
      name: p.name,
      category: slug,
      brand: "",
      key_specs: Object.fromEntries((p.specs ?? []).map((s) => [s.key, s.value])),
    }));
  } catch {
    return [];
  }
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

/**
 * Multi-function / line-level system request: the user is describing a whole
 * production line with several distinct stations (weighing, identification/
 * vision, robot handling, multi-lane sorting) — not a single actuator. We must
 * NOT collapse this to one component (least of all a passive shock absorber),
 * and we must be honest that weighing/vision/PLC/robot are outside our component
 * catalog. Triggers when >=2 of these out-of-catalog functions are requested.
 */
function isMultiFunctionSystem(text: string): boolean {
  const t = text.toLowerCase();
  let n = 0;
  // weighing / load cells (the weighing FUNCTION, not "the box weighs 5 kg")
  if (/lastcell|load.?cell|\bweigh|vägning|väga\b|\bväg\s+och|registrera\s+vikt/i.test(t)) n++;
  // identification: barcode / label / vision / camera / scanner / object-ID
  if (/streckkod|barcode|\betikett|\blabel\b|\bvision\b|kamera|\bcamera\b|scanner|skanna|\bocr\b|\bqr\b|identifiera\s+(kartong|produkt|objekt|artikel|enhet|paket|låda|del)/i.test(t)) n++;
  // robot handling
  if (/\brobot\b|scara|delta.?robot|plockrobot|industrirobot|cobot/i.test(t)) n++;
  // multi-lane sorting (several lanes — not a single divert cylinder)
  if (/sorteringsban|sorter[a-z]*\b.{0,20}(\d+|tre|flera)\s*(olika\s*)?(ban|väg|lane|fack)|\d+[-\s]*vägs?\s*sorter/i.test(t)) n++;
  return n >= 2;
}

function detectCategories(text: string): string[] {
  const t = text.toLowerCase();
  const slugs = new Set<string>();
  if (/lyft|press|klämm|stansa|trycka|cylinder|pneumatisk|luft|piston|double.act/i.test(t))
    slugs.add("cylinder");
  if (/elektrisk|servo|stepper|präcis|precis|positioner|linjäraxel|electric|ball.screw|kuggrem|kuggremsaxel|elaxel|eldriven|repeterbar|repeatab|noggrann|accura|mikrometer|µm|\bum\b/i.test(t)) {
    slugs.add("electric-actuator");
    slugs.add("linear-module");
    slugs.add("servo-motor");   // drivetrain: motor for the electric axis
    slugs.add("servo-drive");   // drivetrain: drive/amplifier for the motor
  }
  if (/linjär.*modul|slide|guidning|linear.*module|linear.*axis|linjär.*axel|linjärmodul|egc\b|lefs\b|lesh\b|egsk\b|egsp\b|hmr\b|osp.e|lbb\b|hlr\b|elga\b/i.test(t))
    slugs.add("linear-module");
  if (/roter|rotat|\bvrid|sväng|rotary|svängrör|vridrör|\bNm\b/i.test(t)) slugs.add("rotary-actuator");
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
    // ATEX bans ALL electric kit, including the drivetrain (motor + drive). Without
    // deleting these too, an ATEX + precision request was left with ONLY servo-
    // motor/servo-drive candidates and ranked a strokeless stepper motor as
    // "Bästa valet" (invariant breach #49) instead of escalating to CUSTOM.
    slugs.delete("servo-motor");
    slugs.delete("servo-drive");
    if (slugs.size === 0) slugs.add("cylinder");
  }
  // Pick & place: cylinders + vacuum + linear-module (electric option)
  if (/pick.and.place|pick.*place|plocka.*placera|plocka.*flytta|lyfter.*flytta|flytta.*lyft|transfer.*station|montering|montage/i.test(t)) {
    slugs.add("cylinder");
    slugs.add("vacuum");
    slugs.add("linear-module");
  }
  // Shock absorber: decelerating an EXTERNAL moving mass at end of travel (not a
  // cylinder's own end-cushioning). Needs a braking verb + a velocity/mass context.
  // In a multi-function LINE request, "stoppa" + a velocity is just one station
  // among many — do NOT strip the active actuators and collapse to a passive
  // shock absorber (the carton sort-line bug). handleOptions owns system scope.
  if (!isMultiFunctionSystem(t) &&
      (/stötdämp|shock.?absorb/i.test(t) ||
      (/\bstoppa\b|bromsa|deceler|fånga upp|kollision|anslag|krock/i.test(t)
       && /m\/s|km\/h|rörelseenergi|kinetisk|rörlig massa|\bvagn\b|tung massa/i.test(t)))) {
    slugs.delete("cylinder"); slugs.delete("electric-actuator");
    slugs.delete("linear-module"); slugs.delete("rotary-actuator");
    slugs.add("shock-absorber");
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
  // Axis patterns must be WORD-BOUNDED axis tokens (x-axel / XYZ / X-Z), NOT bare
  // letters: the old `x.*y|y.*x|x.*z|z.*x` matched any x/y/z across the whole string,
  // so "Cylinder … exakt" (y…x) was falsely flagged multi-axis — which disabled the
  // precision hard-filter and triggered per-axis BOM logic on single-axis jobs.
  if (/\b[xyz][-_\s]?ax(el|is|e)|\bxyz\b|\b[xyz]\s*[\/-]\s*[xyz]\b|två axl|två rörel|horisontell.*vertikal|vertikal.*horisontell|pick.and.place|pick.*place|plocka.*placera|plocka.*flytta|lyfter.*flytta|flytta.*lyft|2-axl|2 axl|multi.*axl|cartesian|portalsystem|lyfter.*flyttar|lyfter.*och.*flyttar/i.test(text)) return true;

  // Adversarial test finding 2026-08-16: "en enda cylinder som SAMTIDIGT lyfter,
  // roterar och griper" fell through every pattern above (none of them anticipate
  // lift+rotate+grip specifically) and landed in isPureRotary — a narrow,
  // non-LLM path that only picks by torque and stayed silent about the missing
  // lift/grip functions entirely. No catalog part does lift+rotate+grip; the
  // honest answer is "separate axis per motion," same as pick-and-place already
  // gets above. Gated on explicit simultaneity language (not just "lift" and
  // "grip" co-occurring) — a plain "gripper that lifts a box" is one ordinary
  // gripper request, not a multi-axis one, and must NOT trip this.
  const isSimultaneous = /\bsamtidigt\b|\bsamma\s+gång\b|\bi\s+en\s+rörelse\b|\ben\s+enda\b.{0,20}\bsom\b|\bsimultaneous(ly)?\b|\bat\s+the\s+same\s+time\b|\bin\s+one\s+motion\b/i.test(text);
  if (isSimultaneous) {
    let motionTypes = 0;
    if (/\blyft(er|a)?\b|\bhissa\b|\blift(s|ing)?\b/i.test(text)) motionTypes++;
    if (/roter|rotat|\bvrid|\bsväng|rotary|\brotate|\brotation\b/i.test(text)) motionTypes++;
    if (/gripdon|gripare|\bgripper\b|klämback|gripa\s|griper\s|\bgrip\b|\bclamp(ing)?\b/i.test(text)) motionTypes++;
    if (motionTypes >= 2) return true;
  }
  return false;
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
  return /\batex\b|\bex[.\s-]?zon[e]?\b|\bexplosionsskyddad\b|\bexplosionsfarlig\b|\bflammable[.\s]?gas\b|\bbrännbar[.\s]?gas\b|\bnamur\b|\bzone\s?[12]\b|\bzon\s?[12]\b|\bii\s?[23]\s?[gd]\b|\bii[abc]\b|\bex\s?klass\b|\bex[.\s]?klassad\b|\bexplosionsgeschützt\w*\b|\bexplosionsgefähr\w*\b|\bentzündlich\w*\s?gas\b|\batmósfera\s?explosiva\b|\bzona\s?explosiva\b|\bgas\s?inflamable\b|\bprueba\s?de\s?explosión\b|\bantideflagrante\b/i.test(text);
}

// ── Safety & environment detectors ────────────────────────────────────────────

/** Vertical / suspended load: cylinder holds weight against gravity.
 *  On air-pressure loss the load WILL fall unless a lock valve is fitted. */
function needsVerticalLoad(text: string): boolean {
  return /\blyft|\bhissa\b|\bhäng.*last\b|\blast.*häng\b|\bvertikal|\bcylinder.*vertikal\b|\bz[.-]?axel\b|\bz[.-]?axis\b|\bpress.*ner\b|\bpress.*ned\b|\bnedåt\b|\buppåt\b|\bvertical.*load\b|\bhanging.*load\b|\bsuspended.*load\b|\blifting.*cyl\b|\bcylinder.*lyft\b|\bz[.-]?achse\b|\bheben\b|\bhebt\b|\bhängende\s?last\b|\bnach\s?unten\b|\bnach\s?oben\b|\belevar\b|\blevantar\b|\bcarga\s?suspendida\b|\bcarga\s?colgante\b|\beje\s?z\b|\bhacia\s?abajo\b|\bhacia\s?arriba\b/i.test(text);
}

/** High temperature environment (>80°C). Standard NBR seals fail — need PTFE/FKM/HT variants. */
function needsHighTemp(text: string): boolean {
  return /\bugn\b|\bfornace\b|\bautoklav\b|\bsteam\b|\bånga\b|\bvulk\b|\bsintr\b|\bsmält\b|\bhög.*temp\b|\bhigh.*temp\b|\bvarm.*milj\b|\bhet.*milj\b|\b[89]\d\s*°?\s*[cC]\b|\b1[0-9]\d\s*°?\s*[cC]\b|\b200\s*°?\s*[cC]\b|\bhögtemperatur\b|\bheat.*treat\b|\bvärmebehandl\b|\bofen\b|\bautoklav\w*\b|\bdampf\b|\bhohe\s?temperatur\b|\bheiße\s?umgebung\b|\bwärmebehandl\w*\b|\bgeschmolzen\b|\bhorno\b|\bvapor\b|\balta\s?temperatura\b|\bambiente\s?caliente\b|\btratamiento\s?térmico\b|\bfundido\b/i.test(text);
}

/** Low temperature environment (<-10°C). Standard seals crack/harden — need LT/FKM variants. */
function needsLowTemp(text: string): boolean {
  return /\bfrys\b|\bfrysrum\b|\bkylanläggn\b|\bcold.*room\b|\bcold.*stor\b|\bkylrum\b|\bcryogen\b|\bdjupfrys\b|\bfryscell\b|\bkyla.*milj\b|\b-[1-9]\d\s*°?\s*[cC]\b|\b-\s*[1-9]\d\s*°?\s*[cC]\b|\bbelow.*freez\b|\bsubzero\b|\bfrost.*milj\b|\bgefrier\w*\b|\btiefkühl\w*\b|\bkühlraum\b|\bkälteanlage\b|\bkryogen\w*\b|\bcongelador\b|\bcámara\s?frigorífica\b|\bsala\s?fría\b|\bcriogénic\w*\b/i.test(text);
}

/** Hydraulic application — entirely different product family (100–350 bar oil). NOT in pneumatic catalog. */
function isHydraulicApplication(text: string): boolean {
  return /\bhydraulisk\b|\bhydraulic\b|\bhydraul\b|\bolje.*cylinder\b|\bcylinder.*olja\b|\bolje.*tryck\b|\bhydro.*cyl\b|\bhydro.*press\b|\bhydraulisch\w*\b|\bölzylinder\b|\böldruck\b|\bhidráulic\w*\b|\bcilindro\s?hidráulico\b|\bpresión\s?de\s?aceite\b/i.test(text);
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
  return /\bsyrgas\b|\boxygen[.\s-]?enrich\b|\boxygen[.\s-]?clean\b|\bo2[.\s-]?ren\b|\bhög.*syrgashal\b|\boxygen.*atmosf\b|\bmedical.*oxygen\b|\boxidations.*milj\b|\breact.*oxygen\b|\boi?l[.\s-]?free.*oxygen\b|\bsauerstoff\w*\b|\bmedizinisch\w*\s?sauerstoff\b|\boxígeno\b|\benriquecid\w*\s?con\s?oxígeno\b|\boxígeno\s?médico\b/i.test(text);
}

/** High cycle frequency (>60 cycles/min) — thermal and lubrication issues with standard cylinders. */
function needsHighCycle(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.values(answers).join(" ");
  return /\b[6-9]\d\s*(?:cyk|slag|cykel|cyc|stroke|takt).*(?:min|s)\b|\b1[0-9]\d\s*(?:cyk|slag|cykel|cyc|stroke|takt)\b|\bhög.*frekvens\b|\bhigh.*freq\b|\bhigh.*cycle\b|\bsnabb.*takt\b|\brapid.*cycling\b|\bfastcycl\b|\bhohe\s?frequenz\b|\bschneller?\s?takt\b|\balta\s?frecuencia\b|\bciclo\s?rápido\b/i.test(allText);
}

/** High speed > 1 m/s without deceleration control — end-stop impact damage. */
function needsHighSpeed(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.values(answers).join(" ");
  // \b[1-9]\d{3,}\s*mm\/s\b catches "1200mm/s", "2000 mm/s" etc (≥1000 mm/s = >1 m/s)
  return /\b[1-9](?:[.,]\d+)?\s*m\/s\b|\b[1-9]\d{3,}\s*mm\/s\b|\bsnabb.*rörelse\b|\bhigh.*speed\b|\bhög.*hastighet\b|\bfast.*actuat\b|\bsnabb.*stans\b|\bslaghastighet.*[1-9]\b|\bschnelle\s?bewegung\b|\bhohe\s?geschwindigkeit\b|\bmovimiento\s?rápido\b|\balta\s?velocidad\b/i.test(allText);
}

/** SIL/functional safety required — safety relay, guard interlock, emergency stop function. */
function needsSilSafety(text: string): boolean {
  return /\bsil\s*[1-4]\b|\bsäkerhetsfunktion\b|\bsafety.*function\b|\bnödstopp\b|\bemergency.*stop\b|\bguard.*interlock\b|\bskyddsgrind\b|\bplt\b|\biso\s*13849\b|\biec\s*62061\b|\bperformance.*level\b|\bplr\b|\bple\b|\bpld\b|\bsafety.*relay\b|\bsäkerhetsrelä\b|\bPNOZ\b|\bfail.*safe\b|\bsicherheitsfunktion\b|\bnot.?halt\b|\bnotaus\b|\bschutztür\b|\bschutzgitter\b|\bschutzzaun\b|\bsicherheitsrelais\b|\bsicher\s?abgeschaltet\b|\bfunción\s?de\s?seguridad\b|\bparada\s?de\s?emergencia\b|\bpuerta\s?de\s?seguridad\b|\breja\s?de\s?seguridad\b|\brelé\s?de\s?seguridad\b|\bseguro\s?contra\s?fallos\b/i.test(text);
}

/** Outdoor / marine / harsh UV + weather environment. */
function needsOutdoor(text: string): boolean {
  return /\butomhus\b|\boutdoor\b|\bexterior.*install\b|\bsalt.*milj\b|\bmarin\b|\bmarine\b|\boffshore\b|\bsalt.*spray\b|\bsalt.*dimma\b|\bväder.*skydd\b|\buv.*exponering\b|\bregn.*milj\b|\bkorrosiv.*milj\b|\bim\s?freien\b|\baußenbereich\b|\bmaritim\w*\b|\bsalzsprühnebel\b|\bwetterfest\w*\b|\bexterior\b|\bal\s?aire\s?libre\b|\bambiente\s?marino\b|\bmarítim\w*\b|\bniebla\s?salina\b|\bintemperie\b/i.test(text);
}

/** Pharmaceutical / GMP / FDA — validated materials, no dead-spaces, 316L, PTFE. */
function needsPharmaGmp(text: string): boolean {
  return /\bgmp\b|\bfda\b|\b21\s*cfr\b|\bläkemedel\b|\bpharma\b|\bpharmaceut\b|\bsterilit\b|\bsteril.*milj\b|\bvalidat\b|\biso\s*14159\b|\behedg\b|\bbioprocess\b|\bapi\b.*\bprodukt\b|\bcip\b|\bsip\b|\barzneimittel\b|\bfarmazeutisch\w*\b|\bfarmacéutic\w*\b|\bmedicamento\b|\bestéril\w*\b|\bvalidación\b/i.test(text);
}

/** Brands the site carries, matched against a customer's explicit request
 *  (e.g. "jag vill ha exempel för festo och smc") so rankActuators() can
 *  prefer them — see scoring.ts ScoringCtx.preferredBrands. Returns
 *  lowercased brand names exactly as stored in the brands table. */
function detectRequestedBrands(text: string): string[] {
  const found = new Set<string>();
  if (/\bfesto\b/i.test(text)) found.add("festo");
  if (/\bsmc\b/i.test(text)) found.add("smc");
  if (/\bparker\b/i.test(text)) found.add("parker");
  if (/\bbosch\b|\brexroth\b/i.test(text)) found.add("bosch rexroth");
  if (/\bnorgren\b/i.test(text)) found.add("norgren");
  if (/\bmetal\s*work\b/i.test(text)) found.add("metal work");
  if (/\bcamozzi\b/i.test(text)) found.add("camozzi");
  return [...found];
}

/** ATEX Dust (Zone 20/21/22) — combustible dust explosion. Different from gas zones (different group/category). */
function needsAtexDust(text: string): boolean {
  return /\bzon\s*2[012]\b|\bzone\s*2[012]\b|\bdamm.*explosion\b|\bexplosivt.*damm\b|\bcombustible.*dust\b|\bbrännbart.*damm\b|\bsädes\b.*\bexplos\b|\bmjöl.*explos\b|\bträ.*damm.*explos\b|\bcoal.*dust\b|\bkol.*damm\b|\bii[i]?\s*[23][d]\b|\bdust.*atex\b|\batex.*dust\b|\bstaub.*explosion\b|\bexplosionsfähig\w*\s?staub\b|\bbrennbar\w*\s?staub\b|\bmehlstaub\b|\bholzstaub\b|\bkohlestaub\b|\bexplosión\s?de\s?polvo\b|\bpolvo\s?combustible\b|\bpolvo\s?de\s?harina\b|\bpolvo\s?de\s?madera\b|\bpolvo\s?de\s?carbón\b/i.test(text);
}

/**
 * Battery manufacturing / Dryroom environment.
 * Prohibits copper (Cu), zinc (Zn) and nickel (Ni) in any wetted or moving part.
 * Standard ball screws, zinc-coated guides and most greases are FORBIDDEN.
 * Dew point typically -40 to -60 °C — particle generation is a critical risk.
 */
function needsBatteryDryroom(text: string): boolean {
  return /\bdryroom\b|\bdry\s*room\b|\btorrkammare\b|\blitiumjon\b|\blithium[-\s]?ion\b|\bli[-\s]?ion\b|\bbatterifabrik\b|\bbattery\s*(?:manufactur|produc|cell|fabrik)\b|\bbatteriproduk\b|\bbattericell\b|\bkatod(?:material)?\w*\b|\banod(?:material)?\w*\b|\belektrod(?:material)?\w*\b|\belectrode\b|\bpouch\s*cell\b|\blitiumbatteri\b|\bcell\s*monter\b|\bcu\/zn\/ni\b|\bkoppar.*zink.*nickel\b|\btrockenraum\b|\blithium[-\s]?ionen\b|\bbatteriefertigung\b|\bbatterieproduktion\b|\bsala\s?seca\b|\blitio[-\s]?ion\b|\bproducción\s?de\s?baterías\b|\bcátodo\w*\b|\bánodo\w*\b|\belectrodo\w*\b/i.test(text);
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
  // A bare sub-0.5 mm value ("0,05 mm", "0.02mm") is virtually always a tolerance /
  // repeatability spec, never a stroke — catch it even without ± or a keyword nearby.
  const subMm = all.match(/(?<![\d.,])(0[.,]\d+)\s*mm\b/i);
  if (subMm) {
    const v = parseFloat(subMm[1].replace(",", "."));
    if (v > 0 && v < 0.5) return v;
  }
  return 0;
}

/**
 * Drive-based pneumatic detector — does NOT trust the category. Some pneumatic
 * slides (Metal Work MW-S, SMC) are miscategorized as "linear-module" (an
 * electric category) yet run on compressed air (operating_pressure in bar) and
 * cannot achieve servo precision. We detect the real drive: a product with an
 * operating_pressure spec and no electric signal (voltage / repeatability_mm)
 * is pneumatic regardless of how it is categorized.
 */
function isPneumaticByDrive(p: CatalogProduct): boolean {
  const ks = p.key_specs ?? {};
  const hasAirPressure = ks["operating_pressure"] != null;
  const hasElectricSignal = ks["voltage"] != null || ks["repeatability_mm"] != null;
  return hasAirPressure && !hasElectricSignal;
}

/** Mechanical rod lock / holding brake demanded: the load must NOT drop on air
 *  AND power loss (e-stop with corrosive media, etc.). A pilot check valve holds
 *  pressure but not a broken hose — a spring-applied rod lock is the fail-safe. */
function needsRodLock(text: string): boolean {
  return /stångbroms|stång.?lås|rod.?lock|mekaniskt?\s+lås|fallskydd|spring.?applied|hållbroms|broms.*(strömavbrott|nödstopp|luftbortfall)|inte\s+fall(a|er)\s+(ner|ned)|får\s+inte\s+falla|kolbenstangenbremse|mechanische\s?verriegelung|mechanisches\s?schloss|absturzsicherung|darf\s?nicht\s?fallen|freno\s?de\s?vástago|bloqueo\s?mecánico|no\s?debe\s?caer|no\s?puede\s?caer/i.test(text);
}

/**
 * Detects washdown / food-grade / wet-environment requirements.
 * These applications require IP67/IP69K and stainless or food-grade plastic —
 * standard aluminum cylinders will corrode immediately.
 */
function needsWashdown(text: string): boolean {
  return /washdown|wash[-\s]down|livsmedel|food[-\s]grade|food[-\s]safe|mejeri|dairy|slakteri|slakter|livsmedelsgodkänd|livsmedelsgodkand|ip[-\s]?69|högtrycksspolning|högtryck.*spol|spol.*kemik|kemisk.*reng|cip\b|sip\b|hygienic|hygienisk|clean[-\s]design|cleandesign|rostfri|stainless|korrosionsskyddad|vätsk.*milj|blot.*milj|kemikalie|frätande|korrosiv|korrosion|\bsyra\b|syrabeständig|aggressiva?\s+(medier|vätskor|kemikalier)|lebensmittel\w*|molkerei|schlachthof|edelstahl|rostfrei\w*|hochdruckreinig\w*|chemikalie\w*|ätzend\w*|\bsäure\b|säurebeständig\w*|\balimentos?\b|grado\s?alimentici\w*|lácte\w*|matadero|acero\s?inoxidable|limpieza\s?a\s?alta\s?presión|químic\w*|corrosiv\w*|\bácido\b/i.test(text);
}

/** Returns true if the user requested end-position / stroke-end detection (sensors). */
function needsEndPositionDetection(text: string): boolean {
  return /detekt|givare|sensor|ändläge|end.pos|end.stop|stroke.end|reed|proximity|närhets|position.*detect|detect.*position|elektron.*detekt|signalera|signal.*läge|läges.*signal|kontrollera.*läge|läge.*kontroll|home.*detect|detect.*home|smcm|smc.*sensor|piston.*sens/i.test(text);
}

/** Explicitly requested bore (user typed/answered "diameter 50", "Ø63", "borrning 40").
 *  An explicit size must outrank the load-based "smallest adequate" sizing — answering
 *  Ø50 and getting Ø40 back is a trust-breaker even when Ø40 carries the load. */
function extractExplicitBoreMm(text: string, answers: Record<string, string>): number {
  for (const [k, v] of Object.entries(answers ?? {})) {
    if (/diam|borr|bore|⌀|ø/i.test(k)) {
      const m = String(v).match(/(\d{2,3})/);
      if (m) { const n = Number(m[1]); if (n >= 8 && n <= 320) return n; }
    }
  }
  const m = text.match(/(?:Ø|⌀)\s*(\d{2,3})|(?:diameter|borrning|bore)[^\d]{0,12}(\d{2,3})/i);
  if (m) { const n = Number(m[1] ?? m[2]); if (n >= 8 && n <= 320) return n; }
  return 0;
}

/** Articulated/swivel mounting: the cylinder PIVOTS during the stroke (angled push).
 *  Needs a rear swivel/pivot flange (ledlager/svängfläns) + a rod clevis (gaffelfäste),
 *  and the actuator must be a ROD cylinder — slides/rodless/guided units cannot
 *  articulate and must be excluded from the candidates. */
function needsArticulatedMount(text: string): boolean {
  return /ledlager|sväng.?fläns|swivel|gaffelfäste|gaffelkoppling|clevis|pivå|trunnion|vinkelbart|vrider sig|vrida sig|vrids under/i.test(text);
}
/** Slides, rodless and guided units cannot take a rear pivot + rod clevis. */
function isNonArticulatingActuator(p: CatalogProduct): boolean {
  return /slide|linjärslid|linjarslid|rodless|kolvstångslös|kolvstangslos|guide/i.test(`${p.name} ${p.sku}`);
}

/** Returns true if user wants mounting brackets / foot mounts / flanges. */
function needsMounting(text: string): boolean {
  return /fotfäste|foot.*mount|fot.*fäste|flansfäste|flange.*mount|monteringsfäste|bracket|montering|montage|fäste|befästning|konsol|mounting|swivel.*flange|trunnion/i.test(text);
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
  minStroke: number, locale: string, maxCatalogStroke: number, catalogCanHandle: boolean,
  ctx: CustomSolutionContext = {}
) {
  const { isWashdown, isVertical, isFoodGrade, isBatteryDryroom, isHydraulic, isAtex, isSilSafety } = ctx;

  // Build a context-specific "why" with product family recommendations
  let whyLines: string[] = [];

  if (!catalogCanHandle && maxCatalogStroke > 0 && minStroke > 0) {
    whyLines.push(pick(locale, {
      sv: `Längsta katalogprodukten når ${maxCatalogStroke} mm — kravet är ${minStroke} mm.`,
      en: `Longest catalog product reaches ${maxCatalogStroke} mm — requirement is ${minStroke} mm.`,
      de: `Das längste Katalogprodukt erreicht ${maxCatalogStroke} mm — die Anforderung beträgt ${minStroke} mm.`,
      es: `El producto de catálogo más largo alcanza ${maxCatalogStroke} mm — el requisito es ${minStroke} mm.`,
    }));
  }

  // Washdown + vertical + food = most demanding scenario — give two explicit architectural paths
  if (isWashdown && isVertical && isFoodGrade) {
    whyLines.push(pick(locale, {
      sv: `⚙️ Rekommenderade arkitekturval för slakteri/IP69K-miljö:\n` +
        `▸ ALT A – Pneumatisk rostfri cylinder (316L): SMC HY-serien (IP69K, NSF-H1-smörjning, EHEDG-hygienisk design) eller Parker P1S Stainless Washdown Cylinder. Komplettera med pneumatisk stångbroms (rod lock) för säker hållning vid strömavbrott.\n` +
        `▸ ALT B – Kapslad el-cylinder IP69K: Bosch Rexroth EMC-HD-XC (IP69K rostfritt, PROFINET-nativ) eller Parker ETH-serie Washdown. Kräver integrerad motorbroms + säkerhetsventil för SIL 2/PLd.`,
      en: `⚙️ Recommended architectural paths for slaughterhouse/IP69K:\n` +
        `▸ ALT A – Stainless pneumatic cylinder (316L): SMC HY-Series (IP69K, NSF-H1 lube, EHEDG hygienic design) or Parker P1S Stainless Washdown. Add pneumatic rod lock for safe holding on power loss.\n` +
        `▸ ALT B – Enclosed IP69K electric cylinder: Bosch Rexroth EMC-HD-XC (IP69K stainless, native PROFINET) or Parker ETH Washdown series. Requires integrated motor brake + safety valve for SIL 2/PLd.`,
      de: `⚙️ Empfohlene Architekturansätze für Schlachthof-/IP69K-Umgebung:\n` +
        `▸ VARIANTE A – Pneumatischer Edelstahlzylinder (316L): SMC HY-Serie (IP69K, NSF-H1-Schmierung, EHEDG-hygienisches Design) oder Parker P1S Stainless Washdown Cylinder. Ergänzen mit pneumatischer Kolbenstangenbremse (Rod Lock) für sicheres Halten bei Stromausfall.\n` +
        `▸ VARIANTE B – Gekapselter Elektrozylinder IP69K: Bosch Rexroth EMC-HD-XC (IP69K Edelstahl, natives PROFINET) oder Parker ETH-Serie Washdown. Erfordert integrierte Motorbremse + Sicherheitsventil für SIL 2/PLd.`,
      es: `⚙️ Rutas de arquitectura recomendadas para entorno de matadero/IP69K:\n` +
        `▸ OPCIÓN A – Cilindro neumático de acero inoxidable (316L): serie SMC HY (IP69K, lubricación NSF-H1, diseño higiénico EHEDG) o Parker P1S Stainless Washdown. Añadir bloqueo de vástago neumático (rod lock) para sujeción segura ante fallo de alimentación.\n` +
        `▸ OPCIÓN B – Cilindro eléctrico encapsulado IP69K: Bosch Rexroth EMC-HD-XC (IP69K inoxidable, PROFINET nativo) o serie Parker ETH Washdown. Requiere freno de motor integrado + válvula de seguridad para SIL 2/PLd.`,
    }));
  } else if (isWashdown && isFoodGrade) {
    whyLines.push(pick(locale, {
      sv: `Miljökrav IP69K + livsmedel kräver: SMC HY-serien (316L, NSF-H1) eller Parker P1S Washdown. Verifierat EHEDG-utförande rekommenderas.`,
      en: `IP69K + food-grade requires: SMC HY-Series (316L, NSF-H1) or Parker P1S Washdown. EHEDG-certified design recommended.`,
      de: `Umgebungsanforderung IP69K + Lebensmittelqualität erfordert: SMC HY-Serie (316L, NSF-H1) oder Parker P1S Washdown. EHEDG-zertifizierte Ausführung empfohlen.`,
      es: `El requisito de entorno IP69K + grado alimenticio exige: serie SMC HY (316L, NSF-H1) o Parker P1S Washdown. Se recomienda diseño certificado EHEDG.`,
    }));
  } else if (isWashdown) {
    whyLines.push(pick(locale, {
      sv: `IP69K-krav: Festo CRDSNU (rostfri), Camozzi Serie 90 (IP67+), SMC CDQ2-serien (IP67) eller Parker P1S. Inga standardaluminiumcylindrar.`,
      en: `IP69K requirement: Festo CRDSNU (stainless), Camozzi Serie 90 (IP67+), SMC CDQ2-series (IP67) or Parker P1S. No standard aluminum.`,
      de: `IP69K-Anforderung: Festo CRDSNU (Edelstahl), Camozzi Serie 90 (IP67+), SMC CDQ2-Serie (IP67) oder Parker P1S. Keine Standard-Aluminiumzylinder.`,
      es: `Requisito IP69K: Festo CRDSNU (inoxidable), Camozzi Serie 90 (IP67+), serie SMC CDQ2 (IP67) o Parker P1S. Sin cilindros de aluminio estándar.`,
    }));
  }

  if (isVertical && isSilSafety) {
    whyLines.push(pick(locale, {
      sv: `⚠️ Vertikal last + säkerhetsfunktion: Mekanisk stångbroms (t.ex. SMC MHF2 rod lock) eller integrerad motorbroms OBLIGATORISK. Säkerhetsventil SIL 2-certifierad krävs per ISO 13849 PLd.`,
      en: `⚠️ Vertical load + safety function: Mechanical rod lock (e.g. SMC MHF2) or integrated motor brake MANDATORY. SIL 2-certified safety valve required per ISO 13849 PLd.`,
      de: `⚠️ Vertikale Last + Sicherheitsfunktion: Mechanische Kolbenstangenbremse (z. B. SMC MHF2 Rod Lock) oder integrierte Motorbremse ZWINGEND ERFORDERLICH. SIL 2-zertifiziertes Sicherheitsventil gemäß ISO 13849 PLd erforderlich.`,
      es: `⚠️ Carga vertical + función de seguridad: Bloqueo de vástago mecánico (p. ej. SMC MHF2 rod lock) o freno de motor integrado OBLIGATORIO. Se requiere válvula de seguridad certificada SIL 2 según ISO 13849 PLd.`,
    }));
  } else if (isVertical) {
    whyLines.push(pick(locale, {
      sv: `⚠️ Vertikal rörelse: Pilotmanövrerad backslagsventil eller stångbroms OBLIGATORISK för att förhindra fall vid lufttrycksfall.`,
      en: `⚠️ Vertical movement: Pilot-operated check valve or rod lock MANDATORY to prevent drop on air loss.`,
      de: `⚠️ Vertikale Bewegung: Pilotgesteuertes Rückschlagventil oder Kolbenstangenbremse ZWINGEND ERFORDERLICH, um ein Absinken bei Luftdruckverlust zu verhindern.`,
      es: `⚠️ Movimiento vertical: Válvula antirretorno pilotada o bloqueo de vástago OBLIGATORIO para evitar la caída ante pérdida de presión de aire.`,
    }));
  }

  if (isBatteryDryroom) {
    whyLines.push(pick(locale, {
      sv: `⛔ Dryroom Cu/Zn/Ni-fritt: SMC 25-serien (Cu/Zn/Ni-fri, PFPE-smörjd). Begär materialdeklerationsintyg.`,
      en: `⛔ Dryroom Cu/Zn/Ni-free: SMC 25-Series (Cu/Zn/Ni-free, PFPE-lubricated). Request material declaration.`,
      de: `⛔ Trockenraum Cu/Zn/Ni-frei: SMC 25-Serie (Cu/Zn/Ni-frei, PFPE-geschmiert). Materialdeklaration anfordern.`,
      es: `⛔ Sala seca sin Cu/Zn/Ni: serie SMC 25 (sin Cu/Zn/Ni, lubricado con PFPE). Solicitar certificado de declaración de materiales.`,
    }));
  }

  if (isHydraulic) {
    whyLines.push(pick(locale, {
      sv: `Hydraulisk applikation (100-350 bar): Parker HMI/HYD-serien, Bosch Rexroth CDL1 eller SMC CH-serien. Utanför pneumatisk standardkatalog.`,
      en: `Hydraulic application (100-350 bar): Parker HMI/HYD-series, Bosch Rexroth CDL1 or SMC CH-series. Outside pneumatic standard catalog.`,
      de: `Hydraulische Anwendung (100–350 bar): Parker HMI/HYD-Serie, Bosch Rexroth CDL1 oder SMC CH-Serie. Außerhalb des pneumatischen Standardkatalogs.`,
      es: `Aplicación hidráulica (100-350 bar): serie Parker HMI/HYD, Bosch Rexroth CDL1 o serie SMC CH. Fuera del catálogo neumático estándar.`,
    }));
  }

  if (isAtex) {
    whyLines.push(pick(locale, {
      sv: `ATEX-zon: Alla komponenter måste vara NAMUR/IECEx-certifierade. Parker P1X ATEX, SMC CDQMB-ATEX eller Norgren Excelon ATEX-serien.`,
      en: `ATEX zone: All components must be NAMUR/IECEx-certified. Parker P1X ATEX, SMC CDQMB-ATEX or Norgren Excelon ATEX-series.`,
      de: `ATEX-Zone: Alle Komponenten müssen NAMUR/IECEx-zertifiziert sein. Parker P1X ATEX, SMC CDQMB-ATEX oder Norgren Excelon ATEX-Serie.`,
      es: `Zona ATEX: Todos los componentes deben estar certificados NAMUR/IECEx. Parker P1X ATEX, SMC CDQMB-ATEX o serie Norgren Excelon ATEX.`,
    }));
  }

  if (whyLines.length === 0) {
    whyLines.push(pick(locale, {
      sv: `Vill du ha en lösning helt anpassad efter era exakta krav? Vi sköter leverantörsdialogen och levererar en komplett offert med exakt pris och leveranstid.`,
      en: `Want a solution fully tailored to your exact requirements? We manage the supplier dialogue and deliver a complete quote with exact pricing and lead time.`,
      de: `Möchten Sie eine Lösung, die exakt auf Ihre Anforderungen zugeschnitten ist? Wir übernehmen den Dialog mit dem Lieferanten und liefern ein vollständiges Angebot mit genauem Preis und Lieferzeit.`,
      es: `¿Desea una solución totalmente adaptada a sus requisitos exactos? Nos encargamos del diálogo con el proveedor y entregamos una oferta completa con precio y plazo de entrega exactos.`,
    }));
  }

  return {
    sku: "CUSTOM-SOLUTION",
    name: pick(locale, { sv: "Kundspecifik lösning", en: "Custom engineered solution", de: "Kundenspezifische Lösung", es: "Solución personalizada" }),
    badge: pick(locale, { sv: "Kundlösning", en: "Custom solution", de: "Kundenlösung", es: "Solución a medida" }),
    bore_mm: null, stroke_mm: minStroke > 0 ? minStroke : null, force_n: null,
    why: whyLines.join(" "),
    pros: pick(locale, {
      sv: ["Exakt anpassad till era krav", "Vi kör dialogen med leverantören", "Offert med pris och leveranstid"],
      en: ["Exactly matched to your requirements", "We manage the supplier dialogue", "Quote with pricing and lead time"],
      de: ["Exakt auf Ihre Anforderungen abgestimmt", "Wir führen den Lieferantendialog", "Angebot mit Preis und Lieferzeit"],
      es: ["Exactamente adaptado a sus requisitos", "Gestionamos el diálogo con el proveedor", "Oferta con precio y plazo de entrega"],
    }),
    cons: pick(locale, {
      sv: ["Längre ledtid än lagerprodukt", "Kräver offertförfrågan"],
      en: ["Longer lead time than stock items", "Requires a quote request"],
      de: ["Längere Lieferzeit als Lagerware", "Erfordert eine Angebotsanfrage"],
      es: ["Plazo de entrega más largo que los artículos en stock", "Requiere solicitud de oferta"],
    }),
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

/**
 * Calculate minimum required bore (mm) from load (kg) at given pressure (bar).
 * Uses F = P × A formula with safety factor 2.
 */
function calcMinBoreMm(loadKg: number, pressureBar = 6): number {
  if (loadKg <= 0) return 0;
  const forceN = loadKg * 9.81 * 2; // safety factor 2
  const areaMm2 = (forceN / (pressureBar * 0.1)); // bar→N/mm²
  return Math.ceil(2 * Math.sqrt(areaMm2 / Math.PI));
}

/** Extract mass/load in kg from free text + answers. */
function extractLoadKg(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const kgMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kgMatch) return parseFloat(kgMatch[1].replace(",", "."));
  const nMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*N\b/);
  if (nMatch) return parseFloat(nMatch[1].replace(",", ".")) / 9.81;
  return 0;
}

/** Extract required torque (Nm) for a rotary-actuator request. */
function extractTorqueNm(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const m = allText.match(/(\d+(?:[.,]\d+)?)\s*Nm\b/i);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

/** Extract required rotation angle (degrees) for a rotary-actuator request. */
function extractRotationDeg(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const m = allText.match(/(\d{2,3})\s*(?:°|grad(?:er)?|degrees?)\b/i);
  return m ? parseFloat(m[1]) : 0;
}

function parseTorqueFromSpecs(specs: Record<string, unknown>): number {
  const v = specs["torque"] ?? specs["torque_nm"];
  if (v == null) return 0;
  const n = parseFloat(String(v).match(/\d+(?:\.\d+)?/)?.[0] ?? "");
  return isNaN(n) ? 0 : n;
}

/**
 * v40: Find the best catalog product of a given component type.
 * Returns null if no catalog match exists — caller should use SPECIFY.
 */
function findCatalogProductByType(
  type: "valve" | "frl" | "check-valve" | "shock-absorber" | "sensor" | "valve-terminal" | "fitting" | "cable" | "mounting" | "servo-motor" | "servo-drive" | "silencer" | "flow-control" | "tubing",
  products: CatalogProduct[]
): CatalogProduct | null {
  // FRL: prefer Festo MS4/MS6 first — avoids Camozzi MC- sorting to front alphabetically
  if (type === "frl") {
    return (
      products.find(p => /\bMS4\b|\bMS6\b/i.test(p.name + " " + p.sku)) ??
      products.find(p => p.category === "frl" || /\bFRL\b|\bLFR\b|\bHFR\b/i.test(p.name + " " + p.sku)) ??
      null
    );
  }
  // Prefer catalog SKUs with a brand prefix (FESTO-/FE-/SMC-/MW-/…) over raw,
  // un-prefixed manufacturer part numbers so BOMs stay consistent and clean.
  const BRAND_PREFIX = /^(festo|fe|smc|mw|cam|camozzi|nor|norgren|parker|br)-/i;
  const ordered = [...products].sort(
    (a, b) => (BRAND_PREFIX.test(a.sku) ? 0 : 1) - (BRAND_PREFIX.test(b.sku) ? 0 : 1)
  );
  // Exact category match wins (branded-first) so a loose name regex for one type
  // can't grab a product from another category — e.g. a "silencer" (ljuddämpare)
  // must never satisfy a "shock-absorber" (stötdämpare) lookup via "dämpare".
  const exactCat = ordered.find(p => p.category === type);
  if (exactCat) return exactCat;
  for (const p of ordered) {
    const nameSkuLower = (p.name + " " + p.sku).toLowerCase();
    switch (type) {
      case "valve":
        if (p.category === "valve" || /\bsolenoid\b|\b5\/2\b|\b4\/2\b|\bmagnetventil\b|\bdirektional/i.test(p.name)) return p;
        break;
      case "check-valve":
        if (p.category === "check-valve" || /backslagsventil|check.valve|pilot.operated.check|sperrventil|non.return/i.test(nameSkuLower)) return p;
        break;
      case "shock-absorber":
        if (p.category === "shock-absorber" || /st.tdämpare|shock.?absorber|st.tdämp/i.test(nameSkuLower)) return p;
        break;
      case "sensor":
        if (p.category === "sensor" || /\bSME\b|\bSMT\b|\bgivare\b|\breed.switch\b|\bproximity\b|\bend.pos/i.test(p.name + " " + p.sku)) return p;
        break;
      case "valve-terminal":
        if (p.category === "valve-terminal" || /\bCPV\b|\bVTSA\b|\bMPA\b|\bventilramp\b|\bventilterminal\b/i.test(p.name + " " + p.sku)) return p;
        break;
      case "fitting":
        if (p.category === "fitting" || /\bQS\b|\bQST\b|\bKQ\b|\bHB-\b|\bsnabbkoppling\b|\bpush.in/i.test(p.name + " " + p.sku)) return p;
        break;
      case "cable":
        if (p.category === "cable" || /\bkabel\b|\bcable\b|\bNEBU\b|\bSBOO\b|\bmotor.*kabel\b/i.test(p.name + " " + p.sku)) return p;
        break;
      case "mounting":
        if (p.category === "mounting" || /fotfäste|foot.mount|flansfäste|flange.mount|monteringsfäste|bracket|trunnion/i.test(nameSkuLower)) return p;
        break;
      case "servo-motor":
        if (p.category === "servo-motor" || /\bservo.?motor\b|\bstegmotor\b|\bstepper.?motor\b|\bEMMS\b|\bEMME\b|\bEMCA\b|\bEMMT\b/i.test(p.name + " " + p.sku)) return p;
        break;
      case "servo-drive":
        if (p.category === "servo-drive" || /\bservodriv|\bdrivsteg\b|\bamplifier\b|\bCMMP\b|\bCMMT\b|\bLECP\b|\bLECA\b|\bSTM\b/i.test(p.name + " " + p.sku)) return p;
        break;
      case "silencer":
        if (p.category === "silencer" || /ljuddämp|silencer|muffler|schalldämp/i.test(nameSkuLower)) return p;
        break;
      case "flow-control":
        if (p.category === "flow-control" || /flödesregler|flow.?control|strypback|speed.?control|throttle|drossel/i.test(nameSkuLower)) return p;
        break;
      case "tubing":
        if (p.category === "tubing" || /\bslang\b|tubing|polyuret|\bpun\b|\bpan\b|\btu\b/i.test(nameSkuLower)) return p;
        break;
    }
  }
  return null;
}

/** Find a real catalog actuator for a secondary axis (electric axis or pneumatic
 *  cylinder) matching a target stroke — so multi-axis BOMs emit real SKUs, not
 *  "ej i katalog" placeholders. */
function findAxisActuator(products: CatalogProduct[], strokeMm: number, isElectric: boolean): CatalogProduct | null {
  const cands = products.filter(p => isElectric
    ? isElectricActuator(p) && !isPneumaticByDrive(p)
    : isPneumaticActuatorProduct(p) && !isElectricActuator(p));
  if (cands.length === 0) return null;
  if (strokeMm > 0) {
    const fit = cands.find(p => { const s = parseStrokeFromSpecs(p.key_specs ?? {}); return s === 0 || s >= strokeMm; });
    if (fit) return fit;
  }
  return cands[0];
}

/** Cycle time in seconds from free text / answers ("1,5 sek cykeltid", "cykeltid 2 s"). */
function extractCycleTimeS(text: string, answers: Record<string, string>): number {
  const all = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  const m = all.match(/(?:cykeltid|cycle\s*time|takt(?:tid)?)[^\d]{0,12}(\d+(?:[.,]\d+)?)\s*(?:s\b|sek\w*|sec\w*)/i)
    || all.match(/(\d+(?:[.,]\d+)?)\s*(?:s\b|sek\w*|sec\w*)\s*(?:cykel|cycle|takt)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

function needsLowCost(text: string): boolean {
  return /\blåg\s*kostnad\b|\bbillig\w*\b|\bkostnadseffektiv\w*\b|\bbudget\b|\blow[\s-]?cost\b|\bcheap\b|\bcost[\s-]?effective\b|\bminimera\s*kostnad/i.test(text);
}
function needsContinuousDuty(text: string): boolean {
  return /\b24\s*\/?\s*7\b|\bdygnet\s*runt\b|\bkontinuerlig\w*\s*drift\b|\bcontinuous\s*(?:duty|operation)\b|\bnon[\s-]?stop\b|\b3[\s-]?skift\b/i.test(text);
}
function needsDirtyEnv(text: string): boolean {
  return /\bdamm\w*\b|\bdust\w*\b|\bolja\b|\boil\w*\b|\bsmuts\w*\b|\bdirty\b|\bspån\b|\bchips\b|\bkylvätska\b|\bcoolant\b|\bpartik\w*\b|\bcontaminat/i.test(text);
}

/** First-order move dynamics from cycle time + stroke + mass (triangular profile). */
function computeDynamics(massKg: number, strokeMm: number, cycleTimeS: number, isVertical: boolean):
  { vPeak: number; accel: number; forceN: number } | null {
  if (massKg <= 0 || strokeMm <= 0 || cycleTimeS <= 0) return null;
  const s = strokeMm / 1000;
  const tMove = Math.max(0.3 * cycleTimeS, 0.05);   // assume ~30% of the cycle is the move
  const accel = (4 * s) / (tMove * tMove);           // triangular profile, peak accel
  const vPeak = (2 * s) / tMove;
  const g = 9.81;
  const forceN = massKg * accel + (isVertical ? massKg * g : 0) + 0.1 * massKg * g;
  return { vPeak, accel, forceN };
}

/** Flag conflicting / unrealistic requirement combinations — what a real engineer says. */
function detectConflicts(f: {
  locale: string; precisionMm: number; isHighPrecision: boolean; speedMs: number;
  isDirtyEnv: boolean; isWashdown: boolean; isAtexDust: boolean; isLowCost: boolean;
  is24x7: boolean; dyn: { vPeak: number; accel: number; forceN: number } | null;
}): string[] {
  const { locale } = f; const out: string[] = [];
  if (f.isHighPrecision && (f.isDirtyEnv || f.isWashdown || f.isAtexDust))
    out.push(pick(locale, {
      sv: `±${f.precisionMm} mm i smutsig/våt miljö krockar — kulskruv kräver tätning/bälg och skydd mot damm/olja, annars degraderar precisionen. Kräver IP-klassad/skyddad axel (fördyrar).`,
      en: `±${f.precisionMm} mm in a dusty/wet environment conflicts — a ball screw needs sealing/bellows and protection or precision degrades. Requires an IP-rated/protected axis (adds cost).`,
      de: `±${f.precisionMm} mm in staubiger/feuchter Umgebung ist ein Widerspruch — eine Kugelumlaufspindel benötigt Abdichtung/Faltenbalg und Schutz, sonst verschlechtert sich die Präzision. Erfordert eine IP-geschützte Achse (verursacht Mehrkosten).`,
      es: `±${f.precisionMm} mm en un entorno sucio/húmedo genera un conflicto — un husillo de bolas necesita sellado/fuelle y protección, o la precisión se degrada. Requiere un eje con protección IP (encarece el coste).`,
    }));
  if (f.isHighPrecision && f.isLowCost)
    out.push(pick(locale, {
      sv: `Hög precision (±${f.precisionMm} mm) och låg kostnad krockar — kulskruvsservo + styrning är dyrare än pneumatik. Prioritera ett av kraven.`,
      en: `High precision (±${f.precisionMm} mm) and low cost conflict — ball-screw servo + control costs more than pneumatics. Prioritise one.`,
      de: `Hohe Präzision (±${f.precisionMm} mm) und niedrige Kosten stehen im Widerspruch — Kugelumlaufspindel-Servo + Steuerung kostet mehr als Pneumatik. Priorisieren Sie eine der beiden Anforderungen.`,
      es: `Alta precisión (±${f.precisionMm} mm) y bajo coste entran en conflicto — el servo de husillo de bolas + control cuesta más que la neumática. Priorice uno de los dos requisitos.`,
    }));
  if (f.isHighPrecision && f.speedMs > 0.8)
    out.push(pick(locale, {
      sv: `Hög hastighet (${f.speedMs} m/s) + ±${f.precisionMm} mm — kulskruv begränsas av varvtal/resonans, kuggrem av backlash. Verifiera axeln; ev. kuggrem + linjärgivare (sluten loop).`,
      en: `High speed (${f.speedMs} m/s) + ±${f.precisionMm} mm — ball screws are rpm/resonance-limited, belts have backlash. Verify the axis; possibly belt + linear encoder (closed loop).`,
      de: `Hohe Geschwindigkeit (${f.speedMs} m/s) + ±${f.precisionMm} mm — Kugelumlaufspindeln sind drehzahl-/resonanzbegrenzt, Zahnriemen haben Spiel (Backlash). Achse prüfen; ggf. Zahnriemen + Linearencoder (geschlossener Regelkreis).`,
      es: `Alta velocidad (${f.speedMs} m/s) + ±${f.precisionMm} mm — los husillos de bolas están limitados por RPM/resonancia, las correas dentadas tienen holgura. Verifique el eje; posiblemente correa + encoder lineal (bucle cerrado).`,
    }));
  if (f.is24x7 && f.dyn)
    out.push(pick(locale, {
      sv: `Kontinuerlig drift (24/7) vid ~${Math.round(f.dyn.forceN)} N — dimensionera för livslängd/duty cycle (L10); kulskruv och lager slits vid hög acceleration.`,
      en: `Continuous duty (24/7) at ~${Math.round(f.dyn.forceN)} N — size for service life/duty cycle (L10); ball screw and bearings wear under high acceleration.`,
      de: `Dauerbetrieb (24/7) bei ~${Math.round(f.dyn.forceN)} N — für Lebensdauer/Duty-Cycle (L10) dimensionieren; Kugelumlaufspindel und Lager verschleißen bei hoher Beschleunigung.`,
      es: `Servicio continuo (24/7) a ~${Math.round(f.dyn.forceN)} N — dimensione para vida útil/ciclo de trabajo (L10); el husillo de bolas y los rodamientos se desgastan con alta aceleración.`,
    }));
  return out;
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
  locale: string;
  products: CatalogProduct[];
  // Accessory flags — drive deterministic accessory rows
  isMounting: boolean;
  isArticulated: boolean;
  isRodLock: boolean;
  primaryBoreMm: number;   // fetched by SKU — `products` (30/category) may miss the primary
  primaryBrand: string;    // same as above — see fetchPrimaryInfo() call site
  // Safety & environment flags — drive mandatory warning rows
  isHighTemp: boolean;
  isWashdown: boolean;
  isSilSafety: boolean;
  isHydraulic: boolean;
  isVeryHighForce: boolean;
  // Multi-axis
  isMultiAxis: boolean;
  perAxisStrokes: Array<{ axis: string; stroke: number }>;
}

/**
 * v40: Build ALL mandatory BOM rows using deterministic engineering rules.
 * This replaces per-component injections scattered across handleBom().
 * The LLM cannot affect these rows — they are always present.
 */
function buildMandatoryBomRows(ctx: BomCtx): Array<{ sku: string; quantity: number; role: string; reason: string }> {
  const { primarySku, primaryIsFamilyProd, isElectric, isAtex, isAtexDust,
          isVerticalLoad, isHighSpeed, valveTerminal, isEndPosDetect, locale, products,
          isMounting, isArticulated, isRodLock, primaryBoreMm, primaryBrand: primaryBrandFetched, isHighTemp, isWashdown, isSilSafety, isHydraulic, isVeryHighForce,
          isMultiAxis, perAxisStrokes } = ctx;
  const isPneumatic = !isElectric && !isAtex && !isAtexDust;
  const rows: Array<{ sku: string; quantity: number; role: string; reason: string }> = [];

  // ── 1. Primary actuator (ALWAYS first) ───────────────────────────
  // In a multi-axis job the primary covers the LONGEST-stroke axis — label rows by
  // axis so X/Z are never ambiguous (and "primary" isn't just "first parsed").
  const primaryAxisIdx = perAxisStrokes.length
    ? perAxisStrokes.reduce((best, a, i, arr) => (a.stroke > arr[best].stroke ? i : best), 0)
    : -1;
  const primaryAxisLabel = (isMultiAxis && primaryAxisIdx >= 0) ? perAxisStrokes[primaryAxisIdx].axis.toUpperCase() : "";
  const famNote = primaryIsFamilyProd ? pick(locale, {
    sv: " ⚠️ Produktfamilj — ange komplett beställningskod (bore + stroke + varianter) vid order.",
    en: " ⚠️ Product family — specify full ordering code (bore + stroke + variants) when ordering.",
    de: " ⚠️ Produktfamilie — vollständigen Bestellcode (Bohrung + Hub + Varianten) bei der Bestellung angeben.",
    es: " ⚠️ Familia de productos — indique el código de pedido completo (diámetro + carrera + variantes) al realizar el pedido.",
  }) : "";
  rows.push({
    sku: primarySku, quantity: 1,
    role: pick(locale, { sv: "Primär aktuator", en: "Primary actuator", de: "Primäraktuator", es: "Actuador primario" })
      + (primaryAxisLabel ? pick(locale, { sv: ` — ${primaryAxisLabel}-axel`, en: ` — ${primaryAxisLabel}-axis`, de: ` — ${primaryAxisLabel}-Achse`, es: ` — eje ${primaryAxisLabel}` }) : ""),
    reason: pick(locale, { sv: "Vald primär aktuator", en: "Selected primary actuator", de: "Ausgewählter Primäraktuator", es: "Actuador primario seleccionado" }) + famNote,
  });

  // Prefer the primary's brand when picking motor/drive/sensor/secondary axis, so
  // e.g. an SMC axis gets an SMC drive rather than a Festo one. Same-brand sorted
  // to front. Found 2026-08-21: this used to look up the primary's brand via
  // `products.find(p => p.sku === primarySku)`, but `products` here is capped at
  // 30 per category and ordered by brand slug then SKU — for a category with
  // >30 rows before a given brand alphabetically (e.g. "cylinder" has 45
  // bosch-rexroth rows alone, so nothing from smc/norgren/parker/metal-work ever
  // survives the cut), the primary SKU itself is silently absent from `products`,
  // so this returned "" and brandSorted silently fell back to unsorted `products`
  // every time — the exact same failure mode primaryBoreMm was already fetched
  // separately to avoid (see its comment above). Reusing that same fetch now that
  // it also returns brand, instead of re-deriving it from a pool that may not
  // contain the one product that actually matters here.
  const primaryBrand = primaryBrandFetched.toLowerCase();
  const brandSorted = primaryBrand
    ? [...products].sort((a, b) => (a.brand?.toLowerCase() === primaryBrand ? 0 : 1) - (b.brand?.toLowerCase() === primaryBrand ? 0 : 1))
    : products;

  // ── 2. Servo motor (all electric axes; brake emphasised when vertical) ───
  if (isElectric) {
    const motorMatch = findCatalogProductByType("servo-motor", brandSorted);
    const sameBrandMotor = !!motorMatch && !!primaryBrand && motorMatch.brand?.toLowerCase() === primaryBrand;
    if (sameBrandMotor) {
      // Separate-motor brands (e.g. Festo EGSK + EMME, Parker HMR + MPP) — the axis
      // needs its own servo motor whether horizontal or vertical.
      // Label by the ACTUAL motor type — a Camozzi MTS is a STEPPER, not a servo.
      // Hard-coding "Servomotor" produced the stepper/servo mix-up users flagged.
      const stepperMotor = /steg|stepper/i.test(`${motorMatch!.name} ${motorMatch!.sku}`);
      rows.push({
        sku: motorMatch!.sku, quantity: 1,
        role: isVerticalLoad
          ? pick(locale, { sv: "Bromsmotor (vertikal säkerhet)", en: "Brake motor (vertical safety)", de: "Bremsmotor (vertikale Sicherheit)", es: "Motor con freno (seguridad vertical)" })
          : pick(locale, stepperMotor
              ? { sv: "Stegmotor", en: "Stepper motor", de: "Schrittmotor", es: "Motor paso a paso" }
              : { sv: "Servomotor", en: "Servo motor", de: "Servomotor", es: "Servomotor" }),
        reason: `${motorMatch!.name} (${motorMatch!.brand}) — ` + (isVerticalLoad
          ? pick(locale, {
              sv: "OBLIGATORISK för vertikal elektrisk axel — beställ med integrerad hållbroms som håller lasten vid strömavbrott/nödstopp.",
              en: "MANDATORY for a vertical electric axis — order with integrated holding brake to keep the load on power loss/E-stop.",
              de: "ZWINGEND ERFORDERLICH für eine vertikale elektrische Achse — mit integrierter Haltebremse bestellen, die die Last bei Stromausfall/Not-Halt hält.",
              es: "OBLIGATORIO para un eje eléctrico vertical — pedir con freno de retención integrado que sujete la carga ante fallo de alimentación/parada de emergencia.",
            })
          : pick(locale, {
              sv: "Driver axeln — matcha moment/varvtal mot lasten; samma märke som axel och drivare.",
              en: "Drives the axis — match torque/speed to the load; same brand as the axis and drive.",
              de: "Treibt die Achse an — Drehmoment/Drehzahl auf die Last abstimmen; gleiche Marke wie Achse und Antrieb.",
              es: "Impulsa el eje — ajuste el par/velocidad a la carga; misma marca que el eje y el accionamiento.",
            })),
      });
    } else if (isVerticalLoad) {
      // Integrated-motor actuator (e.g. SMC LE-series) — the holding brake is an
      // ORDER OPTION on the actuator, not a separate (foreign-brand) motor.
      rows[0].reason += pick(locale, {
        sv: " Beställ med integrerad hållbroms (bromsoption) för vertikal säkerhet — håller lasten vid strömavbrott.",
        en: " Order with the integrated holding-brake option for vertical safety — holds the load on power loss.",
        de: " Mit der Option integrierte Haltebremse für vertikale Sicherheit bestellen — hält die Last bei Stromausfall.",
        es: " Pedir con la opción de freno de retención integrado para seguridad vertical — sujeta la carga ante fallo de alimentación.",
      });
    }
  }

  // Found 2026-08-21 (adversarial test): an electric axis explicitly asked for
  // end-position sensors got zero acknowledgment of that anywhere in the BOM -
  // isEndPosDetect only ever adds a row inside `isPneumatic` (or, since the
  // ATEX fix above, `isAtex`/`isAtexDust`) branches, and isElectric is none of
  // those. Less severe than the ATEX case (a servo axis's integrated encoder
  // genuinely already provides position feedback, so no separate sensor is
  // actually missing) but the same "stated requirement silently vanished"
  // problem applies - say so, appended to the primary actuator row rather
  // than inventing a purchasable-looking row for something that isn't one.
  if (isEndPosDetect && isElectric) {
    rows[0].reason += pick(locale, {
      sv: " OBS: separat ändlägesgivare behövs inte — servoaxelns inbyggda encoder ger redan exakt lägesåterkoppling till PLC:n.",
      en: " Note: a separate end-position sensor isn't needed — the servo axis's built-in encoder already provides precise position feedback to the PLC.",
      de: " Hinweis: ein separater Endlagensensor ist nicht erforderlich — der integrierte Encoder der Servoachse liefert bereits eine präzise Positionsrückmeldung an die SPS.",
      es: " Nota: no se necesita un sensor de fin de carrera independiente — el encoder integrado del eje servo ya proporciona una retroalimentación de posición precisa al PLC.",
    });
  }

  // ── 2b. Servo drive / amplifier (all electric axes) ──────────────
  if (isElectric) {
    const driveMatch = findCatalogProductByType("servo-drive", brandSorted);
    const sameBrandDrive = !!driveMatch && !!primaryBrand && driveMatch.brand?.toLowerCase() === primaryBrand;
    const bU = primaryBrand ? primaryBrand.toUpperCase() : "";
    const stepperDrive = !!driveMatch && /steg|stepper/i.test(`${driveMatch.name} ${driveMatch.sku}`);
    rows.push({
      sku: sameBrandDrive ? driveMatch!.sku : "SPECIFY", quantity: 1,
      role: pick(locale, stepperDrive
        ? { sv: "Stegmotordrivare (drivsteg)", en: "Stepper drive (driver)", de: "Schrittmotortreiber (Endstufe)", es: "Controlador de motor paso a paso" }
        : { sv: "Servodrivare (drivsteg)", en: "Servo drive (amplifier)", de: "Servoantrieb (Endstufe)", es: "Accionamiento servo (amplificador)" }),
      reason: sameBrandDrive
        ? `${driveMatch!.name} (${driveMatch!.brand}). ` + pick(locale, {
            sv: "Driver och styr motorn — matcha effekt/spänning mot axeln; ange styrgränssnitt (step/dir eller fältbuss).",
            en: "Drives and controls the motor — match power/voltage to the axis; specify control interface (step/dir or fieldbus).",
            de: "Treibt und steuert den Motor — Leistung/Spannung auf die Achse abstimmen; Steuerschnittstelle angeben (Step/Dir oder Feldbus).",
            es: "Impulsa y controla el motor — ajuste la potencia/tensión al eje; indique la interfaz de control (paso/dirección o bus de campo).",
          })
        : pick(locale, {
            sv: `Specificera kompatibel drivare för ${bU ? bU + "-" : ""}axeln — vi har ingen ${bU}-drivare i katalogen ännu, begär offert.`,
            en: `Specify a compatible drive for the ${bU ? bU + " " : ""}axis — no ${bU} drive in the catalogue yet, request a quote.`,
            de: `Kompatiblen Antrieb für die ${bU ? bU + "-" : ""}Achse angeben — wir haben noch keinen ${bU}-Antrieb im Katalog, bitte Angebot anfordern.`,
            es: `Especifique un accionamiento compatible para el eje ${bU ? bU + " " : ""}— todavía no tenemos un accionamiento ${bU} en el catálogo, solicite una oferta.`,
          }),
    });
  }

  // ── 3. Check valve (vertical pneumatic) ──────────────────────────
  if (isVerticalLoad && isPneumatic) {
    const cvMatch = findCatalogProductByType("check-valve", products);
    rows.push({
      sku: cvMatch?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "Pilotmanövrerad backslagsventil", en: "Pilot-operated check valve", de: "Pilotgesteuertes Rückschlagventil", es: "Válvula antirretorno pilotada" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK vid pneumatisk vertikal last — förhindrar att lasten faller vid lufttrycksförlust (IEC 60947-5-1)",
        en: "MANDATORY for pneumatic vertical load — prevents load drop on air pressure loss (IEC 60947-5-1)",
        de: "ZWINGEND ERFORDERLICH bei pneumatischer vertikaler Last — verhindert ein Absinken der Last bei Luftdruckverlust (IEC 60947-5-1)",
        es: "OBLIGATORIO para carga vertical neumática — evita la caída de la carga ante pérdida de presión de aire (IEC 60947-5-1)",
      }),
    });
  }

  // ── 3b. Mechanical rod lock (fail-safe holding) — bore-matched ────
  // Explicitly demanded ("stångbroms/mekaniskt lås/får inte falla") or vertical +
  // SIL/e-stop context. The check valve holds PRESSURE; only a spring-applied rod
  // lock holds the load through a broken hose or e-stop venting. Same matching
  // rule as mountings: a real SKU only when its bore equals the primary's,
  // otherwise SPECIFY with the required Ø called out — never a mismatched lock.
  if (isRodLock && isPneumatic) {
    const primary = products.find(p => p.sku === primarySku);
    const pBore = primaryBoreMm ||
                  firstNumAbs(primary?.key_specs?.bore_mm) ||
                  firstNumAbs((primary?.name ?? "").match(/Ø\s?(\d+)/)?.[1]);
    const boreTxt = pBore > 0 ? `Ø${pBore}` : pick(locale, { sv: "cylinderns borrning", en: "the cylinder's bore", de: "die Zylinderbohrung", es: "el diámetro del cilindro" });
    const lock = products.find(p =>
      p.category === "rod-lock" && pBore > 0 &&
      (firstNumAbs(p.key_specs?.bore_mm) === pBore || firstNumAbs(p.name.match(/Ø\s?(\d+)/)?.[1]) === pBore));
    rows.push({
      sku: lock?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "Stångbroms/mekaniskt lås (fail-safe)", en: "Rod lock / mechanical brake (fail-safe)", de: "Kolbenstangenbremse/mechanische Verriegelung (fail-safe)", es: "Bloqueo de vástago/freno mecánico (fail-safe)" }),
      reason: lock
        ? pick(locale, {
            sv: `${lock.name} — fjäderbelastat lås som låser kolvstången vid luftbortfall, ${boreTxt}-matchad mot cylindern. Backventilen håller trycket; låset håller lasten även vid slangbrott eller nödstoppsavluftning.`,
            en: `${lock.name} — spring-applied lock that clamps the rod on air loss, ${boreTxt}-matched to the cylinder. The check valve holds pressure; the lock holds the load even through hose rupture or e-stop venting.`,
            de: `${lock.name} — federbetätigte Verriegelung, die die Kolbenstange bei Luftverlust festklemmt, ${boreTxt}-passend zum Zylinder. Das Rückschlagventil hält den Druck; die Verriegelung hält die Last auch bei Schlauchbruch oder Not-Halt-Entlüftung.`,
            es: `${lock.name} — bloqueo accionado por resorte que sujeta el vástago ante pérdida de aire, ajustado a ${boreTxt} del cilindro. La válvula antirretorno mantiene la presión; el bloqueo sujeta la carga incluso ante rotura de manguera o purga por parada de emergencia.`,
          })
        : pick(locale, {
            sv: `Ange stångbroms/mekaniskt lås i ${boreTxt} — fjäderbelastat, låser vid luft-/strömbortfall. MÅSTE matcha cylinderns borrning; ${boreTxt}-variant saknas i lager (kundspecifik/offert).`,
            en: `Specify a rod lock / mechanical brake in ${boreTxt} — spring-applied, locks on air/power loss. MUST match the cylinder bore; no ${boreTxt} variant in stock (custom/quote).`,
            de: `Kolbenstangenbremse/mechanische Verriegelung in ${boreTxt} angeben — federbetätigt, verriegelt bei Luft-/Stromausfall. MUSS zur Zylinderbohrung passen; ${boreTxt}-Variante nicht auf Lager (kundenspezifisch/Angebot).`,
            es: `Indique un bloqueo de vástago/freno mecánico en ${boreTxt} — accionado por resorte, bloquea ante fallo de aire/alimentación. DEBE coincidir con el diámetro del cilindro; no hay variante ${boreTxt} en stock (a medida/oferta).`,
          }),
    });
  }

  // ── 4. Valve terminal (multi-actuator / fieldbus) OR single directional valve ─
  if (valveTerminal && isPneumatic) {
    const vtMatch = findCatalogProductByType("valve-terminal", products);
    rows.push({
      sku: vtMatch?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "Ventilramp (ventilterminal)", en: "Valve terminal (manifold)", de: "Ventilinsel (Ventilterminal)", es: "Terminal de válvulas (colector)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK för fältbussanslutning (PROFINET/EtherCAT) — ventilramp (CPV, VTSA, MPA) samlar alla ventiler i en enhet och reducerar kabelkostnad. Specificera bussmodul och ventilantal.",
        en: "MANDATORY for fieldbus (PROFINET/EtherCAT) — valve terminal (CPV, VTSA, MPA) consolidates all valves, reduces wiring. Specify bus module and valve count.",
        de: "ZWINGEND ERFORDERLICH für Feldbusanbindung (PROFINET/EtherCAT) — die Ventilinsel (CPV, VTSA, MPA) fasst alle Ventile in einer Einheit zusammen und reduziert den Verkabelungsaufwand. Busmodul und Ventilanzahl angeben.",
        es: "OBLIGATORIO para conexión de bus de campo (PROFINET/EtherCAT) — el terminal de válvulas (CPV, VTSA, MPA) agrupa todas las válvulas en una unidad y reduce el cableado. Especifique el módulo de bus y el número de válvulas.",
      }),
    });
  } else if (isPneumatic) {
    const valveMatch = findCatalogProductByType("valve", products);
    rows.push({
      sku: valveMatch?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "Magnetventil (5/2-vägs styrventil)", en: "Solenoid valve (5/2-way directional)", de: "Magnetventil (5/2-Wege-Steuerventil)", es: "Electroválvula (5/2 vías)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK för pneumatisk cylinder — 5/2-vägs magnetventil styr cylinderns riktning (fram/åter). Välj spänning 24 V DC och anslutning G1/4.",
        en: "MANDATORY for pneumatic cylinder — 5/2-way solenoid valve controls cylinder direction (extend/retract). Select 24 V DC coil and G1/4 port.",
        de: "ZWINGEND ERFORDERLICH für Pneumatikzylinder — das 5/2-Wege-Magnetventil steuert die Zylinderrichtung (Aus-/Einfahren). 24-V-DC-Spule und G1/4-Anschluss wählen.",
        es: "OBLIGATORIO para cilindro neumático — la electroválvula 5/2 controla la dirección del cilindro (avance/retroceso). Seleccione bobina de 24 V CC y conexión G1/4.",
      }),
    });
  }

  // ── 4b. Silencer + one-way flow control (all pneumatic) ──────────
  if (isPneumatic) {
    const silMatch = findCatalogProductByType("silencer", products);
    rows.push({
      sku: silMatch?.sku ?? "SPECIFY", quantity: valveTerminal ? 1 : 2,
      role: pick(locale, { sv: "Ljuddämpare (avluftning)", en: "Silencer (exhaust)", de: "Schalldämpfer (Entlüftung)", es: "Silenciador (escape)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK på ventilens avluftningsportar (3/5) — sänker ljudnivån och skyddar mot smuts. En per avluftningsport (2 st för en 5/2-ventil); vid ventilramp räcker en central enhet.",
        en: "MANDATORY on the valve exhaust ports (3/5) — cuts noise and keeps dirt out. One per exhaust port (2 for a 5/2 valve); one central unit suffices on a manifold.",
        de: "ZWINGEND ERFORDERLICH an den Entlüftungsanschlüssen des Ventils (3/5) — reduziert den Geräuschpegel und hält Schmutz fern. Einer je Entlüftungsanschluss (2 Stück bei einem 5/2-Ventil); bei einer Ventilinsel genügt eine zentrale Einheit.",
        es: "OBLIGATORIO en los puertos de escape de la válvula (3/5) — reduce el nivel de ruido y evita la entrada de suciedad. Uno por puerto de escape (2 para una válvula 5/2); en un terminal de válvulas basta una unidad central.",
      }),
    });
    const fcMatch = findCatalogProductByType("flow-control", products);
    rows.push({
      sku: fcMatch?.sku ?? "SPECIFY", quantity: 2,
      role: pick(locale, { sv: "Strypbackventil (hastighetsreglering)", en: "One-way flow control (speed)", de: "Drosselrückschlagventil (Geschwindigkeitsregelung)", es: "Regulador de caudal unidireccional (velocidad)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK för att ställa cylinderns hastighet — 2 st strypbackventiler (meter-out) på cylinderns portar ger jämn, kontrollerad rörelse fram och åter.",
        en: "MANDATORY to set cylinder speed — 2 one-way flow-control valves (meter-out) on the cylinder ports give smooth, controlled extend/retract.",
        de: "ZWINGEND ERFORDERLICH zur Einstellung der Zylindergeschwindigkeit — 2 Drosselrückschlagventile (Abluftdrosselung) an den Zylinderanschlüssen sorgen für eine gleichmäßige, kontrollierte Aus-/Einfahrbewegung.",
        es: "OBLIGATORIO para ajustar la velocidad del cilindro — 2 reguladores de caudal unidireccionales (regulación de escape) en los puertos del cilindro proporcionan un movimiento de avance/retroceso suave y controlado.",
      }),
    });
  }

  // ── 5. FRL (all pneumatic) ────────────────────────────────────────
  if (isPneumatic) {
    const frlMatch = findCatalogProductByType("frl", products);
    rows.push({
      sku: frlMatch?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "FRL-enhet (Filter-Regulator-Smörjare)", en: "FRL unit (Filter-Regulator-Lubricator)", de: "FRL-Einheit (Filter-Regler-Öler)", es: "Unidad FRL (Filtro-Regulador-Lubricador)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK för pneumatiskt system — luftberedning säkerställer rätt arbetstryck, filtrerad luft (≥40 µm) och smörjning av cylindertätningar. Välj regulator med manometer 0–10 bar.",
        en: "MANDATORY for pneumatic system — air preparation ensures correct working pressure, filtered air (≥40 µm) and seal lubrication. Select regulator with pressure gauge 0–10 bar.",
        de: "ZWINGEND ERFORDERLICH für pneumatische Systeme — die Luftaufbereitung stellt den richtigen Arbeitsdruck, gefilterte Luft (≥40 µm) und die Schmierung der Zylinderdichtungen sicher. Regler mit Manometer 0–10 bar wählen.",
        es: "OBLIGATORIO para sistemas neumáticos — el tratamiento de aire garantiza la presión de trabajo correcta, aire filtrado (≥40 µm) y lubricación de las juntas del cilindro. Seleccione un regulador con manómetro de 0-10 bar.",
      }),
    });
  }

  // ── 6. Shock absorbers (high speed ≥1000 mm/s) ───────────────────
  if (isHighSpeed) {
    const saMatch = findCatalogProductByType("shock-absorber", products);
    rows.push({
      sku: saMatch?.sku ?? "SPECIFY", quantity: 2,
      role: pick(locale, { sv: "Hydraulisk stötdämpare", en: "Hydraulic shock absorber", de: "Hydraulischer Stoßdämpfer", es: "Amortiguador hidráulico" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK vid slaghastighet >1 m/s — förhindrar skador på cylinderände och maskinkonstruktion. Välj justerbar hydraulisk stötdämpare dimensionerad för cylinderkraft och massa.",
        en: "MANDATORY at stroke speed >1 m/s — prevents end-stop damage to cylinder and machine frame. Select adjustable hydraulic shock absorber sized for cylinder force and mass.",
        de: "ZWINGEND ERFORDERLICH bei einer Hubgeschwindigkeit >1 m/s — verhindert Endlagenschäden am Zylinder und am Maschinenrahmen. Einstellbaren hydraulischen Stoßdämpfer wählen, dimensioniert für Zylinderkraft und Masse.",
        es: "OBLIGATORIO a velocidad de carrera >1 m/s — evita daños en el tope final del cilindro y en la estructura de la máquina. Seleccione un amortiguador hidráulico ajustable dimensionado para la fuerza y la masa del cilindro.",
      }),
    });
  }

  // ── 7. End-position sensors (2 pcs, one per end) ─────────────────
  // Found 2026-08-21 (adversarial test): asking for an ATEX cylinder WITH
  // end-position sensors produced zero sensor row at all - isPneumatic is
  // false for isAtex/isAtexDust (by design, so the block below never fires),
  // and nothing else covers it, so a stated requirement just silently
  // vanished from the BOM. Standard 24V sensors are exactly what the ATEX
  // section's own final warning row already says is forbidden, and the
  // catalog has no ATEX-rated sensor to substitute (checked - none of the
  // "sensor" rows carry any Ex-relevant certification data), so SPECIFY is
  // the honest answer, same pattern as the other ATEX-only rows below.
  if (isEndPosDetect && (isAtex || isAtexDust)) {
    rows.push({
      sku: "SPECIFY", quantity: 2,
      role: pick(locale, { sv: "ATEX-ändlägesgivare (zon-certifierad)", en: "ATEX end-position sensor (zone-certified)", de: "ATEX-Endlagensensor (zonzertifiziert)", es: "Sensor de fin de carrera ATEX (certificado para la zona)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK — 2 st ATEX/IECEx-certifierade lägesgivare (en per ändläge) krävs för PLC-feedback. Standard 24V-givare är EJ tillåtna i zonen; vi har ingen zon-certifierad givare i lager, begär offert.",
        en: "MANDATORY — 2 ATEX/IECEx-certified position sensors (one per end position) required for PLC feedback. Standard 24 V sensors are NOT permitted in the zone; we don't stock a zone-certified sensor, request a quote.",
        de: "ZWINGEND ERFORDERLICH — 2 ATEX/IECEx-zertifizierte Positionssensoren (einer je Endlage) für die SPS-Rückmeldung erforderlich. Standard-24-V-Sensoren sind in der Zone NICHT zulässig; wir führen keinen zonenzertifizierten Sensor, bitte Angebot anfordern.",
        es: "OBLIGATORIO — se requieren 2 sensores de posición certificados ATEX/IECEx (uno por posición final) para la retroalimentación al PLC. Los sensores estándar de 24 V NO están permitidos en la zona; no tenemos en stock un sensor certificado para la zona, solicite una oferta.",
      }),
    });
  } else if (isEndPosDetect && isPneumatic) {
    // Found 2026-08-21 (adversarial test): this used plain `products` — the
    // catalog has both T-slot AND C-slot sensors (e.g. SMC-D-A72H is C-slot,
    // SMC-D-A73/D-A93 are T-slot; Festo's SIES/SIET/SMT lines are all T-slot)
    // and neither groove type is universal across brands. A real test with an
    // SMC-CQ2 primary actuator got FE-SIES-8M — a Festo sensor — recommended,
    // with zero brand or groove-type check at all. There's no groove-type spec
    // on the cylinder to match exactly, so brand is the strongest signal we
    // have: manufacturers design their sensor lines for their own cylinders'
    // grooves, so a same-brand pairing is far more likely to physically fit
    // than a cross-brand one. brandSorted already exists (same pattern used
    // for servo-motor/servo-drive above) — just wasn't being used here.
    const sensorMatch = findCatalogProductByType("sensor", brandSorted);
    rows.push({
      sku: sensorMatch?.sku ?? "SPECIFY", quantity: 2,
      role: pick(locale, { sv: "Ändlägesgivare (hemläge + utsträckt läge)", en: "End-position sensor (home + extended)", de: "Endlagensensor (Grundstellung + ausgefahren)", es: "Sensor de fin de carrera (posición inicial + extendida)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK — 2 st magnetgivare (en per ändläge) krävs för PLC-feedback. Välj givare som passar cylinderns givarspår (T-spår eller C-spår, beroende på fabrikat) samt styrsystem (24 V DC NPN/PNP).",
        en: "MANDATORY — 2 magnetic sensors (one per end position) required for PLC feedback. Select a sensor matching the cylinder's sensor groove (T-slot or C-slot, depending on brand) and control voltage (24 V DC NPN/PNP).",
        de: "ZWINGEND ERFORDERLICH — 2 Magnetsensoren (einer je Endlage) für die SPS-Rückmeldung erforderlich. Sensor passend zur Sensornut des Zylinders (T-Nut oder C-Nut, je nach Hersteller) und zur Steuerspannung wählen (24 V DC NPN/PNP).",
        es: "OBLIGATORIO — se requieren 2 sensores magnéticos (uno por posición final) para la retroalimentación al PLC. Seleccione un sensor compatible con la ranura del cilindro (ranura en T o en C, según el fabricante) y la tensión de control (24 V CC NPN/PNP).",
      }) + (isWashdown
        // Found 2026-08-21: the catalog does not currently stock an IP69K-rated
        // cylinder position sensor at all (checked every "sensor" row's
        // ip_rating - none reach it), so a washdown/food-grade job always gets
        // a standard-rated sensor here with no better option to substitute.
        // Rather than presenting that pick as an unqualified "MANDATORY" match
        // the way every other row does, say so plainly.
        ? pick(locale, {
            sv: " ⚠️ Vi har ingen IP69K-klassad ändlägesgivare i lager — vald givare kan behöva bytas mot en washdown-tålig variant, begär offert.",
            en: " ⚠️ We don't stock an IP69K-rated end-position sensor — the selected one may need swapping for a washdown-rated variant, request a quote.",
            de: " ⚠️ Wir führen keinen IP69K-klassifizierten Endlagensensor — der ausgewählte Sensor muss ggf. gegen eine waschdown-taugliche Variante ausgetauscht werden, bitte Angebot anfordern.",
            es: " ⚠️ No tenemos en stock un sensor de fin de carrera con clasificación IP69K — puede que el seleccionado deba sustituirse por una variante apta para washdown, solicite una oferta.",
          })
        : ""),
    });
  }

  // ── 8. Push-in fitting (all pneumatic) ───────────────────────────
  if (isPneumatic) {
    const fittingMatch = findCatalogProductByType("fitting", products);
    if (fittingMatch) {
      rows.push({
        sku: fittingMatch.sku, quantity: 4,
        role: pick(locale, { sv: "Snabbkoppling (push-in fitting)", en: "Push-in fitting", de: "Steckverschraubung (Push-in-Fitting)", es: "Racor instantáneo (push-in)" }),
        reason: pick(locale, {
          sv: "Ansluter cylinder och ventil till luftslang — välj diameter (6/8/10 mm) för rätt slanganslutning till cylinderns G-port.",
          en: "Connects cylinder and valve to air tubing — select diameter (6/8/10 mm) matching cylinder G-port.",
          de: "Verbindet Zylinder und Ventil mit dem Luftschlauch — Durchmesser (6/8/10 mm) passend zum G-Anschluss des Zylinders wählen.",
          es: "Conecta el cilindro y la válvula al tubo de aire — seleccione el diámetro (6/8/10 mm) adecuado para el puerto G del cilindro.",
        }),
      });
    }
  }

  // ── 8b. Tubing (all pneumatic) ───────────────────────────────────
  if (isPneumatic) {
    const tubeMatch = findCatalogProductByType("tubing", products);
    if (tubeMatch) {
      rows.push({
        sku: tubeMatch.sku, quantity: 1,
        role: pick(locale, { sv: "Tryckluftsslang (per meter)", en: "Pneumatic tubing (per metre)", de: "Druckluftschlauch (pro Meter)", es: "Tubo neumático (por metro)" }),
        reason: pick(locale, {
          sv: "Förbinder ventil, FRL och cylinder — välj ytterdiameter (6/8/10 mm) och längd efter installationen. Anges per meter.",
          en: "Connects valve, FRL and cylinder — select outer diameter (6/8/10 mm) and length per the installation. Sold per metre.",
          de: "Verbindet Ventil, FRL-Einheit und Zylinder — Außendurchmesser (6/8/10 mm) und Länge passend zur Installation wählen. Wird pro Meter angegeben.",
          es: "Conecta la válvula, la unidad FRL y el cilindro — seleccione el diámetro exterior (6/8/10 mm) y la longitud según la instalación. Se indica por metro.",
        }),
      });
    }
  }

  // ── 9. Motor cable (electric) ─────────────────────────────────────
  if (isElectric) {
    const cableMatch = findCatalogProductByType("cable", products);
    if (cableMatch) {
      rows.push({
        sku: cableMatch.sku, quantity: 1,
        role: pick(locale, { sv: "Motorkabel", en: "Motor cable", de: "Motorkabel", es: "Cable de motor" }),
        reason: pick(locale, {
          sv: "Anslutningskabel till drivenheten — välj längd och kontakttyp kompatibel med vald motor och drivare.",
          en: "Connection cable to the drive — select length and connector type compatible with the chosen motor and drive.",
          de: "Anschlusskabel zum Antrieb — Länge und Steckertyp passend zum gewählten Motor und Antrieb wählen.",
          es: "Cable de conexión al accionamiento — seleccione la longitud y el tipo de conector compatibles con el motor y el accionamiento elegidos.",
        }),
      });
    }
  }

  // ── 10. Mounting (when requested) — must MATCH the primary's bore ─────────
  // A mounting whose bore differs from the cylinder physically does not fit. We
  // only emit a real SKU when its bore equals the primary's; otherwise SPECIFY
  // with the required Ø called out (recommend, never force a mismatched part).
  if (isMounting || isArticulated) {
    const primary = products.find(p => p.sku === primarySku);
    const pBore = primaryBoreMm ||
                  firstNumAbs(primary?.key_specs?.bore_mm) ||
                  firstNumAbs((primary?.name ?? "").match(/Ø\s?(\d+)/)?.[1]);
    const boreTxt = pBore > 0 ? `Ø${pBore}` : pick(locale, { sv: "cylinderns borrning", en: "the cylinder's bore", de: "die Zylinderbohrung", es: "el diámetro del cilindro" });
    const mounts = products.filter(p =>
      p.category === "mounting" ||
      /fotfäste|foot.?mount|flansfäste|flänsfäste|flange|monteringsfäste|bracket|trunnion|svängfläns|gaffel|clevis|swivel|ledlager/i.test(`${p.name} ${p.sku}`));
    const mountBore = (p: CatalogProduct) =>
      firstNumAbs(p.key_specs?.bore_mm) || firstNumAbs(p.name.match(/Ø\s?(\d+)/)?.[1]);
    const boreOk = (p: CatalogProduct) => pBore > 0 && mountBore(p) === pBore;

    if (isArticulated) {
      // Angled push: rear pivot + rod clevis, both bore-matched.
      const swivel = mounts.find(p => boreOk(p) && /svängfläns|swivel|pivå|trunnion|ledlager/i.test(p.name));
      const clevis = mounts.find(p => boreOk(p) && /gaffel|clevis/i.test(p.name));
      rows.push({
        sku: swivel?.sku ?? "SPECIFY", quantity: 1,
        role: pick(locale, { sv: "Svängfläns/ledlager (bakgavel)", en: "Rear swivel/pivot flange", de: "Schwenkflansch/Gelenklager (Hinterseite)", es: "Brida giratoria/rótula (parte trasera)" }),
        reason: swivel
          ? pick(locale, {
              sv: `${swivel.name} — matchar cylinderns borrning (${boreTxt}). Tillåter cylindern att vinkla sig under slaget; ISO 15552-fäste.`,
              en: `${swivel.name} — matches the cylinder bore (${boreTxt}). Lets the cylinder pivot during the stroke; ISO 15552 mount.`,
              de: `${swivel.name} — passt zur Zylinderbohrung (${boreTxt}). Ermöglicht dem Zylinder, sich während des Hubs zu neigen; ISO-15552-Befestigung.`,
              es: `${swivel.name} — coincide con el diámetro del cilindro (${boreTxt}). Permite que el cilindro se incline durante la carrera; fijación ISO 15552.`,
            })
          : pick(locale, {
              sv: `Ange svängfläns/ledlager i ${boreTxt} — vi saknar ${boreTxt}-varianten i lager; fästet MÅSTE matcha cylinderns borrning.`,
              en: `Specify a rear swivel/pivot flange in ${boreTxt} — no ${boreTxt} variant in stock; the mount MUST match the cylinder bore.`,
              de: `Schwenkflansch/Gelenklager in ${boreTxt} angeben — die ${boreTxt}-Variante ist nicht auf Lager; die Befestigung MUSS zur Zylinderbohrung passen.`,
              es: `Indique una brida giratoria/rótula en ${boreTxt} — no hay variante ${boreTxt} en stock; la fijación DEBE coincidir con el diámetro del cilindro.`,
            }),
      });
      rows.push({
        sku: clevis?.sku ?? "SPECIFY", quantity: 1,
        role: pick(locale, { sv: "Gaffelfäste (kolvstångsände)", en: "Rod clevis (rod end)", de: "Gabelkopf (Kolbenstangenende)", es: "Horquilla (extremo del vástago)" }),
        reason: clevis
          ? pick(locale, {
              sv: `${clevis.name} — matchar kolvstångsgängan för ${boreTxt}-cylindern. Bildar ledad infästning tillsammans med svängflänsen.`,
              en: `${clevis.name} — matches the rod thread of the ${boreTxt} cylinder. Forms the articulated linkage together with the swivel flange.`,
              de: `${clevis.name} — passt zum Kolbenstangengewinde des ${boreTxt}-Zylinders. Bildet zusammen mit dem Schwenkflansch die gelenkige Verbindung.`,
              es: `${clevis.name} — coincide con la rosca del vástago del cilindro ${boreTxt}. Forma la unión articulada junto con la brida giratoria.`,
            })
          : pick(locale, {
              sv: `Ange gaffelfäste i ${boreTxt} — vi saknar ${boreTxt}-varianten i lager; gaffeln MÅSTE matcha kolvstångsgängan.`,
              en: `Specify a rod clevis in ${boreTxt} — no ${boreTxt} variant in stock; the clevis MUST match the rod thread.`,
              de: `Gabelkopf in ${boreTxt} angeben — die ${boreTxt}-Variante ist nicht auf Lager; der Gabelkopf MUSS zum Kolbenstangengewinde passen.`,
              es: `Indique una horquilla en ${boreTxt} — no hay variante ${boreTxt} en stock; la horquilla DEBE coincidir con la rosca del vástago.`,
            }),
      });
    } else {
      // A foot/flange request must never fall back to a different mounting TYPE —
      // a bore-matched rod clevis is still the wrong part (conveyor-stopper test
      // emitted HNC-40 gaffelkoppling as "fotfäste"). Only foot/flange-style mounts
      // qualify; if the bore variant is missing, SPECIFY (with the Ø called out).
      const footish = mounts.filter(p => !/gaffel|clevis|svängfläns|swivel|pivå|trunnion|ledlager/i.test(p.name));
      const mount = footish.find(p => boreOk(p) && /fotfäste|foot/i.test(p.name)) ?? footish.find(boreOk) ?? null;
      rows.push({
        sku: mount?.sku ?? "SPECIFY", quantity: 1,
        role: pick(locale, { sv: "Monteringsfäste (fotfäste/flänsfäste)", en: "Mounting bracket (foot/flange mount)", de: "Befestigungswinkel (Fuß-/Flanschbefestigung)", es: "Soporte de montaje (pie/brida)" }),
        reason: mount
          ? pick(locale, {
              sv: `${mount.name} — matchar cylinderns borrning (${boreTxt}). Kontrollera hålavstånd mot ritning.`,
              en: `${mount.name} — matches the cylinder bore (${boreTxt}). Verify hole pattern against drawing.`,
              de: `${mount.name} — passt zur Zylinderbohrung (${boreTxt}). Lochbild anhand der Zeichnung prüfen.`,
              es: `${mount.name} — coincide con el diámetro del cilindro (${boreTxt}). Verifique el patrón de orificios según el plano.`,
            })
          : pick(locale, {
              sv: `Ange fotfäste/flänsfäste i ${boreTxt} — vi saknar ${boreTxt}-varianten i lager; fästet MÅSTE matcha cylinderns borrning och serie.`,
              en: `Specify a foot/flange mount in ${boreTxt} — no ${boreTxt} variant in stock; the mount MUST match the cylinder bore and series.`,
              de: `Fuß-/Flanschbefestigung in ${boreTxt} angeben — die ${boreTxt}-Variante ist nicht auf Lager; die Befestigung MUSS zu Bohrung und Serie des Zylinders passen.`,
              es: `Indique un soporte de pie/brida en ${boreTxt} — no hay variante ${boreTxt} en stock; el soporte DEBE coincidir con el diámetro y la serie del cilindro.`,
            }),
      });
    }
  }

  // ── 11. Multi-axis secondary actuators ───────────────────────────
  if (isMultiAxis && perAxisStrokes.length >= 2) {
    // Secondary = every axis EXCEPT the primary (longest-stroke) one — so the
    // primary axis is never also emitted as a secondary, and labels stay correct.
    const secondaryAxes = perAxisStrokes.filter((_, i) => i !== primaryAxisIdx);
    for (const ax of secondaryAxes) {
      const axLabel = ax.axis.toUpperCase();
      // P0: match a REAL catalog actuator for this axis instead of a placeholder.
      const axMatch = findAxisActuator(brandSorted, ax.stroke, isElectric);
      rows.push({
        sku: axMatch?.sku ?? "SPECIFY", quantity: 1,
        role: pick(locale, { sv: `Aktuator — ${axLabel}-axel`, en: `Actuator — ${axLabel}-axis`, de: `Aktuator — ${axLabel}-Achse`, es: `Actuador — eje ${axLabel}` }),
        reason: axMatch
          ? pick(locale, {
              sv: `${ax.stroke > 0 ? ax.stroke + " mm slag — " : ""}${axMatch.name} (${axMatch.brand}). Samma drivtyp/spänning som primäraxeln; konfigurera slaglängd och fäste för ${axLabel}-axeln.`,
              en: `${ax.stroke > 0 ? ax.stroke + " mm stroke — " : ""}${axMatch.name} (${axMatch.brand}). Same drive type/voltage as the primary axis; configure stroke and mounting for the ${axLabel}-axis.`,
              de: `${ax.stroke > 0 ? ax.stroke + " mm Hub — " : ""}${axMatch.name} (${axMatch.brand}). Gleicher Antriebstyp/Spannung wie die Primärachse; Hub und Befestigung für die ${axLabel}-Achse konfigurieren.`,
              es: `${ax.stroke > 0 ? ax.stroke + " mm de carrera — " : ""}${axMatch.name} (${axMatch.brand}). Mismo tipo de accionamiento/tensión que el eje primario; configure la carrera y el montaje para el eje ${axLabel}.`,
            })
          : pick(locale, {
              sv: `Ingen exakt katalogmatch för ${axLabel}-axeln (${ax.stroke > 0 ? ax.stroke + " mm" : "okänt slag"}) — begär offert så specar vi rätt ${isElectric ? "elektrisk axel" : "cylinder"} (gissa inte ihop en lösning).`,
              en: `No exact catalog match for the ${axLabel}-axis (${ax.stroke > 0 ? ax.stroke + " mm" : "unknown stroke"}) — request a quote and we'll spec the right ${isElectric ? "electric axis" : "cylinder"} (do not guess a solution).`,
              de: `Keine exakte Katalogübereinstimmung für die ${axLabel}-Achse (${ax.stroke > 0 ? ax.stroke + " mm" : "unbekannter Hub"}) — bitte Angebot anfordern, damit wir ${isElectric ? "die richtige elektrische Achse" : "den richtigen Zylinder"} spezifizieren (keine Lösung erraten).`,
              es: `No hay coincidencia exacta en el catálogo para el eje ${axLabel} (${ax.stroke > 0 ? ax.stroke + " mm" : "carrera desconocida"}) — solicite una oferta y especificaremos ${isElectric ? "el eje eléctrico" : "el cilindro"} correcto (no adivinar una solución).`,
            }),
      });
    }
  }

  // ── 9. Washdown / food-grade IP69K warning ───────────────────────
  if (isWashdown) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ Washdown IP69K — korrosionsbeständigt material", en: "⚠️ Washdown IP69K — corrosion-resistant materials", de: "⚠️ Washdown IP69K — korrosionsbeständiges Material", es: "⚠️ Washdown IP69K — material resistente a la corrosión" }),
      reason: pick(locale, {
        sv: "KRAV IP69K: Cylinder, ventil och givare måste ha IP69K-klassning och korrosionsbeständigt material (316L rostfritt stål eller ytbehandlad aluminium). Specificera variant -H1 (food-grade smörjning) vid livsmedelsproduktion.",
        en: "REQUIRED IP69K: Cylinder, valve and sensor must be IP69K-rated with corrosion-resistant materials (316L stainless or coated aluminium). Specify -H1 variant (food-grade lubrication) for food production.",
        de: "ANFORDERUNG IP69K: Zylinder, Ventil und Sensor müssen IP69K-klassifiziert sein und aus korrosionsbeständigem Material bestehen (316L Edelstahl oder beschichtetes Aluminium). Bei Lebensmittelproduktion die Variante -H1 (lebensmittelechte Schmierung) angeben.",
        es: "REQUISITO IP69K: el cilindro, la válvula y el sensor deben tener clasificación IP69K y material resistente a la corrosión (acero inoxidable 316L o aluminio recubierto). Especifique la variante -H1 (lubricación de grado alimenticio) para producción alimentaria.",
      }),
    });
  }

  // ── 10. High-temperature warning (>80°C) ─────────────────────────
  if (isHighTemp) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ Tätningsmaterial — hög temperatur >80°C", en: "⚠️ Sealing material — high temperature >80°C", de: "⚠️ Dichtungsmaterial — hohe Temperatur >80 °C", es: "⚠️ Material de sellado — alta temperatura >80 °C" }),
      reason: pick(locale, {
        sv: "KRAV: PTFE- eller FKM-tätningar obligatoriska vid >80°C — standard-NBR-tätningar degraderar och läcker. Beställ cylinder med high-temp tätningssats eller PTFE-variant.",
        en: "MANDATORY: PTFE or FKM seals required above 80°C — standard NBR seals degrade and leak. Order cylinder with high-temp seal kit or PTFE variant.",
        de: "ANFORDERUNG: PTFE- oder FKM-Dichtungen oberhalb von 80 °C zwingend erforderlich — Standard-NBR-Dichtungen verschleißen und lecken. Zylinder mit Hochtemperatur-Dichtungssatz oder PTFE-Variante bestellen.",
        es: "REQUISITO: juntas de PTFE o FKM obligatorias por encima de 80 °C — las juntas NBR estándar se degradan y presentan fugas. Pida el cilindro con kit de juntas de alta temperatura o variante PTFE.",
      }),
    });
  }

  // ── 10. SIL/functional-safety certified valve ─────────────────────
  if (isSilSafety) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ Säkerhetscertifierad magnetventil SIL/PLd", en: "⚠️ Safety-certified solenoid valve SIL/PLd", de: "⚠️ Sicherheitszertifiziertes Magnetventil SIL/PLd", es: "⚠️ Electroválvula certificada de seguridad SIL/PLd" }),
      reason: pick(locale, {
        sv: "KRAV SIL 2 / PLd (ISO 13849): säkerhetscertifierad magnetventil med redundant styrsignal och diagnosfunktion krävs (t.ex. Festo VOFD-DT, SMC VFS). Standard-ventil är EJ tillräcklig.",
        en: "REQUIRED SIL 2 / PLd (ISO 13849): safety-certified solenoid valve with redundant control and diagnostic function (e.g. Festo VOFD-DT, SMC VFS). Standard valve is NOT sufficient.",
        de: "ERFORDERLICH SIL 2 / PLd (ISO 13849): sicherheitszertifiziertes Magnetventil mit redundantem Steuersignal und Diagnosefunktion erforderlich (z. B. Festo VOFD-DT, SMC VFS). Ein Standardventil ist NICHT ausreichend.",
        es: "REQUERIDO SIL 2 / PLd (ISO 13849): se requiere una electroválvula certificada de seguridad con señal de control redundante y función de diagnóstico (p. ej. Festo VOFD-DT, SMC VFS). Una válvula estándar NO es suficiente.",
      }),
    });
  }

  // ── 11. Hydraulic / very-high-force out-of-scope warning ──────────
  if (isHydraulic || isVeryHighForce) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ Varning: utanför pneumatisk katalog", en: "⚠️ Warning: outside pneumatic catalog", de: "⚠️ Warnung: außerhalb des pneumatischen Katalogs", es: "⚠️ Aviso: fuera del catálogo neumático" }),
      reason: pick(locale, {
        sv: "UTANFÖR KATALOG: Hydrauliska cylindrar och kraft >5 kN hanteras ej av pneumatisk katalog. Kontakta hydraulikspecialist (Parker, Bosch Rexroth, Enerpac). Pneumatisk katalog täcker max ~2 kN vid 6 bar.",
        en: "OUT OF SCOPE: Hydraulic cylinders and force >5 kN are outside the pneumatic catalog. Contact hydraulic specialist (Parker, Bosch Rexroth, Enerpac). Pneumatic catalog covers max ~2 kN at 6 bar.",
        de: "AUSSERHALB DES KATALOGS: Hydraulikzylinder und Kräfte >5 kN werden vom pneumatischen Katalog nicht abgedeckt. Hydraulikspezialisten kontaktieren (Parker, Bosch Rexroth, Enerpac). Der pneumatische Katalog deckt max. ~2 kN bei 6 bar ab.",
        es: "FUERA DE CATÁLOGO: los cilindros hidráulicos y fuerzas >5 kN quedan fuera del catálogo neumático. Contacte con un especialista en hidráulica (Parker, Bosch Rexroth, Enerpac). El catálogo neumático cubre un máximo de ~2 kN a 6 bar.",
      }),
    });
  }

  // ── 12. ATEX completeness: an ATEX pneumatic system still needs a control
  // valve and air prep — but they must be ATEX-certified, so they are emitted
  // as SPECIFY (catalog valves/FRL are NOT zone-rated). Without this an ATEX
  // query returned only the bare primary actuator. Skip if electric (electric
  // is forbidden in ATEX and handled elsewhere) or if no primary is pneumatic.
  if ((isAtex || isAtexDust) && !isElectric) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "ATEX-magnetventil (zon-certifierad)", en: "ATEX solenoid valve (zone-certified)", de: "ATEX-Magnetventil (zonzertifiziert)", es: "Electroválvula ATEX (certificada para la zona)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK styrventil för ATEX-zon — använd ATEX/IECEx-certifierad ventil (t.ex. Festo VOFC/tryckluftsstyrd) eller montera standardventil UTANFÖR zonen och dra slang in. Standardkatalogventiler är EJ zon-godkända.",
        en: "MANDATORY control valve for ATEX zone — use an ATEX/IECEx-certified valve (e.g. Festo VOFC / air-piloted) or mount a standard valve OUTSIDE the zone with tubing in. Standard catalog valves are NOT zone-rated.",
        de: "ZWINGEND ERFORDERLICHES Steuerventil für die ATEX-Zone — ein ATEX/IECEx-zertifiziertes Ventil verwenden (z. B. Festo VOFC/luftpilotiert) oder ein Standardventil AUSSERHALB der Zone montieren und die Leitung hineinführen. Standard-Katalogventile sind NICHT zonenzertifiziert.",
        es: "Válvula de control OBLIGATORIA para zona ATEX — utilice una válvula certificada ATEX/IECEx (p. ej. Festo VOFC/pilotada por aire) o monte una válvula estándar FUERA de la zona con el tubo hacia el interior. Las válvulas estándar del catálogo NO están certificadas para la zona.",
      }),
    });
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "ATEX-luftberedning (FRL utanför zon)", en: "ATEX air preparation (FRL outside zone)", de: "ATEX-Luftaufbereitung (FRL außerhalb der Zone)", es: "Tratamiento de aire ATEX (FRL fuera de la zona)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK luftberedning — placera FRL-enheten utanför den klassade zonen. Använd antistatisk slang och jordning av cylinder/rör per EN 80079-36.",
        en: "MANDATORY air preparation — locate the FRL outside the classified zone. Use antistatic tubing and ground the cylinder/piping per EN 80079-36.",
        de: "ZWINGEND ERFORDERLICHE Luftaufbereitung — die FRL-Einheit außerhalb der klassifizierten Zone platzieren. Antistatische Schläuche verwenden und Zylinder/Rohrleitung gemäß EN 80079-36 erden.",
        es: "Tratamiento de aire OBLIGATORIO — coloque la unidad FRL fuera de la zona clasificada. Utilice tubos antiestáticos y conecte a tierra el cilindro/tubería según EN 80079-36.",
      }),
    });
    // Vertical ATEX still needs an anti-drop device. It can't be electric (forbidden
    // in the zone) and the standard check-valve row is gated on isPneumatic (which
    // excludes ATEX), so add an explicit ATEX-rated load-holding row here.
    if (isVerticalLoad) {
      rows.push({
        sku: "SPECIFY", quantity: 1,
        role: pick(locale, { sv: "ATEX-fallspärr (pilotbackventil / mekanisk stångbroms)", en: "ATEX anti-drop (pilot check valve / mechanical rod lock)", de: "ATEX-Fallsicherung (pilotgesteuertes Rückschlagventil / mechanische Kolbenstangenbremse)", es: "Antirretorno ATEX (válvula antirretorno pilotada / bloqueo mecánico de vástago)" }),
        reason: pick(locale, {
          sv: "OBLIGATORISK vid vertikal last i ATEX-zon — förhindrar lastfall vid lufttrycksförlust. Använd ATEX/IECEx-klassad pilotmanövrerad backslagsventil eller mekanisk stångbroms. Elektrisk bromsmotor är EJ tillåten i zonen.",
          en: "MANDATORY for vertical load in an ATEX zone — prevents load drop on air loss. Use an ATEX/IECEx-rated pilot-operated check valve or mechanical rod lock. An electric brake motor is NOT permitted in the zone.",
          de: "ZWINGEND ERFORDERLICH bei vertikaler Last in der ATEX-Zone — verhindert ein Absinken der Last bei Luftverlust. ATEX/IECEx-zertifiziertes pilotgesteuertes Rückschlagventil oder mechanische Kolbenstangenbremse verwenden. Ein elektrischer Bremsmotor ist in der Zone NICHT zulässig.",
          es: "OBLIGATORIO para carga vertical en zona ATEX — evita la caída de la carga ante pérdida de aire. Utilice una válvula antirretorno pilotada certificada ATEX/IECEx o un bloqueo mecánico de vástago. Un motor con freno eléctrico NO está permitido en la zona.",
        }),
      });
    }
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ ATEX: alla komponenter zon-certifierade + jordade", en: "⚠️ ATEX: all components zone-certified + grounded", de: "⚠️ ATEX: alle Komponenten zonenzertifiziert + geerdet", es: "⚠️ ATEX: todos los componentes certificados para la zona + conectados a tierra" }),
      reason: pick(locale, {
        sv: "KRAV ATEX/IECEx: cylinder, givare, ventil och tillbehör måste vara märkta för aktuell zon/gasgrupp/temperaturklass. Inga standard-24V-givare utan ATEX-godkännande. Verifiera ekvipotential jordning och dokumentera enligt direktiv 2014/34/EU.",
        en: "ATEX/IECEx REQUIREMENT: cylinder, sensors, valve and accessories must be marked for the zone/gas group/temperature class. No standard 24 V sensors without ATEX approval. Verify equipotential grounding and document per Directive 2014/34/EU.",
        de: "ATEX/IECEx-ANFORDERUNG: Zylinder, Sensoren, Ventil und Zubehör müssen für die jeweilige Zone/Gasgruppe/Temperaturklasse gekennzeichnet sein. Keine Standard-24-V-Sensoren ohne ATEX-Zulassung. Potentialausgleichserdung prüfen und gemäß Richtlinie 2014/34/EU dokumentieren.",
        es: "REQUISITO ATEX/IECEx: el cilindro, los sensores, la válvula y los accesorios deben estar marcados para la zona/grupo de gas/clase de temperatura correspondiente. Ningún sensor estándar de 24 V sin homologación ATEX. Verifique la conexión equipotencial a tierra y documente conforme a la Directiva 2014/34/UE.",
      }),
    });
  }

  return rows;
}

// ── ACTION: questions ─────────────────────────────────────────────────────────
async function handleQuestions(description: string, locale: string): Promise<Response> {
  const t0 = Date.now();
  // Skip PDF context for questions step — questions are short and context bloats tokens.
  // PDF context is more valuable in the options step where catalog matching matters.
  const pdfCtx = "";
  const lang = langName(locale);
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
    // Found 2026-08-18 (user feedback): most people using this tool are NOT
    // automation engineers — the hint field existed but nothing told the
    // model to actually explain anything in it, so a beginner would face
    // e.g. "SIL 1 / SIL 2 / SIL 3 (IEC 62061) or PL c / PL d / PL e
    // (ISO 13849)?" with no idea what any of that means or how to choose.
    `- PLAIN-LANGUAGE HINTS (mandatory): assume the person answering is NOT an automation engineer. Whenever a question's label contains a technical term, standard, or code a non-specialist wouldn't know (SIL/PL, IP rating, ball screw vs belt, repeatability, ATEX zone, EHEDG, etc.), the "hint" field MUST explain in one plain, jargon-free sentence what it means in practice and how to decide — not just restate why it "matters" in other technical words. Example — label "${pick(locale, {
      sv: "Krävd säkerhetsnivå: SIL 2 eller PL d?", en: "Required safety level: SIL 2 or PL d?",
      de: "Erforderliches Sicherheitsniveau: SIL 2 oder PL d?", es: "Nivel de seguridad requerido: ¿SIL 2 o PL d?",
    })}" needs a hint like "${pick(locale, {
      sv: "Handlar om hur pålitligt systemet måste stoppa vid fara — vid osäkerhet, fråga er säkerhetsansvarige eller välj det lägre alternativet och justera senare.",
      en: "This is about how reliably the system must stop in a hazard — if unsure, ask your safety officer or pick the lower option and adjust later.",
      de: "Es geht darum, wie zuverlässig das System bei Gefahr stoppen muss — bei Unsicherheit die verantwortliche Sicherheitsperson fragen oder die niedrigere Option wählen und später anpassen.",
      es: "Se trata de con qué fiabilidad debe detenerse el sistema ante un peligro — si no está seguro, consulte a su responsable de seguridad o elija la opción más baja y ajústela más adelante.",
    })}", NOT "${pick(locale, {
      sv: "Krävs för säkerhetscertifiering.", en: "Required for safety certification.",
      de: "Erforderlich für die Sicherheitszertifizierung.", es: "Requerido para la certificación de seguridad.",
    })}" (that just repeats the term). A hint with no real explanation is a failed question, not an optional field.`,
  ].filter(Boolean).join("\n");

  const system = `You are a senior automation engineer helping a customer who is very likely NOT an automation engineer. Generate 4-6 precise technical questions. All text in ${lang}.\n\nRULES:\n${contextRules}\n\nJSON:\n{ "summary": "one precise sentence in ${lang}", "questions": [ { "id": "snake_case", "label": "question in ${lang}", "hint": "plain-language explanation of the term and how to decide — see PLAIN-LANGUAGE HINTS rule", "type": "choice", "options": ["opt1","opt2"] } ] }\ntype = 'choice' (with options) or 'number' (with unit).${pdfCtx ? "\n\nDocs:\n" + pdfCtx : ""}`;

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
      logAdvisorEvent("questions", { locale, question_count: parsed.questions.length, duration_ms: Date.now() - t0 }, true);
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

// ── End-effector (gripper / vacuum) helpers ───────────────────────────────────
// A gripping request's PRIMARY part is the gripper / suction cup, NOT a linear
// actuator. The actuator ranker scores bore/stroke/force, so grippers (sized by
// GRIP FORCE) and vacuum cups (sized by HOLDING FORCE) never surfaced — a
// "parallellgripare" request fell through to a guide cylinder or CUSTOM even though
// we stock 50 grippers + 12 vacuum parts. This branch surfaces the right family.
function detectEndEffectorIntent(text: string): "gripper" | "vacuum" | null {
  const t = text.toLowerCase();
  const vacuumAsk = /vakuumgrepp|vakuumgripare|sugkopp|sugkoppar|suction.?cup|\bsugg\b|ejektor|vakuum.{0,12}(plock|grepp|lyft|hanter)/i.test(t);
  const gripperAsk = /gripdon|parallellgripare|vinkelgripare|griparback|\bgripper\b|\bgripare\b|klämback|gripa\s+(och|tag|fast|om)|griper\s+(om|fast|tag|och)/i.test(t);
  // Fragile, flat parts imply vacuum even without the word (glass / PCB / thin sheet).
  const fragileFlat = /\bglas\b|glasskiv|\bwafer\b|kretskort|\bpcb\b|tunn(a|t)?\s*pl(å|a)t|folie|laminat|solcell|\bdisplay\b|\blins(er)?\b/i.test(t)
                      && /plock|lyft|grepp|gripa|hanter|flytta/i.test(t);
  if (vacuumAsk) return "vacuum";
  if (gripperAsk) return "gripper";
  if (fragileFlat) return "vacuum";
  return null;
}
function firstNumAbs(v: unknown): number {
  const m = String(v ?? "").match(/-?\d+(?:[.,]\d+)?/);
  return m ? Math.abs(parseFloat(m[0].replace(",", "."))) : 0;
}
function gripperForceN(s: Record<string, unknown>): number {
  if (s.clamping_force != null) return firstNumAbs(s.clamping_force);
  if (s.grip_force_kgf != null) return firstNumAbs(s.grip_force_kgf) * 9.81;
  if (s.gripping_force_N != null) return firstNumAbs(s.gripping_force_N);
  if (s.gripping_force_closing_N != null) return firstNumAbs(s.gripping_force_closing_N);
  if (s.max_jaw_force_Fz != null) return firstNumAbs(s.max_jaw_force_Fz);
  return 0;
}
function gripperTypeOf(p: CatalogProduct): "parallel" | "angular" | "radial" {
  const blob = `${p.key_specs?.gripper_type ?? ""} ${p.key_specs?.type ?? ""} ${p.name}`.toLowerCase();
  if (/radial|3-?jaw|three-?jaw|self-?center|tre-?back|treback|centrer/.test(blob)) return "radial";
  if (/angle|angular|hinged|vinkel/.test(blob)) return "angular";
  return "parallel";
}
const isGripperFamily = (p: CatalogProduct) => /,/.test(String(p.key_specs?.sizes ?? ""));

async function handleEndEffectorOptions(
  intent: "gripper" | "vacuum", text: string, loadKg: number,
  locale: string, t0: number,
): Promise<Response> {
  const t = text.toLowerCase();
  const customCtx: CustomSolutionContext = {
    isWashdown: false, isVertical: false, isFoodGrade: false,
    isBatteryDryroom: false, isHydraulic: false, isAtex: false, isSilSafety: false,
  };

  if (intent === "vacuum") {
    const prods = await fetchEndEffectorProducts("vacuum", 40);
    const dia = (p: CatalogProduct) => firstNumAbs(p.key_specs?.cup_diameter_mm ?? p.key_specs?.pad_diameter_mm);
    const cups = prods.filter(p => dia(p) > 0).sort((a, b) => dia(a) - dia(b));
    const ejector = prods.find(p => /eject|venturi/i.test(`${p.key_specs?.type ?? ""} ${p.name}`));
    const picks = cups.length <= 3 ? cups : [cups[0], cups[Math.floor(cups.length / 2)], cups[cups.length - 1]];
    const reqN = loadKg > 0 ? loadKg * 9.81 * 2 : 0; // 2× safety
    const options: Array<Record<string, unknown>> = picks.map((p, i) => {
      const d = dia(p);
      const holdN = Math.round(Math.PI * (d / 2) ** 2 * 0.04); // ≈ -0.6 bar usable
      const mat = p.key_specs?.material ? `Material: ${p.key_specs.material}. ` : "";
      return {
        sku: p.sku, name: p.name,
        badge: pick(locale, {
          sv: ["Liten kopp", "Mellan", "Stor kopp"], en: ["Small cup", "Medium", "Large cup"],
          de: ["Kleiner Sauger", "Mittel", "Großer Sauger"], es: ["Ventosa pequeña", "Media", "Ventosa grande"],
        })[i] ?? "",
        bore_mm: null, stroke_mm: null, force_n: holdN || null,
        why: pick(locale, {
          sv: `Sugkopp Ø${d} mm, uppskattad håll-kraft ≈ ${holdN} N/kopp vid ~-0,6 bar. ${mat}Verifiera mot ytans täthet och säkerhetsfaktor.`,
          en: `Suction cup Ø${d} mm, est. holding force ≈ ${holdN} N/cup at ~-0.6 bar. ${mat}Verify against surface tightness and safety factor.`,
          de: `Saugnapf Ø${d} mm, geschätzte Haltekraft ≈ ${holdN} N/Napf bei ~-0,6 bar. ${mat}Gegen Oberflächendichtheit und Sicherheitsfaktor prüfen.`,
          es: `Ventosa Ø${d} mm, fuerza de sujeción estimada ≈ ${holdN} N/ventosa a ~-0,6 bar. ${mat}Verifique la estanqueidad de la superficie y el factor de seguridad.`,
        }),
        pros: pick(locale, {
          sv: ["Skonsam mot känsliga/plana ytor", "Snabb on/off via ejektor"], en: ["Gentle on delicate/flat surfaces", "Fast on/off via ejector"],
          de: ["Schonend zu empfindlichen/ebenen Oberflächen", "Schnelles Ein-/Ausschalten über Ejektor"], es: ["Suave con superficies delicadas/planas", "Encendido/apagado rápido mediante eyector"],
        }),
        cons: pick(locale, {
          sv: ["Kräver tät, plan yta", "Lägg till ejektor + vakuumvakt"], en: ["Needs a tight, flat surface", "Add an ejector + vacuum switch"],
          de: ["Erfordert eine dichte, ebene Oberfläche", "Ejektor + Vakuumschalter ergänzen"], es: ["Requiere una superficie plana y estanca", "Añadir eyector + presostato de vacío"],
        }),
      };
    });
    const need = reqN > 0
      ? pick(locale, {
          sv: ` För ~${loadKg} kg krävs ≈ ${Math.round(reqN)} N håll-kraft (2× säkerhet) — fördela på en eller flera koppar.`,
          en: ` For ~${loadKg} kg you need ≈ ${Math.round(reqN)} N holding force (2× safety) — across one or more cups.`,
          de: ` Für ~${loadKg} kg werden ≈ ${Math.round(reqN)} N Haltekraft benötigt (2-fache Sicherheit) — verteilt auf einen oder mehrere Saugnäpfe.`,
          es: ` Para ~${loadKg} kg se necesitan ≈ ${Math.round(reqN)} N de fuerza de sujeción (seguridad 2×) — repartidos entre una o más ventosas.`,
        })
      : "";
    const ejNote = ejector
      ? pick(locale, {
          sv: ` Lägg till en Venturi-ejektor (t.ex. ${ejector.name}) för att skapa vakuumet.`,
          en: ` Add a Venturi ejector (e.g. ${ejector.name}) to generate the vacuum.`,
          de: ` Einen Venturi-Ejektor (z. B. ${ejector.name}) hinzufügen, um das Vakuum zu erzeugen.`,
          es: ` Añada un eyector Venturi (p. ej. ${ejector.name}) para generar el vacío.`,
        })
      : "";
    const summary = pick(locale, {
      sv: `Det här är ett vakuumgrepp — välj sugkopp efter håll-kraft (kopparea × vakuum), inte cylinderslag.${need}${ejNote}`,
      en: `This is a vacuum-gripping application — choose the suction cup by holding force (cup area × vacuum), not cylinder stroke.${need}${ejNote}`,
      de: `Dies ist eine Vakuumgreif-Anwendung — den Saugnapf nach Haltekraft (Napffläche × Vakuum) wählen, nicht nach Zylinderhub.${need}${ejNote}`,
      es: `Esta es una aplicación de agarre por vacío — elija la ventosa según la fuerza de sujeción (área de la ventosa × vacío), no según la carrera del cilindro.${need}${ejNote}`,
    });
    if (!options.length) options.push(buildCustomSolutionOption(0, locale, 0, false, customCtx) as Record<string, unknown>);
    logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: false, top_sku: options[0]?.sku ?? null, option_count: options.length }, true);
    return Response.json({ summary, options }, { headers: CORS });
  }

  // gripper
  const wantType: "parallel" | "angular" | "radial" =
      /radial|3-?back|treback|tre-?back|självcentr|sjalvcentr|centrer|\brunda?\b|cylindrisk/.test(t) ? "radial"
    : /vinkel|angular|\bangle\b|hinged/.test(t) ? "angular" : "parallel";
  const prods = await fetchEndEffectorProducts("gripper", 60);
  const typed = prods.filter(p => gripperTypeOf(p) === wantType);
  const pool = typed.length ? typed : prods;
  const concrete = pool.filter(p => !isGripperFamily(p) && gripperForceN(p.key_specs ?? {}) > 0);
  const ranked = (concrete.length ? concrete : pool.filter(p => gripperForceN(p.key_specs ?? {}) > 0))
    .sort((a, b) => gripperForceN(a.key_specs ?? {}) - gripperForceN(b.key_specs ?? {}));
  const reqN = loadKg > 0 ? Math.max(loadKg * 100, 20) : 0; // rule of thumb ≈ weight × 100 N
  let picks: CatalogProduct[];
  if (reqN > 0 && ranked.length) {
    const adequate = ranked.filter(p => gripperForceN(p.key_specs ?? {}) >= reqN);
    picks = (adequate.length ? adequate : ranked.slice(-3)).slice(0, 3);
  } else {
    picks = (ranked.length ? ranked : pool).slice(0, 3);
  }
  const options: Array<Record<string, unknown>> = picks.map((p, i) => {
    const fN = Math.round(gripperForceN(p.key_specs ?? {}));
    const jaw = p.key_specs?.jaw_stroke_per_side ?? p.key_specs?.stroke_per_jaw;
    const gt = p.key_specs?.gripper_type ?? pick(locale, { sv: "Gripdon", en: "Gripper", de: "Greifer", es: "Pinza" });
    return {
      sku: p.sku, name: p.name,
      badge: pick(locale, {
        sv: ["Rätt storlek", "Marginal", "Reserv (mer kraft)"], en: ["Right size", "Tighter", "Reserve (more force)"],
        de: ["Passende Größe", "Knapper", "Reserve (mehr Kraft)"], es: ["Tamaño adecuado", "Ajustado", "Reserva (más fuerza)"],
      })[i] ?? "",
      bore_mm: firstNumAbs(p.key_specs?.bore_mm) || null,
      stroke_mm: null,
      force_n: fN || null,
      why: pick(locale, {
        sv: `${gt}${fN ? `, gripkraft ≈ ${fN} N` : ""}${jaw ? `, backslag ${jaw} mm/sida` : ""}. Dimensioneras på gripkraft mot detaljens vikt och friktion.`,
        en: `${gt}${fN ? `, grip force ≈ ${fN} N` : ""}${jaw ? `, jaw stroke ${jaw} mm/side` : ""}. Sized by grip force vs. part weight and friction.`,
        de: `${gt}${fN ? `, Greifkraft ≈ ${fN} N` : ""}${jaw ? `, Backenhub ${jaw} mm/Seite` : ""}. Dimensionierung nach Greifkraft im Verhältnis zu Gewicht und Reibung des Teils.`,
        es: `${gt}${fN ? `, fuerza de agarre ≈ ${fN} N` : ""}${jaw ? `, carrera de mordaza ${jaw} mm/lado` : ""}. Dimensionado según la fuerza de agarre frente al peso y la fricción de la pieza.`,
      }),
      pros: pick(locale, {
        sv: ["Pneumatiskt, enkel styrning", "Lägesgivare för grepp-kontroll"], en: ["Pneumatic, simple control", "Position sensing for grip confirmation"],
        de: ["Pneumatisch, einfache Steuerung", "Positionssensor zur Griffbestätigung"], es: ["Neumático, control sencillo", "Sensor de posición para confirmación de agarre"],
      }),
      cons: pick(locale, {
        sv: ["Verifiera gripkraft mot friktionskoefficient", "Backar/fingrar specas separat"], en: ["Verify grip force vs. friction", "Jaws/fingers specified separately"],
        de: ["Greifkraft gegen Reibungskoeffizient prüfen", "Backen/Finger werden separat spezifiziert"], es: ["Verifique la fuerza de agarre frente al coeficiente de fricción", "Mordazas/dedos se especifican por separado"],
      }),
    };
  });
  const typeLabels: Record<string, Record<string, string>> = {
    sv: { parallel: "parallellgripdon", angular: "vinkelgripdon", radial: "radial-/3-backsgripdon" },
    en: { parallel: "parallel grippers", angular: "angle grippers", radial: "radial / 3-jaw grippers" },
    de: { parallel: "Parallelgreifer", angular: "Winkelgreifer", radial: "Radial-/3-Backen-Greifer" },
    es: { parallel: "pinzas paralelas", angular: "pinzas angulares", radial: "pinzas radiales/de 3 mordazas" },
  };
  const typeLabel = (typeLabels[locale] ?? typeLabels.en)[wantType];
  const need = reqN > 0
    ? pick(locale, {
        sv: ` För ~${loadKg} kg är en rimlig tumregel ≈ ${Math.round(reqN)} N gripkraft (≈ vikt × 100; justera för friktion och acceleration).`,
        en: ` For ~${loadKg} kg a reasonable rule of thumb is ≈ ${Math.round(reqN)} N grip force (≈ weight × 100; adjust for friction and acceleration).`,
        de: ` Für ~${loadKg} kg ist eine brauchbare Faustregel ≈ ${Math.round(reqN)} N Greifkraft (≈ Gewicht × 100; anpassen für Reibung und Beschleunigung).`,
        es: ` Para ~${loadKg} kg, una regla práctica razonable es ≈ ${Math.round(reqN)} N de fuerza de agarre (≈ peso × 100; ajustar según fricción y aceleración).`,
      })
    : "";
  const summary = pick(locale, {
    sv: `Det här är en gripapplikation — gripdon dimensioneras på gripkraft, inte cylinderslag.${need} Förslagen är ${typeLabel}.`,
    en: `This is a gripping application — grippers are sized by grip force, not cylinder stroke.${need} The options are ${typeLabel}.`,
    de: `Dies ist eine Greifanwendung — Greifer werden nach Greifkraft dimensioniert, nicht nach Zylinderhub.${need} Die Vorschläge sind ${typeLabel}.`,
    es: `Esta es una aplicación de agarre — las pinzas se dimensionan según la fuerza de agarre, no la carrera del cilindro.${need} Las opciones son ${typeLabel}.`,
  });
  if (!options.length) options.push(buildCustomSolutionOption(0, locale, 0, false, customCtx) as Record<string, unknown>);
  logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: false, top_sku: options[0]?.sku ?? null, option_count: options.length }, true);
  return Response.json({ summary, options }, { headers: CORS });
}

// ── ACTION: options (v40) ─────────────────────────────────────────────────────
// v40: Server selects top 3 products deterministically; LLM only writes badge/why/pros/cons.
// This eliminates hallucinated SKUs and inconsistent product selection.
async function handleOptions(
  description: string, answers: Record<string, string>, locale: string
): Promise<Response> {
  const t0 = Date.now();
  const combinedText = description + " " + Object.values(answers).join(" ");
  const categories = detectCategories(combinedText);
  const minStroke = extractMinStroke(answers, description);
  const isCleanroom = /\brenrum\b|\bcleanroom\b|\bclean\s+room\b/i.test(combinedText);
  const needsProgrammable = /programmer|stopp-position|servo|positioner/i.test(combinedText);
  const isMultiAxis = needsMultiAxis(combinedText);
  // Whole-line, multi-station request (weigh + identify + sort + robot/PLC). The
  // catalog can't be a single "solution" here — we surface motion building blocks
  // and the summary is honest about what needs system integration vs. our range.
  const isSystemScope = isMultiFunctionSystem(combinedText);
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
  // Outdoor/marine/salt-spray is just as corrosive as washdown, but wasn't wired
  // into the corrosion-resistant filter/scoring — a saltmiljö request got standard
  // aluminium ISO cylinders (no stainless boost, no washdown-only hard filter).
  // Only for filter/score: keep isWashdown itself pure for BOM text ("IP69K",
  // CIP/SIP) that shouldn't be claimed for a marine-only case.
  const needsCorrosionResistant = isWashdown || isOutdoor;
  const isPharmaGmp = needsPharmaGmp(combinedText);
  const isBatteryDryroom = needsBatteryDryroom(combinedText);
  const speedMs = extractSpeedMs(combinedText, answers);
  const precisionMm = extractPrecisionMm(combinedText, answers);
  const isHighPrecision = precisionMm > 0 && precisionMm <= 0.1;
  const isHighPrecisionVertical = isVerticalLoad && isHighPrecision;
  const requiredTemp = extractRequiredMaxTemp(combinedText, answers);

  // PRECISION FORCE-FETCH: a repeatability spec ≤0.1 mm can only be met by an
  // electric ball-screw/spindle axis — pneumatics physically can't. So whenever
  // high precision is required (and ATEX doesn't forbid electric), guarantee the
  // electric actuator categories are fetched, regardless of whether the free
  // text happened to say "electric"/"servo". Without this, "precision ±0.02 mm"
  // with no electric keyword fetched only pneumatic cylinders → the precision
  // filter removed them all → the user got an empty CUSTOM-SOLUTION instead of
  // the correct ball-screw recommendation.
  if (isHighPrecision && !isAtex && !isAtexDust) {
    if (!categories.includes("electric-actuator")) categories.push("electric-actuator");
    if (!categories.includes("linear-module")) categories.push("linear-module");
  }

  const perAxisStrokes = isMultiAxis ? extractPerAxisStrokes(answers) : [];
  // System scope: a number like "200-500 mm" is carton SIZE, not actuator stroke —
  // don't treat it as a stroke requirement (it would falsely fail every cylinder).
  const maxRequiredStroke = isSystemScope ? 0
    : perAxisStrokes.length > 0 ? Math.max(...perAxisStrokes.map(a => a.stroke))
    : minStroke;

  // ── Load → minimum bore calculation ──────────────────────────────
  const loadKg = extractLoadKg(combinedText, answers);
  const minBoreMm = calcMinBoreMm(loadKg);
  // Same formula as calcMinBoreMm's internal forceN — surfaced separately so the
  // frontend can draw a "required vs available" margin visual per option instead
  // of just prose reasoning (engineers expect a calculated load-curve feel here).
  const requiredForceN = loadKg > 0 ? Math.round(loadKg * 9.81 * 2) : 0;

  // ── Shock-absorber application (decelerate an external moving mass) ──────────
  // Sized by kinetic energy ½·m·v², not bore/force — handled here so it skips the
  // actuator ranker (which would filter out these bore-less products). We have no
  // energy-capacity spec in the catalog, so we recommend a size spread (M8–M20)
  // and surface the computed energy for the engineer to verify on the datasheet.
  if (!isSystemScope && categories.length === 1 && categories[0] === "shock-absorber") {
    const shocks = await fetchProducts(["shock-absorber"], 30);
    const thread = (p: CatalogProduct) => {
      const m = String(p.key_specs?.sizes ?? p.name ?? "").match(/M\s?(\d+)/i);
      return m ? Number(m[1]) : 99;
    };
    const seen = new Set<number>();
    const picks: CatalogProduct[] = [];
    for (const p of shocks.slice().sort((a, b) => thread(a) - thread(b))) {
      const th = thread(p);
      if (!seen.has(th)) { seen.add(th); picks.push(p); }
      if (picks.length >= 4) break;
    }
    const energyJ = loadKg > 0 && speedMs > 0 ? 0.5 * loadKg * speedMs * speedMs : 0;
    const options = picks.map((p, i) => ({
      sku: p.sku,
      name: p.name,
      badge: i === 0 ? pick(locale, { sv: "Minsta", en: "Smallest", de: "Kleinste", es: "Más pequeño" })
        : i === picks.length - 1 ? pick(locale, { sv: "Störst kapacitet", en: "Highest capacity", de: "Höchste Kapazität", es: "Mayor capacidad" }) : "",
      bore_mm: null,
      stroke_mm: Number(String(p.key_specs?.stroke_mm ?? "").replace(/[^\d.]/g, "")) || null,
      force_n: null,
      why: pick(locale, {
        sv: `Justerbar hydraulisk stötdämpare ${String(p.key_specs?.sizes ?? "")}. Dimensioneras efter energi per slag — verifiera mot databladets energikapacitet.`,
        en: `Adjustable hydraulic shock absorber ${String(p.key_specs?.sizes ?? "")}. Sized by energy per cycle — verify against the datasheet's energy capacity.`,
        de: `Einstellbarer hydraulischer Stoßdämpfer ${String(p.key_specs?.sizes ?? "")}. Dimensionierung nach Energie pro Hub — anhand der Energiekapazität im Datenblatt prüfen.`,
        es: `Amortiguador hidráulico ajustable ${String(p.key_specs?.sizes ?? "")}. Dimensionado según la energía por ciclo — verifique la capacidad energética en la hoja de datos.`,
      }),
      pros: pick(locale, {
        sv: ["Justerbar dämpning", "Mjuk inbromsning som skyddar mekaniken"],
        en: ["Adjustable damping", "Smooth deceleration that protects the mechanics"],
        de: ["Einstellbare Dämpfung", "Sanfte Abbremsung, die die Mechanik schont"],
        es: ["Amortiguación ajustable", "Deceleración suave que protege la mecánica"],
      }),
      cons: pick(locale, {
        sv: ["Välj storlek efter energikapacitet (Nm/slag) i databladet"],
        en: ["Choose size by the energy capacity (Nm/cycle) in the datasheet"],
        de: ["Größe nach Energiekapazität (Nm/Hub) im Datenblatt wählen"],
        es: ["Elija el tamaño según la capacidad energética (Nm/ciclo) en la hoja de datos"],
      }),
    }));
    const eNote = energyJ > 0
      ? pick(locale, {
          sv: ` Beräknad rörelseenergi ≈ ${energyJ.toFixed(1)} J/slag (½·${loadKg} kg·(${speedMs} m/s)²).`,
          en: ` Estimated kinetic energy ≈ ${energyJ.toFixed(1)} J/cycle (½·${loadKg} kg·(${speedMs} m/s)²).`,
          de: ` Berechnete Bewegungsenergie ≈ ${energyJ.toFixed(1)} J/Hub (½·${loadKg} kg·(${speedMs} m/s)²).`,
          es: ` Energía cinética estimada ≈ ${energyJ.toFixed(1)} J/ciclo (½·${loadKg} kg·(${speedMs} m/s)²).`,
        })
      : "";
    const summary = pick(locale, {
      sv: `Det här är en stötdämpar-applikation — en cylinder bromsar inte en rullande massa, det gör en stötdämpare.${eNote} Välj storlek (M8–M20) efter dämparens energikapacitet per slag (se datablad).`,
      en: `This is a shock-absorber application — a cylinder won't stop a rolling mass, a shock absorber does.${eNote} Pick a size (M8–M20) by the absorber's energy capacity per cycle (see datasheet).`,
      de: `Dies ist eine Stoßdämpfer-Anwendung — ein Zylinder bremst keine rollende Masse ab, das übernimmt ein Stoßdämpfer.${eNote} Größe (M8–M20) nach der Energiekapazität des Dämpfers pro Hub wählen (siehe Datenblatt).`,
      es: `Esta es una aplicación de amortiguador — un cilindro no detiene una masa rodante, un amortiguador sí.${eNote} Elija el tamaño (M8-M20) según la capacidad energética del amortiguador por ciclo (véase la hoja de datos).`,
    });
    logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: false, top_sku: options[0]?.sku ?? null, option_count: options.length }, true);
    return Response.json({ summary, options }, { headers: CORS });
  }
  // ── Hydraulic application — outside the pneumatic/electric catalog entirely ──
  // isHydraulicApplication() used to be computed but never actually FILTERED the
  // candidate pool: a 250-bar / 200 kN hydraulic press request still got standard
  // 6-10 bar pneumatic ISO cylinders ranked as "Bästa valet" (they matched on
  // stroke alone, with no pressure/force-class check at all). We carry zero
  // hydraulic products — escalate honestly instead of presenting pneumatic parts
  // as if they could survive hydraulic oil pressure.
  const isHydraulicReq = isHydraulicApplication(combinedText);
  if (isHydraulicReq) {
    const customCtx: CustomSolutionContext = {
      isWashdown: false, isVertical: false, isFoodGrade: false,
      isBatteryDryroom: false, isHydraulic: true, isAtex: false, isSilSafety: false,
    };
    const options = [buildCustomSolutionOption(0, locale, 0, false, customCtx)];
    const summary = pick(locale, {
      sv: "Det här är en hydraulisk applikation (oljedrift, högt tryck) — helt utanför vårt pneumatiska/elektriska sortiment. Att föreslå en pneumatisk katalogcylinder här vore direkt farligt (den är inte tryckklassad för hydraulolja). Vi tar fram en kundspecifik hydrauliklösning.",
      en: "This is a hydraulic application (oil-driven, high pressure) — entirely outside our pneumatic/electric range. Recommending a pneumatic catalog cylinder here would be unsafe (it isn't pressure-rated for hydraulic oil). We'll work out a custom hydraulic solution.",
      de: "Dies ist eine hydraulische Anwendung (ölbetrieben, hoher Druck) — vollständig außerhalb unseres pneumatischen/elektrischen Sortiments. Einen pneumatischen Katalogzylinder hier vorzuschlagen wäre unsicher (er ist nicht druckklassifiziert für Hydrauliköl). Wir erarbeiten eine kundenspezifische Hydrauliklösung.",
      es: "Esta es una aplicación hidráulica (accionada por aceite, alta presión) — completamente fuera de nuestra gama neumática/eléctrica. Recomendar aquí un cilindro neumático de catálogo sería inseguro (no está clasificado para la presión del aceite hidráulico). Desarrollaremos una solución hidráulica a medida.",
    });
    logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: false, top_sku: "CUSTOM-SOLUTION", option_count: 1 }, true);
    return Response.json({ summary, options }, { headers: CORS });
  }

  // ── Pure rotary-actuator application (rotation angle + torque, no linear stroke) ──
  // Without this branch, "180°, 50 Nm" ranked LINEAR cylinders above real rotary
  // actuators: with maxRequiredStroke=0, actuatorTier()'s "meets" check auto-passes
  // for everything, but a strokeless rotary actuator still counts as "configurable"
  // (tier 1) while any linear cylinder with SOME concrete stroke value is tier 0 —
  // so an unrelated linear part always won, and the LLM then fabricated a fictional
  // "lever arm" justification for why it substitutes for rotation.
  const isPureRotary = categories.includes("rotary-actuator") && maxRequiredStroke === 0
    && !isSystemScope && !isMultiAxis;
  if (isPureRotary) {
    const rotaryProducts = await fetchProducts(["rotary-actuator"], 40);
    const requiredTorque = extractTorqueNm(combinedText, answers);
    const requiredDeg = extractRotationDeg(combinedText, answers);
    const withTorque = rotaryProducts.filter(p => parseTorqueFromSpecs(p.key_specs ?? {}) > 0);
    const pool = withTorque.length ? withTorque : rotaryProducts;
    const sorted = [...pool].sort((a, b) => parseTorqueFromSpecs(a.key_specs ?? {}) - parseTorqueFromSpecs(b.key_specs ?? {}));
    const adequate = requiredTorque > 0 ? sorted.filter(p => parseTorqueFromSpecs(p.key_specs ?? {}) >= requiredTorque) : sorted;
    // No product reaches the required torque: closest (highest available) is the
    // honest recommendation, flagged inexact — never silently undersized.
    const torqueInexact = requiredTorque > 0 && adequate.length === 0;
    const picks = (adequate.length ? adequate : sorted.slice(-3)).slice(0, 3);
    // Found 2026-08-21: this branch never called the LLM (deliberately, same
    // "no hallucination risk" reasoning as buildMandatoryBomRows) but that left
    // pros/cons as permanently empty arrays instead of deterministic text like
    // every other field here already has. Ground them in each product's own
    // key_specs (mode_of_operation, position_sensing, temp_range) rather than
    // generic claims that might not hold for every SKU in the catalog.
    const options = picks.map((p, i) => {
      const torque = parseTorqueFromSpecs(p.key_specs ?? {});
      const mode = p.key_specs?.mode_of_operation ? String(p.key_specs.mode_of_operation) : "";
      const posSensing = p.key_specs?.position_sensing ? String(p.key_specs.position_sensing) : "";
      // fetch_products_for_advisor() already appends `product_specs.unit` server-side
      // when that column is set (so some rows arrive as "-10 to +80 °C", others as
      // plain "-10 to +80") - append °C only when it isn't already there, so this
      // never doubles up regardless of which rows happen to have a unit on file.
      const tempRangeRaw = p.key_specs?.temp_range ? String(p.key_specs.temp_range) : "";
      const tempRange = tempRangeRaw && !/°?\s*c\b/i.test(tempRangeRaw) ? `${tempRangeRaw}°C` : tempRangeRaw;
      const pros = [
        mode ? pick(locale, {
          sv: `Drivmekanism: ${mode}.`, en: `Drive mechanism: ${mode}.`,
          de: `Antriebsmechanismus: ${mode}.`, es: `Mecanismo de accionamiento: ${mode}.`,
        }) : "",
        posSensing
          ? pick(locale, {
              sv: `Lägesåterkoppling: ${posSensing}.`, en: `Position feedback: ${posSensing}.`,
              de: `Positionsrückmeldung: ${posSensing}.`, es: `Retroalimentación de posición: ${posSensing}.`,
            })
          : pick(locale, {
              sv: `Pneumatisk drift — enkel styrning via standardventil.`, en: `Pneumatic operation — simple control via standard valve.`,
              de: `Pneumatischer Betrieb — einfache Steuerung über Standardventil.`, es: `Accionamiento neumático — control sencillo mediante válvula estándar.`,
            }),
      ].filter(Boolean) as string[];
      const cons = [
        i === 0 && torqueInexact ? pick(locale, {
          sv: `Klarar INTE de begärda ${requiredTorque} Nm — se den som utgångspunkt, inte en bekräftad match.`,
          en: `Does NOT meet the requested ${requiredTorque} Nm — treat as a starting point, not a confirmed match.`,
          de: `Erfüllt die angeforderten ${requiredTorque} Nm NICHT — als Ausgangspunkt betrachten, keine bestätigte Übereinstimmung.`,
          es: `NO cumple los ${requiredTorque} Nm solicitados — considérela un punto de partida, no una coincidencia confirmada.`,
        }) : "",
        tempRange ? pick(locale, {
          sv: `Drifttemperatur ${tempRange} — verifiera mot er miljö.`, en: `Operating temperature ${tempRange} — verify against your environment.`,
          de: `Betriebstemperatur ${tempRange} — mit Ihrer Umgebung abgleichen.`, es: `Temperatura de funcionamiento ${tempRange} — verifique frente a su entorno.`,
        }) : "",
        pick(locale, {
          sv: `Kontrollera axelinterface/montering mot er applikation.`, en: `Verify shaft interface/mounting against your application.`,
          de: `Wellenschnittstelle/Befestigung mit Ihrer Anwendung abgleichen.`, es: `Verifique la interfaz del eje/montaje frente a su aplicación.`,
        }),
      ].filter(Boolean) as string[];
      return {
        sku: p.sku, name: p.name,
        badge: i === 0 && torqueInexact
          ? pick(locale, { sv: "Närmaste — otillräckligt vridmoment", en: "Closest — insufficient torque", de: "Nächstgelegen — unzureichendes Drehmoment", es: "Más cercano — par insuficiente" })
          : pick(locale, {
              sv: ["Bästa valet", "Kompakt alternativ", "Budgetalternativ"], en: ["Best choice", "Compact option", "Budget option"],
              de: ["Beste Wahl", "Kompakte Option", "Budget-Option"], es: ["Mejor opción", "Opción compacta", "Opción económica"],
            })[i],
        bore_mm: null, stroke_mm: null,
        force_n: torque || null,
        why: torqueInexact
          ? pick(locale, {
              sv: `${p.name} — ${torque} Nm är det högsta vridmoment vi har i lager, men klarar INTE de begärda ${requiredTorque} Nm. Rekommendation, inte en bekräftad match — för ${requiredTorque} Nm krävs kundspecifik lösning.`,
              en: `${p.name} — ${torque} Nm is the highest torque we stock, but does NOT meet the requested ${requiredTorque} Nm. A recommendation, not a confirmed match — ${requiredTorque} Nm needs a custom solution.`,
              de: `${p.name} — ${torque} Nm ist das höchste Drehmoment, das wir auf Lager haben, erfüllt jedoch NICHT die angeforderten ${requiredTorque} Nm. Eine Empfehlung, keine bestätigte Übereinstimmung — für ${requiredTorque} Nm ist eine kundenspezifische Lösung erforderlich.`,
              es: `${p.name} — ${torque} Nm es el par máximo que tenemos en stock, pero NO cumple los ${requiredTorque} Nm solicitados. Es una recomendación, no una coincidencia confirmada — para ${requiredTorque} Nm se necesita una solución a medida.`,
            })
          : pick(locale, {
              sv: `${p.name} — ${torque} Nm vridmoment${requiredDeg > 0 ? `, ${requiredDeg}° rörelseomfång` : ""}.`,
              en: `${p.name} — ${torque} Nm torque${requiredDeg > 0 ? `, ${requiredDeg}° rotation range` : ""}.`,
              de: `${p.name} — ${torque} Nm Drehmoment${requiredDeg > 0 ? `, ${requiredDeg}° Drehbereich` : ""}.`,
              es: `${p.name} — ${torque} Nm de par${requiredDeg > 0 ? `, rango de rotación de ${requiredDeg}°` : ""}.`,
            }),
        pros, cons,
      };
    });
    const customCtx: CustomSolutionContext = {
      isWashdown: false, isVertical: false, isFoodGrade: false,
      isBatteryDryroom: false, isHydraulic: false, isAtex: false, isSilSafety: false,
    };
    options.push(buildCustomSolutionOption(0, locale, 0, false, customCtx) as typeof options[number]);
    const summary = torqueInexact
      ? pick(locale, {
          sv: `Ingen lagervara klarar de begärda ${requiredTorque} Nm — ${picks[0]?.name} (${parseTorqueFromSpecs(picks[0]?.key_specs ?? {})} Nm) är närmaste, men otillräcklig. Se den som en utgångspunkt; för ${requiredTorque} Nm behövs en kundspecifik rotationsaktuator.`,
          en: `No stocked unit meets the requested ${requiredTorque} Nm — ${picks[0]?.name} (${parseTorqueFromSpecs(picks[0]?.key_specs ?? {})} Nm) is the closest, but insufficient. Treat it as a starting point; ${requiredTorque} Nm needs a custom rotary actuator.`,
          de: `Keine Lagerware erfüllt die angeforderten ${requiredTorque} Nm — ${picks[0]?.name} (${parseTorqueFromSpecs(picks[0]?.key_specs ?? {})} Nm) ist am nächsten, aber unzureichend. Als Ausgangspunkt betrachten; für ${requiredTorque} Nm wird ein kundenspezifischer Rotationsaktuator benötigt.`,
          es: `Ninguna unidad en stock cumple los ${requiredTorque} Nm solicitados — ${picks[0]?.name} (${parseTorqueFromSpecs(picks[0]?.key_specs ?? {})} Nm) es la más cercana, pero insuficiente. Considérela como punto de partida; para ${requiredTorque} Nm se necesita un actuador rotativo a medida.`,
        })
      : pick(locale, {
          sv: `Rotationsaktuator vald efter vridmoment${requiredTorque > 0 ? ` (krav ${requiredTorque} Nm)` : ""}${requiredDeg > 0 ? ` och ${requiredDeg}° rörelseomfång` : ""} — inte cylinderslag.`,
          en: `Rotary actuator selected by torque${requiredTorque > 0 ? ` (requirement ${requiredTorque} Nm)` : ""}${requiredDeg > 0 ? ` and ${requiredDeg}° rotation range` : ""} — not cylinder stroke.`,
          de: `Rotationsaktuator ausgewählt nach Drehmoment${requiredTorque > 0 ? ` (Anforderung ${requiredTorque} Nm)` : ""}${requiredDeg > 0 ? ` und ${requiredDeg}° Drehbereich` : ""} — nicht nach Zylinderhub.`,
          es: `Actuador rotativo seleccionado según el par${requiredTorque > 0 ? ` (requisito ${requiredTorque} Nm)` : ""}${requiredDeg > 0 ? ` y rango de rotación de ${requiredDeg}°` : ""} — no la carrera del cilindro.`,
        });
    logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: false, top_sku: picks[0]?.sku ?? null, option_count: options.length }, true);
    return Response.json({ summary, options }, { headers: CORS });
  }

  // End-effector (gripper / vacuum) — the primary function is GRIPPING, not linear
  // motion. Skip for a multi-axis line or whole-system request (those own the motion
  // axes; the end-effector is then a BOM detail, not the headline recommendation).
  const endEffector = detectEndEffectorIntent(combinedText);
  if (endEffector && !isMultiAxis && !isSystemScope) {
    return await handleEndEffectorOptions(endEffector, combinedText, loadKg, locale, t0);
  }

  if (minBoreMm > 0) console.log(`[options] load=${loadKg}kg → minBore=${minBoreMm}mm`);

  // System scope: surface only motion/actuator building blocks (drop loose
  // sensor/vacuum/drive categories) so the 3 options are clean actuators; the
  // summary already routes weighing/vision/PLC/robot to engineering.
  const motionCats = categories.filter(c => ["cylinder","electric-actuator","linear-module","rotary-actuator"].includes(c));
  const systemMotionCats = isSystemScope && motionCats.length > 0 ? motionCats : categories;

  const [allProducts, pdfCtx] = await Promise.all([
    // High limit so the WHOLE category is considered: the fetch RPC orders by
    // brand, so a limit of 80 over 325 cylinders only ever returned early-alphabet
    // brands (Bosch/Camozzi) — a Festo stainless cylinder that uniquely meets a
    // wet + Ø63 + 300 mm spec was never even a candidate. Downstream still narrows
    // to the best 25 by stroke fit, so fetching more is safe and just improves coverage.
    fetchProducts(systemMotionCats, 500),
    searchKnowledge(combinedText, 5),
  ]);
  const productMap = new Map<string, CatalogProduct>(allProducts.map(p => [p.sku, p]));

  // ── Hard pre-filters ──────────────────────────────────────────────
  const atexFiltered = isAtex ? allProducts.filter(p => !isElectricActuator(p)) : allProducts;
  const washdownFiltered = needsCorrosionResistant ? atexFiltered.filter(p => isWashdownProduct(p)) : atexFiltered;
  // v51: precision (≤0.1 mm) excludes PNEUMATICS on EVERY axis — they physically cannot
  // hold the tolerance. Single-axis / vertical-precision also exclude belt (ball-screw
  // only). Multi-axis keeps belt for a fast axis but STILL drops pneumatics — the old code
  // skipped the filter entirely for multi-axis, letting a pneumatic cylinder become the
  // primary on a ±0.05 mm pick-and-place (the reported bug).
  const applyPrecisionFilter = isHighPrecision;
  const precisionFiltered = applyPrecisionFilter
    ? washdownFiltered.filter(p =>
        (!isMultiAxis || isHighPrecisionVertical)
          ? isAllowedForHighPrecision(p)          // ball-screw only
          : !isPneumaticActuatorProduct(p))        // multi-axis: drop pneumatics, keep belt
    : washdownFiltered;
  const applySpeedFilter = speedMs > 0.8 && !isHighPrecision && !isAtex;
  const speedFiltered = applySpeedFilter ? precisionFiltered.filter(p => isAllowedForHighSpeed(p)) : precisionFiltered;
  // Articulated/swivel mounting (angled push, cylinder pivots during stroke): only a
  // ROD cylinder can take a rear pivot flange + rod clevis. Slides/rodless/guided
  // units mount rigidly — surfacing one here (e.g. a linear slide as "Bästa valet"
  // for a swivel application) is a category error (package-sorter test).
  const isArticulated = needsArticulatedMount(combinedText);
  const articulatedFiltered = isArticulated
    ? speedFiltered.filter(p =>
        !(["cylinder", "electric-actuator", "linear-module"].includes(p.category) && isNonArticulatingActuator(p)))
    : speedFiltered;
  // Hard bore filter: remove products whose bore is provably too small for load
  const boreFiltered = minBoreMm > 0
    ? articulatedFiltered.filter(p => {
        const b = parseFloat(String(p.key_specs?.bore_mm ?? "0"));
        return b === 0 || b >= minBoreMm; // keep unknowns, reject confirmed undersized
      })
    : articulatedFiltered;

  // Explicit bore (user answered "diameter: 50" / wrote Ø50): exact matches outrank
  // the load-based "smallest adequate" — answering Ø50 and getting Ø40 back is a
  // trust-breaker (conveyor-stopper test). Falls back to all candidates when no
  // exact-bore product exists (then the honest inexact framing kicks in below).
  const explicitBoreMm = extractExplicitBoreMm(combinedText, answers);
  const exactBoreSet = explicitBoreMm > 0
    ? boreFiltered.filter(p => parseFloat(String(p.key_specs?.bore_mm ?? "0")) === explicitBoreMm)
    : [];
  const boreScoped0 = exactBoreSet.length > 0 ? exactBoreSet : boreFiltered;
  // "standard pneumatisk cylinder" explicitly requested → a plain profile/rod
  // cylinder must outrank guided/compact/rodless/stainless specials.
  const wantsPlainStd = /standard\s*(pneumatisk\s*)?cylinder|standardcylinder|vanlig\s+(profil)?cylinder/i.test(combinedText);
  const isSpecialCyl = (p: CatalogProduct) =>
    p.category === "cylinder" && /guide|guided|compact|rodless|slide|stainless|rostfri|kolvstångslös/i.test(p.name);
  const plainSet = wantsPlainStd ? boreScoped0.filter(p => !isSpecialCyl(p)) : boreScoped0;
  const boreScoped = plainSet.length > 0 ? plainSet : boreScoped0;

  const qualified: CatalogProduct[] = [];        // concrete stroke ≥ requirement
  const configurable: CatalogProduct[] = [];     // strokeless families — shown (labelled), never a silent stroke match
  let bestFallback: CatalogProduct | null = null;
  let bestFallbackStroke = 0;
  let maxCatalogStroke = 0;
  for (const p of boreScoped) {
    const maxStroke = parseStrokeFromSpecs(p.key_specs ?? {});
    if (maxStroke > maxCatalogStroke) maxCatalogStroke = maxStroke;
    if (maxStroke === 0) { configurable.push(p); continue; } // no concrete stroke → configurable, not a confirmed match
    if (maxRequiredStroke === 0 || maxStroke >= maxRequiredStroke) qualified.push(p);
    else if (maxStroke > bestFallbackStroke) { bestFallbackStroke = maxStroke; bestFallback = p; }
  }
  // Configurable families are eligible for display (ranked BELOW concrete + labelled),
  // but they do NOT count as the catalog being able to meet the stroke requirement.
  const concreteOrFallback = qualified.length > 0 ? qualified : (bestFallback ? [bestFallback] : []);
  // If nothing passed the HARD physical/material filters (bore, washdown, precision,
  // speed, ATEX), the honest answer is a CUSTOM-SOLUTION escalation — never a product
  // that violates a hard constraint (undersized bore, non-washdown material, a
  // pneumatic for a precision job). bestFallback above already surfaces the closest
  // VALID product when one exists, so an empty result here yields only CUSTOM.
  const showProducts = (concreteOrFallback.length > 0 || configurable.length > 0)
    ? [...concreteOrFallback, ...configurable]
    : [];
  const catalogCanHandle = qualified.length > 0;

  const tempFiltered = requiredTemp > 0
    ? showProducts.filter(p => { const t = parseProductTempMax(p.key_specs ?? {}); return t === 0 || t >= requiredTemp; })
    : showProducts;

  const sortedProducts = sortByStrokeMatch(tempFiltered.length > 0 ? tempFiltered : showProducts, maxRequiredStroke);
  const catalogProducts = sortedProducts.slice(0, 25);
  console.log(`[options v40] categories=${categories} stroke=${maxRequiredStroke} qualified=${qualified.length} catalog=${catalogProducts.length}`);

  // ── v40/v51: Server-side product selection ───────────────────────
  // rankActuators() tiers candidates so a configurable family NEVER outranks a
  // concrete-stroke product that meets the requirement (regression-tested).
  const scoringCtx: ScoringCtx = { requiredStroke: maxRequiredStroke, minBoreMm, isHighPrecision, isHighSpeed, isVertical: isVerticalLoad, isWashdown: needsCorrosionResistant, isAtex, preferredBrands: detectRequestedBrands(combinedText) };
  const topProducts = rankActuators(catalogProducts, scoringCtx).slice(0, 3);

  // Build server-side option objects (correct data, LLM fills in text)
  const lang = langName(locale);

  // No exact-size stock match → the top pick is the closest (oversized) one. Per
  // policy we RECOMMEND it but don't present it as the definitive choice; the
  // honest path for an exact fit is a configurable variant or a custom solution.
  const topBore0 = parseFloat(String(topProducts[0]?.key_specs?.bore_mm ?? "0"));
  // With an explicit bore: exact hit = exact (never "oversized" vs the LOAD minimum,
  // which would mislabel the precisely-requested Ø50); a differing top bore = inexact.
  const boreInexact = explicitBoreMm > 0
    ? (topBore0 > 0 && topBore0 !== explicitBoreMm)
    : (minBoreMm > 0 && topBore0 > 0 && topBore0 > minBoreMm * 1.4);

  const serverOptions = topProducts.map((p, i) => {
    const ms = parseStrokeFromSpecs(p.key_specs ?? {});
    const bore = parseFloat(String(p.key_specs?.bore_mm ?? "0")) || null;
    const force = parseFloat(String(p.key_specs?.force_n ?? "0")) || null;
    // Adversarial-test finding 2026-08-17: gpt-oss-120b is a reasoning model —
    // on a 3-item JSON array it sometimes spends its budget on hidden reasoning
    // and closes the array early, silently omitting the later SKUs from its
    // response. When that happens below, this is what ships to the customer
    // instead of a blank "why" — so it must hold up fully on its own: real
    // numbers only, never invented.
    const fallbackWhy = [
      bore ? pick(locale, { sv: `Ø${bore} mm borr`, en: `Ø${bore} mm bore`, de: `Ø${bore} mm Bohrung`, es: `Ø${bore} mm de diámetro` }) : "",
      ms > 0 ? pick(locale, { sv: `${ms} mm slag`, en: `${ms} mm stroke`, de: `${ms} mm Hub`, es: `${ms} mm de carrera` }) : "",
      force ? `${force} N` : "",
    ].filter(Boolean).join(", ");
    return {
      sku: p.sku, name: p.name,
      badge: i === 0 && isSystemScope
        ? pick(locale, { sv: "Byggblock – rörelsedel", en: "Building block – motion", de: "Baustein – Bewegungsteil", es: "Componente – parte de movimiento" })
        : i === 0 && boreInexact
        ? pick(locale, { sv: "Närmaste — överdimensionerad", en: "Closest — oversized", de: "Nächstgelegen — überdimensioniert", es: "Más cercano — sobredimensionado" })
        : pick(locale, {
            sv: ["Bästa valet","Kompakt alternativ","Budgetalternativ"], en: ["Best choice","Compact option","Budget option"],
            de: ["Beste Wahl","Kompakte Option","Budget-Option"], es: ["Mejor opción","Opción compacta","Opción económica"],
          })[i],
      bore_mm: bore,
      stroke_mm: ms > 0 ? ms : null,
      force_n: force,
      why: fallbackWhy, pros: [] as string[], cons: [] as string[],
    };
  });

  // ── LLM enrichment: text only, SKUs are pre-locked ───────────────
  // Adversarial-test finding 2026-08-17: oxygen-clean and pharma/GMP requests
  // got zero relevant guidance because their hazard flags (computed above,
  // same as the ones already listed here) were never actually included in
  // this string — only 6 of 14 computed flags reached this call. The BOM
  // action's specialConstraints array already surfaces all of them; this
  // brings the options action's requirement summary up to the same coverage.
  const reqSummary = [
    maxRequiredStroke > 0 ? `Stroke: ${maxRequiredStroke} mm` : "",
    precisionMm > 0 ? `Precision: ±${precisionMm} mm` : "",
    isVerticalLoad ? pick(locale, { sv: "Vertikal last", en: "Vertical load", de: "Vertikale Last", es: "Carga vertical" }) : "",
    isWashdown ? "Washdown/IP69K" : "",
    isAtex ? "ATEX Zone 1/2" : "",
    isAtexDust ? "ATEX Zone 20/21/22 (damm)" : "",
    isHighSpeed ? `Hög hastighet ${(speedMs*1000).toFixed(0)} mm/s` : "",
    isOxygenClean ? "⛔ Syrgasmiljö — endast oljefria komponenter, ingen standard smord pneumatik" : "",
    isPharmaGmp ? "⚠️ GMP/FDA-krav — 316L/PTFE/EPDM, ej standardaluminium" : "",
    isBatteryDryroom ? "⛔ Torrumsmiljö (batteri) — absolut Cu/Zn/Ni-förbud" : "",
    isSilSafety ? "⚠️ SIL/PL säkerhetsfunktion — certifierad ventil krävs" : "",
    isHydraulic || isVeryHighForce ? "⚠️ Hydraulik/mycket hög kraft — utanför pneumatisk katalog" : "",
    isHighTemp ? "⚠️ Hög temperatur >80°C — PTFE/FKM-tätning krävs" : "",
    isLowTemp ? "⚠️ Låg temperatur — kontrollera tätningsmaterial" : "",
    isOutdoor ? "Utomhus/marin miljö — korrosionsbeständighet" : "",
    isHighCycle ? "Kontinuerlig drift/högfrekvent — dimensionera för livslängd" : "",
  ].filter(Boolean).join(" | ");

  const preselectedStr = topProducts.map((p, i) =>
    `${i+1}. SKU="${p.sku}" | ${p.name} [${p.brand}/${p.category}] stroke=${strokeLabel(p.key_specs??{})} specs:${JSON.stringify(p.key_specs??{})}`
  ).join("\n");

  // SECURITY/SAFETY: found via adversarial testing 2026-08-16 — asked for a Zone 1
  // ATEX cylinder "cheapest possible, regardless of ATEX rating" and the model
  // fabricated "these meet ATEX Zone 1/2 requirements" for three completely
  // standard, uncertified ISO cylinders (verified against product_specs: no
  // certification/explosion-protection field exists on any catalog product).
  // Nothing in the prompt told it not to invent a compliance claim, so — asked
  // for a confident, specific engineering justification — it did. The BOM action
  // already has correct, server-injected ATEX warning text; this path had none.
  const atexWarning = (isAtex || isAtexDust) ? `
4. ATEX/Ex-zone request detected. These 3 products are STANDARD catalog items — NONE are ATEX/IECEx zone-certified (verify: no catalog product carries explosion-protection certification). You MUST NOT state or imply that any of them is ATEX-rated, explosion-proof, or zone-safe. "why" and "summary" MUST explicitly say these are standard, non-certified components shown for dimensioning/reference only, and that genuine ATEX/IECEx-certified equivalents (e.g. Parker P1X ATEX, SMC CDQMB-ATEX, Norgren Excelon ATEX-series) must be sourced and verified against the stated zone before purchase — recommend contacting us for a certified solution rather than ordering these directly.` : "";

  // SECURITY/CORRECTNESS: adversarial-tested 2026-08-17 — even a completely
  // ordinary, non-adversarial request ("cylinder for a stop function on a
  // conveyor") produced "why" text claiming a heat-treated steel body and
  // built-in pressure relief valves, neither of which exist anywhere in that
  // product's specs. Root cause: rule 2 below used to say "be specific,
  // mention numbers" about "material" and "safety" without ever telling the
  // model those topics are only sometimes present in the actual data — so
  // when they weren't, it invented plausible-sounding ones instead of just
  // not mentioning them. Confirmed across 4 independent test calls (SIL,
  // oxygen-clean, pharma/GMP, and one plain query) before concluding this
  // was systemic rather than a one-off sampling fluke.
  const optSystem = `You are a senior automation engineer. Write product descriptions for 3 pre-selected products. All text in ${lang}.

MANDATORY RULES:
1. Use EXACTLY these SKUs: ${topProducts.map(p => p.sku).join(", ")} — do NOT change them
2. "why" = engineering justification grounded ONLY in the specs actually given for that product below (its specs:{...} JSON — bore, stroke, force, pressure, temperature, etc). Cite real numbers from there. Do NOT invent material, weight, coatings, heat treatment, integrated safety features (e.g. "built-in pressure relief"), or certifications that aren't listed — if a product's data doesn't cover something, leave it out rather than guessing. A short, fully-grounded "why" is correct; a longer one padded with invented details is not.
3. pros/cons: same rule — only claims backed by the listed specs. 2-3 pros, 1-2 cons.${atexWarning}
Do NOT output a badge field — badges are assigned server-side and must not be set by you.

JSON: { "summary": "1-2 sentences: mechanism + safety", "options": [ { "sku": "EXACT_SKU", "why": "...", "pros": [...], "cons": [...] } ] }`;

  const optUser = `Application: ${description}\nRequirements: ${reqSummary || "standard"}\n${Object.entries(answers).map(([k,v])=>`${k}: ${v}`).join(", ")}\n\nPre-selected products (write descriptions for these ONLY):\n${preselectedStr}${pdfCtx ? `\n\nDocs:\n${pdfCtx}` : ""}`;

  let rawOptions: string | null = null;
  let optRateLimited = false;
  // 1200→2200: gpt-oss-120b is a reasoning model — its hidden reasoning tokens
  // count against max_tokens before any visible output, and on a tight budget
  // it was intermittently closing the JSON options array early (confirmed live
  // 2026-08-17: 2 of 3 real products came back with blank why/pros in the same
  // response). 2200 gives headroom for reasoning + all 3 full entries.
  try { rawOptions = await callGroq([{ role: "system", content: optSystem }, { role: "user", content: optUser }], 2200, true, 0.3); }
  catch (e) {
    if ((e as Error).message === "RATE_LIMITED") optRateLimited = true;
    else console.error("options: callGroq threw, falling back to grounded server defaults:", e);
  }

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
        if (!llmOpt) {
          console.error("options: LLM omitted SKU from response, using grounded fallback:", opt.sku);
          return opt;
        }
        // Badge is server-authoritative — the LLM only writes prose (why/pros/cons).
        // It used to be allowed to override the badge and always re-stamped the top
        // pick 'Bästa valet', even when the server had flagged it as the closest
        // OVERSIZED match — contradicting the honest "no exact-size match" summary.
        // Structured semantics (badge) stay on the server; the model never sets them.
        return {
          ...opt,
          why:   (typeof llmOpt.why === "string" && llmOpt.why)     ? llmOpt.why   : opt.why,
          pros:  (Array.isArray(llmOpt.pros) && llmOpt.pros.length) ? llmOpt.pros  : opt.pros,
          cons:  (Array.isArray(llmOpt.cons) && llmOpt.cons.length) ? llmOpt.cons  : opt.cons,
        };
      });
    } catch (e) { console.error("options: failed to parse LLM JSON, using grounded server defaults:", e); }
  }

  // ── Server-side post-validation (stroke, washdown, precision, temp) ──
  finalOptions = finalOptions.map(opt => {
    const sku = opt.sku as string;
    if (sku === "CUSTOM-SOLUTION") return opt;
    const cat = productMap.get(sku);
    if (!cat) return opt;
    const actualMax = parseStrokeFromSpecs(cat.key_specs ?? {});
    opt.stroke_mm = actualMax > 0 ? actualMax : null;
    // Family / configurable product: never present it as a silent exact match.
    // Tiering already keeps it below concrete matches; here we label it clearly so
    // the user knows the exact stroke is chosen at order (not a fixed stock SKU).
    const isConfigurable = isFamilyProduct(cat) || actualMax === 0;
    const tooShort = maxRequiredStroke > 0 && actualMax > 0 && actualMax < maxRequiredStroke;
    const closestCatalogBadge = pick(locale, { sv: "Närmaste katalogalternativ", en: "Closest catalog option", de: "Nächstgelegene Katalogoption", es: "Opción de catálogo más cercana" });
    if (isConfigurable && !tooShort) {
      opt.badge = pick(locale, { sv: "Konfigurera slag vid order", en: "Configure stroke at order", de: "Hub bei Bestellung konfigurieren", es: "Configurar carrera al pedido" });
      const note = pick(locale, {
        sv: `🔧 Produktfamilj/serie — exakt slaglängd${maxRequiredStroke > 0 ? ` (${maxRequiredStroke} mm)` : ""} väljs vid beställning${actualMax > 0 ? `; serien täcker upp till ${actualMax} mm` : ""}.`,
        en: `🔧 Product family/series — exact stroke${maxRequiredStroke > 0 ? ` (${maxRequiredStroke} mm)` : ""} is selected at order${actualMax > 0 ? `; the series covers up to ${actualMax} mm` : ""}.`,
        de: `🔧 Produktfamilie/-serie — die genaue Hublänge${maxRequiredStroke > 0 ? ` (${maxRequiredStroke} mm)` : ""} wird bei der Bestellung ausgewählt${actualMax > 0 ? `; die Serie deckt bis zu ${actualMax} mm ab` : ""}.`,
        es: `🔧 Familia/serie de productos — la carrera exacta${maxRequiredStroke > 0 ? ` (${maxRequiredStroke} mm)` : ""} se selecciona al realizar el pedido${actualMax > 0 ? `; la serie cubre hasta ${actualMax} mm` : ""}.`,
      });
      opt.why = `${note} ${opt.why ?? ""}`.trim();
    }
    if (maxRequiredStroke > 0 && actualMax > 0 && actualMax < maxRequiredStroke) {
      opt.badge = closestCatalogBadge;
      opt.why = `${opt.why} ` + pick(locale, {
        sv: `⚠️ Max slaglängd ${actualMax} mm — krav ${maxRequiredStroke} mm.`,
        en: `⚠️ Max stroke ${actualMax} mm — requirement ${maxRequiredStroke} mm.`,
        de: `⚠️ Max. Hub ${actualMax} mm — Anforderung ${maxRequiredStroke} mm.`,
        es: `⚠️ Carrera máx. ${actualMax} mm — requisito ${maxRequiredStroke} mm.`,
      });
    }
    if (isWashdown && !isWashdownProduct(cat)) {
      opt.badge = closestCatalogBadge;
      opt.why = `${opt.why} ` + pick(locale, {
        sv: `⚠️ Standardprodukt — verifiera korrosionsskydd för washdown-miljö.`,
        en: `⚠️ Standard product — verify corrosion protection for washdown environment.`,
        de: `⚠️ Standardprodukt — Korrosionsschutz für Washdown-Umgebung prüfen.`,
        es: `⚠️ Producto estándar — verifique la protección contra corrosión para entorno washdown.`,
      });
    }
    if (isHighPrecision && !isAllowedForHighPrecision(cat)) {
      const ft = isPneumaticActuatorProduct(cat)
        ? pick(locale, { sv: "pneumatisk cylinder", en: "pneumatic cylinder", de: "Pneumatikzylinder", es: "cilindro neumático" })
        : pick(locale, { sv: "kuggremsdrift", en: "belt drive", de: "Zahnriemenantrieb", es: "accionamiento por correa" });
      const crit = pick(locale, {
        sv: `⛔ KRITISKT FEL: ${ft} kan INTE uppnå ±${precisionMm} mm. Krävs: kulskruvsaxel.`,
        en: `⛔ CRITICAL FAILURE: ${ft} CANNOT achieve ±${precisionMm} mm. Required: ball-screw axis.`,
        de: `⛔ KRITISCHER FEHLER: ${ft} kann ±${precisionMm} mm NICHT erreichen. Erforderlich: Kugelumlaufspindelachse.`,
        es: `⛔ FALLO CRÍTICO: ${ft} NO puede alcanzar ±${precisionMm} mm. Requerido: eje de husillo de bolas.`,
      });
      opt.badge = closestCatalogBadge;
      opt.why = crit + " " + opt.why;
      opt.cons = [...((opt.cons as string[]) ?? []), crit];
    }
    if (isHighSpeed && isBallScrewProduct(cat)) {
      const warn = pick(locale, {
        sv: `⚠️ Kulskruvsaxel vid ${(speedMs*1000).toFixed(0)} mm/s — risk för vibration och slitage. Överväg kuggremsdrift (EGSC/ELGC-TB).`,
        en: `⚠️ Ball-screw at ${(speedMs*1000).toFixed(0)} mm/s — vibration and wear risk. Consider belt drive (EGSC/ELGC-TB).`,
        de: `⚠️ Kugelumlaufspindelachse bei ${(speedMs*1000).toFixed(0)} mm/s — Vibrations- und Verschleißrisiko. Zahnriemenantrieb erwägen (EGSC/ELGC-TB).`,
        es: `⚠️ Eje de husillo de bolas a ${(speedMs*1000).toFixed(0)} mm/s — riesgo de vibración y desgaste. Considere un accionamiento por correa (EGSC/ELGC-TB).`,
      });
      opt.cons = [...((opt.cons as string[]) ?? []), warn];
    }
    if (isBatteryDryroom) {
      const warn = pick(locale, {
        sv: `⚠️ Dryroom: Verifiera Cu/Zn/Ni-frihet i alla rörliga delar. Begär materialcertifikat.`,
        en: `⚠️ Dryroom: Verify Cu/Zn/Ni-free in all moving parts. Request material certificate.`,
        de: `⚠️ Trockenraum: Cu/Zn/Ni-Freiheit in allen beweglichen Teilen prüfen. Materialzertifikat anfordern.`,
        es: `⚠️ Sala seca: verifique la ausencia de Cu/Zn/Ni en todas las piezas móviles. Solicite el certificado de materiales.`,
      });
      opt.cons = [...((opt.cons as string[]) ?? []), warn];
    }
    if (requiredTemp > 0) {
      const tMax = parseProductTempMax(cat.key_specs ?? {});
      if (tMax > 0 && tMax < requiredTemp) {
        opt.badge = closestCatalogBadge;
        opt.why = pick(locale, {
          sv: `⛔ Temp ${tMax}°C < krav ${requiredTemp}°C. `,
          en: `⛔ Temp ${tMax}°C < requirement ${requiredTemp}°C. `,
          de: `⛔ Temp. ${tMax} °C < Anforderung ${requiredTemp} °C. `,
          es: `⛔ Temp. ${tMax} °C < requisito ${requiredTemp} °C. `,
        }) + opt.why;
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
  finalOptions.push(buildCustomSolutionOption(maxRequiredStroke, locale, maxCatalogStroke, catalogCanHandle, customCtx));

  // When no real catalog product matched (only CUSTOM-SOLUTION remains), the LLM
  // summary tends to hallucinate that our products meet the requirement (e.g.
  // claiming we lift 5000 kg). Override it with an honest message in that case.
  const customOnly = topProducts.length === 0;
  // Multi-axis (e.g. XYZ pick & place) needs one axis PER direction — the options
  // are not a single pick. Say so in the summary and point to the machine builder,
  // instead of implying one actuator covers the whole motion.
  const axesNote = perAxisStrokes.length >= 2
    ? ` (${perAxisStrokes.map((a) => `${a.axis.toUpperCase()} ${a.stroke} mm`).join(", ")})`
    : "";
  const summary = customOnly
    ? pick(locale, {
        sv: "Den här kombinationen av krav ligger utanför vårt standardsortiment — ingen katalogprodukt klarar den säkert. Vi föreslår en kundspecifik lösning; kontakta oss så tar vi fram ett förslag.",
        en: "This combination of requirements is outside our standard range — no catalog product meets it safely. We propose a custom-engineered solution; contact us and we'll work one out.",
        de: "Diese Kombination von Anforderungen liegt außerhalb unseres Standardsortiments — kein Katalogprodukt erfüllt sie sicher. Wir schlagen eine kundenspezifische Lösung vor; kontaktieren Sie uns, und wir erarbeiten einen Vorschlag.",
        es: "Esta combinación de requisitos queda fuera de nuestra gama estándar — ningún producto de catálogo la cumple de forma segura. Proponemos una solución diseñada a medida; contáctenos y elaboraremos una propuesta.",
      })
    : isSystemScope
    ? pick(locale, {
        sv: `Det här är ett flerstegssystem på linjenivå (detektera → stoppa/centrera → väga → identifiera → sortera till flera banor), inte en enskild komponent. Vårt sortiment täcker rörelse- och hanteringsdelen — pneumatiska aktuatorer för stopp, centrering och sortering samt sensorik — och förslagen nedan är byggblock för just den delen. Vägning (lastceller), identifiering (vision/streckkodsläsare), robot och PLC-styrning ligger utanför vårt komponentsortiment och kräver systemintegration. För kapacitet (t.ex. 30 st/min utan köbildning), buffring, cykeltid och komplett linjedesign tar våra ingenjörer helheten — kontakta oss för projektering.`,
        en: `This is a line-level multi-stage system (detect → stop/center → weigh → identify → sort to several lanes), not a single component. Our range covers the motion and handling part — pneumatic actuators for stopping, centering and sorting plus sensing — and the options below are building blocks for that part only. Weighing (load cells), identification (vision/barcode readers), robotics and PLC control are outside our component range and need system integration. For throughput (e.g. 30 units/min without queueing), buffering, cycle time and full line design our engineers take the whole — contact us for project engineering.`,
        de: `Dies ist ein mehrstufiges System auf Linienebene (Erkennen → Stoppen/Zentrieren → Wiegen → Identifizieren → Sortieren auf mehrere Bahnen), keine Einzelkomponente. Unser Sortiment deckt den Bewegungs- und Handhabungsteil ab — pneumatische Aktuatoren für Stopp, Zentrierung und Sortierung sowie Sensorik — und die unten stehenden Optionen sind Bausteine nur für diesen Teil. Wiegen (Wägezellen), Identifikation (Vision/Barcode-Leser), Robotik und SPS-Steuerung liegen außerhalb unseres Komponentensortiments und erfordern Systemintegration. Für Durchsatz (z. B. 30 Einheiten/min ohne Rückstau), Pufferung, Zykluszeit und komplettes Liniendesign übernehmen unsere Ingenieure das Gesamtbild — kontaktieren Sie uns für die Projektierung.`,
        es: `Se trata de un sistema multietapa a nivel de línea (detectar → parar/centrar → pesar → identificar → clasificar en varios carriles), no de un componente único. Nuestra gama cubre la parte de movimiento y manipulación — actuadores neumáticos para parada, centrado y clasificación, además de sensórica — y las opciones siguientes son componentes solo para esa parte. El pesaje (células de carga), la identificación (visión/lectores de código de barras), la robótica y el control por PLC quedan fuera de nuestra gama de componentes y requieren integración de sistemas. Para el rendimiento (p. ej. 30 unidades/min sin colas), el almacenamiento intermedio, el tiempo de ciclo y el diseño completo de la línea, nuestros ingenieros se encargan del conjunto — contáctenos para la ingeniería del proyecto.`,
      })
    : isMultiAxis
    ? pick(locale, {
        sv: `Det här är ett fleraxligt system${axesNote} — det behöver en separat axel per riktning, inte en enda aktuator. Se förslagen nedan som en axel i taget och kombinera dem i maskinbyggaren, där varje rörelse dimensioneras för sig.`,
        en: `This is a multi-axis system${axesNote} — it needs a separate axis per direction, not a single actuator. Treat the suggestions below as one axis at a time and combine them in the machine builder, where each motion is sized individually.`,
        de: `Dies ist ein Mehrachsensystem${axesNote} — es benötigt eine separate Achse pro Richtung, nicht einen einzigen Aktuator. Betrachten Sie die untenstehenden Vorschläge jeweils als eine Achse und kombinieren Sie sie im Maschinenbauer, wo jede Bewegung einzeln dimensioniert wird.`,
        es: `Se trata de un sistema multieje${axesNote} — necesita un eje independiente por dirección, no un único actuador. Trate las sugerencias siguientes como un eje a la vez y combínelas en el constructor de máquinas, donde cada movimiento se dimensiona individualmente.`,
      })
    : boreInexact
    ? pick(locale, {
        sv: `Vi har ingen lagervara i exakt rätt storlek för det här — ${topProducts[0].name} är närmaste (något överdimensionerad) och klarar kraven tekniskt. Se den som en rekommendation; för exakt mått väljer du en konfigurerbar variant (beställs i rätt borrning och slag) eller en kundspecifik lösning.`,
        en: `We don't stock an exact-size match for this — ${topProducts[0].name} is the closest (slightly oversized) and meets the requirements technically. Treat it as a recommendation; for an exact fit choose a configurable variant (ordered to the right bore and stroke) or a custom solution.`,
        de: `Wir führen keine exakt passende Größe hierfür — ${topProducts[0].name} ist die nächstgelegene (leicht überdimensioniert) und erfüllt die Anforderungen technisch. Betrachten Sie sie als Empfehlung; für eine exakte Passform wählen Sie eine konfigurierbare Variante (bestellt in der richtigen Bohrung und dem richtigen Hub) oder eine kundenspezifische Lösung.`,
        es: `No tenemos en stock una coincidencia de tamaño exacto para esto — ${topProducts[0].name} es la más cercana (ligeramente sobredimensionada) y cumple los requisitos técnicamente. Considérela una recomendación; para un ajuste exacto, elija una variante configurable (pedida con el diámetro y la carrera correctos) o una solución a medida.`,
      })
    : (llmSummary || pick(locale, {
        sv: `${topProducts.length} alternativ valda baserat på krav${maxRequiredStroke > 0 ? ` (slag ${maxRequiredStroke} mm)` : ""}.`,
        en: `${topProducts.length} options selected for ${maxRequiredStroke > 0 ? `${maxRequiredStroke} mm stroke` : "this application"}.`,
        de: `${topProducts.length} Optionen ausgewählt für ${maxRequiredStroke > 0 ? `${maxRequiredStroke} mm Hub` : "diese Anwendung"}.`,
        es: `${topProducts.length} opciones seleccionadas para ${maxRequiredStroke > 0 ? `${maxRequiredStroke} mm de carrera` : "esta aplicación"}.`,
      }));

  if (optRateLimited) {
    logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: true, top_sku: topProducts[0]?.sku ?? null }, false, "rate_limited");
    return Response.json({ error: "rate_limited" }, { status: 503, headers: CORS });
  }
  logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: false, top_sku: finalOptions[0]?.sku ?? null, option_count: finalOptions.length }, true);
  const requirements = {
    load_kg: loadKg > 0 ? loadKg : null,
    required_force_n: requiredForceN > 0 ? requiredForceN : null,
    required_stroke_mm: maxRequiredStroke > 0 ? maxRequiredStroke : null,
    safety_factor: 2,
    pressure_bar: 6,
  };
  return Response.json({ summary, options: finalOptions, requirements }, { headers: CORS });
}

// ── ACTION: bom (v40) ─────────────────────────────────────────────────────────
// v40: Mandatory BOM is built deterministically BEFORE calling LLM.
// If LLM is rate-limited, the BOM skeleton is returned as-is — never an empty BOM.
// Fetch just the chosen primary's category, so the BOM matches the ACTUAL product
// (pneumatic vs electric) rather than loose candidate-category triggers.
// Also returns the primary's BORE: the per-category BOM fetch is limited to 30
// brand-ordered rows, so a late-alphabet primary (e.g. Metal Work HCR-50) is often
// NOT in `products` — bore-matched accessory rows (rod lock, mounting) then had no
// bore to match against and fell to SPECIFY even when the Ø-variant is stocked.
async function fetchPrimaryInfo(sku: string): Promise<{ category: string; boreMm: number; brand: string }> {
  if (!sku || sku === "CUSTOM-SOLUTION" || sku === "SPECIFY") return { category: "", boreMm: 0, brand: "" };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?sku=eq.${encodeURIComponent(sku)}&select=name,categories(slug),brands(slug),specs:product_specs(key,value)`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return { category: "", boreMm: 0, brand: "" };
    const d = await res.json();
    if (!Array.isArray(d) || !d[0]) return { category: "", boreMm: 0, brand: "" };
    const specs = Object.fromEntries(((d[0].specs ?? []) as Array<{ key: string; value: unknown }>).map(s => [s.key, s.value]));
    const boreMm = firstNumAbs(specs.bore_mm) || firstNumAbs(String(d[0].name ?? "").match(/Ø\s?(\d+)/)?.[1]);
    return {
      category: d[0]?.categories?.slug ? String(d[0].categories.slug) : "",
      boreMm,
      brand: d[0]?.brands?.slug ? String(d[0].brands.slug) : "",
    };
  } catch { return { category: "", boreMm: 0, brand: "" }; }
}

async function handleBom(
  description: string, answers: Record<string, string>, primarySku: string, locale: string
): Promise<Response> {
  const t0 = Date.now();
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
  // Base isElectric on the ACTUAL chosen primary product, not the loose candidate
  // categories — a trigger like "noggrann"/"precis" can put electric-actuator into
  // the categories even when the chosen primary is a pneumatic cylinder, which then
  // wrongly built an electric drivetrain (servo drive + motor cable) for it.
  const { category: primaryCategory, boreMm: primaryBoreMm, brand: primaryBrand } = await fetchPrimaryInfo(primarySku);
  const isElectric = !isAtex && !isAtexDust && (primaryCategory
    ? ["electric-actuator", "linear-module", "servo-motor", "servo-drive"].includes(primaryCategory)
    : categories.some(c => c === "electric-actuator" || c === "linear-module"));
  const isCleanroom = /\brenrum\b|\bcleanroom\b|\bclean\s+room\b/i.test(combinedText);
  const isMultiAxis = needsMultiAxis(combinedText);
  const isVacuum = needsVacuumGrip(combinedText);
  const valveTerminal = needsValveTerminal(combinedText);
  const isWashdown = needsWashdown(combinedText);
  const isEndPosDetect = needsEndPositionDetection(combinedText);
  const isMounting = needsMounting(combinedText);
  const isArticulated = needsArticulatedMount(combinedText);
  const isRodLock = needsRodLock(combinedText) || (isVerticalLoad && needsSilSafety(combinedText));
  const massKg = extractLoadKg(combinedText, answers);
  const cycleTimeS = extractCycleTimeS(combinedText, answers);
  const isLowCost = needsLowCost(combinedText);
  const is24x7 = needsContinuousDuty(combinedText);
  const isDirtyEnv = needsDirtyEnv(combinedText);
  const minStroke = extractMinStroke(answers, description);
  const primaryIsFamilyProd = isFamilyProduct({ sku: primarySku, name: "", category: "", brand: "", key_specs: {} });

  const isPneumaticBom = !isElectric && !isAtex && !isAtexDust;
  const bomCategories = [
    ...categories,
    isVacuum                          ? "vacuum"         : null,
    valveTerminal                     ? "valve-terminal" : null,
    "sensor",
    isElectric                        ? "cable"          : "fitting",
    isElectric                        ? "servo-motor"    : null,
    isElectric                        ? "servo-drive"    : null,
    isPneumaticBom                    ? "valve"          : null,
    isPneumaticBom                    ? "frl"            : null,
    isPneumaticBom                    ? "silencer"       : null,
    isPneumaticBom                    ? "flow-control"   : null,
    isPneumaticBom                    ? "tubing"         : null,
    isPneumaticBom && isHighSpeed     ? "shock-absorber" : null,
    isPneumaticBom && isVerticalLoad  ? "check-valve"    : null,
    (isMounting || isArticulated)     ? "mounting"       : null,
    isRodLock                         ? "rod-lock"       : null,
  ].filter(Boolean) as string[];

  const [fetchedProducts, pdfCtx, brandProducts] = await Promise.all([
    fetchProducts([...new Set(bomCategories)], 30),
    searchKnowledge(combinedText + " BOM komplett system", 5),
    // Guarantee the primary's own brand+category is represented (see
    // fetchProductsByCategoryAndBrand's comment) - only actually needed for
    // categories fetchProducts' 30-cap can plausibly exclude a brand from,
    // but cheap and harmless to run generally rather than special-case it.
    fetchProductsByCategoryAndBrand(primaryCategory, primaryBrand),
  ]);
  // Merge, primary's own brand first so brandSorted's stable sort keeps it
  // there; dedupe by SKU in case fetchProducts already had some of these.
  const seenSkus = new Set<string>();
  const products: CatalogProduct[] = [];
  for (const p of [...brandProducts, ...fetchedProducts]) {
    if (seenSkus.has(p.sku)) continue;
    seenSkus.add(p.sku);
    products.push(p);
  }

  // ATEX: strip electric actuators
  const atexSafeProducts = (isAtex || isAtexDust) ? products.filter(p => !isElectricActuator(p)) : products;
  const validBomSkus = new Set(atexSafeProducts.map(p => p.sku));
  validBomSkus.add("SPECIFY");
  validBomSkus.add(primarySku);

  // ── v40: Build complete mandatory BOM deterministically ─────────────────────
  const perAxisStrokes = isMultiAxis ? extractPerAxisStrokes(answers) : [];
  // P2 sizing + P1 conflicts (first-order — guaranteed in the output below)
  const maxStroke = perAxisStrokes.length > 0 ? Math.max(...perAxisStrokes.map(a => a.stroke)) : minStroke;
  const dyn = computeDynamics(massKg, maxStroke, cycleTimeS, isVerticalLoad);
  const conflicts = detectConflicts({ locale, precisionMm, isHighPrecision, speedMs, isDirtyEnv, isWashdown, isAtexDust, isLowCost, is24x7, dyn });
  // P2 force check: does the chosen actuator's rated force cover the computed peak load?
  const ratedForceN = parseFloat(String(products.find(p => p.sku === primarySku)?.key_specs?.force_n ?? "0").replace(/[^\d.]/g, ""));
  const forceShortfall = (dyn && ratedForceN > 0 && dyn.forceN > ratedForceN)
    ? { needN: Math.round(dyn.forceN), ratedN: Math.round(ratedForceN) } : null;
  const bomCtx: BomCtx = {
    primarySku, primaryIsFamilyProd, isElectric, isAtex, isAtexDust,
    isVerticalLoad, isHighSpeed, valveTerminal, isEndPosDetect, isVacuum, locale,
    products: atexSafeProducts,
    isMounting, isArticulated, isRodLock, primaryBoreMm, primaryBrand, isHighTemp, isWashdown, isSilSafety: needsSilSafety(combinedText), isHydraulic, isVeryHighForce,
    isMultiAxis, perAxisStrokes,
  };
  const mandatoryBom = buildMandatoryBomRows(bomCtx);
  console.log(`[bom v49] primary=${primarySku} electric=${isElectric} vertical=${isVerticalLoad} highSpeed=${isHighSpeed} multiAxis=${isMultiAxis} mounting=${isMounting} mandatoryRows=${mandatoryBom.length}`);

  // ── LLM enrichment: title + explanation + optional extras ─────────────────
  const lang = langName(locale);
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
    dyn ? (isSv ? `📐 Rörelse-uppskattning: ~${dyn.accel.toFixed(1)} m/s², ~${Math.round(dyn.forceN)} N topp — säg uttryckligen att servo/motor måste dimensioneras för detta.` : `📐 Motion estimate: ~${dyn.accel.toFixed(1)} m/s², ~${Math.round(dyn.forceN)} N peak — state explicitly the servo/motor must be sized for this.`) : "",
    conflicts.length ? (isSv ? `⚠️ Kravkonflikter att nämna: ${conflicts.join(" | ")}` : `⚠️ Requirement conflicts to mention: ${conflicts.join(" | ")}`) : "",
  ].filter(Boolean).join(" ");

  // LLM only writes title + explanation — no extras, no SKU selection
  const bomSystem = `You are a senior automation engineer writing a BOM summary. All text in ${lang}.

BOM rows (already complete — do NOT modify):
${skeletonStr}

Your tasks:
1. Write a concise technical title (5-8 words) describing the system
2. Write explanation (2-3 sentences): system type, key specs, safety approach
${specialConstraints ? `\nConstraints to mention: ${specialConstraints}` : ""}

JSON: { "title": "...", "explanation": "..." }`;

  const bomUser = `Application: ${description}\nRequirements: ${reqLines || "standard"}\nPrimary: ${primarySku}${pdfCtx ? `\n\nDocs:\n${pdfCtx}` : ""}`;

  // ── Call LLM — if rate-limited, skip gracefully (mandatory BOM is already built) ──
  let raw: string | null = null;
  let wasRateLimited = false;
  try { raw = await callGroq([{ role: "system", content: bomSystem }, { role: "user", content: bomUser }], 1000, true); }
  catch (e) { if ((e as Error).message === "RATE_LIMITED") wasRateLimited = true; }

  // Parse LLM enrichment — title + explanation ONLY, no extras.
  // All SKU selection is now fully deterministic via buildMandatoryBomRows.
  let title = "";
  let explanation = "";
  if (raw) {
    try {
      const llm = JSON.parse(raw);
      title = typeof llm.title === "string" ? llm.title : "";
      explanation = typeof llm.explanation === "string" ? llm.explanation : "";
      // extras intentionally ignored — no LLM SKU selection
    } catch { /* ignore */ }
  }

  // Auto-generate title/explanation when LLM is unavailable
  if (!title) {
    title = pick(locale, {
      sv: `${isElectric ? "Elektrisk" : "Pneumatisk"}${isVerticalLoad ? " vertikal" : ""}${isMultiAxis ? " flerraxlad" : ""} aktuator — ${primarySku}`,
      en: `${isElectric ? "Electric" : "Pneumatic"}${isVerticalLoad ? " vertical" : ""}${isMultiAxis ? " multi-axis" : ""} actuator — ${primarySku}`,
      de: `${isElectric ? "Elektrischer" : "Pneumatischer"}${isVerticalLoad ? " vertikaler" : ""}${isMultiAxis ? " mehrachsiger" : ""} Aktuator — ${primarySku}`,
      es: `Actuador ${isElectric ? "eléctrico" : "neumático"}${isVerticalLoad ? " vertical" : ""}${isMultiAxis ? " multieje" : ""} — ${primarySku}`,
    });
  }
  if (!explanation) {
    explanation = pick(locale, {
      sv: `System baserat på ${primarySku}. ${isElectric ? "Elektrisk servoaxel för precision och repeterbarhet." : "Pneumatisk cylinder med komplett luftberedning (FRL + ventil)."} ${isVerticalLoad ? (isElectric ? "Bromsmotor obligatorisk för lastsäkerhet vid strömavbrott." : "Backslagsventil förhindrar lastfall vid lufttrycksförlust.") : ""}${wasRateLimited ? " [Automatgenererad — AI tillfälligt otillgänglig]" : ""}`,
      en: `System based on ${primarySku}. ${isElectric ? "Electric servo axis for precision and repeatability." : "Pneumatic cylinder with complete air preparation (FRL + valve)."} ${isVerticalLoad ? (isElectric ? "Brake motor mandatory for load safety on power loss." : "Check valve prevents load drop on air pressure loss.") : ""}${wasRateLimited ? " [Auto-generated — AI temporarily unavailable]" : ""}`,
      de: `System basierend auf ${primarySku}. ${isElectric ? "Elektrische Servoachse für Präzision und Wiederholgenauigkeit." : "Pneumatikzylinder mit vollständiger Luftaufbereitung (FRL + Ventil)."} ${isVerticalLoad ? (isElectric ? "Bremsmotor zwingend erforderlich für die Lastsicherheit bei Stromausfall." : "Das Rückschlagventil verhindert ein Absinken der Last bei Luftdruckverlust.") : ""}${wasRateLimited ? " [Automatisch generiert — KI vorübergehend nicht verfügbar]" : ""}`,
      es: `Sistema basado en ${primarySku}. ${isElectric ? "Eje servo eléctrico para precisión y repetibilidad." : "Cilindro neumático con tratamiento de aire completo (FRL + válvula)."} ${isVerticalLoad ? (isElectric ? "Motor con freno obligatorio para la seguridad de la carga ante fallo de alimentación." : "La válvula antirretorno evita la caída de la carga ante pérdida de presión de aire.") : ""}${wasRateLimited ? " [Generado automáticamente — IA temporalmente no disponible]" : ""}`,
    });
  }

  // Deterministically append sizing + conflict notes so they are GUARANTEED present
  // (even if the LLM drops them or was rate-limited). The advisor must never look
  // "complete" while ignoring the physics and the requirement conflicts.
  const engNotes: string[] = [];
  if (dyn) engNotes.push(pick(locale, {
    sv: `📐 Dimensionering (första-ordningens uppskattning): för ${cycleTimeS} s cykeltid, ${maxStroke} mm slag och ${massKg} kg → topphastighet ~${dyn.vPeak.toFixed(2)} m/s, acceleration ~${dyn.accel.toFixed(1)} m/s², toppkraft ~${Math.round(dyn.forceN)} N${isVerticalLoad ? " (inkl. gravitation)" : ""}. Verifiera vald axel/motor mot kraft, varvtal och kontinuerlig last — detta ersätter inte en full servoberäkning.`,
    en: `📐 Sizing (first-order estimate): for a ${cycleTimeS} s cycle, ${maxStroke} mm stroke and ${massKg} kg → peak velocity ~${dyn.vPeak.toFixed(2)} m/s, acceleration ~${dyn.accel.toFixed(1)} m/s², peak force ~${Math.round(dyn.forceN)} N${isVerticalLoad ? " (incl. gravity)" : ""}. Verify the chosen axis/motor for force, rpm and continuous load — this does not replace a full servo calculation.`,
    de: `📐 Dimensionierung (Schätzung erster Ordnung): für ${cycleTimeS} s Zykluszeit, ${maxStroke} mm Hub und ${massKg} kg → Spitzengeschwindigkeit ~${dyn.vPeak.toFixed(2)} m/s, Beschleunigung ~${dyn.accel.toFixed(1)} m/s², Spitzenkraft ~${Math.round(dyn.forceN)} N${isVerticalLoad ? " (inkl. Schwerkraft)" : ""}. Gewählte Achse/Motor gegen Kraft, Drehzahl und Dauerlast prüfen — dies ersetzt keine vollständige Servoberechnung.`,
    es: `📐 Dimensionamiento (estimación de primer orden): para un tiempo de ciclo de ${cycleTimeS} s, ${maxStroke} mm de carrera y ${massKg} kg → velocidad máxima ~${dyn.vPeak.toFixed(2)} m/s, aceleración ~${dyn.accel.toFixed(1)} m/s², fuerza máxima ~${Math.round(dyn.forceN)} N${isVerticalLoad ? " (incl. gravedad)" : ""}. Verifique el eje/motor elegido frente a la fuerza, las RPM y la carga continua — esto no sustituye un cálculo servo completo.`,
  }));
  if (forceShortfall) engNotes.push(pick(locale, {
    sv: `⛔ Kraftvarning: beräknad toppkraft ~${forceShortfall.needN} N överstiger vald aktuators märkkraft ~${forceShortfall.ratedN} N. Välj kraftigare axel / större borrning, sänk last/acceleration eller öka cykeltiden.`,
    en: `⛔ Force warning: computed peak force ~${forceShortfall.needN} N exceeds the chosen actuator's rated force ~${forceShortfall.ratedN} N. Pick a stronger axis / larger bore, reduce load/acceleration, or increase the cycle time.`,
    de: `⛔ Kraftwarnung: die berechnete Spitzenkraft ~${forceShortfall.needN} N übersteigt die Nennkraft ~${forceShortfall.ratedN} N des gewählten Aktuators. Stärkere Achse/größere Bohrung wählen, Last/Beschleunigung reduzieren oder die Zykluszeit erhöhen.`,
    es: `⛔ Aviso de fuerza: la fuerza máxima calculada ~${forceShortfall.needN} N supera la fuerza nominal ~${forceShortfall.ratedN} N del actuador elegido. Elija un eje más fuerte / un diámetro mayor, reduzca la carga/aceleración o aumente el tiempo de ciclo.`,
  }));
  for (const c of conflicts) engNotes.push("⚠️ " + c);
  if (engNotes.length) explanation += "\n\n" + engNotes.join("\n\n");

  // ── Extra validation pipeline (4 layers) ────────────────────────────────────

  // Final BOM = mandatory rows only (LLM no longer contributes SKUs)
  // ATEX: strip any electric SKU that might have slipped in
  const electricSKUs = new Set(products.filter(p => isElectricActuator(p)).map(p => p.sku));
  const finalBom = mandatoryBom.filter(row => {
    if (!isAtex && !isAtexDust) return true;
    if (row.sku === primarySku || row.sku === "SPECIFY") return true;
    if (electricSKUs.has(row.sku)) { console.warn(`[bom v49] ATEX stripped: ${row.sku}`); return false; }
    return true;
  });

  logAdvisorEvent("bom", {
    locale, primary_sku: primarySku, bom_rows: finalBom.length,
    rate_limited: wasRateLimited, duration_ms: Date.now() - t0,
    specify_rows: finalBom.filter(r => r.sku === "SPECIFY").length,
  }, true, wasRateLimited ? "rate_limited" : undefined);

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

// ── ACTION: vision ────────────────────────────────────────────────────────────
// Turns a customer PHOTO (their current installation / components to replace)
// into a short TEXT description that the user can edit and that flows into the
// normal pipeline. The image never picks SKUs — vision output is prose only;
// detectCategories/ranking stay deterministic (same rule as all LLM usage here).
const LLM_MODEL_VISION = "meta-llama/llama-4-scout-17b-16e-instruct";

async function handleVision(image: string, locale: string): Promise<Response> {
  const t0 = Date.now();
  // Data-URL guard: jpeg/png/webp only, ≤ ~4 MB base64 (Groq's base64 image cap).
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image ?? "");
  if (!m) return Response.json({ error: "bad_image" }, { status: 400, headers: CORS });
  if (m[2].length > 4_200_000) return Response.json({ error: "image_too_large" }, { status: 413, headers: CORS });

  const langName = locale === "sv" ? "svenska" : locale === "de" ? "Deutsch" : locale === "es" ? "español" : "English";
  const prompt =
    `Du är senior automationsingenjör hos en industridistributör. Beskriv vad som SYNS på kundens foto, som underlag för komponentval:
1. Komponenttyper du ser (pneumatisk cylinder, ventil, gripdon, elaxel, givare, FRL, slang, fästen ...).
2. Märken/texter/typskyltar som är LÄSBARA i bilden — citera exakt, gissa aldrig artikelnummer.
3. Uppskattade dimensioner bara om något i bilden ger skala.
4. Montering (fotfäste/fläns/ledat), miljö (vått/dammigt/rent) och synligt slitage eller skador.
Svara på ${langName}, 3–6 korta meningar utan rubriker eller punktlistor. Om bilden inte visar industrikomponenter: säg kort vad den visar istället. Spekulera inte bortom det synliga.`;

  const body = {
    model: LLM_MODEL_VISION, temperature: 0.2, max_tokens: 500,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: image } },
      ],
    }],
  };
  // Dedicated call (not callGroq): the fast text fallback can't see images, so a
  // 429 here retries the vision model once and then reports rate_limited honestly.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify(body),
    });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
    if (!res.ok) {
      console.error("[vision] groq", res.status, (await res.text()).slice(0, 300));
      return Response.json({ error: "vision_failed" }, { status: 502, headers: CORS });
    }
    const d = await res.json();
    const text = (d?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return Response.json({ error: "vision_failed" }, { status: 502, headers: CORS });
    logAdvisorEvent("vision", { locale, duration_ms: Date.now() - t0, chars: text.length }, true);
    return Response.json({ description: text }, { headers: CORS });
  }
  logAdvisorEvent("vision", { locale, duration_ms: Date.now() - t0, rate_limited: true }, false, "rate_limited");
  return Response.json({ error: "rate_limited" }, { status: 503, headers: CORS });
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
    if (action === "vision")    return handleVision(body.image ?? "", loc);
    return Response.json({ error: "Unknown action" }, { status: 400, headers: CORS });
  } catch (e) {
    console.error("groq-advisor error:", e);
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});

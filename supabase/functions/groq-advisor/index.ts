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
import {
  langName,
  pick,
  balancedSlice,
  sortByStrokeMatch,
  isMultiFunctionSystem,
  detectCategories,
  parseProductTempMax,
  extractRequiredMaxTemp,
  strokeLabel,
  extractMinStroke,
  extractPerAxisStrokes,
  needsMultiAxis,
  needsVacuumGrip,
  needsValveTerminal,
  needsAtex,
  needsVerticalLoad,
  needsHighTemp,
  needsLowTemp,
  isHydraulicApplication,
  needsVeryHighForce,
  needsOxygenClean,
  needsHighCycle,
  needsHighSpeed,
  needsSilSafety,
  needsOutdoor,
  needsPharmaGmp,
  detectRequestedBrands,
  needsAtexDust,
  needsBatteryDryroom,
  extractSpeedMs,
  extractPrecisionMm,
  isPneumaticByDrive,
  needsRodLock,
  needsWashdown,
  needsEndPositionDetection,
  extractExplicitBoreMm,
  needsArticulatedMount,
  isNonArticulatingActuator,
  needsMounting,
  calcMinBoreMm,
  extractLoadKg,
  extractTorqueNm,
  extractRotationDeg,
  parseTorqueFromSpecs,
  extractCycleTimeS,
  needsLowCost,
  needsContinuousDuty,
  needsDirtyEnv,
  computeDynamics,
  detectConflicts,
  detectHazards,
  type HazardFlags,
  detectEndEffectorIntent,
} from "./signals.ts";
import {
  buildCustomSolutionOption,
  findCatalogProductByType,
  findAxisActuator,
  type BomCtx,
  buildMandatoryBomRows,
  firstNumAbs,
  gripperForceN,
  gripperTypeOf,
  isGripperFamily,
} from "./bom-builder.ts";

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














// ── Safety & environment detectors ────────────────────────────────────────────



























// ── v40: Deterministic product scoring ────────────────────────────────────────














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


async function handleEndEffectorOptions(
  intent: "gripper" | "vacuum", text: string, hazards: HazardFlags, loadKg: number,
  locale: string, t0: number,
): Promise<Response> {
  const t = text.toLowerCase();
  // Found 2026-08-28 (audit): this function used to hardcode ALL 7 hazard
  // flags to false and call none of their real detectors -- the worst
  // offender of the hazard-blindness pattern found across the file (see
  // signals.ts's HazardFlags comment). Now takes the caller's already-
  // computed hazards directly: cheaper than recomputing, and structurally
  // guarantees this delegated handler can never disagree with the routing
  // decision that sent it here.
  const customCtx: HazardFlags = hazards;
  // No end-effector product in the catalog has any ESD/antistatic/conductive
  // spec field at all (checked product_specs directly) -- there's no way to
  // filter or verify an ESD-safety requirement, so say so explicitly rather
  // than silently staying quiet about a stated requirement we can't confirm.
  const esdCaveat = hazards.isEsdSafe
    ? pick(locale, {
        sv: " ⚠️ ESD-säkerhet: vi har inga ESD-/antistatiska specifikationer i katalogen för att verifiera detta — begär offert med ESD-krav specificerat.",
        en: " ⚠️ ESD safety: we have no ESD/antistatic specs in the catalog to verify this — request a quote with the ESD requirement specified.",
        de: " ⚠️ ESD-Sicherheit: wir haben keine ESD-/antistatischen Spezifikationen im Katalog, um dies zu verifizieren — Angebot mit angegebener ESD-Anforderung anfordern.",
        es: " ⚠️ Seguridad ESD: no tenemos especificaciones ESD/antiestáticas en el catálogo para verificarlo — solicite una oferta especificando el requisito ESD.",
      })
    : "";

  if (intent === "vacuum") {
    const prods = await fetchEndEffectorProducts("vacuum", 40);
    const dia = (p: CatalogProduct) => firstNumAbs(p.key_specs?.cup_diameter_mm ?? p.key_specs?.pad_diameter_mm);
    const cups = prods.filter(p => dia(p) > 0).sort((a, b) => dia(a) - dia(b));
    const ejector = prods.find(p => /eject|venturi/i.test(`${p.key_specs?.type ?? ""} ${p.name}`));
    const picks = cups.length <= 3 ? cups : [cups[0], cups[Math.floor(cups.length / 2)], cups[cups.length - 1]];
    // An explicitly stated holding force is a direct, already-usable spec --
    // use it as-is rather than reinterpreting it as a weight to reconvert
    // (see extractHoldingForceN's comment for the bug this fixes). Reads
    // hazards.holdingForceN (computed once, upstream) instead of calling
    // extractHoldingForceN(text, {}) again here -- behavior is unchanged
    // (text was already combinedText, which already folds answers in), this
    // just keeps this handler on the same single source of truth as the
    // rest of the refactor instead of a second, redundant computation.
    const explicitHoldN = hazards.holdingForceN;
    const reqN = explicitHoldN > 0 ? explicitHoldN : (loadKg > 0 ? loadKg * 9.81 * 2 : 0); // 2× safety
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
    const need = explicitHoldN > 0
      ? pick(locale, {
          sv: ` Angiven håll-kraft ≈ ${Math.round(explicitHoldN)} N — fördela på en eller flera koppar.`,
          en: ` Stated holding force ≈ ${Math.round(explicitHoldN)} N — across one or more cups.`,
          de: ` Angegebene Haltekraft ≈ ${Math.round(explicitHoldN)} N — verteilt auf einen oder mehrere Saugnäpfe.`,
          es: ` Fuerza de sujeción indicada ≈ ${Math.round(explicitHoldN)} N — repartidos entre una o más ventosas.`,
        })
      : reqN > 0
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
      sv: `Det här är ett vakuumgrepp — välj sugkopp efter håll-kraft (kopparea × vakuum), inte cylinderslag.${need}${ejNote}${esdCaveat}`,
      en: `This is a vacuum-gripping application — choose the suction cup by holding force (cup area × vacuum), not cylinder stroke.${need}${ejNote}${esdCaveat}`,
      de: `Dies ist eine Vakuumgreif-Anwendung — den Saugnapf nach Haltekraft (Napffläche × Vakuum) wählen, nicht nach Zylinderhub.${need}${ejNote}${esdCaveat}`,
      es: `Esta es una aplicación de agarre por vacío — elija la ventosa según la fuerza de sujeción (área de la ventosa × vacío), no según la carrera del cilindro.${need}${ejNote}${esdCaveat}`,
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
  // An explicitly stated grip force is a direct, already-usable spec -- use
  // it as-is rather than reinterpreting it as a weight to reconvert (see
  // extractGripForceN's comment for the bug this fixes: a stated "100N" grip
  // force was falling into extractLoadKg's generic N-to-kg fallback, then
  // getting multiplied by 100 again by the rule of thumb below -- a ~10×
  // inflated, wrong requirement derived from a number the customer already
  // gave directly). Reads hazards.gripForceN (computed once, upstream)
  // instead of calling extractGripForceN(text, {}) again here -- behavior
  // is unchanged (text was already combinedText, which already folds
  // answers in), this just keeps this handler on the same single source of
  // truth as the rest of the refactor instead of a second, redundant
  // computation.
  const explicitGripN = hazards.gripForceN;
  const reqN = explicitGripN > 0 ? explicitGripN : (loadKg > 0 ? Math.max(loadKg * 100, 20) : 0); // rule of thumb ≈ weight × 100 N
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
  const need = explicitGripN > 0
    ? pick(locale, {
        sv: ` Angiven gripkraft ≈ ${Math.round(explicitGripN)} N.`,
        en: ` Stated grip force ≈ ${Math.round(explicitGripN)} N.`,
        de: ` Angegebene Greifkraft ≈ ${Math.round(explicitGripN)} N.`,
        es: ` Fuerza de agarre indicada ≈ ${Math.round(explicitGripN)} N.`,
      })
    : reqN > 0
    ? pick(locale, {
        sv: ` För ~${loadKg} kg är en rimlig tumregel ≈ ${Math.round(reqN)} N gripkraft (≈ vikt × 100; justera för friktion och acceleration).`,
        en: ` For ~${loadKg} kg a reasonable rule of thumb is ≈ ${Math.round(reqN)} N grip force (≈ weight × 100; adjust for friction and acceleration).`,
        de: ` Für ~${loadKg} kg ist eine brauchbare Faustregel ≈ ${Math.round(reqN)} N Greifkraft (≈ Gewicht × 100; anpassen für Reibung und Beschleunigung).`,
        es: ` Para ~${loadKg} kg, una regla práctica razonable es ≈ ${Math.round(reqN)} N de fuerza de agarre (≈ peso × 100; ajustar según fricción y aceleración).`,
      })
    : "";
  const summary = pick(locale, {
    sv: `Det här är en gripapplikation — gripdon dimensioneras på gripkraft, inte cylinderslag.${need} Förslagen är ${typeLabel}.${esdCaveat}`,
    en: `This is a gripping application — grippers are sized by grip force, not cylinder stroke.${need} The options are ${typeLabel}.${esdCaveat}`,
    de: `Dies ist eine Greifanwendung — Greifer werden nach Greifkraft dimensioniert, nicht nach Zylinderhub.${need} Die Vorschläge sind ${typeLabel}.${esdCaveat}`,
    es: `Esta es una aplicación de agarre — las pinzas se dimensionan según la fuerza de agarre, no la carrera del cilindro.${need} Las opciones son ${typeLabel}.${esdCaveat}`,
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
  // Added now (PR 3/5) only to support handleEndEffectorOptions's migration --
  // this function's OWN ~25 individually-duplicated locals below are
  // deliberately left as-is for now (temporary, intentional duplication) and
  // migrated onto `hazards` in a later PR, kept separate so each PR stays
  // independently reviewable.
  const hazards = detectHazards(combinedText, answers, locale);
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

  // detectConflicts() already existed and is correct -- e.g. it flags exactly
  // "high speed + high precision" (ball screws are rpm/resonance-limited, belts
  // have backlash) -- but was only ever wired into handleBom, never here. A
  // customer who only reaches the options step (a normal, valid path: chat,
  // machine-builder's options display) never saw this engineering-conflict
  // warning at all, even on a genuinely unsafe/unrealistic combination like
  // 3 m/s + ±0.01 mm simultaneously. Found 2026-08-28 (adversarial test).
  const cycleTimeS = extractCycleTimeS(combinedText, answers);
  const isLowCost = needsLowCost(combinedText);
  const is24x7 = needsContinuousDuty(combinedText);
  const isDirtyEnv = needsDirtyEnv(combinedText);
  const optDyn = computeDynamics(loadKg, maxRequiredStroke, cycleTimeS, isVerticalLoad);
  const optConflicts = detectConflicts({
    locale, precisionMm, isHighPrecision, speedMs, isDirtyEnv, isWashdown, isAtexDust,
    isLowCost, is24x7, dyn: optDyn,
  });

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
  if (hazards.isHydraulic) {
    const options = [buildCustomSolutionOption(0, locale, 0, false, hazards)];
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
    // Found 2026-08-28 (adversarial test): this branch never calls the LLM
    // (deliberate, same "no hallucination risk" reasoning noted above) but its
    // CustomSolutionContext hardcoded every hazard flag to false regardless of
    // what the customer actually said -- an ATEX Zone 1 rotary request got a
    // generic "want a custom solution?" pitch with zero ATEX guidance, and
    // (more seriously) 3 standard, non-certified pneumatic rotary actuators
    // presented as normal ranked "options" with no safety caveat at all. No
    // rotary-actuator product in the catalog has ANY ATEX/zone spec (checked
    // product_specs directly) -- there's nothing to safely recommend from
    // stock, so an ATEX/ATEX-dust request skips the catalog picks entirely
    // and goes straight to a properly ATEX-aware custom solution, mirroring
    // how the general (non-rotary) options path already treats ATEX as
    // excluding standard catalog electric categories rather than presenting
    // them with a disclaimer.
    // isFoodGrade deliberately NOT overridden to false the way it used to be:
    // no comment ever explained why, and a food-grade rotary valve actuator
    // is a coherent real request -- no reason found to suppress it.
    const isAtexZone = hazards.isAtex || hazards.isAtexDust;
    const customCtx: HazardFlags = { ...hazards, isAtex: isAtexZone };
    const customSolution = buildCustomSolutionOption(0, locale, 0, false, customCtx) as typeof options[number];
    const finalOptions = isAtexZone ? [customSolution] : [...options, customSolution];
    const summary = isAtexZone
      ? pick(locale, {
          sv: `Ingen katalogprodukt är ATEX/zon-certifierad för rotationsaktuatorer — vi har ${picks.length} standardprodukter i lager, men ingen med dokumenterad ATEX-märkning, så vi rekommenderar dem inte för er zon. En kundspecifik, zon-certifierad rotationsaktuator krävs.`,
          en: `No catalog product is ATEX/zone-certified for rotary actuators — we stock ${picks.length} standard units, but none with documented ATEX marking, so we don't recommend them for your zone. A custom, zone-certified rotary actuator is required.`,
          de: `Kein Katalogprodukt ist ATEX-/zonenzertifiziert für Rotationsaktuatoren — wir führen ${picks.length} Standardeinheiten, aber keine mit dokumentierter ATEX-Kennzeichnung, daher empfehlen wir sie nicht für Ihre Zone. Ein kundenspezifischer, zonenzertifizierter Rotationsaktuator ist erforderlich.`,
          es: `Ningún producto de catálogo está certificado ATEX/zona para actuadores rotativos — tenemos ${picks.length} unidades estándar en stock, pero ninguna con marcado ATEX documentado, por lo que no las recomendamos para su zona. Se requiere un actuador rotativo a medida y certificado para la zona.`,
        })
      : torqueInexact
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
    logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: false, top_sku: finalOptions[0]?.sku ?? null, option_count: finalOptions.length }, true);
    return Response.json({ summary, options: finalOptions }, { headers: CORS });
  }

  // End-effector (gripper / vacuum) — the primary function is GRIPPING, not linear
  // motion. Skip for a multi-axis line or whole-system request (those own the motion
  // axes; the end-effector is then a BOM detail, not the headline recommendation).
  const endEffector = detectEndEffectorIntent(combinedText);
  if (endEffector && !isMultiAxis && !isSystemScope) {
    return await handleEndEffectorOptions(endEffector, combinedText, hazards, loadKg, locale, t0);
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
      // The LLM writes cons from the raw stroke_mm spec (the family's max, e.g.
      // 3200/4000mm) BEFORE this block runs, with no notion of "configurable at
      // order" -- so a family product got both "exact 300mm at order" (above,
      // correct) AND an LLM-authored "stroke exceeds 300mm requirement" con
      // (contradicting the note right next to it) in the same response. Strip
      // any con shaped like that stroke-mismatch complaint now that the note
      // already explains it isn't one.
      const STROKE_MISMATCH_CON = /(slagl[äa]ngd|stroke|\bhub\b|carrera).{0,25}(över|overskrider|exceed|over\b|longer|über|excede|super(?:a|ior))/i;
      opt.cons = ((opt.cons as string[] | undefined) ?? []).filter(c => !STROKE_MISMATCH_CON.test(c));
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

  // Always append CUSTOM-SOLUTION. hazards.isFoodGrade already computes the
  // exact same isPharmaGmp-OR-food-regex composition this literal used to
  // build by hand.
  finalOptions.push(buildCustomSolutionOption(maxRequiredStroke, locale, maxCatalogStroke, catalogCanHandle, hazards));

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

  const finalSummary = optConflicts.length
    ? `${summary} ` + pick(locale, {
        sv: `⚠️ Kravkonflikter att notera: ${optConflicts.join(" | ")}`,
        en: `⚠️ Requirement conflicts to note: ${optConflicts.join(" | ")}`,
        de: `⚠️ Zu beachtende Anforderungskonflikte: ${optConflicts.join(" | ")}`,
        es: `⚠️ Conflictos de requisitos a tener en cuenta: ${optConflicts.join(" | ")}`,
      })
    : summary;

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
  return Response.json({ summary: finalSummary, options: finalOptions, requirements }, { headers: CORS });
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
  const hazards = detectHazards(combinedText, answers, locale);
  // Base isElectric on the ACTUAL chosen primary product, not the loose candidate
  // categories — a trigger like "noggrann"/"precis" can put electric-actuator into
  // the categories even when the chosen primary is a pneumatic cylinder, which then
  // wrongly built an electric drivetrain (servo drive + motor cable) for it.
  const { category: primaryCategory, boreMm: primaryBoreMm, brand: primaryBrand } = await fetchPrimaryInfo(primarySku);
  const isElectric = !hazards.isAtex && !hazards.isAtexDust && (primaryCategory
    ? ["electric-actuator", "linear-module", "servo-motor", "servo-drive"].includes(primaryCategory)
    : categories.some(c => c === "electric-actuator" || c === "linear-module"));
  const primaryIsFamilyProd = isFamilyProduct({ sku: primarySku, name: "", category: "", brand: "", key_specs: {} });

  const isPneumaticBom = !isElectric && !hazards.isAtex && !hazards.isAtexDust;
  const bomCategories = [
    ...categories,
    hazards.isVacuum                          ? "vacuum"         : null,
    hazards.valveTerminal                     ? "valve-terminal" : null,
    "sensor",
    isElectric                        ? "cable"          : "fitting",
    isElectric                        ? "servo-motor"    : null,
    isElectric                        ? "servo-drive"    : null,
    isPneumaticBom                    ? "valve"          : null,
    isPneumaticBom                    ? "frl"            : null,
    isPneumaticBom                    ? "silencer"       : null,
    isPneumaticBom                    ? "flow-control"   : null,
    isPneumaticBom                    ? "tubing"         : null,
    isPneumaticBom && hazards.isHighSpeed     ? "shock-absorber" : null,
    isPneumaticBom && hazards.isVerticalLoad  ? "check-valve"    : null,
    (hazards.isMounting || hazards.isArticulated)     ? "mounting"       : null,
    hazards.isRodLock                         ? "rod-lock"       : null,
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
  const atexSafeProducts = (hazards.isAtex || hazards.isAtexDust) ? products.filter(p => !isElectricActuator(p)) : products;
  const validBomSkus = new Set(atexSafeProducts.map(p => p.sku));
  validBomSkus.add("SPECIFY");
  validBomSkus.add(primarySku);

  // ── v40: Build complete mandatory BOM deterministically ─────────────────────
  // P2 force check: does the chosen actuator's rated force cover the computed peak load?
  const ratedForceN = parseFloat(String(products.find(p => p.sku === primarySku)?.key_specs?.force_n ?? "0").replace(/[^\d.]/g, ""));
  const forceShortfall = (hazards.dynamics && ratedForceN > 0 && hazards.dynamics.forceN > ratedForceN)
    ? { needN: Math.round(hazards.dynamics.forceN), ratedN: Math.round(ratedForceN) } : null;
  const bomCtx: BomCtx = {
    ...hazards,
    primarySku, primaryIsFamilyProd, isElectric, locale,
    products: atexSafeProducts, primaryBoreMm, primaryBrand,
  };
  const mandatoryBom = buildMandatoryBomRows(bomCtx);
  console.log(`[bom v49] primary=${primarySku} electric=${isElectric} vertical=${hazards.isVerticalLoad} highSpeed=${hazards.isHighSpeed} multiAxis=${hazards.isMultiAxis} mounting=${hazards.isMounting} mandatoryRows=${mandatoryBom.length}`);

  // ── LLM enrichment: title + explanation + optional extras ─────────────────
  const lang = langName(locale);
  const axisStrokeNote = hazards.isMultiAxis && hazards.perAxisStrokes.length > 0
    ? `Per-axis strokes: ${hazards.perAxisStrokes.map(a => `${a.axis}=${a.stroke}mm`).join(", ")}.`
    : "";

  // ── Accessory catalog for LLM ─────────────────────────────────────────────
  // For multi-axis systems, include actuators; for single-axis, accessories only
  const accessoryCatalog = balancedSlice(atexSafeProducts, hazards.isMultiAxis ? 30 : 20)
    .filter(p => hazards.isMultiAxis || parseStrokeFromSpecs(p.key_specs ?? {}) === 0)
    .slice(0, hazards.isMultiAxis ? 20 : 10)
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
    .map(([k, v]) => { let l = k.replace(/_/g, " "); if (!hazards.isMultiAxis) l = l.replace(/\s*[xyz]$/i, "").trim(); return `${l}: ${v}`; })
    .join(", ");

  const specialConstraints = [
    hazards.isAtex    ? (isSv ? "⛔ ATEX Zone 1/2 — inga elektriska komponenter." : "⛔ ATEX Zone 1/2 — no electric components.") : "",
    hazards.isAtexDust ? (isSv ? "⛔ ATEX Zone 20/21/22 damm." : "⛔ ATEX Zone 20/21/22 dust.") : "",
    hazards.isHighPrecision ? (isSv ? `⛔ Precision ±${hazards.precisionMm}mm — kulskruv obligatorisk.` : `⛔ Precision ±${hazards.precisionMm}mm — ball screw mandatory.`) : "",
    hazards.isWashdown ? (isSv ? "⚠️ Washdown IP69K." : "⚠️ Washdown IP69K.") : "",
    hazards.isPharmaGmp ? (isSv ? "⚠️ GMP/FDA — 316L, PTFE, EPDM." : "⚠️ GMP/FDA — 316L, PTFE, EPDM.") : "",
    hazards.isBatteryDryroom ? (isSv ? "⛔ Dryroom — absolut Cu/Zn/Ni-förbud." : "⛔ Dryroom — Cu/Zn/Ni ban.") : "",
    hazards.isHydraulic || hazards.isVeryHighForce ? (isSv ? "⚠️ Hydraulik/hög kraft — utanför pneumatisk katalog." : "⚠️ Hydraulic/high force — outside pneumatic catalog.") : "",
    hazards.isHighTemp ? (isSv ? "⚠️ Hög temp >80°C — PTFE/FKM-tätning krävs." : "⚠️ High temp >80°C — PTFE/FKM seals required.") : "",
    hazards.isOxygenClean ? (isSv ? "⛔ Syrgasmiljö — oljefria komponenter." : "⛔ Oxygen atmosphere — oil-free only.") : "",
    hazards.isSilSafety ? (isSv ? "⚠️ SIL/PL säkerhetsfunktion — certifierad ventil krävs." : "⚠️ SIL/PL safety function — certified valve required.") : "",
    hazards.dynamics ? (isSv ? `📐 Rörelse-uppskattning: ~${hazards.dynamics.accel.toFixed(1)} m/s², ~${Math.round(hazards.dynamics.forceN)} N topp — säg uttryckligen att servo/motor måste dimensioneras för detta.` : `📐 Motion estimate: ~${hazards.dynamics.accel.toFixed(1)} m/s², ~${Math.round(hazards.dynamics.forceN)} N peak — state explicitly the servo/motor must be sized for this.`) : "",
    hazards.conflicts.length ? (isSv ? `⚠️ Kravkonflikter att nämna: ${hazards.conflicts.join(" | ")}` : `⚠️ Requirement conflicts to mention: ${hazards.conflicts.join(" | ")}`) : "",
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
      sv: `${isElectric ? "Elektrisk" : "Pneumatisk"}${hazards.isVerticalLoad ? " vertikal" : ""}${hazards.isMultiAxis ? " flerraxlad" : ""} aktuator — ${primarySku}`,
      en: `${isElectric ? "Electric" : "Pneumatic"}${hazards.isVerticalLoad ? " vertical" : ""}${hazards.isMultiAxis ? " multi-axis" : ""} actuator — ${primarySku}`,
      de: `${isElectric ? "Elektrischer" : "Pneumatischer"}${hazards.isVerticalLoad ? " vertikaler" : ""}${hazards.isMultiAxis ? " mehrachsiger" : ""} Aktuator — ${primarySku}`,
      es: `Actuador ${isElectric ? "eléctrico" : "neumático"}${hazards.isVerticalLoad ? " vertical" : ""}${hazards.isMultiAxis ? " multieje" : ""} — ${primarySku}`,
    });
  }
  if (!explanation) {
    explanation = pick(locale, {
      sv: `System baserat på ${primarySku}. ${isElectric ? "Elektrisk servoaxel för precision och repeterbarhet." : "Pneumatisk cylinder med komplett luftberedning (FRL + ventil)."} ${hazards.isVerticalLoad ? (isElectric ? "Bromsmotor obligatorisk för lastsäkerhet vid strömavbrott." : "Backslagsventil förhindrar lastfall vid lufttrycksförlust.") : ""}${wasRateLimited ? " [Automatgenererad — AI tillfälligt otillgänglig]" : ""}`,
      en: `System based on ${primarySku}. ${isElectric ? "Electric servo axis for precision and repeatability." : "Pneumatic cylinder with complete air preparation (FRL + valve)."} ${hazards.isVerticalLoad ? (isElectric ? "Brake motor mandatory for load safety on power loss." : "Check valve prevents load drop on air pressure loss.") : ""}${wasRateLimited ? " [Auto-generated — AI temporarily unavailable]" : ""}`,
      de: `System basierend auf ${primarySku}. ${isElectric ? "Elektrische Servoachse für Präzision und Wiederholgenauigkeit." : "Pneumatikzylinder mit vollständiger Luftaufbereitung (FRL + Ventil)."} ${hazards.isVerticalLoad ? (isElectric ? "Bremsmotor zwingend erforderlich für die Lastsicherheit bei Stromausfall." : "Das Rückschlagventil verhindert ein Absinken der Last bei Luftdruckverlust.") : ""}${wasRateLimited ? " [Automatisch generiert — KI vorübergehend nicht verfügbar]" : ""}`,
      es: `Sistema basado en ${primarySku}. ${isElectric ? "Eje servo eléctrico para precisión y repetibilidad." : "Cilindro neumático con tratamiento de aire completo (FRL + válvula)."} ${hazards.isVerticalLoad ? (isElectric ? "Motor con freno obligatorio para la seguridad de la carga ante fallo de alimentación." : "La válvula antirretorno evita la caída de la carga ante pérdida de presión de aire.") : ""}${wasRateLimited ? " [Generado automáticamente — IA temporalmente no disponible]" : ""}`,
    });
  }

  // Deterministically append sizing + conflict notes so they are GUARANTEED present
  // (even if the LLM drops them or was rate-limited). The advisor must never look
  // "complete" while ignoring the physics and the requirement conflicts.
  const engNotes: string[] = [];
  if (hazards.dynamics) engNotes.push(pick(locale, {
    sv: `📐 Dimensionering (första-ordningens uppskattning): för ${hazards.cycleTimeS} s cykeltid, ${hazards.requiredStrokeMm} mm slag och ${hazards.loadKg} kg → topphastighet ~${hazards.dynamics.vPeak.toFixed(2)} m/s, acceleration ~${hazards.dynamics.accel.toFixed(1)} m/s², toppkraft ~${Math.round(hazards.dynamics.forceN)} N${hazards.isVerticalLoad ? " (inkl. gravitation)" : ""}. Verifiera vald axel/motor mot kraft, varvtal och kontinuerlig last — detta ersätter inte en full servoberäkning.`,
    en: `📐 Sizing (first-order estimate): for a ${hazards.cycleTimeS} s cycle, ${hazards.requiredStrokeMm} mm stroke and ${hazards.loadKg} kg → peak velocity ~${hazards.dynamics.vPeak.toFixed(2)} m/s, acceleration ~${hazards.dynamics.accel.toFixed(1)} m/s², peak force ~${Math.round(hazards.dynamics.forceN)} N${hazards.isVerticalLoad ? " (incl. gravity)" : ""}. Verify the chosen axis/motor for force, rpm and continuous load — this does not replace a full servo calculation.`,
    de: `📐 Dimensionierung (Schätzung erster Ordnung): für ${hazards.cycleTimeS} s Zykluszeit, ${hazards.requiredStrokeMm} mm Hub und ${hazards.loadKg} kg → Spitzengeschwindigkeit ~${hazards.dynamics.vPeak.toFixed(2)} m/s, Beschleunigung ~${hazards.dynamics.accel.toFixed(1)} m/s², Spitzenkraft ~${Math.round(hazards.dynamics.forceN)} N${hazards.isVerticalLoad ? " (inkl. Schwerkraft)" : ""}. Gewählte Achse/Motor gegen Kraft, Drehzahl und Dauerlast prüfen — dies ersetzt keine vollständige Servoberechnung.`,
    es: `📐 Dimensionamiento (estimación de primer orden): para un tiempo de ciclo de ${hazards.cycleTimeS} s, ${hazards.requiredStrokeMm} mm de carrera y ${hazards.loadKg} kg → velocidad máxima ~${hazards.dynamics.vPeak.toFixed(2)} m/s, aceleración ~${hazards.dynamics.accel.toFixed(1)} m/s², fuerza máxima ~${Math.round(hazards.dynamics.forceN)} N${hazards.isVerticalLoad ? " (incl. gravedad)" : ""}. Verifique el eje/motor elegido frente a la fuerza, las RPM y la carga continua — esto no sustituye un cálculo servo completo.`,
  }));
  if (forceShortfall) engNotes.push(pick(locale, {
    sv: `⛔ Kraftvarning: beräknad toppkraft ~${forceShortfall.needN} N överstiger vald aktuators märkkraft ~${forceShortfall.ratedN} N. Välj kraftigare axel / större borrning, sänk last/acceleration eller öka cykeltiden.`,
    en: `⛔ Force warning: computed peak force ~${forceShortfall.needN} N exceeds the chosen actuator's rated force ~${forceShortfall.ratedN} N. Pick a stronger axis / larger bore, reduce load/acceleration, or increase the cycle time.`,
    de: `⛔ Kraftwarnung: die berechnete Spitzenkraft ~${forceShortfall.needN} N übersteigt die Nennkraft ~${forceShortfall.ratedN} N des gewählten Aktuators. Stärkere Achse/größere Bohrung wählen, Last/Beschleunigung reduzieren oder die Zykluszeit erhöhen.`,
    es: `⛔ Aviso de fuerza: la fuerza máxima calculada ~${forceShortfall.needN} N supera la fuerza nominal ~${forceShortfall.ratedN} N del actuador elegido. Elija un eje más fuerte / un diámetro mayor, reduzca la carga/aceleración o aumente el tiempo de ciclo.`,
  }));
  for (const c of hazards.conflicts) engNotes.push("⚠️ " + c);
  if (engNotes.length) explanation += "\n\n" + engNotes.join("\n\n");

  // ── Extra validation pipeline (4 layers) ────────────────────────────────────

  // Final BOM = mandatory rows only (LLM no longer contributes SKUs)
  // ATEX: strip any electric SKU that might have slipped in
  const electricSKUs = new Set(products.filter(p => isElectricActuator(p)).map(p => p.sku));
  const finalBom = mandatoryBom.filter(row => {
    if (!hazards.isAtex && !hazards.isAtexDust) return true;
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

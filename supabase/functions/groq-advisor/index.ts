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
const LLM_MODEL = "llama-3.3-70b-versatile";
const LLM_MODEL_FAST = "llama-3.1-8b-instant";
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
  return /\b[xyz][-_\s]?ax(el|is|e)|\bxyz\b|\b[xyz]\s*[\/-]\s*[xyz]\b|två axl|två rörel|horisontell.*vertikal|vertikal.*horisontell|pick.and.place|pick.*place|plocka.*placera|plocka.*flytta|lyfter.*flytta|flytta.*lyft|2-axl|2 axl|multi.*axl|cartesian|portalsystem|lyfter.*flyttar|lyfter.*och.*flyttar/i.test(text);
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
  isSv: boolean; precisionMm: number; isHighPrecision: boolean; speedMs: number;
  isDirtyEnv: boolean; isWashdown: boolean; isAtexDust: boolean; isLowCost: boolean;
  is24x7: boolean; dyn: { vPeak: number; accel: number; forceN: number } | null;
}): string[] {
  const { isSv } = f; const out: string[] = [];
  if (f.isHighPrecision && (f.isDirtyEnv || f.isWashdown || f.isAtexDust))
    out.push(isSv
      ? `±${f.precisionMm} mm i smutsig/våt miljö krockar — kulskruv kräver tätning/bälg och skydd mot damm/olja, annars degraderar precisionen. Kräver IP-klassad/skyddad axel (fördyrar).`
      : `±${f.precisionMm} mm in a dusty/wet environment conflicts — a ball screw needs sealing/bellows and protection or precision degrades. Requires an IP-rated/protected axis (adds cost).`);
  if (f.isHighPrecision && f.isLowCost)
    out.push(isSv
      ? `Hög precision (±${f.precisionMm} mm) och låg kostnad krockar — kulskruvsservo + styrning är dyrare än pneumatik. Prioritera ett av kraven.`
      : `High precision (±${f.precisionMm} mm) and low cost conflict — ball-screw servo + control costs more than pneumatics. Prioritise one.`);
  if (f.isHighPrecision && f.speedMs > 0.8)
    out.push(isSv
      ? `Hög hastighet (${f.speedMs} m/s) + ±${f.precisionMm} mm — kulskruv begränsas av varvtal/resonans, kuggrem av backlash. Verifiera axeln; ev. kuggrem + linjärgivare (sluten loop).`
      : `High speed (${f.speedMs} m/s) + ±${f.precisionMm} mm — ball screws are rpm/resonance-limited, belts have backlash. Verify the axis; possibly belt + linear encoder (closed loop).`);
  if (f.is24x7 && f.dyn)
    out.push(isSv
      ? `Kontinuerlig drift (24/7) vid ~${Math.round(f.dyn.forceN)} N — dimensionera för livslängd/duty cycle (L10); kulskruv och lager slits vid hög acceleration.`
      : `Continuous duty (24/7) at ~${Math.round(f.dyn.forceN)} N — size for service life/duty cycle (L10); ball screw and bearings wear under high acceleration.`);
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
  isSv: boolean;
  products: CatalogProduct[];
  // Accessory flags — drive deterministic accessory rows
  isMounting: boolean;
  isArticulated: boolean;
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
          isVerticalLoad, isHighSpeed, valveTerminal, isEndPosDetect, isSv, products,
          isMounting, isArticulated, isHighTemp, isWashdown, isSilSafety, isHydraulic, isVeryHighForce,
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
  const famNote = primaryIsFamilyProd ? (isSv
    ? " ⚠️ Produktfamilj — ange komplett beställningskod (bore + stroke + varianter) vid order."
    : " ⚠️ Product family — specify full ordering code (bore + stroke + variants) when ordering.")
    : "";
  rows.push({
    sku: primarySku, quantity: 1,
    role: (isSv ? "Primär aktuator" : "Primary actuator")
      + (primaryAxisLabel ? (isSv ? ` — ${primaryAxisLabel}-axel` : ` — ${primaryAxisLabel}-axis`) : ""),
    reason: (isSv ? "Vald primär aktuator" : "Selected primary actuator") + famNote,
  });

  // Prefer the primary's brand when picking motor/drive/secondary axis, so e.g. an
  // SMC axis gets an SMC drive rather than a Festo one. Same-brand sorted to front.
  const primaryBrand = (products.find(p => p.sku === primarySku)?.brand ?? "").toLowerCase();
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
          ? (isSv ? "Bromsmotor (vertikal säkerhet)" : "Brake motor (vertical safety)")
          : (isSv ? (stepperMotor ? "Stegmotor" : "Servomotor") : (stepperMotor ? "Stepper motor" : "Servo motor")),
        reason: `${motorMatch!.name} (${motorMatch!.brand}) — ` + (isVerticalLoad
          ? (isSv
              ? "OBLIGATORISK för vertikal elektrisk axel — beställ med integrerad hållbroms som håller lasten vid strömavbrott/nödstopp."
              : "MANDATORY for a vertical electric axis — order with integrated holding brake to keep the load on power loss/E-stop.")
          : (isSv
              ? "Driver axeln — matcha moment/varvtal mot lasten; samma märke som axel och drivare."
              : "Drives the axis — match torque/speed to the load; same brand as the axis and drive.")),
      });
    } else if (isVerticalLoad) {
      // Integrated-motor actuator (e.g. SMC LE-series) — the holding brake is an
      // ORDER OPTION on the actuator, not a separate (foreign-brand) motor.
      rows[0].reason += isSv
        ? " Beställ med integrerad hållbroms (bromsoption) för vertikal säkerhet — håller lasten vid strömavbrott."
        : " Order with the integrated holding-brake option for vertical safety — holds the load on power loss.";
    }
  }

  // ── 2b. Servo drive / amplifier (all electric axes) ──────────────
  if (isElectric) {
    const driveMatch = findCatalogProductByType("servo-drive", brandSorted);
    const sameBrandDrive = !!driveMatch && !!primaryBrand && driveMatch.brand?.toLowerCase() === primaryBrand;
    const bU = primaryBrand ? primaryBrand.toUpperCase() : "";
    const stepperDrive = !!driveMatch && /steg|stepper/i.test(`${driveMatch.name} ${driveMatch.sku}`);
    rows.push({
      sku: sameBrandDrive ? driveMatch!.sku : "SPECIFY", quantity: 1,
      role: isSv ? (stepperDrive ? "Stegmotordrivare (drivsteg)" : "Servodrivare (drivsteg)")
                 : (stepperDrive ? "Stepper drive (driver)" : "Servo drive (amplifier)"),
      reason: sameBrandDrive
        ? `${driveMatch!.name} (${driveMatch!.brand}). ` + (isSv
            ? "Driver och styr motorn — matcha effekt/spänning mot axeln; ange styrgränssnitt (step/dir eller fältbuss)."
            : "Drives and controls the motor — match power/voltage to the axis; specify control interface (step/dir or fieldbus).")
        : (isSv
            ? `Specificera kompatibel drivare för ${bU ? bU + "-" : ""}axeln — vi har ingen ${bU}-drivare i katalogen ännu, begär offert.`
            : `Specify a compatible drive for the ${bU ? bU + " " : ""}axis — no ${bU} drive in the catalogue yet, request a quote.`),
    });
  }

  // ── 3. Check valve (vertical pneumatic) ──────────────────────────
  if (isVerticalLoad && isPneumatic) {
    const cvMatch = findCatalogProductByType("check-valve", products);
    rows.push({
      sku: cvMatch?.sku ?? "SPECIFY", quantity: 1,
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

  // ── 4b. Silencer + one-way flow control (all pneumatic) ──────────
  if (isPneumatic) {
    const silMatch = findCatalogProductByType("silencer", products);
    rows.push({
      sku: silMatch?.sku ?? "SPECIFY", quantity: valveTerminal ? 1 : 2,
      role: isSv ? "Ljuddämpare (avluftning)" : "Silencer (exhaust)",
      reason: isSv
        ? "OBLIGATORISK på ventilens avluftningsportar (3/5) — sänker ljudnivån och skyddar mot smuts. En per avluftningsport (2 st för en 5/2-ventil); vid ventilramp räcker en central enhet."
        : "MANDATORY on the valve exhaust ports (3/5) — cuts noise and keeps dirt out. One per exhaust port (2 for a 5/2 valve); one central unit suffices on a manifold.",
    });
    const fcMatch = findCatalogProductByType("flow-control", products);
    rows.push({
      sku: fcMatch?.sku ?? "SPECIFY", quantity: 2,
      role: isSv ? "Strypbackventil (hastighetsreglering)" : "One-way flow control (speed)",
      reason: isSv
        ? "OBLIGATORISK för att ställa cylinderns hastighet — 2 st strypbackventiler (meter-out) på cylinderns portar ger jämn, kontrollerad rörelse fram och åter."
        : "MANDATORY to set cylinder speed — 2 one-way flow-control valves (meter-out) on the cylinder ports give smooth, controlled extend/retract.",
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
    const saMatch = findCatalogProductByType("shock-absorber", products);
    rows.push({
      sku: saMatch?.sku ?? "SPECIFY", quantity: 2,
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

  // ── 8. Push-in fitting (all pneumatic) ───────────────────────────
  if (isPneumatic) {
    const fittingMatch = findCatalogProductByType("fitting", products);
    if (fittingMatch) {
      rows.push({
        sku: fittingMatch.sku, quantity: 4,
        role: isSv ? "Snabbkoppling (push-in fitting)" : "Push-in fitting",
        reason: isSv
          ? "Ansluter cylinder och ventil till luftslang — välj diameter (6/8/10 mm) för rätt slanganslutning till cylinderns G-port."
          : "Connects cylinder and valve to air tubing — select diameter (6/8/10 mm) matching cylinder G-port.",
      });
    }
  }

  // ── 8b. Tubing (all pneumatic) ───────────────────────────────────
  if (isPneumatic) {
    const tubeMatch = findCatalogProductByType("tubing", products);
    if (tubeMatch) {
      rows.push({
        sku: tubeMatch.sku, quantity: 1,
        role: isSv ? "Tryckluftsslang (per meter)" : "Pneumatic tubing (per metre)",
        reason: isSv
          ? "Förbinder ventil, FRL och cylinder — välj ytterdiameter (6/8/10 mm) och längd efter installationen. Anges per meter."
          : "Connects valve, FRL and cylinder — select outer diameter (6/8/10 mm) and length per the installation. Sold per metre.",
      });
    }
  }

  // ── 9. Motor cable (electric) ─────────────────────────────────────
  if (isElectric) {
    const cableMatch = findCatalogProductByType("cable", products);
    if (cableMatch) {
      rows.push({
        sku: cableMatch.sku, quantity: 1,
        role: isSv ? "Motorkabel" : "Motor cable",
        reason: isSv
          ? "Anslutningskabel till drivenheten — välj längd och kontakttyp kompatibel med vald motor och drivare."
          : "Connection cable to the drive — select length and connector type compatible with the chosen motor and drive.",
      });
    }
  }

  // ── 10. Mounting (when requested) — must MATCH the primary's bore ─────────
  // A mounting whose bore differs from the cylinder physically does not fit. We
  // only emit a real SKU when its bore equals the primary's; otherwise SPECIFY
  // with the required Ø called out (recommend, never force a mismatched part).
  if (isMounting || isArticulated) {
    const primary = products.find(p => p.sku === primarySku);
    const pBore = firstNumAbs(primary?.key_specs?.bore_mm) ||
                  firstNumAbs((primary?.name ?? "").match(/Ø\s?(\d+)/)?.[1]);
    const boreTxt = pBore > 0 ? `Ø${pBore}` : (isSv ? "cylinderns borrning" : "the cylinder's bore");
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
        role: isSv ? "Svängfläns/ledlager (bakgavel)" : "Rear swivel/pivot flange",
        reason: swivel
          ? (isSv
              ? `${swivel.name} — matchar cylinderns borrning (${boreTxt}). Tillåter cylindern att vinkla sig under slaget; ISO 15552-fäste.`
              : `${swivel.name} — matches the cylinder bore (${boreTxt}). Lets the cylinder pivot during the stroke; ISO 15552 mount.`)
          : (isSv
              ? `Ange svängfläns/ledlager i ${boreTxt} — vi saknar ${boreTxt}-varianten i lager; fästet MÅSTE matcha cylinderns borrning.`
              : `Specify a rear swivel/pivot flange in ${boreTxt} — no ${boreTxt} variant in stock; the mount MUST match the cylinder bore.`),
      });
      rows.push({
        sku: clevis?.sku ?? "SPECIFY", quantity: 1,
        role: isSv ? "Gaffelfäste (kolvstångsände)" : "Rod clevis (rod end)",
        reason: clevis
          ? (isSv
              ? `${clevis.name} — matchar kolvstångsgängan för ${boreTxt}-cylindern. Bildar ledad infästning tillsammans med svängflänsen.`
              : `${clevis.name} — matches the rod thread of the ${boreTxt} cylinder. Forms the articulated linkage together with the swivel flange.`)
          : (isSv
              ? `Ange gaffelfäste i ${boreTxt} — vi saknar ${boreTxt}-varianten i lager; gaffeln MÅSTE matcha kolvstångsgängan.`
              : `Specify a rod clevis in ${boreTxt} — no ${boreTxt} variant in stock; the clevis MUST match the rod thread.`),
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
        role: isSv ? "Monteringsfäste (fotfäste/flänsfäste)" : "Mounting bracket (foot/flange mount)",
        reason: mount
          ? (isSv
              ? `${mount.name} — matchar cylinderns borrning (${boreTxt}). Kontrollera hålavstånd mot ritning.`
              : `${mount.name} — matches the cylinder bore (${boreTxt}). Verify hole pattern against drawing.`)
          : (isSv
              ? `Ange fotfäste/flänsfäste i ${boreTxt} — vi saknar ${boreTxt}-varianten i lager; fästet MÅSTE matcha cylinderns borrning och serie.`
              : `Specify a foot/flange mount in ${boreTxt} — no ${boreTxt} variant in stock; the mount MUST match the cylinder bore and series.`),
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
        role: isSv ? `Aktuator — ${axLabel}-axel` : `Actuator — ${axLabel}-axis`,
        reason: axMatch
          ? (isSv
              ? `${ax.stroke > 0 ? ax.stroke + " mm slag — " : ""}${axMatch.name} (${axMatch.brand}). Samma drivtyp/spänning som primäraxeln; konfigurera slaglängd och fäste för ${axLabel}-axeln.`
              : `${ax.stroke > 0 ? ax.stroke + " mm stroke — " : ""}${axMatch.name} (${axMatch.brand}). Same drive type/voltage as the primary axis; configure stroke and mounting for the ${axLabel}-axis.`)
          : (isSv
              ? `Ingen exakt katalogmatch för ${axLabel}-axeln (${ax.stroke > 0 ? ax.stroke + " mm" : "okänt slag"}) — begär offert så specar vi rätt ${isElectric ? "elektrisk axel" : "cylinder"} (gissa inte ihop en lösning).`
              : `No exact catalog match for the ${axLabel}-axis (${ax.stroke > 0 ? ax.stroke + " mm" : "unknown stroke"}) — request a quote and we'll spec the right ${isElectric ? "electric axis" : "cylinder"} (do not guess a solution).`),
      });
    }
  }

  // ── 9. Washdown / food-grade IP69K warning ───────────────────────
  if (isWashdown) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: isSv ? "⚠️ Washdown IP69K — korrosionsbeständigt material" : "⚠️ Washdown IP69K — corrosion-resistant materials",
      reason: isSv
        ? "KRAV IP69K: Cylinder, ventil och givare måste ha IP69K-klassning och korrosionsbeständigt material (316L rostfritt stål eller ytbehandlad aluminium). Specificera variant -H1 (food-grade smörjning) vid livsmedelsproduktion."
        : "REQUIRED IP69K: Cylinder, valve and sensor must be IP69K-rated with corrosion-resistant materials (316L stainless or coated aluminium). Specify -H1 variant (food-grade lubrication) for food production.",
    });
  }

  // ── 10. High-temperature warning (>80°C) ─────────────────────────
  if (isHighTemp) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: isSv ? "⚠️ Tätningsmaterial — hög temperatur >80°C" : "⚠️ Sealing material — high temperature >80°C",
      reason: isSv
        ? "KRAV: PTFE- eller FKM-tätningar obligatoriska vid >80°C — standard-NBR-tätningar degraderar och läcker. Beställ cylinder med high-temp tätningssats eller PTFE-variant."
        : "MANDATORY: PTFE or FKM seals required above 80°C — standard NBR seals degrade and leak. Order cylinder with high-temp seal kit or PTFE variant.",
    });
  }

  // ── 10. SIL/functional-safety certified valve ─────────────────────
  if (isSilSafety) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: isSv ? "⚠️ Säkerhetscertifierad magnetventil SIL/PLd" : "⚠️ Safety-certified solenoid valve SIL/PLd",
      reason: isSv
        ? "KRAV SIL 2 / PLd (ISO 13849): säkerhetscertifierad magnetventil med redundant styrsignal och diagnosfunktion krävs (t.ex. Festo VOFD-DT, SMC VFS). Standard-ventil är EJ tillräcklig."
        : "REQUIRED SIL 2 / PLd (ISO 13849): safety-certified solenoid valve with redundant control and diagnostic function (e.g. Festo VOFD-DT, SMC VFS). Standard valve is NOT sufficient.",
    });
  }

  // ── 11. Hydraulic / very-high-force out-of-scope warning ──────────
  if (isHydraulic || isVeryHighForce) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: isSv ? "⚠️ Varning: utanför pneumatisk katalog" : "⚠️ Warning: outside pneumatic catalog",
      reason: isSv
        ? "UTANFÖR KATALOG: Hydrauliska cylindrar och kraft >5 kN hanteras ej av pneumatisk katalog. Kontakta hydraulikspecialist (Parker, Bosch Rexroth, Enerpac). Pneumatisk katalog täcker max ~2 kN vid 6 bar."
        : "OUT OF SCOPE: Hydraulic cylinders and force >5 kN are outside the pneumatic catalog. Contact hydraulic specialist (Parker, Bosch Rexroth, Enerpac). Pneumatic catalog covers max ~2 kN at 6 bar.",
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
      role: isSv ? "ATEX-magnetventil (zon-certifierad)" : "ATEX solenoid valve (zone-certified)",
      reason: isSv
        ? "OBLIGATORISK styrventil för ATEX-zon — använd ATEX/IECEx-certifierad ventil (t.ex. Festo VOFC/tryckluftsstyrd) eller montera standardventil UTANFÖR zonen och dra slang in. Standardkatalogventiler är EJ zon-godkända."
        : "MANDATORY control valve for ATEX zone — use an ATEX/IECEx-certified valve (e.g. Festo VOFC / air-piloted) or mount a standard valve OUTSIDE the zone with tubing in. Standard catalog valves are NOT zone-rated.",
    });
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: isSv ? "ATEX-luftberedning (FRL utanför zon)" : "ATEX air preparation (FRL outside zone)",
      reason: isSv
        ? "OBLIGATORISK luftberedning — placera FRL-enheten utanför den klassade zonen. Använd antistatisk slang och jordning av cylinder/rör per EN 80079-36."
        : "MANDATORY air preparation — locate the FRL outside the classified zone. Use antistatic tubing and ground the cylinder/piping per EN 80079-36.",
    });
    // Vertical ATEX still needs an anti-drop device. It can't be electric (forbidden
    // in the zone) and the standard check-valve row is gated on isPneumatic (which
    // excludes ATEX), so add an explicit ATEX-rated load-holding row here.
    if (isVerticalLoad) {
      rows.push({
        sku: "SPECIFY", quantity: 1,
        role: isSv ? "ATEX-fallspärr (pilotbackventil / mekanisk stångbroms)" : "ATEX anti-drop (pilot check valve / mechanical rod lock)",
        reason: isSv
          ? "OBLIGATORISK vid vertikal last i ATEX-zon — förhindrar lastfall vid lufttrycksförlust. Använd ATEX/IECEx-klassad pilotmanövrerad backslagsventil eller mekanisk stångbroms. Elektrisk bromsmotor är EJ tillåten i zonen."
          : "MANDATORY for vertical load in an ATEX zone — prevents load drop on air loss. Use an ATEX/IECEx-rated pilot-operated check valve or mechanical rod lock. An electric brake motor is NOT permitted in the zone.",
      });
    }
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: isSv ? "⚠️ ATEX: alla komponenter zon-certifierade + jordade" : "⚠️ ATEX: all components zone-certified + grounded",
      reason: isSv
        ? "KRAV ATEX/IECEx: cylinder, givare, ventil och tillbehör måste vara märkta för aktuell zon/gasgrupp/temperaturklass. Inga standard-24V-givare utan ATEX-godkännande. Verifiera ekvipotential jordning och dokumentera enligt direktiv 2014/34/EU."
        : "ATEX/IECEx REQUIREMENT: cylinder, sensors, valve and accessories must be marked for the zone/gas group/temperature class. No standard 24 V sensors without ATEX approval. Verify equipotential grounding and document per Directive 2014/34/EU.",
    });
  }

  return rows;
}

// ── ACTION: questions ─────────────────────────────────────────────────────────
async function handleQuestions(description: string, locale: string): Promise<Response> {
  const t0 = Date.now();
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
  isSv: boolean, locale: string, t0: number,
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
        badge: (isSv ? ["Liten kopp", "Mellan", "Stor kopp"] : ["Small cup", "Medium", "Large cup"])[i] ?? "",
        bore_mm: null, stroke_mm: null, force_n: holdN || null,
        why: isSv
          ? `Sugkopp Ø${d} mm, uppskattad håll-kraft ≈ ${holdN} N/kopp vid ~-0,6 bar. ${mat}Verifiera mot ytans täthet och säkerhetsfaktor.`
          : `Suction cup Ø${d} mm, est. holding force ≈ ${holdN} N/cup at ~-0.6 bar. ${mat}Verify against surface tightness and safety factor.`,
        pros: isSv ? ["Skonsam mot känsliga/plana ytor", "Snabb on/off via ejektor"] : ["Gentle on delicate/flat surfaces", "Fast on/off via ejector"],
        cons: isSv ? ["Kräver tät, plan yta", "Lägg till ejektor + vakuumvakt"] : ["Needs a tight, flat surface", "Add an ejector + vacuum switch"],
      };
    });
    const need = reqN > 0
      ? (isSv ? ` För ~${loadKg} kg krävs ≈ ${Math.round(reqN)} N håll-kraft (2× säkerhet) — fördela på en eller flera koppar.`
              : ` For ~${loadKg} kg you need ≈ ${Math.round(reqN)} N holding force (2× safety) — across one or more cups.`)
      : "";
    const ejNote = ejector
      ? (isSv ? ` Lägg till en Venturi-ejektor (t.ex. ${ejector.name}) för att skapa vakuumet.` : ` Add a Venturi ejector (e.g. ${ejector.name}) to generate the vacuum.`)
      : "";
    const summary = isSv
      ? `Det här är ett vakuumgrepp — välj sugkopp efter håll-kraft (kopparea × vakuum), inte cylinderslag.${need}${ejNote}`
      : `This is a vacuum-gripping application — choose the suction cup by holding force (cup area × vacuum), not cylinder stroke.${need}${ejNote}`;
    if (!options.length) options.push(buildCustomSolutionOption(0, isSv, 0, false, customCtx) as Record<string, unknown>);
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
    const gt = p.key_specs?.gripper_type ?? (isSv ? "Gripdon" : "Gripper");
    return {
      sku: p.sku, name: p.name,
      badge: (isSv ? ["Rätt storlek", "Marginal", "Reserv (mer kraft)"] : ["Right size", "Tighter", "Reserve (more force)"])[i] ?? "",
      bore_mm: firstNumAbs(p.key_specs?.bore_mm) || null,
      stroke_mm: null,
      force_n: fN || null,
      why: isSv
        ? `${gt}${fN ? `, gripkraft ≈ ${fN} N` : ""}${jaw ? `, backslag ${jaw} mm/sida` : ""}. Dimensioneras på gripkraft mot detaljens vikt och friktion.`
        : `${gt}${fN ? `, grip force ≈ ${fN} N` : ""}${jaw ? `, jaw stroke ${jaw} mm/side` : ""}. Sized by grip force vs. part weight and friction.`,
      pros: isSv ? ["Pneumatiskt, enkel styrning", "Lägesgivare för grepp-kontroll"] : ["Pneumatic, simple control", "Position sensing for grip confirmation"],
      cons: isSv ? ["Verifiera gripkraft mot friktionskoefficient", "Backar/fingrar specas separat"] : ["Verify grip force vs. friction", "Jaws/fingers specified separately"],
    };
  });
  const typeLabel = isSv
    ? ({ parallel: "parallellgripdon", angular: "vinkelgripdon", radial: "radial-/3-backsgripdon" } as Record<string, string>)[wantType]
    : ({ parallel: "parallel grippers", angular: "angle grippers", radial: "radial / 3-jaw grippers" } as Record<string, string>)[wantType];
  const need = reqN > 0
    ? (isSv ? ` För ~${loadKg} kg är en rimlig tumregel ≈ ${Math.round(reqN)} N gripkraft (≈ vikt × 100; justera för friktion och acceleration).`
            : ` For ~${loadKg} kg a reasonable rule of thumb is ≈ ${Math.round(reqN)} N grip force (≈ weight × 100; adjust for friction and acceleration).`)
    : "";
  const summary = isSv
    ? `Det här är en gripapplikation — gripdon dimensioneras på gripkraft, inte cylinderslag.${need} Förslagen är ${typeLabel}.`
    : `This is a gripping application — grippers are sized by grip force, not cylinder stroke.${need} The options are ${typeLabel}.`;
  if (!options.length) options.push(buildCustomSolutionOption(0, isSv, 0, false, customCtx) as Record<string, unknown>);
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
  const isSv = locale === "sv";
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
      badge: i === 0 ? (isSv ? "Minsta" : "Smallest")
        : i === picks.length - 1 ? (isSv ? "Störst kapacitet" : "Highest capacity") : "",
      bore_mm: null,
      stroke_mm: Number(String(p.key_specs?.stroke_mm ?? "").replace(/[^\d.]/g, "")) || null,
      force_n: null,
      why: isSv
        ? `Justerbar hydraulisk stötdämpare ${String(p.key_specs?.sizes ?? "")}. Dimensioneras efter energi per slag — verifiera mot databladets energikapacitet.`
        : `Adjustable hydraulic shock absorber ${String(p.key_specs?.sizes ?? "")}. Sized by energy per cycle — verify against the datasheet's energy capacity.`,
      pros: isSv ? ["Justerbar dämpning", "Mjuk inbromsning som skyddar mekaniken"]
        : ["Adjustable damping", "Smooth deceleration that protects the mechanics"],
      cons: isSv ? ["Välj storlek efter energikapacitet (Nm/slag) i databladet"]
        : ["Choose size by the energy capacity (Nm/cycle) in the datasheet"],
    }));
    const eNote = energyJ > 0
      ? (isSv ? ` Beräknad rörelseenergi ≈ ${energyJ.toFixed(1)} J/slag (½·${loadKg} kg·(${speedMs} m/s)²).`
              : ` Estimated kinetic energy ≈ ${energyJ.toFixed(1)} J/cycle (½·${loadKg} kg·(${speedMs} m/s)²).`)
      : "";
    const summary = isSv
      ? `Det här är en stötdämpar-applikation — en cylinder bromsar inte en rullande massa, det gör en stötdämpare.${eNote} Välj storlek (M8–M20) efter dämparens energikapacitet per slag (se datablad).`
      : `This is a shock-absorber application — a cylinder won't stop a rolling mass, a shock absorber does.${eNote} Pick a size (M8–M20) by the absorber's energy capacity per cycle (see datasheet).`;
    logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: false, top_sku: options[0]?.sku ?? null, option_count: options.length }, true);
    return Response.json({ summary, options }, { headers: CORS });
  }
  // End-effector (gripper / vacuum) — the primary function is GRIPPING, not linear
  // motion. Skip for a multi-axis line or whole-system request (those own the motion
  // axes; the end-effector is then a BOM detail, not the headline recommendation).
  const endEffector = detectEndEffectorIntent(combinedText);
  if (endEffector && !isMultiAxis && !isSystemScope) {
    return await handleEndEffectorOptions(endEffector, combinedText, loadKg, isSv, locale, t0);
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
  const washdownFiltered = isWashdown ? atexFiltered.filter(p => isWashdownProduct(p)) : atexFiltered;
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
  const scoringCtx: ScoringCtx = { requiredStroke: maxRequiredStroke, minBoreMm, isHighPrecision, isHighSpeed, isVertical: isVerticalLoad, isWashdown, isAtex };
  const topProducts = rankActuators(catalogProducts, scoringCtx).slice(0, 3);

  // Build server-side option objects (correct data, LLM fills in text)
  const lang = isSv ? "svenska" : "English";

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
    return {
      sku: p.sku, name: p.name,
      badge: i === 0 && isSystemScope
        ? (isSv ? "Byggblock – rörelsedel" : "Building block – motion")
        : i === 0 && boreInexact
        ? (isSv ? "Närmaste — överdimensionerad" : "Closest — oversized")
        : (isSv ? ["Bästa valet","Kompakt alternativ","Budgetalternativ"][i] : ["Best choice","Compact option","Budget option"][i]),
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
2. "why" = engineering justification (mechanism, stroke fit, safety, material) — be specific, mention numbers
3. pros: 2-3 items, cons: 1-2 items
Do NOT output a badge field — badges are assigned server-side and must not be set by you.

JSON: { "summary": "1-2 sentences: mechanism + safety", "options": [ { "sku": "EXACT_SKU", "why": "...", "pros": [...], "cons": [...] } ] }`;

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
    // Family / configurable product: never present it as a silent exact match.
    // Tiering already keeps it below concrete matches; here we label it clearly so
    // the user knows the exact stroke is chosen at order (not a fixed stock SKU).
    const isConfigurable = isFamilyProduct(cat) || actualMax === 0;
    const tooShort = maxRequiredStroke > 0 && actualMax > 0 && actualMax < maxRequiredStroke;
    if (isConfigurable && !tooShort) {
      opt.badge = isSv ? "Konfigurera slag vid order" : "Configure stroke at order";
      const note = isSv
        ? `🔧 Produktfamilj/serie — exakt slaglängd${maxRequiredStroke > 0 ? ` (${maxRequiredStroke} mm)` : ""} väljs vid beställning${actualMax > 0 ? `; serien täcker upp till ${actualMax} mm` : ""}.`
        : `🔧 Product family/series — exact stroke${maxRequiredStroke > 0 ? ` (${maxRequiredStroke} mm)` : ""} is selected at order${actualMax > 0 ? `; the series covers up to ${actualMax} mm` : ""}.`;
      opt.why = `${note} ${opt.why ?? ""}`.trim();
    }
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
    ? (isSv
        ? "Den här kombinationen av krav ligger utanför vårt standardsortiment — ingen katalogprodukt klarar den säkert. Vi föreslår en kundspecifik lösning; kontakta oss så tar vi fram ett förslag."
        : "This combination of requirements is outside our standard range — no catalog product meets it safely. We propose a custom-engineered solution; contact us and we'll work one out.")
    : isSystemScope
    ? (isSv
        ? `Det här är ett flerstegssystem på linjenivå (detektera → stoppa/centrera → väga → identifiera → sortera till flera banor), inte en enskild komponent. Vårt sortiment täcker rörelse- och hanteringsdelen — pneumatiska aktuatorer för stopp, centrering och sortering samt sensorik — och förslagen nedan är byggblock för just den delen. Vägning (lastceller), identifiering (vision/streckkodsläsare), robot och PLC-styrning ligger utanför vårt komponentsortiment och kräver systemintegration. För kapacitet (t.ex. 30 st/min utan köbildning), buffring, cykeltid och komplett linjedesign tar våra ingenjörer helheten — kontakta oss för projektering.`
        : `This is a line-level multi-stage system (detect → stop/center → weigh → identify → sort to several lanes), not a single component. Our range covers the motion and handling part — pneumatic actuators for stopping, centering and sorting plus sensing — and the options below are building blocks for that part only. Weighing (load cells), identification (vision/barcode readers), robotics and PLC control are outside our component range and need system integration. For throughput (e.g. 30 units/min without queueing), buffering, cycle time and full line design our engineers take the whole — contact us for project engineering.`)
    : isMultiAxis
    ? (isSv
        ? `Det här är ett fleraxligt system${axesNote} — det behöver en separat axel per riktning, inte en enda aktuator. Se förslagen nedan som en axel i taget och kombinera dem i maskinbyggaren, där varje rörelse dimensioneras för sig.`
        : `This is a multi-axis system${axesNote} — it needs a separate axis per direction, not a single actuator. Treat the suggestions below as one axis at a time and combine them in the machine builder, where each motion is sized individually.`)
    : boreInexact
    ? (isSv
        ? `Vi har ingen lagervara i exakt rätt storlek för det här — ${topProducts[0].name} är närmaste (något överdimensionerad) och klarar kraven tekniskt. Se den som en rekommendation; för exakt mått väljer du en konfigurerbar variant (beställs i rätt borrning och slag) eller en kundspecifik lösning.`
        : `We don't stock an exact-size match for this — ${topProducts[0].name} is the closest (slightly oversized) and meets the requirements technically. Treat it as a recommendation; for an exact fit choose a configurable variant (ordered to the right bore and stroke) or a custom solution.`)
    : (llmSummary || (isSv
        ? `${topProducts.length} alternativ valda baserat på krav${maxRequiredStroke > 0 ? ` (slag ${maxRequiredStroke} mm)` : ""}.`
        : `${topProducts.length} options selected for ${maxRequiredStroke > 0 ? `${maxRequiredStroke} mm stroke` : "this application"}.`));

  if (optRateLimited) {
    logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: true, top_sku: topProducts[0]?.sku ?? null }, false, "rate_limited");
    return Response.json({ error: "rate_limited" }, { status: 503, headers: CORS });
  }
  logAdvisorEvent("options", { locale, duration_ms: Date.now() - t0, rate_limited: false, top_sku: finalOptions[0]?.sku ?? null, option_count: finalOptions.length }, true);
  return Response.json({ summary, options: finalOptions }, { headers: CORS });
}

// ── ACTION: bom (v40) ─────────────────────────────────────────────────────────
// v40: Mandatory BOM is built deterministically BEFORE calling LLM.
// If LLM is rate-limited, the BOM skeleton is returned as-is — never an empty BOM.
// Fetch just the chosen primary's category, so the BOM matches the ACTUAL product
// (pneumatic vs electric) rather than loose candidate-category triggers.
async function fetchPrimaryCategory(sku: string): Promise<string> {
  if (!sku || sku === "CUSTOM-SOLUTION" || sku === "SPECIFY") return "";
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?sku=eq.${encodeURIComponent(sku)}&select=categories(slug)`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return "";
    const d = await res.json();
    return Array.isArray(d) && d[0]?.categories?.slug ? String(d[0].categories.slug) : "";
  } catch { return ""; }
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
  const primaryCategory = await fetchPrimaryCategory(primarySku);
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
  const perAxisStrokes = isMultiAxis ? extractPerAxisStrokes(answers) : [];
  // P2 sizing + P1 conflicts (first-order — guaranteed in the output below)
  const maxStroke = perAxisStrokes.length > 0 ? Math.max(...perAxisStrokes.map(a => a.stroke)) : minStroke;
  const dyn = computeDynamics(massKg, maxStroke, cycleTimeS, isVerticalLoad);
  const conflicts = detectConflicts({ isSv, precisionMm, isHighPrecision, speedMs, isDirtyEnv, isWashdown, isAtexDust, isLowCost, is24x7, dyn });
  // P2 force check: does the chosen actuator's rated force cover the computed peak load?
  const ratedForceN = parseFloat(String(products.find(p => p.sku === primarySku)?.key_specs?.force_n ?? "0").replace(/[^\d.]/g, ""));
  const forceShortfall = (dyn && ratedForceN > 0 && dyn.forceN > ratedForceN)
    ? { needN: Math.round(dyn.forceN), ratedN: Math.round(ratedForceN) } : null;
  const bomCtx: BomCtx = {
    primarySku, primaryIsFamilyProd, isElectric, isAtex, isAtexDust,
    isVerticalLoad, isHighSpeed, valveTerminal, isEndPosDetect, isVacuum, isSv,
    products: atexSafeProducts,
    isMounting, isArticulated, isHighTemp, isWashdown, isSilSafety: needsSilSafety(combinedText), isHydraulic, isVeryHighForce,
    isMultiAxis, perAxisStrokes,
  };
  const mandatoryBom = buildMandatoryBomRows(bomCtx);
  console.log(`[bom v49] primary=${primarySku} electric=${isElectric} vertical=${isVerticalLoad} highSpeed=${isHighSpeed} multiAxis=${isMultiAxis} mounting=${isMounting} mandatoryRows=${mandatoryBom.length}`);

  // ── LLM enrichment: title + explanation + optional extras ─────────────────
  const lang = isSv ? "svenska" : "English";
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
    title = isSv
      ? `${isElectric ? "Elektrisk" : "Pneumatisk"}${isVerticalLoad ? " vertikal" : ""}${isMultiAxis ? " flerraxlad" : ""} aktuator — ${primarySku}`
      : `${isElectric ? "Electric" : "Pneumatic"}${isVerticalLoad ? " vertical" : ""}${isMultiAxis ? " multi-axis" : ""} actuator — ${primarySku}`;
  }
  if (!explanation) {
    explanation = isSv
      ? `System baserat på ${primarySku}. ${isElectric ? "Elektrisk servoaxel för precision och repeterbarhet." : "Pneumatisk cylinder med komplett luftberedning (FRL + ventil)."} ${isVerticalLoad ? (isElectric ? "Bromsmotor obligatorisk för lastsäkerhet vid strömavbrott." : "Backslagsventil förhindrar lastfall vid lufttrycksförlust.") : ""}${wasRateLimited ? " [Automatgenererad — AI tillfälligt otillgänglig]" : ""}`
      : `System based on ${primarySku}. ${isElectric ? "Electric servo axis for precision and repeatability." : "Pneumatic cylinder with complete air preparation (FRL + valve)."} ${isVerticalLoad ? (isElectric ? "Brake motor mandatory for load safety on power loss." : "Check valve prevents load drop on air pressure loss.") : ""}${wasRateLimited ? " [Auto-generated — AI temporarily unavailable]" : ""}`;
  }

  // Deterministically append sizing + conflict notes so they are GUARANTEED present
  // (even if the LLM drops them or was rate-limited). The advisor must never look
  // "complete" while ignoring the physics and the requirement conflicts.
  const engNotes: string[] = [];
  if (dyn) engNotes.push(isSv
    ? `📐 Dimensionering (första-ordningens uppskattning): för ${cycleTimeS} s cykeltid, ${maxStroke} mm slag och ${massKg} kg → topphastighet ~${dyn.vPeak.toFixed(2)} m/s, acceleration ~${dyn.accel.toFixed(1)} m/s², toppkraft ~${Math.round(dyn.forceN)} N${isVerticalLoad ? " (inkl. gravitation)" : ""}. Verifiera vald axel/motor mot kraft, varvtal och kontinuerlig last — detta ersätter inte en full servoberäkning.`
    : `📐 Sizing (first-order estimate): for a ${cycleTimeS} s cycle, ${maxStroke} mm stroke and ${massKg} kg → peak velocity ~${dyn.vPeak.toFixed(2)} m/s, acceleration ~${dyn.accel.toFixed(1)} m/s², peak force ~${Math.round(dyn.forceN)} N${isVerticalLoad ? " (incl. gravity)" : ""}. Verify the chosen axis/motor for force, rpm and continuous load — this does not replace a full servo calculation.`);
  if (forceShortfall) engNotes.push(isSv
    ? `⛔ Kraftvarning: beräknad toppkraft ~${forceShortfall.needN} N överstiger vald aktuators märkkraft ~${forceShortfall.ratedN} N. Välj kraftigare axel / större borrning, sänk last/acceleration eller öka cykeltiden.`
    : `⛔ Force warning: computed peak force ~${forceShortfall.needN} N exceeds the chosen actuator's rated force ~${forceShortfall.ratedN} N. Pick a stronger axis / larger bore, reduce load/acceleration, or increase the cycle time.`);
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

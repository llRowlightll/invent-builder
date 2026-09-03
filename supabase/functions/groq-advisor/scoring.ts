// ─────────────────────────────────────────────────────────────────────────────
// scoring.ts — product classification, scoring and ranking (pure, no I/O).
//
// Extracted from index.ts so the deterministic ranking logic can be unit-tested
// (see scoring.test.ts) without starting the Deno.serve HTTP entrypoint.
// Nothing here performs network or env access — keep it that way.
//
// v51 — Stroke-qualification hardening:
//   • isAccessory(): distinguishes genuine accessories (sensors/fittings/valves)
//     from STROKELESS ACTUATOR FAMILIES (a cylinder/electric series sold across a
//     stroke RANGE). The old code treated "no parseable stroke" as "harmless
//     accessory", which let a strokeless cylinder family bypass the precision /
//     pneumatic / washdown gates and silently qualify for ANY required stroke.
//   • rankActuators(): tiers candidates so a configurable family NEVER outranks a
//     concrete-stroke product that meets the requirement; families are surfaced
//     but clearly below concrete matches (labelled "configure stroke at order" by
//     the caller).
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogProduct {
  sku: string; name: string; category: string; brand: string;
  key_specs: Record<string, unknown>; purchase_price?: number;
}

export interface ScoringCtx {
  requiredStroke: number;
  minBoreMm: number;       // minimum bore from load calculation (0 = unknown)
  isHighPrecision: boolean;
  isHighSpeed: boolean;
  isVertical: boolean;
  isWashdown: boolean;
  isAtex: boolean;
  // Brand names the customer explicitly asked for (already lowercased), e.g.
  // ["festo", "smc"] from "jag vill ha exempel för festo och smc". A soft
  // preference, not a filter — a customer's stated brand is a commercial
  // choice, not a physical/safety requirement, so it must never be able to
  // push out the only product that actually fits (unlike e.g. isAtex, which
  // hard-excludes). Absent/empty = no preference, scoring unaffected.
  preferredBrands?: string[];
}

/** Catalog categories whose products ARE primary linear/rotary actuators.
 *  Anything else (sensor, fitting, valve, frl, cable, mounting, vacuum, gripper,
 *  shock-absorber, check-valve, valve-terminal …) is a support item. */
const ACTUATOR_CATEGORIES = new Set([
  "cylinder", "electric-actuator", "linear-module", "rotary-actuator",
]);

/**
 * True for non-actuator catalog items (sensors, fittings, valves, FRL, cables,
 * mountings, grippers, vacuum). These legitimately have no stroke and must
 * bypass actuator-suitability filters (precision / pneumatic / washdown).
 *
 * IMPORTANT: a strokeless CYLINDER / actuator-category product is NOT an
 * accessory — it is a configurable product FAMILY and must still be gated.
 */
export function isAccessory(p: CatalogProduct): boolean {
  return !ACTUATOR_CATEGORIES.has(p.category);
}

/**
 * v38: Normalize raw key_specs from the RPC into consistent keys:
 *   stroke_mm (numeric string), bore_mm (numeric string), force_n (numeric string).
 * Also computes force_n from bore_mm × 6 bar if missing.
 * Sets is_family=true when product covers a range (stroke_range) rather than a fixed value.
 */
export function normalizeKeySpecs(raw: Record<string, unknown>): Record<string, unknown> {
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
  // Canonical output key: bore_mm. For a FAMILY (comma list or range), use the MAX
  // bore for adequacy — the series can be ordered at any bore up to its max, so a
  // big-bore family (e.g. stainless DSBF Ø32–125) must qualify for high-load jobs.
  // Mirrors how stroke uses the max of its range; taking the min wrongly excluded
  // big-bore families from loads they can actually carry.
  if (!out.bore_mm) {
    for (const k of ["bore_diameter_mm", "bore_diameter"]) {
      if (raw[k] != null) { out.bore_mm = raw[k]; delete out[k]; break; }
    }
  }
  if (!out.bore_mm && raw.bore_range) { out.bore_mm = raw.bore_range; }
  if (typeof out.bore_mm === "string") {
    const nums = (out.bore_mm.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => parseFloat(s.replace(",", ".")));
    if (nums.length > 1) { out.bore_mm = Math.max(...nums) + " mm"; out.is_family = true; }
    else if (nums.length === 1) { out.bore_mm = nums[0] + " mm"; }
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
export function isFamilyProduct(p: CatalogProduct): boolean {
  if (p.key_specs?.is_family) return true;
  // SKU pattern: FESTO-*, SMC-*, PARKER-*, NORGREN-* (family placeholders)
  if (/^(FESTO|SMC|PARKER|NORGREN|CAMOZZI|METAL[-_]WORK|BOSCH)-/i.test(p.sku)) return true;
  return false;
}

export function parseStrokeFromSpecs(specs: Record<string, unknown>): number {
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

/** Returns true if a product is ball-screw driven (not belt or direct linear motor). */
export function isBallScrewProduct(p: CatalogProduct): boolean {
  const s = (p.name + " " + p.sku + " " + JSON.stringify(p.key_specs ?? {})).toLowerCase();
  return /\begsk\b|\bkulskruv\b|\bball\s*screw\b|\bspindel\b|\bspindle\b|\blead\s*screw\b|\bleadscrew\b/i.test(s);
}

/** Returns true if a product is belt-driven (not ball screw, not pneumatic). */
export function isBeltDrivenProduct(p: CatalogProduct): boolean {
  const s = (p.name + " " + p.sku + " " + JSON.stringify(p.key_specs ?? {})).toLowerCase();
  return /\bkuggrem\b|\btiming[\s-]?belt\b|\bsynchronous[\s-]?belt\b|\belgc[-.]?tb\b|\begsc\b|\belt[-\s]driv/i.test(s);
}

/** Returns true if a product is a pneumatic cylinder (actuator) — NOT an electric axis. */
export function isPneumaticActuatorProduct(p: CatalogProduct): boolean {
  // Genuine accessories (sensors/fittings) are neither pneumatic nor electric actuators.
  // A strokeless cylinder FAMILY, however, IS a pneumatic actuator and must be gated.
  if (isAccessory(p)) return false;
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
export function isAllowedForHighPrecision(p: CatalogProduct): boolean {
  if (isAccessory(p)) return true; // sensors/fittings always included
  if (!isElectricActuator(p)) return false; // no pneumatics (repeatability too poor)
  if (isBeltDrivenProduct(p)) return false; // no belt (backlash too high)
  return true; // electric ball screw / spindle / linear motor only
}

/**
 * Alias kept for backward compat — same logic, used for vertical+precision specifically.
 */
export function isAllowedForPrecisionVertical(p: CatalogProduct): boolean {
  return isAllowedForHighPrecision(p);
}

/**
 * HIGH-SPEED RULE (v34): if speed > 0.8 m/s AND no precision constraint,
 * ball-screw drives are excluded (vibration, wear, resonance above ~800 mm/s).
 * Only applies when precision is NOT the limiting factor (if precision ≤ 0.1mm,
 * ball screw may still be needed despite high speed).
 * Returns true if product is ALLOWED for high-speed, low-precision application.
 */
export function isAllowedForHighSpeed(p: CatalogProduct): boolean {
  if (isAccessory(p)) return true;
  if (!isElectricActuator(p)) return true; // pneumatic at high speed = fine (add cushions)
  if (isBallScrewProduct(p)) return false; // ball screw resonates / wears above 800 mm/s
  return true; // belt drive, linear motor = ideal for high speed
}

/** Returns true if a product is an electric actuator/motor/drive — forbidden in ATEX zones. */
export function isElectricActuator(p: CatalogProduct): boolean {
  const name = (p.name + " " + p.brand).toLowerCase();
  return (
    p.category === "electric-actuator" ||
    p.category === "linear-module" ||
    /\begsk\b|\belgc\b|\belga\b|\blesh\b|\blefs\b|\bosp[-.]?e\b|\bhmr\b|\blbb\b|\bhlr\b/i.test(name) ||
    /servo|stepper|ball.screw|kuggrem|electric.*axis|linjärmodul.*el|eldriven/i.test(name)
  );
}

/**
 * Detects whether a product has a documented ATEX-rated variant. Found
 * 2026-09-03 (adversarial test): a Zone 1 ATEX request was ranking ANY
 * pneumatic product (not excluded for being electric) as "Bästa valet",
 * with the ATEX mismatch buried in a small cons bullet -- the general
 * options path's own comment claims ATEX is a hard physical/material
 * filter (same tier as washdown/precision/bore), but the actual filter
 * only ever excluded electric actuators, never checked ATEX certification
 * at all. Checked directly against the DB before fixing (not assumed):
 * the catalog is NOT entirely ATEX-blank -- FESTO-DSBF and PARKER-ETH both
 * carry "ATEX variant"/"ATEX available" in special_features, unlike every
 * other product. Matches on that field (and the name, for consistency with
 * isWashdownProduct's pattern) rather than hard-excluding the whole catalog
 * the way isPureRotary does for its category, which currently has zero
 * ATEX-capable products at all.
 */
export function isAtexCapableProduct(p: CatalogProduct): boolean {
  const blob = `${p.key_specs?.special_features ?? ""} ${p.name}`.toLowerCase();
  return /\batex\b|\biecex\b/.test(blob);
}

/**
 * Detects whether a product is suitable for washdown environments.
 * These applications require IP67/IP69K and stainless or food-grade plastic —
 * standard aluminum cylinders will corrode immediately.
 */
export function isWashdownProduct(p: CatalogProduct): boolean {
  const ip = String(p.key_specs?.ip_rating ?? "").toLowerCase();
  const name = (p.name + " " + p.brand).toLowerCase();
  // Genuine support items (sensors, fittings) are included regardless of stroke.
  if (isAccessory(p)) return true;
  return (
    ip.includes("ip67") || ip.includes("ip69") ||
    name.includes("stainless") || name.includes("rostfri") ||
    name.includes("corrosion") || name.includes("crdsnu") ||
    name.includes("clean design") || name.includes("cleandesign") ||
    name.includes("serie 90") || name.includes("washdown") ||
    name.includes("food grade") || name.includes("hygienic")
  );
}

/**
 * v40: Score a catalog product 0–100 for ranking (deterministic, no LLM).
 * Higher = better match for the application requirements.
 */
export function scoreProduct(p: CatalogProduct, ctx: ScoringCtx): number {
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

  // ── Bore adequacy (±40 points) — HARD physical requirement ──────
  if (ctx.minBoreMm > 0) {
    const boreMm = parseFloat(String(p.key_specs?.bore_mm ?? "0"));
    if (boreMm > 0) {
      if (boreMm >= ctx.minBoreMm) {
        // Prefer closest adequate bore (avoid wildly oversized)
        const oversize = (boreMm - ctx.minBoreMm) / ctx.minBoreMm;
        score += Math.max(0, 20 - oversize * 30); // 20pts at exact, 0 at 67%+
      } else {
        score -= 40; // bore too small for load — hard penalty
      }
    }
  } else {
    // No load info: nothing anchors the bore, and on tie-noise a Ø200 "large
    // bore" can become "Bästa valet" for a dosing nozzle (chemical-line test).
    // Mild preference peaking at Ø40 — typical unspecified applications live in
    // Ø20–63 — weak enough that any real signal (washdown, stroke) overrides it.
    const boreMm = parseFloat(String(p.key_specs?.bore_mm ?? "0"));
    if (boreMm > 0) score += Math.max(0, 10 - Math.abs(boreMm - 40) * 0.15);
  }

  // ── Requested brand (+18 points) — soft preference, never a filter ──
  // Found 2026-08-18: a customer asked the machine-builder for "examples
  // from Festo and SMC" and got a different brand back — nothing in the
  // ranking had ever looked at brand at all. +18 is enough to move a
  // requested-brand product ahead of a same-tier non-requested one on
  // ordinary stroke/bore ties, but not enough to override a real physical
  // mismatch (stroke-below-requirement is -30, bore-too-small is -40) —
  // a requested brand that doesn't fit still loses to one that does.
  if (ctx.preferredBrands?.length && ctx.preferredBrands.includes(p.brand.toLowerCase())) {
    score += 18;
  }

  // ── Penalties ────────────────────────────────────────────────────
  if (isFamilyProduct(p))    score -= 5;
  const price = p.purchase_price ?? 9999;
  if (price < 150) score += 4;
  else if (price < 400) score += 2;

  return score;
}

/**
 * Tier a candidate for the options list (lower = shown first):
 *   0  concrete stroke that MEETS the requirement        → the ideal pick
 *   1  configurable family that can cover the requirement → "configure stroke at order"
 *   2  configurable family, requirement unconfirmed (no stroke at all)
 *   3  concrete stroke BELOW the requirement              → closest fallback
 *
 * A product is "configurable" when it has no concrete stroke OR is flagged a family.
 */
export function actuatorTier(p: CatalogProduct, requiredStroke: number): number {
  const stroke = parseStrokeFromSpecs(p.key_specs ?? {});
  const configurable = stroke === 0 || isFamilyProduct(p);
  const meets = requiredStroke === 0 || (stroke > 0 && stroke >= requiredStroke);
  if (meets && !configurable) return 0;
  if (meets && configurable)  return 1;
  if (configurable)           return 2;
  return 3;
}

/**
 * Rank actuator candidates for the options list.
 *
 * The tiering is the guardrail that stops a configurable "family" product (a
 * series sold across a stroke RANGE, with no single concrete stroke) from
 * silently outranking a real, orderable product. Within a tier, scoreProduct()
 * decides the order.
 *
 * Invariant (regression-tested in scoring.test.ts): a strokeless/family product
 * NEVER outranks a concrete-stroke product that meets the requirement.
 *
 * Note: products with no concrete stroke are only eligible when there is no
 * stroke requirement (requiredStroke === 0); when a stroke is required they are
 * filtered out so they can never be presented as a confirmed match.
 */
export function rankActuators(candidates: CatalogProduct[], ctx: ScoringCtx): CatalogProduct[] {
  const req = ctx.requiredStroke;
  return candidates
    .filter((p) => parseStrokeFromSpecs(p.key_specs ?? {}) > 0 || req === 0)
    .map((p) => ({ p, tier: actuatorTier(p, req), s: scoreProduct(p, ctx) }))
    .sort((a, b) => (a.tier - b.tier) || (b.s - a.s))
    .map((x) => x.p);
}

// Regression tests for the deterministic stroke-qualification / ranking logic.
// Run: deno test supabase/functions/groq-advisor/scoring.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  type CatalogProduct,
  type ScoringCtx,
  normalizeKeySpecs,
  parseStrokeFromSpecs,
  isFamilyProduct,
  isAccessory,
  isPneumaticActuatorProduct,
  isAllowedForHighPrecision,
  scoreProduct,
  rankActuators,
} from "./scoring.ts";

function prod(
  sku: string,
  category: string,
  brand: string,
  specs: Record<string, unknown> = {},
): CatalogProduct {
  return { sku, name: sku, category, brand, key_specs: normalizeKeySpecs(specs) };
}

const ctx = (over: Partial<ScoringCtx> = {}): ScoringCtx => ({
  requiredStroke: 0, minBoreMm: 0, isHighPrecision: false, isHighSpeed: false,
  isVertical: false, isWashdown: false, isAtex: false, ...over,
});

// ── The core invariant ────────────────────────────────────────────────────────

Deno.test("strokeless family never outranks a concrete product that meets the requirement (stroke required)", () => {
  const concrete = prod("0822040200", "cylinder", "bosch-rexroth", { stroke_mm: "200 mm", bore_mm: "40 mm" });
  const strokelessFamily = prod("SMC-CQ2", "cylinder", "smc", { bore_diameter_mm: "12,16,20,25,32 mm" });
  const ranked = rankActuators([strokelessFamily, concrete], ctx({ requiredStroke: 150 }));
  assertEquals(ranked[0].sku, "0822040200");
});

Deno.test("with NO stroke requirement, a strokeless family still ranks below a concrete product", () => {
  const concrete = prod("0822040200", "cylinder", "bosch-rexroth", { stroke_mm: "200 mm" });
  const strokeless = prod("MW-RNDC", "cylinder", "metal-work", {}); // no stroke at all
  const ranked = rankActuators([strokeless, concrete], ctx({ requiredStroke: 0 }));
  assertEquals(ranked[0].sku, "0822040200");
  assert(ranked.indexOf(strokeless) > ranked.indexOf(concrete));
});

Deno.test("a data-fixed family (stroke_range) ranks below an equal concrete product", () => {
  const family = prod("SMC-CQ2", "cylinder", "smc", { stroke_range: "5-100" }); // → stroke_mm=100, is_family=true
  assert(isFamilyProduct(family), "stroke_range must flip is_family on");
  assertEquals(parseStrokeFromSpecs(family.key_specs), 100);
  const concrete = prod("CDQ2B25-100DZ", "cylinder", "smc", { stroke_mm: "100 mm" });
  const ranked = rankActuators([family, concrete], ctx({ requiredStroke: 80 }));
  assertEquals(ranked[0].sku, "CDQ2B25-100DZ"); // both reach 100mm, but concrete (tier 0) beats family (tier 1)
});

// ── The precision-escape hole (the reported "MW-S as Bästa valet" bug) ──────────

Deno.test("a strokeless pneumatic cylinder is treated as pneumatic, not as a harmless accessory", () => {
  const strokelessPneu = prod("MW-MINI-25", "cylinder", "metal-work", {}); // strokeless cylinder family
  assert(!isAccessory(strokelessPneu), "a cylinder is an actuator, not an accessory");
  assert(isPneumaticActuatorProduct(strokelessPneu), "strokeless cylinder must still count as pneumatic");
  assert(!isAllowedForHighPrecision(strokelessPneu), "pneumatic must be excluded from a high-precision job");
});

Deno.test("genuine accessory (sensor) is still treated as an accessory", () => {
  const sensor = prod("FE-SME", "sensor", "festo", {});
  assert(isAccessory(sensor));
  assert(isAllowedForHighPrecision(sensor), "accessories pass the precision gate");
  assert(!isPneumaticActuatorProduct(sensor));
});

Deno.test("electric ball-screw beats a strokeless pneumatic on a high-precision job", () => {
  const c = ctx({ requiredStroke: 0, isHighPrecision: true });
  const strokelessPneu = prod("MW-MINI-25", "cylinder", "metal-work", {});
  const ballScrew = prod("EGSK-33-200-LR", "electric-actuator", "festo", { stroke_mm: "200 mm" });
  assert(
    scoreProduct(ballScrew, c) > scoreProduct(strokelessPneu, c),
    "ball screw must outscore strokeless pneumatic on a precision job",
  );
  assertEquals(rankActuators([strokelessPneu, ballScrew], c)[0].sku, "EGSK-33-200-LR");
});

// ── Behaviour preserved: concrete winner for a normal stroke job (mirrors T01) ──

Deno.test("concrete product that meets the requirement is the top pick (T01-style)", () => {
  const candidates = [
    prod("KPZ-025-0050-A", "cylinder", "camozzi", { stroke_mm: "50 mm", bore_mm: "25 mm" }),
    prod("0822040200", "cylinder", "bosch-rexroth", { stroke_mm: "200 mm", bore_mm: "40 mm" }),
    prod("SMC-CQ2", "cylinder", "smc", { bore_diameter_mm: "32 mm" }), // strokeless family
  ];
  const ranked = rankActuators(candidates, ctx({ requiredStroke: 200 }));
  assertEquals(ranked[0].sku, "0822040200");
});

// ── Requested brand: soft preference, never overrides a physical mismatch ──────
// Reported 2026-08-18: customer asked the machine-builder for "examples from
// Festo and SMC" and got a different brand back — nothing in the ranking had
// ever looked at brand at all.

Deno.test("requested brand breaks a tie between two otherwise-equal candidates", () => {
  const festo = prod("DSNU-40-200-P-A", "cylinder", "Festo", { stroke_mm: "200 mm", bore_mm: "40 mm" });
  const camozzi = prod("KPZ-040-0200-A", "cylinder", "Camozzi", { stroke_mm: "200 mm", bore_mm: "40 mm" });
  // Identical stroke/bore, neither SKU trips the family-prefix heuristic ⇒ a true tie without a brand preference.
  assertEquals(scoreProduct(festo, ctx({ requiredStroke: 200 })), scoreProduct(camozzi, ctx({ requiredStroke: 200 })));
  const withPref = rankActuators([camozzi, festo], ctx({ requiredStroke: 200, preferredBrands: ["festo"] }));
  assertEquals(withPref[0].sku, "DSNU-40-200-P-A", "requested brand should win the tie");
});

Deno.test("requested brand does NOT override a real stroke mismatch", () => {
  const smcTooShort = prod("CDQ2B40-100DZ", "cylinder", "SMC", { stroke_mm: "100 mm", bore_mm: "40 mm" }); // below requirement
  const festoFits = prod("DSNU-40-200-P-A", "cylinder", "Festo", { stroke_mm: "200 mm", bore_mm: "40 mm" });
  const ranked = rankActuators([smcTooShort, festoFits], ctx({ requiredStroke: 200, preferredBrands: ["smc"] }));
  assertEquals(ranked[0].sku, "DSNU-40-200-P-A", "a requested brand that doesn't physically fit must still lose");
});

// ── Bore adequacy: a family's bore RANGE uses the MAX, not the min ──────────────

Deno.test("bore range/list normalizes to the MAX bore (family can cover high loads)", () => {
  const dsbf = prod("FESTO-DSBF", "cylinder", "festo", { bore_range: "32–125", stroke_mm: "500 mm" });
  assertEquals(parseFloat(String(dsbf.key_specs.bore_mm)), 125); // max, not 32
  assertEquals(dsbf.key_specs.is_family, true);
  const cq2 = prod("SMC-CQ2", "cylinder", "smc", { bore_diameter_mm: "12,16,20,25,32,40,50,63,80,100,125,160,200 mm" });
  assertEquals(parseFloat(String(cq2.key_specs.bore_mm)), 200); // max of the list
  const concrete = prod("0822040200", "cylinder", "bosch-rexroth", { bore_mm: "40 mm" });
  assertEquals(parseFloat(String(concrete.key_specs.bore_mm)), 40); // single value unchanged, not a family
  assertEquals(concrete.key_specs.is_family, undefined);
});

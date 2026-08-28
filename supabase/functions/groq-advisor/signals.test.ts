// Regression tests for pure text/spec extraction and hazard-detection helpers.
// Run: deno test supabase/functions/groq-advisor/signals.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { extractGripForceN, extractHoldingForceN, extractLoadKg, needsEsdSafe } from "./signals.ts";

// ── Explicit force statements must not round-trip through extractLoadKg ────────
// Found 2026-08-27 (adversarial test): "greppkraft ca 100N" was matched by
// extractLoadKg's generic N-fallback (100 / 9.81 = 10.19... kg), then the
// gripper-sizing rule of thumb (weight × 100) re-derived ≈1019N -- a ~10×
// inflated, wrong requirement computed from a number the customer already
// gave directly as the grip force itself.

Deno.test("extractGripForceN reads an explicit Swedish grip-force statement directly", () => {
  assertEquals(extractGripForceN("Pneumatisk parallellgripare, greppkraft ca 100N", {}), 100);
});

Deno.test("extractGripForceN reads an explicit English grip-force statement directly", () => {
  assertEquals(extractGripForceN("Parallel gripper, grip force approx 150N", {}), 150);
});

Deno.test("extractGripForceN returns 0 (no false match) when no grip-force keyword is present", () => {
  // A bare Newton value with no grip-force keyword nearby must NOT be treated
  // as a grip force -- that's extractLoadKg's job (weight-derived sizing),
  // a different code path entirely.
  assertEquals(extractGripForceN("Lyfter en detalj som väger 500N", {}), 0);
});

Deno.test("a stated grip force and extractLoadKg's generic N-fallback disagree on the same text (documents the bug this fix routes around)", () => {
  const text = "Pneumatisk parallellgripare, greppkraft ca 100N";
  assertEquals(extractGripForceN(text, {}), 100); // the correct, direct reading
  assertEquals(Math.round(extractLoadKg(text, {}) * 100), 1019); // the wrong reinterpretation the caller must NOT use here
});

Deno.test("extractHoldingForceN reads an explicit Swedish holding-force statement directly", () => {
  assertEquals(extractHoldingForceN("Vakuumgrepp för plåtdetaljer, hållkraft 50N", {}), 50);
});

Deno.test("extractHoldingForceN reads an explicit English holding-force statement directly", () => {
  assertEquals(extractHoldingForceN("Vacuum pickup, holding force 80N", {}), 80);
});

Deno.test("extractHoldingForceN returns 0 when no holding-force keyword is present", () => {
  assertEquals(extractHoldingForceN("Lyfter en glasskiva som väger 5kg", {}), 0);
});

// ── ESD-safety requirement detection ────────────────────────────────────────
// Found 2026-08-28 (adversarial test): a stated ESD-safety requirement was
// silently ignored for vacuum/gripper end-effector selection -- the catalog
// has no ESD/antistatic spec field on any product, so there was no way to
// verify it, but nothing said so either.

Deno.test("needsEsdSafe detects an explicit Swedish ESD requirement", () => {
  assertEquals(needsEsdSafe("Vakuumgrepp för PCB, ESD-säkert material krävs"), true);
});

Deno.test("needsEsdSafe detects an explicit English ESD requirement", () => {
  assertEquals(needsEsdSafe("Gripper for PCB handling, must be ESD safe"), true);
});

Deno.test("needsEsdSafe returns false when nothing ESD-related is mentioned", () => {
  assertEquals(needsEsdSafe("Vakuumgrepp för att lyfta en glasskiva, hållkraft 50N"), false);
});

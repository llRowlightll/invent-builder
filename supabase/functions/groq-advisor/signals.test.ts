// Regression tests for pure text/spec extraction and hazard-detection helpers.
// Run: deno test supabase/functions/groq-advisor/signals.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  extractGripForceN, extractHoldingForceN, extractLoadKg, needsEsdSafe,
  detectHazards, needsFoodGrade,
  theoreticalForceN, usableForceN, requiredForceN,
  SEAL_EFFICIENCY, LOAD_SAFETY_FACTOR,
  isMultiFunctionSystem, needsMultiAxis, needsVacuumGrip, needsValveTerminal,
  needsAtex, needsAtexDust, needsVerticalLoad, needsHighTemp, needsLowTemp,
  isHydraulicApplication, needsVeryHighForce, needsOxygenClean, needsHighCycle,
  needsHighSpeed, needsSilSafety, needsOutdoor, needsPharmaGmp, needsBatteryDryroom,
  needsRodLock, needsGuidance, needsWashdown, needsEndPositionDetection, needsArticulatedMount,
  needsMounting, needsLowCost, needsContinuousDuty, needsDirtyEnv,
  extractRequiredMaxTemp, extractMinStroke, extractPerAxisStrokes, extractSpeedMs,
  extractPrecisionMm, extractExplicitBoreMm, calcMinBoreMm, extractTorqueNm,
  extractRotationDeg, extractCycleTimeS, computeDynamics, detectConflicts,
  extractUnitCount, detectEndEffectorIntent, endEffectorExplicitlyAsked, parseRotationFromSpecs,
} from "./signals.ts";

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

// Found 2026-09-03 (adversarial test): the keyword ("greppkraft") lives in
// the answer KEY, not the value, when a structured question puts the label
// there -- e.g. answers: {"greppkraft": "150N"}. The old
// `Object.values(answers).join(" ")` join only ever saw "150N", never the
// key, so the keyword-requiring regex above never matched: extractGripForceN
// returned 0, "150N" fell through to extractLoadKg's generic N-to-kg
// fallback (150/9.81 ≈ 15.29 "kg"), and the gripper rule-of-thumb (weight ×
// 100) re-inflated that into a fabricated ≈1529 N requirement -- presented
// confidently, with no disclaimer, live in production. Fixed by joining
// key+value (matching extractCycleTimeS's pre-existing pattern) across every
// affected extractor in this file, not just this one.
Deno.test("extractGripForceN reads a grip force stated via the answer KEY, not just inline in the value", () => {
  assertEquals(extractGripForceN("Parallellgripdon för metalldetalj", { greppkraft: "150N" }), 150);
});

Deno.test("extractGripForceN via an answer key does NOT leak into extractLoadKg's generic N-fallback", () => {
  const text = "Parallellgripdon för metalldetalj";
  const answers = { greppkraft: "150N" };
  assertEquals(extractGripForceN(text, answers), 150);
  // Before the fix this was 15.29 (150/9.81) -- a fabricated "weight" derived
  // from a force the customer already stated directly.
  assertEquals(Math.round(extractLoadKg(text, answers)), 15);
});

Deno.test("extractHoldingForceN reads a holding force stated via the answer KEY, not just inline in the value", () => {
  assertEquals(extractHoldingForceN("Vakuumgrepp för plåtdetalj", { hallkraft: "80N" }), 80);
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

// ── needsFoodGrade: consolidates two regexes that had drifted apart ────────────
// handleQuestions' version was already the superset (also matched nsf/h1);
// this is that union, verbatim.

Deno.test("needsFoodGrade detects a food-industry keyword", () => {
  assertEquals(needsFoodGrade("Pneumatisk cylinder för mejeriindustrin"), true);
});

Deno.test("needsFoodGrade detects the nsf/h1 terms only the wider (handleQuestions) regex had", () => {
  assertEquals(needsFoodGrade("Cylinder som kräver NSF H1-godkänd smörjning"), true);
});

Deno.test("needsFoodGrade returns false for an unrelated request", () => {
  assertEquals(needsFoodGrade("Rotationsaktuator för robotarm, 50Nm"), false);
});

// ── detectHazards: single-source-of-truth equivalence proof ────────────────────
// Found 2026-08-28: five real bugs (ATEX ignored by the pure-rotary options
// path, a battery-dryroom warning missing from BomCtx entirely, an
// engineering conflict-check wired into only one of several handlers, an
// ESD-safety requirement with no detector at all, and more found on a
// follow-up audit) all traced back to index.ts's several independent HTTP
// handlers each deciding for themselves which detectors to call. detectHazards
// computes every flag exactly once; every field below is a direct,
// unmodified call to the function it's named after, so this test proves
// that equivalence statically, once, for CI to hold forever -- rather than
// needing a runtime shadow-check that someone has to remember to remove.
//
// Reuses real strings from tonight's adversarial testing (each already a
// literal quoted in a "Found 2026-08-2N (adversarial test)" comment in this
// file or index.ts) rather than inventing new fixtures, so the same text
// that found a real bug also anchors the equivalence proof.

const EQUIVALENCE_CASES: Array<{ text: string; answers: Record<string, string> }> = [
  { text: "Vakuumgrepp för PCB, ESD-säkert material krävs", answers: {} },
  { text: "Elektrisk axel för renrumsapplikation, batteritillverkning dryroom-miljö, vertikal last 15kg, mycket hög cykelfrekvens", answers: {} },
  { text: "Rotationsaktuator för ATEX zon 1, vridmoment 50Nm, 180 graders rörelse, extremt hög cykelfrekvens", answers: {} },
  { text: "Pneumatisk cylinder, vertikal last 30kg, washdown-miljö livsmedelsindustri, säkerhetsfunktion SIL 2 krävs", answers: {} },
  { text: "Elektrisk axel, mycket hög hastighet 3 m/s men även extremt hög precision ±0.01mm samtidigt", answers: {} },
  {
    text: "Hydraulisk cylinder utomhus i marin miljö, låg kostnad, kontinuerlig drift 24/7, dammig miljö, " +
      "behöver fotfäste och svängfläns, stångbroms krävs, ändlägesgivare, syrgasren miljö, GMP-godkänd, " +
      "ventilterminal för flera cylindrar, X-axel 300mm Z-axel 150mm",
    answers: {},
  },
  { text: "Sorteringslinje med vägning, streckkodsläsning och robothantering på flera banor", answers: {} },
];

for (const { text, answers } of EQUIVALENCE_CASES) {
  Deno.test(`detectHazards matches every direct detector call for: "${text.slice(0, 60)}..."`, () => {
    const h = detectHazards(text, answers, "sv");

    assertEquals(h.isSystemScope, isMultiFunctionSystem(text));
    assertEquals(h.isMultiAxis, needsMultiAxis(text));
    assertEquals(h.isVacuum, needsVacuumGrip(text));
    assertEquals(h.valveTerminal, needsValveTerminal(text));
    assertEquals(h.isAtex, needsAtex(text));
    assertEquals(h.isAtexDust, needsAtexDust(text));
    assertEquals(h.isVerticalLoad, needsVerticalLoad(text));
    assertEquals(h.isHighTemp, needsHighTemp(text));
    assertEquals(h.isLowTemp, needsLowTemp(text));
    assertEquals(h.isHydraulic, isHydraulicApplication(text));
    assertEquals(h.isVeryHighForce, needsVeryHighForce(text, answers));
    assertEquals(h.isOxygenClean, needsOxygenClean(text));
    assertEquals(h.isEsdSafe, needsEsdSafe(text));
    assertEquals(h.isHighCycle, needsHighCycle(text, answers));
    assertEquals(h.isHighSpeed, needsHighSpeed(text, answers));
    assertEquals(h.isSilSafety, needsSilSafety(text));
    assertEquals(h.isOutdoor, needsOutdoor(text));
    assertEquals(h.isPharmaGmp, needsPharmaGmp(text));
    assertEquals(h.isFoodGrade, needsFoodGrade(text) || needsPharmaGmp(text));
    assertEquals(h.isBatteryDryroom, needsBatteryDryroom(text));
    assertEquals(h.isRodLock, needsRodLock(text) || (needsVerticalLoad(text) && needsSilSafety(text)));
    assertEquals(h.isWashdown, needsWashdown(text));
    assertEquals(h.isEndPosDetect, needsEndPositionDetection(text));
    assertEquals(h.isArticulated, needsArticulatedMount(text));
    assertEquals(h.isMounting, needsMounting(text));
    assertEquals(h.isLowCost, needsLowCost(text));
    assertEquals(h.is24x7, needsContinuousDuty(text));
    assertEquals(h.isDirtyEnv, needsDirtyEnv(text));

    const precisionMm = extractPrecisionMm(text, answers);
    assertEquals(h.precisionMm, precisionMm);
    assertEquals(h.isHighPrecision, precisionMm > 0 && precisionMm <= 0.1);

    const loadKg = extractLoadKg(text, answers);
    assertEquals(h.loadKg, loadKg);
    assertEquals(h.minBoreMm, calcMinBoreMm(loadKg));

    assertEquals(h.requiredMaxTempC, extractRequiredMaxTemp(text, answers));
    assertEquals(h.minStrokeMm, extractMinStroke(answers, text));
    // Gated on needsMultiAxis, matching both original call sites (handleBom's
    // and handleOptions's own pre-refactor locals) -- NOT extractPerAxisStrokes
    // unconditionally, which would just restate detectHazards's own
    // implementation back at itself instead of checking it against the
    // ground truth those two call sites already agreed on.
    const expectedPerAxisStrokes = needsMultiAxis(text) ? extractPerAxisStrokes(answers) : [];
    assertEquals(h.perAxisStrokes, expectedPerAxisStrokes);
    const expectedRequiredStroke = isMultiFunctionSystem(text) ? 0
      : expectedPerAxisStrokes.length > 0 ? Math.max(...expectedPerAxisStrokes.map((a) => a.stroke))
      : extractMinStroke(answers, text);
    assertEquals(h.requiredStrokeMm, expectedRequiredStroke);
    assertEquals(h.speedMs, extractSpeedMs(text, answers));
    assertEquals(h.explicitBoreMm, extractExplicitBoreMm(text, answers));
    assertEquals(h.gripForceN, extractGripForceN(text, answers));
    assertEquals(h.holdingForceN, extractHoldingForceN(text, answers));
    assertEquals(h.torqueNm, extractTorqueNm(text, answers));
    assertEquals(h.rotationDeg, extractRotationDeg(text, answers));
    assertEquals(h.cycleTimeS, extractCycleTimeS(text, answers));

    const cycleTimeS = extractCycleTimeS(text, answers);
    const expectedDynamics = computeDynamics(loadKg, expectedRequiredStroke, cycleTimeS, needsVerticalLoad(text));
    assertEquals(h.dynamics, expectedDynamics);
    assertEquals(h.conflicts, detectConflicts({
      locale: "sv", precisionMm, isHighPrecision: precisionMm > 0 && precisionMm <= 0.1,
      speedMs: extractSpeedMs(text, answers), isDirtyEnv: needsDirtyEnv(text), isWashdown: needsWashdown(text),
      isAtexDust: needsAtexDust(text), isLowCost: needsLowCost(text), is24x7: needsContinuousDuty(text),
      dyn: expectedDynamics,
    }));
  });
}

Deno.test("detectHazards' isPureRotary-relevant fields: dynamics is always null when requiredStrokeMm is 0 (documents why isPureRotary can safely surface conflicts unconditionally)", () => {
  const h = detectHazards("Rotationsaktuator, vridmoment 20Nm, 90 graders rörelse", {}, "sv");
  assertEquals(h.requiredStrokeMm, 0);
  assertEquals(h.dynamics, null);
});

// Found 2026-08-28: perAxisStrokes was ungated in detectHazards, unlike both
// original call sites (handleBom's and handleOptions's own pre-refactor
// locals), which both computed `isMultiAxis ? extractPerAxisStrokes(answers)
// : []`. extractPerAxisStrokes matches ANY answer key containing a stroke-ish
// term, so ungated it could wrongly treat two independently-keyed stroke
// answers on a single-axis request as separate axes and take their max
// instead of minStrokeMm's single value. Slipped through PR 1's equivalence
// tests because every EQUIVALENCE_CASES fixture used answers: {} -- this is
// the first test in the file to exercise a multi-key answers object.
Deno.test("detectHazards: perAxisStrokes stays gated on isMultiAxis -- two independently-keyed stroke answers on a single-axis request must not be treated as separate axes", () => {
  const text = "Pneumatisk cylinder för enkel dörröppning";
  const answers = { cylinder_a_stroke: "300", cylinder_b_stroke: "500" };
  // Confirm the fixture actually exercises the gate: ungated, these two
  // independently-keyed answers produce two entries, proving the old code
  // really did diverge here rather than coincidentally agreeing either way.
  assertEquals(needsMultiAxis(text), false);
  assertEquals(extractPerAxisStrokes(answers).length, 2);

  const h = detectHazards(text, answers, "sv");
  assertEquals(h.perAxisStrokes, []);
  assertEquals(h.requiredStrokeMm, extractMinStroke(answers, text));
});

// ── extractUnitCount: N identical stations in a BOM request ────────────────────
// Found 2026-08-28: a "6 identiska cylinderstationer" request got a BOM sized
// for exactly 1 -- buildMandatoryBomRows had no concept of station count at
// all. BOM-only (not part of HazardFlags/detectHazards): the options step
// recommends one representative product, it doesn't build a parts list.

Deno.test("extractUnitCount detects a plain Swedish station count", () => {
  assertEquals(extractUnitCount("6 identiska cylinderstationer på en sorteringslinje", {}), 6);
});

Deno.test("extractUnitCount detects '<N> st'", () => {
  assertEquals(extractUnitCount("Pneumatisk cylinder, 12 st, till en förpackningslinje", {}), 12);
});

Deno.test("extractUnitCount detects English phrasing", () => {
  assertEquals(extractUnitCount("4 identical pick-and-place stations", {}), 4);
});

Deno.test("extractUnitCount detects a count stated in an answer value", () => {
  assertEquals(extractUnitCount("Pneumatisk cylinder", { antal_stationer: "8 stationer" }), 8);
});

// Found 2026-09-03 (adversarial test), same root cause as the
// extractGripForceN/extractHoldingForceN fixes above: a structured question
// can put the counting word in the answer KEY with a bare number as the
// VALUE. Requires joining key+value (not value alone) to see "antal 6"
// as one adjacent phrase.
Deno.test("extractUnitCount detects a count where the counting word is in the answer KEY and the value is a bare number", () => {
  assertEquals(extractUnitCount("Pneumatisk cylinder", { antal: "6" }), 6);
});

Deno.test("extractUnitCount defaults to 1 (no-op) when no count is stated", () => {
  assertEquals(extractUnitCount("Pneumatisk cylinder, slag 200mm", {}), 1);
});

Deno.test("extractUnitCount does not misread a bore/pressure/temperature number as a station count", () => {
  assertEquals(extractUnitCount("Cylinder Ø6 mm, 6 bar, drifttemperatur 6°C", {}), 1);
});

Deno.test("extractUnitCount ignores an out-of-range count (typo guard)", () => {
  assertEquals(extractUnitCount("300 identiska stationer", {}), 1);
});

// ── isHighPrecision threshold: pneumatics must be excluded at ±0.5 mm ─────────
// Reported 2026-09-08: a pallet stacker needing "±0,5 mm vid varje stopp"
// (35 kg, 900 mm vertical, 12 cycles/min, 24/7, dusty) came back with three
// PNEUMATIC rodless cylinders as "Bästa valet". precisionMm parsed correctly as
// 0.5, but the trigger was `precisionMm <= 0.1`, so isHighPrecision stayed
// false and isAllowedForHighPrecision -- which exists precisely to exclude
// pneumatics -- never ran. Per scoring.ts's own documented figures, pneumatic
// repeatability is ±0.1–0.5 mm, so a requirement AT 0.5 mm has zero margin.

Deno.test("isHighPrecision fires at ±0,5 mm (the reported pallet-stacker case)", () => {
  const h = detectHazards(
    "Kartongen ska lyftas vertikalt 900 mm. Precision krävs inom ±0,5 mm vid varje stopp.",
    {}, "sv",
  );
  assertEquals(h.precisionMm, 0.5);
  assertEquals(h.isHighPrecision, true, "±0,5 mm must exclude pneumatics");
});

Deno.test("isHighPrecision still fires well below the threshold", () => {
  assertEquals(detectHazards("repeterbarhet ±0,02 mm", {}, "sv").isHighPrecision, true);
});

Deno.test("isHighPrecision does NOT fire at ±1 mm (cushioned pneumatic end stops are fine)", () => {
  const h = detectHazards("positionering ±1 mm räcker", {}, "sv");
  assertEquals(h.precisionMm, 1);
  assertEquals(h.isHighPrecision, false, "±1 mm must not exclude pneumatics");
});

Deno.test("isHighPrecision stays false when no precision is stated at all", () => {
  assertEquals(detectHazards("pneumatisk cylinder för stopp på transportband", {}, "sv").isHighPrecision, false);
});

// ── Husets kraftmodell ───────────────────────────────────────────────────────
// Talen här är LÅSTA med flit. Samma modell finns i src/lib/physics.ts för
// frontend-runtimen, och de två kan inte dela modul (Deno respektive Vite).
// Testerna på båda sidor pinnar samma värden, så att en ändring på ena sidan
// gör CI röd tills den andra följt efter.
//
// Bakgrund 2026-09-09: sajten hade fyra oberoende kraftformler. För en Ø50 gav
// de 884, 1178, 1178 och 1531 N. Chatten och maskinbyggaren rekommenderade
// olika borrning för samma last, och båda syntes för kunden.

Deno.test("kraftmodell: teoretisk kraft är π/4·d²·P utan verkningsgrad", () => {
  // Ø50 vid 6 bar: π/4 · 2500 · 0,6 = 1178 N. Samma tal som katalogens
  // piston_force_6bar_N, vilket är hela poängen -- de får inte glida isär.
  assertEquals(Math.round(theoreticalForceN(50)), 1178);
  assertEquals(Math.round(theoreticalForceN(40)), 754);
  assertEquals(Math.round(theoreticalForceN(80)), 3016);
});

Deno.test("kraftmodell: användbar kraft är teoretisk gånger 0,75", () => {
  assertEquals(Math.round(usableForceN(50)), 884);
  assertEquals(Math.round(usableForceN(40)), 565);
  assertEquals(SEAL_EFFICIENCY, 0.75);
});

Deno.test("kraftmodell: kravet inkluderar säkerhetsfaktor 2", () => {
  assertEquals(Math.round(requiredForceN(35)), 687);
  assertEquals(LOAD_SAFETY_FACTOR, 2);
  assertEquals(requiredForceN(0), 0);
});

Deno.test("calcMinBoreMm dimensionerar mot användbar kraft, inte teoretisk", () => {
  // Det konkreta fallet ur genomgången: 35 kg krävde 687 N, och den gamla
  // modellen gav Ø39 -- en Ø40 som levererar 565 N. Nu Ø45, alltså
  // standardborrning Ø50, samma som chatten rekommenderar.
  assertEquals(calcMinBoreMm(35), 45);
  assertEquals(calcMinBoreMm(0), 0);
});

Deno.test("calcMinBoreMm: vald borrning klarar alltid kravet", () => {
  // Grinden för hela modellen. Håller den inte är dimensioneringen fel.
  for (const kg of [1, 5, 15, 35, 60, 80, 150]) {
    const bore = calcMinBoreMm(kg);
    assert(
      usableForceN(bore) >= requiredForceN(kg),
      `Ø${bore} ger ${usableForceN(bore).toFixed(0)} N men ${kg} kg kräver ${requiredForceN(kg).toFixed(0)} N`,
    );
  }
});

// ── Synk mellan runtimes ─────────────────────────────────────────────────────
// Kraftmodellen finns i två exemplar: här för Deno-runtimen och i
// src/lib/physics.ts för Vite-runtimen. De kan inte dela modul, så det här
// testet läser frontend-filen och gör CI röd om konstanterna glider isär.
//
// Att en avvikelse ska fälla bygget, i stället för att upptäckas av en kund som
// får två olika borrningar rekommenderade av samma sajt, är hela poängen.
// Testet kräver --allow-read; utan den behörigheten hoppar det över sig självt
// hellre än att falla, eftersom ett falskt rött är värre än ett uteblivet test.

Deno.test("kraftmodellen är densamma i frontend-runtimen", async () => {
  let src: string;
  try {
    src = await Deno.readTextFile(new URL("../../../src/lib/physics.ts", import.meta.url));
  } catch {
    console.warn("  [hoppar över] kunde inte läsa src/lib/physics.ts (kräver --allow-read)");
    return;
  }
  const tal = (namn: string) => {
    const m = src.match(new RegExp(`export const ${namn}\\s*=\\s*([0-9.]+)`));
    return m ? parseFloat(m[1]) : null;
  };
  assertEquals(tal("SEAL_EFFICIENCY"), SEAL_EFFICIENCY,
    "SEAL_EFFICIENCY skiljer sig mellan signals.ts och physics.ts");
  assertEquals(tal("LOAD_SAFETY_FACTOR"), LOAD_SAFETY_FACTOR,
    "LOAD_SAFETY_FACTOR skiljer sig mellan signals.ts och physics.ts");
});

// ── Angiven kraft är ett krav, inte en last ──────────────────────────────────
// Hittat 2026-09-10 i en verifieringsomgång efter kraftmodellsändringen:
// "kräver 900 N klämkraft" gick genom extractLoadKg:s generiska N-fallback,
// blev 900/9,81 = 91,7 kg, och dubblades sedan av säkerhetsfaktorn till
// 1 800 N. Rekommendationen blev Ø80 där Ø50 räcker -- överdimensionering,
// spegelbilden av underdimensioneringen vi rättade dagen innan.
//
// Systemet visste redan bättre: extractGripForceN hittade 900. Signalen
// användes bara i gripdon-grenen, inte för cylinderdimensionering.

Deno.test("angiven klämkraft används som krav, utan säkerhetsfaktor", () => {
  const h = detectHazards("Klämmer fast en detalj, kräver 900 N klämkraft, slag 50 mm", {}, "sv");
  assertEquals(h.gripForceN, 900);
  assertEquals(requiredForceN(h.loadKg, h.gripForceN), 900);
});

Deno.test("angiven greppkraft dubblas inte heller", () => {
  const h = detectHazards("Greppkraft 200 N behövs för att hålla detaljen", {}, "sv");
  assertEquals(requiredForceN(h.loadKg, h.gripForceN), 200);
});

Deno.test("en MASSA får fortfarande säkerhetsfaktor", () => {
  const h = detectHazards("Lyft en last på 35 kg vertikalt 300 mm", {}, "sv");
  assertEquals(h.gripForceN, 0);
  assertEquals(Math.round(requiredForceN(h.loadKg, 0)), 687);
});

Deno.test("en last uttryckt i newton är en vikt, inte ett kraftkrav", () => {
  // Skillnaden mot fallen ovan: ingen kraftterm i texten. 500 N är då vad
  // lasten VÄGER, och säkerhetsfaktorn hör hemma. Den vägen är oförändrad.
  const h = detectHazards("Lasten är 500 N och ska lyftas 100 mm", {}, "sv");
  assertEquals(h.gripForceN, 0);
  assertEquals(Math.round(requiredForceN(h.loadKg, 0)), 1000);
});

Deno.test("minBoreMm dimensioneras mot den angivna kraften", () => {
  const h = detectHazards("Klämmer fast en detalj, kräver 900 N klämkraft", {}, "sv");
  // 900 N / (0,6 N/mm² x 0,75) = 2000 mm² -> Ø50,5 -> 51
  assertEquals(h.minBoreMm, 51);
  assert(usableForceN(h.minBoreMm) >= 900, "vald borrning måste klara den angivna kraften");
});

Deno.test("needsRodLock: extern låsning räknas som låsningskrav", () => {
  // Regressionen: en kund beskrev en vertikal press med "extern låsning".
  // Mönstret kände bara "stångbroms" och "mekaniskt lås", så flaggan sattes
  // aldrig och stycklistan fick ingen stångbroms -- backslagsventilen stod
  // kvar ensam som om kravet var uppfyllt.
  for (const t of [
    "Vertikal dubbelverkande cylinder med extern låsning och justerbar slaglängd",
    "behöver lastsäkring så locket inte faller",
    "måste hålla lasten vid tryckbortfall",
    "cylinder som ska låsa kolvstången",
    "vertical press with external locking",
    "vertikale Presse mit externer Verriegelung",
    "prensa vertical con bloqueo externo",
  ]) {
    assert(needsRodLock(t), `skulle ha matchat: ${t}`);
  }
});

Deno.test("needsRodLock: ändlägeslåsning är INTE en säkerhetsbroms", () => {
  // Ändlägeslåsning är en cylinderoption (DSBC ...-S2), inte en fallskyddsbroms.
  // Matchar den här skulle varenda DSBC-konfiguration få en stångbroms påtvingad.
  for (const t of [
    "DSBC Ø32 med ändlägeslåsning",
    "cylinder med ändlägeslåsning i främre läge",
  ]) {
    assert(!needsRodLock(t), `skulle INTE ha matchat: ${t}`);
  }
});

Deno.test("needsGuidance: styrningskravet har någonstans att ta vägen", () => {
  // Regressionen: en kund valde "Ja, ledning" i wizarden. Det fanns ingen
  // isGuided-flagga alls, så kravet försvann -- ingen BOM-rad, ingen varning.
  // Optionskortet skrev till och med "ingen inbyggd guidning" bland
  // nackdelarna, så kunskapen fanns; den nådde bara aldrig stycklistan.
  for (const t of [
    "Ja, ledning behövs",
    "cylindern får inte rotera",
    "behöver vridskydd på kolvstången",
    "pressplatta som tar sidokrafter",
    "needs anti-rotation guidance",
    "mit Verdrehsicherung",
    "requiere antigiro",
  ]) {
    assert(needsGuidance(t), `skulle ha matchat: ${t}`);
  }
});

Deno.test("needsGuidance: en vanlig cylinderbeskrivning utlöser den inte", () => {
  for (const t of [
    "pneumatisk cylinder Ø40 med 200 mm slag",
    "dubbelverkande cylinder för horisontell transport",
  ]) {
    assert(!needsGuidance(t), `skulle INTE ha matchat: ${t}`);
  }
});

Deno.test("ett uttryckligt horisontellt val slår vertikaldetekteringen", () => {
  // Rapporterat: kartongstopp på transportband, användaren valde "Horisontell
  // orientering". Stycklistan motiverade ändå backslagsventilen med
  // "OBLIGATORISK vid pneumatisk vertikal last" -- en regel från ett tidigare
  // vertikalt pressfall som följde med till ett case där villkoret inte gällde.
  assert(!needsVerticalLoad("stoppar kartonger på transportband, horisontell orientering"));
  assert(!needsVerticalLoad("liggande montage, cylindern lyfter inget"));
  assert(!needsVerticalLoad("horizontal orientation, carton stop"));
});

Deno.test("vertikaldetekteringen fungerar fortfarande när inget motsäger den", () => {
  // Regressionsskydd: fixen ovan får inte stänga av vertikallogiken helt.
  assert(needsVerticalLoad("vertikal press som pressar plastlock nedåt"));
  assert(needsVerticalLoad("cylinder som ska lyfta 15 kg"));
  assert(needsVerticalLoad("hängande last i z-axel"));
});

// ── Ändlägesdetektering på vanligt språk ────────────────────────────────────
// Hittat 2026-10-01 i ett eget hårt testfall: kunden skrev "Vi behöver veta när
// den är i topp och i botten" och fick INGEN givarrad i stycklistan -- tyst,
// utan en rad som sa att den uteblev. Alla uttryck i detektorn var fackord, och
// den kund som redan skriver "ändlägesgivare" är inte den som behöver hjälpen.
Deno.test("needsEndPositionDetection: vanligt språk, inte bara fackord", () => {
  const ska = [
    "Vi behöver veta när den är i topp och i botten.",
    "Vi vill se när cylindern är framme.",
    "Maskinen ska bekräfta att verktyget är i hemläge innan start.",
    "Vi behöver återkoppling till PLC:n.",
    "We need to know when it is at the top and at the bottom.",
    "Wir müssen wissen, wann er ausgefahren ist.",
    "Necesitamos saber cuándo está arriba.",
    "Rückmeldung an die SPS erforderlich.",
  ];
  for (const t of ska) {
    assert(needsEndPositionDetection(t), `skulle ha träffat: ${t}`);
  }

  // Fackorden som redan fungerade får inte sluta fungera.
  for (const t of ["2 st ändlägesgivare", "magnetgivare för positionsdetektering"]) {
    assert(needsEndPositionDetection(t), `regression: ${t}`);
  }
});

// Verbet måste stå NÄRA lägesordet. Annars drar en mening som bara råkar
// innehålla både "veta" och "botten" in två givare som ingen bett om.
Deno.test("needsEndPositionDetection: slår inte till på löst relaterad text", () => {
  const skaInte = [
    "Vi behöver veta vad en komplett lösning kostar, och cylindern ska gå ända ner till botten av slaget.",
    "Lyfter en plåtdel 15 kg vertikalt 200 mm i en pressstation.",
    "Vi vill se en offert så snart som möjligt.",
    "Stoppdon som stoppar kartonger på ett transportband.",
  ];
  for (const t of skaInte) {
    assertEquals(needsEndPositionDetection(t), false, `skulle INTE ha träffat: ${t}`);
  }
});

// Hittat 2026-10-01 vid en genomsökning efter \b framför icke-ASCII: fem
// nyckelord låg i sina alternationer utan att någonsin kunna matcha, eftersom
// \b i JavaScript är ASCII-baserat och därför inte ser en gräns framför å, ä,
// ö eller á. Orden var inte fel stavade och inte fel placerade -- de var
// oläsbara för motorn. Testet låser fast att de lever, och att de inte börjat
// matcha inuti andra ord ("långa slag" är inte ånga).
Deno.test("nyckelord med diakriter matchar -- och bara som egna ord", () => {
  assert(needsHighTemp("Processen avger ånga kontinuerligt."), "ånga");
  assertEquals(needsHighTemp("Vi kör långa slag i en vanlig verkstad."), false, "långa != ånga");

  assert(isHydraulicApplication("Wir brauchen einen Ölzylinder."), "ölzylinder");
  assert(isHydraulicApplication("Öldruck 200 bar."), "öldruck");

  assert(needsWashdown("Limpieza con ácido en la línea."), "ácido");
});

// ── "90 grader" är vinkel lika ofta som temperatur ───────────────────────────
// Hittat 2026-10-02 av en adversariell granskning (doubt-driven-development):
// "Vridbord som roterar 180 grader per cykel, rumstemperatur" lästes som ett
// krav på 180 °C. Felet fanns latent länge, men #313 kopplade in värdet i
// satteVerifiering och bedomLosning -- och gjorde en mild feldetektering till
// ett fabricerat skäl som stoppar en beställning. Vridning i 90/180/270 grader
// är standardspråket för svängenheter, så det här träffade brett.
Deno.test("extractRequiredMaxTemp: vinkel är inte temperatur", () => {
  const vinkel = [
    "Vridbord som roterar 180 grader per cykel, rumstemperatur",
    "Svängenhet 270 grader i en monteringscell",
    "90 graders vridning av detaljen, 20 °C i lokalen",
    "Indexering 60 grader per steg",
    "Rotary unit turning 180 degrees per cycle",
    "Schwenkeinheit 90 Grad pro Takt",
  ];
  for (const t of vinkel) {
    assertEquals(extractRequiredMaxTemp(t, {}), 0, `vinkel lästes som temperatur: ${t}`);
  }
});

// Hittat 2026-10-02 genom att köra ett vridbord mot den DRIFTSATTA tjänsten
// efter att fixen ovan gått live: den räckte inte. index.ts slår ihop
// beskrivningen med alla svarsvärden till en enda sträng, och mitt i den
// hamnade "Horisontellt 180 grader per cykel Vanlig verkstad" -- fyrtio tecken
// utan ett enda vridord, trots att frågan hette "rotation". Ordfönstret kan
// alltså inte vara den enda regeln när texten är hopfogad ur fält.
//
// En temperatur anges aldrig PER något. Den regeln är oberoende av fönstret.
Deno.test("extractRequiredMaxTemp: 'grader per X' är alltid rörelse", () => {
  const description = "Vridbord som roterar 180 grader per cykel i rumstemperatur. Last 5 kg, 20 cykler per minut.";
  const answers = {
    monteringslage: "Horisontellt",
    rotation: "180 grader per cykel",
    miljo: "Vanlig verkstad, rumstemperatur",
  };
  const combinedText = description + " " + Object.values(answers).join(" ");
  assertEquals(extractRequiredMaxTemp(combinedText, answers), 0,
    "hopfogade svarsfält fick 180 graders vridning att läsas som 180 °C");

  assertEquals(extractRequiredMaxTemp("Indexering 90 grader per takt", {}), 0);
  assertEquals(extractRequiredMaxTemp("Matar fram 120 grader per steg", {}), 0);
});

Deno.test("extractRequiredMaxTemp: riktiga temperaturkrav fångas fortfarande", () => {
  assertEquals(extractRequiredMaxTemp("Härdningslinje, 90 °C omgivning", {}), 90);
  assertEquals(extractRequiredMaxTemp("Omgivningen går upp till 90 grader C", {}), 90);
  assertEquals(extractRequiredMaxTemp("Ugnen håller 400 grader varmt", {}), 400);
  // Även i en vridmaskin: står det uttryckligen C eller varmt är det temperatur.
  assertEquals(extractRequiredMaxTemp("Vridbord i en ugn, 200 grader C", {}), 200);
  // Under tröskeln ska inget krav uppstå -- standardtätningar klarar det.
  assertEquals(extractRequiredMaxTemp("Cylinder i 40 °C verkstad", {}), 0);
  // Flera siffror: det gamla uttrycket tog bara första träffen och tappade ugnen.
  assertEquals(extractRequiredMaxTemp("20 grader i lokalen, 400 grader varmt i ugnen", {}), 400);
});


// ── Griporganet får inte tappas bort ─────────────────────────────────────────
// Hittat 2026-10-02 i en genomgång: "Plockar och placerar kartong 2 kg —
// vakuumgrepp från magasin" är ett av SEX exempel på startsidan. Det gav en
// kompaktcylinder med 5 mm slag och inte en enda vakuumkomponent, trots att
// katalogen har 12. Orsaken: handleOptions hoppar över griporganet när
// rörelsen är flerkaxlig, och "plocka och placera" ÄR flerkaxligt.
//
// Villkorets skäl är rätt när vi själva HÄRLETT greppet ur att detaljen är
// plan och ömtålig. Det är fel när kunden skrivit vilket grepp hen vill ha.
Deno.test("uttalat griporgan skiljs från härlett", () => {
  // Uttalat: kunden har namngett greppet.
  for (const t of [
    "Plockar och placerar kartong 2 kg — vakuumgrepp från magasin",
    "Vakuumgrepp som lyfter glasskivor 4 kg i monteringscell",
    "Vi behöver sugkoppar och en ejektor",
    "Vi ska gripa en detalj med ett parallellgrepp",
    "Ett vinkelgrepp som håller detaljen",
  ]) {
    assert(endEffectorExplicitlyAsked(t), `skulle vara uttalat: ${t}`);
    assert(detectEndEffectorIntent(t) !== null, `intent saknas: ${t}`);
  }

  // Härlett: vi gissar ur att glas är plant och ömtåligt. Inget uttalat krav.
  for (const t of [
    "Treaxlig portal som flyttar glasskivor mellan två band",
    "Lyfter tunn plåt från ett magasin",
  ]) {
    assertEquals(endEffectorExplicitlyAsked(t), false, `skulle INTE vara uttalat: ${t}`);
  }

  // Ingen grepptanke alls.
  assertEquals(endEffectorExplicitlyAsked("Pneumatiskt stoppdon på ett transportband"), false);
  assertEquals(detectEndEffectorIntent("Pneumatiskt stoppdon på ett transportband"), null);
});

// -grepp-formerna saknades; bara -gripare fanns.
Deno.test("gripdon: både -gripare och -grepp känns igen", () => {
  for (const t of ["parallellgripare", "parallellgrepp", "vinkelgripare", "vinkelgrepp", "gripdon"]) {
    assertEquals(detectEndEffectorIntent(`Vi behöver ett ${t} för detaljen`), "gripper", t);
  }
});

// ── Vridvinkel ur katalogens egna nycklar ────────────────────────────────────
// Hittat 2026-10-02: vridgrenen var den enda väg i handleOptions som inte
// returnerade något requirements-objekt alls, så en vridkund fick ingen
// dimensionering att läsa. Den satte dessutom force_n = vridmomentet, alltså
// newtonMETER i ett fält som heter newton -- ofarligt bara så länge panelen
// aldrig ritades.
//
// Nycklarna är mätta mot katalogen: rotation_angle finns på 15 av 18
// vridenheter och skrivs som ett spann, swivel_angle_max på 3 som ett tal.
Deno.test("parseRotationFromSpecs läser katalogens former", () => {
  assertEquals(parseRotationFromSpecs({ rotation_angle: "0–180" }), 180);
  assertEquals(parseRotationFromSpecs({ rotation_angle: "0-90" }), 90);
  assertEquals(parseRotationFromSpecs({ swivel_angle_max: "240" }), 240);
  assertEquals(parseRotationFromSpecs({ rotation_angle: "90, 180, 270" }), 270);
  assertEquals(parseRotationFromSpecs({ torque: "12" }), 0, "fel nyckel ska inte ge en vinkel");
  assertEquals(parseRotationFromSpecs({}), 0);
});

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
  needsRodLock, needsWashdown, needsEndPositionDetection, needsArticulatedMount,
  needsMounting, needsLowCost, needsContinuousDuty, needsDirtyEnv,
  extractRequiredMaxTemp, extractMinStroke, extractPerAxisStrokes, extractSpeedMs,
  extractPrecisionMm, extractExplicitBoreMm, calcMinBoreMm, extractTorqueNm,
  extractRotationDeg, extractCycleTimeS, computeDynamics, detectConflicts,
  extractUnitCount,
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

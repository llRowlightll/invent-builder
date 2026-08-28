// Regression tests for buildMandatoryBomRows()/findAxisActuator(), encoding real
// bugs found and fixed during adversarial live testing on 2026-08-21/22.
// Run: deno test supabase/functions/groq-advisor/bom-builder.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  type BomCtx,
  buildMandatoryBomRows,
  findAxisActuator,
} from "./bom-builder.ts";
import { type CatalogProduct, normalizeKeySpecs } from "./scoring.ts";

function prod(
  sku: string,
  category: string,
  brand: string,
  specs: Record<string, unknown> = {},
): CatalogProduct {
  return { sku, name: sku, category, brand, key_specs: normalizeKeySpecs(specs) };
}

function bomCtx(over: Partial<BomCtx> = {}): BomCtx {
  return {
    primarySku: "TEST-PRIMARY",
    primaryIsFamilyProd: false,
    isElectric: false,
    locale: "sv",
    products: [],
    primaryBoreMm: 0,
    primaryBrand: "",
    // HazardFlags (see signals.ts) -- every field required by BomCtx extends
    // HazardFlags; TypeScript names exactly what's missing if this fixture
    // ever falls behind the interface again.
    isSystemScope: false,
    isMultiAxis: false,
    isVacuum: false,
    valveTerminal: false,
    isAtex: false,
    isAtexDust: false,
    isVerticalLoad: false,
    isHighTemp: false,
    isLowTemp: false,
    isHydraulic: false,
    isVeryHighForce: false,
    isOxygenClean: false,
    isEsdSafe: false,
    isHighCycle: false,
    isHighSpeed: false,
    isSilSafety: false,
    isOutdoor: false,
    isPharmaGmp: false,
    isFoodGrade: false,
    isBatteryDryroom: false,
    isRodLock: false,
    isWashdown: false,
    isEndPosDetect: false,
    isArticulated: false,
    isMounting: false,
    isLowCost: false,
    is24x7: false,
    isDirtyEnv: false,
    isHighPrecision: false,
    minBoreMm: 0,
    requiredMaxTempC: 0,
    minStrokeMm: 0,
    perAxisStrokes: [],
    requiredStrokeMm: 0,
    speedMs: 0,
    precisionMm: 0,
    explicitBoreMm: 0,
    loadKg: 0,
    gripForceN: 0,
    holdingForceN: 0,
    torqueNm: 0,
    rotationDeg: 0,
    cycleTimeS: 0,
    dynamics: null,
    conflicts: [],
    ...over,
  };
}

function findRow(rows: ReturnType<typeof buildMandatoryBomRows>, roleRe: RegExp) {
  return rows.find((r) => roleRe.test(r.role));
}

const SENSOR_ROLE = /ändlägesgivare|end-position sensor|endlagensensor|sensor de fin de carrera/i;

// ── Sensor brand-matching survives a fetch-capped product pool (#132, #133) ────
// Found 2026-08-21: an SMC primary actuator got a Festo sensor recommended, with
// zero brand check at all (fix f3db6a4 / PR #132). Root-caused (fix f01160c /
// PR #133) to primaryBrand being derived via `products.find(p => p.sku ===
// primarySku)?.brand` — which silently returns "" whenever the primary SKU
// itself doesn't survive fetchProducts' 30-per-category cap (common: e.g.
// "cylinder" has 325 products, bosch-rexroth alone exceeds the cap). The fix
// was to thread ctx.primaryBrand through from a guaranteed exact-SKU fetch
// instead. This test's pool deliberately excludes the primary SKU, so a
// regression back to the old products.find() derivation would fail it.

Deno.test("end-position sensor matches the primary's brand even when the primary SKU is absent from the product pool (#132, #133)", () => {
  const products = [
    prod("FE-SIES-8M", "sensor", "festo"),
    prod("SMC-D-A73", "sensor", "smc"),
  ];
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "SMC-CQ2-25-100", // NOT present in `products` -- simulates the fetch cap
    primaryBrand: "smc",
    isEndPosDetect: true,
    products,
  }));
  const sensorRow = findRow(rows, SENSOR_ROLE);
  assert(sensorRow, "expected an end-position sensor row");
  assertEquals(sensorRow!.sku, "SMC-D-A73");
});

// ── ATEX + end-position detection must not go silent (#134) ────────────────────
// Found 2026-08-21: isEndPosDetect only ever added a row inside the `isPneumatic`
// branch -- an ATEX/ATEX-dust zone request fell through with zero acknowledgment
// that end-position sensing was even asked for. Standard 24V sensors are not
// legal in the zone, so the honest answer is SPECIFY + a zone-certification
// callout, not silence and not a standard catalog sensor.

Deno.test("ATEX zone with end-position detection gets a zone-certified SPECIFY row, not silence (#134)", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-ATEX-CYL",
    primaryBrand: "festo",
    isAtex: true,
    isEndPosDetect: true,
  }));
  const sensorRow = findRow(rows, SENSOR_ROLE);
  assert(sensorRow, "expected an ATEX end-position sensor row instead of silence");
  assertEquals(sensorRow!.sku, "SPECIFY");
  assert(/atex|iecex/i.test(sensorRow!.role + sensorRow!.reason), "reason must call out zone certification");
});

// ── Electric axis + end-position detection must not go silent (#135) ───────────
// Found 2026-08-21: same "stated requirement vanished" problem as #134, but for
// electric axes -- less severe, since a servo axis's integrated encoder genuinely
// already provides position feedback, so the fix appends a note to the primary
// row's reason rather than inventing a purchasable-looking sensor row.

Deno.test("electric axis with end-position detection gets an encoder note, not silence and not a phantom sensor row (#135)", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-EGSK-33-200",
    primaryBrand: "festo",
    isElectric: true,
    isEndPosDetect: true,
  }));
  const primaryRow = rows.find((r) => r.sku === "FE-EGSK-33-200");
  assert(primaryRow, "expected the primary actuator row");
  assert(/encoder/i.test(primaryRow!.reason), "primary row's reason must mention the built-in encoder");
  assertEquals(findRow(rows, SENSOR_ROLE), undefined, "must not also invent a separate sensor row");
});

// ── findAxisActuator: consumer contract for brand-sorted pools (#136, partial) ──
// Found 2026-08-21: an SMC multi-axis job's secondary (Z) axis got a Bosch
// Rexroth cylinder -- not because findAxisActuator ignored brand, but because
// the "cylinder" product pool it was given (fetchProducts, capped at 30) never
// contained an SMC cylinder in the first place, so brand-sorting had nothing of
// the primary's own brand to bring forward. The real fix (PR #136) was a
// supplementary same-brand fetch upstream in handleBom, which lives outside
// this pure module and stays covered only by scripts/test-advisor.sh. This test
// only guards findAxisActuator's own contract: given a pool that DOES already
// contain a same-brand candidate positioned first (what a correct brandSorted
// pool looks like), it must actually pick that one rather than some other
// ordering -- i.e. a regression here would silently break the consumer contract
// the real fix depends on.

Deno.test("findAxisActuator picks the first brand-matching candidate when a brand-sorted pool provides one (#136, partial)", () => {
  const brandSorted = [
    prod("SMC-CDQ2B32-100", "cylinder", "smc", { stroke_mm: "100 mm" }),
    prod("0822040200", "cylinder", "bosch-rexroth", { stroke_mm: "100 mm" }),
  ];
  const picked = findAxisActuator(brandSorted, 80, false);
  assertEquals(picked?.sku, "SMC-CDQ2B32-100");
});

// ── Generalized matrix: brand × hazard-flag, locale ────────────────────────────
// Bounded, not open-ended: covers the REAL brand roster per category (queried
// live 2026-08-25 -- sensor: festo(10)/smc(5) only; cylinder: metal-work(70),
// parker(54), camozzi(47), bosch-rexroth(45), festo(44), smc(42), norgren(23)),
// not a guessed/hypothetical list. Two sub-sweeps: which mandatory-row lookup
// (sensor vs. axis-actuator) honors brand, and whether the mandatory-row COPY
// itself stays correctly localized across all 4 locales.

// Sweep A1 -- sensor brand-matching (buildMandatoryBomRows), every real sensor brand
const SENSOR_BRAND_CASES: { brand: string; sku: string }[] = [
  { brand: "festo", sku: "FE-SIES-8M" },
  { brand: "smc", sku: "SMC-D-A73" },
];
for (const c of SENSOR_BRAND_CASES) {
  Deno.test(`end-position sensor picks the ${c.brand} product when ${c.brand} is the primary brand`, () => {
    const products = [prod("FE-SIES-8M", "sensor", "festo"), prod("SMC-D-A73", "sensor", "smc")];
    const rows = buildMandatoryBomRows(bomCtx({
      primarySku: `TEST-${c.brand.toUpperCase()}`,
      primaryBrand: c.brand,
      isEndPosDetect: true,
      products,
    }));
    assertEquals(findRow(rows, SENSOR_ROLE)?.sku, c.sku);
  });
}

// Sweep A2 -- findAxisActuator brand-matching, every real cylinder brand
const CYLINDER_BRANDS = ["metal-work", "parker", "camozzi", "bosch-rexroth", "festo", "smc", "norgren"];
for (const brand of CYLINDER_BRANDS) {
  Deno.test(`findAxisActuator picks the ${brand} candidate when it's sorted first (real cylinder-brand roster)`, () => {
    const target = prod(`${brand.toUpperCase()}-100`, "cylinder", brand, { stroke_mm: "100 mm" });
    const others = CYLINDER_BRANDS.filter((b) => b !== brand)
      .map((b) => prod(`${b.toUpperCase()}-100`, "cylinder", b, { stroke_mm: "100 mm" }));
    const brandSorted = [target, ...others]; // mirrors buildMandatoryBomRows' own brand-first sort
    assertEquals(findAxisActuator(brandSorted, 80, false)?.sku, target.sku);
  });
}

// Sweep B -- locale correctness of a mandatory-row's copy, all 4 locales
// Uses the ATEX end-position SPECIFY row (fires unconditionally, no product-pool
// dependency) -- guards against a future hand-edit updating one of 4 parallel
// pick() strings and missing the others.
const LOCALE_MANDATORY_KEYWORD: Record<string, RegExp> = {
  sv: /OBLIGATORISK/,
  en: /MANDATORY/,
  de: /ZWINGEND/,
  es: /OBLIGATORIO/,
};
for (const [locale, keyword] of Object.entries(LOCALE_MANDATORY_KEYWORD)) {
  Deno.test(`ATEX end-position SPECIFY row stays correctly localized for locale "${locale}"`, () => {
    const rows = buildMandatoryBomRows(bomCtx({
      primarySku: "FE-ATEX-CYL", isAtex: true, isEndPosDetect: true, locale,
    }));
    const sensorRow = findRow(rows, SENSOR_ROLE);
    assert(sensorRow, `expected an ATEX end-position row for locale ${locale}`);
    assert(keyword.test(sensorRow!.reason), `reason must contain ${keyword} for locale ${locale}, got: ${sensorRow!.reason}`);
  });
}

// ── Integrated-motor actuator (e.g. SMC LEY) must explain, not go silent (#new) ─
// Found 2026-08-28 (adversarial test): SMC has zero standalone servo-motor
// products -- its electric axes are integrated-motor units, so no separate
// motor purchase is needed. The vertical-load branch already explained this
// correctly on the primary row; the (more common) non-vertical case stayed
// completely silent -- indistinguishable from "the BOM forgot the motor" to a
// customer, even though nothing is actually missing.
const MOTOR_ROLE = /servomotor|stegmotor|bromsmotor|stepper motor|brake motor|servo motor|schrittmotor|bremsmotor|motor paso a paso|motor con freno/i;

Deno.test("integrated-motor actuator (no same-brand servo-motor product) explains itself on the primary row instead of going silent", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "SMC-LEY", primaryBrand: "smc", isElectric: true, isVerticalLoad: false,
    products: [prod("SMC-LECA6", "servo-drive", "smc")], // no "servo-motor" category product for smc at all
  }));
  assertEquals(findRow(rows, MOTOR_ROLE), undefined, "must not invent a separate motor row when none exists");
  const primaryRow = rows.find((r) => r.sku === "SMC-LEY");
  assert(primaryRow, "expected the primary actuator row");
  assert(/integrerad|integrated|integriert/i.test(primaryRow!.reason), "primary row must explain the motor is integrated, not stay silent");
});

// ── Battery dryroom (Cu/Zn/Ni ban) must be a deterministic row (#new) ──────────
// Found 2026-08-28 (adversarial test): isBatteryDryroom only ever produced
// guidance inside buildCustomSolutionOption (options flow) -- the bom flow had
// no deterministic row for it at all, unlike every other safety hazard here,
// so a rate-limited LLM call meant zero mention of the Cu/Zn/Ni material ban
// anywhere in the response.

Deno.test("battery-dryroom BOM gets a deterministic Cu/Zn/Ni material-ban row, independent of the LLM", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "SMC-LEY", primaryBrand: "smc", isElectric: true, isVerticalLoad: true, isBatteryDryroom: true,
  }));
  const warnRow = rows.find((r) => /Cu\/Zn\/Ni/i.test(r.reason));
  assert(warnRow, "expected a deterministic Cu/Zn/Ni material-ban row for a battery-dryroom request");
  assertEquals(warnRow!.sku, "SPECIFY");
});

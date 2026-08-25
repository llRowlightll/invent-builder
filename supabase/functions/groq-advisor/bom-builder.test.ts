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
    isAtex: false,
    isAtexDust: false,
    isVerticalLoad: false,
    isHighSpeed: false,
    valveTerminal: false,
    isEndPosDetect: false,
    isVacuum: false,
    locale: "sv",
    products: [],
    isMounting: false,
    isArticulated: false,
    isRodLock: false,
    primaryBoreMm: 0,
    primaryBrand: "",
    isHighTemp: false,
    isWashdown: false,
    isSilSafety: false,
    isHydraulic: false,
    isVeryHighForce: false,
    isMultiAxis: false,
    perAxisStrokes: [],
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

// Regression tests for buildMandatoryBomRows()/findAxisActuator(), encoding real
// bugs found and fixed during adversarial live testing on 2026-08-21/22.
// Run: deno test supabase/functions/groq-advisor/bom-builder.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  type BomCtx,
  type BomRow,
  buildMandatoryBomRows,
  deriveBomConnections,
  deriveSubsystems,
  findAxisActuator,
  bedomLosning,
  arStyrventil52,
  findCatalogProductByType,
  buildCustomSolutionOption,
} from "./bom-builder.ts";
import { type CatalogProduct, normalizeKeySpecs } from "./scoring.ts";
import { detectHazards } from "./signals.ts";

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
    kravTempC: 0,   // inget temperaturkrav som standard; sätts per test
    primarySpecs: {},
    kravTempMinC: NaN,
    primaryIsFamilyProd: false,
    isElectric: false,
    locale: "sv",
    products: [],
    primaryBoreMm: 0,
    primaryBrand: "",
    unitCount: 1,
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
    isGuided: false,
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

// ── unitCount: N identical stations scale per-station BOM rows ─────────────────
// Found 2026-08-28: a "6 identiska cylinderstationer" request got a BOM sized
// for exactly 1 -- every row below was a hardcoded literal with no concept of
// station count. unitCount defaults to 1 (a no-op multiplier, see bomCtx()'s
// default) so every existing test above is unaffected; these are the first
// tests to exercise unitCount > 1.

Deno.test("unitCount scales every genuinely per-station row", () => {
  const products = [
    prod("TEST-VALVE", "valve", "smc"),
    prod("TEST-FC", "flow-control", "smc"),
    prod("TEST-SIL", "silencer", "smc"),
    prod("TEST-CV", "check-valve", "smc"),
    prod("TEST-SA", "shock-absorber", "smc"),
    prod("TEST-SENSOR", "sensor", "smc"),
    prod("TEST-FITTING", "fitting", "smc"),
  ];
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "TEST-PRIMARY", isVerticalLoad: true, isHighSpeed: true,
    isEndPosDetect: true, unitCount: 6, products,
  }));
  const byRole = (re: RegExp) => rows.find((r) => re.test(r.role));
  assertEquals(rows[0].quantity, 6, "primary actuator");
  assertEquals(byRole(/pilotmanövrerad backslagsventil/i)?.quantity, 6, "check valve");
  assertEquals(byRole(/magnetventil \(5\/2/i)?.quantity, 6, "individual valve");
  assertEquals(byRole(/ljuddämpare/i)?.quantity, 12, "silencer (2 × 6, no valve terminal)");
  assertEquals(byRole(/strypbackventil/i)?.quantity, 12, "flow control (2 × 6)");
  assertEquals(byRole(/hydraulisk stötdämpare/i)?.quantity, 12, "shock absorber (2 × 6)");
  assertEquals(byRole(/ändlägesgivare \(hemläge/i)?.quantity, 12, "end-position sensor (2 × 6)");
  assertEquals(byRole(/snabbkoppling/i)?.quantity, 24, "push-in fitting (4 × 6)");
});

Deno.test("unitCount does NOT scale the valve terminal itself -- one manifold serves all stations by design", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "TEST-PRIMARY", valveTerminal: true, unitCount: 6,
    products: [prod("TEST-VT", "valve-terminal", "festo")],
  }));
  const vtRow = rows.find((r) => /ventilramp/i.test(r.role));
  assert(vtRow, "expected a valve-terminal row");
  assertEquals(vtRow!.quantity, 1, "valve terminal stays a single shared manifold");
  assert(/6 ventilposition/i.test(vtRow!.reason), "expected the sizing note to state the required valve-position count");
});

Deno.test("unitCount does NOT scale the FRL -- one central air-prep unit feeds all stations by design", () => {
  const rows = buildMandatoryBomRows(bomCtx({ primarySku: "TEST-PRIMARY", unitCount: 6 }));
  // Leta på kind, inte på role. role är lokaliserad visningstext och ändrar sig
  // med produkten -- raden heter numera "Filterregulator" eller "Luftfilter
  // (UTAN regulator)" beroende på vad katalogmatchen faktiskt är. kind är den
  // stabila komponenttypen, precis som kommentaren vid BomKind slår fast.
  const frlRow = rows.find((r) => r.kind === "frl");
  assert(frlRow, "expected an FRL row");
  assertEquals(frlRow!.quantity, 1, "FRL stays a single shared unit");
  assert(/6 station/i.test(frlRow!.reason), "expected the sizing note to state the station count");
});

Deno.test("unitCount does NOT scale the silencer when a valve terminal centralizes exhaust, but DOES when there's no terminal", () => {
  const withTerminal = buildMandatoryBomRows(bomCtx({ primarySku: "TEST-PRIMARY", valveTerminal: true, unitCount: 6 }));
  const withoutTerminal = buildMandatoryBomRows(bomCtx({ primarySku: "TEST-PRIMARY", valveTerminal: false, unitCount: 6 }));
  assertEquals(withTerminal.find((r) => /ljuddämpare/i.test(r.role))?.quantity, 1);
  assertEquals(withoutTerminal.find((r) => /ljuddämpare/i.test(r.role))?.quantity, 12);
});

Deno.test("unitCount does NOT scale pure warning/requirement rows -- they apply to the system once, not per station", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "TEST-PRIMARY", isWashdown: true, isSpolmiljo: true, isHighTemp: true, isSilSafety: true, unitCount: 6,
  }));
  for (const role of [/Washdown IP69K/i, /Tätningsmaterial/i, /Säkerhetsfunktion/i]) {
    const row = rows.find((r) => role.test(r.role));
    assert(row, `expected a row matching ${role}`);
    assertEquals(row!.quantity, 1, `warning row ${role} must not scale with unitCount`);
  }
});

// ── Maskingrafen: deterministisk topologi ur stycklistan ─────────────────────
// Steg 1 av maskinmodellen. Kopplingarna härleds ur komponenttyperna i stället
// för att frågas av en LLM -- topologin i ett pneumatiskt system är bestämd,
// och att låta en modell gissa den bjuder in samma sorts påhitt som de
// uppdiktade kraftberäkningarna vi rättade 2026-09-08.

function row(kind: BomRow["kind"], sku: string = kind.toUpperCase(), role: string = kind): BomRow {
  return { sku, quantity: 1, kind, role, reason: "" };
}

/** Alla icke-varningsrader ska hänga ihop med aktuatorn — grinden för steg 1. */
function isConnected(rows: BomRow[]): boolean {
  const edges = deriveBomConnections(rows);
  const adj = new Map<number, number[]>();
  for (const e of edges) {
    (adj.get(e.fromIndex) ?? adj.set(e.fromIndex, []).get(e.fromIndex)!).push(e.toIndex);
    (adj.get(e.toIndex) ?? adj.set(e.toIndex, []).get(e.toIndex)!).push(e.fromIndex);
  }
  const start = rows.findIndex(r => r.kind === "actuator");
  if (start < 0) return false;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) for (const n of adj.get(queue.pop()!) ?? []) {
    if (!seen.has(n)) { seen.add(n); queue.push(n); }
  }
  return rows.every((r, i) => r.kind === "warning" || seen.has(i));
}

Deno.test("luftvägen kopplas FRL -> ramp -> ventil -> aktuator", () => {
  const rows = [row("actuator"), row("valve"), row("valve_terminal"), row("frl")];
  const e = deriveBomConnections(rows);
  const has = (f: number, t: number, r: string) => e.some(x => x.fromIndex === f && x.toIndex === t && x.relation === r);
  assert(has(0, 1, "controlled_by"), "aktuatorn styrs av ventilen");
  assert(has(1, 2, "air_supply"), "ventilen matas från rampen");
  assert(has(2, 3, "air_supply"), "rampen matas från FRL:en");
});

Deno.test("hela stycklistan hänger ihop med aktuatorn", () => {
  const rows = [
    row("actuator"), row("valve"), row("valve_terminal"), row("frl"), row("silencer"),
    row("flow_control"), row("sensor"), row("check_valve"), row("rod_lock"),
    row("mount"), row("tubing"), row("fitting"), row("shock_absorber"),
  ];
  assert(isConnected(rows), "varje komponent ska nås från aktuatorn");
});

Deno.test("elektrisk kedja: drivsteg styr motor, motor sitter på aktuatorn", () => {
  const rows = [row("actuator"), row("motor"), row("drive"), row("cable")];
  const e = deriveBomConnections(rows);
  assert(e.some(x => x.fromIndex === 1 && x.toIndex === 2 && x.relation === "controlled_by"));
  assert(e.some(x => x.fromIndex === 1 && x.toIndex === 0 && x.relation === "mounted_on"));
  assert(e.some(x => x.fromIndex === 3 && x.toIndex === 2 && x.relation === "accessory"), "kabeln hör till drivsteget");
  assert(isConnected(rows));
});

Deno.test("varningsrader får aldrig kopplingar", () => {
  const rows = [row("actuator"), row("warning", "⚠️", "⚠️ ATEX"), row("valve")];
  const e = deriveBomConnections(rows);
  assert(!e.some(x => x.fromIndex === 1 || x.toIndex === 1), "en annotation är ingen nod");
});

Deno.test("fleraxligt: ventil och givare paras mot rätt axel", () => {
  const rows = [
    { ...row("actuator"), role: "Aktuator — X-axel" },
    { ...row("actuator"), role: "Aktuator — Y-axel" },
    row("valve"), row("valve"),
    row("sensor"), row("sensor"),
  ];
  const e = deriveBomConnections(rows);
  assert(e.some(x => x.fromIndex === 0 && x.toIndex === 2 && x.relation === "controlled_by"));
  assert(e.some(x => x.fromIndex === 1 && x.toIndex === 3 && x.relation === "controlled_by"));
  assert(e.some(x => x.fromIndex === 4 && x.toIndex === 0 && x.relation === "senses"));
  assert(e.some(x => x.fromIndex === 5 && x.toIndex === 1 && x.relation === "senses"));
});

Deno.test("ojämna antal faller tillbaka på primäraktuatorn i stället för att gissa", () => {
  const rows = [row("actuator"), row("actuator"), row("valve")];
  const e = deriveBomConnections(rows);
  assertEquals(e.filter(x => x.relation === "controlled_by").length, 1);
  assert(e.some(x => x.fromIndex === 0 && x.toIndex === 2), "faller tillbaka på primären");
});

Deno.test("inga självlänkar och inga dubbletter — bom_connections förbjuder båda", () => {
  const rows = [
    row("actuator"), row("valve"), row("frl"), row("sensor"), row("sensor"),
    row("mount"), row("mount"), row("mount"),
  ];
  const e = deriveBomConnections(rows);
  assert(!e.some(x => x.fromIndex === x.toIndex), "självlänk");
  const keys = e.map(x => `${x.fromIndex}>${x.toIndex}>${x.relation}`);
  assertEquals(keys.length, new Set(keys).size, "dubblett");
});

Deno.test("utan aktuator finns ingen maskin att koppla ihop", () => {
  assertEquals(deriveBomConnections([row("valve"), row("frl")]).length, 0);
});

Deno.test("delsystem: delad infrastruktur skiljs från maskinen, varningar grupperas inte", () => {
  const rows = [row("actuator"), row("frl"), row("valve_terminal"), row("valve"), row("warning")];
  assertEquals(deriveSubsystems(rows), ["main", "air_prep", "air_prep", "main", null]);
});

Deno.test("delsystem: fleraxligt ger en grupp per axel", () => {
  const rows = [
    { ...row("actuator"), role: "Aktuator — X-axel" },
    { ...row("actuator"), role: "Aktuator — Y-axel" },
    row("frl"),
  ];
  assertEquals(deriveSubsystems(rows), ["axis_x", "axis_y", "air_prep"]);
});

Deno.test("en riktig stycklista från buildMandatoryBomRows ger en sammanhängande graf", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    isVerticalLoad: true, isRodLock: true, isEndPosDetect: true, isMounting: true,
  }));
  assert(rows.length > 3, "stycklistan ska ha innehåll");
  assert(rows.every(r => typeof r.kind === "string"), "varje rad måste ha en kind");
  assert(isConnected(rows), "den verkliga stycklistan ska hänga ihop");
});

Deno.test("bedomLosning: en enda oviss rad gör lösningen icke beställningsklar", () => {
  // Hela poängen med statusfältet. En lösning med en overifierad givare är
  // inte "nästan klar" -- den som beställer på den upptäcker felet först när
  // delarna inte passar ihop.
  const rader: BomRow[] = [
    { sku: "MW-CMPC-80", quantity: 1, kind: "actuator", role: "Primär aktuator", reason: "", verifiering: "verifierad" },
    { sku: "FE-SIES-8M", quantity: 2, kind: "sensor", role: "Ändlägesgivare", reason: "",
      verifiering: "kraver_verifiering", verifieringsskal: "Givaren är Festo, cylindern Metal Work." },
  ];
  const d = bedomLosning(rader);
  assert(!d.bestallningsklar, "en overifierad givare ska blockera");
  assertEquals(d.blockerande.length, 1);
  assertEquals(d.blockerande[0].sku, "FE-SIES-8M");
});

Deno.test("bedomLosning: ett ouppfyllt obligatoriskt krav blockerar", () => {
  const rader: BomRow[] = [
    { sku: "MW-CMPC-80", quantity: 1, kind: "actuator", role: "Primär aktuator", reason: "", verifiering: "verifierad" },
    { sku: "SPECIFY", quantity: 1, kind: "mount", role: "Styrning / vridskydd", reason: "",
      verifiering: "ej_uppfyllt", verifieringsskal: "Ingen artikel matchar kravet." },
  ];
  assert(!bedomLosning(rader).bestallningsklar, "ej_uppfyllt ska blockera");
});

Deno.test("bedomLosning: avvikelse och kräver-konfiguration blockerar INTE", () => {
  // En avvikelse är redovisad och accepterad; en familjeprodukt konfigureras
  // vid order. Båda är ärliga tillstånd, inte okända.
  const rader: BomRow[] = [
    { sku: "A", quantity: 1, kind: "actuator", role: "Aktuator", reason: "", verifiering: "avvikelse" },
    { sku: "B", quantity: 1, kind: "valve", role: "Ventil", reason: "", verifiering: "kraver_konfiguration" },
    { sku: "C", quantity: 1, kind: "frl", role: "FRL", reason: "" },
  ];
  assert(bedomLosning(rader).bestallningsklar, "dessa tre ska inte blockera");
});

Deno.test("satteVerifiering: SPECIFY på ett obligatoriskt krav blir ej_uppfyllt", () => {
  const rows = buildMandatoryBomRows(bomCtx({ primarySku: "TEST-PRIMARY", isGuided: true }));
  const styrning = rows.find(r => r.kind === "mount" && r.sku === "SPECIFY");
  if (styrning) {
    assertEquals(styrning.verifiering, "ej_uppfyllt",
      "styrning utan artikel är ett OUPPFYLLT krav, inte bara overifierat");
    assert((styrning.verifieringsskal ?? "").length > 0, "skälet ska stå i klartext");
  }
});

// ── "Verifierad" måste betyda att något kontrollerats ────────────────────────
// Hittat 2026-10-01 i ett eget hårt testfall: kunden angav 90 °C, och
// FE-HGL-1-4-B -- den pilotstyrda backslagsventil vars enda uppgift är att
// hålla 45 kg kvar ovanför en operatör -- är katalogsatt -10…+70 °C. Raden kom
// tillbaka märkt "verifierad". satteVerifiering jämförde aldrig en enda siffra:
// allt som inte var en SPECIFY-rad eller en korsfabrikatsgivare föll igenom
// till "verifierad".
Deno.test("temperatur: en artikel under kravet är ej_uppfyllt, inte verifierad", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-CYL",
    primaryBrand: "festo",
    kravTempC: 90,
    products: [
      prod("FE-CYL", "cylinders", "festo", { temp_range: "-20…+80", bore_mm: 50 }),
    ],
  }));
  const primar = rows.find(r => r.sku === "FE-CYL");
  assert(primar, "primäraktuatorn ska finnas i listan");
  assertEquals(primar!.verifiering, "ej_uppfyllt");
  assert(/80/.test(primar!.verifieringsskal ?? ""), "skälet ska ange artikelns gräns");
  assert(/90/.test(primar!.verifieringsskal ?? ""), "skälet ska ange kravet");
});

Deno.test("temperatur: saknad uppgift ger kraver_verifiering, aldrig verifierad", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-CYL",
    primaryBrand: "festo",
    kravTempC: 90,
    products: [prod("FE-CYL", "cylinders", "festo", { bore_mm: 50 })],
  }));
  const primar = rows.find(r => r.sku === "FE-CYL");
  assertEquals(primar!.verifiering, "kraver_verifiering");
});

// Det här testet hävdade tidigare "verifierad" när INGENTING kontrollerats, och
// låste därmed fast det hål som #313 skulle laga: under 80 °C hoppas hela
// temperaturblocket över, och varje rad föll igenom till ett godkännande. En
// adversariell granskning 2026-10-02 pekade ut just det -- "sviten är grön
// därför att den kodifierar hålet".
//
// Nu är utfallet "inga_krav": blockerar inte, men lovar heller ingenting.
Deno.test("utan angivet krav påstås ingen verifiering", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-CYL",
    primaryBrand: "festo",
    kravTempC: 0,
    products: [prod("FE-CYL", "cylinders", "festo", { bore_mm: 50 })],
  }));
  const primar = rows.find(r => r.sku === "FE-CYL");
  assertEquals(primar!.verifiering, "inga_krav");
  assertEquals(bedomLosning(rows).blockerande.some(b => b.sku === "FE-CYL"), false,
    "inga_krav får inte blockera en beställning");
});

// "Verifierad" ska säga VAD som prövades, annars är ordet lika tomt som förut.
Deno.test("verifierad anger vad som prövades", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-CYL",
    primaryBrand: "festo",
    kravTempC: 90,
    primarySpecs: { temp_range: "-20…+120" },
    products: [],
  }));
  const primar = rows.find(r => r.sku === "FE-CYL");
  assertEquals(primar!.verifiering, "verifierad");
  assert(/90/.test(primar!.verifieringsskal ?? ""), "skälet ska nämna kravet");
  assert(/120/.test(primar!.verifieringsskal ?? ""), "skälet ska nämna artikelns gräns");
});

// Köldkrav kontrollerades inte alls före 2026-10-02.
Deno.test("kyla: en artikel som inte går tillräckligt lågt är ej_uppfyllt", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-CYL",
    primaryBrand: "festo",
    kravTempMinC: -30,
    primarySpecs: { temp_range: "-10…+60" },
    products: [],
  }));
  const primar = rows.find(r => r.sku === "FE-CYL");
  assertEquals(primar!.verifiering, "ej_uppfyllt");
  assert(/-10/.test(primar!.verifieringsskal ?? ""));
});

Deno.test("kyla: en artikel som går tillräckligt lågt blir verifierad", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-CYL",
    primaryBrand: "festo",
    kravTempMinC: -30,
    primarySpecs: { temp_range: "-40…+80" },
    products: [],
  }));
  assertEquals(rows.find(r => r.sku === "FE-CYL")!.verifiering, "verifierad");
});

// Grinden ska dra slutsatsen av raderna, inte bara bära dem.
Deno.test("bedomLosning blockerar när en rad är ej_uppfyllt", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-CYL",
    primaryBrand: "festo",
    kravTempC: 90,
    products: [prod("FE-CYL", "cylinders", "festo", { temp_range: "-20…+80", bore_mm: 50 })],
  }));
  const dom = bedomLosning(rows);
  assertEquals(dom.bestallningsklar, false);
  assert(dom.blockerande.some(b => b.sku === "FE-CYL"), "aktuatorn ska stå bland de blockerande");
});

// Primären finns ofta INTE i `products` -- den är en slice på 30 rader per
// kategori, vilket fetchPrimaryInfo:s egen kommentar varnar för. Slogs den upp
// bara där fick själva cylindern "kräver verifiering" med skälet "vi har ingen
// temperaturuppgift för artikeln", trots att uppgiften hämtats en funktion
// tidigare och kastats bort. En blockerande rad fäller hela lösningen, så det
// falska skälet stoppade beställningen.
Deno.test("temperatur: primären kontrolleras mot sina egna specar när den saknas i products", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "METALWORK-HCR-50",
    primaryBrand: "metal-work",
    kravTempC: 90,
    primarySpecs: { temp_range: "-20…+120", bore_mm: 50 },
    products: [],            // primären saknas, precis som i verkligheten
  }));
  const primar = rows.find(r => r.sku === "METALWORK-HCR-50");
  assert(primar, "primäraktuatorn ska finnas i listan");
  assertEquals(primar!.verifiering, "verifierad", "120 °C täcker kravet 90 °C");
});

Deno.test("temperatur: primärens egna specar fäller den när de inte räcker", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "METALWORK-HCR-50",
    primaryBrand: "metal-work",
    kravTempC: 90,
    primarySpecs: { temp_range: "-20…+80", bore_mm: 50 },
    products: [],
  }));
  const primar = rows.find(r => r.sku === "METALWORK-HCR-50");
  assertEquals(primar!.verifiering, "ej_uppfyllt");
  assert(/80/.test(primar!.verifieringsskal ?? ""));
});

// ── Familjerad med ett specifikt artikelnummer ───────────────────────────────
// Hittat 2026-10-02: FESTO-193986 står i katalogen som "ISO cylinder" med
// bore_mm = 8–63, alltså hela DSNU-serien. Hos Festo är 193986 en DSNU-8 --
// ÅTTA millimeters borrning. Testfallet behövde 63 mm och raden visade ändå
// det numret. 17 artiklar i katalogen har den formen.
Deno.test("familjerad märks kraver_konfiguration, inte verifierad", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FESTO-193986",
    primaryBrand: "festo",
    requiredStrokeMm: 200,   // slaglängd angiven, så familjefrågan prövas isolerat
    primarySpecs: { bore_mm: "8–63", stroke_mm: "500 mm" },
    products: [],
  }));
  const primar = rows.find(r => r.sku === "FESTO-193986");
  assertEquals(primar!.verifiering, "kraver_konfiguration");
  assert(/8–63/.test(primar!.verifieringsskal ?? ""), "skälet ska citera spannet");
  // Att välja utförande vid order är ett normalt steg -- det ska inte blockera.
  assertEquals(bedomLosning(rows).blockerande.some(b => b.sku === "FESTO-193986"), false);
});

// Temperaturen går före: en komponent som inte tål miljön är fel oavsett
// vilket utförande man konfigurerar fram.
Deno.test("temperatur väger tyngre än konfiguration", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FESTO-193986",
    primaryBrand: "festo",
    kravTempC: 90,
    primarySpecs: { bore_mm: "8–63", temp_range: "-20…+60" },
    products: [],
  }));
  assertEquals(rows.find(r => r.sku === "FESTO-193986")!.verifiering, "ej_uppfyllt");
});


// ── Slaglängd som ingen angett ───────────────────────────────────────────────
// Hittat 2026-10-02 i en genomgång av fyra typfall: ett stoppdon för 5 kg
// kartonger fick "AVENTICS KPZ Ø20 kompaktcylinder, 5 mm slag", och ett
// plock-och-placera med vakuum fick Ø16 med 5 mm slag. Ett stoppdon måste resa
// sig upp i kartongens bana -- fem millimeter räcker inte till något.
//
// Rankningen rörs inte: actuatorTier:s beteende när inget krav finns är
// avsiktligt och regressionstestat. Det som saknades var att SÄGA att
// slaglängden saknas i stället för att välja åt kunden och tiga.
Deno.test("slaglängd saknas: aktuatorn märks kraver_verifiering", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "AV-KPZ-20",
    primaryBrand: "aventics",
    requiredStrokeMm: 0,
    primarySpecs: { stroke_mm: "5 mm", bore_mm: 20 },
    products: [],
  }));
  const primar = rows.find(r => r.sku === "AV-KPZ-20");
  assertEquals(primar!.verifiering, "kraver_verifiering");
  assert(/slagl[äa]ngd/i.test(primar!.verifieringsskal ?? ""), "skälet ska nämna slaglängd");
  assertEquals(bedomLosning(rows).bestallningsklar, false, "utan slaglängd är lösningen inte beställningsklar");
});

// En vridenhet har en vinkel, inte en slaglängd. Den ska inte fällas på ett
// mått den aldrig haft.
Deno.test("slaglängd: en produkt utan slagmått berörs inte", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "ARP-063-180",
    primaryBrand: "camozzi",
    requiredStrokeMm: 0,
    primarySpecs: { rotation_deg: "180", torque_nm: "12" },
    products: [],
  }));
  const primar = rows.find(r => r.sku === "ARP-063-180");
  assertEquals(primar!.verifiering, "inga_krav");
});

// Räkningen finns för att tystnad inte ska läsas som godkännande.
Deno.test("bedomLosning räknar hur mycket som faktiskt prövades", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FE-CYL",
    primaryBrand: "festo",
    requiredStrokeMm: 100,
    kravTempC: 90,
    primarySpecs: { stroke_mm: "200 mm", temp_range: "-20…+120" },
    products: [],
  }));
  const dom = bedomLosning(rows);
  assertEquals(dom.kontrollerat.verifierade, 1, "primären prövades mot temperaturkravet");
  assert(dom.kontrollerat.rader > 1, "listan har fler rader än primären");
  assertEquals(dom.kontrollerat.rader, dom.kontrollerat.verifierade + dom.kontrollerat.utan_krav + dom.kontrollerat.blockerande);
});


// ── Familjens borrning i följdraderna (hittat 2026-10-02) ────────────────────
// En last om 45 kg, vertikal, operatör under lasten. Primären FESTO-193986
// har bore_mm "8–63". Stångbromsen skulle beställas i "Ø8" -- firstNumAbs tog
// spannets första tal. handleBom väljer nu storleken via familjeborrning() och
// lämnar den i primaryBoreMm.
const DSNU_SPANN = { bore_mm: "8–63", stroke_mm: "500 mm" };

Deno.test("familj: stångbromsen följer storleken som valts för lasten", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FESTO-193986", primaryIsFamilyProd: true, primaryBoreMm: 50,
    primarySpecs: DSNU_SPANN, isVerticalLoad: true, isRodLock: true,
    products: [prod("FESTO-193986", "cylinder", "festo", DSNU_SPANN)],
  }));
  const las = rows.find(r => r.kind === "rod_lock");
  assert(las, "stångbroms ska finnas");
  assert(/Ø50/.test(las!.reason), `stångbromsen ska nämna Ø50: ${las!.reason}`);
  assert(!/Ø8\b/.test(las!.reason) && !/Ø63/.test(las!.reason), "aldrig ett tal ur spannet");
});

Deno.test("familj utan last: följdraderna påstår ingen borrning", () => {
  // Normaliserade specar har bore_mm = familjens max (63). Varken det eller
  // spannets första tal får bli stångbromsens storlek.
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FESTO-193986", primaryIsFamilyProd: true, primaryBoreMm: 0,
    primarySpecs: DSNU_SPANN, isVerticalLoad: true, isRodLock: true, isMounting: true,
    products: [prod("FESTO-193986", "cylinder", "festo", DSNU_SPANN)],
  }));
  for (const r of rows.filter(r => r.kind === "rod_lock" || r.kind === "mount")) {
    assert(!/Ø\d/.test(r.reason), `${r.kind} ska inte gissa en borrning: ${r.reason}`);
  }
  assert(/cylinderns borrning/.test(rows.find(r => r.kind === "rod_lock")!.reason));
});

Deno.test("familj: primärradens motivering säger vilken storlek som ska beställas", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "FESTO-193986", primaryIsFamilyProd: true, primaryBoreMm: 50,
    primarySpecs: DSNU_SPANN, requiredStrokeMm: 400,
    products: [],
  }));
  const primar = rows.find(r => r.sku === "FESTO-193986")!;
  assert(/beställ i Ø50/.test(primar.reason), primar.reason);
  assertEquals(primar.verifiering, "kraver_konfiguration");
  assert(/Beställ i Ø50/.test(primar.verifieringsskal ?? ""), primar.verifieringsskal);
});

Deno.test("familj: en kommalista räknas också som familj", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "SMC-CQ2", primaryBrand: "smc", requiredStrokeMm: 50,
    primarySpecs: { bore_mm: "12,16,20,25,32,40,50,63", stroke_mm: "300 mm" },
    products: [],
  }));
  assertEquals(rows.find(r => r.sku === "SMC-CQ2")!.verifiering, "kraver_konfiguration");
});

Deno.test("enskild artikel: stångbromsen följer artikelns egen borrning som förut", () => {
  const rows = buildMandatoryBomRows(bomCtx({
    primarySku: "0822040200", primaryBoreMm: 0,
    primarySpecs: { bore_mm: "40 mm" }, isVerticalLoad: true, isRodLock: true,
    products: [prod("0822040200", "cylinder", "bosch-rexroth", { bore_mm: "40 mm", stroke_mm: "200 mm" })],
  }));
  assert(/Ø40/.test(rows.find(r => r.kind === "rod_lock")!.reason));
});


// ── Ventilraden ska vara en 5/2-vägs styrventil ─────────────────────────────
// Hittat 2026-10-06: raden tog den första produkten i kategorin "valve". I
// drift var det en 5/2-ventil av en slump; nästa i kön var en vakuumejektor.
const namngiven = (sku: string, name: string, specs: Record<string, unknown> = {}): CatalogProduct =>
  ({ ...prod(sku, "valve", "festo", specs), name });

Deno.test("ventilraden väljer en 5/2-ventil, inte spole, ejektor eller kulventil", () => {
  const pool = [
    namngiven("FE-VADMI-95-AP", "VADMI-95 vakumejektor M5"),
    namngiven("FESTO-4526", "Festo MSFG-12 magnetspole 12 V DC"),
    namngiven("FESTO-4745214", "Festo VZBE kulventil G1/4"),
    namngiven("FE-VZWE-1-M22C-G18-135", "VZWE-1 2/2-ventil G1/8"),
    namngiven("FE-VUVG-L10-M52-MT-M5", "VUVG-L10 5/2 monostabil M5"),
  ];
  assertEquals(findCatalogProductByType("valve", pool)?.sku, "FE-VUVG-L10-M52-MT-M5");
  assertEquals(arStyrventil52(namngiven("FESTO-533378", "Festo VMPA1 ventil", { function: "5/2 monostabil" })), true);
});

Deno.test("utan 5/2-ventil i poolen blir raden SPECIFY, inte fel komponent", () => {
  const pool = [namngiven("FE-VADMI-95-AP", "VADMI-95 vakumejektor M5"), namngiven("FESTO-4526", "Festo MSFG-12 magnetspole 12 V DC")];
  assertEquals(findCatalogProductByType("valve", pool), null);
});

// ── Miljö och säkerhetsnivå (2026-10-08) ─────────────────────────────────────
// En doseringslinje med "frätande vätskor" fick "KRAV IP69K", och "nödstopp"
// gav "KRAV SIL 2 / PLd" -- ett krav ingen ställt.
Deno.test("korrosiv miljö utan spolning: materialrad, ingen IP69K", () => {
  const rows = buildMandatoryBomRows(bomCtx({ primarySku: "TEST-PRIMARY", isWashdown: true, isSpolmiljo: false, isFoodGrade: false }));
  assert(rows.some((r) => /Korrosiv miljö/.test(r.role)), "korrosionsraden saknas");
  assert(!rows.some((r) => /IP69K/.test(`${r.role} ${r.reason}`)), "IP69K ska inte krävas");
});

Deno.test("spolmiljö: IP69K-raden finns kvar", () => {
  const rows = buildMandatoryBomRows(bomCtx({ primarySku: "TEST-PRIMARY", isWashdown: true, isSpolmiljo: true }));
  assert(rows.some((r) => /Washdown IP69K/.test(r.role)));
});

Deno.test("säkerhetsfunktion utan angiven nivå: ingen nivå skrivs ut", () => {
  const rows = buildMandatoryBomRows(bomCtx({ primarySku: "TEST-PRIMARY", isSilSafety: true, sakerhetsniva: null }));
  const rad = rows.find((r) => /Säkerhetsfunktion/.test(r.role))!;
  assert(rad, "säkerhetsraden saknas");
  assert(!/SIL\s?2|PLd|PL d\b(?!.*krävs normalt)/.test(rad.role), rad.role);
  assert(!/VFS/.test(rad.reason), "SMC VFS är ingen säkerhetsventil");
});

Deno.test("säkerhetsfunktion med angiven nivå: nivån står i raden", () => {
  const rows = buildMandatoryBomRows(bomCtx({ primarySku: "TEST-PRIMARY", isSilSafety: true, sakerhetsniva: "PL d" }));
  assert(rows.some((r) => r.role === "⚠️ Säkerhetsventil för PL d"));
});

// ── Kundlösningens produktförslag (2026-10-08) ───────────────────────────────
// Slakteri och livsmedel med spolning föreslog SMC HY "IP69K/316L" (aluminiumhus,
// enligt SMC inte för livsmedelszonen), Rexroth "EMC-HD-XC" och Parker ETH
// "Washdown" (IP54/IP65). Förslagen ska bara innehålla belagda uppgifter.
const OBELAGDA = /\bHY-?Serie|serie SMC HY|EMC-HD|\bETH\b|316L|P1S (Stainless )?Washdown/i;

for (const [fall, text] of [
  ["slakteri, vertikal last", "Lyftcylinder på slakteri som lyfter slaktkroppar vertikalt, 40 kg, daglig högtryckstvätt"],
  ["mejeri, horisontell", "Skjutcylinder för förpackningslinje i mejeri, daglig högtryckstvätt, livsmedelszon"],
] as const) {
  Deno.test(`kundlösning (${fall}): inga obelagda produktpåståenden, på alla språk`, () => {
    const h = detectHazards(text, {}, "sv");
    assert(h.isWashdown && h.isFoodGrade, "förfrågan ska tolkas som livsmedel + spolning");
    for (const locale of ["sv", "en", "de", "es"]) {
      const why = buildCustomSolutionOption(0, locale, 0, true, h).why;
      assert(!OBELAGDA.test(why), `${locale}: ${why}`);
      assert(/Parker P1S/.test(why) && /SMC HF2A-LEY/.test(why), `${locale}: belagda förslag saknas`);
      assert(/IP67/.test(why) || !h.isVerticalLoad, `${locale}: kablarnas IP67 ska nämnas`);
    }
  });
}

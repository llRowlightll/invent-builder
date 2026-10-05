// Familjer i urvalet: borrning, slag och livsmedel.
// Run: deno test supabase/functions/groq-advisor/familjer.test.ts
//
// Hittat i drift 2026-10-05 med "Cylinder för livsmedelsindustri med daglig
// vattenspolning, Ø32, 100 mm slag": loggen visade qualified=1. Bästa valet
// blev MW-HCR-32 (500 mm mot 100 mm, "begränsa rörelsen mekaniskt"), fast
// katalogen har FESTO-DSBF (FDA-tätningar, NSF H1) och SMC-CM2. Raderna nedan
// är katalogens egna, hämtade samma dag.
import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  type CatalogProduct,
  type ScoringCtx,
  erbjuderBorrning,
  harLivsmedelsstod,
  isFamilyProduct,
  isWashdownProduct,
  normalizeKeySpecs,
  parseStrokeFromSpecs,
  rankActuators,
  scoreProduct,
} from "./scoring.ts";

const rad = (sku: string, name: string, brand: string, specs: Record<string, unknown>): CatalogProduct =>
  ({ sku, name, category: "cylinder", brand, key_specs: normalizeKeySpecs(specs) });

const HCR32 = rad("MW-HCR-32", "Metal Work ISO 15552 HCR Ø32", "metal-work", {
  ip_rating: "IP67", corrosion_resistance: "Anti-corrosion HCR", standard: "ISO 15552",
  bore_mm: "32", stroke_mm: "500 mm",
});
const DSBF = rad("FESTO-DSBF", "DSBF – Stainless Steel ISO 15552 Cylinder", "festo", {
  material: "Stainless steel body; FDA seals; NSF-H1 lube", standard: "ISO 15552",
  bore_mm: "32–125", stroke_mm: "2000 mm",
});
const CM2 = rad("SMC-CM2", "CM2 – Compact Stainless Cylinder", "smc", {
  material: "stainless steel", bore_mm: "20–40",
  stroke_mm: "25–300 mm (standard); tillverkas 5–1000/1500/2000 mm (ø20/ø25/ø32–40)",
});
const SERIE90 = rad("90M2A032A050", "Serie 90 – Stainless Steel Cylinder Ø32×50", "camozzi", {
  ip_rating: "IP67", material: "Stainless steel AISI 316L", bore_mm: "32", stroke_mm: "50 mm",
});
const PRA32 = rad("0822120004", "AVENTICS PRA Ø32 100mm ISO 15552 Cylinder", "aventics", {
  bore_mm: "32", stroke_mm: "100 mm",
});

const ctx = (over: Partial<ScoringCtx> = {}): ScoringCtx => ({
  requiredStroke: 0, minBoreMm: 0, isHighPrecision: false, isHighSpeed: false,
  isVertical: false, isWashdown: false, isAtex: false, ...over,
});

Deno.test("ett slagspann i stroke_mm läses som standardspannets max, inte första talet", () => {
  assertEquals(parseStrokeFromSpecs(CM2.key_specs), 300);
  assert(isFamilyProduct(CM2));
  assertEquals(parseStrokeFromSpecs(DSBF.key_specs), 2000);
  assertEquals(parseStrokeFromSpecs(SERIE90.key_specs), 50);
});

Deno.test("Metal Works storleksrader är serier, artiklar med slag i namnet är det inte", () => {
  assert(isFamilyProduct(HCR32));
  assertEquals(isFamilyProduct(SERIE90), false);
  assertEquals(isFamilyProduct(PRA32), false);
});

Deno.test("en familj erbjuder borrningarna i sitt spann", () => {
  assert(erbjuderBorrning(DSBF, 32));
  assert(erbjuderBorrning(DSBF, 125));
  assertEquals(erbjuderBorrning(DSBF, 30), false);  // ingen standardstorlek
  assertEquals(erbjuderBorrning(DSBF, 25), false);  // under spannet
  assert(erbjuderBorrning(CM2, 32));
  assert(erbjuderBorrning(HCR32, 32));
  assertEquals(erbjuderBorrning(HCR32, 40), false);
  assertEquals(erbjuderBorrning(PRA32, 0), false);
});

Deno.test("livsmedelsstöd kräver uttryckliga uppgifter, inte bara rostfritt", () => {
  assert(harLivsmedelsstod(DSBF));
  assertEquals(harLivsmedelsstod(CM2), false);
  assertEquals(harLivsmedelsstod(HCR32), false);
});

Deno.test("livsmedel, Ø32, 100 mm: DSBF före den korrosionsbeständiga ISO-cylindern", () => {
  const pool = [HCR32, DSBF, CM2, SERIE90].filter(isWashdownProduct).filter((p) => erbjuderBorrning(p, 32));
  assertEquals(pool.length, 4);
  const rankad = rankActuators(pool, ctx({ requiredStroke: 100, isWashdown: true, isFood: true, explicitBoreMm: 32 }));
  assertEquals(rankad[0].sku, "FESTO-DSBF");
  // Ø32×50 klarar inte 100 mm och hamnar sist -- den visas inte som en träff.
  assertEquals(rankad[rankad.length - 1].sku, "90M2A032A050");
});

Deno.test("en konkret artikel som klarar kravet går fortfarande före varje familj", () => {
  const rankad = rankActuators([HCR32, DSBF, PRA32], ctx({ requiredStroke: 100, explicitBoreMm: 32 }));
  assertEquals(rankad[0].sku, "0822120004");
});

Deno.test("familjens maxslag är ingen överdimensionering", () => {
  // DSBF beställs i 100 mm. Att serien går till 2000 mm får inte kosta poäng --
  // förut gav överskottet 0 av 25 slagpoäng.
  const DSBF100 = rad("FESTO-DSBF", DSBF.name, "festo", { ...DSBF.key_specs, stroke_mm: "100 mm" });
  const c = ctx({ requiredStroke: 100, isWashdown: true, explicitBoreMm: 32 });
  assertEquals(scoreProduct(DSBF, c), scoreProduct(DSBF100, c));
  // En konkret artikel straffas fortfarande för överskjutande slag.
  const PRA500 = rad("0822120009", "AVENTICS PRA Ø32 500mm ISO 15552 Cylinder", "aventics", { bore_mm: "32", stroke_mm: "500 mm" });
  assert(scoreProduct(PRA500, c) < scoreProduct(PRA32, c));
});

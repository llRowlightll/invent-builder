/// <reference lib="deno.ns" />
// Körs med: deno test tests/marginal.test.ts
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@^1";
import { faktiskMarginal, giltigMarginal, misstankMarginal, saljpris, STANDARD_MARGINAL } from "../src/lib/marginal.ts";

Deno.test("ägarens 20 %: köper för 100, säljer för 125", () => {
  assertEquals(STANDARD_MARGINAL, 20);
  assertEquals(saljpris(100, 20), 125);
  // Bruttomarginal, inte påslag: 30 % ger 142,86, inte 130.
  assertAlmostEquals(saljpris(100, 30), 142.857, 0.001);
});

Deno.test("artikelns marginal används bara när den är rimlig", () => {
  assertEquals(giltigMarginal(22), 22);
  assertEquals(giltigMarginal(1), 1);
  assertEquals(giltigMarginal(95), 95);
  // 0,35 är den gamla bråktalsstandarden; saknad, noll och orimligt ger 20.
  assertEquals(giltigMarginal(0.35), 20);
  assertEquals(giltigMarginal(null), 20);
  assertEquals(giltigMarginal(undefined), 20);
  assertEquals(giltigMarginal(0), 20);
  assertEquals(giltigMarginal(96), 20);
  assertEquals(giltigMarginal(NaN), 20);
});

Deno.test("faktisk marginal följer ett handändrat pris", () => {
  assertEquals(faktiskMarginal(100, 125), 20);
  assertEquals(faktiskMarginal(100, 100), 0);
  assert((faktiskMarginal(100, 90) ?? 0) < 0);
  assertEquals(faktiskMarginal(100, 0), null);
});

Deno.test("misstänkt marginal under 1 %", () => {
  assert(misstankMarginal(0.35));
  assert(misstankMarginal("0.35"));
  assert(!misstankMarginal(20));
  assert(!misstankMarginal(0));
  assert(!misstankMarginal(null));
});

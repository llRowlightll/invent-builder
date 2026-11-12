/// <reference lib="deno.ns" />
// Körs med: deno test tests/cylinderkalkyl.test.ts
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@^1";
import { rakna, standardKolvstang } from "../src/lib/cylinderkalkyl.ts";
import { usableForceN } from "../src/lib/physics.ts";

const bas = { borrMm: 50, tryckBar: 6, slagMm: 200, cyklerPerMin: 60, lastKg: 0, kolvstangMm: 0 };

Deno.test("kraften: samma modell som maskinbyggaren", () => {
  const r = rakna(bas);
  assertAlmostEquals(r.teoretiskUtN, 1178.1, 0.5); // π/4 · 50² · 0,6
  assertAlmostEquals(r.anvandbarUtN, usableForceN(50, 6), 0.01); // · 0,75
  assertEquals(r.kravN, 0);
  assertEquals(r.racker, null);
});

Deno.test("luften: guidens räkneexempel utan kolvstång, och lägre med", () => {
  // Guiden: Ø50, 200 mm, 6 bar → ≈ 5,4 Nl per dubbelslag, ≈ 320 Nl/min vid 60 cykler.
  const utan = rakna(bas);
  assertAlmostEquals(utan.nlPerCykel, 5.44, 0.05);
  assertAlmostEquals(utan.nlPerMin, 326, 3);
  const med = rakna({ ...bas, kolvstangMm: standardKolvstang(50)! });
  assertEquals(standardKolvstang(50), 20);
  assert(med.nlPerCykel < utan.nlPerCykel);
  assertAlmostEquals(med.nlPerCykel, 5.0, 0.05);
  assert(med.teoretiskInN < med.teoretiskUtN);
});

Deno.test("lasten: kravet med säkerhetsfaktor 2 och minsta borrning", () => {
  // 35 kg → 687 N krav. Ø40 ger 565 N användbart, Ø50 884 N (physics.ts:s exempel).
  const r = rakna({ ...bas, borrMm: 40, lastKg: 35 });
  assertAlmostEquals(r.kravN, 686.7, 0.1);
  assertEquals(r.racker, false);
  assertEquals(r.minstaBorrMm, 50);
  assertEquals(rakna({ ...bas, lastKg: 35 }).racker, true);
  // Lägre tryck kräver större borrning.
  assertEquals(rakna({ ...bas, tryckBar: 4, lastKg: 35 }).minstaBorrMm, 63);
});

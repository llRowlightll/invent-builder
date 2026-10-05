import { assertEquals } from "jsr:@std/assert@^1";
import { LANGRE_SLAG_PRO, rensaPositionsPros } from "./prosavakt.ts";

Deno.test("pneumatik: 'exakt positionering' stryks", () => {
  const pros = [
    "Kraft på 483 N >> 39 N (mycket hög marginal)",
    "Dubbelverkande ger exakt positionering",
    "Dubbelverkande för exakt kontroll",
    "Slaglängd exakt 50 mm enligt krav",
  ];
  assertEquals(rensaPositionsPros(pros, true), [
    "Kraft på 483 N >> 39 N (mycket hög marginal)",
    "Slaglängd exakt 50 mm enligt krav",
  ]);
});

Deno.test("elaxel: 'exakt positionering' är en riktig fördel och står kvar", () => {
  const pros = ["Exakt positionering ±0,02 mm"];
  assertEquals(rensaPositionsPros(pros, false), pros);
});

Deno.test("längre slag än kravet är ingen fördel, oavsett ordval", () => {
  for (const pro of [
    "Långt slag (200 mm) ger möjlighet till större rörelseomfång",
    "Längre slaglängd än krav (200 mm)",
    "Longer stroke than required gives flexibility",
  ]) assertEquals(LANGRE_SLAG_PRO.test(pro), true, pro);
  // Ett slag som MOTSVARAR kravet är ingen avvikelse.
  assertEquals(LANGRE_SLAG_PRO.test("Slaglängd exakt 50 mm enligt krav"), false);
  assertEquals(LANGRE_SLAG_PRO.test("Kraft på 1 178 N >> 39 N"), false);
});

import { assertEquals } from "jsr:@std/assert@^1";
import { LANGRE_SLAG_PRO, rensaPositionsPros, rensaSerieslag } from "./prosavakt.ts";

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

Deno.test("en series maxslag stryks ur fördelar och nackdelar", () => {
  // Texterna från drift 2026-10-06 (SMC-CM2, serien upp till 300 mm, krav 100 mm).
  const r = rensaSerieslag(
    ["Borrdiameter 32 mm ger god styrka", "Slag 300 mm överstiger kravet", "Force 483 N vid 6 bar"],
    ["Ingen IP‑klassning anges, så inte garanterad för washdown", "Slag 300 mm är längre än nödvändigt"],
    300,
  );
  assertEquals(r.pros, ["Borrdiameter 32 mm ger god styrka", "Force 483 N vid 6 bar"]);
  assertEquals(r.cons, ["Ingen IP‑klassning anges, så inte garanterad för washdown"]);
  // MW-HCR-32: "Slag 500 mm" som fördel om en serie som beställs i 100 mm.
  assertEquals(rensaSerieslag(["Slag 500 mm", "IP67‑klassning"], [], 500).pros, ["IP67‑klassning"]);
  // Ett annat tal med mm berörs inte.
  assertEquals(rensaSerieslag(["Borrdiameter 32 mm"], [], 300).pros, ["Borrdiameter 32 mm"]);
});

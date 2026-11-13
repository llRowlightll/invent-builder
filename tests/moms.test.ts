/// <reference lib="deno.ns" />
// Körs med: deno test tests/moms.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { lasMomsbesked, momsnot, momsrad, SVENSK_MOMS } from "../src/lib/moms.ts";

Deno.test("momsraden följer typen från databasen", () => {
  assertEquals(momsrad({ sats: 0.25, typ: "sverige" }, "sv"), "Moms 25 %");
  assertEquals(momsrad({ sats: 0.25, typ: "eu_utan_nummer" }, "sv"), "Moms 25 %");
  assertEquals(momsrad({ sats: 0, typ: "omvand" }, "sv"), "Moms 0 % – omvänd betalningsskyldighet");
  assertEquals(momsrad({ sats: 0, typ: "export" }, "en"), "VAT 0 % – export outside the EU");
  assert(momsnot({ sats: 0, typ: "omvand" }, "sv")?.includes("artikel 196"));
  assertEquals(momsnot(SVENSK_MOMS, "sv"), null);
});

Deno.test("oväntat svar blir svensk moms, aldrig 0 %", () => {
  assertEquals(lasMomsbesked(null), SVENSK_MOMS);
  assertEquals(lasMomsbesked({ sats: "x", typ: "omvand" }), SVENSK_MOMS);
  assertEquals(lasMomsbesked({ sats: 0, typ: "hittepå" }), SVENSK_MOMS);
  assertEquals(lasMomsbesked({ sats: 0, typ: "omvand" }), { sats: 0, typ: "omvand" });
});

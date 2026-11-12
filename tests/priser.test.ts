/// <reference lib="deno.ns" />
// Körs med: deno test tests/priser.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { formatBelopp, prisErbjudande, tolkaPrisrad } from "../src/lib/priser.ts";

Deno.test("en rad ur publika_priser tolkas; numeric kommer som text", () => {
  const p = tolkaPrisrad({ sku: "DSBC-50-200-PPVA-N3", pris_exkl_moms: "1558", fran: false, prisdatum: "2026-11-20" });
  assertEquals(p, { sku: "DSBC-50-200-PPVA-N3", pris: 1558, fran: false, prisdatum: "2026-11-20" });
});

Deno.test("trasiga rader ger inget pris", () => {
  assertEquals(tolkaPrisrad(null), null);
  assertEquals(tolkaPrisrad({ sku: "X1", pris_exkl_moms: null }), null);
  assertEquals(tolkaPrisrad({ sku: "X1", pris_exkl_moms: "0" }), null);
  assertEquals(tolkaPrisrad({ sku: "", pris_exkl_moms: "100" }), null);
  assertEquals(tolkaPrisrad({ sku: "X1", pris_exkl_moms: "100", prisdatum: "igår" })?.prisdatum, null);
});

Deno.test("belopp per språk", () => {
  // sv-SE grupperar med hårt mellanslag
  assertEquals(formatBelopp(1558, "sv").replace(/\s/g, " "), "1 558 kr");
  assertEquals(formatBelopp(1558, "en"), "SEK 1,558");
  assertEquals(formatBelopp(1558, "de"), "1.558 SEK");
  assert(formatBelopp(12500, "es").endsWith(" SEK"));
});

Deno.test("Offer bara för en artikel, inte för en serie med från-pris", () => {
  const url = "https://maskinval.se/sv/product/X1";
  const o = prisErbjudande({ sku: "X1", pris: 1558, fran: false, prisdatum: "2026-11-20" }, url);
  assertEquals(o?.price, 1558);
  assertEquals(o?.priceCurrency, "SEK");
  assertEquals((o?.priceSpecification as Record<string, unknown>).valueAddedTaxIncluded, false);
  assertEquals(prisErbjudande({ sku: "DSBC", pris: 900, fran: true, prisdatum: null }, url), null);
  assertEquals(prisErbjudande(null, url), null);
});

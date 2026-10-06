/// <reference lib="deno.ns" />
// Körs med: deno test tests/tillverkarlank.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { festoSokord, tillverkarlank } from "../src/lib/tillverkarlank.ts";

const festo = (sku: string) => ({ sku, brand: { slug: "festo" } });

Deno.test("Festo: artikelnummer, modulnummer och typkoder blir sökord", () => {
  // Provade i webbläsare 2026-10-06.
  assertEquals(festoSokord("FESTO-193986"), "193986");
  assertEquals(festoSokord("FE-MS4-LR-14-D7"), "MS4-LR-14-D7");
  assertEquals(festoSokord("FE-NEBU-M8G3-K-2-N-M8G3"), "NEBU-M8G3-K-2-N-M8G3");
  assertEquals(festoSokord("PUN-4X0,75-SW"), "PUN-4X0,75-SW");
  assertEquals(tillverkarlank(festo("FESTO-1376433"), "sv")?.href, "https://www.festo.com/se/en/search?text=1376433");
  assertEquals(tillverkarlank(festo("FE-GRLA-14-QS-8-D"), "sv")?.text, "CAD och datablad hos Festo");
});

Deno.test("AVENTICS: artikelnumret söks på TraceParts", () => {
  const l = tillverkarlank({ sku: "0822120004", brand: { slug: "aventics" } }, "en");
  assertEquals(l?.href, "https://www.traceparts.com/en/search?Keywords=0822120004");
  assertEquals(l?.text, "CAD and data at TraceParts");
  assertEquals(tillverkarlank({ sku: "R480148971", brand: { slug: "aventics" } }, "sv")?.text, "CAD och data hos TraceParts");
  assertEquals(tillverkarlank({ sku: "AVENTICS-PRA", brand: { slug: "aventics" } }, "sv"), null);
});

Deno.test("fabrikat utan provat mönster får ingen länk", () => {
  for (const slug of ["smc", "parker", "camozzi", "norgren", "metal-work", "bosch-rexroth"]) {
    assertEquals(tillverkarlank({ sku: "X-1", brand: { slug } }, "sv"), null);
  }
});

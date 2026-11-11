/// <reference lib="deno.ns" />
// Körs med: deno test tests/snabbsok.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { familjeprefix, snabbforslag } from "../src/lib/snabbsok.ts";
import type { ProductRow } from "../src/lib/types.ts";

function p(sku: string, brand: string, name: string, cat: string, family: string | null = null): ProductRow {
  return {
    id: sku, sku, name, name_en: null, description: null, family,
    brand: { slug: brand.toLowerCase(), name: brand }, category: { slug: cat, name: cat },
    lead_time_days: null, availability: null, weight_kg: null, ip_rating: null, fieldbus: null,
    voltage: null, image_url: null, length_mm: null, width_mm: null, height_mm: null, specs: {},
  };
}

const KAT = [
  p("FESTO-193986", "Festo", "ISO cylinder", "cylinder", "DSNU"),
  p("FESTO-DSNU-50", "Festo", "Festo DSNU-50 Round Cylinder", "cylinder", "DSNU"),
  p("FESTO-DSBC", "Festo", "DSBC – ISO 15552 Cylinder", "cylinder", "DSBC"),
  p("SMC-CQ2", "SMC", "CQ2 – Kompaktcylinder", "cylinder", "CQ2"),
  p("FE-MFH-5-1-8", "Festo", "MFH-5-1/8 Tiger Classic 5/2-ventil", "valve", "MFH"),
  p("PFTM-30", "Parker", "Parker PFTM Ø30mm Flat Vacuum Cup", "vacuum", "PFTM"),
];

Deno.test("under två tecken: inga förslag", () => {
  assertEquals(snabbforslag(KAT, "d", "sv").totalt, 0);
});

Deno.test("serien först, med kategori och fabrikat räknade", () => {
  const f = snabbforslag(KAT, "dsnu", "sv");
  assertEquals(f.totalt, 2);
  assertEquals(f.produkter.map((x) => x.family), ["DSNU", "DSNU"]);
  assertEquals(f.kategorier[0].antal, 2);
  assertEquals(f.fabrikat, [{ slug: "festo", namn: "Festo", antal: 2 }]);
});

Deno.test("exakt artikelnummer överst", () => {
  assertEquals(snabbforslag(KAT, "FESTO-193986", "sv").produkter[0].sku, "FESTO-193986");
});

Deno.test("full orderkod faller tillbaka till serien och säger det", () => {
  const f = snabbforslag(KAT, "DSBC-50-100-PPSA-N3", "sv");
  assertEquals(f.familjefall, "dsbc");
  assertEquals(f.produkter[0].sku, "FESTO-DSBC");
});

Deno.test("seriens egen rad före dess enskilda artiklar", () => {
  const kat = [...KAT, p("FESTO-1463250", "Festo", "ISO cylinder", "cylinder", "DSBC")];
  assertEquals(snabbforslag(kat, "dsbc", "sv").produkter.map((x) => x.sku), ["FESTO-DSBC", "FESTO-1463250"]);
});

Deno.test("svenska fackord hittar engelska namn", () => {
  assertEquals(snabbforslag(KAT, "sugkopp", "sv").produkter[0]?.sku, "PFTM-30");
});

Deno.test("familjeprefix", () => {
  assertEquals(familjeprefix("DSBC-50-100"), "dsbc");
  assertEquals(familjeprefix("dsnu"), null);
  assertEquals(familjeprefix("50-100"), null);
});

/// <reference lib="deno.ns" />
// Körs med: deno test tests/serie.test.ts
// Raderna är riktiga (products/product_specs 2026-11-13).
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { arEnskiltVarde, arFamiljepost, uppTill } from "../src/lib/serie.ts";

const spec = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v, unit: null }]));

Deno.test("serier som kunderna kunde lägga i korgen känns igen", () => {
  assert(arFamiljepost({ sku: "FESTO-DSBC", description: "Dubbelverkande cylinder enligt ISO 15552. Borrning 32–125 mm, slaglängd 1–2800 mm.", specs: spec({ bore_mm: "32,40,50,63,80,100,125", stroke_mm: "2800 mm" }) }));
  assert(arFamiljepost({ sku: "FESTO-570077", description: "ISO 15552-cylinder DSBF-C … Slaglängd väljs vid beställning.", specs: spec({ bore_mm: "32", stroke_mm: "2800 mm" }) }));
  assert(arFamiljepost({ sku: "FESTO-1463250", description: "ISO 15552-cylinder DSBC, Ø32 mm. Slaglängd 1–2800 mm väljs vid beställning.", specs: spec({ bore_mm: "32", stroke_mm: "2800 mm" }) }));
  for (const sku of ["BR-EMC", "SMC-ZP", "FESTO-VN", "MW-RACCORDI", "FESTO-CPX-E", "FESTO-CMMT-AS"]) assert(arFamiljepost({ sku }), sku);
});

Deno.test("riktiga artiklar är inga serier", () => {
  for (const sku of ["SMC-AKH08A-02S", "FESTO-153305", "FE-HGL-1-4-B", "P1D-S050MS-0200", "RA/8032/M/100", "0822123008", "63M2A063A200", "SMC-SS5Y5-10S6F4-08B-C8"]) {
    assertEquals(arFamiljepost({ sku, description: "", specs: spec({ bore_mm: "50", stroke_mm: "200" }) }), false, sku);
  }
});

Deno.test("max-slaget på en serie visas som 'upp till'", () => {
  assert(arEnskiltVarde("2800 mm"));
  assert(!arEnskiltVarde("1–2800 mm"));
  assert(!arEnskiltVarde("25,50,80"));
  assertEquals(uppTill("sv"), "upp till");
  assertEquals(uppTill("de"), "bis");
  assertEquals(uppTill("fr"), "up to");
});

Deno.test("ett slagspann i texten gör bara raden till serie när den saknar eget slag eller har spannets max", () => {
  // Artikel: Ø25×300, texten berättar vad serien finns i.
  assertEquals(arFamiljepost({ sku: "50N-025-300", description: "Kolvstångslös cylinder Serie 50, borrning 25 mm, slaglängd 300 mm. … Slaglängd 100–4000 mm finns.", specs: spec({ bore_mm: "25", stroke_mm: "300 mm" }) }), false);
  // Serie: inget eget slag.
  assert(arFamiljepost({ sku: "MW-ELK-ISO-32", description: "Elcylinder ELEKTRO … Slaglängd 80–1370 mm.", specs: spec({ bore_mm: "32" }) }));
  // Serie: slaget är spannets max.
  assert(arFamiljepost({ sku: "MW-ROD-STD-40", description: "Kolvstångslös cylinder … Slaglängd 100–5700 mm.", specs: spec({ bore_mm: "40", stroke_mm: "5700 mm" }) }));
});

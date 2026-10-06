/// <reference lib="deno.ns" />
// Körs med: deno test tests/ersattning.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { borrningar, hittaArtikel, identifiera, maxSlag, motsvarigheter, sammaVarde } from "../src/lib/ersattning.ts";
import type { ProductRow } from "../src/lib/types.ts";

const rad = (sku: string, name: string, brand: string, family: string | null, specs: Record<string, string>, kategori = "cylinder"): ProductRow => ({
  id: sku, sku, name, description: null, family,
  brand: { slug: brand.toLowerCase().replace(/\s+/g, "-"), name: brand },
  category: { slug: kategori, name: kategori },
  lead_time_days: null, availability: null, weight_kg: null, ip_rating: null, fieldbus: null, voltage: null,
  image_url: null, length_mm: null, width_mm: null, height_mm: null,
  specs: Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, { value: v, unit: null }])),
});

// Katalogens egna rader (2026-10-06), förenklade till det som avgör.
const KATALOG: ProductRow[] = [
  rad("FESTO-1463250", "ISO cylinder", "Festo", "DSBC", { bore_mm: "32", standard: "ISO 15552", stroke_mm: "2800 mm" }),
  rad("0822120004", "AVENTICS PRA Ø32 100mm ISO 15552 Cylinder", "AVENTICS", "PRA", { bore_mm: "32", standard: "ISO 15552", stroke_mm: "100 mm" }),
  rad("0822120009", "AVENTICS PRA Ø32 500mm ISO 15552 Cylinder", "AVENTICS", "PRA", { bore_mm: "32", standard: "ISO 15552", stroke_mm: "500 mm" }),
  rad("P1D-S032MS-0100", "Parker P1D Ø32 100 mm", "Parker", "P1D", { bore_mm: "32", standard: "ISO 15552", stroke_mm: "100" }),
  rad("MW-C15552-32", "Metal Work ISO 15552 Cylinder Ø32", "Metal Work", "ISO 15552", { bore_mm: "32", standard: "ISO 15552", stroke_mm: "2000 mm" }),
  rad("SMC-CM2", "CM2 – Compact Stainless Cylinder", "SMC", "CM2", { bore_mm: "20–40", stroke_mm: "25–300 mm (standard)" }),
  rad("FESTO-193986", "ISO cylinder", "Festo", "DSNU", { bore_mm: "8", standard: "ISO 6432", stroke_mm: "500 mm" }),
  rad("63M2A050A0100", "Serie 63 Ø50", "Camozzi", "Serie 63", { bore_mm: "50", standard: "ISO 15552", stroke_mm: "100 mm" }),
  rad("FE-GRLA-14-QS-8-D", "GRLA-1/4-QS-8 avgasstrypare", "Festo", "GRLA", {}, "flow-control"),
  // Styrd enhet på en ISO 6431-cylinder: samma standard, men ingen rak ersättare.
  rad("0822064003", "AVENTICS GPC-BV Ø32 100mm Guide Cylinder", "AVENTICS", "GPC-BV", { bore_mm: "32", standard: "ISO 6431", stroke_mm: "100 mm" }),
];
const FAMILJER = [
  { slug: "dsbc", name: "DSBC", bores: [32, 40, 50, 63, 80, 100, 125], strokeMin: 1, strokeMax: 2800 },
  { slug: "p1d", name: "P1D", bores: [32, 40, 50, 63, 80, 100, 125], strokeMin: 1, strokeMax: 2800 },
];

Deno.test("samma artikel hittas oavsett skiljetecken och prefix", () => {
  assertEquals(hittaArtikel("GRLA-1/4-QS-8-D", KATALOG)?.sku, "FE-GRLA-14-QS-8-D");
  assertEquals(hittaArtikel("0822120004", KATALOG)?.sku, "0822120004");
  assertEquals(hittaArtikel("XX", KATALOG), null);
});

Deno.test("en kod från typskylten läses som familj, borrning och slag", () => {
  const id = identifiera("DSBC-32-100-PPVA-N3", KATALOG, FAMILJER);
  assertEquals(id.produkt, null);
  assertEquals([id.familj, id.tillverkare, id.standard, id.borrningMm, id.slagMm], ["DSBC", "Festo", "ISO 15552", 32, 100]);
});

Deno.test("motsvarigheter: samma standard och borrning, andra fabrikat först", () => {
  const m = motsvarigheter(identifiera("DSBC-32-100-PPVA-N3", KATALOG, FAMILJER), KATALOG);
  assertEquals(m.map((k) => `${k.produkt.sku}:${k.typ}`), [
    "0822120004:artikel",      // AVENTICS, samma slag
    "P1D-S032MS-0100:artikel", // Parker, samma slag
    "MW-C15552-32:serie",      // Metal Work, slaget väljs vid beställning
    "FESTO-1463250:serie",     // eget fabrikat sist
  ]);
});

Deno.test("en artikel med annat slag, annan standard eller annan borrning är ingen motsvarighet", () => {
  const skus = motsvarigheter(identifiera("0822120004", KATALOG, FAMILJER), KATALOG).map((k) => k.produkt.sku);
  for (const fel of ["0822120004", "0822120009", "SMC-CM2", "FESTO-193986", "63M2A050A0100"]) {
    assertEquals(skus.includes(fel), false, fel);
  }
});

Deno.test("utan standard eller igenkänd kod: inga motsvarigheter, ingen gissning", () => {
  assertEquals(motsvarigheter(identifiera("SMC-CM2", KATALOG, FAMILJER), KATALOG), []);
  const okand = identifiera("XYZ-12-34", KATALOG, FAMILJER);
  assertEquals([okand.produkt, okand.familj, okand.borrningMm], [null, null, null]);
  assertEquals(motsvarigheter(okand, KATALOG), []);
});

Deno.test("borrningar och slag läses som katalogen skriver dem", () => {
  assertEquals(borrningar(KATALOG[5]), [20, 25, 32, 40]);
  assertEquals(maxSlag(KATALOG[5]), 300);
});

Deno.test("en styrd cylinder är ingen motsvarighet till en vanlig ISO-cylinder", () => {
  const m = motsvarigheter(identifiera("DSBC-32-100-PPVA-N3", KATALOG, FAMILJER), KATALOG).map((k) => k.produkt.sku);
  assertEquals(m.includes("0822064003"), false);
  assertEquals(m[0], "0822120004"); // PRA Ø32×100 i stället
});

Deno.test("skillnader: formatering räknas inte, olika tal gör det", () => {
  assertEquals(sammaVarde("-20 to +80 °C", "-20–80 °C"), true);
  assertEquals(sammaVarde("-20…+80 °C", "-20-80"), true);
  assertEquals(sammaVarde("10 bar", "10"), true);
  assertEquals(sammaVarde("-10–60 °C", "-20–80 °C"), false);
  assertEquals(sammaVarde("Magnetic piston", "magnetic piston"), true);
});

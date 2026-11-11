/// <reference lib="deno.ns" />
// Körs med: deno test tests/snabborder.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { lasLista, tillKorgrad, tolkaKod } from "../src/lib/snabborder.ts";
import type { ProductRow } from "../src/lib/types.ts";

function p(sku: string, name: string, family: string | null, specs: Record<string, string> = {}): ProductRow {
  return {
    id: sku, sku, name, name_en: null, description: null, family,
    brand: { slug: "festo", name: "Festo" }, category: { slug: "cylinder", name: "Cylinder" },
    lead_time_days: null, availability: null, weight_kg: null, ip_rating: null, fieldbus: null,
    voltage: null, image_url: null, length_mm: null, width_mm: null, height_mm: null,
    specs: Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, { value: v, unit: null }])),
  };
}

const KAT = [
  p("FESTO-193986", "ISO cylinder", "DSNU", { bore_mm: "8" }),
  p("FESTO-1463250", "ISO cylinder", "DSBC"),
  p("FESTO-DSBC", "DSBC – ISO 15552 Standard Cylinder", "DSBC", { bore_mm: "32,40,50,63,80,100,125" }),
  p("FE-MFH-5-1-8", "MFH-5-1/8 Tiger Classic 5/2-ventil", "MFH"),
];
const FAM = [{ slug: "dsbc", name: "DSBC", bores: [32, 40, 50, 63, 80, 100, 125], strokeMin: 1, strokeMax: 2800 }];

Deno.test("antal efter tabb, semikolon, komma, x och st -- och före", () => {
  assertEquals(lasLista("193986\t5"), [{ kod: "193986", antal: 5 }]);
  assertEquals(lasLista("193986;5"), [{ kod: "193986", antal: 5 }]);
  assertEquals(lasLista("193986, 5 st"), [{ kod: "193986", antal: 5 }]);
  assertEquals(lasLista("DSBC-50-100-PPSA-N3 x2"), [{ kod: "DSBC-50-100-PPSA-N3", antal: 2 }]);
  assertEquals(lasLista("DSBC-50-100-PPSA-N3 4 st"), [{ kod: "DSBC-50-100-PPSA-N3", antal: 4 }]);
  assertEquals(lasLista("5 x 193986"), [{ kod: "193986", antal: 5 }]);
  assertEquals(lasLista("3 st MFH-5-1/8"), [{ kod: "MFH-5-1/8", antal: 3 }]);
});

Deno.test("ett naket tal efter mellanslag är en del av koden, inte ett antal", () => {
  assertEquals(lasLista("PUN-H 8X1.25"), [{ kod: "PUN-H 8X1.25", antal: 1 }]);
  assertEquals(lasLista("Festo 193986"), [{ kod: "Festo 193986", antal: 1 }]);
});

Deno.test("rubriker, punktlistor och tomma rader hoppas över; dubbletter summeras", () => {
  const ut = lasLista("Artikelnummer;Antal\n\n- 193986;2\n1. 193986;3\n• FESTO-DSBC\n");
  assertEquals(ut, [{ kod: "193986", antal: 5 }, { kod: "FESTO-DSBC", antal: 1 }]);
});

Deno.test("kalkylblad med fler kolumner: kod först, antal i en senare kolumn", () => {
  assertEquals(lasLista("193986\tRundcylinder Ø8\t10\tst"), [{ kod: "193986", antal: 10 }]);
});

Deno.test("artikel: SKU, SKU utan prefix", () => {
  const a = tolkaKod("193986", KAT, FAM);
  assertEquals(a.status === "artikel" && a.produkt.sku, "FESTO-193986");
  const b = tolkaKod("festo-193986", KAT, FAM);
  assertEquals(b.status === "artikel" && b.produkt.sku, "FESTO-193986");
});

Deno.test("serie: full orderkod får seriens egen rad och kundens kod", () => {
  const t = tolkaKod("DSBC-50-100-PPSA-N3", KAT, FAM);
  assertEquals(t.status, "serie");
  if (t.status !== "serie") return;
  assertEquals(t.produkt?.sku, "FESTO-DSBC");
  assertEquals(t.borrningMm, 50);
  const rad = tillKorgrad({ kod: "dsbc-50-100-ppsa-n3", antal: 2 }, t, (x) => x.name, "?");
  assertEquals(rad.order_code, "DSBC-50-100-PPSA-N3");
  assertEquals(rad.sku, "DSBC-50-100-PPSA-N3");
  assertEquals(rad.product_id, "FESTO-DSBC");
  assertEquals(rad.qty, 2);
});

Deno.test("en enskild storlek blir aldrig seriens post", () => {
  // Bara FESTO-193986 (Ø8) i familjen DSNU -- ingen seriepost.
  const fam = [{ slug: "dsnu", name: "DSNU", bores: [8, 10, 12, 16, 20, 25, 32], strokeMin: 1, strokeMax: 500 }];
  const t = tolkaKod("DSNU-32-100-PPS-A", KAT, fam);
  assertEquals(t.status === "serie" && t.produkt, null);
});

Deno.test("serie utan storlek via prefix; okänd kod följer med som kontrollrad", () => {
  const m = tolkaKod("MFH-5-1/8-S", KAT, FAM);
  assertEquals(m.status === "serie" && m.produkt?.sku, "FE-MFH-5-1-8");
  const o = tolkaKod("XYZ-999", KAT, FAM);
  assertEquals(o.status, "okand");
  const rad = tillKorgrad({ kod: "XYZ-999", antal: 1 }, o, (x) => x.name, "Kontrolleras i offerten");
  assertEquals(rad, { product_id: null, sku: "XYZ-999", name: "Kontrolleras i offerten", qty: 1, order_code: "XYZ-999" });
});

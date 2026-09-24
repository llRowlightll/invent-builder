/**
 * Familjens katalogpost.
 *
 * Provet finns för att konfiguratorn satte namnet "Festo DSNU-40 Round
 * Cylinder" på en rad vars kod var DSNU-32-100-PPS: ett `limit 1` utan
 * ordning plockade en godtycklig borrningsvariant.
 */
import { assertEquals } from "jsr:@std/assert@1";
import { valjSerieprodukt, type KatalogpostLite } from "../../../src/lib/catalog/series-product.ts";

const dsnu: KatalogpostLite[] = [
  { id: "a", sku: "FESTO-193986",   name: "ISO cylinder" },
  { id: "b", sku: "FESTO-DSNU",     name: "DSNU – Round Cylinder" },
  { id: "c", sku: "FESTO-DSNU-40",  name: "Festo DSNU-40 Round Cylinder" },
  { id: "d", sku: "FESTO-DSNU-8",   name: "Festo DSNU-8 Round Cylinder" },
];

Deno.test("serieraden vinner över varje borrningsvariant", () => {
  assertEquals(valjSerieprodukt("dsnu", dsnu)?.sku, "FESTO-DSNU");
});

Deno.test("ordningen i listan spelar ingen roll", () => {
  assertEquals(valjSerieprodukt("dsnu", [...dsnu].reverse())?.sku, "FESTO-DSNU");
});

Deno.test("utan serierad väljs den minst specifika, och alltid samma", () => {
  const utan = dsnu.filter((p) => p.sku !== "FESTO-DSNU");
  assertEquals(valjSerieprodukt("dsnu", utan)?.sku, "FESTO-DSNU-8");
  assertEquals(valjSerieprodukt("dsnu", [...utan].reverse())?.sku, "FESTO-DSNU-8");
});

Deno.test("ett ogenomskinligt artikelnummer vinner inte på bokstavsordning", () => {
  // FESTO-193986 är lika långt som FESTO-DSNU-8 och kommer före alfabetiskt,
  // men säger ingenting om familjen.
  const utan = dsnu.filter((p) => p.sku !== "FESTO-DSNU");
  assertEquals(valjSerieprodukt("dsnu", utan)?.sku !== "FESTO-193986", true);
});

Deno.test("familj där ingen rad bär namnet ger ändå ett bestämt svar", () => {
  const opaka: KatalogpostLite[] = [
    { id: "p", sku: "SMC-222222", name: "b" },
    { id: "q", sku: "SMC-111111", name: "a" },
  ];
  assertEquals(valjSerieprodukt("cy1l", opaka)?.sku, "SMC-111111");
  assertEquals(valjSerieprodukt("cy1l", [...opaka].reverse())?.sku, "SMC-111111");
});

Deno.test("familj utan katalogpost ger null", () => {
  assertEquals(valjSerieprodukt("cy1l", []), null);
});

Deno.test("slug:ens skiftläge spelar ingen roll", () => {
  assertEquals(valjSerieprodukt("DsNu", dsnu)?.sku, "FESTO-DSNU");
});

Deno.test("bindestreck i slug:en matchas som den står", () => {
  const osp: KatalogpostLite[] = [
    { id: "x", sku: "PARKER-OSP-E-STR-25", name: "variant" },
    { id: "y", sku: "PARKER-OSP-E-STR",    name: "serie" },
  ];
  assertEquals(valjSerieprodukt("osp-e-str", osp)?.sku, "PARKER-OSP-E-STR");
});

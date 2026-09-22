/**
 * Mallmotorn, testad för sig.
 *
 * Den har hittills bara testats INDIREKT, genom familjernas egna facit
 * (dsbc.test.ts kör 455 katalogkoder genom den). Det räcker för de modellerade
 * familjerna, men motorn körs också av de ~135 familjer som aldrig
 * kontrollerats mot sin katalog -- och där fanns felet nedan.
 */
import { assertEquals } from "jsr:@std/assert@1";
import {
  fillOrderCodeTemplate,
  isNoCode,
  NO_CODE,
  stripLeadingCode,
} from "../../../src/lib/catalog/order-code-template.ts";

Deno.test("bortvald position försvinner i stället för att skriva ut 'none'", () => {
  // Det verkliga fallet: /sv/configurator/dsnu, ø25, slag 100, dämpning PPV
  // och "Utan lägesavkänning" gav DSNU-25-100-PPVnone.
  const mall = "DSNU-{bore_mm}-{stroke_mm}-{cushioning}{sensing}";
  assertEquals(
    fillOrderCodeTemplate(mall, { bore_mm: "25", stroke_mm: "100", cushioning: "PPV", sensing: NO_CODE }),
    "DSNU-25-100-PPV",
  );
  // Ett riktigt val skrivs förstås ut.
  assertEquals(
    fillOrderCodeTemplate(mall, { bore_mm: "25", stroke_mm: "100", cushioning: "PPV", sensing: "A" }),
    "DSNU-25-100-PPVA",
  );
  // Och ovalt beter sig som förut.
  assertEquals(
    fillOrderCodeTemplate(mall, { bore_mm: "25", stroke_mm: "100", cushioning: "PPV", sensing: "" }),
    "DSNU-25-100-PPV",
  );
});

Deno.test("sentinelen tar med sig sitt suffix", () => {
  // {key:SUFFIX} lägger bara till bokstaven när positionen finns. En bortvald
  // position får inte lämna ett ensamt "KE" efter sig.
  assertEquals(fillOrderCodeTemplate("X-{a:KE}", { a: NO_CODE }), "X");
  assertEquals(fillOrderCodeTemplate("X-{a:KE}", { a: "25" }), "X-25KE");
});

Deno.test("isNoCode känner igen sentinelen oavsett skiftläge och blanksteg", () => {
  for (const k of ["none", "None", "NONE", " none "]) assertEquals(isNoCode(k), true, k);
  for (const k of ["A", "N", "", "nonex", "no"]) assertEquals(isNoCode(k), false, k);
  assertEquals(isNoCode(null), false);
});

Deno.test("obligatoriska positioner visas som ... , valfria försvinner", () => {
  assertEquals(fillOrderCodeTemplate("A-{b}-{c}", {}, new Set(["b"])), "A-...");
  assertEquals(fillOrderCodeTemplate("A-{b}-{c}", {}), "A");
});

Deno.test("nollutfyllnad och separatorstädning", () => {
  assertEquals(fillOrderCodeTemplate("P1D-S{bore#3}MS-{stroke#4}", { bore: "50", stroke: "200" }), "P1D-S050MS-0200");
  assertEquals(fillOrderCodeTemplate("A-{b}-{c}-D", { c: "3" }), "A-3-D");
});

Deno.test("stripLeadingCode klipper bara ledande kod med avskiljare", () => {
  assertEquals(stripLeadingCode("D3 – Givarspår", "D3"), "Givarspår");
  assertEquals(stripLeadingCode("Låg friktion", "L"), "Låg friktion");
  assertEquals(stripLeadingCode("M5-gänga", "M5"), "M5-gänga");
});

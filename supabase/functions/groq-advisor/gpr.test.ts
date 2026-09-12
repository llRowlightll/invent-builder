/**
 * GPR-modellen mot Parkers gripdonskatalog 1900-2/US.
 *
 * Den enklaste nyckeln i genomgången: GPR + storlek + A. Våra tre artiklar är
 * korrekta -- det femte falska larmet i revisionen, och det säger något om
 * metoden: när artikelnumret är KORT och katalogen bara trycker en modellkod
 * finns ingenting att slå upp emot, hur riktig artikeln än är.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  GPR_LIMITS,
  GPR_MODELS,
  GPR_SOURCE,
  buildGprCode,
  gprGripForceN,
  parseGprCode,
} from "../../../src/lib/catalog/gpr.ts";

/** Våra tre artiklar — som visade sig vara katalogens tre modeller. */
const FACIT = ["GPR1A", "GPR3A", "GPR10A"];
const MALL = "GPR{size}A";

Deno.test("våra tre artiklar ÄR katalogens tre modeller", () => {
  assertEquals(GPR_MODELS.length, 3);
  for (const sku of FACIT) {
    const m = parseGprCode(sku);
    assert(m, `${sku} måste finnas i katalogen`);
  }
  assertEquals(GPR_MODELS.map((m) => buildGprCode(m.size)), FACIT);
});

Deno.test("storleken är en kod, inte en borrning", () => {
  // 1 betyder Ø18 mm, 3 betyder Ø24 och 10 betyder Ø30. Den som läser
  // storleksziffran som ett mått får fel varje gång.
  assertEquals(parseGprCode("GPR1A")!.bore_mm, 18);
  assertEquals(parseGprCode("GPR3A")!.bore_mm, 24);
  assertEquals(parseGprCode("GPR10A")!.bore_mm, 30);
  assertEquals(buildGprCode("18"), null, "Ø18 beställs som storlek 1");
});

Deno.test("greppkraft och slag växer med storleken", () => {
  const kraft = GPR_MODELS.map((m) => m.grip_force_n);
  const slag = GPR_MODELS.map((m) => m.stroke_mm);
  assertEquals(kraft, [33.8, 62, 142]);
  assertEquals(slag, [10, 14, 20]);
  for (let i = 1; i < GPR_MODELS.length; i++) {
    assert(kraft[i] > kraft[i - 1], "kraften ska växa");
    assert(slag[i] > slag[i - 1], "slaget ska växa");
  }
});

Deno.test("GPR10A går ned till 2 bar — de mindre kräver 3", () => {
  // Skillnaden är verklig och värd att visa: ett gripdon som fungerar vid
  // 2,5 bar är inte samma sak som ett som inte får användas där.
  assertEquals(GPR_MODELS.find((m) => m.size === "10")!.pressure_min_bar, 2);
  assertEquals(GPR_MODELS.find((m) => m.size === "1")!.pressure_min_bar, 3);
  assert(gprGripForceN("10", 2.5), "GPR10A klarar 2,5 bar");
  assertEquals(gprGripForceN("1", 2.5), null, "GPR1A gör inte det");
});

Deno.test("greppkraften skalar linjärt med trycket", () => {
  // Katalogen ritar kraften som en rät linje mot trycket. Vid 5 bar ska
  // funktionen ge exakt tabellvärdet.
  for (const m of GPR_MODELS) {
    assertEquals(gprGripForceN(m.size, 5), m.grip_force_n, `storlek ${m.size} vid 5 bar`);
  }
  assertEquals(gprGripForceN("3", 6), 74.4);
  assertEquals(gprGripForceN("1", 7), null, "över maxtrycket");
});

Deno.test("fel form parsas inte", () => {
  for (const bad of ["gpr-1", "GPR1", "GPR2A", "GPR1B", "GPR-1-A"]) {
    assertEquals(parseGprCode(bad), null, `"${bad}" borde inte parsa`);
  }
});

Deno.test("konfiguratorns mall ger katalogens kod", () => {
  const kravs = new Set(["size"]);
  for (const m of GPR_MODELS) {
    assertEquals(fillOrderCodeTemplate(MALL, { size: m.size }, kravs), buildGprCode(m.size));
  }
});

Deno.test("den gamla mallen gav gemener och bindestreck", () => {
  const ut = fillOrderCodeTemplate("gpr-{size}-{grip_type}{options}", { size: "1" });
  assertEquals(ut, "gpr-1");
  assertEquals(parseGprCode(ut), null);
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(GPR_SOURCE.edition, "1900-2/US");
  assertEquals(GPR_LIMITS.temp_min_c, -5);
  assertEquals(GPR_LIMITS.repeatability_mm, 0.01);
});

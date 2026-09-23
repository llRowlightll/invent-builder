/**
 * Valen i familjekonfiguratorn.
 *
 * Testet finns för att konfiguratorn bara gick att TRYCKA PÅ: ett andra klick
 * på ett valt värde gjorde ingenting, och enda vägen tillbaka var "Rensa alla
 * val". Reglerna nedan är de som gör att ett felklick kostar ett klick att
 * ångra i stället för hela konfigurationen.
 */
import { assertEquals } from "jsr:@std/assert@1";
import {
  clearValue,
  hasValue,
  isSelected,
  toggleValue,
} from "../../../src/lib/catalog/selection-state.ts";

Deno.test("enkelval: samma värde igen tar bort valet", () => {
  const ett = toggleValue({}, "cushioning", "PPV", "select");
  assertEquals(ett.cushioning, "PPV");
  const av = toggleValue(ett, "cushioning", "PPV", "select");
  assertEquals("cushioning" in av, false, "andra klicket ska ta bort nyckeln, inte tomma den");
  const pa_igen = toggleValue(av, "cushioning", "PPV", "select");
  assertEquals(pa_igen.cushioning, "PPV", "tredje klicket väljer igen");
});

Deno.test("enkelval: ett annat värde ersätter, som förut", () => {
  const a = toggleValue({ cushioning: "PPV" }, "cushioning", "PPS", "select");
  assertEquals(a.cushioning, "PPS");
});

Deno.test("enkelval: andra parametrar rörs inte", () => {
  const före = { bore_mm: "32", cushioning: "PPV", sensing: "A" };
  const efter = toggleValue(före, "cushioning", "PPV", "select");
  assertEquals(efter.bore_mm, "32");
  assertEquals(efter.sensing, "A");
  assertEquals("cushioning" in efter, false);
});

Deno.test("flerval togglar per värde", () => {
  let s: Record<string, string | string[]> = {};
  s = toggleValue(s, "opts", "A", "multiselect");
  s = toggleValue(s, "opts", "B", "multiselect");
  assertEquals(s.opts, ["A", "B"]);
  s = toggleValue(s, "opts", "A", "multiselect");
  assertEquals(s.opts, ["B"], "bara det klickade värdet ska bort");
  s = toggleValue(s, "opts", "B", "multiselect");
  assertEquals("opts" in s, false, "tom lista ska bli ovald, inte tom array");
});

Deno.test("isSelected följer samma regel som knappens färg", () => {
  assertEquals(isSelected({ a: "X" }, "a", "X"), true);
  assertEquals(isSelected({ a: "" }, "a", "X"), false);
  assertEquals(isSelected({ a: ["X", "Y"] }, "a", "Y"), true);
  assertEquals(isSelected({}, "a", "X"), false);
});

Deno.test("hasValue skiljer ovalt från valt", () => {
  assertEquals(hasValue({ a: "X" }, "a"), true);
  assertEquals(hasValue({ a: "" }, "a"), false);
  assertEquals(hasValue({ a: [] }, "a"), false);
  assertEquals(hasValue({ a: ["X"] }, "a"), true);
  assertEquals(hasValue({}, "a"), false);
});

Deno.test("clearValue nollställer rätt typ", () => {
  assertEquals("a" in clearValue({ a: "X", b: "Y" }, "a"), false);
  assertEquals(clearValue({ a: "X", b: "Y" }, "a").b, "Y");
  assertEquals("a" in clearValue({ a: ["X"] }, "a"), false);
});

Deno.test("ett bortvalt obligatoriskt fält gör koden ofullständig", async () => {
  // Kopplingen till mallmotorn: "" är ovalt, alltså "..." för obligatoriska.
  const { fillOrderCodeTemplate } = await import(
    "../../../src/lib/catalog/order-code-template.ts"
  );
  const mall = "DSNU-{bore_mm}-{stroke_mm}-{cushioning}";
  const valt = { bore_mm: "32", stroke_mm: "25", cushioning: "PPS" };
  assertEquals(fillOrderCodeTemplate(mall, valt, new Set(["bore_mm"])), "DSNU-32-25-PPS");
  const bortvalt = toggleValue(valt, "bore_mm", "32", "select");
  assertEquals(
    fillOrderCodeTemplate(mall, bortvalt as Record<string, string>, new Set(["bore_mm"])),
    "DSNU-...-25-PPS",
  );
});

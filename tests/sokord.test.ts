/// <reference lib="deno.ns" />
// Körs med: deno test tests/sokord.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { matcharFraga } from "../src/lib/sokord.ts";

const SUGKOPP = "PFTM-30 Parker PFTM Ø30mm Flat Vacuum Cup Assembly NBR G1/8 Parker vacuum";
const VENTIL = "FE-MFH-5-1-8 Festo MFH-5-1/8-S Tiger Classic 5/2-ventil, G1/8 Festo valve Ventil";

Deno.test("svenska fackord hittar engelska benämningar", () => {
  assertEquals(matcharFraga(SUGKOPP, "vakuum sugkopp"), true);
  assertEquals(matcharFraga(SUGKOPP, "sugkopp Ø30"), true);
  assertEquals(matcharFraga(VENTIL, "magnetventil 5/2"), true);
});

Deno.test("varje ord måste finnas -- annars ingen träff", () => {
  assertEquals(matcharFraga(SUGKOPP, "sugkopp Ø40"), false);
  assertEquals(matcharFraga(VENTIL, "magnetventil 3/2"), false);
});

Deno.test("en sammanhängande fråga som förut fungerade fungerar fortfarande", () => {
  assertEquals(matcharFraga("MW-C15552-40 Metal Work ISO 15552 Cylinder Ø40", "cylinder Ø40"), true);
  assertEquals(matcharFraga("anything", ""), true);
});

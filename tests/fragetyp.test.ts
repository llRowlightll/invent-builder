/// <reference lib="deno.ns" />
// Körs med: deno test tests/fragetyp.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { arKunskapsfraga } from "../src/lib/fragetyp.ts";

Deno.test("krav i en produktfråga skickar den till motorn", () => {
  // Gick till det allmänna AI-svaret i drift 2026-10-05: "högtryckstvätt" innehåller "tryck".
  assertEquals(arKunskapsfraga("Cylinder för livsmedelsindustri med daglig högtryckstvätt, Ø32, 100 mm slag"), false);
  assertEquals(arKunskapsfraga("Cylinder för högtryckstvätt"), false);
  assertEquals(arKunskapsfraga("Ventil som klarar 120 °C"), false);
  assertEquals(arKunskapsfraga("cylinder 10 bar 200 mm stroke"), false);
  assertEquals(arKunskapsfraga("Tätning i FKM för cylinder"), false);
  assertEquals(arKunskapsfraga("Hur dimensionerar jag en cylinder för 30 kg?"), false);
});

Deno.test("exempelfrågorna i chatten hamnar där de ska", () => {
  assertEquals(arKunskapsfraga("Jag behöver en cylinder som lyfter 30 kg med 150mm slag"), false);
  assertEquals(arKunskapsfraga("Kompakt SMC cylinder för trånga utrymmen, 32mm kolvdiameter"), false);
  assertEquals(arKunskapsfraga("Pneumatisk gripper för cylindriska objekt"), false);
  assertEquals(arKunskapsfraga("Parker cylinder med IP67 för utomhusbruk"), false);
  assertEquals(arKunskapsfraga("Hur fungerar Parker P1D cylinderns kolvtätning?"), true);
  assertEquals(arKunskapsfraga("Vad är skillnaden mellan OSP-P och en vanlig cylinder?"), true);
  assertEquals(arKunskapsfraga("How does the Parker P1D cylinder piston seal work?"), true);
});

Deno.test("allmänna frågor utan produkt är fortfarande kunskapsfrågor", () => {
  assertEquals(arKunskapsfraga("Vilken tätning klarar högtryckstvätt?"), true);
  assertEquals(arKunskapsfraga("Vilken temperatur klarar FKM?"), true);
  assertEquals(arKunskapsfraga("What is ISO 15552?"), true);
});

Deno.test("enheter matchar bara som enheter", () => {
  // "n" i "100 nya" är ingen newton, "bar" i "bara" ingen enhet.
  assertEquals(arKunskapsfraga("Vad är skillnaden mellan 2 nya serier?"), true);
  assertEquals(arKunskapsfraga("Hur fungerar en 5 bara-ventil?"), true);
});

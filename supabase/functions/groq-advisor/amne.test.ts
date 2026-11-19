import { assert, assertEquals } from "jsr:@std/assert@^1";
import { amnesbedomning, kraftsvar, utanforAmnetText } from "./amne.ts";

// Nattestet 2026-11-19: "Vad kostar en kaffebryggare?" fick tre cylindrar och
// "Hur mycket kraft ger en Ø63 cylinder vid 6 bar?" fick inget svar.

Deno.test("text utan något om automation räknas som utanför ämnet", () => {
  for (const t of [
    "Vad kostar en kaffebryggare?", "Hej!", "Vem vann matchen igår?", "Skriv en dikt om hösten",
    "What's the weather in Stockholm?", "Tell me a joke", "Wie spät ist es?", "¿Cuál es la capital de Francia?",
    "Kan ni boka ett bord till fyra?", "jag vill köpa en cykel till min dotter", "",
  ]) assertEquals(amnesbedomning(t), "utanfor", t);
});

Deno.test("bedömningen är snäll: ett ord, ett mått eller en kod räcker", () => {
  for (const t of [
    "Jag behöver öppna en lucka automatiskt", "Något som trycker ut en kartong från bandet",
    "Vi har ett problem med en maskin som stannar", "Ersätta DSBC-50-100-PPVA-N3", "Ø40", "2300320050CP22",
    "Vad betyder T4 för gasgrupp IIB?", "Hur mycket kraft ger en Ø63 cylinder vid 6 bar?",
    "Need something to raise a gate", "Brauche etwas zum Heben von Kisten", "Necesito empujar cajas",
    "Vi bygger en pallastare", "Kan ni hjälpa oss med en robotcell?", "Hur väljer jag rätt ventil?",
    "Ett vinkelgrepp som håller detaljen", "Burkarna står med öppningen uppåt på bandet", "slakteri",
    "hatch on a boat, sea water spray", "Vi behöver veta när den är i topp och i botten.", "300 mm, 5 kg",
    "Gantry with x 500 mm, y 300 mm, z 150 mm for 2 kg parts, vacuum cups",
  ]) assertEquals(amnesbedomning(t), "automation", t);
});

Deno.test("beskedet finns på fyra språk", () => {
  for (const l of ["sv", "en", "de", "es"]) assert(utanforAmnetText(l).length > 80, l);
  assert(/Maskinbyggaren/.test(utanforAmnetText("sv")));
  assert(/machine builder/.test(utanforAmnetText("en")));
});

Deno.test("kraftfrågan räknas: p × A, tätningsfriktion 0,75 och ISO-kolvstång", () => {
  const sv = kraftsvar("Hur mycket kraft ger en Ø63 cylinder vid 6 bar?", "sv")!;
  assert(/1\s870 N utåt/.test(sv), sv);
  assert(/cirka 1\s403 N/.test(sv), sv);
  assert(/kolvstång Ø20 enligt ISO 15552/.test(sv), sv);
  assert(/1\s682 N teoretiskt/.test(sv), sv);
  assert(/72 kg/.test(sv), sv);
  const en = kraftsvar("How much force does a 50 mm cylinder give at 5 bar?", "en")!;
  assert(/A Ø50 at 5 bar gives 982 N/.test(en), en);
  // Utan tryck räknas 6 bar.
  assert(/Ø32 bei 6 bar liefert theoretisch 483 N/.test(kraftsvar("Wie viel Kraft hat ein Zylinder Ø32?", "de")!));
  assert(/Ø100 a 7 bar da en teoría 5498 N/.test(kraftsvar("¿Cuánta fuerza da un cilindro de Ø100 a 7 bar?", "es")!));
  // Ingen räknefråga: ingen borrning att räkna på, eller ingen fråga.
  assertEquals(kraftsvar("Hur mycket kraft behövs för att lyfta 20 kg?", "sv"), null);
  assertEquals(kraftsvar("Cylinder Ø32 med 100 mm slag", "sv"), null);
});

/**
 * OSP-P-modellen mot Parkers katalog 0900P-7.
 *
 * Facit är katalogens EGET exempel, avskrivet ur chunk 24:
 *
 *   OSPP 25 0 1 0 0 0 01 100 0 0 0 0 0 0 1 0 0
 *
 * Det är den enda fullständiga OSP-P-kod dokumentet trycker, och den räcker
 * för att fästa det som betyder något: kodens längd, seriens fyra tecken,
 * borrningens två, och slaglängdens fem.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  OSPP_BORES,
  OSPP_CODE_LENGTH,
  OSPP_LIMITS,
  OSPP_SOURCE,
  OSPP_STROKE,
  buildOsppCode,
  osppWeightKg,
  parseOsppCode,
} from "../../../src/lib/catalog/osp-p.ts";

/**
 * Katalogens exempel, hopsatt ur de grupper den trycker det i.
 * OSPP | 25 | 0 1 0 0 0 | 01100 | 0 0 0 0 0 0 1 0 0
 */
const KATALOGENS_EXEMPEL = "OSPP" + "25" + "01000" + "01100" + "000000100";

/** Mallen som ligger i configurator_families. */
const MALL = "OSPP{bore_mm}00000{stroke_mm#5}000000000";

Deno.test("katalogens exempel är 25 tecken och läses rätt", () => {
  assertEquals(KATALOGENS_EXEMPEL.length, OSPP_CODE_LENGTH);
  const r = parseOsppCode(KATALOGENS_EXEMPEL);
  assert(r, "exemplet måste parsa");
  assertEquals(r!.bore_mm, 25);
  assertEquals(r!.stroke_mm, 1100, "katalogen skriver 01 100 = 1100 mm");
  assertEquals(r!.is_standard, false, "exemplet har optioner satta");
  assertEquals(r!.options_before, "01000");
  assertEquals(r!.options_after, "000000100");
});

Deno.test("koden är exakt 25 tecken — varken fler eller färre", () => {
  const std = buildOsppCode(25, 1100)!;
  assertEquals(std.length, OSPP_CODE_LENGTH);
  // Våra egna produktrader var 22 tecken.
  assertEquals(parseOsppCode("OSPP160000001000000000"), null, "22 tecken är ingen OSP-P-kod");
  assertEquals(parseOsppCode(std + "0"), null, "26 tecken heller");
  assertEquals(parseOsppCode(std.slice(0, 24)), null, "24 tecken heller");
});

Deno.test("standardkoden har nollor på varje optionsposition", () => {
  const r = parseOsppCode(buildOsppCode(25, 1100)!)!;
  assert(r.is_standard, "alla optionsfält har ett nolläge i katalogen");
  assertEquals(buildOsppCode(25, 1100), "OSPP250000001100000000000");
});

Deno.test("slaglängden skrivs med fem siffror i hela millimeter", () => {
  // Katalogen: "5 digits in whole millimeters (ex. 1100mm = 01 100)".
  assertEquals(buildOsppCode(16, 100)!.slice(11, 16), "00100");
  assertEquals(buildOsppCode(16, 1100)!.slice(11, 16), "01100");
  assertEquals(buildOsppCode(16, 5500)!.slice(11, 16), "05500");
});

Deno.test("slagintervallet är 1–5500 mm, inte 100–14000", () => {
  // Databasen sa 100-14000. Katalogens egenskapstabell säger 1-5500 för
  // samtliga åtta borrningar; maxvärdet var alltså 2,5 gånger för högt.
  assertEquals(OSPP_STROKE.min, 1);
  assertEquals(OSPP_STROKE.max, 5500);
  assertEquals(buildOsppCode(25, 5501), null, "över katalogens max");
  assertEquals(buildOsppCode(25, 0), null, "under katalogens min");
  assert(buildOsppCode(25, 5500), "5500 ska gå");
});

Deno.test("Ø10 finns, Ø20 finns inte", () => {
  // Databasen listade 16,20,25,32,40,50,63,80. Katalogen (chunk 24) säger
  // "Bore 10 16 25 32 40 50 63 80" -- Ø10 saknades och Ø20 var påhittad.
  assertEquals(OSPP_BORES.map((b) => b.bore_mm), [10, 16, 25, 32, 40, 50, 63, 80]);
  assert(buildOsppCode(10, 100), "Ø10 ska gå att beställa");
  assertEquals(buildOsppCode(20, 100), null, "Ø20 finns inte i OSP-P");
});

Deno.test("varje borrning och slag går att bygga och läsa tillbaka", () => {
  const fel: string[] = [];
  for (const b of OSPP_BORES) {
    for (const stroke of [1, 100, 250, 1000, 2500, 5500]) {
      const kod = buildOsppCode(b.bore_mm, stroke);
      if (!kod) { fel.push(`Ø${b.bore_mm} ${stroke}mm: byggdes inte`); continue; }
      const r = parseOsppCode(kod);
      if (!r) { fel.push(`${kod}: parsade inte`); continue; }
      if (r.bore_mm !== b.bore_mm || r.stroke_mm !== stroke) {
        fel.push(`${kod}: läste Ø${r.bore_mm} ${r.stroke_mm}mm`);
      }
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("konfiguratorns mall ger samma kod som modellen", () => {
  // Bindningen mot det kunden faktiskt ser. Mallen använder #5 för att
  // nollutfylla slaglängden -- samma mekanism P1D behövde.
  const kravs = new Set(["bore_mm", "stroke_mm"]);
  const fel: string[] = [];
  for (const b of OSPP_BORES) {
    for (const stroke of [1, 100, 1100, 5500]) {
      const modell = buildOsppCode(b.bore_mm, stroke)!;
      const mall = fillOrderCodeTemplate(MALL, { bore_mm: b.code, stroke_mm: String(stroke) }, kravs);
      if (mall !== modell) fel.push(`Ø${b.bore_mm} ${stroke}mm: mallen ${mall}, modellen ${modell}`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("den gamla mallen producerade ingen giltig kod", () => {
  const gammal = "OSP-P{bore_mm}-{stroke_mm}";
  const ut = fillOrderCodeTemplate(gammal, { bore_mm: "25", stroke_mm: "1100" });
  assertEquals(ut, "OSP-P25-1100");
  assertEquals(parseOsppCode(ut), null, "den koden går inte att beställa");
});

Deno.test("vikten stämmer med katalogens tabell", () => {
  // Oberoende kryss: vikten är bas + slag/100 × tillägg (chunk 20). Stämmer
  // den för en känd rad har borr- och viktkolumnerna lästs ihop rätt.
  // OSP-P25: 0,65 kg vid 0 mm, 0,197 kg per 100 mm.
  assertEquals(Math.round(osppWeightKg(25, 0)! * 1000) / 1000, 0.65);
  assertEquals(Math.round(osppWeightKg(25, 1000)! * 100) / 100, 2.62);
  // Och vikten ska växa med både borrning och slag.
  assert(osppWeightKg(80, 100)! > osppWeightKg(10, 100)!);
  assert(osppWeightKg(25, 1000)! > osppWeightKg(25, 100)!);
});

Deno.test("tekniska gränser ur katalogen", () => {
  assertEquals(OSPP_LIMITS.pressure_max_bar, 8);
  assertEquals(OSPP_LIMITS.temp_min_c, -10);
  assertEquals(OSPP_LIMITS.temp_max_c, 80);
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(OSPP_SOURCE.edition, "0900P-7");
  assertEquals(OSPP_SOURCE.file, "0900P_Rodless.pdf");
});

Deno.test("våra nuvarande artikelnummer är inte OSP-P-koder", () => {
  // Dokumenterar fyndet i kod. De är 22 tecken, och slagpositionerna motsäger
  // radernas egna namn: "01000" = 1000 mm i en rad som heter "Ø16 100mm".
  for (const sku of [
    "OSPP160000001000000000",
    "OSPP250000002500000000",
    "OSPP630000010000000000",
  ]) {
    assertEquals(sku.length, 22, "22 tecken, inte 25");
    assertEquals(parseOsppCode(sku), null, `"${sku}" är ingen OSP-P-kod`);
  }
});

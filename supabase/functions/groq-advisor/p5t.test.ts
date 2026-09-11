/**
 * P5T-modellen mot Parkers katalog 0900P-7, avsnitt E.
 *
 * Facit är katalogens eget exempel, "P5T – J 032 D H S N 100" (chunk 6), plus
 * våra sju artiklar. De senare visade sig följa nyckeln så när som på ETT
 * tecken: ett extra bindestreck före optionspositionen.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  P5T_BORES,
  P5T_SOURCE,
  P5T_STANDARD_STROKES,
  P5T_STROKE,
  buildP5tCode,
  parseP5tCode,
} from "../../../src/lib/catalog/p5t.ts";

/** Katalogens exempel, chunk 6. */
const KATALOGENS_EXEMPEL = "P5T-" + "J" + "032" + "D" + "H" + "S" + "N" + "100";

/** Våra sju artiklar, i katalogens form efter reparationen. */
const FACIT: Array<[string, number, number]> = [
  ["P5T-J016DHSN025", 16, 25],
  ["P5T-J025DHSN050", 25, 50],
  ["P5T-J032DHSN100", 32, 100],
  ["P5T-J040DHSN100", 40, 100],
  ["P5T-J050DHSN100", 50, 100],
  ["P5T-J063DHSN100", 63, 100],
  ["P5T-J080DHSN200", 80, 200],
];

/** Samma artiklar som de SÅG UT före reparationen, med det extra bindestrecket. */
const FORE_REPARATION = FACIT.map(([sku]) => sku.replace(/N(\d{3})$/, "-N$1"));

const MALL = "P5T-{bearing}{bore_mm#3}{port_location}{port_style}{seals}{options}{stroke_mm#3}";

Deno.test("katalogens exempel läses rätt", () => {
  assertEquals(KATALOGENS_EXEMPEL, "P5T-J032DHSN100");
  assertEquals(KATALOGENS_EXEMPEL.length, 15);
  const r = parseP5tCode(KATALOGENS_EXEMPEL)!;
  assert(r);
  assertEquals(r.bearing, "J");
  assertEquals(r.bore_mm, 32);
  assertEquals(r.port_location, "D");
  assertEquals(r.port_style, "H");
  assertEquals(r.seals, "S");
  assertEquals(r.options, "N");
  assertEquals(r.stroke_mm, 100);
  assertEquals(r.legacy_hyphen, false, "katalogen har inget extra bindestreck");
});

Deno.test("våra sju artiklar är i katalogens form", () => {
  const fel: string[] = [];
  for (const [sku, bore, stroke] of FACIT) {
    const r = parseP5tCode(sku);
    if (!r) { fel.push(`${sku}: parsade inte`); continue; }
    if (r.bore_mm !== bore) fel.push(`${sku}: borrning ${r.bore_mm}`);
    if (r.stroke_mm !== stroke) fel.push(`${sku}: slag ${r.stroke_mm}`);
    if (r.legacy_hyphen) fel.push(`${sku}: extra bindestreck kvar`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("den gamla formen läses fortfarande, men skrivs inte", () => {
  // Raderna hette "P5T-J016DHS-N025" med ett extra bindestreck före
  // optionspositionen. Katalogen har bara ett, efter serienamnet. De var alltså
  // inte påhittade som KPZ:s -- bara ett tecken för långa, och de är rättade.
  // Parsern läser båda formerna så att en gammal kod i ett mejl eller en gammal
  // offert fortfarande går att slå upp.
  const fel: string[] = [];
  for (let i = 0; i < FORE_REPARATION.length; i++) {
    const gammal = FORE_REPARATION[i];
    const r = parseP5tCode(gammal);
    if (!r) { fel.push(`${gammal}: gamla formen måste gå att läsa`); continue; }
    if (!r.legacy_hyphen) fel.push(`${gammal}: skulle flaggas som gammal form`);
    if (buildP5tCode(r) !== FACIT[i][0]) fel.push(`${gammal} -> ${buildP5tCode(r)}, väntade ${FACIT[i][0]}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("koden skrivs alltid i katalogens form", () => {
  // parse läser båda, build skriver en. Reparationen är att köra raderna
  // genom build.
  const fel: string[] = [];
  for (const gammal of FORE_REPARATION) {
    const r = parseP5tCode(gammal)!;
    const ren = buildP5tCode(r)!;
    if (ren.includes("-N") || ren.includes("-B")) fel.push(`${ren}: kvar bindestreck`);
    if (parseP5tCode(ren)!.legacy_hyphen) fel.push(`${ren}: build ska inte skriva det`);
    const r2 = parseP5tCode(ren)!;
    if (r2.bore_mm !== r.bore_mm || r2.stroke_mm !== r.stroke_mm) fel.push(`${gammal} -> ${ren}: värden ändrades`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("nio borrningar, 16 till 100 mm", () => {
  assertEquals(P5T_BORES, [16, 20, 25, 32, 40, 50, 63, 80, 100]);
  assertEquals(buildP5tCode({ bore_mm: 12, stroke_mm: 25 }), null);
});

Deno.test("slaglängden är 10–400 mm, inte 5–400", () => {
  // Katalogen: "Strokes 10 to 400mm depending on model". Databasen sa 5.
  assertEquals(P5T_STROKE.min, 10);
  assertEquals(P5T_STROKE.max, 400);
  assertEquals(buildP5tCode({ bore_mm: 32, stroke_mm: 5 }), null);
  assert(buildP5tCode({ bore_mm: 32, stroke_mm: 10 }));
  assertEquals(buildP5tCode({ bore_mm: 32, stroke_mm: 401 }), null);
});

Deno.test("alla våra artiklar har standardslaglängd", () => {
  const avvikande = FACIT.filter(([, , s]) => !P5T_STANDARD_STROKES.includes(s)).map(([k]) => k);
  assertEquals(avvikande, [], avvikande.join(", "));
});

Deno.test("fel form parsas inte", () => {
  for (const bad of [
    "P5T-16A25",        // vad den gamla mallen producerade
    "P5T-J16DHSN100",   // borrningen inte nollutfylld
    "P5T-J032DHSN1000", // slaglängden för lång
    "P5T-Z032DHSN100",  // okänt lager
    "P5T-J032XHSN100",  // okänt portläge
  ]) {
    assertEquals(parseP5tCode(bad), null, `"${bad}" borde inte parsa`);
  }
});

Deno.test("konfiguratorns mall ger katalogens form", () => {
  const kravs = new Set(["bore_mm", "stroke_mm"]);
  const fel: string[] = [];
  for (const [sku] of FACIT) {
    const r = parseP5tCode(sku)!;
    const sel = {
      bearing: r.bearing, bore_mm: String(r.bore_mm), port_location: r.port_location,
      port_style: r.port_style, seals: r.seals, options: r.options,
      stroke_mm: String(r.stroke_mm),
    };
    const byggd = fillOrderCodeTemplate(MALL, sel, kravs);
    const vantat = buildP5tCode(r)!;
    if (byggd !== vantat) fel.push(`${sku}: mallen ${byggd}, modellen ${vantat}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("den gamla mallen kunde inte bygga en enda artikel", () => {
  const ut = fillOrderCodeTemplate("P5T-{bore_mm}A{stroke_mm}", { bore_mm: "32", stroke_mm: "100" });
  assertEquals(ut, "P5T-32A100");
  assertEquals(parseP5tCode(ut), null);
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(P5T_SOURCE.edition, "0900P-7");
  assertEquals(P5T_SOURCE.file, "0900P_Guided.pdf");
});

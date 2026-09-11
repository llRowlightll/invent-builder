/**
 * P1P-modellen mot Parkers katalog 0900P-7 och mot våra egna artiklar.
 *
 * Den här familjen har TVÅ facit, och det är ovanligt:
 *   - katalogens eget exempel, "P1P S 032 D C 7 G 0 0 2 5" (chunk 20)
 *   - våra åtta produktrader, som visade sig FÖLJA nyckeln
 *
 * Revisionen flaggade P1P som noll av åtta hittade i katalogen. Det var ett
 * falskt larm: Parker trycker en beställnyckel, inte en artikelnummerlista, så
 * det finns inget att slå upp emot. Testet nedan visar det i stället --
 * koderna parsar, byggs tillbaka, och varje position hör hemma i nyckeln.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  P1P_BORES,
  P1P_CODE_LENGTH,
  P1P_RULES,
  P1P_SOURCE,
  P1P_STANDARD_STROKES,
  P1P_STROKE,
  buildP1pCode,
  parseP1pCode,
} from "../../../src/lib/catalog/p1p.ts";

/** Katalogens exempel, chunk 20. */
const KATALOGENS_EXEMPEL = "P1P" + "S" + "032" + "D" + "C" + "7" + "G" + "0025";

/** Våra åtta artiklar ur products, 2026-09-12. */
const FACIT: Array<[string, number, number]> = [
  ["P1PS020DC7G0025", 20, 25],
  ["P1PS025DC7G0025", 25, 25],
  ["P1PS032DC7G0050", 32, 50],
  ["P1PS040DC7G0050", 40, 50],
  ["P1PS050DC7G0100", 50, 100],
  ["P1PS063DC7G0100", 63, 100],
  ["P1PS080DC7G0100", 80, 100],
  ["P1PS100DC7G0100", 100, 100],
];

// Magnetpositionen är hårdkodad till G. Katalogen skriver ut "Magnet G" men
// har tappat koden för "Non Magnetic Function" i textutvinningen, så det finns
// bara ETT verifierat värde -- och ett val med ett alternativ är inget val.
const MALL = "P1P{version}{bore_mm#3}{function}{temperature}{rod_thread}G{stroke_mm#4}";

Deno.test("katalogens exempel är 15 tecken och läses rätt", () => {
  assertEquals(KATALOGENS_EXEMPEL.length, P1P_CODE_LENGTH);
  const r = parseP1pCode(KATALOGENS_EXEMPEL)!;
  assert(r, "exemplet måste parsa");
  assertEquals(r.version, "S");
  assertEquals(r.bore_mm, 32);
  assertEquals(r.function, "D");
  assertEquals(r.temperature, "C");
  assertEquals(r.rod_thread, "7");
  assertEquals(r.ports, "G");
  assertEquals(r.stroke_mm, 25);
});

Deno.test("våra åtta artiklar FÖLJER katalogens nyckel", () => {
  // Det som gör P1P annorlunda: produktraderna är rätt. Revisionens nolla var
  // ett falskt larm -- katalogen trycker en nyckel, inte en artikellista.
  const fel: string[] = [];
  for (const [sku, bore, stroke] of FACIT) {
    if (sku.length !== P1P_CODE_LENGTH) { fel.push(`${sku}: ${sku.length} tecken`); continue; }
    const r = parseP1pCode(sku);
    if (!r) { fel.push(`${sku}: parsade inte`); continue; }
    if (r.bore_mm !== bore) fel.push(`${sku}: borrning ${r.bore_mm}, väntade ${bore}`);
    if (r.stroke_mm !== stroke) fel.push(`${sku}: slag ${r.stroke_mm}, väntade ${stroke}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("varje artikel byggs tillbaka till exakt sig själv", () => {
  const trasiga: string[] = [];
  for (const [sku] of FACIT) {
    const r = parseP1pCode(sku)!;
    const ater = buildP1pCode(r);
    if (ater !== sku) trasiga.push(`${sku} -> ${ater}`);
  }
  assertEquals(trasiga, [], trasiga.join("\n"));
});

Deno.test("Ø80 och Ø100 finns — konfiguratorn saknade båda", () => {
  // Databasen listade 20,25,32,40,50,63. Katalogen har åtta borrningar, och vi
  // SÄLJER Ø80 och Ø100 -- de gick alltså inte att konfigurera fram.
  assertEquals(P1P_BORES, [20, 25, 32, 40, 50, 63, 80, 100]);
  assert(buildP1pCode({ bore_mm: 80, stroke_mm: 100 }), "Ø80 ska gå");
  assert(buildP1pCode({ bore_mm: 100, stroke_mm: 100 }), "Ø100 ska gå");
  assertEquals(buildP1pCode({ bore_mm: 16, stroke_mm: 25 }), null, "Ø16 finns inte i P1P");
});

Deno.test("slaglängden är 1–500 mm med fyra siffror", () => {
  assertEquals(P1P_STROKE.max, 500);
  assertEquals(buildP1pCode({ bore_mm: 32, stroke_mm: 5 })!.slice(11), "0005");
  assertEquals(buildP1pCode({ bore_mm: 32, stroke_mm: 500 })!.slice(11), "0500");
  assertEquals(buildP1pCode({ bore_mm: 32, stroke_mm: 501 }), null);
});

Deno.test("fel form parsas inte", () => {
  for (const bad of [
    "P1P-2000025N",      // vad den gamla mallen producerade
    "P1PS020DC7G025",    // slaglängden för kort
    "P1PS20DC7G0025",    // borrningen inte nollutfylld
    "P1PX020DC7G0025",   // okänt utförande
    "P1PS020DC7G0025X",  // för långt
  ]) {
    assertEquals(parseP1pCode(bad), null, `"${bad}" borde inte parsa`);
  }
});

Deno.test("katalogens begränsningar larmar", () => {
  const kor = (c: Record<string, unknown>, sev: "error" | "warn" = "error") =>
    P1P_RULES.filter((r) => r.severity === sev && evalLogic(r.when, c)).map((r) => r.note);
  const bas = { version: "S", bore_mm: "032", function: "D", stroke_mm: 50 };

  assertEquals(kor(bas), [], "standardkonfigurationen ska vara ren");
  // "G Guided 20-63 mm Bore"
  // Borrningen skickas nollutfylld, som konfiguratorns kod ser ut.
  assert(kor({ ...bas, version: "G", bore_mm: "080" }).includes("P1P1"));
  assert(kor({ ...bas, version: "G", bore_mm: "100" }).includes("P1P1"));
  assertEquals(kor({ ...bas, version: "G", bore_mm: "063" }), [], "Ø63 är tillåtet");
  // "Single Acting (Bore 20 - 63mm)"
  assert(kor({ ...bas, function: "S", bore_mm: "100", stroke_mm: 25 }).includes("P1P2"));
  // "NOTE: Single acting only available as 25 mm stroke"
  assert(kor({ ...bas, function: "T", stroke_mm: 50 }).includes("P1P3"));
  assertEquals(kor({ ...bas, function: "T", stroke_mm: 25 }), [], "25 mm är tillåtet");
});

Deno.test("specialslag varnar men avvisas inte", () => {
  const kor = (c: Record<string, unknown>, sev: "error" | "warn") =>
    P1P_RULES.filter((r) => r.severity === sev && evalLogic(r.when, c)).map((r) => r.note);
  const c = { version: "S", bore_mm: "032", function: "D", stroke_mm: 33 };
  assertEquals(kor(c, "error"), [], "33 mm är beställbart");
  assertEquals(kor(c, "warn"), ["P1P4"], "men ska varna om leveranstid");
  // Och alla våra egna artiklar ska ha standardlängd.
  const avvikande = FACIT.filter(([, , s]) => !P1P_STANDARD_STROKES.includes(s)).map(([k]) => k);
  assertEquals(avvikande, [], `ej standardslag: ${avvikande.join(", ")}`);
});

Deno.test("konfiguratorns mall reproducerar alla åtta artiklar", () => {
  const kravs = new Set(["bore_mm", "stroke_mm"]);
  const trasiga: string[] = [];
  for (const [sku] of FACIT) {
    const r = parseP1pCode(sku)!;
    const sel: Record<string, string> = {
      version: r.version, bore_mm: String(r.bore_mm), function: r.function,
      temperature: r.temperature, rod_thread: r.rod_thread,
      stroke_mm: String(r.stroke_mm),
    };
    const byggd = fillOrderCodeTemplate(MALL, sel, kravs);
    if (byggd !== sku) trasiga.push(`${sku} -> ${byggd}`);
  }
  assertEquals(trasiga, [], trasiga.join("\n"));
});

Deno.test("den gamla mallen kunde inte bygga en enda artikel", () => {
  const gammal = "P1P-{bore_mm}0{stroke_mm}N{thread}";
  const ut = fillOrderCodeTemplate(gammal, { bore_mm: "20", stroke_mm: "25", thread: "7" });
  assertEquals(ut, "P1P-20025N7");
  assertEquals(parseP1pCode(ut), null);
  assert(!FACIT.some(([k]) => k === ut));
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(P1P_SOURCE.edition, "0900P-7");
  assertEquals(P1P_SOURCE.standard, "ISO 21287");
});

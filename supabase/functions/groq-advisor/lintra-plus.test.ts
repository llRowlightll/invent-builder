/**
 * LINTRA Plus-modellen mot Norgrens katalog.
 *
 * Facit är katalogens tillgänglighetstabell (chunk 1-2), som trycker mönstret
 * per borrning och styrningstyp med en asterisk där slaglängden ska stå:
 *
 *   16   M/146016/M/*   M/146116/M/*   –
 *   25   *146025/M*     *146125/M*     *146225/M*
 *   80   *146080/M/*    *146180/M/*    –
 *
 * Strecken är inte dekoration: precisionsrullstyrningen finns inte för Ø16,
 * Ø20 och Ø80, och den som konfigurerar fram en sådan har beställt något som
 * inte tillverkas.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  LINTRA_BORES,
  LINTRA_GUIDES,
  LINTRA_LIMITS,
  LINTRA_SOURCE,
  buildLintraCode,
  lintraMaxStroke,
  parseLintraCode,
} from "../../../src/lib/catalog/lintra-plus.ts";

/** Våra sju artiklar ur products, 2026-09-12. */
const FACIT: Array<[string, string, number, number]> = [
  ["M/146016/M/200", "0", 16, 200],
  ["M/146025/M/300", "0", 25, 300],
  ["M/146032/M/500", "0", 32, 500],
  ["M/146040/M/500", "0", 40, 500],
  ["M/146050/M/1000", "0", 50, 1000],
  ["M/146063/M/1000", "0", 63, 1000],
  ["M/146125/M/500", "1", 25, 500],
];

const MALL = "M/146{guide}{bore_mm#2}/M/{stroke_mm}";

Deno.test("våra sju artiklar följer katalogens mönster", () => {
  // Revisionen sa noll av sju hittade. Katalogen trycker mönstret med en
  // asterisk i stället för slaglängd -- det finns inget fullständigt
  // artikelnummer att slå upp emot. Formen stämmer däremot exakt.
  const fel: string[] = [];
  for (const [sku, guide, bore, stroke] of FACIT) {
    const r = parseLintraCode(sku);
    if (!r) { fel.push(`${sku}: parsade inte`); continue; }
    if (r.guide !== guide) fel.push(`${sku}: styrning ${r.guide}, väntade ${guide}`);
    if (r.bore_mm !== bore) fel.push(`${sku}: borrning ${r.bore_mm}`);
    if (r.stroke !== stroke) fel.push(`${sku}: slag ${r.stroke}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("den externa styrningen känns igen på sin etta", () => {
  // M/146125/M/500 heter "Ø25 External-Guide" i vår katalog, och mycket riktigt
  // står en etta på styrningspositionen. Namnet och koden är överens.
  const r = parseLintraCode("M/146125/M/500")!;
  assertEquals(r.guide, "1");
  assertEquals(r.bore_mm, 25);
  assertEquals(LINTRA_GUIDES.find((g) => g.code === "1")!.label_sv, "Extern styrning");
});

Deno.test("varje artikel byggs tillbaka till sig själv", () => {
  const trasiga: string[] = [];
  for (const [sku] of FACIT) {
    const r = parseLintraCode(sku)!;
    const ater = buildLintraCode({ guide: r.guide, bore_mm: r.bore_mm, stroke_mm: r.stroke });
    if (ater !== sku) trasiga.push(`${sku} -> ${ater}`);
  }
  assertEquals(trasiga, [], trasiga.join("\n"));
});

Deno.test("rullstyrningen finns inte för Ø16, Ø20 och Ø80", () => {
  // Katalogens tabell skriver "–" i de rutorna.
  for (const bore of [16, 20, 80]) {
    assertEquals(buildLintraCode({ guide: "2", bore_mm: bore, stroke_mm: 500 }), null,
      `rullstyrning Ø${bore} ska inte gå`);
    assertEquals(parseLintraCode(`M/1462${String(bore).padStart(2, "0")}/M/500`), null);
  }
  // ...men finns för Ø25 till Ø63.
  for (const bore of [25, 32, 40, 50, 63]) {
    assert(buildLintraCode({ guide: "2", bore_mm: bore, stroke_mm: 500 }), `Ø${bore} ska gå`);
  }
});

Deno.test("slagtaket är borrningsberoende — databasen hade ett enda", () => {
  // Databasen sa 50-8500 för alla. Katalogen: Ø16-40 8500, Ø50/63 8000,
  // Ø80 5500. En Ø80 med 8000 mm slag gick alltså att konfigurera fram.
  assertEquals(lintraMaxStroke(16), 8500);
  assertEquals(lintraMaxStroke(40), 8500);
  assertEquals(lintraMaxStroke(50), 8000);
  assertEquals(lintraMaxStroke(63), 8000);
  assertEquals(lintraMaxStroke(80), 5500);
  assert(buildLintraCode({ bore_mm: 40, stroke_mm: 8500 }));
  assertEquals(buildLintraCode({ bore_mm: 40, stroke_mm: 8501 }), null);
  assertEquals(buildLintraCode({ bore_mm: 80, stroke_mm: 8000 }), null, "Ø80 slutar vid 5500");
  assert(buildLintraCode({ bore_mm: 80, stroke_mm: 5500 }));
});

Deno.test("anslutningen följer borrningen", () => {
  const vantat: Record<number, string> = {
    16: "M5", 20: "G 1/8", 25: "G 1/8", 32: "G 1/4",
    40: "G 1/4", 50: "G 3/8", 63: "G 1/2", 80: "G 1/2",
  };
  for (const b of LINTRA_BORES) {
    assertEquals(b.port, vantat[b.bore_mm], `Ø${b.bore_mm}`);
  }
  assertEquals(parseLintraCode("M/146032/M/500")!.port, "G 1/4");
});

Deno.test("åtta borrningar", () => {
  assertEquals(LINTRA_BORES.map((b) => b.bore_mm), [16, 20, 25, 32, 40, 50, 63, 80]);
  assertEquals(buildLintraCode({ bore_mm: 100, stroke_mm: 500 }), null);
});

Deno.test("fel form parsas inte", () => {
  for (const bad of [
    "146146000/16/200/M",  // vad den gamla mallen producerade
    "M/146316/M/200",      // styrningssiffra 3 finns inte
    "M/14616/M/200",       // borrningen inte tvåsiffrig
    "X/146016/M/200",      // okänt måttsystem
  ]) {
    assertEquals(parseLintraCode(bad), null, `"${bad}" borde inte parsa`);
  }
});

Deno.test("konfiguratorns mall reproducerar alla sju", () => {
  const kravs = new Set(["bore_mm", "stroke_mm"]);
  const trasiga: string[] = [];
  for (const [sku, guide, bore, stroke] of FACIT) {
    const byggd = fillOrderCodeTemplate(
      MALL, { guide, bore_mm: String(bore), stroke_mm: String(stroke) }, kravs,
    );
    if (byggd !== sku) trasiga.push(`${sku} -> ${byggd}`);
  }
  assertEquals(trasiga, [], trasiga.join("\n"));
});

Deno.test("den gamla mallen producerade nonsens", () => {
  const ut = fillOrderCodeTemplate(
    "146{series_code}/{bore_mm}/{stroke_mm}/M",
    { series_code: "146000", bore_mm: "16", stroke_mm: "200" },
  );
  assertEquals(ut, "146146000/16/200/M");
  assertEquals(parseLintraCode(ut), null);
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(LINTRA_SOURCE.brand, "Norgren");
  assertEquals(LINTRA_LIMITS.temp_min_c, -30);
  assertEquals(LINTRA_LIMITS.temp_max_c, 80);
});

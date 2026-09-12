/**
 * P1F-modellen mot Parkers katalog PDE2667TCEN.
 *
 * Facit är katalogens eget exempel, tryckt tecken för tecken i chunk 19:
 *
 *   P 1 F - T 1 6 0 M S X 0 1 6 0 - 0 0 0 0
 *
 * plus våra fem produktrader, som följer det exakt.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  P1F_BORES,
  P1F_SOURCE,
  P1F_STROKE,
  buildP1fCode,
  parseP1fCode,
} from "../../../src/lib/catalog/p1f.ts";

/** Katalogens exempel, chunk 19. */
const KATALOGENS_EXEMPEL = "P1F-" + "T" + "160" + "M" + "S" + "X" + "0160" + "-" + "0000";

/** Våra fem artiklar ur products, 2026-09-12. */
const FACIT: Array<[string, number, number]> = [
  ["P1F-T160MSX0100-0000", 160, 100],
  ["P1F-T160MSX0250-0000", 160, 250],
  ["P1F-T200MSX0100-0000", 200, 100],
  ["P1F-T250MSX0100-0000", 250, 100],
  ["P1F-T320MSX0100-0000", 320, 100],
];

const MALL = "P1F-{design}{bore_mm}{temperature}{rod}{piston}{stroke_mm#4}-0000";

Deno.test("katalogens exempel läses rätt", () => {
  assertEquals(KATALOGENS_EXEMPEL, "P1F-T160MSX0160-0000");
  const r = parseP1fCode(KATALOGENS_EXEMPEL)!;
  assert(r, "exemplet måste parsa");
  assertEquals(r.design, "T");
  assertEquals(r.bore_mm, 160);
  assertEquals(r.temperature, "M");
  assertEquals(r.rod, "S");
  assertEquals(r.piston, "X");
  assertEquals(r.stroke_mm, 160);
  assertEquals(r.extension, "0000");
});

Deno.test("våra fem artiklar följer nyckeln", () => {
  const fel: string[] = [];
  for (const [sku, bore, stroke] of FACIT) {
    const r = parseP1fCode(sku);
    if (!r) { fel.push(`${sku}: parsade inte`); continue; }
    if (r.bore_mm !== bore) fel.push(`${sku}: borrning ${r.bore_mm}`);
    if (r.stroke_mm !== stroke) fel.push(`${sku}: slag ${r.stroke_mm}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("varje artikel byggs tillbaka till sig själv", () => {
  const trasiga: string[] = [];
  for (const [sku] of FACIT) {
    const ater = buildP1fCode(parseP1fCode(sku)!);
    if (ater !== sku) trasiga.push(`${sku} -> ${ater}`);
  }
  assertEquals(trasiga, [], trasiga.join("\n"));
});

Deno.test("P1F tar vid där P1D slutar", () => {
  // P1D går 32-125 mm, P1F 160-320. Namnlikheten till trots är det två
  // olika nycklar för två olika storleksintervall.
  assertEquals(P1F_BORES, [160, 200, 250, 320]);
  assertEquals(buildP1fCode({ bore_mm: 125, stroke_mm: 100 }), null, "Ø125 hör till P1D");
  assertEquals(buildP1fCode({ bore_mm: 400, stroke_mm: 100 }), null, "Ø400 finns inte");
  assert(buildP1fCode({ bore_mm: 320, stroke_mm: 100 }));
});

Deno.test("slaglängden är 10–2300 mm, inte 1–2300", () => {
  // Katalogen: "Stroke length 10 - 2300 mm". Databasen sa 1 -- maxvärdet
  // stämde, den undre gränsen inte.
  assertEquals(P1F_STROKE.min, 10);
  assertEquals(P1F_STROKE.max, 2300);
  assertEquals(buildP1fCode({ bore_mm: 160, stroke_mm: 9 }), null);
  assert(buildP1fCode({ bore_mm: 160, stroke_mm: 10 }));
  assertEquals(buildP1fCode({ bore_mm: 160, stroke_mm: 2301 }), null);
});

Deno.test("slaglängden nollutfylls till fyra siffror", () => {
  assertEquals(buildP1fCode({ bore_mm: 160, stroke_mm: 10 })!.slice(11, 15), "0010");
  assertEquals(buildP1fCode({ bore_mm: 160, stroke_mm: 2300 })!.slice(11, 15), "2300");
});

Deno.test("alla fyra optionspositioner går att välja", () => {
  // Genomgående kolvstång, hög temperatur, invändig gänga och kolv utan magnet
  // står alla i nyckeln och ska gå att konfigurera fram.
  assertEquals(
    buildP1fCode({ design: "N", bore_mm: 200, temperature: "F", rod: "E", piston: "A", stroke_mm: 500 }),
    "P1F-N200FEA0500-0000",
  );
  const r = parseP1fCode("P1F-N200FEA0500-0000")!;
  assertEquals([r.design, r.temperature, r.rod, r.piston], ["N", "F", "E", "A"]);
});

Deno.test("fel form parsas inte", () => {
  for (const bad of [
    "P1F-S160M-100",       // vad den gamla mallen producerade
    "P1F-T160MSX100-0000", // slaglängden inte nollutfylld
    "P1F-X160MSX0100-0000", // okänd profil
    "P1F-T160MSX0100",     // tillägget saknas
    "P1F-T125MSX0100-0000", // borrning som hör till P1D
  ]) {
    assertEquals(parseP1fCode(bad), null, `"${bad}" borde inte parsa`);
  }
});

Deno.test("konfiguratorns mall reproducerar alla fem", () => {
  const kravs = new Set(["bore_mm", "stroke_mm"]);
  const trasiga: string[] = [];
  for (const [sku] of FACIT) {
    const r = parseP1fCode(sku)!;
    const sel = {
      design: r.design, bore_mm: String(r.bore_mm), temperature: r.temperature,
      rod: r.rod, piston: r.piston, stroke_mm: String(r.stroke_mm),
    };
    const byggd = fillOrderCodeTemplate(MALL, sel, kravs);
    if (byggd !== sku) trasiga.push(`${sku} -> ${byggd}`);
  }
  assertEquals(trasiga, [], trasiga.join("\n"));
});

Deno.test("den gamla mallen kunde inte bygga en enda artikel", () => {
  const ut = fillOrderCodeTemplate("P1F-S{bore_mm}M{thread}-{stroke_mm}",
    { bore_mm: "160", thread: "S", stroke_mm: "100" });
  assertEquals(ut, "P1F-S160MS-100");
  assertEquals(parseP1fCode(ut), null);
  assert(!FACIT.some(([k]) => k === ut));
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(P1F_SOURCE.edition, "PDE2667TCEN");
  assertEquals(P1F_SOURCE.standard, "ISO 15552");
});

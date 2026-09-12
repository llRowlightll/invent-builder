/**
 * Serie 6E-modellen mot Camozzis katalog 2026/05.
 *
 * Facit är katalogens eget kodexempel (chunk 3) och den mekaniska tabellen
 * (chunk 5), som listar dynamisk last för varje (storlek, stigning) -- alltså
 * exakt de kombinationer som tillverkas.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  SERIE_6E_SIZES,
  SERIE_6E_SOURCE,
  SERIE_6E_STROKE,
  build6eCode,
  parse6eCode,
  pitchCode,
  serie6eCombinations,
} from "../../../src/lib/catalog/serie-6e.ts";

/** Katalogens kodexempel, chunk 3: 6E 032 BS 0200 P05 A P */
const KATALOGENS_EXEMPEL = "6E" + "032" + "BS" + "0200" + "P05" + "A" + "P";

/** Våra fyra rader som de ser ut i dag. */
const VARA_RADER = ["6E-025-0100-24", "6E-040-0150-24", "6E-063-0200-24", "6E-080-0300-24"];

const MALL = "6E{size}BS{stroke_mm#4}{pitch}AP";

Deno.test("katalogens kodexempel läses rätt", () => {
  assertEquals(KATALOGENS_EXEMPEL, "6E032BS0200P05AP");
  const r = parse6eCode(KATALOGENS_EXEMPEL)!;
  assert(r, "exemplet måste parsa");
  assertEquals(r.size, 32);
  assertEquals(r.transmission, "BS");
  assertEquals(r.stroke_mm, 200);
  assertEquals(r.pitch_mm, 5);
  assertEquals(r.construction, "A");
  assertEquals(r.version, "P");
});

Deno.test("våra fyra rader är påhittade — på tre sätt", () => {
  for (const sku of VARA_RADER) {
    assertEquals(parse6eCode(sku), null, `"${sku}" är ingen giltig 6E-kod`);
    assert(sku.includes("-"), "katalogens kod har inga bindestreck");
    assert(/-24$/.test(sku), "suffixet -24 motsvarar ingen position i nyckeln");
  }
  // Och storlek 025 finns inte alls.
  assertEquals(SERIE_6E_SIZES.find((s) => s.code === "025"), undefined);
  assertEquals(build6eCode({ size: 25, stroke_mm: 100 }), null, "Ø25 tillverkas inte");
});

Deno.test("sex storlekar, inte fem", () => {
  assertEquals(SERIE_6E_SIZES.map((s) => s.size), [32, 40, 50, 63, 80, 100]);
});

Deno.test("stigningen är storleksberoende — det är nyckelns kärna", () => {
  // Ur den mekaniska tabellen: P16 bara för 40, P25 bara för 63, P32 bara för
  // 80 och P40 bara för 100. En konfigurator som erbjuder alla stigningar för
  // alla storlekar bygger koder som inte tillverkas.
  const fel: string[] = [];
  const vantat: Record<number, number[]> = {
    32: [5, 10], 40: [5, 10, 16], 50: [5, 10, 20],
    63: [5, 10, 25], 80: [5, 10, 20, 32], 100: [5, 10, 20, 40],
  };
  for (const s of SERIE_6E_SIZES) {
    if (s.pitches.join(",") !== vantat[s.size].join(",")) {
      fel.push(`storlek ${s.size}: ${s.pitches} mot väntat ${vantat[s.size]}`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
  // De fyra exklusiva stigningarna finns bara där de ska.
  assertEquals(build6eCode({ size: 32, stroke_mm: 200, pitch_mm: 16 }), null, "P16 är bara för 40");
  assert(build6eCode({ size: 40, stroke_mm: 200, pitch_mm: 16 }));
  assertEquals(build6eCode({ size: 80, stroke_mm: 200, pitch_mm: 25 }), null, "P25 är bara för 63");
  assert(build6eCode({ size: 63, stroke_mm: 200, pitch_mm: 25 }));
  assertEquals(build6eCode({ size: 100, stroke_mm: 200, pitch_mm: 32 }), null, "P32 är bara för 80");
  assert(build6eCode({ size: 80, stroke_mm: 200, pitch_mm: 32 }));
  assertEquals(build6eCode({ size: 80, stroke_mm: 200, pitch_mm: 40 }), null, "P40 är bara för 100");
  assert(build6eCode({ size: 100, stroke_mm: 200, pitch_mm: 40 }));
});

Deno.test("19 giltiga kombinationer av storlek och stigning", () => {
  // 2 + 3 + 3 + 3 + 4 + 4. Samma antal kolumner som den mekaniska tabellen har.
  assertEquals(serie6eCombinations().length, 19);
});

Deno.test("slaglängden är 100–1500 mm", () => {
  // Katalogen: "STROKE 100 ÷ 1500 mm". Databasen sa 1-1500.
  assertEquals(SERIE_6E_STROKE.min, 100);
  assertEquals(SERIE_6E_STROKE.max, 1500);
  assertEquals(build6eCode({ size: 40, stroke_mm: 99 }), null);
  assert(build6eCode({ size: 40, stroke_mm: 100 }));
  assertEquals(build6eCode({ size: 40, stroke_mm: 1501 }), null);
});

Deno.test("varje giltig kombination byggs och läses tillbaka", () => {
  const fel: string[] = [];
  for (const { size, pitch_mm } of serie6eCombinations()) {
    for (const stroke of [100, 500, 1500]) {
      const kod = build6eCode({ size, stroke_mm: stroke, pitch_mm });
      if (!kod) { fel.push(`${size}/${pitch_mm}/${stroke}: byggdes inte`); continue; }
      const r = parse6eCode(kod);
      if (!r) { fel.push(`${kod}: parsade inte`); continue; }
      if (r.size !== size || r.pitch_mm !== pitch_mm || r.stroke_mm !== stroke) {
        fel.push(`${kod}: läste ${r.size}/${r.pitch_mm}/${r.stroke_mm}`);
      }
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("stigningens kod nollutfylls", () => {
  assertEquals(pitchCode(5), "P05");
  assertEquals(pitchCode(10), "P10");
  assertEquals(pitchCode(40), "P40");
});

Deno.test("konfiguratorns mall ger samma kod som modellen", () => {
  const kravs = new Set(["size", "stroke_mm", "pitch"]);
  const fel: string[] = [];
  for (const { size, pitch_mm } of serie6eCombinations()) {
    const s = SERIE_6E_SIZES.find((x) => x.size === size)!;
    const byggd = fillOrderCodeTemplate(
      MALL, { size: s.code, stroke_mm: "200", pitch: pitchCode(pitch_mm) }, kravs);
    const modell = build6eCode({ size, stroke_mm: 200, pitch_mm })!;
    if (byggd !== modell) fel.push(`${size}/${pitch_mm}: mallen ${byggd}, modellen ${modell}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("den gamla mallen producerade ingen giltig kod", () => {
  const ut = fillOrderCodeTemplate("Serie 6E-{size}-{stroke_mm}-{motor_mount}",
    { size: "040", stroke_mm: "150", motor_mount: "24" });
  assertEquals(ut, "Serie 6E-040-150-24");
  assertEquals(parse6eCode(ut), null);
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(SERIE_6E_SOURCE.brand, "Camozzi");
  assertEquals(SERIE_6E_SOURCE.edition, "2026/05");
});

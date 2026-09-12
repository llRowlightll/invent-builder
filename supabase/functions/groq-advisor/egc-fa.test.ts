/**
 * EGC-FA-modellen mot Festos typkodstabell.
 *
 * Facit är typkoden i chunk 7-10 och den tekniska tabellen i chunk 11, som
 * anger arbetsslaget PER STORLEK -- det värde databasen hade som ett enda tal
 * för alla fyra.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  EGC_FA_CLAMPING,
  EGC_FA_LIMITS,
  EGC_FA_SIZES,
  EGC_FA_SLIDES,
  EGC_FA_SOURCE,
  buildEgcFaCode,
  egcFaMaxStroke,
  parseEgcFaCode,
} from "../../../src/lib/catalog/egc-fa.ts";

const MALL = "EGC-{size}-{stroke_mm}-FA-{stroke_reserve}-{slide}-{clamping}-{actuation}";

Deno.test("minimikoden har sex positioner", () => {
  // EGC - 80 - 500 - FA - 0H - GK
  assertEquals(buildEgcFaCode({ size: 80, stroke_mm: 500 }), "EGC-80-500-FA-0H-GK");
  const r = parseEgcFaCode("EGC-80-500-FA-0H-GK")!;
  assert(r, "minimikoden måste parsa");
  assertEquals(r.size, 80);
  assertEquals(r.stroke_mm, 500);
  assertEquals(r.stroke_reserve_mm, 0);
  assertEquals(r.slide, "GK");
  assertEquals(r.segments, []);
});

Deno.test("FA är position 004, inte en del av serienamnet", () => {
  // Familjen heter EGC-FA, men i typkoden står EGC på position 001 och FA på
  // 004 -- med storlek och slag emellan. Den som skriver "EGC-FA-80-500" har
  // vänt på det.
  assertEquals(parseEgcFaCode("EGC-FA-80-500-0H-GK"), null);
  assert(parseEgcFaCode("EGC-80-500-FA-0H-GK"));
});

Deno.test("arbetsslaget är storleksberoende — databasen hade ett enda", () => {
  // Katalogen, chunk 11: storlek 70 går 50-5000 mm, de tre större 50-8500.
  // Databasen sa 1-3000 för alla fyra: fel undre gräns, fel övre gräns, och
  // ingen skillnad mellan storlekarna.
  assertEquals(egcFaMaxStroke(70), 5000);
  assertEquals(egcFaMaxStroke(80), 8500);
  assertEquals(egcFaMaxStroke(120), 8500);
  assertEquals(egcFaMaxStroke(185), 8500);

  assertEquals(buildEgcFaCode({ size: 70, stroke_mm: 5001 }), null, "storlek 70 slutar vid 5000");
  assert(buildEgcFaCode({ size: 70, stroke_mm: 5000 }));
  assert(buildEgcFaCode({ size: 80, stroke_mm: 8500 }), "storlek 80 går till 8500");
  assertEquals(buildEgcFaCode({ size: 80, stroke_mm: 8501 }), null);

  // Och den undre gränsen är 50, inte 1.
  assertEquals(buildEgcFaCode({ size: 80, stroke_mm: 49 }), null);
  assert(buildEgcFaCode({ size: 80, stroke_mm: 50 }));

  // Det databasen tillät men katalogen inte har: 3000 mm var taket, men
  // storlek 185 går nästan tre gånger längre.
  assert(buildEgcFaCode({ size: 185, stroke_mm: 8000 }), "8000 mm är beställbart");
});

Deno.test("fyra storlekar", () => {
  assertEquals(EGC_FA_SIZES.map((s) => s.size), [70, 80, 120, 185]);
  assertEquals(buildEgcFaCode({ size: 100, stroke_mm: 500 }), null);
});

Deno.test("ovalda positioner utelämnas helt", () => {
  // Samma konvention som DSBC: inga tomma segment, inga dubbla bindestreck.
  const utan = buildEgcFaCode({ size: 120, stroke_mm: 1000 })!;
  assertEquals(utan, "EGC-120-1000-FA-0H-GK");
  assert(!utan.includes("--"), "inga tomma segment");

  const med = buildEgcFaCode({
    size: 120, stroke_mm: 1000, slide: "GV", clamping: "2H", actuation: "PN", foot: "F",
  })!;
  assertEquals(med, "EGC-120-1000-FA-0H-GV-2H-PN-F");
  assert(!med.includes("--"));
});

Deno.test("slagreserven skrivs med H", () => {
  assertEquals(buildEgcFaCode({ size: 80, stroke_mm: 500, stroke_reserve_mm: 0 }), "EGC-80-500-FA-0H-GK");
  assertEquals(buildEgcFaCode({ size: 80, stroke_mm: 500, stroke_reserve_mm: 100 }), "EGC-80-500-FA-100H-GK");
  assertEquals(parseEgcFaCode("EGC-80-500-FA-100H-GK")!.stroke_reserve_mm, 100);
  // Katalogen: "...H 0 ... 999 mm".
  assertEquals(buildEgcFaCode({ size: 80, stroke_mm: 500, stroke_reserve_mm: 1000 }), null);
  assert(buildEgcFaCode({ size: 80, stroke_mm: 500, stroke_reserve_mm: 999 }));
});

Deno.test("sliden och klämenheten har katalogens koder", () => {
  assertEquals(EGC_FA_SLIDES.map((s) => s.code), ["GK", "GP", "GV", "GQ"]);
  assertEquals(EGC_FA_CLAMPING.map((c) => c.code), ["", "1HL", "1HR", "2H"]);
  assertEquals(buildEgcFaCode({ size: 80, stroke_mm: 500, slide: "GX" }), null, "GX finns inte");
  assertEquals(buildEgcFaCode({ size: 80, stroke_mm: 500, clamping: "3H" }), null, "3H finns inte");
});

Deno.test("datasheetets egna koder går att läsa", () => {
  // Chunk 49 visar "EGC-120-...-1HL-PN" och "EGC-185-...-C-2H-PN" med
  // slaglängden utelämnad. Med ett slag insatt ska de parsa.
  const a = parseEgcFaCode("EGC-120-1000-FA-0H-GK-1HL-PN")!;
  assert(a, "1HL-PN-varianten");
  assertEquals(a.size, 120);
  assertEquals(a.segments, ["1HL", "PN"]);
  const b = parseEgcFaCode("EGC-185-2000-FA-0H-GK-C-2H-PN")!;
  assert(b, "C-2H-PN-varianten");
  assertEquals(b.segments, ["C", "2H", "PN"]);
});

Deno.test("varje storlek och slid byggs och läses tillbaka", () => {
  const fel: string[] = [];
  for (const s of EGC_FA_SIZES) {
    for (const slide of EGC_FA_SLIDES) {
      for (const stroke of [50, 1000, s.stroke_max_mm]) {
        const kod = buildEgcFaCode({ size: s.size, stroke_mm: stroke, slide: slide.code });
        if (!kod) { fel.push(`${s.size}/${slide.code}/${stroke}: byggdes inte`); continue; }
        const r = parseEgcFaCode(kod);
        if (!r) { fel.push(`${kod}: parsade inte`); continue; }
        if (r.size !== s.size || r.stroke_mm !== stroke || r.slide !== slide.code) {
          fel.push(`${kod}: läste ${r.size}/${r.slide}/${r.stroke_mm}`);
        }
      }
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("konfiguratorns mall ger samma kod som modellen", () => {
  const kravs = new Set(["size", "stroke_mm"]);
  const fall: Array<[Record<string, string>, string]> = [
    [{ size: "80", stroke_mm: "500", stroke_reserve: "0H", slide: "GK" }, "EGC-80-500-FA-0H-GK"],
    [{ size: "120", stroke_mm: "1000", stroke_reserve: "0H", slide: "GV", clamping: "2H", actuation: "PN" },
     "EGC-120-1000-FA-0H-GV-2H-PN"],
  ];
  for (const [sel, vantat] of fall) {
    assertEquals(fillOrderCodeTemplate(MALL, sel, kravs), vantat);
  }
});

Deno.test("den gamla mallen producerade ingen giltig kod", () => {
  const ut = fillOrderCodeTemplate("EGC-FA-{size}-{stroke_mm}-{drive}",
    { size: "80", stroke_mm: "500", drive: "" });
  assertEquals(ut, "EGC-FA-80-500");
  assertEquals(parseEgcFaCode(ut), null);
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(EGC_FA_SOURCE.brand, "Festo");
  assertEquals(EGC_FA_SOURCE.edition, "2026/05");
  assertEquals(EGC_FA_LIMITS.max_speed_ms, 5);
  assertEquals(EGC_FA_LIMITS.max_accel_ms2, 50);
});

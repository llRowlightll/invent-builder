// Körs med: deno test supabase/functions/groq-advisor/porter.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { basta, gangaAv, normGanga, slangOdAv, stammer } from "./porter.ts";
import { buildMandatoryBomRows, type BomCtx } from "./bom-builder.ts";
import { type CatalogProduct, normalizeKeySpecs } from "./scoring.ts";
import { detectHazards } from "./signals.ts";

function p(sku: string, name: string, category: string, specs: Record<string, unknown> = {}): CatalogProduct {
  return { sku, name, category, brand: "festo", key_specs: normalizeKeySpecs(specs) };
}

Deno.test("gängan läses ur specen, annars ur namnet", () => {
  assertEquals(normGanga("G1/8"), "G1/8");
  assertEquals(normGanga("R1/4"), "R1/4");
  assertEquals(normGanga("Rc1/4"), "Rc1/4");
  assertEquals(normGanga("M5"), "M5");
  assertEquals(normGanga('1/4"'), "G1/4");
  assertEquals(normGanga("Slang på andra sidan"), null);
  assertEquals(gangaAv(p("FE-U-1-4", "U-1/4 ljuddämpare G1/4", "silencer")), "G1/4");
  assertEquals(gangaAv(p("FE-MFH-5-1-8", "Festo MFH-5-1/8-S Tiger Classic 5/2-ventil", "valve")), "G1/8");
  assertEquals(gangaAv(p("X", "QS-G1/4-10 push-in", "fitting", { thread: "G1/8" })), "G1/8");
});

Deno.test("slangdimensionen läses ur specen, annars ur namnet", () => {
  assertEquals(slangOdAv(p("FE-QS-G14-10", "QS-G1/4-10 push-in G1/4 Ø10", "fitting")), 10);
  assertEquals(slangOdAv(p("FE-GRLA-14-QS-8-D", "GRLA-1/4-QS-8 frånluftsstrypning", "flow-control")), 8);
  assertEquals(slangOdAv(p("FE-PAN-V0-10X1.5-BL-50", "PAN-V0 Ø10mm blå polyamidslang 50m", "tubing")), 10);
  assertEquals(slangOdAv(p("X", "Slang", "tubing", { tube_od_mm: "6" })), 6);
});

Deno.test("rätt gänga går före; samma storlek i annan standard före fel storlek", () => {
  const g14 = p("A", "QS-G1/4-8", "fitting", { thread: "G1/4", tube_od_mm: 8 });
  const r18 = p("B", "KQ2H06-01AS", "fitting", { thread: "R1/8", tube_od_mm: 6 });
  const g18 = p("C", "QS-G1/8-6", "fitting", { thread: "G1/8", tube_od_mm: 6 });
  assertEquals(basta([g14, r18, g18], { ganga: "G1/8" })?.sku, "C");
  assertEquals(basta([g14, r18], { ganga: "G1/8" })?.sku, "B");
  assertEquals(basta([g14], { ganga: "G1/8" })?.sku, "A"); // inget bättre finns
  assertEquals(stammer(g14, { ganga: "G1/8" }), false);
  assertEquals(stammer(g18, { ganga: "G1/8", od: 6 }), true);
  assertEquals(stammer(p("D", "Slang", "tubing"), { od: 6 }), null);
});

// Genomgången 2026-11-12: ventil G1/8, men tillbehör i G1/4 och slang Ø10.
Deno.test("stycklistan: tillbehören följer ventilens port och kopplingens slang", () => {
  const products = [
    p("FE-MFH-5-1-8", "Festo MFH-5-1/8-S Tiger Classic 5/2-ventil, G1/8", "valve", { valve_function: "5/2", port: "G1/8" }),
    p("FE-U-1-4", "U-1/4 ljuddämpare G1/4", "silencer", { thread: "G1/4" }),
    p("FESTO-2307", "Silencer", "fitting", { thread: "G1/8" }),
    p("FE-QS-G14-10", "QS-G1/4-10 push-in G1/4 Ø10", "fitting", { thread: "G1/4", tube_od_mm: 10 }),
    p("FE-QS-G18-6", "QS-G1/8-6 push-in G1/8 Ø6", "fitting", { thread: "G1/8", tube_od_mm: 6 }),
    p("FE-GRLA-14-QS-8-D", "GRLA-1/4-QS-8 frånluftsstrypning", "flow-control", { port_size: "G1/4", tube_od_mm: 8 }),
    p("FE-GRLA-18-QS-6-D", "GRLA-1/8-QS-6 frånluftsstrypning", "flow-control", { port_size: "G1/8", tube_od_mm: 6 }),
    p("FE-PAN-V0-10X1.5-BL-50", "PAN-V0 Ø10mm blå polyamidslang 50m", "tubing", { tube_od_mm: 10 }),
    p("FE-PUN-H-6X1-BL", "PUN-H-6x1 blå polyuretanslang", "tubing", { tube_od_mm: 6 }),
    p("FE-MS4-LF-14-CRG", "MS4 Filter G1/4", "frl", {}),
  ];
  const hz = detectHazards("Skjuta lådor 10 kg 200 mm i sidled", {}, "sv");
  const ctx = {
    ...hz, primarySku: "TEST-PRIMARY", kravTempC: 0, kravTempMinC: NaN, primarySpecs: {}, primaryIsFamilyProd: false,
    isElectric: false, locale: "sv", products, primaryBoreMm: 32, primaryBrand: "festo", unitCount: 1,
  } as unknown as BomCtx;
  const rows = buildMandatoryBomRows(ctx);
  const sku = (kind: string) => rows.find((r) => r.kind === kind)?.sku;
  assertEquals(sku("valve"), "FE-MFH-5-1-8");
  assertEquals(sku("silencer"), "FESTO-2307");
  assertEquals(sku("fitting"), "FE-QS-G18-6");
  assertEquals(sku("flow_control"), "FE-GRLA-18-QS-6-D");
  assertEquals(sku("tubing"), "FE-PUN-H-6X1-BL");
});

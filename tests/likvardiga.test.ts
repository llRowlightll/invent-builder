/// <reference lib="deno.ns" />
// Körs med: deno test tests/likvardiga.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { borrEtikett, borrningar, cylindergrupp, likvardigaCylindrar } from "../src/lib/likvardiga.ts";
import type { ProductRow } from "../src/lib/types.ts";

function p(sku: string, brand: string, name: string, specs: Record<string, string>, extra: Partial<ProductRow> = {}): ProductRow {
  return {
    id: sku, sku, name, name_en: null, description: null, family: null,
    brand: { slug: brand, name: brand }, category: { slug: "cylinder", name: "Cylinder" },
    lead_time_days: null, availability: null, weight_kg: null, ip_rating: null, fieldbus: null,
    voltage: null, image_url: null, length_mm: null, width_mm: null, height_mm: null,
    specs: Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, { value: v, unit: null }])),
    ...extra,
  };
}

// Verkliga rader ur katalogen (2026-11-11), förkortade.
const DSNU8 = p("FESTO-193986", "festo", "ISO cylinder", { bore_mm: "8", standard: "ISO 6432", stroke_mm: "100 mm" });
const MW8 = p("MW-C6432-8", "metal-work", "Metal Work ISO 6432 Mini-Cylinder Ø8", { bore_mm: "8", standard: "ISO 6432" });
const MWFAM = p("MW-ISO6432", "metal-work", "Metal Work ISO 6432 Mini-Cylinder", { bore_mm: "8–25 (STD); 16–25 (TP twin-rod)", standard: "ISO 6432" });
const C85 = p("SMC-C85", "smc", "C85 – Round Cylinder ISO 6432", { bore_mm: "8,10,12,16,20,25", standard: "ISO 6432" });
const MXS8 = p("SMC-MXS8", "smc", "SMC MXS Slide Table Ø8", { bore_mm: "8", stroke_mm: "75 mm" });
const CJ2 = p("SMC-CJ2", "smc", "CJ2 – Mini Cylinder", { bore_mm: "10,16" });
const DGC = p("FESTO-DGC", "festo", "DGC – Rodless Linear Drive", { bore_mm: "8–80" });
const RTC = p("AV-RTC", "aventics", "RTC-HD 25", { bore_mm: "25", cylinder_type: "Rodless cylinder, ball rail guide" });
const MGPL = p("SMC-MGPL", "smc", "MGPL – Long Stroke Guided Slide Table", { bore_mm: "12–100" });
const S11 = p("MW-S11-12", "metal-work", "Metal Work Linear Slide S11-12", { bore_mm: "12" });
const S10 = p("MW-S10-12", "metal-work", "Metal Work Twin Cylinder S10-12", { bore_mm: "12" });
const GRUND = p("X-1", "x", "Cylinder", { bore_mm: "20" }, { description: "Cylinder i grundutförande. Mycket kompakt." });

Deno.test("grupp ur standard, cylindertyp och namn -- i rätt ordning", () => {
  assertEquals(cylindergrupp(DSNU8)?.grupp, "rund");
  assertEquals(cylindergrupp(DSNU8)?.standard, "ISO 6432");
  assertEquals(cylindergrupp(MXS8)?.grupp, "slid");
  assertEquals(cylindergrupp(CJ2)?.grupp, "rund");
  assertEquals(cylindergrupp(DGC)?.grupp, "stanglos");
  assertEquals(cylindergrupp(RTC)?.grupp, "stanglos"); // inte "styrd" trots "guide"
  assertEquals(cylindergrupp(MGPL)?.grupp, "styrd"); // inte "slid" trots "Slide Table"
  assertEquals(cylindergrupp(S11)?.grupp, "slid");
  assertEquals(cylindergrupp(S10)?.grupp, "dubbel");
  // "grundutförande" är inte "rund", och "mycket kompakt" i andra meningen räknas inte.
  assertEquals(cylindergrupp(GRUND), null);
});

Deno.test("borrningar: enstaka, listor och intervall", () => {
  assertEquals(borrningar("8"), { enstaka: [8], intervall: [] });
  assertEquals(borrningar("8,10,12,16,20,25").enstaka, [8, 10, 12, 16, 20, 25]);
  assertEquals(borrningar("8–25 (STD); 16–25 (TP twin-rod)").intervall, [[8, 25], [16, 25]]);
  assertEquals(borrningar("ø32–125").intervall, [[32, 125]]);
  assertEquals(borrningar(""), { enstaka: [], intervall: [] });
});

Deno.test("DSNU Ø8: slidbordet är inte likvärdigt, ISO 6432 i andra fabrikat är det", () => {
  const ut = likvardigaCylindrar(DSNU8, [DSNU8, MW8, MWFAM, C85, MXS8, CJ2, DGC])!;
  const skus = ut.map((x) => x.p.sku);
  assertEquals(skus.includes("SMC-MXS8"), false);
  assertEquals(skus.includes("FESTO-DGC"), false); // samma fabrikat och annan typ
  assertEquals(skus[0], "MW-C6432-8"); // exakt samma borrning först
  assertEquals(ut[0].etikett.sv, "Samma standard (ISO 6432), samma borrning Ø8");
  assertEquals(ut.find((x) => x.p.sku === "SMC-C85")!.etikett.sv, "Samma standard (ISO 6432), finns i Ø8");
  // CJ2 är en rundcylinder men saknar Ø8 -- utesluten, inte "närliggande".
  assertEquals(skus.includes("SMC-CJ2"), false);
});

Deno.test("annan standard eller ingen: typen nämns, standarden inte", () => {
  const rund10 = p("CAM-24-10", "camozzi", "Serie 24 Round Cylinder", { bore_mm: "10" });
  const ut = likvardigaCylindrar(rund10, [rund10, CJ2, C85])!;
  assertEquals(ut.find((x) => x.p.sku === "SMC-CJ2")!.etikett.sv, "Rundcylinder, finns i Ø10");
});

Deno.test("högst två per fabrikat", () => {
  const smc = [1, 2, 3].map((i) => p(`SMC-R${i}`, "smc", "Round Cylinder", { bore_mm: "8", standard: "ISO 6432" }));
  const ut = likvardigaCylindrar(DSNU8, [DSNU8, ...smc])!;
  assertEquals(ut.length, 2);
});

Deno.test("inte en cylinder, eller okänd typ: null så att sidan inte påstår något", () => {
  assertEquals(likvardigaCylindrar(GRUND, [GRUND, DSNU8]), null);
  const gripdon = { ...DSNU8, category: { slug: "gripper", name: "Gripdon" } };
  assertEquals(likvardigaCylindrar(gripdon, [gripdon, MW8]), null);
});

Deno.test("borrEtikett säger 'samma' bara när den är lika", () => {
  const a = p("A", "a", "Gripper", { bore_mm: "16" });
  assertEquals(borrEtikett(a, p("B", "b", "Gripper", { bore_mm: "16" }), true), "Samma borrning Ø16");
  assertEquals(borrEtikett(a, p("C", "c", "Gripper", { bore_mm: "12,16,20" }), true), "Finns i Ø16");
  assertEquals(borrEtikett(a, p("D", "d", "Gripper", { bore_mm: "17" }), true), "Närliggande storlek Ø17 — jämför");
});

Deno.test("en rad per familj -- slagvarianter av samma serie visas inte två gånger", () => {
  const kpz = [5, 10, 25].map((s) => p(`KPZ-16-${s}`, "aventics", `AVENTICS KPZ Ø16 kompaktcylinder, ${s} mm slag`, { bore_mm: "16" }, { family: "KPZ" }));
  const cq2 = p("SMC-CQ2", "smc", "CQ2 – Kompaktcylinder", { bore_mm: "12,16,20,25" }, { family: "CQ2" });
  const ut = likvardigaCylindrar(cq2, [cq2, ...kpz])!;
  assertEquals(ut.length, 1);
});

/**
 * CQ2-modellen mot katalogen.
 *
 * Facit: katalogens egna exempelkoder (sida 11, 13, 65 och genomgående i
 * dimensionstabellerna), specifikationstabellerna (sida 12 och 66) avskrivna
 * här igen, och kraften kontrollerad mot kolvarean -- teoretisk kraft är
 * area × tryck, så tabellen på sida 15 måste stämma med π·r²·0,5 MPa.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  CQ2_BORES,
  CQ2_MTO,
  CQ2_ORDER_CODE_TEMPLATE,
  CQ2_SOURCE,
  CQ2_SWITCHES,
  type Cq2Config,
  cq2BuildCode,
  cq2ParseCode,
  cq2StrokeOk,
} from "../../../src/lib/catalog/cq2.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(CQ2_SOURCE.file, "smc-kat-cq2.pdf");
  assertEquals(CQ2_BORES.map((b) => b.bore_mm), [12, 16, 20, 25, 32, 40, 50, 63, 80, 100]);
  const koder = CQ2_SWITCHES.map((s) => s.code);
  assertEquals(new Set(koder).size, koder.length);
  assertEquals(new Set(CQ2_MTO.map((m) => m.code)).size, CQ2_MTO.length);
});

// ── katalogens egna koder ──────────────────────────────────────────────────
Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[Cq2Config, string]> = [
    // Nyckelns tre rader (sida 11)
    [{ bore: "20", action: "D", stroke_mm: 30, mounting: "B" }, "CQ2B20-30D"],
    [{ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true }, "CQ2B32-30DZ"],
    [{ bore: "32", action: "D", stroke_mm: 30, mounting: "B", magnet: true, groove: true, body: "M", bolt: true, bracket: "W", switch: "M9BW" }, "CDQ2B32-30DMZ-LW-M9BW"],
    // Magnet utan givare (sida 11): "there is no need to enter the symbol for the auto switch"
    [{ bore: "32", action: "D", stroke_mm: 25, mounting: "L", magnet: true, groove: true }, "CDQ2L32-25DZ"],
    // Mellanslag med distans (sida 13)
    [{ bore: "32", action: "D", stroke_mm: 57, mounting: "B", groove: true }, "CQ2B32-57DZ"],
    [{ bore: "32", action: "D", stroke_mm: 57, mounting: "B", groove: true, mto: "XB10A" }, "CQ2B32-57DZ-XB10A"],
    // Enkelverkande (sida 65-66)
    [{ bore: "20", action: "T", stroke_mm: 5, mounting: "B" }, "CQ2B20-5T"],
    [{ bore: "32", action: "S", stroke_mm: 10, mounting: "L", magnet: true, groove: true }, "CDQ2L32-10SZ"],
    [{ bore: "12", action: "S", stroke_mm: 5, mounting: "B", magnet: true, groove: true }, "CDQ2B12-5SZ"],
    [{ bore: "50", action: "T", stroke_mm: 10, mounting: "B", magnet: true, groove: true }, "CDQ2B50-10TZ"],
    // Kombinerade kroppsoptioner (sida 15, viktexempel)
    [{ bore: "32", action: "D", stroke_mm: 20, mounting: "B", magnet: true, groove: true, body: "CM" }, "CDQ2B32-20DCMZ"],
    // Kabellängd och antal
    [{ bore: "32", action: "D", stroke_mm: 30, mounting: "B", magnet: true, groove: true, switch: "M9BW", lead: "L", count: "S" }, "CDQ2B32-30DZ-M9BWLS"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(cq2BuildCode(c), kod);
    const r = cq2ParseCode(kod);
    assert(r, `${kod} lästes inte`);
    assertEquals(cq2BuildCode(r.config), kod);
  }
});

Deno.test("mallen i databasen och modellen bygger samma kod", () => {
  const val = (c: Cq2Config): Record<string, string | number> => ({
    magnet: c.magnet ? "D" : "", mounting: c.mounting ?? "B", air_hydro: c.air_hydro ? "H" : "", bore: c.bore, port: c.port ?? "",
    stroke_mm: c.stroke_mm, action: c.action, body: c.body ?? "", groove: c.groove ? "Z" : "", bolt: c.bolt ? "L" : "",
    bracket: c.bracket ?? "", switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  });
  const kravda = new Set(["bore", "action", "stroke_mm", "mounting"]);
  const prov: Cq2Config[] = [];
  for (const b of CQ2_BORES) {
    const z = b.bore_mm >= 32;
    prov.push({ bore: b.code, action: "D", stroke_mm: b.da_stroke_max_mm, mounting: "B", groove: z });
    prov.push({ bore: b.code, action: "D", stroke_mm: 5, mounting: "D", magnet: true, groove: true, switch: "M9NV", lead: "Z", count: "S", mto: "XC6" });
    prov.push({ bore: b.code, action: "D", stroke_mm: 10, mounting: "B", groove: z, bolt: true, body: "FM", bracket: "V" });
    if (b.air_hydro) prov.push({ bore: b.code, action: "D", stroke_mm: 10, mounting: "F", air_hydro: true, groove: z, port: z ? "TN" : undefined });
    if (b.sa_standard_strokes) prov.push({ bore: b.code, action: "S", stroke_mm: b.sa_standard_strokes[0], mounting: "G", groove: z, body: "F" });
  }
  for (const c of prov) {
    const kod = cq2BuildCode(c);
    assert(kod, JSON.stringify(c));
    const mall = fillOrderCodeTemplate(CQ2_ORDER_CODE_TEMPLATE, val(c), kravda);
    assertEquals(mall, kod, JSON.stringify(c));
    assertEquals(cq2ParseCode(kod)?.config.stroke_mm, c.stroke_mm);
  }
});

// ── facit: specifikationerna ───────────────────────────────────────────────
Deno.test("kraften på sida 15 är kolvarean gånger trycket", () => {
  // Teoretisk kraft plus-sidan vid 0,5 MPa = π·(d/2)²·0,5, avrundad som SMC gör.
  for (const b of CQ2_BORES) {
    const berakn = Math.PI * (b.bore_mm / 2) ** 2 * 0.5;
    assert(Math.abs(berakn - b.force_out_n_05mpa) / berakn < 0.01, `ø${b.bore_mm}: ${berakn.toFixed(0)} vs ${b.force_out_n_05mpa}`);
  }
});

Deno.test("standardslagen och gränserna följer sida 12 och 66", () => {
  const std = (k: string) => CQ2_BORES.find((b) => b.code === k)!.da_standard_strokes;
  assertEquals(std("12"), [5, 10, 15, 20, 25, 30]);
  assertEquals(std("25"), [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  assertEquals(std("40"), [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 75, 100]);
  assertEquals(std("100"), [10, 15, 20, 25, 30, 35, 40, 45, 50, 75, 100]);
  const b32 = CQ2_BORES.find((b) => b.code === "32")!;
  const b50 = CQ2_BORES.find((b) => b.code === "50")!;
  const b12 = CQ2_BORES.find((b) => b.code === "12")!;
  // Dubbelverkande pneumatik: mellanslag i 1 mm-steg upp till 99 (sida 13), plus 100.
  assert(cq2StrokeOk(b32, "D", false, 57));
  assert(cq2StrokeOk(b32, "D", false, 1));
  assert(cq2StrokeOk(b32, "D", false, 100));
  assert(!cq2StrokeOk(b32, "D", false, 101));
  assert(!cq2StrokeOk(b12, "D", false, 31));
  // Luft-hydraulik: bara standardslag.
  assert(cq2StrokeOk(b32, "D", true, 75));
  assert(!cq2StrokeOk(b32, "D", true, 57));
  assert(!cq2StrokeOk(b12, "D", true, 5), "ø12 finns inte som luft-hydraulik");
  // Fjäderretur: bara 5/10 (ø12–40) och 10/20 (ø50); fjäderutskjut även 1–9 / 1–19.
  assert(cq2StrokeOk(b32, "S", false, 10));
  assert(!cq2StrokeOk(b32, "S", false, 7));
  assert(cq2StrokeOk(b32, "T", false, 7));
  assert(!cq2StrokeOk(b32, "T", false, 15));
  assert(cq2StrokeOk(b50, "T", false, 19));
  assert(cq2StrokeOk(b50, "S", false, 20));
  assert(!cq2StrokeOk(b50, "S", false, 5));
  assertEquals(cq2StrokeOk(CQ2_BORES.find((b) => b.code === "63")!, "S", false, 10), false, "enkelverkande slutar vid ø50");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = cq2BuildCode;
  // Z: tvingande ø32–100 och med magnet; förbjudet ø12–25 utan magnet.
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "B" }), null);
  assertEquals(b({ bore: "12", action: "D", stroke_mm: 30, mounting: "B", groove: true }), null);
  assertEquals(b({ bore: "12", action: "D", stroke_mm: 5, mounting: "B", magnet: true }), null);
  // Givare kräver magnet; P3DW bara ø32–100 och inte enkelverkande.
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true, switch: "M9BW" }), null);
  assertEquals(b({ bore: "25", action: "D", stroke_mm: 30, mounting: "B", magnet: true, groove: true, switch: "P3DW" }), null);
  assertEquals(b({ bore: "32", action: "S", stroke_mm: 10, mounting: "B", magnet: true, groove: true, switch: "P3DW" }), null);
  assert(b({ bore: "32", action: "D", stroke_mm: 10, mounting: "B", magnet: true, groove: true, switch: "P3DW" }));
  // Kabel/antal utan givare; 1 m bara för A93 bland reed.
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true, lead: "L" }), null);
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", magnet: true, groove: true, switch: "A96", lead: "M" }), null);
  assert(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", magnet: true, groove: true, switch: "A93", lead: "M" }));
  // Gängtyp och kroppsoption
  assertEquals(b({ bore: "20", action: "D", stroke_mm: 30, mounting: "B", port: "TN" }), null);
  assertEquals(b({ bore: "80", action: "D", stroke_mm: 30, mounting: "B", groove: true, port: "F" }), null);
  assertEquals(b({ bore: "63", action: "S", stroke_mm: 10, mounting: "B", groove: true, port: "F" }), null, "enkelverkande finns inte i ø63");
  assertEquals(b({ bore: "50", action: "S", stroke_mm: 10, mounting: "B", groove: true, port: "F" }), "CQ2B50F-10SZ");
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true, air_hydro: true, port: "TF" }), null);
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true, air_hydro: true, body: "C" }), null);
  assertEquals(b({ bore: "32", action: "S", stroke_mm: 10, mounting: "B", groove: true, body: "FC" }), null);
  assertEquals(b({ bore: "16", action: "D", stroke_mm: 10, mounting: "B", air_hydro: true }), null);
  // Fästbultar bara med B; knäled kräver M; ledfäste kräver invändig gänga.
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "L", groove: true, bolt: true }), null);
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true, bracket: "W" }), null);
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true, body: "M", bracket: "D" }), null);
  // Specialutföranden
  assertEquals(b({ bore: "12", action: "D", stroke_mm: 10, mounting: "B", mto: "XC4" }), null);
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 10, mounting: "B", magnet: true, groove: true, switch: "M9B", mto: "XB6" }), null);
  assertEquals(b({ bore: "20", action: "D", stroke_mm: 10, mounting: "B", mto: "X144" }), null, "X144 kräver givare");
  assertEquals(b({ bore: "32", action: "D", stroke_mm: 10, mounting: "B", groove: true, mto: "XB11" }), null, "XB11 bara luft-hydraulik");
  assertEquals(b({ bore: "32", action: "T", stroke_mm: 5, mounting: "B", groove: true, mto: "XA" }), null, "XA bara fjäderretur");
  assert(b({ bore: "32", action: "S", stroke_mm: 5, mounting: "B", groove: true, mto: "XA" }));
  assertEquals(b({ bore: "32", action: "S", stroke_mm: 5, mounting: "B", groove: true, mto: "XC92" }), null, "XC92 står bara i DA-nyckeln");
});

Deno.test("parse är spegeln och avvisar främmande former", () => {
  for (const k of ["CQ2B12-30DZ", "CDQ2B12-5D", "CQ2B32-30D", "CQ2B20-30D-W", "CDQ2B32-30DZ-A96M", "CQ2WB50-75DZ", "CQ2KB40-5DZ", "CDQ2B125-30DCZ", ""]) {
    assertEquals(cq2ParseCode(k), null, k);
  }
  assertEquals(cq2ParseCode("cdq2b32-30dmz-lw-m9bw")?.config.switch, "M9BW");
});

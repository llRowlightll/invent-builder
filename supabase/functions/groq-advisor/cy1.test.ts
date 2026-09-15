/**
 * CY1-modellen (CY1S, CY1L, CY1H, CY1F) och dess regler mot katalogerna.
 *
 * Facit: nycklarnas CY1S25-300Z-M9BW (sida 1214), CY1L25H-300-J79W
 * (sida 1230), CY1H25-300-Y7BW (sida 1242) och CY1F10R-300-M9BW (sida 1265);
 * viktexemplen CY1SG25-500Z (sida 1215) och CY1L32H-500 (sida 1231);
 * standardslag och maxslag per borrning (sida 1215, 1231, 1243, 1266);
 * givartabellernas ●/○/— och minsta slag (sida 1220, 1234, 1249, 1270);
 * specialutförandenas borrningar (sida 1221, 1252, 1266).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildCy1DbRules } from "../../../src/lib/catalog/cy1-db-rules.ts";
import {
  CY1_COUNTS,
  CY1_SERIES,
  CY1_SERIES_LIST,
  type CY1Config,
  type CY1Series,
  cy1BuildCode,
  cy1ParseCode,
  cy1Strokes,
} from "../../../src/lib/catalog/cy1.ts";

Deno.test("modellen bär sina källor", () => {
  assertEquals(CY1_SERIES.cy1s.source.file, "smc-kat-cy1s.pdf");
  assertEquals(CY1_SERIES.cy1l.source.file, "smc-kat-cy1.pdf");
  assertEquals(CY1_SERIES.cy1h.source.file, "smc-kat-cy1.pdf");
  assertEquals(CY1_SERIES.cy1f.source.file, "smc-kat-cy1f.pdf");
  assertEquals(CY1_SERIES.cy1s.bores.map((b) => b.bore_mm), [6, 10, 15, 20, 25, 32, 40]);
  assertEquals(CY1_SERIES.cy1h.bores.map((b) => b.bore_mm), [10, 15, 20, 25, 32]);
  assertEquals(CY1_SERIES.cy1f.bores.map((b) => b.bore_mm), [10, 15, 25]);
  // hållkrafterna (sida 1215, 1231, 1243, 1266)
  assertEquals(CY1_SERIES.cy1s.bores.map((b) => b.holding_n), [19.6, 53.9, 137, 231, 363, 588, 922]);
  assertEquals(CY1_SERIES.cy1l.bores.map((b) => b.holding_l_n), [0, 0, 81.4, 154, 221, 358, 569]);
  assertEquals(CY1_SERIES.cy1h.bores.map((b) => b.holding_n), [53.9, 137, 231, 363, 588]);
  assertEquals(CY1_SERIES.cy1f.bores.map((b) => b.holding_n), [53.9, 137, 363]);
});

Deno.test("standardslag och maxslag följer tabellerna", () => {
  const b = (s: CY1Series, k: string) => CY1_SERIES[s].bores.find((x) => x.code === k)!;
  assertEquals(cy1Strokes("cy1s", b("cy1s", "6")), { standard: [50, 100, 150, 200], max_mm: 300 });
  assertEquals(cy1Strokes("cy1s", b("cy1s", "40")), { standard: [100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000], max_mm: 1500 });
  assertEquals(cy1Strokes("cy1l", b("cy1l", "20")), { standard: [100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800], max_mm: 1000 });
  assertEquals(cy1Strokes("cy1h", b("cy1h", "10")), { standard: [100, 200, 300], max_mm: 500 });
  assertEquals(cy1Strokes("cy1h", b("cy1h", "25")), { standard: [100, 200, 300, 400, 500, 600, 800], max_mm: 1200 });
  assertEquals(cy1Strokes("cy1h", b("cy1h", "25"), "T"), { standard: [100, 200, 300, 400, 500, 600, 800, 1000], max_mm: 1500 });
  assertEquals(cy1Strokes("cy1h", b("cy1h", "32")), null, "ø32 bara tvåaxlig");
  assertEquals(cy1Strokes("cy1h", b("cy1h", "10"), "T"), null, "ø10 bara enaxlig");
  assertEquals(cy1Strokes("cy1f", b("cy1f", "25")), { standard: [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600], max_mm: 1200 });
});

Deno.test("katalogernas exempel byggs tecken för tecken", () => {
  const fall: Array<[CY1Series, CY1Config, string]> = [
    ["cy1s", { bore: "25", stroke_mm: 300, switch: "M9BW" }, "CY1S25-300Z-M9BW"],
    ["cy1s", { bore: "25", stroke_mm: 500, piping: "G" }, "CY1SG25-500Z"],
    ["cy1s", { bore: "40", stroke_mm: 1000, port: "TF", adjust: "BS", switch: "M9NAV", lead: "L", count: "S", mto: "X2423" }, "CY1S40TF-1000BSZ-M9NAVLS-X2423"],
    ["cy1s", { bore: "6", stroke_mm: 20, switch: "A93", mto: "X431" }, "CY1S6-20Z-A93-X431"],
    ["cy1l", { bore: "25", stroke_mm: 300, holding: "H", switch: "J79W" }, "CY1L25H-300-J79W"],
    ["cy1l", { bore: "32", stroke_mm: 500, holding: "H" }, "CY1L32H-500"],
    ["cy1l", { bore: "15", stroke_mm: 250, holding: "L", adjust: "B", switch: "A73C", lead: "N", count: "3", mto: "XB22" }, "CY1L15L-250B-A73CN3-XB22"],
    ["cy1h", { bore: "25", stroke_mm: 300, switch: "Y7BW" }, "CY1H25-300-Y7BW"],
    ["cy1h", { bore: "32", stroke_mm: 1000, guide: "T", port: "TN", adjust: "B", switch: "Z73", lead: "Z", count: "S" }, "CY1HT32TN-1000B-Z73ZS"],
    ["cy1h", { bore: "25", stroke_mm: 350, mto: "XB10" }, "CY1H25-350-XB10"],
    ["cy1h", { bore: "25", stroke_mm: 900, mto: "XB11" }, "CY1H25-900-XB11"],
    ["cy1h", { bore: "25", stroke_mm: 900, guide: "T", mto: "XB10" }, "CY1HT25-900-XB10"],
    ["cy1f", { bore: "10", stroke_mm: 300, dir: "R", switch: "M9BW" }, "CY1F10R-300-M9BW"],
    ["cy1f", { bore: "25", stroke_mm: 275, dir: "L", port: "TN", adjust: "AL", switch: "A93V", lead: "L", count: "S", mto: "XB10" }, "CY1F25TNL-275AL-A93VLS-XB10"],
    ["cy1f", { bore: "15", stroke_mm: 700, dir: "R", adjust: "A", mto: "XB11" }, "CY1F15R-700A-XB11"],
  ];
  for (const [s, c, kod] of fall) {
    assertEquals(cy1BuildCode(s, c), kod);
    const p = cy1ParseCode(kod);
    assert(p, kod);
    assertEquals(p.series, s);
    assertEquals(cy1BuildCode(p.series, p.config), kod);
  }
  assertEquals(cy1ParseCode("CY1S25-300-M9BW"), null, "CY1S har alltid Z");
  assertEquals(cy1ParseCode("CY1L25-300-J79W"), null, "CY1L kräver hållkraftens bokstav");
  assertEquals(cy1ParseCode("CY1F10-300-M9BW"), null, "CY1F kräver anslutningssidan");
  assertEquals(cy1ParseCode("CY1R25-300"), null, "CY1R finns inte");
});

Deno.test("modellen vägrar det katalogerna inte har", () => {
  const b = cy1BuildCode;
  assertEquals(b("cy1s", { bore: "6", stroke_mm: 100, port: "TN" }), null, "TN/TF ø20–40");
  assertEquals(b("cy1s", { bore: "25", stroke_mm: 1501 }), null, "max 1500");
  assertEquals(b("cy1s", { bore: "25", stroke_mm: 14 }), null, "min 15");
  assertEquals(b("cy1s", { bore: "25", stroke_mm: 20, switch: "M9BW" }), null, "två givare min 25");
  assert(b("cy1s", { bore: "25", stroke_mm: 20, switch: "M9BW", count: "S" }), "en givare min 15");
  assert(b("cy1s", { bore: "25", stroke_mm: 20, switch: "M9BW", mto: "X431" }), "två givare min 15 med -X431");
  assertEquals(b("cy1s", { bore: "25", stroke_mm: 300, piping: "G", mto: "X116" }), null, "-X116 bara dubbelsidig");
  assertEquals(b("cy1s", { bore: "20", stroke_mm: 300, mto: "X116" }), null, "-X116 ø25–40");
  assertEquals(b("cy1s", { bore: "6", stroke_mm: 100, mto: "X324" }), null, "-X324 ø10–40");
  assertEquals(b("cy1s", { bore: "25", stroke_mm: 300, switch: "M9BW", lead: "N" }), null, "N finns inte i M9-familjen");
  assertEquals(b("cy1l", { bore: "10", stroke_mm: 300, holding: "L" }), null, "L ø15–40");
  assertEquals(b("cy1l", { bore: "25", stroke_mm: 300 }), null, "hållkraft krävs");
  assertEquals(b("cy1l", { bore: "25", stroke_mm: 300, holding: "H", switch: "F79", lead: "N" }), null, "N bara kontaktgivare");
  assertEquals(b("cy1l", { bore: "25", stroke_mm: 300, holding: "H", switch: "F7BA" }), null, "F7BA saknar 0,5 m");
  assertEquals(b("cy1l", { bore: "25", stroke_mm: 300, holding: "H", switch: "A72H", lead: "Z" }), null, "A72H saknar 5 m");
  assertEquals(b("cy1l", { bore: "25", stroke_mm: 300, holding: "H", mto: "XB22" }), null, "-XB22 kräver B/BS");
  assertEquals(b("cy1l", { bore: "32", stroke_mm: 300, holding: "H", adjust: "B", mto: "XB22" }), null, "-XB22 ø6–25");
  assertEquals(b("cy1l", { bore: "25", stroke_mm: 40, holding: "H", switch: "J79W" }), null, "två givare min 50");
  assertEquals(b("cy1h", { bore: "32", stroke_mm: 300 }), null, "ø32 kräver T");
  assertEquals(b("cy1h", { bore: "10", stroke_mm: 300, guide: "T" }), null, "T ø25/32");
  assertEquals(b("cy1h", { bore: "25", stroke_mm: 350 }), null, "mellanslag kräver -XB10");
  assertEquals(b("cy1h", { bore: "25", stroke_mm: 300, mto: "XB10" }), null, "-XB10 inte på standardslag");
  assertEquals(b("cy1h", { bore: "25", stroke_mm: 900, mto: "XB10" }), null, "900 > 800 kräver -XB11");
  assertEquals(b("cy1h", { bore: "25", stroke_mm: 1000, guide: "T", mto: "XB11" }), null, "med T är 1000 standard");
  assertEquals(b("cy1h", { bore: "25", stroke_mm: 1201, mto: "XB11" }), null, "max 1200 enaxlig");
  assertEquals(b("cy1h", { bore: "32", stroke_mm: 500, guide: "T", adjust: "B", mto: "XB22" }), null, "-XB22 inte ø32");
  assertEquals(b("cy1h", { bore: "25", stroke_mm: 300, switch: "Y7BA" }), null, "Y7BA saknar 0,5 m");
  assertEquals(b("cy1f", { bore: "10", stroke_mm: 300 }), null, "anslutningssida krävs");
  assertEquals(b("cy1f", { bore: "10", stroke_mm: 300, dir: "R", port: "TN" }), null, "TN/TF bara ø25");
  assertEquals(b("cy1f", { bore: "10", stroke_mm: 15, dir: "R", switch: "A93", mto: "XB10" }), null, "två A93 min 20");
  assert(b("cy1f", { bore: "10", stroke_mm: 20, dir: "R", switch: "A93", mto: "XB10" }));
  assertEquals(b("cy1f", { bore: "10", stroke_mm: 8, dir: "R", switch: "M9BW", count: "S", mto: "XB10" }), null, "en M9W min 10");
  assert(b("cy1f", { bore: "10", stroke_mm: 8, dir: "R", switch: "M9B", count: "S", mto: "XB10" }), "en M9 min 5");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER: Record<CY1Series, ReturnType<typeof buildCy1DbRules>> = {
  cy1s: buildCy1DbRules("cy1s"), cy1l: buildCy1DbRules("cy1l"), cy1h: buildCy1DbRules("cy1h"), cy1f: buildCy1DbRules("cy1f"),
};
function ctx(c: CY1Config): Record<string, unknown> {
  return {
    bore: c.bore, stroke_mm: Number(c.stroke_mm || 0), piping: c.piping ?? "", holding: c.holding ?? "", guide: c.guide ?? "", dir: c.dir ?? "",
    port: c.port ?? "", adjust: c.adjust ?? "", switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  };
}
const kor = (s: CY1Series, c: CY1Config, niva: string) => REGLER[s].filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (s: CY1Series, c: CY1Config) => kor(s, c, "error");

function kontrollera(namn: string, s: CY1Series, prov: CY1Config[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = cy1BuildCode(s, c);
    const f = fel(s, c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst, `${namn}: ${prov.length}`);
}

/** Slag som prövar varje gräns: standardslag, grannar, maxslag och över. */
function provslag(s: CY1Series): number[] {
  const set = new Set<number>([1, 14, 15, 20, 24, 25, 49, 50]);
  for (const b of CY1_SERIES[s].bores) {
    for (const g of [b.one_axis === false ? "T" : "", "T"]) {
      const sl = cy1Strokes(s, b, g);
      if (!sl) continue;
      for (const x of sl.standard) { set.add(x); set.add(x + 1); }
      set.add(sl.max_mm); set.add(sl.max_mm + 1);
    }
  }
  return [...set].sort((a, b) => a - b);
}

Deno.test("CY1S: anslutning × borrning × gänga × slag × ändstopp × special", () => {
  const s = CY1_SERIES.cy1s;
  const prov: CY1Config[] = [];
  for (const b of s.bores) for (const piping of ["", "G"]) for (const port of ["", "TN"]) for (const adjust of ["", "B", "BS"])
    for (const mto of ["", ...s.mto.map((m) => m.code)]) for (const stroke_mm of provslag("cy1s"))
      prov.push({ bore: b.code, stroke_mm, piping: piping || undefined, port: port || undefined, adjust: adjust || undefined, mto: mto || undefined });
  kontrollera("S", "cy1s", prov, 20000);
});

Deno.test("CY1L: hållkraft × borrning × gänga × slag × justering × special", () => {
  const s = CY1_SERIES.cy1l;
  const prov: CY1Config[] = [];
  for (const b of s.bores) for (const holding of ["H", "L"]) for (const port of ["", "TF"]) for (const adjust of ["", "B", "BS"])
    for (const mto of ["", ...s.mto.map((m) => m.code)]) for (const stroke_mm of provslag("cy1l"))
      prov.push({ bore: b.code, stroke_mm, holding, port: port || undefined, adjust: adjust || undefined, mto: mto || undefined });
  kontrollera("L", "cy1l", prov, 20000);
});

Deno.test("CY1H: styrning × borrning × gänga × slag × justering × special", () => {
  const s = CY1_SERIES.cy1h;
  const prov: CY1Config[] = [];
  for (const b of s.bores) for (const guide of ["", "T"]) for (const port of ["", "TN"]) for (const adjust of ["", "B", "BS"])
    for (const mto of ["", ...s.mto.map((m) => m.code)]) for (const stroke_mm of provslag("cy1h"))
      prov.push({ bore: b.code, stroke_mm, guide: guide || undefined, port: port || undefined, adjust: adjust || undefined, mto: mto || undefined });
  kontrollera("H", "cy1h", prov, 5000);
});

Deno.test("CY1F: sida × borrning × gänga × slag × justerbult × special", () => {
  const s = CY1_SERIES.cy1f;
  const prov: CY1Config[] = [];
  for (const b of s.bores) for (const dir of ["R", "L"]) for (const port of ["", "TF"]) for (const adjust of ["", "AL", "AR", "A"])
    for (const mto of ["", ...s.mto.map((m) => m.code)]) for (const stroke_mm of provslag("cy1f"))
      prov.push({ bore: b.code, stroke_mm, dir, port: port || undefined, adjust: adjust || undefined, mto: mto || undefined });
  kontrollera("F", "cy1f", prov, 2000);
});

Deno.test("alla serier: givare × kabel × antal × slag", () => {
  for (const serie of CY1_SERIES_LIST) {
    const s = CY1_SERIES[serie];
    const prov: CY1Config[] = [];
    const bas: CY1Config = serie === "cy1l" ? { bore: "25", stroke_mm: 0, holding: "H" } : serie === "cy1f" ? { bore: "25", stroke_mm: 0, dir: "R" } : { bore: "25", stroke_mm: 0 };
    for (const sw of ["", ...s.switches.map((g) => g.code)]) for (const lead of ["", ...s.leads.map((l) => l.code)]) for (const count of ["", ...CY1_COUNTS.map((c) => c.code)])
      for (const stroke_mm of [5, 10, 12, 15, 20, 22, 25, 32, 35, 49, 50, 100]) {
        const standard = cy1Strokes(serie, s.bores.find((b) => b.code === "25")!)!.standard;
        const mto = s.stroke_policy === "xb" && !standard.includes(stroke_mm) ? "XB10" : undefined;
        prov.push({ ...bas, stroke_mm, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto });
      }
    kontrollera(serie, serie, prov, 1000);
  }
});

Deno.test("mallarna i databasen bygger samma kod", () => {
  const val = (c: CY1Config) => ({ ...ctx(c), stroke_mm: c.stroke_mm }) as Record<string, string | number>;
  const fall: Array<[CY1Series, CY1Config]> = [
    ["cy1s", { bore: "25", stroke_mm: 300, switch: "M9BW" }],
    ["cy1s", { bore: "40", stroke_mm: 1000, piping: "G", port: "TF", adjust: "BS", switch: "M9NAV", lead: "L", count: "S", mto: "X2423" }],
    ["cy1l", { bore: "25", stroke_mm: 300, holding: "H", switch: "J79W" }],
    ["cy1l", { bore: "15", stroke_mm: 250, holding: "L", adjust: "B", switch: "A73C", lead: "N", count: "3", mto: "XB22" }],
    ["cy1h", { bore: "25", stroke_mm: 300, switch: "Y7BW" }],
    ["cy1h", { bore: "32", stroke_mm: 1000, guide: "T", port: "TN", adjust: "B", switch: "Z73", lead: "Z", count: "S" }],
    ["cy1f", { bore: "10", stroke_mm: 300, dir: "R", switch: "M9BW" }],
    ["cy1f", { bore: "25", stroke_mm: 275, dir: "L", port: "TN", adjust: "AL", switch: "A93V", lead: "L", count: "S", mto: "XB10" }],
  ];
  const kravs: Record<CY1Series, Set<string>> = {
    cy1s: new Set(["bore", "stroke_mm"]), cy1l: new Set(["bore", "stroke_mm", "holding"]), cy1h: new Set(["bore", "stroke_mm"]), cy1f: new Set(["bore", "stroke_mm", "dir"]),
  };
  for (const [s, c] of fall) {
    assertEquals(fillOrderCodeTemplate(CY1_SERIES[s].template, val(c), kravs[s]), cy1BuildCode(s, c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel("cy1h", { bore: "25", stroke_mm: 350 });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("-XB10"), f[0]);
  const v = kor("cy1s", { bore: "25", stroke_mm: 275 }, "warn");
  assert(v.some((m) => m.includes("på beställning")), v.join(" | "));
  assertEquals(kor("cy1s", { bore: "25", stroke_mm: 300 }, "warn"), []);
  const v2 = kor("cy1s", { bore: "25", stroke_mm: 300, switch: "M9NA" }, "warn");
  assert(v2.some((m) => m.includes("0,5 m") && m.includes("M9NA")), v2.join(" | "));
  const v3 = kor("cy1f", { bore: "10", stroke_mm: 25, dir: "R", switch: "A93", mto: "XB10" }, "warn");
  assert(v3.some((m) => m.includes("monteringsmönster 3")), v3.join(" | "));
  assert(kor("cy1l", { bore: "25", stroke_mm: 300, holding: "H" }, "info").some((m) => m.includes("363 N") && m.includes("221 N")));
  assert(kor("cy1h", { bore: "25", stroke_mm: 300 }, "info").some((m) => m.includes("med T")));
  for (const s of CY1_SERIES_LIST) {
    const tom = { bore: "", stroke_mm: 0 } as CY1Config;
    assertEquals(fel(s, tom), [], s);
    assertEquals(kor(s, tom, "warn"), [], s);
    assertEquals(kor(s, tom, "info"), [], s);
    assertEquals(REGLER[s].filter((r) => r.message_sv === r.message_en).length, 0, s);
    const n = REGLER[s].map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
    assertEquals(n.filter((x, i) => n.indexOf(x) !== i), [], s);
    for (const r of REGLER[s]) assert(r.goto_step?.startsWith(`${s}-`), `${s}: ${r.goto_step}`);
  }
});

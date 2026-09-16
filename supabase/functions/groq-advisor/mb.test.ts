/**
 * MB-modellen och dess regler mot katalogen.
 *
 * Facit: beställexemplet MDBD32-50Z-NW-M9BW (sida 483), nyckelns MBB32-50Z
 * (sida 482), standardslag och slagområden (sida 483), givartabellens
 * ●/○/— (sida 482), minsta slag (sida 518–520), kombinationstabellen
 * (sida 480).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildMbDbRules } from "../../../src/lib/catalog/mb-db-rules.ts";
import {
  MB_BORES,
  MB_LEADS,
  MB_MOUNTINGS,
  MB_MTO,
  MB_ORDER_CODE_TEMPLATE,
  MB_SOURCE,
  MB_SWITCHES,
  type MBConfig,
  mbBuildCode,
  mbMinStroke,
  mbMtoMark,
  mbParseCode,
} from "../../../src/lib/catalog/mb.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(MB_SOURCE.file, "smc-kat-mb.pdf");
  assertEquals(MB_BORES.map((b) => b.bore_mm), [32, 40, 50, 63, 80, 100, 125]);
  assertEquals(MB_BORES.map((b) => [Math.max(...b.standard), b.range2_mm]), [[500, 1000], [500, 1000], [600, 1800], [600, 1800], [800, 1800], [800, 1800], [1000, 2000]]);
  const b = (k: string) => MB_BORES.find((x) => x.code === k)!;
  const g = (k: string) => MB_SWITCHES.find((x) => x.code === k)!;
  assertEquals(mbMinStroke(g("M9BW"), b("32"), false), [15, 15]);
  assertEquals(mbMinStroke(g("M9BW"), b("32"), true), [75, 75], "tappfäste sida 519");
  assertEquals(mbMinStroke(g("M9BW"), b("125"), true), [105, 105]);
  assertEquals(mbMinStroke(g("F59F"), b("32"), false), [10, 15]);
  assertEquals(mbMinStroke(g("F59F"), b("80"), false), [25, 25]);
  assertEquals(mbMinStroke(g("A33"), b("50"), false), [10, 35]);
  assertEquals(mbMinStroke(g("P4DW"), b("125"), false), [20, 20]);
  assertEquals(mbMtoMark(MB_MTO.find((x) => x.code === "XC6")!, b("32"), false), "-");
  assertEquals(mbMtoMark(MB_MTO.find((x) => x.code === "XC6")!, b("125"), true), "M");
  assertEquals(mbMtoMark(MB_MTO.find((x) => x.code === "XB5")!, b("32"), true), "S");
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[MBConfig, string]> = [
    [{ bore: "32", mounting: "D", stroke_mm: 50, magnet: true, pivot: "N", knuckle: "W", switch: "M9BW" }, "MDBD32-50Z-NW-M9BW"],
    [{ bore: "32", mounting: "B", stroke_mm: 50 }, "MBB32-50Z"],
    [{ bore: "63", mounting: "T", stroke_mm: 300, port: "TN", cushion: "N", boot: "J", pivot: "N" }, "MBT63TN-300NJZ-N"],
    [{ bore: "100", mounting: "L", stroke_mm: 800, magnet: true, knuckle: "V", switch: "A54", lead: "Z", count: "S", mto: "XC35" }, "MDBL100-800Z-V-A54ZS-XC35"],
    [{ bore: "125", mounting: "B", stroke_mm: 1000, mto: "XC6" }, "MBB125-1000Z-XC6"],
    [{ bore: "40", mounting: "C", stroke_mm: 275, magnet: true, switch: "A33" }, "MDBC40-275Z-A33"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(mbBuildCode(c), kod);
    assertEquals(mbBuildCode(mbParseCode(kod)!.config), kod, kod);
  }
  assertEquals(mbParseCode("MB-32-50-PPVA"), null, "den gamla mallen");
  assertEquals(mbParseCode("MBB32-50-M9BW"), null, "Z saknas och givare kräver magnet");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = mbBuildCode;
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 2701 }), null, "max 2700");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 2700 }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, switch: "M9BW" }), null, "givare kräver magnet");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, pivot: "N" }), null, "pivot bara D/T");
  assert(b({ bore: "32", mounting: "T", stroke_mm: 100, pivot: "N" }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "P4DW" }), null, "P4DW saknar 0,5 m");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "P4DW", lead: "L" }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "A33", lead: "L" }), null, "A33 utan kabel");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 30, magnet: true, switch: "A33" }), null, "två A33 min 35");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 30, magnet: true, switch: "A33", count: "S" }), "en A33 min 10");
  assertEquals(b({ bore: "32", mounting: "T", stroke_mm: 70, magnet: true, switch: "M9BW" }), null, "tappfäste min 75");
  assert(b({ bore: "32", mounting: "T", stroke_mm: 75, magnet: true, switch: "M9BW" }));
  assertEquals(b({ bore: "80", mounting: "B", stroke_mm: 20, magnet: true, switch: "F59F", count: "S" }), null, "F59F ø80 min 25");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, mto: "XC6" }), null, "XC6 bara ø125");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, mto: "XC26" }), null, "XC26 bara ø125");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 50, cushion: "N", mto: "XB5" }), "XB5 gummi är specialprodukt men går");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, mto: "XC8" }), null, "XC8 ingår inte");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildMbDbRules();
function ctx(c: MBConfig): Record<string, unknown> {
  return {
    bore: c.bore, mounting: c.mounting, stroke_mm: Number(c.stroke_mm || 0), magnet: c.magnet ? "D" : "", port: c.port ?? "", cushion: c.cushion ?? "", boot: c.boot ?? "",
    pivot: c.pivot ?? "", knuckle: c.knuckle ?? "", switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  };
}
const kor = (c: MBConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: MBConfig) => kor(c, "error");

function kontrollera(namn: string, prov: MBConfig[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = mbBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst, `${namn}: ${prov.length}`);
}

Deno.test("borrning × fäste × dämpning × bälg × pivot × slag × special", () => {
  const prov: MBConfig[] = [];
  const slag = [1, 25, 500, 501, 600, 601, 800, 801, 1000, 1001, 1800, 1801, 2000, 2001, 2700, 2701];
  for (const b of MB_BORES) for (const m of ["B", "D", "T"].map((k) => MB_MOUNTINGS.find((x) => x.code === k)!)) for (const cushion of ["", "N"]) for (const boot of ["", "K"]) for (const pivot of ["", "N"])
    for (const mto of ["", ...MB_MTO.map((x) => x.code)]) for (const stroke_mm of slag)
      prov.push({ bore: b.code, mounting: m.code, stroke_mm, cushion: cushion || undefined, boot: boot || undefined, pivot: pivot || undefined, mto: mto || undefined });
  kontrollera("A", prov, 40000);
});

Deno.test("magnet × givare × kabel × antal × fäste × borrning × slag", () => {
  const prov: MBConfig[] = [];
  const slag = [9, 10, 14, 15, 19, 20, 24, 25, 34, 35, 59, 60, 64, 65, 69, 70, 74, 75, 79, 80, 84, 85, 89, 90, 94, 95, 99, 100, 104, 105, 109, 110, 114, 115, 119, 120, 129, 130, 139, 140, 149, 150];
  for (const magnet of [false, true]) for (const sw of ["", ...MB_SWITCHES.map((s) => s.code)]) for (const lead of ["", "L"])
    for (const count of ["", "S"]) for (const mounting of ["B", "T"]) for (const b of MB_BORES) for (const stroke_mm of slag)
      prov.push({ bore: b.code, mounting, stroke_mm, magnet, switch: sw || undefined, lead: lead || undefined, count: count || undefined });
  // kabellängderna ●/○/— prövas separat med alla bokstäver
  for (const sw of MB_SWITCHES) for (const lead of ["", ...MB_LEADS.map((l) => l.code)])
    prov.push({ bore: "50", mounting: "B", stroke_mm: 200, magnet: true, switch: sw.code, lead: lead || undefined });
  kontrollera("B", prov, 50000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: MBConfig) => ({ ...ctx(c), stroke_mm: c.stroke_mm }) as Record<string, string | number>;
  for (const c of [
    { bore: "32", mounting: "D", stroke_mm: 50, magnet: true, pivot: "N", knuckle: "W", switch: "M9BW" },
    { bore: "32", mounting: "B", stroke_mm: 50 },
    { bore: "100", mounting: "L", stroke_mm: 800, magnet: true, knuckle: "V", switch: "A54", lead: "Z", count: "S", mto: "XC35" },
    { bore: "125", mounting: "B", stroke_mm: 1000, mto: "XC6" },
  ] as MBConfig[]) {
    assertEquals(fillOrderCodeTemplate(MB_ORDER_CODE_TEMPLATE, val(c), new Set(["bore", "mounting", "stroke_mm"])), mbBuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ bore: "32", mounting: "B", stroke_mm: 50, switch: "M9BW" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("MDB"), f[0]);
  const v = kor({ bore: "32", mounting: "B", stroke_mm: 1200 }, "warn");
  assert(v.some((m) => m.includes("rådgör med SMC")), v.join(" | "));
  const v2 = kor({ bore: "32", mounting: "B", stroke_mm: 50, cushion: "N", mto: "XB5" }, "warn");
  assert(v2.some((m) => m.includes("specialprodukt")), v2.join(" | "));
  const v3 = kor({ bore: "32", mounting: "B", stroke_mm: 60, magnet: true, switch: "A33" }, "warn");
  assert(v3.some((m) => m.includes("samma sida")), v3.join(" | "));
  assert(kor({ bore: "63", mounting: "B", stroke_mm: 100 }, "info").some((m) => m.includes("1559 N") && m.includes("Rc 1/4")));
  const tom = { bore: "", mounting: "", stroke_mm: 0 } as MBConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

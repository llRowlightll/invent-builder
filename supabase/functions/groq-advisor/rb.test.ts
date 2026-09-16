/**
 * RB-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel RBC1412 (sida 1299), RBLC1412 (sida 1306) och
 * RBQC2007 (sida 1310), datatabellerna på samma sidor, noten om RB0604 utan
 * kåpa (sida 1299), "optional specifications are not available for M6"
 * (sida 1295) och RB06S "—" (sida 1302), tillvalstabellen Nil/J/N/S/SJ/SN,
 * reservdelar och fotfästen (sida 1302, 1307, 1311).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildRbDbRules } from "../../../src/lib/catalog/rb-db-rules.ts";
import {
  RB_MODELS,
  RB_OPTIONS,
  RB_ORDER_CODE_TEMPLATE,
  RB_SERIES,
  RB_SIZES,
  RB_SOURCE,
  type RBConfig,
  rbBuildCode,
  rbModel,
  rbParseCode,
} from "../../../src/lib/catalog/rb.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(RB_SOURCE.file, "smc-kat-rb.pdf");
  assertEquals(RB_SERIES.map((s) => s.code), ["RB", "RBL", "RBQ"]);
  assertEquals(RB_SIZES.map((s) => s.code), ["0604", "0805", "0806", "1006", "1007", "1411", "1412", "1604", "2007", "2015", "2508", "2725", "3009", "3213"]);
  assertEquals(RB_MODELS.filter((x) => x.series === "RB").map((x) => x.energy_j), [0.5, 0.98, 2.94, 3.92, 5.88, 14.7, 19.6, 58.8, 147], "sida 1299");
  assertEquals(RB_MODELS.filter((x) => x.series === "RB").map((x) => x.freq_per_min), [80, 80, 80, 70, 70, 45, 45, 25, 10]);
  assertEquals(RB_MODELS.filter((x) => x.series === "RB").map((x) => x.thrust_n), [150, 245, 245, 422, 422, 814, 814, 1961, 2942]);
  assertEquals(RB_MODELS.filter((x) => x.series === "RBL").map((x) => x.spring_ret_n), [6.18, 6.86, 14.12, 14.61, 17.65, 38.05], "sida 1306");
  assertEquals(RB_MODELS.filter((x) => x.series === "RBQ").map((x) => x.energy_j), [1.96, 11.8, 19.6, 33.3, 49.0], "sida 1310");
  assertEquals(RB_MODELS.filter((x) => x.series === "RBQ").map((x) => x.stroke_mm), [4, 7, 8, 8.5, 13]);
  assertEquals(RB_MODELS.filter((x) => x.series === "RBQ").map((x) => x.stopper_part), ["RBQ16S", "RB20S", "RBQ25S", "RBQ30S", "RBQ32S"]);
  assertEquals(rbModel("RB", "2015")!.thread, "M20 x 1,5");
  assertEquals(rbModel("RB", "2015")!.stroke_mm, 15);
  assertEquals(rbModel("RB", "2725")!.foot_part, "RB27-X331", "sida 1302");
  assertEquals(rbModel("RB", "0604")!.c_ok, false);
  assertEquals(rbModel("RB", "0604")!.options_ok, false);
  assertEquals(rbModel("RB", "0604")!.foot_part, null);
  assertEquals(RB_OPTIONS.map((o) => o.code), ["J", "N", "S", "SJ", "SN"]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[RBConfig, string]> = [
    [{ series: "RB", size: "1412", type: "C" }, "RBC1412"],
    [{ series: "RBL", size: "1412", type: "C" }, "RBLC1412"],
    [{ series: "RBQ", size: "2007", type: "C" }, "RBQC2007"],
    [{ series: "RB", size: "0604" }, "RB0604"],
    [{ series: "RB", size: "0806" }, "RB0806"],
    [{ series: "RB", size: "2015" }, "RB2015"],
    [{ series: "RBQ", size: "1604", option: "SJ" }, "RBQ1604SJ"],
    [{ series: "RBL", size: "2725", type: "C", option: "SN" }, "RBLC2725SN"],
    [{ series: "RBQ", size: "3213", option: "N" }, "RBQ3213N"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(rbBuildCode(c), kod);
    assertEquals(rbBuildCode(rbParseCode(kod)!.config), kod, kod);
  }
  assertEquals(rbParseCode("RBQ0806W"), null, "den påhittade produktkoden");
  assertEquals(rbParseCode("RBQ2025W"), null);
  assertEquals(rbParseCode("RB1412-S"), null, "tillvalet skrivs utan bindestreck");
  assertEquals(rbParseCode("RBA1412"), null, "annan serie");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = rbBuildCode;
  assertEquals(b({ series: "RB", size: "0604", type: "C" }), null, "RB0604 utan kåpa, not sida 1299");
  assertEquals(b({ series: "RB", size: "0604", option: "J" }), null, "M6 utan tillval, sida 1295");
  assertEquals(b({ series: "RB", size: "0604", option: "S" }), null, "RB06S finns inte, sida 1302");
  assertEquals(b({ series: "RBL", size: "0805" }), null, "RBL börjar vid M10");
  assertEquals(b({ series: "RBL", size: "0604" }), null);
  assertEquals(b({ series: "RBQ", size: "1412" }), null, "RBQ har egna storlekar");
  assertEquals(b({ series: "RB", size: "1604" }), null);
  assertEquals(b({ series: "RB", size: "2007" }), null, "2007 är RBQ, 2015 är RB");
  assertEquals(b({ series: "RB", size: "1412", type: "K" }), null);
  assertEquals(b({ series: "RB", size: "1412", option: "JS" }), null, "SJ, inte JS");
  assertEquals(b({ series: "RBA", size: "1412" }), null);
  assert(b({ series: "RBQ", size: "2007", type: "C", option: "SJ" }));
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildRbDbRules();
function ctx(c: RBConfig): Record<string, unknown> {
  return { series: c.series, type: c.type ?? "", size: c.size, option: c.option ?? "" };
}
const kor = (c: RBConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: RBConfig) => kor(c, "error");

Deno.test("serie × typ × storlek × tillval, uttömmande", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const s of RB_SERIES) for (const type of ["", "C"]) for (const size of RB_SIZES) for (const option of ["", ...RB_OPTIONS.map((o) => o.code)]) {
    const c: RBConfig = { series: s.code, size: size.code, type: type || undefined, option: option || undefined };
    n++;
    const kod = rbBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assertEquals(n, 3 * 2 * 14 * 6);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { series: "RB", size: "1412", type: "C" },
    { series: "RBL", size: "1412", type: "C" },
    { series: "RBQ", size: "2007", type: "C" },
    { series: "RB", size: "0604" },
    { series: "RBQ", size: "1604", option: "SJ" },
  ] as RBConfig[]) {
    assertEquals(fillOrderCodeTemplate(RB_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["series", "size"])), rbBuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const f = fel({ series: "RB", size: "0604", type: "C" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("kåpa"), f[0]);
  const f2 = fel({ series: "RB", size: "0604", option: "SN" });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("M6"), f2[0]);
  const f3 = fel({ series: "RBQ", size: "1412" });
  assertEquals(f3.length, 1, f3.join(" | "));
  assert(f3[0].includes("1604, 2007, 2508, 3009 och 3213"), f3[0]);
  const i = kor({ series: "RB", size: "2015" }, "info");
  assert(i.some((m) => m.includes("58,8 J") && m.includes("RB20-X331") && m.includes("RB20S")), i.join(" | "));
  const i2 = kor({ series: "RBQ", size: "3213", type: "C", option: "SJ" }, "info");
  assert(i2.some((m) => m.includes("49 J") && m.includes("RBQ32S")), i2.join(" | "));
  assert(i2.some((m) => m.includes("excentricitet 5°")), i2.join(" | "));
  assert(i2.some((m) => m.includes("kan inte monteras på bastypen")), i2.join(" | "));
  assert(i2.some((m) => m.includes("3 sexkantmuttrar och en stoppmutter")), i2.join(" | "));
  assertEquals(kor({ series: "RB", size: "2015" }, "warn"), []);
  const tom = { series: "", size: "" } as RBConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

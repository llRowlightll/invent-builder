/**
 * CJ1-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel CJ1B4-5U4 (sida 16) och CJ1B4-10SU4 (sida 18),
 * serieöversikten "dubbelverkande ø4: 5, 10, 15, 20; enkelverkande ø2,5:
 * 5, 10; ø4: 5, 10, 15, 20" (sida 15), datatabellerna (kraft, fjäderkraft,
 * vikt) och måtten S/Z (sida 17 och 19).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildCj1DbRules } from "../../../src/lib/catalog/cj1-db-rules.ts";
import {
  CJ1_ACTIONS,
  CJ1_BORES,
  CJ1_MODELS,
  CJ1_ORDER_CODE_TEMPLATE,
  CJ1_SOURCE,
  CJ1_STROKES,
  type CJ1Config,
  cj1BuildCode,
  cj1Model,
  cj1ParseCode,
} from "../../../src/lib/catalog/cj1.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(CJ1_SOURCE.file, "smc-kat-cj1.pdf");
  assertEquals(CJ1_BORES.map((b) => [b.code, b.bore_mm, b.rod_mm]), [["2", 2.5, 1], ["4", 4, 2]], "sida 16 och 18");
  assertEquals(CJ1_STROKES.map((s) => s.code), ["5", "10", "15", "20"]);
  assertEquals(cj1Model("4", "")!.strokes, [5, 10, 15, 20], "sida 15");
  assertEquals(cj1Model("2", "S")!.strokes, [5, 10]);
  assertEquals(cj1Model("4", "S")!.strokes, [5, 10, 15, 20]);
  assertEquals(cj1Model("2", ""), undefined, "ø2,5 bara enkelverkande");
  assertEquals(cj1Model("4", "")!.weight_g, [12.0, 12.4, 12.8, 13.2], "sida 16");
  assertEquals(cj1Model("4", "")!.force_out_05_n, 6.30);
  assertEquals(cj1Model("4", "")!.force_in_05_n, 4.70);
  assertEquals(cj1Model("2", "S")!.spring_ret_n, 1.13, "sida 18");
  assertEquals(cj1Model("4", "S")!.spring_ret_n, 3.04);
  assertEquals(cj1Model("4", "S")!.force_out_05_n, 3.26);
  assertEquals(cj1Model("4", "S")!.weight_g, [3.7, 4.6, 5.6, 6.5]);
  assertEquals(cj1Model("4", "")!.dim_z_mm, [51, 56, 61, 66], "sida 17");
  assertEquals(cj1Model("2", "S")!.dim_s_mm, [16.5, 25.5], "sida 19");
  assertEquals(CJ1_ACTIONS.map((a) => [a.code, ...a.pressure_mpa]), [["", 0.2, 0.7], ["S", 0.3, 0.7]]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[CJ1Config, string]> = [
    [{ bore: "4", stroke: "5" }, "CJ1B4-5U4"],
    [{ bore: "4", stroke: "10", action: "S" }, "CJ1B4-10SU4"],
    [{ bore: "2", stroke: "10", action: "S" }, "CJ1B2-10SU4"],
    [{ bore: "2", stroke: "5", action: "S" }, "CJ1B2-5SU4"],
    [{ bore: "4", stroke: "20" }, "CJ1B4-20U4"],
    [{ bore: "4", stroke: "20", action: "S" }, "CJ1B4-20SU4"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(cj1BuildCode(c), kod);
    assertEquals(cj1BuildCode(cj1ParseCode(kod)!.config), kod, kod);
  }
  assertEquals(cj1ParseCode("CJ1B6-30U4"), null, "ø6 finns inte");
  assertEquals(cj1ParseCode("CJ1B2-10U4"), null, "ø2,5 bara enkelverkande");
  assertEquals(cj1ParseCode("CJ1B2-15SU4"), null);
  assertEquals(cj1ParseCode("CJ1B4-25U4"), null);
  assertEquals(cj1ParseCode("CJ1B4-10S"), null, "U4 hör till koden");
  assertEquals(cj1ParseCode("CJ1-4-20"), null, "den påhittade mallen");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = cj1BuildCode;
  assertEquals(b({ bore: "2", stroke: "5" }), null);
  assertEquals(b({ bore: "2", stroke: "15", action: "S" }), null);
  assertEquals(b({ bore: "4", stroke: "25" }), null);
  assertEquals(b({ bore: "6", stroke: "10" }), null);
  assertEquals(b({ bore: "4", stroke: "10", action: "D" }), null);
  assertEquals(b({ bore: "4", stroke: "", action: "S" }), null);
  assert(b({ bore: "4", stroke: "15", action: "S" }));
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildCj1DbRules();
function ctx(c: CJ1Config): Record<string, unknown> {
  return { bore: c.bore, action: c.action ?? "", stroke: c.stroke };
}
const kor = (c: CJ1Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: CJ1Config) => kor(c, "error");

Deno.test("borrning × funktion × slag, uttömmande", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const bore of CJ1_BORES) for (const action of ["", "S"]) for (const stroke of CJ1_STROKES) {
    const c: CJ1Config = { bore: bore.code, stroke: stroke.code, action: action || undefined };
    n++;
    const kod = cj1BuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade, [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm, [], `${falsklarm.length} falsklarm`);
  assertEquals(n, 2 * 2 * 4);
  assertEquals(CJ1_MODELS.reduce((a, x) => a + x.strokes.length, 0), 10);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { bore: "4", stroke: "5" },
    { bore: "4", stroke: "10", action: "S" },
    { bore: "2", stroke: "10", action: "S" },
    { bore: "4", stroke: "20" },
  ] as CJ1Config[]) {
    assertEquals(fillOrderCodeTemplate(CJ1_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["bore", "stroke"])), cj1BuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const f = fel({ bore: "2", stroke: "5" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("enkelverkande"), f[0]);
  const f2 = fel({ bore: "2", stroke: "20", action: "S" });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("5 och 10 mm"), f2[0]);
  const i = kor({ bore: "4", stroke: "20" }, "info");
  assert(i.some((m) => m.includes("CJ1B4-20U4") && m.includes("6,3 N ut") && m.includes("4,7 N in") && m.includes("13,2 g")), i.join(" | "));
  const i2 = kor({ bore: "2", stroke: "10", action: "S" }, "info");
  assert(i2.some((m) => m.includes("CJ1B2-10SU4") && m.includes("1,13 N indragen") && m.includes("Z 38 mm")), i2.join(" | "));
  assert(i2.some((m) => m.includes("TU0425")), i2.join(" | "));
  assertEquals(kor({ bore: "4", stroke: "20" }, "warn"), []);
  const tom = { bore: "", stroke: "" } as CJ1Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
  assertEquals(REGLER.length, 14);
});

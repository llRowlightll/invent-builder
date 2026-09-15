/**
 * CP96-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel CP96SB32-100CJW och CP96SDB32-100CJW-M9BWS
 * (sida 129); standardslag, portar och gränser (sida 130); dämpningskoden
 * mot borrningen (sida 129); givarnas minsta slag (sida 144); dubbel
 * kolvstång ≤ 1000 och rostfria maxslag (sida 154).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildCp96DbRules } from "../../../src/lib/catalog/cp96-db-rules.ts";
import {
  CP96_BOOTS,
  CP96_BORES,
  CP96_COUNTS,
  CP96_LEADS,
  CP96_MOUNTINGS,
  CP96_MTO,
  CP96_ORDER_CODE_TEMPLATE,
  CP96_SOURCE,
  CP96_SWITCHES,
  type CP96Config,
  cp96BuildCode,
  cp96MinStroke,
  cp96ParseCode,
} from "../../../src/lib/catalog/cp96.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(CP96_SOURCE.file, "smc-kat-cp96.pdf");
  assertEquals(CP96_BORES.map((b) => b.bore_mm), [32, 40, 50, 63, 80, 100, 125]);
  assertEquals(CP96_MOUNTINGS.map((m) => m.code), ["B", "L", "F", "G", "C", "D", "V"]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[CP96Config, string]> = [
    [{ bore: "32", mounting: "B", stroke_mm: 100, cushion: true, boot: "J", rod: "W" }, "CP96SB32-100CJW"],
    [{ bore: "32", mounting: "B", stroke_mm: 100, magnet: true, cushion: true, boot: "J", rod: "W", switch: "M9BW", count: "S" }, "CP96SDB32-100CJW-M9BWS"],
    [{ bore: "125", mounting: "L", stroke_mm: 300 }, "CP96SL125-300"],
    [{ bore: "63", mounting: "V", stroke_mm: 250, cushion: true }, "CP96SV63-250C"],
    [{ bore: "80", mounting: "D", stroke_mm: 500, magnet: true, cushion: true, boot: "KK", rod: "W", switch: "A93", lead: "Z", count: "3" }, "CP96SDD80-500CKKW-A93Z3"],
    [{ bore: "40", mounting: "F", stroke_mm: 1700, cushion: true, mto: "XC68" }, "CP96SF40-1700C-XC68"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(cp96BuildCode(c), kod);
    assertEquals(cp96BuildCode(cp96ParseCode(kod)!.config), kod);
  }
  assertEquals(cp96ParseCode("CP96SB32-100"), null, "ø32 skrivs med C");
  assertEquals(cp96ParseCode("CP96SB125-300C"), null, "ø125 skrivs utan C");
});

Deno.test("standardslag, portar och gränser följer sida 130", () => {
  const b = (k: string) => CP96_BORES.find((x) => x.code === k)!;
  assertEquals(b("32").standard_strokes, [25, 50, 80, 100, 125, 160, 200, 250, 320, 400, 500]);
  assertEquals(b("63").standard_strokes.slice(-1), [600]);
  assertEquals(b("100").standard_strokes.slice(-3), [600, 700, 800]);
  assertEquals(b("125").standard_strokes, []);
  assertEquals(CP96_BORES.map((x) => x.port), ["G1/8", "G1/4", "G1/4", "G3/8", "G3/8", "G1/2", "G1/2"]);
  assertEquals(CP96_BORES.map((x) => x.max_speed_mm_s), [1000, 1000, 1000, 1000, 1000, 1000, 700]);
});

Deno.test("givarnas minsta slag (sida 144)", () => {
  const g = (k: string) => CP96_SWITCHES.find((x) => x.code === k)!;
  assertEquals([cp96MinStroke(g("M9BW"), "32", ""), cp96MinStroke(g("M9BW"), "32", "S"), cp96MinStroke(g("M9BW"), "32", "3")], [10, 10, 50]);
  assertEquals([cp96MinStroke(g("M9NA"), "32", ""), cp96MinStroke(g("M9NA"), "40", ""), cp96MinStroke(g("M9NA"), "32", "3")], [15, 10, 55]);
  assertEquals(cp96MinStroke(g("A93"), "125", "3"), 50);
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = cp96BuildCode;
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 100 }), null, "ø32–100 skrivs med C");
  assertEquals(b({ bore: "125", mounting: "B", stroke_mm: 100, cushion: true }), null, "ø125 utan C");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 100, cushion: true, boot: "JJ" }), null, "JJ kräver W");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 100, cushion: true, boot: "JJ", rod: "W" }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 1200, cushion: true, rod: "W" }), null, "W max 1000");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 1200, cushion: true }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 2001, cushion: true }), null);
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 100, cushion: true, switch: "M9BW" }), null, "givare kräver magnet");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 100, cushion: true, lead: "L" }), null);
  assertEquals(b({ bore: "125", mounting: "B", stroke_mm: 100, mto: "XC4" }), null, "XC4 ø32–100");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 100, cushion: true, magnet: true, mto: "XB6" }), null, "XB6 utan magnet");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 1900, cushion: true, mto: "XC65" }), null, "XC65 ø32 max 1800");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 1800, cushion: true, mto: "XC65" }));
  assertEquals(b({ bore: "125", mounting: "B", stroke_mm: 1700, mto: "XC68" }), null, "XC68 ø125 max 1600");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 100, cushion: true, mto: "XC10" }), null, "dubbelslag ingår inte");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildCp96DbRules();
function ctx(c: CP96Config): Record<string, unknown> {
  return {
    bore: c.bore, mounting: c.mounting, stroke_mm: Number(c.stroke_mm || 0), magnet: c.magnet ? "D" : "", cushion: c.cushion ? "C" : "",
    boot: c.boot ?? "", rod: c.rod ?? "", switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  };
}
const kor = (c: CP96Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: CP96Config) => kor(c, "error");

function kontrollera(namn: string, prov: CP96Config[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = cp96BuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst);
}

Deno.test("borrning × fäste × dämpning × bälg × stång × slag", () => {
  const prov: CP96Config[] = [];
  for (const b of CP96_BORES) for (const m of CP96_MOUNTINGS) for (const cushion of [false, true]) for (const boot of ["", ...CP96_BOOTS.map((x) => x.code)])
    for (const rod of ["", "W"]) for (const stroke_mm of [50, 1000, 1001, 2000, 2001])
      prov.push({ bore: b.code, mounting: m.code, stroke_mm, cushion, boot: boot || undefined, rod: rod || undefined });
  kontrollera("A", prov, 4000);
});

Deno.test("magnet × givare × kabel × antal", () => {
  const prov: CP96Config[] = [];
  for (const b of ["32", "125"]) for (const magnet of [false, true]) for (const sw of ["", ...CP96_SWITCHES.map((s) => s.code)])
    for (const lead of ["", ...CP96_LEADS.map((l) => l.code)]) for (const count of ["", ...CP96_COUNTS.map((x) => x.code)])
      prov.push({ bore: b, mounting: "B", stroke_mm: 100, cushion: b !== "125", magnet, switch: sw || undefined, lead: lead || undefined, count: count || undefined });
  kontrollera("B", prov, 500);
});

Deno.test("specialutförande × borrning × magnet × stång × slag", () => {
  const prov: CP96Config[] = [];
  for (const mto of ["", ...CP96_MTO.map((x) => x.code)]) for (const b of CP96_BORES) for (const magnet of [false, true]) for (const rod of ["", "W"])
    for (const stroke_mm of [100, 1000, 1600, 1601, 1700, 1701, 1800, 1801])
      prov.push({ bore: b.code, mounting: "B", stroke_mm, cushion: b.cushion_c, magnet, rod: rod || undefined, mto: mto || undefined });
  kontrollera("C", prov, 2000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: CP96Config) => ({ ...ctx(c), stroke_mm: c.stroke_mm }) as Record<string, string | number>;
  for (const c of [
    { bore: "32", mounting: "B", stroke_mm: 100, magnet: true, cushion: true, boot: "J", rod: "W", switch: "M9BW", count: "S" },
    { bore: "125", mounting: "L", stroke_mm: 300 },
    { bore: "40", mounting: "F", stroke_mm: 1700, cushion: true, mto: "XC68" },
  ] as CP96Config[]) {
    assertEquals(fillOrderCodeTemplate(CP96_ORDER_CODE_TEMPLATE, val(c), new Set(["bore", "mounting", "stroke_mm"])), cp96BuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ bore: "32", mounting: "B", stroke_mm: 100 });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("skrivs med C"), f[0]);
  assert(kor({ bore: "63", mounting: "B", stroke_mm: 250, cushion: true }, "info").some((m) => m.includes("1559 N") && m.includes("G3/8")));
  assert(kor({ bore: "125", mounting: "B", stroke_mm: 250 }, "info").some((m) => m.includes("inga standardslag")));
  const v = kor({ bore: "32", mounting: "B", stroke_mm: 12, cushion: true, magnet: true, switch: "M9NA", count: "S" }, "warn");
  assert(v.some((m) => m.includes("15 mm")), v.join(" | "));
  const v3 = kor({ bore: "40", mounting: "B", stroke_mm: 40, cushion: true, magnet: true, switch: "M9BW", count: "3" }, "warn");
  assert(v3.some((m) => m.includes("tre givare") && m.includes("50 mm")), v3.join(" | "));
  const tom = { bore: "", mounting: "", stroke_mm: 0 } as CP96Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

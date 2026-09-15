/**
 * CM2 (Z1)-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns CM2B40-150AZ1 (sida 5), beställningsexemplet
 * CDM2C20-50Z1-NV-M9BW (sida 6) och -XC6-exemplet CDM2B20-50AZ1-W-M9BWS-XC6A
 * (sida 71); standardslag och gränser (sida 6); pivotfästets fästen (sida 5).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildCm2DbRules } from "../../../src/lib/catalog/cm2-db-rules.ts";
import {
  CM2_BOOTS,
  CM2_BORES,
  CM2_LEADS,
  CM2_MOUNTINGS,
  CM2_MTO,
  CM2_ORDER_CODE_TEMPLATE,
  CM2_ROD_ENDS,
  CM2_SOURCE,
  CM2_STANDARD_STROKES,
  CM2_SWITCHES,
  type CM2Config,
  cm2BuildCode,
  cm2ParseCode,
} from "../../../src/lib/catalog/cm2.ts";

Deno.test("modellen bär sin källa (Z1, inte den utgångna Z)", () => {
  assertEquals(CM2_SOURCE.file, "smc-kat-cm2-z1.pdf");
  assertEquals(CM2_BORES.map((b) => b.bore_mm), [20, 25, 32, 40]);
  assertEquals(CM2_MOUNTINGS.length, 13);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[CM2Config, string]> = [
    [{ bore: "40", mounting: "B", stroke_mm: 150, cushion: true }, "CM2B40-150AZ1"],
    [{ bore: "20", mounting: "C", stroke_mm: 50, magnet: true, pivot: "N", rod_end: "V", switch: "M9BW" }, "CDM2C20-50Z1-NV-M9BW"],
    [{ bore: "20", mounting: "B", stroke_mm: 50, magnet: true, cushion: true, rod_end: "W", switch: "M9BW", count: "S", mto: "XC6A" }, "CDM2B20-50AZ1-W-M9BWS-XC6A"],
    [{ bore: "32", mounting: "UZ", stroke_mm: 300, port: "TF", rod_thread: "F", pivot: "N" }, "CM2UZ32TF-300FZ1-N"],
    [{ bore: "25", mounting: "L", stroke_mm: 1000, boot: "J" }, "CM2L25-1000JZ1"],
    [{ bore: "40", mounting: "D", stroke_mm: 75, magnet: true, port: "TN", rod_end: "Q", switch: "A93", lead: "Z" }, "CDM2D40TN-75Z1-Q-A93Z"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(cm2BuildCode(c), kod);
    assertEquals(cm2BuildCode(cm2ParseCode(kod)!.config), kod);
  }
  assertEquals(cm2ParseCode("CM2B40-150AZ"), null, "Z är den utgångna serien");
  assertEquals(cm2ParseCode("CM2HB40-150Z1"), null, "lufthydraul H finns inte i Z1");
});

Deno.test("standardslag och gränser följer sida 6", () => {
  assertEquals(CM2_STANDARD_STROKES, [25, 50, 75, 100, 125, 150, 200, 250, 300]);
  assertEquals(CM2_BORES.map((b) => b.max_stroke_mm), [1000, 1500, 2000, 2000]);
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = cm2BuildCode;
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, rod_thread: "F", boot: "J" }), null, "honstång utan bälg");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, rod_thread: "F", rod_end: "V" }), null, "honstång utan tillbehör");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, pivot: "N" }), null, "pivot bara C/T/U/E/V/UZ");
  assert(b({ bore: "20", mounting: "T", stroke_mm: 50, pivot: "N" }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 1200, boot: "K" }), null, "bälg max 1000");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 1200 }));
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 1001 }), null);
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 4 }), null);
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, switch: "M9BW" }), null, "givare kräver magnet");
  assert(b({ bore: "20", mounting: "B", stroke_mm: 50, magnet: true }), "magnet utan givare går");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, lead: "L" }), null);
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, magnet: true, switch: "M9BW", mto: "XB6" }), null, "XB6 utan givare");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, cushion: true, mto: "XB7" }), null, "XB7 gummi");
  assert(b({ bore: "20", mounting: "B", stroke_mm: 50, cushion: true, mto: "XB9" }), "XB9 med luft går (på begäran)");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, boot: "J", mto: "XC4C" }), null, "XC4 utan bälg");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, cushion: true, mto: "XC4A" }), null, "XC4A gummi");
  assert(b({ bore: "20", mounting: "B", stroke_mm: 50, cushion: true, mto: "XC4C" }));
  assertEquals(b({ bore: "40", mounting: "B", stroke_mm: 1200, mto: "XC6A" }), null, "XC6 max 1000");
  assertEquals(b({ bore: "20", mounting: "C", stroke_mm: 50, mto: "XC6B" }), null, "gaffel bara XC6A");
  assert(b({ bore: "20", mounting: "C", stroke_mm: 50, mto: "XC6A" }));
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, rod_end: "V", mto: "XC29" }), null, "XC29 kräver W");
  assertEquals(b({ bore: "20", mounting: "C", stroke_mm: 50, mto: "XC52" }), null, "XC52 kräver fästmutter");
  assert(b({ bore: "20", mounting: "L", stroke_mm: 50, mto: "XC52" }));
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildCm2DbRules();
function ctx(c: CM2Config): Record<string, unknown> {
  return {
    bore: c.bore, mounting: c.mounting, stroke_mm: Number(c.stroke_mm || 0), magnet: c.magnet ? "D" : "", port: c.port ?? "",
    cushion: c.cushion ? "A" : "", rod_thread: c.rod_thread ?? "", boot: c.boot ?? "", pivot: c.pivot ?? "", rod_end: c.rod_end ?? "",
    switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  };
}
const kor = (c: CM2Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: CM2Config) => kor(c, "error");

function kontrollera(namn: string, prov: CM2Config[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = cm2BuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst);
}

Deno.test("borrning × fäste × gänga × bälg × pivot × tillbehör × slag", () => {
  const prov: CM2Config[] = [];
  for (const b of CM2_BORES) for (const m of CM2_MOUNTINGS) for (const thread of ["", "F"]) for (const boot of ["", ...CM2_BOOTS.map((x) => x.code)])
    for (const pivot of ["", "N"]) for (const rod_end of ["", ...CM2_ROD_ENDS.map((x) => x.code)]) for (const stroke_mm of [4, 50, 1000, 1001, 1500, 2001])
      prov.push({ bore: b.code, mounting: m.code, stroke_mm, rod_thread: thread || undefined, boot: boot || undefined, pivot: pivot || undefined, rod_end: rod_end || undefined });
  kontrollera("A", prov, 10000);
});

Deno.test("magnet × givare × kabel × antal × dämpning", () => {
  const prov: CM2Config[] = [];
  for (const magnet of [false, true]) for (const cushion of [false, true]) for (const sw of ["", ...CM2_SWITCHES.map((s) => s.code)])
    for (const lead of ["", ...CM2_LEADS.map((l) => l.code)]) for (const count of ["", "S"])
      prov.push({ bore: "25", mounting: "B", stroke_mm: 100, magnet, cushion, switch: sw || undefined, lead: lead || undefined, count: count || undefined });
  kontrollera("B", prov, 500);
});

Deno.test("specialutförande × dämpning × givare × bälg × fäste × tillbehör × slag", () => {
  const prov: CM2Config[] = [];
  for (const mto of ["", ...CM2_MTO.map((x) => x.code)]) for (const cushion of [false, true]) for (const sw of ["", "M9BW"])
    for (const boot of ["", "J"]) for (const m of ["B", "L", "C", "UZ"]) for (const rod_end of ["", "V", "W"]) for (const stroke_mm of [50, 1000, 1001])
      prov.push({ bore: "32", mounting: m, stroke_mm, cushion, magnet: sw !== "", switch: sw || undefined, boot: boot || undefined, rod_end: rod_end || undefined, mto: mto || undefined });
  kontrollera("C", prov, 3000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: CM2Config) => ({ ...ctx(c), stroke_mm: c.stroke_mm }) as Record<string, string | number>;
  for (const c of [
    { bore: "20", mounting: "C", stroke_mm: 50, magnet: true, pivot: "N", rod_end: "V", switch: "M9BW" },
    { bore: "40", mounting: "B", stroke_mm: 150, cushion: true },
    { bore: "20", mounting: "B", stroke_mm: 50, magnet: true, cushion: true, rod_end: "W", switch: "M9BW", count: "S", mto: "XC6A" },
    { bore: "32", mounting: "UZ", stroke_mm: 300, port: "TF", rod_thread: "F", pivot: "N" },
  ] as CM2Config[]) {
    assertEquals(fillOrderCodeTemplate(CM2_ORDER_CODE_TEMPLATE, val(c), new Set(["bore", "mounting", "stroke_mm"])), cm2BuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ bore: "20", mounting: "B", stroke_mm: 50, pivot: "N" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("Pivotfästet N") && f[0].includes("UZ"), f[0]);
  assert(kor({ bore: "40", mounting: "B", stroke_mm: 150 }, "info").some((m) => m.includes("628 N")));
  assert(kor({ bore: "40", mounting: "B", stroke_mm: 160 }, "info").some((m) => m.includes("mellanslag")));
  const v = kor({ bore: "20", mounting: "B", stroke_mm: 10, magnet: true, switch: "M9BW" }, "warn");
  assert(v.some((m) => m.includes("två givare") && m.includes("15 mm")), v.join(" | "));
  const tom = { bore: "", mounting: "", stroke_mm: 0 } as CM2Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

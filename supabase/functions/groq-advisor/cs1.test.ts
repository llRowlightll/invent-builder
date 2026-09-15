/**
 * CS1-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns CS1L160-300-V (sida 620), CDS1L160-300-M9BW och
 * CDS1B125-200 (sida 625), viktexemplet CS1L160-500 (sida 622); maxslag
 * per rör, fäste och magnet (sida 621 och 626); tryckkärlsgränserna
 * (sida 622); kombinationstabellen (sida 618).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildCs1DbRules } from "../../../src/lib/catalog/cs1-db-rules.ts";
import {
  CS1_BORES,
  CS1_LEADS,
  CS1_MOUNTINGS,
  CS1_MTO,
  CS1_ORDER_CODE_TEMPLATE,
  CS1_SOURCE,
  CS1_SUFFIXES,
  CS1_SWITCHES,
  type CS1Config,
  cs1BuildCode,
  cs1MaxStroke,
  cs1ParseCode,
} from "../../../src/lib/catalog/cs1.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(CS1_SOURCE.file, "smc-kat-cs1.pdf");
  assertEquals(CS1_BORES.map((b) => b.bore_mm), [125, 140, 160, 180, 200, 250, 300]);
  assertEquals(CS1_SUFFIXES.map((s) => s.code), ["N", "R", "H", "J", "K", "JN", "JR", "HJ", "KN", "KR", "HK"], "bokstavsordning inom tillägget");
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[CS1Config, string]> = [
    [{ bore: "160", mounting: "L", stroke_mm: 500 }, "CS1L160-500"],
    [{ bore: "160", mounting: "L", stroke_mm: 300, magnet: true, switch: "M9BW" }, "CDS1L160-300-M9BW"],
    [{ bore: "125", mounting: "B", stroke_mm: 200, magnet: true }, "CDS1B125-200"],
    [{ bore: "200", mounting: "L", stroke_mm: 1200, vessel: "V" }, "CS1L200-1200-V"],
    [{ bore: "140", mounting: "F", stroke_mm: 800, tubing: "F", type: "N", port: "TN", suffix: "HJ", mto: "XC6" }, "CS1FFN140TN-800HJ-XC6"],
    [{ bore: "160", mounting: "T", stroke_mm: 1000, type: "H", suffix: "K" }, "CS1TH160-1000K"],
    [{ bore: "180", mounting: "C", stroke_mm: 600, magnet: true, type: "N", suffix: "JN", switch: "A93", lead: "L", count: "3", mto: "XC35" }, "CDS1CN180-600JN-A93L3-XC35"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(cs1BuildCode(c), kod);
    assertEquals(cs1BuildCode(cs1ParseCode(kod)!.config), kod);
  }
  assertEquals(cs1ParseCode("CS1L160-300-V"), null, "ø160 omfattas inte av tryckkärlslagen — -V sätts inte");
  assertEquals(cs1ParseCode("CS1B160-800NJ"), null, "tillägget skrivs i bokstavsordning: JN");
});

Deno.test("maxslag följer sida 621 och 626", () => {
  const b = (k: string) => CS1_BORES.find((x) => x.code === k)!;
  const L = CS1_MOUNTINGS.find((m) => m.code === "L")!;
  const B = CS1_MOUNTINGS.find((m) => m.code === "B")!;
  assertEquals([cs1MaxStroke(b("125"), B, false), cs1MaxStroke(b("125"), L, false)], [1000, 1600]);
  assertEquals([cs1MaxStroke(b("160"), B, false), cs1MaxStroke(b("160"), L, false)], [1200, 1600]);
  assertEquals([cs1MaxStroke(b("200"), B, false), cs1MaxStroke(b("200"), L, false)], [1200, 2000]);
  assertEquals([cs1MaxStroke(b("300"), B, false), cs1MaxStroke(b("300"), L, false)], [1200, 2400]);
  assertEquals([cs1MaxStroke(b("125"), B, true), cs1MaxStroke(b("125"), L, true)], [1000, 1400]);
  assertEquals([cs1MaxStroke(b("180"), B, true), cs1MaxStroke(b("180"), L, true)], [1200, 1500]);
  assertEquals([cs1MaxStroke(b("200"), B, true), cs1MaxStroke(b("200"), L, true)], [998, 998]);
  assertEquals(CS1_BORES.map((x) => x.vessel_over_mm), [0, 0, 0, 1569, 998, 813, 564]);
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = cs1BuildCode;
  assertEquals(b({ bore: "250", mounting: "B", stroke_mm: 500, magnet: true }), null, "magnet ø125–200");
  assertEquals(b({ bore: "125", mounting: "B", stroke_mm: 500, magnet: true, tubing: "F" }), null, "F inte med magnet");
  assertEquals(b({ bore: "180", mounting: "B", stroke_mm: 500, tubing: "F" }), null, "ø180 alltid stål");
  assertEquals(b({ bore: "125", mounting: "L", stroke_mm: 1200, tubing: "F" }), null, "F bara ≤ 1000");
  assert(b({ bore: "125", mounting: "L", stroke_mm: 1000, tubing: "F" }));
  assertEquals(b({ bore: "180", mounting: "B", stroke_mm: 500, type: "H" }), null, "lufthydraul ø125–160");
  assertEquals(b({ bore: "125", mounting: "B", stroke_mm: 500, type: "H", suffix: "N" }), null, "lufthydraul utan dämpsymbol");
  assert(b({ bore: "125", mounting: "B", stroke_mm: 500, type: "H", suffix: "J" }));
  assertEquals(b({ bore: "125", mounting: "B", stroke_mm: 1001 }), null);
  assertEquals(b({ bore: "125", mounting: "L", stroke_mm: 1601 }), null);
  assertEquals(b({ bore: "200", mounting: "L", stroke_mm: 999, magnet: true }), null, "magnet ø200 ≤ 998");
  assertEquals(b({ bore: "125", mounting: "B", stroke_mm: 500, switch: "M9BW" }), null, "givare kräver magnet");
  assertEquals(b({ bore: "160", mounting: "B", stroke_mm: 500, vessel: "V" }), null, "ø160 aldrig -V");
  assertEquals(b({ bore: "250", mounting: "B", stroke_mm: 800, vessel: "V" }), null, "ø250 -V först över 813");
  assert(b({ bore: "250", mounting: "B", stroke_mm: 814, vessel: "V" }));
  assertEquals(b({ bore: "250", mounting: "B", stroke_mm: 814, magnet: false, vessel: "V", type: "N", mto: "XB6" }), null, "XB6 ø125–200");
  assertEquals(b({ bore: "125", mounting: "B", stroke_mm: 500, mto: "XB6" }), null, "XB6 bara osmord");
  assert(b({ bore: "125", mounting: "B", stroke_mm: 500, type: "N", mto: "XB6" }));
  assertEquals(b({ bore: "125", mounting: "B", stroke_mm: 500, type: "H", mto: "XC5" }), null, "XC5 inte lufthydraul");
  assert(b({ bore: "125", mounting: "B", stroke_mm: 500, type: "H", mto: "XC4" }), "XC4 lufthydraul är specialprodukt men går");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildCs1DbRules();
function ctx(c: CS1Config): Record<string, unknown> {
  return {
    bore: c.bore, mounting: c.mounting, stroke_mm: Number(c.stroke_mm || 0), magnet: c.magnet ? "D" : "", tubing: c.tubing ?? "",
    type: c.type ?? "", port: c.port ?? "", suffix: c.suffix ?? "", switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "",
    mto: c.mto ?? "", vessel: c.vessel ?? "",
  };
}
const kor = (c: CS1Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: CS1Config) => kor(c, "error");

function kontrollera(namn: string, prov: CS1Config[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = cs1BuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst);
}

Deno.test("borrning × fäste × magnet × rör × typ × tillägg × slag × -V", () => {
  const prov: CS1Config[] = [];
  for (const b of CS1_BORES) for (const m of CS1_MOUNTINGS) for (const magnet of [false, true]) for (const tubing of ["", "F"])
    for (const type of ["", "N", "H"]) for (const suffix of ["", "N", "J", "HK"]) for (const vessel of ["", "V"])
      for (const stroke_mm of [500, 998, 999, 1000, 1001, 1200, 1201, 1400, 1401, 1569, 1570, 1600, 1601, 2000, 2001, 2400, 2401])
        prov.push({ bore: b.code, mounting: m.code, stroke_mm, magnet, tubing: tubing || undefined, type: type || undefined, suffix: suffix || undefined, vessel: vessel || undefined });
  kontrollera("A", prov, 50000);
});

Deno.test("magnet × givare × kabel × antal", () => {
  const prov: CS1Config[] = [];
  for (const magnet of [false, true]) for (const sw of ["", ...CS1_SWITCHES.map((s) => s.code)]) for (const lead of ["", ...CS1_LEADS.map((l) => l.code)])
    for (const count of ["", "S", "3"])
      prov.push({ bore: "160", mounting: "B", stroke_mm: 300, magnet, switch: sw || undefined, lead: lead || undefined, count: count || undefined });
  kontrollera("B", prov, 300);
});

Deno.test("specialutförande × borrning × typ", () => {
  const prov: CS1Config[] = [];
  for (const mto of ["", ...CS1_MTO.map((x) => x.code)]) for (const b of CS1_BORES) for (const type of ["", "N", "H"])
    prov.push({ bore: b.code, mounting: "B", stroke_mm: 300, type: type || undefined, mto: mto || undefined });
  kontrollera("C", prov, 300);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: CS1Config) => ({ ...ctx(c), stroke_mm: c.stroke_mm }) as Record<string, string | number>;
  for (const c of [
    { bore: "160", mounting: "L", stroke_mm: 300, magnet: true, switch: "M9BW" },
    { bore: "200", mounting: "L", stroke_mm: 1200, vessel: "V" },
    { bore: "140", mounting: "F", stroke_mm: 800, tubing: "F", type: "N", port: "TN", suffix: "HJ", mto: "XC6" },
    { bore: "125", mounting: "B", stroke_mm: 200, magnet: true },
  ] as CS1Config[]) {
    assertEquals(fillOrderCodeTemplate(CS1_ORDER_CODE_TEMPLATE, val(c), new Set(["bore", "mounting", "stroke_mm"])), cs1BuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ bore: "250", mounting: "B", stroke_mm: 500, magnet: true });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("ø125–200"), f[0]);
  assert(kor({ bore: "160", mounting: "L", stroke_mm: 500 }, "info").some((m) => m.includes("10053 N") && m.includes("aluminiumrör till 1200")));
  const v = kor({ bore: "250", mounting: "B", stroke_mm: 900 }, "warn");
  assert(v.some((m) => m.includes("tryckkärlslag") && m.includes("-V")), v.join(" | "));
  assertEquals(kor({ bore: "250", mounting: "B", stroke_mm: 900, vessel: "V" }, "warn"), []);
  const v2 = kor({ bore: "125", mounting: "B", stroke_mm: 500, type: "H", mto: "XC4" }, "warn");
  assert(v2.some((m) => m.includes("specialprodukt")), v2.join(" | "));
  const tom = { bore: "", mounting: "", stroke_mm: 0 } as CS1Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

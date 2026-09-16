/**
 * MHZ2-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel MHZ2-16D-M9BW (sida 497) och MHZ2-6D/32D-M9BW
 * (sida 496, 498), modelltabellen (sida 499), givartabellens ●/○/— och
 * D-F8:s borrningar (sida 496–498), kroppsalternativens tabell (sida 499),
 * -X46/-X51 (sida 547–548).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildMhz2DbRules } from "../../../src/lib/catalog/mhz2-db-rules.ts";
import {
  MHZ2_ACTIONS,
  MHZ2_BODIES,
  MHZ2_BORES,
  MHZ2_COUNTS,
  MHZ2_FINGERS,
  MHZ2_LEADS,
  MHZ2_MTO,
  MHZ2_ORDER_CODE_TEMPLATE,
  MHZ2_SOURCE,
  MHZ2_SWITCHES,
  type MHZ2Config,
  mhz2BuildCode,
  mhz2ParseCode,
} from "../../../src/lib/catalog/mhz2.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(MHZ2_SOURCE.file, "smc-kat-mhz2-std.pdf");
  assertEquals(MHZ2_BORES.map((b) => b.bore_mm), [6, 10, 16, 20, 25, 32, 40]);
  assertEquals(MHZ2_BORES.map((b) => b.force_d[0]), [3.3, 11, 34, 42, 65, 158, 254], "sida 499");
  assertEquals(MHZ2_BORES.map((b) => b.force_nc), [3.7, 13, 38, 57, 83, 161, 267]);
  assertEquals(MHZ2_BORES.map((b) => b.stroke_mm), [4, 4, 6, 10, 14, 22, 30]);
  assertEquals(MHZ2_BORES.map((b) => b.repeatability_mm), [0.01, 0.01, 0.01, 0.01, 0.01, 0.02, 0.02]);
  assertEquals(MHZ2_BORES.find((b) => b.code === "10")!.pressure_d, [0.2, 0.7]);
  assertEquals(MHZ2_BORES.find((b) => b.code === "6")!.pressure_s, [0.3, 0.7]);
  assertEquals(MHZ2_SWITCHES.length, 21, "nio M9-typer i två riktningar och tre F8");
  assertEquals(MHZ2_SWITCHES.find((g) => g.code === "F8N")!.leads, "S-SO");
  assertEquals(MHZ2_SWITCHES.find((g) => g.code === "M9BAV")!.leads, "OOSO");
  assertEquals(MHZ2_MTO.length, 14, "sida 499 och 547–548");
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[MHZ2Config, string]> = [
    [{ bore: "16", action: "D", switch: "M9BW" }, "MHZ2-16D-M9BW"],
    [{ bore: "6", action: "D", switch: "M9BW" }, "MHZ2-6D-M9BW"],
    [{ bore: "32", action: "D", switch: "M9BW" }, "MHZ2-32D-M9BW"],
    [{ bore: "10", action: "D", body: "W" }, "MHZ2-10DW"],
    [{ bore: "16", action: "C", body: "K" }, "MHZ2-16CK"],
    [{ bore: "25", action: "S", finger: "N1", body: "E", switch: "M9NW", lead: "L", count: "S", mto: "X4" }, "MHZ2-25SN1E-M9NWLS-X4"],
    [{ bore: "10", action: "D", mto: "X46" }, "MHZ2-10D-X46"],
    [{ bore: "16", action: "D", finger: "N", mto: "X51" }, "MHZ2-16DN-X51"],
    [{ bore: "20", action: "D", switch: "F8B", lead: "L", count: "3" }, "MHZ2-20D-F8BL3"],
    [{ bore: "40", action: "C", finger: "2", switch: "M9NV", lead: "Z" }, "MHZ2-40C2-M9NVZ"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(mhz2BuildCode(c), kod);
    assertEquals(mhz2BuildCode(mhz2ParseCode(kod)!.config), kod, kod);
  }
  assertEquals(mhz2ParseCode("MHZ2-16-D"), null, "den gamla mallen");
  assertEquals(mhz2ParseCode("JMHZ2-16D"), null, "kompaktserien");
  assertEquals(mhz2ParseCode("MHZ2-16D-M9BW-X50"), null, "givare utan magnet");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = mhz2BuildCode;
  assertEquals(b({ bore: "8", action: "D" }), null, "ø8 är JMHZ2");
  assertEquals(b({ bore: "6", action: "D", finger: "N" }), null, "smal typ bara ø10–25");
  assertEquals(b({ bore: "32", action: "D", finger: "N2" }), null);
  assert(b({ bore: "32", action: "D", finger: "2" }));
  assertEquals(b({ bore: "6", action: "D", body: "E" }), null, "ändtapp bara ø10–25");
  assertEquals(b({ bore: "40", action: "S", body: "K" }), null);
  assertEquals(b({ bore: "16", action: "S", body: "W" }), null, "W bara dubbelverkande");
  assertEquals(b({ bore: "16", action: "D", body: "K" }), null, "K bara enkelverkande");
  assertEquals(b({ bore: "16", action: "D", body: "M" }), null);
  assert(b({ bore: "16", action: "C", body: "M" }));
  assertEquals(b({ bore: "10", action: "D", switch: "F8N" }), null, "F8 inte ø10");
  assert(b({ bore: "6", action: "D", switch: "F8N" }));
  assertEquals(b({ bore: "16", action: "D", switch: "F8N", lead: "M" }), null, "F8 saknar 1 m");
  assertEquals(b({ bore: "6", action: "D", switch: "M9BW", count: "3" }), null, "ø6 bara S");
  assert(b({ bore: "10", action: "D", switch: "M9BW", count: "4" }));
  assertEquals(b({ bore: "16", action: "D", lead: "L" }), null, "kabel utan givare");
  assertEquals(b({ bore: "16", action: "D", switch: "M9BW", mto: "X50" }), null, "utan magnet");
  assertEquals(b({ bore: "6", action: "D", mto: "X46" }), null, "X46 bara ø10–25");
  assertEquals(b({ bore: "16", action: "S", mto: "X46" }), null, "X46 bara dubbelverkande");
  assertEquals(b({ bore: "16", action: "D", body: "K", mto: "X46" }), null);
  assert(b({ bore: "16", action: "D", body: "W", mto: "X46" }));
  assertEquals(b({ bore: "32", action: "D", mto: "X51" }), null, "X51 bara ø10–25");
  assertEquals(b({ bore: "16", action: "D", finger: "3", mto: "X51" }), null, "X51 utan fingeralternativ 3");
  assertEquals(b({ bore: "16", action: "D", finger: "N1", mto: "X51" }), null);
  assert(b({ bore: "16", action: "C", finger: "N", body: "M", mto: "X51" }));
  assertEquals(b({ bore: "16", action: "D", mto: "XC4" }), null, "MB:s specialutförande");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildMhz2DbRules();
function ctx(c: MHZ2Config): Record<string, unknown> {
  return { bore: c.bore, action: c.action, finger: c.finger ?? "", body: c.body ?? "", switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "" };
}
const kor = (c: MHZ2Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: MHZ2Config) => kor(c, "error");

function kontrollera(namn: string, prov: MHZ2Config[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = mhz2BuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst, `${namn}: ${prov.length}`);
}

Deno.test("borrning × verkan × finger × kropp × special", () => {
  const prov: MHZ2Config[] = [];
  for (const b of MHZ2_BORES) for (const a of MHZ2_ACTIONS) for (const finger of ["", ...MHZ2_FINGERS.map((f) => f.code)])
    for (const body of ["", ...MHZ2_BODIES.map((k) => k.code)]) for (const mto of ["", ...MHZ2_MTO.map((x) => x.code)])
      prov.push({ bore: b.code, action: a.code, finger: finger || undefined, body: body || undefined, mto: mto || undefined });
  kontrollera("A", prov, 11000);
});

Deno.test("borrning × verkan × givare × kabel × antal × special", () => {
  const prov: MHZ2Config[] = [];
  for (const b of MHZ2_BORES) for (const a of ["D", "S"]) for (const sw of ["", ...MHZ2_SWITCHES.map((g) => g.code)])
    for (const lead of ["", ...MHZ2_LEADS.map((l) => l.code)]) for (const count of ["", ...MHZ2_COUNTS.map((n) => n.code)]) for (const mto of ["", "X50", "X46"])
      prov.push({ bore: b.code, action: a, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined });
  kontrollera("B", prov, 14000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { bore: "16", action: "D", switch: "M9BW" },
    { bore: "10", action: "D", body: "W" },
    { bore: "25", action: "S", finger: "N1", body: "E", switch: "M9NW", lead: "L", count: "S", mto: "X4" },
    { bore: "16", action: "D", finger: "N", mto: "X51" },
  ] as MHZ2Config[]) {
    assertEquals(fillOrderCodeTemplate(MHZ2_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["bore", "action"])), mhz2BuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ bore: "16", action: "D", body: "K" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("enkelverkande"), f[0]);
  const f2 = fel({ bore: "10", action: "D", switch: "F8N" });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("ø10"), f2[0]);
  const v = kor({ bore: "16", action: "D", switch: "M9BAV" }, "warn");
  assert(v.some((m) => m.includes("på beställning")), v.join(" | "));
  assert(v.some((m) => m.includes("vattentätheten")), v.join(" | "));
  assertEquals(kor({ bore: "16", action: "D", switch: "F8N", lead: "L" }, "warn"), []);
  assert(kor({ bore: "40", action: "C" }, "info").some((m) => m.includes("267 N") && m.includes("30 mm")));
  assert(kor({ bore: "10", action: "D", switch: "M9N" }, "info").some((m) => m.includes("MHZ2-10 levereras")));
  assert(kor({ bore: "16", action: "D", switch: "F8N" }, "info").some((m) => m.includes("10 mm")));
  assert(kor({ bore: "16", action: "D", mto: "X46" }, "info").some((m) => m.includes("strypskruven")));
  const tom = { bore: "", action: "" } as MHZ2Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

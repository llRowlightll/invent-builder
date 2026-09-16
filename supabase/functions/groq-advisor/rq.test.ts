/**
 * RQ-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel RQB32-50 och RDQB32-50-M9BW (sida 1039), RDQL40-50
 * (sida 1039, magnetcylinder utan givare), RQA32-300C och RDQA40-200C
 * (sida 1053-2), viktexemplet RDQF32-200CM (sida 1053-3), mellanslagen
 * RQB32-47 (sida 1040) och RQA32-115C (sida 1053-3, tryckt "RQA32-115DC"),
 * givartabellens V/v/— (sida 1039), not 2 om ø20/25 (sida 1039), -XC35
 * ø32–100 (sida 1040).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildRqDbRules } from "../../../src/lib/catalog/rq-db-rules.ts";
import {
  RQ_BORES,
  RQ_COUNTS,
  RQ_LEADS,
  RQ_LIMITS,
  RQ_MOUNTINGS,
  RQ_MTO,
  RQ_ORDER_CODE_TEMPLATE,
  RQ_SOURCE,
  RQ_SWITCHES,
  RQ_THREADS,
  type RQConfig,
  rqBuildCode,
  rqLongMax,
  rqParseCode,
  rqStandardMax,
} from "../../../src/lib/catalog/rq.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(RQ_SOURCE.file, "smc-kat-rq.pdf");
  assertEquals(RQ_BORES.map((b) => b.bore_mm), [20, 25, 32, 40, 50, 63, 80, 100]);
  assertEquals(RQ_BORES.map((b) => b.cushion_mm), [5.8, 6.1, 6.6, 6.6, 7.1, 7, 7.5, 8], "sida 1040");
  assertEquals(RQ_BORES.map((b) => b.force_out_n), [157, 245, 402, 628, 982, 1560, 2510, 3930], "sida 1040, OUT 0,5 MPa");
  assertEquals(RQ_BORES.map((b) => b.force_in_n), [118, 189, 302, 528, 825, 1400, 2270, 3570]);
  assertEquals(RQ_BORES.map(rqStandardMax), [50, 50, 100, 100, 100, 100, 100, 100]);
  assertEquals(RQ_BORES.map(rqLongMax), [200, 200, 300, 300, 300, 300, 300, 300]);
  assertEquals(RQ_BORES.find((b) => b.code === "20")!.standard, [15, 20, 25, 30, 40, 50]);
  assertEquals(RQ_BORES.find((b) => b.code === "80")!.standard, [40, 50, 75, 100]);
  assertEquals(RQ_BORES.find((b) => b.code === "25")!.long, [75, 100, 125, 150, 175, 200], "sida 1053-2");
  assertEquals(RQ_BORES.find((b) => b.code === "32")!.intermediate, [21, 99], "sida 1040");
  assertEquals(RQ_BORES.find((b) => b.code === "20")!.intermediate_long, [51, 199], "sida 1053-3");
  assertEquals(RQ_BORES.filter((b) => b.thread === "M").map((b) => b.code), ["20", "25"]);
  assertEquals(RQ_MOUNTINGS.map((m) => m.code), ["B", "A", "L", "LC", "F", "G", "D"]);
  assertEquals(RQ_SWITCHES.length, 25, "tolv typer i två riktningar och P3DWA");
  assertEquals(RQ_SWITCHES.find((g) => g.code === "A93")!.leads, "SSSS");
  assertEquals(RQ_SWITCHES.find((g) => g.code === "A93V")!.leads, "S-SS", "∗2");
  assertEquals(RQ_SWITCHES.find((g) => g.code === "M9BA")!.leads, "OOSO");
  assertEquals(RQ_MTO.map((x) => x.code), ["XA", "XC4", "XC35"]);
  assertEquals(RQ_LIMITS.temp_magnet_c, [-10, 60]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[RQConfig, string]> = [
    [{ bore: "32", mounting: "B", stroke_mm: 50 }, "RQB32-50"],
    [{ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "M9BW" }, "RDQB32-50-M9BW"],
    [{ bore: "40", mounting: "L", stroke_mm: 50, magnet: true }, "RDQL40-50"],
    [{ bore: "32", mounting: "A", stroke_mm: 300, bumper: "C" }, "RQA32-300C"],
    [{ bore: "40", mounting: "A", stroke_mm: 200, bumper: "C", magnet: true }, "RDQA40-200C"],
    [{ bore: "32", mounting: "F", stroke_mm: 200, bumper: "C", rod_end: "M", magnet: true }, "RDQF32-200CM"],
    [{ bore: "32", mounting: "B", stroke_mm: 47 }, "RQB32-47"],
    [{ bore: "32", mounting: "A", stroke_mm: 115, bumper: "C" }, "RQA32-115C"],
    [{ bore: "63", mounting: "F", stroke_mm: 100, magnet: true, thread: "TF", rod_end: "M", switch: "A93", lead: "M", count: "S", mto: "XC35" }, "RDQF63TF-100M-A93MS-XC35"],
    [{ bore: "20", mounting: "B", stroke_mm: 15, mto: "XC4" }, "RQB20-15-XC4"],
    [{ bore: "100", mounting: "D", stroke_mm: 100, magnet: true, switch: "P3DWA", lead: "L", count: "3" }, "RDQD100-100-P3DWAL3"],
    [{ bore: "25", mounting: "LC", stroke_mm: 199, bumper: "C", magnet: true, switch: "M9NV", lead: "Z" }, "RDQLC25-199C-M9NVZ"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(rqBuildCode(c), kod);
    assertEquals(rqBuildCode(rqParseCode(kod)!.config), kod, kod);
  }
  assertEquals(rqParseCode("RDQB-32-50-CD"), null, "den gamla mallen");
  assertEquals(rqParseCode("RQB32-50-M9BW"), null, "givare utan magnet");
  assertEquals(rqParseCode("CQ2B32-50"), null, "annan serie");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = rqBuildCode;
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 20 }), null, "ø16 finns inte");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 10 }), null, "under 15");
  assertEquals(b({ bore: "20", mounting: "A", stroke_mm: 30 }), null, "not 2: RQA20-30 finns inte");
  assertEquals(b({ bore: "25", mounting: "A", stroke_mm: 50 }), null);
  assert(b({ bore: "32", mounting: "A", stroke_mm: 50 }));
  assert(b({ bore: "20", mounting: "A", stroke_mm: 100, bumper: "C" }), "långslagstypens A");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 60 }), null, "över 50 utan C");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 60, bumper: "C" }), null, "B finns inte i långslagstypen");
  assertEquals(b({ bore: "32", mounting: "A", stroke_mm: 50, bumper: "C" }), null, "C bara över 100");
  assertEquals(b({ bore: "32", mounting: "A", stroke_mm: 301, bumper: "C" }), null, "över 300");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 20.5 }), null, "1 mm-steg");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 20, thread: "TN" }), null, "M-gänga på ø20/25");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 20, thread: "TN" }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 20, thread: "TX" }), null);
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, switch: "M9BW" }), null, "givare utan magnet");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, magnet: true, switch: "P3DWA" }), null, "P3DWA inte ø20");
  assert(b({ bore: "25", mounting: "B", stroke_mm: 50, magnet: true, switch: "P3DWA" }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "P3DWA", lead: "M" }), null, "P3DWA saknar 1 m");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "A93V", lead: "M" }), null, "1 m bara D-A93");
  assert(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "A93", lead: "M" }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "A96", lead: "Z" }), null, "reed 3-tråd utan 5 m");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "A90", lead: "Z" }), null);
  assert(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "M9BA", lead: "Z" }), "på beställning men finns");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, lead: "L" }), null, "kabel utan givare");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, count: "S" }), null);
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "M9BW", count: "2" }), null);
  assertEquals(b({ bore: "32", mounting: "A", stroke_mm: 150, bumper: "C", mto: "XC4" }), null, "ingen specialposition i långslagstypen");
  assertEquals(b({ bore: "20", mounting: "B", stroke_mm: 50, mto: "XC35" }), null, "XC35 ø32–100");
  assert(b({ bore: "20", mounting: "B", stroke_mm: 50, mto: "XA" }));
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, mto: "X46" }), null, "MHZ2:s specialutförande");
  assertEquals(b({ bore: "32", mounting: "B", stroke_mm: 50, rod_end: "F" }), null);
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildRqDbRules();
function ctx(c: RQConfig): Record<string, unknown> {
  return {
    magnet: c.magnet ? "D" : "", mounting: c.mounting, bore: c.bore, thread: c.thread ?? "", stroke_mm: c.stroke_mm, bumper: c.bumper ?? "", rod_end: c.rod_end ?? "",
    switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  };
}
const kor = (c: RQConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: RQConfig) => kor(c, "error");

function kontrollera(namn: string, prov: RQConfig[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = rqBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst, `${namn}: ${prov.length}`);
}

const SLAG = [14, 15, 16, 20, 30, 40, 41, 49, 50, 51, 60, 75, 99, 100, 101, 115, 125, 199, 200, 201, 250, 299, 300, 301];

Deno.test("borrning × fäste × slag × buffert × gänga × special", () => {
  const prov: RQConfig[] = [];
  for (const b of RQ_BORES) for (const m of RQ_MOUNTINGS) for (const st of SLAG) for (const bumper of ["", "C"])
    for (const thread of ["", ...RQ_THREADS.map((t) => t.code)]) for (const mto of ["", ...RQ_MTO.map((x) => x.code)])
      prov.push({ bore: b.code, mounting: m.code, stroke_mm: st, bumper: bumper || undefined, thread: thread || undefined, mto: mto || undefined });
  kontrollera("A", prov, 30000);
});

Deno.test("borrning × magnet × givare × kabel × antal", () => {
  const prov: RQConfig[] = [];
  for (const b of RQ_BORES) for (const magnet of [false, true]) for (const sw of ["", ...RQ_SWITCHES.map((g) => g.code)])
    for (const lead of ["", ...RQ_LEADS.map((l) => l.code)]) for (const count of ["", ...RQ_COUNTS.map((n) => n.code)])
      prov.push({ bore: b.code, mounting: "B", stroke_mm: 50, magnet, switch: sw || undefined, lead: lead || undefined, count: count || undefined });
  kontrollera("B", prov, 6000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { bore: "32", mounting: "B", stroke_mm: 50 },
    { bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "M9BW" },
    { bore: "32", mounting: "A", stroke_mm: 300, bumper: "C" },
    { bore: "32", mounting: "F", stroke_mm: 200, bumper: "C", rod_end: "M", magnet: true },
    { bore: "63", mounting: "F", stroke_mm: 100, magnet: true, thread: "TF", rod_end: "M", switch: "A93", lead: "M", count: "S", mto: "XC35" },
    { bore: "20", mounting: "B", stroke_mm: 15, mto: "XC4" },
  ] as RQConfig[]) {
    assertEquals(fillOrderCodeTemplate(RQ_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["bore", "mounting", "stroke_mm"])), rqBuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ bore: "20", mounting: "A", stroke_mm: 30 });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("RQA20-30"), f[0]);
  const f2 = fel({ bore: "20", mounting: "B", stroke_mm: 60 });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("gummibuffert C"), f2[0]);
  const f3 = fel({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "A93V", lead: "M" });
  assertEquals(f3.length, 1, f3.join(" | "));
  assert(f3[0].includes("A93V") && f3[0].includes("1 m"), f3[0]);
  const v = kor({ bore: "32", mounting: "B", stroke_mm: 47 }, "warn");
  assertEquals(v.length, 1, v.join(" | "));
  assert(v[0].includes("egen tub"), v[0]);
  const v2 = kor({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "M9BAV", lead: "Z" }, "warn");
  assert(v2.some((m) => m.includes("på beställning")), v2.join(" | "));
  assert(v2.some((m) => m.includes("vattentätheten")), v2.join(" | "));
  assertEquals(kor({ bore: "32", mounting: "B", stroke_mm: 50, magnet: true, switch: "M9BW", lead: "L" }, "warn"), []);
  assert(kor({ bore: "100", mounting: "B", stroke_mm: 50 }, "info").some((m) => m.includes("3930 N") && m.includes("CQ-L/LC/F/D0100")));
  assert(kor({ bore: "20", mounting: "L", stroke_mm: 20 }, "info").some((m) => m.includes("två stycken")));
  assert(kor({ bore: "32", mounting: "B", stroke_mm: 50 }, "info").some((m) => m.includes("0,05–1 MPa")));
  const tom = { bore: "", mounting: "", stroke_mm: 0 } as RQConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

/**
 * CJ2-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel CDJ2B16-60AZ (sida 74), beställningsexemplet
 * CDJ2D16-60Z-NW-M9BW-B (sida 75) och -X2838-exemplet
 * CDJ2D10-60Z-N-M9BW-B-X2838 (sida 182); standardslagen och gränserna
 * (sida 75) avskrivna här igen; givartabellens band/skena och kabellängder
 * (sida 74) stickprovade rad för rad.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildCj2DbRules } from "../../../src/lib/catalog/cj2-db-rules.ts";
import {
  CJ2_BORES,
  CJ2_LEADS,
  CJ2_MOUNTINGS,
  CJ2_MTO,
  CJ2_ORDER_CODE_TEMPLATE,
  CJ2_ROD_ENDS,
  CJ2_SOURCE,
  CJ2_SWITCHES,
  type CJ2Config,
  cj2BuildCode,
  cj2LeadAvail,
  cj2ParseCode,
} from "../../../src/lib/catalog/cj2.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(CJ2_SOURCE.file, "smc-kat-cj2.pdf");
  assertEquals(CJ2_BORES.map((b) => b.bore_mm), [6, 10, 16], "CJ2 är ø6, 10 och 16 — inte ø20");
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[CJ2Config, string]> = [
    [{ bore: "16", mounting: "B", stroke_mm: 60, magnet: true, cushion: true, switch_mount: "B" }, "CDJ2B16-60AZ-B"],
    [{ bore: "16", mounting: "D", stroke_mm: 60, magnet: true, pivot: "N", rod_end: "W", switch_mount: "B", switch: "M9BW" }, "CDJ2D16-60Z-NW-M9BW-B"],
    [{ bore: "10", mounting: "D", stroke_mm: 60, magnet: true, pivot: "N", switch_mount: "B", switch: "M9BW", mto: "X2838" }, "CDJ2D10-60Z-N-M9BW-B-X2838"],
    [{ bore: "16", mounting: "B", stroke_mm: 60 }, "CJ2B16-60Z"],
    [{ bore: "6", mounting: "L", stroke_mm: 45, port: "R" }, "CJ2L6-45RZ"],
    [{ bore: "10", mounting: "B", stroke_mm: 100, magnet: true, switch_mount: "A", switch: "F79F", lead: "L", count: "S" }, "CDJ2B10-100Z-F79FLS-A"],
    [{ bore: "16", mounting: "F", stroke_mm: 200, cushion: true, rod_end: "T", mto: "XC51" }, "CJ2F16-200AZ-T-XC51"],
    [{ bore: "16", mounting: "B", stroke_mm: 75, magnet: true, switch_mount: "B", switch: "H7C", lead: "N" }, "CDJ2B16-75Z-H7CN-B"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(cj2BuildCode(c), kod);
    assertEquals(cj2BuildCode(cj2ParseCode(kod)!.config), kod);
  }
  assertEquals(cj2ParseCode("CJ2B20-60Z"), null, "ø20 finns inte");
  assertEquals(cj2ParseCode("CJ2B16-60"), null, "Z-suffixet är del av nyckeln");
});

Deno.test("standardslag och gränser följer sida 75", () => {
  const b = (k: string) => CJ2_BORES.find((x) => x.code === k)!;
  assertEquals(b("6").standard_strokes, [15, 30, 45, 60]);
  assertEquals(b("10").standard_strokes, [15, 30, 45, 60, 75, 100, 125, 150]);
  assertEquals(b("16").standard_strokes, [15, 30, 45, 60, 75, 100, 125, 150, 175, 200]);
  assertEquals(CJ2_BORES.map((x) => x.max_stroke_mm), [200, 400, 400]);
  assertEquals(CJ2_BORES.map((x) => x.min_pressure_rubber_mpa), [0.12, 0.06, 0.06]);
  assertEquals(CJ2_BORES.map((x) => x.min_pressure_cushion_mpa), [null, 0.1, 0.1]);
});

Deno.test("givartabellen (sida 74): band/skena och kabellängder", () => {
  const g = (k: string) => CJ2_SWITCHES.find((x) => x.code === k)!;
  assertEquals([g("H7C").band, g("H7C").rail], [true, false]);
  assertEquals([g("J79C").band, g("J79C").rail], [false, true]);
  assertEquals([g("A72").band, g("A72").rail], [false, true], "A72 står i kolumnen Rail mounting");
  assertEquals([g("A72H").band, g("A72H").rail], [false, true]);
  assertEquals([g("A79W").band, g("A79W").rail], [false, true]);
  assertEquals([g("M9BW").band, g("M9BW").rail], [true, true]);
  assertEquals(cj2LeadAvail(g("M9N"), "Z"), "O", "5 m på beställning för M9-familjen");
  assertEquals(cj2LeadAvail(g("M9N"), "N"), "-");
  assertEquals(cj2LeadAvail(g("H7C"), "M"), "-", "1 m finns inte för kontaktgivarna");
  assertEquals(cj2LeadAvail(g("H7C"), "N"), "S");
  assertEquals(cj2LeadAvail(g("M9NA"), ""), "O", "0,5 m på beställning för de vattentäta");
  assertEquals(cj2LeadAvail(g("M9NA"), "L"), "S");
  assertEquals(cj2LeadAvail(g("A72"), "Z"), "-");
  assertEquals(cj2LeadAvail(g("A93"), "Z"), "S");
  assertEquals(CJ2_LEADS.length, 4);
  for (const sw of CJ2_SWITCHES) assertEquals(sw.leads.length, 5, sw.code);
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = cj2BuildCode;
  assertEquals(b({ bore: "6", mounting: "B", stroke_mm: 30, cushion: true }), null, "ø6 bara gummi");
  assertEquals(b({ bore: "6", mounting: "D", stroke_mm: 30 }), null, "gaffelfäste ø10/16");
  assertEquals(b({ bore: "6", mounting: "B", stroke_mm: 30, rod_end: "V" }), null, "knäled ø10/16");
  assert(b({ bore: "6", mounting: "B", stroke_mm: 30, rod_end: "T" }));
  assertEquals(b({ bore: "6", mounting: "B", stroke_mm: 30, magnet: true, switch_mount: "A" }), null, "ø6 bara band");
  assertEquals(b({ bore: "16", mounting: "D", stroke_mm: 30, port: "R" }), null, "porten fast med D");
  assertEquals(b({ bore: "16", mounting: "E", stroke_mm: 30, port: "R" }), null, "porten fast med E");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, pivot: "N" }), null, "pivot bara med D");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, switch_mount: "B" }), null, "givarfäste utan magnet");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, magnet: true }), null, "magnet utan givarfäste");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, magnet: true, switch_mount: "A", switch: "H7C" }), null);
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, magnet: true, switch_mount: "B", switch: "A72" }), null);
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, magnet: true, switch_mount: "B", switch: "M9BW", lead: "N" }), null, "N bara kontaktgivare");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, magnet: true, switch_mount: "B", switch: "H7C", lead: "M" }), null);
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, lead: "L" }), null);
  assertEquals(b({ bore: "6", mounting: "B", stroke_mm: 201 }), null);
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 401 }), null);
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, cushion: true, mto: "XC22" }), null);
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, magnet: true, switch_mount: "B", switch: "M9BW", mto: "XB6" }), null);
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, mto: "XB13" }), null, "XB13 är ø6");
  assertEquals(b({ bore: "6", mounting: "B", stroke_mm: 30, mto: "X446" }), null, "X446 är ø10/16 (sida 72)");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, mto: "X2838" }), null, "X2838 kräver D");
  assertEquals(b({ bore: "16", mounting: "D", stroke_mm: 30, magnet: true, switch_mount: "A", switch: "F79F", mto: "X2838" }), null, "X2838 inte med skena");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 30, mto: "X773" }), null, "X773 är enkelverkande");
});

Deno.test("fäste × borrning × port × pivot × kolvstångsände", () => {
  const matris: Record<string, boolean> = {};
  for (const m of CJ2_MOUNTINGS) for (const b of CJ2_BORES) matris[`${m.code}${b.code}`] = cj2BuildCode({ bore: b.code, mounting: m.code, stroke_mm: 30 }) !== null;
  assertEquals(Object.entries(matris).filter(([, ok]) => !ok).map(([k]) => k), ["D6"], "bara D6 saknas");
  for (const m of CJ2_MOUNTINGS) {
    assertEquals(cj2BuildCode({ bore: "16", mounting: m.code, stroke_mm: 30, port: "R" }) !== null, !m.port_fixed, `R × ${m.code}`);
    assertEquals(cj2BuildCode({ bore: "16", mounting: m.code, stroke_mm: 30, pivot: "N" }) !== null, m.code === "D", `N × ${m.code}`);
  }
  for (const re of CJ2_ROD_ENDS) {
    assertEquals(cj2BuildCode({ bore: "6", mounting: "B", stroke_mm: 30, rod_end: re.code }) !== null, !re.large_only, `ø6 × ${re.code}`);
  }
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildCj2DbRules();
function ctx(c: CJ2Config): Record<string, unknown> {
  return {
    bore: c.bore, mounting: c.mounting, stroke_mm: Number(c.stroke_mm || 0), magnet: c.magnet ? "D" : "", cushion: c.cushion ? "A" : "",
    port: c.port ?? "", pivot: c.pivot ?? "", rod_end: c.rod_end ?? "", switch_mount: c.switch_mount ?? "",
    switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  };
}
const kor = (c: CJ2Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: CJ2Config) => kor(c, "error");

function kontrollera(namn: string, prov: CJ2Config[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = cj2BuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst);
}

Deno.test("borrning × fäste × dämpning × port × pivot × kolvstångsände × slag", () => {
  const prov: CJ2Config[] = [];
  for (const b of CJ2_BORES) for (const m of CJ2_MOUNTINGS) for (const cushion of [false, true]) for (const port of ["", "R"])
    for (const pivot of ["", "N"]) for (const rod_end of ["", ...CJ2_ROD_ENDS.map((x) => x.code)]) for (const stroke_mm of [15, 60, 200, 201, 400, 401])
      prov.push({ bore: b.code, mounting: m.code, stroke_mm, cushion, port: port || undefined, pivot: pivot || undefined, rod_end: rod_end || undefined });
  kontrollera("A", prov, 5000);
});

Deno.test("borrning × magnet × givarfäste × givare × kabel × antal", () => {
  const prov: CJ2Config[] = [];
  for (const b of CJ2_BORES) for (const magnet of [false, true]) for (const mount of ["", "A", "B"])
    for (const sw of ["", ...CJ2_SWITCHES.map((s) => s.code)]) for (const lead of ["", ...CJ2_LEADS.map((l) => l.code)]) for (const count of ["", "S"])
      prov.push({ bore: b.code, mounting: "B", stroke_mm: 60, magnet, switch_mount: mount || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined });
  kontrollera("B", prov, 6000);
});

Deno.test("borrning × fäste × dämpning × givarfäste × givare × specialutförande", () => {
  const prov: CJ2Config[] = [];
  for (const b of CJ2_BORES) for (const m of ["B", "D"]) for (const cushion of [false, true]) for (const mount of ["", "A", "B"])
    for (const sw of ["", "M9BW", "F79F"]) for (const mto of ["", ...CJ2_MTO.map((x) => x.code)])
      prov.push({ bore: b.code, mounting: m, stroke_mm: 60, cushion, magnet: mount !== "", switch_mount: mount || undefined, switch: sw || undefined, mto: mto || undefined });
  kontrollera("C", prov, 1500);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: CJ2Config) => ({ ...ctx(c), stroke_mm: c.stroke_mm });
  for (const c of [
    { bore: "16", mounting: "D", stroke_mm: 60, magnet: true, pivot: "N", rod_end: "W", switch_mount: "B", switch: "M9BW" },
    { bore: "16", mounting: "B", stroke_mm: 60 },
    { bore: "16", mounting: "B", stroke_mm: 60, magnet: true, switch_mount: "B" },
    { bore: "10", mounting: "L", stroke_mm: 45, cushion: true, port: "R", rod_end: "T", mto: "XC51" },
    { bore: "10", mounting: "B", stroke_mm: 100, magnet: true, switch_mount: "A", switch: "F79F", lead: "L", count: "S" },
  ] as CJ2Config[]) {
    assertEquals(fillOrderCodeTemplate(CJ2_ORDER_CODE_TEMPLATE, val(c), new Set(["bore", "mounting", "stroke_mm"])), cj2BuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ bore: "6", mounting: "B", stroke_mm: 30, magnet: true, switch_mount: "A", switch: "M9BW" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("bandmontage"), f[0]);
  assert(kor({ bore: "16", mounting: "B", stroke_mm: 60 }, "info").some((m) => m.includes("101 N")));
  assert(kor({ bore: "16", mounting: "B", stroke_mm: 61 }, "info").some((m) => m.includes("mellanslag")));
  assertEquals(kor({ bore: "16", mounting: "B", stroke_mm: 60 }, "info").filter((m) => m.includes("mellanslag")), []);
  const v1 = kor({ bore: "16", mounting: "B", stroke_mm: 10, magnet: true, switch_mount: "B", switch: "M9BW" }, "warn");
  assert(v1.some((m) => m.includes("två givare") && m.includes("15 mm")), v1.join(" | "));
  const v2 = kor({ bore: "16", mounting: "B", stroke_mm: 10, magnet: true, switch_mount: "B", switch: "M9BW", count: "S" }, "warn");
  assertEquals(v2.filter((m) => m.includes("Minsta slag")), [], "10 mm räcker för en M9BW på band");
  const v3 = kor({ bore: "16", mounting: "B", stroke_mm: 60, magnet: true, switch_mount: "B", switch: "M9NA" }, "warn");
  assert(v3.some((m) => m.includes("0,5 m") && m.includes("beställning")), v3.join(" | "));
  const v4 = kor({ bore: "16", mounting: "B", stroke_mm: 60, magnet: true, switch_mount: "B", switch: "M9NA", lead: "L" }, "warn");
  assertEquals(v4, []);
  const tom = { bore: "", mounting: "", stroke_mm: 0 } as CJ2Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

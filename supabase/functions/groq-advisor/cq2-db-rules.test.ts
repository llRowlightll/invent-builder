/**
 * CQ2-reglerna som faktiskt körs, mot modellen som faktiskt bygger koden.
 *
 * Invarianten: en kombination modellen vägrar bygga MÅSTE ge minst ett fel,
 * och en den bygger får inte ge något. CQ2 har femton positioner, så
 * kombinationerna räknas upp i fem riktade delmängder i stället för en enda
 * produkt.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { buildCq2DbRules } from "../../../src/lib/catalog/cq2-db-rules.ts";
import {
  CQ2_BODY_OPTIONS,
  CQ2_BORES,
  CQ2_LEADS,
  CQ2_MOUNTINGS,
  CQ2_MTO,
  CQ2_PORTS,
  CQ2_ROD_BRACKETS,
  CQ2_SWITCHES,
  type Cq2Config,
  cq2BuildCode,
} from "../../../src/lib/catalog/cq2.ts";

const REGLER = buildCq2DbRules();
const FALT = ["bore", "action", "mounting", "air_hydro", "port", "stroke_mm", "body", "magnet", "groove", "bolt", "bracket", "switch", "lead", "count", "mto"];

/** Kontexten som configurator.$family.tsx bygger: tal för numeriska fält, "" för ovalda. */
function ctx(c: Cq2Config): Record<string, unknown> {
  return {
    bore: c.bore, action: c.action, mounting: c.mounting ?? "", air_hydro: c.air_hydro ? "H" : "", port: c.port ?? "",
    stroke_mm: Number(c.stroke_mm || 0), body: c.body ?? "", magnet: c.magnet ? "D" : "", groove: c.groove ? "Z" : "",
    bolt: c.bolt ? "L" : "", bracket: c.bracket ?? "", switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  };
}
function kor(c: Cq2Config, niva: string): string[] {
  const k = ctx(c);
  return REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, k) === true).map((r) => r.message_sv);
}
const fel = (c: Cq2Config) => kor(c, "error");

function kontrollera(namn: string, prov: Cq2Config[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = cq2BuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst, `${namn}: bara ${prov.length} kombinationer`);
}

const z = (bore: string) => Number(bore) >= 32;

Deno.test("varje regel läser bara fält som finns", () => {
  const falt = new Set(FALT);
  const okanda = new Set<string>();
  const ga = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(ga);
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (typeof o.var === "string" && !falt.has(o.var)) okanda.add(o.var);
    Object.values(o).forEach(ga);
  };
  REGLER.forEach((r) => ga(r.if_json));
  assertEquals([...okanda], []);
});

Deno.test("borrning × verkan × luft-hydraulik × gänga × kropp × slag", () => {
  const prov: Cq2Config[] = [];
  for (const b of CQ2_BORES) for (const action of ["D", "S", "T"]) for (const hydro of [false, true])
    for (const port of ["", ...CQ2_PORTS.map((p) => p.code)]) for (const body of ["", ...CQ2_BODY_OPTIONS.map((x) => x.code)])
      for (const stroke_mm of [1, 5, 10, 20, 30, 57, 75, 100, 101])
        prov.push({ bore: b.code, action, stroke_mm, mounting: "B", air_hydro: hydro, port: port || undefined, body: body || undefined, groove: z(b.code) });
  kontrollera("A", prov, 8000);
});

Deno.test("borrning × magnet × spår × givare × antal × slag", () => {
  const prov: Cq2Config[] = [];
  for (const b of CQ2_BORES) for (const magnet of [false, true]) for (const groove of [false, true])
    for (const sw of ["", ...CQ2_SWITCHES.map((s) => s.code)]) for (const count of ["", "S"]) for (const stroke_mm of [5, 15, 30])
      prov.push({ bore: b.code, action: "D", stroke_mm, mounting: "B", magnet, groove, switch: sw || undefined, count: count || undefined });
  kontrollera("B", prov, 5000);
});

Deno.test("fäste × bultar × kropp × stångfäste", () => {
  const prov: Cq2Config[] = [];
  for (const m of CQ2_MOUNTINGS) for (const bolt of [false, true]) for (const body of ["", ...CQ2_BODY_OPTIONS.map((x) => x.code)])
    for (const bracket of ["", ...CQ2_ROD_BRACKETS.map((x) => x.code)])
      prov.push({ bore: "32", action: "D", stroke_mm: 30, mounting: m.code, groove: true, bolt, body: body || undefined, bracket: bracket || undefined });
  kontrollera("C", prov, 500);
});

Deno.test("borrning × verkan × luft-hydraulik × givare × specialutförande", () => {
  const prov: Cq2Config[] = [];
  for (const b of CQ2_BORES) for (const action of ["D", "S", "T"]) for (const hydro of [false, true]) for (const medGivare of [false, true])
    for (const mto of ["", ...CQ2_MTO.map((m) => m.code)]) {
      const stroke_mm = action === "D" ? 10 : b.sa_standard_strokes?.[0] ?? 10;
      prov.push({ bore: b.code, action, stroke_mm, mounting: "B", air_hydro: hydro, magnet: medGivare, groove: medGivare || z(b.code), switch: medGivare ? "M9BW" : undefined, mto: mto || undefined });
    }
  kontrollera("D", prov, 3000);
});

Deno.test("givare × kabel × antal", () => {
  const prov: Cq2Config[] = [];
  for (const sw of ["", ...CQ2_SWITCHES.map((s) => s.code)]) for (const lead of ["", ...CQ2_LEADS.map((l) => l.code)]) for (const count of ["", "S"])
    prov.push({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", magnet: true, groove: true, switch: sw || undefined, lead: lead || undefined, count: count || undefined });
  kontrollera("E", prov, 200);
});

Deno.test("varningarna för minsta givarslag följer sida 958", () => {
  // D-M9BW: 15 mm med två givare; en givare 15 mm. D-M9BV: 5/5. D-A93: 10/10.
  const bas: Cq2Config = { bore: "32", action: "D", stroke_mm: 10, mounting: "B", magnet: true, groove: true };
  assert(kor({ ...bas, switch: "M9BW" }, "warn").some((m) => m.includes("15 mm")));
  assertEquals(kor({ ...bas, switch: "M9BW", stroke_mm: 15 }, "warn"), []);
  assertEquals(kor({ ...bas, switch: "M9BV", stroke_mm: 5 }, "warn"), []);
  assert(kor({ ...bas, switch: "M9BV", stroke_mm: 4 }, "warn").length > 0);
  assert(kor({ ...bas, switch: "A93V", stroke_mm: 7 }, "warn").some((m) => m.includes("två givare")));
  assertEquals(kor({ ...bas, switch: "A93V", stroke_mm: 7, count: "S" }, "warn"), []);
  assertEquals(fel({ ...bas, switch: "M9BW" }), [], "ett kort slag är en varning, inte ett fel");
});

Deno.test("meddelandena säger vad som gäller", () => {
  const f1 = fel({ bore: "32", action: "D", stroke_mm: 30, mounting: "B" });
  assertEquals(f1.length, 1, f1.join(" | "));
  assert(f1[0].includes("ø32–100 har alltid givarspåret Z"), f1[0]);
  const f2 = fel({ bore: "20", action: "D", stroke_mm: 30, mounting: "B", groove: true });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("CQ2B20-30D, inte CQ2B20-30DZ"), f2[0]);
  const f3 = fel({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true, switch: "M9BW" });
  assertEquals(f3.length, 1, f3.join(" | "));
  assert(f3[0].includes("CDQ2"), f3[0]);
  const f4 = fel({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true, bracket: "W" });
  assertEquals(f4.length, 1, f4.join(" | "));
  assert(f4[0].includes("kroppsoption M"), f4[0]);
  const f5 = fel({ bore: "12", action: "D", stroke_mm: 31, mounting: "B" });
  assertEquals(f5.length, 1, f5.join(" | "));
  assert(f5[0].includes("30 mm"), f5[0]);
});

Deno.test("råden är info", () => {
  const i = kor({ bore: "32", action: "D", stroke_mm: 30, mounting: "B", groove: true }, "info");
  assert(i.some((m) => m.includes("402 N")), i.join(" | "));
  assert(kor({ bore: "32", action: "S", stroke_mm: 10, mounting: "B", groove: true }, "info").some((m) => m.includes("0,17 MPa")));
  assert(kor({ bore: "32", action: "D", stroke_mm: 30, mounting: "L", groove: true }, "info").some((m) => m.includes("levereras löst")));
});

Deno.test("en tom konfiguration larmar inte", () => {
  const tom = { bore: "", action: "", stroke_mm: 0 } as Cq2Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(fel({ bore: "32", action: "", stroke_mm: 0 } as Cq2Config), [], "Z-felet väntar tills slaget är satt");
  assertEquals(fel({ bore: "32", action: "D", stroke_mm: 0, mounting: "B", magnet: true } as Cq2Config), []);
});

Deno.test("varje regel har både svensk och engelsk text, ingen två gånger", () => {
  assert(REGLER.length >= 40, `bara ${REGLER.length} regler`);
  assertEquals(REGLER.filter((r) => !r.message_sv?.trim() || !r.message_en?.trim()).length, 0);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const nycklar = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(nycklar.filter((n, i) => nycklar.indexOf(n) !== i), []);
});

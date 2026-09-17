/**
 * JMHZ2-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel JMHZ2-16D-M9BW (sida 9), modelltabellen (sida 10),
 * givartabellens V/v (sida 9), -X50 (sida 10), -X6900A/B utan givarposition
 * (sida 20), -X7460 med högst två givare (sida 21), MHZ2-motsvarigheterna
 * (sida 4).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildJmhz2DbRules } from "../../../src/lib/catalog/jmhz2-db-rules.ts";
import {
  JMHZ2_ACTIONS,
  JMHZ2_BORES,
  JMHZ2_COUNTS,
  JMHZ2_FINGERS,
  JMHZ2_LEADS,
  JMHZ2_MTO,
  JMHZ2_ORDER_CODE_TEMPLATE,
  JMHZ2_SOURCE,
  JMHZ2_SWITCHES,
  type JMHZ2Config,
  jmhz2BuildCode,
  jmhz2ParseCode,
} from "../../../src/lib/catalog/jmhz2.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(JMHZ2_SOURCE.file, "smc-kat-mhz2.pdf");
  assertEquals(JMHZ2_BORES.map((b) => b.bore_mm), [8, 12, 16, 20]);
  assertEquals(JMHZ2_BORES.map((b) => b.force_d), [[7.8, 10.5], [17.5, 23.3], [32.7, 43.5], [54.2, 72.2]], "sida 10");
  assertEquals(JMHZ2_BORES.map((b) => b.force_no), [4.5, 11.2, 22.9, 38.3]);
  assertEquals(JMHZ2_BORES.map((b) => b.force_nc), [7.8, 19.3, 36.0, 57.4]);
  assertEquals(JMHZ2_BORES.map((b) => b.stroke_mm), [4, 6, 10, 14]);
  assertEquals(JMHZ2_BORES.map((b) => b.weight_g), [[31, 35], [65, 72], [128, 142], [240, 270]]);
  assertEquals(JMHZ2_BORES.map((b) => b.pressure_d[0]), [0.15, 0.1, 0.1, 0.1]);
  assertEquals(JMHZ2_BORES.map((b) => b.pressure_s[0]), [0.35, 0.3, 0.25, 0.25]);
  assertEquals(JMHZ2_BORES.map((b) => b.mhz2), ["10", "16", "20", "25"], "sida 4");
  assertEquals(JMHZ2_SWITCHES.length, 18, "nio typer i två riktningar");
  assertEquals(JMHZ2_SWITCHES.find((g) => g.code === "M9BAV")!.leads, "OOSO");
  assertEquals(JMHZ2_MTO.map((x) => x.code), ["X50", "X6900A", "X6900B", "X7460"]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[JMHZ2Config, string]> = [
    [{ bore: "16", action: "D", switch: "M9BW" }, "JMHZ2-16D-M9BW"],
    [{ bore: "8", action: "D", mto: "X6900A" }, "JMHZ2-8D-X6900A"],
    [{ bore: "8", action: "D", switch: "M9BW", mto: "X7460" }, "JMHZ2-8D-M9BW-X7460"],
    [{ bore: "12", action: "S", finger: "1" }, "JMHZ2-12S1"],
    [{ bore: "20", action: "C", finger: "2", switch: "M9NAV", lead: "Z", count: "4" }, "JMHZ2-20C2-M9NAVZ4"],
    [{ bore: "16", action: "D", mto: "X50" }, "JMHZ2-16D-X50"],
    [{ bore: "8", action: "D", switch: "M9NW", lead: "L", count: "S", mto: "X7460" }, "JMHZ2-8D-M9NWLS-X7460"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(jmhz2BuildCode(c), kod);
    assertEquals(jmhz2BuildCode(jmhz2ParseCode(kod)!.config), kod, kod);
  }
  assertEquals(jmhz2ParseCode("MHZ2-16D-M9BW"), null, "standardserien");
  assertEquals(jmhz2ParseCode("JMHZ2-10D"), null, "ø10 är MHZ2");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = jmhz2BuildCode;
  assertEquals(b({ bore: "8", action: "D", switch: "M9BW", mto: "X50" }), null, "utan magnet");
  assertEquals(b({ bore: "8", action: "D", switch: "M9BW", mto: "X6900A" }), null, "ingen givarposition, sida 20");
  assertEquals(b({ bore: "8", action: "D", switch: "M9BW", count: "3", mto: "X7460" }), null, "högst två, sida 21");
  assert(b({ bore: "8", action: "D", switch: "M9BW", count: "S", mto: "X7460" }));
  assertEquals(b({ bore: "8", action: "D", lead: "L" }), null, "kabel utan givare");
  assertEquals(b({ bore: "8", action: "D", switch: "F8N" }), null, "F8 finns inte här");
  assertEquals(b({ bore: "8", action: "D", finger: "N" }), null, "MHZ2:s smala typ");
  assertEquals(b({ bore: "8", action: "D", mto: "X46" }), null);
  assertEquals(b({ bore: "6", action: "D" }), null);
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildJmhz2DbRules();
function ctx(c: JMHZ2Config): Record<string, unknown> {
  return { bore: c.bore, action: c.action, finger: c.finger ?? "", switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "" };
}
const kor = (c: JMHZ2Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: JMHZ2Config) => kor(c, "error");

Deno.test("borrning × verkan × finger × givare × kabel × antal × special, uttömmande", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const b of JMHZ2_BORES) for (const a of JMHZ2_ACTIONS) for (const finger of ["", ...JMHZ2_FINGERS.map((f) => f.code)])
    for (const sw of ["", ...JMHZ2_SWITCHES.map((g) => g.code)]) for (const lead of ["", ...JMHZ2_LEADS.map((l) => l.code)]) for (const count of ["", ...JMHZ2_COUNTS.map((x) => x.code)]) for (const mto of ["", ...JMHZ2_MTO.map((x) => x.code)]) {
      const c: JMHZ2Config = { bore: b.code, action: a.code, finger: finger || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined };
      n++;
      const kod = jmhz2BuildCode(c);
      const f = fel(c);
      if (!kod && f.length === 0) missade.push(JSON.stringify(c));
      if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
    }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assert(n >= 50000, `${n}`);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { bore: "16", action: "D", switch: "M9BW" },
    { bore: "8", action: "D", mto: "X6900A" },
    { bore: "8", action: "D", switch: "M9BW", mto: "X7460" },
    { bore: "20", action: "C", finger: "2", switch: "M9NAV", lead: "Z", count: "4" },
  ] as JMHZ2Config[]) {
    assertEquals(fillOrderCodeTemplate(JMHZ2_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["bore", "action"])), jmhz2BuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ bore: "8", action: "D", switch: "M9BW", mto: "X6900A" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("X6900"), f[0]);
  const f2 = fel({ bore: "8", action: "D", switch: "M9BW", count: "3", mto: "X7460" });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("X7460"), f2[0]);
  const v = kor({ bore: "8", action: "D", switch: "M9BAV" }, "warn");
  assert(v.some((m) => m.includes("på beställning")), v.join(" | "));
  assert(v.some((m) => m.includes("vattentätheten")), v.join(" | "));
  assertEquals(kor({ bore: "8", action: "D", switch: "M9BW", lead: "L" }, "warn"), []);
  assert(kor({ bore: "16", action: "D" }, "info").some((m) => m.includes("32,7 N") && m.includes("MHZ2-20")));
  assert(kor({ bore: "8", action: "C" }, "info").some((m) => m.includes("7,8 N inre")));
  const tom = { bore: "", action: "" } as JMHZ2Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

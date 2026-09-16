/**
 * MHC2-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel MHC2-20D-M9BW (sida 807), modelltabellen
 * MHC2-10D…MHC2-25S (sida 808), givartabellens ●/○ (sida 807),
 * specialutförandena (sida 808).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildMhc2DbRules } from "../../../src/lib/catalog/mhc2-db-rules.ts";
import {
  MHC2_ACTIONS,
  MHC2_BORES,
  MHC2_LEADS,
  MHC2_MTO,
  MHC2_ORDER_CODE_TEMPLATE,
  MHC2_SOURCE,
  MHC2_SWITCHES,
  type MHC2Config,
  mhc2BuildCode,
  mhc2ParseCode,
} from "../../../src/lib/catalog/mhc2.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(MHC2_SOURCE.file, "smc-kat-mhc2.pdf");
  assertEquals(MHC2_BORES.map((b) => b.bore_mm), [10, 16, 20, 25]);
  assertEquals(MHC2_BORES.map((b) => b.moment_nm.D), [0.10, 0.39, 0.70, 1.36], "sida 808");
  assertEquals(MHC2_BORES.map((b) => b.moment_nm.S), [0.070, 0.31, 0.54, 1.08]);
  assertEquals(MHC2_BORES.map((b) => b.weight_g.S), [39, 92, 183, 316]);
  assertEquals(MHC2_ACTIONS.map((a) => a.pressure_mpa), [[0.1, 0.6], [0.25, 0.6]]);
  assertEquals(MHC2_SWITCHES.length, 18, "nio typer i två anslutningsriktningar");
  assertEquals(MHC2_SWITCHES.find((g) => g.code === "M9BW")!.leads, "SSSO");
  assertEquals(MHC2_SWITCHES.find((g) => g.code === "M9BAV")!.leads, "OOSO");
  assertEquals(MHC2_MTO.length, 11, "sida 808");
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[MHC2Config, string]> = [
    [{ bore: "20", action: "D", switch: "M9BW" }, "MHC2-20D-M9BW"],
    [{ bore: "10", action: "S" }, "MHC2-10S"],
    [{ bore: "25", action: "D", switch: "M9NW", lead: "L", count: "S", mto: "X4" }, "MHC2-25D-M9NWLS-X4"],
    [{ bore: "16", action: "D", switch: "M9BAV", lead: "Z" }, "MHC2-16D-M9BAVZ"],
    [{ bore: "16", action: "S", mto: "X50" }, "MHC2-16S-X50"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(mhc2BuildCode(c), kod);
    assertEquals(mhc2BuildCode(mhc2ParseCode(kod)!.config), kod, kod);
  }
  assertEquals(mhc2ParseCode("MHC2-20-D"), null, "den gamla mallen");
  assertEquals(mhc2ParseCode("MHC2-20D-M9BW-X50"), null, "givare utan magnet");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = mhc2BuildCode;
  assertEquals(b({ bore: "32", action: "D" }), null, "ø32 finns inte");
  assertEquals(b({ bore: "20", action: "W" }), null);
  assertEquals(b({ bore: "20", action: "D", lead: "L" }), null, "kabel utan givare");
  assertEquals(b({ bore: "20", action: "D", count: "S" }), null, "antal utan givare");
  assertEquals(b({ bore: "20", action: "D", switch: "M9BW", count: "3" }), null, "bara S");
  assertEquals(b({ bore: "20", action: "D", switch: "A93" }), null, "reed finns inte i tabellen");
  assertEquals(b({ bore: "20", action: "D", switch: "M9BW", mto: "X50" }), null, "utan magnet");
  assertEquals(b({ bore: "20", action: "D", mto: "XC4" }), null, "MB:s specialutförande");
  assert(b({ bore: "20", action: "D", switch: "M9NAV", lead: "M" }), "på beställning men går");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildMhc2DbRules();
function ctx(c: MHC2Config): Record<string, unknown> {
  return { bore: c.bore, action: c.action, switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "" };
}
const kor = (c: MHC2Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: MHC2Config) => kor(c, "error");

Deno.test("alla kombinationer: reglerna säger nej exakt när modellen gör det", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const b of MHC2_BORES) for (const a of MHC2_ACTIONS) for (const sw of ["", ...MHC2_SWITCHES.map((g) => g.code)])
    for (const lead of ["", ...MHC2_LEADS.map((l) => l.code)]) for (const count of ["", "S"]) for (const mto of ["", ...MHC2_MTO.map((x) => x.code)]) {
      const c: MHC2Config = { bore: b.code, action: a.code, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined };
      n++;
      const kod = mhc2BuildCode(c);
      const f = fel(c);
      if (!kod && f.length === 0) missade.push(JSON.stringify(c));
      if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
    }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assert(n >= 14000, String(n));
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { bore: "20", action: "D", switch: "M9BW" },
    { bore: "10", action: "S" },
    { bore: "25", action: "D", switch: "M9NW", lead: "L", count: "S", mto: "X4" },
    { bore: "16", action: "S", mto: "X50" },
  ] as MHC2Config[]) {
    assertEquals(fillOrderCodeTemplate(MHC2_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["bore", "action"])), mhc2BuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ bore: "20", action: "D", switch: "M9BW", mto: "X50" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("magnet"), f[0]);
  const v = kor({ bore: "20", action: "D", switch: "M9BAV" }, "warn");
  assert(v.some((m) => m.includes("på beställning")), v.join(" | "));
  assert(v.some((m) => m.includes("vattentätheten")), v.join(" | "));
  assertEquals(kor({ bore: "20", action: "D", switch: "M9BW", lead: "L" }, "warn"), []);
  assert(kor({ bore: "20", action: "D", switch: "M9BW", lead: "Z" }, "warn").some((m) => m.includes("5 m")));
  assert(kor({ bore: "25", action: "S" }, "info").some((m) => m.includes("1,08 N·m") && m.includes("316 g")));
  assert(kor({ bore: "10", action: "D", switch: "M9N" }, "info").some((m) => m.includes("4°")));
  const tom = { bore: "", action: "" } as MHC2Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

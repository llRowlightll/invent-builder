/**
 * CJP-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel CJPB16-15H4Z-T (sida 1), specifikationstabellen
 * (sida 1), teoretisk kraft och fjäderkraft (sida 2), -XC17:s regel om
 * gängan (sida 7) — avskrivna här igen.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildCjpDbRules } from "../../../src/lib/catalog/cjp-db-rules.ts";
import {
  CJP_BORES,
  CJP_CAPS,
  CJP_MOUNTINGS,
  CJP_MTO,
  CJP_NIPPLES,
  CJP_ORDER_CODE_TEMPLATE,
  CJP_SOURCE,
  CJP_STROKES,
  type CJPConfig,
  cjpBuildCode,
  cjpParseCode,
} from "../../../src/lib/catalog/cjp.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(CJP_SOURCE.file, "smc-kat-cjp.pdf");
  assertEquals(CJP_BORES.map((b) => b.bore_mm), [4, 6, 10, 16]);
  assertEquals(CJP_STROKES, [5, 10, 15]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[CJPConfig, string]> = [
    [{ bore: "16", mounting: "B", stroke_mm: 15, nipple: "H4", cap: "T" }, "CJPB16-15H4Z-T"],
    [{ bore: "10", mounting: "S", stroke_mm: 10 }, "CJPS10-10Z"],
    [{ bore: "6", mounting: "B", stroke_mm: 5, rod_thread: "B" }, "CJPB6-5Z-B"],
    [{ bore: "4", mounting: "B", stroke_mm: 15, cap: "U" }, "CJPB4-15Z-U"],
    [{ bore: "16", mounting: "B", stroke_mm: 15, nipple: "H6", mto: "XC17" }, "CJPB16-15H6Z-XC17"],
    [{ bore: "10", mounting: "S", stroke_mm: 15, rod_thread: "B", mto: "XC22" }, "CJPS10-15Z-B-XC22"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(cjpBuildCode(c), kod);
    assertEquals(cjpBuildCode(cjpParseCode(kod)!.config), kod);
  }
  assertEquals(cjpParseCode("CJPB16-20Z"), null, "bara 5/10/15");
  assertEquals(cjpParseCode("CJPB16-15Z-BT"), null, "kåpa kräver gänga");
});

Deno.test("specifikationerna följer sida 1–2", () => {
  const b = (k: string) => CJP_BORES.find((x) => x.code === k)!;
  assertEquals(CJP_BORES.map((x) => x.min_pressure_mpa), [0.3, 0.2, 0.15, 0.15]);
  assertEquals(CJP_BORES.map((x) => x.force_out_05_n), [3.48, 10.2, 33.3, 84.7]);
  assertEquals(CJP_BORES.map((x) => x.force_in_n), [1.0, 1.42, 2.45, 5.04]);
  assertEquals([b("4").nipple_ok, b("4").mto_ok], [false, false], "ø4 utan nippel och special");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = cjpBuildCode;
  assertEquals(b({ bore: "16", mounting: "S", stroke_mm: 15, nipple: "H4" }), null, "nippel bara panel");
  assertEquals(b({ bore: "4", mounting: "B", stroke_mm: 15, nipple: "H4" }), null, "nippel inte ø4");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 15, rod_thread: "B", cap: "T" }), null, "kåpa kräver gänga");
  assertEquals(b({ bore: "4", mounting: "B", stroke_mm: 15, mto: "XC22" }), null, "special inte ø4");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 15, rod_thread: "B", mto: "XC17" }), null, "B skrivs inte med XC17");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 15, cap: "T", mto: "XC17" }), null, "ingen kåpa med XC17");
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 20 }), null);
  assertEquals(b({ bore: "16", mounting: "B", stroke_mm: 7 }), null);
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildCjpDbRules();
function ctx(c: CJPConfig): Record<string, unknown> {
  return {
    bore: c.bore, mounting: c.mounting, stroke_mm: Number(c.stroke_mm || 0), nipple: c.nipple ?? "",
    rod_thread: c.rod_thread ?? "", cap: c.cap ?? "", mto: c.mto ?? "",
  };
}
const kor = (c: CJPConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: CJPConfig) => kor(c, "error");

Deno.test("alla kombinationer: reglerna säger nej exakt när modellen gör det", () => {
  const prov: CJPConfig[] = [];
  for (const b of CJP_BORES) for (const m of CJP_MOUNTINGS) for (const stroke_mm of [5, 7, 10, 15, 20])
    for (const nipple of ["", ...CJP_NIPPLES.map((n) => n.code)]) for (const rod_thread of ["", "B"])
      for (const cap of ["", ...CJP_CAPS.map((x) => x.code)]) for (const mto of ["", ...CJP_MTO.map((x) => x.code)])
        prov.push({ bore: b.code, mounting: m.code, stroke_mm, nipple: nipple || undefined, rod_thread: rod_thread || undefined, cap: cap || undefined, mto: mto || undefined });
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = cjpBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assertEquals(prov.length, 4 * 2 * 5 * 3 * 2 * 3 * 3);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: CJPConfig) => ({ ...ctx(c), stroke_mm: c.stroke_mm }) as Record<string, string | number>;
  for (const c of [
    { bore: "16", mounting: "B", stroke_mm: 15, nipple: "H4", cap: "T" },
    { bore: "10", mounting: "S", stroke_mm: 10 },
    { bore: "6", mounting: "B", stroke_mm: 5, rod_thread: "B", mto: "XC22" },
    { bore: "16", mounting: "B", stroke_mm: 15, mto: "XC17" },
  ] as CJPConfig[]) {
    assertEquals(fillOrderCodeTemplate(CJP_ORDER_CODE_TEMPLATE, val(c), new Set(["bore", "mounting", "stroke_mm"])), cjpBuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const f = fel({ bore: "16", mounting: "S", stroke_mm: 15, nipple: "H4" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("panelmontaget B"), f[0]);
  assert(kor({ bore: "16", mounting: "B", stroke_mm: 15 }, "info").some((m) => m.includes("84,7 N")));
  const tom = { bore: "", mounting: "", stroke_mm: 0 } as CJPConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

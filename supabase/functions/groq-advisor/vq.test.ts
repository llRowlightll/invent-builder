/**
 * VQ-modellen (VQ1000/2000 plug-in-ventil och VQ2000 på underplatta) och
 * dess regler mot katalogen.
 *
 * Facit: exemplen VQ1100-51 och VQ1200-51 (sida 367), VQ2100-5W1-02 (sida
 * 403), tabellerna för tätning, tillval, spänning, ljus, manöver och kapsling
 * (sida 367, 371), data sida 375.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildVqDbRules } from "../../../src/lib/catalog/vq-db-rules.ts";
import {
  VQ_ACTUATIONS,
  VQ_FUNCTIONS,
  VQ_ORDER_CODE_TEMPLATE,
  VQ_OVERRIDES,
  VQ_SEALS,
  VQ_SERIES,
  VQ_SOURCE,
  VQ_THREADS,
  VQ_VOLTAGES,
  type VQConfig,
  vqBuildCode,
  vqParseCode,
} from "../../../src/lib/catalog/vq.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(VQ_SOURCE.file, "smc-kat-vq1000.pdf");
  assertEquals(VQ_SERIES.map((s) => s.code), ["1", "2"]);
  assertEquals(VQ_ACTUATIONS.map((a) => a.code), ["1", "2", "3", "4", "5", "A", "B", "C"]);
  assertEquals(VQ_ACTUATIONS.find((a) => a.code === "3")!.min_mpa, [0.1, 0.2], "sida 375");
  assertEquals(VQ_FUNCTIONS.map((f) => f.code), ["B", "K", "N", "BN", "KN", "R", "BR", "KR", "NR", "BNR", "KNR"], "bokstavsordning, B och K inte ihop");
  assertEquals(VQ_VOLTAGES.filter((v) => v.fl_kit_only).map((v) => v.code), ["2", "4"]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[VQConfig, string]> = [
    [{ series: "1", actuation: "1", seal: "0", voltage: "5" }, "VQ1100-51"],
    [{ series: "1", actuation: "2", seal: "0", voltage: "5" }, "VQ1200-51"],
    [{ series: "1", actuation: "3", seal: "0", voltage: "5" }, "VQ1300-51"],
    [{ series: "2", actuation: "1", seal: "0", voltage: "5", enclosure: "W", port: "02" }, "VQ2100-5W1-02"],
    [{ series: "2", actuation: "2", seal: "0", func: "KR", voltage: "6", override: "D", enclosure: "W", port: "02", thread: "F", ce: "Q" }, "VQ2200KR-6DW1-02F-Q"],
    [{ series: "1", actuation: "A", seal: "1", func: "BN", voltage: "6", override: "C", ce: "Q" }, "VQ1A01BN-6C1-Q"],
    [{ series: "1", actuation: "1", seal: "0", func: "R", voltage: "2" }, "VQ1100R-21"],
    [{ series: "1", actuation: "5", seal: "1", voltage: "1", light: "E", override: "B" }, "VQ1501-1EB1"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(vqBuildCode(c), kod);
    assertEquals(vqBuildCode(vqParseCode(kod)!.config), kod, kod);
  }
  assertEquals(vqParseCode("VQ1000-1-1-24-G"), null, "den gamla mallen");
  assertEquals(vqParseCode("VQ1101N-5G"), null, "den gamla produktraden");
  assertEquals(vqParseCode("VQ1100-5"), null, "den fasta ettan saknas");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = vqBuildCode;
  const bas: VQConfig = { series: "1", actuation: "1", seal: "0", voltage: "5" };
  assertEquals(b({ ...bas, actuation: "A" }), null, "A bara gummi");
  assert(b({ ...bas, actuation: "A", seal: "1" }));
  assertEquals(b({ ...bas, seal: "1", func: "K" }), null, "K bara metall");
  assertEquals(b({ ...bas, func: "BK" }), null, "B och K inte ihop");
  assertEquals(b({ ...bas, func: "NB" }), null, "fel ordning");
  assertEquals(b({ ...bas, func: "B", voltage: "1" }), null, "B bara DC");
  assertEquals(b({ ...bas, func: "KN", voltage: "3" }), null);
  assert(b({ ...bas, func: "R", voltage: "1" }), "R med AC");
  assertEquals(b({ ...bas, actuation: "B", seal: "1", func: "R" }), null, "R inte för A/B/C");
  assertEquals(b({ ...bas, func: "N", light: "E" }), null, "N och E");
  assert(b({ ...bas, func: "B", light: "E" }));
  assertEquals(b({ ...bas, enclosure: "W" }), null, "W bara VQ2000");
  assertEquals(b({ ...bas, port: "02" }), null, "underplatta bara VQ2000");
  assertEquals(b({ ...bas, series: "2", thread: "F" }), null, "gänga utan underplatta");
  assertEquals(b({ ...bas, series: "2", port: "02", voltage: "2" }), null, "200 VAC på underplatta kräver W");
  assert(b({ ...bas, series: "2", port: "02", voltage: "2", enclosure: "W" }));
  assertEquals(b({ ...bas, voltage: "1", ce: "Q" }), null, "Q bara DC");
  assertEquals(b({ ...bas, override: "E" }), null);
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildVqDbRules();
function ctx(c: VQConfig): Record<string, unknown> {
  return {
    series: c.series, actuation: c.actuation, seal: c.seal, func: c.func ?? "", voltage: c.voltage, light: c.light ?? "", override: c.override ?? "",
    enclosure: c.enclosure ?? "", port: c.port ?? "", thread: c.thread ?? "", ce: c.ce ?? "",
  };
}
const kor = (c: VQConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: VQConfig) => kor(c, "error");

Deno.test("alla kombinationer: reglerna säger nej exakt när modellen gör det", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const s of VQ_SERIES) for (const a of VQ_ACTUATIONS) for (const seal of VQ_SEALS) for (const fn of ["", ...VQ_FUNCTIONS.map((f) => f.code)])
    for (const v of VQ_VOLTAGES) for (const light of ["", "E"]) for (const ov of ["", VQ_OVERRIDES[2].code]) for (const enc of ["", "W"])
      for (const port of ["", "02"]) for (const thread of ["", VQ_THREADS[2].code]) for (const ce of ["", "Q"]) {
        const c: VQConfig = { series: s.code, actuation: a.code, seal: seal.code, func: fn || undefined, voltage: v.code, light: light || undefined, override: ov || undefined, enclosure: enc || undefined, port: port || undefined, thread: thread || undefined, ce: ce || undefined };
        n++;
        const kod = vqBuildCode(c);
        const f = fel(c);
        if (!kod && f.length === 0) missade.push(JSON.stringify(c));
        if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
      }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assert(n >= 70000, String(n));
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { series: "1", actuation: "1", seal: "0", voltage: "5" },
    { series: "2", actuation: "1", seal: "0", voltage: "5", enclosure: "W", port: "02" },
    { series: "2", actuation: "2", seal: "0", func: "KR", voltage: "6", override: "D", enclosure: "W", port: "02", thread: "F", ce: "Q" },
    { series: "1", actuation: "A", seal: "1", func: "BN", voltage: "6", override: "C", ce: "Q" },
  ] as VQConfig[]) {
    assertEquals(fillOrderCodeTemplate(VQ_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["series", "actuation", "seal", "voltage"])), vqBuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const bas: VQConfig = { series: "1", actuation: "1", seal: "0", voltage: "5" };
  const f = fel({ ...bas, func: "N", light: "E" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("negativ common"), f[0]);
  const f2 = fel({ ...bas, series: "2", port: "02", voltage: "4" });
  assert(f2.some((m) => m.includes("kräver kapslingen W")), f2.join(" | "));
  assert(kor({ ...bas, voltage: "2" }, "info").some((m) => m.includes("F-kit")));
  assert(kor({ ...bas, series: "2", actuation: "3" }, "info").some((m) => m.includes("VQ2300") && m.includes("0,2 MPa")));
  assert(kor({ ...bas, func: "R" }, "info").some((m) => m.includes("halvstandard")));
  const tom = { series: "", actuation: "", seal: "", voltage: "" } as VQConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

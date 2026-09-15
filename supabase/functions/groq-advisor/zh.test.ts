/**
 * ZH-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel ZH10DSA-06-06-08 (sida 749), ZH10BSA-06-06
 * (sida 750) och ZH10DSA-06-06-08N (sida 751); tabell 1 och 2 stickprovade
 * rad för rad; ejektordata (sida 752) avskrivna här igen.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildZhDbRules } from "../../../src/lib/catalog/zh-db-rules.ts";
import {
  ZH_ACCESSORIES,
  ZH_BODIES,
  ZH_NOZZLES,
  ZH_ORDER_CODE_TEMPLATE,
  ZH_PORT_CODES,
  ZH_PORTS,
  ZH_SOURCE,
  ZH_VACUUMS,
  type ZHConfig,
  zhBuildCode,
  zhParseCode,
} from "../../../src/lib/catalog/zh.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(ZH_SOURCE.file, "smc-kat-zh-a.pdf");
  assertEquals(ZH_NOZZLES.map((n) => n.nozzle_mm), [0.5, 0.7, 1.0, 1.3, 1.5, 1.8, 2.0]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[ZHConfig, string]> = [
    [{ nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "08" }, "ZH10DSA-06-06-08"],
    [{ nozzle: "10", body: "B", vacuum: "S", sup: "06", vac: "06" }, "ZH10BSA-06-06"],
    [{ nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "08", accessory: "N" }, "ZH10DSA-06-06-08N"],
    [{ nozzle: "05", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "06" }, "ZH05DSA-06-06-06"],
    [{ nozzle: "20", body: "D", vacuum: "L", sup: "10", vac: "F04", exh: "12", accessory: "NS" }, "ZH20DLA-10-F04-12NS"],
    [{ nozzle: "13", body: "D", vacuum: "S", sup: "01", vac: "02", exh: "02" }, "ZH13DSA-01-02-02"],
    [{ nozzle: "18", body: "D", vacuum: "S", sup: "11", vac: "N03", exh: "13" }, "ZH18DSA-11-N03-13"],
    [{ nozzle: "15", body: "B", vacuum: "L", sup: "09", vac: "N03" }, "ZH15BLA-09-N03"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(zhBuildCode(c), kod);
    assertEquals(zhBuildCode(zhParseCode(kod)!.config), kod);
  }
  assertEquals(zhParseCode("ZH05DS-06-06-06"), null, "den äldre koden utan A är inte den här nyckeln");
  assertEquals(zhParseCode("ZH10DSA-06-06-06"), null, "ZH10 har EXH 08");
});

Deno.test("ejektordata följer sida 752 och 767", () => {
  const n = (k: string) => ZH_NOZZLES.find((x) => x.code === k)!;
  assertEquals([n("05").flow_s, n("05").flow_l, n("05").air], [6, 13, 13]);
  assertEquals([n("20").flow_s, n("20").flow_l, n("20").air], [90, 155, 201]);
  assertEquals(n("13").vacuum, { D: { S: -90, L: -48 }, B: { S: -89, L: -48 } });
  assertEquals(n("20").vacuum, { D: { S: -90, L: -66 }, B: { S: -90, L: -62 } });
  assertEquals(ZH_NOZZLES.map((x) => x.valve_c), [0.12, 0.23, 0.47, 0.80, 1.06, 1.53, 1.88]);
});

Deno.test("tabell 1 och 2: portkombinationerna", () => {
  assertEquals(ZH_PORTS["05"].map((r) => `${r.sup}-${r.vacs.join("/")}-${r.exh}`), ["06-06/01/F01-06", "01-01-01", "F01-F01-F01", "07-07/N01-07", "N01-N01-N01"]);
  assertEquals(ZH_PORTS["13"].map((r) => `${r.sup}-${r.vacs.join("/")}-${r.exh}`), ["08-10/02/F02-10", "01-02-02", "F01-F02-F02", "09-11/N02-11", "N01-N02-N02"]);
  assertEquals(ZH_PORTS["20"].map((r) => `${r.sup}-${r.vacs.join("/")}-${r.exh}`), ["10-12/04/F04-12", "03-04-04", "F03-F04-F04", "11-13/N04-13", "N03-N04-N04"]);
  assertEquals(Object.keys(ZH_PORTS).length, 7);
  assertEquals(ZH_PORT_CODES.length, 20);
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = zhBuildCode;
  assertEquals(b({ nozzle: "10", body: "D", vacuum: "S", sup: "08", vac: "10", exh: "10" }), null, "ZH10 har SUP 06");
  assertEquals(b({ nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "02", exh: "08" }), null, "VAC följer SUP");
  assertEquals(b({ nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "06" }), null, "EXH måste anges för D");
  assertEquals(b({ nozzle: "10", body: "B", vacuum: "S", sup: "06", vac: "06", exh: "08" }), null, "B har ingen EXH");
  assertEquals(b({ nozzle: "10", body: "B", vacuum: "S", sup: "06", vac: "06", accessory: "N" }), null, "B har inget tillbehör");
  assertEquals(b({ nozzle: "10", body: "D", vacuum: "S", sup: "01", vac: "01", exh: "01", accessory: "S" }), null, "ljuddämpare kräver snabbkoppling");
  assert(b({ nozzle: "10", body: "D", vacuum: "S", sup: "01", vac: "01", exh: "01", accessory: "N" }));
  assertEquals(b({ nozzle: "18", body: "D", vacuum: "S", sup: "11", vac: "13", exh: "13", accessory: "NS" }), null, "ingen ljuddämpare för tum 13");
  assert(b({ nozzle: "18", body: "D", vacuum: "S", sup: "10", vac: "12", exh: "12", accessory: "NS" }));
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildZhDbRules();
function ctx(c: ZHConfig): Record<string, unknown> {
  return { nozzle: c.nozzle, body: c.body, vacuum: c.vacuum, sup: c.sup, vac: c.vac, exh: c.exh ?? "", accessory: c.accessory ?? "" };
}
const kor = (c: ZHConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: ZHConfig) => kor(c, "error");

Deno.test("alla kombinationer: reglerna säger nej exakt när modellen gör det", () => {
  const prov: ZHConfig[] = [];
  const portar = ZH_PORT_CODES.map((p) => p.code);
  for (const n of ZH_NOZZLES) for (const body of ZH_BODIES) for (const v of ZH_VACUUMS.slice(0, 1))
    for (const sup of portar) for (const vac of portar) for (const exh of ["", "08", "13", "01"])
      for (const acc of ["", "S"])
        prov.push({ nozzle: n.code, body: body.code, vacuum: v.code, sup, vac, exh: exh || undefined, accessory: acc || undefined });
  // tillbehör × EXH för alla giltiga portrader
  for (const n of ZH_NOZZLES) for (const r of ZH_PORTS[n.code]) for (const vac of r.vacs)
    for (const exh of ["", r.exh, "06", "13"]) for (const acc of ["", ...ZH_ACCESSORIES.map((a) => a.code)])
      prov.push({ nozzle: n.code, body: "D", vacuum: "L", sup: r.sup, vac, exh: exh || undefined, accessory: acc || undefined });
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = zhBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assert(prov.length > 40000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: ZHConfig) => ctx(c) as Record<string, string>;
  for (const c of [
    { nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "08" },
    { nozzle: "10", body: "B", vacuum: "S", sup: "06", vac: "06" },
    { nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "08", accessory: "N" },
    { nozzle: "20", body: "D", vacuum: "L", sup: "F03", vac: "F04", exh: "F04", accessory: "N" },
  ] as ZHConfig[]) {
    assertEquals(fillOrderCodeTemplate(ZH_ORDER_CODE_TEMPLATE, val(c), new Set(["nozzle", "body", "vacuum", "sup", "vac"])), zhBuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const f = fel({ nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "06" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("EXH-port 08"), f[0]);
  const i = kor({ nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "08" }, "info");
  assert(i.some((m) => m.includes("−90 kPa") || m.includes("-90 kPa")), i.join(" | "));
  assert(i.some((m) => m.includes("ZH2-BK1A-1-A")), i.join(" | "));
  const s = kor({ nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "08", accessory: "S" }, "info");
  assert(s.some((m) => m.includes("AN15-C08")), s.join(" | "));
  const tom = { nozzle: "", body: "", vacuum: "", sup: "", vac: "" } as ZHConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

/**
 * SV-modellen (EX260-rampens bas) och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel SS5V1-W10S1NAND-05U-C6 (sida 58), formen i
 * rampexemplet SS5V1-W10S1A3ND-04B-C6 (sida 29), SI-enhetstabellen med
 * artikelnummer, stationsgränserna, DIN-noterna och portarna per serie
 * (sida 58), ventildata (sida 27).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildSvDbRules } from "../../../src/lib/catalog/sv-db-rules.ts";
import {
  SV_MOUNTINGS,
  SV_ORDER_CODE_TEMPLATE,
  SV_PE_LOCATIONS,
  SV_PORTS,
  SV_SERIES,
  SV_SI_UNITS,
  SV_SOURCE,
  SV_STATIONS,
  SV_SUP_EXH,
  type SVConfig,
  svBuildCode,
  svParseCode,
  svStationLimits,
} from "../../../src/lib/catalog/sv.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(SV_SOURCE.file, "smc-kat-sv1000.pdf");
  assertEquals(SV_SERIES.map((s) => s.code), ["1", "2", "3"]);
  assertEquals(SV_SERIES.map((s) => s.ports_metric), [["C3", "C4", "C6"], ["C4", "C6", "C8"], ["C6", "C8", "C10"]], "sida 58");
  assertEquals(SV_SI_UNITS.length, 31, "utan + 30 enheter");
  assertEquals(SV_SI_UNITS.find((u) => u.code === "NAN")!.part_no, "EX260-SPR1");
  assertEquals(SV_SI_UNITS.find((u) => u.code === "QA")!.part_no, "EX260-SDN2");
  assertEquals(SV_SI_UNITS.filter((u) => u.protocol === "Ethernet POWERLINK").map((u) => u.code), ["GAN", "GBN"], "bara negativ common");
  assertEquals(svStationLimits(SV_SI_UNITS.find((u) => u.code === "QA")!), [16, 20]);
  assertEquals(svStationLimits(SV_SI_UNITS.find((u) => u.code === "QB")!), [8, 16]);
  assertEquals(SV_STATIONS.length, 19);
  assertEquals(SV_MOUNTINGS.length, 20, "D, D0, D3–D20");
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[SVConfig, string]> = [
    [{ series: "1", si: "NAN", stations: "05", pe: "U", port: "C6" }, "SS5V1-W10S1NAND-05U-C6"],
    [{ series: "1", si: "0", stations: "04", pe: "U", port: "C6" }, "SS5V1-W10S10D-04U-C6"],
    [{ series: "3", si: "EAN", stations: "12", pe: "B", supexh: "RS", mounting: "D12", port: "C10" }, "SS5V3-W10S1EAND-12BRS-D12-C10"],
    [{ series: "1", si: "QB", stations: "16", pe: "B", mounting: "D", port: "N3" }, "SS5V1-W10S1QBD-16B-D-N3"],
    [{ series: "2", si: "GBN", stations: "08", pe: "D", supexh: "S", mounting: "D0", port: "M" }, "SS5V2-W10S1GBND-08DS-D0-M"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(svBuildCode(c), kod);
    assertEquals(svBuildCode(svParseCode(kod)!.config), kod, kod);
  }
  assertEquals(svParseCode("SV1000-4-PROFINET-24"), null, "den gamla mallen");
  assertEquals(svParseCode("SS5V1-W10S1-04"), null, "den gamla produktraden");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = svBuildCode;
  const bas: SVConfig = { series: "1", si: "NAN", stations: "05", pe: "U", port: "C6" };
  assertEquals(b({ ...bas, series: "4" }), null, "SV4000 finns inte som tie-rod EX260");
  assertEquals(b({ ...bas, stations: "11" }), null, "U-sidan högst 10");
  assert(b({ ...bas, stations: "11", pe: "B" }));
  assertEquals(b({ ...bas, stations: "21", pe: "B" }), null);
  assertEquals(b({ ...bas, si: "QB", stations: "17", pe: "B" }), null, "16 utgångar högst 16");
  assert(b({ ...bas, si: "QB", stations: "16", pe: "B" }));
  assert(b({ ...bas, si: "QA", stations: "20", pe: "B" }), "32 utgångar 20 med specificerad layout");
  assertEquals(b({ ...bas, si: "0", mounting: "D" }), null, "DIN-skena kräver SI-enhet");
  assert(b({ ...bas, si: "0", mounting: "D0" }));
  assertEquals(b({ ...bas, mounting: "D3" }), null, "skena kortare än rampen");
  assert(b({ ...bas, mounting: "D5" }));
  assertEquals(b({ ...bas, port: "C8" }), null, "ø8 inte SV1000");
  assertEquals(b({ ...bas, series: "3", port: "C3" }), null);
  assert(b({ ...bas, port: "M" }));
  assertEquals(b({ ...bas, supexh: "X" }), null);
  assertEquals(b({ ...bas, si: "GA" }), null, "POWERLINK bara negativ common");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildSvDbRules();
function ctx(c: SVConfig): Record<string, unknown> {
  return { series: c.series, si: c.si, stations: c.stations, pe: c.pe, supexh: c.supexh ?? "", mounting: c.mounting ?? "", port: c.port };
}
const kor = (c: SVConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: SVConfig) => kor(c, "error");

Deno.test("alla kombinationer: reglerna säger nej exakt när modellen gör det", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  // SI-enheterna representeras av 0, 32 och 16 utgångar, D-sub och POWERLINK; DIN-skenorna av D, D0 och tre längder.
  const enheter = SV_SI_UNITS.filter((u) => ["0", "QA", "QB", "NAN", "NCN", "GAN"].includes(u.code));
  const skenor = SV_MOUNTINGS.filter((m) => ["D", "D0", "D3", "D10", "D20"].includes(m.code));
  for (const s of SV_SERIES) for (const u of enheter) for (const st of SV_STATIONS) for (const pe of SV_PE_LOCATIONS)
    for (const supexh of ["", SV_SUP_EXH[2].code]) for (const m of ["", ...skenor.map((x) => x.code)]) for (const p of SV_PORTS) {
      const c: SVConfig = { series: s.code, si: u.code, stations: st.code, pe: pe.code, supexh: supexh || undefined, mounting: m || undefined, port: p.code };
      n++;
      const kod = svBuildCode(c);
      const f = fel(c);
      if (!kod && f.length === 0) missade.push(JSON.stringify(c));
      if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
    }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assert(n >= 100000, String(n));
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { series: "1", si: "NAN", stations: "05", pe: "U", port: "C6" },
    { series: "1", si: "0", stations: "04", pe: "U", port: "C6" },
    { series: "3", si: "EAN", stations: "12", pe: "B", supexh: "RS", mounting: "D12", port: "C10" },
    { series: "2", si: "GBN", stations: "08", pe: "D", supexh: "S", mounting: "D0", port: "M" },
  ] as SVConfig[]) {
    assertEquals(fillOrderCodeTemplate(SV_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["series", "si", "stations", "pe", "port"])), svBuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const bas: SVConfig = { series: "1", si: "NAN", stations: "05", pe: "U", port: "C6" };
  const f = fel({ ...bas, si: "0", mounting: "D" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("D0"), f[0]);
  const v = kor({ ...bas, stations: "18", pe: "B" }, "warn");
  assert(v.some((m) => m.includes("specificerad layout")), v.join(" | "));
  assertEquals(kor({ ...bas, stations: "16", pe: "B" }, "warn"), []);
  assert(kor({ ...bas, si: "NCN" }, "info").some((m) => m.includes("IP40")));
  assert(kor(bas, "info").some((m) => m.includes("EX260-SPR1")));
  assert(kor({ ...bas, series: "3" }, "info").some((m) => m.includes("SV3000") && m.includes("ø12")));
  const tom = { series: "", si: "", stations: "", pe: "", port: "" } as SVConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

/**
 * SY-ventilrampens modell (familjen sy, EX600) och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel SS5Y3-10S6Q2-05U-C6 (sida 502), rampexemplen
 * SS5Y3-10S6Q72-05B-C6 (sida 503) och SS5Y3-12S6Q72-05B (sida 513),
 * porttabellen (sida 503), P/E-tabellen (sida 502 och 512), monteringen
 * (sida 503 och 512), EX600-enheterna (sida 600) och flöde/vikt (sida 427).
 * SMC:s webbkonfigurator (smcusa.com, SS5Y3-12S6) bekräftar formen
 * "SS5Y3-12S6Q22-05B-ND0" och avvisar D3 för fem stationer.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildSyManifoldDbRules } from "../../../src/lib/catalog/sy-manifold-db-rules.ts";
import {
  SYM_DIN_RAILS,
  SYM_IO_STATIONS,
  SYM_MOUNTINGS,
  SYM_ORDER_CODE_TEMPLATE,
  SYM_PE_ENTRIES,
  SYM_POLARITIES,
  SYM_PORTS,
  SYM_SERIES,
  SYM_SI_UNITS,
  SYM_SOURCE,
  SYM_STATIONS,
  SYM_TYPES,
  type SYMConfig,
  symAllowedPorts,
  symBuildCode,
  symParseCode,
  symUnitPair,
} from "../../../src/lib/catalog/sy-manifold.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(SYM_SOURCE.file, "smc-kat-sy-new.pdf");
  assertEquals(SYM_SERIES.map((s) => [s.code, s.pe_metric, s.pe_inch]), [["3", "ø8", "ø5/16\""], ["5", "ø10", "ø3/8\""], ["7", "ø12", "ø1/2\""]], "sida 503");
  assertEquals(SYM_TYPES.map((t) => [t.code, t.series.join("")]), [["10", "357"], ["11", "57"], ["12", "357"]], "sida 502");
  assertEquals(SYM_SI_UNITS.map((u) => u.code), ["0", "Q", "N", "V", "EA", "EB", "DA", "F", "FA", "WE", "WF", "WS"], "sida 502");
  assertEquals(SYM_SI_UNITS.filter((u) => !u.types.includes("12")).map((u) => u.code), ["EB", "DA"], "sida 512");
  assertEquals(SYM_SI_UNITS.find((u) => u.code === "Q")!.unit_npn, "EX600-SDN2A", "sida 600");
  assertEquals(SYM_SI_UNITS.find((u) => u.code === "FA")!.unit_pnp, "EX600-SPN3");
  assertEquals(symUnitPair("EX600-SDN1A", "EX600-SDN2A"), "EX600-SDN□A");
  assertEquals(SYM_POLARITIES.map((p) => p.code), ["2", "3", "6", "8", "4", "5", "7", "9"]);
  assertEquals(SYM_POLARITIES.filter((p) => p.positive).map((p) => p.code), ["2", "3", "6", "8"], "sida 502");
  assertEquals(SYM_POLARITIES.find((p) => p.code === "7")!.end_plate, "EX600-ED4");
  assertEquals(SYM_IO_STATIONS.length, 9);
  assertEquals(SYM_STATIONS[0].code, "02");
  assertEquals(SYM_STATIONS[SYM_STATIONS.length - 1].code, "24");
  assertEquals(SYM_PE_ENTRIES.map((e) => e.code).join(""), "UDBCEFGHJ");
  assertEquals(SYM_PE_ENTRIES.filter((e) => e.max_stations === 24).map((e) => e.code), ["B", "F", "J"]);
  assertEquals(symAllowedPorts("10", "3").map((p) => p.code), ["-C2", "-C3", "-C4", "-C6", "-CM", "-L4", "-L6", "-B4", "-B6", "-LM", "-N1", "-N3", "-N7", "-LN3", "-LN7", "-BN3", "-BN7"], "sida 503");
  assertEquals(symAllowedPorts("11", "5").map((p) => p.code), ["-C4", "-C6", "-C8", "-CM", "-N3", "-N7", "-N9"]);
  assertEquals(symAllowedPorts("11", "7").map((p) => p.code), ["-C6", "-C8", "-C10", "-C12", "-CM", "-N7", "-N9", "-N11"]);
  assertEquals(symAllowedPorts("10", "7").length, 19);
  assertEquals(symAllowedPorts("12", "3").map((p) => p.code), ["", "-N"], "sida 512");
  assertEquals(symAllowedPorts("11", "3"), []);
  assertEquals(SYM_MOUNTINGS.map((m) => m.code), ["AA", "BA", "D", "A", "B"]);
  assertEquals(SYM_MOUNTINGS.filter((m) => m.types.includes("12")).map((m) => m.code), ["D"], "sida 512");
  assertEquals(SYM_MOUNTINGS.filter((m) => m.types.includes("11")).map((m) => m.code), ["AA", "BA"], "sida 503");
  assertEquals(SYM_DIN_RAILS.map((d) => d.code), ["0", ...Array.from({ length: 22 }, (_, i) => String(i + 3))]);
  assertEquals(SYM_SERIES.find((s) => s.code === "5")!.flow_c["10"], 3.3, "sida 427");
  assertEquals(SYM_SERIES.find((s) => s.code === "7")!.weight["12"], [84.1, 519]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[SYMConfig, string]> = [
    [{ series: "3", type: "10", si_unit: "Q", polarity: "2", stations: "05", pe_entry: "U", port: "-C6" }, "SS5Y3-10S6Q2-05U-C6"],
    [{ series: "3", type: "10", si_unit: "Q", polarity: "7", io_stations: "2", stations: "05", pe_entry: "B", port: "-C6" }, "SS5Y3-10S6Q72-05B-C6"],
    [{ series: "3", type: "12", si_unit: "Q", polarity: "7", io_stations: "2", stations: "05", pe_entry: "B" }, "SS5Y3-12S6Q72-05B"],
    [{ series: "3", type: "12", si_unit: "Q", polarity: "2", io_stations: "2", stations: "05", pe_entry: "B", port: "-N", mounting: "D", din_rail: "0" }, "SS5Y3-12S6Q22-05B-ND0"],
    [{ series: "3", type: "10", si_unit: "0", stations: "04", pe_entry: "B", port: "-C6" }, "SS5Y3-10S60-04B-C6"],
    [{ series: "5", type: "10", si_unit: "Q", polarity: "3", io_stations: "2", stations: "05", pe_entry: "D", port: "-C8" }, "SS5Y5-10S6Q32-05D-C8"],
    [{ series: "7", type: "10", si_unit: "Q", polarity: "2", io_stations: "2", stations: "05", pe_entry: "D", port: "-C10" }, "SS5Y7-10S6Q22-05D-C10"],
    [{ series: "5", type: "11", si_unit: "EA", polarity: "2", stations: "06", pe_entry: "D", port: "-C8", mounting: "AA" }, "SS5Y5-11S6EA2-06D-C8AA"],
    [{ series: "3", type: "10", si_unit: "F", polarity: "2", stations: "08", pe_entry: "B", port: "-C6", mounting: "A", din_rail: "12" }, "SS5Y3-10S6F2-08B-C6A12"],
    [{ series: "7", type: "12", si_unit: "WS", polarity: "9", io_stations: "9", stations: "24", pe_entry: "J", mounting: "D" }, "SS5Y7-12S6WS99-24JD"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(symBuildCode(c), kod);
    assertEquals(symBuildCode(symParseCode(kod)!.config), kod, kod);
  }
  assertEquals(symParseCode("SS5Y3-12S6Q2-05BD3"), null, "skenan måste vara längre än stationsantalet (SMC:s konfigurator: invalid)");
  assertEquals(symParseCode("SS5Y3-11S6Q2-05D-C6"), null, "bottenportad SY3000 finns inte");
  assertEquals(symParseCode("SS5Y3-10S6Q2-12U-C6"), null, "U-sidan högst 10 stationer");
  assertEquals(symParseCode("SS5Y3-12S6EB2-05B"), null, "EB inte topportad");
  assertEquals(symParseCode("SS5Y3-10S6Q-05D-C6"), null, "polaritet saknas");
  assertEquals(symParseCode("SS5Y3-10S602-05D-C6"), null, "polaritet utan SI-enhet");
  assertEquals(symParseCode("SS5Y3-10S6Q2-05D-C6-D3"), null, "monteringen skrivs utan bindestreck");
  assertEquals(symParseCode("SS5Y3-10S6Q2-05D-C6D0")!.config.din_rail, "0", "D0 = DIN-skenemontering utan skena");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = symBuildCode;
  const bas: SYMConfig = { series: "3", type: "10", si_unit: "Q", polarity: "2", stations: "05", pe_entry: "U", port: "-C6" };
  assert(b(bas));
  assertEquals(b({ ...bas, port: "-C8" }), null, "ø8 finns inte på SY3000");
  assertEquals(b({ ...bas, series: "5", port: "-C2" }), null);
  assertEquals(b({ ...bas, type: "11", series: "5", port: "-L6" }), null, "vinkelportar finns inte bottenportade");
  assertEquals(b({ ...bas, type: "11", series: "5", port: "-C6", mounting: "D" }), null, "typ 11 bara direkt");
  assertEquals(b({ ...bas, type: "12", port: "-C6" }), null, "topportad har ingen A/B-port");
  assertEquals(b({ ...bas, type: "12", port: "", mounting: "AA" }), null);
  assertEquals(b({ ...bas, port: "" }), null);
  assertEquals(b({ ...bas, pe_entry: "F", type: "12", port: "" }), null);
  assertEquals(b({ ...bas, stations: "11" }), null);
  assertEquals(b({ ...bas, stations: "11", pe_entry: "B" }), "SS5Y3-10S6Q2-11B-C6");
  assertEquals(b({ ...bas, stations: "25", pe_entry: "B" }), null);
  assertEquals(b({ ...bas, si_unit: "0", polarity: "" }), "SS5Y3-10S60-05U-C6");
  assertEquals(b({ ...bas, si_unit: "0" }), null, "polaritet utan SI-enhet");
  assertEquals(b({ ...bas, si_unit: "0", polarity: "", io_stations: "1" }), null);
  assertEquals(b({ ...bas, polarity: "1" }), null);
  assertEquals(b({ ...bas, din_rail: "3" }), null, "skena utan DIN-montering");
  assertEquals(b({ ...bas, mounting: "D", din_rail: "5" }), null, "5 är inte större än 5");
  assertEquals(b({ ...bas, mounting: "D", din_rail: "6" }), "SS5Y3-10S6Q2-05U-C6D6");
  assertEquals(b({ ...bas, mounting: "D", din_rail: "0" }), "SS5Y3-10S6Q2-05U-C6D0");
  assertEquals(b({ ...bas, mounting: "AA", din_rail: "0" }), null);
  assertEquals(b({ ...bas, si_unit: "X" }), null);
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildSyManifoldDbRules();
function ctx(c: SYMConfig): Record<string, unknown> {
  return {
    series: c.series, type: c.type, si_unit: c.si_unit, polarity: c.polarity ?? "", io_stations: c.io_stations ?? "",
    stations: c.stations, pe_entry: c.pe_entry, port: c.port ?? "", mounting: c.mounting ?? "", din_rail: c.din_rail ?? "",
  };
}
const kor = (c: SYMConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: SYMConfig) => kor(c, "error");

function jamfor(configs: Iterable<SYMConfig>, vad: string) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const c of configs) {
    n++;
    const kod = symBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${vad}: ${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${vad}: ${falsklarm.length} falsklarm`);
  return n;
}

Deno.test("serie × typ × SI-enhet × polaritet × I/O, uttömmande", () => {
  function* g() {
    for (const s of SYM_SERIES) for (const t of SYM_TYPES) for (const u of SYM_SI_UNITS) for (const pol of ["", ...SYM_POLARITIES.map((p) => p.code)]) for (const io of ["", "1", "9"]) {
      const port = t.code === "12" ? "" : t.code === "11" ? "-C6" : "-C6";
      yield { series: s.code, type: t.code, si_unit: u.code, polarity: pol || undefined, io_stations: io || undefined, stations: "05", pe_entry: "B", port } as SYMConfig;
    }
  }
  assertEquals(jamfor(g(), "SI-enhet"), 3 * 3 * 12 * 9 * 3);
});

Deno.test("typ × stationer × P/E, uttömmande", () => {
  function* g() {
    for (const t of SYM_TYPES) for (const st of SYM_STATIONS) for (const e of SYM_PE_ENTRIES) {
      yield { series: t.code === "11" ? "5" : "3", type: t.code, si_unit: "Q", polarity: "2", stations: st.code, pe_entry: e.code, port: t.code === "12" ? "" : "-C6" } as SYMConfig;
    }
  }
  assertEquals(jamfor(g(), "P/E"), 3 * 23 * 9);
});

Deno.test("typ × serie × port, uttömmande", () => {
  function* g() {
    for (const t of SYM_TYPES) for (const s of SYM_SERIES) for (const p of ["", ...SYM_PORTS.map((x) => x.code)]) {
      yield { series: s.code, type: t.code, si_unit: "Q", polarity: "2", stations: "05", pe_entry: "B", port: p || undefined } as SYMConfig;
    }
  }
  assertEquals(jamfor(g(), "port"), 3 * 3 * 35);
});

Deno.test("typ × montering × skena × stationer × SI-enhet, uttömmande", () => {
  function* g() {
    for (const t of SYM_TYPES) for (const m of ["", ...SYM_MOUNTINGS.map((x) => x.code)]) for (const d of ["", ...SYM_DIN_RAILS.map((x) => x.code)]) for (const st of ["02", "05", "10", "16", "23", "24"]) for (const u of ["0", "Q"]) {
      yield { series: t.code === "11" ? "5" : "3", type: t.code, si_unit: u, polarity: u === "0" ? undefined : "2", stations: st, pe_entry: "B", port: t.code === "12" ? "" : "-C6", mounting: m || undefined, din_rail: d || undefined } as SYMConfig;
    }
  }
  assertEquals(jamfor(g(), "montering"), 3 * 6 * 24 * 6 * 2);
});

Deno.test("slumpade kombinationer, 20 000", () => {
  let seed = 20260921;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const pick = <T,>(a: T[]) => a[rnd(a.length)];
  function* g() {
    for (let i = 0; i < 20000; i++) {
      yield {
        series: pick(SYM_SERIES).code, type: pick(SYM_TYPES).code, si_unit: pick(SYM_SI_UNITS).code,
        polarity: pick(["", "", ...SYM_POLARITIES.map((p) => p.code)]) || undefined,
        io_stations: pick(["", "", "", ...SYM_IO_STATIONS.map((p) => p.code)]) || undefined,
        stations: pick(SYM_STATIONS).code, pe_entry: pick(SYM_PE_ENTRIES).code,
        port: pick(["", ...SYM_PORTS.map((p) => p.code)]) || undefined,
        mounting: pick(["", "", ...SYM_MOUNTINGS.map((m) => m.code)]) || undefined,
        din_rail: pick(["", "", "", ...SYM_DIN_RAILS.map((d) => d.code)]) || undefined,
      } as SYMConfig;
    }
  }
  assertEquals(jamfor(g(), "slump"), 20000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const req = new Set(["series", "type", "si_unit", "stations", "pe_entry"]);
  for (const c of [
    { series: "3", type: "10", si_unit: "Q", polarity: "2", stations: "05", pe_entry: "U", port: "-C6" },
    { series: "3", type: "12", si_unit: "Q", polarity: "7", io_stations: "2", stations: "05", pe_entry: "B" },
    { series: "3", type: "12", si_unit: "Q", polarity: "2", io_stations: "2", stations: "05", pe_entry: "B", port: "-N", mounting: "D", din_rail: "0" },
    { series: "3", type: "10", si_unit: "0", stations: "04", pe_entry: "B", port: "-C6" },
    { series: "3", type: "10", si_unit: "F", polarity: "2", stations: "08", pe_entry: "B", port: "-C6", mounting: "A", din_rail: "12" },
    { series: "7", type: "12", si_unit: "WS", polarity: "9", io_stations: "9", stations: "24", pe_entry: "J", mounting: "D" },
  ] as SYMConfig[]) {
    assertEquals(fillOrderCodeTemplate(SYM_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, req), symBuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const bas: SYMConfig = { series: "3", type: "10", si_unit: "Q", polarity: "2", stations: "05", pe_entry: "U", port: "-C6" };
  const f = fel({ ...bas, series: "3", type: "11" });
  assert(f.some((m) => m.includes("blandramp")), f.join(" | "));
  const f2 = fel({ ...bas, port: "-C8" });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("C2, C3, C4, C6, CM, L4, L6, B4, B6 och LM") && f2[0].includes("N1, N3, N7"), f2[0]);
  const f3 = fel({ ...bas, stations: "12" });
  assert(f3[0].includes("2–10 ventilplatser"), f3.join(" | "));
  const f4 = fel({ ...bas, mounting: "D", din_rail: "4" });
  assert(f4[0].includes("STÖRRE"), f4.join(" | "));
  const i = kor(bas, "info");
  assert(i.some((m) => m.includes("SS5Y3-10") && m.includes("1,4 dm³") && m.includes("28,9·n + 293")), i.join(" | "));
  assert(i.some((m) => m.includes("EX600-SDN1A") && m.includes("EX600-SDN2A")), i.join(" | "));
  assert(i.some((m) => m.includes("EX600-ED2") && m.includes("R, U, S eller Z")), i.join(" | "));
  assert(i.some((m) => m.includes("sy-plugin") && m.includes("SY□100-5U1")), i.join(" | "));
  const i2 = kor({ ...bas, type: "12", port: "", pe_entry: "C", si_unit: "0", polarity: undefined, mounting: "D" }, "info");
  assert(i2.some((m) => m.includes("SY3130-5U1-C6")), i2.join(" | "));
  assert(i2.some((m) => m.includes("ljuddämpare")), i2.join(" | "));
  const w = kor({ ...bas, type: "12", port: "", si_unit: "0", polarity: undefined, mounting: "D" }, "warn");
  assert(w.some((m) => m.includes("D0")), w.join(" | "));
  const w2 = kor({ ...bas, stations: "20", pe_entry: "B" }, "warn");
  assert(w2.some((m) => m.includes("specificerad layout")), w2.join(" | "));
  assertEquals(kor(bas, "warn"), []);
  const tom = { series: "", type: "", si_unit: "", stations: "", pe_entry: "" } as SYMConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

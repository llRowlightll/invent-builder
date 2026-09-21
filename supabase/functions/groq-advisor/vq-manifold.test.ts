/**
 * VQ-ventilrampens modell (familjen vq) och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel VV5Q11-08C6FU1 (sida 366) och VV5Q21-08C6FU1
 * (sida 370), kitexemplen VV5Q21-08C8FU2 (sida 371), VV5Q11-08C6T0 (sida
 * 385), VV5Q11-06C6L2 (sida 389), VV5Q11-08C6SV (sida 397), VV5Q21-09C6M2
 * (sida 401), tillvalen VV5Q11-08C6FU1-RS/-D0S/-D09S (sida 404–406),
 * stationstabellen (sida 375) och tumportarna (sida 406).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildVqManifoldDbRules } from "../../../src/lib/catalog/vq-manifold-db-rules.ts";
import {
  VQM_CABLES,
  VQM_ENTRIES,
  VQM_KITS,
  VQM_OPTIONS,
  VQM_OPTION_PARAMS,
  VQM_ORDER_CODE_TEMPLATE,
  VQM_PORTS,
  VQM_SERIES,
  VQM_SI_UNITS,
  VQM_SOURCE,
  VQM_STATIONS,
  type VQMConfig,
  vqmBuildCode,
  vqmParseCode,
} from "../../../src/lib/catalog/vq-manifold.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(VQM_SOURCE.file, "smc-kat-vq1000.pdf");
  assertEquals(VQM_SERIES.map((s) => [s.code, s.pe_metric]), [["1", "C8 (ø8)"], ["2", "C10 (ø10)"]], "sida 375");
  assertEquals(VQM_KITS.map((k) => k.code), ["F", "P", "T0", "L", "S", "M"]);
  assertEquals(VQM_KITS.find((k) => k.code === "T0")!.stations, { "1": [2, 24], "2": [2, 20] }, "sida 375");
  assertEquals(VQM_KITS.find((k) => k.code === "L")!.stations, { "1": [1, 8], "2": [1, 8] });
  assertEquals(VQM_KITS.find((k) => k.code === "S")!.stations, { "1": [2, 16], "2": [2, 16] });
  assertEquals(VQM_KITS.find((k) => k.code === "M")!.stations, { "2": [2, 24] }, "sida 400: bara VQ2000");
  assertEquals(VQM_KITS.find((k) => k.code === "L")!.cables, ["0", "1", "2"], "sida 388");
  assertEquals(VQM_SI_UNITS.map((u) => u.code), ["0", "Q", "V", "ZB", "ZBN"], "sida 397");
  assertEquals(VQM_PORTS.filter((p) => p.series.includes("1") && !p.inch).map((p) => p.code), ["C3", "C4", "C6", "M5", "CM", "L3", "L4", "L6", "L5", "B3", "B4", "B6", "B5", "LM", "MM"], "sida 366");
  assertEquals(VQM_PORTS.filter((p) => p.series.includes("2") && !p.inch).map((p) => p.code), ["C4", "C6", "C8", "CM", "L4", "L6", "L8", "B4", "B6", "B8", "LM", "MM"], "sida 370");
  assertEquals(VQM_PORTS.filter((p) => p.inch && p.series.includes("1")).map((p) => p.code), ["N1", "N3", "N7", "M5T", "NM"], "sida 406");
  assertEquals(VQM_PORTS.filter((p) => p.inch && p.series.includes("2")).map((p) => p.code), ["N3", "N7", "N9", "NM"]);
  assertEquals(VQM_OPTIONS.find((x) => x.code === "2")!.kits, ["F", "L"], "sida 366");
  assertEquals(VQM_OPTIONS.find((x) => x.code === "W")!.series, ["2"]);
  assertEquals(VQM_OPTIONS.find((x) => x.code === "W")!.kits, ["T0", "L", "S", "M"], "sida 375, not 4");
  assertEquals(VQM_OPTIONS.find((x) => x.code === "K")!.kits.includes("L"), false, "sida 366, not 5");
  assertEquals(VQM_OPTIONS.filter((x) => x.not_with_nameplate).map((x) => x.code), ["G1", "G2", "G3", "J"]);
  assertEquals(VQM_OPTIONS.filter((x) => x.param === "din").length, 25);
  assertEquals(VQM_SERIES[0].flow_c, [0.70, 0.85], "sida 374");
  assertEquals(VQM_SERIES[1].valve_weight_g, [95, 105]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[VQMConfig, string]> = [
    [{ series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1" }, "VV5Q11-08C6FU1"],
    [{ series: "2", stations: "08", port: "C8", kit: "F", entry: "U", cable: "2" }, "VV5Q21-08C8FU2"],
    [{ series: "1", stations: "09", port: "C6", kit: "P", entry: "U", cable: "2" }, "VV5Q11-09C6PU2"],
    [{ series: "1", stations: "08", port: "C6", kit: "T0" }, "VV5Q11-08C6T0"],
    [{ series: "1", stations: "06", port: "C6", kit: "L", cable: "2" }, "VV5Q11-06C6L2"],
    [{ series: "1", stations: "08", port: "C6", kit: "S", si_unit: "V" }, "VV5Q11-08C6SV"],
    [{ series: "1", stations: "08", port: "C6", kit: "S", si_unit: "0" }, "VV5Q11-08C6S0"],
    [{ series: "2", stations: "09", port: "C6", kit: "M", cable: "2" }, "VV5Q21-09C6M2"],
    [{ series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1", ext_pilot: "R", silencer: "S" }, "VV5Q11-08C6FU1-RS"],
    [{ series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1", din: "D0", silencer: "S" }, "VV5Q11-08C6FU1-D0S"],
    [{ series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1", din: "D09", silencer: "S" }, "VV5Q11-08C6FU1-D09S"],
    [{ series: "1", stations: "06", port: "N7", kit: "P", entry: "S", cable: "0" }, "VV5Q11-06N7PS0"],
    [{ series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1", check: "B", ext_pilot: "R", silencer: "S", ce: "Q" }, "VV5Q11-08C6FU1-BRS-Q"],
    [{ series: "2", stations: "20", port: "C8", kit: "T0", ip65: "W" }, "VV5Q21-20C8T0-W"],
    [{ series: "1", stations: "01", port: "M5", kit: "L", cable: "0", ac: "2" }, "VV5Q11-01M5L0-2"],
    [{ series: "1", stations: "16", port: "CM", kit: "S", si_unit: "ZBN", regulator: "G2", wiring: "K", ext_pilot: "R" }, "VV5Q11-16CMSZBN-G2KR"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(vqmBuildCode(c), kod);
    assertEquals(vqmBuildCode(vqmParseCode(kod)!.config), kod, kod);
  }
  assertEquals(vqmParseCode("VV5Q11-09C6L0"), null, "L-kit högst 8");
  assertEquals(vqmParseCode("VV5Q11-17C6SV"), null, "S-kit högst 16");
  assertEquals(vqmParseCode("VV5Q11-08C6M1"), null, "M bara VQ2000");
  assertEquals(vqmParseCode("VV5Q21-21C6T0"), null, "T VQ2000 högst 20");
  assertEquals(vqmParseCode("VV5Q11-08C6FU1-G1N"), null, "G med N");
  assertEquals(vqmParseCode("VV5Q11-08C6T0-W"), null, "W bara VQ2000");
  assertEquals(vqmParseCode("VV5Q11-08C6L1-K"), null, "K inte L-kit");
  assertEquals(vqmParseCode("VV5Q11-08C6PU1-2"), null, "2 bara F/L");
  assertEquals(vqmParseCode("VV5Q11-08C6FU1-D08"), null, "D08 inte längre än 8");
  assertEquals(vqmParseCode("VV5Q11-08C8FU1"), null, "ø8 inte VQ1000");
  assertEquals(vqmParseCode("VV5Q11-08C6L3"), null, "L-kit utan 5 m");
  assertEquals(vqmParseCode("VV5Q11-08C6FU1-2-Q"), null, "CE bara DC");
  assertEquals(vqmParseCode("VV5Q11-SB08C6"), null, "EX510 ingår inte");
  assertEquals(vqmParseCode("VQ-1-5-24-D"), null, "den påhittade mallen");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildVqManifoldDbRules();
function ctx(c: VQMConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { series: c.series, stations: c.stations, port: c.port, kit: c.kit, entry: c.entry ?? "", cable: c.cable ?? "", si_unit: c.si_unit ?? "", ce: c.ce ?? "" };
  for (const p of VQM_OPTION_PARAMS) out[p] = c[p] ?? "";
  return out;
}
const kor = (c: VQMConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: VQMConfig) => kor(c, "error");

function jamfor(configs: Iterable<VQMConfig>, vad: string) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const c of configs) {
    n++;
    const kod = vqmBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${vad}: ${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${vad}: ${falsklarm.length} falsklarm`);
  return n;
}

Deno.test("serie × kit × stationer × anslutning × kabel × SI-enhet, uttömmande", () => {
  function* g() {
    for (const s of VQM_SERIES) for (const k of VQM_KITS) for (const st of VQM_STATIONS) for (const e of ["", ...VQM_ENTRIES.map((x) => x.code)]) for (const cab of ["", ...VQM_CABLES.map((x) => x.code)]) for (const si of ["", ...VQM_SI_UNITS.map((x) => x.code)]) {
      yield { series: s.code, stations: st.code, port: "C6", kit: k.code, entry: e || undefined, cable: cab || undefined, si_unit: si || undefined } as VQMConfig;
    }
  }
  assertEquals(jamfor(g(), "kit"), 2 * 6 * 24 * 3 * 5 * 6);
});

Deno.test("serie × port, uttömmande", () => {
  function* g() {
    for (const s of VQM_SERIES) for (const p of VQM_PORTS) yield { series: s.code, stations: "08", port: p.code, kit: "F", entry: "U", cable: "1" } as VQMConfig;
  }
  assertEquals(jamfor(g(), "port"), 2 * 24);
});

Deno.test("serie × kit × tillval × namnskylt × CE, uttömmande per tillval", () => {
  function* g() {
    for (const s of VQM_SERIES) for (const k of VQM_KITS) for (const opt of VQM_OPTIONS) for (const np of ["", "N"]) for (const ce of ["", "Q"]) {
      const bas: VQMConfig = { series: s.code, stations: "08", port: "C6", kit: k.code, entry: k.entry ? "U" : undefined, cable: k.cables.length ? k.cables[0] : undefined, si_unit: k.si_unit ? "V" : undefined, ce: ce || undefined };
      if (opt.param === "nameplate") continue;
      yield { ...bas, [opt.param]: opt.code, nameplate: np || undefined } as VQMConfig;
    }
  }
  assertEquals(jamfor(g(), "tillval"), 2 * 6 * (VQM_OPTIONS.length - 1) * 2 * 2);
});

Deno.test("DIN-skenans längd mot stationsantalet, uttömmande", () => {
  function* g() {
    for (const d of VQM_OPTIONS.filter((x) => x.param === "din")) for (const st of VQM_STATIONS) {
      yield { series: "2", stations: st.code, port: "C6", kit: "F", entry: "U", cable: "1", din: d.code } as VQMConfig;
    }
  }
  assertEquals(jamfor(g(), "din"), 25 * 24);
});

Deno.test("slumpade kombinationer, 20 000", () => {
  let seed = 20260921;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const pick = <T,>(a: T[]) => a[rnd(a.length)];
  function* g() {
    for (let i = 0; i < 20000; i++) {
      const c: VQMConfig = {
        series: pick(VQM_SERIES).code, stations: pick(VQM_STATIONS).code, port: pick(VQM_PORTS).code, kit: pick(VQM_KITS).code,
        entry: pick(["", "", ...VQM_ENTRIES.map((x) => x.code)]) || undefined,
        cable: pick(["", "", ...VQM_CABLES.map((x) => x.code)]) || undefined,
        si_unit: pick(["", "", "", ...VQM_SI_UNITS.map((x) => x.code)]) || undefined,
        ce: pick(["", "", "Q"]) || undefined,
      };
      for (const p of VQM_OPTION_PARAMS) {
        const opts = VQM_OPTIONS.filter((x) => x.param === p);
        const v = pick(["", "", "", ...opts.map((x) => x.code)]);
        if (v) (c as unknown as Record<string, unknown>)[p] = v;
      }
      yield c;
    }
  }
  assertEquals(jamfor(g(), "slump"), 20000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const req = new Set(["series", "stations", "port", "kit"]);
  for (const c of [
    { series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1" },
    { series: "1", stations: "08", port: "C6", kit: "T0" },
    { series: "1", stations: "08", port: "C6", kit: "S", si_unit: "V" },
    { series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1", ext_pilot: "R", silencer: "S" },
    { series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1", ce: "Q" },
    { series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1", check: "B", ext_pilot: "R", silencer: "S", ce: "Q" },
    { series: "2", stations: "20", port: "C8", kit: "T0", ip65: "W" },
  ] as VQMConfig[]) {
    assertEquals(fillOrderCodeTemplate(VQM_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, req), vqmBuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const bas: VQMConfig = { series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1" };
  const f = fel({ ...bas, kit: "M" });
  assert(f.some((m) => m.includes("bara för VQ2000")), f.join(" | "));
  const f2 = fel({ ...bas, kit: "L", cable: "2", stations: "09" });
  assert(f2.some((m) => m.includes("1–8 platser")), f2.join(" | "));
  const f3 = fel({ ...bas, port: "C8" });
  assert(f3[0].includes("C3, C4, C6, M5") && f3[0].includes("N1, N3, N7, M5T och NM"), f3.join(" | "));
  const f4 = fel({ ...bas, regulator: "G1", nameplate: "N" });
  assert(f4[0].includes("namnskylt"), f4.join(" | "));
  const f5 = fel({ ...bas, din: "D08" });
  assert(f5[0].includes("större än"), f5.join(" | "));
  const i = kor(bas, "info");
  assert(i.some((m) => m.includes("VV5Q11") && m.includes("C8 (ø8)") && m.includes("0,7–0,85")), i.join(" | "));
  assert(i.some((m) => m.includes("F-kit") && m.includes("VQ1100-51")), i.join(" | "));
  const i2 = kor({ ...bas, port: "N7", kit: "S", entry: undefined, cable: undefined, si_unit: "Q", ext_pilot: "R", din: "D0" }, "info");
  assert(i2.some((m) => m.includes("N9")), i2.join(" | "));
  assert(i2.some((m) => m.includes("DeviceNet")), i2.join(" | "));
  assert(i2.some((m) => m.includes("VQ1100R-51")), i2.join(" | "));
  assert(i2.some((m) => m.includes("VVQ1000-57A")), i2.join(" | "));
  const w = kor({ ...bas, kit: "S", entry: undefined, cable: undefined, si_unit: "V", stations: "12" }, "warn");
  assert(w.some((m) => m.includes("9–16")), w.join(" | "));
  assertEquals(kor(bas, "warn"), []);
  const tom = { series: "", stations: "", port: "", kit: "" } as VQMConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

/**
 * SY-modellen (SY3000/5000/7000/9000 enkelventil) och dess regler mot
 * katalogen.
 *
 * Facit: nyckelns exempel SY5120-5L-01 (sida 732) och SY5240-5L (sida 748),
 * M8-exemplet SY312-5W1ZE-C4:s svans (sida 961), tabellerna för port,
 * spänning, anslutning, ljus/spärrdiod, fäste, -X20/-X90/-X701.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildSyDbRules } from "../../../src/lib/catalog/sy-db-rules.ts";
import {
  SY_ACTUATIONS,
  SY_BODIES,
  SY_BRACKETS,
  SY_ENTRIES,
  SY_LIGHTS,
  SY_MTO,
  SY_ORDER_CODE_TEMPLATE,
  SY_PORTS,
  SY_SERIES,
  SY_SOURCE,
  SY_VOLTAGES,
  type SYConfig,
  syBuildCode,
  syParseCode,
} from "../../../src/lib/catalog/sy.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(SY_SOURCE.file, "smc-kat-sy3000.pdf");
  assertEquals(SY_SERIES.map((s) => s.code), ["3", "5", "7", "9"]);
  assertEquals(SY_SERIES.map((s) => s.ports_thread), [["M5"], ["01"], ["02"], ["02", "03"]], "sida 732");
  assertEquals(SY_SERIES.map((s) => s.ports_metric), [["C4", "C6"], ["C4", "C6", "C8"], ["C8", "C10"], ["C8", "C10", "C12"]]);
  assertEquals(SY_SERIES.map((s) => s.ports_base), [["01"], ["02"], ["02", "03"], ["03", "04"]], "sida 748");
  assertEquals(SY_SERIES.map((s) => s.freq_hz), [[10, 3], [5, 3], [5, 3], [5, 3]], "sida 733");
  assertEquals(SY_ACTUATIONS.find((a) => a.code === "3")!.pressure, [0.2, 0.7]);
  assertEquals(SY_ENTRIES.length, 27, "13 + WO + W1–7 + WA1–7");
  assertEquals(SY_VOLTAGES.length, 9);
  assertEquals(SY_MTO.map((x) => x.code), ["X20", "X90", "X701"]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[SYConfig, string]> = [
    [{ series: "5", actuation: "1", body: "20", voltage: "5", entry: "L", port: "01" }, "SY5120-5L-01"],
    [{ series: "5", actuation: "2", body: "40", voltage: "5", entry: "L" }, "SY5240-5L"],
    [{ series: "3", actuation: "1", body: "40", voltage: "5", entry: "LO", light: "Z", port: "01", thread: "F" }, "SY3140-5LOZ-01F"],
    [{ series: "3", actuation: "1", body: "20", voltage: "5", entry: "W1", light: "Z", override: "E", port: "C4" }, "SY3120-5W1ZE-C4"],
    [{ series: "5", actuation: "A", body: "20", voltage: "5", entry: "WA3", light: "Z", port: "C6", mto: "X701" }, "SY5A20-5WA3Z-C6-X701"],
    [{ series: "3", actuation: "1", body: "20", voltage: "5", entry: "G", port: "M5", bracket: "F1", mto: "X90", ce: "Q" }, "SY3120-5G-M5-F1-X90-Q"],
    [{ series: "9", actuation: "3", body: "40", pilot: "R", voltage: "2", entry: "D", light: "Z", port: "04", thread: "N", ce: "Q" }, "SY9340R-2DZ-04N-Q"],
    [{ series: "5", actuation: "1", body: "20", coil: "T", voltage: "5", entry: "L", light: "Z", port: "01", bracket: "F2", mto: "X20" }, "SY5120T-5LZ-01-F2-X20"],
    [{ series: "7", actuation: "4", body: "40", voltage: "1", entry: "YO", port: "03", thread: "T" }, "SY7440-1YO-03T"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(syBuildCode(c), kod);
    assertEquals(syBuildCode(syParseCode(kod)!.config), kod, kod);
  }
  assertEquals(syParseCode("SY3000-3-1-24-G"), null, "den gamla mallen");
  assertEquals(syParseCode("SY3120-5LOZ"), null, "den gamla produktraden saknar port");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = syBuildCode;
  const bas: SYConfig = { series: "5", actuation: "1", body: "20", voltage: "5", entry: "L", port: "01" };
  assertEquals(b({ ...bas, actuation: "A" }), null, "A kräver X701");
  assertEquals(b({ ...bas, mto: "X701" }), null, "X701 kräver A/B/C");
  assertEquals(b({ ...bas, series: "3", actuation: "A", port: "M5", mto: "X701" }), null, "X701 inte SY3000");
  assertEquals(b({ ...bas, series: "9", port: "02", mto: "X20" }), null, "X20 inte SY9000");
  assertEquals(b({ ...bas, body: "40", port: "02", mto: "X20" }), null, "X20 inte basmonterad");
  assertEquals(b({ ...bas, pilot: "R" }), null, "R bara basmonterad");
  assert(b({ ...bas, body: "40", port: "02", pilot: "R" }));
  assertEquals(b({ ...bas, series: "3", body: "40", port: "", pilot: "R", entry: "D" }), null, "R inte SY3000 DIN");
  assertEquals(b({ ...bas, series: "3", body: "40", port: "01", entry: "D" }), null, "SY3000 DIN inte på underplatta");
  assert(b({ ...bas, series: "3", body: "40", port: "", entry: "D" }));
  assertEquals(b({ ...bas, coil: "T", light: "Z", voltage: "V" }), null, "T bara 24/12 V DC");
  assertEquals(b({ ...bas, coil: "T", light: "Z", entry: "D" }), null, "T inte DIN");
  assertEquals(b({ ...bas, coil: "T", light: "Z", entry: "W1" }), null, "T inte M8");
  assertEquals(b({ ...bas, coil: "T" }), null, "T kräver Z");
  assertEquals(b({ ...bas, entry: "W1", voltage: "1" }), null, "M8 bara DC");
  assertEquals(b({ ...bas, entry: "D", voltage: "S" }), null, "DIN inte 5 V DC");
  assert(b({ ...bas, entry: "G", voltage: "S" }));
  assertEquals(b({ ...bas, voltage: "1", light: "S" }), null, "S inte AC");
  assertEquals(b({ ...bas, voltage: "1", light: "U" }), null, "U inte AC");
  assert(b({ ...bas, voltage: "1", light: "Z" }));
  assertEquals(b({ ...bas, entry: "D", light: "R" }), null, "R inte DIN");
  assertEquals(b({ ...bas, entry: "DO", light: "Z" }), null, "DOZ finns inte");
  assert(b({ ...bas, entry: "DO", light: "S" }));
  assertEquals(b({ ...bas, port: "" }), null, "kroppsportad kräver port");
  assertEquals(b({ ...bas, port: "M5" }), null, "M5 bara SY3000");
  assertEquals(b({ ...bas, port: "C10" }), null, "ø10 inte SY5000");
  assertEquals(b({ ...bas, body: "40", port: "01" }), null, "underplatta 1/8 bara SY3000");
  assertEquals(b({ ...bas, body: "40", port: "C6" }), null, "underplattan är gängad");
  assertEquals(b({ ...bas, port: "C6", thread: "F" }), null, "gänga inte på snabbkoppling");
  assertEquals(b({ ...bas, series: "3", port: "M5", thread: "F" }), null, "M5 bara Rc");
  assertEquals(b({ ...bas, actuation: "A", port: "C6", mto: "X701", thread: "N" }), null);
  assertEquals(b({ ...bas, actuation: "A", mto: "X701", thread: "N" }), null, "X701 bara Rc/G");
  assert(b({ ...bas, actuation: "A", mto: "X701", thread: "F" }));
  assertEquals(b({ ...bas, actuation: "2", bracket: "F1" }), null, "F1 bara 2-läges enkel");
  assertEquals(b({ ...bas, series: "9", port: "02", bracket: "F2" }), null, "SY9000 utan fäste");
  assertEquals(b({ ...bas, body: "40", port: "02", bracket: "F2" }), null, "fäste bara kroppsportad");
  assertEquals(b({ ...bas, voltage: "1", ce: "Q" }), null, "Q med AC kräver DIN");
  assert(b({ ...bas, voltage: "1", entry: "D", ce: "Q" }));
  assert(b({ ...bas, ce: "Q" }), "Q med DC och plugg");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildSyDbRules();
function ctx(c: SYConfig): Record<string, unknown> {
  return {
    series: c.series, actuation: c.actuation, body: c.body, pilot: c.pilot ?? "", coil: c.coil ?? "", voltage: c.voltage, entry: c.entry, light: c.light ?? "",
    override: c.override ?? "", port: c.port ?? "", thread: c.thread ?? "", bracket: c.bracket ?? "", mto: c.mto ?? "", ce: c.ce ?? "",
  };
}
const kor = (c: SYConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: SYConfig) => kor(c, "error");

function kontrollera(namn: string, prov: SYConfig[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = syBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst, `${namn}: ${prov.length}`);
}

Deno.test("serie × funktion × kropp × pilot × port × gänga × fäste × special", () => {
  const prov: SYConfig[] = [];
  for (const s of SY_SERIES) for (const a of SY_ACTUATIONS) for (const body of SY_BODIES) for (const pilot of ["", "R"])
    for (const port of ["", ...SY_PORTS.map((p) => p.code)]) for (const thread of ["", "F", "N"]) for (const bracket of ["", ...SY_BRACKETS.map((b) => b.code)])
      for (const mto of ["", ...SY_MTO.map((x) => x.code)]) for (const entry of ["L", "D"])
        prov.push({ series: s.code, actuation: a.code, body: body.code, pilot: pilot || undefined, voltage: "5", entry, port: port || undefined, thread: thread || undefined, bracket: bracket || undefined, mto: mto || undefined });
  kontrollera("A", prov, 60000);
});

Deno.test("spänning × anslutning × ljus × spole × manöver × CE", () => {
  const prov: SYConfig[] = [];
  for (const v of SY_VOLTAGES) for (const en of SY_ENTRIES) for (const light of ["", ...SY_LIGHTS.map((l) => l.code)]) for (const coil of ["", "T"])
    for (const ov of ["", "E"]) for (const ce of ["", "Q"]) for (const body of SY_BODIES)
      prov.push({ series: "5", actuation: "1", body: body.code, voltage: v.code, entry: en.code, light: light || undefined, coil: coil || undefined, override: ov || undefined, port: body.code === "20" ? "01" : "02", ce: ce || undefined });
  kontrollera("B", prov, 15000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { series: "5", actuation: "1", body: "20", voltage: "5", entry: "L", port: "01" },
    { series: "5", actuation: "2", body: "40", voltage: "5", entry: "L" },
    { series: "3", actuation: "1", body: "40", voltage: "5", entry: "LO", light: "Z", port: "01", thread: "F" },
    { series: "9", actuation: "3", body: "40", pilot: "R", voltage: "2", entry: "D", light: "Z", port: "04", thread: "N", ce: "Q" },
    { series: "5", actuation: "1", body: "20", coil: "T", voltage: "5", entry: "L", light: "Z", port: "01", bracket: "F2", mto: "X20" },
  ] as SYConfig[]) {
    assertEquals(fillOrderCodeTemplate(SY_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["series", "actuation", "body", "voltage", "entry"])), syBuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const bas: SYConfig = { series: "5", actuation: "1", body: "20", voltage: "5", entry: "L", port: "01" };
  const f = fel({ ...bas, coil: "T" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("Z"), f[0]);
  const f2 = fel({ ...bas, series: "3", body: "40", port: "01", entry: "D" });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("standardunderplattan"), f2[0]);
  assert(kor(bas, "warn").some((m) => m.includes("Strömsparkretsen")));
  assertEquals(kor({ ...bas, entry: "D" }, "warn"), []);
  assert(kor({ ...bas, entry: "W1" }, "info").some((m) => m.includes("IP65")));
  assert(kor({ ...bas, entry: "WO" }, "info").some((m) => m.includes("V100-49-1")));
  assert(kor({ ...bas, series: "3", actuation: "3", port: "M5" }, "info").some((m) => m.includes("SY3000") && m.includes("3 Hz")));
  const tom = { series: "", actuation: "", body: "", voltage: "", entry: "" } as SYConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

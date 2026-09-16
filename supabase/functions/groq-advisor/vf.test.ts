/**
 * VF-modellen (VF1000/3000/5000 enkelventil) och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel VF3130-5G1-01 (sida 292) och VF3140KT-5GZD1-02
 * (sida 306), kontaktexemplen VF3130-5LO1-02 och VF3130-1LO1-02 (sida 340),
 * tabellerna för kroppsmodell, portstorlek, spänning, ljus/spärrdiod och
 * specialutförandena (sida 292, 305–306).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildVfDbRules } from "../../../src/lib/catalog/vf-db-rules.ts";
import {
  VF_ACTUATIONS,
  VF_BODIES,
  VF_BODY_OPTS,
  VF_ENTRIES,
  VF_LIGHTS,
  VF_MTO,
  VF_ORDER_CODE_TEMPLATE,
  VF_PORTS,
  VF_SERIES,
  VF_SOURCE,
  VF_THREADS,
  VF_VOLTAGES,
  type VFConfig,
  vfBuildCode,
  vfParseCode,
} from "../../../src/lib/catalog/vf.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(VF_SOURCE.file, "smc-kat-vf3000.pdf");
  assertEquals(VF_SERIES.map((s) => s.code), ["1", "3", "5"]);
  assertEquals(VF_SERIES.map((s) => s.body_ported), ["2", "3", "2"], "sida 292, body model");
  assertEquals(VF_SERIES.map((s) => s.ports_body), [["M5", "01"], ["01", "02"], ["02", "03"]]);
  assertEquals(VF_SERIES.map((s) => s.ports_base), [[], ["02", "03"], ["02", "03", "04"]], "sida 306");
  assertEquals(VF_SERIES.map((s) => s.freq_hz), [[10, null], [10, 3], [5, 3]], "sida 293");
  assertEquals(VF_ACTUATIONS.find((a) => a.code === "2")!.pressure, [0.1, 0.7]);
  assertEquals(VF_VOLTAGES.length, 8);
  assertEquals(VF_ENTRIES.length, 13);
  assertEquals(VF_LIGHTS.map((l) => l.ac), [false, true, false, false]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[VFConfig, string]> = [
    [{ series: "3", actuation: "1", body: "3", body_opt: "0", voltage: "5", entry: "G", port: "01" }, "VF3130-5G1-01"],
    [{ series: "3", actuation: "1", body: "4", body_opt: "0", pressure: "K", coil: "T", voltage: "5", entry: "G", light: "Z", override: "D", port: "02" }, "VF3140KT-5GZD1-02"],
    [{ series: "3", actuation: "1", body: "3", body_opt: "0", voltage: "5", entry: "LO", port: "02" }, "VF3130-5LO1-02"],
    [{ series: "3", actuation: "1", body: "3", body_opt: "0", voltage: "1", entry: "LO", port: "02" }, "VF3130-1LO1-02"],
    [{ series: "3", actuation: "1", body: "4", body_opt: "0", voltage: "5", entry: "D", light: "Z" }, "VF3140-5DZ1"],
    [{ series: "1", actuation: "2", body: "2", body_opt: "0", voltage: "B", entry: "G", port: "M5", bracket: "F" }, "VF1220-BG1-M5-F"],
    [{ series: "5", actuation: "3", body: "2", body_opt: "3", voltage: "2", entry: "T", light: "Z", port: "03", thread: "N", mto: "X600" }, "VF5323-2TZ1-03N-X600"],
    [{ series: "3", actuation: "5", body: "3", body_opt: "0", voltage: "6", entry: "DO", light: "S", port: "01", thread: "F", mto: "X500" }, "VF3530-6DOS1-01F-X500"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(vfBuildCode(c), kod);
    assertEquals(vfBuildCode(vfParseCode(kod)!.config), kod, kod);
  }
  assertEquals(vfParseCode("VF3000-3-1-24-G"), null, "den gamla mallen");
  assertEquals(vfParseCode("VF3130-5G-01"), null, "den fasta ettan saknas");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = vfBuildCode;
  const bas: VFConfig = { series: "3", actuation: "1", body: "3", body_opt: "0", voltage: "5", entry: "G", port: "01" };
  assertEquals(b({ ...bas, series: "1", body: "2", actuation: "3", port: "M5" }), null, "VF1000 bara 2-läges");
  assertEquals(b({ ...bas, body: "2" }), null, "VF3000 har kroppsmodell 3");
  assertEquals(b({ ...bas, series: "1", body: "4", port: "" }), null, "VF1000 inte basmonterad");
  assertEquals(b({ ...bas, series: "1", body: "2", body_opt: "3", port: "01" }), null, "VF1000 utan gemensam avluftning");
  assertEquals(b({ ...bas, coil: "T", voltage: "1", entry: "D", light: "Z" }), null, "T bara DC");
  assertEquals(b({ ...bas, coil: "T" }), null, "T kräver Z");
  assert(b({ ...bas, coil: "T", light: "Z" }));
  assertEquals(b({ ...bas, coil: "T", entry: "DO", light: "Z" }), null, "T med DO kräver S");
  assert(b({ ...bas, coil: "T", entry: "DO", light: "S" }));
  assertEquals(b({ ...bas, voltage: "1", entry: "D", light: "S" }), null, "S inte AC");
  assertEquals(b({ ...bas, voltage: "B", light: "U" }), null, "U inte AC");
  assert(b({ ...bas, voltage: "1", entry: "D", light: "Z" }));
  assertEquals(b({ ...bas, entry: "DO", light: "Z" }), null, "DOZ finns inte");
  assert(b({ ...bas, entry: "D", light: "Z" }), "DZ finns");
  assert(b({ ...bas, voltage: "1", entry: "G" }), "AC med grommet går, men utan CE (varning)");
  assertEquals(b({ ...bas, port: "" }), null, "kroppsportad kräver port");
  assertEquals(b({ ...bas, port: "M5" }), null, "M5 bara VF1000");
  assertEquals(b({ ...bas, port: "03" }), null, "3/8 kroppsportad bara VF5000");
  assertEquals(b({ ...bas, body: "4", port: "01" }), null, "underplatta 1/8 finns inte");
  assert(b({ ...bas, body: "4", port: "03" }));
  assertEquals(b({ ...bas, body: "4", port: "04" }), null, "1/2 bara VF5000");
  assert(b({ ...bas, series: "5", body: "4", port: "04" }));
  assertEquals(b({ ...bas, series: "1", body: "2", port: "M5", thread: "F" }), null, "M5 bara Rc");
  assertEquals(b({ ...bas, body: "4", port: "", thread: "N" }), null, "gänga utan underplatta");
  assertEquals(b({ ...bas, series: "5", body: "2", port: "02", bracket: "F" }), null, "fäste inte VF5000");
  assertEquals(b({ ...bas, body: "4", port: "02", bracket: "F" }), null, "fäste inte basmonterad");
  assertEquals(b({ ...bas, body_opt: "3", mto: "X500" }), null, "X500 kräver 0");
  assertEquals(b({ ...bas, body: "4", port: "02", mto: "X500" }), null, "X500 inte basmonterad");
  assertEquals(b({ ...bas, coil: "T", light: "Z", mto: "X500" }), null, "X500 inte med T");
  assertEquals(b({ ...bas, mto: "X600" }), null, "X600 bara AC");
  assert(b({ ...bas, voltage: "B", mto: "X600" }));
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildVfDbRules();
function ctx(c: VFConfig): Record<string, unknown> {
  return {
    series: c.series, actuation: c.actuation, body: c.body, body_opt: c.body_opt, pressure: c.pressure ?? "", coil: c.coil ?? "", voltage: c.voltage, entry: c.entry,
    light: c.light ?? "", override: c.override ?? "", port: c.port ?? "", thread: c.thread ?? "", bracket: c.bracket ?? "", mto: c.mto ?? "",
  };
}
const kor = (c: VFConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: VFConfig) => kor(c, "error");

function kontrollera(namn: string, prov: VFConfig[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = vfBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst, `${namn}: ${prov.length}`);
}

Deno.test("serie × funktion × kropp × avluftning × port × gänga × fäste × special", () => {
  const prov: VFConfig[] = [];
  for (const s of VF_SERIES) for (const a of VF_ACTUATIONS) for (const body of VF_BODIES) for (const opt of VF_BODY_OPTS)
    for (const port of ["", ...VF_PORTS.map((p) => p.code)]) for (const thread of ["", "N"]) for (const bracket of ["", "F"]) for (const mto of ["", ...VF_MTO.map((x) => x.code)])
      prov.push({ series: s.code, actuation: a.code, body: body.code, body_opt: opt.code, voltage: "5", entry: "G", port: port || undefined, thread: thread || undefined, bracket: bracket || undefined, mto: mto || undefined });
  kontrollera("A", prov, 6000);
});

Deno.test("spänning × anslutning × ljus × spole × manöver × special", () => {
  const prov: VFConfig[] = [];
  for (const v of VF_VOLTAGES) for (const en of VF_ENTRIES) for (const light of ["", ...VF_LIGHTS.map((l) => l.code)]) for (const coil of ["", "T"])
    for (const ov of ["", "D"]) for (const mto of ["", ...VF_MTO.map((x) => x.code)]) for (const thread of ["", ...VF_THREADS.map((t) => t.code)])
      prov.push({ series: "3", actuation: "2", body: "3", body_opt: "0", voltage: v.code, entry: en.code, light: light || undefined, coil: coil || undefined, override: ov || undefined, port: "02", thread: thread || undefined, mto: mto || undefined });
  kontrollera("B", prov, 12000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { series: "3", actuation: "1", body: "3", body_opt: "0", voltage: "5", entry: "G", port: "01" },
    { series: "3", actuation: "1", body: "4", body_opt: "0", pressure: "K", coil: "T", voltage: "5", entry: "G", light: "Z", override: "D", port: "02" },
    { series: "3", actuation: "1", body: "4", body_opt: "0", voltage: "5", entry: "D", light: "Z" },
    { series: "5", actuation: "3", body: "2", body_opt: "3", voltage: "2", entry: "T", light: "Z", port: "03", thread: "N", mto: "X600" },
    { series: "1", actuation: "2", body: "2", body_opt: "0", voltage: "B", entry: "G", port: "M5", bracket: "F" },
  ] as VFConfig[]) {
    assertEquals(fillOrderCodeTemplate(VF_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["series", "actuation", "body", "body_opt", "voltage", "entry"])), vfBuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const bas: VFConfig = { series: "3", actuation: "1", body: "3", body_opt: "0", voltage: "5", entry: "G", port: "01" };
  const f = fel({ ...bas, coil: "T" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("Z"), f[0]);
  const v = kor({ ...bas, voltage: "1", entry: "L" }, "warn");
  assert(v.some((m) => m.includes("CE/UKCA")), v.join(" | "));
  assertEquals(kor({ ...bas, voltage: "B", entry: "L", coil: undefined }, "warn").filter((m) => m.includes("CE/UKCA")), [], "24 VAC är CE med alla");
  assert(kor({ ...bas, entry: "D", body_opt: "0" }, "warn").some((m) => m.includes("IP65")));
  assert(kor({ ...bas, coil: undefined }, "warn").some((m) => m.includes("strömsparande")));
  assert(kor({ ...bas, series: "5", body: "2", actuation: "3", port: "02" }, "info").some((m) => m.includes("VF5000") && m.includes("3 Hz")));
  assert(kor({ ...bas, entry: "LO" }, "info").some((m) => m.includes("V200-30-4A")));
  assert(kor({ ...bas, pressure: "K" }, "info").some((m) => m.includes("UL")));
  const tom = { series: "", actuation: "", body: "", body_opt: "", voltage: "", entry: "" } as VFConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

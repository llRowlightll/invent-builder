/**
 * SY plug-in-ventilens modell (familjen sy-plugin) och dess regler mot
 * katalogen.
 *
 * Facit: nyckelns exempel SY3100-5U1 (sida 432 och 504), SY3130-5U1-C6
 * (sida 513), rampexemplens SY3200-5U1/SY3300-5U1 (sida 430),
 * distributörskoderna SY5100R-5UF1, SY3100H-5U1 och SY5200-5NZ1, ventildata
 * (sida 404), responstider (sida 405) och vikter (sida 406).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildSyPluginDbRules } from "../../../src/lib/catalog/sy-plugin-db-rules.ts";
import {
  SYP_ACTUATIONS,
  SYP_BODIES,
  SYP_DATA,
  SYP_LIGHTS,
  SYP_OPTIONS,
  SYP_ORDER_CODE_TEMPLATE,
  SYP_OVERRIDES,
  SYP_PORTS,
  SYP_SCREWS,
  SYP_SEALS,
  SYP_SERIES,
  SYP_SOURCE,
  SYP_THREADS,
  SYP_VOLTAGES,
  type SYPConfig,
  sypBuildCode,
  sypParseCode,
} from "../../../src/lib/catalog/sy-plugin.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(SYP_SOURCE.file, "smc-kat-sy-new.pdf");
  assertEquals(SYP_ACTUATIONS.map((a) => a.code).join(""), "12345ABC", "sida 432");
  assertEquals(SYP_ACTUATIONS.filter((a) => a.rubber_only).map((a) => a.code), ["A", "B", "C"]);
  assertEquals(SYP_ACTUATIONS.find((a) => a.code === "2")!.pressure, [0.1, 0.7], "sida 404");
  assertEquals(SYP_ACTUATIONS.find((a) => a.code === "3")!.pressure, [0.2, 0.7]);
  assertEquals(SYP_BODIES.map((b) => b.code), ["0", "3"]);
  assertEquals(SYP_SEALS.map((s) => s.code), ["0", "1"]);
  assertEquals(SYP_VOLTAGES.map((v) => v.code), ["5", "6"], "sida 432");
  assertEquals(SYP_LIGHTS.map((l) => l.code), ["R", "U", "S", "Z", "NS", "NZ"]);
  assertEquals(SYP_OVERRIDES.map((o) => o.code), ["D", "E", "F"]);
  assertEquals(SYP_SCREWS.map((s) => s.code), ["B", "K", "H"]);
  assertEquals(SYP_THREADS.map((t) => t.code), ["F", "N", "T"]);
  assertEquals(SYP_PORTS.filter((p) => p.series.includes("3")).map((p) => p.code), ["M5", "C2", "C3", "C4", "C6", "N1", "N3", "N7"], "sida 513");
  assertEquals(SYP_PORTS.filter((p) => p.series.includes("7")).map((p) => p.code), ["02", "C6", "C8", "C10", "C12", "N7", "N9", "N11"]);
  assertEquals(SYP_DATA["3"].weight["1"], [74, 76], "sida 406");
  assertEquals(SYP_DATA["5"].weight["3"], [100, 111]);
  assertEquals(SYP_DATA["7"].weight["4"], [114, null]);
  assertEquals(SYP_DATA["7"].freq["2"], [5, 10], "sida 404");
  assertEquals(SYP_DATA["3"].freq["2"], [5, 20]);
  assertEquals(SYP_DATA["7"].response["1"], [47, 39], "sida 405");
  assertEquals(SYP_DATA["5"].response["4"], [35, null]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[SYPConfig, string]> = [
    [{ series: "3", actuation: "1", body: "0", seal: "0", voltage: "5", light: "U" }, "SY3100-5U1"],
    [{ series: "3", actuation: "2", body: "0", seal: "0", voltage: "5", light: "U" }, "SY3200-5U1"],
    [{ series: "3", actuation: "3", body: "0", seal: "0", voltage: "5", light: "U" }, "SY3300-5U1"],
    [{ series: "3", actuation: "1", body: "3", seal: "0", voltage: "5", light: "U", port: "C6" }, "SY3130-5U1-C6"],
    [{ series: "5", actuation: "1", body: "0", seal: "0", pilot: "R", voltage: "5", light: "U", override: "F" }, "SY5100R-5UF1"],
    [{ series: "3", actuation: "1", body: "0", seal: "0", check: "H", voltage: "5", light: "U" }, "SY3100H-5U1"],
    [{ series: "5", actuation: "2", body: "0", seal: "0", voltage: "5", light: "NZ" }, "SY5200-5NZ1"],
    [{ series: "5", actuation: "1", body: "3", seal: "0", voltage: "5", light: "U", port: "01", thread: "F", screw: "B" }, "SY5130-5U1-01FB"],
    [{ series: "3", actuation: "1", body: "0", seal: "1", option: "K", voltage: "5", light: "Z" }, "SY3101K-5Z1"],
    [{ series: "3", actuation: "1", body: "0", seal: "0", coil: "T", voltage: "5", light: "Z" }, "SY3100T-5Z1"],
    [{ series: "7", actuation: "A", body: "0", seal: "0", voltage: "6" }, "SY7A00-61"],
    [{ series: "3", actuation: "1", body: "0", seal: "0", voltage: "5", light: "U", screw: "K" }, "SY3100-5U1-K"],
    [{ series: "3", actuation: "1", body: "3", seal: "1", voltage: "5", light: "R", override: "D", port: "M5" }, "SY3131-5RD1-M5"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(sypBuildCode(c), kod);
    assertEquals(sypBuildCode(sypParseCode(kod)!.config), kod, kod);
  }
  assertEquals(sypParseCode("SY3A01-5U1"), null, "4-läges bara gummi");
  assertEquals(sypParseCode("SY7100H-5U1"), null, "backventil inte SY7000");
  assertEquals(sypParseCode("SY3300H-5U1"), null, "backventil inte 3-läges");
  assertEquals(sypParseCode("SY3100T-5U1"), null, "strömspar bara Z/NZ");
  assertEquals(sypParseCode("SY3130-5U1-M5F"), null, "M5 utan gängtyp");
  assertEquals(sypParseCode("SY3130-5U1-C8"), null, "ø8 inte SY3000");
  assertEquals(sypParseCode("SY3100-5U1-C6"), null, "basmonterad har ingen port");
  assertEquals(sypParseCode("SY3130-5U1"), null, "topportad kräver port");
  assertEquals(sypParseCode("SY3120-5LZ-C6"), null, "kroppsportad ventil är en annan nyckel");
  assertEquals(sypParseCode("SY3100-5U"), null, "ettan ligger fast");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildSyPluginDbRules();
function ctx(c: SYPConfig): Record<string, unknown> {
  return {
    series: c.series, actuation: c.actuation, body: c.body, seal: c.seal, pilot: c.pilot ?? "", check: c.check ?? "", option: c.option ?? "",
    coil: c.coil ?? "", voltage: c.voltage, light: c.light ?? "", override: c.override ?? "", port: c.port ?? "", thread: c.thread ?? "", screw: c.screw ?? "",
  };
}
const kor = (c: SYPConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: SYPConfig) => kor(c, "error");

function jamfor(configs: Iterable<SYPConfig>, vad: string) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const c of configs) {
    n++;
    const kod = sypBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${vad}: ${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${vad}: ${falsklarm.length} falsklarm`);
  return n;
}

Deno.test("serie × funktion × tätning × pilot × backventil × tillval × spole × ljus, uttömmande", () => {
  function* g() {
    for (const s of SYP_SERIES) for (const a of SYP_ACTUATIONS) for (const seal of SYP_SEALS) for (const pilot of ["", "R"]) for (const check of ["", "H"]) for (const option of ["", ...SYP_OPTIONS.map((o) => o.code)]) for (const coil of ["", "T"]) for (const light of ["", ...SYP_LIGHTS.map((l) => l.code)]) {
      yield { series: s.code, actuation: a.code, body: "0", seal: seal.code, pilot: pilot || undefined, check: check || undefined, option: option || undefined, coil: coil || undefined, voltage: "5", light: light || undefined } as SYPConfig;
    }
  }
  assertEquals(jamfor(g(), "ventil"), 3 * 8 * 2 * 2 * 2 * 3 * 2 * 7);
});

Deno.test("kropp × serie × port × gänga × skruv, uttömmande", () => {
  function* g() {
    for (const b of SYP_BODIES) for (const s of SYP_SERIES) for (const port of ["", ...SYP_PORTS.map((p) => p.code)]) for (const thread of ["", ...SYP_THREADS.map((t) => t.code)]) for (const screw of ["", ...SYP_SCREWS.map((x) => x.code)]) {
      yield { series: s.code, actuation: "1", body: b.code, seal: "0", voltage: "5", light: "U", port: port || undefined, thread: thread || undefined, screw: screw || undefined } as SYPConfig;
    }
  }
  assertEquals(jamfor(g(), "port"), 2 * 3 * 16 * 4 * 4);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const req = new Set(["series", "actuation", "body", "seal", "voltage"]);
  for (const c of [
    { series: "3", actuation: "1", body: "0", seal: "0", voltage: "5", light: "U" },
    { series: "3", actuation: "1", body: "3", seal: "0", voltage: "5", light: "U", port: "C6" },
    { series: "5", actuation: "1", body: "0", seal: "0", pilot: "R", voltage: "5", light: "U", override: "F" },
    { series: "5", actuation: "1", body: "3", seal: "0", voltage: "5", light: "U", port: "01", thread: "F", screw: "B" },
    { series: "3", actuation: "1", body: "0", seal: "0", voltage: "5", light: "U", screw: "K" },
    { series: "7", actuation: "A", body: "0", seal: "0", voltage: "6" },
  ] as SYPConfig[]) {
    assertEquals(fillOrderCodeTemplate(SYP_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, req), sypBuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const bas: SYPConfig = { series: "3", actuation: "1", body: "0", seal: "0", voltage: "5", light: "U" };
  const f = fel({ ...bas, actuation: "A", seal: "1" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("gummitätning"), f[0]);
  const f2 = fel({ ...bas, coil: "T" });
  assert(f2[0].includes("Z (pluskommun) eller NZ"), f2.join(" | "));
  const f3 = fel({ ...bas, body: "3", port: "C8" });
  assert(f3[0].includes("M5, C2, C3, C4, C6, N1, N3 och N7"), f3.join(" | "));
  const f4 = fel({ ...bas, body: "3", port: "M5", thread: "F" });
  assert(f4[0].includes("M5"), f4.join(" | "));
  const i = kor(bas, "info");
  assert(i.some((m) => m.includes("SY31□0") && m.includes("0,15–0,7 MPa") && m.includes("5 Hz") && m.includes("15 ms") && m.includes("74 g")), i.join(" | "));
  assert(i.some((m) => m.includes("opolär")), i.join(" | "));
  const i2 = kor({ ...bas, series: "7", actuation: "2", seal: "1", option: "K", light: "NZ", coil: "T" }, "info");
  assert(i2.some((m) => m.includes("SY72□1") && m.includes("0,1–1,0") && m.includes("10 Hz") && m.includes("133 g")), i2.join(" | "));
  assert(i2.some((m) => m.includes("Högtryck")), i2.join(" | "));
  assert(i2.some((m) => m.includes("hålleffekt 0,1 W")), i2.join(" | "));
  const w = kor({ ...bas, light: undefined }, "warn");
  assert(w.some((m) => m.includes("EX600")), w.join(" | "));
  assertEquals(kor(bas, "warn"), []);
  const tom = { series: "", actuation: "", body: "", seal: "", voltage: "" } as SYPConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

/**
 * KQ2-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel KQ2H06-01AS1 (sida 6), KQ2H06-01AS (sida 102),
 * KQ2H06-G01A1 (sida 58), KQ2H06-01AP1 (sida 66), KQ2H06-U01A1 (sida 88),
 * KQ2H06-00A1 (sida 6), måttabellernas modellnummer (kq2-models.ts, lästa
 * av scripts/extract-kq2-models.py), M3 bara i rostfritt (sida 6),
 * honkopplingarna utan S (sida 9–27), data sida 4.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildKq2DbRules } from "../../../src/lib/catalog/kq2-db-rules.ts";
import { KQ2_MODELS } from "../../../src/lib/catalog/kq2-models.ts";
import {
  KQ2_LIMITS,
  KQ2_MATERIALS,
  KQ2_MTO,
  KQ2_ORDER_CODE_TEMPLATE,
  KQ2_PORTS,
  KQ2_SEALS,
  KQ2_SOURCE,
  KQ2_TUBES,
  KQ2_TYPES,
  type KQ2Config,
  kq2Allowed,
  kq2BuildCode,
  kq2Entries,
  kq2ParseCode,
} from "../../../src/lib/catalog/kq2.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(KQ2_SOURCE.file, "smc-kat-kq2.pdf");
  assertEquals(KQ2_TUBES.filter((t) => !t.inch).map((t) => t.mm), [2, 3.2, 4, 6, 8, 10, 12, 16]);
  assertEquals(KQ2_TUBES.filter((t) => t.inch).map((t) => t.code), ["01", "03", "05", "07", "09", "11", "13"], "sida 31 och 134: ø1/8\"–ø1/2\"");
  assertEquals(KQ2_TYPES.length, 32);
  assertEquals(KQ2_PORTS.filter((p) => p.kind === "thread").map((p) => p.code), ["M3", "M5", "M6", "01", "02", "03", "04", "G01", "G02", "G03", "G04", "U01", "U02", "U03", "U04", "32", "33", "34", "35", "36", "37"]);
  assertEquals(KQ2_PORTS.filter((p) => p.r_thread).map((p) => p.code), ["01", "02", "03", "04", "33", "34", "35", "36", "37"], "S/P på R och NPT; 10-32 UNF tätar med gasket (sida 31)");
  assertEquals(KQ2_MATERIALS.map((m) => m.code), ["A", "N", "G"]);
  assertEquals(KQ2_SEALS.map((s) => s.code), ["S", "P"]);
  assertEquals(KQ2_LIMITS.pressure_kpa, [-100, 1000], "sida 4");
  assertEquals(KQ2_LIMITS.temp_c, [-5, 60]);
  assertEquals(Object.keys(KQ2_MODELS).sort(), ["oval|G", "oval|IMR", "oval|INP", "oval|IR", "oval|IU", "oval|MR", "oval|RP", "oval|U", "oval|UN", "round|G", "round|IMR", "round|INP", "round|IR", "round|IU", "round|MR", "round|RP", "round|U", "round|UN"]);
  const n = Object.values(KQ2_MODELS).reduce((a, tab) => a + Object.values(tab).reduce((b, tubes) => b + Object.values(tubes).reduce((c, ports) => c + ports.length, 0), 0), 0);
  assert(n >= 2800, `${n} poster`);
  // tumkapitlen (sida 31, 138, 152, 160, 191)
  assertEquals(kq2Allowed("oval", "H")["05"].sort(), ["00A", "01", "02", "07A", "32", "34", "35", "M5", "U01", "U02"], "sida 34, 53, 99");
  assertEquals(kq2Allowed("round", "H")["13"].sort(), ["00A", "02", "03", "04", "35", "36", "37", "U02", "U03", "U04"], "sida 138, 163, 215");
  assertEquals(kq2Allowed("round", "N")["01"].sort(), ["03", "05", "99"], "reducernipplar till ø5/32\" och ø3/16\" (sida 152)");
  assertEquals(kq2Entries("round", "N", "01").get("03"), "-", "porten 03 är nippeln, inte R3/8, för N med tumslang");
  assertEquals(kq2Entries("round", "N", "10").get("03"), "", "…men R3/8-adaptern KQ2N10-03AS för metrisk slang");
  // S- och P-kapitlen listar samma poster även för tum (sida 31/75 och 51/83)
  for (const b of ["oval", "round"] as const) for (const [sCh, pCh] of [["UN", "INP"], ["IMR", "IR"]]) {
    const sPoster = new Set<string>(); const pPoster = new Set<string>();
    for (const [t, tubes] of Object.entries(KQ2_MODELS[`${b}|${sCh}`])) for (const [tube, ports] of Object.entries(tubes)) for (const e of ports) if (e.endsWith("S")) sPoster.add(`${t}|${tube}|${e.slice(0, -1)}`);
    for (const [t, tubes] of Object.entries(KQ2_MODELS[`${b}|${pCh}`])) for (const [tube, ports] of Object.entries(tubes)) for (const e of ports) if (e.endsWith("P")) pPoster.add(`${t}|${tube}|${e.slice(0, -1)}`);
    assertEquals([...sPoster].sort(), [...pPoster].sort(), `${b} ${sCh}/${pCh}`);
  }
  // måttabellernas exempel
  assertEquals(kq2Allowed("round", "H")["04"].sort(), ["00A", "01", "02", "06A", "08A", "G01", "G02", "M3", "M5", "M6", "U01", "U02"], "sida 105–106, 168, 204");
  assertEquals(kq2Allowed("round", "F")["06"].sort(), ["01", "02", "03", "G01", "G02", "G03", "M5"], "sida 106 och 169");
  assertEquals(Object.keys(kq2Allowed("oval", "H")).sort(), ["01", "02", "03", "04", "05", "06", "23"], "oval bara ø3,2–ø6 och tum ø1/8\"–ø3/16\" (sida 1 och 31); ø2 bara som reducering");
  assertEquals(Object.keys(kq2Allowed("oval", "LU")), [], "grenvinkeln bara rund");
  assertEquals(kq2Entries("round", "H", "23").get("M3"), "G", "M3 bara rostfritt");
  assertEquals(kq2Entries("round", "N", "04").get("99"), "-", "nippeln utan materialbokstav");
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[KQ2Config, string]> = [
    [{ type: "H", tube: "06", port: "01", material: "A", seal: "S", button: "1" }, "KQ2H06-01AS1"],
    [{ type: "H", tube: "06", port: "01", material: "A", seal: "S" }, "KQ2H06-01AS"],
    [{ type: "H", tube: "06", port: "G01", material: "A", button: "1" }, "KQ2H06-G01A1"],
    [{ type: "H", tube: "06", port: "01", material: "A", seal: "P", button: "1" }, "KQ2H06-01AP1"],
    [{ type: "H", tube: "06", port: "U01", material: "A", button: "1" }, "KQ2H06-U01A1"],
    [{ type: "H", tube: "06", port: "00A", button: "1" }, "KQ2H06-00A1"],
    [{ type: "H", tube: "23", port: "M3", material: "G", button: "1" }, "KQ2H23-M3G1"],
    [{ type: "H", tube: "04", port: "M5", material: "A" }, "KQ2H04-M5A"],
    [{ type: "L", tube: "06", port: "01", material: "A" }, "KQ2L06-01A"],
    [{ type: "T", tube: "06", port: "00A" }, "KQ2T06-00A"],
    [{ type: "H", tube: "04", port: "08A" }, "KQ2H04-08A"],
    [{ type: "N", tube: "04", port: "99" }, "KQ2N04-99"],
    [{ type: "N", tube: "06", port: "01", material: "N", seal: "S" }, "KQ2N06-01NS"],
    [{ type: "E", tube: "04", port: "00", material: "N" }, "KQ2E04-00N"],
    [{ type: "F", tube: "08", port: "02", material: "A" }, "KQ2F08-02A"],
    [{ type: "ZT", tube: "12", port: "04", material: "N", seal: "P" }, "KQ2ZT12-04NP"],
    [{ type: "C", tube: "16", port: "00A" }, "KQ2C16-00A"],
    [{ type: "VD", tube: "08", port: "04", material: "A", seal: "S" }, "KQ2VD08-04AS"],
    [{ type: "H", tube: "05", port: "34", material: "A", seal: "S", button: "1" }, "KQ2H05-34AS1"],
    [{ type: "H", tube: "05", port: "34", material: "A", seal: "P", button: "1" }, "KQ2H05-34AP1"],
    [{ type: "H", tube: "05", port: "32", material: "A", button: "1" }, "KQ2H05-32A1"],
    [{ type: "H", tube: "05", port: "01", material: "A", seal: "S", button: "1" }, "KQ2H05-01AS1"],
    [{ type: "H", tube: "05", port: "U01", material: "A", button: "1" }, "KQ2H05-U01A1"],
    [{ type: "H", tube: "01", port: "03A", button: "1" }, "KQ2H01-03A1"],
    [{ type: "N", tube: "01", port: "03" }, "KQ2N01-03"],
    [{ type: "H", tube: "13", port: "37", material: "N", seal: "P" }, "KQ2H13-37NP"],
    [{ type: "E", tube: "05", port: "34", material: "A" }, "KQ2E05-34A"],
    [{ type: "H", tube: "06", port: "02", material: "N", seal: "S", button: "1", clean: "10-" }, "10-KQ2H06-02NS1"],
    [{ type: "H", tube: "06", port: "00A", button: "1", clean: "10-" }, "10-KQ2H06-00A1"],
    [{ type: "L", tube: "08", port: "01", material: "A", q: "Q", seal: "S" }, "KQ2L08-01AQS"],
    [{ type: "E", tube: "04", port: "00", material: "A", kje: "J" }, "KQ2E04-00AJ"],
    [{ type: "E", tube: "01", port: "00", material: "N", kje: "J" }, "KQ2E01-00NJ"],
    [{ type: "H", tube: "06", port: "01", material: "A", seal: "S", button: "1", mto: "-X12" }, "KQ2H06-01AS1-X12"],
    [{ type: "L", tube: "06", port: "01", material: "A", seal: "S", mto: "-X35" }, "KQ2L06-01AS-X35"],
    [{ type: "L", tube: "08", port: "01", material: "N", q: "Q", seal: "S", clean: "10-", mto: "-X12" }, "10-KQ2L08-01NQS-X12"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(kq2BuildCode(c), kod);
    assertEquals(kq2BuildCode(kq2ParseCode(kod)!.config), kod, kod);
  }
  assertEquals(kq2ParseCode("KQ2H06-01S"), null, "gamla nyckeln utan materialbokstav");
  assertEquals(kq2ParseCode("KQ2T06-00"), null, "slangkopplingen utan A");
  assertEquals(kq2ParseCode("10-KQ2H06-02NS")!.config.clean, "10-", "Clean-serien (sida 28)");
  assertEquals(kq2ParseCode("10-KQ2H06-02AS"), null, "Clean bara förnicklat");
  assertEquals(kq2ParseCode("KQ2H08-01AQS"), null, "Q bara L/K/LF/W/T/Y");
  assertEquals(kq2ParseCode("KQ2L06-01AQS"), null, "Q bara ø8");
  assertEquals(kq2ParseCode("KQ2E08-00AJ"), null, "J bara ø2–ø6 och små tummått");
  assertEquals(kq2ParseCode("KQ2E04-00AJ1"), null, "J bara rund knapp");
  assertEquals(kq2ParseCode("KQ2H06-01AS-X35"), null, "X35 inte för H");
  assertEquals(kq2ParseCode("KQ2H06-01AS-X17"), null, "de äldre specialutförandena");
  assertEquals(kq2ParseCode("KQ2P-06"), null, "pluggen har egen kodform");
  assertEquals(kq2ParseCode("KQ2H07-01AS")!.config.tube, "07", "tumslang ø1/4\" med R1/8 (sida 160)");
  assertEquals(kq2ParseCode("KQ2H06-N01AS"), null, "NPT heter 33–37, inte N01");
  assertEquals(kq2ParseCode("KQ2H05-32AS1"), null, "10-32 UNF utan tätningsmedel");
  assertEquals(kq2ParseCode("KQ2H05-34G1"), null, "tumslang inte i rostfritt");
  assertEquals(kq2ParseCode("KQ2N01-03A"), null, "reducernippeln utan materialbokstav");
  assertEquals(kq2ParseCode("KQ2H06-34AS"), null, "NPT bara med tumslang");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = kq2BuildCode;
  assertEquals(b({ type: "H", tube: "06", port: "04", material: "A", seal: "S" }), null, "ø6 finns inte med R1/2");
  assert(b({ type: "H", tube: "12", port: "04", material: "A", seal: "S" }));
  assertEquals(b({ type: "H", tube: "23", port: "M3", material: "A" }), null, "M3 bara G");
  assertEquals(b({ type: "H", tube: "04", port: "M5", material: "G" }), null, "G bara M3");
  assertEquals(b({ type: "H", tube: "04", port: "M5" }), null, "gänga utan material");
  assertEquals(b({ type: "H", tube: "04", port: "M5", material: "A", seal: "S" }), null, "M5 utan tätningsmedel");
  assertEquals(b({ type: "H", tube: "06", port: "G01", material: "A", seal: "P" }), null, "G har plantätningen inbyggd");
  assertEquals(b({ type: "F", tube: "04", port: "01", material: "A", seal: "S" }), null, "honkoppling utan S");
  assertEquals(b({ type: "H", tube: "06", port: "00A", material: "A" }), null, "A ingår i 00A");
  assertEquals(b({ type: "N", tube: "04", port: "99", material: "A" }), null, "nippel utan material");
  assertEquals(b({ type: "LU", tube: "04", port: "01", material: "A", seal: "S", button: "1" }), null, "LU bara rund");
  assertEquals(b({ type: "H", tube: "08", port: "01", material: "A", seal: "S", button: "1" }), null, "oval bara ø3,2–ø6");
  assertEquals(b({ type: "H", tube: "16", port: "01", material: "A", seal: "S" }), null, "ø16 börjar vid R1/4");
  assertEquals(b({ type: "R", tube: "06", port: "01", material: "A", seal: "S" }), null, "reduceringen har ingen gänga");
  assertEquals(b({ type: "H", tube: "06", port: "N01", material: "A" }), null);
  assertEquals(b({ type: "H", tube: "07", port: "01", material: "A" }), "KQ2H07-01A");
  assertEquals(b({ type: "H", tube: "13", port: "33", material: "A", seal: "S" }), null, "NPT1/16 bara på små slangmått");
  assert(b({ type: "H", tube: "07", port: "33", material: "A", seal: "S" }), "KQ2H07-33AS, sida 138");
  assertEquals(b({ type: "N", tube: "01", port: "03", material: "A" }), null, "nippeln utan material");
  assertEquals(b({ type: "H", tube: "01", port: "03", material: "A", seal: "S" }), null, "ø1/8\" har ingen R3/8");
  assertEquals(b({ type: "H", tube: "06", port: "01", material: "A", button: "2" }), null);
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildKq2DbRules();
function ctx(c: KQ2Config): Record<string, unknown> {
  return { button: c.button ?? "", type: c.type, tube: c.tube, port: c.port, material: c.material ?? "", seal: c.seal ?? "", clean: c.clean ?? "", q: c.q ?? "", kje: c.kje ?? "", mto: c.mto ?? "" };
}
const kor = (c: KQ2Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: KQ2Config) => kor(c, "error");

Deno.test("knapp × typ × slang × port × material × tätning", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  // Alla knappar, typer, slangar och portar; material och tätning där de kan spela roll
  // (gänga: alla; slang/nippel: tomt och ett felaktigt val).
  // Oval knapp finns bara för ø3,2–ø6 och tum ø1/8"–ø3/16"; de övriga slangarna företräds av ø8 och ø1/4".
  const ovalTubes = ["23", "04", "06", "01", "03", "05", "02", "08", "07"];
  for (const button of ["", "1"]) for (const t of KQ2_TYPES) for (const tube of KQ2_TUBES) {
    if (button === "1" && !ovalTubes.includes(tube.code)) continue;
    for (const p of KQ2_PORTS) for (const material of p.kind === "thread" || p.kind === "bulkhead" ? ["", ...KQ2_MATERIALS.map((m) => m.code)] : ["", "A"]) for (const seal of p.r_thread ? ["", ...KQ2_SEALS.map((s) => s.code)] : ["", "S"]) {
      const c: KQ2Config = { type: t.code, tube: tube.code, port: p.code, material: material || undefined, seal: seal || undefined, button: button || undefined };
      n++;
      const kod = kq2BuildCode(c);
      const f = fel(c);
      if (!kod && f.length === 0) missade.push(JSON.stringify(c));
      if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
    }
  }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assert(n >= 60000, `${n}`);
});

Deno.test("Clean × Q × KJE × specialutförande mot modellen", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  const baser: KQ2Config[] = [
    { type: "H", tube: "06", port: "01", material: "A", seal: "S", button: "1" },
    { type: "H", tube: "06", port: "01", material: "N", seal: "S" },
    { type: "H", tube: "06", port: "00A" },
    { type: "L", tube: "08", port: "01", material: "A", seal: "S" },
    { type: "L", tube: "08", port: "02", material: "A", seal: "S" },
    { type: "T", tube: "08", port: "01", material: "N" },
    { type: "K", tube: "06", port: "01", material: "A" },
    { type: "E", tube: "04", port: "00", material: "A" },
    { type: "E", tube: "01", port: "00", material: "N" },
    { type: "E", tube: "08", port: "00", material: "A" },
    { type: "E", tube: "04", port: "00", material: "A", button: "1" },
    { type: "LE", tube: "04", port: "00", material: "A" },
    { type: "N", tube: "04", port: "99" },
    { type: "S", tube: "06", port: "01", material: "A" },
    { type: "F", tube: "06", port: "01", material: "A" },
    { type: "C", tube: "06", port: "00A" },
  ];
  for (const bas of baser) for (const clean of ["", "10-"]) for (const q of ["", "Q"]) for (const kje of ["", "J"]) for (const mto of ["", ...KQ2_MTO.map((m) => m.code)]) {
    const c: KQ2Config = { ...bas, clean: clean || undefined, q: q || undefined, kje: kje || undefined, mto: mto || undefined };
    n++;
    const kod = kq2BuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assertEquals(n, 16 * 2 * 2 * 2 * 4);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  for (const c of [
    { type: "H", tube: "06", port: "01", material: "A", seal: "S", button: "1" },
    { type: "H", tube: "06", port: "00A" },
    { type: "H", tube: "23", port: "M3", material: "G" },
    { type: "N", tube: "04", port: "99" },
    { type: "E", tube: "04", port: "00", material: "N" },
    { type: "H", tube: "06", port: "02", material: "N", seal: "S", button: "1", clean: "10-" },
    { type: "L", tube: "08", port: "01", material: "A", q: "Q", seal: "S" },
    { type: "E", tube: "04", port: "00", material: "A", kje: "J" },
    { type: "H", tube: "06", port: "01", material: "A", seal: "S", button: "1", mto: "-X12" },
    { type: "H", tube: "05", port: "34", material: "A", seal: "P", button: "1" },
    { type: "ZT", tube: "12", port: "04", material: "N", seal: "P" },
  ] as KQ2Config[]) {
    assertEquals(fillOrderCodeTemplate(KQ2_ORDER_CODE_TEMPLATE, ctx(c) as Record<string, string | number>, new Set(["type", "tube", "port"])), kq2BuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const f = fel({ type: "H", tube: "06", port: "04", material: "A", seal: "S" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("KQ2H ø6 mm") && f[0].includes("03 (R/Rc 3/8)"), f[0]);
  const f2 = fel({ type: "H", tube: "23", port: "M3", material: "A" });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("rostfritt"), f2[0]);
  const f3 = fel({ type: "LU", tube: "04", port: "01", material: "A", seal: "S", button: "1" });
  assertEquals(f3.length, 1, f3.join(" | "));
  assert(f3[0].includes("bara med rund"), f3[0]);
  const f4 = fel({ type: "F", tube: "04", port: "01", material: "A", seal: "S" });
  assertEquals(f4.length, 1, f4.join(" | "));
  assert(f4[0].includes("Rc-gänga utan tätning"), f4[0]);
  const i = kor({ type: "H", tube: "06", port: "01", material: "A" }, "info");
  assert(i.some((m) => m.includes("utan tätning (Nil)")), i.join(" | "));
  assert(i.some((m) => m.includes("−100 kPa") || m.includes("-100 kPa")), i.join(" | "));
  assertEquals(kor({ type: "H", tube: "06", port: "01", material: "A", seal: "S" }, "warn"), []);
  const tom = { type: "", tube: "", port: "" } as KQ2Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

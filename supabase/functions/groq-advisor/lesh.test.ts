/**
 * LESH-modellen och dess regler mot katalogen.
 *
 * Facit: nycklarnas LESH25REJ-50-R1CD17T (sida 705), LESH8RJ-50-S1 och
 * styrenhetsexemplen CD17T/AN1 (sida 715–716); data per storlek, stigning
 * och motortyp (sida 707, 718, 719); låstabellen (sida 715).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildLeshDbRules } from "../../../src/lib/catalog/lesh-db-rules.ts";
import {
  LESH_CABLES,
  LESH_CONTROLLERS,
  LESH_CTRL_ACCS,
  LESH_CTRL_MOUNTS,
  LESH_IO_CABLES,
  LESH_MOUNTS,
  LESH_ORDER_CODE_TEMPLATE,
  LESH_SIZES,
  LESH_SOURCE,
  LESH_STROKES,
  type LESHConfig,
  leshBuildCode,
  leshParseCode,
} from "../../../src/lib/catalog/lesh.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(LESH_SOURCE.file, "smc-kat-lesh.pdf");
  assertEquals(LESH_SIZES.map((s) => [s.size, s.lead_mm.J, s.lead_mm.K, s.lock_n]), [[8, 8, 4, 24], [16, 10, 5, 300], [25, 16, 8, 500]]);
  assertEquals(LESH_SIZES.map((s) => s.strokes), [[50, 75], [50, 100], [50, 100, 150]]);
  assertEquals(LESH_CONTROLLERS.filter((c) => c.code.endsWith("F")).map((c) => c.code), ["CEF", "C9F", "CPF", "CLF"], "STO bara EtherCAT, EtherNet/IP, PROFINET, IO-Link");
  // sida 718: steg 25/K 12 kg, 77–180 N, 10–150 mm/s; sida 719: servo 25/J 4 kg, 19–38 N
  assertEquals(LESH_SIZES[2].perf[""].K, { load_h_kg: 12, load_v_kg: 4, push_n: [77, 180], speed: [10, 150] });
  assertEquals(LESH_SIZES[2].perf.A.J, { load_h_kg: 4, load_v_kg: 1.5, push_n: [19, 38], speed: [1, 400] });
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[LESHConfig, string]> = [
    [{ size: "25", mount: "R", motor: "E", lead: "J", stroke: "50", cable: "R1", ctrl: "CD1", ctrl_mount: "7", ctrl_acc: "T" }, "LESH25REJ-50-R1CD17T"],
    [{ size: "8", mount: "R", lead: "J", stroke: "50", cable: "S1" }, "LESH8RJ-50-S1"],
    [{ size: "8", mount: "R", lead: "J", stroke: "50", cable: "S1", ctrl: "AN", io_cable: "1" }, "LESH8RJ-50-S1AN1"],
    [{ size: "16", mount: "L", motor: "A", lead: "K", stroke: "100", lock: "B", cable: "R3", ctrl: "6P", io_cable: "3", ctrl_mount: "D" }, "LESH16LAK-100B-R36P3D"],
    [{ size: "25", mount: "D", lead: "K", stroke: "150", lock: "B", body: "S", holder: "H", cable: "R5", ctrl: "C9F", ctrl_mount: "8" }, "LESH25DK-150BSH-R5C9F8"],
    [{ size: "25", mount: "L", motor: "E", lead: "K", stroke: "100", cable: "RC", ctrl: "C51", ctrl_mount: "7", ctrl_acc: "5" }, "LESH25LEK-100-RCC5175"],
    [{ size: "16", mount: "D", lead: "J", stroke: "50" }, "LESH16DJ-50"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(leshBuildCode(c), kod);
    assertEquals(leshBuildCode(leshParseCode(kod)!.config), kod, kod);
  }
  assertEquals(leshParseCode("LESH-25-100-inline"), null, "den gamla mallen");
  assertEquals(leshParseCode("LESH25DAJ-50-R1"), null, "LESH25DA finns inte");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = leshBuildCode;
  assertEquals(b({ size: "8", mount: "R", motor: "E", lead: "J", stroke: "50" }), null, "E bara 25");
  assertEquals(b({ size: "8", mount: "R", lead: "J", stroke: "100" }), null, "8: 50/75");
  assertEquals(b({ size: "16", mount: "R", lead: "J", stroke: "50", lock: "B" }), null, "lås R/L 50 storlek 16");
  assert(b({ size: "16", mount: "D", lead: "J", stroke: "50", lock: "B" }), "lås D 50 ok");
  assert(b({ size: "25", mount: "R", lead: "J", stroke: "50", lock: "B" }), "lås R 50 storlek 25 ok");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", holder: "H" }), null, "H bara D");
  assertEquals(b({ size: "25", mount: "R", motor: "A", lead: "J", stroke: "50", cable: "S1" }), null, "standardkabel bara steg");
  assertEquals(b({ size: "25", mount: "R", motor: "E", lead: "J", stroke: "50", cable: "S3" }), null);
  assertEquals(b({ size: "25", mount: "R", motor: "A", lead: "J", stroke: "50", cable: "R1", ctrl: "CD1", ctrl_mount: "7" }), null, "servo kräver LECA6");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "R1", ctrl: "6N" }), null, "LECA6 bara servo");
  assertEquals(b({ size: "25", mount: "R", motor: "E", lead: "J", stroke: "50", cable: "R1", ctrl: "AN" }), null, "LECPA inte absolut");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "R1", ctrl: "CD1" }), null, "JXC kräver 7/8");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "R1", ctrl: "CD1", ctrl_mount: "D" }), null, "D är LEC");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "R1", ctrl: "CD1", ctrl_mount: "7", ctrl_acc: "1" }), null, "1/3/5 bara C51/C61");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "R1", ctrl: "C51", ctrl_mount: "7", ctrl_acc: "T" }), null, "S/T bara D/M");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "R1", ctrl: "C51", ctrl_mount: "7", io_cable: "1" }), null, "I/O-kabelpositionen är LEC");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "R1", ctrl: "AN", ctrl_mount: "7" }), null, "7 är JXC");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "R1", ctrl: "AN", ctrl_acc: "S" }), null, "tillbehör är JXC");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "R1", io_cable: "1" }), null, "utan styrenhet ingen I/O-kabel");
  assertEquals(b({ size: "25", mount: "R", lead: "J", stroke: "50", ctrl: "C5F", ctrl_mount: "7" }), null, "C5F finns inte");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildLeshDbRules();
function ctx(c: LESHConfig): Record<string, unknown> {
  return {
    size: c.size, mount: c.mount, lead: c.lead, stroke: c.stroke, motor: c.motor ?? "", lock: c.lock ?? "", body: c.body ?? "", holder: c.holder ?? "",
    cable: c.cable ?? "", ctrl: c.ctrl ?? "", io_cable: c.io_cable ?? "", ctrl_mount: c.ctrl_mount ?? "", ctrl_acc: c.ctrl_acc ?? "",
  };
}
const kor = (c: LESHConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: LESHConfig) => kor(c, "error");

function kontrollera(namn: string, prov: LESHConfig[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = leshBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst, `${namn}: ${prov.length}`);
}

Deno.test("aktuatorn: storlek × fäste × motor × stigning × slag × lås × kropp × hållare × kabel", () => {
  const prov: LESHConfig[] = [];
  for (const s of LESH_SIZES) for (const m of LESH_MOUNTS) for (const motor of ["", "A", "E"]) for (const lead of ["J", "K"]) for (const st of LESH_STROKES)
    for (const lock of ["", "B"]) for (const body of ["", "S"]) for (const holder of ["", "H"]) for (const cable of ["", "S1", "R1", "RC"])
      prov.push({ size: s.code, mount: m.code, motor: motor || undefined, lead, stroke: st.code, lock: lock || undefined, body: body || undefined, holder: holder || undefined, cable: cable || undefined });
  kontrollera("A", prov, 5000);
});

Deno.test("styrenheten: motor × styrenhet × I/O-kabel × montering × tillbehör", () => {
  const prov: LESHConfig[] = [];
  for (const motor of ["", "A", "E"]) for (const ctrl of ["", ...LESH_CONTROLLERS.map((c) => c.code)]) for (const io of ["", ...LESH_IO_CABLES.map((c) => c.code)])
    for (const cm of ["", ...LESH_CTRL_MOUNTS.map((c) => c.code)]) for (const acc of ["", ...LESH_CTRL_ACCS.map((c) => c.code)])
      prov.push({ size: "25", mount: "R", motor: motor || undefined, lead: "J", stroke: "100", cable: "R1", ctrl: ctrl || undefined, io_cable: io || undefined, ctrl_mount: cm || undefined, ctrl_acc: acc || undefined });
  kontrollera("B", prov, 4000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: LESHConfig) => ctx(c) as Record<string, string>;
  for (const c of [
    { size: "25", mount: "R", motor: "E", lead: "J", stroke: "50", cable: "R1", ctrl: "CD1", ctrl_mount: "7", ctrl_acc: "T" },
    { size: "8", mount: "R", lead: "J", stroke: "50", cable: "S1", ctrl: "AN", io_cable: "1" },
    { size: "16", mount: "L", motor: "A", lead: "K", stroke: "100", lock: "B", cable: "R3", ctrl: "6P", io_cable: "3", ctrl_mount: "D" },
    { size: "16", mount: "D", lead: "J", stroke: "50" },
  ] as LESHConfig[]) {
    assertEquals(fillOrderCodeTemplate(LESH_ORDER_CODE_TEMPLATE, val(c), new Set(["size", "mount", "lead", "stroke"])), leshBuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ size: "16", mount: "R", lead: "J", stroke: "50", lock: "B" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("Låset B"), f[0]);
  const v = kor({ size: "25", mount: "R", lead: "J", stroke: "50", cable: "RC" }, "warn");
  assert(v.some((m) => m.includes("på beställning")), v.join(" | "));
  const i = kor({ size: "25", mount: "R", motor: "A", lead: "J", stroke: "50" }, "info");
  assert(i.some((m) => m.includes("servomotorn") && m.includes("19–38 N")), i.join(" | "));
  assert(kor({ size: "8", mount: "R", lead: "K", stroke: "50" }, "info").some((m) => m.includes("6–15 N") && m.includes("lås 24 N")));
  const tom = { size: "", mount: "", lead: "", stroke: "" } as LESHConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
  assertEquals(LESH_CABLES.length, 10);
});

/**
 * LEY-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel LEY16□□B-30-S1 och styrenhetsexemplen CD17T/AN1
 * (sida 459–460); slagtabellen och noterna 1–16 (sida 459–460); data per
 * storlek, stigning och motortyp (sida 462–463).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildLeyDbRules } from "../../../src/lib/catalog/ley-db-rules.ts";
import {
  LEY_CONTROLLERS,
  LEY_CTRL_ACCS,
  LEY_CTRL_MOUNTS,
  LEY_IO_CABLES,
  LEY_LEADS,
  LEY_MOTOR_OPTIONS,
  LEY_MOUNTINGS,
  LEY_MOUNTS,
  LEY_ORDER_CODE_TEMPLATE,
  LEY_SIZES,
  LEY_SOURCE,
  type LEYConfig,
  leyBuildCode,
  leyParseCode,
} from "../../../src/lib/catalog/ley.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(LEY_SOURCE.file, "smc-kat-ley.pdf");
  assertEquals(LEY_SIZES.map((s) => [s.size, s.lead_mm.A, s.lead_mm.B, s.lead_mm.C]), [[16, 10, 5, 2.5], [25, 12, 6, 3], [32, 16, 8, 4], [40, 16, 8, 4]]);
  assertEquals(LEY_SIZES.map((s) => s.stroke_range), [[10, 300], [15, 400], [20, 500], [20, 500]]);
  assertEquals(LEY_SIZES.map((s) => s.standard.length), [7, 9, 11, 11]);
  // sida 462: LEY40/C 80 kg, 562–1058 N, 6–175 mm/s, lås 519 N; sida 463: LEY25A/A 7 kg, 18–35 N, 2–500 mm/s
  assertEquals(LEY_SIZES[3].perf[""].C, { load_h_kg: 80, load_v_kg: 53, push_n: [562, 1058], speed: [6, 175], lock_n: 519 });
  assertEquals(LEY_SIZES[1].perf.A.A, { load_h_kg: 7, load_v_kg: 3, push_n: [18, 35], speed: [2, 500], lock_n: 78 });
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[LEYConfig, string]> = [
    [{ size: "16", lead: "B", stroke_mm: 30, cable: "S1" }, "LEY16B-30-S1"],
    [{ size: "16", lead: "B", stroke_mm: 30, cable: "S1", ctrl: "CD1", ctrl_mount: "7", ctrl_acc: "T" }, "LEY16B-30-S1CD17T"],
    [{ size: "16", lead: "B", stroke_mm: 30, cable: "S1", ctrl: "AN", io_cable: "1" }, "LEY16B-30-S1AN1"],
    [{ size: "25", mount: "R", motor: "A", lead: "A", stroke_mm: 300, motor_opt: "B", rod_end: "M", mounting: "L", cable: "R3", ctrl: "6N", io_cable: "1", ctrl_mount: "D" }, "LEY25RAA-300BML-R36N1D"],
    [{ size: "32", mount: "D", lead: "C", stroke_mm: 500, motor_opt: "W", cable: "R1", ctrl: "CD1", ctrl_mount: "7", ctrl_acc: "T" }, "LEY32DC-500W-R1CD17T"],
    [{ size: "40", mount: "L", lead: "A", stroke_mm: 250, motor_opt: "C", mounting: "F", cable: "RC", ctrl: "C51", ctrl_mount: "8", ctrl_acc: "5" }, "LEY40LA-250CF-RCC5185"],
    [{ size: "25", lead: "B", stroke_mm: 123 }, "LEY25B-123"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(leyBuildCode(c), kod);
    assertEquals(leyBuildCode(leyParseCode(kod)!.config), kod, kod);
  }
  assertEquals(leyParseCode("LEY-25-300-inline"), null, "den gamla mallen");
  assertEquals(leyParseCode("LEY32AB-300"), null, "servo inte i 32");
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = leyBuildCode;
  assertEquals(b({ size: "32", motor: "A", lead: "A", stroke_mm: 100 }), null, "servo 16/25");
  assertEquals(b({ size: "16", lead: "A", stroke_mm: 9 }), null, "16: 10–300");
  assertEquals(b({ size: "16", lead: "A", stroke_mm: 301 }), null);
  assert(b({ size: "16", lead: "A", stroke_mm: 10 }));
  assertEquals(b({ size: "25", lead: "A", stroke_mm: 14 }), null, "25: 15–400");
  assertEquals(b({ size: "40", lead: "A", stroke_mm: 501 }), null, "40: 20–500");
  assertEquals(b({ size: "25", mount: "D", lead: "A", stroke_mm: 100, mounting: "L" }), null, "fot bara parallellt");
  assertEquals(b({ size: "32", lead: "A", stroke_mm: 100, mounting: "G" }), null, "G inte 32/40");
  assert(b({ size: "25", lead: "A", stroke_mm: 100, mounting: "G" }));
  assertEquals(b({ size: "16", lead: "A", stroke_mm: 30, motor_opt: "B", mounting: "F" }), null, "F inte 16/40 med 30 och lås");
  assert(b({ size: "16", lead: "A", stroke_mm: 30, motor_opt: "C", mounting: "F" }), "F med kåpa ok");
  assert(b({ size: "25", lead: "A", stroke_mm: 30, motor_opt: "B", mounting: "F" }), "F 25 med lås ok");
  assertEquals(b({ size: "16", lead: "A", stroke_mm: 150, mounting: "D" }), null, "gaffel 16 ≤ 100");
  assertEquals(b({ size: "32", lead: "A", stroke_mm: 250, mounting: "D" }), null, "gaffel 32 ≤ 200");
  assert(b({ size: "32", lead: "A", stroke_mm: 200, mounting: "D" }));
  assertEquals(b({ size: "16", motor: "A", lead: "A", stroke_mm: 100, cable: "S1" }), null, "standardkabel bara steg");
  assertEquals(b({ size: "16", motor: "A", lead: "A", stroke_mm: 100, cable: "R1", ctrl: "CD1", ctrl_mount: "7" }), null, "servo kräver LECA6");
  assertEquals(b({ size: "16", lead: "A", stroke_mm: 100, cable: "R1", ctrl: "6N" }), null, "LECA6 bara servo");
  assertEquals(b({ size: "16", lead: "A", stroke_mm: 100, cable: "R1", ctrl: "CD1" }), null, "JXC kräver 7/8");
  assertEquals(b({ size: "16", lead: "A", stroke_mm: 100, ctrl: "AN", ctrl_acc: "S" }), null, "tillbehör är JXC");
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildLeyDbRules();
function ctx(c: LEYConfig): Record<string, unknown> {
  return {
    size: c.size, lead: c.lead, stroke_mm: Number(c.stroke_mm || 0), mount: c.mount ?? "", motor: c.motor ?? "", motor_opt: c.motor_opt ?? "", rod_end: c.rod_end ?? "",
    mounting: c.mounting ?? "", cable: c.cable ?? "", ctrl: c.ctrl ?? "", io_cable: c.io_cable ?? "", ctrl_mount: c.ctrl_mount ?? "", ctrl_acc: c.ctrl_acc ?? "",
  };
}
const kor = (c: LEYConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: LEYConfig) => kor(c, "error");

function kontrollera(namn: string, prov: LEYConfig[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = leyBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst, `${namn}: ${prov.length}`);
}

Deno.test("aktuatorn: storlek × placering × motor × stigning × slag × tillval × stångände × fäste", () => {
  const prov: LEYConfig[] = [];
  const slag = [9, 10, 14, 15, 19, 20, 30, 31, 100, 101, 200, 201, 300, 301, 400, 401, 500, 501];
  for (const s of LEY_SIZES) for (const mount of ["", ...LEY_MOUNTS.map((m) => m.code)]) for (const motor of ["", "A"]) for (const lead of LEY_LEADS.map((l) => l.code))
    for (const stroke_mm of slag) for (const opt of ["", ...LEY_MOTOR_OPTIONS.map((o) => o.code)]) for (const rod of ["", "M"]) for (const mounting of ["", ...LEY_MOUNTINGS.map((m) => m.code)])
      prov.push({ size: s.code, lead, stroke_mm, mount: mount || undefined, motor: motor || undefined, motor_opt: opt || undefined, rod_end: rod || undefined, mounting: mounting || undefined });
  kontrollera("A", prov, 30000);
});

Deno.test("styrenheten: motor × kabel × styrenhet × I/O-kabel × montering × tillbehör", () => {
  const prov: LEYConfig[] = [];
  for (const motor of ["", "A"]) for (const cable of ["", "S1", "R1", "RC"]) for (const ctrl of ["", ...LEY_CONTROLLERS.map((c) => c.code)]) for (const io of ["", ...LEY_IO_CABLES.map((c) => c.code)])
    for (const cm of ["", ...LEY_CTRL_MOUNTS.map((c) => c.code)]) for (const acc of ["", ...LEY_CTRL_ACCS.map((c) => c.code)])
      prov.push({ size: "25", lead: "A", stroke_mm: 100, motor: motor || undefined, cable: cable || undefined, ctrl: ctrl || undefined, io_cable: io || undefined, ctrl_mount: cm || undefined, ctrl_acc: acc || undefined });
  kontrollera("B", prov, 10000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: LEYConfig) => ({ ...ctx(c), stroke_mm: c.stroke_mm }) as Record<string, string | number>;
  for (const c of [
    { size: "16", lead: "B", stroke_mm: 30, cable: "S1", ctrl: "CD1", ctrl_mount: "7", ctrl_acc: "T" },
    { size: "25", mount: "R", motor: "A", lead: "A", stroke_mm: 300, motor_opt: "B", rod_end: "M", mounting: "L", cable: "R3", ctrl: "6N", io_cable: "1", ctrl_mount: "D" },
    { size: "25", lead: "B", stroke_mm: 123 },
  ] as LEYConfig[]) {
    assertEquals(fillOrderCodeTemplate(LEY_ORDER_CODE_TEMPLATE, val(c), new Set(["size", "lead", "stroke_mm"])), leyBuildCode(c));
  }
});

Deno.test("meddelanden, råd, varningar och tomt", () => {
  const f = fel({ size: "32", lead: "A", stroke_mm: 100, mounting: "G" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("Flänsen vid gaveln G"), f[0]);
  const v = kor({ size: "25", lead: "A", stroke_mm: 123 }, "warn");
  assert(v.some((m) => m.includes("specialorder")), v.join(" | "));
  const v2 = kor({ size: "16", lead: "A", stroke_mm: 30, motor_opt: "B" }, "warn");
  assert(v2.some((m) => m.includes("sticker")), v2.join(" | "));
  const v3 = kor({ size: "32", lead: "A", stroke_mm: 150, mounting: "F" }, "warn");
  assert(v3.some((m) => m.includes("utkragande")), v3.join(" | "));
  const i = kor({ size: "40", lead: "C", stroke_mm: 100 }, "info");
  assert(i.some((m) => m.includes("562–1058 N") && m.includes("lås 519 N")), i.join(" | "));
  const tom = { size: "", lead: "", stroke_mm: 0 } as LEYConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "warn"), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});

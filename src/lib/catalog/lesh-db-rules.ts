/**
 * LESH-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: motortypen mot storlek och fäste;
 * slaget mot storlek; låset mot fäste, storlek och slag; sidohållaren mot
 * fäste; kabeln mot motortyp; styrenheten mot motortyp; styrenhetens
 * montering, I/O-kabel och tillbehör mot styrenhetsfamilj och gränssnitt.
 */
import {
  LESH_CABLES,
  LESH_CONTROLLERS,
  LESH_CTRL_ACCS,
  LESH_LIMITS,
  LESH_SIZES,
  LESH_STROKES,
  leshLockOk,
} from "./lesh";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type LESHDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const MOTORNAMN: Record<string, [string, string]> = {
  "": ["stegmotorn (inkrementell)", "the step motor (incremental)"],
  A: ["servomotorn", "the servo motor"],
  E: ["den batterilösa absoluta stegmotorn", "the battery-less absolute step motor"],
};

export function buildLeshDbRules(): LESHDbRule[] {
  const rows: LESHDbRule[] = [];
  const steg = (p: string) => `lesh-${p}`;
  const jxc = LESH_CONTROLLERS.filter((c) => c.family === "JXC").map((c) => c.code);
  const lec = LESH_CONTROLLERS.filter((c) => c.family === "LEC").map((c) => c.code);

  // ── motortypen ─────────────────────────────────────────────────────────
  const utanAbs = LESH_SIZES.filter((s) => !s.abs_ok).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "motor" }, "E"] }, { in: [{ var: "size" }, utanAbs] }] },
    message_sv: `Batterilös absolut E finns bara i storlek 25, inte ${lista(utanAbs)} (sida 705).`,
    message_en: `The battery-less absolute E exists only in size 25, not ${lista(utanAbs, "and")} (page 705).`,
    goto_step: steg("motor"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "motor" }, "A"] }, { "==": [{ var: "mount" }, "D"] }, { "==": [{ var: "size" }, "25"] }] },
    message_sv: "LESH25DA finns inte — servomotorn i storlek 25 bara med fäste R eller L (sida 716, not 1).",
    message_en: "LESH25DA is not available — the servo motor in size 25 only with mounting R or L (page 716, note 1).",
    goto_step: steg("mount"),
  });

  // ── slaget per storlek ─────────────────────────────────────────────────
  for (const s of LESH_SIZES) {
    const fel = LESH_STROKES.map((x) => x.code).filter((x) => !s.strokes.includes(Number(x)));
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "size" }, s.code] }, { in: [{ var: "stroke" }, fel] }] },
      message_sv: `Storlek ${s.code} finns med slag ${lista(s.strokes, "eller")} mm (sida 715).`,
      message_en: `Size ${s.code} exists with strokes ${lista(s.strokes, "or")} mm (page 715).`,
      goto_step: steg("stroke"),
    });
  }

  // ── låset, sidohållaren ────────────────────────────────────────────────
  const lasNej = LESH_SIZES.filter((s) => !leshLockOk(s, "R", 50)).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "lock" }, "B"] }, { in: [{ var: "mount" }, ["R", "L"]] }, { in: [{ var: "size" }, lasNej] }, { "==": [{ var: "stroke" }, "50"] }] },
    message_sv: `Låset B finns inte på R/L-typ i storlek ${lista(lasNej)} vid 50 mm slag — välj längre slag eller D-typ (sida 715, tabellen).`,
    message_en: `The lock B is not available on the R/L type in size ${lista(lasNej, "and")} at 50 mm stroke — choose a longer stroke or the D type (page 715, chart).`,
    goto_step: steg("lock"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "holder" }, "H"] }, { "!=": [{ var: "mount" }, "D"] }] },
    message_sv: "Sidohållaren H finns bara för D-typen (sida 715).",
    message_en: "The side holder H exists only for the D type (page 715).",
    goto_step: steg("holder"),
  });

  // ── kabeln ─────────────────────────────────────────────────────────────
  const standard = LESH_CABLES.filter((k) => k.kind === "standard").map((k) => k.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "cable" }, standard] }, { "!=": [{ var: "motor" }, ""] }] },
    message_sv: "Standardkabeln S1/S3/S5 finns bara för stegmotorn (inkrementell); servomotorn och den absoluta stegmotorn beställs med robotkabel R (sida 705 och 715, not 8).",
    message_en: "The standard cable S1/S3/S5 exists only for the step motor (incremental); the servo motor and the absolute step motor are ordered with the robotic cable R (pages 705 and 715, note 8).",
    goto_step: steg("cable"),
  });
  const paBestallning = LESH_CABLES.filter((k) => k.on_order).map((k) => k.code);
  rows.push({
    severity: "warn",
    if_json: { in: [{ var: "cable" }, paBestallning] },
    message_sv: `Robotkabel ${paBestallning.join("/")} (8–20 m) tillverkas på beställning; över 5 m sjunker hastighet och kraft med upp till 10 % per 5 m (sida 715, not 5, och 718, not 3).`,
    message_en: `Robotic cable ${paBestallning.join("/")} (8–20 m) is produced upon receipt of order; above 5 m speed and force drop by up to 10 % per 5 m (page 715, note 5, and 718, note 3).`,
    goto_step: steg("cable"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "cable" }, standard] },
    message_sv: "Standardkabeln används bara på fasta delar; på rörliga delar väljs robotkabel (sida 715, not 6).",
    message_en: "The standard cable is used only on fixed parts; on moving parts choose the robotic cable (page 715, note 6).",
    goto_step: steg("cable"),
  });

  // ── styrenheten mot motortypen ─────────────────────────────────────────
  for (const motor of ["", "A", "E"]) {
    const fel = LESH_CONTROLLERS.filter((c) => !c.motors.includes(motor)).map((c) => c.code);
    const ok = LESH_CONTROLLERS.filter((c) => c.motors.includes(motor)).map((c) => c.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "motor" }, motor] }, { in: [{ var: "ctrl" }, fel] }] },
      message_sv: `Till ${MOTORNAMN[motor][0]} passar styrenheterna ${lista(ok)}, inte ${lista(fel)} (sida 706 och 716).`,
      message_en: `For ${MOTORNAMN[motor][1]} the controllers ${lista(ok, "and")} fit, not ${lista(fel, "and")} (pages 706 and 716).`,
      goto_step: steg("ctrl"),
    });
  }
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "ctrl" }, ""] }, { or: [{ "!=": [{ var: "io_cable" }, ""] }, { "!=": [{ var: "ctrl_mount" }, ""] }, { "!=": [{ var: "ctrl_acc" }, ""] }] }] },
    message_sv: "I/O-kabel, montering och tillbehör hör till styrenheten — välj en styrenhet först (sida 716, not 10).",
    message_en: "I/O cable, mounting and accessory belong to the controller — choose a controller first (page 716, note 10).",
    goto_step: steg("ctrl"),
  });

  // ── JXC: montering 7/8, tillbehör per gränssnitt, ingen I/O-kabel ─────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "ctrl" }, jxc] }, { not: { in: [{ var: "ctrl_mount" }, ["7", "8"]] } }] },
    message_sv: "JXC-styrenheten beställs med montering: 7 skruv eller 8 DIN-skena (sida 716).",
    message_en: "The JXC controller is ordered with a mounting: 7 screw or 8 DIN rail (page 716).",
    goto_step: steg("ctrl_mount"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "ctrl" }, jxc] }, { "!=": [{ var: "io_cable" }, ""] }] },
    message_sv: "JXC:s I/O-kabel skrivs som tillbehör 1/3/5 efter monteringen (bara JXC51/61); positionen I/O-kabel hör till LEC (sida 716).",
    message_en: "The JXC I/O cable is written as the accessory 1/3/5 after the mounting (JXC51/61 only); the I/O cable position belongs to LEC (page 716).",
    goto_step: steg("io_cable"),
  });
  const medAcc = new Map<string, string[]>();
  for (const c of LESH_CONTROLLERS) if (c.family === "JXC") for (const a of LESH_CTRL_ACCS.map((x) => x.code)) {
    if (!(c.acc ?? []).includes(a)) medAcc.set(a, [...(medAcc.get(a) ?? []), c.code]);
  }
  for (const [a, ctrls] of medAcc) {
    const ok = LESH_CONTROLLERS.filter((c) => (c.acc ?? []).includes(a)).map((c) => c.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "ctrl" }, ctrls] }, { "==": [{ var: "ctrl_acc" }, a] }] },
      message_sv: `Tillbehöret ${a} finns för ${lista(ok)}, inte för ${lista(ctrls)} (sida 716, not 13).`,
      message_en: `The accessory ${a} exists for ${lista(ok, "and")}, not for ${lista(ctrls, "and")} (page 716, note 13).`,
      goto_step: steg("ctrl_acc"),
    });
  }

  // ── LEC: montering D, I/O-kabel, inget JXC-tillbehör ──────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "ctrl" }, lec] }, { in: [{ var: "ctrl_mount" }, ["7", "8"]] }] },
    message_sv: "LEC-styrenheten monteras med skruv (ingen bokstav) eller på DIN-skena D; 7/8 hör till JXC (sida 716).",
    message_en: "The LEC controller is mounted with screws (no letter) or on a DIN rail D; 7/8 belong to JXC (page 716).",
    goto_step: steg("ctrl_mount"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "ctrl" }, lec] }, { "!=": [{ var: "ctrl_acc" }, ""] }] },
    message_sv: "Kommunikationsplugg och JXC-tillbehör finns inte för LEC; LEC:s I/O-kabel väljs i positionen I/O-kabel (sida 716).",
    message_en: "Communication plug and JXC accessories do not exist for LEC; the LEC I/O cable is chosen in the I/O cable position (page 716).",
    goto_step: steg("ctrl_acc"),
  });
  rows.push({
    severity: "warn",
    if_json: { and: [{ in: [{ var: "ctrl" }, ["AN", "AP"]] }, { in: [{ var: "io_cable" }, ["3", "5"]] }] },
    message_sv: "LECPA (pulsingång): 3 och 5 m I/O-kabel bara med differentiella pulssignaler; öppen kollektor bara 1,5 m (sida 716, not 11).",
    message_en: "LECPA (pulse input): 3 and 5 m I/O cable only with differential pulse signals; open collector only 1.5 m (page 716, note 11).",
    goto_step: steg("io_cable"),
  });
  rows.push({
    severity: "warn",
    if_json: { in: [{ var: "ctrl_mount" }, ["8", "D"]] },
    message_sv: "DIN-skenan ingår inte — den beställs separat (sida 716, not 12).",
    message_en: "The DIN rail is not included — it is ordered separately (page 716, note 12).",
    goto_step: steg("ctrl_mount"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "ctrl" }, ["AN", "AP"]] },
    message_sv: "LECPA med öppen kollektor kräver strömbegränsningsmotståndet LEC-PA-R-□, som beställs separat (sida 716, not 9).",
    message_en: "LECPA with open collector needs the current limiting resistor LEC-PA-R-□, ordered separately (page 716, note 9).",
    goto_step: steg("ctrl"),
  });
  rows.push({
    severity: "info",
    if_json: { and: [{ "==": [{ var: "motor" }, "E"] }, { in: [{ var: "ctrl" }, jxc] }] },
    message_sv: "Batterilös absolut kräver JXC med programversion V3.4/S3.4 eller senare (sida 706).",
    message_en: "Battery-less absolute needs a JXC controller with firmware V3.4/S3.4 or later (page 706).",
    goto_step: steg("ctrl"),
  });

  // ── råd: prestanda per storlek, stigning och motortyp ─────────────────
  for (const s of LESH_SIZES) {
    for (const motor of Object.keys(s.perf)) {
      for (const lead of ["J", "K"] as const) {
        const p = s.perf[motor][lead];
        const sida = motor === "E" ? 707 : motor === "A" ? 719 : 718;
        rows.push({
          severity: "info",
          if_json: { and: [{ "==": [{ var: "size" }, s.code] }, { "==": [{ var: "motor" }, motor]}, { "==": [{ var: "lead" }, lead] }] },
          message_sv: `Storlek ${s.code}, stigning ${s.lead_mm[lead]} mm, ${MOTORNAMN[motor][0]}: last ${sv(p.load_h_kg)} kg horisontellt/${sv(p.load_v_kg)} kg vertikalt, tryckkraft ${sv(p.push_n[0])}–${sv(p.push_n[1])} N, ${p.speed[0]}–${p.speed[1]} mm/s; lås ${s.lock_n} N; motor ${s.motor_size} (sida ${sida}).`,
          message_en: `Size ${s.code}, lead ${s.lead_mm[lead]} mm, ${MOTORNAMN[motor][1]}: load ${p.load_h_kg} kg horizontal/${p.load_v_kg} kg vertical, pushing force ${p.push_n[0]}–${p.push_n[1]} N, ${p.speed[0]}–${p.speed[1]} mm/s; lock ${s.lock_n} N; motor ${s.motor_size} (page ${sida}).`,
          goto_step: steg("lead"),
        });
      }
    }
  }
  const L = LESH_LIMITS;
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "size" }, ""] },
    message_sv: `LESH: repeternoggrannhet ±${sv(L.repeatability_mm)} mm, max ${L.max_accel_mm_s2} mm/s², ${L.temp_c[0]}–${L.temp_c[1]} °C, ${L.enclosure}, ${L.supply_vdc} V DC; glidskruv med rem (R/L) eller direkt (D), cirkulerande linjärstyrning; aktuator och styrenhet säljs som ett paket (sida 716 och 718).`,
    message_en: `LESH: positioning repeatability ±${L.repeatability_mm} mm, max ${L.max_accel_mm_s2} mm/s², ${L.temp_c[0]}–${L.temp_c[1]} °C, ${L.enclosure}, ${L.supply_vdc} V DC; slide screw with belt (R/L) or direct (D), circulating linear guide; actuator and controller are sold as a package (pages 716 and 718).`,
    goto_step: steg("size"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "body" }, "S"] },
    message_sv: "Dammskyddad S: R/L-typ får avstrykare på stångkåpan och packningar i båda ändkåporna (IP5X-ekvivalent); D-typ får avstrykare på stångkåpan (sida 716, not 3).",
    message_en: "Dust-protected S: the R/L type gets a scraper on the rod cover and gaskets in both end covers (IP5X equivalent); the D type gets a scraper on the rod cover (page 716, note 3).",
    goto_step: steg("body"),
  });
  return rows;
}

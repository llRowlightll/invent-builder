/**
 * LESH-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: motortypen mot storlek och fäste;
 * slaget mot storlek; låset mot fäste, storlek och slag; sidohållaren mot
 * fäste; kabeln mot motortyp; styrenheten mot motortyp; styrenhetens
 * montering, I/O-kabel och tillbehör mot styrenhetsfamilj och gränssnitt.
 */
import { LESH_LIMITS, LESH_SIZES, LESH_STROKES, leshLockOk } from "./lesh";
import { LE_MOTORNAMN, leControllerRules } from "./le-controller";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type LESHDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const MOTORNAMN = LE_MOTORNAMN;

export function buildLeshDbRules(): LESHDbRule[] {
  const rows: LESHDbRule[] = [];
  const steg = (p: string) => `lesh-${p}`;

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

  // ── kabel och styrenhet (gemensamt med LEY) ───────────────────────────
  rows.push(...leControllerRules({
    steg,
    motors: ["", "A", "E"],
    ctrlPages: "706 och 716",
    page: 716,
    notes: { belongs: 10, acc: 13, pulse: 11, din: 12, resistor: 9 },
    absPage: 706,
    cable: { page: 715, onOrder: 5, fixed: 6, dataPage: 718, dataNote: 3, stdOnly: { sv: "sida 705 och 715, not 8", en: "pages 705 and 715, note 8" } },
  }));

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

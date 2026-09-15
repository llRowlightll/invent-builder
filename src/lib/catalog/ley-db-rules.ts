/**
 * LEY-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: servomotorn mot storlek; slaget mot
 * storlekens tillverkbara område och standardtabell; fästena L/F/G/D mot
 * motorns placering, storlek, slag och lås; låset mot placering, storlek
 * och slag (motorn sticker ut); kabel och styrenhet mot motortyp
 * (gemensamt med LESH, le-controller.ts).
 */
import { LEY_LIMITS, LEY_MOUNTINGS, LEY_SIZES } from "./ley";
import { LE_MOTORNAMN, leControllerRules } from "./le-controller";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type LEYDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");

export function buildLeyDbRules(): LEYDbRule[] {
  const rows: LEYDbRule[] = [];
  const steg = (p: string) => `ley-${p}`;
  const parallell = { "!=": [{ var: "mount" }, "D"] };
  const medLas = { in: [{ var: "motor_opt" }, ["B", "W"]] };

  // ── servomotorn ────────────────────────────────────────────────────────
  const utanServo = LEY_SIZES.filter((s) => !s.servo_ok).map((s) => s.code);
  const medServo = LEY_SIZES.filter((s) => s.servo_ok).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "motor" }, "A"] }, { in: [{ var: "size" }, utanServo] }] },
    message_sv: `Servomotorn A finns i storlek ${lista(medServo)}, inte ${lista(utanServo)} (sida 459).`,
    message_en: `The servo motor A exists in size ${lista(medServo, "and")}, not ${lista(utanServo, "and")} (page 459).`,
    goto_step: steg("motor"),
  });

  // ── slaget ─────────────────────────────────────────────────────────────
  for (const s of LEY_SIZES) {
    const [min, max] = s.stroke_range;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "size" }, s.code] }, { ">": [{ var: "stroke_mm" }, 0] }, { or: [{ "<": [{ var: "stroke_mm" }, min] }, { ">": [{ var: "stroke_mm" }, max] }] }] },
      message_sv: `Storlek ${s.code} tillverkas med ${min}–${max} mm slag (sida 459).`,
      message_en: `Size ${s.code} is manufactured with ${min}–${max} mm stroke (page 459).`,
      goto_step: steg("stroke_mm"),
    });
    rows.push({
      severity: "warn",
      if_json: { and: [{ "==": [{ var: "size" }, s.code] }, { ">=": [{ var: "stroke_mm" }, min] }, { "<=": [{ var: "stroke_mm" }, max] }, { not: { in: [{ var: "stroke_mm" }, s.standard] } }] },
      message_sv: `Standardslagen för storlek ${s.code} är ${lista(s.standard)} mm; andra slag tillverkas som specialorder — kontakta SMC (sida 459–460, not 1).`,
      message_en: `The standard strokes for size ${s.code} are ${lista(s.standard, "and")} mm; other strokes are produced as special orders — contact SMC (pages 459–460, note 1).`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── låset: motorn sticker ut (sida 460 *2) ────────────────────────────
  rows.push({
    severity: "warn",
    if_json: { and: [medLas, parallell, { in: [{ var: "size" }, ["16", "40"]] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<=": [{ var: "stroke_mm" }, 30] }] },
    message_sv: "Med lås (B/W) och motorn parallellt sticker motorkroppen ut bakom cylindern i storlek 16 och 40 vid slag upp till 30 mm — kontrollera att den inte kolliderar (sida 460, not 2).",
    message_en: "With the lock (B/W) and the motor mounted in parallel the motor body sticks out behind the cylinder in sizes 16 and 40 at strokes up to 30 mm — check for interference (page 460, note 2).",
    goto_step: steg("motor_opt"),
  });

  // ── fästena ────────────────────────────────────────────────────────────
  const baraParallell = LEY_MOUNTINGS.filter((m) => m.parallel_only).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mount" }, "D"] }, { in: [{ var: "mounting" }, baraParallell] }] },
    message_sv: `Fästena ${lista(baraParallell)} finns bara med motorn parallellt, inte i linje D (sida 459).`,
    message_en: `The mountings ${lista(baraParallell, "and")} exist only with the motor in parallel, not in-line D (page 459).`,
    goto_step: steg("mounting"),
  });
  const utanG = LEY_SIZES.filter((s) => !s.head_flange_ok).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mounting" }, "G"] }, { in: [{ var: "size" }, utanG] }] },
    message_sv: `Flänsen vid gaveln G finns inte för storlek ${lista(utanG)} (sida 460, not 7).`,
    message_en: `The head flange G is not available for size ${lista(utanG, "and")} (page 460, note 7).`,
    goto_step: steg("mounting"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mounting" }, "F"] }, medLas, { in: [{ var: "size" }, ["16", "40"]] }, { "==": [{ var: "stroke_mm" }, 30] }] },
    message_sv: "Flänsen vid kolvstången F finns inte för storlek 16 och 40 med 30 mm slag och lås (B/W) (sida 460, not 6).",
    message_en: "The rod flange F is not available for sizes 16 and 40 with a 30 mm stroke and the lock (B/W) (page 460, note 6).",
    goto_step: steg("mounting"),
  });
  const perClevis = new Map<number, string[]>();
  for (const s of LEY_SIZES) perClevis.set(s.clevis_max_mm, [...(perClevis.get(s.clevis_max_mm) ?? []), s.code]);
  for (const [max, sizes] of perClevis) {
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "mounting" }, "D"] }, { in: [{ var: "size" }, sizes] }, { ">": [{ var: "stroke_mm" }, max] }] },
      message_sv: `Det dubbla gaffelfästet D används i storlek ${lista(sizes)} med högst ${max} mm slag (sida 460, not 5).`,
      message_en: `The double clevis D is used in size ${lista(sizes, "and")} with at most ${max} mm stroke (page 460, note 5).`,
      goto_step: steg("mounting"),
    });
  }
  const perCant = new Map<number, string[]>();
  for (const s of LEY_SIZES) if (s.cantilever_max_mm) perCant.set(s.cantilever_max_mm, [...(perCant.get(s.cantilever_max_mm) ?? []), s.code]);
  for (const [max, sizes] of perCant) {
    rows.push({
      severity: "warn",
      if_json: { and: [{ in: [{ var: "mounting" }, ["", "F", "G"]] }, { in: [{ var: "size" }, sizes] }, { ">": [{ var: "stroke_mm" }, max] }] },
      message_sv: `Horisontellt utkragande montering med fläns eller gängade ändar: storlek ${lista(sizes)} används med högst ${max} mm slag (sida 460, not 4).`,
      message_en: `Horizontal cantilever mounting with a flange or tapped ends: size ${lista(sizes, "and")} is used with at most ${max} mm stroke (page 460, note 4).`,
      goto_step: steg("mounting"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "mounting" }, ["L", "F", "G", "D"]] },
    message_sv: "Fästet levereras med men monteras inte (sida 460, not 3).",
    message_en: "The mounting bracket is shipped together with the product but not assembled (page 460, note 3).",
    goto_step: steg("mounting"),
  });

  // ── kabel och styrenhet (gemensamt med LESH) ──────────────────────────
  rows.push(...leControllerRules({
    steg,
    motors: ["", "A"],
    ctrlPages: "459 och 460",
    page: 460,
    notes: { belongs: 13, acc: 16, pulse: 14, din: 15, resistor: 12 },
    cable: { page: 460, onOrder: 8, fixed: 9, dataPage: 462, dataNote: 4, stdOnly: { sv: "sida 459 och 460, not 11", en: "pages 459 and 460, note 11" } },
  }));

  // ── råd: prestanda per storlek, stigning och motortyp ─────────────────
  for (const s of LEY_SIZES) {
    for (const motor of Object.keys(s.perf)) {
      for (const lead of ["A", "B", "C"] as const) {
        const p = s.perf[motor][lead];
        const sida = motor === "A" ? 463 : 462;
        rows.push({
          severity: "info",
          if_json: { and: [{ "==": [{ var: "size" }, s.code] }, { "==": [{ var: "motor" }, motor] }, { "==": [{ var: "lead" }, lead] }] },
          message_sv: `Storlek ${s.code}, stigning ${sv(s.lead_mm[lead])} mm, ${LE_MOTORNAMN[motor][0]}${motor === "" ? " med JXC□1/JXC□F" : ""}: last ${sv(p.load_h_kg)} kg horisontellt/${sv(p.load_v_kg)} kg vertikalt vid 3000 mm/s², tryckkraft ${p.push_n[0]}–${p.push_n[1]} N, ${p.speed[0]}–${p.speed[1]} mm/s; lås ${p.lock_n} N; motor ${sv(s.motor_size)} (sida ${sida}).`,
          message_en: `Size ${s.code}, lead ${s.lead_mm[lead]} mm, ${LE_MOTORNAMN[motor][1]}${motor === "" ? " with JXC□1/JXC□F" : ""}: load ${p.load_h_kg} kg horizontal/${p.load_v_kg} kg vertical at 3000 mm/s², pushing force ${p.push_n[0]}–${p.push_n[1]} N, ${p.speed[0]}–${p.speed[1]} mm/s; lock ${p.lock_n} N; motor ${s.motor_size} (page ${sida}).`,
          goto_step: steg("lead"),
        });
      }
    }
  }
  rows.push({
    severity: "info",
    if_json: { and: [{ "==": [{ var: "motor" }, ""] }, { in: [{ var: "ctrl" }, ["AN", "AP"]] }] },
    message_sv: "Med LECPA är den horisontella lasten och hastigheten lägre än med JXC□1/JXC□F (raden LECPA/JXC□2/3, sida 462).",
    message_en: "With LECPA the horizontal load and the speed are lower than with JXC□1/JXC□F (the LECPA/JXC□2/3 row, page 462).",
    goto_step: steg("ctrl"),
  });
  const L = LEY_LIMITS;
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "size" }, ""] },
    message_sv: `LEY: kulskruv med rem (parallell motor) eller direkt (D), glidbussning som styrning; repeternoggrannhet ±${sv(L.repeatability_mm)} mm, max ${L.max_accel_mm_s2} mm/s², tryckhastighet högst 50/35/30/30 mm/s för storlek 16/25/32/40, ${L.temp_c[0]}–${L.temp_c[1]} °C, ${L.enclosure}, ${L.supply_vdc} V DC; aktuator och styrenhet säljs som ett paket (sida 460 och 462).`,
    message_en: `LEY: ball screw with belt (parallel motor) or direct (D), sliding bushing as guide; positioning repeatability ±${L.repeatability_mm} mm, max ${L.max_accel_mm_s2} mm/s², pushing speed at most 50/35/30/30 mm/s for sizes 16/25/32/40, ${L.temp_c[0]}–${L.temp_c[1]} °C, ${L.enclosure}, ${L.supply_vdc} V DC; actuator and controller are sold as a package (pages 460 and 462).`,
    goto_step: steg("size"),
  });
  return rows;
}

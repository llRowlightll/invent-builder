/**
 * CQ2-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Samma invariant som de andra familjerna: en kombination modellen vägrar
 * bygga ska ge minst ett fel, och en den bygger får inte ge något.
 *
 * CQ2:s särdrag är att nästan allt är VALFRITT (SMC:s "Nil" är ingenting i
 * koden), så de flesta reglerna vaktar på att ett tillval är valt innan de
 * dömer det. Undantaget är givarspåret Z, som är tvingande för ø32–100 och
 * för magnetcylindern -- där är det FRÅNVARON som är felet.
 */
import {
  CQ2_BODY_OPTIONS,
  CQ2_BORES,
  CQ2_LEAD_M_REED_ONLY,
  CQ2_LIMITS,
  CQ2_MTO,
  CQ2_PORTS,
  CQ2_PORT_F_SA_BORES,
  CQ2_ROD_BRACKETS,
  CQ2_SWITCHES,
} from "./cq2";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type Cq2DbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const SA = ["S", "T"];

export function buildCq2DbRules(): Cq2DbRule[] {
  const rows: Cq2DbRule[] = [];
  const steg = (p: string) => `cq2-${p}`;
  const alla = CQ2_BORES.map((b) => b.code);
  const sma = CQ2_BORES.filter((b) => b.bore_mm <= 25).map((b) => b.code);
  const stora = CQ2_BORES.filter((b) => b.bore_mm >= 32).map((b) => b.code);

  // ── enkelverkande finns ø12–50 ─────────────────────────────────────────
  const saBores = CQ2_BORES.filter((b) => b.sa_standard_strokes).map((b) => b.code);
  const utanSa = alla.filter((b) => !saBores.includes(b));
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "action" }, SA] }, { in: [{ var: "bore" }, utanSa] }] },
    message_sv: `Enkelverkande CQ2 finns i ø${lista(saBores.map(Number))}, inte ø${lista(utanSa.map(Number))}.`,
    message_en: `Single-acting CQ2 exists in ø${lista(saBores.map(Number), "and")}, not ø${lista(utanSa.map(Number), "and")}.`,
    goto_step: steg("action"),
  });

  // ── luft-hydraulik ─────────────────────────────────────────────────────
  const utanHydro = CQ2_BORES.filter((b) => !b.air_hydro).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "air_hydro" }, "H"] }, { in: [{ var: "bore" }, utanHydro] }] },
    message_sv: `Luft-hydraulik finns ø20–100, inte ø${lista(utanHydro.map(Number))}.`,
    message_en: `The air-hydro type exists ø20–100, not ø${lista(utanHydro.map(Number), "and")}.`,
    goto_step: steg("air_hydro"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "air_hydro" }, "H"] }, { in: [{ var: "action" }, SA] }] },
    message_sv: "Luft-hydraulik finns bara dubbelverkande.",
    message_en: "The air-hydro type is double acting only.",
    goto_step: steg("air_hydro"),
  });

  // ── gängtyp ────────────────────────────────────────────────────────────
  for (const p of CQ2_PORTS) {
    const utan = alla.filter((b) => !p.bores.includes(b));
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "port" }, p.code] }, { in: [{ var: "bore" }, utan] }] },
      message_sv: `Gängtyp ${p.code} finns för ø${lista(p.bores.map(Number))}; ø${lista(sma.map(Number))} har M-gänga.`,
      message_en: `Port thread ${p.code} exists for ø${lista(p.bores.map(Number), "and")}; ø${lista(sma.map(Number), "and")} has M thread.`,
      goto_step: steg("port"),
    });
    if (!p.air_hydro_ok) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "port" }, p.code] }, { "==": [{ var: "air_hydro" }, "H"] }] },
        message_sv: `Gängtyp ${p.code} går inte med luft-hydraulik.`,
        message_en: `Port thread ${p.code} is not available for the air-hydro type.`,
        goto_step: steg("port"),
      });
    }
  }
  const fInteSa = CQ2_PORTS.find((p) => p.code === "F")!.bores.filter((b) => !CQ2_PORT_F_SA_BORES.includes(b));
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "port" }, "F"] }, { in: [{ var: "action" }, SA] }, { in: [{ var: "bore" }, fInteSa] }] },
    message_sv: `Inbyggda snabbkopplingar finns för enkelverkande ø${lista(CQ2_PORT_F_SA_BORES.map(Number))}.`,
    message_en: `Built-in one-touch fittings exist for single acting ø${lista(CQ2_PORT_F_SA_BORES.map(Number), "and")}.`,
    goto_step: steg("port"),
  });

  // ── gummidämpare ───────────────────────────────────────────────────────
  const medC = CQ2_BODY_OPTIONS.filter((b) => b.code.includes("C")).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "body" }, medC] }, { in: [{ var: "action" }, SA] }] },
    message_sv: "Enkelverkande CQ2 har ingen gummidämpare; kroppsoptionerna är F, M och FM.",
    message_en: "Single-acting CQ2 has no rubber bumper; the body options are F, M and FM.",
    goto_step: steg("body"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "body" }, medC] }, { "==": [{ var: "air_hydro" }, "H"] }] },
    message_sv: "Luft-hydraulik finns inte med gummidämpare (not 4).",
    message_en: "The air-hydro type is not available with rubber bumper (note 4).",
    goto_step: steg("body"),
  });

  // ── givarspåret Z ──────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    // Vaktas på slaget så att felet visas när koden annars ser komplett ut,
    // inte i samma ögonblick som storleken väljs.
    if_json: { and: [{ in: [{ var: "bore" }, stora] }, { ">": [{ var: "stroke_mm" }, 0] }, { "!=": [{ var: "groove" }, "Z"] }] },
    message_sv: "ø32–100 har alltid givarspåret Z i koden (CQ2B32-30DZ), även utan magnet.",
    message_en: "ø32–100 always carries the Z sensor groove in the code (CQ2B32-30DZ), even without magnet.",
    goto_step: steg("groove"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "magnet" }, "D"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "!=": [{ var: "groove" }, "Z"] }] },
    message_sv: "Magnetcylindern CDQ2 har givarspåret Z: CDQ2B12-5DZ.",
    message_en: "The CDQ2 magnet cylinder carries the Z sensor groove: CDQ2B12-5DZ.",
    goto_step: steg("groove"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "bore" }, sma] }, { "!=": [{ var: "magnet" }, "D"] }, { "==": [{ var: "groove" }, "Z"] }] },
    message_sv: `ø${lista(sma.map(Number))} utan magnet har inget givarspår: CQ2B20-30D, inte CQ2B20-30DZ.`,
    message_en: `ø${lista(sma.map(Number), "and")} without magnet has no sensor groove: CQ2B20-30D, not CQ2B20-30DZ.`,
    goto_step: steg("groove"),
  });

  // ── fästbultar och kolvstångsfäste ─────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "bolt" }, "L"] }, { "!=": [{ var: "mounting" }, ""] }, { "!=": [{ var: "mounting" }, "B"] }] },
    message_sv: "Fästbultar (L) medlevereras bara med fäste B, genomgående hål.",
    message_en: "Mounting bolts (L) are shipped together only with mounting B, through-hole.",
    goto_step: steg("bolt"),
  });
  const utvandig = CQ2_BODY_OPTIONS.filter((b) => b.code.includes("M")).map((b) => b.code);
  const invandig = ["", ...CQ2_BODY_OPTIONS.filter((b) => !b.code.includes("M")).map((b) => b.code)];
  const kravUtv = CQ2_ROD_BRACKETS.filter((b) => b.needs_male_thread).map((b) => b.code);
  const kravInv = CQ2_ROD_BRACKETS.filter((b) => !b.needs_male_thread).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "bracket" }, kravUtv] }, { in: [{ var: "body" }, invandig] }] },
    message_sv: `Knäled (${lista(kravUtv)}) kräver utvändig kolvstångsgänga — välj kroppsoption M.`,
    message_en: `Knuckle joints (${lista(kravUtv, "and")}) need the male rod thread — choose body option M.`,
    goto_step: steg("bracket"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "bracket" }, kravInv] }, { in: [{ var: "body" }, utvandig] }] },
    message_sv: `Ledfäste typ A och B (${lista(kravInv)}) monteras på den invändiga gängan, inte på utvändig (M).`,
    message_en: `Simple joints A and B (${lista(kravInv, "and")}) mount on the female thread, not on the male (M).`,
    goto_step: steg("bracket"),
  });

  // ── givare ─────────────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { "!=": [{ var: "magnet" }, "D"] }] },
    message_sv: "En givare kräver magnetcylindern CDQ2 — välj inbyggd magnet.",
    message_en: "An auto switch needs the CDQ2 magnet cylinder — choose the built-in magnet.",
    goto_step: steg("magnet"),
  });
  for (const s of CQ2_SWITCHES.filter((x) => x.bores)) {
    const utan = alla.filter((b) => !s.bores!.includes(b));
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "switch" }, s.code] }, { in: [{ var: "bore" }, utan] }] },
      message_sv: `D-${s.code} finns för ø${lista(s.bores!.map(Number))}.`,
      message_en: `D-${s.code} exists for ø${lista(s.bores!.map(Number), "and")}.`,
      goto_step: steg("switch"),
    });
  }
  const inteSa = CQ2_SWITCHES.filter((x) => !x.single_acting_ok).map((x) => x.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "switch" }, inteSa] }, { in: [{ var: "action" }, SA] }] },
    message_sv: `D-${lista(inteSa)} går inte på enkelverkande CQ2 (sida 958).`,
    message_en: `D-${lista(inteSa, "and")} cannot be used on single-acting CQ2 (page 958).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  const reedUtanM = CQ2_SWITCHES.filter((x) => x.kind === "reed" && !CQ2_LEAD_M_REED_ONLY.includes(x.code)).map((x) => x.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "lead" }, "M"] }, { in: [{ var: "switch" }, reedUtanM] }] },
    message_sv: `1 m kabel finns bland reedgivarna bara för D-${lista(CQ2_LEAD_M_REED_ONLY)} (not 2).`,
    message_en: `Among the reed switches the 1 m lead wire exists only for D-${lista(CQ2_LEAD_M_REED_ONLY, "and")} (note 2).`,
    goto_step: steg("lead"),
  });

  // ── specialutföranden ──────────────────────────────────────────────────
  for (const m of CQ2_MTO) {
    if (m.bores) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { in: [{ var: "bore" }, alla.filter((b) => !m.bores!.includes(b))] }] },
        message_sv: `-${m.code} finns för ø${lista(m.bores.map(Number))}.`,
        message_en: `-${m.code} exists for ø${lista(m.bores.map(Number), "and")}.`,
        goto_step: steg("mto"),
      });
    }
    if (m.no_switch) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "!=": [{ var: "switch" }, ""] }] },
        message_sv: `-${m.code} finns bara utan givare.`,
        message_en: `-${m.code} is available without auto switch only.`,
        goto_step: steg("mto"),
      });
    }
    if (m.needs_switch) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "==": [{ var: "switch" }, ""] }] },
        message_sv: `-${m.code} finns bara med givare.`,
        message_en: `-${m.code} is available with auto switch only.`,
        goto_step: steg("mto"),
      });
    }
    if (m.air_hydro_only) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "!=": [{ var: "air_hydro" }, "H"] }] },
        message_sv: `-${m.code} finns bara för luft-hydraulik.`,
        message_en: `-${m.code} is available for the air-hydro type only.`,
        goto_step: steg("mto"),
      });
    }
  }
  const inteT = CQ2_MTO.filter((m) => m.not_for_t).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, inteT] }, { "==": [{ var: "action" }, "T"] }] },
    message_sv: `-${lista(inteT)} finns för enkelverkande bara med fjäderretur (S), inte fjäderutskjut (T).`,
    message_en: `-${lista(inteT, "and")} is available for single acting with spring return (S) only, not spring extend (T).`,
    goto_step: steg("mto"),
  });
  const baraDa = CQ2_MTO.filter((m) => m.da_only).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, baraDa] }, { in: [{ var: "action" }, SA] }] },
    message_sv: "Det specialutförandet står bara i den dubbelverkande nyckeln (sida 12), inte i den enkelverkande (sida 66).",
    message_en: "That made-to-order option is listed only in the double-acting key (page 12), not the single-acting one (page 66).",
    goto_step: steg("mto"),
  });

  // ── slaget ─────────────────────────────────────────────────────────────
  //
  // Dubbelverkande pneumatik: 1 mm-steg upp till 30/50/100 (mellanslag med
  // distans). Luft-hydraulik och fjäderretur: bara standardslagen.
  // Fjäderutskjut: standard plus mellanslag 1–9 respektive 1–19.
  const perMax = new Map<number, string[]>();
  for (const b of CQ2_BORES) perMax.set(b.da_stroke_max_mm, [...(perMax.get(b.da_stroke_max_mm) ?? []), b.code]);
  for (const [max, bores] of perMax) {
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "action" }, "D"] },
          { "!=": [{ var: "air_hydro" }, "H"] },
          { in: [{ var: "bore" }, bores] },
          { ">": [{ var: "stroke_mm" }, max] },
        ],
      },
      message_sv: `ø${lista(bores.map(Number))} går till ${max} mm slag i standardkroppen. Längre slag: serie CQ2 långt slag (egen nyckel).`,
      message_en: `ø${lista(bores.map(Number), "and")} goes up to ${max} mm stroke in the standard body. Longer: the CQ2 long-stroke series (separate key).`,
      goto_step: steg("stroke_mm"),
    });
  }
  const perHydro = new Map<string, string[]>();
  for (const b of CQ2_BORES.filter((x) => x.air_hydro)) {
    const nyckel = b.da_standard_strokes.join(",");
    perHydro.set(nyckel, [...(perHydro.get(nyckel) ?? []), b.code]);
  }
  for (const [slag, bores] of perHydro) {
    const lst = slag.split(",").map(Number);
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "air_hydro" }, "H"] },
          { in: [{ var: "bore" }, bores] },
          { ">": [{ var: "stroke_mm" }, 0] },
          { not: { in: [{ var: "stroke_mm" }, lst] } },
        ],
      },
      message_sv: `Luft-hydraulik ø${lista(bores.map(Number))} finns bara i standardslagen ${lista(lst)} mm — inga mellanslag.`,
      message_en: `Air-hydro ø${lista(bores.map(Number), "and")} exists only in the standard strokes ${lista(lst, "and")} mm — no intermediate strokes.`,
      goto_step: steg("stroke_mm"),
    });
  }
  const perSa = new Map<string, { bores: string[]; std: number[]; tmax: number }>();
  for (const b of CQ2_BORES.filter((x) => x.sa_standard_strokes)) {
    const nyckel = `${b.sa_standard_strokes!.join(",")}|${b.sa_t_intermediate_max_mm}`;
    const g = perSa.get(nyckel) ?? { bores: [], std: b.sa_standard_strokes!, tmax: b.sa_t_intermediate_max_mm! };
    g.bores.push(b.code);
    perSa.set(nyckel, g);
  }
  for (const g of perSa.values()) {
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "action" }, "S"] },
          { in: [{ var: "bore" }, g.bores] },
          { ">": [{ var: "stroke_mm" }, 0] },
          { not: { in: [{ var: "stroke_mm" }, g.std] } },
        ],
      },
      message_sv: `Fjäderretur ø${lista(g.bores.map(Number))} finns i slag ${lista(g.std)} mm — mellanslag finns inte för fjäderretur.`,
      message_en: `Spring return ø${lista(g.bores.map(Number), "and")} exists in strokes ${lista(g.std, "and")} mm — no intermediate strokes for spring return.`,
      goto_step: steg("stroke_mm"),
    });
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "action" }, "T"] },
          { in: [{ var: "bore" }, g.bores] },
          { ">": [{ var: "stroke_mm" }, g.tmax] },
          { not: { in: [{ var: "stroke_mm" }, g.std] } },
        ],
      },
      message_sv: `Fjäderutskjut ø${lista(g.bores.map(Number))} finns i slag ${lista(g.std)} mm, eller mellanslag 1–${g.tmax} mm med distans.`,
      message_en: `Spring extend ø${lista(g.bores.map(Number), "and")} exists in strokes ${lista(g.std, "and")} mm, or intermediate 1–${g.tmax} mm with spacer.`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── varning: minsta slag för givarmontage (sida 232) ───────────────────
  const perMin = new Map<string, string[]>();
  for (const s of CQ2_SWITCHES) {
    const nyckel = `${s.min_stroke_1}|${s.min_stroke_2}`;
    perMin.set(nyckel, [...(perMin.get(nyckel) ?? []), s.code]);
  }
  for (const [nyckel, koder] of perMin) {
    const [m1, m2] = nyckel.split("|").map(Number);
    rows.push({
      severity: "warn",
      if_json: {
        and: [
          { in: [{ var: "switch" }, koder] },
          { "==": [{ var: "count" }, "S"] },
          { ">": [{ var: "stroke_mm" }, 0] },
          { "<": [{ var: "stroke_mm" }, m1] },
        ],
      },
      message_sv: `Minsta slag för en givare D-${koder.join("/")} är ${m1} mm om givaren inte får sticka ut utanför cylinderkroppen (sida 958).`,
      message_en: `The minimum stroke for one D-${koder.join("/")} switch is ${m1} mm if the switch must not project beyond the cylinder body (page 958).`,
      goto_step: steg("stroke_mm"),
    });
    rows.push({
      severity: "warn",
      if_json: {
        and: [
          { in: [{ var: "switch" }, koder] },
          { "!=": [{ var: "count" }, "S"] },
          { ">": [{ var: "stroke_mm" }, 0] },
          { "<": [{ var: "stroke_mm" }, m2] },
        ],
      },
      message_sv: `Minsta slag för två givare D-${koder.join("/")} är ${m2} mm (sida 958). Välj en givare eller längre slag.`,
      message_en: `The minimum stroke for two D-${koder.join("/")} switches is ${m2} mm (page 958). Choose one switch or a longer stroke.`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of CQ2_BORES) {
    rows.push({
      severity: "info",
      if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { "!=": [{ var: "action" }, "S"] }, { "!=": [{ var: "action" }, "T"] }] },
      message_sv: `ø${b.bore_mm}: teoretisk kraft ${b.force_out_n_05mpa} N plus-sidan vid 0,5 MPa; max 1,0 MPa, min ${sv(b.da_min_pressure_mpa)} MPa; ` +
        `standardslag ${lista(b.da_standard_strokes)} mm, mellanslag i 1 mm-steg med distans.`,
      message_en: `ø${b.bore_mm}: theoretical force ${b.force_out_n_05mpa} N extending at 0.5 MPa; max 1.0 MPa, min ${b.da_min_pressure_mpa} MPa; ` +
        `standard strokes ${lista(b.da_standard_strokes, "and")} mm, intermediate strokes in 1 mm steps with spacer.`,
      goto_step: steg("bore"),
    });
    if (b.sa_min_pressure_mpa !== null) {
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { in: [{ var: "action" }, SA] }] },
        message_sv: `Enkelverkande ø${b.bore_mm}: minsta arbetstryck ${sv(b.sa_min_pressure_mpa)} MPa, standardslag ${lista(b.sa_standard_strokes!)} mm.`,
        message_en: `Single acting ø${b.bore_mm}: minimum operating pressure ${b.sa_min_pressure_mpa} MPa, standard strokes ${lista(b.sa_standard_strokes!, "and")} mm.`,
        goto_step: steg("bore"),
      });
    }
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "air_hydro" }, "H"] },
    message_sv: `Luft-hydraulik: turbinolja, ${CQ2_LIMITS.speed_mm_s.air_hydro[0]}–${CQ2_LIMITS.speed_mm_s.air_hydro[1]} mm/s, ` +
      `${CQ2_LIMITS.temp_c.air_hydro[0]}–${CQ2_LIMITS.temp_c.air_hydro[1]} °C, ingen dämpning.`,
    message_en: `Air-hydro: turbine oil, ${CQ2_LIMITS.speed_mm_s.air_hydro[0]}–${CQ2_LIMITS.speed_mm_s.air_hydro[1]} mm/s, ` +
      `${CQ2_LIMITS.temp_c.air_hydro[0]}–${CQ2_LIMITS.temp_c.air_hydro[1]} °C, no cushioning.`,
    goto_step: steg("air_hydro"),
  });
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "switch" }, ""] },
    message_sv: `Med givare är temperaturområdet ${CQ2_LIMITS.temp_c.with_switch[0]}…${CQ2_LIMITS.temp_c.with_switch[1]} °C ` +
      `(utan: till ${CQ2_LIMITS.temp_c.without_switch[1]} °C). Givaren levereras löst; 5 m kabel tillverkas på beställning.`,
    message_en: `With auto switch the temperature range is ${CQ2_LIMITS.temp_c.with_switch[0]}…${CQ2_LIMITS.temp_c.with_switch[1]} °C ` +
      `(without: up to ${CQ2_LIMITS.temp_c.without_switch[1]} °C). The switch ships loose; the 5 m lead is made to order.`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { and: [{ "!=": [{ var: "mounting" }, ""] }, { "!=": [{ var: "mounting" }, "B"] }, { "!=": [{ var: "mounting" }, "A"] }] },
    message_sv: "Fästet levereras löst, inte monterat. Cylinderns fästbultar ingår inte (sida 785).",
    message_en: "The mounting bracket ships loose, not assembled. Cylinder mounting bolts are not included (page 785).",
    goto_step: steg("mounting"),
  });

  return rows;
}

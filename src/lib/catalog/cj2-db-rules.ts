/**
 * CJ2-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: ø6 mot luftdämpning, gaffelfäste,
 * knäled och skena; porten mot fästet; pivotfästet mot fästet; magneten mot
 * givarfästet; givaren mot fästet och kabellängden; slaget mot borrningen;
 * specialutförandena mot dämpning, borrning, givare och fäste.
 */
import {
  CJ2_BORES,
  CJ2_LEADS,
  CJ2_LEAD_INDEX,
  CJ2_LIMITS,
  CJ2_MOUNTINGS,
  CJ2_MTO,
  CJ2_ROD_ENDS,
  CJ2_SWITCHES,
} from "./cj2";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type CJ2DbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const LEAD_NAMN: Record<string, [string, string]> = {
  "": ["0,5 m (ingen bokstav)", "0.5 m (no letter)"],
  M: ["1 m (M)", "1 m (M)"],
  L: ["3 m (L)", "3 m (L)"],
  Z: ["5 m (Z)", "5 m (Z)"],
  N: ["utan kabel (N)", "without lead wire (N)"],
};

export function buildCj2DbRules(): CJ2DbRule[] {
  const rows: CJ2DbRule[] = [];
  const steg = (p: string) => `cj2-${p}`;
  const alla = CJ2_BORES.map((b) => b.code);
  const sma = CJ2_BORES.filter((b) => !b.clevis_ok).map((b) => b.code);
  const stora = CJ2_BORES.filter((b) => b.clevis_ok).map((b) => b.code);

  // ── ø6 är den lilla: gummi, band, inget gaffelfäste, ingen knäled ───────
  const utanDampning = CJ2_BORES.filter((b) => b.min_pressure_cushion_mpa === null).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "cushion" }, "A"] }, { in: [{ var: "bore" }, utanDampning] }] },
    message_sv: `Luftdämpning finns inte för ø${lista(utanDampning)} — bara gummidämpning (sida 74).`,
    message_en: `Air cushion is not available for ø${lista(utanDampning, "and")} — rubber bumper only (page 74).`,
    goto_step: steg("cushion"),
  });
  const storaFasten = CJ2_MOUNTINGS.filter((m) => m.large_only).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mounting" }, storaFasten] }, { in: [{ var: "bore" }, sma] }] },
    message_sv: `Dubbelt gaffelfäste (${lista(storaFasten)}) finns bara för ø${lista(stora)} (sida 74).`,
    message_en: `The double clevis (${lista(storaFasten, "and")}) exists only for ø${lista(stora, "and")} (page 74).`,
    goto_step: steg("mounting"),
  });
  const storaAndar = CJ2_ROD_ENDS.filter((x) => x.large_only).map((x) => x.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "rod_end" }, storaAndar] }, { in: [{ var: "bore" }, sma] }] },
    message_sv: `Knäled ${lista(storaAndar)} finns bara för ø${lista(stora)} (sida 74).`,
    message_en: `Knuckle joint ${lista(storaAndar, "and")} exists only for ø${lista(stora, "and")} (page 74).`,
    goto_step: steg("rod_end"),
  });
  const utanSkena = CJ2_BORES.filter((b) => !b.rail_ok).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch_mount" }, "A"] }, { in: [{ var: "bore" }, utanSkena] }] },
    message_sv: `ø${lista(utanSkena)} har bara bandmontage (B) för givare (sida 74).`,
    message_en: `ø${lista(utanSkena, "and")} has band mounting (B) only for auto switches (page 74).`,
    goto_step: steg("switch_mount"),
  });

  // ── porten och pivotfästet följer fästet ───────────────────────────────
  const fastPort = CJ2_MOUNTINGS.filter((m) => m.port_fixed).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "port" }, "R"] }, { in: [{ var: "mounting" }, fastPort] }] },
    message_sv: `Med fäste ${lista(fastPort, "eller")} sitter porten vinkelrätt mot cylinderaxeln — axiell port R går inte (sida 74).`,
    message_en: `With mounting ${lista(fastPort, "or")} the port is perpendicular to the cylinder axis — axial port R is not possible (page 74).`,
    goto_step: steg("port"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "pivot" }, "N"] }, { "!=": [{ var: "mounting" }, "D"] }, { "!=": [{ var: "mounting" }, ""] }] },
    message_sv: "Pivotfästet N hör till det dubbla gaffelfästet D (sida 74).",
    message_en: "The pivot bracket N belongs to the double clevis D (page 74).",
    goto_step: steg("pivot"),
  });

  // ── magnet och givarfäste hör ihop ─────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch_mount" }, ""] }, { "!=": [{ var: "magnet" }, "D"] }] },
    message_sv: "Givarfästet (A/B) anges bara för magnetcylindern CDJ2 — välj inbyggd magnet, eller inget fäste.",
    message_en: "The auto switch mounting type (A/B) is specified only for the CDJ2 magnet cylinder — choose the built-in magnet, or no mounting type.",
    goto_step: steg("switch_mount"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "magnet" }, "D"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "==": [{ var: "switch_mount" }, ""] }] },
    message_sv: "Magnetcylindern CDJ2 beställs med givarfäste, A för skena eller B för band, även utan givare (sida 74).",
    message_en: "The CDJ2 magnet cylinder is ordered with an auto switch mounting type, A for rail or B for band, even without a switch (page 74).",
    goto_step: steg("switch_mount"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { "==": [{ var: "switch_mount" }, ""] }] },
    message_sv: "En givare kräver magnetcylindern CDJ2 med givarfäste A eller B.",
    message_en: "An auto switch needs the CDJ2 magnet cylinder with mounting type A or B.",
    goto_step: steg("switch_mount"),
  });
  const baraBand = CJ2_SWITCHES.filter((s) => !s.rail).map((s) => s.code);
  const baraSkena = CJ2_SWITCHES.filter((s) => !s.band).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch_mount" }, "A"] }, { in: [{ var: "switch" }, baraBand] }] },
    message_sv: `D-${lista(baraBand)} finns bara för bandmontage (B) (sida 74).`,
    message_en: `D-${lista(baraBand, "and")} exist for band mounting (B) only (page 74).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch_mount" }, "B"] }, { in: [{ var: "switch" }, baraSkena] }] },
    message_sv: `D-${lista(baraSkena)} finns bara för skenmontage (A) (sida 74).`,
    message_en: `D-${lista(baraSkena, "and")} exist for rail mounting (A) only (page 74).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });

  // ── kabellängden per givare (sida 74, tabellen) ────────────────────────
  for (const lead of CJ2_LEADS.map((l) => l.code)) {
    const i = CJ2_LEAD_INDEX[lead];
    const inte = CJ2_SWITCHES.filter((s) => s.leads[i] === "-").map((s) => s.code);
    if (inte.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, inte] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} finns inte för D-${inte.join("/")} (sida 74).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} does not exist for D-${inte.join("/")} (page 74).`,
        goto_step: steg("lead"),
      });
    }
  }
  for (const lead of ["", ...CJ2_LEADS.map((l) => l.code)]) {
    const i = CJ2_LEAD_INDEX[lead];
    const pa = CJ2_SWITCHES.filter((s) => s.leads[i] === "O").map((s) => s.code);
    if (!pa.length) continue;
    rows.push({
      severity: "warn",
      if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
      message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för D-${pa.join("/")} (sida 74, ○)${lead === "" ? " — 3 m (L) är standard" : ""}.`,
      message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for D-${pa.join("/")} (page 74, ○)${lead === "" ? " — 3 m (L) is standard" : ""}.`,
      goto_step: steg("lead"),
    });
  }

  // ── slaget ─────────────────────────────────────────────────────────────
  const perMax = new Map<number, string[]>();
  for (const b of CJ2_BORES) perMax.set(b.max_stroke_mm, [...(perMax.get(b.max_stroke_mm) ?? []), b.code]);
  for (const [max, bores] of perMax) {
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, max] }] },
      message_sv: `ø${lista(bores)} tillverkas upp till ${max} mm slag (sida 75).`,
      message_en: `ø${lista(bores, "and")} is manufactured up to ${max} mm stroke (page 75).`,
      goto_step: steg("stroke_mm"),
    });
  }
  for (const b of CJ2_BORES) {
    rows.push({
      severity: "info",
      if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<=": [{ var: "stroke_mm" }, b.max_stroke_mm] }, { not: { in: [{ var: "stroke_mm" }, b.standard_strokes] } }] },
      message_sv: `Standardslag för ø${b.bore_mm} är ${lista(b.standard_strokes)} mm; mellanslag i 1 mm-steg tillverkas på beställning utan distanser (sida 75).`,
      message_en: `Standard strokes for ø${b.bore_mm} are ${lista(b.standard_strokes, "and")} mm; intermediate strokes in 1 mm increments are produced upon receipt of order, without spacers (page 75).`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── varning: minsta slag för givarmontage (sida 177) ───────────────────
  for (const mount of ["B", "A"] as const) {
    const perMin = new Map<string, string[]>();
    for (const s of CJ2_SWITCHES) {
      const min = mount === "B" ? s.band_min : s.rail_min;
      if (!min) continue;
      const nyckel = `${min[0]}|${min[1]}`;
      perMin.set(nyckel, [...(perMin.get(nyckel) ?? []), s.code]);
    }
    const var_ = mount === "B" ? "band" : "skena";
    const var_en = mount === "B" ? "band" : "rail";
    for (const [nyckel, koder] of perMin) {
      const [m1, m2] = nyckel.split("|").map(Number);
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "switch_mount" }, mount] }, { in: [{ var: "switch" }, koder] }, { "==": [{ var: "count" }, "S"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, m1] }] },
        message_sv: `Minsta slag för en givare D-${koder.join("/")} på ${var_} är ${m1} mm (sida 177).`,
        message_en: `The minimum stroke for one D-${koder.join("/")} switch on ${var_en} is ${m1} mm (page 177).`,
        goto_step: steg("stroke_mm"),
      });
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "switch_mount" }, mount] }, { in: [{ var: "switch" }, koder] }, { "!=": [{ var: "count" }, "S"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, m2] }] },
        message_sv: `Minsta slag för två givare D-${koder.join("/")} på ${var_} är ${m2} mm (sida 177). Välj en givare eller längre slag.`,
        message_en: `The minimum stroke for two D-${koder.join("/")} switches on ${var_en} is ${m2} mm (page 177). Choose one switch or a longer stroke.`,
        goto_step: steg("stroke_mm"),
      });
    }
  }

  // ── specialutföranden (sida 72 och 75) ─────────────────────────────────
  const dampGrupp = CJ2_MTO.filter((m) => m.no_cushion).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, dampGrupp] }, { "==": [{ var: "cushion" }, "A"] }] },
    message_sv: `-${lista(dampGrupp)} finns inte med luftdämpning (sida 72, not 4).`,
    message_en: `-${lista(dampGrupp, "and")} are not available with air cushion (page 72, note 4).`,
    goto_step: steg("mto"),
  });
  const givarGrupp = CJ2_MTO.filter((m) => m.no_switch).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, givarGrupp] }, { "!=": [{ var: "switch" }, ""] }] },
    message_sv: `-${lista(givarGrupp)} finns inte med givare (sida 72, not 3).`,
    message_en: `-${lista(givarGrupp, "and")} are not available with an auto switch (page 72, note 3).`,
    goto_step: steg("mto"),
  });
  const bandGrupp = CJ2_MTO.filter((m) => m.band_only).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, bandGrupp] }, { "==": [{ var: "switch_mount" }, "A"] }] },
    message_sv: `Med -${lista(bandGrupp)} monteras givare bara med band (B), inte på skena (sida 72, not 2 och 11).`,
    message_en: `With -${lista(bandGrupp, "and")} auto switches are band-mounted (B) only, not rail-mounted (page 72, notes 2 and 11).`,
    goto_step: steg("mto"),
  });
  const perBores = new Map<string, string[]>();
  for (const m of CJ2_MTO) if (m.bores) perBores.set(m.bores.join(","), [...(perBores.get(m.bores.join(",")) ?? []), m.code]);
  for (const [bores, koder] of perBores) {
    const b = bores.split(",");
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "mto" }, koder] }, { in: [{ var: "bore" }, alla.filter((x) => !b.includes(x))] }] },
      message_sv: `-${lista(koder)} finns för ø${lista(b)} (sida 72).`,
      message_en: `-${lista(koder, "and")} exist for ø${lista(b, "and")} (page 72).`,
      goto_step: steg("mto"),
    });
  }
  for (const m of CJ2_MTO) {
    if (!m.mounting) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "!=": [{ var: "mounting" }, m.mounting] }, { "!=": [{ var: "mounting" }, ""] }] },
      message_sv: `-${m.code} är det dubbla gaffelfästet med snabbsprint — kräver fäste ${m.mounting} (sida 182).`,
      message_en: `-${m.code} is the double clevis with one-touch connecting pin — needs mounting ${m.mounting} (page 182).`,
      goto_step: steg("mto"),
    });
  }

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of CJ2_BORES) {
    const kraft = Math.round(Math.PI * (b.bore_mm / 2) ** 2 * 0.5);
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `ø${b.bore_mm}: cirka ${kraft} N plus-sidan vid 0,5 MPa (kolvarea × tryck); minsta tryck ${sv(b.min_pressure_rubber_mpa)} MPa` +
        `${b.min_pressure_cushion_mpa !== null ? ` (${sv(b.min_pressure_cushion_mpa)} MPa med luftdämpning)` : ""}; max ${sv(CJ2_LIMITS.max_pressure_mpa)} MPa; ` +
        `standardslag ${lista(b.standard_strokes)} mm, tillverkas upp till ${b.max_stroke_mm} mm (sida 75).`,
      message_en: `ø${b.bore_mm}: about ${kraft} N extending at 0.5 MPa (piston area × pressure); minimum pressure ${b.min_pressure_rubber_mpa} MPa` +
        `${b.min_pressure_cushion_mpa !== null ? ` (${b.min_pressure_cushion_mpa} MPa with air cushion)` : ""}; max ${CJ2_LIMITS.max_pressure_mpa} MPa; ` +
        `standard strokes ${lista(b.standard_strokes, "and")} mm, manufactured up to ${b.max_stroke_mm} mm (page 75).`,
      goto_step: steg("bore"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "switch" }, ""] },
    message_sv: `Med givare är temperaturområdet ${CJ2_LIMITS.temp_c.with_switch[0]}…${CJ2_LIMITS.temp_c.with_switch[1]} °C ` +
      `(utan: ${CJ2_LIMITS.temp_c.without_switch[0]}…${CJ2_LIMITS.temp_c.without_switch[1]} °C). Givaren levereras löst; bandfästet är förmonterat (sida 74).`,
    message_en: `With auto switch the temperature range is ${CJ2_LIMITS.temp_c.with_switch[0]}…${CJ2_LIMITS.temp_c.with_switch[1]} °C ` +
      `(without: ${CJ2_LIMITS.temp_c.without_switch[0]}…${CJ2_LIMITS.temp_c.without_switch[1]} °C). The switch ships loose; the band bracket is pre-assembled (page 74).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { or: [{ in: [{ var: "mounting" }, ["L", "M", "F", "G"]] }, { "!=": [{ var: "pivot" }, ""] }, { "!=": [{ var: "rod_end" }, ""] }] },
    message_sv: "Fot-/flänsfäste, pivotfäste och kolvstångstillbehör levereras löst tillsammans med cylindern, inte monterade (sida 74).",
    message_en: "Foot/flange brackets, pivot bracket and rod end accessories ship loose together with the cylinder, not assembled (page 74).",
    goto_step: steg("mounting"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "cushion" }, "A"] },
    message_sv: `Med luftdämpning är kolvhastigheten ${CJ2_LIMITS.speed_mm_s.cushion[0]}–${CJ2_LIMITS.speed_mm_s.cushion[1]} mm/s (gummidämpning ${CJ2_LIMITS.speed_mm_s.rubber[0]}–${CJ2_LIMITS.speed_mm_s.rubber[1]} mm/s) (sida 75).`,
    message_en: `With air cushion the piston speed is ${CJ2_LIMITS.speed_mm_s.cushion[0]}–${CJ2_LIMITS.speed_mm_s.cushion[1]} mm/s (rubber bumper ${CJ2_LIMITS.speed_mm_s.rubber[0]}–${CJ2_LIMITS.speed_mm_s.rubber[1]} mm/s) (page 75).`,
    goto_step: steg("cushion"),
  });

  return rows;
}

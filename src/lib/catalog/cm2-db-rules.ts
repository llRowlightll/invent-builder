/**
 * CM2-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: honstången mot bälg och tillbehör,
 * pivotfästet mot fästet, bälgen mot slaget, givaren mot magneten och
 * kabellängden, slaget mot borrningen, och specialutförandena mot dämpning,
 * givare, bälg, slag, fäste och tillbehör.
 */
import {
  CM2_BOOTS,
  CM2_BOOT_MAX_STROKE_MM,
  CM2_BORES,
  CM2_LEADS,
  CM2_LEAD_INDEX,
  CM2_LIMITS,
  CM2_MOUNTINGS,
  CM2_MTO,
  CM2_ROD_ENDS,
  CM2_STANDARD_STROKES,
  CM2_SWITCHES,
} from "./cm2";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type CM2DbRule = DsbcDbRule;

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
};

export function buildCm2DbRules(): CM2DbRule[] {
  const rows: CM2DbRule[] = [];
  const steg = (p: string) => `cm2-${p}`;
  const bootar = CM2_BOOTS.map((b) => b.code);
  const andar = CM2_ROD_ENDS.map((r) => r.code);

  // ── honstången F: ingen bälg, inget tillbehör ─────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "rod_thread" }, "F"] }, { in: [{ var: "boot" }, bootar] }] },
    message_sv: "Honstång F levereras utan bälg (sida 5).",
    message_en: "The female rod end F ships without a rod boot (page 5).",
    goto_step: steg("boot"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "rod_thread" }, "F"] }, { in: [{ var: "rod_end" }, andar] }] },
    message_sv: "Kolvstångstillbehör (V/W/Q) finns inte för honstången F (sida 5).",
    message_en: "No rod end bracket (V/W/Q) is provided for the female rod end F (page 5).",
    goto_step: steg("rod_end"),
  });

  // ── pivotfästet följer fästet ──────────────────────────────────────────
  const medPivot = CM2_MOUNTINGS.filter((m) => m.pivot_ok).map((m) => m.code);
  const utanPivot = CM2_MOUNTINGS.filter((m) => !m.pivot_ok).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "pivot" }, "N"] }, { in: [{ var: "mounting" }, utanPivot] }] },
    message_sv: `Pivotfästet N finns bara för fäste ${lista(medPivot)} (sida 5).`,
    message_en: `The pivot bracket N exists only for mounting ${lista(medPivot, "and")} (page 5).`,
    goto_step: steg("pivot"),
  });

  // ── bälgen begränsar slaget ────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "boot" }, bootar] }, { ">": [{ var: "stroke_mm" }, CM2_BOOT_MAX_STROKE_MM] }] },
    message_sv: `Med bälg är största slag ${CM2_BOOT_MAX_STROKE_MM} mm (sida 6, not 3).`,
    message_en: `With a rod boot the maximum stroke is ${CM2_BOOT_MAX_STROKE_MM} mm (page 6, note 3).`,
    goto_step: steg("stroke_mm"),
  });

  // ── givaren kräver magnet; kabel och antal hör till givaren ────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { "!=": [{ var: "magnet" }, "D"] }] },
    message_sv: "En givare kräver magnetcylindern CDM2 — välj inbyggd magnet (sida 5).",
    message_en: "An auto switch needs the CDM2 magnet cylinder — choose the built-in magnet (page 5).",
    goto_step: steg("magnet"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  for (const lead of ["", ...CM2_LEADS.map((l) => l.code)]) {
    const i = CM2_LEAD_INDEX[lead];
    const pa = CM2_SWITCHES.filter((s) => s.leads[i] === "O").map((s) => s.code);
    if (!pa.length) continue;
    rows.push({
      severity: "warn",
      if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
      message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för D-${pa.join("/")} (sida 5, ○)${lead === "" ? " — 3 m (L) är standard" : ""}.`,
      message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for D-${pa.join("/")} (page 5, ○)${lead === "" ? " — 3 m (L) is standard" : ""}.`,
      goto_step: steg("lead"),
    });
  }
  const perMin = new Map<string, string[]>();
  for (const s of CM2_SWITCHES) perMin.set(s.min.join("|"), [...(perMin.get(s.min.join("|")) ?? []), s.code]);
  for (const [nyckel, koder] of perMin) {
    const [m1, m2] = nyckel.split("|").map(Number);
    rows.push({
      severity: "warn",
      if_json: { and: [{ in: [{ var: "switch" }, koder] }, { "==": [{ var: "count" }, "S"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, m1] }] },
      message_sv: `Minsta slag för en givare D-${koder.join("/")} är ${m1} mm (sida 62).`,
      message_en: `The minimum stroke for one D-${koder.join("/")} switch is ${m1} mm (page 62).`,
      goto_step: steg("stroke_mm"),
    });
    rows.push({
      severity: "warn",
      if_json: { and: [{ in: [{ var: "switch" }, koder] }, { "!=": [{ var: "count" }, "S"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, m2] }] },
      message_sv: `Minsta slag för två givare D-${koder.join("/")} på olika sidor är ${m2} mm (sida 62). Välj en givare eller längre slag.`,
      message_en: `The minimum stroke for two D-${koder.join("/")} switches on different surfaces is ${m2} mm (page 62). Choose one switch or a longer stroke.`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── slaget ─────────────────────────────────────────────────────────────
  const perMax = new Map<number, string[]>();
  for (const b of CM2_BORES) perMax.set(b.max_stroke_mm, [...(perMax.get(b.max_stroke_mm) ?? []), b.code]);
  for (const [max, bores] of perMax) {
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, max] }] },
      message_sv: `ø${lista(bores)} tillverkas upp till ${max} mm slag (sida 6).`,
      message_en: `ø${lista(bores, "and")} is manufactured up to ${max} mm stroke (page 6).`,
      goto_step: steg("stroke_mm"),
    });
  }
  rows.push({
    severity: "error",
    if_json: { and: [{ ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, CM2_LIMITS.min_stroke_mm] }] },
    message_sv: `Minsta tillverkade slag är ${CM2_LIMITS.min_stroke_mm} mm (sida 6).`,
    message_en: `The minimum manufactured stroke is ${CM2_LIMITS.min_stroke_mm} mm (page 6).`,
    goto_step: steg("stroke_mm"),
  });
  rows.push({
    severity: "info",
    if_json: { and: [{ ">=": [{ var: "stroke_mm" }, CM2_LIMITS.min_stroke_mm] }, { not: { in: [{ var: "stroke_mm" }, CM2_STANDARD_STROKES] } }] },
    message_sv: `Standardslag är ${lista(CM2_STANDARD_STROKES)} mm; mellanslag i 1 mm-steg tillverkas på beställning utan distanser (sida 6, not 1).`,
    message_en: `Standard strokes are ${lista(CM2_STANDARD_STROKES, "and")} mm; intermediate strokes in 1 mm increments are produced upon receipt of order, without spacers (page 6, note 1).`,
    goto_step: steg("stroke_mm"),
  });

  // ── specialutföranden ──────────────────────────────────────────────────
  const gummi = CM2_MTO.filter((m) => m.rubber_only).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, gummi] }, { "==": [{ var: "cushion" }, "A"] }] },
    message_sv: `-${lista(gummi)} finns bara med gummidämpning (sida 6, not 1; sida 71).`,
    message_en: `-${lista(gummi, "and")} are available with rubber bumper only (page 6, note 1; page 71).`,
    goto_step: steg("mto"),
  });
  const luftBegaran = CM2_MTO.filter((m) => m.air_on_request).map((m) => m.code);
  rows.push({
    severity: "warn",
    if_json: { and: [{ in: [{ var: "mto" }, luftBegaran] }, { "==": [{ var: "cushion" }, "A"] }] },
    message_sv: `-${lista(luftBegaran)} med luftdämpning levereras på begäran, inte som specialutförande ur listan (sida 4, ○).`,
    message_en: `-${lista(luftBegaran, "and")} with air cushion is supplied per request, not as a listed made-to-order option (page 4, ○).`,
    goto_step: steg("mto"),
  });
  const utanGivare = CM2_MTO.filter((m) => m.no_switch).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, utanGivare] }, { "!=": [{ var: "switch" }, ""] }] },
    message_sv: `-${lista(utanGivare)} finns inte med givare (sida 4, not 2).`,
    message_en: `-${lista(utanGivare, "and")} are not available with an auto switch (page 4, note 2).`,
    goto_step: steg("mto"),
  });
  const utanBalg = CM2_MTO.filter((m) => m.no_boot).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, utanBalg] }, { in: [{ var: "boot" }, bootar] }] },
    message_sv: `-${lista(utanBalg)} finns inte med bälg (sida 71).`,
    message_en: `-${lista(utanBalg, "and")} are not available with a rod boot (page 71).`,
    goto_step: steg("mto"),
  });
  const perSlag = new Map<number, string[]>();
  for (const m of CM2_MTO) if (m.max_stroke_mm !== undefined) perSlag.set(m.max_stroke_mm, [...(perSlag.get(m.max_stroke_mm) ?? []), m.code]);
  for (const [max, koder] of perSlag) {
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "mto" }, koder] }, { ">": [{ var: "stroke_mm" }, max] }] },
      message_sv: `-${lista(koder)} tillverkas upp till ${max} mm slag (sida 72, tabell 1).`,
      message_en: `-${lista(koder, "and")} are manufactured up to ${max} mm stroke (page 72, table 1).`,
      goto_step: steg("mto"),
    });
  }
  const gaffel = CM2_MOUNTINGS.filter((m) => m.clevis_or_trunnion).map((m) => m.code);
  for (const m of CM2_MTO) {
    if (m.no_clevis) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { in: [{ var: "mounting" }, gaffel] }] },
        message_sv: `Fäste ${lista(gaffel)} finns bara med -XC6A, inte -${m.code} (sida 72, not 1).`,
        message_en: `Mounting ${lista(gaffel, "and")} is available with -XC6A only, not -${m.code} (page 72, note 1).`,
        goto_step: steg("mto"),
      });
    }
    if (m.needs_rod_end) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "!=": [{ var: "rod_end" }, m.needs_rod_end] }] },
        message_sv: `-${m.code} är den dubbla knäleden med fjädersprint — välj kolvstångstillbehör ${m.needs_rod_end} (sida 73).`,
        message_en: `-${m.code} is the double knuckle joint with spring pin — choose rod end bracket ${m.needs_rod_end} (page 73).`,
        goto_step: steg("rod_end"),
      });
    }
    if (m.needs_mounting_nut) {
      const utanMutter = CM2_MOUNTINGS.filter((x) => !x.mounting_nut).map((x) => x.code);
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { in: [{ var: "mounting" }, utanMutter] }] },
        message_sv: `-${m.code} är fästmuttern med stoppskruv; fäste ${lista(utanMutter)} har ingen fästmutter (sida 7 och 74).`,
        message_en: `-${m.code} is the mounting nut with set screw; mounting ${lista(utanMutter, "and")} has no mounting nut (pages 7 and 74).`,
        goto_step: steg("mto"),
      });
    }
  }

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of CM2_BORES) {
    const kraft = Math.round(Math.PI * (b.bore_mm / 2) ** 2 * 0.5);
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `ø${b.bore_mm}: cirka ${kraft} N plus-sidan vid 0,5 MPa (kolvarea × tryck); ${sv(CM2_LIMITS.min_pressure_mpa)}–${sv(CM2_LIMITS.max_pressure_mpa)} MPa; standardslag ${lista(CM2_STANDARD_STROKES)} mm, tillverkas ${CM2_LIMITS.min_stroke_mm}–${b.max_stroke_mm} mm (sida 6).`,
      message_en: `ø${b.bore_mm}: about ${kraft} N extending at 0.5 MPa (piston area × pressure); ${CM2_LIMITS.min_pressure_mpa}–${CM2_LIMITS.max_pressure_mpa} MPa; standard strokes ${lista(CM2_STANDARD_STROKES, "and")} mm, manufactured ${CM2_LIMITS.min_stroke_mm}–${b.max_stroke_mm} mm (page 6).`,
      goto_step: steg("bore"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "switch" }, ""] },
    message_sv: `Med givare är temperaturområdet ${CM2_LIMITS.temp_c.with_switch[0]}…${CM2_LIMITS.temp_c.with_switch[1]} °C (utan: ${CM2_LIMITS.temp_c.without_switch[0]}…${CM2_LIMITS.temp_c.without_switch[1]} °C). Givaren levereras löst; bandfästet är förmonterat (sida 5).`,
    message_en: `With auto switch the temperature range is ${CM2_LIMITS.temp_c.with_switch[0]}…${CM2_LIMITS.temp_c.with_switch[1]} °C (without: ${CM2_LIMITS.temp_c.without_switch[0]}…${CM2_LIMITS.temp_c.without_switch[1]} °C). The switch ships loose; the band bracket is pre-assembled (page 5).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { or: [{ "!=": [{ var: "pivot" }, ""] }, { "!=": [{ var: "rod_end" }, ""] }] },
    message_sv: "Pivotfäste och kolvstångstillbehör levereras lösa tillsammans med cylindern, inte monterade; enkel knäled V levereras utan sprint (sida 5).",
    message_en: "Pivot bracket and rod end bracket ship loose together with the cylinder, not assembled; the single knuckle joint V ships without a pin (page 5).",
    goto_step: steg("rod_end"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "cushion" }, "A"] },
    message_sv: `Med luftdämpning är kolvhastigheten ${CM2_LIMITS.speed_mm_s.cushion[0]}–${CM2_LIMITS.speed_mm_s.cushion[1]} mm/s (gummidämpning ${CM2_LIMITS.speed_mm_s.rubber[0]}–${CM2_LIMITS.speed_mm_s.rubber[1]} mm/s); slag kortare än dämpsträckan (11 mm) ger sämre dämpning (sida 6).`,
    message_en: `With air cushion the piston speed is ${CM2_LIMITS.speed_mm_s.cushion[0]}–${CM2_LIMITS.speed_mm_s.cushion[1]} mm/s (rubber bumper ${CM2_LIMITS.speed_mm_s.rubber[0]}–${CM2_LIMITS.speed_mm_s.rubber[1]} mm/s); strokes shorter than the cushion length (11 mm) reduce the cushioning (page 6).`,
    goto_step: steg("cushion"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "mto" }, ["XC4A", "XC4B"]] },
    message_sv: "-XC4A/XC4B har minsta arbetstryck 0,1 MPa (standard 0,05) (sida 71).",
    message_en: "-XC4A/XC4B have a minimum operating pressure of 0.1 MPa (standard 0.05) (page 71).",
    goto_step: steg("mto"),
  });

  return rows;
}

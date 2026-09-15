/**
 * C85-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: luftdämpningen (gavel, borrning,
 * slag), fästet mot gaveln, givaren mot givarfästet och borrningen, och
 * specialutförandena mot dämpning, borrning och tillbehör.
 */
import {
  C85_BOOTS,
  C85_BOOT_BORES,
  C85_BORES,
  C85_BRACKETS,
  C85_COVERS,
  C85_LIMITS,
  C85_MTO,
  C85_SWITCHES,
} from "./c85";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type C85DbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");

export function buildC85DbRules(): C85DbRule[] {
  const rows: C85DbRule[] = [];
  const steg = (p: string) => `c85-${p}`;
  const alla = C85_BORES.map((b) => b.code);

  // ── luftdämpning ───────────────────────────────────────────────────────
  const utanDampning = C85_BORES.filter((b) => b.min_pressure_cushion_mpa === null).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "cushion" }, "C"] }, { in: [{ var: "bore" }, utanDampning] }] },
    message_sv: `Luftdämpning finns inte för ø${lista(utanDampning)} (sida 6).`,
    message_en: `Air cushion is not available for ø${lista(utanDampning, "and")} (page 6).`,
    goto_step: steg("cushion"),
  });
  const utanDampGavel = C85_COVERS.filter((c) => !c.air_cushion_ok).map((c) => c.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "cushion" }, "C"] }, { in: [{ var: "cover" }, utanDampGavel] }] },
    message_sv: `Luftdämpning finns bara med basgaveln N, inte ${lista(utanDampGavel)} (sida 6).`,
    message_en: `Air cushion exists only with the basic head cover N, not ${lista(utanDampGavel, "and")} (page 6).`,
    goto_step: steg("cushion"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "cushion" }, "C"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, C85_LIMITS.cushion_min_stroke_mm] }] },
    message_sv: `Med luftdämpning är minsta slag ${C85_LIMITS.cushion_min_stroke_mm} mm (sida 7, not 4).`,
    message_en: `With air cushion the minimum stroke is ${C85_LIMITS.cushion_min_stroke_mm} mm (page 7, note 4).`,
    goto_step: steg("stroke_mm"),
  });

  // ── bälg bara ø20 och ø25 ──────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "boot" }, C85_BOOTS.map((b) => b.code)] }, { in: [{ var: "bore" }, alla.filter((b) => !C85_BOOT_BORES.includes(b))] }] },
    message_sv: `Bälg finns bara för ø${lista(C85_BOOT_BORES)}.`,
    message_en: `The rod boot exists only for ø${lista(C85_BOOT_BORES, "and")}.`,
    goto_step: steg("boot"),
  });

  // ── fästet följer gaveln ───────────────────────────────────────────────
  for (const c of C85_COVERS) {
    const inte = C85_BRACKETS.map((b) => b.code).filter((b) => !c.brackets.includes(b));
    if (inte.length === 0) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "cover" }, c.code] }, { in: [{ var: "bracket" }, inte] }] },
      message_sv: `Gavel ${c.code} tar fäste ${lista(c.brackets, "eller")}, inte ${lista(inte)} (sida 6).`,
      message_en: `Head cover ${c.code} takes bracket ${lista(c.brackets, "or")}, not ${lista(inte, "and")} (page 6).`,
      goto_step: steg("bracket"),
    });
  }

  // ── magnet och givarfäste hör ihop ─────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch_mount" }, ""] }, { "!=": [{ var: "magnet" }, "D"] }] },
    message_sv: "Givarfästet (A/B) anges bara för magnetcylindern CD85 — välj inbyggd magnet, eller inget fäste.",
    message_en: "The auto switch mounting type (A/B) is specified only for the CD85 magnet cylinder — choose the built-in magnet, or no mounting type.",
    goto_step: steg("switch_mount"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "magnet" }, "D"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "==": [{ var: "switch_mount" }, ""] }] },
    message_sv: "Magnetcylindern CD85 beställs med givarfäste: A för skena eller B för band (sida 6).",
    message_en: "The CD85 magnet cylinder is ordered with an auto switch mounting type: A for rail or B for band (page 6).",
    goto_step: steg("switch_mount"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { "==": [{ var: "switch_mount" }, ""] }] },
    message_sv: "En givare kräver magnetcylindern CD85 med givarfäste A eller B.",
    message_en: "An auto switch needs the CD85 magnet cylinder with mounting type A or B.",
    goto_step: steg("switch_mount"),
  });
  const baraBand = C85_SWITCHES.filter((s) => !s.rail).map((s) => s.code);
  const baraSkena = C85_SWITCHES.filter((s) => !s.band).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch_mount" }, "A"] }, { in: [{ var: "switch" }, baraBand] }] },
    message_sv: `D-${lista(baraBand)} finns bara för bandmontage (B).`,
    message_en: `D-${lista(baraBand, "and")} exist for band mounting (B) only.`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch_mount" }, "B"] }, { in: [{ var: "switch" }, baraSkena] }] },
    message_sv: `D-${lista(baraSkena)} finns bara för skenmontage (A).`,
    message_en: `D-${lista(baraSkena, "and")} exist for rail mounting (A) only.`,
    goto_step: steg("switch"),
  });
  const perBandNot = new Map<string, string[]>();
  const perRailNot = new Map<string, string[]>();
  for (const s of C85_SWITCHES) {
    if (s.band_not.length) perBandNot.set(s.band_not.join(","), [...(perBandNot.get(s.band_not.join(",")) ?? []), s.code]);
    if (s.rail_not.length) perRailNot.set(s.rail_not.join(","), [...(perRailNot.get(s.rail_not.join(",")) ?? []), s.code]);
  }
  for (const [bores, koder] of perBandNot) {
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "switch_mount" }, "B"] }, { in: [{ var: "switch" }, koder] }, { in: [{ var: "bore" }, bores.split(",")] }] },
      message_sv: `D-${koder.join("/")} kan inte monteras med band på ø${lista(bores.split(","))} (sida 6).`,
      message_en: `D-${koder.join("/")} cannot be band-mounted on ø${lista(bores.split(","), "and")} (page 6).`,
      goto_step: steg("switch"),
    });
  }
  for (const [bores, koder] of perRailNot) {
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "switch_mount" }, "A"] }, { in: [{ var: "switch" }, koder] }, { in: [{ var: "bore" }, bores.split(",")] }] },
      message_sv: `D-${koder.join("/")} kan inte monteras på skena på ø${lista(bores.split(","))} (sida 6).`,
      message_en: `D-${koder.join("/")} cannot be rail-mounted on ø${lista(bores.split(","), "and")} (page 6).`,
      goto_step: steg("switch"),
    });
  }
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });

  // ── slaget ─────────────────────────────────────────────────────────────
  const perMax = new Map<number, string[]>();
  for (const b of C85_BORES) perMax.set(b.max_stroke_mm, [...(perMax.get(b.max_stroke_mm) ?? []), b.code]);
  for (const [max, bores] of perMax) {
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, max] }, { "!=": [{ var: "mto" }, "X2018"] }] },
      message_sv: `ø${lista(bores)} går till ${max} mm slag; längre beställs som special -X2018 (sida 7, not 3).`,
      message_en: `ø${lista(bores, "and")} goes up to ${max} mm stroke; longer is a special order -X2018 (page 7, note 3).`,
      goto_step: steg("stroke_mm"),
    });
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<=": [{ var: "stroke_mm" }, max] }, { "==": [{ var: "mto" }, "X2018"] }] },
      message_sv: `-X2018 är för slag över ${max} mm; ø${lista(bores)} har det slaget som standard.`,
      message_en: `-X2018 is for strokes above ${max} mm; ø${lista(bores, "and")} has that stroke as standard.`,
      goto_step: steg("mto"),
    });
  }

  // ── specialutföranden ──────────────────────────────────────────────────
  for (const m of C85_MTO) {
    if (m.rubber_only) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "==": [{ var: "cushion" }, "C"] }] },
        message_sv: `-${m.code} finns bara med gummidämpning, inte luftdämpning (sida 7).`,
        message_en: `-${m.code} is available with rubber bumper only, not air cushion (page 7).`,
        goto_step: steg("mto"),
      });
    }
    if (m.bores) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { in: [{ var: "bore" }, alla.filter((b) => !m.bores!.includes(b))] }] },
        message_sv: `-${m.code} finns för ø${lista(m.bores)} (sida 7).`,
        message_en: `-${m.code} exists for ø${lista(m.bores, "and")} (page 7).`,
        goto_step: steg("mto"),
      });
    }
    if (m.no_accessory) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "!=": [{ var: "accessory" }, ""] }] },
        message_sv: `-${m.code} finns inte tillsammans med tillbehör på kolvstången (sida 7, not 3).`,
        message_en: `-${m.code} is not available together with a rod end accessory (page 7, note 3).`,
        goto_step: steg("mto"),
      });
    }
  }

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of C85_BORES) {
    const kraft = Math.round(Math.PI * (b.bore_mm / 2) ** 2 * 0.5);
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `ø${b.bore_mm}: cirka ${kraft} N plus-sidan vid 0,5 MPa (kolvarea × tryck); minsta tryck ${sv(b.min_pressure_rubber_mpa)} MPa; ` +
        `standardslag ${lista(b.standard_strokes)} mm, andra slag på begäran upp till ${b.max_stroke_mm} mm.`,
      message_en: `ø${b.bore_mm}: about ${kraft} N extending at 0.5 MPa (piston area × pressure); minimum pressure ${b.min_pressure_rubber_mpa} MPa; ` +
        `standard strokes ${lista(b.standard_strokes, "and")} mm, other strokes on request up to ${b.max_stroke_mm} mm.`,
      goto_step: steg("bore"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "switch" }, ""] },
    message_sv: `Med givare är temperaturområdet ${C85_LIMITS.temp_c.with_switch[0]}…${C85_LIMITS.temp_c.with_switch[1]} °C ` +
      `(utan: ${C85_LIMITS.temp_c.without_switch[0]}…${C85_LIMITS.temp_c.without_switch[1]} °C). Givaren levereras löst; bandfästet är förmonterat.`,
    message_en: `With auto switch the temperature range is ${C85_LIMITS.temp_c.with_switch[0]}…${C85_LIMITS.temp_c.with_switch[1]} °C ` +
      `(without: ${C85_LIMITS.temp_c.without_switch[0]}…${C85_LIMITS.temp_c.without_switch[1]} °C). The switch ships loose; the band bracket is pre-assembled.`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "bracket" }, ""] },
    message_sv: "Fästet levereras löst tillsammans med cylindern, inte monterat (sida 6).",
    message_en: "The mounting bracket ships loose together with the cylinder, not assembled (page 6).",
    goto_step: steg("bracket"),
  });

  return rows;
}

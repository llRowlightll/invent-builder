/**
 * MB-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: givaren mot magneten; kabellängden
 * mot givaren; slaget mot borrningens slagområden och mot givarens minsta
 * slag (egen tabell för tappfästet); pivotfästet mot fästet; bälgen mot
 * slaget; specialutförandet mot borrning och dämpning (kombinationstabellen).
 */
import {
  MB_BORES,
  MB_LEADS,
  MB_LEAD_INDEX,
  MB_LIMITS,
  MB_MOUNTINGS,
  MB_MTO,
  MB_SWITCHES,
  mbMinStroke,
  mbMtoMark,
} from "./mb";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type MBDbRule = DsbcDbRule;

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

export function buildMbDbRules(): MBDbRule[] {
  const rows: MBDbRule[] = [];
  const steg = (p: string) => `mb-${p}`;
  const tvaGivare = { and: [{ "!=": [{ var: "switch" }, ""] }, { "!=": [{ var: "count" }, "S"] }] };
  const enGivare = { and: [{ "!=": [{ var: "switch" }, ""] }, { "==": [{ var: "count" }, "S"] }] };

  // ── magneten och givaren ───────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { "!=": [{ var: "magnet" }, "D"] }] },
    message_sv: "En givare kräver magnetcylindern MDB — välj inbyggd magnet (sida 482).",
    message_en: "An auto switch needs the MDB magnet cylinder — choose the built-in magnet (page 482).",
    goto_step: steg("magnet"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  for (const lead of ["", ...MB_LEADS.map((l) => l.code)]) {
    const i = MB_LEAD_INDEX[lead];
    const saknas = MB_SWITCHES.filter((g) => g.leads[i] === "-").map((g) => g.code);
    if (saknas.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, saknas] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} finns inte för D-${saknas.join("/")} (sida 482, —).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} does not exist for D-${saknas.join("/")} (page 482, —).`,
        goto_step: steg("lead"),
      });
    }
    const pa = MB_SWITCHES.filter((g) => g.leads[i] === "O").map((g) => g.code);
    if (pa.length) {
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för D-${pa.join("/")} (sida 482, ○).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for D-${pa.join("/")} (page 482, ○).`,
        goto_step: steg("lead"),
      });
    }
  }

  // ── slaget mot borrningen ──────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { ">": [{ var: "stroke_mm" }, MB_BORES[0].max_mm] },
    message_sv: `MB tillverkas upp till ${MB_BORES[0].max_mm} mm slag (sida 483).`,
    message_en: `MB is manufactured up to ${MB_BORES[0].max_mm} mm stroke (page 483).`,
    goto_step: steg("stroke_mm"),
  });
  const perRange2 = new Map<number, string[]>();
  for (const b of MB_BORES) perRange2.set(b.range2_mm, [...(perRange2.get(b.range2_mm) ?? []), b.code]);
  for (const [max, bores] of perRange2) {
    rows.push({
      severity: "warn",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, max] }] },
      message_sv: `ø${lista(bores)} över ${max} mm slag: rådgör med SMC om tillverkbarhet och artikelnummer (sida 483, not 3).`,
      message_en: `ø${lista(bores, "and")} above ${max} mm stroke: consult SMC for manufacturability and the part number (page 483, note 3).`,
      goto_step: steg("stroke_mm"),
    });
  }
  for (const b of MB_BORES) {
    const maxStd = Math.max(...b.standard);
    rows.push({
      severity: "warn",
      if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { ">": [{ var: "stroke_mm" }, maxStd] }, { "<=": [{ var: "stroke_mm" }, b.range2_mm] }] },
      message_sv: `ø${b.code} över ${maxStd} mm slag (upp till ${b.range2_mm}) kan tappa i prestanda genom nedböjning — kontrollera mot modellvalet (sida 483, not 2).`,
      message_en: `ø${b.code} above ${maxStd} mm stroke (up to ${b.range2_mm}) might not fulfil the specifications due to deflection — check against the model selection (page 483, note 2).`,
      goto_step: steg("stroke_mm"),
    });
    rows.push({
      severity: "info",
      if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<=": [{ var: "stroke_mm" }, maxStd] }, { not: { in: [{ var: "stroke_mm" }, b.standard] } }] },
      message_sv: `Standardslagen för ø${b.code} är ${lista(b.standard)} mm; mellanslag tillverkas utan distanser (sida 483, not 1).`,
      message_en: `The standard strokes for ø${b.code} are ${lista(b.standard, "and")} mm; intermediate strokes are manufactured without spacers (page 483, note 1).`,
      goto_step: steg("stroke_mm"),
    });
  }
  rows.push({
    severity: "warn",
    if_json: { and: [{ in: [{ var: "boot" }, ["J", "K"]] }, { ">": [{ var: "stroke_mm" }, MB_LIMITS.boot_max_stroke_mm] }] },
    message_sv: `Med bälg är slagområdet upp till ${MB_LIMITS.boot_max_stroke_mm} mm — rådgör med SMC däröver (sida 483, not 4).`,
    message_en: `With a rod boot the stroke range is up to ${MB_LIMITS.boot_max_stroke_mm} mm — consult SMC above that (page 483, note 4).`,
    goto_step: steg("boot"),
  });

  // ── minsta slag för givare ─────────────────────────────────────────────
  const utanTapp = MB_MOUNTINGS.filter((m) => !m.trunnion).map((m) => m.code);
  const grupper: Array<{ bores: string[]; namn: string }> = [
    { bores: MB_BORES.filter((b) => b.bore_mm <= 63).map((b) => b.code), namn: "ø32–63" },
    { bores: MB_BORES.filter((b) => b.bore_mm > 63 && b.bore_mm <= 100).map((b) => b.code), namn: "ø80–100" },
    { bores: ["125"], namn: "ø125" },
  ];
  for (const antal of ["en", "tva"] as const) {
    const villkor = antal === "en" ? enGivare : tvaGivare;
    const namnSv = antal === "en" ? "en givare" : "två givare";
    const namnEn = antal === "en" ? "one auto switch" : "two auto switches";
    // utan tappfäste: per borrgrupp och minimivärde
    for (const g of grupper) {
      const b = MB_BORES.find((x) => x.code === g.bores[0])!;
      const perMin = new Map<number, string[]>();
      for (const s of MB_SWITCHES) {
        const v = mbMinStroke(s, b, false)[antal === "en" ? 0 : 1];
        perMin.set(v, [...(perMin.get(v) ?? []), s.code]);
      }
      for (const [min, sw] of perMin) {
        rows.push({
          severity: "error",
          if_json: { and: [villkor, { in: [{ var: "switch" }, sw] }, { in: [{ var: "mounting" }, utanTapp] }, { in: [{ var: "bore" }, g.bores] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, min] }] },
          message_sv: `Minsta slag med ${namnSv} D-${sw.slice(0, 3).join("/")}${sw.length > 3 ? "…" : ""} på ${g.namn} (utom tappfäste) är ${min} mm (sida 518–519).`,
          message_en: `The minimum stroke with ${namnEn} D-${sw.slice(0, 3).join("/")}${sw.length > 3 ? "…" : ""} on ${g.namn} (except centre trunnion) is ${min} mm (pages 518–519).`,
          goto_step: steg("stroke_mm"),
        });
      }
    }
    // tappfästet: per borrning
    for (const b of MB_BORES) {
      const perMin = new Map<number, string[]>();
      for (const s of MB_SWITCHES) {
        const v = mbMinStroke(s, b, true)[antal === "en" ? 0 : 1];
        perMin.set(v, [...(perMin.get(v) ?? []), s.code]);
      }
      for (const [min, sw] of perMin) {
        rows.push({
          severity: "error",
          if_json: { and: [villkor, { in: [{ var: "switch" }, sw] }, { "==": [{ var: "mounting" }, "T"] }, { "==": [{ var: "bore" }, b.code] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, min] }] },
          message_sv: `Minsta slag med ${namnSv} D-${sw.slice(0, 3).join("/")}${sw.length > 3 ? "…" : ""} och tappfäste T på ø${b.code} är ${min} mm (sida 519–520).`,
          message_en: `The minimum stroke with ${namnEn} D-${sw.slice(0, 3).join("/")}${sw.length > 3 ? "…" : ""} and centre trunnion T on ø${b.code} is ${min} mm (pages 519–520).`,
          goto_step: steg("stroke_mm"),
        });
      }
    }
  }
  for (const s of MB_SWITCHES.filter((x) => x.min_same_side)) {
    rows.push({
      severity: "warn",
      if_json: { and: [tvaGivare, { "==": [{ var: "switch" }, s.code] }, { in: [{ var: "mounting" }, utanTapp] }, { ">=": [{ var: "stroke_mm" }, s.min[0][1]] }, { "<": [{ var: "stroke_mm" }, s.min_same_side!] }] },
      message_sv: `Två D-${s.code} på samma sida kräver ${s.min_same_side} mm slag; under det monteras de på olika sidor (sida 518).`,
      message_en: `Two D-${s.code} on the same surface need ${s.min_same_side} mm stroke; below that they are mounted on different surfaces (page 518).`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── pivotfästet ────────────────────────────────────────────────────────
  const utanPivot = MB_MOUNTINGS.filter((m) => !m.pivot).map((m) => m.code);
  const medPivot = MB_MOUNTINGS.filter((m) => m.pivot).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "pivot" }, "N"] }, { in: [{ var: "mounting" }, utanPivot] }] },
    message_sv: `Pivotfästet N finns bara för fästena ${lista(medPivot)} (sida 482).`,
    message_en: `The pivot bracket N exists only for the mountings ${lista(medPivot, "and")} (page 482).`,
    goto_step: steg("pivot"),
  });

  // ── specialutföranden mot kombinationstabellen ────────────────────────
  for (const x of MB_MTO) {
    for (const rubber of [false, true]) {
      const fel = MB_BORES.filter((b) => mbMtoMark(x, b, rubber) === "-").map((b) => b.code);
      const special = MB_BORES.filter((b) => mbMtoMark(x, b, rubber) === "S").map((b) => b.code);
      const damp = rubber ? { "==": [{ var: "cushion" }, "N"] } : { "==": [{ var: "cushion" }, ""] };
      const dampSv = rubber ? "gummibuffert" : "luftdämpning";
      const dampEn = rubber ? "rubber bumper" : "air cushion";
      if (fel.length) {
        rows.push({
          severity: "error",
          if_json: { and: [{ "==": [{ var: "mto" }, x.code] }, damp, { in: [{ var: "bore" }, fel] }] },
          message_sv: `-${x.code} finns inte för ø${lista(fel)} med ${dampSv} (sida 480).`,
          message_en: `-${x.code} is not available for ø${lista(fel, "and")} with ${dampEn} (page 480).`,
          goto_step: steg("mto"),
        });
      }
      if (special.length) {
        rows.push({
          severity: "warn",
          if_json: { and: [{ "==": [{ var: "mto" }, x.code] }, damp, { in: [{ var: "bore" }, special] }] },
          message_sv: `-${x.code} för ø${lista(special)} med ${dampSv} är specialprodukt (○), inte listat specialutförande (sida 480).`,
          message_en: `-${x.code} for ø${lista(special, "and")} with ${dampEn} is a special product (○), not a listed made-to-order option (page 480).`,
          goto_step: steg("mto"),
        });
      }
    }
  }

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of MB_BORES) {
    const kraft = Math.round(Math.PI / 4 * b.bore_mm * b.bore_mm * 0.5);
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `ø${b.code}: cirka ${kraft} N plus-sidan vid 0,5 MPa (kolvarea × tryck); port ${b.port}; standardslag ${lista(b.standard)} mm, upp till ${b.range2_mm} mm i standardformat; gummibuffert gör cylindern ${b.bumper_add_mm} mm längre (sida 482–483).`,
      message_en: `ø${b.code}: about ${kraft} N extending at 0.5 MPa (piston area × pressure); port ${b.port}; standard strokes ${lista(b.standard, "and")} mm, up to ${b.range2_mm} mm in the standard format; the rubber bumper makes the cylinder ${b.bumper_add_mm} mm longer (pages 482–483).`,
      goto_step: steg("bore"),
    });
  }
  const L = MB_LIMITS;
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "mounting" }, ""] },
    message_sv: `MB: ${sv(L.min_pressure_mpa)}–${sv(L.max_pressure_mpa)} MPa, ${L.temp_c[0]}…${L.temp_c[1]} °C (med givare ${L.temp_switch_c[0]}…${L.temp_switch_c[1]}), ${L.speed_mm_s[0]}–${L.speed_mm_s[1]} mm/s, smörjfri; tappfästet monteras vid leverans, övriga fästen medföljer lösa för ø32–100 och monterade för ø125 (sida 482–483).`,
    message_en: `MB: ${L.min_pressure_mpa}–${L.max_pressure_mpa} MPa, ${L.temp_c[0]}…${L.temp_c[1]} °C (with auto switch ${L.temp_switch_c[0]}…${L.temp_switch_c[1]}), ${L.speed_mm_s[0]}–${L.speed_mm_s[1]} mm/s, non-lube; the trunnion is mounted before shipment, other brackets are shipped loose for ø32–100 and assembled for ø125 (pages 482–483).`,
    goto_step: steg("mounting"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "knuckle" }, ["V", "W"]] },
    message_sv: "Knäleden medföljer omonterad; den enkla knäleden V levereras utan sprint (sida 482).",
    message_en: "The knuckle joint is shipped together with the product but not assembled; the single knuckle joint V comes without a pin (page 482).",
    goto_step: steg("knuckle"),
  });
  return rows;
}

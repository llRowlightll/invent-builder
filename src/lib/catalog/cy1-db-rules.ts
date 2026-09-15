/**
 * CY1-reglerna som skrivs till config_rules, byggda ur modellen — en
 * uppsättning per serie (CY1S, CY1L, CY1H, CY1F).
 *
 * Det som beror på två val samtidigt: gängvalet mot borrning; hållkraft L
 * mot borrning (CY1L); styrningen T mot borrning (CY1H); slaget mot
 * borrning, styrning och standardtabellen (mellanslag på beställning eller
 * med -XB10/-XB11); givarantalet mot slaget; kabellängden mot givaren;
 * specialutförandet mot borrning, justering och anslutning.
 */
import {
  CY1_COUNTS,
  CY1_PORTS,
  CY1_SERIES,
  type CY1Bore,
  type CY1Series,
  type CY1SeriesDef,
  cy1Strokes,
} from "./cy1";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type CY1DbRule = DsbcDbRule;

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

/** Grupperar borrningar per värde så att en regel täcker alla med samma gräns. */
function perVarde<T>(bores: CY1Bore[], f: (b: CY1Bore) => T | null): Map<T, string[]> {
  const m = new Map<T, string[]>();
  for (const b of bores) {
    const v = f(b);
    if (v === null) continue;
    m.set(v, [...(m.get(v) ?? []), b.code]);
  }
  return m;
}

export function buildCy1DbRules(series: CY1Series): CY1DbRule[] {
  const s: CY1SeriesDef = CY1_SERIES[series];
  const rows: CY1DbRule[] = [];
  const steg = (p: string) => `${s.slug}-${p}`;
  const nyckel = s.source.key_page;
  const data = s.source.spec_page;
  const NAMN = s.prefix;
  const tvaGivare = { and: [{ "!=": [{ var: "switch" }, ""] }, { "!=": [{ var: "count" }, "S"] }] };

  // ── gängvalet ──────────────────────────────────────────────────────────
  const utanGanga = s.bores.filter((b) => !s.port_bores.includes(b.code)).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "port" }, CY1_PORTS.map((p) => p.code)] }, { in: [{ var: "bore" }, utanGanga] }] },
    message_sv: `Gängvalet TN/TF finns för ø${lista(s.port_bores)}; ø${lista(utanGanga)} har M-gänga (sida ${nyckel}).`,
    message_en: `The thread choice TN/TF exists for ø${lista(s.port_bores, "and")}; ø${lista(utanGanga, "and")} has an M thread (page ${nyckel}).`,
    goto_step: steg("port"),
  });

  // ── serieegna positioner ───────────────────────────────────────────────
  if (s.holding) {
    const utanL = s.bores.filter((b) => !b.holding_l_n).map((b) => b.code);
    const medL = s.bores.filter((b) => b.holding_l_n).map((b) => b.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "holding" }, "L"] }, { in: [{ var: "bore" }, utanL] }] },
      message_sv: `Låg hållkraft L finns för ø${lista(medL)}, inte ø${lista(utanL)} — välj H (sida ${data}).`,
      message_en: `The low holding force L exists for ø${lista(medL, "and")}, not ø${lista(utanL, "and")} — choose H (page ${data}).`,
      goto_step: steg("holding"),
    });
  }
  if (s.guide) {
    const bara2 = s.bores.filter((b) => !b.one_axis).map((b) => b.code);
    const bara1 = s.bores.filter((b) => !b.two_axis).map((b) => b.code);
    const med2 = s.bores.filter((b) => b.two_axis).map((b) => b.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "guide" }, "T"] }, { in: [{ var: "bore" }, bara1] }] },
      message_sv: `Tvåaxlig styrning T finns för ø${lista(med2)}, inte ø${lista(bara1)} (sida ${nyckel}).`,
      message_en: `The two-axis guide T exists for ø${lista(med2, "and")}, not ø${lista(bara1, "and")} (page ${nyckel}).`,
      goto_step: steg("guide"),
    });
    rows.push({
      severity: "error",
      if_json: { and: [{ "!=": [{ var: "guide" }, "T"] }, { in: [{ var: "bore" }, bara2] }] },
      message_sv: `ø${lista(bara2)} finns bara tvåaxlig — välj styrningen T (sida ${nyckel}).`,
      message_en: `ø${lista(bara2, "and")} exists only with two axes — choose the guide T (page ${nyckel}).`,
      goto_step: steg("guide"),
    });
  }

  // ── slaget: minsta, största, standardtabellen ─────────────────────────
  if (s.min_stroke_mm > 1) {
    rows.push({
      severity: "error",
      if_json: { and: [{ ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, s.min_stroke_mm] }] },
      message_sv: `Minsta slag är ${s.min_stroke_mm} mm (sida ${data}, not 2).`,
      message_en: `The minimum stroke is ${s.min_stroke_mm} mm (page ${data}, note 2).`,
      goto_step: steg("stroke_mm"),
    });
  }
  type Grupp = { guide: string; bores: CY1Bore[]; villkor: unknown[] };
  const grupper: Grupp[] = s.guide
    ? [
      { guide: "", bores: s.bores.filter((b) => b.one_axis), villkor: [{ "!=": [{ var: "guide" }, "T"] }] },
      { guide: "T", bores: s.bores.filter((b) => b.two_axis), villkor: [{ "==": [{ var: "guide" }, "T"] }] },
    ]
    : [{ guide: "", bores: s.bores, villkor: [] }];
  for (const g of grupper) {
    const styrning = s.guide ? (g.guide === "T" ? " med styrningen T" : " med enaxlig styrning") : "";
    const styrningEn = s.guide ? (g.guide === "T" ? " with the guide T" : " with the single-axis guide") : "";
    const perMax = perVarde(g.bores, (b) => cy1Strokes(series, b, g.guide)?.max_mm ?? null);
    for (const [max, bores] of perMax) {
      rows.push({
        severity: "error",
        if_json: { and: [...g.villkor, { in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, max] }] },
        message_sv: `${NAMN} ø${lista(bores)}${styrning} tillverkas upp till ${max} mm slag (sida ${data}).`,
        message_en: `${NAMN} ø${lista(bores, "and")}${styrningEn} is manufactured up to ${max} mm stroke (page ${data}).`,
        goto_step: steg("stroke_mm"),
      });
    }
    for (const b of g.bores) {
      const slag = cy1Strokes(series, b, g.guide)!;
      const maxStd = Math.max(...slag.standard);
      const inteStandard = { not: { in: [{ var: "stroke_mm" }, slag.standard] } };
      const bas = [...g.villkor, { "==": [{ var: "bore" }, b.code] }, { ">": [{ var: "stroke_mm" }, 0] }];
      if (s.stroke_policy === "warn") {
        rows.push({
          severity: "warn",
          if_json: { and: [...bas, { "<=": [{ var: "stroke_mm" }, slag.max_mm] }, inteStandard] },
          message_sv: `Standardslagen för ø${b.code} är ${lista(slag.standard)} mm; mellanslag i 1 mm-steg tillverkas på beställning (sida ${data}, not 1).`,
          message_en: `The standard strokes for ø${b.code} are ${lista(slag.standard, "and")} mm; intermediate strokes in 1 mm steps are produced upon receipt of order (page ${data}, note 1).`,
          goto_step: steg("stroke_mm"),
        });
      } else {
        rows.push({
          severity: "error",
          if_json: { and: [...bas, { "<=": [{ var: "stroke_mm" }, maxStd] }, inteStandard, { "!=": [{ var: "mto" }, "XB10"] }] },
          message_sv: `Standardslagen för ø${b.code}${styrning} är ${lista(slag.standard)} mm; ett mellanslag beställs med -XB10 (sida ${data}).`,
          message_en: `The standard strokes for ø${b.code}${styrningEn} are ${lista(slag.standard, "and")} mm; an intermediate stroke is ordered with -XB10 (page ${data}).`,
          goto_step: steg("mto"),
        });
        rows.push({
          severity: "error",
          if_json: { and: [...bas, { ">": [{ var: "stroke_mm" }, maxStd] }, { "<=": [{ var: "stroke_mm" }, slag.max_mm] }, { "!=": [{ var: "mto" }, "XB11"] }] },
          message_sv: `Slag över ${maxStd} mm för ø${b.code}${styrning} (upp till ${slag.max_mm}) beställs med -XB11 (sida ${data}).`,
          message_en: `Strokes above ${maxStd} mm for ø${b.code}${styrningEn} (up to ${slag.max_mm}) are ordered with -XB11 (page ${data}).`,
          goto_step: steg("mto"),
        });
        rows.push({
          severity: "error",
          if_json: { and: [...bas, { "==": [{ var: "mto" }, "XB10"] }, { or: [{ in: [{ var: "stroke_mm" }, slag.standard] }, { ">": [{ var: "stroke_mm" }, maxStd] }] }] },
          message_sv: `-XB10 är mellanslag inom standardområdet för ø${b.code}${styrning} (under ${maxStd} mm, inte ett standardslag) (sida ${data}).`,
          message_en: `-XB10 is an intermediate stroke within the standard range for ø${b.code}${styrningEn} (below ${maxStd} mm, not a standard stroke) (page ${data}).`,
          goto_step: steg("mto"),
        });
        rows.push({
          severity: "error",
          if_json: { and: [...bas, { "==": [{ var: "mto" }, "XB11"] }, { "<=": [{ var: "stroke_mm" }, maxStd] }] },
          message_sv: `-XB11 är långt slag över ${maxStd} mm för ø${b.code}${styrning} (sida ${data}).`,
          message_en: `-XB11 is a long stroke above ${maxStd} mm for ø${b.code}${styrningEn} (page ${data}).`,
          goto_step: steg("mto"),
        });
      }
    }
  }

  // ── givare: antal mot slag, kabellängd mot givare ─────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  if (series === "cy1f") {
    const perEn = new Map<number, string[]>();
    const perTva = new Map<string, { p3: number; p12: number; sw: string[] }>();
    for (const g of s.switches) {
      if (g.min_one_mm) perEn.set(g.min_one_mm, [...(perEn.get(g.min_one_mm) ?? []), g.code]);
      if (g.min_two_mm) {
        const k = g.min_two_mm.join("/");
        const e = perTva.get(k) ?? { p3: g.min_two_mm[0], p12: g.min_two_mm[1], sw: [] };
        e.sw.push(g.code);
        perTva.set(k, e);
      }
    }
    for (const [min, sw] of perEn) {
      rows.push({
        severity: "error",
        if_json: { and: [{ in: [{ var: "switch" }, sw] }, { "==": [{ var: "count" }, "S"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, min] }] },
        message_sv: `Minsta slag med en givare D-${sw.slice(0, 3).join("/")}… är ${min} mm (sida ${s.source.mounting_page}).`,
        message_en: `The minimum stroke with one auto switch D-${sw.slice(0, 3).join("/")}… is ${min} mm (page ${s.source.mounting_page}).`,
        goto_step: steg("stroke_mm"),
      });
    }
    for (const e of perTva.values()) {
      rows.push({
        severity: "error",
        if_json: { and: [{ in: [{ var: "switch" }, e.sw] }, { "!=": [{ var: "count" }, "S"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, e.p3] }] },
        message_sv: `Minsta slag med två givare D-${e.sw.slice(0, 3).join("/")}… är ${e.p3} mm (monteringsmönster 3, sida ${s.source.mounting_page}).`,
        message_en: `The minimum stroke with two auto switches D-${e.sw.slice(0, 3).join("/")}… is ${e.p3} mm (mounting pattern 3, page ${s.source.mounting_page}).`,
        goto_step: steg("stroke_mm"),
      });
      rows.push({
        severity: "warn",
        if_json: { and: [{ in: [{ var: "switch" }, e.sw] }, { "!=": [{ var: "count" }, "S"] }, { ">=": [{ var: "stroke_mm" }, e.p3] }, { "<": [{ var: "stroke_mm" }, e.p12] }] },
        message_sv: `Två givare D-${e.sw.slice(0, 3).join("/")}… under ${e.p12} mm slag kräver monteringsmönster 3 (sida ${s.source.mounting_page}).`,
        message_en: `Two auto switches D-${e.sw.slice(0, 3).join("/")}… below ${e.p12} mm stroke need mounting pattern 3 (page ${s.source.mounting_page}).`,
        goto_step: steg("stroke_mm"),
      });
    }
  } else if (series === "cy1s") {
    rows.push({
      severity: "error",
      if_json: { and: [tvaGivare, { "!=": [{ var: "mto" }, "X431"] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, s.min_two_switches_mm] }] },
      message_sv: `Minsta slag med två givare är ${s.min_two_switches_mm} mm; under det (minst ${s.min_stroke_mm}) krävs -X431 med två givarskenor (sida ${data}, not 3).`,
      message_en: `The minimum stroke with two auto switches is ${s.min_two_switches_mm} mm; below that (at least ${s.min_stroke_mm}) -X431 with two switch rails is needed (page ${data}, note 3).`,
      goto_step: steg("mto"),
    });
    rows.push({
      severity: "warn",
      if_json: { and: [tvaGivare, { ">=": [{ var: "stroke_mm" }, s.min_two_switches_mm] }, { "<": [{ var: "stroke_mm" }, 50] }] },
      message_sv: `Två givare i rad kräver 50 mm slag; under 50 mm monteras de med skruvarna mot varandra (sida ${s.source.mounting_page}, not 1).`,
      message_en: `Two in-line auto switches need 50 mm stroke; below 50 mm they are mounted with the screws facing each other (page ${s.source.mounting_page}, note 1).`,
      goto_step: steg("stroke_mm"),
    });
  } else {
    rows.push({
      severity: "error",
      if_json: { and: [tvaGivare, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, s.min_two_switches_mm] }] },
      message_sv: `Minsta slag med två givare är ${s.min_two_switches_mm} mm (sida ${s.source.mounting_page}).`,
      message_en: `The minimum stroke with two auto switches is ${s.min_two_switches_mm} mm (page ${s.source.mounting_page}).`,
      goto_step: steg("stroke_mm"),
    });
  }
  for (const lead of ["", ...s.leads.map((l) => l.code)]) {
    const i = s.lead_index[lead];
    const saknas = s.switches.filter((g) => g.leads[i] === "-").map((g) => g.code);
    if (saknas.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, saknas] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} finns inte för D-${saknas.join("/")} (sida ${nyckel}, —).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} does not exist for D-${saknas.join("/")} (page ${nyckel}, —).`,
        goto_step: steg("lead"),
      });
    }
    const pa = s.switches.filter((g) => g.leads[i] === "O").map((g) => g.code);
    if (pa.length) {
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för D-${pa.join("/")} (sida ${nyckel}, ○).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for D-${pa.join("/")} (page ${nyckel}, ○).`,
        goto_step: steg("lead"),
      });
    }
  }

  // ── specialutföranden ──────────────────────────────────────────────────
  for (const m of s.mto) {
    if (m.bores) {
      const utan = s.bores.filter((b) => !m.bores!.includes(b.code)).map((b) => b.code);
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { in: [{ var: "bore" }, utan] }] },
        message_sv: `-${m.code} finns för ø${lista(m.bores)}, inte ø${lista(utan)} (sida ${s.source.mto_page}).`,
        message_en: `-${m.code} exists for ø${lista(m.bores, "and")}, not ø${lista(utan, "and")} (page ${s.source.mto_page}).`,
        goto_step: steg("mto"),
      });
    }
    if (m.needs_absorber) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "==": [{ var: "adjust" }, ""] }] },
        message_sv: `-${m.code} byter stötdämparna till RJ-serien — välj B eller BS (sida ${nyckel}).`,
        message_en: `-${m.code} replaces the shock absorbers with the RJ series — choose B or BS (page ${nyckel}).`,
        goto_step: steg("adjust"),
      });
    }
    if (m.not_centralized) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "==": [{ var: "piping" }, "G"] }] },
        message_sv: `-${m.code} finns bara med dubbelsidig anslutning, inte centraliserad G (sida ${s.source.mto_page}, not 1).`,
        message_en: `-${m.code} exists only with bilateral piping, not centralized G (page ${s.source.mto_page}, note 1).`,
        goto_step: steg("piping"),
      });
    }
  }

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of s.bores) {
    const slag = cy1Strokes(series, b, s.guide && !b.one_axis ? "T" : "");
    const delar = [`ø${b.code}: magnetisk hållkraft ${sv(b.holding_n)} N`];
    const delarEn = [`ø${b.code}: magnetic holding force ${b.holding_n} N`];
    if (b.holding_l_n) {
      delar[0] += ` (H), ${sv(b.holding_l_n)} N (L)`;
      delarEn[0] += ` (H), ${b.holding_l_n} N (L)`;
    }
    if (slag) {
      delar.push(`standardslag ${lista(slag.standard)} mm, upp till ${slag.max_mm} mm`);
      delarEn.push(`standard strokes ${lista(slag.standard, "and")} mm, up to ${slag.max_mm} mm`);
    }
    if (b.two_axis && b.one_axis) {
      delar.push(`med T: standardslag ${lista(b.two_axis.standard)} mm, upp till ${b.two_axis.max_mm} mm`);
      delarEn.push(`with T: standard strokes ${lista(b.two_axis.standard, "and")} mm, up to ${b.two_axis.max_mm} mm`);
    }
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `${delar.join("; ")} (sida ${data}).`,
      message_en: `${delarEn.join("; ")} (page ${data}).`,
      goto_step: steg("bore"),
    });
  }
  const [pmin, pmax] = s.limits.pressure_mpa;
  const [tmin, tmax] = s.limits.temp_c;
  const [vmin, vmax] = s.limits.speed_mm_s;
  const serieRad: Record<CY1Series, [string, string]> = {
    cy1s: ["givarskena och givarmagnet ingår som standard; gummibuffertar i båda ändar om inget ändstopp väljs", "auto switch rail and magnet included as standard; rubber bumpers both ends unless a stopper type is chosen"],
    cy1l: ["justerbult och givarskena ingår som standard", "adjusting bolt and auto switch rail included as standard"],
    cy1h: ["justerbulten ingår även med B eller BS (utom ø10); centraliserad anslutning", "the adjusting bolt is included even with B or BS (except ø10); centralized piping"],
    cy1f: ["inbyggda stötdämpare; anslutningarna samlade på en sida", "built-in shock absorbers; piping concentrated on one side"],
  };
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "bore" }, ""] },
    message_sv: `${NAMN}: ${sv(pmin)}–${sv(pmax)} MPa, ${tmin}…${tmax} °C, ${vmin}–${vmax} mm/s, smörjfri; ${serieRad[series][0]} (sida ${data}).`,
    message_en: `${NAMN}: ${pmin}–${pmax} MPa, ${tmin}…${tmax} °C, ${vmin}–${vmax} mm/s, non-lube; ${serieRad[series][1]} (page ${data}).`,
    goto_step: steg("bore"),
  });
  const count = CY1_COUNTS.map((c) => c.code);
  rows.push({
    severity: "info",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { not: { in: [{ var: "count" }, count] } }] },
    message_sv: `Utan antal levereras två givare; givarna skickas med men monteras inte (sida ${nyckel}).`,
    message_en: `Without a quantity two auto switches are supplied; they are shipped together but not assembled (page ${nyckel}).`,
    goto_step: steg("count"),
  });
  return rows;
}

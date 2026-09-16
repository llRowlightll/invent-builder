/**
 * RQ-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: slaget mot borrningens områden och
 * mot gummibufferten C (långslagstypen); fästet mot typ och borrning;
 * gängan mot borrningen; givaren mot magneten, kabellängden och ø20;
 * specialutförandet mot typ och borrning.
 */
import { RQ_BORES, RQ_BUMPER, RQ_LEADS, RQ_LEAD_INDEX, RQ_LIMITS, RQ_MOUNTINGS, RQ_MTO, RQ_ROD_END, RQ_SWITCHES, RQ_THREADS, rqLongMax, rqStandardMax } from "./rq";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type RQDbRule = DsbcDbRule;

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
const basnamn = (koder: string[]) => [...new Set(koder.map((k) => k.replace(/^(M9[NPB][WA]?|A9[0-9])V$/, "$1")))].join("/");

export function buildRqDbRules(): RQDbRule[] {
  const rows: RQDbRule[] = [];
  const steg = (p: string) => `rq-${p}`;
  const medSlag = { ">": [{ var: "stroke_mm" }, 0] };

  // ── slaget mot borrningen och bufferten C ──────────────────────────────
  const grupper = new Map<string, string[]>();
  for (const b of RQ_BORES) {
    const k = `${b.standard[0]}|${rqStandardMax(b)}|${rqLongMax(b)}|${b.standard.join(",")}|${b.long.join(",")}`;
    grupper.set(k, [...(grupper.get(k) ?? []), b.code]);
  }
  for (const [k, bores] of grupper) {
    const b = RQ_BORES.find((x) => x.code === bores[0])!;
    const min = b.standard[0];
    const stdMax = rqStandardMax(b);
    const longMax = rqLongMax(b);
    void k;
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, medSlag, { or: [{ "<": [{ var: "stroke_mm" }, min] }, { ">": [{ var: "stroke_mm" }, longMax] }] }] },
      message_sv: `ø${lista(bores)} tillverkas med ${min}–${stdMax} mm slag (standardtyp) och ${stdMax + 1}–${longMax} mm (långslagstyp med gummibuffert C) (sida 1040 och 1053-3).`,
      message_en: `ø${lista(bores, "and")} are manufactured with ${min}–${stdMax} mm stroke (standard type) and ${stdMax + 1}–${longMax} mm (long stroke type with rubber bumper C) (pages 1040 and 1053-3).`,
      goto_step: steg("stroke_mm"),
    });
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, { "==": [{ var: "bumper" }, RQ_BUMPER.code] }, medSlag, { "<=": [{ var: "stroke_mm" }, stdMax] }] },
      message_sv: `Gummibufferten C hör till långslagstypen — för ø${lista(bores)} börjar den vid ${stdMax + 1} mm; upp till ${stdMax} mm är cylindern standardtyp utan C (sida 1039 och 1053-2).`,
      message_en: `The rubber bumper C belongs to the long stroke type — for ø${lista(bores, "and")} it starts at ${stdMax + 1} mm; up to ${stdMax} mm the cylinder is the standard type without C (pages 1039 and 1053-2).`,
      goto_step: steg("bumper"),
    });
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, { "!=": [{ var: "bumper" }, RQ_BUMPER.code] }, { ">": [{ var: "stroke_mm" }, stdMax] }, { "<=": [{ var: "stroke_mm" }, longMax] }] },
      message_sv: `Över ${stdMax} mm slag är ø${lista(bores)} långslagstypen, som beställs med gummibuffert C (sida 1053-2).`,
      message_en: `Above ${stdMax} mm stroke ø${lista(bores, "and")} are the long stroke type, ordered with the rubber bumper C (page 1053-2).`,
      goto_step: steg("bumper"),
    });
    const alla = [...b.standard, ...b.long];
    rows.push({
      severity: "warn",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, { ">=": [{ var: "stroke_mm" }, min] }, { "<=": [{ var: "stroke_mm" }, longMax] }, { not: { in: [{ var: "stroke_mm" }, alla] } }] },
      message_sv: `Standardslagen för ø${lista(bores)} är ${lista(b.standard)} mm (standardtyp) och ${lista(b.long)} mm (långslagstyp); andra slag tillverkas i 1 mm-steg med egen tub för det slaget (sida 1040 och 1053-3).`,
      message_en: `The standard strokes for ø${lista(bores, "and")} are ${lista(b.standard, "and")} mm (standard type) and ${lista(b.long, "and")} mm (long stroke type); other strokes are made in 1 mm steps with an exclusive body for that stroke (pages 1040 and 1053-3).`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── fästet ─────────────────────────────────────────────────────────────
  const inteLang = RQ_MOUNTINGS.filter((m) => !m.long).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mounting" }, inteLang] }, { "==": [{ var: "bumper" }, RQ_BUMPER.code] }] },
    message_sv: "Långslagstypen (C) beställs med genomgående hål som A, inte B (sida 1053-2).",
    message_en: "The long stroke type (C) is ordered with the through-hole as A, not B (page 1053-2).",
    goto_step: steg("mounting"),
  });
  const utanA = RQ_BORES.filter((b) => !b.tapped_ok).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mounting" }, "A"] }, { "!=": [{ var: "bumper" }, RQ_BUMPER.code] }, { in: [{ var: "bore" }, utanA] }] },
    message_sv: `ø${lista(utanA)} har samma kropp för genomgående hål (B) och gängade ändar — beställ B; RQA20-30 finns inte (sida 1039, not 2).`,
    message_en: `ø${lista(utanA, "and")} share one body for the through-hole (B) and the tapped ends — order B; RQA20-30 does not exist (page 1039, note 2).`,
    goto_step: steg("mounting"),
  });
  const utanGanga = RQ_BORES.filter((b) => b.thread !== "Rc").map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "thread" }, RQ_THREADS.map((t) => t.code)] }, { in: [{ var: "bore" }, utanGanga] }] },
    message_sv: `ø${lista(utanGanga)} har M-gänga; NPT (TN) och G (TF) finns för ø32–100 (sida 1039).`,
    message_en: `ø${lista(utanGanga, "and")} have the M thread; NPT (TN) and G (TF) exist for ø32–100 (page 1039).`,
    goto_step: steg("thread"),
  });

  // ── givaren ────────────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { "!=": [{ var: "magnet" }, "D"] }] },
    message_sv: "En givare kräver magnetcylindern RDQ — välj inbyggd magnet (sida 1039).",
    message_en: "An auto switch needs the RDQ magnet cylinder — choose the built-in magnet (page 1039).",
    goto_step: steg("magnet"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  const inte20 = RQ_SWITCHES.filter((g) => g.not_20).map((g) => g.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "switch" }, inte20] }, { "==": [{ var: "bore" }, "20"] }] },
    message_sv: `D-${inte20.join("/")} passar ø25–100, inte ø20 (sida 1039, ∗∗).`,
    message_en: `D-${inte20.join("/")} fits ø25–100, not ø20 (page 1039, ∗∗).`,
    goto_step: steg("switch"),
  });
  for (const lead of ["", ...RQ_LEADS.map((l) => l.code)]) {
    const i = RQ_LEAD_INDEX[lead];
    const saknas = RQ_SWITCHES.filter((g) => g.leads[i] === "-").map((g) => g.code);
    if (saknas.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, saknas] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} finns inte för D-${lead === "M" && saknas.includes("A93V") ? saknas.filter((k) => k !== "A93V").map((k) => k.replace(/V$/, "")).filter((k, j, a) => a.indexOf(k) === j).join("/") + "/A93V" : basnamn(saknas)} (sida 1039, —${lead === "M" ? "; 1 m bara för D-A93, ∗2" : ""}).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} does not exist for D-${lead === "M" && saknas.includes("A93V") ? saknas.filter((k) => k !== "A93V").map((k) => k.replace(/V$/, "")).filter((k, j, a) => a.indexOf(k) === j).join("/") + "/A93V" : basnamn(saknas)} (page 1039, —${lead === "M" ? "; 1 m only for D-A93, ∗2" : ""}).`,
        goto_step: steg("lead"),
      });
    }
    const pa = RQ_SWITCHES.filter((g) => g.leads[i] === "O").map((g) => g.code);
    if (pa.length) {
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för D-${basnamn(pa)}${pa.some((k) => k.endsWith("V")) ? " (även V-typerna)" : ""} (sida 1039, ○).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for D-${basnamn(pa)}${pa.some((k) => k.endsWith("V")) ? " (V types too)" : ""} (page 1039, ○).`,
        goto_step: steg("lead"),
      });
    }
  }
  const vatten = RQ_SWITCHES.filter((g) => g.water_resistant).map((g) => g.code);
  rows.push({
    severity: "warn",
    if_json: { in: [{ var: "switch" }, vatten] },
    message_sv: `De vattentäta givarna D-${basnamn(vatten)} går att montera, men SMC garanterar inte vattentätheten på RQ (sida 1039, ∗1).`,
    message_en: `The water-resistant switches D-${basnamn(vatten)} can be mounted, but SMC cannot guarantee water resistance on the RQ (page 1039, ∗1).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { in: [{ var: "mounting" }, RQ_MOUNTINGS.filter((m) => m.bracket).map((m) => m.code)] }] },
    message_sv: "Med fot- eller flänsfäste kan givarna ibland inte eftermonteras — beställ dem med cylindern (sida 1039).",
    message_en: "With foot or flange brackets the auto switches sometimes cannot be retrofitted — order them with the cylinder (page 1039).",
    goto_step: steg("switch"),
  });

  // ── specialutföranden ──────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "mto" }, ""] }, { "==": [{ var: "bumper" }, RQ_BUMPER.code] }] },
    message_sv: "Specialutförandena -XA/-XC4/-XC35 gäller standardtypen; långslagsnyckeln har ingen specialposition (sida 1039 och 1053-2).",
    message_en: "The made-to-order -XA/-XC4/-XC35 apply to the standard type; the long stroke key has no made-to-order position (pages 1039 and 1053-2).",
    goto_step: steg("mto"),
  });
  const storaBara = RQ_MTO.filter((x) => x.large_only).map((x) => x.code);
  const utanStora = RQ_BORES.filter((b) => !b.xc35_ok).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, storaBara] }, { in: [{ var: "bore" }, utanStora] }] },
    message_sv: `-${storaBara.join("/-")} finns för ø32–100, inte ø${lista(utanStora)} (sida 1040).`,
    message_en: `-${storaBara.join("/-")} exists for ø32–100, not ø${lista(utanStora, "and")} (page 1040).`,
    goto_step: steg("mto"),
  });

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of RQ_BORES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `ø${b.code}: teoretisk kraft ${b.force_out_n} N ut/${b.force_in_n} N in vid 0,5 MPa, effektiv dämpningslängd ${sv(b.cushion_mm)} mm, port ${b.port}; standardslag ${lista(b.standard)} mm, långslag ${lista(b.long)} mm; fästen ${b.thread === "M" ? "CQS" : "CQ"}-L/LC/F/D0${b.code.padStart(2, "0")} (sida 1040, 1053-3 och måttabellen).`,
      message_en: `ø${b.code}: theoretical output ${b.force_out_n} N out/${b.force_in_n} N in at 0.5 MPa, effective cushion length ${b.cushion_mm} mm, port ${b.port.replace(",", ".")}; standard strokes ${lista(b.standard, "and")} mm, long strokes ${lista(b.long, "and")} mm; brackets ${b.thread === "M" ? "CQS" : "CQ"}-L/LC/F/D0${b.code.padStart(2, "0")} (pages 1040, 1053-3 and the dimension table).`,
      goto_step: steg("bore"),
    });
  }
  const L = RQ_LIMITS;
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "mounting" }, ""] },
    message_sv: `RQ: ${sv(L.min_pressure_mpa)}–${sv(L.max_pressure_mpa)} MPa (provtryck ${sv(L.proof_pressure_mpa)} MPa), ${L.temp_c[0]}…${L.temp_c[1]} °C (med magnet ${L.temp_magnet_c[0]}…${L.temp_magnet_c[1]}), ${L.speed_mm_s[0]}–${L.speed_mm_s[1]} mm/s, smörjfri, luftdämpning utan dämpring; fästena medföljer omonterade (sida 1039–1040). Kontrollera tillåten rörelseenergi enligt urvalet på sida 1057.`,
    message_en: `RQ: ${L.min_pressure_mpa}–${L.max_pressure_mpa} MPa (proof pressure ${L.proof_pressure_mpa} MPa), ${L.temp_c[0]}…${L.temp_c[1]} °C (with magnet ${L.temp_magnet_c[0]}…${L.temp_magnet_c[1]}), ${L.speed_mm_s[0]}–${L.speed_mm_s[1]} mm/s, non-lube, air cushion without a cushion ring; brackets are shipped unassembled (pages 1039–1040). Check the allowable kinetic energy per the selection on page 1057.`,
    goto_step: steg("mounting"),
  });
  const fot = RQ_MOUNTINGS.filter((m) => m.bracket === "L" || m.bracket === "LC").map((m) => m.code);
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "mounting" }, fot] },
    message_sv: "Fotfästen beställs som två stycken per cylinder; kroppsskruvarna medföljer (sida 1040, not 1–2).",
    message_en: "Foot brackets are ordered as two pieces per cylinder; the body mounting bolts are included (page 1040, notes 1–2).",
    goto_step: steg("mounting"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "rod_end" }, RQ_ROD_END.code] },
    message_sv: "Hangängad kolvstångsände M (standard är hongänga) (sida 1039).",
    message_en: "Male rod end thread M (female thread is standard) (page 1039).",
    goto_step: steg("rod_end"),
  });
  return rows;
}

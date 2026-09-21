/**
 * CJ1-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: ø2,5 finns bara enkelverkande, och
 * standardslagen beror på borrning och funktion.
 */
import { CJ1_ACTIONS, CJ1_BORES, CJ1_LIMITS, CJ1_MODELS, CJ1_STROKES, cj1Model } from "./cj1";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type CJ1DbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const bore = (k: string) => CJ1_BORES.find((b) => b.code === k)!;

export function buildCj1DbRules(): CJ1DbRule[] {
  const rows: CJ1DbRule[] = [];
  const steg = (p: string) => `cj1-${p}`;

  // ── borrning mot funktion ──────────────────────────────────────────────
  for (const b of CJ1_BORES) {
    for (const a of CJ1_ACTIONS) {
      if (cj1Model(b.code, a.code)) continue;
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { "==": [{ var: "action" }, a.code] }] },
        message_sv: `ø${sv(b.bore_mm)} finns bara ${a.code ? "dubbelverkande" : "enkelverkande med fjäderretur (S)"} (sida 15).`,
        message_en: `ø${b.bore_mm} is only available ${a.code ? "double acting" : "single acting, spring return (S)"} (page 15).`,
        goto_step: steg("action"),
      });
    }
  }

  // ── slag mot modell ────────────────────────────────────────────────────
  for (const x of CJ1_MODELS) {
    const a = CJ1_ACTIONS.find((y) => y.code === x.action)!;
    const b = bore(x.bore);
    const saknas = CJ1_STROKES.map((s) => s.code).filter((s) => !x.strokes.includes(Number(s)));
    if (saknas.length === 0) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "bore" }, x.bore] }, { "==": [{ var: "action" }, x.action] }, { in: [{ var: "stroke" }, saknas] }] },
      message_sv: `CJ1B${x.bore}${x.action ? "-□S" : ""} ø${sv(b.bore_mm)} tillverkas med standardslag ${lista(x.strokes)} mm (sida ${a.page}).`,
      message_en: `CJ1B${x.bore}${x.action ? "-□S" : ""} ø${b.bore_mm} is made with the standard strokes ${lista(x.strokes, "and")} mm (page ${a.page}).`,
      goto_step: steg("stroke"),
    });
  }

  // ── råd per modell och slag ────────────────────────────────────────────
  for (const x of CJ1_MODELS) {
    const a = CJ1_ACTIONS.find((y) => y.code === x.action)!;
    const b = bore(x.bore);
    x.strokes.forEach((s, i) => {
      const fjader = x.spring_ret_n !== null
        ? `; fjäderkraft ${sv(x.spring_ret_n)} N indragen och ${sv(x.spring_ext_n!)} N utskjuten — fjädern drar bara in kolvstången, belasta den inte under returslaget`
        : "";
      const spring = x.spring_ret_n !== null
        ? `; spring force ${x.spring_ret_n} N retracted and ${x.spring_ext_n} N extended — the spring only retracts the piston rod, do not load it during the return stroke`
        : "";
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "bore" }, x.bore] }, { "==": [{ var: "action" }, x.action] }, { "==": [{ var: "stroke" }, String(s)] }] },
        message_sv: `CJ1B${x.bore}-${s}${x.action}U4: ø${sv(b.bore_mm)}, kolvstång ø${b.rod_mm}, slag ${s} mm, ${a.code ? "enkelverkande fjäderretur" : "dubbelverkande"}, ${sv(a.pressure_mpa[0])}–${sv(a.pressure_mpa[1])} MPa, teoretisk kraft vid 0,5 MPa ${sv(x.force_out_05_n)} N ut${a.code ? "" : ` och ${sv(x.force_in_05_n)} N in`}${fjader}; längd ${sv(x.dim_s_mm[i])} mm indragen (Z ${sv(x.dim_z_mm[i])} mm), vikt ${sv(x.weight_g[i])} g (sida ${a.page} och ${a.dims_page}).`,
        message_en: `CJ1B${x.bore}-${s}${x.action}U4: ø${b.bore_mm}, piston rod ø${b.rod_mm}, stroke ${s} mm, ${a.code ? "single acting spring return" : "double acting"}, ${a.pressure_mpa[0]}–${a.pressure_mpa[1]} MPa, theoretical output at 0.5 MPa ${x.force_out_05_n} N out${a.code ? "" : ` and ${x.force_in_05_n} N in`}${spring}; length ${x.dim_s_mm[i]} mm retracted (Z ${x.dim_z_mm[i]} mm), weight ${x.weight_g[i]} g (pages ${a.page} and ${a.dims_page}).`,
        goto_step: steg("stroke"),
      });
    });
  }

  // ── råd per borrning ───────────────────────────────────────────────────
  for (const b of CJ1_BORES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `CJ1 ø${sv(b.bore_mm)}: bastyp utan dämpning och utan givare, ${CJ1_LIMITS.temp_c[0]}…${CJ1_LIMITS.temp_c[1]} °C (frostfritt), kolvhastighet ${CJ1_LIMITS.speed_mm_s[0]}–${CJ1_LIMITS.speed_mm_s[1]} mm/s, provtryck ${sv(CJ1_LIMITS.proof_pressure_mpa)} MPa, smörjfri; anslutning för slang ${CJ1_LIMITS.tubing} (U4), kopplingen på stångsidan kan vridas ±90° (sida 16 och 18).`,
      message_en: `CJ1 ø${b.bore_mm}: basic style without cushion and without auto switch, ${CJ1_LIMITS.temp_c[0]}…${CJ1_LIMITS.temp_c[1]} °C (no freezing), piston speed ${CJ1_LIMITS.speed_mm_s[0]}–${CJ1_LIMITS.speed_mm_s[1]} mm/s, proof pressure ${CJ1_LIMITS.proof_pressure_mpa} MPa, non-lube; connection for ø4/ø2.5 polyurethane TU0425 or soft nylon TS0425 tubing (U4), the rod-side fitting rotates ±90° (pages 16 and 18).`,
      goto_step: steg("bore"),
    });
  }
  return rows;
}

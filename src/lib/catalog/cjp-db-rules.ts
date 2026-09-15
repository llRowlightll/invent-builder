/**
 * CJP-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: slangnippeln mot fästet och
 * borrningen, kåpan mot gängan, specialutförandet mot borrningen och gängan,
 * och slaget mot de tre standardslagen.
 */
import { CJP_BORES, CJP_CAPS, CJP_LIMITS, CJP_MTO, CJP_NIPPLES, CJP_STROKES } from "./cjp";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type CJPDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");

export function buildCjpDbRules(): CJPDbRule[] {
  const rows: CJPDbRule[] = [];
  const steg = (p: string) => `cjp-${p}`;
  const nipplar = CJP_NIPPLES.map((n) => n.code);
  const utanNippel = CJP_BORES.filter((b) => !b.nipple_ok).map((b) => b.code);
  const utanSpecial = CJP_BORES.filter((b) => !b.mto_ok).map((b) => b.code);
  const medSpecial = CJP_BORES.filter((b) => b.mto_ok).map((b) => b.code);
  const kapor = CJP_CAPS.map((c) => c.code);

  // ── slaget ─────────────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ ">": [{ var: "stroke_mm" }, 0] }, { not: { in: [{ var: "stroke_mm" }, CJP_STROKES] } }] },
    message_sv: `CJP finns i slag ${lista(CJP_STROKES, "eller")} mm, inga mellanslag (sida 1).`,
    message_en: `CJP exists in strokes ${lista(CJP_STROKES, "or")} mm, no intermediate strokes (page 1).`,
    goto_step: steg("stroke_mm"),
  });

  // ── slangnippeln: bara panelmontage B, inte ø4 ─────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "nipple" }, nipplar] }, { "==": [{ var: "mounting" }, "S"] }] },
    message_sv: "Slangnippeln H4/H6 finns bara för panelmontaget B; det inbyggda montaget S levereras utan nippel (sida 1).",
    message_en: "The hose nipple H4/H6 exists for the panel mount type B only; the embedded type S ships without a nipple (page 1).",
    goto_step: steg("nipple"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "nipple" }, nipplar] }, { in: [{ var: "bore" }, utanNippel] }] },
    message_sv: `Slangnippeln H4/H6 finns inte för ø${lista(utanNippel)} (sida 1).`,
    message_en: `The hose nipple H4/H6 does not exist for ø${lista(utanNippel, "and")} (page 1).`,
    goto_step: steg("nipple"),
  });

  // ── kåpan förutsätter gänga ────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "cap" }, kapor] }, { "==": [{ var: "rod_thread" }, "B"] }] },
    message_sv: "Kolvstångskåpan T/U skruvas på gängan — välj gängad kolvstång (standard), inte B (sida 1).",
    message_en: "The rod end cap T/U screws onto the thread — choose the threaded rod (standard), not B (page 1).",
    goto_step: steg("cap"),
  });

  // ── specialutföranden ──────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, CJP_MTO.map((m) => m.code)] }, { in: [{ var: "bore" }, utanSpecial] }] },
    message_sv: `-${lista(CJP_MTO.map((m) => m.code))} finns för ø${lista(medSpecial)}, inte ø${lista(utanSpecial)} (sida 1 och 7).`,
    message_en: `-${lista(CJP_MTO.map((m) => m.code), "and")} exist for ø${lista(medSpecial, "and")}, not ø${lista(utanSpecial, "and")} (pages 1 and 7).`,
    goto_step: steg("mto"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mto" }, "XC17"] }, { "==": [{ var: "rod_thread" }, "B"] }] },
    message_sv: "-XC17 levereras alltid utan gänga; symbolen B skrivs inte i koden (sida 7).",
    message_en: "-XC17 always ships without thread; the symbol B is not written in the code (page 7).",
    goto_step: steg("rod_thread"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mto" }, "XC17"] }, { in: [{ var: "cap" }, kapor] }] },
    message_sv: "-XC17 har ogängad kolvstång — kolvstångskåpan T/U kan inte skruvas på (sida 7).",
    message_en: "-XC17 has an unthreaded rod — the rod end cap T/U cannot be screwed on (page 7).",
    goto_step: steg("cap"),
  });

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of CJP_BORES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `ø${b.bore_mm}: ${sv(b.force_out_05_n)} N ut vid 0,5 MPa, fjäderretur ${sv(b.force_in_n)} N; minsta tryck ${sv(b.min_pressure_mpa)} MPa, max ${sv(CJP_LIMITS.max_pressure_mpa)} MPa (sida 1–2).`,
      message_en: `ø${b.bore_mm}: ${b.force_out_05_n} N out at 0.5 MPa, spring return ${b.force_in_n} N; minimum pressure ${b.min_pressure_mpa} MPa, max ${CJP_LIMITS.max_pressure_mpa} MPa (pages 1–2).`,
      goto_step: steg("bore"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "mounting" }, "B"] },
    message_sv: "Panelmontage: två fästmuttrar och två kolvstångsmuttrar (med gängad stång) följer med (sida 1).",
    message_en: "Panel mount: two mounting nuts and two rod end nuts (with threaded rod) are included (page 1).",
    goto_step: steg("mounting"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "mounting" }, "S"] },
    message_sv: "Inbyggt montage: en fästmutter, en packning och två kolvstångsmuttrar (med gängad stång) följer med (sida 1).",
    message_en: "Embedded type: one mounting nut, one gasket and two rod end nuts (with threaded rod) are included (page 1).",
    goto_step: steg("mounting"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "cap" }, kapor] },
    message_sv: "Kåpan ligger i samma förpackning och dras fast med standardcylinderns kolvstångsmutter (sida 1).",
    message_en: "The cap is included in the same package and is tightened with the standard cylinder's rod end nut (page 1).",
    goto_step: steg("cap"),
  });
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "mto" }, ""] },
    message_sv: `Specialutförande: mått och specifikationer som standard, men leveranstid enligt SMC (sida 7). Temperatur ${CJP_LIMITS.temp_c[0]}…${CJP_LIMITS.temp_c[1]} °C, hastighet ${CJP_LIMITS.speed_mm_s[0]}–${CJP_LIMITS.speed_mm_s[1]} mm/s.`,
    message_en: `Made to order: dimensions and specifications as standard, delivery time per SMC (page 7). Temperature ${CJP_LIMITS.temp_c[0]}…${CJP_LIMITS.temp_c[1]} °C, speed ${CJP_LIMITS.speed_mm_s[0]}–${CJP_LIMITS.speed_mm_s[1]} mm/s.`,
    goto_step: steg("mto"),
  });

  return rows;
}

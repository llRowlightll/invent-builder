/**
 * MXS-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Kombinationsmatrisen justering × funktion (sida 6) är kärnan: nio
 * justeringar mot sex funktionsoptioner, avskriven cell för cell. Resten är
 * storleksbundet (ø6 saknar stötdämpare och ändlägeslås; TN/TF finns bara
 * ø20 och ø25) och slaget, som bara finns i katalogens lista.
 */
import {
  MXS_ADJUSTERS,
  MXS_BORES,
  MXS_FUNCTIONALS,
  MXS_LIMITS,
  MXS_PORTS,
} from "./mxs";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type MxsDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}

export function buildMxsDbRules(): MxsDbRule[] {
  const rows: MxsDbRule[] = [];
  const steg = (p: string) => `mxs-${p}`;
  const alla = MXS_BORES.map((b) => b.code);

  // ── slaget finns bara i listan ─────────────────────────────────────────
  const perSlag = new Map<string, string[]>();
  for (const b of MXS_BORES) perSlag.set(b.strokes.join(","), [...(perSlag.get(b.strokes.join(",")) ?? []), b.code]);
  for (const [slag, bores] of perSlag) {
    const lst = slag.split(",").map(Number);
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, 0] }, { not: { in: [{ var: "stroke_mm" }, lst] } }] },
      message_sv: `MXS${lista(bores, "och")} finns i slag ${lista(lst)} mm — inga mellanslag.`,
      message_en: `MXS${lista(bores, "and")} exists in strokes ${lista(lst, "and")} mm — no intermediate strokes.`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── gängtyp ────────────────────────────────────────────────────────────
  for (const p of MXS_PORTS) {
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "port" }, p.code] }, { in: [{ var: "bore" }, alla.filter((b) => !p.bores.includes(b))] }] },
      message_sv: `Gängtyp ${p.code} finns för ø${lista(p.bores)}; ø6–16 har M-gänga.`,
      message_en: `Port thread ${p.code} exists for ø${lista(p.bores, "and")}; ø6–16 has M thread.`,
      goto_step: steg("port"),
    });
  }

  // ── ø6 saknar stötdämpare och ändlägeslås ──────────────────────────────
  const utanDampare = MXS_BORES.filter((b) => !b.absorber).map((b) => b.code);
  const medDampare = MXS_ADJUSTERS.filter((a) => a.absorber).map((a) => a.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "adjuster" }, medDampare] }, { in: [{ var: "bore" }, utanDampare] }] },
    message_sv: `Stötdämpare (${lista(medDampare)}) finns inte för MXS${lista(utanDampare)} (sida 65). Gummistopp AS, AT och A går.`,
    message_en: `Shock absorbers (${lista(medDampare, "and")}) are not available for MXS${lista(utanDampare, "and")} (page 65). Rubber stoppers AS, AT and A are.`,
    goto_step: steg("adjuster"),
  });
  const utanLas = MXS_BORES.filter((b) => !b.end_lock).map((b) => b.code);
  const medLas = MXS_FUNCTIONALS.filter((f) => f.end_lock).map((f) => f.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "functional" }, medLas] }, { in: [{ var: "bore" }, utanLas] }] },
    message_sv: `Ändlägeslås (${lista(medLas)}) finns inte för MXS${lista(utanLas)} (not 2, sida 64).`,
    message_en: `The end lock (${lista(medLas, "and")}) is not available for MXS${lista(utanLas, "and")} (note 2, page 64).`,
    goto_step: steg("functional"),
  });

  // ── symmetriskt utförande har inga funktionsoptioner ───────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "symmetric" }, "L"] }, { "!=": [{ var: "functional" }, ""] }] },
    message_sv: "Det symmetriska utförandet MXS□L har inga funktionsoptioner (not 2, sida 85) — ingen buffert, inget ändlägeslås, ingen axiell anslutning.",
    message_en: "The symmetric MXS□L has no functional options (note 2, page 85) — no buffer, no end lock, no axial piping.",
    goto_step: steg("functional"),
  });

  // ── kombinationsmatrisen justering × funktion (sida 64) ────────────────
  for (const a of MXS_ADJUSTERS) {
    const inte = MXS_FUNCTIONALS.map((f) => f.code).filter((f) => !a.functional_ok.includes(f));
    if (inte.length === 0) continue;
    const ok = a.functional_ok.filter((f) => f);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "adjuster" }, a.code] }, { in: [{ var: "functional" }, inte] }] },
      message_sv: ok.length > 0
        ? `Justering ${a.code} går att kombinera med funktionsoption ${lista(ok, "eller")}, inte ${lista(inte)} (sida 64).`
        : `Justering ${a.code} går inte att kombinera med någon funktionsoption (sida 64).`,
      message_en: ok.length > 0
        ? `Adjuster ${a.code} combines with functional option ${lista(ok, "or")}, not ${lista(inte, "and")} (page 64).`
        : `Adjuster ${a.code} cannot be combined with any functional option (page 64).`,
      goto_step: steg("functional"),
    });
  }

  // ── givare ─────────────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mto" }, "X33"] }, { "!=": [{ var: "switch" }, ""] }] },
    message_sv: "-X33 är utan inbyggd magnet; då har givaren inget att känna av.",
    message_en: "-X33 is without the built-in magnet; the auto switch would have nothing to sense.",
    goto_step: steg("mto"),
  });

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of MXS_BORES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `MXS${b.code}: teoretisk kraft ${b.force_out_n_05mpa} N vid 0,5 MPa (dubbel kolvstång), anslutning ${b.port_label}, ` +
        `slag ${lista(b.strokes)} mm. Tryck ${String(MXS_LIMITS.pressure_mpa[0]).replace(".", ",")}–${String(MXS_LIMITS.pressure_mpa[1]).replace(".", ",")} MPa.`,
      message_en: `MXS${b.code}: theoretical force ${b.force_out_n_05mpa} N at 0.5 MPa (dual rod), port ${b.port_label}, ` +
        `strokes ${lista(b.strokes, "and")} mm. Pressure ${MXS_LIMITS.pressure_mpa[0]}–${MXS_LIMITS.pressure_mpa[1]} MPa.`,
      goto_step: steg("bore"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "adjuster" }, ["AS", "A", "ASBT"]] },
    message_sv: `Gummistoppet i utskjutet ändläge justerar slaget 0–${MXS_LIMITS.adjust_range_mm} mm. Med buffert (F) kortas buffertslaget lika mycket (not 3).`,
    message_en: `The rubber stopper on the extension end adjusts the stroke 0–${MXS_LIMITS.adjust_range_mm} mm. With buffer (F) the buffer stroke shortens by the same amount (note 3).`,
    goto_step: steg("adjuster"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "functional" }, ["F", "FR", "FP"]] },
    message_sv: "Buffertens givare (D-M9BV/M9NV/M9PV) beställs separat (sida 83).",
    message_en: "The buffer's auto switch (D-M9BV/M9NV/M9PV) is ordered separately (page 83).",
    goto_step: steg("functional"),
  });
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "switch" }, ""] },
    message_sv: "Givaren levereras löst, inte monterad. 5 m kabel tillverkas på beställning.",
    message_en: "The auto switch ships loose, not assembled. The 5 m lead is made to order.",
    goto_step: steg("switch"),
  });

  return rows;
}

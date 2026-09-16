/**
 * MHZ2-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: smal typ och kroppsalternativ mot
 * borrningen; kroppsalternativet mot verkan; D-F8 mot borrningen; antal
 * "n" mot ø6; kabellängden mot givaren; -X46/-X51 mot borrning, verkan,
 * kropp och fingerläge; givaren mot -X50. Resten är råd ur datasidorna.
 */
import { MHZ2_ACTIONS, MHZ2_BODIES, MHZ2_BORES, MHZ2_COUNTS, MHZ2_FINGERS, MHZ2_LEADS, MHZ2_LEAD_INDEX, MHZ2_LIMITS, MHZ2_MTO, MHZ2_SWITCHES } from "./mhz2";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type MHZ2DbRule = DsbcDbRule;

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
const basnamn = (koder: string[]) => [...new Set(koder.map((k) => k.replace(/^(M9[NPB][WA]?)V$/, "$1")))].join("/");
const VERKAN: Record<string, [string, string]> = {
  D: ["dubbelverkande", "double acting"],
  S: ["enkelverkande normalt öppen", "single acting normally open"],
  C: ["enkelverkande normalt stängd", "single acting normally closed"],
};

export function buildMhz2DbRules(): MHZ2DbRule[] {
  const rows: MHZ2DbRule[] = [];
  const steg = (p: string) => `mhz2-${p}`;
  const medGivare = { "!=": [{ var: "switch" }, ""] };
  const utanSmal = MHZ2_BORES.filter((b) => !b.narrow).map((b) => b.code);
  const medSmal = MHZ2_BORES.filter((b) => b.narrow).map((b) => b.code);
  const utanKropp = MHZ2_BORES.filter((b) => !b.body_options).map((b) => b.code);

  // ── fingrar och kropp mot borrning och verkan ──────────────────────────
  const smal = MHZ2_FINGERS.filter((f) => f.narrow).map((f) => f.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "finger" }, smal] }, { in: [{ var: "bore" }, utanSmal] }] },
    message_sv: `Smal typ ${lista(smal)} (MHQ2-kompatibel) finns bara för ø${lista(medSmal)}, inte ø${lista(utanSmal)} (sida 496–498).`,
    message_en: `The narrow type ${lista(smal, "and")} (MHQ2 compatible) exists only for ø${lista(medSmal, "and")}, not ø${lista(utanSmal, "and")} (pages 496–498).`,
    goto_step: steg("finger"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "body" }, ""] }, { in: [{ var: "bore" }, utanKropp] }] },
    message_sv: `Kroppsalternativen ${lista(MHZ2_BODIES.map((k) => k.code))} (ändtapp) finns bara för ø${lista(medSmal)}, inte ø${lista(utanKropp)} (sida 499).`,
    message_en: `The body options ${lista(MHZ2_BODIES.map((k) => k.code), "and")} (end boss) exist only for ø${lista(medSmal, "and")}, not ø${lista(utanKropp, "and")} (page 499).`,
    goto_step: steg("body"),
  });
  for (const k of MHZ2_BODIES) {
    const fel = MHZ2_ACTIONS.map((a) => a.code).filter((a) => !k.actions.includes(a));
    if (!fel.length) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "body" }, k.code] }, { in: [{ var: "action" }, fel] }] },
      message_sv: `Kroppsalternativet ${k.code} finns bara ${lista(k.actions.map((a) => VERKAN[a][0]), "eller")}, inte ${lista(fel.map((a) => VERKAN[a][0]), "eller")} (sida 499, 512).`,
      message_en: `The body option ${k.code} exists only ${lista(k.actions.map((a) => VERKAN[a][1]), "or")}, not ${lista(fel.map((a) => VERKAN[a][1]), "or")} (pages 499, 512).`,
      goto_step: steg("body"),
    });
  }

  // ── givaren ────────────────────────────────────────────────────────────
  const utanMagnet = MHZ2_MTO.filter((x) => x.no_magnet).map((x) => x.code);
  rows.push({
    severity: "error",
    if_json: { and: [medGivare, { in: [{ var: "mto" }, utanMagnet] }] },
    message_sv: `Utan magnet (-${utanMagnet.join("/-")}) kan ingen givare monteras — standardutförandet har inbyggd magnet (sida 496–499).`,
    message_en: `Without the magnet (-${utanMagnet.join("/-")}) no auto switch can be mounted — the standard version has a built-in magnet (pages 496–499).`,
    goto_step: steg("mto"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  const f8 = MHZ2_SWITCHES.filter((g) => g.f8).map((g) => g.code);
  const utanF8 = MHZ2_BORES.filter((b) => !b.f8_ok).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "switch" }, f8] }, { in: [{ var: "bore" }, utanF8] }] },
    message_sv: `D-${f8.join("/")} passar inte ø${lista(utanF8)} (sida 497, tabellen).`,
    message_en: `D-${f8.join("/")} does not fit ø${lista(utanF8, "and")} (page 497, table).`,
    goto_step: steg("switch"),
  });
  const nAntal = MHZ2_COUNTS.filter((n) => n.n).map((n) => n.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "count" }, nAntal] }, { "==": [{ var: "bore" }, "6"] }] },
    message_sv: "ø6 beställs med en (S) eller två givare; antal n finns bara för ø10–40 (sida 496–498).",
    message_en: "ø6 is ordered with one (S) or two auto switches; the quantity n exists only for ø10–40 (pages 496–498).",
    goto_step: steg("count"),
  });
  for (const lead of ["", ...MHZ2_LEADS.map((l) => l.code)]) {
    const i = MHZ2_LEAD_INDEX[lead];
    const saknas = MHZ2_SWITCHES.filter((g) => g.leads[i] === "-").map((g) => g.code);
    if (saknas.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, saknas] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} finns inte för D-${basnamn(saknas)} (sida 496–498, —).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} does not exist for D-${basnamn(saknas)} (pages 496–498, —).`,
        goto_step: steg("lead"),
      });
    }
    const pa = MHZ2_SWITCHES.filter((g) => g.leads[i] === "O").map((g) => g.code);
    if (pa.length) {
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för ${pa.length === MHZ2_SWITCHES.length ? "alla givarna" : `D-${basnamn(pa)} (även V-typerna)`} (sida 496–498, ○).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for ${pa.length === MHZ2_SWITCHES.length ? "all the switches" : `D-${basnamn(pa)} (V types too)`} (pages 496–498, ○).`,
        goto_step: steg("lead"),
      });
    }
  }
  const vatten = MHZ2_SWITCHES.filter((g) => g.water_resistant).map((g) => g.code);
  rows.push({
    severity: "warn",
    if_json: { in: [{ var: "switch" }, vatten] },
    message_sv: `De vattentäta givarna D-${basnamn(vatten)} går att montera, men SMC garanterar inte vattentätheten på MHZ2 (sida 496–498, ∗∗).`,
    message_en: `The water-resistant switches D-${basnamn(vatten)} can be mounted, but SMC cannot guarantee water resistance on the MHZ2 (pages 496–498, ∗∗).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "switch" }, f8] },
    message_sv: `D-${f8.join("/")} monteras minst 10 mm från magnetiska material som järn (sida 496, not 1).`,
    message_en: `D-${f8.join("/")} must be mounted at least 10 mm away from magnetic substances such as iron (page 496, note 1).`,
    goto_step: steg("switch"),
  });
  const tvafarg = MHZ2_SWITCHES.filter((g) => /^M9[NPB][WA]V?$/.test(g.code)).map((g) => g.code);
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "switch" }, tvafarg] },
    message_sv: "Tvåfärgsindikering: ställ in givaren så att den lyser rött i det läge som ska detekteras (sida 496–498, not).",
    message_en: "Two-colour indicator: set the switch so that the indicator is lit red at the position to be detected (pages 496–498, note).",
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { and: [medGivare, { "==": [{ var: "bore" }, "10"] }] },
    message_sv: `MHZ2-10 levereras med givarfästen när gripdonet beställs med givare; beställs givaren separat behövs fästet ${MHZ2_LIMITS.switch_bracket} (sida 497, not 3).`,
    message_en: `MHZ2-10 ships with the auto switch mounting brackets when ordered with switches; a separately ordered switch needs the bracket ${MHZ2_LIMITS.switch_bracket} (page 497, note 3).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { and: [medGivare, { in: [{ var: "bore" }, ["16", "20", "25", "32", "40"]] }] },
    message_sv: `Används givaren i det fyrkantiga spåret på sidan behövs fästet ${MHZ2_LIMITS.switch_bracket}, som beställs separat (sida 497–498, not 3; fästen sida 545).`,
    message_en: `When the switch is used in the square groove on the side the bracket ${MHZ2_LIMITS.switch_bracket} is required and ordered separately (pages 497–498, note 3; brackets page 545).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { and: [medGivare, { in: [{ var: "finger" }, ["2", "N2"]] }] },
    message_sv: "Genomgående hål: montering genom hålen går inte när givaren sitter i det fyrkantiga spåret på sidan (sida 497–498, not 2).",
    message_en: "Through-holes: through-hole mounting is not possible when the auto switch is used in the square groove on the side (pages 497–498, note 2).",
    goto_step: steg("finger"),
  });

  // ── specialutföranden med egna villkor (sida 547–548) ──────────────────
  for (const x of MHZ2_MTO) {
    if (x.bores) {
      const fel = MHZ2_BORES.map((b) => b.code).filter((b) => !x.bores!.includes(b));
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, x.code] }, { in: [{ var: "bore" }, fel] }] },
        message_sv: `-${x.code} finns för ø${lista(x.bores)}, inte ø${lista(fel)} (sida ${x.code === "X46" ? 547 : 548}, not).`,
        message_en: `-${x.code} exists for ø${lista(x.bores, "and")}, not ø${lista(fel, "and")} (page ${x.code === "X46" ? 547 : 548}, note).`,
        goto_step: steg("mto"),
      });
    }
    if (x.actions) {
      const fel = MHZ2_ACTIONS.map((a) => a.code).filter((a) => !x.actions!.includes(a));
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, x.code] }, { in: [{ var: "action" }, fel] }] },
        message_sv: `-${x.code} finns bara ${lista(x.actions.map((a) => VERKAN[a][0]), "eller")} (sida 547).`,
        message_en: `-${x.code} exists only ${lista(x.actions.map((a) => VERKAN[a][1]), "or")} (page 547).`,
        goto_step: steg("mto"),
      });
    }
    if (x.bodies) {
      const fel = MHZ2_BODIES.map((k) => k.code).filter((k) => !x.bodies!.includes(k));
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, x.code] }, { in: [{ var: "body" }, fel] }] },
        message_sv: `-${x.code} beställs med kroppsalternativ ${lista(x.bodies.map((k) => k || "Nil"), "eller")}, inte ${lista(fel, "eller")} (sida 547).`,
        message_en: `-${x.code} is ordered with the body option ${lista(x.bodies.map((k) => k || "Nil"), "or")}, not ${lista(fel, "or")} (page 547).`,
        goto_step: steg("mto"),
      });
    }
    if (x.fingers) {
      const fel = MHZ2_FINGERS.map((f) => f.code).filter((f) => !x.fingers!.includes(f));
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, x.code] }, { in: [{ var: "finger" }, fel] }] },
        message_sv: `-${x.code} beställs med fingerläge ${lista(x.fingers.map((f) => f || "Nil"), "eller")}; fingeralternativen ${lista(fel)} anges inte (sida 548, not 2).`,
        message_en: `-${x.code} is ordered with the finger position ${lista(x.fingers.map((f) => f || "Nil"), "or")}; the finger options ${lista(fel, "and")} are not specified (page 548, note 2).`,
        goto_step: steg("mto"),
      });
    }
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "mto" }, "X46"] },
    message_sv: "-X46: strypskruven ställer stängningshastigheten (1/4–2 varv från stängt beroende på storlek); öppningshastigheten stryps med en flödesregulator AS på utloppet. Låt fingrarna gå så långsamt som möjligt (sida 547).",
    message_en: "-X46: the needle sets the closing speed (1/4–2 turns from closed depending on size); the opening speed is throttled with an AS meter-out speed controller. Keep the finger speed no greater than necessary (page 547).",
    goto_step: steg("mto"),
  });

  // ── råd per borrning och verkan ────────────────────────────────────────
  for (const b of MHZ2_BORES) {
    for (const a of MHZ2_ACTIONS) {
      const kraft = a.code === "D" ? `gripkraft per finger ${sv(b.force_d[0])} N yttre/${sv(b.force_d[1])} N inre grepp` : a.code === "S" ? `gripkraft per finger ${sv(b.force_no)} N (yttre grepp)` : `gripkraft per finger ${sv(b.force_nc)} N (inre grepp)`;
      const force = a.code === "D" ? `gripping force per finger ${b.force_d[0]} N external/${b.force_d[1]} N internal` : a.code === "S" ? `gripping force per finger ${b.force_no} N (external grip)` : `gripping force per finger ${b.force_nc} N (internal grip)`;
      const p = a.code === "D" ? b.pressure_d : b.pressure_s;
      const w = a.code === "D" ? b.weight_g[0] : b.weight_g[1];
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { "==": [{ var: "action" }, a.code] }] },
        message_sv: `MHZ2-${b.code}${a.code}: ${kraft} vid 0,5 MPa och gripunkt 20 mm, slag ${b.stroke_mm} mm (båda sidor), ${sv(p[0])}–${sv(p[1])} MPa, vikt ${w} g utan givare, port ${b.port}; repeternoggrannhet ±${sv(b.repeatability_mm)} mm, högst ${b.max_frequency_cpm} cykler/min (sida 499).`,
        message_en: `MHZ2-${b.code}${a.code}: ${force} at 0.5 MPa and 20 mm gripping point, stroke ${b.stroke_mm} mm (both sides), ${p[0]}–${p[1]} MPa, weight ${w} g without switch, port ${b.port}; repeatability ±${b.repeatability_mm} mm, max ${b.max_frequency_cpm} cycles/min (page 499).`,
        goto_step: steg("bore"),
      });
    }
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "body" }, "E"] },
    message_sv: "Sidoportad ändtapp E: port M3 x 0.5 på ø10 och M5 x 0.8 på ø16–25; ändtappen ø12/16/20/25 f8 (sida 499, 512).",
    message_en: "Side-ported end boss E: port M3 x 0.5 on ø10 and M5 x 0.8 on ø16–25; end boss ø12/16/20/25 f8 (pages 499, 512).",
    goto_step: steg("body"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "body" }, ["W", "K"]] },
    message_sv: "Axiella portar med ø4-koppling: slang T0425/TS0425/TU0425 eller koaxialslang (W); plugg medföljer (sida 512–513).",
    message_en: "Axial ports with ø4 One-touch fitting: tubing T0425/TS0425/TU0425 or coaxial tubing (W); plug included (pages 512–513).",
    goto_step: steg("body"),
  });
  const L = MHZ2_LIMITS;
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "bore" }, ""] },
    message_sv: `MHZ2: ${L.temp_c[0]}…${L.temp_c[1]} °C, smörjfri, kropp i hårdanodiserad aluminium, fingrar och styrning i härdat rostfritt stål (sida 499, 501–503). Välj ett gripdon med ${L.grip_force_factor[0]}–${L.grip_force_factor[1]} gånger arbetsstyckets massa i gripkraft och håll gripunkten inom diagrammets område; i dammig miljö används MHZJ2 med dammskydd (sida 499).`,
    message_en: `MHZ2: ${L.temp_c[0]}…${L.temp_c[1]} °C, no lubrication, hard-anodised aluminium body, heat-treated stainless steel fingers and guide (pages 499, 501–503). Choose a gripper with ${L.grip_force_factor[0]}–${L.grip_force_factor[1]} times the workpiece mass in gripping force and keep the gripping point within the graph range; in dusty places use the MHZJ2 with dust cover (page 499).`,
    goto_step: steg("bore"),
  });
  return rows;
}

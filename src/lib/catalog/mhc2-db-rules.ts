/**
 * MHC2-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: givaren mot specialutförandet utan
 * magnet; kabellängden mot givaren (○ på beställning); antal och kabel
 * mot att en givare är vald. Resten är råd ur data- och monteringssidorna.
 */
import { MHC2_ACTIONS, MHC2_BORES, MHC2_LEADS, MHC2_LEAD_INDEX, MHC2_LIMITS, MHC2_MTO, MHC2_SWITCHES } from "./mhc2";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type MHC2DbRule = DsbcDbRule;

const sv = (n: number) => String(n).replace(".", ",");
const LEAD_NAMN: Record<string, [string, string]> = {
  "": ["0,5 m (ingen bokstav)", "0.5 m (no letter)"],
  M: ["1 m (M)", "1 m (M)"],
  L: ["3 m (L)", "3 m (L)"],
  Z: ["5 m (Z)", "5 m (Z)"],
};
/** Kortform för listor: D-M9N/M9NV/… blir för långt, så basnamnet räcker. */
const basnamn = (koder: string[]) => [...new Set(koder.map((k) => k.replace(/V$/, "")))].join("/");

export function buildMhc2DbRules(): MHC2DbRule[] {
  const rows: MHC2DbRule[] = [];
  const steg = (p: string) => `mhc2-${p}`;
  const medGivare = { "!=": [{ var: "switch" }, ""] };

  // ── givaren mot magneten och sina tillägg ──────────────────────────────
  const utanMagnet = MHC2_MTO.filter((x) => x.no_magnet).map((x) => x.code);
  rows.push({
    severity: "error",
    if_json: { and: [medGivare, { in: [{ var: "mto" }, utanMagnet] }] },
    message_sv: `Utan magnet (-${utanMagnet.join("/-")}) kan ingen givare monteras — standardutförandet har inbyggd magnet (sida 807–808).`,
    message_en: `Without the magnet (-${utanMagnet.join("/-")}) no auto switch can be mounted — the standard version has a built-in magnet (pages 807–808).`,
    goto_step: steg("mto"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  for (const lead of ["", ...MHC2_LEADS.map((l) => l.code)]) {
    const i = MHC2_LEAD_INDEX[lead];
    const saknas = MHC2_SWITCHES.filter((g) => g.leads[i] === "-").map((g) => g.code);
    if (saknas.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, saknas] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} finns inte för D-${basnamn(saknas)} (sida 807, —).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} does not exist for D-${basnamn(saknas)} (page 807, —).`,
        goto_step: steg("lead"),
      });
    }
    const pa = MHC2_SWITCHES.filter((g) => g.leads[i] === "O").map((g) => g.code);
    if (pa.length) {
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för ${pa.length === MHC2_SWITCHES.length ? "alla givarna" : `D-${basnamn(pa)} (även V-typerna)`} (sida 807, ○).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for ${pa.length === MHC2_SWITCHES.length ? "all the switches" : `D-${basnamn(pa)} (V types too)`} (page 807, ○).`,
        goto_step: steg("lead"),
      });
    }
  }
  const vatten = MHC2_SWITCHES.filter((g) => g.water_resistant).map((g) => g.code);
  rows.push({
    severity: "warn",
    if_json: { in: [{ var: "switch" }, vatten] },
    message_sv: `De vattentäta givarna D-${basnamn(vatten)} går att montera, men SMC garanterar inte vattentätheten på MHC2 (sida 807, ∗∗).`,
    message_en: `The water-resistant switches D-${basnamn(vatten)} can be mounted, but SMC cannot guarantee water resistance on the MHC2 (page 807, ∗∗).`,
    goto_step: steg("switch"),
  });
  const tvafarg = MHC2_SWITCHES.filter((g) => /W|A/.test(g.code.replace(/V$/, "").slice(2))).map((g) => g.code);
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "switch" }, tvafarg] },
    message_sv: "Tvåfärgsindikering: ställ in givaren så att den lyser rött i det läge som ska detekteras (sida 807, not 1).",
    message_en: "Two-colour indicator: set the switch so that the indicator is lit red at the position to be detected (page 807, note 1).",
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: medGivare,
    message_sv: `Givarfästet ${MHC2_LIMITS.switch_bracket} medföljer när gripdonet beställs med givare; beställs givaren separat behövs fästet också (sida 807, not 2). Med givare går kroppen inte att montera genom hålen, bara i gängorna (sida 811–812, 815). Två givare kan kombineras för två av lägena öppet/grepp/stängt (sida 813).`,
    message_en: `The mounting bracket ${MHC2_LIMITS.switch_bracket} is supplied when the gripper is ordered with auto switches; a separately ordered switch needs it too (page 807, note 2). With auto switches the body cannot be mounted through the holes, only in the tapped holes (pages 811–812, 815). Two switches can be combined for two of the positions open/gripping/closed (page 813).`,
    goto_step: steg("switch"),
  });
  for (const b of MHC2_BORES) {
    rows.push({
      severity: "info",
      if_json: { and: [medGivare, { "==": [{ var: "bore" }, b.code] }] },
      message_sv: `ø${b.code} med givare: hysteres högst ${b.hysteresis_deg}° mellan till- och frånslag; justera läget efter provkörning (sida 814).`,
      message_en: `ø${b.code} with auto switch: hysteresis at most ${b.hysteresis_deg}° between switch-on and switch-off; adjust the position after a trial run (page 814).`,
      goto_step: steg("switch"),
    });
  }

  // ── råd per borrning och verkan ────────────────────────────────────────
  const [amax, amin] = MHC2_LIMITS.angle_deg;
  for (const b of MHC2_BORES) {
    for (const a of MHC2_ACTIONS) {
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { "==": [{ var: "action" }, a.code] }] },
        message_sv: `MHC2-${b.code}${a.code}: gripmoment ${sv(b.moment_nm[a.code as "D" | "S"])} N·m (effektivt, 0,5 MPa), öppningsvinkel ${amax}° till ${amin}°, vikt ${b.weight_g[a.code as "D" | "S"]} g utan givare; port ${b.port}, fingerfäste 4 × ${b.attachment_thread}, kroppens fästgänga ${b.body_thread} (sida 808, 811–812).`,
        message_en: `MHC2-${b.code}${a.code}: gripping moment ${b.moment_nm[a.code as "D" | "S"]} N·m (effective, 0.5 MPa), opening/closing angle ${amax}° to ${amin}°, weight ${b.weight_g[a.code as "D" | "S"]} g without switch; port ${b.port}, attachment thread 4 × ${b.attachment_thread}, body mounting thread ${b.body_thread} (pages 808, 811–812).`,
        goto_step: steg("bore"),
      });
    }
  }
  const D = MHC2_ACTIONS.find((a) => a.code === "D")!;
  const S = MHC2_ACTIONS.find((a) => a.code === "S")!;
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "action" }, "D"] },
    message_sv: `Dubbelverkande: ${sv(D.pressure_mpa[0])}–${sv(D.pressure_mpa[1])} MPa, dubbel kolv för stor gripkraft, inbyggd justerbar strypning för fingerhastigheten (sida 808, 811).`,
    message_en: `Double acting: ${D.pressure_mpa[0]}–${D.pressure_mpa[1]} MPa, double piston for a large gripping force, built-in adjustable throttle for the finger speed (pages 808, 811).`,
    goto_step: steg("action"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "action" }, "S"] },
    message_sv: `Enkelverkande: normalt öppen (yttre grepp), ${sv(S.pressure_mpa[0])}–${sv(S.pressure_mpa[1])} MPa; ena porten är avluftning och ingen strypskruv för fingerhastigheten medföljer (sida 808, 811–812).`,
    message_en: `Single acting: normally open (external grip), ${S.pressure_mpa[0]}–${S.pressure_mpa[1]} MPa; one port is a breathing port and no finger-speed adjusting needle is attached (pages 808, 811–812).`,
    goto_step: steg("action"),
  });
  const L = MHC2_LIMITS;
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "bore" }, ""] },
    message_sv: `MHC2: repeternoggrannhet ±${sv(L.repeatability_mm)} mm, högst ${L.max_frequency_cpm} cykler/min, ${L.temp_c[0]}…${L.temp_c[1]} °C, smörjfri. Håll gripunkten inom diagrammets område och välj ett gripdon med ${L.grip_force_factor[0]}–${L.grip_force_factor[1]} gånger arbetsstyckets massa i gripkraft, mer vid acceleration eller stötar (sida 808–809). Fingrarna är martensitiskt rostfritt stål och kan rosta vid kondens; -X81A ger korrosionsskydd (sida 808, 815).`,
    message_en: `MHC2: repeatability ±${L.repeatability_mm} mm, max ${L.max_frequency_cpm} cycles/min, ${L.temp_c[0]}…${L.temp_c[1]} °C, no lubrication. Keep the gripping point within the graph range and choose a gripper with ${L.grip_force_factor[0]}–${L.grip_force_factor[1]} times the workpiece mass in gripping force, more with acceleration or impacts (pages 808–809). The fingers are martensitic stainless steel and may rust with condensation; -X81A adds corrosion protection (pages 808, 815).`,
    goto_step: steg("bore"),
  });
  return rows;
}

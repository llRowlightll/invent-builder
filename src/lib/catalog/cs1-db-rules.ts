/**
 * CS1-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: magneten mot borrning, rörsymbol,
 * tryckkärlssymbol och maxslag; rörsymbolen mot borrning och slag;
 * lufthydraulen mot borrning och dämpning; slaget mot borrning, fäste och
 * magnet; -V mot tryckkärlslagens gräns; specialutförandena mot typ och
 * borrning.
 */
import {
  CS1_BORES,
  CS1_LEADS,
  CS1_LEAD_INDEX,
  CS1_LIMITS,
  CS1_MOUNTINGS,
  CS1_MTO,
  CS1_SUFFIXES,
  CS1_SWITCHES,
  cs1MaxStroke,
} from "./cs1";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type CS1DbRule = DsbcDbRule;

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
const TYPNAMN: Record<string, [string, string]> = { "": ["smord", "lube"], N: ["osmord", "non-lube"], H: ["lufthydraul", "air-hydro"] };

export function buildCs1DbRules(): CS1DbRule[] {
  const rows: CS1DbRule[] = [];
  const steg = (p: string) => `cs1-${p}`;
  const alla = CS1_BORES.map((b) => b.code);

  // ── magneten: borrning, rörsymbol, -V ───────────────────────────────────
  const utanMagnet = CS1_BORES.filter((b) => !b.magnet_ok).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "magnet" }, "D"] }, { in: [{ var: "bore" }, utanMagnet] }] },
    message_sv: `Magnetcylindern CDS1 finns för ø125–200, inte ø${lista(utanMagnet)} (sida 618 och 625).`,
    message_en: `The CDS1 magnet cylinder exists for ø125–200, not ø${lista(utanMagnet, "and")} (pages 618 and 625).`,
    goto_step: steg("magnet"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "magnet" }, "D"] }, { "==": [{ var: "tubing" }, "F"] }] },
    message_sv: "Rörsymbolen F finns inte i magnetcylinderns nyckel (sida 625).",
    message_en: "The tubing symbol F is not part of the magnet cylinder's key (page 625).",
    goto_step: steg("tubing"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "magnet" }, "D"] }, { "==": [{ var: "vessel" }, "V"] }] },
    message_sv: "Tryckkärlssymbolen -V finns inte i magnetcylinderns nyckel (sida 625).",
    message_en: "The pressure vessel symbol -V is not part of the magnet cylinder's key (page 625).",
    goto_step: steg("vessel"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { "!=": [{ var: "magnet" }, "D"] }] },
    message_sv: "En givare kräver magnetcylindern CDS1 — välj inbyggd magnet (sida 625).",
    message_en: "An auto switch needs the CDS1 magnet cylinder — choose the built-in magnet (page 625).",
    goto_step: steg("magnet"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  for (const lead of ["", ...CS1_LEADS.map((l) => l.code)]) {
    const i = CS1_LEAD_INDEX[lead];
    const pa = CS1_SWITCHES.filter((s) => s.leads[i] === "O").map((s) => s.code);
    if (!pa.length) continue;
    rows.push({
      severity: "warn",
      if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
      message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för D-${pa.join("/")} (sida 625, ○)${lead === "" ? " — 3 m (L) är standard" : ""}.`,
      message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for D-${pa.join("/")} (page 625, ○)${lead === "" ? " — 3 m (L) is standard" : ""}.`,
      goto_step: steg("lead"),
    });
  }

  // ── rörsymbolen F: bara där aluminium är standard ─────────────────────
  const alltidStal = CS1_BORES.filter((b) => b.alu_max_mm === 0).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "tubing" }, "F"] }, { in: [{ var: "bore" }, alltidStal] }] },
    message_sv: `ø${lista(alltidStal)} har alltid stålrör — symbolen F skrivs inte (sida 620).`,
    message_en: `ø${lista(alltidStal, "and")} always has a steel tube — the symbol F is not written (page 620).`,
    goto_step: steg("tubing"),
  });
  const perAlu = new Map<number, string[]>();
  for (const b of CS1_BORES) if (b.alu_max_mm > 0) perAlu.set(b.alu_max_mm, [...(perAlu.get(b.alu_max_mm) ?? []), b.code]);
  for (const [max, bores] of perAlu) {
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "tubing" }, "F"] }, { in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, max] }] },
      message_sv: `ø${lista(bores)} över ${max} mm slag har stålrör som standard — symbolen F skrivs bara upp till ${max} mm (sida 620).`,
      message_en: `ø${lista(bores, "and")} above ${max} mm stroke has a steel tube as standard — the symbol F is written only up to ${max} mm (page 620).`,
      goto_step: steg("tubing"),
    });
  }

  // ── lufthydraul: borrning och dämpning ─────────────────────────────────
  const utanHydro = CS1_BORES.filter((b) => !b.hydro_ok).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "type" }, "H"] }, { in: [{ var: "bore" }, utanHydro] }] },
    message_sv: `Lufthydraul H finns för ø125, 140 och 160, inte ø${lista(utanHydro)} (sida 620).`,
    message_en: `The air-hydro type H exists for ø125, 140 and 160, not ø${lista(utanHydro, "and")} (page 620).`,
    goto_step: steg("type"),
  });
  const medDampsymbol = CS1_SUFFIXES.filter((x) => x.cushion).map((x) => x.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "type" }, "H"] }, { in: [{ var: "suffix" }, medDampsymbol] }] },
    message_sv: "Lufthydraulen har ingen dämpning och ingen dämpningssymbol — välj högst bälg J eller K (sida 620).",
    message_en: "The air-hydro type has no cushion and no cushion symbol — choose at most rod boot J or K (page 620).",
    goto_step: steg("suffix"),
  });

  // ── slaget: borrning × fäste × magnet ──────────────────────────────────
  const langa = CS1_MOUNTINGS.filter((m) => m.long).map((m) => m.code);
  const korta = CS1_MOUNTINGS.filter((m) => !m.long).map((m) => m.code);
  for (const magnet of [false, true]) {
    for (const long of [false, true]) {
      const perMax = new Map<number, string[]>();
      for (const b of CS1_BORES) {
        if (magnet && !b.magnet_ok) continue;
        const max = cs1MaxStroke(b, { code: "", long, label_sv: "" }, magnet);
        perMax.set(max, [...(perMax.get(max) ?? []), b.code]);
      }
      for (const [max, bores] of perMax) {
        rows.push({
          severity: "error",
          if_json: { and: [magnet ? { "==": [{ var: "magnet" }, "D"] } : { "!=": [{ var: "magnet" }, "D"] }, { in: [{ var: "mounting" }, long ? langa : korta] }, { in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, max] }] },
          message_sv: `${magnet ? "Magnetcylindern CDS1" : "CS1"} ø${lista(bores)} med fäste ${lista(long ? langa : korta, "eller")} tillverkas upp till ${max} mm slag (sida ${magnet ? "626" : "621"}).`,
          message_en: `${magnet ? "The CDS1 magnet cylinder" : "CS1"} ø${lista(bores, "and")} with mounting ${lista(long ? langa : korta, "or")} is manufactured up to ${max} mm stroke (page ${magnet ? "626" : "621"}).`,
          goto_step: steg("stroke_mm"),
        });
      }
    }
  }

  // ── tryckkärlslagen klass 2 ─────────────────────────────────────────────
  const utanKarl = CS1_BORES.filter((b) => b.vessel_over_mm === 0).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "vessel" }, "V"] }, { in: [{ var: "bore" }, utanKarl] }] },
    message_sv: `ø${lista(utanKarl)} omfattas inte av tryckkärlslagen klass 2 — -V sätts inte (sida 622).`,
    message_en: `ø${lista(utanKarl, "and")} is not subject to the Class 2 Pressure Vessel Act — -V is not put on (page 622).`,
    goto_step: steg("vessel"),
  });
  for (const b of CS1_BORES) {
    if (b.vessel_over_mm === 0) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "vessel" }, "V"] }, { "==": [{ var: "bore" }, b.code] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<=": [{ var: "stroke_mm" }, b.vessel_over_mm] }] },
      message_sv: `ø${b.bore_mm} omfattas av tryckkärlslagen först över ${b.vessel_over_mm} mm slag — -V sätts inte på kortare (sida 622).`,
      message_en: `ø${b.bore_mm} is subject to the Pressure Vessel Act only above ${b.vessel_over_mm} mm stroke — -V is not put on shorter ones (page 622).`,
      goto_step: steg("vessel"),
    });
    rows.push({
      severity: "warn",
      if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { ">": [{ var: "stroke_mm" }, b.vessel_over_mm] }, { "==": [{ var: "vessel" }, ""] }, { "!=": [{ var: "magnet" }, "D"] }] },
      message_sv: `ø${b.bore_mm} över ${b.vessel_over_mm} mm slag omfattas av Japans tryckkärlslag klass 2; för användning utanför Japan beställs cylindern med -V (sida 622).`,
      message_en: `ø${b.bore_mm} above ${b.vessel_over_mm} mm stroke is subject to Japan's Class 2 Pressure Vessel Act; for use outside Japan order the cylinder with -V (page 622).`,
      goto_step: steg("vessel"),
    });
  }

  // ── specialutföranden ──────────────────────────────────────────────────
  for (const m of CS1_MTO) {
    if (m.bores) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { in: [{ var: "bore" }, alla.filter((x) => !m.bores!.includes(x))] }] },
        message_sv: `-${m.code} finns för ø${m.bores[0]}–${m.bores[m.bores.length - 1]} (sida 618).`,
        message_en: `-${m.code} exists for ø${m.bores[0]}–${m.bores[m.bores.length - 1]} (page 618).`,
        goto_step: steg("mto"),
      });
    }
    const inte = ["", "N", "H"].filter((t) => !m.types.includes(t) && !(m.special_types ?? []).includes(t));
    if (inte.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { in: [{ var: "type" }, inte] }] },
        message_sv: `-${m.code} finns ${lista(m.types.map((t) => TYPNAMN[t][0]), "eller")}, inte ${lista(inte.map((t) => TYPNAMN[t][0]))} (sida 618).`,
        message_en: `-${m.code} exists ${lista(m.types.map((t) => TYPNAMN[t][1]), "or")}, not ${lista(inte.map((t) => TYPNAMN[t][1]))} (page 618).`,
        goto_step: steg("mto"),
      });
    }
    if (m.special_types?.length) {
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { in: [{ var: "type" }, m.special_types] }] },
        message_sv: `-${m.code} på ${lista(m.special_types.map((t) => TYPNAMN[t][0]))} är specialprodukt (○), inte listat specialutförande (sida 618).`,
        message_en: `-${m.code} on ${lista(m.special_types.map((t) => TYPNAMN[t][1]))} is a special product (○), not a listed made-to-order option (page 618).`,
        goto_step: steg("mto"),
      });
    }
    if (m.request_large_nonlube) {
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { "==": [{ var: "type" }, "N"] }, { in: [{ var: "bore" }, ["250", "300"]] }] },
        message_sv: `-${m.code} osmord ø250 och 300 levereras på begäran (sida 618, not 1).`,
        message_en: `-${m.code} non-lube ø250 and 300 are available upon request (page 618, note 1).`,
        goto_step: steg("mto"),
      });
    }
  }

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of CS1_BORES) {
    const kraft = Math.round(Math.PI * (b.bore_mm / 2) ** 2 * 0.5);
    const ror = b.alu_max_mm > 0 ? `aluminiumrör till ${b.alu_max_mm} mm, stålrör därutöver` : "stålrör";
    const rorEn = b.alu_max_mm > 0 ? `aluminium tube up to ${b.alu_max_mm} mm, steel tube beyond` : "steel tube";
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `ø${b.bore_mm}: cirka ${kraft} N plus-sidan vid 0,5 MPa (kolvarea × tryck); ${sv(CS1_LIMITS.min_pressure_mpa.air)}–${sv(CS1_LIMITS.max_pressure_mpa)} MPa; ${ror}; slag upp till ${b.max_basic_mm} mm (fot/kolvstångsfläns ${b.max_foot_mm}) (sida 620–621).`,
      message_en: `ø${b.bore_mm}: about ${kraft} N extending at 0.5 MPa (piston area × pressure); ${CS1_LIMITS.min_pressure_mpa.air}–${CS1_LIMITS.max_pressure_mpa} MPa; ${rorEn}; strokes up to ${b.max_basic_mm} mm (foot/rod flange ${b.max_foot_mm}) (pages 620–621).`,
      goto_step: steg("bore"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "type" }, "H"] },
    message_sv: `Lufthydraul: turbinolja, ${sv(CS1_LIMITS.min_pressure_mpa.hydro)}–${sv(CS1_LIMITS.max_pressure_mpa)} MPa, ${sv(CS1_LIMITS.speed_mm_s.hydro[0])}–${CS1_LIMITS.speed_mm_s.hydro[1]} mm/s, ${CS1_LIMITS.temp_c.hydro[0]}…${CS1_LIMITS.temp_c.hydro[1]} °C (sida 621).`,
    message_en: `Air-hydro: turbine oil, ${CS1_LIMITS.min_pressure_mpa.hydro}–${CS1_LIMITS.max_pressure_mpa} MPa, ${CS1_LIMITS.speed_mm_s.hydro[0]}–${CS1_LIMITS.speed_mm_s.hydro[1]} mm/s, ${CS1_LIMITS.temp_c.hydro[0]}…${CS1_LIMITS.temp_c.hydro[1]} °C (page 621).`,
    goto_step: steg("type"),
  });
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "mounting" }, ""] },
    message_sv: `Temperatur ${CS1_LIMITS.temp_c.air[0]}…${CS1_LIMITS.temp_c.air[1]} °C, hastighet ${CS1_LIMITS.speed_mm_s.air[0]}–${CS1_LIMITS.speed_mm_s.air[1]} mm/s; fotfästen beställs som två per cylinder, dubbelt gaffelfäste D har sprint och saxpinne (sida 620–621).`,
    message_en: `Temperature ${CS1_LIMITS.temp_c.air[0]}…${CS1_LIMITS.temp_c.air[1]} °C, speed ${CS1_LIMITS.speed_mm_s.air[0]}–${CS1_LIMITS.speed_mm_s.air[1]} mm/s; foot brackets are ordered two per cylinder, the double clevis D includes pin and cotter pin (pages 620–621).`,
    goto_step: steg("mounting"),
  });
  rows.push({
    severity: "info",
    if_json: { and: [{ "==": [{ var: "magnet" }, "D"] }, { in: [{ var: "bore" }, ["180", "200"]] }] },
    message_sv: "Magnetcylindern ø180/200 har aluminiumrör (hårdanodiserat) (sida 630).",
    message_en: "The ø180/200 magnet cylinder has an aluminium tube (hard anodised) (page 630).",
    goto_step: steg("magnet"),
  });

  return rows;
}

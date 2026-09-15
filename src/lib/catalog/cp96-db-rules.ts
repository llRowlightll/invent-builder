/**
 * CP96-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: dämpningskoden mot borrningen, bälg
 * på båda ändar mot dubbel kolvstång, dubbel kolvstång mot slaget, givaren
 * mot magneten, kabellängden och slaget, och specialutförandena mot
 * borrning, magnet och slag.
 */
import {
  CP96_BOOTS,
  CP96_BORES,
  CP96_DOUBLE_ROD_MAX_STROKE_MM,
  CP96_LEADS,
  CP96_LEAD_INDEX,
  CP96_LIMITS,
  CP96_MTO,
  CP96_SWITCHES,
  cp96MinStroke,
} from "./cp96";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type CP96DbRule = DsbcDbRule;

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

export function buildCp96DbRules(): CP96DbRule[] {
  const rows: CP96DbRule[] = [];
  const steg = (p: string) => `cp96-${p}`;
  const alla = CP96_BORES.map((b) => b.code);

  // ── dämpningskoden C följer borrningen ─────────────────────────────────
  const medC = CP96_BORES.filter((b) => b.cushion_c).map((b) => b.code);
  const utanC = CP96_BORES.filter((b) => !b.cushion_c).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "bore" }, medC] }, { ">": [{ var: "stroke_mm" }, 0] }, { "==": [{ var: "cushion" }, ""] }] },
    message_sv: `ø${lista(medC)} har luftdämpning i båda ändar plus gummidämpning och skrivs med C — välj dämpningen (sida 129).`,
    message_en: `ø${lista(medC, "and")} has air cushion on both ends plus bumper cushion and is written with C — select the cushion (page 129).`,
    goto_step: steg("cushion"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "bore" }, utanC] }, { "==": [{ var: "cushion" }, "C"] }] },
    message_sv: `ø${lista(utanC)} har bara luftdämpning och skrivs utan bokstav — ta bort C (sida 129).`,
    message_en: `ø${lista(utanC, "and")} has air cushion only and is written without a letter — remove C (page 129).`,
    goto_step: steg("cushion"),
  });

  // ── bälg på båda ändar kräver dubbel kolvstång; dubbel kolvstång ≤ 1000 ─
  const badaAndar = CP96_BOOTS.filter((b) => b.both_ends).map((b) => b.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "boot" }, badaAndar] }, { "!=": [{ var: "rod" }, "W"] }] },
    message_sv: `Bälg på båda ändar (${lista(badaAndar)}) förutsätter dubbel kolvstång W — enkel kolvstång har bara en ände (sida 129).`,
    message_en: `Rod boots on both ends (${lista(badaAndar, "and")}) need the double rod W — a single rod has only one end (page 129).`,
    goto_step: steg("boot"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "rod" }, "W"] }, { ">": [{ var: "stroke_mm" }, CP96_DOUBLE_ROD_MAX_STROKE_MM] }] },
    message_sv: `Dubbel kolvstång tillverkas upp till ${CP96_DOUBLE_ROD_MAX_STROKE_MM} mm slag (sida 154).`,
    message_en: `The double rod is manufactured up to ${CP96_DOUBLE_ROD_MAX_STROKE_MM} mm stroke (page 154).`,
    goto_step: steg("stroke_mm"),
  });

  // ── givaren kräver magnet; kabel och antal hör till givaren ────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { "!=": [{ var: "magnet" }, "D"] }] },
    message_sv: "En givare kräver magnetcylindern CP96SD — välj inbyggd magnet (sida 129).",
    message_en: "An auto switch needs the CP96SD magnet cylinder — choose the built-in magnet (page 129).",
    goto_step: steg("magnet"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  for (const lead of ["", ...CP96_LEADS.map((l) => l.code)]) {
    const i = CP96_LEAD_INDEX[lead];
    const pa = CP96_SWITCHES.filter((s) => s.leads[i] === "O").map((s) => s.code);
    if (!pa.length) continue;
    rows.push({
      severity: "warn",
      if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
      message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för D-${pa.join("/")} (sida 129, ○)${lead === "" ? " — 3 m (L) är standard" : ""}.`,
      message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for D-${pa.join("/")} (page 129, ○)${lead === "" ? " — 3 m (L) is standard" : ""}.`,
      goto_step: steg("lead"),
    });
  }
  // minsta slag per givare, antal och borrning (sida 144)
  const perMin = new Map<string, { koder: string[]; bores: string[]; count: string; min: number }>();
  for (const s of CP96_SWITCHES) {
    for (const count of ["", "S", "3"]) {
      for (const b of alla) {
        const min = cp96MinStroke(s, b, count);
        const nyckel = `${count}|${min}|${s.code}`;
        const grupp = perMin.get(nyckel) ?? { koder: [s.code], bores: [], count, min };
        grupp.bores.push(b);
        perMin.set(nyckel, grupp);
      }
    }
  }
  // slå ihop givare med samma (antal, min, borrningar)
  const sammanslaget = new Map<string, { koder: string[]; bores: string[]; count: string; min: number }>();
  for (const g of perMin.values()) {
    const nyckel = `${g.count}|${g.min}|${g.bores.join(",")}`;
    const e = sammanslaget.get(nyckel);
    if (e) e.koder.push(...g.koder);
    else sammanslaget.set(nyckel, { ...g, koder: [...g.koder] });
  }
  for (const g of sammanslaget.values()) {
    const antal = g.count === "3" ? ["tre givare", "three switches"] : g.count === "S" ? ["en givare", "one switch"] : ["två givare på olika sidor", "two switches on different surfaces"];
    const villkor: unknown[] = [{ in: [{ var: "switch" }, g.koder] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<": [{ var: "stroke_mm" }, g.min] }];
    villkor.push(g.count === "" ? { "==": [{ var: "count" }, ""] } : { "==": [{ var: "count" }, g.count] });
    if (g.bores.length < alla.length) villkor.push({ in: [{ var: "bore" }, g.bores] });
    rows.push({
      severity: "warn",
      if_json: { and: villkor },
      message_sv: `Minsta slag för ${antal[0]} D-${g.koder.join("/")}${g.bores.length < alla.length ? ` på ø${lista(g.bores)}` : ""} är ${g.min} mm (sida 144).`,
      message_en: `The minimum stroke for ${antal[1]} D-${g.koder.join("/")}${g.bores.length < alla.length ? ` on ø${lista(g.bores, "and")}` : ""} is ${g.min} mm (page 144).`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── slaget ─────────────────────────────────────────────────────────────
  const storsta = Math.max(...CP96_BORES.map((b) => b.max_stroke_mm));
  rows.push({
    severity: "error",
    if_json: { ">": [{ var: "stroke_mm" }, storsta] },
    message_sv: `Största slag är ${storsta} mm; längre är specialbeställning (sida 130).`,
    message_en: `The maximum stroke is ${storsta} mm; longer is a special order (page 130).`,
    goto_step: steg("stroke_mm"),
  });
  for (const b of CP96_BORES) {
    if (b.standard_strokes.length === 0) {
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { ">": [{ var: "stroke_mm" }, 0] }] },
        message_sv: `ø${b.bore_mm} har inga standardslag — varje slag tillverkas på beställning i 1 mm-steg upp till ${b.max_stroke_mm} mm (sida 130).`,
        message_en: `ø${b.bore_mm} has no standard strokes — every stroke is produced upon receipt of order in 1 mm increments up to ${b.max_stroke_mm} mm (page 130).`,
        goto_step: steg("stroke_mm"),
      });
      continue;
    }
    rows.push({
      severity: "info",
      if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { ">": [{ var: "stroke_mm" }, 0] }, { "<=": [{ var: "stroke_mm" }, b.max_stroke_mm] }, { not: { in: [{ var: "stroke_mm" }, b.standard_strokes] } }] },
      message_sv: `Standardslag för ø${b.bore_mm} är ${lista(b.standard_strokes)} mm; mellanslag i 1 mm-steg tillverkas på beställning (sida 130).`,
      message_en: `Standard strokes for ø${b.bore_mm} are ${lista(b.standard_strokes, "and")} mm; intermediate strokes in 1 mm increments are produced upon receipt of order (page 130).`,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── specialutföranden ──────────────────────────────────────────────────
  const perBores = new Map<string, string[]>();
  for (const m of CP96_MTO) if (m.bores) perBores.set(m.bores.join(","), [...(perBores.get(m.bores.join(",")) ?? []), m.code]);
  for (const [bores, koder] of perBores) {
    const b = bores.split(",");
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "mto" }, koder] }, { in: [{ var: "bore" }, alla.filter((x) => !b.includes(x))] }] },
      message_sv: `-${lista(koder)} finns för ø${b[0]}–${b[b.length - 1]} (sida 148–155).`,
      message_en: `-${lista(koder, "and")} exist for ø${b[0]}–${b[b.length - 1]} (pages 148–155).`,
      goto_step: steg("mto"),
    });
  }
  const utanMagnet = CP96_MTO.filter((m) => m.no_magnet).map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, utanMagnet] }, { "==": [{ var: "magnet" }, "D"] }] },
    message_sv: `-${lista(utanMagnet)} tillverkas i princip inte som magnetcylinder eller med givare (sida 148).`,
    message_en: `-${lista(utanMagnet, "and")} is in principle not made as a magnet cylinder or with auto switches (page 148).`,
    goto_step: steg("mto"),
  });
  const rostfri = CP96_MTO.filter((m) => m.max_single);
  const perRostMax = new Map<number, string[]>();
  for (const m of rostfri) for (const [b, max] of Object.entries(m.max_single!)) perRostMax.set(max, [...new Set([...(perRostMax.get(max) ?? []), b])]);
  for (const [max, bores] of perRostMax) {
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "mto" }, rostfri.map((m) => m.code)] }, { "!=": [{ var: "rod" }, "W"] }, { in: [{ var: "bore" }, bores] }, { ">": [{ var: "stroke_mm" }, max] }] },
      message_sv: `-${lista(rostfri.map((m) => m.code))} tillverkas upp till ${max} mm slag för ø${lista(bores)} (sida 154).`,
      message_en: `-${lista(rostfri.map((m) => m.code), "and")} are manufactured up to ${max} mm stroke for ø${lista(bores, "and")} (page 154).`,
      goto_step: steg("mto"),
    });
  }

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of CP96_BORES) {
    const kraft = Math.round(Math.PI * (b.bore_mm / 2) ** 2 * 0.5);
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "bore" }, b.code] },
      message_sv: `ø${b.bore_mm}: cirka ${kraft} N plus-sidan vid 0,5 MPa (kolvarea × tryck); port ${b.port}; ${sv(CP96_LIMITS.min_pressure_mpa)}–${sv(CP96_LIMITS.max_pressure_mpa)} MPa; ${CP96_LIMITS.min_speed_mm_s}–${b.max_speed_mm_s} mm/s (sida 130).`,
      message_en: `ø${b.bore_mm}: about ${kraft} N extending at 0.5 MPa (piston area × pressure); port ${b.port}; ${CP96_LIMITS.min_pressure_mpa}–${CP96_LIMITS.max_pressure_mpa} MPa; ${CP96_LIMITS.min_speed_mm_s}–${b.max_speed_mm_s} mm/s (page 130).`,
      goto_step: steg("bore"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "switch" }, ""] },
    message_sv: `Med givare är temperaturområdet ${CP96_LIMITS.temp_c.with_switch[0]}…${CP96_LIMITS.temp_c.with_switch[1]} °C (utan: ${CP96_LIMITS.temp_c.without_switch[0]}…${CP96_LIMITS.temp_c.without_switch[1]} °C). Givaren levereras löst (sida 129–130).`,
    message_en: `With auto switch the temperature range is ${CP96_LIMITS.temp_c.with_switch[0]}…${CP96_LIMITS.temp_c.with_switch[1]} °C (without: ${CP96_LIMITS.temp_c.without_switch[0]}…${CP96_LIMITS.temp_c.without_switch[1]} °C). The switch ships loose (pages 129–130).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "mounting" }, ""] },
    message_sv: "Fästen levereras lösa, inte monterade; dubbelt gaffelfäste D har gaffelsprint som standard, stångmutter följer alltid med (sida 129–130).",
    message_en: "Mounting brackets ship loose, not assembled; the double clevis D includes the clevis pin, a rod end nut is always included (pages 129–130).",
    goto_step: steg("mounting"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "mto" }, "XB6"] },
    message_sv: "-XB6: kolvhastighet 50–500 mm/s, fluorgummitätningar och värmebeständigt fett (sida 148).",
    message_en: "-XB6: piston speed 50–500 mm/s, fluororubber seals and heat-resistant grease (page 148).",
    goto_step: steg("mto"),
  });

  return rows;
}

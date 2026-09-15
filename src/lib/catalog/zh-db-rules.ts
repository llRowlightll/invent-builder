/**
 * ZH-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: SUP-porten mot munstycket, VAC-porten
 * mot SUP, EXH-porten (helt given av SUP och VAC) mot kroppstypen, och
 * tillbehöret mot kroppstyp och EXH.
 */
import {
  ZH_ACCESSORIES,
  ZH_LIMITS,
  ZH_NOZZLES,
  ZH_PORT_CODES,
  ZH_PORTS,
  ZH_SILENCERS,
  ZH_VACUUMS,
  zhBracket,
} from "./zh";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type ZHDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const namn = (code: string) => ZH_PORT_CODES.find((p) => p.code === code)?.label_sv ?? code;
const namnEn = (code: string) => namn(code).replace("Snabbkoppling", "One-touch").replace("Gänga", "Thread").replace(" tum", "\"");

export function buildZhDbRules(): ZHDbRule[] {
  const rows: ZHDbRule[] = [];
  const steg = (p: string) => `zh-${p}`;

  // ── SUP-porten följer munstycket, VAC-porten följer SUP (tabell 1/2) ──
  for (const n of ZH_NOZZLES) {
    const rader = ZH_PORTS[n.code];
    const sups = rader.map((r) => r.sup);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "nozzle" }, n.code] }, { "!=": [{ var: "sup" }, ""] }, { not: { in: [{ var: "sup" }, sups] } }] },
      message_sv: `ZH${n.code} har SUP-port ${lista(sups, "eller")} (tabell 1 och 2, sida 749–750).`,
      message_en: `ZH${n.code} has SUP port ${lista(sups, "or")} (tables 1 and 2, pages 749–750).`,
      goto_step: steg("sup"),
    });
    for (const r of rader) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "nozzle" }, n.code] }, { "==": [{ var: "sup" }, r.sup] }, { "!=": [{ var: "vac" }, ""] }, { not: { in: [{ var: "vac" }, r.vacs] } }] },
        message_sv: `ZH${n.code} med SUP ${r.sup} (${namn(r.sup)}) har VAC-port ${lista(r.vacs, "eller")} (tabell 1 och 2).`,
        message_en: `ZH${n.code} with SUP ${r.sup} (${namnEn(r.sup)}) has VAC port ${lista(r.vacs, "or")} (tables 1 and 2).`,
        goto_step: steg("vac"),
      });
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "body" }, "D"] }, { "==": [{ var: "nozzle" }, n.code] }, { "==": [{ var: "sup" }, r.sup] }, { in: [{ var: "vac" }, r.vacs] }, { "!=": [{ var: "exh" }, r.exh] }] },
        message_sv: `Kroppsmonterad ZH${n.code}D med SUP ${r.sup} har EXH-port ${r.exh} (${namn(r.exh)}) — välj den (tabell 1, sida 749).`,
        message_en: `Body ported ZH${n.code}D with SUP ${r.sup} has EXH port ${r.exh} (${namnEn(r.exh)}) — select it (table 1, page 749).`,
        goto_step: steg("exh"),
      });
    }
  }

  // ── boxtypen har varken EXH-position eller tillbehör ────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "body" }, "B"] }, { "!=": [{ var: "exh" }, ""] }] },
    message_sv: "Boxtypen B har inbyggd ljuddämpare och ingen EXH-port i koden (sida 750) — ta bort EXH-valet.",
    message_en: "The box type B has a built-in silencer and no EXH port in the code (page 750) — remove the EXH selection.",
    goto_step: steg("exh"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "body" }, "B"] }, { "!=": [{ var: "accessory" }, ""] }] },
    message_sv: "Tillbehörskoden (N/S/NS) finns bara för den kroppsmonterade typen D (sida 749).",
    message_en: "The accessory symbol (N/S/NS) exists for the body ported type D only (page 749).",
    goto_step: steg("accessory"),
  });

  // ── ljuddämparen kräver EXH som snabbkoppling, och finns inte för tum 13 ─
  const medDampare = ZH_ACCESSORIES.filter((a) => a.silencer).map((a) => a.code);
  const gangor = ZH_PORT_CODES.filter((p) => p.kind === "thread").map((p) => p.code);
  const utanDampare = ZH_PORT_CODES.filter((p) => p.kind === "one-touch" && !ZH_SILENCERS[p.code]).map((p) => p.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "accessory" }, medDampare] }, { in: [{ var: "exh" }, gangor] }] },
    message_sv: `Tillbehör ${lista(medDampare)} (ljuddämpare) finns inte med EXH-port i gänga — bara med snabbkoppling (sida 749, not 3).`,
    message_en: `Accessories ${lista(medDampare, "and")} (silencer) are not available with a screw-in EXH port — One-touch fitting only (page 749, note 3).`,
    goto_step: steg("accessory"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "accessory" }, medDampare] }, { in: [{ var: "exh" }, utanDampare] }] },
    message_sv: `Ingen ljuddämpare finns för EXH-port ${lista(utanDampare)} (ø1/2 tum, ZH18/20) — välj gängad anslutning och beställ AN30-N03/AN40-N04 separat (sida 749).`,
    message_en: `No silencer exists for EXH port ${lista(utanDampare, "and")} (ø1/2", ZH18/20) — choose the screw-in connection and order AN30-N03/AN40-N04 separately (page 749).`,
    goto_step: steg("accessory"),
  });

  // ── råd ────────────────────────────────────────────────────────────────
  for (const n of ZH_NOZZLES) {
    for (const body of ["D", "B"] as const) {
      for (const v of ZH_VACUUMS) {
        const vak = n.vacuum[body][v.code as "S" | "L"];
        const flode = v.code === "S" ? n.flow_s : n.flow_l;
        rows.push({
          severity: "info",
          if_json: { and: [{ "==": [{ var: "nozzle" }, n.code] }, { "==": [{ var: "body" }, body] }, { "==": [{ var: "vacuum" }, v.code] }] },
          message_sv: `ZH${n.code}${body}${v.code}A: vakuum ${vak} kPa, sugflöde ${flode} l/min, luftförbrukning ${n.air} l/min vid ${sv(ZH_LIMITS.standard_pressure_mpa)} MPa (sida 752). Matningsventilen behöver C ≥ ${sv(n.valve_c)} dm³/(s·bar) (sida 767).`,
          message_en: `ZH${n.code}${body}${v.code}A: vacuum ${vak} kPa, suction flow ${flode} l/min, air consumption ${n.air} l/min at ${ZH_LIMITS.standard_pressure_mpa} MPa (page 752). The supply valve needs C ≥ ${n.valve_c} dm³/(s·bar) (page 767).`,
          goto_step: steg("vacuum"),
        });
      }
    }
  }
  for (const n of ZH_NOZZLES) {
    rows.push({
      severity: "info",
      if_json: { and: [{ "==": [{ var: "nozzle" }, n.code] }, { "==": [{ var: "body" }, "D"] }, { "==": [{ var: "accessory" }, ""] }, { "!=": [{ var: "exh" }, ""] }] },
      message_sv: `Utan tillbehörskod följer standardfästet ${zhBracket(n.code)} med, löst i förpackningen (sida 749).`,
      message_en: `Without an accessory symbol the standard bracket ${zhBracket(n.code)} is included, loose in the package (page 749).`,
      goto_step: steg("accessory"),
    });
  }
  for (const [exh, art] of Object.entries(ZH_SILENCERS)) {
    rows.push({
      severity: "info",
      if_json: { and: [{ in: [{ var: "accessory" }, medDampare] }, { "==": [{ var: "exh" }, exh] }] },
      message_sv: `Ljuddämparen för EXH ${exh} är ${art}; den levereras lös och sätts i snabbkopplingen (sida 749).`,
      message_en: `The silencer for EXH ${exh} is ${art}; it ships loose and plugs into the One-touch fitting (page 749).`,
      goto_step: steg("accessory"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "body" }, "B"] },
    message_sv: "Boxtypen: håll minst två av de fyra utblåsriktningarna fria, annars sjunker vakuumet av mottrycket (sida 767).",
    message_en: "Box type: keep at least two of the four exhaust directions open, or back pressure reduces the vacuum (page 767).",
    goto_step: steg("body"),
  });
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "nozzle" }, ""] },
    message_sv: `Matningstryck ${sv(ZH_LIMITS.pressure_mpa[0])}–${sv(ZH_LIMITS.pressure_mpa[1])} MPa (standard ${sv(ZH_LIMITS.standard_pressure_mpa)}), ${ZH_LIMITS.temp_c[0]}…${ZH_LIMITS.temp_c[1]} °C; sugfilter (ZFA/ZFB/ZFC) på vakuumsidan rekommenderas (sida 752 och 767).`,
    message_en: `Supply pressure ${ZH_LIMITS.pressure_mpa[0]}–${ZH_LIMITS.pressure_mpa[1]} MPa (standard ${ZH_LIMITS.standard_pressure_mpa}), ${ZH_LIMITS.temp_c[0]}…${ZH_LIMITS.temp_c[1]} °C; a suction filter (ZFA/ZFB/ZFC) on the vacuum side is recommended (pages 752 and 767).`,
    goto_step: steg("nozzle"),
  });
  const trangaSkruv = ["N03", "04", "F04", "N04"];
  rows.push({
    severity: "warn",
    if_json: { and: [{ in: [{ var: "nozzle" }, ["15", "18", "20"]] }, { in: [{ var: "vac" }, trangaSkruv] }] },
    message_sv: "ZH15–20 med gängad VAC-port N03/04/F04/N04 kan inte monteras tätt intill varandra (nyckelvidden tar i) och behöver distans vid montage i kroppens hål (sida 758–759 och 767).",
    message_en: "ZH15–20 with threaded VAC port N03/04/F04/N04 cannot be mounted closely side by side (the flats interfere) and need a spacer when mounted through the body holes (pages 758–759 and 767).",
    goto_step: steg("vac"),
  });
  return rows;
}

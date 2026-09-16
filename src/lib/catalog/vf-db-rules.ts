/**
 * VF-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: funktionen, kroppsmodellen,
 * avluftningen, portstorleken och fästet mot serien; spolen T mot
 * spänning och ljus/spärrdiod; ljus/spärrdiod mot AC och mot DIN utan
 * kontaktdon; gängan mot porten; X500/X600 mot kropp, avluftning, spole
 * och spänning. Resten är råd ur datasidorna.
 */
import {
  VF_ACTUATIONS,
  VF_BODIES,
  VF_BODY_OPTS,
  VF_BRACKET,
  VF_COIL,
  VF_ENTRIES,
  VF_LIGHTS,
  VF_LIMITS,
  VF_MTO,
  VF_PORTS,
  VF_PRESSURE,
  VF_SERIES,
  VF_THREADS,
  VF_VOLTAGES,
} from "./vf";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type VFDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const namn = (s: { code: string }) => `VF${s.code}000`;

export function buildVfDbRules(): VFDbRule[] {
  const rows: VFDbRule[] = [];
  const steg = (p: string) => `vf3000-${p}`;
  const ac = VF_VOLTAGES.filter((v) => v.ac).map((v) => v.code);
  const dc = VF_VOLTAGES.filter((v) => !v.ac).map((v) => v.code);
  const dinUtan = VF_ENTRIES.filter((x) => x.kind === "din" && x.no_connector).map((x) => x.code);
  const inteDin = VF_ENTRIES.filter((x) => x.kind !== "din" && x.kind !== "conduit").map((x) => x.code);
  const kroppsportad = VF_BODIES.filter((b) => b.code !== "4").map((b) => b.code);

  // ── serien mot funktion, kropp, avluftning ─────────────────────────────
  const utan3 = VF_SERIES.filter((s) => !s.three_pos).map((s) => s.code);
  const treLagen = VF_ACTUATIONS.filter((a) => a.three_pos).map((a) => a.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "series" }, utan3] }, { in: [{ var: "actuation" }, treLagen] }] },
    message_sv: `${lista(utan3.map((k) => `VF${k}000`))} finns bara 2-läges (1 och 2), inte 3-läges ${lista(treLagen)} (sida 292).`,
    message_en: `${lista(utan3.map((k) => `VF${k}000`), "and")} exists only 2-position (1 and 2), not 3-position ${lista(treLagen, "and")} (page 292).`,
    goto_step: steg("actuation"),
  });
  for (const b of VF_BODIES) {
    const ok = VF_SERIES.filter((s) => (b.code === "4" ? s.base_ok : s.body_ported === b.code)).map((s) => s.code);
    const fel = VF_SERIES.map((s) => s.code).filter((k) => !ok.includes(k));
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "body" }, b.code] }, { in: [{ var: "series" }, fel] }] },
      message_sv: `Kroppsmodell ${b.code} (${b.code === "4" ? "basmonterad" : "kroppsportad"}) gäller ${lista(ok.map((k) => `VF${k}000`))}, inte ${lista(fel.map((k) => `VF${k}000`))} (sida 292 och 306).`,
      message_en: `Body model ${b.code} (${b.code === "4" ? "base mounted" : "body ported"}) applies to ${lista(ok.map((k) => `VF${k}000`), "and")}, not ${lista(fel.map((k) => `VF${k}000`), "and")} (pages 292 and 306).`,
      goto_step: steg("body"),
    });
  }
  const utanGemensam = VF_SERIES.filter((s) => !s.common_exhaust).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "body_opt" }, "3"] }, { in: [{ var: "series" }, utanGemensam] }] },
    message_sv: `Gemensam avluftning 3 finns inte för ${lista(utanGemensam.map((k) => `VF${k}000`))} — bara separat pilotavluftning 0 (sida 292).`,
    message_en: `The common exhaust 3 does not exist for ${lista(utanGemensam.map((k) => `VF${k}000`), "and")} — only the individual pilot exhaust 0 (page 292).`,
    goto_step: steg("body_opt"),
  });

  // ── spolen T ───────────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "coil" }, VF_COIL.code] }, { in: [{ var: "voltage" }, ac] }] },
    message_sv: "Den strömsparande kretsen T finns bara för DC (24 eller 12 V DC), inte AC (sida 292).",
    message_en: "The power saving circuit T exists only for DC (24 or 12 V DC), not AC (page 292).",
    goto_step: steg("coil"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "coil" }, VF_COIL.code] }, { not: { in: [{ var: "entry" }, dinUtan] } }, { "!=": [{ var: "light" }, "Z"] }] },
    message_sv: "Med den strömsparande kretsen T är bara ljus/spärrdiod Z möjlig (sida 292, coil specifications).",
    message_en: "With the power saving circuit T only the light/surge voltage suppressor Z is available (page 292, coil specifications).",
    goto_step: steg("light"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "coil" }, VF_COIL.code] }, { in: [{ var: "entry" }, dinUtan] }, { "!=": [{ var: "light" }, "S"] }] },
    message_sv: `Med T och DIN utan kontaktdon (${dinUtan.join("/")}) finns bara ${dinUtan.map((k) => `${k}S`).join(" och ")} (sida 292, coil specifications).`,
    message_en: `With T and the DIN terminal without connector (${dinUtan.join("/")}) only ${dinUtan.map((k) => `${k}S`).join(" and ")} are available (page 292, coil specifications).`,
    goto_step: steg("light"),
  });

  // ── ljus/spärrdiod mot spänning och anslutning ─────────────────────────
  const baraDc = VF_LIGHTS.filter((l) => !l.ac).map((l) => l.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "light" }, baraDc] }, { in: [{ var: "voltage" }, ac] }] },
    message_sv: `Ljus/spärrdiod ${lista(baraDc)} finns inte för AC — likriktaren hindrar överspänningen; välj Z eller inget (sida 292, tabellen och noten).`,
    message_en: `Light/surge voltage suppressor ${lista(baraDc, "and")} does not exist for AC — the rectifier prevents surge voltage; choose Z or none (page 292, table and note).`,
    goto_step: steg("light"),
  });
  const medLjus = VF_LIGHTS.filter((l) => l.light).map((l) => l.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "light" }, medLjus] }, { in: [{ var: "entry" }, dinUtan] }] },
    message_sv: `DIN utan kontaktdon har ljuset i kontaktdonet: ${dinUtan.map((k) => medLjus.map((l) => k + l).join("/")).join(" och ")} finns inte (sida 292).`,
    message_en: `The DIN terminal without connector has the light in the connector: ${dinUtan.map((k) => medLjus.map((l) => k + l).join("/")).join(" and ")} are not available (page 292).`,
    goto_step: steg("light"),
  });
  const ceDin = VF_VOLTAGES.filter((v) => v.ce_din_only).map((v) => v.code);
  rows.push({
    severity: "warn",
    if_json: { and: [{ in: [{ var: "voltage" }, ceDin] }, { in: [{ var: "entry" }, inteDin] }] },
    message_sv: "AC-ventilen är CE/UKCA-märkt bara med DIN- eller rörgängeanslutning (D, DO, Y, YO, T); grommet och plugg går att beställa men utan märkningen. 24 V AC (B) är märkt med alla anslutningar (sida 292, not 2).",
    message_en: "The AC valve is CE/UKCA marked only with the DIN or conduit terminal (D, DO, Y, YO, T); grommet and plug connectors can be ordered but without the marking. 24 V AC (B) is marked with all entries (page 292, note 2).",
    goto_step: steg("entry"),
  });

  // ── porten, gängan, fästet ─────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "body" }, kroppsportad] }, { "==": [{ var: "port" }, ""] }] },
    message_sv: "Den kroppsportade ventilen beställs med portstorlek (sida 292); bara den basmonterade kan beställas utan underplatta.",
    message_en: "The body ported valve is ordered with a port size (page 292); only the base mounted valve can be ordered without a sub-plate.",
    goto_step: steg("port"),
  });
  for (const p of VF_PORTS) {
    const kropp = VF_SERIES.filter((s) => s.ports_body.includes(p.code)).map((s) => s.code);
    const felKropp = VF_SERIES.map((s) => s.code).filter((k) => !kropp.includes(k));
    if (felKropp.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "port" }, p.code] }, { in: [{ var: "body" }, kroppsportad] }, { in: [{ var: "series" }, felKropp] }] },
        message_sv: kropp.length
          ? `Port ${p.size} kroppsportad finns för ${lista(kropp.map((k) => `VF${k}000`))}, inte ${lista(felKropp.map((k) => `VF${k}000`))} (sida 292, A/B port size).`
          : `Port ${p.size} finns bara som underplatta till den basmonterade ventilen (sida 306).`,
        message_en: kropp.length
          ? `Port ${p.size} body ported exists for ${lista(kropp.map((k) => `VF${k}000`), "and")}, not ${lista(felKropp.map((k) => `VF${k}000`), "and")} (page 292, A/B port size).`
          : `Port ${p.size} exists only as a sub-plate for the base mounted valve (page 306).`,
        goto_step: steg("port"),
      });
    }
    const bas = VF_SERIES.filter((s) => s.ports_base.includes(p.code)).map((s) => s.code);
    const felBas = VF_SERIES.filter((s) => s.base_ok).map((s) => s.code).filter((k) => !bas.includes(k));
    if (felBas.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "port" }, p.code] }, { "==": [{ var: "body" }, "4"] }, { in: [{ var: "series" }, felBas] }] },
        message_sv: bas.length
          ? `Underplatta ${p.size} finns för ${lista(bas.map((k) => `VF${k}000`))}, inte ${lista(felBas.map((k) => `VF${k}000`))} (sida 306).`
          : `Underplatta ${p.size} finns inte — basmonterad beställs med 1/4, 3/8 eller 1/2 (VF5000) eller utan underplatta (sida 306).`,
        message_en: bas.length
          ? `The sub-plate ${p.size} exists for ${lista(bas.map((k) => `VF${k}000`), "and")}, not ${lista(felBas.map((k) => `VF${k}000`), "and")} (page 306).`
          : `The sub-plate ${p.size} does not exist — base mounted is ordered with 1/4, 3/8 or 1/2 (VF5000) or without a sub-plate (page 306).`,
        goto_step: steg("port"),
      });
    }
  }
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "thread" }, ""] }, { "==": [{ var: "port" }, "M5"] }] },
    message_sv: "M5 finns bara i Rc-utförandet (ingen gängbokstav) (sida 292).",
    message_en: "M5 is available with the Rc version only (no thread letter) (page 292).",
    goto_step: steg("thread"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "thread" }, ""] }, { "==": [{ var: "port" }, ""] }] },
    message_sv: "Gängtypen hör till underplattan — utan underplatta anges ingen gänga (sida 306).",
    message_en: "The thread type belongs to the sub-plate — without a sub-plate no thread is specified (page 306).",
    goto_step: steg("thread"),
  });
  const utanFaste = VF_SERIES.filter((s) => !s.bracket_ok).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "bracket" }, VF_BRACKET.code] }, { or: [{ "==": [{ var: "body" }, "4"] }, { in: [{ var: "series" }, utanFaste] }] }] },
    message_sv: `Fästet F finns bara för den kroppsportade VF1000/VF3000, inte ${lista(utanFaste.map((k) => `VF${k}000`))} eller basmonterad (sida 292).`,
    message_en: `The bracket F exists only for the body ported VF1000/VF3000, not ${lista(utanFaste.map((k) => `VF${k}000`), "and")} or base mounted (page 292).`,
    goto_step: steg("bracket"),
  });

  // ── specialutföranden ──────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mto" }, "X500"] }, { or: [{ "==": [{ var: "body" }, "4"] }, { "!=": [{ var: "body_opt" }, "0"] }] }] },
    message_sv: "-X500 (pilotavluftning med rörgänga M3) finns bara kroppsportad med separat pilotavluftning 0 (sida 305).",
    message_en: "-X500 (pilot exhaust port with piping thread M3) exists only body ported with the individual pilot exhaust 0 (page 305).",
    goto_step: steg("mto"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "mto" }, VF_MTO.map((x) => x.code)] }, { "==": [{ var: "coil" }, VF_COIL.code] }] },
    message_sv: "-X500 och -X600 går inte att kombinera med den strömsparande kretsen T (sida 305).",
    message_en: "-X500 and -X600 cannot be combined with the power saving circuit T (page 305).",
    goto_step: steg("mto"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mto" }, "X600"] }, { in: [{ var: "voltage" }, dc] }] },
    message_sv: "-X600 (TRIAC-utgång) finns bara för AC-spänning (sida 305).",
    message_en: "-X600 (TRIAC output) exists only for AC voltage (page 305).",
    goto_step: steg("mto"),
  });

  // ── varningar och råd ──────────────────────────────────────────────────
  const ip65 = VF_ENTRIES.filter((x) => x.ip65).map((x) => x.code);
  const medGemensam = VF_SERIES.filter((s) => s.common_exhaust).map((s) => s.code);
  rows.push({
    severity: "warn",
    if_json: { and: [{ in: [{ var: "entry" }, ip65] }, { "==": [{ var: "body_opt" }, "0"] }, { in: [{ var: "series" }, medGemensam] }] },
    message_sv: "IP65 kräver gemensam avluftning för huvud- och pilotventil (3) tillsammans med DIN- eller rörgängeanslutningen (sida 292, not 1; sida 293).",
    message_en: "IP65 requires the main/pilot valve common exhaust (3) together with the DIN or conduit terminal (page 292, note 1; page 293).",
    goto_step: steg("body_opt"),
  });
  rows.push({
    severity: "warn",
    if_json: { and: [{ in: [{ var: "voltage" }, dc] }, { "==": [{ var: "coil" }, ""] }] },
    message_sv: `Vid långvarig kontinuerlig spänningssättning ska den strömsparande kretsen T väljas (${sv(VF_LIMITS.power_w_saving)} W hållning i stället för ${sv(VF_LIMITS.power_w_dc)} W) (sida 292, not; sida 342).`,
    message_en: `For long continuous energising choose the power saving circuit T (${VF_LIMITS.power_w_saving} W holding instead of ${VF_LIMITS.power_w_dc} W) (page 292, note; page 342).`,
    goto_step: steg("coil"),
  });
  const inteUl = VF_VOLTAGES.filter((v) => !v.ul).map((v) => v.code);
  rows.push({
    severity: "info",
    if_json: { or: [{ in: [{ var: "voltage" }, inteUl] }, { "==": [{ var: "pressure" }, VF_PRESSURE.code] }, { in: [{ var: "mto" }, VF_MTO.filter((x) => !x.ul).map((x) => x.code)] }] },
    message_sv: "UL-listningen gäller bara 0,7 MPa, DC eller 24 V AC och -X500; högtryckstypen K, övriga AC-spänningar och -X600 är inte UL-listade (sida 292 och 305).",
    message_en: "The UL listing applies only to 0.7 MPa, DC or 24 V AC and -X500; the high-pressure type K, the other AC voltages and -X600 are not UL listed (pages 292 and 305).",
    goto_step: steg("voltage"),
  });
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "light" }, ""] },
    message_sv: "Med spärrdiod finns en restspänning kvar över spolen (sida 292, caution; sida 342). S och Z är polära — anslut + och − enligt märkningen; R och U är opolära.",
    message_en: "With a surge voltage suppressor a residual voltage remains across the coil (page 292, caution; page 342). S and Z are polar — connect + and − as marked; R and U are non-polar.",
    goto_step: steg("light"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "entry" }, VF_ENTRIES.filter((x) => x.kind === "plug" && x.no_connector).map((x) => x.code)] },
    message_sv: "Utan kontakt: kontaktsatsen beställs separat, V200-30-4A-□ (DC), -1A-□ (100 V AC), -2A-□ (200 V AC), -3A-□ (övriga AC) med kabellängd Nil 300, 6, 10, 15, 20, 25, 30 eller 50 (×100 mm) (sida 340).",
    message_en: "Without connector: order the connector assembly separately, V200-30-4A-□ (DC), -1A-□ (100 V AC), -2A-□ (200 V AC), -3A-□ (other AC) with lead wire length Nil 300, 6, 10, 15, 20, 25, 30 or 50 (×100 mm) (page 340).",
    goto_step: steg("entry"),
  });
  for (const s of VF_SERIES) {
    for (const a of VF_ACTUATIONS) {
      if (a.three_pos && !s.three_pos) continue;
      const f = a.three_pos ? s.freq_hz[1]! : s.freq_hz[0];
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { "==": [{ var: "actuation" }, a.code] }] },
        message_sv: `${namn(s)} funktion ${a.code}: arbetstryck ${sv(a.pressure[0])}–${sv(a.pressure[1])} MPa (högtryckstyp K ${sv(a.pressure_k[0])}–${sv(a.pressure_k[1])} MPa), högst ${f} Hz, ${VF_LIMITS.temp_c[0]}…${VF_LIMITS.temp_c[1]} °C, smörjfri, valfritt monteringsläge, ${VF_LIMITS.impact_vibration} stöt/vibration; effekt ${sv(VF_LIMITS.power_w_dc)} W DC (sida 293).`,
        message_en: `${namn(s)} actuation ${a.code}: operating pressure ${a.pressure[0]}–${a.pressure[1]} MPa (high-pressure type K ${a.pressure_k[0]}–${a.pressure_k[1]} MPa), max ${f} Hz, ${VF_LIMITS.temp_c[0]}…${VF_LIMITS.temp_c[1]} °C, no lubrication, any mounting orientation, ${VF_LIMITS.impact_vibration} impact/vibration; power ${VF_LIMITS.power_w_dc} W DC (page 293).`,
        goto_step: steg("actuation"),
      });
    }
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "body" }, "4"] },
    message_sv: "Basmonterad: utan underplatta (ingen portkod) medföljer två monteringsskruvar; underplattans gänga anges med gängbokstaven (sida 306).",
    message_en: "Base mounted: without a sub-plate (no port code) two mounting screws are included; the sub-plate thread is given by the thread letter (page 306).",
    goto_step: steg("port"),
  });
  return rows;
}

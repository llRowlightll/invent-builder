/**
 * SY-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: funktionen A/B/C mot -X701 och serien;
 * -X20 mot kropp och serie; extern pilot R mot kropp, DIN och -X701; spolen T
 * mot spänning, anslutning och ljus; anslutningen mot spänningen (M8 bara DC,
 * DIN bara 24/12 V DC, SY3000 DIN inte på underplatta); ljus/spärrdiod mot
 * AC och DIN; porten och gängan mot serie, kropp och -X701; fästet mot
 * kropp, serie och funktion; CE Q mot AC och anslutning.
 */
import {
  SY_ACTUATIONS,
  SY_BRACKETS,
  SY_CE,
  SY_COIL,
  SY_ENTRIES,
  SY_LIGHTS,
  SY_LIMITS,
  SY_PILOT,
  SY_PORTS,
  SY_SERIES,
  SY_THREADS,
  SY_VOLTAGES,
  syBodyPorts,
} from "./sy";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type SYDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const namn = (k: string) => `SY${k}000`;

export function buildSyDbRules(): SYDbRule[] {
  const rows: SYDbRule[] = [];
  const steg = (p: string) => `sy3000-${p}`;
  const ac = SY_VOLTAGES.filter((v) => v.ac).map((v) => v.code);
  const lowDc = SY_VOLTAGES.filter((v) => v.low_dc).map((v) => v.code);
  const din = SY_ENTRIES.filter((x) => x.kind === "din").map((x) => x.code);
  const dinUtan = SY_ENTRIES.filter((x) => x.kind === "din" && x.no_connector).map((x) => x.code);
  const m8 = SY_ENTRIES.filter((x) => x.kind === "m8").map((x) => x.code);
  const inteDin = SY_ENTRIES.filter((x) => x.kind !== "din").map((x) => x.code);
  const dual = SY_ACTUATIONS.filter((a) => a.dual).map((a) => a.code);
  const vanliga = SY_ACTUATIONS.filter((a) => !a.dual).map((a) => a.code);

  // ── -X701, -X20 ─────────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "actuation" }, dual] }, { "!=": [{ var: "mto" }, "X701"] }] },
    message_sv: `De dubbla 3-portsventilerna ${lista(dual)} beställs som specialutförandet -X701 (sida 942-1).`,
    message_en: `The dual 3-port valves ${lista(dual, "and")} are ordered as the made-to-order -X701 (page 942-1).`,
    goto_step: steg("mto"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mto" }, "X701"] }, { in: [{ var: "actuation" }, vanliga] }] },
    message_sv: `-X701 är den dubbla 3-portsventilen — välj funktion ${lista(dual, "eller")} (sida 942-1).`,
    message_en: `-X701 is the dual 3-port valve — choose the actuation ${lista(dual, "or")} (page 942-1).`,
    goto_step: steg("actuation"),
  });
  const utanX701 = SY_SERIES.filter((s) => !s.x701_ok).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mto" }, "X701"] }, { in: [{ var: "series" }, utanX701] }] },
    message_sv: `-X701 finns bara för SY5000 och SY7000, inte ${lista(utanX701.map(namn))} (sida 732, 748 och 942-1).`,
    message_en: `-X701 exists only for SY5000 and SY7000, not ${lista(utanX701.map(namn), "and")} (pages 732, 748 and 942-1).`,
    goto_step: steg("mto"),
  });
  const utanX20 = SY_SERIES.filter((s) => !s.x20_ok).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mto" }, "X20"] }, { or: [{ "==": [{ var: "body" }, "40"] }, { in: [{ var: "series" }, utanX20] }] }] },
    message_sv: `-X20 (extern pilot) finns bara kroppsportad och inte för ${lista(utanX20.map(namn))}; basmonterad får extern pilot med R (sida 942).`,
    message_en: `-X20 (external pilot) exists only body ported and not for ${lista(utanX20.map(namn), "and")}; the base mounted valve gets the external pilot with R (page 942).`,
    goto_step: steg("mto"),
  });

  // ── extern pilot R ─────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "pilot" }, SY_PILOT.code] }, { or: [{ "==": [{ var: "body" }, "20"] }, { "==": [{ var: "mto" }, "X701"] }] }] },
    message_sv: "Extern pilot R finns bara för den basmonterade ventilen och inte med -X701 (sida 748 och 942-1); kroppsportad extern pilot beställs som -X20.",
    message_en: "The external pilot R exists only for the base mounted valve and not with -X701 (pages 748 and 942-1); the body ported external pilot is ordered as -X20.",
    goto_step: steg("pilot"),
  });
  const dinEjPlatta = SY_SERIES.filter((s) => s.din_no_subplate).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "pilot" }, SY_PILOT.code] }, { in: [{ var: "series" }, dinEjPlatta] }, { in: [{ var: "entry" }, din] }] },
    message_sv: `Extern pilot R finns inte för ${lista(dinEjPlatta.map(namn))} med DIN-kontakt (sida 748).`,
    message_en: `The external pilot R is not available for ${lista(dinEjPlatta.map(namn), "and")} with the DIN terminal (page 748).`,
    goto_step: steg("pilot"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "body" }, "40"] }, { in: [{ var: "series" }, dinEjPlatta] }, { in: [{ var: "entry" }, din] }, { "!=": [{ var: "port" }, ""] }] },
    message_sv: `DIN-kontakten på ${lista(dinEjPlatta.map(namn))} kan inte monteras på standardunderplattan — beställ utan underplatta (sida 748 och 958).`,
    message_en: `The DIN terminal of ${lista(dinEjPlatta.map(namn), "and")} cannot be mounted on the standard sub-plate — order without a sub-plate (pages 748 and 958).`,
    goto_step: steg("port"),
  });

  // ── spolen T ───────────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "coil" }, SY_COIL.code] }, { in: [{ var: "voltage" }, [...ac, ...lowDc]] }] },
    message_sv: "Den strömsparande kretsen T finns bara för 24 och 12 V DC (sida 732).",
    message_en: "The power saving circuit T exists only for 24 and 12 V DC (page 732).",
    goto_step: steg("coil"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "coil" }, SY_COIL.code] }, { in: [{ var: "entry" }, [...din, ...m8]] }] },
    message_sv: "Den strömsparande kretsen T finns inte med DIN-kontakt (D, DO, Y, YO) eller M8-kontakt (W) (sida 732 och 733).",
    message_en: "The power saving circuit T is not available with the DIN terminal (D, DO, Y, YO) or the M8 connector (W) (pages 732 and 733).",
    goto_step: steg("coil"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "coil" }, SY_COIL.code] }, { "!=": [{ var: "light" }, "Z"] }] },
    message_sv: "Den strömsparande kretsen T finns bara med ljus/spärrdiod Z (sida 732).",
    message_en: "The power saving circuit T is only available with the light/surge voltage suppressor Z (page 732).",
    goto_step: steg("light"),
  });

  // ── anslutning mot spänning ────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "entry" }, m8] }, { in: [{ var: "voltage" }, ac] }] },
    message_sv: "M8-kontakten (W) finns bara för DC (sida 732).",
    message_en: "The M8 connector (W) is available for DC only (page 732).",
    goto_step: steg("entry"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "entry" }, din] }, { in: [{ var: "voltage" }, lowDc] }] },
    message_sv: `DIN-kontakten (D, DO, Y, YO) finns för DC bara med 24 och 12 V, inte ${lista(lowDc.map((k) => SY_VOLTAGES.find((v) => v.code === k)!.label_sv.split(" (")[0]))} (sida 732).`,
    message_en: `The DIN terminal (D, DO, Y, YO) is available for DC only with 24 and 12 V, not ${lista(lowDc.map((k) => SY_VOLTAGES.find((v) => v.code === k)!.label_sv.split(" (")[0]), "and")} (page 732).`,
    goto_step: steg("voltage"),
  });

  // ── ljus/spärrdiod ─────────────────────────────────────────────────────
  const baraDc = SY_LIGHTS.filter((l) => !l.ac).map((l) => l.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "light" }, baraDc] }, { in: [{ var: "voltage" }, ac] }] },
    message_sv: `Ljus/spärrdiod ${lista(baraDc)} finns inte för AC — S är inbyggd i likriktaren, R och U är bara DC; välj Z eller inget (sida 732).`,
    message_en: `Light/surge voltage suppressor ${lista(baraDc, "and")} does not exist for AC — S is built into the rectifier, R and U are DC only; choose Z or none (page 732).`,
    goto_step: steg("light"),
  });
  const inteDinLjus = SY_LIGHTS.filter((l) => !l.din_ok).map((l) => l.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "light" }, inteDinLjus] }, { in: [{ var: "entry" }, din] }] },
    message_sv: `Med DIN-kontakt finns bara S och Z (opolära), inte ${lista(inteDinLjus)} (sida 732).`,
    message_en: `With the DIN terminal only S and Z (non-polar) exist, not ${lista(inteDinLjus, "and")} (page 732).`,
    goto_step: steg("light"),
  });
  const medLjus = SY_LIGHTS.filter((l) => l.light && l.din_ok).map((l) => l.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "light" }, medLjus] }, { in: [{ var: "entry" }, dinUtan] }] },
    message_sv: `DIN utan kontaktdon har ljuset i kontaktdonet: ${dinUtan.map((k) => k + medLjus.join("")).join(" och ")} finns inte (sida 732).`,
    message_en: `The DIN terminal without connector has the light in the connector: ${dinUtan.map((k) => k + medLjus.join("")).join(" and ")} are not available (page 732).`,
    goto_step: steg("light"),
  });

  // ── porten, gängan, fästet ─────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "body" }, "20"] }, { "==": [{ var: "port" }, ""] }] },
    message_sv: "Den kroppsportade ventilen beställs med portstorlek (sida 732); bara den basmonterade kan beställas utan underplatta.",
    message_en: "The body ported valve is ordered with a port size (page 732); only the base mounted valve can be ordered without a sub-plate.",
    goto_step: steg("port"),
  });
  for (const p of SY_PORTS) {
    const kropp = SY_SERIES.filter((s) => syBodyPorts(s).includes(p.code)).map((s) => s.code);
    const felKropp = SY_SERIES.map((s) => s.code).filter((k) => !kropp.includes(k));
    if (felKropp.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "port" }, p.code] }, { "==": [{ var: "body" }, "20"] }, { in: [{ var: "series" }, felKropp] }] },
        message_sv: kropp.length
          ? `Port ${p.size} kroppsportad finns för ${lista(kropp.map(namn))}, inte ${lista(felKropp.map(namn))} (sida 732, A/B port size).`
          : `Port ${p.size} finns bara som underplatta till den basmonterade ventilen (sida 748).`,
        message_en: kropp.length
          ? `Port ${p.size} body ported exists for ${lista(kropp.map(namn), "and")}, not ${lista(felKropp.map(namn), "and")} (page 732, A/B port size).`
          : `Port ${p.size} exists only as a sub-plate for the base mounted valve (page 748).`,
        goto_step: steg("port"),
      });
    }
    const bas = SY_SERIES.filter((s) => s.ports_base.includes(p.code)).map((s) => s.code);
    const felBas = SY_SERIES.map((s) => s.code).filter((k) => !bas.includes(k));
    if (bas.length && felBas.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "port" }, p.code] }, { "==": [{ var: "body" }, "40"] }, { in: [{ var: "series" }, felBas] }] },
        message_sv: `Underplatta ${p.size} finns för ${lista(bas.map(namn))}, inte ${lista(felBas.map(namn))} (sida 748).`,
        message_en: `The sub-plate ${p.size} exists for ${lista(bas.map(namn), "and")}, not ${lista(felBas.map(namn), "and")} (page 748).`,
        goto_step: steg("port"),
      });
    }
  }
  const ejPlatta = SY_PORTS.filter((p) => !SY_SERIES.some((s) => s.ports_base.includes(p.code))).map((p) => p.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "port" }, ejPlatta] }, { "==": [{ var: "body" }, "40"] }] },
    message_sv: "Underplattan har gängad port: 1/8 (SY3000), 1/4 (SY5000/7000), 3/8 (SY7000/9000) eller 1/2 (SY9000) — inte M5 eller snabbkoppling (sida 748).",
    message_en: "The sub-plate has a threaded port: 1/8 (SY3000), 1/4 (SY5000/7000), 3/8 (SY7000/9000) or 1/2 (SY9000) — not M5 or a One-touch fitting (page 748).",
    goto_step: steg("port"),
  });
  const ejGanga = SY_PORTS.filter((p) => p.kind !== "thread" || p.code === "M5").map((p) => p.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "thread" }, ""] }, { in: [{ var: "port" }, ["", ...ejGanga]] }] },
    message_sv: "Gängtypen gäller bara de gängade portarna 1/8–1/2 — inte M5, snabbkopplingar eller utan underplatta (sida 732 och 748).",
    message_en: "The thread type applies only to the threaded ports 1/8–1/2 — not M5, One-touch fittings or without a sub-plate (pages 732 and 748).",
    goto_step: steg("thread"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "mto" }, "X701"] }, { in: [{ var: "thread" }, SY_THREADS.filter((t) => t.code !== "F").map((t) => t.code)] }] },
    message_sv: "-X701 finns bara med Rc- eller G-gänga (sida 942-1).",
    message_en: "-X701 is available with the Rc or G thread only (page 942-1).",
    goto_step: steg("thread"),
  });
  const utanFaste = SY_SERIES.filter((s) => !s.bracket_ok).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "bracket" }, ""] }, { or: [{ "==": [{ var: "body" }, "40"] }, { in: [{ var: "series" }, utanFaste] }] }] },
    message_sv: `Fästena ${lista(SY_BRACKETS.map((b) => b.code))} finns bara för den kroppsportade ventilen och inte för ${lista(utanFaste.map(namn))} (sida 732).`,
    message_en: `The brackets ${lista(SY_BRACKETS.map((b) => b.code), "and")} exist only for the body ported valve and not for ${lista(utanFaste.map(namn), "and")} (page 732).`,
    goto_step: steg("bracket"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "bracket" }, "F1"] }, { "!=": [{ var: "actuation" }, "1"] }] },
    message_sv: "Fotfästet F1 finns bara för den 2-läges enkla ventilen (1) (sida 732).",
    message_en: "The foot bracket F1 exists only for the 2-position single valve (1) (page 732).",
    goto_step: steg("bracket"),
  });

  // ── CE ─────────────────────────────────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "ce" }, SY_CE.code] }, { in: [{ var: "voltage" }, ac] }, { in: [{ var: "entry" }, inteDin] }] },
    message_sv: "CE/UKCA-märkta AC-ventiler finns bara med DIN-kontakt (D, DO, Y, YO) (sida 732 och 748).",
    message_en: "CE/UKCA-compliant AC valves have DIN terminals only (D, DO, Y, YO) (pages 732 and 748).",
    goto_step: steg("ce"),
  });

  // ── råd ────────────────────────────────────────────────────────────────
  rows.push({
    severity: "warn",
    if_json: { and: [{ in: [{ var: "voltage" }, ["5", "6"]] }, { "==": [{ var: "coil" }, ""] }, { not: { in: [{ var: "entry" }, [...din, ...m8]] } }] },
    message_sv: `Strömsparkretsen T sänker hålleffekten till ${sv(SY_LIMITS.power_w_saving)} W (start 0,4 W) från ${sv(SY_LIMITS.power_w)} W; den kräver ljus/spärrdiod Z (sida 733).`,
    message_en: `The power saving circuit T lowers the holding power to ${SY_LIMITS.power_w_saving} W (starting 0.4 W) from ${SY_LIMITS.power_w} W; it requires the light/surge voltage suppressor Z (page 733).`,
    goto_step: steg("coil"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "entry" }, [...din, ...m8]] },
    message_sv: "DIN-kontakt och M8-kontakt ger IP65; övriga anslutningar är dammskyddade (sida 733).",
    message_en: "The DIN terminal and the M8 connector give IP65; the other entries are dust proof (page 733).",
    goto_step: steg("entry"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "entry" }, SY_ENTRIES.filter((x) => x.kind === "plug" && x.no_connector).map((x) => x.code)] },
    message_sv: "Utan kontakt: kontaktsatsen och andra kabellängder för L/M-pluggen beställs enligt sida 957–958.",
    message_en: "Without connector: the connector assembly and other lead wire lengths for the L/M plug are ordered according to pages 957–958.",
    goto_step: steg("entry"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "entry" }, "WO"] },
    message_sv: "M8 utan kabel: kontaktkabeln beställs separat som V100-49-1-1…-7 (300–5000 mm) (sida 961).",
    message_en: "M8 without cable: order the connector cable separately as V100-49-1-1…-7 (300–5000 mm) (page 961).",
    goto_step: steg("entry"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "body" }, "20"] },
    message_sv: "Kroppsportad enkelventil levereras utan rampens monteringsskruvar och packningar — beställ dem separat vid behov (sida 732 not; sida 795).",
    message_en: "The body ported single unit is shipped without the manifold mounting screws and gaskets — order them separately if needed (page 732 note; page 795).",
    goto_step: steg("body"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "body" }, "40"] },
    message_sv: "Basmonterad enkelventil levereras med monteringsskruvar och packningar för rampen; utan portkod ingen underplatta (sida 748).",
    message_en: "The base mounted single unit ships with the manifold mounting screws and gaskets; with no port code there is no sub-plate (page 748).",
    goto_step: steg("body"),
  });
  for (const s of SY_SERIES) {
    for (const a of SY_ACTUATIONS) {
      if (a.dual && !s.x701_ok) continue;
      const f = a.three_pos ? s.freq_hz[1] : s.freq_hz[0];
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { "==": [{ var: "actuation" }, a.code] }] },
        message_sv: `${namn(s.code)} funktion ${a.code}: arbetstryck ${sv(a.pressure[0])}–${sv(a.pressure[1])} MPa (intern pilot), ${a.dual ? "svarstid som 2-läges dubbel" : `högst ${f} Hz`}, ${SY_LIMITS.temp_c[0]}…${SY_LIMITS.temp_c[1]} °C, smörjfri, valfritt monteringsläge, ${SY_LIMITS.impact_vibration}; effekt ${sv(SY_LIMITS.power_w)} W DC (sida 733${a.dual ? " och 942-1" : ""}).`,
        message_en: `${namn(s.code)} actuation ${a.code}: operating pressure ${a.pressure[0]}–${a.pressure[1]} MPa (internal pilot), ${a.dual ? "response time as the 2-position double" : `max ${f} Hz`}, ${SY_LIMITS.temp_c[0]}…${SY_LIMITS.temp_c[1]} °C, no lubrication, any mounting orientation, ${SY_LIMITS.impact_vibration}; power ${SY_LIMITS.power_w} W DC (page 733${a.dual ? " and 942-1" : ""}).`,
        goto_step: steg("actuation"),
      });
    }
  }
  return rows;
}

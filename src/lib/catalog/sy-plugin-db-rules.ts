/**
 * Reglerna för SY plug-in-ventilen (familjen sy-plugin) som skrivs till
 * config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: 4-läges bara gummi, backventilen mot
 * tätning/funktion/serie, högtryck bara metall, strömsparkretsen bara med
 * Z/NZ, porten mot kropp och serie, gängtypen mot porten.
 */
import {
  SYP_ACTUATIONS,
  SYP_BODIES,
  SYP_CHECK_H,
  SYP_COIL_T,
  SYP_DATA,
  SYP_LIGHTS,
  SYP_LIMITS,
  SYP_OPTIONS,
  SYP_OVERRIDES,
  SYP_PILOT_R,
  SYP_PORTS,
  SYP_SCREWS,
  SYP_SERIES,
  SYP_THREADS,
} from "./sy-plugin";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type SYPDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");

export function buildSyPluginDbRules(): SYPDbRule[] {
  const rows: SYPDbRule[] = [];
  const steg = (p: string) => `sy-plugin-${p}`;
  const fyra = SYP_ACTUATIONS.filter((a) => a.rubber_only).map((a) => a.code);
  const tre = SYP_ACTUATIONS.filter((a) => !a.check_ok).map((a) => a.code);

  // ── tätning, backventil, tillval, spole ────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "actuation" }, fyra] }, { "==": [{ var: "seal" }, "1"] }] },
    message_sv: "4-läges dubbel 3-portsventil (A/B/C) finns bara med gummitätning (sida 404 och 432).",
    message_en: "The 4-position dual 3-port valve (A/B/C) is only available with the rubber seal (pages 404 and 432).",
    goto_step: steg("seal"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "check" }, SYP_CHECK_H.code] }, { "==": [{ var: "seal" }, "1"] }] },
    message_sv: "Den inbyggda backventilen (H) finns bara med gummitätning; för metalltätning finns den rampmonterade backventilen (sida 432 och 625).",
    message_en: "The built-in back pressure check valve (H) is only available with the rubber seal; for the metal seal use the manifold installed check valve (pages 432 and 625).",
    goto_step: steg("check"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "check" }, SYP_CHECK_H.code] }, { in: [{ var: "actuation" }, tre] }] },
    message_sv: "Den inbyggda backventilen (H) finns inte för 3-lägesventiler (sida 432).",
    message_en: "The built-in back pressure check valve (H) is not available for 3-position valves (page 432).",
    goto_step: steg("check"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "check" }, SYP_CHECK_H.code] }, { "==": [{ var: "series" }, "7"] }] },
    message_sv: "Den inbyggda backventilen (H) finns inte för SY7000 (sida 432).",
    message_en: "The built-in back pressure check valve (H) is not available for the SY7000 (page 432).",
    goto_step: steg("check"),
  });
  for (const o of SYP_OPTIONS.filter((x) => x.metal_only)) {
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "option" }, o.code] }, { "==": [{ var: "seal" }, "0"] }] },
      message_sv: `Högtrycksutförandet ${o.code} (${sv(o.max_mpa)} MPa) finns bara med metalltätning (sida 432).`,
      message_en: `The high pressure type ${o.code} (${o.max_mpa} MPa) is only available with the metal seal (page 432).`,
      goto_step: steg("option"),
    });
  }
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "coil" }, SYP_COIL_T.code] }, { not: { in: [{ var: "light" }, ["Z", "NZ"]] } }] },
    message_sv: "Strömsparkretsen (T) finns bara med ljus och skyddsdiod Z (pluskommun) eller NZ (minuskommun) (sida 432).",
    message_en: "The power saving circuit (T) is only available with light/surge voltage suppressor Z (positive common) or NZ (negative common) (page 432).",
    goto_step: steg("light"),
  });

  // ── port mot kropp, serie och gänga ────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "body" }, "0"] }, { "!=": [{ var: "port" }, ""] }] },
    message_sv: "Den basmonterade ventilen (kropp 0) har ingen egen port — A/B-portarna sitter på rampen typ 10/11 (sida 504).",
    message_en: "The base mounted valve (body 0) has no port of its own — the A/B ports are on the type 10/11 manifold (page 504).",
    goto_step: steg("port"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "body" }, "3"] }, { "==": [{ var: "port" }, ""] }] },
    message_sv: "Den topportade ventilen (kropp 3) bär A/B-porten: välj gänga eller snabbkoppling (sida 513).",
    message_en: "The top ported valve (body 3) carries the A/B port: select a thread or One-touch fitting size (page 513).",
    goto_step: steg("port"),
  });
  for (const s of SYP_SERIES) {
    const ok = SYP_PORTS.filter((p) => p.series.includes(s.code));
    const fel = SYP_PORTS.filter((p) => !p.series.includes(s.code)).map((p) => p.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "body" }, "3"] }, { "==": [{ var: "series" }, s.code] }, { in: [{ var: "port" }, fel] }] },
      message_sv: `${s.label_sv} topportad har portarna ${lista(ok.map((p) => p.code))} (sida 513).`,
      message_en: `${s.label_sv} top ported has the ports ${lista(ok.map((p) => p.code), "and")} (page 513).`,
      goto_step: steg("port"),
    });
  }
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "thread" }, ""] }, { not: { in: [{ var: "port" }, SYP_PORTS.filter((p) => p.threadable).map((p) => p.code)] } }] },
    message_sv: "Gängtypen (F/N/T) gäller bara gängade portar 1/8 och 02 (1/4); M5 finns bara som standard och snabbkopplingar har ingen gänga (sida 513).",
    message_en: "The thread type (F/N/T) only applies to the threaded ports 01 (1/8) and 02 (1/4); M5 is standard only and One-touch fittings have no thread (page 513).",
    goto_step: steg("thread"),
  });

  // ── råd per serie, funktion och tätning ────────────────────────────────
  for (const s of SYP_SERIES) {
    const d = SYP_DATA[s.code];
    for (const a of SYP_ACTUATIONS) {
      for (const seal of ["0", "1"]) {
        if (seal === "1" && a.rubber_only) continue;
        const k = a.positions === 2 ? a.code : String(a.positions);
        const w = d.weight[k];
        const f = d.freq[String(a.positions)];
        const r = d.response[k];
        const metal = seal === "1";
        const p = metal && a.code === "2" ? "0,1–0,7 MPa (högtryck K: 0,1–1,0)" : `${sv(a.pressure[0])}–${sv(a.pressure[1])} MPa`;
        const pEn = metal && a.code === "2" ? "0.1–0.7 MPa (high pressure K: 0.1–1.0)" : `${a.pressure[0]}–${a.pressure[1]} MPa`;
        rows.push({
          severity: "info",
          if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { "==": [{ var: "actuation" }, a.code] }, { "==": [{ var: "seal" }, seal] }] },
          message_sv: `SY${s.code}${a.code}□${seal}: ${a.label_sv.replace(/ \(bara gummitätning\)$/, "")}, ${metal ? "metall" : "gummi"}tätning, intern pilot ${p}, högst ${metal ? f[1] : f[0]} Hz, respons ca ${metal ? r[1] : r[0]} ms (standard utan ljus), vikt basmonterad ${metal ? w[1] : w[0]} g, ${SYP_LIMITS.temp_c[0]}…${SYP_LIMITS.temp_c[1]} °C, ${SYP_LIMITS.enclosure}, ${sv(SYP_LIMITS.power_w)} W (${sv(SYP_LIMITS.power_light_w)} W med ljus) (sida 404–406).`,
          message_en: `SY${s.code}${a.code}□${seal}: ${a.name_en}, ${metal ? "metal" : "rubber"} seal, internal pilot ${pEn}, max. ${metal ? f[1] : f[0]} Hz, response approx. ${metal ? r[1] : r[0]} ms (standard without light), weight base mounted ${metal ? w[1] : w[0]} g, ${SYP_LIMITS.temp_c[0]}…${SYP_LIMITS.temp_c[1]} °C, ${SYP_LIMITS.enclosure}, ${SYP_LIMITS.power_w} W (${SYP_LIMITS.power_light_w} W with light) (pages 404–406).`,
          goto_step: steg("seal"),
        });
      }
    }
  }

  // ── råd per tillval ────────────────────────────────────────────────────
  for (const b of SYP_BODIES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "body" }, b.code] },
      message_sv: `Kropp ${b.code}: ${b.label_sv.split(",")[0].toLowerCase()} för ramp typ ${b.manifold_types} (och metallbas ${b.metal_base}); basens packning ingår inte när ventilen beställs separat (sida ${b.page} och 611).`,
      message_en: `Body ${b.code}: ${b.code === "0" ? "base mounted" : "top ported"} for manifold type ${b.manifold_types} (and metal base ${b.metal_base}); the base gasket is not included when the valve is ordered separately (pages ${b.page} and 611).`,
      goto_step: steg("body"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "pilot" }, SYP_PILOT_R.code] },
    message_sv: `Extern pilot (R): arbetstryck −100 kPa…0,7 MPa (4-läges 0,6; metall högtryck 1,0) med pilottryck ${sv(SYP_LIMITS.external_pilot_mpa[0])}–${sv(SYP_LIMITS.external_pilot_mpa[1])} MPa; för 4-läges dubbel 3-port minst arbetstryck + 0,1 MPa (lägst 0,25); rampen beställs med P/E-kod G/H/J (sida 404).`,
    message_en: `External pilot (R): operating pressure −100 kPa…0.7 MPa (4-position 0.6; metal seal high pressure 1.0) with a pilot pressure of ${SYP_LIMITS.external_pilot_mpa[0]}–${SYP_LIMITS.external_pilot_mpa[1]} MPa; for the 4-position dual 3-port valve at least operating pressure + 0.1 MPa (min. 0.25); the manifold is ordered with P/E symbol G/H/J (page 404).`,
    goto_step: steg("pilot"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "check" }, SYP_CHECK_H.code] },
    message_sv: "Inbyggd backventil (H): hindrar mottryck från andra ventiler på samma ramp; kombinera inte med den rampmonterade backventilen — flödet minskar (sida 432).",
    message_en: "Built-in back pressure check valve (H): prevents back pressure from other valves on the same manifold; do not combine with the manifold installed check valve — the flow is reduced (page 432).",
    goto_step: steg("check"),
  });
  for (const o of SYP_OPTIONS) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "option" }, o.code] },
      message_sv: `${o.code}: ${o.label_sv} — effekt ${sv(SYP_LIMITS.power_hp_w)} W (0,95 W med ljus) i stället för ${sv(SYP_LIMITS.power_w)} W (sida 404).`,
      message_en: `${o.code}: ${o.code === "B" ? "quick response type (0.7 MPa)" : "high pressure type 1.0 MPa (metal seal only)"} — power ${SYP_LIMITS.power_hp_w} W (0.95 W with light) instead of ${SYP_LIMITS.power_w} W (page 404).`,
      goto_step: steg("option"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "coil" }, SYP_COIL_T.code] },
    message_sv: `Strömsparkrets (T): hålleffekt ${sv(SYP_LIMITS.power_saving_w)} W efter 67 ms (0,4 W högtryck), välj den vid långa inkopplingstider; högst 5 Hz och spänningstolerans −7/+10 % vid 24 V (sida 404 och 705).`,
    message_en: `Power saving circuit (T): holding power ${SYP_LIMITS.power_saving_w} W after 67 ms (0.4 W high pressure), select it for long energising times; max. 5 Hz and voltage tolerance −7/+10 % at 24 V (pages 404 and 705).`,
    goto_step: steg("coil"),
  });
  for (const l of SYP_LIGHTS) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "light" }, l.code] },
      message_sv: `${l.code}: ${l.light ? "ljus och " : ""}skyddsdiod, ${l.common === "non-polar" ? "opolär — passar båda polariteterna" : l.common === "positive" ? "pluskommun — SI-enhet med polaritetskod 2/3/6/8" : "minuskommun — SI-enhet med polaritetskod 4/5/7/9"}; på EX600-rampen krävs 24 V och en skyddsdiod (Nil finns inte där) (sida 504).`,
      message_en: `${l.code}: ${l.light ? "light and " : ""}surge voltage suppressor, ${l.common === "non-polar" ? "non-polar — fits both commons" : l.common === "positive" ? "positive common — SI unit with polarity symbol 2/3/6/8" : "negative common — SI unit with polarity symbol 4/5/7/9"}; on the EX600 manifold 24 V and a surge suppressor are required (blank is not available there) (page 504).`,
      goto_step: steg("light"),
    });
  }
  rows.push({
    severity: "warn",
    if_json: { "==": [{ var: "light" }, ""] },
    message_sv: "Utan skyddsdiod (tomt) kan ventilen inte sitta på en EX600-ramp — där krävs R, U, S, Z, NS eller NZ (sida 504).",
    message_en: "Without a surge voltage suppressor (blank) the valve cannot be used on an EX600 manifold — there R, U, S, Z, NS or NZ is required (page 504).",
    goto_step: steg("light"),
  });
  for (const o of SYP_OVERRIDES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "override" }, o.code] },
      message_sv: `Manöverdon ${o.code}: ${o.label_sv.replace(/ \(standard.*\)$/, "").toLowerCase()}${o.code === "F" ? "; säkerhetsglidlås finns som -X13 (sida 423)" : ""} (sida 432).`,
      message_en: `Manual override ${o.code}: ${o.code === "D" ? "push-turn locking slotted type" : o.code === "E" ? "push-turn locking lever type" : "slide locking type; the safety slide locking type is -X13 (page 423)"} (page 432).`,
      goto_step: steg("override"),
    });
  }
  for (const s of SYP_SCREWS) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "screw" }, s.code] },
      message_sv: `Skruv ${s.code}: ${s.label_sv.replace(/ \(standard.*\)$/, "").toLowerCase()}${s.code === "B" || s.code === "H" ? " — kan inte väljas tillsammans med individuell SUP/EXH-spacer, gränssnittsregulator eller dubbel backventilsspacer" : ""}${s.code === "K" || s.code === "H" ? " — tappsäkringen hindrar skruvarna från att falla ur vid underhåll" : ""} (sida 432).`,
      message_en: `Screw ${s.code}: ${s.code === "B" ? "hexagon socket head cap screw" : s.code === "K" ? "round head combination screw, drop prevention type" : "hexagon socket head cap screw, drop prevention type"}${s.code === "B" || s.code === "H" ? " — cannot be selected with the individual SUP/EXH spacer, interface regulator or double check spacer" : ""}${s.code === "K" || s.code === "H" ? " — the drop prevention construction stops the screws from falling out during maintenance" : ""} (page 432).`,
      goto_step: steg("screw"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "port" }, "M5"] },
    message_sv: "M5 x 0,8 finns bara som standardgänga (ingen F/N/T) (sida 513).",
    message_en: "M5 x 0.8 is only available as the standard thread (no F/N/T) (page 513).",
    goto_step: steg("thread"),
  });
  for (const t of SYP_THREADS) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "thread" }, t.code] },
      message_sv: `Gängtyp ${t.code}: ${t.label_sv.replace(/ \(standard.*\)$/, "")} i porten 1/8 (SY5000) respektive 1/4 (SY7000) (sida 513).`,
      message_en: `Thread type ${t.code}: ${t.code === "F" ? "G thread (Rc is standard)" : t.code === "N" ? "NPT thread" : "NPTF thread"} in the 1/8 (SY5000) or 1/4 (SY7000) port (page 513).`,
      goto_step: steg("thread"),
    });
  }
  return rows;
}

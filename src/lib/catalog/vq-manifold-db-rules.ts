/**
 * Reglerna för VQ-ventilrampen (familjen vq) som skrivs till config_rules,
 * byggda ur modellen.
 *
 * Det som beror på två val samtidigt: kit mot serie och stationsantal, port
 * mot serie, anslutning/kabel/SI-enhet mot kit, tillvalen mot serie, kit,
 * namnskylt och stationsantal.
 */
import {
  VQM_CABLES,
  VQM_CE,
  VQM_ENTRIES,
  VQM_KITS,
  VQM_OPTIONS,
  VQM_PORTS,
  VQM_SERIES,
  VQM_SI_UNITS,
  VQM_STATIONS,
} from "./vq-manifold";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type VQMDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");

export function buildVqManifoldDbRules(): VQMDbRule[] {
  const rows: VQMDbRule[] = [];
  const steg = (p: string) => `vq-${p}`;

  // ── kit mot serie och stationsantal ────────────────────────────────────
  for (const k of VQM_KITS) {
    for (const s of VQM_SERIES) {
      const range = k.stations[s.code];
      if (!range) {
        rows.push({
          severity: "error",
          if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { "==": [{ var: "kit" }, k.code] }] },
          message_sv: `${k.code}-kitet (${k.name_sv}) finns bara för VQ2000 (sida ${k.page}).`,
          message_en: `The ${k.code} kit (${k.name_en}) is only available for the VQ2000 (page ${k.page}).`,
          goto_step: steg("kit"),
        });
        continue;
      }
      const fel = VQM_STATIONS.map((x) => x.code).filter((c) => Number(c) < range[0] || Number(c) > range[1]);
      if (fel.length === 0) continue;
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { "==": [{ var: "kit" }, k.code] }, { in: [{ var: "stations" }, fel] }] },
        message_sv: `VQ${s.code}000 med ${k.code}-kit (${k.name_sv}) byggs med ${range[0]}–${range[1]} platser (sida 375 och ${k.page}).`,
        message_en: `VQ${s.code}000 with the ${k.code} kit (${k.name_en}) is built with ${range[0]}–${range[1]} stations (pages 375 and ${k.page}).`,
        goto_step: steg("stations"),
      });
    }
  }
  rows.push({
    severity: "warn",
    if_json: { and: [{ "==": [{ var: "kit" }, "S"] }, { in: [{ var: "stations" }, VQM_STATIONS.filter((x) => Number(x.code) >= 9 && Number(x.code) <= 16).map((x) => x.code)] }] },
    message_sv: "S-kit med 9–16 platser: SI-enheten har 16 utgångar, så rampen specificeras med enkel-/dubbelkoppling per station på specifikationsbladet (sida 397).",
    message_en: "S kit with 9–16 stations: the SI unit has 16 outputs, so the manifold is specified with single/double wiring per station on the specification sheet (page 397).",
    goto_step: steg("stations"),
  });

  // ── port mot serie ─────────────────────────────────────────────────────
  for (const s of VQM_SERIES) {
    const ok = VQM_PORTS.filter((p) => p.series.includes(s.code));
    const fel = VQM_PORTS.filter((p) => !p.series.includes(s.code)).map((p) => p.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { in: [{ var: "port" }, fel] }] },
      message_sv: `VQ${s.code}000 har cylinderportarna ${lista(ok.filter((p) => !p.inch).map((p) => p.code))} (tum: ${lista(ok.filter((p) => p.inch).map((p) => p.code))}) (sida ${s.code === "1" ? 366 : 370} och 406).`,
      message_en: `VQ${s.code}000 has the cylinder ports ${lista(ok.filter((p) => !p.inch).map((p) => p.code), "and")} (inch: ${lista(ok.filter((p) => p.inch).map((p) => p.code), "and")}) (pages ${s.code === "1" ? 366 : 370} and 406).`,
      goto_step: steg("port"),
    });
  }

  // ── anslutning, kabel och SI-enhet mot kit ─────────────────────────────
  const medEntry = VQM_KITS.filter((k) => k.entry).map((k) => k.code);
  const utanEntry = VQM_KITS.filter((k) => !k.entry).map((k) => k.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "kit" }, medEntry] }, { "==": [{ var: "entry" }, ""] }] },
    message_sv: "F- och P-kitet anger kontaktens riktning: U (uppåt) eller S (åt sidan) (sida 366).",
    message_en: "The F and P kits specify the connector entry direction: U (top) or S (side) (page 366).",
    goto_step: steg("entry"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "kit" }, utanEntry] }, { "!=": [{ var: "entry" }, ""] }] },
    message_sv: "Kontaktriktningen U/S finns bara för F- och P-kitet (sida 366 och 370).",
    message_en: "The connector entry direction U/S only exists for the F and P kits (pages 366 and 370).",
    goto_step: steg("entry"),
  });
  for (const k of VQM_KITS) {
    if (k.cables.length === 0) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "kit" }, k.code] }, { "!=": [{ var: "cable" }, ""] }] },
        message_sv: `${k.code}-kitet (${k.name_sv}) har ingen kabellängd i koden (sida ${k.page}).`,
        message_en: `The ${k.code} kit (${k.name_en}) has no cable length in the number (page ${k.page}).`,
        goto_step: steg("cable"),
      });
      continue;
    }
    const fel = ["", ...VQM_CABLES.map((c) => c.code)].filter((c) => !k.cables.includes(c));
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "kit" }, k.code] }, { in: [{ var: "cable" }, fel] }] },
      message_sv: `${k.code}-kitet anger kabeln: ${k.code === "L" ? "0 (0,6 m), 1 (1,5 m) eller 2 (3 m)" : "0 (utan), 1 (1,5 m), 2 (3 m) eller 3 (5 m)"} (sida ${k.page}).`,
      message_en: `The ${k.code} kit specifies the cable: ${k.code === "L" ? "0 (0.6 m), 1 (1.5 m) or 2 (3 m)" : "0 (without), 1 (1.5 m), 2 (3 m) or 3 (5 m)"} (page ${k.page}).`,
      goto_step: steg("cable"),
    });
  }
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "kit" }, "S"] }, { "==": [{ var: "si_unit" }, ""] }] },
    message_sv: "S-kitet anger SI-enheten: 0 (utan), Q (DeviceNet), V (CC-Link), ZB eller ZBN (CompoNet) (sida 397).",
    message_en: "The S kit specifies the SI unit: 0 (without), Q (DeviceNet), V (CC-Link), ZB or ZBN (CompoNet) (page 397).",
    goto_step: steg("si_unit"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "kit" }, "S"] }, { "!=": [{ var: "si_unit" }, ""] }] },
    message_sv: "SI-enheten hör till S-kitet (seriell EX120/124) (sida 397).",
    message_en: "The SI unit belongs to the S kit (serial transmission EX120/124) (page 397).",
    goto_step: steg("si_unit"),
  });

  // ── tillvalen ──────────────────────────────────────────────────────────
  const perParam = new Map<string, typeof VQM_OPTIONS>();
  for (const opt of VQM_OPTIONS) perParam.set(opt.param, [...(perParam.get(opt.param) ?? []), opt]);
  for (const [param, opts] of perParam) {
    const series = [...new Set(opts.flatMap((x) => x.series))];
    const kits = [...new Set(opts.flatMap((x) => x.kits))];
    const codes = opts.map((x) => x.code);
    const felSerie = VQM_SERIES.filter((s) => !series.includes(s.code));
    const felKit = VQM_KITS.filter((k) => !kits.includes(k.code));
    const namn = param === "ac" ? "2 (200/220 V AC)" : param === "regulator" ? "G1–G3 (regulatorenheter)" : param === "ejector" ? "J (ejektorenhet)" : param === "wiring" ? "K (specialkoppling)" : "W (kapsling IP65)";
    const name = param === "ac" ? "2 (200/220 VAC)" : param === "regulator" ? "G1–G3 (regulator units)" : param === "ejector" ? "J (ejector unit)" : param === "wiring" ? "K (special wiring)" : "W (enclosure IP65)";
    if (felSerie.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ in: [{ var: param }, codes] }, { in: [{ var: "series" }, felSerie.map((s) => s.code)] }] },
        message_sv: `Tillvalet ${namn} finns bara för VQ${series.join("000/")}000 (sida 366 och 370).`,
        message_en: `The option ${name} is only available for the VQ${series.join("000/")}000 (pages 366 and 370).`,
        goto_step: steg(param),
      });
    }
    if (felKit.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ in: [{ var: param }, codes] }, { in: [{ var: "kit" }, felKit.map((k) => k.code)] }] },
        message_sv: `Tillvalet ${namn} finns bara med ${lista(kits.map((k) => `${k.replace("0", "")}-kit`))} (sida 366 och 370).`,
        message_en: `The option ${name} is only available with the ${lista(kits.map((k) => `${k.replace("0", "")} kit`), "and")} (pages 366 and 370).`,
        goto_step: steg(param),
      });
    }
  }
  const nn = VQM_OPTIONS.filter((x) => x.not_with_nameplate);
  for (const param of [...new Set(nn.map((x) => x.param))]) {
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: param }, nn.filter((x) => x.param === param).map((x) => x.code)] }, { "==": [{ var: "nameplate" }, "N"] }] },
      message_sv: `${param === "regulator" ? "Regulatorenheterna G1–G3" : "Ejektorenheten J"} kan inte kombineras med namnskylt N (sida 366, not ${param === "regulator" ? 8 : 4}).`,
      message_en: `${param === "regulator" ? "The regulator units G1–G3" : "The ejector unit J"} cannot be combined with the name plate N (page 366, note ${param === "regulator" ? 8 : 4}).`,
      goto_step: steg("nameplate"),
    });
  }
  const dinLangd = VQM_OPTIONS.filter((x) => x.param === "din" && /^D\d\d$/.test(x.code));
  for (const d of dinLangd) {
    const n = Number(d.code.slice(1));
    const fel = VQM_STATIONS.filter((x) => Number(x.code) >= n).map((x) => x.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "din" }, d.code] }, { in: [{ var: "stations" }, fel] }] },
      message_sv: `${d.code}: skenans stationsantal (${n}) anges bara när det är större än rampens antal platser; annars räcker D (sida 366 och 406).`,
      message_en: `${d.code}: the rail's number of stations (${n}) is only stated when it is larger than the manifold's number of stations; otherwise D is enough (pages 366 and 406).`,
      goto_step: steg("din"),
    });
  }

  // ── råd ────────────────────────────────────────────────────────────────
  for (const s of VQM_SERIES) {
    rows.push({
      severity: "info",
      if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { in: [{ var: "port" }, VQM_PORTS.filter((p) => !p.inch).map((p) => p.code)] }] },
      message_sv: `VV5Q${s.code}1: P/R-portar ${s.pe_metric}; ventilerna (familjen vq1000) ger flöde C ${sv(s.flow_c[0])}–${sv(s.flow_c[1])} dm³/(s·bar) 1→2/4 (2-läges enkel, metall/gummi) och väger ${s.valve_weight_g[0]}/${s.valve_weight_g[1]} g (2-/3-läges); 0,1–0,7 MPa (högtryck 1,0), −10…50 °C (sida 374–375).`,
      message_en: `VV5Q${s.code}1: P/R ports ${s.pe_metric}; the valves (family vq1000) give flow C ${s.flow_c[0]}–${s.flow_c[1]} dm³/(s·bar) 1→2/4 (2-position single, metal/rubber) and weigh ${s.valve_weight_g[0]}/${s.valve_weight_g[1]} g (2-/3-position); 0.1–0.7 MPa (high pressure 1.0), −10…50 °C (pages 374–375).`,
      goto_step: steg("series"),
    });
    rows.push({
      severity: "info",
      if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { in: [{ var: "port" }, VQM_PORTS.filter((p) => p.inch).map((p) => p.code)] }] },
      message_sv: `Tumkopplingar på cylinderportarna ger tumkopplingar även på P/R: ${s.pe_inch} (sida 406).`,
      message_en: `Inch fittings on the cylinder ports give inch fittings on P/R as well: ${s.pe_inch} (page 406).`,
      goto_step: steg("port"),
    });
  }
  for (const k of VQM_KITS) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "kit" }, k.code] },
      message_sv: `${k.code.replace("0", "")}-kit: ${k.name_sv}${k.ip65 ? ", IP65 (VQ2000 med tillval W)" : ""}; ventilerna beställs per station, t.ex. VQ1100-51 (familjen vq1000), station 1 närmast D-sidan (sida ${k.page}).`,
      message_en: `${k.code.replace("0", "")} kit: ${k.name_en}${k.ip65 ? ", IP65 (VQ2000 with option W)" : ""}; the valves are ordered per station, e.g. VQ1100-51 (family vq1000), station 1 closest to the D side (page ${k.page}).`,
      goto_step: steg("kit"),
    });
  }
  for (const e of VQM_ENTRIES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "entry" }, e.code] },
      message_sv: `${e.code}: ${e.label_sv.toLowerCase()} — kabelsatsen (AXT100-DS25-□ D-sub, flatkabel 26-polig) kan även beställas separat (sida 376 och 380).`,
      message_en: `${e.code}: ${e.code === "U" ? "top entry" : "side entry"} — the cable assembly (AXT100-DS25-□ D-sub, 26-pin flat ribbon) can also be ordered separately (pages 376 and 380).`,
      goto_step: steg("entry"),
    });
  }
  for (const u of VQM_SI_UNITS) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "si_unit" }, u.code] },
      message_sv: `S${u.code}: ${u.protocol_sv}${u.code === "0" ? " — SI-enheten beställs separat" : ", 16 utgångar; ventilerna har ljus/skyddsdiod och 24 V DC"} (sida 397).`,
      message_en: `S${u.code}: ${u.protocol_en}${u.code === "0" ? " — the SI unit is ordered separately" : ", 16 outputs; the valves have light/surge suppressor and 24 VDC"} (page 397).`,
      goto_step: steg("si_unit"),
    });
  }
  const tips: Array<[string, string, string, string]> = [
    ["check", "B", "Backventil mot mottryck på alla platser; bara vissa platser anges på specifikationsbladet (sida 366, not 2).", "Back pressure check valves on all stations; for certain stations only, specify the positions on the manifold specification sheet (page 366, note 2)."],
    ["wiring", "K", "Specialkoppling (annat än dubbelkoppling): kopplingen per station anges på specifikationsbladet (sida 366, not 5).", "Special wiring (other than double wiring): the wiring per station is specified on the manifold specification sheet (page 366, note 5)."],
    ["ext_pilot", "R", "Extern pilot: X-porten får snabbkoppling C4 (VQ1000) / C6 (VQ2000); ventilerna beställs med R, t.ex. VQ1100R-51; för vakuum eller matning under 0,1–0,2 MPa (sida 404).", "External pilot: the X port gets a C4 (VQ1000) / C6 (VQ2000) One-touch fitting; order the valves with R, e.g. VQ1100R-51; for vacuum or supply below 0.1–0.2 MPa (page 404)."],
    ["silencer", "S", "Direkt avluftning med inbyggd ljuddämpare; skydda utloppet från vatten om W (IP65) väljs (sida 370, not 7).", "Direct exhaust with built-in silencer; keep the outlet away from water if W (IP65) is selected (page 370, note 7)."],
    ["ip65", "W", "Kapsling IP65 (dammtät, spolsäker) för VQ2000 med T/L/S/M-kit (sida 375, not 4).", "Enclosure IP65 (dust-tight, water-jet-proof) for the VQ2000 with T/L/S/M kit (page 375, note 4)."],
    ["ac", "2", "Rampen kopplad för 200/220 V AC-ventiler (F- och L-kit); CE/UKCA-märkning (Q) finns bara för DC (sida 366).", "The manifold wired for 200/220 VAC valves (F and L kits); CE/UKCA marking (Q) is only available for DC (page 366)."],
    ["nameplate", "N", "Namnskylt; beställs separat när blindplatta med kontakt eller ventil med glidlås monteras i efterhand (sida 366, not 9).", "Name plate; ordered separately when a blanking plate with connector or a slide-locking valve is mounted later (page 366, note 9)."],
    ["ejector", "J", "Ejektorenhet på rampen; placeringen anges på specifikationsbladet (sida 418).", "Ejector unit on the manifold; the position is specified on the manifold specification sheet (page 418)."],
  ];
  for (const [param, code, svText, enText] of tips) {
    rows.push({ severity: "info", if_json: { "==": [{ var: param }, code] }, message_sv: `${code}: ${svText}`, message_en: `${code}: ${enText}`, goto_step: steg(param) });
  }
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "regulator" }, ["G1", "G2", "G3"]] },
    message_sv: "Regulatorenheter (VQ1000): placeringen anges på specifikationsbladet (sida 366, not 3).",
    message_en: "Regulator units (VQ1000): the positions are specified on the manifold specification sheet (page 366, note 3).",
    goto_step: steg("regulator"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "din" }, ["D", "D0"]] },
    message_sv: "DIN-skena: D ger en skena ca 30 mm längre än rampen, D0 bara fästena (VVQ1000-57A/VVQ2000-57A); lös skena beställs som AXT100-DR-□ (sida 406).",
    message_en: "DIN rail: D gives a rail approx. 30 mm longer than the manifold, D0 only the brackets (VVQ1000-57A/VVQ2000-57A); a separate rail is ordered as AXT100-DR-□ (page 406).",
    goto_step: steg("din"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "port" }, ["CM", "LM", "MM", "NM"]] },
    message_sv: "Blandade portar: storlek, pluggar och tillval per station anges på rampens specifikationsblad (sida 366, not 1–2).",
    message_en: "Mixed ports: sizes, plugs and options per station are specified on the manifold specification sheet (page 366, notes 1–2).",
    goto_step: steg("port"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "ce" }, VQM_CE.code] },
    message_sv: "Q: CE/UKCA-märkt utförande, bara med DC-ventiler (sida 366).",
    message_en: "Q: CE/UKCA-compliant version, DC valves only (page 366).",
    goto_step: steg("ce"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "ce" }, VQM_CE.code] }, { "==": [{ var: "ac" }, "2"] }] },
    message_sv: "CE/UKCA-märkning (Q) finns bara för DC — inte med 200/220 V AC (2) (sida 366).",
    message_en: "CE/UKCA marking (Q) is only available for DC — not with 200/220 VAC (2) (page 366).",
    goto_step: steg("ce"),
  });
  return rows;
}

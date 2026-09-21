/**
 * Reglerna för SY-ventilrampen (familjen sy) som skrivs till config_rules,
 * byggda ur modellen.
 *
 * Det som beror på två val samtidigt: serie mot typ, SI-enhet mot polaritet,
 * I/O-enheter och topportad, P/E-placering mot stationsantal, portstorlek mot
 * serie och typ, montering mot typ och DIN-skenans längd mot stationsantalet.
 */
import {
  SYM_DIN_RAILS,
  SYM_IO_STATIONS,
  SYM_MAX_DOUBLE_WIRING,
  SYM_MAX_SOLENOIDS,
  SYM_MOUNTINGS,
  SYM_PE_ENTRIES,
  SYM_POLARITIES,
  SYM_PORTS,
  SYM_SERIES,
  SYM_SI_UNITS,
  SYM_STATIONS,
  SYM_TYPES,
  symAllowedPorts,
} from "./sy-manifold";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type SYMDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const kod = (p: string) => p.replace(/^-/, "") || "Nil";

export function buildSyManifoldDbRules(): SYMDbRule[] {
  const rows: SYMDbRule[] = [];
  const steg = (p: string) => `sy-${p}`;
  const typ = (t: string) => SYM_TYPES.find((x) => x.code === t)!;

  // ── serie mot typ ──────────────────────────────────────────────────────
  for (const t of SYM_TYPES) {
    const saknas = SYM_SERIES.filter((s) => !t.series.includes(s.code));
    for (const s of saknas) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { "==": [{ var: "type" }, t.code] }] },
        message_sv: `Typ ${t.code} finns inte för SY${s.code}000: bottenportad SY3000 beställs som blandramp på SY5000-bas (sida ${t.page}, från sida 574).`,
        message_en: `Type ${t.code} is not available for SY${s.code}000: the bottom-ported SY3000 is ordered as a mixed mounting manifold on the SY5000 base (page ${t.page}, from page 574).`,
        goto_step: steg("type"),
      });
    }
  }

  // ── SI-enhet mot polaritet, I/O-enheter och typ ────────────────────────
  const med = SYM_SI_UNITS.filter((u) => u.code !== "0").map((u) => u.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "si_unit" }, med] }, { "==": [{ var: "polarity" }, ""] }] },
    message_sv: "Välj SI-enhetens polaritet och ändplatta (2–9): koden är tom bara utan SI-enhet (sida 502).",
    message_en: "Select the SI unit output polarity and end plate (2–9): the symbol is blank only without an SI unit (page 502).",
    goto_step: steg("polarity"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "si_unit" }, "0"] }, { "!=": [{ var: "polarity" }, ""] }] },
    message_sv: "Utan SI-enhet (0) finns ingen polaritet eller ändplatta att ange — koden är tom (sida 502).",
    message_en: "Without an SI unit (0) there is no polarity or end plate to specify — the symbol is blank (page 502).",
    goto_step: steg("polarity"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "si_unit" }, "0"] }, { "!=": [{ var: "io_stations" }, ""] }] },
    message_sv: "I/O-enheter kan inte monteras utan SI-enhet (sida 502).",
    message_en: "I/O units cannot be mounted without an SI unit (page 502).",
    goto_step: steg("io_stations"),
  });
  for (const t of SYM_TYPES) {
    const saknas = SYM_SI_UNITS.filter((u) => !u.types.includes(t.code));
    if (saknas.length === 0) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "type" }, t.code] }, { in: [{ var: "si_unit" }, saknas.map((u) => u.code)] }] },
      message_sv: `Typ ${t.code} (topportad) listar inte ${lista(saknas.map((u) => `${u.code} (${u.protocol_sv})`))} — välj typ 10/11 eller en annan SI-enhet (sida ${t.page}).`,
      message_en: `Type ${t.code} (top ported) does not list ${lista(saknas.map((u) => `${u.code} (${u.protocol_en})`), "and")} — select type 10/11 or another SI unit (page ${t.page}).`,
      goto_step: steg("si_unit"),
    });
  }

  // ── P/E-placering mot stationsantal och typ ────────────────────────────
  const ensidig = SYM_PE_ENTRIES.filter((e) => e.max_stations < 24).map((e) => e.code);
  const over10 = SYM_STATIONS.filter((s) => Number(s.code) > 10).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "pe_entry" }, ensidig] }, { in: [{ var: "stations" }, over10] }] },
    message_sv: `P/E-portar på bara en sida (${lista(ensidig)}) finns för 2–10 ventilplatser; fler platser kräver P/E på båda sidor (B, F eller J) (sida 502).`,
    message_en: `P/E ports on one side only (${lista(ensidig, "and")}) are available for 2–10 valve stations; more stations require P/E ports on both sides (B, F or J) (page 502).`,
    goto_step: steg("pe_entry"),
  });
  for (const t of SYM_TYPES) {
    const saknas = SYM_PE_ENTRIES.filter((e) => !e.types.includes(t.code));
    if (saknas.length === 0) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "type" }, t.code] }, { in: [{ var: "pe_entry" }, saknas.map((e) => e.code)] }] },
      message_sv: `Typ ${t.code}: inbyggd ljuddämpare finns bara med P/E på en sida (C eller E), inte på båda (${lista(saknas.map((e) => e.code))}) (sida ${t.page}).`,
      message_en: `Type ${t.code}: the built-in silencer is only available with P/E ports on one side (C or E), not on both (${lista(saknas.map((e) => e.code), "and")}) (page ${t.page}).`,
      goto_step: steg("pe_entry"),
    });
  }

  // ── portstorlek mot serie och typ ──────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "type" }, ["10", "11"]] }, { "==": [{ var: "port" }, ""] }] },
    message_sv: "Välj A/B-portarnas storlek: typ 10 och 11 har snabbkopplingarna på basen (sida 503).",
    message_en: "Select the A/B port size: types 10 and 11 have the One-touch fittings on the base (page 503).",
    goto_step: steg("port"),
  });
  for (const t of SYM_TYPES) {
    for (const s of SYM_SERIES) {
      if (!t.series.includes(s.code)) continue;
      const ok = symAllowedPorts(t.code, s.code).map((p) => p.code);
      const fel = SYM_PORTS.map((p) => p.code).filter((c) => c !== "" && !ok.includes(c));
      if (fel.length === 0) continue;
      const okMetric = ok.filter((c) => c && !c.includes("N")).map(kod);
      const okInch = ok.filter((c) => c.includes("N")).map(kod);
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "type" }, t.code] }, { "==": [{ var: "series" }, s.code] }, { in: [{ var: "port" }, fel] }] },
        message_sv: t.code === "12"
          ? `Typ 12 (topportad) har inga A/B-portar på basen: bara metriska P/E-portar (tomt) eller tum (N) — A/B-storleken väljs på ventilen (sida ${t.page}).`
          : `SY${s.code}000 typ ${t.code} har A/B-portarna ${lista(okMetric)}${okInch.length ? ` (tum: ${lista(okInch)})` : ""} (sida 503).`,
        message_en: t.code === "12"
          ? `Type 12 (top ported) has no A/B ports on the base: only metric P/E ports (blank) or inch (N) — the A/B size is selected on the valve (page ${t.page}).`
          : `SY${s.code}000 type ${t.code} has the A/B ports ${lista(okMetric, "and")}${okInch.length ? ` (inch: ${lista(okInch, "and")})` : ""} (page 503).`,
        goto_step: steg("port"),
      });
    }
  }

  // ── montering mot typ, DIN-skena mot montering och stationsantal ───────
  for (const t of SYM_TYPES) {
    const saknas = SYM_MOUNTINGS.filter((m) => !m.types.includes(t.code));
    if (saknas.length === 0) continue;
    const ok = SYM_MOUNTINGS.filter((m) => m.types.includes(t.code)).map((m) => m.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "type" }, t.code] }, { in: [{ var: "mounting" }, saknas.map((m) => m.code)] }] },
      message_sv: t.code === "11"
        ? "Typ 11 (bottenportad) finns bara för direktmontering: tomt, AA eller BA (sida 503)."
        : `Typ ${t.code} (topportad) har monteringarna tomt (direkt) och ${lista(ok)} (DIN-skena) — inga namnskyltar (sida ${t.page}).`,
      message_en: t.code === "11"
        ? "Type 11 (bottom ported) is only available for direct mounting: blank, AA or BA (page 503)."
        : `Type ${t.code} (top ported) has the mountings blank (direct) and ${lista(ok, "and")} (DIN rail) — no name plates (page ${t.page}).`,
      goto_step: steg("mounting"),
    });
  }
  const din = SYM_MOUNTINGS.filter((m) => m.din).map((m) => m.code);
  const utanDin = ["", ...SYM_MOUNTINGS.filter((m) => !m.din).map((m) => m.code)];
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "din_rail" }, ""] }, { in: [{ var: "mounting" }, utanDin] }] },
    message_sv: `DIN-skenans tillval (0 eller 3–24) hör till DIN-skenemonteringarna ${lista(din)} (sida 503).`,
    message_en: `The DIN rail option (0 or 3–24) belongs to the DIN rail mountings ${lista(din, "and")} (page 503).`,
    goto_step: steg("din_rail"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "din_rail" }, SYM_DIN_RAILS.filter((d) => d.code !== "0").map((d) => d.code)] }, { "<=": [{ var: "din_rail" }, { var: "stations" }] }] },
    message_sv: "Skenans stationsantal anges bara när det är STÖRRE än antalet ventilplatser; annars lämnas tillvalet tomt (standardlängd) (sida 503).",
    message_en: "The rail's number of stations is only entered when it is LARGER than the number of valve stations; otherwise leave the option blank (standard length) (page 503).",
    goto_step: steg("din_rail"),
  });
  rows.push({
    severity: "warn",
    if_json: { and: [{ "==": [{ var: "si_unit" }, "0"] }, { in: [{ var: "mounting" }, din] }, { "!=": [{ var: "din_rail" }, "0"] }] },
    message_sv: "Ska DIN-skenan monteras utan SI-enhet: välj D0 och beställ skenan separat efter måttet L3 (skenans artikelnummer sida 616) (sida 503).",
    message_en: "If the DIN rail is to be mounted without an SI unit: select D0 and order the rail separately per dimension L3 (rail part number on page 616) (page 503).",
    goto_step: steg("din_rail"),
  });

  // ── råd: stationer, portar, ljuddämpare ────────────────────────────────
  rows.push({
    severity: "warn",
    if_json: { in: [{ var: "stations" }, SYM_STATIONS.filter((s) => Number(s.code) > SYM_MAX_DOUBLE_WIRING).map((s) => s.code)] },
    message_sv: `Fler än ${SYM_MAX_DOUBLE_WIRING} ventilplatser kräver specificerad layout: ange enkel-/dubbelkoppling per station på rampens specifikationsblad, högst ${SYM_MAX_SOLENOIDS} spolar totalt; dubbelmagnet-, 3- och 4-lägesventiler kan inte sitta på enkelkopplade platser (sida 502).`,
    message_en: `More than ${SYM_MAX_DOUBLE_WIRING} valve stations require a specified layout: state single/double wiring per station on the manifold specification sheet, max. ${SYM_MAX_SOLENOIDS} solenoids in total; double, 3-position and 4-position valves cannot be used on single-wired stations (page 502).`,
    goto_step: steg("stations"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "stations" }, SYM_STATIONS.filter((s) => Number(s.code) <= SYM_MAX_DOUBLE_WIRING).map((s) => s.code)] },
    message_sv: "Standard är dubbelkoppling: alla platser klarar enkel-, dubbel-, 3- och 4-lägesventiler; en enkelmagnetventil lämnar då en styrsignal oanvänd — vill du inte det, beställ med specificerad layout (sida 502).",
    message_en: "Double wiring is standard: every station accepts single, double, 3-position and 4-position valves; a single solenoid valve then leaves one control signal unused — if that is not wanted, order with a specified layout (page 502).",
    goto_step: steg("stations"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "port" }, ["-CM", "-LM"]] },
    message_sv: "Blandade portstorlekar (CM/LM): ange storlekarna per station på rampens specifikationsblad; P/E-kopplingarnas riktning följer A/B-portarna (sida 503).",
    message_en: "Mixed port sizes (CM/LM): indicate the sizes per station on the manifold specification sheet; the P/E fitting direction follows the A/B ports (page 503).",
    goto_step: steg("port"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "port" }, SYM_PORTS.filter((p) => p.style === "up").map((p) => p.code)] },
    message_sv: "Vinkelport uppåt: ska en spacer (individuell SUP/EXH, SUP-stoppventil, dubbel backventil, sida 617–619) monteras, välj vinkel nedåt för att undvika kollision med kropp och rör (sida 503).",
    message_en: "Upward elbow port: if a spacer assembly (individual SUP/EXH, SUP stop valve, double check, pages 617–619) is to be mounted, select the downward elbow to avoid interference with the body and piping (page 503).",
    goto_step: steg("port"),
  });
  for (const e of SYM_PE_ENTRIES.filter((x) => x.silencer)) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "pe_entry" }, e.code] },
      message_sv: `${e.code}: inbyggd ljuddämpare — 3/5(E)-porten är pluggad och ljuddämparens utlopp sitter på motsatt sida mot P/E; skydda utloppet från vatten och vätskor (sida 502 och 512).`,
      message_en: `${e.code}: built-in silencer — the 3/5(E) port is plugged and the silencer exhaust is on the side opposite the P/E entry; keep the exhaust away from water and other liquids (pages 502 and 512).`,
      goto_step: steg("pe_entry"),
    });
  }
  for (const e of SYM_PE_ENTRIES.filter((x) => x.external_pilot)) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "pe_entry" }, e.code] },
      message_sv: `${e.code}: extern pilot — ventilerna beställs med pilottyp R, och vakuum/lågtryck (−100 kPa…0,7 MPa) kräver pilottryck 0,25–0,7 MPa (sida 404).`,
      message_en: `${e.code}: external pilot — the valves are ordered with pilot type R, and vacuum/low pressure (−100 kPa…0.7 MPa) requires a pilot pressure of 0.25–0.7 MPa (page 404).`,
      goto_step: steg("pe_entry"),
    });
  }

  // ── råd per serie och typ ──────────────────────────────────────────────
  for (const t of SYM_TYPES) {
    for (const s of SYM_SERIES) {
      if (!t.series.includes(s.code)) continue;
      const [a, b] = s.weight[t.code];
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { "==": [{ var: "type" }, t.code] }] },
        message_sv: `SS5Y${s.code}-${t.code}: P/E-portar ${s.pe_metric} (${s.pe_inch} med tumportar), flöde C ${sv(s.flow_c[t.code])} dm³/(s·bar) 1→4/2 med 2-läges gummitätad ventil, vikt ca ${sv(a)}·n + ${b} g utan ventiler (D-sub-ramp med raka kopplingar; EX600-enheterna tillkommer), IP67 (sida 426–427).`,
        message_en: `SS5Y${s.code}-${t.code}: P/E ports ${s.pe_metric} (${s.pe_inch} with inch ports), flow C ${s.flow_c[t.code]} dm³/(s·bar) 1→4/2 with a 2-position rubber seal valve, weight approx. ${a}·n + ${b} g without valves (D-sub manifold with straight fittings; the EX600 units come in addition), IP67 (pages 426–427).`,
        goto_step: steg("type"),
      });
    }
  }

  // ── råd per SI-enhet, polaritet och I/O ────────────────────────────────
  for (const u of SYM_SI_UNITS) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "si_unit" }, u.code] },
      message_sv: u.unit_pnp
        ? `${u.code}: ${u.protocol_sv} — SI-enheten ${u.unit_pnp} (PNP, minuskommun) eller ${u.unit_npn} (NPN, pluskommun) enligt polaritetskoden; SI-enhet och ändplatta ingår i rampkoden och beställs inte separat (sida 502 och 600).`
        : "0: utan SI-enhet — ventilplattan som kopplar ramp och SI-enhet medföljer omonterad; inga I/O-enheter (sida 502).",
      message_en: u.unit_pnp
        ? `${u.code}: ${u.protocol_en} — SI unit ${u.unit_pnp} (PNP, negative common) or ${u.unit_npn} (NPN, positive common) per the polarity symbol; the SI unit and end plate are part of the manifold number and are not ordered separately (pages 502 and 600).`
        : "0: without SI unit — the valve plate connecting manifold and SI unit is included but not mounted; no I/O units (page 502).",
      goto_step: steg("si_unit"),
    });
  }
  for (const p of SYM_POLARITIES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "polarity" }, p.code] },
      message_sv: `${p.code}: ${p.positive ? "pluskommun" : "minuskommun"}, ändplatta ${p.end_plate} (${p.connector_sv}); ventilerna ska ha ljus/skyddsdiod ${p.positive ? "R, U, S eller Z" : "R, U, NS eller NZ"} så att kommun stämmer (sida 502 och 504).`,
      message_en: `${p.code}: ${p.positive ? "positive common" : "negative common"}, end plate ${p.end_plate} (${p.connector_en}); the valves must have light/surge suppressor ${p.positive ? "R, U, S or Z" : "R, U, NS or NZ"} to match the common (pages 502 and 504).`,
      goto_step: steg("polarity"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "io_stations" }, SYM_IO_STATIONS.map((x) => x.code)] },
    message_sv: "I/O-enheterna (EX600-DX□/DY□/DM□/AX□/AY□/AM□/L□) ingår inte i rampkoden: ange dem per station under rampnumret, de levereras lösa och monteras av kunden enligt manualen (sida 502 och 601).",
    message_en: "The I/O units (EX600-DX□/DY□/DM□/AX□/AY□/AM□/L□) are not part of the manifold number: list them per station under the manifold number; they are shipped separately and mounted by the user per the operation manual (pages 502 and 601).",
    goto_step: steg("io_stations"),
  });

  // ── råd: ventilerna och montering ──────────────────────────────────────
  for (const t of SYM_TYPES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "type" }, t.code] },
      message_sv: `Ventilerna beställs per station med egen kod (familjen sy-plugin): SY□1${t.valve_body}0-5U1 osv., ventilen närmast D-sidan är station 1${t.code === "12" ? "; topportade ventiler bär A/B-porten (t.ex. SY3130-5U1-C6)" : ""} (sida ${t.page + 1}).`,
      message_en: `The valves are ordered per station with their own number (family sy-plugin): SY□1${t.valve_body}0-5U1 etc., the valve closest to the D side is station 1${t.code === "12" ? "; top-ported valves carry the A/B port (e.g. SY3130-5U1-C6)" : ""} (page ${t.page + 1}).`,
      goto_step: steg("type"),
    });
  }
  for (const m of SYM_MOUNTINGS) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "mounting" }, m.code] },
      message_sv: `${m.code}: ${m.din ? "DIN-skena (fastsättning sida 708)" : "direktmontering"}${m.name_plate ? ", med namnskylt" : ""}${m.station_number ? " och stationsnummer" : ""} (sida 503).`,
      message_en: `${m.code}: ${m.din ? "DIN rail mounting (fixation on page 708)" : "direct mounting"}${m.name_plate ? ", with name plate" : ""}${m.station_number ? " and station numbers" : ""} (page 503).`,
      goto_step: steg("mounting"),
    });
  }
  return rows;
}

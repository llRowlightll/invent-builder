/**
 * SV-reglerna (EX260-rampens bas) som skrivs till config_rules, byggda ur
 * modellen.
 *
 * Det som beror på två val samtidigt: stationerna mot P/E-portarnas läge
 * och SI-enhetens utgångar (dubbelkoppling/specificerad layout); DIN-
 * monteringen mot SI-enheten och DIN-skenans längd mot stationerna;
 * portstorleken mot serien. Resten är råd om ventilerna och basen.
 */
import { SV_LIMITS, SV_MOUNTINGS, SV_PE_LOCATIONS, SV_PORTS, SV_SERIES, SV_SI_UNITS, SV_STATIONS, svStationLimits } from "./sv";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type SVDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");
const namn = (k: string) => `SV${k}000`;
const over = (n: number) => SV_STATIONS.map((s) => s.code).filter((k) => Number(k) > n);
const mellan = (a: number, b: number) => SV_STATIONS.map((s) => s.code).filter((k) => Number(k) > a && Number(k) <= b);

export function buildSvDbRules(): SVDbRule[] {
  const rows: SVDbRule[] = [];
  const steg = (p: string) => `sv1000-${p}`;

  // ── stationer mot P/E-läge och SI-enhet ────────────────────────────────
  for (const pe of SV_PE_LOCATIONS) {
    const fel = over(pe.max_stations);
    if (!fel.length) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "pe" }, pe.code] }, { in: [{ var: "stations" }, fel] }] },
      message_sv: `Med P/E-portarna på ${pe.code === "U" ? "U-sidan" : "D-sidan"} tillåts 2–${pe.max_stations} stationer; fler stationer kräver portar på båda sidor (B) (sida 58).`,
      message_en: `With the P/E ports on the ${pe.code} side 2–${pe.max_stations} stations are allowed; more stations require ports on both sides (B) (page 58).`,
      goto_step: steg("pe"),
    });
  }
  for (const outputs of [32, 16]) {
    const enheter = SV_SI_UNITS.filter((u) => u.outputs === outputs).map((u) => u.code);
    const [dubbel, layout] = svStationLimits(SV_SI_UNITS.find((u) => u.outputs === outputs)!);
    const fel = over(layout);
    if (fel.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ in: [{ var: "si" }, enheter] }, { in: [{ var: "stations" }, fel] }] },
        message_sv: `SI-enheten med ${outputs} utgångar klarar högst ${layout} stationer (specificerad layout, ${outputs} magneter) (sida 58).`,
        message_en: `The SI unit with ${outputs} outputs handles at most ${layout} stations (specified layout, ${outputs} solenoids) (page 58).`,
        goto_step: steg("stations"),
      });
    }
    rows.push({
      severity: "warn",
      if_json: { and: [{ in: [{ var: "si" }, enheter] }, { in: [{ var: "stations" }, mellan(dubbel, layout)] }] },
      message_sv: `Över ${dubbel} stationer med ${outputs} utgångar kräver specificerad layout: kopplingen per station anges på rampens specifikationsblad, och dubbel-, 3- och 4-lägesventiler kan inte sitta där enkelkoppling angetts (sida 58, not 2).`,
      message_en: `More than ${dubbel} stations with ${outputs} outputs require a specified layout: state the wiring per station on the manifold specification sheet; double, 3- and 4-position valves cannot be used where single wiring is specified (page 58, note 2).`,
      goto_step: steg("stations"),
    });
  }

  // ── DIN-montering ──────────────────────────────────────────────────────
  const utanSkena = SV_MOUNTINGS.filter((m) => m.code !== "D0").map((m) => m.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "si" }, "0"] }, { in: [{ var: "mounting" }, utanSkena] }] },
    message_sv: "DIN-skenan kan inte monteras utan SI-enhet — välj D0 (DIN-fäste utan skena) och beställ skenan separat (sida 58, not 1; sida 123).",
    message_en: "The DIN rail cannot be mounted without an SI unit — choose D0 (DIN bracket without rail) and order the rail separately (page 58, note 1; page 123).",
    goto_step: steg("mounting"),
  });
  for (const m of SV_MOUNTINGS.filter((x) => x.rail_stations > 0)) {
    const fel = over(m.rail_stations);
    if (!fel.length) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "mounting" }, m.code] }, { in: [{ var: "stations" }, fel] }] },
      message_sv: `DIN-skenan ${m.code} är för ${m.rail_stations} stationer — ange en skena som är längre än rampen (sida 58).`,
      message_en: `The DIN rail ${m.code} is for ${m.rail_stations} stations — specify a rail longer than the manifold (page 58).`,
      goto_step: steg("mounting"),
    });
  }

  // ── portstorlek mot serie ──────────────────────────────────────────────
  for (const p of SV_PORTS) {
    if (p.kind === "mixed") continue;
    const ok = SV_SERIES.filter((s) => (p.kind === "metric" ? s.ports_metric : s.ports_inch).includes(p.code)).map((s) => s.code);
    const fel = SV_SERIES.map((s) => s.code).filter((k) => !ok.includes(k));
    if (!fel.length) continue;
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "port" }, p.code] }, { in: [{ var: "series" }, fel] }] },
      message_sv: `Porten ${p.code} finns för ${lista(ok.map(namn))}, inte ${lista(fel.map(namn))} (sida 58, A/B port size).`,
      message_en: `The port ${p.code} exists for ${lista(ok.map(namn), "and")}, not ${lista(fel.map(namn), "and")} (page 58, A/B port size).`,
      goto_step: steg("port"),
    });
  }

  // ── råd ────────────────────────────────────────────────────────────────
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "port" }, "M"] },
    message_sv: "Blandade portstorlekar (M) anges per station på rampens specifikationsblad (sida 58).",
    message_en: "Mixed port sizes (M) are stated per station on the manifold specification sheet (page 58).",
    goto_step: steg("port"),
  });
  const dsub = SV_SI_UNITS.filter((u) => u.connector === "D-sub").map((u) => u.code);
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "si" }, dsub] },
    message_sv: `SI-enheten med D-sub-kontakt (${dsub.join("/")}) ger IP40 i stället för IP67 (sida 58, not 3).`,
    message_en: `The SI unit with the D-sub connector (${dsub.join("/")}) gives IP40 instead of IP67 (page 58, note 3).`,
    goto_step: steg("si"),
  });
  for (const u of SV_SI_UNITS.filter((x) => x.outputs > 0)) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "si" }, u.code] },
      message_sv: `SI-enhet ${u.code}: ${u.protocol}, ${u.outputs} utgångar, ${u.polarity === "+" ? "positiv" : "negativ"} common, ${u.connector}; artikelnummer ${u.part_no} (sida 58).`,
      message_en: `SI unit ${u.code}: ${u.protocol}, ${u.outputs} outputs, ${u.polarity === "+" ? "positive" : "negative"} common, ${u.connector}; part number ${u.part_no} (page 58).`,
      goto_step: steg("si"),
    });
  }
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "supexh" }, ["R", "RS"]] },
    message_sv: "Extern pilot: X- och PE-portarna är ø4/ø5/32\" på SV1000/2000 och ø6/ø1/4\" på SV3000; arbetstryck −100 kPa till 0,7 MPa, pilot 0,25–0,7 MPa (sida 27 och 58).",
    message_en: "External pilot: the X and PE ports are ø4/ø5/32\" on SV1000/2000 and ø6/ø1/4\" on SV3000; operating pressure −100 kPa to 0.7 MPa, pilot 0.25–0.7 MPa (pages 27 and 58).",
    goto_step: steg("supexh"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "supexh" }, ["S", "RS"]] },
    message_sv: "Inbyggd ljuddämpare: håll avluftningen borta från vatten och andra vätskor (sida 58, not).",
    message_en: "Built-in silencer: keep the exhaust outlet away from water and other liquids (page 58, note).",
    goto_step: steg("supexh"),
  });
  for (const s of SV_SERIES) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "series" }, s.code] },
      message_sv: `${namn(s.code)}: P/E-port ${s.pe_port} (${s.pe_port_inch}) snabbkoppling; ventilerna SV${s.code}□00-5□□ beställs per station under basens artikelnummer, från station 1 på D-sidan (sida 58–59). Ventildata: ${sv(SV_LIMITS.pressure_mpa[0])}–${sv(SV_LIMITS.pressure_mpa[1])} MPa (dubbel ${sv(SV_LIMITS.pressure_double_mpa[0])}, 3-läges ${sv(SV_LIMITS.pressure_3pos_mpa[0])}), ${SV_LIMITS.temp_c[0]}…${SV_LIMITS.temp_c[1]} °C, ${sv(SV_LIMITS.power_w)} W, ${SV_LIMITS.enclosure} (sida 27).`,
      message_en: `${namn(s.code)}: P/E port ${s.pe_port} (${s.pe_port_inch}) One-touch fitting; the valves SV${s.code}□00-5□□ are ordered per station under the base part number, from station 1 on the D side (pages 58–59). Valve data: ${SV_LIMITS.pressure_mpa[0]}–${SV_LIMITS.pressure_mpa[1]} MPa (double ${SV_LIMITS.pressure_double_mpa[0]}, 3-position ${SV_LIMITS.pressure_3pos_mpa[0]}), ${SV_LIMITS.temp_c[0]}…${SV_LIMITS.temp_c[1]} °C, ${SV_LIMITS.power_w} W, ${SV_LIMITS.enclosure} (page 27).`,
      goto_step: steg("series"),
    });
  }
  return rows;
}

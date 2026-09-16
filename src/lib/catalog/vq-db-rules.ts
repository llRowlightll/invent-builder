/**
 * VQ-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: tätningen mot funktionen (A/B/C bara
 * gummi, K bara metall); tillvalen B/K/N mot AC och R mot A/B/C; ljus E mot
 * N; kapslingen W, underplattan och dess gänga mot serien; 200/220 V AC mot
 * underplattan utan W; CE Q mot AC. Rampens kit ges som råd.
 */
import {
  VQ_ACTUATIONS,
  VQ_CE,
  VQ_ENCLOSURE,
  VQ_FUNCTIONS,
  VQ_FUNCTION_SYMBOLS,
  VQ_LIGHT,
  VQ_LIMITS,
  VQ_PORT,
  VQ_SERIES,
  VQ_VOLTAGES,
} from "./vq";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type VQDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");

export function buildVqDbRules(): VQDbRule[] {
  const rows: VQDbRule[] = [];
  const steg = (p: string) => `vq1000-${p}`;
  const ac = VQ_VOLTAGES.filter((v) => v.ac).map((v) => v.code);
  const med = (sym: string) => VQ_FUNCTIONS.filter((f) => f.symbols.includes(sym)).map((f) => f.code);

  // ── tätningen ──────────────────────────────────────────────────────────
  const baraGummi = VQ_ACTUATIONS.filter((a) => a.rubber_only).map((a) => a.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "actuation" }, baraGummi] }, { "==": [{ var: "seal" }, "0"] }] },
    message_sv: `De 4-läges dubbla 3-portsventilerna ${lista(baraGummi)} finns bara med gummitätning (1) (sida 367 och 371, not).`,
    message_en: `The 4-position dual 3-port valves ${lista(baraGummi, "and")} exist only with the rubber seal (1) (pages 367 and 371, note).`,
    goto_step: steg("seal"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "func" }, med("K")] }, { "==": [{ var: "seal" }, "1"] }] },
    message_sv: "Högtryckstypen K (1,0 MPa) finns bara med metalltätning (0) (sida 367, not 2).",
    message_en: "The high-pressure type K (1.0 MPa) exists only with the metal seal (0) (page 367, note 2).",
    goto_step: steg("func"),
  });

  // ── tillvalen ──────────────────────────────────────────────────────────
  const dcOnly: string[] = VQ_FUNCTION_SYMBOLS.filter((s) => s.dc_only).map((s) => s.code);
  const dcKoder = VQ_FUNCTIONS.filter((f) => f.symbols.some((k) => dcOnly.includes(k))).map((f) => f.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "func" }, dcKoder] }, { in: [{ var: "voltage" }, ac] }] },
    message_sv: `Tillvalen ${lista(dcOnly)} (snabb respons, högtryck, negativ common) finns bara för DC; med AC går bara standard och extern pilot R (sida 367, tabellen Function).`,
    message_en: `The options ${lista(dcOnly, "and")} (high-speed response, high pressure, negative common) exist only for DC; with AC only standard and the external pilot R are available (page 367, Function table).`,
    goto_step: steg("func"),
  });
  const utanR = VQ_ACTUATIONS.filter((a) => a.no_external_pilot).map((a) => a.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "func" }, med("R")] }, { in: [{ var: "actuation" }, utanR] }] },
    message_sv: `Extern pilot R finns inte för de dubbla 3-portsventilerna ${lista(utanR)} (sida 367, not 5).`,
    message_en: `The external pilot R is not available for the dual 3-port valves ${lista(utanR, "and")} (page 367, note 5).`,
    goto_step: steg("func"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "light" }, VQ_LIGHT.code] }, { in: [{ var: "func" }, med("N")] }] },
    message_sv: "Utan ljus/spärrdiod (E) går inte ihop med negativ common (N): E är opolär och kan själv användas som negativ common (sida 367, not 2).",
    message_en: "Without light/surge voltage suppressor (E) cannot be combined with the negative common (N): E has no polarity and can itself be used as a negative common (page 367, note 2).",
    goto_step: steg("light"),
  });

  // ── kapsling, underplatta, CE ──────────────────────────────────────────
  const utanIp65 = VQ_SERIES.filter((s) => !s.ip65).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "enclosure" }, VQ_ENCLOSURE.code] }, { in: [{ var: "series" }, utanIp65] }] },
    message_sv: `Kapslingen W (IP65) finns bara för VQ2000, inte ${lista(utanIp65.map((k) => `VQ${k}000`))} (sida 371 och 375, not 4).`,
    message_en: `The enclosure W (IP65) exists only for VQ2000, not ${lista(utanIp65.map((k) => `VQ${k}000`), "and")} (pages 371 and 375, note 4).`,
    goto_step: steg("enclosure"),
  });
  const utanPlatta = VQ_SERIES.filter((s) => !s.subplate).map((s) => s.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "port" }, VQ_PORT.code] }, { in: [{ var: "series" }, utanPlatta] }] },
    message_sv: `Underplattan (enkelventil) finns bara för VQ2000, inte ${lista(utanPlatta.map((k) => `VQ${k}000`))} (sida 403).`,
    message_en: `The sub-plate (single unit) exists only for VQ2000, not ${lista(utanPlatta.map((k) => `VQ${k}000`), "and")} (page 403).`,
    goto_step: steg("port"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "thread" }, ""] }, { "==": [{ var: "port" }, ""] }] },
    message_sv: "Gängtypen hör till underplattan — välj underplattan 02 först (sida 403).",
    message_en: "The thread type belongs to the sub-plate — choose the sub-plate 02 first (page 403).",
    goto_step: steg("thread"),
  });
  const flKit = VQ_VOLTAGES.filter((v) => v.fl_kit_only).map((v) => v.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "port" }, VQ_PORT.code] }, { in: [{ var: "voltage" }, flKit] }, { "==": [{ var: "enclosure" }, ""] }] },
    message_sv: "Enkelventilen på underplatta med 200 eller 220 V AC kräver kapslingen W (IP65); standardutförandet (dammskyddat) går inte med de spänningarna (sida 403, not 2).",
    message_en: "The single unit on a sub-plate with 200 or 220 V AC requires the enclosure W (IP65); the standard (dust-protected) version is not compatible with those voltages (page 403, note 2).",
    goto_step: steg("enclosure"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "ce" }, VQ_CE.code] }, { in: [{ var: "voltage" }, ac] }] },
    message_sv: "CE/UKCA-märkningen Q finns bara för DC-ventilerna (sida 367, 371 och 403, not).",
    message_en: "The CE/UKCA marking Q exists only for the DC valves (pages 367, 371 and 403, note).",
    goto_step: steg("ce"),
  });

  // ── råd om rampens kit och data ────────────────────────────────────────
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "voltage" }, flKit] },
    message_sv: "200 och 220 V AC går bara i ventilramp med F-kit (D-sub) eller L-kit (sida 367 och 371, not).",
    message_en: "200 and 220 V AC are available only in a manifold with the F kit (D-sub) or L kit (pages 367 and 371, note).",
    goto_step: steg("voltage"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "light" }, VQ_LIGHT.code] },
    message_sv: "E (utan ljus/spärrdiod) går inte i ventilramp med S-kit (sida 367, not 1).",
    message_en: "E (without light/surge voltage suppressor) is not applicable to a manifold with the S kit (page 367, note 1).",
    goto_step: steg("light"),
  });
  rows.push({
    severity: "info",
    if_json: { and: [{ "==": [{ var: "enclosure" }, VQ_ENCLOSURE.code] }, { "==": [{ var: "port" }, ""] }] },
    message_sv: "IP65 (W) gäller i ventilramp med T-, L-, S- eller M-kit; på underplattan är ventilen IP65 med tätad kontakt i elanslutningen (sida 371 not, 375 not 4, 403).",
    message_en: "IP65 (W) applies in a manifold with the T, L, S or M kit; on the sub-plate the valve is IP65 with a seal connector in the electrical entry (page 371 note, 375 note 4, 403).",
    goto_step: steg("enclosure"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "port" }, VQ_PORT.code] },
    message_sv: "Underplattan 1/4 kan också beställas ensam som VQ2000-PW-02 (gängbokstaven efter 02); ventilen har plintanslutning med G 3/8-ingång (sida 403).",
    message_en: "The sub-plate 1/4 can also be ordered alone as VQ2000-PW-02 (thread letter after 02); the valve has a terminal block with a G 3/8 entry (page 403).",
    goto_step: steg("port"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "func" }, [...med("R"), ...med("N")].filter((x, i, arr) => arr.indexOf(x) === i)] },
    message_sv: "Extern pilot R och negativ common N är halvstandard — se sida 405–406 för anslutning och pilotmatning.",
    message_en: "The external pilot R and the negative common N are semi-standard — see pages 405–406 for wiring and pilot supply.",
    goto_step: steg("func"),
  });
  const L = VQ_LIMITS;
  for (const s of VQ_SERIES) {
    for (const a of VQ_ACTUATIONS) {
      const min = a.min_mpa;
      const tryck = min[0] === null ? `gummitätning från ${sv(min[1])} MPa` : `från ${sv(min[0])} MPa (metall) / ${sv(min[1])} MPa (gummi)`;
      const pressure = min[0] === null ? `rubber seal from ${min[1]} MPa` : `from ${min[0]} MPa (metal) / ${min[1]} MPa (rubber)`;
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { "==": [{ var: "actuation" }, a.code] }] },
        message_sv: `VQ${s.code}${a.code}00: arbetstryck ${tryck} upp till ${sv(L.max_mpa)} MPa (K: ${sv(L.max_mpa_k)} MPa), ${L.temp_c[0]}…${L.temp_c[1]} °C, smörjfri, ${L.impact_vibration}; effekt ${sv(L.power_w)} W DC (B/K ${sv(L.power_w_bk)} W); flöde C ${sv(s.flow_c)} dm³/(s·bar) metalltätning 1→4/2 (sida 375).`,
        message_en: `VQ${s.code}${a.code}00: operating pressure ${pressure} up to ${L.max_mpa} MPa (K: ${L.max_mpa_k} MPa), ${L.temp_c[0]}…${L.temp_c[1]} °C, no lubrication, ${L.impact_vibration}; power ${L.power_w} W DC (B/K ${L.power_w_bk} W); flow C ${s.flow_c} dm³/(s·bar) metal seal 1→4/2 (page 375).`,
        goto_step: steg("actuation"),
      });
    }
  }
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "series" }, ""] },
    message_sv: "Ventilen beställs till ventilrampen VV5Q11/VV5Q21 (kit F/P/T/L/S/M, sida 366 och 370) eller för VQ2000 på underplatta (sida 403); standard är med ljus/spärrdiod och olåst manöver (verktyg).",
    message_en: "The valve is ordered for the VV5Q11/VV5Q21 manifold (kits F/P/T/L/S/M, pages 366 and 370) or, for VQ2000, on a sub-plate (page 403); the default is with light/surge suppressor and a non-locking push override (tool required).",
    goto_step: steg("series"),
  });
  return rows;
}

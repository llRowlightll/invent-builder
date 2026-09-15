/**
 * EX500-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Nyckeln har en position per enhetstyp: protokollet hör till GW-enheten,
 * kontakttypen till ingångsenheten, längd och kontakter till grenkabeln.
 * Reglerna säger till när en position saknas eller står på fel enhet, och
 * bär enheternas data som råd.
 */
import {
  EX500_CABLE_CONNECTORS,
  EX500_CONNECTORS,
  EX500_LENGTHS,
  EX500_LIMITS,
  EX500_PROTOCOLS,
  EX500_UNITS,
} from "./ex500";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type EX500DbRule = DsbcDbRule;

export function buildEx500DbRules(): EX500DbRule[] {
  const rows: EX500DbRule[] = [];
  const steg = (p: string) => `ex500-${p}`;
  const enhet = (needs: string | null) => EX500_UNITS.filter((u) => u.needs === needs).map((u) => u.code);
  const andra = (needs: string | null) => EX500_UNITS.filter((u) => u.needs !== needs).map((u) => u.code);
  const protokoll = EX500_PROTOCOLS.map((p) => p.code);
  const kontakter = EX500_CONNECTORS.map((p) => p.code);
  const langder = EX500_LENGTHS.map((p) => p.code);
  const kabelkontakter = EX500_CABLE_CONNECTORS.map((p) => p.code);

  // ── protokollet hör till GW-enheten ────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "unit" }, enhet("protocol")] }, { "==": [{ var: "protocol" }, ""] }] },
    message_sv: `Gateway-enheten beställs med protokoll: ${protokoll.join(" eller ")} (sida 1449).`,
    message_en: `The gateway unit is ordered with a protocol: ${protokoll.join(" or ")} (page 1449).`,
    goto_step: steg("protocol"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "unit" }, andra("protocol")] }, { "!=": [{ var: "protocol" }, ""] }] },
    message_sv: "Protokollet hör till gateway-enheten G — SI-enhet, ingångsenhet och kablar har inget protokoll (sida 1449).",
    message_en: "The protocol belongs to the gateway unit G — the SI unit, input unit and cables have no protocol (page 1449).",
    goto_step: steg("protocol"),
  });

  // ── kontakttypen hör till ingångsenheten ───────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "unit" }, enhet("connector")] }, { "==": [{ var: "connector" }, ""] }] },
    message_sv: `Ingångsenheten beställs med kontakttyp: ${kontakter.join(" (M8) eller ")} (M12) (sida 1452).`,
    message_en: `The input unit is ordered with a connector type: ${kontakter.join(" (M8) or ")} (M12) (page 1452).`,
    goto_step: steg("connector"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "unit" }, andra("connector")] }, { "!=": [{ var: "connector" }, ""] }] },
    message_sv: "Kontakttypen A/B hör till ingångsenheten DXP (sida 1452).",
    message_en: "The connector type A/B belongs to the input unit DXP (page 1452).",
    goto_step: steg("connector"),
  });

  // ── längd och kontakter hör till grenkabeln ────────────────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "unit" }, enhet("cable")] }, { or: [{ "==": [{ var: "length" }, ""] }, { "==": [{ var: "cable_conn" }, ""] }] }] },
    message_sv: `Grenkabeln beställs med längd (${langder.join("/")}) och kontaktutförande (${kabelkontakter.join(" eller ")}) (sida 1457).`,
    message_en: `The branch cable is ordered with a length (${langder.join("/")}) and a connector specification (${kabelkontakter.join(" or ")}) (page 1457).`,
    goto_step: steg("length"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "unit" }, andra("cable")] }, { or: [{ "!=": [{ var: "length" }, ""] }, { "!=": [{ var: "cable_conn" }, ""] }] }] },
    message_sv: "Kabellängd och kontaktutförande hör till grenkabeln AC (sida 1457).",
    message_en: "Cable length and connector specification belong to the branch cable AC (page 1457).",
    goto_step: steg("length"),
  });

  // ── råd per enhet ──────────────────────────────────────────────────────
  const L = EX500_LIMITS;
  const info = (unit: string, sv: string, en: string, page: number) =>
    rows.push({ severity: "info", if_json: { "==": [{ var: "unit" }, unit] }, message_sv: `${sv} (sida ${page}).`, message_en: `${en} (page ${page}).`, goto_step: steg("unit") });
  info(
    "G",
    `GW-enheten: ${L.supply_vdc} V DC (styrning ±10 %, ventiler +10/−5 %), max 6,2 A varav 1,5 A per gren; ${L.branch_ports} grenportar med ${L.per_branch_io} in-/${L.per_branch_io} utgångar var, grenkabel max ${L.branch_cable_max_m} m; IP65, ${L.temp_c[0]}…${L.temp_c[1]} °C; konfigurationsfil EDS (EN2) eller GSDML (PN2) från smcworld.com`,
    `The GW unit: ${L.supply_vdc} V DC (control ±10 %, valves +10/−5 %), max 6.2 A of which 1.5 A per branch; ${L.branch_ports} branch ports with ${L.per_branch_io} inputs/${L.per_branch_io} outputs each, branch cable max ${L.branch_cable_max_m} m; IP65, ${L.temp_c[0]}…${L.temp_c[1]} °C; configuration file EDS (EN2) or GSDML (PN2) from smcworld.com`,
    1449,
  );
  info(
    "S103",
    "SI-enheten: 16 eller 32 utgångar via inbyggd omkopplare, PNP med negativ common, 24 V DC; 1,0 A från GW-enheten eller 1,5 A med Y-grenkontakt och egen matning; IP67; monteringsskruvar M3×30 medföljer",
    "The SI unit: 16 or 32 outputs via the built-in setting switch, PNP with negative common, 24 V DC; 1.0 A from the GW unit or 1.5 A with the Y branch connector and separate supply; IP67; M3×30 mounting screws included",
    1451,
  );
  info(
    "DXP",
    "Ingångsenheten: 16 PNP-ingångar, 24 V DC, max 1,3 A per enhet (0,65 A per jämn respektive udda kontaktgrupp), tillslag ≥ 11 V; IP67; DIN-skenefäste EX500-ZMA1 beställs separat",
    "The input unit: 16 PNP inputs, 24 V DC, max 1.3 A per unit (0.65 A per even and odd connector group), ON at ≥ 11 V; IP67; the DIN rail bracket EX500-ZMA1 is ordered separately",
    1452,
  );
  info(
    "AC",
    "Grenkabeln: ø6 mm, 0,25 mm², minsta böjradie 40 mm, M12 8-polig A-kodad hylsa mot GW-enheten och plugg mot enheten",
    "The branch cable: ø6 mm, 0.25 mm², minimum bending radius 40 mm, M12 8-pin A-coded socket towards the GW unit and plug towards the unit",
    1457,
  );
  info(
    "ACY01-S",
    "Y-grenkontakten sätts mellan grenkabeln och SI-enheten och matar ventilerna med 24 V DC +10/−5 % från en egen matningskabel EX500-AP□-S",
    "The Y branch connector sits between the branch cable and the SI unit and supplies the valves with 24 V DC +10/−5 % from a separate power cable EX500-AP□-S",
    1457,
  );
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "unit" }, ""] },
    message_sv: `Systemet: ${L.io_points} ingångar/${L.io_points} utgångar, max ${L.manifolds_max} ventilramper och ${L.input_units_max} ingångsenheter (max ${L.per_branch_units_max} per gren); ventiler SY3000/5000/7000, VQC1000–5000, S0700, SV1000–3000 och vakuumenheten ZK2□A — bara SY och SV är UL-godkända (sida 1448).`,
    message_en: `The system: ${L.io_points} inputs/${L.io_points} outputs, max ${L.manifolds_max} valve manifolds and ${L.input_units_max} input units (max ${L.per_branch_units_max} per branch); valves SY3000/5000/7000, VQC1000–5000, S0700, SV1000–3000 and the ZK2□A vacuum unit — only SY and SV are UL-compliant (page 1448).`,
    goto_step: steg("unit"),
  });
  return rows;
}

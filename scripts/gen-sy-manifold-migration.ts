/**
 * Genererar migrationen för SY-ventilrampen (familjen sy: SMC SY3000/5000/7000
 * plug-in typ 10/11/12 med EX600) ur den kanoniska modellen — ersätter
 * familjens påhittade mall och döper om produktraden SMC-SY.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-sy-manifold-migration.ts > supabase/migrations/<tidsstämpel>_sy.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel SS5Y3-10S6Q2-05U-C6 (sida 502),
 * rampexemplen (sida 503 och 513), porttabellen (sida 503), SMC:s
 * webbkonfigurator (SS5Y3-12S6Q22-05B-ND0) och fem uttömmande
 * korskontroller regler↔modell plus 20 000 slumpade.
 */
import {
  SYM_DIN_RAILS,
  SYM_IO_STATIONS,
  SYM_MOUNTINGS,
  SYM_ORDER_CODE_TEMPLATE,
  SYM_PE_ENTRIES,
  SYM_POLARITIES,
  SYM_PORTS,
  SYM_SERIES,
  SYM_SI_UNITS,
  SYM_SOURCE,
  SYM_STATIONS,
  SYM_TYPES,
  symBuildCode,
} from "../src/lib/catalog/sy-manifold.ts";
import { buildSyManifoldDbRules } from "../src/lib/catalog/sy-manifold-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "series", step: 1, title_sv: "Serie", title_en: "Series", required: true, type: "single_select", options: opt(SYM_SERIES) },
  { id: "type", step: 2, title_sv: "Typ (portarnas riktning)", title_en: "Type (port direction)", required: true, type: "single_select", options: opt(SYM_TYPES) },
  { id: "si_unit", step: 3, title_sv: "SI-enhet EX600 (fältbuss)", title_en: "EX600 SI unit (fieldbus)", required: true, type: "single_select", options: opt(SYM_SI_UNITS) },
  { id: "polarity", step: 4, title_sv: "SI-enhetens polaritet och ändplatta (tomt utan SI-enhet)", title_en: "SI unit output polarity and end plate (blank without SI unit)", required: false, type: "single_select", options: opt(SYM_POLARITIES) },
  { id: "io_stations", step: 5, title_sv: "Antal I/O-enheter (standard är inga)", title_en: "Number of I/O units (none is standard)", required: false, type: "single_select", options: opt(SYM_IO_STATIONS) },
  { id: "stations", step: 6, title_sv: "Antal ventilplatser", title_en: "Number of valve stations", required: true, type: "single_select", options: opt(SYM_STATIONS) },
  { id: "pe_entry", step: 7, title_sv: "P/E-portarnas placering, pilot och ljuddämpare", title_en: "P/E port entry, pilot and silencer", required: true, type: "single_select", options: opt(SYM_PE_ENTRIES) },
  { id: "port", step: 8, title_sv: "A/B-portarnas storlek (typ 10/11) eller P/E-mått (typ 12)", title_en: "A/B port size (type 10/11) or P/E size (type 12)", required: false, type: "single_select", options: opt(SYM_PORTS) },
  { id: "mounting", step: 9, title_sv: "Montering (standard är direktmontering utan skyltar)", title_en: "Mounting (direct mounting without plates is standard)", required: false, type: "single_select", options: opt(SYM_MOUNTINGS) },
  { id: "din_rail", step: 10, title_sv: "DIN-skenans tillval (standard är skena i standardlängd)", title_en: "DIN rail option (standard length rail is standard)", required: false, type: "single_select", options: opt(SYM_DIN_RAILS) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-SY ("SY3000/5000/7000 – Valve Terminal, PROFINET/EtherNet-IP via EX600,
// upp till 24 stationer") är en påhittad kod. Raden blir en SY5000-ramp typ 10
// med PROFINET-enheten EX600-SPN1 (PNP/minuskommun, M12 B-kodad matning),
// åtta platser, P/E på båda sidor och ø8-portar — allt enligt sida 502–503.
// competitor_map (4) och product_relations (5) pekar på raden via id och
// följer med. "max_pressure 10 bar" var fel: 0,7 MPa (sida 404).
const PROD = { series: "5", type: "10", si_unit: "F", polarity: "4", stations: "08", pe_entry: "B", port: "-C8" };
const KOD = symBuildCode(PROD)!;
const SER = SYM_SERIES.find((s) => s.code === PROD.series)!;
const extra = `
update products set
  sku = ${q(`SMC-${KOD}`)},
  family = 'SY',
  name = ${q(`${KOD} SY5000 valve terminal, 8 stations, PROFINET (EX600)`)},
  description = ${q(`SMC SY5000 plug-in connector connecting base manifold ${KOD}: type 10 side ported, EX600 PROFINET SI unit EX600-SPN1 (PNP, negative common) with end plate EX600-ED2 (M12 B-coded power), 8 valve stations with double wiring, P/E ports ${SER.pe_metric} on both sides, A/B ports ø8 One-touch fittings, internal pilot, direct mounting, IP67. Valves (SY5100-5U1 etc.) are ordered per station; other EX600 units (DeviceNet, PROFIBUS DP, CC-Link, EtherNet/IP, EtherCAT, wireless) and 2–24 stations via the configurator. Catalogue pages 502–503.`)},
  fieldbus = 'PROFINET',
  voltage = '24 VDC'
where sku = 'SMC-SY';

update product_specs s set value = x.value, unit = x.unit
from products p, (values
  ('fieldbus', 'PROFINET (EX600-SPN1); DeviceNet, PROFIBUS DP, CC-Link, EtherNet/IP, EtherCAT, wireless with other SI unit', null),
  ('flow_rate_l_min', ${q(`C ${SER.flow_c["10"]} dm³/(s·bar) 1→4/2 (SY5000 type 10, 2-position rubber seal valve)`)}, null),
  ('max_pressure', '7', 'bar'),
  ('stations', '8 (manifold available with 2–24)', 'stations'),
  ('solenoid_voltage', '24 VDC', null),
  ('temp_range', '-10 to +50', '°C')
) as x(key, value, unit)
where s.product_id = p.id and p.sku = ${q(`SMC-${KOD}`)} and s.key = x.key;

insert into product_specs (product_id, key, value, unit)
select p.id, x.key, x.value, x.unit
from products p
cross join lateral (values
  ('series', 'SY5000', null),
  ('manifold_type', 'Type 10 side ported, plug-in connector connecting base', null),
  ('si_unit', 'EX600-SPN1 (PROFINET, PNP)', null),
  ('port_size', 'A/B ø8, P/E ø10 One-touch fittings', null),
  ('ip_rating', 'IP67', null),
  ('weight_g', ${q(String(Math.round(SER.weight["10"][0] * 8 + SER.weight["10"][1])))}, 'g'),
  ('order_code_example', ${q(KOD)}, null),
  ('catalogue', 'SMC SY3000/5000/7000, How to Order Manifolds sida 502–503 (EX600 typ 10/11), 512–513 (typ 12), data sida 426–427', null)
) as x(key, value, unit)
where p.sku = ${q(`SMC-${KOD}`)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);

update products set ip_rating = 'IP67' where sku = ${q(`SMC-${KOD}`)} and ip_rating is null;

-- Dokumentkartan pekade på JSY-manualer (annan serie) och den äldre
-- SY-katalogen; bara det nya kapitlet hör till rampen.
delete from knowledge_doc_families where family_slug = 'sy' and source_file <> ${q(SYM_SOURCE.file)};
`;

console.log(familyMigrationSql({
  slug: "sy",
  schemaId: "SCHEMA-SY-V1",
  backupDate: "20260921",
  steps,
  template: SYM_ORDER_CODE_TEMPLATE,
  title_sv: "SMC SY ventilramp med EX600",
  title_en: "SMC SY valve terminal with EX600",
  family_title: "Ventilramp SY3000/5000/7000 plug-in typ 10/11/12 med fältbussenhet EX600, 2–24 platser",
  family_description: "SMC SY3000/5000/7000 plug-in connector connecting base manifold (type 10 side ported, 11 bottom ported, 12 top ported) with the EX600 serial transmission SI unit: DeviceNet, PROFIBUS DP, CC-Link, EtherNet/IP, EtherCAT, PROFINET (with or without IO-Link unit) or wireless, PNP/NPN with M12 or 7/8 inch power end plate, up to 9 I/O units, 2–24 valve stations (max. 32 solenoids), P/E ports on the U/D/both sides with internal or external pilot or built-in silencer, A/B One-touch fittings ø2–ø12 or inch, straight or elbow, direct or DIN rail mounting, IP67. Valves ordered per station (family sy-plugin).",
  category_slug: "valve-terminal",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildSyManifoldDbRules(),
  doc: { source_file: SYM_SOURCE.file, title: `SMC — ${SYM_SOURCE.title}` },
  header: `SY (ventilrampen): beställnyckeln enligt ${SYM_SOURCE.title} (sida 502–503 och 512–513).
GENERERAD ur src/lib/catalog/sy-manifold.ts -- redigera inte för hand.

Rättar familjen sy, som hade mallen 'SY-{stations}-{fieldbus}-{voltage}' med
påhittade värden. SMC:s rampkod är
SS5Y{serie}-{typ}S6{SI-enhet}{polaritet}{I/O}-{platser}{P/E}{port}{montering}{skena},
t.ex. SS5Y3-10S6Q2-05U-C6 (nyckelns exempel sida 502), SS5Y3-10S6Q72-05B-C6
(sida 503) och SS5Y3-12S6Q72-05B (topportad, sida 513). Portkoden bär sitt
bindestreck så att den topportade rampen utan tumportar inte får ett ensamt
"-" före monteringen (SMC:s konfigurator: SS5Y3-12S6Q2-05BD3 och
SS5Y3-12S6Q22-05B-ND0).

Produktraden SMC-SY döps om till SMC-${KOD} (SY5000, PROFINET EX600-SPN1,
åtta platser) och får katalogens data. Dokumentkartan rensas från JSY-
manualerna (annan serie) och den äldre SY-katalogen.`,
  extra,
}));

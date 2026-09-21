/**
 * Genererar migrationen för VQ-ventilrampen (familjen vq: SMC VQ1000/2000
 * basmonterad plug-in-ramp VV5Q11/VV5Q21 med kit F/P/T/L/S/M) ur den
 * kanoniska modellen — ersätter familjens påhittade mall, flyttar den till
 * kategorin valve-terminal och döper om produktraden SMC-VQ.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-vq-manifold-migration.ts > supabase/migrations/<tidsstämpel>_vq.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel VV5Q11-08C6FU1 (sida 366),
 * kitexemplen (sida 371–401), tillvalsexemplen -RS/-D0S/-D09S (sida 404–406),
 * stationstabellen (sida 375) och fyra uttömmande korskontroller
 * regler↔modell plus 20 000 slumpade.
 */
import {
  VQM_CABLES,
  VQM_CE,
  VQM_ENTRIES,
  VQM_KITS,
  VQM_OPTIONS,
  VQM_ORDER_CODE_TEMPLATE,
  VQM_PORTS,
  VQM_SERIES,
  VQM_SI_UNITS,
  VQM_SOURCE,
  VQM_STATIONS,
  vqmBuildCode,
} from "../src/lib/catalog/vq-manifold.ts";
import { buildVqManifoldDbRules } from "../src/lib/catalog/vq-manifold-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const o = (param: string) => opt(VQM_OPTIONS.filter((x) => x.param === param));
const steps: Step[] = [
  { id: "series", step: 1, title_sv: "Serie", title_en: "Series", required: true, type: "single_select", options: opt(VQM_SERIES) },
  { id: "stations", step: 2, title_sv: "Antal ventilplatser", title_en: "Number of valve stations", required: true, type: "single_select", options: opt(VQM_STATIONS) },
  { id: "port", step: 3, title_sv: "Cylinderportar (A/B)", title_en: "Cylinder ports (A/B)", required: true, type: "single_select", options: opt(VQM_PORTS) },
  { id: "kit", step: 4, title_sv: "Kit (elanslutning)", title_en: "Kit (electrical entry)", required: true, type: "single_select", options: opt(VQM_KITS) },
  { id: "entry", step: 5, title_sv: "Kontaktens riktning (F- och P-kit)", title_en: "Connector entry direction (F and P kits)", required: false, type: "single_select", options: opt(VQM_ENTRIES) },
  { id: "cable", step: 6, title_sv: "Kabel (F-, P-, L- och M-kit)", title_en: "Cable (F, P, L and M kits)", required: false, type: "single_select", options: opt(VQM_CABLES) },
  { id: "si_unit", step: 7, title_sv: "SI-enhet (S-kit)", title_en: "SI unit (S kit)", required: false, type: "single_select", options: opt(VQM_SI_UNITS) },
  { id: "ac", step: 8, title_sv: "Växelspänning (standard är DC)", title_en: "AC voltage (DC is standard)", required: false, type: "single_select", options: o("ac") },
  { id: "check", step: 9, title_sv: "Backventil (standard är ingen)", title_en: "Back pressure check valve (none is standard)", required: false, type: "single_select", options: o("check") },
  { id: "din", step: 10, title_sv: "DIN-skena (standard är direktmontering)", title_en: "DIN rail (direct mounting is standard)", required: false, type: "single_select", options: o("din") },
  { id: "regulator", step: 11, title_sv: "Regulatorenheter (VQ1000)", title_en: "Regulator units (VQ1000)", required: false, type: "single_select", options: o("regulator") },
  { id: "ejector", step: 12, title_sv: "Ejektorenhet (VQ1000)", title_en: "Ejector unit (VQ1000)", required: false, type: "single_select", options: o("ejector") },
  { id: "wiring", step: 13, title_sv: "Koppling (standard är dubbelkoppling)", title_en: "Wiring (double wiring is standard)", required: false, type: "single_select", options: o("wiring") },
  { id: "nameplate", step: 14, title_sv: "Namnskylt", title_en: "Name plate", required: false, type: "single_select", options: o("nameplate") },
  { id: "ext_pilot", step: 15, title_sv: "Pilot (standard är intern)", title_en: "Pilot (internal is standard)", required: false, type: "single_select", options: o("ext_pilot") },
  { id: "silencer", step: 16, title_sv: "Avluftning (standard är R-portar)", title_en: "Exhaust (R ports are standard)", required: false, type: "single_select", options: o("silencer") },
  { id: "ip65", step: 17, title_sv: "Kapsling (VQ2000)", title_en: "Enclosure (VQ2000)", required: false, type: "single_select", options: o("ip65") },
  { id: "ce", step: 18, title_sv: "CE/UKCA-märkning", title_en: "CE/UKCA marking", required: false, type: "single_select", options: opt([VQM_CE]) },
];

// Familjen låg i kategorin valve som "VQ Valve"; rampen hör till valve-terminal.
const preamble = `
update configurator_families set category_slug = 'valve-terminal', name = 'VQ' where slug = 'vq';
`;

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-VQ ("VQ – 5-Port Solenoid Valve, single valve, 3 sizes VQ1/2/3000") är
// påhittad: VQ3000 finns inte, och enkelventilen är familjen vq1000
// (SMC-VQ1101-51). Raden blir nyckelns eget exempel VV5Q11-08C6FU1 (sida 366)
// och flyttas till kategorin valve-terminal. product_relations (3) pekar på
// raden via id och följer med. "operating_pressure 0…0.7" var fel: 0,1–0,7 MPa
// (sida 375).
const PROD = { series: "1", stations: "08", port: "C6", kit: "F", entry: "U", cable: "1" };
const KOD = vqmBuildCode(PROD)!;
const extra = `
update products set
  sku = ${q(`SMC-${KOD}`)},
  family = 'VQ',
  name = ${q(`${KOD} VQ1000 valve manifold, 8 stations, D-sub connector`)},
  description = ${q(`SMC VQ1000 base mounted plug-in manifold ${KOD}: 8 valve stations, cylinder ports ø6 One-touch fittings, P/R ports ø8, F kit D-sub connector (25 pins) with top entry and 1.5 m cable, double wiring, internal pilot, direct mounting. Valves (VQ1100-51 etc., family vq1000) are ordered per station; kits P/T/L/S/M, 1–24 stations and options (back pressure check valve, DIN rail, external pilot, built-in silencer, IP65 on VQ2000) via the configurator. Catalogue pages 366 and 376.`)},
  category_id = (select id from categories where slug = 'valve-terminal'),
  voltage = '24 VDC'
where sku = 'SMC-VQ';

update product_specs s set value = x.value, unit = x.unit
from products p, (values
  ('function', 'Manifold for 5-port plug-in valves VQ1000 (VQ1100-51 etc.)', null),
  ('operating_pressure', '0.1–0.7', 'MPa'),
  ('series', 'VQ1000', null),
  ('temp_range', '-10…+50', '°C')
) as x(key, value, unit)
where s.product_id = p.id and p.sku = ${q(`SMC-${KOD}`)} and s.key = x.key;

delete from product_specs s using products p
where s.product_id = p.id and p.sku = ${q(`SMC-${KOD}`)} and s.key = 'actuation';

insert into product_specs (product_id, key, value, unit)
select p.id, x.key, x.value, x.unit
from products p
cross join lateral (values
  ('stations', '8 (manifold available with 1–24 depending on kit)', 'stations'),
  ('kit', 'F: D-sub connector 25 pins, top entry, 1.5 m cable', null),
  ('port_size', 'A/B ø6, P/R ø8 One-touch fittings', null),
  ('flow_c', '0.70–0.85 dm³/(s·bar) per valve (2-position single, metal/rubber seal)', null),
  ('max_pressure', '7', 'bar'),
  ('solenoid_voltage', '24 VDC (12 VDC, 100/110/200/220 VAC valves available)', null),
  ('order_code_example', ${q(KOD)}, null),
  ('catalogue', 'SMC VQ1000/2000, How to Order Manifold sida 366 (VQ1000) och 370 (VQ2000), F-kit sida 376, data sida 374–375', null)
) as x(key, value, unit)
where p.sku = ${q(`SMC-${KOD}`)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "vq",
  schemaId: "SCHEMA-VQ-V1",
  backupDate: "20260921",
  steps,
  template: VQM_ORDER_CODE_TEMPLATE,
  title_sv: "SMC VQ1000/2000 ventilramp",
  title_en: "SMC VQ1000/2000 valve manifold",
  family_title: "Ventilramp VQ1000/2000 basmonterad plug-in (VV5Q11/VV5Q21), kit D-sub/flatkabel/plint/kabel/seriell/rundkontakt, 1–24 platser",
  family_description: "SMC VQ1000/2000 base mounted plug-in manifold VV5Q11/VV5Q21 for the VQ1000/2000 plug-in valves (family vq1000): F kit D-sub connector, P kit flat ribbon cable, T kit terminal block box, L kit lead wire, S kit serial transmission EX120/124 (DeviceNet, CC-Link, CompoNet) and M kit circular connector (VQ2000), 1–24 stations depending on kit, cylinder ports ø3.2–ø8 One-touch fittings or M5 (metric or inch, straight or elbow, mixed), options for 200/220 VAC, back pressure check valves, DIN rail, regulator and ejector units (VQ1000), special wiring, name plate, external pilot, built-in silencer and IP65 (VQ2000), CE/UKCA. The EX510 kit (to be discontinued) is not included.",
  category_slug: "valve-terminal",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildVqManifoldDbRules(),
  doc: { source_file: VQM_SOURCE.file, title: `SMC — ${VQM_SOURCE.title}` },
  header: `VQ (ventilrampen): beställnyckeln enligt ${VQM_SOURCE.title} (sida 366, 370 och 404–406).
GENERERAD ur src/lib/catalog/vq-manifold.ts -- redigera inte för hand.

Rättar familjen vq, som hade mallen 'VQ-{size}-{function}-{voltage}-{connection}'
med påhittade värden (enkelventilen är redan familjen vq1000). SMC:s rampkod är
VV5Q{serie}1-{platser}{port}{kit}{anslutning}{kabel}{SI-enhet}-{tillval…}-{ce},
t.ex. VV5Q11-08C6FU1 (nyckelns exempel sida 366), VV5Q11-08C6T0 (sida 385),
VV5Q11-08C6SV (sida 397) och VV5Q11-08C6FU1-D09S (sida 406). Tillvalen
skrivs alfabetiskt i en grupp. EX510-kitet (utgående) ingår inte.

Familjen flyttas till kategorin valve-terminal. Produktraden SMC-VQ döps om
till SMC-${KOD} och får katalogens data.`,
  preamble,
  extra,
}));

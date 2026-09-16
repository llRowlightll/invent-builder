/**
 * Genererar migrationen för VF (familjen vf3000: VF1000/3000/5000 enkelventil)
 * ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-vf-migration.ts > supabase/migrations/<tidsstämpel>_vf.sql
 *
 * VERIFIERINGENS STYRKA: nyckel och exempel (VF3130-5G1-01, VF3140KT-5GZD1-02,
 * VF3130-5LO1-02), tabellerna för kroppsmodell, port, spänning och
 * ljus/spärrdiod, X500/X600, och 18 000+ kombinationer regler↔modell.
 */
import {
  VF_ACTUATIONS,
  VF_BODIES,
  VF_BODY_OPTS,
  VF_BRACKET,
  VF_COIL,
  VF_ENTRIES,
  VF_LIGHTS,
  VF_MTO,
  VF_ORDER_CODE_TEMPLATE,
  VF_OVERRIDES,
  VF_PORTS,
  VF_PRESSURE,
  VF_SERIES,
  VF_SOURCE,
  VF_THREADS,
  VF_VOLTAGES,
  vfBuildCode,
} from "../src/lib/catalog/vf.ts";
import { buildVfDbRules } from "../src/lib/catalog/vf-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "series", step: 1, title_sv: "Serie", title_en: "Series", required: true, type: "single_select", options: opt(VF_SERIES) },
  { id: "actuation", step: 2, title_sv: "Funktion", title_en: "Type of actuation", required: true, type: "single_select", options: opt(VF_ACTUATIONS) },
  { id: "body", step: 3, title_sv: "Kroppsmodell", title_en: "Body model", required: true, type: "single_select", options: opt(VF_BODIES) },
  { id: "body_opt", step: 4, title_sv: "Pilotavluftning", title_en: "Body option (pilot exhaust)", required: true, type: "single_select", options: opt(VF_BODY_OPTS) },
  { id: "pressure", step: 5, title_sv: "Tryckutförande (standard är 0,7 MPa)", title_en: "Pressure specification (0.7 MPa is standard)", required: false, type: "single_select", options: opt([VF_PRESSURE]) },
  { id: "coil", step: 6, title_sv: "Spole (standard är utan strömsparkrets)", title_en: "Coil specification (standard coil is default)", required: false, type: "single_select", options: opt([VF_COIL]) },
  { id: "voltage", step: 7, title_sv: "Märkspänning", title_en: "Rated voltage", required: true, type: "single_select", options: opt(VF_VOLTAGES) },
  { id: "entry", step: 8, title_sv: "Elanslutning", title_en: "Electrical entry", required: true, type: "single_select", options: opt(VF_ENTRIES) },
  { id: "light", step: 9, title_sv: "Ljus/spärrdiod", title_en: "Light/surge voltage suppressor", required: false, type: "single_select", options: opt(VF_LIGHTS) },
  { id: "override", step: 10, title_sv: "Manuell manöver (standard är olåst tryckknapp)", title_en: "Manual override (non-locking push type is standard)", required: false, type: "single_select", options: opt(VF_OVERRIDES) },
  { id: "port", step: 11, title_sv: "Portstorlek (kroppsportad) eller underplatta (basmonterad)", title_en: "Port size (body ported) or sub-plate (base mounted)", required: false, type: "single_select", options: opt(VF_PORTS) },
  { id: "thread", step: 12, title_sv: "Gängtyp (standard är Rc)", title_en: "Thread type (Rc is standard)", required: false, type: "single_select", options: opt(VF_THREADS) },
  { id: "bracket", step: 13, title_sv: "Fäste", title_en: "Bracket", required: false, type: "single_select", options: opt([VF_BRACKET]) },
  { id: "mto", step: 14, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(VF_MTO) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-VF3130-5G-02 "VF3130 5/2 bistabil G1/4": VF31□0 är 2-läges ENKEL
// magnet (monostabil; bistabil är VF32□0), koden saknar den fasta ettan
// och gängbokstaven F som "G1/4" kräver (sida 292), och max_pressure 10
// är provtrycket (standard 0,7 MPa = 7 bar). Raden döps om i stället
// för att raderas (ingen tabell pekar på den).
const exempel = vfBuildCode({ series: "3", actuation: "1", body: "3", body_opt: "0", voltage: "5", entry: "G", port: "02", thread: "F" })!;
const extra = `
update products set
  sku = 'SMC-${exempel}',
  name = 'VF3130 5/2 monostabil G 1/4',
  description = 'Pilot operated 5 port solenoid valve VF3000, 2-position single (monostable), body ported G 1/4, 24 V DC, grommet 300 mm, individual pilot exhaust. Order code ${exempel} (catalogue page 292).'
where sku = 'SMC-VF3130-5G-02';

update product_specs s set value = '5/2 monostabil (2-läges enkel magnet)'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'function';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'VF3000'),
  ('min_pressure_mpa', '0.15'),
  ('temp_range', '-10 to +50'),
  ('max_frequency_hz', '10'),
  ('power_w', '1.5'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC VF1000/3000/5000, How to Order sida 292 (kroppsportad) och 306 (basmonterad), data sida 293')
) as x(key, value)
where p.sku = 'SMC-${exempel}'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "vf3000",
  schemaId: "SCHEMA-VF3000-V1",
  backupDate: "20260916",
  steps,
  template: VF_ORDER_CODE_TEMPLATE,
  title_sv: "SMC VF1000/3000/5000 pilotstyrd 5-portsventil, enkelventil",
  title_en: "SMC VF1000/3000/5000 pilot operated 5 port solenoid valve, single unit",
  family_title: "Pilotstyrd 5-portsventil VF1000/3000/5000, enkelventil kroppsportad eller basmonterad",
  family_description: "SMC VF1000/3000/5000 pilot operated 5 port solenoid valve, single unit: 2-position single/double and 3-position closed/exhaust/pressure centre, body ported (M5–3/8) or base mounted with sub-plate (1/4–1/2), DC or AC, grommet, plug, DIN or conduit terminal.",
  category_slug: "valve",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildVfDbRules(),
  doc: { source_file: VF_SOURCE.file, title: `SMC — ${VF_SOURCE.title}` },
  header: `VF: beställnyckeln enligt ${VF_SOURCE.title} (sida 292 och 306).
GENERERAD ur src/lib/catalog/vf.ts -- redigera inte för hand.

Rättar familjen vf3000, som hade mallen 'VF3000-{size}-{function}-{voltage}-{connection}'
med påhittade värden. SMC:s kod är
VF{serie}{funktion}{kropp}{avluftning}{tryck}{spole}-{spänning}{anslutning}{ljus}{manöver}1-{port}{gänga}-{fäste}-{special},
t.ex. VF3130-5G1-01 (nyckelns exempel sida 292) och VF3140KT-5GZD1-02
(basmonterad, sida 306). Serien VF1000/5000, kroppsmodell, avluftning,
högtryck, strömsparkrets, tretton elanslutningar, ljus/spärrdiod, manöver,
gänga, fäste och specialutförandena fanns inte alls.

SMC-VF3130-5G-02 döps om till SMC-${exempel} och blir monostabil.`,
  extra,
}));

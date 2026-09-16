/**
 * Genererar migrationen för SY (familjen sy3000: SY3000/5000/7000/9000
 * enkelventil) ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-sy-migration.ts > supabase/migrations/<tidsstämpel>_sy.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel (SY5120-5L-01, SY5240-5L), M8-svansen
 * (sida 961), port-, spännings-, anslutnings- och ljustabellerna, -X20/-X90/
 * -X701, och 88 000+ kombinationer regler↔modell.
 */
import {
  SY_ACTUATIONS,
  SY_BODIES,
  SY_BRACKETS,
  SY_CE,
  SY_COIL,
  SY_ENTRIES,
  SY_LIGHTS,
  SY_MTO,
  SY_ORDER_CODE_TEMPLATE,
  SY_OVERRIDES,
  SY_PILOT,
  SY_PORTS,
  SY_SERIES,
  SY_SOURCE,
  SY_THREADS,
  SY_VOLTAGES,
  syBuildCode,
} from "../src/lib/catalog/sy.ts";
import { buildSyDbRules } from "../src/lib/catalog/sy-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "series", step: 1, title_sv: "Serie", title_en: "Series", required: true, type: "single_select", options: opt(SY_SERIES) },
  { id: "actuation", step: 2, title_sv: "Funktion", title_en: "Type of actuation", required: true, type: "single_select", options: opt(SY_ACTUATIONS) },
  { id: "body", step: 3, title_sv: "Kropp", title_en: "Body type", required: true, type: "single_select", options: opt(SY_BODIES) },
  { id: "pilot", step: 4, title_sv: "Pilot (standard är intern pilot)", title_en: "Pilot type (internal pilot is standard)", required: false, type: "single_select", options: opt([SY_PILOT]) },
  { id: "coil", step: 5, title_sv: "Spole (standard är utan strömsparkrets)", title_en: "Coil specification (standard coil is default)", required: false, type: "single_select", options: opt([SY_COIL]) },
  { id: "voltage", step: 6, title_sv: "Märkspänning", title_en: "Rated voltage", required: true, type: "single_select", options: opt(SY_VOLTAGES) },
  { id: "entry", step: 7, title_sv: "Elanslutning", title_en: "Electrical entry", required: true, type: "single_select", options: opt(SY_ENTRIES) },
  { id: "light", step: 8, title_sv: "Ljus/spärrdiod", title_en: "Light/surge voltage suppressor", required: false, type: "single_select", options: opt(SY_LIGHTS) },
  { id: "override", step: 9, title_sv: "Manuell manöver (standard är olåst tryckknapp)", title_en: "Manual override (non-locking push type is standard)", required: false, type: "single_select", options: opt(SY_OVERRIDES) },
  { id: "port", step: 10, title_sv: "Portstorlek (kroppsportad) eller underplatta (basmonterad)", title_en: "Port size (body ported) or sub-plate (base mounted)", required: false, type: "single_select", options: opt(SY_PORTS) },
  { id: "thread", step: 11, title_sv: "Gängtyp (standard är Rc)", title_en: "Thread type (Rc is standard)", required: false, type: "single_select", options: opt(SY_THREADS) },
  { id: "bracket", step: 12, title_sv: "Fäste", title_en: "Bracket", required: false, type: "single_select", options: opt(SY_BRACKETS) },
  { id: "mto", step: 13, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(SY_MTO) },
  { id: "ce", step: 14, title_sv: "CE/UKCA-märkning", title_en: "CE/UKCA marking", required: false, type: "single_select", options: opt([SY_CE]) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-SY3120-5LOZ "SY3120 5/2 monostabil G1/8, sub-bas": koden är den
// kroppsportade ventilen (20) utan sin obligatoriska port, medan namnet
// säger underplatta ("sub-bas") med G 1/8 — det är den basmonterade
// SY3140-5LOZ-01F (sida 748). Raden döps om i stället för att raderas
// (ingen tabell pekar på den); max_pressure 10 var provtrycket.
const exempel = syBuildCode({ series: "3", actuation: "1", body: "40", voltage: "5", entry: "LO", light: "Z", port: "01", thread: "F" })!;
const extra = `
update products set
  sku = 'SMC-${exempel}',
  name = 'SY3140 5/2 monostabil, underplatta G 1/8',
  description = '5 port solenoid valve SY3000, 2-position single (monostable), base mounted on a sub-plate G 1/8, 24 V DC, L plug connector without connector, with light/surge voltage suppressor. Order code ${exempel} (catalogue page 748).'
where sku = 'SMC-SY3120-5LOZ';

update product_specs s set value = '5/2 monostabil (2-läges enkel magnet)'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'function';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'SY3000'),
  ('mounting', 'Basmonterad på underplatta G 1/8'),
  ('min_pressure_mpa', '0.15'),
  ('temp_range', '-10 to +50'),
  ('max_frequency_hz', '10'),
  ('power_w', '0.35 (med ljus 0.4)'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC SY3000/5000/7000/9000, How to Order sida 732 (kroppsportad) och 748 (basmonterad), data sida 733')
) as x(key, value)
where p.sku = 'SMC-${exempel}'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "sy3000",
  schemaId: "SCHEMA-SY3000-V1",
  backupDate: "20260916",
  steps,
  template: SY_ORDER_CODE_TEMPLATE,
  title_sv: "SMC SY3000/5000/7000/9000 5-portsventil, enkelventil",
  title_en: "SMC SY3000/5000/7000/9000 5 port solenoid valve, single unit",
  family_title: "5-portsventil SY3000/5000/7000/9000, enkelventil kroppsportad eller basmonterad",
  family_description: "SMC SY3000/5000/7000/9000 5 port solenoid valve, single unit: 2-position single/double and 3-position, body ported (M5–3/8 or One-touch fittings) or base mounted with sub-plate (1/8–1/2), DC or AC, grommet, plug, DIN or M8 connector, power saving circuit, -X20/-X90/-X701.",
  category_slug: "valve",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildSyDbRules(),
  doc: { source_file: SY_SOURCE.file, title: `SMC — ${SY_SOURCE.title}` },
  header: `SY: beställnyckeln enligt ${SY_SOURCE.title} (sida 732 och 748).
GENERERAD ur src/lib/catalog/sy.ts -- redigera inte för hand.

Rättar familjen sy3000, som hade mallen 'SY3000-{size}-{function}-{voltage}-{connection}'
med påhittade värden. SMC:s kod är
SY{serie}{funktion}{kropp}{pilot}{spole}-{spänning}{anslutning}{ljus}{manöver}-{port}{gänga}-{fäste}-{special}-{ce},
t.ex. SY5120-5L-01 (kroppsportad, sida 732) och SY5240-5L (basmonterad,
sida 748). Serierna 5000/7000/9000, kropp, extern pilot, strömsparkrets,
nio spänningar, 27 elanslutningar (M8 med kabellängd), ljus/spärrdiod,
manöver, port och gänga per serie, fästen och -X20/-X90/-X701 fanns inte alls.

SMC-SY3120-5LOZ döps om till SMC-${exempel} (underplatta G 1/8 enligt namnet).`,
  extra,
}));

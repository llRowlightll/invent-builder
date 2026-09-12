/**
 * Genererar migrationen för CCIV ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-cciv-migration.ts > supabase/migrations/<tidsstämpel>_cciv.sql
 *
 * VERIFIERINGENS STYRKA: Metal Work trycker en beställNYCKEL, inte en lista på
 * färdiga artikelnummer. Garantin är alltså "koden följer nyckeln och bryter
 * inte mot dess fotnoter" -- samma nivå som P1D och OSP-P, svagare än KPZ:s
 * där varje nummer gick att slå upp.
 */
import {
  CCIV_BORES,
  CCIV_CONNECTIONS,
  CCIV_FITTINGS,
  CCIV_LIMITS,
  CCIV_MAGNETS,
  CCIV_MATERIALS,
  CCIV_ORDER_CODE_TEMPLATE,
  CCIV_SOURCE,
  CCIV_STROKE_MIN_MM,
  CCIV_TYPES,
  ccivWeightG,
} from "../src/lib/catalog/cciv.ts";
import { buildCcivDbRules } from "../src/lib/catalog/cciv-db-rules.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMA_ID = "SCHEMA-CCIV-V1";
const out: string[] = [];
const strokeMax = Math.max(...CCIV_BORES.map((b) => b.stroke_max_mm));

out.push(`-- CCIV: beställnyckeln enligt ${CCIV_SOURCE.title},
-- ${CCIV_SOURCE.file} avsnitt ${CCIV_SOURCE.section}, utgåva ${CCIV_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/cciv.ts -- redigera inte för hand.
--
-- DEN HÄR FAMILJEN STOD SOM BLOCKERAD med motiveringen att cylinderns egen
-- beställtabell inte fanns i den inlästa texten. Den fanns. Jag hade läst
-- left(content, 700) av de sex stycken som nämner CCIV och dragit slutsatsen
-- av början. Nyckeln låg 3 000 tecken in i stycke 49.
--
-- Rättar fem fel:
--   1. order_code_template var 'CCIV-{bore_mm}-{stroke_mm}-{cushioning}{sensing}',
--      som ger "CCIV-20-100-PA". Metal Works kod är POSITIONELL och fjorton
--      tecken: "2300320050CP22".
--   2. 'cushioning' hade koderna P, PPV och PPSA. Det är FESTOS DSBC-koder,
--      lånade till en Metal Work-familj vars nyckel inte har någon
--      dämpningsposition alls.
--   3. 'sensing' hade "med sensorspår" och "utan". CCIV har ingen sådan
--      position -- den har en MAGNETposition (magnetisk, omagnetisk, utan
--      stick-slip), och katalogen skriver "Magnet for sensors: YES" för
--      samtliga borrningar. "Utan sensorspår" fanns aldrig.
--   4. Borrningslistan hade 20, 25 och 32. Katalogen har fyra: Ø40 saknades.
--   5. stroke_min_mm var 1 och stroke_max_mm 1000. Katalogen säger 5 mm som
--      minsta slag och 200 mm (Ø20/25) respektive 300 mm (Ø32/40) som tak.
--
-- SEX POSITIONER SAKNADES HELT: typ, verkningssätt, magnet, material,
-- tätningar och elektrisk respektive pneumatisk anslutning. Utan dem går
-- ingen CCIV att beställa.
--
-- NYCKELNS POSITIONER TRE OCH FYRA har ingen egen rubrik i katalogens tabell,
-- bara värdelistor. De lästes av sidan som BILD -- textutvinningen lägger
-- kolumnerna i en annan ordning än tabellen, och att gissa där vore samma fel
-- som P1D:s position 10 redan gjort en gång i det här projektet.

begin;

create schema if not exists backup;
create table if not exists backup.cciv_before_20260912 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'cciv'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'cciv'
  union all
  select 'spec', s.id::text, s.key, s.value
  from product_specs s join products p on p.id = s.product_id
  where lower(p.family) = 'cciv';
`);

// ── schemat ─────────────────────────────────────────────────────────────────
const opt = (rows: Array<{ code: string; label_sv: string }>) =>
  rows.map((r) => ({ v: r.code, label: r.label_sv }));

const boreOpts = CCIV_BORES.map((b) => ({ v: b.code, label: `Ø${b.bore_mm} mm` }));
const steps = [
  { id: "type", step: 1, title: "Type", title_sv: "Utförande", title_en: "Type", required: true, type: "single_select", options: opt(CCIV_TYPES) },
  { id: "bore", step: 2, title: "Bore", title_sv: "Borrning", title_en: "Bore", required: true, type: "single_select", options: boreOpts },
  { id: "stroke_mm", step: 3, title: "Stroke", title_sv: "Slaglängd", title_en: "Stroke", required: true, type: "numeric", min: CCIV_STROKE_MIN_MM, max: strokeMax, unit: "mm" },
  { id: "magnet", step: 4, title: "Piston", title_sv: "Kolv", title_en: "Piston", required: true, type: "single_select", options: opt(CCIV_MAGNETS) },
  { id: "material", step: 5, title: "Piston rod", title_sv: "Kolvstång", title_en: "Piston rod", required: true, type: "single_select", options: opt(CCIV_MATERIALS) },
  { id: "connection", step: 6, title: "Electrical connection", title_sv: "Elektrisk anslutning", title_en: "Electrical connection", required: true, type: "single_select", options: opt(CCIV_CONNECTIONS) },
  { id: "fittings", step: 7, title: "Pneumatic connection", title_sv: "Pneumatisk anslutning", title_en: "Pneumatic connection", required: true, type: "single_select", options: opt(CCIV_FITTINGS) },
];

out.push(`
insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(SCHEMA_ID)}, ${q(JSON.stringify({ version: "1.0", steps }))}::jsonb,
        'Metal Work CCIV kompaktcylinder med integrerad ventil',
        'Metal Work CCIV compact cylinder with integrated valve', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  stroke_min_mm = ${CCIV_STROKE_MIN_MM},
  stroke_max_mm = ${strokeMax},
  order_code_template = ${q(CCIV_ORDER_CODE_TEMPLATE)},
  rules_schema_id = ${q(SCHEMA_ID)}
where slug = 'cciv';
`);

// ── parametrar ──────────────────────────────────────────────────────────────
//
// Verkningssätt och tätningar har ETT värde var i katalogen. De erbjuds inte
// som val -- det vore att be kunden välja mellan ett alternativ -- men de
// måste stå i koden, så mallen skriver dem som fasta tecken.
const paramRows = [
  { param_key: "type", label: "Utförande", param_type: "select", sort_order: 1, required: true, min_value: null, max_value: null },
  { param_key: "bore", label: "Borrning", param_type: "select", sort_order: 2, required: true, min_value: null, max_value: null },
  { param_key: "stroke_mm", label: "Slaglängd", param_type: "number", sort_order: 3, required: true, min_value: CCIV_STROKE_MIN_MM, max_value: strokeMax },
  { param_key: "magnet", label: "Kolv", param_type: "select", sort_order: 4, required: true, min_value: null, max_value: null },
  { param_key: "material", label: "Kolvstång", param_type: "select", sort_order: 5, required: true, min_value: null, max_value: null },
  { param_key: "connection", label: "Elektrisk anslutning", param_type: "select", sort_order: 6, required: true, min_value: null, max_value: null },
  { param_key: "fittings", label: "Pneumatisk anslutning", param_type: "select", sort_order: 7, required: true, min_value: null, max_value: null },
];

const valueRows = [
  ...opt(CCIV_TYPES).map((o, i) => ({ param_key: "type", code: o.v, label: o.label, sort_order: i })),
  ...boreOpts.map((o, i) => ({ param_key: "bore", code: o.v, label: o.label, sort_order: i })),
  ...opt(CCIV_MAGNETS).map((o, i) => ({ param_key: "magnet", code: o.v, label: o.label, sort_order: i })),
  ...opt(CCIV_MATERIALS).map((o, i) => ({ param_key: "material", code: o.v, label: o.label, sort_order: i })),
  ...opt(CCIV_CONNECTIONS).map((o, i) => ({ param_key: "connection", code: o.v, label: o.label, sort_order: i })),
  ...opt(CCIV_FITTINGS).map((o, i) => ({ param_key: "fittings", code: o.v, label: o.label, sort_order: i })),
];

out.push(`
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'cciv';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'cciv';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'cciv';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'cciv';
`);

// ── reglerna ────────────────────────────────────────────────────────────────
out.push(`
delete from config_rules where schema_id = ${q(SCHEMA_ID)};

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(SCHEMA_ID)}, r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements(${q(JSON.stringify(buildCcivDbRules()))}::jsonb) r;
`);

// ── produktraderna ──────────────────────────────────────────────────────────
//
// MW-CCIV-20 och MW-CCIV-32 är familjerader utan slaglängd, samma sak som
// EGC-FA och ELEKTRO, och lämnas orörda. Specifikationerna kompletteras med
// katalogens tekniska data.
const specRows = CCIV_BORES
  .filter((b) => ["20", "32"].includes(b.code))
  .map((b) => ({
    sku: `MW-CCIV-${b.bore_mm}`,
    bore_mm: b.bore_mm,
    stroke_max_mm: b.stroke_max_mm,
    stroke_standard_max_mm: b.stroke_standard_max_mm,
    speed: `${b.speed_out_ms} / ${b.speed_in_ms} m/s`,
    weight_base_kg: b.weight_base_g / 1000,
    weight_50mm_kg: ccivWeightG(b.code, 50)! / 1000,
  }));

out.push(`
insert into product_specs (product_id, key, value)
select p.id, v.key, v.value
from jsonb_to_recordset(${q(JSON.stringify(specRows))}::jsonb)
       as r(sku text, bore_mm int, stroke_max_mm int, stroke_standard_max_mm int,
            speed text, weight_base_kg numeric, weight_50mm_kg numeric)
join products p on p.sku = r.sku
cross join lateral (values
  ('stroke_min_mm', '${CCIV_STROKE_MIN_MM}'),
  ('stroke_max_mm', r.stroke_max_mm::text),
  ('stroke_standard_max_mm', r.stroke_standard_max_mm::text),
  ('max_speed', r.speed),
  ('pressure_range', '${CCIV_LIMITS.pressure_min_bar}–${CCIV_LIMITS.pressure_max_bar} bar'),
  ('temp_range', '${CCIV_LIMITS.temp_min_c}–${CCIV_LIMITS.temp_max_c} °C'),
  ('voltage', '${CCIV_LIMITS.voltage}'),
  ('power', '${CCIV_LIMITS.power_w} W'),
  ('duty_cycle', '${CCIV_LIMITS.duty}'),
  ('valve_function', '5/2 monostabil magnetventil'),
  ('mode_of_operation', 'Dubbelverkande'),
  ('magnetic_piston', 'Ja'),
  ('air_quality', '${CCIV_LIMITS.air_quality}'),
  ('order_code_length', '${CCIV_LIMITS.code_length}')
) as v(key, value)
where not exists (
  select 1 from product_specs x where x.product_id = p.id and x.key = v.key
);

-- Tryckområdet stod inte alls, och det är snävare än en vanlig cylinders:
-- CCIV kräver minst ${CCIV_LIMITS.pressure_min_bar} bar för att ventilen ska slå om, och
-- tål högst ${CCIV_LIMITS.pressure_max_bar}.
update product_specs s set value = '${CCIV_LIMITS.pressure_min_bar}–${CCIV_LIMITS.pressure_max_bar} bar'
where s.key in ('pressure_range', 'max_pressure')
  and s.product_id in (select id from products where lower(family) = 'cciv');

commit;
`);

console.log(out.join("\n"));

/**
 * Genererar migrationen för MFH ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-mfh-migration.ts > supabase/migrations/<tidsstämpel>_mfh.sql
 *
 * VERIFIERINGENS STYRKA: hög. Katalogen listar 76 färdiga artiklar med
 * artikelnummer, och modellen reproducerar varje namn ur sina egna fält.
 *
 * PRODUKTRADERNA RÖRS FÖRSIKTIGT. Familjen har två rader, och ingen av dem går
 * att belägga rakt av:
 *   FESTO-4573    -- artikelnummer 4573 finns INTE bland katalogens 76.
 *   FE-MFH-5-1-8  -- hemmagjord SKU, och namnet "MFH-5/2-D-1-S G1/8" är inte
 *                    Festos form. Festo skriver "MFH-5-1/8-S", artikel 10348.
 *
 * Att byta SKU vore att röra något sju tabeller kan peka på, och att lägga in
 * alla 76 artiklar vore ett SORTIMENTSBESLUT som inte är mitt. Migrationen
 * rättar därför NAMN och SPECIFIKATIONER, och lämnar SKU och status i fred.
 */
import {
  MFH_ARTICLES,
  MFH_FUNCTIONS,
  MFH_LIMITS,
  MFH_ORDER_CODE_TEMPLATE,
  MFH_SERIES,
  MFH_SOURCE,
  MFH_THREADS,
  mfhByType,
  mfhTech,
} from "../src/lib/catalog/mfh.ts";
import { buildMfhDbRules } from "../src/lib/catalog/mfh-db-rules.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMA_ID = "SCHEMA-MFH-V1";
const out: string[] = [];

const steps = [
  {
    id: "series", step: 1, title_sv: "Ventiltyp", title_en: "Valve type",
    required: true, type: "single_select",
    options: MFH_SERIES.map((s) => ({ v: s.code, label: s.label_sv })),
  },
  {
    id: "fn", step: 2, title_sv: "Ventilfunktion", title_en: "Valve function",
    required: true, type: "single_select",
    options: MFH_FUNCTIONS.map((f) => ({ v: f.code, label: f.label_sv })),
  },
  {
    id: "thread", step: 3, title_sv: "Anslutning", title_en: "Connection",
    required: true, type: "single_select",
    options: MFH_THREADS.map((t) => {
      const tech = mfhTech("3", t.code) ?? mfhTech("5", t.code)!;
      return { v: t.code, label: `${t.label_sv} — ${tech.flow_lmin} l/min, DN ${tech.nominal_size_mm}` };
    }),
  },
  {
    id: "ext_pilot", step: 4, title_sv: "Pilotluft", title_en: "Pilot air",
    required: false, type: "single_select",
    options: [{ v: "S", label: "Extern pilotluft" }],
  },
  {
    id: "atex", step: 5, title_sv: "ATEX", title_en: "ATEX",
    required: false, type: "single_select",
    options: [{ v: "EX", label: `ATEX ${MFH_LIMITS.atex_gas.split(" ")[0]} ${MFH_LIMITS.atex_gas.split(" ")[1]}` }],
  },
  {
    id: "b_variant", step: 6, title_sv: "Utförande", title_en: "Version",
    required: false, type: "single_select",
    options: [{ v: "B", label: "B-utförande (endast VL/O i G1/8)" }],
  },
];

out.push(`-- MFH: artikelnamnen enligt ${MFH_SOURCE.title}, utgåva ${MFH_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/mfh.ts -- redigera inte för hand.
--
-- FAMILJEN VAR KOPPLAD TILL FEL DOKUMENT. Databasen pekade på
-- festo-MH1-203291.pdf, "Solenoid valves MH1, miniature" -- en helt annan
-- ventil, där strängen "MFH" förekommer noll gånger. Kopplingen stod som en
-- familjeslug i ingest-skriptet, och den slugen är dokumentation, inte en
-- utsaga om att någon undersökt saken.
--
-- Rättar fyra fel:
--   1. order_code_template var 'MFH-{size}-{function}-{voltage}-{connection}'.
--      Ingen av de fyra positionerna finns i katalogen. Festos artikelnamn är
--      "MFH-3-1/8-S-EX": serie, funktion, gänga, pilotluft, ATEX.
--   2. Serien var låst till MFH. Katalogen har ÅTTA serier med artiklar --
--      MFH, MOFH, JMFH, JMFDH, JH, JDH, VL och VL/O -- och de skiljer sig i
--      om de är magnet- eller pneumatikmanövrerade och om de är bistabila.
--   3. 'voltage' fanns som position. Spänningen sitter i SPOLEN, som beställs
--      separat ("Electrical connection: Via F coil, to be ordered separately").
--      Ventilen har ingen spänningsposition.
--   4. Ventilfunktionen (3/2 eller 5/2) saknades, trots att den står i
--      artikelnamnets andra position.
--
-- TVÅ KODSYSTEM SOM INTE ÄR SAMMA SAK: katalogens typkod skriver G18 och EX4,
-- artikelnamnet 1/8 och EX, och de två sista positionerna kommer i OMVÄND
-- ordning (typkod: EX före pilotluft; namn: -S före -EX). Modellen bygger
-- ARTIKELNAMNET, eftersom det är det som paras med ett artikelnummer.

begin;

create schema if not exists backup;
create table if not exists backup.mfh_before_20260912 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'mfh'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'mfh'
  union all
  select 'produkt', p.id::text, p.sku, p.name
  from products p where lower(p.family) = 'mfh';

insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(SCHEMA_ID)}, ${q(JSON.stringify({ version: "1.0", steps }))}::jsonb,
        'Festo Tiger Classic ventil',
        'Festo Tiger Classic valve', 'valve')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  order_code_template = ${q(MFH_ORDER_CODE_TEMPLATE)},
  rules_schema_id = ${q(SCHEMA_ID)}
where slug = 'mfh';
`);

const paramRows = steps.map((s) => ({
  param_key: s.id, label: s.title_sv, param_type: "select",
  sort_order: s.step, required: s.required, min_value: null, max_value: null,
}));
const valueRows = steps.flatMap((s) =>
  s.options.map((o, i) => ({ param_key: s.id, code: o.v, label: o.label, sort_order: i }))
);

out.push(`
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'mfh';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'mfh';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'mfh';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'mfh';

delete from config_rules where schema_id = ${q(SCHEMA_ID)};

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(SCHEMA_ID)}, r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements(${q(JSON.stringify(buildMfhDbRules()))}::jsonb) r;
`);

// ── produktraderna ──────────────────────────────────────────────────────────
const s = mfhByType("MFH-5-1/8-S")!;
const tech = mfhTech("5", "1/8")!;

out.push(`
-- FE-MFH-5-1-8 heter "MFH-5/2-D-1-S G1/8". Det är ingen Festo-form, men
-- avsikten är entydig: en 5/2 med extern pilotluft i G1/8. Katalogens artikel
-- heter "${s.type}" och har artikelnummer ${s.part_no}.
--
-- SKU:n rörs INTE. Att byta den vore att röra något sju tabeller kan peka på,
-- och raden fungerar. Namnet och specifikationerna rättas.
update products set
  name = 'Festo ${s.type} Tiger Classic 5/2-ventil, G1/8, extern pilotluft',
  description = 'Magnetventil ur Festos Tiger Classic-serie. Katalogens '
    || 'artikelnummer ${s.part_no}. Sätesventil, mjuktätande, ${tech.flow_lmin} l/min, '
    || 'DN ${tech.nominal_size_mm}. Spolen beställs separat.',
  updated_at = now()
where sku = 'FE-MFH-5-1-8';

-- FESTO-4573: artikelnumret finns INTE bland katalogens 76. Det kan vara en
-- äldre artikel eller en spole -- katalogen svarar inte på det, och jag gissar
-- inte. Raden lämnas orörd så när som på att specifikationerna görs
-- konsekventa med katalogens gemensamma data.

insert into product_specs (product_id, key, value)
select p.id, v.key, v.value
from products p
cross join lateral (values
  ('catalogue_part_no', '${s.part_no}'),
  ('type_code', '${s.type}'),
  ('valve_function', '5/2-vägs, monostabil'),
  ('design', 'Sätesventil, mjuktätande'),
  ('nominal_size_mm', '${tech.nominal_size_mm}'),
  ('flow_lmin', '${tech.flow_lmin}'),
  ('pilot_air', 'Extern'),
  ('weight_g', '${tech.weight_g}'),
  ('max_pressure', '${tech.pressure_max_bar} bar'),
  ('pilot_pressure', '${MFH_LIMITS.pilot_pressure_min_bar}–${MFH_LIMITS.pilot_pressure_max_bar} bar'),
  ('temp_ambient', '${MFH_LIMITS.temp_ambient_min_c}–${MFH_LIMITS.temp_ambient_max_c} °C'),
  ('temp_media', '${MFH_LIMITS.temp_media_min_c}–${MFH_LIMITS.temp_media_max_c} °C'),
  ('ip_rating', '${MFH_LIMITS.ip_rating}'),
  ('material_housing', '${MFH_LIMITS.housing}'),
  ('material_seals', '${MFH_LIMITS.seals}'),
  ('electrical_connection', 'Via F-spole, beställs separat')
) as v(key, value)
where p.sku = 'FE-MFH-5-1-8'
  and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = v.key);

-- Spänningen sitter inte i ventilen. Båda raderna bar solenoid_voltage = 24 VDC
-- som om det vore en egenskap hos ventilen; katalogen är uttrycklig:
-- "Electrical connection: Via F coil, to be ordered separately".
update product_specs s set key = 'coil_voltage_ordered_separately'
where s.key = 'solenoid_voltage'
  and s.product_id in (select id from products where lower(family) = 'mfh');

commit;
`);

console.log(out.join("\n"));

/**
 * Genererar migrationen för OSP-P ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-osp-p-migration.ts > supabase/migrations/<tidsstämpel>_osp_p.sql
 *
 * SKILLNADEN MOT KPZ, som är värd att förstå innan man läser utfallet:
 * AVENTICS trycker varje KPZ-artikelnummer i en tabell, så där kunde varje
 * rad slås upp i katalogen. Parker trycker för OSP-P en beställNYCKEL och ett
 * enda exempel. Verifieringen blir därför "koden följer nyckeln", inte "koden
 * står i katalogen". Det är en svagare garanti, och den ska kallas vid sitt
 * namn.
 */
import {
  OSPP_BORES,
  OSPP_LIMITS,
  OSPP_SOURCE,
  OSPP_STROKE,
  buildOsppCode,
} from "../src/lib/catalog/osp-p.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMA_ID = "SCHEMA-OSP-P-V1";
const MALL = "OSPP{bore_mm}00000{stroke_mm#5}000000000";
const out: string[] = [];

/** De sex rader som finns i dag, med borrning och slag ur deras egna namn. */
const BEFINTLIGA: Array<[string, number, number]> = [
  ["OSPP160000001000000000", 16, 100],
  ["OSPP250000002500000000", 25, 250],
  ["OSPP320000005000000000", 32, 500],
  ["OSPP400000010000000000", 40, 1000],
  ["OSPP500000010000000000", 50, 1000],
  ["OSPP630000010000000000", 63, 1000],
];

out.push(`-- OSP-P: beställnyckeln enligt ${OSPP_SOURCE.title}, katalog ${OSPP_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/osp-p.ts -- redigera inte för hand.
--
-- Rättar fem fel:
--   1. order_code_template var 'OSP-P{bore_mm}-{stroke_mm}', som ger
--      "OSP-P25-1100". Parkers kod är POSITIONELL med FAST längd: exakt 25
--      tecken, alltid.
--   2. stroke_max_mm var 14000. Katalogen säger 5500 för samtliga borrningar
--      -- maxvärdet var 2,5 gånger för högt.
--   3. stroke_min_mm var 100. Katalogen säger 1.
--   4. Borrningslistan var 16,20,25,32,40,50,63,80. Katalogen har
--      10,16,25,32,40,50,63,80 -- Ø10 saknades och Ø20 är påhittad.
--   5. Produktraderna var 22 tecken långa och motsade sina egna namn:
--      OSPP160000001000000000 bär "01000" på slagpositionerna, alltså 1000 mm,
--      i en rad som heter "Ø16 100mm".
--
-- Optionspositionerna (7-11 och 17-25, fjorton stycken) erbjuds INTE. Katalogen
-- listar fältnamnen men textutvinningen har lagt dem i en annan ordning än
-- kolumnerna, så vilket fält som sitter var går inte att avgöra. Varje fält har
-- ett nolläge, så en standardcylinder byggs med nollor rakt igenom -- det är
-- sant och beställbart. Att gissa mappningen vore samma fel som P1D:s
-- position 10 redan gjort en gång i det här projektet.

begin;

create schema if not exists backup;
create table if not exists backup.osp_p_before_20260912 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'osp-p'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'osp-p'
  union all
  select 'produkt', p.id::text, p.sku, p.name
  from products p where lower(p.family) = 'osp-p';
`);

// ── schemat ─────────────────────────────────────────────────────────────────
const boreOpts = OSPP_BORES.map((b) => ({ v: b.code, label: `Ø${b.bore_mm} mm` }));
const steps = [
  { id: "bore_mm", step: 1, title: "Piston diameter", title_sv: "Kolvdiameter", title_en: "Piston diameter", required: true, type: "single_select", options: boreOpts },
  { id: "stroke_mm", step: 2, title: "Stroke", title_sv: "Slaglängd", title_en: "Stroke", required: true, type: "numeric", min: OSPP_STROKE.min, max: OSPP_STROKE.max, unit: "mm" },
];

out.push(`
insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(SCHEMA_ID)}, ${q(JSON.stringify({ version: "1.0", steps }))}::jsonb,
        'Parker OSP-P kolvstångslös cylinder', 'Parker OSP-P rodless cylinder', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  stroke_min_mm = ${OSPP_STROKE.min},
  stroke_max_mm = ${OSPP_STROKE.max},
  order_code_template = ${q(MALL)},
  rules_schema_id = ${q(SCHEMA_ID)}
where slug = 'osp-p';
`);

// ── parametrar ──────────────────────────────────────────────────────────────
const paramRows = [
  { param_key: "bore_mm", label: "Kolvdiameter", param_type: "select", sort_order: 1, required: true, min_value: null, max_value: null },
  { param_key: "stroke_mm", label: "Slaglängd", param_type: "number", sort_order: 2, required: true, min_value: OSPP_STROKE.min, max_value: OSPP_STROKE.max },
];
const valueRows = boreOpts.map((o, i) => ({ param_key: "bore_mm", code: o.v, label: o.label, sort_order: i }));

out.push(`
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'osp-p';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'osp-p';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, false
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'osp-p';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'osp-p';
`);

// ── produktraderna ──────────────────────────────────────────────────────────
//
// Borrning och slag behålls -- de stod i radernas namn och är rimliga val.
// Bara KODEN rättas, från 22 teckens hemmasnickeri till katalogens 25.
const nya = BEFINTLIGA.map(([gammal, bore, stroke]) => {
  const kod = buildOsppCode(bore, stroke);
  if (!kod) throw new Error(`kunde inte bygga kod för Ø${bore} ${stroke}mm`);
  const b = OSPP_BORES.find((x) => x.bore_mm === bore)!;
  return {
    gammal,
    sku: kod,
    bore_mm: bore,
    stroke_mm: stroke,
    name: `Parker OSP-P Ø${bore} kolvstångslös cylinder, ${stroke} mm slag`,
    weight_kg: Number((b.weight_base_kg + (stroke / 100) * b.weight_per_100mm_kg).toFixed(3)),
  };
});

out.push(`
-- Ut med de felformade koderna, in med katalogens form. Borrning och slag är
-- desamma -- bara kodningen var fel.
update products set status = 'discontinued', updated_at = now()
where lower(family) = 'osp-p' and length(sku) <> 25;

insert into products (sku, name, description, family, brand_id, category_id,
                      availability, lead_time_days, status, weight_kg)
select r.sku, r.name,
       'Kolvstångslös bandcylinder ur Parkers OSP-P-serie. Dubbelverkande, '
         || 'justerbar dämpning, magnetkolv. Max ${OSPP_LIMITS.pressure_max_bar} bar, '
         || '${OSPP_LIMITS.temp_min_c} till +${OSPP_LIMITS.temp_max_c} °C.',
       'OSP-P',
       (select id from brands where slug = 'parker'),
       (select id from categories where slug = 'cylinder'),
       'order', 21, 'active', r.weight_kg
from jsonb_to_recordset(${q(JSON.stringify(nya))}::jsonb)
       as r(sku text, name text, weight_kg numeric)
on conflict (sku) do update set
  name = excluded.name, description = excluded.description,
  family = excluded.family, status = 'active',
  weight_kg = excluded.weight_kg, updated_at = now();

delete from product_specs where product_id in (
  select id from products where lower(family) = 'osp-p' and length(sku) = 25
);

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from jsonb_to_recordset(${q(JSON.stringify(nya))}::jsonb)
       as r(sku text, bore_mm int, stroke_mm int, weight_kg numeric)
join products p on p.sku = r.sku
cross join lateral (values
  ('bore_mm', r.bore_mm::text),
  ('stroke_mm', r.stroke_mm::text),
  ('cylinder_type', 'Rodless band cylinder'),
  ('mode_of_operation', 'Double-acting'),
  ('magnetic_piston', 'Yes'),
  ('cushioning', 'Adjustable'),
  ('max_pressure', '${OSPP_LIMITS.pressure_max_bar} bar'),
  ('temp_range', '${OSPP_LIMITS.temp_min_c}–${OSPP_LIMITS.temp_max_c} °C'),
  ('weight_kg', r.weight_kg::text)
) as s(key, value);

commit;
`);

console.log(out.join("\n"));

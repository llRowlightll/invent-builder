-- OSP-P: beställnyckeln enligt Parker Rodless Pneumatic Cylinders, OSP-P Series, katalog 0900P-7.
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


insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-OSP-P-V1', '{"version":"1.0","steps":[{"id":"bore_mm","step":1,"title":"Piston diameter","title_sv":"Kolvdiameter","title_en":"Piston diameter","required":true,"type":"single_select","options":[{"v":"10","label":"Ø10 mm"},{"v":"16","label":"Ø16 mm"},{"v":"25","label":"Ø25 mm"},{"v":"32","label":"Ø32 mm"},{"v":"40","label":"Ø40 mm"},{"v":"50","label":"Ø50 mm"},{"v":"63","label":"Ø63 mm"},{"v":"80","label":"Ø80 mm"}]},{"id":"stroke_mm","step":2,"title":"Stroke","title_sv":"Slaglängd","title_en":"Stroke","required":true,"type":"numeric","min":1,"max":5500,"unit":"mm"}]}'::jsonb,
        'Parker OSP-P kolvstångslös cylinder', 'Parker OSP-P rodless cylinder', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  stroke_min_mm = 1,
  stroke_max_mm = 5500,
  order_code_template = 'OSPP{bore_mm}00000{stroke_mm#5}000000000',
  rules_schema_id = 'SCHEMA-OSP-P-V1'
where slug = 'osp-p';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'osp-p';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'osp-p';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, false
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"bore_mm","label":"Kolvdiameter","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"stroke_mm","label":"Slaglängd","param_type":"number","sort_order":2,"required":true,"min_value":1,"max_value":5500}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'osp-p';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"bore_mm","code":"10","label":"Ø10 mm","sort_order":0},{"param_key":"bore_mm","code":"16","label":"Ø16 mm","sort_order":1},{"param_key":"bore_mm","code":"25","label":"Ø25 mm","sort_order":2},{"param_key":"bore_mm","code":"32","label":"Ø32 mm","sort_order":3},{"param_key":"bore_mm","code":"40","label":"Ø40 mm","sort_order":4},{"param_key":"bore_mm","code":"50","label":"Ø50 mm","sort_order":5},{"param_key":"bore_mm","code":"63","label":"Ø63 mm","sort_order":6},{"param_key":"bore_mm","code":"80","label":"Ø80 mm","sort_order":7}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'osp-p';


-- Ut med de felformade koderna, in med katalogens form. Borrning och slag är
-- desamma -- bara kodningen var fel.
update products set status = 'discontinued', updated_at = now()
where lower(family) = 'osp-p' and length(sku) <> 25;

insert into products (sku, name, description, family, brand_id, category_id,
                      availability, lead_time_days, status, weight_kg)
select r.sku, r.name,
       'Kolvstångslös bandcylinder ur Parkers OSP-P-serie. Dubbelverkande, '
         || 'justerbar dämpning, magnetkolv. Max 8 bar, '
         || '-10 till +80 °C.',
       'OSP-P',
       (select id from brands where slug = 'parker'),
       (select id from categories where slug = 'cylinder'),
       'order', 21, 'active', r.weight_kg
from jsonb_to_recordset('[{"gammal":"OSPP160000001000000000","sku":"OSPP160000000100000000000","bore_mm":16,"stroke_mm":100,"name":"Parker OSP-P Ø16 kolvstångslös cylinder, 100 mm slag","weight_kg":0.32},{"gammal":"OSPP250000002500000000","sku":"OSPP250000000250000000000","bore_mm":25,"stroke_mm":250,"name":"Parker OSP-P Ø25 kolvstångslös cylinder, 250 mm slag","weight_kg":1.143},{"gammal":"OSPP320000005000000000","sku":"OSPP320000000500000000000","bore_mm":32,"stroke_mm":500,"name":"Parker OSP-P Ø32 kolvstångslös cylinder, 500 mm slag","weight_kg":3.21},{"gammal":"OSPP400000010000000000","sku":"OSPP400000001000000000000","bore_mm":40,"stroke_mm":1000,"name":"Parker OSP-P Ø40 kolvstångslös cylinder, 1000 mm slag","weight_kg":6.1},{"gammal":"OSPP500000010000000000","sku":"OSPP500000001000000000000","bore_mm":50,"stroke_mm":1000,"name":"Parker OSP-P Ø50 kolvstångslös cylinder, 1000 mm slag","weight_kg":9.19},{"gammal":"OSPP630000010000000000","sku":"OSPP630000001000000000000","bore_mm":63,"stroke_mm":1000,"name":"Parker OSP-P Ø63 kolvstångslös cylinder, 1000 mm slag","weight_kg":15.66}]'::jsonb)
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
from jsonb_to_recordset('[{"gammal":"OSPP160000001000000000","sku":"OSPP160000000100000000000","bore_mm":16,"stroke_mm":100,"name":"Parker OSP-P Ø16 kolvstångslös cylinder, 100 mm slag","weight_kg":0.32},{"gammal":"OSPP250000002500000000","sku":"OSPP250000000250000000000","bore_mm":25,"stroke_mm":250,"name":"Parker OSP-P Ø25 kolvstångslös cylinder, 250 mm slag","weight_kg":1.143},{"gammal":"OSPP320000005000000000","sku":"OSPP320000000500000000000","bore_mm":32,"stroke_mm":500,"name":"Parker OSP-P Ø32 kolvstångslös cylinder, 500 mm slag","weight_kg":3.21},{"gammal":"OSPP400000010000000000","sku":"OSPP400000001000000000000","bore_mm":40,"stroke_mm":1000,"name":"Parker OSP-P Ø40 kolvstångslös cylinder, 1000 mm slag","weight_kg":6.1},{"gammal":"OSPP500000010000000000","sku":"OSPP500000001000000000000","bore_mm":50,"stroke_mm":1000,"name":"Parker OSP-P Ø50 kolvstångslös cylinder, 1000 mm slag","weight_kg":9.19},{"gammal":"OSPP630000010000000000","sku":"OSPP630000001000000000000","bore_mm":63,"stroke_mm":1000,"name":"Parker OSP-P Ø63 kolvstångslös cylinder, 1000 mm slag","weight_kg":15.66}]'::jsonb)
       as r(sku text, bore_mm int, stroke_mm int, weight_kg numeric)
join products p on p.sku = r.sku
cross join lateral (values
  ('bore_mm', r.bore_mm::text),
  ('stroke_mm', r.stroke_mm::text),
  ('cylinder_type', 'Rodless band cylinder'),
  ('mode_of_operation', 'Double-acting'),
  ('magnetic_piston', 'Yes'),
  ('cushioning', 'Adjustable'),
  ('max_pressure', '8 bar'),
  ('temp_range', '-10–80 °C'),
  ('weight_kg', r.weight_kg::text)
) as s(key, value);

commit;


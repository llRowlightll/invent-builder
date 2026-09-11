-- KPZ: beställtabellen enligt AVENTICS Series KPZ, short-stroke and compact cylinders, 2015-08-05.
-- GENERERAD ur src/lib/catalog/kpz.ts -- redigera inte för hand.
--
-- Rättar fyra fel:
--   1. order_code_template var 'KPZ-{bore_mm}-{stroke_mm}', som ger "KPZ-40-50".
--      AVENTICS artikelnummer har formen 0822394004. Strängen "KPZ-" följd av
--      en siffra förekommer inte en enda gång i tillverkarens katalog.
--   2. Ø20 saknades. Katalogen har nio borrningar, databasen listade åtta.
--   3. Slaglängden var ett fritt tal. Beställtabellen säljer elva längder,
--      5-100 mm, och inget däremellan.
--   4. Inga villkor fanns. Tabellen lämnar sex rutor tomma: de tre minsta
--      borrningarna saknar 80 och 100 mm.
--
-- Parametrarnas code-kolumn bär INDEX, inte millimeter -- det är vad som gör att
-- mallen kan producera ett riktigt artikelnummer.

begin;

create schema if not exists backup;
create table if not exists backup.kpz_before_20260911 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'kpz'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'kpz';


insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-KPZ-V1', '{"version":"1.0","steps":[{"id":"bore_mm","step":1,"title":"Piston diameter","title_sv":"Kolvdiameter","title_en":"Piston diameter","required":true,"type":"single_select","options":[{"v":"0","label":"Ø16 mm"},{"v":"1","label":"Ø20 mm"},{"v":"2","label":"Ø25 mm"},{"v":"3","label":"Ø32 mm"},{"v":"4","label":"Ø40 mm"},{"v":"5","label":"Ø50 mm"},{"v":"6","label":"Ø63 mm"},{"v":"7","label":"Ø80 mm"},{"v":"8","label":"Ø100 mm"}]},{"id":"stroke_mm","step":2,"title":"Stroke","title_sv":"Slaglängd","title_en":"Stroke","required":true,"type":"single_select","options":[{"v":"000","label":"5 mm"},{"v":"001","label":"10 mm"},{"v":"002","label":"15 mm"},{"v":"003","label":"20 mm"},{"v":"004","label":"25 mm"},{"v":"005","label":"30 mm"},{"v":"006","label":"40 mm"},{"v":"007","label":"50 mm"},{"v":"008","label":"60 mm"},{"v":"009","label":"80 mm"},{"v":"010","label":"100 mm"}]}]}'::jsonb,
        'AVENTICS KPZ kompaktcylinder', 'AVENTICS KPZ compact cylinder', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;


-- Slagintervallet är beställtabellens, inte teknikens: 5-100 mm. Tekniska data
-- tillåter 300 mm (500 för Ø80 och Ø100), men de längderna går genom AVENTICS
-- egen konfigurator och är inte lagervara.
update configurator_families set
  stroke_min_mm = 5,
  stroke_max_mm = 100,
  order_code_template = '082239{bore_mm}{stroke_mm}',
  rules_schema_id = 'SCHEMA-KPZ-V1'
where slug = 'kpz';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'kpz';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'kpz';


insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"bore_mm","label":"Kolvdiameter","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"stroke_mm","label":"Slaglängd","param_type":"select","sort_order":2,"required":true,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'kpz';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"bore_mm","code":"0","label":"Ø16 mm","sort_order":0},{"param_key":"bore_mm","code":"1","label":"Ø20 mm","sort_order":1},{"param_key":"bore_mm","code":"2","label":"Ø25 mm","sort_order":2},{"param_key":"bore_mm","code":"3","label":"Ø32 mm","sort_order":3},{"param_key":"bore_mm","code":"4","label":"Ø40 mm","sort_order":4},{"param_key":"bore_mm","code":"5","label":"Ø50 mm","sort_order":5},{"param_key":"bore_mm","code":"6","label":"Ø63 mm","sort_order":6},{"param_key":"bore_mm","code":"7","label":"Ø80 mm","sort_order":7},{"param_key":"bore_mm","code":"8","label":"Ø100 mm","sort_order":8},{"param_key":"stroke_mm","code":"000","label":"5 mm","sort_order":0},{"param_key":"stroke_mm","code":"001","label":"10 mm","sort_order":1},{"param_key":"stroke_mm","code":"002","label":"15 mm","sort_order":2},{"param_key":"stroke_mm","code":"003","label":"20 mm","sort_order":3},{"param_key":"stroke_mm","code":"004","label":"25 mm","sort_order":4},{"param_key":"stroke_mm","code":"005","label":"30 mm","sort_order":5},{"param_key":"stroke_mm","code":"006","label":"40 mm","sort_order":6},{"param_key":"stroke_mm","code":"007","label":"50 mm","sort_order":7},{"param_key":"stroke_mm","code":"008","label":"60 mm","sort_order":8},{"param_key":"stroke_mm","code":"009","label":"80 mm","sort_order":9},{"param_key":"stroke_mm","code":"010","label":"100 mm","sort_order":10}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'kpz';


delete from config_rules where schema_id = 'SCHEMA-KPZ-V1';

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-KPZ-V1', r.severity, r.if_json, r.message_sv, r.message_en, r.goto_step
from jsonb_to_recordset('[{"severity":"error","if_json":{"and":[{"in":[{"var":"bore_mm"},["0","1","2"]]},{"in":[{"var":"stroke_mm"},["009","010"]]}]},"message_sv":"Katalogen listar inte den kombinationen. Ø16, Ø20 och Ø25 finns i slaglängder upp till 60 mm; 80 och 100 mm börjar vid Ø32.","message_en":"The catalogue does not list that combination. Ø16, Ø20 and Ø25 are available up to 60 mm stroke; 80 and 100 mm start at Ø32.","goto_step":"kpz-tom-ruta"}]'::jsonb)
       as r(severity text, if_json jsonb, message_sv text, message_en text, goto_step text);

commit;


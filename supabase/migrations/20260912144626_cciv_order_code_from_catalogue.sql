-- CCIV: beställnyckeln enligt Metal Work Compact Cylinder with Integrated Valve, Series CCIV,
-- Metal_Work_General_Catalogue.pdf avsnitt A1.136–A1.140, utgåva Cod. 9910204 - IM37 - 09/2026.
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


insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-CCIV-V1', '{"version":"1.0","steps":[{"id":"type","step":1,"title":"Type","title_sv":"Utförande","title_en":"Type","required":true,"type":"single_select","options":[{"v":"23","label":"UNITOP-centrumavstånd, hangängad kolvstång"},{"v":"24","label":"UNITOP-centrumavstånd, hongängad kolvstång"},{"v":"25","label":"ISO-centrumavstånd, hangängad kolvstång"},{"v":"26","label":"ISO-centrumavstånd, hongängad kolvstång"}]},{"id":"bore","step":2,"title":"Bore","title_sv":"Borrning","title_en":"Bore","required":true,"type":"single_select","options":[{"v":"20","label":"Ø20 mm"},{"v":"25","label":"Ø25 mm"},{"v":"32","label":"Ø32 mm"},{"v":"40","label":"Ø40 mm"}]},{"id":"stroke_mm","step":3,"title":"Stroke","title_sv":"Slaglängd","title_en":"Stroke","required":true,"type":"numeric","min":5,"max":300,"unit":"mm"},{"id":"magnet","step":4,"title":"Piston","title_sv":"Kolv","title_en":"Piston","required":true,"type":"single_select","options":[{"v":"0","label":"Magnetisk kolv"},{"v":"S","label":"Omagnetisk kolv"},{"v":"G","label":"Utan stick-slip"}]},{"id":"material","step":5,"title":"Piston rod","title_sv":"Kolvstång","title_en":"Piston rod","required":true,"type":"single_select","options":[{"v":"C","label":"Kolvstång i hårdförkromat C45"},{"v":"X","label":"Kolvstång och mutter i rostfritt"}]},{"id":"connection","step":6,"title":"Electrical connection","title_sv":"Elektrisk anslutning","title_en":"Electrical connection","required":true,"type":"single_select","options":[{"v":"2","label":"Plug-in-kontakt"},{"v":"M","label":"M8-kontakt"}]},{"id":"fittings","step":7,"title":"Pneumatic connection","title_sv":"Pneumatisk anslutning","title_en":"Pneumatic connection","required":true,"type":"single_select","options":[{"v":"1","label":"M7-gängade portar"},{"v":"2","label":"Insticksanslutning Ø4 och ljuddämpare"},{"v":"3","label":"Insticksanslutning Ø4 och dämpade utloppsstryp"},{"v":"4","label":"Insticksanslutning Ø6 och ljuddämpare"},{"v":"5","label":"Insticksanslutning Ø6 och dämpade utloppsstryp"}]}]}'::jsonb,
        'Metal Work CCIV kompaktcylinder med integrerad ventil',
        'Metal Work CCIV compact cylinder with integrated valve', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  stroke_min_mm = 5,
  stroke_max_mm = 300,
  order_code_template = '{type}0{magnet}{bore}{stroke_mm#4}{material}P{connection}{fittings}',
  rules_schema_id = 'SCHEMA-CCIV-V1'
where slug = 'cciv';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'cciv';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'cciv';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"type","label":"Utförande","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"bore","label":"Borrning","param_type":"select","sort_order":2,"required":true,"min_value":null,"max_value":null},{"param_key":"stroke_mm","label":"Slaglängd","param_type":"number","sort_order":3,"required":true,"min_value":5,"max_value":300},{"param_key":"magnet","label":"Kolv","param_type":"select","sort_order":4,"required":true,"min_value":null,"max_value":null},{"param_key":"material","label":"Kolvstång","param_type":"select","sort_order":5,"required":true,"min_value":null,"max_value":null},{"param_key":"connection","label":"Elektrisk anslutning","param_type":"select","sort_order":6,"required":true,"min_value":null,"max_value":null},{"param_key":"fittings","label":"Pneumatisk anslutning","param_type":"select","sort_order":7,"required":true,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'cciv';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"type","code":"23","label":"UNITOP-centrumavstånd, hangängad kolvstång","sort_order":0},{"param_key":"type","code":"24","label":"UNITOP-centrumavstånd, hongängad kolvstång","sort_order":1},{"param_key":"type","code":"25","label":"ISO-centrumavstånd, hangängad kolvstång","sort_order":2},{"param_key":"type","code":"26","label":"ISO-centrumavstånd, hongängad kolvstång","sort_order":3},{"param_key":"bore","code":"20","label":"Ø20 mm","sort_order":0},{"param_key":"bore","code":"25","label":"Ø25 mm","sort_order":1},{"param_key":"bore","code":"32","label":"Ø32 mm","sort_order":2},{"param_key":"bore","code":"40","label":"Ø40 mm","sort_order":3},{"param_key":"magnet","code":"0","label":"Magnetisk kolv","sort_order":0},{"param_key":"magnet","code":"S","label":"Omagnetisk kolv","sort_order":1},{"param_key":"magnet","code":"G","label":"Utan stick-slip","sort_order":2},{"param_key":"material","code":"C","label":"Kolvstång i hårdförkromat C45","sort_order":0},{"param_key":"material","code":"X","label":"Kolvstång och mutter i rostfritt","sort_order":1},{"param_key":"connection","code":"2","label":"Plug-in-kontakt","sort_order":0},{"param_key":"connection","code":"M","label":"M8-kontakt","sort_order":1},{"param_key":"fittings","code":"1","label":"M7-gängade portar","sort_order":0},{"param_key":"fittings","code":"2","label":"Insticksanslutning Ø4 och ljuddämpare","sort_order":1},{"param_key":"fittings","code":"3","label":"Insticksanslutning Ø4 och dämpade utloppsstryp","sort_order":2},{"param_key":"fittings","code":"4","label":"Insticksanslutning Ø6 och ljuddämpare","sort_order":3},{"param_key":"fittings","code":"5","label":"Insticksanslutning Ø6 och dämpade utloppsstryp","sort_order":4}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'cciv';


delete from config_rules where schema_id = 'SCHEMA-CCIV-V1';

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-CCIV-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{"in":[{"var":"type"},["25","26"]]},{"in":[{"var":"bore"},["20","25"]]}]},"message_sv":"ISO-centrumavstånd (typ 25 och 26) finns bara för Ø32 och Ø40. Ø20 och Ø25 har UNITOP-centrumavstånd.","message_en":"ISO centre distances (type 25 and 26) are only available for Ø32 and Ø40. Ø20 and Ø25 use UNITOP.","goto_step":"cciv-typ"},{"severity":"error","if_json":{"and":[{"==":[{"var":"material"},"C"]},{"in":[{"var":"bore"},["20","25"]]}]},"message_sv":"Ø20 och Ø25 har alltid rostfri kolvstång. Hårdförkromat C45 finns bara för Ø32 och Ø40.","message_en":"Ø20 and Ø25 always come with a stainless piston rod. Chromium-plated C45 is only available for Ø32 and Ø40.","goto_step":"cciv-material"},{"severity":"error","if_json":{"and":[{"==":[{"var":"bore"},"20"]},{">":[{"var":"stroke_mm"},200]}]},"message_sv":"Ø20 går till 200 mm slaglängd.","message_en":"Ø20 goes up to 200 mm stroke.","goto_step":"cciv-slag"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"bore"},"20"]},{">":[{"var":"stroke_mm"},50]},{"<=":[{"var":"stroke_mm"},200]}]},"message_sv":"Standardslagen för Ø20 är 5–50 mm. Längre slag går att beställa upp till 200 mm men är inte lagervara.","message_en":"Standard strokes for Ø20 are 5–50 mm. Longer strokes can be ordered up to 200 mm but are not stocked.","goto_step":"cciv-slag"},{"severity":"error","if_json":{"and":[{"==":[{"var":"bore"},"25"]},{">":[{"var":"stroke_mm"},200]}]},"message_sv":"Ø25 går till 200 mm slaglängd.","message_en":"Ø25 goes up to 200 mm stroke.","goto_step":"cciv-slag"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"bore"},"25"]},{">":[{"var":"stroke_mm"},50]},{"<=":[{"var":"stroke_mm"},200]}]},"message_sv":"Standardslagen för Ø25 är 5–50 mm. Längre slag går att beställa upp till 200 mm men är inte lagervara.","message_en":"Standard strokes for Ø25 are 5–50 mm. Longer strokes can be ordered up to 200 mm but are not stocked.","goto_step":"cciv-slag"},{"severity":"error","if_json":{"and":[{"==":[{"var":"bore"},"32"]},{">":[{"var":"stroke_mm"},300]}]},"message_sv":"Ø32 går till 300 mm slaglängd.","message_en":"Ø32 goes up to 300 mm stroke.","goto_step":"cciv-slag"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"bore"},"32"]},{">":[{"var":"stroke_mm"},80]},{"<=":[{"var":"stroke_mm"},300]}]},"message_sv":"Standardslagen för Ø32 är 5–80 mm. Längre slag går att beställa upp till 300 mm men är inte lagervara.","message_en":"Standard strokes for Ø32 are 5–80 mm. Longer strokes can be ordered up to 300 mm but are not stocked.","goto_step":"cciv-slag"},{"severity":"error","if_json":{"and":[{"==":[{"var":"bore"},"40"]},{">":[{"var":"stroke_mm"},300]}]},"message_sv":"Ø40 går till 300 mm slaglängd.","message_en":"Ø40 goes up to 300 mm stroke.","goto_step":"cciv-slag"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"bore"},"40"]},{">":[{"var":"stroke_mm"},80]},{"<=":[{"var":"stroke_mm"},300]}]},"message_sv":"Standardslagen för Ø40 är 5–80 mm. Längre slag går att beställa upp till 300 mm men är inte lagervara.","message_en":"Standard strokes for Ø40 are 5–80 mm. Longer strokes can be ordered up to 300 mm but are not stocked.","goto_step":"cciv-slag"},{"severity":"error","if_json":{"and":[{">":[{"var":"stroke_mm"},0]},{"<":[{"var":"stroke_mm"},5]}]},"message_sv":"Minsta slaglängd är 5 mm.","message_en":"Minimum stroke is 5 mm.","goto_step":"cciv-slag"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"bore"},"20"]},{"!=":[{"var":"magnet"},""]},{"!=":[{"var":"magnet"},"G"]}]},"message_sv":"För Ø20 är utförandet utan stick-slip standard. Under 0.2 m/s rycker cylindern annars.","message_en":"For Ø20 the no-stick-slip version is standard. Below 0.2 m/s the cylinder will otherwise surge.","goto_step":"cciv-magnet"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"bore"},"25"]},{"!=":[{"var":"magnet"},""]},{"!=":[{"var":"magnet"},"G"]}]},"message_sv":"För Ø25 är utförandet utan stick-slip standard. Under 0.2 m/s rycker cylindern annars.","message_en":"For Ø25 the no-stick-slip version is standard. Below 0.2 m/s the cylinder will otherwise surge.","goto_step":"cciv-magnet"},{"severity":"warn","if_json":{"==":[{"var":"connection"},"2"]},"message_sv":"Plug-in-kontakten ger IP51. Behövs mer, välj M8-kontakt, som ger IP65.","message_en":"The plug-in connector gives IP51. If more is needed, choose the M8 connector, which gives IP65.","goto_step":"cciv-kontakt"}]'::jsonb) r;


insert into product_specs (product_id, key, value)
select p.id, v.key, v.value
from jsonb_to_recordset('[{"sku":"MW-CCIV-20","bore_mm":20,"stroke_max_mm":200,"stroke_standard_max_mm":50,"speed":"1.4 / 1.2 m/s","weight_base_kg":0.22,"weight_50mm_kg":0.3375},{"sku":"MW-CCIV-32","bore_mm":32,"stroke_max_mm":300,"stroke_standard_max_mm":80,"speed":"0.6 / 0.5 m/s","weight_base_kg":0.295,"weight_50mm_kg":0.4535}]'::jsonb)
       as r(sku text, bore_mm int, stroke_max_mm int, stroke_standard_max_mm int,
            speed text, weight_base_kg numeric, weight_50mm_kg numeric)
join products p on p.sku = r.sku
cross join lateral (values
  ('stroke_min_mm', '5'),
  ('stroke_max_mm', r.stroke_max_mm::text),
  ('stroke_standard_max_mm', r.stroke_standard_max_mm::text),
  ('max_speed', r.speed),
  ('pressure_range', '3–7 bar'),
  ('temp_range', '-10–50 °C'),
  ('voltage', '24 VDC ±10 %'),
  ('power', '0.9 W'),
  ('duty_cycle', '100 % ED'),
  ('valve_function', '5/2 monostabil magnetventil'),
  ('mode_of_operation', 'Dubbelverkande'),
  ('magnetic_piston', 'Ja'),
  ('air_quality', 'ISO 8573-1 klass 4-7-3'),
  ('order_code_length', '14')
) as v(key, value)
where not exists (
  select 1 from product_specs x where x.product_id = p.id and x.key = v.key
);

-- Tryckområdet stod inte alls, och det är snävare än en vanlig cylinders:
-- CCIV kräver minst 3 bar för att ventilen ska slå om, och
-- tål högst 7.
update product_specs s set value = '3–7 bar'
where s.key in ('pressure_range', 'max_pressure')
  and s.product_id in (select id from products where lower(family) = 'cciv');

commit;


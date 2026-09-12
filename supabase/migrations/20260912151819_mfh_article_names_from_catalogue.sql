-- MFH: artikelnamnen enligt Festo Tiger Classic valve (MFH and related series), utgåva 2026/07.
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
values ('SCHEMA-MFH-V1', '{"version":"1.0","steps":[{"id":"series","step":1,"title_sv":"Ventiltyp","title_en":"Valve type","required":true,"type":"single_select","options":[{"v":"MFH","label":"Magnetventil, monostabil, normalt stängd"},{"v":"MOFH","label":"Magnetventil, monostabil, normalt öppen"},{"v":"JMFH","label":"Magnetventil, bistabil"},{"v":"JMFDH","label":"Magnetventil, bistabil, dominerande signal"},{"v":"JH","label":"Pneumatventil, bistabil"},{"v":"JDH","label":"Pneumatventil, bistabil, dominerande signal"},{"v":"VL","label":"Pneumatventil, monostabil"},{"v":"VL/O","label":"Pneumatventil, monostabil, normalt öppen eller stängd"}]},{"id":"fn","step":2,"title_sv":"Ventilfunktion","title_en":"Valve function","required":true,"type":"single_select","options":[{"v":"3","label":"3/2-vägs"},{"v":"5","label":"5/2-vägs"}]},{"id":"thread","step":3,"title_sv":"Anslutning","title_en":"Connection","required":true,"type":"single_select","options":[{"v":"1/8","label":"G1/8 — 500 l/min, DN 5"},{"v":"1/4","label":"G1/4 — 800 l/min, DN 7"},{"v":"1/2","label":"G1/2 — 3700 l/min, DN 14"},{"v":"3/4","label":"G3/4 — 7500 l/min, DN 19"}]},{"id":"ext_pilot","step":4,"title_sv":"Pilotluft","title_en":"Pilot air","required":false,"type":"single_select","options":[{"v":"S","label":"Extern pilotluft"}]},{"id":"atex","step":5,"title_sv":"ATEX","title_en":"ATEX","required":false,"type":"single_select","options":[{"v":"EX","label":"ATEX II 2G"}]},{"id":"b_variant","step":6,"title_sv":"Utförande","title_en":"Version","required":false,"type":"single_select","options":[{"v":"B","label":"B-utförande (endast VL/O i G1/8)"}]}]}'::jsonb,
        'Festo Tiger Classic ventil',
        'Festo Tiger Classic valve', 'valve')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  order_code_template = '{series}-{fn}-{thread}-{b_variant}-{ext_pilot}-{atex}',
  rules_schema_id = 'SCHEMA-MFH-V1'
where slug = 'mfh';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'mfh';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'mfh';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"series","label":"Ventiltyp","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"fn","label":"Ventilfunktion","param_type":"select","sort_order":2,"required":true,"min_value":null,"max_value":null},{"param_key":"thread","label":"Anslutning","param_type":"select","sort_order":3,"required":true,"min_value":null,"max_value":null},{"param_key":"ext_pilot","label":"Pilotluft","param_type":"select","sort_order":4,"required":false,"min_value":null,"max_value":null},{"param_key":"atex","label":"ATEX","param_type":"select","sort_order":5,"required":false,"min_value":null,"max_value":null},{"param_key":"b_variant","label":"Utförande","param_type":"select","sort_order":6,"required":false,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'mfh';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"series","code":"MFH","label":"Magnetventil, monostabil, normalt stängd","sort_order":0},{"param_key":"series","code":"MOFH","label":"Magnetventil, monostabil, normalt öppen","sort_order":1},{"param_key":"series","code":"JMFH","label":"Magnetventil, bistabil","sort_order":2},{"param_key":"series","code":"JMFDH","label":"Magnetventil, bistabil, dominerande signal","sort_order":3},{"param_key":"series","code":"JH","label":"Pneumatventil, bistabil","sort_order":4},{"param_key":"series","code":"JDH","label":"Pneumatventil, bistabil, dominerande signal","sort_order":5},{"param_key":"series","code":"VL","label":"Pneumatventil, monostabil","sort_order":6},{"param_key":"series","code":"VL/O","label":"Pneumatventil, monostabil, normalt öppen eller stängd","sort_order":7},{"param_key":"fn","code":"3","label":"3/2-vägs","sort_order":0},{"param_key":"fn","code":"5","label":"5/2-vägs","sort_order":1},{"param_key":"thread","code":"1/8","label":"G1/8 — 500 l/min, DN 5","sort_order":0},{"param_key":"thread","code":"1/4","label":"G1/4 — 800 l/min, DN 7","sort_order":1},{"param_key":"thread","code":"1/2","label":"G1/2 — 3700 l/min, DN 14","sort_order":2},{"param_key":"thread","code":"3/4","label":"G3/4 — 7500 l/min, DN 19","sort_order":3},{"param_key":"ext_pilot","code":"S","label":"Extern pilotluft","sort_order":0},{"param_key":"atex","code":"EX","label":"ATEX II 2G","sort_order":0},{"param_key":"b_variant","code":"B","label":"B-utförande (endast VL/O i G1/8)","sort_order":0}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'mfh';

delete from config_rules where schema_id = 'SCHEMA-MFH-V1';

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-MFH-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"MFH"]},{"==":[{"var":"fn"},"5"]},{"!=":[{"var":"thread"},""]},{"not":{"in":[{"var":"thread"},["1/8","1/4","1/2"]]}}]},"message_sv":"MFH-5 finns i G1/8, G1/4 och G1/2.","message_en":"MFH-5 is available in G1/8, G1/4 and G1/2.","goto_step":"mfh-ganga"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"MOFH"]},{"!=":[{"var":"fn"},""]},{"not":{"in":[{"var":"fn"},["3"]]}}]},"message_sv":"MOFH finns bara som 3/2-vägsventil.","message_en":"MOFH is only available as a 3/2-way valve.","goto_step":"mfh-funktion"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"MOFH"]},{"==":[{"var":"fn"},"3"]},{"==":[{"var":"ext_pilot"},"S"]}]},"message_sv":"MOFH-3 finns bara med intern pilotluft.","message_en":"MOFH-3 is only available with internal pilot air.","goto_step":"mfh-pilot"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JMFH"]},{"!=":[{"var":"fn"},""]},{"not":{"in":[{"var":"fn"},["5"]]}}]},"message_sv":"JMFH finns bara som 5/2-vägsventil.","message_en":"JMFH is only available as a 5/2-way valve.","goto_step":"mfh-funktion"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JMFH"]},{"==":[{"var":"fn"},"5"]},{"!=":[{"var":"thread"},""]},{"not":{"in":[{"var":"thread"},["1/8","1/4","1/2"]]}}]},"message_sv":"JMFH-5 finns i G1/8, G1/4 och G1/2.","message_en":"JMFH-5 is available in G1/8, G1/4 and G1/2.","goto_step":"mfh-ganga"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JMFDH"]},{"!=":[{"var":"fn"},""]},{"not":{"in":[{"var":"fn"},["5"]]}}]},"message_sv":"JMFDH finns bara som 5/2-vägsventil.","message_en":"JMFDH is only available as a 5/2-way valve.","goto_step":"mfh-funktion"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JMFDH"]},{"==":[{"var":"fn"},"5"]},{"!=":[{"var":"thread"},""]},{"not":{"in":[{"var":"thread"},["1/8","1/4"]]}}]},"message_sv":"JMFDH-5 finns i G1/8 och G1/4.","message_en":"JMFDH-5 is available in G1/8 and G1/4.","goto_step":"mfh-ganga"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JMFDH"]},{"==":[{"var":"fn"},"5"]},{"==":[{"var":"ext_pilot"},"S"]}]},"message_sv":"JMFDH-5 finns bara med intern pilotluft.","message_en":"JMFDH-5 is only available with internal pilot air.","goto_step":"mfh-pilot"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JH"]},{"!=":[{"var":"fn"},""]},{"not":{"in":[{"var":"fn"},["5"]]}}]},"message_sv":"JH finns bara som 5/2-vägsventil.","message_en":"JH is only available as a 5/2-way valve.","goto_step":"mfh-funktion"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JH"]},{"==":[{"var":"fn"},"5"]},{"!=":[{"var":"thread"},""]},{"not":{"in":[{"var":"thread"},["1/8","1/4","1/2"]]}}]},"message_sv":"JH-5 finns i G1/8, G1/4 och G1/2.","message_en":"JH-5 is available in G1/8, G1/4 and G1/2.","goto_step":"mfh-ganga"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JH"]},{"==":[{"var":"fn"},"5"]},{"==":[{"var":"ext_pilot"},"S"]}]},"message_sv":"JH-5 finns bara med intern pilotluft.","message_en":"JH-5 is only available with internal pilot air.","goto_step":"mfh-pilot"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JDH"]},{"!=":[{"var":"fn"},""]},{"not":{"in":[{"var":"fn"},["5"]]}}]},"message_sv":"JDH finns bara som 5/2-vägsventil.","message_en":"JDH is only available as a 5/2-way valve.","goto_step":"mfh-funktion"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JDH"]},{"==":[{"var":"fn"},"5"]},{"!=":[{"var":"thread"},""]},{"not":{"in":[{"var":"thread"},["1/8","1/4"]]}}]},"message_sv":"JDH-5 finns i G1/8 och G1/4.","message_en":"JDH-5 is available in G1/8 and G1/4.","goto_step":"mfh-ganga"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"JDH"]},{"==":[{"var":"fn"},"5"]},{"==":[{"var":"ext_pilot"},"S"]}]},"message_sv":"JDH-5 finns bara med intern pilotluft.","message_en":"JDH-5 is only available with internal pilot air.","goto_step":"mfh-pilot"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"VL"]},{"!=":[{"var":"fn"},""]},{"not":{"in":[{"var":"fn"},["5"]]}}]},"message_sv":"VL finns bara som 5/2-vägsventil.","message_en":"VL is only available as a 5/2-way valve.","goto_step":"mfh-funktion"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"VL"]},{"==":[{"var":"fn"},"5"]},{"!=":[{"var":"thread"},""]},{"not":{"in":[{"var":"thread"},["1/8","1/4","1/2"]]}}]},"message_sv":"VL-5 finns i G1/8, G1/4 och G1/2.","message_en":"VL-5 is available in G1/8, G1/4 and G1/2.","goto_step":"mfh-ganga"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"VL"]},{"==":[{"var":"fn"},"5"]},{"==":[{"var":"ext_pilot"},"S"]}]},"message_sv":"VL-5 finns bara med intern pilotluft.","message_en":"VL-5 is only available with internal pilot air.","goto_step":"mfh-pilot"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"VL/O"]},{"!=":[{"var":"fn"},""]},{"not":{"in":[{"var":"fn"},["3"]]}}]},"message_sv":"VL/O finns bara som 3/2-vägsventil.","message_en":"VL/O is only available as a 3/2-way valve.","goto_step":"mfh-funktion"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"VL/O"]},{"==":[{"var":"fn"},"3"]},{"==":[{"var":"ext_pilot"},"S"]}]},"message_sv":"VL/O-3 finns bara med intern pilotluft.","message_en":"VL/O-3 is only available with internal pilot air.","goto_step":"mfh-pilot"},{"severity":"error","if_json":{"and":[{"==":[{"var":"b_variant"},"B"]},{"or":[{"!=":[{"var":"series"},"VL/O"]},{"!=":[{"var":"thread"},"1/8"]}]}]},"message_sv":"B-utförandet finns bara som VL/O i G1/8.","message_en":"The B version only exists as VL/O in G1/8.","goto_step":"mfh-utforande"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"VL/O"]},{"==":[{"var":"thread"},"1/8"]},{"!=":[{"var":"b_variant"},"B"]},{"!=":[{"var":"thread"},""]}]},"message_sv":"VL/O i G1/8 finns bara i B-utförande.","message_en":"VL/O in G1/8 only exists in the B version.","goto_step":"mfh-utforande"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"fn"},"5"]},{"==":[{"var":"thread"},"1/4"]}]},"message_sv":"5/2-ventilen i G1/4 tål 8 bar. De övriga storlekarna tål 10.","message_en":"The 5/2 valve in G1/4 is rated for 8 bar. The other sizes take 10.","goto_step":"mfh-ganga"},{"severity":"warn","if_json":{"==":[{"var":"atex"},"EX"]},"message_sv":"ATEX-utförandet är godkänt för -5 till +40 °C omgivning (II 2G Ex h IIC T4 Gb, II 2D Ex h IIIC T130 °C Db). Utanför det intervallet gäller inte godkännandet.","message_en":"The ATEX version is approved for -5 to +40 °C ambient (II 2G Ex h IIC T4 Gb, II 2D Ex h IIIC T130 °C Db). Outside that range the approval does not apply.","goto_step":"mfh-atex"}]'::jsonb) r;


-- FE-MFH-5-1-8 heter "MFH-5/2-D-1-S G1/8". Det är ingen Festo-form, men
-- avsikten är entydig: en 5/2 med extern pilotluft i G1/8. Katalogens artikel
-- heter "MFH-5-1/8-S" och har artikelnummer 10348.
--
-- SKU:n rörs INTE. Att byta den vore att röra något sju tabeller kan peka på,
-- och raden fungerar. Namnet och specifikationerna rättas.
update products set
  name = 'Festo MFH-5-1/8-S Tiger Classic 5/2-ventil, G1/8, extern pilotluft',
  description = 'Magnetventil ur Festos Tiger Classic-serie. Katalogens '
    || 'artikelnummer 10348. Sätesventil, mjuktätande, 500 l/min, '
    || 'DN 5. Spolen beställs separat.',
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
  ('catalogue_part_no', '10348'),
  ('type_code', 'MFH-5-1/8-S'),
  ('valve_function', '5/2-vägs, monostabil'),
  ('design', 'Sätesventil, mjuktätande'),
  ('nominal_size_mm', '5'),
  ('flow_lmin', '500'),
  ('pilot_air', 'Extern'),
  ('weight_g', '270'),
  ('max_pressure', '10 bar'),
  ('pilot_pressure', '1–8 bar'),
  ('temp_ambient', '-5–40 °C'),
  ('temp_media', '-10–60 °C'),
  ('ip_rating', 'IP65'),
  ('material_housing', 'Pressgjuten aluminium'),
  ('material_seals', 'NBR'),
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


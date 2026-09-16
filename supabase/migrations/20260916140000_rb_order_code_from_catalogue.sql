-- Speglar det som lades på databasen 2026-09-16 via apply_migration i tre delar:
--   rb_order_code_from_catalogue_part_01  (familjen rb in, backup, schema, familjens rad, parametrar, värdelista, rensning av regler)
--   rb_order_code_from_catalogue_part_02  (regler 1–20)
--   rb_order_code_from_catalogue_part_03  (regler 21–34, dokumentkarta, produkterna döpta om)
-- Fingeravtryck efter körning, identiska med modellen (scripts/fingerprint-rules.ts rb):
--   regler  34   md5 bc8731afd501954ba510845565bd91f4   villkor 73a4486fd819e5436317eee99e68daba
--   värden  23   md5 7148fadd6529b5e92aad676afe7b18e1
--   schema       md5 1c97f6c280cf37b178b0a5eb784aaa35
-- Verifierat live: /sv/configurator/rb bygger RBC1412 (nyckelns exempel sida 1299) och RBQC2007SJ;
-- stoppar RBC0604S (ingen kåpa, inga tillval för M6) och RBL0806 (RBL börjar vid M10).
--
-- RB: beställnyckeln enligt SMC Shock Absorber RB/RBL/RBQ Series (sida 1299, 1306, 1310).
-- GENERERAD ur src/lib/catalog/rb.ts -- redigera inte för hand.
--
-- Ny familj rb i kategorin shock-absorber: {serie}{typ}{storlek}{tillval},
-- t.ex. RBC1412 (nyckelns exempel sida 1299), RBLC1412 (sida 1306) och
-- RBQC2007 (sida 1310). Tre serier, 20 modeller, kåpa/buffert och sex
-- muttertillval; RB0604 utan kåpa och utan tillval.
--
-- Produkterna SMC-RBQ0806W/1006W/1412W/2025W (påhittade koder) döps om till
-- SMC-RB0806, SMC-RB1006, SMC-RB1412 och SMC-RB2015 och får katalogens data;
-- "max_pressure" stryks (en stötdämpare har inget arbetstryck).

begin;


insert into configurator_families (slug, name, title, description, category_slug)
values ('rb', 'RB', 'RB', '', 'shock-absorber')
on conflict (slug) do update set name = excluded.name;


create schema if not exists backup;
create table if not exists backup.rb_before_20260916 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'rb'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'rb'
  union all
  select 'family', f.id::text, f.slug, coalesce(f.order_code_template, '')
  from configurator_families f where f.slug = 'rb';

insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-RB-V1', '{"version":"1.0","steps":[{"id":"series","step":1,"title_sv":"Serie","title_en":"Series","required":true,"type":"single_select","options":[{"v":"RB","label":"RB standard, M6–M27"},{"v":"RBL","label":"RBL kylvätsketålig (icke vattenlöslig skärolja), M10–M27"},{"v":"RBQ","label":"RBQ kort typ, M16–M32, tillåten excentricitet 5°"}]},{"id":"type","step":2,"title_sv":"Kåpa eller gummibuffert (standard är bastypen)","title_en":"Cap or bumper (the basic type is standard)","required":false,"type":"single_select","options":[{"v":"C","label":"Med kåpa (RB/RBL) respektive gummibuffert (RBQ) — kan inte eftermonteras"}]},{"id":"size","step":3,"title_sv":"Storlek: yttergänga och slag","title_en":"Size: O.D. thread and stroke","required":true,"type":"single_select","options":[{"v":"0604","label":"M6 x 0,75, slag 4 mm (RB)"},{"v":"0805","label":"M8 x 1,0, slag 5 mm (RB)"},{"v":"0806","label":"M8 x 1,0, slag 6 mm (RB)"},{"v":"1006","label":"M10 x 1,0, slag 6 mm (RB/RBL)"},{"v":"1007","label":"M10 x 1,0, slag 7 mm (RB/RBL)"},{"v":"1411","label":"M14 x 1,5, slag 11 mm (RB/RBL)"},{"v":"1412","label":"M14 x 1,5, slag 12 mm (RB/RBL)"},{"v":"1604","label":"M16 x 1,5, slag 4 mm (RBQ)"},{"v":"2007","label":"M20 x 1,5, slag 7 mm (RBQ)"},{"v":"2015","label":"M20 x 1,5, slag 15 mm (RB/RBL)"},{"v":"2508","label":"M25 x 1,5, slag 8 mm (RBQ)"},{"v":"2725","label":"M27 x 1,5, slag 25 mm (RB/RBL)"},{"v":"3009","label":"M30 x 1,5, slag 8,5 mm (RBQ)"},{"v":"3213","label":"M32 x 1,5, slag 13 mm (RBQ)"}]},{"id":"option","step":4,"title_sv":"Muttrar (standard är två sexkantmuttrar)","title_en":"Nuts (two hexagon nuts are standard)","required":false,"type":"single_select","options":[{"v":"J","label":"Tre sexkantmuttrar (standard är två)"},{"v":"N","label":"Utan sexkantmuttrar"},{"v":"S","label":"Två sexkantmuttrar och en stoppmutter"},{"v":"SJ","label":"Tre sexkantmuttrar och en stoppmutter"},{"v":"SN","label":"Bara en stoppmutter"}]}]}'::jsonb,
        'SMC RB/RBL/RBQ stötdämpare', 'SMC RB/RBL/RBQ shock absorber', 'shock-absorber')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  title = 'Stötdämpare RB (M6–M27), RBL kylvätsketålig (M10–M27) och RBQ kort typ (M16–M32)',
  description = 'SMC hydraulic shock absorbers with self-adjusting porous orifice: RB standard (M6–M27, 0.5–147 J), RBL coolant resistant (M10–M27) and RBQ short type for rotating energy (M16–M32, 5° eccentric angle); with cap or rubber bumper (C) and nut options J/N/S/SJ/SN; foot brackets and stopper nuts as separate parts.',
  stroke_min_mm = null,
  stroke_max_mm = null,
  order_code_template = '{series}{type}{size}{option}',
  rules_schema_id = 'SCHEMA-RB-V1'
where slug = 'rb';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'rb';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'rb';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"series","label":"Serie","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"type","label":"Kåpa eller gummibuffert (standard är bastypen)","param_type":"select","sort_order":2,"required":false,"min_value":null,"max_value":null},{"param_key":"size","label":"Storlek: yttergänga och slag","param_type":"select","sort_order":3,"required":true,"min_value":null,"max_value":null},{"param_key":"option","label":"Muttrar (standard är två sexkantmuttrar)","param_type":"select","sort_order":4,"required":false,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'rb';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"series","code":"RB","label":"RB standard, M6–M27","sort_order":0},{"param_key":"series","code":"RBL","label":"RBL kylvätsketålig (icke vattenlöslig skärolja), M10–M27","sort_order":1},{"param_key":"series","code":"RBQ","label":"RBQ kort typ, M16–M32, tillåten excentricitet 5°","sort_order":2},{"param_key":"type","code":"C","label":"Med kåpa (RB/RBL) respektive gummibuffert (RBQ) — kan inte eftermonteras","sort_order":0},{"param_key":"size","code":"0604","label":"M6 x 0,75, slag 4 mm (RB)","sort_order":0},{"param_key":"size","code":"0805","label":"M8 x 1,0, slag 5 mm (RB)","sort_order":1},{"param_key":"size","code":"0806","label":"M8 x 1,0, slag 6 mm (RB)","sort_order":2},{"param_key":"size","code":"1006","label":"M10 x 1,0, slag 6 mm (RB/RBL)","sort_order":3},{"param_key":"size","code":"1007","label":"M10 x 1,0, slag 7 mm (RB/RBL)","sort_order":4},{"param_key":"size","code":"1411","label":"M14 x 1,5, slag 11 mm (RB/RBL)","sort_order":5},{"param_key":"size","code":"1412","label":"M14 x 1,5, slag 12 mm (RB/RBL)","sort_order":6},{"param_key":"size","code":"1604","label":"M16 x 1,5, slag 4 mm (RBQ)","sort_order":7},{"param_key":"size","code":"2007","label":"M20 x 1,5, slag 7 mm (RBQ)","sort_order":8},{"param_key":"size","code":"2015","label":"M20 x 1,5, slag 15 mm (RB/RBL)","sort_order":9},{"param_key":"size","code":"2508","label":"M25 x 1,5, slag 8 mm (RBQ)","sort_order":10},{"param_key":"size","code":"2725","label":"M27 x 1,5, slag 25 mm (RB/RBL)","sort_order":11},{"param_key":"size","code":"3009","label":"M30 x 1,5, slag 8,5 mm (RBQ)","sort_order":12},{"param_key":"size","code":"3213","label":"M32 x 1,5, slag 13 mm (RBQ)","sort_order":13},{"param_key":"option","code":"J","label":"Tre sexkantmuttrar (standard är två)","sort_order":0},{"param_key":"option","code":"N","label":"Utan sexkantmuttrar","sort_order":1},{"param_key":"option","code":"S","label":"Två sexkantmuttrar och en stoppmutter","sort_order":2},{"param_key":"option","code":"SJ","label":"Tre sexkantmuttrar och en stoppmutter","sort_order":3},{"param_key":"option","code":"SN","label":"Bara en stoppmutter","sort_order":4}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'rb';

delete from config_rules where schema_id = 'SCHEMA-RB-V1';


insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-RB-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"in":[{"var":"size"},["1604","2007","2508","3009","3213"]]}]},"message_sv":"RB tillverkas i storlekarna 0604, 0805, 0806, 1006, 1007, 1411, 1412, 2015 och 2725; 1604, 2007, 2508, 3009 och 3213 hör till RBQ (sida 1299).","message_en":"RB is made in the sizes 0604, 0805, 0806, 1006, 1007, 1411, 1412, 2015 and 2725; 1604, 2007, 2508, 3009 and 3213 belong to RBQ (page 1299).","goto_step":"rb-size"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"RBL"]},{"in":[{"var":"size"},["0604","0805","0806","1604","2007","2508","3009","3213"]]}]},"message_sv":"RBL tillverkas i storlekarna 1006, 1007, 1411, 1412, 2015 och 2725; de övriga storlekarna hör till RB (0604–0806) eller RBQ (sida 1306).","message_en":"RBL is made in the sizes 1006, 1007, 1411, 1412, 2015 and 2725; the other sizes belong to RB (0604–0806) or RBQ (page 1306).","goto_step":"rb-size"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"RBQ"]},{"in":[{"var":"size"},["0604","0805","0806","1006","1007","1411","1412","2015","2725"]]}]},"message_sv":"RBQ tillverkas i storlekarna 1604, 2007, 2508, 3009 och 3213; de övriga storlekarna hör till RB/RBL (sida 1310).","message_en":"RBQ is made in the sizes 1604, 2007, 2508, 3009 and 3213; the other sizes belong to RB/RBL (page 1310).","goto_step":"rb-size"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"0604"]},{"==":[{"var":"type"},"C"]}]},"message_sv":"RB0604 finns inte med kåpa (sida 1299, not).","message_en":"RB0604 is not available with the cap (page 1299, note).","goto_step":"rb-type"},{"severity":"error","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"0604"]},{"in":[{"var":"option"},["J","N","S","SJ","SN"]]}]},"message_sv":"Tillvalen finns inte för M6 (RB0604): ingen stoppmutter och inga muttertillval (sida 1295 och 1302).","message_en":"The options are not available for M6 (RB0604): no stopper nut and no nut options (pages 1295 and 1302).","goto_step":"rb-option"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"0604"]}]},"message_sv":"RB0604: M6 x 0,75, slag 4 mm, högst 0,5 J per slag och 80 slag/min vid 20–25 °C, kollisionshastighet 0,3–1 m/s, största axialkraft 150 N, returfjäder 3,05/5,59 N (ut/in), vikt 5,5 g (sida 1299 och 1302).","message_en":"RB0604: M6 x 0.75, stroke 4 mm, max. 0.5 J per cycle and 80 cycles/min at 20–25 °C, collision speed 0.3–1 m/s, max. allowable thrust 150 N, return spring 3.05/5.59 N (extended/retracted), weight 5.5 g (pages 1299 and 1302).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"0805"]}]},"message_sv":"RB0805: M8 x 1,0, slag 5 mm, högst 0,98 J per slag och 80 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 245 N, returfjäder 1,96/3,83 N (ut/in), vikt 15 g (16 g med kåpa); fotfäste RB08-X331 beställs separat, stoppmutter RB08S, reservkåpa RBC08C (sida 1299 och 1302).","message_en":"RB0805: M8 x 1.0, stroke 5 mm, max. 0.98 J per cycle and 80 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 245 N, return spring 1.96/3.83 N (extended/retracted), weight 15 g (16 g with cap); foot bracket RB08-X331 ordered separately, stopper nut RB08S, replacement cap RBC08C (pages 1299 and 1302).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"0806"]}]},"message_sv":"RB0806: M8 x 1,0, slag 6 mm, högst 2,94 J per slag och 80 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 245 N, returfjäder 1,96/4,22 N (ut/in), vikt 15 g (16 g med kåpa); fotfäste RB08-X331 beställs separat, stoppmutter RB08S, reservkåpa RBC08C (sida 1299 och 1302).","message_en":"RB0806: M8 x 1.0, stroke 6 mm, max. 2.94 J per cycle and 80 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 245 N, return spring 1.96/4.22 N (extended/retracted), weight 15 g (16 g with cap); foot bracket RB08-X331 ordered separately, stopper nut RB08S, replacement cap RBC08C (pages 1299 and 1302).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"1006"]}]},"message_sv":"RB1006: M10 x 1,0, slag 6 mm, högst 3,92 J per slag och 70 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 422 N, returfjäder 4,22/6,18 N (ut/in), vikt 23 g (25 g med kåpa); fotfäste RB10-X331 beställs separat, stoppmutter RB10S, reservkåpa RBC10C (sida 1299 och 1302).","message_en":"RB1006: M10 x 1.0, stroke 6 mm, max. 3.92 J per cycle and 70 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 422 N, return spring 4.22/6.18 N (extended/retracted), weight 23 g (25 g with cap); foot bracket RB10-X331 ordered separately, stopper nut RB10S, replacement cap RBC10C (pages 1299 and 1302).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"1007"]}]},"message_sv":"RB1007: M10 x 1,0, slag 7 mm, högst 5,88 J per slag och 70 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 422 N, returfjäder 4,22/6,86 N (ut/in), vikt 23 g (25 g med kåpa); fotfäste RB10-X331 beställs separat, stoppmutter RB10S, reservkåpa RBC10C (sida 1299 och 1302).","message_en":"RB1007: M10 x 1.0, stroke 7 mm, max. 5.88 J per cycle and 70 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 422 N, return spring 4.22/6.86 N (extended/retracted), weight 23 g (25 g with cap); foot bracket RB10-X331 ordered separately, stopper nut RB10S, replacement cap RBC10C (pages 1299 and 1302).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"1411"]}]},"message_sv":"RB1411: M14 x 1,5, slag 11 mm, högst 14,7 J per slag och 45 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 814 N, returfjäder 6,86/15,3 N (ut/in), vikt 65 g (70 g med kåpa); fotfäste RB14-X331 beställs separat, stoppmutter RB14S, reservkåpa RBC14C (sida 1299 och 1302).","message_en":"RB1411: M14 x 1.5, stroke 11 mm, max. 14.7 J per cycle and 45 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 814 N, return spring 6.86/15.3 N (extended/retracted), weight 65 g (70 g with cap); foot bracket RB14-X331 ordered separately, stopper nut RB14S, replacement cap RBC14C (pages 1299 and 1302).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"1412"]}]},"message_sv":"RB1412: M14 x 1,5, slag 12 mm, högst 19,6 J per slag och 45 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 814 N, returfjäder 6,86/15,98 N (ut/in), vikt 65 g (70 g med kåpa); fotfäste RB14-X331 beställs separat, stoppmutter RB14S, reservkåpa RBC14C (sida 1299 och 1302).","message_en":"RB1412: M14 x 1.5, stroke 12 mm, max. 19.6 J per cycle and 45 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 814 N, return spring 6.86/15.98 N (extended/retracted), weight 65 g (70 g with cap); foot bracket RB14-X331 ordered separately, stopper nut RB14S, replacement cap RBC14C (pages 1299 and 1302).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"2015"]}]},"message_sv":"RB2015: M20 x 1,5, slag 15 mm, högst 58,8 J per slag och 25 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 1961 N, returfjäder 8,34/20,5 N (ut/in), vikt 150 g (165 g med kåpa); fotfäste RB20-X331 beställs separat, stoppmutter RB20S, reservkåpa RBC20C (sida 1299 och 1302).","message_en":"RB2015: M20 x 1.5, stroke 15 mm, max. 58.8 J per cycle and 25 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 1961 N, return spring 8.34/20.5 N (extended/retracted), weight 150 g (165 g with cap); foot bracket RB20-X331 ordered separately, stopper nut RB20S, replacement cap RBC20C (pages 1299 and 1302).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RB"]},{"==":[{"var":"size"},"2725"]}]},"message_sv":"RB2725: M27 x 1,5, slag 25 mm, högst 147 J per slag och 10 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 2942 N, returfjäder 8,83/20,01 N (ut/in), vikt 350 g (400 g med kåpa); fotfäste RB27-X331 beställs separat, stoppmutter RB27S, reservkåpa RBC27C (sida 1299 och 1302).","message_en":"RB2725: M27 x 1.5, stroke 25 mm, max. 147 J per cycle and 10 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 2942 N, return spring 8.83/20.01 N (extended/retracted), weight 350 g (400 g with cap); foot bracket RB27-X331 ordered separately, stopper nut RB27S, replacement cap RBC27C (pages 1299 and 1302).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBL"]},{"==":[{"var":"size"},"1006"]}]},"message_sv":"RBL1006: M10 x 1,0, slag 6 mm, högst 3,92 J per slag och 70 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 422 N, returfjäder 4,22/6,18 N (ut/in), vikt 26 g (28 g med kåpa); fotfäste RB10-X331 beställs separat, stoppmutter RB10S, reservkåpa RBC10C (sida 1306 och 1307).","message_en":"RBL1006: M10 x 1.0, stroke 6 mm, max. 3.92 J per cycle and 70 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 422 N, return spring 4.22/6.18 N (extended/retracted), weight 26 g (28 g with cap); foot bracket RB10-X331 ordered separately, stopper nut RB10S, replacement cap RBC10C (pages 1306 and 1307).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBL"]},{"==":[{"var":"size"},"1007"]}]},"message_sv":"RBL1007: M10 x 1,0, slag 7 mm, högst 5,88 J per slag och 70 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 422 N, returfjäder 4,22/6,86 N (ut/in), vikt 26 g (28 g med kåpa); fotfäste RB10-X331 beställs separat, stoppmutter RB10S, reservkåpa RBC10C (sida 1306 och 1307).","message_en":"RBL1007: M10 x 1.0, stroke 7 mm, max. 5.88 J per cycle and 70 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 422 N, return spring 4.22/6.86 N (extended/retracted), weight 26 g (28 g with cap); foot bracket RB10-X331 ordered separately, stopper nut RB10S, replacement cap RBC10C (pages 1306 and 1307).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBL"]},{"==":[{"var":"size"},"1411"]}]},"message_sv":"RBL1411: M14 x 1,5, slag 11 mm, högst 14,7 J per slag och 45 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 814 N, returfjäder 8,73/14,12 N (ut/in), vikt 70 g (75 g med kåpa); fotfäste RB14-X331 beställs separat, stoppmutter RB14S, reservkåpa RBC14C (sida 1306 och 1307).","message_en":"RBL1411: M14 x 1.5, stroke 11 mm, max. 14.7 J per cycle and 45 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 814 N, return spring 8.73/14.12 N (extended/retracted), weight 70 g (75 g with cap); foot bracket RB14-X331 ordered separately, stopper nut RB14S, replacement cap RBC14C (pages 1306 and 1307).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBL"]},{"==":[{"var":"size"},"1412"]}]},"message_sv":"RBL1412: M14 x 1,5, slag 12 mm, högst 19,6 J per slag och 45 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 814 N, returfjäder 8,73/14,61 N (ut/in), vikt 70 g (75 g med kåpa); fotfäste RB14-X331 beställs separat, stoppmutter RB14S, reservkåpa RBC14C (sida 1306 och 1307).","message_en":"RBL1412: M14 x 1.5, stroke 12 mm, max. 19.6 J per cycle and 45 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 814 N, return spring 8.73/14.61 N (extended/retracted), weight 70 g (75 g with cap); foot bracket RB14-X331 ordered separately, stopper nut RB14S, replacement cap RBC14C (pages 1306 and 1307).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBL"]},{"==":[{"var":"size"},"2015"]}]},"message_sv":"RBL2015: M20 x 1,5, slag 15 mm, högst 58,8 J per slag och 25 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 1961 N, returfjäder 11,57/17,65 N (ut/in), vikt 150 g (165 g med kåpa); fotfäste RB20-X331 beställs separat, stoppmutter RB20S, reservkåpa RBC20C (sida 1306 och 1307).","message_en":"RBL2015: M20 x 1.5, stroke 15 mm, max. 58.8 J per cycle and 25 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 1961 N, return spring 11.57/17.65 N (extended/retracted), weight 150 g (165 g with cap); foot bracket RB20-X331 ordered separately, stopper nut RB20S, replacement cap RBC20C (pages 1306 and 1307).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBL"]},{"==":[{"var":"size"},"2725"]}]},"message_sv":"RBL2725: M27 x 1,5, slag 25 mm, högst 147 J per slag och 10 slag/min vid 20–25 °C, kollisionshastighet 0,05–5 m/s, största axialkraft 2942 N, returfjäder 22,16/38,05 N (ut/in), vikt 365 g (410 g med kåpa); fotfäste RB27-X331 beställs separat, stoppmutter RB27S, reservkåpa RBC27C (sida 1306 och 1307).","message_en":"RBL2725: M27 x 1.5, stroke 25 mm, max. 147 J per cycle and 10 cycles/min at 20–25 °C, collision speed 0.05–5 m/s, max. allowable thrust 2942 N, return spring 22.16/38.05 N (extended/retracted), weight 365 g (410 g with cap); foot bracket RB27-X331 ordered separately, stopper nut RB27S, replacement cap RBC27C (pages 1306 and 1307).","goto_step":"rb-size"}]'::jsonb) r;

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-RB-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBQ"]},{"==":[{"var":"size"},"1604"]}]},"message_sv":"RBQ1604: M16 x 1,5, slag 4 mm, högst 1,96 J per slag och 60 slag/min vid 20–25 °C, kollisionshastighet 0,05–3 m/s, största axialkraft 294 N, returfjäder 6,08/13,45 N (ut/in), vikt 28 g; stoppmutter RBQ16S, reservbuffert RBQC16C (sida 1310 och 1311).","message_en":"RBQ1604: M16 x 1.5, stroke 4 mm, max. 1.96 J per cycle and 60 cycles/min at 20–25 °C, collision speed 0.05–3 m/s, max. allowable thrust 294 N, return spring 6.08/13.45 N (extended/retracted), weight 28 g; stopper nut RBQ16S, replacement bumper RBQC16C (pages 1310 and 1311).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBQ"]},{"==":[{"var":"size"},"2007"]}]},"message_sv":"RBQ2007: M20 x 1,5, slag 7 mm, högst 11,8 J per slag och 60 slag/min vid 20–25 °C, kollisionshastighet 0,05–3 m/s, största axialkraft 490 N, returfjäder 12,75/27,75 N (ut/in), vikt 60 g; stoppmutter RB20S, reservbuffert RBQC20C (sida 1310 och 1311).","message_en":"RBQ2007: M20 x 1.5, stroke 7 mm, max. 11.8 J per cycle and 60 cycles/min at 20–25 °C, collision speed 0.05–3 m/s, max. allowable thrust 490 N, return spring 12.75/27.75 N (extended/retracted), weight 60 g; stopper nut RB20S, replacement bumper RBQC20C (pages 1310 and 1311).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBQ"]},{"==":[{"var":"size"},"2508"]}]},"message_sv":"RBQ2508: M25 x 1,5, slag 8 mm, högst 19,6 J per slag och 45 slag/min vid 20–25 °C, kollisionshastighet 0,05–3 m/s, största axialkraft 686 N, returfjäder 15,69/37,85 N (ut/in), vikt 110 g; stoppmutter RBQ25S, reservbuffert RBQC25C (sida 1310 och 1311).","message_en":"RBQ2508: M25 x 1.5, stroke 8 mm, max. 19.6 J per cycle and 45 cycles/min at 20–25 °C, collision speed 0.05–3 m/s, max. allowable thrust 686 N, return spring 15.69/37.85 N (extended/retracted), weight 110 g; stopper nut RBQ25S, replacement bumper RBQC25C (pages 1310 and 1311).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBQ"]},{"==":[{"var":"size"},"3009"]}]},"message_sv":"RBQ3009: M30 x 1,5, slag 8,5 mm, högst 33,3 J per slag och 45 slag/min vid 20–25 °C, kollisionshastighet 0,05–3 m/s, största axialkraft 981 N, returfjäder 21,57/44,23 N (ut/in), vikt 182 g; stoppmutter RBQ30S, reservbuffert RBQC30C (sida 1310 och 1311).","message_en":"RBQ3009: M30 x 1.5, stroke 8.5 mm, max. 33.3 J per cycle and 45 cycles/min at 20–25 °C, collision speed 0.05–3 m/s, max. allowable thrust 981 N, return spring 21.57/44.23 N (extended/retracted), weight 182 g; stopper nut RBQ30S, replacement bumper RBQC30C (pages 1310 and 1311).","goto_step":"rb-size"},{"severity":"info","if_json":{"and":[{"==":[{"var":"series"},"RBQ"]},{"==":[{"var":"size"},"3213"]}]},"message_sv":"RBQ3213: M32 x 1,5, slag 13 mm, högst 49 J per slag och 30 slag/min vid 20–25 °C, kollisionshastighet 0,05–3 m/s, största axialkraft 1177 N, returfjäder 24,52/54,23 N (ut/in), vikt 240 g; stoppmutter RBQ32S, reservbuffert RBQC32C (sida 1310 och 1311).","message_en":"RBQ3213: M32 x 1.5, stroke 13 mm, max. 49 J per cycle and 30 cycles/min at 20–25 °C, collision speed 0.05–3 m/s, max. allowable thrust 1177 N, return spring 24.52/54.23 N (extended/retracted), weight 240 g; stopper nut RBQ32S, replacement bumper RBQC32C (pages 1310 and 1311).","goto_step":"rb-size"},{"severity":"info","if_json":{"==":[{"var":"series"},"RB"]},"message_sv":"RB: -10…80 °C (frostfritt), två sexkantmuttrar medföljer; välj storlek efter energi per slag, energi per minut och ekvivalent massa enligt urvalet på sida 1296–1298.","message_en":"RB: -10…80 °C (no freezing), two hexagon nuts included; select the size by energy per cycle, energy per minute and equivalent mass per the selection on pages 1296–1298.","goto_step":"rb-series"},{"severity":"info","if_json":{"==":[{"var":"series"},"RBL"]},"message_sv":"RBL: avstrykare och stångtätning bildar en dubbel tätning mot icke vattenlöslig skärolja (JIS klass 1); -10…80 °C, två sexkantmuttrar medföljer (sida 1306).","message_en":"RBL: the scraper and rod seal form a double seal against non-water-soluble cutting oil (JIS class 1); -10…80 °C, two hexagon nuts included (page 1306).","goto_step":"rb-series"},{"severity":"info","if_json":{"==":[{"var":"series"},"RBQ"]},"message_sv":"RBQ: kort typ för rotationsenergi, tillåten excentricitet 5°, kollisionshastighet 0,05–3 m/s, -10…80 °C, två sexkantmuttrar medföljer; urval på sida 1312–1314 (sida 1310).","message_en":"RBQ: short type for rotating energy, allowable eccentric angle 5°, collision speed 0.05–3 m/s, -10…80 °C, two hexagon nuts included; selection on pages 1312–1314 (page 1310).","goto_step":"rb-series"},{"severity":"info","if_json":{"==":[{"var":"type"},"C"]},"message_sv":"Kåpan (RB/RBL) respektive gummibufferten (RBQ) kan inte monteras på bastypen i efterhand — beställ C från början; reservdelen är bara plast-/gummidelen (sida 1299, 1306, 1310).","message_en":"The cap (RB/RBL) or rubber bumper (RBQ) cannot be mounted on the basic type afterwards — order C from the beginning; the replacement part is only the resin/rubber part (pages 1299, 1306, 1310).","goto_step":"rb-type"},{"severity":"info","if_json":{"==":[{"var":"option"},"J"]},"message_sv":"Tillval J: 3 sexkantmuttrar (sida 1299, 1306, 1310).","message_en":"Option J: 3 hexagon nuts (pages 1299, 1306, 1310).","goto_step":"rb-option"},{"severity":"info","if_json":{"==":[{"var":"option"},"N"]},"message_sv":"Tillval N: inga sexkantmuttrar (sida 1299, 1306, 1310).","message_en":"Option N: no hexagon nuts (pages 1299, 1306, 1310).","goto_step":"rb-option"},{"severity":"info","if_json":{"==":[{"var":"option"},"S"]},"message_sv":"Tillval S: 2 sexkantmuttrar och en stoppmutter (kåptypen har egen stoppmutter RBC□□S) (sida 1299, 1306, 1310).","message_en":"Option S: 2 hexagon nuts and one stopper nut (the cap type has its own stopper nut RBC□□S) (pages 1299, 1306, 1310).","goto_step":"rb-option"},{"severity":"info","if_json":{"==":[{"var":"option"},"SJ"]},"message_sv":"Tillval SJ: 3 sexkantmuttrar och en stoppmutter (kåptypen har egen stoppmutter RBC□□S) (sida 1299, 1306, 1310).","message_en":"Option SJ: 3 hexagon nuts and one stopper nut (the cap type has its own stopper nut RBC□□S) (pages 1299, 1306, 1310).","goto_step":"rb-option"},{"severity":"info","if_json":{"==":[{"var":"option"},"SN"]},"message_sv":"Tillval SN: inga sexkantmuttrar och en stoppmutter (kåptypen har egen stoppmutter RBC□□S) (sida 1299, 1306, 1310).","message_en":"Option SN: no hexagon nuts and one stopper nut (the cap type has its own stopper nut RBC□□S) (pages 1299, 1306, 1310).","goto_step":"rb-option"}]'::jsonb) r;

insert into knowledge_doc_families (source_file, family_slug, doc_title)
values ('smc-kat-rb.pdf', 'rb', 'SMC — SMC Shock Absorber RB/RBL/RBQ Series')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;


update products set
  sku = 'SMC-RB0806',
  family = 'RB',
  name = 'RB0806 Hydraulic Shock Absorber M8 x 1.0, stroke 6 mm',
  description = 'SMC RB0806 hydraulic shock absorber, M8 x 1.0, stroke 6 mm, max. 2.94 J per cycle, 80 cycles/min, collision speed 0.05–5 m/s, max. allowable thrust 245 N, −10…80 °C. Self-adjusting porous orifice (no manual adjustment), two hexagon nuts included; with cap: RBC0806; foot bracket RB08-X331. Catalogue page 1299.'
where sku = 'SMC-RBQ0806W';

update product_specs s set value = x.value
from products p, (values
  ('sizes', 'M8 x 1,0'),
  ('stroke_mm', '6'),
  ('temp_range', '-10…+80')
) as x(key, value)
where s.product_id = p.id and p.sku = 'SMC-RB0806' and s.key = x.key;

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-RB0806' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'RB'),
  ('thread', 'M8 x 1,0'),
  ('energy_j', '2.94'),
  ('max_freq_per_min', '80'),
  ('max_thrust_n', '245'),
  ('collision_speed_m_s', '0.05–5'),
  ('order_code_example', 'RB0806'),
  ('catalogue', 'SMC RB, How to Order och data sida 1299, delar sida 1302')
) as x(key, value)
where p.sku = 'SMC-RB0806'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update products set
  sku = 'SMC-RB1006',
  family = 'RB',
  name = 'RB1006 Hydraulic Shock Absorber M10 x 1.0, stroke 6 mm',
  description = 'SMC RB1006 hydraulic shock absorber, M10 x 1.0, stroke 6 mm, max. 3.92 J per cycle, 70 cycles/min, collision speed 0.05–5 m/s, max. allowable thrust 422 N, −10…80 °C. Self-adjusting porous orifice (no manual adjustment), two hexagon nuts included; with cap: RBC1006; foot bracket RB10-X331. Catalogue page 1299.'
where sku = 'SMC-RBQ1006W';

update product_specs s set value = x.value
from products p, (values
  ('sizes', 'M10 x 1,0'),
  ('stroke_mm', '6'),
  ('temp_range', '-10…+80')
) as x(key, value)
where s.product_id = p.id and p.sku = 'SMC-RB1006' and s.key = x.key;

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-RB1006' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'RB'),
  ('thread', 'M10 x 1,0'),
  ('energy_j', '3.92'),
  ('max_freq_per_min', '70'),
  ('max_thrust_n', '422'),
  ('collision_speed_m_s', '0.05–5'),
  ('order_code_example', 'RB1006'),
  ('catalogue', 'SMC RB, How to Order och data sida 1299, delar sida 1302')
) as x(key, value)
where p.sku = 'SMC-RB1006'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update products set
  sku = 'SMC-RB1412',
  family = 'RB',
  name = 'RB1412 Hydraulic Shock Absorber M14 x 1.5, stroke 12 mm',
  description = 'SMC RB1412 hydraulic shock absorber, M14 x 1.5, stroke 12 mm, max. 19.6 J per cycle, 45 cycles/min, collision speed 0.05–5 m/s, max. allowable thrust 814 N, −10…80 °C. Self-adjusting porous orifice (no manual adjustment), two hexagon nuts included; with cap: RBC1412; foot bracket RB14-X331. Catalogue page 1299.'
where sku = 'SMC-RBQ1412W';

update product_specs s set value = x.value
from products p, (values
  ('sizes', 'M14 x 1,5'),
  ('stroke_mm', '12'),
  ('temp_range', '-10…+80')
) as x(key, value)
where s.product_id = p.id and p.sku = 'SMC-RB1412' and s.key = x.key;

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-RB1412' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'RB'),
  ('thread', 'M14 x 1,5'),
  ('energy_j', '19.6'),
  ('max_freq_per_min', '45'),
  ('max_thrust_n', '814'),
  ('collision_speed_m_s', '0.05–5'),
  ('order_code_example', 'RB1412'),
  ('catalogue', 'SMC RB, How to Order och data sida 1299, delar sida 1302')
) as x(key, value)
where p.sku = 'SMC-RB1412'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update products set
  sku = 'SMC-RB2015',
  family = 'RB',
  name = 'RB2015 Hydraulic Shock Absorber M20 x 1.5, stroke 15 mm',
  description = 'SMC RB2015 hydraulic shock absorber, M20 x 1.5, stroke 15 mm, max. 58.8 J per cycle, 25 cycles/min, collision speed 0.05–5 m/s, max. allowable thrust 1961 N, −10…80 °C. Self-adjusting porous orifice (no manual adjustment), two hexagon nuts included; with cap: RBC2015; foot bracket RB20-X331. Catalogue page 1299.'
where sku = 'SMC-RBQ2025W';

update product_specs s set value = x.value
from products p, (values
  ('sizes', 'M20 x 1,5'),
  ('stroke_mm', '15'),
  ('temp_range', '-10…+80')
) as x(key, value)
where s.product_id = p.id and p.sku = 'SMC-RB2015' and s.key = x.key;

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-RB2015' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'RB'),
  ('thread', 'M20 x 1,5'),
  ('energy_j', '58.8'),
  ('max_freq_per_min', '25'),
  ('max_thrust_n', '1961'),
  ('collision_speed_m_s', '0.05–5'),
  ('order_code_example', 'RB2015'),
  ('catalogue', 'SMC RB, How to Order och data sida 1299, delar sida 1302')
) as x(key, value)
where p.sku = 'SMC-RB2015'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


commit;


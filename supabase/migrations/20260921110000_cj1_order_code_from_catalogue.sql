-- Speglar det som lades på databasen 2026-09-21 via apply_migration i tre delar:
--   cj1_order_code_from_catalogue_part_01  (backup, schema, familj, parametrar, värdelista)
--   cj1_order_code_from_catalogue_part_02  (regler 1–14, dokumentkarta, produktraderna döpta om)
--   cj1_order_code_from_catalogue_part_03  (slagens etiketter "Slag 5 mm" -- "5 mm" klipptes av stripLeadingCode)
-- Fingeravtryck efter körning, identiska med modellen (scripts/fingerprint-rules.ts cj1,
-- scripts/fingerprint-values.py):
--   regler  14   md5 dcf400ec7ce64e130cfa28a1c8d77847   villkor 27258a4934de682364d5c62aa20458e8
--   värden   7   md5 fe7583012d0c372d87dc6742a6bc076b
--   schema       md5 e831cedb9a1a951b256cda64c102acb8
-- Verifierat live: /sv/configurator/cj1 bygger CJ1B4-5U4 (nyckelns exempel sida 16),
-- CJ1B4-10SU4 (sida 18) och CJ1B4-20U4 (produktraden); stoppar ø2,5 dubbelverkande
-- och ø2,5 med slag 20.
--
-- CJ1: beställnyckeln enligt SMC Air Cylinder Series CJ1 (Pin Cylinder) (sida 16 och 18).
-- GENERERAD ur src/lib/catalog/cj1.ts -- redigera inte för hand.
--
-- Rättar familjen cj1, som hade mallen 'CJ1-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
-- med ø4/ø6, dämpning och givare -- inget av det finns i katalogen. SMC:s kod är
-- CJ1B{borrning}-{slag}{funktion}U4, t.ex. CJ1B4-5U4 (dubbelverkande, sida 16)
-- och CJ1B4-10SU4 (enkelverkande fjäderretur, sida 18); ø2,5 (kod 2) finns bara
-- enkelverkande, standardslag 5–20 mm.
--
-- SMC-CJ1B4 döps om till SMC-CJ1B4-20U4; SMC-CJ1B6 (ø6 finns inte i CJ1) blir
-- SMC-CJ1B2-10SU4 med katalogens data.

begin;


create schema if not exists backup;
create table if not exists backup.cj1_before_20260921 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'cj1'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'cj1'
  union all
  select 'family', f.id::text, f.slug, coalesce(f.order_code_template, '')
  from configurator_families f where f.slug = 'cj1';

insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-CJ1-V1', '{"version":"1.0","steps":[{"id":"bore","step":1,"title_sv":"Borrning","title_en":"Bore size","required":true,"type":"single_select","options":[{"v":"2","label":"ø2,5 mm (bara enkelverkande)"},{"v":"4","label":"ø4 mm"}]},{"id":"action","step":2,"title_sv":"Funktion (standard är dubbelverkande)","title_en":"Action (double acting is standard)","required":false,"type":"single_select","options":[{"v":"S","label":"Enkelverkande, fjäderretur (ø2,5 och ø4)"}]},{"id":"stroke","step":3,"title_sv":"Standardslag","title_en":"Standard stroke","required":true,"type":"single_select","options":[{"v":"5","label":"Slag 5 mm"},{"v":"10","label":"Slag 10 mm"},{"v":"15","label":"Slag 15 mm (bara ø4)"},{"v":"20","label":"Slag 20 mm (bara ø4)"}]}]}'::jsonb,
        'SMC CJ1 stiftcylinder', 'SMC CJ1 pin cylinder', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  title = 'Stiftcylinder CJ1 ø2,5/ø4, dubbelverkande eller enkelverkande med fjäderretur, slag 5–20 mm',
  description = 'SMC CJ1 pin cylinder, basic style: double acting ø4 (stroke 5–20 mm) or single acting spring return ø2.5 (5–10 mm) and ø4 (5–20 mm), 0.2/0.3–0.7 MPa, no cushion, no auto switch, non-lube; connection for ø4/ø2.5 tubing (U4).',
  stroke_min_mm = 5,
  stroke_max_mm = 20,
  order_code_template = 'CJ1B{bore}-{stroke}{action}U4',
  rules_schema_id = 'SCHEMA-CJ1-V1'
where slug = 'cj1';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'cj1';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'cj1';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"bore","label":"Borrning","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"action","label":"Funktion (standard är dubbelverkande)","param_type":"select","sort_order":2,"required":false,"min_value":null,"max_value":null},{"param_key":"stroke","label":"Standardslag","param_type":"select","sort_order":3,"required":true,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'cj1';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"bore","code":"2","label":"ø2,5 mm (bara enkelverkande)","sort_order":0},{"param_key":"bore","code":"4","label":"ø4 mm","sort_order":1},{"param_key":"action","code":"S","label":"Enkelverkande, fjäderretur (ø2,5 och ø4)","sort_order":0},{"param_key":"stroke","code":"5","label":"Slag 5 mm","sort_order":0},{"param_key":"stroke","code":"10","label":"Slag 10 mm","sort_order":1},{"param_key":"stroke","code":"15","label":"Slag 15 mm (bara ø4)","sort_order":2},{"param_key":"stroke","code":"20","label":"Slag 20 mm (bara ø4)","sort_order":3}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'cj1';

delete from config_rules where schema_id = 'SCHEMA-CJ1-V1';


insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-CJ1-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{"==":[{"var":"bore"},"2"]},{"==":[{"var":"action"},""]}]},"message_sv":"ø2,5 finns bara enkelverkande med fjäderretur (S) (sida 15).","message_en":"ø2.5 is only available single acting, spring return (S) (page 15).","goto_step":"cj1-action"},{"severity":"error","if_json":{"and":[{"==":[{"var":"bore"},"2"]},{"==":[{"var":"action"},"S"]},{"in":[{"var":"stroke"},["15","20"]]}]},"message_sv":"CJ1B2-□S ø2,5 tillverkas med standardslag 5 och 10 mm (sida 18).","message_en":"CJ1B2-□S ø2.5 is made with the standard strokes 5 and 10 mm (page 18).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"4"]},{"==":[{"var":"action"},""]},{"==":[{"var":"stroke"},"5"]}]},"message_sv":"CJ1B4-5U4: ø4, kolvstång ø2, slag 5 mm, dubbelverkande, 0,2–0,7 MPa, teoretisk kraft vid 0,5 MPa 6,3 N ut och 4,7 N in; längd 18 mm indragen (Z 51 mm), vikt 12 g (sida 16 och 17).","message_en":"CJ1B4-5U4: ø4, piston rod ø2, stroke 5 mm, double acting, 0.2–0.7 MPa, theoretical output at 0.5 MPa 6.3 N out and 4.7 N in; length 18 mm retracted (Z 51 mm), weight 12 g (pages 16 and 17).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"4"]},{"==":[{"var":"action"},""]},{"==":[{"var":"stroke"},"10"]}]},"message_sv":"CJ1B4-10U4: ø4, kolvstång ø2, slag 10 mm, dubbelverkande, 0,2–0,7 MPa, teoretisk kraft vid 0,5 MPa 6,3 N ut och 4,7 N in; längd 23 mm indragen (Z 56 mm), vikt 12,4 g (sida 16 och 17).","message_en":"CJ1B4-10U4: ø4, piston rod ø2, stroke 10 mm, double acting, 0.2–0.7 MPa, theoretical output at 0.5 MPa 6.3 N out and 4.7 N in; length 23 mm retracted (Z 56 mm), weight 12.4 g (pages 16 and 17).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"4"]},{"==":[{"var":"action"},""]},{"==":[{"var":"stroke"},"15"]}]},"message_sv":"CJ1B4-15U4: ø4, kolvstång ø2, slag 15 mm, dubbelverkande, 0,2–0,7 MPa, teoretisk kraft vid 0,5 MPa 6,3 N ut och 4,7 N in; längd 28 mm indragen (Z 61 mm), vikt 12,8 g (sida 16 och 17).","message_en":"CJ1B4-15U4: ø4, piston rod ø2, stroke 15 mm, double acting, 0.2–0.7 MPa, theoretical output at 0.5 MPa 6.3 N out and 4.7 N in; length 28 mm retracted (Z 61 mm), weight 12.8 g (pages 16 and 17).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"4"]},{"==":[{"var":"action"},""]},{"==":[{"var":"stroke"},"20"]}]},"message_sv":"CJ1B4-20U4: ø4, kolvstång ø2, slag 20 mm, dubbelverkande, 0,2–0,7 MPa, teoretisk kraft vid 0,5 MPa 6,3 N ut och 4,7 N in; längd 33 mm indragen (Z 66 mm), vikt 13,2 g (sida 16 och 17).","message_en":"CJ1B4-20U4: ø4, piston rod ø2, stroke 20 mm, double acting, 0.2–0.7 MPa, theoretical output at 0.5 MPa 6.3 N out and 4.7 N in; length 33 mm retracted (Z 66 mm), weight 13.2 g (pages 16 and 17).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"2"]},{"==":[{"var":"action"},"S"]},{"==":[{"var":"stroke"},"5"]}]},"message_sv":"CJ1B2-5SU4: ø2,5, kolvstång ø1, slag 5 mm, enkelverkande fjäderretur, 0,3–0,7 MPa, teoretisk kraft vid 0,5 MPa 1,32 N ut; fjäderkraft 1,13 N indragen och 0,64 N utskjuten — fjädern drar bara in kolvstången, belasta den inte under returslaget; längd 16,5 mm indragen (Z 29 mm), vikt 1,5 g (sida 18 och 19).","message_en":"CJ1B2-5SU4: ø2.5, piston rod ø1, stroke 5 mm, single acting spring return, 0.3–0.7 MPa, theoretical output at 0.5 MPa 1.32 N out; spring force 1.13 N retracted and 0.64 N extended — the spring only retracts the piston rod, do not load it during the return stroke; length 16.5 mm retracted (Z 29 mm), weight 1.5 g (pages 18 and 19).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"2"]},{"==":[{"var":"action"},"S"]},{"==":[{"var":"stroke"},"10"]}]},"message_sv":"CJ1B2-10SU4: ø2,5, kolvstång ø1, slag 10 mm, enkelverkande fjäderretur, 0,3–0,7 MPa, teoretisk kraft vid 0,5 MPa 1,32 N ut; fjäderkraft 1,13 N indragen och 0,64 N utskjuten — fjädern drar bara in kolvstången, belasta den inte under returslaget; längd 25,5 mm indragen (Z 38 mm), vikt 2 g (sida 18 och 19).","message_en":"CJ1B2-10SU4: ø2.5, piston rod ø1, stroke 10 mm, single acting spring return, 0.3–0.7 MPa, theoretical output at 0.5 MPa 1.32 N out; spring force 1.13 N retracted and 0.64 N extended — the spring only retracts the piston rod, do not load it during the return stroke; length 25.5 mm retracted (Z 38 mm), weight 2 g (pages 18 and 19).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"4"]},{"==":[{"var":"action"},"S"]},{"==":[{"var":"stroke"},"5"]}]},"message_sv":"CJ1B4-5SU4: ø4, kolvstång ø2, slag 5 mm, enkelverkande fjäderretur, 0,3–0,7 MPa, teoretisk kraft vid 0,5 MPa 3,26 N ut; fjäderkraft 3,04 N indragen och 1,47 N utskjuten — fjädern drar bara in kolvstången, belasta den inte under returslaget; längd 19,5 mm indragen (Z 40 mm), vikt 3,7 g (sida 18 och 19).","message_en":"CJ1B4-5SU4: ø4, piston rod ø2, stroke 5 mm, single acting spring return, 0.3–0.7 MPa, theoretical output at 0.5 MPa 3.26 N out; spring force 3.04 N retracted and 1.47 N extended — the spring only retracts the piston rod, do not load it during the return stroke; length 19.5 mm retracted (Z 40 mm), weight 3.7 g (pages 18 and 19).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"4"]},{"==":[{"var":"action"},"S"]},{"==":[{"var":"stroke"},"10"]}]},"message_sv":"CJ1B4-10SU4: ø4, kolvstång ø2, slag 10 mm, enkelverkande fjäderretur, 0,3–0,7 MPa, teoretisk kraft vid 0,5 MPa 3,26 N ut; fjäderkraft 3,04 N indragen och 1,47 N utskjuten — fjädern drar bara in kolvstången, belasta den inte under returslaget; längd 28,5 mm indragen (Z 49 mm), vikt 4,6 g (sida 18 och 19).","message_en":"CJ1B4-10SU4: ø4, piston rod ø2, stroke 10 mm, single acting spring return, 0.3–0.7 MPa, theoretical output at 0.5 MPa 3.26 N out; spring force 3.04 N retracted and 1.47 N extended — the spring only retracts the piston rod, do not load it during the return stroke; length 28.5 mm retracted (Z 49 mm), weight 4.6 g (pages 18 and 19).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"4"]},{"==":[{"var":"action"},"S"]},{"==":[{"var":"stroke"},"15"]}]},"message_sv":"CJ1B4-15SU4: ø4, kolvstång ø2, slag 15 mm, enkelverkande fjäderretur, 0,3–0,7 MPa, teoretisk kraft vid 0,5 MPa 3,26 N ut; fjäderkraft 3,04 N indragen och 1,47 N utskjuten — fjädern drar bara in kolvstången, belasta den inte under returslaget; längd 37,5 mm indragen (Z 58 mm), vikt 5,6 g (sida 18 och 19).","message_en":"CJ1B4-15SU4: ø4, piston rod ø2, stroke 15 mm, single acting spring return, 0.3–0.7 MPa, theoretical output at 0.5 MPa 3.26 N out; spring force 3.04 N retracted and 1.47 N extended — the spring only retracts the piston rod, do not load it during the return stroke; length 37.5 mm retracted (Z 58 mm), weight 5.6 g (pages 18 and 19).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"and":[{"==":[{"var":"bore"},"4"]},{"==":[{"var":"action"},"S"]},{"==":[{"var":"stroke"},"20"]}]},"message_sv":"CJ1B4-20SU4: ø4, kolvstång ø2, slag 20 mm, enkelverkande fjäderretur, 0,3–0,7 MPa, teoretisk kraft vid 0,5 MPa 3,26 N ut; fjäderkraft 3,04 N indragen och 1,47 N utskjuten — fjädern drar bara in kolvstången, belasta den inte under returslaget; längd 46,5 mm indragen (Z 67 mm), vikt 6,5 g (sida 18 och 19).","message_en":"CJ1B4-20SU4: ø4, piston rod ø2, stroke 20 mm, single acting spring return, 0.3–0.7 MPa, theoretical output at 0.5 MPa 3.26 N out; spring force 3.04 N retracted and 1.47 N extended — the spring only retracts the piston rod, do not load it during the return stroke; length 46.5 mm retracted (Z 67 mm), weight 6.5 g (pages 18 and 19).","goto_step":"cj1-stroke"},{"severity":"info","if_json":{"==":[{"var":"bore"},"2"]},"message_sv":"CJ1 ø2,5: bastyp utan dämpning och utan givare, -10…70 °C (frostfritt), kolvhastighet 50–500 mm/s, provtryck 1,05 MPa, smörjfri; anslutning för slang ø4/ø2,5 polyuretan TU0425 eller mjuk nylon TS0425 (U4), kopplingen på stångsidan kan vridas ±90° (sida 16 och 18).","message_en":"CJ1 ø2.5: basic style without cushion and without auto switch, -10…70 °C (no freezing), piston speed 50–500 mm/s, proof pressure 1.05 MPa, non-lube; connection for ø4/ø2.5 polyurethane TU0425 or soft nylon TS0425 tubing (U4), the rod-side fitting rotates ±90° (pages 16 and 18).","goto_step":"cj1-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"4"]},"message_sv":"CJ1 ø4: bastyp utan dämpning och utan givare, -10…70 °C (frostfritt), kolvhastighet 50–500 mm/s, provtryck 1,05 MPa, smörjfri; anslutning för slang ø4/ø2,5 polyuretan TU0425 eller mjuk nylon TS0425 (U4), kopplingen på stångsidan kan vridas ±90° (sida 16 och 18).","message_en":"CJ1 ø4: basic style without cushion and without auto switch, -10…70 °C (no freezing), piston speed 50–500 mm/s, proof pressure 1.05 MPa, non-lube; connection for ø4/ø2.5 polyurethane TU0425 or soft nylon TS0425 tubing (U4), the rod-side fitting rotates ±90° (pages 16 and 18).","goto_step":"cj1-bore"}]'::jsonb) r;

insert into knowledge_doc_families (source_file, family_slug, doc_title)
values ('smc-kat-cj1.pdf', 'cj1', 'SMC — SMC Air Cylinder Series CJ1 (Pin Cylinder)')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;


update products set
  sku = 'SMC-CJ1B4-20U4',
  family = 'CJ1',
  name = 'CJ1B4-20U4 Pin Cylinder ø4, double acting, stroke 20 mm',
  description = 'SMC CJ1 pin cylinder CJ1B4-20U4, bore 4 mm, piston rod ø2 mm, double acting, stroke 20 mm, basic style, 0.2–0.7 MPa, −10…70 °C, no cushion, no auto switch, non-lube. Theoretical output at 0.5 MPa 6.3 N out and 4.7 N in; weight 13.2 g. Connection for ø4/ø2.5 polyurethane (TU0425) or soft nylon (TS0425) tubing. Catalogue page 16.'
where sku = 'SMC-CJ1B4';

update product_specs s set value = x.value, unit = x.unit
from products p, (values
  ('bore_mm', '4', 'mm'),
  ('stroke_mm', '20', 'mm'),
  ('max_pressure', '7', 'bar'),
  ('temp_range', '-10…+70', '°C')
) as x(key, value, unit)
where s.product_id = p.id and p.sku = 'SMC-CJ1B4-20U4' and s.key = x.key;

insert into product_specs (product_id, key, value, unit)
select p.id, x.key, x.value, x.unit
from products p
cross join lateral (values
  ('mode_of_operation', 'Double-acting', null),
  ('min_pressure_mpa', '0.2', null),
  ('rod_mm', '2', 'mm'),
  ('force_n', '6.3', 'N'),
  ('standard_strokes_mm', '5, 10, 15, 20', 'mm'),
  ('order_code_example', 'CJ1B4-20U4', null),
  ('catalogue', 'SMC CJ1, How to Order och data sida 16, mått sida 17', null)
) as x(key, value, unit)
where p.sku = 'SMC-CJ1B4-20U4'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update products set
  sku = 'SMC-CJ1B2-10SU4',
  family = 'CJ1',
  name = 'CJ1B2-10SU4 Pin Cylinder ø2.5, single acting, spring return, stroke 10 mm',
  description = 'SMC CJ1 pin cylinder CJ1B2-10SU4, bore 2.5 mm, piston rod ø1 mm, single acting, spring return, stroke 10 mm, basic style, 0.3–0.7 MPa, −10…70 °C, no cushion, no auto switch, non-lube. Theoretical output at 0.5 MPa 1.32 N out (spring force 1.13 N retracted / 0.64 N extended); weight 2 g. Connection for ø4/ø2.5 polyurethane (TU0425) or soft nylon (TS0425) tubing. Catalogue page 18.'
where sku = 'SMC-CJ1B6';

update product_specs s set value = x.value, unit = x.unit
from products p, (values
  ('bore_mm', '2.5', 'mm'),
  ('stroke_mm', '10', 'mm'),
  ('max_pressure', '7', 'bar'),
  ('temp_range', '-10…+70', '°C')
) as x(key, value, unit)
where s.product_id = p.id and p.sku = 'SMC-CJ1B2-10SU4' and s.key = x.key;

insert into product_specs (product_id, key, value, unit)
select p.id, x.key, x.value, x.unit
from products p
cross join lateral (values
  ('mode_of_operation', 'Single-acting, spring return', null),
  ('min_pressure_mpa', '0.3', null),
  ('rod_mm', '1', 'mm'),
  ('force_n', '1.32', 'N'),
  ('standard_strokes_mm', '5, 10', 'mm'),
  ('order_code_example', 'CJ1B2-10SU4', null),
  ('catalogue', 'SMC CJ1, How to Order och data sida 18, mått sida 19', null)
) as x(key, value, unit)
where p.sku = 'SMC-CJ1B2-10SU4'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


commit;


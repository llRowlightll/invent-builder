-- Speglar det som lades på databasen 2026-09-15 via apply_migration i två delar:
--   cjp_order_code_from_catalogue_part_01  (backup, schema, familj, parametrar, värdelista)
--   cjp_order_code_from_catalogue_part_02  (regler, dokumentkarta, produktspecar)
-- Fingeravtryck efter körning, identiska med modellen (scripts/fingerprint-rules.ts cjp):
--   regler  15   md5 616cc1a82ace7108935ba7670488a265   villkor 48af34903266940ae88ae21f10097b06
--   värden  13   md5 2e81d7e344cf9635c60404610a02102e
--   schema       md5 e12cddbbdd3a11cbf40c5c89793d9c37
-- Verifierat live: /sv/configurator/cjp bygger CJPB16-15H4Z-T (nyckelns exempel, sida 1).
--
-- CJP: beställnyckeln enligt SMC Pin Cylinder CJP Series.
-- GENERERAD ur src/lib/catalog/cjp.ts -- redigera inte för hand.
--
-- Rättar familjen cjp, som hade mallen 'CJP-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
-- (CJP har varken dämpning eller givare). SMC:s kod är
-- CJP{montage}{ø}-{slag}{slangnippel}Z-{gänga}{kåpa}-{special}, t.ex. CJPB16-15H4Z-T
-- (sida 1). Montage, slangnippel, gänga och kåpa fanns inte alls.
--
-- SMC-CJPB4/B6/B10 får katalogens slag (5, 10, 15) och tryck.

begin;

create schema if not exists backup;
create table if not exists backup.cjp_before_20260915 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'cjp'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'cjp'
  union all
  select 'family', f.id::text, f.slug, coalesce(f.order_code_template, '')
  from configurator_families f where f.slug = 'cjp';

insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-CJP-V1', '{"version":"1.0","steps":[{"id":"bore","step":1,"title_sv":"Kolvdiameter","title_en":"Bore size","required":true,"type":"single_select","options":[{"v":"4","label":"ø4 mm"},{"v":"6","label":"ø6 mm"},{"v":"10","label":"ø10 mm"},{"v":"16","label":"ø16 mm"}]},{"id":"mounting","step":2,"title_sv":"Montage","title_en":"Mounting","required":true,"type":"single_select","options":[{"v":"B","label":"Panelmontage (två fästmuttrar)"},{"v":"S","label":"Inbyggt montage (fästmutter och packning)"}]},{"id":"stroke_mm","step":3,"title_sv":"Slaglängd (5, 10 eller 15)","title_en":"Stroke (5, 10 or 15)","required":true,"type":"numeric","min":5,"max":15,"unit":"mm"},{"id":"nipple","step":4,"title_sv":"Slangnippel","title_en":"Hose nipple","required":false,"type":"single_select","options":[{"v":"H4","label":"Slangnippel för ø4/ø2,5-slang (panelmontage B, ø6–16)"},{"v":"H6","label":"Slangnippel för ø6/ø4-slang (panelmontage B, ø6–16)"}]},{"id":"rod_thread","step":5,"title_sv":"Kolvstångsände","title_en":"Rod end thread","required":false,"type":"single_select","options":[{"v":"B","label":"Kolvstång utan gänga (standard är gängad)"}]},{"id":"cap","step":6,"title_sv":"Kolvstångskåpa","title_en":"Rod end cap","required":false,"type":"single_select","options":[{"v":"T","label":"Kolvstångskåpa, platt (kräver gängad kolvstång)"},{"v":"U","label":"Kolvstångskåpa, rund (kräver gängad kolvstång)"}]},{"id":"mto","step":7,"title_sv":"Specialutförande","title_en":"Made to order","required":false,"type":"single_select","options":[{"v":"XC17","label":"-XC17 Härdad kolvstångsände, utan gänga (ø6–16)"},{"v":"XC22","label":"-XC22 Fluorgummitätningar (ø6–16)"}]}]}'::jsonb,
        'SMC CJP stiftcylinder', 'SMC CJP pin cylinder', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  title = 'Stiftcylinder ø4–16, enkelverkande fjäderretur, slag 5/10/15',
  description = 'SMC CJP pin cylinder, single acting spring return, ø4/6/10/16 mm, strokes 5, 10 and 15 mm, panel mount or embedded.',
  stroke_min_mm = 5,
  stroke_max_mm = 15,
  order_code_template = 'CJP{mounting}{bore}-{stroke_mm}{nipple}Z-{rod_thread}{cap}-{mto}',
  rules_schema_id = 'SCHEMA-CJP-V1'
where slug = 'cjp';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'cjp';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'cjp';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"bore","label":"Kolvdiameter","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"mounting","label":"Montage","param_type":"select","sort_order":2,"required":true,"min_value":null,"max_value":null},{"param_key":"stroke_mm","label":"Slaglängd (5, 10 eller 15)","param_type":"number","sort_order":3,"required":true,"min_value":5,"max_value":15},{"param_key":"nipple","label":"Slangnippel","param_type":"select","sort_order":4,"required":false,"min_value":null,"max_value":null},{"param_key":"rod_thread","label":"Kolvstångsände","param_type":"select","sort_order":5,"required":false,"min_value":null,"max_value":null},{"param_key":"cap","label":"Kolvstångskåpa","param_type":"select","sort_order":6,"required":false,"min_value":null,"max_value":null},{"param_key":"mto","label":"Specialutförande","param_type":"select","sort_order":7,"required":false,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'cjp';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"bore","code":"4","label":"ø4 mm","sort_order":0},{"param_key":"bore","code":"6","label":"ø6 mm","sort_order":1},{"param_key":"bore","code":"10","label":"ø10 mm","sort_order":2},{"param_key":"bore","code":"16","label":"ø16 mm","sort_order":3},{"param_key":"mounting","code":"B","label":"Panelmontage (två fästmuttrar)","sort_order":0},{"param_key":"mounting","code":"S","label":"Inbyggt montage (fästmutter och packning)","sort_order":1},{"param_key":"nipple","code":"H4","label":"Slangnippel för ø4/ø2,5-slang (panelmontage B, ø6–16)","sort_order":0},{"param_key":"nipple","code":"H6","label":"Slangnippel för ø6/ø4-slang (panelmontage B, ø6–16)","sort_order":1},{"param_key":"rod_thread","code":"B","label":"Kolvstång utan gänga (standard är gängad)","sort_order":0},{"param_key":"cap","code":"T","label":"Kolvstångskåpa, platt (kräver gängad kolvstång)","sort_order":0},{"param_key":"cap","code":"U","label":"Kolvstångskåpa, rund (kräver gängad kolvstång)","sort_order":1},{"param_key":"mto","code":"XC17","label":"-XC17 Härdad kolvstångsände, utan gänga (ø6–16)","sort_order":0},{"param_key":"mto","code":"XC22","label":"-XC22 Fluorgummitätningar (ø6–16)","sort_order":1}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'cjp';

delete from config_rules where schema_id = 'SCHEMA-CJP-V1';


insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-CJP-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[5,10,15]]}}]},"message_sv":"CJP finns i slag 5, 10 eller 15 mm, inga mellanslag (sida 1).","message_en":"CJP exists in strokes 5, 10 or 15 mm, no intermediate strokes (page 1).","goto_step":"cjp-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"nipple"},["H4","H6"]]},{"==":[{"var":"mounting"},"S"]}]},"message_sv":"Slangnippeln H4/H6 finns bara för panelmontaget B; det inbyggda montaget S levereras utan nippel (sida 1).","message_en":"The hose nipple H4/H6 exists for the panel mount type B only; the embedded type S ships without a nipple (page 1).","goto_step":"cjp-nipple"},{"severity":"error","if_json":{"and":[{"in":[{"var":"nipple"},["H4","H6"]]},{"in":[{"var":"bore"},["4"]]}]},"message_sv":"Slangnippeln H4/H6 finns inte för ø4 (sida 1).","message_en":"The hose nipple H4/H6 does not exist for ø4 (page 1).","goto_step":"cjp-nipple"},{"severity":"error","if_json":{"and":[{"in":[{"var":"cap"},["T","U"]]},{"==":[{"var":"rod_thread"},"B"]}]},"message_sv":"Kolvstångskåpan T/U skruvas på gängan — välj gängad kolvstång (standard), inte B (sida 1).","message_en":"The rod end cap T/U screws onto the thread — choose the threaded rod (standard), not B (page 1).","goto_step":"cjp-cap"},{"severity":"error","if_json":{"and":[{"in":[{"var":"mto"},["XC17","XC22"]]},{"in":[{"var":"bore"},["4"]]}]},"message_sv":"-XC17 och XC22 finns för ø6, 10 och 16, inte ø4 (sida 1 och 7).","message_en":"-XC17 and XC22 exist for ø6, 10 and 16, not ø4 (pages 1 and 7).","goto_step":"cjp-mto"},{"severity":"error","if_json":{"and":[{"==":[{"var":"mto"},"XC17"]},{"==":[{"var":"rod_thread"},"B"]}]},"message_sv":"-XC17 levereras alltid utan gänga; symbolen B skrivs inte i koden (sida 7).","message_en":"-XC17 always ships without thread; the symbol B is not written in the code (page 7).","goto_step":"cjp-rod_thread"},{"severity":"error","if_json":{"and":[{"==":[{"var":"mto"},"XC17"]},{"in":[{"var":"cap"},["T","U"]]}]},"message_sv":"-XC17 har ogängad kolvstång — kolvstångskåpan T/U kan inte skruvas på (sida 7).","message_en":"-XC17 has an unthreaded rod — the rod end cap T/U cannot be screwed on (page 7).","goto_step":"cjp-cap"},{"severity":"info","if_json":{"==":[{"var":"bore"},"4"]},"message_sv":"ø4: 3,48 N ut vid 0,5 MPa, fjäderretur 1 N; minsta tryck 0,3 MPa, max 0,7 MPa (sida 1–2).","message_en":"ø4: 3.48 N out at 0.5 MPa, spring return 1 N; minimum pressure 0.3 MPa, max 0.7 MPa (pages 1–2).","goto_step":"cjp-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"6"]},"message_sv":"ø6: 10,2 N ut vid 0,5 MPa, fjäderretur 1,42 N; minsta tryck 0,2 MPa, max 0,7 MPa (sida 1–2).","message_en":"ø6: 10.2 N out at 0.5 MPa, spring return 1.42 N; minimum pressure 0.2 MPa, max 0.7 MPa (pages 1–2).","goto_step":"cjp-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"10"]},"message_sv":"ø10: 33,3 N ut vid 0,5 MPa, fjäderretur 2,45 N; minsta tryck 0,15 MPa, max 0,7 MPa (sida 1–2).","message_en":"ø10: 33.3 N out at 0.5 MPa, spring return 2.45 N; minimum pressure 0.15 MPa, max 0.7 MPa (pages 1–2).","goto_step":"cjp-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"16"]},"message_sv":"ø16: 84,7 N ut vid 0,5 MPa, fjäderretur 5,04 N; minsta tryck 0,15 MPa, max 0,7 MPa (sida 1–2).","message_en":"ø16: 84.7 N out at 0.5 MPa, spring return 5.04 N; minimum pressure 0.15 MPa, max 0.7 MPa (pages 1–2).","goto_step":"cjp-bore"},{"severity":"info","if_json":{"==":[{"var":"mounting"},"B"]},"message_sv":"Panelmontage: två fästmuttrar och två kolvstångsmuttrar (med gängad stång) följer med (sida 1).","message_en":"Panel mount: two mounting nuts and two rod end nuts (with threaded rod) are included (page 1).","goto_step":"cjp-mounting"},{"severity":"info","if_json":{"==":[{"var":"mounting"},"S"]},"message_sv":"Inbyggt montage: en fästmutter, en packning och två kolvstångsmuttrar (med gängad stång) följer med (sida 1).","message_en":"Embedded type: one mounting nut, one gasket and two rod end nuts (with threaded rod) are included (page 1).","goto_step":"cjp-mounting"},{"severity":"info","if_json":{"in":[{"var":"cap"},["T","U"]]},"message_sv":"Kåpan ligger i samma förpackning och dras fast med standardcylinderns kolvstångsmutter (sida 1).","message_en":"The cap is included in the same package and is tightened with the standard cylinder''s rod end nut (page 1).","goto_step":"cjp-cap"},{"severity":"info","if_json":{"!=":[{"var":"mto"},""]},"message_sv":"Specialutförande: mått och specifikationer som standard, men leveranstid enligt SMC (sida 7). Temperatur -10…70 °C, hastighet 50–500 mm/s.","message_en":"Made to order: dimensions and specifications as standard, delivery time per SMC (page 7). Temperature -10…70 °C, speed 50–500 mm/s.","goto_step":"cjp-mto"}]'::jsonb) r;

insert into knowledge_doc_families (source_file, family_slug, doc_title)
values ('smc-kat-cjp.pdf', 'cjp', 'SMC — SMC Pin Cylinder CJP Series')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;


update product_specs s set value = '5, 10, 15 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-CJPB4' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-CJPB4' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.3'),
  ('force_out_n_at_0_5_mpa', '3.48'),
  ('spring_return_force_n', '1'),
  ('order_code_example', 'CJPB4-15Z'),
  ('catalogue', 'SMC CJP, How to Order och specifikationer sida 1, kraft sida 2')
) as x(key, value)
where p.sku = 'SMC-CJPB4'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update product_specs s set value = '5, 10, 15 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-CJPB6' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-CJPB6' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.2'),
  ('force_out_n_at_0_5_mpa', '10.2'),
  ('spring_return_force_n', '1.42'),
  ('order_code_example', 'CJPB6-15Z'),
  ('catalogue', 'SMC CJP, How to Order och specifikationer sida 1, kraft sida 2')
) as x(key, value)
where p.sku = 'SMC-CJPB6'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update product_specs s set value = '5, 10, 15 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-CJPB10' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-CJPB10' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.15'),
  ('force_out_n_at_0_5_mpa', '33.3'),
  ('spring_return_force_n', '2.45'),
  ('order_code_example', 'CJPB10-15Z'),
  ('catalogue', 'SMC CJP, How to Order och specifikationer sida 1, kraft sida 2')
) as x(key, value)
where p.sku = 'SMC-CJPB10'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


commit;


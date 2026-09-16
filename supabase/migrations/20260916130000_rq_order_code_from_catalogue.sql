-- Speglar det som lades på databasen 2026-09-16 via apply_migration i fem delar:
--   rq_order_code_from_catalogue_part_01  (backup av rdqb, familjen rdqb bort, familjen rq in, schema, familjens rad, parametrar)
--   rq_order_code_from_catalogue_part_02  (värdelista, rensning av regler)
--   rq_order_code_from_catalogue_part_03  (regler 1–20)
--   rq_order_code_from_catalogue_part_04  (regler 21–42, dokumentkarta, produkterna ø20 och ø25)
--   rq_order_code_from_catalogue_part_05  (produkterna ø25 (specar), ø32 och ø50)
-- Fingeravtryck efter körning, identiska med modellen (scripts/fingerprint-rules.ts rq):
--   regler  42   md5 1f5a9c244e84d4eb5fd14a068b2ddb80   villkor f94984eaa568161a5c1b56bd17cdf1f6
--   värden  54   md5 949b494cc03e5769cf17c756cd1b0dc8
--   schema       md5 6cad12e83fcfc5ca4d828f3d5191e9f6
-- Verifierat live: /sv/configurator/rq bygger RQB32-50 och RDQB32-50-M9BW (nyckelns exempel sida 1039),
-- RDQA32-300C-M9BW (långslagstypen, sida 1053-2) och RDQF63TF-100M-A93MS-XC35; stoppar RQA20-30
-- (not 2), 300 mm utan C, C under 101 mm och TN på ø20. Produktsidan SMC-RDQB32 länkar till
-- /sv/configurator/rq och visar Rc 1/8, 100 mm standardtyp och -10…+60 °C.
--
-- RQ: beställnyckeln enligt SMC Compact Cylinder with Air Cushion RQ Series (sida 1039 och 1053-2).
-- GENERERAD ur src/lib/catalog/rq.ts -- redigera inte för hand.
--
-- Ersätter familjen rdqb (mallen 'RDQB-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
-- med påhittade värden) med familjen rq. RDQB är bara en kombination i RQ-nyckeln
-- (magnet D + genomgående hål B): SMC:s kod är
-- R{magnet}Q{fäste}{ø}{gänga}-{slag}{buffert}{stångände}-{givare}{kabel}{antal}-{special},
-- t.ex. RQB32-50 och RDQB32-50-M9BW (nyckelns exempel sida 1039) och RQA32-300C
-- (långslagstypen, sida 1053-2). Fästena, gängorna, långslagstypen, givarna och
-- specialutförandena fanns inte alls.
--
-- Produkterna SMC-RDQB20/25/32/50 flyttas till family = 'RQ' och får rätt slag,
-- port och temperatur.

begin;


create schema if not exists backup;
create table if not exists backup.rdqb_before_20260916 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'rdqb'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'rdqb'
  union all
  select 'family', f.id::text, f.slug, coalesce(f.order_code_template, '')
  from configurator_families f where f.slug = 'rdqb'
  union all
  select 'product', p.id::text, p.sku, p.name || ' | ' || coalesce(p.description, '')
  from products p where p.family = 'RDQB'
  union all
  select 'spec', s.id::text, p.sku || '|' || s.key, s.value
  from product_specs s join products p on p.id = s.product_id where p.family = 'RDQB';

delete from configurator_families where slug = 'rdqb';

insert into configurator_families (slug, name, title, description, category_slug)
values ('rq', 'RQ', 'RQ', '', 'cylinder')
on conflict (slug) do update set name = excluded.name;


create schema if not exists backup;
create table if not exists backup.rq_before_20260916 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'rq'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'rq'
  union all
  select 'family', f.id::text, f.slug, coalesce(f.order_code_template, '')
  from configurator_families f where f.slug = 'rq';

insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-RQ-V1', '{"version":"1.0","steps":[{"id":"magnet","step":1,"title_sv":"Magnet för givare (RQ utan, RDQ med)","title_en":"Auto switch magnet (RQ without, RDQ with)","required":false,"type":"single_select","options":[{"v":"D","label":"Inbyggd magnet för givare (RDQ)"}]},{"id":"mounting","step":2,"title_sv":"Fäste","title_en":"Mounting","required":true,"type":"single_select","options":[{"v":"B","label":"Genomgående hål (standardtyp)"},{"v":"A","label":"Båda ändar gängade (standardtyp ø32–100); genomgående hål i långslagstypen"},{"v":"L","label":"Fotfäste (medföljer omonterat)"},{"v":"LC","label":"Kompakt fotfäste (medföljer omonterat)"},{"v":"F","label":"Fläns vid kolvstången (medföljer omonterad)"},{"v":"G","label":"Fläns vid gaveln (medföljer omonterad)"},{"v":"D","label":"Dubbelt gaffelfäste (medföljer omonterat)"}]},{"id":"bore","step":3,"title_sv":"Borrning","title_en":"Bore size","required":true,"type":"single_select","options":[{"v":"20","label":"ø20 mm (M5 x 0,8)"},{"v":"25","label":"ø25 mm (M5 x 0,8)"},{"v":"32","label":"ø32 mm (Rc 1/8)"},{"v":"40","label":"ø40 mm (Rc 1/8)"},{"v":"50","label":"ø50 mm (Rc 1/4)"},{"v":"63","label":"ø63 mm (Rc 1/4)"},{"v":"80","label":"ø80 mm (Rc 3/8)"},{"v":"100","label":"ø100 mm (Rc 3/8)"}]},{"id":"thread","step":4,"title_sv":"Portgänga (standard är M5 för ø20/25, Rc för ø32–100)","title_en":"Port thread (M5 for ø20/25 and Rc for ø32–100 are standard)","required":false,"type":"single_select","options":[{"v":"TN","label":"Portgänga NPT (ø32–100; standard är Rc)"},{"v":"TF","label":"Portgänga G (ø32–100; standard är Rc)"}]},{"id":"stroke_mm","step":5,"title_sv":"Slag (mm)","title_en":"Stroke (mm)","required":true,"type":"numeric","min":15,"max":300,"unit":"mm"},{"id":"bumper","step":6,"title_sv":"Långslagstyp med gummibuffert","title_en":"Long stroke type with rubber bumper","required":false,"type":"single_select","options":[{"v":"C","label":"Långslagstyp med gummibuffert (slag över standardtypens område)"}]},{"id":"rod_end","step":7,"title_sv":"Kolvstångsände (standard är hongänga)","title_en":"Rod end (female thread is standard)","required":false,"type":"single_select","options":[{"v":"M","label":"Hangängad kolvstångsände (standard är hongänga)"}]},{"id":"switch","step":8,"title_sv":"Givare (kräver magnet)","title_en":"Auto switch (needs the magnet)","required":false,"type":"single_select","options":[{"v":"M9N","label":"D-M9N, 3-tråd NPN"},{"v":"M9NV","label":"D-M9NV, 3-tråd NPN, vinkelrät anslutning"},{"v":"M9P","label":"D-M9P, 3-tråd PNP"},{"v":"M9PV","label":"D-M9PV, 3-tråd PNP, vinkelrät anslutning"},{"v":"M9B","label":"D-M9B, 2-tråd"},{"v":"M9BV","label":"D-M9BV, 2-tråd, vinkelrät anslutning"},{"v":"M9NW","label":"D-M9NW, 3-tråd NPN, tvåfärgsindikering"},{"v":"M9NWV","label":"D-M9NWV, 3-tråd NPN, tvåfärgsindikering, vinkelrät anslutning"},{"v":"M9PW","label":"D-M9PW, 3-tråd PNP, tvåfärgsindikering"},{"v":"M9PWV","label":"D-M9PWV, 3-tråd PNP, tvåfärgsindikering, vinkelrät anslutning"},{"v":"M9BW","label":"D-M9BW, 2-tråd, tvåfärgsindikering"},{"v":"M9BWV","label":"D-M9BWV, 2-tråd, tvåfärgsindikering, vinkelrät anslutning"},{"v":"M9NA","label":"D-M9NA, 3-tråd NPN, vattentät, tvåfärgsindikering"},{"v":"M9NAV","label":"D-M9NAV, 3-tråd NPN, vattentät, tvåfärgsindikering, vinkelrät anslutning"},{"v":"M9PA","label":"D-M9PA, 3-tråd PNP, vattentät, tvåfärgsindikering"},{"v":"M9PAV","label":"D-M9PAV, 3-tråd PNP, vattentät, tvåfärgsindikering, vinkelrät anslutning"},{"v":"M9BA","label":"D-M9BA, 2-tråd, vattentät, tvåfärgsindikering"},{"v":"M9BAV","label":"D-M9BAV, 2-tråd, vattentät, tvåfärgsindikering, vinkelrät anslutning"},{"v":"P3DWA","label":"D-P3DWA, 2-tråd opolär, magnetfältsokänslig (ø25–100)"},{"v":"A96","label":"D-A96, reed 3-tråd"},{"v":"A96V","label":"D-A96V, reed 3-tråd, vinkelrät anslutning"},{"v":"A93","label":"D-A93, reed 2-tråd"},{"v":"A93V","label":"D-A93V, reed 2-tråd, vinkelrät anslutning"},{"v":"A90","label":"D-A90, reed utan indikering"},{"v":"A90V","label":"D-A90V, reed utan indikering, vinkelrät anslutning"}]},{"id":"lead","step":9,"title_sv":"Givarens kabellängd (standard är 0,5 m)","title_en":"Auto switch lead wire length (0.5 m is standard)","required":false,"type":"single_select","options":[{"v":"M","label":"1 m kabel"},{"v":"L","label":"3 m kabel"},{"v":"Z","label":"5 m kabel"}]},{"id":"count","step":10,"title_sv":"Antal givare (standard är två)","title_en":"Number of auto switches (two is standard)","required":false,"type":"single_select","options":[{"v":"S","label":"En givare (standard är två)"},{"v":"3","label":"Tre givare (n st)"},{"v":"4","label":"Fyra givare (n st)"}]},{"id":"mto","step":11,"title_sv":"Specialutförande (standardtypen)","title_en":"Made to order (standard type)","required":false,"type":"single_select","options":[{"v":"XA","label":"-XA□ Ändrad kolvstångsände"},{"v":"XC4","label":"-XC4 Kraftig avstrykare"},{"v":"XC35","label":"-XC35 Spiralavstrykare (ø32–100)"}]}]}'::jsonb,
        'SMC RQ kompaktcylinder med luftdämpning', 'SMC RQ compact cylinder with air cushion', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  title = 'Kompaktcylinder med luftdämpning RQ/RDQ ø20–100, standardtyp och långslagstyp',
  description = 'SMC RQ compact cylinder with air cushion (no cushion ring, needle-adjustable): ø20–100, through-hole or both-ends-tapped body, foot, compact foot, flange and double clevis brackets, NPT/G port threads for ø32–100, standard type 15–100 mm and long stroke type with rubber bumper up to 300 mm, intermediate strokes in 1 mm steps, built-in magnet (RDQ) with D-M9/A9/P3DWA auto switches, -XA/-XC4/-XC35 made to order.',
  stroke_min_mm = 15,
  stroke_max_mm = 300,
  order_code_template = 'R{magnet}Q{mounting}{bore}{thread}-{stroke_mm}{bumper}{rod_end}-{switch}{lead}{count}-{mto}',
  rules_schema_id = 'SCHEMA-RQ-V1'
where slug = 'rq';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'rq';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'rq';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"magnet","label":"Magnet för givare (RQ utan, RDQ med)","param_type":"select","sort_order":1,"required":false,"min_value":null,"max_value":null},{"param_key":"mounting","label":"Fäste","param_type":"select","sort_order":2,"required":true,"min_value":null,"max_value":null},{"param_key":"bore","label":"Borrning","param_type":"select","sort_order":3,"required":true,"min_value":null,"max_value":null},{"param_key":"thread","label":"Portgänga (standard är M5 för ø20/25, Rc för ø32–100)","param_type":"select","sort_order":4,"required":false,"min_value":null,"max_value":null},{"param_key":"stroke_mm","label":"Slag (mm)","param_type":"number","sort_order":5,"required":true,"min_value":15,"max_value":300},{"param_key":"bumper","label":"Långslagstyp med gummibuffert","param_type":"select","sort_order":6,"required":false,"min_value":null,"max_value":null},{"param_key":"rod_end","label":"Kolvstångsände (standard är hongänga)","param_type":"select","sort_order":7,"required":false,"min_value":null,"max_value":null},{"param_key":"switch","label":"Givare (kräver magnet)","param_type":"select","sort_order":8,"required":false,"min_value":null,"max_value":null},{"param_key":"lead","label":"Givarens kabellängd (standard är 0,5 m)","param_type":"select","sort_order":9,"required":false,"min_value":null,"max_value":null},{"param_key":"count","label":"Antal givare (standard är två)","param_type":"select","sort_order":10,"required":false,"min_value":null,"max_value":null},{"param_key":"mto","label":"Specialutförande (standardtypen)","param_type":"select","sort_order":11,"required":false,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'rq';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"magnet","code":"D","label":"Inbyggd magnet för givare (RDQ)","sort_order":0},{"param_key":"mounting","code":"B","label":"Genomgående hål (standardtyp)","sort_order":0},{"param_key":"mounting","code":"A","label":"Båda ändar gängade (standardtyp ø32–100); genomgående hål i långslagstypen","sort_order":1},{"param_key":"mounting","code":"L","label":"Fotfäste (medföljer omonterat)","sort_order":2},{"param_key":"mounting","code":"LC","label":"Kompakt fotfäste (medföljer omonterat)","sort_order":3},{"param_key":"mounting","code":"F","label":"Fläns vid kolvstången (medföljer omonterad)","sort_order":4},{"param_key":"mounting","code":"G","label":"Fläns vid gaveln (medföljer omonterad)","sort_order":5},{"param_key":"mounting","code":"D","label":"Dubbelt gaffelfäste (medföljer omonterat)","sort_order":6},{"param_key":"bore","code":"20","label":"ø20 mm (M5 x 0,8)","sort_order":0},{"param_key":"bore","code":"25","label":"ø25 mm (M5 x 0,8)","sort_order":1},{"param_key":"bore","code":"32","label":"ø32 mm (Rc 1/8)","sort_order":2},{"param_key":"bore","code":"40","label":"ø40 mm (Rc 1/8)","sort_order":3},{"param_key":"bore","code":"50","label":"ø50 mm (Rc 1/4)","sort_order":4},{"param_key":"bore","code":"63","label":"ø63 mm (Rc 1/4)","sort_order":5},{"param_key":"bore","code":"80","label":"ø80 mm (Rc 3/8)","sort_order":6},{"param_key":"bore","code":"100","label":"ø100 mm (Rc 3/8)","sort_order":7},{"param_key":"thread","code":"TN","label":"Portgänga NPT (ø32–100; standard är Rc)","sort_order":0},{"param_key":"thread","code":"TF","label":"Portgänga G (ø32–100; standard är Rc)","sort_order":1},{"param_key":"bumper","code":"C","label":"Långslagstyp med gummibuffert (slag över standardtypens område)","sort_order":0},{"param_key":"rod_end","code":"M","label":"Hangängad kolvstångsände (standard är hongänga)","sort_order":0},{"param_key":"switch","code":"M9N","label":"D-M9N, 3-tråd NPN","sort_order":0},{"param_key":"switch","code":"M9NV","label":"D-M9NV, 3-tråd NPN, vinkelrät anslutning","sort_order":1},{"param_key":"switch","code":"M9P","label":"D-M9P, 3-tråd PNP","sort_order":2},{"param_key":"switch","code":"M9PV","label":"D-M9PV, 3-tråd PNP, vinkelrät anslutning","sort_order":3},{"param_key":"switch","code":"M9B","label":"D-M9B, 2-tråd","sort_order":4},{"param_key":"switch","code":"M9BV","label":"D-M9BV, 2-tråd, vinkelrät anslutning","sort_order":5},{"param_key":"switch","code":"M9NW","label":"D-M9NW, 3-tråd NPN, tvåfärgsindikering","sort_order":6},{"param_key":"switch","code":"M9NWV","label":"D-M9NWV, 3-tråd NPN, tvåfärgsindikering, vinkelrät anslutning","sort_order":7},{"param_key":"switch","code":"M9PW","label":"D-M9PW, 3-tråd PNP, tvåfärgsindikering","sort_order":8},{"param_key":"switch","code":"M9PWV","label":"D-M9PWV, 3-tråd PNP, tvåfärgsindikering, vinkelrät anslutning","sort_order":9},{"param_key":"switch","code":"M9BW","label":"D-M9BW, 2-tråd, tvåfärgsindikering","sort_order":10},{"param_key":"switch","code":"M9BWV","label":"D-M9BWV, 2-tråd, tvåfärgsindikering, vinkelrät anslutning","sort_order":11},{"param_key":"switch","code":"M9NA","label":"D-M9NA, 3-tråd NPN, vattentät, tvåfärgsindikering","sort_order":12},{"param_key":"switch","code":"M9NAV","label":"D-M9NAV, 3-tråd NPN, vattentät, tvåfärgsindikering, vinkelrät anslutning","sort_order":13},{"param_key":"switch","code":"M9PA","label":"D-M9PA, 3-tråd PNP, vattentät, tvåfärgsindikering","sort_order":14},{"param_key":"switch","code":"M9PAV","label":"D-M9PAV, 3-tråd PNP, vattentät, tvåfärgsindikering, vinkelrät anslutning","sort_order":15},{"param_key":"switch","code":"M9BA","label":"D-M9BA, 2-tråd, vattentät, tvåfärgsindikering","sort_order":16},{"param_key":"switch","code":"M9BAV","label":"D-M9BAV, 2-tråd, vattentät, tvåfärgsindikering, vinkelrät anslutning","sort_order":17},{"param_key":"switch","code":"P3DWA","label":"D-P3DWA, 2-tråd opolär, magnetfältsokänslig (ø25–100)","sort_order":18},{"param_key":"switch","code":"A96","label":"D-A96, reed 3-tråd","sort_order":19},{"param_key":"switch","code":"A96V","label":"D-A96V, reed 3-tråd, vinkelrät anslutning","sort_order":20},{"param_key":"switch","code":"A93","label":"D-A93, reed 2-tråd","sort_order":21},{"param_key":"switch","code":"A93V","label":"D-A93V, reed 2-tråd, vinkelrät anslutning","sort_order":22},{"param_key":"switch","code":"A90","label":"D-A90, reed utan indikering","sort_order":23},{"param_key":"switch","code":"A90V","label":"D-A90V, reed utan indikering, vinkelrät anslutning","sort_order":24},{"param_key":"lead","code":"M","label":"1 m kabel","sort_order":0},{"param_key":"lead","code":"L","label":"3 m kabel","sort_order":1},{"param_key":"lead","code":"Z","label":"5 m kabel","sort_order":2},{"param_key":"count","code":"S","label":"En givare (standard är två)","sort_order":0},{"param_key":"count","code":"3","label":"Tre givare (n st)","sort_order":1},{"param_key":"count","code":"4","label":"Fyra givare (n st)","sort_order":2},{"param_key":"mto","code":"XA","label":"-XA□ Ändrad kolvstångsände","sort_order":0},{"param_key":"mto","code":"XC4","label":"-XC4 Kraftig avstrykare","sort_order":1},{"param_key":"mto","code":"XC35","label":"-XC35 Spiralavstrykare (ø32–100)","sort_order":2}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'rq';

delete from config_rules where schema_id = 'SCHEMA-RQ-V1';


insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-RQ-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["20","25"]]},{">":[{"var":"stroke_mm"},0]},{"or":[{"<":[{"var":"stroke_mm"},15]},{">":[{"var":"stroke_mm"},200]}]}]},"message_sv":"ø20 och 25 tillverkas med 15–50 mm slag (standardtyp) och 51–200 mm (långslagstyp med gummibuffert C) (sida 1040 och 1053-3).","message_en":"ø20 and 25 are manufactured with 15–50 mm stroke (standard type) and 51–200 mm (long stroke type with rubber bumper C) (pages 1040 and 1053-3).","goto_step":"rq-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["20","25"]]},{"==":[{"var":"bumper"},"C"]},{">":[{"var":"stroke_mm"},0]},{"<=":[{"var":"stroke_mm"},50]}]},"message_sv":"Gummibufferten C hör till långslagstypen — för ø20 och 25 börjar den vid 51 mm; upp till 50 mm är cylindern standardtyp utan C (sida 1039 och 1053-2).","message_en":"The rubber bumper C belongs to the long stroke type — for ø20 and 25 it starts at 51 mm; up to 50 mm the cylinder is the standard type without C (pages 1039 and 1053-2).","goto_step":"rq-bumper"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["20","25"]]},{"!=":[{"var":"bumper"},"C"]},{">":[{"var":"stroke_mm"},50]},{"<=":[{"var":"stroke_mm"},200]}]},"message_sv":"Över 50 mm slag är ø20 och 25 långslagstypen, som beställs med gummibuffert C (sida 1053-2).","message_en":"Above 50 mm stroke ø20 and 25 are the long stroke type, ordered with the rubber bumper C (page 1053-2).","goto_step":"rq-bumper"},{"severity":"warn","if_json":{"and":[{"in":[{"var":"bore"},["20","25"]]},{">=":[{"var":"stroke_mm"},15]},{"<=":[{"var":"stroke_mm"},200]},{"not":{"in":[{"var":"stroke_mm"},[15,20,25,30,40,50,75,100,125,150,175,200]]}}]},"message_sv":"Standardslagen för ø20 och 25 är 15, 20, 25, 30, 40 och 50 mm (standardtyp) och 75, 100, 125, 150, 175 och 200 mm (långslagstyp); andra slag tillverkas i 1 mm-steg med egen tub för det slaget (sida 1040 och 1053-3).","message_en":"The standard strokes for ø20 and 25 are 15, 20, 25, 30, 40 and 50 mm (standard type) and 75, 100, 125, 150, 175 and 200 mm (long stroke type); other strokes are made in 1 mm steps with an exclusive body for that stroke (pages 1040 and 1053-3).","goto_step":"rq-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["32","40"]]},{">":[{"var":"stroke_mm"},0]},{"or":[{"<":[{"var":"stroke_mm"},20]},{">":[{"var":"stroke_mm"},300]}]}]},"message_sv":"ø32 och 40 tillverkas med 20–100 mm slag (standardtyp) och 101–300 mm (långslagstyp med gummibuffert C) (sida 1040 och 1053-3).","message_en":"ø32 and 40 are manufactured with 20–100 mm stroke (standard type) and 101–300 mm (long stroke type with rubber bumper C) (pages 1040 and 1053-3).","goto_step":"rq-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["32","40"]]},{"==":[{"var":"bumper"},"C"]},{">":[{"var":"stroke_mm"},0]},{"<=":[{"var":"stroke_mm"},100]}]},"message_sv":"Gummibufferten C hör till långslagstypen — för ø32 och 40 börjar den vid 101 mm; upp till 100 mm är cylindern standardtyp utan C (sida 1039 och 1053-2).","message_en":"The rubber bumper C belongs to the long stroke type — for ø32 and 40 it starts at 101 mm; up to 100 mm the cylinder is the standard type without C (pages 1039 and 1053-2).","goto_step":"rq-bumper"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["32","40"]]},{"!=":[{"var":"bumper"},"C"]},{">":[{"var":"stroke_mm"},100]},{"<=":[{"var":"stroke_mm"},300]}]},"message_sv":"Över 100 mm slag är ø32 och 40 långslagstypen, som beställs med gummibuffert C (sida 1053-2).","message_en":"Above 100 mm stroke ø32 and 40 are the long stroke type, ordered with the rubber bumper C (page 1053-2).","goto_step":"rq-bumper"},{"severity":"warn","if_json":{"and":[{"in":[{"var":"bore"},["32","40"]]},{">=":[{"var":"stroke_mm"},20]},{"<=":[{"var":"stroke_mm"},300]},{"not":{"in":[{"var":"stroke_mm"},[20,25,30,40,50,75,100,125,150,175,200,250,300]]}}]},"message_sv":"Standardslagen för ø32 och 40 är 20, 25, 30, 40, 50, 75 och 100 mm (standardtyp) och 125, 150, 175, 200, 250 och 300 mm (långslagstyp); andra slag tillverkas i 1 mm-steg med egen tub för det slaget (sida 1040 och 1053-3).","message_en":"The standard strokes for ø32 and 40 are 20, 25, 30, 40, 50, 75 and 100 mm (standard type) and 125, 150, 175, 200, 250 and 300 mm (long stroke type); other strokes are made in 1 mm steps with an exclusive body for that stroke (pages 1040 and 1053-3).","goto_step":"rq-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["50","63"]]},{">":[{"var":"stroke_mm"},0]},{"or":[{"<":[{"var":"stroke_mm"},30]},{">":[{"var":"stroke_mm"},300]}]}]},"message_sv":"ø50 och 63 tillverkas med 30–100 mm slag (standardtyp) och 101–300 mm (långslagstyp med gummibuffert C) (sida 1040 och 1053-3).","message_en":"ø50 and 63 are manufactured with 30–100 mm stroke (standard type) and 101–300 mm (long stroke type with rubber bumper C) (pages 1040 and 1053-3).","goto_step":"rq-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["50","63"]]},{"==":[{"var":"bumper"},"C"]},{">":[{"var":"stroke_mm"},0]},{"<=":[{"var":"stroke_mm"},100]}]},"message_sv":"Gummibufferten C hör till långslagstypen — för ø50 och 63 börjar den vid 101 mm; upp till 100 mm är cylindern standardtyp utan C (sida 1039 och 1053-2).","message_en":"The rubber bumper C belongs to the long stroke type — for ø50 and 63 it starts at 101 mm; up to 100 mm the cylinder is the standard type without C (pages 1039 and 1053-2).","goto_step":"rq-bumper"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["50","63"]]},{"!=":[{"var":"bumper"},"C"]},{">":[{"var":"stroke_mm"},100]},{"<=":[{"var":"stroke_mm"},300]}]},"message_sv":"Över 100 mm slag är ø50 och 63 långslagstypen, som beställs med gummibuffert C (sida 1053-2).","message_en":"Above 100 mm stroke ø50 and 63 are the long stroke type, ordered with the rubber bumper C (page 1053-2).","goto_step":"rq-bumper"},{"severity":"warn","if_json":{"and":[{"in":[{"var":"bore"},["50","63"]]},{">=":[{"var":"stroke_mm"},30]},{"<=":[{"var":"stroke_mm"},300]},{"not":{"in":[{"var":"stroke_mm"},[30,40,50,75,100,125,150,175,200,250,300]]}}]},"message_sv":"Standardslagen för ø50 och 63 är 30, 40, 50, 75 och 100 mm (standardtyp) och 125, 150, 175, 200, 250 och 300 mm (långslagstyp); andra slag tillverkas i 1 mm-steg med egen tub för det slaget (sida 1040 och 1053-3).","message_en":"The standard strokes for ø50 and 63 are 30, 40, 50, 75 and 100 mm (standard type) and 125, 150, 175, 200, 250 and 300 mm (long stroke type); other strokes are made in 1 mm steps with an exclusive body for that stroke (pages 1040 and 1053-3).","goto_step":"rq-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["80","100"]]},{">":[{"var":"stroke_mm"},0]},{"or":[{"<":[{"var":"stroke_mm"},40]},{">":[{"var":"stroke_mm"},300]}]}]},"message_sv":"ø80 och 100 tillverkas med 40–100 mm slag (standardtyp) och 101–300 mm (långslagstyp med gummibuffert C) (sida 1040 och 1053-3).","message_en":"ø80 and 100 are manufactured with 40–100 mm stroke (standard type) and 101–300 mm (long stroke type with rubber bumper C) (pages 1040 and 1053-3).","goto_step":"rq-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["80","100"]]},{"==":[{"var":"bumper"},"C"]},{">":[{"var":"stroke_mm"},0]},{"<=":[{"var":"stroke_mm"},100]}]},"message_sv":"Gummibufferten C hör till långslagstypen — för ø80 och 100 börjar den vid 101 mm; upp till 100 mm är cylindern standardtyp utan C (sida 1039 och 1053-2).","message_en":"The rubber bumper C belongs to the long stroke type — for ø80 and 100 it starts at 101 mm; up to 100 mm the cylinder is the standard type without C (pages 1039 and 1053-2).","goto_step":"rq-bumper"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["80","100"]]},{"!=":[{"var":"bumper"},"C"]},{">":[{"var":"stroke_mm"},100]},{"<=":[{"var":"stroke_mm"},300]}]},"message_sv":"Över 100 mm slag är ø80 och 100 långslagstypen, som beställs med gummibuffert C (sida 1053-2).","message_en":"Above 100 mm stroke ø80 and 100 are the long stroke type, ordered with the rubber bumper C (page 1053-2).","goto_step":"rq-bumper"},{"severity":"warn","if_json":{"and":[{"in":[{"var":"bore"},["80","100"]]},{">=":[{"var":"stroke_mm"},40]},{"<=":[{"var":"stroke_mm"},300]},{"not":{"in":[{"var":"stroke_mm"},[40,50,75,100,125,150,175,200,250,300]]}}]},"message_sv":"Standardslagen för ø80 och 100 är 40, 50, 75 och 100 mm (standardtyp) och 125, 150, 175, 200, 250 och 300 mm (långslagstyp); andra slag tillverkas i 1 mm-steg med egen tub för det slaget (sida 1040 och 1053-3).","message_en":"The standard strokes for ø80 and 100 are 40, 50, 75 and 100 mm (standard type) and 125, 150, 175, 200, 250 and 300 mm (long stroke type); other strokes are made in 1 mm steps with an exclusive body for that stroke (pages 1040 and 1053-3).","goto_step":"rq-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"mounting"},["B"]]},{"==":[{"var":"bumper"},"C"]}]},"message_sv":"Långslagstypen (C) beställs med genomgående hål som A, inte B (sida 1053-2).","message_en":"The long stroke type (C) is ordered with the through-hole as A, not B (page 1053-2).","goto_step":"rq-mounting"},{"severity":"error","if_json":{"and":[{"==":[{"var":"mounting"},"A"]},{"!=":[{"var":"bumper"},"C"]},{"in":[{"var":"bore"},["20","25"]]}]},"message_sv":"ø20 och 25 har samma kropp för genomgående hål (B) och gängade ändar — beställ B; RQA20-30 finns inte (sida 1039, not 2).","message_en":"ø20 and 25 share one body for the through-hole (B) and the tapped ends — order B; RQA20-30 does not exist (page 1039, note 2).","goto_step":"rq-mounting"},{"severity":"error","if_json":{"and":[{"in":[{"var":"thread"},["TN","TF"]]},{"in":[{"var":"bore"},["20","25"]]}]},"message_sv":"ø20 och 25 har M-gänga; NPT (TN) och G (TF) finns för ø32–100 (sida 1039).","message_en":"ø20 and 25 have the M thread; NPT (TN) and G (TF) exist for ø32–100 (page 1039).","goto_step":"rq-thread"},{"severity":"error","if_json":{"and":[{"!=":[{"var":"switch"},""]},{"!=":[{"var":"magnet"},"D"]}]},"message_sv":"En givare kräver magnetcylindern RDQ — välj inbyggd magnet (sida 1039).","message_en":"An auto switch needs the RDQ magnet cylinder — choose the built-in magnet (page 1039).","goto_step":"rq-magnet"}]'::jsonb) r;

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-RQ-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{"==":[{"var":"switch"},""]},{"or":[{"!=":[{"var":"lead"},""]},{"!=":[{"var":"count"},""]}]}]},"message_sv":"Kabellängd och antal hör till givaren — välj en givare först.","message_en":"Lead wire length and quantity belong to the auto switch — choose a switch first.","goto_step":"rq-switch"},{"severity":"error","if_json":{"and":[{"in":[{"var":"switch"},["P3DWA"]]},{"==":[{"var":"bore"},"20"]}]},"message_sv":"D-P3DWA passar ø25–100, inte ø20 (sida 1039, ∗∗).","message_en":"D-P3DWA fits ø25–100, not ø20 (page 1039, ∗∗).","goto_step":"rq-switch"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"lead"},""]},{"in":[{"var":"switch"},["M9NA","M9NAV","M9PA","M9PAV","M9BA","M9BAV"]]}]},"message_sv":"Kabellängd 0,5 m (ingen bokstav) tillverkas på beställning för D-M9NA/M9PA/M9BA (även V-typerna) (sida 1039, ○).","message_en":"Lead wire length 0.5 m (no letter) is produced upon receipt of order for D-M9NA/M9PA/M9BA (V types too) (page 1039, ○).","goto_step":"rq-lead"},{"severity":"error","if_json":{"and":[{"==":[{"var":"lead"},"M"]},{"in":[{"var":"switch"},["P3DWA","A96","A96V","A93V","A90","A90V"]]}]},"message_sv":"Kabellängd 1 m (M) finns inte för D-P3DWA/A96/A90/A93V (sida 1039, —; 1 m bara för D-A93, ∗2).","message_en":"Lead wire length 1 m (M) does not exist for D-P3DWA/A96/A90/A93V (page 1039, —; 1 m only for D-A93, ∗2).","goto_step":"rq-lead"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"lead"},"M"]},{"in":[{"var":"switch"},["M9NA","M9NAV","M9PA","M9PAV","M9BA","M9BAV"]]}]},"message_sv":"Kabellängd 1 m (M) tillverkas på beställning för D-M9NA/M9PA/M9BA (även V-typerna) (sida 1039, ○).","message_en":"Lead wire length 1 m (M) is produced upon receipt of order for D-M9NA/M9PA/M9BA (V types too) (page 1039, ○).","goto_step":"rq-lead"},{"severity":"error","if_json":{"and":[{"==":[{"var":"lead"},"Z"]},{"in":[{"var":"switch"},["A96","A96V","A90","A90V"]]}]},"message_sv":"Kabellängd 5 m (Z) finns inte för D-A96/A90 (sida 1039, —).","message_en":"Lead wire length 5 m (Z) does not exist for D-A96/A90 (page 1039, —).","goto_step":"rq-lead"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"lead"},"Z"]},{"in":[{"var":"switch"},["M9N","M9NV","M9P","M9PV","M9B","M9BV","M9NW","M9NWV","M9PW","M9PWV","M9BW","M9BWV","M9NA","M9NAV","M9PA","M9PAV","M9BA","M9BAV"]]}]},"message_sv":"Kabellängd 5 m (Z) tillverkas på beställning för D-M9N/M9P/M9B/M9NW/M9PW/M9BW/M9NA/M9PA/M9BA (även V-typerna) (sida 1039, ○).","message_en":"Lead wire length 5 m (Z) is produced upon receipt of order for D-M9N/M9P/M9B/M9NW/M9PW/M9BW/M9NA/M9PA/M9BA (V types too) (page 1039, ○).","goto_step":"rq-lead"},{"severity":"warn","if_json":{"in":[{"var":"switch"},["M9NA","M9NAV","M9PA","M9PAV","M9BA","M9BAV"]]},"message_sv":"De vattentäta givarna D-M9NA/M9PA/M9BA går att montera, men SMC garanterar inte vattentätheten på RQ (sida 1039, ∗1).","message_en":"The water-resistant switches D-M9NA/M9PA/M9BA can be mounted, but SMC cannot guarantee water resistance on the RQ (page 1039, ∗1).","goto_step":"rq-switch"},{"severity":"info","if_json":{"and":[{"!=":[{"var":"switch"},""]},{"in":[{"var":"mounting"},["L","LC","F","G","D"]]}]},"message_sv":"Med fot- eller flänsfäste kan givarna ibland inte eftermonteras — beställ dem med cylindern (sida 1039).","message_en":"With foot or flange brackets the auto switches sometimes cannot be retrofitted — order them with the cylinder (page 1039).","goto_step":"rq-switch"},{"severity":"error","if_json":{"and":[{"!=":[{"var":"mto"},""]},{"==":[{"var":"bumper"},"C"]}]},"message_sv":"Specialutförandena -XA/-XC4/-XC35 gäller standardtypen; långslagsnyckeln har ingen specialposition (sida 1039 och 1053-2).","message_en":"The made-to-order -XA/-XC4/-XC35 apply to the standard type; the long stroke key has no made-to-order position (pages 1039 and 1053-2).","goto_step":"rq-mto"},{"severity":"error","if_json":{"and":[{"in":[{"var":"mto"},["XC35"]]},{"in":[{"var":"bore"},["20","25"]]}]},"message_sv":"-XC35 finns för ø32–100, inte ø20 och 25 (sida 1040).","message_en":"-XC35 exists for ø32–100, not ø20 and 25 (page 1040).","goto_step":"rq-mto"},{"severity":"info","if_json":{"==":[{"var":"bore"},"20"]},"message_sv":"ø20: teoretisk kraft 157 N ut/118 N in vid 0,5 MPa, effektiv dämpningslängd 5,8 mm, port M5 x 0,8; standardslag 15, 20, 25, 30, 40 och 50 mm, långslag 75, 100, 125, 150, 175 och 200 mm; fästen CQS-L/LC/F/D020 (sida 1040, 1053-3 och måttabellen).","message_en":"ø20: theoretical output 157 N out/118 N in at 0.5 MPa, effective cushion length 5.8 mm, port M5 x 0.8; standard strokes 15, 20, 25, 30, 40 and 50 mm, long strokes 75, 100, 125, 150, 175 and 200 mm; brackets CQS-L/LC/F/D020 (pages 1040, 1053-3 and the dimension table).","goto_step":"rq-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"25"]},"message_sv":"ø25: teoretisk kraft 245 N ut/189 N in vid 0,5 MPa, effektiv dämpningslängd 6,1 mm, port M5 x 0,8; standardslag 15, 20, 25, 30, 40 och 50 mm, långslag 75, 100, 125, 150, 175 och 200 mm; fästen CQS-L/LC/F/D025 (sida 1040, 1053-3 och måttabellen).","message_en":"ø25: theoretical output 245 N out/189 N in at 0.5 MPa, effective cushion length 6.1 mm, port M5 x 0.8; standard strokes 15, 20, 25, 30, 40 and 50 mm, long strokes 75, 100, 125, 150, 175 and 200 mm; brackets CQS-L/LC/F/D025 (pages 1040, 1053-3 and the dimension table).","goto_step":"rq-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"32"]},"message_sv":"ø32: teoretisk kraft 402 N ut/302 N in vid 0,5 MPa, effektiv dämpningslängd 6,6 mm, port Rc 1/8; standardslag 20, 25, 30, 40, 50, 75 och 100 mm, långslag 125, 150, 175, 200, 250 och 300 mm; fästen CQ-L/LC/F/D032 (sida 1040, 1053-3 och måttabellen).","message_en":"ø32: theoretical output 402 N out/302 N in at 0.5 MPa, effective cushion length 6.6 mm, port Rc 1/8; standard strokes 20, 25, 30, 40, 50, 75 and 100 mm, long strokes 125, 150, 175, 200, 250 and 300 mm; brackets CQ-L/LC/F/D032 (pages 1040, 1053-3 and the dimension table).","goto_step":"rq-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"40"]},"message_sv":"ø40: teoretisk kraft 628 N ut/528 N in vid 0,5 MPa, effektiv dämpningslängd 6,6 mm, port Rc 1/8; standardslag 20, 25, 30, 40, 50, 75 och 100 mm, långslag 125, 150, 175, 200, 250 och 300 mm; fästen CQ-L/LC/F/D040 (sida 1040, 1053-3 och måttabellen).","message_en":"ø40: theoretical output 628 N out/528 N in at 0.5 MPa, effective cushion length 6.6 mm, port Rc 1/8; standard strokes 20, 25, 30, 40, 50, 75 and 100 mm, long strokes 125, 150, 175, 200, 250 and 300 mm; brackets CQ-L/LC/F/D040 (pages 1040, 1053-3 and the dimension table).","goto_step":"rq-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"50"]},"message_sv":"ø50: teoretisk kraft 982 N ut/825 N in vid 0,5 MPa, effektiv dämpningslängd 7,1 mm, port Rc 1/4; standardslag 30, 40, 50, 75 och 100 mm, långslag 125, 150, 175, 200, 250 och 300 mm; fästen CQ-L/LC/F/D050 (sida 1040, 1053-3 och måttabellen).","message_en":"ø50: theoretical output 982 N out/825 N in at 0.5 MPa, effective cushion length 7.1 mm, port Rc 1/4; standard strokes 30, 40, 50, 75 and 100 mm, long strokes 125, 150, 175, 200, 250 and 300 mm; brackets CQ-L/LC/F/D050 (pages 1040, 1053-3 and the dimension table).","goto_step":"rq-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"63"]},"message_sv":"ø63: teoretisk kraft 1560 N ut/1400 N in vid 0,5 MPa, effektiv dämpningslängd 7 mm, port Rc 1/4; standardslag 30, 40, 50, 75 och 100 mm, långslag 125, 150, 175, 200, 250 och 300 mm; fästen CQ-L/LC/F/D063 (sida 1040, 1053-3 och måttabellen).","message_en":"ø63: theoretical output 1560 N out/1400 N in at 0.5 MPa, effective cushion length 7 mm, port Rc 1/4; standard strokes 30, 40, 50, 75 and 100 mm, long strokes 125, 150, 175, 200, 250 and 300 mm; brackets CQ-L/LC/F/D063 (pages 1040, 1053-3 and the dimension table).","goto_step":"rq-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"80"]},"message_sv":"ø80: teoretisk kraft 2510 N ut/2270 N in vid 0,5 MPa, effektiv dämpningslängd 7,5 mm, port Rc 3/8; standardslag 40, 50, 75 och 100 mm, långslag 125, 150, 175, 200, 250 och 300 mm; fästen CQ-L/LC/F/D080 (sida 1040, 1053-3 och måttabellen).","message_en":"ø80: theoretical output 2510 N out/2270 N in at 0.5 MPa, effective cushion length 7.5 mm, port Rc 3/8; standard strokes 40, 50, 75 and 100 mm, long strokes 125, 150, 175, 200, 250 and 300 mm; brackets CQ-L/LC/F/D080 (pages 1040, 1053-3 and the dimension table).","goto_step":"rq-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"100"]},"message_sv":"ø100: teoretisk kraft 3930 N ut/3570 N in vid 0,5 MPa, effektiv dämpningslängd 8 mm, port Rc 3/8; standardslag 40, 50, 75 och 100 mm, långslag 125, 150, 175, 200, 250 och 300 mm; fästen CQ-L/LC/F/D0100 (sida 1040, 1053-3 och måttabellen).","message_en":"ø100: theoretical output 3930 N out/3570 N in at 0.5 MPa, effective cushion length 8 mm, port Rc 3/8; standard strokes 40, 50, 75 and 100 mm, long strokes 125, 150, 175, 200, 250 and 300 mm; brackets CQ-L/LC/F/D0100 (pages 1040, 1053-3 and the dimension table).","goto_step":"rq-bore"},{"severity":"info","if_json":{"!=":[{"var":"mounting"},""]},"message_sv":"RQ: 0,05–1 MPa (provtryck 1,5 MPa), -10…70 °C (med magnet -10…60), 50–500 mm/s, smörjfri, luftdämpning utan dämpring; fästena medföljer omonterade (sida 1039–1040). Kontrollera tillåten rörelseenergi enligt urvalet på sida 1057.","message_en":"RQ: 0.05–1 MPa (proof pressure 1.5 MPa), -10…70 °C (with magnet -10…60), 50–500 mm/s, non-lube, air cushion without a cushion ring; brackets are shipped unassembled (pages 1039–1040). Check the allowable kinetic energy per the selection on page 1057.","goto_step":"rq-mounting"}]'::jsonb) r;

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-RQ-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"info","if_json":{"in":[{"var":"mounting"},["L","LC"]]},"message_sv":"Fotfästen beställs som två stycken per cylinder; kroppsskruvarna medföljer (sida 1040, not 1–2).","message_en":"Foot brackets are ordered as two pieces per cylinder; the body mounting bolts are included (page 1040, notes 1–2).","goto_step":"rq-mounting"},{"severity":"info","if_json":{"==":[{"var":"rod_end"},"M"]},"message_sv":"Hangängad kolvstångsände M (standard är hongänga) (sida 1039).","message_en":"Male rod end thread M (female thread is standard) (page 1039).","goto_step":"rq-rod_end"}]'::jsonb) r;

insert into knowledge_doc_families (source_file, family_slug, doc_title)
values ('smc-kat-rq.pdf', 'rq', 'SMC — SMC Compact Cylinder with Air Cushion RQ Series')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;


update products set
  family = 'RQ',
  name = 'SMC RQ Compact Cylinder with Air Cushion Ø20 (RDQB)',
  description = 'RQ compact cylinder with air cushion, bore 20 mm, with auto switch magnet and through-hole mounting (RDQB). Standard strokes 15, 20, 25, 30, 40, 50 mm, intermediate strokes in 1 mm steps, long stroke type up to 200 mm (rubber bumper C). Port M5 x 0.8, 0.05–1.0 MPa, −10…60 °C with magnet, 50–500 mm/s. Order code example RDQB20-50 (catalogue page 1039).'
where sku = 'SMC-RDQB20';

update product_specs s set value = x.value
from products p, (values
  ('series', 'RQ (RDQB: med magnet, genomgående hål)'),
  ('stroke_mm', '50 mm (standardtyp, max); långslagstyp med gummibuffert upp till 200 mm'),
  ('temp_range', '-10…+60 (med magnet); -10…+70 utan magnet (RQ)')
) as x(key, value)
where s.product_id = p.id and p.sku = 'SMC-RDQB20' and s.key = x.key;

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.05'),
  ('port_size', 'M5 x 0,8'),
  ('cushioning', 'Luftdämpning, effektiv dämpningslängd 5,8 mm'),
  ('force_out_n_05mpa', '157'),
  ('standard_strokes_mm', '15, 20, 25, 30, 40, 50 (standardtyp); 75, 100, 125, 150, 175, 200 (långslagstyp C)'),
  ('order_code_example', 'RDQB20-50'),
  ('catalogue', 'SMC RQ, How to Order sida 1039, data sida 1040, långslagstyp sida 1053-2')
) as x(key, value)
where p.sku = 'SMC-RDQB20'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update products set
  family = 'RQ',
  name = 'SMC RQ Compact Cylinder with Air Cushion Ø25 (RDQB)',
  description = 'RQ compact cylinder with air cushion, bore 25 mm, with auto switch magnet and through-hole mounting (RDQB). Standard strokes 15, 20, 25, 30, 40, 50 mm, intermediate strokes in 1 mm steps, long stroke type up to 200 mm (rubber bumper C). Port M5 x 0.8, 0.05–1.0 MPa, −10…60 °C with magnet, 50–500 mm/s. Order code example RDQB25-50 (catalogue page 1039).'
where sku = 'SMC-RDQB25';

update product_specs s set value = x.value
from products p, (values
  ('series', 'RQ (RDQB: med magnet, genomgående hål)'),
  ('stroke_mm', '50 mm (standardtyp, max); långslagstyp med gummibuffert upp till 200 mm'),
  ('temp_range', '-10…+60 (med magnet); -10…+70 utan magnet (RQ)')
) as x(key, value)
where s.product_id = p.id and p.sku = 'SMC-RDQB25' and s.key = x.key;

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.05'),
  ('port_size', 'M5 x 0,8'),
  ('cushioning', 'Luftdämpning, effektiv dämpningslängd 6,1 mm'),
  ('force_out_n_05mpa', '245'),
  ('standard_strokes_mm', '15, 20, 25, 30, 40, 50 (standardtyp); 75, 100, 125, 150, 175, 200 (långslagstyp C)'),
  ('order_code_example', 'RDQB25-50'),
  ('catalogue', 'SMC RQ, How to Order sida 1039, data sida 1040, långslagstyp sida 1053-2')
) as x(key, value)
where p.sku = 'SMC-RDQB25'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update products set
  family = 'RQ',
  name = 'SMC RQ Compact Cylinder with Air Cushion Ø32 (RDQB)',
  description = 'RQ compact cylinder with air cushion, bore 32 mm, with auto switch magnet and through-hole mounting (RDQB). Standard strokes 20, 25, 30, 40, 50, 75, 100 mm, intermediate strokes in 1 mm steps, long stroke type up to 300 mm (rubber bumper C). Port Rc 1/8, 0.05–1.0 MPa, −10…60 °C with magnet, 50–500 mm/s. Order code example RDQB32-100 (catalogue page 1039).'
where sku = 'SMC-RDQB32';

update product_specs s set value = x.value
from products p, (values
  ('series', 'RQ (RDQB: med magnet, genomgående hål)'),
  ('stroke_mm', '100 mm (standardtyp, max); långslagstyp med gummibuffert upp till 300 mm'),
  ('temp_range', '-10…+60 (med magnet); -10…+70 utan magnet (RQ)')
) as x(key, value)
where s.product_id = p.id and p.sku = 'SMC-RDQB32' and s.key = x.key;

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.05'),
  ('port_size', 'Rc 1/8'),
  ('cushioning', 'Luftdämpning, effektiv dämpningslängd 6,6 mm'),
  ('force_out_n_05mpa', '402'),
  ('standard_strokes_mm', '20, 25, 30, 40, 50, 75, 100 (standardtyp); 125, 150, 175, 200, 250, 300 (långslagstyp C)'),
  ('order_code_example', 'RDQB32-100'),
  ('catalogue', 'SMC RQ, How to Order sida 1039, data sida 1040, långslagstyp sida 1053-2')
) as x(key, value)
where p.sku = 'SMC-RDQB32'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update products set
  family = 'RQ',
  name = 'SMC RQ Compact Cylinder with Air Cushion Ø50 (RDQB)',
  description = 'RQ compact cylinder with air cushion, bore 50 mm, with auto switch magnet and through-hole mounting (RDQB). Standard strokes 30, 40, 50, 75, 100 mm, intermediate strokes in 1 mm steps, long stroke type up to 300 mm (rubber bumper C). Port Rc 1/4, 0.05–1.0 MPa, −10…60 °C with magnet, 50–500 mm/s. Order code example RDQB50-100 (catalogue page 1039).'
where sku = 'SMC-RDQB50';

update product_specs s set value = x.value
from products p, (values
  ('series', 'RQ (RDQB: med magnet, genomgående hål)'),
  ('stroke_mm', '100 mm (standardtyp, max); långslagstyp med gummibuffert upp till 300 mm'),
  ('temp_range', '-10…+60 (med magnet); -10…+70 utan magnet (RQ)')
) as x(key, value)
where s.product_id = p.id and p.sku = 'SMC-RDQB50' and s.key = x.key;

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.05'),
  ('port_size', 'Rc 1/4'),
  ('cushioning', 'Luftdämpning, effektiv dämpningslängd 7,1 mm'),
  ('force_out_n_05mpa', '982'),
  ('standard_strokes_mm', '30, 40, 50, 75, 100 (standardtyp); 125, 150, 175, 200, 250, 300 (långslagstyp C)'),
  ('order_code_example', 'RDQB50-100'),
  ('catalogue', 'SMC RQ, How to Order sida 1039, data sida 1040, långslagstyp sida 1053-2')
) as x(key, value)
where p.sku = 'SMC-RDQB50'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


commit;


-- TILLÄMPAD I DATABASEN 2026-09-15 i tre delar via Supabase MCP
-- (mxs_order_code_from_catalogue_part_01 … part_03). Innehållet är samma som
-- EN migration, genererad ur scripts/gen-mxs-migration.ts; databasen
-- kontrollerad mot den: 28 regler, md5 5faf98349b83d2de1b6b10c897acce81,
-- villkor 23bb0f7c6528dd440fbc913b9ae95099 (scripts/fingerprint-rules.ts mxs).
--
-- MXS: beställnyckeln enligt SMC Air Slide Table MXS Series.
-- GENERERAD ur src/lib/catalog/mxs.ts -- redigera inte för hand.
--
-- Rättar familjen mxs, som hade mallen 'MXS-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
-- med påhittade positioner. SMC:s kod är MXS{ø}{gänga}{L}-{slag}{justering}{funktion}-{givare}…,
-- t.ex. MXS12-50ASFR-M9BW (sida 64). Justering (9 val), funktion (5 val) och
-- deras kombinationsmatris fanns inte alls.
--
-- Produkterna SMC-MXS6–MXS25 hade max_pressure 8 (katalogen: 0,7 MPa) och
-- slag 100–200 mm (katalogen: 50–150 beroende på storlek). Rättas.

begin;

create schema if not exists backup;
create table if not exists backup.mxs_before_20260915 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'mxs'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'mxs'
  union all
  select 'family', f.id::text, f.slug, coalesce(f.order_code_template, '')
  from configurator_families f where f.slug = 'mxs';

insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-MXS-V1', '{"version":"1.0","steps":[{"id":"bore","step":1,"title_sv":"Storlek","title_en":"Bore size","required":true,"type":"single_select","options":[{"v":"6","label":"ø6 mm, slag 10–50"},{"v":"8","label":"ø8 mm, slag 10–75"},{"v":"12","label":"ø12 mm, slag 10–100"},{"v":"16","label":"ø16 mm, slag 10–125"},{"v":"20","label":"ø20 mm, slag 10–150"},{"v":"25","label":"ø25 mm, slag 10–150"}]},{"id":"stroke_mm","step":2,"title_sv":"Slaglängd","title_en":"Stroke","required":true,"type":"numeric","min":10,"max":150,"unit":"mm"},{"id":"port","step":3,"title_sv":"Gängtyp","title_en":"Port thread type","required":false,"type":"single_select","options":[{"v":"TN","label":"NPT-gänga (ø20, ø25)"},{"v":"TF","label":"G-gänga (ø20, ø25)"}]},{"id":"symmetric","step":4,"title_sv":"Symmetriskt utförande","title_en":"Symmetric type","required":false,"type":"single_select","options":[{"v":"L","label":"Symmetriskt utförande MXS□L (utan funktionsoptioner)"}]},{"id":"adjuster","step":5,"title_sv":"Slagjustering","title_en":"Adjuster option","required":false,"type":"single_select","options":[{"v":"AS","label":"Gummistopp i utskjutet ändläge"},{"v":"AT","label":"Gummistopp i indraget ändläge"},{"v":"A","label":"Gummistopp i båda ändlägen"},{"v":"BS","label":"Stötdämpare i utskjutet ändläge (ej ø6)"},{"v":"BT","label":"Stötdämpare i indraget ändläge (ej ø6)"},{"v":"B","label":"Stötdämpare i båda ändlägen (ej ø6)"},{"v":"ASBT","label":"Gummistopp utskjutet + stötdämpare indraget (ej ø6)"},{"v":"BSAT","label":"Stötdämpare utskjutet + gummistopp indraget (ej ø6)"}]},{"id":"functional","step":6,"title_sv":"Funktionsoption","title_en":"Functional option","required":false,"type":"single_select","options":[{"v":"F","label":"Med buffert"},{"v":"R","label":"Med ändlägeslås (ej ø6)"},{"v":"P","label":"Axiell anslutning"},{"v":"FR","label":"Buffert + ändlägeslås (ej ø6)"},{"v":"FP","label":"Buffert + axiell anslutning"}]},{"id":"switch","step":7,"title_sv":"Magnetgivare","title_en":"Auto switch","required":false,"type":"single_select","options":[{"v":"M9N","label":"D-M9N, 3-tråd NPN, rak"},{"v":"M9P","label":"D-M9P, 3-tråd PNP, rak"},{"v":"M9B","label":"D-M9B, 2-tråd, rak"},{"v":"M9NV","label":"D-M9NV, 3-tråd NPN, vinklad"},{"v":"M9PV","label":"D-M9PV, 3-tråd PNP, vinklad"},{"v":"M9BV","label":"D-M9BV, 2-tråd, vinklad"},{"v":"M9NW","label":"D-M9NW, NPN, tvåfärgsindikering, rak"},{"v":"M9PW","label":"D-M9PW, PNP, tvåfärgsindikering, rak"},{"v":"M9BW","label":"D-M9BW, 2-tråd, tvåfärgsindikering, rak"},{"v":"M9NWV","label":"D-M9NWV, NPN, tvåfärgsindikering, vinklad"},{"v":"M9PWV","label":"D-M9PWV, PNP, tvåfärgsindikering, vinklad"},{"v":"M9BWV","label":"D-M9BWV, 2-tråd, tvåfärgsindikering, vinklad"},{"v":"M9NA","label":"D-M9NA, NPN, vattentät, rak"},{"v":"M9PA","label":"D-M9PA, PNP, vattentät, rak"},{"v":"M9BA","label":"D-M9BA, 2-tråd, vattentät, rak"},{"v":"M9NAV","label":"D-M9NAV, NPN, vattentät, vinklad"},{"v":"M9PAV","label":"D-M9PAV, PNP, vattentät, vinklad"},{"v":"M9BAV","label":"D-M9BAV, 2-tråd, vattentät, vinklad"},{"v":"A96","label":"D-A96, reed 3-tråd, rak"},{"v":"A93","label":"D-A93, reed 2-tråd, rak"},{"v":"A90","label":"D-A90, reed 2-tråd utan indikering, rak"},{"v":"A96V","label":"D-A96V, reed 3-tråd, vinklad"},{"v":"A93V","label":"D-A93V, reed 2-tråd, vinklad"},{"v":"A90V","label":"D-A90V, reed 2-tråd utan indikering, vinklad"}]},{"id":"lead","step":8,"title_sv":"Givarens kabellängd","title_en":"Lead wire length","required":false,"type":"single_select","options":[{"v":"M","label":"1 m kabel"},{"v":"L","label":"3 m kabel"},{"v":"Z","label":"5 m kabel (tillverkas på beställning)"}]},{"id":"count","step":9,"title_sv":"Antal givare","title_en":"Number of auto switches","required":false,"type":"single_select","options":[{"v":"S","label":"1 givare (standard är 2)"}]},{"id":"mto","step":10,"title_sv":"Specialutförande","title_en":"Made to order","required":false,"type":"single_select","options":[{"v":"X7","label":"-X7 PTFE-fett"},{"v":"X9","label":"-X9 Fett för livsmedelsutrustning"},{"v":"X11","label":"-X11 Lång justerbult, 15 mm justermån"},{"v":"X12","label":"-X12 Lång justerbult, 25 mm justermån"},{"v":"X33","label":"-X33 Utan inbyggd magnet"},{"v":"X39","label":"-X39 Fluorgummitätning"},{"v":"X42","label":"-X42 Korrosionsskyddad styrning"},{"v":"X2578","label":"-X2578 Justerare monterad på sidan"}]}]}'::jsonb,
        'SMC MXS slidbord', 'SMC MXS air slide table', 'linear-module')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  title = 'Luftdrivet slidbord ø6–25, standard och symmetriskt',
  description = 'SMC MXS air slide table, dual rod, ø6–25 mm, strokes 10–150 mm; symmetric type MXS□L.',
  stroke_min_mm = 10,
  stroke_max_mm = 150,
  order_code_template = 'MXS{bore}{port}{symmetric}-{stroke_mm}{adjuster}{functional}-{switch}{lead}{count}-{mto}',
  rules_schema_id = 'SCHEMA-MXS-V1'
where slug = 'mxs';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'mxs';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'mxs';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"bore","label":"Storlek","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"stroke_mm","label":"Slaglängd","param_type":"number","sort_order":2,"required":true,"min_value":10,"max_value":150},{"param_key":"port","label":"Gängtyp","param_type":"select","sort_order":3,"required":false,"min_value":null,"max_value":null},{"param_key":"symmetric","label":"Symmetriskt utförande","param_type":"select","sort_order":4,"required":false,"min_value":null,"max_value":null},{"param_key":"adjuster","label":"Slagjustering","param_type":"select","sort_order":5,"required":false,"min_value":null,"max_value":null},{"param_key":"functional","label":"Funktionsoption","param_type":"select","sort_order":6,"required":false,"min_value":null,"max_value":null},{"param_key":"switch","label":"Magnetgivare","param_type":"select","sort_order":7,"required":false,"min_value":null,"max_value":null},{"param_key":"lead","label":"Givarens kabellängd","param_type":"select","sort_order":8,"required":false,"min_value":null,"max_value":null},{"param_key":"count","label":"Antal givare","param_type":"select","sort_order":9,"required":false,"min_value":null,"max_value":null},{"param_key":"mto","label":"Specialutförande","param_type":"select","sort_order":10,"required":false,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'mxs';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"bore","code":"6","label":"ø6 mm, slag 10–50","sort_order":0},{"param_key":"bore","code":"8","label":"ø8 mm, slag 10–75","sort_order":1},{"param_key":"bore","code":"12","label":"ø12 mm, slag 10–100","sort_order":2},{"param_key":"bore","code":"16","label":"ø16 mm, slag 10–125","sort_order":3},{"param_key":"bore","code":"20","label":"ø20 mm, slag 10–150","sort_order":4},{"param_key":"bore","code":"25","label":"ø25 mm, slag 10–150","sort_order":5},{"param_key":"port","code":"TN","label":"NPT-gänga (ø20, ø25)","sort_order":0},{"param_key":"port","code":"TF","label":"G-gänga (ø20, ø25)","sort_order":1},{"param_key":"symmetric","code":"L","label":"Symmetriskt utförande MXS□L (utan funktionsoptioner)","sort_order":0},{"param_key":"adjuster","code":"AS","label":"Gummistopp i utskjutet ändläge","sort_order":0},{"param_key":"adjuster","code":"AT","label":"Gummistopp i indraget ändläge","sort_order":1},{"param_key":"adjuster","code":"A","label":"Gummistopp i båda ändlägen","sort_order":2},{"param_key":"adjuster","code":"BS","label":"Stötdämpare i utskjutet ändläge (ej ø6)","sort_order":3},{"param_key":"adjuster","code":"BT","label":"Stötdämpare i indraget ändläge (ej ø6)","sort_order":4},{"param_key":"adjuster","code":"B","label":"Stötdämpare i båda ändlägen (ej ø6)","sort_order":5},{"param_key":"adjuster","code":"ASBT","label":"Gummistopp utskjutet + stötdämpare indraget (ej ø6)","sort_order":6},{"param_key":"adjuster","code":"BSAT","label":"Stötdämpare utskjutet + gummistopp indraget (ej ø6)","sort_order":7},{"param_key":"functional","code":"F","label":"Med buffert","sort_order":0},{"param_key":"functional","code":"R","label":"Med ändlägeslås (ej ø6)","sort_order":1},{"param_key":"functional","code":"P","label":"Axiell anslutning","sort_order":2},{"param_key":"functional","code":"FR","label":"Buffert + ändlägeslås (ej ø6)","sort_order":3},{"param_key":"functional","code":"FP","label":"Buffert + axiell anslutning","sort_order":4},{"param_key":"switch","code":"M9N","label":"D-M9N, 3-tråd NPN, rak","sort_order":0},{"param_key":"switch","code":"M9P","label":"D-M9P, 3-tråd PNP, rak","sort_order":1},{"param_key":"switch","code":"M9B","label":"D-M9B, 2-tråd, rak","sort_order":2},{"param_key":"switch","code":"M9NV","label":"D-M9NV, 3-tråd NPN, vinklad","sort_order":3},{"param_key":"switch","code":"M9PV","label":"D-M9PV, 3-tråd PNP, vinklad","sort_order":4},{"param_key":"switch","code":"M9BV","label":"D-M9BV, 2-tråd, vinklad","sort_order":5},{"param_key":"switch","code":"M9NW","label":"D-M9NW, NPN, tvåfärgsindikering, rak","sort_order":6},{"param_key":"switch","code":"M9PW","label":"D-M9PW, PNP, tvåfärgsindikering, rak","sort_order":7},{"param_key":"switch","code":"M9BW","label":"D-M9BW, 2-tråd, tvåfärgsindikering, rak","sort_order":8},{"param_key":"switch","code":"M9NWV","label":"D-M9NWV, NPN, tvåfärgsindikering, vinklad","sort_order":9},{"param_key":"switch","code":"M9PWV","label":"D-M9PWV, PNP, tvåfärgsindikering, vinklad","sort_order":10},{"param_key":"switch","code":"M9BWV","label":"D-M9BWV, 2-tråd, tvåfärgsindikering, vinklad","sort_order":11},{"param_key":"switch","code":"M9NA","label":"D-M9NA, NPN, vattentät, rak","sort_order":12},{"param_key":"switch","code":"M9PA","label":"D-M9PA, PNP, vattentät, rak","sort_order":13},{"param_key":"switch","code":"M9BA","label":"D-M9BA, 2-tråd, vattentät, rak","sort_order":14},{"param_key":"switch","code":"M9NAV","label":"D-M9NAV, NPN, vattentät, vinklad","sort_order":15},{"param_key":"switch","code":"M9PAV","label":"D-M9PAV, PNP, vattentät, vinklad","sort_order":16},{"param_key":"switch","code":"M9BAV","label":"D-M9BAV, 2-tråd, vattentät, vinklad","sort_order":17},{"param_key":"switch","code":"A96","label":"D-A96, reed 3-tråd, rak","sort_order":18},{"param_key":"switch","code":"A93","label":"D-A93, reed 2-tråd, rak","sort_order":19},{"param_key":"switch","code":"A90","label":"D-A90, reed 2-tråd utan indikering, rak","sort_order":20},{"param_key":"switch","code":"A96V","label":"D-A96V, reed 3-tråd, vinklad","sort_order":21},{"param_key":"switch","code":"A93V","label":"D-A93V, reed 2-tråd, vinklad","sort_order":22},{"param_key":"switch","code":"A90V","label":"D-A90V, reed 2-tråd utan indikering, vinklad","sort_order":23},{"param_key":"lead","code":"M","label":"1 m kabel","sort_order":0},{"param_key":"lead","code":"L","label":"3 m kabel","sort_order":1},{"param_key":"lead","code":"Z","label":"5 m kabel (tillverkas på beställning)","sort_order":2},{"param_key":"count","code":"S","label":"1 givare (standard är 2)","sort_order":0},{"param_key":"mto","code":"X7","label":"-X7 PTFE-fett","sort_order":0},{"param_key":"mto","code":"X9","label":"-X9 Fett för livsmedelsutrustning","sort_order":1},{"param_key":"mto","code":"X11","label":"-X11 Lång justerbult, 15 mm justermån","sort_order":2},{"param_key":"mto","code":"X12","label":"-X12 Lång justerbult, 25 mm justermån","sort_order":3},{"param_key":"mto","code":"X33","label":"-X33 Utan inbyggd magnet","sort_order":4},{"param_key":"mto","code":"X39","label":"-X39 Fluorgummitätning","sort_order":5},{"param_key":"mto","code":"X42","label":"-X42 Korrosionsskyddad styrning","sort_order":6},{"param_key":"mto","code":"X2578","label":"-X2578 Justerare monterad på sidan","sort_order":7}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'mxs';

delete from config_rules where schema_id = 'SCHEMA-MXS-V1';


insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-MXS-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["6"]]},{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[10,20,30,40,50]]}}]},"message_sv":"MXS6 finns i slag 10, 20, 30, 40 och 50 mm — inga mellanslag.","message_en":"MXS6 exists in strokes 10, 20, 30, 40 and 50 mm — no intermediate strokes.","goto_step":"mxs-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["8"]]},{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[10,20,30,40,50,75]]}}]},"message_sv":"MXS8 finns i slag 10, 20, 30, 40, 50 och 75 mm — inga mellanslag.","message_en":"MXS8 exists in strokes 10, 20, 30, 40, 50 and 75 mm — no intermediate strokes.","goto_step":"mxs-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["12"]]},{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[10,20,30,40,50,75,100]]}}]},"message_sv":"MXS12 finns i slag 10, 20, 30, 40, 50, 75 och 100 mm — inga mellanslag.","message_en":"MXS12 exists in strokes 10, 20, 30, 40, 50, 75 and 100 mm — no intermediate strokes.","goto_step":"mxs-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["16"]]},{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[10,20,30,40,50,75,100,125]]}}]},"message_sv":"MXS16 finns i slag 10, 20, 30, 40, 50, 75, 100 och 125 mm — inga mellanslag.","message_en":"MXS16 exists in strokes 10, 20, 30, 40, 50, 75, 100 and 125 mm — no intermediate strokes.","goto_step":"mxs-stroke_mm"},{"severity":"error","if_json":{"and":[{"in":[{"var":"bore"},["20","25"]]},{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[10,20,30,40,50,75,100,125,150]]}}]},"message_sv":"MXS20 och 25 finns i slag 10, 20, 30, 40, 50, 75, 100, 125 och 150 mm — inga mellanslag.","message_en":"MXS20 and 25 exists in strokes 10, 20, 30, 40, 50, 75, 100, 125 and 150 mm — no intermediate strokes.","goto_step":"mxs-stroke_mm"},{"severity":"error","if_json":{"and":[{"==":[{"var":"port"},"TN"]},{"in":[{"var":"bore"},["6","8","12","16"]]}]},"message_sv":"Gängtyp TN finns för ø20 och 25; ø6–16 har M-gänga.","message_en":"Port thread TN exists for ø20 and 25; ø6–16 has M thread.","goto_step":"mxs-port"},{"severity":"error","if_json":{"and":[{"==":[{"var":"port"},"TF"]},{"in":[{"var":"bore"},["6","8","12","16"]]}]},"message_sv":"Gängtyp TF finns för ø20 och 25; ø6–16 har M-gänga.","message_en":"Port thread TF exists for ø20 and 25; ø6–16 has M thread.","goto_step":"mxs-port"},{"severity":"error","if_json":{"and":[{"in":[{"var":"adjuster"},["BS","BT","B","ASBT","BSAT"]]},{"in":[{"var":"bore"},["6"]]}]},"message_sv":"Stötdämpare (BS, BT, B, ASBT och BSAT) finns inte för MXS6 (sida 65). Gummistopp AS, AT och A går.","message_en":"Shock absorbers (BS, BT, B, ASBT and BSAT) are not available for MXS6 (page 65). Rubber stoppers AS, AT and A are.","goto_step":"mxs-adjuster"},{"severity":"error","if_json":{"and":[{"in":[{"var":"functional"},["R","FR"]]},{"in":[{"var":"bore"},["6"]]}]},"message_sv":"Ändlägeslås (R och FR) finns inte för MXS6 (not 2, sida 64).","message_en":"The end lock (R and FR) is not available for MXS6 (note 2, page 64).","goto_step":"mxs-functional"},{"severity":"error","if_json":{"and":[{"==":[{"var":"symmetric"},"L"]},{"!=":[{"var":"functional"},""]}]},"message_sv":"Det symmetriska utförandet MXS□L har inga funktionsoptioner (not 2, sida 85) — ingen buffert, inget ändlägeslås, ingen axiell anslutning.","message_en":"The symmetric MXS□L has no functional options (note 2, page 85) — no buffer, no end lock, no axial piping.","goto_step":"mxs-functional"},{"severity":"error","if_json":{"and":[{"==":[{"var":"adjuster"},"AT"]},{"in":[{"var":"functional"},["R","P","FR","FP"]]}]},"message_sv":"Justering AT går att kombinera med funktionsoption F, inte R, P, FR och FP (sida 64).","message_en":"Adjuster AT combines with functional option F, not R, P, FR and FP (page 64).","goto_step":"mxs-functional"},{"severity":"error","if_json":{"and":[{"==":[{"var":"adjuster"},"A"]},{"in":[{"var":"functional"},["R","P","FR","FP"]]}]},"message_sv":"Justering A går att kombinera med funktionsoption F, inte R, P, FR och FP (sida 64).","message_en":"Adjuster A combines with functional option F, not R, P, FR and FP (page 64).","goto_step":"mxs-functional"},{"severity":"error","if_json":{"and":[{"==":[{"var":"adjuster"},"BS"]},{"in":[{"var":"functional"},["F","FR","FP"]]}]},"message_sv":"Justering BS går att kombinera med funktionsoption R eller P, inte F, FR och FP (sida 64).","message_en":"Adjuster BS combines with functional option R or P, not F, FR and FP (page 64).","goto_step":"mxs-functional"},{"severity":"error","if_json":{"and":[{"==":[{"var":"adjuster"},"BT"]},{"in":[{"var":"functional"},["R","P","FR","FP"]]}]},"message_sv":"Justering BT går att kombinera med funktionsoption F, inte R, P, FR och FP (sida 64).","message_en":"Adjuster BT combines with functional option F, not R, P, FR and FP (page 64).","goto_step":"mxs-functional"},{"severity":"error","if_json":{"and":[{"==":[{"var":"adjuster"},"B"]},{"in":[{"var":"functional"},["F","R","P","FR","FP"]]}]},"message_sv":"Justering B går inte att kombinera med någon funktionsoption (sida 64).","message_en":"Adjuster B cannot be combined with any functional option (page 64).","goto_step":"mxs-functional"},{"severity":"error","if_json":{"and":[{"==":[{"var":"adjuster"},"ASBT"]},{"in":[{"var":"functional"},["R","P","FR","FP"]]}]},"message_sv":"Justering ASBT går att kombinera med funktionsoption F, inte R, P, FR och FP (sida 64).","message_en":"Adjuster ASBT combines with functional option F, not R, P, FR and FP (page 64).","goto_step":"mxs-functional"},{"severity":"error","if_json":{"and":[{"==":[{"var":"adjuster"},"BSAT"]},{"in":[{"var":"functional"},["F","R","P","FR","FP"]]}]},"message_sv":"Justering BSAT går inte att kombinera med någon funktionsoption (sida 64).","message_en":"Adjuster BSAT cannot be combined with any functional option (page 64).","goto_step":"mxs-functional"},{"severity":"error","if_json":{"and":[{"==":[{"var":"switch"},""]},{"or":[{"!=":[{"var":"lead"},""]},{"!=":[{"var":"count"},""]}]}]},"message_sv":"Kabellängd och antal hör till givaren — välj en givare först.","message_en":"Lead wire length and quantity belong to the auto switch — choose a switch first.","goto_step":"mxs-switch"},{"severity":"error","if_json":{"and":[{"==":[{"var":"mto"},"X33"]},{"!=":[{"var":"switch"},""]}]},"message_sv":"-X33 är utan inbyggd magnet; då har givaren inget att känna av.","message_en":"-X33 is without the built-in magnet; the auto switch would have nothing to sense.","goto_step":"mxs-mto"},{"severity":"info","if_json":{"==":[{"var":"bore"},"6"]},"message_sv":"MXS6: teoretisk kraft 29 N vid 0,5 MPa (dubbel kolvstång), anslutning M3, slag 10, 20, 30, 40 och 50 mm. Tryck 0,15–0,7 MPa.","message_en":"MXS6: theoretical force 29 N at 0.5 MPa (dual rod), port M3, strokes 10, 20, 30, 40 and 50 mm. Pressure 0.15–0.7 MPa.","goto_step":"mxs-bore"}]'::jsonb) r;

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-MXS-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"info","if_json":{"==":[{"var":"bore"},"8"]},"message_sv":"MXS8: teoretisk kraft 51 N vid 0,5 MPa (dubbel kolvstång), anslutning M5, slag 10, 20, 30, 40, 50 och 75 mm. Tryck 0,15–0,7 MPa.","message_en":"MXS8: theoretical force 51 N at 0.5 MPa (dual rod), port M5, strokes 10, 20, 30, 40, 50 and 75 mm. Pressure 0.15–0.7 MPa.","goto_step":"mxs-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"12"]},"message_sv":"MXS12: teoretisk kraft 113 N vid 0,5 MPa (dubbel kolvstång), anslutning M5, slag 10, 20, 30, 40, 50, 75 och 100 mm. Tryck 0,15–0,7 MPa.","message_en":"MXS12: theoretical force 113 N at 0.5 MPa (dual rod), port M5, strokes 10, 20, 30, 40, 50, 75 and 100 mm. Pressure 0.15–0.7 MPa.","goto_step":"mxs-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"16"]},"message_sv":"MXS16: teoretisk kraft 201 N vid 0,5 MPa (dubbel kolvstång), anslutning M5, slag 10, 20, 30, 40, 50, 75, 100 och 125 mm. Tryck 0,15–0,7 MPa.","message_en":"MXS16: theoretical force 201 N at 0.5 MPa (dual rod), port M5, strokes 10, 20, 30, 40, 50, 75, 100 and 125 mm. Pressure 0.15–0.7 MPa.","goto_step":"mxs-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"20"]},"message_sv":"MXS20: teoretisk kraft 314 N vid 0,5 MPa (dubbel kolvstång), anslutning Rc 1/8, slag 10, 20, 30, 40, 50, 75, 100, 125 och 150 mm. Tryck 0,15–0,7 MPa.","message_en":"MXS20: theoretical force 314 N at 0.5 MPa (dual rod), port Rc 1/8, strokes 10, 20, 30, 40, 50, 75, 100, 125 and 150 mm. Pressure 0.15–0.7 MPa.","goto_step":"mxs-bore"},{"severity":"info","if_json":{"==":[{"var":"bore"},"25"]},"message_sv":"MXS25: teoretisk kraft 491 N vid 0,5 MPa (dubbel kolvstång), anslutning Rc 1/8, slag 10, 20, 30, 40, 50, 75, 100, 125 och 150 mm. Tryck 0,15–0,7 MPa.","message_en":"MXS25: theoretical force 491 N at 0.5 MPa (dual rod), port Rc 1/8, strokes 10, 20, 30, 40, 50, 75, 100, 125 and 150 mm. Pressure 0.15–0.7 MPa.","goto_step":"mxs-bore"},{"severity":"info","if_json":{"in":[{"var":"adjuster"},["AS","A","ASBT"]]},"message_sv":"Gummistoppet i utskjutet ändläge justerar slaget 0–5 mm. Med buffert (F) kortas buffertslaget lika mycket (not 3).","message_en":"The rubber stopper on the extension end adjusts the stroke 0–5 mm. With buffer (F) the buffer stroke shortens by the same amount (note 3).","goto_step":"mxs-adjuster"},{"severity":"info","if_json":{"in":[{"var":"functional"},["F","FR","FP"]]},"message_sv":"Buffertens givare (D-M9BV/M9NV/M9PV) beställs separat (sida 83).","message_en":"The buffer''s auto switch (D-M9BV/M9NV/M9PV) is ordered separately (page 83).","goto_step":"mxs-functional"},{"severity":"info","if_json":{"!=":[{"var":"switch"},""]},"message_sv":"Givaren levereras löst, inte monterad. 5 m kabel tillverkas på beställning.","message_en":"The auto switch ships loose, not assembled. The 5 m lead is made to order.","goto_step":"mxs-switch"}]'::jsonb) r;

insert into knowledge_doc_families (source_file, family_slug, doc_title)
values ('smc-kat-mxs.pdf', 'mxs', 'SMC — SMC Air Slide Table MXS Series')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;


update product_specs s set value = '50 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS6' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS6' and s.key = 'max_pressure' and s.value = '8';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '10, 20, 30, 40, 50'),
  ('force_out_n_05mpa', '29'),
  ('pressure_range_mpa', '0.15–0.7'),
  ('order_code_example', 'MXS6-50'),
  ('catalogue', 'SMC MXS, How to Order sida 64, data sida 65')
) as x(key, value)
where p.sku = 'SMC-MXS6'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update product_specs s set value = '75 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS8' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS8' and s.key = 'max_pressure' and s.value = '8';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '10, 20, 30, 40, 50, 75'),
  ('force_out_n_05mpa', '51'),
  ('pressure_range_mpa', '0.15–0.7'),
  ('order_code_example', 'MXS8-75'),
  ('catalogue', 'SMC MXS, How to Order sida 64, data sida 65')
) as x(key, value)
where p.sku = 'SMC-MXS8'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update product_specs s set value = '100 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS12' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS12' and s.key = 'max_pressure' and s.value = '8';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '10, 20, 30, 40, 50, 75, 100'),
  ('force_out_n_05mpa', '113'),
  ('pressure_range_mpa', '0.15–0.7'),
  ('order_code_example', 'MXS12-100'),
  ('catalogue', 'SMC MXS, How to Order sida 64, data sida 65')
) as x(key, value)
where p.sku = 'SMC-MXS12'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update product_specs s set value = '125 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS16' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS16' and s.key = 'max_pressure' and s.value = '8';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '10, 20, 30, 40, 50, 75, 100, 125'),
  ('force_out_n_05mpa', '201'),
  ('pressure_range_mpa', '0.15–0.7'),
  ('order_code_example', 'MXS16-125'),
  ('catalogue', 'SMC MXS, How to Order sida 64, data sida 65')
) as x(key, value)
where p.sku = 'SMC-MXS16'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update product_specs s set value = '150 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS20' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS20' and s.key = 'max_pressure' and s.value = '8';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '10, 20, 30, 40, 50, 75, 100, 125, 150'),
  ('force_out_n_05mpa', '314'),
  ('pressure_range_mpa', '0.15–0.7'),
  ('order_code_example', 'MXS20-150'),
  ('catalogue', 'SMC MXS, How to Order sida 64, data sida 65')
) as x(key, value)
where p.sku = 'SMC-MXS20'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


update product_specs s set value = '150 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS25' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-MXS25' and s.key = 'max_pressure' and s.value = '8';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '10, 20, 30, 40, 50, 75, 100, 125, 150'),
  ('force_out_n_05mpa', '491'),
  ('pressure_range_mpa', '0.15–0.7'),
  ('order_code_example', 'MXS25-150'),
  ('catalogue', 'SMC MXS, How to Order sida 64, data sida 65')
) as x(key, value)
where p.sku = 'SMC-MXS25'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


commit;


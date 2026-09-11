-- P1D: beställnyckeln enligt P1D Series Pneumatic Cylinders, PDE2570TCUK.
-- GENERERAD ur src/lib/catalog/p1d.ts -- redigera inte för hand.
--
-- Rättar fyra fel som legat i produktion:
--   1. order_code_template var 'P1D-S{bore_mm}M{thread}-{stroke_mm}', som ger
--      "P1D-S50MS-200". Parkers koder är POSITIONELLA med nollutfyllnad --
--      "P1D-S050MS-0200". Mallen kunde inte bygga en enda beställbar artikel.
--   2. stroke_max_mm var 2000; katalogen säger "Max stroke 2800 mm".
--   3. Beställnyckeln modellerades med parametrarna bore/stroke/thread/
--      cushioning/sensing/options. Fyra av dem finns inte i nyckeln, och tre
--      positioner som DO finns (utförande, funktion, ren design) saknades.
--   4. Familjen hade inget rules_schema_id, alltså inga villkor alls -- varken
--      låsenhetens materialkrav eller ATEX-notens begränsning.

begin;

create schema if not exists backup;
create table if not exists backup.p1d_before_20260911 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'p1d'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'p1d';


-- Schemat måste finnas innan familjen kan peka på det (främmande nyckel).
insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-P1D-V1', '{"version":"1.0","steps":[{"id":"version","step":1,"title":"Cylinderutförande","type":"single_select","options":[{"v":"S","label":"S – Standard"},{"v":"C","label":"C – Ultra Clean eller Pro Clean (avgörs av position 11)"},{"v":"V","label":"V – Standard med påbyggd ventil (ger 20-teckenskod)"},{"v":"L","label":"L – Med dynamisk kolvstångslåsning"},{"v":"H","label":"H – Med statisk kolvstångslåsning"}]},{"id":"bore_mm","step":2,"title":"Kolvdiameter","type":"single_select","options":[{"v":"032","label":"Ø32 mm"},{"v":"040","label":"Ø40 mm"},{"v":"050","label":"Ø50 mm"},{"v":"063","label":"Ø63 mm"},{"v":"080","label":"Ø80 mm"},{"v":"100","label":"Ø100 mm"},{"v":"125","label":"Ø125 mm"}]},{"id":"function","step":3,"title":"Funktion, gavelskruvar och avstrykare","type":"single_select","options":[{"v":"M","label":"M – Dubbelverkande, std skruvar, std avstrykare"},{"v":"D","label":"D – Dubbelverkande, std skruvar, HDPE-avstrykare"},{"v":"V","label":"V – Dubbelverkande, std skruvar, FPM-avstrykare"},{"v":"A","label":"A – Dubbelverkande, rostfria skruvar, std avstrykare"},{"v":"H","label":"H – Dubbelverkande, rostfria skruvar, HDPE-avstrykare"},{"v":"W","label":"W – Dubbelverkande, rostfria skruvar, FPM-avstrykare"},{"v":"F","label":"F – Genomgående kolvstång, std skruvar, std avstrykare"},{"v":"E","label":"E – Genomgående kolvstång, std skruvar, HDPE-avstrykare"},{"v":"B","label":"B – Genomgående kolvstång, std skruvar, FPM-avstrykare"},{"v":"G","label":"G – Genomgående kolvstång, rostfria skruvar, std avstrykare"},{"v":"Y","label":"Y – Genomgående kolvstång, rostfria skruvar, HDPE-avstrykare"},{"v":"Z","label":"Z – Genomgående kolvstång, rostfria skruvar, FPM-avstrykare"}]},{"id":"rod_material","step":4,"title":"Kolvstångs- och tätningsmaterial","type":"single_select","options":[{"v":"S","label":"S – Rostfritt stål, X 10 CrNiS 18 9 (standard)"},{"v":"C","label":"C – Hårdförkromat stål, Fe 490-2 FN"},{"v":"M","label":"M – Syrafast stål, X 5 CrNiMo 17 13 3"},{"v":"R","label":"R – Hårdförkromat rostfritt stål, X 10 CrNiS 18 9"}]},{"id":"position_11","step":5,"title":"Ren design","type":"single_select","options":[{"v":"-","label":"Ingen — standardcylinder"},{"v":"N","label":"N – Ultra Clean (utan givarfunktion)"},{"v":"T","label":"T – Pro Clean, 2 T-spår upptill"},{"v":"Y","label":"Y – Pro Clean, 2 T-spår till höger"},{"v":"W","label":"W – Pro Clean, 2 T-spår nedtill"},{"v":"V","label":"V – Pro Clean, 2 T-spår till vänster"}]},{"id":"stroke_mm","step":6,"title":"Slaglängd","type":"numeric","min":1,"max":2800,"unit":"mm"},{"id":"atex","step":7,"title":"Explosionsfarlig miljö (ATEX)","type":"single_select","options":[{"v":"","label":"Nej"},{"v":"ja","label":"Ja — ATEX-zon"}]}]}'::jsonb,
        'Parker P1D ISO-cylinder', 'Parker P1D ISO cylinder', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;


-- Rätt slagintervall, och en mall som speglar kodens positioner.
-- {key#N} nollutfyller till N tecken -- utan det blir koden obeställbar.
update configurator_families set
  stroke_min_mm = 1,
  stroke_max_mm = 2800,
  order_code_template = 'P1D-{version}{bore_mm#3}{function}{rod_material}{position_11}{stroke_mm#4}',
  standard = 'ISO 15552',
  rules_schema_id = 'SCHEMA-P1D-V1'
where slug = 'p1d';


-- Ut med den handskrivna modellen, in med katalogens positioner.
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'p1d';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'p1d';


alter table configurator_params
  add column if not exists min_value numeric,
  add column if not exists max_value numeric;

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"version","label":"Cylinderutförande","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"bore_mm","label":"Kolvdiameter","param_type":"select","sort_order":2,"required":true,"min_value":null,"max_value":null},{"param_key":"function","label":"Funktion, gavelskruvar och avstrykare","param_type":"select","sort_order":3,"required":true,"min_value":null,"max_value":null},{"param_key":"rod_material","label":"Kolvstångs- och tätningsmaterial","param_type":"select","sort_order":4,"required":true,"min_value":null,"max_value":null},{"param_key":"position_11","label":"Ren design","param_type":"select","sort_order":5,"required":true,"min_value":null,"max_value":null},{"param_key":"stroke_mm","label":"Slaglängd","param_type":"number","sort_order":6,"required":true,"min_value":1,"max_value":2800},{"param_key":"atex","label":"Explosionsfarlig miljö (ATEX)","param_type":"select","sort_order":7,"required":false,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'p1d';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"version","code":"S","label":"Standard","sort_order":0},{"param_key":"version","code":"C","label":"Ultra Clean eller Pro Clean (avgörs av position 11)","sort_order":1},{"param_key":"version","code":"V","label":"Standard med påbyggd ventil (ger 20-teckenskod)","sort_order":2},{"param_key":"version","code":"L","label":"Med dynamisk kolvstångslåsning","sort_order":3},{"param_key":"version","code":"H","label":"Med statisk kolvstångslåsning","sort_order":4},{"param_key":"bore_mm","code":"032","label":"mm","sort_order":0},{"param_key":"bore_mm","code":"040","label":"mm","sort_order":1},{"param_key":"bore_mm","code":"050","label":"mm","sort_order":2},{"param_key":"bore_mm","code":"063","label":"mm","sort_order":3},{"param_key":"bore_mm","code":"080","label":"mm","sort_order":4},{"param_key":"bore_mm","code":"100","label":"mm","sort_order":5},{"param_key":"bore_mm","code":"125","label":"mm","sort_order":6},{"param_key":"function","code":"M","label":"Dubbelverkande, std skruvar, std avstrykare","sort_order":0},{"param_key":"function","code":"D","label":"Dubbelverkande, std skruvar, HDPE-avstrykare","sort_order":1},{"param_key":"function","code":"V","label":"Dubbelverkande, std skruvar, FPM-avstrykare","sort_order":2},{"param_key":"function","code":"A","label":"Dubbelverkande, rostfria skruvar, std avstrykare","sort_order":3},{"param_key":"function","code":"H","label":"Dubbelverkande, rostfria skruvar, HDPE-avstrykare","sort_order":4},{"param_key":"function","code":"W","label":"Dubbelverkande, rostfria skruvar, FPM-avstrykare","sort_order":5},{"param_key":"function","code":"F","label":"Genomgående kolvstång, std skruvar, std avstrykare","sort_order":6},{"param_key":"function","code":"E","label":"Genomgående kolvstång, std skruvar, HDPE-avstrykare","sort_order":7},{"param_key":"function","code":"B","label":"Genomgående kolvstång, std skruvar, FPM-avstrykare","sort_order":8},{"param_key":"function","code":"G","label":"Genomgående kolvstång, rostfria skruvar, std avstrykare","sort_order":9},{"param_key":"function","code":"Y","label":"Genomgående kolvstång, rostfria skruvar, HDPE-avstrykare","sort_order":10},{"param_key":"function","code":"Z","label":"Genomgående kolvstång, rostfria skruvar, FPM-avstrykare","sort_order":11},{"param_key":"rod_material","code":"S","label":"Rostfritt stål, X 10 CrNiS 18 9 (standard)","sort_order":0},{"param_key":"rod_material","code":"C","label":"Hårdförkromat stål, Fe 490-2 FN","sort_order":1},{"param_key":"rod_material","code":"M","label":"Syrafast stål, X 5 CrNiMo 17 13 3","sort_order":2},{"param_key":"rod_material","code":"R","label":"Hårdförkromat rostfritt stål, X 10 CrNiS 18 9","sort_order":3},{"param_key":"position_11","code":"-","label":"Ingen — standardcylinder","sort_order":0},{"param_key":"position_11","code":"N","label":"Ultra Clean (utan givarfunktion)","sort_order":1},{"param_key":"position_11","code":"T","label":"Pro Clean, 2 T-spår upptill","sort_order":2},{"param_key":"position_11","code":"Y","label":"Pro Clean, 2 T-spår till höger","sort_order":3},{"param_key":"position_11","code":"W","label":"Pro Clean, 2 T-spår nedtill","sort_order":4},{"param_key":"position_11","code":"V","label":"Pro Clean, 2 T-spår till vänster","sort_order":5},{"param_key":"atex","code":"","label":"Nej","sort_order":0},{"param_key":"atex","code":"ja","label":"Ja — ATEX-zon","sort_order":1}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'p1d';


-- Katalogens villkor. P1/P2 är låsenhetens materialkrav ("S and M not in
-- combination with rod lock device" / "Only for piston rod material type C and
-- R"), P4 är ATEX-notens begränsning till P1D-S***MS-****, P5-P7 är Ultra/Pro
-- Clean-gränserna och torrgångsavstrykaren. P3 varnar för slaglängder utanför
-- ISO 4393 utan att blockera dem -- de går att beställa, de tar längre tid.
delete from config_rules where schema_id = 'SCHEMA-P1D-V1';

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-P1D-V1', r.severity, r.if_json, r.message_sv, r.message_en, r.goto_step
from jsonb_to_recordset('[{"severity":"error","if_json":{"and":[{"in":[{"var":"version"},["L","H"]]},{"not":{"in":[{"var":"rod_material"},["C","R"]]}}]},"message_sv":"Kolvstångslåsning (utförande L och H) kräver hårdförkromad kolvstång, dvs material C eller R.","message_en":"Rod locking (versions L and H) requires a hard-chromium plated piston rod, i.e. material C or R.","goto_step":"P1"},{"severity":"error","if_json":{"and":[{"in":[{"var":"version"},["L","H"]]},{"in":[{"var":"rod_material"},["S","M"]]}]},"message_sv":"Kolvstångsmaterial S (rostfritt) och M (syrafast) kan inte kombineras med låsenhet.","message_en":"Piston rod materials S (stainless) and M (acid-proof) cannot be combined with a rod lock device.","goto_step":"P2"},{"severity":"warn","if_json":{"and":[{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[25,40,50,80,100,125,160,200,250,320,400,500,600,700,800]]}}]},"message_sv":"Slaglängden är inte en ISO 4393-standardlängd. Cylindern går att beställa men tillverkas som specialmått — räkna med längre leveranstid.","message_en":"The stroke is not an ISO 4393 standard length. The cylinder is orderable but made to special order — expect a longer lead time.","goto_step":"P3"},{"severity":"error","if_json":{"and":[{"==":[{"var":"atex"},"ja"]},{"or":[{"!=":[{"var":"version"},"S"]},{"!=":[{"var":"function"},"M"]}]}]},"message_sv":"ATEX-märkningen II 2GD c T4 120 °C gäller bara utförandet P1D-S***MS-****. Andra varianter måste kontrolleras mot Parker.","message_en":"The ATEX marking II 2GD c T4 120 °C applies only to P1D-S***MS-****. Other variants must be verified with Parker.","goto_step":"P4"},{"severity":"error","if_json":{"and":[{"==":[{"var":"version"},"C"]},{"in":[{"var":"position_11"},["T","Y","W","V"]]},{"in":[{"var":"function"},["F","E","B","G","Y","Z"]]}]},"message_sv":"Genomgående kolvstång finns inte i Pro Clean-utförandet. Välj Ultra Clean (N i position 11) eller standardcylinder.","message_en":"A through piston rod is not available in the Pro Clean version. Choose Ultra Clean (N in position 11) or the standard cylinder.","goto_step":"P5"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"version"},"C"]},{"or":[{">":[{"var":"bore_mm"},80]},{">":[{"var":"stroke_mm"},700]}]}]},"message_sv":"Ultra Clean/Pro Clean är katalogfört för Ø32–80 mm och slag upp till 700 mm. Utanför det måste längden bekräftas av Parker.","message_en":"Ultra Clean/Pro Clean is catalogued for Ø32–80 mm and strokes up to 700 mm. Outside that range the length must be confirmed by Parker.","goto_step":"P6"},{"severity":"error","if_json":{"and":[{"in":[{"var":"version"},["L","H"]]},{"in":[{"var":"function"},["D","H","E","Y"]]}]},"message_sv":"HDPE-avstrykare (torrgångsutförande) kan inte kombineras med kolvstångslåsning L eller H.","message_en":"The HDPE scraper (dry-rod design) cannot be combined with rod locking versions L or H.","goto_step":"P7"},{"severity":"error","if_json":{"and":[{">":[{"var":"stroke_mm"},0]},{"or":[{"<":[{"var":"stroke_mm"},1]},{">":[{"var":"stroke_mm"},2800]}]}]},"message_sv":"Slaglängden måste vara 1–2800 mm.","message_en":"Stroke must be 1–2800 mm.","goto_step":"p1d-slag"},{"severity":"error","if_json":{"and":[{"!=":[{"var":"bore_mm"},""]},{"not":{"in":[{"var":"bore_mm"},["032","040","050","063","080","100","125"]]}}]},"message_sv":"P1D finns i Ø32, 40, 50, 63, 80, 100, 125 mm.","message_en":"P1D is available in Ø32, 40, 50, 63, 80, 100, 125 mm.","goto_step":"p1d-storlek"}]'::jsonb)
       as r(severity text, if_json jsonb, message_sv text, message_en text, goto_step text);

commit;


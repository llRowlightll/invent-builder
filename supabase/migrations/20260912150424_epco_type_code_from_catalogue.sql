-- EPCO: typkoden enligt Festo Electric cylinders EPCO, with spindle drive, utgåva 2022/07.
-- GENERERAD ur src/lib/catalog/epco.ts -- redigera inte för hand.
--
-- DOKUMENTET VAR INTE BORTA, DET VAR AVPUBLICERAT. Festo har tagit EPCO ur
-- sortimentet och deras sökning ger noll produktinformation, men
-- dokumentnumren löper i bokstavsordning inom en grupp: EPCE är 203026 och
-- EPCS 203028, alltså EPCO 203027. Filen låg kvar på servern.
--
-- Rättar fem fel:
--   1. order_code_template var 'EPCO-{size}-{stroke_mm}-{drive}', som ger
--      "EPCO-16-100-ballscrew". Festos typkod är modulär och ser ut så här:
--      "EPCO-16-50-3P-ST-E".
--   2. 'drive' erbjöd kuggrem, kulskruv och trapetsskruv. EPCO finns BARA med
--      kulskruv -- katalogen, sida 8: "Design: Electric cylinder with ball
--      screw and motor". Positionen efter slaget är SKRUVSTIGNINGEN.
--   3. 'guide' erbjöd glidlager, rullager och kullager. Katalogens position
--      012 har ETT värde: KF, kullagrad styrning med två styrstänger.
--   4. stroke var 1-3000 mm. Katalogen har ELVA DISKRETA slag, 50 till 400,
--      och vilka som finns beror på storleken. 110 mm tillverkas inte.
--   5. Skruvstigningen saknades helt, trots att den är obligatorisk -- och
--      trots att den avgör om cylindern bär 8 eller 24 kg.
--
-- Elva positioner till saknades: kolvstångsgänga, förlängning,
-- positionsavkänning, motortyp, mätsystem, broms, kabelriktning, styrenhet,
-- kabel, styrning, bussprotokoll och in-/utgång.
--
-- KATALOGENS FEM VILLKOR är kravfulla, inte förbjudande, och det är det som
-- gör dem farliga att utelämna: "A måste väljas om E inte är vald" betyder
-- att en EPCO utan pulsgivare och utan givarförberedelse inte är en billigare
-- EPCO -- den går inte att beställa.

begin;

create schema if not exists backup;
create table if not exists backup.epco_before_20260912 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'epco'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'epco'
  union all
  select 'spec', s.id::text, s.key, s.value
  from product_specs s join products p on p.id = s.product_id
  where lower(p.family) = 'epco';


insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-EPCO-V1', '{"version":"1.0","steps":[{"id":"size","step":1,"title_sv":"Storlek","title_en":"Size","required":true,"type":"single_select","options":[{"v":"16","label":"Storlek 16"},{"v":"25","label":"Storlek 25"},{"v":"40","label":"Storlek 40"}]},{"id":"stroke_mm","step":2,"title_sv":"Slaglängd","title_en":"Stroke","required":true,"type":"numeric","min":50,"max":400,"unit":"mm"},{"id":"pitch","step":3,"title_sv":"Skruvstigning","title_en":"Spindle pitch","required":true,"type":"single_select","options":[{"v":"3P","label":"3 mm/varv (storlek 16, 25)"},{"v":"5P","label":"5 mm/varv (storlek 40)"},{"v":"8P","label":"8 mm/varv (storlek 16)"},{"v":"10P","label":"10 mm/varv (storlek 25)"},{"v":"12.7P","label":"12.7 mm/varv (storlek 40)"}]},{"id":"rod_thread","step":4,"title_sv":"Kolvstångsgänga","title_en":"Piston rod thread","required":false,"type":"single_select","options":[{"v":"F","label":"Hongängad kolvstång"}]},{"id":"extension_mm","step":5,"title_sv":"Kolvstångsförlängning","title_en":"Piston rod extension","required":false,"type":"numeric","min":1,"max":200,"unit":"mm"},{"id":"position_sensing","step":6,"title_sv":"Positionsavkänning","title_en":"Position sensing","required":false,"type":"single_select","options":[{"v":"A","label":"För givare"}]},{"id":"measuring","step":7,"title_sv":"Mätsystem","title_en":"Measuring unit","required":false,"type":"single_select","options":[{"v":"E","label":"Pulsgivare"}]},{"id":"brake","step":8,"title_sv":"Broms","title_en":"Brake","required":false,"type":"single_select","options":[{"v":"B","label":"Med broms"}]},{"id":"cable_direction","step":9,"title_sv":"Kabelutgång","title_en":"Cable outlet","required":false,"type":"single_select","options":[{"v":"D","label":"Nedåt"},{"v":"L","label":"Vänster"},{"v":"R","label":"Höger"}]},{"id":"guide_unit","step":10,"title_sv":"Styrenhet","title_en":"Guide unit","required":false,"type":"single_select","options":[{"v":"KF","label":"Kullagrad styrning med två styrstänger"}]},{"id":"cable","step":11,"title_sv":"Motorkabel","title_en":"Motor cable","required":false,"type":"single_select","options":[{"v":"1.5E","label":"1,5 m, rak kontakt"},{"v":"1.5EA","label":"1,5 m, vinklad kontakt"},{"v":"2.5E","label":"2,5 m, rak kontakt"},{"v":"2.5EA","label":"2,5 m, vinklad kontakt"},{"v":"5E","label":"5 m, rak kontakt"},{"v":"5EA","label":"5 m, vinklad kontakt"},{"v":"7E","label":"7 m, rak kontakt"},{"v":"7EA","label":"7 m, vinklad kontakt"},{"v":"10E","label":"10 m, rak kontakt"},{"v":"10EA","label":"10 m, vinklad kontakt"}]},{"id":"controller","step":12,"title_sv":"Styrning","title_en":"Controller","required":false,"type":"single_select","options":[{"v":"C5","label":"CMMO, 5 A"}]},{"id":"bus","step":13,"title_sv":"Bussprotokoll","title_en":"Bus protocol","required":false,"type":"single_select","options":[{"v":"DIO","label":"Digitalt I/O-gränssnitt"},{"v":"LK","label":"IO-Link"}]},{"id":"switching","step":14,"title_sv":"In-/utgång","title_en":"Switching I/O","required":false,"type":"single_select","options":[{"v":"P","label":"PNP"},{"v":"N","label":"NPN"}]}]}'::jsonb,
        'Festo EPCO elcylinder med kulskruv',
        'Festo EPCO electric cylinder with ball screw', 'electric-actuator')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  stroke_min_mm = 50,
  stroke_max_mm = 400,
  order_code_template = 'EPCO-{size}-{stroke_mm}-{pitch}-{rod_thread}-{extension_mm:E}-{position_sensing}-ST-{measuring}-{brake}-{cable_direction}-{guide_unit}-{cable}-{controller}-{bus}-{switching}',
  rules_schema_id = 'SCHEMA-EPCO-V1'
where slug = 'epco';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'epco';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'epco';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"size","label":"Storlek","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"stroke_mm","label":"Slaglängd","param_type":"number","sort_order":2,"required":true,"min_value":50,"max_value":400},{"param_key":"pitch","label":"Skruvstigning","param_type":"select","sort_order":3,"required":true,"min_value":null,"max_value":null},{"param_key":"rod_thread","label":"Kolvstångsgänga","param_type":"select","sort_order":4,"required":false,"min_value":null,"max_value":null},{"param_key":"extension_mm","label":"Kolvstångsförlängning","param_type":"number","sort_order":5,"required":false,"min_value":1,"max_value":200},{"param_key":"position_sensing","label":"Positionsavkänning","param_type":"select","sort_order":6,"required":false,"min_value":null,"max_value":null},{"param_key":"measuring","label":"Mätsystem","param_type":"select","sort_order":7,"required":false,"min_value":null,"max_value":null},{"param_key":"brake","label":"Broms","param_type":"select","sort_order":8,"required":false,"min_value":null,"max_value":null},{"param_key":"cable_direction","label":"Kabelutgång","param_type":"select","sort_order":9,"required":false,"min_value":null,"max_value":null},{"param_key":"guide_unit","label":"Styrenhet","param_type":"select","sort_order":10,"required":false,"min_value":null,"max_value":null},{"param_key":"cable","label":"Motorkabel","param_type":"select","sort_order":11,"required":false,"min_value":null,"max_value":null},{"param_key":"controller","label":"Styrning","param_type":"select","sort_order":12,"required":false,"min_value":null,"max_value":null},{"param_key":"bus","label":"Bussprotokoll","param_type":"select","sort_order":13,"required":false,"min_value":null,"max_value":null},{"param_key":"switching","label":"In-/utgång","param_type":"select","sort_order":14,"required":false,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'epco';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"size","code":"16","label":"Storlek 16","sort_order":0},{"param_key":"size","code":"25","label":"Storlek 25","sort_order":1},{"param_key":"size","code":"40","label":"Storlek 40","sort_order":2},{"param_key":"pitch","code":"3P","label":"3 mm/varv (storlek 16, 25)","sort_order":0},{"param_key":"pitch","code":"5P","label":"5 mm/varv (storlek 40)","sort_order":1},{"param_key":"pitch","code":"8P","label":"8 mm/varv (storlek 16)","sort_order":2},{"param_key":"pitch","code":"10P","label":"10 mm/varv (storlek 25)","sort_order":3},{"param_key":"pitch","code":"12.7P","label":"12.7 mm/varv (storlek 40)","sort_order":4},{"param_key":"rod_thread","code":"F","label":"Hongängad kolvstång","sort_order":0},{"param_key":"position_sensing","code":"A","label":"För givare","sort_order":0},{"param_key":"measuring","code":"E","label":"Pulsgivare","sort_order":0},{"param_key":"brake","code":"B","label":"Med broms","sort_order":0},{"param_key":"cable_direction","code":"D","label":"Nedåt","sort_order":0},{"param_key":"cable_direction","code":"L","label":"Vänster","sort_order":1},{"param_key":"cable_direction","code":"R","label":"Höger","sort_order":2},{"param_key":"guide_unit","code":"KF","label":"Kullagrad styrning med två styrstänger","sort_order":0},{"param_key":"cable","code":"1.5E","label":"1,5 m, rak kontakt","sort_order":0},{"param_key":"cable","code":"1.5EA","label":"1,5 m, vinklad kontakt","sort_order":1},{"param_key":"cable","code":"2.5E","label":"2,5 m, rak kontakt","sort_order":2},{"param_key":"cable","code":"2.5EA","label":"2,5 m, vinklad kontakt","sort_order":3},{"param_key":"cable","code":"5E","label":"5 m, rak kontakt","sort_order":4},{"param_key":"cable","code":"5EA","label":"5 m, vinklad kontakt","sort_order":5},{"param_key":"cable","code":"7E","label":"7 m, rak kontakt","sort_order":6},{"param_key":"cable","code":"7EA","label":"7 m, vinklad kontakt","sort_order":7},{"param_key":"cable","code":"10E","label":"10 m, rak kontakt","sort_order":8},{"param_key":"cable","code":"10EA","label":"10 m, vinklad kontakt","sort_order":9},{"param_key":"controller","code":"C5","label":"CMMO, 5 A","sort_order":0},{"param_key":"bus","code":"DIO","label":"Digitalt I/O-gränssnitt","sort_order":0},{"param_key":"bus","code":"LK","label":"IO-Link","sort_order":1},{"param_key":"switching","code":"P","label":"PNP","sort_order":0},{"param_key":"switching","code":"N","label":"NPN","sort_order":1}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'epco';

delete from config_rules where schema_id = 'SCHEMA-EPCO-V1';

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-EPCO-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{"==":[{"var":"size"},"16"]},{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[50,75,100,125,150,175,200]]}}]},"message_sv":"Storlek 16 finns i slaglängderna 50, 75, 100, 125, 150, 175 och 200 mm. Mellanlängder tillverkas inte.","message_en":"Size 16 is available in strokes 50, 75, 100, 125, 150, 175 and 200 mm. Intermediate lengths are not made.","goto_step":"epco-slag"},{"severity":"error","if_json":{"and":[{"==":[{"var":"size"},"16"]},{"!=":[{"var":"pitch"},""]},{"not":{"in":[{"var":"pitch"},["3P","8P"]]}}]},"message_sv":"Storlek 16 finns med skruvstigning 3 och 8 mm.","message_en":"Size 16 is available with spindle pitch 3 and 8 mm.","goto_step":"epco-stigning"},{"severity":"error","if_json":{"and":[{"==":[{"var":"size"},"16"]},{">":[{"var":"extension_mm"},100]}]},"message_sv":"Kolvstångsförlängningen för storlek 16 går till 100 mm.","message_en":"The piston rod extension for size 16 goes up to 100 mm.","goto_step":"epco-forlangning"},{"severity":"info","if_json":{"and":[{"==":[{"var":"size"},"16"]},{"==":[{"var":"pitch"},"8P"]}]},"message_sv":"Med 8 mm stigning går storlek 16 300 mm/s men bär 8 kg horisontellt och 4 kg vertikalt. Med 3 mm blir det 24 kg respektive 12 kg, vid 125 mm/s.","message_en":"With 8 mm pitch size 16 runs at 300 mm/s but carries 8 kg horizontally and 4 kg vertically. With 3 mm it is 24 and 12 kg, at 125 mm/s.","goto_step":"epco-stigning"},{"severity":"error","if_json":{"and":[{"==":[{"var":"size"},"25"]},{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[50,75,100,125,150,175,200,250,300]]}}]},"message_sv":"Storlek 25 finns i slaglängderna 50, 75, 100, 125, 150, 175, 200, 250 och 300 mm. Mellanlängder tillverkas inte.","message_en":"Size 25 is available in strokes 50, 75, 100, 125, 150, 175, 200, 250 and 300 mm. Intermediate lengths are not made.","goto_step":"epco-slag"},{"severity":"error","if_json":{"and":[{"==":[{"var":"size"},"25"]},{"!=":[{"var":"pitch"},""]},{"not":{"in":[{"var":"pitch"},["3P","10P"]]}}]},"message_sv":"Storlek 25 finns med skruvstigning 3 och 10 mm.","message_en":"Size 25 is available with spindle pitch 3 and 10 mm.","goto_step":"epco-stigning"},{"severity":"error","if_json":{"and":[{"==":[{"var":"size"},"25"]},{">":[{"var":"extension_mm"},150]}]},"message_sv":"Kolvstångsförlängningen för storlek 25 går till 150 mm.","message_en":"The piston rod extension for size 25 goes up to 150 mm.","goto_step":"epco-forlangning"},{"severity":"info","if_json":{"and":[{"==":[{"var":"size"},"25"]},{"==":[{"var":"pitch"},"10P"]}]},"message_sv":"Med 10 mm stigning går storlek 25 500 mm/s men bär 20 kg horisontellt och 10 kg vertikalt. Med 3 mm blir det 60 kg respektive 30 kg, vid 150 mm/s.","message_en":"With 10 mm pitch size 25 runs at 500 mm/s but carries 20 kg horizontally and 10 kg vertically. With 3 mm it is 60 and 30 kg, at 150 mm/s.","goto_step":"epco-stigning"},{"severity":"error","if_json":{"and":[{"==":[{"var":"size"},"40"]},{">":[{"var":"stroke_mm"},0]},{"not":{"in":[{"var":"stroke_mm"},[50,75,100,125,150,175,200,250,300,350,400]]}}]},"message_sv":"Storlek 40 finns i slaglängderna 50, 75, 100, 125, 150, 175, 200, 250, 300, 350 och 400 mm. Mellanlängder tillverkas inte.","message_en":"Size 40 is available in strokes 50, 75, 100, 125, 150, 175, 200, 250, 300, 350 and 400 mm. Intermediate lengths are not made.","goto_step":"epco-slag"},{"severity":"error","if_json":{"and":[{"==":[{"var":"size"},"40"]},{"!=":[{"var":"pitch"},""]},{"not":{"in":[{"var":"pitch"},["5P","12.7P"]]}}]},"message_sv":"Storlek 40 finns med skruvstigning 5 och 12.7 mm.","message_en":"Size 40 is available with spindle pitch 5 and 12.7 mm.","goto_step":"epco-stigning"},{"severity":"error","if_json":{"and":[{"==":[{"var":"size"},"40"]},{">":[{"var":"extension_mm"},200]}]},"message_sv":"Kolvstångsförlängningen för storlek 40 går till 200 mm.","message_en":"The piston rod extension for size 40 goes up to 200 mm.","goto_step":"epco-forlangning"},{"severity":"info","if_json":{"and":[{"==":[{"var":"size"},"40"]},{"==":[{"var":"pitch"},"12.7P"]}]},"message_sv":"Med 12.7 mm stigning går storlek 40 460 mm/s men bär 40 kg horisontellt och 20 kg vertikalt. Med 5 mm blir det 120 kg respektive 60 kg, vid 180 mm/s.","message_en":"With 12.7 mm pitch size 40 runs at 460 mm/s but carries 40 kg horizontally and 20 kg vertically. With 5 mm it is 120 and 60 kg, at 180 mm/s.","goto_step":"epco-stigning"},{"severity":"error","if_json":{"and":[{"!=":[{"var":"size"},""]},{"!=":[{"var":"pitch"},""]},{">":[{"var":"stroke_mm"},0]},{"!=":[{"var":"measuring"},"E"]},{"!=":[{"var":"position_sensing"},"A"]}]},"message_sv":"En EPCO måste veta var kolvstången är. Välj antingen pulsgivare eller förberedelse för givare — utan endera går cylindern inte att beställa.","message_en":"An EPCO must know where the piston rod is. Choose either the encoder or the preparation for proximity switches — without one of them the cylinder cannot be ordered.","goto_step":"epco-matning"},{"severity":"error","if_json":{"and":[{"==":[{"var":"guide_unit"},"KF"]},{">":[{"var":"extension_mm"},0]}]},"message_sv":"Den kullagrade styrningen och en förlängd kolvstång går inte ihop — styrstängerna sitter där förlängningen skulle sitta.","message_en":"The recirculating ball bearing guide and an extended piston rod are mutually exclusive — the guide rods occupy the space.","goto_step":"epco-styrning"},{"severity":"error","if_json":{"and":[{"or":[{"!=":[{"var":"cable"},""]},{"!=":[{"var":"controller"},""]}]},{"!=":[{"var":"measuring"},"E"]}]},"message_sv":"Motorkabel och styrning finns bara tillsammans med pulsgivare. Utan den vet styrningen ingenting om läget.","message_en":"The motor cable and the controller are only available together with the encoder. Without it the controller knows nothing about position.","goto_step":"epco-matning"},{"severity":"error","if_json":{"and":[{"==":[{"var":"controller"},"C5"]},{"or":[{"==":[{"var":"bus"},""]},{"==":[{"var":"switching"},""]}]}]},"message_sv":"Väljs styrningen CMMO måste både bussprotokoll och in-/utgångstyp anges. Styrningen levereras konfigurerad.","message_en":"If the CMMO controller is selected, both the bus protocol and the switching input/output must be specified. The controller ships configured.","goto_step":"epco-buss"},{"severity":"error","if_json":{"and":[{"==":[{"var":"switching"},"N"]},{"==":[{"var":"bus"},"LK"]}]},"message_sv":"NPN går inte ihop med IO-Link. Välj PNP, eller byt bussprotokoll till digitalt I/O.","message_en":"NPN is not available with IO-Link. Choose PNP, or switch the bus protocol to digital I/O.","goto_step":"epco-buss"}]'::jsonb) r;


update products set
  name = 'Festo EPCO-16 elcylinder, 50 mm slag, kulskruv 3 mm/varv',
  description = 'Elcylinder med kulskruv och stegmotor. Typkod EPCO-16-50-3P-ST-E. '
    || 'Matningskraft 125 N, 125 mm/s, nyttolast '
    || '24 kg horisontellt och 12 kg vertikalt. '
    || 'Upprepningsnoggrannhet ±0.02 mm.',
  updated_at = now()
where sku = 'FESTO-1476415';

delete from product_specs
where product_id = (select id from products where sku = 'FESTO-1476415')
  and key in ('type_code','bore_mm','stroke_mm','spindle_pitch_mm','feed_force_n',
              'max_speed_mms','payload_horizontal_kg','payload_vertical_kg',
              'repetition_accuracy_mm','reversing_backlash_mm','max_acceleration_ms2',
              'nominal_voltage','motor_type','piston_rod_thread');

insert into product_specs (product_id, key, value)
select p.id, v.key, v.value
from products p
cross join lateral (values
  ('type_code', 'EPCO-16-50-3P-ST-E'),
  ('size', '16'),
  ('stroke_mm', '50'),
  ('spindle_pitch_mm', '3'),
  ('spindle_diameter_mm', '8'),
  ('feed_force_n', '125'),
  ('max_speed_mms', '125'),
  ('payload_horizontal_kg', '24'),
  ('payload_vertical_kg', '12'),
  ('repetition_accuracy_mm', '±0.02'),
  ('reversing_backlash_mm', '0.1'),
  ('max_acceleration_ms2', '10'),
  ('nominal_voltage', '24 V DC'),
  ('motor_type', 'Stegmotor'),
  ('drive', 'Ball screw'),
  ('piston_rod_thread', 'M6')
) as v(key, value)
where p.sku = 'FESTO-1476415';

commit;


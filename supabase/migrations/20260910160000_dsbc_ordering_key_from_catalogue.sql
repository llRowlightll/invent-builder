-- DSBC: beställnyckeln enligt Standards-based cylinders DSBC, to ISO 15552, utgåva 2026/09.
-- GENERERAD ur src/lib/catalog/dsbc.ts -- redigera inte för hand.
--
-- Rättar tre fel som legat i produktion sedan katalogen lästes in 2026-05-19:
--   1. Optionerna S2, KP, S6 och TT fanns valbara men förekommer inte i Festos
--      katalog -- en kund kunde konfigurera en obeställbar orderkod.
--   2. stroke_max_mm var 2000; katalogen säger 2800.
--   3. Beställnyckeln modellerades med 5 parametrar; den har 20 positioner.
--
-- Lägger dessutom in katalogens 18 villkor i config_rules, som den befintliga
-- configurator-engine redan kan köra men aldrig fick några regler för.

begin;

create table if not exists backup.dsbc_before_20260910 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'dsbc'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'dsbc';


-- Familjen: rätt slagintervall och en mall som faktiskt speglar positionerna.
update configurator_families set
  stroke_min_mm = 1,
  stroke_max_mm = 2800,
  order_code_template = 'DSBC-{bore_mm}-{stroke_mm}-{profile}-{cushioning}{sensing}-{standard_conformity}',
  standard = 'ISO 15552'
where slug = 'dsbc';


-- Ut med den handskrivna modellen, in med katalogens positioner.
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'dsbc';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'dsbc';


alter table configurator_params
  add column if not exists min_value numeric,
  add column if not exists max_value numeric;

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"rotation_lock","label":"Vridskydd","param_type":"select","sort_order":1,"required":false,"min_value":null,"max_value":null},{"param_key":"running","label":"Gångegenskaper","param_type":"select","sort_order":2,"required":false,"min_value":null,"max_value":null},{"param_key":"bore_mm","label":"Kolvdiameter","param_type":"select","sort_order":3,"required":true,"min_value":null,"max_value":null},{"param_key":"stroke_mm","label":"Slaglängd","param_type":"number","sort_order":4,"required":true,"min_value":1,"max_value":2800},{"param_key":"clamping","label":"Klämenhet","param_type":"select","sort_order":5,"required":false,"min_value":null,"max_value":null},{"param_key":"end_lock","label":"Ändlägeslåsning","param_type":"select","sort_order":6,"required":false,"min_value":null,"max_value":null},{"param_key":"rod_type","label":"Kolvstångstyp","param_type":"select","sort_order":7,"required":false,"min_value":null,"max_value":null},{"param_key":"rod_thread","label":"Kolvstångsgänga","param_type":"select","sort_order":8,"required":false,"min_value":null,"max_value":null},{"param_key":"profile","label":"Profiltyp","param_type":"select","sort_order":9,"required":false,"min_value":null,"max_value":null},{"param_key":"cushioning","label":"Dämpning","param_type":"select","sort_order":10,"required":true,"min_value":null,"max_value":null},{"param_key":"sensing","label":"Lägesavkänning","param_type":"select","sort_order":11,"required":false,"min_value":null,"max_value":null},{"param_key":"standard_conformity","label":"Standard","param_type":"select","sort_order":12,"required":false,"min_value":null,"max_value":null},{"param_key":"corrosion","label":"Korrosionsskydd","param_type":"select","sort_order":13,"required":false,"min_value":null,"max_value":null},{"param_key":"temperature","label":"Temperaturområde","param_type":"select","sort_order":14,"required":false,"min_value":null,"max_value":null},{"param_key":"particles","label":"Partikelskydd","param_type":"select","sort_order":15,"required":false,"min_value":null,"max_value":null},{"param_key":"scraper","label":"Avstrykarvariant","param_type":"select","sort_order":16,"required":false,"min_value":null,"max_value":null},{"param_key":"material","label":"Särskilda materialegenskaper","param_type":"select","sort_order":17,"required":false,"min_value":null,"max_value":null},{"param_key":"eu_cert","label":"EU-certifiering","param_type":"select","sort_order":18,"required":false,"min_value":null,"max_value":null},{"param_key":"stroke_adjust_mm","label":"Slagjustering, utgående","param_type":"number","sort_order":19,"required":false,"min_value":0,"max_value":50},{"param_key":"rod_extension_mm","label":"Kolvstångsförlängning","param_type":"number","sort_order":20,"required":false,"min_value":0,"max_value":500},{"param_key":"rod_thread_extension_mm","label":"Gängförlängning på kolvstång","param_type":"number","sort_order":21,"required":false,"min_value":0,"max_value":70}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'dsbc';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"rotation_lock","code":"Q","label":"Med vridskydd","sort_order":0},{"param_key":"running","code":"L","label":"Låg friktion","sort_order":0},{"param_key":"running","code":"U","label":"Jämn, långsam rörelse","sort_order":1},{"param_key":"running","code":"L1","label":"Låg friktion för balanserapplikationer","sort_order":2},{"param_key":"bore_mm","code":"32","label":"mm","sort_order":0},{"param_key":"bore_mm","code":"40","label":"mm","sort_order":1},{"param_key":"bore_mm","code":"50","label":"mm","sort_order":2},{"param_key":"bore_mm","code":"63","label":"mm","sort_order":3},{"param_key":"bore_mm","code":"80","label":"mm","sort_order":4},{"param_key":"bore_mm","code":"100","label":"mm","sort_order":5},{"param_key":"bore_mm","code":"125","label":"mm","sort_order":6},{"param_key":"clamping","code":"C","label":"Påbyggd klämenhet","sort_order":0},{"param_key":"end_lock","code":"E1","label":"Båda sidor","sort_order":0},{"param_key":"end_lock","code":"E2","label":"Med utskjuten kolvstång","sort_order":1},{"param_key":"end_lock","code":"E3","label":"Med indragen kolvstång","sort_order":2},{"param_key":"rod_type","code":"T","label":"Genomgående kolvstång","sort_order":0},{"param_key":"rod_thread","code":"F","label":"Invändig gänga","sort_order":0},{"param_key":"profile","code":"D3","label":"Givarspår på tre sidor","sort_order":0},{"param_key":"cushioning","code":"P","label":"Elastiska dämpringar i båda ändar","sort_order":0},{"param_key":"cushioning","code":"PPS","label":"Pneumatisk dämpning, självjusterande i båda ändar","sort_order":1},{"param_key":"cushioning","code":"PPV","label":"Pneumatisk dämpning, justerbar i båda ändar","sort_order":2},{"param_key":"sensing","code":"A","label":"För cylindergivare","sort_order":0},{"param_key":"standard_conformity","code":"N3","label":"Uppfyller ISO 15552","sort_order":0},{"param_key":"corrosion","code":"R3","label":"Högt korrosionsskydd","sort_order":0},{"param_key":"temperature","code":"T1","label":"Värmetåliga tätningar max 120 °C","sort_order":0},{"param_key":"temperature","code":"T3","label":"−40 … +80 °C","sort_order":1},{"param_key":"temperature","code":"T4","label":"0 … +150 °C","sort_order":2},{"param_key":"particles","code":"P2","label":"Bälg på lagerlocket","sort_order":0},{"param_key":"scraper","code":"A1","label":"Ökad kemikalieresistens","sort_order":0},{"param_key":"scraper","code":"A2","label":"Hård avstrykare","sort_order":1},{"param_key":"scraper","code":"A3","label":"För osmord drift","sort_order":2},{"param_key":"scraper","code":"A6","label":"Metallavstrykare","sort_order":3},{"param_key":"material","code":"F1A","label":"Rekommenderad för tillverkning av litiumjonbatterier","sort_order":0},{"param_key":"eu_cert","code":"EX4","label":"II 2GD (ATEX)","sort_order":0}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'dsbc';


delete from config_rules where schema_id = 'SCHEMA-DSBC-V1';

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-DSBC-V1', r.severity, r.if_json, r.message_sv, r.message_en, r.goto_step
from jsonb_to_recordset('[{"severity":"error","if_json":{"and":[{"==":[{"var":"rotation_lock"},"Q"]},{">":[{"var":"stroke_mm"},1500]}]},"message_sv":"Vridskydd Q går bara upp till 1500 mm slaglängd.","message_en":"Protection against rotation Q is only available up to 1500 mm stroke.","goto_step":"1"},{"severity":"error","if_json":{"and":[{"in":[{"var":"running"},["L","U"]]},{"==":[{"var":"rotation_lock"},"Q"]}]},"message_sv":"Gångegenskaperna L och U kan inte kombineras med vridskydd Q.","message_en":"Running characteristics L and U cannot be combined with Q.","goto_step":"2"},{"severity":"error","if_json":{"and":[{"==":[{"var":"running"},"L1"]},{">":[{"var":"stroke_mm"},1000]}]},"message_sv":"L1 (balanserapplikationer) går bara upp till 1000 mm slaglängd.","message_en":"L1 (balancer applications) is only available up to 1000 mm stroke.","goto_step":"3"},{"severity":"error","if_json":{"and":[{"==":[{"var":"rod_type"},"T"]},{"in":[{"var":"running"},["L","U"]]}]},"message_sv":"Genomgående kolvstång T kan inte kombineras med L eller U.","message_en":"Through piston rod T cannot be combined with L or U.","goto_step":"4"},{"severity":"error","if_json":{"and":[{"or":[{"==":[{"var":"rod_type"},"T"]},{"==":[{"var":"cushioning"},"PPV"]}]},{"==":[{"var":"running"},"L1"]}]},"message_sv":"Genomgående kolvstång T och dämpning PPV kan inte kombineras med L1.","message_en":"Through piston rod T and PPV cushioning cannot be combined with L1.","goto_step":"5"},{"severity":"error","if_json":{"and":[{"==":[{"var":"rod_thread"},"F"]},{"==":[{"var":"standard_conformity"},"N3"]}]},"message_sv":"Invändig kolvstångsgänga F kan inte kombineras med N3.","message_en":"Female piston rod thread F cannot be combined with N3.","goto_step":"6a"},{"severity":"error","if_json":{"and":[{"or":[{"==":[{"var":"corrosion"},"R3"]},{"in":[{"var":"temperature"},["T1","T3","T4"]]},{"==":[{"var":"particles"},"P2"]},{"in":[{"var":"scraper"},["A1","A2","A3","A6"]]},{"==":[{"var":"eu_cert"},"EX4"]}]},{"in":[{"var":"running"},["L","U","L1"]]}]},"message_sv":"R3, T1/T3/T4, P2, A1/A2/A3/A6 och EX4 kan inte kombineras med gångegenskaperna L, U eller L1.","message_en":"R3, T1/T3/T4, P2, A1/A2/A3/A6 and EX4 cannot be combined with L, U or L1.","goto_step":"6b"},{"severity":"error","if_json":{"and":[{"or":[{"in":[{"var":"temperature"},["T1","T3","T4"]]},{"==":[{"var":"scraper"},"A1"]}]},{"==":[{"var":"cushioning"},"PPS"]}]},"message_sv":"T1/T3/T4 och A1 kan inte kombineras med självjusterande dämpning PPS.","message_en":"T1/T3/T4 and A1 cannot be combined with PPS cushioning.","goto_step":"7"},{"severity":"error","if_json":{"and":[{"or":[{"in":[{"var":"temperature"},["T3","T4"]]},{"==":[{"var":"particles"},"P2"]},{"in":[{"var":"scraper"},["A1","A2","A3","A6"]]}]},{"==":[{"var":"rotation_lock"},"Q"]}]},"message_sv":"T3/T4, P2 och A1/A2/A3/A6 kan inte kombineras med vridskydd Q.","message_en":"T3/T4, P2 and A1/A2/A3/A6 cannot be combined with Q.","goto_step":"8"},{"severity":"error","if_json":{"and":[{"or":[{"==":[{"var":"particles"},"P2"]},{">":[{"var":"rod_extension_mm"},0]},{">":[{"var":"rod_thread_extension_mm"},0]}]},{"==":[{"var":"standard_conformity"},"N3"]}]},"message_sv":"Bälg P2 och kolvstångsförlängning kan inte kombineras med N3.","message_en":"Bellows P2 and piston rod extensions cannot be combined with N3.","goto_step":"9"},{"severity":"error","if_json":{"and":[{"or":[{"==":[{"var":"particles"},"P2"]},{"in":[{"var":"scraper"},["A1","A2","A3"]]},{"==":[{"var":"eu_cert"},"EX4"]}]},{"in":[{"var":"temperature"},["T1","T3","T4"]]}]},"message_sv":"P2, A1/A2/A3 och EX4 kan inte kombineras med T1, T3 eller T4.","message_en":"P2, A1/A2/A3 and EX4 cannot be combined with T1, T3 or T4.","goto_step":"10"},{"severity":"error","if_json":{"and":[{"==":[{"var":"particles"},"P2"]},{">":[{"var":"stroke_mm"},500]}]},"message_sv":"Bälg P2 går bara upp till 500 mm slaglängd.","message_en":"Bellows P2 is only available up to 500 mm stroke.","goto_step":"11"},{"severity":"error","if_json":{"and":[{"==":[{"var":"scraper"},"A1"]},{"==":[{"var":"cushioning"},"P"]}]},"message_sv":"Avstrykare A1 kan inte kombineras med elastisk dämpning P.","message_en":"Scraper A1 cannot be combined with elastic cushioning P.","goto_step":"12"},{"severity":"error","if_json":{"and":[{"or":[{"in":[{"var":"scraper"},["A1","A2","A3","A6"]]},{"==":[{"var":"eu_cert"},"EX4"]}]},{"==":[{"var":"particles"},"P2"]}]},"message_sv":"A1/A2/A3/A6 och EX4 kan inte kombineras med bälg P2.","message_en":"A1/A2/A3/A6 and EX4 cannot be combined with bellows P2.","goto_step":"13"},{"severity":"error","if_json":{"and":[{"in":[{"var":"scraper"},["A1","A3","A6"]]},{"==":[{"var":"eu_cert"},"EX4"]}]},"message_sv":"Avstrykare A1, A3 och A6 kan inte kombineras med EX4.","message_en":"Scrapers A1, A3 and A6 cannot be combined with EX4.","goto_step":"14"},{"severity":"error","if_json":{"and":[{"in":[{"var":"scraper"},["A2","A6"]]},{"==":[{"var":"corrosion"},"R3"]}]},"message_sv":"Avstrykare A2 och A6 kan inte kombineras med korrosionsskydd R3.","message_en":"Scrapers A2 and A6 cannot be combined with R3.","goto_step":"15"},{"severity":"error","if_json":{"and":[{"or":[{">":[{"var":"rod_extension_mm"},0]},{">":[{"var":"rod_thread_extension_mm"},0]}]},{">":[{"var":"stroke_mm"},2000]}]},"message_sv":"Kolvstångsförlängning går bara upp till 2000 mm slaglängd.","message_en":"Piston rod extensions are only available up to 2000 mm stroke.","goto_step":"16"},{"severity":"error","if_json":{"and":[{">":[{"var":"rod_thread_extension_mm"},0]},{"==":[{"var":"rod_thread"},"F"]}]},"message_sv":"Gängförlängning kan inte kombineras med invändig gänga F.","message_en":"Thread extension cannot be combined with female thread F.","goto_step":"17"},{"severity":"error","if_json":{"and":[{">":[{"var":"stroke_adjust_mm"},0]},{"or":[{">":[{"var":"stroke_mm"},1500]},{"and":[{"==":[{"var":"rotation_lock"},"Q"]},{"==":[{"var":"clamping"},"C"]}]},{"in":[{"var":"running"},["L","U","L1"]]},{"==":[{"var":"standard_conformity"},"N3"]},{"in":[{"var":"temperature"},["T1","T3","T4"]]},{"in":[{"var":"scraper"},["A1","A2","A6"]]},{"==":[{"var":"eu_cert"},"EX4"]}]}]},"message_sv":"Slagjustering KE går bara upp till 1500 mm och kan inte kombineras med Q+C, L/U/L1, N3, T1/T3/T4, A1/A2/A6 eller EX4.","message_en":"Stroke adjustment KE is limited to 1500 mm and cannot be combined with Q+C, L/U/L1, N3, T1/T3/T4, A1/A2/A6 or EX4.","goto_step":"18"},{"severity":"error","if_json":{"and":[{">":[{"var":"stroke_adjust_mm"},25]},{"==":[{"var":"bore_mm"},"32"]}]},"message_sv":"Slagjusteringen är max 25 mm för Ø32.","message_en":"Stroke adjustment is limited to 25 mm for Ø32.","goto_step":"18b"},{"severity":"error","if_json":{"and":[{">":[{"var":"rod_thread_extension_mm"},35]},{"in":[{"var":"bore_mm"},["32","40"]]}]},"message_sv":"Gängförlängningen är max 35 mm för Ø32 och Ø40.","message_en":"Thread extension is limited to 35 mm for Ø32 and Ø40.","goto_step":"20"},{"severity":"warn","if_json":{"and":[{"==":[{"var":"cushioning"},"P"]},{">":[{"var":"speed_ms"},0.3]}]},"message_sv":"Elastisk dämpning P är avsedd för låga hastigheter (<0,3 m/s). Välj PPV eller PPS.","message_en":"Elastic cushioning P is intended for low speeds (<0.3 m/s). Choose PPV or PPS.","goto_step":null},{"severity":"info","if_json":{">=":[{"var":"bore_mm"},80]},"message_sv":"Ø80 mm och uppåt: kontrollera portdimension G3/4 och flödesventilernas dimensionering.","message_en":"Ø80 mm and above: check port size G3/4 and flow valve sizing.","goto_step":null}]'::jsonb)
       as r(severity text, if_json jsonb, message_sv text, message_en text, goto_step text);


update config_rules set severity = 'warn' where severity = 'warning';

alter table configurator_families
  add column if not exists rules_schema_id text references config_schemas(schema_id);
update configurator_families set rules_schema_id = 'SCHEMA-DSBC-V1' where slug = 'dsbc';

-- Produktkatalogens DSBC-rader. FESTO-1463250 är enligt katalogens
-- "Module no."-rad modulnumret för Ø32 -- inte hela familjen. Den låg med
-- bore "32-100", alltså familjens intervall på en rad som betecknar en storlek.
update product_specs s set value = '32'
where s.key = 'bore_mm'
  and s.product_id = (select id from products where sku = 'FESTO-1463250');

-- Familjeraden saknade Ø125 (katalogen har sju storlekar, inte sex).
update product_specs s set value = '32,40,50,63,80,100,125'
where s.key = 'bore_mm'
  and s.product_id = (select id from products where sku = 'FESTO-DSBC');

commit;


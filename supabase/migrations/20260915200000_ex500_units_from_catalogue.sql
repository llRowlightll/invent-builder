-- Speglar det som lades på databasen 2026-09-15 via apply_migration i två delar:
--   ex500_units_from_catalogue_part_01  (backup, schema, familj, parametrar, värdelista, regler, dokumentkarta, SMC-EX500-Q011 -> SMC-EX500-GEN2)
--   ex500_units_from_catalogue_part_02  (produktspecar)
-- Fingeravtryck efter körning, identiska med modellen (scripts/fingerprint-rules.ts ex500):
--   regler  12   md5 03b5ef5e452e40871668dadb33f48f2c   villkor 814585f5875ee45a43a695465e5e48e1
--   värden  17   md5 612d6d1fbfb098f0e73ecbd6859b84f6
--   schema       md5 2c4c1437d302579f63b1125e040f3614
-- Verifierat live: /sv/configurator/ex500 stoppar EX500-G tills protokollet väljs och bygger
-- EX500-GEN2 (sida 1449), EX500-AC030-SSPS och EX500-ACY01-S (sida 1457).
--
-- EX500: beställnycklarna enligt SMC Fieldbus System EX500 Series, Gateway Decentralized System 2 (128 Points).
-- GENERERAD ur src/lib/catalog/ex500.ts -- redigera inte för hand.
--
-- Rättar familjen ex500, som hade mallen 'EX500-{stations}-{fieldbus}-{voltage}'
-- med protokoll (EtherCAT, IO-Link, PROFIBUS, multipin) och spänningar (230 V AC)
-- som systemet inte har. EX500 typ 2 är enheter runt en gateway, var och en med
-- egen nyckel: EX500-G{EN2|PN2}, EX500-S103, EX500-DXP{A|B}, EX500-AC{längd}-{kontakter},
-- EX500-ACY01-S (sida 1449–1457). Konfiguratorn bygger en enhet i taget.
--
-- SMC-EX500-Q011 (påhittat, "4 stationer") döps om till SMC-EX500-GEN2.

begin;

create schema if not exists backup;
create table if not exists backup.ex500_before_20260915 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'ex500'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'ex500'
  union all
  select 'family', f.id::text, f.slug, coalesce(f.order_code_template, '')
  from configurator_families f where f.slug = 'ex500';

insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values ('SCHEMA-EX500-V1', '{"version":"1.0","steps":[{"id":"unit","step":1,"title_sv":"Enhet","title_en":"Unit","required":true,"type":"single_select","options":[{"v":"G","label":"Gateway-enhet (GW): 4 grenportar, 128 ingångar/128 utgångar, webbserver"},{"v":"S103","label":"SI-enhet: utgångsenhet för ventilrampen (SY, VQC, S0700, SV, ZK2□A), 16 eller 32 utgångar PNP"},{"v":"DXP","label":"Ingångsenhet: 16 PNP-ingångar"},{"v":"AC","label":"Grenkabel GW-enhet ↔ SI-/ingångsenhet, M12 8-polig A-kodad"},{"v":"ACY01-S","label":"Y-grenkontakt för separat ventilmatning till SI-enheten"}]},{"id":"protocol","step":2,"title_sv":"Protokoll (gateway-enheten)","title_en":"Protocol (gateway unit)","required":false,"type":"single_select","options":[{"v":"EN2","label":"EtherNet/IP: 100BASE-TX 10/100 Mbit/s, DLR, QuickConnect, EDS-fil, 20/20 byte I/O"},{"v":"PN2","label":"PROFINET IO: 100BASE-TX 100 Mbit/s, MRP, Fast Start Up, GSDML-fil, 18/16 byte I/O"}]},{"id":"connector","step":3,"title_sv":"Kontakttyp (ingångsenheten)","title_en":"Connector type (input unit)","required":false,"type":"single_select","options":[{"v":"A","label":"M8-kontakter, 3-poliga (16 st), 250 g"},{"v":"B","label":"M12-kontakter, 5-poliga (16 st), 450 g"}]},{"id":"length","step":4,"title_sv":"Kabellängd (grenkabeln)","title_en":"Cable length (branch cable)","required":false,"type":"single_select","options":[{"v":"003","label":"300 mm"},{"v":"005","label":"500 mm"},{"v":"010","label":"1000 mm"},{"v":"030","label":"3000 mm"},{"v":"050","label":"5000 mm"},{"v":"100","label":"10 000 mm"}]},{"id":"cable_conn","step":5,"title_sv":"Kontaktutförande (grenkabeln)","title_en":"Connector specification (branch cable)","required":false,"type":"single_select","options":[{"v":"SSPS","label":"Rak hylsa och rak plugg"},{"v":"SAPA","label":"Vinklad hylsa och vinklad plugg"}]}]}'::jsonb,
        'SMC EX500 fältbussystem, gateway-decentraliserat (128 punkter)', 'SMC EX500 fieldbus system, gateway decentralized (128 points)', 'valve-terminal')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  title = 'Fältbussystem: gateway-enhet, SI-enhet, ingångsenhet, grenkabel',
  description = 'SMC EX500 Gateway Decentralized System 2: gateway unit (EtherNet/IP or PROFINET, 128/128 points), SI units for SY/VQC/S0700/SV manifolds, 16-input units, branch cables and Y branch connectors.',
  stroke_min_mm = null,
  stroke_max_mm = null,
  order_code_template = 'EX500-{unit}{protocol}{connector}{length}-{cable_conn}',
  rules_schema_id = 'SCHEMA-EX500-V1'
where slug = 'ex500';


delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'ex500';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'ex500';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset('[{"param_key":"unit","label":"Enhet","param_type":"select","sort_order":1,"required":true,"min_value":null,"max_value":null},{"param_key":"protocol","label":"Protokoll (gateway-enheten)","param_type":"select","sort_order":2,"required":false,"min_value":null,"max_value":null},{"param_key":"connector","label":"Kontakttyp (ingångsenheten)","param_type":"select","sort_order":3,"required":false,"min_value":null,"max_value":null},{"param_key":"length","label":"Kabellängd (grenkabeln)","param_type":"select","sort_order":4,"required":false,"min_value":null,"max_value":null},{"param_key":"cable_conn","label":"Kontaktutförande (grenkabeln)","param_type":"select","sort_order":5,"required":false,"min_value":null,"max_value":null}]'::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'ex500';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset('[{"param_key":"unit","code":"G","label":"Gateway-enhet (GW): 4 grenportar, 128 ingångar/128 utgångar, webbserver","sort_order":0},{"param_key":"unit","code":"S103","label":"SI-enhet: utgångsenhet för ventilrampen (SY, VQC, S0700, SV, ZK2□A), 16 eller 32 utgångar PNP","sort_order":1},{"param_key":"unit","code":"DXP","label":"Ingångsenhet: 16 PNP-ingångar","sort_order":2},{"param_key":"unit","code":"AC","label":"Grenkabel GW-enhet ↔ SI-/ingångsenhet, M12 8-polig A-kodad","sort_order":3},{"param_key":"unit","code":"ACY01-S","label":"Y-grenkontakt för separat ventilmatning till SI-enheten","sort_order":4},{"param_key":"protocol","code":"EN2","label":"EtherNet/IP: 100BASE-TX 10/100 Mbit/s, DLR, QuickConnect, EDS-fil, 20/20 byte I/O","sort_order":0},{"param_key":"protocol","code":"PN2","label":"PROFINET IO: 100BASE-TX 100 Mbit/s, MRP, Fast Start Up, GSDML-fil, 18/16 byte I/O","sort_order":1},{"param_key":"connector","code":"A","label":"M8-kontakter, 3-poliga (16 st), 250 g","sort_order":0},{"param_key":"connector","code":"B","label":"M12-kontakter, 5-poliga (16 st), 450 g","sort_order":1},{"param_key":"length","code":"003","label":"300 mm","sort_order":0},{"param_key":"length","code":"005","label":"500 mm","sort_order":1},{"param_key":"length","code":"010","label":"1000 mm","sort_order":2},{"param_key":"length","code":"030","label":"3000 mm","sort_order":3},{"param_key":"length","code":"050","label":"5000 mm","sort_order":4},{"param_key":"length","code":"100","label":"10 000 mm","sort_order":5},{"param_key":"cable_conn","code":"SSPS","label":"Rak hylsa och rak plugg","sort_order":0},{"param_key":"cable_conn","code":"SAPA","label":"Vinklad hylsa och vinklad plugg","sort_order":1}]'::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'ex500';

delete from config_rules where schema_id = 'SCHEMA-EX500-V1';


insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-EX500-V1', r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements('[{"severity":"error","if_json":{"and":[{"in":[{"var":"unit"},["G"]]},{"==":[{"var":"protocol"},""]}]},"message_sv":"Gateway-enheten beställs med protokoll: EN2 eller PN2 (sida 1449).","message_en":"The gateway unit is ordered with a protocol: EN2 or PN2 (page 1449).","goto_step":"ex500-protocol"},{"severity":"error","if_json":{"and":[{"in":[{"var":"unit"},["S103","DXP","AC","ACY01-S"]]},{"!=":[{"var":"protocol"},""]}]},"message_sv":"Protokollet hör till gateway-enheten G — SI-enhet, ingångsenhet och kablar har inget protokoll (sida 1449).","message_en":"The protocol belongs to the gateway unit G — the SI unit, input unit and cables have no protocol (page 1449).","goto_step":"ex500-protocol"},{"severity":"error","if_json":{"and":[{"in":[{"var":"unit"},["DXP"]]},{"==":[{"var":"connector"},""]}]},"message_sv":"Ingångsenheten beställs med kontakttyp: A (M8) eller B (M12) (sida 1452).","message_en":"The input unit is ordered with a connector type: A (M8) or B (M12) (page 1452).","goto_step":"ex500-connector"},{"severity":"error","if_json":{"and":[{"in":[{"var":"unit"},["G","S103","AC","ACY01-S"]]},{"!=":[{"var":"connector"},""]}]},"message_sv":"Kontakttypen A/B hör till ingångsenheten DXP (sida 1452).","message_en":"The connector type A/B belongs to the input unit DXP (page 1452).","goto_step":"ex500-connector"},{"severity":"error","if_json":{"and":[{"in":[{"var":"unit"},["AC"]]},{"or":[{"==":[{"var":"length"},""]},{"==":[{"var":"cable_conn"},""]}]}]},"message_sv":"Grenkabeln beställs med längd (003/005/010/030/050/100) och kontaktutförande (SSPS eller SAPA) (sida 1457).","message_en":"The branch cable is ordered with a length (003/005/010/030/050/100) and a connector specification (SSPS or SAPA) (page 1457).","goto_step":"ex500-length"},{"severity":"error","if_json":{"and":[{"in":[{"var":"unit"},["G","S103","DXP","ACY01-S"]]},{"or":[{"!=":[{"var":"length"},""]},{"!=":[{"var":"cable_conn"},""]}]}]},"message_sv":"Kabellängd och kontaktutförande hör till grenkabeln AC (sida 1457).","message_en":"Cable length and connector specification belong to the branch cable AC (page 1457).","goto_step":"ex500-length"},{"severity":"info","if_json":{"==":[{"var":"unit"},"G"]},"message_sv":"GW-enheten: 24 V DC (styrning ±10 %, ventiler +10/−5 %), max 6,2 A varav 1,5 A per gren; 4 grenportar med 32 in-/32 utgångar var, grenkabel max 20 m; IP65, -10…50 °C; konfigurationsfil EDS (EN2) eller GSDML (PN2) från smcworld.com (sida 1449).","message_en":"The GW unit: 24 V DC (control ±10 %, valves +10/−5 %), max 6.2 A of which 1.5 A per branch; 4 branch ports with 32 inputs/32 outputs each, branch cable max 20 m; IP65, -10…50 °C; configuration file EDS (EN2) or GSDML (PN2) from smcworld.com (page 1449).","goto_step":"ex500-unit"},{"severity":"info","if_json":{"==":[{"var":"unit"},"S103"]},"message_sv":"SI-enheten: 16 eller 32 utgångar via inbyggd omkopplare, PNP med negativ common, 24 V DC; 1,0 A från GW-enheten eller 1,5 A med Y-grenkontakt och egen matning; IP67; monteringsskruvar M3×30 medföljer (sida 1451).","message_en":"The SI unit: 16 or 32 outputs via the built-in setting switch, PNP with negative common, 24 V DC; 1.0 A from the GW unit or 1.5 A with the Y branch connector and separate supply; IP67; M3×30 mounting screws included (page 1451).","goto_step":"ex500-unit"},{"severity":"info","if_json":{"==":[{"var":"unit"},"DXP"]},"message_sv":"Ingångsenheten: 16 PNP-ingångar, 24 V DC, max 1,3 A per enhet (0,65 A per jämn respektive udda kontaktgrupp), tillslag ≥ 11 V; IP67; DIN-skenefäste EX500-ZMA1 beställs separat (sida 1452).","message_en":"The input unit: 16 PNP inputs, 24 V DC, max 1.3 A per unit (0.65 A per even and odd connector group), ON at ≥ 11 V; IP67; the DIN rail bracket EX500-ZMA1 is ordered separately (page 1452).","goto_step":"ex500-unit"},{"severity":"info","if_json":{"==":[{"var":"unit"},"AC"]},"message_sv":"Grenkabeln: ø6 mm, 0,25 mm², minsta böjradie 40 mm, M12 8-polig A-kodad hylsa mot GW-enheten och plugg mot enheten (sida 1457).","message_en":"The branch cable: ø6 mm, 0.25 mm², minimum bending radius 40 mm, M12 8-pin A-coded socket towards the GW unit and plug towards the unit (page 1457).","goto_step":"ex500-unit"},{"severity":"info","if_json":{"==":[{"var":"unit"},"ACY01-S"]},"message_sv":"Y-grenkontakten sätts mellan grenkabeln och SI-enheten och matar ventilerna med 24 V DC +10/−5 % från en egen matningskabel EX500-AP□-S (sida 1457).","message_en":"The Y branch connector sits between the branch cable and the SI unit and supplies the valves with 24 V DC +10/−5 % from a separate power cable EX500-AP□-S (page 1457).","goto_step":"ex500-unit"},{"severity":"info","if_json":{"!=":[{"var":"unit"},""]},"message_sv":"Systemet: 128 ingångar/128 utgångar, max 8 ventilramper och 8 ingångsenheter (max 2 per gren); ventiler SY3000/5000/7000, VQC1000–5000, S0700, SV1000–3000 och vakuumenheten ZK2□A — bara SY och SV är UL-godkända (sida 1448).","message_en":"The system: 128 inputs/128 outputs, max 8 valve manifolds and 8 input units (max 2 per branch); valves SY3000/5000/7000, VQC1000–5000, S0700, SV1000–3000 and the ZK2□A vacuum unit — only SY and SV are UL-compliant (page 1448).","goto_step":"ex500-unit"}]'::jsonb) r;

insert into knowledge_doc_families (source_file, family_slug, doc_title)
values ('smc-kat-ex500.pdf', 'ex500', 'SMC — SMC Fieldbus System EX500 Series, Gateway Decentralized System 2 (128 Points)')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;


update products set
  sku = 'SMC-EX500-GEN2',
  name = 'EX500-GEN2 – Gateway Unit, EtherNet/IP (Gateway Decentralized System 2)',
  family = 'EX500',
  description = 'Gateway unit for the EX500 decentralized fieldbus system: EtherNet/IP, 128 inputs/128 outputs, 4 branch ports for SI units (valve manifolds) and input units, web server, IP65.',
  fieldbus = 'EtherNet/IP',
  voltage = '24 VDC',
  ip_rating = 'IP65'
where sku = 'SMC-EX500-Q011';

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-EX500-GEN2' and s.key in ('stations', 'valve_standard');

update product_specs s set value = 'EtherNet/IP'
from products p where s.product_id = p.id and p.sku = 'SMC-EX500-GEN2' and s.key = 'fieldbus';

update product_specs s set value = '24 VDC'
from products p where s.product_id = p.id and p.sku = 'SMC-EX500-GEN2' and s.key = 'solenoid_voltage';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'EX500'),
  ('io_points', '128 ingångar/128 utgångar'),
  ('branch_ports', '4 (32 in/32 ut per gren, grenkabel max 20 m)'),
  ('ip_rating', 'IP65'),
  ('temp_range', '-10 to +50'),
  ('order_code_example', 'EX500-GEN2'),
  ('catalogue', 'SMC EX500, How to Order sida 1449 (GW), 1451 (SI), 1452 (ingång), 1457 (grenkabel)')
) as x(key, value)
where p.sku = 'SMC-EX500-GEN2'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);


commit;


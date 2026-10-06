-- Kunskapsbasen får en granskad text om tvätt och livsmedel, och sökningen
-- förstår tvättorden.
--
-- Provat i drift 2026-10-06: "Vilken tätning klarar högtryckstvätt?" fick först
-- ett svar om SMC:s inre dämpningstätning ur ett reservdelskit, och efter #333
-- en allmän vägledning med sakfel: IP68 i stället för IP69K, "ISO 15552
-- (hydrauliska cylindertätningar)", 10–15 bar som tvättryck. Orsaken:
-- sv_en_term översatte "tätning" till "seal" men inte "högtryckstvätt", så
-- sökningen fastnade på "seal" -- och katalogerna har ingen text om tvätt.

create or replace function public.sv_en_term(w text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  -- Svenska bygger sammansättningar: "vakuumgrepp", "kulskruvsaxel",
  -- "tryckluftscylinder". En exakt ordlista missar dem alla, så uppslaget görs
  -- på FÖRLED -- längsta träffen vinner, så "vakuum" slår "vak".
  select coalesce((
    select o.en
    from (values
      ('gripdon','gripper'),('gripp','gripper'),('griptång','gripper'),
      ('vriddon','rotary'),('vridcylind','rotary'),('vridbord','rotary'),
      ('kolvstångslös','rodless'),('kolvstång','piston rod'),
      ('slaglängd','stroke'),('borrning','bore'),('kolvdiameter','bore'),
      ('kraft','force'),('tryckluft','compressed air'),('tryck','pressure'),
      ('ventilterminal','valve terminal'),('magnetventil','solenoid valve'),
      ('backventil','check valve'),('ventil','valve'),
      ('givare','sensor'),('vakuum','vacuum'),('sugkopp','suction cup'),
      ('renrum','clean room'),('livsmedel','food'),('rostfri','stainless'),
      ('dämpning','cushioning'),('styrd','guided'),('styrcylind','guided'),
      ('elektrisk','electric'),('elaxel','electric axis'),('pneumatisk','pneumatic'),
      ('lyft','lift'),('vertikal','vertical'),('horisontell','horizontal'),
      ('hastighet','speed'),('temperatur','temperature'),
      ('fäste','mounting'),('montering','mounting'),('tätning','seal'),
      ('filter','filter'),('regulator','regulator'),('smörj','lubricator'),
      ('flöde','flow'),('kulskruv','ball screw'),('kuggrem','toothed belt'),
      ('linjär','linear'),('klämma','clamp'),('klamm','clamp'),
      ('glas','glass'),('plåt','sheet'),('detalj','part'),
      ('explosion','explosion'),('damm','dust'),('fukt','humid'),
      ('cylind','cylinder'),('precision','precision'),('slag','stroke'),
      -- 2026-10-06: tvätt. "spolning", inte "spol": "spole" är en magnetspole.
      ('högtryckstvätt','washdown'),('högtryck','high pressure'),('tvätt','washdown'),
      ('spolning','washdown'),('rengör','cleaning'),('kapsling','enclosure'),
      ('hygien','hygienic'),('ånga','steam'),('kemikalie','chemical')
    ) as o(sv, en)
    where w like o.sv || '%'
    order by length(o.sv) desc
    limit 1
  ), w);
$function$;

insert into knowledge_chunks (source_file, brand, product_family, chunk_index, content)
select 'maskinval-tvatt-och-livsmedel', 'Maskinval', null, 0, $kunskap$Maskinval kunskapsbas: tvätt, högtryckstvätt och livsmedel – tätningar, material och kapsling.
Keywords: washdown, high-pressure cleaning, food, hygienic design, seal, wiper, enclosure, IP69K, IP67, IP68, EPDM, FKM, PTFE, FDA, NSF H1, EHEDG, stainless steel.

Högtryckstvätt (washdown) är rengöring med vattenstråle under högt tryck och hög temperatur. Kapslingsklassen för det är IP69K (ISO 20653, tidigare DIN 40050-9): strålar på 80–100 bar och 80 °C. IP67 och IP68 gäller nedsänkning i vatten, inte strålar under tryck – en IP67-komponent är inte provad för högtryckstvätt.

En pneumatisk cylinders tryckklass (oftast max 10 bar) gäller tryckluften inuti, inte tvättstrålen. Om en cylinder klarar tvätt avgörs av kapsling, tätningar (seal), avstrykare (wiper) och material – inte av arbetstrycket.

Tätningsmaterial för tvätt:
• EPDM tål hett vatten, ånga och alkaliska rengöringsmedel, men sväller av mineralolja och fett.
• FKM (Viton) tål oljor, fetter och många kemikalier, men är sämre mot ånga och starka baser.
• PTFE är kemiskt beständigt och används i krävande tvättmiljöer.
Vilket material som gäller beror på rengöringsmedlet – kontrollera tillverkarens kemikalietabell.

Livsmedel (food):
• Material i kontakt med livsmedel ska följa EU 1935/2004; för gummi används ofta FDA 21 CFR 177.2600 som referens.
• Smörjmedel ska vara NSF H1 (godkänt för oavsiktlig livsmedelskontakt).
• Hygienisk konstruktion enligt EHEDG: släta ytor, inga fickor där vatten och smuts stannar, rostfritt stål (AISI 304 eller 316L).

I Maskinvals katalog: FESTO-DSBF (rostfri ISO 15552-cylinder, FDA-tätningar, NSF H1-fett), Camozzi Serie 90 (AISI 316L, för livsmedel och tvätt) och Festo CRDSNU (korrosionsbeständig). Kontrollera alltid kapslingsklass och tätningsmaterial i tillverkarens datablad.$kunskap$
where not exists (select 1 from knowledge_chunks where source_file = 'maskinval-tvatt-och-livsmedel');

-- Sökningen nådde aldrig fram, och dokumenten nådde aldrig familjerna.
--
-- FUNNET 2026-09-11 när 51 tillverkarkataloger lästes in. Tre fel, alla i
-- samma kedja:
--
-- 1. websearch_to_tsquery OCH-ar alla ord: varje term måste finnas i SAMMA
--    stycke. Rådgivaren anropar searchKnowledge(combinedText, 5) med hela
--    kundens beskrivning -- "Jag behöver en cylinder som lyfter 20 kg
--    vertikalt, 300 mm slag" -- och fick NOLL träffar. Varenda gång.
--    Mätt: 'cylinder' gav 5 träffar, hela meningen gav 0. De 15 000 styckena
--    tillverkardokumentation har i praktiken aldrig nått fram till modellen.
--
-- 2. Dokumenten är på engelska, frågorna på svenska. "gripdon" matchar aldrig
--    "gripper", hur bred sökningen än görs.
--
-- 3. Svenska bygger sammansättningar -- "vakuumgrepp", "kulskruvsaxel",
--    "tryckluftscylinder" -- som en exakt ordlista missar allihop.
--
-- Lösningen är tre lager: översätt fackorden på FÖRLED, kör den exakta
-- frågan först för att behålla precisionen på korta tekniska sökningar, och
-- fall tillbaka på ELLER över orden när den inte ger något.
--
-- Verifierat efteråt: "vakuumgrepp för glasskiva" -> Parkers vakuumkatalog,
-- "gripdon för glas i renrum" -> Parkers gripdonskatalog, "rostfri cylinder
-- för livsmedel" -> AISI 316L-avsnittet hos Metal Work.

create or replace function public.sv_en_term(w text)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  -- Uppslag på FÖRLED, längsta träffen vinner: "vakuum" slår "vak", och
  -- "vakuumgrepp" hittas trots att ordet inte står i listan.
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
      ('cylind','cylinder'),('precision','precision'),('slag','stroke')
    ) as o(sv, en)
    where w like o.sv || '%'
    order by length(o.sv) desc
    limit 1
  ), w);
$fn$;

create or replace function public.search_knowledge(
  query_text text, match_count integer default 5, filter_brand text default null)
returns table(id uuid, source_file text, brand text, product_family text, content text, rank real)
language sql
stable
set search_path to 'public'
as $fn$
  with utbytt as (
    select string_agg(public.sv_en_term(w), ' ') as q2
    from regexp_split_to_table(lower(query_text), '[^a-z0-9åäöüß]+') w
    where length(w) >= 2
  ),
  strikt as (
    select k.id, k.source_file, k.brand, k.product_family, k.content,
           ts_rank(k.content_tsv, websearch_to_tsquery('english', query_text)) as rank
    from knowledge_chunks k
    where k.content_tsv @@ websearch_to_tsquery('english', query_text)
      and (filter_brand is null or k.brand = filter_brand)
    order by rank desc limit match_count
  ),
  ord as (
    -- Ord om minst tre tecken. Kortare ("en", "av", "i") bär ingen betydelse
    -- och drar bara in brus i ELLER-frågan.
    select array_to_string(array(
      select distinct lower(w)
      from regexp_split_to_table((select q2 from utbytt), '[^a-z0-9åäöüß]+') w
      where length(w) >= 3 limit 25
    ), ' | ') as uttryck
  ),
  brett as (
    select k.id, k.source_file, k.brand, k.product_family, k.content,
           ts_rank(k.content_tsv, to_tsquery('english', o.uttryck)) as rank
    from knowledge_chunks k, ord o
    where o.uttryck <> ''
      and not exists (select 1 from strikt)
      and k.content_tsv @@ to_tsquery('english', o.uttryck)
      and (filter_brand is null or k.brand = filter_brand)
    order by rank desc limit match_count
  )
  select * from strikt union all select * from brett;
$fn$;

-- ── Dokument -> familj ───────────────────────────────────────────────────────
-- 82 kopplingar, uttryckligen skrivna. En automatisk textmatchning gav
-- "DNC -> Metal Work" och "EMC -> VTSA" -- substrängsammanträffanden.
insert into knowledge_doc_families (source_file, family_slug, doc_title) values
 ('festo-ADVUL-202566.pdf','advu','Festo — ADVUL'),
 ('festo-CPX-202694.pdf','cpx','Festo — CPX'),
 ('festo-DAPS-202737.pdf','daps','Festo — DAPS'),
 ('festo-DFM-202749.pdf','dfm','Festo — DFM'),
 ('festo-DFPD-202756.pdf','dfpd','Festo — DFPD'),
 ('festo-DGCI-202774.pdf','dgci','Festo — DGCI'),
 ('festo-DHPS-202808.pdf','dhps','Festo — DHPS'),
 ('festo-DHRC-202809.pdf','dhrc','Festo — DHRC'),
 ('festo-DHWC-202833.pdf','dhwc','Festo — DHWC'),
 ('festo-DNC-202856.pdf','dnc','Festo — DNC'),
 ('festo-DRVS-202903.pdf','drvs','Festo — DRVS'),
 ('festo-DSBF-202905.pdf','dsbf','Festo — DSBF'),
 ('festo-DSBG-202907.pdf','dsbs','Festo — DSBG'),
 ('festo-DSM-202916.pdf','dsm','Festo — DSM'),
 ('festo-DSMI-202918.pdf','dsmi','Festo — DSMI'),
 ('festo-DSR-202929.pdf','dsr','Festo — DSR'),
 ('festo-DZH-251564.pdf','dzh','Festo — DZH'),
 ('festo-EGZ-202984.pdf','egz','Festo — EGZ'),
 ('festo-EHPS-202989.pdf','ehps','Festo — EHPS'),
 ('festo-EPCE-203026.pdf','epco','Festo — EPCE'),
 ('festo-EPCS-203028.pdf','epcs','Festo — EPCS'),
 ('festo-HE-LO-203131.pdf','he-d-mini','Festo — HE-LO'),
 ('festo-HGPD-203146.pdf','hgpd','Festo — HGPD'),
 ('festo-HGPL-215990.pdf','hgpl','Festo — HGPL'),
 ('festo-HGPP-203152.pdf','hgpp','Festo — HGPP'),
 ('festo-HGPT-203154.pdf','hgpt','Festo — HGPT'),
 ('festo-HGPT-203154.pdf','hgpt-b','Festo — HGPT'),
 ('festo-HGRT-203160.pdf','hgrt','Festo — HGRT'),
 ('festo-MH1-203291.pdf','mfh','Festo — MH1'),
 ('festo-VAD-VAK-203828.pdf','vadmi','Festo — VAD-VAK'),
 ('festo-VOFC-203884.pdf','vofc','Festo — VOFC'),
 ('festo-VTOP-203913.pdf','vtop-','Festo — VTOP'),
 ('festo-VUVS-VTUS-203918.pdf','vuvs','Festo — VUVS-VTUS'),
 ('festo-VZBE-203930.pdf','vzbe','Festo — VZBE'),
 ('festo-VZBE-203930.pdf','vzba','Festo — VZBE'),
 ('festo-VZWD-203945.pdf','vzwe','Festo — VZWD'),
 ('festo-VZWF-203946.pdf','vzwf-b-l','Festo — VZWF'),
 ('festo-VZXA-203952.pdf','vzxa','Festo — VZXA'),
 ('festo-VZXF-203954.pdf','vzxf-l','Festo — VZXF'),
 ('202715_documentation.pdf','cpx-ap-i','Festo — CPX-E automationssystem'),
 ('202970_documentation.pdf','egc-fa','Festo — EGC-FA styraxlar'),
 ('202980_documentation.pdf','egsk','Festo — EGSK elslider'),
 ('bosch-EMC.pdf','emc','Bosch Rexroth — EMC elektromekaniska cylindrar'),
 ('metalwork-ELEKTRO.pdf','elektro','Metal Work — ELEKTRO ISO 15552'),
 ('camozzi-6E.pdf','serie 6e','Camozzi — Serie 6E elektromekaniska cylindrar'),
 ('camozzi-electrics.pdf','5e','Camozzi — C_Electrics'),
 ('parker-electromechanical.pdf','eth','Parker — Electromechanical Overview'),
 ('parker-electromechanical.pdf','hmr','Parker — Electromechanical Overview'),
 ('parker-electromechanical.pdf','osp-e','Parker — Electromechanical Overview'),
 ('camozzi-short-form.pdf','serie cgan','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie cgps','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie cgpt','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie arp','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 24','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 31','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 32','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 32 tandem','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 40k','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 41k','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 50','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 63','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 63 end lock','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie 90','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie d','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie e','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie en','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie k','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie k8','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie kl','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie mx safemax','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie qc','Camozzi — Short Form Catalogue'),
 ('camozzi-short-form.pdf','serie qn','Camozzi — Short Form Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','cciv','Metal Work — General Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','cmpc','Metal Work — General Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','eb 80','Metal Work — General Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','isv','Metal Work — General Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','mach','Metal Work — General Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','rndc','Metal Work — General Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','sov l','Metal Work — General Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','sscy','Metal Work — General Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','swc','Metal Work — General Catalogue'),
 ('Metal_Work_General_Catalogue.pdf','vme','Metal Work — General Catalogue')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;

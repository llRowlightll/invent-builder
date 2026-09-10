-- Koppla kunskapsbankens dokument till familjer.
--
-- BAKGRUND. 45 tillverkardokument låg inlästa som 8 724 chunks, men bara 9 av
-- 159 familjer kunde nå sina. Två fel:
--
--   1. Chunkarna taggades med KATEGORI ("cylinder") i stället för FAMILJ
--      ("dsbc"). En familjesida som frågade efter sina dokument fick noll.
--   2. Inläsningen gissade familj per chunk ur brödtexten, vilket gav
--      464 skräptaggar ur Metal Works katalog -- "+ = ADD THE STROKE",
--      "24V 48V", "*  = SECTION  WITH  TOLERANCE".
--
-- En kolumn på chunken kan dessutom inte uttrycka verkligheten: ett dokument
-- täcker ibland flera familjer (VUVG-katalogen täcker även VTUG) och en familj
-- kan ha flera dokument. Kopplingen hör hemma på DOKUMENTET, många-till-många.

create table if not exists knowledge_doc_families (
  source_file text not null,
  family_slug text not null references configurator_families(slug) on delete cascade,
  doc_title   text,
  primary key (source_file, family_slug)
);

alter table knowledge_doc_families enable row level security;

drop policy if exists "doc families are public" on knowledge_doc_families;
create policy "doc families are public" on knowledge_doc_families for select using (true);

-- Mappningen är läst ur dokumentens egna titelrader. Festos filer inleds med
-- familjen ("Standards-based cylinders DSBC, to ISO 15552"); övriga är
-- identifierade ur filnamn plus innehåll.
insert into knowledge_doc_families (source_file, family_slug, doc_title) values
 ('202904_documentation.pdf','dsbc','Festo — Standards-based cylinders DSBC, to ISO 15552 (2026/09)'),
 ('202551_documentation.pdf','adn','Festo — Compact cylinders ADN/AEN, to ISO 21287'),
 ('202551_documentation (1).pdf','adn','Festo — Compact cylinders ADN/AEN, to ISO 21287'),
 ('202768_documentation.pdf','dgc','Festo — Linear drives DGC'),
 ('202923_documentation.pdf','dsnu','Festo — Round cylinders DSNU'),
 ('202794_documentation.pdf','dgsl','Festo — Mini slides DGSL'),
 ('202562_documentation.pdf','advc','Festo — Short-stroke cylinders ADVC/AEVC'),
 ('202562_documentation.pdf','aevc','Festo — Short-stroke cylinders ADVC/AEVC'),
 ('202783_documentation.pdf','dgo','Festo — Linear drives DGO'),
 ('202969_documentation.pdf','egc-bs-kf','Festo — Ball screw axes EGC-BS-KF'),
 ('202975_documentation.pdf','egc-tb-kf','Festo — Toothed belt axes EGC-TB-KF'),
 ('202997_documentation.pdf','elga','Festo — Toothed belt axes ELGA-TB'),
 ('203780_documentation.pdf','cpv','Festo — Valve terminal CPV, Compact Performance'),
 ('203804_documentation.pdf','vtsa','Festo — Valve terminals VTSA'),
 ('203876_documentation.pdf','vmpa1','Festo — Solenoid valves VMPA'),
 ('203917_documentation.pdf','vuvg','Festo — Solenoid valves VUVG / valve terminals VTUG'),
 ('203917_documentation.pdf','vtug','Festo — Solenoid valves VUVG / valve terminals VTUG'),
 ('203921_documentation.pdf','vuvg','Festo — Solenoid valves VUVG / valve manifold VTUG-S'),
 ('Parker P1D ISO cylinder current.pdf','p1d','Parker — P1D ISO 15552 cylinder'),
 ('Parker ISO 15552 cylinder Parker catalog.pdf','p1f','Parker — P1F pneumatic cylinders Ø160–320 mm'),
 ('0900P_Compact.pdf','p1p','Parker — P1P compact cylinders (0900P)'),
 ('0900P_Guided.pdf','p5t','Parker — P5T guided cylinders (0900P)'),
 ('0900P_Rodless.pdf','osp-p','Parker — rodless cylinders (0900P)'),
 ('0900P_Round_Body.pdf','sr-srd','Parker — SR/SRD round body cylinders (0900P)'),
 ('Parker_Pneumatic_OSP-P_Linear_Drive_System_Catalogue---PA4P011GB.pdf','osp-p','Parker — OSP-P Origa linear drive system'),
 ('0700P-E_C-FRL.pdf','parker-frl','Parker — Air preparation: filters, regulators, lubricators (0700P)'),
 ('f518f8d2b406b9b6ddf8f2d5e2bb02ac.pdf','kpz','Camozzi — Series KPZ short-stroke and compact cylinders'),
 ('09_Lintra Plus Rodless cylinders.pdf','lintra-plus','Norgren — LINTRA Plus rodless cylinders'),
 ('us_RM_28000_M_and_RM_8000_M.pdf','rm28000','Norgren — RM/28000 and RM/8000 roundline cylinders'),
 ('en_us_1.5.840_Roundline_Non-Rotating_Cylinder_R2.pdf','norgren-nr','Norgren — Roundline non-rotating stainless cylinder'),
 ('RTC-HD.pdf','rtc-hd','Bosch Rexroth — RTC-HD rodless cylinders'),
 ('ISO15552pneumaticcylinderbosch.pdf','pra','Bosch Rexroth — PRA standard cylinders, ISO 15552'),
 ('0900766b80e03ed4.pdf','gpc-bv','Bosch Rexroth — GPC-BV guide cylinders')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;

-- ── Städa skräptaggarna ──────────────────────────────────────────────────────
create table if not exists backup.knowledge_family_tags_20260910 as
  select id, product_family from knowledge_chunks where product_family is not null;

with skrap as (
  select k.product_family
  from knowledge_chunks k
  where k.product_family is not null
    and not exists (select 1 from configurator_families f where f.slug = lower(k.product_family))
  group by 1 having count(*) <= 9
)
update knowledge_chunks k set product_family = null
where k.product_family in (select product_family from skrap)
   or k.product_family in ('CUSTOM PRODUCTS','TECHNICAL DATA');

-- Två taggar var nära rätt slug men stavade fel.
update knowledge_chunks set product_family = 'rm28000' where product_family = 'rm-28000';
update knowledge_chunks set product_family = 'sr-srd'  where product_family = 'parker-sr';

-- ── Läsvägen ─────────────────────────────────────────────────────────────────
create or replace function public.get_family_documents(p_family_slug text)
returns table (source_file text, doc_title text, chunks bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select d.source_file,
         d.doc_title,
         (select count(*) from knowledge_chunks k where k.source_file = d.source_file)
  from knowledge_doc_families d
  where d.family_slug = p_family_slug
  order by d.doc_title;
$$;

grant execute on function public.get_family_documents(text) to anon, authenticated;

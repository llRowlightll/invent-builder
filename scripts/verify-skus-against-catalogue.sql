-- Finns våra artikelnummer i tillverkarens egen katalog?
--
-- VARFÖR. scripts/audit-order-codes.ts svarar på om en familjs orderkodsmall
-- kan återskapa familjens artikelnummer. Den frågan förutsätter att
-- artikelnumren ÄR riktiga. Den här frågan prövar förutsättningen.
--
-- POSITIVA KONTROLLER: DSBC ger 3/3 och P1D 25/25. Metoden hittar alltså
-- riktiga artikelnummer när de är riktiga -- utan den kontrollen vore en nolla
-- inte värd någonting.
--
-- ATT LÄSA UTFALLET. En nolla betyder INTE automatiskt att artikeln är påhittad.
-- Den kan också betyda att dokumentet är en driftmanual utan beställnummer
-- (SMC:s manualer), att det är en kortformskatalog som utelämnar dem
-- (camozzi-short-form.pdf), eller att textutvinningen förstört tabellen.
-- Kolumnen dokumenttyp skiljer på de fallen.
--
-- Där dokumentet ÄR en beställkatalog och träffen är noll finns något att reda
-- ut. KPZ är det tydligaste exemplet: 16 artiklar på formen
-- "KPZ-016-0025-A-0-PPV", medan AVENTICS katalog uteslutande använder
-- "0822394004" och inte innehåller "KPZ-" följt av en siffra en enda gång.
with prod as (
  select p.sku, lower(p.family) as fam,
         regexp_replace(upper(p.sku),
           '^(FESTO|SMC|PARKER|MW|METALWORK|CAMOZZI|NORGREN|REXROTH|BOSCH)-', '') as kod
  from products p
  where p.status = 'active' and p.family is not null
),
par as (
  select prod.*, k.source_file
  from prod
  join knowledge_doc_families k on k.family_slug = prod.fam
),
traff as (
  select par.fam, par.sku, par.source_file,
    exists (
      select 1 from knowledge_chunks c
      where c.source_file = par.source_file
        and position(par.kod in upper(c.content)) > 0
    ) as finns
  from par
)
select fam,
       count(*) as artiklar,
       count(*) filter (where finns) as hittade_i_katalogen,
       min(source_file) as dokument,
       case when min(source_file) ~ '^smc-.*om_' then 'driftmanual (saknar beställnummer)'
            when min(source_file) like '%short-form%' then 'kortformskatalog'
            else 'beställkatalog' end as dokumenttyp
from traff
group by fam
order by (count(*) filter (where finns))::float / count(*), count(*) desc;

-- Steg 4: en läsväg till kunskapsgrafen.
--
-- 123 kurerade produkt-till-produkt-relationer låg i två tabeller med olika
-- form och användes av ingenting:
--   competitor_map    50 korsmärkes-motsvarigheter med match_quality
--                     (26 high, 23 medium, 1 low)
--   product_relations 73 riktade relationer
--                     (accessory 53, controlled_by 12, air_supply 6, requires 2)
--
-- Rådgivaren rörde ingen av dem -- enda förekomsten av product_relations i
-- groq-advisor var en kommentar. Frontendens findAlternativesTiered() gissade i
-- stället alternativ ur specar (annat märke, uppfyller kraft/slag). Det är en
-- heuristik; competitor_map är kurerad kunskap och ska gå före den där den finns.
--
-- RIKTNING
-- competitor_map är symmetrisk -- är A ett alternativ till B så är B ett
-- alternativ till A -- och unionas därför åt båda håll. product_relations är
-- riktad (en cylinder STYRS AV en ventil, inte tvärtom), så riktningen
-- returneras explicit i stället för att slås ihop.
--
-- MOTSTRIDIGA BETYG
-- competitor_map betygsätter samma par olika beroende på riktning för 20 av 57
-- produkter (t.ex. FESTO-ADVC → SMC-CQ2 'high' åt ena hållet, 'low' åt det
-- andra). Symmetriska relationer kan inte ha två rätta betyg, så funktionen tar
-- det LÄGSTA. För en rekommendation är det säkrare att underdriva en likhet än
-- att överdriva den: en ingenjör som får "medium" och upptäcker att bytet
-- fungerar utmärkt blir inte lurad, men tvärtom blir hen det. Datan lämnas
-- orörd -- betygen kan vara medvetet satta, och att skriva om kurerat underlag
-- utifrån en gissning vore värre än att läsa det försiktigt.
--
-- SYNLIGHET
-- Endast publika katalogfält returneras. purchase_price och margin lämnas
-- utanför med flit: funktionen är anropbar av anon precis som
-- fetch_products_for_advisor, eftersom katalogen är publik men prissättningen
-- inte är det.

create or replace function public.get_product_relations(p_sku text)
returns table (
  relation_type text,
  direction     text,
  quality       text,
  sku           text,
  name          text,
  brand         text,
  category      text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with src as (select id from public.products where sku = p_sku),
  par as (
    select cm.competitor_product_id as other_id, cm.match_quality
    from public.competitor_map cm join src on src.id = cm.product_id
    union all
    select cm.product_id, cm.match_quality
    from public.competitor_map cm join src on src.id = cm.competitor_product_id
  ),
  alternativ as (
    select other_id,
           (array_agg(match_quality order by
              case match_quality when 'low' then 1 when 'medium' then 2
                                 when 'high' then 3 else 4 end))[1] as quality
    from par group by other_id
  )
  select 'alternative_to'::text, 'both'::text, a.quality,
         p.sku, p.name, b.name, c.name
  from alternativ a
  join public.products p on p.id = a.other_id
  left join public.brands b     on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id
  union all
  select pr.relation_type, 'out', null, p.sku, p.name, b.name, c.name
  from public.product_relations pr
  join src on src.id = pr.product_id
  join public.products p on p.id = pr.related_product_id
  left join public.brands b     on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id
  union all
  select pr.relation_type, 'in', null, p.sku, p.name, b.name, c.name
  from public.product_relations pr
  join src on src.id = pr.related_product_id
  join public.products p on p.id = pr.product_id
  left join public.brands b     on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id;
$$;

comment on function public.get_product_relations(text) is
  'Kunskapsgrafen för en produkt: kurerade alternativ (competitor_map, symmetriskt, lägsta betyg vid konflikt) plus riktade relationer (product_relations). Endast publika katalogfält -- ingen prissättning.';

grant execute on function public.get_product_relations(text) to anon, authenticated;

-- ROLLBACK: drop function if exists public.get_product_relations(text);

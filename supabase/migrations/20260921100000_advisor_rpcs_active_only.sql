-- Rådgivaren och produktsidan får bara se aktiva produkter.
--
-- BAKGRUND
-- Nattens invariant-eval (issue #259, 2026-09-17) fann att rådgivaren föreslog
-- 6E-025-0100-24, 6E-063-0200-24, KPZ-080-0400-A-0-PPV m.fl. -- de påhittade
-- artikelnummer som sattes till status = 'discontinued' i PR #210 och #218 i
-- stället för att raderas (inget pekade på dem, men raderna skulle kunna
-- behövas för gamla offerter). Policyn förutsatte att läsvägarna filtrerar
-- på status. Två av tre gjorde det inte:
--
--   fetch_products_for_advisor   rådgivarens produktlista till modellen: INGET statusfilter
--   get_similar_products         produktsidans "Alternativ" (beräknade):  INGET statusfilter
--   get_product_relations        produktsidans kurerade relationer:        INGET statusfilter
--   get_family_facts             status = 'active'  (rätt)
--   fetchProducts i index.ts     status=eq.active   (rätt)
--
-- Rådgivarens egen kod filtrerar alltså rätt, men RPC:n den använder gör det
-- inte -- och RPC:n ligger i databasen, så rättningen når produktion utan
-- edge-deploy. Admin- och offertfunktionerna (admin_list_product_pricing,
-- get_quote_items) rörs inte: gamla offerter ska kunna visa utgångna rader.
--
-- fetch_products_for_advisor fanns inte i repots migrationer (skapad ad hoc);
-- definitionen nedan är databasens, ordagrant, plus villkoret.

create or replace function public.fetch_products_for_advisor(p_category_slug text default null::text, p_limit integer default 25)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (SELECT p.sku, p.name, p.family, c.slug AS category, c.name AS category_name,
      b.slug AS brand, b.name AS brand_name,
      (SELECT jsonb_object_agg(ps.key, ps.value || COALESCE(' ' || ps.unit, ''))
       FROM product_specs ps WHERE ps.product_id = p.id AND ps.key IN (
         'bore_diameter_mm','bore_mm','stroke_mm','stroke_range','stroke_max','max_stroke',
         'piston_force_6bar_N','max_pressure','ip_rating','standard','temp_range',
         'gripping_force_closing_N','max_jaw_force_Fz','flow_rate_l_min',
         'operating_pressure','force_n','sizes','voltage','fieldbus','repeatability_mm','mode_of_operation'
       )) AS key_specs
    FROM products p JOIN categories c ON p.category_id = c.id JOIN brands b ON p.brand_id = b.id
    WHERE p.status = 'active'
      AND (p_category_slug IS NULL OR c.slug = p_category_slug) ORDER BY b.slug, p.sku LIMIT p_limit
  ) t;
$function$;

create or replace function public.get_similar_products(p_sku text, p_limit int default 6)
returns table (
  sku          text,
  name         text,
  brand        text,
  category     text,
  bore_mm      numeric,
  stroke_mm    numeric,
  match_basis  text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with spec as (
    select ps.product_id, ps.key,
           nullif(substring(ps.value from '[0-9]+(?:[.,][0-9]+)?'), '')::numeric as num
    from product_specs ps
    where ps.key in ('bore_mm','stroke_mm')
  ),
  källa as (
    select p.id, p.category_id, p.brand_id,
           (select num from spec where product_id = p.id and key = 'bore_mm')   as bore,
           (select num from spec where product_id = p.id and key = 'stroke_mm') as stroke
    from products p where p.sku = p_sku
  ),
  kandidat as (
    select p.sku, p.name, b.name as brand, c.slug as category,
           (select num from spec where product_id = p.id and key = 'bore_mm')   as bore,
           (select num from spec where product_id = p.id and key = 'stroke_mm') as stroke
    from products p
    join källa k on p.category_id = k.category_id
                and p.brand_id is distinct from k.brand_id
                and p.id <> k.id
    join brands b     on b.id = p.brand_id
    join categories c on c.id = p.category_id
    where p.status = 'active'
  )
  select kd.sku, kd.name, kd.brand, kd.category, kd.bore, kd.stroke,
         case
           when kd.bore is not null and k.bore is not null
                and kd.stroke is not null and k.stroke is not null then 'bore+stroke'
           when kd.bore is not null and k.bore is not null          then 'bore'
           else 'category'
         end as match_basis
  from kandidat kd cross join källa k
  where k.bore is null or kd.bore is null
     or abs(kd.bore - k.bore) <= greatest(k.bore * 0.10, 1)
  order by
    case when kd.bore is not null and k.bore is not null then abs(kd.bore - k.bore) else 9999 end,
    case when kd.stroke is not null and k.stroke is not null then abs(kd.stroke - k.stroke) else 9999 end,
    kd.sku
  limit greatest(1, least(coalesce(p_limit, 6), 20));
$$;

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
  join public.products p on p.id = a.other_id and p.status = 'active'
  left join public.brands b     on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id
  union all
  select pr.relation_type, 'out', null, p.sku, p.name, b.name, c.name
  from public.product_relations pr
  join src on src.id = pr.product_id
  join public.products p on p.id = pr.related_product_id and p.status = 'active'
  left join public.brands b     on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id
  union all
  select pr.relation_type, 'in', null, p.sku, p.name, b.name, c.name
  from public.product_relations pr
  join src on src.id = pr.related_product_id
  join public.products p on p.id = pr.product_id and p.status = 'active'
  left join public.brands b     on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id;
$$;

-- ROLLBACK: återställ de tre funktionerna ur 20260908203000_get_product_relations.sql,
-- 20260909120000_get_similar_products.sql och databasens tidigare definition av
-- fetch_products_for_advisor (samma som ovan utan "p.status = 'active'").

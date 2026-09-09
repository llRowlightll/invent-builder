-- Beräknade likvärdiga produkter — "vilket annat fabrikat gör motsvarande?"
--
-- BAKGRUND
-- Den kurerade kunskapsgrafen (competitor_map, product_relations) är riktig men
-- täcker fel produkter: 57 av 732, och av de 111 SKU:er rådgivaren faktiskt
-- rekommenderat har exakt EN någon relation -- 22 av 13 575 rekommendationer,
-- 0,16 %. Att bygga "Alternativ" enbart på den hade gett en tom ruta i 99,8 %
-- av fallen, vilket är sämre än ingen ruta.
--
-- Den här funktionen härleder i stället alternativ ur specarna, vilket täcker
-- hela katalogen direkt. Den ERSÄTTER inte den kurerade grafen -- där en
-- kurerad relation finns är den bättre, för den är verifierad mot tillverkaren
-- och bär match_quality. Anropa get_product_relations först, den här som
-- komplement.
--
-- ÄRLIGHET OM SÄKERHET
-- match_basis säger vad matchningen faktiskt vilar på. En träff på enbart
-- kategori är inte samma sak som en träff på borrning OCH slaglängd, och
-- ingendera är samma sak som en verifierad korsreferens. Gränssnittet MÅSTE
-- visa skillnaden -- att presentera en beräknad likhet som en fastställd
-- likvärdighet är exakt det fel vi rättat på tre andra ställen i systemet.
--
-- MATCHNINGSREGLER
--   hårt: samma kategori, ANNAT fabrikat, ej samma produkt
--   hårt: om båda har borrning måste den ligga inom ±10 % (en Ø25 kan inte
--         ersätta en Ø63 -- kraften skalar med arean)
--   mjukt: rangordna på borrningsavstånd, sedan slaglängdsavstånd
--
-- Slaglängd filtreras INTE hårt. En serie säljs över ett slagintervall och
-- beställs i rätt längd; att kräva minst lika lång slaglängd hade uteslutit
-- familjeprodukter som i praktiken går att få längre.

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
    -- Första talet i värdet: bore_mm är rena tal ("32"), stroke_mm bär suffix
    -- ("300 mm"), och enstaka rader är intervall ("9-483").
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

comment on function public.get_similar_products(text, int) is
  'Beräknade alternativ ur specarna: samma kategori, annat fabrikat, borrning inom ±10 %. Komplement till den kurerade get_product_relations, inte ersättning. match_basis säger vad matchningen vilar på och MÅSTE visas -- en beräknad likhet är inte en verifierad korsreferens. Ingen prissättning returneras; funktionen är anon-anropbar.';

grant execute on function public.get_similar_products(text, int) to anon, authenticated;

-- ROLLBACK: drop function if exists public.get_similar_products(text, int);

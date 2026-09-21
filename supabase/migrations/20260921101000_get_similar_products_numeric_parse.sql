-- Produktsidans beräknade alternativ föll på familjeradernas borrningslistor.
--
-- get_similar_products läste "det första talet" med mönstret
-- '[0-9]+(?:[.,][0-9]+)?', som på familjerader med bore_mm = "32,40,50,63"
-- (FESTO-DSBC, SMC-CP96, SMC-CQ2, SMC-C85, SMC-MXS, FESTO-ADN m.fl., tolv
-- rader) ger "32,40" -- och ::numeric kastar. Eftersom kandidaterna är alla
-- produkter i samma kategori räckte EN sådan rad för att hela anropet skulle
-- fela: get_similar_products('SMC-RDQB32', 6) -> 22P02 invalid input syntax
-- for type numeric: "32,40". Alla cylindrar har alltså saknat "Alternativ"
-- sedan 2026-09-09. Upptäckt 2026-09-21 vid dubbelkollen av statusfiltret.
--
-- Rättning: kommat är listavskiljare, punkten decimal ("3.2"). Definitionen
-- är i övrigt densamma som i 20260921100000_advisor_rpcs_active_only.sql.

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
    -- Första talet i värdet. Familjeraderna listar borrningar med komma
    -- ("32,40,50,63") och "12,5" förekommer inte -- kommat är alltid
    -- listavskiljare, punkten decimal ("3.2"). Det gamla mönstret tog med
    -- kommat och kastade "32,40" till numeric, vilket fällde hela funktionen
    -- för varje cylinder som hade en sådan familjerad som kandidat.
    select ps.product_id, ps.key,
           nullif(substring(ps.value from '[0-9]+(?:\.[0-9]+)?'), '')::numeric as num
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

-- ROLLBACK: definitionen i 20260921100000_advisor_rpcs_active_only.sql.

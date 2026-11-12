-- Publika priser: säljpriset på produktsidan, bakom ägarens strömbrytare.
--
-- Bakgrund (2026-11-12): prislistorna är på väg (RS-konto, MyEmerson). Utan
-- den här vägen skulle ett inläst pris bara synas i offerten. Inköpspris och
-- marginal når aldrig en kundroll (products har kolumnvisa rättigheter) --
-- funktionen nedan lämnar bara ut säljpriset, avrundat till hela kronor.
--
-- Tre skydd:
--   1. Inget visas förrän site_content 'priser.visa' = 'ja' (admin →
--      Inställningar). Inläsning och kontroll först, publicering sedan.
--   2. Marginalen måste vara ett procenttal 1–95. Kolumnens standardvärde var
--      0.35 (bråktal, från före 20260603000300 som gjorde marginalen till
--      procent), och 155 artiklar som lades in efter juni har 0.35 -- de skulle
--      annars visas till självkostnad (0,35 % marginal). De visas inte förrän
--      marginalen är rättad. Själva rättelsen av raderna är ägarens beslut.
--   3. Ett pris äldre än 365 dagar visas inte; prisdatumet följer med.

begin;

-- Marginalen är procent sedan juni; standardvärdet följde inte med.
alter table public.products alter column margin set default 30;

-- När inköpspriset senast sattes. "update of purchase_price" fyrar när
-- kolumnen står i SET-listan, även med samma värde: en ny prislista med
-- oförändrat pris förnyar alltså datumet, men en ändrad marginal (bulk i
-- admin) gör det inte -- då skulle ett gammalt inköpspris se färskt ut.
alter table public.products add column if not exists purchase_price_set_at timestamptz;

comment on column public.products.purchase_price_set_at is
  'När purchase_price senast sattes (trigger). Publika priser äldre än 365 dagar visas inte.';

create or replace function public.trg_prisdatum()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.purchase_price_set_at := case when new.purchase_price is null then null else now() end;
  return new;
end $$;

drop trigger if exists prisdatum on public.products;
create trigger prisdatum
  before insert or update of purchase_price on public.products
  for each row execute function public.trg_prisdatum();

-- Säljpriset för de artiklar som får visas. Tom lista när strömbrytaren är av.
create or replace function public.publika_priser(p_skus text[])
returns table(sku text, pris_exkl_moms numeric, fran boolean, prisdatum date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.sku,
         round(p.purchase_price / (1 - p.margin / 100), 0),
         -- Samma familjeregel som admin_list_product_pricing: en serie utan
         -- artikelnummer har ett nominellt pris ("från").
         (p.sku !~ '[0-9]' or not exists (select 1 from public.product_specs s where s.product_id = p.id)),
         p.purchase_price_set_at::date
    from public.products p
   where p.sku = any(p_skus)
     and p.status = 'active'
     and p.purchase_price > 0
     and p.margin >= 1 and p.margin <= 95
     and p.purchase_price_set_at > now() - interval '365 days'
     and exists (
       select 1 from public.site_content c
        where c.key = 'priser.visa' and c.value = 'ja'
     )
   limit 500
$$;

revoke all on function public.publika_priser(text[]) from public;
grant execute on function public.publika_priser(text[]) to anon, authenticated;

comment on function public.publika_priser(text[]) is
  'Säljpris (hela kronor, exkl. moms) för aktiva artiklar med inköpspris, marginal 1–95 % och prisdatum inom 365 dagar -- bara när site_content priser.visa = ja. Lämnar aldrig ut inköpspris eller marginal.';

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lock down products.purchase_price + margin (internal commercial cost data).
--
-- Problem: the `authenticated` role held TABLE-level SELECT on public.products.
-- Combined with the "public read products" RLS policy (status = 'active'), that
-- let ANY logged-in user read our cost/markup via a crafted PostgREST request —
-- e.g.  GET /products?select=purchase_price,margin
-- The anon role was already safe (column-level SELECT on non-cost columns only);
-- authenticated was not.
--
-- Fix:
--   1. Replace authenticated's blanket table-level SELECT with column-level
--      SELECT on every column EXCEPT purchase_price and margin (mirrors anon).
--   2. Expose the two cost columns to admins only via a SECURITY DEFINER RPC
--      (admin_list_product_pricing), used by the admin pricing screen.
--
-- Writes are intentionally unchanged: authenticated keeps UPDATE/INSERT on the
-- cost columns, gated to admins by the existing "admin update/insert products"
-- RLS policies (a non-admin's write is still denied at the row level, and UPDATE
-- never requires SELECT on the written columns).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Admin-only reader for cost data ─────────────────────────────────────────
create or replace function public.admin_list_product_pricing()
returns table (
  id             uuid,
  sku            text,
  name           text,
  purchase_price numeric,
  margin         numeric,
  brand_id       uuid,
  category_id    uuid,
  brand_name     text,
  category_name  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select p.id, p.sku, p.name, p.purchase_price, p.margin,
           p.brand_id, p.category_id, b.name, c.name
    from public.products p
    left join public.brands b     on b.id = p.brand_id
    left join public.categories c on c.id = p.category_id
    order by p.name;
end;
$$;

revoke execute on function public.admin_list_product_pricing() from public, anon;
grant  execute on function public.admin_list_product_pricing() to authenticated;

-- 2) Column-level lockdown ────────────────────────────────────────────────────
-- Drop the blanket table-level SELECT, then re-grant every NON-cost column.
revoke select on public.products from authenticated;
grant select (
  id, sku, name, description, family, brand_id, category_id,
  lead_time_days, availability, ip_rating, fieldbus, voltage, status,
  image_url, created_at, updated_at, weight_kg, length_mm, width_mm, height_mm
) on public.products to authenticated;

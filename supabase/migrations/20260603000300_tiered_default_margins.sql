-- ─────────────────────────────────────────────────────────────────────────────
-- Tiered default margins + fix the margin scale/semantics.
--
-- admin.pricing treats `margin` as a GROSS-MARGIN PERCENT:
--     säljpris = purchase_price / (1 - margin/100)
-- …but the column was numeric(5,4) (max 9.9999), so it could only ever hold a
-- fraction — saving a percent like 30 overflowed. The old products_priced view
-- used yet another convention (purchase_price * (1 + margin), i.e. markup as a
-- fraction). This standardises everything on the admin UI's definition:
-- integer-percent gross margin.
--
-- Tier strategy (defaults until real per-supplier pricing): be competitive on the
-- commodity items buyers price-compare, earn on the long-tail nobody shops.
--   LOW  22% — cylinders, valves
--   MID  30% — grippers, valve terminals, actuators, sensors, vacuum, …
--   HIGH 40% — fittings, tubing, flow control, mounting, silencers, …
-- A margin only affects a price once a real purchase_price is entered.
-- ─────────────────────────────────────────────────────────────────────────────

-- The view depends on products.margin, so drop it before altering the column.
drop view if exists public.products_priced;

-- Widen margin so it can hold an integer percent (0–100, with decimals).
alter table public.products alter column margin type numeric(5,2);

-- LOW 22% — commodity, heavily price-compared
update public.products p set margin = 22
  from public.categories c
 where p.category_id = c.id and c.slug in ('cylinder','valve');

-- MID 30% — specialised motion / electromechanical / sensing
update public.products p set margin = 30
  from public.categories c
 where p.category_id = c.id and c.slug in (
   'gripper','valve-terminal','frl','linear-module','rotary-actuator',
   'electric-actuator','sensor','vacuum','shock-absorber','rod-lock'
 );

-- HIGH 40% — accessories / fittings / long-tail (rarely price-shopped)
update public.products p set margin = 40
  from public.categories c
 where p.category_id = c.id and c.slug in (
   'fitting','tubing','flow-control','mounting','silencer','check-valve',
   'cable','seal-kit','hose','speed-controller','air-preparation','coupling'
 );

-- Fallback: any uncategorised product gets the mid default.
update public.products set margin = 30 where margin is null;

-- Recreate products_priced with the same gross-margin-percent definition,
-- preserving the earlier security hardening (security_invoker + admin-only).
create view public.products_priced with (security_invoker = true) as
  select id, sku, name, description, family, brand_id, category_id,
         lead_time_days, availability, ip_rating, fieldbus, voltage, status,
         image_url, created_at, updated_at, purchase_price, margin,
         weight_kg, length_mm, width_mm, height_mm,
         case
           when purchase_price is not null and coalesce(margin, 30) < 100
           then round(purchase_price / (1 - coalesce(margin, 30) / 100), 2)
           else null::numeric
         end as selling_price,
         case
           when availability = 'stock' then 1
           when availability = 'fast'  then 3
           when availability = 'order' then coalesce(lead_time_days, 21)
           else coalesce(lead_time_days, 14)
         end as estimated_delivery_days
  from public.products p;

revoke all on public.products_priced from anon, authenticated;

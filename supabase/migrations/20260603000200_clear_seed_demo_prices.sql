-- ─────────────────────────────────────────────────────────────────────────────
-- Clear demo/seed product prices.
--
-- The 176 products carrying a purchase_price were never real supplier quotes —
-- they are seed/demo values that arrived when the catalog was first built:
--   • every priced row has created_at = updated_at (never manually edited),
--   • a uniform 35% margin (a bulk default, not negotiated),
--   • only the three seed brands (Metal Work, Festo, SMC) had any prices, while
--     Camozzi / Parker / Bosch Rexroth / Norgren had none,
--   • the accessories seed migration hardcodes them, e.g. (...,695,7,'stock').
--
-- No real prices have been entered yet, so we clear these for a clean slate —
-- the admin pricing list then honestly shows "0 priced" and real supplier prices
-- can be filled in as quotes arrive. Originals are copied to
-- backup.seed_price_20260603 (a schema NOT exposed by the API) for recovery.
-- ─────────────────────────────────────────────────────────────────────────────
create schema if not exists backup;

create table if not exists backup.seed_price_20260603 as
  select sku, purchase_price, margin, now() as backed_up_at
  from public.products
  where purchase_price is not null or margin is not null;

update public.products
   set purchase_price = null,
       margin         = null
 where purchase_price is not null
    or margin is not null;

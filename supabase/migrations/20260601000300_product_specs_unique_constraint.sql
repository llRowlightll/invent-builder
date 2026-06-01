-- ─────────────────────────────────────────────────────────────────────────────
-- Restore the unique(product_id, key) constraint on product_specs.
--
-- The original schema migration (20260508092225) declares `unique(product_id, key)`,
-- but the live DB had drifted (the table was recreated without it — pk was renamed
-- to product_specs_pkey1). Without the constraint, duplicate spec rows are possible
-- and `INSERT ... ON CONFLICT (product_id, key)` upserts fail.
--
-- One product (FESTO-EGSK-26) had two conflicting rows each for `max_speed` and
-- `repeatability_mm`; the implausible values were removed out-of-band before this
-- migration (max_speed 3 m/s, repeatability 0.02 — kept 0.83 m/s / ±0.003).
--
-- The dedupe below is a portable safety net (keep lowest id per product_id+key) so
-- the migration is replay-safe on any database.
-- ─────────────────────────────────────────────────────────────────────────────

delete from public.product_specs a
using public.product_specs b
where a.product_id = b.product_id and a.key = b.key and a.id > b.id;

alter table public.product_specs
  add constraint product_specs_product_id_key_unique unique (product_id, key);

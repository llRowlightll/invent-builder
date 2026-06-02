-- ─────────────────────────────────────────────────────────────────────────────
-- Add bore_range to the stainless/round cylinder FAMILIES that had a stroke_range
-- (20260601000000) but no bore — so the bore-adequacy filter can judge them.
--
-- With the bore-as-MAX normalization (scoring.ts), a family's bore_range max is used
-- for load adequacy, so these now qualify for the loads they can actually carry.
--
-- Values are manufacturer catalog-standard bore ranges (mm), corroborated by the
-- concrete siblings already in the catalog.
--
-- NOTE: ~19 Festo "topseller" representative SKUs in the cylinder category still lack
-- a bore (DNC, DSBF, DSNU, ADN, ADVU, CRDSNU, …). They need the Festo datasheets to
-- populate accurately and are intentionally NOT guessed here — tracked as follow-up.
-- They pass the bore filter as "unknown" today, so they are not wrongly excluded.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.product_specs (product_id, key, value, unit)
select p.id, 'bore_range', v.rng, 'mm'
from public.products p
join (values
  ('SMC-CM2', '20–40'),    -- compact stainless, Ø20–40
  ('MW-RNDC', '20–63'),    -- round cylinder (concrete siblings Ø25–63)
  ('MW-SSCY', '12–100')    -- short-stroke compact cylinder
) as v(sku, rng) on v.sku = p.sku
where not exists (
  select 1 from public.product_specs ps
  where ps.product_id = p.id and ps.key = 'bore_range'
);

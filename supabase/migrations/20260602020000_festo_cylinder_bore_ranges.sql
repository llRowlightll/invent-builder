-- ─────────────────────────────────────────────────────────────────────────────
-- Bore ranges for the 19 Festo "topseller" representative SKUs in the cylinder
-- category that had a stroke but no bore (the follow-up noted in 20260602010000).
--
-- Most values are CATALOG-GROUNDED: copied from the matching FESTO-<family> entry's
-- bore range already in the catalog (DSBC, DSBF, DFM, DGSL, DSNU, ESNU, ADVC, DGC,
-- ADN). The rest are well-known Festo family ISO standard ranges (DNC/ISO 15552,
-- ADVU/AEVC compact, DZH flat, EGZ cartridge, DGO/DGPL rodless, CRDSNU/ISO 6432,
-- DGCI). With the bore-as-MAX normalization, each now reports its family max bore
-- for load adequacy. After this, 0 cylinders lack a parseable bore.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.product_specs (product_id, key, value, unit)
select p.id, 'bore_range', v.rng, 'mm'
from public.products p
join (values
  ('FESTO-1463250', '32–100'),  -- DSBC  ISO 15552       (catalog)
  ('FESTO-1463254', '32–100'),  -- DSBC  ISO 15552       (catalog)
  ('FESTO-150295',  '12–63'),   -- DZH   flat cylinder
  ('FESTO-15033',   '6–25'),    -- EGZ   cartridge
  ('FESTO-15221',   '12–25'),   -- DGO   rodless drive
  ('FESTO-156040',  '12–100'),  -- ADVU  compact
  ('FESTO-163302',  '32–320'),  -- DNC   ISO 15552
  ('FESTO-175133',  '18–63'),   -- DGPL  rodless drive
  ('FESTO-188052',  '8–63'),    -- AEVC  short-stroke
  ('FESTO-188054',  '8–63'),    -- ADVC  short-stroke    (catalog)
  ('FESTO-193986',  '8–63'),    -- DSNU  ISO 6432        (catalog)
  ('FESTO-193996',  '8–63'),    -- ESNU  ISO 6432        (catalog)
  ('FESTO-4149944', '6–100'),   -- DFM   guided          (catalog)
  ('FESTO-530906',  '8–80'),    -- DGC   rodless drive   (catalog)
  ('FESTO-536203',  '12–100'),  -- ADN   compact ISO 21287 (catalog)
  ('FESTO-543902',  '6–25'),    -- DGSL  mini slide      (catalog)
  ('FESTO-552787',  '12–63'),   -- CRDSNU stainless ISO 6432
  ('FESTO-570077',  '32–125'),  -- DSBF  stainless ISO 15552 (catalog)
  ('FESTO-DGCI',    '18–63')    -- DGCI  belt axis
) as v(sku, rng) on v.sku = p.sku
where not exists (
  select 1 from public.product_specs ps
  where ps.product_id = p.id and ps.key = 'bore_range'
);

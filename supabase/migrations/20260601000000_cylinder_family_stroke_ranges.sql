-- ─────────────────────────────────────────────────────────────────────────────
-- Cylinder "family" products: add stroke_range so they resolve to a real stroke
-- max (parseStrokeFromSpecs) and flip is_family on (normalizeKeySpecs).
--
-- Background: these SKUs are SERIES placeholders sold across a stroke RANGE, not a
-- single fixed-stroke orderable SKU. Without a stroke_range they parsed to stroke=0
-- and were silently treated as matching ANY required stroke. Populating the range
-- lets them qualify only up to their real max, while the advisor ranks them BELOW
-- concrete-stroke matches and labels them "configure stroke at order" (see
-- groq-advisor scoring.ts rankActuators + handleOptions labelling).
--
-- Values are manufacturer catalog-standard stroke ranges (mm). Long-stroke special
-- variants exist for several ISO families — verify against the datasheet at order.
--
-- NOTE: rotary / part-turn / semi-rotary / gripper / swing-clamp / rod-lock products
-- (Camozzi ARP, Festo DAPS/DRVS/DSR/DSM/EHPS, Metal Work R2/R3/SWC/PLT-10) are
-- intentionally EXCLUDED — a linear stroke does not apply to them. They are handled
-- by the ranking logic (ranked below concrete cylinders, never a silent match).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.product_specs (product_id, key, value, unit)
select p.id, 'stroke_range', v.rng, 'mm'
from public.products p
join (values
  -- SMC linear cylinder families
  ('SMC-C85',   '10–500'),   -- ISO 6432 round, Ø8–25
  ('SMC-CJ2',   '15–200'),   -- mini cylinder, Ø6–16
  ('SMC-CM2',   '25–300'),   -- compact stainless, Ø20–40
  ('SMC-CP96',  '25–1000'),  -- ISO 15552, Ø32–100
  ('SMC-CQ2',   '5–300'),    -- compact, Ø12–200
  ('SMC-CS1',   '50–1200'),  -- large bore, Ø125–300
  ('SMC-CY1R',  '50–2000'),  -- magnetically coupled rodless, Ø10–40
  ('SMC-MB',    '25–1000'),  -- ISO 15552 larger bores, Ø32–125
  ('SMC-MGPL',  '20–500'),   -- long-stroke guided slide table, Ø12–63
  ('SMC-MGPM',  '20–300'),   -- compact guided slide table, Ø12–63
  ('SMC-MXS',   '10–125'),   -- slide table, Ø6–25
  -- Metal Work linear cylinder families
  ('MW-CCIV-20','25–500'),   -- cylinder with integrated valve, Ø20
  ('MW-CCIV-32','25–500'),   -- cylinder with integrated valve, Ø32
  ('MW-CMPC',   '10–200'),   -- compact cylinder ISO 21287
  ('MW-HCR-32', '25–500'),   -- ISO 15552 HCR, Ø32
  ('MW-HCR-50', '25–500'),   -- ISO 15552 HCR, Ø50
  ('MW-HCR-80', '25–500'),   -- ISO 15552 HCR, Ø80
  ('MW-ISO15552','25–2000'), -- ISO 15552 tie-rod family (long-stroke to 2000)
  ('MW-RNDC',   '25–500'),   -- RNDC round cylinder family
  ('MW-RNDC-25','25–500'),   -- RNDC round cylinder, Ø25
  ('MW-RNDC-32','25–500'),   -- RNDC round cylinder, Ø32
  ('MW-RNDC-40','25–500'),   -- RNDC round cylinder, Ø40
  ('MW-RNDC-63','25–500'),   -- RNDC round cylinder, Ø63
  ('MW-SSCY',   '5–100')     -- short-stroke cylinder
) as v(sku, rng) on v.sku = p.sku
-- product_specs has no unique(product_id,key) in this DB, so guard with NOT EXISTS
-- (idempotent: re-running inserts nothing).
where not exists (
  select 1 from public.product_specs ps
  where ps.product_id = p.id and ps.key = 'stroke_range'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Catalog coverage: add electric-drivetrain categories and consolidate empty
-- duplicate categories.
--
-- The BOM showed "ej i katalog" for electric systems partly because there was no
-- home for servo motors / drives / controllers — the advisor literally had no
-- category to match. Add them so supplier catalogs can be imported into them.
--
-- Also drop four EMPTY duplicate categories that overlap canonical ones:
--   air-preparation → frl · hose → tubing · coupling → fitting · speed-controller → flow-control
-- (0 products each; the AI-import mapping that targeted air-preparation is
-- redirected to frl in ai.functions.ts in the same change.)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.categories (slug, name, description) values
  ('servo-motor', 'Servomotor',  'Servo- och stegmotorer (med/utan hållbroms) för elektriska axlar'),
  ('servo-drive', 'Servodrivare', 'Drivsteg/förstärkare (amplifier) för servo-/stegmotorer'),
  ('controller',  'Styrsystem',   'Rörelsestyrning / motion controller / PLC för fleraxliga system')
on conflict (slug) do nothing;

delete from public.categories
 where slug in ('air-preparation', 'hose', 'coupling', 'speed-controller');

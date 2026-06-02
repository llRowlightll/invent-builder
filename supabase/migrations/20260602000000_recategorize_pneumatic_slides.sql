-- ─────────────────────────────────────────────────────────────────────────────
-- Move 21 PNEUMATIC slides/tables out of 'linear-module' → 'cylinder'.
--
-- The advisor's isElectricActuator() treats EVERY product in 'linear-module' as an
-- electric axis. These 21 are pneumatic guided slides (operating_pressure 1.5–8 bar,
-- "Compact integrated cylinder", ball *guide* not ball *screw*), so they were
-- masquerading as precision electric ball-screw axes — winning precision jobs they
-- physically cannot do (repeatability ~0.1 mm, not ~0.003 mm) — and would be wrongly
-- excluded from ATEX (electric forbidden) while actually being safe pneumatics.
--
-- Surfaced by the property-based eval (eval-invariants.py): a precision request
-- returned MW-S10-12 ("Bästa valet") instead of an electric ball-screw / CUSTOM.
--
-- After this, 'linear-module' = electric axes only.
-- ─────────────────────────────────────────────────────────────────────────────

update public.products
set category_id = (select id from public.categories where slug = 'cylinder')
where category_id = (select id from public.categories where slug = 'linear-module')
  and sku in (
    'FESTO-15221','FESTO-175133','FESTO-530906',
    'MW-S10-12','MW-S10-16','MW-S10-20','MW-S10-25',
    'MW-S11-12','MW-S11-16','MW-S11-20','MW-S11-25',
    'MW-S12-16','MW-S12-20','MW-S12-25','MW-S12-30',
    'SMC-MXS6','SMC-MXS8','SMC-MXS12','SMC-MXS16','SMC-MXS20','SMC-MXS25'
  );

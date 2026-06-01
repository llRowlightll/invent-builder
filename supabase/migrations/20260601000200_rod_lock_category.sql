-- ─────────────────────────────────────────────────────────────────────────────
-- rod-lock category for the MW-PLT10 rod-locks.
--
-- Follows 20260601000100 (which moved 18 rotary + 1 gripper out of 'cylinder').
-- The PLT10 rod-locks were the last strokeless products left in 'cylinder'. They
-- clamp the piston rod for load holding on pressure loss (locking_force, fail-safe)
-- — neither a positioning cylinder nor a check valve — so they get their own
-- category and leave the linear-cylinder pool entirely (cylinder strokeless → 0).
--
-- categories.slug is UNIQUE, so WHERE NOT EXISTS is the idempotency guard; every
-- UPDATE is also guarded by category_id = <cylinder> + explicit SKU list.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.categories (slug, name, description)
select 'rod-lock', 'Stångbroms/Låsenhet',
       'Pneumatisk stångbroms/låsenhet som klämmer kolvstången för lasthållning vid tryckbortfall (locking_force, fail-safe) — ingen positioneringsslaglängd.'
where not exists (select 1 from public.categories where slug = 'rod-lock');

update public.products
set category_id = (select id from public.categories where slug = 'rod-lock')
where sku in ('MW-PLT10-32','MW-PLT10-50')
and category_id = (select id from public.categories where slug = 'cylinder');

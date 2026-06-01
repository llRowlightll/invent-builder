-- ─────────────────────────────────────────────────────────────────────────────
-- Move non-linear products out of the 'cylinder' category.
--
-- 18 rotary / semi-rotary / part-turn / swing-clamp products and 1 parallel
-- gripper were filed under 'cylinder' but have no linear stroke (they expose
-- rotation_angle / swivel_angle_max / torque / stroke_per_jaw). They were the
-- remaining strokeless products in 'cylinder' after the stroke_range data fix
-- (20260601000000). The advisor's ranking already keeps them below concrete
-- cylinders, but they should not be linear-stroke candidates at all.
--
-- detectCategories() (edge fn) and src/lib/physics.ts already reference the
-- 'rotary-actuator' slug, which had no DB row — this creates it.
--
-- MW-PLT10-32 / MW-PLT10-50 (rod-locks) intentionally stay in 'cylinder' — they
-- are cylinder-mounted locking units with no better category.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the rotary-actuator category (idempotent).
insert into public.categories (slug, name, description)
select 'rotary-actuator', 'Rotary Actuator',
       'Pneumatic rotary / semi-rotary / part-turn actuators and swing clamps (angular motion, not linear stroke).'
where not exists (select 1 from public.categories where slug = 'rotary-actuator');

-- 2. Move the 18 rotary products out of 'cylinder'.
update public.products
set category_id = (select id from public.categories where slug = 'rotary-actuator')
where sku in (
  'ARP-063-180','ARP-080-90',
  'FESTO-173188','FESTO-1845706','FESTO-33297','FESTO-8042184','FESTO-DAPS-032',
  'MW-R2-12','MW-R2-16','MW-R2-20','MW-R2-25',
  'MW-R3-16','MW-R3-20','MW-R3-22','MW-R3-25','MW-R3-30','MW-R3-40',
  'MW-SWC-90'
)
and category_id = (select id from public.categories where slug = 'cylinder');

-- 3. Move the parallel gripper into the existing 'gripper' category.
update public.products
set category_id = (select id from public.categories where slug = 'gripper')
where sku = 'FESTO-8070832'
and category_id = (select id from public.categories where slug = 'cylinder');

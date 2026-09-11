-- KPZ: produktraderna ur AVENTICS beställtabell.
-- GENERERAD ur src/lib/catalog/kpz.ts -- redigera inte för hand.
--
-- 93 riktiga artiklar in, 16 obelagda ut (satta till
-- 'discontinued', inte raderade -- inget pekar på dem men steget ska gå att ångra).
--
-- Källa: AVENTICS Series KPZ, short-stroke and compact cylinders, 2015-08-05,
-- knowledge_chunks source_file = f518f8d2b406b9b6ddf8f2d5e2bb02ac.pdf, beställtabellen i chunk 9-10.

begin;

-- Tillverkaren. Katalogen är märkt (c)AVENTICS S.a r.l.; serien såldes tidigare
-- som Rexroth Pneumatics och ägs i dag av Emerson. Raderna låg under
-- "Bosch Rexroth" och "Camozzi" -- den senare tillverkar ingen KPZ-serie.
insert into brands (slug, name) values ('aventics', 'AVENTICS')
on conflict (slug) do nothing;

-- Ut med de obelagda.
update products set status = 'discontinued', updated_at = now()
where lower(family) = 'kpz' and sku like 'KPZ-%';

-- Beställtabellen som den är: en borrningsaxel, en slagaxel, och sex tomma rutor.
create temporary table kpz_tabell on commit drop as
with borr(idx, bore_mm, rod_thread, port, f_ext, f_ret, p_min) as (values
    (0, 16, 'M4', 'M5', 127, 95, 1),
    (1, 20, 'M6', 'M5', 198, 148, 1),
    (2, 25, 'M6', 'M5', 309, 260, 1),
    (3, 32, 'M8', 'G 1/8', 507, 435, 0.6),
    (4, 40, 'M8', 'G 1/8', 792, 720, 0.6),
    (5, 50, 'M10', 'G 1/8', 1237, 1110, 0.6),
    (6, 63, 'M10', 'G 1/8', 1964, 1837, 0.6),
    (7, 80, 'M12', 'G 1/8', 3167, 2969, 0.6),
    (8, 100, 'M16', 'G 1/8', 4948, 4639, 0.6)
), slag(idx, stroke_mm) as (values (0, 5), (1, 10), (2, 15), (3, 20), (4, 25), (5, 30), (6, 40), (7, 50), (8, 60), (9, 80), (10, 100))
select
  '082239' || borr.idx || lpad(slag.idx::text, 3, '0') as sku,
  borr.bore_mm, slag.stroke_mm, borr.rod_thread, borr.port,
  borr.f_ext, borr.f_ret, borr.p_min
from borr cross join slag
where not (borr.idx in (0, 1, 2) and slag.idx in (9, 10));

insert into products (sku, name, description, family, brand_id, category_id,
                      availability, lead_time_days, status)
select t.sku,
       'AVENTICS KPZ Ø' || t.bore_mm || ' kompaktcylinder, ' || t.stroke_mm || ' mm slag',
       'Kompaktcylinder ur AVENTICS serie KPZ. Dubbelverkande, magnetkolv, '
         || 'elastisk dämpning, invändig kolvstångsgänga ' || t.rod_thread
         || ', anslutning ' || t.port || '.',
       'KPZ',
       (select id from brands where slug = 'aventics'),
       (select id from categories where slug = 'cylinder'),
       'order', 21, 'active'
from kpz_tabell t
on conflict (sku) do update set
  name = excluded.name, description = excluded.description,
  family = excluded.family, brand_id = excluded.brand_id,
  status = 'active', updated_at = now();

-- Specarna. Bara det katalogen faktiskt säger -- kraftvärdena är AVENTICS egna
-- per borrning, inte en formel och inte en annan familjs tabell.
delete from product_specs where product_id in (
  select id from products where lower(family) = 'kpz' and sku ~ '^082239'
);

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from kpz_tabell t
join products p on p.sku = t.sku
cross join lateral (values
  ('bore_mm', t.bore_mm::text),
  ('stroke_mm', t.stroke_mm::text),
  ('rod_thread', t.rod_thread),
  ('port', t.port),
  ('piston_force_6bar_N', t.f_ext::text),
  ('piston_force_retract_6bar_N', t.f_ret::text),
  ('min_pressure', t.p_min::text || ' bar'),
  ('max_pressure', '10 bar'),
  ('mode_of_operation', 'Double-acting'),
  ('cylinder_type', 'Compact cylinder'),
  ('magnetic_piston', 'Yes'),
  ('cushioning', 'Elastic')
) as s(key, value);

commit;


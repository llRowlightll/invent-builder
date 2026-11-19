-- Standardartiklar ur katalogmodellerna, som utkast (status 'draft').
-- GENERERAD av scripts/gen-standardartiklar.ts -- redigera inte för hand.
-- CJ2: 22, C85: 52; totalt 74.
--
-- Utkasten syns inte på sajten (alla publika frågor kräver status 'active').
-- Ägaren slår på dem per serie efter genomgång. En befintlig artikel med
-- samma kod rörs inte (on conflict do nothing) -- den kan redan vara aktiv.

begin;

-- CJ2: 22 artiklar
create temporary table std_cj2 on commit drop as
select * from (values
  ('CDJ2B6-15Z-B', 6, 15, 0.12),
  ('CDJ2B6-30Z-B', 6, 30, 0.12),
  ('CDJ2B6-45Z-B', 6, 45, 0.12),
  ('CDJ2B6-60Z-B', 6, 60, 0.12),
  ('CDJ2B10-15Z-B', 10, 15, 0.06),
  ('CDJ2B10-30Z-B', 10, 30, 0.06),
  ('CDJ2B10-45Z-B', 10, 45, 0.06),
  ('CDJ2B10-60Z-B', 10, 60, 0.06),
  ('CDJ2B10-75Z-B', 10, 75, 0.06),
  ('CDJ2B10-100Z-B', 10, 100, 0.06),
  ('CDJ2B10-125Z-B', 10, 125, 0.06),
  ('CDJ2B10-150Z-B', 10, 150, 0.06),
  ('CDJ2B16-15Z-B', 16, 15, 0.06),
  ('CDJ2B16-30Z-B', 16, 30, 0.06),
  ('CDJ2B16-45Z-B', 16, 45, 0.06),
  ('CDJ2B16-60Z-B', 16, 60, 0.06),
  ('CDJ2B16-75Z-B', 16, 75, 0.06),
  ('CDJ2B16-100Z-B', 16, 100, 0.06),
  ('CDJ2B16-125Z-B', 16, 125, 0.06),
  ('CDJ2B16-150Z-B', 16, 150, 0.06),
  ('CDJ2B16-175Z-B', 16, 175, 0.06),
  ('CDJ2B16-200Z-B', 16, 200, 0.06)
) as t(sku, bore, slag, pmin);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC CJ2 Ø' || t.bore::text || ' rundcylinder, ' || t.slag::text || ' mm slag', 'SMC CJ2 Ø' || t.bore::text || ' round cylinder, ' || t.slag::text || ' mm stroke',
  'Rundcylinder ur SMC serie CJ2 med cylinderrör och kolvstång i rostfritt stål, borrning Ø' || t.bore::text || ' mm, slaglängd ' || t.slag::text || ' mm. Dubbelverkande, inbyggd magnet för givare med givarfäste för band, gummidämpning, basutförande.',
  'Round cylinder from SMC series CJ2 with stainless steel cylinder tube and piston rod, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm. Double-acting, built-in magnet for sensors with band mounting for the sensor, rubber bumper, basic mounting.',
  'Rundzylinder der SMC-Serie CJ2 mit Zylinderrohr und Kolbenstange aus Edelstahl, Kolbendurchmesser Ø' || t.bore::text || ' mm, Hub ' || t.slag::text || ' mm. Doppeltwirkend, integrierter Magnet für Sensoren mit Bandbefestigung für den Sensor, Gummipuffer, Grundausführung.',
  'Cilindro redondo de la serie SMC CJ2 con tubo y vástago de acero inoxidable, diámetro Ø' || t.bore::text || ' mm, carrera ' || t.slag::text || ' mm. Doble efecto, imán incorporado para sensores con fijación por banda para el sensor, amortiguador de goma, ejecución básica.',
  'CJ2', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 7, 'draft'
from std_cj2 t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_cj2 t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('mode_of_operation', 'Double-acting'),
  ('position_sensing', 'Magnetic piston, band-mounted sensor'),
  ('cylinder_type', 'Round cylinder'),
  ('cushioning_types', 'Rubber bumper'),
  ('material', 'Cylinder tube and piston rod stainless steel, head cover aluminium alloy'),
  ('min_pressure_mpa', t.pmin::text),
  ('max_pressure', '7 bar'),
  ('temp_range', '-10…+70 °C (utan givare), -10…+60 °C (med givare)'),
  ('max_speed_mm_s', '750'),
  ('series', 'CJ2'),
  ('standard_kalla', 'SMC Air Cylinder CJ2 Series, SMC CJ2-Z catalogue (catalogue pages 69–187): How to Order och standardslag. knowledge_chunks smc-kat-cj2.pdf')
) as s(key, value)
where not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

-- C85: 52 artiklar
create temporary table std_c85 on commit drop as
select * from (values
  ('CD85N8-10-B', 8, 10, 0.1),
  ('CD85N8-25-B', 8, 25, 0.1),
  ('CD85N8-40-B', 8, 40, 0.1),
  ('CD85N8-50-B', 8, 50, 0.1),
  ('CD85N8-80-B', 8, 80, 0.1),
  ('CD85N8-100-B', 8, 100, 0.1),
  ('CD85N10-10-B', 10, 10, 0.08),
  ('CD85N10-25-B', 10, 25, 0.08),
  ('CD85N10-40-B', 10, 40, 0.08),
  ('CD85N10-50-B', 10, 50, 0.08),
  ('CD85N10-80-B', 10, 80, 0.08),
  ('CD85N10-100-B', 10, 100, 0.08),
  ('CD85N12-10-B', 12, 10, 0.08),
  ('CD85N12-25-B', 12, 25, 0.08),
  ('CD85N12-40-B', 12, 40, 0.08),
  ('CD85N12-50-B', 12, 50, 0.08),
  ('CD85N12-80-B', 12, 80, 0.08),
  ('CD85N12-100-B', 12, 100, 0.08),
  ('CD85N12-125-B', 12, 125, 0.08),
  ('CD85N12-160-B', 12, 160, 0.08),
  ('CD85N12-200-B', 12, 200, 0.08),
  ('CD85N16-10-B', 16, 10, 0.05),
  ('CD85N16-25-B', 16, 25, 0.05),
  ('CD85N16-40-B', 16, 40, 0.05),
  ('CD85N16-50-B', 16, 50, 0.05),
  ('CD85N16-80-B', 16, 80, 0.05),
  ('CD85N16-100-B', 16, 100, 0.05),
  ('CD85N16-125-B', 16, 125, 0.05),
  ('CD85N16-160-B', 16, 160, 0.05),
  ('CD85N16-200-B', 16, 200, 0.05),
  ('CD85N20-10-B', 20, 10, 0.05),
  ('CD85N20-25-B', 20, 25, 0.05),
  ('CD85N20-40-B', 20, 40, 0.05),
  ('CD85N20-50-B', 20, 50, 0.05),
  ('CD85N20-80-B', 20, 80, 0.05),
  ('CD85N20-100-B', 20, 100, 0.05),
  ('CD85N20-125-B', 20, 125, 0.05),
  ('CD85N20-160-B', 20, 160, 0.05),
  ('CD85N20-200-B', 20, 200, 0.05),
  ('CD85N20-250-B', 20, 250, 0.05),
  ('CD85N20-300-B', 20, 300, 0.05),
  ('CD85N25-10-B', 25, 10, 0.05),
  ('CD85N25-25-B', 25, 25, 0.05),
  ('CD85N25-40-B', 25, 40, 0.05),
  ('CD85N25-50-B', 25, 50, 0.05),
  ('CD85N25-80-B', 25, 80, 0.05),
  ('CD85N25-100-B', 25, 100, 0.05),
  ('CD85N25-125-B', 25, 125, 0.05),
  ('CD85N25-160-B', 25, 160, 0.05),
  ('CD85N25-200-B', 25, 200, 0.05),
  ('CD85N25-250-B', 25, 250, 0.05),
  ('CD85N25-300-B', 25, 300, 0.05)
) as t(sku, bore, slag, pmin);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC C85 Ø' || t.bore::text || ' ISO 6432-cylinder, ' || t.slag::text || ' mm slag', 'SMC C85 Ø' || t.bore::text || ' ISO 6432 cylinder, ' || t.slag::text || ' mm stroke',
  'Minicylinder enligt ISO 6432 ur SMC serie C85, borrning Ø' || t.bore::text || ' mm, slaglängd ' || t.slag::text || ' mm. Dubbelverkande, inbyggd magnet för givare med givarfäste för band, gummidämpning, basgavel med integrerat gaffelfäste.',
  'ISO 6432 mini cylinder from SMC series C85, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm. Double-acting, built-in magnet for sensors with band mounting for the sensor, rubber bumper, basic end cover with integrated clevis.',
  'Minizylinder nach ISO 6432 der SMC-Serie C85, Kolbendurchmesser Ø' || t.bore::text || ' mm, Hub ' || t.slag::text || ' mm. Doppeltwirkend, integrierter Magnet für Sensoren mit Bandbefestigung für den Sensor, Gummipuffer, Grunddeckel mit integriertem Gabelanschluss.',
  'Minicilindro ISO 6432 de la serie SMC C85, diámetro Ø' || t.bore::text || ' mm, carrera ' || t.slag::text || ' mm. Doble efecto, imán incorporado para sensores con fijación por banda para el sensor, amortiguador de goma, tapa básica con horquilla integrada.',
  'C85', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 7, 'draft'
from std_c85 t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_c85 t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('standard', 'ISO 6432'),
  ('mode_of_operation', 'Double-acting'),
  ('position_sensing', 'Magnetic piston, band-mounted sensor'),
  ('cushioning_types', 'Rubber bumper'),
  ('min_pressure_mpa', t.pmin::text),
  ('max_pressure', '10 bar'),
  ('temp_range', '-20…+80 °C (utan givare), -10…+60 °C (med givare)'),
  ('max_speed_mm_s', '1500'),
  ('series', 'C85'),
  ('standard_kalla', 'SMC ISO Standards Air Cylinder C85 Series, SMC C85/C75 catalogue (catalogue pages 6–124): How to Order och standardslag. knowledge_chunks smc-kat-c85.pdf')
) as s(key, value)
where not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

commit;

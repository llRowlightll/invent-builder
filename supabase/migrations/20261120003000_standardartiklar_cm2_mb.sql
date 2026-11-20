-- Standardartiklar ur katalogmodellerna, som utkast (status 'draft').
-- GENERERAD av scripts/gen-standardartiklar.ts -- redigera inte för hand.
-- CM2: 36, MB: 111; totalt 147.
--
-- Utkasten syns inte på sajten (alla publika frågor kräver status 'active').
-- Ägaren slår på dem per serie efter genomgång. En befintlig artikel med
-- samma kod rörs inte (on conflict do nothing) -- den kan redan vara aktiv.

begin;

-- CM2: 36 artiklar
create temporary table std_cm2 on commit drop as
select * from (values
  ('CDM2B20-25Z1', 20, 25),
  ('CDM2B20-50Z1', 20, 50),
  ('CDM2B20-75Z1', 20, 75),
  ('CDM2B20-100Z1', 20, 100),
  ('CDM2B20-125Z1', 20, 125),
  ('CDM2B20-150Z1', 20, 150),
  ('CDM2B20-200Z1', 20, 200),
  ('CDM2B20-250Z1', 20, 250),
  ('CDM2B20-300Z1', 20, 300),
  ('CDM2B25-25Z1', 25, 25),
  ('CDM2B25-50Z1', 25, 50),
  ('CDM2B25-75Z1', 25, 75),
  ('CDM2B25-100Z1', 25, 100),
  ('CDM2B25-125Z1', 25, 125),
  ('CDM2B25-150Z1', 25, 150),
  ('CDM2B25-200Z1', 25, 200),
  ('CDM2B25-250Z1', 25, 250),
  ('CDM2B25-300Z1', 25, 300),
  ('CDM2B32-25Z1', 32, 25),
  ('CDM2B32-50Z1', 32, 50),
  ('CDM2B32-75Z1', 32, 75),
  ('CDM2B32-100Z1', 32, 100),
  ('CDM2B32-125Z1', 32, 125),
  ('CDM2B32-150Z1', 32, 150),
  ('CDM2B32-200Z1', 32, 200),
  ('CDM2B32-250Z1', 32, 250),
  ('CDM2B32-300Z1', 32, 300),
  ('CDM2B40-25Z1', 40, 25),
  ('CDM2B40-50Z1', 40, 50),
  ('CDM2B40-75Z1', 40, 75),
  ('CDM2B40-100Z1', 40, 100),
  ('CDM2B40-125Z1', 40, 125),
  ('CDM2B40-150Z1', 40, 150),
  ('CDM2B40-200Z1', 40, 200),
  ('CDM2B40-250Z1', 40, 250),
  ('CDM2B40-300Z1', 40, 300)
) as t(sku, bore, slag);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC CM2 Ø' || t.bore::text || ' rundcylinder, ' || t.slag::text || ' mm slag', 'SMC CM2 Ø' || t.bore::text || ' round cylinder, ' || t.slag::text || ' mm stroke',
  'Rundcylinder ur SMC serie CM2 (Z1) med cylinderrör i rostfritt stål, borrning Ø' || t.bore::text || ' mm, slaglängd ' || t.slag::text || ' mm. Dubbelverkande, inbyggd magnet för givare, gummidämpning, basutförande. Rc-gänga som standard; G-gänga beställs med TF i koden.',
  'Round cylinder from SMC series CM2 (Z1) with stainless steel cylinder tube, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm. Double-acting, built-in magnet for sensors, rubber bumper, basic mounting. Rc port thread as standard; G thread is ordered with TF in the code.',
  'Rundzylinder der SMC-Serie CM2 (Z1) mit Zylinderrohr aus Edelstahl, Kolbendurchmesser Ø' || t.bore::text || ' mm, Hub ' || t.slag::text || ' mm. Doppeltwirkend, integrierter Magnet für Sensoren, Gummipuffer, Grundausführung. Anschlussgewinde Rc als Standard; G-Gewinde wird mit TF im Code bestellt.',
  'Cilindro redondo de la serie SMC CM2 (Z1) con tubo de acero inoxidable, diámetro Ø' || t.bore::text || ' mm, carrera ' || t.slag::text || ' mm. Doble efecto, imán incorporado para sensores, amortiguador de goma, ejecución básica. Rosca de conexión Rc de serie; la rosca G se pide con TF en el código.',
  'CM2', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 28, 'draft'
from std_cm2 t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_cm2 t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('mode_of_operation', 'Double-acting'),
  ('position_sensing', 'Magnetic piston'),
  ('cylinder_type', 'Round cylinder'),
  ('cushioning_types', 'Rubber bumper'),
  ('material', 'Cylinder tube stainless steel, piston rod carbon steel hard chrome plated, covers aluminium alloy'),
  ('min_pressure_mpa', '0.05'),
  ('max_pressure', '10 bar'),
  ('temp_range', '-10…+70 °C (utan givare), -10…+60 °C (med givare)'),
  ('max_speed_mm_s', '750'),
  ('series', 'CM2'),
  ('standard_kalla', 'SMC Air Cylinder CM2 Series (CM2-Z1), SMC CM2-Z1 catalogue (76 pages): How to Order s. 5, data och standardslag s. 6. knowledge_chunks smc-kat-cm2-z1.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

-- MB: 111 artiklar
create temporary table std_mb on commit drop as
select * from (values
  ('MDBB32-25Z', 32, 25, 'Rc 1/8'),
  ('MDBB32-50Z', 32, 50, 'Rc 1/8'),
  ('MDBB32-75Z', 32, 75, 'Rc 1/8'),
  ('MDBB32-100Z', 32, 100, 'Rc 1/8'),
  ('MDBB32-125Z', 32, 125, 'Rc 1/8'),
  ('MDBB32-150Z', 32, 150, 'Rc 1/8'),
  ('MDBB32-175Z', 32, 175, 'Rc 1/8'),
  ('MDBB32-200Z', 32, 200, 'Rc 1/8'),
  ('MDBB32-250Z', 32, 250, 'Rc 1/8'),
  ('MDBB32-300Z', 32, 300, 'Rc 1/8'),
  ('MDBB32-350Z', 32, 350, 'Rc 1/8'),
  ('MDBB32-400Z', 32, 400, 'Rc 1/8'),
  ('MDBB32-450Z', 32, 450, 'Rc 1/8'),
  ('MDBB32-500Z', 32, 500, 'Rc 1/8'),
  ('MDBB40-25Z', 40, 25, 'Rc 1/8'),
  ('MDBB40-50Z', 40, 50, 'Rc 1/8'),
  ('MDBB40-75Z', 40, 75, 'Rc 1/8'),
  ('MDBB40-100Z', 40, 100, 'Rc 1/8'),
  ('MDBB40-125Z', 40, 125, 'Rc 1/8'),
  ('MDBB40-150Z', 40, 150, 'Rc 1/8'),
  ('MDBB40-175Z', 40, 175, 'Rc 1/8'),
  ('MDBB40-200Z', 40, 200, 'Rc 1/8'),
  ('MDBB40-250Z', 40, 250, 'Rc 1/8'),
  ('MDBB40-300Z', 40, 300, 'Rc 1/8'),
  ('MDBB40-350Z', 40, 350, 'Rc 1/8'),
  ('MDBB40-400Z', 40, 400, 'Rc 1/8'),
  ('MDBB40-450Z', 40, 450, 'Rc 1/8'),
  ('MDBB40-500Z', 40, 500, 'Rc 1/8'),
  ('MDBB50-25Z', 50, 25, 'Rc 1/4'),
  ('MDBB50-50Z', 50, 50, 'Rc 1/4'),
  ('MDBB50-75Z', 50, 75, 'Rc 1/4'),
  ('MDBB50-100Z', 50, 100, 'Rc 1/4'),
  ('MDBB50-125Z', 50, 125, 'Rc 1/4'),
  ('MDBB50-150Z', 50, 150, 'Rc 1/4'),
  ('MDBB50-175Z', 50, 175, 'Rc 1/4'),
  ('MDBB50-200Z', 50, 200, 'Rc 1/4'),
  ('MDBB50-250Z', 50, 250, 'Rc 1/4'),
  ('MDBB50-300Z', 50, 300, 'Rc 1/4'),
  ('MDBB50-350Z', 50, 350, 'Rc 1/4'),
  ('MDBB50-400Z', 50, 400, 'Rc 1/4'),
  ('MDBB50-450Z', 50, 450, 'Rc 1/4'),
  ('MDBB50-500Z', 50, 500, 'Rc 1/4'),
  ('MDBB50-600Z', 50, 600, 'Rc 1/4'),
  ('MDBB63-25Z', 63, 25, 'Rc 1/4'),
  ('MDBB63-50Z', 63, 50, 'Rc 1/4'),
  ('MDBB63-75Z', 63, 75, 'Rc 1/4'),
  ('MDBB63-100Z', 63, 100, 'Rc 1/4'),
  ('MDBB63-125Z', 63, 125, 'Rc 1/4'),
  ('MDBB63-150Z', 63, 150, 'Rc 1/4'),
  ('MDBB63-175Z', 63, 175, 'Rc 1/4'),
  ('MDBB63-200Z', 63, 200, 'Rc 1/4'),
  ('MDBB63-250Z', 63, 250, 'Rc 1/4'),
  ('MDBB63-300Z', 63, 300, 'Rc 1/4'),
  ('MDBB63-350Z', 63, 350, 'Rc 1/4'),
  ('MDBB63-400Z', 63, 400, 'Rc 1/4'),
  ('MDBB63-450Z', 63, 450, 'Rc 1/4'),
  ('MDBB63-500Z', 63, 500, 'Rc 1/4'),
  ('MDBB63-600Z', 63, 600, 'Rc 1/4'),
  ('MDBB80-25Z', 80, 25, 'Rc 3/8'),
  ('MDBB80-50Z', 80, 50, 'Rc 3/8'),
  ('MDBB80-75Z', 80, 75, 'Rc 3/8'),
  ('MDBB80-100Z', 80, 100, 'Rc 3/8'),
  ('MDBB80-125Z', 80, 125, 'Rc 3/8'),
  ('MDBB80-150Z', 80, 150, 'Rc 3/8'),
  ('MDBB80-175Z', 80, 175, 'Rc 3/8'),
  ('MDBB80-200Z', 80, 200, 'Rc 3/8'),
  ('MDBB80-250Z', 80, 250, 'Rc 3/8'),
  ('MDBB80-300Z', 80, 300, 'Rc 3/8'),
  ('MDBB80-350Z', 80, 350, 'Rc 3/8'),
  ('MDBB80-400Z', 80, 400, 'Rc 3/8'),
  ('MDBB80-450Z', 80, 450, 'Rc 3/8'),
  ('MDBB80-500Z', 80, 500, 'Rc 3/8'),
  ('MDBB80-600Z', 80, 600, 'Rc 3/8'),
  ('MDBB80-700Z', 80, 700, 'Rc 3/8'),
  ('MDBB80-800Z', 80, 800, 'Rc 3/8'),
  ('MDBB100-25Z', 100, 25, 'Rc 3/8'),
  ('MDBB100-50Z', 100, 50, 'Rc 3/8'),
  ('MDBB100-75Z', 100, 75, 'Rc 3/8'),
  ('MDBB100-100Z', 100, 100, 'Rc 3/8'),
  ('MDBB100-125Z', 100, 125, 'Rc 3/8'),
  ('MDBB100-150Z', 100, 150, 'Rc 3/8'),
  ('MDBB100-175Z', 100, 175, 'Rc 3/8'),
  ('MDBB100-200Z', 100, 200, 'Rc 3/8'),
  ('MDBB100-250Z', 100, 250, 'Rc 3/8'),
  ('MDBB100-300Z', 100, 300, 'Rc 3/8'),
  ('MDBB100-350Z', 100, 350, 'Rc 3/8'),
  ('MDBB100-400Z', 100, 400, 'Rc 3/8'),
  ('MDBB100-450Z', 100, 450, 'Rc 3/8'),
  ('MDBB100-500Z', 100, 500, 'Rc 3/8'),
  ('MDBB100-600Z', 100, 600, 'Rc 3/8'),
  ('MDBB100-700Z', 100, 700, 'Rc 3/8'),
  ('MDBB100-800Z', 100, 800, 'Rc 3/8'),
  ('MDBB125-25Z', 125, 25, 'Rc 1/2'),
  ('MDBB125-50Z', 125, 50, 'Rc 1/2'),
  ('MDBB125-75Z', 125, 75, 'Rc 1/2'),
  ('MDBB125-100Z', 125, 100, 'Rc 1/2'),
  ('MDBB125-125Z', 125, 125, 'Rc 1/2'),
  ('MDBB125-150Z', 125, 150, 'Rc 1/2'),
  ('MDBB125-175Z', 125, 175, 'Rc 1/2'),
  ('MDBB125-200Z', 125, 200, 'Rc 1/2'),
  ('MDBB125-250Z', 125, 250, 'Rc 1/2'),
  ('MDBB125-300Z', 125, 300, 'Rc 1/2'),
  ('MDBB125-350Z', 125, 350, 'Rc 1/2'),
  ('MDBB125-400Z', 125, 400, 'Rc 1/2'),
  ('MDBB125-450Z', 125, 450, 'Rc 1/2'),
  ('MDBB125-500Z', 125, 500, 'Rc 1/2'),
  ('MDBB125-600Z', 125, 600, 'Rc 1/2'),
  ('MDBB125-700Z', 125, 700, 'Rc 1/2'),
  ('MDBB125-800Z', 125, 800, 'Rc 1/2'),
  ('MDBB125-900Z', 125, 900, 'Rc 1/2'),
  ('MDBB125-1000Z', 125, 1000, 'Rc 1/2')
) as t(sku, bore, slag, port);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC MB Ø' || t.bore::text || ' dragstångscylinder, ' || t.slag::text || ' mm slag', 'SMC MB Ø' || t.bore::text || ' tie-rod cylinder, ' || t.slag::text || ' mm stroke',
  'Dragstångscylinder ur SMC serie MB, borrning Ø' || t.bore::text || ' mm, slaglängd ' || t.slag::text || ' mm, anslutning ' || t.port::text || '. Dubbelverkande, inbyggd magnet för givare, luftdämpning, basutförande. G-gänga beställs med TF i koden.',
  'Tie-rod cylinder from SMC series MB, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm, port ' || t.port::text || '. Double-acting, built-in magnet for sensors, air cushion, basic mounting. G thread is ordered with TF in the code.',
  'Zugankerzylinder der SMC-Serie MB, Kolbendurchmesser Ø' || t.bore::text || ' mm, Hub ' || t.slag::text || ' mm, Anschluss ' || t.port::text || '. Doppeltwirkend, integrierter Magnet für Sensoren, Luftdämpfung, Grundausführung. G-Gewinde wird mit TF im Code bestellt.',
  'Cilindro con tirantes de la serie SMC MB, diámetro Ø' || t.bore::text || ' mm, carrera ' || t.slag::text || ' mm, conexión ' || t.port::text || '. Doble efecto, imán incorporado para sensores, amortiguación neumática, ejecución básica. La rosca G se pide con TF en el código.',
  'MB', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 28, 'draft'
from std_mb t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_mb t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('mode_of_operation', 'Double-acting'),
  ('position_sensing', 'Magnetic piston'),
  ('cylinder_type', 'Tie-rod cylinder'),
  ('cushioning_types', 'Air cushion'),
  ('port', t.port::text),
  ('min_pressure_mpa', '0.05'),
  ('max_pressure', '10 bar'),
  ('temp_range', '-10…+70 °C (utan givare), -10…+60 °C (med givare)'),
  ('max_speed_mm_s', '1000'),
  ('series', 'MB'),
  ('standard_kalla', 'SMC Air Cylinder MB Series, SMC MB catalogue (catalogue pages 477–524): How to Order s. 482, data och standardslag s. 483. knowledge_chunks smc-kat-mb.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

commit;

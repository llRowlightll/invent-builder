-- Standardartiklar ur katalogmodellerna, som utkast (status 'draft').
-- GENERERAD av scripts/gen-standardartiklar.ts -- redigera inte för hand.
-- CP96: 74, CQ2: 100; totalt 174.
--
-- Utkasten syns inte på sajten (alla publika frågor kräver status 'active').
-- Ägaren slår på dem per serie efter genomgång. En befintlig artikel med
-- samma kod rörs inte (on conflict do nothing) -- den kan redan vara aktiv.

begin;

-- CP96: 74 artiklar
create temporary table std_cp96 on commit drop as
select * from (values
  ('CP96SDB32-25C', 32, 25, 'G1/8', 1000),
  ('CP96SDB32-50C', 32, 50, 'G1/8', 1000),
  ('CP96SDB32-80C', 32, 80, 'G1/8', 1000),
  ('CP96SDB32-100C', 32, 100, 'G1/8', 1000),
  ('CP96SDB32-125C', 32, 125, 'G1/8', 1000),
  ('CP96SDB32-160C', 32, 160, 'G1/8', 1000),
  ('CP96SDB32-200C', 32, 200, 'G1/8', 1000),
  ('CP96SDB32-250C', 32, 250, 'G1/8', 1000),
  ('CP96SDB32-320C', 32, 320, 'G1/8', 1000),
  ('CP96SDB32-400C', 32, 400, 'G1/8', 1000),
  ('CP96SDB32-500C', 32, 500, 'G1/8', 1000),
  ('CP96SDB40-25C', 40, 25, 'G1/4', 1000),
  ('CP96SDB40-50C', 40, 50, 'G1/4', 1000),
  ('CP96SDB40-80C', 40, 80, 'G1/4', 1000),
  ('CP96SDB40-100C', 40, 100, 'G1/4', 1000),
  ('CP96SDB40-125C', 40, 125, 'G1/4', 1000),
  ('CP96SDB40-160C', 40, 160, 'G1/4', 1000),
  ('CP96SDB40-200C', 40, 200, 'G1/4', 1000),
  ('CP96SDB40-250C', 40, 250, 'G1/4', 1000),
  ('CP96SDB40-320C', 40, 320, 'G1/4', 1000),
  ('CP96SDB40-400C', 40, 400, 'G1/4', 1000),
  ('CP96SDB40-500C', 40, 500, 'G1/4', 1000),
  ('CP96SDB50-25C', 50, 25, 'G1/4', 1000),
  ('CP96SDB50-50C', 50, 50, 'G1/4', 1000),
  ('CP96SDB50-80C', 50, 80, 'G1/4', 1000),
  ('CP96SDB50-100C', 50, 100, 'G1/4', 1000),
  ('CP96SDB50-125C', 50, 125, 'G1/4', 1000),
  ('CP96SDB50-160C', 50, 160, 'G1/4', 1000),
  ('CP96SDB50-200C', 50, 200, 'G1/4', 1000),
  ('CP96SDB50-250C', 50, 250, 'G1/4', 1000),
  ('CP96SDB50-320C', 50, 320, 'G1/4', 1000),
  ('CP96SDB50-400C', 50, 400, 'G1/4', 1000),
  ('CP96SDB50-500C', 50, 500, 'G1/4', 1000),
  ('CP96SDB50-600C', 50, 600, 'G1/4', 1000),
  ('CP96SDB63-25C', 63, 25, 'G3/8', 1000),
  ('CP96SDB63-50C', 63, 50, 'G3/8', 1000),
  ('CP96SDB63-80C', 63, 80, 'G3/8', 1000),
  ('CP96SDB63-100C', 63, 100, 'G3/8', 1000),
  ('CP96SDB63-125C', 63, 125, 'G3/8', 1000),
  ('CP96SDB63-160C', 63, 160, 'G3/8', 1000),
  ('CP96SDB63-200C', 63, 200, 'G3/8', 1000),
  ('CP96SDB63-250C', 63, 250, 'G3/8', 1000),
  ('CP96SDB63-320C', 63, 320, 'G3/8', 1000),
  ('CP96SDB63-400C', 63, 400, 'G3/8', 1000),
  ('CP96SDB63-500C', 63, 500, 'G3/8', 1000),
  ('CP96SDB63-600C', 63, 600, 'G3/8', 1000),
  ('CP96SDB80-25C', 80, 25, 'G3/8', 1000),
  ('CP96SDB80-50C', 80, 50, 'G3/8', 1000),
  ('CP96SDB80-80C', 80, 80, 'G3/8', 1000),
  ('CP96SDB80-100C', 80, 100, 'G3/8', 1000),
  ('CP96SDB80-125C', 80, 125, 'G3/8', 1000),
  ('CP96SDB80-160C', 80, 160, 'G3/8', 1000),
  ('CP96SDB80-200C', 80, 200, 'G3/8', 1000),
  ('CP96SDB80-250C', 80, 250, 'G3/8', 1000),
  ('CP96SDB80-320C', 80, 320, 'G3/8', 1000),
  ('CP96SDB80-400C', 80, 400, 'G3/8', 1000),
  ('CP96SDB80-500C', 80, 500, 'G3/8', 1000),
  ('CP96SDB80-600C', 80, 600, 'G3/8', 1000),
  ('CP96SDB80-700C', 80, 700, 'G3/8', 1000),
  ('CP96SDB80-800C', 80, 800, 'G3/8', 1000),
  ('CP96SDB100-25C', 100, 25, 'G1/2', 1000),
  ('CP96SDB100-50C', 100, 50, 'G1/2', 1000),
  ('CP96SDB100-80C', 100, 80, 'G1/2', 1000),
  ('CP96SDB100-100C', 100, 100, 'G1/2', 1000),
  ('CP96SDB100-125C', 100, 125, 'G1/2', 1000),
  ('CP96SDB100-160C', 100, 160, 'G1/2', 1000),
  ('CP96SDB100-200C', 100, 200, 'G1/2', 1000),
  ('CP96SDB100-250C', 100, 250, 'G1/2', 1000),
  ('CP96SDB100-320C', 100, 320, 'G1/2', 1000),
  ('CP96SDB100-400C', 100, 400, 'G1/2', 1000),
  ('CP96SDB100-500C', 100, 500, 'G1/2', 1000),
  ('CP96SDB100-600C', 100, 600, 'G1/2', 1000),
  ('CP96SDB100-700C', 100, 700, 'G1/2', 1000),
  ('CP96SDB100-800C', 100, 800, 'G1/2', 1000)
) as t(sku, bore, slag, port, vmax);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC CP96 Ø' || t.bore::text || ' ISO 15552-cylinder, ' || t.slag::text || ' mm slag', 'SMC CP96 Ø' || t.bore::text || ' ISO 15552 cylinder, ' || t.slag::text || ' mm stroke',
  'ISO 15552-cylinder ur SMC serie CP96, borrning Ø' || t.bore::text || ' mm, slaglängd ' || t.slag::text || ' mm, anslutning ' || t.port::text || '. Dubbelverkande, inbyggd magnet för givare, basutförande, luftdämpning i båda ändar plus gummidämpning.',
  'ISO 15552 cylinder from SMC series CP96, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm, port ' || t.port::text || '. Double-acting, built-in magnet for sensors, basic mounting, air cushion at both ends plus rubber bumper.',
  'ISO-15552-Zylinder der SMC-Serie CP96, Kolbendurchmesser Ø' || t.bore::text || ' mm, Hub ' || t.slag::text || ' mm, Anschluss ' || t.port::text || '. Doppeltwirkend, integrierter Magnet für Sensoren, Grundausführung, Luftdämpfung an beiden Enden plus Gummipuffer.',
  'Cilindro ISO 15552 de la serie SMC CP96, diámetro Ø' || t.bore::text || ' mm, carrera ' || t.slag::text || ' mm, conexión ' || t.port::text || '. Doble efecto, imán incorporado para sensores, ejecución básica, amortiguación neumática en ambos extremos más amortiguador de goma.',
  'CP96', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 28, 'draft'
from std_cp96 t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_cp96 t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('standard', 'ISO 15552'),
  ('mode_of_operation', 'Double-acting'),
  ('position_sensing', 'Magnetic piston'),
  ('cushioning_types', 'Air cushion both ends + rubber bumper'),
  ('port', t.port::text),
  ('max_pressure', '10 bar'),
  ('min_pressure_mpa', '0.05'),
  ('temp_range', '-20…+70 °C (utan givare), -10…+60 °C (med givare)'),
  ('max_speed_mm_s', t.vmax::text),
  ('series', 'CP96'),
  ('standard_kalla', 'SMC ISO Cylinder CP96 Series (ISO 15552), SMC CP96 catalogue (catalogue pages 126–160): How to Order s. 129, standardslag och data s. 130. knowledge_chunks smc-kat-cp96.pdf')
) as s(key, value)
where not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

-- CQ2: 100 artiklar
create temporary table std_cq2 on commit drop as
select * from (values
  ('CDQ2B12-5DZ', 12, 5, 57, 0.07),
  ('CDQ2B12-10DZ', 12, 10, 57, 0.07),
  ('CDQ2B12-15DZ', 12, 15, 57, 0.07),
  ('CDQ2B12-20DZ', 12, 20, 57, 0.07),
  ('CDQ2B12-25DZ', 12, 25, 57, 0.07),
  ('CDQ2B12-30DZ', 12, 30, 57, 0.07),
  ('CDQ2B16-5DZ', 16, 5, 101, 0.07),
  ('CDQ2B16-10DZ', 16, 10, 101, 0.07),
  ('CDQ2B16-15DZ', 16, 15, 101, 0.07),
  ('CDQ2B16-20DZ', 16, 20, 101, 0.07),
  ('CDQ2B16-25DZ', 16, 25, 101, 0.07),
  ('CDQ2B16-30DZ', 16, 30, 101, 0.07),
  ('CDQ2B20-5DZ', 20, 5, 157, 0.05),
  ('CDQ2B20-10DZ', 20, 10, 157, 0.05),
  ('CDQ2B20-15DZ', 20, 15, 157, 0.05),
  ('CDQ2B20-20DZ', 20, 20, 157, 0.05),
  ('CDQ2B20-25DZ', 20, 25, 157, 0.05),
  ('CDQ2B20-30DZ', 20, 30, 157, 0.05),
  ('CDQ2B20-35DZ', 20, 35, 157, 0.05),
  ('CDQ2B20-40DZ', 20, 40, 157, 0.05),
  ('CDQ2B20-45DZ', 20, 45, 157, 0.05),
  ('CDQ2B20-50DZ', 20, 50, 157, 0.05),
  ('CDQ2B25-5DZ', 25, 5, 245, 0.05),
  ('CDQ2B25-10DZ', 25, 10, 245, 0.05),
  ('CDQ2B25-15DZ', 25, 15, 245, 0.05),
  ('CDQ2B25-20DZ', 25, 20, 245, 0.05),
  ('CDQ2B25-25DZ', 25, 25, 245, 0.05),
  ('CDQ2B25-30DZ', 25, 30, 245, 0.05),
  ('CDQ2B25-35DZ', 25, 35, 245, 0.05),
  ('CDQ2B25-40DZ', 25, 40, 245, 0.05),
  ('CDQ2B25-45DZ', 25, 45, 245, 0.05),
  ('CDQ2B25-50DZ', 25, 50, 245, 0.05),
  ('CDQ2B32-5DZ', 32, 5, 402, 0.05),
  ('CDQ2B32-10DZ', 32, 10, 402, 0.05),
  ('CDQ2B32-15DZ', 32, 15, 402, 0.05),
  ('CDQ2B32-20DZ', 32, 20, 402, 0.05),
  ('CDQ2B32-25DZ', 32, 25, 402, 0.05),
  ('CDQ2B32-30DZ', 32, 30, 402, 0.05),
  ('CDQ2B32-35DZ', 32, 35, 402, 0.05),
  ('CDQ2B32-40DZ', 32, 40, 402, 0.05),
  ('CDQ2B32-45DZ', 32, 45, 402, 0.05),
  ('CDQ2B32-50DZ', 32, 50, 402, 0.05),
  ('CDQ2B32-75DZ', 32, 75, 402, 0.05),
  ('CDQ2B32-100DZ', 32, 100, 402, 0.05),
  ('CDQ2B40-5DZ', 40, 5, 628, 0.05),
  ('CDQ2B40-10DZ', 40, 10, 628, 0.05),
  ('CDQ2B40-15DZ', 40, 15, 628, 0.05),
  ('CDQ2B40-20DZ', 40, 20, 628, 0.05),
  ('CDQ2B40-25DZ', 40, 25, 628, 0.05),
  ('CDQ2B40-30DZ', 40, 30, 628, 0.05),
  ('CDQ2B40-35DZ', 40, 35, 628, 0.05),
  ('CDQ2B40-40DZ', 40, 40, 628, 0.05),
  ('CDQ2B40-45DZ', 40, 45, 628, 0.05),
  ('CDQ2B40-50DZ', 40, 50, 628, 0.05),
  ('CDQ2B40-75DZ', 40, 75, 628, 0.05),
  ('CDQ2B40-100DZ', 40, 100, 628, 0.05),
  ('CDQ2B50-10DZ', 50, 10, 982, 0.05),
  ('CDQ2B50-15DZ', 50, 15, 982, 0.05),
  ('CDQ2B50-20DZ', 50, 20, 982, 0.05),
  ('CDQ2B50-25DZ', 50, 25, 982, 0.05),
  ('CDQ2B50-30DZ', 50, 30, 982, 0.05),
  ('CDQ2B50-35DZ', 50, 35, 982, 0.05),
  ('CDQ2B50-40DZ', 50, 40, 982, 0.05),
  ('CDQ2B50-45DZ', 50, 45, 982, 0.05),
  ('CDQ2B50-50DZ', 50, 50, 982, 0.05),
  ('CDQ2B50-75DZ', 50, 75, 982, 0.05),
  ('CDQ2B50-100DZ', 50, 100, 982, 0.05),
  ('CDQ2B63-10DZ', 63, 10, 1560, 0.05),
  ('CDQ2B63-15DZ', 63, 15, 1560, 0.05),
  ('CDQ2B63-20DZ', 63, 20, 1560, 0.05),
  ('CDQ2B63-25DZ', 63, 25, 1560, 0.05),
  ('CDQ2B63-30DZ', 63, 30, 1560, 0.05),
  ('CDQ2B63-35DZ', 63, 35, 1560, 0.05),
  ('CDQ2B63-40DZ', 63, 40, 1560, 0.05),
  ('CDQ2B63-45DZ', 63, 45, 1560, 0.05),
  ('CDQ2B63-50DZ', 63, 50, 1560, 0.05),
  ('CDQ2B63-75DZ', 63, 75, 1560, 0.05),
  ('CDQ2B63-100DZ', 63, 100, 1560, 0.05),
  ('CDQ2B80-10DZ', 80, 10, 2510, 0.05),
  ('CDQ2B80-15DZ', 80, 15, 2510, 0.05),
  ('CDQ2B80-20DZ', 80, 20, 2510, 0.05),
  ('CDQ2B80-25DZ', 80, 25, 2510, 0.05),
  ('CDQ2B80-30DZ', 80, 30, 2510, 0.05),
  ('CDQ2B80-35DZ', 80, 35, 2510, 0.05),
  ('CDQ2B80-40DZ', 80, 40, 2510, 0.05),
  ('CDQ2B80-45DZ', 80, 45, 2510, 0.05),
  ('CDQ2B80-50DZ', 80, 50, 2510, 0.05),
  ('CDQ2B80-75DZ', 80, 75, 2510, 0.05),
  ('CDQ2B80-100DZ', 80, 100, 2510, 0.05),
  ('CDQ2B100-10DZ', 100, 10, 3930, 0.05),
  ('CDQ2B100-15DZ', 100, 15, 3930, 0.05),
  ('CDQ2B100-20DZ', 100, 20, 3930, 0.05),
  ('CDQ2B100-25DZ', 100, 25, 3930, 0.05),
  ('CDQ2B100-30DZ', 100, 30, 3930, 0.05),
  ('CDQ2B100-35DZ', 100, 35, 3930, 0.05),
  ('CDQ2B100-40DZ', 100, 40, 3930, 0.05),
  ('CDQ2B100-45DZ', 100, 45, 3930, 0.05),
  ('CDQ2B100-50DZ', 100, 50, 3930, 0.05),
  ('CDQ2B100-75DZ', 100, 75, 3930, 0.05),
  ('CDQ2B100-100DZ', 100, 100, 3930, 0.05)
) as t(sku, bore, slag, kraft, pmin);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC CQ2 Ø' || t.bore::text || ' kompaktcylinder, ' || t.slag::text || ' mm slag', 'SMC CQ2 Ø' || t.bore::text || ' compact cylinder, ' || t.slag::text || ' mm stroke',
  'Kompaktcylinder ur SMC serie CQ2, borrning Ø' || t.bore::text || ' mm, slaglängd ' || t.slag::text || ' mm. Dubbelverkande, inbyggd magnet för givare, genomgående hål för montering. Teoretisk kraft utåt ' || t.kraft::text || ' N vid 0,5 MPa.',
  'Compact cylinder from SMC series CQ2, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm. Double-acting, built-in magnet for sensors, through-hole mounting. Theoretical output force ' || t.kraft::text || ' N at 0.5 MPa.',
  'Kompaktzylinder der SMC-Serie CQ2, Kolbendurchmesser Ø' || t.bore::text || ' mm, Hub ' || t.slag::text || ' mm. Doppeltwirkend, integrierter Magnet für Sensoren, Durchgangsbohrungen zur Befestigung. Theoretische Kraft ausfahrend ' || t.kraft::text || ' N bei 0,5 MPa.',
  'Cilindro compacto de la serie SMC CQ2, diámetro Ø' || t.bore::text || ' mm, carrera ' || t.slag::text || ' mm. Doble efecto, imán incorporado para sensores, montaje con taladros pasantes. Fuerza teórica de avance ' || t.kraft::text || ' N a 0,5 MPa.',
  'CQ2', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 7, 'draft'
from std_cq2 t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_cq2 t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('mode_of_operation', 'Double-acting'),
  ('position_sensing', 'Magnetic piston'),
  ('cylinder_type', 'Compact cylinder'),
  ('force_out_n_05mpa', t.kraft::text),
  ('min_pressure_mpa', t.pmin::text),
  ('max_pressure', '10 bar'),
  ('temp_range', '-10…+70 °C (utan givare), -10…+60 °C (med givare)'),
  ('max_speed_mm_s', '500'),
  ('series', 'CQ2'),
  ('standard_kalla', 'SMC Compact Cylinder Series CQ2, SMC CQ2 catalogue (catalogue pages 785–958): How to Order s. 785, standardslag s. 786, kraft s. 789. knowledge_chunks smc-kat-cq2.pdf')
) as s(key, value)
where not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

commit;

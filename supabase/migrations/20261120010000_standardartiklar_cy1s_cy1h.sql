-- Standardartiklar ur katalogmodellerna, som utkast (status 'draft').
-- GENERERAD av scripts/gen-standardartiklar.ts -- redigera inte för hand.
-- CY1S: 70, CY1H: 29; totalt 99.
--
-- Utkasten syns inte på sajten (alla publika frågor kräver status 'active').
-- Ägaren slår på dem per serie efter genomgång. En befintlig artikel med
-- samma kod rörs inte (on conflict do nothing) -- den kan redan vara aktiv.

begin;

-- CY1S: 70 artiklar
create temporary table std_cy1s on commit drop as
select * from (values
  ('CY1S6-50Z', 6, 50, 19.6),
  ('CY1S6-100Z', 6, 100, 19.6),
  ('CY1S6-150Z', 6, 150, 19.6),
  ('CY1S6-200Z', 6, 200, 19.6),
  ('CY1S10-50Z', 10, 50, 53.9),
  ('CY1S10-100Z', 10, 100, 53.9),
  ('CY1S10-150Z', 10, 150, 53.9),
  ('CY1S10-200Z', 10, 200, 53.9),
  ('CY1S10-250Z', 10, 250, 53.9),
  ('CY1S10-300Z', 10, 300, 53.9),
  ('CY1S15-50Z', 15, 50, 137),
  ('CY1S15-100Z', 15, 100, 137),
  ('CY1S15-150Z', 15, 150, 137),
  ('CY1S15-200Z', 15, 200, 137),
  ('CY1S15-250Z', 15, 250, 137),
  ('CY1S15-300Z', 15, 300, 137),
  ('CY1S15-350Z', 15, 350, 137),
  ('CY1S15-400Z', 15, 400, 137),
  ('CY1S15-450Z', 15, 450, 137),
  ('CY1S15-500Z', 15, 500, 137),
  ('CY1S20-100Z', 20, 100, 231),
  ('CY1S20-150Z', 20, 150, 231),
  ('CY1S20-200Z', 20, 200, 231),
  ('CY1S20-250Z', 20, 250, 231),
  ('CY1S20-300Z', 20, 300, 231),
  ('CY1S20-350Z', 20, 350, 231),
  ('CY1S20-400Z', 20, 400, 231),
  ('CY1S20-450Z', 20, 450, 231),
  ('CY1S20-500Z', 20, 500, 231),
  ('CY1S20-600Z', 20, 600, 231),
  ('CY1S20-700Z', 20, 700, 231),
  ('CY1S20-800Z', 20, 800, 231),
  ('CY1S25-100Z', 25, 100, 363),
  ('CY1S25-150Z', 25, 150, 363),
  ('CY1S25-200Z', 25, 200, 363),
  ('CY1S25-250Z', 25, 250, 363),
  ('CY1S25-300Z', 25, 300, 363),
  ('CY1S25-350Z', 25, 350, 363),
  ('CY1S25-400Z', 25, 400, 363),
  ('CY1S25-450Z', 25, 450, 363),
  ('CY1S25-500Z', 25, 500, 363),
  ('CY1S25-600Z', 25, 600, 363),
  ('CY1S25-700Z', 25, 700, 363),
  ('CY1S25-800Z', 25, 800, 363),
  ('CY1S32-100Z', 32, 100, 588),
  ('CY1S32-150Z', 32, 150, 588),
  ('CY1S32-200Z', 32, 200, 588),
  ('CY1S32-250Z', 32, 250, 588),
  ('CY1S32-300Z', 32, 300, 588),
  ('CY1S32-350Z', 32, 350, 588),
  ('CY1S32-400Z', 32, 400, 588),
  ('CY1S32-450Z', 32, 450, 588),
  ('CY1S32-500Z', 32, 500, 588),
  ('CY1S32-600Z', 32, 600, 588),
  ('CY1S32-700Z', 32, 700, 588),
  ('CY1S32-800Z', 32, 800, 588),
  ('CY1S40-100Z', 40, 100, 922),
  ('CY1S40-150Z', 40, 150, 922),
  ('CY1S40-200Z', 40, 200, 922),
  ('CY1S40-250Z', 40, 250, 922),
  ('CY1S40-300Z', 40, 300, 922),
  ('CY1S40-350Z', 40, 350, 922),
  ('CY1S40-400Z', 40, 400, 922),
  ('CY1S40-450Z', 40, 450, 922),
  ('CY1S40-500Z', 40, 500, 922),
  ('CY1S40-600Z', 40, 600, 922),
  ('CY1S40-700Z', 40, 700, 922),
  ('CY1S40-800Z', 40, 800, 922),
  ('CY1S40-900Z', 40, 900, 922),
  ('CY1S40-1000Z', 40, 1000, 922)
) as t(sku, bore, slag, hall);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC CY1S Ø' || t.bore::text || ' kolvstångslös cylinder, ' || t.slag::text || ' mm slag', 'SMC CY1S Ø' || t.bore::text || ' rodless cylinder, ' || t.slag::text || ' mm stroke',
  'Magnetkopplad kolvstångslös cylinder ur SMC serie CY1S, slidtyp med glidlager, borrning Ø' || t.bore::text || ' mm, slaglängd ' || t.slag::text || ' mm, magnetisk hållkraft ' || t.hall::text || ' N. Dubbelverkande, gummibuffert i båda ändar, inbyggd magnet för givare.',
  'Magnetically coupled rodless cylinder from SMC series CY1S, slider type with slide bearing, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm, magnetic holding force ' || t.hall::text || ' N. Double-acting, rubber bumper at both ends, built-in magnet for sensors.',
  'Magnetisch gekoppelter kolbenstangenloser Zylinder der SMC-Serie CY1S, Schlittenausführung mit Gleitlager, Kolbendurchmesser Ø' || t.bore::text || ' mm, Hub ' || t.slag::text || ' mm, magnetische Haltekraft ' || t.hall::text || ' N. Doppeltwirkend, Gummipuffer an beiden Enden, integrierter Magnet für Sensoren.',
  'Cilindro sin vástago de acoplamiento magnético de la serie SMC CY1S, tipo carro con cojinete de deslizamiento, diámetro Ø' || t.bore::text || ' mm, carrera ' || t.slag::text || ' mm, fuerza de retención magnética ' || t.hall::text || ' N. Doble efecto, amortiguador de goma en ambos extremos, imán incorporado para sensores.',
  'CY1S', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 35, 'draft'
from std_cy1s t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_cy1s t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('mode_of_operation', 'Double-acting'),
  ('cylinder_type', 'Rodless cylinder, magnetically coupled'),
  ('guide_type', 'Slide bearing'),
  ('magnetic_holding_force_n', t.hall::text),
  ('position_sensing', 'Magnetic piston'),
  ('cushioning_types', 'Rubber bumper'),
  ('min_pressure_mpa', '0.18'),
  ('max_pressure', '7 bar'),
  ('temp_range', '-10…+60 °C'),
  ('max_speed_mm_s', '400'),
  ('series', 'CY1S'),
  ('standard_kalla', 'SMC Magnetically Coupled Rodless Cylinder CY1S Series, katalogsidor 1197–1224: How to Order s. 1214, data och standardslag s. 1215. knowledge_chunks smc-kat-cy1s.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

-- CY1H: 29 artiklar
create temporary table std_cy1h on commit drop as
select * from (values
  ('CY1H10-100', 10, 100, 53.9, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H10-200', 10, 200, 53.9, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H10-300', 10, 300, 53.9, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H15-100', 15, 100, 137, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H15-200', 15, 200, 137, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H15-300', 15, 300, 137, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H15-400', 15, 400, 137, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H15-500', 15, 500, 137, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H20-100', 20, 100, 231, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H20-200', 20, 200, 231, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H20-300', 20, 300, 231, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H20-400', 20, 400, 231, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H20-500', 20, 500, 231, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H20-600', 20, 600, 231, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H25-100', 25, 100, 363, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H25-200', 25, 200, 363, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H25-300', 25, 300, 363, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H25-400', 25, 400, 363, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H25-500', 25, 500, 363, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H25-600', 25, 600, 363, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1H25-800', 25, 800, 363, 'enaxlig', 'single-axis', 'einachsiger', 'de un eje'),
  ('CY1HT32-100', 32, 100, 588, 'tvåaxlig', 'two-axis', 'zweiachsiger', 'de dos ejes'),
  ('CY1HT32-200', 32, 200, 588, 'tvåaxlig', 'two-axis', 'zweiachsiger', 'de dos ejes'),
  ('CY1HT32-300', 32, 300, 588, 'tvåaxlig', 'two-axis', 'zweiachsiger', 'de dos ejes'),
  ('CY1HT32-400', 32, 400, 588, 'tvåaxlig', 'two-axis', 'zweiachsiger', 'de dos ejes'),
  ('CY1HT32-500', 32, 500, 588, 'tvåaxlig', 'two-axis', 'zweiachsiger', 'de dos ejes'),
  ('CY1HT32-600', 32, 600, 588, 'tvåaxlig', 'two-axis', 'zweiachsiger', 'de dos ejes'),
  ('CY1HT32-800', 32, 800, 588, 'tvåaxlig', 'two-axis', 'zweiachsiger', 'de dos ejes'),
  ('CY1HT32-1000', 32, 1000, 588, 'tvåaxlig', 'two-axis', 'zweiachsiger', 'de dos ejes')
) as t(sku, bore, slag, hall, axel_sv, axel_en, axel_de, axel_es);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC CY1H Ø' || t.bore::text || ' kolvstångslös cylinder med linjärstyrning, ' || t.slag::text || ' mm slag', 'SMC CY1H Ø' || t.bore::text || ' rodless cylinder with linear guide, ' || t.slag::text || ' mm stroke',
  'Magnetkopplad kolvstångslös cylinder ur SMC serie CY1H med ' || t.axel_sv::text || ' linjärstyrning, borrning Ø' || t.bore::text || ' mm, slaglängd ' || t.slag::text || ' mm, magnetisk hållkraft ' || t.hall::text || ' N. Dubbelverkande, justerbult med uretanbuffert i båda ändar, inbyggd magnet för givare.',
  'Magnetically coupled rodless cylinder from SMC series CY1H with ' || t.axel_en::text || ' linear guide, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm, magnetic holding force ' || t.hall::text || ' N. Double-acting, adjusting bolt with urethane bumper at both ends, built-in magnet for sensors.',
  'Magnetisch gekoppelter kolbenstangenloser Zylinder der SMC-Serie CY1H mit ' || t.axel_de::text || ' Linearführung, Kolbendurchmesser Ø' || t.bore::text || ' mm, Hub ' || t.slag::text || ' mm, magnetische Haltekraft ' || t.hall::text || ' N. Doppeltwirkend, Einstellschraube mit Urethanpuffer an beiden Enden, integrierter Magnet für Sensoren.',
  'Cilindro sin vástago de acoplamiento magnético de la serie SMC CY1H con guía lineal ' || t.axel_es::text || ', diámetro Ø' || t.bore::text || ' mm, carrera ' || t.slag::text || ' mm, fuerza de retención magnética ' || t.hall::text || ' N. Doble efecto, perno de ajuste con amortiguador de uretano en ambos extremos, imán incorporado para sensores.',
  'CY1H', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 35, 'draft'
from std_cy1h t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_cy1h t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('mode_of_operation', 'Double-acting'),
  ('cylinder_type', 'Rodless cylinder, magnetically coupled'),
  ('guide_type', 'Linear guide, ' || t.axel_en::text),
  ('magnetic_holding_force_n', t.hall::text),
  ('position_sensing', 'Magnetic piston'),
  ('cushioning_types', 'Adjusting bolt with urethane bumper'),
  ('min_pressure_mpa', '0.2'),
  ('max_pressure', '7 bar'),
  ('temp_range', '-10…+60 °C'),
  ('max_speed_mm_s', '500'),
  ('series', 'CY1H'),
  ('standard_kalla', 'SMC Magnetically Coupled Rodless Cylinder CY1H Series, katalogsidor 1237–1253: How to Order s. 1242, data och standardslag s. 1243. knowledge_chunks smc-kat-cy1.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

commit;

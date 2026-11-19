-- Standardartiklar ur katalogmodellerna, som utkast (status 'draft').
-- GENERERAD av scripts/gen-standardartiklar.ts -- redigera inte för hand.
-- MXS: 44; totalt 44.
--
-- Utkasten syns inte på sajten (alla publika frågor kräver status 'active').
-- Ägaren slår på dem per serie efter genomgång. En befintlig artikel med
-- samma kod rörs inte (on conflict do nothing) -- den kan redan vara aktiv.

begin;

-- MXS: 44 artiklar
create temporary table std_mxs on commit drop as
select * from (values
  ('MXS6-10', 6, 10, 29, 'M3'),
  ('MXS6-20', 6, 20, 29, 'M3'),
  ('MXS6-30', 6, 30, 29, 'M3'),
  ('MXS6-40', 6, 40, 29, 'M3'),
  ('MXS6-50', 6, 50, 29, 'M3'),
  ('MXS8-10', 8, 10, 51, 'M5'),
  ('MXS8-20', 8, 20, 51, 'M5'),
  ('MXS8-30', 8, 30, 51, 'M5'),
  ('MXS8-40', 8, 40, 51, 'M5'),
  ('MXS8-50', 8, 50, 51, 'M5'),
  ('MXS8-75', 8, 75, 51, 'M5'),
  ('MXS12-10', 12, 10, 113, 'M5'),
  ('MXS12-20', 12, 20, 113, 'M5'),
  ('MXS12-30', 12, 30, 113, 'M5'),
  ('MXS12-40', 12, 40, 113, 'M5'),
  ('MXS12-50', 12, 50, 113, 'M5'),
  ('MXS12-75', 12, 75, 113, 'M5'),
  ('MXS12-100', 12, 100, 113, 'M5'),
  ('MXS16-10', 16, 10, 201, 'M5'),
  ('MXS16-20', 16, 20, 201, 'M5'),
  ('MXS16-30', 16, 30, 201, 'M5'),
  ('MXS16-40', 16, 40, 201, 'M5'),
  ('MXS16-50', 16, 50, 201, 'M5'),
  ('MXS16-75', 16, 75, 201, 'M5'),
  ('MXS16-100', 16, 100, 201, 'M5'),
  ('MXS16-125', 16, 125, 201, 'M5'),
  ('MXS20-10', 20, 10, 314, 'Rc 1/8'),
  ('MXS20-20', 20, 20, 314, 'Rc 1/8'),
  ('MXS20-30', 20, 30, 314, 'Rc 1/8'),
  ('MXS20-40', 20, 40, 314, 'Rc 1/8'),
  ('MXS20-50', 20, 50, 314, 'Rc 1/8'),
  ('MXS20-75', 20, 75, 314, 'Rc 1/8'),
  ('MXS20-100', 20, 100, 314, 'Rc 1/8'),
  ('MXS20-125', 20, 125, 314, 'Rc 1/8'),
  ('MXS20-150', 20, 150, 314, 'Rc 1/8'),
  ('MXS25-10', 25, 10, 491, 'Rc 1/8'),
  ('MXS25-20', 25, 20, 491, 'Rc 1/8'),
  ('MXS25-30', 25, 30, 491, 'Rc 1/8'),
  ('MXS25-40', 25, 40, 491, 'Rc 1/8'),
  ('MXS25-50', 25, 50, 491, 'Rc 1/8'),
  ('MXS25-75', 25, 75, 491, 'Rc 1/8'),
  ('MXS25-100', 25, 100, 491, 'Rc 1/8'),
  ('MXS25-125', 25, 125, 491, 'Rc 1/8'),
  ('MXS25-150', 25, 150, 491, 'Rc 1/8')
) as t(sku, bore, slag, kraft, port);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC MXS Ø' || t.bore::text || ' slidbord, ' || t.slag::text || ' mm slag', 'SMC MXS Ø' || t.bore::text || ' air slide table, ' || t.slag::text || ' mm stroke',
  'Pneumatiskt slidbord ur SMC serie MXS med inbyggd linjärstyrning och dubbel kolvstång, kolvdiameter Ø' || t.bore::text || ' mm, slaglängd ' || t.slag::text || ' mm, anslutning ' || t.port::text || '. Teoretisk kraft utåt ' || t.kraft::text || ' N vid 0,5 MPa. Inbyggd magnet för givare.',
  'Pneumatic air slide table from SMC series MXS with integrated linear guide and double piston rod, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm, port ' || t.port::text || '. Theoretical output force ' || t.kraft::text || ' N at 0.5 MPa. Built-in magnet for sensors.',
  'Pneumatischer Kompaktschlitten der SMC-Serie MXS mit integrierter Linearführung und doppelter Kolbenstange, Kolbendurchmesser Ø' || t.bore::text || ' mm, Hub ' || t.slag::text || ' mm, Anschluss ' || t.port::text || '. Theoretische Kraft ausfahrend ' || t.kraft::text || ' N bei 0,5 MPa. Integrierter Magnet für Sensoren.',
  'Mesa deslizante neumática de la serie SMC MXS con guía lineal integrada y doble vástago, diámetro Ø' || t.bore::text || ' mm, carrera ' || t.slag::text || ' mm, conexión ' || t.port::text || '. Fuerza teórica de avance ' || t.kraft::text || ' N a 0,5 MPa. Imán incorporado para sensores.',
  'MXS', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 7, 'draft'
from std_mxs t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_mxs t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('cylinder_type', 'Air slide table (guided)'),
  ('mode_of_operation', 'Double-acting'),
  ('position_sensing', 'Magnetic piston'),
  ('force_out_n_05mpa', t.kraft::text),
  ('port', t.port::text),
  ('min_pressure_mpa', '0.15'),
  ('max_pressure', '7 bar'),
  ('temp_range', '-10…+60 °C'),
  ('max_speed_mm_s', '500'),
  ('series', 'MXS'),
  ('standard_kalla', 'SMC Air Slide Table MXS Series, SMC MXS catalogue (catalogue pages 64–98): standardslag s. 6, kraft s. 7. knowledge_chunks smc-kat-mxs.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

commit;

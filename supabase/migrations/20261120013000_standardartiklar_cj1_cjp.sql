-- Standardartiklar ur katalogmodellerna, som utkast (status 'draft').
-- GENERERAD av scripts/gen-standardartiklar.ts -- redigera inte för hand.
-- CJ1: 10, CJP: 12; totalt 22.
--
-- Utkasten syns inte på sajten (alla publika frågor kräver status 'active').
-- Ägaren slår på dem per serie efter genomgång. En befintlig artikel med
-- samma kod rörs inte (on conflict do nothing) -- den kan redan vara aktiv.

begin;

-- CJ1: 10 artiklar
create temporary table std_cj1 on commit drop as
select * from (values
  ('CJ1B4-5U4', 4, 5, 6.3, 0.2, 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'de doble efecto', 'Double-acting'),
  ('CJ1B4-10U4', 4, 10, 6.3, 0.2, 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'de doble efecto', 'Double-acting'),
  ('CJ1B4-15U4', 4, 15, 6.3, 0.2, 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'de doble efecto', 'Double-acting'),
  ('CJ1B4-20U4', 4, 20, 6.3, 0.2, 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'de doble efecto', 'Double-acting'),
  ('CJ1B2-5SU4', 2.5, 5, 1.32, 0.3, 'enkelverkande med fjäderretur', 'single-acting with spring return', 'einfachwirkend mit Federrückstellung', 'de simple efecto con retorno por muelle', 'Single-acting, spring return'),
  ('CJ1B2-10SU4', 2.5, 10, 1.32, 0.3, 'enkelverkande med fjäderretur', 'single-acting with spring return', 'einfachwirkend mit Federrückstellung', 'de simple efecto con retorno por muelle', 'Single-acting, spring return'),
  ('CJ1B4-5SU4', 4, 5, 3.26, 0.3, 'enkelverkande med fjäderretur', 'single-acting with spring return', 'einfachwirkend mit Federrückstellung', 'de simple efecto con retorno por muelle', 'Single-acting, spring return'),
  ('CJ1B4-10SU4', 4, 10, 3.26, 0.3, 'enkelverkande med fjäderretur', 'single-acting with spring return', 'einfachwirkend mit Federrückstellung', 'de simple efecto con retorno por muelle', 'Single-acting, spring return'),
  ('CJ1B4-15SU4', 4, 15, 3.26, 0.3, 'enkelverkande med fjäderretur', 'single-acting with spring return', 'einfachwirkend mit Federrückstellung', 'de simple efecto con retorno por muelle', 'Single-acting, spring return'),
  ('CJ1B4-20SU4', 4, 20, 3.26, 0.3, 'enkelverkande med fjäderretur', 'single-acting with spring return', 'einfachwirkend mit Federrückstellung', 'de simple efecto con retorno por muelle', 'Single-acting, spring return')
) as t(sku, bore, slag, kraft, pmin, funk_sv, funk_en, funk_de, funk_es, mode);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC CJ1 Ø' || replace(t.bore::text, '.', ',') || ' stiftcylinder, ' || replace(t.slag::text, '.', ',') || ' mm slag, ' || replace(t.funk_sv::text, '.', ','), 'SMC CJ1 Ø' || t.bore::text || ' pin cylinder, ' || t.slag::text || ' mm stroke, ' || t.funk_en::text,
  'Stiftcylinder ur SMC serie CJ1, borrning Ø' || replace(t.bore::text, '.', ',') || ' mm, slaglängd ' || replace(t.slag::text, '.', ',') || ' mm, ' || replace(t.funk_sv::text, '.', ',') || '. Teoretisk kraft ut ' || replace(t.kraft::text, '.', ',') || ' N vid 0,5 MPa. Bastyp med slanganslutning för ø4/ø2,5-slang, utan dämpning och utan givare.',
  'Pin cylinder from SMC series CJ1, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm, ' || t.funk_en::text || '. Theoretical output force ' || t.kraft::text || ' N at 0.5 MPa. Basic style with connection for ø4/ø2.5 tubing, without cushion and without sensor.',
  'Stiftzylinder der SMC-Serie CJ1, Kolbendurchmesser Ø' || replace(t.bore::text, '.', ',') || ' mm, Hub ' || replace(t.slag::text, '.', ',') || ' mm, ' || replace(t.funk_de::text, '.', ',') || '. Theoretische Kraft ausfahrend ' || replace(t.kraft::text, '.', ',') || ' N bei 0,5 MPa. Grundausführung mit Anschluss für Schlauch ø4/ø2,5, ohne Dämpfung und ohne Sensor.',
  'Cilindro de pin de la serie SMC CJ1, diámetro Ø' || replace(t.bore::text, '.', ',') || ' mm, carrera ' || replace(t.slag::text, '.', ',') || ' mm, ' || replace(t.funk_es::text, '.', ',') || '. Fuerza teórica de avance ' || replace(t.kraft::text, '.', ',') || ' N a 0,5 MPa. Ejecución básica con conexión para tubo ø4/ø2,5, sin amortiguación y sin sensor.',
  'CJ1', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 10, 'draft'
from std_cj1 t
-- Redan inlagd med fabrikatsprefix (t.ex. SMC-CJ1B2-10SU4)? Då ingen dubblett.
where not exists (select 1 from products x where regexp_replace(x.sku, '^(SMC|FESTO|FE)-', '') = t.sku and x.sku <> t.sku)
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_cj1 t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('mode_of_operation', t.mode::text),
  ('cylinder_type', 'Pin cylinder'),
  ('cushioning_types', 'None'),
  ('force_out_05mpa_n', t.kraft::text),
  ('min_pressure_mpa', t.pmin::text),
  ('max_pressure', '7 bar'),
  ('temp_range', '-10…+70 °C'),
  ('max_speed_mm_s', '500'),
  ('series', 'CJ1'),
  ('standard_kalla', 'SMC Air Cylinder Series CJ1 (Pin Cylinder), SMC Air Cylinder Series CJ1 catalogue extract (catalogue pages 15–19): How to Order och data s. 16 och 18. knowledge_chunks smc-kat-cj1.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

-- CJP: 12 artiklar
create temporary table std_cjp on commit drop as
select * from (values
  ('CJPB4-5Z', 4, 5, 3.48, 1, 0.3),
  ('CJPB4-10Z', 4, 10, 3.48, 1, 0.3),
  ('CJPB4-15Z', 4, 15, 3.48, 1, 0.3),
  ('CJPB6-5Z', 6, 5, 10.2, 1.42, 0.2),
  ('CJPB6-10Z', 6, 10, 10.2, 1.42, 0.2),
  ('CJPB6-15Z', 6, 15, 10.2, 1.42, 0.2),
  ('CJPB10-5Z', 10, 5, 33.3, 2.45, 0.15),
  ('CJPB10-10Z', 10, 10, 33.3, 2.45, 0.15),
  ('CJPB10-15Z', 10, 15, 33.3, 2.45, 0.15),
  ('CJPB16-5Z', 16, 5, 84.7, 5.04, 0.15),
  ('CJPB16-10Z', 16, 10, 84.7, 5.04, 0.15),
  ('CJPB16-15Z', 16, 15, 84.7, 5.04, 0.15)
) as t(sku, bore, slag, kraft, fjader, pmin);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC CJP Ø' || replace(t.bore::text, '.', ',') || ' stiftcylinder, ' || replace(t.slag::text, '.', ',') || ' mm slag', 'SMC CJP Ø' || t.bore::text || ' pin cylinder, ' || t.slag::text || ' mm stroke',
  'Stiftcylinder ur SMC serie CJP för panelmontage, borrning Ø' || replace(t.bore::text, '.', ',') || ' mm, slaglängd ' || replace(t.slag::text, '.', ',') || ' mm. Enkelverkande med fjäderretur, teoretisk kraft ut ' || replace(t.kraft::text, '.', ',') || ' N vid 0,5 MPa, fjäderns returkraft ' || replace(t.fjader::text, '.', ',') || ' N. Gängad kolvstång, utan dämpning.',
  'Pin cylinder from SMC series CJP for panel mounting, bore Ø' || t.bore::text || ' mm, stroke ' || t.slag::text || ' mm. Single-acting with spring return, theoretical output force ' || t.kraft::text || ' N at 0.5 MPa, spring return force ' || t.fjader::text || ' N. Threaded piston rod, without cushion.',
  'Stiftzylinder der SMC-Serie CJP für Schalttafeleinbau, Kolbendurchmesser Ø' || replace(t.bore::text, '.', ',') || ' mm, Hub ' || replace(t.slag::text, '.', ',') || ' mm. Einfachwirkend mit Federrückstellung, theoretische Kraft ausfahrend ' || replace(t.kraft::text, '.', ',') || ' N bei 0,5 MPa, Federrückstellkraft ' || replace(t.fjader::text, '.', ',') || ' N. Kolbenstange mit Gewinde, ohne Dämpfung.',
  'Cilindro de pin de la serie SMC CJP para montaje en panel, diámetro Ø' || replace(t.bore::text, '.', ',') || ' mm, carrera ' || replace(t.slag::text, '.', ',') || ' mm. Simple efecto con retorno por muelle, fuerza teórica de avance ' || replace(t.kraft::text, '.', ',') || ' N a 0,5 MPa, fuerza de retorno del muelle ' || replace(t.fjader::text, '.', ',') || ' N. Vástago roscado, sin amortiguación.',
  'CJP', (select id from brands where slug = 'smc'), (select id from categories where slug = 'cylinder'),
  'order', 10, 'draft'
from std_cjp t
-- Redan inlagd med fabrikatsprefix (t.ex. SMC-CJ1B2-10SU4)? Då ingen dubblett.
where not exists (select 1 from products x where regexp_replace(x.sku, '^(SMC|FESTO|FE)-', '') = t.sku and x.sku <> t.sku)
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_cjp t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('stroke_mm', t.slag::text),
  ('mode_of_operation', 'Single-acting, spring return'),
  ('cylinder_type', 'Pin cylinder'),
  ('mounting', 'Panel mount'),
  ('cushioning_types', 'None'),
  ('force_out_05mpa_n', t.kraft::text),
  ('spring_return_force_n', t.fjader::text),
  ('min_pressure_mpa', t.pmin::text),
  ('max_pressure', '7 bar'),
  ('temp_range', '-10…+70 °C'),
  ('max_speed_mm_s', '500'),
  ('series', 'CJP'),
  ('standard_kalla', 'SMC Pin Cylinder CJP Series, SMC CJP catalogue (10 pages): How to Order och data s. 1, kraft s. 2. knowledge_chunks smc-kat-cjp.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

-- Decimalkomma i svensk, tysk och spansk text på utkasten från tidigare
-- omgångar (CY1S/CY1H "19.6 N", MHZ2 "3.3 N", "±0.01 mm", "M3 x 0.5").
-- Generatorn skriver nu komma själv; specvärdena behåller punkten.
update products set
  description    = regexp_replace(description,    '([0-9])\.([0-9])', '\1,\2', 'g'),
  description_de = regexp_replace(description_de, '([0-9])\.([0-9])', '\1,\2', 'g'),
  description_es = regexp_replace(description_es, '([0-9])\.([0-9])', '\1,\2', 'g')
where status = 'draft' and family in ('CY1S', 'CY1H', 'MHZ2')
  and (description ~ '[0-9]\.[0-9]' or description_de ~ '[0-9]\.[0-9]' or description_es ~ '[0-9]\.[0-9]');

commit;

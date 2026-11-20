-- Standardartiklar ur katalogmodellerna, som utkast (status 'draft').
-- GENERERAD av scripts/gen-standardartiklar.ts -- redigera inte för hand.
-- RB: 9, RBL: 6, RBQ: 5; totalt 20.
--
-- Utkasten syns inte på sajten (alla publika frågor kräver status 'active').
-- Ägaren slår på dem per serie efter genomgång. En befintlig artikel med
-- samma kod rörs inte (on conflict do nothing) -- den kan redan vara aktiv.

begin;

-- RB: 9 artiklar
create temporary table std_rb on commit drop as
select * from (values
  ('RB0604', 'M6 x 0.75', 'M6 x 0,75', '0.3–1', 4, 0.5, 80, 150, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RB0805', 'M8 x 1.0', 'M8 x 1,0', '0.05–5', 5, 0.98, 80, 245, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RB0806', 'M8 x 1.0', 'M8 x 1,0', '0.05–5', 6, 2.94, 80, 245, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RB1006', 'M10 x 1.0', 'M10 x 1,0', '0.05–5', 6, 3.92, 70, 422, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RB1007', 'M10 x 1.0', 'M10 x 1,0', '0.05–5', 7, 5.88, 70, 422, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RB1411', 'M14 x 1.5', 'M14 x 1,5', '0.05–5', 11, 14.7, 45, 814, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RB1412', 'M14 x 1.5', 'M14 x 1,5', '0.05–5', 12, 19.6, 45, 814, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RB2015', 'M20 x 1.5', 'M20 x 1,5', '0.05–5', 15, 58.8, 25, 1961, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RB2725', 'M27 x 1.5', 'M27 x 1,5', '0.05–5', 25, 147, 10, 2942, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.')
) as t(sku, ganga, ganga_spec, hast, slag, energi, frekvens, kraft, mutter_sv, mutter_en, mutter_de, mutter_es);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC ' || regexp_replace(t.sku::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' stötdämpare ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm slag', 'SMC ' || t.sku::text || ' shock absorber ' || t.ganga::text || ', ' || t.slag::text || ' mm stroke',
  'Hydraulisk stötdämpare ur SMC serie RB, standardtyp, gänga ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', slag ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm. Största energiupptagning ' || regexp_replace(t.energi::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' J per slag, högst ' || regexp_replace(t.frekvens::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' slag/min, största axialkraft ' || regexp_replace(t.kraft::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' N, kollisionshastighet ' || regexp_replace(t.hast::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' m/s.' || regexp_replace(t.mutter_sv::text, '([0-9])\.([0-9])', '\1,\2', 'g'),
  'Hydraulic shock absorber from SMC series RB, standard type, thread ' || t.ganga::text || ', stroke ' || t.slag::text || ' mm. Maximum energy absorption ' || t.energi::text || ' J per stroke, up to ' || t.frekvens::text || ' cycles/min, maximum thrust ' || t.kraft::text || ' N, collision speed ' || t.hast::text || ' m/s.' || t.mutter_en::text,
  'Hydraulischer Stoßdämpfer der SMC-Serie RB, Standardausführung, Gewinde ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', Hub ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm. Maximale Energieaufnahme ' || regexp_replace(t.energi::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' J pro Hub, höchstens ' || regexp_replace(t.frekvens::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' Zyklen/min, maximale Axialkraft ' || regexp_replace(t.kraft::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' N, Aufprallgeschwindigkeit ' || regexp_replace(t.hast::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' m/s.' || regexp_replace(t.mutter_de::text, '([0-9])\.([0-9])', '\1,\2', 'g'),
  'Amortiguador hidráulico de la serie SMC RB, tipo estándar, rosca ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', carrera ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm. Absorción máxima de energía ' || regexp_replace(t.energi::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' J por carrera, hasta ' || regexp_replace(t.frekvens::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' ciclos/min, empuje máximo ' || regexp_replace(t.kraft::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' N, velocidad de impacto ' || regexp_replace(t.hast::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' m/s.' || regexp_replace(t.mutter_es::text, '([0-9])\.([0-9])', '\1,\2', 'g'),
  'RB', (select id from brands where slug = 'smc'), (select id from categories where slug = 'shock-absorber'),
  'order', null, 'draft'
from std_rb t
-- Redan inlagd med fabrikatsprefix (t.ex. SMC-CJ1B2-10SU4)? Då ingen dubblett.
where not exists (select 1 from products x where regexp_replace(x.sku, '^(SMC|FESTO|FE)-', '') = t.sku and x.sku <> t.sku)
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_rb t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('thread', t.ganga_spec::text),
  ('stroke_mm', t.slag::text),
  ('energy_j', t.energi::text),
  ('max_freq_per_min', t.frekvens::text),
  ('max_thrust_n', t.kraft::text),
  ('collision_speed_m_s', t.hast::text),
  ('temp_range', '-10…+80 °C'),
  ('series', 'RB'),
  ('standard_kalla', 'SMC Shock Absorber RB Series / RBQ Series, katalogsidor 1295–1317: How to Order och data s. 1299. knowledge_chunks smc-kat-rb.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

-- RBL: 6 artiklar
create temporary table std_rbl on commit drop as
select * from (values
  ('RBL1006', 'M10 x 1.0', 'M10 x 1,0', '0.05–5', 6, 3.92, 70, 422, '', '', '', ''),
  ('RBL1007', 'M10 x 1.0', 'M10 x 1,0', '0.05–5', 7, 5.88, 70, 422, '', '', '', ''),
  ('RBL1411', 'M14 x 1.5', 'M14 x 1,5', '0.05–5', 11, 14.7, 45, 814, '', '', '', ''),
  ('RBL1412', 'M14 x 1.5', 'M14 x 1,5', '0.05–5', 12, 19.6, 45, 814, '', '', '', ''),
  ('RBL2015', 'M20 x 1.5', 'M20 x 1,5', '0.05–5', 15, 58.8, 25, 1961, '', '', '', ''),
  ('RBL2725', 'M27 x 1.5', 'M27 x 1,5', '0.05–5', 25, 147, 10, 2942, '', '', '', '')
) as t(sku, ganga, ganga_spec, hast, slag, energi, frekvens, kraft, mutter_sv, mutter_en, mutter_de, mutter_es);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC ' || regexp_replace(t.sku::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' stötdämpare ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm slag', 'SMC ' || t.sku::text || ' shock absorber ' || t.ganga::text || ', ' || t.slag::text || ' mm stroke',
  'Hydraulisk stötdämpare ur SMC serie RBL, kylvätsketålig typ (för icke vattenlöslig skärolja), gänga ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', slag ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm. Största energiupptagning ' || regexp_replace(t.energi::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' J per slag, högst ' || regexp_replace(t.frekvens::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' slag/min, största axialkraft ' || regexp_replace(t.kraft::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' N, kollisionshastighet ' || regexp_replace(t.hast::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' m/s.' || regexp_replace(t.mutter_sv::text, '([0-9])\.([0-9])', '\1,\2', 'g'),
  'Hydraulic shock absorber from SMC series RBL, coolant-resistant type (for non-water-soluble cutting oil), thread ' || t.ganga::text || ', stroke ' || t.slag::text || ' mm. Maximum energy absorption ' || t.energi::text || ' J per stroke, up to ' || t.frekvens::text || ' cycles/min, maximum thrust ' || t.kraft::text || ' N, collision speed ' || t.hast::text || ' m/s.' || t.mutter_en::text,
  'Hydraulischer Stoßdämpfer der SMC-Serie RBL, kühlmittelbeständige Ausführung (für nicht wasserlösliches Schneidöl), Gewinde ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', Hub ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm. Maximale Energieaufnahme ' || regexp_replace(t.energi::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' J pro Hub, höchstens ' || regexp_replace(t.frekvens::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' Zyklen/min, maximale Axialkraft ' || regexp_replace(t.kraft::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' N, Aufprallgeschwindigkeit ' || regexp_replace(t.hast::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' m/s.' || regexp_replace(t.mutter_de::text, '([0-9])\.([0-9])', '\1,\2', 'g'),
  'Amortiguador hidráulico de la serie SMC RBL, tipo resistente al refrigerante (para aceite de corte no soluble en agua), rosca ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', carrera ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm. Absorción máxima de energía ' || regexp_replace(t.energi::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' J por carrera, hasta ' || regexp_replace(t.frekvens::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' ciclos/min, empuje máximo ' || regexp_replace(t.kraft::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' N, velocidad de impacto ' || regexp_replace(t.hast::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' m/s.' || regexp_replace(t.mutter_es::text, '([0-9])\.([0-9])', '\1,\2', 'g'),
  'RBL', (select id from brands where slug = 'smc'), (select id from categories where slug = 'shock-absorber'),
  'order', null, 'draft'
from std_rbl t
-- Redan inlagd med fabrikatsprefix (t.ex. SMC-CJ1B2-10SU4)? Då ingen dubblett.
where not exists (select 1 from products x where regexp_replace(x.sku, '^(SMC|FESTO|FE)-', '') = t.sku and x.sku <> t.sku)
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_rbl t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('thread', t.ganga_spec::text),
  ('stroke_mm', t.slag::text),
  ('energy_j', t.energi::text),
  ('max_freq_per_min', t.frekvens::text),
  ('max_thrust_n', t.kraft::text),
  ('collision_speed_m_s', t.hast::text),
  ('temp_range', '-10…+80 °C'),
  ('series', 'RBL'),
  ('standard_kalla', 'SMC Shock Absorber RB Series / RBQ Series, katalogsidor 1295–1317: How to Order och data s. 1306. knowledge_chunks smc-kat-rb.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

-- RBQ: 5 artiklar
create temporary table std_rbq on commit drop as
select * from (values
  ('RBQ1604', 'M16 x 1.5', 'M16 x 1,5', '0.05–3', 4, 1.96, 60, 294, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RBQ2007', 'M20 x 1.5', 'M20 x 1,5', '0.05–3', 7, 11.8, 60, 490, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RBQ2508', 'M25 x 1.5', 'M25 x 1,5', '0.05–3', 8, 19.6, 45, 686, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RBQ3009', 'M30 x 1.5', 'M30 x 1,5', '0.05–3', 8.5, 33.3, 45, 981, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.'),
  ('RBQ3213', 'M32 x 1.5', 'M32 x 1,5', '0.05–3', 13, 49, 30, 1177, ' Två sexkantmuttrar medföljer.', ' Two hexagon nuts are included.', ' Zwei Sechskantmuttern werden mitgeliefert.', ' Se suministran dos tuercas hexagonales.')
) as t(sku, ganga, ganga_spec, hast, slag, energi, frekvens, kraft, mutter_sv, mutter_en, mutter_de, mutter_es);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC ' || regexp_replace(t.sku::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' stötdämpare ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm slag', 'SMC ' || t.sku::text || ' shock absorber ' || t.ganga::text || ', ' || t.slag::text || ' mm stroke',
  'Hydraulisk stötdämpare ur SMC serie RBQ, kort typ, tillåten excentricitet 5°, gänga ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', slag ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm. Största energiupptagning ' || regexp_replace(t.energi::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' J per slag, högst ' || regexp_replace(t.frekvens::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' slag/min, största axialkraft ' || regexp_replace(t.kraft::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' N, kollisionshastighet ' || regexp_replace(t.hast::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' m/s.' || regexp_replace(t.mutter_sv::text, '([0-9])\.([0-9])', '\1,\2', 'g'),
  'Hydraulic shock absorber from SMC series RBQ, short type, allowable eccentricity 5°, thread ' || t.ganga::text || ', stroke ' || t.slag::text || ' mm. Maximum energy absorption ' || t.energi::text || ' J per stroke, up to ' || t.frekvens::text || ' cycles/min, maximum thrust ' || t.kraft::text || ' N, collision speed ' || t.hast::text || ' m/s.' || t.mutter_en::text,
  'Hydraulischer Stoßdämpfer der SMC-Serie RBQ, kurze Ausführung, zulässige Exzentrizität 5°, Gewinde ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', Hub ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm. Maximale Energieaufnahme ' || regexp_replace(t.energi::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' J pro Hub, höchstens ' || regexp_replace(t.frekvens::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' Zyklen/min, maximale Axialkraft ' || regexp_replace(t.kraft::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' N, Aufprallgeschwindigkeit ' || regexp_replace(t.hast::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' m/s.' || regexp_replace(t.mutter_de::text, '([0-9])\.([0-9])', '\1,\2', 'g'),
  'Amortiguador hidráulico de la serie SMC RBQ, tipo corto, excentricidad admisible 5°, rosca ' || regexp_replace(t.ganga::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ', carrera ' || regexp_replace(t.slag::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' mm. Absorción máxima de energía ' || regexp_replace(t.energi::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' J por carrera, hasta ' || regexp_replace(t.frekvens::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' ciclos/min, empuje máximo ' || regexp_replace(t.kraft::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' N, velocidad de impacto ' || regexp_replace(t.hast::text, '([0-9])\.([0-9])', '\1,\2', 'g') || ' m/s.' || regexp_replace(t.mutter_es::text, '([0-9])\.([0-9])', '\1,\2', 'g'),
  'RBQ', (select id from brands where slug = 'smc'), (select id from categories where slug = 'shock-absorber'),
  'order', null, 'draft'
from std_rbq t
-- Redan inlagd med fabrikatsprefix (t.ex. SMC-CJ1B2-10SU4)? Då ingen dubblett.
where not exists (select 1 from products x where regexp_replace(x.sku, '^(SMC|FESTO|FE)-', '') = t.sku and x.sku <> t.sku)
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_rbq t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('thread', t.ganga_spec::text),
  ('stroke_mm', t.slag::text),
  ('energy_j', t.energi::text),
  ('max_freq_per_min', t.frekvens::text),
  ('max_thrust_n', t.kraft::text),
  ('collision_speed_m_s', t.hast::text),
  ('temp_range', '-10…+80 °C'),
  ('series', 'RBQ'),
  ('standard_kalla', 'SMC Shock Absorber RB Series / RBQ Series, katalogsidor 1295–1317: How to Order och data s. 1310. knowledge_chunks smc-kat-rb.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

commit;

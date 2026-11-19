-- Standardartiklar ur katalogmodellerna, som utkast (status 'draft').
-- GENERERAD av scripts/gen-standardartiklar.ts -- redigera inte för hand.
-- MHZ2: 21; totalt 21.
--
-- Utkasten syns inte på sajten (alla publika frågor kräver status 'active').
-- Ägaren slår på dem per serie efter genomgång. En befintlig artikel med
-- samma kod rörs inte (on conflict do nothing) -- den kan redan vara aktiv.

begin;

-- MHZ2: 21 artiklar
create temporary table std_mhz2 on commit drop as
select * from (values
  ('MHZ2-6D', 6, 4, 'M3 x 0.5', 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'doble efecto', 'Double-acting', 3.3, '6.6', '', '6.1', 0.15, 0.7, 27, 0.01, 180),
  ('MHZ2-6S', 6, 4, 'M3 x 0.5', 'enkelverkande, normalt öppen (yttre grepp)', 'single-acting, normally open (external grip)', 'einfachwirkend, normal offen (Außengreifen)', 'simple efecto, normalmente abierta (agarre exterior)', 'Single-acting, normally open', 1.9, '3.8', '', '', 0.3, 0.7, 27, 0.01, 180),
  ('MHZ2-6C', 6, 4, 'M3 x 0.5', 'enkelverkande, normalt stängd (inre grepp)', 'single-acting, normally closed (internal grip)', 'einfachwirkend, normal geschlossen (Innengreifen)', 'simple efecto, normalmente cerrada (agarre interior)', 'Single-acting, normally closed', 3.7, '', '7.4', '', 0.3, 0.7, 27, 0.01, 180),
  ('MHZ2-10D', 10, 4, 'M5 x 0.8', 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'doble efecto', 'Double-acting', 11, '22', '', '17', 0.2, 0.7, 55, 0.01, 180),
  ('MHZ2-10S', 10, 4, 'M5 x 0.8', 'enkelverkande, normalt öppen (yttre grepp)', 'single-acting, normally open (external grip)', 'einfachwirkend, normal offen (Außengreifen)', 'simple efecto, normalmente abierta (agarre exterior)', 'Single-acting, normally open', 7.1, '14.2', '', '', 0.35, 0.7, 55, 0.01, 180),
  ('MHZ2-10C', 10, 4, 'M5 x 0.8', 'enkelverkande, normalt stängd (inre grepp)', 'single-acting, normally closed (internal grip)', 'einfachwirkend, normal geschlossen (Innengreifen)', 'simple efecto, normalmente cerrada (agarre interior)', 'Single-acting, normally closed', 13, '', '26', '', 0.35, 0.7, 55, 0.01, 180),
  ('MHZ2-16D', 16, 6, 'M5 x 0.8', 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'doble efecto', 'Double-acting', 34, '68', '', '45', 0.1, 0.7, 115, 0.01, 180),
  ('MHZ2-16S', 16, 6, 'M5 x 0.8', 'enkelverkande, normalt öppen (yttre grepp)', 'single-acting, normally open (external grip)', 'einfachwirkend, normal offen (Außengreifen)', 'simple efecto, normalmente abierta (agarre exterior)', 'Single-acting, normally open', 27, '54', '', '', 0.25, 0.7, 115, 0.01, 180),
  ('MHZ2-16C', 16, 6, 'M5 x 0.8', 'enkelverkande, normalt stängd (inre grepp)', 'single-acting, normally closed (internal grip)', 'einfachwirkend, normal geschlossen (Innengreifen)', 'simple efecto, normalmente cerrada (agarre interior)', 'Single-acting, normally closed', 38, '', '76', '', 0.25, 0.7, 115, 0.01, 180),
  ('MHZ2-20D', 20, 10, 'M5 x 0.8', 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'doble efecto', 'Double-acting', 42, '84', '', '66', 0.1, 0.7, 230, 0.01, 180),
  ('MHZ2-20S', 20, 10, 'M5 x 0.8', 'enkelverkande, normalt öppen (yttre grepp)', 'single-acting, normally open (external grip)', 'einfachwirkend, normal offen (Außengreifen)', 'simple efecto, normalmente abierta (agarre exterior)', 'Single-acting, normally open', 33, '66', '', '', 0.25, 0.7, 235, 0.01, 180),
  ('MHZ2-20C', 20, 10, 'M5 x 0.8', 'enkelverkande, normalt stängd (inre grepp)', 'single-acting, normally closed (internal grip)', 'einfachwirkend, normal geschlossen (Innengreifen)', 'simple efecto, normalmente cerrada (agarre interior)', 'Single-acting, normally closed', 57, '', '114', '', 0.25, 0.7, 235, 0.01, 180),
  ('MHZ2-25D', 25, 14, 'M5 x 0.8', 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'doble efecto', 'Double-acting', 65, '130', '', '104', 0.1, 0.7, 420, 0.01, 180),
  ('MHZ2-25S', 25, 14, 'M5 x 0.8', 'enkelverkande, normalt öppen (yttre grepp)', 'single-acting, normally open (external grip)', 'einfachwirkend, normal offen (Außengreifen)', 'simple efecto, normalmente abierta (agarre exterior)', 'Single-acting, normally open', 45, '90', '', '', 0.25, 0.7, 425, 0.01, 180),
  ('MHZ2-25C', 25, 14, 'M5 x 0.8', 'enkelverkande, normalt stängd (inre grepp)', 'single-acting, normally closed (internal grip)', 'einfachwirkend, normal geschlossen (Innengreifen)', 'simple efecto, normalmente cerrada (agarre interior)', 'Single-acting, normally closed', 83, '', '166', '', 0.25, 0.7, 425, 0.01, 180),
  ('MHZ2-32D', 32, 22, 'M5 x 0.8', 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'doble efecto', 'Double-acting', 158, '316', '', '193', 0.1, 0.7, 715, 0.02, 60),
  ('MHZ2-32S', 32, 22, 'M5 x 0.8', 'enkelverkande, normalt öppen (yttre grepp)', 'single-acting, normally open (external grip)', 'einfachwirkend, normal offen (Außengreifen)', 'simple efecto, normalmente abierta (agarre exterior)', 'Single-acting, normally open', 131, '262', '', '', 0.25, 0.7, 760, 0.02, 60),
  ('MHZ2-32C', 32, 22, 'M5 x 0.8', 'enkelverkande, normalt stängd (inre grepp)', 'single-acting, normally closed (internal grip)', 'einfachwirkend, normal geschlossen (Innengreifen)', 'simple efecto, normalmente cerrada (agarre interior)', 'Single-acting, normally closed', 161, '', '322', '', 0.25, 0.7, 760, 0.02, 60),
  ('MHZ2-40D', 40, 30, 'M5 x 0.8', 'dubbelverkande', 'double-acting', 'doppeltwirkend', 'doble efecto', 'Double-acting', 254, '508', '', '318', 0.1, 0.7, 1275, 0.02, 60),
  ('MHZ2-40S', 40, 30, 'M5 x 0.8', 'enkelverkande, normalt öppen (yttre grepp)', 'single-acting, normally open (external grip)', 'einfachwirkend, normal offen (Außengreifen)', 'simple efecto, normalmente abierta (agarre exterior)', 'Single-acting, normally open', 217, '434', '', '', 0.25, 0.7, 1370, 0.02, 60),
  ('MHZ2-40C', 40, 30, 'M5 x 0.8', 'enkelverkande, normalt stängd (inre grepp)', 'single-acting, normally closed (internal grip)', 'einfachwirkend, normal geschlossen (Innengreifen)', 'simple efecto, normalmente cerrada (agarre interior)', 'Single-acting, normally closed', 267, '', '534', '', 0.25, 0.7, 1370, 0.02, 60)
) as t(sku, bore, slag, port, verkan_sv, verkan_en, verkan_de, verkan_es, mode, finger, yttre_total, inre_total, inre_finger_d, pmin, pmax, vikt, rep, cpm);

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, 'SMC MHZ2 Ø' || t.bore::text || ' parallellgripdon, ' || t.verkan_sv::text, 'SMC MHZ2 Ø' || t.bore::text || ' parallel gripper, ' || t.verkan_en::text,
  'Parallellgripdon med två fingrar ur SMC serie MHZ2, kolvdiameter Ø' || t.bore::text || ' mm, ' || t.verkan_sv::text || '. Slag ' || t.slag::text || ' mm (öppning och stängning, båda sidor), gripkraft ' || t.finger::text || ' N per finger vid 0,5 MPa, repeterbarhet ±' || t.rep::text || ' mm, anslutning ' || t.port::text || '.',
  'Two-finger parallel gripper from SMC series MHZ2, bore Ø' || t.bore::text || ' mm, ' || t.verkan_en::text || '. Stroke ' || t.slag::text || ' mm (opening and closing, both sides), gripping force ' || t.finger::text || ' N per finger at 0.5 MPa, repeatability ±' || t.rep::text || ' mm, port ' || t.port::text || '.',
  'Zweifinger-Parallelgreifer der SMC-Serie MHZ2, Kolbendurchmesser Ø' || t.bore::text || ' mm, ' || t.verkan_de::text || '. Hub ' || t.slag::text || ' mm (Öffnen und Schließen, beide Seiten), Greifkraft ' || t.finger::text || ' N pro Finger bei 0,5 MPa, Wiederholgenauigkeit ±' || t.rep::text || ' mm, Anschluss ' || t.port::text || '.',
  'Pinza paralela de dos dedos de la serie SMC MHZ2, diámetro Ø' || t.bore::text || ' mm, ' || t.verkan_es::text || '. Carrera ' || t.slag::text || ' mm (apertura y cierre, ambos lados), fuerza de agarre ' || t.finger::text || ' N por dedo a 0,5 MPa, repetibilidad ±' || t.rep::text || ' mm, conexión ' || t.port::text || '.',
  'MHZ2', (select id from brands where slug = 'smc'), (select id from categories where slug = 'gripper'),
  'order', 7, 'draft'
from std_mhz2 t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from std_mhz2 t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
  ('bore_mm', t.bore::text),
  ('gripper_type', 'Parallel gripper, 2 fingers'),
  ('mode_of_operation', t.mode::text),
  ('stroke_mm', t.slag::text),
  ('gripping_force_per_finger_05mpa_N', t.finger::text),
  ('grip_force_5bar_N', t.yttre_total::text),
  ('grip_force_internal_5bar_N', t.inre_total::text),
  ('gripping_force_internal_per_finger_05mpa_N', t.inre_finger_d::text),
  ('repeatability_mm', t.rep::text),
  ('max_frequency_cpm', t.cpm::text),
  ('weight_g', t.vikt::text),
  ('port', t.port::text),
  ('min_pressure_mpa', t.pmin::text),
  ('max_pressure', '7 bar'),
  ('temp_range', '-10…+60 °C'),
  ('position_sensing', 'Magnetic piston (sensor bracket BMG2-012)'),
  ('series', 'MHZ2'),
  ('standard_kalla', 'SMC Parallel Type Air Gripper MHZ2 Series, SMC MHZ series catalogue chapter (catalogue pages 469–549, web catalogue 2026): specifikationer och gripkraft s. 499. knowledge_chunks smc-kat-mhz2-std.pdf')
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);

commit;

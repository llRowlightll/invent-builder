-- SMC electric-drivetrain controllers/drives (from supplier datasheets) — pairs the
-- existing SMC LE-series electric actuators (LEY/LESH/LEF) with real SMC drives
-- instead of falling back to a Festo drive or SPECIFY. Margin 30% (MID), no price yet.
insert into public.products
  (sku, name, description, family, brand_id, category_id, lead_time_days, availability, status, ip_rating, fieldbus, voltage, margin)
select v.sku, v.name, v.description, v.family,
       (select id from public.brands where slug = 'smc'),
       (select id from public.categories where slug = 'servo-drive'),
       v.lead, 'order', 'active', v.ip, v.fieldbus, v.voltage, 30
from (values
  ('SMC-LECP6', 'LECP6 Stegmotorstyrning (servo, 24 VDC, programmerbar)',
   'SMC stegmotorstyrning (servo, 24 VDC) för LE-seriens elektriska ställdon (LEF/LEY/LESH). Programmerbar step-data, parallell I/O + seriell, positionerings- och tryckdrift. Skruv- eller DIN-skenemontage.',
   'LECP6', 14, 'IP20', NULL, '24 V'),
  ('SMC-LECPA', 'LECPA Stegmotordrivare (pulsingång, 24 VDC)',
   'SMC stegmotordrivare med pulsingång (24 VDC) för LE-seriens ställdon. Styrs av extern pulsgenerator/PLC. Positionering via parallell I/O. Skruv- eller DIN-skenemontage.',
   'LECPA', 14, 'IP20', NULL, '24 V'),
  ('SMC-LECA6', 'LECA6 Servomotorstyrning (24 VDC)',
   'SMC servomotorstyrning (24 VDC) för LE-seriens servo-elställdon. Step-data, parallell I/O, positionerings- och tryckdrift. Skruv- eller DIN-skenemontage.',
   'LECA6', 14, 'IP20', NULL, '24 V')
) as v(sku, name, description, family, lead, ip, fieldbus, voltage)
on conflict (sku) do nothing;

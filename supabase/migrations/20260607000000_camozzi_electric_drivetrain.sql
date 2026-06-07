-- Camozzi C_Electrics drivetrain, from supplier datasheets (Series DRCS drive +
-- 6E + C_Electrics catalogue). Closes the last brand gap: the Serie 6E
-- electromechanical cylinders had no same-brand motor/drive, so BOMs fell back to
-- an honest "specify drive" row. Now the 6E pairs with a real Camozzi stepper
-- system — MTS stepper motor + DRCS stepper drive (one coherent technology, so the
-- advisor never mixes a brushless motor with a stepper drive). Electric-tier margin.
insert into public.products
  (sku, name, description, family, brand_id, category_id, lead_time_days, availability, status, ip_rating, fieldbus, voltage, margin)
select v.sku, v.name, v.description, v.family,
       (select id from public.brands where slug = 'camozzi'),
       (select id from public.categories where slug = v.cat),
       v.lead, 'order', 'active', v.ip, v.fieldbus, v.voltage, v.margin
from (values
  ('CAM-DRCS', 'Camozzi DRCS Stegmotordrivare', 'Camozzi DRCS — fullt digital stegmotordrivare för Serie 6E/5E elaxlar. CANopen (CiA 402), step/direction-ingång, mikrostegning upp till 1/16, elektromekanisk bromsstyrning, konfig via Bluetooth/NFC och QSet-mjukvara.', 'DRCS', 'servo-drive', 14, 'IP20', 'CANopen', '24–60 V DC', 30),
  ('CAM-MTS', 'Camozzi MTS Stegmotor', 'Camozzi MTS stegmotor med Nema 23/24-fläns — driver Serie 6E/5E elaxlar via in-line eller parallell kopplingssats.', 'MTS', 'servo-motor', 14, NULL, NULL, NULL, 30),
  ('CAM-5E', 'Camozzi Serie 5E Elektromekanisk axel', 'Camozzi Serie 5E kolvstångslös elektromekanisk axel (kulskruv/kuggrem), storlek 50/65/80 — för pick & place och fleraxliga system.', '5E', 'linear-module', 21, NULL, NULL, NULL, 30)
) as v(sku, name, description, family, cat, lead, ip, fieldbus, voltage, margin)
on conflict (sku) do nothing;

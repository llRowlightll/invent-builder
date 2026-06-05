-- Parker + Bosch Rexroth electric drivetrain, and Metal Work top-ups, from supplier
-- datasheets. Completes the electric drivetrain for the three remaining brands so
-- BOMs reference real same-brand drives/motors. Margins follow the category tier;
-- no purchase_price yet.
insert into public.products
  (sku, name, description, family, brand_id, category_id, lead_time_days, availability, status, ip_rating, fieldbus, voltage, margin)
select v.sku, v.name, v.description, v.family,
       (select id from public.brands where slug = v.brand),
       (select id from public.categories where slug = v.cat),
       v.lead, 'order', 'active', v.ip, v.fieldbus, v.voltage, v.margin
from (values
  -- Parker el-drivlina
  ('PARKER-PSD', 'Parker PSD Servodrivare', 'Parker Servo Drive (PSD) — kompakt servodrivare för Parkers servomotorer och elaxlar. EtherCAT/PROFINET/EtherNet-IP, integrerade säkerhetsfunktioner (STO).', 'PSD', 'parker', 'servo-drive', 14, 'IP20', 'EtherCAT/PROFINET/EtherNet-IP', '230/400 V', 30),
  ('PARKER-COMPAX3', 'Parker Compax3 Servodrivare', 'Parker Compax3 servodrivare för servomotorer och elaxlar (OSP-E/HMR/ETH). Integrerad positionering och fältbuss.', 'Compax3', 'parker', 'servo-drive', 14, 'IP20', 'EtherCAT/PROFINET/PROFIBUS', '230/400 V', 30),
  ('PARKER-MPP', 'Parker MPP Servomotor', 'Parker MPP borstlös synkron servomotor med absolutgivare och optional hållbroms.', 'MPP', 'parker', 'servo-motor', 14, 'IP65', NULL, '400 V', 30),
  ('PARKER-SMH', 'Parker SMH Servomotor', 'Parker SMB/SMH synkron servomotor med givare och optional hållbroms.', 'SMH', 'parker', 'servo-motor', 14, 'IP65', NULL, '400 V', 30),
  -- Bosch Rexroth el-drivlina
  ('BR-INDRADRIVE-CS', 'Bosch Rexroth IndraDrive Cs (HCS01)', 'Bosch Rexroth IndraDrive Cs kompakt servodrivare (HCS01 power section). sercos/EtherCAT/PROFINET, integrerad säkerhet.', 'IndraDrive Cs', 'bosch-rexroth', 'servo-drive', 21, 'IP20', 'sercos/EtherCAT/PROFINET', '230/400 V', 30),
  ('BR-MS2N', 'Bosch Rexroth MS2N Servomotor', 'Bosch Rexroth MS2N synkron servomotor — hög moment-/effekttäthet, absolutgivare, optional broms.', 'MS2N', 'bosch-rexroth', 'servo-motor', 21, 'IP65', NULL, '400 V', 30),
  ('BR-MSK', 'Bosch Rexroth MSK Servomotor', 'Bosch Rexroth MSK synkron servomotor med absolutgivare och optional hållbroms.', 'MSK', 'bosch-rexroth', 'servo-motor', 21, 'IP65', NULL, '400 V', 30),
  ('BR-EMC', 'Bosch Rexroth EMC Elcylinder', 'Bosch Rexroth EMC elektromekanisk cylinder (kulskruv), ISO-kompatibel, för höga krafter.', 'EMC', 'bosch-rexroth', 'electric-actuator', 21, 'IP54', NULL, NULL, 30),
  ('BR-CKK', 'Bosch Rexroth CKK/CKR Linjärmodul', 'Bosch Rexroth CKK/CKR kompakt linjärmodul (kulskruv/kuggrem) med integrerad styrning.', 'CKK', 'bosch-rexroth', 'linear-module', 21, NULL, NULL, NULL, 30),
  -- Metal Work påfyllning
  ('MW-EB80', 'Metal Work EB 80 Ventilterminal', 'Metal Work EB 80 modulär ventilö med fältbuss (PROFINET/EtherCAT/IO-Link), multipol/BOXI-versioner.', 'EB 80', 'metal-work', 'valve-terminal', 14, 'IP65', 'PROFINET/EtherCAT/IO-Link', '24 V', 30),
  ('MW-RACCORDI', 'Metal Work Snabbkopplingar (Raccordi)', 'Metal Work push-in snabbkopplingar och anslutningar för pneumatikslang.', 'Raccordi', 'metal-work', 'fitting', 7, NULL, NULL, NULL, 40),
  ('MW-SOV-L', 'Metal Work SOV L Magnetventil 3/2', 'Metal Work SOV L in-line magnetventil 3/2 (LINE ON LINE), solenoid-piloterad, plug-in/M8, 24 VDC.', 'SOV L', 'metal-work', 'valve', 14, 'IP65', NULL, '24 V', 22)
) as v(sku, name, description, family, brand, cat, lead, ip, fieldbus, voltage, margin)
on conflict (sku) do nothing;

-- Festo electric-drivetrain products (from supplier datasheets) — fills the
-- servo-motor / servo-drive / controller / cable gap so BOMs reference real SKUs
-- instead of "ej i katalog". Margin = 30% (MID tier); no purchase_price yet.
insert into public.products
  (sku, name, description, family, brand_id, category_id, lead_time_days, availability, status, ip_rating, fieldbus, voltage, margin)
select v.sku, v.name, v.description, v.family,
       (select id from public.brands where slug = 'festo'),
       (select id from public.categories where slug = v.cat),
       v.lead, 'order', 'active', v.ip, v.fieldbus, v.voltage, 30
from (values
  ('FESTO-EMMT-AS', 'EMMT-AS Servomotor (borstlös synkron, 60 mm)',
   'Dynamisk borstlös synkron servomotor. Digital absolutgivare EnDat 2.2 (single-/multi-turn, batterilös). Optional hållbroms. IP40 axel / IP67 hus. En kabel (OCP) för matning + givare. Styrs av CMMT-AS.',
   'EMMT-AS', 'servo-motor', 14, 'IP67', NULL, '400 V'),
  ('FESTO-EMME-AS', 'EMME-AS Servomotor (borstlös synkron)',
   'Borstlös permanentmagnet-synkron servomotor (kärnsortiment). Digital absolutgivare (single-/multi-turn, multi-turn med SIL2). Optional hållbroms. IP21 axel / IP65 hus. Styrs av CMMP-AS.',
   'EMME-AS', 'servo-motor', 14, 'IP65', NULL, '400 V'),
  ('FESTO-CMMT-AS', 'CMMT-AS Servodrivare (1-/3-fas, upp till 12 kW)',
   'Universell servodrivare för PM-synkronmotorer upp till 12000 W. Stödjer EMMT-AS/EMME-AS/EMMB-AS + tredjepartsmotorer. Integrerat EMC-filter och bromschopper. Säkerhet STO SIL3/PLe. Festo Automation Suite + Electric Motion Sizing.',
   'CMMT-AS', 'servo-drive', 14, 'IP20', 'EtherCAT/PROFINET/EtherNet-IP/Modbus', '230/400 V'),
  ('FESTO-CMMP-AS', 'CMMP-AS Motorstyrning för servomotorer (0,5–18 kVA)',
   'Digital servomotorstyrning 0,5–18 kVA för AC-servo och linjärmotorer. Integrerade EMC-filter, bromschopper och säkerhetsfunktioner (STO/SS1/SS2/SBC/SOS/SLS). 255 positionslägen, interpolerande fleraxelrörelse.',
   'CMMP-AS', 'servo-drive', 14, 'IP20', 'EtherCAT/PROFINET/CANopen/PROFIBUS', '230/400 V'),
  ('FESTO-CPX-E', 'CPX-E Automationssystem / Motion Controller',
   'Högpresterande styr- och motion-controller för handling. Integrerad EtherCAT-master, CODESYS, SoftMotion (fleraxlig rörelse: cam, kontur, robotik). Modulärt: controller/buss/IO/räknare/IO-Link. Festo art. 5237644.',
   'CPX-E', 'controller', 21, 'IP20', 'EtherCAT', '24 V'),
  ('FESTO-NEBL-M8W4-E-7.5-N-LE4', 'NEBL-M8W4-E-7.5-N-LE4 Anslutningskabel M8 4-pol 7,5 m',
   'Anslutningskabel M8x1 4-polig vinklad hona till öppen ände, 7,5 m. Oljebeständig (lämplig för energikedja). IP65/IP67/IP69K, ATEX zon 2/22. 4×0,5 mm², 24 V / 5,2 A. Festo art. 8065114.',
   'NEBL', 'cable', 7, 'IP69K', NULL, '24 V')
) as v(sku, name, description, family, cat, lead, ip, fieldbus, voltage)
on conflict (sku) do nothing;

-- Spänning ur databladen (ägarens ja 2026-11-16: "fyll i ur databladen med
-- källa, radera inget"). Bara det dokumenten säger rakt ut. Varje värde har
-- en _kalla-rad, som produktsidan visar under Källor.
--
-- Inte ifyllt, eftersom underlaget vi har inte anger spänningen: Festo CPV,
-- VTSA, VADMI, SDBT, SFAH; Camozzi MX SAFEMAX; Metal Work ISV, SOV L, EB 80.
-- Manuella ventiler, kulventiler, vinkelsätesventiler, ejektorer och axlar
-- utan motor har ingen spänning och lämnas tomma.

begin;

insert into product_specs (product_id, key, value, unit)
select p.id, v.key, v.value, null
  from (values
    ('MW-MACH11', 'solenoid_voltage', '24 VDC'),
    ('MW-MACH11', 'solenoid_voltage_kalla', 'Metal Work General Catalogue s. B1.95: Mach 11 elektropneumatisk finns i 24VDC (plug-in eller M8).'),
    ('MW-MACH16', 'solenoid_voltage', '24 VDC / 24 VAC / 110 VAC / 220 VAC'),
    ('MW-MACH16', 'solenoid_voltage_kalla', 'Metal Work General Catalogue s. B1.103: pilot för Mach 16 i 24VDC, 24VAC, 110VAC och 220VAC 50/60 Hz. Spänningen väljs vid beställning.'),
    ('MW-MACH18', 'solenoid_voltage', '24 VDC / 24 VAC / 110 VAC / 220 VAC'),
    ('MW-MACH18', 'solenoid_voltage_kalla', 'Metal Work General Catalogue s. B1.121: spänningskod 24VDC, 24VDC M8, 24VAC, 110VAC eller 220VAC. Spänningen väljs vid beställning.'),
    ('FESTO-173210', 'voltage', '24 V'),
    ('FESTO-173210', 'voltage_kalla', 'Festos typkod SME-10-KL-LED-24: 24 V.'),
    ('FESTO-8065029', 'voltage', '24 V'),
    ('FESTO-8065029', 'voltage_kalla', 'Festos typkod SMT-10G-NS-24V-E-0.3Q-M8D: 24 V.')
  ) as v(sku, key, value)
  join products p on p.sku = v.sku
on conflict (product_id, key) do nothing;

commit;

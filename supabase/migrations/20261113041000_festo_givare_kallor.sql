-- Festo-givare (kundgranskningen 2026-11-13, instrumenttekniker):
-- tre givarsidor hade temperaturens källa från en ANNAN artikel (SMT-8M-A
-- och SMT-10 -> 8065029, SME-8M -> 173210); värdet och källan tas bort.
-- "medium = Inductive" stod på magnetiska cylindergivare (reed och
-- magnetoresistiva). 2427615 är SDBT-BSW-1L-NU-W-0.3-N-M12: magnetoresistiv,
-- NPN slutande, 0,3 m kabel med M12 (Festo datablad 2427615) -- specen sa
-- "M8". 8065029 är SMT-10G-NS (NS = NPN slutande) enligt sin egen källrad.

begin;

delete from product_specs ps using products p
where ps.product_id = p.id
  and p.sku in ('FE-SME-8M-DS-24V-K-2.5-M8D', 'FE-SMT-10-PS-24V-E-0.3-M8D', 'FE-SMT-8M-A-PS-24V-E-0.3-M8D')
  and ps.key in ('temp_range', 'temp_range_kalla');

delete from product_specs ps using products p
where ps.product_id = p.id and p.sku in ('FESTO-173210', 'FESTO-8065029', 'FESTO-2427615')
  and ps.key = 'medium' and ps.value = 'Inductive';

insert into product_specs (product_id, key, value, unit)
select p.id, k.key, k.value, null
from products p
join (values
  ('FESTO-173210', 'position_output', 'Reed'),
  ('FESTO-8065029', 'position_output', 'NPN, slutande (NS)'),
  ('FESTO-8065029', 'type_code', 'SMT-10G-NS-24V-E-0.3Q-M8D'),
  ('FESTO-2427615', 'connection', 'M12, 0,3 m kabel'),
  ('FESTO-2427615', 'position_output', 'NPN, slutande'),
  ('FESTO-2427615', 'type_code', 'SDBT-BSW-1L-NU-W-0.3-N-M12'),
  ('FESTO-2427615', 'connection_kalla', 'Festo datablad 2427615 (SDBT-BSW-1L-NU-W-0.3-N-M12): magnetoresistiv, NPN slutande, 0,3 m kabel med M12, kontrollerat 2026-11-13'),
  ('FESTO-173210', 'type_code', 'SME-10-KL-LED-24')
) as k(sku, key, value) on k.sku = p.sku
on conflict (product_id, key) do update set value = excluded.value;

update products set name = 'SDBT-BSW-1L-NU-W-0.3-N-M12 Proximity sensor', description = 'Magnetisk cylindergivare SDBT-BSW (magnetoresistiv), NPN slutande, 24 V DC, kabel 0,3 m med M12-kontakt.'
where sku = 'FESTO-2427615';
update products set name = 'SME-10-KL-LED-24 Proximity sensor' where sku = 'FESTO-173210' and name = 'Proximity sensor';
update products set name = 'SMT-10G-NS-24V-E-0.3Q-M8D Proximity sensor', description = 'Elektronisk cylindergivare SMT-10G, NPN slutande, 24 V, kabel 0,3 m med M8-kontakt.'
where sku = 'FESTO-8065029';

commit;

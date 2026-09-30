-- Varje cylinder ska tillhöra en familj.
--
-- 39 Metal Work-cylindrar hade family = null. Det gjorde att de inte kunde
-- dela ett familjevärde: material, standard och dämpning är ETT värde för en
-- hel serie, men utan familj blev de 312 separata luckor i stället för en
-- handfull fakta.
--
-- Familjen står i artikelnumret: MW-<FAMILJ>-<borrning>. Mönstret måste
-- tillåta siffror i familjenamnet -- linjärsliderna heter S10, S11 och S12,
-- och ett mönster med bara bokstäver missade alla tolv.
--
-- Samtidigt slogs skiftlägesdubbletter ihop: p1d/P1D och pra/PRA var två
-- familjer var, 50 artiklar som annars hade dubbelarbetats. Och ISO15552 /
-- ISO 15552 likaså.

begin;

update products set family = upper(family)
where status = 'active' and family in ('p1d','pra');

update products p
   set family = case (regexp_match(p.sku, '^MW-([A-Z]+[0-9]*)-'))[1]
                  when 'MINI' then 'MINIMACH'
                  when 'ISO'  then 'ISO 15552'
                  else (regexp_match(p.sku, '^MW-([A-Z]+[0-9]*)-'))[1]
                end
from categories c, brands b
where c.id = p.category_id and b.id = p.brand_id
  and c.slug = 'cylinder' and p.status = 'active' and b.name = 'Metal Work'
  and p.family is null and p.sku ~ '^MW-[A-Z]+[0-9]*-';

update products set family = 'ISO 15552' where family = 'ISO15552';
update products set family = 'ISO 6432'  where family = 'ISO6432';

commit;

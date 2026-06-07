-- Same family-field cleanup as cylinders/valves, for the remaining configurable
-- categories (grippers, valve-terminals, linear-modules, electric-actuators,
-- rotary actuators) so their generated configurators match products reliably.
create table if not exists backup.family_normalize_rest_20260607 as
select p.id, p.family as old_family, c.slug as cat
from public.products p join public.categories c on c.id = p.category_id
where c.slug in ('gripper','valve-terminal','linear-module','electric-actuator','rotary-actuator') and p.family is not null;

update public.products p
set family = nullif(trim(both ' ' from split_part(
      regexp_replace(regexp_replace(p.family, '-\s*[0-9].*$', ''), '-[A-Za-z]+[0-9].*$', ''),
      '/', 1)), '')
from public.categories c
where c.id = p.category_id
  and c.slug in ('gripper','valve-terminal','linear-module','electric-actuator','rotary-actuator')
  and p.family is not null
  and p.family is distinct from nullif(trim(both ' ' from split_part(
      regexp_replace(regexp_replace(p.family, '-\s*[0-9].*$', ''), '-[A-Za-z]+[0-9].*$', ''),
      '/', 1)), '');

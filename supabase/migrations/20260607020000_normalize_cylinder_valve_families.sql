-- Clean the products.family field for cylinders + valves before expanding the
-- configurator. The field was dirty: order codes ("DSBC-32-    -PPVA-N3"),
-- merged families ("CP96/C96"), etc. were stored as the "family". Strip the
-- order-code suffix to the family prefix and take the primary of merged names,
-- so configurators can match products reliably. Original values backed up.
create schema if not exists backup;
create table if not exists backup.family_normalize_20260607 as
select p.id, p.family as old_family
from public.products p join public.categories c on c.id = p.category_id
where c.slug in ('cylinder','valve') and p.family is not null;

update public.products p
set family = nullif(trim(both ' ' from split_part(
      regexp_replace(regexp_replace(p.family, '-\s*[0-9].*$', ''), '-[A-Za-z]+[0-9].*$', ''),
      '/', 1)), '')
from public.categories c
where c.id = p.category_id and c.slug in ('cylinder','valve') and p.family is not null
  and p.family is distinct from nullif(trim(both ' ' from split_part(
      regexp_replace(regexp_replace(p.family, '-\s*[0-9].*$', ''), '-[A-Za-z]+[0-9].*$', ''),
      '/', 1)), '');

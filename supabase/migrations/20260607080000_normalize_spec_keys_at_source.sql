-- Normalize catalog spec keys at the source so every consumer (advisor,
-- configurator, product page, search) reads clean canonical keys -- not just the
-- advisor's runtime normalizeKeySpecs() patch. Consolidates the bore/stroke key
-- variants and imperial values into bore_mm / stroke_mm, and finishes cleaning
-- the family field for the remaining categories. Full backups taken first.
create table if not exists backup.product_specs_normalize_20260607 as select * from public.product_specs;

-- BORE: promote best metric variant -> bore_mm (keep value incl. ranges).
update public.product_specs s set key='bore_mm'
where s.id in (
  select distinct on (product_id) id from public.product_specs
  where key in ('bore_diameter_mm','bore_diameter','bore_range')
    and product_id not in (select product_id from public.product_specs where key='bore_mm')
  order by product_id, array_position(array['bore_diameter_mm','bore_diameter','bore_range']::text[], key)
);
insert into public.product_specs (product_id, key, value, unit)
select product_id, 'bore_mm',
  case trim(value) when '1-1/16"' then '27 mm' when '1-1/2"' then '38 mm' when '2"' then '51 mm' else value end, 'mm'
from public.product_specs
where key='bore_imperial' and product_id not in (select product_id from public.product_specs where key='bore_mm');
delete from public.product_specs where key in ('bore_diameter_mm','bore_diameter','bore_range','bore_imperial');

-- STROKE: promote best variant -> stroke_mm using the MAX number (collapses ranges).
insert into public.product_specs (product_id, key, value, unit)
select product_id, 'stroke_mm', maxnum::text || ' mm', 'mm' from (
  select distinct on (product_id) product_id,
    (select max(replace(m[1],',','.')::numeric) from regexp_matches(value,'(\d+(?:[.,]\d+)?)','g') as m) as maxnum
  from public.product_specs
  where key in ('stroke_max','max_stroke_mm','max_stroke','stroke_range')
    and product_id not in (select product_id from public.product_specs where key='stroke_mm')
  order by product_id, array_position(array['stroke_max','max_stroke_mm','max_stroke','stroke_range']::text[], key)
) src where maxnum is not null;
insert into public.product_specs (product_id, key, value, unit)
select product_id, 'stroke_mm',
  case trim(value) when '2"' then '51 mm' when '4"' then '102 mm' when '6"' then '152 mm' else value end, 'mm'
from public.product_specs
where key='stroke_imperial' and product_id not in (select product_id from public.product_specs where key='stroke_mm');
delete from public.product_specs where key in ('stroke_max','max_stroke_mm','max_stroke','stroke_range','stroke_imperial');

-- FAMILY: clean remaining dirty families across all categories.
create table if not exists backup.family_normalize_all_20260607 as select id, family as old_family from public.products where family is not null;
update public.products p
set family = nullif(trim(both ' ' from split_part(
      regexp_replace(regexp_replace(p.family, '-\s*[0-9].*$', ''), '-[A-Za-z]+[0-9].*$', ''), '/', 1)), '')
where p.family is not null
  and p.family is distinct from nullif(trim(both ' ' from split_part(
      regexp_replace(regexp_replace(p.family, '-\s*[0-9].*$', ''), '-[A-Za-z]+[0-9].*$', ''), '/', 1)), '');

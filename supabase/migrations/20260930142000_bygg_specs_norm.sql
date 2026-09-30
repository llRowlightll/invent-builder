-- Bygger om product_specs_norm från grunden. Körs om när som helst.
--
-- Två val är värda att förstå:
--
-- KRAFT RÄKNAS, HÄMTAS INTE. F = p·A ger 0.4712·d² vid 6 bar. Mätt mot
-- katalogens egna värden där de var tillförlitliga föll 223 jämförelser i
-- exakt två grupper: 130 med kvot 1.000, och 93 med kvot 1.05 -- alltså
-- 6,3-barsvärden lagrade under en nyckel som heter piston_force_6bar_N.
-- Ingen tredje grupp, noll oförklarade avvikelser. Den beräknade siffran är
-- därför mer pålitlig än den lagrade, och täckningen gick från 67 % till 93 %.
--
-- MATERIAL SLÅS INTE IHOP MED body_material ELLER seal_material. De beskriver
-- olika delar av cylindern, och att slå ihop olika begrepp är värre än att
-- ha dem under skilda nycklar.

begin;

create or replace function bygg_specs_norm()
returns table(nyckel text, rader bigint)
language plpgsql security definer set search_path to 'public'
as $$
begin
  delete from product_specs_norm;

  insert into product_specs_norm (product_id, key, num, unit, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'max_pressure_bar',
         case when coalesce(s.unit,'') ilike 'mpa' or s.value ~* 'mpa'
              then spec_tal_hogt(s.value) * 10 else spec_tal_hogt(s.value) end,
         'bar', 'katalog', false, s.key
  from product_specs s
  where s.key in ('max_pressure','operating_pressure','pressure_range','pressure_range_mpa')
    and spec_tal_hogt(s.value) is not null
  order by s.product_id, array_position(array['max_pressure','operating_pressure','pressure_range','pressure_range_mpa'], s.key);

  insert into product_specs_norm (product_id, key, num, unit, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'min_pressure_bar',
         case when coalesce(s.unit,'') ilike 'mpa' or s.key like '%_mpa' or s.value ~* 'mpa'
              then spec_tal(s.value) * 10 else spec_tal(s.value) end,
         'bar', 'katalog', false, s.key
  from product_specs s
  where s.key in ('min_pressure','min_pressure_mpa','operating_pressure','pressure_range_mpa')
    and spec_tal(s.value) is not null
  order by s.product_id, array_position(array['min_pressure','min_pressure_mpa','operating_pressure','pressure_range_mpa'], s.key);

  insert into product_specs_norm (product_id, key, num, unit, kalla, ar_spann, fran_nyckel)
  select s.product_id, 'force_extend_6bar_n',
         round(0.4712 * power(spec_tal(s.value), 2)), 'N', 'beraknad', false, 'bore_mm'
  from product_specs s
  where s.key = 'bore_mm' and spec_tal(s.value) is not null and not spec_ar_intervall(s.value);

  insert into product_specs_norm (product_id, key, num, unit, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'bore_mm', spec_tal(s.value), 'mm',
         'katalog', spec_ar_intervall(s.value), s.key
  from product_specs s where s.key='bore_mm' and spec_tal(s.value) is not null
  order by s.product_id, s.key;

  insert into product_specs_norm (product_id, key, num, unit, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'stroke_mm', spec_tal(s.value), 'mm',
         'katalog', spec_ar_intervall(s.value), s.key
  from product_specs s where s.key='stroke_mm' and spec_tal(s.value) is not null
  order by s.product_id, s.key;

  insert into product_specs_norm (product_id, key, num, unit, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'weight_kg',
         case when s.key='weight' then spec_tal(s.value)/1000.0 else spec_tal(s.value) end,
         'kg', 'katalog', false, s.key
  from product_specs s where s.key in ('weight','weight_kg') and spec_tal(s.value) is not null
  order by s.product_id, array_position(array['weight_kg','weight'], s.key);

  insert into product_specs_norm (product_id, key, txt, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'port_thread', btrim(s.value), 'katalog', false, s.key
  from product_specs s where s.key in ('port','port_size') and btrim(coalesce(s.value,'')) <> ''
  order by s.product_id, array_position(array['port','port_size'], s.key);

  insert into product_specs_norm (product_id, key, txt, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'rod_thread', btrim(s.value), 'katalog', false, s.key
  from product_specs s where s.key in ('rod_thread','rod_mm') and btrim(coalesce(s.value,'')) <> ''
  order by s.product_id, array_position(array['rod_thread','rod_mm'], s.key);

  insert into product_specs_norm (product_id, key, txt, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'material', btrim(s.value), 'katalog', false, s.key
  from product_specs s where s.key in ('material','body_material') and btrim(coalesce(s.value,'')) <> ''
  order by s.product_id, array_position(array['material','body_material'], s.key);

  insert into product_specs_norm (product_id, key, txt, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'cushioning', btrim(s.value), 'katalog', false, s.key
  from product_specs s where s.key in ('cushioning','cushioning_types') and btrim(coalesce(s.value,'')) <> ''
  order by s.product_id, array_position(array['cushioning','cushioning_types'], s.key);

  insert into product_specs_norm (product_id, key, txt, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'mode_of_operation', btrim(s.value), 'katalog', false, s.key
  from product_specs s where s.key in ('mode_of_operation','actuator_type') and btrim(coalesce(s.value,'')) <> ''
  order by s.product_id, array_position(array['mode_of_operation','actuator_type'], s.key);

  insert into product_specs_norm (product_id, key, txt, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'standard', btrim(s.value), 'katalog', false, s.key
  from product_specs s where s.key = 'standard' and btrim(coalesce(s.value,'')) <> ''
  order by s.product_id, s.key;

  insert into product_specs_norm (product_id, key, txt, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'temp_range', btrim(s.value), 'katalog', false, s.key
  from product_specs s where s.key = 'temp_range' and btrim(coalesce(s.value,'')) <> ''
  order by s.product_id, s.key;

  insert into product_specs_norm (product_id, key, txt, kalla, ar_spann, fran_nyckel)
  select distinct on (s.product_id) s.product_id, 'magnetic_piston', btrim(s.value), 'katalog', false, s.key
  from product_specs s
  where s.key in ('magnetic_piston','position_sensing','position_output') and btrim(coalesce(s.value,'')) <> ''
  order by s.product_id, array_position(array['magnetic_piston','position_sensing','position_output'], s.key);

  return query select n.key, count(*) from product_specs_norm n group by n.key order by count(*) desc;
end $$;

revoke all on function bygg_specs_norm() from public, anon, authenticated;

commit;

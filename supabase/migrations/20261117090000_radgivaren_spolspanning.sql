-- Rådgivarens produktlista: spolspänning och märkspänning följer med
-- (2026-11-17). Maskinbyggarens spänningskontroll läste bara nyckeln
-- 'voltage', men 41 ventiler och ventilterminaler har spänningen som
-- 'solenoid_voltage' (elcylindrar som 'nominal_voltage'). Med kravet
-- "24 V DC" fick de därför "katalogen anger ingen spänning" fast uppgiften
-- fanns. provaSpanning (groq-advisor/kontroller.ts) läser nycklarna i
-- turordning. I övrigt oförändrad.

create or replace function public.fetch_products_for_advisor(p_category_slug text default null::text, p_limit integer default 25)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (select p.sku, p.name, p.family, c.slug as category, c.name as category_name,
      b.slug as brand, b.name as brand_name,
      (select jsonb_object_agg(ps.key, ps.value || coalesce(' ' || ps.unit, ''))
       from product_specs ps where ps.product_id = p.id and ps.key in (
         'bore_diameter_mm','bore_mm','stroke_mm','stroke_range','stroke_max','max_stroke',
         'piston_force_6bar_N','max_pressure','ip_rating','standard','temp_range',
         'gripping_force_closing_N','max_jaw_force_Fz','flow_rate_l_min',
         'operating_pressure','force_n','sizes','voltage','solenoid_voltage','nominal_voltage',
         'fieldbus','repeatability_mm','mode_of_operation',
         'material','special_features',
         'torque','torque_nm','rotation_angle','swivel_angle_max'
       )) as key_specs
    from products p join categories c on p.category_id = c.id join brands b on p.brand_id = b.id
    where p.status = 'active'
      and (p_category_slug is null or c.slug = p_category_slug) order by b.slug, p.sku limit p_limit
  ) t;
$function$;

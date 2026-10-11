-- Rådgivaren får se vridenheternas vridmoment och vinkel.
--
-- fetch_products_for_advisor skickar bara en vitlista av specnycklar till
-- motorn. torque och rotation_angle fanns inte med, så vridenhetsvalet i
-- index.ts (isPureRotary) läste 0 Nm på varje artikel och valde blint: "Vrida
-- en detalj 90 grader" fick "R3-30 — 0 Nm är det högsta vridmoment vi har i
-- lager" och en svängklämma (MW-SWC-90). Katalogen har vridmomentet med
-- källrader (MW R2/R3, Festo DAPS). Hittat i drift 2026-10-11 när följdfrågorna
-- började räkna fram ett vridmoment ur vikt och hävarm.
--
-- Definitionen nedan är 20261006100000_radgivaren_ser_material.sql:s,
-- ordagrant, plus fyra nycklar.

create or replace function public.fetch_products_for_advisor(p_category_slug text default null::text, p_limit integer default 25)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (SELECT p.sku, p.name, p.family, c.slug AS category, c.name AS category_name,
      b.slug AS brand, b.name AS brand_name,
      (SELECT jsonb_object_agg(ps.key, ps.value || COALESCE(' ' || ps.unit, ''))
       FROM product_specs ps WHERE ps.product_id = p.id AND ps.key IN (
         'bore_diameter_mm','bore_mm','stroke_mm','stroke_range','stroke_max','max_stroke',
         'piston_force_6bar_N','max_pressure','ip_rating','standard','temp_range',
         'gripping_force_closing_N','max_jaw_force_Fz','flow_rate_l_min',
         'operating_pressure','force_n','sizes','voltage','fieldbus','repeatability_mm','mode_of_operation',
         'material','special_features',
         'torque','torque_nm','rotation_angle','swivel_angle_max'
       )) AS key_specs
    FROM products p JOIN categories c ON p.category_id = c.id JOIN brands b ON p.brand_id = b.id
    WHERE p.status = 'active'
      AND (p_category_slug IS NULL OR c.slug = p_category_slug) ORDER BY b.slug, p.sku LIMIT p_limit
  ) t;
$function$;

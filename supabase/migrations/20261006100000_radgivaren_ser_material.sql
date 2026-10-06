-- Rådgivaren får se material och särdrag.
--
-- fetch_products_for_advisor skickar bara en vitlista av specnycklar till
-- motorn. material och special_features fanns inte med, så "FDA seals;
-- NSF-H1 lube" (FESTO-DSBF) och "food industry, wash-down" (Camozzi Serie 90)
-- nådde aldrig poängsättningen. Hittat i drift 2026-10-06 efter #331: en
-- livsmedelsfråga om Ø32 rankade DSBF sist av tre serier -- livsmedelsbonusen
-- i scoreProduct() (harLivsmedelsstod) såg bara namnet.
--
-- Definitionen nedan är 20260921100000_advisor_rpcs_active_only.sql:s,
-- ordagrant, plus de två nycklarna.

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
         'material','special_features'
       )) AS key_specs
    FROM products p JOIN categories c ON p.category_id = c.id JOIN brands b ON p.brand_id = b.id
    WHERE p.status = 'active'
      AND (p_category_slug IS NULL OR c.slug = p_category_slug) ORDER BY b.slug, p.sku LIMIT p_limit
  ) t;
$function$;

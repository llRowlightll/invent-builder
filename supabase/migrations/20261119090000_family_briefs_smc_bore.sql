-- Orderkoder från SMC lästes inte: 19 SMC-familjer (CQ2, CJ2, CM2, C85, CP96,
-- CY1…, MB, MXS, RQ, MHZ2 …) har borrningen under param_key 'bore', inte
-- 'bore_mm', och föll därför bort ur listan helt. "Replacement for SMC
-- CDQ2B32-50DZ" gav en Ø40 (nattestet 2026-11-19). Nu räknas båda nycklarna.
-- Funktionen är oförändrad i övrigt och läser bara.
create or replace function public.get_family_briefs()
returns table(slug text, name text, bores integer[], stroke_min integer, stroke_max integer)
language sql
stable
set search_path to 'public'
as $function$
  select f.slug,
         f.name,
         coalesce((
           select array_agg(distinct (v.code)::int order by (v.code)::int)
           from configurator_param_values v
           join configurator_params p on p.id = v.param_id
           where p.family_id = f.id and p.param_key in ('bore_mm', 'bore') and v.code ~ '^\d+$'
         ), '{}'::int[]),
         f.stroke_min_mm,
         f.stroke_max_mm
  from configurator_families f
  where exists (
    select 1 from configurator_param_values v
    join configurator_params p on p.id = v.param_id
    where p.family_id = f.id and p.param_key in ('bore_mm', 'bore') and v.code ~ '^\d+$'
  );
$function$;

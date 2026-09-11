-- Underlaget rådgivaren behöver för att LÄSA en orderkod.
--
-- BAKGRUND. En sökning på sajtens egen exempelprodukt, DSBC-50-100-PPSA-N3,
-- gav två Bosch Rexroth Ø32/Ø40 med motiveringen att de låg "inom det maximala
-- bore-kravet på 50 mm". En EXAKT storlek lästes alltså som ett TAK, och Ø32
-- ger 483 N mot kravets 1178 N -- 41 %. Samma svar hittade dessutom på att
-- "N3-klassningen motsvarar IP-67" (N3 är en standardkonformitetskod) och att
-- PPSA var en trycknivå (det är dämpning).
--
-- Roten: koden slogs aldrig upp. Den matchades som fri text och LLM:en fick
-- tolka den. Med den här vyn kan rådgivaren i stället slå upp den -- och när
-- den inte går att slå upp säga det, i stället för att fylla i.
--
-- Borrningslistan är det som gör läsningen GENERISK. CQ2B32-100,
-- P1D-S050MS-0200 och DSBC-50-100 har helt olika grammatik, men i alla tre är
-- borrningen det första talet efter serienamnet, och det talet måste finnas i
-- familjens egen lista. Ingen familjespecifik kod behövs.

create or replace function public.get_family_briefs()
returns table (slug text, name text, bores int[], stroke_min int, stroke_max int)
language sql
stable
security invoker
set search_path = public
as $$
  select f.slug,
         f.name,
         coalesce((
           select array_agg((v.code)::int order by (v.code)::int)
           from configurator_param_values v
           join configurator_params p on p.id = v.param_id
           where p.family_id = f.id and p.param_key = 'bore_mm' and v.code ~ '^\d+$'
         ), '{}'::int[]),
         f.stroke_min_mm,
         f.stroke_max_mm
  from configurator_families f
  where exists (
    select 1 from configurator_param_values v
    join configurator_params p on p.id = v.param_id
    where p.family_id = f.id and p.param_key = 'bore_mm' and v.code ~ '^\d+$'
  );
$$;

grant execute on function public.get_family_briefs() to anon, authenticated;

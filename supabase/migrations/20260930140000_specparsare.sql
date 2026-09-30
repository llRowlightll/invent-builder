-- Parsare för produktspecar.
--
-- Samma storhet ligger under olika nycklar OCH i olika format. max_pressure
-- innehåller "10", "10 bar" och "3–7 bar", med enheten både som bar och MPa.
-- min_pressure_mpa innehåller "0.1 (enkelverkande 0.25)". piston_force_6bar_N
-- innehåller "17–4712", vilket är hela familjens spann på en enskild artikel.
--
-- Funktionerna plockar ut tal ur text, säger om värdet är ett INTERVALL (och
-- därmed familjedata på en produktrad) och räknar om MPa till bar. Rena och
-- immutable, så de kan användas i index och vyer.

begin;

create or replace function spec_tal(p_text text) returns numeric language sql immutable as $$
  select nullif((regexp_match(replace(coalesce(p_text,''), ',', '.'),
                              '(-?[0-9]+(?:\.[0-9]+)?)'))[1], '')::numeric $$;

create or replace function spec_tal_hogt(p_text text) returns numeric language sql immutable as $$
  select nullif((regexp_match(replace(coalesce(p_text,''), ',', '.'),
                              '(-?[0-9]+(?:\.[0-9]+)?)(?!.*[0-9])'))[1], '')::numeric $$;

create or replace function spec_ar_intervall(p_text text) returns boolean language sql immutable as $$
  select coalesce(p_text,'') ~ '[0-9]\s*(–|—|\.\.\.|…|till|to)\s*[0-9]' $$;

create or replace function spec_till_bar(p_varde text, p_unit text) returns numeric language sql immutable as $$
  select case
    when p_varde is null then null
    when coalesce(p_unit,'') ilike 'mpa' or coalesce(p_varde,'') ~* 'mpa' then spec_tal(p_varde) * 10
    else spec_tal(p_varde) end $$;

revoke all on function spec_tal(text), spec_tal_hogt(text),
                      spec_ar_intervall(text), spec_till_bar(text, text) from public;
grant execute on function spec_tal(text), spec_tal_hogt(text),
                          spec_ar_intervall(text), spec_till_bar(text, text) to anon, authenticated;

commit;

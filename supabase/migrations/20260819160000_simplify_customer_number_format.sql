-- User request 2026-08-19: switch customer_number from "MV-YYYY-NNNN" to a
-- plain 5-digit number that always starts with 12 (12001, 12002, ...) --
-- simpler to say/type/read on invoices and phone calls than the old
-- prefixed format. Only 2 company_profiles rows exist so far (both early
-- test/seed data from May 2026, no real customer-facing invoice has gone
-- out referencing the old numbers) -- renumbered them in place, oldest
-- first, so existing data matches the new scheme.
with numbered as (
  select id, row_number() over (order by created_at asc) as rn
  from public.company_profiles
  where customer_number ~ '^MV-'
)
update public.company_profiles cp
set customer_number = '12' || lpad(numbered.rn::text, 3, '0')
from numbered
where cp.id = numbered.id;

create or replace function public.generate_customer_number()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare seq_val int;
begin
  if new.customer_number is null then
    select coalesce(max(cast(substring(customer_number from 3) as int)), 0) + 1
    into seq_val
    from public.company_profiles
    where customer_number ~ '^12\d{3}$';
    new.customer_number := '12' || lpad(seq_val::text, 3, '0');
  end if;
  return new;
end;
$function$;

-- Offertdatum och giltighet (allmänna villkor 1.2, avsnitt 3: en offert
-- gäller i 30 dagar från offertdatum).
--
-- Offerten visade rfqs.created_at som "Datum" -- dagen kunden skickade sin
-- förfrågan, inte dagen offerten lämnades. Med en giltighet räknad från
-- offertdatum gick slutdagen inte att räkna ut. quoted_at sätts av en trigger
-- varje gång statusen blir 'quoted' (admin.offert sätter den med en vanlig
-- update), så en omskickad offert får nytt datum.
alter table public.rfqs add column if not exists quoted_at timestamptz;

create or replace function public.satt_offertdatum()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status = 'quoted' and old.status is distinct from 'quoted' then
    new.quoted_at := now();
  end if;
  return new;
end $$;

drop trigger if exists rfqs_offertdatum on public.rfqs;
create trigger rfqs_offertdatum
  before update of status on public.rfqs
  for each row execute function public.satt_offertdatum();

-- Returtypen ändras, så funktionen måste droppas och skapas om (se
-- 20260908170000_narrow_public_quote_order_rpcs.sql).
drop function if exists public.get_quote_by_id(uuid);

create function public.get_quote_by_id(p_id uuid)
returns table (
  id uuid,
  contact_name text,
  contact_email text,
  company text,
  org_number text,
  po_number text,
  status text,
  quote_amount numeric,
  quote_currency text,
  discount_pct numeric,
  created_at timestamptz,
  quoted_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select r.id, r.contact_name, r.contact_email, r.company, r.org_number,
         r.po_number, r.status, r.quote_amount, r.quote_currency,
         r.discount_pct, r.created_at, r.quoted_at
  from public.rfqs r
  where r.id = p_id;
$$;

grant execute on function public.get_quote_by_id(uuid) to anon, authenticated;

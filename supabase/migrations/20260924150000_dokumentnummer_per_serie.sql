-- Numreringen får flera serier.
--
-- order_number_counters höll EN serie: MV-2026-00001. Leverantörsordern
-- behöver sin egen (MPO-2026-00431), och fakturan kommer att behöva en till.
-- Tre räknartabeller för tre serier är tre ställen att glömma; en tabell med
-- prefix i nyckeln är ett.
--
-- Tabellen byter därför namn till document_number_counters och får prefix i
-- primärnyckeln. next_order_number() finns kvar precis som förut -- triggern
-- på orders anropar den, och den ska inte behöva veta om det här.
--
-- Varför en räknare i en tabell och inte en sequence: numret ska börja om på
-- 1 varje år, och luckor (som en sequence ger vid rollback) är svåra att
-- förklara för en revisor.

begin;

alter table if exists order_number_counters rename to document_number_counters;

alter table document_number_counters add column if not exists prefix text not null default 'MV';

alter table document_number_counters drop constraint if exists order_number_counters_pkey;
alter table document_number_counters drop constraint if exists document_number_counters_pkey;
alter table document_number_counters add primary key (prefix, year);

comment on table document_number_counters is
  'En räknare per dokumentserie och år. MV = kundorder, MPO = leverantörsorder. Rörs bara av next_document_number().';

-- Serien, året och numret. Låser bara sin egen rad.
create or replace function next_document_number(p_prefix text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_prefix text := upper(btrim(coalesce(p_prefix, '')));
  v_year   integer := extract(year from now())::int;
  v_n      integer;
begin
  if v_prefix = '' then
    raise exception 'dokumentserien måste ha ett prefix';
  end if;

  insert into document_number_counters (prefix, year, last_used)
  values (v_prefix, v_year, 1)
  on conflict (prefix, year) do update set last_used = document_number_counters.last_used + 1
  returning last_used into v_n;

  return v_prefix || '-' || v_year || '-' || lpad(v_n::text, 5, '0');
end $$;

-- Oförändrat kontrakt: triggern på orders anropar den här.
create or replace function next_order_number()
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  return next_document_number('MV');
end $$;

commit;

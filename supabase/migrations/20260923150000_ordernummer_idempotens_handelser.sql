-- Tre saker checkouten kräver: ordernummer, idempotens och statushändelser.
--
-- 1. ORDERNUMMER. Ordern har i dag inget läsbart nummer -- vyerna visar
--    id.slice(0,8), alltså åtta tecken ur ett uuid. Kunden ska kunna säga
--    "MV-2026-00124" i telefon, och samma sträng ska gå att söka på.
--    Numret sätts av en BEFORE INSERT-trigger, inte av anroparen, så det
--    finns oavsett väg in: RPC:n, adminsidan eller checkouten.
--
--    Räknaren ligger per år i en egen tabell. "insert ... on conflict do
--    update ... returning" tar ett radlås och är därför säker när två ordrar
--    läggs samtidigt; luckor kan uppstå vid rollback, vilket är normalt och
--    ofarligt för ett ordernummer (det är en identifierare, inte en
--    verifikationsserie -- fakturanummer har andra krav).
--
-- 2. IDEMPOTENS. Specen kräver att samma knapptryckning eller webhook aldrig
--    ger en dubblett. Det löses här i DATABASEN med en unik nyckel, inte i
--    applikationslogik: en unik nyckel kan inte glömmas bort av nästa
--    utvecklare. create_order_with_items returnerar den befintliga ordern om
--    nyckeln redan finns -- även när två anrop kommer samtidigt, då
--    unikhetsbrottet fångas och den vinnande ordern returneras.
--
-- 3. STATUSHÄNDELSER. order_status_events är ryggraden för notifieringarna:
--    ett mejl ska skickas för att en händelse inträffade, inte för att någon
--    kom ihåg att anropa en funktion på rätt ställe. Tabellen skrivs av
--    triggrar på orders.status och order_items.status, så ingen kodväg kan
--    ändra en status utan att det syns.

begin;

-- ── 1. Ordernummer ──────────────────────────────────────────────────────────

create table if not exists order_number_counters (
  year      integer primary key,
  last_used integer not null default 0
);
alter table order_number_counters enable row level security;
-- Ingen policy: bara trigger- och servicevägen rör tabellen.

alter table orders add column if not exists order_number text;
create unique index if not exists orders_order_number_uniq on orders (order_number);

create or replace function next_order_number()
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_year integer := extract(year from now())::int;
  v_n    integer;
begin
  insert into order_number_counters (year, last_used)
  values (v_year, 1)
  on conflict (year) do update set last_used = order_number_counters.last_used + 1
  returning last_used into v_n;

  return 'MV-' || v_year || '-' || lpad(v_n::text, 5, '0');
end $$;

create or replace function set_order_number()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.order_number is null then
    new.order_number := next_order_number();
  end if;
  return new;
end $$;

create trigger orders_set_order_number before insert on orders
  for each row execute function set_order_number();

-- Befintliga ordrar (noll i dag) får nummer i skapandeordning.
do $$
declare r record;
begin
  for r in select id from orders where order_number is null order by created_at loop
    update orders set order_number = next_order_number() where id = r.id;
  end loop;
end $$;

-- ── 2. Idempotens ───────────────────────────────────────────────────────────

alter table orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_key_uniq
  on orders (idempotency_key) where idempotency_key is not null;

comment on column orders.idempotency_key is
  'Samma nyckel ger samma order. Unikheten ligger i databasen med flit: ett dubbelklick eller en omsänd webhook ska inte kunna skapa två ordrar även om applikationslogiken glömmer kontrollen.';

-- ── 3. Statushändelser ──────────────────────────────────────────────────────

create table if not exists order_status_events (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  -- Satt när händelsen gäller EN rad, null när den gäller hela ordern.
  order_item_id uuid references order_items(id) on delete cascade,
  from_status   text,
  to_status     text not null,
  source        text not null default 'system'
                check (source in ('system','admin','customer','supplier','carrier','payment')),
  actor_user_id uuid references auth.users(id) on delete set null,
  note          text,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists order_status_events_order_idx on order_status_events (order_id, created_at);
create index if not exists order_status_events_item_idx on order_status_events (order_item_id);

comment on table order_status_events is
  'Varje statusövergång, på order- och radnivå. Notifieringarna hänger på den här tabellen: ett mejl skickas för att en händelse inträffade, inte för att någon kom ihåg att anropa rätt funktion.';

alter table order_status_events enable row level security;

create policy "order_status_events: admin all" on order_status_events for all
  using (has_role((select auth.uid()), 'admin'))
  with check (has_role((select auth.uid()), 'admin'));

create policy "order_status_events: owner read" on order_status_events for select
  using (exists (select 1 from orders o
                 where o.id = order_status_events.order_id
                   and o.user_id = (select auth.uid())));

create or replace function log_order_status_event()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_actor uuid;
begin
  begin v_actor := auth.uid(); exception when others then v_actor := null; end;
  if v_actor is not null and not exists (select 1 from auth.users where id = v_actor) then
    v_actor := null;   -- samma skäl som i fn_audit_log: loggen får inte fälla skrivningen
  end if;

  if tg_table_name = 'orders' then
    if tg_op = 'INSERT' then
      insert into order_status_events (order_id, to_status, source, actor_user_id)
      values (new.id, new.status, case when v_actor is null then 'system' else 'admin' end, v_actor);
    elsif new.status is distinct from old.status then
      insert into order_status_events (order_id, from_status, to_status, source, actor_user_id)
      values (new.id, old.status, new.status, case when v_actor is null then 'system' else 'admin' end, v_actor);
    end if;
  else
    if tg_op = 'INSERT' then
      insert into order_status_events (order_id, order_item_id, to_status, source, actor_user_id)
      values (new.order_id, new.id, new.status, case when v_actor is null then 'system' else 'admin' end, v_actor);
    elsif new.status is distinct from old.status then
      insert into order_status_events (order_id, order_item_id, from_status, to_status, source, actor_user_id)
      values (new.order_id, new.id, old.status, new.status,
              case when v_actor is null then 'system' else 'admin' end, v_actor);
    end if;
  end if;
  return null;
end $$;

create trigger orders_status_event after insert or update on orders
  for each row execute function log_order_status_event();
create trigger order_items_status_event after insert or update on order_items
  for each row execute function log_order_status_event();

commit;

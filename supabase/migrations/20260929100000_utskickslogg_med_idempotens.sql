-- Varje mejl systemet skickar får en rad här.
--
-- Bakgrunden: fem edge-funktioner skickade mejl via Resend och INGEN av dem
-- lämnade ett spår. Ingen tabell, inget sparat svar, ingen idempotens. När det
-- kom för många mejl gick det inte att se vad som skickats, till vem eller
-- varför -- orsaken fick läsas ur ett Python-skript i nattkörningen.
--
-- Nyckeln är idempotency_key med ett UNIKT index. Skyddet mot dubbelutskick
-- ligger alltså i databasen och inte i applikationslogik, precis som för
-- orders -- två samtidiga anrop kan inte båda vinna.

begin;

create table if not exists notifications (
  id               uuid primary key default gen_random_uuid(),
  kind             text        not null,
  to_email         text        not null,
  subject          text        not null,
  idempotency_key  text        not null unique,
  status           text        not null default 'pending'
                     check (status in ('pending','sent','failed','dead')),
  attempts         int         not null default 0,
  last_error       text,
  provider_id      text,
  ref_table        text,
  ref_id           uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  sent_at          timestamptz
);

comment on table notifications is
  'Utskickslogg. En rad per logiskt mejl; idempotency_key hindrar dubbletter.';
comment on column notifications.idempotency_key is
  'T.ex. rfq_customer:<uuid>. Unikt index -- databasen, inte koden, hindrar dubbelutskick.';
comment on column notifications.status is
  'pending = rad skapad men inte skickad · sent = leverantören tog emot · failed = gick fel, kan försökas igen · dead = gav upp';

-- En framtida omförsökare letar failed-rader. Partiellt index eftersom
-- sent-raderna snart är de allra flesta och aldrig ska sökas igenom.
create index if not exists notifications_att_forsoka
  on notifications (created_at) where status in ('pending','failed');
create index if not exists notifications_ref on notifications (ref_table, ref_id);
create index if not exists notifications_kind_tid on notifications (kind, created_at desc);

create or replace function trg_notifications_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists notifications_updated_at on notifications;
create trigger notifications_updated_at before update on notifications
  for each row execute function trg_notifications_updated_at();

-- Raderna innehåller kundernas e-postadresser och ärenderader. Ingen kundroll
-- får läsa dem; service_role skriver, admin läser.
alter table notifications enable row level security;

drop policy if exists notifications_admin_las on notifications;
create policy notifications_admin_las on notifications
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'));

revoke all on notifications from anon, authenticated;
grant select on notifications to authenticated;

commit;

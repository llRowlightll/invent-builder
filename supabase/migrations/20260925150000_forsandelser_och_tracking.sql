-- Försändelser och spårning (§7-8).
--
-- shipments fanns men var en FRAKTBOKNING: den hängde på rfq_id, bar en
-- etikett-URL från transportören och visste ingenting om vilka orderrader som
-- faktiskt låg i paketet. Den hade noll rader.
--
-- §7 kräver något annat: en order kan komma från flera leverantörer i flera
-- försändelser, kunden ska se "Försändelse 1 av 3" med vad som är i varje, och
-- EN ORDERRAD KAN DELAS mellan flera försändelser -- fyra cylindrar där två
-- kommer nu och två om sex veckor är inte två orderrader.
--
-- Tabellen byggs därför ut i stället för att få en parallell granne: en
-- fraktbokning ÄR en försändelse, och två tabeller för samma sak hade blivit
-- två sanningar. rfq_id är kvar för book-shipment.

begin;

alter table public.shipments add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.shipments add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.shipments add column if not exists spo_id uuid references public.supplier_purchase_orders(id) on delete set null;
alter table public.shipments add column if not exists shipment_no int;
alter table public.shipments add column if not exists sender text;
alter table public.shipments add column if not exists recipient text;
alter table public.shipments add column if not exists package_count int;
alter table public.shipments add column if not exists incoterms text;
alter table public.shipments add column if not exists shipped_at timestamptz;
alter table public.shipments add column if not exists estimated_delivery date;
alter table public.shipments add column if not exists delivered_at timestamptz;
alter table public.shipments add column if not exists proof_of_delivery text;
alter table public.shipments add column if not exists tracking_url text;
alter table public.shipments add column if not exists updated_at timestamptz not null default now();

-- Transportören är inte känd när leverantören bara säger "den är skickad".
-- Ett krav som tvingar fram en påhittad transportör är värre än ett tomt fält.
alter table public.shipments alter column carrier drop not null;

alter table public.shipments drop constraint if exists shipments_status_check;
alter table public.shipments add constraint shipments_status_check
  check (status is null or status in ('booked','in_transit','delivered','returned','cancelled'));

create index if not exists shipments_order_idx on public.shipments (order_id);
create index if not exists shipments_spo_idx on public.shipments (spo_id);

comment on table public.shipments is
  'En försändelse: gods som rör sig från avsändare till mottagare. Bär både fraktbokningen (rfq_id, label_url) och orderns försändelse (order_id, rader i shipment_items).';

-- INGEN unik nyckel på order_item_id: samma orderrad får förekomma i flera
-- försändelser med var sitt antal. Det är hela poängen med §7.
create table if not exists public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  qty numeric not null check (qty > 0),
  created_at timestamptz not null default now()
);

create index if not exists shipment_items_shipment_idx on public.shipment_items (shipment_id);
create index if not exists shipment_items_order_item_idx on public.shipment_items (order_item_id);

comment on table public.shipment_items is
  'Vilka orderrader och hur många av var som ligger i en försändelse. Ingen unik nyckel på order_item_id -- en rad får delas mellan flera försändelser.';

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  status text,
  description text,
  location text,
  source text not null default 'manual',
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tracking_events_shipment_idx on public.tracking_events (shipment_id, occurred_at desc);

comment on column public.tracking_events.source is
  'manual = avskriven av en människa, carrier = transportörens API, supplier = leverantörens besked. En avskriven händelse är inte lika säker som en hämtad.';

alter table public.shipment_items enable row level security;
alter table public.tracking_events enable row level security;

drop policy if exists "shipment_items: admin all" on public.shipment_items;
create policy "shipment_items: admin all" on public.shipment_items
  for all using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

-- Kunden ser sina egna försändelsers innehåll -- det är hennes gods.
drop policy if exists "shipment_items: owner read" on public.shipment_items;
create policy "shipment_items: owner read" on public.shipment_items
  for select using (exists (
    select 1 from public.shipments s
      join public.orders o on o.id = s.order_id
     where s.id = shipment_items.shipment_id and o.user_id = auth.uid()));

drop policy if exists "tracking_events: admin all" on public.tracking_events;
create policy "tracking_events: admin all" on public.tracking_events
  for all using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

drop policy if exists "tracking_events: owner read" on public.tracking_events;
create policy "tracking_events: owner read" on public.tracking_events
  for select using (exists (
    select 1 from public.shipments s
      join public.orders o on o.id = s.order_id
     where s.id = tracking_events.shipment_id and o.user_id = auth.uid()));

drop policy if exists "shipments: owner read" on public.shipments;
create policy "shipments: owner read" on public.shipments
  for select using (exists (
    select 1 from public.orders o where o.id = shipments.order_id and o.user_id = auth.uid()));

drop trigger if exists shipments_updated_at on public.shipments;
create trigger shipments_updated_at before update on public.shipments
  for each row execute function set_updated_at();

drop trigger if exists audit_shipments on public.shipments;
create trigger audit_shipments after insert or update or delete on public.shipments
  for each row execute function fn_audit_log();

commit;

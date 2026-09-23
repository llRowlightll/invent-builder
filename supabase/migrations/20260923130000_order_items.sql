-- order_items: orderraden blir en rad, inte ett fält i en JSON-klump.
--
-- VARFÖR. orders.items är en jsonb-array. En orderrad måste kunna
--
--   * delas mellan FLERA leverantörsordrar (kundorder MV-2026-00124 blir
--     MPO-…431 till Parker och MPO-…432 till SMC)
--   * delas mellan FLERA försändelser (tre av tio levereras nu, sju senare)
--   * ha EGEN status (bekräftad, restnoterad, skickad, levererad)
--
-- Inget av det går att referera i en JSON-klump: det finns inget id att peka
-- på. Det är därför den här tabellen måste komma före checkouten, inte efter.
--
-- SNAPSHOTS. sku, namn, märke, pris, moms och ledtid sparas som VÄRDEN, inte
-- som referenser. Katalogen ska kunna ändras utan att en lagd order rör sig --
-- samma princip som configurator-migrationerna redan använder, och den enda
-- som gör en gammal orderbekräftelse trovärdig i efterhand.
--
-- orders.items BEHÅLLS SOM HÄRLEDD KOPIA. Fyra vyer läser den i dag
-- (kundens ordersida, admins orderbekräftelse, adminlistan och den publika
-- /oc/:id via get_order_by_id). Att skriva om dem samtidigt hade varit en
-- ändring som inte går att verifiera utan inloggning. I stället håller en
-- trigger items i synk FRÅN raderna: en sanning, en kopia -- inte två
-- sanningar. När läsarna flyttat över tas kolumnen bort.
--
-- Triggern är STATEMENT-nivå: en insert av tio rader ger EN uppdatering av
-- ordern, inte tio. Det spelar roll nu när orders också får ett audit-spår.
--
-- orders SAKNADE AUDIT-TRIGGER. rfqs och shipments har fn_audit_log sedan
-- tidigare; orders, som ska bära kundordrarna, hade ingen. Läggs till här.
--
-- Tabellen är tom i dag (noll ordrar), så backfillen nedan är en nolloperation
-- -- den finns för att vara rätt om raden skulle ha funnits.

begin;

create table if not exists order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  line_no       integer not null,

  -- Nullbar med flit: SPECIFY- och CUSTOM-SOLUTION-rader ur maskinbyggaren
  -- har ingen katalogprodukt, men ska ändå kunna beställas och följas.
  product_id    uuid references products(id) on delete set null,

  -- Snapshots. Ändras aldrig efter att ordern lagts.
  sku           text not null,
  name          text not null,
  brand         text,
  qty           numeric not null check (qty > 0),
  unit_price_ex_vat  numeric,
  line_total_ex_vat  numeric,
  vat_rate      numeric not null default 0.25,
  currency      text not null default 'SEK',
  lead_time_days integer,
  note          text,

  -- Radens egen status. Kundorderns status HÄRLEDS ur de här, den sätts
  -- aldrig för hand: ordern är levererad först när varje rad är det.
  status        text not null default 'pending'
                check (status in ('pending','ordered','acknowledged','backordered',
                                  'shipped','delivered','cancelled','returned')),

  -- Vilken leverantör raden ska köpas från. Resultatet av
  -- leverantörsvalet, sparat så att grupperingen till inköpsordrar går att
  -- granska i efterhand.
  intended_supplier_id uuid references suppliers(id) on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (order_id, line_no)
);

create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists order_items_status_idx on order_items (status);
create index if not exists order_items_supplier_idx on order_items (intended_supplier_id);

comment on table order_items is
  'Orderraden som rad. Måste kunna delas mellan flera leverantörsordrar och flera försändelser, vilket en jsonb-array inte kan. orders.items hålls i synk härifrån av trigger tills läsarna flyttat över.';
comment on column order_items.status is
  'Radens egen status. Kundorderns status härleds ur raderna och sätts aldrig för hand.';

-- ── orders.items hålls i synk FRÅN raderna ──────────────────────────────────

-- Skriver bara när innehållet faktiskt skiljer sig. En radstatus som ändras
-- (bekräftad -> skickad) rör inte items, och ska då varken flytta
-- orders.updated_at eller lämna en rad i audit-spåret. Mätt: ren
-- statusändring ger 0 orders-uppdateringar, en ändrad kvantitet ger 1.
create or replace function refresh_order_items_json(p_order_ids uuid[])
returns void language sql security definer set search_path to 'public' as $$
  update orders o
  set items = ny.items
  from (
    select o2.id,
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'sku', oi.sku, 'name', oi.name, 'qty', oi.qty,
                      'unit_price_ex_vat', oi.unit_price_ex_vat,
                      'total_price_ex_vat', oi.line_total_ex_vat,
                      'brand', coalesce(oi.brand, ''), 'note', oi.note
                    ) order by oi.line_no)
             from order_items oi where oi.order_id = o2.id), '[]'::jsonb) as items
    from orders o2 where o2.id = any(p_order_ids)
  ) ny
  where o.id = ny.id and o.items is distinct from ny.items;
$$;

create or replace function order_items_sync_ins() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  perform refresh_order_items_json(array(select distinct order_id from nya));
  return null;
end $$;

create or replace function order_items_sync_upd() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  perform refresh_order_items_json(array(
    select distinct order_id from nya union select distinct order_id from gamla));
  return null;
end $$;

create or replace function order_items_sync_del() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  perform refresh_order_items_json(array(select distinct order_id from gamla));
  return null;
end $$;

create trigger order_items_sync_ins after insert on order_items
  referencing new table as nya for each statement execute function order_items_sync_ins();
create trigger order_items_sync_upd after update on order_items
  referencing new table as nya old table as gamla for each statement execute function order_items_sync_upd();
create trigger order_items_sync_del after delete on order_items
  referencing old table as gamla for each statement execute function order_items_sync_del();

-- ── Backfill ur befintlig items-array ───────────────────────────────────────
--
-- Noll rader i dag. Finns för att vara rätt om en order hade funnits.

insert into order_items (order_id, line_no, sku, name, brand, qty,
                         unit_price_ex_vat, line_total_ex_vat, vat_rate, currency, note)
select o.id,
       (row_number() over (partition by o.id order by ordinality))::int,
       coalesce(e.value->>'sku', '—'),
       coalesce(e.value->>'name', 'Okänd produkt'),
       nullif(e.value->>'brand', ''),
       coalesce((e.value->>'qty')::numeric, 1),
       (e.value->>'unit_price_ex_vat')::numeric,
       (e.value->>'total_price_ex_vat')::numeric,
       coalesce(o.vat_rate, 0.25),
       coalesce(o.currency, 'SEK'),
       nullif(e.value->>'note', '')
from orders o
cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items) = 'array'
                                             then o.items else '[]'::jsonb end)
                   with ordinality as e(value, ordinality)
where not exists (select 1 from order_items oi where oi.order_id = o.id);

-- ── RLS: samma åtkomst som ordern raden hör till ────────────────────────────

alter table order_items enable row level security;

create policy "order_items: admin all" on order_items for all
  using (has_role((select auth.uid()), 'admin'))
  with check (has_role((select auth.uid()), 'admin'));

create policy "order_items: owner read" on order_items for select
  using (exists (select 1 from orders o
                 where o.id = order_items.order_id
                   and o.user_id = (select auth.uid())));

-- ── Triggrar: uppdaterad tid och spårbarhet ─────────────────────────────────

create trigger order_items_updated_at before update on order_items
  for each row execute function set_updated_at();
create trigger audit_order_items after insert or update or delete on order_items
  for each row execute function fn_audit_log();

-- orders saknade audit-trigger. rfqs och shipments har den sedan tidigare.
create trigger audit_orders after insert or update or delete on orders
  for each row execute function fn_audit_log();

commit;

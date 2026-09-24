-- Leverantörsordern: den del som gör systemet till en orderkedja.
--
-- Kundens order och Maskinvals inköpsordrar är INTE samma sak. En kundorder
-- med tre produkter från två leverantörer ska ge EN order till kunden och TVÅ
-- inköpsordrar bakom kulisserna:
--
--   MV-2026-00124  kunden följer den här
--     MPO-2026-00431  till Parker
--     MPO-2026-00432  till SMC
--
-- TVÅ SAKER SOM MODELLEN MÅSTE KLARA, och som är lätta att bygga bort:
--
-- 1. En orderrad kan delas mellan flera inköpsordrar. Fyra cylindrar där
--    leverantören bara kan leverera tre nu och en om sex veckor ska inte tvinga
--    fram en ny kundorderrad. Därför pekar raden på order_items med ett eget
--    antal, utan unik nyckel på order_item_id.
-- 2. Inköpspriset får aldrig nå en kundroll. Båda tabellerna är admin-only,
--    och kunden ser sin order via orders/order_items som förut.
--
-- LEVERANTÖR ≠ TILLVERKARE. supplier_products är den riktiga kopplingen
-- (vem säljer den här produkten till oss, till vilket pris), men den är tom
-- tills avtalen är på plats. Tills dess härleds leverantören ur märket, och
-- raden markeras för granskning när vi inte vet.

begin;

create table if not exists supplier_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text unique,
  order_id uuid not null references orders(id) on delete cascade,
  -- null = vi vet inte vem som ska leverera. Raderna hamnar ändå i en
  -- inköpsorder, för de får inte försvinna tyst; den är markerad för
  -- granskning i stället.
  supplier_id uuid references suppliers(id) on delete restrict,
  status text not null default 'draft',
  -- Kopia av leverantörens integrationsmetod NÄR ordern skapades: byter
  -- leverantören metod i morgon ska en skickad order inte skriva om sin egen
  -- historia.
  integration_method text,
  currency text not null default 'SEK',
  total_purchase_ex_vat numeric,
  expected_delivery date,
  sent_at timestamptz,
  sent_to text,
  sent_method text,
  ack_received_at timestamptz,
  needs_review boolean not null default false,
  review_reason text,
  internal_notes text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table supplier_purchase_orders is
  'Maskinvals inköpsorder till EN leverantör för EN kundorder. Kunden ser den aldrig; inköpspris och leverantörsvillkor är interna.';

create index if not exists spo_order_idx    on supplier_purchase_orders (order_id);
create index if not exists spo_supplier_idx on supplier_purchase_orders (supplier_id);
create index if not exists spo_status_idx   on supplier_purchase_orders (status);

-- EN öppen inköpsorder per leverantör och kundorder. Det är den här raden som
-- gör att ett dubbelklick, en omkörd webhook eller ett nytt försök efter ett
-- avbrott inte kan köpa samma sak två gånger. coalesce: den okända
-- leverantören är också en, annars hade null gett en ny hink varje gång.
create unique index if not exists spo_en_per_leverantor
  on supplier_purchase_orders (order_id, coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status <> 'cancelled';

create table if not exists supplier_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  spo_id uuid not null references supplier_purchase_orders(id) on delete cascade,
  -- INGEN unik nyckel: samma kundorderrad får förekomma i flera
  -- inköpsordrar, med var sitt antal.
  order_item_id uuid references order_items(id) on delete set null,
  line_no int not null,
  -- Det vi beställer: konfiguratorns orderkod eller katalogens sku. Snapshot.
  sku text not null,
  -- Leverantörens eget nummer, när det skiljer sig från vårt.
  supplier_sku text,
  name text not null,
  qty numeric not null,
  unit_purchase_price numeric,
  line_total_ex_vat numeric,
  -- Leverantörens svar (§5). Fylls när bekräftelsen kommer.
  ack_qty numeric,
  ack_unit_price numeric,
  ack_delivery_date date,
  ack_status text,
  ack_note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column supplier_purchase_order_items.unit_purchase_price is
  'INKÖPSPRIS. Får aldrig nå en kundroll -- tabellen är admin-only av det skälet.';

create index if not exists spoi_spo_idx   on supplier_purchase_order_items (spo_id);
create index if not exists spoi_order_idx on supplier_purchase_order_items (order_item_id);

-- ── Numret ────────────────────────────────────────────────────────────────

create or replace function set_supplier_po_number()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.po_number is null then
    new.po_number := next_document_number('MPO');
  end if;
  return new;
end $$;

drop trigger if exists spo_set_po_number on supplier_purchase_orders;
create trigger spo_set_po_number before insert on supplier_purchase_orders
  for each row execute function set_supplier_po_number();

drop trigger if exists spo_updated_at on supplier_purchase_orders;
create trigger spo_updated_at before update on supplier_purchase_orders
  for each row execute function set_updated_at();

drop trigger if exists spoi_updated_at on supplier_purchase_order_items;
create trigger spoi_updated_at before update on supplier_purchase_order_items
  for each row execute function set_updated_at();

drop trigger if exists audit_spo on supplier_purchase_orders;
create trigger audit_spo after insert or update or delete on supplier_purchase_orders
  for each row execute function fn_audit_log();

drop trigger if exists audit_spoi on supplier_purchase_order_items;
create trigger audit_spoi after insert or update or delete on supplier_purchase_order_items
  for each row execute function fn_audit_log();

-- ── Behörighet: bara admin, hela vägen ────────────────────────────────────

alter table supplier_purchase_orders      enable row level security;
alter table supplier_purchase_order_items enable row level security;

drop policy if exists "admins manage supplier pos" on supplier_purchase_orders;
create policy "admins manage supplier pos" on supplier_purchase_orders
  for all using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

drop policy if exists "admins manage supplier po items" on supplier_purchase_order_items;
create policy "admins manage supplier po items" on supplier_purchase_order_items
  for all using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

commit;

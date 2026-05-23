-- ── Projects ──────────────────────────────────────────────────────────────────
-- Sparar maskinbyggar-sessioner per inloggad användare.
-- bom_lines är JSON-snapshot av BOM-rader (sku, qty, role, price etc.)
-- answers är AI-frågorna kunden svarat på
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  locale      text not null default 'sv',
  answers     jsonb not null default '{}',
  bom_lines   jsonb not null default '[]',
  bom_id      uuid references public.boms(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.projects enable row level security;

-- Användare ser bara sina egna projekt
create policy "projects: owner read"
  on public.projects for select
  to authenticated
  using (auth.uid() = user_id);

create policy "projects: owner insert"
  on public.projects for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "projects: owner update"
  on public.projects for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects: owner delete"
  on public.projects for delete
  to authenticated
  using (auth.uid() = user_id);

-- Admin kan se alla projekt
create policy "projects: admin all"
  on public.projects for all
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Auto-uppdatera updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ── Orders ────────────────────────────────────────────────────────────────────
-- Orderhantering: kopplar RFQ → bekräftad order → leverans → faktura → betalning
-- Designad för framtida Peppol/Ariba-integration via peppol_id / po_number
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete restrict,
  project_id          uuid references public.projects(id) on delete set null,
  rfq_id              uuid references public.rfqs(id) on delete set null,

  -- Kundinfo (denormaliserat för historik — kunden kan byta profil)
  customer_name       text not null,
  customer_company    text,
  customer_email      text not null,
  customer_org_nr     text,

  -- Inköpsorder från kund
  po_number           text,                    -- Kundens PO-nummer (krävs av SAP-företag)
  peppol_id           text,                    -- Framtida Peppol-ID, t.ex. "0007:5566123456"

  -- Orderstatus
  status              text not null default 'new'
                      check (status in ('new','confirmed','picking','shipped','delivered','invoiced','paid','cancelled')),

  -- Artiklar (JSON-snapshot — priserna ska vara låsta vid order)
  items               jsonb not null default '[]',
  -- Format: [{ sku, name, qty, unit_price_ex_vat, total_price_ex_vat, brand }]

  -- Summor
  total_ex_vat        numeric(12,2),
  vat_rate            numeric(5,4) not null default 0.25,  -- 25% moms
  total_inc_vat       numeric(12,2),
  currency            text not null default 'SEK',

  -- Leverans
  estimated_delivery  date,
  shipped_at          timestamptz,
  delivered_at        timestamptz,
  tracking_number     text,
  carrier             text,

  -- Faktura
  invoice_number      text,
  invoice_url         text,                   -- Länk till PDF (Supabase Storage eller Fortnox)
  invoice_date        date,
  invoice_due_date    date,
  fortnox_invoice_id  text,                   -- Synk med Fortnox

  -- Betalning
  payment_status      text not null default 'unpaid'
                      check (payment_status in ('unpaid','paid','overdue','refunded')),
  paid_at             timestamptz,

  -- Interna anteckningar (syns bara för admin)
  internal_notes      text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Kund ser sina egna ordrar
create policy "orders: owner read"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);

-- Admin full access
create policy "orders: admin all"
  on public.orders for all
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Index för vanliga queries
create index if not exists orders_user_id_idx    on public.orders(user_id);
create index if not exists orders_status_idx     on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists projects_user_id_idx  on public.projects(user_id);

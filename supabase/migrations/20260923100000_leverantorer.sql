-- Leverantörer: grunden för Order Engine.
--
-- VARFÖR EN EGEN TABELL OCH INTE brands. brands är de åtta TILLVERKARNA
-- (Festo, SMC, Parker …). En leverantör är den vi lägger inköpsordern hos, och
-- det är inte samma sak: samma tillverkares artikel kan köpas direkt eller via
-- distributör, en distributör för flera varumärken, och avtal, kundnummer,
-- betalningsvillkor och integrationsväg hör till LEVERANTÖREN. Att låta brands
-- spela båda rollerna hade gjort en inköpsorder omöjlig att adressera.
--
-- TRE TABELLER
--
--   suppliers              vem vi köper av, och på vilka villkor
--   supplier_integrations  hur ordern tekniskt tar sig dit (en rad per kanal)
--   supplier_products      leverantörens artikelnummer och VÅRT inköpspris
--
-- Kolumnerna i suppliers/supplier_integrations svarar mot de tolv frågor som
-- måste ställas till varje leverantör (återförsäljaravtal, kundnummer och
-- prislista, direktleverans, integrationsväg, orderformat och beställnings-
-- adress, lager och leveranstid, tracking och orderbekräftelse, retur och
-- garanti, fraktvillkor, betalningsvillkor, regler för produktdata och
-- varumärke). Svaren ska kunna skrivas rakt in -- tabellen ÄR insamlings-
-- formuläret, inte en tolkning av det.
--
-- INGA HEMLIGHETER I DATABASEN. supplier_integrations.auth_secret_name pekar
-- ut NAMNET på en Supabase-secret; nyckeln själv ligger kvar där. Tabellen
-- läses av admin i webbläsaren.
--
-- Den här migrationen rör inget befintligt flöde: tre nya tabeller, inga
-- ändringar i products, orders eller rfqs.

begin;

-- ── suppliers ───────────────────────────────────────────────────────────────

create table if not exists suppliers (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  legal_name        text,
  org_number        text,
  country           text not null default 'SE',
  currency          text not null default 'SEK',
  is_active         boolean not null default false,

  -- fråga 1: återförsäljaravtal och rätt att sälja
  agreement_status  text not null default 'unknown'
                    check (agreement_status in ('unknown','requested','negotiating','signed','declined')),
  agreement_signed_at date,
  agreement_notes   text,

  -- fråga 2: kundnummer och prislista
  customer_number   text,
  price_list_ref    text,
  discount_notes    text,

  -- fråga 3: direktleverans till slutkund
  allows_dropship   boolean,
  dropship_notes    text,

  -- fråga 5: beställningsadress
  order_email       text,
  order_portal_url  text,

  -- fråga 6: lager och leveranstid
  stock_data_method text check (stock_data_method in ('realtime_api','daily_file','portal','none','unknown')),
  default_lead_time_days integer,

  -- fråga 9 och 10: frakt- och betalningsvillkor
  incoterms         text,
  min_order_value   numeric,
  free_freight_over numeric,
  freight_notes     text,
  payment_terms     text,

  -- fråga 8: retur och garanti
  returns_process   text,
  warranty_terms    text,

  -- fråga 11: produktdata och varumärke
  product_data_rights text,

  -- fråga 12: pågående systembyte hos leverantören
  system_notes      text,

  contact_name      text,
  contact_email     text,
  contact_phone     text,
  internal_notes    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table suppliers is
  'Vem Maskinval köper av. Skild från brands, som är tillverkare. Kolumnerna motsvarar insamlingsformuläret per leverantör.';
comment on column suppliers.is_active is
  'Falskt tills återförsäljaravtal och villkor är på plats. Order Engine får inte lägga en inköpsorder hos en inaktiv leverantör.';

-- ── supplier_integrations ───────────────────────────────────────────────────

create table if not exists supplier_integrations (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid not null references suppliers(id) on delete cascade,

  -- fråga 4: API, EDI, PunchOut/OCI, SFTP -- eller inget av dem
  method         text not null
                 check (method in ('email_pdf','api','edi','sftp','punchout_oci','portal','manual')),
  -- Ingen integration är "klar" förrän någon verifierat den mot leverantören.
  status         text not null default 'simulerad'
                 check (status in ('verifierad','vantar_pa_avtal','manuell','simulerad','avstangd')),
  is_primary     boolean not null default false,

  -- fråga 5: orderformat
  order_format   text check (order_format in ('pdf_email','json','xml','edifact','csv','manual')),
  endpoint_url   text,
  -- NAMNET på Supabase-secreten, aldrig nyckeln själv.
  auth_secret_name text,
  config         jsonb not null default '{}'::jsonb,

  -- fråga 7: hur bekräftelse och tracking kommer tillbaka
  ack_method      text check (ack_method in ('email','api','portal','none')),
  tracking_method text check (tracking_method in ('email','api','portal','carrier','none')),

  -- Tröskelvärden för grön/gul/röd i avvikelsekontrollen. Röd = stopp och
  -- mänskligt godkännande; allt annat får uppdateras automatiskt.
  price_tolerance_pct numeric not null default 0,
  delay_tolerance_days integer not null default 0,

  last_verified_at timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists supplier_integrations_primary_uniq
  on supplier_integrations (supplier_id) where is_primary;

comment on column supplier_integrations.auth_secret_name is
  'Namnet på Supabase-secreten, aldrig nyckeln. Tabellen läses av admin i webbläsaren.';

-- ── supplier_products ───────────────────────────────────────────────────────

create table if not exists supplier_products (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid not null references suppliers(id) on delete cascade,
  -- Nullbar med flit: en leverantör kan föra artiklar vi inte har i katalogen.
  product_id     uuid references products(id) on delete set null,
  supplier_sku   text not null,
  supplier_name  text,

  purchase_price numeric,
  currency       text not null default 'SEK',
  price_valid_from date,
  price_valid_to   date,
  price_source   text check (price_source in ('price_list','quote','manual','api','unknown')),

  lead_time_days integer,
  moq            integer,
  pack_size      integer,

  -- Vilken leverantör som ska väljas när samma artikel finns hos flera.
  is_preferred   boolean not null default false,
  last_verified_at timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (supplier_id, supplier_sku)
);

create index if not exists supplier_products_product_idx on supplier_products (product_id);
create unique index if not exists supplier_products_preferred_uniq
  on supplier_products (product_id) where is_preferred and product_id is not null;

comment on table supplier_products is
  'Leverantörens artikelnummer och vårt inköpspris. products.purchase_price är tom för samtliga artiklar -- utan de här raderna kan varken marginal eller en prissatt inköpsorder räknas fram.';

-- ── RLS: bara admin, aldrig kund ────────────────────────────────────────────
--
-- Inköpspris och marginal får inte nå en kundroll. Samma mönster som
-- products-policyerna, men UTAN någon publik läsväg.

alter table suppliers            enable row level security;
alter table supplier_integrations enable row level security;
alter table supplier_products     enable row level security;

create policy "admin all suppliers" on suppliers for all
  using (has_role((select auth.uid()), 'admin'))
  with check (has_role((select auth.uid()), 'admin'));

create policy "admin all supplier_integrations" on supplier_integrations for all
  using (has_role((select auth.uid()), 'admin'))
  with check (has_role((select auth.uid()), 'admin'));

create policy "admin all supplier_products" on supplier_products for all
  using (has_role((select auth.uid()), 'admin'))
  with check (has_role((select auth.uid()), 'admin'));

-- ── Arbetslista: en utkastrad per tillverkare vi redan för ───────────────────
--
-- Namnen hämtas ur brands, inte handskrivna. Raderna är INAKTIVA och har
-- agreement_status 'unknown' -- de är en checklista över vilka leverantörer
-- uppgifterna ska samlas in för, inte ett påstående om att avtal finns.

insert into suppliers (slug, name, is_active, agreement_status, internal_notes)
select b.slug, b.name, false, 'unknown',
       'Utkast skapat 2026-09-23 ur brands. Tillverkare vi för i katalogen; '
       || 'om vi köper via distributör ska den läggas som EGEN leverantör och '
       || 'den här raden avaktiveras.'
from brands b
on conflict (slug) do nothing;

-- Tills något annat är verifierat är e-post med PDF den enda väg som fungerar
-- utan avtal. Varje leverantör får därför en sådan kanal, markerad manuell.
insert into supplier_integrations (supplier_id, method, status, is_primary, order_format, ack_method, tracking_method)
select s.id, 'email_pdf', 'manuell', true, 'pdf_email', 'email', 'email'
from suppliers s
where not exists (select 1 from supplier_integrations i where i.supplier_id = s.id);

commit;

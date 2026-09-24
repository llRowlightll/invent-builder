-- Konfiguratorns orderkod följer med hela vägen till ordern.
--
-- BAKGRUND: "Lägg till i BOM" i familjekonfiguratorn körde
-- `onClick={() => setAddedToBom(true)}`. Knappen bytte text till
-- "✓ Tillagd i BOM" och skrev ingenting, någonstans. Den var en lögn.
--
-- Att bara koppla knappen till inköpslistan hade bytt en lögn mot en tystare:
-- listan -> offerten -> ordern bär `product_id`, och katalogen har bara
-- SERIEN ("FESTO-DSNU"). Den konfigurerade koden "DSNU-32-100-PPS-A" -- alltså
-- det kunden faktiskt ska beställa och det vi ska beställa hos leverantören --
-- hade tappats i första steget, och offerten hade visat serien.
--
-- Därför bär rfq_items koden själv. Två kolumner, båda nullbara:
--
--   order_code  det som ska beställas, när det inte är en katalogpost
--   item_name   radens namn för de 15 av 169 familjer som saknar katalogpost
--               helt (CY1L, OSP-E..STR, Parker FRL ...). Utan det står det
--               "—" som produktnamn i offerten.
--
-- product_id blir kvar när det finns: konfigurerade rader ska fortfarande gå
-- att knyta till serien (märke, leveranstid, dokument). Det är bara inte
-- längre radens identitet.

begin;

alter table public.rfq_items add column if not exists order_code text;
alter table public.rfq_items add column if not exists item_name  text;

comment on column public.rfq_items.order_code is
  'Konfiguratorns färdiga beställningskod. Null för en vanlig katalograd, där products.sku gäller.';
comment on column public.rfq_items.item_name is
  'Radens namn när familjen saknar katalogpost. Null annars -- då gäller products.name.';

-- ── submit_rfq: bär koden, och släpper igenom rader utan katalogpost ────────
--
-- Den gamla raden `where item->>'product_id' is not null` var rätt så länge en
-- rad ALLTID var en katalogprodukt: den filtrerade bort skräp. Nu finns en
-- andra sorts giltig rad, så villkoret blir "har antingen produkt eller kod".

create or replace function public.submit_rfq(
  p_title text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_company text,
  p_org_number text,
  p_po_number text,
  p_message text,
  p_items jsonb,
  p_hp text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq_id uuid;
begin
  -- Honeypot: a hidden field real users never see or fill. Bots that fill
  -- every input on the form will fill this too.
  if p_hp is not null and p_hp <> '' then
    raise exception 'invalid submission';
  end if;

  if p_contact_name is null or btrim(p_contact_name) = '' then
    raise exception 'contact name is required';
  end if;
  if p_contact_email is null or btrim(p_contact_email) = '' then
    raise exception 'contact email is required';
  end if;

  insert into public.rfqs (
    user_id, status, title, contact_name, contact_email, contact_phone,
    company, org_number, po_number, message
  ) values (
    auth.uid(), 'new', p_title, btrim(p_contact_name), btrim(p_contact_email),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_company, '')), ''),
    nullif(btrim(coalesce(p_org_number, '')), ''),
    nullif(btrim(coalesce(p_po_number, '')), ''),
    nullif(btrim(coalesce(p_message, '')), '')
  )
  returning id into v_rfq_id;

  insert into public.rfq_items (rfq_id, product_id, qty, role, order_code, item_name)
  select v_rfq_id,
         nullif(item->>'product_id','')::uuid,
         coalesce((item->>'qty')::int, 1),
         coalesce(item->>'role', 'ordered'),
         nullif(btrim(coalesce(item->>'order_code','')), ''),
         nullif(btrim(coalesce(item->>'item_name','')), '')
  from jsonb_array_elements(p_items) as item
  where nullif(item->>'product_id','') is not null
     or nullif(btrim(coalesce(item->>'order_code','')), '') is not null;

  return v_rfq_id;
end;
$$;

grant execute on function public.submit_rfq(text,text,text,text,text,text,text,text,jsonb,text) to anon, authenticated;

-- ── get_quote_items: kunden ser koden i SKU-kolumnen ───────────────────────
--
-- Returtypen är oförändrad med flit: sku/name är redan "det som står på
-- raden", och för en konfigurerad rad ÄR orderkoden dess sku. Hade koden fått
-- en egen kolumn hade varje läsare behövt lära sig välja mellan dem.

create or replace function public.get_quote_items(p_rfq_id uuid)
returns table(id uuid, qty integer, unit_price numeric, note text, sku text, name text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select ri.id, ri.qty, ri.unit_price, ri.note,
         coalesce(nullif(ri.order_code, ''), p.sku),
         coalesce(nullif(ri.item_name, ''), p.name)
  from public.rfq_items ri
  left join public.products p on p.id = ri.product_id
  where ri.rfq_id = p_rfq_id;
$$;

-- ── respond_to_quote: orderraden bär koden, inte serien ────────────────────
--
-- order_items.sku är snapshoten av "det som beställdes". För en konfigurerad
-- rad är det orderkoden -- det är den som ska stå på leverantörens inköpsorder.
-- product_id pekar fortfarande på serien, så raden går att knyta till
-- katalogen.

create or replace function public.respond_to_quote(p_id uuid, p_decision text, p_po text default null)
returns table(success boolean, order_id uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_updated int;
  v_rfq public.rfqs;
  v_order_id uuid;
  v_items jsonb;
  v_total_ex numeric;
begin
  if p_decision not in ('accepted','rejected') then
    raise exception 'invalid decision: %', p_decision;
  end if;

  update public.rfqs
     set status = p_decision,
         po_number = coalesce(nullif(btrim(p_po), ''), po_number)
   where id = p_id and status = 'quoted'
   returning * into v_rfq;
  get diagnostics v_updated = row_count;

  if v_updated > 0 and p_decision = 'accepted' then
    -- Radpriset efter offertens rabatt: exakt det kunden såg och accepterade.
    select
      jsonb_agg(jsonb_build_object(
        'product_id', ri.product_id,
        'sku', coalesce(nullif(ri.order_code, ''), p.sku, '—'),
        'name', coalesce(nullif(ri.item_name, ''), p.name, 'Okänd produkt'),
        'qty', ri.qty,
        'unit_price_ex_vat', round(coalesce(ri.unit_price, 0) * (1 - v_rfq.discount_pct / 100), 2),
        'total_price_ex_vat', round(ri.qty * coalesce(ri.unit_price, 0) * (1 - v_rfq.discount_pct / 100), 2),
        'brand', b.name,
        'lead_time_days', p.lead_time_days,
        'note', ri.note
      ) order by ri.id),
      coalesce(sum(ri.qty * coalesce(ri.unit_price, 0) * (1 - v_rfq.discount_pct / 100)), 0)
    into v_items, v_total_ex
    from public.rfq_items ri
    left join public.products p on p.id = ri.product_id
    left join public.brands b on b.id = p.brand_id
    where ri.rfq_id = p_id;

    if v_items is not null and jsonb_array_length(v_items) > 0 then
      v_order_id := create_order_internal(
        jsonb_build_object(
          'user_id',          v_rfq.user_id,
          'rfq_id',           v_rfq.id,
          'customer_name',    coalesce(v_rfq.contact_name, v_rfq.company, 'Okänd kund'),
          'customer_company', v_rfq.company,
          'customer_email',   coalesce(v_rfq.contact_email, ''),
          'customer_org_nr',  v_rfq.org_number,
          'po_number',        v_rfq.po_number,
          'status',           'new',
          'currency',         coalesce(v_rfq.quote_currency, 'SEK'),
          'vat_rate',         0.25,
          'total_ex_vat',     round(v_total_ex, 2),
          'total_inc_vat',    round(v_total_ex * 1.25, 2),
          'idempotency_key',  'rfq:' || v_rfq.id::text
        ),
        v_items);
    end if;
  end if;

  return query select (v_updated > 0), v_order_id;
end $$;

commit;

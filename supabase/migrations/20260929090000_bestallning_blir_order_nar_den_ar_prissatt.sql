-- Beställningen blir en order när varje rad har ett pris — och ordern ärver
-- kundens leveransuppgifter.
--
-- Två saker fixas här.
--
-- 1. create_order_with_items fyllde aldrig orderns leveransfält. Kolumnerna
--    finns (delivery_name, delivery_street, desired_delivery_date,
--    delivery_mode, customer_reference, fakturaadressen ...) och fylls på
--    rfqs vid utcheckningen, men konverteringen tappade dem tyst. Den som
--    konverterade en beställning i admin fick alltså en order utan
--    leveransadress. En trigger på orders kopierar dem nu ur rfq:n, så det
--    gäller BÅDA vägarna och ingen kan glömma att anropa den.
--
-- 2. Knappen "Skicka beställning" skapade aldrig en order. Den skapar en
--    rfq med intent='order', och en människa fick prissätta och klicka
--    "Skapa order". Nu skapas ordern av sig själv så snart varje rad har ett
--    pris. I dag har noll av 887 produkter ett inköpspris och
--    supplier_products är tom, så grinden står stängd — den öppnas den dag
--    priserna finns, utan att någon behöver komma ihåg det här.
--
-- Varför en DEFERRED constraint trigger och inte en vanlig AFTER INSERT:
-- submit_rfq skapar rfqs-raden FÖRST och rfq_items efteråt. En vanlig
-- AFTER INSERT på rfqs ser därför noll rader och skulle alltid tacka nej.
-- Den deferrade fyrar vid commit, när raderna finns.

begin;

-- ── 1. Ordern ärver kundens köpfält ─────────────────────────────────────────
create or replace function trg_order_arver_kopfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.rfq_id is null then
    return new;
  end if;

  update orders o
     set delivery_name         = coalesce(o.delivery_name,         r.delivery_name),
         delivery_street       = coalesce(o.delivery_street,       r.address_street),
         delivery_postal       = coalesce(o.delivery_postal,       r.address_postal),
         delivery_city         = coalesce(o.delivery_city,         r.address_city),
         delivery_country      = coalesce(o.delivery_country,      r.address_country),
         invoice_street        = coalesce(o.invoice_street,        r.invoice_street),
         invoice_postal        = coalesce(o.invoice_postal,        r.invoice_postal),
         invoice_city          = coalesce(o.invoice_city,          r.invoice_city),
         invoice_country       = coalesce(o.invoice_country,       r.invoice_country),
         invoice_email         = coalesce(o.invoice_email,         r.invoice_email),
         desired_delivery_date = coalesce(o.desired_delivery_date, r.desired_delivery_date),
         delivery_instructions = coalesce(o.delivery_instructions, r.delivery_instructions),
         delivery_mode         = coalesce(o.delivery_mode,         r.delivery_mode),
         customer_reference    = coalesce(o.customer_reference,    r.customer_reference)
    from rfqs r
   where o.id = new.id
     and r.id = new.rfq_id;

  return new;
end $$;

revoke all on function trg_order_arver_kopfalt() from public, anon, authenticated;

drop trigger if exists order_arver_kopfalt on orders;
create trigger order_arver_kopfalt
  after insert on orders
  for each row
  execute function trg_order_arver_kopfalt();

-- ── 2. Prissatt beställning blir order ──────────────────────────────────────
create or replace function skapa_order_av_prissatt_bestallning(p_rfq_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rfq        rfqs%rowtype;
  v_rader      int;
  v_oprissatta int;
  v_exkl       numeric;
  v_items      jsonb;
  v_order      uuid;
begin
  select * into v_rfq from rfqs where id = p_rfq_id;
  if not found then return null; end if;

  -- Bara beställningar. En offertförfrågan ska aldrig bli en order av sig
  -- själv — det är hela skillnaden mellan de två knapparna.
  if v_rfq.intent is distinct from 'order' then return null; end if;

  -- Anonym beställning får en människa ta. create_order_with_items kräver
  -- ändå en inloggad användare, och en order utan konto går inte att följa.
  if v_rfq.user_id is null then return null; end if;

  select count(*),
         count(*) filter (where unit_price is null or unit_price <= 0)
    into v_rader, v_oprissatta
    from rfq_items where rfq_id = p_rfq_id;

  -- Grinden. Saknas ett enda pris blir det ingen order, för en order med en
  -- nollrad ljuger om sitt belopp.
  if v_rader = 0 or v_oprissatta > 0 then return null; end if;

  select coalesce(sum(i.unit_price * i.qty), 0),
         jsonb_agg(jsonb_build_object(
           'product_id',         i.product_id,
           'sku',                coalesce(i.order_code, p.sku, '—'),
           'name',               coalesce(i.item_name, p.name, 'Okänd produkt'),
           'qty',                i.qty,
           'unit_price_ex_vat',  i.unit_price,
           'total_price_ex_vat', i.unit_price * i.qty,
           'lead_time_days',     p.lead_time_days
         ) order by i.sort_order nulls last, i.id)
    into v_exkl, v_items
    from rfq_items i
    left join products p on p.id = i.product_id
   where i.rfq_id = p_rfq_id;

  -- Samma idempotensnyckel som admin-knappen använder, så en beställning ger
  -- EN order oavsett vilken väg som råkar hinna först.
  v_order := create_order_with_items(
    jsonb_build_object(
      'idempotency_key',  'rfq:' || p_rfq_id::text,
      'rfq_id',           p_rfq_id::text,
      'user_id',          v_rfq.user_id::text,
      'customer_name',    coalesce(v_rfq.contact_name, ''),
      'customer_company', v_rfq.company,
      'customer_email',   coalesce(v_rfq.contact_email, ''),
      'customer_org_nr',  v_rfq.org_number,
      'po_number',        v_rfq.po_number,
      'currency',         coalesce(v_rfq.quote_currency, 'SEK'),
      'vat_rate',         0.25,
      'total_ex_vat',     v_exkl,
      'total_inc_vat',    round(v_exkl * 1.25, 2),
      'internal_notes',   'Skapad automatiskt: varje rad var prissatt vid beställningen.'
    ),
    v_items
  );

  update rfqs set status = 'accepted' where id = p_rfq_id and status = 'new';
  return v_order;
end $$;

revoke all on function skapa_order_av_prissatt_bestallning(uuid) from public, anon;
grant execute on function skapa_order_av_prissatt_bestallning(uuid) to authenticated;

-- ── 3. Grinden prövas vid commit, när raderna finns ─────────────────────────
create or replace function trg_bestallning_blir_order()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.intent is distinct from 'order' then
    return null;
  end if;

  -- En misslyckad konvertering får ALDRIG rulla tillbaka kundens förfrågan.
  -- Förfrågan är det som räknas; ordern är en bekvämlighet ovanpå den.
  begin
    perform skapa_order_av_prissatt_bestallning(new.id);
  exception when others then
    raise warning 'automatisk order för rfq % gick inte: %', new.id, sqlerrm;
  end;

  return null;
end $$;

revoke all on function trg_bestallning_blir_order() from public, anon, authenticated;

drop trigger if exists bestallning_blir_order on rfqs;
create constraint trigger bestallning_blir_order
  after insert on rfqs
  deferrable initially deferred
  for each row
  execute function trg_bestallning_blir_order();

commit;

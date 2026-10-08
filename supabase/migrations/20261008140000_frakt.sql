-- Frakt (allmänna villkor 1.3, avsnitt 3: frakt tillkommer och anges i
-- offerten eller orderbekräftelsen). Beslut 2026-10-08: vi tar betalt för frakt.
--
-- Frakten är ett eget belopp på offerten och ordern, inte en artikelrad: en
-- rad utan produkt hade grupperats till en inköpsorder hos "Okänd leverantör"
-- (create_supplier_pos) och aldrig fått en försändelse, så ordern hade aldrig
-- blivit levererad (uppdatera_orderleverans). Introrabatten gäller varorna,
-- inte frakten. Moms 25 % på frakten som på varorna.
alter table public.rfqs   add column if not exists freight_ex_vat numeric;
alter table public.orders add column if not exists freight_ex_vat numeric;

-- ── create_order_internal: sparar frakten ────────────────────────────────────
create or replace function public.create_order_internal(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_key text := nullif(p_order->>'idempotency_key','');
  v_id  uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ordern måste ha minst en rad';
  end if;

  if v_key is not null then
    select id into v_id from orders where idempotency_key = v_key;
    if found then return v_id; end if;
  end if;

  begin
    insert into orders (user_id, rfq_id, project_id, customer_name, customer_company,
                        customer_email, customer_org_nr, po_number, status, payment_status,
                        currency, vat_rate, total_ex_vat, total_inc_vat, freight_ex_vat, items,
                        internal_notes, idempotency_key,
                        -- Fryst kopia av vart och hur. Se 20260925140000.
                        delivery_name, delivery_street, delivery_postal, delivery_city, delivery_country,
                        invoice_street, invoice_postal, invoice_city, invoice_country, invoice_email,
                        contact_phone, desired_delivery_date, delivery_instructions,
                        delivery_mode, customer_reference)
    values (nullif(p_order->>'user_id','')::uuid,
            nullif(p_order->>'rfq_id','')::uuid,
            nullif(p_order->>'project_id','')::uuid,
            coalesce(p_order->>'customer_name',''),
            p_order->>'customer_company',
            coalesce(p_order->>'customer_email',''),
            p_order->>'customer_org_nr',
            p_order->>'po_number',
            coalesce(p_order->>'status','new'),
            coalesce(p_order->>'payment_status','unpaid'),
            coalesce(p_order->>'currency','SEK'),
            coalesce((p_order->>'vat_rate')::numeric, 0.25),
            (p_order->>'total_ex_vat')::numeric,
            (p_order->>'total_inc_vat')::numeric,
            nullif(p_order->>'freight_ex_vat','')::numeric,
            '[]'::jsonb,
            p_order->>'internal_notes',
            v_key,
            p_order->>'delivery_name',
            p_order->>'delivery_street',
            p_order->>'delivery_postal',
            p_order->>'delivery_city',
            p_order->>'delivery_country',
            p_order->>'invoice_street',
            p_order->>'invoice_postal',
            p_order->>'invoice_city',
            p_order->>'invoice_country',
            p_order->>'invoice_email',
            p_order->>'contact_phone',
            nullif(p_order->>'desired_delivery_date','')::date,
            p_order->>'delivery_instructions',
            nullif(p_order->>'delivery_mode',''),
            p_order->>'customer_reference')
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from orders where idempotency_key = v_key;
    if v_id is null then raise; end if;
    return v_id;
  end;

  insert into order_items (order_id, line_no, product_id, sku, name, brand, qty,
                           unit_price_ex_vat, line_total_ex_vat, vat_rate, currency,
                           lead_time_days, note)
  select v_id,
         (row_number() over (order by ordinality))::int,
         nullif(e.value->>'product_id','')::uuid,
         coalesce(e.value->>'sku','—'),
         coalesce(e.value->>'name','Okänd produkt'),
         nullif(e.value->>'brand',''),
         coalesce((e.value->>'qty')::numeric, 1),
         (e.value->>'unit_price_ex_vat')::numeric,
         coalesce((e.value->>'total_price_ex_vat')::numeric,
                  (e.value->>'unit_price_ex_vat')::numeric * coalesce((e.value->>'qty')::numeric,1)),
         coalesce((p_order->>'vat_rate')::numeric, 0.25),
         coalesce(p_order->>'currency','SEK'),
         nullif(e.value->>'lead_time_days','')::int,
         nullif(e.value->>'note','')
  from jsonb_array_elements(p_items) with ordinality as e(value, ordinality);

  return v_id;
end $function$;

-- ── respond_to_quote: rabatten på varorna, frakten läggs till ───────────────
create or replace function public.respond_to_quote(p_id uuid, p_decision text, p_po text default null::text)
returns table(success boolean, order_id uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_updated int;
  v_rfq public.rfqs;
  v_order_id uuid;
  v_items jsonb;
  v_total_ex numeric;
  v_frakt numeric;
  v_intent text;
begin
  if p_decision not in ('accepted','rejected') then
    raise exception 'invalid decision: %', p_decision;
  end if;

  select r.intent into v_intent from public.rfqs r where r.id = p_id;
  if v_intent = 'order' then
    raise exception 'det här är en beställning, inte en offert -- den behöver ingen accept';
  end if;

  update public.rfqs
     set status = p_decision,
         po_number = coalesce(nullif(btrim(p_po), ''), po_number)
   where id = p_id and status = 'quoted'
   returning * into v_rfq;
  get diagnostics v_updated = row_count;

  if v_updated > 0 and p_decision = 'accepted' then
    v_frakt := round(coalesce(v_rfq.freight_ex_vat, 0), 2);

    select
      jsonb_agg(jsonb_build_object(
        'product_id', ri.product_id,
        'sku', coalesce(nullif(ri.order_code, ''), p.sku, '—'),
        'name', coalesce(nullif(ri.item_name, ''), p.name, 'Okänd produkt'),
        'qty', ri.qty,
        'unit_price_ex_vat', round(coalesce(ri.unit_price, 0) * (1 - coalesce(v_rfq.discount_pct, 0) / 100), 2),
        'total_price_ex_vat', round(ri.qty * coalesce(ri.unit_price, 0) * (1 - coalesce(v_rfq.discount_pct, 0) / 100), 2),
        'brand', b.name,
        'lead_time_days', p.lead_time_days,
        'note', ri.note
      ) order by ri.sort_order nulls last, ri.id),
      coalesce(sum(ri.qty * coalesce(ri.unit_price, 0) * (1 - coalesce(v_rfq.discount_pct, 0) / 100)), 0)
    into v_items, v_total_ex
    from public.rfq_items ri
    left join public.products p on p.id = ri.product_id
    left join public.brands b on b.id = p.brand_id
    where ri.rfq_id = p_id;

    v_total_ex := v_total_ex + v_frakt;

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
          'freight_ex_vat',   case when v_frakt > 0 then v_frakt end,
          'idempotency_key',  'rfq:' || v_rfq.id::text,
          -- Checkoutens fält följer med. Utan det här stannade de på
          -- förfrågan och ordern visste inte vart den skulle.
          'delivery_name',    v_rfq.delivery_name,
          'delivery_street',  v_rfq.address_street,
          'delivery_postal',  v_rfq.address_postal,
          'delivery_city',    v_rfq.address_city,
          'delivery_country', v_rfq.address_country,
          'invoice_street',   v_rfq.invoice_street,
          'invoice_postal',   v_rfq.invoice_postal,
          'invoice_city',     v_rfq.invoice_city,
          'invoice_country',  v_rfq.invoice_country,
          'invoice_email',    v_rfq.invoice_email,
          'contact_phone',    v_rfq.contact_phone,
          'desired_delivery_date', v_rfq.desired_delivery_date,
          'delivery_instructions', v_rfq.delivery_instructions,
          'delivery_mode',    v_rfq.delivery_mode,
          'customer_reference', v_rfq.customer_reference
        ),
        v_items);
    end if;
  end if;

  return query select (v_updated > 0), v_order_id;
end $function$;

-- ── skapa_order_av_prissatt_bestallning: ingen automatisk order utan frakt ──
-- En direktbeställning blev order av sig själv när varje rad hade pris. Utan
-- frakt hade den ordern aldrig fått någon. Frakten sätts i offertverktyget;
-- tills dess skapar Maskinval ordern ("Skapa order" i admin).
create or replace function public.skapa_order_av_prissatt_bestallning(p_rfq_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  if v_rfq.intent is distinct from 'order' then return null; end if;
  if v_rfq.user_id is null then return null; end if;
  if coalesce(v_rfq.freight_ex_vat, 0) <= 0 then return null; end if;

  select count(*),
         count(*) filter (where unit_price is null or unit_price <= 0)
    into v_rader, v_oprissatta
    from rfq_items where rfq_id = p_rfq_id;

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

  v_exkl := v_exkl + v_rfq.freight_ex_vat;

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
      'freight_ex_vat',   v_rfq.freight_ex_vat,
      'internal_notes',   'Skapad automatiskt: varje rad var prissatt vid beställningen.'
    ),
    v_items
  );

  update rfqs set status = 'accepted' where id = p_rfq_id and status = 'new';
  return v_order;
end $function$;

-- ── Publika vyer: offert och orderbekräftelse visar frakten ──────────────────
drop function if exists public.get_quote_by_id(uuid);
create function public.get_quote_by_id(p_id uuid)
returns table (
  id uuid, contact_name text, contact_email text, company text, org_number text,
  po_number text, status text, quote_amount numeric, quote_currency text,
  discount_pct numeric, created_at timestamptz, quoted_at timestamptz, freight_ex_vat numeric
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select r.id, r.contact_name, r.contact_email, r.company, r.org_number,
         r.po_number, r.status, r.quote_amount, r.quote_currency,
         r.discount_pct, r.created_at, r.quoted_at, r.freight_ex_vat
  from public.rfqs r
  where r.id = p_id;
$$;
grant execute on function public.get_quote_by_id(uuid) to anon, authenticated;

drop function if exists public.get_order_by_id(uuid);
create function public.get_order_by_id(p_id uuid)
returns table (
  id uuid, customer_name text, customer_company text, customer_email text,
  customer_org_nr text, po_number text, status text, items jsonb,
  total_ex_vat numeric, total_inc_vat numeric, currency text,
  estimated_delivery date, created_at timestamptz, freight_ex_vat numeric
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select o.id, o.customer_name, o.customer_company, o.customer_email,
         o.customer_org_nr, o.po_number, o.status, o.items, o.total_ex_vat,
         o.total_inc_vat, o.currency, o.estimated_delivery, o.created_at, o.freight_ex_vat
  from public.orders o
  where o.id = p_id;
$$;
grant execute on function public.get_order_by_id(uuid) to anon, authenticated;

-- Kundens egen order skapade inga orderrader.
--
-- respond_to_quote() -- den funktion som körs när kunden trycker "Ja,
-- acceptera offert" på /offert/:id -- skrev orders.items som en jsonb-array
-- och skapade INGA order_items. Sedan raderna blev sanningen betyder det att
-- en order lagd av kunden själv är osynlig för hela Order Engine: den kan
-- varken grupperas till inköpsordrar, levereras radvis eller få radstatus.
-- Den vägen är dessutom den VANLIGA -- admin.rfq.tsx är undantaget.
--
-- Felet är mitt: jag gjorde order_items till sanningen utan att flytta över
-- kundens väg samtidigt.
--
-- DESSUTOM: två ordrar för samma offert. Accepterar kunden OCH klickar en
-- administratör "skapa order" fick samma RFQ två ordrar, med olika nummer och
-- olika rader. Båda vägarna använder nu idempotensnyckeln 'rfq:<id>', så den
-- andra returnerar den första i stället för att skapa en till.
--
-- LÖSNINGEN ÄR EN GEMENSAM INTERN FUNKTION, inte kopierad logik. Skillnaden
-- mellan vägarna är BEHÖRIGHETEN, inte skrivandet:
--
--   create_order_with_items  kräver inloggning, admin får skapa åt andra
--   respond_to_quote         anropas av ANON via en ogissbar offertlänk, och
--                            behörigheten är att offerten står i 'quoted'
--
-- Därför gör den interna funktionen ingen behörighetskontroll alls och är
-- inte åtkomlig för någon roll: den anropas bara av de två ovan, som var för
-- sig avgjort att anroparen får göra det.

begin;

create or replace function create_order_internal(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
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
                        currency, vat_rate, total_ex_vat, total_inc_vat, items,
                        internal_notes, idempotency_key)
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
            '[]'::jsonb,
            p_order->>'internal_notes',
            v_key)
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
end $$;

revoke all on function create_order_internal(jsonb, jsonb) from public;
revoke all on function create_order_internal(jsonb, jsonb) from anon, authenticated;

comment on function create_order_internal is
  'Intern: skriver ordern och dess rader. GÖR INGEN BEHÖRIGHETSKONTROLL -- anropas bara av create_order_with_items och respond_to_quote, som var för sig avgjort att anroparen får skapa ordern. Inte åtkomlig för någon roll.';

-- ── create_order_with_items: behörighet här, skrivandet i den interna ───────

create or replace function create_order_with_items(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_admin boolean := has_role(auth.uid(), 'admin');
  v_user  uuid := nullif(p_order->>'user_id','')::uuid;
begin
  if v_uid is null then
    raise exception 'ej inloggad';
  end if;
  if not v_admin and (v_user is distinct from v_uid) then
    raise exception 'får bara skapa order åt sig själv';
  end if;
  return create_order_internal(p_order, p_items);
end $$;

revoke all on function create_order_with_items(jsonb, jsonb) from public;
grant execute on function create_order_with_items(jsonb, jsonb) to authenticated;

-- ── respond_to_quote: samma skrivväg, samma idempotensnyckel ───────────────

create or replace function respond_to_quote(p_id uuid, p_decision text, p_po text default null)
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
    -- product_id följer med så orderraden kan knytas till katalogen; namn och
    -- pris är ändå snapshots och rör sig inte när produkten ändras.
    select
      jsonb_agg(jsonb_build_object(
        'product_id', ri.product_id,
        'sku', coalesce(p.sku, '—'),
        'name', coalesce(p.name, 'Okänd produkt'),
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

    -- En offert utan rader ska inte ge en tom order; offerten är ändå
    -- accepterad, och det syns i rfqs.status.
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
          -- Samma nyckel som admin.rfq.tsx använder: offerten kan bara ge EN
          -- order, oavsett om kunden accepterar eller en administratör
          -- konverterar den -- eller båda.
          'idempotency_key',  'rfq:' || v_rfq.id::text
        ),
        v_items);
    end if;
  end if;

  return query select (v_updated > 0), v_order_id;
end $$;

commit;

-- create_order_with_items blir idempotent.
--
-- Specen kräver att samma knapptryckning, retry eller webhook aldrig ger en
-- dubblett. Skyddet ligger i DATABASEN -- unikt index på orders.idempotency_key
-- plus kontrollen nedan -- och inte i applikationslogik, eftersom ett unikt
-- index inte kan glömmas bort av nästa utvecklare eller kringgås av en annan
-- kodväg.
--
-- Två fall, och båda måste hanteras:
--
--   1. Dubbelklick med någon sekund emellan. Uppslaget i början hittar den
--      befintliga ordern och returnerar den.
--   2. Två anrop samtidigt, där båda passerar uppslaget innan någon hunnit
--      skriva. Då fäller det unika indexet den ena, och exception-blocket
--      returnerar vinnarens order i stället för att kasta felet vidare.
--
-- Provat i scripts/test-order-engine.sql (kontroll 27–29): samma nyckel två
-- gånger ger samma order-id, EN order, och inga dubbla orderrader.

begin;

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
  v_key   text := nullif(p_order->>'idempotency_key','');
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'ej inloggad';
  end if;
  if not v_admin and (v_user is distinct from v_uid) then
    raise exception 'får bara skapa order åt sig själv';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ordern måste ha minst en rad';
  end if;

  if v_key is not null then
    select id into v_id from orders where idempotency_key = v_key;
    if found then
      return v_id;
    end if;
  end if;

  begin
    insert into orders (user_id, rfq_id, project_id, customer_name, customer_company,
                        customer_email, customer_org_nr, po_number, status, payment_status,
                        currency, vat_rate, total_ex_vat, total_inc_vat, items,
                        internal_notes, idempotency_key)
    values (v_user,
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

revoke all on function create_order_with_items(jsonb, jsonb) from public;
grant execute on function create_order_with_items(jsonb, jsonb) to authenticated;

commit;

-- Inköpsorderns summa och granskningsskäl räknades aldrig om.
--
-- HITTAT genom att titta på adminvyn i webbläsaren, inte i koden: en
-- inköpsorder vars rader hade inköpspriser stod ändå som
-- "inget inköpspris" och "granska: inköpspris saknas".
--
-- Orsaken: total_purchase_ex_vat, needs_review och review_reason sattes EN
-- gång, när inköpsordern skapades, och rördes sedan aldrig. Kom priserna in
-- efteråt -- eller ändrades de av ett godkänt leverantörssvar -- fortsatte
-- vyn att visa det gamla. PDF:en räknade sin egen summa ur raderna och hade
-- alltså rätt, medan listan bredvid hade fel. Två sanningar om samma order.
--
-- LÖSNINGEN ÄR ATT EN FUNKTION ÄGER ALLA AVLEDDA VÄRDEN.
-- uppdatera_inkopsorderstatus() räknar om status, summa, granskningsflagga och
-- skäl ur raderna, och anropas från alla tre vägarna: när inköpsordern skapas,
-- när ett svar registreras och när en stoppad rad får sitt beslut.

begin;

create or replace function uppdatera_inkopsorderstatus(p_spo_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rod       int;
  v_obes      int;
  v_svarat    int;
  v_utan_pris int;
  v_summa     numeric;
  v_sent      timestamptz;
  v_leverantor uuid;
  v_efter     int;
begin
  select spo.sent_at, spo.supplier_id into v_sent, v_leverantor
    from supplier_purchase_orders spo where spo.id = p_spo_id;

  -- Rader som tillkommit EFTER att inköpsordern skickades och ännu inte fått
  -- svar: leverantören har ett papper som inte längre stämmer. Villkoret
  -- HÄRLEDS ur raderna i stället för att sättas i förbifarten -- ett
  -- meddelande som bara skrivs en gång försvinner vid nästa omräkning.
  select count(*) filter (where i.status = 'blocked'),
         count(*) filter (where i.ack_status is null and i.status <> 'cancelled'),
         count(*) filter (where i.ack_status is not null),
         count(*) filter (where i.unit_purchase_price is null and i.status <> 'cancelled'),
         sum(i.line_total_ex_vat) filter (where i.status <> 'cancelled'),
         count(*) filter (where v_sent is not null and i.created_at > v_sent and i.ack_status is null)
    into v_rod, v_obes, v_svarat, v_utan_pris, v_summa, v_efter
    from supplier_purchase_order_items i
   where i.spo_id = p_spo_id;

  update supplier_purchase_orders spo
     set status = case
           when v_svarat = 0 then spo.status
           when v_rod = 0 and v_obes = 0 then 'acknowledged'
           when v_rod > 0 and v_svarat = v_rod and v_obes = 0 then 'rejected'
           else 'partially_acknowledged' end,
         total_purchase_ex_vat = v_summa,
         needs_review = (v_rod > 0)
                        or (v_obes > 0 and v_svarat > 0)
                        or (v_leverantor is null)
                        or (v_utan_pris > 0)
                        or (v_efter > 0)
                        -- Ett skäl utan flagga är en varning ingen ser.
                        or (v_sent is null and v_svarat > 0),
         review_reason = nullif(concat_ws('; ',
           case when v_leverantor is null then 'okänd leverantör' end,
           case when v_utan_pris > 0 then 'inköpspris saknas' end,
           case when v_rod > 0 then v_rod || ' rader kräver godkännande' end,
           case when v_obes > 0 and v_svarat > 0 then v_obes || ' rader saknar svar' end,
           case when v_efter > 0 then v_efter || ' nya orderrader efter att inköpsordern skickades' end,
           case when v_sent is null and v_svarat > 0
                then 'bekräftelse registrerad utan att inköpsordern skickats härifrån' end), '')
   where spo.id = p_spo_id;
end $$;

comment on function uppdatera_inkopsorderstatus is
  'Intern: äger inköpsorderns AVLEDDA värden -- status, summa, granskningsflagga och skäl -- och räknar om dem ur raderna. Anropas när ordern skapas, när ett svar registreras och när en stoppad rad får sitt beslut.';

-- create_supplier_pos äger inte längre de avledda värdena. Den skapar raderna
-- och låter uppdatera_inkopsorderstatus räkna. Två ställen som räknade samma
-- sak var hur de hann glida isär.

create or replace function create_supplier_pos(p_order_id uuid)
returns table(spo_id uuid, po_number text, supplier text, antal_rader int, needs_review boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rad      record;
  v_spo      uuid;
  v_key      text;
  v_status   text;
  v_saknade  int;
  v_okand    constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if not has_role(auth.uid(), 'admin') then
    raise exception 'bara administratörer skapar inköpsordrar';
  end if;
  if not exists (select 1 from orders where id = p_order_id) then
    raise exception 'ordern finns inte: %', p_order_id;
  end if;

  update order_items oi
     set intended_supplier_id = coalesce(
           oi.intended_supplier_id,
           (select sp.supplier_id from supplier_products sp
             where sp.product_id = oi.product_id
             order by sp.is_preferred desc nulls last, sp.purchase_price asc nulls last
             limit 1),
           (select s.id from products p
              join brands b on b.id = p.brand_id
              join suppliers s on s.slug = b.slug
             where p.id = oi.product_id))
   where oi.order_id = p_order_id;

  for v_rad in
    select oi.intended_supplier_id as sup
      from order_items oi
     where oi.order_id = p_order_id
     group by oi.intended_supplier_id
     order by oi.intended_supplier_id nulls last
  loop
    v_key := 'order:' || p_order_id::text || ':sup:' || coalesce(v_rad.sup, v_okand)::text;

    select spo.id, spo.status into v_spo, v_status
      from supplier_purchase_orders spo where spo.idempotency_key = v_key;

    if v_spo is null then
      insert into supplier_purchase_orders (
        order_id, supplier_id, status, integration_method, currency,
        expected_delivery, needs_review, idempotency_key)
      values (
        p_order_id, v_rad.sup, 'draft',
        (select si.method from supplier_integrations si
          where si.supplier_id = v_rad.sup
          order by si.is_primary desc nulls last limit 1),
        coalesce((select s.currency from suppliers s where s.id = v_rad.sup), 'SEK'),
        case when (select s.default_lead_time_days from suppliers s where s.id = v_rad.sup) is not null
             then (current_date + ((select s.default_lead_time_days from suppliers s where s.id = v_rad.sup) || ' days')::interval)::date
        end,
        false, v_key)
      returning id, status into v_spo, v_status;
    end if;

    select count(*)::int into v_saknade
      from order_items oi
     where oi.order_id = p_order_id
       and oi.intended_supplier_id is not distinct from v_rad.sup
       and not exists (select 1 from supplier_purchase_order_items i
                        where i.spo_id = v_spo and i.order_item_id = oi.id);

    -- Bara ett utkast fylls på. En skickad inköpsorder rörs inte; att raderna
    -- saknas syns ändå, för uppdatera_inkopsorderstatus härleder det.
    if v_saknade > 0 and v_status = 'draft' then
      insert into supplier_purchase_order_items (
        spo_id, order_item_id, line_no, sku, supplier_sku, name, qty,
        unit_purchase_price, line_total_ex_vat)
      select v_spo, oi.id,
             (coalesce((select max(i.line_no) from supplier_purchase_order_items i where i.spo_id = v_spo), 0)
              + row_number() over (order by oi.line_no))::int,
             oi.sku, sp.supplier_sku, oi.name, oi.qty,
             coalesce(sp.purchase_price, pr.purchase_price),
             round(oi.qty * coalesce(sp.purchase_price, pr.purchase_price), 2)
        from order_items oi
        left join products pr on pr.id = oi.product_id
        left join lateral (
          select sp.* from supplier_products sp
           where sp.product_id = oi.product_id and sp.supplier_id = oi.intended_supplier_id
           order by sp.is_preferred desc nulls last limit 1) sp on true
       where oi.order_id = p_order_id
         and oi.intended_supplier_id is not distinct from v_rad.sup
         and not exists (select 1 from supplier_purchase_order_items i
                          where i.spo_id = v_spo and i.order_item_id = oi.id);
    end if;

    perform uppdatera_inkopsorderstatus(v_spo);

    spo_id := v_spo;
    supplier := coalesce((select s.name from suppliers s where s.id = v_rad.sup), 'Okänd leverantör');
    antal_rader := (select count(*)::int from supplier_purchase_order_items i where i.spo_id = v_spo);
    select spo.po_number, spo.needs_review into po_number, needs_review
      from supplier_purchase_orders spo where spo.id = v_spo;
    return next;
  end loop;
end $$;

commit;

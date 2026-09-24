-- En orderrad som tillkommer efter inköpsordern får inte glömmas bort.
--
-- HITTAT vid genomläsning av min egen funktion: create_supplier_pos() hoppade
-- över hela leverantören när inköpsordern redan fanns ("rör den inte"). Det är
-- rätt för en SKICKAD inköpsorder, men fel för ett utkast:
--
--   1. administratören skapar inköpsordrarna
--   2. kunden ringer och lägger till en cylinder
--   3. administratören trycker "Skapa" igen
--   4. raden hamnar i INGEN inköpsorder -- och ingen beställer den
--
-- Ingenting hade sagt ifrån. Ordern hade sett komplett ut ända till den dag
-- leveransen kom med en artikel för lite.
--
-- REGELN: så länge inköpsordern är ett utkast fylls saknade rader på. Är den
-- skickad rörs raderna INTE -- leverantören har fått ett papper som då inte
-- längre stämmer -- utan inköpsordern markeras för granskning i stället, med
-- skälet utskrivet. Ett människobeslut, inte ett tyst.

begin;

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
    select oi.intended_supplier_id as sup,
           bool_or(coalesce(sp.purchase_price, pr.purchase_price) is null) as saknar_pris
      from order_items oi
      left join products pr on pr.id = oi.product_id
      left join lateral (
        select sp.* from supplier_products sp
         where sp.product_id = oi.product_id and sp.supplier_id = oi.intended_supplier_id
         order by sp.is_preferred desc nulls last limit 1) sp on true
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
        expected_delivery, needs_review, review_reason, idempotency_key)
      values (
        p_order_id, v_rad.sup, 'draft',
        (select si.method from supplier_integrations si
          where si.supplier_id = v_rad.sup
          order by si.is_primary desc nulls last limit 1),
        coalesce((select s.currency from suppliers s where s.id = v_rad.sup), 'SEK'),
        case when (select s.default_lead_time_days from suppliers s where s.id = v_rad.sup) is not null
             then (current_date + ((select s.default_lead_time_days from suppliers s where s.id = v_rad.sup) || ' days')::interval)::date
        end,
        v_rad.sup is null or v_rad.saknar_pris,
        nullif(concat_ws('; ',
          case when v_rad.sup is null then 'okänd leverantör' end,
          case when v_rad.saknar_pris then 'inköpspris saknas' end), ''),
        v_key)
      returning id, status into v_spo, v_status;
    end if;

    -- Vilka av leverantörens orderrader saknar en rad i inköpsordern?
    select count(*)::int into v_saknade
      from order_items oi
     where oi.order_id = p_order_id
       and oi.intended_supplier_id is not distinct from v_rad.sup
       and not exists (select 1 from supplier_purchase_order_items i
                        where i.spo_id = v_spo and i.order_item_id = oi.id);

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

      update supplier_purchase_orders spo
         set total_purchase_ex_vat = (select sum(i.line_total_ex_vat)
                                        from supplier_purchase_order_items i
                                       where i.spo_id = v_spo)
       where spo.id = v_spo;

    elsif v_saknade > 0 then
      -- Skickad inköpsorder: leverantören har ett papper som inte längre
      -- stämmer. Rör inte raderna, säg ifrån.
      update supplier_purchase_orders spo
         set needs_review = true,
             review_reason = nullif(concat_ws('; ', spo.review_reason,
               v_saknade || ' nya orderrader efter att inköpsordern skickades'), '')
       where spo.id = v_spo;
    end if;

    spo_id := v_spo;
    supplier := coalesce((select s.name from suppliers s where s.id = v_rad.sup), 'Okänd leverantör');
    antal_rader := (select count(*)::int from supplier_purchase_order_items i where i.spo_id = v_spo);
    select spo.po_number, spo.needs_review into po_number, needs_review
      from supplier_purchase_orders spo where spo.id = v_spo;
    return next;
  end loop;
end $$;

commit;

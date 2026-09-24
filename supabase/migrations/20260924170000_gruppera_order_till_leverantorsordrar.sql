-- Grupperingen: kundorder in, en inköpsorder per leverantör ut.
--
-- Det här är §3 steg 6 och 7. order_items.intended_supplier_id fanns redan som
-- kolumn sedan #275 men SATTES ALDRIG av någon -- en tom kolumn med rätt namn.
-- Den fylls här, och blir därmed spårbar: man kan i efterhand se vilken
-- leverantör raden hamnade hos och varför.
--
-- VEM SKA LEVERERA? Tre källor, i tur och ordning:
--
--   1. order_items.intended_supplier_id  någon har redan bestämt det
--   2. supplier_products                 den riktiga kopplingen: vem säljer
--                                        oss produkten, till vilket pris
--   3. produktens märke                  nödlösningen tills avtalen finns
--
-- Steg 3 är en GISSNING och märks som det: tillverkare är inte leverantör --
-- Festo-delar kan köpas från en distributör. Så länge supplier_products är tom
-- är det enda signalen vi har, och en inköpsorder som pekar på märket är
-- lättare att rätta än en orderrad som tyst försvinner.
--
-- RADER UTAN KÄND LEVERANTÖR försvinner inte: de hamnar i en inköpsorder utan
-- supplier_id, markerad needs_review. Samma sak om inköpspriset saknas -- och
-- det saknas för alla 846 produkter i dag, så varenda inköpsorder kommer att
-- vara markerad tills prislistorna är inlästa. Det är avsikten: det ska synas.

begin;

create or replace function create_supplier_pos(p_order_id uuid)
returns table(spo_id uuid, po_number text, supplier text, antal_rader int, needs_review boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rad     record;
  v_spo     uuid;
  v_key     text;
  v_okand   constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if not has_role(auth.uid(), 'admin') then
    raise exception 'bara administratörer skapar inköpsordrar';
  end if;
  if not exists (select 1 from orders where id = p_order_id) then
    raise exception 'ordern finns inte: %', p_order_id;
  end if;

  -- 1. Bestäm leverantör per rad, och skriv in den.
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

  -- 2. En inköpsorder per leverantör. Nyckeln gör om-körningen ofarlig.
  for v_rad in
    select oi.intended_supplier_id as sup,
           count(*)::int as rader,
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

    select id into v_spo from supplier_purchase_orders where idempotency_key = v_key;
    if found then
      -- Redan skapad. Rör den inte: raderna kan ha ändrats för hand, och en
      -- skickad inköpsorder får inte skriva om sig själv.
      spo_id := v_spo;
      select spo.po_number, spo.needs_review into po_number, needs_review
        from supplier_purchase_orders spo where spo.id = v_spo;
      supplier := coalesce((select name from suppliers where id = v_rad.sup), 'Okänd leverantör');
      antal_rader := (select count(*)::int from supplier_purchase_order_items where spo_id = v_spo);
      return next;
      continue;
    end if;

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
    returning id into v_spo;

    -- 3. Raderna. Antalet är hela orderradens: en delning mellan flera
    --    inköpsordrar görs för hand eller av bekräftelsen, inte här.
    insert into supplier_purchase_order_items (
      spo_id, order_item_id, line_no, sku, supplier_sku, name, qty,
      unit_purchase_price, line_total_ex_vat)
    select v_spo, oi.id,
           (row_number() over (order by oi.line_no))::int,
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
       and oi.intended_supplier_id is not distinct from v_rad.sup;

    update supplier_purchase_orders spo
       set total_purchase_ex_vat = (select sum(line_total_ex_vat)
                                      from supplier_purchase_order_items
                                     where spo_id = v_spo)
     where spo.id = v_spo;

    spo_id := v_spo;
    supplier := coalesce((select name from suppliers where id = v_rad.sup), 'Okänd leverantör');
    antal_rader := (select count(*)::int from supplier_purchase_order_items where spo_id = v_spo);
    select spo.po_number, spo.needs_review into po_number, needs_review
      from supplier_purchase_orders spo where spo.id = v_spo;
    return next;
  end loop;
end $$;

revoke all on function create_supplier_pos(uuid) from public, anon;
grant execute on function create_supplier_pos(uuid) to authenticated;

comment on function create_supplier_pos is
  'Grupperar en kundorders rader per leverantör och skapar en inköpsorder per leverantör. Idempotent: samma order ger samma inköpsordrar, aldrig dubbla inköp.';

commit;

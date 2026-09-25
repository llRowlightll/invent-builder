-- Orderraden och ordern följer försändelserna (§18 punkt 14).
--
-- "Ordern blir inte levererad förrän samtliga orderrader är levererade."
-- Det får inte vara något någon kommer ihåg att klicka: statusen HÄRLEDS ur
-- vad som faktiskt skickats och kommit fram.
--
-- EN DELVIS SKICKAD RAD ÄR INTE SKICKAD. Två av fyra cylindrar på väg gör inte
-- raden 'shipped' -- kunden som läser "skickad" väntar sig fyra. Portalen kan
-- visa "2 av 4 skickade" ur shipment_items; radens status ljuger inte.

begin;

create or replace function uppdatera_orderleverans(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rader int;
  v_levererade int;
  v_rorda int;
begin
  with per_rad as (
    select oi.id,
           oi.qty,
           coalesce(sum(si.qty) filter (where s.status in ('in_transit','delivered')), 0) as skickat,
           coalesce(sum(si.qty) filter (where s.status = 'delivered'), 0)                 as levererat
      from order_items oi
      left join shipment_items si on si.order_item_id = oi.id
      left join shipments s on s.id = si.shipment_id
     where oi.order_id = p_order_id
     group by oi.id, oi.qty
  )
  update order_items oi
     set status = case
           when pr.levererat >= pr.qty then 'delivered'
           when pr.skickat  >= pr.qty then 'shipped'
           else oi.status end
    from per_rad pr
   where oi.id = pr.id
     and oi.status not in ('cancelled', 'returned')
     and oi.status is distinct from case
           when pr.levererat >= pr.qty then 'delivered'
           when pr.skickat  >= pr.qty then 'shipped'
           else oi.status end;

  select count(*) filter (where status not in ('cancelled')),
         count(*) filter (where status = 'delivered'),
         count(*) filter (where status in ('shipped','delivered'))
    into v_rader, v_levererade, v_rorda
    from order_items where order_id = p_order_id;

  update orders o
     set status = case
           when v_rader > 0 and v_levererade = v_rader then 'delivered'
           when v_rorda > 0 then 'shipped'
           else o.status end,
         shipped_at = coalesce(o.shipped_at,
           (select min(s.shipped_at) from shipments s where s.order_id = p_order_id and s.shipped_at is not null)),
         delivered_at = case
           when v_rader > 0 and v_levererade = v_rader
           then coalesce(o.delivered_at,
                (select max(s.delivered_at) from shipments s where s.order_id = p_order_id))
           else o.delivered_at end
   where o.id = p_order_id
     and o.status not in ('cancelled', 'invoiced', 'paid');
end $$;

revoke all on function uppdatera_orderleverans(uuid) from public, anon, authenticated;

comment on function uppdatera_orderleverans is
  'Intern: härleder orderradernas och orderns leveransstatus ur försändelserna. Ordern blir levererad först när VARJE rad är det.';

-- EN TRIGGERFUNKTION KAN INTE BETJÄNA BÅDA TABELLERNA: på shipments heter
-- kolumnen id, på shipment_items heter den shipment_id, och plpgsql kastar
-- "record new has no field shipment_id" så fort den rör fel fält. Jag skrev
-- först en gemensam och upptäckte det i provet.

create or replace function trg_shipment_order()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(new.order_id, old.order_id) is not null then
    perform uppdatera_orderleverans(coalesce(new.order_id, old.order_id));
  end if;
  return coalesce(new, old);
end $$;

create or replace function trg_shipment_item_order()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_order uuid;
begin
  select s.order_id into v_order from shipments s
   where s.id = coalesce(new.shipment_id, old.shipment_id);
  if v_order is not null then
    perform uppdatera_orderleverans(v_order);
  end if;
  return coalesce(new, old);
end $$;

revoke all on function trg_shipment_order() from public, anon, authenticated;
revoke all on function trg_shipment_item_order() from public, anon, authenticated;

drop trigger if exists shipments_paverkar_order on public.shipments;
create trigger shipments_paverkar_order
  after insert or update of status, delivered_at, shipped_at on public.shipments
  for each row execute function trg_shipment_order();

drop trigger if exists shipment_items_paverkar_order on public.shipment_items;
create trigger shipment_items_paverkar_order
  after insert or update or delete on public.shipment_items
  for each row execute function trg_shipment_item_order();

commit;

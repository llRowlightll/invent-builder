-- Orderns resa: kundens spårning och mejlen vid varje steg.
--
-- Ägaren 2026-11-12: "som Foodora -- vi har tagit emot ditt inköp, den
-- produceras nu, är på leverans, ungefär leveranstid 2 dagar eller vad
-- ledtiden är". Stegen härleds ur det som redan finns (inköpsordrar,
-- leverantörens bekräftelse, försändelser) -- ingen ny statuskolumn att
-- glömma att uppdatera.
--
--   mottagen   ordern finns
--   bestalld   alla inköpsordrar skickade till leverantören
--   bekraftad  alla leverantörer har bekräftat (leveransdatum)
--   skickad    minst en försändelse (delvis tills allt är skickat)
--   levererad  ordern levererad
--
-- Leveransdagen: levererad > fraktbolagets beräknade > leverantörens
-- bekräftade > uppskattning ur ledtiderna (arbetsdagar från orderdagen).
-- Källan följer med, så sidan kan skriva "ca" när det är en uppskattning.
--
-- Mejlen skickas från databasen via pg_net till funktionen orderhandelse,
-- inte från webbläsaren: en statusändring gjord av en leverantör via länken,
-- av en trigger eller av admin ger samma mejl, och inget tappas när någon
-- stänger en flik. Funktionen läser om raderna och skickar bara det som
-- faktiskt hänt, en gång per händelse (notifications.idempotency_key).

begin;

create or replace function public.lagg_till_arbetsdagar(p_fran date, p_dagar int)
returns date
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  d date := p_fran;
  kvar int := greatest(coalesce(p_dagar, 0), 0);
begin
  while kvar > 0 loop
    d := d + 1;
    if extract(isodow from d) < 6 then kvar := kvar - 1; end if;
  end loop;
  return d;
end $$;

-- ── Kundens vy ──────────────────────────────────────────────────────────────
-- Nås med orderns uuid, precis som orderbekräftelsen (get_order_by_id): en
-- gästkund har inget konto, och uuid:t står bara i kundens egna mejl.
-- Inga inköpspriser, inga leverantörsnamn, inga interna anteckningar.
create or replace function public.orderns_resa(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_o        orders;
  v_spo_tot  int;
  v_spo_sent int;
  v_spo_ack  int;
  v_sent_at  timestamptz;
  v_ack_at   timestamptz;
  v_ack_max  date;
  v_ship_min timestamptz;
  v_ship_eta date;
  v_rader    int;
  v_skickade int;
  v_eta      date;
  v_kalla    text;
  v_ledtid   int;
begin
  select * into v_o from orders where id = p_order_id;
  if not found then return null; end if;

  select count(*) filter (where status <> 'cancelled'),
         count(*) filter (where status <> 'cancelled' and sent_at is not null),
         count(*) filter (where status <> 'cancelled' and ack_received_at is not null),
         max(sent_at), max(ack_received_at)
    into v_spo_tot, v_spo_sent, v_spo_ack, v_sent_at, v_ack_at
    from supplier_purchase_orders where order_id = p_order_id;

  select max(i.ack_delivery_date) into v_ack_max
    from supplier_purchase_order_items i
    join supplier_purchase_orders s on s.id = i.spo_id
   where s.order_id = p_order_id and i.status <> 'cancelled';

  select min(shipped_at), max(estimated_delivery) into v_ship_min, v_ship_eta
    from shipments where order_id = p_order_id and status in ('in_transit', 'delivered');

  select count(*) filter (where status not in ('cancelled')),
         count(*) filter (where status in ('shipped', 'delivered'))
    into v_rader, v_skickade
    from order_items where order_id = p_order_id;

  select max(coalesce(lead_time_days, 5)) into v_ledtid
    from order_items where order_id = p_order_id and status <> 'cancelled';

  if v_o.status in ('delivered', 'invoiced', 'paid') and v_o.delivered_at is not null then
    v_eta := v_o.delivered_at::date; v_kalla := 'levererad';
  elsif v_skickade = v_rader and v_rader > 0 and v_ship_eta is not null then
    v_eta := v_ship_eta; v_kalla := 'fraktbolag';
  elsif v_ack_max is not null then
    v_eta := greatest(v_ack_max, coalesce(v_ship_eta, v_ack_max)); v_kalla := 'leverantor';
  else
    v_eta := lagg_till_arbetsdagar(v_o.created_at::date, coalesce(v_ledtid, 5)); v_kalla := 'uppskattning';
  end if;

  return jsonb_build_object(
    'order_number', v_o.order_number,
    'skapad', v_o.created_at,
    'status', v_o.status,
    'avbruten', v_o.status = 'cancelled',
    'kund', split_part(coalesce(v_o.customer_name, ''), ' ', 1),
    'ort', v_o.delivery_city,
    'po_number', v_o.po_number,
    'eta', v_eta,
    'eta_kalla', v_kalla,
    'steg', jsonb_build_array(
      jsonb_build_object('kod', 'mottagen', 'klar', true, 'tid', v_o.created_at),
      jsonb_build_object('kod', 'bestalld', 'klar', v_spo_tot > 0 and v_spo_sent = v_spo_tot,
                         'tid', case when v_spo_tot > 0 and v_spo_sent = v_spo_tot then v_sent_at end),
      jsonb_build_object('kod', 'bekraftad', 'klar', v_spo_tot > 0 and v_spo_ack = v_spo_tot,
                         'tid', case when v_spo_tot > 0 and v_spo_ack = v_spo_tot then v_ack_at end),
      jsonb_build_object('kod', 'skickad', 'klar', v_rader > 0 and v_skickade = v_rader,
                         'delvis', v_ship_min is not null and v_skickade < v_rader, 'tid', v_ship_min),
      jsonb_build_object('kod', 'levererad', 'klar', v_o.status in ('delivered', 'invoiced', 'paid'),
                         'tid', v_o.delivered_at)),
    'rader', coalesce((
      select jsonb_agg(jsonb_build_object(
               'line_no', oi.line_no, 'sku', oi.sku, 'name', oi.name, 'qty', oi.qty, 'status', oi.status,
               'skickat', coalesce((select sum(si.qty) from shipment_items si join shipments s on s.id = si.shipment_id
                                     where si.order_item_id = oi.id and s.status in ('in_transit','delivered')), 0),
               'bekraftad_leverans', (select max(i.ack_delivery_date) from supplier_purchase_order_items i
                                       where i.order_item_id = oi.id and i.status <> 'cancelled'))
             order by oi.line_no)
        from order_items oi where oi.order_id = p_order_id), '[]'::jsonb),
    'forsandelser', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'nr', s.shipment_no, 'fraktbolag', s.carrier, 'sparningsnummer', s.tracking_number,
               'url', s.tracking_url, 'skickad', s.shipped_at, 'beraknad', s.estimated_delivery,
               'levererad', s.delivered_at, 'status', s.status,
               'rader', (select jsonb_agg(jsonb_build_object('sku', oi.sku, 'name', oi.name, 'qty', si.qty) order by oi.line_no)
                           from shipment_items si join order_items oi on oi.id = si.order_item_id
                          where si.shipment_id = s.id))
             order by s.shipment_no nulls last, s.shipped_at)
        from shipments s where s.order_id = p_order_id and s.status in ('in_transit', 'delivered')), '[]'::jsonb)
  );
end $function$;

revoke all on function public.orderns_resa(uuid) from public;
grant execute on function public.orderns_resa(uuid) to anon, authenticated;

-- Kunden kvitterar en försändelse ("Jag har tagit emot den").
create or replace function public.kvittera_forsandelse(p_order_id uuid, p_shipment_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_n int;
begin
  update shipments
     set status = 'delivered', delivered_at = coalesce(delivered_at, now()),
         proof_of_delivery = coalesce(proof_of_delivery, 'kvitterad av kunden')
   where id = p_shipment_id and order_id = p_order_id and status = 'in_transit';
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into tracking_events (shipment_id, occurred_at, status, description, source)
    values (p_shipment_id, now(), 'delivered', 'Kvitterad av kunden', 'kund');
  end if;
  return v_n > 0;
end $function$;

revoke all on function public.kvittera_forsandelse(uuid, uuid) from public;
grant execute on function public.kvittera_forsandelse(uuid, uuid) to anon, authenticated;

-- ── Mejlen ──────────────────────────────────────────────────────────────────
create or replace function public.skicka_orderhandelse(p_order_id uuid, p_handelse text, p_shipment_id uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform net.http_post(
    url := 'https://buqfbcztspswezwyafxo.supabase.co/functions/v1/orderhandelse',
    body := jsonb_build_object('order_id', p_order_id, 'handelse', p_handelse, 'shipment_id', p_shipment_id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000);
exception when others then
  -- Ett mejl får aldrig stoppa en order, en bekräftelse eller en försändelse.
  raise warning 'orderhändelse % för order % köades inte: %', p_handelse, p_order_id, sqlerrm;
end $function$;

revoke all on function public.skicka_orderhandelse(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.trg_orderhandelse_order()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform skicka_orderhandelse(new.id, 'mottagen');
  elsif new.status = 'delivered' and old.status is distinct from 'delivered' then
    perform skicka_orderhandelse(new.id, 'levererad');
  end if;
  return null;
end $function$;

drop trigger if exists orderhandelse_order on public.orders;
create trigger orderhandelse_order
  after insert or update of status on public.orders
  for each row execute function public.trg_orderhandelse_order();

create or replace function public.trg_orderhandelse_bekraftelse()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.ack_received_at is not null and old.ack_received_at is null then
    perform skicka_orderhandelse(new.order_id, 'bekraftad');
  end if;
  return null;
end $function$;

drop trigger if exists orderhandelse_bekraftelse on public.supplier_purchase_orders;
create trigger orderhandelse_bekraftelse
  after update of ack_received_at on public.supplier_purchase_orders
  for each row execute function public.trg_orderhandelse_bekraftelse();

create or replace function public.trg_orderhandelse_forsandelse()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.order_id is not null and new.status = 'in_transit' then
    perform skicka_orderhandelse(new.order_id, 'skickad', new.id);
  end if;
  return null;
end $function$;

drop trigger if exists orderhandelse_forsandelse on public.shipments;
create trigger orderhandelse_forsandelse
  after insert on public.shipments
  for each row execute function public.trg_orderhandelse_forsandelse();

commit;

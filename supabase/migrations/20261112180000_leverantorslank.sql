-- Leverantörslänken: leverantören bekräftar inköpsordern och anger
-- försändelse själv, utan konto.
--
-- Ägaren 2026-11-12: "7-an ska vara automatiskt" (leverantörens bekräftelse).
-- Inköpsorderns mejl och PDF bär en hemlig länk, /leverantor/<token>. Där
-- bekräftar leverantören antal, pris och leveransdatum per rad, och anger
-- fraktbolag och spårningsnummer när det skickas. Bekräftelsen går genom
-- samma klassning grön/gul/röd som en manuellt registrerad (röd stoppar raden
-- tills en människa beslutar), och försändelsen genom samma tabeller som
-- kundens spårning läser.
--
-- SÄKERHET
--   Token: 24 slumpbyte, skapas i supplier-po när ordern skickas och mejlas
--   bara till suppliers.order_email. Databasen sparar bara SHA-256 av den.
--   Ett nytt utskick ger en ny token; den gamla slutar fungera.
--   Funktionerna nedan är SECURITY DEFINER och öppna för anon, men gör
--   ingenting utan en token som matchar en icke annullerad inköpsorder.
--   Leverantören ser sin egen inköpsorder: våra inköpspriser till den, och
--   leveransadressen. Aldrig kundens pris, marginal eller andra ordrar.

begin;

alter table public.supplier_purchase_orders
  add column if not exists leverantor_token_hash text,
  add column if not exists leverantor_lank_oppnad_at timestamptz;

create unique index if not exists spo_leverantor_token_hash_key
  on public.supplier_purchase_orders (leverantor_token_hash)
  where leverantor_token_hash is not null;

comment on column public.supplier_purchase_orders.leverantor_token_hash is
  'SHA-256 (hex) av leverantörslänkens token. Själva token finns bara i mejlet till leverantören.';

-- ── Spårningslänk per fraktbolag ────────────────────────────────────────────
-- Numret tvättas till [A-Za-z0-9-] innan det hamnar i en URL.
create or replace function public.sparningslank(p_carrier text, p_nr text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
           when x.u = '' then null
           when lower(p_carrier) = 'postnord' then 'https://tracking.postnord.com/se/?id=' || x.u
           when lower(p_carrier) = 'dhl'      then 'https://www.dhl.com/se-sv/home/tracking.html?tracking-id=' || x.u
           when lower(p_carrier) = 'schenker' then 'https://www.dbschenker.com/app/tracking-public/?refNumber=' || x.u
           when lower(p_carrier) = 'bring'    then 'https://tracking.bring.se/tracking/' || x.u
           when lower(p_carrier) = 'ups'      then 'https://www.ups.com/track?loc=sv_SE&tracknum=' || x.u
           when lower(p_carrier) = 'fedex'    then 'https://www.fedex.com/fedextrack/?trknbr=' || x.u
           else null
         end
    from (select regexp_replace(coalesce(p_nr, ''), '[^A-Za-z0-9-]', '', 'g') as u) x
$$;

-- ── Bekräftelsen, utan admin-kontrollen ─────────────────────────────────────
-- Samma kropp som register_supplier_ack (20260924190000 m.fl.). Den nås bara
-- via register_supplier_ack (admin) och leverantor_bekrafta (token).
create or replace function public.registrera_leverantorsbekraftelse(
  p_spo_id uuid, p_lines jsonb, p_source text default 'manual',
  p_supplier_reference text default null, p_note text default null)
returns table(ack_id uuid, worst_level text, antal_gron integer, antal_gul integer, antal_rod integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_spo      supplier_purchase_orders;
  v_ptol     numeric;
  v_dtol     int;
  v_ack      uuid;
  v_rad      record;
  v_spoi     supplier_purchase_order_items;
  v_niva     text;
  v_skal     text;
  v_gron     int := 0;
  v_gul      int := 0;
  v_rod      int := 0;
  v_max_lev  date;
  v_worst    text;
  v_aktor    uuid;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'bekräftelsen måste innehålla minst en rad';
  end if;

  select * into v_spo from supplier_purchase_orders where id = p_spo_id;
  if not found then raise exception 'inköpsordern finns inte: %', p_spo_id; end if;
  if v_spo.status = 'cancelled' then raise exception 'inköpsordern är annullerad'; end if;

  begin v_aktor := auth.uid(); exception when others then v_aktor := null; end;

  select si.price_tolerance_pct, si.delay_tolerance_days into v_ptol, v_dtol
    from supplier_integrations si
   where si.supplier_id = v_spo.supplier_id
   order by si.is_primary desc nulls last
   limit 1;

  insert into supplier_acknowledgements (spo_id, source, registered_by, supplier_reference, raw_payload, note)
  values (p_spo_id, coalesce(nullif(btrim(p_source), ''), 'manual'), v_aktor,
          nullif(btrim(p_supplier_reference), ''), p_lines, nullif(btrim(p_note), ''))
  returning id into v_ack;

  for v_rad in select * from jsonb_array_elements(p_lines) as e(value)
  loop
    select * into v_spoi from supplier_purchase_order_items
     where id = (v_rad.value->>'spoi_id')::uuid and spo_id = p_spo_id;
    if not found then
      raise exception 'raden % hör inte till inköpsordern', v_rad.value->>'spoi_id';
    end if;

    select k.niva, k.skal into v_niva, v_skal
      from klassificera_avvikelse(
        v_spoi.qty,
        v_spoi.unit_purchase_price,
        v_spo.expected_delivery,
        nullif(v_rad.value->>'qty','')::numeric,
        nullif(v_rad.value->>'unit_price','')::numeric,
        nullif(v_rad.value->>'delivery_date','')::date,
        v_rad.value->>'response',
        v_rad.value->>'substitute_sku',
        v_ptol, v_dtol) k;

    update supplier_purchase_order_items
       set ack_id = v_ack,
           ack_qty = nullif(v_rad.value->>'qty','')::numeric,
           ack_unit_price = nullif(v_rad.value->>'unit_price','')::numeric,
           ack_delivery_date = nullif(v_rad.value->>'delivery_date','')::date,
           ack_substitute_sku = nullif(btrim(coalesce(v_rad.value->>'substitute_sku','')), ''),
           ack_note = nullif(btrim(coalesce(v_rad.value->>'note','')), ''),
           ack_status = v_niva,
           ack_reason = v_skal,
           status = case when v_niva = 'rod' then 'blocked' else 'confirmed' end,
           approved_by = null,
           approved_at = null
     where id = v_spoi.id;

    if v_niva = 'rod' then v_rod := v_rod + 1;
    elsif v_niva = 'gul' then v_gul := v_gul + 1;
    else v_gron := v_gron + 1;
    end if;

    if v_niva <> 'rod' and v_spoi.order_item_id is not null then
      update order_items
         set status = 'acknowledged',
             lead_time_days = case
               when nullif(v_rad.value->>'delivery_date','')::date is not null
               then greatest(0, (nullif(v_rad.value->>'delivery_date','')::date - current_date))
               else lead_time_days end
       where id = v_spoi.order_item_id
         and status is distinct from 'acknowledged'
         and status not in ('shipped', 'delivered', 'cancelled', 'returned');
    end if;

    v_max_lev := greatest(v_max_lev, nullif(v_rad.value->>'delivery_date','')::date);
  end loop;

  v_worst := case when v_rod > 0 then 'rod' when v_gul > 0 then 'gul' else 'gron' end;

  update supplier_acknowledgements
     set worst_level = v_worst, line_count = v_gron + v_gul + v_rod
   where id = v_ack;

  update supplier_purchase_orders spo
     set ack_received_at = now(),
         expected_delivery = coalesce(v_max_lev, spo.expected_delivery)
   where spo.id = p_spo_id;

  perform uppdatera_inkopsorderstatus(p_spo_id);

  ack_id := v_ack; worst_level := v_worst;
  antal_gron := v_gron; antal_gul := v_gul; antal_rod := v_rod;
  return next;
end $function$;

revoke all on function public.registrera_leverantorsbekraftelse(uuid, jsonb, text, text, text) from public, anon, authenticated;

create or replace function public.register_supplier_ack(
  p_spo_id uuid, p_lines jsonb, p_source text default 'manual',
  p_supplier_reference text default null, p_note text default null)
returns table(ack_id uuid, worst_level text, antal_gron integer, antal_gul integer, antal_rod integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role(auth.uid(), 'admin') then
    raise exception 'bara administratörer registrerar leverantörsbekräftelser';
  end if;
  return query select * from registrera_leverantorsbekraftelse(p_spo_id, p_lines, p_source, p_supplier_reference, p_note);
end $function$;

-- ── Försändelsen ────────────────────────────────────────────────────────────
-- p_lines: [{ "spoi_id": uuid, "qty": tal }]. Mer än det som återstår av en
-- rad avvisas. Fraktbolaget är en kod (postnord, dhl, schenker, bring, ups,
-- fedex, dsv, annat); spårningslänken räknas fram här, aldrig ur anropet.
create or replace function public.registrera_forsandelse(
  p_spo_id uuid, p_carrier text, p_tracking text, p_estimated date,
  p_lines jsonb, p_kalla text default 'manual')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_spo      supplier_purchase_orders;
  v_carrier  text := lower(btrim(coalesce(p_carrier, '')));
  v_nr       text := btrim(coalesce(p_tracking, ''));
  v_ship     uuid;
  v_rad      record;
  v_spoi     supplier_purchase_order_items;
  v_kvar     numeric;
  v_qty      numeric;
  v_lev      text;
  v_mott     text;
  v_antal    int := 0;
begin
  select * into v_spo from supplier_purchase_orders where id = p_spo_id;
  if not found then raise exception 'inköpsordern finns inte'; end if;
  if v_spo.status = 'cancelled' then raise exception 'inköpsordern är annullerad'; end if;
  if v_carrier not in ('postnord','dhl','schenker','bring','ups','fedex','dsv','annat') then
    raise exception 'okänt fraktbolag: %', p_carrier;
  end if;
  if v_nr !~ '^[A-Za-z0-9 -]{4,40}$' then
    raise exception 'spårningsnumret ska vara 4–40 tecken (bokstäver, siffror, mellanslag, bindestreck)';
  end if;
  if p_estimated is not null and (p_estimated < current_date - 1 or p_estimated > current_date + 365) then
    raise exception 'beräknad leverans måste ligga inom ett år';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'ange minst en rad som skickas';
  end if;

  select s.name into v_lev from suppliers s where s.id = v_spo.supplier_id;
  select coalesce(nullif(o.delivery_name, ''), o.customer_company, o.customer_name) into v_mott
    from orders o where o.id = v_spo.order_id;

  insert into shipments (order_id, supplier_id, spo_id, carrier, tracking_number, tracking_url,
                         status, booked_at, shipped_at, estimated_delivery, sender, recipient,
                         shipment_no)
  values (v_spo.order_id, v_spo.supplier_id, v_spo.id, v_carrier, v_nr,
          sparningslank(v_carrier, v_nr), 'in_transit', now(), now(), p_estimated,
          v_lev, v_mott,
          (select coalesce(max(s.shipment_no), 0) + 1 from shipments s where s.order_id = v_spo.order_id))
  returning id into v_ship;

  for v_rad in select * from jsonb_array_elements(p_lines) as e(value)
  loop
    select * into v_spoi from supplier_purchase_order_items
     where id = (v_rad.value->>'spoi_id')::uuid and spo_id = p_spo_id;
    if not found then
      raise exception 'raden % hör inte till inköpsordern', v_rad.value->>'spoi_id';
    end if;
    if v_spoi.order_item_id is null then continue; end if;
    v_qty := nullif(v_rad.value->>'qty', '')::numeric;
    if v_qty is null or v_qty <= 0 then continue; end if;

    select v_spoi.qty - coalesce(sum(si.qty), 0) into v_kvar
      from shipment_items si
      join shipments s on s.id = si.shipment_id
     where si.order_item_id = v_spoi.order_item_id
       and s.status in ('booked', 'in_transit', 'delivered');
    if v_qty > v_kvar then
      raise exception 'rad %: % skickade men bara % återstår', v_spoi.line_no, v_qty, v_kvar;
    end if;

    insert into shipment_items (shipment_id, order_item_id, qty)
    values (v_ship, v_spoi.order_item_id, v_qty);
    v_antal := v_antal + 1;
  end loop;

  if v_antal = 0 then
    raise exception 'ingen rad med antal att skicka';
  end if;

  insert into tracking_events (shipment_id, occurred_at, status, description, source)
  values (v_ship, now(), 'in_transit',
          'Skickad av ' || coalesce(v_lev, 'leverantören'),
          coalesce(nullif(btrim(p_kalla), ''), 'manual'));

  perform uppdatera_orderleverans(v_spo.order_id);
  return v_ship;
end $function$;

revoke all on function public.registrera_forsandelse(uuid, text, text, date, jsonb, text) from public, anon, authenticated;

create or replace function public.admin_registrera_forsandelse(
  p_spo_id uuid, p_carrier text, p_tracking text, p_estimated date, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role(auth.uid(), 'admin') then
    raise exception 'bara administratörer registrerar försändelser här';
  end if;
  return registrera_forsandelse(p_spo_id, p_carrier, p_tracking, p_estimated, p_lines, 'manual');
end $function$;

revoke all on function public.admin_registrera_forsandelse(uuid, text, text, date, jsonb) from public, anon;
grant execute on function public.admin_registrera_forsandelse(uuid, text, text, date, jsonb) to authenticated;

-- ── Token → inköpsorder ─────────────────────────────────────────────────────
create or replace function public.spo_av_leverantorstoken(p_token text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select spo.id
    from supplier_purchase_orders spo
   where length(coalesce(p_token, '')) between 20 and 100
     and spo.leverantor_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and spo.status <> 'cancelled'
$$;

revoke all on function public.spo_av_leverantorstoken(text) from public, anon, authenticated;

-- Vad leverantören ser. Leveransadressen är kundens vid direktleverans
-- (leverantören har inte sagt nej till det), annars vår egen.
create or replace function public.leverantor_inkopsorder(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id   uuid := spo_av_leverantorstoken(p_token);
  v_spo  supplier_purchase_orders;
  v_ord  orders;
  v_sup  suppliers;
  v_direkt boolean;
  v_ftg  jsonb;
begin
  if v_id is null then return null; end if;
  select * into v_spo from supplier_purchase_orders where id = v_id;
  select * into v_ord from orders where id = v_spo.order_id;
  select * into v_sup from suppliers where id = v_spo.supplier_id;
  v_direkt := coalesce(v_sup.allows_dropship, true);

  select coalesce(jsonb_object_agg(replace(c.key, 'company.', ''), c.value), '{}'::jsonb) into v_ftg
    from site_content c where c.key in ('company.name','company.address','company.postal','company.email','company.phone');

  update supplier_purchase_orders set leverantor_lank_oppnad_at = coalesce(leverantor_lank_oppnad_at, now())
   where id = v_id;

  return jsonb_build_object(
    'po_number', v_spo.po_number,
    'status', v_spo.status,
    'datum', v_spo.created_at::date,
    'onskad_leverans', coalesce(v_ord.desired_delivery_date, v_spo.expected_delivery),
    'valuta', v_spo.currency,
    'leverantor', v_sup.name,
    'bekraftad_at', v_spo.ack_received_at,
    'kopare', v_ftg,
    'direktleverans', v_direkt,
    'leverans', case when v_direkt then jsonb_build_object(
        'namn', coalesce(nullif(v_ord.delivery_name, ''), v_ord.customer_company, v_ord.customer_name),
        'gata', v_ord.delivery_street, 'postnr', v_ord.delivery_postal,
        'ort', v_ord.delivery_city, 'land', coalesce(v_ord.delivery_country, 'SE'),
        'kontakt', v_ord.customer_name, 'telefon', v_ord.contact_phone,
        'instruktioner', v_ord.delivery_instructions,
        'marke', concat_ws(' / ', v_spo.po_number, nullif(v_ord.customer_reference, '')))
      else jsonb_build_object(
        'namn', v_ftg->>'name', 'gata', v_ftg->>'address', 'postnr', v_ftg->>'postal',
        'ort', null, 'land', 'SE', 'kontakt', null, 'telefon', v_ftg->>'phone',
        'instruktioner', null, 'marke', v_spo.po_number) end,
    'rader', coalesce((
      select jsonb_agg(jsonb_build_object(
               'spoi_id', i.id, 'line_no', i.line_no, 'sku', i.sku, 'supplier_sku', i.supplier_sku,
               'name', i.name, 'qty', i.qty, 'unit_price', i.unit_purchase_price,
               'ack_qty', i.ack_qty, 'ack_unit_price', i.ack_unit_price,
               'ack_delivery_date', i.ack_delivery_date, 'ack_status', i.ack_status,
               'skickat', coalesce((select sum(si.qty) from shipment_items si
                                      join shipments s on s.id = si.shipment_id
                                     where si.order_item_id = i.order_item_id
                                       and s.status in ('booked','in_transit','delivered')), 0))
             order by i.line_no)
        from supplier_purchase_order_items i
       where i.spo_id = v_id and i.status <> 'cancelled'), '[]'::jsonb),
    'forsandelser', coalesce((
      select jsonb_agg(jsonb_build_object(
               'carrier', s.carrier, 'tracking_number', s.tracking_number,
               'shipped_at', s.shipped_at, 'estimated_delivery', s.estimated_delivery)
             order by s.shipped_at)
        from shipments s where s.spo_id = v_id and s.status <> 'cancelled'), '[]'::jsonb)
  );
end $function$;

revoke all on function public.leverantor_inkopsorder(text) from public;
grant execute on function public.leverantor_inkopsorder(text) to anon, authenticated;

create or replace function public.leverantor_bekrafta(
  p_token text, p_lines jsonb, p_referens text default null, p_not text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid := spo_av_leverantorstoken(p_token);
  v_r  record;
begin
  if v_id is null then raise exception 'länken gäller inte (längre)'; end if;
  select * into v_r from registrera_leverantorsbekraftelse(
    v_id, p_lines, 'leverantorslank', left(p_referens, 100), left(p_not, 1000));
  return jsonb_build_object('worst_level', v_r.worst_level,
    'gron', v_r.antal_gron, 'gul', v_r.antal_gul, 'rod', v_r.antal_rod);
end $function$;

revoke all on function public.leverantor_bekrafta(text, jsonb, text, text) from public;
grant execute on function public.leverantor_bekrafta(text, jsonb, text, text) to anon, authenticated;

create or replace function public.leverantor_forsandelse(
  p_token text, p_carrier text, p_tracking text, p_estimated date, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid := spo_av_leverantorstoken(p_token);
begin
  if v_id is null then raise exception 'länken gäller inte (längre)'; end if;
  return registrera_forsandelse(v_id, p_carrier, p_tracking, p_estimated, p_lines, 'leverantorslank');
end $function$;

revoke all on function public.leverantor_forsandelse(text, text, text, date, jsonb) from public;
grant execute on function public.leverantor_forsandelse(text, text, text, date, jsonb) to anon, authenticated;

commit;

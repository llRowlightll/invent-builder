-- En inköpsorder med obesvarade rader är inte bekräftad.
--
-- HITTAT vid genomgång mot §5:s lista, innan den mergades. register_supplier_ack()
-- klassade bara de rader som fanns MED i svaret och satte sedan inköpsordern
-- till 'acknowledged' så snart ingen av DEM var röd.
--
-- Leverantören svarar inte alltid på allt. Skickar de en bekräftelse på två av
-- fem rader stod inköpsordern som "bekräftad" medan tre rader aldrig fått ett
-- ord -- specens "saknad artikel", och det tysta fallet: ingen hade märkt att
-- de tre saknades förrän leveransen kom ofullständig.
--
-- Nu räknas de obesvarade raderna. Inköpsordern är bekräftad först när VARJE
-- rad fått ett svar och ingen är röd.

begin;

create or replace function uppdatera_inkopsorderstatus(p_spo_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rod    int;
  v_obes   int;
  v_svarat int;
  v_sent   timestamptz;
begin
  select count(*) filter (where i.status = 'blocked'),
         count(*) filter (where i.ack_status is null and i.status <> 'cancelled'),
         count(*) filter (where i.ack_status is not null)
    into v_rod, v_obes, v_svarat
    from supplier_purchase_order_items i
   where i.spo_id = p_spo_id;

  select spo.sent_at into v_sent from supplier_purchase_orders spo where spo.id = p_spo_id;

  update supplier_purchase_orders spo
     set status = case
           when v_svarat = 0 then spo.status
           when v_rod = 0 and v_obes = 0 then 'acknowledged'
           when v_rod > 0 and v_svarat = v_rod and v_obes = 0 then 'rejected'
           else 'partially_acknowledged' end,
         needs_review = (v_rod > 0) or (v_obes > 0 and v_svarat > 0) or (v_sent is null),
         review_reason = nullif(concat_ws('; ',
           case when v_rod > 0 then v_rod || ' rader kräver godkännande' end,
           case when v_obes > 0 and v_svarat > 0 then v_obes || ' rader saknar svar' end,
           case when v_sent is null then 'bekräftelse registrerad utan att inköpsordern skickats härifrån' end), '')
   where spo.id = p_spo_id;
end $$;

revoke all on function uppdatera_inkopsorderstatus(uuid) from public, anon, authenticated;

comment on function uppdatera_inkopsorderstatus is
  'Intern: räknar om inköpsorderns status ur radernas. Bekräftad först när VARJE rad fått svar och ingen är röd.';

-- Båda vägarna räknar om statusen på samma sätt: den som registrerar svaret
-- och den som tar beslutet om en stoppad rad.

create or replace function register_supplier_ack(
  p_spo_id uuid,
  p_lines jsonb,
  p_source text default 'manual',
  p_supplier_reference text default null,
  p_note text default null
)
returns table(ack_id uuid, worst_level text, antal_gron int, antal_gul int, antal_rod int)
language plpgsql
security definer
set search_path to 'public'
as $$
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
begin
  if not has_role(auth.uid(), 'admin') then
    raise exception 'bara administratörer registrerar leverantörsbekräftelser';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'bekräftelsen måste innehålla minst en rad';
  end if;

  select * into v_spo from supplier_purchase_orders where id = p_spo_id;
  if not found then raise exception 'inköpsordern finns inte: %', p_spo_id; end if;
  if v_spo.status = 'cancelled' then raise exception 'inköpsordern är annullerad'; end if;

  select si.price_tolerance_pct, si.delay_tolerance_days into v_ptol, v_dtol
    from supplier_integrations si
   where si.supplier_id = v_spo.supplier_id
   order by si.is_primary desc nulls last
   limit 1;

  insert into supplier_acknowledgements (spo_id, source, registered_by, supplier_reference, raw_payload, note)
  values (p_spo_id, coalesce(nullif(btrim(p_source), ''), 'manual'), auth.uid(),
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
         and status is distinct from 'acknowledged';
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
end $$;

create or replace function godkann_avvikelse(p_spoi_id uuid, p_beslut text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rad supplier_purchase_order_items;
begin
  if not has_role(auth.uid(), 'admin') then
    raise exception 'bara administratörer godkänner avvikelser';
  end if;
  if p_beslut not in ('approve', 'cancel') then
    raise exception 'beslutet måste vara approve eller cancel';
  end if;

  select * into v_rad from supplier_purchase_order_items where id = p_spoi_id;
  if not found then raise exception 'raden finns inte'; end if;
  if v_rad.status <> 'blocked' then
    raise exception 'raden är inte stoppad (status %)', v_rad.status;
  end if;

  if p_beslut = 'approve' then
    -- Att godkänna betyder att LEVERANTÖRENS villkor gäller: antalet och
    -- priset skrivs om till det bekräftade. Originalet finns kvar i
    -- audit-loggen och i bekräftelsens raw_payload.
    update supplier_purchase_order_items
       set status = 'approved',
           approved_by = auth.uid(),
           approved_at = now(),
           qty = coalesce(v_rad.ack_qty, qty),
           unit_purchase_price = coalesce(v_rad.ack_unit_price, unit_purchase_price),
           line_total_ex_vat = round(coalesce(v_rad.ack_qty, qty) * coalesce(v_rad.ack_unit_price, unit_purchase_price), 2)
     where id = p_spoi_id;

    if v_rad.order_item_id is not null then
      update order_items
         set status = 'acknowledged',
             qty = coalesce(v_rad.ack_qty, qty)
       where id = v_rad.order_item_id;
    end if;
  else
    update supplier_purchase_order_items
       set status = 'cancelled', approved_by = auth.uid(), approved_at = now()
     where id = p_spoi_id;
    if v_rad.order_item_id is not null then
      update order_items set status = 'cancelled' where id = v_rad.order_item_id;
    end if;
  end if;

  perform uppdatera_inkopsorderstatus(v_rad.spo_id);
  return p_beslut;
end $$;

commit;

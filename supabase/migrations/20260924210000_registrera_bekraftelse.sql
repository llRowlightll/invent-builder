-- Registrera leverantörens svar, och stoppa raderna som behöver en människa.
--
-- register_supplier_ack() tar leverantörens svar per rad, klassar varje rad med
-- klassificera_avvikelse(), skriver utfallet och rullar upp det till
-- inköpsordern. Grön och gul går vidare automatiskt; RÖD STOPPAR RADEN och
-- väntar på ett godkännande.
--
-- TOLERANSERNA HÄMTAS FRÅN LEVERANTÖREN, inte från ett anrop: en administratör
-- som registrerar ett svar ska inte kunna välja hur strängt det bedöms. Vill
-- man vara mildare mot en viss leverantör ändrar man leverantörens tolerans,
-- och den ändringen hamnar i audit-loggen.
--
-- BEKRÄFTELSE PÅ EN INKÖPSORDER SOM ALDRIG SKICKATS HÄRIFRÅN är tillåten -- i
-- dag mejlas leverantörer för hand -- men den markeras, så det syns att
-- systemet inte sett hela kedjan.
--
-- KUNDENS RAD följer med: grön och gul sätter order_items.status till
-- 'acknowledged' -- ordet finns redan i tabellens check-constraint sedan #275,
-- och det är §6:s kundstatus "Leverantör bekräftad". Triggern loggar det som
-- en statushändelse. Röd rör raden inte: kunden ska inte få "bekräftad" på
-- något som stoppats internt.
--
-- Constrainten fångade det här: jag hittade på ordet 'confirmed' i stället för
-- att läsa vilka ord tabellen redan hade. Därför får inköpsraden nu en egen
-- check-constraint -- nästa gång ska felet komma direkt, inte i ett prov.

begin;

-- Inköpsradens egen ordlista. order_items hade en sedan #275 och den fångade
-- ett påhittat ord direkt; den här saknades.
alter table supplier_purchase_order_items drop constraint if exists spoi_status_check;
alter table supplier_purchase_order_items add constraint spoi_status_check
  check (status in ('pending','confirmed','blocked','approved','cancelled'));

alter table supplier_purchase_order_items drop constraint if exists spoi_ack_status_check;
alter table supplier_purchase_order_items add constraint spoi_ack_status_check
  check (ack_status is null or ack_status in ('gron','gul','rod'));

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
           -- Röd rad stoppas; grön och gul går vidare.
           status = case when v_niva = 'rod' then 'blocked' else 'confirmed' end,
           approved_by = null,
           approved_at = null
     where id = v_spoi.id;

    if v_niva = 'rod' then v_rod := v_rod + 1;
    elsif v_niva = 'gul' then v_gul := v_gul + 1;
    else v_gron := v_gron + 1;
    end if;

    -- Kundens orderrad följer bara med när raden inte stoppats.
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

  -- v_worst, inte OUT-parametern: den hade skuggat kolumnen i UPDATE:n och
  -- gjort satsen till en självtilldelning.
  update supplier_acknowledgements
     set worst_level = v_worst, line_count = v_gron + v_gul + v_rod
   where id = v_ack;

  update supplier_purchase_orders spo
     set ack_received_at = now(),
         status = case
           when v_rod = 0 then 'acknowledged'
           when v_gron + v_gul = 0 then 'rejected'
           else 'partially_acknowledged' end,
         expected_delivery = coalesce(v_max_lev, spo.expected_delivery),
         needs_review = (v_rod > 0) or (spo.sent_at is null),
         review_reason = nullif(concat_ws('; ',
           case when v_rod > 0 then v_rod || ' rader kräver godkännande' end,
           case when spo.sent_at is null then 'bekräftelse registrerad utan att inköpsordern skickats härifrån' end), '')
   where spo.id = p_spo_id;

  ack_id := v_ack; worst_level := v_worst;
  antal_gron := v_gron; antal_gul := v_gul; antal_rod := v_rod;
  return next;
end $$;

revoke all on function register_supplier_ack(uuid, jsonb, text, text, text) from public, anon;
grant execute on function register_supplier_ack(uuid, jsonb, text, text, text) to authenticated;

comment on function register_supplier_ack is
  'Registrerar en leverantörs svar per rad, klassar avvikelserna och stoppar de röda. Toleranserna hämtas från leverantören, aldrig från anropet.';

-- ── Godkännandet: en människa tar beslutet om en röd rad ───────────────────

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

  -- Inköpsordern är klar när ingen rad väntar längre.
  update supplier_purchase_orders spo
     set needs_review = exists (select 1 from supplier_purchase_order_items i
                                 where i.spo_id = spo.id and i.status = 'blocked')
                        or spo.sent_at is null,
         status = case when not exists (select 1 from supplier_purchase_order_items i
                                         where i.spo_id = spo.id and i.status = 'blocked')
                       then 'acknowledged' else spo.status end
   where spo.id = v_rad.spo_id;

  return p_beslut;
end $$;

revoke all on function godkann_avvikelse(uuid, text) from public, anon;
grant execute on function godkann_avvikelse(uuid, text) to authenticated;

comment on function godkann_avvikelse is
  'Människans beslut om en stoppad rad: approve skriver om raden till leverantörens villkor, cancel avbeställer den.';

commit;

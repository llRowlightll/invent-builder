-- En inaktiv leverantör ska synas innan någon försöker skicka.
--
-- HITTAT genom att titta på /admin/leverantorer i webbläsaren. Sidan har hela
-- tiden sagt:
--
--   "Order Engine får inte beställa från en leverantör som inte är aktiv."
--
-- Ingen kod läste suppliers.is_active. Alla åtta leverantörer står som
-- inaktiva, och systemet skapade ändå inköpsordrar åt dem utan ett ord.
-- Påståendet i gränssnittet var inte sant.
--
-- Utskicket stoppas nu i supplier-po (ett HINDER, inte en varning som går att
-- klicka förbi). Här handlar det om att det ska synas tidigare än så: en
-- inköpsorder till en leverantör vi inte aktiverat markeras för granskning
-- direkt när den skapas.
--
-- ATT SKAPA inköpsordern är fortfarande tillåtet. Den är ett utkast, och
-- utkastet är just det som behövs för att se vad som saknas innan avtalet är
-- på plats. Det är att SKICKA den som är oåterkalleligt.

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
  v_aktiv     boolean;
  v_efter     int;
begin
  select spo.sent_at, spo.supplier_id into v_sent, v_leverantor
    from supplier_purchase_orders spo where spo.id = p_spo_id;

  select s.is_active into v_aktiv from suppliers s where s.id = v_leverantor;

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
                        or (v_leverantor is not null and not coalesce(v_aktiv, false))
                        or (v_utan_pris > 0)
                        or (v_efter > 0)
                        -- Ett skäl utan flagga är en varning ingen ser.
                        or (v_sent is null and v_svarat > 0),
         review_reason = nullif(concat_ws('; ',
           case when v_leverantor is null then 'okänd leverantör' end,
           case when v_leverantor is not null and not coalesce(v_aktiv, false)
                then 'leverantören är inte aktiverad' end,
           case when v_utan_pris > 0 then 'inköpspris saknas' end,
           case when v_rod > 0 then v_rod || ' rader kräver godkännande' end,
           case when v_obes > 0 and v_svarat > 0 then v_obes || ' rader saknar svar' end,
           case when v_efter > 0 then v_efter || ' nya orderrader efter att inköpsordern skickades' end,
           case when v_sent is null and v_svarat > 0
                then 'bekräftelse registrerad utan att inköpsordern skickats härifrån' end), '')
   where spo.id = p_spo_id;
end $$;

commit;

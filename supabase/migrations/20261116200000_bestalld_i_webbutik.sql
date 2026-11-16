-- Inköpsorder lagd i leverantörens webbutik (ägarens beslut 2026-11-16).
--
-- Tills tillverkarna svarar köps de första ordrarna i RS företagskonto
-- (webbutiken), inte via mejlad inköpsorder. supplier-po kan bara mejla, och
-- dess spärrar (aktiverad leverantör, beställningsadress) gäller utskicket --
-- inte en order som administratören redan lagt själv.
--
-- Den här funktionen gör samma sak med inköpsordern som ett lyckat utskick:
-- sent_at, sent_to, sent_method och status 'sent'. Kundens spårning
-- (orderns_resa) visar då "Beställd". Bekräftelse och försändelse registreras
-- som förut: "Registrera svar" och "Försändelse" i admin → Order.
--
-- Inget mejl skickas och ingen leverantörslänk skapas.

begin;

create or replace function public.admin_bestalld_i_webbutik(
  p_spo_id uuid, p_kanal text, p_ordernr text)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_spo   supplier_purchase_orders;
  v_kanal text := btrim(coalesce(p_kanal, ''));
  v_nr    text := btrim(coalesce(p_ordernr, ''));
  v_nu    timestamptz := now();
begin
  if not has_role(auth.uid(), 'admin') then
    raise exception 'bara administratörer registrerar beställningar';
  end if;
  if length(v_kanal) < 2 or length(v_kanal) > 80 then
    raise exception 'ange var ordern lades, 2–80 tecken (t.ex. RS Sverige)';
  end if;
  if length(v_nr) > 60 then
    raise exception 'leverantörens ordernummer får vara högst 60 tecken';
  end if;

  -- Låset gör att två klick inte kan registrera samma order två gånger.
  select * into v_spo from supplier_purchase_orders where id = p_spo_id for update;
  if not found then raise exception 'inköpsordern finns inte'; end if;
  if v_spo.status = 'cancelled' then raise exception 'inköpsordern är annullerad'; end if;
  if v_spo.sent_at is not null then
    raise exception 'inköpsordern är redan beställd (%)', coalesce(v_spo.sent_to, v_spo.sent_method, 'okänt hur');
  end if;
  if not exists (select 1 from supplier_purchase_order_items i
                  where i.spo_id = p_spo_id and i.status <> 'cancelled') then
    raise exception 'inköpsordern har inga rader';
  end if;

  update supplier_purchase_orders
     set sent_at = v_nu,
         sent_to = left(v_kanal || case when v_nr <> '' then ', order ' || v_nr else '' end, 160),
         sent_method = 'webbutik',
         status = 'sent',
         leverantor_token_hash = null,
         internal_notes = concat_ws(E'\n', nullif(internal_notes, ''),
           to_char(v_nu at time zone 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI')
             || ' beställd i webbutik: ' || v_kanal
             || case when v_nr <> '' then ' (ordernr ' || v_nr || ')' else '' end)
   where id = p_spo_id;

  perform uppdatera_inkopsorderstatus(p_spo_id);
  return v_nu;
end $function$;

comment on function public.admin_bestalld_i_webbutik(uuid, text, text) is
  'Admin: inköpsordern är lagd i leverantörens webbutik (t.ex. RS). Sätter den som beställd utan mejl; bekräftelse och försändelse registreras som vanligt.';

revoke all on function public.admin_bestalld_i_webbutik(uuid, text, text) from public, anon;
grant execute on function public.admin_bestalld_i_webbutik(uuid, text, text) to authenticated;

-- Granskningsflaggan: en order lagd i en webbutik är inte köpt av
-- tillverkaren, så "leverantören är inte aktiverad" och "okänd leverantör"
-- gäller inte den (vi vet var den köptes). Resten av villkoren är oförändrade
-- från 20260925080000_inaktiv_leverantor_syns.sql.
create or replace function public.uppdatera_inkopsorderstatus(p_spo_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  v_webbutik  boolean;
begin
  select spo.sent_at, spo.supplier_id, coalesce(spo.sent_method = 'webbutik', false)
    into v_sent, v_leverantor, v_webbutik
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
                        or (v_leverantor is null and not v_webbutik)
                        or (v_leverantor is not null and not coalesce(v_aktiv, false) and not v_webbutik)
                        or (v_utan_pris > 0)
                        or (v_efter > 0)
                        or (v_sent is null and v_svarat > 0),
         review_reason = nullif(concat_ws('; ',
           case when v_leverantor is null and not v_webbutik then 'okänd leverantör' end,
           case when v_leverantor is not null and not coalesce(v_aktiv, false) and not v_webbutik
                then 'leverantören är inte aktiverad' end,
           case when v_utan_pris > 0 then 'inköpspris saknas' end,
           case when v_rod > 0 then v_rod || ' rader kräver godkännande' end,
           case when v_obes > 0 and v_svarat > 0 then v_obes || ' rader saknar svar' end,
           case when v_efter > 0 then v_efter || ' nya orderrader efter att inköpsordern skickades' end,
           case when v_sent is null and v_svarat > 0
                then 'bekräftelse registrerad utan att inköpsordern skickats härifrån' end), '')
   where spo.id = p_spo_id;
end $function$;

commit;

-- Momsen följer kunden, inte en fast 25 %.
--
-- Ägaren 2026-11-13: "moms ... koppla till vanlig moms". Kundgranskningen
-- (engelsk, tysk och spansk kund) frågade alla om moms utanför Sverige.
-- Förut var 0,25 hårdkodat i varje funktion som skapar en order.
--
--   Sverige (eller inget land)                     25 %
--   annat EU-land med momsregistreringsnummer     0 %  omvänd betalningsskyldighet
--                                                       (art. 196 mervärdesskattedirektivet)
--   annat EU-land utan momsregistreringsnummer    25 %  (svensk moms)
--   land utanför EU                                0 %  export
--
-- Numret kontrolleras här bara till formen (två bokstäver + 2–12 tecken).
-- Giltigheten i VIES kontrolleras av en människa före offerten.

begin;

create or replace function public.momstyp(p_land text, p_momsnr text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  land text := upper(trim(coalesce(p_land, '')));
  nr   text := upper(regexp_replace(coalesce(p_momsnr, ''), '[^A-Za-z0-9]', '', 'g'));
  eu   text[] := array['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','EL','HU','IE','IT',
                       'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
begin
  if land in ('', 'SE', 'SVERIGE', 'SWEDEN') then return 'sverige'; end if;
  if land = any(eu) then
    if nr ~ '^[A-Z]{2}[0-9A-Z]{2,12}$' and left(nr, 2) <> 'SE' then return 'omvand'; end if;
    return 'eu_utan_nummer';
  end if;
  return 'export';
end $$;

create or replace function public.momssats(p_land text, p_momsnr text)
returns numeric
language sql
immutable
set search_path to 'public'
as $$
  select case public.momstyp(p_land, p_momsnr)
    when 'omvand' then 0::numeric
    when 'export' then 0::numeric
    else 0.25::numeric
  end
$$;

-- Besked för en offert eller en order: sats och typ, inget annat om kunden.
create or replace function public.momsbesked(p_rfq_id uuid default null, p_order_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_land text;
  v_nr   text;
  v_rfq  uuid := p_rfq_id;
begin
  if v_rfq is null and p_order_id is not null then
    select o.rfq_id, coalesce(nullif(o.invoice_country, ''), o.delivery_country)
      into v_rfq, v_land from orders o where o.id = p_order_id;
  end if;
  if v_rfq is not null then
    select coalesce(nullif(r.invoice_country, ''), r.address_country, v_land), r.vat_number
      into v_land, v_nr from rfqs r where r.id = v_rfq;
  end if;
  return jsonb_build_object('sats', momssats(v_land, v_nr), 'typ', momstyp(v_land, v_nr));
end $$;

revoke all on function public.momsbesked(uuid, uuid) from public;
grant execute on function public.momsbesked(uuid, uuid) to anon, authenticated;

-- Ordern får förfrågans moms när den skapas, oavsett vilken väg.
create or replace function public.trg_order_moms()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sats numeric;
begin
  if new.rfq_id is null then return new; end if;
  select momssats(coalesce(nullif(r.invoice_country, ''), r.address_country), r.vat_number)
    into v_sats from rfqs r where r.id = new.rfq_id;
  if v_sats is not null and v_sats is distinct from new.vat_rate then
    new.vat_rate := v_sats;
    if new.total_ex_vat is not null then
      new.total_inc_vat := round(new.total_ex_vat * (1 + v_sats), 2);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists order_moms on public.orders;
create trigger order_moms
  before insert on public.orders
  for each row execute function public.trg_order_moms();

-- Orderraderna följer orderns sats.
create or replace function public.trg_orderrad_moms()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.vat_rate := coalesce((select o.vat_rate from orders o where o.id = new.order_id), new.vat_rate);
  return new;
end $$;

drop trigger if exists orderrad_moms on public.order_items;
create trigger orderrad_moms
  before insert on public.order_items
  for each row execute function public.trg_orderrad_moms();

commit;

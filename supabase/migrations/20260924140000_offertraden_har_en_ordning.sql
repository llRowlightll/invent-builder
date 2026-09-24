-- Offertens rader hade ingen ordning.
--
-- HITTAT av provet: kontroll 38 ("radsumman följer offertens rabatt") föll
-- varannan körning. Orsaken var inte provet.
--
-- respond_to_quote() byggde orderraderna med `order by ri.id`, och rfq_items.id
-- är ett gen_random_uuid(). Sorteringen var alltså SLUMPMÄSSIG: samma offert
-- kunde ge order_items.line_no 1 = första raden en gång och 1 = andra raden
-- nästa gång. get_quote_items() hade ingen ORDER BY alls.
--
-- För kunden betyder det att offerten, orderbekräftelsen och orderraderna
-- kunde lista samma varor i tre olika ordningar. På en stycklista med tolv
-- rader är det inte kosmetiskt -- det är omöjligt att stämma av mot sin egen
-- inköpslista, och det är samma lista som ska bli en inköpsorder hos
-- leverantören.
--
-- rfq_items saknade helt enkelt ett fält för radordningen. Det får det nu, och
-- det sätts ur inköpslistans ordning (jsonb-arrayens ordinality). Gamla rader
-- har null och faller tillbaka på id -- alltså dagens beteende, inte ett nytt.

begin;

alter table public.rfq_items add column if not exists sort_order int;

comment on column public.rfq_items.sort_order is
  'Radens plats i kundens lista, 1 och uppåt. Null på rader skapade före 2026-09-24; de sorteras sist, på id.';

create or replace function public.submit_rfq(
  p_title text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_company text,
  p_org_number text,
  p_po_number text,
  p_message text,
  p_items jsonb,
  p_hp text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq_id uuid;
  -- Ett uuid, och inget annat, får gå vidare till casten.
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  -- Honeypot: a hidden field real users never see or fill. Bots that fill
  -- every input on the form will fill this too.
  if p_hp is not null and p_hp <> '' then
    raise exception 'invalid submission';
  end if;

  if p_contact_name is null or btrim(p_contact_name) = '' then
    raise exception 'contact name is required';
  end if;
  if p_contact_email is null or btrim(p_contact_email) = '' then
    raise exception 'contact email is required';
  end if;

  insert into public.rfqs (
    user_id, status, title, contact_name, contact_email, contact_phone,
    company, org_number, po_number, message
  ) values (
    auth.uid(), 'new', p_title, btrim(p_contact_name), btrim(p_contact_email),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_company, '')), ''),
    nullif(btrim(coalesce(p_org_number, '')), ''),
    nullif(btrim(coalesce(p_po_number, '')), ''),
    nullif(btrim(coalesce(p_message, '')), '')
  )
  returning id into v_rfq_id;

  -- row_number, inte ordinality rakt av: skräprader filtreras bort efteråt och
  -- skulle annars lämna hål i numreringen.
  insert into public.rfq_items (rfq_id, product_id, qty, role, order_code, item_name, sort_order)
  select v_rfq_id, rad.pid, rad.antal, rad.roll, rad.kod, rad.namn,
         (row_number() over (order by rad.plats))::int
  from (
    select
      ord                                                                   as plats,
      case when btrim(coalesce(item->>'product_id','')) ~* c_uuid
           then (btrim(item->>'product_id'))::uuid end                      as pid,
      coalesce((item->>'qty')::int, 1)                                      as antal,
      coalesce(item->>'role', 'ordered')                                    as roll,
      coalesce(
        nullif(btrim(coalesce(item->>'order_code','')), ''),
        -- Inte ett uuid: behåll värdet som kod i stället för att tappa raden.
        case when btrim(coalesce(item->>'product_id','')) !~* c_uuid
             then nullif(btrim(coalesce(item->>'product_id','')), '') end
      )                                                                     as kod,
      nullif(btrim(coalesce(item->>'item_name','')), '')                    as namn
    from jsonb_array_elements(p_items) with ordinality as e(item, ord)
  ) rad
  -- En rad utan både produkt och kod är skräp och hoppas över, precis som förut.
  where rad.pid is not null or rad.kod is not null;

  return v_rfq_id;
end;
$$;

grant execute on function public.submit_rfq(text,text,text,text,text,text,text,text,jsonb,text) to anon, authenticated;

-- Kunden ser raderna i sin egen ordning.
create or replace function public.get_quote_items(p_rfq_id uuid)
returns table(id uuid, qty integer, unit_price numeric, note text, sku text, name text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select ri.id, ri.qty, ri.unit_price, ri.note,
         coalesce(nullif(ri.order_code, ''), p.sku),
         coalesce(nullif(ri.item_name, ''), p.name)
  from public.rfq_items ri
  left join public.products p on p.id = ri.product_id
  where ri.rfq_id = p_rfq_id
  order by ri.sort_order nulls last, ri.id;
$$;

-- Och ordern får raderna i samma ordning som offerten kunden accepterade.
create or replace function public.respond_to_quote(p_id uuid, p_decision text, p_po text default null)
returns table(success boolean, order_id uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_updated int;
  v_rfq public.rfqs;
  v_order_id uuid;
  v_items jsonb;
  v_total_ex numeric;
begin
  if p_decision not in ('accepted','rejected') then
    raise exception 'invalid decision: %', p_decision;
  end if;

  update public.rfqs
     set status = p_decision,
         po_number = coalesce(nullif(btrim(p_po), ''), po_number)
   where id = p_id and status = 'quoted'
   returning * into v_rfq;
  get diagnostics v_updated = row_count;

  if v_updated > 0 and p_decision = 'accepted' then
    -- Radpriset efter offertens rabatt: exakt det kunden såg och accepterade.
    select
      jsonb_agg(jsonb_build_object(
        'product_id', ri.product_id,
        'sku', coalesce(nullif(ri.order_code, ''), p.sku, '—'),
        'name', coalesce(nullif(ri.item_name, ''), p.name, 'Okänd produkt'),
        'qty', ri.qty,
        'unit_price_ex_vat', round(coalesce(ri.unit_price, 0) * (1 - v_rfq.discount_pct / 100), 2),
        'total_price_ex_vat', round(ri.qty * coalesce(ri.unit_price, 0) * (1 - v_rfq.discount_pct / 100), 2),
        'brand', b.name,
        'lead_time_days', p.lead_time_days,
        'note', ri.note
      ) order by ri.sort_order nulls last, ri.id),
      coalesce(sum(ri.qty * coalesce(ri.unit_price, 0) * (1 - v_rfq.discount_pct / 100)), 0)
    into v_items, v_total_ex
    from public.rfq_items ri
    left join public.products p on p.id = ri.product_id
    left join public.brands b on b.id = p.brand_id
    where ri.rfq_id = p_id;

    if v_items is not null and jsonb_array_length(v_items) > 0 then
      v_order_id := create_order_internal(
        jsonb_build_object(
          'user_id',          v_rfq.user_id,
          'rfq_id',           v_rfq.id,
          'customer_name',    coalesce(v_rfq.contact_name, v_rfq.company, 'Okänd kund'),
          'customer_company', v_rfq.company,
          'customer_email',   coalesce(v_rfq.contact_email, ''),
          'customer_org_nr',  v_rfq.org_number,
          'po_number',        v_rfq.po_number,
          'status',           'new',
          'currency',         coalesce(v_rfq.quote_currency, 'SEK'),
          'vat_rate',         0.25,
          'total_ex_vat',     round(v_total_ex, 2),
          'total_inc_vat',    round(v_total_ex * 1.25, 2),
          'idempotency_key',  'rfq:' || v_rfq.id::text
        ),
        v_items);
    end if;
  end if;

  return query select (v_updated > 0), v_order_id;
end $$;

commit;

-- En offertförfrågan och en beställning är två olika saker.
--
-- Kunden hade BARA en knapp: "Begär offert". Accepten av offerten skapade
-- sedan ordern direkt, i ett klick, utan att kunden fått bekräfta något. Det
-- fanns alltså ingen väg att BESTÄLLA, och ingen väg att bara fråga efter
-- priser utan att det till slut blev en order.
--
-- Kundens ord: "om kunden vill ha order så skickas denna som beställning, och
-- när de vill ha offert så är det enbart priser".
--
-- Avsikten hör hemma på FÖRFRÅGAN, inte i ett senare steg: det är när kunden
-- trycker som den vet vad den vill. Därför en kolumn på rfqs, satt av
-- submit_rfq, och därifrån styr den både vad administratören ser och vad
-- kunden får tillbaka.
--
--   intent = 'quote'  kunden vill veta vad det kostar. Svaret är priser.
--                     Kunden kan sedan acceptera -- eller låta bli.
--   intent = 'order'  kunden har beställt. Ingen accept ska efterfrågas igen;
--                     den frågan är redan besvarad.
--
-- VARFÖR EN BESTÄLLNING UTAN PRIS ÄR RIMLIG HÄR: ingen av de 846 produkterna
-- har pris i katalogen, och konfigurerade artiklar har det per definition
-- inte. I B2B är det normalt att lägga order mot avtalade priser och få dem
-- bekräftade. Det onormala var att kalla det en offert.

begin;

alter table public.rfqs add column if not exists intent text not null default 'quote';

alter table public.rfqs drop constraint if exists rfqs_intent_check;
alter table public.rfqs add constraint rfqs_intent_check
  check (intent in ('quote', 'order'));

comment on column public.rfqs.intent is
  'Vad kunden bad om när den tryckte: quote = bara priser, order = en beställning. Sätts av submit_rfq och kan inte ändras av kunden i efterhand.';

create index if not exists rfqs_intent_idx on public.rfqs (intent, status);

-- ── submit_rfq bär avsikten ───────────────────────────────────────────────

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
  p_hp text default '',
  p_intent text default 'quote'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq_id uuid;
  v_intent text := lower(btrim(coalesce(p_intent, 'quote')));
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_hp is not null and p_hp <> '' then
    raise exception 'invalid submission';
  end if;
  if p_contact_name is null or btrim(p_contact_name) = '' then
    raise exception 'contact name is required';
  end if;
  if p_contact_email is null or btrim(p_contact_email) = '' then
    raise exception 'contact email is required';
  end if;
  if v_intent not in ('quote', 'order') then
    raise exception 'intent måste vara quote eller order';
  end if;

  insert into public.rfqs (
    user_id, status, intent, title, contact_name, contact_email, contact_phone,
    company, org_number, po_number, message
  ) values (
    auth.uid(), 'new', v_intent, p_title, btrim(p_contact_name), btrim(p_contact_email),
    nullif(btrim(coalesce(p_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_company, '')), ''),
    nullif(btrim(coalesce(p_org_number, '')), ''),
    nullif(btrim(coalesce(p_po_number, '')), ''),
    nullif(btrim(coalesce(p_message, '')), '')
  )
  returning id into v_rfq_id;

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
        case when btrim(coalesce(item->>'product_id','')) !~* c_uuid
             then nullif(btrim(coalesce(item->>'product_id','')), '') end
      )                                                                     as kod,
      nullif(btrim(coalesce(item->>'item_name','')), '')                    as namn
    from jsonb_array_elements(p_items) with ordinality as e(item, ord)
  ) rad
  where rad.pid is not null or rad.kod is not null;

  return v_rfq_id;
end;
$$;

grant execute on function public.submit_rfq(text,text,text,text,text,text,text,text,jsonb,text,text) to anon, authenticated;

-- EN signatur, inte två. Överlagrade funktioner får PostgREST att svara
-- "could not choose the best candidate function" så fort argumentmängderna kan
-- tolkas på flera sätt. Båda anroparna anger avsikten uttryckligen i stället.
drop function if exists public.submit_rfq(text,text,text,text,text,text,text,text,jsonb,text);

-- ── En beställning ska inte accepteras en gång till ───────────────────────
--
-- respond_to_quote är kundens "Ja, acceptera offert". För en förfrågan som
-- REDAN var en beställning är den frågan besvarad, och att ställa den igen
-- skulle betyda att kunden måste bekräfta sin egen order. Den vägen stängs
-- därför för intent = 'order'; den ordern konverteras av administratören.

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
  v_intent text;
begin
  if p_decision not in ('accepted','rejected') then
    raise exception 'invalid decision: %', p_decision;
  end if;

  select r.intent into v_intent from public.rfqs r where r.id = p_id;
  if v_intent = 'order' then
    raise exception 'det här är en beställning, inte en offert -- den behöver ingen accept';
  end if;

  update public.rfqs
     set status = p_decision,
         po_number = coalesce(nullif(btrim(p_po), ''), po_number)
   where id = p_id and status = 'quoted'
   returning * into v_rfq;
  get diagnostics v_updated = row_count;

  if v_updated > 0 and p_decision = 'accepted' then
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

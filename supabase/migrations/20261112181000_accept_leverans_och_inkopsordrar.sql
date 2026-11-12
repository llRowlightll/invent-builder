-- Offertaccepten samlar in leveransadress och kundens PO som fil, och
-- inköpsordrarna skapas av sig själva när en order kommer in.
--
-- 1. LEVERANSADRESS VID ACCEPT. En offert (intent 'quote') fick aldrig någon
--    leveransadress -- bara beställningar via kassan fick det. Med
--    direktleverans från leverantören står kundens adress på inköpsordern, så
--    en accepterad offert utan adress gick inte att skicka någonstans.
--    respond_to_quote tar nu p_leverans (jsonb) och skriver den på rfq:n
--    innan ordern skapas; ordern ärver den som förut.
--
-- 2. PO SOM FIL. Bucketen kund-po är privat. Vem som helst med offertens
--    länk (rfq-id:t, en uuid som bara står i kundens mejl) kan ladda upp i
--    mappen <rfq_id>/ medan offerten är öppen eller nyss accepterad. Bara
--    admin kan läsa. Sökvägen sparas i rfqs.po_file_path.
--
-- 3. INKÖPSORDRAR AUTOMATISKT. create_supplier_pos krävde ett admin-klick
--    per order. Nu skapas utkasten när ordern sparas (deferred, så att
--    orderraderna finns). SKICKA till leverantören är fortfarande ett klick i
--    admin: det beställer varor för riktiga pengar, och en människa ska ha
--    sett ordern först.

begin;

-- ── 1. Leveransadress vid accept ────────────────────────────────────────────
alter table public.rfqs add column if not exists po_file_path text;

drop function if exists public.respond_to_quote(uuid, text, text);

create or replace function public.respond_to_quote(
  p_id uuid, p_decision text, p_po text default null,
  p_leverans jsonb default null, p_po_fil text default null)
returns table(success boolean, order_id uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_updated int;
  v_rfq public.rfqs;
  v_order_id uuid;
  v_items jsonb;
  v_total_ex numeric;
  v_frakt numeric;
  v_intent text;
  v_l jsonb := coalesce(p_leverans, '{}'::jsonb);
  v_fil text := nullif(btrim(coalesce(p_po_fil, '')), '');
begin
  if p_decision not in ('accepted','rejected') then
    raise exception 'invalid decision: %', p_decision;
  end if;

  select r.intent into v_intent from public.rfqs r where r.id = p_id;
  if v_intent = 'order' then
    raise exception 'det här är en beställning, inte en offert -- den behöver ingen accept';
  end if;

  -- Filen måste ligga i offertens egen mapp.
  if v_fil is not null and v_fil not like p_id::text || '/%' then
    v_fil := null;
  end if;

  update public.rfqs r
     set status = p_decision,
         po_number = coalesce(nullif(btrim(p_po), ''), r.po_number),
         po_file_path = coalesce(v_fil, r.po_file_path),
         delivery_name = coalesce(nullif(left(btrim(v_l->>'namn'), 120), ''), r.delivery_name),
         address_street = coalesce(nullif(left(btrim(v_l->>'gata'), 160), ''), r.address_street),
         address_postal = coalesce(nullif(left(btrim(v_l->>'postnr'), 20), ''), r.address_postal),
         address_city = coalesce(nullif(left(btrim(v_l->>'ort'), 80), ''), r.address_city),
         address_country = coalesce(nullif(left(btrim(v_l->>'land'), 60), ''), r.address_country),
         contact_phone = coalesce(nullif(left(btrim(v_l->>'telefon'), 40), ''), r.contact_phone),
         customer_reference = coalesce(nullif(left(btrim(v_l->>'referens'), 80), ''), r.customer_reference),
         delivery_instructions = coalesce(nullif(left(btrim(v_l->>'instruktioner'), 500), ''), r.delivery_instructions)
   where r.id = p_id and r.status = 'quoted'
   returning * into v_rfq;
  get diagnostics v_updated = row_count;

  if v_updated > 0 and p_decision = 'accepted' then
    v_frakt := round(coalesce(v_rfq.freight_ex_vat, 0), 2);

    select
      jsonb_agg(jsonb_build_object(
        'product_id', ri.product_id,
        'sku', coalesce(nullif(ri.order_code, ''), p.sku, '—'),
        'name', coalesce(nullif(ri.item_name, ''), p.name, 'Okänd produkt'),
        'qty', ri.qty,
        'unit_price_ex_vat', round(coalesce(ri.unit_price, 0) * (1 - coalesce(v_rfq.discount_pct, 0) / 100), 2),
        'total_price_ex_vat', round(ri.qty * coalesce(ri.unit_price, 0) * (1 - coalesce(v_rfq.discount_pct, 0) / 100), 2),
        'brand', b.name,
        'lead_time_days', p.lead_time_days,
        'note', ri.note
      ) order by ri.sort_order nulls last, ri.id),
      coalesce(sum(ri.qty * coalesce(ri.unit_price, 0) * (1 - coalesce(v_rfq.discount_pct, 0) / 100)), 0)
    into v_items, v_total_ex
    from public.rfq_items ri
    left join public.products p on p.id = ri.product_id
    left join public.brands b on b.id = p.brand_id
    where ri.rfq_id = p_id;

    v_total_ex := v_total_ex + v_frakt;

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
          'freight_ex_vat',   case when v_frakt > 0 then v_frakt end,
          'idempotency_key',  'rfq:' || v_rfq.id::text,
          'delivery_name',    v_rfq.delivery_name,
          'delivery_street',  v_rfq.address_street,
          'delivery_postal',  v_rfq.address_postal,
          'delivery_city',    v_rfq.address_city,
          'delivery_country', v_rfq.address_country,
          'invoice_street',   v_rfq.invoice_street,
          'invoice_postal',   v_rfq.invoice_postal,
          'invoice_city',     v_rfq.invoice_city,
          'invoice_country',  v_rfq.invoice_country,
          'invoice_email',    v_rfq.invoice_email,
          'contact_phone',    v_rfq.contact_phone,
          'desired_delivery_date', v_rfq.desired_delivery_date,
          'delivery_instructions', v_rfq.delivery_instructions,
          'delivery_mode',    v_rfq.delivery_mode,
          'customer_reference', v_rfq.customer_reference
        ),
        v_items);
    end if;
  end if;

  return query select (v_updated > 0), v_order_id;
end $function$;

revoke all on function public.respond_to_quote(uuid, text, text, jsonb, text) from public;
grant execute on function public.respond_to_quote(uuid, text, text, jsonb, text) to anon, authenticated;

-- ── 2. PO som fil ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kund-po', 'kund-po', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.offert_tar_emot_po(p_mapp text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from rfqs r
     where r.id::text = p_mapp
       and (r.status = 'quoted' or (r.status = 'accepted' and r.updated_at > now() - interval '1 day')))
$$;

revoke all on function public.offert_tar_emot_po(text) from public;
grant execute on function public.offert_tar_emot_po(text) to anon, authenticated;

drop policy if exists "kund-po: ladda upp till öppen offert" on storage.objects;
create policy "kund-po: ladda upp till öppen offert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'kund-po' and public.offert_tar_emot_po((storage.foldername(name))[1]));

drop policy if exists "kund-po: admin läser" on storage.objects;
create policy "kund-po: admin läser" on storage.objects
  for select to authenticated
  using (bucket_id = 'kund-po' and public.has_role((select auth.uid()), 'admin'));

-- ── 3. Inköpsordrar automatiskt ─────────────────────────────────────────────
-- Samma kropp som create_supplier_pos (20260924160000 m.fl.) utan
-- admin-kontrollen; create_supplier_pos är kvar som admin-knappen.
create or replace function public.skapa_inkopsordrar(p_order_id uuid)
returns table(spo_id uuid, po_number text, supplier text, antal_rader integer, needs_review boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rad      record;
  v_spo      uuid;
  v_key      text;
  v_status   text;
  v_saknade  int;
  v_okand    constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if not exists (select 1 from orders where id = p_order_id) then
    raise exception 'ordern finns inte: %', p_order_id;
  end if;

  update order_items oi
     set intended_supplier_id = coalesce(
           oi.intended_supplier_id,
           (select sp.supplier_id from supplier_products sp
             where sp.product_id = oi.product_id
             order by sp.is_preferred desc nulls last, sp.purchase_price asc nulls last
             limit 1),
           (select s.id from products p
              join brands b on b.id = p.brand_id
              join suppliers s on s.slug = b.slug
             where p.id = oi.product_id))
   where oi.order_id = p_order_id;

  for v_rad in
    select oi.intended_supplier_id as sup
      from order_items oi
     where oi.order_id = p_order_id
     group by oi.intended_supplier_id
     order by oi.intended_supplier_id nulls last
  loop
    v_spo := null;
    v_key := 'order:' || p_order_id::text || ':sup:' || coalesce(v_rad.sup, v_okand)::text;

    select spo.id, spo.status into v_spo, v_status
      from supplier_purchase_orders spo where spo.idempotency_key = v_key;

    if v_spo is null then
      insert into supplier_purchase_orders (
        order_id, supplier_id, status, integration_method, currency,
        expected_delivery, needs_review, idempotency_key)
      values (
        p_order_id, v_rad.sup, 'draft',
        (select si.method from supplier_integrations si
          where si.supplier_id = v_rad.sup
          order by si.is_primary desc nulls last limit 1),
        coalesce((select s.currency from suppliers s where s.id = v_rad.sup), 'SEK'),
        case when (select s.default_lead_time_days from suppliers s where s.id = v_rad.sup) is not null
             then (current_date + ((select s.default_lead_time_days from suppliers s where s.id = v_rad.sup) || ' days')::interval)::date
        end,
        false, v_key)
      returning id, status into v_spo, v_status;
    end if;

    select count(*)::int into v_saknade
      from order_items oi
     where oi.order_id = p_order_id
       and oi.intended_supplier_id is not distinct from v_rad.sup
       and not exists (select 1 from supplier_purchase_order_items i
                        where i.spo_id = v_spo and i.order_item_id = oi.id);

    if v_saknade > 0 and v_status = 'draft' then
      insert into supplier_purchase_order_items (
        spo_id, order_item_id, line_no, sku, supplier_sku, name, qty,
        unit_purchase_price, line_total_ex_vat)
      select v_spo, oi.id,
             (coalesce((select max(i.line_no) from supplier_purchase_order_items i where i.spo_id = v_spo), 0)
              + row_number() over (order by oi.line_no))::int,
             oi.sku, sp.supplier_sku, oi.name, oi.qty,
             coalesce(sp.purchase_price, pr.purchase_price),
             round(oi.qty * coalesce(sp.purchase_price, pr.purchase_price), 2)
        from order_items oi
        left join products pr on pr.id = oi.product_id
        left join lateral (
          select sp.* from supplier_products sp
           where sp.product_id = oi.product_id and sp.supplier_id = oi.intended_supplier_id
           order by sp.is_preferred desc nulls last limit 1) sp on true
       where oi.order_id = p_order_id
         and oi.intended_supplier_id is not distinct from v_rad.sup
         and not exists (select 1 from supplier_purchase_order_items i
                          where i.spo_id = v_spo and i.order_item_id = oi.id);
    end if;

    perform uppdatera_inkopsorderstatus(v_spo);

    spo_id := v_spo;
    supplier := coalesce((select s.name from suppliers s where s.id = v_rad.sup), 'Okänd leverantör');
    antal_rader := (select count(*)::int from supplier_purchase_order_items i where i.spo_id = v_spo);
    select spo.po_number, spo.needs_review into po_number, needs_review
      from supplier_purchase_orders spo where spo.id = v_spo;
    return next;
  end loop;
end $function$;

revoke all on function public.skapa_inkopsordrar(uuid) from public, anon, authenticated;

create or replace function public.create_supplier_pos(p_order_id uuid)
returns table(spo_id uuid, po_number text, supplier text, antal_rader integer, needs_review boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not has_role(auth.uid(), 'admin') then
    raise exception 'bara administratörer skapar inköpsordrar';
  end if;
  return query select * from skapa_inkopsordrar(p_order_id);
end $function$;

create or replace function public.trg_order_skapar_inkopsordrar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'cancelled' then return null; end if;
  begin
    perform skapa_inkopsordrar(new.id);
  exception when others then
    -- En order får aldrig fastna på inköpsordrarna; admin-knappen finns kvar.
    raise warning 'inköpsordrar för order % skapades inte: %', new.id, sqlerrm;
  end;
  return null;
end $function$;

drop trigger if exists order_skapar_inkopsordrar on public.orders;
create constraint trigger order_skapar_inkopsordrar
  after insert on public.orders
  deferrable initially deferred
  for each row execute function public.trg_order_skapar_inkopsordrar();

commit;

-- En trasig rad får inte fälla hela offertförfrågan.
--
-- HITTAT när konfiguratorns knapp kopplades in: projects.tsx rad 87 anropar
--
--     addToShoppingList({ id: line.sku, sku: line.sku, ... })
--
-- alltså SKU:n som produkt-id. En sparad maskins stycklista bär bara SKU --
-- den har inget produkt-id att skicka. submit_rfq gjorde
-- `(item->>'product_id')::uuid` rakt av, så "FESTO-DSNU" gav 22P02 och HELA
-- offertförfrågan dog. Kunden såg "Kunde inte skicka förfrågan. Försök igen."
-- och kunde försöka hur många gånger som helst.
--
-- Anroparen rättas också (den slår upp produkten först), men funktionen ska
-- tåla det ändå: en kund som lagt fem rader ska inte förlora alla fem för att
-- en av dem bär fel sorts id. Värdet BEVARAS som orderkod i stället för att
-- kastas -- då ser administratören exakt vad som skickades.

begin;

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

  insert into public.rfq_items (rfq_id, product_id, qty, role, order_code, item_name)
  select v_rfq_id, rad.pid, rad.antal, rad.roll, rad.kod, rad.namn
  from (
    select
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
    from jsonb_array_elements(p_items) as item
  ) rad
  -- En rad utan både produkt och kod är skräp och hoppas över, precis som förut.
  where rad.pid is not null or rad.kod is not null;

  return v_rfq_id;
end;
$$;

grant execute on function public.submit_rfq(text,text,text,text,text,text,text,text,jsonb,text) to anon, authenticated;

commit;

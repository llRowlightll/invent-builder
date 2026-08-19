-- Found 2026-08-19 while investigating a reported guest-login inconsistency:
-- two separate, more serious bugs were hiding underneath it.
--
-- 1. machine-builder.tsx was already trying to support anonymous RFQs
--    (user_id made nullable, `authUser?.id ?? null` in the insert) but the
--    "users insert own rfqs" RLS policy still requires auth.uid() = user_id,
--    which a null user_id can never satisfy. Confirmed against real data:
--    zero rfqs rows have ever had a null user_id. Every real guest attempt
--    has been failing with a generic "please try again" error, forever.
--
-- 2. rfq_items has RLS enabled with only "owner select" and "admin all"
--    policies (added 2026-08-18 to fix a *read* gap) -- there has never been
--    an INSERT policy letting a customer (guest OR logged in) add their own
--    RFQ's line items. Confirmed against real data: all 3 existing rfqs rows
--    have item_count = 0. Neither shopping-list.tsx nor machine-builder.tsx
--    checked the error from that insert call, so this has been silently
--    dropping every submitted product list since the RLS policies were
--    tightened -- the customer sees "request sent", the admin gets an RFQ
--    with contact info and zero items, forever, for every submission.
--
-- Fix: one SECURITY DEFINER function that creates the rfq + its items
-- atomically, for anon and authenticated callers alike. user_id is always
-- derived server-side from auth.uid() (never client-supplied, so there's no
-- spoofing surface at all, stricter than the direct-insert pattern it
-- replaces). Bypassing RLS via security definer means rfq_items doesn't need
-- a public INSERT policy just for this -- the function is the only door in,
-- which also gives us one place to reject honeypot-tripped bot submissions.
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

  insert into public.rfq_items (rfq_id, product_id, qty, role)
  select v_rfq_id, (item->>'product_id')::uuid, coalesce((item->>'qty')::int, 1), coalesce(item->>'role', 'ordered')
  from jsonb_array_elements(p_items) as item
  where item->>'product_id' is not null;

  return v_rfq_id;
end;
$$;

grant execute on function public.submit_rfq(text,text,text,text,text,text,text,text,jsonb,text) to anon, authenticated;

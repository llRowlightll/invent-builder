-- Narrow the two anonymous capability-URL RPCs to the columns their pages
-- actually render.
--
-- Found 2026-09-08 (security review). /offert/:rfqId and /oc/:orderId are
-- deliberately public: the admin emails the link and the unguessable UUID is
-- the bearer token. That design is fine and stays exactly as it is -- a
-- previous hardening pass already stopped anon from SELECTing the rfqs /
-- rfq_items / orders tables directly, which killed enumeration.
--
-- What it did NOT fix is over-fetching. Both RPCs are `SELECT *`:
--   get_quote_by_id  RETURNS SETOF rfqs   -- 34 columns; the page declares 11
--   get_order_by_id  RETURNS SETOF orders -- 31 columns; the page declares 13
-- so every unauthenticated request for a quote or order confirmation shipped
-- the whole row to the browser, including columns the UI never renders:
--
--   rfqs   -> internal_notes, message, user_id, bom_id, vat_number,
--             address_street/postal/city/country, hubspot_contact_id,
--             hubspot_deal_id, fortnox_order_id, integration_error,
--             integration_synced_at, shipment_status, carrier,
--             tracking_number, tracking_code, label_url, shipped_at,
--             estimated_delivery, title, updated_at
--   orders -> internal_notes, invoice_number, invoice_url, invoice_date,
--             invoice_due_date, fortnox_invoice_id, payment_status, paid_at,
--             user_id, project_id, rfq_id, peppol_id, vat_rate,
--             tracking_number, carrier, shipped_at, delivered_at, updated_at
--
-- internal_notes is the one that matters most: whatever staff write about a
-- deal went straight to the customer's browser (and to anyone the link is
-- forwarded to, or who finds it in history/logs) in the raw JSON, invisibly.
-- The CRM/accounting ids and invoice_url are the same class of leak.
--
-- Verified before writing this: get_quote_by_id has exactly one caller
-- (offert.$rfqId.tsx:62) and get_order_by_id exactly one (oc.$orderId.tsx:61),
-- and neither page reads any of the columns removed here -- the only greps
-- that matched were Tailwind `tracking-*` class names. The column lists below
-- are precisely each page's own Rfq / Order type.
--
-- Return type changes, so these need DROP + CREATE rather than CREATE OR
-- REPLACE. Migrations run in a transaction, so there is no window where the
-- function is missing. PostgREST returns a TABLE-returning function as an
-- array of objects, the same shape SETOF returned, so `Array.isArray(r)
-- ? r[0] : null` in both pages keeps working unchanged.

drop function if exists public.get_quote_by_id(uuid);

create function public.get_quote_by_id(p_id uuid)
returns table (
  id uuid,
  contact_name text,
  contact_email text,
  company text,
  org_number text,
  po_number text,
  status text,
  quote_amount numeric,
  quote_currency text,
  discount_pct numeric,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select r.id, r.contact_name, r.contact_email, r.company, r.org_number,
         r.po_number, r.status, r.quote_amount, r.quote_currency,
         r.discount_pct, r.created_at
  from public.rfqs r
  where r.id = p_id;
$$;

grant execute on function public.get_quote_by_id(uuid) to anon, authenticated;

drop function if exists public.get_order_by_id(uuid);

create function public.get_order_by_id(p_id uuid)
returns table (
  id uuid,
  customer_name text,
  customer_company text,
  customer_email text,
  customer_org_nr text,
  po_number text,
  status text,
  items jsonb,
  total_ex_vat numeric,
  total_inc_vat numeric,
  currency text,
  estimated_delivery date,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select o.id, o.customer_name, o.customer_company, o.customer_email,
         o.customer_org_nr, o.po_number, o.status, o.items, o.total_ex_vat,
         o.total_inc_vat, o.currency, o.estimated_delivery, o.created_at
  from public.orders o
  where o.id = p_id;
$$;

grant execute on function public.get_order_by_id(uuid) to anon, authenticated;

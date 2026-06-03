-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: the HubSpot webhook trigger blocked (and broke) customer RFQ submission.
--
-- notify_hubspot_on_rfq() built its URL from current_setting('app.supabase_url'),
-- which is NOT configured on this database. That made the URL NULL, so
-- net.http_post() failed the NOT NULL constraint on net.http_request_queue.url —
-- and because that runs inside the INSERT's transaction, the customer's RFQ
-- insert was rolled back entirely. (Consistent with 0 rows in public.rfqs.)
--
-- Two robustness fixes:
--   1. Opt-in: if app.supabase_url is unset/empty, skip the webhook (HubSpot is
--      simply not wired up yet) instead of failing.
--   2. Non-blocking: wrap the POST in an exception block so a webhook/network
--      failure can NEVER roll back the RFQ itself.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_hubspot_on_rfq()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_url text := current_setting('app.supabase_url', true);
  payload  jsonb;
begin
  -- HubSpot sync is opt-in — only fire once the function URL is configured.
  if base_url is null or base_url = '' then
    return new;
  end if;

  payload := jsonb_build_object(
    'rfq_id',        new.id,
    'contact_name',  new.contact_name,
    'contact_email', new.contact_email,
    'company',       new.company,
    'message',       new.message,
    'created_at',    new.created_at
  );

  -- A webhook must never block the customer's RFQ. Swallow any failure.
  begin
    perform net.http_post(
      url     := base_url || '/functions/v1/hubspot-sync',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-hook-secret', 'maskinval-hubspot'
      ),
      body    := payload
    );
  exception when others then
    raise warning 'hubspot sync skipped for rfq %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

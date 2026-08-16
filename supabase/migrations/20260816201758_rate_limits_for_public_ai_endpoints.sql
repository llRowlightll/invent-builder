-- Rate limiting for public (verify_jwt: false) AI edge functions that have no
-- auth-shaped fix available (ai-search, document-ai are legitimately callable
-- by anonymous visitors) but were otherwise wide open to unlimited free calls
-- against paid Groq/Anthropic quota. Keyed by "<function>:<caller-ip>" from
-- the edge function side; this table only ever needs to be reached via the
-- service-role client inside an edge function, never directly from a browser.

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null default 1
);

alter table public.rate_limits enable row level security;
-- No policies: RLS with zero policies denies all access under the anon/
-- authenticated roles; only the service-role client (which bypasses RLS
-- entirely) can read or write this table.

-- Atomic fixed-window counter. Returns true if the call is within p_limit for
-- the current p_window_seconds-wide window, false if it should be rejected.
-- The upsert + CASE keeps "increment within window" and "reset on a new
-- window" race-safe under concurrent calls for the same key.
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key) do update
    set count = case
          when rate_limits.window_start = v_window_start then rate_limits.count + 1
          else 1
        end,
        window_start = v_window_start
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

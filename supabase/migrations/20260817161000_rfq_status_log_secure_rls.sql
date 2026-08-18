-- rfq_status_log was left with placeholder policies from before this table
-- was ever wired into the app: SELECT true / INSERT true for the public role
-- -- readable AND writable by anyone, unauthenticated, with no scoping to the
-- RFQ's owner at all. That includes internal_message, an admin-only field.
-- Now that this table is going live (customer status-inquiry feature), close
-- this properly:
--   - admins get full access (mirrors the "X: admin all" pattern already
--     used on orders/claims)
--   - customers get NO direct table access at all -- they read through
--     get_rfq_status_log() (SECURITY DEFINER, returns only the customer-safe
--     columns for rows on RFQs they own, never internal_message) and write
--     through the rfq-status-request edge function (service-role, verifies
--     ownership server-side before inserting) -- same trust model already
--     used for get_order_by_id / order-status-email elsewhere in this app.
drop policy if exists "log_insert_all" on public.rfq_status_log;
drop policy if exists "log_readable_all" on public.rfq_status_log;

create policy "rfq_status_log: admin all" on public.rfq_status_log
  for all
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create or replace function public.get_rfq_status_log(p_rfq_id uuid)
returns table (
  id uuid,
  status text,
  message text,
  estimated_next text,
  triggered_by text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.rfqs
    where id = p_rfq_id
      and (user_id = auth.uid() or has_role(auth.uid(), 'admin'))
  ) then
    return;
  end if;

  return query
    select l.id, l.status, l.message, l.estimated_next, l.triggered_by, l.created_at
    from public.rfq_status_log l
    where l.rfq_id = p_rfq_id
      and l.message is not null
    order by l.created_at asc;
end;
$$;

grant execute on function public.get_rfq_status_log(uuid) to authenticated;

-- Found by the new customer-flow test suite on its first real run: the
-- function's own RETURNS TABLE(id uuid, ...) implicitly declares "id" as a
-- PL/pgSQL variable throughout the function body, colliding with rfqs.id in
-- the unqualified "where id = p_rfq_id" ownership check -- Postgres error
-- 42702, "column reference id is ambiguous". Qualify it.
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
    where rfqs.id = p_rfq_id
      and (rfqs.user_id = auth.uid() or has_role(auth.uid(), 'admin'))
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

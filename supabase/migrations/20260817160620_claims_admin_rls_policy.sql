-- The claims table had only owner-scoped policies (insert own, select own,
-- update own WHILE status='open'). No admin policy existed at all, which
-- would have made the new admin claims-management page silently show almost
-- nothing and silently fail every save under RLS -- the same failure class
-- found earlier on rfqs (RLS-blocked writes are indistinguishable from "does
-- nothing" from the caller's perspective). Mirrors the exact pattern already
-- proven on orders ("orders: admin all").
create policy "claims: admin all" on public.claims
  for all
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

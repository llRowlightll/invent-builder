-- Found while double-checking the submit_rfq() fix (PR #124): bom.$bomId.tsx
-- has a THIRD, independent code path that inserts into rfq_items directly
-- (createRfq(), always authenticated -- this page redirects to /login
-- otherwise). Confirmed this specific path is currently unreachable in
-- practice (0 rows in boms, 0 rfqs with a non-null bom_id, nothing in the
-- codebase creates a boms row) -- not an active data-loss risk today, unlike
-- the two paths fixed in submit_rfq(). Still worth closing properly rather
-- than leaving a second, different flavor of the same gap sitting in the
-- schema: this page's rfqs insert is already correctly authenticated and
-- error-checked, so unlike the anonymous-capable flows it doesn't need the
-- security-definer RPC -- it just needs the ownership-scoped INSERT policy
-- that was never added alongside "rfq_items: owner select".
create policy "rfq_items: owner insert" on public.rfq_items
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.rfqs
      where rfqs.id = rfq_items.rfq_id
        and rfqs.user_id = auth.uid()
    )
  );

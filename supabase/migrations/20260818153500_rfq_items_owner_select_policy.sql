-- Found via a routine security-advisor sweep: rfq_items has RLS enabled with
-- ZERO policies, meaning no role except service-role can read it at all --
-- not even the RFQ's own owner. rfq.$rfqId.tsx queries this table directly
-- as the logged-in customer to show their RFQ's item list; with no policy,
-- that call silently returns empty every time. The table happens to be
-- empty right now (no real RFQ has gone through the system yet), so this
-- hasn't visibly broken anything yet -- but it would for the first one that
-- does. rfq_items has no user_id column, so ownership is checked via the
-- parent rfqs row, mirroring how rfq_status_log's function checks ownership.
create policy "rfq_items: owner select" on public.rfq_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.rfqs
      where rfqs.id = rfq_items.rfq_id
        and rfqs.user_id = auth.uid()
    )
  );

create policy "rfq_items: admin all" on public.rfq_items
  for all
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

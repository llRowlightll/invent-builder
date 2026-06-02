-- ─────────────────────────────────────────────────────────────────────────────
-- Admin review fixes (applied to prod).
--
-- 1) availability — there is no live supplier stock API, so claiming products are
--    "in stock" was misleading. Normalize the 6 inconsistent values
--    (stock/in_stock/fast/on_request/standard/order) to a single honest 'order'.
--
-- 2) company_profiles — the CRM (admin.crm) reads `select * from company_profiles`,
--    but the table only had own-row policies (auth.uid() = id), so an admin saw
--    only their own profile, never the registered customers. Add an admin read-all
--    policy (same pattern as products).
-- ─────────────────────────────────────────────────────────────────────────────

update public.products set availability = 'order' where availability is distinct from 'order';

create policy "admin read all company_profiles"
  on public.company_profiles for select to authenticated
  using (exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
  ));

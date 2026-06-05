-- Final advisor cleanup: FK covering indexes, drop dead legacy indexes, and
-- consolidate duplicate permissive policies where it is provably
-- semantics-preserving. All auth.uid() calls stay wrapped in (select ...) so we
-- don't reintroduce the init-plan warning.

-- 1) Covering indexes for foreign keys (active tables only) -------------------
create index if not exists idx_advisor_contacts_user_id on public.advisor_contacts (user_id);
create index if not exists idx_audit_log_user_id on public.audit_log (user_id);
create index if not exists idx_bom_items_bom_id on public.bom_items (bom_id);
create index if not exists idx_bom_items_product_id on public.bom_items (product_id);
create index if not exists idx_boms_session_id on public.boms (session_id);
create index if not exists idx_claims_user_id on public.claims (user_id);
create index if not exists idx_competitor_map_competitor_product_id on public.competitor_map (competitor_product_id);
create index if not exists idx_config_rules_schema_id on public.config_rules (schema_id);
create index if not exists idx_configurator_param_values_param_id on public.configurator_param_values (param_id);
create index if not exists idx_expenses_created_by on public.expenses (created_by);
create index if not exists idx_orders_project_id on public.orders (project_id);
create index if not exists idx_orders_rfq_id on public.orders (rfq_id);
create index if not exists idx_product_accessories_family_id on public.product_accessories (family_id);
create index if not exists idx_product_docs_family_id on public.product_docs (family_id);
create index if not exists idx_product_relations_related_product_id on public.product_relations (related_product_id);
create index if not exists idx_projects_bom_id on public.projects (bom_id);
create index if not exists idx_rfq_items_product_id on public.rfq_items (product_id);
create index if not exists idx_rfq_items_rfq_id on public.rfq_items (rfq_id);
create index if not exists idx_rfqs_bom_id on public.rfqs (bom_id);
create index if not exists idx_shipments_rfq_id on public.shipments (rfq_id);
create index if not exists idx_site_content_updated_by on public.site_content (updated_by);

-- 2) Drop unused indexes on dead legacy tables --------------------------------
drop index if exists public.idx_products_brand;     -- products_core (legacy)
drop index if exists public.idx_products_category;  -- products_core (legacy)
drop index if exists public.idx_relations_from;     -- product_relations_old
drop index if exists public.idx_usecase_cat;        -- use_case_map_old

-- 3) Consolidate duplicate permissive policies (semantics-preserving) ---------

-- products: "public read products" (active only) + "admin read all products"
-- overlap on authenticated SELECT. Fold admin into the public policy: anon sees
-- active, admins see everything, non-admins see active — identical result.
drop policy if exists "admin read all products" on public.products;
alter policy "public read products" on public.products
  using (
    (status = 'active'::text)
    or (exists (select 1 from public.user_roles
                where user_roles.user_id = (select auth.uid())
                  and user_roles.role = 'admin'::app_role))
  );

-- company_profiles: own-read + admin-read-all overlap on SELECT. Fold admin in.
drop policy if exists "admin read all company_profiles" on public.company_profiles;
alter policy "profiles own read" on public.company_profiles
  using (
    ((select auth.uid()) = id)
    or (exists (select 1 from public.user_roles
                where user_roles.user_id = (select auth.uid())
                  and user_roles.role = 'admin'::app_role))
  );

-- projects: "projects: admin all" (FOR ALL) overlaps every per-command owner
-- policy. Owner policies already cover all four commands, so drop admin-all and
-- OR has_role(admin) into each owner policy — admins keep full access.
drop policy if exists "projects: admin all" on public.projects;
alter policy "projects: owner read" on public.projects
  using (((select auth.uid()) = user_id) or has_role((select auth.uid()), 'admin'::text));
alter policy "projects: owner insert" on public.projects
  with check (((select auth.uid()) = user_id) or has_role((select auth.uid()), 'admin'::text));
alter policy "projects: owner update" on public.projects
  using (((select auth.uid()) = user_id) or has_role((select auth.uid()), 'admin'::text))
  with check (((select auth.uid()) = user_id) or has_role((select auth.uid()), 'admin'::text));
alter policy "projects: owner delete" on public.projects
  using (((select auth.uid()) = user_id) or has_role((select auth.uid()), 'admin'::text));

-- users_profile: "users upsert own profile" (FOR ALL, USING uid=user_id) already
-- governs SELECT with the same condition as "users read own profile" -> the read
-- policy is fully redundant.
drop policy if exists "users read own profile" on public.users_profile;

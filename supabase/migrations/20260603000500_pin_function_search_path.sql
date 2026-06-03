-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening: pin search_path on functions flagged by the Supabase linter
-- (function_search_path_mutable).
--
-- A mutable search_path lets the caller's session search_path influence how
-- unqualified names resolve inside SECURITY DEFINER / trigger functions — a
-- classic privilege-escalation vector. Pin the flagged functions to `public`.
--
-- Done dynamically so signatures/overloads need not be hardcoded (e.g. there are
-- two has_role overloads — only the one not already pinned is touched).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at','update_claims_updated_at','update_rfqs_updated_at',
        'generate_customer_number','fn_audit_log','auto_assign_admin',
        'refresh_customer_score','on_auth_user_created','search_knowledge','has_role'
      )
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
      )
  loop
    execute format('alter function public.%I(%s) set search_path = public', r.proname, r.args);
  end loop;
end $$;

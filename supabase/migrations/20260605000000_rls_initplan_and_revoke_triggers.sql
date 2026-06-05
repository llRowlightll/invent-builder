-- Backend hardening from Supabase advisors.
--
-- 1) auth_rls_initplan (performance, 37 policies): wrap auth.uid()/auth.role()/
--    auth.jwt() in (select ...) so Postgres evaluates them once per query
--    (init-plan) instead of re-evaluating per row. Done generically for every
--    public policy that still uses a bare auth.*() call, preserving each
--    policy's name, command, roles, and logic.
--
-- 2) SECURITY DEFINER trigger functions exposed on the RPC surface: revoke
--    EXECUTE so anon/authenticated cannot call them via /rest/v1/rpc. These
--    are trigger-only functions; triggers fire regardless of EXECUTE grants,
--    so this does not affect auditing, the signup hook, or score refresh.

-- 1) auth_rls_initplan ---------------------------------------------------------
do $$
declare
  r record;
  stmt text;
begin
  for r in
    select policyname, schemaname, tablename, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ~ 'auth\.(uid|role|jwt)\(\)' or with_check ~ 'auth\.(uid|role|jwt)\(\)')
  loop
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then
      stmt := stmt || ' using (' ||
        regexp_replace(r.qual, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g') || ')';
    end if;
    if r.with_check is not null then
      stmt := stmt || ' with check (' ||
        regexp_replace(r.with_check, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g') || ')';
    end if;
    execute stmt;
  end loop;
end $$;

-- 2) revoke RPC access to trigger-only functions -------------------------------
revoke execute on function public.fn_audit_log() from anon, authenticated, public;
revoke execute on function public.on_auth_user_created() from anon, authenticated, public;
revoke execute on function public.refresh_score_on_rfq() from anon, authenticated, public;

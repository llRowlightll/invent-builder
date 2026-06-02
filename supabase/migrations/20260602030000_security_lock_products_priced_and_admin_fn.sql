-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening (found in an admin/security review).
--
-- 1) products_priced — a SECURITY DEFINER view exposing purchase_price + margin +
--    a computed selling_price. It was granted to anon/authenticated and bypassed
--    the RLS/grants that protect those columns on the base products table, so the
--    public anon key (shipped in the browser) could read the entire cost structure.
--    The view is unused by the app. Revoke public access and make it SECURITY
--    INVOKER so it can never bypass the caller's permissions again.
--
-- 2) auto_assign_admin() — a trigger function that was also EXECUTE-granted to the
--    public roles (exposed as an RPC). Calling it directly is a no-op (NEW is null
--    outside a trigger), but it should not be in the public API surface.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on public.products_priced from anon;
revoke all on public.products_priced from authenticated;
alter view public.products_priced set (security_invoker = on);

revoke execute on function public.auto_assign_admin() from anon, authenticated, public;

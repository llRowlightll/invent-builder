import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

/**
 * Verifies the request carries a real, logged-in admin's session — replaces
 * the shared-secret stopgap (a static x-hook-secret header, the only gate
 * when verify_jwt was false) with an actual identity check. Requires the
 * function to be deployed with verify_jwt: true so the gateway already
 * rejected anonymous/invalid tokens before this runs; this additionally
 * confirms the authenticated user specifically has the 'admin' role, not
 * just any logged-in customer, via the same has_role() RPC the rest of the
 * app's admin-only Postgres functions use.
 *
 * Returns { userId } on success, or a Response to return immediately on
 * failure (401 no/invalid token, 403 authenticated but not admin).
 */
export async function requireAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return new Response("Unauthorized", { status: 401 });

  const { data: isAdmin } = await supabase.rpc("has_role", { uid: user.id, check_role: "admin" });
  if (!isAdmin) return new Response("Forbidden", { status: 403 });

  return { userId: user.id };
}

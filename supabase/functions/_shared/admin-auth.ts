import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

async function checkAdmin(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return null;

  const { data: isAdmin } = await supabase.rpc("has_role", { uid: user.id, check_role: "admin" });
  if (!isAdmin) return null;

  return { userId: user.id };
}

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

  const admin = await checkAdmin(req);
  if (!admin) {
    // Distinguish "bad/expired token" from "valid token, not admin" for the caller,
    // same as before this was factored through checkAdmin().
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user } } = await supabase.auth.getUser(jwt);
    return new Response(user ? "Forbidden" : "Unauthorized", { status: user ? 403 : 401 });
  }

  return admin;
}

/**
 * Same identity+role check as requireAdmin(), but for endpoints that must stay
 * reachable by anonymous callers (verify_jwt: false) and only need to grant
 * *extra* trust when the caller happens to be an admin — e.g. an endpoint public
 * signup can hit with no session yet, but that an admin tool also calls to act
 * on someone else's behalf. Never returns a Response; just null when not admin,
 * so the caller can fall through to its public-safe path instead of hard-failing.
 */
export async function tryGetAdmin(req: Request): Promise<{ userId: string } | null> {
  return checkAdmin(req);
}

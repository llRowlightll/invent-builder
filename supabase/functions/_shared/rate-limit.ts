import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Best-effort caller IP from the headers Supabase's gateway/any upstream
 *  proxy sets. Falls back to a shared "unknown" bucket rather than skipping
 *  the check — that's a stricter failure mode (a shared budget) than no
 *  limit at all, never a way to bypass it. */
function callerIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Rate-limits a public (verify_jwt: false) endpoint by caller IP, for
 * functions with no auth-shaped fix available (legitimately anonymous
 * callers) but a real paid-API cost behind every request. Returns true if
 * the call is within limits, false if the caller should be rejected — the
 * caller builds its own 429 response so it can include its own CORS headers.
 *
 * name should be the function's own slug ("ai-search", "document-ai", ...)
 * so each function gets an independent budget per IP, not a shared one.
 */
export async function withinRateLimit(
  req: Request,
  name: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = `${name}:${callerIp(req)}`;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: ok, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  // Fail open on an infra error (e.g. the RPC itself is unreachable) — a
  // rate-limiter outage must not take the whole endpoint down with it.
  if (error) {
    console.error("withinRateLimit check failed, allowing through:", error);
    return true;
  }
  return ok === true;
}

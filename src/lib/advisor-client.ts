/**
 * Shared client for the groq-advisor edge function.
 *
 * Extracted 2026-09-08 from machine-builder.tsx's advisorCall and chat.tsx's
 * advisorOptionsCall, which were byte-for-byte the same request with different
 * error handling -- chat.tsx's own comment said "same client pattern as
 * machine-builder.tsx's advisorCall", which is exactly the kind of duplicate
 * that drifts. It had already drifted: only machine-builder handled the 503
 * rate-limit response, so a throttled chat request surfaced as a generic
 * "Advisor error 503".
 */

const ADVISOR_URL = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/groq-advisor";
const ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ?? "";

/**
 * Reported 2026-09-08 ("sen låser den sig"): neither call site had a timeout,
 * so a stalled upstream left the UI waiting forever -- in machine-builder on a
 * <LoadingCard> with no cancel and no back link, a literal freeze with nothing
 * to do but reload and lose the typed description; in chat on a "fetching..."
 * placeholder its own .catch() was written to clear, but which a hang never
 * reaches.
 *
 * 45s is ~2.4x the slowest advisor call ever recorded. Measured over 14 days
 * of integration_logs (n=3123):
 *   options   p50 516ms   p95 3547ms   max 18461ms
 *   bom       p50 680ms   p95 2576ms   max 16091ms
 *   questions p50 1481ms  p95 1644ms   max  2633ms
 * so this cannot fire on a request that was merely slow but working; it only
 * converts an unbounded hang into an ordinary, recoverable error.
 */
export const ADVISOR_TIMEOUT_MS = 45_000;

/** Thrown when the advisor is rate-limited (503). Callers map this to a
 *  friendlier "temporarily overloaded, try again in a moment" message. */
export const RATE_LIMITED = "RATE_LIMITED";

// T defaults to `any` deliberately: this mirrors what `res.json()` already
// returned at both call sites, so they keep their existing local typing and
// casts unchanged. The advisor's response really is untyped JSON at this
// boundary -- the shape is asserted by each caller, not here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callAdvisor<T = any>(body: object): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ADVISOR_TIMEOUT_MS);
  try {
    const res = await fetch(ADVISOR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 503) throw new Error(RATE_LIMITED);
    if (!res.ok) throw new Error(`Advisor error ${res.status}`);
    // Body streaming stays inside the timeout window too -- a response that
    // starts and then stalls mid-body is the same freeze from the user's side.
    return await res.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

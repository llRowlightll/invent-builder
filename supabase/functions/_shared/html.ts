/**
 * Shared hardening for building transactional-email HTML from caller-supplied
 * fields. Used anywhere an edge function interpolates request data into an
 * email sent from a Maskinval address — see welcome-email and
 * order-status-email for the incidents that made this necessary.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns the URL only if it's https — drops javascript:/data:/etc. schemes
 *  that would otherwise sit quietly in an href= attribute. Deliberately does
 *  NOT restrict to a domain allowlist: some callers legitimately point this
 *  at admin-entered, off-site document links (e.g. a Fortnox invoice PDF). */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

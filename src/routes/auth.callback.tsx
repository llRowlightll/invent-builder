/**
 * /auth/callback
 * Supabase redirects here after email confirmation.
 * The hash fragment contains either the session tokens or an error.
 * We exchange it, then redirect to the locale-aware profile completion page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCookie, detectBrowserLocale } from "@/lib/i18n";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params2 = new URLSearchParams(hash);

    const errorCode = params2.get("error_code");
    const errorDesc = params2.get("error_description");

    if (errorCode) {
      setStatus("error");
      setErrorMsg(
        errorCode === "otp_expired"
          ? "Bekräftelselänken har gått ut. Begär en ny nedan."
          : decodeURIComponent(errorDesc ?? errorCode)
      );
      return;
    }

    // Let the Supabase client process the hash (it reads access_token etc)
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const locale = getCookie("lifemap_locale") ?? detectBrowserLocale();
        window.location.replace(`/${locale}/profile`);
      } else {
        // Give the onAuthStateChange a moment to process the hash
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            sub.subscription.unsubscribe();
            const locale = getCookie("lifemap_locale") ?? detectBrowserLocale();
            window.location.replace(`/${locale}/profile`);
          }
        });
        // Timeout fallback
        setTimeout(() => {
          setStatus("error");
          setErrorMsg("Sessionen kunde inte bekräftas. Försök logga in igen.");
        }, 5000);
      }
    });
  }, []);

  async function resendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    await supabase.auth.resend({ type: "signup", email });
    setResent(true);
  }

  if (status === "processing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="inline-block size-8 rounded-full border-2 border-info/30 border-t-info animate-spin" />
          <p className="text-sm text-muted-foreground">Bekräftar din e-post…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-xl font-semibold">Länken fungerade inte</h1>
        <p className="text-sm text-muted-foreground">{errorMsg}</p>

        {!resent ? (
          <form onSubmit={resendEmail} className="space-y-3 text-left">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Din e-post</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@foretag.se"
                className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-md bg-info text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90"
            >
              Skicka ny bekräftelselänk
            </button>
          </form>
        ) : (
          <div className="rounded-lg bg-[oklch(0.92_0.06_155)]/30 border border-[oklch(0.72_0.12_155)] px-4 py-3 text-sm text-[oklch(0.32_0.12_155)]">
            ✓ Ny länk skickad — kolla din inkorg.
          </div>
        )}

        <a href="/sv/login" className="block text-sm text-muted-foreground hover:text-info underline">
          Tillbaka till inloggning
        </a>
      </div>
    </div>
  );
}

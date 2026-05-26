/**
 * /auth/callback
 * Supabase redirects here after email confirmation AND password reset.
 * The hash fragment contains either the session tokens or an error.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCookie, detectBrowserLocale } from "@/lib/i18n";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const [status, setStatus] = useState<"processing" | "error" | "recovery">("processing");
  const handled = useRef(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params2 = new URLSearchParams(hash);

    const errorCode = params2.get("error_code");
    const errorDesc = params2.get("error_description");
    const type = params2.get("type");

    if (errorCode) {
      setStatus("error");
      setErrorMsg(
        errorCode === "otp_expired"
          ? "Bekräftelselänken har gått ut. Begär en ny nedan."
          : decodeURIComponent(errorDesc ?? errorCode)
      );
      return;
    }

    // Let the Supabase client process the hash
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        handled.current = true;
        if (type === "recovery") {
          setStatus("recovery");
        } else {
          const locale = getCookie("lifemap_locale") ?? detectBrowserLocale();
          window.location.replace(`/${locale}/profile`);
        }
      } else {
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            handled.current = true;
            sub.subscription.unsubscribe();
            if (event === "PASSWORD_RECOVERY") {
              setStatus("recovery");
            } else {
              const locale = getCookie("lifemap_locale") ?? detectBrowserLocale();
              window.location.replace(`/${locale}/profile`);
            }
          }
        });
        // Only show error if nothing handled the auth within 5 s
        setTimeout(() => {
          if (!handled.current) {
            setStatus("error");
            setErrorMsg("Sessionen kunde inte bekräftas. Försök logga in igen.");
          }
        }, 5000);
      }
    });
  }, []);

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setResetError("Lösenorden matchar inte.");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("Lösenordet måste vara minst 8 tecken.");
      return;
    }
    setResetting(true);
    setResetError(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setResetting(false);
    if (error) {
      setResetError(error.message);
    } else {
      setResetDone(true);
      const locale = getCookie("lifemap_locale") ?? detectBrowserLocale();
      setTimeout(() => window.location.replace(`/${locale}/profile`), 2000);
    }
  }

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

  if (status === "recovery") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-3">🔑</div>
            <h1 className="text-xl font-semibold">Välj nytt lösenord</h1>
            <p className="text-sm text-muted-foreground mt-1">Ange ditt nya lösenord nedan.</p>
          </div>

          {resetDone ? (
            <div className="rounded-xl border border-[oklch(0.72_0.12_155)] bg-[oklch(0.96_0.04_155)] p-5 text-center space-y-2">
              <div className="text-2xl">✓</div>
              <p className="font-semibold">Lösenordet är uppdaterat!</p>
              <p className="text-sm text-muted-foreground">Omdirigerar till din profil…</p>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Nytt lösenord</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minst 8 tecken"
                  className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Bekräfta lösenord</span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Upprepa lösenordet"
                  className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </label>
              {resetError && <p className="text-sm text-destructive">{resetError}</p>}
              <button
                type="submit"
                disabled={resetting}
                className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {resetting ? "Sparar…" : "Spara nytt lösenord"}
              </button>
            </form>
          )}
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

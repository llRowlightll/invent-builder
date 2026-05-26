import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { makeT, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/$locale/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("auth.loginTitle")} — ${t("common.appName")}` },
        { name: "description", content: t("auth.loginSubtitle") },
      ],
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const { locale } = Route.useParams();
  const { redirect } = Route.useSearch();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (redirect) {
      navigate({ to: redirect as never });
    } else {
      navigate({ to: "/$locale/app", params: { locale } });
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setForgotLoading(false);
    setForgotSent(true);
  }

  if (showForgot) {
    return (
      <div className="container-page py-16 max-w-md">
        <button
          onClick={() => { setShowForgot(false); setForgotSent(false); }}
          className="text-xs text-muted-foreground hover:text-info mb-6 flex items-center gap-1"
        >
          ← {locale === "sv" ? "Tillbaka till inloggning" : "Back to login"}
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {locale === "sv" ? "Återställ lösenord" : "Reset password"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {locale === "sv"
            ? "Ange din e-post så skickar vi en återställningslänk."
            : "Enter your email and we'll send you a reset link."}
        </p>

        {forgotSent ? (
          <div className="mt-8 rounded-xl border border-[oklch(0.72_0.12_155)] bg-[oklch(0.96_0.04_155)] p-5 text-center space-y-2">
            <div className="text-3xl">📬</div>
            <p className="font-semibold text-foreground">
              {locale === "sv" ? "Kolla din inkorg!" : "Check your inbox!"}
            </p>
            <p className="text-sm text-muted-foreground">
              {locale === "sv"
                ? `Vi har skickat en återställningslänk till ${forgotEmail}`
                : `We've sent a reset link to ${forgotEmail}`}
            </p>
          </div>
        ) : (
          <form onSubmit={onForgot} className="mt-8 space-y-4">
            <Field label={t("auth.email")}>
              <input
                type="email"
                required
                autoFocus
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="du@foretag.se"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              />
            </Field>
            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {forgotLoading
                ? t("common.loading")
                : locale === "sv" ? "Skicka återställningslänk" : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="container-page py-16 max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.loginTitle")}</h1>
      <p className="text-sm text-muted-foreground mt-1">{t("auth.loginSubtitle")}</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label={t("auth.email")}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
        </Field>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("auth.password")}</span>
            <button
              type="button"
              onClick={() => { setShowForgot(true); setForgotEmail(email); }}
              className="text-xs text-info hover:underline"
            >
              {locale === "sv" ? "Glömt lösenordet?" : "Forgot password?"}
            </button>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? t("common.loading") : t("auth.submitLogin")}
        </button>
      </form>
      <p className="text-sm text-muted-foreground mt-6">
        {t("auth.noAccount")}{" "}
        <Link to="/$locale/signup" params={{ locale }} className="underline text-foreground">
          {t("auth.signupHere")}
        </Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

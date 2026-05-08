import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { makeT, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/$locale/login")({
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
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    navigate({ to: "/$locale/app", params: { locale } });
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
        <Field label={t("auth.password")}>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
        </Field>
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

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/settings")({
  head: ({ params }) => ({
    meta: [{ title: `${makeT(params.locale as Locale)("nav.settings")} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [aiMode, setAiMode] = useState<"auto" | "fast" | "off">("auto");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/$locale/login", params: { locale } });
  }, [user, loading, navigate, locale]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("users_profile")
        .select("display_name,ai_mode")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setAiMode((data.ai_mode as "auto" | "fast" | "off") ?? "auto");
      }
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    const { error } = await supabase
      .from("users_profile")
      .update({ display_name: displayName, ai_mode: aiMode })
      .eq("user_id", user.id);
    setSavedAt(error ? "Error: " + error.message : new Date().toLocaleTimeString());
  }

  if (loading || !user)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="container-page py-10 max-w-md">
      <Link to="/$locale/app" params={{ locale }} className="text-xs underline text-muted-foreground">
        ← {t("nav.dashboard")}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("nav.settings")}</h1>
      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-xs text-muted-foreground">{t("auth.displayName")}</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">AI mode</span>
          <select
            value={aiMode}
            onChange={(e) => setAiMode(e.target.value as "auto" | "fast" | "off")}
            className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          >
            <option value="auto">Auto (use AI when available)</option>
            <option value="fast">Fast (smaller model)</option>
            <option value="off">Off (rules only)</option>
          </select>
        </label>
        <button onClick={save} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm">
          {t("common.save")}
        </button>
        {savedAt && <p className="text-xs text-muted-foreground">Saved {savedAt}</p>}
      </div>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/$locale/app")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("nav.dashboard")} — ${t("common.appName")}` },
        { name: "description", content: t("app.dashboardLead") },
      ],
    };
  },
  component: AppDashboard,
});

function AppDashboard() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/$locale/login", params: { locale }, replace: true });
    }
  }, [loading, user, navigate, locale]);

  if (loading || !user) {
    return (
      <div className="container-page py-16 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const tiles: Array<{ title: string; body: string; soon?: boolean }> = [
    { title: t("app.tileChatTitle"), body: t("app.tileChatBody"), soon: true },
    { title: t("app.tileWizardTitle"), body: t("app.tileWizardBody"), soon: true },
    { title: t("app.tileConvertTitle"), body: t("app.tileConvertBody"), soon: true },
    { title: t("app.tileConfiguratorTitle"), body: t("app.tileConfiguratorBody"), soon: true },
    { title: t("app.tileProductsTitle"), body: t("app.tileProductsBody"), soon: true },
    { title: t("app.tileOrdersTitle"), body: t("app.tileOrdersBody"), soon: true },
  ];

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("app.welcome")}, {user.email}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{t("app.dashboardLead")}</p>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <div
            key={tile.title}
            className="rounded-lg border border-border bg-card p-5 hover:border-gold/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{tile.title}</h3>
              {tile.soon && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  Soon
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{tile.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        <Link to="/$locale" params={{ locale }} className="underline">
          ← {t("common.back")}
        </Link>
      </p>
    </div>
  );
}

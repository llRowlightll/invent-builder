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

const TILES: Array<{
  to: "/$locale/chat" | "/$locale/wizard" | "/$locale/convert" | "/$locale/configurator" | "/$locale/products" | "/$locale/orders";
  titleKey: "app.tileChatTitle" | "app.tileWizardTitle" | "app.tileConvertTitle" | "app.tileConfiguratorTitle" | "app.tileProductsTitle" | "app.tileOrdersTitle";
  bodyKey: "app.tileChatBody" | "app.tileWizardBody" | "app.tileConvertBody" | "app.tileConfiguratorBody" | "app.tileProductsBody" | "app.tileOrdersBody";
  tone: string;
}> = [
  { to: "/$locale/chat", titleKey: "app.tileChatTitle", bodyKey: "app.tileChatBody", tone: "var(--teal)" },
  { to: "/$locale/wizard", titleKey: "app.tileWizardTitle", bodyKey: "app.tileWizardBody", tone: "var(--copper)" },
  { to: "/$locale/convert", titleKey: "app.tileConvertTitle", bodyKey: "app.tileConvertBody", tone: "var(--gold)" },
  { to: "/$locale/configurator", titleKey: "app.tileConfiguratorTitle", bodyKey: "app.tileConfiguratorBody", tone: "var(--info)" },
  { to: "/$locale/products", titleKey: "app.tileProductsTitle", bodyKey: "app.tileProductsBody", tone: "var(--steel)" },
  { to: "/$locale/orders", titleKey: "app.tileOrdersTitle", bodyKey: "app.tileOrdersBody", tone: "var(--graphite)" },
];

function AppDashboard() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user)
      navigate({ to: "/$locale/login", params: { locale }, replace: true });
  }, [loading, user, navigate, locale]);

  if (loading || !user)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("app.welcome")}, {user.email}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{t("app.dashboardLead")}</p>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            params={{ locale }}
            className="group rounded-xl border border-border bg-card p-5 hover:border-gold/60 transition-colors"
          >
            <span
              className="inline-block size-2 rounded-full mb-3"
              style={{ background: tile.tone }}
            />
            <h3 className="font-semibold text-foreground group-hover:underline">
              {t(tile.titleKey)}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{t(tile.bodyKey)}</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        <Link to="/$locale" params={{ locale }} className="underline">
          ← {t("common.back")}
        </Link>
        {" · "}
        <Link to="/$locale/admin/import" params={{ locale }} className="underline">
          {t("nav.admin")}
        </Link>
        {" · "}
        <Link to="/$locale/settings" params={{ locale }} className="underline">
          {t("nav.settings")}
        </Link>
      </p>
    </div>
  );
}

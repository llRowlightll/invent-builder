import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { isLocale, makeT, setLocaleCookie, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/$locale")({
  parseParams: (params) => {
    if (!isLocale(params.locale)) {
      throw new Error("Unsupported locale");
    }
    return { locale: params.locale };
  },
  component: LocaleLayout,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <Link to="/" className="text-sm underline mt-2 inline-block">
          Home
        </Link>
      </div>
    </div>
  ),
});

function LocaleLayout() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();

  function switchLocale(next: Locale) {
    setLocaleCookie(next);
    // swap /en/x -> /sv/x preserving the rest
    const rest = path.replace(/^\/(en|sv)/, "");
    navigate({ to: `/${next}${rest || ""}` as never, replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-primary-foreground sticky top-0 z-30 shadow-sm">
        <div className="container-page flex items-center gap-6 h-16">
          <Link
            to="/$locale"
            params={{ locale }}
            className="font-semibold tracking-tight flex items-center gap-2 text-primary-foreground"
          >
            <span className="inline-block size-2 rounded-sm bg-gold" />
            {t("common.appName")}
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-primary-foreground/75">
            <Link to="/$locale/products" params={{ locale }} activeProps={{ className: "text-primary-foreground font-medium" }} className="hover:text-primary-foreground">
              {t("nav.products")}
            </Link>
            <Link to="/$locale/components" params={{ locale }} activeProps={{ className: "text-primary-foreground font-medium" }} className="hover:text-primary-foreground">
              {t("nav.components")}
            </Link>
            <Link to="/$locale/advisor" params={{ locale }} activeProps={{ className: "text-primary-foreground font-medium" }} className="hover:text-primary-foreground">
              {t("nav.advisor")}
            </Link>
            <Link to="/$locale/compare" params={{ locale }} activeProps={{ className: "text-primary-foreground font-medium" }} className="hover:text-primary-foreground">
              {t("nav.compare")}
            </Link>
            <Link to="/$locale/talk" params={{ locale }} activeProps={{ className: "text-primary-foreground font-medium" }} className="hover:text-primary-foreground">
              {t("nav.talk")}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-md border border-primary-foreground/25 overflow-hidden text-xs">
              <button
                onClick={() => switchLocale("en")}
                className={`px-2.5 py-1 ${locale === "en" ? "bg-primary-foreground text-primary" : "text-primary-foreground/80 hover:text-primary-foreground"}`}
              >
                EN
              </button>
              <button
                onClick={() => switchLocale("sv")}
                className={`px-2.5 py-1 ${locale === "sv" ? "bg-primary-foreground text-primary" : "text-primary-foreground/80 hover:text-primary-foreground"}`}
              >
                SV
              </button>
            </div>
            {user ? (
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/$locale", params: { locale } });
                }}
                className="text-sm px-3 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10"
              >
                {t("common.signOut")}
              </button>
            ) : (
              <Link
                to="/$locale/login"
                params={{ locale }}
                className="text-sm px-3 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10"
              >
                {t("auth.submitLogin")}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("common.appName")}
      </footer>
    </div>
  );
}

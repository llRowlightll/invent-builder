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
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container-page flex items-center gap-6 h-14">
          <Link
            to="/$locale"
            params={{ locale }}
            className="font-semibold tracking-tight text-foreground flex items-center gap-2"
          >
            <span className="inline-block size-2 rounded-full bg-gold" />
            {t("common.appName")}
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/$locale/project" params={{ locale }} activeProps={{ className: "text-foreground font-medium" }} className="hover:text-foreground">
              {t("nav.project")}
            </Link>
            <Link to="/$locale/components" params={{ locale }} activeProps={{ className: "text-foreground font-medium" }} className="hover:text-foreground">
              {t("nav.components")}
            </Link>
            <Link to="/$locale/compare" params={{ locale }} activeProps={{ className: "text-foreground font-medium" }} className="hover:text-foreground">
              {t("nav.compare")}
            </Link>
            <Link to="/$locale/talk" params={{ locale }} activeProps={{ className: "text-foreground font-medium" }} className="hover:text-foreground">
              {t("nav.talk")}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => switchLocale("en")}
                className={`px-2.5 py-1 ${locale === "en" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
              >
                EN
              </button>
              <button
                onClick={() => switchLocale("sv")}
                className={`px-2.5 py-1 ${locale === "sv" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
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
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-accent"
              >
                {t("common.signOut")}
              </button>
            ) : (
              <Link
                to="/$locale/login"
                params={{ locale }}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-accent"
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

import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  function switchLocale(next: Locale) {
    setLocaleCookie(next);
    const rest = path.replace(/^\/(en|sv)/, "");
    navigate({ to: `/${next}${rest || ""}` as never, replace: true });
  }

  const navLinks = [
    { to: "/$locale/products", label: t("nav.products") },
    { to: "/$locale/chat", label: t("nav.chat") },
    { to: "/$locale/advisor", label: t("nav.advisor") },
    { to: "/$locale/compare", label: t("nav.compare") },
    { to: "/$locale/machine-builder", label: t("nav.machineBuilder") },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-primary-foreground sticky top-0 z-30 shadow-sm">
        <div className="container-page flex items-center gap-4 h-16">
          {/* Logo */}
          <Link
            to="/$locale"
            params={{ locale }}
            className="font-bold tracking-tight flex items-center gap-2 text-primary-foreground shrink-0"
          >
            <span
              className="inline-flex items-center justify-center size-6 rounded bg-gold text-primary text-[11px] font-black"
              aria-hidden
            >
              M
            </span>
            <span className="hidden sm:inline">{t("common.appName")}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm text-primary-foreground/75 ml-2">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to as never}
                params={{ locale } as never}
                activeProps={{ className: "bg-primary-foreground/15 text-primary-foreground" }}
                className="px-3 py-1.5 rounded-md hover:bg-primary-foreground/10 hover:text-primary-foreground transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Build machine CTA */}
            <Link
              to="/$locale/machine-builder"
              params={{ locale }}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-gold text-primary font-semibold hover:opacity-90 transition"
            >
              ✦ {t("nav.machineBuilder")}
            </Link>

            {/* Language toggle */}
            <div className="flex rounded-md border border-primary-foreground/25 overflow-hidden text-xs">
              <button
                onClick={() => switchLocale("sv")}
                className={`px-2.5 py-1 ${locale === "sv" ? "bg-primary-foreground text-primary" : "text-primary-foreground/80 hover:text-primary-foreground"}`}
              >
                SV
              </button>
              <button
                onClick={() => switchLocale("en")}
                className={`px-2.5 py-1 ${locale === "en" ? "bg-primary-foreground text-primary" : "text-primary-foreground/80 hover:text-primary-foreground"}`}
              >
                EN
              </button>
            </div>

            {/* Auth */}
            {user ? (
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/$locale", params: { locale } });
                }}
                className="hidden sm:block text-sm px-3 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10"
              >
                {t("common.signOut")}
              </button>
            ) : (
              <Link
                to="/$locale/login"
                params={{ locale }}
                className="hidden sm:block text-sm px-3 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10"
              >
                {t("auth.submitLogin")}
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-md hover:bg-primary-foreground/10"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Meny"
            >
              <span className="block w-4 h-0.5 bg-primary-foreground mb-1" />
              <span className="block w-4 h-0.5 bg-primary-foreground mb-1" />
              <span className="block w-4 h-0.5 bg-primary-foreground" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-primary-foreground/15 bg-primary px-4 py-3 space-y-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to as never}
                params={{ locale } as never}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/$locale/machine-builder"
              params={{ locale }}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-semibold text-gold hover:bg-primary-foreground/10"
            >
              ✦ {t("nav.machineBuilder")}
            </Link>
            <div className="pt-2 border-t border-primary-foreground/15">
              {user ? (
                <button
                  onClick={async () => { await signOut(); navigate({ to: "/$locale", params: { locale } }); setMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground"
                >
                  {t("common.signOut")}
                </button>
              ) : (
                <Link
                  to="/$locale/login"
                  params={{ locale }}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground"
                >
                  {t("auth.submitLogin")}
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border py-8">
        <div className="container-page grid sm:grid-cols-3 gap-6 text-xs text-muted-foreground">
          <div>
            <div className="font-semibold text-foreground mb-2">{t("common.appName")}</div>
            <p className="leading-relaxed">{t("common.tagline")}</p>
          </div>
          <div>
            <div className="font-medium text-foreground mb-2">Verktyg</div>
            <ul className="space-y-1">
              <li><Link to="/$locale/products" params={{ locale }} className="hover:text-info">{t("nav.products")}</Link></li>
              <li><Link to="/$locale/chat" params={{ locale }} className="hover:text-info">{t("nav.chat")}</Link></li>
              <li><Link to="/$locale/compare" params={{ locale }} className="hover:text-info">{t("nav.compare")}</Link></li>
              <li><Link to="/$locale/advisor" params={{ locale }} className="hover:text-info">{t("nav.advisor")}</Link></li>
              <li><Link to="/$locale/machine-builder" params={{ locale }} className="hover:text-info">{t("nav.machineBuilder")}</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-foreground mb-2">Varumärken</div>
            <p className="leading-relaxed">Festo · SMC · Parker · Bosch Rexroth · Norgren</p>
            <p className="mt-2 text-[11px]">
              Pneumatiska cylindrar · Elektriska aktuatorer · Ventiler · Grippers · Vakuumsystem
            </p>
          </div>
        </div>
        <div className="container-page mt-6 pt-4 border-t border-border text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} {t("common.appName")} — Industriell automationskatalog för maskinbyggare
        </div>
      </footer>
    </div>
  );
}

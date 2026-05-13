import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
  redirect,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { isLocale, makeT, setLocaleCookie, getCookie, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/$locale")({
  parseParams: (params) => {
    if (!isLocale(params.locale)) {
      throw redirect({ to: "/$locale", params: { locale: "sv" } } as never);
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

const LOCALE_META: Record<Locale, { flag: string; label: string }> = {
  sv: { flag: "🇸🇪", label: "SV" },
  en: { flag: "🇬🇧", label: "EN" },
  de: { flag: "🇩🇪", label: "DE" },
  es: { flag: "🇪🇸", label: "ES" },
};

function LocaleLayout() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [cookieConsent, setCookieConsent] = useState<string | null>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCookieConsent(getCookie("mv_cookie_consent"));
    function onClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function acceptCookies(type: "all" | "necessary") {
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `mv_cookie_consent=${type}; Max-Age=${oneYear}; Path=/; SameSite=Lax`;
    setCookieConsent(type);
  }

  function switchLocale(next: Locale) {
    setLocaleCookie(next);
    setLangOpen(false);
    const rest = path.replace(/^\/(en|sv|de|es)/, "");
    navigate({ to: `/${next}${rest || ""}` as never, replace: true });
  }

  const navLinks = [
    { to: "/$locale/products", label: t("nav.products") },
    { to: "/$locale/chat", label: t("nav.chat") },
    { to: "/$locale/advisor", label: t("nav.advisor") },
    { to: "/$locale/compare", label: t("nav.compare") },
    { to: "/$locale/machine-builder", label: t("nav.machineBuilder") },
  ];

  const isAdmin = user?.email?.endsWith("@maskinval.se") || user?.app_metadata?.role === "admin";

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

            {/* Language dropdown */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary-foreground/25 text-xs text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10 transition"
              >
                <span>{LOCALE_META[locale as Locale]?.flag ?? "🌐"}</span>
                <span className="font-medium">{LOCALE_META[locale as Locale]?.label ?? locale.toUpperCase()}</span>
                <span className="text-primary-foreground/50">▾</span>
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 rounded-lg border border-border bg-card shadow-lg py-1 min-w-[120px]">
                  {(["sv", "en", "de", "es"] as Locale[]).map((loc) => (
                    <button
                      key={loc}
                      onClick={() => switchLocale(loc)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-surface-alt transition ${
                        loc === locale ? "text-info font-medium" : "text-foreground"
                      }`}
                    >
                      <span>{LOCALE_META[loc].flag}</span>
                      <span>{LOCALE_META[loc].label}</span>
                      {loc === locale && <span className="ml-auto text-info text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auth */}
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                {isAdmin && (
                  <Link to={"/$locale/admin/crm" as never} params={{ locale } as never}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10 text-primary-foreground/80">
                    CRM
                  </Link>
                )}
                <Link to={"/$locale/profile" as never} params={{ locale } as never}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10 text-primary-foreground/80">
                  Profil
                </Link>
                <button
                  onClick={async () => { await signOut(); navigate({ to: "/$locale", params: { locale } }); }}
                  className="text-sm px-3 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10"
                >
                  {t("common.signOut")}
                </button>
              </div>
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
                <>
                  <Link to={"/$locale/profile" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                    Profil
                  </Link>
                  {isAdmin && (
                    <Link to={"/$locale/admin/crm" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                      CRM
                    </Link>
                  )}
                  <button onClick={async () => { await signOut(); navigate({ to: "/$locale", params: { locale } }); setMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                    {t("common.signOut")}
                  </button>
                </>
              ) : (
                <Link to="/$locale/login" params={{ locale }} onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
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

      {/* Cookie consent banner */}
      {!cookieConsent && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border shadow-lg">
          <div className="container-page py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground flex-1">
              {t("cookies.message")}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => acceptCookies("necessary")}
                className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:border-info hover:text-foreground transition"
              >
                {t("cookies.necessary")}
              </button>
              <button
                onClick={() => acceptCookies("all")}
                className="text-xs px-4 py-1.5 rounded-md bg-info text-primary-foreground hover:opacity-90 transition font-medium"
              >
                {t("cookies.accept")}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <li><Link to="/$locale/admin/import" params={{ locale }} className="hover:text-info">Leverantörsimport</Link></li>
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

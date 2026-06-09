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
import { useAuth, useIsAdmin } from "@/lib/auth-context";
import { useEditMode } from "@/lib/edit-mode-context";

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

function useShoppingListCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    function read() {
      setCount(Number(localStorage.getItem("mv_shopping_list_count") || 0));
    }
    read();
    window.addEventListener("shopping-list-updated", read);
    return () => window.removeEventListener("shopping-list-updated", read);
  }, []);
  return count;
}

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
  const listCount = useShoppingListCount();

  // GA4: inject script when user accepts all cookies
  useEffect(() => {
    const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;
    if (!GA_ID || cookieConsent !== "all") return;
    if (document.getElementById("ga4-script")) return; // already loaded
    const script1 = document.createElement("script");
    script1.id = "ga4-script";
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script1);
    const script2 = document.createElement("script");
    script2.id = "ga4-init";
    script2.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`;
    document.head.appendChild(script2);
  }, [cookieConsent]);

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
    { to: "/$locale/configure", label: t("nav.configurator") },
    { to: "/$locale/new", label: t("nav.new") },
    { to: "/$locale/chat", label: t("nav.chat") },
    { to: "/$locale/advisor", label: t("nav.advisor") },
    { to: "/$locale/guider", label: t("nav.guides") },
    { to: "/$locale/compare", label: t("nav.compare") },
  ];


  const isAdmin = useIsAdmin();
  const { isEditMode, toggleEditMode } = useEditMode();

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

            {/* Cart icon with badge — visible to everyone */}
            <Link
              to="/$locale/shopping-list"
              params={{ locale }}
              className="relative hidden sm:flex items-center justify-center size-8 rounded-md hover:bg-primary-foreground/10 transition"
              title={t("nav.shoppingList")}
            >
              <span className="text-primary-foreground/80 text-base">🛒</span>
              {listCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center size-4 rounded-full bg-gold text-primary text-[9px] font-black leading-none">
                  {listCount > 99 ? "99+" : listCount}
                </span>
              )}
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
                  <>
                    <button
                      onClick={toggleEditMode}
                      className={`text-xs px-2.5 py-1.5 rounded-md border font-medium transition ${
                        isEditMode
                          ? "bg-gold text-primary border-gold"
                          : "border-primary-foreground/25 hover:bg-primary-foreground/10 text-primary-foreground/80"
                      }`}
                    >
                      {isEditMode ? "✎ EDIT PÅ" : "✎ EDIT"}
                    </button>
                  <Link to={"/$locale/admin/dashboard" as never} params={{ locale } as never}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10 text-primary-foreground/80">
                      Admin ◈
                    </Link>
                    <Link to={"/$locale/admin/rfq" as never} params={{ locale } as never}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10 text-primary-foreground/80">
                      RFQ
                    </Link>
                    <Link to={"/$locale/admin/crm" as never} params={{ locale } as never}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10 text-primary-foreground/80">
                      CRM
                    </Link>
                  </>
                )}
                <Link to={"/$locale/projects" as never} params={{ locale } as never}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10 text-primary-foreground/80">
                  {t("projects.title")}
                </Link>
                <Link to={"/$locale/orders" as never} params={{ locale } as never}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10 text-primary-foreground/80">
                  {t("ordersPage.myOrders")}
                </Link>
                <Link to={"/$locale/profile" as never} params={{ locale } as never}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-primary-foreground/25 hover:bg-primary-foreground/10 text-primary-foreground/80">
                  {t("nav.profile")}
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
              aria-label={t("nav.menu")}
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
            <Link
              to="/$locale/shopping-list"
              params={{ locale }}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              🛒 {t("nav.shoppingList")}
              {listCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-gold text-primary text-[9px] font-black">
                  {listCount}
                </span>
              )}
            </Link>
            <div className="pt-2 border-t border-primary-foreground/15">
              {user ? (
                <>
                  <Link to={"/$locale/profile" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                    {t("nav.profile")}
                  </Link>
                  <Link to={"/$locale/claims" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                    {t("claimsPage.title")}
                  </Link>
                  {isAdmin && (
                    <>
                      <Link to={"/$locale/admin/dashboard" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                        Admin dashboard
                      </Link>
                      <Link to={"/$locale/admin/rfq" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                        RFQ
                      </Link>
                      <Link to={"/$locale/admin/orders" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                        Orderhantering
                      </Link>
                      <Link to={"/$locale/admin/products" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                        Produkter
                      </Link>
                      <Link to={"/$locale/admin/crm" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
                        CRM
                      </Link>
                    </>
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

      {/* Cookie consent banner — GDPR: both options equally prominent */}
      {!cookieConsent && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border shadow-lg">
          <div className="container-page py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{t("cookies.message")}</p>
              <Link
                to="/$locale/privacy"
                params={{ locale }}
                className="text-xs text-info hover:underline mt-1 inline-block"
              >
                {t("cookies.policy")} →
              </Link>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => acceptCookies("necessary")}
                className="text-xs px-4 py-2 rounded-md border border-border text-foreground hover:border-info hover:text-info transition font-medium"
              >
                {t("cookies.necessary")}
              </button>
              <button
                onClick={() => acceptCookies("all")}
                className="text-xs px-4 py-2 rounded-md border border-info bg-info text-primary-foreground hover:opacity-90 transition font-medium"
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
            <div className="font-medium text-foreground mb-2">{t("footer.tools")}</div>
            <ul className="space-y-1">
              <li><Link to="/$locale/products" params={{ locale }} className="hover:text-info">{t("nav.products")}</Link></li>
              <li><Link to="/$locale/new" params={{ locale }} className="hover:text-info">{t("nav.new")}</Link></li>
              <li><Link to="/$locale/chat" params={{ locale }} search={{} as never} className="hover:text-info">{t("nav.chat")}</Link></li>
              <li><Link to="/$locale/compare" params={{ locale }} className="hover:text-info">{t("nav.compare")}</Link></li>
              <li><Link to="/$locale/advisor" params={{ locale }} search={{ q: undefined }} className="hover:text-info">{t("nav.advisor")}</Link></li>
              <li><Link to="/$locale/machine-builder" params={{ locale }} className="hover:text-info">{t("nav.machineBuilder")}</Link></li>
              {isAdmin && <li><Link to="/$locale/admin/import" params={{ locale }} className="hover:text-info">{t("footer.importAdmin")}</Link></li>}
            </ul>
          </div>
          <div>
            <div className="font-medium text-foreground mb-2">{t("footer.brands")}</div>
            <p className="leading-relaxed">Festo · SMC · Parker · Bosch Rexroth · Norgren · Metal Work · Camozzi</p>
            <p className="mt-2 text-[11px]">{t("footer.productTypes")}</p>
          </div>
        </div>
        <div className="container-page mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} {t("common.appName")} — {t("footer.copyright")}</span>
          <div className="flex flex-wrap gap-4 justify-center sm:justify-end">
            <Link to="/$locale/privacy" params={{ locale }} className="hover:text-info transition">{t("footer.privacy")}</Link>
            <Link to="/$locale/terms" params={{ locale }} className="hover:text-info transition">{t("footer.terms")}</Link>
            {user && <Link to="/$locale/claims" params={{ locale }} className="hover:text-info transition">{t("claimsPage.title")}</Link>}
            <button
              onClick={() => { document.cookie = "mv_cookie_consent=; Max-Age=0; Path=/"; setCookieConsent(null); }}
              className="hover:text-info transition cursor-pointer"
            >
              {t("cookies.manage")}
            </button>
            <a href="mailto:info@maskinval.se" className="hover:text-info transition">{t("footer.contact")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

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
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { delningsbildMeta } from "@/lib/site";
import { besoksKalla, logga } from "@/lib/matning";

export const Route = createFileRoute("/$locale")({
  parseParams: (params) => {
    if (!isLocale(params.locale)) {
      throw redirect({ to: "/$locale", params: { locale: "sv" } } as never);
    }
    return { locale: params.locale };
  },
  // Rotens meta kan inte se vilket språk sidan är på, så og:locale sattes
  // hårdkodat till en_US -- även på svenska sidor. Här finns parametern.
  head: ({ params }) => {
    const karta: Record<string, string> = {
      sv: "sv_SE", en: "en_US", de: "de_DE", es: "es_ES",
    };
    const denna = karta[params.locale as string] ?? "en_US";
    return {
      meta: [
        { property: "og:locale", content: denna },
        ...Object.values(karta)
          .filter((l) => l !== denna)
          .map((l) => ({ property: "og:locale:alternate", content: l })),
        ...delningsbildMeta(params.locale as string),
      ],
    };
  },
  component: LocaleLayout,
  // Sidan saknas -- på besökarens språk, inte "Not found / Home" på engelska
  // på en svensk sajt.
  notFoundComponent: () => <SidanSaknas />,
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
  const [kontoOpen, setKontoOpen] = useState(false);
  // undefined = inte läst än. Kakan läses först i webbläsaren, och tills dess
  // visas ingen banner. Förut var startläget null ("inget val"), så servern
  // ritade alltid bannern och den blinkade till vid varje sidladdning även för
  // den som redan valt (granskning 2026-10-02).
  const [cookieConsent, setCookieConsent] = useState<string | null | undefined>(undefined);
  const langRef = useRef<HTMLDivElement>(null);
  const kontoRef = useRef<HTMLDivElement>(null);
  const listCount = useShoppingListCount();

  // Egen mätning: varifrån besöket kom (LinkedIn, Google, direkt). En gång per
  // sidladdning; navigering inom sajten laddar inte om layouten.
  useEffect(() => {
    const kalla = besoksKalla();
    if (kalla.fran !== "intern") logga("besok", kalla);
  }, []);

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
      if (kontoRef.current && !kontoRef.current.contains(e.target as Node)) {
        setKontoOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Kontomenyn stängs när man byter sida.
  useEffect(() => setKontoOpen(false), [path]);

  // Bekräftelse när något läggs i korgen. Förut var den enda signalen en
  // siffra vid korgikonen, och det var lätt att tro att klicket inte gjort
  // något.
  useEffect(() => {
    function onAdded(e: Event) {
      const namn = (e as CustomEvent<{ name: string }>).detail?.name ?? "";
      toast(locale === "sv" ? "Tillagd i korgen" : "Added to cart", {
        description: namn,
        action: { label: locale === "sv" ? "Till korgen" : "View cart", onClick: () => navigate({ to: "/$locale/shopping-list", params: { locale } as never }) },
      });
    }
    window.addEventListener("shopping-list-added", onAdded);
    return () => window.removeEventListener("shopping-list-added", onAdded);
  }, [locale, navigate]);

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

  // En AI-ingång i menyn: Bygg maskin (knappen till höger). Menyn hade förut
  // både AI-ingenjören och Rådgivaren bredvid den, plus AI-sökningen i
  // katalogen -- fyra vägar som överlappade och höll olika kvalitet
  // (granskning 2026-10-02). AI-ingenjören finns kvar i sidfoten och tar emot
  // frågor från startsidans sökruta. Rådgivaren är kontaktsidan och heter så.
  const navLinks = [
    { to: "/$locale/products", label: t("nav.products") },
    { to: "/$locale/replace", label: t("nav.replace") },
    { to: "/$locale/configure", label: t("nav.configurator") },
    { to: "/$locale/plc", label: t("nav.plcKort") },
    { to: "/$locale/advisor", label: t("nav.advisor") },
    { to: "/$locale/guider", label: t("nav.guides") },
    { to: "/$locale/compare", label: t("nav.compare") },
  ];


  const isAdmin = useIsAdmin();
  const { isEditMode, toggleEditMode } = useEditMode();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface/80">
        <div className="container-page flex items-center gap-4 h-16">
          {/* Logo */}
          <Link
            to="/$locale"
            params={{ locale }}
            className="font-bold tracking-tight flex items-center gap-2 text-primary shrink-0"
          >
            <span
              className="inline-flex items-center justify-center size-7 rounded-md bg-gold text-primary text-xs font-black shadow-xs"
              aria-hidden
            >
              M
            </span>
            <span className="hidden sm:inline">{t("common.appName")}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden xl:flex items-center gap-0.5 text-sm text-muted-foreground ml-2">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to as never}
                params={{ locale } as never}
                activeProps={{ className: "bg-primary/[0.07] text-primary font-medium" }}
                className="whitespace-nowrap px-2.5 py-1.5 rounded-md hover:bg-muted hover:text-foreground transition-colors"
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
              className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] px-3.5 py-2 rounded-lg bg-cta text-cta-foreground font-semibold shadow-xs hover:bg-cta-hover active:translate-y-px transition-[background-color,transform]"
            >
              ✦ {t("nav.machineBuilder")}
            </Link>

            {/* Cart icon with badge — visible to everyone */}
            <Link
              to="/$locale/shopping-list"
              params={{ locale }}
              className="relative hidden sm:flex items-center justify-center size-9 rounded-lg hover:bg-muted transition-colors"
              title={t("nav.shoppingList")}
            >
              <ShoppingCart className="size-4 text-foreground/70" aria-hidden />
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
              >
                <span>{LOCALE_META[locale as Locale]?.flag ?? "🌐"}</span>
                <span className="font-medium">{LOCALE_META[locale as Locale]?.label ?? locale.toUpperCase()}</span>
                <span className="text-muted-foreground">▾</span>
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
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {isEditMode ? "✎ EDIT PÅ" : "✎ EDIT"}
                    </button>
                  <Link to={"/$locale/admin/dashboard" as never} params={{ locale } as never}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground">
                      Admin ◈
                    </Link>
                    <Link to={"/$locale/admin/rfq" as never} params={{ locale } as never}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground">
                      RFQ
                    </Link>
                    <Link to={"/$locale/admin/crm" as never} params={{ locale } as never}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground">
                      CRM
                    </Link>
                    <Link to={"/$locale/admin/claims" as never} params={{ locale } as never}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground">
                      Reklam.
                    </Link>
                  </>
                )}
                {/* Projekt, ordrar, profil och utloggning i en meny: som fyra
                    knappar tog de så mycket plats att sidhuvudet flödade över
                    när menyraden fick sitt sjunde val. */}
                <div className="relative" ref={kontoRef}>
                  <button
                    type="button"
                    onClick={() => setKontoOpen((o) => !o)}
                    onKeyDown={(e) => { if (e.key === "Escape") setKontoOpen(false); }}
                    aria-expanded={kontoOpen}
                    aria-controls="kontomeny"
                    className="flex items-center gap-1.5 whitespace-nowrap text-sm px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                  >
                    {t("nav.konto")}
                    <span className="text-muted-foreground" aria-hidden>▾</span>
                  </button>
                  {kontoOpen && (
                    <div
                      id="kontomeny"
                      onKeyDown={(e) => { if (e.key === "Escape") setKontoOpen(false); }}
                      className="absolute right-0 top-full mt-1 z-50 rounded-lg border border-border bg-card shadow-lg py-1 min-w-[180px]"
                    >
                      <Link to={"/$locale/projects" as never} params={{ locale } as never}
                        className="block px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt">
                        {t("projects.title")}
                      </Link>
                      <Link to={"/$locale/orders" as never} params={{ locale } as never}
                        className="block px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt">
                        {t("ordersPage.myOrders")}
                      </Link>
                      <Link to={"/$locale/profile" as never} params={{ locale } as never}
                        className="block px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt">
                        {t("nav.profile")}
                      </Link>
                      <div className="my-1 border-t border-border" />
                      <button
                        type="button"
                        onClick={async () => { setKontoOpen(false); await signOut(); navigate({ to: "/$locale", params: { locale } }); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-surface-alt"
                      >
                        {t("common.signOut")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Link
                to="/$locale/login"
                params={{ locale }}
                className="hidden sm:block whitespace-nowrap text-sm px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                {t("auth.submitLogin")}
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="xl:hidden p-2.5 rounded-lg hover:bg-muted"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={t("nav.menu")}
            >
              <span className="block w-4 h-0.5 rounded-full bg-foreground mb-1" />
              <span className="block w-4 h-0.5 rounded-full bg-foreground mb-1" />
              <span className="block w-4 h-0.5 rounded-full bg-foreground" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="xl:hidden border-t border-line bg-surface px-4 py-3 space-y-1 rorelse-fram">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to as never}
                params={{ locale } as never}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/$locale/machine-builder"
              params={{ locale }}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-info hover:bg-muted"
            >
              ✦ {t("nav.machineBuilder")}
            </Link>
            <Link
              to="/$locale/shopping-list"
              params={{ locale }}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:bg-muted hover:text-foreground"
            >
              <ShoppingCart className="size-4 inline -mt-0.5 mr-1.5" aria-hidden />{t("nav.shoppingList")}
              {listCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-gold text-primary text-[9px] font-black">
                  {listCount}
                </span>
              )}
            </Link>
            <div className="pt-2 border-t border-line">
              {user ? (
                <>
                  {/* På telefon syns inte kontomenyn i sidhuvudet; projekten och
                      ordrarna nås härifrån. */}
                  <Link to={"/$locale/projects" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                    {t("projects.title")}
                  </Link>
                  <Link to={"/$locale/orders" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                    {t("ordersPage.myOrders")}
                  </Link>
                  <Link to={"/$locale/profile" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                    {t("nav.profile")}
                  </Link>
                  <Link to={"/$locale/claims" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                    {t("claimsPage.title")}
                  </Link>
                  {isAdmin && (
                    <>
                      <Link to={"/$locale/admin/dashboard" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                        Admin dashboard
                      </Link>
                      <Link to={"/$locale/admin/rfq" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                        RFQ
                      </Link>
                      <Link to={"/$locale/admin/orders" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                        Orderhantering
                      </Link>
                      <Link to={"/$locale/admin/claims" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                        Reklamationer
                      </Link>
                      <Link to={"/$locale/admin/products" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                        Produkter
                      </Link>
                      <Link to={"/$locale/admin/crm" as never} params={{ locale } as never} onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                        CRM
                      </Link>
                    </>
                  )}
                  <button onClick={async () => { await signOut(); navigate({ to: "/$locale", params: { locale } }); setMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
                    {t("common.signOut")}
                  </button>
                </>
              ) : (
                <Link to="/$locale/login" params={{ locale }} onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-foreground/80 hover:text-foreground">
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
      {cookieConsent === null && (
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

      <footer className="mt-16 bg-primary py-10 text-primary-foreground/70">
        <div className="container-page grid sm:grid-cols-3 gap-6 text-xs text-primary-foreground/70">
          <div>
            <div className="font-semibold text-primary-foreground mb-2">{t("common.appName")}</div>
            <p className="leading-relaxed">{t("common.tagline")}</p>
          </div>
          <div>
            <div className="font-medium text-primary-foreground mb-2">{t("footer.tools")}</div>
            <ul className="space-y-1">
              <li><Link to="/$locale/products" params={{ locale }} className="hover:text-gold">{t("nav.products")}</Link></li>
              <li><Link to="/$locale/chat" params={{ locale }} search={{} as never} className="hover:text-gold">{t("nav.chat")}</Link></li>
              <li><Link to="/$locale/compare" params={{ locale }} className="hover:text-gold">{t("nav.compare")}</Link></li>
              <li><Link to="/$locale/advisor" params={{ locale }} search={{ q: undefined }} className="hover:text-gold">{t("nav.advisor")}</Link></li>
              <li><Link to="/$locale/machine-builder" params={{ locale }} className="hover:text-gold">{t("nav.machineBuilder")}</Link></li>
              <li><Link to="/$locale/plc" params={{ locale }} className="hover:text-gold">{t("nav.plc")}</Link></li>
              {isAdmin && <li><Link to="/$locale/admin/import" params={{ locale }} className="hover:text-gold">{t("footer.importAdmin")}</Link></li>}
            </ul>
          </div>
          <div>
            <div className="font-medium text-primary-foreground mb-2">{t("footer.brands")}</div>
            <p className="leading-relaxed">Festo · SMC · Parker · AVENTICS · Bosch Rexroth · Norgren · Metal Work · Camozzi</p>
            <p className="mt-2 text-[11px]">{t("footer.productTypes")}</p>
          </div>
        </div>
        <div className="container-page mt-8 pt-5 border-t border-primary-foreground/15 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-primary-foreground/60">
          <span>© {new Date().getFullYear()} {t("common.appName")}. {t("footer.copyright")}</span>
          <div className="flex flex-wrap gap-4 justify-center sm:justify-end">
            <Link to="/$locale/om-oss" params={{ locale }} className="hover:text-gold transition">{t("footer.about")}</Link>
            <Link to="/$locale/privacy" params={{ locale }} className="hover:text-gold transition">{t("footer.privacy")}</Link>
            <Link to="/$locale/terms" params={{ locale }} className="hover:text-gold transition">{t("footer.terms")}</Link>
            {user && <Link to="/$locale/claims" params={{ locale }} className="hover:text-gold transition">{t("claimsPage.title")}</Link>}
            <button
              onClick={() => { document.cookie = "mv_cookie_consent=; Max-Age=0; Path=/"; setCookieConsent(null); }}
              className="hover:text-gold transition cursor-pointer"
            >
              {t("cookies.manage")}
            </button>
            <a href="mailto:info@maskinval.se" className="hover:text-gold transition">{t("footer.contact")}</a>
          </div>
        </div>
      </footer>
      <Toaster position="bottom-right" />
    </div>
  );
}

const SAKNAS: Record<string, { rubrik: string; text: string; hem: string; katalog: string }> = {
  sv: { rubrik: "Sidan finns inte", text: "Länken kan vara gammal, eller så har sidan flyttats.", hem: "Till startsidan", katalog: "Till katalogen" },
  en: { rubrik: "Page not found", text: "The link may be old, or the page has moved.", hem: "Home", katalog: "Catalogue" },
  de: { rubrik: "Seite nicht gefunden", text: "Der Link ist vielleicht veraltet, oder die Seite wurde verschoben.", hem: "Startseite", katalog: "Katalog" },
  es: { rubrik: "Página no encontrada", text: "Puede que el enlace sea antiguo o que la página se haya movido.", hem: "Inicio", katalog: "Catálogo" },
};

function SidanSaknas() {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const locale = (path.match(/^\/(sv|en|de|es)\b/)?.[1] ?? "sv") as Locale;
  const x = SAKNAS[locale] ?? SAKNAS.sv;
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold">{x.rubrik}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{x.text}</p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <Link to="/$locale" params={{ locale }} className="underline hover:text-info">{x.hem}</Link>
          <Link to="/$locale/products" params={{ locale }} className="underline hover:text-info">{x.katalog}</Link>
        </div>
      </div>
    </div>
  );
}

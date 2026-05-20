import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog, clearCatalogCache } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";
import heroImg from "@/assets/hero-industrial.jpg";
import featureImg from "@/assets/feature-component.jpg";
import { getProductImage, getCategoryImage } from "@/lib/product-images";

export const Route = createFileRoute("/$locale/")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    const locale = params.locale;
    const canonical = `https://tanstack-start-app.llrowlightll.workers.dev/${locale}`;
    return {
      meta: [
        { title: `${t("common.appName")} — Pneumatik, cylindrar & automation` },
        { name: "description", content: "Sök industriella automationskomponenter från Festo, SMC, Parker, Bosch Rexroth och Norgren. AI-sökning, spec-jämförelse och komplett stycklista direkt." },
        { property: "og:title", content: `${t("common.appName")} — Industriell automation` },
        { property: "og:description", content: "AI-driven komponentväljare för maskinbyggare. Pneumatik, elektriska aktuatorer, ventiler och mer." },
        { property: "og:image", content: heroImg },
        { property: "og:url", content: canonical },
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hreflang: "sv", href: "https://tanstack-start-app.llrowlightll.workers.dev/sv" },
        { rel: "alternate", hreflang: "en", href: "https://tanstack-start-app.llrowlightll.workers.dev/en" },
        { rel: "alternate", hreflang: "x-default", href: "https://tanstack-start-app.llrowlightll.workers.dev/sv" },
      ],
    };
  },
  component: Landing,
});

type Cat = { slug: string; name: string };
type Brand = { slug: string; name: string };

const CAT_ICONS: Record<string, string> = {
  cylinder: "⇔",
  "electric-actuator": "⚡",
  "valve-terminal": "▦",
  valve: "◉",
  gripper: "✦",
  "air-preparation": "◈",
  vacuum: "◎",
  "linear-module": "⟶",
  hose: "〰",
  fitting: "⊕",
  "speed-controller": "◑",
  coupling: "⊗",
  "seal-kit": "○",
};

const STAT_KEYS = [
  { value: "91+", labelKey: "index.statProducts" as const, key: "products" },
  { value: "5", labelKey: "index.statBrands" as const, key: "brands" },
  { value: "13", labelKey: "index.statCategories" as const, key: "categories" },
  { value: "24h", labelKey: "index.statLeadTime" as const, key: "lead" },
];

function Landing() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const [cats, setCats] = useState<Cat[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [q, setQ] = useState("");
  const [featured, setFeatured] = useState<ProductRow[]>([]);
  const [totalProducts, setTotalProducts] = useState(91);
  const [totalBrands, setTotalBrands] = useState(5);

  useEffect(() => {
    // Clear any stale module-level cache so we always get a fresh count
    clearCatalogCache();

    // Primary: exact HEAD count — never returns a filtered/cached subset
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .then(({ count }) => {
        if (count !== null && count > 0) {
          setTotalProducts(count);
        }
      });

    supabase.from("categories").select("slug,name").order("name").then(({ data }) => setCats(data ?? []));
    supabase.from("brands").select("slug,name").order("name").then(({ data }) => {
      setBrands(data ?? []);
      if (data && data.length > 0) setTotalBrands(data.length);
    });

    loadCatalog().then((catalog) => {
      // Backup: if catalog length is higher than current state, update
      setTotalProducts((prev) => Math.max(prev, catalog.length));

      const picks = ["FESTO-DSBC", "SMC-CQ2", "PARKER-P1D", "FESTO-HGPP"];
      const found = picks
        .map((sku) => catalog.find((p) => p.sku === sku))
        .filter(Boolean) as ProductRow[];
      setFeatured(found.length >= 2 ? found : catalog.slice(0, 4));
    });
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    navigate({ to: "/$locale/products", params: { locale }, search: { q: q.trim() } });
  }

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${heroImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center 40%",
            opacity: 0.18,
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60% 50% at 80% 20%, color-mix(in oklab, var(--gold) 60%, transparent), transparent 70%)",
          }}
        />
        <div className="container-page py-20 md:py-28 relative">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] uppercase tracking-[0.22em] text-primary-foreground/60 border border-primary-foreground/20 rounded-full px-3 py-0.5">
              {t("index.b2bBadge")}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight max-w-3xl leading-[1.05]">
            {t("index.heroTitle")}<br />
            <span style={{ color: "var(--gold)" }}>{t("index.heroTitleAccent")}</span>
          </h1>
          <p className="mt-5 text-lg text-primary-foreground/75 max-w-xl">
            {t("index.heroSubtitle")}
          </p>

          <form onSubmit={onSearch} className="mt-8 flex gap-2 max-w-2xl">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("index.searchPlaceholder")}
              className="flex-1 rounded-md bg-background text-foreground px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              type="submit"
              className="rounded-md bg-gold text-gold-foreground px-5 py-3 text-sm font-medium hover:opacity-90 transition"
            >
              {t("index.searchButton")}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-primary-foreground/60">
            <span>{t("index.searchTry")}</span>
            {["Festo DSBC cylinder", "SMC CQ2 kompakt", "Parker P1D pneumatisk", "vakuumgrepp"].map((s) => (
              <button
                key={s}
                onClick={() => { setQ(s); navigate({ to: "/$locale/products", params: { locale }, search: { q: s } }); }}
                className="underline underline-offset-2 hover:text-primary-foreground transition"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Stats bar */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl">
            {STAT_KEYS.map((s, i) => (
              <div key={i} className="border border-primary-foreground/15 rounded-md px-4 py-3 bg-primary-foreground/5 backdrop-blur-sm">
                <div className="text-2xl font-semibold" style={{ color: "var(--gold)" }}>
                  {s.key === "products" ? `${totalProducts}+` : s.key === "brands" ? `${totalBrands}` : s.value}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-primary-foreground/50 mt-0.5">{t(s.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {featured.length > 0 && (
        <section className="container-page py-14">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-info font-medium">{t("index.featuredLabel")}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{t("index.featuredTitle")}</h2>
            </div>
            <Link to="/$locale/products" params={{ locale }} className="text-sm text-info hover:underline">
              {t("index.featuredAll")}
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((p) => (
              <Link
                key={p.id}
                to="/$locale/product/$sku"
                params={{ locale, sku: p.sku }}
                className="group rounded-lg border border-border bg-card hover:border-info hover:shadow-sm transition flex flex-col overflow-hidden"
              >
                <div className="relative h-40 overflow-hidden bg-surface-alt">
                  <img
                    src={getProductImage(p)}
                    alt={p.category.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/70 to-transparent" />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-info font-medium">{p.brand.name}</div>
                  <div className="mt-1.5 font-medium text-foreground group-hover:text-info line-clamp-2 transition">{p.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.category.name}</div>
                  <div className="mt-auto pt-3 border-t border-border mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {p.lead_time_days != null ? (p.lead_time_days <= 7 ? t("index.inStock") : `${p.lead_time_days}d`) : "—"}
                    </span>
                    <span className="text-xs text-info">{t("index.viewProduct")}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CATEGORIES */}
      <section className="bg-surface-alt border-y border-border">
        <div className="container-page py-14">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">{t("index.categoriesLabel")}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{t("index.categoriesTitle")}</h2>
            </div>
            <Link to="/$locale/products" params={{ locale }} className="text-sm text-info hover:underline">
              {t("index.allProducts")}
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {cats.map((c) => (
              <Link
                key={c.slug}
                to="/$locale/products"
                params={{ locale }}
                search={{ category: c.slug }}
                className="group rounded-lg border border-border bg-card hover:border-info hover:shadow-sm transition overflow-hidden relative"
              >
                <div className="aspect-[3/2] bg-[#f0f4f8] overflow-hidden flex items-center justify-center">
                  <img
                    src={getCategoryImage(c.slug)}
                    alt={c.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <div className="text-lg" style={{ color: "var(--info)" }}>{CAT_ICONS[c.slug] ?? "▣"}</div>
                  <div className="mt-1 font-medium text-foreground group-hover:text-info transition text-sm">{c.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t("index.viewProduct")}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* BRANDS */}
      <section className="container-page py-12">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground text-center">
          {totalBrands} {t("index.brandsWorking")}
        </p>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {brands.map((b) => (
            <Link
              key={b.slug}
              to="/$locale/products"
              params={{ locale }}
              search={{ brand: b.slug }}
              className="group rounded-xl bg-card border border-border hover:border-info hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <BrandLogo slug={b.slug} name={b.name} />
              <div className="px-3 py-2.5 text-center">
                <div className="text-xs font-semibold text-foreground group-hover:text-info transition">{b.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t("index.viewProducts")}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="bg-surface-alt border-y border-border">
        <div className="container-page py-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-info font-medium">{t("index.featureLabel")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight max-w-sm">{t("index.featureTitle")}</h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-md leading-relaxed">
              {t("index.featureBody")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/$locale/advisor"
                params={{ locale }}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
              >
                {t("index.startAdvisor")}
              </Link>
              <Link
                to="/$locale/compare"
                params={{ locale }}
                search={{ skus: "" }}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-md border border-border hover:border-info transition"
              >
                {t("index.compareProducts")}
              </Link>
            </div>
          </div>
          <div className="relative rounded-xl overflow-hidden border border-border aspect-[4/3] bg-card">
            <img src={featureImg} alt="Industriell komponent" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="text-[10px] uppercase tracking-wider text-info font-medium">{t("index.exampleProduct")}</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">Festo DSBC ISO-cylinder</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">DSBC-50-100-PPSA-N3</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA CARDS */}
      <section className="container-page py-14">
        <div className="grid md:grid-cols-3 gap-3">
          <CtaCard
            icon="◎"
            title={t("index.ctaAdvisorTitle")}
            body={t("index.ctaAdvisorBody")}
            to="/$locale/advisor"
            locale={locale}
            openLabel={t("index.open")}
          />
          <CtaCard
            icon="⇔"
            title={t("index.ctaCompareTitle")}
            body={t("index.ctaCompareBody")}
            to="/$locale/compare"
            locale={locale}
            openLabel={t("index.open")}
          />
          <CtaCard
            icon="✦"
            title={t("index.ctaMachineTitle")}
            body={t("index.ctaMachineBody")}
            to="/$locale/machine-builder"
            locale={locale}
            openLabel={t("index.open")}
          />
        </div>
      </section>
    </div>
  );
}

// Official brand logos served from /public/brands/
const BRAND_META: Record<string, { bg: string }> = {
  "festo":         { bg: "#f8fafc" },
  "smc":           { bg: "#f8fafc" },
  "parker":        { bg: "#f8fafc" },
  "bosch-rexroth": { bg: "#f8fafc" },
  "norgren":       { bg: "#f8fafc" },
};

function BrandLogo({ slug, name }: { slug: string; name: string }) {
  const [imgError, setImgError] = useState(false);
  const meta = BRAND_META[slug];
  const bg = meta?.bg ?? "#f8fafc";

  return (
    <div
      className="h-20 flex items-center justify-center p-4 overflow-hidden"
      style={{ background: bg }}
    >
      {meta && !imgError ? (
        <img
          src={`/brands/${slug}.svg`}
          alt={name}
          onError={() => setImgError(true)}
          className="max-h-12 max-w-full object-contain"
          loading="lazy"
        />
      ) : (
        <span className="font-bold text-base tracking-tight text-gray-700 select-none">{name}</span>
      )}
    </div>
  );
}

function CtaCard({ icon, title, body, to, locale, openLabel }: { icon: string; title: string; body: string; to: string; locale: string; openLabel: string }) {
  return (
    <Link
      to={to as never}
      params={{ locale } as never}
      className="rounded-lg border border-border bg-card p-6 hover:border-info hover:shadow-sm transition block group"
    >
      <div className="text-2xl text-info">{icon}</div>
      <h3 className="mt-3 font-semibold text-foreground group-hover:text-info transition">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <span className="mt-4 inline-block text-sm text-info">{openLabel}</span>
    </Link>
  );
}

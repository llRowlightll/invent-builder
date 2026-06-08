import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog, clearCatalogCache } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";
import heroImg from "@/assets/hero-industrial.jpg";
import featureImg from "@/assets/feature-component.jpg";
import { getProductImage, getCategoryImage } from "@/lib/product-images";
import { SITE, hreflangLinks } from "@/lib/site";
import { EditableText } from "@/components/EditableText";

export const Route = createFileRoute("/$locale/")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    const locale = params.locale;
    const canonical = `${SITE}/${locale}`;
    return {
      meta: [
        { title: `${t("common.appName")} — ${t("index.metaTitleSuffix")}` },
        { name: "description", content: t("index.metaDescription") },
        { property: "og:title", content: `${t("common.appName")} — ${t("index.ogTitleSuffix")}` },
        { property: "og:description", content: t("index.ogDescription") },
        { property: "og:image", content: `${SITE}/og-image.svg` },
        { property: "og:url", content: canonical },
      ],
      links: [
        { rel: "canonical", href: canonical },
        ...hreflangLinks(),
      ],
    };
  },
  // Fetch the live counts on the server so the SSR HTML already has the real
  // numbers — no more "91+" flashing before a client query corrects it.
  loader: async () => {
    try {
      const [pc, br, ct] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("brands").select("slug,name").order("name"),
        supabase.from("categories").select("slug,name").order("name"),
      ]);
      return { productCount: pc.count ?? null, brands: (br.data ?? []) as Brand[], cats: (ct.data ?? []) as Cat[] };
    } catch {
      return { productCount: null as number | null, brands: [] as Brand[], cats: [] as Cat[] };
    }
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
  const ld = Route.useLoaderData();
  const [cats, setCats] = useState<Cat[]>(ld.cats);
  const [brands, setBrands] = useState<Brand[]>(ld.brands);
  const [q, setQ] = useState("");
  const [featured, setFeatured] = useState<ProductRow[]>([]);
  const [totalProducts, setTotalProducts] = useState<number>(ld.productCount ?? 91);
  const [totalBrands, setTotalBrands] = useState(ld.brands.length || 5);

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
    navigate({ to: "/$locale/chat", params: { locale }, search: { q: q.trim() } as never });
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
            <EditableText contentKey="index.heroTitle" locale={locale} fallback={t("index.heroTitle")} /><br />
            <span style={{ color: "var(--gold)" }}>
              <EditableText contentKey="index.heroTitleAccent" locale={locale} fallback={t("index.heroTitleAccent")} />
            </span>
          </h1>
          <p className="mt-5 text-lg text-primary-foreground/75 max-w-xl">
            <EditableText contentKey="index.heroSubtitle" locale={locale} fallback={t("index.heroSubtitle")} multiline />
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
                onClick={() => { setQ(s); navigate({ to: "/$locale/chat", params: { locale }, search: { q: s } as never }); }}
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
                  {s.key === "products" ? `${totalProducts}+` : s.key === "brands" ? `${totalBrands}` : s.key === "categories" ? `${cats.length || 13}` : s.value}
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
                <div className="h-40 overflow-hidden bg-[#f8f9fb] flex items-center justify-center">
                  <img
                    src={getProductImage(p)}
                    alt={p.category.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
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
                <div className="aspect-[3/2] bg-[#f8f9fb] overflow-hidden flex items-center justify-center">
                  <img
                    src={getCategoryImage(c.slug)}
                    alt={c.name}
                    className="w-full h-full object-contain"
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
                search={{ q: undefined }}
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

      {/* HUMAN + AI TRUST BAND */}
      <section className="border-y border-border bg-card">
        <div className="container-page py-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium text-center mb-7">{t("index.howLabel")}</p>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-full bg-info/10 flex items-center justify-center text-2xl">✦</div>
              <div>
                <div className="font-semibold text-sm text-foreground">{t("index.how1Title")}</div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("index.how1Body")}</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-full bg-[oklch(0.92_0.06_155)]/60 flex items-center justify-center text-2xl">👷</div>
              <div>
                <div className="font-semibold text-sm text-foreground">{t("index.how2Title")}</div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("index.how2Body")}</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-full bg-gold/10 flex items-center justify-center text-2xl">📋</div>
              <div>
                <div className="font-semibold text-sm text-foreground">{t("index.how3Title")}</div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("index.how3Body")}</p>
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <Link
              to="/$locale/advisor"
              params={{ locale }}
              search={{ q: undefined }}
              className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-md border border-border hover:border-info hover:text-info transition"
            >
              👷 Prata med en ingenjör
            </Link>
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

      {/* ── FAQ — SEO-rich text + JSON-LD FAQPage schema ── */}
      <FaqSection locale={locale} />

    </div>
  );
}

const FAQ_SV = [
  {
    q: "Vad är en pneumatisk cylinder?",
    a: "En pneumatisk cylinder är ett linjärt aktuatorelement som omvandlar komprimerad luft till mekanisk rörelse. Den används i industriell automation för att lyfta, skjuta, klämma eller positionera detaljer. Vanliga standarder är ISO 15552 (profilcylinder) och ISO 6432 (rundcylinder).",
  },
  {
    q: "Hur väljer man rätt pneumatisk cylinder?",
    a: "Välj cylinder baserat på fyra parametrar: (1) Kraft — beräkna F = P × A (tryck × kolvarea). Vid 6 bar och 50 mm borr ger det 1 178 N. (2) Slaglängd — avståndet rörelsen ska täcka. (3) Montering — ISO 15552 för standardmontage, ISO 6432 för trång plats. (4) Miljö — IP65 för dammiga miljöer, ATEX för explosionsfarliga zoner. Maskinvals AI-rådgivare hjälper dig välja automatiskt.",
  },
  {
    q: "Vad är skillnaden mellan pneumatisk och elektrisk aktuator?",
    a: "Pneumatiska cylindrar är enkla, robusta och billiga — men saknar positionskontroll (bara två lägen: in/ut). Elektriska aktuatorer (servo/stepper) kan stanna exakt var som helst på slaglängden med ±0,01 mm noggrannhet. Elektriska passar vid precision ≤0,1 mm, variabla positioner eller när tryckluftsinstallation saknas.",
  },
  {
    q: "Vilka märken erbjuder Maskinval?",
    a: "Maskinval erbjuder komponenter från Festo, SMC, Parker, Bosch Rexroth, Norgren, Metal Work och Camozzi — mer än 700 aktiva produkter. Alla märken i en gemensam katalog med jämförbara specs och leveranstider.",
  },
  {
    q: "Vad är ISO 15552?",
    a: "ISO 15552 (tidigare ISO 6431) är den internationella standarden för profilcylindrar. Standarden definierar montagemått, gängdimensioner och kolvdiametrar (32–320 mm) så att cylindrar från olika tillverkare är utbytbara. Parker P1D, Festo DSBC, Bosch Rexroth PRA och Camozzi KPZ är alla ISO 15552-kompatibla.",
  },
  {
    q: "Hur snabbt levereras komponenter?",
    a: "Lagerförda standard-cylindrar från Bosch Rexroth, Parker och Camozzi levereras normalt inom 1–5 arbetsdagar. Specialmått och kundanpassade varianter tar 3–6 veckor. Leveranstid visas per produkt i katalogen.",
  },
];

const FAQ_EN = [
  {
    q: "What is a pneumatic cylinder?",
    a: "A pneumatic cylinder is a linear actuator that converts compressed air into mechanical motion. Used in industrial automation to lift, push, clamp, or position parts. Common standards are ISO 15552 (profile cylinder) and ISO 6432 (round cylinder).",
  },
  {
    q: "How do I select the right pneumatic cylinder?",
    a: "Choose based on four parameters: (1) Force — F = P × A (pressure × piston area). At 6 bar and 50 mm bore this gives 1,178 N. (2) Stroke — the travel distance required. (3) Mounting — ISO 15552 for standard mounts, ISO 6432 for tight spaces. (4) Environment — IP65 for dusty environments, ATEX for explosive atmospheres. The Maskinval AI advisor selects automatically.",
  },
  {
    q: "What is the difference between pneumatic and electric actuators?",
    a: "Pneumatic cylinders are simple, robust, and low-cost — but offer only two positions (extend/retract). Electric actuators (servo/stepper) can stop at any point with ±0.01 mm accuracy. Choose electric when precision ≤0.1 mm, variable positioning, or when compressed air infrastructure is unavailable.",
  },
  {
    q: "Which brands does Maskinval offer?",
    a: "Maskinval offers components from Festo, SMC, Parker, Bosch Rexroth, Norgren, Metal Work, and Camozzi — more than 700 active products in one unified catalog with comparable specs and lead times.",
  },
];

function FaqSection({ locale }: { locale: string }) {
  const isSv = locale === "sv";
  const faqs = isSv ? FAQ_SV : FAQ_EN;
  const heading = isSv ? "Vanliga frågor om pneumatik & automation" : "FAQ — Pneumatics & automation";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="container-page py-16 max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h2 className="text-2xl font-semibold text-foreground mb-8">{heading}</h2>
      <dl className="space-y-6">
        {faqs.map((f) => (
          <div key={f.q} className="border-b border-border pb-6">
            <dt className="font-medium text-foreground mb-2">{f.q}</dt>
            <dd className="text-sm text-muted-foreground leading-relaxed">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Official brand logos served from /public/brands/
const BRAND_META: Record<string, { bg: string }> = {
  "festo":         { bg: "#f8fafc" },
  "smc":           { bg: "#f8fafc" },
  "parker":        { bg: "#f8fafc" },
  "bosch-rexroth": { bg: "#f8fafc" },
  "norgren":       { bg: "#f8fafc" },
  "metal-work":    { bg: "#ffffff" },
  "camozzi":       { bg: "#ffffff" },
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

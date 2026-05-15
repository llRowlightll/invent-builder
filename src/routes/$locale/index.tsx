import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";
import heroImg from "@/assets/hero-industrial.jpg";
import featureImg from "@/assets/feature-component.jpg";
import { getProductImage, getCategoryImage } from "@/lib/product-images";

export const Route = createFileRoute("/$locale/")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    const locale = params.locale;
    const canonical = `https://maskinval.lovable.app/${locale}`;
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
        { rel: "alternate", hreflang: "sv", href: "https://maskinval.lovable.app/sv" },
        { rel: "alternate", hreflang: "en", href: "https://maskinval.lovable.app/en" },
        { rel: "alternate", hreflang: "x-default", href: "https://maskinval.lovable.app/sv" },
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

const STATS = [
  { value: "91+", label: "Produkter" },
  { value: "5", label: "Varumärken" },
  { value: "13", label: "Kategorier" },
  { value: "24h", label: "Snabbast leverans" },
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

  useEffect(() => {
    supabase.from("categories").select("slug,name").order("name").then(({ data }) => setCats(data ?? []));
    supabase.from("brands").select("slug,name").order("name").then(({ data }) => setBrands(data ?? []));
    loadCatalog().then((catalog) => {
      setTotalProducts(catalog.length);
      // Pick a representative mix: a Festo cylinder, SMC compact, Parker, Bosch
      const picks = ["FESTO-DSBC", "SMC-CQ2", "PARKER-P1D", "FESTO-HGPP"];
      const found = picks
        .map((sku) => catalog.find((p) => p.sku === sku))
        .filter(Boolean) as ProductRow[];
      // Fallback: take first 4 if picks not found
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
              B2B · Industriell automation
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight max-w-3xl leading-[1.05]">
            Hitta rätt komponent.<br />
            <span style={{ color: "var(--gold)" }}>Snabbt.</span>
          </h1>
          <p className="mt-5 text-lg text-primary-foreground/75 max-w-xl">
            Sök tvärs över Festo, SMC, Parker, Bosch Rexroth och Norgren — pneumatiska cylindrar, elektriska aktuatorer, ventilärer och mer.
          </p>

          <form onSubmit={onSearch} className="mt-8 flex gap-2 max-w-2xl">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Beskriv din applikation eller sök produkt…"
              className="flex-1 rounded-md bg-background text-foreground px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              type="submit"
              className="rounded-md bg-gold text-gold-foreground px-5 py-3 text-sm font-medium hover:opacity-90 transition"
            >
              Sök
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-primary-foreground/60">
            <span>Försök:</span>
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
            {STATS.map((s, i) => (
              <div key={i} className="border border-primary-foreground/15 rounded-md px-4 py-3 bg-primary-foreground/5 backdrop-blur-sm">
                <div className="text-2xl font-semibold" style={{ color: "var(--gold)" }}>{s.value === "91+" ? `${totalProducts}+` : s.value}</div>
                <div className="text-[11px] uppercase tracking-wider text-primary-foreground/50 mt-0.5">{s.label}</div>
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-info font-medium">Utvalda produkter</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Populära komponenter</h2>
            </div>
            <Link to="/$locale/products" params={{ locale }} className="text-sm text-info hover:underline">
              Hela katalogen →
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
                      {p.lead_time_days != null ? (p.lead_time_days <= 7 ? "På lager" : `${p.lead_time_days}d`) : "—"}
                    </span>
                    <span className="text-xs text-info">Visa →</span>
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Produktfamiljer</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Kategorier</h2>
            </div>
            <Link to="/$locale/products" params={{ locale }} className="text-sm text-info hover:underline">
              Alla produkter →
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
                <div className="h-24 overflow-hidden">
                  <img
                    src={getCategoryImage(c.slug)}
                    alt={c.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-70"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <div className="text-lg" style={{ color: "var(--info)" }}>{CAT_ICONS[c.slug] ?? "▣"}</div>
                  <div className="mt-1 font-medium text-foreground group-hover:text-info transition text-sm">{c.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Visa →</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* BRANDS */}
      <section className="container-page py-12">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground text-center">
          Varumärken vi arbetar med
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
                <div className="text-[10px] text-muted-foreground mt-0.5">Visa produkter →</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="bg-surface-alt border-y border-border">
        <div className="container-page py-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-info font-medium">Konfigurering & rådgivning</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight max-w-sm">Rätt komponent, direkt</h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-md leading-relaxed">
              Beskriv din maskin eller process — vår rådgivare identifierar bästa och billigaste lösningen. Konfigurerar orderkod, jämför spec mot spec och skickar offertförfrågan.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/$locale/advisor"
                params={{ locale }}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
              >
                Starta rådgivare →
              </Link>
              <Link
                to="/$locale/compare"
                params={{ locale }}
                search={{ skus: "" }}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-md border border-border hover:border-info transition"
              >
                Jämför produkter
              </Link>
            </div>
          </div>
          <div className="relative rounded-xl overflow-hidden border border-border aspect-[4/3] bg-card">
            <img src={featureImg} alt="Industriell komponent" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="text-[10px] uppercase tracking-wider text-info font-medium">Exempelprodukt</div>
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
            title="Rådgivare"
            body="Beskriv din applikation — vi rekommenderar Bästa och Billigaste paketet."
            to="/$locale/advisor"
            locale={locale}
          />
          <CtaCard
            icon="⇔"
            title="Jämför produkter"
            body="Sätt 2–4 produkter sida vid sida och se bästa värde per spec."
            to="/$locale/compare"
            locale={locale}
          />
          <CtaCard
            icon="✦"
            title="Bygg maskin"
            body="Beskriv din applikation — AI genererar komplett stycklista och du skickar offert med ett klick."
            to="/$locale/machine-builder"
            locale={locale}
          />
        </div>
      </section>
    </div>
  );
}

const BRAND_META: Record<string, { bg: string; text: string; accent: string; abbr?: string }> = {
  "festo":         { bg: "#00B4E6", text: "#fff",     accent: "#003C78", abbr: "FE" },
  "smc":           { bg: "#003087", text: "#fff",     accent: "#E31E24", abbr: "SMC" },
  "parker":        { bg: "#FF6900", text: "#fff",     accent: "#000",    abbr: "PH" },
  "bosch-rexroth": { bg: "#E20015", text: "#fff",     accent: "#000",    abbr: "BR" },
  "norgren":       { bg: "#005EB8", text: "#fff",     accent: "#E20613", abbr: "NO" },
};

function BrandLogo({ slug, name }: { slug: string; name: string }) {
  const m = BRAND_META[slug] ?? { bg: "#64748b", text: "#fff", accent: "#334155", abbr: name.slice(0,2).toUpperCase() };
  return (
    <div className="h-20 flex items-center justify-center relative overflow-hidden" style={{ background: m.bg }}>
      {/* accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: m.accent }} />
      <div className="absolute right-0 top-0 bottom-0 w-1.5" style={{ background: m.accent }} />
      {/* subtle pattern */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "12px 12px" }}
      />
      {/* brand name styled as logo */}
      <span className="relative font-black text-xl tracking-tight select-none" style={{ color: m.text, letterSpacing: "-0.02em", textShadow: "0 1px 3px rgba(0,0,0,.2)" }}>
        {name.toUpperCase()}
      </span>
    </div>
  );
}

function CtaCard({ icon, title, body, to, locale }: { icon: string; title: string; body: string; to: string; locale: string }) {
  return (
    <Link
      to={to as never}
      params={{ locale } as never}
      className="rounded-lg border border-border bg-card p-6 hover:border-info hover:shadow-sm transition block group"
    >
      <div className="text-2xl text-info">{icon}</div>
      <h3 className="mt-3 font-semibold text-foreground group-hover:text-info transition">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <span className="mt-4 inline-block text-sm text-info">Öppna →</span>
    </Link>
  );
}

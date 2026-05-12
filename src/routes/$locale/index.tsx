import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero-industrial.jpg";

export const Route = createFileRoute("/$locale/")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("common.appName")} — Industriell automation` },
        { name: "description", content: "Beställ industriella automationskomponenter — Festo, SMC, Siemens, Phoenix, LAPP, Weidmüller. Konfigurera, jämför och offertförfråga." },
        { property: "og:title", content: t("common.appName") },
        { property: "og:image", content: heroImg },
      ],
    };
  },
  component: Landing,
});

type Cat = { slug: string; name: string };
type Brand = { slug: string; name: string };

const CAT_ICONS: Record<string, string> = {
  actuator: "⚙",
  drive: "⚡",
  plc: "▦",
  io: "▤",
  psu: "▮",
  cable: "〰",
  feedback: "◎",
  accessory: "◇",
  spare: "◈",
};

function Landing() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const [cats, setCats] = useState<Cat[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("categories").select("slug,name").order("name").then(({ data }) => setCats(data ?? []));
    supabase.from("brands").select("slug,name").order("name").then(({ data }) => setBrands(data ?? []));
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
          className="absolute inset-0 opacity-25"
          style={{
            background:
              "radial-gradient(60% 50% at 80% 20%, color-mix(in oklab, var(--gold) 60%, transparent), transparent 70%)",
          }}
        />
        <div className="container-page py-20 md:py-28 relative">
          <p className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/70">
            B2B · Industriell automation
          </p>
          <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight max-w-3xl leading-[1.05]">
            Hitta rätt komponent. Snabbt.
          </h1>
          <p className="mt-5 text-lg text-primary-foreground/80 max-w-2xl">
            Sök tvärs över Festo, SMC, Parker, Bosch Rexroth, Norgren, Siemens och fler — eller beskriv din applikation så hittar vi en validerad lösning.
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
              className="rounded-md bg-gold text-gold-foreground px-5 py-3 text-sm font-medium hover:opacity-90"
            >
              Sök
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-primary-foreground/70">
            <span>Försök:</span>
            {["pneumatisk cylinder 50mm", "PROFINET I/O", "24V PSU 10A", "elektrisk linjäraxel"].map((s) => (
              <button
                key={s}
                onClick={() => { setQ(s); navigate({ to: "/$locale/products", params: { locale }, search: { q: s } }); }}
                className="underline underline-offset-2 hover:text-primary-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container-page py-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Kategorier</h2>
            <p className="text-sm text-muted-foreground mt-1">Bläddra produktfamiljer per användningsområde.</p>
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
              className="group rounded-lg border border-border bg-card p-5 hover:border-info hover:shadow-sm transition"
            >
              <div className="text-2xl text-info">{CAT_ICONS[c.slug] ?? "▣"}</div>
              <div className="mt-3 font-medium text-foreground">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">Visa familjer →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* BRANDS */}
      <section className="bg-surface-alt border-y border-border">
        <div className="container-page py-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground text-center">
            Varumärken vi arbetar med
          </p>
          <div className="mt-6 grid grid-cols-3 md:grid-cols-6 gap-3">
            {brands.map((b) => (
              <Link
                key={b.slug}
                to="/$locale/products"
                params={{ locale }}
                search={{ brand: b.slug }}
                className="rounded-md bg-card border border-border py-5 text-center text-sm font-medium text-foreground/80 hover:text-foreground hover:border-info"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="container-page py-16">
        <div className="grid md:grid-cols-3 gap-3">
          <CtaCard
            title="Rådgivare"
            body="Beskriv din applikation — vi rekommenderar Bästa och Billigaste paketet."
            to="/$locale/advisor"
            locale={locale}
          />
          <CtaCard
            title="Jämför produkter"
            body="Sätt 2–4 produkter sida vid sida och se bästa värde per spec."
            to="/$locale/compare"
            locale={locale}
          />
          <CtaCard
            title="Konfigurator"
            body="Festo-liknande stegguide, levande orderkod och validering."
            to="/$locale/configurator"
            locale={locale}
          />
        </div>
      </section>
    </div>
  );
}

function CtaCard({ title, body, to, locale }: { title: string; body: string; to: string; locale: string }) {
  return (
    <Link
      to={to as never}
      params={{ locale }}
      className="rounded-lg border border-border bg-card p-6 hover:border-info hover:shadow-sm transition block"
    >
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <span className="mt-4 inline-block text-sm text-info">Öppna →</span>
    </Link>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { makeT, type Locale } from "@/lib/i18n";
import heroImg from "@/assets/hero-industrial.jpg";
import featComponent from "@/assets/feature-component.jpg";
import featFlatlay from "@/assets/feature-flatlay.jpg";

export const Route = createFileRoute("/$locale/")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("common.appName")} — ${t("common.tagline")}` },
        { name: "description", content: t("landing.heroSubtitle") },
        { property: "og:title", content: t("common.appName") },
        { property: "og:description", content: t("landing.heroSubtitle") },
        { property: "og:image", content: heroImg },
        { name: "twitter:image", content: heroImg },
      ],
      links: [
        { rel: "alternate", hrefLang: "en", href: "/en" },
        { rel: "alternate", hrefLang: "sv", href: "/sv" },
        { rel: "alternate", hrefLang: "x-default", href: "/" },
      ],
    };
  },
  component: Landing,
});

function Landing() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(80% 60% at 80% 0%, color-mix(in oklab, var(--teal) 18%, transparent), transparent 60%), radial-gradient(60% 40% at 0% 100%, color-mix(in oklab, var(--copper) 14%, transparent), transparent 60%), var(--background)",
          }}
        />
        <div className="container-page grid lg:grid-cols-12 gap-10 py-16 md:py-24 items-center">
          <div className="lg:col-span-6">
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-copper" />
              Festo · SMC · Siemens
            </p>
            <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
              {t("landing.heroTitle")}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/$locale/app"
                params={{ locale }}
                className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
              >
                {t("landing.ctaPrimary")}
              </Link>
              <Link
                to="/$locale/signup"
                params={{ locale }}
                className="inline-flex items-center justify-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent"
              >
                {t("landing.ctaSecondary")}
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              <Stat k="30+" v="seed SKUs" />
              <Stat k="3" v="brands mapped" />
              <Stat k="2" v="modes: Best · Cheapest" />
            </dl>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-xl overflow-hidden border border-border shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--teal-deep)_50%,transparent)]">
              <img
                src={heroImg}
                alt="Electric linear axis paired with a Siemens-style servo drive on a factory floor"
                width={1600}
                height={1024}
                className="w-full h-auto block"
              />
              <div className="absolute left-4 bottom-4 right-4 flex items-end justify-between gap-4">
                <div className="rounded-md bg-background/80 backdrop-blur px-3 py-2 border border-border">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Order code
                  </div>
                  <div className="font-mono text-sm text-foreground">
                    AX-BEST-500-800-INC-PN-230-IP54
                  </div>
                </div>
                <span className="rounded-full bg-teal-deep text-primary-foreground text-[10px] uppercase tracking-widest px-2.5 py-1">
                  Live BOM
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container-page py-20 md:py-24">
        <div className="grid md:grid-cols-3 gap-4">
          <Feature
            tone="teal"
            image={featComponent}
            title={t("landing.feature1Title")}
            body={t("landing.feature1Body")}
          />
          <Feature
            tone="copper"
            image={featFlatlay}
            title={t("landing.feature2Title")}
            body={t("landing.feature2Body")}
          />
          <Feature
            tone="graphite"
            title={t("landing.feature3Title")}
            body={t("landing.feature3Body")}
          />
        </div>
      </section>

      {/* SWATCH STRIP */}
      <section className="border-t border-border bg-surface-alt">
        <div className="container-page py-10 grid grid-cols-2 md:grid-cols-6 gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
          {[
            ["Steel", "var(--steel)"],
            ["Concrete", "var(--concrete)"],
            ["Teal", "var(--teal)"],
            ["Teal deep", "var(--teal-deep)"],
            ["Copper", "var(--copper)"],
            ["Graphite", "var(--graphite)"],
          ].map(([name, c]) => (
            <div key={name} className="flex items-center gap-3">
              <span
                className="size-8 rounded-md border border-border"
                style={{ background: c as string }}
              />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-2xl font-semibold text-foreground tracking-tight">{k}</dt>
      <dd className="text-xs text-muted-foreground mt-1">{v}</dd>
    </div>
  );
}

function Feature({
  title,
  body,
  image,
  tone,
}: {
  title: string;
  body: string;
  image?: string;
  tone: "teal" | "copper" | "graphite";
}) {
  const toneVar =
    tone === "teal" ? "var(--teal)" : tone === "copper" ? "var(--copper)" : "var(--graphite)";
  return (
    <article className="group rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {image ? (
        <div className="aspect-[4/3] overflow-hidden">
          <img
            src={image}
            alt=""
            loading="lazy"
            width={1024}
            height={768}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div
          className="aspect-[4/3]"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--graphite) 92%, var(--teal) 8%), color-mix(in oklab, var(--graphite) 70%, var(--copper) 30%))",
          }}
        />
      )}
      <div className="p-6">
        <span
          className="inline-block size-2 rounded-full mb-3"
          style={{ background: toneVar }}
        />
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}

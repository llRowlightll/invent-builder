import { createFileRoute, Link } from "@tanstack/react-router";
import { makeT, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/$locale/")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("common.appName")} — ${t("common.tagline")}` },
        { name: "description", content: t("landing.heroSubtitle") },
        { property: "og:title", content: t("common.appName") },
        { property: "og:description", content: t("landing.heroSubtitle") },
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
      <section className="container-page py-20 md:py-28">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-4">
            Festo · SMC · Siemens
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
            {t("landing.heroTitle")}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
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
        </div>
      </section>

      <section className="container-page pb-24 grid md:grid-cols-3 gap-4">
        <Feature title={t("landing.feature1Title")} body={t("landing.feature1Body")} />
        <Feature title={t("landing.feature2Title")} body={t("landing.feature2Body")} />
        <Feature title={t("landing.feature3Title")} body={t("landing.feature3Body")} />
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="size-8 rounded-md bg-surface-alt mb-4 flex items-center justify-center">
        <span className="size-2 rounded-full bg-gold" />
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

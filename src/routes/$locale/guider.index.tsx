import { createFileRoute, Link } from "@tanstack/react-router";
import { makeT, type Locale } from "@/lib/i18n";
import { GUIDES } from "@/lib/guides";

export const Route = createFileRoute("/$locale/guider/")({
  head: () => ({
    meta: [
      { title: "Guider — pneumatik & automation | Maskinval" },
      {
        name: "description",
        content:
          "Köpguider för pneumatik och automation: dimensionera cylinder, välja ventil, beräkna luftförbrukning och välja mellan elektrisk och pneumatisk aktuator.",
      },
    ],
  }),
  component: GuidesIndex,
});

function GuidesIndex() {
  const { locale } = Route.useParams();
  const sv = locale === "sv";
  const t = makeT(locale as Locale);

  return (
    <div className="container-page py-10 max-w-3xl">
      <Link to="/$locale" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">
        ← {t("common.appName")}
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">{sv ? "Guider" : "Guides"}</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
        {sv
          ? "Praktiska köpguider för pneumatik och automation — dimensionering, komponentval och kostnad. Varje guide leder vidare till AI-rådgivaren som gör jobbet åt dig."
          : "Practical buying guides for pneumatics and automation — sizing, component choice and cost. Each guide leads on to the AI advisor that does the work for you."}
      </p>

      <div className="mt-8 grid gap-4">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            to="/$locale/guider/$slug"
            params={{ locale, slug: g.slug } as never}
            className="block rounded-xl border border-border p-5 hover:border-info hover:bg-surface-alt/40 transition"
          >
            <h2 className="text-lg font-semibold text-foreground">{sv ? g.title.sv : g.title.en}</h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{sv ? g.metaDescription.sv : g.metaDescription.en}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

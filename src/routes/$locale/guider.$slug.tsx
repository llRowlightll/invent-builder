import { createFileRoute, Link } from "@tanstack/react-router";
import { getGuide, GUIDES } from "@/lib/guides";
import { SITE, hreflangLinks } from "@/lib/site";

export const Route = createFileRoute("/$locale/guider/$slug")({
  head: ({ params }) => {
    const p = params as { slug: string; locale: string };
    const g = getGuide(p.slug);
    const sv = p.locale === "sv";
    if (!g) return { meta: [{ title: "Guide — Maskinval" }] };
    return {
      meta: [
        { title: `${sv ? g.title.sv : g.title.en} — Maskinval` },
        { name: "description", content: sv ? g.metaDescription.sv : g.metaDescription.en },
      ],
      links: [
        { rel: "canonical", href: `${SITE}/${p.locale}/guider/${p.slug}` },
        ...hreflangLinks(`guider/${p.slug}`),
      ],
    };
  },
  component: GuidePage,
});

function GuidePage() {
  const { locale, slug } = Route.useParams();
  const sv = locale === "sv";
  const g = getGuide(slug);

  if (!g) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-sm text-muted-foreground">{sv ? "Guiden hittades inte." : "Guide not found."}</p>
        <Link to="/$locale/guider" params={{ locale }} className="mt-3 inline-block text-sm text-info hover:underline">
          {sv ? "← Alla guider" : "← All guides"}
        </Link>
      </div>
    );
  }

  const title = sv ? g.title.sv : g.title.en;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: sv ? g.metaDescription.sv : g.metaDescription.en,
    inLanguage: locale,
    author: { "@type": "Organization", name: "Maskinval", url: SITE },
    publisher: { "@type": "Organization", name: "Maskinval", url: SITE },
    mainEntityOfPage: `${SITE}/${locale}/guider/${g.slug}`,
  };
  // FAQPage schema — the structured-data type answer engines (ChatGPT, Perplexity,
  // Google AI Overviews) preferentially extract for direct-answer citation. Mirrors
  // the visible Q&A section below, not hidden-only markup.
  const faqJsonLd = g.faq?.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: g.faq.map((f) => ({
      "@type": "Question",
      name: sv ? f.q.sv : f.q.en,
      acceptedAnswer: { "@type": "Answer", text: sv ? f.a.sv : f.a.en },
    })),
  } : null;

  return (
    <div className="container-page py-10 max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}

      <Link to="/$locale/guider" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">
        ← {sv ? "Alla guider" : "All guides"}
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 text-base text-foreground/80 leading-relaxed">{sv ? g.intro.sv : g.intro.en}</p>

      <div className="mt-8 space-y-8">
        {g.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{sv ? s.h.sv : s.h.en}</h2>
            {s.p.map((par, j) => (
              <p key={j} className="mt-2 text-sm text-foreground/80 leading-relaxed">{sv ? par.sv : par.en}</p>
            ))}
          </section>
        ))}
      </div>

      {g.faq && g.faq.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {sv ? "Vanliga frågor" : "Frequently asked questions"}
          </h2>
          <div className="mt-4 space-y-4">
            {g.faq.map((f, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold text-foreground">{sv ? f.q.sv : f.q.en}</h3>
                <p className="mt-1 text-sm text-foreground/80 leading-relaxed">{sv ? f.a.sv : f.a.en}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 rounded-xl border border-info/30 bg-info/5 p-5">
        <p className="text-sm text-foreground/90 leading-relaxed">{sv ? g.cta.sv : g.cta.en}</p>
        {g.ctaTo === "advisor" ? (
          <Link to="/$locale/advisor" params={{ locale }} search={{ q: undefined }} className="mt-3 inline-block text-sm px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90 transition">
            {sv ? "Öppna AI-rådgivaren →" : "Open the AI advisor →"}
          </Link>
        ) : (
          <Link to="/$locale/configure" params={{ locale }} className="mt-3 inline-block text-sm px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90 transition">
            {sv ? "Öppna konfiguratorn →" : "Open the configurator →"}
          </Link>
        )}
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <h2 className="text-sm font-semibold text-muted-foreground">{sv ? "Fler guider" : "More guides"}</h2>
        <div className="mt-3 grid gap-2">
          {GUIDES.filter((x) => x.slug !== g.slug).map((x) => (
            <Link key={x.slug} to="/$locale/guider/$slug" params={{ locale, slug: x.slug } as never} className="text-sm text-info hover:underline">
              {sv ? x.title.sv : x.title.en}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

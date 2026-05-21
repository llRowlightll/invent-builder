import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/advisor")({
  head: ({ params }) => ({
    meta: [{ title: `Rådgivare — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: AdvisorPage,
});

type UseCase = {
  category_slug: string;
  use_case_slug: string;
  title_sv: string;
  title_en: string;
  description_sv: string | null;
  description_en: string | null;
  recommended_skus: string[];
};

function AdvisorPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const isSv = locale === "sv";
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    supabase.from("use_case_map").select("*").order("sort_order").then(({ data }) => setUseCases((data as UseCase[]) ?? []));
    loadCatalog().then(setCatalog);
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, UseCase[]>();
    useCases.forEach((u) => {
      const arr = m.get(u.category_slug) ?? [];
      arr.push(u);
      m.set(u.category_slug, arr);
    });
    return m;
  }, [useCases]);

  const current = useCases.find((u) => `${u.category_slug}::${u.use_case_slug}` === selected);
  const recommended = current
    ? current.recommended_skus.map((s) => catalog.find((p) => p.sku === s)).filter(Boolean) as ProductRow[]
    : [];

  // Cheapest = shortest lead time; Best = first in list
  const cheapest = recommended.length
    ? [...recommended].sort((a, b) => (a.lead_time_days ?? 99) - (b.lead_time_days ?? 99))[0]
    : null;
  const best = recommended[0] ?? null;

  return (
    <div className="container-page py-10 max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight">{t("advisorPage.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("advisorPage.subtitle")}</p>

      <div className="mt-8">
        <label className="block text-sm font-medium mb-2">{t("advisorPage.useCase")}</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-3 py-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">{t("advisorPage.chooseUseCase")}</option>
          {Array.from(grouped.entries()).map(([cat, list]) => (
            <optgroup key={cat} label={cat.toUpperCase()}>
              {list.map((u) => (
                <option key={u.use_case_slug} value={`${u.category_slug}::${u.use_case_slug}`}>
                  {u.title_en}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {current && (
        <div className="mt-8">
          <p className="text-sm text-muted-foreground">{current.description_en ?? current.description_sv}</p>

          {recommended.length === 0 ? (
            <div className="mt-6 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t("advisorPage.noProducts")} {current.title_en}.
            </div>
          ) : (
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {best && <RecCard p={best} locale={locale} badge={t("advisorPage.bestBadge")} tone="navy" reason={t("advisorPage.bestReason")} />}
              {cheapest && cheapest.sku !== best?.sku && (
                <RecCard p={cheapest} locale={locale} badge={t("advisorPage.cheapestBadge")} tone="green" reason={t("advisorPage.cheapestReason")} />
              )}
              {!cheapest || cheapest.sku === best?.sku ? null : null}
              {recommended.length > 2 && (
                <div className="md:col-span-2 mt-2">
                  <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">{t("advisorPage.allRecommendations")}</h3>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {recommended.map((p) => (
                      <li key={p.id}>
                        <Link to="/$locale/product/$sku" params={{ locale, sku: p.sku }} className="block rounded border border-border p-3 hover:border-info text-sm">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.brand.name} · {p.sku}</div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecCard({ p, locale, badge, tone, reason }: { p: ProductRow; locale: string; badge: string; tone: "navy" | "green"; reason: string }) {
  const tRec = makeT(locale as Locale);
  const badgeCls =
    tone === "navy"
      ? "bg-primary text-primary-foreground"
      : "bg-[oklch(0.92_0.08_155)] text-[oklch(0.32_0.12_155)]";
  return (
    <article className="rounded-lg border border-border bg-card p-5 flex flex-col">
      <span className={`self-start text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${badgeCls}`}>{badge}</span>
      <h3 className="mt-3 font-semibold text-foreground">{p.name}</h3>
      <div className="mt-1 text-xs text-muted-foreground">{p.brand.name} · {p.category.name}</div>
      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{p.sku}</div>
      {p.description && <p className="mt-3 text-sm text-foreground/80 line-clamp-3">{p.description}</p>}
      <p className="mt-3 text-xs text-info italic">{reason}</p>
      <div className="mt-auto pt-4 flex gap-2">
        <Link to="/$locale/product/$sku" params={{ locale, sku: p.sku } as never} className="flex-1 text-center text-sm px-3 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90">
          {tRec("advisorPage.viewDetails")}
        </Link>
        <Link to="/$locale/compare" params={{ locale } as never} search={{ skus: p.sku }} className="text-sm px-3 py-2 rounded-md border border-border hover:border-info">
          {tRec("advisorPage.compare")}
        </Link>
      </div>
    </article>
  );
}

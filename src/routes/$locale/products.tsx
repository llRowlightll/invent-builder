import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { aiSearchProducts, type AiSearchResult } from "@/lib/ai.functions";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";

type FilterKey = "brands" | "cats" | "grades";

export const Route = createFileRoute("/$locale/products")({
  validateSearch: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    ai: z.string().optional(),
  }),
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    const locale = params.locale;
    const canonical = `https://tanstack-start-app.llrowlightll.workers.dev/${locale}/products`;
    return {
      meta: [
        { title: `Produktkatalog — Pneumatik & automation | ${t("common.appName")}` },
        { name: "description", content: "Komplett katalog: pneumatiska cylindrar, elektriska aktuatorer, ventiler, grippers, vakuumsystem och mer. Festo, SMC, Parker, Bosch Rexroth, Norgren. Filtrera, jämför och beställ." },
        { property: "og:title", content: `Produktkatalog — ${t("common.appName")}` },
        { property: "og:url", content: canonical },
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hreflang: "sv", href: "https://tanstack-start-app.llrowlightll.workers.dev/sv/products" },
        { rel: "alternate", hreflang: "en", href: "https://tanstack-start-app.llrowlightll.workers.dev/en/products" },
        { rel: "alternate", hreflang: "de", href: "https://tanstack-start-app.llrowlightll.workers.dev/de/products" },
        { rel: "alternate", hreflang: "es", href: "https://tanstack-start-app.llrowlightll.workers.dev/es/products" },
        { rel: "alternate", hreflang: "x-default", href: "https://tanstack-start-app.llrowlightll.workers.dev/sv/products" },
      ],
    };
  },
  component: ProductsPage,
});

type Grade = "HIGH" | "MEDIUM" | "LOW";
function gradeOf(p: ProductRow): Grade {
  const lt = p.lead_time_days ?? 99;
  if (p.availability === "stock" || lt <= 7) return "HIGH";
  if (lt <= 21) return "MEDIUM";
  return "LOW";
}
const GRADE_STYLE: Record<Grade, string> = {
  HIGH: "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]",
  MEDIUM: "bg-[oklch(0.94_0.08_85)] text-[oklch(0.38_0.12_75)]",
  LOW: "bg-muted text-muted-foreground",
};

function ProductsPage() {
  const { locale } = Route.useParams();
  const search = Route.useSearch();
  const t = makeT(locale as Locale);
  const aiSearch = useServerFn(aiSearchProducts);

  const [items, setItems] = useState<ProductRow[] | null>(null);
  const [q, setQ] = useState(search.q ?? search.ai ?? "");
  const [brands, setBrands] = useState<Set<string>>(new Set(search.brand ? [search.brand] : []));
  const [cats, setCats] = useState<Set<string>>(new Set(search.category ? [search.category] : []));
  const [grades, setGrades] = useState<Set<Grade>>(new Set());
  const [aiMode, setAiMode] = useState(!!search.ai);
  const [aiResult, setAiResult] = useState<AiSearchResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCatalog().then(setItems).catch(console.error);
    // Auto-run AI search if arrived with ?ai= param
    if (search.ai) {
      runAiSearch(search.ai);
    }
  }, []);

  async function runAiSearch(query: string) {
    if (!query.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await aiSearch({ data: { query, locale } });
      setAiResult(result);
      // Apply AI filters to manual filter state
      if (result.category_slug) setCats(new Set([result.category_slug]));
      if (result.brand_slug) setBrands(new Set([result.brand_slug]));
    } catch (e) {
      console.error("AI search failed", e);
    } finally {
      setAiLoading(false);
    }
  }

  function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    runAiSearch(q);
  }

  function clearAi() {
    setAiResult(null);
    setAiMode(false);
    setBrands(new Set());
    setCats(new Set());
    setQ("");
    inputRef.current?.focus();
  }

  const allBrands = useMemo(() => {
    const m = new Map<string, string>();
    items?.forEach((p) => m.set(p.brand.slug, p.brand.name));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const allCats = useMemo(() => {
    const m = new Map<string, string>();
    items?.forEach((p) => m.set(p.category.slug, p.category.name));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const ql = q.toLowerCase();

    return items.filter((p) => {
      if (brands.size && !brands.has(p.brand.slug)) return false;
      if (cats.size && !cats.has(p.category.slug)) return false;
      if (grades.size && !grades.has(gradeOf(p))) return false;

      // AI spec filters
      if (aiResult?.spec_filters?.length) {
        for (const f of aiResult.spec_filters) {
          const specVal = p.specs[f.key]?.value;
          if (specVal == null) continue;
          const num = Number(specVal);
          if (!Number.isFinite(num)) {
            if (f.exact && specVal !== f.exact) return false;
            continue;
          }
          if (f.min != null && num < f.min) return false;
          if (f.max != null && num > f.max) return false;
        }
      }

      // Keyword search (from AI keywords or manual q)
      const searchTerms = aiResult?.keywords?.length
        ? aiResult.keywords
        : ql
        ? [ql]
        : [];

      if (searchTerms.length > 0 && !aiResult?.category_slug && !aiResult?.brand_slug) {
        const haystack = [p.sku, p.name, p.brand.name, p.category.name, p.description ?? ""]
          .join(" ")
          .toLowerCase();
        const matches = searchTerms.some((term) => haystack.includes(term.toLowerCase()));
        if (!matches) return false;
      }

      // Manual text search (non-AI mode)
      if (!aiResult && ql) {
        const haystack = [p.sku, p.name, p.brand.name, p.category.name, p.description ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(ql)) return false;
      }

      return true;
    });
  }, [items, q, brands, cats, grades, aiResult]);

  function toggleSet<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const n = new Set(set);
    n.has(val) ? n.delete(val) : n.add(val);
    setter(n);
  }
  if (!items) return (
    <div className="container-page py-16 text-sm text-muted-foreground flex items-center gap-2">
      <span className="inline-block size-3 rounded-full bg-info animate-pulse" />
      {t("common.loading")}
    </div>
  );

  const activeFilterCount = brands.size + cats.size + grades.size;

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.products")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} {t("products.of")} {items.length} {t("products.count")}
          </p>
        </div>
        <Link
          to="/$locale/compare"
          params={{ locale }}
          className="text-sm px-4 py-2 rounded-md border border-border text-muted-foreground hover:border-info hover:text-info transition"
        >
          ⟷ {t("nav.compare")}
        </Link>
      </div>

      {/* AI search bar */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-info">{t("productsPage.aiSearchLabel")}</span>
          <span className="text-[10px] text-muted-foreground">{t("productsPage.aiSearchDesc")}</span>
        </div>
        <form onSubmit={handleAiSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setAiMode(true)}
            placeholder={t("productsPage.aiSearchPlaceholder")}
            className="flex-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
          />
          <button
            type="submit"
            disabled={aiLoading}
            className="px-4 py-2.5 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {aiLoading ? (
              <><span className="size-3 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />{t("productsPage.analyzing")}</>
            ) : <>✦ {t("common.search")}</>}
          </button>
          {(aiResult || activeFilterCount > 0) && (
            <button type="button" onClick={clearAi}
              className="px-3 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:border-info hover:text-foreground">
              {t("products.clearFilters")}
            </button>
          )}
        </form>

        {aiResult && (
          <div className={`mt-3 rounded-md px-3 py-2.5 text-sm flex items-start gap-2 ${
            aiResult.source === "ai" ? "bg-info/8 border border-info/20" : "bg-surface-alt border border-border"
          }`}>
            <span className="text-info mt-0.5 shrink-0">{aiResult.source === "ai" ? "✦" : "◎"}</span>
            <div>
              <span className="text-foreground">{aiResult.explanation}</span>
              {aiResult.followup && <p className="mt-1 text-muted-foreground text-xs italic">{aiResult.followup}</p>}
              {aiResult.source === "ai" && (aiResult.category_slug || aiResult.brand_slug || aiResult.spec_filters?.length > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {aiResult.category_slug && <span className="text-[10px] bg-info/10 text-info px-2 py-0.5 rounded-full">{t("productsPage.filterCategory")} {aiResult.category_slug}</span>}
                  {aiResult.brand_slug && <span className="text-[10px] bg-info/10 text-info px-2 py-0.5 rounded-full">{t("productsPage.filterBrand")} {aiResult.brand_slug}</span>}
                  {aiResult.spec_filters?.map((f, i) => (
                    <span key={i} className="text-[10px] bg-surface-alt text-muted-foreground px-2 py-0.5 rounded-full">
                      {f.key}: {f.min != null && f.max != null ? `${f.min}–${f.max}` : f.min != null ? `≥${f.min}` : `≤${f.max}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!aiResult && !q && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Festo cylinder 50mm", "SMC kompakt", "vakuumgrepp glas", "PROFINET ventil", "Parker pneumatisk"].map((ex) => (
              <button key={ex} type="button" onClick={() => { setQ(ex); setAiMode(true); }}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-info hover:text-info transition">
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top collapsible filter dropdowns */}
      <div className="flex flex-wrap gap-2 mb-5">
        <AccordionFilter
          label={t("products.brand")}
          count={brands.size}
        >
          <div className="space-y-1.5 p-3">
            {allBrands.map(([slug, name]) => (
              <Check key={slug} label={name} checked={brands.has(slug)} onChange={() => toggleSet(brands, slug, setBrands)} />
            ))}
          </div>
        </AccordionFilter>

        <AccordionFilter
          label={t("products.category")}
          count={cats.size}
        >
          <div className="space-y-1.5 p-3 max-h-64 overflow-y-auto">
            {allCats.map(([slug, name]) => (
              <Check key={slug} label={name} checked={cats.has(slug)} onChange={() => toggleSet(cats, slug, setCats)} />
            ))}
          </div>
        </AccordionFilter>

        <AccordionFilter
          label={t("products.availability")}
          count={grades.size}
        >
          <div className="space-y-1.5 p-3">
            {(["HIGH", "MEDIUM", "LOW"] as Grade[]).map((g) => (
              <Check
                key={g}
                label={g === "HIGH" ? t("products.inStock") : g === "MEDIUM" ? t("products.standard") : t("products.onOrder")}
                checked={grades.has(g)}
                onChange={() => toggleSet(grades, g, setGrades)}
              />
            ))}
          </div>
        </AccordionFilter>

        {/* Active filter chips */}
        {brands.size > 0 && Array.from(brands).map((b) => {
          const name = allBrands.find(([s]) => s === b)?.[1] ?? b;
          return (
            <button key={b} onClick={() => toggleSet(brands, b, setBrands)}
              className="text-xs px-3 py-1.5 rounded-full bg-info/10 text-info border border-info/30 hover:bg-info/20 transition flex items-center gap-1">
              {name} ×
            </button>
          );
        })}
        {cats.size > 0 && Array.from(cats).map((c) => {
          const name = allCats.find(([s]) => s === c)?.[1] ?? c;
          return (
            <button key={c} onClick={() => toggleSet(cats, c, setCats)}
              className="text-xs px-3 py-1.5 rounded-full bg-info/10 text-info border border-info/30 hover:bg-info/20 transition flex items-center gap-1">
              {name} ×
            </button>
          );
        })}
        {grades.size > 0 && Array.from(grades).map((g) => (
          <button key={g} onClick={() => toggleSet(grades, g, setGrades)}
            className="text-xs px-3 py-1.5 rounded-full bg-info/10 text-info border border-info/30 hover:bg-info/20 transition flex items-center gap-1">
            {g === "HIGH" ? t("products.inStock") : g === "MEDIUM" ? t("products.standard") : t("products.onOrder")} ×
          </button>
        ))}
      </div>

      {/* Product grid */}
      <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const g = gradeOf(p);
            return (
              <li
                key={p.id}
                className="group rounded-lg border border-border bg-card flex flex-col transition overflow-hidden hover:border-info"
              >
                <div className="relative h-36 overflow-hidden bg-surface-alt">
                  <img
                    src={getProductImage(p)}
                    alt={p.category.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
                </div>
                <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start gap-2">
                  <Link
                    to="/$locale/product/$sku"
                    params={{ locale, sku: p.sku }}
                    className="font-medium text-foreground hover:text-info line-clamp-2 transition"
                  >
                    {p.name}
                  </Link>
                </div>

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-info">{p.brand.name}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{p.category.name}</span>
                </div>

                {/* Key specs preview */}
                {Object.keys(p.specs).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(p.specs).slice(0, 3).map(([k, v]) => (
                      <span
                        key={k}
                        className="text-[10px] bg-surface-alt px-1.5 py-0.5 rounded text-muted-foreground"
                      >
                        {k.replace(/_/g, " ")}: {v.value}{v.unit ? ` ${v.unit}` : ""}
                      </span>
                    ))}
                  </div>
                )}

                {p.description && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}

                <div className="mt-3 font-mono text-[11px] text-muted-foreground">{p.sku}</div>

                <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${GRADE_STYLE[g]}`}>
                    {g === "HIGH" ? t("productsPage.inStock") : `${p.lead_time_days ?? "—"}d`}
                  </span>
                  <DeliveryBadge availability={p.availability} leadTimeDays={p.lead_time_days} />
                  <div className="flex items-center gap-2">
                    <Link
                      to="/$locale/compare"
                      params={{ locale }}
                      search={{ skus: p.sku }}
                      className="text-[11px] text-muted-foreground hover:text-info transition"
                    >
                      ⟷ {t("productsPage.compareLink")}
                    </Link>
                    <Link
                      to="/$locale/product/$sku"
                      params={{ locale, sku: p.sku }}
                      className="text-xs text-info hover:underline"
                    >
                      {t("productsPage.datasheet")}
                    </Link>
                  </div>
                </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="col-span-full text-center py-16 text-sm text-muted-foreground">
              <div className="text-2xl mb-3">◎</div>
              {aiResult
                ? t("productsPage.noResultsAi")
                : t("productsPage.noResultsManual")}
            </li>
          )}
        </ul>
    </div>
  );
}

function AccordionFilter({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition ${
          open || count > 0
            ? "border-info bg-info/8 text-info"
            : "border-border bg-card text-foreground hover:border-info hover:text-info"
        }`}
      >
        {label}
        {count > 0 && (
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-info text-primary-foreground text-[10px] font-bold">
            {count}
          </span>
        )}
        <span className="text-xs opacity-60">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-card border border-border rounded-lg shadow-lg min-w-[180px]">
          {children}
        </div>
      )}
    </div>
  );
}

function DeliveryBadge({ availability, leadTimeDays }: { availability: string | null; leadTimeDays: number | null }) {
  if (availability === "stock" || (leadTimeDays != null && leadTimeDays <= 3)) {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)] font-medium">På lager</span>;
  }
  if (leadTimeDays != null && leadTimeDays <= 10) {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[oklch(0.94_0.08_85)] text-[oklch(0.38_0.12_75)] font-medium">~{leadTimeDays}d</span>;
  }
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{leadTimeDays ?? "?"}d</span>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:text-info group">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-[var(--info)]" />
      <span className="capitalize group-hover:text-info transition">{label}</span>
    </label>
  );
}

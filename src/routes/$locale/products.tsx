import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { aiSearchProducts, type AiSearchResult } from "@/lib/ai.functions";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/products")({
  validateSearch: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    ai: z.string().optional(),
  }),
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("nav.products")} — ${t("common.appName")}` },
        { name: "description", content: "Sök industriella automationskomponenter — pneumatiska cylindrar, elektriska aktuatorer, ventilärer, grippers. Festo, SMC, Parker, Bosch Rexroth, Norgren." },
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
  const [compare, setCompare] = useState<string[]>([]);

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
  function toggleCompare(sku: string) {
    setCompare((c) =>
      c.includes(sku) ? c.filter((s) => s !== sku) : c.length >= 4 ? c : [...c, sku]
    );
  }

  if (!items) return (
    <div className="container-page py-16 text-sm text-muted-foreground flex items-center gap-2">
      <span className="inline-block size-3 rounded-full bg-info animate-pulse" />
      {t("common.loading")}
    </div>
  );

  return (
    <div className="container-page py-8">
      {/* Header + AI search bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("nav.products")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} av {items.length} komponenter
            </p>
          </div>
          {compare.length > 0 && (
            <Link
              to="/$locale/compare"
              params={{ locale }}
              search={{ skus: compare.join(",") }}
              className="text-sm px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90"
            >
              Jämför {compare.length} produkter →
            </Link>
          )}
        </div>

        {/* AI search bar */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-info">
              ✦ AI-sökning
            </span>
            <span className="text-[10px] text-muted-foreground">
              — beskriv din applikation på svenska eller engelska
            </span>
          </div>
          <form onSubmit={handleAiSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setAiMode(true)}
              placeholder="t.ex. &quot;cylinder 50mm kolvdiameter med 200mm slag för livsmedel&quot; eller &quot;SMC kompakt pneumatisk&quot;"
              className="flex-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="px-4 py-2.5 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {aiLoading ? (
                <>
                  <span className="size-3 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                  Analyserar…
                </>
              ) : (
                <>✦ Sök</>
              )}
            </button>
            {(aiResult || cats.size > 0 || brands.size > 0) && (
              <button
                type="button"
                onClick={clearAi}
                className="px-3 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:border-info hover:text-foreground"
              >
                Rensa
              </button>
            )}
          </form>

          {/* AI explanation banner */}
          {aiResult && (
            <div className={`mt-3 rounded-md px-3 py-2.5 text-sm flex items-start gap-2 ${
              aiResult.source === "ai"
                ? "bg-info/8 border border-info/20"
                : "bg-surface-alt border border-border"
            }`}>
              <span className="text-info mt-0.5 shrink-0">{aiResult.source === "ai" ? "✦" : "◎"}</span>
              <div>
                <span className="text-foreground">{aiResult.explanation}</span>
                {aiResult.followup && (
                  <p className="mt-1 text-muted-foreground text-xs italic">{aiResult.followup}</p>
                )}
                {aiResult.source === "ai" && (aiResult.category_slug || aiResult.brand_slug || aiResult.spec_filters?.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {aiResult.category_slug && (
                      <span className="text-[10px] bg-info/10 text-info px-2 py-0.5 rounded-full">
                        Kategori: {aiResult.category_slug}
                      </span>
                    )}
                    {aiResult.brand_slug && (
                      <span className="text-[10px] bg-info/10 text-info px-2 py-0.5 rounded-full">
                        Varumärke: {aiResult.brand_slug}
                      </span>
                    )}
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

          {/* Quick examples when empty */}
          {!aiResult && !q && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                "Festo cylinder 50mm",
                "SMC kompakt cylinder",
                "vakuumgrepp för glas",
                "PROFINET ventilö",
                "Parker pneumatisk",
              ].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => { setQ(ex); setAiMode(true); }}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-info hover:text-info transition"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-5">
          <FilterGroup label="Varumärke">
            {allBrands.map(([slug, name]) => (
              <Check
                key={slug}
                label={name}
                checked={brands.has(slug)}
                onChange={() => toggleSet(brands, slug, setBrands)}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Kategori">
            {allCats.map(([slug, name]) => (
              <Check
                key={slug}
                label={name}
                checked={cats.has(slug)}
                onChange={() => toggleSet(cats, slug, setCats)}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Tillgänglighet">
            {(["HIGH", "MEDIUM", "LOW"] as Grade[]).map((g) => (
              <Check
                key={g}
                label={g === "HIGH" ? "Lager / snabbt" : g === "MEDIUM" ? "Standard (≤21d)" : "Beställning"}
                checked={grades.has(g)}
                onChange={() => toggleSet(grades, g, setGrades)}
              />
            ))}
          </FilterGroup>
        </aside>

        {/* Product grid */}
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const g = gradeOf(p);
            const inCompare = compare.includes(p.sku);
            return (
              <li
                key={p.id}
                className={`group rounded-lg border bg-card p-4 flex flex-col transition ${
                  inCompare ? "border-info shadow-sm" : "border-border hover:border-info"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <Link
                    to="/$locale/product/$sku"
                    params={{ locale, sku: p.sku }}
                    className="font-medium text-foreground hover:text-info line-clamp-2 transition"
                  >
                    {p.name}
                  </Link>
                  <input
                    type="checkbox"
                    checked={inCompare}
                    onChange={() => toggleCompare(p.sku)}
                    aria-label="Lägg till i jämförelse"
                    className="mt-1 accent-[var(--info)] shrink-0"
                  />
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
                    {g === "HIGH" ? "På lager" : `${p.lead_time_days ?? "—"}d`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/$locale/compare"
                      params={{ locale }}
                      search={{ skus: p.sku }}
                      className="text-[11px] text-muted-foreground hover:text-info transition"
                    >
                      Jämför
                    </Link>
                    <Link
                      to="/$locale/product/$sku"
                      params={{ locale, sku: p.sku }}
                      className="text-xs text-info hover:underline"
                    >
                      Datablad →
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="col-span-full text-center py-16 text-sm text-muted-foreground">
              <div className="text-2xl mb-3">◎</div>
              {aiResult
                ? "Inga produkter matchade AI-sökningen. Prova att justera din beskrivning."
                : "Inga produkter matchade. Justera filter eller sökterm."}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-2">
        {label}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:text-info group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-[var(--info)]"
      />
      <span className="capitalize group-hover:text-info transition">{label}</span>
    </label>
  );
}

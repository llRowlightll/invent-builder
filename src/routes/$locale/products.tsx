import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/products")({
  validateSearch: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
  }),
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return { meta: [{ title: `${t("nav.products")} — ${t("common.appName")}` }] };
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
  const [items, setItems] = useState<ProductRow[] | null>(null);
  const [q, setQ] = useState(search.q ?? "");
  const [brands, setBrands] = useState<Set<string>>(new Set(search.brand ? [search.brand] : []));
  const [cats, setCats] = useState<Set<string>>(new Set(search.category ? [search.category] : []));
  const [grades, setGrades] = useState<Set<Grade>>(new Set());
  const [compare, setCompare] = useState<string[]>([]);

  useEffect(() => { loadCatalog().then(setItems).catch(console.error); }, []);

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
      if (ql && !(
        p.sku.toLowerCase().includes(ql) ||
        p.name.toLowerCase().includes(ql) ||
        p.brand.name.toLowerCase().includes(ql) ||
        (p.description ?? "").toLowerCase().includes(ql)
      )) return false;
      return true;
    });
  }, [items, q, brands, cats, grades]);

  function toggleSet<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const n = new Set(set);
    n.has(val) ? n.delete(val) : n.add(val);
    setter(n);
  }
  function toggleCompare(sku: string) {
    setCompare((c) => c.includes(sku) ? c.filter((s) => s !== sku) : c.length >= 4 ? c : [...c, sku]);
  }

  if (!items) return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.products")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} av {items.length} komponenter</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-6">
          <div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("common.search")}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
            />
          </div>
          <FilterGroup label="Varumärke">
            {allBrands.map(([slug, name]) => (
              <Check key={slug} label={name} checked={brands.has(slug)} onChange={() => toggleSet(brands, slug, setBrands)} />
            ))}
          </FilterGroup>
          <FilterGroup label="Kategori">
            {allCats.map(([slug, name]) => (
              <Check key={slug} label={name} checked={cats.has(slug)} onChange={() => toggleSet(cats, slug, setCats)} />
            ))}
          </FilterGroup>
          <FilterGroup label="Tillgänglighet">
            {(["HIGH", "MEDIUM", "LOW"] as Grade[]).map((g) => (
              <Check key={g} label={g === "HIGH" ? "Lager / snabbt" : g === "MEDIUM" ? "Standard" : "Beställning"} checked={grades.has(g)} onChange={() => toggleSet(grades, g, setGrades)} />
            ))}
          </FilterGroup>
        </aside>

        {/* Grid */}
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const g = gradeOf(p);
            return (
              <li key={p.id} className="group rounded-lg border border-border bg-card p-4 flex flex-col hover:border-info transition">
                <div className="flex justify-between items-start gap-2">
                  <Link
                    to="/$locale/product/$sku"
                    params={{ locale, sku: p.sku }}
                    className="font-medium text-foreground hover:text-info line-clamp-2"
                  >
                    {p.name}
                  </Link>
                  <input
                    type="checkbox"
                    checked={compare.includes(p.sku)}
                    onChange={() => toggleCompare(p.sku)}
                    aria-label="Lägg till i jämförelse"
                    className="mt-1 accent-[var(--info)]"
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-foreground/80">{p.brand.name}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{p.category.name}</span>
                </div>
                {p.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="mt-3 font-mono text-[11px] text-muted-foreground">{p.sku}</div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${GRADE_STYLE[g]}`}>
                    {g === "HIGH" ? "Lager" : g === "MEDIUM" ? `${p.lead_time_days ?? "—"}d` : `${p.lead_time_days ?? "—"}d`}
                  </span>
                  <Link
                    to="/$locale/product/$sku"
                    params={{ locale, sku: p.sku }}
                    className="text-xs text-info hover:underline"
                  >
                    Datablad →
                  </Link>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="col-span-full text-center py-16 text-sm text-muted-foreground">
              Inga produkter matchade. Justera filter eller sökterm.
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
      <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-2">{label}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:text-info">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-[var(--info)]" />
      <span className="capitalize">{label}</span>
    </label>
  );
}

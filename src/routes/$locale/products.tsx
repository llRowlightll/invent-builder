import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/products")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return { meta: [{ title: `${t("nav.products")} — ${t("common.appName")}` }] };
  },
  component: ProductsPage,
});

function ProductsPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const [items, setItems] = useState<ProductRow[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [compare, setCompare] = useState<string[]>([]);

  useEffect(() => {
    loadCatalog().then(setItems).catch(console.error);
  }, []);

  const cats = useMemo(() => {
    const set = new Set<string>();
    items?.forEach((p) => set.add(p.category.slug));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const ql = q.toLowerCase();
    return items.filter(
      (p) =>
        (cat === "all" || p.category.slug === cat) &&
        (!ql ||
          p.sku.toLowerCase().includes(ql) ||
          p.name.toLowerCase().includes(ql) ||
          p.brand.name.toLowerCase().includes(ql)),
    );
  }, [items, q, cat]);

  function toggleCompare(sku: string) {
    setCompare((c) =>
      c.includes(sku) ? c.filter((s) => s !== sku) : c.length >= 4 ? c : [...c, sku],
    );
  }

  if (!items)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="container-page py-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.products")}</h1>
        {compare.length > 0 && (
          <Link
            to="/$locale/compare"
            params={{ locale }}
            search={{ skus: compare.join(",") }}
            className="text-sm px-3 py-1.5 rounded-md bg-gold text-gold-foreground"
          >
            {t("nav.compare")} ({compare.length})
          </Link>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("common.search")}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm flex-1 min-w-[200px]"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">All categories</option>
          {cats.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <ul className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <li key={p.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex justify-between items-start gap-2">
              <Link
                to="/$locale/product/$sku"
                params={{ locale, sku: p.sku }}
                className="font-medium text-foreground hover:underline"
              >
                {p.name}
              </Link>
              <input
                type="checkbox"
                checked={compare.includes(p.sku)}
                onChange={() => toggleCompare(p.sku)}
                aria-label="Add to compare"
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {p.brand.name} · <span className="capitalize">{p.category.slug}</span> · {p.lead_time_days ?? "—"}d
            </div>
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">{p.sku}</div>
            {p.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

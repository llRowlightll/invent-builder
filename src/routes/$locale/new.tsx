import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";
import { addToShoppingList } from "@/lib/cart";

export const Route = createFileRoute("/$locale/new")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("newPage.title")} — ${t("common.appName")}` },
        { name: "description", content: t("newPage.metaDesc") },
      ],
    };
  },
  component: NewPage,
});

function NewPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const [catalog, setCatalog] = useState<ProductRow[] | null>(null);
  const [addedSku, setAddedSku] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog().then(setCatalog);
  }, []);

  // Recently added: Metal Work was latest batch — show the 24 newest
  const recent = useMemo(() => {
    if (!catalog) return [];
    return [...catalog].slice(0, 24); // catalog is ordered newest-first from Supabase
  }, [catalog]);

  // In-stock picks: quick delivery
  const inStock = useMemo(() => {
    if (!catalog) return [];
    return catalog.filter((p) => p.availability === "stock" || (p.lead_time_days ?? 99) <= 3).slice(0, 12);
  }, [catalog]);

  // Group recent by brand for the "new brand" highlight
  const newBrands = useMemo(() => {
    const seen = new Set<string>();
    const brands: { slug: string; name: string }[] = [];
    recent.forEach((p) => {
      if (!seen.has(p.brand.slug)) {
        seen.add(p.brand.slug);
        brands.push(p.brand);
      }
    });
    return brands;
  }, [recent]);

  function quickAdd(p: ProductRow) {
    addToShoppingList({ id: p.id, sku: p.sku, name: p.name });
    setAddedSku(p.sku);
    setTimeout(() => setAddedSku(null), 1800);
  }

  if (!catalog) {
    return (
      <div className="container-page py-16 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="container-page py-10 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-info font-medium mb-1">
          {t("newPage.badge")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{t("newPage.title")}</h1>
        <p className="mt-2 text-muted-foreground text-sm max-w-xl">{t("newPage.subtitle")}</p>
      </div>

      {/* New brand highlight */}
      {newBrands.length > 0 && (
        <div className="mb-10 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-surface-alt/40 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("newPage.newInCatalog")}
            </h2>
            <div className="flex items-center gap-2">
              {newBrands.map((b) => (
                <Link
                  key={b.slug}
                  to="/$locale/products"
                  params={{ locale }}
                  search={{ brand: b.slug }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-border hover:border-info hover:text-info transition"
                >
                  <img
                    src={`/brands/${b.slug}.svg`}
                    alt={b.name}
                    className="h-4 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span>{b.name}</span>
                </Link>
              ))}
            </div>
          </div>
          <ProductGrid products={recent} locale={locale} t={t} addedSku={addedSku} onAdd={quickAdd} />
        </div>
      )}

      {/* In stock / fast delivery */}
      {inStock.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("newPage.inStockNow")}
            </h2>
            <Link
              to="/$locale/products"
              params={{ locale }}
              className="text-xs text-info hover:underline"
            >
              {t("newPage.seeAll")} →
            </Link>
          </div>
          <ProductGrid products={inStock} locale={locale} t={t} addedSku={addedSku} onAdd={quickAdd} />
        </div>
      )}

      {/* CTA */}
      <div className="mt-6 rounded-xl border border-border bg-surface-alt/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="font-semibold">{t("newPage.ctaTitle")}</div>
          <p className="text-sm text-muted-foreground mt-0.5">{t("newPage.ctaBody")}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/$locale/products"
            params={{ locale }}
            className="px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            {t("newPage.browseCatalog")}
          </Link>
          <Link
            to="/$locale/chat"
            params={{ locale }}
            className="px-4 py-2 rounded-md border border-border text-sm hover:border-info hover:text-info transition"
          >
            ✦ {t("nav.chat")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProductGrid({
  products,
  locale,
  t,
  addedSku,
  onAdd,
}: {
  products: ProductRow[];
  locale: string;
  t: ReturnType<typeof makeT>;
  addedSku: string | null;
  onAdd: (p: ProductRow) => void;
}) {
  return (
    <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
      {products.map((p) => {
        const isAdded = addedSku === p.sku;
        const fast = p.availability === "stock" || (p.lead_time_days ?? 99) <= 3;
        return (
          <li
            key={p.id}
            className="rounded-lg border border-border bg-card hover:border-info transition flex flex-col overflow-hidden"
          >
            <div className="h-36 bg-[#f8f9fb] flex items-center justify-center overflow-hidden">
              <img
                src={getProductImage(p)}
                alt={p.category.name}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="p-3 flex flex-col flex-1">
              <div className="text-[10px] text-info font-medium uppercase tracking-wider">
                {p.brand.name}
              </div>
              <Link
                to="/$locale/product/$sku"
                params={{ locale: locale as Locale, sku: p.sku }}
                className="mt-1 font-medium text-sm text-foreground hover:text-info line-clamp-2 transition"
              >
                {p.name}
              </Link>
              <div className="mt-1 text-xs text-muted-foreground">{p.category.name}</div>
              <div className="mt-auto pt-3 border-t border-border mt-2 flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    fast
                      ? "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {fast ? t("productsPage.inStock") : `${p.lead_time_days ?? "—"}d`}
                </span>
                <button
                  type="button"
                  onClick={() => onAdd(p)}
                  className={`text-[11px] font-medium transition px-2 py-0.5 rounded ${
                    isAdded
                      ? "text-[oklch(0.45_0.15_155)] bg-[oklch(0.55_0.15_155)]/10"
                      : "text-muted-foreground hover:text-info"
                  }`}
                >
                  {isAdded ? "✓ " + t("productsPage.added") : "+ " + t("productsPage.addToList")}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";
import { addToShoppingList } from "@/lib/cart";
import { SITE, hreflangLinks } from "@/lib/site";

const UNIT_SUFFIXES = ["mm", "cm", "m", "kg", "g", "bar", "kpa", "mpa", "n", "nm", "w", "kw", "v", "a", "hz", "rpm", "ms", "s", "min", "deg", "pct", "l", "ml", "lmin"];
function formatSpecKey(key: string): string {
  const parts = key.toLowerCase().replace(/_+/g, "_").split("_");
  const last = parts[parts.length - 1];
  const isUnit = UNIT_SUFFIXES.includes(last);
  const labelParts = isUnit ? parts.slice(0, -1) : parts;
  const label = labelParts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return isUnit ? `${label} (${last})` : label;
}

export const Route = createFileRoute("/$locale/product/$sku")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    const { locale, sku } = params;
    const canonical = `${SITE}/${locale}/product/${sku}`;
    return {
      meta: [
        { title: `${sku} — ${t("common.appName")}` },
        { name: "description", content: `${sku} — industrial automation component. Compare specs, lead time and order via Maskinval.` },
        { property: "og:title", content: `${sku} — ${t("common.appName")}` },
        { property: "og:type", content: "product" },
        { property: "og:url", content: canonical },
      ],
      links: [
        { rel: "canonical", href: canonical },
        ...hreflangLinks(`product/${sku}`),
      ],
    };
  },
  component: ProductDetail,
  notFoundComponent: () => {
    return <div className="container-page py-16 text-sm">Product not found.</div>;
  },
});

function ProductDetail() {
  const { locale, sku } = Route.useParams();
  const t = makeT(locale as Locale);
  const [catalog, setCatalog] = useState<ProductRow[] | null>(null);
  const [related, setRelated] = useState<ProductRow[]>([]);
  const [alternatives, setAlternatives] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    (async () => {
      const cat = await loadCatalog();
      setCatalog(cat);
      const product = cat.find((x) => x.sku === sku);
      if (product) {
        const { data: rels } = await supabase
          .from("product_relations")
          .select("related_product_id,relation_type")
          .eq("product_id", product.id);
        const relIds = new Set((rels ?? []).map((r) => r.related_product_id));
        setRelated(cat.filter((p) => relIds.has(p.id)));
        // Dynamic alternatives: same category, different brand, max 6
        const alts = cat
          .filter((p) => p.category.slug === product.category.slug && p.brand.slug !== product.brand.slug && p.sku !== product.sku)
          .slice(0, 6);
        setAlternatives(alts);
      }
      setLoading(false);
    })();
  }, [sku]);

  if (loading) return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;
  const product = catalog?.find((x) => x.sku === sku);
  if (!product) throw notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description ?? undefined,
    brand: { "@type": "Brand", name: product.brand.name },
    category: product.category.name,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      priceCurrency: "SEK",
      seller: { "@type": "Organization", name: "Maskinval" },
    },
    ...(Object.keys(product.specs).length > 0 && {
      additionalProperty: Object.entries(product.specs).map(([k, v]) => ({
        "@type": "PropertyValue",
        name: k.replace(/_/g, " "),
        value: `${v.value}${v.unit ? " " + v.unit : ""}`,
      })),
    }),
  };

  return (
    <div className="container-page py-8 max-w-5xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link to="/$locale/products" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">
        ← {t("nav.products")}
      </Link>

      <div className="mt-4 grid md:grid-cols-[1fr_260px] gap-4 md:gap-6">
        <div>
          <div className="rounded-xl overflow-hidden border border-border mb-5 aspect-[16/7] bg-[#f8f9fb] flex items-center justify-center">
            <img
              src={getProductImage(product)}
              alt={product.category.name}
              className="w-full h-full object-contain"
            />
          </div>
          <BrandBadge slug={product.brand.slug} name={product.brand.name} />
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{product.name}</h1>
          <div className="mt-2 font-mono text-xs text-muted-foreground">{product.sku}</div>
          {product.description && <p className="mt-4 text-sm text-foreground/80 leading-relaxed">{product.description}</p>}
        </div>
        <aside className="rounded-lg border border-border bg-surface-alt p-4 space-y-3 text-sm">
          <Row k={t("productPage.category")} v={product.category.name} />
          {product.ip_rating && <Row k="IP" v={product.ip_rating} />}
          {product.fieldbus && <Row k={t("productPage.fieldbus")} v={product.fieldbus} />}
          {product.voltage && <Row k={t("productPage.voltage")} v={product.voltage} />}
          <button
            type="button"
            onClick={() => {
              addToShoppingList({ id: product.id, sku: product.sku, name: product.name });
              setAddedToCart(true);
              setTimeout(() => setAddedToCart(false), 2000);
            }}
            className={`block w-full text-center mt-2 px-3 py-2 rounded-md text-sm font-semibold transition ${
              addedToCart
                ? "bg-[oklch(0.55_0.15_155)]/15 text-[oklch(0.45_0.15_155)]"
                : "bg-info text-primary-foreground hover:opacity-90"
            }`}
          >
            {addedToCart ? t("productPage.addedToCart") : t("productPage.addToCart")}
          </button>
          <Link
            to="/$locale/compare"
            params={{ locale }}
            search={{ skus: product.sku }}
            className="block text-center mt-2 px-3 py-2 rounded-md border border-border text-muted-foreground text-sm hover:border-info hover:text-info transition"
          >
            {t("common.compare")}
          </Link>

          <div className="border-t border-border pt-3 mt-1 space-y-2">
            {/* Availability */}
            <div className="flex items-center gap-2 text-xs">
              <span className="size-2 rounded-full bg-info shrink-0" />
              <span className="text-foreground font-medium">{t("productPage.orderAvailable")}</span>
            </div>

            {/* RFQ */}
            <Link
              to="/$locale/advisor" params={{ locale } as never}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md border border-border text-sm text-foreground hover:border-info hover:text-info transition"
            >
              <span>📋</span> {t("productPage.requestQuote")}
            </Link>

            {/* AI shortcut */}
            <Link
              to="/$locale/chat" params={{ locale }} search={{} as never}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md bg-surface-alt text-xs text-muted-foreground hover:text-info transition"
            >
              <span className="text-info">✦</span>
              <span>{t("productPage.askAi")}</span>
            </Link>
          </div>
        </aside>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">{t("productPage.priceSection")}</h2>
        <Row k={t("productPage.estimatedDelivery")} v={t("productPage.contactForDelivery")} />
      </section>

      {Object.keys(product.specs).length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("productPage.specification")}
          </h2>
          <table className="mt-3 w-full text-sm border border-border rounded-md overflow-hidden">
            <tbody>
              {Object.entries(product.specs).map(([k, v]) => (
                <tr key={k} className="border-b border-border last:border-0 odd:bg-surface-alt/50">
                  <td className="p-3 text-muted-foreground w-1/2">{formatSpecKey(k)}</td>
                  <td className="p-3 font-medium">{v.value}{v.unit ? ` ${v.unit}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
            {t("productPage.accessoriesRelated")}
          </h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {related.map((r) => <ProductMini key={r.id} p={r} locale={locale} />)}
          </ul>
        </section>
      )}

      {alternatives.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("nav.compare")} — {product.category.name}
            </h2>
            <Link
              to="/$locale/compare"
              params={{ locale }}
              search={{ skus: [product.sku, ...alternatives.slice(0, 3).map((a) => a.sku)].join(",") }}
              className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:border-info hover:text-info transition"
            >
              {t("productPage.compareAll")}
            </Link>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {alternatives.map((r) => <ProductMini key={r.id} p={r} locale={locale} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
function ProductMini({ p, locale }: { p: ProductRow; locale: string }) {
  return (
    <li className="rounded-md border border-border bg-card p-3 hover:border-info">
      <Link to="/$locale/product/$sku" params={{ locale, sku: p.sku } as never} className="block">
        <div className="text-xs text-muted-foreground">{p.brand.name}</div>
        <div className="font-medium text-foreground text-sm mt-0.5 line-clamp-2">{p.name}</div>
        <div className="font-mono text-[10px] text-muted-foreground mt-1">{p.sku}</div>
      </Link>
    </li>
  );
}

function BrandBadge({ slug, name }: { slug: string; name: string }) {
  const [imgOk, setImgOk] = useState(true);
  return imgOk ? (
    <div className="mb-1">
      <img
        src={`/brands/${slug}.svg`}
        alt={name}
        onError={() => setImgOk(false)}
        className="h-7 object-contain"
        loading="eager"
      />
    </div>
  ) : (
    <div className="text-xs uppercase tracking-[0.18em] text-info font-medium">{name}</div>
  );
}

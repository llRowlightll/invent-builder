import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";

const SITE = "https://tanstack-start-app.llrowlightll.workers.dev";

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
        { rel: "alternate", hreflang: "sv", href: `${SITE}/sv/product/${sku}` },
        { rel: "alternate", hreflang: "en", href: `${SITE}/en/product/${sku}` },
        { rel: "alternate", hreflang: "de", href: `${SITE}/de/product/${sku}` },
        { rel: "alternate", hreflang: "es", href: `${SITE}/es/product/${sku}` },
        { rel: "alternate", hreflang: "x-default", href: `${SITE}/sv/product/${sku}` },
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
          <div className="rounded-xl overflow-hidden border border-border mb-5 aspect-[16/7] bg-surface-alt">
            <img
              src={getProductImage(product)}
              alt={product.category.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-info font-medium">{product.brand.name}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{product.name}</h1>
          <div className="mt-2 font-mono text-xs text-muted-foreground">{product.sku}</div>
          {product.description && <p className="mt-4 text-sm text-foreground/80 leading-relaxed">{product.description}</p>}
        </div>
        <aside className="rounded-lg border border-border bg-surface-alt p-4 space-y-3 text-sm">
          <Row k={t("productPage.category")} v={product.category.name} />
          <Row k={t("productPage.leadTime")} v={`${product.lead_time_days ?? "—"} ${t("productPage.days")}`} />
          {product.ip_rating && <Row k="IP" v={product.ip_rating} />}
          {product.fieldbus && <Row k={t("productPage.fieldbus")} v={product.fieldbus} />}
          {product.voltage && <Row k={t("productPage.voltage")} v={product.voltage} />}
          <Link
            to="/$locale/compare"
            params={{ locale }}
            search={{ skus: product.sku }}
            className="block text-center mt-2 px-3 py-2 rounded-md bg-info text-primary-foreground text-sm hover:opacity-90"
          >
            {t("common.compare")}
          </Link>
        </aside>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">{t("productPage.priceSection")}</h2>
        {product.purchase_price != null && (
          <Row
            k={t("productPage.sellingPrice")}
            v={`${(product.purchase_price / (1 - (product.margin ?? 0.35))).toFixed(2)} kr`}
          />
        )}
        <Row
          k={t("productPage.estimatedDelivery")}
          v={
            product.availability === "stock"
              ? t("productPage.inStock12")
              : product.availability === "fast"
              ? t("productPage.fast35")
              : `${product.lead_time_days ?? 14} ${t("productPage.days")}`
          }
        />
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
                  <td className="p-3 capitalize text-muted-foreground w-1/2">{k.replace(/_/g, " ")}</td>
                  <td className="p-3 font-medium">{v.value} {v.unit ?? ""}</td>
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

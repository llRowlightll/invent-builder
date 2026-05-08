import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/product/$sku")({
  head: ({ params }) => ({
    meta: [{ title: `${params.sku} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: ProductDetail,
  notFoundComponent: () => (
    <div className="container-page py-16 text-sm">Product not found.</div>
  ),
});

function ProductDetail() {
  const { locale, sku } = Route.useParams();
  const t = makeT(locale as Locale);
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCatalog().then((c) => {
      const p = c.find((x) => x.sku === sku) ?? null;
      setProduct(p);
      setLoading(false);
    });
  }, [sku]);

  if (loading)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (!product) {
    throw notFound();
  }

  return (
    <div className="container-page py-10 max-w-3xl">
      <Link to="/$locale/products" params={{ locale }} className="text-xs underline text-muted-foreground">
        ← {t("nav.products")}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{product.name}</h1>
      <div className="mt-1 text-sm text-muted-foreground">
        {product.brand.name} · <span className="capitalize">{product.category.slug}</span>
      </div>
      <div className="mt-2 font-mono text-xs">{product.sku}</div>
      {product.description && <p className="mt-4 text-sm">{product.description}</p>}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Specifications</h2>
      <table className="mt-3 w-full text-sm border border-border rounded-md overflow-hidden">
        <tbody>
          {Object.entries(product.specs).map(([k, v]) => (
            <tr key={k} className="border-b border-border last:border-0">
              <td className="p-2.5 capitalize text-muted-foreground w-1/2">{k.replace(/_/g, " ")}</td>
              <td className="p-2.5">
                {v.value} {v.unit ?? ""}
              </td>
            </tr>
          ))}
          <tr className="border-b border-border">
            <td className="p-2.5 text-muted-foreground">Lead time</td>
            <td className="p-2.5">{product.lead_time_days ?? "—"} days</td>
          </tr>
          {product.ip_rating && (
            <tr className="border-b border-border">
              <td className="p-2.5 text-muted-foreground">IP rating</td>
              <td className="p-2.5">{product.ip_rating}</td>
            </tr>
          )}
          {product.fieldbus && (
            <tr className="border-b border-border">
              <td className="p-2.5 text-muted-foreground">Fieldbus</td>
              <td className="p-2.5">{product.fieldbus}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/compare")({
  validateSearch: z.object({ skus: z.string().optional() }),
  head: ({ params }) => ({
    meta: [{ title: `${makeT(params.locale as Locale)("nav.compare")} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { locale } = Route.useParams();
  const { skus } = Route.useSearch();
  const t = makeT(locale as Locale);
  const [items, setItems] = useState<ProductRow[] | null>(null);

  useEffect(() => {
    loadCatalog().then(setItems);
  }, []);

  const compared = useMemo(() => {
    if (!items || !skus) return [];
    const set = skus.split(",");
    return set.map((s: string) => items.find((p) => p.sku === s)).filter(Boolean) as ProductRow[];
  }, [items, skus]);

  const allKeys = useMemo(() => {
    const k = new Set<string>();
    compared.forEach((p) => Object.keys(p.specs).forEach((x) => k.add(x)));
    return Array.from(k).sort();
  }, [compared]);

  if (!items)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (!compared.length)
    return (
      <div className="container-page py-16">
        <p className="text-sm">No products selected.</p>
        <Link to="/$locale/products" params={{ locale }} className="text-sm underline">
          ← {t("nav.products")}
        </Link>
      </div>
    );

  return (
    <div className="container-page py-10 overflow-x-auto">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.compare")}</h1>
      <table className="mt-6 w-full text-sm border border-border rounded-md overflow-hidden">
        <thead className="bg-surface-alt">
          <tr>
            <th className="text-left p-3 text-xs uppercase tracking-wider text-muted-foreground">Spec</th>
            {compared.map((p) => (
              <th key={p.sku} className="text-left p-3">
                <Link to="/$locale/product/$sku" params={{ locale, sku: p.sku }} className="hover:underline">
                  {p.name}
                </Link>
                <div className="font-mono text-[10px] text-muted-foreground">{p.sku}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <td className="p-3 text-muted-foreground">Brand</td>
            {compared.map((p) => <td key={p.sku} className="p-3">{p.brand.name}</td>)}
          </tr>
          <tr className="border-t border-border">
            <td className="p-3 text-muted-foreground">Category</td>
            {compared.map((p) => <td key={p.sku} className="p-3 capitalize">{p.category.slug}</td>)}
          </tr>
          <tr className="border-t border-border">
            <td className="p-3 text-muted-foreground">Lead</td>
            {compared.map((p) => <td key={p.sku} className="p-3">{p.lead_time_days ?? "—"}d</td>)}
          </tr>
          {allKeys.map((k) => (
            <tr key={k} className="border-t border-border">
              <td className="p-3 text-muted-foreground capitalize">{k.replace(/_/g, " ")}</td>
              {compared.map((p) => (
                <td key={p.sku} className="p-3">
                  {p.specs[k] ? `${p.specs[k].value}${p.specs[k].unit ? " " + p.specs[k].unit : ""}` : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

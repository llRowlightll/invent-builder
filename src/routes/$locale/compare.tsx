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

  useEffect(() => { loadCatalog().then(setItems); }, []);

  const compared = useMemo(() => {
    if (!items || !skus) return [];
    return skus.split(",").map((s: string) => items.find((p) => p.sku === s)).filter(Boolean) as ProductRow[];
  }, [items, skus]);

  const allKeys = useMemo(() => {
    const k = new Set<string>();
    compared.forEach((p) => Object.keys(p.specs).forEach((x) => k.add(x)));
    return Array.from(k).sort();
  }, [compared]);

  // Best per row: shortest lead time wins for "Leveranstid"; otherwise highest numeric value
  function bestIndex(values: (string | undefined)[], higherIsBetter = true): number | null {
    const nums = values.map((v) => v == null ? null : Number(v));
    if (nums.every((n) => n === null || Number.isNaN(n!))) return null;
    let best = -1;
    let bestVal = higherIsBetter ? -Infinity : Infinity;
    nums.forEach((n, i) => {
      if (n == null || Number.isNaN(n)) return;
      if (higherIsBetter ? n > bestVal : n < bestVal) { bestVal = n; best = i; }
    });
    return best === -1 ? null : best;
  }

  if (!items) return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (!compared.length)
    return (
      <div className="container-page py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.compare")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Inga produkter valda. Bläddra till katalogen och kryssa i 2–4 produkter.</p>
        <Link to="/$locale/products" params={{ locale }} className="mt-4 inline-block text-sm text-info hover:underline">
          ← {t("nav.products")}
        </Link>
      </div>
    );

  const cols = compared.length;
  const leadIdx = bestIndex(compared.map((p) => p.lead_time_days?.toString()), false);

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.compare")}</h1>
      <p className="text-sm text-muted-foreground mt-1">Jämför {cols} produkter — bästa värde per rad är markerat.</p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-primary text-primary-foreground">
            <tr>
              <th className="text-left p-3 text-xs uppercase tracking-wider font-medium w-44">Egenskap</th>
              {compared.map((p) => (
                <th key={p.sku} className="text-left p-3 align-top">
                  <Link to="/$locale/product/$sku" params={{ locale, sku: p.sku }} className="hover:underline font-medium">
                    {p.name}
                  </Link>
                  <div className="font-mono text-[10px] text-primary-foreground/70 mt-0.5">{p.sku}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Varumärke" cells={compared.map((p) => p.brand.name)} />
            <CompareRow label="Kategori" cells={compared.map((p) => p.category.name)} />
            <CompareRow
              label="Leveranstid (dagar)"
              cells={compared.map((p) => p.lead_time_days?.toString() ?? "—")}
              bestIdx={leadIdx}
            />
            {allKeys.map((k) => {
              const cells = compared.map((p) => p.specs[k] ? `${p.specs[k].value}${p.specs[k].unit ? " " + p.specs[k].unit : ""}` : "—");
              const numericVals = compared.map((p) => p.specs[k]?.value);
              const best = bestIndex(numericVals, true);
              return <CompareRow key={k} label={k.replace(/_/g, " ")} cells={cells} bestIdx={best} />;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareRow({ label, cells, bestIdx }: { label: string; cells: string[]; bestIdx?: number | null }) {
  return (
    <tr className="border-t border-border odd:bg-surface-alt/40">
      <td className="p-3 text-muted-foreground capitalize">{label}</td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={`p-3 ${bestIdx === i ? "bg-[oklch(0.94_0.06_155)] text-[oklch(0.32_0.12_155)] font-semibold" : ""}`}
        >
          {c}
          {bestIdx === i && <span className="ml-2 text-[10px] uppercase">★ Bäst</span>}
        </td>
      ))}
    </tr>
  );
}

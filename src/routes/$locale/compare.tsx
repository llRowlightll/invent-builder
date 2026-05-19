import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";

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
  const navigate = useNavigate();
  const [items, setItems] = useState<ProductRow[] | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(() =>
    skus ? skus.split(",").filter(Boolean) : []
  );

  useEffect(() => {
    loadCatalog().then(setItems);
  }, []);

  // Sync URL when selection changes
  useEffect(() => {
    navigate({
      to: "/$locale/compare",
      params: { locale },
      search: selected.length ? { skus: selected.join(",") } : {},
      replace: true,
    } as never);
  }, [selected]);

  const compared = useMemo(() => {
    if (!items || !selected.length) return [];
    return selected.map((s) => items.find((p) => p.sku === s)).filter(Boolean) as ProductRow[];
  }, [items, selected]);

  const allKeys = useMemo(() => {
    const k = new Set<string>();
    compared.forEach((p) => Object.keys(p.specs).forEach((x) => k.add(x)));
    return Array.from(k).sort();
  }, [compared]);

  // Picker filtered list
  const pickerItems = useMemo(() => {
    if (!items) return [];
    const q = pickerSearch.toLowerCase();
    return items
      .filter((p) => !q || `${p.sku} ${p.name} ${p.brand.name}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [items, pickerSearch]);

  function toggle(sku: string) {
    setSelected((prev) =>
      prev.includes(sku)
        ? prev.filter((s) => s !== sku)
        : prev.length >= 4 ? prev : [...prev, sku]
    );
  }

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

  const leadIdx = bestIndex(compared.map((p) => p.lead_time_days?.toString()), false);

  return (
    <div className="container-page py-8 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.compare")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Välj upp till 4 produkter att jämföra sida vid sida
          </p>
        </div>
        <Link to="/$locale/products" params={{ locale }} className="text-sm text-muted-foreground hover:text-info">
          ← {t("nav.products")}
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Product picker */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card overflow-hidden sticky top-20">
            <div className="px-4 py-3 border-b border-border bg-surface-alt/40">
              <h2 className="text-sm font-medium">Välj produkter ({selected.length}/4)</h2>
            </div>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1.5">
                {compared.map((p) => (
                  <button
                    key={p.sku}
                    onClick={() => toggle(p.sku)}
                    className="flex items-center gap-1 text-[10px] bg-info/10 text-info border border-info/30 px-2 py-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition"
                  >
                    {p.name.slice(0, 20)}{p.name.length > 20 ? "…" : ""} ×
                  </button>
                ))}
              </div>
            )}

            <div className="px-3 py-2 border-b border-border">
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Sök produkt…"
                className="w-full text-xs px-3 py-1.5 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-info"
              />
            </div>

            <div className="divide-y divide-border max-h-[55vh] overflow-y-auto">
              {pickerItems.map((p) => {
                const isOn = selected.includes(p.sku);
                const disabled = !isOn && selected.length >= 4;
                return (
                  <button
                    key={p.sku}
                    onClick={() => !disabled && toggle(p.sku)}
                    disabled={disabled}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition ${
                      isOn
                        ? "bg-info/10"
                        : disabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-surface-alt"
                    }`}
                  >
                    <img
                      src={getProductImage(p)}
                      alt=""
                      className="size-8 object-contain shrink-0 opacity-80"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">{p.brand.name} · {p.sku}</div>
                    </div>
                    <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                      isOn ? "bg-info border-info text-primary-foreground" : "border-border"
                    }`}>
                      {isOn && <span className="text-[10px]">✓</span>}
                    </span>
                  </button>
                );
              })}
              {pickerItems.length === 0 && (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">Inga produkter matchar</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Comparison table */}
        <div className="lg:col-span-2">
          {compared.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <div className="text-4xl mb-3 opacity-20">⟷</div>
              <p className="text-sm text-muted-foreground">Välj minst en produkt i listan till vänster</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Product headers with images */}
              <div className="grid bg-surface-alt border-b border-border" style={{ gridTemplateColumns: `10rem repeat(${compared.length}, 1fr)` }}>
                <div className="p-3" />
                {compared.map((p) => (
                  <div key={p.sku} className="p-3 border-l border-border">
                    <img src={getProductImage(p)} alt="" className="h-16 object-contain mb-2 mx-auto" />
                    <Link
                      to="/$locale/product/$sku"
                      params={{ locale, sku: p.sku }}
                      className="text-xs font-semibold hover:text-info block truncate"
                    >
                      {p.name}
                    </Link>
                    <div className="text-[10px] text-muted-foreground font-mono">{p.sku}</div>
                    <button
                      onClick={() => toggle(p.sku)}
                      className="mt-2 text-[10px] text-muted-foreground/60 hover:text-destructive transition"
                    >
                      Ta bort ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Comparison rows */}
              <table className="w-full text-sm">
                <tbody>
                  <CompareRow
                    label={t("comparePage.brand")}
                    cells={compared.map((p) => p.brand.name)}
                  />
                  <CompareRow
                    label={t("comparePage.category")}
                    cells={compared.map((p) => p.category.name)}
                  />
                  <CompareRow
                    label="Tillgänglighet"
                    cells={compared.map((p) =>
                      p.availability === "stock" ? "✓ I lager" : p.availability === "order" ? "Beställningsvara" : p.availability ?? "—"
                    )}
                  />
                  <CompareRow
                    label={t("comparePage.leadTimeDays")}
                    cells={compared.map((p) => p.lead_time_days ? `${p.lead_time_days} dagar` : "—")}
                    bestIdx={leadIdx}
                    bestLabel={t("comparePage.best")}
                  />
                  {allKeys.map((k) => {
                    const cells = compared.map((p) =>
                      p.specs[k] ? `${p.specs[k].value}${p.specs[k].unit ? " " + p.specs[k].unit : ""}` : "—"
                    );
                    const numVals = compared.map((p) => p.specs[k]?.value);
                    const best = bestIndex(numVals, true);
                    return (
                      <CompareRow
                        key={k}
                        label={k.replace(/_/g, " ")}
                        cells={cells}
                        bestIdx={best}
                        bestLabel={t("comparePage.best")}
                      />
                    );
                  })}

                  {/* CTA row */}
                  <tr className="border-t border-border bg-surface-alt/40">
                    <td className="p-3 text-muted-foreground text-xs">Offertförfrågan</td>
                    {compared.map((p) => (
                      <td key={p.sku} className="p-3 border-l border-border">
                        <Link
                          to="/$locale/product/$sku"
                          params={{ locale, sku: p.sku }}
                          className="block text-center text-xs px-3 py-1.5 rounded-md bg-info text-primary-foreground hover:opacity-90 transition"
                        >
                          RFQ →
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareRow({ label, cells, bestIdx, bestLabel }: {
  label: string; cells: string[]; bestIdx?: number | null; bestLabel?: string;
}) {
  return (
    <tr className="border-t border-border odd:bg-surface-alt/30">
      <td className="p-3 text-muted-foreground text-xs capitalize w-40 shrink-0">{label}</td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={`p-3 text-sm border-l border-border ${
            bestIdx === i ? "bg-[oklch(0.94_0.06_155)] text-[oklch(0.32_0.12_155)] font-semibold" : ""
          }`}
        >
          {c}
          {bestIdx === i && (
            <span className="ml-2 text-[10px] uppercase tracking-wide">{bestLabel ?? "★"}</span>
          )}
        </td>
      ))}
    </tr>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/admin/pricing")({
  component: AdminPricingPage,
});

type Brand = { id: string; name: string };
type Cat   = { id: string; name: string };
type Row   = {
  id: string; sku: string; name: string;
  purchase_price: number | null; margin: number | null;
  brand: Brand; category: Cat; brand_id: string; category_id: string;
};

export default function AdminPricingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [edited, setEdited] = useState<Record<string, { pp: string; margin: string }>>({});
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Bulk update
  const [bulkBrand, setBulkBrand] = useState("");
  const [bulkCat, setBulkCat] = useState("");
  const [bulkMargin, setBulkMargin] = useState("");
  const [bulking, setBulking] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: ps }, { data: bs }, { data: cs }] = await Promise.all([
      supabase.from("products").select("id,sku,name,purchase_price,margin,brand_id,category_id,brand:brands(id,name),category:categories(id,name)").order("name"),
      supabase.from("brands").select("id,name").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    setRows((ps ?? []) as Row[]);
    setBrands((bs ?? []) as Brand[]);
    setCats((cs ?? []) as Cat[]);
    setLoading(false);
  }

  function getVal(id: string, field: "pp" | "margin", fallback: number | null) {
    return edited[id]?.[field] ?? (fallback != null ? String(fallback) : "");
  }

  function setVal(id: string, field: "pp" | "margin", v: string) {
    setEdited((e) => ({ ...e, [id]: { ...e[id], [field]: v } }));
  }

  async function saveRow(id: string) {
    const pp = getVal(id, "pp", null);
    const mg = getVal(id, "margin", null);
    setSaving(id);
    const { error } = await supabase.from("products").update({
      purchase_price: pp !== "" ? Number(pp) : null,
      margin: mg !== "" ? Number(mg) : null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    setSaving(null);
    if (error) {
      setMsg({ text: `Fel: ${error.message}`, ok: false });
    } else {
      setMsg({ text: "Sparat!", ok: true });
      setRows((prev) => prev.map((r) =>
        r.id === id ? { ...r, purchase_price: pp !== "" ? Number(pp) : null, margin: mg !== "" ? Number(mg) : null } : r
      ));
      // Remove from edited state
      setEdited((e) => { const n = { ...e }; delete n[id]; return n; });
    }
  }

  async function bulkUpdate() {
    if (!bulkMargin) return;
    setBulking(true);
    let q = supabase.from("products").update({ margin: Number(bulkMargin), updated_at: new Date().toISOString() });
    if (bulkBrand) q = q.eq("brand_id", bulkBrand);
    if (bulkCat) q = q.eq("category_id", bulkCat);
    const { error } = await q;
    setBulking(false);
    if (error) {
      setMsg({ text: `Fel: ${error.message}`, ok: false });
    } else {
      setMsg({ text: `Marginal uppdaterad till ${bulkMargin}%!`, ok: true });
      await load();
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterBrand && r.brand_id !== filterBrand) return false;
      if (filterCat && r.category_id !== filterCat) return false;
      if (q && !`${r.sku} ${r.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterBrand, filterCat]);

  function sellPrice(r: Row): string {
    const pp = edited[r.id]?.pp != null ? Number(edited[r.id].pp) : r.purchase_price;
    const mg = edited[r.id]?.margin != null ? Number(edited[r.id].margin) : r.margin;
    if (pp == null || mg == null) return "—";
    const sell = pp / (1 - mg / 100);
    return sell.toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " kr";
  }

  const pricedCount = rows.filter((r) => r.purchase_price != null).length;

  return (
    <div className="container-page py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prissättning</h1>
          <p className="text-sm text-muted-foreground">{pricedCount} av {rows.length} produkter har inköpspris</p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-md text-sm ${msg.ok ? "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </div>
      )}

      {/* Bulk update */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium mb-3">Massupdatering marginal</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Varumärke (valfritt)</label>
            <select value={bulkBrand} onChange={(e) => setBulkBrand(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-info">
              <option value="">Alla varumärken</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Kategori (valfritt)</label>
            <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-info">
              <option value="">Alla kategorier</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Ny marginal (%)</label>
            <input type="number" value={bulkMargin} onChange={(e) => setBulkMargin(e.target.value)} placeholder="30"
              className="w-24 text-xs px-3 py-1.5 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-info" />
          </div>
          <button onClick={bulkUpdate} disabled={bulking || !bulkMargin}
            className="text-xs px-4 py-1.5 rounded-md bg-info text-primary-foreground hover:opacity-90 disabled:opacity-50 transition">
            {bulking ? "Uppdaterar…" : "Uppdatera"}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök SKU eller namn…"
          className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-info w-48" />
        <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-info">
          <option value="">Alla varumärken</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-info">
          <option value="">Alla kategorier</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Pricing table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-primary text-primary-foreground z-10">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-medium">Produkt</th>
                <th className="text-left px-4 py-3 text-xs font-medium">Varumärke</th>
                <th className="text-right px-4 py-3 text-xs font-medium">Inköpspris (kr)</th>
                <th className="text-right px-4 py-3 text-xs font-medium">Marginal (%)</th>
                <th className="text-right px-4 py-3 text-xs font-medium">Säljpris</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Laddar…</td></tr>
              )}
              {!loading && filtered.map((r) => {
                const isDirty = edited[r.id] !== undefined;
                return (
                  <tr key={r.id} className={`transition ${isDirty ? "bg-info/5" : "hover:bg-surface-alt/40"}`}>
                    <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{r.sku}</td>
                    <td className="px-4 py-2 max-w-[180px] truncate font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{r.brand.name}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={getVal(r.id, "pp", r.purchase_price)}
                        onChange={(e) => setVal(r.id, "pp", e.target.value)}
                        placeholder="—"
                        className="w-24 text-right text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-info"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={getVal(r.id, "margin", r.margin)}
                        onChange={(e) => setVal(r.id, "margin", e.target.value)}
                        placeholder="30"
                        className="w-20 text-right text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-info"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-xs font-mono font-medium text-foreground/80">
                      {sellPrice(r)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => saveRow(r.id)}
                        disabled={saving === r.id || !isDirty}
                        className="text-xs px-2.5 py-1 rounded border border-border hover:border-info hover:text-info disabled:opacity-30 transition"
                      >
                        {saving === r.id ? "…" : "Spara"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

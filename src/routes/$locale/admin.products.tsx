import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/admin/products")({
  component: AdminProductsPage,
});

type Brand  = { id: string; name: string; slug: string };
type Cat    = { id: string; name: string; slug: string };
type Product = {
  id: string; sku: string; name: string; description: string | null;
  family: string | null; availability: string | null; status: string | null;
  lead_time_days: number | null; image_url: string | null;
  ip_rating: string | null; fieldbus: string | null; voltage: string | null;
  brand_id: string; category_id: string;
  brand: Brand; category: Cat;
  created_at: string;
};

const AVAIL_OPTIONS = ["stock", "order", "discontinued"];
const STATUS_OPTIONS = ["active", "draft", "archived"];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newProd, setNewProd] = useState({ sku: "", name: "", brand_id: "", category_id: "", description: "", lead_time_days: "14", availability: "order" });
  const [adding, setAdding] = useState(false);

  // Edit draft
  const [draft, setDraft] = useState<Partial<Product>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: prods }, { data: bs }, { data: cs }] = await Promise.all([
      // Explicit non-cost columns only — purchase_price/margin are admin-only and
      // not selectable by the authenticated role (managed via admin.pricing).
      supabase.from("products").select("id,sku,name,description,family,brand_id,category_id,lead_time_days,availability,ip_rating,fieldbus,voltage,status,image_url,created_at,updated_at,weight_kg,length_mm,width_mm,height_mm, brand:brands(id,name,slug), category:categories(id,name,slug)").order("name"),
      supabase.from("brands").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts((prods ?? []) as Product[]);
    setBrands((bs ?? []) as Brand[]);
    setCats((cs ?? []) as Cat[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (filterBrand && p.brand_id !== filterBrand) return false;
      if (filterCat && p.category_id !== filterCat) return false;
      if (q && !`${p.sku} ${p.name} ${p.brand.name} ${p.category.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, filterBrand, filterCat]);

  function startEdit(p: Product) {
    setEditing(p);
    setDraft({
      name: p.name, description: p.description ?? "", availability: p.availability ?? "order",
      status: p.status ?? "active", lead_time_days: p.lead_time_days ?? 14,
      image_url: p.image_url ?? "", ip_rating: p.ip_rating ?? "",
      fieldbus: p.fieldbus ?? "", voltage: p.voltage ?? "",
      brand_id: p.brand_id, category_id: p.category_id,
    });
    setMsg(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("products").update({
      name: draft.name,
      description: draft.description || null,
      availability: draft.availability,
      status: draft.status,
      lead_time_days: draft.lead_time_days ? Number(draft.lead_time_days) : null,
      image_url: draft.image_url || null,
      ip_rating: draft.ip_rating || null,
      fieldbus: draft.fieldbus || null,
      voltage: draft.voltage || null,
      brand_id: draft.brand_id,
      category_id: draft.category_id,
      updated_at: new Date().toISOString(),
    }).eq("id", editing.id);
    setSaving(false);
    if (error) {
      setMsg({ text: `Fel: ${error.message}`, ok: false });
    } else {
      setMsg({ text: "Sparat!", ok: true });
      await load();
      setEditing(null);
    }
  }

  async function addProduct() {
    if (!newProd.sku || !newProd.name || !newProd.brand_id || !newProd.category_id) return;
    setAdding(true);
    const { error } = await supabase.from("products").insert({
      sku: newProd.sku.trim().toUpperCase(),
      name: newProd.name.trim(),
      brand_id: newProd.brand_id,
      category_id: newProd.category_id,
      description: newProd.description || null,
      lead_time_days: Number(newProd.lead_time_days) || 14,
      availability: newProd.availability,
      status: "active",
    });
    setAdding(false);
    if (error) {
      setMsg({ text: `Fel: ${error.message}`, ok: false });
    } else {
      setNewProd({ sku: "", name: "", brand_id: "", category_id: "", description: "", lead_time_days: "14", availability: "order" });
      setShowAdd(false);
      setMsg({ text: "Produkt tillagd!", ok: true });
      await load();
    }
  }

  return (
    <div className="container-page py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produkthantering</h1>
          <p className="text-sm text-muted-foreground">{products.length} produkter · {filtered.length} visas</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-sm px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90 transition font-medium"
        >
          + Ny produkt
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-md text-sm ${msg.ok ? "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </div>
      )}

      {/* Add product panel */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium mb-4 text-sm">Ny produkt</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <LabelInput label="SKU *" value={newProd.sku} onChange={(v) => setNewProd((p) => ({ ...p, sku: v }))} placeholder="FESTO-123" />
            <LabelInput label="Namn *" value={newProd.name} onChange={(v) => setNewProd((p) => ({ ...p, name: v }))} placeholder="Produktnamn" />
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Varumärke *</label>
              <select value={newProd.brand_id} onChange={(e) => setNewProd((p) => ({ ...p, brand_id: e.target.value }))}
                className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info">
                <option value="">Välj…</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Kategori *</label>
              <select value={newProd.category_id} onChange={(e) => setNewProd((p) => ({ ...p, category_id: e.target.value }))}
                className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info">
                <option value="">Välj…</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <LabelInput label="Beskrivning" value={newProd.description} onChange={(v) => setNewProd((p) => ({ ...p, description: v }))} />
            <LabelInput label="Ledtid (dagar)" value={newProd.lead_time_days} onChange={(v) => setNewProd((p) => ({ ...p, lead_time_days: v }))} type="number" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addProduct} disabled={adding}
              className="text-sm px-4 py-1.5 rounded-md bg-info text-primary-foreground hover:opacity-90 disabled:opacity-50 transition">
              {adding ? "Lägger till…" : "Lägg till"}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="text-sm px-4 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök SKU, namn, varumärke…"
          className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-info w-56" />
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

      {/* Product table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-primary text-primary-foreground z-10">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-medium">Namn</th>
                <th className="text-left px-4 py-3 text-xs font-medium">Varumärke</th>
                <th className="text-left px-4 py-3 text-xs font-medium">Kategori</th>
                <th className="text-left px-4 py-3 text-xs font-medium">Tillgänglighet</th>
                <th className="text-right px-4 py-3 text-xs font-medium">Ledtid</th>
                <th className="text-center px-4 py-3 text-xs font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Laddar…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Inga produkter matchar</td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-alt/50 transition">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{p.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.brand.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.category.name}</td>
                  <td className="px-4 py-2.5">
                    <AvailBadge v={p.availability} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{p.lead_time_days ? `${p.lead_time_days}d` : "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusBadge v={p.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => startEdit(p)}
                      className="text-xs px-2.5 py-1 rounded border border-border hover:border-info hover:text-info transition">
                      Redigera
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Redigera produkt</h2>
                <p className="text-xs text-muted-foreground font-mono">{editing.sku}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <LabelInput label="Namn" value={draft.name ?? ""} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Beskrivning</label>
                <textarea value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={3} className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Varumärke</label>
                  <select value={draft.brand_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, brand_id: e.target.value }))}
                    className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info">
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Kategori</label>
                  <select value={draft.category_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))}
                    className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info">
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Tillgänglighet</label>
                  <select value={draft.availability ?? "order"} onChange={(e) => setDraft((d) => ({ ...d, availability: e.target.value }))}
                    className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info">
                    {AVAIL_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Status</label>
                  <select value={draft.status ?? "active"} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                    className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info">
                    {STATUS_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <LabelInput label="Ledtid (dagar)" value={String(draft.lead_time_days ?? "")} onChange={(v) => setDraft((d) => ({ ...d, lead_time_days: Number(v) }))} type="number" />
                <LabelInput label="IP-klass" value={draft.ip_rating ?? ""} onChange={(v) => setDraft((d) => ({ ...d, ip_rating: v }))} placeholder="IP65" />
                <LabelInput label="Fältbuss" value={draft.fieldbus ?? ""} onChange={(v) => setDraft((d) => ({ ...d, fieldbus: v }))} placeholder="PROFINET" />
                <LabelInput label="Spänning" value={draft.voltage ?? ""} onChange={(v) => setDraft((d) => ({ ...d, voltage: v }))} placeholder="24VDC" />
              </div>
              <LabelInput label="Bild URL" value={draft.image_url ?? ""} onChange={(v) => setDraft((d) => ({ ...d, image_url: v }))} placeholder="https://…" />
              {msg && <div className={`text-xs px-3 py-2 rounded ${msg.ok ? "text-[oklch(0.32_0.12_155)]" : "text-destructive"}`}>{msg.text}</div>}
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} disabled={saving}
                  className="flex-1 text-sm font-medium px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? "Sparar…" : "Spara"}
                </button>
                <button onClick={() => setEditing(null)}
                  className="text-sm px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground transition">
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabelInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info" />
    </div>
  );
}

function AvailBadge({ v }: { v: string | null }) {
  const map: Record<string, string> = {
    stock: "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]",
    order: "bg-[oklch(0.94_0.08_85)] text-[oklch(0.38_0.12_75)]",
    discontinued: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${map[v ?? "order"] ?? "bg-muted text-muted-foreground"}`}>
      {v === "stock" ? "I lager" : v === "order" ? "Beställ" : v === "discontinued" ? "Utgått" : v ?? "—"}
    </span>
  );
}

function StatusBadge({ v }: { v: string | null }) {
  const map: Record<string, string> = {
    active: "text-[oklch(0.60_0.18_155)]", draft: "text-muted-foreground", archived: "text-muted-foreground/50",
  };
  return <span className={`text-[10px] ${map[v ?? "draft"] ?? ""}`}>{v ?? "draft"}</span>;
}

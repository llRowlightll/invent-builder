import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/admin/knowledge")({
  component: AdminKnowledgePage,
});

type Chunk = {
  id: string; source_file: string; brand: string | null;
  product_family: string | null; chunk_index: number; content: string; created_at: string;
};
type BrandStat = { brand: string | null; n: number };

export default function AdminKnowledgePage() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [stats, setStats] = useState<BrandStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Add chunk
  const [showAdd, setShowAdd] = useState(false);
  const [newChunk, setNewChunk] = useState({ source_file: "", brand: "", product_family: "", content: "" });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    loadStats();
    search ? searchChunks() : loadRecent();
  }, []);

  async function loadStats() {
    const { count } = await supabase.from("knowledge_chunks").select("*", { count: "exact", head: true });
    setTotal(count ?? 0);

    // Brand stats
    const { data } = await supabase.from("knowledge_chunks").select("brand");
    const counts: Record<string, number> = {};
    (data ?? []).forEach((r: { brand: string | null }) => {
      const b = r.brand ?? "Okänd";
      counts[b] = (counts[b] ?? 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([brand, n]) => ({ brand, n }));
    setStats(sorted);
    setBrands(sorted.map((s) => s.brand ?? "Okänd"));
  }

  async function loadRecent() {
    setLoading(true);
    let q = supabase.from("knowledge_chunks").select("*").order("created_at", { ascending: false }).limit(50);
    if (filterBrand) q = q.eq("brand", filterBrand);
    const { data } = await q;
    setChunks((data ?? []) as Chunk[]);
    setLoading(false);
  }

  async function searchChunks() {
    if (!search.trim()) { loadRecent(); return; }
    setLoading(true);
    let q = supabase.from("knowledge_chunks").select("*").ilike("content", `%${search}%`).limit(50);
    if (filterBrand) q = q.eq("brand", filterBrand);
    const { data } = await q;
    setChunks((data ?? []) as Chunk[]);
    setLoading(false);
  }

  async function addChunk() {
    if (!newChunk.content.trim() || !newChunk.source_file.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("knowledge_chunks").insert({
      source_file: newChunk.source_file.trim(),
      brand: newChunk.brand.trim() || null,
      product_family: newChunk.product_family.trim() || null,
      chunk_index: 0,
      content: newChunk.content.trim(),
    });
    setAdding(false);
    if (error) {
      setMsg({ text: `Fel: ${error.message}`, ok: false });
    } else {
      setMsg({ text: "Chunk tillagd!", ok: true });
      setNewChunk({ source_file: "", brand: "", product_family: "", content: "" });
      setShowAdd(false);
      loadStats();
      loadRecent();
    }
  }

  async function deleteChunk(id: string) {
    if (!confirm("Ta bort denna chunk?")) return;
    await supabase.from("knowledge_chunks").delete().eq("id", id);
    setChunks((prev) => prev.filter((c) => c.id !== id));
    setTotal((t) => t - 1);
  }

  return (
    <div className="container-page py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString("sv-SE")} chunks · PDF-extrakt för AI-chatten</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-sm px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90 transition font-medium"
        >
          + Lägg till manuell chunk
        </button>
      </div>

      {/* Brand stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {stats.slice(0, 6).map((s) => (
          <button
            key={s.brand}
            onClick={() => { setFilterBrand(filterBrand === (s.brand ?? "") ? "" : (s.brand ?? "")); }}
            className={`rounded-lg border p-3 text-left transition hover:border-info ${
              filterBrand === (s.brand ?? "") ? "border-info bg-info/5" : "border-border bg-card"
            }`}
          >
            <div className="text-xs text-muted-foreground truncate">{s.brand ?? "Okänd"}</div>
            <div className="text-lg font-bold tabular-nums mt-0.5">{s.n.toLocaleString("sv-SE")}</div>
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-md text-sm ${msg.ok ? "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </div>
      )}

      {/* Add chunk */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium mb-4 text-sm">Lägg till manuell knowledge chunk</h2>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Källfil / namn *</label>
              <input value={newChunk.source_file} onChange={(e) => setNewChunk((p) => ({ ...p, source_file: e.target.value }))}
                placeholder="manual-entry.txt" className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Varumärke</label>
              <input value={newChunk.brand} onChange={(e) => setNewChunk((p) => ({ ...p, brand: e.target.value }))}
                placeholder="Festo" className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Produktfamilj</label>
              <input value={newChunk.product_family} onChange={(e) => setNewChunk((p) => ({ ...p, product_family: e.target.value }))}
                placeholder="DNC" className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info" />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-muted-foreground block mb-1">Innehåll *</label>
            <textarea value={newChunk.content} onChange={(e) => setNewChunk((p) => ({ ...p, content: e.target.value }))}
              rows={5} placeholder="Teknisk information som AI:n ska känna till…"
              className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-info resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={addChunk} disabled={adding}
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

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchChunks()}
          placeholder="Sök i innehåll… (Enter)"
          className="text-sm px-3 py-1.5 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-info flex-1"
        />
        <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-info">
          <option value="">Alla varumärken</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button onClick={searchChunks}
          className="text-sm px-4 py-1.5 rounded-md bg-info text-primary-foreground hover:opacity-90 transition">
          Sök
        </button>
        {(search || filterBrand) && (
          <button onClick={() => { setSearch(""); setFilterBrand(""); loadRecent(); }}
            className="text-sm px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition">
            Rensa
          </button>
        )}
      </div>

      {/* Chunks list */}
      <div className="rounded-xl border border-border overflow-hidden">
        {loading && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Laddar…</div>
        )}
        {!loading && chunks.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Inga chunks matchar sökningen</div>
        )}
        <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
          {chunks.map((c) => (
            <div key={c.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.brand && (
                      <span className="text-[10px] bg-info/10 text-info px-1.5 py-0.5 rounded font-medium">{c.brand}</span>
                    )}
                    {c.product_family && (
                      <span className="text-[10px] bg-surface-alt text-muted-foreground px-1.5 py-0.5 rounded">{c.product_family}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 font-mono truncate">{c.source_file} #{c.chunk_index}</span>
                  </div>
                  <div className={`mt-1 text-xs text-foreground/80 leading-relaxed ${expanded === c.id ? "" : "line-clamp-2"}`}>
                    {c.content}
                  </div>
                  {c.content.length > 200 && (
                    <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                      className="text-[10px] text-info hover:underline mt-0.5">
                      {expanded === c.id ? "Visa mindre" : "Visa mer"}
                    </button>
                  )}
                </div>
                <button onClick={() => deleteChunk(c.id)}
                  className="shrink-0 text-xs text-muted-foreground/40 hover:text-destructive transition">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {chunks.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-right">Visar {chunks.length} av {total.toLocaleString("sv-SE")} chunks</p>
      )}
    </div>
  );
}

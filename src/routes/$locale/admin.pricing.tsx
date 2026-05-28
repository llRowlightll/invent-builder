import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/admin/pricing")({
  component: AdminPricingPage,
});

// ── types ─────────────────────────────────────────────────────────────────────
type Brand = { id: string; name: string };
type Cat   = { id: string; name: string };
type Row   = {
  id: string; sku: string; name: string;
  purchase_price: number | null; margin: number | null;
  brand: Brand; category: Cat; brand_id: string; category_id: string;
};
type Proposal = {
  sku: string; name: string; brand: string;
  purchase_price: number;
  confidence: "high" | "medium" | "low";
  evidence: string;
  currency_note?: string;
};
type ProposalRow = Proposal & {
  selected: boolean;
  margin: string;   // editable by admin
};

const EDGE = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/extract-prices";

// ── helpers ───────────────────────────────────────────────────────────────────
function sellPrice(pp: number | null, margin: string | null | number): string {
  const mg = typeof margin === "string" ? Number(margin) : margin;
  if (pp == null || mg == null || isNaN(pp) || isNaN(mg) || mg >= 100) return "—";
  return (pp / (1 - mg / 100)).toLocaleString("sv-SE", {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }) + " kr";
}

function confidenceBadge(c: "high" | "medium" | "low") {
  const styles: Record<string, string> = {
    high:   "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    low:    "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  };
  const labels: Record<string, string> = { high: "Hög", medium: "Medel", low: "Låg" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${styles[c]}`}>
      {labels[c]}
    </span>
  );
}

// ── PDF extraction (client-side via pdfjs-dist) ───────────────────────────────
async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    // Use CDN worker to avoid bundling issues
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc   = await page.getTextContent();
      parts.push(tc.items.map((item) => ("str" in item ? (item.str ?? "") : "")).join(" "));
    }
    return parts.join("\n");
  } catch (err) {
    console.error("PDF extraction failed:", err);
    throw new Error("Kunde inte läsa PDF. Prova att klistra in texten manuellt.");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminPricingPage() {
  const [tab, setTab] = useState<"list" | "intake">("list");

  // ── Prislista state ────────────────────────────────────────────────────────
  const [rows,       setRows]       = useState<Row[]>([]);
  const [brands,     setBrands]     = useState<Brand[]>([]);
  const [cats,       setCats]       = useState<Cat[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCat,   setFilterCat]   = useState("");
  const [saving,     setSaving]     = useState<string | null>(null);
  const [edited,     setEdited]     = useState<Record<string, { pp: string; margin: string }>>({});
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null);
  const [bulkBrand,  setBulkBrand]  = useState("");
  const [bulkCat,    setBulkCat]    = useState("");
  const [bulkMargin, setBulkMargin] = useState("");
  const [bulking,    setBulking]    = useState(false);

  // ── Prisintag state ────────────────────────────────────────────────────────
  const [inputText,   setInputText]   = useState("");
  const [analyzing,   setAnalyzing]   = useState(false);
  const [proposals,   setProposals]   = useState<ProposalRow[]>([]);
  const [intakeMsg,   setIntakeMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [saving2,     setSaving2]     = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  // ── data loading ───────────────────────────────────────────────────────────
  async function load() {
    setLoading(true);
    const [{ data: ps }, { data: bs }, { data: cs }] = await Promise.all([
      supabase.from("products")
        .select("id,sku,name,purchase_price,margin,brand_id,category_id,brand:brands(id,name),category:categories(id,name)")
        .order("name"),
      supabase.from("brands").select("id,name").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    setRows((ps ?? []) as Row[]);
    setBrands((bs ?? []) as Brand[]);
    setCats((cs ?? []) as Cat[]);
    setLoading(false);
  }

  // ── Prislista helpers ──────────────────────────────────────────────────────
  function getVal(id: string, field: "pp" | "margin", fallback: number | null) {
    return edited[id]?.[field] ?? (fallback != null ? String(fallback) : "");
  }
  function setVal(id: string, field: "pp" | "margin", v: string) {
    setEdited((e) => ({ ...e, [id]: { ...e[id], [field]: v } }));
  }

  async function saveRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const ppStr = edited[id]?.pp   ?? (row.purchase_price != null ? String(row.purchase_price) : "");
    const mgStr = edited[id]?.margin ?? (row.margin        != null ? String(row.margin)         : "");
    const newPp = ppStr !== "" ? Number(ppStr) : null;
    const newMg = mgStr !== "" ? Number(mgStr) : null;
    setSaving(id);
    setMsg(null);
    const { error } = await supabase.from("products")
      .update({ purchase_price: newPp, margin: newMg, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(null);
    if (error) {
      setMsg({ text: `Fel: ${error.message}`, ok: false });
    } else {
      setMsg({ text: `✓ Sparat${newPp && newMg != null ? ` — säljpris: ${sellPrice(newPp, newMg)}` : ""}`, ok: true });
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, purchase_price: newPp, margin: newMg } : r));
      setEdited((e) => { const n = { ...e }; delete n[id]; return n; });
      setTimeout(() => setMsg(null), 4000);
    }
  }

  async function bulkUpdate() {
    if (!bulkMargin) return;
    setBulking(true);
    let q = supabase.from("products")
      .update({ margin: Number(bulkMargin), updated_at: new Date().toISOString() });
    if (bulkBrand) q = q.eq("brand_id", bulkBrand);
    if (bulkCat)   q = q.eq("category_id", bulkCat);
    const { error } = await q;
    setBulking(false);
    if (error) {
      setMsg({ text: `Fel: ${error.message}`, ok: false });
    } else {
      setMsg({ text: `✓ Marginal uppdaterad till ${bulkMargin}%`, ok: true });
      await load();
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterBrand && r.brand_id   !== filterBrand) return false;
      if (filterCat   && r.category_id !== filterCat)  return false;
      if (q && !`${r.sku} ${r.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterBrand, filterCat]);

  // ── Prisintag: PDF upload ──────────────────────────────────────────────────
  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfLoading(true);
    try {
      const text = await extractPdfText(file);
      setInputText((prev) => prev ? prev + "\n\n---\n\n" + text : text);
    } catch (err: unknown) {
      setIntakeMsg({ text: (err as Error).message, ok: false });
    } finally {
      setPdfLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── Prisintag: analyze ─────────────────────────────────────────────────────
  async function analyze() {
    if (!inputText.trim()) return;
    setAnalyzing(true);
    setProposals([]);
    setIntakeMsg(null);
    try {
      const res = await fetch(EDGE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json() as { proposals?: Proposal[]; error?: string };
      if (data.error) throw new Error(data.error);
      const list = (data.proposals ?? []).map((p) => ({
        ...p,
        selected: true,
        margin:   "30",  // default margin — admin can adjust
      }));
      if (list.length === 0) {
        setIntakeMsg({ text: "Inga priser hittades. Kontrollera att texten innehåller priser och produktnamn/artikelnummer.", ok: false });
      } else {
        setIntakeMsg({ text: `${list.length} pris${list.length !== 1 ? "er" : ""} hittades — granska och bekräfta nedan.`, ok: true });
      }
      setProposals(list);
    } catch (err: unknown) {
      setIntakeMsg({ text: `Fel: ${(err as Error).message}`, ok: false });
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Prisintag: confirm selected ────────────────────────────────────────────
  async function confirmSelected() {
    const toSave = proposals.filter((p) => p.selected);
    if (!toSave.length) return;
    setSaving2(true);
    setIntakeMsg(null);
    let saved = 0;
    let failed = 0;
    for (const p of toSave) {
      const mg = Number(p.margin);
      const { error } = await supabase.from("products")
        .update({ purchase_price: p.purchase_price, margin: isNaN(mg) ? null : mg, updated_at: new Date().toISOString() })
        .eq("sku", p.sku);
      if (error) { failed++; } else { saved++; }
    }
    setSaving2(false);
    if (failed === 0) {
      setIntakeMsg({ text: `✓ ${saved} pris${saved !== 1 ? "er" : ""} sparade!`, ok: true });
      setProposals([]);
      setInputText("");
      await load();
    } else {
      setIntakeMsg({ text: `${saved} sparade, ${failed} misslyckades.`, ok: saved > 0 });
      await load();
    }
  }

  const pricedCount = rows.filter((r) => r.purchase_price != null).length;
  const selectedCount = proposals.filter((p) => p.selected).length;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="container-page py-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prissättning</h1>
          <p className="text-sm text-muted-foreground">
            {pricedCount} av {rows.length} produkter har inköpspris
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(["list", "intake"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition rounded-t-md border-b-2 -mb-px
              ${tab === t
                ? "border-info text-info"
                : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "list" ? "Prislista" : "Prisintag (AI)"}
          </button>
        ))}
      </div>

      {/* ── TAB: Prislista ──────────────────────────────────────────────────── */}
      {tab === "list" && (
        <>
          {msg && (
            <div className={`mb-4 px-4 py-2 rounded-md text-sm ${msg.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"}`}>
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
                <input type="number" value={bulkMargin} onChange={(e) => setBulkMargin(e.target.value)}
                  placeholder="30"
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

          {/* Table */}
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
                          <input type="number" value={getVal(r.id, "pp", r.purchase_price)}
                            onChange={(e) => setVal(r.id, "pp", e.target.value)} placeholder="—"
                            className="w-24 text-right text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-info" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" value={getVal(r.id, "margin", r.margin)}
                            onChange={(e) => setVal(r.id, "margin", e.target.value)} placeholder="30"
                            className="w-20 text-right text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-info" />
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-mono font-medium text-foreground/80">
                          {sellPrice(
                            edited[r.id]?.pp !== undefined ? Number(edited[r.id].pp) : r.purchase_price,
                            edited[r.id]?.margin !== undefined ? edited[r.id].margin : r.margin,
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => saveRow(r.id)} disabled={saving === r.id || !isDirty}
                            className="text-xs px-2.5 py-1 rounded border border-border hover:border-info hover:text-info disabled:opacity-30 transition">
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
        </>
      )}

      {/* ── TAB: Prisintag (AI) ─────────────────────────────────────────────── */}
      {tab === "intake" && (
        <div className="space-y-6">

          {/* Instructions */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-1">Hur det fungerar</h2>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Klistra in en offert, ett mejl eller en prislista — eller ladda upp en PDF.</li>
              <li>Klicka <strong className="text-foreground">Analysera</strong> — AI:n matchar priser mot produktkatalogen.</li>
              <li>Granska resultaten, justera marginal per rad, avmarkera felaktiga matchningar.</li>
              <li>Klicka <strong className="text-foreground">Bekräfta valda</strong> för att spara priserna.</li>
            </ol>
          </div>

          {/* Input area */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-sm font-medium">Offert / mejl / prislista</label>
              <div className="flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={pdfLoading}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-info hover:text-info disabled:opacity-50 transition"
                >
                  {pdfLoading ? (
                    <span className="animate-pulse">Läser PDF…</span>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Ladda upp PDF
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setInputText(""); setProposals([]); setIntakeMsg(null); }}
                  disabled={!inputText}
                  className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-destructive hover:text-destructive disabled:opacity-30 transition"
                >
                  Rensa
                </button>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Klistra in text här, t.ex:

Parker Hannifin AB – Offert 2024-06-01
P1D-S063MS-0200    Ø63 200mm ISO 15552      2 385 kr
P1D-S080MS-0200    Ø80 200mm ISO 15552      3 120 kr
...`}
              rows={10}
              className="w-full text-xs font-mono rounded-md border border-border bg-background px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-info placeholder:text-muted-foreground/50"
            />

            <div className="flex justify-end">
              <button
                onClick={analyze}
                disabled={analyzing || !inputText.trim()}
                className="px-5 py-2 text-sm font-medium rounded-md bg-info text-primary-foreground hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
              >
                {analyzing && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {analyzing ? "Analyserar…" : "Analysera"}
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {intakeMsg && (
            <div className={`px-4 py-2 rounded-md text-sm ${intakeMsg.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"}`}>
              {intakeMsg.text}
            </div>
          )}

          {/* Proposals table */}
          {proposals.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {selectedCount} av {proposals.length} markerade
                  </span>
                  <button
                    onClick={() => setProposals((p) => p.map((r) => ({ ...r, selected: true })))}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Markera alla
                  </button>
                  <button
                    onClick={() => setProposals((p) => p.map((r) => ({ ...r, selected: false })))}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Avmarkera alla
                  </button>
                </div>
                <button
                  onClick={confirmSelected}
                  disabled={saving2 || selectedCount === 0}
                  className="px-4 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {saving2 && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                  {saving2 ? "Sparar…" : `Bekräfta ${selectedCount} pris${selectedCount !== 1 ? "er" : ""}`}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2.5 w-8" />
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">SKU</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Produkt</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Varumärke</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Extraherat pris</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Konfidensindikator</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Marginal (%)</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Säljpris</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {proposals.map((p, i) => (
                      <tr
                        key={`${p.sku}-${i}`}
                        className={`transition ${p.selected ? "bg-card" : "opacity-40 bg-muted/20"}`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={p.selected}
                            onChange={(e) => setProposals((prev) =>
                              prev.map((r, j) => j === i ? { ...r, selected: e.target.checked } : r)
                            )}
                            className="rounded border-border accent-info cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {p.sku}
                        </td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <div className="truncate text-xs font-medium">{p.name}</div>
                          {p.evidence && (
                            <div className="truncate text-[10px] text-muted-foreground/70 mt-0.5 italic">
                              „{p.evidence.slice(0, 60)}{p.evidence.length > 60 ? "…" : ""}"
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{p.brand}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-mono text-xs font-medium">
                            {p.purchase_price.toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr
                          </span>
                          {p.currency_note && (
                            <div className="text-[10px] text-muted-foreground/60">{p.currency_note}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {confidenceBadge(p.confidence)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            value={p.margin}
                            onChange={(e) => setProposals((prev) =>
                              prev.map((r, j) => j === i ? { ...r, margin: e.target.value } : r)
                            )}
                            className="w-16 text-right text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-info"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-medium">
                          {sellPrice(p.purchase_price, p.margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

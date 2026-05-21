import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth, useIsAdmin } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { clearCatalogCache } from "@/lib/catalog";

export const Route = createFileRoute("/$locale/admin/import")({
  head: ({ params }) => ({
    meta: [{ title: `Import — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: ImportPage,
});

interface ParsedRow {
  sku: string;
  name: string;
  brand_slug: string;
  category_slug: string;
  family?: string;
  description?: string;
  lead_time_days?: string;
  ip_rating?: string;
  fieldbus?: string;
  voltage?: string;
}

type ImportState = "idle" | "preview" | "importing" | "done";

const REQUIRED_COLS = ["sku", "name", "brand_slug", "category_slug"];
const TEMPLATE_CSV = `sku,name,brand_slug,category_slug,family,description,lead_time_days,ip_rating,fieldbus,voltage
FESTO-DSBC-50-200,Festo DSBC ISO-cylinder 50x200,festo,cylinder,DSBC,Dubbelverkande ISO-cylinder,7,,,
SMC-CQ2B32-50D,SMC Kompakt cylinder 32x50,smc,cylinder,CQ2,,14,,,
`;

function ImportPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();
  const dropRef = useRef<HTMLDivElement>(null);

  const [rawCsv, setRawCsv] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [state, setState] = useState<ImportState>("idle");
  const [log, setLog] = useState<{ type: "ok" | "err" | "info"; msg: string }[]>([]);
  const [version, setVersion] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!loading && !user) window.location.href = `/${locale}/login`;
  }, [user, loading, locale]);

  function parseCsv(text: string) {
    setRawCsv(text);
    if (!text.trim()) { setRows([]); setParseErrors([]); setState("idle"); return; }
    const result = Papa.parse<ParsedRow>(text, { header: true, skipEmptyLines: true });
    const cols = result.meta.fields ?? [];
    const missing = REQUIRED_COLS.filter(c => !cols.includes(c));
    if (missing.length) {
      setParseErrors([`Saknar kolumner: ${missing.join(", ")}`]);
      setRows([]);
      setState("idle");
      return;
    }
    setParseErrors(result.errors.map(e => `Rad ${e.row}: ${e.message}`));
    setRows(result.data);
    setState("preview");
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => parseCsv((e.target?.result as string) ?? "");
    reader.readAsText(file, "UTF-8");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
  }

  async function runImport() {
    setState("importing");
    setLog([]);

    const [{ data: brands }, { data: cats }] = await Promise.all([
      supabase.from("brands").select("id,slug"),
      supabase.from("categories").select("id,slug"),
    ]);
    const bMap = new Map(brands?.map(b => [b.slug, b.id]));
    const cMap = new Map(cats?.map(c => [c.slug, c.id]));

    const valid: { sku: string; name: string; brand_id: string; category_id: string; family: string | null; description: string | null; lead_time_days: number; ip_rating: string | null; fieldbus: string | null; voltage: string | null }[] = [];
    const skipped: string[] = [];

    for (const r of rows) {
      const brandId = bMap.get(r.brand_slug?.trim());
      const catId = cMap.get(r.category_slug?.trim());
      if (!r.sku || !r.name || !brandId || !catId) {
        skipped.push(r.sku || "(tom SKU)");
        continue;
      }
      valid.push({
        sku: r.sku.trim(),
        name: r.name.trim(),
        brand_id: brandId,
        category_id: catId,
        family: r.family?.trim() || null,
        description: r.description?.trim() || null,
        lead_time_days: r.lead_time_days ? Number(r.lead_time_days) : 14,
        ip_rating: r.ip_rating?.trim() || null,
        fieldbus: r.fieldbus?.trim() || null,
        voltage: r.voltage?.trim() || null,
      });
    }

    if (skipped.length) {
      setLog(l => [...l, { type: "err", msg: `Hoppades över (okänd brand/kategori): ${skipped.join(", ")}` }]);
    }
    if (!valid.length) {
      setLog(l => [...l, { type: "err", msg: "Inga giltiga rader att importera." }]);
      setState("preview");
      return;
    }

    const { error } = await supabase.from("products").upsert(valid, { onConflict: "sku" });
    if (error) {
      setLog(l => [...l, { type: "err", msg: `Databasfel: ${error.message}` }]);
      setState("preview");
      return;
    }

    setLog(l => [...l, { type: "ok", msg: `${valid.length} produkter importerade/uppdaterade.` }]);

    if (version.trim()) {
      await supabase.from("dataset_versions").insert({
        version: version.trim(),
        notes: `CSV-import av ${valid.length} produkter`,
        created_by: user!.id,
      });
      setLog(l => [...l, { type: "info", msg: `Version loggad: ${version}` }]);
    }

    clearCatalogCache();
    setState("done");
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "maskinval-mall.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !user) return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (!isAdmin) return (
    <div className="container-page py-16 max-w-md text-center">
      <div className="text-4xl mb-4">🔒</div>
      <h1 className="text-xl font-semibold">Admin-åtkomst krävs</h1>
      <p className="mt-2 text-sm text-muted-foreground">Kontakta en administratör för att få åtkomst.</p>
    </div>
  );

  const validCount = rows.filter(r => r.sku && r.name && r.brand_slug && r.category_slug).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="container-page py-10 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <Link to="/$locale/products" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">
            ← Produkter
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Produktimport</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ladda upp en CSV-fil för att lägga till eller uppdatera produkter i katalogen.</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="text-sm px-4 py-2 rounded-md border border-border hover:border-info transition flex items-center gap-2"
        >
          ↓ Ladda ner mall
        </button>
      </div>

      {/* Required columns info */}
      <div className="rounded-lg border border-border bg-surface-alt p-4 mb-6 text-sm">
        <div className="font-medium mb-2 text-foreground">CSV-kolumner</div>
        <div className="flex flex-wrap gap-2">
          {REQUIRED_COLS.map(c => (
            <span key={c} className="font-mono text-xs bg-info/10 text-info px-2 py-0.5 rounded">
              {c} <span className="text-info/60">*</span>
            </span>
          ))}
          {["family", "description", "lead_time_days", "ip_rating", "fieldbus", "voltage"].map(c => (
            <span key={c} className="font-mono text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{c}</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <strong>brand_slug:</strong> festo · smc · parker · bosch-rexroth · norgren &nbsp;&nbsp;
          <strong>category_slug:</strong> cylinder · valve · gripper · vacuum · electric-actuator · …
        </p>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`rounded-xl border-2 border-dashed transition-colors ${
          dragOver ? "border-info bg-info/5" : "border-border bg-card"
        } p-8 text-center mb-4`}
      >
        <div className="text-3xl mb-3 text-muted-foreground">📁</div>
        <p className="text-sm font-medium text-foreground">Dra och släpp en CSV-fil här</p>
        <p className="text-xs text-muted-foreground mt-1">eller</p>
        <label className="mt-3 inline-block cursor-pointer text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition">
          Välj fil
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
        <p className="mt-3 text-xs text-muted-foreground">Eller klistra in CSV direkt:</p>
        <textarea
          value={rawCsv}
          onChange={e => parseCsv(e.target.value)}
          rows={4}
          placeholder="sku,name,brand_slug,category_slug,..."
          className="mt-2 w-full px-3 py-2 rounded-md border border-input bg-background text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-info/50 resize-none"
        />
      </div>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 mb-4 text-sm text-destructive space-y-1">
          {parseErrors.map((e, i) => <div key={i}>⚠ {e}</div>)}
        </div>
      )}

      {/* Preview table */}
      {state === "preview" && rows.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-sm font-medium">
              Förhandsgranskning — {rows.length} rader
              {validCount > 0 && <span className="ml-2 text-[oklch(0.45_0.12_155)]">✓ {validCount} giltiga</span>}
              {invalidCount > 0 && <span className="ml-2 text-destructive">✗ {invalidCount} ogiltiga</span>}
            </div>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Namn</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Brand</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Kategori</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Leveranstid</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => {
                    const ok = !!(r.sku && r.name && r.brand_slug && r.category_slug);
                    return (
                      <tr key={i} className={`border-b border-border last:border-0 ${ok ? "" : "bg-destructive/5"}`}>
                        <td className="px-3 py-2 font-mono">{r.sku}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{r.name}</td>
                        <td className="px-3 py-2">{r.brand_slug}</td>
                        <td className="px-3 py-2">{r.category_slug}</td>
                        <td className="px-3 py-2 text-center">{r.lead_time_days || "14"}</td>
                        <td className="px-3 py-2">
                          {ok
                            ? <span className="text-[oklch(0.45_0.12_155)]">✓</span>
                            : <span className="text-destructive">✗ saknar fält</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length > 50 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-center text-muted-foreground">
                        … och {rows.length - 50} fler rader
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Version + import button */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <input
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="Versionsmärkning (t.ex. festo_v2)"
              className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
            />
            <button
              onClick={runImport}
              disabled={validCount === 0}
              className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition"
            >
              Importera {validCount} produkter →
            </button>
          </div>
        </div>
      )}

      {/* Import log */}
      {log.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          {log.map((l, i) => (
            <div key={i} className={`text-sm flex items-start gap-2 ${
              l.type === "ok" ? "text-[oklch(0.45_0.12_155)]" :
              l.type === "err" ? "text-destructive" :
              "text-muted-foreground"
            }`}>
              <span>{l.type === "ok" ? "✓" : l.type === "err" ? "✗" : "·"}</span>
              <span>{l.msg}</span>
            </div>
          ))}
          {state === "done" && (
            <div className="pt-3 border-t border-border flex gap-3">
              <button
                onClick={() => { setRawCsv(""); setRows([]); setLog([]); setState("idle"); setVersion(""); }}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:border-info"
              >
                Importera fler
              </button>
              <Link
                to="/$locale/products"
                params={{ locale }}
                className="text-sm px-3 py-1.5 rounded-md bg-info text-primary-foreground hover:opacity-90"
              >
                Visa katalog →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const FUNCTION_URL =
  "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/generate-product-images";
const HOOK_SECRET = "maskinval-images";

// @ts-ignore
export const Route = createFileRoute("/$locale/admin/images")({
  component: AdminImagesPage,
});

type Product = {
  id: string;
  sku: string;
  name: string;
  family: string | null;
  image_url: string | null;
  brand: string | null;
  category: string | null;
};

type Provider = "fal" | "dalle" | "replicate";

const PROVIDER_META: Record<
  Provider,
  { label: string; placeholder: string; link: string; price: string }
> = {
  fal: {
    label: "fal.ai – FLUX schnell",
    placeholder: "fal_key_...",
    link: "https://fal.ai/dashboard/keys",
    price: "~$0.003/bild",
  },
  dalle: {
    label: "OpenAI – DALL-E 3",
    placeholder: "sk-...",
    link: "https://platform.openai.com/api-keys",
    price: "~$0.04/bild",
  },
  replicate: {
    label: "Replicate – FLUX schnell",
    placeholder: "r8_...",
    link: "https://replicate.com/account/api-tokens",
    price: "~$0.003/bild",
  },
};

export default function AdminImagesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider>("fal");
  const [apiKey, setApiKey] = useState("");
  const [batchSize, setBatchSize] = useState(5);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [singleRunning, setSingleRunning] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from("products")
      .select("id, sku, name, family, image_url, brands(name), categories(name)")
      .order("sku");
    setProducts(
      (data ?? []).map((p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        family: p.family,
        image_url: p.image_url,
        brand: p.brands?.name ?? null,
        category: p.categories?.name ?? null,
      }))
    );
    setLoading(false);
  }

  useEffect(() => { fetchProducts(); }, []);

  async function callFunction(opts: Record<string, unknown>) {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hook-secret": HOOK_SECRET },
      body: JSON.stringify({ provider, api_key: apiKey || undefined, ...opts }),
    });
    return res.json();
  }

  async function generateBatch() {
    if (!apiKey) { addLog("⚠ Ange en API-nyckel först."); return; }
    setRunning(true);
    addLog(`▶ Startar batch (${batchSize} produkter, ${PROVIDER_META[provider].label})…`);
    try {
      const data = await callFunction({ batch_size: batchSize });
      if (data.error) { addLog(`✗ Fel: ${data.error}`); }
      else {
        for (const r of data.results ?? []) {
          if (r.status === "ok") addLog(`✓ ${r.sku} → bild genererad`);
          else addLog(`✗ ${r.sku}: ${r.error}`);
        }
        addLog(`━ Klart: ${data.processed} produkter bearbetade.`);
        await fetchProducts();
      }
    } catch (err) {
      addLog(`✗ Nätverksfel: ${err}`);
    }
    setRunning(false);
  }

  async function generateSingle(product_id: string, sku: string) {
    if (!apiKey) { addLog("⚠ Ange en API-nyckel först."); return; }
    setSingleRunning(product_id);
    addLog(`▶ Genererar bild för ${sku}…`);
    try {
      const data = await callFunction({ product_id });
      const r = data.results?.[0];
      if (r?.status === "ok") {
        addLog(`✓ ${sku} → klar`);
        await fetchProducts();
      } else {
        addLog(`✗ ${sku}: ${r?.error ?? data.error ?? "Okänt fel"}`);
      }
    } catch (err) {
      addLog(`✗ ${sku}: ${err}`);
    }
    setSingleRunning(null);
  }

  const withImage = products.filter((p) => p.image_url).length;
  const missing = products.length - withImage;
  const pct = products.length ? Math.round((withImage / products.length) * 100) : 0;
  const meta = PROVIDER_META[provider];

  if (loading) return <div className="container-page py-16 text-sm text-muted-foreground">Laddar…</div>;

  return (
    <div className="container-page py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Produktbilder – AI-generering</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {withImage}/{products.length} produkter har bild · {missing} saknas
        </p>
        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-border mt-3 overflow-hidden">
          <div
            className="h-full bg-info rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Config panel */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6 space-y-4">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">⚙ Konfiguration</p>

        {/* Provider tabs */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PROVIDER_META) as Provider[]).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition border ${
                provider === p
                  ? "bg-info text-primary-foreground border-info"
                  : "border-border text-muted-foreground hover:border-info/50"
              }`}
            >
              {PROVIDER_META[p].label}
            </button>
          ))}
        </div>

        {/* API key input */}
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-muted-foreground mb-1">
              API-nyckel{" "}
              <a
                href={meta.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                Hämta nyckel →
              </a>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={meta.placeholder}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50 font-mono"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-muted-foreground mb-1">Batch-storlek</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              {[1, 3, 5, 10, 20].map((n) => (
                <option key={n} value={n}>{n} st</option>
              ))}
            </select>
          </div>
          <button
            onClick={generateBatch}
            disabled={running || !apiKey}
            className="px-5 py-2 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
          >
            {running ? "Genererar…" : `Generera nästa ${batchSize}`}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Pris: <strong>{meta.price}</strong> · Totalt för {missing} saknade:{" "}
          <strong>
            {provider === "dalle"
              ? `~$${(missing * 0.04).toFixed(2)}`
              : `~$${(missing * 0.003).toFixed(2)}`}
          </strong>
        </p>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div
          ref={logRef}
          className="rounded-lg border border-border bg-[oklch(0.12_0.01_240)] text-[oklch(0.85_0.05_155)] font-mono text-xs p-4 mb-6 max-h-48 overflow-y-auto space-y-0.5"
        >
          {log.map((line, i) => (
            <div key={i} className={line.startsWith("✗") ? "text-destructive" : line.startsWith("━") ? "text-info" : ""}>{line}</div>
          ))}
        </div>
      )}

      {/* Product table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 w-16">Bild</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Namn</th>
                <th className="px-4 py-3">Varumärke</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 w-28">Status</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-surface-alt/50 transition"
                >
                  <td className="px-4 py-2">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="size-10 rounded object-cover border border-border"
                      />
                    ) : (
                      <div className="size-10 rounded border border-dashed border-border bg-surface-alt flex items-center justify-center text-muted-foreground text-[10px]">
                        —
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-sm">{p.family ?? p.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[220px]">{p.name}</div>
                  </td>
                  <td className="px-4 py-2 text-xs">{p.brand ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{p.category ?? "—"}</td>
                  <td className="px-4 py-2">
                    {p.image_url ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[oklch(0.55_0.15_155)]">
                        <span className="size-1.5 rounded-full bg-[oklch(0.55_0.15_155)]" />
                        Klar
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                        Saknas
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {!p.image_url && (
                      <button
                        onClick={() => generateSingle(p.id, p.sku)}
                        disabled={!!singleRunning || running || !apiKey}
                        className="text-[11px] px-2.5 py-1 rounded border border-info/50 text-info hover:bg-info/10 disabled:opacity-40 transition"
                      >
                        {singleRunning === p.id ? "…" : "Generera"}
                      </button>
                    )}
                    {p.image_url && (
                      <button
                        onClick={() => generateSingle(p.id, p.sku)}
                        disabled={!!singleRunning || running || !apiKey}
                        className="text-[11px] px-2.5 py-1 rounded border border-border text-muted-foreground hover:border-info/50 hover:text-info disabled:opacity-40 transition"
                        title="Generera om"
                      >
                        {singleRunning === p.id ? "…" : "↺"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

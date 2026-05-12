import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/machine-builder")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("nav.machineBuilder")} — ${t("common.appName")}` },
        { name: "description", content: "Bygg din maskin steg för steg — AI genererar en komplett stycklista med cylindrar, ventiler, slangar och kopplingar. Skicka offertförfrågan direkt." },
      ],
    };
  },
  component: MachineBuilderPage,
});

const AI_BOM_URL = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/ai-bom";

interface BomLine {
  sku: string;
  quantity: number;
  role: string;
  reason: string;
  product?: ProductRow;
}
interface AiBomResult {
  title: string;
  explanation: string;
  bom: BomLine[];
  source: "ai" | "fallback";
}

const EXAMPLES = [
  "Pneumatisk cylinder som lyfter 30 kg last, 200 mm slag, snabb cykeltid ca 0,5 sek",
  "Kompakt grippenhet för att hantera cylindriska objekt Ø40mm i monteringsmaskin",
  "Vakuumsystem för att lyfta glasskivor 600×400mm, IP65, livsmedelsapplikation",
  "Elektrisk linjaraxel för exakt positionering ±0,1mm, 500mm slag, PROFINET",
  "Dubbelverkande cylinder 63mm för press, 100mm slag, 6 bar, med mjukt stopp",
];

type Step = "input" | "loading" | "result";

function MachineBuilderPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const isSv = locale === "sv";

  const [step, setStep] = useState<Step>("input");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<AiBomResult | null>(null);
  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [rfqSent, setRfqSent] = useState(false);
  const [rfqName, setRfqName] = useState("");
  const [rfqEmail, setRfqEmail] = useState("");
  const [rfqNote, setRfqNote] = useState("");
  const [showRfqForm, setShowRfqForm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(console.error);
  }, []);

  async function generate() {
    if (!description.trim()) return;
    setStep("loading");
    setResult(null);

    try {
      const res = await fetch(AI_BOM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, locale }),
      });
      const data: AiBomResult = await res.json();

      // Enrich BOM lines with product data from catalog
      const enriched = data.bom.map((line) => ({
        ...line,
        product: catalog.find((p) => p.sku === line.sku),
      }));
      const enrichedResult = { ...data, bom: enriched };
      setResult(enrichedResult);

      // Init quantities
      const q: Record<string, number> = {};
      enriched.forEach((l) => { q[l.sku] = l.quantity; });
      setQuantities(q);
      setStep("result");
    } catch (e) {
      console.error(e);
      setStep("input");
    }
  }

  function reset() {
    setStep("input");
    setResult(null);
    setRfqSent(false);
    setShowRfqForm(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  function submitRfq(e: React.FormEvent) {
    e.preventDefault();
    // In a real app this would call supabase to save the RFQ
    setRfqSent(true);
    setShowRfqForm(false);
  }

  const totalLeadTime = result
    ? Math.max(...(result.bom.map((l) => l.product?.lead_time_days ?? 0)))
    : 0;
  const missingProducts = result ? result.bom.filter((l) => !l.product) : [];

  return (
    <div className="container-page py-10 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-info font-medium">✦ AI-driven</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {isSv ? "Bygg din maskin" : "Build your machine"}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm max-w-xl">
          {isSv
            ? "Beskriv din applikation — AI sätter ihop en komplett stycklista med rätt cylinder, ventil, slangar och tillbehör. Sedan skickar du offertförfrågan med ett klick."
            : "Describe your application — AI assembles a complete BOM with the right cylinder, valve, hoses and accessories. Then send a quote request in one click."}
        </p>
      </div>

      {/* STEP 1 — Input */}
      {step === "input" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <label className="block text-sm font-medium mb-3">
              {isSv ? "Beskriv din applikation" : "Describe your application"}
            </label>
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
              }}
              rows={4}
              placeholder={isSv
                ? "t.ex. \"Pneumatisk cylinder som lyfter 30kg last med 200mm slag, snabb cykeltid, behöver mjukt stopp i båda ändlägena\""
                : "e.g. \"Pneumatic cylinder lifting 30kg load with 200mm stroke, fast cycle time, needs soft stop at both ends\""}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-info/50"
            />
            <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-muted-foreground">
                {isSv ? "⌘ + Enter för att generera" : "⌘ + Enter to generate"}
              </p>
              <button
                onClick={generate}
                disabled={!description.trim()}
                className="px-6 py-2.5 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition flex items-center gap-2"
              >
                <span>✦</span>
                {isSv ? "Generera stycklista" : "Generate BOM"}
              </button>
            </div>
          </div>

          {/* Examples */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.14em] mb-3">
              {isSv ? "Exempelapplikationer" : "Example applications"}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setDescription(ex)}
                  className="text-left text-sm px-4 py-3 rounded-lg border border-border bg-card hover:border-info hover:bg-info/5 transition"
                >
                  <span className="text-info mr-2">→</span>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 — Loading */}
      {step === "loading" && (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-info/10 mb-6">
            <span className="text-2xl text-info animate-pulse">✦</span>
          </div>
          <h2 className="text-lg font-semibold">
            {isSv ? "Analyserar din applikation…" : "Analysing your application…"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            {isSv
              ? "Gemini väljer rätt cylinder, ventil, slangar och tillbehör från katalogen."
              : "Gemini is selecting the right cylinder, valve, hoses and accessories from the catalog."}
          </p>
          <div className="mt-6 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-2 rounded-full bg-info animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* STEP 3 — Result */}
      {step === "result" && result && (
        <div className="space-y-6">
          {/* AI summary */}
          <div className={`rounded-xl border p-5 ${result.source === "ai" ? "border-info/30 bg-info/5" : "border-border bg-card"}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-info">✦</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-info font-medium">
                    {result.source === "ai" ? "AI-genererad stycklista" : "Standardpaket"}
                  </span>
                </div>
                <h2 className="text-xl font-semibold tracking-tight">{result.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{result.explanation}</p>
              </div>
              <button
                onClick={reset}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:border-info text-muted-foreground hover:text-foreground transition"
              >
                ← {isSv ? "Ny applikation" : "New application"}
              </button>
            </div>

            {totalLeadTime > 0 && (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`px-2 py-0.5 rounded ${totalLeadTime <= 7 ? "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]" : "bg-muted text-muted-foreground"}`}>
                  {isSv ? `Max leveranstid: ${totalLeadTime} dagar` : `Max lead time: ${totalLeadTime} days`}
                </span>
                <span>{result.bom.length} {isSv ? "komponenter" : "components"}</span>
              </div>
            )}
          </div>

          {/* BOM table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-surface-alt border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {isSv ? "Stycklista (BOM)" : "Bill of Materials (BOM)"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {isSv ? "Justera antal med +/−" : "Adjust quantities with +/−"}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Roll</th>
                  <th className="px-4 py-2.5 text-left">Produkt</th>
                  <th className="px-4 py-2.5 text-left hidden md:table-cell">SKU</th>
                  <th className="px-4 py-2.5 text-left hidden lg:table-cell">Motivering</th>
                  <th className="px-4 py-2.5 text-center">Antal</th>
                  <th className="px-4 py-2.5 text-center hidden sm:table-cell">Lev.</th>
                </tr>
              </thead>
              <tbody>
                {result.bom.map((line, i) => {
                  const p = line.product;
                  const qty = quantities[line.sku] ?? line.quantity;
                  return (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-alt/50 transition">
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-foreground">{line.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        {p ? (
                          <Link
                            to="/$locale/product/$sku"
                            params={{ locale, sku: p.sku }}
                            className="hover:text-info transition"
                          >
                            <div className="font-medium line-clamp-1">{p.name}</div>
                            <div className="text-xs text-info mt-0.5">{p.brand.name}</div>
                          </Link>
                        ) : (
                          <div className="text-muted-foreground">{line.sku}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="font-mono text-[11px] text-muted-foreground">{line.sku}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground line-clamp-2">{line.reason}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setQuantities((q) => ({ ...q, [line.sku]: Math.max(1, (q[line.sku] ?? line.quantity) - 1) }))}
                            className="size-6 rounded border border-border hover:border-info text-muted-foreground hover:text-foreground transition flex items-center justify-center text-xs"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-medium">{qty}</span>
                          <button
                            onClick={() => setQuantities((q) => ({ ...q, [line.sku]: (q[line.sku] ?? line.quantity) + 1 }))}
                            className="size-6 rounded border border-border hover:border-info text-muted-foreground hover:text-foreground transition flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {p ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${
                            (p.lead_time_days ?? 99) <= 7
                              ? "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {(p.lead_time_days ?? 99) <= 7 ? (isSv ? "Lager" : "Stock") : `${p.lead_time_days}d`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {missingProducts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {missingProducts.length} {isSv ? "komponenter hittades inte i katalogen:" : "components not found in catalog:"}{" "}
              {missingProducts.map((l) => l.sku).join(", ")}
            </p>
          )}

          {/* Actions */}
          {!rfqSent && !showRfqForm && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowRfqForm(true)}
                className="px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
              >
                ✉ {isSv ? "Skicka offertförfrågan" : "Send quote request"}
              </button>
              <Link
                to="/$locale/compare"
                params={{ locale }}
                search={{ skus: result.bom.filter((l) => l.product).slice(0, 4).map((l) => l.sku).join(",") }}
                className="px-6 py-3 rounded-md border border-border text-sm hover:border-info transition"
              >
                ⇔ {isSv ? "Jämför alternativ" : "Compare alternatives"}
              </Link>
              <button
                onClick={() => {
                  const text = result.bom.map((l) => `${quantities[l.sku] ?? l.quantity}x ${l.sku} — ${l.role}`).join("\n");
                  navigator.clipboard.writeText(text);
                }}
                className="px-4 py-3 rounded-md border border-border text-sm text-muted-foreground hover:border-info hover:text-foreground transition"
              >
                {isSv ? "Kopiera SKUer" : "Copy SKUs"}
              </button>
            </div>
          )}

          {/* RFQ form */}
          {showRfqForm && !rfqSent && (
            <form onSubmit={submitRfq} className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold text-foreground">
                {isSv ? "Offertförfrågan" : "Quote request"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isSv
                  ? `Stycklistan för "${result.title}" skickas med din förfrågan.`
                  : `The BOM for "${result.title}" will be included.`}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">{isSv ? "Ditt namn" : "Your name"}</label>
                  <input
                    required
                    value={rfqName}
                    onChange={(e) => setRfqName(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">{isSv ? "Jobbmejl" : "Work email"}</label>
                  <input
                    required
                    type="email"
                    value={rfqEmail}
                    onChange={(e) => setRfqEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">{isSv ? "Övrig information (valfritt)" : "Additional notes (optional)"}</label>
                <textarea
                  value={rfqNote}
                  onChange={(e) => setRfqNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-info/50"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                >
                  {isSv ? "Skicka förfrågan" : "Send request"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRfqForm(false)}
                  className="px-4 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:border-info transition"
                >
                  {isSv ? "Avbryt" : "Cancel"}
                </button>
              </div>
            </form>
          )}

          {/* Confirmation */}
          {rfqSent && (
            <div className="rounded-xl border border-[oklch(0.72_0.16_155)] bg-[oklch(0.97_0.03_155)] p-6 text-center">
              <div className="text-3xl mb-3">✓</div>
              <h3 className="font-semibold text-[oklch(0.32_0.12_155)]">
                {isSv ? "Förfrågan skickad!" : "Request sent!"}
              </h3>
              <p className="text-sm text-[oklch(0.45_0.10_155)] mt-1">
                {isSv ? "Vi återkommer inom en arbetsdag med offert." : "We'll get back to you within one business day."}
              </p>
              <button
                onClick={reset}
                className="mt-4 text-sm underline text-[oklch(0.45_0.10_155)] hover:text-[oklch(0.32_0.12_155)]"
              >
                {isSv ? "Bygg en ny maskin" : "Build a new machine"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

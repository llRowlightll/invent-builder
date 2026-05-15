import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { loadCatalog } from "@/lib/catalog";
import { runSelection } from "@/lib/selection";
import type { ProductRow, SelectionInput, SelectionResult } from "@/lib/types";
import { BomTable, ValidationList } from "@/components/Bom";

export const Route = createFileRoute("/$locale/wizard")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return { meta: [{ title: `${t("nav.wizard")} — ${t("common.appName")}` }] };
  },
  component: WizardPage,
});

function WizardPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [catalog, setCatalog] = useState<ProductRow[] | null>(null);
  const [input, setInput] = useState<SelectionInput>({
    stroke_mm: 500,
    force_n: 800,
    voltage: "230VAC",
    fieldbus: "PROFINET",
    feedback: "incremental",
    ip: "IP54",
    mode: "best",
  });
  const [results, setResults] = useState<{ best: SelectionResult; cheap: SelectionResult } | null>(
    null,
  );

useEffect(() => {
    loadCatalog().then(setCatalog).catch(console.error);
  }, []);

  function generate() {
    if (!catalog) return;
    setResults({
      best: runSelection(catalog, { ...input, mode: "best" }),
      cheap: runSelection(catalog, { ...input, mode: "cheapest" }),
    });
  }

return (
    <div className="container-page py-10 grid lg:grid-cols-12 gap-6">
      <section className="lg:col-span-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.wizard")}</h1>
        <div className="mt-5 rounded-lg border border-border bg-card p-4 space-y-3">
          <Num label="Stroke (mm)" v={input.stroke_mm} on={(n) => setInput({ ...input, stroke_mm: n })} />
          <Num label="Force (N)" v={input.force_n} on={(n) => setInput({ ...input, force_n: n })} />
          <Sel label="Voltage" v={input.voltage} on={(s) => setInput({ ...input, voltage: s as SelectionInput["voltage"] })} opts={["230VAC", "400VAC"]} />
          <Sel label="Fieldbus" v={input.fieldbus} on={(s) => setInput({ ...input, fieldbus: s as SelectionInput["fieldbus"] })} opts={["PROFINET", "EthernetIP", "none"]} />
          <Sel label="Feedback" v={input.feedback} on={(s) => setInput({ ...input, feedback: s as SelectionInput["feedback"] })} opts={["incremental", "absolute"]} />
          <Sel label="IP" v={input.ip} on={(s) => setInput({ ...input, ip: s as SelectionInput["ip"] })} opts={["IP54", "IP65", "IP67"]} />
          <button onClick={generate} className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm">
            {t("wizardPage.generateButton")}
          </button>
        </div>
      </section>
      <section className="lg:col-span-8 space-y-6">
        {results ? (
          <>
            <div>
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full bg-gold" />
                {t("wizardPage.best")} · <span className="font-mono text-xs">{results.best.orderCode}</span>
              </h2>
              <ValidationList items={results.best.validation} />
              <BomTable result={results.best} />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="size-2 rounded-full bg-teal" />
                {t("wizardPage.cheapest")} · <span className="font-mono text-xs">{results.cheap.orderCode}</span>
              </h2>
              <ValidationList items={results.cheap.validation} />
              <BomTable result={results.cheap} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("wizardPage.adjustInputs")}</p>
        )}
      </section>
    </div>
  );
}

function Num({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type="number" value={v} onChange={(e) => on(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
    </label>
  );
}
function Sel({ label, v, on, opts }: { label: string; v: string; on: (s: string) => void; opts: string[] }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={v} onChange={(e) => on(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

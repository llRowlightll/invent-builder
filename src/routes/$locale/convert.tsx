import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { loadCatalog } from "@/lib/catalog";
import { runSelection, pneumaticToForce } from "@/lib/selection";
import type { ProductRow, SelectionResult } from "@/lib/types";
import { BomTable, ValidationList } from "@/components/Bom";

export const Route = createFileRoute("/$locale/convert")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return { meta: [{ title: `${t("nav.convert")} — ${t("common.appName")}` }] };
  },
  component: ConvertPage,
});

function ConvertPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [catalog, setCatalog] = useState<ProductRow[] | null>(null);
  const [bore, setBore] = useState(50);
  const [stroke, setStroke] = useState(300);
  const [pressure, setPressure] = useState(6);
  const [margin, setMargin] = useState(1.3);
  const [best, setBest] = useState<SelectionResult | null>(null);
  const [cheap, setCheap] = useState<SelectionResult | null>(null);

useEffect(() => {
    loadCatalog().then(setCatalog).catch(console.error);
  }, []);

  function generate() {
    if (!catalog) return;
    const force = pneumaticToForce(pressure, bore, margin);
    const base = {
      stroke_mm: stroke,
      force_n: force,
      voltage: "230VAC" as const,
      fieldbus: "PROFINET" as const,
      feedback: "incremental" as const,
      ip: "IP54" as const,
    };
    setBest(runSelection(catalog, { ...base, mode: "best" }));
    setCheap(runSelection(catalog, { ...base, mode: "cheapest" }));
  }

const force = pneumaticToForce(pressure, bore, margin);

  return (
    <div className="container-page py-10 grid lg:grid-cols-12 gap-6">
      <section className="lg:col-span-4 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.convert")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("convertPage.subtitle")}
        </p>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Field label="Bore Ø (mm)" value={bore} onChange={setBore} />
          <Field label="Stroke (mm)" value={stroke} onChange={setStroke} />
          <Field label="Pressure (bar)" value={pressure} onChange={setPressure} />
          <Field label="Safety margin" value={margin} step={0.1} onChange={setMargin} />
          <div className="text-sm pt-2 border-t border-border">
            {t("convertPage.computedForce")} <strong>{force} N</strong>
          </div>
          <button
            onClick={generate}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            {t("convertPage.generateButton")}
          </button>
        </div>
      </section>

      <section className="lg:col-span-8 space-y-6">
        {best && (
          <div>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <span className="size-2 rounded-full bg-gold" />
              BEST · <span className="font-mono text-xs">{best?.orderCode}</span>
            </h2>
            <ValidationList items={best.validation} />
            <BomTable result={best} />
          </div>
        )}
        {cheap && (
          <div>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <span className="size-2 rounded-full bg-teal" />
              CHEAPEST · <span className="font-mono text-xs">{cheap.orderCode}</span>
            </h2>
            <ValidationList items={cheap.validation} />
            <BomTable result={cheap} />
          </div>
        )}
        {!best && (
          <div className="text-sm text-muted-foreground">{t("convertPage.setValues")}</div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
      />
    </label>
  );
}

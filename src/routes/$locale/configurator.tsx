import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { loadCatalog } from "@/lib/catalog";
import { runSelection } from "@/lib/selection";
import type { ProductRow, SelectionInput, SelectionResult } from "@/lib/types";
import { BomTable, ValidationList, bomToCsv, downloadCsv } from "@/components/Bom";
import { supabase } from "@/integrations/supabase/client";
import Viewer3D from "@/components/Viewer3D";

export const Route = createFileRoute("/$locale/configurator")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("nav.configurator")} — ${t("common.appName")}` },
        { name: "description", content: t("app.tileConfiguratorBody") },
      ],
    };
  },
  component: ConfiguratorPage,
});

const STEPS = ["basic", "motion", "control", "accessories", "overview"] as const;
type Step = (typeof STEPS)[number];

function ConfiguratorPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [catalog, setCatalog] = useState<ProductRow[] | null>(null);
  const [step, setStep] = useState<Step>("basic");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [savingBom, setSavingBom] = useState(false);

  const [input, setInput] = useState<SelectionInput>({
    stroke_mm: 500,
    force_n: 800,
    voltage: "230VAC",
    fieldbus: "PROFINET",
    feedback: "incremental",
    ip: "IP54",
    mode: "best",
  });

useEffect(() => {
    loadCatalog().then(setCatalog).catch(console.error);
  }, []);

  const result: SelectionResult | null = useMemo(
    () => (catalog ? runSelection(catalog, input) : null),
    [catalog, input],
  );

  async function saveAndExportBom() {
    if (!result || !user) return;
    setSavingBom(true);
    try {
      const { data: bom, error } = await supabase
        .from("boms")
        .insert({
          user_id: user.id,
          mode: input.mode,
          order_code: result.orderCode,
          total_items: result.items.length,
        })
        .select("id")
        .single();
      if (error || !bom) throw error;
      await supabase.from("bom_items").insert(
        result.items.map((i) => ({
          bom_id: bom.id,
          product_id: i.product.id,
          role: i.role,
          qty: i.qty,
          notes: i.why,
        })),
      );
      navigate({ to: "/$locale/bom/$bomId", params: { locale, bomId: bom.id } });
    } catch (e) {
      console.error(e);
      alert("Failed to save BOM");
    } finally {
      setSavingBom(false);
    }
  }

  if (loading || !user || !catalog || !result)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  const hasErrors = result.validation.some((v) => v.level === "error");

  return (
    <div className="container-page py-10 grid lg:grid-cols-12 gap-8">
      <aside className="lg:col-span-3">
        <h1 className="text-xl font-semibold tracking-tight">EA Linear Axis</h1>
        <p className="text-xs text-muted-foreground mt-1">Festo-style configurator</p>

        <ol className="mt-6 space-y-1 text-sm">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                onClick={() => setStep(s)}
                className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 ${
                  step === s ? "bg-foreground text-background" : "hover:bg-accent"
                }`}
              >
                <span className="text-[10px] opacity-70">{String(i + 1).padStart(2, "0")}</span>
                <span className="capitalize">{s}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-md border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Mode</div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <button
              onClick={() => setInput((s) => ({ ...s, mode: "best" }))}
              className={`px-2 py-1.5 text-xs rounded-md border ${input.mode === "best" ? "bg-gold text-gold-foreground border-gold" : "border-border"}`}
            >
              BEST
            </button>
            <button
              onClick={() => setInput((s) => ({ ...s, mode: "cheapest" }))}
              className={`px-2 py-1.5 text-xs rounded-md border ${input.mode === "cheapest" ? "bg-teal text-primary-foreground border-teal" : "border-border"}`}
            >
              CHEAPEST
            </button>
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Order code</div>
          <div className="mt-1 font-mono text-xs break-all">{result.orderCode}</div>
        </div>
      </aside>

      <section className="lg:col-span-5 space-y-5">
        {step === "basic" && (
          <Group title="1. Basic">
            <NumberField label="Stroke (mm)" value={input.stroke_mm} onChange={(v) => setInput((s) => ({ ...s, stroke_mm: v }))} min={50} max={2000} />
            <NumberField label="Force (N)" value={input.force_n} onChange={(v) => setInput((s) => ({ ...s, force_n: v }))} min={50} max={10000} />
            <SelectField
              label="IP rating"
              value={input.ip}
              options={["IP54", "IP65", "IP67"]}
              onChange={(v) => setInput((s) => ({ ...s, ip: v as SelectionInput["ip"] }))}
            />
          </Group>
        )}
        {step === "motion" && (
          <Group title="2. Motion">
            <SelectField
              label="Feedback"
              value={input.feedback}
              options={["incremental", "absolute"]}
              onChange={(v) => setInput((s) => ({ ...s, feedback: v as SelectionInput["feedback"] }))}
            />
            <SelectField
              label="Voltage"
              value={input.voltage}
              options={["230VAC", "400VAC"]}
              onChange={(v) => setInput((s) => ({ ...s, voltage: v as SelectionInput["voltage"] }))}
            />
          </Group>
        )}
        {step === "control" && (
          <Group title="3. Control">
            <SelectField
              label="Fieldbus"
              value={input.fieldbus}
              options={["PROFINET", "EthernetIP", "none"]}
              onChange={(v) => setInput((s) => ({ ...s, fieldbus: v as SelectionInput["fieldbus"] }))}
            />
          </Group>
        )}
        {step === "accessories" && (
          <Group title="4. Accessories">
            <p className="text-sm text-muted-foreground">
              Accessories and spares are auto-selected based on mode. BEST adds brake, mounting kit and recommended spares; CHEAPEST keeps only the coupling.
            </p>
          </Group>
        )}
        {step === "overview" && (
          <Group title="5. Overview">
            <ValidationList items={result.validation} />
            <BomTable result={result} highlightSku={highlight} onRow={setHighlight} />
            <div className="flex flex-wrap gap-2">
              <button
                disabled={hasErrors || savingBom}
                onClick={saveAndExportBom}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
              >
                {savingBom ? t("common.loading") : "Save BOM & continue to RFQ"}
              </button>
              <button
                onClick={() => downloadCsv(`${result.orderCode}.csv`, bomToCsv(result))}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                Download CSV
              </button>
            </div>
            {hasErrors && (
              <p className="text-xs text-destructive">Resolve errors before saving.</p>
            )}
          </Group>
        )}

        <div className="flex justify-between pt-4">
          <button
            disabled={step === STEPS[0]}
            onClick={() => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)])}
            className="text-sm px-3 py-1.5 rounded-md border border-border disabled:opacity-30"
          >
            ← {t("common.back")}
          </button>
          <button
            disabled={step === STEPS[STEPS.length - 1]}
            onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(step) + 1)])}
            className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-30"
          >
            {t("common.next")} →
          </button>
        </div>
      </section>

      <aside className="lg:col-span-4 space-y-4">
        <Viewer3D items={result.items} highlightSku={highlight} onPick={setHighlight} />
        <div className="rounded-md border border-border bg-card p-3 text-xs space-y-1">
          {result.notes.map((n, i) => (
            <p key={i} className="text-muted-foreground">{n}</p>
          ))}
        </div>
        <Link
          to="/$locale/app"
          params={{ locale }}
          className="text-xs underline text-muted-foreground"
        >
          ← {t("nav.dashboard")}
        </Link>
      </aside>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}
function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
      />
    </label>
  );
}
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (s: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

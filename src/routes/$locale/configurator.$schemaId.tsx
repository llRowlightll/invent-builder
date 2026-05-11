import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog } from "@/lib/catalog";
import { runSelection } from "@/lib/selection";
import type { ProductRow, SelectionInput, SelectionResult } from "@/lib/types";
import { BomTable, ValidationList, bomToCsv, downloadCsv } from "@/components/Bom";
import {
  type ConfigRule,
  type ConfigSchemaJson,
  type ValidationMessage,
  buildOrderCode,
  defaultsFromSchema,
  validate,
} from "@/lib/configurator-engine";

export const Route = createFileRoute("/$locale/configurator/$schemaId")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [{ title: `${t("configurator.title")} — ${params.schemaId}` }],
    };
  },
  component: ConfiguratorRunner,
});

function ConfiguratorRunner() {
  const { locale, schemaId } = Route.useParams();
  const t = makeT(locale as Locale);
  const [schema, setSchema] = useState<ConfigSchemaJson | null>(null);
  const [title, setTitle] = useState<string>(schemaId);
  const [rules, setRules] = useState<ConfigRule[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [catalog, setCatalog] = useState<ProductRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase
          .from("config_schemas")
          .select("title_en,title_sv,schema_json")
          .eq("schema_id", schemaId)
          .maybeSingle(),
        supabase
          .from("config_rules")
          .select("*")
          .eq("schema_id", schemaId),
      ]);
      if (s) {
        const sj = s.schema_json as unknown as ConfigSchemaJson;
        setSchema(sj);
        setTitle((locale === "sv" ? s.title_sv : s.title_en) ?? schemaId);
        setValues(defaultsFromSchema(sj));
      }
      setRules((r as ConfigRule[]) ?? []);
    })();
    loadCatalog().then(setCatalog).catch(console.error);
  }, [schemaId, locale]);

  const messages: ValidationMessage[] = useMemo(
    () => (rules.length ? validate(rules, values, locale) : []),
    [rules, values, locale],
  );
  const hasError = messages.some((m) => m.level === "error");

  const result: SelectionResult | null = useMemo(() => {
    if (!catalog || schemaId !== "EA-LINEAR-AXIS") return null;
    const input: SelectionInput = {
      stroke_mm: Number(values.stroke_mm ?? 500),
      force_n: Number(values.force_n ?? 800),
      voltage: (values.voltage as SelectionInput["voltage"]) ?? "230VAC",
      fieldbus: (values.fieldbus as SelectionInput["fieldbus"]) ?? "PROFINET",
      feedback: (values.feedback as SelectionInput["feedback"]) ?? "incremental",
      ip: (values.ip as SelectionInput["ip"]) ?? "IP65",
      mode: (values.mode as SelectionInput["mode"]) ?? "best",
    };
    return runSelection(catalog, input);
  }, [catalog, values, schemaId]);

  const orderCode = result?.orderCode ?? buildOrderCode(schemaId, values);

  if (!schema) {
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const steps = schema.steps;
  const isOverview = stepIdx >= steps.length;
  const current = steps[stepIdx];

  return (
    <div className="container-page py-10 grid lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-3">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <ol className="mt-6 space-y-1 text-sm">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button
                onClick={() => setStepIdx(i)}
                className={`w-full text-left px-3 py-2 rounded-md ${
                  i === stepIdx ? "bg-foreground text-background" : "hover:bg-accent"
                }`}
              >
                {i + 1}. {locale === "sv" ? s.title_sv : s.title_en}
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => setStepIdx(steps.length)}
              className={`w-full text-left px-3 py-2 rounded-md ${
                isOverview ? "bg-foreground text-background" : "hover:bg-accent"
              }`}
            >
              {steps.length + 1}. {t("configurator.overview")}
            </button>
          </li>
        </ol>
        <div className="mt-6 rounded-md border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("configurator.orderCode")}
          </div>
          <div className="mt-1 font-mono text-xs break-all">{orderCode}</div>
        </div>
      </aside>

      <section className="lg:col-span-9 space-y-6">
        {!isOverview && current && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">
              {locale === "sv" ? current.title_sv : current.title_en}
            </h2>
            <div className="mt-5 grid sm:grid-cols-2 gap-4">
              {current.fields.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={values[f.key]}
                  locale={locale as Locale}
                  onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                />
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button
                disabled={stepIdx === 0}
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="px-3 py-2 rounded-md border border-border text-sm disabled:opacity-50"
              >
                {t("common.back")}
              </button>
              <button
                onClick={() => setStepIdx((i) => i + 1)}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <ValidationList
            items={messages.map((m) => ({ level: m.level === "info" ? "info" : m.level, message: m.message }))}
          />
        )}

        {isOverview && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t("configurator.overview")}</h2>
            {result && <BomTable result={result} />}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!result}
                onClick={() => result && downloadCsv(`${orderCode}.csv`, bomToCsv(result))}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                {t("configurator.exportCsv")}
              </button>
              {hasError ? (
                <span className="px-4 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
                  {t("configurator.rfqBlocked")}
                </span>
              ) : (
                <Link
                  to="/$locale/talk"
                  params={{ locale }}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
                >
                  {t("configurator.requestRfq")}
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FieldInput({
  field,
  value,
  locale,
  onChange,
}: {
  field: import("@/lib/configurator-engine").SchemaField;
  value: unknown;
  locale: Locale;
  onChange: (v: unknown) => void;
}) {
  const label = locale === "sv" ? field.label_sv : field.label_en;
  if (field.type === "select" && field.options) {
    return (
      <label className="block text-sm">
        <span className="text-muted-foreground">{label}</span>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  }
  if (field.type === "number") {
    return (
      <label className="block text-sm">
        <span className="text-muted-foreground">{label}</span>
        <input
          type="number"
          value={Number(value ?? 0)}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
        />
      </label>
    );
  }
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
      />
    </label>
  );
}

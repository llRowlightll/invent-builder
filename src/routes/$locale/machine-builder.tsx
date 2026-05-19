import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, Suspense, lazy } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/machine-builder")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("nav.machineBuilder")} — ${t("common.appName")}` },
        { name: "description", content: "Bygg din maskin steg för steg — AI ställer rätt frågor, föreslår bästa komponenter och genererar komplett stycklista." },
      ],
    };
  },
  component: MachineBuilderPage,
});

const ADVISOR_URL = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/groq-advisor";

// ── Types ──────────────────────────────────────────────────────────────────
interface Question {
  id: string;
  label: string;
  hint?: string;
  type: "choice" | "number";
  options?: string[];
  unit?: string;
}

interface ActuatorOption {
  sku: string;
  name: string;
  badge: string;
  bore_mm?: number;
  stroke_mm?: number;
  force_n?: number;
  why: string;
  pros: string[];
  cons: string[];
  product?: ProductRow;
}

interface BomLine {
  sku: string;
  quantity: number;
  role: string;
  reason: string;
  product?: ProductRow;
}

type Step = "describe" | "q_loading" | "questions" | "o_loading" | "options" | "bom_loading" | "result";

const EXAMPLES = [
  "Pneumatisk stoppdon på transportband — stoppar kartonger 5 kg",
  "Lyfter en plåtdel 15 kg vertikalt 200 mm i en pressstation",
  "Klamrar fast en detalj under svetsning, horisontell rörelse 80 mm",
  "Vakuumgrepp som lyfter glasskivor 4 kg i monteringscell",
  "Elektrisk linjäraxel för exakt positionering av kamera, 300 mm slag",
];

// ── Advisor API calls ───────────────────────────────────────────────────────
async function advisorCall(body: object) {
  const res = await fetch(ADVISOR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Advisor error ${res.status}`);
  return res.json();
}

// ── Main component ──────────────────────────────────────────────────────────
function MachineBuilderPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const isSv = locale === "sv";

  const [step, setStep] = useState<Step>("describe");
  const [description, setDescription] = useState("");
  const [qSummary, setQSummary] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [optionsSummary, setOptionsSummary] = useState("");
  const [options, setOptions] = useState<ActuatorOption[]>([]);
  const [selected, setSelected] = useState<ActuatorOption | null>(null);
  const [bom, setBom] = useState<BomLine[]>([]);
  const [bomTitle, setBomTitle] = useState("");
  const [bomExplanation, setBomExplanation] = useState("");
  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const [error, setError] = useState("");
  const [rfqSent, setRfqSent] = useState(false);
  const [rfqName, setRfqName] = useState("");
  const [rfqEmail, setRfqEmail] = useState("");

  useEffect(() => { loadCatalog().then(setCatalog).catch(() => {}); }, []);

  function enrichWithCatalog<T extends { sku: string; product?: ProductRow }>(items: T[]): T[] {
    return items.map(item => ({
      ...item,
      product: catalog.find(p => p.sku === item.sku),
    }));
  }

  // Step 1 → questions
  async function handleDescribe() {
    if (!description.trim()) return;
    setError("");
    setStep("q_loading");
    try {
      const data = await advisorCall({ action: "questions", description, locale });
      setQSummary(data.summary ?? "");
      setQuestions(data.questions ?? []);
      setAnswers({});
      setStep("questions");
    } catch {
      setError(t("machineBuilder.errorGeneric"));
      setStep("describe");
    }
  }

  // Step 2 → options
  async function handleAnswers() {
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) return;
    setError("");
    setStep("o_loading");
    try {
      const data = await advisorCall({ action: "options", description, answers, locale });
      const enriched = enrichWithCatalog<ActuatorOption>(data.options ?? []);
      setOptions(enriched);
      setOptionsSummary(data.summary ?? "");
      setStep("options");
    } catch {
      setError(t("machineBuilder.errorGeneric"));
      setStep("questions");
    }
  }

  // Step 3 → BOM
  async function handleSelect(opt: ActuatorOption) {
    setSelected(opt);
    setError("");
    setStep("bom_loading");
    try {
      const data = await advisorCall({ action: "bom", description, answers, selected_sku: opt.sku, locale });
      const enriched = enrichWithCatalog<BomLine>(data.bom ?? []);
      setBom(enriched);
      setBomTitle(data.title ?? "");
      setBomExplanation(data.explanation ?? "");
      setStep("result");
    } catch {
      setError(t("machineBuilder.errorGeneric"));
      setStep("options");
    }
  }

  function restart() {
    setStep("describe");
    setDescription("");
    setQuestions([]);
    setAnswers({});
    setOptions([]);
    setSelected(null);
    setBom([]);
    setBomTitle("");
    setBomExplanation("");
    setRfqSent(false);
    setError("");
  }

  return (
    <div className="container-page py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          <span className="text-info">✦</span>
          {t("machineBuilder.aiLabel")}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("machineBuilder.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          {t("machineBuilder.subtitle")}
        </p>
      </div>

      {/* Progress bar */}
      <StepIndicator step={step} t={t} />

      {error && (
        <div className="my-4 px-4 py-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {/* ── Step: Describe ── */}
      {step === "describe" && (
        <DescribeStep
          t={t}
          description={description}
          setDescription={setDescription}
          onSubmit={handleDescribe}
        />
      )}

      {/* ── Step: Loading questions ── */}
      {step === "q_loading" && <LoadingCard message={t("machineBuilder.analysingApp")} />}

      {/* ── Step: Questions ── */}
      {step === "questions" && (
        <QuestionsStep
          t={t}
          summary={qSummary}
          questions={questions}
          answers={answers}
          setAnswers={setAnswers}
          onSubmit={handleAnswers}
          onBack={() => setStep("describe")}
        />
      )}

      {/* ── Step: Loading options ── */}
      {step === "o_loading" && <LoadingCard message={t("machineBuilder.searchingComponents")} />}

      {/* ── Step: Options ── */}
      {step === "options" && (
        <OptionsStep
          t={t}
          summary={optionsSummary}
          options={options}
          onSelect={handleSelect}
          onBack={() => setStep("questions")}
        />
      )}

      {/* ── Step: Loading BOM ── */}
      {step === "bom_loading" && <LoadingCard message={t("machineBuilder.buildingBom")} />}

      {/* ── Step: Result ── */}
      {step === "result" && selected && (
        <ResultStep
          t={t}
          locale={locale}
          title={bomTitle}
          explanation={bomExplanation}
          selected={selected}
          bom={bom}
          description={description}
          answers={answers}
          rfqName={rfqName}
          rfqEmail={rfqEmail}
          rfqSent={rfqSent}
          setRfqName={setRfqName}
          setRfqEmail={setRfqEmail}
          setRfqSent={setRfqSent}
          onRestart={restart}
        />
      )}
    </div>
  );
}

// ── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ step, t }: { step: Step; t: (key: import("@/lib/i18n").TKey) => string }) {
  const steps = [
    { key: "describe", label: t("machineBuilder.stepDescribe") },
    { key: "questions", label: t("machineBuilder.stepQuestions") },
    { key: "options", label: t("machineBuilder.stepSelect") },
    { key: "result", label: t("machineBuilder.stepResult") },
  ];
  const order: Record<string, number> = {
    describe: 0, q_loading: 0,
    questions: 1, o_loading: 1,
    options: 2, bom_loading: 2,
    result: 3,
  };
  const current = order[step] ?? 0;

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              i < current ? "bg-info text-primary-foreground" :
              i === current ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] uppercase tracking-wider hidden sm:block ${
              i === current ? "text-foreground font-medium" : "text-muted-foreground"
            }`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${i < current ? "bg-info" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Describe Step ───────────────────────────────────────────────────────────
function DescribeStep({ t, description, setDescription, onSubmit }: {
  t: (key: import("@/lib/i18n").TKey) => string; description: string; setDescription: (v: string) => void; onSubmit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <label className="block text-sm font-medium text-foreground mb-3">
          {t("machineBuilder.describeLabel")}
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit(); }}
          placeholder={t("machineBuilder.describePlaceholder")}
          rows={5}
          className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50 resize-none"
        />
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] text-muted-foreground">{t("machineBuilder.cmdEnterHint")}</span>
          <button
            onClick={onSubmit}
            disabled={!description.trim()}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition flex items-center gap-2"
          >
            {t("machineBuilder.analyse")}
          </button>
        </div>
      </div>

      {/* Examples */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3">{t("machineBuilder.tryExample")}</p>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => setDescription(ex)}
              className="text-left text-sm px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:border-info hover:text-foreground hover:bg-card transition"
            >
              <span className="text-info mr-2">→</span>{ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Questions Step ──────────────────────────────────────────────────────────
function QuestionsStep({ t, summary, questions, answers, setAnswers, onSubmit, onBack }: {
  t: (key: import("@/lib/i18n").TKey) => string; summary: string; questions: Question[]; answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void; onSubmit: () => void; onBack: () => void;
}) {
  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id]);

  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-xl border border-info/30 bg-info/5 px-4 py-3 text-sm text-foreground flex gap-3">
          <span className="text-info shrink-0 mt-0.5">✦</span>
          <span>{summary}</span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="text-sm font-medium text-foreground">
          {t("machineBuilder.answerQuestions")}
        </div>

        {questions.map((q, i) => (
          <div key={q.id}>
            <div className="flex items-start gap-2 mb-3">
              <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-semibold">{i + 1}</span>
              <div>
                <div className="text-sm font-medium">{q.label}</div>
                {q.hint && <div className="text-xs text-muted-foreground mt-0.5">{q.hint}</div>}
              </div>
            </div>
            {q.type === "choice" && q.options?.length ? (
              <div className="flex flex-wrap gap-2 ml-7">
                {q.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                      answers[q.id] === opt
                        ? "border-info bg-info/10 text-info font-medium"
                        : "border-border text-muted-foreground hover:border-info hover:text-foreground"
                    }`}
                  >
                    {answers[q.id] === opt && <span className="mr-1">✓</span>}
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              /* Fallback for number, text, or any other type Groq returns */
              <div className="ml-7 flex items-center gap-2">
                <input
                  type={q.type === "number" ? "number" : "text"}
                  min={q.type === "number" ? 0 : undefined}
                  value={answers[q.id] ?? ""}
                  onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder={q.type === "number" ? "0" : t("machineBuilder.typeAnswer")}
                  className="w-48 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
                />
                {q.unit && <span className="text-sm text-muted-foreground">{q.unit}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition">
          ← {t("machineBuilder.back")}
        </button>
        <button
          onClick={onSubmit}
          disabled={!allAnswered}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition"
        >
          {t("machineBuilder.findComponents")}
        </button>
      </div>
    </div>
  );
}

// ── Options Step ────────────────────────────────────────────────────────────
function OptionsStep({ t, summary, options, onSelect, onBack }: {
  t: (key: import("@/lib/i18n").TKey) => string; summary: string; options: ActuatorOption[]; onSelect: (o: ActuatorOption) => void; onBack: () => void;
}) {
  const BADGE_COLORS: Record<string, string> = {
    "Bästa valet": "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]",
    "Best choice": "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]",
    "Kompakt alternativ": "bg-info/10 text-info",
    "Compact option": "bg-info/10 text-info",
    "Budgetalternativ": "bg-gold/20 text-[oklch(0.45_0.12_80)]",
    "Budget option": "bg-gold/20 text-[oklch(0.45_0.12_80)]",
    "Premium alternativ": "bg-purple-100 text-purple-700",
    "Premium option": "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-xl border border-info/30 bg-info/5 px-4 py-3 text-sm flex gap-3">
          <span className="text-info shrink-0 mt-0.5">✦</span>
          <span>{summary}</span>
        </div>
      )}

      <p className="text-sm text-muted-foreground font-medium">
        {t("machineBuilder.selectMain")}
      </p>

      {options.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-3 text-center">
          <span className="text-3xl text-muted-foreground">⊘</span>
          <p className="text-sm font-medium text-foreground">{t("machineBuilder.noOptions")}</p>
          <p className="text-xs text-muted-foreground max-w-xs">{t("machineBuilder.noOptionsTip")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map(opt => {
            const p = opt.product;
            const salePrice = p?.purchase_price != null
              ? (p.purchase_price * (1 + (p.margin ?? 0.35))).toFixed(2)
              : null;
            const isStock = p?.availability === "stock" || (p?.lead_time_days != null && p.lead_time_days <= 3);
            const isFast = !isStock && p?.lead_time_days != null && p.lead_time_days <= 10;

            return (
              <button
                key={opt.sku}
                onClick={() => onSelect(opt)}
                className="w-full text-left rounded-xl border-2 border-border bg-card hover:border-info hover:shadow-md transition-all p-5 group"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${BADGE_COLORS[opt.badge] ?? "bg-muted text-muted-foreground"}`}>
                      {opt.badge}
                    </span>
                    <span className="font-semibold text-foreground group-hover:text-info transition">{opt.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{opt.sku}</span>
                  </div>
                  <span className="text-info text-sm font-medium shrink-0">
                    {t("machineBuilder.select")}
                  </span>
                </div>

                {/* Specs */}
                {(opt.bore_mm || opt.stroke_mm || opt.force_n) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {opt.bore_mm ? <SpecChip label="Bore" value={`${opt.bore_mm} mm`} /> : null}
                    {opt.stroke_mm ? <SpecChip label="Max stroke" value={`${opt.stroke_mm} mm`} /> : null}
                    {opt.force_n ? <SpecChip label="Force @ 6 bar" value={`${opt.force_n} N`} /> : null}
                  </div>
                )}

                {/* Why */}
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{opt.why}</p>

                {/* Pros / Cons */}
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    {opt.pros?.map((pr, i) => (
                      <div key={i} className="text-xs text-[oklch(0.45_0.12_155)] flex items-center gap-1 mt-1">
                        <span className="text-[oklch(0.55_0.15_155)]">✓</span> {pr}
                      </div>
                    ))}
                  </div>
                  <div>
                    {opt.cons?.map((c, i) => (
                      <div key={i} className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <span className="text-muted-foreground">—</span> {c}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Catalog data row */}
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 flex-wrap">
                  {p ? (
                    <>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">
                        ✓ {t("machineBuilder.inCatalog")}
                      </span>
                      {salePrice && (
                        <span className="text-xs text-foreground font-semibold">
                          {t("machineBuilder.salePrice")}: {salePrice} kr
                        </span>
                      )}
                      {isStock && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)] font-medium">
                          På lager
                        </span>
                      )}
                      {isFast && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[oklch(0.94_0.08_85)] text-[oklch(0.38_0.12_75)] font-medium">
                          ~{p.lead_time_days} {t("machineBuilder.days")}
                        </span>
                      )}
                      {!isStock && !isFast && p.lead_time_days != null && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {p.lead_time_days} {t("machineBuilder.days")}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {t("machineBuilder.notInCatalog")}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-start pt-1">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition">
          ← {t("machineBuilder.back")}
        </button>
      </div>
    </div>
  );
}

function SpecChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[11px] bg-muted px-2 py-1 rounded-md text-muted-foreground">
      <span className="text-foreground font-medium">{value}</span> {label}
    </span>
  );
}

// ── Export helpers ──────────────────────────────────────────────────────────
function exportBomCsv(bom: BomLine[], title: string) {
  const header = "SKU,Namn,Antal,Roll,Motivering";
  const rows = bom.map(l =>
    [l.sku, `"${(l.product?.name ?? "").replace(/"/g, '""')}"`, l.quantity, `"${l.role}"`, `"${l.reason}"`].join(",")
  );
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stycklista-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportBomPdf(bom: BomLine[], title: string, explanation: string, selected: ActuatorOption) {
  const rows = bom.map(l => `
    <tr>
      <td>${l.sku}</td>
      <td>${l.product?.name ?? "<em>Ej i katalog</em>"}</td>
      <td style="text-align:center">${l.quantity}</td>
      <td>${l.role}</td>
      <td>${l.reason}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8"/>
<title>Stycklista — ${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 20px; }
  .chip { display:inline-block; background:#f0f0f0; border-radius:4px; padding:2px 8px; font-size:11px; margin-right:6px; }
  table { width:100%; border-collapse:collapse; margin-top:16px; }
  th { background:#1e2a45; color:#fff; text-align:left; padding:8px 10px; font-size:11px; text-transform:uppercase; letter-spacing:.06em; }
  td { padding:7px 10px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
  tr:nth-child(even) td { background:#f9fafb; }
  .footer { margin-top:32px; font-size:10px; color:#999; border-top:1px solid #e5e7eb; padding-top:12px; }
  @media print { body { margin: 16px; } }
</style>
</head>
<body>
<h1>Stycklista — ${title}</h1>
<div class="meta">
  Genererad ${new Date().toLocaleDateString("sv-SE")} &nbsp;·&nbsp; Maskinval
</div>
<p style="margin-bottom:16px;font-size:12px;color:#444;">${explanation}</p>
<div>
  <span class="chip">Huvudkomponent: ${selected.name}</span>
  <span class="chip">${selected.sku}</span>
  ${selected.bore_mm ? `<span class="chip">Kolvdiameter: ${selected.bore_mm} mm</span>` : ""}
  ${selected.stroke_mm ? `<span class="chip">Slag: ${selected.stroke_mm} mm</span>` : ""}
  ${selected.force_n ? `<span class="chip">Kraft: ${selected.force_n} N</span>` : ""}
</div>
<table>
  <thead>
    <tr>
      <th>SKU</th><th>Namn</th><th style="text-align:center">Antal</th><th>Roll</th><th>Motivering</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  ${bom.length} artiklar totalt &nbsp;·&nbsp; maskinval.se
</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

// ── Result Step ─────────────────────────────────────────────────────────────
function ResultStep({ t, locale, title, explanation, selected, bom, description, answers,
  rfqName, rfqEmail, rfqSent, setRfqName, setRfqEmail, setRfqSent, onRestart }: {
  t: (key: import("@/lib/i18n").TKey) => string; locale: string; title: string; explanation: string;
  selected: ActuatorOption; bom: BomLine[]; description: string; answers: Record<string, string>;
  rfqName: string; rfqEmail: string; rfqSent: boolean;
  setRfqName: (v: string) => void; setRfqEmail: (v: string) => void; setRfqSent: (v: boolean) => void;
  onRestart: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const compareSkus = bom
    .filter(l => l.product)
    .slice(0, 4)
    .map(l => l.sku)
    .join(",");

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="rounded-xl border border-info/30 bg-info/5 px-5 py-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-info font-medium mb-1">
          {t("machineBuilder.yourSolution")}
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{explanation}</p>
      </div>

      {/* 3D Visualizer */}
      {mounted && (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium flex items-center gap-2">
              <span className="text-info">◈</span>
              {t("machineBuilder.visualization3d")}
            </div>
            <span className="text-[11px] text-muted-foreground">{t("machineBuilder.dragRotate")}</span>
          </div>
          <MachineVisualizer
            selected={selected}
            description={description}
            answers={answers}
          />
        </div>
      )}

      {/* BOM Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold">{t("machineBuilder.bomTitle")}</div>
          <div className="flex items-center gap-2">
            {compareSkus && (
              <Link
                to="/$locale/compare"
                params={{ locale } as never}
                search={{ skus: compareSkus }}
                className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-info transition"
              >
                ⇔ {t("machineBuilder.compareBom")}
              </Link>
            )}
            <button
              onClick={() => exportBomCsv(bom, title)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-info transition"
            >
              ↓ CSV
            </button>
            <button
              onClick={() => exportBomPdf(bom, title, explanation, selected)}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              ↓ PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("machineBuilder.nameCol")}</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("machineBuilder.qtyCol")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("machineBuilder.roleCol")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">{t("machineBuilder.reasonCol")}</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((line, i) => (
                <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="px-4 py-3">
                    {line.product ? (
                      <Link
                        to="/$locale/product/$sku"
                        params={{ locale, sku: line.sku } as never}
                        className="font-mono text-xs text-info hover:underline"
                      >{line.sku}</Link>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{line.sku}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {line.product?.name ?? <span className="text-muted-foreground italic">{t("machineBuilder.notInCatalog")}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center size-6 rounded bg-muted text-xs font-semibold">{line.quantity}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{line.role}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{line.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground">
          {bom.length} {t("machineBuilder.articlesTotal")}
        </div>
      </div>

      {/* RFQ */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-1">{t("machineBuilder.sendQuote")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("machineBuilder.sendQuoteBody")}
        </p>
        {rfqSent ? (
          <div className="rounded-lg bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)] px-4 py-3 text-sm font-medium">
            {t("machineBuilder.quoteThankYou")}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={rfqName}
              onChange={e => setRfqName(e.target.value)}
              placeholder={t("machineBuilder.yourNamePlaceholder")}
              className="flex-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
            />
            <input
              value={rfqEmail}
              onChange={e => setRfqEmail(e.target.value)}
              placeholder={t("machineBuilder.emailPlaceholder")}
              type="email"
              className="flex-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
            />
            <button
              onClick={() => { if (rfqName && rfqEmail) setRfqSent(true); }}
              disabled={!rfqName || !rfqEmail}
              className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition whitespace-nowrap"
            >
              {t("machineBuilder.sendButton")}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <button onClick={onRestart} className="text-sm text-muted-foreground hover:text-foreground transition">
          {t("machineBuilder.startOver")}
        </button>
        <Link
          to="/$locale/products"
          params={{ locale } as never}
          className="text-sm text-info hover:underline"
        >
          {t("machineBuilder.browseCatalog")}
        </Link>
      </div>
    </div>
  );
}

// ── 3D Machine Visualizer ───────────────────────────────────────────────────
function MachineVisualizer({ selected, description, answers }: {
  selected: ActuatorOption; description: string; answers: Record<string, string>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const isElectric = selected.sku.includes("DNCE") || selected.sku.includes("LEY");
  const isGripper = selected.sku.includes("HGP") || selected.sku.includes("MHZ") || selected.sku.includes("MHC") || selected.sku.includes("DHVZ");
  const isVacuum = selected.sku.includes("DHVZ") || selected.sku.includes("VN");
  const bore = selected.bore_mm ?? 50;
  const stroke = Math.min(selected.stroke_mm ?? 200, 300);
  const isVertical = /lyft|vertikal|upp|lift|vertical|press/i.test(description + JSON.stringify(answers));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    let t = 0;
    let rodExtension = 0;
    let direction = 1;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#f8fafc");
      bg.addColorStop(1, "#f1f5f9");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grid lines (subtle)
      ctx.strokeStyle = "rgba(148,163,184,0.15)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      if (isVertical) {
        drawVerticalSetup(ctx, W, H, bore, rodExtension, stroke, isElectric, isGripper, isVacuum, selected.name ?? "Aktuator");
      } else {
        drawHorizontalSetup(ctx, W, H, bore, rodExtension, stroke, isElectric, isGripper, isVacuum, selected.name ?? "Aktuator");
      }

      // Animate rod
      t += 0.02;
      rodExtension = ((Math.sin(t) + 1) / 2) * stroke * 0.6;

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [selected, isVertical]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "280px", display: "block" }}
    />
  );
}

function drawHorizontalSetup(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  bore: number, rodExt: number, maxStroke: number,
  isElectric: boolean, isGripper: boolean, isVacuum: boolean,
  name: string
) {
  const cx = W / 2;
  const cy = H / 2;
  const scale = Math.min(W, H) / 600;
  const bodyLen = 120 * scale;
  const bodyH = Math.max(24, bore * 0.6) * scale;
  const rodLen = (50 + rodExt * 0.8) * scale;
  const rodD = Math.max(8, bore * 0.22) * scale;

  const startX = cx - bodyLen / 2 - 20 * scale;
  const bodyY = cy - bodyH / 2;

  // Mounting bracket
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.roundRect(startX - 18 * scale, cy - bodyH * 0.8, 14 * scale, bodyH * 1.6, 3);
  ctx.fill();
  // Bracket bolts
  for (const dy of [-0.4, 0.4]) {
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(startX - 11 * scale, cy + dy * bodyH, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cylinder body
  const bodyGrad = ctx.createLinearGradient(startX, bodyY, startX, bodyY + bodyH);
  if (isElectric) {
    bodyGrad.addColorStop(0, "#6366f1");
    bodyGrad.addColorStop(0.4, "#818cf8");
    bodyGrad.addColorStop(1, "#4f46e5");
  } else {
    bodyGrad.addColorStop(0, "#94a3b8");
    bodyGrad.addColorStop(0.4, "#cbd5e1");
    bodyGrad.addColorStop(1, "#64748b");
  }
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(startX, bodyY, bodyLen, bodyH, 4 * scale);
  ctx.fill();
  ctx.strokeStyle = isElectric ? "#4f46e5" : "#475569";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // End cap left
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.roundRect(startX - 2 * scale, bodyY - 3 * scale, 10 * scale, bodyH + 6 * scale, 3);
  ctx.fill();

  // End cap right
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.roundRect(startX + bodyLen - 8 * scale, bodyY - 3 * scale, 10 * scale, bodyH + 6 * scale, 3);
  ctx.fill();

  // Port fittings (top of cylinder)
  for (const px of [0.25, 0.75]) {
    ctx.fillStyle = "#6aabcf";
    ctx.beginPath();
    ctx.roundRect(startX + bodyLen * px - 4 * scale, bodyY - 10 * scale, 8 * scale, 12 * scale, 2);
    ctx.fill();
    // Hose
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(startX + bodyLen * px, bodyY - 10 * scale);
    ctx.bezierCurveTo(
      startX + bodyLen * px, bodyY - 35 * scale,
      startX + bodyLen * px + 20 * scale, bodyY - 45 * scale,
      startX + bodyLen * px + 40 * scale, bodyY - 35 * scale,
    );
    ctx.stroke();
  }

  // Piston rod
  const rodGrad = ctx.createLinearGradient(0, cy - rodD / 2, 0, cy + rodD / 2);
  rodGrad.addColorStop(0, "#e2e8f0");
  rodGrad.addColorStop(0.5, "#f8fafc");
  rodGrad.addColorStop(1, "#cbd5e1");
  ctx.fillStyle = rodGrad;
  const rodX = startX + bodyLen + 2 * scale;
  ctx.beginPath();
  ctx.roundRect(rodX, cy - rodD / 2, rodLen, rodD, rodD / 2);
  ctx.fill();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.stroke();

  const payloadX = rodX + rodLen;
  const payloadH = Math.max(40, bore * 1.0) * scale;
  const payloadW = 50 * scale;

  if (isGripper || isVacuum) {
    // Gripper jaws
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.roundRect(payloadX, cy - payloadH * 0.6, 16 * scale, payloadH * 0.4, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(payloadX, cy + payloadH * 0.2, 16 * scale, payloadH * 0.4, 2);
    ctx.fill();
    // Object in gripper
    ctx.fillStyle = "rgba(249,115,22,0.8)";
    ctx.beginPath();
    ctx.arc(payloadX + 30 * scale, cy, 14 * scale, 0, Math.PI * 2);
    ctx.fill();
    labelAt(ctx, payloadX + 30 * scale, cy + 32 * scale, isGripper ? "Objekt" : "Sugyta", scale);
  } else {
    // Payload block
    const payGrad = ctx.createLinearGradient(payloadX, cy - payloadH / 2, payloadX, cy + payloadH / 2);
    payGrad.addColorStop(0, "#fb923c");
    payGrad.addColorStop(1, "#ea580c");
    ctx.fillStyle = payGrad;
    ctx.beginPath();
    ctx.roundRect(payloadX, cy - payloadH / 2, payloadW, payloadH, 4 * scale);
    ctx.fill();
    ctx.strokeStyle = "#c2410c";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    labelAt(ctx, payloadX + payloadW / 2, cy + payloadH / 2 + 18 * scale, "Förflyttat objekt", scale);
  }

  // Ground rail
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.roundRect(startX - 25 * scale, cy + bodyH / 2 + 8 * scale, bodyLen + rodLen + payloadW + 45 * scale, 6 * scale, 2);
  ctx.fill();

  // Labels
  labelAt(ctx, startX + bodyLen / 2, bodyY - 18 * scale, name, scale);
  if (bore) {
    labelAt(ctx, startX + bodyLen / 2, bodyY + bodyH + 22 * scale, `⌀${bore} mm`, scale, true);
  }
}

function drawVerticalSetup(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  bore: number, rodExt: number, maxStroke: number,
  isElectric: boolean, isGripper: boolean, isVacuum: boolean,
  name: string
) {
  const cx = W / 2;
  const scale = Math.min(W, H) / 600;
  const bodyLen = 100 * scale;
  const bodyW = Math.max(24, bore * 0.6) * scale;
  const rodLen = (40 + rodExt * 0.7) * scale;
  const payloadH = 40 * scale;
  const payloadW = 60 * scale;

  const topY = H * 0.12;
  const bodyX = cx - bodyW / 2;

  // Ceiling mount
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.roundRect(cx - 30 * scale, topY - 14 * scale, 60 * scale, 14 * scale, 2);
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(cx + dx * 50 * scale, topY - 7 * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cylinder body
  const bodyGrad = ctx.createLinearGradient(bodyX, topY, bodyX + bodyW, topY);
  if (isElectric) {
    bodyGrad.addColorStop(0, "#4f46e5");
    bodyGrad.addColorStop(0.5, "#818cf8");
    bodyGrad.addColorStop(1, "#4f46e5");
  } else {
    bodyGrad.addColorStop(0, "#64748b");
    bodyGrad.addColorStop(0.5, "#cbd5e1");
    bodyGrad.addColorStop(1, "#64748b");
  }
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(bodyX, topY, bodyW, bodyLen, 4 * scale);
  ctx.fill();
  ctx.strokeStyle = isElectric ? "#4f46e5" : "#475569";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Port fittings
  for (const py of [0.25, 0.75]) {
    ctx.fillStyle = "#6aabcf";
    ctx.beginPath();
    ctx.roundRect(bodyX + bodyW, topY + bodyLen * py - 4 * scale, 12 * scale, 8 * scale, 2);
    ctx.fill();
    // Hose
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(bodyX + bodyW + 12 * scale, topY + bodyLen * py);
    ctx.bezierCurveTo(
      bodyX + bodyW + 35 * scale, topY + bodyLen * py,
      bodyX + bodyW + 45 * scale, topY + bodyLen * py + 20 * scale,
      bodyX + bodyW + 35 * scale, topY + bodyLen * py + 40 * scale,
    );
    ctx.stroke();
  }

  // Rod
  const rodGrad = ctx.createLinearGradient(cx - 4 * scale, 0, cx + 4 * scale, 0);
  rodGrad.addColorStop(0, "#94a3b8");
  rodGrad.addColorStop(0.5, "#f8fafc");
  rodGrad.addColorStop(1, "#94a3b8");
  ctx.fillStyle = rodGrad;
  const rodY = topY + bodyLen;
  ctx.beginPath();
  ctx.roundRect(cx - (bore * 0.11) * scale, rodY, (bore * 0.22) * scale, rodLen, 2);
  ctx.fill();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Payload
  const pY = rodY + rodLen;
  const payGrad = ctx.createLinearGradient(cx - payloadW / 2, pY, cx - payloadW / 2, pY + payloadH);
  payGrad.addColorStop(0, "#fb923c");
  payGrad.addColorStop(1, "#ea580c");
  ctx.fillStyle = payGrad;
  ctx.beginPath();
  ctx.roundRect(cx - payloadW / 2, pY, payloadW, payloadH, 4 * scale);
  ctx.fill();
  ctx.strokeStyle = "#c2410c";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Arrow showing direction
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(cx + bodyW / 2 + 35 * scale, topY);
  ctx.lineTo(cx + bodyW / 2 + 35 * scale, pY + payloadH);
  ctx.stroke();
  ctx.setLineDash([]);
  const arrowY = pY + payloadH;
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(cx + bodyW / 2 + 30 * scale, arrowY - 8 * scale);
  ctx.lineTo(cx + bodyW / 2 + 40 * scale, arrowY - 8 * scale);
  ctx.lineTo(cx + bodyW / 2 + 35 * scale, arrowY);
  ctx.fill();

  // Labels
  labelAt(ctx, cx, topY + bodyLen / 2, name, scale, false, true);
  labelAt(ctx, cx, pY + payloadH + 18 * scale, "Lyft/last", scale);
  if (bore) {
    labelAt(ctx, bodyX - 28 * scale, topY + bodyLen / 2, `⌀${bore}mm`, scale, true);
  }
}

function labelAt(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  scale: number,
  small = false,
  vertical = false
) {
  ctx.save();
  if (vertical) {
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    x = 0; y = 0;
  }
  ctx.font = `${small ? 10 : 11}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const metrics = ctx.measureText(text);
  const pad = 5;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.roundRect(x - metrics.width / 2 - pad, y - 8, metrics.width + pad * 2, 16, 3);
  ctx.fill();
  ctx.fillStyle = small ? "#64748b" : "#1e293b";
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── Loading Card ────────────────────────────────────────────────────────────
function LoadingCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center gap-4">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="size-2.5 rounded-full bg-info animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

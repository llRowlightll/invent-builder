import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Machine3DSceneProps } from "@/components/Machine3DScene";
const Machine3DScene = lazy(() =>
  import("@/components/Machine3DScene").then(m => ({ default: m.Machine3DScene }))
);
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/machine-builder")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("nav.machineBuilder")} — ${t("common.appName")}` },
        { name: "description", content: t("machineBuilder.metaDesc") },
      ],
    };
  },
  component: MachineBuilderPage,
});

const ADVISOR_URL = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/groq-advisor";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string ?? "";

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

/** Server-computed requirement numbers — lets the UI draw a "required vs
 * available" margin visual instead of just prose reasoning. Shared across all
 * options in one response since they all answer the same application. */
interface Requirements {
  load_kg: number | null;
  required_force_n: number | null;
  required_stroke_mm: number | null;
  safety_factor: number;
  pressure_bar: number;
}

interface BomLine {
  sku: string;
  quantity: number;
  role: string;
  reason: string;
  product?: ProductRow;
}

type Step = "describe" | "q_loading" | "questions" | "o_loading" | "options" | "bom_loading" | "result";

const EXAMPLES: Record<string, string[]> = {
  sv: [
    "Pneumatisk stoppdon på transportband — stoppar kartonger 5 kg",
    "Lyfter en plåtdel 15 kg vertikalt 200 mm i en pressstation",
    "Plockar och placerar kartong 2 kg — vakuumgrepp från magasin",
    "Klamrar fast en detalj under svetsning, horisontell rörelse 80 mm",
    "Vakuumgrepp som lyfter glasskivor 4 kg i monteringscell",
    "Elektrisk linjäraxel för exakt positionering av kamera, 300 mm slag",
  ],
  en: [
    "Pneumatic stop unit on conveyor — stops 5 kg cartons",
    "Lifts a 15 kg metal part vertically 200 mm in a press station",
    "Pick and place 2 kg carton — vacuum grip from magazine",
    "Clamps a part during welding, horizontal movement 80 mm",
    "Vacuum gripper lifting 4 kg glass panels in assembly cell",
    "Electric linear axis for precise camera positioning, 300 mm stroke",
  ],
  de: [
    "Pneumatischer Stopper auf Förderband — hält 5 kg Kartons an",
    "Hebt ein 15 kg Blechteil vertikal 200 mm in einer Pressenstation",
    "Pick-and-Place 2 kg Karton — Vakuumgreifer aus Magazin",
    "Klemmt ein Teil beim Schweißen, horizontale Bewegung 80 mm",
    "Vakuumgreifer für 4 kg Glasscheiben in Montagezelle",
    "Elektrische Linearachse für genaue Kamerapositionierung, 300 mm Hub",
  ],
  es: [
    "Tope neumático en cinta transportadora — detiene cajas de 5 kg",
    "Levanta pieza de metal 15 kg verticalmente 200 mm en prensa",
    "Pick and place cartón 2 kg — pinza de vacío desde almacén",
    "Fija pieza durante soldadura, movimiento horizontal 80 mm",
    "Pinza de vacío para paneles de vidrio 4 kg en célula de montaje",
    "Eje lineal eléctrico para posicionamiento preciso de cámara, 300 mm",
  ],
};

// ── Advisor API calls ───────────────────────────────────────────────────────
async function advisorCall(body: object) {
  const res = await fetch(ADVISOR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 503) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error(`Advisor error ${res.status}`);
  return res.json();
}

// Downscale a customer photo client-side (≤1024 px, JPEG) so the payload stays
// small and under the vision API's 4 MB base64 cap regardless of camera size.
async function fileToJpegDataUrl(file: File, maxDim = 1024): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

// ── Main component ──────────────────────────────────────────────────────────
function MachineBuilderPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const isSv = locale === "sv";
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("describe");
  const [description, setDescription] = useState("");
  const [qSummary, setQSummary] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [optionsSummary, setOptionsSummary] = useState("");
  const [options, setOptions] = useState<ActuatorOption[]>([]);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [selected, setSelected] = useState<ActuatorOption | null>(null);
  const [bom, setBom] = useState<BomLine[]>([]);
  const [bomTitle, setBomTitle] = useState("");
  const [bomExplanation, setBomExplanation] = useState("");
  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const [error, setError] = useState("");
  const [rfqSent, setRfqSent] = useState(false);
  const [rfqId, setRfqId] = useState("");
  const [rfqName, setRfqName] = useState("");
  const [rfqEmail, setRfqEmail] = useState("");
  const [rfqCompany, setRfqCompany] = useState("");
  const [rfqPhone, setRfqPhone] = useState("");
  const [rfqPoNumber, setRfqPoNumber] = useState("");
  const [rfqOrgNumber, setRfqOrgNumber] = useState("");
  const [autoSaved, setAutoSaved] = useState(false);

  useEffect(() => { loadCatalog().then(setCatalog).catch(() => {}); }, []);

  // Pre-fill RFQ form from company profile when user logs in
  useEffect(() => {
    if (!user) return;
    supabase
      .from("company_profiles")
      .select("display_name,email,company_name,phone,org_number")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.display_name && !rfqName) setRfqName(data.display_name);
        if (data.email && !rfqEmail) setRfqEmail(data.email);
        if (data.company_name && !rfqCompany) setRfqCompany(data.company_name);
        if (data.phone && !rfqPhone) setRfqPhone(data.phone);
        if (data.org_number && !rfqOrgNumber) setRfqOrgNumber(data.org_number);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-save BOM as project when result step is reached (logged-in users only)
  useEffect(() => {
    if (step !== "result" || !user || autoSaved || bom.length === 0) return;
    const name = bomTitle || `Maskinbyggare — ${new Date().toLocaleDateString("sv-SE")}`;
    const bomSnapshot = bom.map(l => ({
      sku: l.sku, role: l.role, qty: l.quantity,
      name: l.product?.name ?? l.sku,
    }));
    supabase.from("projects").insert({
      user_id: user.id,
      name,
      description: description.trim() || null,
      locale,
      answers,
      bom_lines: bomSnapshot,
    }).then(() => setAutoSaved(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user]);

  // Fix 3: Ladda sparat projekt från sessionStorage (navigering från /projects)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("mv_load_project");
      if (!raw) return;
      sessionStorage.removeItem("mv_load_project"); // rensa direkt
      const proj = JSON.parse(raw) as {
        id: string; name: string; description: string | null;
        answers: Record<string, string>; bom_lines: Array<{ sku: string; role: string; qty: number; unit_price?: number; name?: string }>;
      };
      // Fyll i beskrivning och hoppa till resultatsteget
      setDescription(proj.description ?? proj.name);
      setAnswers(proj.answers ?? {});
      // Rekonstruera BOM-rader
      const loadedBom: BomLine[] = (proj.bom_lines ?? []).map(l => ({
        sku: l.sku,
        role: l.role,
        quantity: l.qty,
        reason: "",
        product: undefined, // fylls i av enrichWithCatalog nedan
      }));
      setBom(loadedBom);
      setBomTitle(proj.name);
      setBomExplanation((locale === "sv" ? "Laddat från sparat projekt: " : "Loaded from saved project: ") + proj.name);
      setSelected({ id: "loaded", name: proj.name, desc: "", tags: [] } as never);
      setStep("result");
    } catch {
      // JSON-parse-fel eller sessionStorage blockerat — ignorera
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    } catch (e) {
      setError(t((e as Error).message === "RATE_LIMITED" ? "machineBuilder.errorRateLimit" : "machineBuilder.errorGeneric"));
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
      setRequirements(data.requirements ?? null);
      setStep("options");
    } catch (e) {
      setError(t((e as Error).message === "RATE_LIMITED" ? "machineBuilder.errorRateLimit" : "machineBuilder.errorGeneric"));
      setStep("questions");
    }
  }

  // Step 3 → BOM (or advisor redirect for custom solutions)
  async function handleSelect(opt: ActuatorOption) {
    if (opt.sku === "CUSTOM-SOLUTION") {
      const context = [
        description,
        Object.keys(answers).length
          ? "\n\nKrav:\n" + Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join("\n")
          : "",
      ].join("");
      window.location.href = `/${locale}/advisor?q=${encodeURIComponent(context)}`;
      return;
    }
    setSelected(opt);
    setError("");
    setStep("bom_loading");
    try {
      const data = await advisorCall({ action: "bom", description, answers, primarySku: opt.sku, locale });
      const enriched = enrichWithCatalog<BomLine>(data.bom ?? []);
      setBom(enriched);
      setBomTitle(data.title ?? "");
      setBomExplanation(data.explanation ?? "");
      setStep("result");
    } catch (e) {
      setError(t((e as Error).message === "RATE_LIMITED" ? "machineBuilder.errorRateLimit" : "machineBuilder.errorGeneric"));
      setStep("options");
    }
  }

  function restart() {
    setStep("describe");
    setDescription("");
    setQuestions([]);
    setAnswers({});
    setOptions([]);
    setRequirements(null);
    setSelected(null);
    setBom([]);
    setBomTitle("");
    setBomExplanation("");
    setRfqSent(false);
    setRfqId("");
    setRfqName("");
    setRfqEmail("");
    setRfqCompany("");
    setRfqPhone("");
    setError("");
  }

  return (
    <div className="container-page py-4 max-w-4xl">
      {/* Header — compact */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <span className="text-info text-sm">✦</span>
            {t("machineBuilder.title")}
          </h1>
          <p className="text-xs text-muted-foreground max-w-xl mt-0.5">
            {t("machineBuilder.subtitle")}
          </p>
        </div>
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
          locale={locale}
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
          locale={locale}
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
          locale={locale}
          summary={optionsSummary}
          options={options}
          requirements={requirements}
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
          requirements={requirements}
          bom={bom}
          catalog={catalog}
          description={description}
          answers={answers}
          rfqName={rfqName}
          rfqEmail={rfqEmail}
          rfqCompany={rfqCompany}
          rfqPhone={rfqPhone}
          rfqPoNumber={rfqPoNumber}
          rfqOrgNumber={rfqOrgNumber}
          rfqSent={rfqSent}
          rfqId={rfqId}
          autoSaved={autoSaved}
          setRfqName={setRfqName}
          setRfqEmail={setRfqEmail}
          setRfqCompany={setRfqCompany}
          setRfqPhone={setRfqPhone}
          setRfqPoNumber={setRfqPoNumber}
          setRfqOrgNumber={setRfqOrgNumber}
          setRfqSent={setRfqSent}
          setRfqId={setRfqId}
          onRestart={restart}
          onBack={() => setStep("options")}
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
    <div className="flex items-center gap-0 mb-4">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-0.5">
            <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
              i < current ? "bg-info text-primary-foreground" :
              i === current ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            <span className={`text-[9px] uppercase tracking-wider hidden sm:block ${
              i === current ? "text-foreground font-medium" : "text-muted-foreground"
            }`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1.5 mb-3 transition-colors ${i < current ? "bg-info" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Describe Step ───────────────────────────────────────────────────────────
function DescribeStep({ t, locale, description, setDescription, onSubmit }: {
  t: (key: import("@/lib/i18n").TKey) => string; locale: string; description: string; setDescription: (v: string) => void; onSubmit: () => void;
}) {
  const examples = EXAMPLES[locale] ?? EXAMPLES.en;
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState("");
  const [thumbs, setThumbs] = useState<string[]>([]);

  // Photo → vision action → editable TEXT appended to the description. The image
  // itself never reaches options/BOM — only its analysis text does, so the
  // deterministic selection pipeline is untouched and the user can correct it.
  async function onPickImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImgError("");
    const picked = Array.from(files).slice(0, 3 - thumbs.length);
    if (picked.length === 0) return;
    setImgBusy(true);
    try {
      // Accumulate locally — the `description` prop is stale inside the loop, so
      // appending two analyses via the prop would drop the first one.
      let desc = description;
      for (const file of picked) {
        if (!file.type.startsWith("image/") || file.size > 15_000_000) {
          setImgError(t("machineBuilder.imageError")); continue;
        }
        const dataUrl = await fileToJpegDataUrl(file);
        const res = await advisorCall({ action: "vision", image: dataUrl, locale });
        const text = (res?.description ?? "").trim();
        if (!text) { setImgError(t("machineBuilder.imageError")); continue; }
        setThumbs(prev => [...prev, dataUrl]);
        const block = `📷 ${t("machineBuilder.imageAnalysisLabel")}: ${text}`;
        desc = desc.trim() ? `${desc.trim()}\n\n${block}` : block;
        setDescription(desc);
      }
    } catch {
      setImgError(t("machineBuilder.imageError"));
    } finally {
      setImgBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <label className="block text-sm font-medium text-foreground mb-2">
          {t("machineBuilder.describeLabel")}
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit(); }}
          placeholder={t("machineBuilder.describePlaceholder")}
          rows={3}
          autoFocus
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50 resize-none"
        />
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <input
            ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            onChange={e => onPickImages(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={imgBusy || thumbs.length >= 3}
            className="px-3 py-1.5 rounded-lg border border-input text-xs font-medium text-muted-foreground hover:border-info hover:text-foreground disabled:opacity-40 transition flex items-center gap-1.5"
          >
            {imgBusy ? t("machineBuilder.analysingImage") : <>📷 {t("machineBuilder.uploadImage")}</>}
          </button>
          {thumbs.map((src, i) => (
            <span key={i} className="relative inline-block">
              <img src={src} alt="" className="h-9 w-9 rounded-md object-cover border border-border" />
              <button
                type="button"
                onClick={() => setThumbs(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-secondary text-secondary-foreground text-[9px] leading-4 text-center border border-border"
                aria-label="×"
              >×</button>
            </span>
          ))}
          <span className="text-[11px] text-muted-foreground">{imgError || t("machineBuilder.imageHint")}</span>
        </div>
        <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] text-muted-foreground">{t("machineBuilder.cmdEnterHint")}</span>
          <button
            onClick={onSubmit}
            disabled={!description.trim() || imgBusy}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition flex items-center gap-2"
          >
            {t("machineBuilder.analyse")}
          </button>
        </div>
      </div>

      {/* Examples */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3">{t("machineBuilder.tryExample")}</p>
        <div className="flex flex-col gap-2">
          {examples.map(ex => (
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
function QuestionsStep({ t, locale, summary, questions, answers, setAnswers, onSubmit, onBack }: {
  t: (key: import("@/lib/i18n").TKey) => string; locale: string; summary: string; questions: Question[]; answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void; onSubmit: () => void; onBack: () => void;
}) {
  const isSv = locale === "sv";
  // All number fields allow 0 — 0 is a valid answer (e.g. "0 mm precision" = no precision req,
  // "0 bar" = no pressure needed). Only reject negative numbers and NaN.

  const allAnswered = questions.length > 0 && questions.every(q => {
    const val = answers[q.id];
    if (val === undefined || val === "") return false;
    if (q.type === "number") {
      const n = parseFloat(val);
      if (isNaN(n)) return false;
      if (n < 0) return false;
    }
    return true;
  });

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
              (() => {
                const raw = answers[q.id];
                const numVal = raw !== undefined && raw !== "" ? parseFloat(raw) : null;
                const isInvalid = q.type === "number" && raw !== undefined && raw !== "" &&
                  (isNaN(numVal!) || numVal! < 0);
                return (
                  <div className="ml-7 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type={q.type === "number" ? "number" : "text"}
                        min={q.type === "number" ? 0 : undefined}
                        value={raw ?? ""}
                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                        placeholder={q.type === "number" ? t("machineBuilder.enterValue") : t("machineBuilder.typeAnswer")}
                        className={`w-48 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-background transition ${
                          isInvalid
                            ? "border-destructive focus:ring-destructive/50"
                            : "border-input focus:ring-info/50"
                        }`}
                      />
                      {q.unit && <span className="text-sm text-muted-foreground">{q.unit}</span>}
                    </div>
                    {isInvalid && (
                      <p className="text-xs text-destructive">
                        {t("machineBuilder.invalidPositive")}
                      </p>
                    )}
                  </div>
                );
              })()
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
function OptionsStep({ t, locale, summary, options, requirements, onSelect, onBack }: {
  t: (key: import("@/lib/i18n").TKey) => string; locale: string; summary: string; options: ActuatorOption[];
  requirements: Requirements | null; onSelect: (o: ActuatorOption) => void; onBack: () => void;
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

      <div className="space-y-3">
        {options.map(opt => {
          const isCustom = opt.sku === "CUSTOM-SOLUTION";

          if (isCustom) {
            return (
              <button
                key="CUSTOM-SOLUTION"
                onClick={() => onSelect(opt)}
                className="w-full text-left rounded-xl border-2 border-gold/40 bg-gold/5 hover:border-gold hover:shadow-md transition-all p-5 group"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-gold/20 text-[oklch(0.45_0.12_80)]">
                      Kundlösning
                    </span>
                    <span className="font-semibold text-foreground group-hover:text-[oklch(0.55_0.15_80)] transition">{opt.name}</span>
                  </div>
                  <span className="text-[oklch(0.55_0.15_80)] text-sm font-medium shrink-0">
                    🤝 Skicka förfrågan →
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{opt.why}</p>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    {opt.pros?.map((p, i) => (
                      <div key={i} className="text-xs text-[oklch(0.45_0.12_80)] flex items-center gap-1 mt-1">
                        <span>✓</span> {p}
                      </div>
                    ))}
                  </div>
                  <div>
                    {opt.cons?.map((c, i) => (
                      <div key={i} className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <span>—</span> {c}
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            );
          }

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
                  {!requirements?.required_stroke_mm && opt.stroke_mm ? <SpecChip label="Stroke" value={`${opt.stroke_mm} mm`} /> : null}
                  {!requirements?.required_force_n && opt.force_n ? <SpecChip label={opt.bore_mm ? "Force @ 6 bar" : "Force"} value={`${opt.force_n} N`} /> : null}
                </div>
              )}

              {/* Calculated dimensioning — required vs available */}
              <DimensioningPanel locale={locale} requirements={requirements} option={opt} />

              {/* Why */}
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{opt.why}</p>

              {/* Pros / Cons */}
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                <div>
                  {opt.pros?.map((p, i) => (
                    <div key={i} className="text-xs text-[oklch(0.45_0.12_155)] flex items-center gap-1 mt-1">
                      <span className="text-[oklch(0.55_0.15_155)]">✓</span> {p}
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
            </button>
          );
        })}
      </div>

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

// ── Dimensioning visual — "required vs available", Festo/SMC-style margin bar ──
// Renders nothing when the numbers needed for a given bar aren't available, so it
// degrades silently for options/applications where force or stroke don't apply
// (e.g. electric actuators, torque-based rotary picks, CUSTOM-SOLUTION).
function DimensioningBar({ label, required, available, unit, requiredLabel, availableLabel }: {
  label: string; required: number; available: number; unit: string; requiredLabel: string; availableLabel: string;
}) {
  const max = Math.max(required, available, 1) * 1.05; // headroom so the bar isn't edge-to-edge
  const availPct = Math.min((available / max) * 100, 100);
  const reqPct = Math.min((required / max) * 100, 100);
  const meets = available >= required;
  const margin = required > 0 ? available / required : null;

  return (
    <div className="min-w-[160px] flex-1">
      <div className="flex items-baseline justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${meets ? "text-[oklch(0.45_0.14_155)]" : "text-destructive"}`}>
          {margin != null ? `${margin.toFixed(1)}×` : meets ? "✓" : "⚠"}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${meets ? "bg-[oklch(0.72_0.15_155)]" : "bg-destructive/70"}`}
          style={{ width: `${availPct}%` }}
        />
        <div
          className="absolute inset-y-0 w-[2px] bg-foreground/50"
          style={{ left: `${reqPct}%` }}
          title={`${requiredLabel}: ${required} ${unit}`}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>{requiredLabel} {required.toLocaleString()} {unit}</span>
        <span>{availableLabel} {available.toLocaleString()} {unit}</span>
      </div>
    </div>
  );
}

function DimensioningPanel({ locale, requirements, option, bordered = true }: {
  locale: string; requirements: Requirements | null; option: ActuatorOption; bordered?: boolean;
}) {
  const isSv = locale === "sv";
  if (!requirements || option.sku === "CUSTOM-SOLUTION") return null;

  const showForce = requirements.required_force_n != null && option.force_n != null;
  const showStroke = requirements.required_stroke_mm != null && option.stroke_mm != null;
  if (!showForce && !showStroke) return null;

  return (
    <div className={`flex flex-wrap gap-4 ${bordered ? "mt-3 pt-3 border-t border-border/60" : ""}`}>
      {showForce && (
        <DimensioningBar
          label={isSv ? `Kraft @ ${requirements.pressure_bar} bar` : `Force @ ${requirements.pressure_bar} bar`}
          required={requirements.required_force_n!}
          available={option.force_n!}
          unit="N"
          requiredLabel={isSv ? "Krävs" : "Required"}
          availableLabel={isSv ? "Ger" : "Delivers"}
        />
      )}
      {showStroke && (
        <DimensioningBar
          label={isSv ? "Slaglängd" : "Stroke"}
          required={requirements.required_stroke_mm!}
          available={option.stroke_mm!}
          unit="mm"
          requiredLabel={isSv ? "Krävs" : "Required"}
          availableLabel={isSv ? "Klarar" : "Rated"}
        />
      )}
    </div>
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
      <td>${l.product?.name ?? (l.sku === "SPECIFY" ? "<em>Specificera variant / kräver offert</em>" : "<em>Ej i katalog</em>")}</td>
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

// ── Economic BOM helpers ────────────────────────────────────────────────────

/** Guess catalog category slug from BOM role text / SKU. Null = skip (hoses, fittings etc.) */
function roleToCategory(role: string, sku: string): string | null {
  const r = role.toLowerCase();
  const s = sku.toLowerCase();

  // ── Elektrisk aktuator (före pneumatisk cylinder — mer specifik) ──────────
  if (/elektr|electric|servo|stepper|spindle|spindel|kugelgewind|ball.screw|linjär.*driv|linear.*driv|elektrisk.*axel|servo.*axel|elektrisk.*cylinder|electric.*cylinder/.test(r)
    || /dnce|epco|egsk|egsp|ley\b|lesh|lefs|lecp|6e-0|mw-elk/.test(s)) return "electric-actuator";

  // ── Linjärmodul / gantry / toothed-belt-axel ────────────────────────────
  if (/linjärmodul|linear.*modul|linjär.*axel|tandbältsaxel|toothed.belt|ball.screw.axis|gantry|kantilever|elektr.*glid|electrical.*slide|electric.*slide/.test(r)
    || /festo-155|festo-175|festo-530|festo-556|festo-562|festo-802|festo-811|festo-147|mw-s10/.test(s)
    || /festo-egc|festo-elga|parker-hmr|parker-hmrs|parker-hmrb|parker-lbb|parker-hlr|parker-ospe|parker-eth/.test(s)) return "linear-module";

  // ── Pneumatisk cylinder (standard) ──────────────────────────────────────
  if (/cylinder|aktuator|actuator|main act|axel \d/.test(r)
    || /dsbc|advu|cq2|cp96|p1d|advc|dsnu|mb\b|cena/.test(s)) return "cylinder";

  // ── Gripper ──────────────────────────────────────────────────────────────
  if (/gripper|grepp|k[aä]ft|jaw/.test(r) || /hgp|mhz|mhc|pgn/.test(s)) return "gripper";

  // ── Vakuum / ejektor ─────────────────────────────────────────────────────
  if (/vakuum.*gen|ejektor|vacuum.*gen|ejector/.test(r) || /vadmi|zu0|ovem/.test(s)) return "vacuum";

  // ── FRL (filter-regulator-lubricator) ────────────────────────────────────
  if (/frl|filter.*reg|luftbered|air.*prep|tryckreducer/.test(r)
    || /ms4|ms6\b|lf\b|aw\d|ac\d|festo-ms|mc-fr|mc-frl|mx-fr|mw-frl/.test(s)) return "frl";

  // ── Styrventil (solenoid) ────────────────────────────────────────────────
  if (/styrventil|kontrollventil|control.*valve|solenoid|magnetventil/.test(r)
    && !/terminal/.test(r)) return "valve";

  // ── Ventilterminal ───────────────────────────────────────────────────────
  if (/ventilterminal|valve.*terminal/.test(r) || /vtsa|vtug|mpa-s|ex500/.test(s)) return "valve-terminal";

  // ── Sensor / ändlägesgivare ──────────────────────────────────────────────
  if (/givare|sensor|ändl[äa]ge|end.pos|reed|proximity|närhets|tryckvakt|pressure.*switch/.test(r)
    || /smt-|sme-|sies|siet|d-a7|d-a9|d-m9|zse/.test(s)) return "sensor";

  // ── Koppling / push-in fitting ───────────────────────────────────────────
  if (/koppling|fitting|anslut|push.?in|snabbanslut|kd3/.test(r)
    || /^qs-|^qs[lsyt]-|kq2|kd3/.test(s)) return "fitting";

  // ── Slang / tubing ───────────────────────────────────────────────────────
  if (/slang|slange|tub|tube|hose|rör/.test(r) || /^pan-|^tu\d|^pun/.test(s)) return "tubing";

  // ── Ljuddämpare ──────────────────────────────────────────────────────────
  if (/ljuddämp|silencer|muffler|avgasdämp/.test(r) || /^u-1|^u-m|^an[12]|^an5/.test(s)) return "silencer";

  // ── Flödesreglering / hastighetsstyrventil ───────────────────────────────
  if (/stryp|flödesregl|speed.*control|hastighetsstyr|flow.*control|snabbutluft|quick.*exhaust/.test(r)
    || /^grla|^grlz|^as\d|vfoe|vhs/.test(s)) return "flow-control";

  // ── Fäste / monteringstillbehör ──────────────────────────────────────────
  if (/fäst|mount|bracket|konsol|adapter|gaffel|sväng|pivot|flange|foot/.test(r)
    || /^hnc-|^sncs|^fnc-|^crhn|cs16|^la-/.test(s)) return "mounting";

  // ── Sensorkabel ──────────────────────────────────────────────────────────
  if (/kabel|cable|ledning|sensor.*kabel/.test(r) || /nebu|^e2-m/.test(s)) return "cable";

  return null;
}

/** Parse minimum technical requirements from the user's question answers. */
function parseRequirements(answers: Record<string, string>) {
  // Min force (N) from weight answer
  const w = answers.weight ?? "";
  const minForce =
    /< 1|under 1/i.test(w)  ? 20  :
    /1.{0,3}5 kg/i.test(w)  ? 75  :
    /5.{0,3}20/i.test(w)    ? 300 :
    /20.{0,3}50/i.test(w)   ? 750 :
    /> 50|50 kg/i.test(w)   ? 1500 : 0;

  // Min stroke (mm) — check stroke, stroke_z, stroke_x
  const s = [answers.stroke, answers.stroke_z, answers.stroke_x].filter(Boolean).join(" ");
  const minStroke =
    /< 50/i.test(s)        ? 0   :
    /50.{0,3}150/i.test(s) ? 50  :
    /150.{0,3}300/i.test(s)? 150 :
    /300.{0,3}500/i.test(s)? 300 :
    /> 500/i.test(s)       ? 500 : 0;

  // IP requirement from environment
  const env = answers.environment ?? "";
  const needsHighIP = /livsmedel|washdown|ip6/i.test(env);

  return { minForce, minStroke, needsHighIP };
}

/** Approximate force in N at 6 bar for a bore_mm. */
const boreForce = (bore: number) => Math.PI * (bore / 2) ** 2 * 6 * 0.1; // bar→N/mm²

export interface AltTiers {
  economic: ProductRow[];  // meets requirements, lowest price
  best:     ProductRow[];  // meets requirements, most force/stroke
  compact:  ProductRow[];  // meets requirements, smallest bore
}

/**
 * Find tiered alternatives for one BOM line, filtered by the customer's stated requirements.
 * All alternatives must be a different brand AND meet min force + min stroke from answers.
 */
function findAlternativesTiered(
  line: BomLine,
  catalog: ProductRow[],
  answers: Record<string, string>,
): AltTiers {
  const cat = roleToCategory(line.role, line.sku);
  if (!cat) return { economic: [], best: [], compact: [] };

  const { minForce, minStroke, needsHighIP } = parseRequirements(answers);
  const currentBrand = line.product?.brand?.slug ?? "";
  const currentBore  = parseFloat(line.product?.specs["bore_mm"]?.value ?? "0");
  const isCylinder   = cat === "cylinder";
  const isElectric   = cat === "electric-actuator" || cat === "linear-module";

  const candidates = catalog.filter(p => {
    if (p.brand.slug === currentBrand) return false;
    if (!p.category.slug.includes(cat)) return false;

    // Elektriska aktuatorer och linjärmoduler — enkelt filter, ingen bore-logik
    if (isElectric) return true;

    if (isCylinder) {
      const bore   = parseFloat(p.specs["bore_mm"]?.value ?? "0");
      const stroke = parseFloat(p.specs["stroke_max"]?.value ?? p.specs["stroke_mm"]?.value ?? "0");

      if (bore <= 0) return false;
      // Bore range: allow ±25 mm of current for general pool
      if (currentBore > 0 && Math.abs(bore - currentBore) > 25) return false;
      // Must deliver enough force
      if (minForce > 0 && boreForce(bore) < minForce) return false;
      // Must have enough stroke
      if (minStroke > 0 && stroke > 0 && stroke < minStroke) return false;
      // IP requirement
      if (needsHighIP) {
        const ip = p.ip_rating ?? "";
        if (ip && !/6[79]/i.test(ip)) return false;
      }
    }
    return true;
  });

  // Deduplicate by sku across tiers
  const used = new Set<string>();
  const pick = (sorted: ProductRow[], n = 2) =>
    sorted.filter(p => !used.has(p.sku)).slice(0, n).map(p => { used.add(p.sku); return p; });

  const byPrice     = [...candidates].sort((a, b) => {
    if (a.purchase_price == null && b.purchase_price != null) return 1;
    if (a.purchase_price != null && b.purchase_price == null) return -1;
    return (a.purchase_price ?? 0) - (b.purchase_price ?? 0);
  });
  const byForce     = [...candidates].sort((a, b) => {
    const bA = parseFloat(a.specs["bore_mm"]?.value ?? "0");
    const bB = parseFloat(b.specs["bore_mm"]?.value ?? "0");
    return isCylinder ? bB - bA : (b.purchase_price ?? 0) - (a.purchase_price ?? 0);
  });
  const byCompact   = [...candidates]
    .filter(p => {
      const bore = parseFloat(p.specs["bore_mm"]?.value ?? "0");
      return !isCylinder || (bore > 0 && bore <= (currentBore || 999));
    })
    .sort((a, b) => {
      const bA = parseFloat(a.specs["bore_mm"]?.value ?? "0");
      const bB = parseFloat(b.specs["bore_mm"]?.value ?? "0");
      return bA - bB;
    });

  const economic = pick(byPrice);
  const best     = pick(byForce);
  const compact  = pick(byCompact);

  return { economic, best, compact };
}

// ── Result Step ─────────────────────────────────────────────────────────────
function ResultStep({ t, locale, title, explanation, selected, requirements, bom, catalog, description, answers,
  rfqName, rfqEmail, rfqCompany, rfqPhone, rfqPoNumber, rfqOrgNumber, rfqSent, rfqId, autoSaved,
  setRfqName, setRfqEmail, setRfqCompany, setRfqPhone, setRfqPoNumber, setRfqOrgNumber, setRfqSent, setRfqId, onRestart, onBack }: {
  t: (key: import("@/lib/i18n").TKey) => string; locale: string; title: string; explanation: string;
  selected: ActuatorOption; requirements: Requirements | null; bom: BomLine[]; catalog: ProductRow[]; description: string; answers: Record<string, string>;
  rfqName: string; rfqEmail: string; rfqCompany: string; rfqPhone: string; rfqPoNumber: string; rfqOrgNumber: string;
  rfqSent: boolean; rfqId: string; autoSaved: boolean;
  setRfqName: (v: string) => void; setRfqEmail: (v: string) => void;
  setRfqCompany: (v: string) => void; setRfqPhone: (v: string) => void; setRfqPoNumber: (v: string) => void;
  setRfqOrgNumber: (v: string) => void;
  setRfqSent: (v: boolean) => void; setRfqId: (v: string) => void;
  onRestart: () => void; onBack: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [rfqLoading, setRfqLoading] = useState(false);
  const [rfqError, setRfqError] = useState("");
  // Save project
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectSaved, setProjectSaved] = useState(false);
  const [configFamilies, setConfigFamilies] = useState<Set<string>>(new Set());
  useEffect(() => {
    supabase.from("configurator_families").select("slug")
      .then(({ data }) => setConfigFamilies(new Set((data ?? []).map((r: { slug: string }) => r.slug))));
  }, []);
  const { user } = useAuth();
  // Economic BOM
  const [ecoMode, setEcoMode] = useState(false);
  const [chosenAlt, setChosenAlt] = useState<Record<number, ProductRow | null>>({});
  useEffect(() => setMounted(true), []);

  // Per-line tiered alternatives — respects customer's stated requirements
  const alternatives = useMemo(() =>
    bom.map(line => findAlternativesTiered(line, catalog, answers)),
    [bom, catalog, answers]
  );

  // Active BOM: merge chosen alts
  const activeBom: BomLine[] = useMemo(() =>
    bom.map((line, i) => {
      const alt = chosenAlt[i];
      if (!alt) return line;
      return { ...line, sku: alt.sku, product: alt };
    }),
    [bom, chosenAlt]
  );

  async function saveProject() {
    if (!user || !projectName.trim()) return;
    setProjectSaving(true);
    const bomSnapshot = activeBom.map(l => ({
      sku: l.sku, role: l.role, qty: l.quantity,
      name: l.product?.name ?? l.sku,
    }));
    await supabase.from("projects").insert({
      user_id: user.id,
      name: projectName.trim(),
      description: projectDesc.trim() || null,
      locale,
      answers,
      bom_lines: bomSnapshot,
    });
    setProjectSaving(false);
    setProjectSaved(true);
    setShowSaveModal(false);
    setProjectName("");
    setProjectDesc("");
  }

  async function submitRfq() {
    if (!rfqName.trim() || !rfqEmail.trim()) return;
    setRfqLoading(true);
    setRfqError("");
    try {
      // Build message summary from active BOM (may include economic alternatives)
      const bomSummary = activeBom
        .slice(0, 8)
        .map(l => `${l.sku} × ${l.quantity} (${l.role})`)
        .join(", ");
      const message = `${description}\n\nStycklista: ${bomSummary}`;

      // Insert RFQ — user_id är null för anonyma användare (nullable efter migration)
      const authUser = (await supabase.auth.getUser()).data.user;
      const { data: rfqRow, error: rfqErr } = await supabase
        .from("rfqs")
        .insert({
          user_id: authUser?.id ?? null,
          title: title || `Maskinbyggare — ${selected.name}`,
          contact_name: rfqName.trim(),
          contact_email: rfqEmail.trim(),
          contact_phone: rfqPhone.trim() || null,
          company: rfqCompany.trim() || null,
          po_number: rfqPoNumber.trim() || null,
          org_number: rfqOrgNumber.trim() || null,
          message,
          status: "new",
        })
        .select("id")
        .single();

      if (rfqErr || !rfqRow) throw rfqErr ?? new Error("No row returned");

      // Insert BOM items (use activeBom which may include economic alternatives)
      const itemRows = activeBom
        .map(l => {
          const product = l.product ?? catalog.find(p => p.sku === l.sku);
          return product
            ? { rfq_id: rfqRow.id, product_id: product.id, qty: l.quantity, role: l.role }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (itemRows.length > 0) {
        await supabase.from("rfq_items").insert(itemRows);
      }

      const orderRef = rfqRow.id.slice(0, 8).toUpperCase();
      setRfqId(orderRef);
      setRfqSent(true);

      // Build item list for emails + order record
      const notifyItems = activeBom.map((l) => {
        const product = l.product ?? catalog.find(p => p.sku === l.sku);
        return {
          sku: l.sku,
          name: product?.name ?? l.role,
          qty: l.quantity,
          role: l.role,
        };
      });
      const totalExVat = activeBom.reduce((sum, l) => {
        const price = (l.product ?? catalog.find(p => p.sku === l.sku))?.purchase_price ?? 0;
        return sum + price * l.quantity;
      }, 0);

      // Auto-create order record (även för anonyma — user_id är nullable)
      if (authUser?.id || rfqName.trim()) {
        supabase.from("orders").insert({
          user_id: authUser?.id ?? null,
          rfq_id: rfqRow.id,
          customer_name: rfqName.trim(),
          customer_company: rfqCompany.trim() || null,
          customer_email: rfqEmail.trim(),
          po_number: rfqPoNumber.trim() || null,
          status: "new",
          items: notifyItems,
          total_ex_vat: totalExVat > 0 ? totalExVat : null,
          total_inc_vat: totalExVat > 0 ? totalExVat * 1.25 : null,
          currency: "SEK",
        }).then(({ error: oErr }) => { if (oErr) console.error("order insert:", oErr); });
      }

      // Fire-and-forget: admin notification + customer confirmation email.
      // rfq-notify re-reads the rest from the rfq_id row it's given — see that
      // function's own header comment for why it doesn't trust a client payload.
      fetch("https://buqfbcztspswezwyafxo.supabase.co/functions/v1/rfq-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfq_id: rfqRow.id }),
      }).catch(console.error);
    } catch (e) {
      console.error(e);
      setRfqError(locale === "sv"
        ? "Kunde inte skicka förfrågan. Försök igen."
        : "Could not submit request. Please try again.");
    } finally {
      setRfqLoading(false);
    }
  }

  const compareSkus = activeBom
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

      {/* Calculated dimensioning — required vs available, for the chosen actuator */}
      {requirements && (requirements.required_force_n != null || requirements.required_stroke_mm != null) && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-3">
            {locale === "sv" ? "Dimensionering — " : "Dimensioning — "}{selected.name}
          </div>
          <DimensioningPanel locale={locale} requirements={requirements} option={selected} bordered={false} />
        </div>
      )}

      {/* System overview — schematic + component cards */}
      <BomSystemView bom={bom} selected={selected} locale={locale} />

      {/* BOM Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-start sm:items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm font-semibold">{t("machineBuilder.bomTitle")}</div>
            {/* Alternatives toggle */}
            {alternatives.some(a => a.economic.length + a.best.length + a.compact.length > 0) && (
              <button
                onClick={() => { setEcoMode(v => !v); if (!ecoMode) setChosenAlt({}); }}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition ${
                  ecoMode
                    ? "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)] border-[oklch(0.7_0.1_155)]"
                    : "border-[oklch(0.7_0.1_155)] text-[oklch(0.45_0.15_155)] hover:bg-[oklch(0.92_0.06_155)/50]"
                }`}
              >
                <span>🔄</span>
                {ecoMode ? t("machineBuilder.altProductsClose") : t("machineBuilder.altProductsBtn")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {compareSkus && (
              <a
                href={`/${locale}/compare?skus=${encodeURIComponent(compareSkus)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-info transition"
              >
                ⇔ {t("machineBuilder.compareBom")}
              </a>
            )}
            <button
              onClick={() => exportBomCsv(activeBom, title)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-info transition"
            >
              ↓ CSV
            </button>
            <button
              onClick={() => exportBomPdf(activeBom, title, explanation, selected)}
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
                <th className="w-12 px-2 py-2.5" aria-label="Bild" />
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("machineBuilder.nameCol")}</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("machineBuilder.qtyCol")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("machineBuilder.roleCol")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">{t("machineBuilder.reasonCol")}</th>
              </tr>
            </thead>
            <tbody>
              {activeBom.map((line, i) => {
                const originalLine = bom[i];
                const isSwapped = !!chosenAlt[i];

                return (
                  <>
                    <tr key={i} className={`border-b border-border last:border-0 transition ${
                      isSwapped ? "bg-[oklch(0.95_0.04_155)/30]" : i % 2 === 0 ? "" : "bg-muted/10"
                    }`}>
                      <td className="px-2 py-2 w-12">
                        {line.product?.image_url ? (
                          <img
                            src={line.product.image_url}
                            alt={line.product.name}
                            className="size-10 object-contain rounded border border-border bg-white p-0.5"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-10 rounded border border-border bg-muted flex items-center justify-center text-muted-foreground text-lg">
                            📦
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {line.product ? (
                          <Link
                            to="/$locale/product/$sku"
                            params={{ locale, sku: line.sku } as never}
                            className="font-mono text-xs text-info hover:underline"
                          >{line.sku}</Link>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{line.sku === "SPECIFY" ? "—" : line.sku}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          {line.product?.name ?? <span className="text-muted-foreground italic">{line.sku === "SPECIFY" ? t("machineBuilder.specifyVariant") : t("machineBuilder.notInCatalog")}</span>}
                          {(() => {
                            const fam = line.product?.family?.toLowerCase().trim();
                            return fam && configFamilies.has(fam) ? (
                              <Link
                                to="/$locale/configurator/$family"
                                params={{ locale, family: fam } as never}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-foreground text-background font-semibold hover:opacity-90 inline-flex items-center gap-1"
                              >⚙️ {t("common.configure")}</Link>
                            ) : null;
                          })()}
                          {isSwapped && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[oklch(0.88_0.08_155)] text-[oklch(0.35_0.12_155)] font-semibold">
                              {t("machineBuilder.altSwappedBadge")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center size-6 rounded bg-muted text-xs font-semibold">{line.quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{line.role}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{line.reason}</td>
                    </tr>

                    {/* Tiered alternatives row */}
                    {ecoMode && (() => {
                      const tiers = alternatives[i];
                      const hasAny = tiers.economic.length + tiers.best.length + tiers.compact.length > 0;
                      if (!hasAny) return null;

                      const AltChip = ({ alt, tier }: { alt: ProductRow; tier: string }) => {
                        const isChosen = chosenAlt[i]?.sku === alt.sku;
                        const bore     = alt.specs["bore_mm"]?.value;
                        const stroke   = alt.specs["stroke_max"]?.value ?? alt.specs["stroke_mm"]?.value;
                        return (
                          <button
                            onClick={() => setChosenAlt(prev => ({ ...prev, [i]: isChosen ? null : alt }))}
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                              isChosen
                                ? "border-info bg-info/10 text-info font-semibold"
                                : "border-border bg-card text-foreground hover:border-info/60"
                            }`}
                          >
                            <span className="text-muted-foreground text-[10px]">{alt.brand.name}</span>
                            <span className="font-medium truncate max-w-[140px]">{alt.name.split(" ").slice(0,4).join(" ")}</span>
                            {bore && <span className="font-mono text-[10px] text-muted-foreground">⌀{bore}</span>}
                            {stroke && <span className="font-mono text-[10px] text-muted-foreground">{stroke}mm</span>}
                            {isChosen && <span className="text-info">✓</span>}
                          </button>
                        );
                      };

                      const TIERS: { key: keyof AltTiers; icon: string; label: string; hint: string }[] = [
                        { key: "economic", icon: "🔄", label: t("machineBuilder.altTierEconomic"), hint: t("machineBuilder.altHintEconomic") },
                        { key: "best",     icon: "🏆", label: t("machineBuilder.altTierBest"),     hint: t("machineBuilder.altHintBest") },
                        { key: "compact",  icon: "📐", label: t("machineBuilder.altTierCompact"),  hint: t("machineBuilder.altHintCompact") },
                      ];

                      return (
                        <tr key={`eco-${i}`} className="border-b border-border/60 bg-surface-alt/50">
                          <td colSpan={5} className="px-4 py-2.5">
                            <div className="space-y-1.5">
                              <p className="text-[11px] text-muted-foreground mb-1">{t("machineBuilder.altProductsHint")}</p>
                              {TIERS.map(({ key, icon, label, hint }) => {
                                const items = tiers[key];
                                if (!items.length) return null;
                                return (
                                  <div key={key} className="flex items-center gap-2 flex-wrap min-h-[28px]">
                                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0 flex items-center gap-1" title={hint}>
                                      <span>{icon}</span> {label}
                                    </span>
                                    {items.map(alt => <AltChip key={alt.sku} alt={alt} tier={key} />)}
                                  </div>
                                );
                              })}
                              {isSwapped && (
                                <div className="pt-0.5">
                                  <button
                                    onClick={() => setChosenAlt(prev => ({ ...prev, [i]: null }))}
                                    className="text-[11px] text-muted-foreground hover:text-foreground transition"
                                  >
                                    {t("machineBuilder.altResetSwap")}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </>
                );
              })}
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
          <div className="rounded-lg bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)] px-4 py-4 space-y-1">
            <div className="font-semibold text-sm">✓ {t("machineBuilder.quoteThankYou")}</div>
            {rfqId && (
              <div className="text-xs opacity-80">
                Referens: <span className="font-mono font-semibold">{rfqId}</span> — vi återkommer inom 1–2 arbetsdagar.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={rfqName}
                onChange={e => setRfqName(e.target.value)}
                placeholder={t("machineBuilder.yourNamePlaceholder")}
                className="px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
              />
              <input
                value={rfqEmail}
                onChange={e => setRfqEmail(e.target.value)}
                placeholder={t("machineBuilder.emailPlaceholder")}
                type="email"
                className="px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
              />
              <input
                value={rfqCompany}
                onChange={e => setRfqCompany(e.target.value)}
                placeholder="Företag (valfritt)"
                className="px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
              />
              <input
                value={rfqPhone}
                onChange={e => setRfqPhone(e.target.value)}
                placeholder="Telefon (valfritt)"
                type="tel"
                className="px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
              />
              <input
                value={rfqPoNumber}
                onChange={e => setRfqPoNumber(e.target.value)}
                placeholder={t("ordersPage.poNumber") + " (valfritt — t.ex. från SAP/Ariba)"}
                className="px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50 font-mono"
              />
              <input
                value={rfqOrgNumber}
                onChange={e => setRfqOrgNumber(e.target.value)}
                placeholder="Organisationsnummer (valfritt — t.ex. 556000-0000)"
                className="px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50 font-mono"
              />
            </div>
            {rfqError && <p className="text-xs text-destructive">{rfqError}</p>}
            <button
              onClick={submitRfq}
              disabled={!rfqName.trim() || !rfqEmail.trim() || rfqLoading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition"
            >
              {rfqLoading ? t("shoppingList.sending") : t("machineBuilder.sendButton")}
            </button>
          </div>
        )}
      </div>

      {/* Save project */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        {user ? (
          (projectSaved || autoSaved) ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              ✓ {autoSaved && !projectSaved ? t("projects.autoSaved" as never) : t("projects.saved")}
              <Link to="/$locale/projects" params={{ locale } as never} className="underline text-info">
                → {t("projects.title")}
              </Link>
              {autoSaved && !projectSaved && (
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {t("projects.rename" as never)}
                </button>
              )}
            </span>
          ) : (
            <button
              onClick={() => setShowSaveModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary hover:text-primary-foreground transition"
            >
              💾 {t("projects.saveBtn")}
            </button>
          )
        ) : (
          <Link to="/$locale/login" params={{ locale } as never}
            className="text-xs text-muted-foreground hover:text-info">
            🔒 {t("projects.notLoggedIn")}
          </Link>
        )}
      </div>

      {/* Save project modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSaveModal(false)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">{t("projects.modalTitle")}</h2>
              <button onClick={() => setShowSaveModal(false)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Namn *</label>
                <input
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder={t("projects.namePlaceholder")}
                  autoFocus
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Anteckning</label>
                <textarea
                  value={projectDesc}
                  onChange={e => setProjectDesc(e.target.value)}
                  placeholder={t("projects.descPlaceholder")}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition">
                Avbryt
              </button>
              <button onClick={saveProject} disabled={!projectName.trim() || projectSaving}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-40">
                {projectSaving ? t("projects.saving") : t("projects.confirmSave")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition">
            ← {t("machineBuilder.back")}
          </button>
          <button onClick={onRestart} className="text-sm text-muted-foreground hover:text-foreground transition">
            {t("machineBuilder.startOver")}
          </button>
        </div>
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

// ── BOM System View ─────────────────────────────────────────────────────────
// Classifies a BOM line's role into a visual system node type
type NodeType = "supply" | "frl" | "valve" | "actuator" | "sensor" | "fitting" | "drive" | "psu" | "cable" | "mount" | "gripper" | "vacuum" | "other";

function classifyRole(role: string, sku: string): NodeType {
  const r = role.toLowerCase();
  const s = sku.toLowerCase();
  if (/lufttill|supply|compressor|source|luft/.test(r)) return "supply";
  if (/frl|filter|regulator|lubric|luftbered/.test(r)) return "frl";
  if (/ventil|valve|direktional|styrventi|solenoid|5\/2|3\/2/.test(r)) return "valve";
  // Drive check BEFORE actuator — "servo motor driver", "drivmodul" etc. contain
  // "motor" which would otherwise hit the actuator branch first.
  if (/servo.*motor|motor.*driv|motor.*kontroll|drivmodul|driv.*enhet|servo.*förstärk|servoförstärk|servo.*driv|drive.*module|drive.*controller|drive.*amplif|frekvensomriktare/.test(r)) return "drive";
  // Cable check BEFORE sensor — "sensorkabel" / "sensor cable" contain the word "sensor"
  if (/kabel|cable|kopplingskabel|ledning/.test(r) || /nebu|^e2-m/.test(s)) return "cable";
  if (/cylinder|aktuator|actuator|linjär|axel|shaft|motor|dnc|dng|dsm/.test(r) || /dnc|dng|dsbc|advu|ley|lef/.test(s)) return "actuator";
  if (/sensor|givare|switch|reed|närhets|proximity|position/.test(r)) return "sensor";
  if (/koppling|fitting|anslut|push-in|snabbanslut/.test(r)) return "fitting";
  if (/slang|slange|tub|tube|hose/.test(r)) return "fitting";
  if (/servo|drive|styrning|kontroller|frekvens/.test(r)) return "drive";
  if (/nät|power|supply|psu|24v|230v|matning/.test(r)) return "psu";
  if (/fäst|mount|bracket|konsol|adapter/.test(r)) return "mount";
  if (/grip|klämm|finger|jaw/.test(r) || /hgp|mhz|mhc|dhvz/.test(s)) return "gripper";
  if (/vakuum|vacuum|sug|ejek|suction/.test(r) || /vn|zse|svs/.test(s)) return "vacuum";
  return "other";
}

const NODE_META: Record<NodeType, { label: string; color: string; fill: string; icon: string }> = {
  supply:   { label: "Lufttillförsel",  color: "#64748b", fill: "#f1f5f9", icon: "◎" },
  frl:      { label: "FRL-enhet",       color: "#0ea5e9", fill: "#e0f2fe", icon: "⧖" },
  valve:    { label: "Styrventil",      color: "#6366f1", fill: "#eef2ff", icon: "⇌" },
  actuator: { label: "Aktuator",        color: "#0284c7", fill: "#dbeafe", icon: "⇒" },
  sensor:   { label: "Sensor",          color: "#16a34a", fill: "#dcfce7", icon: "◈" },
  fitting:  { label: "Anslutning/Slang",color: "#94a3b8", fill: "#f8fafc", icon: "⊕" },
  drive:    { label: "Servostyrning",   color: "#7c3aed", fill: "#f5f3ff", icon: "⚡" },
  psu:      { label: "Nätaggregat",     color: "#d97706", fill: "#fef9c3", icon: "⚡" },
  cable:    { label: "Kabel",           color: "#94a3b8", fill: "#f8fafc", icon: "∿" },
  mount:    { label: "Fäste/Montering", color: "#78716c", fill: "#fafaf9", icon: "⬡" },
  gripper:  { label: "Gripper",         color: "#0891b2", fill: "#e0f9ff", icon: "✋" },
  vacuum:   { label: "Vakuumsystem",    color: "#7e22ce", fill: "#faf5ff", icon: "○" },
  other:    { label: "Tillbehör",       color: "#94a3b8", fill: "#f8fafc", icon: "·" },
};

function BomSystemView({ bom, selected, locale }: { bom: BomLine[]; selected: ActuatorOption; locale: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useState<"diagram" | "3d" | "cards">("diagram");

  const isElectric = /DNCE|LEY|LEF|EGC|ELGA|EGSK|EGSP|LESH|LEFS|LECP|HMR|OSPE|LBB|HLR|PARKER-ETH|PARKER-HMR|PARKER-LBB|PARKER-HLR|PARKER-OSPE/i.test(selected.sku);
  const classified = bom.map((line, i) => ({
    ...line,
    nodeType: classifyRole(line.role, line.sku),
    idx: i,
  }));

  // Build pipeline: main flow nodes in order
  const pipelineOrder: NodeType[] = isElectric
    ? ["psu", "drive", "actuator", "sensor"]
    : ["supply", "frl", "valve", "actuator", "gripper", "vacuum", "sensor"];

  // Group bom lines by node type for the diagram
  const byType: Partial<Record<NodeType, typeof classified>> = {};
  classified.forEach(c => {
    if (!byType[c.nodeType]) byType[c.nodeType] = [];
    byType[c.nodeType]!.push(c);
  });

  // Side items: fittings, cables, mounts, other
  const sideTypes: NodeType[] = ["fitting", "cable", "mount", "other"];

  const pipelineItems = pipelineOrder
    .filter(t => byType[t]?.length)
    .map(t => ({ type: t, lines: byType[t]! }));

  const sideItems = sideTypes
    .filter(t => byType[t]?.length)
    .flatMap(t => byType[t]!);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header with tab toggle */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-medium flex items-center gap-2">
          <span className="text-info">◈</span>
          Systemöversikt — {bom.length} komponenter
        </div>
        <div className="flex gap-1 bg-surface-alt rounded-md p-0.5">
          {(["diagram", "3d", "cards"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-xs px-3 py-1 rounded transition ${view === v ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {v === "diagram" ? "⎔ Systemschema" : v === "3d" ? "◉ 3D Maskin" : "⊞ Komponentkort"}
            </button>
          ))}
        </div>
      </div>

      {view === "diagram" && (
        <div className="p-4 md:p-6 overflow-x-auto">
          <SystemDiagram
            pipelineItems={pipelineItems}
            sideItems={sideItems}
            active={active}
            setActive={setActive}
            isElectric={isElectric}
          />
        </div>
      )}

      {view === "3d" && (
        <div className="relative">
          <Suspense fallback={
            <div className="flex items-center justify-center" style={{ height: 340 }}>
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="size-2 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            </div>
          }>
            <Machine3DScene
              bore={selected.bore_mm ?? 50}
              stroke={selected.stroke_mm ?? 200}
              isElectric={isElectric}
              hasVacuum={classified.some(c => c.nodeType === "vacuum")}
              hasGripper={classified.some(c => c.nodeType === "gripper")}
              isMultiAxis={bom.some(l => /axel 2|axis 2|X-axel/i.test(l.role))}
              hasSensors={classified.some(c => c.nodeType === "sensor")}
            />
          </Suspense>
          <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground bg-card/80 backdrop-blur px-2 py-1 rounded-md border border-border">
            Dra för att rotera · Scroll för att zooma
          </div>
        </div>
      )}

      {view === "cards" && (
        <div className="p-4">
          <ComponentCards classified={classified} active={active} setActive={setActive} />
        </div>
      )}

      {/* Active component detail strip */}
      {active !== null && bom[active] && (
        <div className="border-t border-border bg-info/5 px-4 py-3 flex items-start gap-3">
          <span className={`size-6 rounded-full flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0`}
            style={{ background: NODE_META[classified[active]?.nodeType ?? "other"].color }}>
            {active + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{bom[active].product?.name ?? bom[active].sku}</div>
            <div className="text-xs text-muted-foreground font-mono">{bom[active].sku} · {bom[active].role}</div>
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{bom[active].reason}</div>
          </div>
          <div className="text-xs text-muted-foreground shrink-0">Antal: <span className="font-semibold text-foreground">{bom[active].quantity}</span></div>
          <button onClick={() => setActive(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0">×</button>
        </div>
      )}
    </div>
  );
}

// ── Pipeline SVG Diagram ────────────────────────────────────────────────────
function SystemDiagram({ pipelineItems, sideItems, active, setActive, isElectric }: {
  pipelineItems: { type: NodeType; lines: { idx: number; sku: string; role: string; quantity: number; product?: ProductRow | null; nodeType: NodeType }[] }[];
  sideItems: { idx: number; sku: string; role: string; quantity: number; product?: ProductRow | null; nodeType: NodeType }[];
  active: number | null;
  setActive: (i: number | null) => void;
  isElectric: boolean;
}) {
  const BOX_W = 140, BOX_H = 76, GAP = 60;
  const SIDE_W = 120, SIDE_H = 52;
  const pLen = pipelineItems.length;
  const totalW = Math.max(600, pLen * (BOX_W + GAP) - GAP + 80);
  const mainY = 80;
  const sideRowY = mainY + BOX_H + 80;
  const totalH = sideItems.length > 0 ? sideRowY + SIDE_H + 40 : mainY + BOX_H + 60;
  const arrowColor = isElectric ? "#7c3aed" : "#0ea5e9";

  const pipelinePositions = pipelineItems.map((_, i) => ({
    x: 40 + i * (BOX_W + GAP),
    y: mainY,
  }));

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      style={{ width: "100%", minWidth: `${Math.min(totalW, 560)}px`, height: "auto" }}
      aria-label="Systemschema"
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={arrowColor} />
        </marker>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.10" />
        </filter>
      </defs>

      {/* Flow label */}
      <text x="40" y="28" fontSize="10" fill="#94a3b8" fontFamily="system-ui, sans-serif" letterSpacing="0.12em">
        {isElectric ? "ELFLÖDE →" : "LUFTFLÖDE →"}
      </text>

      {/* Connecting arrows between pipeline nodes */}
      {pipelinePositions.slice(0, -1).map((pos, i) => {
        const x1 = pos.x + BOX_W;
        const x2 = pipelinePositions[i + 1].x;
        const cy = mainY + BOX_H / 2;
        return (
          <g key={i}>
            <line
              x1={x1 + 2} y1={cy} x2={x2 - 8} y2={cy}
              stroke={arrowColor} strokeWidth="2"
              markerEnd="url(#arrowhead)"
              strokeDasharray={isElectric ? "6 3" : "0"}
            />
          </g>
        );
      })}

      {/* Pipeline nodes */}
      {pipelineItems.map((item, i) => {
        const pos = pipelinePositions[i];
        const meta = NODE_META[item.type];
        const firstLine = item.lines[0];
        const isActive = active === firstLine.idx;
        const hasMultiple = item.lines.length > 1;

        return (
          <g key={item.type} style={{ cursor: "pointer" }}
            onClick={() => setActive(isActive ? null : firstLine.idx)}>
            {/* Box */}
            <rect
              x={pos.x} y={pos.y} width={BOX_W} height={BOX_H} rx="8"
              fill={isActive ? meta.color : meta.fill}
              stroke={isActive ? meta.color : "#e2e8f0"}
              strokeWidth={isActive ? 2 : 1.5}
              filter="url(#shadow)"
            />
            {/* Number badge */}
            <circle cx={pos.x + 14} cy={pos.y + 14} r={11} fill={meta.color} />
            <text x={pos.x + 14} y={pos.y + 18} textAnchor="middle" fontSize="10"
              fill="white" fontWeight="700" fontFamily="system-ui, sans-serif">
              {firstLine.idx + 1}
            </text>
            {/* Icon */}
            <text x={pos.x + BOX_W - 16} y={pos.y + 20} textAnchor="middle" fontSize="16"
              fill={isActive ? "white" : meta.color} fontFamily="system-ui, sans-serif">
              {meta.icon}
            </text>
            {/* Type label */}
            <text x={pos.x + BOX_W / 2} y={pos.y + 34} textAnchor="middle" fontSize="10"
              fill={isActive ? "white" : "#64748b"} fontFamily="system-ui, sans-serif" letterSpacing="0.06em">
              {meta.label.toUpperCase()}
            </text>
            {/* Product name — truncate */}
            <foreignObject x={pos.x + 6} y={pos.y + 42} width={BOX_W - 12} height={26}>
              <div style={{
                fontSize: "11px",
                color: isActive ? "white" : "#1e293b",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                lineHeight: 1.3,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              } as React.CSSProperties}>
                {firstLine.product?.name ?? firstLine.sku}
              </div>
            </foreignObject>
            {/* Multiple items badge */}
            {hasMultiple && (
              <g>
                <circle cx={pos.x + BOX_W - 10} cy={pos.y + BOX_H - 10} r={9} fill="#f59e0b" />
                <text x={pos.x + BOX_W - 10} y={pos.y + BOX_H - 6} textAnchor="middle" fontSize="9"
                  fill="white" fontWeight="700" fontFamily="system-ui, sans-serif">
                  +{item.lines.length - 1}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Dotted lines from pipeline to side items */}
      {sideItems.length > 0 && (
        <>
          {/* Horizontal shelf line */}
          <line
            x1={40} y1={sideRowY - 20} x2={totalW - 40} y2={sideRowY - 20}
            stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4"
          />
          <text x={40} y={sideRowY - 28} fontSize="9" fill="#94a3b8" fontFamily="system-ui, sans-serif"
            letterSpacing="0.12em">
            TILLBEHÖR &amp; ANSLUTNINGAR
          </text>
        </>
      )}

      {/* Side item boxes */}
      {sideItems.map((item, i) => {
        const x = 40 + i * (SIDE_W + 16);
        const meta = NODE_META[item.nodeType];
        const isActive = active === item.idx;
        return (
          <g key={item.idx} style={{ cursor: "pointer" }}
            onClick={() => setActive(isActive ? null : item.idx)}>
            <rect
              x={x} y={sideRowY} width={SIDE_W} height={SIDE_H} rx="6"
              fill={isActive ? meta.color : meta.fill}
              stroke={isActive ? meta.color : "#e2e8f0"}
              strokeWidth={isActive ? 2 : 1}
              filter="url(#shadow)"
            />
            <circle cx={x + 11} cy={sideRowY + 11} r={9} fill={meta.color} />
            <text x={x + 11} y={sideRowY + 15} textAnchor="middle" fontSize="9"
              fill="white" fontWeight="700" fontFamily="system-ui, sans-serif">
              {item.idx + 1}
            </text>
            <text x={x + SIDE_W / 2} y={sideRowY + 22} textAnchor="middle" fontSize="9"
              fill={isActive ? "white" : "#64748b"} fontFamily="system-ui, sans-serif" letterSpacing="0.05em">
              {meta.label.toUpperCase()}
            </text>
            <foreignObject x={x + 4} y={sideRowY + 28} width={SIDE_W - 8} height={20}>
              <div style={{
                fontSize: "10px", color: isActive ? "white" : "#1e293b",
                fontFamily: "system-ui, sans-serif", fontWeight: 600,
                overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
              }}>
                {item.product?.name ?? item.sku}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

// ── Component Cards ─────────────────────────────────────────────────────────
function ComponentCards({ classified, active, setActive }: {
  classified: { idx: number; sku: string; role: string; quantity: number; reason: string; product?: ProductRow | null; nodeType: NodeType }[];
  active: number | null;
  setActive: (i: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {classified.map((item) => {
        const meta = NODE_META[item.nodeType];
        const isActive = active === item.idx;
        return (
          <button
            key={item.idx}
            onClick={() => setActive(isActive ? null : item.idx)}
            className={`text-left rounded-xl border-2 p-3 transition ${
              isActive ? "border-info bg-info/5" : "border-border hover:border-info/50 bg-card"
            }`}
          >
            {/* Number + type row */}
            <div className="flex items-center gap-2 mb-2">
              <span className="size-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: meta.color }}>
                {item.idx + 1}
              </span>
              <span className="text-[10px] uppercase tracking-wide font-medium truncate"
                style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground shrink-0">×{item.quantity}</span>
            </div>

            {/* Category icon area */}
            <div className="h-14 rounded-lg flex items-center justify-center mb-2 text-3xl"
              style={{ background: meta.fill }}>
              <span>{meta.icon}</span>
            </div>

            {/* Name */}
            <div className="text-xs font-semibold leading-tight line-clamp-2 text-foreground">
              {item.product?.name ?? item.sku}
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">{item.sku}</div>

            {/* Role badge */}
            <div className="mt-1.5 text-[10px] text-muted-foreground line-clamp-1 italic">
              {item.role}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── OLD 3D Machine Visualizer (kept for reference, no longer rendered) ───────
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
      className="hidden sm:block"
      style={{ width: "100%", height: "260px", display: "block" }}
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { runSelection } from "@/lib/selection";
import type { ProductRow, SelectionInput, SelectionResult } from "@/lib/types";
import { BomTable, ValidationList } from "@/components/Bom";
import { aiExtractRequirements, aiExplain } from "@/lib/ai.functions";

export const Route = createFileRoute("/$locale/project")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("project.title")} — ${t("common.appName")}` },
        { name: "description", content: t("project.intro") },
      ],
    };
  },
  component: ProjectPage,
});

interface Msg { role: "user" | "assistant"; text: string }

function ProjectPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const extract = useServerFn(aiExtractRequirements);
  const explain = useServerFn(aiExplain);
  const [catalog, setCatalog] = useState<ProductRow[] | null>(null);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text:
        locale === "sv"
          ? "Hej! Beskriv vad du vill flytta så föreslår jag en Bästa och en Billigaste lösning."
          : "Hi! Describe what you need to move and I'll propose a Best and a Cheapest bundle.",
    },
  ]);
  const [best, setBest] = useState<SelectionResult | null>(null);
  const [cheap, setCheap] = useState<SelectionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(console.error);
  }, []);

  async function send() {
    if (!text.trim() || !catalog) return;
    const q = text;
    setText("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const r = await extract({ data: { text: q, locale } });
      const followups = r.followups ?? [];
      const haveCore = r.stroke_mm && r.force_n;
      if (!haveCore && followups.length) {
        setMsgs((m) => [...m, { role: "assistant", text: followups.join(" ") }]);
      } else {
        const baseInput: SelectionInput = {
          stroke_mm: r.stroke_mm ?? 500,
          force_n: r.force_n ?? 800,
          voltage: r.voltage ?? "230VAC",
          fieldbus: r.fieldbus ?? "PROFINET",
          feedback: r.feedback ?? "incremental",
          ip: r.ip ?? "IP54",
          mode: "best",
        };
        const b = runSelection(catalog, baseInput);
        const c = runSelection(catalog, { ...baseInput, mode: "cheapest" });
        setBest(b);
        setCheap(c);
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            text:
              locale === "sv"
                ? `Genererat BÄSTA och BILLIGASTE paket. Orderkoder ${b.orderCode} / ${c.orderCode}.`
                : `Generated BEST and CHEAPEST bundles. Order codes ${b.orderCode} / ${c.orderCode}.`,
          },
        ]);
        const ctx = `BEST:\n${b.items.map((i) => `${i.role} ${i.product.sku}`).join("\n")}\n\nCHEAPEST:\n${c.items.map((i) => `${i.role} ${i.product.sku}`).join("\n")}`;
        const exp = await explain({ data: { context: ctx, locale } });
        setExplanation(exp.text);
      }
    } catch (e) {
      console.error(e);
      setMsgs((m) => [...m, { role: "assistant", text: t("auth.errorGeneric") }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page py-10 grid lg:grid-cols-12 gap-6">
      <section className="lg:col-span-5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("project.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("project.intro")}</p>
        <div className="mt-6 rounded-lg border border-border bg-card p-4 h-[460px] overflow-y-auto space-y-3 text-sm">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-alt text-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("project.placeholder")}
            className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
          <button
            onClick={send}
            disabled={busy}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            {t("common.send")}
          </button>
        </div>
      </section>

      <section className="lg:col-span-7 space-y-6">
        {explanation && (
          <div className="rounded-md border border-border bg-card p-4 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              {t("project.why")}
            </div>
            {explanation}
          </div>
        )}
        {best && (
          <div>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <span className="size-2 rounded-full bg-gold" />
              {t("project.best")} · <span className="font-mono text-xs">{best.orderCode}</span>
            </h2>
            <ValidationList items={best.validation} />
            <BomTable result={best} />
          </div>
        )}
        {cheap && (
          <div>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <span className="size-2 rounded-full bg-teal" />
              {t("project.cheapest")} · <span className="font-mono text-xs">{cheap.orderCode}</span>
            </h2>
            <ValidationList items={cheap.validation} />
            <BomTable result={cheap} />
          </div>
        )}
        {(best || cheap) && (
          <Link
            to="/$locale/configurator/$schemaId"
            params={{ locale, schemaId: "EA-LINEAR-AXIS" }}
            className="inline-block text-sm rounded-md bg-foreground text-background px-4 py-2"
          >
            {t("project.openConfigurator")} →
          </Link>
        )}
      </section>
    </div>
  );
}

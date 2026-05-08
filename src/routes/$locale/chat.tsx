import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { loadCatalog } from "@/lib/catalog";
import { runSelection } from "@/lib/selection";
import type { ProductRow, SelectionInput, SelectionResult } from "@/lib/types";
import { BomTable, ValidationList } from "@/components/Bom";
import { aiExtractRequirements, aiExplain } from "@/lib/ai.functions";

export const Route = createFileRoute("/$locale/chat")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return { meta: [{ title: `${t("nav.chat")} — ${t("common.appName")}` }] };
  },
  component: ChatPage,
});

interface Msg { role: "user" | "assistant"; text: string }

function ChatPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const extract = useServerFn(aiExtractRequirements);
  const explain = useServerFn(aiExplain);
  const [catalog, setCatalog] = useState<ProductRow[] | null>(null);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hi! Describe what you need to move and I'll propose a Best and a Cheapest bundle." },
  ]);
  const [best, setBest] = useState<SelectionResult | null>(null);
  const [cheap, setCheap] = useState<SelectionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/$locale/login", params: { locale } });
  }, [user, loading, navigate, locale]);
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
      const r = await extract({ data: { text: q } });
      const followups = r.followups ?? [];
      const haveCore = r.stroke_mm && r.force_n;
      if (!haveCore && followups.length) {
        setMsgs((m) => [
          ...m,
          { role: "assistant", text: `I need a bit more: ${followups.join(" ")}` },
        ]);
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
            text: `Generated BEST and CHEAPEST bundles (source: ${r.source}). Order codes ${b.orderCode} / ${c.orderCode}.`,
          },
        ]);
        const ctx = `BEST:\n${b.items.map((i) => `${i.role} ${i.product.sku}`).join("\n")}\n\nCHEAPEST:\n${c.items.map((i) => `${i.role} ${i.product.sku}`).join("\n")}`;
        const exp = await explain({ data: { context: ctx } });
        setExplanation(exp.text);
      }
    } catch (e) {
      console.error(e);
      setMsgs((m) => [...m, { role: "assistant", text: t("auth.errorGeneric") }]);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="container-page py-10 grid lg:grid-cols-12 gap-6">
      <section className="lg:col-span-5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.chat")}</h1>
        <div className="mt-6 rounded-lg border border-border bg-card p-4 h-[480px] overflow-y-auto space-y-3 text-sm">
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
            placeholder="e.g. I need a 500mm electric axis pushing 800N on PROFINET, 230V"
            className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
          <button
            onClick={send}
            disabled={busy}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Send
          </button>
        </div>
      </section>

      <section className="lg:col-span-7 space-y-6">
        {explanation && (
          <div className="rounded-md border border-border bg-card p-4 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              AI explanation
            </div>
            {explanation}
          </div>
        )}
        {best && (
          <div>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <span className="size-2 rounded-full bg-gold" />
              BEST · <span className="font-mono text-xs">{best.orderCode}</span>
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
        <Link
          to="/$locale/configurator"
          params={{ locale }}
          className="inline-block text-sm underline text-muted-foreground"
        >
          Open configurator with these inputs →
        </Link>
      </section>
    </div>
  );
}

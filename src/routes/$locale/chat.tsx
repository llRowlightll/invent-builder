import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { aiSearchProducts, aiExplain, type AiSearchResult } from "@/lib/ai.functions";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";

export const Route = createFileRoute("/$locale/chat")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("nav.chat")} — ${t("common.appName")}` },
        { name: "description", content: "AI-ingenjören hjälper dig hitta rätt industrikomponent. Beskriv din applikation på svenska eller engelska." },
      ],
    };
  },
  component: ChatPage,
});

type MsgRole = "user" | "assistant" | "products";
interface Msg {
  role: MsgRole;
  text?: string;
  products?: ProductRow[];
  aiResult?: AiSearchResult;
}

const EXAMPLE_QUERIES = [
  "Jag behöver en cylinder som lyfter 30 kg med 150mm slag",
  "Kompakt SMC cylinder för trånga utrymmen, 32mm kolvdiameter",
  "Pneumatisk gripper för cylindriska objekt",
  "Vakuumgrepp för glaspaneler i livsmedelsproduktion",
  "Parker cylinder med IP67 för utomhusbruk",
  "Festo ventilö med PROFINET-anslutning",
];

function ChatPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const isSv = locale === "sv";
  const aiSearch = useServerFn(aiSearchProducts);
  const explain = useServerFn(aiExplain);

  const [catalog, setCatalog] = useState<ProductRow[] | null>(null);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text: t("chatPage.greetingSv"),
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send() {
    if (!text.trim() || !catalog || busy) return;
    const q = text.trim();
    setText("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);

    try {
      const result = await aiSearch({ data: { query: q, locale } });

      // Apply filters to find matching products
      let matches = catalog.filter((p) => {
        if (result.category_slug && p.category.slug !== result.category_slug) return false;
        if (result.brand_slug && p.brand.slug !== result.brand_slug) return false;
        for (const f of result.spec_filters ?? []) {
          const specVal = p.specs[f.key]?.value;
          if (specVal == null) continue;
          const num = Number(specVal);
          if (!Number.isFinite(num)) continue;
          if (f.min != null && num < f.min) return false;
          if (f.max != null && num > f.max) return false;
        }
        return true;
      });

      // Keyword fallback if no category/brand match gave results
      if (matches.length === 0 && result.keywords?.length) {
        matches = catalog.filter((p) => {
          const hay = [p.sku, p.name, p.brand.name, p.category.name, p.description ?? ""]
            .join(" ")
            .toLowerCase();
          return result.keywords.some((kw) => hay.includes(kw.toLowerCase()));
        });
      }

      // Sort by lead time (fastest first)
      matches = matches.sort((a, b) => (a.lead_time_days ?? 99) - (b.lead_time_days ?? 99));

      setMsgs((m) => [
        ...m,
        { role: "assistant", text: result.explanation, aiResult: result },
        ...(matches.length > 0
          ? [{ role: "products" as MsgRole, products: matches.slice(0, 6) }]
          : []),
        ...(matches.length === 0
          ? [{
              role: "assistant" as MsgRole,
              text: t("chatPage.noMatchSv"),
            }]
          : []),
        ...(result.followup
          ? [{ role: "assistant" as MsgRole, text: result.followup }]
          : []),
      ]);

      // Get AI explanation if matches found
      if (matches.length > 0 && result.source === "ai") {
        const ctx = `Hittade ${matches.length} produkter. Topp 3:\n${matches
          .slice(0, 3)
          .map((p) => `- ${p.name} (${p.sku}) ${p.brand.name}, ${p.category.name}`)
          .join("\n")}`;
        explain({ data: { context: ctx, question: isSv ? "Förklara i 1-2 meningar varför dessa produkter passar för användarens behov." : "Explain in 1-2 sentences why these products fit the user's needs.", locale } }).then((exp) => {
          if (exp.source === "ai") {
            setMsgs((m) => [...m, { role: "assistant", text: exp.text }]);
          }
        });
      }
    } catch (e) {
      console.error(e);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: t("chatPage.errorSv"),
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function toggleCompare(sku: string) {
    setCompare((c) => (c.includes(sku) ? c.filter((s) => s !== sku) : c.length >= 4 ? c : [...c, sku]));
  }

  return (
    <div className="container-page py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="text-info">✦</span>
            {t("nav.chat")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("chatPage.leadSv")}
          </p>
        </div>
        {compare.length > 0 && (
          <Link
            to="/$locale/compare"
            params={{ locale }}
            search={{ skus: compare.join(",") }}
            className="text-sm px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90"
          >
            {t("chatPage.compareCount")} {compare.length} →
          </Link>
        )}
      </div>

      {/* Chat window */}
      <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ minHeight: "60vh" }}>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)", minHeight: 320 }}>
          {msgs.map((m, i) => {
            if (m.role === "products" && m.products) {
              return (
                <div key={i} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {m.products.map((p) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      locale={locale}
                      inCompare={compare.includes(p.sku)}
                      onCompare={() => toggleCompare(p.sku)}
                    />
                  ))}
                </div>
              );
            }
            return (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <span className="size-6 rounded-full bg-info/15 text-info text-xs flex items-center justify-center mr-2 mt-0.5 shrink-0">
                    ✦
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-alt text-foreground border border-border"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex items-center gap-2">
              <span className="size-6 rounded-full bg-info/15 text-info text-xs flex items-center justify-center shrink-0">✦</span>
              <div className="bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
                <span className="size-3 rounded-full border-2 border-info/40 border-t-info animate-spin" />
                {t("chatPage.analyzingSv")}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Examples (only at start) */}
        {msgs.length === 1 && (
          <div className="px-4 pb-3 border-t border-border pt-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
              {t("chatPage.tryExample")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => { setText(q); inputRef.current?.focus(); }}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-info hover:text-info transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-border p-3 flex gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={t("chatPage.inputPlaceholder")}
            className="flex-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
          />
          <button
            onClick={send}
            disabled={busy || !text.trim()}
            className="px-4 py-2.5 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition flex items-center gap-1.5"
          >
            {busy ? (
              <span className="size-3 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
            ) : (
              <span>↑</span>
            )}
            {t("chatPage.sendButton")}
          </button>
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-6 grid sm:grid-cols-3 gap-3 text-sm">
        <Link
          to="/$locale/products"
          params={{ locale }}
          className="rounded-lg border border-border bg-card p-4 hover:border-info transition flex items-center gap-3"
        >
          <span className="text-info text-lg">⊞</span>
          <div>
            <div className="font-medium">{t("nav.products")}</div>
            <div className="text-xs text-muted-foreground">{t("chatPage.browseCatalog")}</div>
          </div>
        </Link>
        <Link
          to="/$locale/advisor"
          params={{ locale }}
          className="rounded-lg border border-border bg-card p-4 hover:border-info transition flex items-center gap-3"
        >
          <span className="text-info text-lg">◎</span>
          <div>
            <div className="font-medium">{t("nav.advisor")}</div>
            <div className="text-xs text-muted-foreground">{t("chatPage.bestVsCheapest")}</div>
          </div>
        </Link>
        <Link
          to="/$locale/compare"
          params={{ locale }}
          search={{ skus: "" }}
          className="rounded-lg border border-border bg-card p-4 hover:border-info transition flex items-center gap-3"
        >
          <span className="text-info text-lg">⇔</span>
          <div>
            <div className="font-medium">{t("nav.compare")}</div>
            <div className="text-xs text-muted-foreground">{t("chatPage.compareSpecBySpec")}</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function ProductCard({
  p,
  locale,
  inCompare,
  onCompare,
}: {
  p: ProductRow;
  locale: string;
  inCompare: boolean;
  onCompare: () => void;
}) {
  const tCard = makeT(locale as Locale);
  const lt = p.lead_time_days;
  const fast = lt != null && lt <= 7;
  return (
    <div
      className={`rounded-lg border bg-background flex flex-col transition overflow-hidden ${
        inCompare ? "border-info shadow-sm" : "border-border hover:border-info"
      }`}
    >
      <div className="relative h-28 overflow-hidden bg-surface-alt">
        <img
          src={getProductImage(p, true)}
          alt={p.category.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
      </div>
      <div className="p-3 flex flex-col flex-1">
      <div className="flex justify-between items-start gap-1">
        <div className="text-[10px] text-info font-medium uppercase tracking-wider">{p.brand.name}</div>
        <button
          onClick={onCompare}
          title={tCard("productsPage.compareLink")}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
            inCompare
              ? "border-info bg-info/10 text-info"
              : "border-border text-muted-foreground hover:border-info hover:text-info"
          }`}
        >
          {inCompare ? "✓" : "+"}
        </button>
      </div>
      <Link
        to="/$locale/product/$sku"
        params={{ locale, sku: p.sku } as never}
        className="mt-1 font-medium text-sm text-foreground hover:text-info line-clamp-2 transition"
      >
        {p.name}
      </Link>
      <div className="mt-1 text-xs text-muted-foreground">{p.category.name}</div>

      {Object.keys(p.specs).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(p.specs).slice(0, 2).map(([k, v]) => (
            <span key={k} className="text-[10px] bg-surface-alt px-1.5 py-0.5 rounded text-muted-foreground">
              {k.replace(/_/g, " ")}: {v.value}{v.unit ? ` ${v.unit}` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-border mt-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${
            fast
              ? "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {fast ? tCard("productsPage.inStock") : lt != null ? `${lt}d` : "—"}
        </span>
        <Link
          to="/$locale/product/$sku"
          params={{ locale, sku: p.sku } as never}
          className="text-xs text-info hover:underline"
        >
          {tCard("chatPage.datasheet")}
        </Link>
      </div>
      </div>
    </div>
  );
}

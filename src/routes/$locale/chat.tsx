import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { aiSearchProducts, aiExplain, aiAskKnowledge, aiExtractDimensions, type AiSearchResult } from "@/lib/ai.functions";
import { computePhysics } from "@/lib/physics";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";
import { addToShoppingList } from "@/lib/cart";

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
  sources?: string[];  // RAG source citations
}

// Detect if query is a product-search or a general knowledge question
function isKnowledgeQuestion(q: string): boolean {
  const t = q.toLowerCase();
  // General tech questions — not a direct product search
  const knowledgeSignals = [
    /hur\s+(fungerar|monterar|installerar|kopplar|väljer|dimensionerar)/,
    /vad\s+(är|betyder|innebär|skiljer)/,
    /skillnad\s+mellan/,
    /how\s+(does|do|to|is)/,
    /what\s+(is|are|does)/,
    /explain|describe|difference|installation|maintenance|service|seal|pressure|temperature|specification|data ?sheet|technical/,
    /specifikation|montering|underhåll|tätning|tryck|temperatur|datablad|teknisk/,
  ];
  return knowledgeSignals.some((r) => r.test(t));
}

const EXAMPLE_QUERIES: Record<string, string[]> = {
  sv: [
    "Jag behöver en cylinder som lyfter 30 kg med 150mm slag",
    "Kompakt SMC cylinder för trånga utrymmen, 32mm kolvdiameter",
    "Pneumatisk gripper för cylindriska objekt",
    "Parker cylinder med IP67 för utomhusbruk",
    "Hur fungerar Parker P1D cylinderns kolvtätning?",
    "Vad är skillnaden mellan OSP-P och en vanlig cylinder?",
  ],
  en: [
    "I need a cylinder to lift 30 kg with 150mm stroke",
    "Compact SMC cylinder for tight spaces, 32mm bore",
    "Pneumatic gripper for cylindrical objects",
    "Parker cylinder with IP67 for outdoor use",
    "How does the Parker P1D cylinder piston seal work?",
    "What is the difference between OSP-P and a standard cylinder?",
  ],
  de: [
    "Ich brauche einen Zylinder für 30 kg Last, 150mm Hub",
    "Kompakter SMC-Zylinder für enge Räume, 32mm Kolbendurchmesser",
    "Pneumatischer Greifer für zylindrische Objekte",
    "Parker-Zylinder mit IP67 für den Außeneinsatz",
    "Wie funktioniert die Kolbendichtung beim Parker P1D?",
    "Was ist der Unterschied zwischen OSP-P und einem Normzylinder?",
  ],
  es: [
    "Necesito un cilindro para elevar 30 kg con 150mm de carrera",
    "Cilindro SMC compacto para espacios reducidos, diámetro 32mm",
    "Pinza neumática para objetos cilíndricos",
    "Cilindro Parker con IP67 para uso exterior",
    "¿Cómo funciona el sello del émbolo del Parker P1D?",
    "¿Cuál es la diferencia entre OSP-P y un cilindro estándar?",
  ],
};

function renderChatText(text: string) {
  return (
    <span className="whitespace-pre-line leading-relaxed">
      {text.split("\n").map((line, i) => {
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>
        );
        return <span key={i} className={`block ${line.startsWith("•") ? "pl-2" : ""}`}>{rendered}</span>;
      })}
    </span>
  );
}

function ChatPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const isSv = locale === "sv";
  const aiSearch = useServerFn(aiSearchProducts);
  const explain = useServerFn(aiExplain);
  const askKnowledge = useServerFn(aiAskKnowledge);
  const extractDims = useServerFn(aiExtractDimensions);

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
      // ── 1. Knowledge Q&A (non-product questions) ────────────────────────
      if (isKnowledgeQuestion(q)) {
        const result = await askKnowledge({ data: { question: q, locale } });
        setMsgs((m) => [...m, { role: "assistant", text: result.answer, sources: result.sources }]);
        setBusy(false);
        setTimeout(() => inputRef.current?.focus(), 100);
        return;
      }

      // ── 2. Extract physical dimensions (LLM: numbers only) ─────────────
      const dims = await extractDims({ data: { text: q, locale } });

      // ── 3. Physics computation (deterministic TypeScript) ───────────────
      const physics = computePhysics(dims);

      // ── 4. Show physics reasoning to user ───────────────────────────────
      if (physics.reasoning.length > 0) {
        const reasoningText = [
          isSv ? "**Teknisk analys:**" : "**Engineering analysis:**",
          ...physics.reasoning.map((r) => `• ${r}`),
          ...(physics.warnings.map((w) => `⚠️ ${w}`)),
        ].join("\n");
        setMsgs((m) => [...m, { role: "assistant", text: reasoningText }]);
      }

      // ── 5. Build catalog filter from physics ────────────────────────────
      function physicsFilter(p: ProductRow, categorySlug: string): boolean {
        // Category must match (at least partial slug)
        if (categorySlug && !p.category.slug.includes(categorySlug.split("-")[0])) return false;

        // HARD: stroke validation — product's stroke_max must cover required distance
        if (physics.minStroke_mm != null) {
          const specStroke = p.specs["stroke_max"]?.value ?? p.specs["stroke_mm"]?.value;
          if (specStroke != null) {
            // Parse range "100-1000" or single "500"
            const parts = String(specStroke).split(/[-–,]/);
            const maxStroke = Math.max(...parts.map((s) => Number(s.trim())).filter(Number.isFinite));
            if (Number.isFinite(maxStroke) && maxStroke < physics.minStroke_mm) return false;
          }
        }

        // HARD: bore validation — product's bore must be >= minimum required
        if (physics.minBore_mm != null) {
          const boreSlugs = ["bore_mm", "bore_diameter_mm", "bore", "diameter_mm", "cylinder_bore_mm", "piston_diameter_mm"];
          let boreFound = false;
          for (const bk of boreSlugs) {
            const boreVal = p.specs[bk]?.value;
            if (boreVal != null) {
              // Parse "32,40,50,63" or "32-100" → find max available bore
              const parts = String(boreVal).split(/[,\s\-–]+/);
              const maxBore = Math.max(...parts.map((s) => Number(s.trim())).filter(Number.isFinite));
              if (Number.isFinite(maxBore) && maxBore < physics.minBore_mm) return false;
              boreFound = true;
              break;
            }
          }
          // If no bore spec key found, extract from product name (e.g. "Ø32", "Ø10", "32mm bore")
          if (!boreFound) {
            const nameAndSku = `${p.name} ${p.sku}`;
            const borePat = /[Øø](\d+)|(\d+)\s*mm\s*(?:bore|kolvdiameter|cylinder)/i;
            const m = nameAndSku.match(borePat);
            if (m) {
              const nameBore = Number(m[1] ?? m[2]);
              if (Number.isFinite(nameBore) && nameBore < physics.minBore_mm) return false;
              boreFound = true;
            }
            // If still no bore info found for a cylinder category product: exclude when bore requirement is strict
            if (!boreFound && categorySlug && categorySlug.includes("cylinder")) {
              // Unknown bore + cylinder requirement = skip (likely a tiny cylinder family)
              return false;
            }
          }
        }

        return true;
      }

      // ── 6. Brand filter from query ──────────────────────────────────────
      const aiResult = await aiSearch({ data: { query: q, locale } });
      const brandSlug = aiResult.brand_slug;

      // ── 7. Find matching products per required category ─────────────────
      // For systems (pick & place): collect gripper + linear separately
      const allMatches: ProductRow[] = [];
      const systemGroups: { label: string; products: ProductRow[] }[] = [];

      if (physics.isSystem) {
        // Pick & place — return each subsystem separately
        const systemDef = [
          { label: isSv ? "🔵 Linjäraxel (horisontell rörelse)" : "🔵 Linear axis (horizontal)", cats: ["cylinder", "rodless", "electric-actuator", "linear"] },
          { label: isSv ? "🟡 Vertikal axel / lyftcylinder" : "🟡 Vertical axis / lift cylinder", cats: ["cylinder", "compact"] },
          { label: isSv ? "🟢 Gripklo (end effector)" : "🟢 Gripper (end effector)", cats: ["gripper"] },
        ];

        for (const sys of systemDef) {
          let sysMates = catalog.filter((p) =>
            sys.cats.some((c) => p.category.slug.includes(c))
            && (brandSlug ? p.brand.slug === brandSlug : true)
          );
          if (sysMates.length === 0) {
            sysMates = catalog.filter((p) => sys.cats.some((c) => p.category.slug.includes(c)));
          }
          sysMates = sysMates.sort((a, b) => (a.lead_time_days ?? 99) - (b.lead_time_days ?? 99)).slice(0, 3);
          if (sysMates.length) {
            systemGroups.push({ label: sys.label, products: sysMates });
            allMatches.push(...sysMates);
          }
        }
      } else {
        // Normal single-category search
        for (const catSlug of physics.categories.slice(0, 2)) {
          let catMatches = catalog.filter(
            (p) => physicsFilter(p, catSlug) && (brandSlug ? p.brand.slug === brandSlug : true)
          );

          // Drop brand constraint if no results
          if (catMatches.length === 0) {
            catMatches = catalog.filter((p) => physicsFilter(p, catSlug));
          }

          // Keyword fallback if still empty
          if (catMatches.length === 0 && aiResult.keywords?.length) {
            catMatches = catalog.filter((p) => {
              if (!physicsFilter(p, catSlug)) return false;
              const hay = [p.sku, p.name, p.brand.name, p.description ?? ""].join(" ").toLowerCase();
              return aiResult.keywords.some((kw) => hay.includes(kw.toLowerCase()));
            });
          }

          catMatches = catMatches.sort((a, b) => (a.lead_time_days ?? 99) - (b.lead_time_days ?? 99));
          allMatches.push(...catMatches);
          if (allMatches.length >= 6) break;
        }
      }

      // Deduplicate
      const seen = new Set<string>();
      const deduped = allMatches.filter((p) => { if (seen.has(p.sku)) return false; seen.add(p.sku); return true; });

      // ── 8. Build response messages ──────────────────────────────────────
      if (physics.isSystem && systemGroups.length > 0) {
        // System answer: show explanation + each subsystem group
        const sysExplanation = isSv
          ? `Pick & place-system kräver tre delar. Här är ett förslag på komponenter för varje del:`
          : `A pick & place system requires three parts. Here are component suggestions for each:`;
        setMsgs((m) => [...m, { role: "assistant", text: sysExplanation }]);

        for (const grp of systemGroups) {
          setMsgs((m) => [
            ...m,
            { role: "assistant", text: grp.label },
            { role: "products" as MsgRole, products: grp.products },
          ]);
        }
      } else if (deduped.length > 0) {
        // Normal product results
        const countText = isSv
          ? `Hittade ${deduped.length} produkter som uppfyller de tekniska kraven:`
          : `Found ${deduped.length} products meeting the technical requirements:`;
        setMsgs((m) => [
          ...m,
          { role: "assistant", text: countText },
          { role: "products" as MsgRole, products: deduped.slice(0, 6) },
        ]);

        // Async explanation
        const ctx = `Krav: ${q}\nFysik: ${physics.reasoning.join("; ")}\nProdukter: ${deduped.slice(0, 3).map((p) => `${p.name} (${p.sku})`).join(", ")}`;
        explain({
          data: {
            context: ctx,
            question: isSv
              ? "Förklara i 2-3 meningar varför dessa produkter är rätt dimensionerade för kravet."
              : "Explain in 2-3 sentences why these products are correctly sized for the requirement.",
            locale,
          },
        }).then((exp) => {
          if (exp.source === "ai") setMsgs((m) => [...m, { role: "assistant", text: exp.text }]);
        });
      } else {
        // No results after physics filter
        const noMatch = isSv
          ? `Inga produkter i katalogen uppfyller de beräknade kraven (min borr ${physics.minBore_mm ?? "—"} mm, min slag ${physics.minStroke_mm ?? "—"} mm). Kontakta oss via Rådgivaren för en offert på rätt storlek.`
          : `No products in the catalog meet the calculated requirements (min bore ${physics.minBore_mm ?? "—"} mm, min stroke ${physics.minStroke_mm ?? "—"} mm). Contact us via the Advisor for a custom quote.`;
        setMsgs((m) => [...m, { role: "assistant", text: noMatch }]);
      }

    } catch (e) {
      console.error(e);
      setMsgs((m) => [...m, { role: "assistant", text: t("chatPage.errorSv") }]);
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
                  {m.text && renderChatText(m.text)}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1">
                      {m.sources.map((s, si) => (
                        <span key={si} className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info/80 font-mono">
                          📄 {s}
                        </span>
                      ))}
                    </div>
                  )}
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
              {(EXAMPLE_QUERIES[locale] ?? EXAMPLE_QUERIES.en).map((q) => (
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
  const [added, setAdded] = useState(false);
  const lt = p.lead_time_days;
  const fast = lt != null && lt <= 7;

  function handleAddToCart() {
    addToShoppingList({ id: p.id, sku: p.sku, name: p.name });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div
      className={`rounded-lg border bg-background flex flex-col transition overflow-hidden ${
        inCompare ? "border-info shadow-sm" : "border-border hover:border-info"
      }`}
    >
      <div className="h-28 bg-[#f8f9fb] flex items-center justify-center overflow-hidden">
        <img
          src={getProductImage(p, true)}
          alt={p.category.name}
          className="w-full h-full object-contain"
          loading="lazy"
        />
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            className={`text-[11px] font-medium transition ${added ? "text-[oklch(0.45_0.15_155)]" : "text-muted-foreground hover:text-info"}`}
          >
            {added ? "✓" : "+"}
          </button>
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
    </div>
  );
}

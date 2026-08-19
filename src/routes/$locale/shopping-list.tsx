import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { analyzeDocument, type PoExtraction } from "@/lib/document-ai";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { loadCatalog } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import type { ProductRow } from "@/lib/types";
import {
  SHOPPING_LIST_KEY,
  SHOPPING_LIST_COUNT_KEY,
  type CartItem as ListItem,
  getCartItems,
  saveCartItems,
} from "@/lib/cart";

export const Route = createFileRoute("/$locale/shopping-list")({
  head: ({ params }) => ({
    meta: [{ title: `${makeT(params.locale as Locale)("shoppingList.title")} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: ShoppingListPage,
});

function ShoppingListPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const { user } = useAuth();

  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const [items, setItems] = useState<ListItem[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductRow[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // RFQ flow
  const [rfqStep, setRfqStep] = useState<null | "compare" | "form">(null);
  const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set());
  const [rfqName, setRfqName] = useState("");
  const [rfqEmail, setRfqEmail] = useState("");
  const [rfqPhone, setRfqPhone] = useState("");
  const [rfqCompany, setRfqCompany] = useState("");
  const [rfqOrgNumber, setRfqOrgNumber] = useState("");
  const [rfqPoNumber, setRfqPoNumber] = useState("");
  const [rfqMessage, setRfqMessage] = useState("");
  const [rfqHp, setRfqHp] = useState(""); // honeypot — real users never see or fill this
  const [rfqSending, setRfqSending] = useState(false);
  const [rfqSent, setRfqSent] = useState(false);
  const [rfqSentAnon, setRfqSentAnon] = useState(false);
  const [rfqError, setRfqError] = useState("");
  const [poReading, setPoReading] = useState(false);
  const [poReadError, setPoReadError] = useState<string | null>(null);
  const poInputRef = useRef<HTMLInputElement>(null);
  const [rfqId, setRfqId] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog().then(setCatalog);
  }, []);

  useEffect(() => {
    setItems(getCartItems());
  }, []);

  // Pre-fill form from company_profiles when user logs in
  useEffect(() => {
    if (!user) return;
    setRfqEmail((prev) => prev || user.email || "");
    supabase
      .from("company_profiles")
      .select("display_name,email,company_name,phone,org_number")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setRfqName((prev) => prev || data.display_name!);
        if (data?.email) setRfqEmail((prev) => prev || data.email!);
        if (data?.company_name) setRfqCompany((prev) => prev || data.company_name!);
        if (data?.phone) setRfqPhone((prev) => prev || data.phone!);
        if (data?.org_number) setRfqOrgNumber((prev) => prev || data.org_number!);
      });
  }, [user]);

  // Persist list + broadcast count for nav badge
  useEffect(() => {
    saveCartItems(items);
  }, [items]);

  // Click outside search dropdown
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Filter catalog as user types
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setResults([]); setShowResults(false); return; }
    const found = catalog
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
    setResults(found);
    setShowResults(found.length > 0);
  }, [query, catalog]);

  function addProduct(p: ProductRow) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) return prev.map((i) => (i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { product_id: p.id, sku: p.sku, name: p.name, qty: 1 }];
    });
    setQuery("");
    setShowResults(false);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.product_id !== id));
    setCompareSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function setQty(id: string, qty: number) {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => (i.product_id === id ? { ...i, qty } : i)));
  }

  function toggleCompare(id: string, checked: boolean) {
    setCompareSelected((prev) => {
      const next = new Set(prev);
      if (checked && next.size < 4) next.add(id);
      else if (!checked) next.delete(id);
      return next;
    });
  }

  function openCompare() {
    const ids = compareSelected.size >= 2 ? [...compareSelected] : items.slice(0, 4).map((i) => i.product_id);
    localStorage.setItem("mv_compare", JSON.stringify(ids));
    window.open(`/${locale}/compare`, "_blank");
  }

  // Guests may request a quote without an account — same as machine-builder.tsx.
  // submitRfq() derives user_id server-side (auth.uid(), null if anonymous).
  function handleRequestQuote() {
    setRfqStep("compare");
  }

  async function submitRfq() {
    setRfqSending(true);
    setRfqError("");
    try {
      const title = `${t("shoppingList.rfqTitle")} — ${rfqCompany || rfqName}`;
      // submit_rfq() creates the rfq row + its items atomically, server-side.
      // user_id is derived from auth.uid() inside the function (null if
      // anonymous) — never client-supplied. See migration
      // 20260819163000_submit_rfq_function.sql for why: rfq_items has no
      // client-facing INSERT policy (an earlier direct-insert here was
      // silently dropping every product list), and anonymous callers can't
      // satisfy the rfqs SELECT policy to read back a plain insert's result.
      const { data: newRfqId, error: rfqErr } = await supabase.rpc("submit_rfq", {
        p_title: title,
        p_contact_name: rfqName.trim(),
        p_contact_email: rfqEmail.trim(),
        p_contact_phone: rfqPhone.trim(),
        p_company: rfqCompany.trim(),
        p_org_number: rfqOrgNumber.trim(),
        p_po_number: rfqPoNumber.trim(),
        p_message: rfqMessage.trim(),
        p_items: items.map((item) => ({ product_id: item.product_id, qty: item.qty, role: "ordered" })),
        p_hp: rfqHp,
      });

      if (rfqErr || !newRfqId) throw rfqErr ?? new Error("No id returned");

      // rfq-notify re-reads the rest from the rfq_id row it's given — see that
      // function's own header comment for why it doesn't trust a client payload.
      fetch("https://buqfbcztspswezwyafxo.supabase.co/functions/v1/rfq-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfq_id: newRfqId }),
      }).catch(console.error);

      setRfqId(newRfqId);
      setRfqSentAnon(!user);
      setRfqSent(true);
      setItems([]);
    } catch (err) {
      console.error(err);
      setRfqError(locale === "sv"
        ? "Kunde inte skicka förfrågan. Försök igen."
        : "Could not submit request. Please try again.");
    }
    setRfqSending(false);
  }

  async function readPoFile(file: File) {
    setPoReading(true);
    setPoReadError(null);
    try {
      const extracted = await analyzeDocument(file, "po") as PoExtraction;
      if (extracted.company_name) setRfqCompany((p) => p || extracted.company_name!);
      if (extracted.contact_name) setRfqName((p) => p || extracted.contact_name!);
      if (extracted.contact_email) setRfqEmail((p) => p || extracted.contact_email!);
      if (extracted.contact_phone) setRfqPhone((p) => p || extracted.contact_phone!);
      if (extracted.org_number) setRfqOrgNumber((p) => p || extracted.org_number!);
      if (extracted.po_number) setRfqPoNumber((p) => p || extracted.po_number!);
    } catch (err) {
      setPoReadError(locale === "sv" ? "Kunde inte läsa dokumentet. Försök med en tydligare bild." : "Could not read the document. Try a clearer image.");
      console.error(err);
    }
    setPoReading(false);
  }

  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="container-page py-10 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🛒</span>
          <h1 className="text-2xl font-semibold tracking-tight">{t("shoppingList.title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("shoppingList.subtitle")}</p>
      </div>

      {/* Search / add products */}
      <div className="relative" ref={searchRef}>
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-info/30 transition">
          <span className="text-muted-foreground">🔍</span>
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={t("shoppingList.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setShowResults(false); }}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {showResults && (
          <div className="absolute top-full left-0 right-0 z-30 mt-1.5 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-alt text-left transition group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-info transition">{p.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{p.sku} · {p.brand.name}</div>
                </div>
                <span className="text-xs text-info opacity-0 group-hover:opacity-100 transition shrink-0 font-medium">
                  + {t("shoppingList.add")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="mt-5">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <div className="text-4xl mb-3">🛒</div>
            <p className="text-sm text-muted-foreground">{t("shoppingList.empty")}</p>
            <Link
              to="/$locale/products"
              params={{ locale }}
              className="mt-4 inline-block text-sm text-info hover:opacity-80 font-medium"
            >
              {t("shoppingList.browseProducts")} →
            </Link>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface-alt/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t("shoppingList.listTitle")}
                  </span>
                  <span className="inline-flex items-center justify-center rounded bg-info/15 text-info text-xs font-bold px-1.5 py-0.5">
                    {totalQty} {t("shoppingList.units")}
                  </span>
                </div>
                <button
                  onClick={() => setItems([])}
                  className="text-xs text-muted-foreground hover:text-destructive transition"
                >
                  {t("shoppingList.clearAll")}
                </button>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground bg-surface-alt/20">
                    <th className="w-10 p-3 text-center">
                      <input
                        type="checkbox"
                        title={t("shoppingList.selectAll")}
                        checked={compareSelected.size === items.length && items.length > 0}
                        onChange={(e) =>
                          setCompareSelected(
                            e.target.checked ? new Set(items.slice(0, 4).map((i) => i.product_id)) : new Set(),
                          )
                        }
                        className="rounded accent-info"
                      />
                    </th>
                    <th className="text-left p-3 font-medium">{t("shoppingList.product")}</th>
                    <th className="text-center p-3 font-medium w-32">{t("shoppingList.qty")}</th>
                    <th className="w-10 p-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const product = catalog.find((p) => p.id === item.product_id);
                    const isChecked = compareSelected.has(item.product_id);
                    return (
                      <tr
                        key={item.product_id}
                        className={`border-b border-border last:border-0 transition ${isChecked ? "bg-info/5" : "odd:bg-surface-alt/20"}`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleCompare(item.product_id, e.target.checked)}
                            disabled={!isChecked && compareSelected.size >= 4}
                            className="rounded accent-info"
                            title={t("shoppingList.selectForCompare")}
                          />
                        </td>
                        <td className="p-3">
                          {product ? (
                            <Link
                              to="/$locale/product/$sku"
                              params={{ locale, sku: product.sku }}
                              className="font-medium hover:text-info transition"
                            >
                              {item.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{item.name}</span>
                          )}
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{item.sku}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setQty(item.product_id, item.qty - 1)}
                              className="size-6 rounded border border-border hover:bg-surface-alt flex items-center justify-center text-sm font-bold transition"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={(e) => setQty(item.product_id, Number(e.target.value))}
                              className="w-10 text-center font-mono text-sm bg-transparent border-0 outline-none"
                            />
                            <button
                              onClick={() => setQty(item.product_id, item.qty + 1)}
                              className="size-6 rounded border border-border hover:bg-surface-alt flex items-center justify-center text-sm font-bold transition"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => removeItem(item.product_id)}
                            className="text-muted-foreground hover:text-destructive transition text-base leading-none"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Compare hint */}
            {items.length >= 2 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground px-1">
                <span>☑</span>
                <span>{t("shoppingList.compareHint")}</span>
                {compareSelected.size >= 2 && (
                  <span className="ml-auto text-info font-medium">{compareSelected.size} {t("shoppingList.selected")}</span>
                )}
              </div>
            )}

            {/* Action bar */}
            <div className="mt-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                {compareSelected.size >= 2 && (
                  <button
                    onClick={openCompare}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-info text-info hover:bg-info/10 transition font-medium"
                  >
                    ⇄ {t("shoppingList.compareSelected")} ({compareSelected.size})
                  </button>
                )}
                {compareSelected.size === 1 && (
                  <p className="text-xs text-muted-foreground">{t("shoppingList.selectMoreForCompare")}</p>
                )}
              </div>

              <button
                onClick={handleRequestQuote}
                className="px-5 py-2.5 rounded-lg bg-info text-primary-foreground text-sm font-semibold hover:opacity-90 transition shadow-sm"
              >
                {t("shoppingList.requestQuote")} →
              </button>
            </div>

            {/* Login nudge (shown when not logged in) */}
            {!user && (
              <p className="mt-3 text-xs text-muted-foreground text-right">
                {t("shoppingList.loginToQuote")}{" "}
                <Link
                  to="/$locale/login"
                  params={{ locale }}
                  search={{ redirect: `/${locale}/shopping-list` } as never}
                  className="text-info hover:underline font-medium"
                >
                  {t("nav.login")}
                </Link>
              </p>
            )}
          </>
        )}
      </div>

      {/* ── RFQ Modal ──────────────────────────────────────────── */}
      {rfqStep && !rfqSent && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setRfqStep(null)}
        >
          <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

            {/* Step indicator */}
            <div className="flex border-b border-border">
              {(["compare", "form"] as const).map((step, i) => (
                <div
                  key={step}
                  className={`flex-1 py-2.5 text-center text-xs font-medium transition ${rfqStep === step ? "text-info border-b-2 border-info" : "text-muted-foreground"}`}
                >
                  {i + 1}. {step === "compare" ? t("shoppingList.stepCompare") : t("shoppingList.stepForm")}
                </div>
              ))}
            </div>

            {/* ── Step 1: Compare ── */}
            {rfqStep === "compare" && (
              <div className="p-6">
                <h2 className="text-lg font-semibold">{t("shoppingList.compareBeforeQuote")}</h2>
                <p className="text-sm text-muted-foreground mt-1 mb-4">{t("shoppingList.compareBeforeQuoteHint")}</p>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <label
                      key={item.product_id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                        compareSelected.has(item.product_id)
                          ? "border-info bg-info/5"
                          : "border-border hover:bg-surface-alt"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={compareSelected.has(item.product_id)}
                        onChange={(e) => toggleCompare(item.product_id, e.target.checked)}
                        disabled={!compareSelected.has(item.product_id) && compareSelected.size >= 4}
                        className="rounded accent-info shrink-0"
                      />
                      <span className="text-sm font-medium flex-1 truncate">{item.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">{item.sku}</span>
                      <span className="text-xs text-muted-foreground shrink-0">×{item.qty}</span>
                    </label>
                  ))}
                </div>

                {compareSelected.size >= 2 && (
                  <p className="mt-2 text-xs text-info">{compareSelected.size} {t("shoppingList.productsSelected")}</p>
                )}
                {compareSelected.size > 0 && compareSelected.size < 2 && (
                  <p className="mt-2 text-xs text-muted-foreground">{t("shoppingList.selectMoreForCompare")}</p>
                )}

                <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                  {compareSelected.size >= 2 && (
                    <button
                      onClick={openCompare}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-info text-info text-sm font-medium hover:bg-info/10 transition"
                    >
                      ⇄ {t("shoppingList.openCompare")}
                    </button>
                  )}
                  <button
                    onClick={() => setRfqStep("form")}
                    className="flex-1 py-2.5 rounded-lg bg-info text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
                  >
                    {compareSelected.size >= 2
                      ? t("shoppingList.continueToQuote")
                      : t("shoppingList.skipCompare")}{" "}
                    →
                  </button>
                </div>

                <button
                  onClick={() => setRfqStep(null)}
                  className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground text-center transition py-1"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}

            {/* ── Step 2: Contact form ── */}
            {rfqStep === "form" && (
              <div className="p-6">
                <h2 className="text-lg font-semibold">{t("shoppingList.contactForm")}</h2>
                <p className="text-sm text-muted-foreground mt-1 mb-4">{t("shoppingList.contactFormHint")}</p>

                {/* PO upload — pre-fills fields automatically */}
                <input ref={poInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) readPoFile(f); e.target.value = ""; }} />
                <button
                  type="button"
                  onClick={() => poInputRef.current?.click()}
                  disabled={poReading}
                  className="mb-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-info/50 text-info text-sm hover:bg-info/5 transition disabled:opacity-50"
                >
                  {poReading
                    ? <><span className="size-3 rounded-full border-2 border-info/30 border-t-info animate-spin" /> {locale === "sv" ? "Läser PO…" : "Reading PO…"}</>
                    : <><span>📎</span> {locale === "sv" ? "Ladda upp PO — fyller i fälten automatiskt" : "Upload PO — auto-fills fields"}</>
                  }
                </button>
                {poReadError && <p className="text-xs text-destructive mb-3">{poReadError}</p>}

                <div className="space-y-2.5">
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <input
                      className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30"
                      placeholder={t("shoppingList.namePlaceholder")}
                      value={rfqName}
                      onChange={(e) => setRfqName(e.target.value)}
                    />
                    <input
                      type="email"
                      className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30"
                      placeholder={t("shoppingList.emailPlaceholder")}
                      value={rfqEmail}
                      onChange={(e) => setRfqEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <input
                      className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30"
                      placeholder={t("shoppingList.companyPlaceholder")}
                      value={rfqCompany}
                      onChange={(e) => setRfqCompany(e.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30"
                      placeholder={t("shoppingList.phonePlaceholder")}
                      value={rfqPhone}
                      onChange={(e) => setRfqPhone(e.target.value)}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <input
                      className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30"
                      placeholder={locale === "sv" ? "Org.nr (t.ex. 556000-0000)" : "Org. number"}
                      value={rfqOrgNumber}
                      onChange={(e) => setRfqOrgNumber(e.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30"
                      placeholder={locale === "sv" ? "Ert PO-nummer (valfritt)" : "Your PO number (optional)"}
                      value={rfqPoNumber}
                      onChange={(e) => setRfqPoNumber(e.target.value)}
                    />
                  </div>
                  <textarea
                    className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30 resize-none"
                    placeholder={t("shoppingList.messagePlaceholder")}
                    rows={3}
                    value={rfqMessage}
                    onChange={(e) => setRfqMessage(e.target.value)}
                  />
                </div>

                {/* Honeypot — hidden from real users via CSS, not `type="hidden"`,
                    so form-filling bots that read layout still find and fill it. */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={rfqHp}
                  onChange={(e) => setRfqHp(e.target.value)}
                  className="absolute -left-[9999px] w-px h-px opacity-0"
                  aria-hidden="true"
                />

                {/* Summary */}
                <div className="mt-3 rounded-lg border border-border bg-surface-alt/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {items.length} {t("shoppingList.productsInList")}:
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((i) => (
                      <li key={i.product_id} className="flex justify-between text-xs">
                        <span className="text-foreground truncate">{i.name}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">×{i.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {rfqError && <p className="mt-3 text-sm text-destructive">{rfqError}</p>}

                <div className="mt-4 flex gap-2.5">
                  <button
                    onClick={() => setRfqStep("compare")}
                    className="px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-alt transition"
                  >
                    ← {t("common.back")}
                  </button>
                  <button
                    onClick={submitRfq}
                    disabled={rfqSending || !rfqName.trim() || !rfqEmail.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-info text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {rfqSending ? t("shoppingList.sending") : t("shoppingList.sendQuote")}
                  </button>
                </div>

                <button
                  onClick={() => setRfqStep(null)}
                  className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground text-center transition py-1"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Success overlay ── */}
      {rfqSent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-8 text-center border border-border">
            <div className="size-16 rounded-full bg-[oklch(0.55_0.15_155)]/15 flex items-center justify-center mx-auto mb-4 text-3xl">
              ✓
            </div>
            <h2 className="text-xl font-semibold">{t("shoppingList.sentTitle")}</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t("shoppingList.sentBody")}{!rfqSentAnon && ` ${t("shoppingList.sentBodyTrack")}`}
            </p>
            {rfqSentAnon ? (
              // Anonymous submission — no account, so no "my RFQs"/"my orders" to
              // link to (both require login and ownership). Same reference-only
              // confirmation pattern as machine-builder.tsx's guest flow.
              rfqId && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {locale === "sv" ? "Referens" : "Reference"}: <span className="font-mono font-semibold text-foreground">{rfqId.slice(0, 8).toUpperCase()}</span>
                </p>
              )
            ) : (
              <div className="mt-5 flex flex-col gap-2">
                {rfqId && (
                  <Link
                    to="/$locale/rfq/$rfqId"
                    params={{ locale, rfqId }}
                    className="inline-block px-5 py-2.5 rounded-lg bg-info text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
                  >
                    {t("shoppingList.viewRfq")} →
                  </Link>
                )}
                <Link
                  to="/$locale/orders"
                  params={{ locale }}
                  className="inline-block px-5 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-alt transition"
                >
                  {t("shoppingList.viewOrders")}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

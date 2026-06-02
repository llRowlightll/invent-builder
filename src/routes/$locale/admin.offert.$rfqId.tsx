/**
 * /admin/offert/:rfqId
 * Admin-editable Offert (OE) document — edit line-item prices, notes, terms,
 * then print/save as PDF or email a read-only link to the customer.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { analyzeDocument, type QuoteExtraction } from "@/lib/document-ai";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard } from "@/lib/auth-context";
import { fetchCompanySettings, type CompanySettings } from "@/lib/company-settings";

export const Route = createFileRoute("/$locale/admin/offert/$rfqId")({
  component: AdminOffertPage,
});

type RfqItem = {
  id: string;
  product_id: string | null;
  qty: number | null;
  unit_price: number | null;
  note: string | null;
  product?: { sku: string; name: string; brand?: { slug: string; name: string } | null } | null;
};

type Rfq = {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  org_number: string | null;
  po_number: string | null;
  message: string | null;
  quote_amount: number | null;
  quote_currency: string | null;
  status: string | null;
  created_at: string;
};

const VAT = 0.25;

function fmt(n: number, currency = "SEK") {
  return n.toLocaleString("sv-SE", { style: "currency", currency, maximumFractionDigits: 0 });
}

function docRef(rfqId: string) {
  return `OE-${rfqId.slice(0, 8).toUpperCase()}`;
}

export default function AdminOffertPage() {
  const { locale, rfqId } = Route.useParams();
  const { isAdmin, authLoading } = useAdminGuard();
  const navigate = useNavigate();

  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [items, setItems] = useState<RfqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [quoteReading, setQuoteReading] = useState(false);
  const [quoteReadMsg, setQuoteReadMsg] = useState<string | null>(null);
  const [copiedBrand, setCopiedBrand] = useState<string | null>(null);
  const quoteFileRef = useRef<HTMLInputElement>(null);

  // Document-level editable fields
  const [validDays, setValidDays] = useState("30");
  const [deliveryWeeks, setDeliveryWeeks] = useState("4–6 veckor");
  const [paymentTerms, setPaymentTerms] = useState("30 dagar netto");
  const [footerNote, setFooterNote] = useState("");
  const [currency, setCurrency] = useState("SEK");

  // Per-line edit state: { [itemId]: { qty, price, note } }
  const [lineEdits, setLineEdits] = useState<
    Record<string, { qty: number; price: number; note: string }>
  >({});

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { navigate({ to: "/$locale/login", params: { locale } }); return; }
    load();
  }, [isAdmin, authLoading]);

  async function load() {
    setLoading(true);
    const [{ data: rfqData }, { data: itemData }, co] = await Promise.all([
      supabase.from("rfqs").select("*").eq("id", rfqId).single(),
      supabase
        .from("rfq_items")
        .select("id, product_id, qty, unit_price, note, products(sku, name, brand:brands(slug, name))")
        .eq("rfq_id", rfqId),
      fetchCompanySettings(),
    ]);
    setCompany(co);
    if (rfqData) {
      setRfq(rfqData as Rfq);
      setCurrency((rfqData as Rfq).quote_currency ?? "SEK");
    }
    const mapped: RfqItem[] = (itemData ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      product_id: d.product_id as string | null,
      qty: d.qty as number | null,
      unit_price: d.unit_price as number | null,
      note: d.note as string | null,
      product: d.products as { sku: string; name: string; brand?: { slug: string; name: string } | null } | null,
    }));
    setItems(mapped);
    // Seed line edits from saved values
    const seed: Record<string, { qty: number; price: number; note: string }> = {};
    for (const it of mapped) {
      seed[it.id] = {
        qty: it.qty ?? 1,
        price: it.unit_price ?? 0,
        note: it.note ?? "",
      };
    }
    setLineEdits(seed);
    setLoading(false);
  }

  // Computed totals
  const lineItems = items.map((it) => {
    const e = lineEdits[it.id] ?? { qty: it.qty ?? 1, price: it.unit_price ?? 0, note: "" };
    return { ...it, editQty: e.qty, editPrice: e.price, editNote: e.note, lineTotal: e.qty * e.price };
  });
  const totalEx = lineItems.reduce((s, l) => s + l.lineTotal, 0);
  const vatAmt  = totalEx * VAT;
  const totalInc = totalEx + vatAmt;

  function setLine(id: string, field: "qty" | "price" | "note", value: string | number) {
    setLineEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { qty: 1, price: 0, note: "" }), [field]: value },
    }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    // Save each line's unit_price, qty, note back to rfq_items
    for (const it of lineItems) {
      await supabase
        .from("rfq_items")
        .update({ unit_price: it.editPrice, qty: it.editQty, note: it.editNote || null })
        .eq("id", it.id);
    }
    // Also update quote_amount on the RFQ
    await supabase
      .from("rfqs")
      .update({ quote_amount: totalInc, quote_currency: currency })
      .eq("id", rfqId);
    setSaving(false);
    setSaved(true);
  }

  async function sendToCustomer() {
    if (!rfq) return;
    setSending(true);
    const publicUrl = `${window.location.origin}/${locale}/offert/${rfqId}`;
    await fetch("https://buqfbcztspswezwyafxo.supabase.co/functions/v1/order-status-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_ref: docRef(rfqId),
        contact_email: rfq.contact_email,
        contact_name: rfq.contact_name ?? "",
        status: "quoted",
        quote_amount: totalInc,
        currency,
        quote_url: publicUrl,
      }),
    }).catch(console.error);
    // Also update RFQ status to quoted
    await supabase.from("rfqs").update({ status: "quoted", quote_amount: totalInc, quote_currency: currency }).eq("id", rfqId);
    setSending(false);
    setSent(true);
  }

  async function readSupplierQuote(file: File) {
    setQuoteReading(true);
    setQuoteReadMsg(null);
    try {
      const extracted = await analyzeDocument(file, "quote") as QuoteExtraction;
      const { items: extractedItems, currency: extractedCurrency, delivery_weeks, payment_terms: pt } = extracted;

      if (extractedCurrency) setCurrency(extractedCurrency);
      if (delivery_weeks) setDeliveryWeeks(delivery_weeks);
      if (pt) setPaymentTerms(pt);

      // Map extracted items onto existing line edits by position
      if (extractedItems?.length) {
        setLineEdits((prev) => {
          const updated = { ...prev };
          // Match by index — supplier quote rows align with RFQ items positionally
          items.forEach((it, idx) => {
            const sup = extractedItems[idx];
            if (sup?.unit_price_ex_vat != null) {
              updated[it.id] = {
                qty: prev[it.id]?.qty ?? it.qty ?? 1,
                price: sup.unit_price_ex_vat,
                note: sup.note ?? prev[it.id]?.note ?? "",
              };
            }
          });
          return updated;
        });
        const matched = extractedItems.filter((_, i) => i < items.length && extractedItems[i].unit_price_ex_vat != null).length;
        setQuoteReadMsg(`✓ ${matched} av ${items.length} rader fick pris från leverantörsofferten.`);
      } else {
        setQuoteReadMsg("Inga radpriser hittades i dokumentet.");
      }
      setSaved(false);
    } catch (err) {
      setQuoteReadMsg("Kunde inte läsa dokumentet. Försök med en tydligare bild.");
      console.error(err);
    }
    setQuoteReading(false);
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="size-6 rounded-full border-2 border-info/30 border-t-info animate-spin" />
    </div>
  );

  if (!rfq) return <div className="container-page py-16 text-muted-foreground">RFQ hittades inte.</div>;

  const co = company ?? { name: "—", org: "", address: "", postal: "", email: "", phone: "", web: "", bankgiro: "", vat: "" };
  const today = new Date().toLocaleDateString("sv-SE");
  const validUntil = new Date(Date.now() + Number(validDays) * 86400000).toLocaleDateString("sv-SE");

  // ── Supplier RFQ routing: group lines by manufacturer so each supplier can be
  // quoted separately, with a ready-to-send offert template per brand. ─────────
  const supplierGroups = (() => {
    const m = new Map<string, RfqItem[]>();
    for (const it of items) {
      const brand = it.product?.brand?.name ?? "Övrigt / okänt märke";
      const arr = m.get(brand) ?? [];
      arr.push(it);
      m.set(brand, arr);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  })();

  function supplierTemplate(brand: string, list: RfqItem[]) {
    const ref = docRef(rfqId);
    const lines = list
      .map((it) => {
        const qty = lineEdits[it.id]?.qty ?? it.qty ?? 1;
        return `- ${it.product?.sku ?? "?"}  ${it.product?.name ?? ""}  ×${qty}`;
      })
      .join("\n");
    return `Offertförfrågan – ${brand}
Vår referens: ${ref}
Slutkund/projekt: ${rfq?.company || rfq?.contact_name || "—"}

Hej,
vi vill begära offert på följande ${brand}-artiklar:

${lines}

Vänligen ange nettopris (ex. moms) per styck samt leveranstid.
Tack på förhand!

${co.name}`;
  }

  async function copyTemplate(brand: string, list: RfqItem[]) {
    try {
      await navigator.clipboard.writeText(supplierTemplate(brand, list));
      setCopiedBrand(brand);
      setTimeout(() => setCopiedBrand(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── Admin toolbar (hidden on print) ──────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-30 bg-card border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap">
        <a href={`/${locale}/admin/rfq`} className="text-xs text-muted-foreground hover:text-foreground">← RFQ-lista</a>
        <span className="text-muted-foreground/40">|</span>
        <span className="text-sm font-semibold text-foreground">Offert {docRef(rfqId)}</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Supplier quote upload */}
          <input ref={quoteFileRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readSupplierQuote(f); e.target.value = ""; }} />
          <button
            onClick={() => quoteFileRef.current?.click()}
            disabled={quoteReading}
            title="Ladda upp leverantörsoffert — AI extraherar priser per rad"
            className="px-3 py-1.5 text-xs rounded-md border border-dashed border-border text-muted-foreground hover:border-info hover:text-info transition disabled:opacity-50 flex items-center gap-1"
          >
            {quoteReading
              ? <><span className="size-2.5 rounded-full border border-info/40 border-t-info animate-spin" /> Läser…</>
              : <>📎 Läs in leverantörsoffert</>}
          </button>
          {quoteReadMsg && (
            <span className={`text-xs ${quoteReadMsg.startsWith("✓") ? "text-[oklch(0.50_0.18_155)]" : "text-destructive"}`}>
              {quoteReadMsg}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded-md border border-border hover:border-info text-foreground hover:text-info transition disabled:opacity-50"
          >
            {saving ? "Sparar…" : saved ? "✓ Sparat" : "Spara priser"}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 text-sm rounded-md bg-info text-primary-foreground hover:opacity-90 transition"
          >
            🖨 Skriv ut / Spara PDF
          </button>
          {rfq.contact_email && (
            <button
              onClick={sendToCustomer}
              disabled={sending || sent}
              className="px-4 py-1.5 text-sm rounded-md bg-[oklch(0.60_0.18_155)] text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {sent ? "✓ Skickad" : sending ? "Skickar…" : "📧 Skicka till kund"}
            </button>
          )}
        </div>
      </div>

      {/* ── Supplier RFQ routing (hidden on print) ───────────────────────── */}
      {items.length > 0 && (
        <div className="print:hidden mx-auto mt-6 max-w-3xl px-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground">Leverantörsförfrågningar</span>
              <span className="text-xs text-muted-foreground">
                — grupperat per varumärke ({supplierGroups.length} leverantör{supplierGroups.length !== 1 ? "er" : ""})
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Varje varumärke får en färdig offertförfrågan att skicka till respektive leverantörs offertadress.
              Läs sedan in svaret med "📎 Läs in leverantörsoffert" ovan.
            </p>
            <div className="space-y-2">
              {supplierGroups.map(([brand, list]) => (
                <details key={brand} className="rounded-lg border border-border/70">
                  <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none text-sm">
                    <span className="font-medium text-foreground">{brand}</span>
                    <span className="text-xs text-muted-foreground">
                      {list.length} rad{list.length !== 1 ? "er" : ""}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          copyTemplate(brand, list);
                        }}
                        className="px-2 py-1 text-xs rounded-md border border-border hover:border-info hover:text-info transition"
                      >
                        {copiedBrand === brand ? "✓ Kopierad" : "📋 Kopiera mall"}
                      </button>
                      <a
                        href={`mailto:?subject=${encodeURIComponent(
                          `Offertförfrågan ${brand} – ${docRef(rfqId)}`,
                        )}&body=${encodeURIComponent(supplierTemplate(brand, list))}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 text-xs rounded-md border border-border hover:border-info hover:text-info transition"
                      >
                        📧 Mejla
                      </a>
                    </span>
                  </summary>
                  <pre className="px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap border-t border-border/70 bg-muted/30 rounded-b-lg">
                    {supplierTemplate(brand, list)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Document ─────────────────────────────────────────────────────── */}
      <div className="mx-auto my-8 print:my-0 max-w-3xl bg-white shadow-lg print:shadow-none">
        <div className="px-12 py-10 print:px-10 print:py-8" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>

          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <div className="text-2xl font-bold tracking-tight" style={{ fontFamily: "system-ui, sans-serif" }}>
                {co.name}
              </div>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                <div>{co.address}{co.postal ? `, ${co.postal}` : ""}</div>
                <div>{co.email}{co.email && co.phone ? " · " : ""}{co.phone}</div>
                {co.org && <div>Org.nr {co.org}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-light tracking-widest uppercase text-gray-300" style={{ fontFamily: "system-ui, sans-serif" }}>
                Offert
              </div>
              <div className="text-sm text-gray-600 mt-2 space-y-0.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                <div><span className="text-gray-400">Ref:</span> {docRef(rfqId)}</div>
                <div><span className="text-gray-400">Datum:</span> {today}</div>
                <div><span className="text-gray-400">Giltig till:</span> {validUntil}</div>
              </div>
            </div>
          </div>

          {/* Customer block */}
          <div className="mb-8 p-4 bg-gray-50 rounded" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Till</div>
            <div className="font-semibold text-gray-800">{rfq.company ?? rfq.contact_name}</div>
            {rfq.company && rfq.contact_name && <div className="text-sm text-gray-600">Att: {rfq.contact_name}</div>}
            {rfq.org_number && <div className="text-sm text-gray-500">Org.nr {rfq.org_number}</div>}
            {rfq.contact_email && <div className="text-sm text-gray-500">{rfq.contact_email}</div>}
            {rfq.contact_phone && <div className="text-sm text-gray-500">{rfq.contact_phone}</div>}
            {rfq.po_number && <div className="text-sm text-gray-600 mt-1">Er ref (PO): <span className="font-medium">{rfq.po_number}</span></div>}
          </div>

          {/* Admin-only document settings (hidden on print) */}
          <div className="print:hidden mb-6 grid grid-cols-2 gap-3 p-4 bg-amber-50 border border-amber-200 rounded text-xs">
            <label className="block">
              <span className="text-gray-500 uppercase tracking-wide">Giltighetstid (dagar)</span>
              <input value={validDays} onChange={e => setValidDays(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="text-gray-500 uppercase tracking-wide">Leveranstid</span>
              <input value={deliveryWeeks} onChange={e => setDeliveryWeeks(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="text-gray-500 uppercase tracking-wide">Betalningsvillkor</span>
              <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="text-gray-500 uppercase tracking-wide">Valuta</span>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded px-2 py-1">
                <option>SEK</option><option>EUR</option><option>USD</option>
              </select>
            </label>
          </div>

          {/* Line items table */}
          <table className="w-full text-sm mb-2" style={{ fontFamily: "system-ui, sans-serif" }}>
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-2 text-xs uppercase tracking-wider text-gray-500 w-20">Art.nr</th>
                <th className="text-left py-2 text-xs uppercase tracking-wider text-gray-500">Benämning</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 w-16">Antal</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 w-28">À-pris ex. moms</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-500 w-28">Belopp ex. moms</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, i) => (
                <tr key={it.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="py-2.5 pr-3 text-xs text-gray-500 font-mono">{it.product?.sku ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <div className="text-gray-800">{it.product?.name ?? "Okänd produkt"}</div>
                    {/* Note — editable in admin, shown on print */}
                    <div className="print:hidden mt-1">
                      <input
                        value={it.editNote}
                        onChange={e => setLine(it.id, "note", e.target.value)}
                        placeholder="Anteckning (syns på offert)"
                        className="text-xs w-full border-b border-dashed border-gray-300 focus:outline-none focus:border-info bg-transparent text-gray-500"
                      />
                    </div>
                    {it.editNote && (
                      <div className="hidden print:block text-xs text-gray-500 mt-0.5">{it.editNote}</div>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {/* Qty editable in admin */}
                    <input
                      type="number"
                      min={1}
                      value={it.editQty}
                      onChange={e => setLine(it.id, "qty", Number(e.target.value))}
                      className="print:hidden w-14 text-right border border-gray-200 rounded px-1 text-sm focus:outline-none focus:ring-1 focus:ring-info"
                    />
                    <span className="hidden print:inline">{it.editQty}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={it.editPrice}
                      onChange={e => setLine(it.id, "price", Number(e.target.value))}
                      className="print:hidden w-24 text-right border border-gray-200 rounded px-1 text-sm focus:outline-none focus:ring-1 focus:ring-info"
                    />
                    <span className="hidden print:inline">{fmt(it.editPrice, currency)}</span>
                  </td>
                  <td className="py-2.5 text-right font-medium text-gray-800">
                    {fmt(it.lineTotal, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8" style={{ fontFamily: "system-ui, sans-serif" }}>
            <table className="text-sm w-64">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-500">Summa ex. moms</td>
                  <td className="py-1 text-right font-medium text-gray-800">{fmt(totalEx, currency)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500">Moms 25 %</td>
                  <td className="py-1 text-right text-gray-700">{fmt(vatAmt, currency)}</td>
                </tr>
                <tr className="border-t-2 border-gray-800">
                  <td className="py-2 font-bold text-gray-900">Totalt att betala</td>
                  <td className="py-2 text-right font-bold text-gray-900 text-base">{fmt(totalInc, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Terms */}
          <div className="border-t border-gray-200 pt-6 mb-6 grid grid-cols-3 gap-6 text-xs text-gray-600" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div>
              <div className="uppercase tracking-wider text-gray-400 mb-1">Betalningsvillkor</div>
              <div className="print:block hidden">{paymentTerms}</div>
              <input
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                className="print:hidden w-full border-b border-dashed border-gray-300 focus:outline-none bg-transparent"
              />
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-400 mb-1">Leveranstid</div>
              <div className="print:block hidden">{deliveryWeeks}</div>
              <input
                value={deliveryWeeks}
                onChange={e => setDeliveryWeeks(e.target.value)}
                className="print:hidden w-full border-b border-dashed border-gray-300 focus:outline-none bg-transparent"
              />
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-400 mb-1">Giltighet</div>
              <div>{validDays} dagar (t.o.m. {validUntil})</div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mb-8 text-xs text-gray-500" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="print:block hidden whitespace-pre-wrap">{footerNote}</div>
            <textarea
              value={footerNote}
              onChange={e => setFooterNote(e.target.value)}
              placeholder="Eventuella noteringar (visas på offerten)…"
              rows={3}
              className="print:hidden w-full border border-dashed border-gray-300 rounded p-2 text-xs focus:outline-none focus:border-info resize-none bg-transparent"
            />
          </div>

          {/* Customer's original message (admin view only) */}
          {rfq.message && (
            <div className="print:hidden mb-6 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              <span className="font-semibold">Kundens meddelande: </span>{rfq.message}
            </div>
          )}

          {/* Signature */}
          <div className="border-t border-gray-200 pt-6 flex justify-between text-xs text-gray-500" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div>
              <div className="font-semibold text-gray-700 mb-1">{co.name}</div>
              {co.email && <div>{co.email}</div>}
              {co.phone && <div>{co.phone}</div>}
              {co.web && <div>{co.web}</div>}
              {co.bankgiro && <div>Bankgiro: {co.bankgiro}</div>}
              {co.vat && <div>Momsreg.nr: {co.vat}</div>}
            </div>
            <div className="text-right">
              <div className="text-gray-400 mb-4">Underskrift / Stämpel</div>
              <div className="border-b border-gray-300 w-40" />
            </div>
          </div>

        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:inline { display: inline !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </div>
  );
}

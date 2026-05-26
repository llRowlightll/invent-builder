/**
 * /admin/orderbekraftelse/:orderId
 * Admin-editable Orderbekräftelse (OC) — edit prices/delivery/terms,
 * print as PDF, email confirmation link to customer.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard } from "@/lib/auth-context";
import { fetchCompanySettings, type CompanySettings } from "@/lib/company-settings";

export const Route = createFileRoute("/$locale/admin/orderbekraftelse/$orderId")({
  component: AdminOCPage,
});

type OrderItem = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
  total_price_ex_vat: number;
  brand?: string;
  note?: string;
};

type Order = {
  id: string;
  customer_name: string;
  customer_company: string | null;
  customer_email: string;
  customer_org_nr: string | null;
  po_number: string | null;
  status: string;
  items: OrderItem[];
  total_ex_vat: number | null;
  total_inc_vat: number | null;
  vat_rate: number;
  currency: string;
  estimated_delivery: string | null;
  payment_status: string;
  internal_notes: string | null;
  created_at: string;
  rfq_id: string | null;
};

const VAT = 0.25;

function fmt(n: number, currency = "SEK") {
  return n.toLocaleString("sv-SE", { style: "currency", currency, maximumFractionDigits: 0 });
}
function docRef(orderId: string) {
  return `OC-${orderId.slice(0, 8).toUpperCase()}`;
}

export default function AdminOCPage() {
  const { locale, orderId } = Route.useParams();
  const { isAdmin, authLoading } = useAdminGuard();
  const navigate = useNavigate();

  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [paymentTerms, setPaymentTerms] = useState("30 dagar netto");
  const [deliveryText, setDeliveryText] = useState("");
  const [footerNote, setFooterNote] = useState("");

  // Per-line edits on top of order.items
  const [lineEdits, setLineEdits] = useState<
    Record<number, { qty: number; price: number; note: string }>
  >({});

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { navigate({ to: "/$locale/login", params: { locale } }); return; }
    load();
  }, [isAdmin, authLoading]);

  async function load() {
    setLoading(true);
    const [{ data }, co] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).single(),
      fetchCompanySettings(),
    ]);
    setCompany(co);
    if (data) {
      const o = data as unknown as Order;
      setOrder(o);
      setDeliveryText(o.estimated_delivery ?? "");
      // Seed line edits
      const seed: Record<number, { qty: number; price: number; note: string }> = {};
      const items: OrderItem[] = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
      items.forEach((it, i) => {
        seed[i] = { qty: it.qty, price: it.unit_price_ex_vat, note: it.note ?? "" };
      });
      setLineEdits(seed);
    }
    setLoading(false);
  }

  const baseItems: OrderItem[] = Array.isArray(order?.items) ? (order!.items as OrderItem[]) : [];
  const lineItems = baseItems.map((it, i) => {
    const e = lineEdits[i] ?? { qty: it.qty, price: it.unit_price_ex_vat, note: it.note ?? "" };
    return { ...it, editQty: e.qty, editPrice: e.price, editNote: e.note, lineTotal: e.qty * e.price };
  });

  const totalEx  = lineItems.reduce((s, l) => s + l.lineTotal, 0);
  const vatAmt   = totalEx * VAT;
  const totalInc = totalEx + vatAmt;
  const currency = order?.currency ?? "SEK";

  function setLine(i: number, field: "qty" | "price" | "note", value: string | number) {
    setLineEdits(prev => ({
      ...prev,
      [i]: { ...(prev[i] ?? { qty: 1, price: 0, note: "" }), [field]: value },
    }));
    setSaved(false);
  }

  async function save() {
    if (!order) return;
    setSaving(true);
    const updatedItems: OrderItem[] = lineItems.map((l) => ({
      sku: l.sku,
      name: l.name,
      qty: l.editQty,
      unit_price_ex_vat: l.editPrice,
      total_price_ex_vat: l.lineTotal,
      brand: l.brand ?? "",
      note: l.editNote || undefined,
    }));
    await supabase.from("orders").update({
      items: updatedItems,
      total_ex_vat: totalEx || null,
      total_inc_vat: totalInc || null,
      estimated_delivery: deliveryText || null,
      internal_notes: footerNote || order.internal_notes,
    }).eq("id", orderId);
    setSaving(false);
    setSaved(true);
  }

  async function sendToCustomer() {
    if (!order) return;
    setSending(true);
    await fetch("https://buqfbcztspswezwyafxo.supabase.co/functions/v1/order-status-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_ref: docRef(orderId),
        contact_email: order.customer_email,
        contact_name: order.customer_name,
        status: "confirmed",
        total_inc_vat: totalInc,
        currency,
        estimated_delivery: deliveryText,
        oc_url: publicOcUrl,
      }),
    }).catch(console.error);
    await supabase.from("orders").update({ status: "confirmed" }).eq("id", orderId);
    setSending(false);
    setSent(true);
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="size-6 rounded-full border-2 border-info/30 border-t-info animate-spin" />
    </div>
  );
  if (!order) return <div className="container-page py-16 text-muted-foreground">Order hittades inte.</div>;

  const co = company ?? { name: "—", org: "", address: "", postal: "", email: "", phone: "", web: "", bankgiro: "", vat: "" };
  const today = new Date().toLocaleDateString("sv-SE");
  const publicOcUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${locale}/oc/${orderId}`
    : `/${locale}/oc/${orderId}`;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── Admin toolbar ─────────────────────────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-30 bg-card border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap">
        <a href={`/${locale}/admin/orders`} className="text-xs text-muted-foreground hover:text-foreground">← Orderhantering</a>
        {order.rfq_id && (
          <a href={`/${locale}/admin/rfq`} className="text-xs text-muted-foreground hover:text-foreground">← RFQ-lista</a>
        )}
        <span className="text-muted-foreground/40">|</span>
        <span className="text-sm font-semibold text-foreground">Orderbekräftelse {docRef(orderId)}</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded-md border border-border hover:border-info text-foreground hover:text-info transition disabled:opacity-50"
          >
            {saving ? "Sparar…" : saved ? "✓ Sparat" : "Spara"}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 text-sm rounded-md bg-info text-primary-foreground hover:opacity-90 transition"
          >
            🖨 Skriv ut / Spara PDF
          </button>
          <button
            onClick={sendToCustomer}
            disabled={sending || sent}
            className="px-4 py-1.5 text-sm rounded-md bg-[oklch(0.60_0.18_155)] text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {sent ? "✓ Bekräftelse skickad" : sending ? "Skickar…" : "📧 Skicka bekräftelse"}
          </button>
          <a
            href={publicOcUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-info hover:border-info transition"
            title="Öppna kundvy"
          >
            🔗 Kundlänk
          </a>
        </div>
      </div>

      {/* ── Document ──────────────────────────────────────────────────────── */}
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
                Orderbekräftelse
              </div>
              <div className="text-sm text-gray-600 mt-2 space-y-0.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                <div><span className="text-gray-400">Ref:</span> {docRef(orderId)}</div>
                <div><span className="text-gray-400">Datum:</span> {today}</div>
                {order.po_number && <div><span className="text-gray-400">Er ref (PO):</span> {order.po_number}</div>}
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="mb-8 p-4 bg-gray-50 rounded" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Kund</div>
            <div className="font-semibold text-gray-800">{order.customer_company ?? order.customer_name}</div>
            {order.customer_company && <div className="text-sm text-gray-600">Att: {order.customer_name}</div>}
            {order.customer_org_nr && <div className="text-sm text-gray-500">Org.nr {order.customer_org_nr}</div>}
            <div className="text-sm text-gray-500">{order.customer_email}</div>
          </div>

          {/* Admin delivery settings */}
          <div className="print:hidden mb-6 grid grid-cols-2 gap-3 p-4 bg-amber-50 border border-amber-200 rounded text-xs">
            <label className="block">
              <span className="text-gray-500 uppercase tracking-wide">Beräknad leverans</span>
              <input type="date" value={deliveryText} onChange={e => setDeliveryText(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="text-gray-500 uppercase tracking-wide">Betalningsvillkor</span>
              <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded px-2 py-1" />
            </label>
          </div>

          {/* Line items */}
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
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="py-2.5 pr-3 text-xs text-gray-500 font-mono">{it.sku}</td>
                  <td className="py-2.5 pr-3">
                    <div className="text-gray-800">{it.name}</div>
                    <div className="print:hidden mt-1">
                      <input value={it.editNote} onChange={e => setLine(i, "note", e.target.value)}
                        placeholder="Anteckning"
                        className="text-xs w-full border-b border-dashed border-gray-300 focus:outline-none bg-transparent text-gray-500" />
                    </div>
                    {it.editNote && <div className="hidden print:block text-xs text-gray-500 mt-0.5">{it.editNote}</div>}
                  </td>
                  <td className="py-2.5 text-right">
                    <input type="number" min={1} value={it.editQty} onChange={e => setLine(i, "qty", Number(e.target.value))}
                      className="print:hidden w-14 text-right border border-gray-200 rounded px-1 text-sm focus:outline-none focus:ring-1 focus:ring-info" />
                    <span className="hidden print:inline">{it.editQty}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <input type="number" min={0} step={1} value={it.editPrice} onChange={e => setLine(i, "price", Number(e.target.value))}
                      className="print:hidden w-24 text-right border border-gray-200 rounded px-1 text-sm focus:outline-none focus:ring-1 focus:ring-info" />
                    <span className="hidden print:inline">{fmt(it.editPrice, currency)}</span>
                  </td>
                  <td className="py-2.5 text-right font-medium text-gray-800">{fmt(it.lineTotal, currency)}</td>
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
              <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                className="print:hidden w-full border-b border-dashed border-gray-300 focus:outline-none bg-transparent" />
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-400 mb-1">Beräknad leverans</div>
              <div>{deliveryText ? new Date(deliveryText).toLocaleDateString("sv-SE") : "Meddelas"}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-400 mb-1">PO-nummer</div>
              <div>{order.po_number ?? "—"}</div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mb-8 text-xs text-gray-500" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="print:block hidden whitespace-pre-wrap">{footerNote}</div>
            <textarea value={footerNote} onChange={e => setFooterNote(e.target.value)}
              placeholder="Eventuella noteringar…" rows={3}
              className="print:hidden w-full border border-dashed border-gray-300 rounded p-2 text-xs focus:outline-none focus:border-info resize-none bg-transparent" />
          </div>

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

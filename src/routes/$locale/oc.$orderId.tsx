/**
 * /oc/:orderId — public read-only order confirmation for the customer.
 * No auth required. UUID is unguessable — safe to expose via emailed link.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCompanySettings, type CompanySettings } from "@/lib/company-settings";

export const Route = createFileRoute("/$locale/oc/$orderId")({
  component: PublicOCPage,
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
  currency: string;
  estimated_delivery: string | null;
  created_at: string;
};

const VAT = 0.25;

function fmt(n: number, currency = "SEK") {
  return n.toLocaleString("sv-SE", { style: "currency", currency, maximumFractionDigits: 0 });
}
function docRef(orderId: string) {
  return `OC-${orderId.slice(0, 8).toUpperCase()}`;
}

export default function PublicOCPage() {
  const { locale, orderId } = Route.useParams();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).single(),
      fetchCompanySettings(),
    ]).then(([{ data, error }, co]) => {
      setCompany(co);
      if (error || !data) { setNotFound(true); }
      else setOrder(data as unknown as Order);
      setLoading(false);
    });
  }, [orderId]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="size-6 rounded-full border-2 border-info/30 border-t-info animate-spin" />
    </div>
  );
  if (notFound || !order) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Orderbekräftelsen hittades inte. Kontakta oss om du fått en felaktig länk.
    </div>
  );

  const co = company ?? { name: "—", org: "", address: "", postal: "", email: "", phone: "", web: "", bankgiro: "", vat: "" };
  const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
  const currency = order.currency ?? "SEK";

  const lineItems = items.map(it => ({
    ...it,
    lineTotal: it.qty * it.unit_price_ex_vat,
  }));

  const totalEx  = lineItems.reduce((s, l) => s + l.lineTotal, 0);
  const vatAmt   = totalEx * VAT;
  const totalInc = totalEx + vatAmt;

  const issuedDate = new Date(order.created_at).toLocaleDateString(
    locale === "sv" ? "sv-SE" : locale === "de" ? "de-DE" : "en-GB"
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Print toolbar */}
      <div className="print:hidden sticky top-0 z-20 bg-card border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-foreground">
          Orderbekräftelse {docRef(orderId)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 text-sm rounded-md bg-info text-primary-foreground hover:opacity-90 transition"
          >
            🖨 Spara / Skriv ut PDF
          </button>
        </div>
      </div>

      {/* Document */}
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
                <div><span className="text-gray-400">Datum:</span> {issuedDate}</div>
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
                    {it.note && <div className="text-xs text-gray-500 mt-0.5">{it.note}</div>}
                  </td>
                  <td className="py-2.5 text-right text-gray-700">{it.qty}</td>
                  <td className="py-2.5 text-right text-gray-700">{fmt(it.unit_price_ex_vat, currency)}</td>
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
          <div className="border-t border-gray-200 pt-6 mb-6 grid grid-cols-2 gap-6 text-xs text-gray-600" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div>
              <div className="uppercase tracking-wider text-gray-400 mb-1">Beräknad leverans</div>
              <div>{order.estimated_delivery
                ? new Date(order.estimated_delivery).toLocaleDateString("sv-SE")
                : "Meddelas separat"}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-400 mb-1">PO-nummer</div>
              <div>{order.po_number ?? "—"}</div>
            </div>
          </div>

          {/* Footer / signature */}
          <div className="border-t border-gray-200 pt-6 flex justify-between text-xs text-gray-500" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div>
              <div className="font-semibold text-gray-700 mb-1">{co.name}</div>
              {co.email && <div>{co.email}</div>}
              {co.phone && <div>{co.phone}</div>}
              {co.web && <div>{co.web}</div>}
              {co.bankgiro && <div>Bankgiro: {co.bankgiro}</div>}
              {co.vat && <div>Momsreg.nr: {co.vat}</div>}
            </div>
            <div className="text-right text-gray-400 text-[11px] max-w-48">
              <p>Tack för din beställning!</p>
              <p className="mt-1">Vid frågor, kontakta oss via e-post eller telefon.</p>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </div>
  );
}

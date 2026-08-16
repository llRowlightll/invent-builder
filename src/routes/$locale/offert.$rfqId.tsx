/**
 * /offert/:rfqId  — public read-only quote view for the customer.
 * No auth required. Admin emails a link to this page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCompanySettings, type CompanySettings } from "@/lib/company-settings";

export const Route = createFileRoute("/$locale/offert/$rfqId")({
  component: PublicOffertPage,
});

type RfqItem = {
  id: string;
  qty: number | null;
  unit_price: number | null;
  note: string | null;
  product?: { sku: string; name: string } | null;
};

type Rfq = {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  company: string | null;
  org_number: string | null;
  po_number: string | null;
  status: string | null;
  quote_amount: number | null;
  quote_currency: string | null;
  discount_pct: number | null;
  created_at: string;
};

const VAT = 0.25;

function fmt(n: number, currency = "SEK") {
  return n.toLocaleString("sv-SE", { style: "currency", currency, maximumFractionDigits: 0 });
}

function docRef(id: string) {
  return `OE-${id.slice(0, 8).toUpperCase()}`;
}

export default function PublicOffertPage() {
  const { locale, rfqId } = Route.useParams();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [items, setItems] = useState<RfqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [poInput, setPoInput] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      // SECURITY: fetch quote + items by id via SECURITY DEFINER RPCs. Anon can
      // no longer SELECT rfqs/rfq_items directly (no enumeration of every quote).
      supabase.rpc("get_quote_by_id", { p_id: rfqId }),
      supabase.rpc("get_quote_items", { p_rfq_id: rfqId }),
      fetchCompanySettings(),
    ]).then(([{ data: r }, { data: i }, co]) => {
      setCompany(co);
      const rfqRow = Array.isArray(r) ? r[0] : null;
      if (rfqRow) setRfq(rfqRow as unknown as Rfq);
      setItems(((i as Record<string, unknown>[]) ?? []).map((d) => ({
        id: d.id as string,
        qty: d.qty as number | null,
        unit_price: d.unit_price as number | null,
        note: d.note as string | null,
        // RPC returns flat sku/name (joined to products) instead of nested object
        product: d.sku ? { sku: d.sku as string, name: d.name as string } : null,
      })));
      setLoading(false);
    });
  }, []);

  const lineItems = items.map(it => ({
    ...it,
    qty: it.qty ?? 1,
    price: it.unit_price ?? 0,
    lineTotal: (it.qty ?? 1) * (it.unit_price ?? 0),
  }));
  const totalEx  = lineItems.reduce((s, l) => s + l.lineTotal, 0);
  const discountPct = Number(rfq?.discount_pct ?? 0);
  const discountAmt = totalEx * (discountPct / 100);
  const netEx = totalEx - discountAmt;
  const vatAmt   = netEx * VAT;
  const totalInc = netEx + vatAmt;
  const currency = rfq?.quote_currency ?? "SEK";

  async function respond(decision: "accepted" | "rejected") {
    setAccepting(true);
    // SECURITY: respond via SECURITY DEFINER RPC. It only flips a quote that is
    // currently 'quoted' → accepted/rejected and validates the decision value,
    // so anon can no longer mass-update arbitrary quotes. On acceptance it also
    // creates the real order atomically and returns its id, so the customer
    // lands on an actual order confirmation instead of a "we'll follow up" promise.
    const { data } = await supabase.rpc("respond_to_quote", {
      p_id: rfqId,
      p_decision: decision,
      p_po: poInput.trim() || undefined,
    });
    const result = Array.isArray(data) ? data[0] : data;
    const newOrderId = (result as { order_id?: string } | null)?.order_id ?? null;
    if (newOrderId) setOrderId(newOrderId);
    // Fire notification email — order-status-email re-reads the rfq's real
    // status/amount/order by id, so it reflects what respond_to_quote() actually
    // did rather than trusting `decision` (which might not match, e.g. if the
    // quote had already been responded to and the RPC's update was a no-op).
    await fetch("https://buqfbcztspswezwyafxo.supabase.co/functions/v1/order-status-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rfqId, kind: "rfq", locale }),
    }).catch(console.error);
    setAccepting(false);
    if (decision === "accepted") setAccepted(true);
    else setDeclined(true);
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="size-6 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
    </div>
  );

  if (!rfq || !lineItems.length) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 text-sm">
      Offerten hittades inte eller har inga rader.
    </div>
  );

  const co = company ?? { name: "Maskinval AB", org: "", address: "", postal: "", email: "info@maskinval.se", phone: "", web: "", bankgiro: "", vat: "" };
  const today = new Date(rfq.created_at).toLocaleDateString("sv-SE");
  const alreadyAnswered = rfq.status === "accepted" || rfq.status === "rejected" || accepted || declined;

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="mx-auto max-w-3xl bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="px-12 py-10" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>

          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <div className="text-2xl font-bold" style={{ fontFamily: "system-ui, sans-serif" }}>{co.name}</div>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                {(co.address || co.postal) && <div>{co.address}{co.postal ? `, ${co.postal}` : ""}</div>}
                <div>{co.email}{co.email && co.phone ? " · " : ""}{co.phone}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-light tracking-widest uppercase text-gray-300" style={{ fontFamily: "system-ui, sans-serif" }}>Offert</div>
              <div className="text-sm text-gray-600 mt-2 space-y-0.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                <div><span className="text-gray-400">Ref:</span> {docRef(rfqId)}</div>
                <div><span className="text-gray-400">Datum:</span> {today}</div>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="mb-8 p-4 bg-gray-50 rounded" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Till</div>
            <div className="font-semibold text-gray-800">{rfq.company ?? rfq.contact_name}</div>
            {rfq.company && rfq.contact_name && <div className="text-sm text-gray-600">Att: {rfq.contact_name}</div>}
            {rfq.org_number && <div className="text-sm text-gray-500">Org.nr {rfq.org_number}</div>}
            {rfq.contact_email && <div className="text-sm text-gray-500">{rfq.contact_email}</div>}
            {rfq.po_number && <div className="text-sm text-gray-600 mt-1">Er ref (PO): <span className="font-medium">{rfq.po_number}</span></div>}
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
                <tr key={it.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="py-2.5 pr-3 text-xs text-gray-500 font-mono">{it.product?.sku ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <div className="text-gray-800">{it.product?.name ?? "—"}</div>
                    {it.note && <div className="text-xs text-gray-500 mt-0.5">{it.note}</div>}
                  </td>
                  <td className="py-2.5 text-right">{it.qty}</td>
                  <td className="py-2.5 text-right">{fmt(it.price, currency)}</td>
                  <td className="py-2.5 text-right font-medium text-gray-800">{fmt(it.lineTotal, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-10" style={{ fontFamily: "system-ui, sans-serif" }}>
            <table className="text-sm w-64">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-500">Summa ex. moms</td>
                  <td className="py-1 text-right font-medium text-gray-800">{fmt(totalEx, currency)}</td>
                </tr>
                {discountPct > 0 && (
                  <tr>
                    <td className="py-1 text-emerald-700">Intro-rabatt −{discountPct} %</td>
                    <td className="py-1 text-right text-emerald-700">−{fmt(discountAmt, currency)}</td>
                  </tr>
                )}
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

          {/* Accept / decline */}
          {accepted || rfq.status === "accepted" ? (
            <div className="rounded-xl border border-green-300 bg-green-50 p-6 text-center space-y-3">
              <div className="text-2xl">✅</div>
              <p className="font-semibold text-green-800">Beställning bekräftad</p>
              {orderId ? (
                <>
                  <p className="text-sm text-green-700">Din order är skapad. Orderbekräftelsen skickas även till din e-post.</p>
                  <a
                    href={`/${locale}/oc/${orderId}`}
                    className="inline-block mt-1 px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition"
                  >
                    Visa orderbekräftelse →
                  </a>
                </>
              ) : (
                <p className="text-sm text-green-700">Orderbekräftelsen skickas till din e-post.</p>
              )}
            </div>
          ) : declined || rfq.status === "rejected" ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center space-y-2">
              <div className="text-2xl">✕</div>
              <p className="font-semibold text-gray-700">Offert avböjd</p>
              <p className="text-sm text-gray-500">
                Kontakta oss på{" "}
                <a href={`mailto:${co.email}`} className="underline">{co.email}</a>{" "}
                om du har frågor.
              </p>
            </div>
          ) : (
            <div className="border-t border-gray-200 pt-8 space-y-5" style={{ fontFamily: "system-ui, sans-serif" }}>
              {/* PO input — customer can enter/confirm their PO number before accepting */}
              <div className="max-w-xs">
                <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Ert PO-nummer (valfritt)
                </label>
                <input
                  type="text"
                  value={poInput || rfq.po_number || ""}
                  onChange={e => setPoInput(e.target.value)}
                  placeholder="t.ex. PO-2024-001"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
                />
              </div>
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">Vill du acceptera denna offert?</p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => respond("accepted")}
                    disabled={accepting || alreadyAnswered}
                    className="px-8 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:opacity-50"
                  >
                    ✓ Ja, acceptera offert
                  </button>
                  <button
                    onClick={() => respond("rejected")}
                    disabled={accepting || alreadyAnswered}
                    className="px-8 py-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Avböj
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Har du frågor? <a href={`mailto:${co.email}`} className="underline">{co.email}</a>
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

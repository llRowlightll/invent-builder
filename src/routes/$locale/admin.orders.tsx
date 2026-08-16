import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard } from "@/lib/auth-context";

export const Route = createFileRoute("/$locale/admin/orders")({
  component: AdminOrdersPage,
});

const STATUS_OPTIONS = ["new","confirmed","picking","shipped","delivered","invoiced","paid","cancelled"];
const PAYMENT_OPTIONS = ["unpaid","paid","overdue","refunded"];

const STATUS_LABELS: Record<string,string> = {
  new:"Ny", confirmed:"Bekräftad", picking:"Plockas", shipped:"Skickad",
  delivered:"Levererad", invoiced:"Fakturerad", paid:"Betald", cancelled:"Avbruten",
};
const PAYMENT_LABELS: Record<string,string> = {
  unpaid:"Obetald", paid:"Betald", overdue:"Förfallen", refunded:"Återbetalad",
};

interface OrderRow {
  id: string;
  customer_name: string;
  customer_company: string | null;
  customer_email: string;
  customer_org_nr: string | null;
  po_number: string | null;
  status: string;
  items: unknown[];
  total_ex_vat: number | null;
  total_inc_vat: number | null;
  currency: string;
  estimated_delivery: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  tracking_number: string | null;
  carrier: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  invoice_date: string | null;
  invoice_due_date: string | null;
  fortnox_invoice_id: string | null;
  payment_status: string;
  paid_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

function statusColor(s: string) {
  const m: Record<string,string> = {
    new:"bg-blue-100 text-blue-700", confirmed:"bg-emerald-100 text-emerald-700",
    picking:"bg-yellow-100 text-yellow-700", shipped:"bg-purple-100 text-purple-700",
    delivered:"bg-green-100 text-green-700", invoiced:"bg-orange-100 text-orange-700",
    paid:"bg-green-200 text-green-800", cancelled:"bg-red-100 text-red-700",
  };
  return m[s] ?? "bg-muted text-muted-foreground";
}
function payColor(s: string) {
  if (s === "paid") return "bg-green-100 text-green-700";
  if (s === "overdue") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700";
}

function OrderEditModal({ order, onClose, onSaved }: { order: OrderRow; onClose: () => void; onSaved: (o: OrderRow) => void }) {
  const [form, setForm] = useState({
    status: order.status,
    payment_status: order.payment_status,
    po_number: order.po_number ?? "",
    estimated_delivery: order.estimated_delivery ?? "",
    tracking_number: order.tracking_number ?? "",
    carrier: order.carrier ?? "",
    invoice_number: order.invoice_number ?? "",
    invoice_url: order.invoice_url ?? "",
    invoice_date: order.invoice_date ?? "",
    invoice_due_date: order.invoice_due_date ?? "",
    fortnox_invoice_id: order.fortnox_invoice_id ?? "",
    internal_notes: order.internal_notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const patch = {
      status: form.status,
      payment_status: form.payment_status,
      po_number: form.po_number || null,
      estimated_delivery: form.estimated_delivery || null,
      tracking_number: form.tracking_number || null,
      carrier: form.carrier || null,
      invoice_number: form.invoice_number || null,
      invoice_url: form.invoice_url || null,
      invoice_date: form.invoice_date || null,
      invoice_due_date: form.invoice_due_date || null,
      fortnox_invoice_id: form.fortnox_invoice_id || null,
      internal_notes: form.internal_notes || null,
      paid_at: form.payment_status === "paid" && !order.paid_at ? new Date().toISOString() : order.paid_at,
      shipped_at: form.status === "shipped" && !order.shipped_at ? new Date().toISOString() : order.shipped_at,
      delivered_at: form.status === "delivered" && !order.delivered_at ? new Date().toISOString() : order.delivered_at,
    };
    const { data } = await supabase.from("orders").update(patch).eq("id", order.id).select().single();
    if (data) onSaved(data as OrderRow);

    // Skicka statusmejl till kunden om status ändrats. The order row above is
    // already saved, so order-status-email re-reads the current status/amounts/
    // tracking straight from the DB by id — it no longer trusts a client payload.
    const statusChanged = form.status !== order.status || form.payment_status !== order.payment_status;
    const notifyStatuses = ["confirmed","picking","shipped","delivered","invoiced","paid","cancelled"];
    if (statusChanged && notifyStatuses.includes(form.status)) {
      fetch("https://buqfbcztspswezwyafxo.supabase.co/functions/v1/order-status-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, kind: "order" }),
      }).catch(console.error);
    }

    setSaving(false);
    onClose();
  }

  function field(label: string, key: keyof typeof form, type = "text") {
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-foreground text-lg">Redigera order</h2>
            <p className="text-xs text-muted-foreground">#{order.id.slice(0,8).toUpperCase()} · {order.customer_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>

        <div className="space-y-4">
          {/* Status selects */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Orderstatus</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Betalstatus</label>
              <select value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
                {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{PAYMENT_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          {field("PO-nummer (kundens)", "po_number")}
          {field("Beräknad leverans", "estimated_delivery", "date")}
          {field("Spårningsnummer", "tracking_number")}
          {field("Transportör (t.ex. DHL, PostNord)", "carrier")}

          <hr className="border-border" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Faktura</p>
          {field("Fakturanummer", "invoice_number")}
          {field("Faktura-URL (PDF-länk)", "invoice_url")}
          {field("Fakturadatum", "invoice_date", "date")}
          {field("Förfallodatum", "invoice_due_date", "date")}
          {field("Fortnox faktura-ID", "fortnox_invoice_id")}

          <hr className="border-border" />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Interna anteckningar</label>
            <textarea value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
              rows={3} className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition">Avbryt</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50">
            {saving ? "Sparar..." : "Spara ändringar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminOrdersPage() {
  const { locale } = Route.useParams();
  const { isAdmin, authLoading } = useAdminGuard();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OrderRow | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (authLoading) return; // vänta tills auth är klar innan redirect-beslut
    if (!isAdmin) { navigate({ to: "/$locale/login", params: { locale } }); return; }
    supabase.from("orders").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data as OrderRow[]) ?? []); setLoading(false); });
  }, [isAdmin, authLoading]);

  const filtered = filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus);
  const fmt = (n: number | null) => n ? n.toLocaleString("sv-SE", { style:"currency", currency:"SEK", maximumFractionDigits:0 }) : "—";

  return (
    <div className="container-page py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Orderhantering</h1>
          <p className="text-sm text-muted-foreground">{orders.length} ordrar totalt</p>
        </div>
        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {["all", ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 text-xs rounded-full border transition ${
                filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              {s === "all" ? "Alla" : STATUS_LABELS[s]}
              {s !== "all" && <span className="ml-1 opacity-70">({orders.filter(o=>o.status===s).length})</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-muted rounded-lg animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          {filterStatus === "all" ? "Inga ordrar ännu." : `Inga ordrar med status "${STATUS_LABELS[filterStatus]}".`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Order ID","Kund","PO-nr","Artiklar","Totalt","Status","Betalning","Leverans",""].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-primary">
                    #{order.id.slice(0,8).toUpperCase()}
                    <div className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString("sv-SE")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{order.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{order.customer_company ?? order.customer_email}</div>
                    {order.customer_org_nr && <div className="text-xs text-muted-foreground">org: {order.customer_org_nr}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{order.po_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{Array.isArray(order.items) ? order.items.length : 0} art.</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{fmt(order.total_inc_vat ?? order.total_ex_vat)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(order.status)}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payColor(order.payment_status)}`}>
                      {PAYMENT_LABELS[order.payment_status] ?? order.payment_status}
                    </span>
                    {order.invoice_due_date && order.payment_status !== "paid" && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Förfaller {new Date(order.invoice_due_date).toLocaleDateString("sv-SE")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString("sv-SE", { month:"short", day:"numeric" }) : "—"}
                    {order.tracking_number && <div className="font-mono text-[10px]">{order.tracking_number}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditing(order)}
                        className="px-3 py-1 text-xs rounded-md border border-border hover:border-primary text-muted-foreground hover:text-foreground transition">
                        Redigera
                      </button>
                      <a
                        href={`/${locale}/admin/orderbekraftelse/${order.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 text-xs rounded-md border border-[oklch(0.72_0.12_290)] text-[oklch(0.50_0.18_290)] hover:bg-[oklch(0.97_0.02_290)] transition"
                        title="Öppna orderbekräftelse (OC)"
                      >
                        OC
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <OrderEditModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))}
        />
      )}
    </div>
  );
}

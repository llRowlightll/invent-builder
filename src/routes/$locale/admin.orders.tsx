import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
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

/** En rad i en inköpsorder, med leverantörens svar när det kommit. */
interface SupplierPoLine {
  id: string;
  line_no: number;
  sku: string;
  supplier_sku: string | null;
  name: string;
  qty: number;
  unit_purchase_price: number | null;
  status: string;
  ack_qty: number | null;
  ack_unit_price: number | null;
  ack_delivery_date: string | null;
  /** gron | gul | rod. Null tills leverantören svarat. */
  ack_status: string | null;
  ack_reason: string | null;
  ack_substitute_sku: string | null;
}

/** En inköpsorder till EN leverantör för EN kundorder. Kunden ser den aldrig. */
interface SupplierPoRow {
  id: string;
  po_number: string | null;
  order_id: string;
  supplier_id: string | null;
  status: string;
  total_purchase_ex_vat: number | null;
  expected_delivery: string | null;
  needs_review: boolean;
  review_reason: string | null;
  antal_rader: number;
  leverantor: string;
  rader: SupplierPoLine[];
}

const NIVA_ETIKETT: Record<string, { text: string; klass: string }> = {
  gron: { text: "Bekräftad",        klass: "bg-[oklch(0.95_0.05_155)] text-[oklch(0.40_0.15_155)]" },
  gul:  { text: "Mindre avvikelse", klass: "bg-[oklch(0.96_0.06_85)]  text-[oklch(0.45_0.15_75)]" },
  rod:  { text: "Kräver beslut",    klass: "bg-[oklch(0.95_0.05_25)]  text-[oklch(0.45_0.18_25)]" },
};

/**
 * Vad chippen ska säga om raden.
 *
 * ack_status är AVVIKELSENS nivå och ändrar sig aldrig -- avvikelsen var röd,
 * och det förblir sant. Men radens TILLSTÅND ändrar sig: när någon godkänt den
 * ska det inte längre stå "Kräver beslut" bredvid ordet "godkänd". Det såg jag
 * först när jag tittade på vyn.
 */
function radetikett(niva: string | null, status: string): { text: string; klass: string } | null {
  if (status === "approved") return { text: "Avvikelse godkänd", klass: "bg-muted text-muted-foreground" };
  if (status === "cancelled") return { text: "Avbeställd", klass: "bg-muted text-muted-foreground" };
  return niva ? (NIVA_ETIKETT[niva] ?? { text: niva, klass: "bg-muted text-muted-foreground" }) : null;
}

/** Leverantörens möjliga svar per rad — §5:s lista, i den ordning de är vanliga. */
const SVARSVAL: Array<[string, string]> = [
  ["accepted", "Accepterad"],
  ["backordered", "Restnoterad"],
  ["discontinued", "Utgången"],
  ["rejected", "Avvisad"],
  ["question", "Leverantören har en fråga"],
];

interface OrderRow {
  id: string;
  /** MV-2026-00124. Null för ordrar skapade innan numren infördes. */
  order_number: string | null;
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function today(): string {
  return new Date().toISOString().split("T")[0];
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
            <p className="text-xs text-muted-foreground">{order.order_number ?? `#${order.id.slice(0,8).toUpperCase()}`} · {order.customer_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>

        <div className="space-y-4">
          {/* Status selects */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Orderstatus</label>
              <select value={form.status} onChange={e => {
                const status = e.target.value;
                setForm(f => {
                  // Start the 30-day payment clock the moment goods are marked
                  // delivered, so admin doesn't have to remember to fill this
                  // in separately. Never overwrites an already-set date.
                  const invoice_date = status === "delivered" && !f.invoice_date ? today() : f.invoice_date;
                  const invoice_due_date = invoice_date && !f.invoice_due_date ? addDays(invoice_date, 30) : f.invoice_due_date;
                  return { ...f, status, invoice_date, invoice_due_date };
                });
              }}
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
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Fakturadatum</label>
            <input type="date" value={form.invoice_date} onChange={e => {
              const invoice_date = e.target.value;
              setForm(f => ({
                ...f,
                invoice_date,
                // 30 dagars betalningsvillkor — föreslå automatiskt, men rör
                // aldrig ett datum admin redan satt själv.
                invoice_due_date: invoice_date && !f.invoice_due_date ? addDays(invoice_date, 30) : f.invoice_due_date,
              }));
            }}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          {field("Förfallodatum (30 dagar från fakturadatum)", "invoice_due_date", "date")}
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

/**
 * Registrera leverantörens svar, rad för rad.
 *
 * Formuläret FÖRIFYLLS med det vi beställde, inte med tomma fält: det vanliga
 * svaret är "ja, precis som ni skrev", och då ska administratören inte behöva
 * skriva av sin egen order. Avvikelsen är det som ska kosta arbete.
 *
 * Klassningen görs i databasen, aldrig här. Skulle den ligga i formuläret
 * kunde två vägar in i systemet (manuell registrering i dag, tolkad e-post i
 * FAS 2) bedöma samma svar olika.
 */
function AckModal({ spo, onClose, onSaved }: {
  spo: SupplierPoRow;
  onClose: () => void;
  onSaved: (sammanfattning: string) => void;
}) {
  const [referens, setReferens] = useState("");
  const [notering, setNotering] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [rader, setRader] = useState(() =>
    spo.rader.map(l => ({
      spoi_id: l.id,
      etikett: `${l.line_no}. ${l.sku}`,
      namn: l.name,
      bestallt: l.qty,
      response: "accepted",
      qty: String(l.qty),
      unit_price: l.unit_purchase_price != null ? String(l.unit_purchase_price) : "",
      delivery_date: spo.expected_delivery ?? "",
      substitute_sku: "",
      note: "",
    })),
  );

  function satt(i: number, falt: string, varde: string) {
    setRader(prev => prev.map((r, n) => (n === i ? { ...r, [falt]: varde } : r)));
  }

  async function spara() {
    setSparar(true); setFel(null);
    const { data, error } = await supabase.rpc("register_supplier_ack", {
      p_spo_id: spo.id,
      p_lines: rader.map(r => ({
        spoi_id: r.spoi_id,
        response: r.response,
        qty: r.qty === "" ? null : Number(r.qty),
        unit_price: r.unit_price === "" ? null : Number(r.unit_price),
        delivery_date: r.delivery_date || null,
        substitute_sku: r.substitute_sku || null,
        note: r.note || null,
      })),
      p_source: "manual",
      // Argumenten har default null i databasen, och de genererade typerna
      // beskriver dem som VALFRIA -- inte som nullbara. Utelämna hellre.
      ...(referens.trim() ? { p_supplier_reference: referens.trim() } : {}),
      ...(notering.trim() ? { p_note: notering.trim() } : {}),
    });
    setSparar(false);
    if (error) { setFel(error.message); return; }
    const rad = Array.isArray(data) ? data[0] : data;
    onSaved(rad
      ? `${spo.po_number}: ${rad.antal_gron} bekräftade, ${rad.antal_gul} med mindre avvikelse, ${rad.antal_rod} kräver beslut.`
      : `${spo.po_number}: svaret registrerat.`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-background rounded-xl border border-border w-full max-w-4xl my-8">
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold">Leverantörens svar — {spo.po_number}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {spo.leverantor}. Fyll i det leverantören faktiskt bekräftat; avvikelser klassas automatiskt.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-xs text-muted-foreground">Leverantörens ordernummer</span>
              <input value={referens} onChange={e => setReferens(e.target.value)}
                placeholder="t.ex. 4711-2026"
                className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-background text-sm" />
            </label>
            <label className="text-sm">
              <span className="text-xs text-muted-foreground">Intern notering</span>
              <input value={notering} onChange={e => setNotering(e.target.value)}
                placeholder="hur svaret kom in"
                className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-background text-sm" />
            </label>
          </div>

          <div className="space-y-3">
            {rader.map((r, i) => (
              <div key={r.spoi_id} className="rounded-lg border border-border p-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-mono text-xs">{r.etikett}</span>
                  <span className="text-xs text-muted-foreground truncate">{r.namn}</span>
                  <span className="text-xs text-muted-foreground ml-auto">beställt {r.bestallt}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <label className="text-xs">
                    <span className="text-muted-foreground">Svar</span>
                    <select value={r.response} onChange={e => satt(i, "response", e.target.value)}
                      className="mt-1 w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm">
                      {SVARSVAL.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="text-muted-foreground">Antal</span>
                    <input type="number" min={0} value={r.qty} onChange={e => satt(i, "qty", e.target.value)}
                      className="mt-1 w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="text-muted-foreground">À-pris</span>
                    <input type="number" step="0.01" value={r.unit_price} onChange={e => satt(i, "unit_price", e.target.value)}
                      className="mt-1 w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="text-muted-foreground">Leverans</span>
                    <input type="date" value={r.delivery_date} onChange={e => satt(i, "delivery_date", e.target.value)}
                      className="mt-1 w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="text-muted-foreground">Ersättning</span>
                    <input value={r.substitute_sku} onChange={e => satt(i, "substitute_sku", e.target.value)}
                      placeholder="artikelnr"
                      className="mt-1 w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm" />
                  </label>
                </div>
                <input value={r.note} onChange={e => satt(i, "note", e.target.value)}
                  placeholder="leverantörens egen text (intern)"
                  className="mt-2 w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs" />
              </div>
            ))}
          </div>

          {fel && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {fel}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition">
            Avbryt
          </button>
          <button onClick={spara} disabled={sparar}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50">
            {sparar ? "Registrerar…" : "Registrera svaret"}
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
  // Inköpsordrarna per kundorder. Laddas i en fråga, inte en per rad.
  const [spos, setSpos] = useState<Record<string, SupplierPoRow[]>>({});
  const [oppen, setOppen] = useState<string | null>(null);
  const [skapar, setSkapar] = useState<string | null>(null);
  const [spoFel, setSpoFel] = useState<string | null>(null);
  const [arbetar, setArbetar] = useState<string | null>(null);
  const [spoOk, setSpoOk] = useState<string | null>(null);
  const [ackFor, setAckFor] = useState<SupplierPoRow | null>(null);

  useEffect(() => {
    if (authLoading) return; // vänta tills auth är klar innan redirect-beslut
    if (!isAdmin) { navigate({ to: "/$locale/login", params: { locale } }); return; }
    supabase.from("orders").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data as OrderRow[]) ?? []); setLoading(false); });
    laddaInkopsordrar();
  }, [isAdmin, authLoading]);

  async function laddaInkopsordrar() {
    const { data, error } = await supabase
      .from("supplier_purchase_orders")
      .select("id, po_number, order_id, supplier_id, status, total_purchase_ex_vat, expected_delivery, needs_review, review_reason, suppliers(name), supplier_purchase_order_items(id, line_no, sku, supplier_sku, name, qty, unit_purchase_price, status, ack_qty, ack_unit_price, ack_delivery_date, ack_status, ack_reason, ack_substitute_sku)")
      .order("po_number", { ascending: true });
    if (error) { setSpoFel(error.message); return; }
    const per: Record<string, SupplierPoRow[]> = {};
    for (const rad of (data ?? []) as Record<string, unknown>[]) {
      const r: SupplierPoRow = {
        id: rad.id as string,
        po_number: rad.po_number as string | null,
        order_id: rad.order_id as string,
        supplier_id: rad.supplier_id as string | null,
        status: rad.status as string,
        total_purchase_ex_vat: rad.total_purchase_ex_vat as number | null,
        expected_delivery: rad.expected_delivery as string | null,
        needs_review: Boolean(rad.needs_review),
        review_reason: rad.review_reason as string | null,
        antal_rader: ((rad.supplier_purchase_order_items as unknown[]) ?? []).length,
        leverantor: (rad.suppliers as { name?: string } | null)?.name ?? "Okänd leverantör",
        rader: (((rad.supplier_purchase_order_items as SupplierPoLine[]) ?? [])
          .slice()
          .sort((a, b) => a.line_no - b.line_no)),
      };
      (per[r.order_id] ??= []).push(r);
    }
    setSpos(per);
  }

  /**
   * Grupperar kundorderns rader per leverantör och skapar en inköpsorder per
   * leverantör. Funktionen är idempotent, så ett andra klick är ofarligt --
   * men felet måste synas: en tyst miss här betyder att ingen beställer något.
   */
  async function skapaInkopsordrar(orderId: string) {
    setSkapar(orderId);
    setSpoFel(null);
    const { error } = await supabase.rpc("create_supplier_pos", { p_order_id: orderId });
    if (error) setSpoFel(error.message);
    else { await laddaInkopsordrar(); setOppen(orderId); }
    setSkapar(null);
  }

  const PO_ENDPOINT = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/supplier-po";

  /**
   * Anropar supplier-po med den inloggades token. Funktionen kräver admin --
   * den läser ALDRIG innehåll ur anropet, bara spo_id, så en manipulerad
   * begäran kan inte mejla något annat än den verkliga inköpsordern till den
   * adress som står på leverantören.
   */
  async function anropaPo(spoId: string, kropp: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(PO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ spo_id: spoId, ...kropp }),
    });
  }

  async function forhandsgranska(spoId: string) {
    setArbetar(spoId); setSpoFel(null); setSpoOk(null);
    try {
      const svar = await anropaPo(spoId, { action: "preview" });
      if (!svar.ok) { setSpoFel(`PDF:en kunde inte skapas: ${await svar.text()}`); return; }
      // En ny flik kan inte bära Authorization-huvudet, så PDF:en hämtas här
      // och öppnas som en blob i stället.
      const url = URL.createObjectURL(await svar.blob());
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally { setArbetar(null); }
  }

  /**
   * Skickar inköpsordern. Servern avgör om den FÅR skickas; klienten frågar
   * bara användaren när svaret säger att varningarna kan bekräftas. Ordningen
   * är viktig: regeln ligger i funktionen, inte i den här knappen.
   */
  async function skickaPo(spoId: string, skickaOm = false) {
    setArbetar(spoId); setSpoFel(null); setSpoOk(null);
    try {
      let svar = await anropaPo(spoId, { action: "send", skicka_om: skickaOm });
      let data = await svar.json();

      if (!svar.ok && data?.kan_bekraftas) {
        const varningar = (data.varningar ?? []).join("\n• ");
        if (!window.confirm(`Skicka ändå?\n\n• ${varningar}\n\nMejlet går till leverantören och går inte att ta tillbaka.`)) return;
        svar = await anropaPo(spoId, { action: "send", skicka_om: skickaOm, bekrafta_varningar: true });
        data = await svar.json();
      }

      if (!svar.ok || !data?.ok) { setSpoFel(data?.skal ?? data?.fel ?? `Utskicket misslyckades (${svar.status}).`); return; }
      setSpoOk(`${data.po_number} skickad till ${data.skickad_till}.`);
      await laddaInkopsordrar();
    } finally { setArbetar(null); }
  }

  /**
   * Människans beslut om en stoppad rad. Funktionen i databasen vägrar om
   * raden inte är stoppad, så knappen kan inte råka godkänna något som redan
   * gått vidare.
   */
  async function beslutaOmRad(spoiId: string, beslut: "approve" | "cancel") {
    if (beslut === "cancel" && !window.confirm("Avbeställ raden? Kundens orderrad markeras som avbruten.")) return;
    setArbetar(spoiId); setSpoFel(null); setSpoOk(null);
    const { error } = await supabase.rpc("godkann_avvikelse", { p_spoi_id: spoiId, p_beslut: beslut });
    if (error) setSpoFel(error.message);
    else { setSpoOk(beslut === "approve" ? "Raden godkänd." : "Raden avbeställd."); await laddaInkopsordrar(); }
    setArbetar(null);
  }

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

      {spoOk && (
        <div className="mb-4 rounded-lg border border-[oklch(0.72_0.12_155)] bg-[oklch(0.97_0.03_155)] px-4 py-3 text-sm text-[oklch(0.40_0.15_155)]">
          {spoOk}
        </div>
      )}

      {spoFel && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Inköpsordrarna kunde inte hämtas eller skapas: {spoFel}
        </div>
      )}

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
                {["Order ID","Kund","PO-nr","Artiklar","Totalt","Status","Betalning","Leverans","Leverantörsorder",""].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(order => (
              <Fragment key={order.id}>
                <tr className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-primary">
                    {/* Ordernumret är kundens referens i telefon och mejl.
                        Fallbacken finns för ordrar som skapades innan
                        numren infördes. */}
                    {order.order_number ?? `#${order.id.slice(0,8).toUpperCase()}`}
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(spos[order.id] ?? []).length === 0 ? (
                      <button
                        onClick={() => skapaInkopsordrar(order.id)}
                        disabled={skapar === order.id}
                        className="px-2.5 py-1 text-xs rounded-md border border-border hover:border-primary text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                        title="Gruppera orderraderna per leverantör och skapa en inköpsorder per leverantör"
                      >
                        {skapar === order.id ? "Skapar…" : "Skapa"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setOppen(oppen === order.id ? null : order.id)}
                        className="px-2.5 py-1 text-xs rounded-md border border-border hover:border-primary transition"
                      >
                        {(spos[order.id] ?? []).length} st
                        {(spos[order.id] ?? []).some(r => r.needs_review) && (
                          <span className="ml-1 text-[oklch(0.55_0.18_50)]" title="Behöver granskas">●</span>
                        )}
                      </button>
                    )}
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
                {oppen === order.id && (spos[order.id] ?? []).length > 0 && (
                  <tr className="bg-muted/20">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Inköpsordrar för {order.order_number ?? order.id.slice(0,8)}
                      </div>
                      <div className="space-y-1.5">
                        {(spos[order.id] ?? []).map(spo => (
                          <div key={spo.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-background px-3 py-2">
                            <span className="font-mono text-xs text-primary">{spo.po_number ?? "—"}</span>
                            <span className="text-sm font-medium">{spo.leverantor}</span>
                            <span className="text-xs text-muted-foreground">{spo.antal_rader} rader</span>
                            <span className="text-xs text-muted-foreground">
                              {/* Inköpspris: bara admin ser den här vyn, och tabellen är
                                  admin-only i databasen också. */}
                              {spo.total_purchase_ex_vat != null ? fmt(spo.total_purchase_ex_vat) + " ink.pris" : "inget inköpspris"}
                            </span>
                            {spo.expected_delivery && (
                              <span className="text-xs text-muted-foreground">
                                ber. {new Date(spo.expected_delivery).toLocaleDateString("sv-SE", { month:"short", day:"numeric" })}
                              </span>
                            )}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{spo.status}</span>
                            {spo.needs_review && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.95_0.05_50)] text-[oklch(0.45_0.18_50)]">
                                granska: {spo.review_reason ?? "okänt"}
                              </span>
                            )}
                            <div className="ml-auto flex gap-1.5">
                              <button
                                onClick={() => setAckFor(spo)}
                                disabled={spo.rader.length === 0}
                                className="px-2.5 py-1 text-xs rounded-md border border-border hover:border-primary transition disabled:opacity-50"
                                title="Registrera leverantörens svar per rad"
                              >
                                Registrera svar
                              </button>
                              <button
                                onClick={() => forhandsgranska(spo.id)}
                                disabled={arbetar === spo.id}
                                className="px-2.5 py-1 text-xs rounded-md border border-border hover:border-primary transition disabled:opacity-50"
                              >
                                PDF
                              </button>
                              <button
                                onClick={() => skickaPo(spo.id, spo.status === "sent")}
                                disabled={arbetar === spo.id}
                                className="px-2.5 py-1 text-xs rounded-md border border-info text-info hover:bg-info/10 transition disabled:opacity-50"
                                title="Mejlar inköpsordern som PDF till leverantörens beställningsadress"
                              >
                                {arbetar === spo.id ? "…" : spo.status === "sent" ? "Skicka om" : "Skicka"}
                              </button>
                            </div>

                            {spo.rader.some(l => l.ack_status) && (
                              <div className="w-full mt-2 space-y-1">
                                {spo.rader.map(l => (
                                  <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs border-t border-border pt-1.5">
                                    <span className="font-mono text-[10px] text-muted-foreground w-6">{l.line_no}</span>
                                    <span className="font-mono text-[11px]">{l.sku}</span>
                                    <span className="text-muted-foreground">
                                      {l.ack_qty ?? l.qty} st
                                      {l.ack_qty != null && l.ack_qty !== l.qty && <span className="text-destructive"> (beställt {l.qty})</span>}
                                    </span>
                                    {l.ack_delivery_date && (
                                      <span className="text-muted-foreground">
                                        {new Date(l.ack_delivery_date).toLocaleDateString("sv-SE", { month: "short", day: "numeric" })}
                                      </span>
                                    )}
                                    {(() => {
                                      const e = radetikett(l.ack_status, l.status);
                                      return e ? <span className={`px-2 py-0.5 rounded-full ${e.klass}`}>{e.text}</span> : null;
                                    })()}
                                    {l.ack_reason && <span className="text-muted-foreground flex-1 min-w-[12rem]">{l.ack_reason}</span>}
                                    {l.status === "blocked" && (
                                      <span className="flex gap-1.5">
                                        <button
                                          onClick={() => beslutaOmRad(l.id, "approve")}
                                          disabled={arbetar === l.id}
                                          className="px-2 py-0.5 rounded border border-[oklch(0.72_0.12_155)] text-[oklch(0.40_0.15_155)] hover:bg-[oklch(0.97_0.03_155)] transition disabled:opacity-50"
                                        >
                                          Godkänn
                                        </button>
                                        <button
                                          onClick={() => beslutaOmRad(l.id, "cancel")}
                                          disabled={arbetar === l.id}
                                          className="px-2 py-0.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                                        >
                                          Avbeställ
                                        </button>
                                      </span>
                                    )}

                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {(spos[order.id] ?? []).some(r => r.rader.some(l => l.ack_status)) && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Leverantörens egna formuleringar är interna. Kunden ser status och datum, inte texten.
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ackFor && (
        <AckModal
          spo={ackFor}
          onClose={() => setAckFor(null)}
          onSaved={async (sammanfattning) => {
            setAckFor(null);
            setSpoOk(sammanfattning);
            await laddaInkopsordrar();
          }}
        />
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

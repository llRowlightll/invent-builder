import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/admin/rfq")({
  component: AdminRfqPage,
});

type RfqItem = {
  id: string;
  product_id: string | null;
  qty: number | null;
  role: string | null;
  product?: { sku: string; name: string } | null;
};

type Rfq = {
  id: string;
  user_id: string;
  status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  message: string | null;
  internal_notes: string | null;
  quote_amount: number | null;
  quote_currency: string | null;
  created_at: string;
  updated_at: string | null;
  title: string | null;
  hubspot_deal_id: string | null;
  fortnox_order_id: string | null;
  items?: RfqItem[];
};

const STATUSES = [
  { key: "new",        label: "Ny",               dot: "bg-info",                       text: "text-info" },
  { key: "processing", label: "Under behandling",  dot: "bg-[oklch(0.72_0.18_80)]",      text: "text-[oklch(0.72_0.18_80)]" },
  { key: "quoted",     label: "Offert skickad",    dot: "bg-[oklch(0.60_0.18_290)]",     text: "text-[oklch(0.60_0.18_290)]" },
  { key: "accepted",   label: "Accepterad",        dot: "bg-[oklch(0.60_0.18_155)]",     text: "text-[oklch(0.60_0.18_155)]" },
  { key: "rejected",   label: "Avvisad",           dot: "bg-destructive",                text: "text-destructive" },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

export default function AdminRfqPage() {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Rfq | null>(null);
  const [items, setItems] = useState<RfqItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null); // stores status that triggered email
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Edit fields for selected
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editQuote, setEditQuote] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("rfqs")
      .select("*")
      .order("created_at", { ascending: false });
    setRfqs((data as Rfq[]) ?? []);
    setLoading(false);
  }

  async function openRfq(rfq: Rfq) {
    setSelected(rfq);
    setEditStatus(rfq.status ?? "new");
    setEditNotes(rfq.internal_notes ?? "");
    setEditQuote(rfq.quote_amount?.toString() ?? "");
    setEmailSent(null);

    // Load items with product info
    const { data } = await supabase
      .from("rfq_items")
      .select("id, rfq_id, product_id, qty, role, products(sku, name)")
      .eq("rfq_id", rfq.id);
    setItems((data ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      rfq_id: d.rfq_id as string,
      product_id: d.product_id as string | null,
      qty: d.qty as number | null,
      role: d.role as string | null,
      product: d.products as { sku: string; name: string } | null,
    })));
  }

  // Statuses that trigger a customer notification email
  const EMAIL_STATUSES = ["quoted", "accepted", "rejected"];

  async function save() {
    if (!selected) return;
    setSaving(true);

    const previousStatus = selected.status ?? "new";

    const { data, error } = await supabase
      .from("rfqs")
      .update({
        status: editStatus,
        internal_notes: editNotes || null,
        quote_amount: editQuote ? Number(editQuote) : null,
        quote_currency: "SEK",
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id)
      .select()
      .single();

    if (!error && data) {
      setRfqs((prev) => prev.map((r) => r.id === selected.id ? data as Rfq : r));
      setSelected(data as Rfq);

      // Fire customer email when status transitions to a notification-worthy status
      const statusChanged = editStatus !== previousStatus;
      if (statusChanged && EMAIL_STATUSES.includes(editStatus) && selected.contact_email) {
        const orderRef = selected.id.slice(0, 8).toUpperCase();
        fetch(
          "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/order-status-email",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_ref: orderRef,
              contact_email: selected.contact_email,
              contact_name: selected.contact_name ?? "",
              status: editStatus,
              quote_amount: editQuote ? Number(editQuote) : null,
            }),
          }
        )
          .then((r) => { if (r.ok) setEmailSent(editStatus); })
          .catch(console.error);
      }
    }

    setSaving(false);
  }

  const filtered = rfqs.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (search) {
      const hay = [r.contact_name, r.company, r.contact_email, r.title].join(" ").toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="container-page py-8 max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">RFQ / Orderhantering</h1>
      <p className="text-sm text-muted-foreground mb-6">{rfqs.length} totalt · {rfqs.filter((r) => r.status === "new").length} ohanterade</p>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[{ key: "all", label: "Alla" }, ...STATUSES].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filterStatus === s.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-info hover:text-foreground"
            }`}
          >
            {s.label}
            {s.key !== "all" && (
              <span className="ml-1 opacity-60">
                ({rfqs.filter((r) => r.status === s.key).length})
              </span>
            )}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök företag, namn, e-post…"
          className="ml-auto text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-info"
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* RFQ list */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          {loading && (
            <div className="p-6 text-sm text-muted-foreground animate-pulse">Laddar…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">Inga RFQs matchar filtret</div>
          )}
          <div className="divide-y divide-border max-h-[75vh] overflow-y-auto">
            {filtered.map((r) => {
              const meta = STATUS_MAP[r.status ?? "new"] ?? STATUS_MAP.new;
              const isSelected = selected?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => openRfq(r)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 transition ${
                    isSelected ? "bg-info/10" : "hover:bg-surface-alt"
                  }`}
                >
                  <span className={`mt-1.5 size-2 rounded-full shrink-0 ${meta.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.company ?? r.contact_name ?? "Okänd"}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.contact_email}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString("sv-SE")}
                      {r.quote_amount && ` · ${r.quote_amount.toLocaleString("sv-SE")} kr`}
                    </div>
                  </div>
                  <span className={`text-[10px] shrink-0 ${meta.text}`}>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground h-full flex items-center justify-center">
              Välj en RFQ i listan
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-surface-alt/40">
                <h2 className="font-semibold">{selected.company ?? selected.contact_name ?? "Okänd kund"}</h2>
                <p className="text-xs text-muted-foreground">{selected.id.slice(0, 8)}… · {new Date(selected.created_at).toLocaleString("sv-SE")}</p>
              </div>

              <div className="p-5 space-y-5">
                {/* Contact info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Namn" value={selected.contact_name} />
                  <Field label="E-post" value={selected.contact_email} link={`mailto:${selected.contact_email}`} />
                  <Field label="Telefon" value={selected.contact_phone} />
                  <Field label="Företag" value={selected.company} />
                  <Field label="HubSpot Deal" value={selected.hubspot_deal_id} />
                  <Field label="Fortnox Order" value={selected.fortnox_order_id} />
                </div>

                {selected.message && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Meddelande</div>
                    <p className="text-sm bg-surface-alt rounded-md p-3 text-foreground/80">{selected.message}</p>
                  </div>
                )}

                {/* Items */}
                {items.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Produkter ({items.length})</div>
                    <div className="rounded-md border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-surface-alt">
                          <tr>
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium">SKU</th>
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium">Produkt</th>
                            <th className="text-right px-3 py-2 text-muted-foreground font-medium">Qty</th>
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium">Roll</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {items.map((item) => (
                            <tr key={item.id} className="hover:bg-surface-alt/50">
                              <td className="px-3 py-2 font-mono text-[10px]">{item.product?.sku ?? "—"}</td>
                              <td className="px-3 py-2 truncate max-w-[160px]">{item.product?.name ?? "Okänd produkt"}</td>
                              <td className="px-3 py-2 text-right font-medium">{item.qty ?? 1}</td>
                              <td className="px-3 py-2 text-muted-foreground">{item.role ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Edit section */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hantera RFQ</div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-info"
                    >
                      {STATUSES.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Offertbelopp (SEK)</label>
                    <input
                      type="number"
                      value={editQuote}
                      onChange={(e) => setEditQuote(e.target.value)}
                      placeholder="0"
                      className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-info"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Interna noteringar</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      placeholder="Anteckningar, nästa steg…"
                      className="w-full text-sm rounded-md border border-border bg-card px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-info resize-none"
                    />
                  </div>

                  <button
                    onClick={save}
                    disabled={saving}
                    className="w-full text-sm font-medium px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {saving ? "Sparar…" : "Spara ändringar"}
                  </button>

                  {emailSent && (
                    <div className="flex items-center gap-2 text-xs text-[oklch(0.60_0.18_155)] bg-[oklch(0.60_0.18_155)]/10 rounded-md px-3 py-2">
                      <span>✓</span>
                      <span>
                        E-post skickad till <strong>{selected.contact_email}</strong>
                        {" "}(status: {STATUS_MAP[emailSent]?.label ?? emailSent})
                      </span>
                    </div>
                  )}

                  {/* Send quote email */}
                  {selected.contact_email && (
                    <a
                      href={buildQuoteMailto(selected, items, editQuote)}
                      className="block w-full text-center text-sm font-medium px-4 py-2 rounded-md border border-border hover:border-info hover:text-info transition"
                    >
                      ✉ Skicka offert via e-post
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildQuoteMailto(rfq: Rfq, items: RfqItem[], quoteAmount: string): string {
  const name = rfq.contact_name ?? rfq.company ?? "Kund";
  const amount = quoteAmount ? `${Number(quoteAmount).toLocaleString("sv-SE")} SEK` : "se bifogad offert";
  const productLines = items.length > 0
    ? items.map(i => `  • ${i.product?.sku ?? "—"} × ${i.qty ?? 1}  ${i.product?.name ?? ""}`).join("\n")
    : "  (inga produktrader)";

  const body = [
    `Hej ${name},`,
    "",
    `Tack för din offertförfrågan (ref: ${rfq.id.slice(0, 8).toUpperCase()}).`,
    "",
    "Vi har granskat dina önskemål och kan erbjuda följande:",
    "",
    `Offertbelopp: ${amount}`,
    "",
    "Ingående produkter:",
    productLines,
    "",
    rfq.message ? `Din förfrågan: "${rfq.message.slice(0, 200)}"` : "",
    "",
    "Betalningsvillkor: 30 dagar netto",
    "Leveranstid: se respektive produkt",
    "",
    "Har du frågor är du välkommen att kontakta oss.",
    "",
    "Med vänliga hälsningar",
    "Maskinval",
    "info@maskinval.se",
  ].filter(l => l !== undefined).join("\n");

  return `mailto:${rfq.contact_email}?subject=${encodeURIComponent(`Offert från Maskinval — ref ${rfq.id.slice(0, 8).toUpperCase()}`)}&body=${encodeURIComponent(body)}`;
}

function Field({ label, value, link }: { label: string; value: string | null | undefined; link?: string }) {
  if (!value) return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-muted-foreground/40 text-sm">—</div>
    </div>
  );
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {link ? (
        <a href={link} className="text-sm text-info hover:underline break-all">{value}</a>
      ) : (
        <div className="text-sm text-foreground break-all">{value}</div>
      )}
    </div>
  );
}

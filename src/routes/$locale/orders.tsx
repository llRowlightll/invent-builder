import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/orders")({
  head: () => ({
    meta: [
      { title: "Mina ordrar — Maskinval" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdersPage,
});

interface RfqRow {
  id: string;
  status: string | null;
  title: string | null;
  contact_name: string | null;
  company: string | null;
  message: string | null;
  quote_amount: number | null;
  quote_currency: string | null;
  created_at: string;
}

const RFQ_STATUS_META: Record<string, { dot: string; text: string; label: string }> = {
  new:        { dot: "bg-info",                       text: "text-info",                        label: "Mottagen" },
  processing: { dot: "bg-[oklch(0.72_0.18_80)]",     text: "text-[oklch(0.55_0.18_80)]",       label: "Under behandling" },
  quoted:     { dot: "bg-[oklch(0.60_0.18_290)]",    text: "text-[oklch(0.60_0.18_290)]",      label: "Offert skickad" },
  accepted:   { dot: "bg-[oklch(0.60_0.18_155)]",    text: "text-[oklch(0.60_0.18_155)]",      label: "Accepterad" },
  rejected:   { dot: "bg-destructive",               text: "text-destructive",                 label: "Avvisad" },
};

interface OrderItem {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
  total_price_ex_vat: number;
  brand: string;
}

interface OrderRow {
  id: string;
  customer_name: string;
  customer_company: string | null;
  customer_email: string;
  po_number: string | null;
  status: string;
  items: OrderItem[];
  total_ex_vat: number | null;
  total_inc_vat: number | null;
  currency: string;
  estimated_delivery: string | null;
  tracking_number: string | null;
  carrier: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  invoice_due_date: string | null;
  payment_status: string;
  created_at: string;
}

const STATUS_STEPS = ["new","confirmed","picking","shipped","delivered","invoiced","paid"];

// Same carrier-tracking-URL logic already used on rfq.$rfqId.tsx — kept in
// sync there since the two pages source tracking info from different tables
// (orders vs rfqs) but should link the same way.
function trackingUrl(carrier: string | null, trackingNumber: string, locale: string) {
  if (carrier?.toLowerCase().includes("postnord")) {
    return `https://tracking.postnord.com/?id=${trackingNumber}&lang=${locale === "sv" ? "sv" : "en"}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? ""} tracking ${trackingNumber}`)}`;
}

function paymentLabel(status: string, t: (k: string) => string) {
  const map: Record<string,string> = {
    unpaid: t("ordersPage.paymentUnpaid"),
    paid: t("ordersPage.paymentPaid"),
    overdue: t("ordersPage.paymentOverdue"),
  };
  return map[status] ?? status;
}

function StatusBar({ status }: { status: string }) {
  const idx = STATUS_STEPS.indexOf(status);
  if (status === "cancelled") return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
      ✕ Avbruten
    </span>
  );
  return (
    <div className="flex items-center gap-0.5 mt-2">
      {STATUS_STEPS.map((_, i) => (
        <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i <= idx ? "bg-primary" : "bg-border"}`} />
      ))}
      <span className="ml-2 text-xs font-medium text-foreground capitalize">{STATUS_STEPS[idx] ?? status}</span>
    </div>
  );
}

function OrderCard({ order, t, locale }: { order: OrderRow; t: (k: string) => string; locale: Locale }) {
  const [expanded, setExpanded] = useState(false);
  const items = Array.isArray(order.items) ? order.items : [];
  const locStr = locale === "sv" ? "sv-SE" : locale;
  const fmt = (n: number) => n.toLocaleString(locStr, { style: "currency", currency: order.currency || "SEK", maximumFractionDigits: 0 });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-foreground">
                {t("ordersPage.orderRef")} #{order.id.slice(0,8).toUpperCase()}
              </span>
              {order.po_number && (
                <span className="text-xs px-2 py-0.5 bg-muted rounded font-mono">PO: {order.po_number}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(order.created_at).toLocaleDateString(locStr, { year:"numeric", month:"long", day:"numeric" })}
              {" · "}{items.length} {t("ordersPage.items")}
            </p>
            <StatusBar status={order.status} />
          </div>
          <div className="text-right shrink-0">
            {order.total_inc_vat ? (
              <>
                <div className="font-semibold text-foreground">{fmt(order.total_inc_vat)}</div>
                <div className="text-xs text-muted-foreground">{t("ordersPage.totalIncVat")}</div>
              </>
            ) : order.total_ex_vat ? (
              <>
                <div className="font-semibold text-foreground">{fmt(order.total_ex_vat)}</div>
                <div className="text-xs text-muted-foreground">{t("ordersPage.totalExVat")}</div>
              </>
            ) : null}
            <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
              order.payment_status === "paid" ? "bg-green-100 text-green-700" :
              order.payment_status === "overdue" ? "bg-red-100 text-red-700" :
              "bg-yellow-100 text-yellow-700"
            }`}>
              {paymentLabel(order.payment_status, t)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {order.estimated_delivery && (
            <span>📦 {t("ordersPage.deliveryDate")}: <strong className="text-foreground">
              {new Date(order.estimated_delivery).toLocaleDateString(locStr, { month:"short", day:"numeric" })}
            </strong></span>
          )}
          {order.tracking_number && (
            <span>🚚 {t("ordersPage.tracking")}:{" "}
              <a
                href={trackingUrl(order.carrier, order.tracking_number, locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-semibold text-info hover:opacity-80"
              >
                {order.tracking_number}
              </a>
              {order.carrier ? ` (${order.carrier})` : ""}
            </span>
          )}
          {order.invoice_number && (
            <span>🧾 {t("ordersPage.invoiceNumber")}: <strong className="text-foreground">{order.invoice_number}</strong>
              {order.invoice_due_date && <> · Förfaller {new Date(order.invoice_due_date).toLocaleDateString(locStr, { month:"short", day:"numeric" })}</>}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {order.invoice_url && (
            <a href={order.invoice_url} target="_blank" rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary text-foreground hover:text-primary transition">
              📄 {t("ordersPage.invoiceDownload")}
            </a>
          )}
          <button onClick={() => setExpanded(v => !v)}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary text-muted-foreground hover:text-foreground transition">
            {expanded ? "▲ Dölj" : `▼ Artiklar (${items.length})`}
          </button>
          <Link
            to="/$locale/claims"
            params={{ locale }}
            search={{ order: order.id }}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-destructive text-muted-foreground hover:text-destructive transition"
          >
            ⚠ {locale === "sv" ? "Reklamera" : "File a claim"}
          </Link>
        </div>
      </div>

      {expanded && items.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-5 py-4 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-muted-foreground shrink-0">{item.qty}×</span>
                <div className="min-w-0">
                  <Link
                    to="/$locale/product/$sku"
                    params={{ locale, sku: item.sku } as never}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {item.sku}
                  </Link>
                  <span className="ml-2 text-foreground truncate">{item.name}</span>
                </div>
              </div>
              {item.total_price_ex_vat > 0 && (
                <span className="shrink-0 text-muted-foreground text-xs">{fmt(item.total_price_ex_vat)}</span>
              )}
            </div>
          ))}
          {order.total_ex_vat && (
            <div className="pt-3 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground">{t("ordersPage.totalExVat")}</span>
              <span className="font-semibold">{fmt(order.total_ex_vat)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrdersPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "rfqs">("orders");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("rfqs")
        .select("id,status,title,contact_name,company,message,quote_amount,quote_currency,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]).then(([{ data: ordData }, { data: rfqData }]) => {
      setOrders((ordData as unknown as OrderRow[]) ?? []);
      setRfqs((rfqData as unknown as RfqRow[]) ?? []);
      // Default to RFQ tab if no orders but there are RFQs
      if ((!ordData || ordData.length === 0) && rfqData && rfqData.length > 0) {
        setTab("rfqs");
      }
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-muted-foreground mb-4">{t("projects.notLoggedIn")}</p>
        <Link to="/$locale/login" params={{ locale }}
          className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          {t("auth.submitLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-10 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">{t("ordersPage.myOrders")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("ordersPage.pageSubtitle")}</p>
      </div>

      {/* Page-level nav tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {[
          { to: "/$locale/projects", label: t("projects.title") },
          { to: "/$locale/orders",   label: t("ordersPage.myOrders") },
          { to: "/$locale/profile",  label: t("profilePage.title") },
        ].map(navTab => (
          <Link key={navTab.to} to={navTab.to as never} params={{ locale } as never}
            className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
            activeProps={{ className:"border-primary text-foreground" }}
            inactiveProps={{ className:"border-transparent text-muted-foreground hover:text-foreground" }}>
            {navTab.label}
          </Link>
        ))}
      </div>

      {/* Sub-tabs: Orders vs RFQs */}
      <div className="flex gap-3 mb-6">
        {(["orders", "rfqs"] as const).map((t2) => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`text-sm px-4 py-1.5 rounded-full border transition font-medium ${
              tab === t2
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-info hover:text-foreground"
            }`}
          >
            {t2 === "orders"
              ? `${t("ordersPage.myOrders")} ${orders.length > 0 ? `(${orders.length})` : ""}`
              : `${locale === "sv" ? "Förfrågningar" : "Requests"} ${rfqs.length > 0 ? `(${rfqs.length})` : ""}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : tab === "orders" ? (
        orders.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-muted-foreground text-sm">{t("ordersPage.noOrders")}</p>
            <Link to="/$locale/machine-builder" params={{ locale }}
              className="mt-4 inline-block text-sm text-primary hover:underline">
              ✦ {t("nav.machineBuilder")} →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <OrderCard key={order.id} order={order} t={t as (k: string) => string} locale={locale} />
            ))}
          </div>
        )
      ) : (
        /* RFQ tab */
        rfqs.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
            <div className="text-4xl mb-3">📥</div>
            <p className="text-muted-foreground text-sm">
              {locale === "sv" ? "Inga förfrågningar ännu." : "No requests yet."}
            </p>
            <Link to="/$locale/shopping-list" params={{ locale }}
              className="mt-4 inline-block text-sm text-info hover:underline">
              {locale === "sv" ? "Skapa offertförfrågan →" : "Create a quote request →"}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rfqs.map(rfq => {
              const meta = RFQ_STATUS_META[rfq.status ?? "new"] ?? RFQ_STATUS_META.new;
              const locStr = locale === "sv" ? "sv-SE" : locale;
              return (
                <Link
                  key={rfq.id}
                  to="/$locale/rfq/$rfqId"
                  params={{ locale, rfqId: rfq.id }}
                  className={`flex items-start gap-4 bg-card rounded-xl p-5 hover:border-info transition group border ${
                    rfq.status === "quoted"
                      ? "border-[oklch(0.75_0.10_55)] bg-[oklch(0.99_0.02_55)]"
                      : "border-border"
                  }`}
                >
                  <span className={`mt-1 size-2.5 rounded-full shrink-0 ${meta.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="font-semibold text-foreground group-hover:text-info transition">
                        {rfq.title ?? `${locale === "sv" ? "Förfrågan" : "Request"} #${rfq.id.slice(0,8).toUpperCase()}`}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(rfq.created_at).toLocaleDateString(locStr, { year:"numeric", month:"short", day:"numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className={`text-xs font-medium ${meta.text}`}>
                        {meta.label}
                      </span>
                      {rfq.quote_amount && (
                        <span className="text-xs text-muted-foreground">
                          {locale === "sv" ? "Offert:" : "Quote:"}{" "}
                          <strong className="text-foreground">
                            {rfq.quote_amount.toLocaleString(locStr, { style:"currency", currency: rfq.quote_currency ?? "SEK", maximumFractionDigits:0 })}
                          </strong>
                        </span>
                      )}
                      {rfq.status === "quoted" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[oklch(0.94_0.06_55)] text-[oklch(0.42_0.14_55)] border border-[oklch(0.82_0.10_55)] font-semibold animate-pulse">
                          {locale === "sv" ? "⚡ Svar krävs" : "⚡ Action required"}
                        </span>
                      )}
                      {!rfq.quote_amount && rfq.message && (
                        <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                          &quot;{rfq.message.slice(0, 80)}{rfq.message.length > 80 ? "…" : ""}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-info text-sm shrink-0 transition">→</span>
                </Link>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

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

function OrderCard({ order, t, locale }: { order: OrderRow; t: (k: string) => string; locale: string }) {
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
            <span>🚚 {t("ordersPage.tracking")}: <strong className="text-foreground font-mono">{order.tracking_number}</strong>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data as OrderRow[]) ?? []); setLoading(false); });
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

      <div className="flex gap-1 mb-8 border-b border-border">
        {[
          { to: "/$locale/projects", label: t("projects.title") },
          { to: "/$locale/orders",   label: t("ordersPage.myOrders") },
          { to: "/$locale/profile",  label: t("profilePage.title") },
        ].map(tab => (
          <Link key={tab.to} to={tab.to as never} params={{ locale } as never}
            className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
            activeProps={{ className:"border-primary text-foreground" }}
            inactiveProps={{ className:"border-transparent text-muted-foreground hover:text-foreground" }}>
            {tab.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
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
            <OrderCard key={order.id} order={order} t={t} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

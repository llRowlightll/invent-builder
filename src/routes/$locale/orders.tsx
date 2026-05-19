import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/orders")({
  head: ({ params }) => ({
    meta: [{ title: `${makeT(params.locale as Locale)("nav.orders")} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: OrdersPage,
});

interface RfqRow {
  id: string;
  status: string;
  title: string | null;
  company: string | null;
  contact_name: string | null;
  bom_id: string | null;
  created_at: string;
  shipment_status: string | null;
}
interface BomRow { id: string; mode: string; order_code: string | null; total_items: number | null; created_at: string }

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  processing: "bg-yellow-100 text-yellow-700 border-yellow-200",
  quoted: "bg-purple-100 text-purple-700 border-purple-200",
  accepted: "bg-teal-100 text-teal-700 border-teal-200",
  shipped: "bg-orange-100 text-orange-700 border-orange-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
};

function statusKey(status: string): string {
  const map: Record<string, string> = {
    new: "ordersPage.statusNew",
    processing: "ordersPage.statusProcessing",
    quoted: "ordersPage.statusQuoted",
    accepted: "ordersPage.statusAccepted",
    shipped: "ordersPage.statusShipped",
    delivered: "ordersPage.statusDelivered",
  };
  return map[status] ?? status;
}

function OrdersPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [boms, setBoms] = useState<BomRow[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/$locale/login", params: { locale } });
  }, [user, loading, navigate, locale]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: r }, { data: b }] = await Promise.all([
        supabase
          .from("rfqs")
          .select("id,status,title,company,contact_name,bom_id,created_at,shipment_status")
          .order("created_at", { ascending: false }),
        supabase
          .from("boms")
          .select("id,mode,order_code,total_items,created_at")
          .order("created_at", { ascending: false }),
      ]);
      setRfqs((r as RfqRow[]) ?? []);
      setBoms((b as BomRow[]) ?? []);
    })();
  }, [user]);

  if (loading || !user)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="container-page py-10 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("ordersPage.pageTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("ordersPage.pageSubtitle")}</p>
      </div>

      {/* RFQ section */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <span className="inline-flex items-center justify-center size-6 rounded bg-info/15 text-info text-xs font-bold">{rfqs.length}</span>
          {t("ordersPage.myRfqs")}
        </h2>
        {rfqs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("ordersPage.noRfqs")}</p>
            <Link
              to="/$locale/machine-builder"
              params={{ locale }}
              className="mt-3 inline-block text-xs px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90"
            >
              {t("nav.machineBuilder")} →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {rfqs.map((r) => {
              const effectiveStatus = r.shipment_status ?? r.status;
              const colorClass = STATUS_COLORS[effectiveStatus] ?? "bg-surface-alt text-muted-foreground border-border";
              return (
                <li key={r.id}>
                  <Link
                    to="/$locale/rfq/$rfqId"
                    params={{ locale, rfqId: r.id }}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-info transition group"
                  >
                    {/* Status badge */}
                    <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border ${colorClass}`}>
                      {t(statusKey(effectiveStatus))}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.title ?? `${t("ordersPage.rfqRef")} ${r.id.slice(0, 8).toUpperCase()}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {r.company ?? r.contact_name ?? "—"} · {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Ref + arrow */}
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-[10px] text-muted-foreground">{r.id.slice(0, 8).toUpperCase()}</div>
                      <div className="text-xs text-muted-foreground/50 group-hover:text-info transition mt-0.5">{t("ordersPage.viewDetails")}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* BOMs section */}
      {boms.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <span className="inline-flex items-center justify-center size-6 rounded bg-surface-alt text-muted-foreground text-xs font-bold">{boms.length}</span>
            {t("ordersPage.myBoms")}
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {boms.map((b) => (
              <li key={b.id}>
                <Link
                  to="/$locale/bom/$bomId"
                  params={{ locale, bomId: b.id }}
                  className="block rounded-xl border border-border bg-card p-4 hover:border-info transition"
                >
                  <div className="font-mono text-xs text-info">{b.order_code ?? b.id.slice(0, 8).toUpperCase()}</div>
                  <div className="text-sm font-medium mt-1">{b.mode}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {b.total_items} {t("ordersPage.items")} · {new Date(b.created_at).toLocaleDateString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

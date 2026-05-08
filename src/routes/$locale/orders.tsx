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
  bom_id: string | null;
  created_at: string;
}
interface BomRow { id: string; mode: string; order_code: string | null; total_items: number | null; created_at: string }

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
        supabase.from("rfqs").select("id,status,bom_id,created_at").order("created_at", { ascending: false }),
        supabase.from("boms").select("id,mode,order_code,total_items,created_at").order("created_at", { ascending: false }),
      ]);
      setRfqs((r as RfqRow[]) ?? []);
      setBoms((b as BomRow[]) ?? []);
    })();
  }, [user]);

  if (loading || !user)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="container-page py-10 grid lg:grid-cols-2 gap-8">
      <section>
        <h1 className="text-xl font-semibold mb-4">My BOMs</h1>
        {boms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No BOMs yet.</p>
        ) : (
          <ul className="space-y-2">
            {boms.map((b) => (
              <li key={b.id}>
                <Link
                  to="/$locale/bom/$bomId"
                  params={{ locale, bomId: b.id }}
                  className="block rounded-md border border-border bg-card p-3 hover:border-gold/60"
                >
                  <div className="font-mono text-xs">{b.order_code ?? b.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.mode} · {b.total_items} items · {new Date(b.created_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h1 className="text-xl font-semibold mb-4">My RFQs</h1>
        {rfqs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No RFQs yet.</p>
        ) : (
          <ul className="space-y-2">
            {rfqs.map((r) => (
              <li key={r.id}>
                <Link
                  to="/$locale/rfq/$rfqId"
                  params={{ locale, rfqId: r.id }}
                  className="block rounded-md border border-border bg-card p-3 hover:border-gold/60"
                >
                  <div className="text-sm">RFQ {r.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.status} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

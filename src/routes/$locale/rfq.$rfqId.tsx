import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/rfq/$rfqId")({
  head: ({ params }) => ({
    meta: [{ title: `RFQ ${params.rfqId.slice(0, 8)} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: RfqPage,
});

interface RfqRow {
  id: string;
  status: string;
  contact_email: string | null;
  message: string | null;
  created_at: string;
  bom_id: string | null;
}
interface ItemRow { role: string | null; qty: number; product_id: string | null }

function RfqPage() {
  const { locale, rfqId } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [rfq, setRfq] = useState<RfqRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/$locale/login", params: { locale } });
  }, [user, loading, navigate, locale]);

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("rfqs").select("*").eq("id", rfqId).single();
      const { data: it } = await supabase
        .from("rfq_items")
        .select("role,qty,product_id")
        .eq("rfq_id", rfqId);
      setRfq(r as RfqRow);
      setItems(it ?? []);
    })();
  }, [rfqId]);

  if (loading || !user || !rfq)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="container-page py-10 max-w-3xl">
      <Link to="/$locale/orders" params={{ locale }} className="text-xs underline text-muted-foreground">
        ← {t("nav.orders")}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">RFQ created</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Status: <span className="font-medium">{rfq.status}</span> · {new Date(rfq.created_at).toLocaleString()}
      </p>
      <div className="mt-6 rounded-md border border-border bg-card p-4 text-sm space-y-2">
        <div><span className="text-muted-foreground">Contact:</span> {rfq.contact_email}</div>
        <div><span className="text-muted-foreground">BOM:</span>{" "}
          {rfq.bom_id && (
            <Link to="/$locale/bom/$bomId" params={{ locale, bomId: rfq.bom_id }} className="underline">
              {rfq.bom_id.slice(0, 8)}…
            </Link>
          )}
        </div>
        <div><span className="text-muted-foreground">Items:</span> {items.length}</div>
        <div><span className="text-muted-foreground">Message:</span> {rfq.message}</div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Notification webhook fired to /api/public/notify/rfq.
      </p>
    </div>
  );
}

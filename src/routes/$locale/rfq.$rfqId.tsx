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
  shipment_status: string | null;
  carrier: string | null;
  tracking_number: string | null;
  label_url: string | null;
  shipped_at: string | null;
  estimated_delivery: string | null;
}
interface ItemRow { role: string | null; qty: number | null; product_id: string | null }

function RfqPage() {
  const { locale, rfqId } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [rfq, setRfq] = useState<RfqRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<string | null>(null);

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
      setRfq(r as unknown as RfqRow);
      setItems(it ?? []);
    })();
  }, [rfqId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setRole(data?.role ?? null);
    })();
  }, [user]);

  async function bookShipment() {
    if (!rfq) return;
    setBookingLoading(true);
    setBookingResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/book-shipment`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rfq_id: rfq.id }),
      });
      const json = await res.json().catch(() => ({}));
      setBookingResult(res.ok ? "Frakt bokad!" : `Fel: ${JSON.stringify(json)}`);
      if (res.ok) {
        // Refresh rfq to get updated shipment_status
        const { data: r } = await supabase.from("rfqs").select("*").eq("id", rfq.id).single();
        if (r) setRfq(r as unknown as RfqRow);
      }
    } catch (err) {
      setBookingResult(`Fel: ${err}`);
    }
    setBookingLoading(false);
  }

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

      <div className="mt-8 rounded-md border border-border bg-card p-4 text-sm space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">Frakt & Leverans</h2>
        <div>
          <span className="text-muted-foreground">Status: </span>
          <span className="font-medium capitalize">{rfq.shipment_status ?? "pending"}</span>
        </div>
        {rfq.carrier && (
          <div><span className="text-muted-foreground">Transportör: </span>{rfq.carrier}</div>
        )}
        {rfq.tracking_number && (
          <div>
            <span className="text-muted-foreground">Spårningsnummer: </span>
            <a
              href={`https://tracking.postnord.com/?id=${rfq.tracking_number}&lang=sv`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-info"
            >
              {rfq.tracking_number}
            </a>
          </div>
        )}
        {rfq.label_url && (
          <div>
            <a href={rfq.label_url} target="_blank" rel="noopener noreferrer" className="underline text-info">
              Ladda ner fraktsedel
            </a>
          </div>
        )}
        {rfq.shipped_at && (
          <div><span className="text-muted-foreground">Skickad: </span>{new Date(rfq.shipped_at).toLocaleString("sv-SE")}</div>
        )}
        {rfq.estimated_delivery && (
          <div><span className="text-muted-foreground">Estimerad leverans: </span>{new Date(rfq.estimated_delivery).toLocaleDateString("sv-SE")}</div>
        )}
        {role === "admin" && (
          <div className="pt-2 border-t border-border">
            <button
              onClick={bookShipment}
              disabled={bookingLoading}
              className="px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {bookingLoading ? "Bokar…" : "Boka frakt"}
            </button>
            {bookingResult && (
              <p className={`mt-2 text-sm ${bookingResult.startsWith("Frakt") ? "text-[oklch(0.55_0.15_155)]" : "text-destructive"}`}>
                {bookingResult}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

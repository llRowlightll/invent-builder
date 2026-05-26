import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth, useIsAdmin } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";

export const Route = createFileRoute("/$locale/rfq/$rfqId")({
  head: ({ params }) => ({
    meta: [{ title: `RFQ ${params.rfqId.slice(0, 8).toUpperCase()} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: RfqPage,
});

interface RfqRow {
  id: string;
  status: string;
  title: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  message: string | null;
  quote_amount: number | null;
  quote_currency: string | null;
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

const STATUS_STEPS = ["new", "processing", "quoted", "accepted", "shipped", "delivered"];

function statusLabel(t: ReturnType<typeof makeT>, s: string) {
  const map: Record<string, string> = {
    new: t("rfqPage.statusNew"),
    processing: t("rfqPage.statusProcessing"),
    quoted: t("rfqPage.statusQuoted"),
    accepted: t("rfqPage.statusAccepted"),
    shipped: t("rfqPage.statusShipped"),
    delivered: t("rfqPage.statusDelivered"),
  };
  return map[s] ?? s;
}

function RfqPage() {
  const { locale, rfqId } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [rfq, setRfq] = useState<RfqRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const isAdmin = useIsAdmin();
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/$locale/login", params: { locale } });
  }, [user, loading, navigate, locale]);

  useEffect(() => {
    (async () => {
      const [cat, { data: r }, { data: it }] = await Promise.all([
        loadCatalog(),
        supabase.from("rfqs").select("*").eq("id", rfqId).single(),
        supabase.from("rfq_items").select("role,qty,product_id").eq("rfq_id", rfqId),
      ]);
      setCatalog(cat);
      setRfq(r as unknown as RfqRow);
      setItems(it ?? []);
    })();
  }, [rfqId]);

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
      setBookingResult(res.ok ? t("rfqPage.statusShipped") + "!" : `Fel: ${JSON.stringify(json)}`);
      if (res.ok) {
        const { data: r } = await supabase.from("rfqs").select("*").eq("id", rfq.id).single();
        if (r) setRfq(r as unknown as RfqRow);
      }
    } catch (err) {
      setBookingResult(`Fel: ${err}`);
    }
    setBookingLoading(false);
  }

  async function acceptQuote(decision: "accepted" | "rejected") {
    if (!rfq) return;
    setAccepting(true);
    setAcceptError(null);
    const { error } = await supabase.from("rfqs").update({ status: decision }).eq("id", rfq.id);
    if (error) { setAcceptError(error.message); setAccepting(false); return; }
    setRfq({ ...rfq, status: decision });
    // Fire confirmation email to customer
    fetch("https://buqfbcztspswezwyafxo.supabase.co/functions/v1/order-status-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_ref: rfq.id.slice(0, 8).toUpperCase(),
        contact_email: rfq.contact_email,
        contact_name: rfq.contact_name ?? "",
        status: decision,
        quote_amount: rfq.quote_amount,
        currency: rfq.quote_currency ?? "SEK",
      }),
    }).catch(console.error);
    setAccepting(false);
  }

  if (loading || !user || !rfq)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  const isRejected = rfq.status === "rejected";
  const effectiveStatus = rfq.shipment_status ?? rfq.status;
  const activeStep = STATUS_STEPS.indexOf(effectiveStatus);

  const trackingUrl = rfq.carrier?.toLowerCase().includes("postnord")
    ? `https://tracking.postnord.com/?id=${rfq.tracking_number}&lang=${locale === "sv" ? "sv" : "en"}`
    : `https://www.google.com/search?q=${encodeURIComponent(`${rfq.carrier} tracking ${rfq.tracking_number}`)}`;

  return (
    <div className="container-page py-10 max-w-3xl">
      <Link to="/$locale/orders" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">
        ← {t("nav.orders")}
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {rfq.title ?? `${t("rfqPage.title")} ${rfq.id.slice(0, 8).toUpperCase()}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("rfqPage.ref")}: <span className="font-mono font-medium text-foreground">{rfq.id.slice(0, 8).toUpperCase()}</span>
            {" · "}
            {t("rfqPage.created")}: {new Date(rfq.created_at).toLocaleDateString(locale === "sv" ? "sv-SE" : locale)}
          </p>
        </div>
      </div>

      {/* Status timeline */}
      {isRejected ? (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 flex items-center gap-4">
          <span className="text-2xl">❌</span>
          <div>
            <p className="font-semibold text-foreground">{t("rfqPage.statusRejected")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {locale === "sv"
                ? "Vi hade tyvärr inte möjlighet att lämna offert på denna förfrågan. Kontakta oss om du har frågor."
                : "We were unfortunately unable to quote on this request. Contact us if you have questions."}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-0">
            {STATUS_STEPS.map((s, i) => {
              const done = i <= activeStep;
              const active = i === activeStep;
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`size-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition ${
                      active ? "bg-info border-info text-primary-foreground scale-110" :
                      done ? "bg-info/20 border-info text-info" :
                      "bg-surface-alt border-border text-muted-foreground"
                    }`}>
                      {done && !active ? "✓" : i + 1}
                    </div>
                    <span className={`mt-1.5 text-[9px] text-center leading-tight max-w-[50px] ${active ? "font-semibold text-foreground" : done ? "text-info" : "text-muted-foreground"}`}>
                      {statusLabel(t, s)}
                    </span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-3 mx-1 ${i < activeStep ? "bg-info/50" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quote amount block — shown when status is "quoted" */}
      {rfq.status === "quoted" && rfq.quote_amount && (
        <div className="mt-4 rounded-xl border border-[oklch(0.75_0.12_290)] bg-[oklch(0.97_0.03_290)] p-5">
          <p className="text-xs uppercase tracking-wider text-[oklch(0.50_0.15_290)] font-semibold mb-1">
            {locale === "sv" ? "Offertbelopp (exkl. moms)" : "Quoted price (excl. VAT)"}
          </p>
          <p className="text-3xl font-bold text-foreground">
            {rfq.quote_amount.toLocaleString(locale === "sv" ? "sv-SE" : locale, {
              style: "currency",
              currency: rfq.quote_currency ?? "SEK",
              maximumFractionDigits: 0,
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {locale === "sv"
              ? "Offerten är giltig i 30 dagar. Acceptera nedan för att bekräfta ordern."
              : "The quote is valid for 30 days. Accept below to confirm the order."}
          </p>
          {/* Accept / Reject CTA */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => acceptQuote("accepted")}
              disabled={accepting}
              className="px-5 py-2.5 rounded-md bg-[oklch(0.55_0.15_155)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              {accepting ? "…" : locale === "sv" ? "✓ Acceptera offert" : "✓ Accept quote"}
            </button>
            <button
              onClick={() => acceptQuote("rejected")}
              disabled={accepting}
              className="px-5 py-2.5 rounded-md border border-border text-muted-foreground text-sm font-medium hover:border-destructive hover:text-destructive disabled:opacity-50 transition"
            >
              {locale === "sv" ? "Neka" : "Decline"}
            </button>
          </div>
          {acceptError && (
            <p className="mt-2 text-sm text-destructive">{acceptError}</p>
          )}
        </div>
      )}

      {/* Accepted confirmation */}
      {rfq.status === "accepted" && (
        <div className="mt-4 rounded-xl border border-[oklch(0.72_0.12_155)] bg-[oklch(0.96_0.04_155)] p-5 flex items-center gap-4">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-foreground">
              {locale === "sv" ? "Offert accepterad" : "Quote accepted"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {locale === "sv"
                ? "Tack! Vi bekräftar ordern och återkommer med leveransinfo."
                : "Thank you! We are confirming your order and will be in touch with delivery details."}
            </p>
          </div>
        </div>
      )}

      {/* Contact info */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">{t("rfqPage.contact")}</h2>
        {rfq.contact_name && <Row label={t("auth.displayName")} value={rfq.contact_name} />}
        {rfq.contact_email && <Row label={t("auth.email")} value={rfq.contact_email} />}
        {rfq.contact_phone && <Row label={t("profilePage.phone")} value={rfq.contact_phone} />}
        {rfq.company && <Row label={t("profilePage.company")} value={rfq.company} />}
        {rfq.message && (
          <div className="pt-2 border-t border-border">
            <span className="text-muted-foreground text-xs">{t("rfqPage.message")}</span>
            <p className="mt-1 text-sm text-foreground/80 leading-relaxed">{rfq.message}</p>
          </div>
        )}
      </div>

      {/* Items table */}
      {items.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-alt/40">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("rfqPage.items")} ({items.length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left p-3 font-medium">{t("rfqPage.product")}</th>
                <th className="text-center p-3 font-medium w-16">{t("rfqPage.qty")}</th>
                <th className="text-left p-3 font-medium">{t("rfqPage.role")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const product = catalog.find(p => p.id === item.product_id);
                return (
                  <tr key={i} className="border-b border-border last:border-0 odd:bg-surface-alt/30">
                    <td className="p-3">
                      {product ? (
                        <Link
                          to="/$locale/product/$sku"
                          params={{ locale, sku: product.sku }}
                          className="font-medium hover:text-info"
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">{item.product_id?.slice(0, 8)}</span>
                      )}
                      {product && <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{product.sku}</div>}
                    </td>
                    <td className="p-3 text-center font-mono">{item.qty ?? 1}</td>
                    <td className="p-3 text-muted-foreground capitalize text-xs">{item.role ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Shipment & tracking */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">{t("rfqPage.shipment")}</h2>
        <Row label={t("rfqPage.status")} value={statusLabel(t, effectiveStatus)} />
        {rfq.carrier && <Row label={t("rfqPage.carrier")} value={rfq.carrier} />}
        {rfq.tracking_number && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t("rfqPage.trackingNumber")}</span>
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-info hover:opacity-80"
            >
              {rfq.tracking_number} {t("rfqPage.trackOrder")}
            </a>
          </div>
        )}
        {rfq.label_url && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t("rfqPage.downloadLabel")}</span>
            <a href={rfq.label_url} target="_blank" rel="noopener noreferrer" className="text-info hover:opacity-80">
              ↓ PDF
            </a>
          </div>
        )}
        {rfq.shipped_at && (
          <Row label={t("rfqPage.shippedAt")} value={new Date(rfq.shipped_at).toLocaleString(locale === "sv" ? "sv-SE" : locale)} />
        )}
        {rfq.estimated_delivery && (
          <Row label={t("rfqPage.estimatedDelivery")} value={new Date(rfq.estimated_delivery).toLocaleDateString(locale === "sv" ? "sv-SE" : locale)} />
        )}

        {/* Admin: book shipment */}
        {isAdmin && (
          <div className="pt-3 border-t border-border">
            <button
              onClick={bookShipment}
              disabled={bookingLoading}
              className="px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {bookingLoading ? t("rfqPage.booking") : t("rfqPage.bookShipment")}
            </button>
            {bookingResult && (
              <p className={`mt-2 text-sm ${bookingResult.includes("Fel") ? "text-destructive" : "text-[oklch(0.55_0.15_155)]"}`}>
                {bookingResult}
              </p>
            )}
          </div>
        )}
      </div>

      {/* BOM link */}
      {rfq.bom_id && (
        <div className="mt-4 text-center">
          <Link
            to="/$locale/bom/$bomId"
            params={{ locale, bomId: rfq.bom_id }}
            className="text-xs text-muted-foreground hover:text-info"
          >
            {t("rfqPage.bom")}: {rfq.bom_id.slice(0, 8)}…
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

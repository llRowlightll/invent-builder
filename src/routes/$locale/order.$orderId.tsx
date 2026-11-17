/**
 * /order/:orderId -- var är min order? Kundens spårning, som i en leveransapp.
 *
 * Ägaren 2026-11-12: "som Foodora -- vi har tagit emot ditt inköp, den
 * produceras nu, är på leverans, ungefär leveranstid". Allt härleds i
 * databasen (orderns_resa) ur inköpsordrar, leverantörens bekräftelse och
 * försändelser, så sidan visar samma sak som mejlen. Nås med orderns uuid,
 * som orderbekräftelsen -- en gästkund har inget konto.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fraktbolagsnamn } from "@/lib/fraktbolag";
import { aktuelltSteg, etaText, radstatus, type Resa } from "@/lib/orderresa";

export const Route = createFileRoute("/$locale/order/$orderId")({
  head: () => ({
    meta: [
      { title: "Följ din order | Maskinval" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: OrderResa,
});

const T = {
  sv: {
    laddar: "Hämtar ordern …",
    saknas: "Ordern hittades inte. Kontrollera länken i mejlet, eller kontakta oss.",
    order: "Order",
    rubrik: {
      mottagen: "Vi har tagit emot din beställning",
      bestalld: "Beställd hos tillverkaren",
      bekraftad: "Bekräftad av tillverkaren",
      delvis: "Delvis på väg",
      skickad: "På väg till dig",
      levererad: "Levererad",
      avbruten: "Ordern är avbruten",
    },
    under: {
      mottagen: "Vi beställer nu hos tillverkaren.",
      bestalld: "Väntar på att tillverkaren bekräftar leveransdagen.",
      bekraftad: "Tillverkaren har bekräftat. Du får ett mejl med spårningen när det skickas.",
      delvis: "En del är skickad, resten kommer i en egen försändelse.",
      skickad: "Allt är skickat. Följ paketet hos fraktbolaget.",
      levererad: "Tack för beställningen! Fakturan kommer separat.",
      avbruten: "Kontakta oss om du har frågor.",
    },
    steg: { mottagen: "Mottagen", bestalld: "Beställd", bekraftad: "Bekräftad", skickad: "På väg", levererad: "Levererad" },
    eta: "Beräknad leverans",
    levererades: "Levererades",
    forsandelser: "Försändelser",
    forsandelse: "Försändelse",
    spara: "Spåra paketet",
    mottaget: "Jag har tagit emot paketet",
    kvitterad: "Kvitterad",
    innehall: "I paketet",
    rader: "Artiklar",
    oc: "Visa orderbekräftelsen",
    fragor: "Frågor? Svara på något av våra mejl eller skriv till",
    uppdateras: "Sidan uppdateras av sig själv.",
  },
  en: {
    laddar: "Loading the order …",
    saknas: "The order was not found. Check the link in the email, or contact us.",
    order: "Order",
    rubrik: {
      mottagen: "We have received your order",
      bestalld: "Ordered from the manufacturer",
      bekraftad: "Confirmed by the manufacturer",
      delvis: "Partly on its way",
      skickad: "On its way to you",
      levererad: "Delivered",
      avbruten: "The order is cancelled",
    },
    under: {
      mottagen: "We are now ordering from the manufacturer.",
      bestalld: "Waiting for the manufacturer to confirm the delivery date.",
      bekraftad: "The manufacturer has confirmed. You will get an email with tracking when it ships.",
      delvis: "Part of the order has shipped; the rest follows in a separate shipment.",
      skickad: "Everything has shipped. Follow the parcel with the carrier.",
      levererad: "Thank you for your order! The invoice follows separately.",
      avbruten: "Contact us if you have questions.",
    },
    steg: { mottagen: "Received", bestalld: "Ordered", bekraftad: "Confirmed", skickad: "On its way", levererad: "Delivered" },
    eta: "Estimated delivery",
    levererades: "Delivered",
    forsandelser: "Shipments",
    forsandelse: "Shipment",
    spara: "Track parcel",
    mottaget: "I have received the parcel",
    kvitterad: "Confirmed",
    innehall: "In the parcel",
    rader: "Items",
    oc: "View order confirmation",
    fragor: "Questions? Reply to any of our emails or write to",
    uppdateras: "This page updates by itself.",
  },
};

export default function OrderResa() {
  const { locale, orderId } = Route.useParams();
  const sv = locale === "sv";
  const t = sv ? T.sv : T.en;
  const [resa, setResa] = useState<Resa | null>(null);
  const [laddar, setLaddar] = useState(true);
  const [kvitterar, setKvitterar] = useState<string | null>(null);

  async function hamta() {
    const { data } = await (supabase as unknown as {
      rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown }>;
    }).rpc("orderns_resa", { p_order_id: orderId });
    setResa((data as Resa | null) ?? null);
    setLaddar(false);
  }

  useEffect(() => {
    void hamta();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void hamta(); }, 60_000);
    return () => window.clearInterval(id);
  }, [orderId]);

  async function kvittera(shipmentId: string) {
    setKvitterar(shipmentId);
    await (supabase as unknown as {
      rpc: (fn: string, a: Record<string, unknown>) => Promise<unknown>;
    }).rpc("kvittera_forsandelse", { p_order_id: orderId, p_shipment_id: shipmentId });
    await hamta();
    setKvitterar(null);
  }

  if (laddar) return <div className="container-page py-16 text-sm text-muted-foreground">{t.laddar}</div>;
  if (!resa) {
    return (
      <div className="container-page max-w-2xl py-16">
        <p className="text-sm text-muted-foreground">{t.saknas}</p>
        <p className="mt-3 text-sm"><a className="text-info underline" href="mailto:info@maskinval.se">info@maskinval.se</a></p>
      </div>
    );
  }

  const nu = aktuelltSteg(resa);
  const eta = etaText(resa, sv ? "sv" : "en");

  return (
    <div className="container-page max-w-3xl py-8 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {t.order} {resa.order_number}{resa.po_number ? ` · PO ${resa.po_number}` : ""}
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">{t.rubrik[nu]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.under[nu]}</p>
      </header>

      {!resa.avbruten && eta && (
        <section className="kort p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {resa.eta_kalla === "levererad" ? t.levererades : t.eta}
          </div>
          <div className="mt-1 text-2xl font-semibold first-letter:uppercase">{eta.datum}</div>
          {eta.om && <div className="mt-0.5 text-sm text-muted-foreground">{eta.om}</div>}
        </section>
      )}

      {!resa.avbruten && (
        <section className="kort p-5">
          <ol className="grid grid-cols-5 gap-1.5">
            {resa.steg.map((s) => {
              const farg = s.klar ? "bg-success" : s.delvis ? "bg-warning" : "bg-border";
              return (
                <li key={s.kod} className="min-w-0">
                  <div className={`h-1.5 rounded-full ${farg}`} />
                  <div className={`mt-2 text-[11px] sm:text-xs font-medium truncate ${s.klar || s.delvis ? "text-foreground" : "text-muted-foreground"}`}>
                    {t.steg[s.kod as keyof typeof t.steg] ?? s.kod}
                  </div>
                  {s.tid && (
                    <div className="text-[10px] sm:text-[11px] text-muted-foreground">
                      {new Date(s.tid).toLocaleDateString(sv ? "sv-SE" : "en-GB", { day: "numeric", month: "short" })}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {resa.forsandelser.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.forsandelser}</h2>
          {resa.forsandelser.map((f) => (
            <div key={f.id} className="kort p-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm">
                  <span className="font-medium">{t.forsandelse} {f.nr ?? ""}</span>
                  <span className="text-muted-foreground"> · {fraktbolagsnamn(f.fraktbolag)} · </span>
                  <span className="font-mono">{f.sparningsnummer}</span>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${f.status === "delivered" ? "bg-success-surface text-success-deep" : "bg-info-surface text-info"}`}>
                  {f.status === "delivered" ? t.steg.levererad : t.steg.skickad}
                </span>
              </div>
              {f.status !== "delivered" && f.beraknad && (
                <div className="text-sm text-muted-foreground">{t.eta}: {etaText({ ...resa, eta: f.beraknad, eta_kalla: "fraktbolag" }, sv ? "sv" : "en")?.datum}</div>
              )}
              {(f.rader ?? []).length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {t.innehall}: {(f.rader ?? []).map((r) => `${r.qty} × ${r.sku}`).join(", ")}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {f.url && (
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-md bg-info px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
                    {t.spara}
                  </a>
                )}
                {f.status === "in_transit" ? (
                  <button onClick={() => kvittera(f.id)} disabled={kvitterar === f.id}
                    className="rounded-md border border-border px-3.5 py-1.5 text-sm hover:border-info disabled:opacity-50">
                    {t.mottaget}
                  </button>
                ) : (
                  <span className="px-1 py-1.5 text-sm text-success-deep">✓ {t.kvitterad}</span>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="kort p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.rader}</h2>
        <ul className="mt-2 divide-y divide-border">
          {resa.rader.map((r) => {
            const st = radstatus(r, sv ? "sv" : "en");
            return (
              <li key={r.line_no} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{r.qty} × {r.sku}</span>
                  <div className="text-xs text-muted-foreground truncate">{r.name}</div>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${st.klass}`}>{st.text}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link to="/$locale/oc/$orderId" params={{ locale, orderId } as never} className="text-info underline">{t.oc}</Link>
        <span className="text-xs text-muted-foreground">{t.uppdateras}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t.fragor} <a className="underline" href="mailto:info@maskinval.se">info@maskinval.se</a>.
      </p>
    </div>
  );
}

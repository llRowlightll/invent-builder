/**
 * /offert/:rfqId  — public read-only quote view for the customer.
 * No auth required. Admin emails a link to this page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lasMomsbesked, momsnot, momsrad, SVENSK_MOMS, type Momsbesked } from "@/lib/moms";
import { fetchCompanySettings, visningsnamn, type CompanySettings } from "@/lib/company-settings";
import { CheckCircle2 } from "lucide-react";
import { OFFERT_GILTIG_DAGAR, VILLKOR_VERSION, offertGiltigTill } from "@/lib/villkor";

export const Route = createFileRoute("/$locale/offert/$rfqId")({
  component: PublicOffertPage,
});

type RfqItem = {
  id: string;
  qty: number | null;
  unit_price: number | null;
  note: string | null;
  product?: { sku: string; name: string } | null;
};

type Rfq = {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  company: string | null;
  org_number: string | null;
  po_number: string | null;
  status: string | null;
  quote_amount: number | null;
  quote_currency: string | null;
  discount_pct: number | null;
  created_at: string;
  /** När offerten lämnades (status blev 'quoted'); saknas för äldre rader. */
  quoted_at?: string | null;
  /** Frakt exkl. moms; introrabatten gäller inte frakten. */
  freight_ex_vat?: number | null;
};


function fmt(n: number, currency = "SEK") {
  return n.toLocaleString("sv-SE", { style: "currency", currency, maximumFractionDigits: 0 });
}

function docRef(id: string) {
  return `OE-${id.slice(0, 8).toUpperCase()}`;
}

export default function PublicOffertPage() {
  const { locale, rfqId } = Route.useParams();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [items, setItems] = useState<RfqItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Momsen följer kunden (momsregel i databasen): 25 %, omvänd
  // betalningsskyldighet inom EU med momsnummer, eller export.
  const [moms, setMoms] = useState<Momsbesked>(SVENSK_MOMS);
  useEffect(() => {
    (supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown }> })
      .rpc("momsbesked", { p_rfq_id: rfqId })
      .then(({ data }) => setMoms(lasMomsbesked(data)))
      .catch(() => setMoms(SVENSK_MOMS));
  }, [rfqId]);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [poInput, setPoInput] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  // Leveransadressen samlas in vid accept: leverantören skickar direkt till
  // kunden, och en offert hade tidigare ingen adress alls (2026-11-12).
  const [lev, setLev] = useState({ namn: "", gata: "", postnr: "", ort: "", telefon: "", referens: "", instruktioner: "" });
  const [poFil, setPoFil] = useState<File | null>(null);
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      // SECURITY: fetch quote + items by id via SECURITY DEFINER RPCs. Anon can
      // no longer SELECT rfqs/rfq_items directly (no enumeration of every quote).
      supabase.rpc("get_quote_by_id", { p_id: rfqId }),
      supabase.rpc("get_quote_items", { p_rfq_id: rfqId }),
      fetchCompanySettings(),
    ]).then(([{ data: r }, { data: i }, co]) => {
      setCompany(co);
      const rfqRow = Array.isArray(r) ? r[0] : null;
      if (rfqRow) setRfq(rfqRow as unknown as Rfq);
      setItems(((i as Record<string, unknown>[]) ?? []).map((d) => ({
        id: d.id as string,
        qty: d.qty as number | null,
        unit_price: d.unit_price as number | null,
        note: d.note as string | null,
        // RPC returns flat sku/name (joined to products) instead of nested object
        product: d.sku ? { sku: d.sku as string, name: d.name as string } : null,
      })));
      setLoading(false);
    });
  }, []);

  const lineItems = items.map(it => ({
    ...it,
    qty: it.qty ?? 1,
    price: it.unit_price ?? 0,
    lineTotal: (it.qty ?? 1) * (it.unit_price ?? 0),
  }));
  const totalEx  = lineItems.reduce((s, l) => s + l.lineTotal, 0);
  const discountPct = Number(rfq?.discount_pct ?? 0);
  const discountAmt = totalEx * (discountPct / 100);
  const frakt = Number(rfq?.freight_ex_vat ?? 0);
  const netEx = totalEx - discountAmt + frakt;
  const vatAmt   = netEx * moms.sats;
  const totalInc = netEx + vatAmt;
  const currency = rfq?.quote_currency ?? "SEK";

  async function respond(decision: "accepted" | "rejected") {
    setFel(null);
    const namn = lev.namn.trim() || rfq?.company || "";
    if (decision === "accepted" && (!namn || !lev.gata.trim() || !lev.postnr.trim() || !lev.ort.trim())) {
      setFel("Fyll i leveransadressen (mottagare, gata, postnummer och ort) innan du accepterar.");
      return;
    }
    if (poFil && poFil.size > 10 * 1024 * 1024) {
      setFel("PO-filen får vara högst 10 MB.");
      return;
    }
    setAccepting(true);
    // Kundens PO som fil, i offertens egen mapp i den privata bucketen.
    let poSokvag: string | undefined;
    if (decision === "accepted" && poFil) {
      const namnet = poFil.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
      const sokvag = `${rfqId}/${Date.now()}-${namnet}`;
      const { error: upFel } = await supabase.storage.from("kund-po").upload(sokvag, poFil, { contentType: poFil.type || undefined });
      if (upFel) {
        setAccepting(false);
        setFel(`PO-filen kunde inte laddas upp (${upFel.message}). Försök igen eller acceptera utan fil och mejla den till oss.`);
        return;
      }
      poSokvag = sokvag;
    }
    // SECURITY: respond via SECURITY DEFINER RPC. It only flips a quote that is
    // currently 'quoted' → accepted/rejected and validates the decision value,
    // so anon can no longer mass-update arbitrary quotes. On acceptance it also
    // creates the real order atomically and returns its id, so the customer
    // lands on an actual order confirmation instead of a "we'll follow up" promise.
    const { data } = await supabase.rpc("respond_to_quote", {
      p_id: rfqId,
      p_decision: decision,
      p_po: poInput.trim() || undefined,
      ...(decision === "accepted" ? {
        p_leverans: { ...lev, namn },
        p_po_fil: poSokvag,
      } : {}),
    } as never);
    const result = Array.isArray(data) ? data[0] : data;
    const newOrderId = (result as { order_id?: string } | null)?.order_id ?? null;
    if (newOrderId) setOrderId(newOrderId);
    // Fire notification email — order-status-email re-reads the rfq's real
    // status/amount/order by id, so it reflects what respond_to_quote() actually
    // did rather than trusting `decision` (which might not match, e.g. if the
    // quote had already been responded to and the RPC's update was a no-op).
    await fetch("https://buqfbcztspswezwyafxo.supabase.co/functions/v1/order-status-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rfqId, kind: "rfq", locale }),
    }).catch(console.error);
    setAccepting(false);
    if (decision === "accepted") setAccepted(true);
    else setDeclined(true);
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="size-6 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
    </div>
  );

  if (!rfq || !lineItems.length) return (
    <div className="flex min-h-screen items-center justify-center bg-muted text-muted-foreground text-sm">
      Offerten hittades inte eller har inga rader.
    </div>
  );

  const co = company ?? { name: "Maskinval", org: "", address: "", postal: "", email: "info@maskinval.se", phone: "", web: "", bankgiro: "", vat: "" };
  // Offertdatum = när offerten lämnades, inte när förfrågan kom in. Giltigheten
  // räknas därifrån (allmänna villkor, avsnitt 3).
  const offertdatum = rfq.quoted_at ?? rfq.created_at;
  const today = new Date(offertdatum).toLocaleDateString("sv-SE");
  const giltigTill = offertGiltigTill(offertdatum).toLocaleDateString("sv-SE");
  const alreadyAnswered = rfq.status === "accepted" || rfq.status === "rejected" || accepted || declined;

  return (
    <div className="min-h-screen bg-muted py-10 px-4">
      <div className="mx-auto max-w-3xl bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="px-12 py-10" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>

          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <div className="text-2xl font-bold" style={{ fontFamily: "system-ui, sans-serif" }}>{visningsnamn(co)}</div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                {(co.address || co.postal) && <div>{co.address}{co.postal ? `, ${co.postal}` : ""}</div>}
                <div>{co.email}{co.email && co.phone ? " · " : ""}{co.phone}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-light tracking-widest uppercase text-muted-foreground/70" style={{ fontFamily: "system-ui, sans-serif" }}>Offert</div>
              <div className="text-sm text-muted-foreground mt-2 space-y-0.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                <div><span className="text-muted-foreground">Ref:</span> {docRef(rfqId)}</div>
                <div><span className="text-muted-foreground">Datum:</span> {today}</div>
                <div><span className="text-muted-foreground">Giltig t.o.m.:</span> {giltigTill}</div>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="mb-8 p-4 bg-muted rounded" style={{ fontFamily: "system-ui, sans-serif" }}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Till</div>
            <div className="font-semibold text-foreground">{rfq.company ?? rfq.contact_name}</div>
            {rfq.company && rfq.contact_name && <div className="text-sm text-muted-foreground">Att: {rfq.contact_name}</div>}
            {rfq.org_number && <div className="text-sm text-muted-foreground">Org.nr {rfq.org_number}</div>}
            {rfq.contact_email && <div className="text-sm text-muted-foreground">{rfq.contact_email}</div>}
            {rfq.po_number && <div className="text-sm text-muted-foreground mt-1">Er ref (PO): <span className="font-medium">{rfq.po_number}</span></div>}
          </div>

          {/* Line items */}
          <table className="w-full text-sm mb-2" style={{ fontFamily: "system-ui, sans-serif" }}>
            <thead>
              <tr className="border-b-2 border-foreground/30">
                <th className="text-left py-2 text-xs uppercase tracking-wider text-muted-foreground w-20">Art.nr</th>
                <th className="text-left py-2 text-xs uppercase tracking-wider text-muted-foreground">Benämning</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider text-muted-foreground w-16">Antal</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider text-muted-foreground w-28">À-pris ex. moms</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider text-muted-foreground w-28">Belopp ex. moms</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, i) => (
                <tr key={it.id} className={i % 2 === 0 ? "bg-white" : "bg-muted"}>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground tabular">{it.product?.sku ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <div className="text-foreground">{it.product?.name ?? "—"}</div>
                    {it.note && <div className="text-xs text-muted-foreground mt-0.5">{it.note}</div>}
                  </td>
                  <td className="py-2.5 text-right">{it.qty}</td>
                  <td className="py-2.5 text-right">{fmt(it.price, currency)}</td>
                  <td className="py-2.5 text-right font-medium text-foreground">{fmt(it.lineTotal, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-10" style={{ fontFamily: "system-ui, sans-serif" }}>
            <table className="text-sm w-64">
              <tbody>
                <tr>
                  <td className="py-1 text-muted-foreground">Summa ex. moms</td>
                  <td className="py-1 text-right font-medium text-foreground">{fmt(totalEx, currency)}</td>
                </tr>
                {discountPct > 0 && (
                  <tr>
                    <td className="py-1 text-emerald-700">Intro-rabatt −{discountPct} %</td>
                    <td className="py-1 text-right text-emerald-700">−{fmt(discountAmt, currency)}</td>
                  </tr>
                )}
                {frakt > 0 && (
                  <tr>
                    <td className="py-1 text-muted-foreground">Frakt</td>
                    <td className="py-1 text-right text-foreground">{fmt(frakt, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-1 text-muted-foreground">{momsrad(moms, "sv")}</td>
                  <td className="py-1 text-right text-foreground">{fmt(vatAmt, currency)}</td>
                </tr>
                <tr className="border-t-2 border-foreground/30">
                  <td className="py-2 font-bold text-foreground">Totalt att betala</td>
                  <td className="py-2 text-right font-bold text-foreground text-base">{fmt(totalInc, currency)}</td>
                </tr>
              </tbody>
            </table>
            {momsnot(moms, "sv") && <p className="mt-2 text-[11px] text-muted-foreground leading-snug">{momsnot(moms, "sv")}</p>}
          </div>

          {/* Villkoren blir en del av avtalet först när de hänvisats till innan det ingås. */}
          <p className="-mt-6 mb-10 text-xs text-muted-foreground" style={{ fontFamily: "system-ui, sans-serif" }}>
            Offerten gäller i {OFFERT_GILTIG_DAGAR} dagar, t.o.m. {giltigTill}. Priser exkl. moms.{" "}
            {frakt > 0 ? "Frakt enligt ovan." : "Frakten ingår."} Maskinvals{" "}
            <a href={`/${locale}/terms`} target="_blank" rel="noopener noreferrer" className="underline">allmänna villkor</a>{" "}
            (version {VILLKOR_VERSION}) gäller.
          </p>

          {/* Accept / decline */}
          {accepted || rfq.status === "accepted" ? (
            <div className="rounded-xl border border-green-300 bg-green-50 p-6 text-center space-y-3">
              <CheckCircle2 className="size-7 text-success" aria-hidden />
              <p className="font-semibold text-green-800">Beställning bekräftad</p>
              {orderId ? (
                <>
                  <p className="text-sm text-green-700">Din order är skapad. Orderbekräftelsen skickas även till din e-post.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <a
                      href={`/${locale}/order/${orderId}`}
                      className="inline-block mt-1 px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition"
                    >
                      Följ din order →
                    </a>
                    <a
                      href={`/${locale}/oc/${orderId}`}
                      className="inline-block mt-1 px-6 py-2.5 rounded-lg border border-green-600 text-green-800 text-sm font-semibold hover:bg-green-100 transition"
                    >
                      Orderbekräftelse
                    </a>
                  </div>
                </>
              ) : (
                <p className="text-sm text-green-700">Orderbekräftelsen skickas till din e-post.</p>
              )}
            </div>
          ) : declined || rfq.status === "rejected" ? (
            <div className="rounded-xl border border-border bg-muted p-6 text-center space-y-2">
              <div className="text-2xl">✕</div>
              <p className="font-semibold text-foreground">Offert avböjd</p>
              <p className="text-sm text-muted-foreground">
                Kontakta oss på{" "}
                <a href={`mailto:${co.email}`} className="underline">{co.email}</a>{" "}
                om du har frågor.
              </p>
            </div>
          ) : (
            <div className="border-t border-border pt-8 space-y-5" style={{ fontFamily: "system-ui, sans-serif" }}>
              {/* Leveransadress och PO -- leverantören skickar direkt till kunden. */}
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Leveransadress</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    ["namn", "Mottagare (företag)", rfq.company ?? "", true],
                    ["gata", "Gatuadress", "", true],
                    ["postnr", "Postnummer", "", true],
                    ["ort", "Ort", "", true],
                    ["telefon", "Telefon vid leverans", "", false],
                    ["referens", "Er referens / märkning", "", false],
                  ] as const).map(([falt, etikett, platshallare, kravs]) => (
                    <label key={falt} className="block text-xs text-muted-foreground">
                      {etikett}{kravs ? " *" : ""}
                      <input
                        type="text"
                        value={lev[falt]}
                        placeholder={platshallare}
                        maxLength={falt === "gata" ? 160 : 120}
                        onChange={(e) => setLev((v) => ({ ...v, [falt]: e.target.value }))}
                        className="mt-1 w-full border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/30"
                      />
                    </label>
                  ))}
                </div>
                <label className="block text-xs text-muted-foreground">
                  Leveransinstruktion (valfritt)
                  <input
                    type="text"
                    value={lev.instruktioner}
                    maxLength={500}
                    placeholder="t.ex. lastkaj 2, vardagar 7–15"
                    onChange={(e) => setLev((v) => ({ ...v, instruktioner: e.target.value }))}
                    className="mt-1 w-full border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/30"
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs text-muted-foreground">
                    Ert PO-nummer (valfritt)
                    <input
                      type="text"
                      value={poInput || rfq.po_number || ""}
                      onChange={e => setPoInput(e.target.value)}
                      placeholder="t.ex. PO-2024-001"
                      className="mt-1 w-full border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    Bifoga PO (PDF eller bild, valfritt)
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={(e) => setPoFil(e.target.files?.[0] ?? null)}
                      className="mt-1 block w-full text-sm text-foreground file:mr-3 file:rounded file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
                    />
                  </label>
                </div>
                {fel && <p className="text-sm text-destructive">{fel}</p>}
              </div>
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">Vill du acceptera denna offert?</p>
                <p className="text-xs text-muted-foreground">
                  Genom att acceptera beställer du enligt offerten och godkänner våra{" "}
                  <a href={`/${locale}/terms`} target="_blank" rel="noopener noreferrer" className="underline">allmänna villkor</a>.
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => respond("accepted")}
                    disabled={accepting || alreadyAnswered}
                    className="px-8 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:opacity-50"
                  >
                    ✓ Ja, acceptera offert
                  </button>
                  <button
                    onClick={() => respond("rejected")}
                    disabled={accepting || alreadyAnswered}
                    className="px-8 py-3 rounded-lg border border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
                  >
                    Avböj
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Har du frågor? <a href={`mailto:${co.email}`} className="underline">{co.email}</a>
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

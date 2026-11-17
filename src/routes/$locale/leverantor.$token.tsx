/**
 * /leverantor/:token -- leverantörens sida för en inköpsorder.
 *
 * Länken står i inköpsorderns mejl och PDF (supplier-po). Leverantören
 * bekräftar antal, pris och leveransdatum per rad och anger fraktbolag och
 * spårningsnummer när det skickas -- utan konto. Bekräftelsen klassas
 * grön/gul/röd i databasen precis som en manuellt registrerad, och
 * försändelsen syns direkt i kundens spårning.
 *
 * Token är hemlig: sidan indexeras inte, skickar ingen referer och laddar
 * ingen Google Analytics ($locale.tsx hoppar över den här sökvägen).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FRAKTBOLAG, fraktbolagsnamn, giltigtSparningsnummer } from "@/lib/fraktbolag";

export const Route = createFileRoute("/$locale/leverantor/$token")({
  head: () => ({
    meta: [
      { title: "Inköpsorder | Maskinval" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: LeverantorSida,
});

type Rad = {
  spoi_id: string; line_no: number; sku: string; supplier_sku: string | null; name: string;
  qty: number; unit_price: number | null; ack_qty: number | null; ack_unit_price: number | null;
  ack_delivery_date: string | null; ack_status: string | null; skickat: number;
};
type Forsandelse = { carrier: string; tracking_number: string; shipped_at: string; estimated_delivery: string | null };
type Inkopsorder = {
  po_number: string; status: string; datum: string; onskad_leverans: string | null; valuta: string;
  leverantor: string; bekraftad_at: string | null; direktleverans: boolean;
  kopare: { name?: string; email?: string; phone?: string };
  leverans: { namn: string | null; gata: string | null; postnr: string | null; ort: string | null; land: string | null;
    kontakt: string | null; telefon: string | null; instruktioner: string | null; marke: string | null };
  rader: Rad[]; forsandelser: Forsandelse[];
};

type RadSvar = { qty: string; pris: string; datum: string; svar: string; ersattning: string; not: string };

const T = {
  sv: {
    laddar: "Hämtar inköpsordern …",
    ogiltig: "Länken gäller inte. Den kan ha ersatts av ett nyare utskick av inköpsordern. Kontakta oss så skickar vi en ny.",
    rubrik: "Inköpsorder",
    fran: "från",
    leverera: "Levereras till",
    direkt: "Direktleverans till vår kund. Neutral leverans: inga priser och inte er faktura i paketet. Fakturan till",
    marke: "Märk godset",
    onskad: "Önskad leverans",
    steg1: "1. Bekräfta ordern",
    steg1Text: "Stämmer allt räcker det att ange leveransdatum och trycka Bekräfta. Ändra antal eller pris om det avviker.",
    artikel: "Artikel", antal: "Antal", pris: "À-pris", levdatum: "Leveransdatum", status: "Svar",
    svar: { accepted: "Levereras", backordered: "Restnoterad", discontinued: "Utgången", rejected: "Kan inte leverera", substituted: "Ersättningsartikel", question: "Fråga" },
    ersattning: "Ersättningsartikel", kommentar: "Kommentar (valfritt)",
    referens: "Ert ordernummer (valfritt)",
    bekrafta: "Bekräfta ordern", bekraftaIgen: "Uppdatera bekräftelsen",
    tack: "Tack! Bekräftelsen är registrerad.",
    avvikelse: "Vi går igenom avvikelserna och återkommer.",
    bekraftad: "Bekräftad",
    steg2: "2. Skickat? Ange spårningsnummer",
    steg2Text: "Kunden ser försändelsen och får ett mejl med spårningslänken.",
    fraktbolag: "Fraktbolag", sparning: "Spårningsnummer", beraknad: "Beräknad leverans",
    skickas: "Skickas nu", kvar: "kvar",
    registrera: "Registrera försändelsen",
    skickad: "Försändelsen är registrerad.",
    forsandelser: "Registrerade försändelser",
    allaSkickade: "Alla rader är skickade.",
    felSparning: "Spårningsnumret ska vara 4–40 tecken: bokstäver, siffror, mellanslag eller bindestreck.",
    felRad: "Ange antal på minst en rad.",
    fragor: "Frågor",
  },
  en: {
    laddar: "Loading the purchase order …",
    ogiltig: "This link is no longer valid. It may have been replaced by a newer copy of the purchase order. Contact us and we will send a new one.",
    rubrik: "Purchase order",
    fran: "from",
    leverera: "Deliver to",
    direkt: "Direct delivery to our customer. Neutral delivery: no prices and not your invoice in the parcel. Invoice to",
    marke: "Mark the goods",
    onskad: "Requested delivery",
    steg1: "1. Confirm the order",
    steg1Text: "If everything is correct, enter the delivery date and press Confirm. Change quantity or price if they differ.",
    artikel: "Item", antal: "Qty", pris: "Unit price", levdatum: "Delivery date", status: "Response",
    svar: { accepted: "Will deliver", backordered: "Backordered", discontinued: "Discontinued", rejected: "Cannot deliver", substituted: "Substitute item", question: "Question" },
    ersattning: "Substitute item", kommentar: "Comment (optional)",
    referens: "Your order number (optional)",
    bekrafta: "Confirm order", bekraftaIgen: "Update confirmation",
    tack: "Thank you! The confirmation is registered.",
    avvikelse: "We will review the deviations and get back to you.",
    bekraftad: "Confirmed",
    steg2: "2. Shipped? Enter the tracking number",
    steg2Text: "The customer sees the shipment and gets an email with the tracking link.",
    fraktbolag: "Carrier", sparning: "Tracking number", beraknad: "Estimated delivery",
    skickas: "Shipping now", kvar: "left",
    registrera: "Register shipment",
    skickad: "The shipment is registered.",
    forsandelser: "Registered shipments",
    allaSkickade: "All lines are shipped.",
    felSparning: "The tracking number must be 4–40 characters: letters, digits, spaces or hyphens.",
    felRad: "Enter a quantity on at least one line.",
    fragor: "Questions",
  },
};

function belopp(n: number | null, valuta: string) {
  if (n == null) return "—";
  return `${n.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${valuta}`;
}

export default function LeverantorSida() {
  const { locale, token } = Route.useParams();
  const t = locale === "sv" ? T.sv : T.en;
  const [po, setPo] = useState<Inkopsorder | null>(null);
  const [laddar, setLaddar] = useState(true);
  const [svar, setSvar] = useState<Record<string, RadSvar>>({});
  const [referens, setReferens] = useState("");
  const [sparar, setSparar] = useState(false);
  const [meddelande, setMeddelande] = useState<{ text: string; ok: boolean } | null>(null);
  const [fraktbolag, setFraktbolag] = useState("postnord");
  const [sparning, setSparning] = useState("");
  const [beraknad, setBeraknad] = useState("");
  const [skickas, setSkickas] = useState<Record<string, string>>({});
  const [frakMeddelande, setFraktMeddelande] = useState<{ text: string; ok: boolean } | null>(null);

  async function hamta() {
    const { data, error } = await (supabase as unknown as {
      rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("leverantor_inkopsorder", { p_token: token });
    const p = !error && data ? (data as Inkopsorder) : null;
    setPo(p);
    if (p) {
      const s: Record<string, RadSvar> = {};
      const k: Record<string, string> = {};
      for (const r of p.rader) {
        s[r.spoi_id] = {
          qty: String(r.ack_qty ?? r.qty),
          pris: r.ack_unit_price != null ? String(r.ack_unit_price) : r.unit_price != null ? String(r.unit_price) : "",
          datum: r.ack_delivery_date ?? p.onskad_leverans ?? "",
          svar: "accepted", ersattning: "", not: "",
        };
        k[r.spoi_id] = String(Math.max(0, r.qty - r.skickat));
      }
      setSvar(s);
      setSkickas(k);
    }
    setLaddar(false);
  }

  useEffect(() => { void hamta(); }, [token]);

  async function bekrafta(e: React.FormEvent) {
    e.preventDefault();
    if (!po) return;
    setSparar(true);
    setMeddelande(null);
    const rader = po.rader.map((r) => {
      const v = svar[r.spoi_id];
      return {
        spoi_id: r.spoi_id,
        qty: v.qty,
        unit_price: v.pris,
        delivery_date: v.datum,
        response: v.svar,
        substitute_sku: v.svar === "substituted" ? v.ersattning : "",
        note: v.not,
      };
    });
    const { data, error } = await (supabase as unknown as {
      rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: { worst_level?: string } | null; error: { message: string } | null }>;
    }).rpc("leverantor_bekrafta", { p_token: token, p_lines: rader, p_referens: referens || null, p_not: null });
    setSparar(false);
    if (error) { setMeddelande({ text: error.message, ok: false }); return; }
    setMeddelande({ text: data?.worst_level && data.worst_level !== "gron" ? `${t.tack} ${t.avvikelse}` : t.tack, ok: true });
    await hamta();
  }

  async function registrera(e: React.FormEvent) {
    e.preventDefault();
    if (!po) return;
    setFraktMeddelande(null);
    if (!giltigtSparningsnummer(sparning)) { setFraktMeddelande({ text: t.felSparning, ok: false }); return; }
    const rader = po.rader
      .map((r) => ({ spoi_id: r.spoi_id, qty: Number(skickas[r.spoi_id] || 0) }))
      .filter((r) => r.qty > 0);
    if (rader.length === 0) { setFraktMeddelande({ text: t.felRad, ok: false }); return; }
    setSparar(true);
    const { error } = await (supabase as unknown as {
      rpc: (fn: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).rpc("leverantor_forsandelse", {
      p_token: token, p_carrier: fraktbolag, p_tracking: sparning.trim(),
      p_estimated: beraknad || null, p_lines: rader,
    });
    setSparar(false);
    if (error) { setFraktMeddelande({ text: error.message, ok: false }); return; }
    setFraktMeddelande({ text: t.skickad, ok: true });
    setSparning("");
    await hamta();
  }

  if (laddar) return <div className="container-page py-16 text-sm text-muted-foreground">{t.laddar}</div>;
  if (!po) {
    return (
      <div className="container-page max-w-2xl py-16">
        <h1 className="text-xl font-semibold">{t.rubrik}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t.ogiltig}</p>
        <p className="mt-3 text-sm"><a className="text-info underline" href="mailto:info@maskinval.se">info@maskinval.se</a></p>
      </div>
    );
  }

  const l = po.leverans;
  const kvarAttSkicka = po.rader.some((r) => r.qty - r.skickat > 0);
  const inmatning = "w-full rounded border border-border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-info";

  return (
    <div className="container-page max-w-5xl py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t.rubrik} {t.fran} {po.kopare?.name || "Maskinval"}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{po.po_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{po.leverantor} · {po.datum}{po.onskad_leverans ? ` · ${t.onskad} ${po.onskad_leverans}` : ""}</p>
        </div>
        {po.bekraftad_at && (
          <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success-deep">
            ✓ {t.bekraftad} {po.bekraftad_at.slice(0, 10)}
          </span>
        )}
      </header>

      <section className="kort p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.leverera}</h2>
        <div className="mt-2 leading-relaxed">
          {[l.namn, l.gata, [l.postnr, l.ort].filter(Boolean).join(" "), [l.kontakt, l.telefon].filter(Boolean).join(", ")]
            .filter((r) => (r ?? "").trim()).map((r) => <div key={r}>{r}</div>)}
        </div>
        {po.direktleverans && (
          <p className="mt-3 font-medium text-warning-deep">{t.direkt} {po.kopare?.name || "Maskinval"}.</p>
        )}
        {l.instruktioner && <p className="mt-2 text-muted-foreground">{l.instruktioner}</p>}
        {l.marke && <p className="mt-2"><span className="text-muted-foreground">{t.marke}:</span> <strong>{l.marke}</strong></p>}
      </section>

      <form onSubmit={bekrafta} className="kort p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t.steg1}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.steg1Text}</p>
        </div>
        <div className="space-y-3">
          {po.rader.map((r) => {
            const v = svar[r.spoi_id];
            if (!v) return null;
            const satt = (falt: keyof RadSvar, varde: string) =>
              setSvar((s) => ({ ...s, [r.spoi_id]: { ...s[r.spoi_id], [falt]: varde } }));
            return (
              <div key={r.spoi_id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{r.line_no}.</span>{" "}
                    <strong>{r.sku}</strong>{r.supplier_sku ? <span className="text-muted-foreground"> · {r.supplier_sku}</span> : null}
                    <div className="text-muted-foreground">{r.name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.qty} × {belopp(r.unit_price, po.valuta)}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-xs text-muted-foreground">{t.antal}
                    <input className={inmatning} type="number" min="0" step="any" value={v.qty} onChange={(e) => satt("qty", e.target.value)} />
                  </label>
                  <label className="text-xs text-muted-foreground">{t.pris} ({po.valuta})
                    <input className={inmatning} type="number" min="0" step="any" value={v.pris} onChange={(e) => satt("pris", e.target.value)} />
                  </label>
                  <label className="text-xs text-muted-foreground">{t.levdatum}
                    <input className={inmatning} type="date" required={v.svar === "accepted"} value={v.datum} onChange={(e) => satt("datum", e.target.value)} />
                  </label>
                  <label className="text-xs text-muted-foreground">{t.status}
                    <select className={inmatning} value={v.svar} onChange={(e) => satt("svar", e.target.value)}>
                      {Object.entries(t.svar).map(([k, namn]) => <option key={k} value={k}>{namn}</option>)}
                    </select>
                  </label>
                </div>
                {v.svar === "substituted" && (
                  <label className="mt-2 block text-xs text-muted-foreground">{t.ersattning}
                    <input className={inmatning} value={v.ersattning} maxLength={80} onChange={(e) => satt("ersattning", e.target.value)} />
                  </label>
                )}
                {v.svar !== "accepted" && (
                  <label className="mt-2 block text-xs text-muted-foreground">{t.kommentar}
                    <input className={inmatning} value={v.not} maxLength={300} onChange={(e) => satt("not", e.target.value)} />
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <label className="block max-w-xs text-xs text-muted-foreground">{t.referens}
          <input className={inmatning} value={referens} maxLength={100} onChange={(e) => setReferens(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={sparar}
            className="rounded-md bg-info px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {po.bekraftad_at ? t.bekraftaIgen : t.bekrafta}
          </button>
          {meddelande && <span className={`text-sm ${meddelande.ok ? "text-success-deep" : "text-destructive"}`}>{meddelande.text}</span>}
        </div>
      </form>

      <section className="kort p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t.steg2}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.steg2Text}</p>
        </div>
        {kvarAttSkicka ? (
          <form onSubmit={registrera} className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-xs text-muted-foreground">{t.fraktbolag}
                <select className={inmatning} value={fraktbolag} onChange={(e) => setFraktbolag(e.target.value)}>
                  {FRAKTBOLAG.map((f) => <option key={f.kod} value={f.kod}>{f.namn}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">{t.sparning}
                <input className={inmatning} value={sparning} maxLength={40} onChange={(e) => setSparning(e.target.value)} required />
              </label>
              <label className="text-xs text-muted-foreground">{t.beraknad}
                <input className={inmatning} type="date" value={beraknad} onChange={(e) => setBeraknad(e.target.value)} />
              </label>
            </div>
            <div className="space-y-1.5">
              {po.rader.filter((r) => r.qty - r.skickat > 0).map((r) => (
                <label key={r.spoi_id} className="flex items-center justify-between gap-3 text-sm">
                  <span><strong>{r.sku}</strong> <span className="text-muted-foreground">({r.qty - r.skickat} {t.kvar})</span></span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">{t.skickas}
                    <input className="w-20 rounded border border-border bg-card px-2 py-1 text-right text-sm" type="number" min="0"
                      max={r.qty - r.skickat} step="any" value={skickas[r.spoi_id] ?? ""}
                      onChange={(e) => setSkickas((s) => ({ ...s, [r.spoi_id]: e.target.value }))} />
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={sparar}
                className="rounded-md bg-info px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {t.registrera}
              </button>
              {frakMeddelande && <span className={`text-sm ${frakMeddelande.ok ? "text-success-deep" : "text-destructive"}`}>{frakMeddelande.text}</span>}
            </div>
          </form>
        ) : (
          <p className="text-sm text-success-deep">✓ {t.allaSkickade}</p>
        )}
        {po.forsandelser.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.forsandelser}</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {po.forsandelser.map((f) => (
                <li key={`${f.carrier}-${f.tracking_number}`}>
                  {fraktbolagsnamn(f.carrier)} · <strong>{f.tracking_number}</strong> · {f.shipped_at.slice(0, 10)}
                  {f.estimated_delivery ? ` → ${f.estimated_delivery}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        {t.fragor}: <a className="underline" href={`mailto:${po.kopare?.email || "info@maskinval.se"}`}>{po.kopare?.email || "info@maskinval.se"}</a>
        {po.kopare?.phone ? ` · ${po.kopare.phone}` : ""}
      </p>
    </div>
  );
}

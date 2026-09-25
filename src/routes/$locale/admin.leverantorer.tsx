/**
 * Leverantörer — insamlingsformuläret.
 *
 * Sidan finns för att Order Engine inte kan lägga en inköpsorder förrän tolv
 * saker är kända per leverantör: återförsäljaravtal, kundnummer och prislista,
 * om direktleverans till slutkund tillåts, integrationsväg, orderformat och
 * beställningsadress, hur lager och leveranstid fås, hur bekräftelse och
 * tracking kommer tillbaka, retur och garanti, fraktvillkor, betalningsvillkor,
 * regler för produktdata och varumärke, samt om leverantören står inför ett
 * systembyte.
 *
 * Fälten nedan ÄR de frågorna, i samma ordning. Tanken är att sidan ska kunna
 * fyllas i under mötet med leverantören, inte efteråt ur minnet.
 *
 * "Klart"-räknaren visar hur många av de tolv som är besvarade, så att det går
 * att se vilken leverantör som saknar vad utan att öppna varje rad.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/admin/leverantorer")({
  component: AdminLeverantorer,
});

type Supplier = {
  id: string; slug: string; name: string; is_active: boolean;
  agreement_status: string; agreement_signed_at: string | null; agreement_notes: string | null;
  customer_number: string | null; price_list_ref: string | null; discount_notes: string | null;
  allows_dropship: boolean | null; dropship_notes: string | null;
  order_email: string | null; order_portal_url: string | null;
  stock_data_method: string | null; default_lead_time_days: number | null;
  incoterms: string | null; min_order_value: number | null; free_freight_over: number | null;
  freight_notes: string | null; payment_terms: string | null;
  returns_process: string | null; warranty_terms: string | null;
  product_data_rights: string | null; system_notes: string | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  internal_notes: string | null;
  /** Sätts av set_updated_at-triggern. Säger hur färsk uppgiften är. */
  updated_at: string | null;
};

type Integration = {
  id: string; supplier_id: string; method: string; status: string; is_primary: boolean;
  order_format: string | null; ack_method: string | null; tracking_method: string | null;
  price_tolerance_pct: number; delay_tolerance_days: number; notes: string | null;
};

/** De tolv frågorna, och vad som räknas som besvarat. */
/**
 * De tolv uppgifterna vi behöver per leverantör.
 *
 * `fraga` är formulerad som den ska STÄLLAS, inte som databasen heter. Sidan
 * används i ett möte eller ett telefonsamtal, och den som sitter där ska inte
 * behöva översätta "Produktdata och varumärke" till något att säga högt.
 */
const FRAGOR: { nr: number; rubrik: string; fraga: string; klar: (s: Supplier, i?: Integration) => boolean }[] = [
  { nr: 1,  rubrik: "Återförsäljaravtal",      fraga: "Har vi ett återförsäljaravtal, och får vi sälja hela sortimentet?",
    klar: (s) => s.agreement_status === "signed" || s.agreement_status === "declined" },
  { nr: 2,  rubrik: "Kundnummer och prislista", fraga: "Vilket kundnummer har vi hos er, och vilken prislista gäller för oss?",
    klar: (s) => !!s.customer_number && !!s.price_list_ref },
  { nr: 3,  rubrik: "Direktleverans tillåten",  fraga: "Får ni leverera direkt till vår slutkund, eller måste allt gå via oss?",
    klar: (s) => s.allows_dropship !== null },
  { nr: 4,  rubrik: "Integrationsväg",          fraga: "Hur lägger vi order hos er: API, EDI, PunchOut/OCI, SFTP, portal eller mejl?",
    klar: (_s, i) => !!i && i.status !== "simulerad" },
  { nr: 5,  rubrik: "Orderformat och adress",   fraga: "Vilket format vill ni ha ordern i, och till vilken adress eller portal?",
    klar: (s, i) => !!i?.order_format && (!!s.order_email || !!s.order_portal_url) },
  { nr: 6,  rubrik: "Lager och leveranstid",    fraga: "Kan vi få lagersaldo och leveranstider, och i så fall hur ofta?",
    klar: (s) => !!s.stock_data_method && s.stock_data_method !== "unknown" },
  { nr: 7,  rubrik: "Bekräftelse och tracking", fraga: "Hur får vi orderbekräftelsen, och hur får vi trackingnumret?",
    klar: (_s, i) => !!i?.ack_method && !!i?.tracking_method },
  { nr: 8,  rubrik: "Retur och garanti",        fraga: "Hur går en retur till, och vad gäller för garanti?",
    klar: (s) => !!s.returns_process && !!s.warranty_terms },
  { nr: 9,  rubrik: "Fraktvillkor",             fraga: "Vilka leveransvillkor gäller, och över vilket belopp är frakten fri?",
    klar: (s) => !!s.incoterms },
  { nr: 10, rubrik: "Betalningsvillkor",        fraga: "Vilka betalningsvillkor har vi, och finns det ett minsta ordervärde?",
    klar: (s) => !!s.payment_terms },
  { nr: 11, rubrik: "Produktdata och varumärke", fraga: "Får vi använda er produktdata, era bilder och ert varumärke på vår sajt?",
    klar: (s) => !!s.product_data_rights },
  { nr: 12, rubrik: "Systembyte på gång",       fraga: "Byter ni affärssystem, och påverkar det hur vi ska integrera?",
    klar: (s) => !!s.system_notes },
];

const AGREEMENT = ["unknown", "requested", "negotiating", "signed", "declined"];
const METHODS   = ["email_pdf", "api", "edi", "sftp", "punchout_oci", "portal", "manual"];
const STATUSES  = ["simulerad", "manuell", "vantar_pa_avtal", "verifierad", "avstangd"];
const FORMATS   = ["pdf_email", "json", "xml", "edifact", "csv", "manual"];
const ACK       = ["email", "api", "portal", "none"];
const TRACK     = ["email", "api", "portal", "carrier", "none"];
const STOCK     = ["unknown", "realtime_api", "daily_file", "portal", "none"];

function AdminLeverantorer() {
  const [rader, setRader] = useState<Supplier[]>([]);
  const [kanaler, setKanaler] = useState<Record<string, Integration>>({});
  const [oppen, setOppen] = useState<string | null>(null);
  const [sparar, setSparar] = useState(false);
  const [laddar, setLaddar] = useState(true);
  // Ett misslyckat spar MÅSTE synas. Utan det här står det inskrivna värdet
  // kvar i rutan som om det gått igenom, och den som fyller i formuläret tror
  // att uppgiften är insamlad. Tabellen är admin-only i RLS, så ett utgånget
  // pass eller en tappad roll ger exakt det tysta felet.
  const [fel, setFel] = useState<string | null>(null);
  const [sparatVid, setSparatVid] = useState<number | null>(null);

  async function ladda() {
    const [{ data: s }, { data: i }] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("supplier_integrations").select("*").eq("is_primary", true),
    ]);
    setRader((s as Supplier[]) ?? []);
    const karta: Record<string, Integration> = {};
    for (const rad of ((i as Integration[]) ?? [])) karta[rad.supplier_id] = rad;
    setKanaler(karta);
    setLaddar(false);
  }
  useEffect(() => { void ladda(); }, []);

  // updated_at sätts av en databastrigger (set_updated_at), inte härifrån --
  // en ändring gjord i SQL-editorn eller av en edge function ska röra den lika
  // säkert som ett klick i den här vyn.
  async function spara(id: string, patch: Omit<Partial<Supplier>, "updated_at">) {
    setSparar(true); setFel(null);
    const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
    setSparar(false);
    if (error) { setFel(`Kunde inte spara: ${error.message}`); await ladda(); return; }
    setRader((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setSparatVid(Date.now());
  }
  async function sparaKanal(supplierId: string, patch: Partial<Integration>) {
    const k = kanaler[supplierId];
    if (!k) return;
    setSparar(true); setFel(null);
    const { error } = await supabase.from("supplier_integrations").update(patch).eq("id", k.id);
    setSparar(false);
    if (error) { setFel(`Kunde inte spara: ${error.message}`); await ladda(); return; }
    setKanaler((c) => ({ ...c, [supplierId]: { ...c[supplierId], ...patch } }));
    setSparatVid(Date.now());
  }

  function klara(s: Supplier) {
    return FRAGOR.filter((f) => f.klar(s, kanaler[s.id])).length;
  }

  if (laddar) return <div className="p-8 text-gray-500">Laddar…</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900">Leverantörer</h1>
      <p className="mt-1 text-sm text-gray-600 max-w-3xl">
        En leverantör är den vi lägger inköpsordern hos — inte samma sak som tillverkaren.
        Köper vi Festo via distributör ska distributören ligga som egen leverantör.
        Order Engine får inte beställa från en leverantör som inte är aktiv.
      </p>

      {fel && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {fel}
          <span className="block text-xs text-red-600 mt-1">
            Fältet har laddats om från databasen, så det du ser nu är vad som faktiskt är sparat.
          </span>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {rader.map((s) => {
          const k = kanaler[s.id];
          const n = klara(s);
          const utvald = oppen === s.id;
          return (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <button
                onClick={() => setOppen(utvald ? null : s.id)}
                // Utan aria-label heter knappen ingenting: en skärmläsare säger
                // bara "knapp", åtta gånger. aria-expanded säger dessutom om
                // formuläret är öppet.
                aria-label={`${s.name}, ${n} av 12 uppgifter insamlade`}
                aria-expanded={utvald}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 rounded-xl"
              >
                <span className="font-semibold text-gray-900 w-40">{s.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {s.is_active ? "Aktiv" : "Inaktiv"}
                </span>
                <span className="text-xs text-gray-500">{k ? `${k.method} · ${k.status}` : "ingen kanal"}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="h-1.5 w-32 bg-gray-200 rounded-full overflow-hidden">
                    <span className="block h-full bg-blue-500" style={{ width: `${(n / 12) * 100}%` }} />
                  </span>
                  <span className="text-xs text-gray-500 tabular-nums">{n}/12</span>
                  {/* När uppgifterna senast rördes. En uppgift från i våras är
                      inte värd lika mycket som en från gårdagens samtal, och
                      utan datum går de inte att skilja åt. */}
                  <span className="text-[10px] text-gray-400 tabular-nums w-16 text-right">
                    {n > 0 && s.updated_at
                      ? new Date(s.updated_at).toLocaleDateString("sv-SE", { month: "short", day: "numeric" })
                      : ""}
                  </span>
                </span>
              </button>

              {utvald && (
                <div className="border-t border-gray-100 p-5 space-y-6">
                  <ol className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    {FRAGOR.map((f) => {
                      const klar = f.klar(s, k);
                      return (
                        <li key={f.nr} className={klar ? "text-green-700" : "text-gray-500"}>
                          <span className="font-medium">{klar ? "✓" : "○"} {f.nr}. {f.rubrik}</span>
                          {/* Frågan i klartext, för den som sitter i mötet. */}
                          {!klar && <span className="block pl-4 text-gray-400">{f.fraga}</span>}
                        </li>
                      );
                    })}
                  </ol>

                  <Grupp titel="1–3 · Avtal, kundnummer, direktleverans">
                    <Val label="Avtalsstatus" value={s.agreement_status} options={AGREEMENT}
                         onChange={(v) => spara(s.id, { agreement_status: v })} />
                    <Falt label="Kundnummer hos leverantören" value={s.customer_number}
                          onSave={(v) => spara(s.id, { customer_number: v })} />
                    <Falt label="Prislista (referens/version)" value={s.price_list_ref}
                          onSave={(v) => spara(s.id, { price_list_ref: v })} />
                    <Val label="Direktleverans till slutkund" value={s.allows_dropship === null ? "" : String(s.allows_dropship)}
                         options={["", "true", "false"]} etiketter={{ "": "obesvarad", true: "ja", false: "nej" }}
                         onChange={(v) => spara(s.id, { allows_dropship: v === "" ? null : v === "true" })} />
                  </Grupp>

                  <Grupp titel="4–7 · Integration, order, lager, bekräftelse">
                    <Val label="Integrationsväg" value={k?.method ?? ""} options={METHODS}
                         onChange={(v) => sparaKanal(s.id, { method: v })} />
                    <Val label="Status" value={k?.status ?? ""} options={STATUSES}
                         onChange={(v) => sparaKanal(s.id, { status: v })} />
                    <Val label="Orderformat" value={k?.order_format ?? ""} options={FORMATS}
                         onChange={(v) => sparaKanal(s.id, { order_format: v })} />
                    <Falt label="Beställningsadress (e-post)" value={s.order_email}
                          onSave={(v) => spara(s.id, { order_email: v })} />
                    <Falt label="Beställningsportal (URL)" value={s.order_portal_url}
                          onSave={(v) => spara(s.id, { order_portal_url: v })} />
                    <Val label="Lager- och leveranstidsdata" value={s.stock_data_method ?? ""} options={STOCK}
                         onChange={(v) => spara(s.id, { stock_data_method: v })} />
                    <Val label="Orderbekräftelse kommer via" value={k?.ack_method ?? ""} options={ACK}
                         onChange={(v) => sparaKanal(s.id, { ack_method: v })} />
                    <Val label="Tracking kommer via" value={k?.tracking_method ?? ""} options={TRACK}
                         onChange={(v) => sparaKanal(s.id, { tracking_method: v })} />
                  </Grupp>

                  <Grupp titel="8–12 · Retur, frakt, betalning, data, system">
                    <Falt label="Returprocess" value={s.returns_process} bred
                          onSave={(v) => spara(s.id, { returns_process: v })} />
                    <Falt label="Garantivillkor" value={s.warranty_terms} bred
                          onSave={(v) => spara(s.id, { warranty_terms: v })} />
                    <Falt label="Incoterms" value={s.incoterms}
                          onSave={(v) => spara(s.id, { incoterms: v })} />
                    <Falt label="Fraktfritt över (belopp)" value={s.free_freight_over?.toString() ?? null}
                          onSave={(v) => spara(s.id, { free_freight_over: v ? Number(v) : null })} />
                    <Falt label="Minsta ordervärde" value={s.min_order_value?.toString() ?? null}
                          onSave={(v) => spara(s.id, { min_order_value: v ? Number(v) : null })} />
                    <Falt label="Betalningsvillkor" value={s.payment_terms}
                          onSave={(v) => spara(s.id, { payment_terms: v })} />
                    <Falt label="Regler för produktdata och varumärke" value={s.product_data_rights} bred
                          onSave={(v) => spara(s.id, { product_data_rights: v })} />
                    <Falt label="Systembyte på gång (t.ex. SAP → annat)" value={s.system_notes} bred
                          onSave={(v) => spara(s.id, { system_notes: v })} />
                  </Grupp>

                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={s.is_active}
                             onChange={(e) => spara(s.id, { is_active: e.target.checked })} />
                      Aktiv — får ta emot inköpsordrar
                    </label>
                    {n < 12 && s.is_active && (
                      <span className="text-xs text-amber-600">
                        {12 - n} frågor obesvarade
                      </span>
                    )}
                    <span className="ml-auto text-xs">
                      {sparar
                        ? <span className="text-gray-400">sparar…</span>
                        : sparatVid && Date.now() - sparatVid < 4000
                          ? <span className="text-green-600">✓ sparat</span>
                          : null}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Grupp({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{titel}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

/** Textfält som sparar vid blur — inte vid varje tangenttryck. */
function Falt({ label, value, onSave, bred }: {
  label: string; value: string | null; onSave: (v: string) => void; bred?: boolean;
}) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <label className={`block text-sm ${bred ? "col-span-2" : ""}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== (value ?? "")) onSave(v); }}
        className="mt-0.5 w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </label>
  );
}

function Val({ label, value, options, onChange, etiketter }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
  etiketter?: Record<string, string>;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>{etiketter?.[o] ?? (o === "" ? "—" : o)}</option>
        ))}
      </select>
    </label>
  );
}

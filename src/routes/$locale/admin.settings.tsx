/**
 * /admin/settings
 * Edit company details that appear in document headers (OE, OC, etc.)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  fetchCompanySettings,
  saknadeBolagsuppgifter,
  saveCompanySetting,
  type CompanySettings,
} from "@/lib/company-settings";
import { useAdminGuard } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/admin/settings")({
  component: AdminSettingsPage,
});

type Field = {
  key: keyof CompanySettings;
  label: string;
  placeholder?: string;
};

const FIELDS: Field[] = [
  { key: "name",      label: "Företagsnamn",         placeholder: "Maskinval AB" },
  { key: "org",       label: "Organisationsnummer",   placeholder: "556000-0000" },
  { key: "vat",       label: "Momsregistreringsnr",   placeholder: "SE556000000001" },
  { key: "address",   label: "Gatuadress",            placeholder: "Industrivägen 1" },
  { key: "postal",    label: "Postnr och stad",        placeholder: "123 45 Stockholm" },
  { key: "email",     label: "E-post",                placeholder: "info@maskinval.se" },
  { key: "phone",     label: "Telefon",               placeholder: "+46 8 000 00 00" },
  { key: "web",       label: "Webbadress",            placeholder: "maskinval.se" },
  { key: "bankgiro",  label: "Bankgiro",              placeholder: "123-4567" },
];

export default function AdminSettingsPage() {
  const { locale } = Route.useParams();
  const { isAdmin, authLoading } = useAdminGuard();

  const [form, setForm] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchCompanySettings().then((s) => {
        setForm(s);
        setLoading(false);
      });
    }
  }, [isAdmin, authLoading]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await Promise.all(
        (Object.keys(form) as (keyof CompanySettings)[]).map((k) =>
          saveCompanySetting(k, form[k])
        )
      );
      setSaved(true);
    } catch (err) {
      setError("Kunde inte spara. Försök igen.");
      console.error(err);
    }
    setSaving(false);
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="size-6 rounded-full border-2 border-info/30 border-t-info animate-spin" />
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="container-page max-w-2xl py-10">
      <div className="mb-8">
        <a
          href={`/${locale}/admin`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Admin
        </a>
        <h1 className="mt-3 text-2xl font-bold text-foreground">Företagsinställningar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dessa uppgifter visas i rubriken på alla dokument (offerter, orderbekräftelser, fakturor).
        </p>
        {form && saknadeBolagsuppgifter(form).length > 0 && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Bolagsuppgifterna är inte ifyllda: {saknadeBolagsuppgifter(form).map((k) => ({
              org: "organisationsnummer", vat: "momsregistreringsnummer", address: "adress", postal: "postnummer och ort", phone: "telefon",
            } as Record<string, string>)[k] ?? k).join(", ")}. Kundens offert och orderbekräftelse visar dem tomma tills de är ifyllda.
            (Fram till 2026-10-03 låg platshållare här, t.ex. org.nr 556000-0000, och de skrevs ut på dokumenten.)
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label, placeholder }) => (
            <label key={key} className="block">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {label}
              </span>
              <input
                type="text"
                value={form[key]}
                placeholder={placeholder}
                onChange={(e) => {
                  setForm((prev) => prev ? { ...prev, [key]: e.target.value } : prev);
                  setSaved(false);
                }}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-info/40"
              />
            </label>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 rounded-lg border border-border bg-muted/30 text-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Förhandsgranskning (dokumenthuvud)</div>
          <div className="font-bold text-foreground text-base">{form.name || "—"}</div>
          <div className="text-muted-foreground mt-0.5 space-y-0.5 text-xs">
            {form.address && <div>{form.address}, {form.postal}</div>}
            {(form.email || form.phone) && (
              <div>
                {form.email}{form.email && form.phone ? " · " : ""}{form.phone}
              </div>
            )}
            {form.org && <div>Org.nr {form.org}</div>}
            {form.vat && <div>Momsreg.nr {form.vat}</div>}
            {form.bankgiro && <div>Bankgiro {form.bankgiro}</div>}
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm rounded-md bg-info text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Sparar…" : "Spara inställningar"}
          </button>
          {saved && (
            <span className="text-sm text-success-deep">✓ Sparat</span>
          )}
        </div>
      </form>

      <PrisVisning />
      <ValutaPaslag />
    </div>
  );
}

/**
 * Strömbrytaren för publika priser (site_content 'priser.visa'). Databas-
 * funktionen publika_priser lämnar inget pris förrän den står på 'ja', så en
 * inläst prislista kan kontrolleras i Prissättning innan kunderna ser den.
 */
/**
 * Valutapåslaget på offerter i euro (ägaren 2026-11-13: "kör på det alla
 * brukar ha"). Täcker bankens växlingsavgift och kursrörelsen fram till
 * betalning. Kursen hämtas från Riksbanken när offerten räknas om.
 */
function ValutaPaslag() {
  const [varde, setVarde] = useState("2");
  const [sparat, setSparat] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", "valuta.paslag").maybeSingle()
      .then(({ data }) => { if (data?.value) setVarde(data.value); });
  }, []);
  async function spara() {
    const n = Number(varde.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 20) { setSparat("Ange 0–20 %."); return; }
    const { error } = await supabase.from("site_content")
      .upsert({ key: "valuta.paslag", locale: "all", value: String(n) }, { onConflict: "key,locale" });
    setSparat(error ? "Kunde inte spara." : "Sparat.");
  }
  return (
    <section className="mt-10 rounded-lg border border-border p-4 text-sm">
      <h2 className="text-base font-semibold text-foreground">Valutapåslag</h2>
      <p className="mt-1 text-muted-foreground">
        Utländska kunder får offerten i euro. Priserna räknas om från kronor med Riksbankens dagskurs
        plus det här påslaget, som täcker växlingsavgiften och kursrörelsen fram till betalningen.
        2 % är vanligt i B2B. Kursen och påslaget sparas på varje offert.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input value={varde} onChange={(e) => { setVarde(e.target.value); setSparat(null); }}
          className="w-20 border border-border rounded px-2 py-1" inputMode="decimal" /> <span>%</span>
        <button onClick={spara} className="px-3 py-1 rounded-md border border-info text-info hover:bg-info/10 transition">Spara</button>
        {sparat && <span className="text-xs text-muted-foreground">{sparat}</span>}
      </div>
    </section>
  );
}

function PrisVisning() {
  const [pa, setPa] = useState<boolean | null>(null);
  const [lage, setLage] = useState<{ medPris: number; visas: number; felMarginal: number } | null>(null);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", "priser.visa").maybeSingle()
      .then(({ data }) => setPa(data?.value === "ja"));
    (supabase as unknown as { rpc: (fn: string) => Promise<{ data: unknown }> })
      .rpc("admin_list_product_pricing")
      .then(({ data }) => {
        if (!Array.isArray(data)) return;
        const rader = data as { purchase_price: number | null; margin: number | null }[];
        const medPris = rader.filter((r) => r.purchase_price != null && r.purchase_price > 0);
        const ok = (m: number | null) => m != null && m >= 1 && m <= 95;
        setLage({
          medPris: medPris.length,
          visas: medPris.filter((r) => ok(r.margin)).length,
          felMarginal: rader.filter((r) => r.margin != null && r.margin < 1).length,
        });
      });
  }, []);

  async function vaxla(nytt: boolean) {
    setSparar(true);
    setFel(null);
    const { error } = await supabase
      .from("site_content")
      .upsert({ key: "priser.visa", locale: "all", value: nytt ? "ja" : "nej" }, { onConflict: "key,locale" });
    if (error) setFel("Kunde inte spara. Försök igen.");
    else setPa(nytt);
    setSparar(false);
  }

  return (
    <section className="mt-10 rounded-lg border border-border p-4 text-sm">
      <h2 className="text-base font-semibold text-foreground">Priser på sajten</h2>
      <p className="mt-1 text-muted-foreground">
        När det här är på visar produktsidorna säljpriset exkl. moms (inköpspris ÷ (1 − marginal)),
        avrundat till hela kronor och märkt som indikativt. Inköpspris och marginal visas aldrig.
        En serie utan artikelnummer visas som "från" och sägs gälla seriens billigaste variant – ange då den.
        Pris äldre än 365 dagar visas inte.
      </p>
      {lage && (
        <ul className="mt-3 space-y-1 text-muted-foreground">
          <li>{lage.medPris} artiklar har inköpspris, {lage.visas} av dem får visas.</li>
          {lage.felMarginal > 0 && (
            <li className="text-destructive">
              {lage.felMarginal} artiklar har en marginal under 1 % (0,35 – en rest från när marginalen var ett
              bråktal). De visas inte förrän marginalen är rättad i Prissättning, där en knapp ger dem
              kategorins vanliga marginal.
            </li>
          )}
        </ul>
      )}
      <label className="mt-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={pa === true}
          disabled={pa === null || sparar}
          onChange={(e) => vaxla(e.target.checked)}
        />
        <span className="font-medium text-foreground">Visa priser på produktsidorna</span>
        {sparar && <span className="text-muted-foreground">Sparar…</span>}
      </label>
      {fel && <p className="mt-2 text-destructive">{fel}</p>}
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/auth-context";

const FUNCTION_URL = "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/welcome-email";

export const Route = createFileRoute("/$locale/admin/crm")({
  component: CrmPage,
});

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  company_name: string | null;
  org_number: string | null;
  industry: string | null;
  role: string | null;
  employees: string | null;
  address_city: string | null;
  address_country: string;
  customer_number: string | null;
  score: number;
  score_tier: string;
  score_breakdown: Record<string, number>;
  profile_complete: boolean;
  created_at: string;
};

const COUNTRIES_LIST = [
  { v: "SE", l: "Sverige" }, { v: "DE", l: "Deutschland" }, { v: "NO", l: "Norge" },
  { v: "DK", l: "Danmark" }, { v: "FI", l: "Finland" }, { v: "NL", l: "Netherlands" },
  { v: "GB", l: "United Kingdom" }, { v: "AT", l: "Österreich" }, { v: "CH", l: "Schweiz" },
  { v: "FR", l: "France" }, { v: "ES", l: "España" }, { v: "IT", l: "Italia" },
  { v: "PL", l: "Polska" }, { v: "US", l: "United States" }, { v: "OTHER", l: "Annan / Other" },
];
const INDUSTRIES_LIST = [
  { v: "automation", l: "Automation & robotics" }, { v: "manufacturing", l: "Tillverkning" },
  { v: "automotive", l: "Fordon / Automotive" }, { v: "food", l: "Livsmedel" },
  { v: "pharma", l: "Pharma & medtech" }, { v: "energy", l: "Energi" },
  { v: "aerospace", l: "Aerospace" }, { v: "marine", l: "Marin" }, { v: "other", l: "Annat" },
];
const ROLES_LIST = [
  { v: "engineer", l: "Konstruktör" }, { v: "buyer", l: "Inköp" },
  { v: "manager", l: "Chef" }, { v: "technician", l: "Tekniker" },
  { v: "designer", l: "Designer" }, { v: "other", l: "Annat" },
];
const SIZES_LIST = [
  { v: "1", l: "1 (bara mig)" }, { v: "2-10", l: "2–10" },
  { v: "11-50", l: "11–50" }, { v: "51-200", l: "51–200" }, { v: "201+", l: "201+" },
];

type NewCustomer = {
  display_name: string;
  email: string;
  company_name: string;
  org_number: string;
  vat_number: string;
  phone: string;
  industry: string;
  role: string;
  employees: string;
  address_country: string;
  address_city: string;
  address_street: string;
  address_postal: string;
  customer_number: string;
};

const EMPTY: NewCustomer = {
  display_name: "", email: "", company_name: "", org_number: "", vat_number: "",
  phone: "", industry: "", role: "", employees: "", address_country: "SE",
  address_city: "", address_street: "", address_postal: "", customer_number: "",
};

function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: (p: Profile) => void }) {
  const [form, setForm] = useState<NewCustomer>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: keyof NewCustomer, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.display_name || !form.company_name) {
      setErr("Namn, e-post och företagsnamn krävs."); return;
    }
    setSaving(true);
    setErr(null);

    // Generate a UUID for this manual customer
    const id = crypto.randomUUID();

    // Calculate a basic score
    const score = 10; // Base score for manually added customer

    const payload = {
      id,
      display_name:    form.display_name || null,
      email:           form.email || null,
      company_name:    form.company_name || null,
      org_number:      form.org_number || null,
      vat_number:      form.vat_number || null,
      phone:           form.phone || null,
      industry:        form.industry || null,
      role:            form.role || null,
      employees:       form.employees || null,
      address_country: form.address_country || "OTHER",
      address_city:    form.address_city || null,
      address_street:  form.address_street || null,
      address_postal:  form.address_postal || null,
      customer_number: form.customer_number || null,
      locale:          "sv",
      profile_complete: !!(form.company_name && form.industry && form.role && form.employees && form.phone),
      score,
      score_tier:      "cold",
      score_breakdown: { manual: score },
    };

    const { data, error } = await (supabase as any)
      .from("company_profiles")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      setErr(`Fel: ${error.message}`);
      setSaving(false);
      return;
    }

    onSaved(data as Profile);
    onClose();
  }

  function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <label className="block">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="mt-1">{children}</div>
      </label>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Lägg till kund manuellt</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Skapar en kundprofil utan Supabase-konto — används för utländska företag</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <form onSubmit={save} className="p-6 space-y-5">
          {/* Contact */}
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Kontaktperson</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <ModalField label="Namn *">
                <input required value={form.display_name} onChange={(e) => set("display_name", e.target.value)}
                  placeholder="Anna Lindgren"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </ModalField>
              <ModalField label="E-post *">
                <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                  placeholder="anna@company.de"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </ModalField>
              <ModalField label="Telefon">
                <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)}
                  placeholder="+49 30 12345678"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </ModalField>
              <ModalField label="Roll">
                <select value={form.role} onChange={(e) => set("role", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Välj roll</option>
                  {ROLES_LIST.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </ModalField>
            </div>
          </div>

          {/* Company */}
          <div className="border-t border-border pt-5">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Företag</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <ModalField label="Företagsnamn *">
                <input required value={form.company_name} onChange={(e) => set("company_name", e.target.value)}
                  placeholder="Müller GmbH"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </ModalField>
              <ModalField label="Land">
                <select value={form.address_country} onChange={(e) => set("address_country", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {COUNTRIES_LIST.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </ModalField>
              <ModalField label={form.address_country === "SE" ? "Organisationsnummer" : "Reg.nr (lokalt)"}>
                <input value={form.org_number} onChange={(e) => set("org_number", e.target.value)}
                  placeholder={form.address_country === "SE" ? "556123-4567" : "HRB 123456"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </ModalField>
              <ModalField label="VAT-nummer (EU)">
                <input value={form.vat_number} onChange={(e) => set("vat_number", e.target.value)}
                  placeholder="DE123456789"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </ModalField>
              <ModalField label="Bransch">
                <select value={form.industry} onChange={(e) => set("industry", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Välj bransch</option>
                  {INDUSTRIES_LIST.map((i) => <option key={i.v} value={i.v}>{i.l}</option>)}
                </select>
              </ModalField>
              <ModalField label="Antal anställda">
                <select value={form.employees} onChange={(e) => set("employees", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Välj storlek</option>
                  {SIZES_LIST.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </ModalField>
            </div>
          </div>

          {/* Address */}
          <div className="border-t border-border pt-5">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Adress & kundnr</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <ModalField label="Stad">
                <input value={form.address_city} onChange={(e) => set("address_city", e.target.value)}
                  placeholder="Berlin"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </ModalField>
              <ModalField label="Postnummer">
                <input value={form.address_postal} onChange={(e) => set("address_postal", e.target.value)}
                  placeholder="10115"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </ModalField>
              <div className="sm:col-span-2">
                <ModalField label="Gatuadress">
                  <input value={form.address_street} onChange={(e) => set("address_street", e.target.value)}
                    placeholder="Unter den Linden 1"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </ModalField>
              </div>
              <ModalField label="Kundnummer (valfritt — lämna tomt för auto)">
                <input value={form.customer_number} onChange={(e) => set("customer_number", e.target.value)}
                  placeholder="MV-2026-0042"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </ModalField>
            </div>
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}

          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:border-info hover:text-foreground">
              Avbryt
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-md bg-info text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? "Sparar…" : "Skapa kundprofil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TIER_META: Record<string, { label: string; emoji: string; dot: string }> = {
  enterprise: { label: "Enterprise",  emoji: "⭐", dot: "bg-[oklch(0.62_0.17_55)]" },
  hot:        { label: "Hot",         emoji: "🔥", dot: "bg-[oklch(0.58_0.20_30)]" },
  warm:       { label: "Warm",        emoji: "🌡️", dot: "bg-[oklch(0.62_0.15_75)]" },
  cold:       { label: "Cold",        emoji: "❄️", dot: "bg-muted-foreground" },
};

export default function CrmPage() {
  const { locale } = Route.useParams() as { locale: string };
  const isAdmin = useIsAdmin();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [testEmail, setTestEmail] = useState("alexandrooden@gmail.com");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function sendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          name: "Alexander",
          customer_number: "MV-2026-0001",
          locale,
        }),
      });
      const data = await res.json();
      setTestResult(res.ok ? "✓ Testemejl skickat!" : `Fel: ${JSON.stringify(data)}`);
    } catch (err) {
      setTestResult(`Fel: ${err}`);
    }
    setTestSending(false);
  }

  useEffect(() => {
    (supabase as any)
      .from("company_profiles")
      .select("*")
      .order("score", { ascending: false })
      .then(({ data }: { data: any }) => {
        setProfiles((data ?? []) as Profile[]);
        setLoading(false);
      });
  }, []);

  const tiers = ["enterprise", "hot", "warm", "cold"];
  const counts = Object.fromEntries(
    tiers.map((t) => [t, profiles.filter((p) => p.score_tier === t).length])
  );

  const visible = profiles.filter((p) => {
    if (filter !== "all" && p.score_tier !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [p.display_name, p.email, p.company_name, p.customer_number].some(
        (v) => v?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) return <div className="container-page py-16 text-sm text-muted-foreground">Laddar CRM…</div>;

  const avgScore = profiles.length
    ? Math.round(profiles.reduce((s, p) => s + p.score, 0) / profiles.length)
    : 0;
  const complete = profiles.filter((p) => p.profile_complete).length;

  return (
    <div className="container-page py-8">
      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onSaved={(p) => setProfiles((prev) => [p, ...prev])}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM — Kunder</h1>
          <p className="text-sm text-muted-foreground mt-1">{profiles.length} registrerade · snitt {avgScore} poäng · {complete} fullständiga profiler</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <span className="text-base leading-none">+</span>
          Lägg till kund manuellt
        </button>
      </div>

      {/* Test welcome email panel */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">📧 Skicka testemejl</p>
        <form onSubmit={sendTestEmail} className="flex gap-2 flex-wrap">
          <input
            type="email"
            required
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 min-w-[220px] px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
          />
          <button
            type="submit"
            disabled={testSending}
            className="px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {testSending ? "Skickar…" : "Skicka välkomstmejl"}
          </button>
        </form>
        {testResult && (
          <p className={`mt-2 text-sm ${testResult.startsWith("✓") ? "text-[oklch(0.55_0.15_155)]" : "text-destructive"}`}>
            {testResult}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Kräver att <code className="bg-surface-alt px-1 rounded">RESEND_API_KEY</code> är satt i Supabase Edge Function Secrets.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {tiers.map((tier) => {
          const m = TIER_META[tier];
          return (
            <button key={tier} onClick={() => setFilter(filter === tier ? "all" : tier)}
              className={`rounded-xl border p-4 text-left transition ${filter === tier ? "border-info bg-info/8" : "border-border bg-card hover:border-info/50"}`}>
              <div className="text-2xl">{m.emoji}</div>
              <div className="text-2xl font-bold mt-1">{counts[tier] ?? 0}</div>
              <div className="text-xs text-muted-foreground">{m.label}</div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök namn, e-post, företag, kundnr…"
          className="w-full max-w-sm px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-info/50" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Poäng</th>
                <th className="px-4 py-3">Kund</th>
                <th className="px-4 py-3">Företag</th>
                <th className="px-4 py-3">Bransch / Roll</th>
                <th className="px-4 py-3">Land</th>
                <th className="px-4 py-3">Kundnr</th>
                <th className="px-4 py-3">Registrerad</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const tm = TIER_META[p.score_tier] ?? TIER_META.cold;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-alt/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`size-2 rounded-full ${tm.dot}`} />
                        <span className="font-bold tabular-nums">{p.score}</span>
                        <span className="text-[10px] text-muted-foreground">{tm.emoji}</span>
                      </div>
                      <ScoreBar score={p.score} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {p.company_name ?? <span className="text-muted-foreground italic">Ej angivet</span>}
                        {p.address_country !== "SE" && (
                          <span className="text-[10px] bg-surface-alt border border-border rounded px-1.5 py-0.5 text-muted-foreground font-medium">
                            Utländsk
                          </span>
                        )}
                      </div>
                      {p.org_number && <div className="text-xs text-muted-foreground font-mono">{p.org_number}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="capitalize">{p.industry ?? "—"}</div>
                      <div className="text-xs text-muted-foreground capitalize">{p.role ?? "—"} · {p.employees ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <FlagChip country={p.address_country} city={p.address_city} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.customer_number ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("sv-SE")}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Inga kunder matchar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-16 h-1 rounded-full bg-border mt-1 overflow-hidden">
      <div className="h-full bg-info rounded-full" style={{ width: `${score}%` }} />
    </div>
  );
}

const FLAG: Record<string, string> = {
  SE:"🇸🇪", DE:"🇩🇪", NO:"🇳🇴", DK:"🇩🇰", FI:"🇫🇮",
  NL:"🇳🇱", GB:"🇬🇧", AT:"🇦🇹", CH:"🇨🇭", FR:"🇫🇷",
  ES:"🇪🇸", IT:"🇮🇹", PL:"🇵🇱",
};
function FlagChip({ country, city }: { country: string; city: string | null }) {
  return (
    <span className="flex items-center gap-1">
      <span>{FLAG[country] ?? "🌍"}</span>
      <span>{city ?? country}</span>
    </span>
  );
}

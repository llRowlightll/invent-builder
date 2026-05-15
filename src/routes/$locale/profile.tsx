import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/$locale/profile")({
  component: ProfilePage,
});

const TIER_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  enterprise: { label: "Enterprise",  emoji: "⭐", color: "text-[oklch(0.55_0.18_55)]",  bg: "bg-[oklch(0.96_0.05_55)]  border-[oklch(0.80_0.12_55)]" },
  hot:        { label: "Hot prospect", emoji: "🔥", color: "text-[oklch(0.50_0.20_30)]",  bg: "bg-[oklch(0.96_0.05_30)]  border-[oklch(0.78_0.14_30)]" },
  warm:       { label: "Warm lead",    emoji: "🌡️", color: "text-[oklch(0.50_0.15_75)]",  bg: "bg-[oklch(0.96_0.04_75)]  border-[oklch(0.80_0.10_75)]" },
  cold:       { label: "Cold",         emoji: "❄️", color: "text-muted-foreground",        bg: "bg-surface-alt border-border" },
};

type Profile = {
  display_name: string | null;
  email: string | null;
  company_name: string | null;
  org_number: string | null;
  industry: string | null;
  role: string | null;
  employees: string | null;
  phone: string | null;
  address_street: string | null;
  address_postal: string | null;
  address_city: string | null;
  address_country: string;
  customer_number: string | null;
  score: number;
  score_tier: string;
  score_breakdown: Record<string, number>;
  profile_complete: boolean;
};

function ProfilePage() {
  const params = Route.useParams() as { locale: string };
  const { locale } = params;
  const t = makeT(locale as Locale);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [edit, setEdit] = useState<Partial<Profile>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/$locale/login" as never, params: { locale } as never, replace: true }); return; }
    (supabase as any)
      .from("company_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          setProfile(data as Profile);
          setEdit(data as Profile);
        }
        setLoading(false);
      });
  }, [user, authLoading]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const complete = !!(edit.company_name && edit.industry && edit.role && edit.employees);
    await supabase.from("company_profiles").upsert({
      id: user.id,
      ...edit,
      profile_complete: complete,
    });
    const { data } = await supabase.from("company_profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) { setProfile(data as Profile); setEdit(data as Profile); }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading || authLoading) {
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const tier = TIER_META[profile?.score_tier ?? "cold"] ?? TIER_META.cold;
  const score = profile?.score ?? 0;
  const breakdown = (profile?.score_breakdown ?? {}) as Record<string, number>;

  return (
    <div className="container-page py-10 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Min profil</h1>
          {profile?.customer_number && (
            <p className="text-xs font-mono text-muted-foreground mt-1">
              Kundnr: <span className="text-foreground font-medium">{profile.customer_number}</span>
            </p>
          )}
        </div>

        {/* Score card */}
        <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${tier.bg}`}>
          <div className="text-3xl">{tier.emoji}</div>
          <div>
            <div className={`text-xs uppercase tracking-widest font-semibold ${tier.color}`}>{tier.label}</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-3xl font-bold ${tier.color}`}>{score}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            {/* Score bar */}
            <div className="w-32 h-1.5 rounded-full bg-border mt-1.5 overflow-hidden">
              <div className="h-full bg-info rounded-full transition-all" style={{ width: `${score}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      {Object.keys(breakdown).length > 1 && (
        <div className="rounded-lg border border-border bg-card p-4 mb-8">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Poängfördelning</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { key: "domain",   label: "E-postdomän",  max: 12 },
              { key: "size",     label: "Bolagsstorlek", max: 20 },
              { key: "industry", label: "Bransch",       max: 22 },
              { key: "role",     label: "Roll",          max: 16 },
              { key: "country",  label: "Land",          max: 18 },
              { key: "complete", label: "Fullständig",   max: 12 },
            ].map(({ key, label, max }) => {
              const pts = (breakdown[key] ?? 0) as number;
              const pct = Math.round((pts / max) * 100);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{pts}/{max}</span>
                  </div>
                  <div className="h-1 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-info/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {!profile?.profile_complete && (
            <p className="text-xs text-info mt-3">
              💡 Fyll i alla obligatoriska fält nedan för att få +12 poäng.
            </p>
          )}
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={saveProfile} className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Kontaktuppgifter</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Namn">
              <input value={edit.display_name ?? ""} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <Field label="E-post">
              <input type="email" value={edit.email ?? ""} disabled
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm opacity-60 cursor-not-allowed" />
            </Field>
            <Field label="Telefon">
              <input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                placeholder="+46 70 123 45 67"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Företag *</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Företagsnamn">
              <input value={edit.company_name ?? ""} onChange={(e) => setEdit({ ...edit, company_name: e.target.value })}
                placeholder="Acme AB"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <Field label="Org.nr / VAT">
              <input value={edit.org_number ?? ""} onChange={(e) => setEdit({ ...edit, org_number: e.target.value })}
                placeholder="556123-4567"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <Field label="Bransch">
              <select value={edit.industry ?? ""} onChange={(e) => setEdit({ ...edit, industry: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                <option value="">Välj…</option>
                {[["automation","Automation & robotics"],["manufacturing","Tillverkning"],["automotive","Fordon"],["food","Livsmedel"],["pharma","Pharma & medtech"],["energy","Energi"],["aerospace","Aerospace"],["marine","Marin"],["other","Annat"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Din roll">
              <select value={edit.role ?? ""} onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                <option value="">Välj…</option>
                {[["engineer","Konstruktör"],["buyer","Inköp"],["manager","Chef"],["technician","Tekniker"],["designer","Designer"],["student","Student"],["other","Annat"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Antal anställda">
              <select value={edit.employees ?? ""} onChange={(e) => setEdit({ ...edit, employees: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                <option value="">Välj…</option>
                {[["1","Bara jag"],["2-10","2–10"],["11-50","11–50"],["51-200","51–200"],["201+","201+"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Fakturaadress</h2>
          <div className="space-y-3">
            <Field label="Gatuadress">
              <input value={edit.address_street ?? ""} onChange={(e) => setEdit({ ...edit, address_street: e.target.value })}
                placeholder="Industrivägen 12"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Postnummer">
                <input value={edit.address_postal ?? ""} onChange={(e) => setEdit({ ...edit, address_postal: e.target.value })}
                  placeholder="12345"
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
              </Field>
              <Field label="Stad">
                <input value={edit.address_city ?? ""} onChange={(e) => setEdit({ ...edit, address_city: e.target.value })}
                  placeholder="Stockholm"
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
              </Field>
            </div>
            <Field label="Land">
              <select value={edit.address_country ?? "SE"} onChange={(e) => setEdit({ ...edit, address_country: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                {[["SE","Sverige"],["DE","Deutschland"],["NO","Norge"],["DK","Danmark"],["FI","Finland"],["NL","Netherlands"],["GB","United Kingdom"],["AT","Österreich"],["CH","Schweiz"],["FR","France"],["ES","España"],["IT","Italia"],["PL","Polska"],["OTHER","Annan"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Sparar…" : "Spara profil"}
          </button>
          {saved && <span className="text-sm text-[oklch(0.55_0.15_155)]">✓ Sparad!</span>}
          <Link to="/$locale/app" params={{ locale } as never}
            className="ml-auto text-sm text-muted-foreground hover:text-info">
            Gå till appen →
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

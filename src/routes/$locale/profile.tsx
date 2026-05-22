import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth, useIsAdmin } from "@/lib/auth-context";

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
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [edit, setEdit] = useState<Partial<Profile>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/$locale/login" as never, params: { locale } as never, replace: true }); return; }

    (supabase as any)
      .from("company_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(async ({ data }: { data: any }) => {
        // Check for pending signup profile data saved before email confirmation
        const pendingRaw = localStorage.getItem("mv_pending_profile");
        const pending = pendingRaw ? JSON.parse(pendingRaw) : null;

        if (data) {
          // Profile exists — merge any pending signup data into empty fields
          let merged = { ...data };
          if (pending) {
            const fields: (keyof Profile)[] = [
              "display_name","company_name","org_number","industry","role",
              "employees","phone","address_street","address_postal","address_city","address_country",
            ];
            for (const f of fields) {
              if (!merged[f] && pending[f]) merged[f] = pending[f];
            }
            if (!data.profile_complete && pending.profile_complete) {
              merged.profile_complete = true;
            }
            // Persist merged data back to DB and clear localStorage
            await (supabase as any).from("company_profiles").upsert({ id: user.id, ...merged });
            localStorage.removeItem("mv_pending_profile");
          }
          setProfile(merged as Profile);
          setEdit(merged as Profile);
        } else if (pending) {
          // No profile in DB yet — create it from pending signup data
          const newProfile = { id: user.id, email: user.email, ...pending };
          await (supabase as any).from("company_profiles").upsert(newProfile);
          localStorage.removeItem("mv_pending_profile");
          const { data: created } = await (supabase as any)
            .from("company_profiles").select("*").eq("id", user.id).maybeSingle();
          if (created) { setProfile(created as Profile); setEdit(created as Profile); }
        }
        setLoading(false);
      });
  }, [user, authLoading]);

  // Auto-save on edit change (debounced 1.5 s) — skip the very first population
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (!user || !profile) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistProfile(edit);
    }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [edit]);

  async function persistProfile(data: Partial<Profile>) {
    if (!user) return;
    setSaving(true);
    const complete = !!(data.company_name && data.industry && data.role && data.employees && data.phone);
    await (supabase as any).from("company_profiles").upsert({
      id: user.id,
      ...data,
      profile_complete: complete,
    });
    const { data: updated } = await (supabase as any).from("company_profiles").select("*").eq("id", user.id).maybeSingle();
    if (updated) setProfile(updated as Profile);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await persistProfile(edit);
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
          <h1 className="text-2xl font-semibold tracking-tight">{t("profilePage.title")}</h1>
          {profile?.customer_number && (
            <p className="text-xs font-mono text-muted-foreground mt-1">
              {t("profilePage.customerNumber")} <span className="text-foreground font-medium">{profile.customer_number}</span>
            </p>
          )}
        </div>

        {/* Score card — only visible to admins */}
        {isAdmin && (
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
              <div className="text-[10px] text-muted-foreground mt-1 opacity-60">Synlig enbart för admin</div>
            </div>
          </div>
        )}
      </div>

      {/* Score breakdown — only visible to admins */}
      {isAdmin && Object.keys(breakdown).length > 1 && (
        <div className="rounded-lg border border-border bg-card p-4 mb-8">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">{t("profilePage.scoreBreakdown")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { key: "domain",   labelKey: "profilePage.scoreEmailDomain" as const,  max: 12 },
              { key: "size",     labelKey: "profilePage.scoreCompanySize" as const, max: 20 },
              { key: "industry", labelKey: "profilePage.scoreIndustry" as const,       max: 22 },
              { key: "role",     labelKey: "profilePage.scoreRole" as const,          max: 16 },
              { key: "country",  labelKey: "profilePage.scoreCountry" as const,          max: 18 },
              { key: "complete", labelKey: "profilePage.scoreComplete" as const,   max: 12 },
            ].map(({ key, labelKey, max }) => {
              const pts = (breakdown[key] ?? 0) as number;
              const pct = Math.round((pts / max) * 100);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t(labelKey)}</span>
                    <span className="font-medium">{pts}/{max}</span>
                  </div>
                  <div className="h-1 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-info/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={saveProfile} className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t("profilePage.contactDetails")}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("profilePage.name")}>
              <input value={edit.display_name ?? ""} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <Field label={t("profilePage.email")}>
              <input type="email" value={edit.email ?? ""} disabled
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm opacity-60 cursor-not-allowed" />
            </Field>
            <Field label={t("profilePage.phone")}>
              <input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                placeholder="+46 70 123 45 67"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t("profilePage.company")}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("profilePage.companyName")}>
              <input value={edit.company_name ?? ""} onChange={(e) => setEdit({ ...edit, company_name: e.target.value })}
                placeholder="Acme AB"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <Field label={t("profilePage.orgNumber")}>
              <input value={edit.org_number ?? ""} onChange={(e) => setEdit({ ...edit, org_number: e.target.value })}
                placeholder="556123-4567"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <Field label={t("profilePage.industry")}>
              <select value={edit.industry ?? ""} onChange={(e) => setEdit({ ...edit, industry: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                <option value="">{t("profilePage.choose")}</option>
                {([["automation", t("profilePage.industryAutomation")],["manufacturing", t("profilePage.industryManufacturing")],["automotive", t("profilePage.industryAutomotive")],["food", t("profilePage.industryFood")],["pharma", t("profilePage.industryPharma")],["energy", t("profilePage.industryEnergy")],["aerospace", t("profilePage.industryAerospace")],["marine", t("profilePage.industryMarine")],["other", t("profilePage.industryOther")]] as [string,string][]).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label={t("profilePage.role")}>
              <select value={edit.role ?? ""} onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                <option value="">{t("profilePage.choose")}</option>
                {([["engineer", t("profilePage.roleEngineer")],["buyer", t("profilePage.roleBuyer")],["manager", t("profilePage.roleManager")],["technician", t("profilePage.roleTechnician")],["designer", t("profilePage.roleDesigner")],["student", t("profilePage.roleStudent")],["other", t("profilePage.roleOther")]] as [string,string][]).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label={t("profilePage.employees")}>
              <select value={edit.employees ?? ""} onChange={(e) => setEdit({ ...edit, employees: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                <option value="">{t("profilePage.choose")}</option>
                {([["1", t("profilePage.justMe")],["2-10","2–10"],["11-50","11–50"],["51-200","51–200"],["201+","201+"]] as [string,string][]).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t("profilePage.billingAddress")}</h2>
          <div className="space-y-3">
            <Field label={t("profilePage.streetAddress")}>
              <input value={edit.address_street ?? ""} onChange={(e) => setEdit({ ...edit, address_street: e.target.value })}
                placeholder="Industrivägen 12"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("profilePage.postalCode")}>
                <input value={edit.address_postal ?? ""} onChange={(e) => setEdit({ ...edit, address_postal: e.target.value })}
                  placeholder="12345"
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
              </Field>
              <Field label={t("profilePage.city")}>
                <input value={edit.address_city ?? ""} onChange={(e) => setEdit({ ...edit, address_city: e.target.value })}
                  placeholder="Stockholm"
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
              </Field>
            </div>
            <Field label={t("profilePage.country")}>
              <select value={edit.address_country ?? "SE"} onChange={(e) => setEdit({ ...edit, address_country: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                {([["SE","Sverige"],["DE","Deutschland"],["NO","Norge"],["DK","Danmark"],["FI","Finland"],["NL","Netherlands"],["GB","United Kingdom"],["AT","Österreich"],["CH","Schweiz"],["FR","France"],["ES","España"],["IT","Italia"],["PL","Polska"],["OTHER", t("profilePage.countryOther")]] as [string,string][]).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? t("profilePage.saving") : t("profilePage.saveProfile")}
          </button>
          {saving && <span className="text-sm text-muted-foreground">{t("profilePage.saving")}</span>}
          {saved && !saving && <span className="text-sm text-[oklch(0.55_0.15_155)]">{t("profilePage.saved")}</span>}
          <span className="ml-auto text-[11px] text-muted-foreground">{t("profilePage.autoSave")}</span>
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

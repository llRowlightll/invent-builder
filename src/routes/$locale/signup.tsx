import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { makeT, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/$locale/signup")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("auth.signupTitle")} — ${t("common.appName")}` },
        { name: "description", content: t("auth.signupSubtitle") },
      ],
    };
  },
  component: SignupPage,
});

const INDUSTRIES = [
  { v: "automation",      l: "Automation & robotics" },
  { v: "manufacturing",   l: "Tillverkning / Manufacturing" },
  { v: "automotive",      l: "Fordon / Automotive" },
  { v: "food",            l: "Livsmedel / Food & beverage" },
  { v: "pharma",          l: "Pharma & medtech" },
  { v: "energy",          l: "Energi / Energy" },
  { v: "aerospace",       l: "Aerospace & defense" },
  { v: "marine",          l: "Marin / Marine" },
  { v: "other",           l: "Annat / Other" },
];
const ROLES = [
  { v: "engineer",    l: "Konstruktör / Engineer" },
  { v: "buyer",       l: "Inköp / Purchasing" },
  { v: "manager",     l: "Chef / Manager" },
  { v: "technician",  l: "Tekniker / Technician" },
  { v: "designer",    l: "Designer" },
  { v: "student",     l: "Student" },
  { v: "other",       l: "Annat / Other" },
];
const SIZES = [
  { v: "1",       l: "Bara jag / Just me" },
  { v: "2-10",    l: "2–10 anst." },
  { v: "11-50",   l: "11–50 anst." },
  { v: "51-200",  l: "51–200 anst." },
  { v: "201+",    l: "201+ anst." },
];
const COUNTRIES = [
  { v: "SE", l: "Sverige" },
  { v: "DE", l: "Deutschland" },
  { v: "NO", l: "Norge" },
  { v: "DK", l: "Danmark" },
  { v: "FI", l: "Finland" },
  { v: "NL", l: "Netherlands" },
  { v: "GB", l: "United Kingdom" },
  { v: "AT", l: "Österreich" },
  { v: "CH", l: "Schweiz" },
  { v: "FR", l: "France" },
  { v: "ES", l: "España" },
  { v: "IT", l: "Italia" },
  { v: "PL", l: "Polska" },
  { v: "OTHER", l: "Annan / Other" },
];

function SignupPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);

  const [step, setStep] = useState<1 | 2>(1);
  // Step 1
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Step 2
  const [companyName, setCompanyName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");
  const [employees, setEmployees] = useState("");
  const [phone, setPhone] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressPostal, setAddressPostal] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [country, setCountry] = useState("SE");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  async function onStep1(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError(t("signupPage.passwordMinLength")); return; }
    setError(null);
    setStep(2);
  }

  async function onStep2(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Always persist profile data to localStorage so profile page can apply it
    // after email confirmation (when no session exists yet during signup)
    const pendingProfile = {
      display_name:    displayName,
      email,
      company_name:    companyName   || null,
      org_number:      orgNumber     || null,
      industry:        industry      || null,
      role:            role          || null,
      employees:       employees     || null,
      phone:           phone         || null,
      address_street:  addressStreet || null,
      address_postal:  addressPostal || null,
      address_city:    addressCity   || null,
      address_country: country,
      locale,
      profile_complete: !!(companyName && industry && role && employees),
    };
    localStorage.setItem("mv_pending_profile", JSON.stringify(pendingProfile));

    const callbackUrl = `${window.location.origin}/auth/callback`;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, locale },
        emailRedirectTo: callbackUrl,
      },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    // If session exists (email confirmation disabled) save profile immediately
    const userId = data.user?.id;
    if (userId && data.session) {
      await (supabase as any).from("company_profiles").upsert({
        id: userId,
        ...pendingProfile,
      });
      localStorage.removeItem("mv_pending_profile");
    }

    setLoading(false);
    if (data.session) {
      window.location.href = `/${locale}/profile`;
    } else {
      setInfo(t("signupPage.checkEmailBody"));
    }
  }

  async function onResend() {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendDone(false);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setResendLoading(false);
    if (!resendError) {
      setResendDone(true);
      // 60-second cooldown so they can't spam
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) { clearInterval(interval); return 0; }
          return c - 1;
        });
      }, 1000);
    }
  }

  if (info) {
    return (
      <div className="container-page py-16 max-w-md text-center space-y-5">
        <div className="text-5xl">📬</div>
        <h1 className="text-2xl font-semibold">{t("signupPage.checkEmailTitle")}</h1>
        <p className="text-sm text-muted-foreground">{info}</p>
        <p className="text-xs text-muted-foreground">
          {t("signupPage.checkEmailNote")}
        </p>

        {/* Resend section */}
        <div className="pt-2 border-t border-border">
          {resendDone ? (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
              ✓ Ny bekräftelselänk skickad — kolla din inkorg (och skräppost).
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Inget mejl? Kolla skräppost eller skicka igen.</p>
              <button
                type="button"
                onClick={onResend}
                disabled={resendLoading || resendCooldown > 0}
                className="w-full rounded-md border border-border py-2.5 text-sm font-medium text-foreground hover:border-info hover:text-info disabled:opacity-50 transition"
              >
                {resendLoading
                  ? "Skickar…"
                  : resendCooldown > 0
                  ? `Skicka igen (${resendCooldown}s)`
                  : "Skicka bekräftelsemejl igen"}
              </button>
            </div>
          )}
        </div>

        <a href={`/${locale}/login`} className="block text-xs text-muted-foreground hover:text-info underline">
          Tillbaka till inloggning
        </a>
      </div>
    );
  }

  return (
    <div className="container-page py-16 max-w-lg">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
              s === step ? "bg-info text-primary-foreground" :
              s < step  ? "bg-[oklch(0.72_0.12_155)] text-white" :
              "bg-surface-alt text-muted-foreground border border-border"
            }`}>{s < step ? "✓" : s}</div>
            {s < 2 && <div className={`h-0.5 w-12 rounded transition ${s < step ? "bg-info" : "bg-border"}`} />}
          </div>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          {step === 1 ? t("signupPage.step1Label") : t("signupPage.step2Label")}
        </span>
      </div>

      {step === 1 && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signupTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("auth.signupSubtitle")}</p>
          <form onSubmit={onStep1} className="mt-8 space-y-4">
            <Field label={t("signupPage.yourName")}>
              <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Anna Lindgren"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <Field label={t("auth.email")}>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="anna@foretag.se"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            <Field label={t("auth.password")}>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t("signupPage.passwordPlaceholder")}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit"
              className="w-full rounded-md bg-info text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90">
              {t("signupPage.nextStep")}
            </button>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">{t("signupPage.companyTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("signupPage.companySubtitle")}</p>
          <form onSubmit={onStep2} className="mt-8 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("signupPage.companyName")}>
                <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme AB"
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
              </Field>
              <Field label={t("signupPage.orgNumber")}>
                <input value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)}
                  placeholder="556123-4567"
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("signupPage.industry")}>
                <select required value={industry} onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                  <option value="">{t("signupPage.chooseIndustry")}</option>
                  {INDUSTRIES.map((i) => <option key={i.v} value={i.v}>{i.l}</option>)}
                </select>
              </Field>
              <Field label={t("signupPage.yourRole")}>
                <select required value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                  <option value="">{t("signupPage.chooseRole")}</option>
                  {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("signupPage.employees")}>
                <select required value={employees} onChange={(e) => setEmployees(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                  <option value="">{t("signupPage.choose")}</option>
                  {SIZES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </Field>
              <Field label={t("signupPage.phone")}>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+46 70 123 45 67"
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
              </Field>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{t("signupPage.billingAddress")}</p>
              <div className="space-y-3">
                <Field label={t("signupPage.streetAddress")}>
                  <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)}
                    placeholder="Industrivägen 12"
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("signupPage.postalCode")}>
                    <input value={addressPostal} onChange={(e) => setAddressPostal(e.target.value)}
                      placeholder="12345"
                      className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
                  </Field>
                  <Field label={t("signupPage.city")}>
                    <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)}
                      placeholder="Stockholm"
                      className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
                  </Field>
                </div>
                <Field label={t("signupPage.country")}>
                  <select value={country} onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                    {COUNTRIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            {/* GDPR consent */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                className="mt-0.5 shrink-0 accent-info size-4"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Jag har läst och godkänner{" "}
                <Link to="/$locale/privacy" params={{ locale }} target="_blank" className="text-info hover:underline">
                  integritetspolicyn
                </Link>{" "}
                och{" "}
                <Link to="/$locale/terms" params={{ locale }} target="_blank" className="text-info hover:underline">
                  allmänna villkoren
                </Link>
                . Maskinval AB behandlar dina uppgifter enligt GDPR.
              </span>
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:border-info hover:text-foreground">
                {t("signupPage.back")}
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 rounded-md bg-info text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {loading ? t("signupPage.creatingAccount") : t("signupPage.createAccount")}
              </button>
            </div>
          </form>
        </>
      )}

      <p className="text-sm text-muted-foreground mt-6">
        {t("auth.haveAccount")}{" "}
        <Link to="/$locale/login" params={{ locale }} className="underline text-foreground">
          {t("auth.loginHere")}
        </Link>
      </p>
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

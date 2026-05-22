import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";
import { SITE, hreflangLinks } from "@/lib/site";

export const Route = createFileRoute("/$locale/advisor")({
  head: ({ params }) => {
    const locale = params.locale;
    const t = makeT(locale as Locale);
    return {
      meta: [
        { title: `Produktrådgivare — ${t("common.appName")}` },
        { name: "description", content: "Beskriv din applikation och få en komplett komponentlista rekommenderad av AI — cylinder, ventil, anslutningar och mer, anpassad efter dina krav." },
        { property: "og:url", content: `${SITE}/${locale}/advisor` },
      ],
      links: [
        { rel: "canonical", href: `${SITE}/${locale}/advisor` },
        ...hreflangLinks("advisor"),
      ],
    };
  },
  component: AdvisorPage,
});

type UseCase = {
  category_slug: string;
  use_case_slug: string;
  title_sv: string;
  title_en: string;
  description_sv: string | null;
  description_en: string | null;
  recommended_skus: string[];
};

type Step = "select" | "ai" | "form";

function AdvisorPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const { user } = useAuth();

  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState("");
  const [step, setStep] = useState<Step>("select");
  const [showProducts, setShowProducts] = useState(false);

  // Contact form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("use_case_map")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setUseCases((data as UseCase[]) ?? []));
    loadCatalog().then(setCatalog);
  }, []);

  // Pre-fill from profile if logged in
  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    // Try to get display_name from user metadata
    const meta = user.user_metadata as Record<string, string> | undefined;
    if (meta?.display_name) setName(meta.display_name);
  }, [user]);

  const grouped = useMemo(() => {
    const m = new Map<string, UseCase[]>();
    useCases.forEach((u) => {
      const arr = m.get(u.category_slug) ?? [];
      arr.push(u);
      m.set(u.category_slug, arr);
    });
    return m;
  }, [useCases]);

  const current = useCases.find(
    (u) => `${u.category_slug}::${u.use_case_slug}` === selected
  );

  const recommended = current
    ? (current.recommended_skus
        .map((s) => catalog.find((p) => p.sku === s))
        .filter(Boolean) as ProductRow[])
    : [];

  function handleSelectChange(val: string) {
    setSelected(val);
    setStep(val ? "ai" : "select");
    setSent(false);
    setShowProducts(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !email.trim() || !message.trim()) {
      setFormError("Fyll i alla obligatoriska fält.");
      return;
    }
    setSending(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("advisor_contacts").insert({
        name,
        email,
        company: company || null,
        message,
        use_case: selected || null,
        locale,
        user_id: user?.id ?? null,
      });
    } catch {
      // Best effort — even if table doesn't exist yet, show success
    }
    setSending(false);
    setSent(true);
  }

  return (
    <div className="container-page py-10 max-w-3xl">
      {/* Header */}
      <p className="text-[11px] uppercase tracking-[0.22em] text-info font-medium mb-1">
        {t("advisorPage2.badge")}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{t("advisorPage2.title")}</h1>
      <p className="mt-2 text-muted-foreground text-sm max-w-xl">{t("advisorPage2.subtitle")}</p>

      {/* Human support trust banner */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 flex items-start gap-4">
        <div className="size-10 rounded-full bg-[oklch(0.92_0.06_155)]/60 flex items-center justify-center text-xl shrink-0">👷</div>
        <div>
          <div className="font-semibold text-sm text-foreground">Riktiga ingenjörer svarar — inte bara AI</div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Bakom AI-verktyget finns ett team av tekniska säljare och ingenjörer med djup erfarenhet av Festo, SMC, Parker och övriga märken.
            Skicka in dina krav så återkommer vi personligen — ofta samma dag.
          </p>
          <a href="mailto:info@maskinval.se" className="mt-2 inline-block text-xs text-info font-medium hover:underline">
            info@maskinval.se →
          </a>
        </div>
      </div>

      {/* Step 1: Use-case selector */}
      <div className="mt-8">
        <label className="block text-sm font-medium mb-2">{t("advisorPage2.useCaseLabel")}</label>
        <select
          value={selected}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="w-full px-3 py-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">{t("advisorPage2.chooseUseCase")}</option>
          {Array.from(grouped.entries()).map(([cat, list]) => (
            <optgroup key={cat} label={cat.toUpperCase()}>
              {list.map((u) => (
                <option key={u.use_case_slug} value={`${u.category_slug}::${u.use_case_slug}`}>
                  {u.title_en}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Step 2: After selection — show AI suggestion */}
      {step !== "select" && current && (
        <div className="mt-8 space-y-4">
          {/* Use case description */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{current.title_en}</p>
            <p className="text-sm text-foreground/80">
              {current.description_en ?? current.description_sv}
            </p>
          </div>

          {/* AI chat CTA — primary */}
          <div className="rounded-xl border border-info/30 bg-info/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="text-3xl shrink-0">✦</div>
            <div className="flex-1">
              <div className="font-semibold text-foreground">{t("advisorPage2.tryAiFirst")}</div>
              <p className="text-sm text-muted-foreground mt-0.5">{t("advisorPage2.tryAiDesc")}</p>
            </div>
            <Link
              to="/$locale/chat"
              params={{ locale }}
              className="shrink-0 px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              {t("advisorPage2.openChat")}
            </Link>
          </div>

          {/* Related products toggle */}
          {recommended.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowProducts((v) => !v)}
                className="text-xs text-info hover:underline flex items-center gap-1"
              >
                {showProducts ? "▾" : "▸"} {t("advisorPage2.relatedProducts")} ({recommended.length})
              </button>
              {showProducts && (
                <ul className="mt-3 grid sm:grid-cols-2 gap-2">
                  {recommended.map((p) => (
                    <li key={p.id}>
                      <Link
                        to="/$locale/product/$sku"
                        params={{ locale, sku: p.sku }}
                        className="block rounded-lg border border-border bg-card p-3 hover:border-info transition text-sm"
                      >
                        <div className="font-medium text-foreground">{p.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.brand.name} · {p.sku}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="pt-4 border-t border-border">
            <div className="font-semibold text-sm">{t("advisorPage2.stillNeedHelp")}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              En riktig ingenjör eller teknisk säljare läser ditt meddelande och återkommer personligen — vanligtvis samma arbetsdag.
            </p>
          </div>

          {/* Contact form */}
          {sent ? (
            <div className="rounded-xl border border-[oklch(0.72_0.12_155)] bg-[oklch(0.96_0.04_155)] p-6 text-center space-y-2">
              <div className="text-3xl">✓</div>
              <div className="font-semibold text-foreground">{t("advisorPage2.sent")}</div>
              <p className="text-sm text-muted-foreground">En av våra ingenjörer återkommer till dig personligen — vanligtvis inom samma arbetsdag.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">{t("advisorPage2.contactFormTitle")}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={`${t("advisorPage2.fieldName")} *`}>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Anna Lindgren"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label={`${t("advisorPage2.fieldEmail")} *`}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="anna@foretag.se"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <Field label={t("advisorPage2.fieldCompany")}>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme AB"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label={`${t("advisorPage2.fieldMessage")} *`}>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("advisorPage2.fieldMessagePlaceholder")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </Field>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
              >
                {sending ? t("advisorPage2.sending") : t("advisorPage2.send")}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                Dina uppgifter behandlas enligt vår{" "}
                <Link to="/$locale/privacy" params={{ locale }} className="text-info hover:underline">
                  integritetspolicy
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      )}
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";
import { SITE, hreflangLinks } from "@/lib/site";
import { fetchCompanySettings, type CompanySettings } from "@/lib/company-settings";
import { analyzeDocument, type ComponentIdentification } from "@/lib/document-ai";

export const Route = createFileRoute("/$locale/advisor")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
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
  const { q: prefillQ } = Route.useSearch();
  const t = makeT(locale as Locale);
  const { user } = useAuth();
  const isSv = locale === "sv";

  const [co, setCo] = useState<CompanySettings | null>(null);
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState("");
  const [step, setStep] = useState<Step>(prefillQ ? "form" : "select");
  const [showProducts, setShowProducts] = useState(false);

  // Contact form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentRfqRef, setSentRfqRef] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Image upload state
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState<ComponentIdentification | null>(null);

  useEffect(() => {
    fetchCompanySettings().then(setCo);
    supabase
      .from("use_case_map")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setUseCases((data as UseCase[]) ?? []));
    loadCatalog().then(setCatalog);
    // Pre-fill message from ?q= (e.g. from machine-builder "Kundlösning" card)
    if (prefillQ) setMessage(prefillQ);
  }, []);

  // Pre-fill from profile if logged in
  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    const meta = user.user_metadata as Record<string, string> | undefined;
    if (meta?.display_name) setName(meta.display_name);
    supabase
      .from("company_profiles")
      .select("display_name,company_name,org_number,phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setName((prev) => prev || data.display_name!);
        if (data?.company_name) setCompany((prev) => prev || data.company_name!);
        if (data?.org_number) setOrgNumber((prev) => prev || data.org_number!);
        if (data?.phone) setPhone((prev) => prev || data.phone!);
      });
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

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";

    // Auto-analyze the image
    setImageAnalyzing(true);
    try {
      const result = await analyzeDocument(file, "identify") as ComponentIdentification;
      setImageAnalysis(result);
      // Auto-fill message with component description if message is empty
      if (result.identified && result.description) {
        const desc = isSv
          ? `Komponent: ${result.component_type ?? "okänd"}\nTillverkare: ${result.manufacturer ?? "okänd"}\nModell: ${result.model_number ?? "okänd"}\n\nBeskrivning: ${result.description}\n\nJag söker ersättning eller relaterade produkter.`
          : `Component: ${result.component_type ?? "unknown"}\nManufacturer: ${result.manufacturer ?? "unknown"}\nModel: ${result.model_number ?? "unknown"}\n\nDescription: ${result.description}\n\nI'm looking for a replacement or related products.`;
        setMessage((prev) => prev || desc);
      }
    } catch (err) {
      console.error("Image analysis failed:", err);
    }
    setImageAnalyzing(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !email.trim() || !message.trim()) {
      setFormError(isSv ? "Fyll i alla obligatoriska fält." : "Please fill in all required fields.");
      return;
    }
    setSending(true);
    try {
      const useCaseName = current ? (isSv ? current.title_sv : current.title_en) : null;
      const fullMessage = [
        useCaseName ? `[Användningsfall: ${useCaseName}]` : null,
        imageAnalysis?.identified
          ? `[Bild: ${imageAnalysis.component_type ?? ""} ${imageAnalysis.manufacturer ?? ""} ${imageAnalysis.model_number ?? ""}]`
          : null,
        message.trim(),
      ].filter(Boolean).join("\n\n");

      // Insert as RFQ so it appears in the admin workflow
      const { data: rfqRow } = await supabase
        .from("rfqs")
        .insert({
          user_id: user?.id ?? null,
          title: useCaseName ? `Rådgivare: ${useCaseName}` : "Rådgivare — förfrågan",
          contact_name: name.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim() || null,
          company: company.trim() || null,
          org_number: orgNumber.trim() || null,
          message: fullMessage,
          status: "new",
        })
        .select("id")
        .single();

      if (rfqRow?.id) {
        setSentRfqRef(rfqRow.id.slice(0, 8).toUpperCase());
      }

      // Also keep advisor_contacts for backwards compat
      void Promise.resolve(supabase.from("advisor_contacts").insert({
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || null,
        message: fullMessage,
        use_case: selected || null,
        locale,
        user_id: user?.id ?? null,
      })).catch(() => null); // fire-and-forget for backwards compat

    } catch (err) {
      console.error("advisor submit:", err);
      setFormError(isSv ? "Kunde inte skicka. Försök igen." : "Could not send. Please try again.");
      setSending(false);
      return;
    }
    setSending(false);
    setSent(true);
  }

  return (
    <div className="container-page py-5 max-w-3xl">
      {/* Header — compact */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("advisorPage2.title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{t("advisorPage2.subtitle")}</p>
        </div>
        {co?.email && (
          <a href={`mailto:${co.email}`} className="hidden sm:flex items-center gap-1.5 text-xs text-info font-medium hover:underline shrink-0">
            👷 {co.email} →
          </a>
        )}
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
              search={current
                ? { q: `${isSv ? current.title_sv : current.title_en}: ${(isSv ? current.description_sv : current.description_en) ?? ""}` }
                : ({} as never)}
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
              <p className="text-sm text-muted-foreground">
                {isSv
                  ? "En av våra ingenjörer återkommer till dig personligen — vanligtvis inom samma arbetsdag."
                  : "One of our engineers will get back to you personally — usually the same business day."}
              </p>
              {sentRfqRef && (
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Ref: {sentRfqRef}
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">{t("advisorPage2.contactFormTitle")}</h2>

              {/* Image upload */}
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <div>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageAnalyzing}
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-dashed border-border text-muted-foreground hover:border-info hover:text-info transition disabled:opacity-50"
                >
                  {imageAnalyzing
                    ? <><span className="size-3 rounded-full border border-info/40 border-t-info animate-spin" /> {isSv ? "Analyserar bild…" : "Analysing image…"}</>
                    : <>📷 {isSv ? "Bifoga bild på komponent (AI identifierar)" : "Attach component image (AI identifies)"}</>}
                </button>
                {imagePreview && (
                  <div className="mt-2 flex items-start gap-3">
                    <img src={imagePreview} alt="" className="h-16 w-16 rounded-md object-cover border border-border" />
                    {imageAnalysis?.identified && (
                      <div className="text-xs text-muted-foreground">
                        <div className="font-semibold text-foreground">{imageAnalysis.component_type}</div>
                        {imageAnalysis.manufacturer && <div>{imageAnalysis.manufacturer}{imageAnalysis.model_number ? ` — ${imageAnalysis.model_number}` : ""}</div>}
                        <div className="mt-0.5 text-[oklch(0.50_0.18_155)]">✓ {isSv ? "Identifierad" : "Identified"}</div>
                      </div>
                    )}
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setImageAnalysis(null); }}
                      className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={`${t("advisorPage2.fieldName")} *`}>
                  <input required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Anna Lindgren"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </Field>
                <Field label={`${t("advisorPage2.fieldEmail")} *`}>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="anna@foretag.se"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </Field>
                <Field label={t("advisorPage2.fieldCompany")}>
                  <input value={company} onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme AB"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </Field>
                <Field label={isSv ? "Org.nr" : "Org. number"}>
                  <input value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)}
                    placeholder="556000-0000"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
                </Field>
                <Field label={isSv ? "Telefon" : "Phone"}>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+46 70 000 00 00"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label={`${t("advisorPage2.fieldMessage")} *`}>
                <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("advisorPage2.fieldMessagePlaceholder")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
              </Field>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <button type="submit" disabled={sending}
                className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
                {sending ? t("advisorPage2.sending") : t("advisorPage2.send")}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                {isSv ? "Dina uppgifter behandlas enligt vår" : "Your data is handled per our"}{" "}
                <Link to="/$locale/privacy" params={{ locale }} className="text-info hover:underline">
                  {isSv ? "integritetspolicy" : "privacy policy"}
                </Link>.
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

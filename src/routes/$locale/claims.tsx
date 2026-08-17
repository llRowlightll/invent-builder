import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/$locale/claims")({
  validateSearch: z.object({ order: z.string().optional() }),
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("claimsPage.title")} — ${t("common.appName")}` },
        { name: "description", content: t("claimsPage.subtitle") },
      ],
    };
  },
  component: ClaimsPage,
});

// Reklamationspolicy: 6 månader från orderdatum, ordervärde minst 2000 kr.
// Kontrollen är informativ, inte en hård spärr — supporten kan alltid göra
// undantag, men kunden ska se direkt om ärendet troligen ligger utanför.
const CLAIM_WINDOW_MONTHS = 6;
const CLAIM_MIN_VALUE_SEK = 2000;

type OrderItem = { sku: string; name: string; qty: number };
type OrderForClaim = {
  id: string;
  created_at: string;
  total_inc_vat: number | null;
  total_ex_vat: number | null;
  currency: string;
  items: OrderItem[];
};

function orderRef(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function claimEligibility(order: OrderForClaim): { eligible: boolean; reason: "age" | "value" | null } {
  const ageMonths = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  const value = order.total_inc_vat ?? order.total_ex_vat ?? 0;
  if (ageMonths > CLAIM_WINDOW_MONTHS) return { eligible: false, reason: "age" };
  if (value < CLAIM_MIN_VALUE_SEK) return { eligible: false, reason: "value" };
  return { eligible: true, reason: null };
}

type Claim = {
  id: string;
  created_at: string;
  updated_at: string;
  status: "open" | "in_review" | "resolved" | "closed";
  claim_type: string | null;
  order_ref: string | null;
  sku: string | null;
  title: string;
  description: string;
  urgency: "low" | "normal" | "high" | "critical";
  resolution_note: string | null;
};

const CLAIM_TYPES = [
  { v: "wrong_product", key: "type_wrong_product" },
  { v: "damaged",       key: "type_damaged" },
  { v: "missing",       key: "type_missing" },
  { v: "quality",       key: "type_quality" },
  { v: "delay",         key: "type_delay" },
  { v: "other",         key: "type_other" },
] as const;

const URGENCIES = [
  { v: "low",      key: "urgency_low" },
  { v: "normal",   key: "urgency_normal" },
  { v: "high",     key: "urgency_high" },
  { v: "critical", key: "urgency_critical" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  open:      "bg-info/10 text-info",
  in_review: "bg-amber-100 text-amber-700",
  resolved:  "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]",
  closed:    "bg-muted text-muted-foreground",
};

const URGENCY_COLORS: Record<string, string> = {
  low:      "text-muted-foreground",
  normal:   "text-foreground",
  high:     "text-amber-600 font-semibold",
  critical: "text-destructive font-bold",
};

function ClaimsPage() {
  const { locale } = Route.useParams();
  const { order: preselectOrderId } = Route.useSearch();
  const t = makeT(locale as Locale);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [orders, setOrders] = useState<OrderForClaim[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fType, setFType] = useState("");
  const [fOrderId, setFOrderId] = useState("");
  const [fSku, setFSku] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fUrgency, setFUrgency] = useState("normal");
  const [fContact, setFContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFContact(user.email ?? "");
  }, [user]);

  useEffect(() => {
    if (!user) { setLoadingClaims(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }: { data: Claim[] | null }) => {
        setClaims(data ?? []);
        setLoadingClaims(false);
      });
  }, [user, submitSuccess]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("orders")
      .select("id, created_at, total_inc_vat, total_ex_vat, currency, items")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders((data as unknown as OrderForClaim[]) ?? []));
  }, [user]);

  // Arrived via "Reklamera" on a specific order (orders.tsx) — pre-select it
  // and open the form straight away instead of making the customer hunt for
  // their order again in the dropdown.
  useEffect(() => {
    if (preselectOrderId && orders.some(o => o.id === preselectOrderId)) {
      setFOrderId(preselectOrderId);
      setShowForm(true);
    }
  }, [preselectOrderId, orders]);

  const selectedOrder = orders.find(o => o.id === fOrderId) ?? null;
  const eligibility = selectedOrder ? claimEligibility(selectedOrder) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitError(null);
    setSubmitting(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("claims").insert({
      user_id:     user.id,
      title:       fTitle,
      claim_type:  fType || null,
      order_ref:   selectedOrder ? orderRef(selectedOrder.id) : null,
      sku:         fSku || null,
      description: fDescription,
      urgency:     fUrgency,
      contact_email: fContact || user.email || null,
    });

    setSubmitting(false);
    if (error) { setSubmitError(error.message); return; }

    setSubmitSuccess(true);
    setShowForm(false);
    // reset
    setFTitle(""); setFType(""); setFOrderId(""); setFSku("");
    setFDescription(""); setFUrgency("normal");
  }

  if (authLoading) {
    return (
      <div className="container-page py-16 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-page py-20 max-w-md text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-semibold">{t("claimsPage.loginRequired")}</h1>
        <Link
          to="/$locale/login"
          params={{ locale }}
          search={{ redirect: `/${locale}/claims` }}
          className="inline-block px-5 py-2 rounded-md bg-info text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          {t("claimsPage.loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-10 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("claimsPage.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("claimsPage.subtitle")}</p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setSubmitSuccess(false); setSelectedClaim(null); }}
            className="px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
          >
            + {t("claimsPage.newClaim")}
          </button>
        )}
      </div>

      {/* Success toast */}
      {submitSuccess && (
        <div className="mb-6 rounded-xl border border-[oklch(0.72_0.12_155)] bg-[oklch(0.96_0.04_155)] p-4 flex items-start gap-3">
          <span className="text-xl">✓</span>
          <div>
            <div className="font-semibold text-sm">{t("claimsPage.successTitle")}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("claimsPage.successBody")}</p>
          </div>
        </div>
      )}

      {/* New claim form */}
      {showForm && (
        <div className="mb-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">{t("claimsPage.newClaim")}</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={`${t("claimsPage.fieldTitle")} *`}>
              <input
                required
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                placeholder={t("claimsPage.fieldTitlePlaceholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("claimsPage.fieldType")}>
                <select
                  value={fType}
                  onChange={(e) => setFType(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Välj —</option>
                  {CLAIM_TYPES.map((ct) => (
                    <option key={ct.v} value={ct.v}>{t(`claimsPage.${ct.key}` as never)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("claimsPage.fieldUrgency")}>
                <select
                  value={fUrgency}
                  onChange={(e) => setFUrgency(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {URGENCIES.map((u) => (
                    <option key={u.v} value={u.v}>{t(`claimsPage.${u.key}` as never)}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("claimsPage.fieldOrderRef")}>
                <select
                  value={fOrderId}
                  onChange={(e) => { setFOrderId(e.target.value); setFSku(""); }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">
                    {locale === "sv" ? "— Ingen specifik order —" : "— No specific order —"}
                  </option>
                  {orders.map((o) => {
                    const amount = o.total_inc_vat ?? o.total_ex_vat;
                    return (
                      <option key={o.id} value={o.id}>
                        {orderRef(o.id)} · {new Date(o.created_at).toLocaleDateString(locale === "sv" ? "sv-SE" : locale)}
                        {amount ? ` · ${amount.toLocaleString(locale === "sv" ? "sv-SE" : locale, { style: "currency", currency: o.currency || "SEK", maximumFractionDigits: 0 })}` : ""}
                      </option>
                    );
                  })}
                </select>
              </Field>
              <Field label={t("claimsPage.fieldSku")}>
                <select
                  value={fSku}
                  onChange={(e) => setFSku(e.target.value)}
                  disabled={!selectedOrder || selectedOrder.items.length === 0}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">{locale === "sv" ? "— Hela ordern —" : "— Whole order —"}</option>
                  {(selectedOrder?.items ?? []).map((item) => (
                    <option key={item.sku} value={item.sku}>{item.sku} · {item.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            {selectedOrder && eligibility && !eligibility.eligible && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                {eligibility.reason === "age"
                  ? (locale === "sv"
                      ? `⚠️ Den här ordern lades för mer än ${CLAIM_WINDOW_MONTHS} månader sedan — vår reklamationstid är ${CLAIM_WINDOW_MONTHS} månader. Vi går ändå igenom ärendet, men det kan falla utanför policyn.`
                      : `⚠️ This order was placed more than ${CLAIM_WINDOW_MONTHS} months ago — our claims window is ${CLAIM_WINDOW_MONTHS} months. We'll still review it, but it may fall outside policy.`)
                  : (locale === "sv"
                      ? `⚠️ Ordervärdet är under ${CLAIM_MIN_VALUE_SEK.toLocaleString("sv-SE")} kr, vår gräns för reklamation. Vi går ändå igenom ärendet, men det kan falla utanför policyn.`
                      : `⚠️ This order's value is under ${CLAIM_MIN_VALUE_SEK.toLocaleString("en-US")} kr, our claims threshold. We'll still review it, but it may fall outside policy.`)}
              </div>
            )}

            <Field label={`${t("claimsPage.fieldDescription")} *`}>
              <textarea
                required
                rows={5}
                value={fDescription}
                onChange={(e) => setFDescription(e.target.value)}
                placeholder={t("claimsPage.fieldDescriptionPlaceholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </Field>

            <Field label={t("claimsPage.fieldContact")}>
              <input
                type="email"
                value={fContact}
                onChange={(e) => setFContact(e.target.value)}
                placeholder="din@email.se"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:border-info hover:text-foreground transition"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
              >
                {submitting ? t("claimsPage.submitting") : t("claimsPage.submit")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Claims list */}
      {loadingClaims ? (
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : claims.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {t("claimsPage.noClaims")}
        </div>
      ) : claims.length > 0 ? (
        <div className="space-y-3">
          {claims.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border bg-card overflow-hidden transition ${
                selectedClaim?.id === c.id ? "border-info" : "border-border hover:border-info/50"
              }`}
            >
              <button
                type="button"
                className="w-full text-left p-4 flex items-start gap-4"
                onClick={() => setSelectedClaim(selectedClaim?.id === c.id ? null : c)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? "bg-muted"}`}>
                      {t(`claimsPage.status_${c.status}` as never)}
                    </span>
                    <span className={`text-[10px] ${URGENCY_COLORS[c.urgency] ?? ""}`}>
                      {t(`claimsPage.urgency_${c.urgency}` as never)}
                    </span>
                    {c.claim_type && (
                      <span className="text-[10px] text-muted-foreground">
                        {t(`claimsPage.type_${c.claim_type}` as never)}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-sm text-foreground mt-1">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex gap-3">
                    {c.order_ref && <span>Ref: {c.order_ref}</span>}
                    {c.sku && <span>SKU: {c.sku}</span>}
                    <span>{new Date(c.created_at).toLocaleDateString("sv-SE")}</span>
                  </div>
                </div>
                <span className="text-muted-foreground text-xs shrink-0 mt-0.5">
                  {selectedClaim?.id === c.id ? "▴" : "▾"}
                </span>
              </button>

              {selectedClaim?.id === c.id && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Beskrivning</div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{c.description}</p>
                  </div>
                  {c.resolution_note && (
                    <div className="rounded-md border border-[oklch(0.72_0.12_155)] bg-[oklch(0.96_0.04_155)] p-3">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Svar från Maskinval</div>
                      <p className="text-sm text-foreground/80">{c.resolution_note}</p>
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    Ärende-ID: <span className="font-mono">{c.id.slice(0, 8)}</span>
                    {" · "}Senast uppdaterat: {new Date(c.updated_at).toLocaleDateString("sv-SE")}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
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

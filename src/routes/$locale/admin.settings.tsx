/**
 * /admin/settings
 * Edit company details that appear in document headers (OE, OC, etc.)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  fetchCompanySettings,
  saveCompanySetting,
  type CompanySettings,
} from "@/lib/company-settings";
import { useAdminGuard } from "@/lib/auth-context";

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
            <span className="text-sm text-[oklch(0.50_0.18_155)]">✓ Sparat</span>
          )}
        </div>
      </form>
    </div>
  );
}

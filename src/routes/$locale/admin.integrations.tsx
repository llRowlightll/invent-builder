import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// @ts-ignore
export const Route = createFileRoute("/$locale/admin/integrations")({
  component: IntegrationsPage,
});

const FORTNOX_FN =
  "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/fortnox-order";
const HUBSPOT_FN =
  "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/hubspot-sync";

type LogRow = {
  id: string;
  source: string;
  event: string;
  ref_id: string | null;
  success: boolean;
  error: string | null;
  created_at: string;
};

type RfqRow = {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  company: string | null;
  status: string;
  hubspot_contact_id: string | null;
  hubspot_deal_id: string | null;
  fortnox_order_id: string | null;
  integration_error: string | null;
  integration_synced_at: string | null;
  created_at: string;
};

export default function IntegrationsPage() {
  const { locale } = Route.useParams() as { locale: string };
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<Record<string, string>>({});

  async function load() {
    const [{ data: logData }, { data: rfqData }] = await Promise.all([
      supabase
        .from("integration_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("rfqs")
        .select("id,contact_name,contact_email,company,status,hubspot_contact_id,hubspot_deal_id,fortnox_order_id,integration_error,integration_synced_at,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setLogs((logData ?? []) as LogRow[]);
    setRfqs((rfqData ?? []) as RfqRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function pushToFortnox(rfqId: string) {
    setPushing(rfqId);
    try {
      const res = await fetch(FORTNOX_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hook-secret": "maskinval-fortnox" },
        body: JSON.stringify({ rfq_id: rfqId }),
      });
      const data = await res.json();
      setPushResult((p) => ({
        ...p,
        [rfqId]: data.ok ? `✓ Order ${data.orderNumber}` : `✗ ${data.error}`,
      }));
      await load();
    } catch (e) {
      setPushResult((p) => ({ ...p, [rfqId]: `✗ ${e}` }));
    }
    setPushing(null);
  }

  async function retryHubSpot(rfq: RfqRow) {
    setPushing(rfq.id);
    try {
      const res = await fetch(HUBSPOT_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hook-secret": "maskinval-hubspot" },
        body: JSON.stringify({
          rfq_id: rfq.id,
          contact_name: rfq.contact_name,
          contact_email: rfq.contact_email,
          company: rfq.company,
        }),
      });
      const data = await res.json();
      setPushResult((p) => ({
        ...p,
        [rfq.id]: data.ok ? `✓ HubSpot: deal ${data.dealId}` : `✗ ${data.error}`,
      }));
      await load();
    } catch (e) {
      setPushResult((p) => ({ ...p, [rfq.id]: `✗ ${e}` }));
    }
    setPushing(null);
  }

  const hsOk = rfqs.filter((r) => r.hubspot_deal_id).length;
  const fnOk = rfqs.filter((r) => r.fortnox_order_id).length;
  const errors = rfqs.filter((r) => r.integration_error).length;

  if (loading) return <div className="container-page py-16 text-sm text-muted-foreground">Laddar…</div>;

  return (
    <div className="container-page py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Integrationer</h1>
        <p className="text-sm text-muted-foreground mt-1">HubSpot CRM · Fortnox ekonomi</p>
      </div>

      {/* Status tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Offerter totalt", val: rfqs.length, icon: "📋" },
          { label: "HubSpot-deals", val: hsOk, icon: "🟠" },
          { label: "Fortnox-ordrar", val: fnOk, icon: "🟢" },
          { label: "Fel", val: errors, icon: errors > 0 ? "🔴" : "✅" },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl">{t.icon}</div>
            <div className="text-2xl font-bold mt-1">{t.val}</div>
            <div className="text-xs text-muted-foreground">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Integration status */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {/* HubSpot */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🟠</span>
            <span className="font-semibold">HubSpot CRM</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[oklch(0.92_0.06_155)]/30 text-[oklch(0.45_0.15_155)] font-medium">Aktiv</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ny offert → automatiskt ny <strong>Kontakt</strong> + <strong>Deal</strong> i HubSpot.<br />
            Befintliga kontakter uppdateras inte om e-posten redan finns.
          </p>
          <div className="mt-3 text-xs font-mono text-muted-foreground bg-surface-alt rounded px-2 py-1">
            Portal: 148497215 (EU1)
          </div>
        </div>

        {/* Fortnox */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🟢</span>
            <span className="font-semibold">Fortnox</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-surface-alt text-muted-foreground font-medium">Väntar credentials</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Skicka en vunnen deal till Fortnox som inköpsorder.<br />
            Artikelnummer mappas automatiskt (inkl. specialtecken).
          </p>
          <div className="mt-3 text-xs text-info">
            → Sätt <code className="bg-surface-alt px-1 rounded">FORTNOX_ACCESS_TOKEN</code> i Supabase Secrets
          </div>
        </div>
      </div>

      {/* RFQ table */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Offerter &amp; synkstatus</h2>
      <div className="rounded-xl border border-border overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground text-left">
                <th className="px-4 py-3">Kontakt</th>
                <th className="px-4 py-3">Företag</th>
                <th className="px-4 py-3">HubSpot</th>
                <th className="px-4 py-3">Fortnox</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-alt/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.contact_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.contact_email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.company ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.hubspot_deal_id ? (
                      <a
                        href={`https://app.hubspot.com/contacts/148497215/deal/${r.hubspot_deal_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-info hover:underline font-mono"
                      >
                        Deal {r.hubspot_deal_id}
                      </a>
                    ) : r.integration_error ? (
                      <button
                        onClick={() => retryHubSpot(r)}
                        disabled={!!pushing}
                        className="text-[11px] px-2 py-0.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                        title={r.integration_error}
                      >
                        Försök igen
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.fortnox_order_id ? (
                      <span className="text-xs font-mono text-[oklch(0.55_0.15_155)]">
                        Order {r.fortnox_order_id}
                      </span>
                    ) : (
                      <button
                        onClick={() => pushToFortnox(r.id)}
                        disabled={!!pushing}
                        className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:border-info/50 hover:text-info disabled:opacity-40 transition"
                      >
                        {pushing === r.id ? "…" : "Skapa order"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("sv-SE")}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {pushResult[r.id] && (
                      <span className={pushResult[r.id].startsWith("✓") ? "text-[oklch(0.55_0.15_155)]" : "text-destructive"}>
                        {pushResult[r.id]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rfqs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">Inga offerter ännu.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integration log */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Händelselogg</h2>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground text-left">
                <th className="px-4 py-3">Tid</th>
                <th className="px-4 py-3">Källa</th>
                <th className="px-4 py-3">Händelse</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Info</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-surface-alt/40">
                  <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                    {new Date(l.created_at).toLocaleString("sv-SE")}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      l.source === "hubspot"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {l.source}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs font-mono">{l.event}</td>
                  <td className="px-4 py-2">
                    {l.success
                      ? <span className="text-xs text-[oklch(0.55_0.15_155)]">✓ OK</span>
                      : <span className="text-xs text-destructive">✗ Fel</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[200px]">
                    {l.error ?? "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">Inga loggposter ännu.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

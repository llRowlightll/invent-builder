import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/admin/dashboard")({
  component: AdminDashboard,
});

type Stats = {
  products: number;
  rfqs: number;
  rfqs_week: number;
  chunks: number;
  profiles: number;
  rfq_new: number;
};

type RecentRfq = {
  id: string;
  contact_name: string | null;
  company: string | null;
  contact_email: string | null;
  status: string | null;
  created_at: string;
  quote_amount: number | null;
};

type StatusCount = { status: string; n: number };

const STATUS_META: Record<string, { label: string; dot: string }> = {
  new:        { label: "Ny",              dot: "bg-info" },
  processing: { label: "Under behandling", dot: "bg-[oklch(0.72_0.18_80)]" },
  quoted:     { label: "Offert skickad",  dot: "bg-[oklch(0.60_0.18_290)]" },
  accepted:   { label: "Accepterad",      dot: "bg-[oklch(0.60_0.18_155)]" },
  rejected:   { label: "Avvisad",         dot: "bg-destructive" },
};

const ADMIN_LINKS = [
  { to: "/$locale/admin/dashboard", label: "Översikt", icon: "◈" },
  { to: "/$locale/admin/rfq",       label: "RFQ / Order", icon: "📋" },
  { to: "/$locale/admin/products",  label: "Produkter", icon: "📦" },
  { to: "/$locale/admin/pricing",   label: "Prissättning", icon: "💰" },
  { to: "/$locale/admin/knowledge", label: "Knowledge base", icon: "🧠" },
  { to: "/$locale/admin/crm",       label: "CRM", icon: "👥" },
  { to: "/$locale/admin/images",    label: "Bilder", icon: "🖼" },
  { to: "/$locale/admin/audit",     label: "Audit log", icon: "🔍" },
];

function AdminDashboard() {
  const { locale } = Route.useParams();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentRfq[]>([]);
  const [statuses, setStatuses] = useState<StatusCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

      const [
        { count: products },
        { count: rfqs },
        { count: rfqs_week },
        { count: chunks },
        { count: profiles },
        { count: rfq_new },
        { data: recentData },
        { data: statusData },
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("rfqs").select("*", { count: "exact", head: true }),
        supabase.from("rfqs").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("knowledge_chunks").select("*", { count: "exact", head: true }),
        supabase.from("company_profiles").select("*", { count: "exact", head: true }),
        supabase.from("rfqs").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("rfqs").select("id,contact_name,company,contact_email,status,created_at,quote_amount")
          .order("created_at", { ascending: false }).limit(8),
        Promise.resolve(supabase.rpc("rfq_status_counts")).catch(() => ({ data: null })),
      ]);

      setStats({
        products: products ?? 0,
        rfqs: rfqs ?? 0,
        rfqs_week: rfqs_week ?? 0,
        chunks: chunks ?? 0,
        profiles: profiles ?? 0,
        rfq_new: rfq_new ?? 0,
      });
      setRecent((recentData as RecentRfq[]) ?? []);

      // Fallback status count from recent if rpc not available
      if (!statusData) {
        const { data: sd } = await supabase
          .from("rfqs")
          .select("status")
          .order("status");
        const counts: Record<string, number> = {};
        (sd ?? []).forEach((r: { status: string | null }) => {
          const s = r.status ?? "new";
          counts[s] = (counts[s] ?? 0) + 1;
        });
        setStatuses(Object.entries(counts).map(([status, n]) => ({ status, n })));
      } else {
        setStatuses((statusData as StatusCount[]) ?? []);
      }

      setLoading(false);
    })();
  }, []);

  return (
    <div className="container-page py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin — Översikt</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Maskinval kontrolpanel</p>
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-8">
        {ADMIN_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to as never}
            params={{ locale } as never}
            activeProps={{ className: "border-info bg-info/5 text-info" }}
            className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg border border-border hover:border-info hover:bg-info/5 transition text-center"
          >
            <span className="text-xl">{l.icon}</span>
            <span className="text-[10px] font-medium text-muted-foreground leading-tight">{l.label}</span>
          </Link>
        ))}
      </div>

      {/* Stats cards */}
      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Laddar statistik…</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard label="Produkter" value={stats!.products} icon="📦" to={`/${locale}/admin/products`} />
          <StatCard label="Totalt RFQs" value={stats!.rfqs} icon="📋" to={`/${locale}/admin/rfq`} />
          <StatCard label="RFQs denna vecka" value={stats!.rfqs_week} icon="📈" highlight={stats!.rfqs_week > 0} to={`/${locale}/admin/rfq`} />
          <StatCard label="Nya (ohanterade)" value={stats!.rfq_new} icon="🔔" highlight={stats!.rfq_new > 0} to={`/${locale}/admin/rfq`} />
          <StatCard label="Knowledge chunks" value={stats!.chunks} icon="🧠" to={`/${locale}/admin/knowledge`} />
          <StatCard label="Kunder" value={stats!.profiles} icon="👥" to={`/${locale}/admin/crm`} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent RFQs */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Senaste offertförfrågningar</h2>
            <Link to={"/$locale/admin/rfq" as never} params={{ locale } as never}
              className="text-xs text-info hover:underline">Visa alla →</Link>
          </div>
          <div className="divide-y divide-border">
            {recent.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Inga RFQs än</p>
            )}
            {recent.map((r) => {
              const meta = STATUS_META[r.status ?? "new"] ?? { label: r.status ?? "—", dot: "bg-muted" };
              return (
                <Link
                  key={r.id}
                  to={"/$locale/admin/rfq" as never}
                  params={{ locale } as never}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-alt transition"
                >
                  <span className={`size-2 rounded-full shrink-0 ${meta.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.company ?? r.contact_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.contact_email ?? "ingen e-post"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                    <div className="text-[11px] text-muted-foreground/60">{new Date(r.created_at).toLocaleDateString("sv-SE")}</div>
                  </div>
                  {r.quote_amount && (
                    <div className="text-xs font-mono font-medium text-foreground shrink-0">
                      {r.quote_amount.toLocaleString("sv-SE")} kr
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">RFQ-status fördelning</h2>
          </div>
          <div className="p-4 space-y-3">
            {statuses.length === 0 && (
              <p className="text-sm text-muted-foreground">Ingen data</p>
            )}
            {statuses.map(({ status, n }) => {
              const total = statuses.reduce((a, b) => a + b.n, 0) || 1;
              const pct = Math.round((n / total) * 100);
              const meta = STATUS_META[status] ?? { label: status, dot: "bg-muted" };
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    <span className="font-medium">{n} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${meta.dot}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 pb-4 pt-2 border-t border-border mt-2">
            <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Snabblänkar</h3>
            <div className="space-y-1">
              <Link to={"/$locale/admin/import" as never} params={{ locale } as never}
                className="block text-xs px-2 py-1.5 rounded hover:bg-surface-alt text-foreground/80 hover:text-foreground transition">
                ↑ Importera produkter (CSV)
              </Link>
              <Link to={"/$locale/admin/integrations" as never} params={{ locale } as never}
                className="block text-xs px-2 py-1.5 rounded hover:bg-surface-alt text-foreground/80 hover:text-foreground transition">
                ⚙ Integrationer (HubSpot/Fortnox)
              </Link>
              <Link to={"/$locale/admin/audit" as never} params={{ locale } as never}
                className="block text-xs px-2 py-1.5 rounded hover:bg-surface-alt text-foreground/80 hover:text-foreground transition">
                🔍 Audit-logg
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, highlight, to }: {
  label: string; value: number; icon: string; highlight?: boolean; to?: string;
}) {
  const inner = (
    <div className={`rounded-xl border bg-card p-4 flex flex-col gap-1 hover:border-info transition cursor-pointer ${
      highlight ? "border-info/50 bg-info/5" : "border-border"
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? "text-info" : "text-foreground"}`}>
        {value.toLocaleString("sv-SE")}
      </div>
    </div>
  );
  if (to) return <a href={to}>{inner}</a>;
  return inner;
}

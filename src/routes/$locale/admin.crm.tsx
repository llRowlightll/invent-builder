import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const TIER_META: Record<string, { label: string; emoji: string; dot: string }> = {
  enterprise: { label: "Enterprise",  emoji: "⭐", dot: "bg-[oklch(0.62_0.17_55)]" },
  hot:        { label: "Hot",         emoji: "🔥", dot: "bg-[oklch(0.58_0.20_30)]" },
  warm:       { label: "Warm",        emoji: "🌡️", dot: "bg-[oklch(0.62_0.15_75)]" },
  cold:       { label: "Cold",        emoji: "❄️", dot: "bg-muted-foreground" },
};

export default function CrmPage() {
  const { locale } = Route.useParams() as { locale: string };
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [testEmail, setTestEmail] = useState("alexandropeer@gmail.com");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function sendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hook-secret": "maskinval-welcome",
        },
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
    supabase
      .from("company_profiles")
      .select("*")
      .order("score", { ascending: false })
      .then(({ data }) => {
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
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM — Kunder</h1>
          <p className="text-sm text-muted-foreground mt-1">{profiles.length} registrerade · snitt {avgScore} poäng · {complete} fullständiga profiler</p>
        </div>
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
                      <div>{p.company_name ?? <span className="text-muted-foreground italic">Ej angivet</span>}</div>
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

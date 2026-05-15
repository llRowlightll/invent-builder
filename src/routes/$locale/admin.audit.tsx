import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/admin/audit")({
  component: AuditPage,
});

interface AuditRow {
  id: string;
  ts: string;
  user_id: string | null;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

const ACTION_STYLE: Record<string, string> = {
  INSERT: "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]",
  UPDATE: "bg-[oklch(0.94_0.08_85)] text-[oklch(0.38_0.12_75)]",
  DELETE: "bg-[oklch(0.93_0.08_25)] text-[oklch(0.38_0.18_25)]",
};

function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  useEffect(() => {
    (supabase as any)
      .from("audit_log")
      .select("*")
      .order("ts", { ascending: false })
      .limit(200)
      .then(({ data }: { data: AuditRow[] | null }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, []);

  const allTables = Array.from(new Set(rows.map((r) => r.table_name))).sort();
  const allActions = ["INSERT", "UPDATE", "DELETE"];

  const visible = rows.filter((r) => {
    if (tableFilter !== "all" && r.table_name !== tableFilter) return false;
    if (actionFilter !== "all" && r.action !== actionFilter) return false;
    return true;
  });

  if (loading) {
    return <div className="container-page py-16 text-sm text-muted-foreground">Laddar audit-logg…</div>;
  }

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit-logg</h1>
          <p className="text-sm text-muted-foreground mt-1">{visible.length} av {rows.length} händelser</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Tabell:</label>
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="px-2 py-1.5 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
          >
            <option value="all">Alla</option>
            {allTables.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Åtgärd:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2 py-1.5 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
          >
            <option value="all">Alla</option>
            {allActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Tid</th>
                <th className="px-4 py-3">Användare</th>
                <th className="px-4 py-3">Tabell</th>
                <th className="px-4 py-3">Post-ID</th>
                <th className="px-4 py-3">Åtgärd</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-border last:border-0 hover:bg-surface-alt/50 transition cursor-pointer ${
                    selected?.id === r.id ? "bg-info/8" : ""
                  }`}
                  onClick={() => setSelected(selected?.id === r.id ? null : r)}
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.ts).toLocaleString("sv-SE")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.user_id ? r.user_id.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.table_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.record_id ? r.record_id.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded ${ACTION_STYLE[r.action] ?? "bg-muted text-muted-foreground"}`}>
                      {r.action}
                    </span>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    Inga händelser matchar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diff view */}
      {selected && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">
              Diff — {selected.table_name} · {selected.action} · {new Date(selected.ts).toLocaleString("sv-SE")}
            </h2>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Stäng ×
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Före (old_data)</div>
              <pre className="text-xs bg-surface-alt p-3 rounded-md overflow-auto max-h-80 whitespace-pre-wrap break-all">
                {selected.old_data != null ? JSON.stringify(selected.old_data, null, 2) : "—"}
              </pre>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Efter (new_data)</div>
              <pre className="text-xs bg-surface-alt p-3 rounded-md overflow-auto max-h-80 whitespace-pre-wrap break-all">
                {selected.new_data != null ? JSON.stringify(selected.new_data, null, 2) : "—"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

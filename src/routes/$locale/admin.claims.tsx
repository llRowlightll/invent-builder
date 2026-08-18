import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard } from "@/lib/auth-context";

export const Route = createFileRoute("/$locale/admin/claims")({
  component: AdminClaimsPage,
});

const STATUS_OPTIONS = ["open", "in_review", "resolved", "closed"];
const STATUS_LABELS: Record<string, string> = {
  open: "Öppen", in_review: "Under granskning", resolved: "Löst", closed: "Stängd",
};
const URGENCY_LABELS: Record<string, string> = {
  low: "Låg", normal: "Normal", high: "Hög", critical: "Kritisk",
};
const TYPE_LABELS: Record<string, string> = {
  wrong_product: "Fel produkt", damaged: "Skadad", missing: "Saknas",
  quality: "Kvalitet", delay: "Försening", other: "Övrigt",
};

function statusColor(s: string) {
  const m: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    in_review: "bg-amber-100 text-amber-700",
    resolved: "bg-green-100 text-green-700",
    closed: "bg-muted text-muted-foreground",
  };
  return m[s] ?? "bg-muted text-muted-foreground";
}
function urgencyColor(s: string) {
  if (s === "critical") return "text-destructive font-bold";
  if (s === "high") return "text-amber-600 font-semibold";
  return "text-muted-foreground";
}

interface ClaimRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status: string;
  claim_type: string | null;
  order_ref: string | null;
  sku: string | null;
  title: string;
  description: string;
  urgency: string;
  resolution_note: string | null;
  admin_note: string | null;
  contact_email: string | null;
}

function ClaimEditModal({ claim, onClose, onSaved }: { claim: ClaimRow; onClose: () => void; onSaved: (c: ClaimRow) => void }) {
  const [status, setStatus] = useState(claim.status);
  const [resolutionNote, setResolutionNote] = useState(claim.resolution_note ?? "");
  const [adminNote, setAdminNote] = useState(claim.admin_note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data } = await supabase
      .from("claims")
      .update({
        status,
        resolution_note: resolutionNote || null,
        admin_note: adminNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claim.id)
      .select()
      .single();
    setSaving(false);
    if (data) onSaved(data as ClaimRow);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-foreground text-lg">Reklamation</h2>
            <p className="text-xs text-muted-foreground">#{claim.id.slice(0, 8).toUpperCase()} · {claim.title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 border border-border p-3 text-xs space-y-1">
            {claim.order_ref && <div><span className="text-muted-foreground">Order:</span> <span className="font-mono">{claim.order_ref}</span></div>}
            {claim.sku && <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{claim.sku}</span></div>}
            {claim.claim_type && <div><span className="text-muted-foreground">Typ:</span> {TYPE_LABELS[claim.claim_type] ?? claim.claim_type}</div>}
            {claim.contact_email && <div><span className="text-muted-foreground">Kontakt:</span> {claim.contact_email}</div>}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Beskrivning</label>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap bg-muted/30 rounded-md p-3">{claim.description}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Svar till kund (syns på deras sida)</label>
            <textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} rows={3}
              placeholder="T.ex. hur ärendet löstes, ersättningsvara skickad, kreditering etc."
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Intern anteckning (syns ej för kund)</label>
            <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition">Avbryt</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50">
            {saving ? "Sparar..." : "Spara ändringar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminClaimsPage() {
  const { locale } = Route.useParams();
  const { isAdmin, authLoading } = useAdminGuard();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClaimRow | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { navigate({ to: "/$locale/login", params: { locale } }); return; }
    supabase.from("claims").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setClaims((data as ClaimRow[]) ?? []); setLoading(false); });
  }, [isAdmin, authLoading]);

  const filtered = filterStatus === "all" ? claims : claims.filter((c) => c.status === filterStatus);

  return (
    <div className="container-page py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reklamationer</h1>
          <p className="text-sm text-muted-foreground">{claims.length} ärenden totalt</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all", ...STATUS_OPTIONS].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 text-xs rounded-full border transition ${
                filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              {s === "all" ? "Alla" : STATUS_LABELS[s]}
              {s !== "all" && <span className="ml-1 opacity-70">({claims.filter((c) => c.status === s).length})</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          {filterStatus === "all" ? "Inga reklamationer ännu." : `Inga ärenden med status "${STATUS_LABELS[filterStatus]}".`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Ärende", "Order/SKU", "Typ", "Brådska", "Status", "Inkom", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((claim) => (
                <tr key={claim.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{claim.title}</div>
                    <div className="text-xs text-muted-foreground">{claim.contact_email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {claim.order_ref ?? "—"}{claim.sku ? ` · ${claim.sku}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {claim.claim_type ? (TYPE_LABELS[claim.claim_type] ?? claim.claim_type) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-xs ${urgencyColor(claim.urgency)}`}>
                    {URGENCY_LABELS[claim.urgency] ?? claim.urgency}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(claim.status)}`}>
                      {STATUS_LABELS[claim.status] ?? claim.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(claim.created_at).toLocaleDateString("sv-SE")}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(claim)}
                      className="px-3 py-1 text-xs rounded-md border border-border hover:border-primary text-muted-foreground hover:text-foreground transition">
                      Hantera
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ClaimEditModal
          claim={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => setClaims((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
        />
      )}
    </div>
  );
}

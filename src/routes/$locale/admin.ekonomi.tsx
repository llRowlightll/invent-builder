import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth-context";

export const Route = createFileRoute("/$locale/admin/ekonomi")({
  component: EkonomiPage,
});

const VAT = 0.25;
const REVENUE_STATUSES = ["accepted", "shipped", "paid", "completed"];

type Rfq = {
  id: string;
  contact_name: string | null;
  company: string | null;
  org_number: string | null;
  po_number: string | null;
  quote_amount: number | null;
  quote_currency: string | null;
  status: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  new: "Ny", processing: "Under behandling", quoted: "Offert skickad",
  accepted: "Accepterad", rejected: "Avvisad", shipped: "Skickad",
  paid: "Betald", completed: "Slutförd",
};

function docRef(id: string) { return `OE-${id.slice(0, 8).toUpperCase()}`; }
function kr(n: number) { return n.toLocaleString("sv-SE", { maximumFractionDigits: 0 }); }
function dec(n: number) { return n.toFixed(2).replace(".", ","); }

function EkonomiPage() {
  const { locale } = Route.useParams();
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();

  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [busy, setBusy] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => { if (!loading && !user) window.location.href = `/${locale}/login`; }, [user, loading, locale]);
  useEffect(() => { load(); }, []);

  async function load() {
    setBusy(true);
    const { data } = await supabase
      .from("rfqs")
      .select("id,contact_name,company,org_number,po_number,quote_amount,quote_currency,status,created_at")
      .order("created_at", { ascending: false });
    setRfqs((data as Rfq[]) ?? []);
    setBusy(false);
  }

  const rows = useMemo(() => rfqs
    .filter((r) => {
      if (status !== "all" && (r.status ?? "new") !== status) return false;
      const d = r.created_at.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    })
    .map((r) => {
      const inc = Number(r.quote_amount ?? 0);
      const ex = inc / (1 + VAT);
      return {
        id: r.id, date: r.created_at.slice(0, 10), ref: docRef(r.id),
        kund: r.company || r.contact_name || "—", org: r.org_number ?? "", po: r.po_number ?? "",
        statusKey: r.status ?? "new", statusLabel: STATUS_LABEL[r.status ?? "new"] ?? (r.status ?? "—"),
        currency: r.quote_currency ?? "SEK", inc, ex, vat: inc - ex,
      };
    }), [rfqs, from, to, status]);

  const sum = useMemo(() => ({
    count: rows.length,
    ex: rows.reduce((s, r) => s + r.ex, 0),
    vat: rows.reduce((s, r) => s + r.vat, 0),
    inc: rows.reduce((s, r) => s + r.inc, 0),
    revenueEx: rows.filter((r) => REVENUE_STATUSES.includes(r.statusKey)).reduce((s, r) => s + r.ex, 0),
  }), [rows]);

  function exportCsv() {
    const head = ["Datum", "Referens", "Kund", "Org.nr", "PO", "Status", "Belopp ex moms", "Moms 25%", "Belopp ink moms", "Valuta"];
    const body = rows.map((r) => [r.date, r.ref, r.kund, r.org, r.po, r.statusLabel, dec(r.ex), dec(r.vat), dec(r.inc), r.currency]);
    const csv = [head, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `maskinval-forsaljning-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    const trs = rows.map((r) => `<tr><td>${r.date}</td><td>${r.ref}</td><td>${r.kund}</td><td>${r.org}</td><td>${r.statusLabel}</td><td class="r">${kr(r.ex)}</td><td class="r">${kr(r.vat)}</td><td class="r">${kr(r.inc)}</td><td>${r.currency}</td></tr>`).join("");
    w.document.write(`<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><title>Försäljningsrapport — Maskinval</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:32px;color:#111}h1{font-size:18px;margin:0 0 4px}.meta{color:#555;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left}th{background:#f3f4f6;font-size:10px;text-transform:uppercase;color:#64748b}.r{text-align:right}tfoot td{border-top:2px solid #111;font-weight:bold}.note{margin-top:20px;color:#999;font-size:10px}</style></head>
<body><h1>Försäljningsrapport — Maskinval</h1>
<div class="meta">Period: ${from || "start"} – ${to || "idag"} · Status: ${status === "all" ? "alla" : STATUS_LABEL[status] ?? status} · ${sum.count} rader · genererad ${new Date().toLocaleString("sv-SE")}</div>
<table><thead><tr><th>Datum</th><th>Referens</th><th>Kund</th><th>Org.nr</th><th>Status</th><th class="r">Ex moms</th><th class="r">Moms</th><th class="r">Ink moms</th><th>Valuta</th></tr></thead>
<tbody>${trs}</tbody>
<tfoot><tr><td colspan="5">Summa</td><td class="r">${kr(sum.ex)}</td><td class="r">${kr(sum.vat)}</td><td class="r">${kr(sum.inc)}</td><td>SEK</td></tr></tfoot></table>
<div class="note">Försäljningsregister för överblick och underlag — ej formell bokföring enligt Bokföringslagen. Lämnas till revisor/bokföring.</div>
</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  }

  if (loading || !user) return <div className="container-page py-16 text-sm text-muted-foreground">Laddar…</div>;
  if (!isAdmin) return (
    <div className="container-page py-16 max-w-md text-center">
      <div className="text-4xl mb-4">🔒</div>
      <h1 className="text-xl font-semibold">Admin-åtkomst krävs</h1>
    </div>
  );

  const cards = [
    { label: "Rader", value: String(sum.count), sub: "i urvalet" },
    { label: "Försäljning ex moms", value: kr(sum.ex) + " kr", sub: "alla i urvalet" },
    { label: "Moms att redovisa", value: kr(sum.vat) + " kr", sub: "25 %" },
    { label: "Intäkt (accepterat)", value: kr(sum.revenueEx) + " kr", sub: "ex moms, accepterade ordrar" },
  ];

  return (
    <div className="container-page py-10 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link to="/$locale/admin/rfq" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">← RFQ-lista</Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Ekonomi — försäljningsregister</h1>
          <p className="mt-1 text-sm text-muted-foreground">Alla offerter/ordrar med belopp och moms. Exportera till Excel eller PDF.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="text-sm px-4 py-2 rounded-md border border-border hover:border-info transition">↓ Excel (CSV)</button>
          <button onClick={exportPdf} className="text-sm px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90 transition">🖨 PDF / Skriv ut</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="text-xl font-bold mt-1 tabular-nums">{c.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Från</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-1.5 rounded-md border border-border bg-card text-sm" />
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Till</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-1.5 rounded-md border border-border bg-card text-sm" />
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-1.5 rounded-md border border-border bg-card text-sm">
            <option value="all">Alla</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {(from || to || status !== "all") && (
          <button onClick={() => { setFrom(""); setTo(""); setStatus("all"); }} className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-destructive hover:text-destructive transition">Rensa filter</button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-primary text-primary-foreground z-10">
              <tr>
                <th className="text-left px-3 py-2.5 text-xs font-medium">Datum</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium">Referens</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium">Kund</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium">Org.nr</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium">Status</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium">Ex moms</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium">Moms</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium">Ink moms</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium">Valuta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {busy && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground animate-pulse">Laddar…</td></tr>}
              {!busy && rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Inga rader i urvalet.</td></tr>}
              {!busy && rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-alt/40">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    <Link to="/$locale/admin/offert/$rfqId" params={{ locale, rfqId: r.id }} className="text-info hover:underline">{r.ref}</Link>
                  </td>
                  <td className="px-3 py-2 max-w-[180px] truncate">{r.kund}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.org || "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.statusLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kr(r.ex)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{kr(r.vat)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{kr(r.inc)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.currency}</td>
                </tr>
              ))}
            </tbody>
            {!busy && rows.length > 0 && (
              <tfoot className="sticky bottom-0 bg-card border-t-2 border-border">
                <tr className="font-semibold">
                  <td className="px-3 py-2" colSpan={5}>Summa ({sum.count})</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kr(sum.ex)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kr(sum.vat)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kr(sum.inc)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">SEK</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Belopp härleds från offertens totalsumma (ink moms); ex moms = total ÷ 1,25. Försäljningsregister för överblick och underlag — <strong>ej formell bokföring</strong> enligt Bokföringslagen. Exportera och lämna till revisor/bokföring.
      </p>
    </div>
  );
}

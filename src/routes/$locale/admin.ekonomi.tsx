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
  id: string; contact_name: string | null; company: string | null; org_number: string | null;
  po_number: string | null; quote_amount: number | null; quote_currency: string | null;
  status: string | null; created_at: string;
};
type Expense = {
  id: string; expense_date: string; description: string; supplier: string | null;
  category: string | null; amount_ex_vat: number; vat_amount: number; currency: string;
};

const STATUS_LABEL: Record<string, string> = {
  new: "Ny", processing: "Under behandling", quoted: "Offert skickad",
  accepted: "Accepterad", rejected: "Avvisad", shipped: "Skickad",
  paid: "Betald", completed: "Slutförd",
};

function docRef(id: string) { return `OE-${id.slice(0, 8).toUpperCase()}`; }
function kr(n: number) { return n.toLocaleString("sv-SE", { maximumFractionDigits: 0 }); }
function dec(n: number) { return n.toFixed(2).replace(".", ","); }
function num(s: string) { const n = Number(s.replace(/\s/g, "").replace(",", ".")); return isNaN(n) ? 0 : n; }

function EkonomiPage() {
  const { locale } = Route.useParams();
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();

  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [busy, setBusy] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");

  // expense add-form
  const [exDate, setExDate] = useState(new Date().toISOString().slice(0, 10));
  const [exDesc, setExDesc] = useState("");
  const [exSupplier, setExSupplier] = useState("");
  const [exAmount, setExAmount] = useState("");
  const [exVatStr, setExVatStr] = useState("");
  const [exSaving, setExSaving] = useState(false);

  useEffect(() => { if (!loading && !user) window.location.href = `/${locale}/login`; }, [user, loading, locale]);
  useEffect(() => { load(); }, []);

  async function load() {
    setBusy(true);
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.from("rfqs").select("id,contact_name,company,org_number,po_number,quote_amount,quote_currency,status,created_at").order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    ]);
    setRfqs((r as Rfq[]) ?? []);
    setExpenses((e as Expense[]) ?? []);
    setBusy(false);
  }

  async function addExpense() {
    const amt = num(exAmount);
    if (!exDesc.trim() || amt <= 0) return;
    setExSaving(true);
    const vat = exVatStr.trim() ? num(exVatStr) : amt * VAT;
    const { data, error } = await supabase.from("expenses").insert({
      expense_date: exDate, description: exDesc.trim(), supplier: exSupplier.trim() || null,
      amount_ex_vat: amt, vat_amount: vat, created_by: user!.id,
    }).select().single();
    setExSaving(false);
    if (!error && data) {
      setExpenses((p) => [data as Expense, ...p]);
      setExDesc(""); setExSupplier(""); setExAmount(""); setExVatStr("");
    }
  }
  async function deleteExpense(id: string) {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((p) => p.filter((x) => x.id !== id));
  }

  const inDate = (d: string) => (!from || d >= from) && (!to || d <= to);

  const rows = useMemo(() => rfqs
    .filter((r) => (status === "all" || (r.status ?? "new") === status) && inDate(r.created_at.slice(0, 10)))
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

  const exRows = useMemo(() => expenses.filter((x) => inDate(x.expense_date)), [expenses, from, to]);

  const sum = useMemo(() => {
    const salesEx = rows.reduce((s, r) => s + r.ex, 0);
    const salesVat = rows.reduce((s, r) => s + r.vat, 0);
    const revenueEx = rows.filter((r) => REVENUE_STATUSES.includes(r.statusKey)).reduce((s, r) => s + r.ex, 0);
    const expEx = exRows.reduce((s, x) => s + Number(x.amount_ex_vat), 0);
    const expVat = exRows.reduce((s, x) => s + Number(x.vat_amount), 0);
    return { count: rows.length, salesEx, salesVat, revenueEx, expEx, expVat,
      vatNet: salesVat - expVat, result: revenueEx - expEx };
  }, [rows, exRows]);

  function download(name: string, content: string, type: string) {
    const blob = new Blob(["﻿" + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const head = ["Typ", "Datum", "Referens/Beskrivning", "Kund/Leverantör", "Status/Kategori", "Belopp ex moms", "Moms", "Belopp ink moms", "Valuta"];
    const sales = rows.map((r) => ["Försäljning", r.date, r.ref, r.kund, r.statusLabel, dec(r.ex), dec(r.vat), dec(r.inc), r.currency]);
    const exp = exRows.map((x) => ["Utgift", x.expense_date, x.description, x.supplier ?? "", x.category ?? "", dec(Number(x.amount_ex_vat)), dec(Number(x.vat_amount)), dec(Number(x.amount_ex_vat) + Number(x.vat_amount)), x.currency]);
    const csv = [head, ...sales, ...exp].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    download(`maskinval-ekonomi-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8;");
  }

  function exportPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    const salesTrs = rows.map((r) => `<tr><td>${r.date}</td><td>${r.ref}</td><td>${r.kund}</td><td>${r.statusLabel}</td><td class="r">${kr(r.ex)}</td><td class="r">${kr(r.vat)}</td><td class="r">${kr(r.inc)}</td></tr>`).join("");
    const expTrs = exRows.map((x) => `<tr><td>${x.expense_date}</td><td>${x.description}</td><td>${x.supplier ?? ""}</td><td></td><td class="r">${kr(Number(x.amount_ex_vat))}</td><td class="r">${kr(Number(x.vat_amount))}</td><td class="r">${kr(Number(x.amount_ex_vat) + Number(x.vat_amount))}</td></tr>`).join("");
    w.document.write(`<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><title>Ekonomirapport — Maskinval</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:32px;color:#111}h1{font-size:18px;margin:0 0 2px}h2{font-size:13px;margin:20px 0 4px}.meta{color:#555;font-size:11px;margin-bottom:8px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e2e8f0;padding:5px 8px;text-align:left}th{background:#f3f4f6;font-size:10px;text-transform:uppercase;color:#64748b}.r{text-align:right}tfoot td{border-top:2px solid #111;font-weight:bold}.result{margin-top:18px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:13px}.note{margin-top:18px;color:#999;font-size:10px}</style></head>
<body><h1>Ekonomirapport — Maskinval</h1>
<div class="meta">Period: ${from || "start"} – ${to || "idag"} · genererad ${new Date().toLocaleString("sv-SE")}</div>
<h2>Försäljning (${rows.length})</h2>
<table><thead><tr><th>Datum</th><th>Referens</th><th>Kund</th><th>Status</th><th class="r">Ex moms</th><th class="r">Moms</th><th class="r">Ink moms</th></tr></thead><tbody>${salesTrs || '<tr><td colspan="7">—</td></tr>'}</tbody>
<tfoot><tr><td colspan="4">Summa</td><td class="r">${kr(sum.salesEx)}</td><td class="r">${kr(sum.salesVat)}</td><td class="r">${kr(sum.salesEx + sum.salesVat)}</td></tr></tfoot></table>
<h2>Utgifter (${exRows.length})</h2>
<table><thead><tr><th>Datum</th><th>Beskrivning</th><th>Leverantör</th><th></th><th class="r">Ex moms</th><th class="r">Moms</th><th class="r">Ink moms</th></tr></thead><tbody>${expTrs || '<tr><td colspan="7">—</td></tr>'}</tbody>
<tfoot><tr><td colspan="4">Summa</td><td class="r">${kr(sum.expEx)}</td><td class="r">${kr(sum.expVat)}</td><td class="r">${kr(sum.expEx + sum.expVat)}</td></tr></tfoot></table>
<div class="result"><strong>Resultat (accepterad intäkt − utgifter, ex moms):</strong> ${kr(sum.result)} kr &nbsp;·&nbsp; <strong>Moms netto att redovisa:</strong> ${kr(sum.vatNet)} kr</div>
<div class="note">Försäljnings- och utgiftsregister för överblick och underlag — ej formell bokföring enligt Bokföringslagen. Lämnas till revisor/bokföring.</div>
</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  }

  if (loading || !user) return <div className="container-page py-16 text-sm text-muted-foreground">Laddar…</div>;
  if (!isAdmin) return (
    <div className="container-page py-16 max-w-md text-center">
      <div className="text-4xl mb-4">🔒</div><h1 className="text-xl font-semibold">Admin-åtkomst krävs</h1>
    </div>
  );

  const cards = [
    { label: "Försäljning ex moms", value: kr(sum.salesEx) + " kr", sub: "alla i urvalet" },
    { label: "Utgifter ex moms", value: kr(sum.expEx) + " kr", sub: `${exRows.length} poster` },
    { label: "Moms netto att redovisa", value: kr(sum.vatNet) + " kr", sub: "försäljning − utgifter" },
    { label: "Resultat (netto)", value: kr(sum.result) + " kr", sub: "accepterad intäkt − utgifter" },
  ];

  return (
    <div className="container-page py-10 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link to="/$locale/admin/dashboard" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">← Översikt</Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Ekonomi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Försäljning + utgifter med moms. Exportera till Excel eller PDF.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="text-sm px-4 py-2 rounded-md border border-border hover:border-info transition">↓ Excel (CSV)</button>
          <button onClick={exportPdf} className="text-sm px-4 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90 transition">🖨 PDF / Skriv ut</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className={`text-xl font-bold mt-1 tabular-nums ${c.label.startsWith("Resultat") ? (sum.result >= 0 ? "text-[oklch(0.55_0.16_155)]" : "text-destructive") : ""}`}>{c.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <label className="text-xs"><span className="block text-muted-foreground mb-1">Från</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-1.5 rounded-md border border-border bg-card text-sm" /></label>
        <label className="text-xs"><span className="block text-muted-foreground mb-1">Till</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-1.5 rounded-md border border-border bg-card text-sm" /></label>
        <label className="text-xs"><span className="block text-muted-foreground mb-1">Status (försäljning)</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-1.5 rounded-md border border-border bg-card text-sm">
            <option value="all">Alla</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        {(from || to || status !== "all") && <button onClick={() => { setFrom(""); setTo(""); setStatus("all"); }} className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-destructive hover:text-destructive transition">Rensa filter</button>}
      </div>

      {/* Sales table */}
      <h2 className="text-sm font-semibold mb-2">Försäljning ({rows.length})</h2>
      <div className="rounded-xl border border-border overflow-hidden mb-8">
        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-primary text-primary-foreground z-10"><tr>
              <th className="text-left px-3 py-2.5 text-xs font-medium">Datum</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium">Referens</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium">Kund</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium">Status</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium">Ex moms</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium">Moms</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium">Ink moms</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {busy && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground animate-pulse">Laddar…</td></tr>}
              {!busy && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Inga ordrar i urvalet ännu.</td></tr>}
              {!busy && rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-alt/40">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2 font-mono text-[11px]"><Link to="/$locale/admin/offert/$rfqId" params={{ locale, rfqId: r.id }} className="text-info hover:underline">{r.ref}</Link></td>
                  <td className="px-3 py-2 max-w-[180px] truncate">{r.kund}</td>
                  <td className="px-3 py-2 text-xs">{r.statusLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kr(r.ex)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{kr(r.vat)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{kr(r.inc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses */}
      <h2 className="text-sm font-semibold mb-2">Utgifter ({exRows.length})</h2>
      <div className="rounded-xl border border-border bg-card p-4 mb-3">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
          <label className="text-xs"><span className="block text-muted-foreground mb-1">Datum</span>
            <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs" /></label>
          <label className="text-xs sm:col-span-2"><span className="block text-muted-foreground mb-1">Beskrivning *</span>
            <input value={exDesc} onChange={(e) => setExDesc(e.target.value)} placeholder="t.ex. Frakt DHL" className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs" /></label>
          <label className="text-xs"><span className="block text-muted-foreground mb-1">Leverantör</span>
            <input value={exSupplier} onChange={(e) => setExSupplier(e.target.value)} className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs" /></label>
          <label className="text-xs"><span className="block text-muted-foreground mb-1">Belopp ex moms *</span>
            <input value={exAmount} onChange={(e) => setExAmount(e.target.value)} placeholder="0" className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-right" /></label>
          <label className="text-xs"><span className="block text-muted-foreground mb-1">Moms (auto 25%)</span>
            <input value={exVatStr} onChange={(e) => setExVatStr(e.target.value)} placeholder={exAmount ? dec(num(exAmount) * VAT) : "0"} className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-right" /></label>
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={addExpense} disabled={exSaving || !exDesc.trim() || num(exAmount) <= 0}
            className="text-xs px-4 py-1.5 rounded-md bg-info text-primary-foreground hover:opacity-90 disabled:opacity-50 transition">{exSaving ? "Sparar…" : "+ Lägg till utgift"}</button>
        </div>
      </div>
      {exRows.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Datum</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Beskrivning</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Leverantör</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Ex moms</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Moms</th>
              <th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-border">
              {exRows.map((x) => (
                <tr key={x.id} className="hover:bg-surface-alt/40">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{x.expense_date}</td>
                  <td className="px-3 py-2">{x.description}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{x.supplier ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kr(Number(x.amount_ex_vat))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{kr(Number(x.vat_amount))}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => deleteExpense(x.id)} className="text-xs text-muted-foreground hover:text-destructive">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-4">
        Försäljningsbelopp härleds från offertens totalsumma (ink moms ÷ 1,25). <strong>Resultat</strong> = accepterad intäkt − utgifter (ex moms). Försäljnings-/utgiftsregister för överblick och underlag — <strong>ej formell bokföring</strong> enligt Bokföringslagen. Exportera och lämna till revisor/bokföring.
      </p>
    </div>
  );
}

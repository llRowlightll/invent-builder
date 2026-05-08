import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow, SelectionResult } from "@/lib/types";
import { BomTable, bomToCsv, downloadCsv, bomToEmailText } from "@/components/Bom";

export const Route = createFileRoute("/$locale/bom/$bomId")({
  head: ({ params }) => ({
    meta: [{ title: `BOM ${params.bomId.slice(0, 8)} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: BomPage,
});

function BomPage() {
  const { locale, bomId } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [result, setResult] = useState<SelectionResult | null>(null);
  const [bomMeta, setBomMeta] = useState<{ mode: string; order_code: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailVisible, setEmailVisible] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/$locale/login", params: { locale } });
  }, [user, loading, navigate, locale]);

  useEffect(() => {
    (async () => {
      const [{ data: bom }, catalog] = await Promise.all([
        supabase.from("boms").select("mode,order_code").eq("id", bomId).single(),
        loadCatalog(),
      ]);
      const { data: lines } = await supabase
        .from("bom_items")
        .select("role,qty,product_id,notes")
        .eq("bom_id", bomId);
      if (!bom || !lines) return;
      setBomMeta(bom);
      const items = lines
        .map((l) => {
          const p = catalog.find((x: ProductRow) => x.id === l.product_id);
          return p ? { role: l.role ?? "item", product: p, qty: l.qty, why: l.notes ?? "" } : null;
        })
        .filter(Boolean) as SelectionResult["items"];
      setResult({
        items,
        orderCode: bom.order_code ?? "—",
        validation: [],
        notes: [],
      });
    })();
  }, [bomId]);

  async function createRfq() {
    if (!user || !result) return;
    setBusy(true);
    try {
      const { data: rfq, error } = await supabase
        .from("rfqs")
        .insert({
          user_id: user.id,
          bom_id: bomId,
          contact_email: user.email,
          message: `Auto-generated RFQ for BOM ${bomId}`,
        })
        .select("id")
        .single();
      if (error || !rfq) throw error;
      await supabase.from("rfq_items").insert(
        result.items.map((i) => ({
          rfq_id: rfq.id,
          product_id: i.product.id,
          role: i.role,
          qty: i.qty,
        })),
      );
      // webhook stub
      try {
        await fetch("/api/public/notify/rfq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rfq_id: rfq.id, bom_id: bomId, items: result.items.length }),
        });
      } catch (e) { console.warn("webhook fire failed", e); }
      navigate({ to: "/$locale/rfq/$rfqId", params: { locale, rfqId: rfq.id } });
    } catch (e) {
      console.error(e);
      alert("Failed to create RFQ");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !result)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  const emailText = bomToEmailText(result);

  return (
    <div className="container-page py-10 max-w-4xl">
      <Link to="/$locale/orders" params={{ locale }} className="text-xs underline text-muted-foreground">
        ← {t("nav.orders")}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        BOM <span className="font-mono text-base">{result.orderCode}</span>
      </h1>
      <div className="text-sm text-muted-foreground">
        Mode: <span className="capitalize">{bomMeta?.mode}</span> · {result.items.length} items
      </div>

      <div className="mt-6">
        <BomTable result={result} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={createRfq}
          disabled={busy}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
        >
          Create RFQ
        </button>
        <button
          onClick={() => downloadCsv(`${result.orderCode}.csv`, bomToCsv(result))}
          className="px-4 py-2 rounded-md border border-border text-sm"
        >
          Download CSV
        </button>
        <button
          onClick={() => setEmailVisible((v) => !v)}
          className="px-4 py-2 rounded-md border border-border text-sm"
        >
          {emailVisible ? "Hide" : "Show"} email text
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(emailText)}
          className="px-4 py-2 rounded-md border border-border text-sm"
        >
          Copy email
        </button>
      </div>

      {emailVisible && (
        <pre className="mt-4 text-xs whitespace-pre-wrap rounded-md border border-border bg-card p-4">{emailText}</pre>
      )}
    </div>
  );
}

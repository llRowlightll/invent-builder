import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import { makeT, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { clearCatalogCache } from "@/lib/catalog";

export const Route = createFileRoute("/$locale/admin/import")({
  head: ({ params }) => ({
    meta: [{ title: `${makeT(params.locale as Locale)("nav.admin")} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
  component: ImportPage,
});

interface ParsedRow {
  sku: string;
  name: string;
  brand_slug: string;
  category_slug: string;
  family?: string;
  description?: string;
  lead_time_days?: string;
  ip_rating?: string;
  fieldbus?: string;
  voltage?: string;
}

function ImportPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [csv, setCsv] = useState("");
  const [version, setVersion] = useState("");
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/$locale/login", params: { locale } });
  }, [user, loading, navigate, locale]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setIsAdmin(!!data?.some((r) => r.role === "admin"));
    })();
  }, [user]);

  async function importNow() {
    setLog([]);
    const parsed = Papa.parse<ParsedRow>(csv, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) {
      setLog((l) => [...l, `Parse errors: ${parsed.errors.length}`]);
      return;
    }
    const rows = parsed.data;
    setLog((l) => [...l, `Parsed ${rows.length} rows`]);

    // map brand & category slugs to ids
    const [{ data: brands }, { data: cats }] = await Promise.all([
      supabase.from("brands").select("id,slug"),
      supabase.from("categories").select("id,slug"),
    ]);
    const bMap = new Map(brands?.map((b) => [b.slug, b.id]));
    const cMap = new Map(cats?.map((c) => [c.slug, c.id]));

    const valid = rows
      .filter((r) => r.sku && r.name && bMap.get(r.brand_slug) && cMap.get(r.category_slug))
      .map((r) => ({
        sku: r.sku.trim(),
        name: r.name.trim(),
        brand_id: bMap.get(r.brand_slug)!,
        category_id: cMap.get(r.category_slug)!,
        family: r.family || null,
        description: r.description || null,
        lead_time_days: r.lead_time_days ? Number(r.lead_time_days) : 14,
        ip_rating: r.ip_rating || null,
        fieldbus: r.fieldbus || null,
        voltage: r.voltage || null,
      }));

    setLog((l) => [...l, `${valid.length}/${rows.length} valid`]);

    if (valid.length === 0) return;
    const { error } = await supabase.from("products").upsert(valid, { onConflict: "sku" });
    if (error) {
      setLog((l) => [...l, `Upsert error: ${error.message}`]);
      return;
    }
    setLog((l) => [...l, `Upserted ${valid.length} products`]);

    if (version) {
      const { error: vErr } = await supabase
        .from("dataset_versions")
        .insert({ version, notes: `Import of ${valid.length} products`, created_by: user!.id });
      setLog((l) => [...l, vErr ? `Version error: ${vErr.message}` : `Logged version ${version}`]);
    }
    clearCatalogCache();
  }

  if (loading || !user)
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;

  if (isAdmin === false)
    return (
      <div className="container-page py-10 max-w-md">
        <h1 className="text-xl font-semibold">Admin only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn't an admin. Ask an admin to grant you the role, or insert one yourself in
          the database.
        </p>
        <Link to="/$locale/app" params={{ locale }} className="mt-4 inline-block text-sm underline">
          ← {t("nav.dashboard")}
        </Link>
      </div>
    );

  // ---- Use case map (CSV) ----
  const [ucCsv, setUcCsv] = useState("");
  async function importUseCases() {
    setLog((l) => [...l, "— use_case_map —"]);
    const parsed = Papa.parse<{
      category_slug: string;
      use_case_slug: string;
      title_en: string;
      title_sv: string;
      description_en?: string;
      description_sv?: string;
      recommended_skus?: string;
      sort_order?: string;
    }>(ucCsv, { header: true, skipEmptyLines: true });
    const rows = parsed.data.filter((r) => r.category_slug && r.use_case_slug).map((r) => ({
      category_slug: r.category_slug.trim(),
      use_case_slug: r.use_case_slug.trim(),
      title_en: r.title_en,
      title_sv: r.title_sv,
      description_en: r.description_en || null,
      description_sv: r.description_sv || null,
      recommended_skus: r.recommended_skus ? r.recommended_skus.split("|").map((s) => s.trim()).filter(Boolean) : [],
      sort_order: r.sort_order ? Number(r.sort_order) : 0,
    }));
    if (!rows.length) return setLog((l) => [...l, "No valid rows."]);
    const { error } = await supabase.from("use_case_map").upsert(rows, { onConflict: "category_slug,use_case_slug" });
    setLog((l) => [...l, error ? `Error: ${error.message}` : `Upserted ${rows.length} use cases`]);
  }

  // ---- Config JSON imports ----
  const [cfgJson, setCfgJson] = useState("");
  async function importConfigJson() {
    setLog((l) => [...l, "— config json —"]);
    let parsed: { schemas?: unknown[]; rules?: unknown[]; bom_mappings?: unknown[] };
    try {
      parsed = JSON.parse(cfgJson);
    } catch (e) {
      return setLog((l) => [...l, `Parse error: ${(e as Error).message}`]);
    }
    if (parsed.schemas?.length) {
      const { error } = await supabase.from("config_schemas").upsert(parsed.schemas as never, { onConflict: "schema_id" });
      setLog((l) => [...l, error ? `schemas error: ${error.message}` : `${parsed.schemas!.length} schemas`]);
    }
    if (parsed.rules?.length) {
      const { error } = await supabase.from("config_rules").insert(parsed.rules as never);
      setLog((l) => [...l, error ? `rules error: ${error.message}` : `${parsed.rules!.length} rules inserted`]);
    }
    if (parsed.bom_mappings?.length) {
      const { error } = await supabase.from("config_bom_mapping").upsert(parsed.bom_mappings as never, { onConflict: "schema_id" });
      setLog((l) => [...l, error ? `bom_mappings error: ${error.message}` : `${parsed.bom_mappings!.length} bom mappings`]);
    }
  }

  return (
    <div className="container-page py-10 max-w-3xl">
      <Link to="/$locale/app" params={{ locale }} className="text-xs underline text-muted-foreground">
        ← {t("nav.dashboard")}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Catalog import</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste CSV with header columns: <span className="font-mono">sku, name, brand_slug, category_slug, family, description, lead_time_days, ip_rating, fieldbus, voltage</span>.
      </p>

      <input
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        placeholder="dataset version (e.g. seed_v2)"
        className="mt-4 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
      />
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={10}
        placeholder="sku,name,brand_slug,category_slug,..."
        className="mt-3 w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono"
      />
      <button
        onClick={importNow}
        className="mt-3 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
      >
        Validate & import products
      </button>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Use case map (CSV)</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Headers: <span className="font-mono">category_slug, use_case_slug, title_en, title_sv, description_en, description_sv, recommended_skus (pipe-separated), sort_order</span>
        </p>
        <textarea
          value={ucCsv}
          onChange={(e) => setUcCsv(e.target.value)}
          rows={6}
          className="mt-2 w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono"
        />
        <button onClick={importUseCases} className="mt-2 px-4 py-2 rounded-md bg-foreground text-background text-sm">
          Import use cases
        </button>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Configurator JSON</h2>
        <p className="text-xs text-muted-foreground mt-1">
          One JSON object with optional keys <span className="font-mono">schemas[]</span>, <span className="font-mono">rules[]</span>, <span className="font-mono">bom_mappings[]</span>.
        </p>
        <textarea
          value={cfgJson}
          onChange={(e) => setCfgJson(e.target.value)}
          rows={8}
          placeholder='{"schemas":[{"schema_id":"X","title_en":"…","title_sv":"…","schema_json":{}}],"rules":[],"bom_mappings":[]}'
          className="mt-2 w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono"
        />
        <button onClick={importConfigJson} className="mt-2 px-4 py-2 rounded-md bg-foreground text-background text-sm">
          Import configurator JSON
        </button>
      </div>

      <div className="mt-6 rounded-md border border-border bg-card p-3 text-xs font-mono space-y-1">
        {log.length === 0 ? (
          <p className="text-muted-foreground">No log yet.</p>
        ) : (
          log.map((l, i) => <p key={i}>{l}</p>)
        )}
      </div>
    </div>
  );
}

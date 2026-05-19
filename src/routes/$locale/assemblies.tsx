import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

interface Assembly {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model_number: string | null;
  category: string;
  subcategory: string | null;
  description: string | null;
  standard: string | null;
  image_url: string | null;
}

export const Route = createFileRoute("/$locale/assemblies")({
  component: AssembliesPage,
});

const BRAND_COLORS: Record<string, string> = {
  Festo: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Parker: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Bosch Rexroth": "bg-red-500/10 text-red-400 border-red-500/20",
  Norgren: "bg-green-500/10 text-green-400 border-green-500/20",
  SMC: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function AssembliesPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  useEffect(() => {
    supabase
      .from("assemblies")
      .select("*")
      .order("brand")
      .then(({ data }) => {
        setAssemblies(data ?? []);
        setLoading(false);
      });
  }, []);

  const brands = ["all", ...Array.from(new Set(assemblies.map((a) => a.brand)))];
  const categories = ["all", ...Array.from(new Set(assemblies.map((a) => a.category)))];

  const filtered = assemblies.filter((a) => {
    if (filterBrand !== "all" && a.brand !== filterBrand) return false;
    if (filterCat !== "all" && a.category !== filterCat) return false;
    return true;
  });

  if (loading) return (
    <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>
  );

  return (
    <div className="container-page py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Assemblies & Exploded Views</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detailed part breakdowns for service, spare parts ordering and RFQ
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 flex-wrap">
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setFilterBrand(b)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                filterBrand === b
                  ? "bg-info text-primary-foreground border-info"
                  : "border-border text-muted-foreground hover:border-info hover:text-info"
              }`}
            >
              {b === "all" ? "All brands" : b}
            </button>
          ))}
        </div>
        <div className="w-px bg-border mx-1" />
        <div className="flex gap-1 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                filterCat === c
                  ? "bg-info text-primary-foreground border-info"
                  : "border-border text-muted-foreground hover:border-info hover:text-info"
              }`}
            >
              {c === "all" ? "All categories" : c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No assemblies found.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to="/$locale/assembly/$slug"
              params={{ locale, slug: a.slug }}
              className="group rounded-xl border border-border bg-card p-4 hover:border-info transition-colors flex flex-col gap-3"
            >
              {a.image_url ? (
                <div className="aspect-[16/7] rounded-md overflow-hidden bg-surface-alt">
                  <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[16/7] rounded-md bg-surface-alt flex items-center justify-center">
                  <svg className="w-10 h-10 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                      BRAND_COLORS[a.brand] ?? "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {a.brand}
                  </span>
                  {a.standard && (
                    <span className="text-[10px] text-muted-foreground font-mono">{a.standard}</span>
                  )}
                </div>
                <div className="font-semibold text-sm text-foreground group-hover:text-info transition-colors line-clamp-2">
                  {a.name}
                </div>
                {a.model_number && (
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{a.model_number}</div>
                )}
                {a.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                )}
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{a.subcategory ?? a.category}</span>
                <span className="text-xs text-info font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View parts →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

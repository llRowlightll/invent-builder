import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { makeT, type Locale } from "@/lib/i18n";

interface Family {
  id: string;
  slug: string;
  name: string;
  title: string;
  category_slug: string;
  standard: string | null;
  stroke_min_mm: number | null;
  stroke_max_mm: number | null;
}

export const Route = createFileRoute("/$locale/configure")({
  component: ConfigureIndexPage,
});

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  cylinder: {
    label: "Cylindrar",
    icon: "⚙️",
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  "linear-module": {
    label: "Linjärmoduler",
    icon: "↔️",
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  valve: {
    label: "Ventiler",
    icon: "🔧",
    color: "bg-green-50 border-green-200 text-green-800",
  },
};

function ConfigureIndexPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("configurator_families")
      .select("id,slug,name,title,category_slug,standard,stroke_min_mm,stroke_max_mm")
      .order("category_slug")
      .then(({ data }) => {
        setFamilies((data || []) as unknown as Family[]);
        setLoading(false);
      });
  }, []);

  const categories = Array.from(
    new Set(families.map((f) => f.category_slug))
  );

  const filtered = activeCategory
    ? families.filter((f) => f.category_slug === activeCategory)
    : families;

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Festo Produktkonfigurator
        </h1>
        <p className="text-gray-500 mt-2 text-lg">
          Välj en produktfamilj och konfigurera din artikel steg för steg —
          få din orderkod direkt.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
            activeCategory === null
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
          }`}
        >
          Alla ({families.length})
        </button>
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat] || { label: cat, icon: "", color: "" };
          const count = families.filter((f) => f.category_slug === cat).length;
          return (
            <button
              key={cat}
              onClick={() =>
                setActiveCategory(activeCategory === cat ? null : cat)
              }
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                activeCategory === cat
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {meta.icon} {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Families grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((family) => {
          const meta = CATEGORY_META[family.category_slug] || {
            label: family.category_slug,
            icon: "📦",
            color: "bg-gray-50 border-gray-200 text-gray-700",
          };
          return (
            <div
              key={family.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              {/* Category badge */}
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded border mb-3 ${meta.color}`}
              >
                {meta.icon} {meta.label}
              </span>

              {/* Family name & title */}
              <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                {family.name}
              </h2>
              <p className="text-gray-500 text-sm mt-1 leading-snug">
                {family.title}
              </p>

              {/* Meta tags */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {family.standard && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                    {family.standard}
                  </span>
                )}
                {family.stroke_min_mm != null &&
                  family.stroke_max_mm != null && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      Slag: {family.stroke_min_mm}–{family.stroke_max_mm} mm
                    </span>
                  )}
              </div>

              {/* CTA */}
              <Link
                to={"/$locale/configurator/$family" as never}
                params={{ locale, family: family.slug } as never}
                className="mt-4 flex items-center justify-between w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <span>Konfigurera</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Inga produktfamiljer hittades</p>
        </div>
      )}
    </div>
  );
}

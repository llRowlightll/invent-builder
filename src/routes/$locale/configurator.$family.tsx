import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { makeT, type Locale } from "@/lib/i18n";

// Types
interface Family {
  id: string;
  slug: string;
  name: string;
  title: string;
  category_slug: string;
  order_code_template: string;
  description: string;
  standard: string;
  stroke_min_mm: number;
  stroke_max_mm: number;
}
interface ParamValue {
  id: string;
  code: string;
  label: string;
  description: string;
  sort_order: number;
}
interface Param {
  id: string;
  param_key: string;
  label: string;
  param_type: string;
  sort_order: number;
  required: boolean;
  values: ParamValue[];
}
interface Accessory {
  id: string;
  accessory_code: string;
  name: string;
  description: string;
  accessory_category: string;
  sort_order: number;
}

export const Route = createFileRoute("/$locale/configurator/$family")({
  component: ConfiguratorPage,
});

function buildOrderCode(
  template: string,
  selections: Record<string, string | string[]>
): string {
  let code = template;
  for (const [key, val] of Object.entries(selections)) {
    const v = Array.isArray(val) ? val.join("-") : val;
    code = code.replace(`{${key}}`, v || "...");
  }
  // Replace any remaining placeholders with ...
  code = code.replace(/\{[^}]+\}/g, "...");
  return code;
}

function ConfiguratorPage() {
  const { locale, family: familySlug } = Route.useParams();
  const t = makeT(locale as Locale);
  const [family, setFamily] = useState<Family | null>(null);
  const [params, setParams] = useState<Param[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [selections, setSelections] = useState<
    Record<string, string | string[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [addedToBom, setAddedToBom] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSelections({});
      setAddedToBom(false);

      const { data: fam } = await supabase
        .from("configurator_families")
        .select("*")
        .eq("slug", familySlug)
        .single();

      if (!fam) {
        setLoading(false);
        return;
      }
      setFamily(fam as unknown as Family);

      const { data: paramRows } = await supabase
        .from("configurator_params")
        .select("*")
        .eq("family_id", fam.id)
        .order("sort_order");

      const paramIds = (paramRows || []).map((p: Record<string, unknown>) => p.id as string);

      const { data: valueRows } = paramIds.length
        ? await supabase
            .from("configurator_param_values")
            .select("*")
            .in("param_id", paramIds)
            .order("sort_order")
        : { data: [] };

      const enriched = (paramRows || []).map(
        (p: Record<string, unknown>) => ({
          ...p,
          values: (valueRows || []).filter(
            (v: Record<string, unknown>) => v.param_id === p.id
          ),
        })
      );
      setParams(enriched as unknown as Param[]);

      const { data: acc } = await supabase
        .from("product_accessories")
        .select("*")
        .eq("family_id", fam.id)
        .order("sort_order");
      setAccessories((acc || []) as unknown as Accessory[]);

      setLoading(false);
    }
    load();
  }, [familySlug]);

  const orderCode = useMemo(() => {
    if (!family) return "";
    return buildOrderCode(
      family.order_code_template || family.name,
      selections
    );
  }, [family, selections]);

  const isComplete = params
    .filter((p) => p.required)
    .every((p) => {
      const val = selections[p.param_key];
      if (val === undefined || val === "") return false;
      return true;
    });

  function select(key: string, value: string, type: string) {
    if (type === "multiselect") {
      setSelections((prev) => {
        const cur = (prev[key] as string[]) || [];
        const next = cur.includes(value)
          ? cur.filter((v) => v !== value)
          : [...cur, value];
        return { ...prev, [key]: next };
      });
    } else {
      setSelections((prev) => ({ ...prev, [key]: value }));
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );

  if (!family)
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg font-medium mb-2">Produktfamilj ej hittad</p>
        <Link
          to={`/${locale}/configure`}
          className="text-blue-600 hover:underline text-sm"
        >
          Tillbaka till alla produkter
        </Link>
      </div>
    );

  const categoryLabels: Record<string, string> = {
    cylinder: "Cylindrar",
    "linear-module": "Linjärmoduler",
    valve: "Ventiler",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to={`/${locale}/configure`} className="hover:text-blue-600">
          Konfigurator
        </Link>
        <span>›</span>
        <span className="text-gray-400">
          {categoryLabels[family.category_slug] || family.category_slug}
        </span>
        <span>›</span>
        <span className="text-gray-900 font-medium">{family.name}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{family.name}</h1>
        <p className="text-gray-600 mt-1 text-lg">{family.title}</p>
        <div className="flex items-center gap-3 mt-3">
          {family.standard && (
            <span className="inline-block px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded font-medium">
              {family.standard}
            </span>
          )}
          {family.stroke_min_mm != null && family.stroke_max_mm != null && (
            <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
              Slag: {family.stroke_min_mm}–{family.stroke_max_mm} mm
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: configuration steps */}
        <div className="lg:col-span-2 space-y-4">
          {params.map((param, idx) => (
            <div
              key={param.id}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <h3 className="font-semibold text-gray-800">{param.label}</h3>
                {!param.required && (
                  <span className="text-xs text-gray-400 ml-auto bg-gray-100 px-2 py-0.5 rounded">
                    Valfritt
                  </span>
                )}
                {selections[param.param_key] && (
                  <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Valt
                  </span>
                )}
              </div>

              {param.param_type === "number" && (
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={family.stroke_min_mm ?? 1}
                    max={family.stroke_max_mm ?? 99999}
                    placeholder={`${family.stroke_min_mm ?? 1}–${family.stroke_max_mm ?? "∞"}`}
                    value={(selections[param.param_key] as string) || ""}
                    onChange={(e) =>
                      setSelections((prev) => ({
                        ...prev,
                        [param.param_key]: e.target.value,
                      }))
                    }
                    className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-500">mm</span>
                  {family.stroke_min_mm != null && (
                    <span className="text-xs text-gray-400">
                      ({family.stroke_min_mm}–{family.stroke_max_mm} mm)
                    </span>
                  )}
                </div>
              )}

              {(param.param_type === "select" ||
                param.param_type === "multiselect") && (
                <div className="flex flex-wrap gap-2">
                  {param.values.map((val) => {
                    const selected =
                      param.param_type === "multiselect"
                        ? (
                            (selections[param.param_key] as string[]) || []
                          ).includes(val.code)
                        : selections[param.param_key] === val.code;
                    return (
                      <button
                        key={val.id}
                        onClick={() =>
                          select(param.param_key, val.code, param.param_type)
                        }
                        title={val.description || val.label}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                          selected
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                        }`}
                      >
                        <span className="block font-semibold">{val.code}</span>
                        <span
                          className={`block text-xs mt-0.5 ${selected ? "text-blue-100" : "text-gray-500"}`}
                        >
                          {val.label
                            .replace(val.code + " ", "")
                            .replace(val.code, "")
                            .trim()
                            .slice(0, 28)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: sticky order code panel */}
        <div className="space-y-4">
          {/* Live order code */}
          <div className="bg-gray-900 text-white rounded-xl p-5 sticky top-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
              Orderkod
            </p>
            <p className="font-mono text-base font-bold break-all leading-tight min-h-[2.5rem]">
              {orderCode || family.name + "-..."}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-2 h-2 rounded-full ${isComplete ? "bg-green-400" : "bg-yellow-400"}`}
                />
                <span className="text-xs text-gray-400">
                  {isComplete ? "Klar att beställa" : "Fyll i alla obligatoriska val"}
                </span>
              </div>
              <button
                disabled={!isComplete}
                onClick={() => setAddedToBom(true)}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isComplete
                    ? addedToBom
                      ? "bg-green-500 text-white cursor-default"
                      : "bg-blue-500 hover:bg-blue-400 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                {addedToBom ? "✓ Tillagd i BOM" : "Lägg till i BOM"}
              </button>
            </div>
          </div>

          {/* Current selections summary */}
          {Object.keys(selections).some((k) => {
            const v = selections[k];
            return v !== "" && !(Array.isArray(v) && v.length === 0);
          }) && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Dina val
              </p>
              <div className="space-y-2">
                {params.map((p) => {
                  const val = selections[p.param_key];
                  if (!val || (Array.isArray(val) && val.length === 0))
                    return null;
                  const display = Array.isArray(val)
                    ? val.join(", ")
                    : val;
                  return (
                    <div key={p.id} className="flex justify-between text-sm gap-2">
                      <span className="text-gray-500 shrink-0">{p.label}</span>
                      <span className="font-medium text-gray-800 text-right">
                        {display}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setSelections({})}
                className="mt-3 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Rensa alla val
              </button>
            </div>
          )}

          {/* Accessories */}
          {accessories.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Tillbehör & tillval
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {accessories.map((acc) => (
                  <div key={acc.id} className="flex items-start gap-2 py-1">
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap flex-shrink-0">
                      {acc.accessory_code}
                    </span>
                    <span className="text-sm text-gray-700 leading-tight">
                      {acc.name
                        .replace(acc.accessory_code + " ", "")
                        .trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$locale/components")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("components.title")} — ${t("common.appName")}` },
        { name: "description", content: t("components.lead") },
      ],
    };
  },
  component: ComponentsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    cat: typeof s.cat === "string" ? s.cat : undefined,
    uc: typeof s.uc === "string" ? s.uc : undefined,
  }),
});

const CATEGORIES = [
  { slug: "pneumatics", en: "Pneumatics", sv: "Pneumatik" },
  { slug: "ea", en: "Electric Automation", sv: "Elektrisk automation" },
  { slug: "sensors", en: "Sensors & IO", sv: "Sensorer & IO" },
  { slug: "valves", en: "Valves", sv: "Ventiler" },
  { slug: "air-prep", en: "Air Prep", sv: "Tryckluftsberedning" },
];

interface UseCase {
  use_case_slug: string;
  title_en: string;
  title_sv: string;
  description_en: string | null;
  description_sv: string | null;
  recommended_skus: string[];
}

interface Family {
  sku: string;
  name: string;
  description: string | null;
  family: string | null;
}

function ComponentsPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const search = Route.useSearch();
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [hasSchema, setHasSchema] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!search.cat) {
      setUseCases([]);
      return;
    }
    supabase
      .from("use_case_map")
      .select("use_case_slug,title_en,title_sv,description_en,description_sv,recommended_skus")
      .eq("category_slug", search.cat)
      .order("sort_order")
      .then(({ data }) => setUseCases((data as UseCase[]) ?? []));
  }, [search.cat]);

  useEffect(() => {
    const uc = useCases.find((u) => u.use_case_slug === search.uc);
    if (!uc || !uc.recommended_skus.length) {
      setFamilies([]);
      return;
    }
    supabase
      .from("products")
      .select("sku,name,description,family")
      .in("sku", uc.recommended_skus)
      .then(({ data }) => setFamilies((data as Family[]) ?? []));
    supabase
      .from("config_schemas")
      .select("schema_id,category_slug")
      .then(({ data }) => {
        const cats = new Set((data ?? []).map((r) => r.category_slug as string));
        setHasSchema(cats);
      });
  }, [search.uc, useCases]);

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("components.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{t("components.lead")}</p>

      {/* Categories */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            to="/$locale/components"
            params={{ locale }}
            search={{ cat: c.slug, uc: undefined }}
            className={`rounded-lg border p-4 text-sm transition ${
              search.cat === c.slug
                ? "border-foreground bg-foreground/5"
                : "border-border bg-card hover:bg-accent"
            }`}
          >
            <div className="font-medium">{locale === "sv" ? c.sv : c.en}</div>
          </Link>
        ))}
      </div>

      {/* Use cases */}
      {search.cat && useCases.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">{t("components.chooseUseCase")}</h2>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {useCases.map((u) => (
              <Link
                key={u.use_case_slug}
                to="/$locale/components"
                params={{ locale }}
                search={{ cat: search.cat, uc: u.use_case_slug }}
                className={`rounded-lg border p-4 text-left transition ${
                  search.uc === u.use_case_slug
                    ? "border-gold bg-gold/10"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                <div className="font-medium text-sm">{locale === "sv" ? u.title_sv : u.title_en}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {locale === "sv" ? u.description_sv : u.description_en}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recommended families */}
      {search.uc && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">{t("components.recommended")}</h2>
          {families.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("components.noResults")}</p>
          ) : (
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {families.map((f) => (
                <article key={f.sku} className="rounded-xl border border-border bg-card p-5 flex flex-col">
                  <div className="font-mono text-xs text-muted-foreground">{f.sku}</div>
                  <h3 className="mt-1 font-semibold">{f.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground flex-1">
                    {f.description ?? (locale === "sv" ? "Komponentfamilj." : "Component family.")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {hasSchema.has(search.cat ?? "") && (
                      <Link
                        to="/$locale/configurator/schema/$schemaId"
                        params={{ locale, schemaId: "EA-LINEAR-AXIS" }}
                        className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background"
                      >
                        {t("common.configure")}
                      </Link>
                    )}
                    <Link
                      to="/$locale/product/$sku"
                      params={{ locale, sku: f.sku }}
                      className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
                    >
                      {t("common.open")}
                    </Link>
                    <Link
                      to="/$locale/talk"
                      params={{ locale }}
                      className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
                    >
                      {t("common.requestCustom")}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, translate, type Locale, type TKey } from "@/lib/i18n";
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

/**
 * Kategorierna hämtas ur databasen, inte ur en lista här.
 *
 * Listan som stod här hade sluggarna pneumatics/ea/sensors/valves/air-prep.
 * use_case_map har cylinder/gripper/valve/vacuum/electric-actuator/
 * linear-module. INTE EN ENDA matchade, så varje kategoriklick frågade efter
 * rader som inte finns och sidan visade ingenting alls -- för alla fem
 * kategorierna, på alla fyra språken. Samma sorts fel som resten av det här
 * arbetet handlat om: en handskriven lista bredvid en databas som säger annat.
 *
 * Bara kategorier som FAKTISKT har användningsfall visas. En kategori utan
 * dem leder till en tom sida, vilket är precis buggen ovan.
 */
interface Category {
  slug: string;
  name: string;
  useCases: number;
}

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
  const [hasSchema, setHasSchema] = useState<Map<string, string>>(new Map());
  const [categories, setCategories] = useState<Category[]>([]);
  /** Familjer som har en EGEN konfigurator, slug i gemener. */
  const [familyConfigs, setFamilyConfigs] = useState<Set<string>>(new Set());

  /**
   * Kategorinamnet på kundens språk. Nycklarna är dynamiska (slug ur
   * databasen) och kan därför inte typas som TKey, så translate() får svara
   * med nyckeln när den saknas -- då används databasens eget namn i stället.
   */
  const categoryLabel = (slug: string, fallback: string) => {
    const key = `components.categories.${slug}` as TKey;
    const s = translate(locale as Locale, key);
    return s === key ? fallback : s;
  };

  // Kategorier som faktiskt bär användningsfall, plus familjerna som har en
  // egen konfigurator. Båda är oberoende av vald kategori, så de hämtas en gång.
  useEffect(() => {
    (async () => {
      const [{ data: uc }, { data: cats }, { data: fams }] = await Promise.all([
        supabase.from("use_case_map").select("category_slug"),
        supabase.from("categories").select("slug,name"),
        supabase.from("configurator_families").select("slug"),
      ]);
      const antal = new Map<string, number>();
      for (const r of uc ?? []) {
        const c = (r as { category_slug: string | null }).category_slug;
        if (c) antal.set(c, (antal.get(c) ?? 0) + 1);
      }
      const namn = new Map((cats ?? []).map((c) => [(c as { slug: string }).slug, (c as { name: string }).name]));
      setCategories(
        [...antal.entries()]
          .map(([slug, useCases]) => ({ slug, name: namn.get(slug) ?? slug, useCases }))
          .sort((a, b) => b.useCases - a.useCases || a.slug.localeCompare(b.slug)),
      );
      setFamilyConfigs(new Set((fams ?? []).map((f) => (f as { slug: string }).slug.toLowerCase())));
    })();
  }, []);

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
        // Kategori -> schema. Knappen länkade tidigare hårdkodat till
        // "EA-LINEAR-AXIS", ett schema som inte finns i config_schemas, så
        // den ledde till en tom konfigurator oavsett kategori.
        const m = new Map<string, string>();
        for (const r of data ?? []) {
          const cat = r.category_slug as string | null;
          if (cat && !m.has(cat)) m.set(cat, r.schema_id as string);
        }
        setHasSchema(m);
      });
  }, [search.uc, useCases]);

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("components.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{t("components.lead")}</p>

      {/* Categories */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {categories.map((c) => (
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
            <div className="font-medium">{categoryLabel(c.slug, c.name)}</div>
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
                    {/*
                      Familjens EGEN konfigurator först. Uppslaget nedan gick
                      tidigare på kategori -> schema med "första raden vinner"
                      och utan sortering, och kategorin cylinder har fyra
                      scheman -- en DNC kunde alltså landa i DSBC:s eller P1D:s
                      konfigurator och ge ett artikelnummer för fel familj.
                      Alla 156 familjer har en egen rad med orderkodsmall;
                      kategorischemat är bara reserv för dem som saknar den.
                    */}
                    {f.family && familyConfigs.has(f.family.toLowerCase()) ? (
                      <Link
                        to="/$locale/configurator/$family"
                        params={{ locale, family: f.family.toLowerCase() }}
                        className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background"
                      >
                        {t("common.configure")}
                      </Link>
                    ) : hasSchema.get(search.cat ?? "") ? (
                      <Link
                        to="/$locale/configurator/schema/$schemaId"
                        params={{ locale, schemaId: hasSchema.get(search.cat ?? "")! }}
                        className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background"
                      >
                        {t("common.configure")}
                      </Link>
                    ) : null}
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

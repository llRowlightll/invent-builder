import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SITE, hreflangLinks } from "@/lib/site";

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

type Sprak = "sv" | "en" | "de" | "es";
const sprak = (locale: string): Sprak => (["sv", "en", "de", "es"].includes(locale) ? locale : "en") as Sprak;

/**
 * Sidans texter på fyra språk. Kritikerrundan 2026-11-18: sidan var svensk på
 * alla språk, hade engelsk standardtitel och ingen beskrivning, och servern
 * skickade bara en laddningssnurra -- för Google var den tom.
 */
const TEXT: Record<Sprak, {
  titel: string; beskrivning: (n: number) => string; h1: string; intro: string;
  alla: string; slag: string; konfigurera: string; tomt: string;
}> = {
  sv: {
    titel: "Produktkonfigurator — cylindrar, ventiler och gripdon",
    beskrivning: (n) => `Konfigurera ${n} produktfamiljer steg för steg: välj mått och tillval och få artikelnumret direkt. Pris och leveranstid får du i offerten inom 1–2 arbetsdagar.`,
    h1: "Produktkonfigurator",
    intro: "Välj en produktfamilj och konfigurera din artikel steg för steg — få din orderkod direkt.",
    alla: "Alla", slag: "Slag", konfigurera: "Konfigurera", tomt: "Inga produktfamiljer hittades",
  },
  en: {
    titel: "Product configurator — cylinders, valves and grippers",
    beskrivning: (n) => `Configure ${n} product families step by step: choose dimensions and options and get the part number instantly. Price and lead time come in the quote within 1–2 business days.`,
    h1: "Product configurator",
    intro: "Choose a product family and configure your item step by step — get your order code instantly.",
    alla: "All", slag: "Stroke", konfigurera: "Configure", tomt: "No product families found",
  },
  de: {
    titel: "Produktkonfigurator — Zylinder, Ventile und Greifer",
    beskrivning: (n) => `${n} Produktfamilien Schritt für Schritt konfigurieren: Abmessungen und Optionen wählen und sofort die Bestellnummer erhalten. Preis und Lieferzeit erhalten Sie im Angebot innerhalb von 1–2 Werktagen.`,
    h1: "Produktkonfigurator",
    intro: "Wählen Sie eine Produktfamilie und konfigurieren Sie Ihren Artikel Schritt für Schritt — die Bestellnummer erhalten Sie sofort.",
    alla: "Alle", slag: "Hub", konfigurera: "Konfigurieren", tomt: "Keine Produktfamilien gefunden",
  },
  es: {
    titel: "Configurador de productos — cilindros, válvulas y pinzas",
    beskrivning: (n) => `Configure ${n} familias de productos paso a paso: elija dimensiones y opciones y obtenga la referencia al instante. El precio y el plazo de entrega llegan en la oferta en 1–2 días hábiles.`,
    h1: "Configurador de productos",
    intro: "Elija una familia de productos y configure su artículo paso a paso — obtenga su código de pedido al instante.",
    alla: "Todos", slag: "Carrera", konfigurera: "Configurar", tomt: "No se encontraron familias de productos",
  },
};

export const Route = createFileRoute("/$locale/configure")({
  // Familjerna hämtas på servern, så att listan finns i HTML:en.
  loader: async (): Promise<{ families: Family[] }> => {
    const { data } = await supabase
      .from("configurator_families")
      .select("id,slug,name,title,category_slug,standard,stroke_min_mm,stroke_max_mm")
      .order("category_slug");
    return { families: (data ?? []) as unknown as Family[] };
  },
  head: ({ params, loaderData }) => {
    const tx = TEXT[sprak(params.locale)];
    const n = (loaderData as { families: Family[] } | undefined)?.families.length ?? 0;
    const canonical = `${SITE}/${params.locale}/configure`;
    const desc = tx.beskrivning(n);
    return {
      meta: [
        { title: `${tx.titel} | Maskinval` },
        { name: "description", content: desc },
        { property: "og:title", content: `${tx.titel} | Maskinval` },
        { property: "og:description", content: desc },
        { property: "og:url", content: canonical },
      ],
      links: [{ rel: "canonical", href: canonical }, ...hreflangLinks("configure")],
    };
  },
  component: ConfigureIndexPage,
});

const CATEGORY_META: Record<string, { label: Record<Sprak, string>; icon: string; color: string }> = {
  cylinder: {
    label: { sv: "Cylindrar", en: "Cylinders", de: "Zylinder", es: "Cilindros" },
    icon: "⚙️",
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  "linear-module": {
    label: { sv: "Linjärmoduler", en: "Linear modules", de: "Linearmodule", es: "Módulos lineales" },
    icon: "↔️",
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  valve: {
    label: { sv: "Ventiler", en: "Valves", de: "Ventile", es: "Válvulas" },
    icon: "🔧",
    color: "bg-green-50 border-green-200 text-green-800",
  },
  "valve-terminal": {
    label: { sv: "Ventilterminaler", en: "Valve terminals", de: "Ventilinseln", es: "Terminales de válvulas" },
    icon: "▦",
    color: "bg-green-50 border-green-200 text-green-800",
  },
  "electric-actuator": {
    label: { sv: "Elektriska ställdon", en: "Electric actuators", de: "Elektrische Antriebe", es: "Actuadores eléctricos" },
    icon: "⚡",
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  gripper: {
    label: { sv: "Gripdon", en: "Grippers", de: "Greifer", es: "Pinzas" },
    icon: "🤏",
    color: "bg-teal-50 border-teal-200 text-teal-800",
  },
  "rotary-actuator": {
    label: { sv: "Vridenheter", en: "Rotary actuators", de: "Schwenkantriebe", es: "Actuadores giratorios" },
    icon: "🔄",
    color: "bg-teal-50 border-teal-200 text-teal-800",
  },
  vacuum: {
    label: { sv: "Vakuum", en: "Vacuum", de: "Vakuum", es: "Vacío" },
    icon: "🌀",
    color: "bg-cyan-50 border-cyan-200 text-cyan-800",
  },
  "shock-absorber": {
    label: { sv: "Stötdämpare", en: "Shock absorbers", de: "Stoßdämpfer", es: "Amortiguadores" },
    icon: "🛡️",
    color: "bg-orange-50 border-orange-200 text-orange-800",
  },
  // Saknades: familjen Parker FRL visades under det råa namnet "air-preparation".
  "air-preparation": {
    label: { sv: "Luftberedning", en: "Air preparation", de: "Druckluftaufbereitung", es: "Tratamiento de aire" },
    icon: "≋",
    color: "bg-muted border-border text-foreground",
  },
  fitting: {
    label: { sv: "Kopplingar", en: "Fittings", de: "Steckverbindungen", es: "Racores" },
    icon: "⊕",
    color: "bg-muted border-border text-foreground",
  },
};

function ConfigureIndexPage() {
  const { locale } = Route.useParams();
  const sp = sprak(locale);
  const tx = TEXT[sp];
  const { families } = Route.useLoaderData();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const etikett = (cat: string) => CATEGORY_META[cat]?.label[sp] ?? cat;

  const categories = Array.from(
    new Set(families.map((f) => f.category_slug))
  );

  const filtered = activeCategory
    ? families.filter((f) => f.category_slug === activeCategory)
    : families;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {tx.h1}
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          {tx.intro}
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
            activeCategory === null
              ? "bg-foreground/85 text-white border-foreground/30"
              : "bg-white text-muted-foreground border-border hover:border-border"
          }`}
        >
          {tx.alla} ({families.length})
        </button>
        {categories.map((cat) => {
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
                  : "bg-white text-muted-foreground border-border hover:border-blue-400"
              }`}
            >
              {etikett(cat)} ({count})
            </button>
          );
        })}
      </div>

      {/* Families grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((family) => {
          const meta = CATEGORY_META[family.category_slug] || {
            icon: "📦",
            color: "bg-muted border-border text-foreground",
          };
          return (
            <div
              key={family.id}
              className="bg-white border border-border rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              {/* Category badge */}
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded border mb-3 ${meta.color}`}
              >
                {etikett(family.category_slug)}
              </span>

              {/* Family name & title */}
              <h2 className="text-xl font-bold text-foreground group-hover:text-blue-700 transition-colors">
                {family.name}
              </h2>
              <p className="text-muted-foreground text-sm mt-1 leading-snug">
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
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                      {tx.slag}: {family.stroke_min_mm}–{family.stroke_max_mm} mm
                    </span>
                  )}
              </div>

              {/* CTA */}
              <Link
                to={"/$locale/configurator/$family" as never}
                params={{ locale, family: family.slug } as never}
                className="mt-4 flex items-center justify-between w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <span>{tx.konfigurera}</span>
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
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">{tx.tomt}</p>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog } from "@/lib/catalog";
import { produktnamn } from "@/lib/spec-format";
import type { ProductRow } from "@/lib/types";
import { getProductImage, getCategoryImage } from "@/lib/product-images";
import { SITE, hreflangLinks } from "@/lib/site";
import { EditableText } from "@/components/EditableText";
import { categoryName } from "@/lib/categories";
import { ArrowRight, ChevronDown, Cpu, FileText, RefreshCw, Settings, Sparkles, Users } from "lucide-react";
import { Flodesbild } from "@/components/startsida/Flodesbild";
import { harLogga } from "@/lib/brand-logos";

export const Route = createFileRoute("/$locale/")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    const locale = params.locale;
    const canonical = `${SITE}/${locale}`;
    return {
      meta: [
        { title: `${t("common.appName")} — ${t("index.metaTitleSuffix")}` },
        { name: "description", content: t("index.metaDescription") },
        { property: "og:title", content: `${t("common.appName")} — ${t("index.ogTitleSuffix")}` },
        { property: "og:description", content: t("index.ogDescription") },
        { property: "og:url", content: canonical },
      ],
      links: [
        { rel: "canonical", href: canonical },
        ...hreflangLinks(),
      ],
    };
  },
  // Fetch the live counts on the server so the SSR HTML already has the real
  // numbers — no more "91+" flashing before a client query corrects it.
  loader: async () => {
    try {
      // Produkträkningen är borta. Den hämtade 5000 rader vid VARJE
      // serverrendering av startsidan, och fanns bara för siffran "846+" i
      // statistikraden -- som nu är ersatt av tre vägar in.
      //
      // Antalet artiklar i hjältetexten räknas här, men utan att hämta rader:
      // head + count kostar ett enda tal. Det stod hårdkodat "846" och blev
      // fel så fort en artikel avregistrerades.
      const [br, ct, ant] = await Promise.all([
        supabase.from("brands").select("slug,name").order("name"),
        supabase.from("categories").select("slug,name").order("name"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return { brands: (br.data ?? []) as Brand[], cats: (ct.data ?? []) as Cat[], antal: ant.count ?? null };
    } catch {
      return { brands: [] as Brand[], cats: [] as Cat[], antal: null };
    }
  },
  component: Landing,
});

type Cat = { slug: string; name: string };
type Brand = { slug: string; name: string };

/** "{antal} artiklar" med det levande talet, eller utan ledet om det inte gick att räkna. */
function antalText(mall: string, antal: number | null): string {
  if (antal != null) return mall.replace("{antal}", antal.toLocaleString("sv-SE"));
  return mall.replace(/[^,.]*\{antal\}[^,.]*[,.]\s*/, "");
}

function Landing() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();
  const ld = Route.useLoaderData();
  const [cats, setCats] = useState<Cat[]>(ld.cats);
  const [brands, setBrands] = useState<Brand[]>(ld.brands);
  const [q, setQ] = useState("");
  const [featured, setFeatured] = useState<ProductRow[]>([]);
  const [totalBrands, setTotalBrands] = useState(ld.brands.length || 5);

  useEffect(() => {
    supabase.from("categories").select("slug,name").order("name").then(({ data }) => setCats(data ?? []));
    supabase.from("brands").select("slug,name").order("name").then(({ data }) => {
      setBrands(data ?? []);
      if (data && data.length > 0) setTotalBrands(data.length);
    });

    loadCatalog().then((catalog) => {
      const picks = ["FESTO-DSBC", "SMC-CQ2", "PARKER-P1D", "FESTO-HGPP"];
      const found = picks
        .map((sku) => catalog.find((p) => p.sku === sku))
        .filter(Boolean) as ProductRow[];
      setFeatured(found.length >= 2 ? found : catalog.slice(0, 4));
    });
  }, []);

  /**
   * Ser texten ut som ett artikelnummer? "DSBC-50-100-PPSA-N3", "CQ2B40-50DZ",
   * "P1D-S045MS". Versaler och siffror blandade, ofta med bindestreck.
   */
  function serUtSomArtikelnummer(text: string): boolean {
    return text.split(/\s+/).some(ord =>
      ord.length >= 3 && /\d/.test(ord) && /[A-Za-z]/.test(ord) && /^[A-Za-z0-9/\-.]+$/.test(ord)
    );
  }

  /**
   * Vart texten i uppdragsfältet leder. Ett artikelnummer eller ett par ord är
   * en katalogsökning; en beskrivning är ett uppdrag till maskinbyggaren.
   *
   * Den som redan vet vad hen vill ha ska inte hamna i en modellväg som dör
   * när dygnskvoten tar slut: /products?q= är ren nyckelordsfiltrering utan
   * modellanrop. En lång mening med en orderkod i går däremot till
   * maskinbyggaren, som läser orderkoder själv (readOrderCodes).
   */
  function avsikt(text: string): "katalog" | "maskin" | null {
    const ord = text.trim().split(/\s+/).filter(Boolean);
    if (ord.length === 0) return null;
    if (ord.length <= 2 || (ord.length <= 4 && serUtSomArtikelnummer(text))) return "katalog";
    return "maskin";
  }

  function starta(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    const vart = avsikt(text);
    if (!vart) return;
    if (vart === "katalog") {
      navigate({ to: "/$locale/products", params: { locale }, search: { q: text } as never });
      return;
    }
    // Maskinbyggaren läser texten en gång och startar analysen (se
    // machine-builder.tsx, "mv_starta"); en bakåtnavigering startar den inte igen.
    try { sessionStorage.setItem("mv_starta", text); } catch { /* blockerad lagring: fältet fylls inte i */ }
    navigate({ to: "/$locale/machine-builder", params: { locale } });
  }

  const exempel = EXEMPEL[locale as "sv" | "en"] ?? EXEMPEL.en;
  const vart = avsikt(q);

  return (
    <div>
      {/* ── Huvudyta: uppdraget ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-surface-alt/70 to-background">
        <div className="container-page grid gap-10 py-12 md:py-16 lg:grid-cols-12 lg:gap-12 lg:py-20">
          <div className="lg:col-span-7">
            <h1 className="text-[2.25rem] leading-[1.08] font-semibold tracking-tight text-primary sm:text-5xl rorelse-in">
              <EditableText contentKey="index.heroUppdrag" locale={locale} fallback={t("index.heroUppdrag")} />
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg rorelse-in rorelse-steg-1">
              <EditableText contentKey="index.heroVarde" locale={locale} fallback={t("index.heroVarde")} multiline />
            </p>

            <form onSubmit={starta} className="arbetsyta mt-8 rounded-2xl p-2 shadow-lg rorelse-in rorelse-steg-2">
              <label htmlFor="uppdrag" className="sr-only">{t("index.uppdragEtikett")}</label>
              <textarea
                id="uppdrag"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) starta(e); }}
                rows={3}
                placeholder={t("index.uppdragPlaceholder")}
                className="block w-full resize-none rounded-xl bg-transparent px-4 pt-3 pb-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
              />
              <div className="flex flex-col gap-3 border-t border-line px-3 pt-3 pb-1.5 sm:flex-row sm:items-center">
                <p className="flex-1 text-xs text-muted-foreground" aria-live="polite">
                  {vart === "katalog" ? t("index.serUtSomArtikel") : t("index.uppdragTips")}
                </p>
                <button
                  type="submit"
                  disabled={!vart}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cta px-5 text-[15px] font-semibold text-cta-foreground shadow-xs transition-[background-color,transform] hover:bg-cta-hover active:translate-y-px disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                >
                  {vart === "katalog" ? t("index.sokKatalog") : t("index.starta")}
                  <ArrowRight aria-hidden className="size-4" />
                </button>
              </div>
            </form>

            <div className="mt-4 rorelse-in rorelse-steg-3">
              <p className="text-xs font-medium text-muted-foreground">{t("index.exempelRubrik")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {exempel.map((x) => (
                  <button
                    key={x.kort}
                    type="button"
                    onClick={() => { setQ(x.text); document.getElementById("uppdrag")?.focus(); }}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground/85 shadow-xs transition-colors hover:border-cta/40 hover:text-foreground"
                  >
                    {x.kort}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 lg:pt-2">
            <Flodesbild locale={locale} />
          </div>

        <nav aria-label={t("index.alternativRubrik")} className="border-t border-line pt-5 lg:col-span-12 rorelse-in rorelse-steg-3">
            <p className="text-xs font-medium text-muted-foreground">{t("index.alternativRubrik")}</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-3">
              {ALTERNATIV.map(({ to, titel, brod, Ikon }) => (
                <li key={to}>
                  <Link to={to} params={{ locale }}
                    className="group flex h-full items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface hover:shadow-xs">
                    <Ikon aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.75} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground group-hover:text-info">{t(titel)}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t(brod)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {/* ── Utvalda komponenter ─────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="container-page py-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-primary">{t("index.featuredTitle")}</h2>
            <Link to="/$locale/products" params={{ locale }} className="shrink-0 text-sm font-medium text-info hover:underline">
              {t("index.featuredAll")}
            </Link>
          </div>
          <div className={`mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${featured.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {featured.map((p) => (
              <Link
                key={p.id}
                to="/$locale/product/$sku"
                params={{ locale, sku: p.sku }}
                className="kort group flex flex-col overflow-hidden transition-[box-shadow,transform] hover:shadow-md md:hover:-translate-y-0.5"
              >
                <div className="flex h-28 items-center justify-center bg-[#f8f9fb] px-6">
                  <img src={getProductImage(p)} alt="" className="h-full w-full object-contain" loading="lazy" />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <span className="text-[11px] font-medium text-gold-deep">{p.brand.name}</span>
                  <span className="mt-1 line-clamp-2 font-medium text-foreground group-hover:text-info">{produktnamn(p, locale)}</span>
                  <span className="mt-1 text-xs text-muted-foreground">{categoryName(p.category.slug, locale, p.category.name)}</span>
                  <span className="mt-auto pt-3 text-xs text-muted-foreground">
                    {/* En uppskattning, inte ett lagerbesked (inget lagerförs). */}
                    {p.lead_time_days != null
                      ? t("index.leadEst").replace("{d}", String(p.lead_time_days))
                      : t("index.leadAsk")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Kategorier: kompakt, en rad per familj ──────────────────────── */}
      <section className="border-y border-line bg-surface-alt/60">
        <div className="container-page py-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-primary">{t("index.categoriesTitle")}</h2>
            <Link to="/$locale/products" params={{ locale }} className="shrink-0 text-sm font-medium text-info hover:underline">
              {t("index.allProducts")}
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {cats.map((c) => (
              <li key={c.slug}>
                <Link
                  to="/$locale/products"
                  params={{ locale }}
                  search={{ category: c.slug }}
                  className="group flex items-center gap-3 rounded-lg border border-transparent bg-surface px-3 py-2 shadow-xs transition-colors hover:border-cta/30"
                >
                  <span className="flex h-10 w-14 shrink-0 items-center justify-center">
                    <img src={getCategoryImage(c.slug)} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                  </span>
                  <span className="min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-info">
                    {categoryName(c.slug, locale, c.name)}
                  </span>
                  <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-info" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Fabrikaten: bara märkena ────────────────────────────────────── */}
      <section className="container-page py-12">
        <h2 className="text-center text-sm font-medium text-muted-foreground">
          {totalBrands} {t("index.brandsWorking")}
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {brands.map((b) => (
            <li key={b.slug}>
              <Link
                to="/$locale/products"
                params={{ locale }}
                search={{ brand: b.slug }}
                title={`${b.name}: ${t("index.viewProducts").replace(/\s*→\s*$/, "")}`}
                className="flex h-16 items-center justify-center rounded-lg px-3 opacity-80 grayscale transition hover:bg-surface hover:opacity-100 hover:shadow-xs hover:grayscale-0"
              >
                <BrandLogo slug={b.slug} name={b.name} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Människa och maskin ─────────────────────────────────────────── */}
      <section className="border-t border-line bg-surface">
        <div className="container-page grid gap-8 py-14 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-primary">{t("index.manniskaRubrik")}</h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">{t("index.manniskaText")}</p>
            <Link
              to="/$locale/advisor"
              params={{ locale }}
              search={{ q: undefined }}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-5 text-[15px] font-medium text-foreground shadow-xs transition-colors hover:border-cta/40"
            >
              {t("index.talkToEngineer")}
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {[
              { Ikon: Sparkles, titel: t("index.how1Title"), text: t("index.how1Body") },
              { Ikon: Users, titel: t("index.how2Title"), text: t("index.how2Body") },
              { Ikon: FileText, titel: t("index.how3Title"), text: t("index.how3Body") },
            ].map(({ Ikon, titel, text }) => (
              <li key={titel} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <Ikon aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.75} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{titel}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ: SEO-text och JSON-LD ───────────────────────────────────── */}
      <FaqSection locale={locale} />
    </div>
  );
}

/** Exempeluppdrag: korta etiketter, hela meningar i fältet. */
const EXEMPEL: Record<"sv" | "en", Array<{ kort: string; text: string }>> = {
  sv: [
    { kort: "Sortera ut lådor från ett band", text: "Vi vill sortera ut plastlådor på 0,5–3 kg från ett transportband. Upp till 15 lådor per minut ska skjutas 350 mm i sidled till ett rullbord. 6 bar tryckluft, 24 V DC." },
    { kort: "Lyfta 15 kg vertikalt", text: "Lyfta en plåtdel på 15 kg vertikalt 200 mm i en pressstation. Lasten får inte falla om tryckluften försvinner. 6 bar." },
    { kort: "Klämma vid svetsning", text: "Klämma fast en detalj under svetsning med en horisontell rörelse på 80 mm. Svetsstänk förekommer, 6 bar tryckluft." },
    { kort: "Plocka kartonger med vakuum", text: "Plocka kartonger på 2 kg från ett magasin med vakuumgrepp och flytta dem 300 mm till ett transportband." },
  ],
  en: [
    { kort: "Reject boxes from a conveyor", text: "We want to reject plastic boxes of 0.5–3 kg from a conveyor. Up to 15 boxes a minute are pushed 350 mm sideways onto a roller table. 6 bar compressed air, 24 V DC." },
    { kort: "Lift 15 kg vertically", text: "Lift a 15 kg sheet-metal part vertically 200 mm in a press station. The load must not drop if the air supply fails. 6 bar." },
    { kort: "Clamp during welding", text: "Clamp a part during welding with a horizontal stroke of 80 mm. Weld spatter is present, 6 bar compressed air." },
    { kort: "Pick cartons with vacuum", text: "Pick 2 kg cartons from a magazine with a vacuum gripper and move them 300 mm onto a conveyor." },
  ],
};

/** Andra vägar in: ersätta en komponent, styrning och konfiguration. */
const ALTERNATIV = [
  { to: "/$locale/replace", titel: "index.routeReplaceTitle", brod: "index.altErsattText", Ikon: RefreshCw },
  { to: "/$locale/plc", titel: "nav.plc", brod: "index.altPlcText", Ikon: Cpu },
  { to: "/$locale/configure", titel: "index.routeConfigTitle", brod: "index.altKonfigText", Ikon: Settings },
] as const;

const FAQ_SV = [
  {
    q: "Vad är en pneumatisk cylinder?",
    a: "En pneumatisk cylinder är ett linjärt aktuatorelement som omvandlar komprimerad luft till mekanisk rörelse. Den används i industriell automation för att lyfta, skjuta, klämma eller positionera detaljer. Vanliga standarder är ISO 15552 (profilcylinder) och ISO 6432 (rundcylinder).",
  },
  {
    q: "Hur väljer man rätt pneumatisk cylinder?",
    a: "Välj cylinder baserat på fyra parametrar: (1) Kraft — beräkna F = P × A (tryck × kolvarea). Vid 6 bar och 50 mm borr ger det 1 178 N. (2) Slaglängd — avståndet rörelsen ska täcka. (3) Montering — ISO 15552 för standardmontage, ISO 6432 för trång plats. (4) Miljö — IP65 för dammiga miljöer, ATEX för explosionsfarliga zoner. Maskinvals AI-rådgivare hjälper dig välja automatiskt.",
  },
  {
    q: "Vad är skillnaden mellan pneumatisk och elektrisk aktuator?",
    a: "Pneumatiska cylindrar är enkla, robusta och billiga — men saknar positionskontroll (bara två lägen: in/ut). Elektriska aktuatorer (servo/stepper) kan stanna exakt var som helst på slaglängden med ±0,01 mm noggrannhet. Elektriska passar vid precision ≤0,1 mm, variabla positioner eller när tryckluftsinstallation saknas.",
  },
  {
    q: "Vilka märken erbjuder Maskinval?",
    a: "Maskinval erbjuder komponenter från åtta fabrikat: Festo, SMC, Parker, AVENTICS, Bosch Rexroth, Norgren, Metal Work och Camozzi. Alla i en gemensam katalog där specifikationerna kan jämföras sida vid sida.",
  },
  {
    q: "Vad är ISO 15552?",
    a: "ISO 15552 (tidigare ISO 6431) är den internationella standarden för profilcylindrar. Standarden definierar montagemått, gängdimensioner och kolvdiametrar (32–320 mm) så att cylindrar från olika tillverkare är utbytbara. Parker P1D, Festo DSBC, AVENTICS PRA (tidigare Bosch Rexroth) och Camozzi Serie 63 är alla ISO 15552-cylindrar.",
  },
  {
    q: "Hur snabbt levereras komponenter?",
    a: "Leveranstiden beror på fabrikat och utförande. Katalogen visar en uppskattning per artikel; bekräftad leveranstid och pris får du i offerten, inom 1–2 arbetsdagar.",
  },
];

const FAQ_EN = [
  {
    q: "What is a pneumatic cylinder?",
    a: "A pneumatic cylinder is a linear actuator that converts compressed air into mechanical motion. Used in industrial automation to lift, push, clamp, or position parts. Common standards are ISO 15552 (profile cylinder) and ISO 6432 (round cylinder).",
  },
  {
    q: "How do I select the right pneumatic cylinder?",
    a: "Choose based on four parameters: (1) Force — F = P × A (pressure × piston area). At 6 bar and 50 mm bore this gives 1,178 N. (2) Stroke — the travel distance required. (3) Mounting — ISO 15552 for standard mounts, ISO 6432 for tight spaces. (4) Environment — IP65 for dusty environments, ATEX for explosive atmospheres. The Maskinval AI advisor selects automatically.",
  },
  {
    q: "What is the difference between pneumatic and electric actuators?",
    a: "Pneumatic cylinders are simple, robust, and low-cost — but offer only two positions (extend/retract). Electric actuators (servo/stepper) can stop at any point with ±0.01 mm accuracy. Choose electric when precision ≤0.1 mm, variable positioning, or when compressed air infrastructure is unavailable.",
  },
  {
    q: "Which brands does Maskinval offer?",
    a: "Maskinval offers components from eight brands: Festo, SMC, Parker, AVENTICS, Bosch Rexroth, Norgren, Metal Work and Camozzi, in one catalogue where specifications can be compared side by side.",
  },
];

function FaqSection({ locale }: { locale: string }) {
  const isSv = locale === "sv";
  const faqs = isSv ? FAQ_SV : FAQ_EN;
  const heading = isSv ? "Vanliga frågor om pneumatik och automation" : "Common questions on pneumatics and automation";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  // Svaren ligger i <details>: hopfällda för läsaren, men i HTML:en för
  // sökmotorn, och samma text som JSON-LD-schemat.
  return (
    <section className="container-page max-w-3xl py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h2 className="text-2xl font-semibold tracking-tight text-primary">{heading}</h2>
      <div className="kort mt-6 divide-y divide-line">
        {faqs.map((f) => (
          <details key={f.q} className="group px-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
              {f.q}
              <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// Fabrikat utan loggofil (AVENTICS) visas som ordmärke, en gång.
function BrandLogo({ slug, name }: { slug: string; name: string }) {
  return harLogga(slug) ? (
    <img src={`/brands/${slug}.svg`} alt={name} className="max-h-9 max-w-[7.5rem] object-contain" loading="lazy" />
  ) : (
    <span className="select-none text-[15px] font-bold tracking-tight text-foreground">{name}</span>
  );
}

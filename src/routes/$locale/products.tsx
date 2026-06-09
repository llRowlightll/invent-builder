import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { aiSearchProducts, type AiSearchResult } from "@/lib/ai.functions";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";
import { addToShoppingList } from "@/lib/cart";
import { SITE, hreflangLinks } from "@/lib/site";
import { categoryName } from "@/lib/categories";

type FilterKey = "brands" | "cats" | "grades";

export const Route = createFileRoute("/$locale/products")({
  validateSearch: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    ai: z.string().optional(),
  }),
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    const locale = params.locale;
    const canonical = `${SITE}/${locale}/products`;
    return {
      meta: [
        { title: `Produktkatalog — Pneumatik & automation | ${t("common.appName")}` },
        { name: "description", content: "Komplett katalog: pneumatiska cylindrar, elektriska aktuatorer, ventiler, grippers, vakuumsystem och mer. Festo, SMC, Parker, Bosch Rexroth, Norgren, Camozzi. Filtrera, jämför och beställ." },
        { property: "og:title", content: `Produktkatalog — ${t("common.appName")}` },
        { property: "og:url", content: canonical },
      ],
      links: [
        { rel: "canonical", href: canonical },
        ...hreflangLinks("products"),
      ],
    };
  },
  component: ProductsPage,
});

// SEO: category descriptions shown when a category filter is active
const CATEGORY_SEO: Record<string, { sv: string; en: string }> = {
  cylinder: {
    sv: "Pneumatiska cylindrar för industriell automation — ISO 15552 profilcylindrar, ISO 6432 rundcylindrar, kolvstångslösa cylindrar och guidade cylindrar. Välj efter slaglängd (50–1000 mm), borr (16–320 mm) och miljöklass. Märken: Festo, SMC, Parker, Bosch Rexroth, Norgren, Metal Work, Camozzi.",
    en: "Pneumatic cylinders for industrial automation — ISO 15552 profile cylinders, ISO 6432 round cylinders, rodless and guided cylinders. Select by stroke (50–1000 mm), bore (16–320 mm) and environment rating. Brands: Festo, SMC, Parker, Bosch Rexroth, Norgren, Metal Work, Camozzi.",
  },
  "electric-actuator": {
    sv: "Elektriska aktuatorer och servo-axlar för precision och positionskontroll. Kulskruvsaxlar (noggrannhet ±0,01 mm), kuggremsdrivna axlar (hastighet upp till 3 m/s), elektrocylindrar som ersätter pneumatik. Märken: Festo EGSK/ELGA, SMC LEY/LESH, Parker ETH, Camozzi 6E.",
    en: "Electric actuators and servo axes for precision positioning. Ball-screw axes (±0.01 mm accuracy), belt-driven axes (up to 3 m/s), electromechanical cylinders replacing pneumatics. Brands: Festo EGSK/ELGA, SMC LEY/LESH, Parker ETH, Camozzi 6E.",
  },
  valve: {
    sv: "Magnetventiler och riktningsventiler för pneumatiska cylindrar. 5/2-vägs, 3/2-vägs, NAMUR-montage och inlinjemontage. Spänning 24 V DC, anslutning G1/8–G3/4. Märken: Festo, SMC, Metal Work, Camozzi.",
    en: "Solenoid valves and directional control valves for pneumatic cylinders. 5/2-way, 3/2-way, NAMUR and inline mounting. 24 V DC, G1/8–G3/4 ports. Brands: Festo, SMC, Metal Work, Camozzi.",
  },
  "valve-terminal": {
    sv: "Ventilramplar och ventilterminaler för PROFINET, EtherCAT och DeviceNet. Centralisera ventilstyrning och minska kabelkostnad. Festo VTSA/CPV/MPA, SMC VFS/EX, Metal Work EB80.",
    en: "Valve terminals and manifolds for PROFINET, EtherCAT, DeviceNet. Centralize valve control and reduce wiring cost. Festo VTSA/CPV/MPA, SMC VFS/EX, Metal Work EB80.",
  },
  "linear-module": {
    sv: "Linjärmoduler och elektriska axlar för pick-and-place, XYZ-portaler och kartesiska robotar. Guidade profil-axlar med servomotor eller stegmotor. Festo EGC/ELGC, Parker OSPE.",
    en: "Linear modules and electric axes for pick-and-place, XYZ gantry and Cartesian robot systems. Profile rail axes with servo or stepper motor. Festo EGC/ELGC, Parker OSPE.",
  },
  gripper: {
    sv: "Pneumatiska grippers och gripdon för detalj- och ämneshållning. Parallellgrippers, vinkelgrippers och 3-fingersgrippers. Festo DHPS/HGPL, SMC MHZ2, Metal Work.",
    en: "Pneumatic grippers for part handling and workholding. Parallel, angular, and 3-finger grippers. Festo DHPS/HGPL, SMC MHZ2, Metal Work.",
  },
  frl: {
    sv: "FRL-enheter (Filter-Regulator-Smörjare) och luftberedning för pneumatiska system. Säkerställer rätt arbetstryck, filtrerad luft och tätningssmörjning. Festo MS4/MS6, SMC AC/AW, Metal Work.",
    en: "FRL units (Filter-Regulator-Lubricator) and air preparation for pneumatic systems. Ensures correct working pressure, filtered air and seal lubrication. Festo MS4/MS6, SMC AC/AW, Metal Work.",
  },
  vacuum: {
    sv: "Vakuumsystem, sugkoppar och ejektorer för vakuumgrepp av plana och krökta ytor. Festo VADM/VN, SMC ZP/ZR, Metal Work.",
    en: "Vacuum systems, suction cups and ejectors for vacuum gripping of flat and curved surfaces. Festo VADM/VN, SMC ZP/ZR, Metal Work.",
  },
  fitting: {
    sv: "Snabbkopplingar och anslutningar för pneumatikslang — push-in-kopplingar, L-, T- och Y-kopplingar samt gänganslutningar. Välj efter slangdiameter (Ø4–Ø12 mm) och gänga (M5, G1/8–G1/2). Märken: Festo QS, SMC KQ2, Camozzi 6000/7000.",
    en: "Push-in fittings and connectors for pneumatic tubing — straight, elbow, tee and Y push-in fittings plus threaded adapters. Select by tube diameter (Ø4–Ø12 mm) and thread (M5, G1/8–G1/2). Brands: Festo QS, SMC KQ2, Camozzi 6000/7000.",
  },
  tubing: {
    sv: "Pneumatikslang och tryckluftsrör i polyuretan (PU) och polyamid (PA). Välj efter ytterdiameter (Ø4–Ø12 mm), arbetstryck och temperatur — flexibel PU för rörliga delar, styvare PA för fasta dragningar. Märken: Festo PUN/PAN, SMC TU.",
    en: "Pneumatic tubing and hose in polyurethane (PU) and polyamide (PA). Select by outer diameter (Ø4–Ø12 mm), working pressure and temperature — flexible PU for moving parts, stiffer PA for fixed runs. Brands: Festo PUN/PAN, SMC TU.",
  },
  "flow-control": {
    sv: "Flödesreglerventiler och strypventiler för hastighetsstyrning av pneumatiska cylindrar. Strypbackventiler för avlufts- eller tilluftsstrypning som monteras direkt i cylinderns port. Festo GRLA/GRLZ, SMC AS, Camozzi.",
    en: "Flow control and throttle valves for speed control of pneumatic cylinders. One-way (meter-out / meter-in) throttle check valves that mount directly in the cylinder port. Festo GRLA/GRLZ, SMC AS, Camozzi.",
  },
  "rotary-actuator": {
    sv: "Pneumatiska vriddon och svängcylindrar för vridrörelse — kuggstångsdrivna (rack & pinion) och vinglamelltyp. Välj efter vridmoment, vinkel (90°, 180°, 270°) och storlek. Festo DRRD/DSM, SMC CRB, Metal Work.",
    en: "Pneumatic rotary actuators for rotary motion — rack-and-pinion and vane types. Select by torque, rotation angle (90°, 180°, 270°) and size. Festo DRRD/DSM, SMC CRB, Metal Work.",
  },
  sensor: {
    sv: "Givare och sensorer för pneumatik och automation — cylindergivare (reed/magnetoresistiva), tryckvakter och närvarogivare. Monteras i cylinderns T-spår för ändlägesavkänning. Festo SME/SDAT, SMC D-M9.",
    en: "Sensors for pneumatics and automation — cylinder position sensors (reed / magnetoresistive), pressure switches and proximity sensors. Mount in the cylinder T-slot for end-position sensing. Festo SME/SDAT, SMC D-M9.",
  },
  mounting: {
    sv: "Fästen och monteringstillbehör för pneumatiska cylindrar — svängtapps-, fläns-, fot- och gaffelinfästningar enligt ISO 15552 och ISO 6432. Välj efter cylinderstandard och borr. Festo, SMC, Metal Work.",
    en: "Mounting brackets and accessories for pneumatic cylinders — clevis, flange, foot and rod-eye mounts to ISO 15552 and ISO 6432. Select by cylinder standard and bore. Festo, SMC, Metal Work.",
  },
  silencer: {
    sv: "Ljuddämpare för pneumatisk frånluft som sänker bullernivån vid ventilers och cylindrars avluftning. Sintrade brons- eller plastdämpare med gänga M5–G1/2. Festo U/UC, SMC AN, Camozzi.",
    en: "Pneumatic exhaust silencers that cut noise from valve and cylinder exhaust air. Sintered bronze or plastic mufflers with M5–G1/2 threads. Festo U/UC, SMC AN, Camozzi.",
  },
  "servo-drive": {
    sv: "Servodrivare och motorstyrningar för elektriska axlar och servomotorer. Styr position, hastighet och vridmoment med fältbuss (PROFINET, EtherCAT). Festo CMMT-AS/CMMP-AS, Parker Compax3/PSD, SMC LECP/LECA, Bosch Rexroth IndraDrive.",
    en: "Servo drives and motor controllers for electric axes and servo motors. Control position, speed and torque over fieldbus (PROFINET, EtherCAT). Festo CMMT-AS/CMMP-AS, Parker Compax3/PSD, SMC LECP/LECA, Bosch Rexroth IndraDrive.",
  },
  "shock-absorber": {
    sv: "Industristötdämpare som bromsar rörliga massor mjukt vid ändläge och skyddar mekaniken. Välj efter energiupptagning (Nm/slag), slaglängd och gänga — självinställande eller justerbara. Festo YSR/DYSR, SMC RB, Camozzi.",
    en: "Industrial shock absorbers that decelerate moving loads smoothly at end positions and protect the mechanics. Select by energy capacity (Nm/cycle), stroke and thread — self-compensating or adjustable. Festo YSR/DYSR, SMC RB, Camozzi.",
  },
  "servo-motor": {
    sv: "Servomotorer och stegmotorer för elektriska axlar och precisionspositionering — borstlösa synkronmotorer med absolutgivare. Välj efter vridmoment, varvtal och flänsstorlek. Festo EMMT-AS/EMME-AS, Parker MPP/SMH, Bosch Rexroth MSK/MS2N, Camozzi.",
    en: "Servo and stepper motors for electric axes and precision positioning — brushless synchronous motors with absolute encoders. Select by torque, speed and flange size. Festo EMMT-AS/EMME-AS, Parker MPP/SMH, Bosch Rexroth MSK/MS2N, Camozzi.",
  },
  cable: {
    sv: "Anslutningskablar och kontakter för givare, ventiler och servomotorer — M8- och M12-kontakter samt motor- och encoderkablar. Välj efter poltal, längd och kapslingsklass (IP65/IP67). Festo NEBL/NEBU.",
    en: "Connection cables and connectors for sensors, valves and servo motors — M8 and M12 connectors plus motor and encoder cables. Select by number of poles, length and protection class (IP65/IP67). Festo NEBL/NEBU.",
  },
  "check-valve": {
    sv: "Backventiler som släpper igenom luft i en riktning och spärrar i den motsatta — för tryckhållning, nödsänkningsskydd och säker frånluft. Festo H/HA, SMC AK, Camozzi.",
    en: "Check valves that pass airflow in one direction and block the reverse — for pressure holding, emergency-drop prevention and safe exhaust. Festo H/HA, SMC AK, Camozzi.",
  },
  "seal-kit": {
    sv: "Tätningssatser och reservdelar för renovering av pneumatiska cylindrar — O-ringar samt kolv- och stångtätningar matchade mot cylinderns borr och serie. Förläng livslängden istället för att byta hela cylindern. Festo DARP, SMC.",
    en: "Seal kits and spare parts for reconditioning pneumatic cylinders — O-rings plus piston and rod seals matched to the cylinder bore and series. Extend service life instead of replacing the whole cylinder. Festo DARP, SMC.",
  },
  "rod-lock": {
    sv: "Stångbromsar och låsenheter som mekaniskt låser cylinderns kolvstång i läge vid tryckbortfall — för säkerhet vid vertikala laster och nödstopp. Monteras på cylinderns framgavel. Festo, SMC.",
    en: "Rod locks and clamping units that mechanically lock the cylinder piston rod in place on pressure loss — for safety with vertical loads and emergency stops. Mounts on the cylinder front cap. Festo, SMC.",
  },
  controller: {
    sv: "Styrsystem och motion controllers för automation — programmerbar rörelsestyrning, multiaxelkoordinering och fältbussintegration. Festo CPX-E för styrning av elektriska axlar och ventilterminaler.",
    en: "Controllers and motion controllers for automation — programmable motion control, multi-axis coordination and fieldbus integration. Festo CPX-E for controlling electric axes and valve terminals.",
  },
};

type Grade = "HIGH" | "MEDIUM" | "LOW";
function gradeOf(p: ProductRow): Grade {
  const lt = p.lead_time_days ?? 99;
  if (p.availability === "stock" || lt <= 7) return "HIGH";
  if (lt <= 21) return "MEDIUM";
  return "LOW";
}
const GRADE_STYLE: Record<Grade, string> = {
  HIGH: "bg-[oklch(0.92_0.06_155)] text-[oklch(0.32_0.12_155)]",
  MEDIUM: "bg-[oklch(0.94_0.08_85)] text-[oklch(0.38_0.12_75)]",
  LOW: "bg-muted text-muted-foreground",
};

function ProductsPage() {
  const { locale } = Route.useParams();
  const search = Route.useSearch();
  const t = makeT(locale as Locale);
  const aiSearch = useServerFn(aiSearchProducts);

  const [items, setItems] = useState<ProductRow[] | null>(null);
  const [q, setQ] = useState(search.q ?? search.ai ?? "");
  const [brands, setBrands] = useState<Set<string>>(new Set(search.brand ? [search.brand] : []));
  const [cats, setCats] = useState<Set<string>>(new Set(search.category ? [search.category] : []));
  const [grades, setGrades] = useState<Set<Grade>>(new Set());
  const [aiMode, setAiMode] = useState(!!search.ai);
  const [aiResult, setAiResult] = useState<AiSearchResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [addedSku, setAddedSku] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function quickAddToList(p: ProductRow) {
    addToShoppingList({ id: p.id, sku: p.sku, name: p.name });
    setAddedSku(p.sku);
    setTimeout(() => setAddedSku(null), 1800);
  }

  useEffect(() => {
    loadCatalog().then(setItems).catch(console.error);
    // Auto-run AI search if arrived with ?ai= param
    if (search.ai) {
      runAiSearch(search.ai);
    }
  }, []);

  async function runAiSearch(query: string) {
    if (!query.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await aiSearch({ data: { query, locale } });
      setAiResult(result);
      // Apply AI filters to manual filter state
      if (result.category_slug) setCats(new Set([result.category_slug]));
      if (result.brand_slug) setBrands(new Set([result.brand_slug]));
    } catch (e) {
      console.error("AI search failed", e);
    } finally {
      setAiLoading(false);
    }
  }

  function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    runAiSearch(q);
  }

  function clearAi() {
    setAiResult(null);
    setAiMode(false);
    setBrands(new Set());
    setCats(new Set());
    setQ("");
    inputRef.current?.focus();
  }

  const allBrands = useMemo(() => {
    const m = new Map<string, string>();
    items?.forEach((p) => m.set(p.brand.slug, p.brand.name));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const allCats = useMemo(() => {
    const m = new Map<string, string>();
    items?.forEach((p) => m.set(p.category.slug, categoryName(p.category.slug, locale, p.category.name)));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items, locale]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const ql = q.toLowerCase();

    const base = items.filter((p) => {
      if (brands.size && !brands.has(p.brand.slug)) return false;
      if (cats.size && !cats.has(p.category.slug)) return false;
      if (grades.size && !grades.has(gradeOf(p))) return false;

      // AI spec filters
      if (aiResult?.spec_filters?.length) {
        for (const f of aiResult.spec_filters) {
          const specVal = p.specs[f.key]?.value;
          if (specVal == null) continue;
          const num = Number(specVal);
          if (!Number.isFinite(num)) {
            if (f.exact && specVal !== f.exact) return false;
            continue;
          }
          if (f.min != null && num < f.min) return false;
          if (f.max != null && num > f.max) return false;
        }
      }

      // Keyword search (from AI keywords or manual q)
      const searchTerms = aiResult?.keywords?.length
        ? aiResult.keywords
        : ql
        ? [ql]
        : [];

      if (searchTerms.length > 0 && !aiResult?.category_slug && !aiResult?.brand_slug) {
        const haystack = [p.sku, p.name, p.brand.name, p.category.name, p.description ?? ""]
          .join(" ")
          .toLowerCase();
        const matches = searchTerms.some((term) => haystack.includes(term.toLowerCase()));
        if (!matches) return false;
      }

      // Manual text search (non-AI mode)
      if (!aiResult && ql) {
        const haystack = [p.sku, p.name, p.brand.name, p.category.name, p.description ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(ql)) return false;
      }

      return true;
    });

    // When AI returned ranked SKUs, sort those to the top
    if (aiResult?.ranked_skus?.length) {
      const rankMap = new Map(aiResult.ranked_skus.map((sku, i) => [sku, i]));
      return [...base].sort((a, b) => {
        const ra = rankMap.get(a.sku) ?? 9999;
        const rb = rankMap.get(b.sku) ?? 9999;
        return ra - rb;
      });
    }
    return base;
  }, [items, q, brands, cats, grades, aiResult]);

  function toggleSet<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const n = new Set(set);
    n.has(val) ? n.delete(val) : n.add(val);
    setter(n);
  }
  if (!items) return (
    <div className="container-page py-16 text-sm text-muted-foreground flex items-center gap-2">
      <span className="inline-block size-3 rounded-full bg-info animate-pulse" />
      {t("common.loading")}
    </div>
  );

  const activeFilterCount = brands.size + cats.size + grades.size;

  const activeCatSlug = cats.size === 1 ? [...cats][0] : search.category ?? null;
  const catSeo = activeCatSlug ? CATEGORY_SEO[activeCatSlug] : null;
  const catSeoText = catSeo ? (locale === "sv" ? catSeo.sv : catSeo.en) : null;

  return (
    <div className="container-page py-6 md:py-8">
      {/* SEO: category description — visible text for Google */}
      {catSeoText && (
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed max-w-2xl">{catSeoText}</p>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{t("nav.products")}</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            {filtered.length} {t("products.of")} {items.length} {t("products.count")}
          </p>
        </div>
        <Link
          to="/$locale/compare"
          params={{ locale }}
          className="text-xs md:text-sm px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:border-info hover:text-info transition"
        >
          ⟷ {t("nav.compare")}
        </Link>
      </div>

      {/* AI search bar */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-info">{t("productsPage.aiSearchLabel")}</span>
          <span className="text-[10px] text-muted-foreground">{t("productsPage.aiSearchDesc")}</span>
        </div>
        <form onSubmit={handleAiSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setAiMode(true)}
            placeholder={t("productsPage.aiSearchPlaceholder")}
            className="flex-1 px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
          />
          <button
            type="submit"
            disabled={aiLoading}
            className="px-4 py-2.5 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {aiLoading ? (
              <><span className="size-3 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />{t("productsPage.analyzing")}</>
            ) : <>✦ {t("common.search")}</>}
          </button>
          {(aiResult || activeFilterCount > 0) && (
            <button type="button" onClick={clearAi}
              className="px-3 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:border-info hover:text-foreground">
              {t("products.clearFilters")}
            </button>
          )}
        </form>

        {aiResult && (
          <div className={`mt-3 rounded-md px-3 py-2.5 text-sm flex items-start gap-2 ${
            aiResult.source === "ai" ? "bg-info/8 border border-info/20" : "bg-surface-alt border border-border"
          }`}>
            <span className="text-info mt-0.5 shrink-0">{aiResult.source === "ai" ? "✦" : "◎"}</span>
            <div>
              <span className="text-foreground">{aiResult.explanation}</span>
              {aiResult.followup && <p className="mt-1 text-muted-foreground text-xs italic">{aiResult.followup}</p>}
              {aiResult.source === "ai" && (aiResult.category_slug || aiResult.brand_slug || aiResult.spec_filters?.length > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {aiResult.category_slug && <span className="text-[10px] bg-info/10 text-info px-2 py-0.5 rounded-full">{t("productsPage.filterCategory")} {aiResult.category_slug}</span>}
                  {aiResult.brand_slug && <span className="text-[10px] bg-info/10 text-info px-2 py-0.5 rounded-full">{t("productsPage.filterBrand")} {aiResult.brand_slug}</span>}
                  {aiResult.spec_filters?.map((f, i) => (
                    <span key={i} className="text-[10px] bg-surface-alt text-muted-foreground px-2 py-0.5 rounded-full">
                      {f.key}: {f.min != null && f.max != null ? `${f.min}–${f.max}` : f.min != null ? `≥${f.min}` : `≤${f.max}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!aiResult && !q && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Festo cylinder 50mm", "SMC kompakt", "vakuumgrepp glas", "PROFINET ventil", "Parker pneumatisk"].map((ex) => (
              <button key={ex} type="button" onClick={() => { setQ(ex); setAiMode(true); }}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-info hover:text-info transition">
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top collapsible filter dropdowns */}
      <div className="flex flex-wrap gap-2 mb-5">
        <AccordionFilter
          label={t("products.brand")}
          count={brands.size}
        >
          <div className="space-y-1.5 p-3">
            {allBrands.map(([slug, name]) => (
              <Check key={slug} label={name} checked={brands.has(slug)} onChange={() => toggleSet(brands, slug, setBrands)} />
            ))}
          </div>
        </AccordionFilter>

        <AccordionFilter
          label={t("products.category")}
          count={cats.size}
        >
          <div className="space-y-1.5 p-3 max-h-64 overflow-y-auto">
            {allCats.map(([slug, name]) => (
              <Check key={slug} label={name} checked={cats.has(slug)} onChange={() => toggleSet(cats, slug, setCats)} />
            ))}
          </div>
        </AccordionFilter>

        <AccordionFilter
          label={t("products.availability")}
          count={grades.size}
        >
          <div className="space-y-1.5 p-3">
            {(["HIGH", "MEDIUM", "LOW"] as Grade[]).map((g) => (
              <Check
                key={g}
                label={g === "HIGH" ? t("products.inStock") : g === "MEDIUM" ? t("products.standard") : t("products.onOrder")}
                checked={grades.has(g)}
                onChange={() => toggleSet(grades, g, setGrades)}
              />
            ))}
          </div>
        </AccordionFilter>

        {/* Active filter chips */}
        {brands.size > 0 && Array.from(brands).map((b) => {
          const name = allBrands.find(([s]) => s === b)?.[1] ?? b;
          return (
            <button key={b} onClick={() => toggleSet(brands, b, setBrands)}
              className="text-xs px-3 py-1.5 rounded-full bg-info/10 text-info border border-info/30 hover:bg-info/20 transition flex items-center gap-1">
              {name} ×
            </button>
          );
        })}
        {cats.size > 0 && Array.from(cats).map((c) => {
          const name = allCats.find(([s]) => s === c)?.[1] ?? c;
          return (
            <button key={c} onClick={() => toggleSet(cats, c, setCats)}
              className="text-xs px-3 py-1.5 rounded-full bg-info/10 text-info border border-info/30 hover:bg-info/20 transition flex items-center gap-1">
              {name} ×
            </button>
          );
        })}
        {grades.size > 0 && Array.from(grades).map((g) => (
          <button key={g} onClick={() => toggleSet(grades, g, setGrades)}
            className="text-xs px-3 py-1.5 rounded-full bg-info/10 text-info border border-info/30 hover:bg-info/20 transition flex items-center gap-1">
            {g === "HIGH" ? t("products.inStock") : g === "MEDIUM" ? t("products.standard") : t("products.onOrder")} ×
          </button>
        ))}
      </div>

      {/* Product grid */}
      <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const g = gradeOf(p);
            return (
              <li
                key={p.id}
                className="group rounded-lg border border-border bg-card flex flex-col transition overflow-hidden hover:border-info"
              >
                <div className="relative aspect-[3/2] overflow-hidden bg-[#f8f9fb] flex items-center justify-center">
                  <img
                    src={getProductImage(p)}
                    alt={p.category.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start gap-2">
                  <Link
                    to="/$locale/product/$sku"
                    params={{ locale, sku: p.sku }}
                    className="font-medium text-foreground hover:text-info line-clamp-2 transition"
                  >
                    {p.name}
                  </Link>
                </div>

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-info">{p.brand.name}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{categoryName(p.category.slug, locale, p.category.name)}</span>
                </div>

                {/* Key specs preview */}
                {Object.keys(p.specs).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(p.specs).slice(0, 3).map(([k, v]) => (
                      <span
                        key={k}
                        className="text-[10px] bg-surface-alt px-1.5 py-0.5 rounded text-muted-foreground"
                      >
                        {k.replace(/_/g, " ")}: {v.value}{v.unit ? ` ${v.unit}` : ""}
                      </span>
                    ))}
                  </div>
                )}

                {p.description && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}

                <div className="mt-3 font-mono text-[11px] text-muted-foreground">{p.sku}</div>

                <div className="mt-auto pt-3 border-t border-border">
                  <div className="flex items-center gap-3 mt-0">
                    <Link
                      to="/$locale/product/$sku"
                      params={{ locale, sku: p.sku }}
                      className="text-xs text-info hover:underline font-medium"
                    >
                      {t("productsPage.datasheet")} →
                    </Link>
                    <button
                      onClick={() => quickAddToList(p)}
                      className={`text-[11px] transition font-medium px-2 py-0.5 rounded ${
                        addedSku === p.sku
                          ? "text-[oklch(0.55_0.15_155)] bg-[oklch(0.55_0.15_155)]/10"
                          : "text-muted-foreground hover:text-info"
                      }`}
                      title={t("productsPage.addToList")}
                    >
                      {addedSku === p.sku ? "✓ " + t("productsPage.added") : "+ " + t("productsPage.addToList")}
                    </button>
                    <Link
                      to="/$locale/compare"
                      params={{ locale }}
                      search={{ skus: p.sku }}
                      className="text-[11px] text-muted-foreground hover:text-info transition ml-auto"
                    >
                      ⟷ {t("productsPage.compareLink")}
                    </Link>
                  </div>
                </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="col-span-full text-center py-16 text-sm text-muted-foreground">
              <div className="text-2xl mb-3">◎</div>
              <p className="mb-3">
                {aiResult
                  ? t("productsPage.noResultsAi")
                  : t("productsPage.noResultsManual")}
              </p>
              <Link
                to="/$locale/advisor"
                params={{ locale } as never}
                search={{ q: undefined }}
                className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-md border border-border hover:border-info hover:text-info transition"
              >
                📋 {t("productPage.requestQuote")}
              </Link>
            </li>
          )}
        </ul>
    </div>
  );
}

function AccordionFilter({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition ${
          open || count > 0
            ? "border-info bg-info/8 text-info"
            : "border-border bg-card text-foreground hover:border-info hover:text-info"
        }`}
      >
        {label}
        {count > 0 && (
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-info text-primary-foreground text-[10px] font-bold">
            {count}
          </span>
        )}
        <span className="text-xs opacity-60">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-card border border-border rounded-lg shadow-lg min-w-[180px]">
          {children}
        </div>
      )}
    </div>
  );
}


function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:text-info group">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-[var(--info)]" />
      <span className="capitalize group-hover:text-info transition">{label}</span>
    </label>
  );
}

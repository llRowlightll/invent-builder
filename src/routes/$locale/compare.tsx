import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";
import { addToShoppingList } from "@/lib/cart";
import { SITE, hreflangLinks } from "@/lib/site";

export const Route = createFileRoute("/$locale/compare")({
  validateSearch: z.object({ skus: z.string().optional() }),
  head: ({ params }) => {
    const locale = params.locale;
    const t = makeT(locale as Locale);
    return {
      meta: [
        { title: `${t("nav.compare")} — ${t("common.appName")}` },
        { name: "description", content: "Jämför pneumatiska cylindrar och aktuatorer sida vid sida. Se skillnader i specs, IP-klass, slag, kraft och pris mellan Festo, SMC, Parker, Bosch Rexroth och fler." },
        { property: "og:title", content: `${t("nav.compare")} — ${t("common.appName")}` },
        { property: "og:url", content: `${SITE}/${locale}/compare` },
      ],
      links: [
        { rel: "canonical", href: `${SITE}/${locale}/compare` },
        ...hreflangLinks("compare"),
      ],
    };
  },
  component: ComparePage,
});

// ─── Spec grouping ──────────────────────────────────────────────────────────
type SpecGroup = { label: string; icon: string; rows: SpecRowDef[] };
type SpecRowDef =
  | { kind: "flat"; label: string; get: (p: ProductRow) => string }
  | { kind: "spec"; label: string; key: string };

function mm(v: number | null) { return v != null ? `${v} mm` : "—"; }

const SPEC_GROUPS: SpecGroup[] = [
  {
    label: "Logistik & tillgänglighet",
    icon: "📦",
    rows: [
      { kind: "flat", label: "Varumärke",       get: (p) => p.brand.name },
      { kind: "flat", label: "Kategori",         get: (p) => p.category.name },
      { kind: "spec", label: "Produkttyp",       key: "type" },
      { kind: "spec", label: "Cylindertyp",      key: "cylinder_type" },
      { kind: "spec", label: "Aktuatortyp",      key: "actuator_type" },
      { kind: "spec", label: "Grippertyp",       key: "gripper_type" },
      { kind: "spec", label: "Serie",            key: "series" },
      { kind: "spec", label: "Tillämpning",      key: "application" },
      { kind: "flat", label: "Tillgänglighet",   get: (p) =>
          p.availability === "stock" ? "✓ På lager" : p.availability === "order" ? "Beställningsvara" : p.availability ?? "—" },
      { kind: "flat", label: "Ledtid",           get: (p) => p.lead_time_days ? `${p.lead_time_days} dagar` : "—" },
      { kind: "flat", label: "Vikt",             get: (p) => p.weight_kg != null ? `${p.weight_kg} kg` : "—" },
      { kind: "spec", label: "Vikt",             key: "weight" },
    ],
  },
  {
    label: "Dimensioner",
    icon: "📐",
    rows: [
      { kind: "spec", label: "Borrdiameter",     key: "bore_mm" },
      { kind: "spec", label: "Borrdiameter",     key: "bore_diameter_mm" },
      { kind: "spec", label: "Borrdiameter",     key: "bore_diameter" },
      { kind: "spec", label: "Innerdiameter",    key: "inner_diameter_mm" },
      { kind: "spec", label: "Ytterdiameter",    key: "outer_diameter_mm" },
      { kind: "spec", label: "Rördiameter",      key: "tube_od_mm" },
      { kind: "spec", label: "Max slag",         key: "stroke_max" },
      { kind: "spec", label: "Max slag",         key: "max_stroke" },
      { kind: "spec", label: "Slagområde",       key: "stroke_range" },
      { kind: "flat", label: "Längd",            get: (p) => mm(p.length_mm) },
      { kind: "flat", label: "Bredd",            get: (p) => mm(p.width_mm) },
      { kind: "flat", label: "Höjd",             get: (p) => mm(p.height_mm) },
      { kind: "spec", label: "Längd (m)",        key: "length_m" },
      { kind: "spec", label: "Längdreduktion",   key: "body_length_reduction_pct" },
      { kind: "spec", label: "Käftbredd",        key: "jaw_width_mm" },
      { kind: "spec", label: "Käftslag/sida",    key: "jaw_stroke_per_side" },
      { kind: "spec", label: "Käftöppningsvinkel", key: "jaw_opening_angle" },
      { kind: "spec", label: "Rotationsvinkel",  key: "rotation_angle" },
      { kind: "spec", label: "Repeterbarhet",    key: "repeatability_mm" },
    ],
  },
  {
    label: "Prestanda & krafter",
    icon: "⚡",
    rows: [
      { kind: "spec", label: "Max arbetstryck",  key: "max_pressure" },
      { kind: "spec", label: "Max arbetstryck",  key: "max_pressure_bar" },
      { kind: "spec", label: "Drifttryck",       key: "operating_pressure" },
      { kind: "spec", label: "Matartryck",       key: "supply_pressure" },
      { kind: "spec", label: "Kolvkraft vid 6 bar", key: "piston_force_6bar_N" },
      { kind: "spec", label: "Greppkraft",       key: "gripping_force_N" },
      { kind: "spec", label: "Klämkraft",        key: "clamping_force" },
      { kind: "spec", label: "Tryckkraft",       key: "thrust_force" },
      { kind: "spec", label: "Vridmoment",       key: "torque" },
      { kind: "spec", label: "Max hastighet",    key: "max_speed" },
      { kind: "spec", label: "Flöde",            key: "flow_rate_l_min" },
      { kind: "spec", label: "Vakuumnivå",       key: "vacuum_level" },
      { kind: "spec", label: "Antal käftar",     key: "number_of_jaws" },
    ],
  },
  {
    label: "Ventil & pneumatik",
    icon: "🔧",
    rows: [
      { kind: "spec", label: "Ventilfunktion",   key: "function" },
      { kind: "spec", label: "Ventilstandard",   key: "valve_standard" },
      { kind: "spec", label: "Antal stationer",  key: "stations" },
      { kind: "spec", label: "Ventilskivor",     key: "valve_slices" },
      { kind: "spec", label: "Portdimension",    key: "port_size" },
      { kind: "spec", label: "Anslutning",       key: "connection" },
      { kind: "spec", label: "Gänga",            key: "thread" },
      { kind: "spec", label: "Flödesriktning",   key: "flow_direction" },
      { kind: "spec", label: "Filterklass",      key: "filter_grade" },
      { kind: "spec", label: "Tätad borrning",   key: "sealed_bore" },
      { kind: "spec", label: "Magnetspänning",   key: "solenoid_voltage" },
      { kind: "spec", label: "Aktivering",       key: "actuation" },
      { kind: "spec", label: "Drivsätt",         key: "drive" },
      { kind: "spec", label: "Glidsätt",         key: "slide_type" },
    ],
  },
  {
    label: "Miljö & tätning",
    icon: "🛡️",
    rows: [
      { kind: "flat", label: "IP-klass",         get: (p) => p.ip_rating ?? "—" },
      { kind: "spec", label: "IP-klass",         key: "ip_rating" },
      { kind: "spec", label: "Skyddsklassning",  key: "protection_class" },
      { kind: "spec", label: "Temperaturområde", key: "temp_range" },
      { kind: "spec", label: "Temperaturområde", key: "temperature_range" },
      { kind: "spec", label: "Medium",           key: "medium" },
      { kind: "spec", label: "Renrumsanpassad",  key: "clean_room_compatible" },
    ],
  },
  {
    label: "Konstruktion & material",
    icon: "🔩",
    rows: [
      { kind: "spec", label: "Standard",         key: "standard" },
      { kind: "spec", label: "Material",         key: "material" },
      { kind: "spec", label: "Guidetyp",         key: "guide_type" },
      { kind: "spec", label: "Guidetyper",       key: "guide_types" },
      { kind: "spec", label: "Styrning/dämpning", key: "cushioning_types" },
      { kind: "spec", label: "Positionsutgång",  key: "position_output" },
      { kind: "spec", label: "Anmärkning",       key: "note" },
    ],
  },
  {
    label: "El & kommunikation",
    icon: "📡",
    rows: [
      { kind: "flat", label: "Spänning",         get: (p) => p.voltage ?? "—" },
      { kind: "flat", label: "Fieldbus",         get: (p) => p.fieldbus ?? "—" },
      { kind: "spec", label: "Spänning",         key: "voltage" },
      { kind: "spec", label: "Fieldbus",         key: "fieldbus" },
    ],
  },
];

// Build a unique list of rows (remove duplicate keys, remove rows where all products return "—")
function buildRows(group: SpecGroup, compared: ProductRow[]): Array<{ label: string; cells: string[]; isDifferent: boolean }> {
  const seen = new Set<string>();
  const result: Array<{ label: string; cells: string[]; isDifferent: boolean }> = [];

  for (const row of group.rows) {
    const key = row.kind === "flat" ? `flat:${row.label}` : `spec:${row.key}`;
    if (seen.has(key)) continue;

    const cells = compared.map((p) => {
      if (row.kind === "flat") return row.get(p);
      const s = p.specs[row.key];
      return s ? `${s.value}${s.unit ? " " + s.unit : ""}` : "—";
    });

    const allDash = cells.every((c) => c === "—");
    if (allDash) continue; // don't show rows where every product has no data

    seen.add(key);
    const isDifferent = new Set(cells).size > 1;
    result.push({ label: row.label, cells, isDifferent });
  }
  return result;
}

// Extra specs not covered by any group
function extraRows(compared: ProductRow[], groupedKeys: Set<string>): Array<{ label: string; cells: string[]; isDifferent: boolean }> {
  const allKeys = new Set<string>();
  compared.forEach((p) => Object.keys(p.specs).forEach((k) => allKeys.add(k)));
  const result: Array<{ label: string; cells: string[]; isDifferent: boolean }> = [];
  Array.from(allKeys).sort().forEach((k) => {
    if (groupedKeys.has(k)) return;
    const cells = compared.map((p) => {
      const s = p.specs[k];
      return s ? `${s.value}${s.unit ? " " + s.unit : ""}` : "—";
    });
    if (cells.every((c) => c === "—")) return;
    const isDifferent = new Set(cells).size > 1;
    result.push({ label: k.replace(/_/g, " "), cells, isDifferent });
  });
  return result;
}

const GROUPED_SPEC_KEYS = new Set(
  SPEC_GROUPS.flatMap((g) => g.rows.filter((r) => r.kind === "spec").map((r) => (r as { key: string }).key))
);

// ─── Component ───────────────────────────────────────────────────────────────

function ComparePage() {
  const { locale } = Route.useParams();
  const { skus } = Route.useSearch();
  const t = makeT(locale as Locale);
  const navigate = useNavigate();

  const [items, setItems] = useState<ProductRow[] | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(() =>
    skus ? skus.split(",").filter(Boolean) : []
  );
  const [diffOnly, setDiffOnly] = useState(false);
  const [showIdentical, setShowIdentical] = useState(true);
  const showBoth = !diffOnly && showIdentical;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addedSku, setAddedSku] = useState<string | null>(null);

  useEffect(() => { loadCatalog().then(setItems); }, []);

  useEffect(() => {
    navigate({
      to: "/$locale/compare", params: { locale },
      search: selected.length ? { skus: selected.join(",") } : {},
      replace: true,
    } as never);
  }, [selected]);

  const compared = useMemo(() => {
    if (!items || !selected.length) return [];
    return selected.map((s) => items.find((p) => p.sku === s)).filter(Boolean) as ProductRow[];
  }, [items, selected]);

  const lockedCategory = compared[0]?.category ?? null;

  const pickerItems = useMemo(() => {
    if (!items) return [];
    const q = pickerSearch.toLowerCase();
    return items
      .filter((p) => {
        if (lockedCategory && p.category.slug !== lockedCategory.slug) return false;
        if (q && !`${p.sku} ${p.name} ${p.brand.name}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.brand.name.localeCompare(b.brand.name))
      .slice(0, 80);
  }, [items, pickerSearch, lockedCategory]);

  function toggle(sku: string) {
    setSelected((prev) =>
      prev.includes(sku)
        ? prev.filter((s) => s !== sku)
        : prev.length >= 4 ? prev : [...prev, sku]
    );
  }

  function quickAdd(p: ProductRow) {
    addToShoppingList({ id: p.id, sku: p.sku, name: p.name });
    setAddedSku(p.sku);
    setTimeout(() => setAddedSku(null), 1800);
  }

  // Stats
  const diffCount = useMemo(() => {
    if (!compared.length) return 0;
    let n = 0;
    SPEC_GROUPS.forEach((g) => {
      buildRows(g, compared).forEach((r) => { if (r.isDifferent) n++; });
    });
    extraRows(compared, GROUPED_SPEC_KEYS).forEach((r) => { if (r.isDifferent) n++; });
    return n;
  }, [compared]);

  // Download comparison as CSV
  function downloadCSV() {
    if (!compared.length) return;
    const allRows: Array<{ label: string; cells: string[] }> = [];
    SPEC_GROUPS.forEach((g) => buildRows(g, compared).forEach((r) => allRows.push(r)));
    extraRows(compared, GROUPED_SPEC_KEYS).forEach((r) => allRows.push(r));

    const header = ["Specifikation", ...compared.map((p) => `${p.brand.name} – ${p.name} (${p.sku})`)];
    const lines = [header, ...allRows.map((r) => [r.label, ...r.cells])];
    const csv = lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "jämförelse.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (!items) {
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const cols = compared.length;

  // Detect mixed-category comparison (e.g. arrived via URL with skus from different categories)
  const categoryNames = [...new Set(compared.map((p) => p.category.slug))];
  const isMixedCategories = categoryNames.length > 1;

  return (
    <div className="container-page py-8 max-w-6xl">

      {/* ── Mixed-category warning ── */}
      {isMixedCategories && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="mt-0.5 text-base">⚠️</span>
          <div>
            <strong>Blandade kategorier</strong> — du jämför produkter från olika produktgrupper (
            {compared.map((p) => `${p.brand.name}: ${p.category.name}`).join(" · ")}
            ). Specifikationerna kanske inte är jämförbara. Ta bort produkter från en kategori och lägg till liknande för en rättvisande jämförelse.
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Produktjämförelse</h1>
        <Link to="/$locale/products" params={{ locale }} className="text-sm text-muted-foreground hover:text-info">
          ← Katalog
        </Link>
      </div>

      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Different / Identical checkboxes */}
        {compared.length >= 2 && (
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                className="rounded border-border accent-[#1F6FBF]"
                checked={diffOnly || showBoth}
                onChange={(e) => { setDiffOnly(e.target.checked); if (!e.target.checked) setShowIdentical(true); }}
              />
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#D6E8F7" }} />
              Skillnader
              {diffCount > 0 && <span className="text-xs text-muted-foreground">({diffCount})</span>}
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={showIdentical}
                onChange={(e) => setShowIdentical(e.target.checked)}
              />
              <span className="w-3 h-3 rounded-sm inline-block border border-border bg-background" />
              Identiska
            </label>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {compared.length >= 2 && (
            <button
              type="button"
              onClick={downloadCSV}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3a1 1 0 01.7.3l4 4a1 1 0 01-1.4 1.4L11 6.42V13a1 1 0 11-2 0V6.42L6.7 8.7a1 1 0 01-1.4-1.4l4-4A1 1 0 0110 3zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
              Ladda ner
            </button>
          )}
          {compared.length > 0 && (
            <button
              type="button"
              onClick={() => { setSelected([]); setPickerOpen(false); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 00-1 1v1H2a1 1 0 000 2h1v10a2 2 0 002 2h10a2 2 0 002-2V6h1a1 1 0 100-2h-1V3a1 1 0 00-1-1H4zm1 4h10v10H5V6zm2 2a1 1 0 011 1v5a1 1 0 11-2 0V9a1 1 0 011-1zm4 0a1 1 0 011 1v5a1 1 0 11-2 0V9a1 1 0 011-1z" clipRule="evenodd"/>
              </svg>
              Rensa alla
            </button>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:border-info hover:text-info transition"
          >
            {pickerOpen ? "▴" : "▾"} Välj produkter ({selected.length}/4)
          </button>
        </div>
      </div>

      {/* ── Product picker ── */}
      {pickerOpen && (
        <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-alt/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Välj produkter att jämföra</h2>
              {lockedCategory && (
                <span className="text-[10px] bg-info/10 text-info border border-info/20 px-2 py-0.5 rounded-full">
                  {lockedCategory.name}
                </span>
              )}
            </div>
            <button onClick={() => setPickerOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
          </div>
          <div className="px-3 py-2 border-b border-border">
            <input
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Sök SKU, namn, varumärke…"
              className="w-full text-xs px-3 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-info"
              autoFocus
            />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0 max-h-72 overflow-y-auto divide-y divide-border">
            {pickerItems.map((p) => {
              const isOn = selected.includes(p.sku);
              const disabled = !isOn && selected.length >= 4;
              return (
                <button
                  key={p.sku}
                  onClick={() => !disabled && toggle(p.sku)}
                  disabled={disabled}
                  className={`text-left flex items-center gap-3 px-4 py-2.5 transition ${
                    isOn ? "bg-[#D6E8F7]/60" : disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-surface-alt"
                  }`}
                >
                  <img src={getProductImage(p)} alt="" className="size-7 object-contain shrink-0 opacity-80" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{p.sku}</div>
                  </div>
                  <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                    isOn ? "bg-info border-info text-white" : "border-border"
                  }`}>
                    {isOn && <span className="text-[10px]">✓</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {compared.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="text-5xl mb-4 opacity-15">⟷</div>
          <p className="text-sm font-medium text-foreground">Välj produkter att jämföra</p>
          <p className="text-xs text-muted-foreground mt-1">Klicka på "Välj produkter" ovan eller lägg till från produktlistan.</p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-4 px-4 py-2 rounded-md bg-info text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            + Välj produkter
          </button>
        </div>
      )}

      {/* ── Comparison table ── */}
      {compared.length > 0 && (
        <div className="overflow-x-auto">
          <div style={{ minWidth: `calc(13rem + ${cols} * 13rem)` }}>

            {/* Product cards row */}
            <div
              className="grid mb-0"
              style={{ gridTemplateColumns: `13rem repeat(${cols}, 1fr)` }}
            >
              <div /> {/* spacer */}
              {compared.map((p) => {
                const isAdded = addedSku === p.sku;
                return (
                  <div key={p.sku} className="p-3 border border-border rounded-xl mx-1 mb-4 bg-card flex flex-col relative">
                    <button
                      type="button"
                      onClick={() => toggle(p.sku)}
                      className="absolute top-2 right-2 size-6 flex items-center justify-center rounded-full hover:bg-surface-alt text-muted-foreground hover:text-foreground transition text-sm"
                      title="Ta bort"
                    >
                      ×
                    </button>
                    <div className="h-24 flex items-center justify-center mb-3">
                      <img src={getProductImage(p)} alt={p.name} className="h-20 object-contain" />
                    </div>
                    <div className="text-xs font-semibold text-foreground leading-snug mb-1">{p.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground mb-1">{p.sku}</div>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => quickAdd(p)}
                      className={`mt-2 w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md font-medium transition ${
                        isAdded ? "bg-green-100 text-green-700" : "bg-info text-white hover:opacity-90"
                      }`}
                    >
                      {isAdded ? "✓ Tillagd" : (
                        <>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/>
                          </svg>
                          Lägg i korg
                        </>
                      )}
                    </button>
                    <Link
                      to="/$locale/product/$sku"
                      params={{ locale, sku: p.sku }}
                      className="mt-1.5 block text-center text-[11px] text-info hover:underline"
                    >
                      Visa produkt →
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Tech data header */}
            <div
              className="grid border-t border-l border-r border-border bg-surface-alt/60 rounded-t-lg"
              style={{ gridTemplateColumns: `13rem repeat(${cols}, 1fr)` }}
            >
              <div className="px-4 py-3 col-span-full">
                <span className="text-sm font-semibold text-foreground">Tekniska data</span>
              </div>
            </div>

            {/* Spec rows */}
            {SPEC_GROUPS.map((group) => {
              const rows = buildRows(group, compared).filter((r) => {
                if (r.isDifferent) return true;           // always show differences
                return showIdentical && !diffOnly;         // show identical only if checkbox on and not "diff-only"
              });
              if (!rows.length) return null;
              return (
                <GroupSection key={group.label} label={group.label} icon={group.icon} rows={rows} cols={cols} diffOnly={diffOnly} />
              );
            })}

            {/* Extra specs */}
            {(() => {
              const extras = extraRows(compared, GROUPED_SPEC_KEYS).filter((r) => {
                if (r.isDifferent) return true;
                return showIdentical && !diffOnly;
              });
              if (!extras.length) return null;
              return <GroupSection label="Övriga specifikationer" icon="📋" rows={extras} cols={cols} diffOnly={diffOnly} />;
            })()}

            {/* Bottom border */}
            <div className="border-b border-l border-r border-border rounded-b-lg h-2 bg-surface-alt/20" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Group section ────────────────────────────────────────────────────────────

function GroupSection({
  label,
  icon,
  rows,
  cols,
}: {
  label: string;
  icon: string;
  rows: Array<{ label: string; cells: string[]; isDifferent: boolean }>;
  cols: number;
  diffOnly: boolean;
}) {
  return (
    <>
      {/* Section header */}
      <div
        className="grid border-t border-l border-r border-border bg-[#f0f4f8]"
        style={{ gridTemplateColumns: `13rem repeat(${cols}, 1fr)` }}
      >
        <div className="px-4 py-2 col-span-full flex items-center gap-2">
          <span className="text-base leading-none">{icon}</span>
          <span className="text-xs font-semibold text-foreground">{label}</span>
        </div>
      </div>

      {/* Spec rows */}
      {rows.map((row, i) => (
        <div
          key={`${row.label}-${i}`}
          className={`grid border-t border-l border-r border-border ${
            row.isDifferent
              ? "bg-[#D6E8F7]"
              : i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"
          }`}
          style={{ gridTemplateColumns: `13rem repeat(${cols}, 1fr)` }}
        >
          {/* Label */}
          <div className="px-4 py-3 border-r border-border">
            <span className="text-sm font-medium text-foreground leading-snug">{row.label}</span>
          </div>

          {/* Values */}
          {row.cells.map((cell, ci) => (
            <div
              key={ci}
              className={`px-4 py-3 border-r border-border last:border-r-0 text-sm break-words min-w-0 ${
                cell === "—" ? "text-muted-foreground/40" : "text-foreground"
              }`}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

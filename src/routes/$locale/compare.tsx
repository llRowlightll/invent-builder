import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import type { ProductRow } from "@/lib/types";
import { getProductImage } from "@/lib/product-images";
import { addToShoppingList } from "@/lib/cart";

export const Route = createFileRoute("/$locale/compare")({
  validateSearch: z.object({ skus: z.string().optional() }),
  head: ({ params }) => ({
    meta: [{ title: `${makeT(params.locale as Locale)("nav.compare")} — ${makeT(params.locale as Locale)("common.appName")}` }],
  }),
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

  if (!items) {
    return <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const cols = compared.length;

  return (
    <div className="container-page py-8 max-w-6xl">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.compare")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lockedCategory
              ? <><span className="font-medium text-foreground">{lockedCategory.name}</span> — jämför upp till 4 produkter</>
              : "Välj en kategori och upp till 4 produkter att jämföra"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {compared.length >= 2 && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <span className="relative inline-flex h-4 w-7 items-center rounded-full transition"
                style={{ background: diffOnly ? "oklch(0.55 0.18 255)" : "oklch(0.8 0 0)" }}>
                <span className={`inline-block size-3 rounded-full bg-white shadow transition-transform ${diffOnly ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </span>
              <input type="checkbox" className="sr-only" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} />
              <span className="text-xs text-muted-foreground">
                Visa bara skillnader
                {diffOnly && diffCount > 0 && <span className="ml-1 text-info">({diffCount})</span>}
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-info hover:text-info transition"
          >
            {pickerOpen ? "▴" : "▾"} Välj produkter ({selected.length}/4)
          </button>
          <Link to="/$locale/products" params={{ locale }} className="text-sm text-muted-foreground hover:text-info">
            ← Katalog
          </Link>
        </div>
      </div>

      {/* Product picker — collapsible */}
      {pickerOpen && (
        <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-alt/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Välj produkter</h2>
              {lockedCategory && (
                <span className="text-[10px] bg-info/10 text-info border border-info/20 px-2 py-0.5 rounded-full">
                  {lockedCategory.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selected.length > 0 && (
                <button onClick={() => setSelected([])} className="text-[10px] text-muted-foreground hover:text-destructive">
                  Rensa ×
                </button>
              )}
              <button onClick={() => setPickerOpen(false)} className="text-muted-foreground hover:text-foreground text-sm">×</button>
            </div>
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
                  className={`text-left flex items-center gap-3 px-4 py-2.5 border-l border-border transition ${
                    isOn ? "bg-info/10" : disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-surface-alt"
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

      {/* Empty state */}
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

      {/* Key differences summary */}
      {compared.length >= 2 && <KeyDiffSummary compared={compared} />}

      {/* Comparison table */}
      {compared.length > 0 && (
        <div className="rounded-xl border border-border overflow-x-auto">
          <div style={{ minWidth: `calc(14rem + ${cols} * 11rem)` }}>

          {/* Product header */}
          <div
            className="grid border-b border-border bg-card"
            style={{ gridTemplateColumns: `14rem repeat(${cols}, 1fr)` }}
          >
            {/* Corner cell */}
            <div className="p-4 border-r border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Specifikation</div>
            </div>

            {/* Product cards */}
            {compared.map((p) => {
              const isAdded = addedSku === p.sku;
              return (
                <div key={p.sku} className="p-3 border-r border-border last:border-r-0 flex flex-col min-h-0">
                  <div className="flex justify-end mb-1">
                    <button
                      type="button"
                      onClick={() => toggle(p.sku)}
                      className="text-[10px] text-muted-foreground/40 hover:text-destructive transition leading-none"
                      title="Ta bort"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="h-20 bg-[#f8f9fb] rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                    <img src={getProductImage(p)} alt={p.name} className="h-16 object-contain" />
                  </div>
                  <div className="text-[10px] text-info font-medium uppercase tracking-wide">{p.brand.name}</div>
                  <Link
                    to="/$locale/product/$sku"
                    params={{ locale, sku: p.sku }}
                    className="text-xs font-semibold hover:text-info transition mt-0.5 line-clamp-2 leading-snug"
                  >
                    {p.name}
                  </Link>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{p.sku}</div>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => quickAdd(p)}
                      className={`flex-1 text-[10px] py-1 rounded font-medium transition ${
                        isAdded
                          ? "bg-[oklch(0.55_0.15_155)]/15 text-[oklch(0.45_0.15_155)]"
                          : "bg-info text-primary-foreground hover:opacity-90"
                      }`}
                    >
                      {isAdded ? "✓ Tillagd" : "+ Lägg i korg"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grouped spec sections */}
          {SPEC_GROUPS.map((group) => {
            const rows = buildRows(group, compared).filter((r) => !diffOnly || r.isDifferent);
            if (!rows.length) return null;
            return (
              <GroupSection key={group.label} label={group.label} icon={group.icon} rows={rows} cols={cols} diffOnly={diffOnly} />
            );
          })}

          {/* Extra specs (anything not in a group) */}
          {(() => {
            const extras = extraRows(compared, GROUPED_SPEC_KEYS).filter((r) => !diffOnly || r.isDifferent);
            if (!extras.length) return null;
            return <GroupSection label="Övriga specifikationer" icon="📋" rows={extras} cols={cols} diffOnly={diffOnly} />;
          })()}

          {/* CTA row */}
          <div
            className="grid border-t-2 border-border bg-surface-alt/40"
            style={{ gridTemplateColumns: `14rem repeat(${cols}, 1fr)` }}
          >
            <div className="p-4 border-r border-border flex items-center">
              <span className="text-xs text-muted-foreground font-medium">Åtgärd</span>
            </div>
            {compared.map((p) => (
              <div key={p.sku} className="p-3 border-r border-border last:border-r-0 space-y-1.5">
                <button
                  type="button"
                  onClick={() => quickAdd(p)}
                  className="block w-full text-center text-xs px-3 py-2 rounded-md bg-info text-primary-foreground hover:opacity-90 font-medium transition"
                >
                  + Lägg i korg
                </button>
                <Link
                  to="/$locale/product/$sku"
                  params={{ locale, sku: p.sku }}
                  className="block text-center text-xs px-3 py-2 rounded-md border border-border text-muted-foreground hover:border-info hover:text-info transition"
                >
                  Visa produkt →
                </Link>
              </div>
            ))}
          </div>
          </div>{/* end min-width wrapper */}
        </div>
      )}
    </div>
  );
}

// ─── Key differences summary ──────────────────────────────────────────────────

function KeyDiffSummary({ compared }: { compared: ProductRow[] }) {
  const diffs: Array<{ label: string; cells: string[] }> = [];

  for (const group of SPEC_GROUPS) {
    for (const row of buildRows(group, compared)) {
      if (row.isDifferent) diffs.push(row);
      if (diffs.length >= 6) break;
    }
    if (diffs.length >= 6) break;
  }

  if (!diffs.length) return null;

  return (
    <div className="mb-4 rounded-xl border border-info/30 bg-info/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-foreground">Viktiga skillnader</span>
        <span className="text-[10px] bg-info/15 text-info px-2 py-0.5 rounded-full font-medium">
          {compared.map((p) => p.brand.name).join(" vs ")}
        </span>
      </div>
      <div className="grid gap-2">
        {diffs.map((d, i) => (
          <div key={i} className="flex items-start gap-3 text-xs">
            <span className="shrink-0 w-32 text-muted-foreground capitalize">{d.label}</span>
            <div className="flex flex-wrap gap-2">
              {d.cells.map((cell, ci) => (
                <span key={ci} className="flex items-center gap-1">
                  <span className="font-semibold text-foreground truncate max-w-[12rem]">{cell}</span>
                  {ci < compared.length - 1 && <span className="text-muted-foreground/40">·</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Group section ────────────────────────────────────────────────────────────

function GroupSection({
  label,
  icon,
  rows,
  cols,
  diffOnly,
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
        className="grid border-t border-border bg-surface-alt/60"
        style={{ gridTemplateColumns: `14rem repeat(${cols}, 1fr)` }}
      >
        <div className="px-4 py-2 col-span-full flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">{label}</span>
        </div>
      </div>

      {/* Spec rows */}
      {rows.map((row, i) => (
        <div
          key={`${row.label}-${i}`}
          className={`grid border-t border-border ${row.isDifferent ? "bg-amber-50/60 dark:bg-amber-950/10" : "odd:bg-surface-alt/20"}`}
          style={{ gridTemplateColumns: `14rem repeat(${cols}, 1fr)` }}
        >
          {/* Label */}
          <div className="px-4 py-3 border-r border-border flex items-start gap-1.5">
            <span className="text-xs text-muted-foreground capitalize leading-snug">{row.label}</span>
            {row.isDifferent && (
              <span className="shrink-0 size-1.5 rounded-full bg-amber-400 mt-1" title="Skiljer sig" />
            )}
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

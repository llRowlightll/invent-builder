import { createFileRoute, Link, notFound } from "@tanstack/react-router";
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
  exploded_url: string | null;
  notes: string | null;
}

interface AssemblyPart {
  id: string;
  position_number: number;
  position_label: string | null;
  part_name: string;
  part_number: string | null;
  alt_part_number: string | null;
  part_type: string;
  service_category: string | null;
  product_family: string | null;
  product_sku_ref: string | null;
  description: string | null;
  material: string | null;
  quantity: number;
  is_orderable: boolean;
  is_service_item: boolean;
  lead_time_days: number | null;
  hotspot_x: number | null;
  hotspot_y: number | null;
  notes: string | null;
}

const PART_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  component:        { label: "Component",       color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  seal:             { label: "Seal",            color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  wear_part:        { label: "Wear part",       color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  service_kit:      { label: "Service kit",     color: "bg-green-500/10 text-green-400 border-green-500/20" },
  standard_hardware:{ label: "Hardware",        color: "bg-muted text-muted-foreground border-border" },
  assembly:         { label: "Sub-assembly",    color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

export const Route = createFileRoute("/$locale/assembly/$slug")({
  component: AssemblyPage,
  notFoundComponent: () => (
    <div className="container-page py-16 text-sm">Assembly not found.</div>
  ),
});

function AssemblyPage() {
  const { locale, slug } = Route.useParams();
  const t = makeT(locale as Locale);
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [parts, setParts] = useState<AssemblyPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePos, setActivePos] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | "orderable" | "service">("all");
  const [rfqItems, setRfqItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: asm } = await supabase
        .from("assemblies")
        .select("*")
        .eq("slug", slug)
        .single();
      if (!asm) { setLoading(false); return; }
      setAssembly(asm);

      const { data: pts } = await supabase
        .from("assembly_parts")
        .select("*")
        .eq("assembly_id", asm.id)
        .order("position_number");
      setParts(pts ?? []);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return (
    <div className="container-page py-16 text-sm text-muted-foreground">{t("common.loading")}</div>
  );
  if (!assembly) throw notFound();

  const filtered = parts.filter((p) => {
    if (filterType === "orderable") return p.is_orderable;
    if (filterType === "service") return p.is_service_item;
    return true;
  });

  const serviceItems = parts.filter((p) => p.is_service_item);
  const orderableItems = parts.filter((p) => p.is_orderable);

  function toggleRfq(partId: string) {
    setRfqItems((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId); else next.add(partId);
      return next;
    });
  }

  const rfqParts = parts.filter((p) => rfqItems.has(p.id));

  return (
    <div className="container-page py-8 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
        <Link to="/$locale/assemblies" params={{ locale }} className="hover:text-info">
          Assemblies
        </Link>
        <span>/</span>
        <span className="text-foreground">{assembly.name}</span>
      </div>

      {/* Header */}
      <div className="grid md:grid-cols-[1fr_320px] gap-6 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-info">
              {assembly.brand}
            </span>
            {assembly.standard && (
              <span className="font-mono text-xs text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                {assembly.standard}
              </span>
            )}
            {assembly.subcategory && (
              <span className="text-xs text-muted-foreground">{assembly.subcategory}</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{assembly.name}</h1>
          {assembly.model_number && (
            <div className="font-mono text-xs text-muted-foreground mt-1">{assembly.model_number}</div>
          )}
          {assembly.description && (
            <p className="mt-3 text-sm text-foreground/80 leading-relaxed max-w-xl">
              {assembly.description}
            </p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 mt-4">
            <Stat label="Total parts" value={parts.length} />
            <Stat label="Orderable" value={orderableItems.length} accent />
            <Stat label="Service items" value={serviceItems.length} />
          </div>
        </div>

        {/* Exploded view image or placeholder */}
        <div className="rounded-xl border border-border bg-surface-alt overflow-hidden aspect-square relative">
          {assembly.exploded_url ? (
            <>
              <img src={assembly.exploded_url} alt="Exploded view" className="w-full h-full object-contain p-4" />
              {/* Hotspot overlays */}
              {parts
                .filter((p) => p.hotspot_x != null && p.hotspot_y != null)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePos(p.position_number === activePos ? null : p.position_number)}
                    style={{ left: `${p.hotspot_x}%`, top: `${p.hotspot_y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 text-[10px] font-bold flex items-center justify-center transition-all ${
                      activePos === p.position_number
                        ? "bg-info border-info text-white scale-125"
                        : "bg-background border-muted-foreground text-foreground hover:border-info hover:text-info"
                    }`}
                  >
                    {p.position_number}
                  </button>
                ))}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6">
              <svg className="w-16 h-16 text-muted-foreground/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8}
                  d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              <p className="text-xs text-muted-foreground text-center">
                Exploded view image<br />can be uploaded here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RFQ bar */}
      {rfqItems.size > 0 && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-info/30 bg-info/5 px-4 py-3">
          <div className="text-sm font-medium text-foreground">
            {rfqItems.size} part{rfqItems.size > 1 ? "s" : ""} selected for RFQ
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRfqItems(new Set())}
              className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:border-info hover:text-info transition"
            >
              Clear
            </button>
            <Link
              to="/$locale/rfq/$rfqId"
              params={{ locale, rfqId: "new" }}
              search={{ parts: rfqParts.map((p) => p.part_number ?? p.part_name).join(",") } as never}
              className="text-xs px-3 py-1.5 rounded bg-info text-primary-foreground hover:opacity-90 transition"
            >
              Create RFQ →
            </Link>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {(["all", "orderable", "service"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
              filterType === f
                ? "bg-info text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? `All parts (${parts.length})` : f === "orderable" ? `Orderable (${orderableItems.length})` : `Service items (${serviceItems.length})`}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              const ids = new Set(orderableItems.map((p) => p.id));
              setRfqItems(ids);
            }}
            className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:border-info hover:text-info transition"
          >
            Select all orderable
          </button>
        </div>
      </div>

      {/* Parts table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              <th className="p-3 text-left text-xs text-muted-foreground font-medium w-8">#</th>
              <th className="p-3 text-left text-xs text-muted-foreground font-medium">Part name</th>
              <th className="p-3 text-left text-xs text-muted-foreground font-medium hidden md:table-cell">Part number</th>
              <th className="p-3 text-left text-xs text-muted-foreground font-medium hidden lg:table-cell">Type</th>
              <th className="p-3 text-left text-xs text-muted-foreground font-medium hidden lg:table-cell">Material</th>
              <th className="p-3 text-center text-xs text-muted-foreground font-medium w-12">Qty</th>
              <th className="p-3 text-center text-xs text-muted-foreground font-medium w-20">Status</th>
              <th className="p-3 text-center text-xs text-muted-foreground font-medium w-12">RFQ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const typeInfo = PART_TYPE_LABELS[p.part_type] ?? { label: p.part_type, color: "bg-muted text-muted-foreground border-border" };
              const isActive = activePos === p.position_number;
              return (
                <tr
                  key={p.id}
                  onClick={() => setActivePos(isActive ? null : p.position_number)}
                  className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                    isActive
                      ? "bg-info/5 border-info/20"
                      : "hover:bg-surface-alt/50"
                  }`}
                >
                  <td className="p-3">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border ${
                      isActive ? "bg-info text-white border-info" : "border-border text-muted-foreground"
                    }`}>
                      {p.position_number}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-foreground flex items-center gap-1.5">
                      {p.part_name}
                      {p.is_service_item && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                          Service
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</div>
                    )}
                    {p.notes && isActive && (
                      <div className="text-xs text-info mt-1 italic">{p.notes}</div>
                    )}
                    {/* Show part number on mobile */}
                    {p.part_number && (
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5 md:hidden">{p.part_number}</div>
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    {p.part_number ? (
                      <span className="font-mono text-xs text-foreground">{p.part_number}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {p.alt_part_number && (
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{p.alt_part_number}</div>
                    )}
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">{p.material ?? "—"}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-xs font-medium text-foreground">{p.quantity}</span>
                  </td>
                  <td className="p-3 text-center">
                    {p.is_orderable ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                        Order
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
                        N/A
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {p.is_orderable && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleRfq(p.id); }}
                        className={`w-5 h-5 rounded border flex items-center justify-center mx-auto transition ${
                          rfqItems.has(p.id)
                            ? "bg-info border-info text-white"
                            : "border-border hover:border-info"
                        }`}
                      >
                        {rfqItems.has(p.id) && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Service kit callout */}
      {serviceItems.length > 0 && (
        <div className="mt-6 rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="text-sm font-semibold text-foreground mb-2">⚡ Recommended service items</div>
          <div className="flex flex-wrap gap-2">
            {serviceItems.filter((p) => p.is_orderable).map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground w-4 font-mono">{p.position_number}</span>
                <span className="font-medium text-foreground">{p.part_name}</span>
                {p.part_number && (
                  <span className="font-mono text-muted-foreground">{p.part_number}</span>
                )}
                <button
                  onClick={() => toggleRfq(p.id)}
                  className={`ml-1 text-[10px] px-2 py-0.5 rounded transition ${
                    rfqItems.has(p.id)
                      ? "bg-info text-white"
                      : "border border-border text-muted-foreground hover:border-info hover:text-info"
                  }`}
                >
                  {rfqItems.has(p.id) ? "Added" : "+ RFQ"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={`text-lg font-semibold ${accent ? "text-info" : "text-foreground"}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

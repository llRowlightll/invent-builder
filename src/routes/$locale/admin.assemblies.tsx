/**
 * Admin — placera hotspots på en sprängskiss.
 *
 * Steg 5 av maskinmodellen. Visningsvyn (assembly.$slug.tsx) var redan byggd
 * och renderar hotspots, men innehållet gick inte att skapa: assemblies och
 * assembly_parts hade bara select-policies, så 29 inlagda delar stod med noll
 * hotspots, noll sprängskisser och noll kopplingar till katalogen.
 *
 * KOORDINATKONVENTIONEN ÄR KRITISK. Visningsvyn positionerar varje hotspot med
 * `left: ${hotspot_x}%; top: ${hotspot_y}%` inuti en `aspect-square`-container
 * där bilden ligger med `object-contain`. Procenten gäller alltså CONTAINERN,
 * inte bilden -- är bilden inte kvadratisk ligger den brevlådad inuti, och
 * skillnaden är flera procentenheter.
 *
 * Därför använder den här editorn exakt samma containergeometri och räknar
 * klicket mot containerns rektangel. Ändras den ena måste den andra ändras
 * likadant, annars hamnar hotspotsen fel för besökaren utan att se fel här.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// @ts-ignore — samma mönster som övriga admin-routes
export const Route = createFileRoute("/$locale/admin/assemblies")({
  component: AdminAssembliesPage,
});

type Assembly = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  exploded_url: string | null;
};

type Part = {
  id: string;
  position_number: number;
  part_name: string;
  part_number: string | null;
  part_type: string | null;
  hotspot_x: number | null;
  hotspot_y: number | null;
};

export default function AdminAssembliesPage() {
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [current, setCurrent] = useState<Assembly | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [status, setStatus] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("assemblies").select("id,slug,name,brand,exploded_url").order("name")
      .then(({ data }) => setAssemblies((data ?? []) as Assembly[]));
  }, []);

  async function open(a: Assembly) {
    setCurrent(a);
    setUrlDraft(a.exploded_url ?? "");
    setActiveId(null);
    setStatus("");
    const { data } = await supabase
      .from("assembly_parts")
      .select("id,position_number,part_name,part_number,part_type,hotspot_x,hotspot_y")
      .eq("assembly_id", a.id)
      .order("position_number");
    setParts((data ?? []) as Part[]);
  }

  async function saveUrl() {
    if (!current) return;
    const url = urlDraft.trim() || null;
    const { error } = await supabase.from("assemblies").update({ exploded_url: url }).eq("id", current.id);
    if (error) { setStatus(`Kunde inte spara bild-URL: ${error.message}`); return; }
    setCurrent({ ...current, exploded_url: url });
    setAssemblies(as => as.map(a => (a.id === current.id ? { ...a, exploded_url: url } : a)));
    setStatus("Bild-URL sparad.");
  }

  /** Klick på bilden placerar hotspot för den valda delen. */
  async function place(e: React.MouseEvent<HTMLDivElement>) {
    if (!activeId || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    // Mot containern, inte mot bilden — se filhuvudet.
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    const round = (n: number) => Math.round(n * 10) / 10;
    const { error } = await supabase.from("assembly_parts")
      .update({ hotspot_x: round(x), hotspot_y: round(y) }).eq("id", activeId);
    if (error) { setStatus(`Kunde inte spara: ${error.message}`); return; }
    setParts(ps => ps.map(p => (p.id === activeId ? { ...p, hotspot_x: round(x), hotspot_y: round(y) } : p)));
    // Hoppa vidare till nästa oplacerade del — annars blir 15 delar 15 klick
    // plus 15 val i listan.
    const rest = parts.filter(p => p.id !== activeId && p.hotspot_x == null);
    setActiveId(rest[0]?.id ?? null);
    setStatus(rest.length ? `Placerad. Nästa: ${rest[0].position_number}. ${rest[0].part_name}` : "Alla delar placerade.");
  }

  async function clearSpot(id: string) {
    const { error } = await supabase.from("assembly_parts")
      .update({ hotspot_x: null, hotspot_y: null }).eq("id", id);
    if (error) { setStatus(`Kunde inte rensa: ${error.message}`); return; }
    setParts(ps => ps.map(p => (p.id === id ? { ...p, hotspot_x: null, hotspot_y: null } : p)));
  }

  const placed = parts.filter(p => p.hotspot_x != null).length;

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Sprängskisser</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Välj ett aggregat, ange bildens URL, och klicka på bilden för att placera varje del.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {assemblies.map(a => (
          <button
            key={a.id}
            onClick={() => open(a)}
            className={`text-sm px-3 py-1.5 rounded-md border transition ${
              current?.id === a.id ? "border-info bg-info/10 text-info" : "border-border hover:border-info"
            }`}
          >
            {a.name}
            {!a.exploded_url && <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400">ingen bild</span>}
          </button>
        ))}
      </div>

      {current && (
        <>
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <input
              value={urlDraft}
              onChange={e => setUrlDraft(e.target.value)}
              placeholder="URL till sprängskissen (t.ex. tillverkarens ritning)"
              className="flex-1 min-w-[280px] px-3 py-2 rounded-lg border border-input bg-background text-sm"
            />
            <button onClick={saveUrl} className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90">
              Spara bild-URL
            </button>
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-5">
            {/* Samma geometri som assembly.$slug.tsx — se filhuvudet. */}
            <div
              ref={boxRef}
              onClick={place}
              className={`rounded-xl border border-border bg-surface-alt overflow-hidden aspect-square relative ${
                activeId ? "cursor-crosshair" : ""
              }`}
            >
              {current.exploded_url ? (
                <img src={current.exploded_url} alt="" className="w-full h-full object-contain p-4 pointer-events-none" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-6 text-sm text-muted-foreground text-center">
                  Ange en bild-URL ovan för att kunna placera hotspots.
                </div>
              )}
              {parts.filter(p => p.hotspot_x != null).map(p => (
                <span
                  key={p.id}
                  style={{ left: `${p.hotspot_x}%`, top: `${p.hotspot_y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 text-[10px] font-bold flex items-center justify-center pointer-events-none ${
                    activeId === p.id ? "bg-info border-info text-white scale-125" : "bg-background border-muted-foreground text-foreground"
                  }`}
                >
                  {p.position_number}
                </span>
              ))}
            </div>

            <aside>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Delar</span>
                <span className="text-xs text-muted-foreground">{placed} av {parts.length} placerade</span>
              </div>
              <ul className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
                {parts.map(p => (
                  <li key={p.id}>
                    <div className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                      activeId === p.id ? "border-info bg-info/5" : "border-border"
                    }`}>
                      <button onClick={() => setActiveId(activeId === p.id ? null : p.id)} className="flex-1 text-left min-w-0">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{p.position_number}</span>
                        <span className="truncate">{p.part_name}</span>
                        {p.part_number && (
                          <span className="block font-mono text-[10px] text-muted-foreground truncate">{p.part_number}</span>
                        )}
                      </button>
                      {p.hotspot_x != null ? (
                        <button onClick={() => clearSpot(p.id)} title="Ta bort hotspot"
                          className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-destructive hover:border-destructive">
                          rensa
                        </button>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">saknas</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {status && <p className="mt-3 text-xs text-muted-foreground">{status}</p>}
              {!activeId && parts.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Välj en del i listan, klicka sedan på bilden. Editorn går vidare till nästa oplacerade del automatiskt.
                </p>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

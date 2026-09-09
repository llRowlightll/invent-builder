/**
 * Maskinschema — ritar stycklistan som ett kopplat schema i stället för en lista.
 *
 * Läser exakt den graf groq-advisor levererar (steg 1): noder ur bom-raderna,
 * kanter ur connections. Ingenting härleds här -- kommer en kant inte från
 * servern ritas den inte, så schemat kan aldrig visa en koppling som
 * stycklistan inte innehåller.
 *
 * Layout: kolumner efter komponenttyp, i den ordning ett pneumatikschema
 * faktiskt läses -- luftberedning till vänster, aktuatorn till höger, givare
 * sist. Medvetet fast i stället för en kraftbaserad algoritm: en ingenjör ska
 * känna igen bilden, och samma stycklista ska ge samma bild varje gång.
 */
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, ViewportPortal, applyNodeChanges,
  type Node, type Edge, type NodeProps, type NodeChange, Handle, Position, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export interface CanvasBomLine {
  sku: string;
  quantity: number;
  role: string;
  reason: string;
  kind?: string;
  subsystem?: string | null;
  product?: { name: string; brand?: { name: string }; category?: { name: string } } | null;
}

export interface CanvasConnection {
  fromIndex: number;
  toIndex: number;
  relation: string;
}

/** Läsordning i ett pneumatikschema. Lägre = längre till vänster. Typer som
 *  saknas här hamnar sist, vilket är rätt för framtida komponenttyper: hellre
 *  synliga i utkanten än osynliga. */
const COLUMN: Record<string, number> = {
  frl: 0, tubing: 0, fitting: 0,
  valve_terminal: 1, silencer: 1, drive: 1,
  valve: 2, flow_control: 2, check_valve: 2, motor: 2,
  actuator: 3, rod_lock: 3, mount: 3, shock_absorber: 3,
  sensor: 4, cable: 4,
};

/** Delsystemens visningsnamn. Nycklarna är serverns egna (deriveSubsystems). */
const SUBSYSTEM_LABEL: Record<string, { sv: string; en: string }> = {
  air_prep: { sv: "Luftberedning", en: "Air preparation" },
  main:     { sv: "Maskin",        en: "Machine" },
  axis_x:   { sv: "X-axel",        en: "X axis" },
  axis_y:   { sv: "Y-axel",        en: "Y axis" },
  axis_z:   { sv: "Z-axel",        en: "Z axis" },
};

const RELATION_LABEL: Record<string, string> = {
  air_supply: "matas från",
  controlled_by: "styrs av",
  mounted_on: "sitter på",
  senses: "avkänner",
  accessory: "tillbehör",
  requires: "kräver",
};

/** Aktuatorn är maskinens kärna och ska synas som det. Luftberedning och
 *  givare är stödfunktioner och tonas ned. */
function accentFor(kind?: string): string {
  if (kind === "actuator") return "border-info bg-info/10";
  if (kind === "valve" || kind === "valve_terminal") return "border-border bg-card";
  if (kind === "sensor") return "border-border bg-muted/40";
  return "border-border bg-card";
}

type ComponentNodeData = {
  line: CanvasBomLine;
  index: number;
  selected: boolean;
  onPick: (i: number) => void;
};

function ComponentNode({ data }: NodeProps<Node<ComponentNodeData>>) {
  const { line, index, selected, onPick } = data;
  const missing = line.sku === "SPECIFY";
  return (
    <div
      onClick={() => onPick(index)}
      className={`rounded-lg border px-3 py-2 w-52 cursor-pointer transition shadow-sm ${accentFor(line.kind)} ${
        selected ? "ring-2 ring-info" : "hover:border-info/60"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-1.5 !h-1.5 !border-0" />
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{line.kind ?? "komponent"}</div>
      <div className="text-xs font-medium text-foreground leading-snug line-clamp-2">{line.role}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={`font-mono text-[10px] truncate ${missing ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
          {missing ? "specificeras" : line.sku}
        </span>
        {line.quantity > 1 && (
          <span className="text-[10px] font-medium text-muted-foreground shrink-0">×{line.quantity}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-1.5 !h-1.5 !border-0" />
    </div>
  );
}

type GroupNodeData = {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
};

/** Ihopfällt delsystem: EN nod som står för hela gruppen. Kanter som korsade
 *  gränsen flyttas hit av remapEndpoint(), så maskinen hänger ihop även på
 *  delsystemsnivå -- det är det som gör zoomen meningsfull i stället för att
 *  bara dölja saker. */
function CollapsedGroupNode({ data }: NodeProps<Node<GroupNodeData>>) {
  return (
    <div
      onClick={data.onToggle}
      className="rounded-lg border-2 border-dashed border-info/50 bg-info/5 px-4 py-3 w-52 cursor-pointer hover:border-info transition shadow-sm"
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-1.5 !h-1.5 !border-0" />
      <div className="text-[10px] uppercase tracking-wider text-info">delsystem</div>
      <div className="text-xs font-medium text-foreground">{data.label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {data.count} {data.count === 1 ? "komponent" : "komponenter"} — klicka för att fälla ut
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-1.5 !h-1.5 !border-0" />
    </div>
  );
}

/**
 * Utfällt delsystem: en ram bakom sina komponenter.
 *
 * Medvetet INTE en React Flow-nod. En ram är dekoration, inte en del av
 * grafen -- den har inga kanter och deltar inte i topologin, och ViewportPortal
 * ritar i flödets koordinatsystem utan att röra nodgrafen.
 *
 * RÄTTELSE 2026-09-09: en tidigare version av den här kommentaren påstod att
 * ramen som NOD bröt React Flows initiering, "verifierat: 6 kanter utan ramen,
 * 0 med". Det påståendet var fel. Det mättes när webbläsarpanelen rapporterade
 * noll bredd, och en kontroll med frisk viewport visar att kanterna uteblir
 * lika mycket med ramarna helt avstängda. Ramarna är alltså oskyldiga; se
 * KÄNT PROBLEM längst ned i filen.
 */
function SubsystemFrame({ x, y, width, height, label, onToggle }: {
  x: number; y: number; width: number; height: number; label: string; onToggle: () => void;
}) {
  return (
    <div
      className="absolute rounded-xl border border-dashed border-border bg-muted/20"
      style={{ left: x, top: y, width, height, pointerEvents: "none" }}
    >
      <button
        onClick={onToggle}
        style={{ pointerEvents: "auto" }}
        className="absolute -top-2.5 left-3 px-2 py-0.5 rounded bg-card border border-border text-[10px] uppercase tracking-wider text-muted-foreground hover:text-info hover:border-info transition"
      >
        {label} — fäll ihop
      </button>
    </div>
  );
}

const nodeTypes = { component: ComponentNode, groupCollapsed: CollapsedGroupNode };


const NODE_W = 208;
const NODE_H = 84;
const COL_GAP = 250;
const ROW_GAP = 104;
const BAND_PAD = 34;

export default function MachineCanvas({
  bom, connections, isSv,
}: {
  bom: CanvasBomLine[];
  connections: CanvasConnection[];
  isSv: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const onPick = useCallback((i: number) => setPicked(p => (p === i ? null : i)), []);
  const toggle = useCallback((sub: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(sub)) next.delete(sub); else next.add(sub);
    return next;
  }), []);

  // Varningsrader är annotationer, inte komponenter -- servern ger dem aldrig
  // kanter, och de ritas som en lista under schemat i stället för som noder.
  const warnings = useMemo(() => bom.filter(l => l.kind === "warning"), [bom]);

  /**
   * Delsystem i läsordning: luftberedningen först (den matar allt annat),
   * sedan maskinen, sedan axlarna. Varje delsystem får ett eget vågrätt band,
   * och inom bandet placeras komponenterna i kolumner efter typ -- så behåller
   * schemat sin igenkännbara luftväg samtidigt som hierarkin blir synlig.
   */
  const layout = useMemo(() => {
    const order = (sub: string) => (sub === "air_prep" ? 0 : sub === "main" ? 1 : 2);
    const subs = [...new Set(bom.filter(l => l.kind !== "warning").map(l => l.subsystem ?? "main"))]
      .sort((a, b) => order(a) - order(b) || a.localeCompare(b));

    const bands = new Map<string, { y: number; height: number; members: number[] }>();
    const pos = new Map<number, { x: number; y: number }>();
    let cursorY = 0;

    for (const sub of subs) {
      const members = bom.map((l, i) => ({ l, i }))
        .filter(x => x.l.kind !== "warning" && (x.l.subsystem ?? "main") === sub)
        .map(x => x.i);
      const perColumn = new Map<number, number>();
      let rows = 1;
      for (const i of members) {
        const col = COLUMN[bom[i].kind ?? ""] ?? 5;
        const row = perColumn.get(col) ?? 0;
        perColumn.set(col, row + 1);
        rows = Math.max(rows, row + 1);
        pos.set(i, { x: col * COL_GAP, y: cursorY + BAND_PAD + row * ROW_GAP });
      }
      const height = BAND_PAD + rows * ROW_GAP;
      bands.set(sub, { y: cursorY, height, members });
      cursorY += height + 26;
    }
    return { subs, bands, pos };
  }, [bom]);

  const nodes = useMemo<Node[]>(() => {
    const out: Node[] = [];
    const label = (sub: string) =>
      SUBSYSTEM_LABEL[sub]?.[isSv ? "sv" : "en"] ?? sub;

    for (const sub of layout.subs) {
      const band = layout.bands.get(sub)!;
      const isCollapsed = collapsed.has(sub);
      // Ett delsystem med en enda komponent är ingen hierarki -- att rita en
      // ram runt den hade varit brus. Den komponenten står för sig själv.
      const showFrame = band.members.length > 1;

      if (isCollapsed && showFrame) {
        out.push({
          id: `grp-${sub}`,
          type: "groupCollapsed",
          width: NODE_W, height: NODE_H,
          position: { x: 0, y: band.y + BAND_PAD },
          data: { label: label(sub), count: band.members.length, collapsed: true, onToggle: () => toggle(sub) },
        });
        continue; // barnen ritas inte alls när gruppen är ihopfälld
      }

      for (const i of band.members) {
        out.push({
          id: String(i),
          type: "component",
          // Explicit storlek i stället för att låta React Flow mäta.
          // Verifierat i webbläsaren 2026-09-09: utan detta fick noderna aldrig
          // `measured` i v12:s store, låg kvar med visibility:hidden trots
          // korrekt layout (offsetWidth 208), fitView kördes aldrig
          // (viewport-transform kvar på identitet), och kantlagret innehöll
          // bara pilspetsens marker-definition utan en enda bana -- kanter kan
          // inte beräknas mot omätta noder.
          // Korten har ändå fast bredd (w-52 = 208px) och layouten är
          // deterministisk, så detta är den dokumenterade vägen för noder med
          // känd storlek, inte en genväg förbi ett symptom.
          width: NODE_W, height: NODE_H,
          // Färskt objekt per render: React Flow muterar noders position
          // internt, och en delad referens ur den memoiserade layouten skulle
          // matas tillbaka muterad nästa render.
          position: { ...layout.pos.get(i)! },
          data: { line: bom[i], index: i, selected: picked === i, onPick },
        });
      }
    }
    return out;
  }, [bom, layout, collapsed, picked, onPick, toggle, isSv]);

  /** Ramarna ritas som overlay i flödets koordinatsystem, inte som noder. */
  const frames = useMemo(() => {
    const maxCol = Math.max(0, ...bom.filter(l => l.kind !== "warning").map(l => COLUMN[l.kind ?? ""] ?? 5));
    return layout.subs.flatMap(sub => {
      const band = layout.bands.get(sub)!;
      // Ett delsystem med en enda komponent är ingen hierarki -- en ram runt
      // den hade varit brus.
      if (band.members.length <= 1 || collapsed.has(sub)) return [];
      return [{
        sub,
        x: -16,
        y: band.y,
        width: maxCol * COL_GAP + NODE_W + 32,
        height: band.height + 12,
        label: SUBSYSTEM_LABEL[sub]?.[isSv ? "sv" : "en"] ?? sub,
      }];
    });
  }, [bom, layout, collapsed, isSv]);

  const edges = useMemo<Edge[]>(() => {
    const drawn = new Set(nodes.map(n => n.id));
    /** En ändpunkt inuti ett ihopfällt delsystem ersätts av gruppnoden, så
     *  kanten överlever ihopfällningen i stället för att försvinna. */
    const remapEndpoint = (index: number): string | null => {
      const sub = bom[index]?.subsystem ?? "main";
      if (collapsed.has(sub) && drawn.has(`grp-${sub}`)) return `grp-${sub}`;
      return drawn.has(String(index)) ? String(index) : null;
    };

    const seen = new Set<string>();
    return connections.flatMap((c, i) => {
      const source = remapEndpoint(c.toIndex);
      const target = remapEndpoint(c.fromIndex);
      // Kant vars ändpunkt inte ritats alls (t.ex. en varningsrad) hoppas över
      // hellre än att ge React Flow ett id som inte finns.
      if (!source || !target) return [];
      // Båda ändarna i samma ihopfällda grupp = en intern koppling. Den blir en
      // självlänk på gruppnoden och ska inte ritas.
      if (source === target) return [];
      // Två kanter kan kollapsa till samma par när en grupp fälls ihop.
      const key = `${source}->${target}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id: `e${i}`,
        // Riktningen i datan är beroende -> det den beror på. I schemat vill
        // ögat följa flödet åt andra hållet (luften går FRÅN beredningen), så
        // pilen vänds medvetet: source = det man beror på.
        source,
        target,
        label: RELATION_LABEL[c.relation] ?? c.relation,
        labelStyle: { fontSize: 10, fill: "var(--muted-foreground, #888)" },
        labelBgStyle: { fill: "var(--background, #fff)", fillOpacity: 0.85 },
        style: { strokeWidth: 1.4 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        animated: c.relation === "air_supply",
      }];
    });
  }, [connections, nodes, bom, collapsed]);

  /**
   * React Flow v12 mäter varje nod med en ResizeObserver och skriver resultatet
   * som en `dimensions`-ändring. Med en KONTROLLERAD `nodes`-prop och ingen
   * onNodesChange kastas den ändringen bort -- noden får aldrig `measured`, och
   * v12 håller då kvar `visibility: hidden` på den och kan inte räkna ut var
   * kanterna ska börja och sluta.
   *
   * Symptomet var att alla tio noderna låg i DOM med korrekt storlek och
   * transform, men var osynliga, och att kantlagret bara innehöll pilspetsens
   * marker-definition utan en enda bana. Verifierat i webbläsaren 2026-09-09.
   *
   * Noderna härleds fortfarande helt ur props; den här spegeln finns bara för
   * att låta React Flow skriva tillbaka sina egna mätvärden. Därför ersätts
   * spegeln när den härledda listan ändras, i stället för att slås ihop.
   */
  const [flowNodes, setFlowNodes] = useState<Node[]>(nodes);
  useEffect(() => { setFlowNodes(nodes); }, [nodes]);
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setFlowNodes(prev => applyNodeChanges(changes, prev)),
    [],
  );

  const sel = picked !== null ? bom[picked] : null;

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {isSv ? "Inget schema att visa för den här stycklistan." : "No schematic to show for this bill of materials."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid lg:grid-cols-[1fr_280px] gap-3">
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ height: 460 }}>
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
            maxZoom={1.6}
            proOptions={{ hideAttribution: false }}
            nodesDraggable={false}
            nodesConnectable={false}
            onPaneClick={() => setPicked(null)}
          >
            <ViewportPortal>
              {frames.map(f => (
                <SubsystemFrame key={f.sub} {...f} onToggle={() => toggle(f.sub)} />
              ))}
            </ViewportPortal>
            <Background gap={18} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-muted" />
          </ReactFlow>
        </div>

        <aside className="rounded-xl border border-border bg-card p-4 text-sm">
          {sel ? (
            <>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{sel.kind}</div>
              <div className="font-medium text-foreground mb-2 leading-snug">{sel.role}</div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{isSv ? "Artikelnr" : "Part no."}</dt>
                  <dd className="font-mono text-right">{sel.sku === "SPECIFY" ? (isSv ? "specificeras" : "to specify") : sel.sku}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{isSv ? "Antal" : "Qty"}</dt>
                  <dd>{sel.quantity}</dd>
                </div>
                {sel.product?.brand?.name && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{isSv ? "Fabrikat" : "Brand"}</dt>
                    <dd className="text-right">{sel.product.brand.name}</dd>
                  </div>
                )}
                {sel.subsystem && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{isSv ? "Delsystem" : "Subsystem"}</dt>
                    <dd className="text-right">{sel.subsystem}</dd>
                  </div>
                )}
              </dl>
              {sel.reason && (
                <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground leading-relaxed">{sel.reason}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isSv
                ? "Klicka på en komponent för att se artikelnummer, antal och varför den ingår."
                : "Click a component to see its part number, quantity and why it is included."}
            </p>
          )}
        </aside>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            {isSv ? "Gäller hela maskinen" : "Applies to the whole machine"}
          </div>
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-foreground leading-relaxed">{w.role}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * KÄNT PROBLEM — kanterna renderas inte (2026-09-09, oläst)
 *
 * Noderna ritas korrekt, men React Flow ritar noll kanter och kör aldrig
 * fitView (viewportens transform stannar på identitet). Undersökt i
 * webbläsaren mot en riktig stycklista; följande är MÄTT, inte antaget:
 *
 *   • Servern ger 8 kopplingar med giltiga index (0-6 av 9 rader).
 *   • Komponenten tar emot dem: connections=8, drawn={0..8}, collapsed=tom.
 *     edges-arrayen som skickas in är alltså INTE tom -- åtta kanter går in
 *     och noll element kommer ut.
 *   • Handtagen finns i DOM:en, 2 per nod, 6x6 px, rätt klasser.
 *   • React Flows egen CSS är laddad; noderna har position:absolute och rätt
 *     transform.
 *   • @xyflow/react 12.11.6 mot React 19.2.6 -- inom deklarerat peer-stöd.
 *
 * Uteslutet genom kontrollexperiment, inte resonemang:
 *   1. Delsystemsramarna i ViewportPortal. Helt avstängda: fortfarande 0.
 *   2. Saknad onNodesChange på en kontrollerad nodes-prop. Tillagd: 0.
 *   3. Omätta noder. Explicita width/height löste SYNLIGHETEN (9 av 9 noder
 *      låg tidigare kvar med visibility:hidden) men gav fortfarande 0 kanter.
 *   4. Omätta handtagsbounds. useUpdateNodeInternals på varje nod: 0.
 *
 * Punkt 3 är kvar i koden eftersom den fixade en verklig bugg: utan den var
 * hela schemat osynligt, inte bara kanterna. Punkt 2 är kvar för att den är
 * korrekt för en kontrollerad graf.
 *
 * Nästa steg vore att rendera ett minimalt React Flow med två hårdkodade noder
 * och en kant i samma app -- fungerar det är felet i den här komponenten,
 * fungerar det inte är det integrationen med React 19 i det här bygget.
 * ────────────────────────────────────────────────────────────────────────── */

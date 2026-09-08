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
import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeProps, Handle, Position, MarkerType,
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

const nodeTypes = { component: ComponentNode };

export default function MachineCanvas({
  bom, connections, isSv,
}: {
  bom: CanvasBomLine[];
  connections: CanvasConnection[];
  isSv: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const onPick = useCallback((i: number) => setPicked(p => (p === i ? null : i)), []);

  // Varningsrader är annotationer, inte komponenter -- servern ger dem aldrig
  // kanter, och de ritas som en lista under schemat i stället för som noder.
  const warnings = useMemo(() => bom.filter(l => l.kind === "warning"), [bom]);

  const nodes = useMemo<Node<ComponentNodeData>[]>(() => {
    const perColumn = new Map<number, number>();
    return bom.flatMap((line, index) => {
      if (line.kind === "warning") return [];
      const col = COLUMN[line.kind ?? ""] ?? 5;
      const row = perColumn.get(col) ?? 0;
      perColumn.set(col, row + 1);
      return [{
        id: String(index),
        type: "component",
        position: { x: col * 250, y: row * 104 },
        data: { line, index, selected: picked === index, onPick },
      }];
    });
  }, [bom, picked, onPick]);

  const edges = useMemo<Edge[]>(() => {
    const drawn = new Set(nodes.map(n => n.id));
    return connections
      // En kant vars ändpunkt inte ritats (t.ex. en varningsrad) hoppas över
      // hellre än att ge React Flow ett id som inte finns.
      .filter(c => drawn.has(String(c.fromIndex)) && drawn.has(String(c.toIndex)))
      .map((c, i) => ({
        id: `e${i}`,
        // Riktningen i datan är beroende -> det den beror på. I schemat vill
        // ögat följa flödet åt andra hållet (luften går FRÅN beredningen), så
        // pilen vänds medvetet: source = det man beror på.
        source: String(c.toIndex),
        target: String(c.fromIndex),
        label: RELATION_LABEL[c.relation] ?? c.relation,
        labelStyle: { fontSize: 10, fill: "var(--muted-foreground, #888)" },
        labelBgStyle: { fill: "var(--background, #fff)", fillOpacity: 0.85 },
        style: { strokeWidth: 1.4 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        animated: c.relation === "air_supply",
      }));
  }, [connections, nodes]);

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
            nodes={nodes}
            edges={edges}
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

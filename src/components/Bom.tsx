import type { BomItem, SelectionResult } from "@/lib/types";

export function BomTable({
  result,
  highlightSku,
  onRow,
}: {
  result: SelectionResult;
  highlightSku?: string | null;
  onRow?: (sku: string) => void;
}) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-alt text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left p-3">Role</th>
            <th className="text-left p-3">SKU</th>
            <th className="text-left p-3">Name</th>
            <th className="text-right p-3">Qty</th>
            <th className="text-right p-3">Lead</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((it) => (
            <tr
              key={it.product.sku + it.role}
              onClick={() => onRow?.(it.product.sku)}
              className={`border-t border-border cursor-pointer transition-colors ${
                highlightSku === it.product.sku ? "bg-gold/15" : "hover:bg-accent"
              }`}
            >
              <td className="p-3 capitalize">{it.role}</td>
              <td className="p-3 font-mono text-xs">{it.product.sku}</td>
              <td className="p-3">
                {it.product.name}
                <div className="text-[11px] text-muted-foreground">{it.why}</div>
              </td>
              <td className="p-3 text-right">{it.qty}</td>
              <td className="p-3 text-right text-xs text-muted-foreground">
                {it.product.lead_time_days ?? "—"}d
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function bomToCsv(result: SelectionResult): string {
  const rows = [
    ["role", "sku", "name", "brand", "qty", "lead_days", "why"],
    ...result.items.map((i) => [
      i.role,
      i.product.sku,
      i.product.name,
      i.product.brand.name,
      String(i.qty),
      String(i.product.lead_time_days ?? ""),
      i.why,
    ]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function ValidationList({ items }: { items: SelectionResult["validation"] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((v, i) => (
        <li
          key={i}
          className={`px-3 py-2 rounded-md border ${
            v.level === "error"
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : v.level === "warn"
                ? "bg-warning/10 border-warning/30 text-warning-strong"
                : "bg-surface-alt border-border text-muted-foreground"
          }`}
        >
          {v.message}
        </li>
      ))}
    </ul>
  );
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function bomToEmailText(result: SelectionResult): string {
  const lines = [
    `Subject: RFQ — ${result.orderCode}`,
    ``,
    `Hello,`,
    ``,
    `Please quote the following bill of materials (order code ${result.orderCode}):`,
    ``,
    ...result.items.map((i) => `  • [${i.role}] ${i.product.sku} — ${i.product.name} × ${i.qty}`),
    ``,
    `Best regards,`,
  ];
  return lines.join("\n");
}

export type { BomItem };

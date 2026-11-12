/**
 * Gängor och slangdimensioner i stycklistans tillbehör.
 *
 * Genomgången 2026-11-12: ventilen var MFH-5-1/8-S (G1/8), men ljuddämparen
 * (U-1/4), kopplingarna (QS-G1/4-10) och strypventilerna (GRLA-1/4-QS-8)
 * valdes i G1/4, strypventilerna för Ø8-slang och slangen i Ø10. Varje rad
 * valdes för sig ur sin kategori, och raderna märktes ändå "Prövat mot
 * kraven" -- bara trycket hade prövats.
 *
 * Här läses gängan och slangens ytterdiameter ur katalogens specar (thread,
 * port, port_size, tube_od_mm) och i andra hand ur namnet ("QS-G1/8-6",
 * "GRLA-1/8-QS-6", "Ø10mm"). Valet bland kandidaterna sker i bom-builder.ts.
 */
import type { CatalogProduct } from "./scoring.ts";

/** "G1/8", "R1/4", "M5" -- eller null när gängan inte går att läsa. */
export function normGanga(v: unknown): string | null {
  const s = String(v ?? "").replace(/\s+/g, "").replace(/["”]/g, "").toUpperCase();
  if (!s) return null;
  const m = s.match(/(?:^|[^A-Z0-9])(G|R|RC|NPT)?(\d\/\d{1,2})(?![\d/])/) ?? s.match(/^(G|R|RC|NPT)?(\d\/\d{1,2})$/);
  if (m) return `${m[1] === "RC" ? "Rc" : m[1] ?? "G"}${m[2]}`;
  const metr = s.match(/(?:^|[^A-Z0-9])(M\d{1,2})(?:X[\d.]+)?(?![\d])/) ?? s.match(/^(M\d{1,2})$/);
  return metr ? metr[1] : null;
}

/** Gängans storlek utan standard: "G1/8" och "R1/8" är båda "1/8". */
export function gangstorlek(g: string | null): string | null {
  if (!g) return null;
  return g.replace(/^(G|R|Rc|NPT)/, "");
}

/** Gängan en artikel har. Specen går före namnet. */
export function gangaAv(p: CatalogProduct | null | undefined): string | null {
  if (!p) return null;
  const ks = p.key_specs ?? {};
  for (const k of ["thread", "port", "port_size"]) {
    const g = normGanga(ks[k]);
    if (g) return g;
  }
  // "QS-G1/4-10", "GRLA-1/8-QS-6", "U-1/4", "MFH-5-1/8-S"
  const namn = `${p.name ?? ""} ${p.sku ?? ""}`;
  const m = namn.match(/\bG\s?(\d\/\d{1,2})\b/i) ?? namn.match(/-(\d\/\d{1,2})(?=-|\b)/) ?? namn.match(/\b(M5|M7|M3)\b/);
  if (!m) return null;
  return /^M/i.test(m[1]) ? m[1].toUpperCase() : `G${m[1]}`;
}

/** Slangens ytterdiameter i mm som artikeln tar, eller null. */
export function slangOdAv(p: CatalogProduct | null | undefined): number | null {
  if (!p) return null;
  const v = parseFloat(String(p.key_specs?.tube_od_mm ?? "").replace(",", "."));
  if (Number.isFinite(v) && v > 0) return v;
  const namn = `${p.name ?? ""} ${p.sku ?? ""}`;
  const m = namn.match(/QS-(?:G?\d\/\d{1,2}-|M\d-)?(\d{1,2})\b/i) ?? namn.match(/[Øø]\s?(\d{1,2})\s?mm/i) ?? namn.match(/\b(\d{1,2})[xX]\d/);
  const n = m ? parseFloat(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface Onskat {
  ganga?: string | null;
  od?: number | null;
}

/**
 * Hur väl en artikel passar: 0 är exakt. Samma gängstorlek i en annan
 * standard (R1/8 mot G1/8) är nästan rätt; en annan storlek eller dimension
 * är fel. En artikel utan uppgift går före en med fel uppgift.
 */
export function portPoang(p: CatalogProduct, onskat: Onskat): number {
  let poang = 0;
  if (onskat.ganga) {
    const g = gangaAv(p);
    poang += !g ? 2 : g === onskat.ganga ? 0 : gangstorlek(g) === gangstorlek(onskat.ganga) ? 1 : 4;
  }
  if (onskat.od) {
    const od = slangOdAv(p);
    poang += od == null ? 2 : od === onskat.od ? 0 : 4;
  }
  return poang;
}

/** Bästa kandidaten för det önskade; vid lika står den första kvar. */
export function basta<T extends CatalogProduct>(kandidater: T[], onskat: Onskat): T | null {
  let ut: T | null = null;
  let bast = Infinity;
  for (const k of kandidater) {
    const p = portPoang(k, onskat);
    if (p < bast) { bast = p; ut = k; }
  }
  return ut;
}

/** Stämmer artikeln med det önskade? null när något inte går att avgöra. */
export function stammer(p: CatalogProduct | null | undefined, onskat: Onskat): boolean | null {
  if (!p) return null;
  const g = onskat.ganga ? gangaAv(p) : undefined;
  const od = onskat.od ? slangOdAv(p) : undefined;
  if ((onskat.ganga && !g) || (onskat.od && od == null)) return null;
  if (onskat.ganga && g !== onskat.ganga) return false;
  if (onskat.od && od !== onskat.od) return false;
  return true;
}

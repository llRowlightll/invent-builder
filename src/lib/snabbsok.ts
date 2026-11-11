/**
 * Sökförslag medan man skriver -- rutan i sidhuvudet.
 *
 * Konkurrenterna (Ahlsell, RS) visar artiklar, kategorier och fabrikat redan
 * efter några tecken. Maskinvals sökning fanns bara på katalogsidan och
 * startsidan, och en besökare på en produktsida hade ingen väg att söka.
 *
 * Allt räknas i webbläsaren mot den laddade katalogen: inga AI-anrop, ingen
 * Groq-kvot. Matchningen är densamma som i katalogen (matcharFraga: varje ord
 * ska finnas, svenska fackord hittar engelska benämningar), så förslagen och
 * katalogsidan aldrig säger emot varandra.
 */
import { matcharFraga } from "./sokord";
import { categoryName } from "./categories";
import type { ProductRow } from "./types";

export interface Snabbforslag {
  produkter: ProductRow[];
  kategorier: { slug: string; namn: string; antal: number }[];
  fabrikat: { slug: string; namn: string; antal: number }[];
  /** Antal träffar totalt, för "Visa alla N". */
  totalt: number;
  /** Sattes när en full orderkod föll tillbaka till serien ("DSBC-50-100" → "dsbc"). */
  familjefall: string | null;
}

function hostack(p: ProductRow): string {
  return [
    p.sku, p.name, p.name_en ?? "", p.family ?? "", p.brand.name,
    p.category.name, categoryName(p.category.slug, "sv", p.category.name), categoryName(p.category.slug, "en", p.category.name),
  ].join(" ");
}

/** "DSBC-50-100-PPSA-N3" → "dsbc". Samma regel som katalogsidan. */
export function familjeprefix(term: string): string | null {
  const forsta = term.trim().split(/[-/\s]/)[0]?.trim();
  if (!forsta || forsta.length < 2 || forsta === term.trim()) return null;
  return /^[a-z]{2,}\d*$/i.test(forsta) ? forsta.toLowerCase() : null;
}

function vikt(p: ProductRow, fraga: string): number {
  const q = fraga.trim().toLowerCase();
  const forsta = q.split(/\s+/)[0];
  const sku = p.sku.toLowerCase();
  const familj = (p.family ?? "").toLowerCase() === forsta;
  if (sku === q) return 0;
  // Seriens egen rad (FESTO-DSBC) före dess enskilda artiklar (FESTO-1463250).
  if (familj && sku.includes(forsta)) return 1;
  if (familj) return 2;
  if (sku.includes(forsta)) return 3;
  if (p.name.toLowerCase().startsWith(forsta)) return 4;
  return 5;
}

export function snabbforslag(katalog: ProductRow[], fraga: string, locale: string, max = 6): Snabbforslag {
  const tom: Snabbforslag = { produkter: [], kategorier: [], fabrikat: [], totalt: 0, familjefall: null };
  const q = fraga.trim();
  if (q.length < 2) return tom;

  let traffar = katalog.filter((p) => matcharFraga(hostack(p), q));
  let familjefall: string | null = null;
  if (traffar.length === 0) {
    const fam = familjeprefix(q);
    if (fam) {
      traffar = katalog.filter((p) => matcharFraga(hostack(p), fam));
      if (traffar.length) familjefall = fam;
    }
  }
  const sokt = familjefall ?? q;
  traffar.sort((a, b) => vikt(a, sokt) - vikt(b, sokt) || a.name.length - b.name.length || a.sku.localeCompare(b.sku));

  const raknaPer = (nyckel: (p: ProductRow) => { slug: string; namn: string }) => {
    const m = new Map<string, { slug: string; namn: string; antal: number }>();
    for (const p of traffar) {
      const k = nyckel(p);
      const r = m.get(k.slug) ?? { ...k, antal: 0 };
      r.antal++;
      m.set(k.slug, r);
    }
    return [...m.values()].sort((a, b) => b.antal - a.antal || a.namn.localeCompare(b.namn, "sv"));
  };

  return {
    produkter: traffar.slice(0, max),
    kategorier: raknaPer((p) => ({ slug: p.category.slug, namn: categoryName(p.category.slug, locale, p.category.name) })).slice(0, 3),
    fabrikat: raknaPer((p) => ({ slug: p.brand.slug, namn: p.brand.name })).slice(0, 4),
    totalt: traffar.length,
    familjefall,
  };
}

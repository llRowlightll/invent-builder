/**
 * Ersätt en komponent: känn igen den gamla och hitta motsvarigheter.
 *
 * Den vanligaste frågan på en fabrik är inte "vilken cylinder ska jag välja",
 * utan "den här gick sönder -- vad köper jag?". Kunden har ett artikelnummer
 * eller en typkod från typskylten. Vi visar samma artikel om vi har den, och
 * motsvarigheter från andra fabrikat.
 *
 * Motsvarighet betyder här SAMMA ISO-STANDARD OCH SAMMA BORRNING. ISO 15552,
 * ISO 6432 och ISO 21287 låser infästningsmåtten, så en Festo DSBC Ø32 och en
 * Parker P1D Ø32 sitter på samma fästen. För cylindrar utan standard finns
 * ingen motsvarighet i den meningen -- då säger vi det i stället för att
 * gissa.
 *
 * Igenkänningen återanvänder motorns orderkodsläsare (order-code.ts), som slår
 * upp borrningen mot familjens egen lista i stället för att gissa.
 */
import type { ProductRow } from "./types.ts";
import { readOrderCodes, type FamilyBrief } from "../../supabase/functions/groq-advisor/order-code.ts";

export type Standard = "ISO 15552" | "ISO 6432" | "ISO 21287";

export interface Identifiering {
  /** Det kunden skrev. */
  kod: string;
  /** Samma artikel i katalogen, om vi har den. */
  produkt: ProductRow | null;
  familj: string | null;
  tillverkare: string | null;
  standard: Standard | null;
  borrningMm: number | null;
  slagMm: number | null;
}

export interface Kandidat {
  produkt: ProductRow;
  /** "artikel": fast borrning och samma slag. "serie": slaget väljs vid beställning. */
  typ: "artikel" | "serie";
  /** Seriens längsta slag, när typ är "serie". */
  maxSlagMm: number | null;
}

const STANDARDBORRNINGAR = [2.5, 4, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320];
const FAMILJEPREFIX = /^(FESTO|SMC|PARKER|NORGREN|CAMOZZI|METAL[-_]WORK|MW|BOSCH|BR)-/i;

/** Bara bokstäver och siffror: "GRLA-1/4-QS-8-D" och SKU:n "FE-GRLA-14-QS-8-D" blir lika. */
function kompakt(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function utanPrefix(sku: string): string {
  return sku.replace(/^(FESTO|FE|SMC|MW|PARKER|NORGREN|CAMOZZI|BR)-/i, "");
}

/** ISO 6431 är föregångaren till 15552, med samma infästningsmått. */
export function standardAv(p: ProductRow): Standard | null {
  const v = String(p.specs?.standard?.value ?? "");
  const n = /ISO\s*(\d{4,5})/i.exec(v)?.[1];
  if (n === "15552" || n === "6431") return "ISO 15552";
  if (n === "6432") return "ISO 6432";
  if (n === "21287") return "ISO 21287";
  return null;
}

/** Talen i specens första led: "32–125 mm (STD); …" ger [32, 125]. */
function tal(v: unknown): number[] {
  const huvud = String(v ?? "").split(/[;(]/)[0];
  return (huvud.match(/\d+(?:[.,]\d+)?/g) ?? []).map((t) => Number(t.replace(",", "."))).filter((n) => n > 0);
}

/** Borrningarna en rad kan beställas i: ett spann ger standardstegen inom det. */
export function borrningar(p: ProductRow): number[] {
  const v = String(p.specs?.bore_mm?.value ?? "");
  const t = tal(v);
  if (t.length === 0) return [];
  if (t.length === 2 && /\d\s*[–—-]\s*\d/.test(v.split(/[;(]/)[0])) {
    const [lag, hog] = [Math.min(...t), Math.max(...t)];
    return [lag, ...STANDARDBORRNINGAR.filter((d) => d > lag && d < hog), hog];
  }
  return [...new Set(t)];
}

/** Längsta slaget: för ett spann ("25–300 mm") dess max. */
export function maxSlag(p: ProductRow): number {
  const t = tal(p.specs?.stroke_mm?.value);
  return t.length ? Math.max(...t) : 0;
}

/** En serie: flera borrningar, ett slagspann eller en familjerad (FESTO-…, MW-…). */
export function arSerie(p: ProductRow): boolean {
  return borrningar(p).length > 1 || tal(p.specs?.stroke_mm?.value).length > 1 || FAMILJEPREFIX.test(p.sku);
}

/** Samma artikel i katalogen: SKU, SKU utan prefix eller typkod, skiljetecken oräknade. */
export function hittaArtikel(kod: string, katalog: ProductRow[]): ProductRow | null {
  const k = kompakt(kod);
  if (k.length < 3) return null;
  return katalog.find((p) =>
    kompakt(p.sku) === k ||
    kompakt(utanPrefix(p.sku)) === k ||
    kompakt(String(p.specs?.type_code?.value ?? "")) === k ||
    kompakt(String(p.specs?.catalogue_part_no?.value ?? "")) === k,
  ) ?? null;
}

export function identifiera(kod: string, katalog: ProductRow[], familjer: FamilyBrief[]): Identifiering {
  const ren = kod.trim();
  const produkt = hittaArtikel(ren, katalog);
  if (produkt) {
    const b = borrningar(produkt);
    return {
      kod: ren, produkt, familj: produkt.family, tillverkare: produkt.brand.name,
      standard: standardAv(produkt),
      borrningMm: b.length === 1 ? b[0] : null,
      slagMm: arSerie(produkt) ? null : (maxSlag(produkt) || null),
    };
  }
  const las = readOrderCodes(ren.toUpperCase(), familjer).resolved[0];
  if (!las) {
    return { kod: ren, produkt: null, familj: null, tillverkare: null, standard: null, borrningMm: null, slagMm: null };
  }
  // Standard och fabrikat ur katalogens rader för samma familj.
  const rader = katalog.filter((p) => (p.family ?? "").toUpperCase() === las.familyName.toUpperCase());
  const standarder = rader.map(standardAv).filter((s): s is Standard => s !== null);
  return {
    kod: ren, produkt: null, familj: las.familyName,
    tillverkare: rader[0]?.brand.name ?? null,
    standard: standarder[0] ?? null,
    borrningMm: las.boreMm, slagMm: las.strokeMm,
  };
}

/**
 * Motsvarigheter: samma standard, samma borrning. En artikel med fast slag
 * räknas bara när slaget är detsamma; en serie räknas när den når slaget.
 * Andra fabrikat först, sedan artiklar före serier.
 */
export function motsvarigheter(id: Identifiering, katalog: ProductRow[], max = 8): Kandidat[] {
  if (!id.standard || !id.borrningMm) return [];
  const ut: Kandidat[] = [];
  for (const p of katalog) {
    if (p.id === id.produkt?.id) continue;
    if (p.category.slug !== "cylinder" || standardAv(p) !== id.standard) continue;
    if (!borrningar(p).includes(id.borrningMm)) continue;
    const slag = maxSlag(p);
    if (arSerie(p)) {
      if (id.slagMm && slag > 0 && slag < id.slagMm) continue;
      ut.push({ produkt: p, typ: "serie", maxSlagMm: slag || null });
    } else {
      if (id.slagMm && slag !== id.slagMm) continue;
      ut.push({ produkt: p, typ: "artikel", maxSlagMm: null });
    }
  }
  const egen = (id.tillverkare ?? "").toLowerCase();
  return ut
    .sort((a, b) =>
      Number(a.produkt.brand.name.toLowerCase() === egen) - Number(b.produkt.brand.name.toLowerCase() === egen) ||
      Number(a.typ === "serie") - Number(b.typ === "serie") ||
      a.produkt.brand.name.localeCompare(b.produkt.brand.name) ||
      a.produkt.sku.localeCompare(b.produkt.sku))
    // En rad per fabrikat och typ räcker för en jämförelse.
    .filter((k, i, alla) => alla.findIndex((x) => x.produkt.brand.slug === k.produkt.brand.slug && x.typ === k.typ) === i)
    .slice(0, max);
}

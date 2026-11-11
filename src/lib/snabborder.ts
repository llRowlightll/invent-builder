/**
 * Snabborder: klistra in en lista med artikelnummer och antal.
 *
 * Ahlsell har "Beställ direkt" i sidhuvudet, Festo och RS har snabborder.
 * En inköpare eller konstruktör som redan vet vad hen vill ha har listan i
 * Excel eller i en gammal stycklista -- att söka fram rad för rad är just den
 * friktion som får hen att gå någon annanstans.
 *
 * Varje rad blir något, aldrig ingenting:
 *   artikel  -- samma artikel finns i katalogen (SKU, SKU utan prefix,
 *               typkod eller katalognummer; ersattning.ts hittaArtikel).
 *   serie    -- koden är en orderkod i en serie vi har (motorns
 *               orderkodsläsare). Raden får seriens katalogpost och kundens
 *               exakta kod, precis som en konfigurerad rad.
 *   okand    -- vi känner inte igen koden. Den följer med som en rad att
 *               kontrollera i offerten -- en människa läser den.
 */
import type { ProductRow } from "./types.ts";
import type { CartItem } from "./cart.ts";
import { hittaArtikel } from "./ersattning.ts";
import { readOrderCodes, type FamilyBrief } from "../../supabase/functions/groq-advisor/order-code.ts";

export interface ListRad {
  kod: string;
  antal: number;
}

const RUBRIK = /^(art(ikel)?\.?\s*(nr|nummer)?|article( no\.?| number)?|part( no\.?| number)?|kod|code|best\.?\s*nr|antal|qty|quantity|st|pcs)$/i;
const MAX_RADER = 200;
const MAX_ANTAL = 9999;

/** Läser "193986 5", "193986;5", "193986\t5", "5 x DSNU-25-100", "DSBC-50-100 x2", "5 st 193986". */
export function lasLista(text: string): ListRad[] {
  const summa = new Map<string, ListRad>();
  for (const radin of text.split(/\r?\n/).slice(0, MAX_RADER * 2)) {
    const rad = radin.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim();
    if (!rad) continue;
    let kod = rad;
    let antal = 1;

    // Kalkylblad: tabb eller semikolon skiljer kolumner. Koden står i första
    // kolumnen, antalet i den första senare kolumn som är ett heltal.
    const celler = rad.split(/\t|;/).map((c) => c.trim()).filter(Boolean);
    const forst = rad.match(/^(\d{1,4})\s*(?:st\.?|pcs|stk|x|×)\s+(.+)$/i);
    // Antalet sist: efter ett komma -- eller efter mellanslag med "x"/"st".
    // Ett naket "DSNU 25" läses som en kod, inte som 25 st DSNU: ett
    // artikelnummer får innehålla mellanslag.
    const sist = rad.match(/^(.+?)\s*(?:,\s*|\s+(?=(?:x|×)\s*\d)|\s+(?=\d{1,4}\s*(?:st|pcs|stk)\b))(?:x|×)?\s*(\d{1,4})\s*(?:st\.?|pcs|stk)?\s*$/i);
    if (celler.length > 1) {
      kod = celler[0];
      const tal = celler.slice(1).map((c) => c.match(/^(\d{1,4})\s*(?:st\.?|pcs|stk)?$/i)).find(Boolean);
      if (tal) antal = Number(tal[1]);
    } else if (forst) {
      antal = Number(forst[1]);
      kod = forst[2];
    } else if (sist) {
      kod = sist[1];
      antal = Number(sist[2]);
    }

    kod = kod.replace(/^["']|["']$/g, "").trim();
    if (kod.length < 2 || RUBRIK.test(kod)) continue;
    antal = Math.min(MAX_ANTAL, Math.max(1, Math.round(antal) || 1));
    const nyckel = kod.toUpperCase();
    const fanns = summa.get(nyckel);
    if (fanns) fanns.antal = Math.min(MAX_ANTAL, fanns.antal + antal);
    else summa.set(nyckel, { kod, antal });
    if (summa.size >= MAX_RADER) break;
  }
  return [...summa.values()];
}

export type Tolkning =
  | { status: "artikel"; produkt: ProductRow }
  | { status: "serie"; familj: string; produkt: ProductRow | null; borrningMm: number | null; slagMm: number | null }
  | { status: "okand" };

/**
 * Seriens egen katalogpost: raden i familjen vars SKU bär familjenamnet
 * (FESTO-DSBC). Aldrig en enskild storlek -- "DSNU-40" på en rad vars kod
 * säger 32 är värre än ingen post alls (samma regel som konfiguratorn).
 */
function serierad(familj: string, katalog: ProductRow[]): ProductRow | null {
  const f = familj.toUpperCase();
  return katalog.find((p) => (p.family ?? "").toUpperCase() === f && p.sku.toUpperCase().includes(f)) ?? null;
}

export function tolkaKod(kod: string, katalog: ProductRow[], familjer: FamilyBrief[]): Tolkning {
  const produkt = hittaArtikel(kod, katalog);
  if (produkt) return { status: "artikel", produkt };

  const las = readOrderCodes(kod.toUpperCase(), familjer).resolved[0];
  if (las) {
    return {
      status: "serie", familj: las.familyName, produkt: serierad(las.familyName, katalog),
      borrningMm: las.boreMm, slagMm: las.strokeMm,
    };
  }
  // Serien utan storlek: "MFH-5-1/8-S" → MFH, om katalogen har en seriepost för den.
  const prefix = kod.trim().split(/[-/\s]/)[0];
  if (prefix && prefix.length >= 2 && prefix !== kod.trim()) {
    const rad = serierad(prefix, katalog);
    if (rad) return { status: "serie", familj: rad.family ?? prefix, produkt: rad, borrningMm: null, slagMm: null };
  }
  return { status: "okand" };
}

/** Raden som läggs i korgen. Kundens kod följer alltid med när den inte är artikelns egen SKU. */
export function tillKorgrad(rad: ListRad, t: Tolkning, namn: (p: ProductRow) => string, okandNamn: string): CartItem {
  if (t.status === "artikel") {
    return { product_id: t.produkt.id, sku: t.produkt.sku, name: namn(t.produkt), qty: rad.antal };
  }
  if (t.status === "serie") {
    // Som en konfigurerad rad: koden är artikeln, serien är referensen.
    const kod = rad.kod.toUpperCase();
    return {
      product_id: t.produkt?.id ?? null,
      sku: kod,
      name: t.produkt ? namn(t.produkt) : t.familj,
      qty: rad.antal,
      order_code: kod,
    };
  }
  return { product_id: null, sku: rad.kod, name: okandNamn, qty: rad.antal, order_code: rad.kod.toUpperCase() };
}

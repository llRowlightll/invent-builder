/**
 * Likvärdiga cylindrar i andra fabrikat -- rutan "Jämför" på produktsidan.
 *
 * Varför egen logik: get_similar_products() tar samma kategori och borrning
 * inom ±10 %, och sidan skrev "Samma borrning och slaglängd" så fort båda
 * värdena FANNS -- inte när de var lika. En Festo DSNU Ø8 (ISO 6432) fick
 * därför SMC MXS, ett slidbord, som "samma borrning och slaglängd"
 * (granskning 2026-11-11). Ett slidbord är ingen rundcylinder, och en
 * konstruktör som ser det slutar lita på resten av sidan.
 *
 * Regeln här:
 *  1. Samma cylindergrupp (rund, profil, kompakt, kolvstångslös, styrd ...),
 *     läst ur standard, cylindertyp och namn. Okänd grupp = inga påståenden.
 *  2. Borrningen ska finnas hos kandidaten -- exakt, i dess lista eller inom
 *     dess intervall. Närliggande räcker inte: kraften skalar med diametern
 *     i kvadrat.
 *  3. Etiketten säger bara det som stämmer: samma standard bara när båda
 *     har den, "samma borrning" bara när den är lika, annars "finns i".
 *     Slaglängd nämns inte -- familjerader anger största slag, inte ett slag.
 */
import type { ProductRow } from "./types";

export type Cylindergrupp =
  | "rund" | "profil" | "kompakt" | "stanglos" | "styrd" | "slid"
  | "kortslag" | "stift" | "dubbel" | "ventil" | "platt" | "patron";

const GRUPPNAMN: Record<Cylindergrupp, [string, string]> = {
  rund: ["Rundcylinder", "Round cylinder"],
  profil: ["Profilcylinder", "Profile cylinder"],
  kompakt: ["Kompaktcylinder", "Compact cylinder"],
  stanglos: ["Kolvstångslös cylinder", "Rodless cylinder"],
  styrd: ["Styrd cylinder", "Guided cylinder"],
  slid: ["Släde", "Slide"],
  kortslag: ["Kortslagscylinder", "Short-stroke cylinder"],
  stift: ["Stiftcylinder", "Pin cylinder"],
  dubbel: ["Dubbelcylinder", "Twin cylinder"],
  ventil: ["Cylinder med ventil", "Cylinder with valve"],
  platt: ["Plattcylinder", "Flat cylinder"],
  patron: ["Patroncylinder", "Cartridge cylinder"],
};

export function gruppnamn(g: Cylindergrupp, sv: boolean): string {
  return GRUPPNAMN[g][sv ? 0 : 1];
}

/** ISO-standarden i ett fritt värde ("ISO 15552 / VDMA", "ISO 6432 (Ø8–25)"). */
export function cylinderstandard(v: string | undefined | null): string | null {
  const s = String(v ?? "");
  if (/6432/.test(s)) return "ISO 6432";
  if (/15552|6431|vdma/i.test(s)) return "ISO 15552";
  if (/21287/.test(s)) return "ISO 21287";
  return null;
}

// Ordningen spelar roll: "Rodless cylinder, ball rail guide" är kolvstångslös,
// inte styrd; "Guided Slide Table" (SMC MGP) är en styrd cylinder, inte en
// släde; "Linear Slide" (Metal Work S11) är en släde, inte en dubbelcylinder.
const REGLER: [RegExp, Cylindergrupp][] = [
  [/\bpin cylinder|stiftcylinder/i, "stift"],
  [/rodless|kolvstångslös|stånglös|band cylinder|linear drive|linjärenhet|magnetically coupled|strip seal|carriage/i, "stanglos"],
  [/guided|guide cylinder|guide rods|styrd/i, "styrd"],
  [/slide|släde|slid/i, "slid"],
  [/twin cylinder|dubbelcylinder/i, "dubbel"],
  [/short.?stroke|kortslag/i, "kortslag"],
  [/integrated valve|inbyggd .{0,30}ventil/i, "ventil"],
  [/compact|kompakt/i, "kompakt"],
  [/tie.?rod|dragstång|large bore|stor borrning/i, "profil"],
  [/\bround|\brund|mini cylinder/i, "rund"],
  [/\bflat\b|plattcylinder/i, "platt"],
  [/cartridge|patron/i, "patron"],
];

export function cylindergrupp(p: Pick<ProductRow, "name" | "name_en" | "description" | "specs">): {
  grupp: Cylindergrupp;
  standard: string | null;
} | null {
  const standard = cylinderstandard(p.specs?.standard?.value);
  if (standard === "ISO 6432") return { grupp: "rund", standard };
  if (standard === "ISO 15552") return { grupp: "profil", standard };
  if (standard === "ISO 21287") return { grupp: "kompakt", standard };
  // Namn och cylindertyp först; beskrivningens första mening bara som
  // reserv -- "mycket kompakt" längre ner i en text säger inget om typen.
  const huvud = [p.name, p.name_en, p.specs?.cylinder_type?.value].filter(Boolean).join(" ");
  const reserv = String(p.description ?? "").split(/[.!?]\s/)[0];
  for (const text of [huvud, reserv]) {
    for (const [re, g] of REGLER) if (re.test(text)) return { grupp: g, standard: null };
  }
  return null;
}

export interface Borrningar {
  enstaka: number[];
  intervall: [number, number][];
}

/** Läser "8", "8,10,12", "12–200", "8–25 (STD); 16–25 (TP twin-rod)". */
export function borrningar(v: string | undefined | null): Borrningar {
  const s = String(v ?? "").replace(/ø|Ø/g, "");
  const ut: Borrningar = { enstaka: [], intervall: [] };
  const re = /(\d+(?:\.\d+)?)\s*(?:–|-|—|\.\.\.?|…)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)/g;
  for (const m of s.matchAll(re)) {
    if (m[1] && m[2]) {
      const a = Number(m[1]), b = Number(m[2]);
      if (a < b) ut.intervall.push([a, b]);
      else ut.enstaka.push(a);
    } else if (m[3]) ut.enstaka.push(Number(m[3]));
  }
  return ut;
}

/** Finns borrningen d i värdet -- exakt, i listan eller inom intervallet? */
export function harBorrning(v: string | undefined | null, d: number): boolean {
  return rymmer(borrningar(v), d) !== null;
}

function antal(b: Borrningar) {
  return b.enstaka.length + b.intervall.length;
}

/** 0 = exakt samma enstaka borrning, 1 = i listan, 2 = inom intervallet, null = finns inte. */
function rymmer(kand: Borrningar, d: number): 0 | 1 | 2 | null {
  if (kand.enstaka.includes(d)) return kand.enstaka.length === 1 && kand.intervall.length === 0 ? 0 : 1;
  if (kand.intervall.some(([a, b]) => d >= a && d <= b)) return 2;
  return null;
}

function overlappar(a: Borrningar, b: Borrningar): boolean {
  const punkter = [...a.enstaka, ...a.intervall.flat()];
  if (punkter.some((d) => rymmer(b, d) !== null)) return true;
  return [...b.enstaka, ...b.intervall.flat()].some((d) => rymmer(a, d) !== null);
}

function borrText(b: Borrningar): string {
  // En lång storlekslista blir ett spann: "Ø12–125", inte elva tal.
  if (b.enstaka.length > 4 && b.intervall.length === 0) {
    return `Ø${Math.min(...b.enstaka)}–${Math.max(...b.enstaka)}`;
  }
  const delar = [
    ...b.intervall.map(([x, y]) => `${x}–${y}`),
    ...(b.enstaka.length ? [b.enstaka.join(", ")] : []),
  ];
  return `Ø${delar.join(", ")}`;
}

export interface Likvardig {
  p: ProductRow;
  etikett: { sv: string; en: string };
}

/**
 * Likvärdiga cylindrar i andra fabrikat, bäst först, högst två per fabrikat
 * och en per familj.
 * null = produkten är ingen cylinder vi kan typa -- anroparen får då visa
 * sina övriga alternativ utan typpåstående.
 */
export function likvardigaCylindrar(produkt: ProductRow, katalog: ProductRow[], max = 6): Likvardig[] | null {
  if (produkt.category?.slug !== "cylinder") return null;
  const egen = cylindergrupp(produkt);
  if (!egen) return null;
  const egnaBorr = borrningar(produkt.specs?.bore_mm?.value);
  const enBorrning = egnaBorr.enstaka.length === 1 && egnaBorr.intervall.length === 0 ? egnaBorr.enstaka[0] : null;

  const traffar: { p: ProductRow; poang: number; etikett: { sv: string; en: string } }[] = [];
  for (const k of katalog) {
    if (k.id === produkt.id || k.category?.slug !== "cylinder") continue;
    if (k.brand?.slug === produkt.brand?.slug) continue;
    const g = cylindergrupp(k);
    if (!g || g.grupp !== egen.grupp) continue;
    const kb = borrningar(k.specs?.bore_mm?.value);

    let borrPoang = 3;
    let borrSv = "", borrEn = "";
    if (antal(egnaBorr) > 0) {
      if (antal(kb) === 0) continue; // kan inte påstå något om storleken
      if (enBorrning !== null) {
        const r = rymmer(kb, enBorrning);
        if (r === null) continue;
        borrPoang = r;
        borrSv = r === 0 ? `samma borrning Ø${enBorrning}` : `finns i Ø${enBorrning}`;
        borrEn = r === 0 ? `same bore Ø${enBorrning}` : `available in Ø${enBorrning}`;
      } else {
        if (!overlappar(egnaBorr, kb)) continue;
        // En familj jämförs helst med en familj, inte med en enstaka storlek.
        borrPoang = antal(kb) > 1 || kb.intervall.length > 0 ? 3 : 4;
        borrSv = `storlekar ${borrText(kb)}`;
        borrEn = `sizes ${borrText(kb)}`;
      }
    }

    const sammaStd = !!egen.standard && egen.standard === g.standard;
    const typSv = sammaStd ? `Samma standard (${egen.standard})` : gruppnamn(egen.grupp, true);
    const typEn = sammaStd ? `Same standard (${egen.standard})` : gruppnamn(egen.grupp, false);
    traffar.push({
      p: k,
      poang: (sammaStd ? 0 : 10) + borrPoang,
      etikett: {
        sv: borrSv ? `${typSv}, ${borrSv}` : typSv,
        en: borrEn ? `${typEn}, ${borrEn}` : typEn,
      },
    });
  }

  traffar.sort((a, b) => a.poang - b.poang || a.p.sku.localeCompare(b.p.sku));
  const perFabrikat = new Map<string, number>();
  const sedda = new Set<string>();
  const ut: Likvardig[] = [];
  for (const t of traffar) {
    // En rad per familj: 93 KPZ-rader skiljer sig bara i slag.
    const familj = `${t.p.brand.slug}|${(t.p.family ?? t.p.sku).toLowerCase()}`;
    if (sedda.has(familj)) continue;
    const n = perFabrikat.get(t.p.brand.slug) ?? 0;
    if (n >= 2) continue;
    sedda.add(familj);
    perFabrikat.set(t.p.brand.slug, n + 1);
    ut.push({ p: t.p, etikett: t.etikett });
    if (ut.length >= max) break;
  }
  return ut;
}

/**
 * Etikett för alternativ som inte är cylindrar (gripdon m.fl. från
 * get_similar_products): "samma borrning" bara när den är lika.
 */
export function borrEtikett(produkt: ProductRow, kand: ProductRow, sv: boolean): string | null {
  const a = borrningar(produkt.specs?.bore_mm?.value);
  const b = borrningar(kand.specs?.bore_mm?.value);
  if (a.enstaka.length !== 1 || antal(a) !== 1 || antal(b) === 0) return null;
  const d = a.enstaka[0];
  const r = rymmer(b, d);
  if (r === 0) return sv ? `Samma borrning Ø${d}` : `Same bore Ø${d}`;
  if (r !== null) return sv ? `Finns i Ø${d}` : `Available in Ø${d}`;
  return sv ? `Närliggande storlek ${borrText(b)} — jämför` : `Nearby size ${borrText(b)} — compare`;
}

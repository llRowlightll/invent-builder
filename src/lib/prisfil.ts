/**
 * Läser en leverantörs prislista (CSV eller Excel som tabell) och matchar
 * raderna mot katalogen.
 *
 * Provkörningen 2026-11-18 inför de första prislistorna visade att den gamla
 * inläsningen i admin/pricing bara matchade på vårt eget artikelnummer
 * ("SMC-RB0806"), medan leverantören skriver tillverkarens ("RB0806"). Den
 * kände inte igen RS-kolumnerna ("Mfr. Part No.", "RS Stock No."), läste
 * "1.234,50" som 1,23, tappade AVENTICS nollor när Excel gjort numret till
 * ett tal och visade "sparade" när ingen rad matchade.
 *
 * Här finns bara tolkning: inga nätverks-, Supabase- eller DOM-anrop, så att
 * filen kan provas med `deno test tests/prisfil.test.ts`.
 */

export type KatalogArtikel = {
  id: string;
  sku: string;
  name: string;
  brand?: string | null;
  is_family?: boolean | null;
  purchase_price?: number | null;
  /** Fler nummer som betyder artikeln, t.ex. type_code ur specarna. */
  extraNycklar?: string[];
};

export type Status = "match" | "kontrollera" | "flera" | "serie" | "saknas" | "utan_pris" | "dubblett";

export type Prisrad = {
  /** Radnumret i filen (1 = första raden). */
  rad: number;
  /** Numret raden matchades på, eller det första artikelnumret på raden. */
  kod: string;
  /** Leverantörens eget artikelnummer (t.ex. RS Stock No.), om kolumnen finns. */
  levKod: string | null;
  namn: string;
  /** Pris per styck i filens valuta, efter rabatt och förpackning. */
  pris: number | null;
  valuta: string;
  forpackning: number;
  status: Status;
  artikel?: KatalogArtikel;
  /**
   * Alla artiklar priset gäller: fler än en när samma artikel ligger två
   * gånger i katalogen (TU0604BU-20 och SMC-TU0604BU-20 2026-11-18).
   */
  alla?: KatalogArtikel[];
  /** Hur matchningen gick till, för granskningen. */
  via: string;
  anm: string[];
};

export type Kolumner = {
  rubrikrad: number;
  egenSku: number[];
  tillverkare: number[];
  artikel: number[];
  leverantor: number[];
  netto: number | null;
  pris: number | null;
  lista: number | null;
  rabatt: number | null;
  valuta: number | null;
  forpackning: number | null;
  marginal: number | null;
  palagg: number | null;
  namn: number | null;
  /** Valutan som står i en prisrubrik, t.ex. "Pris (EUR)". */
  rubrikvaluta: string | null;
};

export type Inlasning = {
  kolumner: Kolumner | null;
  rader: Prisrad[];
  /** Valutan filen anger (kolumn eller rubrik), annars null. */
  filvaluta: string | null;
  fel: string | null;
};

// ── Rubriker ─────────────────────────────────────────────────────────────────

const R = {
  egenSku: ["sku", "maskinval sku", "maskinval", "vår artikel", "vart artikelnummer", "vårt artikelnummer"],
  tillverkare: [
    "tillverkarens artikelnummer", "tillverkarens art.nr", "tillverkarens nr", "tillv. art.nr", "tillv art nr",
    "tillv.art.nr", "tillverkarnummer", "tillverkarens artnr", "mfr. part no.", "mfr part no", "mfr. part no",
    "mfr. part number", "mfr part number", "manufacturer part number", "manufacturer part no", "manufacturer part no.",
    "manufacturers part number", "mpn", "herstellerteilenummer", "hersteller-teilenummer", "herstellernummer",
    "hersteller artikelnummer", "ref. fabricante", "referencia fabricante", "referencia del fabricante",
    "codice produttore",
  ],
  artikel: [
    "artikelnummer", "artikelnr", "artikelnr.", "artnr", "art.nr", "art.nr.", "art nr", "artikel", "article",
    "article number", "article_number", "article no", "article no.", "part", "part number", "part_number",
    "partnumber", "part no", "part no.", "produkt", "produktnummer", "bestellnummer", "best.-nr.", "best.-nr",
    "bestell-nr.", "bestell-nr", "teilenummer", "materialnummer", "artikelnummer/teilenummer", "order code",
    "order no", "order no.", "order number", "ordering code", "typ", "type", "typbeteckning", "type code",
    "typcode", "referencia", "código", "codigo", "codice", "code", "kod",
  ],
  leverantor: [
    "rs stock no.", "rs stock no", "rs stock number", "rs-artikelnummer", "rs artikelnummer", "rs art.nr",
    "rs art nr", "rs-nr", "rs nr", "stock no.", "stock no", "stock number", "lev. art.nr", "lev art nr",
    "leverantörens artikelnummer", "supplier part number", "supplier sku", "supplier part no",
  ],
  netto: [
    "nettopris", "netto", "net price", "net", "net unit price", "ditt pris", "ert pris", "kundpris", "inköpspris",
    "inkopspris", "inköp", "inkop", "purchase_price", "purchase price", "your price", "nettopreis", "ihr preis",
    "precio neto", "su precio", "prezzo netto", "cost", "kostnad",
  ],
  pris: [
    "pris", "price", "unit price", "unit_price", "styckpris", "à-pris", "a-pris", "á-pris", "apris", "preis",
    "stückpreis", "einzelpreis", "precio", "precio unitario", "prezzo", "prezzo unitario", "price each",
    "price per unit", "pris/st", "pris per st", "pris per styck",
  ],
  lista: [
    "listpris", "bruttopris", "list price", "listprice", "gross price", "bruttopreis", "listenpreis",
    "precio de lista", "precio tarifa", "prezzo di listino", "prezzo listino", "katalogpris", "catalogue price",
  ],
  rabatt: ["rabatt", "rabatt %", "rabatt%", "rabatt (%)", "discount", "discount %", "discount (%)", "nachlass", "rabatt in %", "descuento", "descuento %", "sconto", "sconto %"],
  valuta: ["valuta", "currency", "währung", "wahrung", "moneda", "divisa", "valuta (iso)", "curr", "curr."],
  forpackning: [
    "förpackning", "forpackning", "antal per förpackning", "antal/förp", "antal/förp.", "förp.", "förp", "pack size",
    "pack qty", "pack quantity", "packsize", "packaging quantity", "pack", "per förpackning", "st/förp",
    "st/förp.", "st per förp", "verpackungseinheit", "vpe", "unidades por paquete", "unidad de embalaje",
    "confezione", "pz/conf",
  ],
  marginal: ["margin", "marginal", "margin_pct", "marginal_pct", "marginal %", "marginal (%)", "bruttomarginal"],
  palagg: ["pålägg", "palagg", "pålägg %", "markup", "markup %"],
  namn: [
    "name", "namn", "beskrivning", "description", "benämning", "benamning", "bezeichnung", "beschreibung",
    "artikelbezeichnung", "descripción", "descripcion", "descrizione", "product description", "produktnamn",
    "product name", "artikelbenämning", "text",
  ],
};

const VALUTAKODER = ["SEK", "EUR", "USD", "GBP", "DKK", "NOK", "CHF"];

/** Rubrik utan BOM, versaler, kolon, parentesvaluta och dubbla mellanslag. */
export function rensaRubrik(s: unknown): string {
  return String(s ?? "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[:*]+$/, "")
    .replace(/\s*\((?:sek|eur|usd|gbp|dkk|nok|chf|kr|€|\$|£)\)\s*/g, " ")
    .replace(/\s+(?:sek|eur|usd|gbp|dkk|nok|chf|kr|€)$/g, "")
    .trim();
}

function rubrikvaluta(s: unknown): string | null {
  const t = String(s ?? "").toUpperCase();
  if (/€/.test(t)) return "EUR";
  if (/\$/.test(t)) return "USD";
  if (/£/.test(t)) return "GBP";
  for (const v of VALUTAKODER) if (new RegExp(`\\b${v}\\b`).test(t)) return v;
  if (/\bKR\b/.test(t)) return "SEK";
  return null;
}

/** Prisstegsrubrik ("1+", "1-9", "Pris 1+", "Price 10-49") → minsta antal, annars null. */
function prisstegAntal(r: string): number | null {
  const m = r.match(/^(?:pris|price|preis|precio|prezzo|à-pris|a-pris)?\s*(\d+)\s*(?:\+|st\+|-\s*\d+|–\s*\d+|st)$/);
  return m ? Number(m[1]) : null;
}

/** Hittar rubrikraden bland de första 20 raderna och kolumnernas roller. */
export function hittaKolumner(tabell: unknown[][]): Kolumner | null {
  for (let i = 0; i < Math.min(tabell.length, 20); i++) {
    const rad = tabell[i] ?? [];
    const k: Kolumner = {
      rubrikrad: i, egenSku: [], tillverkare: [], artikel: [], leverantor: [], netto: null, pris: null, lista: null,
      rabatt: null, valuta: null, forpackning: null, marginal: null, palagg: null, namn: null, rubrikvaluta: null,
    };
    let steg: { kol: number; antal: number } | null = null;
    rad.forEach((cell, j) => {
      const r = rensaRubrik(cell);
      if (!r) return;
      const v = rubrikvaluta(cell);
      const ar = (lista: string[]) => lista.includes(r);
      if (ar(R.leverantor)) k.leverantor.push(j);
      else if (ar(R.tillverkare)) k.tillverkare.push(j);
      else if (ar(R.egenSku)) k.egenSku.push(j);
      else if (ar(R.artikel)) k.artikel.push(j);
      else if (ar(R.netto)) { if (k.netto == null) { k.netto = j; if (v) k.rubrikvaluta = v; } }
      else if (ar(R.lista)) { if (k.lista == null) { k.lista = j; if (v && !k.rubrikvaluta) k.rubrikvaluta = v; } }
      else if (ar(R.pris)) { if (k.pris == null) { k.pris = j; if (v && !k.rubrikvaluta) k.rubrikvaluta = v; } }
      else if (ar(R.rabatt)) k.rabatt ??= j;
      else if (ar(R.valuta)) k.valuta ??= j;
      else if (ar(R.forpackning)) k.forpackning ??= j;
      else if (ar(R.marginal)) k.marginal ??= j;
      else if (ar(R.palagg)) k.palagg ??= j;
      else if (ar(R.namn)) k.namn ??= j;
      else {
        const antal = prisstegAntal(r);
        if (antal != null && (!steg || antal < steg.antal)) {
          steg = { kol: j, antal };
          if (v && !k.rubrikvaluta) k.rubrikvaluta = v;
        }
      }
    });
    // Prissteg ("1+", "10+") används bara när ingen vanlig priskolumn finns;
    // det lägsta antalet ger styckpriset.
    if (k.pris == null && k.netto == null && k.lista == null && steg) k.pris = (steg as { kol: number }).kol;
    const harKod = k.egenSku.length + k.tillverkare.length + k.artikel.length + k.leverantor.length > 0;
    const harPris = k.netto != null || k.pris != null || k.lista != null;
    if (harKod && harPris) return k;
  }
  return null;
}

// ── Tal ──────────────────────────────────────────────────────────────────────

/**
 * Decimaltecknet i en kolumn: "," om något värde slutar på komma + 1–2
 * siffror ("12,50", "1 234,5"), "." om något slutar på punkt + 1–2 siffror,
 * annars "," (svensk standard).
 */
export function decimaltecken(varden: unknown[]): "," | "." {
  let komma = 0;
  let punkt = 0;
  for (const v of varden) {
    if (typeof v === "number") continue;
    const s = String(v ?? "").replace(/[\s\u00A0\u202F]/g, "");
    if (/,\d{1,2}$/.test(s)) komma++;
    else if (/\.\d{1,2}$/.test(s)) punkt++;
  }
  return punkt > komma ? "." : ",";
}

/** Ett belopp ur en cell: "1 234,50 kr", "1.234,50", "1,234.50", "€ 12.5", "125:-". */
export function tolkaTal(v: unknown, dec: "," | "." = ","): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim();
  if (!s) return null;
  s = s.replace(/[\s\u00A0\u202F']/g, "").replace(/:-$/, "").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  const tusen = dec === "," ? "." : ",";
  if (s.includes(",") && s.includes(".")) {
    // Det sista tecknet är decimaltecknet, oavsett kolumnens vana.
    const sista = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
    s = s.slice(0, sista).replace(/[.,]/g, "") + "." + s.slice(sista + 1);
  } else if (s.includes(tusen)) {
    // Bara tusentalstecknet: "1.234" i en kommakolumn är 1234. Ett ensamt
    // tecken följt av annat än exakt tre siffror är ändå ett decimaltecken.
    const delar = s.split(tusen);
    const arTusen = delar.length > 2 || (delar.length === 2 && /^\d{3}$/.test(delar[1]));
    s = arTusen ? delar.join("") : delar.join(".");
  } else if (dec === ",") {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// ── Nycklar ──────────────────────────────────────────────────────────────────

/** Våra prefix framför tillverkarens nummer i sku:n. */
const PREFIX = /^(?:FESTO|FE|SMC|MW|NOR|NORGREN|PARKER|PH|BR|CAM|CAMOZZI|AV|AVENTICS|REXROTH)-/;

/** Versaler, utan mellanslag, med vanliga bindestreck. */
export function nyckel(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[\u2010-\u2015\u2212]/g, "-").replace(/[\s\u00A0\u202F]/g, "").replace(/^[.,;:-]+|[.,;:]+$/g, "");
}

/** Utan skiljetecken: "AKH06A-02S" och "AKH06A02S" blir samma. */
export function kompakt(v: unknown): string {
  return nyckel(v).replace(/[-/._]/g, "");
}

/** Siffernummer utan inledande nollor (Excel gör 0822123009 till 822123009). */
function utanNollor(k: string): string | null {
  return /^\d{5,}$/.test(k) ? k.replace(/^0+/, "") : null;
}

function artikelnycklar(a: KatalogArtikel): string[] {
  const ut = new Set<string>();
  const lagg = (v: string | null | undefined) => {
    const k = nyckel(v);
    if (k.length < 3) return;
    ut.add(k);
    const n = utanNollor(k);
    if (n) ut.add(n);
  };
  lagg(a.sku);
  lagg(nyckel(a.sku).replace(PREFIX, ""));
  for (const x of a.extraNycklar ?? []) lagg(x);
  return [...ut];
}

export type Katalogindex = {
  exakt: Map<string, KatalogArtikel[]>;
  kompakt: Map<string, KatalogArtikel[]>;
  serier: Map<string, KatalogArtikel>;
};

export function byggIndex(katalog: KatalogArtikel[]): Katalogindex {
  const exakt = new Map<string, KatalogArtikel[]>();
  const komp = new Map<string, KatalogArtikel[]>();
  const serier = new Map<string, KatalogArtikel>();
  const lagg = (m: Map<string, KatalogArtikel[]>, k: string, a: KatalogArtikel) => {
    const l = m.get(k) ?? [];
    if (!l.some((x) => x.id === a.id)) l.push(a);
    m.set(k, l);
  };
  for (const a of katalog) {
    const nycklar = artikelnycklar(a);
    if (a.is_family) {
      for (const k of nycklar) serier.set(k, a);
      continue;
    }
    for (const k of nycklar) {
      lagg(exakt, k, a);
      const kk = kompakt(k);
      if (kk.length >= 5) lagg(komp, kk, a);
    }
  }
  return { exakt, kompakt: komp, serier };
}

export type Traff = { status: "match" | "kontrollera" | "flera" | "serie" | "saknas"; artikel?: KatalogArtikel; via: string; kandidater?: KatalogArtikel[] };

/** Matchar ett nummer: exakt (även utan våra prefix och Excels tappade nollor), sedan utan skiljetecken. */
export function matcha(kod: unknown, index: Katalogindex): Traff {
  const k = nyckel(kod);
  if (k.length < 3) return { status: "saknas", via: "" };
  const varianter = [k, k.replace(PREFIX, "")];
  const n = utanNollor(k);
  if (n) varianter.push(n);
  for (const v of varianter) {
    const l = index.exakt.get(v);
    if (l?.length === 1) return { status: "match", artikel: l[0], via: "exakt" };
    if (l && l.length > 1) return { status: "flera", via: "exakt", kandidater: l };
  }
  const kk = kompakt(k);
  if (kk.length >= 5) {
    const l = index.kompakt.get(kk);
    if (l?.length === 1) return { status: "kontrollera", artikel: l[0], via: "utan skiljetecken" };
    if (l && l.length > 1) return { status: "flera", via: "utan skiljetecken", kandidater: l };
  }
  for (const v of varianter) {
    const s = index.serier.get(v);
    if (s) return { status: "serie", artikel: s, via: "serie" };
  }
  return { status: "saknas", via: "" };
}

// ── Inläsning ────────────────────────────────────────────────────────────────

const text = (v: unknown) => (v == null ? "" : typeof v === "number" ? String(v) : String(v).trim());

/**
 * Läser tabellen (rader × celler, som Papa.parse utan rubriker eller
 * Excel-läsaren ger) och matchar varje rad mot katalogen.
 */
export function lasPrislista(tabell: unknown[][], katalog: KatalogArtikel[], valutaVal?: string | null): Inlasning {
  const kol = hittaKolumner(tabell);
  if (!kol) {
    return {
      kolumner: null, rader: [], filvaluta: null,
      fel: "Hittade ingen rubrikrad med både artikelnummer och pris. Filen behöver t.ex. kolumnerna \"Artikelnummer\" (eller \"Mfr. Part No.\") och \"Pris\" (eller \"Nettopris\").",
    };
  }
  const index = byggIndex(katalog);
  const data = tabell.slice(kol.rubrikrad + 1);
  const priskol = kol.netto ?? kol.pris ?? kol.lista!;
  const anvandRabatt = kol.netto == null && kol.pris == null && kol.lista != null && kol.rabatt != null;
  const dec = decimaltecken(data.map((r) => r[priskol]));
  const kodkolumner = [...kol.egenSku, ...kol.tillverkare, ...kol.artikel, ...kol.leverantor];

  // Valuta: kolumnen per rad, annars rubrikens, annars valet i admin, annars SEK.
  const kolumnvalutor = new Set<string>();
  if (kol.valuta != null) for (const r of data) { const v = rubrikvaluta(r[kol.valuta]); if (v) kolumnvalutor.add(v); }
  const filvaluta = kolumnvalutor.size === 1 ? [...kolumnvalutor][0] : kol.rubrikvaluta;

  const rader: Prisrad[] = [];
  const sedda = new Map<string, number>();
  data.forEach((r, i) => {
    const celler = kodkolumner.map((j) => text(r[j])).filter(Boolean);
    if (celler.length === 0 && !r.some((c) => text(c))) return; // tom rad
    const anm: string[] = [];
    const levKod = kol.leverantor.length ? text(r[kol.leverantor[0]]) || null : null;

    // Pris per styck i filens valuta.
    let pris = tolkaTal(r[priskol], dec);
    if (anvandRabatt && pris != null) {
      const rab = tolkaTal(r[kol.rabatt!], dec);
      if (rab != null && rab > 0 && rab < 100) {
        pris = pris * (1 - rab / 100);
        anm.push(`listpris \u2212 ${String(rab).replace(".", ",")} % rabatt`);
      }
    }
    let forp = 1;
    if (kol.forpackning != null) {
      const f = tolkaTal(r[kol.forpackning], dec);
      if (f != null && f > 1 && Number.isInteger(f)) {
        forp = f;
        if (pris != null) pris = pris / f;
        anm.push(`priset delat på förpackningen om ${f} st`);
      }
    }
    const radvaluta = kol.valuta != null ? rubrikvaluta(r[kol.valuta]) : null;
    const valuta = radvaluta ?? filvaluta ?? valutaVal ?? "SEK";

    // Matcha: vårt nummer först, sedan tillverkarens, sedan allmänna, sist leverantörens eget.
    let traff: Traff = { status: "saknas", via: "" };
    let kod = celler[0] ?? "";
    for (const j of kodkolumner) {
      const v = r[j];
      if (!text(v)) continue;
      const t = matcha(v, index);
      if (t.status === "match" || t.status === "kontrollera" || t.status === "flera" || (t.status === "serie" && traff.status === "saknas")) {
        traff = { ...t, via: `${t.via}, kolumnen "${text(tabell[kol.rubrikrad][j])}"` };
        kod = text(v);
        if (t.status === "match") break;
      }
    }

    let status: Status = traff.status;
    let alla: KatalogArtikel[] | undefined = traff.artikel ? [traff.artikel] : undefined;
    if (traff.status === "flera") {
      const k = traff.kandidater!;
      // Ett tillverkarnummer som pekar på två rader av samma fabrikat är samma
      // artikel inlagd två gånger: priset gäller båda, men granskas.
      const ettFabrikat = new Set(k.map((a) => (a.brand ?? "").toLowerCase())).size === 1;
      if (ettFabrikat) {
        status = "kontrollera";
        traff = { ...traff, artikel: k[0] };
        alla = k;
        anm.push(`samma artikel finns ${k.length} gånger i katalogen (${k.map((a) => a.sku).join(", ")}); priset sätts på alla`);
      } else {
        anm.push(`passar ${k.map((a) => a.sku).join(", ")}`);
      }
    }
    if (traff.status === "serie") anm.push("priset sätts per utförande, inte på serien");
    if ((status === "match" || status === "kontrollera") && !(pris != null && pris > 0)) status = "utan_pris";
    if ((status === "match" || status === "kontrollera") && traff.artikel) {
      const tidigare = (alla ?? [traff.artikel]).map((a) => sedda.get(a.id)).find((x) => x != null);
      if (tidigare != null) {
        status = "dubblett";
        anm.push(`samma artikel som rad ${tidigare}`);
      } else {
        for (const a of alla ?? [traff.artikel]) sedda.set(a.id, kol.rubrikrad + 2 + i);
      }
      const nu = traff.artikel.purchase_price;
      if (status !== "dubblett" && nu != null && nu > 0 && pris != null && valuta === "SEK" && (pris / nu > 2 || pris / nu < 0.5)) {
        anm.push(`stor ändring mot nuvarande ${Math.round(nu)} kr`);
        if (status === "match") status = "kontrollera";
      }
    }

    rader.push({
      rad: kol.rubrikrad + 2 + i,
      kod,
      levKod,
      namn: kol.namn != null ? text(r[kol.namn]) : "",
      pris: pris != null && pris > 0 ? Math.round(pris * 10000) / 10000 : null,
      valuta,
      forpackning: forp,
      status,
      artikel: traff.artikel,
      alla: status === "match" || status === "kontrollera" || status === "dubblett" ? alla : undefined,
      via: traff.via,
      anm,
    });
  });
  return { kolumner: kol, rader, filvaluta, fel: null };
}

/** Marginal ur filen: marginalkolumnen, eller pålägg omräknat (25 % pålägg = 20 % marginal). */
export function marginalUrRad(r: unknown[], kol: Kolumner): number | null {
  if (kol.marginal != null) {
    const m = tolkaTal(r[kol.marginal]);
    if (m != null && m >= 1 && m <= 95) return m;
  }
  if (kol.palagg != null) {
    const p = tolkaTal(r[kol.palagg]);
    if (p != null && p > 0 && p < 1900) return Math.round((p / (100 + p)) * 1000) / 10;
  }
  return null;
}

/** Kronor ur filens valuta. Kursen är kronor per enhet (Riksbankens notering). */
export function iKronor(pris: number, valuta: string, kurs: number | null): number | null {
  if (valuta === "SEK") return pris;
  if (!(kurs != null && kurs > 0)) return null;
  return Math.round(pris * kurs * 100) / 100;
}

export function sammanfatta(rader: Prisrad[]): Record<Status, number> {
  const ut: Record<Status, number> = { match: 0, kontrollera: 0, flera: 0, serie: 0, saknas: 0, utan_pris: 0, dubblett: 0 };
  for (const r of rader) ut[r.status]++;
  return ut;
}

/** De rader som inte kan sparas, som CSV för att skicka tillbaka eller lägga till artiklar. */
export function omatchadeCsv(rader: Prisrad[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const ut = ["rad;kod;leverantorens_nr;namn;pris;valuta;status;anmarkning"];
  for (const r of rader) {
    if (r.status === "match" || r.status === "kontrollera") continue;
    ut.push([r.rad, esc(r.kod), esc(r.levKod ?? ""), esc(r.namn), r.pris ?? "", r.valuta, r.status, esc(r.anm.join("; "))].join(";"));
  }
  return "\uFEFF" + ut.join("\r\n") + "\r\n";
}

/**
 * Avgränsaren i en CSV-fil. Papa.parse gissar fel på en tvåkolumnsfil med
 * semikolon ("Artikelnummer;Pris" blev en enda kolumn 2026-11-18), så den
 * räknas här: det tecken som förekommer lika många gånger på flest av de
 * första raderna vinner; vid lika går semikolon (svensk Excel) före tab och
 * komma -- komma står ofta i belopp ("150,00").
 */
export function gissaAvgransare(text: string): ";" | "\t" | "," {
  const rader = text.split(/\r?\n/).filter((r) => r.trim()).slice(0, 25);
  let bast: { tecken: ";" | "\t" | ","; poang: number } = { tecken: ";", poang: 0 };
  for (const tecken of [";", "\t", ","] as const) {
    const antal = rader.map((r) => r.split(tecken).length - 1).filter((n) => n > 0);
    if (!antal.length) continue;
    const typ = new Map<number, number>();
    for (const n of antal) typ.set(n, (typ.get(n) ?? 0) + 1);
    const poang = Math.max(...typ.values());
    if (poang > bast.poang) bast = { tecken, poang };
  }
  return bast.tecken;
}

/**
 * Text ur en CSV-fil: UTF-8, men en svensk Excel-export i Windows-1252 ger
 * ersättningstecken -- då avkodas den om.
 */
export function avkodaText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(bytes);
  } catch {
    return utf8;
  }
}

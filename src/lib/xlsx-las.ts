/**
 * Läser första bladet i en Excel-fil (.xlsx) som en tabell, för
 * prislisteinläsningen i admin/pricing (src/lib/prisfil.ts).
 *
 * En .xlsx är en zip med XML-filer. Uppackningen görs av anroparen (fflate i
 * webbläsaren), så att den här filen saknar beroenden och kan provas med
 * `deno test tests/prisfil.test.ts`. Bara det en prislista behöver läses:
 * delade strängar, inbäddade strängar, tal och formelresultat. Gamla .xls
 * (binärformatet) stöds inte; anroparen ber då om .xlsx eller CSV.
 */

export type Cell = string | number | null;

const dec = new TextDecoder("utf-8");

function avkodaXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** All text i ett <si>- eller <is>-element (även formaterade delar, <r><t>…</t></r>). */
function textIElement(xml: string): string {
  let ut = "";
  // Uttal (<rPh>) hör inte till texten.
  const utanUttal = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  for (const m of utanUttal.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)) ut += m[1] ?? "";
  return avkodaXml(ut);
}

/** "A" → 0, "Z" → 25, "AA" → 26. */
function kolumnIndex(ref: string): number {
  const bokstaver = ref.replace(/\d+/g, "").toUpperCase();
  let n = 0;
  for (const c of bokstaver) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function attr(attrs: string, namn: string): string | null {
  const m = attrs.match(new RegExp(`(?:^|\\s)${namn}="([^"]*)"`));
  return m ? m[1] : null;
}

/** Sökvägen till första bladet enligt workbook.xml och dess relationer. */
function forstaBladet(filer: Record<string, Uint8Array>): string | null {
  const wb = filer["xl/workbook.xml"];
  const rels = filer["xl/_rels/workbook.xml.rels"];
  if (wb && rels) {
    const sheet = dec.decode(wb).match(/<sheet\b([^>]*)\/?>/);
    const rid = sheet ? attr(sheet[1], "r:id") : null;
    if (rid) {
      for (const m of dec.decode(rels).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        if (attr(m[1], "Id") === rid) {
          const target = attr(m[1], "Target") ?? "";
          const sti = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
          if (filer[sti]) return sti;
        }
      }
    }
  }
  const alla = Object.keys(filer).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
  return alla[0] ?? null;
}

/**
 * Första bladet som rader × celler. Tomma celler blir null, så kolumnerna
 * hamnar rätt även när en rad saknar värden i mitten.
 */
export function lasXlsx(filer: Record<string, Uint8Array>): Cell[][] {
  const sti = forstaBladet(filer);
  if (!sti) throw new Error("Filen ser inte ut som en Excel-fil (.xlsx). Spara den som .xlsx eller CSV och försök igen.");

  const delade: string[] = [];
  const ss = filer["xl/sharedStrings.xml"];
  if (ss) for (const m of dec.decode(ss).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)) delade.push(textIElement(m[1] ?? ""));

  const blad = dec.decode(filer[sti]);
  const rader: Cell[][] = [];
  for (const rm of blad.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const radAttr = rm[1] ?? rm[3] ?? "";
    const radNr = Number(attr(radAttr, "r")) || rader.length + 1;
    const rad: Cell[] = [];
    let nasta = 0;
    for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = cm[1];
      const inne = cm[2] ?? "";
      const ref = attr(a, "r");
      const kol = ref ? kolumnIndex(ref) : nasta;
      nasta = kol + 1;
      const typ = attr(a, "t");
      const v = inne.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
      let cell: Cell = null;
      if (typ === "s") cell = v != null ? (delade[Number(v)] ?? null) : null;
      else if (typ === "inlineStr") cell = textIElement(inne.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? "");
      else if (typ === "str") cell = v != null ? avkodaXml(v) : null;
      else if (typ === "b") cell = v === "1" ? "TRUE" : v === "0" ? "FALSE" : null;
      else if (typ === "e") cell = null;
      else if (v != null && v !== "") {
        const n = Number(v);
        cell = Number.isFinite(n) ? n : avkodaXml(v);
      }
      while (rad.length < kol) rad.push(null);
      rad[kol] = cell;
    }
    while (rader.length < radNr - 1) rader.push([]);
    rader[radNr - 1] = rad;
  }
  return rader;
}

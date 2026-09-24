/**
 * Inköpsordern som PDF.
 *
 * Rendering, inget annat: vad som SKA stå avgörs i po-document.ts, och om den
 * får skickas avgörs där också. Den här filen ritar.
 *
 * Varför pdf-lib och inte HTML: dokumentet ska mejlas som bilaga från en
 * edge-funktion. Resten av systemet gör PDF med window.print(), vilket kräver
 * en webbläsare och en människa -- det duger för en offert som kunden själv
 * skriver ut, men inte för något som ska skickas automatiskt.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";
import type { PoDokument } from "./po-document.ts";

const A4 = { bredd: 595.28, hojd: 841.89 };
const MARGINAL = 48;
const SVART = rgb(0.1, 0.1, 0.12);
const GRA = rgb(0.45, 0.45, 0.5);
const LINJE = rgb(0.85, 0.85, 0.88);
const VARNING = rgb(0.72, 0.42, 0.05);

/**
 * WinAnsi klarar svenska och det mesta i en katalog, men inte allt: ett
 * produktnamn kan bära ⌀ eller en grekisk bokstav, och pdf-lib KASTAR då i
 * stället för att rita. En inköpsorder får inte utebli för ett tecken.
 */
function latin(s: string): string {
  return (s ?? "")
    .replace(/[⌀∅]/g, "Ø")
    .replace(/[–—]/g, "-")
    .replace(/[”“]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    // Allt utanför Latin-1 blir en punkt hellre än ett undantag.
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ".");
}

/**
 * Klipper text som inte får plats, och säger att den är klippt.
 *
 * Utan de tre punkterna ser "ISO 2128" ut som ett riktigt värde i stället för
 * början på "ISO 21287" -- på en inköpsorder är det skillnaden mellan rätt och
 * fel artikel.
 */
function klipp(text: string, maxBredd: number, font: PDFFont, storlek: number): string {
  if (font.widthOfTextAtSize(text, storlek) <= maxBredd) return text;
  let kvar = text;
  while (kvar.length > 1 && font.widthOfTextAtSize(kvar + "...", storlek) > maxBredd) {
    kvar = kvar.slice(0, -1);
  }
  return kvar.trimEnd() + "...";
}

function belopp(n: number | null, valuta: string): string {
  if (n == null) return "-";
  return n.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + valuta;
}

interface Skriv {
  sida: PDFPage;
  y: number;
}

function rad(s: Skriv, text: string, x: number, storlek: number, font: PDFFont, farg = SVART) {
  s.sida.drawText(latin(text), { x, y: s.y, size: storlek, font, color: farg });
}

export async function renderaPoPdf(dok: PoDokument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const fet = await pdf.embedFont(StandardFonts.HelveticaBold);

  let sida = pdf.addPage([A4.bredd, A4.hojd]);
  const s: Skriv = { sida, y: A4.hojd - MARGINAL };
  const h = A4.bredd - MARGINAL;

  // ── Huvud ───────────────────────────────────────────────────────────────
  rad(s, "INKÖPSORDER", MARGINAL, 20, fet);
  rad(s, dok.poNumber, h - normal.widthOfTextAtSize(latin(dok.poNumber), 14), 14, fet);
  s.y -= 16;
  rad(s, "Purchase order", MARGINAL, 9, normal, GRA);
  s.y -= 22;

  // Avsändare och mottagare bredvid varandra.
  const kolumn2 = MARGINAL + 260;
  const topp = s.y;
  rad(s, "FRÅN", MARGINAL, 7.5, fet, GRA);
  rad(s, "TILL", kolumn2, 7.5, fet, GRA);
  s.y -= 13;
  for (const [vanster, hoger] of [
    [dok.foretag.name, dok.leverantor?.name ?? "(ingen leverantör)"],
    [dok.foretag.address, dok.leverantor?.contact_name ?? ""],
    [dok.foretag.postal, dok.leverantor?.order_email ?? ""],
    [`Org.nr ${dok.foretag.org}`, dok.leverantor?.customer_number ? `Vårt kundnr: ${dok.leverantor.customer_number}` : ""],
    [dok.foretag.email, ""],
    [dok.foretag.phone, ""],
  ]) {
    if (vanster) rad(s, vanster, MARGINAL, 9, normal);
    if (hoger) rad(s, hoger, kolumn2, 9, normal);
    s.y -= 12;
  }
  s.y = topp - 6 * 12 - 20;

  // ── Referenser ──────────────────────────────────────────────────────────
  sida.drawLine({ start: { x: MARGINAL, y: s.y + 8 }, end: { x: h, y: s.y + 8 }, thickness: 0.7, color: LINJE });
  s.y -= 6;
  const referenser: Array<[string, string]> = [
    ["Orderdatum", dok.datum],
    ["Önskad leverans", dok.onskadLeverans ?? "enligt normal ledtid"],
    ["Valuta", dok.valuta],
    ["Betalningsvillkor", dok.leverantor?.payment_terms ?? "enligt avtal"],
    ["Leveransvillkor", dok.leverantor?.incoterms ?? "enligt avtal"],
    ["Vår kundorder", dok.kundorder.order_number ?? "-"],
  ];
  let kol = 0;
  const kolbredd = (h - MARGINAL) / 3;
  const refTopp = s.y;
  for (const [etikett, varde] of referenser) {
    const x = MARGINAL + (kol % 3) * kolbredd;
    const y = refTopp - Math.floor(kol / 3) * 30;
    sida.drawText(latin(etikett), { x, y, size: 7.5, font: fet, color: GRA });
    sida.drawText(latin(varde), { x, y: y - 11, size: 9.5, font: normal, color: SVART });
    kol++;
  }
  s.y = refTopp - Math.ceil(referenser.length / 3) * 30 - 10;

  // ── Rader ───────────────────────────────────────────────────────────────
  const kolumner = [
    { x: MARGINAL, bredd: 26, rubrik: "Rad" },
    { x: MARGINAL + 26, bredd: 150, rubrik: "Artikel" },
    { x: MARGINAL + 176, bredd: 160, rubrik: "Benämning" },
    { x: MARGINAL + 336, bredd: 45, rubrik: "Antal" },
    { x: MARGINAL + 381, bredd: 60, rubrik: "À-pris" },
    { x: MARGINAL + 441, bredd: 66, rubrik: "Radsumma" },
  ];
  sida.drawRectangle({ x: MARGINAL, y: s.y - 4, width: h - MARGINAL, height: 18, color: rgb(0.96, 0.96, 0.97) });
  for (const k of kolumner) sida.drawText(latin(k.rubrik), { x: k.x + 3, y: s.y + 1, size: 7.5, font: fet, color: GRA });
  s.y -= 18;

  for (const r of dok.rader) {
    if (s.y < 150) {
      sida = pdf.addPage([A4.bredd, A4.hojd]);
      s.sida = sida;
      s.y = A4.hojd - MARGINAL;
    }
    const artikel = r.supplier_sku ? `${r.sku}\n(ert nr ${r.supplier_sku})` : r.sku;
    const varden = [
      String(r.line_no),
      artikel.split("\n")[0],
      r.name,
      String(r.qty),
      belopp(r.unit_purchase_price, ""),
      belopp(r.line_total_ex_vat, ""),
    ];
    varden.forEach((v, i) => {
      const k = kolumner[i];
      // Tal högerställs; text klipps hellre än att rinna in i nästa kolumn.
      const hogerstall = i >= 3;
      const visa = klipp(latin(v), k.bredd - 6, normal, 8.5);
      const bredd = normal.widthOfTextAtSize(visa, 8.5);
      s.sida.drawText(visa, {
        x: hogerstall ? k.x + k.bredd - 3 - bredd : k.x + 3,
        y: s.y, size: 8.5, font: normal, color: SVART,
      });
    });
    if (r.supplier_sku) {
      s.y -= 10;
      s.sida.drawText(latin(`ert nr ${r.supplier_sku}`), { x: kolumner[1].x + 3, y: s.y, size: 7, font: normal, color: GRA });
    }
    s.y -= 14;
    s.sida.drawLine({ start: { x: MARGINAL, y: s.y + 6 }, end: { x: h, y: s.y + 6 }, thickness: 0.4, color: LINJE });
  }

  // ── Summa ───────────────────────────────────────────────────────────────
  s.y -= 8;
  const summatext = dok.summa == null ? "Pris enligt avtal" : belopp(dok.summa, dok.valuta);
  const etikett = dok.raderUtanPris > 0 && dok.summa != null ? "Summa (rader med pris)" : "Summa exkl. moms";
  s.sida.drawText(latin(etikett), { x: h - 230, y: s.y, size: 9, font: normal, color: GRA });
  s.sida.drawText(latin(summatext), {
    x: h - fet.widthOfTextAtSize(latin(summatext), 11), y: s.y - 1, size: 11, font: fet, color: SVART,
  });
  s.y -= 30;

  if (dok.raderUtanPris > 0) {
    s.sida.drawText(latin(`Obs: ${dok.raderUtanPris} rad(er) saknar pris hos oss. Bekräfta gällande pris i ert svar.`),
      { x: MARGINAL, y: s.y, size: 8.5, font: normal, color: VARNING });
    s.y -= 18;
  }

  // ── Svarsinstruktion ────────────────────────────────────────────────────
  s.sida.drawRectangle({ x: MARGINAL, y: s.y - 44, width: h - MARGINAL, height: 52, color: rgb(0.97, 0.97, 0.99) });
  s.sida.drawText(latin("Så svarar ni"), { x: MARGINAL + 10, y: s.y - 4, size: 8.5, font: fet, color: SVART });
  s.sida.drawText(
    latin(`Ange ${dok.poNumber} i ämnesraden när ni bekräftar. Bekräfta artikel, antal, pris och leveransdatum per rad.`),
    { x: MARGINAL + 10, y: s.y - 18, size: 8.5, font: normal, color: SVART });
  s.sida.drawText(latin(`Frågor: ${dok.foretag.email} - ${dok.foretag.phone}`),
    { x: MARGINAL + 10, y: s.y - 31, size: 8.5, font: normal, color: GRA });

  // ── Sidfot ──────────────────────────────────────────────────────────────
  const sidor = pdf.getPages();
  sidor.forEach((p, i) => {
    p.drawText(latin(`${dok.foretag.name} - ${dok.foretag.web} - ${dok.poNumber} - sida ${i + 1} av ${sidor.length}`),
      { x: MARGINAL, y: 28, size: 7.5, font: normal, color: GRA });
  });

  return await pdf.save();
}

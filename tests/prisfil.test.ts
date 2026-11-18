/// <reference lib="deno.ns" />
// Körs med: deno test --allow-read tests/prisfil.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  avkodaText, byggIndex, decimaltecken, gissaAvgransare, hittaKolumner, iKronor, type KatalogArtikel, lasPrislista, marginalUrRad,
  matcha, omatchadeCsv, sammanfatta, tolkaTal,
} from "../src/lib/prisfil.ts";
import { lasXlsx } from "../src/lib/xlsx-las.ts";

// Artikelnummer i samma form som katalogen 2026-11-18.
const K: KatalogArtikel[] = [
  { id: "1", sku: "SMC-RB0806", name: "RB0806 Hydraulic Shock Absorber M8" },
  { id: "2", sku: "SMC-AKH06A-02S", name: "AKH backventil" },
  { id: "3", sku: "0822123009", name: "AVENTICS cylinder", brand: "AVENTICS" },
  { id: "4", sku: "FESTO-573606", name: "Festo 573606" },
  { id: "5", sku: "FE-MS4-LFR-14-D6", name: "Festo filterregulator" },
  { id: "6", sku: "PUN-6X1-SW", name: "Festo slang" },
  { id: "7", sku: "RA/8040/M/100", name: "Norgren RA" },
  { id: "8", sku: "P1D-S080MS-0250", name: "Parker P1D" },
  { id: "9", sku: "SMC-MGPM", name: "SMC MGPM serie", is_family: true },
  { id: "10", sku: "FESTO-DSNU-25", name: "Festo DSNU Ø25 serie", is_family: true },
  { id: "11", sku: "24N2A016A025", name: "Camozzi 24N" },
  { id: "12", sku: "QS-1/2-10", name: "Festo QS", extraNycklar: ["153036"] },
];

Deno.test("belopp i svensk, tysk och engelsk form", () => {
  assertEquals(tolkaTal("1 234,50 kr"), 1234.5);
  assertEquals(tolkaTal("1.234,50"), 1234.5);
  assertEquals(tolkaTal("1,234.50", "."), 1234.5);
  assertEquals(tolkaTal("1,234.50"), 1234.5, "båda tecknen: det sista är decimaltecknet");
  assertEquals(tolkaTal("1.234"), 1234, "punkt + tre siffror i en kommakolumn = tusental");
  assertEquals(tolkaTal("12,5"), 12.5);
  assertEquals(tolkaTal("12.5", "."), 12.5);
  assertEquals(tolkaTal("125:-"), 125);
  assertEquals(tolkaTal("€ 12,90"), 12.9);
  assertEquals(tolkaTal("1 049,00"), 1049);
  assertEquals(tolkaTal(1049.5), 1049.5);
  assertEquals(tolkaTal(""), null);
  assertEquals(tolkaTal("på förfrågan"), null);
  assertEquals(decimaltecken(["12,50", "1 049,00", "7,9"]), ",");
  assertEquals(decimaltecken(["12.50", "1,049.00", "7.9"]), ".");
});

Deno.test("matchning: våra prefix, Excels tappade nollor, skiljetecken, serier", () => {
  const ix = byggIndex(K);
  assertEquals(matcha("RB0806", ix).artikel?.sku, "SMC-RB0806");
  assertEquals(matcha("SMC-RB0806", ix).artikel?.sku, "SMC-RB0806");
  assertEquals(matcha("akh06a-02s", ix).artikel?.sku, "SMC-AKH06A-02S");
  assertEquals(matcha(822123009, ix).artikel?.sku, "0822123009", "Excel gjorde numret till ett tal");
  assertEquals(matcha("573606", ix).artikel?.sku, "FESTO-573606");
  assertEquals(matcha("153036", ix).artikel?.sku, "QS-1/2-10", "extra nyckel (type_code)");
  const k = matcha("AKH06A02S", ix);
  assertEquals([k.status, k.artikel?.sku], ["kontrollera", "SMC-AKH06A-02S"], "utan bindestreck ska granskas");
  assertEquals(matcha("MGPM", ix).status, "serie");
  assertEquals(matcha("MGPM16-50", ix).status, "saknas", "ett utförande är inte serien");
  assertEquals(matcha("XYZ-999", ix).status, "saknas");
  assertEquals(matcha("12", ix).status, "saknas", "för kort för att lita på");
});

Deno.test("RS-liknande CSV: rubrik efter titelrader, tillverkarens nummer, förpackning", () => {
  const tabell = [
    ["Offert 2026-11-20", "", "", "", ""],
    ["", "", "", "", ""],
    ["RS Stock No.", "Mfr. Part No.", "Description", "Pack Size", "Price (SEK)"],
    ["123-4567", "RB0806", "Shock absorber M8", "1", "412,00"],
    ["765-4321", "PUN-6X1-SW", "Tubing 6 mm, 50 m", "1", "1 049,00"],
    ["111-2222", "QS-1/2-10", "Fitting (pack of 10)", "10", "289,00"],
    ["333-4444", "ABC-123", "Not in catalogue", "1", "99,00"],
    ["555-6666", "MGPM", "Series", "1", "1 999,00"],
    ["777-8888", "RB0806", "Same again", "1", "415,00"],
  ];
  const ut = lasPrislista(tabell, K);
  assertEquals(ut.fel, null);
  assertEquals(ut.kolumner?.rubrikrad, 2);
  assertEquals(ut.filvaluta, "SEK");
  const [rb, pun, qs, abc, mgpm, dub] = ut.rader;
  assertEquals([rb.status, rb.artikel?.sku, rb.pris, rb.levKod], ["match", "SMC-RB0806", 412, "123-4567"]);
  assertEquals([pun.status, pun.pris], ["match", 1049]);
  assertEquals([qs.status, qs.pris, qs.forpackning], ["match", 28.9, 10]);
  assertEquals(abc.status, "saknas");
  assertEquals(mgpm.status, "serie");
  assertEquals(dub.status, "dubblett");
  assertEquals(sammanfatta(ut.rader), { match: 3, kontrollera: 0, flera: 0, serie: 1, saknas: 1, utan_pris: 0, dubblett: 1 });
  const csv = omatchadeCsv(ut.rader);
  assert(csv.includes("ABC-123") && csv.includes("MGPM") && !csv.includes("PUN-6X1-SW"));
});

Deno.test("listpris + rabatt, EUR i rubriken, punkt som decimaltecken", () => {
  const tabell = [
    ["Part number", "Description", "List price EUR", "Discount %"],
    ["P1D-S080MS-0250", "ISO cylinder", "200.00", "35"],
    ["24N2A016A025", "Camozzi", "41.50", "35"],
  ];
  const ut = lasPrislista(tabell, K);
  assertEquals(ut.filvaluta, "EUR");
  assertEquals(ut.rader.map((r) => [r.artikel?.sku, r.pris, r.valuta]), [
    ["P1D-S080MS-0250", 130, "EUR"],
    ["24N2A016A025", 26.975, "EUR"],
  ]);
  assertEquals(iKronor(130, "EUR", 11.5), 1495);
  assertEquals(iKronor(130, "EUR", null), null, "utan kurs inget kronpris");
  assertEquals(iKronor(130, "SEK", null), 130);
});

Deno.test("nettopris går före listpris; valutakolumn per rad", () => {
  const tabell = [
    ["Artikelnummer", "Listpris", "Nettopris", "Valuta"],
    ["RA/8040/M/100", "1000", "640", "SEK"],
    ["573606", "90", "61,20", "EUR"],
  ];
  const ut = lasPrislista(tabell, K);
  assertEquals(ut.rader.map((r) => [r.artikel?.sku, r.pris, r.valuta]), [
    ["RA/8040/M/100", 640, "SEK"],
    ["FESTO-573606", 61.2, "EUR"],
  ]);
  assertEquals(ut.filvaluta, null, "blandade valutor: ingen gemensam");
});

Deno.test("prissteg 1+/10+ ger styckpriset; vår mall läses också", () => {
  const steg = lasPrislista([["Mfr Part No", "10+", "1+"], ["RB0806", "380", "412"]], K);
  assertEquals(steg.rader[0].pris, 412);
  const mall = lasPrislista([["artikelnummer", "namn", "marke", "typ", "inkopspris", "marginal"], ["SMC-RB0806", "RB0806", "SMC", "specifik", "400", "20"]], K);
  assertEquals([mall.rader[0].status, mall.rader[0].pris], ["match", 400]);
  assertEquals(marginalUrRad(["SMC-RB0806", "", "", "", "400", "20"], mall.kolumner!), 20);
  const p = hittaKolumner([["sku", "pris", "pålägg"]])!;
  assertEquals(marginalUrRad(["x", "100", "25"], p), 20, "25 % pålägg = 20 % marginal");
});

Deno.test("stor prisändring och saknat pris flaggas", () => {
  const kat = [{ ...K[0], purchase_price: 400 }];
  const ut = lasPrislista([["Artikelnummer", "Pris"], ["RB0806", "1200"], ["RB0806X", ""]], [...kat, { id: "x", sku: "RB0806X", name: "x" }]);
  assertEquals(ut.rader[0].status, "kontrollera");
  assert(ut.rader[0].anm.some((a) => a.includes("stor ändring")));
  assertEquals(ut.rader[1].status, "utan_pris");
});

Deno.test("ingen rubrikrad ger ett begripligt fel", () => {
  const ut = lasPrislista([["foo", "bar"], ["1", "2"]], K);
  assert(ut.fel?.includes("rubrikrad"));
});

Deno.test("Windows-1252 från svensk Excel avkodas", () => {
  const bytes = new Uint8Array([0x69, 0x6e, 0x6b, 0xf6, 0x70, 0x73, 0x70, 0x72, 0x69, 0x73]); // "inköpspris"
  assertEquals(avkodaText(bytes), "inköpspris");
  assertEquals(avkodaText(new TextEncoder().encode("inköpspris")), "inköpspris");
});

Deno.test("Excel: delade och inbäddade strängar, tal, tomma celler", () => {
  const e = (s: string) => new TextEncoder().encode(s);
  const filer = {
    "xl/workbook.xml": e('<workbook><sheets><sheet name="Prislista" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": e('<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/sharedStrings.xml": e('<sst><si><t>Mfr. Part No.</t></si><si><r><t>Pri</t></r><r><t xml:space="preserve">s </t></r></si><si><t>RB0806 &amp; co</t></si></sst>'),
    "xl/worksheets/sheet1.xml": e(
      '<worksheet><sheetData>' +
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
        '<row r="3"><c r="A3" t="inlineStr"><is><t>0822123009</t></is></c><c r="C3"><v>412.5</v></c></row>' +
        '<row r="4"><c r="A4"><v>822123009</v></c><c r="B4" t="s"><v>2</v></c><c r="C4" t="str"><f>A1</f><v>99</v></c></row>' +
      '</sheetData></worksheet>',
    ),
  };
  const t = lasXlsx(filer);
  assertEquals(t[0], ["Mfr. Part No.", null, "Pris "]);
  assertEquals(t[1], []);
  assertEquals(t[2], ["0822123009", null, 412.5]);
  assertEquals(t[3], [822123009, "RB0806 & co", "99"]);
});

Deno.test("Excel-fil gjord av openpyxl läses hela vägen", async () => {
  // tests/fixtures/prislista-prov.xlsx görs av scripts/prislista-prov.py.
  const { unzipSync } = await import("npm:fflate@0.8.2");
  const bytes = await Deno.readFile(new URL("./fixtures/prislista-prov.xlsx", import.meta.url));
  const tabell = lasXlsx(unzipSync(bytes));
  const ut = lasPrislista(tabell, K);
  assertEquals(ut.fel, null);
  const per = Object.fromEntries(ut.rader.map((r) => [r.kod, r]));
  assertEquals(per["822123009"].artikel?.sku, "0822123009");
  assertEquals(per["RB0806"].pris, 412);
  assertEquals(per["QS-1/2-10"].pris, 28.9);
});

Deno.test("samma artikel två gånger i katalogen: priset gäller båda", () => {
  const kat: KatalogArtikel[] = [
    { id: "a", sku: "TU0604BU-20", name: "SMC TU", brand: "SMC" },
    { id: "b", sku: "SMC-TU0604BU-20", name: "SMC TU", brand: "SMC" },
    { id: "c", sku: "X-100", name: "x", brand: "Parker" },
    { id: "d", sku: "NOR-X-100", name: "x", brand: "Norgren" },
  ];
  const ut = lasPrislista([["Artikelnummer", "Pris"], ["TU0604BU-20", "189"], ["X-100", "50"]], kat);
  assertEquals(ut.rader[0].status, "kontrollera");
  assertEquals(ut.rader[0].alla?.map((a) => a.id), ["a", "b"]);
  assertEquals(ut.rader[1].status, "flera", "olika fabrikat: admin väljer");
  assertEquals(ut.rader[1].alla, undefined);
});

Deno.test("CSV-avgränsaren: semikolon även i en tvåkolumnsfil, komma i belopp", async () => {
  assertEquals(gissaAvgransare("Artikelnummer;Pris\r\n570077;1000\r\nR2-20;2000\r\n"), ";");
  assertEquals(gissaAvgransare("Artikelnummer;Pris\n570077;150,00\nR2-20;1 049,50\n"), ";");
  assertEquals(gissaAvgransare("Part,Price\nRB0806,412.00\nX-1,99.50\n"), ",");
  assertEquals(gissaAvgransare("Part\tPrice\nRB0806\t412,00\n"), "\t");
  const { default: Papa } = await import("npm:papaparse@5.5.3");
  const text = "Artikelnummer;Pris\r\nRB0806;412\r\n";
  const t = Papa.parse(text, { header: false, skipEmptyLines: false, delimiter: gissaAvgransare(text) }).data as unknown[][];
  assertEquals(lasPrislista(t, K).rader[0].artikel?.sku, "SMC-RB0806");
});

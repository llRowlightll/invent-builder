/**
 * Etiketten som visas i konfiguratorns knappar får inte sudda ut skillnader.
 *
 * `stripLeadingCode()` kapade vid 28 tecken. För korta etiketter märks det
 * inte, men P1D:s funktionsposition har tolv värden vars skillnader ligger
 * EFTER tecken 28 -- koderna A, H och W visades alla som
 * "Dubbelverkande, rostfria skr". Tre identiska knappar, tre olika cylindrar.
 *
 * Facit här är avskrivet ur databasen (configurator_param_values för p1d och
 * elektro) den 2026-09-12. Poängen är inte att frysa texterna utan att hålla
 * fast vid EGENSKAPEN: två värden i samma parameter ska aldrig renderas lika.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { LABEL_MAX, stripLeadingCode } from "../../../src/lib/catalog/order-code-template.ts";

/** P1D, parameter "function". Fyra grupper som föll ihop vid 28 tecken. */
const P1D_FUNCTION: Array<[string, string]> = [
  ["A", "Dubbelverkande, rostfria skruvar och muttrar"],
  ["H", "Dubbelverkande, rostfria skruvar, muttrar och kolvstång"],
  ["W", "Dubbelverkande, rostfria skruvar, muttrar, kolvstång och lock"],
  ["D", "Dubbelverkande, std skruvar, magnetkolv"],
  ["M", "Dubbelverkande, std skruvar, magnetkolv och lock"],
  ["V", "Dubbelverkande, std skruvar, magnetkolv, låsenhet"],
  ["B", "Genomgående kolvstång, std skruvar"],
  ["E", "Genomgående kolvstång, std skruvar och magnetkolv"],
  ["F", "Genomgående kolvstång, std skruvar, magnetkolv och lock"],
  ["G", "Genomgående kolvstång, rostfria skruvar"],
  ["Y", "Genomgående kolvstång, rostfria skruvar och magnetkolv"],
  ["Z", "Genomgående kolvstång, rostfria skruvar, magnetkolv och lock"],
];

/** ELEKTRO, parameter "version". Fyra par som skiljs först av IP-klassen. */
const ELEKTRO_VERSION: Array<[string, string]> = [
  ["1", "Direktkopplad, utan vridningsskydd, IP40/IP20"],
  ["2", "Direktkopplad, med vridningsskydd, IP40/IP20"],
  ["3", "Direktkopplad, utan vridningsskydd, IP55/IP65"],
  ["4", "Direktkopplad, med vridningsskydd, IP55/IP65"],
  ["5", "Kuggremsdriven, utan vridningsskydd, IP40/IP20"],
  ["6", "Kuggremsdriven, med vridningsskydd, IP40/IP20"],
  ["7", "Kuggremsdriven, utan vridningsskydd, IP55/IP65"],
  ["8", "Kuggremsdriven, med vridningsskydd, IP55/IP65"],
];

/** ELEKTRO, parameter "drive_pack". Nio bromsmotorer som föll ihop till en. */
const ELEKTRO_DRIVE_PACK: Array<[string, string]> = [
  ["4200", "Borstlös motor med broms, fläns 60, 0–0,79 Nm"],
  ["420E", "Borstlös motor med broms, fläns 60, 0–0,79 Nm, typ E"],
  ["4220", "Borstlös motor med broms, fläns 60, 1,2–2,19 Nm"],
  ["422E", "Borstlös motor med broms, fläns 60, 1,2–2,19 Nm, typ E"],
  ["4330", "Borstlös motor med broms, fläns 80, 2,2–3 Nm"],
  ["433E", "Borstlös motor med broms, fläns 80, 2,2–3 Nm, typ E"],
  ["4540", "Borstlös motor med broms, fläns 86, 3,01–5 Nm"],
  ["464E", "Borstlös motor med broms, fläns 100, 3,01–5 Nm, typ E"],
  ["4770", "Borstlös motor med broms, fläns 130, 7,01–10 Nm"],
  ["3220", "Stegmotor med broms och pulsgivare, fläns 60, 1,2–2,19 Nm"],
  ["3230", "Stegmotor med broms och pulsgivare, fläns 60, 2,2–3 Nm"],
  ["3430", "Stegmotor med broms och pulsgivare, fläns NEMA 34, 2,2–3 Nm"],
  ["3450", "Stegmotor med broms och pulsgivare, fläns NEMA 34, 6,21–7 Nm"],
  ["3460", "Stegmotor med broms och pulsgivare, fläns NEMA 34, 5,01–6,2 Nm"],
  ["3470", "Stegmotor med broms och pulsgivare, fläns NEMA 34, 7,01–10 Nm"],
];

const GRUPPER: Array<[string, Array<[string, string]>]> = [
  ["p1d/function", P1D_FUNCTION],
  ["elektro/version", ELEKTRO_VERSION],
  ["elektro/drive_pack", ELEKTRO_DRIVE_PACK],
];

Deno.test("två värden i samma parameter renderas aldrig lika", () => {
  const krockar: string[] = [];
  for (const [namn, par] of GRUPPER) {
    const sett = new Map<string, string>();
    for (const [code, label] of par) {
      const visat = stripLeadingCode(label, code);
      const tidigare = sett.get(visat);
      if (tidigare !== undefined) {
        krockar.push(`${namn}: ${tidigare} och ${code} visas båda som "${visat}"`);
      }
      sett.set(visat, code);
    }
  }
  assertEquals(krockar, [], krockar.join("\n"));
});

Deno.test("de tolv P1D-funktionerna ger tolv olika knappar", () => {
  // Den konkreta regressionen. Med taket på 28 blev det fyra.
  const visade = new Set(P1D_FUNCTION.map(([c, l]) => stripLeadingCode(l, c)));
  assertEquals(visade.size, 12, `${visade.size} skilda knappar av 12 möjliga`);
});

Deno.test("taket klipper fortfarande en orimligt lång etikett", () => {
  // Taket är höjt, inte borttaget. En etikett som spränger rutnätet ska
  // fortfarande stoppas.
  const lang = "x".repeat(200);
  assertEquals(stripLeadingCode(lang, "").length, LABEL_MAX);
  assertEquals(stripLeadingCode(lang, "A").length, LABEL_MAX);
});

Deno.test("taket rymmer varje etikett som finns i dag", () => {
  // Den längsta i databasen den 2026-09-12 är 62 tecken. Faller det här
  // testet har någon lagt in en längre och bör kontrollera att den ändå går
  // att skilja från sina grannar.
  const forLanga: string[] = [];
  for (const [namn, par] of GRUPPER) {
    for (const [code, label] of par) {
      if (stripLeadingCode(label, code).length >= LABEL_MAX) {
        forLanga.push(`${namn}/${code}: ${label.length} tecken`);
      }
    }
  }
  assertEquals(forLanga, [], forLanga.join("\n"));
});

Deno.test("kodprefixet klipps fortfarande bort", () => {
  // Höjningen får inte ha rört den ursprungliga uppgiften.
  assertEquals(stripLeadingCode("Q Med vridskydd", "Q"), "Med vridskydd");
  assertEquals(stripLeadingCode("D3 – Givarspår", "D3"), "Givarspår");
  assertEquals(stripLeadingCode("M5-gänga", "M5"), "M5-gänga", "bindestreck utan blanksteg är en sammansättning");
  assertEquals(stripLeadingCode("N3", "N3"), "N3", "blev inget kvar behålls originalet");
});

Deno.test("hela etiketten syns nu för de längsta", () => {
  // Det som var poängen: skillnaden ligger i slutet, och slutet ska synas.
  const [, langst] = ELEKTRO_DRIVE_PACK.find(([c]) => c === "3460")!;
  const visat = stripLeadingCode(langst, "3460");
  assertEquals(visat, langst);
  assert(visat.endsWith("5,01–6,2 Nm"), visat);
});

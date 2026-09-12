/**
 * RTC-HD-modellen mot Bosch Rexroths artikelnummertabell.
 *
 * Tabellen är avskriven, inte räknad -- numren ligger inte i någon ordning.
 * Det är skillnaden mot KPZ, där hela tabellen faller ut ur en regel, och den
 * skillnaden bestämmer hur modellen måste se ut.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  RTC_HD_BORES,
  RTC_HD_LIMITS,
  RTC_HD_SOURCE,
  RTC_HD_STROKES,
  RTC_HD_TABLE,
  parseRtcHdPartNo,
  rtcHdCatalogue,
  rtcHdForceN,
  rtcHdPartNo,
} from "../../../src/lib/catalog/rtc-hd.ts";

/** Katalogens egna kolvkrafter, chunk 0. Ø63 stod utanför det inlästa utdraget. */
const KATALOGENS_KRAFTER: Array<[number, number]> = [
  [16, 127], [25, 309], [32, 507], [40, 792], [50, 1237],
];

Deno.test("tabellen har 45 lagerförda artiklar", () => {
  // 6 + 7 + 9 + 9 + 7 + 7. Ø16 slutar vid 700 mm, Ø25 vid 800, och Ø50 och
  // Ø63 börjar först vid 400 -- katalogen skriver "-" i de rutorna.
  assertEquals(rtcHdCatalogue().length, 45);
  const perBorr = RTC_HD_BORES.map((b) => RTC_HD_TABLE[b.bore_mm].filter(Boolean).length);
  assertEquals(perBorr, [6, 7, 9, 9, 7, 7]);
});

Deno.test("varje artikelnummer är unikt", () => {
  // En avskriven tabell kan få dubbletter av ett slarvfel. En räknad kan inte.
  const nr = rtcHdCatalogue().map((a) => a.part_no);
  const dubbletter = nr.filter((x, i) => nr.indexOf(x) !== i);
  assertEquals(dubbletter, [], `dubbla nummer: ${dubbletter.join(", ")}`);
  assertEquals(new Set(nr).size, 45);
});

Deno.test("varje nummer har Rexroths form", () => {
  const fel = rtcHdCatalogue().filter((a) => !/^R480\d{6}$/.test(a.part_no)).map((a) => a.part_no);
  assertEquals(fel, [], `fel form: ${fel.join(", ")}`);
});

Deno.test("de tomma rutorna är tomma", () => {
  assertEquals(rtcHdPartNo(16, 800), null, "Ø16 slutar vid 700 mm");
  assertEquals(rtcHdPartNo(25, 900), null, "Ø25 slutar vid 800 mm");
  assertEquals(rtcHdPartNo(50, 200), null, "Ø50 börjar vid 400 mm");
  assertEquals(rtcHdPartNo(63, 300), null, "Ø63 börjar vid 400 mm");
  // ...och de fyllda är fyllda.
  assertEquals(rtcHdPartNo(16, 700), "R480156954");
  assertEquals(rtcHdPartNo(63, 400), "R480156946");
  assertEquals(rtcHdPartNo(32, 1000), "R480148582");
});

Deno.test("500 mm finns för alla sex borrningar", () => {
  // Den enda slaglängd hela raden är ifylld på, och den enda där numren ligger
  // i följd: R480147724 till R480147729.
  const femhundra = RTC_HD_BORES.map((b) => rtcHdPartNo(b.bore_mm, 500));
  assertEquals(femhundra, [
    "R480147724", "R480147725", "R480147726", "R480147727", "R480147728", "R480147729",
  ]);
});

Deno.test("artikelnumret går att läsa tillbaka", () => {
  const fel: string[] = [];
  for (const a of rtcHdCatalogue()) {
    const l = parseRtcHdPartNo(a.part_no);
    if (!l) { fel.push(`${a.part_no}: hittades inte`); continue; }
    if (l.bore_mm !== a.bore_mm || l.stroke_mm !== a.stroke_mm) {
      fel.push(`${a.part_no}: läste Ø${l.bore_mm} ${l.stroke_mm}mm`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
  assertEquals(parseRtcHdPartNo("R480000000"), null);
});

Deno.test("anslutningen följer borrningen", () => {
  const vantat: Record<number, string> = {
    16: "M7", 25: "G 1/8", 32: "G 1/8", 40: "G 1/4", 50: "G 1/4", 63: "G 3/8",
  };
  for (const b of RTC_HD_BORES) assertEquals(b.port, vantat[b.bore_mm], `Ø${b.bore_mm}`);
});

Deno.test("kraften räknas vid 6,3 bar, inte 6", () => {
  // Katalogen: "Pressure for determining piston forces 6,3 bar". Vid 6 bar
  // hade Ø16 blivit 121 N; katalogen säger 127.
  assertEquals(RTC_HD_LIMITS.force_reference_bar, 6.3);
  const fel: string[] = [];
  for (const [bore, katalogen] of KATALOGENS_KRAFTER) {
    const raknat = rtcHdForceN(bore);
    const avvikelse = Math.abs(raknat - katalogen) / katalogen;
    if (avvikelse > 0.01) fel.push(`Ø${bore}: katalogen ${katalogen} N, formeln ${raknat} N`);
  }
  assertEquals(fel, [], fel.join("\n"));
  // Vid 6 bar går det INTE ihop -- vilket är hela poängen med att skriva ut trycket.
  assert(Math.abs(rtcHdForceN(16, 6) - 127) / 127 > 0.04);
});

Deno.test("arbetstryck och temperatur ur katalogen", () => {
  assertEquals(RTC_HD_LIMITS.pressure_min_bar, 4);
  assertEquals(RTC_HD_LIMITS.pressure_max_bar, 8);
  assertEquals(RTC_HD_LIMITS.temp_min_c, -10);
  assertEquals(RTC_HD_LIMITS.temp_max_c, 60);
});

Deno.test("våra nuvarande artikelnummer är påhittade", () => {
  // R400769016 ... R400769063: samma nummer med borrningen påklistrad, och
  // slaglängden inte kodad någonstans trots att raderna påstår sex olika.
  // Katalogens nummer börjar på R480.
  for (const sku of ["R400769016", "R400769025", "R400769032", "R400769040", "R400769050", "R400769063"]) {
    assertEquals(parseRtcHdPartNo(sku), null, `"${sku}" finns inte i katalogen`);
    assert(!/^R480/.test(sku), "de har inte ens rätt serieprefix");
  }
  // Att alla sex delar prefix och skiljer sig bara i sista två siffror är
  // själva avslöjandet: ett riktigt artikelnummer bär slaglängden.
  const prefix = new Set(["R400769016", "R400769025", "R400769032"].map((s) => s.slice(0, 8)));
  assertEquals(prefix.size, 1, "alla har samma åtta första tecken");
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(RTC_HD_SOURCE.brand, "Bosch Rexroth");
  assertEquals(RTC_HD_SOURCE.edition, "2013-04-11");
  assertEquals(RTC_HD_STROKES.length, 9);
});

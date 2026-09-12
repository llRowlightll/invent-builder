/**
 * MFH-modellen mot Festos 76 artiklar.
 *
 * Familjen var kopplad till FEL DOKUMENT: databasen pekade på
 * festo-MH1-203291.pdf, "Solenoid valves MH1, miniature", där strängen "MFH"
 * förekommer noll gånger. Facit här är den riktiga katalogen.
 *
 * Det viktigaste testet är inte att uppslaget fungerar utan att de TVÅ
 * KODSYSTEMEN hålls isär: typkoden skriver G18/EX4 och artikelnamnet 1/8/EX,
 * och de två sista positionerna kommer i omvänd ordning.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  MFH_ARTICLES,
  MFH_FUNCTIONS,
  MFH_LIMITS,
  MFH_ORDER_CODE_TEMPLATE,
  MFH_SERIES,
  MFH_SOURCE,
  MFH_SWITCHING_MS,
  MFH_TECH,
  MFH_THREADS,
  MFH_TYPE_CODE_POSITIONS,
  mfhByPartNo,
  mfhComposeType,
  mfhByType,
  mfhFind,
  mfhFunctionsFor,
  mfhTech,
  mfhThreadsFor,
} from "../../../src/lib/catalog/mfh.ts";

Deno.test("76 artiklar, alla unika", () => {
  assertEquals(MFH_ARTICLES.length, 76);
  const nr = MFH_ARTICLES.map((a) => a.part_no);
  assertEquals(new Set(nr).size, 76, `dubbletter: ${nr.filter((x, i) => nr.indexOf(x) !== i)}`);
  const typer = MFH_ARTICLES.map((a) => a.type);
  assertEquals(new Set(typer).size, 76);
});

Deno.test("varje artikelnamn stämmer med sina egna fält", () => {
  // Namnet är avskrivet; fälten är utplockade ur det. Att bygga tillbaka
  // namnet ur fälten och jämföra fångar en avskrift som glidit.
  const fel: string[] = [];
  for (const a of MFH_ARTICLES) {
    const byggt = [
      a.series, a.fn, a.thread,
      a.b_variant ? "B" : "",
      a.ext_pilot ? "S" : "",
      a.atex ? "EX" : "",
    ].filter((x) => x !== "").join("-");
    if (byggt !== a.type) fel.push(`${a.part_no}: fälten ger "${byggt}", katalogen "${a.type}"`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("artikelnumren har Festos form", () => {
  const fel = MFH_ARTICLES.filter((a) => !/^\d{4,7}$/.test(a.part_no)).map((a) => a.part_no);
  assertEquals(fel, [], `fel form: ${fel.join(", ")}`);
});

Deno.test("KORSKONTROLL: 5/2 finns inte i G3/4, enligt två tabeller", () => {
  // Tekniska data har bara tre kolumner för 5/2 -- G1/8, G1/4 och G1/2.
  // Beställdatan har ingen enda 5/2-artikel i G3/4. Två oberoende tabeller,
  // samma slutsats.
  assertEquals(MFH_TECH.filter((t) => t.fn === "5").map((t) => t.thread), ["1/8", "1/4", "1/2"]);
  assertEquals(MFH_ARTICLES.filter((a) => a.fn === "5" && a.thread === "3/4"), []);
  // Och 3/2 har alla fyra i båda.
  assertEquals(MFH_TECH.filter((t) => t.fn === "3").length, 4);
  assert(MFH_ARTICLES.some((a) => a.fn === "3" && a.thread === "3/4"));
});

Deno.test("typkoden och artikelnamnet är OLIKA strängar", () => {
  // Tre skillnader samtidigt: gängan, ATEX-koden och ordningen på de två
  // sista positionerna.
  const a = mfhByType("MFH-3-1/8-S-EX")!;
  assert(a, "artikeln finns");
  assertEquals(a.part_no, "535900");

  // 1. Gängan skrivs olika.
  const g = MFH_THREADS.find((t) => t.code === "1/8")!;
  assertEquals(g.type_code, "G18");
  assert(a.type.includes("1/8"));
  assert(!a.type.includes("G18"));

  // 2. ATEX heter EX4 i typkoden, EX i namnet.
  const ex = MFH_TYPE_CODE_POSITIONS.find((p) => p.pos === "004")!;
  assertEquals([...ex.codes], ["", "EX4"]);
  assert(a.type.endsWith("-EX"));
  assert(!a.type.includes("EX4"));

  // 3. Ordningen är OMVÄND: typkoden har EX på position 004 och pilotluften
  //    på 005, medan artikelnamnet skriver -S före -EX.
  const posEx = MFH_TYPE_CODE_POSITIONS.findIndex((p) => p.pos === "004");
  const posPilot = MFH_TYPE_CODE_POSITIONS.findIndex((p) => p.pos === "005");
  assert(posEx < posPilot, "i typkoden kommer EX före pilotluften");
  assert(a.type.indexOf("-S") < a.type.indexOf("-EX"),
    `i artikelnamnet kommer -S före -EX: ${a.type}`);
});

Deno.test("uppslaget ger katalogens artikel", () => {
  assertEquals(mfhFind({ series: "MFH", fn: "3", thread: "1/8" })!.part_no, "7802");
  assertEquals(mfhFind({ series: "MFH", fn: "3", thread: "1/8", atex: true })!.part_no, "535897");
  assertEquals(mfhFind({ series: "MFH", fn: "3", thread: "1/8", ext_pilot: true })!.part_no, "7958");
  assertEquals(
    mfhFind({ series: "MFH", fn: "3", thread: "1/8", ext_pilot: true, atex: true })!.part_no,
    "535900",
  );
  // 5/2 i G3/4 finns inte.
  assertEquals(mfhFind({ series: "MFH", fn: "5", thread: "3/4" }), null);
});

Deno.test("varje artikel går att slå upp åt båda hållen", () => {
  const fel: string[] = [];
  for (const a of MFH_ARTICLES) {
    if (mfhByPartNo(a.part_no)?.type !== a.type) fel.push(`${a.part_no} via nummer`);
    if (mfhByType(a.type)?.part_no !== a.part_no) fel.push(`${a.type} via namn`);
    // b_variant hanteras inte av mfhFind -- den har inget fält i valet.
    if (a.b_variant) continue;
    const via = mfhFind({
      series: a.series, fn: a.fn, thread: a.thread,
      ext_pilot: a.ext_pilot, atex: a.atex,
    });
    if (via?.part_no !== a.part_no) fel.push(`${a.type} via val (fick ${via?.part_no})`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("databasens SKU-prefix stör inte uppslaget", () => {
  assertEquals(mfhByPartNo("FESTO-7802")!.type, "MFH-3-1/8");
  assertEquals(mfhByPartNo("7802")!.type, "MFH-3-1/8");
  assertEquals(mfhByPartNo("0000000"), null);
});

Deno.test("serierna har de funktioner katalogen ger dem", () => {
  // MFH finns som både 3/2 och 5/2. MOFH och VL/O bara som 3/2, och de
  // bistabila JH/JDH/JMFH/JMFDH bara som 5/2.
  assertEquals(mfhFunctionsFor("MFH").sort(), ["3", "5"]);
  assertEquals(mfhFunctionsFor("MOFH"), ["3"]);
  assertEquals(mfhFunctionsFor("VL/O"), ["3"]);
  assertEquals(mfhFunctionsFor("VL"), ["5"]);
  assertEquals(mfhFunctionsFor("JH"), ["5"]);
  assertEquals(mfhFunctionsFor("JDH"), ["5"]);
  assertEquals(mfhFunctionsFor("JMFH"), ["5"]);
  assertEquals(mfhFunctionsFor("JMFDH"), ["5"]);
});

Deno.test("gängorna per serie och funktion", () => {
  assertEquals(mfhThreadsFor("MFH", "3"), ["1/8", "1/4", "1/2", "3/4"]);
  assertEquals(mfhThreadsFor("MFH", "5"), ["1/8", "1/4", "1/2"]);
  assertEquals(mfhThreadsFor("JDH", "5"), ["1/8", "1/4"]);
  assertEquals(mfhThreadsFor("MFH", "9"), []);
});

Deno.test("MCH och MOCH står i typkoden men har inga artiklar", () => {
  // De är C-spolevarianter. Typkoden listar dem; beställdatan gör det inte.
  // Att modellera dem vore att erbjuda något dokumentet inte har.
  const serie = MFH_TYPE_CODE_POSITIONS.find((p) => p.pos === "001")!;
  assert(serie.codes.includes("MCH"));
  assert(serie.codes.includes("MOCH"));
  assertEquals(MFH_SERIES.find((s) => s.code === "MCH"), undefined);
  assertEquals(MFH_ARTICLES.filter((a) => a.series === "MCH" || a.series === "MOCH"), []);
});

Deno.test("nominell vidd och flöde växer med gängan", () => {
  const tre = MFH_TECH.filter((t) => t.fn === "3");
  for (let i = 1; i < tre.length; i++) {
    assert(tre[i].nominal_size_mm > tre[i - 1].nominal_size_mm, `vidd ${tre[i].thread}`);
    assert(tre[i].flow_lmin > tre[i - 1].flow_lmin, `flöde ${tre[i].thread}`);
  }
  assertEquals(mfhTech("3", "3/4")!.flow_lmin, 7500);
  assertEquals(mfhTech("5", "1/4")!.flow_lmin, 1000);
  assertEquals(mfhTech("5", "3/4"), null);
});

Deno.test("5/2 i G1/4 tål 8 bar, inte 10", () => {
  // Ett värde som är lätt att missa och dyrt att missa: alla andra tål 10.
  assertEquals(mfhTech("5", "1/4")!.pressure_max_bar, 8);
  assertEquals(mfhTech("5", "1/8")!.pressure_max_bar, 10);
  assertEquals(mfhTech("5", "1/2")!.pressure_max_bar, 10);
  for (const t of MFH_TECH.filter((x) => x.fn === "3")) {
    assertEquals(t.pressure_max_bar, 10, `3/2 ${t.thread}`);
  }
});

Deno.test("3/2 klarar undertryck", () => {
  // Katalogen: "Operating pressure -0.95 ... 10 bar". Det är en ventil som
  // går att använda i vakuum, och det står inte i databasen alls.
  assertEquals(MFH_LIMITS.pressure_min_bar, -0.95);
  assert(MFH_LIMITS.pressure_min_bar < 0);
});

Deno.test("B-varianten skrivs av, inte tolkas", () => {
  // -B finns bara på VL/O i G1/8 och står inte i typkodstabellen. Vad det
  // betyder går inte att utläsa, så det bevaras som text.
  const b = MFH_ARTICLES.filter((a) => a.b_variant);
  assertEquals(b.length, 2);
  assertEquals(b.map((a) => a.type).sort(), ["VL/O-3-1/8-B", "VL/O-3-1/8-B-EX"]);
  for (const a of b) {
    assertEquals(a.series, "VL/O");
    assertEquals(a.thread, "1/8");
  }
  // Och ingen annan gänga har den.
  assertEquals(MFH_ARTICLES.filter((a) => a.b_variant && a.thread !== "1/8"), []);
});

Deno.test("kopplingstiderna finns för alla fyra gängorna", () => {
  assertEquals(Object.keys(MFH_SWITCHING_MS).sort(), ["1/2", "1/4", "1/8", "3/4"]);
  // Den stora ventilen slår till långsammast.
  assert(MFH_SWITCHING_MS["3/4"].on > MFH_SWITCHING_MS["1/8"].on);
});

Deno.test("KORSKONTROLL: varje artikel har en ATEX-tvilling, exakt", () => {
  // 38 med ATEX och 38 utan -- och varje icke-ATEX-artikel har en tvilling
  // med samma serie, funktion, gänga, pilotluft och B-variant. Katalogen är
  // alltså PERFEKT symmetrisk i den dimensionen.
  //
  // Det är en stark kontroll av avskriften: hade jag tappat en rad, läst ett
  // artikelnummer fel eller satt fel flagga på någon av de 76 skulle
  // symmetrin brytas. Den gör det inte.
  const atex = MFH_ARTICLES.filter((a) => a.atex);
  assertEquals(atex.length, 38);
  assertEquals(MFH_ARTICLES.length - atex.length, 38);

  const utanTvilling: string[] = [];
  for (const a of MFH_ARTICLES.filter((x) => !x.atex)) {
    const t = MFH_ARTICLES.find((x) =>
      x.atex && x.series === a.series && x.fn === a.fn && x.thread === a.thread &&
      Boolean(x.ext_pilot) === Boolean(a.ext_pilot) && Boolean(x.b_variant) === Boolean(a.b_variant)
    );
    if (!t) utanTvilling.push(a.type);
  }
  assertEquals(utanTvilling, [], `saknar ATEX-tvilling: ${utanTvilling.join(", ")}`);

  // Och åt andra hållet.
  const utanBas: string[] = [];
  for (const a of atex) {
    const t = MFH_ARTICLES.find((x) =>
      !x.atex && x.series === a.series && x.fn === a.fn && x.thread === a.thread &&
      Boolean(x.ext_pilot) === Boolean(a.ext_pilot) && Boolean(x.b_variant) === Boolean(a.b_variant)
    );
    if (!t) utanBas.push(a.type);
  }
  assertEquals(utanBas, [], `ATEX utan motsvarande grundartikel: ${utanBas.join(", ")}`);
});

Deno.test("kompositionen ger katalogens namn för alla 76", () => {
  // Det här testet är det som gör det försvarbart att KOMPONERA namnet i
  // stället för att slå upp det. Faller det ska mallen bli en rullgardin.
  const fel: string[] = [];
  for (const a of MFH_ARTICLES) {
    if (mfhComposeType(a) !== a.type) fel.push(`${a.part_no}: ${mfhComposeType(a)} != ${a.type}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("konfiguratorns mall ger samma namn som modellen, för alla 76", () => {
  const kravs = new Set(["series", "fn", "thread"]);
  const fel: string[] = [];
  for (const a of MFH_ARTICLES) {
    const ut = fillOrderCodeTemplate(MFH_ORDER_CODE_TEMPLATE, {
      series: a.series, fn: a.fn, thread: a.thread,
      b_variant: a.b_variant ? "B" : "",
      ext_pilot: a.ext_pilot ? "S" : "",
      atex: a.atex ? "EX" : "",
    }, kravs);
    if (ut !== a.type) fel.push(`${a.part_no}: mallen gav "${ut}", katalogen "${a.type}"`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("den gamla mallen producerade ingen giltig kod", () => {
  const ut = fillOrderCodeTemplate("MFH-{size}-{function}-{voltage}-{connection}",
    { size: "5", function: "1", voltage: "24V", connection: "8" });
  assertEquals(ut, "MFH-5-1-24V-8");
  assertEquals(mfhByType(ut), null);
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(MFH_SOURCE.brand, "Festo");
  assertEquals(MFH_SOURCE.edition, "2026/07");
  assertEquals(MFH_SOURCE.file, "festo-MFH-203756.pdf");
  assertEquals(MFH_SERIES.length, 8);
  assertEquals(MFH_FUNCTIONS.length, 2);
  assertEquals(MFH_THREADS.length, 4);
  assertEquals(MFH_LIMITS.ip_rating, "IP65");
});

/**
 * P1D-modellen mot facit.
 *
 * Skillnaden mot DSBC: här kommer facit ur VÅR EGEN katalog. De 25 koderna
 * nedan är rader som redan ligger i products och som vi säljer -- parsern måste
 * kunna reproducera dem exakt. DSBC fick sitt facit ur Festos katalog; det här
 * är hårdare, för koderna har passerat verkligheten.
 *
 * Det första de avslöjade: den gamla mallen
 * "P1D-S{bore_mm}M{thread}-{stroke_mm}" producerar "P1D-S50MS-200". Ingen av de
 * 25 ser ut så -- alla har nollutfyllnad, "P1D-S050MS-0200". Mallen kunde
 * alltså inte skapa en enda beställbar kod.
 *
 * Det andra: position 10 var BAKVÄND i första modellen. Testet
 * "position 10 är katalogens ordning" nedan finns för att den aldrig ska
 * kunna vända sig igen.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  P1D_BORES,
  P1D_ORDER,
  P1D_ORDER_CODE_TEMPLATE,
  P1D_POSITIONS,
  P1D_RULES,
  P1D_SOURCE,
  P1D_STANDARD_STROKES,
  buildP1dCode,
  decodeRodExtension,
  encodeRodExtension,
  parseP1dCode,
} from "../../../src/lib/catalog/p1d.ts";
import { buildP1dDbRules } from "../../../src/lib/catalog/p1d-db-rules.ts";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";

/** Ur products, 2026-09-11. Rader vi säljer. */
const FACIT = [
  ["P1D-S032MS-0100", 32, 100], ["P1D-S032MS-0200", 32, 200],
  ["P1D-S040MS-0100", 40, 100], ["P1D-S040MS-0200", 40, 200],
  ["P1D-S040MS-0250", 40, 250], ["P1D-S040MS-0400", 40, 400],
  ["P1D-S050MS-0100", 50, 100], ["P1D-S050MS-0200", 50, 200],
  ["P1D-S050MS-0250", 50, 250], ["P1D-S050MS-0400", 50, 400],
  ["P1D-S050MS-0500", 50, 500], ["P1D-S063MS-0100", 63, 100],
  ["P1D-S063MS-0200", 63, 200], ["P1D-S063MS-0250", 63, 250],
  ["P1D-S063MS-0400", 63, 400], ["P1D-S063MS-0500", 63, 500],
  ["P1D-S080MS-0100", 80, 100], ["P1D-S080MS-0200", 80, 200],
  ["P1D-S080MS-0250", 80, 250], ["P1D-S080MS-0400", 80, 400],
  ["P1D-S080MS-0500", 80, 500], ["P1D-S100MS-0100", 100, 100],
  ["P1D-S100MS-0200", 100, 200], ["P1D-S125MS-0100", 125, 100],
  ["P1D-S125MS-0250", 125, 250],
] as const;

/** Mallen som ligger i configurator_families -- härledd, inte skriven. */
const MALL = P1D_ORDER_CODE_TEMPLATE;

const bas = {
  version: "S", bore_mm: "050", function: "M", rod_material: "S",
  position_11: "-", stroke_mm: 200, atex: "nej",
};
const kor = (c: Record<string, unknown>, sev: "error" | "warn" = "error") =>
  P1D_RULES.filter((r) => r.severity === sev && evalLogic(r.when, c)).map((r) => r.note);

Deno.test("facit: alla 25 katalogkoder parsar med rätt borrning och slag", () => {
  assertEquals(FACIT.length, 25);
  const fel: string[] = [];
  for (const [kod, bore, slag] of FACIT) {
    const c = parseP1dCode(kod);
    if (!c) { fel.push(`${kod}: parsade inte`); continue; }
    if (c.bore_mm !== bore) fel.push(`${kod}: borrning ${c.bore_mm}, väntade ${bore}`);
    if (c.stroke_mm !== slag) fel.push(`${kod}: slag ${c.stroke_mm}, väntade ${slag}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("facit: varje kod byggs tillbaka till exakt sig själv", () => {
  // Det här är testet som fäller nollutfyllnaden.
  const trasiga: string[] = [];
  for (const [kod] of FACIT) {
    const ater = buildP1dCode(parseP1dCode(kod)!);
    if (ater !== kod) trasiga.push(`${kod} -> ${ater}`);
  }
  assertEquals(trasiga, [], trasiga.join("\n"));
});

Deno.test("nollutfyllnaden är inte valfri", () => {
  // Den gamla mallen gav "P1D-S50MS-200". Ingen sådan artikel finns.
  const c = { version: "S", bore_mm: "50", function: "M", rod_material: "S", stroke_mm: 200 };
  assertEquals(buildP1dCode(c), "P1D-S050MS-0200");
});

Deno.test("koden är positionell — fel form parsas inte", () => {
  for (const bad of [
    "P1D-S50MS-200",       // saknar nollutfyllnad
    "P1D-S050MS-200",      // slaglängden för kort
    "P1D-S050M-0200",      // materialpositionen saknas
    "P1D-X050MS-0200",     // okänt utförande
    "P1D-S050MQ-0200",     // okänt kolvstångsmaterial
    "P1D-S055MS-0200",     // borrning som inte finns
    "P1D-S050MS-0200NDN",  // 18 tecken -- varken 15 eller 20
    "DSBC-50-100-PPSA-N3", // annan familj
  ]) {
    assertEquals(parseP1dCode(bad), null, `"${bad}" borde inte parsa`);
  }
});

Deno.test("borrningarna är nollutfyllda i modellen", () => {
  const bore = P1D_POSITIONS.find((p) => p.key === "bore_mm");
  assertEquals((bore?.values ?? []).map((v) => v.code),
    ["032", "040", "050", "063", "080", "100", "125"]);
  assertEquals(P1D_BORES, [32, 40, 50, 63, 80, 100, 125]);
});

Deno.test("slaglängden går till 2800 mm, inte 2000", () => {
  // Katalogen: "Max stroke 2800 mm" / "Special strokes up to 2800 mm".
  // Databasen sa 2000 -- exakt samma fel som DSBC hade, och samma orsak:
  // ett handskrivet värde bredvid ett oläst dokument.
  const s = P1D_POSITIONS.find((p) => p.key === "stroke_mm");
  assertEquals(s?.range?.max, 2800);
});

Deno.test("alla facitkoder har ISO 4393-standardslag", () => {
  const avvikande = FACIT
    .filter(([, , slag]) => !P1D_STANDARD_STROKES.includes(slag))
    .map(([k]) => k);
  assertEquals(avvikande, [], `ej standardslag: ${avvikande.join(", ")}`);
});

Deno.test("position 10 är katalogens ordning, inte den omvända", () => {
  // Första modellen läste materialkolumnen bakvänt och fick S = kromad
  // rostfri. Katalogen (chunk 66 och 72) säger "S C M R / Stainless steel /
  // Chromium-plated steel / Acid-proof steel / Chrom.-pl. stainless steel",
  // och standardartikeln P1D-S***MS har enligt chunk 64, 70 och 47 en
  // ROSTFRI kolvstång. Alltså S = rostfritt.
  const mat = P1D_POSITIONS.find((p) => p.key === "rod_material")!.values!;
  assertEquals(mat.map((v) => v.code), ["S", "C", "M", "R"]);
  assert(/[Rr]ostfritt stål/.test(mat[0].label_sv), `S ska vara rostfritt, är "${mat[0].label_sv}"`);
  assert(/standard/i.test(mat[0].label_sv), "S är katalogens standardmaterial");
  assert(/förkromat stål/.test(mat[1].label_sv), `C ska vara förkromat stål, är "${mat[1].label_sv}"`);
  assert(/[Ss]yrafast/.test(mat[2].label_sv), `M ska vara syrafast, är "${mat[2].label_sv}"`);
  assert(/förkromat rostfritt/.test(mat[3].label_sv), `R ska vara förkromat rostfritt, är "${mat[3].label_sv}"`);
  // Den fysiska kontrollen: låsenheten kräver hård yta, och det är precis de
  // två förkromade (C och R) katalogen tillåter med lås.
  assert(/förkromat/.test(mat[1].label_sv) && /förkromat/.test(mat[3].label_sv),
    "C och R -- de lås-tillåtna -- måste båda vara förkromade");
});

Deno.test("låsningsvillkoren avvisar det katalogen förbjuder", () => {
  assertEquals(kor(bas), [], "standardkonfigurationen ska vara ren");
  // "S and M not in combination with rod lock device"
  assert(kor({ ...bas, version: "L" }).includes("P2"));
  assert(kor({ ...bas, version: "H", rod_material: "M" }).includes("P2"));
  // "Only for piston rod material type C and R"
  assertEquals(kor({ ...bas, version: "L", rod_material: "C" }), [], "C är tillåtet med lås");
  assertEquals(kor({ ...bas, version: "H", rod_material: "R" }), [], "R är tillåtet med lås");
});

Deno.test("ATEX-noten gäller bara standardutförandet", () => {
  const atex = { ...bas, atex: "ja" };
  assertEquals(kor(atex), [], "P1D-S***MS-**** är den kod ATEX-noten gäller");
  assert(kor({ ...atex, version: "C" }).includes("P4"), "annat utförande måste flaggas");
  assert(kor({ ...atex, function: "F" }).includes("P4"), "genomgående kolvstång måste flaggas");
});

Deno.test("Pro Clean har ingen genomgående kolvstång", () => {
  // Chunk 116, fotnot 6: "Not for the P1D-C Pro Clean version".
  assert(kor({ ...bas, version: "C", position_11: "T", function: "F" }).includes("P5"));
  // Ultra Clean (N) omfattas inte av den noten.
  assert(!kor({ ...bas, version: "C", position_11: "N", function: "F" }).includes("P5"));
});

Deno.test("Ultra Clean varnar utanför sitt katalogförda intervall", () => {
  // "P1D-C Ultra Clean in bore sizes 32 to 80 mm and strokes up to 700 mm."
  const c = { ...bas, version: "C", position_11: "N" };
  assertEquals(kor(c, "warn"), [], "Ø50 / 200 mm ligger innanför");
  assert(kor({ ...c, bore_mm: "100" }, "warn").includes("P6"), "Ø100 ligger utanför");
  assert(kor({ ...c, stroke_mm: 800 }, "warn").includes("P6"), "800 mm ligger utanför");
  // Men standardcylindern ska inte varna för samma mått.
  assert(!kor({ ...bas, bore_mm: "100" }, "warn").includes("P6"));
});

Deno.test("HDPE-avstrykare kan inte kombineras med låsenhet", () => {
  // Chunk 74, fotnot 23: torrgångsutförandet gäller "Not for P1D-L and H".
  assert(kor({ ...bas, version: "L", rod_material: "C", function: "D" }).includes("P7"));
  assert(kor({ ...bas, version: "H", rod_material: "R", function: "Y" }).includes("P7"));
  assertEquals(kor({ ...bas, version: "L", rod_material: "C", function: "M" }), [],
    "std avstrykare är tillåten med lås");
});

Deno.test("specialslag varnar men avvisas inte", () => {
  const c = { ...bas, stroke_mm: 333 };
  assertEquals(kor(c), [], "333 mm är beställbart");
  assertEquals(kor(c, "warn"), ["P3"], "men ska varna om leveranstid");
});

Deno.test("kolvstångsförlängning: katalogens eget exempel", () => {
  // "KR5 = Cylinder bore 32 mm with piston rod extension = 255 mm"
  const c = parseP1dCode("P1D-SKR5MS-0320")!;
  assert(c, "KR5-formen måste parsa");
  assertEquals(c.bore_mm, 32);
  assertEquals(c.rod_extension_mm, 255);
  assertEquals(c.stroke_mm, 320);
  assertEquals(c.bore_code, "KR5");
  // Och tillbaka igen.
  assertEquals(buildP1dCode(c), "P1D-SKR5MS-0320");
});

Deno.test("förlängningens kodning stämmer i hela intervallet", () => {
  // 01-99 = 1-99 mm, A0 = 100, Z9 = 339. Bokstäverna hoppar över I och O.
  assertEquals(encodeRodExtension(1), "01");
  assertEquals(encodeRodExtension(99), "99");
  assertEquals(encodeRodExtension(100), "A0");
  assertEquals(encodeRodExtension(255), "R5");
  assertEquals(encodeRodExtension(339), "Z9");
  assertEquals(encodeRodExtension(340), null, "max är 339 mm");
  assertEquals(encodeRodExtension(0), null);
  const fel: string[] = [];
  for (let mm = 1; mm <= 339; mm++) {
    const kod = encodeRodExtension(mm);
    if (!kod) { fel.push(`${mm}: ingen kod`); continue; }
    if (/[IO]/.test(kod)) fel.push(`${mm}: ${kod} använder I eller O`);
    if (decodeRodExtension(kod) !== mm) fel.push(`${mm} -> ${kod} -> ${decodeRodExtension(kod)}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("katalogens 15-eller-20-regel håller", () => {
  // "Remember that there are always 15 or 20 positions in the order number
  //  — never any figure in between." (chunk 64)
  assertEquals(parseP1dCode("P1D-S032MS-0100")!.digits, 15);
  const lang = parseP1dCode("P1D-S050MS-0250NDNNN")!;
  assertEquals(lang.digits, 20, "exemplet med centrerad mellantapp");
  assertEquals(lang.options, "NDNNN");
  assertEquals(lang.stroke_mm, 250);
  for (const mellan of ["P1D-S050MS-0250N", "P1D-S050MS-0250ND", "P1D-S050MS-0250NDNN"]) {
    assertEquals(parseP1dCode(mellan), null, `"${mellan}" ligger mellan 15 och 20`);
  }
});

Deno.test("position 11 bär ren design utan att ändra kodlängden", () => {
  const c = parseP1dCode("P1D-C032MSN0100");
  assert(c, "Ultra Clean-koden måste parsa");
  assertEquals(c!.position_11, "N");
  assertEquals(c!.digits, 15, "N ersätter bindestrecket, den förlänger inte koden");
  assertEquals(buildP1dCode(c!), "P1D-C032MSN0100");
});

Deno.test("påbyggd ventil kräver 20-teckensformen", () => {
  // En siffra i position 11 betyder ventil, och ventilfunktionen ligger i
  // positionerna 16-20 -- 15-teckensformen kan inte bära den.
  assertEquals(parseP1dCode("P1D-S032MS10100"), null, "siffra i pos 11 utan 16-20");
  assert(parseP1dCode("P1D-S032MS10100NANNN"), "med 16-20 är den giltig");
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(P1D_SOURCE.edition, "PDE2570TCUK");
  assertEquals(P1D_SOURCE.file, "Parker P1D ISO cylinder current.pdf");
});

Deno.test("konfiguratorns mall reproducerar alla 25 katalogkoder", () => {
  // Samma bindning som DSBC fick: det KUNDEN SER i konfiguratorn testas mot
  // facit, inte bara modellen mot sig själv. Mallen ligger i
  // configurator_families och körs genom samma motor som sidan använder.
  const kravs = new Set(["bore_mm", "stroke_mm"]);
  const trasiga: string[] = [];
  for (const [kod] of FACIT) {
    const c = parseP1dCode(kod)!;
    const sel: Record<string, string> = {};
    for (const [k, v] of Object.entries(c)) if (v !== null) sel[k] = String(v);
    const byggd = fillOrderCodeTemplate(MALL, sel, kravs);
    if (byggd !== kod) trasiga.push(`${kod} -> ${byggd}`);
  }
  assertEquals(trasiga, [], trasiga.join("\n"));
});

Deno.test("mallen bär position 11 — annars går ren design inte att beställa", () => {
  const sel = {
    version: "C", bore_mm: "32", function: "M", rod_material: "S",
    position_11: "N", stroke_mm: "100",
  };
  assertEquals(fillOrderCodeTemplate(MALL, sel), "P1D-C032MSN0100");
});

Deno.test("utan utfyllnad blir koden obeställbar", () => {
  // Den gamla mallen, utan #-markörerna.
  const gammal = "P1D-S{bore_mm}M{thread}-{stroke_mm}";
  const ut = fillOrderCodeTemplate(gammal, { bore_mm: "50", thread: "S", stroke_mm: "200" });
  assertEquals(ut, "P1D-S50MS-200");
  assert(!FACIT.some(([k]) => k === ut), "den koden finns inte i katalogen");
  assertEquals(parseP1dCode(ut), null, "och parsern känner inte igen den");
});

Deno.test("databasreglerna säger samma sak som modellen", () => {
  // Översättningen till JSON-logik testas separat från källan: mallen i
  // PR #190 var korrekt härledd och tappade ändå 15 av 21 positioner.
  const db = buildP1dDbRules();
  const noter = new Set(P1D_RULES.map((r) => r.note));
  const fall: Array<Record<string, unknown>> = [
    bas,
    { ...bas, version: "L" },
    { ...bas, version: "L", rod_material: "C" },
    { ...bas, version: "H", rod_material: "M" },
    { ...bas, version: "H", rod_material: "R", function: "Y" },
    { ...bas, atex: "ja", version: "C" },
    { ...bas, stroke_mm: 333 },
    { ...bas, version: "C", position_11: "T", function: "F" },
    { ...bas, version: "C", position_11: "N", bore_mm: "100" },
  ];
  const avvikelser: string[] = [];
  for (const c of fall) {
    const modell = P1D_RULES.filter((r) => evalLogic(r.when, c)).map((r) => r.note).sort();
    const databas = db
      .filter((r) => r.goto_step && noter.has(r.goto_step) && evalLogic(r.if_json, c))
      .map((r) => r.goto_step!).sort();
    if (modell.join(",") !== databas.join(",")) {
      avvikelser.push(`${JSON.stringify(c)}: modell [${modell}] vs databas [${databas}]`);
    }
  }
  assertEquals(avvikelser, [], avvikelser.join("\n"));
});

Deno.test("databasreglerna fångar slag och borrning utanför katalogen", () => {
  const db = buildP1dDbRules();
  const trig = (c: Record<string, unknown>) =>
    db.filter((r) => evalLogic(r.if_json, c)).map((r) => r.goto_step);
  assert(trig({ ...bas, stroke_mm: 3000 }).includes("p1d-slag"));
  assert(trig({ ...bas, bore_mm: "055" }).includes("p1d-storlek"));
  assert(!trig({ ...bas, bore_mm: "050" }).includes("p1d-storlek"));
  assert(!trig(bas).includes("p1d-slag"));
});

Deno.test("varje variabel en regel läser finns som fält i konfiguratorn", () => {
  // DEN HÄR INVARIANTEN ÄR POÄNGEN MED HELA FILEN.
  //
  // En regel som läser ett fält konfiguratorn inte erbjuder blir aldrig sann:
  // evalLogic slår upp undefined, och `undefined == "ja"` är falskt. Regeln
  // syns i databasen, går att granska, ser riktig ut -- och larmar aldrig.
  //
  // Det var precis vad som hände P1D:s ATEX-villkor: P4 läste `atex`, men
  // P1D hade ingen ATEX-fråga (för Festo är ATEX en kodposition, för Parker
  // en not). Regeln fanns och var död. Nu finns frågan, och det här testet
  // ser till att nästa regel inte kan läggas till utan sitt fält.
  const fields = new Set(P1D_POSITIONS.map((p) => p.key));

  const varsIn = (node: unknown, acc: Set<string>): Set<string> => {
    if (Array.isArray(node)) { for (const n of node) varsIn(n, acc); return acc; }
    if (node && typeof node === "object") {
      for (const [op, arg] of Object.entries(node as Record<string, unknown>)) {
        if (op === "var") acc.add(String(Array.isArray(arg) ? arg[0] : arg));
        else varsIn(arg, acc);
      }
    }
    return acc;
  };

  const saknas: string[] = [];
  for (const r of buildP1dDbRules()) {
    for (const v of varsIn(r.if_json, new Set())) {
      if (!fields.has(v)) saknas.push(`${r.goto_step ?? "?"} läser "${v}"`);
    }
  }
  assertEquals(saknas, [], `regler utan fält:\n${saknas.join("\n")}`);
});

Deno.test("mallen täcker varje kodposition, och bara dem", () => {
  // Samma bindning som DSBC fick efter PR #190, där en handskriven mall
  // täckte 6 av 21 positioner och CI ändå var grön.
  const iMall = [...MALL.matchAll(/\{([^}:#]+)(?::[A-Z]+)?(?:#\d)?\}/g)].map((m) => m[1]);
  assertEquals(iMall, P1D_ORDER, "mallens positioner i kodens ordning");
  // atex är en fråga, inte en position -- den ska INTE stå i koden.
  assert(!iMall.includes("atex"), "ATEX är en not i katalogen, inte ett tecken i koden");
  // ...men den ska finnas som fält, annars kan P4 aldrig larma.
  assert(P1D_POSITIONS.some((p) => p.key === "atex"), "ATEX-frågan måste finnas");
});

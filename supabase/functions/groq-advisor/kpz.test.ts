/**
 * KPZ-modellen mot AVENTICS beställtabell.
 *
 * Facit nedan är AVSKRIVET ur katalogen, rad för rad, precis som tabellen står
 * tryckt (chunk 9-10 i f518f8d2b406b9b6ddf8f2d5e2bb02ac.pdf). Modellen RÄKNAR
 * fram samma nummer ur regeln 0822-39-<borrindex>-<slagindex>. Går de två isär
 * är det regeln som är fel, för facit är vad tillverkaren faktiskt säljer.
 *
 * Skillnaden mot DSBC och P1D är värd att notera: de har modulära
 * beställnycklar där en typkod byggs ihop av positioner. KPZ har ingen kod alls
 * -- man slår upp borrning och slag i en tabell. Konfiguratorn hade ändå en
 * mall, "KPZ-{bore_mm}-{stroke_mm}", och products sexton rader på formen
 * "KPZ-016-0025-A-0-PPV". Den strängen förekommer inte i katalogen.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import {
  KPZ_BORES,
  KPZ_SERIE,
  KPZ_SOURCE,
  KPZ_STROKES,
  kpzCatalogue,
  kpzPartNo,
  parseKpzPartNo,
} from "../../../src/lib/catalog/kpz.ts";

/**
 * Tabell 1 ur katalogen: Ø16, 20, 25, 32, 40. Rader = slaglängd.
 * "-" är rutor tabellen lämnar tomma.
 */
const TABELL_1: Array<[number, string[]]> = [
  [5, ["0822390000", "0822391000", "0822392000", "0822393000", "0822394000"]],
  [10, ["0822390001", "0822391001", "0822392001", "0822393001", "0822394001"]],
  [15, ["0822390002", "0822391002", "0822392002", "0822393002", "0822394002"]],
  [20, ["0822390003", "0822391003", "0822392003", "0822393003", "0822394003"]],
  [25, ["0822390004", "0822391004", "0822392004", "0822393004", "0822394004"]],
  [30, ["0822390005", "0822391005", "0822392005", "0822393005", "0822394005"]],
  [40, ["0822390006", "0822391006", "0822392006", "0822393006", "0822394006"]],
  [50, ["0822390007", "0822391007", "0822392007", "0822393007", "0822394007"]],
  [60, ["0822390008", "0822391008", "0822392008", "0822393008", "0822394008"]],
  [80, ["-", "-", "-", "0822393009", "0822394009"]],
  [100, ["-", "-", "-", "0822393010", "0822394010"]],
];
const TABELL_1_BORR = [16, 20, 25, 32, 40];

/** Tabell 2 ur katalogen: Ø50, 63, 80, 100. Inga tomma rutor. */
const TABELL_2: Array<[number, string[]]> = [
  [5, ["0822395000", "0822396000", "0822397000", "0822398000"]],
  [10, ["0822395001", "0822396001", "0822397001", "0822398001"]],
  [15, ["0822395002", "0822396002", "0822397002", "0822398002"]],
  [20, ["0822395003", "0822396003", "0822397003", "0822398003"]],
  [25, ["0822395004", "0822396004", "0822397004", "0822398004"]],
  [30, ["0822395005", "0822396005", "0822397005", "0822398005"]],
  [40, ["0822395006", "0822396006", "0822397006", "0822398006"]],
  [50, ["0822395007", "0822396007", "0822397007", "0822398007"]],
  [60, ["0822395008", "0822396008", "0822397008", "0822398008"]],
  [80, ["0822395009", "0822396009", "0822397009", "0822398009"]],
  [100, ["0822395010", "0822396010", "0822397010", "0822398010"]],
];
const TABELL_2_BORR = [50, 63, 80, 100];

/** Facit som (borrning, slag, artikelnummer), platt. */
function facit(): Array<[number, number, string]> {
  const ut: Array<[number, number, string]> = [];
  for (const [tabell, borr] of [[TABELL_1, TABELL_1_BORR], [TABELL_2, TABELL_2_BORR]] as const) {
    for (const [stroke, rad] of tabell) {
      rad.forEach((nr, i) => { if (nr !== "-") ut.push([borr[i], stroke, nr]); });
    }
  }
  return ut;
}

Deno.test("facit: katalogen trycker 93 artiklar", () => {
  // 9 borrningar × 11 slaglängder = 99, minus de sex rutor de tre minsta
  // borrningarna lämnar tomma vid 80 och 100 mm.
  assertEquals(facit().length, 93);
  assertEquals(kpzCatalogue().length, 93);
});

Deno.test("varje artikelnummer i katalogen räknas fram av regeln", () => {
  // Det HÄR testet är hela poängen: modellen räknar, katalogen trycker, och
  // de två måste ge exakt samma 93 nummer.
  const fel: string[] = [];
  for (const [bore, stroke, nr] of facit()) {
    const raknat = kpzPartNo(bore, stroke);
    if (raknat !== nr) fel.push(`Ø${bore} ${stroke}mm: regeln gav ${raknat}, katalogen säger ${nr}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("regeln hittar inte på artiklar katalogen saknar", () => {
  const iKatalogen = new Set(facit().map(([, , nr]) => nr));
  const paHittade = kpzCatalogue().map((a) => a.part_no).filter((nr) => !iKatalogen.has(nr));
  assertEquals(paHittade, [], `nummer modellen hittat på: ${paHittade.join(", ")}`);
});

Deno.test("de tomma rutorna är tomma också i modellen", () => {
  // Tabellen skriver "-" för Ø16/20/25 vid 80 och 100 mm. Att sälja dem vore
  // att sälja något som inte finns.
  for (const bore of [16, 20, 25]) {
    for (const stroke of [80, 100]) {
      assertEquals(kpzPartNo(bore, stroke), null, `Ø${bore} ${stroke}mm ska inte finnas`);
    }
  }
  // ...men samma slaglängder FINNS från Ø32 och uppåt.
  assertEquals(kpzPartNo(32, 80), "0822393009");
  assertEquals(kpzPartNo(100, 100), "0822398010");
});

Deno.test("artikelnumret går att läsa tillbaka", () => {
  const fel: string[] = [];
  for (const [bore, stroke, nr] of facit()) {
    const l = parseKpzPartNo(nr);
    if (!l) { fel.push(`${nr}: parsade inte`); continue; }
    if (l.bore_mm !== bore || l.stroke_mm !== stroke) {
      fel.push(`${nr}: läste Ø${l.bore_mm} ${l.stroke_mm}mm, väntade Ø${bore} ${stroke}mm`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
  // Och nummer utanför tabellen ska inte läsas som giltiga.
  assertEquals(parseKpzPartNo("0822399000"), null, "borrindex 9 finns inte");
  assertEquals(parseKpzPartNo("0822390011"), null, "slagindex 011 finns inte");
  assertEquals(parseKpzPartNo("0822390009"), null, "Ø16 har ingen 80 mm-ruta");
});

Deno.test("Ø20 finns i katalogen — den saknas i vår databas", () => {
  // Databasen listar 16/25/32/40/50/63/80/100. Katalogen har nio borrningar.
  // En storlek som inte erbjuds är en förlorad affär, inte bara en lucka.
  assert(KPZ_BORES.some((b) => b.bore_mm === 20), "Ø20 ska finnas");
  assertEquals(KPZ_BORES.map((b) => b.bore_mm), [16, 20, 25, 32, 40, 50, 63, 80, 100]);
});

Deno.test("beställtabellen slutar vid 100 mm, tekniska data vid 300 respektive 500", () => {
  // Skillnaden är densamma som P1D:s mellan ISO 4393-standard och specialmått:
  // längre slag går att få, men inte ur den här tabellen.
  assertEquals(KPZ_STROKES[KPZ_STROKES.length - 1], 100);
  for (const b of KPZ_BORES) {
    const vantat = b.bore_mm >= 80 ? 500 : 300;
    assertEquals(b.stroke_max_mm, vantat, `Ø${b.bore_mm}`);
  }
});

Deno.test("kraften stämmer med π/4·d²·p vid 6,3 bar", () => {
  // Katalogen skriver ut trycket: "Pressure for determining piston forces
  // 6,3 bar". Första versionen av det här testet jämförde mot 6 bar med 6 %
  // tolerans och passerade -- toleransen dolde att trycket var fel.
  //
  // Vid rätt tryck stämmer värdena på tiondelen, så toleransen kan vara 1 %.
  // Ett test som passerar av slapphet bevisar ingenting.
  const fel: string[] = [];
  for (const b of KPZ_BORES) {
    const teoretisk = Math.round((Math.PI / 4) * b.bore_mm ** 2 * 6.3 * 0.1);
    const avvikelse = Math.abs(teoretisk - b.force_extend_n) / b.force_extend_n;
    if (avvikelse > 0.01) {
      fel.push(`Ø${b.bore_mm}: katalogen ${b.force_extend_n} N, formeln ${teoretisk} N (${(avvikelse * 100).toFixed(1)} %)`);
    }
    if (b.force_retract_n >= b.force_extend_n) {
      fel.push(`Ø${b.bore_mm}: indragande kraft måste vara mindre än utskjutande`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(KPZ_SOURCE.brand, "AVENTICS");
  assertEquals(KPZ_SOURCE.file, "f518f8d2b406b9b6ddf8f2d5e2bb02ac.pdf");
});

Deno.test("våra nuvarande artikelnummer är inte KPZ-artiklar", () => {
  // Dokumenterar fyndet i kod. Faller det här testet har någon rättat
  // produktraderna -- och då ska testet uppdateras, inte tas bort.
  for (const sku of [
    "KPZ-016-0025-A-0-PPV",
    "KPZ-040-0400-A-0-PPV",   // 400 mm; tabellen slutar vid 100
    "KPZ-100-0100-A-0-PPV",
  ]) {
    assertEquals(parseKpzPartNo(sku), null, `"${sku}" är ingen AVENTICS-artikel`);
  }
});

/** Mallen som ligger i configurator_families, och regeln i config_rules. */
const MALL = `${KPZ_SERIE}{bore_mm}{stroke_mm}`;
const REGEL = {
  and: [
    { in: [{ var: "bore_mm" }, ["0", "1", "2"]] },
    { in: [{ var: "stroke_mm" }, ["009", "010"]] },
  ],
};

Deno.test("konfiguratorns mall producerar alla 93 riktiga artikelnummer", () => {
  // Samma bindning som DSBC och P1D fick: det KUNDEN SER testas mot katalogen,
  // inte bara modellen mot sig själv.
  //
  // Knepet som gör det möjligt: parameterns code bär INDEX, inte millimeter.
  // "082239" + borrindex + slagindex ÄR artikelnumret. Den gamla mallen
  // "KPZ-{bore_mm}-{stroke_mm}" gav "KPZ-40-50", som inte finns någonstans.
  const kravs = new Set(["bore_mm", "stroke_mm"]);
  const trasiga: string[] = [];
  for (const [bore, stroke, nr] of facit()) {
    const b = KPZ_BORES.find((x) => x.bore_mm === bore)!;
    const sel = {
      bore_mm: String(b.index),
      stroke_mm: String(KPZ_STROKES.indexOf(stroke)).padStart(3, "0"),
    };
    const byggd = fillOrderCodeTemplate(MALL, sel, kravs);
    if (byggd !== nr) trasiga.push(`Ø${bore} ${stroke}mm: mallen gav ${byggd}, katalogen säger ${nr}`);
  }
  assertEquals(trasiga, [], trasiga.join("\n"));
});

Deno.test("regeln stänger exakt de sex tomma rutorna — varken fler eller färre", () => {
  const stangd: string[] = [];
  const oppen: string[] = [];
  for (const b of KPZ_BORES) {
    for (let i = 0; i < KPZ_STROKES.length; i++) {
      const ctx = { bore_mm: String(b.index), stroke_mm: String(i).padStart(3, "0") };
      const larmar = evalLogic(REGEL, ctx) === true;
      const finns = kpzPartNo(b.bore_mm, KPZ_STROKES[i]) !== null;
      if (larmar && finns) oppen.push(`Ø${b.bore_mm} ${KPZ_STROKES[i]}mm larmar fast den finns`);
      if (!larmar && !finns) stangd.push(`Ø${b.bore_mm} ${KPZ_STROKES[i]}mm finns inte men larmar inte`);
    }
  }
  assertEquals([...oppen, ...stangd], [], [...oppen, ...stangd].join("\n"));
});

/**
 * EPCO-modellen mot Festos 28 färdiga artikelnummer.
 *
 * Det här är det starkaste facit vi haft sedan KPZ. Katalogen trycker inte
 * bara en nyckel utan tjugoåtta ARTIKELNUMMER med sina typkoder bredvid
 * ("50 1476415 EPCO-16-50-3P-ST-E"). Modellen ska reproducera varenda en.
 *
 * Därutöver två fysikaliska kryss som inte har med koden att göra alls, och
 * som därför kan falla oberoende av den: kraft x stigning är motorns moment,
 * hastighet / stigning dess varvtal. Båda ska vara nästan konstanta inom en
 * storlek, eftersom det är samma motor.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  EPCO_ARTICLES,
  EPCO_BUS,
  EPCO_CABLES,
  EPCO_CONDITIONS,
  EPCO_LIMITS,
  EPCO_MODULE_NO,
  EPCO_ORDER_CODE_TEMPLATE,
  EPCO_SIZES,
  EPCO_SOURCE,
  EPCO_SPINDLES,
  epcoBuildCode,
  epcoByPartNo,
  epcoForcePitchProduct,
  epcoParseCode,
  epcoSpeedPitchRatio,
  epcoSpindle,
} from "../../../src/lib/catalog/epco.ts";

Deno.test("FACIT: alla 28 artiklar reproduceras ur modellen", () => {
  // Varje rad i katalogens beställtabell, byggd ur nyckeln. Alla är "with
  // encoder", alltså mätsystem E och ingen positionsavkänning.
  const fel: string[] = [];
  for (const a of EPCO_ARTICLES) {
    const kod = epcoBuildCode({
      size: a.size, stroke_mm: a.stroke_mm, pitch: a.pitch, measuring: "E",
    });
    if (kod !== a.type_code) {
      fel.push(`${a.part_no}: modellen gav "${kod}", katalogen "${a.type_code}"`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
  assertEquals(EPCO_ARTICLES.length, 28);
});

Deno.test("artikelnumren är unika och har Festos form", () => {
  const nr = EPCO_ARTICLES.map((a) => a.part_no);
  assertEquals(new Set(nr).size, 28, `dubbletter: ${nr.filter((x, i) => nr.indexOf(x) !== i)}`);
  const fel = EPCO_ARTICLES.filter((a) => !/^\d{7}$/.test(a.part_no)).map((a) => a.part_no);
  assertEquals(fel, [], `fel form: ${fel.join(", ")}`);
});

Deno.test("varje artikels typkod går att läsa tillbaka", () => {
  const fel: string[] = [];
  for (const a of EPCO_ARTICLES) {
    const r = epcoParseCode(a.type_code);
    if (!r) { fel.push(`${a.type_code}: parsade inte`); continue; }
    if (r.size !== a.size || r.stroke_mm !== a.stroke_mm || r.pitch !== a.pitch) {
      fel.push(`${a.type_code}: läste ${r.size}/${r.stroke_mm}/${r.pitch}`);
    }
    if (!r.has_encoder) fel.push(`${a.type_code}: pulsgivaren tappades`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("KORSKONTROLL: kraft gånger stigning är motorns moment", () => {
  // Samma storlek har samma motor. Produkten kraft x stigning ska därför vara
  // ungefär lika för båda stigningarna. Storlek 25 stämmer exakt:
  // 350 N x 3 mm = 105 N x 10 mm = 1050. De andra inom sex procent.
  const fel: string[] = [];
  for (const s of EPCO_SIZES) {
    const sp = EPCO_SPINDLES.filter((x) => x.size === s.size);
    assertEquals(sp.length, 2, `storlek ${s.size} ska ha två stigningar`);
    const [a, b] = sp.map(epcoForcePitchProduct);
    const avvikelse = Math.abs(a - b) / Math.max(a, b);
    if (avvikelse > 0.07) {
      fel.push(`storlek ${s.size}: ${a} mot ${b}, ${(avvikelse * 100).toFixed(1)} % isär`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
  // Och storlek 25 ska stämma på decimalen.
  const s25 = EPCO_SPINDLES.filter((x) => x.size === 25).map(epcoForcePitchProduct);
  assertEquals(s25[0], s25[1], "storlek 25: 350x3 ska vara lika med 105x10");
  assertEquals(s25[0], 1050);
});

Deno.test("KORSKONTROLL: hastighet delad med stigning är motorns varvtal", () => {
  const fel: string[] = [];
  for (const s of EPCO_SIZES) {
    const sp = EPCO_SPINDLES.filter((x) => x.size === s.size);
    const [a, b] = sp.map(epcoSpeedPitchRatio);
    const avvikelse = Math.abs(a - b) / Math.max(a, b);
    if (avvikelse > 0.12) {
      fel.push(`storlek ${s.size}: ${a.toFixed(1)} mot ${b.toFixed(1)} varv/s`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
  const s25 = EPCO_SPINDLES.filter((x) => x.size === 25).map(epcoSpeedPitchRatio);
  assertEquals(s25[0], s25[1], "storlek 25: 150/3 ska vara lika med 500/10");
  assertEquals(s25[0], 50);
});

Deno.test("stigningarna är storleksberoende", () => {
  assertEquals(EPCO_SIZES.find((s) => s.size === 16)!.pitches, ["3P", "8P"]);
  assertEquals(EPCO_SIZES.find((s) => s.size === 25)!.pitches, ["3P", "10P"]);
  assertEquals(EPCO_SIZES.find((s) => s.size === 40)!.pitches, ["5P", "12.7P"]);
  // 8P finns bara på storlek 16.
  assertEquals(epcoBuildCode({ size: 25, stroke_mm: 100, pitch: "8P", measuring: "E" }), null);
  assertEquals(epcoBuildCode({ size: 16, stroke_mm: 100, pitch: "10P", measuring: "E" }), null);
  assert(epcoBuildCode({ size: 16, stroke_mm: 100, pitch: "8P", measuring: "E" }));
});

Deno.test("KORSKONTROLL: slaglistans ytterpunkter stämmer med tekniska data", () => {
  // Beställtabellen listar diskreta slag; tekniska data ger intervallet
  // 50…200, 50…300 och 50…400 mm. Två tabeller, samma gränser.
  const franTekniskaData: Record<number, [number, number]> = {
    16: [50, 200], 25: [50, 300], 40: [50, 400],
  };
  for (const s of EPCO_SIZES) {
    const [min, max] = franTekniskaData[s.size];
    assertEquals(Math.min(...s.strokes), min, `storlek ${s.size} minsta slag`);
    assertEquals(Math.max(...s.strokes), max, `storlek ${s.size} största slag`);
  }
});

Deno.test("slaglängden är en LISTA, inte ett intervall", () => {
  // Databasen hade 1-3000 mm. Katalogen har elva diskreta värden, och 110 mm
  // är inte ett av dem hur rimligt det än låter.
  assert(epcoBuildCode({ size: 25, stroke_mm: 250, pitch: "3P", measuring: "E" }));
  assertEquals(epcoBuildCode({ size: 25, stroke_mm: 110, pitch: "3P", measuring: "E" }), null);
  assertEquals(epcoBuildCode({ size: 25, stroke_mm: 350, pitch: "3P", measuring: "E" }), null,
    "350 finns bara på storlek 40");
  assert(epcoBuildCode({ size: 40, stroke_mm: 350, pitch: "5P", measuring: "E" }));
  assertEquals(epcoBuildCode({ size: 16, stroke_mm: 250, pitch: "3P", measuring: "E" }), null);
});

Deno.test("villkor [1]: positionsavkänning krävs utan pulsgivare", () => {
  // Katalogens fotnot: "A Must be selected if encoder E is not selected."
  assert(EPCO_CONDITIONS.sensing_required_without_encoder);
  assertEquals(
    epcoBuildCode({ size: 16, stroke_mm: 100, pitch: "3P" }),
    null,
    "varken pulsgivare eller givare",
  );
  assertEquals(
    epcoBuildCode({ size: 16, stroke_mm: 100, pitch: "3P", position_sensing: "A" }),
    "EPCO-16-100-3P-A-ST",
  );
  assertEquals(
    epcoBuildCode({ size: 16, stroke_mm: 100, pitch: "3P", measuring: "E" }),
    "EPCO-16-100-3P-ST-E",
  );
});

Deno.test("villkor [2]: styrenheten går inte ihop med förlängd kolvstång", () => {
  assert(epcoBuildCode({ size: 25, stroke_mm: 100, pitch: "3P", measuring: "E", guide_unit: "KF" }));
  assert(epcoBuildCode({ size: 25, stroke_mm: 100, pitch: "3P", measuring: "E", extension_mm: 50 }));
  assertEquals(
    epcoBuildCode({ size: 25, stroke_mm: 100, pitch: "3P", measuring: "E", guide_unit: "KF", extension_mm: 50 }),
    null,
  );
});

Deno.test("villkor [3]: kabel och styrning kräver pulsgivare", () => {
  assertEquals(
    epcoBuildCode({ size: 25, stroke_mm: 100, pitch: "3P", position_sensing: "A", cable: "5E" }),
    null,
    "kabel utan pulsgivare",
  );
  assert(epcoBuildCode({ size: 25, stroke_mm: 100, pitch: "3P", measuring: "E", cable: "5E" }));
  assertEquals(
    epcoBuildCode({ size: 25, stroke_mm: 100, pitch: "3P", position_sensing: "A", controller: "C5", bus: "DIO", switching: "P" }),
    null,
    "styrning utan pulsgivare",
  );
});

Deno.test("villkor [4]: styrningen kräver bussprotokoll och in-/utgång", () => {
  const bas = { size: 25, stroke_mm: 100, pitch: "3P", measuring: "E" };
  assertEquals(epcoBuildCode({ ...bas, controller: "C5" }), null, "utan buss");
  assertEquals(epcoBuildCode({ ...bas, controller: "C5", bus: "DIO" }), null, "utan in-/utgång");
  assert(epcoBuildCode({ ...bas, controller: "C5", bus: "DIO", switching: "P" }));
});

Deno.test("villkor [5]: NPN går inte ihop med IO-Link", () => {
  const bas = { size: 25, stroke_mm: 100, pitch: "3P", measuring: "E", controller: "C5" };
  assert(epcoBuildCode({ ...bas, bus: "LK", switching: "P" }));
  assertEquals(epcoBuildCode({ ...bas, bus: "LK", switching: "N" }), null);
  assert(epcoBuildCode({ ...bas, bus: "DIO", switching: "N" }));
});

Deno.test("kolvstångsförlängningens tak är storleksberoende", () => {
  // Sida 26: 1…100 för storlek 16, 1…150 för 25, 1…200 för 40.
  assertEquals(EPCO_SIZES.map((s) => s.extension_max_mm), [100, 150, 200]);
  assert(epcoBuildCode({ size: 16, stroke_mm: 100, pitch: "3P", measuring: "E", extension_mm: 100 }));
  assertEquals(
    epcoBuildCode({ size: 16, stroke_mm: 100, pitch: "3P", measuring: "E", extension_mm: 101 }),
    null,
  );
  assert(epcoBuildCode({ size: 40, stroke_mm: 100, pitch: "5P", measuring: "E", extension_mm: 200 }));
  // Och den skrivs med E efter talet.
  assertEquals(
    epcoBuildCode({ size: 40, stroke_mm: 100, pitch: "5P", measuring: "E", extension_mm: 25 }),
    "EPCO-40-100-5P-25E-ST-E",
  );
});

Deno.test("ovalda positioner utelämnas helt", () => {
  // Samma konvention som DSBC och EGC-FA: inga tomma segment, inga dubbla
  // bindestreck.
  const fullt = epcoBuildCode({
    size: 40, stroke_mm: 200, pitch: "12.7P", rod_thread: "F",
    measuring: "E", brake: "B", cable_direction: "L", guide_unit: "KF",
    cable: "5EA", controller: "C5", bus: "LK", switching: "P",
  })!;
  assertEquals(fullt, "EPCO-40-200-12.7P-F-ST-E-B-L-KF-5EA-C5-LK-P");
  assert(!fullt.includes("--"), "inga tomma segment");
  const minimalt = epcoBuildCode({ size: 16, stroke_mm: 50, pitch: "3P", measuring: "E" })!;
  assertEquals(minimalt, "EPCO-16-50-3P-ST-E");
  assert(!minimalt.includes("--"));
});

Deno.test("artikelnumret går att slå upp", () => {
  assertEquals(epcoByPartNo("1476415")!.type_code, "EPCO-16-50-3P-ST-E");
  // Databasens SKU bär FESTO-prefix.
  assertEquals(epcoByPartNo("FESTO-1476415")!.type_code, "EPCO-16-50-3P-ST-E");
  assertEquals(epcoByPartNo("9999999"), null);
});

Deno.test("konfiguratorns mall ger samma kod som modellen", () => {
  const kravs = new Set(["size", "stroke_mm", "pitch"]);
  const fall: Array<Record<string, string>> = [
    { size: "16", stroke_mm: "50", pitch: "3P", measuring: "E" },
    { size: "40", stroke_mm: "300", pitch: "12.7P", measuring: "E", brake: "B" },
    { size: "25", stroke_mm: "250", pitch: "10P", position_sensing: "A", rod_thread: "F" },
  ];
  const vantat = [
    "EPCO-16-50-3P-ST-E",
    "EPCO-40-300-12.7P-ST-E-B",
    "EPCO-25-250-10P-F-A-ST",
  ];
  for (let i = 0; i < fall.length; i++) {
    assertEquals(fillOrderCodeTemplate(EPCO_ORDER_CODE_TEMPLATE, fall[i], kravs), vantat[i],
      JSON.stringify(fall[i]));
  }
});

Deno.test("den gamla mallen producerade ingen giltig kod", () => {
  const ut = fillOrderCodeTemplate("EPCO-{size}-{stroke_mm}-{drive}",
    { size: "16", stroke_mm: "100", drive: "ballscrew" });
  assertEquals(ut, "EPCO-16-100-ballscrew");
  assertEquals(epcoParseCode(ut), null);
});

Deno.test("EPCO finns bara med kulskruv", () => {
  // Databasen erbjöd kuggrem och trapetsskruv. Katalogen, sida 8:
  // "Design: Electric cylinder with ball screw and motor". Positionen efter
  // slaget är SKRUVSTIGNINGEN, inte en drivningstyp.
  const stigningar = new Set(EPCO_SPINDLES.map((s) => s.code));
  assertEquals([...stigningar].sort(), ["10P", "12.7P", "3P", "5P", "8P"]);
  for (const pahittad of ["belt", "ballscrew", "leadscrew"]) {
    assertEquals(epcoBuildCode({ size: 16, stroke_mm: 100, pitch: pahittad, measuring: "E" }), null);
  }
});

Deno.test("styrningen är KF eller ingen — inte glid- eller rullager", () => {
  // Databasen hade plain/roller/ball. Katalogens position 012 har ETT värde.
  assertEquals(
    epcoBuildCode({ size: 25, stroke_mm: 100, pitch: "3P", measuring: "E", guide_unit: "plain" }),
    null,
  );
  assert(epcoBuildCode({ size: 25, stroke_mm: 100, pitch: "3P", measuring: "E", guide_unit: "KF" }));
});

Deno.test("ogiltiga koder avvisas", () => {
  assertEquals(epcoParseCode(""), null);
  assertEquals(epcoParseCode("EPCO-16-50-3P"), null, "motorkoden saknas");
  assertEquals(epcoParseCode("EPCS-16-50-3P-ST-E"), null, "fel serie");
  assertEquals(epcoParseCode("EPCO-20-50-3P-ST-E"), null, "storlek 20 finns inte");
  assertEquals(epcoParseCode("EPCO-16-60-3P-ST-E"), null, "slag 60 finns inte");
  assertEquals(epcoParseCode("EPCO-16-50-4P-ST-E"), null, "stigning 4P finns inte");
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(EPCO_SOURCE.brand, "Festo");
  assertEquals(EPCO_SOURCE.edition, "2022/07");
  assertEquals(EPCO_SOURCE.file, "festo-EPCO-203027.pdf");
  assertEquals(Object.keys(EPCO_MODULE_NO).length, 3);
  assertEquals(EPCO_LIMITS.max_acceleration_ms2, 10);
  assertEquals(EPCO_CABLES.length, 11);
  assertEquals(EPCO_BUS.length, 3);
});

Deno.test("varje storlek och stigning har skruvdata", () => {
  const fel: string[] = [];
  for (const s of EPCO_SIZES) {
    for (const p of s.pitches) {
      if (!epcoSpindle(s.size, p)) fel.push(`${s.size}/${p}`);
    }
  }
  assertEquals(fel, [], `saknar skruvdata: ${fel.join(", ")}`);
  assertEquals(EPCO_SPINDLES.length, 6);
});

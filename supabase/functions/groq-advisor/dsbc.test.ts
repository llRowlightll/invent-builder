/**
 * DSBC-modellen mot Festos katalog.
 *
 * Det här testet är hela poängen med övningen. Katalogen var inläst i
 * kunskapsbanken sedan 2026-05-19, men modellen bredvid den fylldes i för hand
 * -- och innehöll fyra optionskoder (S2, KP, S6, TT) som inte förekommer en
 * enda gång i dokumentet, samt en maxslaglängd på 2000 mm när katalogen säger
 * 2800. Ingenting jämförde de två, så felen låg kvar i månader.
 *
 * Nu jämför det här. Failar det, har modellen glidit från källan.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DSBC_POSITIONS,
  DSBC_RULES,
  DSBC_SOURCE,
  DSBC_VARIANTS,
  variantOf,
} from "../../../src/lib/catalog/dsbc.ts";
import {
  buildDsbcCode,
  emptyConfig,
  parseDsbcCode,
  theoreticalForceN,
  theoreticalRetractForceN,
  validateDsbc,
} from "../../../src/lib/catalog/dsbc-code.ts";
import { DSBC_CORPUS } from "../../../src/lib/catalog/dsbc-corpus.ts";
import {
  fillOrderCodeTemplate,
  stripLeadingCode,
} from "../../../src/lib/catalog/order-code-template.ts";
import { buildDsbcDbRules } from "../../../src/lib/catalog/dsbc-db-rules.ts";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";

Deno.test("facit: alla 455 katalogkoder parsar", () => {
  assertEquals(DSBC_CORPUS.length, 455, "corpus ska ha 455 verifierade koder");
  const failed: string[] = [];
  for (const row of DSBC_CORPUS) {
    const r = parseDsbcCode(row.code);
    if (!r.ok) failed.push(`${row.code} (okänt: ${r.unknown.join(",")})`);
  }
  assertEquals(failed, [], `koder som inte gick att parsa:\n${failed.slice(0, 10).join("\n")}`);
});

Deno.test("facit: borrning och slag läses rätt ur varje kod", () => {
  const wrong: string[] = [];
  for (const row of DSBC_CORPUS) {
    const { config } = parseDsbcCode(row.code);
    if (Number(config.bore_mm) !== row.bore_mm || Number(config.stroke_mm) !== row.stroke_mm) {
      wrong.push(`${row.code}: fick Ø${config.bore_mm}/${config.stroke_mm}`);
    }
  }
  assertEquals(wrong, [], `fel borrning/slag:\n${wrong.slice(0, 10).join("\n")}`);
});

Deno.test("facit: varje kod serialiseras tillbaka till sig själv", () => {
  const broken: string[] = [];
  for (const row of DSBC_CORPUS) {
    const { config } = parseDsbcCode(row.code);
    const rebuilt = buildDsbcCode(config);
    if (rebuilt !== row.code) broken.push(`${row.code} -> ${rebuilt}`);
  }
  assertEquals(broken, [], `rundgång misslyckades:\n${broken.slice(0, 10).join("\n")}`);
});

Deno.test("facit: ingen katalogkod bryter mot villkoren", () => {
  // En kod Festo faktiskt säljer måste per definition vara giltig. Larmar
  // detta är det reglerna som är fel, inte kunden.
  const rejected: string[] = [];
  for (const row of DSBC_CORPUS) {
    const { config } = parseDsbcCode(row.code);
    const v = validateDsbc(config);
    if (!v.ok) rejected.push(`${row.code}: ${v.errors.map((e) => e.note).join(",")}`);
  }
  assertEquals(rejected, [], `giltiga koder avvisades:\n${rejected.slice(0, 10).join("\n")}`);
});

Deno.test("kraften räknas ut, den lagras inte", () => {
  // Festos egen tabell, "Theoretical force at 6 bar, advancing/retracting".
  const advancing: Record<number, number> = {
    32: 483, 40: 754, 50: 1178, 63: 1870, 80: 3016, 100: 4712, 125: 7363,
  };
  const retracting: Record<number, number> = {
    32: 415, 40: 633, 50: 990, 63: 1682, 80: 2721, 100: 4418, 125: 6881,
  };
  for (const [bore, n] of Object.entries(advancing)) {
    assertEquals(theoreticalForceN(Number(bore)), n, `kraft ut Ø${bore}`);
  }
  for (const [bore, n] of Object.entries(retracting)) {
    assertEquals(theoreticalRetractForceN(Number(bore)), n, `kraft in Ø${bore}`);
  }
});

Deno.test("de påhittade optionskoderna finns inte i modellen", () => {
  // S2, KP, S6 och TT låg som valbara i konfiguratorn men förekommer noll
  // gånger i Festos katalog. De får aldrig komma tillbaka.
  const allCodes = new Set(
    DSBC_POSITIONS.flatMap((p) => (p.values ?? []).map((v) => v.code)).filter(Boolean),
  );
  for (const fake of ["S2", "KP", "S6", "TT"]) {
    assert(!allCodes.has(fake), `${fake} finns inte i Festos DSBC-katalog`);
  }
});

Deno.test("slaglängden går till 2800 mm, inte 2000", () => {
  const stroke = DSBC_POSITIONS.find((p) => p.key === "stroke_mm");
  assertEquals(stroke?.range?.max, 2800);
  const c = emptyConfig();
  c.bore_mm = "50";
  c.stroke_mm = 2500;
  c.cushioning = "PPS";
  assert(validateDsbc(c).ok, "2500 mm ska vara giltigt");
});

Deno.test("Ø125 finns med — den saknades i produktkatalogen", () => {
  const bore = DSBC_POSITIONS.find((p) => p.key === "bore_mm");
  const codes = (bore?.values ?? []).map((v) => v.code);
  assertEquals(codes, ["32", "40", "50", "63", "80", "100", "125"]);
});

Deno.test("villkoren avvisar det katalogen förbjuder", () => {
  const cases: Array<[string, Partial<Record<string, string | number>>, string]> = [
    ["Q över 1500 mm slag", { rotation_lock: "Q", stroke_mm: 1600 }, "1"],
    ["L med Q", { running: "L", rotation_lock: "Q", stroke_mm: 100 }, "2"],
    ["L1 över 1000 mm", { running: "L1", stroke_mm: 1200 }, "3"],
    ["T med U", { rod_type: "T", running: "U", stroke_mm: 100 }, "4"],
    ["F med N3", { rod_thread: "F", standard_conformity: "N3", stroke_mm: 100 }, "6a"],
    ["T3 med PPS", { temperature: "T3", cushioning: "PPS", stroke_mm: 100 }, "7"],
    ["P2 över 500 mm", { particles: "P2", stroke_mm: 600 }, "11"],
    ["A1 med P", { scraper: "A1", cushioning: "P", stroke_mm: 100 }, "12"],
    ["A6 med R3", { scraper: "A6", corrosion: "R3", stroke_mm: 100 }, "15"],
    ["gängförlängning med F", { rod_thread_extension_mm: 20, rod_thread: "F", stroke_mm: 100 }, "17"],
    ["40 mm gängförlängning på Ø32", { rod_thread_extension_mm: 40, bore_mm: "32", stroke_mm: 100 }, "20"],
  ];

  for (const [namn, patch, expectedNote] of cases) {
    const c = { ...emptyConfig(), bore_mm: "50", stroke_mm: 100, cushioning: "PPV", ...patch };
    const v = validateDsbc(c);
    assert(!v.ok, `"${namn}" borde avvisas men godkändes`);
    assert(
      v.errors.some((e) => e.note === expectedNote),
      `"${namn}" borde utlösa fotnot [${expectedNote}], fick [${v.errors.map((e) => e.note).join(",")}]`,
    );
  }
});

Deno.test("en giltig specialkonfiguration godkänns", () => {
  const c = emptyConfig();
  Object.assign(c, {
    bore_mm: "63",
    stroke_mm: 400,
    cushioning: "PPV",
    sensing: "A",
    profile: "D3",
    corrosion: "R3",
    eu_cert: "EX4",
  });
  const v = validateDsbc(c);
  assert(v.ok, `borde godkännas, fick: ${v.errors.map((e) => e.message_sv).join(" | ")}`);
  assertEquals(buildDsbcCode(c), "DSBC-63-400-D3-PPVA-R3-EX4");
});

Deno.test("konfiguratorns mall reproducerar alla 455 katalogkoder", () => {
  // Mallen som ligger i configurator_families genereras ur positionerna
  // (scripts/gen-dsbc-migration.ts). Här körs samma konstruktion genom samma
  // mallmotor som konfiguratorsidan använder, mot facit. Tappar mallen en
  // position -- vilket den handskrivna gjorde, 6 av 21 -- failar det här.
  const template =
    "DSBC" +
    DSBC_POSITIONS.map((p) => {
      const ph = p.numeric_suffix ? `{${p.key}:${p.numeric_suffix}}` : `{${p.key}}`;
      return p.key === "sensing" ? ph : `-${ph}`;
    }).join("");

  const required = new Set(["bore_mm", "stroke_mm", "cushioning"]);
  const broken: string[] = [];
  for (const row of DSBC_CORPUS) {
    const { config } = parseDsbcCode(row.code);
    // Nollor är "ej valt" för de numeriska positionerna.
    const sel: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      sel[k] = typeof v === "number" ? (v === 0 ? "" : String(v)) : String(v);
    }
    const built = fillOrderCodeTemplate(template, sel, required);
    if (built !== row.code) broken.push(`${row.code} -> ${built}`);
  }
  assertEquals(broken, [], `mallen gav fel kod:\n${broken.slice(0, 10).join("\n")}`);
});

Deno.test("mallen täcker varje position i beställnyckeln", () => {
  const template =
    "DSBC" +
    DSBC_POSITIONS.map((p) => {
      const ph = p.numeric_suffix ? `{${p.key}:${p.numeric_suffix}}` : `{${p.key}}`;
      return p.key === "sensing" ? ph : `-${ph}`;
    }).join("");
  const missing = DSBC_POSITIONS.filter((p) => !template.includes(`{${p.key}`));
  assertEquals(missing.map((p) => p.key), [], "positioner som mallen tappar");
});

Deno.test("etiketten klipps bara när koden står först", () => {
  // "Låg friktion" med koden "L" blev "åg friktion" med den gamla varianten.
  assertEquals(stripLeadingCode("Låg friktion", "L"), "Låg friktion");
  assertEquals(stripLeadingCode("Ø32 mm", "32"), "Ø32 mm");
  assertEquals(stripLeadingCode("Q Med vridskydd", "Q"), "Med vridskydd");
  assertEquals(stripLeadingCode("D3 – Givarspår", "D3"), "– Givarspår");
  // Är etiketten bara koden finns inget att visa -- behåll den då.
  assertEquals(stripLeadingCode("N3", "N3"), "N3");
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(DSBC_SOURCE.file, "202904_documentation.pdf");
  assertEquals(DSBC_SOURCE.edition, "2026/09");
});

Deno.test("alla 18 fotnoter i katalogen är implementerade", () => {
  // Räknar inte rader utan täckning: fotnot [6] och [18] blir flera regler var
  // (samma nummer, olika villkor i Festos tabell), så en ren längdkoll skulle
  // både kunna passera med fel regler och fela på rätt.
  const covered = new Set(DSBC_RULES.map((r) => r.note.replace(/[a-z]$/, "")));
  const missing = Array.from({ length: 18 }, (_, i) => String(i + 1)).filter(
    (n) => !covered.has(n),
  );
  assertEquals(missing, [], `fotnoter utan regel: ${missing.join(", ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTERNA
//
// Katalogen har fyra beställtabeller, inte en. Den första modellen platt-till
// dem och godkände därför kombinationer Festo inte säljer. Testerna nedan är
// hämtade direkt ur tabellernas egna rubrikrader och fotnoter.
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("varianterna bär katalogens fyra tabeller", () => {
  assertEquals(DSBC_VARIANTS.map((v) => v.id), ["base", "clamping", "end_lock", "li_ion"]);

  const byId = (id: string) => DSBC_VARIANTS.find((v) => v.id === id)!;
  // Slagintervallen skiljer sig mellan tabellerna -- det var hela poängen.
  assertEquals(byId("base").stroke, { min: 1, max: 2800 });
  assertEquals(byId("clamping").stroke, { min: 10, max: 2000 });
  assertEquals(byId("end_lock").stroke, { min: 10, max: 2000 });
  assertEquals(byId("li_ion").stroke, { min: 1, max: 2800 });

  // Ändlägeslåsning listas bara i sex storlekar; Ø125 saknas.
  assertEquals(byId("end_lock").bores, ["32", "40", "50", "63", "80", "100"]);
  // Li-ion är en egen modulserie, inte basen med en flagga.
  assertEquals(byId("li_ion").moduleNo["32"], "8150687");
  assertEquals(byId("base").moduleNo["32"], "1463250");
});

Deno.test("varianten avgörs av konfigurationen", () => {
  const c = emptyConfig();
  assertEquals(variantOf(c).id, "base");
  assertEquals(variantOf({ ...c, clamping: "C" }).id, "clamping");
  assertEquals(variantOf({ ...c, end_lock: "E2" }).id, "end_lock");
  assertEquals(variantOf({ ...c, material: "F1A" }).id, "li_ion");
});

Deno.test("varianternas gränser avvisar det katalogen inte säljer", () => {
  const base = () => ({ ...emptyConfig(), bore_mm: "50", stroke_mm: 100, cushioning: "PPV" });

  // Klämenhet: slag 10-2000, inte basens 2800.
  const c1 = { ...base(), clamping: "C", stroke_mm: 2500 };
  assert(!validateDsbc(c1).ok, "klämenhet med 2500 mm slag ska avvisas");
  assertEquals(validateDsbc(c1).variant, "clamping");

  // Ändlägeslåsning finns inte för Ø125.
  const c2 = { ...base(), end_lock: "E1", bore_mm: "125", stroke_mm: 100 };
  assert(!validateDsbc(c2).ok, "ändlägeslåsning på Ø125 ska avvisas");

  // Ändlägeslåsningstabellen erbjuder bara P och PPV -- inte PPS.
  const c3 = { ...base(), end_lock: "E1", cushioning: "PPS" };
  assert(!validateDsbc(c3).ok, "PPS med ändlägeslåsning ska avvisas");
  const c3ok = { ...base(), end_lock: "E1", cushioning: "PPV" };
  assert(validateDsbc(c3ok).ok, `PPV med ändlägeslåsning ska godkännas: ${validateDsbc(c3ok).errors.map((e) => e.message_sv).join(" | ")}`);

  // "[2] T Mandatory with Q" -- katalogens enda KRÄVANDE regel.
  const c4 = { ...base(), clamping: "C", rotation_lock: "Q" };
  assert(!validateDsbc(c4).ok, "Q med klämenhet utan T ska avvisas");
  assert(validateDsbc(c4).errors.some((e) => e.note === "C2"));
  assert(validateDsbc({ ...c4, rod_type: "T" }).ok, "Q + T med klämenhet ska godkännas");

  // Vridskydd Q finns inte för Ø125 med klämenhet.
  const c5 = { ...base(), clamping: "C", rotation_lock: "Q", rod_type: "T", bore_mm: "125" };
  assert(!validateDsbc(c5).ok, "Q på Ø125 med klämenhet ska avvisas");
});

Deno.test("en position som tabellen inte erbjuder avvisas", () => {
  const base = () => ({ ...emptyConfig(), bore_mm: "50", stroke_mm: 100, cushioning: "PPV" });
  // Ändlägeslåsningstabellen har varken vridskydd, korrosionsskydd eller ATEX.
  for (const [key, val] of [["rotation_lock", "Q"], ["corrosion", "R3"], ["eu_cert", "EX4"]]) {
    const c = { ...base(), end_lock: "E1", [key]: val };
    assert(!validateDsbc(c).ok, `${key}=${val} ska avvisas med ändlägeslåsning`);
  }
  // Bastabellen erbjuder varken klämenhet eller F1A -- de har egna tabeller,
  // så de byter variant i stället för att avvisas.
  assertEquals(validateDsbc({ ...base(), clamping: "C", stroke_mm: 100 }).variant, "clamping");
});

Deno.test("li-ion-varianten följer sina egna fotnoter", () => {
  const li = () => ({
    ...emptyConfig(), bore_mm: "50", stroke_mm: 100, cushioning: "PPV", material: "F1A",
  });
  assert(validateDsbc(li()).ok, "ren F1A-konfiguration ska godkännas");
  // [1] F, ...E, ...L inte med N3
  assert(!validateDsbc({ ...li(), rod_thread: "F", standard_conformity: "N3" }).ok);
  // [2] ...E bara upp till 2000 mm
  assert(!validateDsbc({ ...li(), stroke_mm: 2500, rod_extension_mm: 50 }).ok);
  assert(validateDsbc({ ...li(), stroke_mm: 2500 }).ok, "2500 mm utan förlängning är OK");
});

Deno.test("alla 455 katalogkoder hör till bastabellen", () => {
  // Lagerkoderna bär varken C, E1/E2/E3 eller F1A. Skulle någon göra det vore
  // corpus fel, inte modellen.
  const wrong: string[] = [];
  for (const row of DSBC_CORPUS) {
    const { config } = parseDsbcCode(row.code);
    if (variantOf(config).id !== "base") wrong.push(`${row.code} -> ${variantOf(config).id}`);
  }
  assertEquals(wrong, [], `koder som hamnade i fel tabell:\n${wrong.slice(0, 5).join("\n")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// DE GENERERADE DATABASREGLERNA
//
// Modellen kan vara rätt och översättningen till databasen ändå fel -- mallen i
// PR #190 var korrekt härledd och tappade ändå 15 av 21 positioner. Därför
// jämförs reglerna som FAKTISKT hamnar i config_rules mot validateDsbc(), med
// samma evalLogic som produktionen kör.
// ─────────────────────────────────────────────────────────────────────────────

/** Kör de genererade reglerna precis som configurator-engine.validate() gör. */
function runDbRules(config: Record<string, string | number>): string[] {
  // Konfiguratorn räknar ut varianten en gång och skickar den i kontexten;
  // reglerna vaktas på den i stället för att upprepa villkoret 63 gånger.
  const ctx = { ...config, variant: variantOf(config).id };
  return buildDsbcDbRules()
    .filter((r) => r.severity === "error" && evalLogic(r.if_json, ctx))
    .map((r) => r.message_sv);
}

Deno.test("databasreglerna godkänner alla 455 katalogkoder", () => {
  // En kod Festo säljer får inte utlösa ett enda fel i produktionen.
  const rejected: string[] = [];
  for (const row of DSBC_CORPUS) {
    const { config } = parseDsbcCode(row.code);
    const hits = runDbRules(config);
    if (hits.length > 0) rejected.push(`${row.code}: ${hits[0]}`);
  }
  assertEquals(rejected, [], `giltiga koder avvisades av DB-reglerna:\n${rejected.slice(0, 8).join("\n")}`);
});

Deno.test("databasreglerna avvisar samma sak som modellen", () => {
  const base = () => ({ ...emptyConfig(), bore_mm: "50", stroke_mm: 100, cushioning: "PPV" });
  const cases: Array<[string, Record<string, string | number>]> = [
    ["klämenhet 2500 mm", { ...base(), clamping: "C", stroke_mm: 2500 }],
    ["ändlägeslåsning Ø125", { ...base(), end_lock: "E1", bore_mm: "125" }],
    ["PPS med ändlägeslåsning", { ...base(), end_lock: "E1", cushioning: "PPS" }],
    ["Q med klämenhet utan T", { ...base(), clamping: "C", rotation_lock: "Q" }],
    ["R3 med ändlägeslåsning", { ...base(), end_lock: "E1", corrosion: "R3" }],
    ["EX4 med li-ion", { ...base(), material: "F1A", eu_cert: "EX4" }],
    ["Q över 1500 mm (bas)", { ...base(), rotation_lock: "Q", stroke_mm: 1600 }],
    ["F med N3 (bas)", { ...base(), rod_thread: "F", standard_conformity: "N3" }],
    ["P2 över 500 mm (bas)", { ...base(), particles: "P2", stroke_mm: 600 }],
  ];

  const mismatch: string[] = [];
  for (const [namn, config] of cases) {
    const modell = !validateDsbc(config).ok;
    const databas = runDbRules(config).length > 0;
    if (modell !== databas) {
      mismatch.push(`${namn}: modellen ${modell ? "avvisar" : "godkänner"}, databasen ${databas ? "avvisar" : "godkänner"}`);
    }
    assert(modell, `"${namn}" borde avvisas av modellen`);
  }
  assertEquals(mismatch, [], `modell och databasregler går isär:\n${mismatch.join("\n")}`);
});

Deno.test("giltiga variantkonfigurationer släpps igenom av databasreglerna", () => {
  const ok: Array<[string, Record<string, string | number>]> = [
    ["klämenhet med Q och T", {
      ...emptyConfig(), bore_mm: "50", stroke_mm: 400, cushioning: "PPV",
      clamping: "C", rotation_lock: "Q", rod_type: "T",
    }],
    ["ändlägeslåsning E2 med PPV", {
      ...emptyConfig(), bore_mm: "63", stroke_mm: 300, cushioning: "PPV", end_lock: "E2",
    }],
    ["li-ion med N3", {
      ...emptyConfig(), bore_mm: "80", stroke_mm: 1000, cushioning: "PPS",
      material: "F1A", standard_conformity: "N3",
    }],
    ["bas med R3 och EX4", {
      ...emptyConfig(), bore_mm: "63", stroke_mm: 400, cushioning: "PPV",
      sensing: "A", profile: "D3", corrosion: "R3", eu_cert: "EX4",
    }],
  ];
  for (const [namn, config] of ok) {
    const hits = runDbRules(config);
    assertEquals(hits, [], `"${namn}" borde godkännas, fick: ${hits.join(" | ")}`);
    assert(validateDsbc(config).ok, `"${namn}" borde godkännas av modellen`);
  }
});

Deno.test("varje genererad regel bär en variantvakt", () => {
  // Utan vakt skulle bastabellens villkor köras på en klämenhetskonfiguration.
  // Undantaget är de två allmänna råden, som gäller oavsett utförande.
  const utanVakt = buildDsbcDbRules()
    .filter((r) => r.severity === "error")
    .filter((r) => !JSON.stringify(r.if_json).includes('{"var":"variant"}'));
  assertEquals(utanVakt.map((r) => r.message_sv), [], "felregler utan variantvakt");
});

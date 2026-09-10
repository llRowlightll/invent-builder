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

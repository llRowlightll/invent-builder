/**
 * OSP-E-modellen mot katalogen, mot Parkers konfigurator och mot distributörer.
 *
 * Tre oberoende facit:
 *   1. Katalogens tabeller (P-A4P017GB), avskrivna här igen -- översikten på
 *      sida 4-5 är en ANNAN tabell än de per-variant-tabeller modellen bär.
 *   2. Parkers konfigurator (econfig.parker.com, 2026-09-14): artikelnumren
 *      den bygger för grundutförandet av B och BHD.
 *   3. Distributörskoder i USA-form (`OSPE25-60002-02240-PC1000`), som prövar
 *      gruppernas längd och satsmatrisen utan att vi valt dem själva.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  OSPE_BHD_TYPES,
  OSPE_GEARS,
  OSPE_KITS_BHD,
  OSPE_KITS_MOTOR,
  OSPE_ORDER_CODE_TEMPLATES,
  OSPE_SCREW_RPM,
  OSPE_SHAFTS_BHD,
  OSPE_SHAFTS_BV,
  OSPE_SOURCE,
  OSPE_TECH,
  OSPE_VARIANTS,
  type OspeConfig,
  type OspeSlug,
  ospeBuildCode,
  ospeCarriages,
  ospeEndCaps,
  ospeGearKitOptions,
  ospeGuides,
  ospeMaxStroke,
  ospeMotorKitOptions,
  ospeParseCode,
  ospePitches,
  ospeProfiles,
  ospeSensors,
  ospeShaftOrKitOptions,
  ospeVariant,
} from "../../../src/lib/catalog/osp-e.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(OSPE_SOURCE.file, "parker-OSP-E-PA4P017GB.pdf");
  assertEquals(OSPE_VARIANTS.length, 7);
  // Typkoderna 0-7 används alla, var och en av exakt en variant.
  const typer = OSPE_VARIANTS.flatMap((v) => v.types).sort();
  assertEquals(typer, ["0", "1", "2", "3", "4", "5", "6", "7"]);
});

Deno.test("inga dubbla koder i någon lista", () => {
  const listor: Array<[string, Array<{ code: string }>]> = [
    ["växlar", OSPE_GEARS], ["motorsatser", OSPE_KITS_MOTOR], ["BHD-satser", OSPE_KITS_BHD],
    ["BHD-axlar", OSPE_SHAFTS_BHD], ["BV-axlar", OSPE_SHAFTS_BV],
  ];
  for (const v of OSPE_VARIANTS) {
    listor.push([`${v.slug} vagnar`, ospeCarriages(v.slug)], [`${v.slug} stigningar`, ospePitches(v.slug)],
      [`${v.slug} styrningar`, ospeGuides(v.slug)], [`${v.slug} ändlock`, ospeEndCaps(v.slug)],
      [`${v.slug} profilfästen`, ospeProfiles(v.slug)], [`${v.slug} givare`, ospeSensors(v.slug)],
      [`${v.slug} satser`, ospeGearKitOptions(v.slug)], [`${v.slug} axel/sats`, ospeShaftOrKitOptions(v.slug)]);
  }
  for (const [namn, lista] of listor) {
    const koder = lista.map((x) => x.code);
    assertEquals(new Set(koder).size, koder.length, `${namn} har dubbletter: ${koder}`);
  }
  // Bokstaven O används inte som kod i profilfästena (0 och O vore omöjliga att skilja).
  for (const v of OSPE_VARIANTS) assert(!ospeProfiles(v.slug).some((p) => p.code === "O"));
});

// ── facit 1: katalogens översikt (sida 4-5, chunk 7 och 14) ─────────────────
//
// Kolumn för kolumn: kraft FA [N] (max), hastighet [m/s] (max) och slag [mm].
const OVERSIKT: Array<[OspeSlug, string, number, number, number]> = [
  ["osp-e-bhd", "20", 550, 3.0, 5760],
  ["osp-e-bhd", "25", 1070, 10.0, 7000],
  ["osp-e-bhd", "32", 1870, 10.0, 7000],
  ["osp-e-bhd", "50", 3120, 10.0, 7000],
  ["osp-e-bv", "20", 650, 3.0, 1000],
  ["osp-e-bv", "25", 1490, 5.0, 1500],
  ["osp-e-b", "25", 50, 2.0, 3000],
  ["osp-e-b", "32", 150, 3.0, 5000],
  ["osp-e-b", "50", 425, 5.0, 5000],
  ["osp-e-sb", "25", 250, 0.25, 1100],
  ["osp-e-sb", "32", 600, 0.5, 2000],
  ["osp-e-sb", "50", 1500, 1.25, 3200],
  ["osp-e-st", "25", 600, 0.1, 1100],
  ["osp-e-st", "32", 1300, 0.1, 2000],
  ["osp-e-st", "50", 2500, 0.15, 2500],
  ["osp-e-sbr", "25", 260, 0.25, 500],
  ["osp-e-sbr", "32", 900, 0.5, 500],
  ["osp-e-sbr", "50", 1200, 1.25, 500],
  ["osp-e-str", "25", 800, 0.075, 500],
  ["osp-e-str", "32", 1600, 0.1, 500],
  ["osp-e-str", "50", 3300, 0.125, 500],
];

Deno.test("översiktstabellen och varianttabellerna säger samma sak", () => {
  for (const [slug, size, kraft, fart, slag] of OVERSIKT) {
    const rader = OSPE_TECH.filter((t) => t.slug === slug && t.size === size);
    assert(rader.length > 0, `${slug} ${size} saknas i OSPE_TECH`);
    const maxKraft = Math.max(...rader.map((r) => r.max_force_n));
    const maxFart = Math.max(...rader.map((r) => r.max_speed_ms));
    const maxSlag = Math.max(...rader.map((r) => r.max_stroke_mm));
    // BV25: översikten skriver 1 050-1 490 N och detaljtabellen 1 430 vid 1 m/s.
    // Översiktens max är vid lägre fart än tabellens första kolumn; vi bär
    // tabellens värde och godtar avvikelsen bara där.
    if (slug === "osp-e-bv" && size === "25") assert(maxKraft >= 1430 && maxKraft <= kraft);
    else assertEquals(maxKraft, kraft, `${slug} ${size} kraft`);
    assertEquals(maxFart, fart, `${slug} ${size} hastighet`);
    assertEquals(maxSlag, slag, `${slug} ${size} slag`);
  }
});

Deno.test("skruvarnas hastighet är stigningen gånger varvtalet", () => {
  // Oberoende formel: v = stigning [mm] × n [1/min] / 60 000. Tabellen anger
  // båda, och de måste stämma överens rad för rad.
  for (const t of OSPE_TECH.filter((x) => x.pitch !== null)) {
    const pitch = ospePitches(t.slug).find((p) => p.code === t.pitch)!;
    const rpm = OSPE_SCREW_RPM[t.slug as keyof typeof OSPE_SCREW_RPM];
    assertEquals(t.max_speed_ms, pitch.pitch_mm * rpm / 60000, `${t.slug} ${t.size} stigning ${pitch.pitch_mm}`);
  }
});

// ── facit 2: Parkers konfigurator ──────────────────────────────────────────

Deno.test("grundutförandet blir Parkers eget artikelnummer", () => {
  // econfig.parker.com, OSPE25-B, alla val i grundläge, slag 500:
  assertEquals(ospeBuildCode({ slug: "osp-e-b", size: "25", stroke_mm: 500 }), "OSPE2500000-00500000000");
  // ... och OSPE25-BHD med slät axel 0A:
  assertEquals(ospeBuildCode({ slug: "osp-e-bhd", size: "25", type: "6", drive_shaft: "0A", stroke_mm: 500 }),
    "OSPE256000A00500000000");
  // Integrerad växel: bokstaven är X. (Konfiguratorn lägger själv till
  // motorsats A2 i svansen -- den satsen finns inte i 2014 års katalog.)
  assertEquals(ospeBuildCode({ slug: "osp-e-bhd", size: "25", type: "6", drive_shaft: "1X", stroke_mm: 500 }),
    "OSPE256001X00500000000");
  // Satsen "0-" är två tecken och bär kodens enda bindestreck.
  const b = ospeBuildCode({ slug: "osp-e-b", size: "25", stroke_mm: 500 })!;
  assertEquals(b.length, 23);
  assertEquals(b.indexOf("-"), 11);
  assertEquals(ospeBuildCode({ slug: "osp-e-b", size: "25", stroke_mm: 500, kit: "A0" }), "OSPE250000A000500000000");
});

// ── facit 3: distributörskoder i USA-form ──────────────────────────────────

Deno.test("distributörskoder i USA-form läses som samma kod", () => {
  const fall: Array<[string, string]> = [
    // e-motionsupply / hyspeco / applied automation, 2026-09-14
    ["OSPE25-00000-01100-P00000", "OSPE2500000-01100000000"],
    ["OSPE50-00000-00900-P00000", "OSPE5000000-00900000000"],
    ["OSPE25-00000-01098-P00100", "OSPE2500000-01098000100"],
    // BHD med klämaxel 02 och sats C1 -- katalogens matris säger att C1 i
    // storlek 25 kräver klämaxel. Distributören valde precis så.
    ["OSPE25-60002-02240-PC1000", "OSPE2560002022400C1000"],
  ];
  for (const [us, eu] of fall) {
    const r = ospeParseCode(us);
    assert(r, `${us} lästes inte`);
    assertEquals(ospeBuildCode(r.config), eu);
    assertEquals(ospeParseCode(eu)?.config, r.config);
  }
  // 2021 års amerikanska katalog har växlar (B) och satser (AB, AM) som inte
  // finns i vår källa. De ska inte läsas som något annat.
  assertEquals(ospeParseCode("OSPE25-0000AB02000-P002R0"), null);
  assertEquals(ospeParseCode("OSPE25-001AAM00800-PM05MB"), null);
  // Slag 0 är en platshållare hos distributören, inte en beställbar kod.
  assertEquals(ospeParseCode("OSPE25-60002-00000-P00000"), null);
});

// ── mallen och modellen bygger samma kod ───────────────────────────────────

function somMallval(c: OspeConfig): Record<string, string | number> {
  const v = ospeVariant(c.slug)!;
  const ut: Record<string, string | number> = { size: c.size, stroke_mm: c.stroke_mm, niro: c.niro ?? "0", sensors: c.sensors ?? "0" };
  switch (v.layout) {
    case "B":
      Object.assign(ut, { carriage: c.carriage ?? "0", drive_shaft: c.drive_shaft ?? "0", gear: c.gear ?? "0", kit: c.kit ?? "0-",
        ext_guide: c.ext_guide ?? "0", guide_position: c.guide_position ?? "0", end_cap: c.end_cap ?? "0", profile_mounting: c.profile_mounting ?? "0" });
      break;
    case "SCREW":
      Object.assign(ut, { carriage: c.carriage ?? "0", pitch: c.pitch!, gear: c.gear ?? "0", kit: c.kit ?? "0-",
        ext_guide: c.ext_guide ?? "0", end_cap: c.end_cap ?? "0", profile_mounting: c.profile_mounting ?? "0" });
      break;
    case "ROD":
      Object.assign(ut, { pitch: c.pitch!, gear: c.gear ?? "0", kit: c.kit ?? "0-",
        rod_mounting: c.rod_mounting ?? "0", end_cap: c.end_cap ?? "0", profile_mounting: c.profile_mounting ?? "0" });
      break;
    case "BHD":
      Object.assign(ut, { type: c.type!, carriage: c.carriage ?? "0", op_direction: c.op_direction ?? "0", drive_shaft: c.drive_shaft!,
        kit: c.kit ?? "00", end_cap: c.end_cap ?? "0", profile_mounting: c.profile_mounting ?? "0" });
      break;
    case "BV":
      Object.assign(ut, { carriage: c.carriage ?? "0", drive_shaft: c.drive_shaft!, kit: c.kit ?? "00" });
      break;
  }
  return ut;
}

/** Ett brett urval giltiga konfigurationer per variant, för mall- och rundturstest. */
function urval(): OspeConfig[] {
  const ut: OspeConfig[] = [];
  for (const v of OSPE_VARIANTS) {
    for (const size of v.sizes) {
      const typer = v.layout === "BHD" ? OSPE_BHD_TYPES.filter((t) => t.sizes.includes(size)).map((t) => t.code) : [undefined];
      for (const type of typer) {
        const slag = [1, 250, ospeMaxStroke(v.slug, size, { type }) ?? 500];
        for (const stroke_mm of slag) {
          const bas: OspeConfig = { slug: v.slug, size, stroke_mm, type };
          switch (v.layout) {
            case "B":
              ut.push({ ...bas }, { ...bas, carriage: "2", drive_shaft: "2", gear: size === "50" ? "3" : "1", kit: "A1", ext_guide: size === "50" ? "H" : size === "32" ? "F" : "E", guide_position: "1", end_cap: "4", profile_mounting: "T", sensors: "F", niro: "1" });
              break;
            case "SCREW": {
              const p = ospePitches(v.slug).filter((x) => x.sizes.includes(size));
              for (const pitch of p) ut.push({ ...bas, pitch: pitch.code }, { ...bas, pitch: pitch.code, kit: "3-", ext_guide: "D", end_cap: "3", profile_mounting: "9", sensors: "8" });
              break;
            }
            case "ROD": {
              const p = ospePitches(v.slug).filter((x) => x.sizes.includes(size));
              for (const pitch of p) ut.push({ ...bas, pitch: pitch.code }, { ...bas, pitch: pitch.code, gear: size === "25" ? "2" : "5", kit: size === "25" ? "A0" : "A3", rod_mounting: "V", end_cap: "2", profile_mounting: "L", sensors: "D" });
              break;
            }
            case "BHD":
              ut.push({ ...bas, drive_shaft: "0A" }, { ...bas, drive_shaft: "02", carriage: "2", op_direction: "3", kit: size === "20" ? "C0" : size === "25" ? "C1" : size === "32" ? "A8" : "A9", end_cap: "B", profile_mounting: "C", sensors: "A" });
              if (size !== "20") ut.push({ ...bas, drive_shaft: "6X", carriage: "1", op_direction: "1" });
              break;
            case "BV":
              ut.push({ ...bas, drive_shaft: "0A" }, { ...bas, drive_shaft: "0C", carriage: "1", kit: "A3", sensors: "2", niro: "1" });
              break;
          }
        }
      }
    }
  }
  return ut;
}

Deno.test("mallen i databasen och modellen bygger samma kod, för alla sju", () => {
  const prov = urval();
  assert(prov.length > 120, `bara ${prov.length} prov`);
  const alla = new Set(["size", "stroke_mm", "type", "carriage", "drive_shaft", "pitch", "gear", "kit", "op_direction",
    "niro", "ext_guide", "guide_position", "rod_mounting", "end_cap", "profile_mounting", "sensors"]);
  for (const c of prov) {
    const kod = ospeBuildCode(c);
    assert(kod, `modellen byggde inte ${JSON.stringify(c)}`);
    const mall = fillOrderCodeTemplate(OSPE_ORDER_CODE_TEMPLATES[c.slug], somMallval(c), alla);
    assertEquals(mall, kod, JSON.stringify(c));
    assert(!mall.includes("..."), `mallen lämnade en lucka: ${mall}`);
    // Längden är fast: 23 tecken för B och skruvarna, 22 för BHD och BV.
    const v = ospeVariant(c.slug)!;
    assertEquals(kod.length, v.layout === "BHD" || v.layout === "BV" ? 22 : 23, kod);
  }
});

Deno.test("parse är byggets spegel", () => {
  for (const c of urval()) {
    const kod = ospeBuildCode(c)!;
    const r = ospeParseCode(kod);
    assert(r, `lästes inte: ${kod}`);
    assertEquals(r.slug, c.slug);
    assertEquals(r.size, c.size);
    assertEquals(r.stroke_mm, c.stroke_mm);
    assertEquals(ospeBuildCode(r.config), kod);
  }
  // Fel längd, fel typ, fel serie: ingenting.
  assertEquals(ospeParseCode("OSPE250000-00500000000"), null);
  assertEquals(ospeParseCode("OSPE2580000-00500000000"), null);
  assertEquals(ospeParseCode("OSPP2500000-00500000000"), null);
  assertEquals(ospeParseCode(""), null);
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = (c: OspeConfig) => ospeBuildCode(c);
  // BHD: storlek 20 finns bara som typ 6; integrerad växel inte i 20.
  assertEquals(b({ slug: "osp-e-bhd", size: "20", type: "5", drive_shaft: "0A", stroke_mm: 500 }), null);
  assertEquals(b({ slug: "osp-e-bhd", size: "20", type: "6", drive_shaft: "1X", stroke_mm: 500 }), null);
  // BHD: delad vagn kräver riktning 2/3 och tvärtom.
  assertEquals(b({ slug: "osp-e-bhd", size: "25", type: "6", drive_shaft: "0A", carriage: "2", op_direction: "0", stroke_mm: 500 }), null);
  assertEquals(b({ slug: "osp-e-bhd", size: "25", type: "6", drive_shaft: "0A", carriage: "0", op_direction: "2", stroke_mm: 500 }), null);
  // BHD: sats C1 i storlek 25 kräver klämaxel; i storlek 20 slät axel.
  assertEquals(b({ slug: "osp-e-bhd", size: "25", type: "6", drive_shaft: "0A", kit: "C1", stroke_mm: 500 }), null);
  assert(b({ slug: "osp-e-bhd", size: "25", type: "6", drive_shaft: "02", kit: "C1", stroke_mm: 500 }));
  assert(b({ slug: "osp-e-bhd", size: "20", type: "6", drive_shaft: "0A", kit: "C1", stroke_mm: 500 }));
  assertEquals(b({ slug: "osp-e-bhd", size: "20", type: "6", drive_shaft: "02", kit: "C1", stroke_mm: 500 }), null);
  // B: växel LP050 kräver motorsats A0/A1/A2; C0 duger inte.
  assertEquals(b({ slug: "osp-e-b", size: "25", gear: "1", stroke_mm: 500 }), null);
  assertEquals(b({ slug: "osp-e-b", size: "25", gear: "1", kit: "C0", stroke_mm: 500 }), null);
  assert(b({ slug: "osp-e-b", size: "25", gear: "1", kit: "A2", stroke_mm: 500 }));
  // B: LP070 finns inte i 25; Powerslide 50/60 inte i 25; B4 inte i 50.
  assertEquals(b({ slug: "osp-e-b", size: "25", gear: "3", kit: "A1", stroke_mm: 500 }), null);
  assertEquals(b({ slug: "osp-e-b", size: "25", ext_guide: "H", stroke_mm: 500 }), null);
  assertEquals(b({ slug: "osp-e-b", size: "50", end_cap: "5", stroke_mm: 500 }), null);
  // Skruvar: stigningen är storleksbunden, olika koder per variant.
  assertEquals(b({ slug: "osp-e-sb", size: "25", pitch: "4", stroke_mm: 500 }), null);
  assert(b({ slug: "osp-e-sb", size: "32", pitch: "4", stroke_mm: 500 }));
  assertEquals(b({ slug: "osp-e-sbr", size: "25", pitch: "3", stroke_mm: 500 }), null);
  assert(b({ slug: "osp-e-str", size: "25", pitch: "3", stroke_mm: 500 }));
  // Skruvar: kilspårsaxel och sats är samma position -- man kan inte ha båda.
  assert(b({ slug: "osp-e-sb", size: "25", pitch: "3", kit: "3-", stroke_mm: 500 }));
  assert(b({ slug: "osp-e-sb", size: "25", pitch: "3", kit: "A0", stroke_mm: 500 }));
  assertEquals(b({ slug: "osp-e-sb", size: "25", pitch: "3", kit: "A4", stroke_mm: 500 }), null, "A4 står bara på B:s sida");
  assert(b({ slug: "osp-e-b", size: "50", kit: "A4", stroke_mm: 500 }));
  // STR: den korta givarlistan.
  assertEquals(b({ slug: "osp-e-str", size: "25", pitch: "3", sensors: "5", stroke_mm: 500 }), null);
  assert(b({ slug: "osp-e-str", size: "25", pitch: "3", sensors: "D", stroke_mm: 500 }));
  // BV: bara storlek 20 och 25, givare 0 eller 2.
  assertEquals(b({ slug: "osp-e-bv", size: "32", drive_shaft: "0A", stroke_mm: 500 }), null);
  assertEquals(b({ slug: "osp-e-bv", size: "25", drive_shaft: "0A", sensors: "1", stroke_mm: 500 }), null);
  // Slaget: 1 till standardmax, i hela mm.
  assertEquals(b({ slug: "osp-e-b", size: "25", stroke_mm: 3001 }), null);
  assert(b({ slug: "osp-e-b", size: "25", stroke_mm: 3000 }));
  assertEquals(b({ slug: "osp-e-b", size: "25", stroke_mm: 0 }), null);
  assertEquals(b({ slug: "osp-e-bhd", size: "25", type: "6", drive_shaft: "0A", stroke_mm: 5701 }), null);
  assert(b({ slug: "osp-e-bhd", size: "25", type: "5", drive_shaft: "0A", stroke_mm: 7000 }));
});

Deno.test("varje val har svensk etikett, och konstanterna står i mallen", () => {
  for (const v of OSPE_VARIANTS) {
    for (const lista of [ospeCarriages(v.slug), ospePitches(v.slug), ospeGuides(v.slug), ospeEndCaps(v.slug),
      ospeProfiles(v.slug), ospeSensors(v.slug), ospeGearKitOptions(v.slug), ospeShaftOrKitOptions(v.slug), ospeMotorKitOptions()]) {
      for (const x of lista) assert(x.label_sv.trim().length > 0, `${v.slug}: ${x.code} saknar etikett`);
    }
    const mall = OSPE_ORDER_CODE_TEMPLATES[v.slug];
    assert(mall.startsWith("OSPE{size}"));
    assert(mall.includes("{stroke_mm#5}"), "slaget skrivs med fem siffror");
    // Typen är fast i mallen utom för BHD, som har två.
    if (v.layout !== "BHD") assert(mall.startsWith(`OSPE{size}${v.types[0]}`), mall);
    else assert(mall.startsWith("OSPE{size}{type}"), mall);
  }
});

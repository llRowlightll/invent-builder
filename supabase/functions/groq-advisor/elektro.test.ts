/**
 * ELEKTRO-modellen mot Metal Works två nycklar och POSSIBLE ORDERING CODES.
 *
 * Facit är avskrivet ur sida A5.31-A5.33; modellen räknar. Det viktigaste
 * testet här är inte något av de uppenbara -- det är korskontrollen mot
 * MOTORKODSTABELLEN, som är en helt annan tabell på en annan sida. Om min
 * avskrift av den nästade beställtabellen hade glidit en rad skulle den
 * kontrollen falla.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  ELEKTRO_COMBOS,
  ELEKTRO_DRIVES,
  ELEKTRO_FLANGES,
  ELEKTRO_LIMITS,
  ELEKTRO_MOTORS,
  ELEKTRO_MOTORS_TABLE,
  ELEKTRO_ORDER_CODE_TEMPLATE,
  ELEKTRO_PITCHES,
  ELEKTRO_SIZES,
  ELEKTRO_SOURCE,
  ELEKTRO_TORQUES,
  ELEKTRO_VERSIONS,
  ELEKTRO_VERSIONS_NO_MOTOR,
  elektroBuildCode,
  elektroDrivePacks,
  elektroIsNonRotating,
  elektroIsOrderable,
  elektroMaxStroke,
  elektroMinStroke,
  elektroParseCode,
  elektroTransmissionRatio,
} from "../../../src/lib/catalog/elektro.ts";

Deno.test("nyckelns exempel byggs tecken för tecken", () => {
  // Katalogens egna exempelrader, sida A5.32:
  //   utan motor:  CYL 37 1 032 0100 1 5
  //   med motor:   CYL 37 1 032 0100 1 1 1 2 2 0
  assertEquals(
    elektroBuildCode({ size: "032", stroke_mm: 100, pitch: "1", version: "5" }),
    "371032010015",
  );
  assertEquals(
    elektroBuildCode({ size: "032", stroke_mm: 100, pitch: "1", version: "1", drive_pack: "1220" }),
    null,
    "1220 står inte i tabellen för Ø32 -- nyckelns exempel är inte beställbart",
  );
  // Samma positioner med en drivgrupp som FAKTISKT står i tabellen:
  assertEquals(
    elektroBuildCode({ size: "032", stroke_mm: 100, pitch: "1", version: "1", drive_pack: "2220" }),
    "3710320100112220",
  );
});

Deno.test("koden är 12 tecken utan motor och 16 med", () => {
  const utan = elektroBuildCode({ size: "050", stroke_mm: 300, pitch: "2", version: "7" })!;
  const med = elektroBuildCode({ size: "050", stroke_mm: 300, pitch: "2", version: "3", drive_pack: "1430" })!;
  assertEquals(utan.length, ELEKTRO_LIMITS.code_length_no_motor);
  assertEquals(med.length, ELEKTRO_LIMITS.code_length_with_motor);
  assertEquals(utan, "371050030027");
  assertEquals(med, "3710500300231430");
});

Deno.test("KORSKONTROLL: varje drivgrupp hör till en motor som listas för storleken", () => {
  // Det oberoende krysset. Drivgruppens tre första tecken -- motor, fläns,
  // moment -- ska finnas bland motornumren för samma storlek i tabellen på
  // sida A5.31. Motorkod 6 och 7 är växellådsvarianter av 2 och 4 och saknar
  // egna motornummer; de mappas tillbaka.
  const vaxellada: Record<string, string> = { "6": "2", "7": "4" };
  const fel: string[] = [];

  for (const s of ELEKTRO_SIZES) {
    const motorerForStorleken = new Set(
      ELEKTRO_MOTORS_TABLE
        .filter((m) => m.sizes.includes(s.code))
        .map((m) => m.part_no.slice(3, 6)),
    );
    for (const pack of elektroDrivePacks(s.code)) {
      const motor = vaxellada[pack[0]] ?? pack[0];
      const nyckel = motor + pack[1] + pack[2];
      if (!motorerForStorleken.has(nyckel)) {
        fel.push(`${s.code}: drivgrupp ${pack} -> 37M${nyckel} finns inte bland storlekens motorer`);
      }
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("KORSKONTROLL åt andra hållet: varje motor används av sin storlek", () => {
  // Samma tabeller, motsatt riktning. Fångar en motorrad jag råkat utelämna
  // ur beställtabellen.
  const bak: Record<string, string[]> = { "2": ["2", "6"], "4": ["4", "7"] };
  const fel: string[] = [];

  for (const s of ELEKTRO_SIZES) {
    const packs = elektroDrivePacks(s.code);
    for (const m of ELEKTRO_MOTORS_TABLE.filter((x) => x.sizes.includes(s.code))) {
      const kod = m.part_no.slice(3, 6);
      const motorvarianter = bak[kod[0]] ?? [kod[0]];
      const traff = packs.some((p) =>
        motorvarianter.includes(p[0]) && p[1] === kod[1] && p[2] === kod[2]
      );
      if (!traff) fel.push(`${s.code}: motor ${m.part_no} (${m.model}) saknar drivgrupp`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("fotnoternas undantag syns i tabellen", () => {
  // Katalogens fotnot: "version IP65 ... för Ø32 endast för motorkod
  // 37M1120001". Den motorns drivgrupp är 1121. IP55/IP65 är versionerna
  // 3, 4, 7 och 8. Alltså ska 1110, 1120 och 5120 saknas där men 1121 finnas.
  assert(elektroIsOrderable("032", "1", "1", "1110"), "1110 finns för IP40-versionerna");
  assert(!elektroIsOrderable("032", "1", "3", "1110"), "men inte för IP55");
  assert(!elektroIsOrderable("032", "1", "3", "1120"));
  assert(!elektroIsOrderable("032", "1", "3", "5120"));
  assert(elektroIsOrderable("032", "1", "3", "1121"), "1121 = 37M1120001, undantaget");

  // Och: "med undantag för motorkod 37M1470000" -> grupp 1470 saknas i
  // Ø63 HD:s IP55-lista men finns i IP40-listan.
  assert(elektroIsOrderable("H63", "2", "1", "1470"));
  assert(!elektroIsOrderable("H63", "2", "3", "1470"));
});

Deno.test("Ø80 och Ø100 finns bara i versionerna 3, 4, 7 och 8", () => {
  // Nyckelns ◄-fotnot, och beställtabellen håller med.
  for (const size of ["080", "100"]) {
    for (const v of ["1", "2", "5", "6"]) {
      const p = elektroPitchForSize(size);
      assertEquals(
        elektroBuildCode({ size, stroke_mm: 500, pitch: p, version: v, drive_pack: "1890" }),
        null,
        `${size} version ${v} ska inte gå att bygga`,
      );
    }
    for (const v of ["3", "4", "7", "8"]) {
      const p = elektroPitchForSize(size);
      assert(
        elektroBuildCode({ size, stroke_mm: 500, pitch: p, version: v, drive_pack: "1890" }),
        `${size} version ${v} ska gå att bygga`,
      );
    }
  }
});

function elektroPitchForSize(size: string): string {
  return ELEKTRO_COMBOS[size][0].pitches[0];
}

Deno.test("Ø63 HD har bara stigning 5 och 10", () => {
  // Nyckelns ◆-fotnot: "Only for Ø63 with screw pitch 5 or pitch 10".
  // Koderna för de stigningarna är 2 och 4.
  assertEquals(elektroPitches("H63").sort(), ["2", "4"]);
  assert(elektroBuildCode({ size: "H63", stroke_mm: 400, pitch: "2", version: "1", drive_pack: "1450" }));
  assertEquals(
    elektroBuildCode({ size: "H63", stroke_mm: 400, pitch: "1", version: "1", drive_pack: "1450" }),
    null,
    "stigning 4 mm finns inte för Ø63 HD",
  );
});

function elektroPitches(size: string): string[] {
  const ut = new Set<string>();
  for (const c of ELEKTRO_COMBOS[size]) for (const p of c.pitches) ut.add(p);
  return [...ut];
}

Deno.test("slaggränserna är storleksberoende — databasen hade 1 till 1500 för alla", () => {
  // Sida A5.4: största slag 1370 för Ø32, 1500 för de övriga.
  assertEquals(elektroMaxStroke("032"), 1370);
  assertEquals(elektroMaxStroke("050"), 1500);
  assertEquals(elektroMaxStroke("100"), 1500);

  assert(elektroBuildCode({ size: "032", stroke_mm: 1370, pitch: "1", version: "5" }));
  assertEquals(
    elektroBuildCode({ size: "032", stroke_mm: 1371, pitch: "1", version: "5" }),
    null,
    "Ø32 slutar vid 1370",
  );
  assert(elektroBuildCode({ size: "050", stroke_mm: 1500, pitch: "2", version: "5" }));
  assertEquals(elektroBuildCode({ size: "050", stroke_mm: 1501, pitch: "2", version: "5" }), null);

  // Och den undre gränsen är inte 1.
  assertEquals(elektroBuildCode({ size: "032", stroke_mm: 1, pitch: "1", version: "5" }), null);
});

Deno.test("minsta slag följer vridningsskyddet, inte bara storleken", () => {
  // Katalogen ger TVÅ regler. Utan vridningsskydd: 80 mm för Ø32-Ø63HD,
  // 125 mm för Ø80-Ø100 ("in order to re-grease the screw"). MED
  // vridningsskydd: två gånger skruvstigningen.
  assertEquals(elektroMinStroke("032", "5", "1"), 80, "utan vridningsskydd, Ø32");
  assertEquals(elektroMinStroke("080", "7", "4"), 125, "utan vridningsskydd, Ø80");
  assertEquals(elektroMinStroke("063", "7", "7"), 80, "Ø63 hör till 80-gruppen, inte 125");

  // Med vridningsskydd: 2 x stigning. Stigning 4 mm -> 8 mm, stigning 40 -> 80.
  assertEquals(elektroMinStroke("032", "6", "1"), 8);
  assertEquals(elektroMinStroke("100", "8", "9"), 80);

  // Alltså: en vridningsskyddad Ø32 med stigning 4 får gå ned till 8 mm,
  // medan samma cylinder utan vridningsskydd kräver 80.
  assert(elektroBuildCode({ size: "032", stroke_mm: 10, pitch: "1", version: "6" }));
  assertEquals(elektroBuildCode({ size: "032", stroke_mm: 10, pitch: "1", version: "5" }), null);
});

Deno.test("jämna versionskoder är de vridningsskyddade", () => {
  for (const v of ELEKTRO_VERSIONS) {
    assertEquals(elektroIsNonRotating(v.code), v.non_rotating, `version ${v.code}`);
  }
  for (const v of ELEKTRO_VERSIONS_NO_MOTOR) {
    assertEquals(elektroIsNonRotating(v.code), v.non_rotating, `utan motor, version ${v.code}`);
  }
});

Deno.test("de två nycklarnas versioner betyder olika saker", () => {
  // Siffrorna 5-8 finns i båda nycklarna men betyder inte samma sak: med
  // motor är 5 "kuggremsdriven utan vridningsskydd IP40", utan motor är 5
  // "utan vridningsskydd IP40". Att återanvända en lista för båda vore fel.
  const medMotor5 = ELEKTRO_VERSIONS.find((v) => v.code === "5")!;
  const utanMotor5 = ELEKTRO_VERSIONS_NO_MOTOR.find((v) => v.code === "5")!;
  assertEquals(medMotor5.geared, true);
  assertEquals(utanMotor5.geared, false);
  assertEquals(ELEKTRO_VERSIONS_NO_MOTOR.map((v) => v.code), ["5", "6", "7", "8"]);
  // Utan motor finns inte version 1.
  assertEquals(elektroBuildCode({ size: "032", stroke_mm: 100, pitch: "1", version: "1" }), null);
});

Deno.test("varje drivgrupp går att bryta ned i nyckelns egna värden", () => {
  // Intern konsekvens: alla fyra tecknen ska finnas i sin position.
  const fel: string[] = [];
  for (const size of Object.keys(ELEKTRO_COMBOS)) {
    for (const pack of elektroDrivePacks(size)) {
      if (pack.length !== 4) { fel.push(`${size}: ${pack} är inte fyra tecken`); continue; }
      if (!ELEKTRO_MOTORS.some((m) => m.code === pack[0])) fel.push(`${size}/${pack}: motor ${pack[0]}`);
      if (!ELEKTRO_FLANGES.some((f) => f.code === pack[1])) fel.push(`${size}/${pack}: fläns ${pack[1]}`);
      if (!ELEKTRO_TORQUES.some((t) => t.code === pack[2])) fel.push(`${size}/${pack}: moment ${pack[2]}`);
      if (!ELEKTRO_DRIVES.some((d) => d.code === pack[3])) fel.push(`${size}/${pack}: drivning ${pack[3]}`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("utväxlingen är 1 utom för Ø80 och Ø100", () => {
  // Katalogens fotnot ✱. För Ø80/Ø100 beror den på stigning, version och
  // motorisering; för de andra är den 1.
  for (const size of ["032", "050", "063", "H63"]) {
    for (const c of ELEKTRO_COMBOS[size]) {
      for (const p of c.packs) {
        assertEquals(p.ratio, "1", `${size}/${p.code} ska ha utväxling 1`);
      }
    }
  }
  // Och Ø80 har verkligen olika: direktkopplad 1, kuggremsdriven 4/5.
  assertEquals(elektroTransmissionRatio("080", "2", "3", "2540"), "1");
  assertEquals(elektroTransmissionRatio("080", "2", "7", "2540"), "4/5");
  assertEquals(elektroTransmissionRatio("080", "4", "7", "2770"), "2/3");
  assertEquals(elektroTransmissionRatio("100", "4", "3", "6770"), "1/3");
  assertEquals(elektroTransmissionRatio("100", "4", "7", "6770"), null, "6770 finns inte i 7/8");
});

Deno.test("varje beställbar kombination byggs och läses tillbaka", () => {
  // Uttömmande: alla storlekar × alla grupper × alla versioner × alla
  // drivgrupper, med ett slag som ligger inom gränserna.
  const fel: string[] = [];
  let antal = 0;
  for (const s of ELEKTRO_SIZES) {
    for (const c of ELEKTRO_COMBOS[s.code]) {
      for (const pitch of c.pitches) {
        for (const version of c.versions) {
          for (const pack of c.packs) {
            const min = elektroMinStroke(s.code, version, pitch)!;
            const kod = elektroBuildCode({
              size: s.code, stroke_mm: min, pitch, version, drive_pack: pack.code,
            });
            antal++;
            if (!kod) {
              fel.push(`${s.code}/${pitch}/${version}/${pack.code}: byggdes inte`);
              continue;
            }
            if (kod.length !== 16) { fel.push(`${kod}: fel längd`); continue; }
            const r = elektroParseCode(kod);
            if (!r) { fel.push(`${kod}: parsade inte`); continue; }
            if (r.size !== s.code || r.stroke_mm !== min || r.pitch !== pitch ||
                r.version !== version || r.drive_pack !== pack.code) {
              fel.push(`${kod}: läste ${r.size}/${r.pitch}/${r.version}/${r.drive_pack}`);
            }
          }
        }
      }
    }
  }
  assertEquals(fel, [], fel.slice(0, 10).join("\n"));
  assert(antal > 300, `bara ${antal} kombinationer prövade`);
});

Deno.test("konfiguratorns mall ger samma kod som modellen", () => {
  // Det här är testet som binder konfiguratorn till katalogen. Att modellen
  // stämmer med sig själv säger ingenting om vad kunden faktiskt får.
  const kravs = new Set(["size", "stroke_mm", "pitch", "version", "drive_pack"]);
  const fall: Array<{ size: string; stroke_mm: number; pitch: string; version: string; drive_pack: string }> = [
    { size: "032", stroke_mm: 100, pitch: "1", version: "1", drive_pack: "2220" },
    { size: "050", stroke_mm: 300, pitch: "4", version: "4", drive_pack: "2330" },
    { size: "063", stroke_mm: 1500, pitch: "7", version: "8", drive_pack: "433E" },
    { size: "H63", stroke_mm: 80, pitch: "2", version: "1", drive_pack: "1470" },
    { size: "080", stroke_mm: 125, pitch: "4", version: "3", drive_pack: "4770" },
    { size: "100", stroke_mm: 999, pitch: "9", version: "7", drive_pack: "2770" },
  ];
  for (const f of fall) {
    const fran_modellen = elektroBuildCode(f);
    assert(fran_modellen, `modellen byggde inte ${JSON.stringify(f)}`);
    const fran_mallen = fillOrderCodeTemplate(ELEKTRO_ORDER_CODE_TEMPLATE, {
      size: f.size,
      stroke_mm: String(f.stroke_mm),
      pitch: f.pitch,
      version: f.version,
      drive_pack: f.drive_pack,
    }, kravs);
    assertEquals(fran_mallen, fran_modellen, JSON.stringify(f));
  }
});

Deno.test("den gamla mallen producerade ingen giltig kod", () => {
  const ut = fillOrderCodeTemplate("Elektro-{size}-{stroke_mm}-{motor_mount}", {
    size: "32", stroke_mm: "500", motor_mount: "inline",
  });
  assertEquals(ut, "Elektro-32-500-inline");
  assertEquals(elektroParseCode(ut), null);
});

Deno.test("storlek 40 finns inte, 63 HD gör det", () => {
  // Databasens size-lista hade 32, 40, 50, 63, 80, 100. Ø40 finns inte i
  // katalogen, och Ø63 HD -- som har en egen kod, H63 -- saknades.
  assertEquals(ELEKTRO_SIZES.map((s) => s.code), ["032", "050", "063", "H63", "080", "100"]);
  assertEquals(ELEKTRO_SIZES.find((s) => s.bore_mm === 40), undefined);
  const hd = ELEKTRO_SIZES.find((s) => s.code === "H63")!;
  assertEquals(hd.bore_mm, 63);
  assertEquals(hd.heavy_duty, true);
});

Deno.test("stigningarna är åtta och hoppar över kod 3", () => {
  assertEquals(ELEKTRO_PITCHES.map((p) => p.code), ["1", "2", "4", "5", "6", "7", "8", "9"]);
  assertEquals(ELEKTRO_PITCHES.map((p) => p.pitch_mm), [4, 5, 10, 12, 16, 20, 32, 40]);
});

Deno.test("momentkoderna är avskrivna, inte sorterade", () => {
  // 5 är 6,21-7 Nm och 6 är 5,01-6,2 Nm. Det ser omvänt ut och det är precis
  // vad katalogen trycker. Testet finns för att någon inte ska "rätta" det.
  assertEquals(ELEKTRO_TORQUES.find((t) => t.code === "5")!.label_sv, "6,21–7 Nm");
  assertEquals(ELEKTRO_TORQUES.find((t) => t.code === "6")!.label_sv, "5,01–6,2 Nm");
  assertEquals(ELEKTRO_TORQUES.map((t) => t.code), ["0", "1", "2", "3", "4", "5", "6", "7", "9"]);
});

Deno.test("ogiltiga koder avvisas", () => {
  assertEquals(elektroParseCode(""), null);
  assertEquals(elektroParseCode("371032010015X"), null, "13 tecken");
  assertEquals(elektroParseCode("381032010015"), null, "fel typ");
  assertEquals(elektroParseCode("372032010015"), null, "fel standard");
  assertEquals(elektroParseCode("371040010015"), null, "Ø40 finns inte");
  assertEquals(elektroParseCode("37103201001A5"), null, "slag som inte är siffror");
  assertEquals(elektroParseCode("371032010035"), null, "stigning 3 finns inte");
  assertEquals(elektroParseCode("371032010011"), null, "version 1 finns inte utan motor");
  assertEquals(elektroParseCode("3710320100118220"), null, "motor 8 finns inte");
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(ELEKTRO_SOURCE.brand, "Metal Work");
  assertEquals(ELEKTRO_SOURCE.edition, "EN 0224");
  assertEquals(ELEKTRO_SOURCE.section, "A5.4–A5.33");
  assertEquals(ELEKTRO_MOTORS_TABLE.length, 33);
});

/**
 * HMR-modellen mot Parkers beställnyckel.
 *
 * Facit är avskrivet ur sida 20-21 (kulskruv) och 30-31 (kuggrem) i katalog
 * P-A4P024GB, samt katalogens egna exempelrader. Kodens FORM är dessutom
 * bekräftad oberoende: en distributörslistning skriver "HMRS11C160-0500-
 * 000000000", vilket stämmer med mallen tecken för tecken.
 *
 * Två positioner i svansen har varken pil eller förklaringsruta i katalogen.
 * De sätts till "0", och ett test pinnar fast att de INTE erbjuds -- annars
 * hade nästa läsare kunnat tro att de bara glömts bort.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  HMR_BELT_MOUNTS,
  HMR_CARRIAGES,
  HMR_DESIGNS,
  HMR_DRIVE_TYPES,
  HMR_GUIDE_MOUNTINGS,
  HMR_HOME_SENSORS,
  HMR_LIMITS,
  HMR_LIMIT_SENSORS,
  HMR_MOUNTING_KITS,
  HMR_ORDER_CODE_TEMPLATE,
  HMR_PITCHES,
  HMR_SENSOR_POSITIONS,
  HMR_SCREWS,
  HMR_SIZES,
  HMR_SOURCE,
  HMR_SPEED_PER_PITCH,
  hmrBelt,
  hmrBuildCode,
  hmrCarriagesForDrive,
  hmrGuidesForSize,
  hmrKitsForSize,
  hmrMaxStroke,
  hmrParseCode,
  hmrPitchesForSize,
} from "../../../src/lib/catalog/hmr.ts";

Deno.test("katalogens två exempelrader byggs tecken för tecken", () => {
  // Sida 20: HMR S 15 B 05 0 - 0000 - 0 0 0 0 0 00 00
  assertEquals(
    hmrBuildCode({ drive: "S", size: "15", design: "B", pitch_or_mount: "05", stroke_mm: 0 }),
    null,
    "slag 0 finns inte -- mallens 0000 är en platshållare, inte ett värde",
  );
  assertEquals(
    hmrBuildCode({ drive: "S", size: "15", design: "B", pitch_or_mount: "05", stroke_mm: 500 }),
    "HMRS15B050-0500-000000000",
  );
  // Sida 30: HMR B 15 B BD 0 - 0000 - ...
  assertEquals(
    hmrBuildCode({ drive: "B", size: "15", design: "B", pitch_or_mount: "BD", stroke_mm: 500 }),
    "HMRB15BBD0-0500-000000000",
  );
});

Deno.test("OBEROENDE KONTROLL: distributörens kod stämmer med mallen", () => {
  // "HMRS11C160-0500-000000000" -- HMR, kulskruv, storlek 11, utförande C,
  // stigning 16, standardvagn, 500 mm slag. Koden kommer från en helt annan
  // källa än katalogen, och den ska gå att både läsa och bygga.
  const kod = "HMRS11C160-0500-000000000";
  const r = hmrParseCode(kod);
  assert(r, "distributörens kod ska gå att läsa");
  assertEquals(r.drive, "S");
  assertEquals(r.size, "11");
  assertEquals(r.design, "C");
  assertEquals(r.pitch_or_mount, "16");
  assertEquals(r.pitch_mm, 16);
  assertEquals(r.carriage, "0");
  assertEquals(r.stroke_mm, 500);
  assertEquals(
    hmrBuildCode({ drive: "S", size: "11", design: "C", pitch_or_mount: "16", stroke_mm: 500 }),
    kod,
  );
  assertEquals(kod.length, HMR_LIMITS.code_length);
});

Deno.test("stigningen är storleksberoende — varje storlek har exakt två", () => {
  // Sida 20:s kryssmatris. 05 finns på tre storlekar, 10 på två, resten på en.
  assertEquals(hmrPitchesForSize("08").sort(), ["05", "12"]);
  assertEquals(hmrPitchesForSize("11").sort(), ["05", "16"]);
  assertEquals(hmrPitchesForSize("15").sort(), ["05", "20"]);
  assertEquals(hmrPitchesForSize("18").sort(), ["10", "25"]);
  assertEquals(hmrPitchesForSize("24").sort(), ["10", "32"]);
  for (const s of HMR_SIZES) {
    assertEquals(hmrPitchesForSize(s.code).length, 2, `storlek ${s.code}`);
  }
  // Och stigning 32 finns bara på den största.
  assertEquals(
    hmrBuildCode({ drive: "S", size: "08", design: "B", pitch_or_mount: "32", stroke_mm: 500 }),
    null,
  );
  assert(hmrBuildCode({ drive: "S", size: "24", design: "B", pitch_or_mount: "32", stroke_mm: 500 }));
});

Deno.test("position fem betyder olika saker i de två varianterna", () => {
  // Kulskruven har en tvåsiffrig stigning där remmen har ett tvåbokstavigt
  // monteringsläge. Samma bredd, annan betydelse -- och de går inte att byta.
  assertEquals(
    hmrBuildCode({ drive: "S", size: "15", design: "B", pitch_or_mount: "BD", stroke_mm: 500 }),
    null,
    "kulskruven har ingen monteringslägeskod",
  );
  assertEquals(
    hmrBuildCode({ drive: "B", size: "15", design: "B", pitch_or_mount: "05", stroke_mm: 500 }),
    null,
    "remmen har ingen stigning",
  );
  assertEquals(HMR_BELT_MOUNTS.length, 6);
  assertEquals(HMR_PITCHES.length, 7);
});

Deno.test("delad vagn finns bara på remdriften", () => {
  // En skruv kan inte driva två vagnar åt olika håll.
  assertEquals(hmrCarriagesForDrive("S").sort(), ["0", "1"]);
  assertEquals(hmrCarriagesForDrive("B").sort(), ["0", "1", "2"]);
  assertEquals(
    hmrBuildCode({ drive: "S", size: "15", design: "B", pitch_or_mount: "05", carriage: "2", stroke_mm: 500 }),
    null,
  );
  assert(hmrBuildCode({ drive: "B", size: "15", design: "B", pitch_or_mount: "BD", carriage: "2", stroke_mm: 500 }));
});

Deno.test("monteringssats och växelmontage är storleksberoende", () => {
  // Sida 21 och 31:s kryssmatriser.
  assertEquals(hmrKitsForSize("08").sort(), ["00", "C0"]);
  assertEquals(hmrKitsForSize("24").sort(), ["00", "A9", "C3"]);
  assertEquals(hmrGuidesForSize("08").sort(), ["00", "A2", "A3"]);
  assertEquals(hmrGuidesForSize("24").sort(), ["00", "D1", "D2", "D3"]);
  // LP120 finns bara på den största.
  assertEquals(
    hmrBuildCode({ drive: "S", size: "08", design: "B", pitch_or_mount: "05", stroke_mm: 500, guide_mounting: "D1" }),
    null,
  );
  assert(hmrBuildCode({ drive: "S", size: "24", design: "B", pitch_or_mount: "10", stroke_mm: 500, guide_mounting: "D1" }));
  // Och "utan" finns för alla.
  for (const s of HMR_SIZES) {
    assert(hmrKitsForSize(s.code).includes("00"), `${s.code} saknar 00 i monteringssats`);
    assert(hmrGuidesForSize(s.code).includes("00"), `${s.code} saknar 00 i växelmontage`);
  }
});

Deno.test("de två odokumenterade positionerna är alltid nollor", () => {
  // Beställnyckelns pilar pekar ut tre av de fem ensiffriga svanspositionerna
  // och båda de tvåställiga. Den fjärde och femte har varken pil eller ruta.
  // De sätts till "0", och modellen erbjuder dem INTE som val.
  assertEquals(HMR_LIMITS.undocumented_positions, 2);
  const kod = hmrBuildCode({
    drive: "S", size: "15", design: "B", pitch_or_mount: "05", stroke_mm: 500,
    home_sensor: "A", limit_sensor: "B", sensor_position: "5",
    mounting_kit: "A7", guide_mounting: "B1",
  })!;
  assert(kod, "koden ska byggas");
  const svans = kod.split("-")[2];
  assertEquals(svans.length, 9);
  assertEquals(svans[0], "A", "hemgivare");
  assertEquals(svans[1], "B", "gränslägesgivare");
  assertEquals(svans[2], "5", "givarens monteringsläge");
  assertEquals(svans.slice(3, 5), "00", "de två odokumenterade");
  assertEquals(svans.slice(5, 7), "A7", "monteringssats");
  assertEquals(svans.slice(7, 9), "B1", "växelmontage");
});

Deno.test("givarlistorna är åtskilda: NO för hem, NC för gränsläge", () => {
  // Hemgivaren är normalt öppen, gränslägesgivaren normalt sluten. Koderna
  // överlappar inte utom för "0" (utan).
  const hem = new Set(HMR_HOME_SENSORS.map((s) => s.code));
  const grans = new Set(HMR_LIMIT_SENSORS.map((s) => s.code));
  const bada = [...hem].filter((c) => grans.has(c));
  assertEquals(bada, ["0"], `överlappande koder: ${bada.join(", ")}`);
  assertEquals(HMR_HOME_SENSORS.length, 13);
  assertEquals(HMR_LIMIT_SENSORS.length, 13);
  // En gränslägeskod går inte att använda som hemgivare.
  assertEquals(
    hmrBuildCode({ drive: "S", size: "15", design: "B", pitch_or_mount: "05", stroke_mm: 500, home_sensor: "2" }),
    null,
  );
});

Deno.test("givarens monteringsläge går 0 till 200 mm i steg om tio", () => {
  assertEquals(HMR_SENSOR_POSITIONS.length, 21);
  assertEquals(HMR_SENSOR_POSITIONS[0].label_sv, "Utan givare");
  assertEquals(HMR_SENSOR_POSITIONS.find((p) => p.code === "9")!.label_sv, "90 mm");
  assertEquals(HMR_SENSOR_POSITIONS.find((p) => p.code === "A")!.label_sv, "100 mm");
  assertEquals(HMR_SENSOR_POSITIONS.find((p) => p.code === "L")!.label_sv, "200 mm");
  // Bokstaven I hoppas över -- den går inte att skilja från siffran 1.
  assertEquals(HMR_SENSOR_POSITIONS.find((p) => p.code === "I"), undefined);
});

Deno.test("varje beställbar kombination byggs och läses tillbaka", () => {
  const fel: string[] = [];
  let n = 0;
  for (const d of HMR_DRIVE_TYPES) {
    for (const s of HMR_SIZES) {
      const pos5 = d.code === "S" ? hmrPitchesForSize(s.code) : HMR_BELT_MOUNTS.map((m) => m.code);
      for (const p of pos5) {
        for (const des of HMR_DESIGNS) {
          for (const c of hmrCarriagesForDrive(d.code)) {
            for (const slag of [1, 500, 9999]) {
              const kod = hmrBuildCode({
                drive: d.code, size: s.code, design: des.code,
                pitch_or_mount: p, carriage: c, stroke_mm: slag,
              });
              n++;
              if (!kod) { fel.push(`${d.code}/${s.code}/${des.code}/${p}/${c}/${slag}`); continue; }
              if (kod.length !== HMR_LIMITS.code_length) { fel.push(`${kod}: ${kod.length} tecken`); continue; }
              const r = hmrParseCode(kod);
              if (!r) { fel.push(`${kod}: parsade inte`); continue; }
              if (r.drive !== d.code || r.size !== s.code || r.design !== des.code ||
                  r.pitch_or_mount !== p || r.carriage !== c || r.stroke_mm !== slag) {
                fel.push(`${kod}: läste fel`);
              }
            }
          }
        }
      }
    }
  }
  assertEquals(fel.slice(0, 8), [], `${fel.length} av ${n} misslyckades`);
  assert(n > 400, `bara ${n} kombinationer prövade`);
});

Deno.test("konfiguratorns mall ger samma kod som modellen", () => {
  const kravs = new Set(["drive", "size", "design", "pitch_or_mount", "carriage", "stroke_mm"]);
  const fall = [
    { drive: "S", size: "15", design: "B", pitch_or_mount: "05", carriage: "0", stroke_mm: 500 },
    { drive: "B", size: "24", design: "S", pitch_or_mount: "CD", carriage: "2", stroke_mm: 2500 },
    { drive: "S", size: "11", design: "C", pitch_or_mount: "16", carriage: "1", stroke_mm: 500 },
  ];
  for (const f of fall) {
    const modell = hmrBuildCode(f)!;
    assert(modell, JSON.stringify(f));
    const mall = fillOrderCodeTemplate(HMR_ORDER_CODE_TEMPLATE, {
      drive: f.drive, size: f.size, design: f.design,
      pitch_or_mount: f.pitch_or_mount, carriage: f.carriage,
      stroke_mm: String(f.stroke_mm),
      home_sensor: "0", limit_sensor: "0", sensor_position: "0",
      mounting_kit: "00", guide_mounting: "00",
    }, kravs);
    assertEquals(mall, modell, JSON.stringify(f));
  }
});

Deno.test("mallen ger 25 tecken även med alla tillval", () => {
  const kravs = new Set(["drive", "size", "design", "pitch_or_mount", "carriage", "stroke_mm"]);
  const ut = fillOrderCodeTemplate(HMR_ORDER_CODE_TEMPLATE, {
    drive: "S", size: "24", design: "R", pitch_or_mount: "32", carriage: "1",
    stroke_mm: "1200", home_sensor: "G", limit_sensor: "H", sensor_position: "L",
    mounting_kit: "A9", guide_mounting: "D3",
  }, kravs);
  assertEquals(ut.length, HMR_LIMITS.code_length);
  assertEquals(ut, "HMRS24R321-1200-GHL00A9D3");
  assert(hmrParseCode(ut), "och den ska gå att läsa");
});

Deno.test("ogiltiga koder avvisas", () => {
  assertEquals(hmrParseCode(""), null);
  assertEquals(hmrParseCode("HMRS15B050-0500-00000000"), null, "åtta i svansen");
  assertEquals(hmrParseCode("HMRX15B050-0500-000000000"), null, "drivning X");
  assertEquals(hmrParseCode("HMRS99B050-0500-000000000"), null, "storlek 99");
  assertEquals(hmrParseCode("HMRS15Z050-0500-000000000"), null, "utförande Z");
  assertEquals(hmrParseCode("HMRS15B320-0500-000000000"), null, "stigning 32 på storlek 15");
  assertEquals(hmrParseCode("HMRS15B052-0500-000000000"), null, "delad vagn på kulskruv");
  assertEquals(hmrParseCode("HMRS15B050-0500-000000D1D1"), null, "för lång");
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(HMR_SOURCE.brand, "Parker");
  assertEquals(HMR_SOURCE.edition, "P-A4P024GB");
  assertEquals(HMR_SIZES.map((s) => s.width_mm), [85, 110, 150, 180, 240]);
  assertEquals(HMR_DESIGNS.length, 4);
  assertEquals(HMR_MOUNTING_KITS.length, 8);
  assertEquals(HMR_GUIDE_MOUNTINGS.length, 12);
});

Deno.test("KORSKONTROLL: hastighet delad med stigning är samma för alla tio", () => {
  // Motorns varvtal. 0,05 m/s per mm stigning är 50 varv/s, alltså
  // 3 000 v/min -- och det är EXAKT samma tal på alla tio raderna i
  // kulskruvstabellen. En felläst siffra i någon av tio hastigheter eller
  // tio stigningar skulle bryta det omedelbart.
  const fel: string[] = [];
  for (const s of HMR_SCREWS) {
    const kvot = s.max_speed_ms / s.pitch_mm;
    if (Math.abs(kvot - HMR_SPEED_PER_PITCH) > 1e-9) {
      fel.push(`${s.size}/${s.pitch_code}: ${kvot.toFixed(4)} i stället för ${HMR_SPEED_PER_PITCH}`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
  assertEquals(HMR_SCREWS.length, 10);
});

Deno.test("KORSKONTROLL: skruvens diameter följer storleken", () => {
  // Beteckningen "20 x 5" är diameter x stigning. Diametern ska vara densamma
  // för båda stigningarna inom en storlek, och växa med storleken.
  const perStorlek = new Map<string, Set<number>>();
  for (const s of HMR_SCREWS) {
    if (!perStorlek.has(s.size)) perStorlek.set(s.size, new Set());
    perStorlek.get(s.size)!.add(s.screw_diameter_mm);
  }
  for (const [storlek, d] of perStorlek) {
    assertEquals(d.size, 1, `storlek ${storlek} har ${d.size} olika skruvdiametrar`);
  }
  const ordning = HMR_SIZES.map((s) => [...perStorlek.get(s.code)!][0]);
  assertEquals(ordning, [12, 16, 20, 25, 32]);
});

Deno.test("stigningarna i skruvtabellen stämmer med beställnyckeln", () => {
  // Två olika tabeller på två olika sidor: kryssmatrisen på sida 20 och
  // tekniska data på sida 15. De ska ge samma stigningar per storlek.
  const fel: string[] = [];
  for (const s of HMR_SIZES) {
    const franNyckeln = hmrPitchesForSize(s.code).sort();
    const franTabellen = HMR_SCREWS.filter((x) => x.size === s.code)
      .map((x) => x.pitch_code).sort();
    if (JSON.stringify(franNyckeln) !== JSON.stringify(franTabellen)) {
      fel.push(`${s.code}: nyckeln ${franNyckeln} mot tabellen ${franTabellen}`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("slaglängdens tak är storleksberoende", () => {
  // Databasen hade 1-3000 mm för allt. Kulskruven går från 1 200 mm på den
  // minsta till 4 000 på den största; remmen till 6 000.
  assertEquals(hmrMaxStroke("S", "08", "05"), 1200);
  assertEquals(hmrMaxStroke("S", "24", "32"), 4000);
  assertEquals(hmrMaxStroke("B", "08", "BD"), 3000);
  assertEquals(hmrMaxStroke("B", "15", "AP"), 6000);
  // Och taket är detsamma för båda stigningarna inom en storlek.
  assertEquals(hmrMaxStroke("S", "15", "05"), hmrMaxStroke("S", "15", "20"));
});

Deno.test("remdriftens tekniska data saknas för två storlekar, och det sägs", () => {
  // Katalogen ger tabellen för HMRB08, 11 och 15. Storlek 18 och 24 finns i
  // beställnyckeln men deras hastighets- och kraftdata står inte där.
  // Modellen returnerar null i stället för att hitta på.
  assert(hmrBelt("08", "BD"));
  assert(hmrBelt("15", "CD"));
  assertEquals(hmrBelt("18", "BD"), null);
  assertEquals(hmrBelt("24", "BD"), null);
  // Men KODEN går att bygga för dem, för nyckeln täcker alla fem.
  assert(hmrBuildCode({ drive: "B", size: "18", design: "B", pitch_or_mount: "BD", stroke_mm: 1000 }));
  assert(hmrBuildCode({ drive: "B", size: "24", design: "B", pitch_or_mount: "BD", stroke_mm: 1000 }));
});

Deno.test("remmens utväxling beror på motorns monteringsläge", () => {
  // Storlek 15 går 100 mm/varv i lägena 090°/270° men 125 i 000°/180°.
  // Det är en riktig skillnad, inte ett tryckfel: remmen läggs om.
  assertEquals(hmrBelt("15", "BD")!.lead_mm_per_rev, 100);
  assertEquals(hmrBelt("15", "AP")!.lead_mm_per_rev, 125);
  // Och kraften följer med: 1 050 N mot 630 N.
  assertEquals(hmrBelt("15", "BD")!.max_thrust_n, 1050);
  assertEquals(hmrBelt("15", "AP")!.max_thrust_n, 630);
  // För de mindre storlekarna är utväxlingen densamma i alla lägen.
  assertEquals(hmrBelt("08", "BD")!.lead_mm_per_rev, hmrBelt("08", "AP")!.lead_mm_per_rev);
});

/**
 * CCIV-modellen mot Metal Works KEY TO CODES.
 *
 * Facit är avskrivet ur sida A1.136 och A1.140 i utgåva 09/2026. Nyckelns
 * positioner tre och fyra har ingen egen rubrik i tabellen -- bara
 * värdelistor -- och textutvinningen lägger kolumnerna i fel ordning. De
 * lästes därför av sidan som BILD, och testerna nedan pinnar fast resultatet
 * så att ingen råkar kasta om dem igen.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import {
  CCIV_BORES,
  CCIV_CONNECTIONS,
  CCIV_DEFAULT_MAGNET,
  CCIV_FITTINGS,
  CCIV_LIMITS,
  CCIV_MAGNETS,
  CCIV_MATERIALS,
  CCIV_ORDER_CODE_TEMPLATE,
  CCIV_SOURCE,
  CCIV_STROKE_MIN_MM,
  CCIV_TYPES,
  ccivBuildCode,
  ccivIpRating,
  ccivMaterialsForBore,
  ccivParseCode,
  ccivThrustForceN,
  ccivTypesForBore,
  ccivWeightG,
} from "../../../src/lib/catalog/cciv.ts";

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  // Nyckelns egen rad, sida A1.140: CYL 23 0 0 32 0050 C P 2 2
  assertEquals(
    ccivBuildCode({
      type: "23", magnet: "0", bore: "32", stroke_mm: 50,
      material: "C", connection: "2", fittings: "2",
    }),
    "2300320050CP22",
  );
});

Deno.test("koden är alltid fjorton tecken", () => {
  const fel: string[] = [];
  for (const b of CCIV_BORES) {
    for (const t of ccivTypesForBore(b.code)) {
      for (const m of ccivMaterialsForBore(b.code)) {
        const kod = ccivBuildCode({
          type: t, magnet: "0", bore: b.code, stroke_mm: 5,
          material: m, connection: "2", fittings: "1",
        });
        if (!kod) { fel.push(`${t}/${b.code}/${m}: byggdes inte`); continue; }
        if (kod.length !== CCIV_LIMITS.code_length) fel.push(`${kod}: ${kod.length} tecken`);
      }
    }
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("ISO-typerna finns bara för Ø32 och Ø40", () => {
  // Katalogens ■-fotnot. Typ 25 och 26 är ISO-centrumavstånd.
  assertEquals(ccivTypesForBore("20"), ["23", "24"]);
  assertEquals(ccivTypesForBore("25"), ["23", "24"]);
  assertEquals(ccivTypesForBore("32"), ["23", "24", "25", "26"]);
  assertEquals(ccivTypesForBore("40"), ["23", "24", "25", "26"]);

  assertEquals(
    ccivBuildCode({ type: "25", magnet: "0", bore: "20", stroke_mm: 50, material: "X", connection: "2", fittings: "1" }),
    null,
    "ISO-typ på Ø20 finns inte",
  );
  assert(ccivBuildCode({ type: "25", magnet: "0", bore: "32", stroke_mm: 50, material: "X", connection: "2", fittings: "1" }));
});

Deno.test("Ø20 och Ø25 har alltid rostfri kolvstång", () => {
  // Två fotnoter som pekar åt samma håll: ▲ på borrningarna 20 och 25 betyder
  // "rostfri kolvstång", och ■ på materialet C betyder "bara Ø32 och 40".
  // En Ø20 i hårdförkromat C45 finns alltså inte.
  assertEquals(ccivMaterialsForBore("20"), ["X"]);
  assertEquals(ccivMaterialsForBore("25"), ["X"]);
  assertEquals(ccivMaterialsForBore("32"), ["C", "X"]);
  assertEquals(ccivMaterialsForBore("40"), ["C", "X"]);

  assertEquals(
    ccivBuildCode({ type: "23", magnet: "0", bore: "20", stroke_mm: 50, material: "C", connection: "2", fittings: "1" }),
    null,
  );
  assert(ccivBuildCode({ type: "23", magnet: "0", bore: "20", stroke_mm: 50, material: "X", connection: "2", fittings: "1" }));
  // Och komponentlistan håller med: "PISTON ROD: C45 steel or stainless steel".
  assertEquals(CCIV_BORES.filter((b) => b.stainless_rod_only).map((b) => b.bore_mm), [20, 25]);
});

Deno.test("KORSKONTROLL: slagtaket står på två ställen i katalogen", () => {
  // Nyckelns borrkolumn säger "Ø 20 - 25: max 200 mm, Ø 32 - 40: max 300 mm".
  // Tekniska data på en annan sida säger "Maximum recommended strokes:
  // 200 200 300 300". Två tabeller, samma tal -- det är krysset som säger att
  // kolumnerna lästs rätt.
  const franNyckeln: Record<string, number> = { "20": 200, "25": 200, "32": 300, "40": 300 };
  for (const b of CCIV_BORES) {
    assertEquals(b.stroke_max_mm, franNyckeln[b.code], `Ø${b.bore_mm}`);
  }
});

Deno.test("slaglängdens gränser hålls", () => {
  assert(ccivBuildCode({ type: "23", magnet: "0", bore: "20", stroke_mm: 200, material: "X", connection: "2", fittings: "1" }));
  assertEquals(
    ccivBuildCode({ type: "23", magnet: "0", bore: "20", stroke_mm: 201, material: "X", connection: "2", fittings: "1" }),
    null,
    "Ø20 slutar vid 200",
  );
  assert(ccivBuildCode({ type: "23", magnet: "0", bore: "32", stroke_mm: 300, material: "X", connection: "2", fittings: "1" }));
  assertEquals(
    ccivBuildCode({ type: "23", magnet: "0", bore: "32", stroke_mm: 301, material: "X", connection: "2", fittings: "1" }),
    null,
  );
  // Undre gränsen är 5, inte 1. Databasen hade 1.
  assertEquals(CCIV_STROKE_MIN_MM, 5);
  assertEquals(
    ccivBuildCode({ type: "23", magnet: "0", bore: "20", stroke_mm: 4, material: "X", connection: "2", fittings: "1" }),
    null,
  );
  assert(ccivBuildCode({ type: "23", magnet: "0", bore: "20", stroke_mm: 5, material: "X", connection: "2", fittings: "1" }));
});

Deno.test("varje beställbar kombination byggs och läses tillbaka", () => {
  const fel: string[] = [];
  let antal = 0;
  for (const b of CCIV_BORES) {
    for (const t of ccivTypesForBore(b.code)) {
      for (const m of ccivMaterialsForBore(b.code)) {
        for (const mag of CCIV_MAGNETS) {
          for (const c of CCIV_CONNECTIONS) {
            for (const f of CCIV_FITTINGS) {
              for (const slag of [CCIV_STROKE_MIN_MM, 50, b.stroke_max_mm]) {
                const kod = ccivBuildCode({
                  type: t, magnet: mag.code, bore: b.code, stroke_mm: slag,
                  material: m, connection: c.code, fittings: f.code,
                });
                antal++;
                if (!kod) { fel.push(`${t}/${mag.code}/${b.code}/${slag}/${m}/${c.code}/${f.code}`); continue; }
                const r = ccivParseCode(kod);
                if (!r) { fel.push(`${kod}: parsade inte`); continue; }
                if (r.type !== t || r.bore !== b.code || r.stroke_mm !== slag ||
                    r.material !== m || r.magnet !== mag.code ||
                    r.connection !== c.code || r.fittings !== f.code) {
                  fel.push(`${kod}: läste fel`);
                }
              }
            }
          }
        }
      }
    }
  }
  assertEquals(fel.slice(0, 8), [], `${fel.length} av ${antal} misslyckades`);
  assert(antal > 500, `bara ${antal} kombinationer prövade`);
});

Deno.test("kapslingsklassen följer kontakten", () => {
  // Katalogen, sida A1.136: "With plug-in connector: IP51; with M8 connector:
  // IP65". Det är ett andra kryss mot nyckelns elektriska position.
  assertEquals(ccivIpRating("2"), "IP51");
  assertEquals(ccivIpRating("M"), "IP65");
  assertEquals(ccivIpRating("X"), null);
  assertEquals(ccivParseCode("2300320050CP22")!.ip, "IP51");
  assertEquals(ccivParseCode("2300320050CPM2")!.ip, "IP65");
});

Deno.test("vikten är bas plus tillägg per millimeter", () => {
  // Sida A1.136: Ø20 väger 220 g vid slag 0 och 2,35 g per mm.
  assertEquals(ccivWeightG("20", 0), 220);
  assertEquals(ccivWeightG("20", 100), 455);
  assertEquals(ccivWeightG("40", 0), 420);
  assertEquals(ccivWeightG("40", 300), 1743);
  assertEquals(ccivWeightG("99", 10), null);

  // Rimlighet: en större borrning väger mer, både tomt och per millimeter.
  for (let i = 1; i < CCIV_BORES.length; i++) {
    assert(CCIV_BORES[i].weight_base_g > CCIV_BORES[i - 1].weight_base_g);
    assert(CCIV_BORES[i].weight_per_mm_g > CCIV_BORES[i - 1].weight_per_mm_g);
  }
});

Deno.test("tryckkraften följer kolvarean", () => {
  // Räknad, inte avskriven -- katalogen hänvisar till kapitlets allmänna
  // tabell. Kontrollen är att formeln är rätt implementerad: kraften ska
  // fyrdubblas när diametern fördubblas.
  const f20 = ccivThrustForceN("20", 6)!;
  const f40 = ccivThrustForceN("40", 6)!;
  // pi/4 * 0,020^2 * 6 bar = 188,5 N; samma räkning för Ø40 ger 754,0 N.
  assertEquals(f20, 188.5);
  assertEquals(f40, 754);
  assert(Math.abs(f40 / f20 - 4) < 0.002, `${f40}/${f20}`);

  // Utanför katalogens tryckområde ges ingen siffra.
  assertEquals(ccivThrustForceN("20", 2), null, "under 3 bar");
  assertEquals(ccivThrustForceN("20", 8), null, "över 7 bar");
  assertEquals(CCIV_LIMITS.pressure_min_bar, 3);
  assertEquals(CCIV_LIMITS.pressure_max_bar, 7);
});

Deno.test("hastigheten sjunker med borrningen", () => {
  // Ø20 går 1,4 m/s ut, Ø40 bara 0,4. En större kolv behöver mer luft.
  for (let i = 1; i < CCIV_BORES.length; i++) {
    assert(CCIV_BORES[i].speed_out_ms <= CCIV_BORES[i - 1].speed_out_ms,
      `Ø${CCIV_BORES[i].bore_mm} ska inte vara snabbare än Ø${CCIV_BORES[i - 1].bore_mm}`);
  }
  assertEquals(CCIV_BORES[0].speed_out_ms, 1.4);
  assertEquals(CCIV_BORES[3].speed_out_ms, 0.4);
});

Deno.test("no-stick-slip är standard för de små borrningarna", () => {
  // Katalogens ◆ är ett STANDARDVAL, inte ett förbud. Alla tre magnetkoder
  // går att bygga på alla borrningar.
  assertEquals(CCIV_DEFAULT_MAGNET["20"], "G");
  assertEquals(CCIV_DEFAULT_MAGNET["32"], "0");
  for (const mag of CCIV_MAGNETS) {
    assert(
      ccivBuildCode({ type: "23", magnet: mag.code, bore: "20", stroke_mm: 50, material: "X", connection: "2", fittings: "1" }),
      `magnet ${mag.code} ska gå att bygga på Ø20`,
    );
  }
});

Deno.test("positionerna tre och fyra är verkningssätt och magnet", () => {
  // Den ordningen går INTE att utläsa ur textutvinningen; den lästes av
  // sidan som bild. Testet finns för att ingen ska kasta om dem.
  const r = ccivParseCode("2300320050CP22")!;
  assertEquals(r.action, "0", "position 3 = dubbelverkande");
  assertEquals(r.magnet, "0", "position 4 = magnet");
  const s = ccivParseCode("230S320050CP22")!;
  assertEquals(s.magnet, "S", "omagnetisk kolv");
  assertEquals(s.bore, "32");
  const g = ccivParseCode("230G320050CP22")!;
  assertEquals(g.magnet, "G");
});

Deno.test("konfiguratorns mall ger samma kod som modellen", () => {
  // Verkningssätt och tätningar skickas INTE av konfiguratorn -- de står som
  // fasta tecken i mallen. Testet speglar det: bara de sju valen skickas.
  const kravs = new Set(["type", "magnet", "bore", "stroke_mm", "material", "connection", "fittings"]);
  const fall: CcivFall[] = [
    { type: "23", magnet: "0", bore: "32", stroke_mm: 50, material: "C", connection: "2", fittings: "2" },
    { type: "24", magnet: "G", bore: "20", stroke_mm: 5, material: "X", connection: "M", fittings: "1" },
    { type: "26", magnet: "S", bore: "40", stroke_mm: 300, material: "X", connection: "M", fittings: "5" },
  ];
  for (const f of fall) {
    const modell = ccivBuildCode(f);
    assert(modell, `modellen byggde inte ${JSON.stringify(f)}`);
    const mall = fillOrderCodeTemplate(CCIV_ORDER_CODE_TEMPLATE, {
      type: f.type, magnet: f.magnet, bore: f.bore,
      stroke_mm: String(f.stroke_mm), material: f.material,
      connection: f.connection, fittings: f.fittings,
    }, kravs);
    assertEquals(mall, modell, JSON.stringify(f));
  }
});

interface CcivFall {
  type: string; magnet: string; bore: string; stroke_mm: number;
  material: string; connection: string; fittings: string;
}

Deno.test("den gamla mallen producerade ingen giltig kod", () => {
  const ut = fillOrderCodeTemplate("CCIV-{bore_mm}-{stroke_mm}-{cushioning}{sensing}",
    { bore_mm: "20", stroke_mm: "100", cushioning: "P", sensing: "A" });
  assertEquals(ut, "CCIV-20-100-PA");
  assertEquals(ccivParseCode(ut), null);
});

Deno.test("de gamla dämpningskoderna hör inte hemma i CCIV", () => {
  // Databasen hade cushioning P/PPV/PPSA -- det är FESTOS DSBC-koder, lånade
  // till en Metal Work-familj vars nyckel inte har någon dämpningsposition
  // alls. Nyckeln har nio positioner och ingen av dem är dämpning.
  const positioner = CCIV_ORDER_CODE_TEMPLATE.match(/\{[^}]+\}/g)!.map((s) => s.slice(1, -1).split("#")[0]);
  assertEquals(positioner.length, 7, "sju val; verkningssätt och tätning är fasta tecken");
  assert(!positioner.includes("cushioning"), "CCIV har ingen dämpningsposition");
  assert(!positioner.includes("sensing"), "magneten är en position, sensorspåret är det inte");
});

Deno.test("Ø40 fanns inte i databasen men finns i katalogen", () => {
  assertEquals(CCIV_BORES.map((b) => b.bore_mm), [20, 25, 32, 40]);
  assert(ccivBuildCode({ type: "23", magnet: "0", bore: "40", stroke_mm: 100, material: "X", connection: "2", fittings: "1" }));
});

Deno.test("ogiltiga koder avvisas", () => {
  assertEquals(ccivParseCode(""), null);
  assertEquals(ccivParseCode("2300320050CP2"), null, "13 tecken");
  assertEquals(ccivParseCode("2300320050CP222"), null, "15 tecken");
  assertEquals(ccivParseCode("2200320050CP22"), null, "typ 22 finns inte");
  assertEquals(ccivParseCode("2310320050CP22"), null, "verkningssätt 1 finns inte");
  assertEquals(ccivParseCode("2300500050CP22"), null, "Ø50 finns inte");
  assertEquals(ccivParseCode("230032005XCP22"), null, "slag som inte är siffror");
  assertEquals(ccivParseCode("2300320050YP22"), null, "material Y finns inte");
  assertEquals(ccivParseCode("2300320050CN22"), null, "tätning N finns inte");
  assertEquals(ccivParseCode("2300320050CPX2"), null, "kontakt X finns inte");
  assertEquals(ccivParseCode("2300320050CP26"), null, "anslutning 6 finns inte");
  assertEquals(ccivParseCode("2500200050XP22"), null, "ISO-typ på Ø20");
  assertEquals(ccivParseCode("2300200050CP22"), null, "C45 på Ø20");
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(CCIV_SOURCE.brand, "Metal Work");
  assertEquals(CCIV_SOURCE.section, "A1.136–A1.140");
  assert(CCIV_SOURCE.edition.includes("09/2026"));
  assertEquals(CCIV_TYPES.length, 4);
  assertEquals(CCIV_FITTINGS.length, 5);
});

Deno.test("mallen ger fjorton tecken utan att konfiguratorn skickar de fasta", () => {
  // Regressionen: skrevs verkningssätt och tätning som {action} och {gaskets}
  // utan motsvarande parameter ersatte mallmotorn dem med tomt, och koden
  // blev tretton tecken. Den hade sett nästan rätt ut.
  const kravs = new Set(["type", "magnet", "bore", "stroke_mm", "material", "connection", "fittings"]);
  const ut = fillOrderCodeTemplate(CCIV_ORDER_CODE_TEMPLATE, {
    type: "23", magnet: "0", bore: "32", stroke_mm: "50",
    material: "C", connection: "2", fittings: "2",
  }, kravs);
  assertEquals(ut.length, CCIV_LIMITS.code_length);
  assertEquals(ut, "2300320050CP22");
  assertEquals(ut[2], "0", "verkningssättet finns kvar");
  assertEquals(ut[11], "P", "tätningen finns kvar");
  assert(ccivParseCode(ut), "och koden går att läsa");
});

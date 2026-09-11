/**
 * Orderkodsläsningen.
 *
 * Fallet som gav upphov till modulen: en sökning på sajtens EGEN
 * exempelprodukt, DSBC-50-100-PPSA-N3, gav två Bosch Rexroth Ø32/Ø40 med
 * motiveringen att de låg "inom det maximala bore-kravet på 50 mm". Ø32 ger
 * 483 N mot kravets 1178 N -- 41 %.
 *
 * Familjedatan nedan är kopierad ur configurator_families och
 * configurator_param_values 2026-09-11.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  findOrderCodeTokens,
  orderCodeInstruction,
  readOrderCodes,
  resolveOrderCode,
  type FamilyBrief,
} from "./order-code.ts";

const FAMILJER: FamilyBrief[] = [
  { slug: "dsbc", name: "DSBC", bores: [32, 40, 50, 63, 80, 100, 125], strokeMin: 1, strokeMax: 2800 },
  { slug: "cq2", name: "CQ2", bores: [12, 16, 20, 25, 32, 40, 50, 63, 80, 100], strokeMin: 1, strokeMax: 300 },
  { slug: "p1d", name: "P1D", bores: [32, 40, 50, 63, 80, 100, 125], strokeMin: 1, strokeMax: 2000 },
  { slug: "p1f", name: "P1F", bores: [160, 200, 250, 320], strokeMin: 1, strokeMax: 2300 },
  { slug: "pra", name: "PRA", bores: [32, 40, 50, 63, 80, 100, 125], strokeMin: 1, strokeMax: 2000 },
  { slug: "kpz", name: "KPZ", bores: [12, 16, 20, 25, 32, 40, 50, 63], strokeMin: 5, strokeMax: 100 },
  { slug: "adn", name: "ADN", bores: [12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125], strokeMin: 1, strokeMax: 500 },
  { slug: "dsnu", name: "DSNU", bores: [8, 10, 12, 16, 20, 25], strokeMin: 1, strokeMax: 500 },
];

Deno.test("fallet som gav upphov till modulen", () => {
  const r = resolveOrderCode("DSBC-50-100-PPSA-N3", FAMILJER);
  assert(r, "DSBC-50-100-PPSA-N3 måste gå att slå upp");
  assertEquals(r.familySlug, "dsbc");
  assertEquals(r.boreMm, 50, "50 är EXAKT borrning, inte ett tak");
  assertEquals(r.strokeMm, 100);
});

Deno.test("koder med olika grammatik läses rätt", () => {
  const fall: Array<[string, string, number | null, number | null]> = [
    ["DSBC-50-100-PPSA-N3", "dsbc", 50, 100],
    ["DSBC-32-20-D3-PPVA-N3", "dsbc", 32, 20],
    ["DSBC-125-2500-PPV", "dsbc", 125, 2500],
    // Borrningen sitter inbakad i ett segment hos Parker.
    ["P1D-S050MS-0200", "p1d", 50, 200],
    ["P1D-S100MS-0400", "p1d", 100, 400],
    // Familjenamnet innehåller själv en siffra -- "2" i CQ2 får inte tas
    // för en borrning.
    ["CQ2B32-100", "cq2", 32, 100],
    ["CQ2B12-50", "cq2", 12, 50],
    ["KPZ-040-0100-A-0-PPV", "kpz", 40, 100],
    ["PRA-63-200-PPVA", "pra", 63, 200],
  ];
  for (const [kod, slug, bore, stroke] of fall) {
    const r = resolveOrderCode(kod, FAMILJER);
    assert(r, `${kod} gick inte att slå upp`);
    assertEquals(r.familySlug, slug, `${kod}: fel familj`);
    assertEquals(r.boreMm, bore, `${kod}: fel borrning`);
    assertEquals(r.strokeMm, stroke, `${kod}: fel slaglängd`);
  }
});

Deno.test("en borrning utanför familjens lista slås inte upp", () => {
  // P1F finns bara i Ø160-320. En P1F-50 existerar inte, och då är det
  // bättre att säga "känner inte igen" än att låtsas.
  assertEquals(resolveOrderCode("P1F-50-200", FAMILJER), null);
  // Men de riktiga storlekarna fungerar.
  assertEquals(resolveOrderCode("P1F-200-500", FAMILJER)?.boreMm, 200);
});

Deno.test("okända beteckningar flaggas i stället för att gissas", () => {
  const r = readOrderCodes("Kunden skickade XYZ-999-ABC och vill ha offert", FAMILJER);
  assertEquals(r.resolved.length, 0);
  assert(r.unknown.includes("XYZ-999-ABC"), `fick: ${JSON.stringify(r.unknown)}`);
});

Deno.test("vanlig prosa utlöser inga falska koder", () => {
  for (const text of [
    "Jag behöver en cylinder som lyfter 20 kg",
    "Vi kör 6 bar och behöver 200 mm slag",
    "Miljön är dammig, IP65 räcker",
  ]) {
    assertEquals(findOrderCodeTokens(text), [], `falsk träff i: ${text}`);
  }
});

Deno.test("instruktionen låser måtten och förbjuder gissning", () => {
  const r = readOrderCodes("Byt ut DSBC-50-100-PPSA-N3 och QQQ-1-2", FAMILJER);
  const s = orderCodeInstruction(r, "sv");
  assert(s.includes("EXAKT Ø50 mm"), "borrningen måste låsas som exakt");
  assert(s.includes("EXAKT 100 mm"), "slaglängden måste låsas som exakt");
  assert(s.toLowerCase().includes("aldrig"), "måste förbjuda mindre borrning");
  assert(s.includes("QQQ-1-2"), "okänd beteckning måste nämnas");
  // Det konkreta påhittet som hände: "N3 motsvarar IP67".
  assert(/kapslingsklass/i.test(s), "måste förbjuda gissad kapslingsklass");
});

Deno.test("ingen text ger ingen instruktion", () => {
  assertEquals(orderCodeInstruction(readOrderCodes("", FAMILJER), "sv"), "");
  assertEquals(
    orderCodeInstruction(readOrderCodes("en cylinder för 20 kg", FAMILJER), "sv"),
    "",
  );
});

Deno.test("flera koder i samma förfrågan läses var för sig", () => {
  const r = readOrderCodes("Ersätt DSBC-50-100 med CQ2B32-100", FAMILJER);
  assertEquals(r.resolved.map((x) => `${x.familySlug}:${x.boreMm}`), ["dsbc:50", "cq2:32"]);
});

Deno.test("katalogens fakta följer med, och resten förbjuds", () => {
  // Med rätt mått men UTAN fakta hittade modellen på resten: DSBC kallades
  // "hydraulisk borrcylinder" med 250 bar och en "PPSA-seal
  // (poly-phenyl-sulfon-akryl)". DSBC är pneumatisk, max 10 bar, och PPSA är
  // dämpning. Instruktionen ska bära de riktiga uppgifterna och stänga dörren
  // för de påhittade.
  const facts = new Map([["dsbc", {
    sku: "FESTO-DSBC",
    name: "DSBC – ISO 15552 Standard Cylinder",
    brand: "Festo",
    specs: {
      mode_of_operation: "Double-acting",
      medium: "Compressed air ISO 8573-1 [7:4:4]",
      max_pressure: "10",
      standard: "ISO 15552",
      cushioning_types: "P, PPV-A, YSR",
    },
  }]]);

  const r = readOrderCodes("Ersätt DSBC-50-100-PPSA-N3", FAMILJER);
  const s = orderCodeInstruction(r, "sv", facts);

  assert(s.includes("Double-acting"), "verkningssättet måste med");
  assert(s.includes("Compressed air"), "mediet måste med — den sa 'hydraulisk'");
  assert(s.includes("10"), "maxtrycket måste med — den sa 250 bar");
  assert(s.includes("P, PPV-A, YSR"), "dämpningstyperna måste med");
  assert(/ENDA du får ange/.test(s), "resten måste uttryckligen förbjudas");
  assert(/inte finns i katalogen/.test(s), "måste anvisa ett ärligt 'vet ej'");
});

Deno.test("utan fakta låses ändå måtten", () => {
  // Faller faktahämtningen bort ska instruktionen fortfarande finnas kvar och
  // låsa borrningen -- det var det ursprungliga felet.
  const s = orderCodeInstruction(readOrderCodes("DSBC-50-100", FAMILJER), "sv");
  assert(s.includes("EXAKT Ø50 mm"));
});

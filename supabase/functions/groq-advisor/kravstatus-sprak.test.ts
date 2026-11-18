import { assert, assertEquals } from "jsr:@std/assert@^1";
import { kravstatusPaSprak, kravtextPaSprak } from "./kravstatus-sprak.ts";
import { provaDampenergi, provaFaltbuss, provaVentilplatser } from "./komponentkrav.ts";
import { provaGripkraft, provaIp, provaSpanning, provaTemperatur, provaTryck, tolkaKravSpanning } from "./kontroller.ts";
import type { CatalogProduct } from "./scoring.ts";

// Varje engelsk form som kravstatusen byggs av, med exempelvärden.
const FORMER = [
  "force 98 N (preliminary estimate)", "force 300 N", "stroke/travel 200 mm", "precision ±0.1 mm",
  "pusher speed", "environment (atex)", "standard ISO 15552", "pressure 8 bar", "grip force",
  "grip force ≈ 50 N (rule of thumb: weight × 100 for a friction grip)", "grip force 120 N",
  "IP rating IP67", "temperature 180 °C", "food/washdown", "holding force", "holding force ≈ 98 N (weight × 9.81 × 2)",
  "holding force 50 N", "energy ≈ 36.0 J per cycle", "fieldbus PROFINET", "8 valve stations",
  "the option gives 1178 N", "the option's force is unknown", "the stroke is chosen at order", "the option has 200 mm",
  "the option has 250 mm; the travel must be limited or confirmed", "repeatability ±0.05 mm according to the catalogue",
  "a pneumatic cylinder only stops precisely at its end positions", "the catalogue gives no repeatability for the option",
  "not stated -- the conveyor speed is not the pusher's", "no automatic check", "the option is ISO 15552",
  "the option's standard is not stated", "the catalogue gives no pressure for the item", "the item is rated max 10 bar",
  "the item requires min 3 bar", "the item is rated up to 150 °C", "the item is only rated up to 80 °C",
  "neither the load's mass nor the grip force is stated", "the catalogue gives no grip force for the item",
  "the series gives ≈ 6300 N in its largest size", "the item gives ≈ 62 N", "the catalogue gives no voltage for the item",
  "the item is specified for 24 V DC", "the catalogue gives no IP rating for the item", "the requirement could not be read",
  "the catalogue gives no maximum temperature for the item; standard seals are made for about 80 °C, so verify a high-temperature version",
  "ATEX-marked according to the catalogue", "no ATEX marking in the catalogue; must not be used in the zone without a certificate",
  "washdown-rated according to the catalogue; food approval is confirmed in the quote",
  "the catalogue states no IP rating, stainless version or food approval for the item; verify before purchase",
  "neither the load's mass nor the holding force is stated", "the cup's holding force is unknown", "one cup gives ≈ 3.1 N (estimate)",
  "one cup gives ≈ 28 N; ≈ 4 cups are needed (estimate)", "one cup gives ≈ 3.1 N; ≈ 32 cups would be needed, so choose a larger cup (estimate)",
  "the item gives ≈ 170 N; choose the size that gives at least 500 N", "the catalogue gives no energy capacity for the absorber",
  "the absorber takes 58.8 J per cycle", "the absorber only takes 2.94 J per cycle", "the catalogue gives no fieldbus for the item",
  "the item is available for PROFINET", "the catalogue does not give the number of valve stations",
  "the terminal has up to 16 stations", "the terminal only has 4 stations",
];

Deno.test("varje engelsk kravform översätts till tyska och spanska", () => {
  for (const loc of ["de", "es"]) {
    for (const f of FORMER) {
      const ut = kravtextPaSprak(f, loc);
      assert(ut !== f, `${loc}: "${f}" översattes inte`);
      assert(!/\b(the|option|catalogue|item|stroke|force|cycle|stations)\b/.test(ut), `${loc}: engelska kvar i "${ut}"`);
    }
  }
});

Deno.test("exempel och decimalkomma", () => {
  assertEquals(kravtextPaSprak("force 59 N (preliminary estimate)", "de"), "Kraft 59 N (vorläufige Schätzung)");
  assertEquals(kravtextPaSprak("energy ≈ 36.0 J per cycle", "es"), "energía ≈ 36,0 J por ciclo");
  assertEquals(kravtextPaSprak("the option has 250 mm; the travel must be limited or confirmed", "de"), "die Option hat 250 mm; der Weg muss begrenzt oder bestätigt werden");
  assertEquals(kravtextPaSprak("standard ISO 15552", "de"), "Norm ISO 15552", "ingen komma i ISO-numret");
  // Svenska och engelska är orörda; okänt står kvar.
  assertEquals(kravtextPaSprak("force 98 N", "en"), "force 98 N");
  assertEquals(kravtextPaSprak("kraft 98 N", "sv"), "kraft 98 N");
  assertEquals(kravtextPaSprak("something new", "de"), "something new");
});

Deno.test("formerna som funktionerna faktiskt bygger känns igen", () => {
  const p = (key_specs: Record<string, unknown>): CatalogProduct => ({ sku: "X", name: "X", category: "valve-terminal", brand: "", key_specs });
  const rader = [
    provaTemperatur(180, {}, false), provaTemperatur(120, { temp_range: "-10…150 °C" }, false),
    provaTryck(8, { max_pressure: "10 bar" }, false), provaTryck(8, {}, false),
    provaIp("IP67", { ip_rating: "IP65" }, false),
    provaDampenergi(36, p({ energy_j: "2.94" }), false), provaFaltbuss("PROFINET", p({ fieldbus: "IO-Link" }), false),
    provaVentilplatser(8, p({ stations: "4" }), false),
  ];
  for (const r of rader) {
    for (const loc of ["de", "es"]) {
      assert(kravtextPaSprak(r.krav, loc) !== r.krav, `${loc}: krav "${r.krav}"`);
      assert(kravtextPaSprak(r.text, loc) !== r.text, `${loc}: text "${r.text}"`);
    }
  }
  // Spänningskravet ("24 V DC") är detsamma på alla språk; texten översätts.
  const spanning = provaSpanning(tolkaKravSpanning("24 V DC")!, { voltage: "24 V DC" }, false);
  assert(kravtextPaSprak(spanning.text, "de") !== spanning.text, spanning.text);
  const grip = provaGripkraft({ n: 50, angiven: false } as never, 62, false);
  assert(kravtextPaSprak(grip.text, "de") !== grip.text);
});

Deno.test("kravstatusPaSprak översätter alternativens rader", () => {
  const ut = kravstatusPaSprak([{ sku: "A", kravstatus: [{ krav: "force 300 N", utfall: "uppfyllt", text: "the option gives 792 N" }] }], "es");
  assertEquals(ut[0].kravstatus, [{ krav: "fuerza 300 N", utfall: "uppfyllt", text: "la opción da 792 N" }]);
  const sv = [{ sku: "A", kravstatus: [{ krav: "kraft 300 N", utfall: "uppfyllt", text: "alternativet ger 792 N" }] }];
  assertEquals(kravstatusPaSprak(sv, "sv"), sv);
});

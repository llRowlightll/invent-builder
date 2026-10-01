import { assertEquals } from "jsr:@std/assert";
import { klassaLuftberedning } from "./bom-builder.ts";

// Exakt de namn som finns i katalogen, hämtade ur produktionsdatabasen.
//
// Regressionen: BOM-raden kallade allt i kategorin "air-preparation" för
// "FRL-enhet (Filter-Regulator-Smörjare)". En granskning fångade att
// MS4 Filter G1/4 -- ett filter -- presenterades som komplett FRL med
// motiveringen att den "säkerställer rätt arbetstryck".
const fall: Array<[string, string]> = [
  ["MS4 Filter G1/4",                          "endast_filter"],
  ["Parker P3TFA Bulk Liquid Separator 1/4\" BSPP", "endast_filter"],
  ["MS4 Regulator G1/4",                       "endast_regulator"],
  ["AR20-02G tryckreduceringventil G1/4",      "endast_regulator"],
  ["LR-1/4-D-MINI tryckreduceringventil",      "endast_regulator"],
  ["MS4 Filter+Regulator G1/4",                "filter_regulator"],
  ["MS6 Filter+Regulator G1/4",                "filter_regulator"],
  ["AC20A Filter+Regulator G1/4",              "filter_regulator"],
  ["AW20 Filter+Regulator G1/4",               "filter_regulator"],
  ["Serie MC – Modular Filter-Regulator 1/8\"", "filter_regulator"],
  ["Serie MX – Modular Filter-Regulator 1/2\"", "filter_regulator"],
  ["MS4 FRL-kombienhet G1/4",                  "frl"],
  ["Metal Work FRL Unit Size 1 G1/4",          "frl"],
  ["Serie MC – Modular FRL 1/4\"",             "frl"],
  ["Serie MX – Modular FRL Unit 3/8\"",        "frl"],
  ["MS – Modular Service Unit (FRL)",          "frl"],
  ["AW – Filter Regulator Combination (FRL)",  "frl"],
];

Deno.test("klassaLuftberedning mot katalogens verkliga namn", () => {
  for (const [namn, vantat] of fall) {
    assertEquals(klassaLuftberedning(namn), vantat, `fel för: ${namn}`);
  }
});

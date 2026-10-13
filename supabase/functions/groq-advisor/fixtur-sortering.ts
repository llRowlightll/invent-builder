/**
 * Regressionsfallet från testet 2026-10-13: sortering av plastlådor från ett
 * transportband (manualen "Maskinbyggare + PLC & programmering", avsnitt 13).
 * Förväntad kravbild och de okända uppgifterna prövas i kravbild.test.ts,
 * signals.test.ts och resultat.test.ts, och i webbläsarens tests/plc.test.ts.
 */
export const SORTERING =
  "Vi vill sortera ut plastlådor från ett transportband. Lådorna väger 0,5–3 kg och är max 300 × 200 × 150 mm. " +
  "Bandet går med 0,25 m/s och det kommer upp till 15 lådor per minut med varierande avstånd. " +
  "När kontrollstationen ger en signal ska lådan skjutas av i sidled 350 mm till ett mottagande rullbord, utan att välta eller skadas. " +
  "Vi har 6 bar tryckluft och 24 V DC och en befintlig PLC med digitala I/O. Drift 16 timmar per dag i torr miljö med lätt damm.";

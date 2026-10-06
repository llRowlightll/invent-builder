/**
 * Är frågan en kunskapsfråga (allmänt svar) eller en produktfråga (motorn)?
 *
 * Ändrad 2026-10-05. Förut räckte det att frågan innehöll "tryck",
 * "temperatur", "tätning", "teknisk", "seal" eller "pressure" någonstans --
 * som delsträng. "Cylinder för livsmedelsindustri med daglig högtryckstvätt,
 * Ø32, 100 mm slag" innehåller "tryck" och fick ett allmänt AI-svar i
 * stället för motorns förslag. Det är just kraven en ingenjör skriver i en
 * produktfråga.
 *
 * Nu: mått, last, tryck i siffror eller "jag behöver" betyder produktfråga.
 * Frågeformer ("hur fungerar", "vad är skillnaden") betyder kunskapsfråga.
 * Ämnesord räknas bara när ingen produkt nämns.
 */

// Siffra med enhet, en borrning eller ett uttryckligt behov.
const PRODUKTKRAV =
  /ø\s*\d|\d+(?:[.,]\d+)?\s*(?:mm|cm|kg|kn|n|bar|mpa|°\s*c|grader|l\/min|nl\/min)(?![a-zåäö])|\b(?:behöver|söker|letar efter|need|looking for|ich brauche|necesito)\b/;

const FRAGEFORM = [
  /hur\s+(fungerar|monterar|installerar|kopplar|väljer|dimensionerar)/,
  /vad\s+(är|betyder|innebär|skiljer)/,
  /skillnad\s+mellan/,
  /how\s+(does|do|to|is)/,
  /what\s+(is|are|does)/,
  /\b(explain|difference)\b/,
];

const AMNESORD = [
  /installation|maintenance|service|seal|pressure|temperature|specification|data ?sheet|technical/,
  /specifikation|montering|underhåll|tätning|tryck|temperatur|datablad|teknisk/,
];

const PRODUKTORD =
  /cylind|ventil|valve|gripp|griper|greifer|sugkopp|suction|vakuum|vacuum|ejekt|aktuator|actuator|ställdon|slang|tube|koppling|fitting|regulator|filter|motor|servo|axel|axis|zylinder|cilindro|válvula|pinza/;

export function arKunskapsfraga(fraga: string): boolean {
  const t = fraga.toLowerCase();
  if (PRODUKTKRAV.test(t)) return false;
  if (FRAGEFORM.some((r) => r.test(t))) return true;
  return AMNESORD.some((r) => r.test(t)) && !PRODUKTORD.test(t);
}

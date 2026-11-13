/**
 * En rad där man skriver till AI:n. Kundgranskningen 2026-11-13: varningen
 * stod bara i villkoren (avsnitt 8) och integritetspolicyn, inte där frågan
 * skrivs eller bilden laddas upp.
 */
export const AI_VARNING: Record<string, string> = {
  sv: "AI-förslag kan vara fel – kontrollera mot tillverkarens datablad. Text och bilder behandlas av AI-tjänster i USA; skriv inte personuppgifter eller sekretessbelagt.",
  en: "AI suggestions can be wrong – check against the manufacturer's datasheet. Text and images are processed by AI services in the USA; do not enter personal or confidential data.",
  de: "KI-Vorschläge können falsch sein – prüfen Sie sie anhand des Herstellerdatenblatts. Texte und Bilder werden von KI-Diensten in den USA verarbeitet; geben Sie keine personenbezogenen oder vertraulichen Daten ein.",
  es: "Las sugerencias de la IA pueden ser erróneas: compruébelas con la ficha técnica del fabricante. Los textos e imágenes los procesan servicios de IA en EE. UU.; no introduzca datos personales ni confidenciales.",
};

export function aiVarning(locale: string): string {
  return AI_VARNING[locale] ?? AI_VARNING.en;
}

/**
 * Metal Work VME — minitryckventiler, mekaniskt och manuellt manövrerade.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Metal Work, "General Catalogue", avsnitt B1.4-B1.7, "MINIVALVES,
 *   MECHANICALLY AND HAND OPERATED SERIES VME". Ligger i knowledge_chunks som
 *   source_file = 'Metal_Work_General_Catalogue.pdf', chunk 288-289.
 *
 * En TABELLFAMILJ som RTC-HD: åtta färdiga artikelnummer, ingen räknebar regel.
 * Katalogens rubrik är "ORDERING CODES", och tabellen har fyra kolumner --
 * artikelnummer, funktion, anslutningsläge och portstorlek.
 *
 * TRANSKRIBERINGEN KRÄVDE FÖRSIKTIGHET. I den inlästa texten står numren
 * ihopklistrade med symbolkolumnen: raden ser ut som "a13 2W3501000100 3/2 NC
 * Axial fittings Ø 4 22", där "a13" och "2" hör till diagramhänvisningen och
 * inte till artikelnumret. Numren nedan är utplockade med ett mönster som
 * kräver W följt av exakt tio siffror, så symbolkolumnen inte kan följa med.
 *
 * VÅRA TRE PRODUKTRADER ÄR PÅHITTADE: MW-VME-14, MW-VME-M5 och MW-VME-18.
 * Metal Work numrerar inte så, och VME finns varken i storlek 14 eller 18 --
 * serien har en enda ventilstorlek och varierar i funktion, anslutningsläge
 * och portgänga.
 */

export const VME_SOURCE = {
  file: "Metal_Work_General_Catalogue.pdf",
  section: "B1.4–B1.7",
  title: "Metal Work Minivalves series VME",
  brand: "Metal Work",
} as const;

export interface VmeArticle {
  part_no: string;
  /** 3/2 NC eller 3/2 NO. */
  function: string;
  /** Anslutningens läge: axial eller side. */
  fittings: string;
  /** Portstorlek: "Ø4" (insticksanslutning) eller "M5" (gänga). */
  port: string;
  weight_g: number;
}

/**
 * Katalogens åtta ventiler, avskrivna ur ORDERING CODES-tabellen.
 *
 * Numren är INTE räknebara -- de tre sista siffrorna följer inget mönster som
 * går att härleda ur tabellen. Därför står de utskrivna, som RTC-HD:s.
 */
export const VME_ARTICLES: VmeArticle[] = [
  { part_no: "W3501000100", function: "3/2 NC", fittings: "axial", port: "Ø4", weight_g: 22 },
  { part_no: "W3501000111", function: "3/2 NC", fittings: "axial", port: "M5", weight_g: 24 },
  { part_no: "W3501001101", function: "3/2 NC", fittings: "side", port: "Ø4", weight_g: 22 },
  { part_no: "W3501001111", function: "3/2 NC", fittings: "side", port: "M5", weight_g: 24 },
  { part_no: "W3501000101", function: "3/2 NO", fittings: "axial", port: "Ø4", weight_g: 22 },
  { part_no: "W3501000110", function: "3/2 NO", fittings: "axial", port: "M5", weight_g: 24 },
  { part_no: "W3501001100", function: "3/2 NO", fittings: "side", port: "Ø4", weight_g: 22 },
  { part_no: "W3501001110", function: "3/2 NO", fittings: "side", port: "M5", weight_g: 24 },
];

/** Funktionerna: normalt stängd och normalt öppen. */
export const VME_FUNCTIONS = ["3/2 NC", "3/2 NO"] as const;
/** Anslutningens läge. */
export const VME_FITTINGS = ["axial", "side"] as const;
/** Portstorlekarna. */
export const VME_PORTS = ["Ø4", "M5"] as const;

/** Slår upp artikelnumret. Null = kombinationen finns inte. */
export function vmePartNo(
  fn: string, fittings: string, port: string,
): string | null {
  return VME_ARTICLES.find(
    (a) => a.function === fn && a.fittings === fittings && a.port === port,
  )?.part_no ?? null;
}

/** Läser ett VME-artikelnummer. */
export function parseVmePartNo(raw: string): VmeArticle | null {
  const nr = raw.trim().toUpperCase();
  return VME_ARTICLES.find((a) => a.part_no === nr) ?? null;
}

/**
 * Tillbehören ur samma tabell: adapter, manöverdon och väljare.
 *
 * De är INTE ventiler utan monteras på dem, och de har ett eget nummerserie
 * (W0351…). De listas här för att katalogen gör det, men de hör till
 * tillbehör snarare än till familjens produktrader.
 */
export const VME_ACCESSORIES: Array<{ part_no: string; label_sv: string }> = [
  { part_no: "W0351000015", label_sv: "Rött manöverdon med horisontellt vridbar spak" },
  { part_no: "W0351000011", label_sv: "Bred tryckknapp med två färgbrickor, röd och svart" },
  { part_no: "W0351000013", label_sv: "Röd svampknapp Ø40" },
  { part_no: "W0351000014", label_sv: "Röd svampknapp med lås Ø40" },
  { part_no: "W0351000017", label_sv: "Svart svampknapp Ø40" },
  { part_no: "W0351000049", label_sv: "Reducering från 30 till 22,5 mm" },
];

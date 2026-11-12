/**
 * Fraktbolagen leverantören kan välja. Koderna är desamma som databasens
 * registrera_forsandelse godtar; spårningslänken räknas fram i databasen
 * (sparningslank) och följer med försändelsen.
 */
export const FRAKTBOLAG: { kod: string; namn: string }[] = [
  { kod: "postnord", namn: "PostNord" },
  { kod: "dhl", namn: "DHL" },
  { kod: "schenker", namn: "DB Schenker" },
  { kod: "bring", namn: "Bring" },
  { kod: "ups", namn: "UPS" },
  { kod: "fedex", namn: "FedEx" },
  { kod: "dsv", namn: "DSV" },
  { kod: "annat", namn: "Annat" },
];

export function fraktbolagsnamn(kod: string | null | undefined): string {
  return FRAKTBOLAG.find((f) => f.kod === (kod ?? "").toLowerCase())?.namn ?? (kod || "Fraktbolag");
}

/** Samma regel som databasen: 4–40 tecken, bokstäver, siffror, mellanslag och bindestreck. */
export function giltigtSparningsnummer(nr: string): boolean {
  return /^[A-Za-z0-9 -]{4,40}$/.test(nr.trim());
}

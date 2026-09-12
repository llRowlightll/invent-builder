/**
 * Parker P1F — ISO 15552-cylinder i de stora borrningarna, Ø160 till Ø320.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Parker Hannifin, Pneumatic Division — Europe, "Pneumatic Cylinders
 *   ISO 15552", PDE2667TCEN. Ligger i knowledge_chunks som
 *   source_file = 'Parker ISO 15552 cylinder Parker catalog.pdf'.
 *   Beställnyckeln står i chunk 19-20, tekniska data i chunk 11.
 *
 * SYSKON TILL P1D, men för de stora måtten: P1D går 32-125 mm, P1F tar vid vid
 * 160 och slutar vid 320. Nycklarna är olika trots namnlikheten.
 *
 * Katalogens eget exempel, tecken för tecken (chunk 19):
 *
 *   P 1 F - T 1 6 0 M S X 0 1 6 0 - 0 0 0 0
 *   └─┬─┘   │ └─┬─┘ │ │ │ └──┬──┘   └──┬──┘
 *    P1F    │  borr │ │ │   slag      tillägg
 *      profil ──────┘ │ │
 *      temperatur ────┘ │
 *      kolvstång ───────┘
 *      kolvtyp ─────────┘
 *
 * Våra fem produktrader följer nyckeln exakt. Det var konfiguratorn som var
 * fel: mallen "P1F-S{bore_mm}M{thread}-{stroke_mm}" har ett S där
 * profilbokstaven ska stå, saknar tre positioner och nollutfyller ingenting.
 */

export const P1F_SERIE = "P1F";

export const P1F_SOURCE = {
  file: "Parker ISO 15552 cylinder Parker catalog.pdf",
  edition: "PDE2667TCEN",
  title: "Parker Pneumatic Cylinders ISO 15552, P1F",
  brand: "Parker",
  standard: "ISO 15552",
} as const;

export interface P1fValue { code: string; label_sv: string }

/** Position 1 efter bindestrecket — Profile/cylinder design. */
export const P1F_DESIGNS: P1fValue[] = [
  { code: "T", label_sv: "Dragstänger" },
  { code: "N", label_sv: "Dragstänger med genomgående kolvstång" },
];

/** Borrningarna. Katalogen: "Bore size 160 - 320 mm". */
export const P1F_BORES = [160, 200, 250, 320];

/** Temperature range. */
export const P1F_TEMPERATURES: P1fValue[] = [
  { code: "M", label_sv: "Standard −20 till +80 °C" },
  { code: "F", label_sv: "Hög temperatur −20 till +150 °C" },
];

/**
 * Kolvstångsmaterial och gängtyp i samma position.
 *
 * Katalogen listar dem som två rader -- "Piston Rod material male thread
 * S Stainless steel" och "Piston Rod material female thread E Stainless
 * steel" -- alltså samma material, olika gänga.
 */
export const P1F_RODS: P1fValue[] = [
  { code: "S", label_sv: "Rostfritt stål, utvändig gänga" },
  { code: "E", label_sv: "Rostfritt stål, invändig gänga" },
];

/** Piston style. */
export const P1F_PISTONS: P1fValue[] = [
  { code: "X", label_sv: "Aluminium med magnet" },
  { code: "A", label_sv: "Aluminium utan magnet" },
];

/**
 * Slaglängd, fyra siffror. Katalogen: "Stroke length 10 - 2300 mm".
 * Databasen sa 1-2300 -- maxvärdet stämde, den undre gränsen inte.
 */
export const P1F_STROKE = { min: 10, max: 2300, unit: "mm" } as const;

/**
 * De fyra sista tecknen: kolvstångsförlängning eller mellantapp.
 *
 * "0000" är utan. "P" följt av ett mått ger förlängd kolvstång i mm, "G" och
 * "7" ger mellantapp i två vinklar mot luftanslutningarna. Måttets format
 * framgår inte av den inlästa texten -- katalogen hänvisar till XV-måttet på
 * sidan 15, som inte finns i utdraget. Därför modelleras bara "0000" som
 * valbart; de andra kan läsas men inte konfigureras fram.
 */
export const P1F_EXTENSION_NONE = "0000";

export interface P1fReading {
  design: string;
  bore_mm: number;
  temperature: string;
  rod: string;
  piston: string;
  stroke_mm: number;
  extension: string;
}

/** Bygger en P1F-kod. Null när något värde inte finns i nyckeln. */
export function buildP1fCode(c: {
  design?: string; bore_mm: number; temperature?: string;
  rod?: string; piston?: string; stroke_mm: number; extension?: string;
}): string | null {
  if (!P1F_BORES.includes(c.bore_mm)) return null;
  if (!Number.isInteger(c.stroke_mm) || c.stroke_mm < P1F_STROKE.min || c.stroke_mm > P1F_STROKE.max) {
    return null;
  }
  const finns = (l: P1fValue[], k: string) => l.some((x) => x.code === k);
  const d = c.design ?? "T";
  const t = c.temperature ?? "M";
  const r = c.rod ?? "S";
  const p = c.piston ?? "X";
  if (!finns(P1F_DESIGNS, d) || !finns(P1F_TEMPERATURES, t)) return null;
  if (!finns(P1F_RODS, r) || !finns(P1F_PISTONS, p)) return null;

  return `${P1F_SERIE}-${d}${c.bore_mm}${t}${r}${p}` +
    `${String(c.stroke_mm).padStart(4, "0")}-${c.extension ?? P1F_EXTENSION_NONE}`;
}

/** Läser en P1F-kod. Null när formen inte stämmer. */
export function parseP1fCode(raw: string): P1fReading | null {
  const m = /^P1F-([TN])(\d{3})([MF])([SE])([XA])(\d{4})-([0-9A-Z]{4})$/.exec(raw.trim().toUpperCase());
  if (!m) return null;
  const bore_mm = Number(m[2]);
  const stroke_mm = Number(m[6]);
  if (!P1F_BORES.includes(bore_mm)) return null;
  if (stroke_mm < P1F_STROKE.min || stroke_mm > P1F_STROKE.max) return null;
  return {
    design: m[1], bore_mm, temperature: m[3], rod: m[4],
    piston: m[5], stroke_mm, extension: m[7],
  };
}

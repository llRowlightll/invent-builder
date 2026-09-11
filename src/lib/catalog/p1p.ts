/**
 * Parker P1P — kompaktcylinder ISO 21287, beställnyckel ur katalogen.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Parker Hannifin, Pneumatic Division, "Compact Pneumatic Cylinders",
 *   katalog 0900P-7, avsnitt D. Dokumentet ligger i knowledge_chunks som
 *   source_file = '0900P_Compact.pdf'. Beställnyckeln står i chunk 19-20,
 *   tekniska data i chunk 7.
 *
 * DEN HÄR FAMILJEN SKILJER SIG FRÅN DE TRE FÖREGÅENDE PÅ EN VIKTIG PUNKT:
 * produktraderna är RÄTT. Revisionen flaggade P1P som "noll av åtta
 * artikelnummer hittade i katalogen", men det var ett falskt larm -- Parker
 * trycker en beställNYCKEL, inte en artikelnummerlista, så det finns inget att
 * slå upp emot. Kodernas FORM stämmer exakt med nyckeln:
 *
 *   P1P  S  032  D  C  7  G  0 0 2 5      <- katalogens eget exempel, chunk 20
 *   └┬┘  │  └┬┘  │  │  │  │  └──┬──┘
 *    1-3 4  5-7  8  9  10 11   12-15
 *
 * Det som var fel var KONFIGURATORN: mallen "P1P-{bore_mm}0{stroke_mm}N{thread}"
 * ger "P1P-2000025N", och borrningslistan saknade Ø80 och Ø100 fast vi säljer
 * båda. Produktraderna rörs därför inte -- bara modellen omkring dem.
 *
 * Lärdomen är värd att skriva ut: en nolla i katalogkontrollen betyder att
 * artikeln inte gick att BELÄGGA, inte att den är påhittad. Skillnaden avgörs
 * av vad dokumentet innehåller, och den måste avgöras per familj.
 */

export const P1P_SERIE = "P1P";

export const P1P_SOURCE = {
  file: "0900P_Compact.pdf",
  edition: "0900P-7",
  title: "Parker Compact Pneumatic Cylinders, P1P Compact ISO Series",
  brand: "Parker",
  standard: "ISO 21287",
} as const;

/** Kodens längd. Katalogens exempel och alla våra åtta artiklar är 15 tecken. */
export const P1P_CODE_LENGTH = 15;

export interface P1pValue {
  code: string;
  label_sv: string;
  /** Borrningar värdet är tillåtet för. Tom = alla. */
  bores?: number[];
}

/** Katalogens åtta borrningar (chunk 7: "Bore Size 20 - 100 mm", chunk 19). */
export const P1P_BORES = [20, 25, 32, 40, 50, 63, 80, 100];

/** Position 4 — Cylinder Version. */
export const P1P_VERSIONS: P1pValue[] = [
  { code: "S", label_sv: "Standard" },
  { code: "G", label_sv: "Styrd kolvstång", bores: [20, 25, 32, 40, 50, 63] },
];

/** Position 8 — Function. */
export const P1P_FUNCTIONS: P1pValue[] = [
  { code: "D", label_sv: "Dubbelverkande" },
  { code: "S", label_sv: "Enkelverkande, fjäderretur", bores: [20, 25, 32, 40, 50, 63] },
  { code: "T", label_sv: "Enkelverkande, fjäderutskjut", bores: [20, 25, 32, 40, 50, 63] },
  { code: "K", label_sv: "Genomgående kolvstång" },
];

/** Position 9 — Temperature Range. */
export const P1P_TEMPERATURES: P1pValue[] = [
  { code: "C", label_sv: "Standard −20 till +80 °C" },
  { code: "G", label_sv: "Hög temperatur −10 till +120 °C" },
  { code: "K", label_sv: "Låg temperatur −40 till +80 °C" },
];

/** Position 10 — Piston Rod Thread. */
export const P1P_ROD_THREADS: P1pValue[] = [
  { code: "7", label_sv: "Invändig gänga" },
  { code: "8", label_sv: "Utvändig gänga" },
  { code: "3", label_sv: "Special kolvstångsände" },
];

/**
 * Position 11 — Cylinder Ports & Magnetic Function.
 *
 * Katalogen skriver ut "Magnet G" och anslutningarna (Ø20-25: M5, Ø32-100: BSP).
 * Rubriken "Non Magnetic Function" står också där, men dess KOD har
 * textutvinningen tappat -- den saknas i den inlästa texten. Alltså modelleras
 * bara G, och en cylinder utan magnet går inte att konfigurera förrän koden är
 * verifierad. Att gissa en bokstav vore samma fel som P1D:s position 10.
 */
export const P1P_PORTS: P1pValue[] = [
  { code: "G", label_sv: "Med magnetkolv" },
];

/** Slaglängd, positionerna 12-15, fyra siffror (chunk 7: "Stroke Length 1-500 mm"). */
export const P1P_STROKE = { min: 1, max: 500, unit: "mm" } as const;

/**
 * Standardslaglängder ur tabellen i chunk 20. Allt annat är
 * "Non Standard Stroke Length" -- beställbart, men inte lagervara.
 *
 * VILKA av dem som gäller per borrning är markerat med bockar i katalogen, och
 * bockarna överlever inte textutvinningen. Listan är därför unionen.
 */
export const P1P_STANDARD_STROKES = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];

export interface P1pReading {
  version: string;
  bore_mm: number;
  function: string;
  temperature: string;
  rod_thread: string;
  ports: string;
  stroke_mm: number;
}

/** Bygger en P1P-kod. Null när något värde inte finns i nyckeln. */
export function buildP1pCode(c: {
  version?: string; bore_mm: number; function?: string;
  temperature?: string; rod_thread?: string; ports?: string; stroke_mm: number;
}): string | null {
  if (!P1P_BORES.includes(c.bore_mm)) return null;
  if (!Number.isInteger(c.stroke_mm) || c.stroke_mm < P1P_STROKE.min || c.stroke_mm > P1P_STROKE.max) {
    return null;
  }
  const v = c.version ?? "S";
  const f = c.function ?? "D";
  const t = c.temperature ?? "C";
  const r = c.rod_thread ?? "7";
  const p = c.ports ?? "G";
  const finns = (lista: P1pValue[], kod: string) => lista.some((x) => x.code === kod);
  if (!finns(P1P_VERSIONS, v) || !finns(P1P_FUNCTIONS, f) || !finns(P1P_TEMPERATURES, t)) return null;
  if (!finns(P1P_ROD_THREADS, r) || !finns(P1P_PORTS, p)) return null;

  return P1P_SERIE + v + String(c.bore_mm).padStart(3, "0") + f + t + r + p +
    String(c.stroke_mm).padStart(4, "0");
}

/** Läser en P1P-kod. Null när formen inte stämmer. */
export function parseP1pCode(raw: string): P1pReading | null {
  const s = raw.trim().toUpperCase();
  if (s.length !== P1P_CODE_LENGTH) return null;
  const m = /^P1P([SG])(\d{3})([DSTK])([CGK])([783])([G])(\d{4})$/.exec(s);
  if (!m) return null;
  const bore_mm = Number(m[2]);
  const stroke_mm = Number(m[7]);
  if (!P1P_BORES.includes(bore_mm)) return null;
  if (stroke_mm < P1P_STROKE.min || stroke_mm > P1P_STROKE.max) return null;
  return {
    version: m[1], bore_mm, function: m[3], temperature: m[4],
    rod_thread: m[5], ports: m[6], stroke_mm,
  };
}

export interface P1pRule {
  note: string;
  severity: "error" | "warn";
  when: Record<string, unknown>;
  message_sv: string;
  message_en: string;
}

// NOLLUTFYLLDA. Konfiguratorns param_value.code är borrningen som den står i
// KODEN -- "080", inte "80" -- och reglerna körs mot de värdena. Första
// versionen jämförde mot "80" och larmade därför aldrig. Testet fällde den.
const stora = [80, 100].map((n) => String(n).padStart(3, "0"));

export const P1P_RULES: P1pRule[] = [
  {
    note: "P1P1",
    severity: "error",
    // Katalogen: "G Guided 20-63 mm Bore".
    when: { and: [{ "==": [{ var: "version" }, "G"] }, { in: [{ var: "bore_mm" }, stora] }] },
    message_sv: "Styrd kolvstång (utförande G) finns bara för Ø20–63 mm.",
    message_en: "The guided piston rod (version G) is only available for Ø20–63 mm.",
  },
  {
    note: "P1P2",
    severity: "error",
    // Katalogen: "S Single Acting: Spring Return (Bore 20 - 63mm)" och
    // motsvarande för T.
    when: { and: [{ in: [{ var: "function" }, ["S", "T"]] }, { in: [{ var: "bore_mm" }, stora] }] },
    message_sv: "Enkelverkande utföranden (S och T) finns bara för Ø20–63 mm.",
    message_en: "Single-acting versions (S and T) are only available for Ø20–63 mm.",
  },
  {
    note: "P1P3",
    severity: "error",
    // Katalogen, ordagrant: "NOTE: Single acting only available as 25 mm stroke".
    when: {
      and: [
        { in: [{ var: "function" }, ["S", "T"]] },
        { "!=": [{ var: "stroke_mm" }, 25] },
      ],
    },
    message_sv: "Enkelverkande utföranden finns bara med 25 mm slaglängd.",
    message_en: "Single-acting versions are only available with a 25 mm stroke.",
  },
  {
    note: "P1P4",
    severity: "warn",
    when: {
      and: [
        { ">": [{ var: "stroke_mm" }, 0] },
        { not: { in: [{ var: "stroke_mm" }, P1P_STANDARD_STROKES] } },
      ],
    },
    message_sv:
      "Slaglängden är ingen standardlängd i katalogen. Cylindern går att beställa men tillverkas som specialmått — räkna med längre leveranstid.",
    message_en:
      "The stroke is not a catalogue standard length. The cylinder is orderable but made to special order — expect a longer lead time.",
  },
];

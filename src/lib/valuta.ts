/**
 * Omräkning av en offert från kronor till kundens valuta.
 *
 * Ägaren 2026-11-13: utländska kunder får offerten i euro, med det
 * valutapåslag "alla brukar ha" (standard 2 %, ändras i Inställningar).
 * Kursen är Riksbankens (kronor per enhet). Påslaget läggs på priset i
 * kundens valuta, så att växlingsavgift och kursrörelse fram till
 * betalningen inte äter marginalen.
 *
 * Ingen import av supabase-klienten, så att filen kan provas med deno test.
 */
export const VALUTOR = ["EUR", "USD", "GBP"] as const;
export type Valuta = (typeof VALUTOR)[number];

export const STANDARD_PASLAG = 2;

export function arValuta(v: string | null | undefined): v is Valuta {
  return (VALUTOR as readonly string[]).includes(v ?? "");
}

/** Pris i kundens valuta: kronor ÷ kurs × (1 + påslag), avrundat till cent. */
export function omraknat(sek: number, kursSekPerEnhet: number, paslagProcent: number): number {
  if (!(kursSekPerEnhet > 0) || !Number.isFinite(sek)) return sek;
  const p = Number.isFinite(paslagProcent) && paslagProcent >= 0 ? paslagProcent : STANDARD_PASLAG;
  return Math.round((sek / kursSekPerEnhet) * (1 + p / 100) * 100) / 100;
}

/** Läser påslaget ur inställningen; ogiltigt eller saknat ger standard. */
export function lasPaslag(v: string | null | undefined): number {
  const t = String(v ?? "").trim();
  if (t === "") return STANDARD_PASLAG; // Number("") är 0 -- inget påslag vore fel
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 20 ? n : STANDARD_PASLAG;
}

/** Meningen på offerten om hur priserna räknades om, eller null i kronor. */
export function valutanot(
  v: { valuta: string; kurs: number | null; datum: string | null; paslag: number | null },
  locale: string,
): string | null {
  if (!arValuta(v.valuta) || !v.kurs) return null;
  const sv = locale === "sv";
  const kurs = v.kurs.toLocaleString(sv ? "sv-SE" : "en-GB", { maximumFractionDigits: 4 });
  const paslag = (v.paslag ?? STANDARD_PASLAG).toLocaleString(sv ? "sv-SE" : "en-GB");
  return sv
    ? `Priser i ${v.valuta}, omräknade från SEK med Riksbankens kurs ${kurs} kr/${v.valuta}${v.datum ? ` (${v.datum})` : ""} och ${paslag} % valutapåslag.`
    : `Prices in ${v.valuta}, converted from SEK at the Riksbank rate of ${kurs} SEK/${v.valuta}${v.datum ? ` (${v.datum})` : ""} plus a ${paslag} % currency surcharge.`;
}

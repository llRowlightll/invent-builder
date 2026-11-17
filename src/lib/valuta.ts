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

/**
 * Valutan en leverantörsoffert anger, som kod: "€" och "Euro" blir EUR, "kr"
 * blir SEK. En annan kod (DKK, CHF …) lämnas som den är -- den går inte att
 * räkna om, och anroparen ska säga det i stället för att gissa. null när
 * dokumentet inte angav någon valuta.
 */
export function valutakod(text: string | null | undefined): string | null {
  const t = String(text ?? "").trim().toUpperCase();
  if (!t) return null;
  // Danska, norska och isländska kronor skrivs också "kr": koden vinner.
  const nordisk = t.match(/\b(DKK|NOK|ISK)\b/);
  if (nordisk) return nordisk[1];
  const kod = t.match(/\b(SEK|EUR|USD|GBP)\b/);
  if (kod) return kod[1];
  if (t.includes("€")) return "EUR";
  if (t.includes("£")) return "GBP";
  if (t.includes("$")) return "USD";
  if (/^[A-Z]{3}$/.test(t)) return t;
  if (/\b(KR|KRONOR|SKR)\b|:-/.test(t)) return "SEK";
  if (/\bEUROS?\b/.test(t)) return "EUR";
  return t;
}

/**
 * Leverantörens pris i offertens valuta, eller null när en kurs saknas --
 * aldrig ett pris i fel valuta. Kurserna är Riksbankens, kronor per enhet.
 *
 * Från leverantörens valuta till kronor gäller kursen rakt av: det är vad
 * inköpet kostar. Från kronor till kundens valuta läggs påslaget på precis som
 * på offertens egna priser (omraknat), så att raden blir lika dyr oavsett om
 * leverantörsofferten lästes in före eller efter omräkningen.
 */
export function inkopIOffertvaluta(
  pris: number,
  fran: string,
  till: string,
  k: { franKurs?: number | null; tillKurs?: number | null; paslag: number },
): number | null {
  if (!Number.isFinite(pris)) return null;
  if (fran === till) return pris;
  let sek: number;
  if (fran === "SEK") sek = pris;
  else if (k.franKurs != null && k.franKurs > 0) sek = pris * k.franKurs;
  else return null;
  if (till === "SEK") return Math.round(sek * 100) / 100;
  if (!(k.tillKurs != null && k.tillKurs > 0)) return null;
  return omraknat(sek, k.tillKurs, k.paslag);
}

/** omraknat baklänges: påslaget dras av, kursen ger kronor. null utan kurs. */
export function tillKronor(belopp: number, kursSekPerEnhet: number, paslagProcent: number): number | null {
  if (!(kursSekPerEnhet > 0) || !Number.isFinite(belopp)) return null;
  const p = Number.isFinite(paslagProcent) && paslagProcent >= 0 ? paslagProcent : 0;
  return Math.round((belopp / (1 + p / 100)) * kursSekPerEnhet * 100) / 100;
}

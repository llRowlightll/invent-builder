/**
 * Känner igen tillverkarnas orderkoder i kundens text.
 *
 * VARFÖR. Sökte man på `DSBC-50-100-PPSA-N3` -- sajtens egen exempelprodukt --
 * svarade rådgivaren med två Bosch Rexroth Ø32/Ø40 och motiverade det med att
 * borrningen låg "inom det maximala bore-kravet på 50 mm". Den läste alltså en
 * EXAKT storlek som ett TAK, och levererade 483 N mot ett krav på 1178 N.
 * Dessutom hittade den på att "N3 motsvarar IP67" (N3 är en
 * standardkonformitetskod) och att PPSA var en "trycknivå" (det är dämpning).
 *
 * Roten är att koden aldrig slogs upp. Den matchades som fri text och LLM:en
 * fick tolka den. Här slås den upp i stället, och när den inte går att slå upp
 * säger vi det rakt ut i stället för att låta modellen fylla i.
 *
 * GENERISKT, INTE DSBC-SPECIFIKT. Det som avgör vilket tal i en kod som är
 * borrning är familjens egen lista över tillåtna borrningar -- data vi redan
 * har i configurator_param_values. `CQ2B32-100`, `P1D-S050MS-0200` och
 * `DSBC-50-100` har helt olika grammatik, men i alla tre är borrningen det
 * första talet som finns i familjens lista.
 */

/** En familj, så mycket som krävs för att läsa en kod. */
export interface FamilyBrief {
  slug: string;
  name: string;
  bores: number[];
  strokeMin: number | null;
  strokeMax: number | null;
}

export interface ResolvedCode {
  /** Koden som kunden skrev, oförändrad. */
  raw: string;
  familySlug: string;
  familyName: string;
  boreMm: number | null;
  strokeMm: number | null;
}

/**
 * Tokens som ser ut som orderkoder: minst två versaler följt av siffror eller
 * bindestreck. Fångar DSBC-50-100-PPSA-N3, P1D-S050MS-0200, CQ2B32-100,
 * MW-C15552-32 och 50N-032-500.
 *
 * Avsiktligt generöst -- ett falskt positivt kostar bara en uppslagning som
 * inte träffar, medan ett missat är ett fel som når kunden.
 */
const CODE_TOKEN = /\b[A-Z][A-Z0-9]{1,}(?:[-/][A-Z0-9.,]+){1,}\b/gi;

export function findOrderCodeTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of (text ?? "").matchAll(CODE_TOKEN)) {
    const t = m[0];
    // Rena mått och tryckangivelser är inte orderkoder.
    if (/^\d/.test(t)) continue;
    if (!/\d/.test(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** Alla heltal i koden, i den ordning de står. */
function numbersIn(code: string): number[] {
  return [...code.matchAll(/\d+/g)]
    .map((m) => Number(m[0]))
    .filter((n) => Number.isFinite(n));
}

/**
 * Klipper bort familjenamnet när koden inleds med det, och returnerar
 * resten -- eller null om koden inte hör till familjen.
 *
 * Riktiga orderkoder inleds alltid med serien: DSBC-50-100, CQ2B32-100,
 * P1D-S050MS-0200. Kravet på PREFIX, inte bara förekomst, är det som hindrar
 * att "SR" matchar inuti "DSBC-...-YSR".
 *
 * Separatorer inne i namnet ignoreras (MS-LFR skrivet "MSLFR-..."), men
 * separatorerna i RESTEN behålls: utan dem blir "DSBC-50-100" till talet
 * 50100 i stället för 50 och 100.
 */
function stripFamilyPrefix(code: string, fam: FamilyBrief): string | null {
  const name = fam.name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (name.length < 2) return null;

  const upper = code.toUpperCase();
  let ni = 0;
  for (let i = 0; i < upper.length; i++) {
    const c = upper[i];
    if (!/[A-Z0-9]/.test(c)) continue;     // separator i koden: hoppa över
    if (c !== name[ni]) return null;        // avviker -> inte den här familjen
    if (++ni === name.length) return upper.slice(i + 1);
  }
  return null;
}

/**
 * Slår upp en kod mot katalogens familjer.
 *
 * Borrningen är det FÖRSTA talet efter familjenamnet, och det måste finnas i
 * familjens lista. Att i stället leta upp det första tal som "råkar passa"
 * vore att tolka om kunden: P1F-50-200 skulle då läsas som Ø200, fast P1F inte
 * finns i Ø50 alls. Bättre att inte känna igen koden och säga det.
 *
 * Slaglängden är nästa tal efter borrningen, om det ryms i slagintervallet.
 *
 * Returnerar null när koden inte går att placera -- anroparen ska då säga att
 * den inte känns igen, inte gissa.
 */
export function resolveOrderCode(
  code: string,
  families: FamilyBrief[],
): ResolvedCode | null {
  // Längsta namnet först, så "CQ2" vinner över ett hypotetiskt "CQ".
  const sorted = [...families].sort((a, b) => b.name.length - a.name.length);

  for (const fam of sorted) {
    if (fam.bores.length === 0) continue;
    const tail = stripFamilyPrefix(code, fam);
    if (tail === null) continue;

    const nums = numbersIn(tail);
    if (nums.length === 0) continue;

    const boreMm = nums[0];
    if (!fam.bores.includes(boreMm)) continue;

    const lo = fam.strokeMin ?? 1;
    const hi = fam.strokeMax ?? 100000;
    const strokeMm = nums.slice(1).find((n) => n >= lo && n <= hi) ?? null;

    return { raw: code, familySlug: fam.slug, familyName: fam.name, boreMm, strokeMm };
  }
  return null;
}

export interface OrderCodeReading {
  /** Koder som gick att slå upp. */
  resolved: ResolvedCode[];
  /** Kodliknande tokens som INTE gick att slå upp. */
  unknown: string[];
}

export function readOrderCodes(text: string, families: FamilyBrief[]): OrderCodeReading {
  const resolved: ResolvedCode[] = [];
  const unknown: string[] = [];
  for (const token of findOrderCodeTokens(text)) {
    const hit = resolveOrderCode(token, families);
    if (hit) resolved.push(hit);
    else unknown.push(token);
  }
  return { resolved, unknown };
}

/**
 * Instruktionen som läggs in i LLM-promptet.
 *
 * Två jobb: låsa de uppslagna måtten så att en exakt storlek inte läses som
 * ett tak, och förbjuda modellen att hitta på betydelser för koder vi inte
 * kunde slå upp. Båda felen har hänt i produktion.
 */
export function orderCodeInstruction(reading: OrderCodeReading, locale: string): string {
  if (reading.resolved.length === 0 && reading.unknown.length === 0) return "";
  const sv = locale === "sv";
  const lines: string[] = [];

  for (const r of reading.resolved) {
    const delar = [
      `${r.raw} = ${r.familyName}`,
      r.boreMm !== null ? (sv ? `borrning EXAKT Ø${r.boreMm} mm` : `bore EXACTLY Ø${r.boreMm} mm`) : "",
      r.strokeMm !== null ? (sv ? `slaglängd EXAKT ${r.strokeMm} mm` : `stroke EXACTLY ${r.strokeMm} mm`) : "",
    ].filter(Boolean);
    lines.push(`- ${delar.join(", ")}`);
  }

  const out: string[] = [];
  if (lines.length > 0) {
    out.push(
      sv
        ? `ORDERKODER I FÖRFRÅGAN — dessa är UPPSLAGNA i katalogen och är exakta mått, inte maxvärden. Föreslå ALDRIG en mindre borrning som "räcker":\n${lines.join("\n")}`
        : `ORDER CODES IN THE REQUEST — these are RESOLVED from the catalogue and are exact dimensions, not maximums. NEVER suggest a smaller bore as "sufficient":\n${lines.join("\n")}`,
    );
  }
  if (reading.unknown.length > 0) {
    out.push(
      sv
        ? `OKÄNDA BETECKNINGAR: ${reading.unknown.join(", ")}. Vi kunde inte slå upp dem. Skriv att beteckningen inte känns igen och be om förtydligande. Hitta ALDRIG på vad en bokstavskod betyder — gissa aldrig kapslingsklass, tryckklass eller certifiering ur en kod.`
        : `UNRECOGNISED DESIGNATIONS: ${reading.unknown.join(", ")}. We could not resolve them. State that the designation is not recognised and ask for clarification. NEVER invent what a letter code means — never guess IP rating, pressure class or certification from a code.`,
    );
  }
  return out.join("\n\n");
}

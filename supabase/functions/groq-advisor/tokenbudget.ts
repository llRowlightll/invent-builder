/**
 * Groqs minutstak gäller HELA begäran: prompten plus max_tokens. På kontots
 * nivå är taket 8 000 tokens per minut per modell (openai/gpt-oss-120b och
 * -20b), och en begäran över taket avvisas med 413 "Request too large".
 *
 * 2026-11-17: alternativsteget begärde 8 084–10 251 tokens (fem fulla
 * dokumentutdrag utan tak plus 2 200 för svaret) och föll för större maskiner;
 * kunden fick reservalternativen utan motivering. Dokumentutdragen är det enda
 * som går att korta utan att tappa kravet eller produkterna.
 *
 * Uppskattningen här är bara första gallringen. Groq räknar samma begäran
 * olika från gång till gång (8 115, 8 866, 8 096 för identiska anrop) och
 * tabelltunga utdrag blir fler tokens än tecknen antyder, så anroparen skickar
 * också med en version utan dokument som används om Groq ändå säger att
 * begäran är för stor (callGroq i index.ts).
 *
 * Ingen nätverks-, Deno.env- eller Supabase-åtkomst här, som i de andra
 * hjälpmodulerna; taket läses i index.ts och skickas in.
 */
export const STANDARD_TPM_TAK = 8000;

/**
 * Marginal för Groqs varierande räkning (upp till ~1 100 tokens mellan
 * identiska anrop) och meddelandeformatet. Hellre ett utdrag för lite i förväg
 * än att alla försvinner i omförsöket utan dokument.
 */
const MARGINAL = 1000;

export const UTDRAGSSKILJE = "\n\n---\n\n";

/**
 * Taket ur GROQ_TPM_TAK: "250000", "250 000", "250_000", "250.000",
 * "1,000,000" och "250k" godtas. null när värdet inte går att läsa (anroparen
 * använder då standardtaket och loggar det); tomt eller saknat ger standard.
 */
export function lasTpmTak(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return STANDARD_TPM_TAK;
  let t = raw.trim().toLowerCase().replace(/[\s_]/g, "");
  // Tusentalsavgränsare: punkt eller komma följt av exakt tre siffror.
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, "");
  const m = t.match(/^(\d+)(k)?$/);
  if (!m) return null;
  const v = Number(m[1]) * (m[2] ? 1000 : 1);
  return Number.isFinite(v) && v >= 1000 ? v : null;
}

/**
 * Försiktig uppskattning, 2,5 tecken per token: måttabeller med siffror och
 * enheter blir fler tokens än tecknen antyder (se kommentaren överst).
 */
export function uppskattaTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}

/**
 * De dokumentutdrag som ryms, hela och i ordning (bäst träff först), när
 * resten av begäran (`ovrigt`) och svarsbudgeten (`maxTokens`) redan tar sin
 * del av taket. Ett utdrag som inte ryms hoppas över, så att ett mindre längre
 * ned ändå kan följa med. Ryms inget blir det tomt.
 */
export function dokumentInomBudget(dokument: string, ovrigt: string, maxTokens: number, tak: number): string {
  if (!dokument) return "";
  let kvar = tak - maxTokens - MARGINAL - uppskattaTokens(ovrigt);
  const valda: string[] = [];
  for (const utdrag of dokument.split(UTDRAGSSKILJE)) {
    const t = uppskattaTokens(utdrag) + 3;
    if (t > kvar) continue;
    valda.push(utdrag);
    kvar -= t;
  }
  return valda.join(UTDRAGSSKILJE);
}

/**
 * Säger Groqs fel att begäran är större än taket? Bara 413 "Request too large"
 * räknas: ett 429 är ett vanligt minutstak och behåller sin väntan och sin
 * reservmodell (ett 429 med samma innebörd har aldrig setts i loggarna).
 */
export function forStorBegaran(status: number): boolean {
  return status === 413;
}

/**
 * Kravbilden: kraven i en beskrivning som FÖREMÅL + EGENSKAP + VÄRDE, med
 * enhet, ursprung och bekräftelse.
 *
 * Varför: motorns detektorer (signals.ts) svarar på "vilken komponent ska
 * väljas" och läser därför ut ett tal per storhet -- den första hastigheten,
 * den första vikten. Det räcker inte för en maskin med flera föremål.
 * Lådsorteringstestet (2026-10-13) visade felet: "Bandet går med 0,25 m/s"
 * blev utskjutarens hastighet, "0,5–3 kg" blev 3 kg, och "skjutas av i sidled
 * 350 mm" blev en slaglängd som ingen sagt.
 *
 * Här knyts varje värde till föremålet det står närmast i meningen
 * (transportbandet, utskjutaren, produkten, matningen ...). Står det inte vid
 * något föremål blir det en OSÄKER TOLKNING som användaren avgör -- inget
 * värde fördelas tyst på alla aktuatorer. Intervall bevaras som intervall;
 * ett dimensionerande värde (intervallets max) är ett eget, härlett krav med
 * sitt lastfall, och ersätter aldrig originalet.
 *
 * Ren logik utan nätverk och utan språkmodell, så att webbläsaren, motorn och
 * PLC-delen läser samma beskrivning på samma sätt. Provas i kravbild.test.ts.
 */

export type ObjektTyp =
  | "maskin" | "produkt" | "transportband" | "aktuator" | "kontrollstation"
  | "mottagning" | "styrsystem" | "matning";

export interface KravObjekt {
  id: string;
  typ: ObjektTyp;
}

/** Varifrån uppgiften kommer. Bekräftelsen är en egen sak (se Bekraftelse). */
export type Ursprung = "anvandare" | "dokument" | "katalog" | "berakning" | "ai" | "antagande";

/**
 * Om en människa har godtagit uppgiften. En tolkning av en fritext är
 * systemets, inte användarens, så den börjar som ej bekräftad även när
 * ursprunget är användarens egen text.
 */
export type Bekraftelse = "ej_bekraftat" | "bekraftat" | "avvisat" | "inaktuellt";

export interface Krav {
  /** Stabilt id: "krav-<objekt>-<egenskap>". Ändras inte när värdet ändras. */
  id: string;
  objektId: string;
  egenskap: Egenskap;
  /** Ett tal ... */
  varde?: number;
  /** ... eller ett intervall (bevaras alltid som intervall) ... */
  intervall?: { min: number; max: number };
  /** ... eller en text, när kravet inte är ett tal. */
  text?: string;
  enhet?: string;
  /** "max", "minst", "upp till": hur talet ska läsas. */
  grans?: "max" | "minst" | "exakt";
  kravtyp: "obligatoriskt" | "onskemal";
  ursprung: Ursprung;
  kalla: { typ: "beskrivning" | "svar" | "harlett"; utdrag: string; svarId?: string };
  bekraftelse: Bekraftelse;
  /** För härledda krav: hur värdet togs fram (lastfallet). */
  metod?: string;
}

export type Egenskap =
  | "hastighet" | "massa" | "dimensionerande_massa" | "matt" | "flode" | "slaglangd"
  | "sidoforflyttning" | "kraft" | "tryck" | "spanning" | "befintlig" | "io" | "modell"
  | "drifttid" | "miljo" | "hantering" | "avstand" | "signal" | "takt" | "cykeltid"
  | "noggrannhet" | "temperatur" | "minsta_avstand" | "vid_utskjutning" | "utsorteringar_i_foljd"
  | "rorlig_massa" | "riktning" | "sakerhet" | "svar";

/** En tolkning systemet inte kan avgöra själv. Avgörs av användaren. */
export interface OsakerTolkning {
  id: string;
  /** Kravet tolkningen gäller. */
  kravId: string;
  fraga: { sv: string; en: string };
  alternativ: Array<{ id: string; sv: string; en: string }>;
  /** Alternativet som gäller tills användaren valt. */
  forval: string;
}

export interface SaknadUppgift {
  id: string;
  objektId: string;
  egenskap: string;
  sv: string;
  en: string;
  varfor: { sv: string; en: string };
}

export type Tillampning = "sortering_utskjutning" | "allman";

export interface Kravbild {
  tillampning: Tillampning;
  objekt: KravObjekt[];
  krav: Krav[];
  osakra: OsakerTolkning[];
  saknas: SaknadUppgift[];
}

/**
 * Användarens beslut, nycklade på tolkningens eller kravets id:
 *   "tolkning-<krav-id>": valt alternativ i en osäker tolkning
 *   "<krav-id>": "bekraftat" | "avvisat"
 *   "alla": "bekraftat" när hela tolkningen godtagits
 * Bärs i maskinbyggarens svar med prefixet "tolkning:" (se delaSvar).
 */
export type Tolkningsbeslut = Record<string, string>;

export const TOLKNINGSPREFIX = "tolkning:";

/**
 * Skiljer tolkningsbesluten från de vanliga svaren. Motorns detektorer läser
 * svaren som text; ett beslut som "transportband" får aldrig nå dem som om
 * kunden skrivit ordet.
 */
export function delaSvar(alla: Record<string, string>): { svar: Record<string, string>; tolkning: Tolkningsbeslut } {
  const svar: Record<string, string> = {};
  const tolkning: Tolkningsbeslut = {};
  for (const [k, v] of Object.entries(alla ?? {})) {
    if (k.startsWith(TOLKNINGSPREFIX)) tolkning[k.slice(TOLKNINGSPREFIX.length)] = String(v);
    else svar[k] = v;
  }
  return { svar, tolkning };
}

// ── Ordförråd ────────────────────────────────────────────────────────────────
// Ett värde knyts till föremålet vars ord står NÄRMAST före det i meningen.
// "knuffar kartonger på transportband, stroke 200 mm, 400 mm/s": närmast före
// 400 mm/s står "stroke", alltså aktuatorn -- inte transportbandet, trots att
// ordet finns i samma mening (regressionstest T1 i test-advisor.sh).
const FORMAL: Array<{ typ: ObjektTyp; re: RegExp }> = [
  { typ: "transportband", re: /\b(?:transportband\w*|transportör\w*|band(?:et|en|ets)?|conveyor\w*|förderband\w*|cinta\w*)\b/gi },
  { typ: "mottagning", re: /\b(?:rullbord\w*|rullban\w*|mottag\w*|ränna\w*|roller\s+table\w*)\b/gi },
  { typ: "kontrollstation", re: /\b(?:kontrollstation\w*|kamera\w*|vision\w*|inspektion\w*|inspection\w*)\b/gi },
  { typ: "aktuator", re: /\b(?:utskjut\w*|cylinder\w*|aktuator\w*|actuator\w*|axel\w*|axis|slid\w*|kolv\w*|stroke\w*|slag(?:et|längd\w*|hastighet\w*)?|rörelse\w*|förflyttning\w*|skjut\w*|knuff\w*|lyft\w*|pusher\w*|gripdon\w*|griparm\w*)\b/gi },
  { typ: "produkt", re: /\b(?:låd\w*|kartong\w*|produkt\w*|detalj\w*|paket\w*|kolli\w*|box(?:ar|arna|es)?|artikl\w*|products?|parts?|crates?)\b/gi },
];

const SAKKAR_ORD = /\bsortera\s+ut\b|\butsorter\w*|\bskjut\w*\s+av\b|\butskjut\w*|\bpush(?:er|es|ing)?\s+off\b|\breject\w*/i;

function tal(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", "."));
}

function formatTal(n: number): string {
  return String(Math.round(n * 1000) / 1000).replace(".", ",");
}

interface Mening { text: string; start: number }

function meningar(text: string): Mening[] {
  const ut: Mening[] = [];
  const re = /[^.!?;\n]+(?:[.!?;\n]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    // Ett decimaltal ("0.25") delar inte meningen.
    ut.push({ text: m[0], start: m.index });
  }
  // Slå ihop delar som bara skildes av en decimalpunkt.
  const ihop: Mening[] = [];
  for (const del of ut) {
    const forra = ihop[ihop.length - 1];
    if (forra && /\d\.$/.test(forra.text) && /^\d/.test(del.text)) {
      forra.text += del.text;
    } else ihop.push({ ...del });
  }
  return ihop;
}

/** Föremålet vars ord står närmast före position `pos` i meningen, annars närmast efter. */
function narmasteFormal(mening: string, pos: number): ObjektTyp | null {
  let basta: { typ: ObjektTyp; slut: number } | null = null;
  for (const f of FORMAL) {
    f.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = f.re.exec(mening))) {
      const slut = m.index + m[0].length;
      if (slut <= pos && (!basta || slut > basta.slut)) basta = { typ: f.typ, slut };
    }
  }
  if (basta) return basta.typ;
  // Inget föremål före talet: "0,25 m/s på bandet".
  let efter: { typ: ObjektTyp; start: number } | null = null;
  for (const f of FORMAL) {
    f.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = f.re.exec(mening))) {
      if (m.index >= pos && m.index - pos <= 25 && (!efter || m.index < efter.start)) efter = { typ: f.typ, start: m.index };
    }
  }
  return efter?.typ ?? null;
}

/** Föremålet en hastighet i texten står närmast, eller null om texten inte säger det. */
export function hastighetensFormal(text: string, index: number): ObjektTyp | null {
  for (const m of meningar(text)) {
    if (index >= m.start && index < m.start + m.text.length) return narmasteFormal(m.text, index - m.start);
  }
  return null;
}

function namner(typ: ObjektTyp, s: string): boolean {
  const f = FORMAL.find((x) => x.typ === typ)!;
  f.re.lastIndex = 0;
  const finns = f.re.test(s);
  f.re.lastIndex = 0;
  return finns;
}

/**
 * Den del en hastighet tillskrivs tills användaren beslutat. Ett produktord
 * närmast före talet säger inte vad som rör sig: "Lådorna kommer i 0,3 m/s på
 * bandet" är bandets, "Skjuta paket 5 kg 300 mm med 0,8 m/s" är aktuatorns.
 * Resten av meningen avgör då -- ett bandord ger bandet, ett rörelseord eller
 * en text helt utan band ger aktuatorn.
 */
function forvaltObjekt(mening: string, pos: number, helaTexten: string): ObjektTyp {
  const formal = narmasteFormal(mening, pos);
  if (formal === "transportband" || formal === "mottagning") return formal;
  if (formal !== "produkt") return "aktuator";
  if (namner("transportband", mening)) return "transportband";
  if (namner("aktuator", mening) || !namner("transportband", helaTexten)) return "aktuator";
  return "transportband";
}

/** Delen en hastighet i texten gäller utan användarens beslut. Samma i
 *  kravbilden och i motorns extractSpeedMs. */
export function hastighetensObjekt(text: string, index: number): ObjektTyp {
  for (const m of meningar(text)) {
    if (index >= m.start && index < m.start + m.text.length) return forvaltObjekt(m.text, index - m.start, text);
  }
  return "aktuator";
}

/** Kravets id för en hastighet. Samma i kravbilden och i motorns extractSpeedMs,
 *  så att ett tolkningsbeslut om "0,8 m/s" gäller båda. */
export function hastighetsKravId(varde: number): string {
  return `krav-hastighet-${formatTal(Math.round(varde * 1000) / 1000).replace(",", "_")}`;
}

// ── Massa ───────────────────────────────────────────────────────────────────
/** Enheterna en massa skrivs med. Inte "kgf" (en kraft) och inte "g" ensamt
 *  ("G1/4" är en gänga, "5 g" kan vara en acceleration). */
export const MASSENHET = String.raw`(?:kg(?!f)|kilo(?:gram)?s?|ton(?:nes?)?|gram)`;

/** Det som står efter "kg/" när det är en massa per styck. */
const PER_STYCK = String.raw`(?:st\b|styck\w*|flask\w*|låd\w*|detalj\w*|produkt\w*|paket\w*|kartong\w*|pc\b|pcs\b|piece\w*|each\b|bottle\w*|box\w*|part\b)`;

const TALORD: Record<string, string> = {
  ett: "1", en: "1", one: "1", a: "1", två: "2", two: "2", tre: "3", three: "3", fyra: "4", four: "4",
  fem: "5", five: "5", sex: "6", six: "6", sju: "7", seven: "7", åtta: "8", eight: "8", nio: "9", nine: "9", tio: "10", ten: "10",
};

/**
 * Skriver om massor som tolkningen annars missar till siffror och kg:
 * "ett kilo" -> "1 kg", "en halv kilo" -> "0,5 kg", och gram nära "väger"
 * ("flaskorna väger 800g" -> "0,8 kg"). Ensamt "g" läses annars inte:
 * "G1/4" är en gänga och "5 g" kan vara en acceleration. Massorna läses och
 * indexeras i den omskrivna texten; utdragen är hela meningen, så att
 * längden kan ändras gör ingenting.
 */
export function normalMassa(s: string): string {
  const behall = (ny: string, gammal: string) => ny.padEnd(gammal.length, " ").slice(0, Math.max(ny.length, gammal.length));
  return s
    .replace(/\b(?:en\s+halv|ett\s+halvt|half\s+a)\s+(kilo\w*|kg)\b/gi, (hel) => behall("0,5 kg", hel))
    .replace(/(?<![\wåäö])(ett|en|one|a|två|two|tre|three|fyra|four|fem|five|sex|six|sju|seven|åtta|eight|nio|nine|tio|ten)\s+(kilo\w*|kg)\b/gi, (hel, ord: string) => behall(`${TALORD[ord.toLowerCase()]} kg`, hel))
    .replace(/((?:väger|vikt|vikten|weighs?|weight|massa)\D{0,15}?)(\d+(?:[.,]\d+)?)\s*g\b(?![\d\/])/gi, (hel, fore: string, n: string) => behall(`${fore}${String(Math.round(Number(n.replace(",", ".")) ) / 1000).replace(".", ",")} kg`, hel));
}

/** Faktor till kg för en massenhet. */
export function massfaktor(enhet: string): number {
  const e = enhet.toLowerCase();
  return e.startsWith("ton") ? 1000 : e === "gram" ? 0.001 : 1;
}

// ── Längder ─────────────────────────────────────────────────────────────────
// Varje längd i texten får EN läsning, och motorn (extractMinStroke) och
// tolkningspanelen använder samma. Före 2026-11-12 tog motorn det största
// mm-talet i hela texten som slaglängd, medan panelen bara visade tal med
// ordet "slag" intill: "lyfta 40 kg vertikalt 400 mm" räknades med 400 mm men
// syntes inte där ingenjören kontrollerar tolkningen, och "avstånd 150 mm"
// eller "lådor 400 mm långa" blev en slaglängd som ingen sagt.

export type LangdTyp = "slag" | "lyft" | "sidled" | "matt" | "avstand" | "noggrannhet" | "okand";

export interface Langd {
  mm: number;
  typ: LangdTyp;
  /** Enheten som den stod: "mm", "cm" eller "m". */
  enhet: "mm" | "cm" | "m";
  /** "minsta avstånd 150 mm" */
  minst?: boolean;
  /** Position i texten som skickades in. */
  index: number;
}

const LANGD_RE = /(\d+(?:[.,]\d+)?)\s*(mm|cm|meter|metre|meters|m)\b(?!\s*(?:\/|per\b|²|³))/gi;
// Småord mellan ordet och talet: "slaglängden är ca 200 mm", "stroke of 200 mm".
const FYLL = String.raw`(?:\s*(?:är|blir|på|om|av|med|of|is|by|ca\.?|cirka|ungefär|about|approx\.?|max\.?|minst|högst|upp till|up to|=|:))*\s*\W*$`;
const SLAG_FORE = new RegExp(String.raw`(?:slaglängd\w*|\bslag(?:et)?|\bstroke|\bhub|lyfthöjd\w*|lyftslag\w*|\blift height|\btravel|vandring\w*|rörelselängd\w*|\brörelse(?:n|ns)?|\bsträcka\w*)${FYLL}`, "i");
const SLAG_EFTER = /^\s*(?:slag\w*|stroke)/i;
// Naket slagtal: "slag 200", "slaglängd: 150", "stroke 80" -- men inte "slag
// 200 mm" (läses ovan), "slag 30/min" (en takt) eller "slag 2 bar".
const SLAG_NAKET_RE = /(?:slaglängd\w*|\bslag(?:et)?|\bstroke|\bhub)\s*(?:är|på|of|is|=|:)?\s*(?:ca\.?\s*|cirka\s*|ungefär\s*)?(\d+(?:[.,]\d+)?)(?![\d.,]|\s*(?:mm|cm|m\b|meter|metre|bar|kg|g\b|n\b|nm|%|°|st\b|x|×|\*|\/|per\b|i\s+minut|slag|cykl))/gi;
// "Ø50×200", "ø32x100 mm", "Ø40/150": borrning × slag.
const BORR_GANGER_SLAG_RE = /[Øø]\s*(\d{1,3})\s*[×xX*\/]\s*(\d{1,4})(?!\s*[×xX*]\s*\d)(?![\d.,])/g;
// En borrning är cylinderns mått, varken produktens eller ett slag.
const BORRNING_FORE = /(?:[Øø]|\bborrning\w*|\bbore|kolvdiameter\w*|\bD\s*=)\s*\W{0,2}$/i;
const MATT_FORE = new RegExp(String.raw`(?:längd|bredd|höjd|diameter|djup|tjocklek|length|width|height|depth|thickness)\w*${FYLL}`, "i");
const MATT_EFTER = /^\s*(?:lång|bred|hög|djup|tjock|long\b|wide\b|high\b|tall\b|deep\b|thick\b|i diameter|in diameter)/i;
const AVSTAND_FORE = /(?:avstånd\w*|mellanrum\w*|delning\w*|\bpitch|\bgaps?\b|\bspacing|\bc\/c|cc-avstånd\w*)[^.\d]{0,15}$/i;
const AVSTAND_EFTER = /^\s*(?:avstånd\w*|mellanrum\w*|isär|apart\b|mellan\b)/i;
const LODRAT_ORD = /(?<![\wåäö])(?:lyft\w*|höj(?!d)\w*|sänk\w*|hissa\w*|vertikal\w*|lodrät\w*|uppåt|nedåt|upp|ned|ner|z-?ax\w*|vertical\w*|lift\w*|raise\w*|lower\w*|up|down)(?![\wåäö])/gi;
const SIDLED_ORD = /(?<![\wåäö])(?:sidled\w*|sidoförflytt\w*|förflytt\w*|flytta\w*|skjut\w*|flytt\w*|framåt|bakåt|längs|sideways|sidewards|laterally|horisontell\w*|horizontal\w*)(?![\wåäö])/gi;
const METERORD = /(?:slag\w*|lyfthöjd|lyft\w*|höj\w*|sänk\w*|flytt\w*|förflytt\w*|skjut\w*|rörelse\w*|vandring|travel|stroke|sträcka|sidled\w*|längs|uppåt|nedåt|upp|ned|ner|vertikal\w*|lodrät\w*)/i;

/** Närmaste rörelseord i satsen: lodrätt eller i sidled. */
function narmasteRorelse(fore: string, efter: string): "lyft" | "sidled" | null {
  const traffar: Array<{ typ: "lyft" | "sidled"; avstand: number }> = [];
  const prova = (re: RegExp, typ: "lyft" | "sidled") => {
    for (const m of fore.matchAll(re)) traffar.push({ typ, avstand: fore.length - ((m.index ?? 0) + m[0].length) });
    for (const m of efter.matchAll(re)) traffar.push({ typ, avstand: (m.index ?? 0) + 1 });
  };
  prova(LODRAT_ORD, "lyft");
  prova(SIDLED_ORD, "sidled");
  traffar.sort((a, b) => a.avstand - b.avstand);
  return traffar[0]?.typ ?? null;
}

/** Längderna i en text, var och en med sin läsning. */
export function langderITexten(text: string): Langd[] {
  const ut: Langd[] = [];
  for (const m of (text ?? "").matchAll(LANGD_RE)) {
    const i = m.index ?? 0;
    const enhetRa = m[2].toLowerCase();
    const enhet: Langd["enhet"] = enhetRa === "mm" ? "mm" : enhetRa === "cm" ? "cm" : "m";
    const n = tal(m[1]);
    if (!Number.isFinite(n)) continue;
    const mm = Math.round((enhet === "mm" ? n : enhet === "cm" ? n * 10 : n * 1000) * 1000) / 1000;
    const foreHel = text.slice(Math.max(0, i - 40), i);
    const efterHel = text.slice(i + m[0].length, i + m[0].length + 20);
    if (/[×xX*]\s*$/.test(foreHel) || /^\s*[×xX*]\s*\d/.test(efterHel)) continue; // del av "300 × 200 mm"
    // Satsen talet står i: "lyfta 400 mm upp, sedan skjuta 300 mm i sidled".
    const fore = foreHel.split(/[,;:.](?!\d)/).pop() ?? "";
    const efter = efterHel.split(/[,;:.](?!\d)/)[0] ?? "";
    // En meter är en längd bara intill ett rörelseord: "10 m slang" och
    // "ett 3 m långt band" är inga slag.
    if (enhet === "m" && !METERORD.test(fore + " " + efter)) continue;
    if (BORRNING_FORE.test(fore)) continue;
    let typ: LangdTyp;
    if (/[±]\s*$/.test(fore) || /(?:noggrannhet|repeterbarhet|tolerans|precision|accuracy)\W*$/i.test(fore)) typ = "noggrannhet";
    else if (SLAG_FORE.test(fore) || SLAG_EFTER.test(efter)) typ = "slag";
    else if (MATT_FORE.test(fore) || MATT_EFTER.test(efter)) typ = "matt";
    else if (AVSTAND_FORE.test(fore) || AVSTAND_EFTER.test(efter)) typ = "avstand";
    else typ = narmasteRorelse(fore, efter) ?? "okand";
    const minst = typ === "avstand" && /\b(?:minst|minsta|min\.?|at least|minimum)\b/i.test(fore);
    ut.push({ mm, typ, enhet, index: i, ...(minst ? { minst } : {}) });
  }
  // Kundgranskningen 2026-11-13: "Ø50 slag 200" och "DSBC Ø50×200" lästes
  // inte -- slaget kräver en enhet ovan. I pneumatik är ett naket slagtal mm,
  // och Ø<borrning>×<slag> är branschens skrivsätt.
  for (const m of (text ?? "").matchAll(SLAG_NAKET_RE)) {
    const n = tal(m[1]);
    if (Number.isFinite(n) && n > 0) ut.push({ mm: n, typ: "slag", enhet: "mm", index: (m.index ?? 0) + m[0].indexOf(m[1]) });
  }
  for (const m of (text ?? "").matchAll(BORR_GANGER_SLAG_RE)) {
    const n = tal(m[2]);
    if (Number.isFinite(n) && n > 0) ut.push({ mm: n, typ: "slag", enhet: "mm", index: (m.index ?? 0) + m[0].lastIndexOf(m[2]) });
  }
  return ut.sort((a, b) => a.index - b.index);
}

/** Kravets id för en längd som systemet inte vet är en slaglängd. Samma i
 *  kravbilden och i motorns extractMinStroke. */
export function slagKravId(mm: number): string {
  return `krav-slag-${formatTal(mm).replace(",", "_")}`;
}

/** Användaren har sagt att längden inte är en slaglängd. */
export function slagAvvisat(tolkning: Tolkningsbeslut, mm: number): boolean {
  const id = slagKravId(mm);
  return tolkning[`tolkning-${id}`] === "inte_slag" || tolkning[id] === "avvisat";
}

/** Personal under lasten: den största risken i ett lyft. */
const PERSONAL_UNDER = /(?<![\wåäö])(?:personal\w*|operatör\w*|människor|personer|folk|någon|arbetare|people|personnel|operators?|workers?|persons?|someone)(?![\wåäö])[^.;]{0,40}?(?<![\wåäö])(?:under|beneath|below|nedanför|underneath)\s+(?:den\s+)?(?:lasten|lyftet|lådan|lådorna|last\w*|the\s+load|the\s+lift|it)(?![\wåäö])|(?<![\wåäö])(?:under|beneath|below)\s+(?:lasten|the\s+load)(?![\wåäö])[^.;]{0,30}?(?:personal|people|personnel|operatör\w*|operators?)/i;

export function personalUnderLasten(text: string): boolean {
  return PERSONAL_UNDER.test(text ?? "");
}

// ── Tolkningen ──────────────────────────────────────────────────────────────

const OBJEKT_ORDNING: ObjektTyp[] = ["maskin", "produkt", "transportband", "aktuator", "kontrollstation", "mottagning", "styrsystem", "matning"];

export function tolkaKravbild(beskrivning: string, svarIn: Record<string, string> = {}, beslut: Tolkningsbeslut = {}): Kravbild {
  const text = (beskrivning ?? "").trim();
  const svar = svarIn ?? {};
  const krav: Krav[] = [];
  const osakra: OsakerTolkning[] = [];
  const objektSomFinns = new Set<ObjektTyp>(["maskin"]);
  const bekraftatAllt = beslut["alla"] === "bekraftat";

  const lagg = (k: Omit<Krav, "id" | "bekraftelse" | "kravtyp"> & { kravtyp?: Krav["kravtyp"]; id?: string }) => {
    const objektTyp = k.objektId as ObjektTyp;
    objektSomFinns.add(objektTyp);
    let id = k.id ?? `krav-${k.objektId}-${k.egenskap}`;
    let n = 2;
    while (krav.some((x) => x.id === id)) id = `${k.id ?? `krav-${k.objektId}-${k.egenskap}`}-${n++}`;
    const egetBeslut = beslut[id];
    const bekraftelse: Bekraftelse = egetBeslut === "avvisat" ? "avvisat"
      : egetBeslut === "bekraftat" || bekraftatAllt ? "bekraftat"
      : k.ursprung === "berakning" ? "ej_bekraftat"
      : "ej_bekraftat";
    krav.push({ kravtyp: "obligatoriskt", ...k, id, bekraftelse });
    return id;
  };

  const tillampning: Tillampning = SAKKAR_ORD.test(text) && FORMAL[0].re.test(text) ? "sortering_utskjutning" : "allman";
  FORMAL[0].re.lastIndex = 0;

  // Har kunden svarat på slagfrågan gäller svaret, inte ett mått utan rörelseord.
  const slagISvaren = Object.entries(svar).some(([id, v]) => /slag|stroke/i.test(id) && /\d/.test(String(v ?? "")));
  // Med ett uttryckligt slag eller lyft räknar motorn bara med det; ett mått
  // utan rörelseord är då inget slag, utan står som ett mått.
  const uttryckligtSlag = langderITexten(text).some((l) => l.typ === "slag" || l.typ === "lyft");

  for (const men of meningar(text)) {
    const s = men.text;
    const utdrag = s.trim().replace(/\s+/g, " ");

    // Hastigheter: m/s, mm/s, m/min.
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(mm\/s|m\/s|m\/min)\b/gi)) {
      const enhet = m[2].toLowerCase();
      const varde = enhet === "mm/s" ? tal(m[1]) / 1000 : enhet === "m/min" ? tal(m[1]) / 60 : tal(m[1]);
      const formal = narmasteFormal(s, m.index ?? 0);
      const forvalt = forvaltObjekt(s, m.index ?? 0, text);
      const kravId = hastighetsKravId(varde);
      const beslutat = beslut[`tolkning-${kravId}`] as ObjektTyp | undefined;
      const objekt: ObjektTyp = beslutat && OBJEKT_ORDNING.includes(beslutat) ? beslutat : forvalt;
      const minst = /\bminst\b|\bat least\b|\bmindestens\b/i.test(s.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0));
      lagg({
        id: kravId, objektId: objekt, egenskap: "hastighet", varde: Math.round(varde * 1000) / 1000, enhet: "m/s",
        grans: minst ? "minst" : undefined,
        ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag },
      });
      // Står hastigheten inte uttryckligen vid ett föremål är tolkningen
      // systemets gissning, och den ska synas som en fråga.
      if ((!formal || formal === "produkt") && !beslutat) {
        osakra.push({
          id: `tolkning-${kravId}`, kravId,
          fraga: {
            sv: `Vilken del avser ${formatTal(varde)} m/s?`,
            en: `Which part does ${String(varde)} m/s refer to?`,
          },
          alternativ: [
            { id: "aktuator", sv: "Aktuatorns rörelse", en: "The actuator's motion" },
            { id: "transportband", sv: "Transportbandet", en: "The conveyor" },
          ],
          forval: forvalt,
        });
      }
    }

    // Massa: intervall bevaras ("0,5–3 kg"), annars ett tal.
    // "kilo", "kilos" och "ton" är samma storhet ("25 kilos lådor", "1,5 ton").
    for (const m of s.matchAll(new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(?:${MASSENHET}\s*)?(?:[–—-]|till|to)\s*(\d+(?:[.,]\d+)?)\s*(${MASSENHET})(?![\wåäö])`, "gi"))) {
      const f = massfaktor(m[3]);
      const min = tal(m[1]) * f;
      const max = tal(m[2]) * f;
      if (!(max > min)) continue;
      const objekt: ObjektTyp = /\b(?:låd|kartong|produkt|detalj|paket|kolli|box|artikl|product|part|crate)/i.test(s) ? "produkt" : "produkt";
      const id = lagg({ objektId: objekt, egenskap: "massa", intervall: { min, max }, enhet: "kg", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
      lagg({
        objektId: objekt, egenskap: "dimensionerande_massa", varde: max, enhet: "kg",
        ursprung: "berakning", kalla: { typ: "harlett", utdrag: id },
        metod: "Största värdet i det angivna intervallet; intervallet står kvar som krav.",
      });
    }
    if (!krav.some((k) => k.egenskap === "massa" && k.kalla.utdrag === utdrag)) {
      // "1 kg/st" och "1 kg/flaska" är en massa per styck; "5 kg/m" är det inte.
      for (const m of normalMassa(s).matchAll(new RegExp(String.raw`(?<![\d.,–—-])(\d+(?:[.,]\d+)?)\s*(${MASSENHET})(?![\wåäö])(?!\s*\/(?!\s*${PER_STYCK}))`, "gi"))) {
        const forre = normalMassa(s).slice(0, m.index ?? 0);
        if (/[–—-]\s*$|\btill\s*$/.test(forre)) continue; // del av ett intervall
        const max = /\b(?:max|högst|upp till|up to)\s*$/i.test(forre.slice(-12));
        lagg({ objektId: "produkt", egenskap: "massa", varde: Math.round(tal(m[1]) * massfaktor(m[2]) * 1000) / 1000, enhet: "kg", grans: max ? "max" : undefined, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
      }
    }

    // Mått: "300 × 200 × 150 mm".
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)(?:\s*[×xX*]\s*(\d+(?:[.,]\d+)?))?\s*mm\b/g)) {
      const delar = [m[1], m[2], m[3]].filter(Boolean).map((d) => formatTal(tal(d!)));
      const max = /\b(?:max|högst|upp till|up to)\b/i.test(s.slice(Math.max(0, (m.index ?? 0) - 14), m.index ?? 0));
      lagg({ objektId: "produkt", egenskap: "matt", text: delar.join(" × "), enhet: "mm", grans: max ? "max" : undefined, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Flöde: "15 lådor per minut". Passerande produkter -- inte utsorteringar.
    // Kundgranskningen 2026-11-13: "30 flaskor/min", "30 st i minuten" och
    // "30 bottles per minute" lästes inte -- bara en kort lista ord fick stå
    // före "/min". Nu vilket ord som helst utom en enhet (mm/min är en fart).
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?!(?:mm|cm|m|km|nl|l|kg|g|bar|n|nm|kw|w|v|rpm|varv)(?![a-zåäö]))([a-zåäö]+\.?)?\s*(?:per|\/|i|a|an|each)\s*(minut(?:en)?|minute|min|timme[n]?|tim|hour|h|sekund(?:en)?|second|s)\b/gi)) {
      const per = /^(?:minut|minuten|minute|min)$/i.test(m[3]) ? "/min" : /^(?:timme|timmen|tim|hour|h)$/i.test(m[3]) ? "/h" : "/s";
      const vad = (m[2] ?? "").toLowerCase();
      const arCykler = /^(?:cykler|cykel|slag|cycles?|strokes?|gånger|times)$/.test(vad);
      // Passerande produkter räknas i styck, en aktuators takt i cykler.
      const enhet = (arCykler ? "cykler" : "st") + per;
      const uppTill = /\b(?:upp till|max|högst|up to)\s*$/i.test(s.slice(0, m.index ?? 0).slice(-12));
      lagg({
        objektId: arCykler ? "aktuator" : "produkt", egenskap: arCykler ? "takt" : "flode",
        varde: tal(m[1]), enhet, grans: uppTill ? "max" : undefined,
        ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag },
      });
    }

    // Längder: slag, lyft, sidoförflyttning, mått, avstånd och noggrannhet
    // läses en gång, av samma funktion som motorn använder (langderITexten).
    for (const l of langderITexten(s)) {
      const v = l.mm;
      const kalla = { typ: "beskrivning" as const, utdrag };
      if (l.typ === "noggrannhet") {
        lagg({ objektId: "aktuator", egenskap: "noggrannhet", varde: v, enhet: "mm", ursprung: "anvandare", kalla });
        continue;
      }
      if (l.typ === "slag") {
        lagg({ objektId: "aktuator", egenskap: "slaglangd", varde: v, enhet: "mm", ursprung: "anvandare", kalla });
        continue;
      }
      if (l.typ === "lyft") {
        lagg({
          objektId: "aktuator", egenskap: "slaglangd", varde: v, enhet: "mm", ursprung: "anvandare", kalla,
          metod: "Lyftets höjd, läst som aktuatorns slaglängd.",
        });
        continue;
      }
      if (l.typ === "matt") {
        lagg({ objektId: "produkt", egenskap: "matt", varde: v, enhet: "mm", ursprung: "anvandare", kalla });
        continue;
      }
      if (l.typ === "avstand") {
        lagg({ objektId: "produkt", egenskap: l.minst ? "minsta_avstand" : "avstand", varde: v, enhet: "mm", ursprung: "anvandare", kalla });
        continue;
      }
      if (l.typ === "okand") {
        // Ett mått utan rörelseord. Motorn räknar det som slaglängd (det
        // gjorde den redan före 2026-11-12) -- nu syns det, och användaren
        // kan säga att det är något annat.
        if (uttryckligtSlag) {
          lagg({ objektId: "produkt", egenskap: "matt", varde: v, enhet: "mm", ursprung: "anvandare", kalla });
          continue;
        }
        if (l.enhet !== "mm" || v < 50 || v > 10000 || slagISvaren) continue;
        const id = slagKravId(v);
        const valt = beslut[`tolkning-${id}`];
        lagg({
          id, objektId: "aktuator", egenskap: "slaglangd", varde: v, enhet: "mm", ursprung: "antagande", kalla,
          metod: "Ett mått utan rörelseord. Räknas som slaglängd tills du avgör annat.",
        });
        const k = krav.find((x) => x.id === id)!;
        if (valt === "inte_slag") k.bekraftelse = "avvisat";
        else if (valt === "slaglangd") k.bekraftelse = "bekraftat";
        else osakra.push({
          id: `tolkning-${id}`, kravId: id,
          fraga: {
            sv: `Är ${formatTal(v)} mm aktuatorns slaglängd?`,
            en: `Is ${String(v)} mm the actuator's stroke?`,
          },
          alternativ: [
            { id: "slaglangd", sv: "Ja, rörelsens längd", en: "Yes, the length of the movement" },
            { id: "inte_slag", sv: "Nej, ett mått eller avstånd", en: "No, a dimension or distance" },
          ],
          forval: "slaglangd",
        });
        continue;
      }
      // Sidled: produktens förflyttning, som aktuatorns slag kan avvika från.
      {
        const kravId = lagg({ objektId: "produkt", egenskap: "sidoforflyttning", varde: v, enhet: "mm", ursprung: "anvandare", kalla });
        if (beslut[`tolkning-${kravId}`] !== "sidoforflyttning" && beslut[`tolkning-${kravId}`] !== "slaglangd") {
          osakra.push({
            id: `tolkning-${kravId}`, kravId,
            fraga: {
              sv: `Är ${formatTal(v)} mm produktens önskade sidoförflyttning eller aktuatorns slaglängd?`,
              en: `Is ${String(v)} mm the product's required sideways travel or the actuator's stroke?`,
            },
            alternativ: [
              { id: "sidoforflyttning", sv: "Produktens förflyttning (aktuatorns slag kan avvika)", en: "The product's travel (the stroke may differ)" },
              { id: "slaglangd", sv: "Aktuatorns slaglängd", en: "The actuator's stroke" },
            ],
            forval: "sidoforflyttning",
          });
        } else if (beslut[`tolkning-${kravId}`] === "slaglangd") {
          // Användaren har sagt att talet är slaglängden.
          const k = krav.find((x) => x.id === kravId)!;
          k.objektId = "aktuator";
          k.egenskap = "slaglangd";
          k.bekraftelse = "bekraftat";
          objektSomFinns.add("aktuator");
        }
      }
    }

    // Kraft som kunden anger.
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(kN|N)\b(?!\s*m)/g)) {
      const n = m[2] === "kN" ? tal(m[1]) * 1000 : tal(m[1]);
      lagg({ objektId: "aktuator", egenskap: "kraft", varde: n, enhet: "N", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Matning: tryckluft och spänning.
    // "6–8 bar" är ett intervall. Det lägsta trycket dimensionerar kraften,
    // så det bärs som värde (motorn läser varde) medan intervallet visas.
    const tryckIntervall: Array<[number, number]> = [];
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:bar\s*)?(?:[–—-]|till|to)\s*(\d+(?:[.,]\d+)?)\s*bar\b/gi)) {
      const min = tal(m[1]);
      const max = tal(m[2]);
      if (!(max > min)) continue;
      tryckIntervall.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
      lagg({
        objektId: "matning", egenskap: "tryck", intervall: { min, max }, varde: min, enhet: "bar",
        ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag },
        metod: "Det lägsta trycket i intervallet dimensionerar kraften.",
      });
    }
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*bar\b/gi)) {
      const i = m.index ?? 0;
      if (tryckIntervall.some(([a, b]) => i >= a && i < b)) continue;
      lagg({ objektId: "matning", egenskap: "tryck", varde: tal(m[1]), enhet: "bar", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*V\s*(DC|AC|likström|växelström)?\b/g)) {
      const typ = m[2] ? (/^(?:DC|likström)$/i.test(m[2]) ? " DC" : " AC") : "";
      lagg({ objektId: "matning", egenskap: "spanning", text: `${formatTal(tal(m[1]))} V${typ}`, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Styrsystem.
    const plc = s.match(/\b(befintlig|existerande|nuvarande|existing|vorhandene?)\s+(plc|styrsystem\w*|controller|steuerung|sps)\b/i);
    if (plc) lagg({ objektId: "styrsystem", egenskap: "befintlig", text: "Befintligt styrsystem", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    if (/\bdigital\w*\s+(?:i\/o|io|in-?\s*och\s*utgångar|ingångar|inputs?)/i.test(s)) {
      lagg({ objektId: "styrsystem", egenskap: "io", text: "Digitala I/O", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }
    const modell = s.match(/\b(S7-\d{3,4}\w*|CompactLogix|ControlLogix|CX\d{4}|NX1P\w*|NJ\d{3}\w*|iQ-[RF]|Logo!?\s*\d*|FX\d\w*)\b/i);
    if (modell) lagg({ objektId: "styrsystem", egenskap: "modell", text: modell[1], ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });

    // Drifttid.
    const drift = s.match(/(\d+(?:[.,]\d+)?)\s*(?:timmar|tim|h)\s*(?:per|\/|om|a)\s*(?:dag|dygn|day)\b/i);
    if (drift) lagg({ objektId: "maskin", egenskap: "drifttid", varde: tal(drift[1]), enhet: "h/dag", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    if (/\b24\s*\/\s*7\b|dygnet runt|around the clock/i.test(s)) {
      lagg({ objektId: "maskin", egenskap: "drifttid", text: "Dygnet runt (24/7)", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }
    const skift = s.match(/(\d)\s*-?\s*skift/i);
    if (skift) lagg({ objektId: "maskin", egenskap: "drifttid", text: `${skift[1]}-skift`, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });

    // Miljö: orden som står, inte en klassning.
    // "aluminiumdamm" ska med (ordgränsen ligger mitt i ordet), "dammfri" inte.
    const miljo = [...s.matchAll(/\b(torr\w*|fukt\w*|våt\w*|(?:lätt|mycket|mkt)\s+damm\w*|\w*damm(?!fri|sug)\w*|smuts\w*|utomhus|tvätt\w*|spol\w*|livsmedel\w*|kyl\w*|frys\w*|explosi\w*|atex)\b/gi)].map((x) => x[1].toLowerCase());
    if (miljo.length && /miljö|environment|damm|torr|fukt|utomhus|tvätt|spol|livsmedel|kyl|frys|atex/i.test(s)) {
      const unika = [...new Set(miljo)];
      lagg({ objektId: "maskin", egenskap: "miljo", text: unika.join(", "), ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Rörelseriktning: avgör broms, lasthållning och säkerhetsgranskning.
    if (/\b(?:lodrät\w*|vertikal\w*|lyft\w*|hissa\w*|sänk\w*|upp och ned|vertical\w*|lift\w*)\b/i.test(s)) {
      lagg({ objektId: "aktuator", egenskap: "riktning", text: "Lodrät (lyft)", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    } else if (/\b(?:horisontell\w*|vågrät\w*|i sidled|sidled\w*|horizontal\w*|sideways)\b/i.test(s)) {
      lagg({ objektId: "aktuator", egenskap: "riktning", text: "Vågrät", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Säkerhetskrav som kunden angett. Blir granskningsposter, aldrig logik.
    // Samma mönster som motorns angivenSakerhetsniva: "PLC" får aldrig läsas
    // som PL c (felet fanns i motorn till 2026-10-08 och i en första version här).
    const pl = /\bPL\s?([de])\b|\bPL\s([a-c])\b/i.exec(s);
    const sil = /\bSIL\s?([1-4])\b/i.exec(s);
    const kat = /\bkategori\s?([1-4B])\b/i.exec(s);
    const sak = pl ? `PL ${(pl[1] ?? pl[2]).toLowerCase()}` : sil ? `SIL ${sil[1]}` : kat ? `Kategori ${kat[1].toUpperCase()}` : null;
    if (sak) lagg({ objektId: "maskin", egenskap: "sakerhet", text: sak, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    else if (/\b(?:nödstopp\w*|säkerhetsfunktion\w*|skyddsgrind\w*|ljusridå\w*|emergency stop|safety function\w*)\b/i.test(s)) {
      lagg({ objektId: "maskin", egenskap: "sakerhet", text: "Säkerhetsfunktion nämnd", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }
    // Den största risken i ett lyft ska stå där ingenjören kontrollerar
    // tolkningen, inte bara i en fråga längre fram (sajtkritiken 2026-11-11).
    if (personalUnderLasten(s)) {
      lagg({
        id: "krav-maskin-personal-under-lasten", objektId: "maskin", egenskap: "sakerhet",
        text: "Personal under lasten: lasten får inte falla", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag },
      });
    }

    // Temperatur.
    for (const m of s.matchAll(/([−-]?\d+(?:[.,]\d+)?)\s*°\s*C\b/g)) {
      lagg({ objektId: "maskin", egenskap: "temperatur", varde: tal(m[1].replace("−", "-")), enhet: "°C", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Cykeltid i texten.
    const cykel = s.match(/\b(?:cykeltid|takttid|cycle time)\D{0,12}(\d+(?:[.,]\d+)?)\s*(?:s|sek\w*|sec\w*)\b/i);
    if (cykel) lagg({ objektId: "aktuator", egenskap: "cykeltid", varde: tal(cykel[1]), enhet: "s", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });

    // Hantering av produkten.
    const hantering = s.match(/\butan att\s+([^,.;]*?(?:välta|skad|repa|tappa|kantra|falla)[^,.;]*)/i);
    if (hantering) lagg({ objektId: "produkt", egenskap: "hantering", text: `Utan att ${hantering[1].trim()}`, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });

    // Produktavstånd.
    if (/\bvarierande\s+(?:avstånd|mellanrum|lucka|luckor)|\bvarying\s+(?:gaps?|spacing|distance)/i.test(s)) {
      lagg({ objektId: "produkt", egenskap: "avstand", text: "Varierande", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Signal från en kontrollstation.
    if (/\b(?:kontrollstation\w*|kamera\w*|vision\w*|inspektion\w*)\b/i.test(s) && /\bsignal\w*/i.test(s)) {
      lagg({ objektId: "kontrollstation", egenskap: "signal", text: "Signal för utsortering", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Mottagningen finns som föremål även utan tal.
    if (/\b(?:rullbord\w*|rullban\w*|mottagande\s+\w+|ränna\w*)\b/i.test(s)) objektSomFinns.add("mottagning");
    if (FORMAL[0].re.test(s)) objektSomFinns.add("transportband");
    FORMAL[0].re.lastIndex = 0;
  }

  // Svaren på följdfrågorna, med frågans id som källa.
  for (const [id, v] of Object.entries(svar)) {
    const varde = String(v ?? "").trim();
    if (!varde) continue;
    const vetInte = /^(?:vet inte|don't know|weiß nicht|no lo sé|lämnas öppen|öppen)$/i.test(varde);
    const k = svarTillKrav(id, varde);
    if (vetInte) continue; // en obesvarad fråga är en saknad uppgift, inget krav
    if (k) {
      lagg({ ...k, ursprung: "anvandare", kalla: { typ: "svar", utdrag: varde, svarId: id } });
    } else {
      lagg({ objektId: "maskin", egenskap: "svar", text: varde, ursprung: "anvandare", kalla: { typ: "svar", utdrag: varde, svarId: id }, id: `krav-svar-${id}` });
    }
  }

  const objekt: KravObjekt[] = OBJEKT_ORDNING.filter((t) => objektSomFinns.has(t)).map((typ) => ({ id: typ, typ }));
  const saknas = saknadeUppgifter(tillampning, krav, objekt, svar);
  return { tillampning, objekt, krav, osakra, saknas };
}

/** Kända följdfrågor -> föremål och egenskap. Okända blir "svar" på maskinen. */
function svarTillKrav(id: string, v: string): Omit<Krav, "id" | "bekraftelse" | "kravtyp" | "ursprung" | "kalla"> | null {
  const n = (() => {
    const t = [...v.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => tal(m[0]));
    return t.length ? t[t.length - 1] : NaN;
  })();
  const intervall = v.match(/(\d+(?:[.,]\d+)?)\s*(?:[–—-]|till)\s*(\d+(?:[.,]\d+)?)/);
  if (/(^|_)(last|vikt|weight|load|massa?|mass)(_|$)|_kg$/i.test(id) && !/rorlig|rörlig/i.test(id)) {
    return intervall
      ? { objektId: "produkt", egenskap: "massa", intervall: { min: tal(intervall[1]), max: tal(intervall[2]) }, enhet: "kg" }
      : Number.isFinite(n) ? { objektId: "produkt", egenskap: "massa", varde: n, enhet: "kg" } : null;
  }
  if (/slag|stroke/i.test(id) && Number.isFinite(n)) return { objektId: "aktuator", egenskap: "slaglangd", varde: n, enhet: "mm" };
  if (/hastighet|speed/i.test(id) && Number.isFinite(n)) {
    const mm = /mm\s*\/\s*s/i.test(v) || /_mm_?s$/i.test(id);
    return { objektId: "aktuator", egenskap: "hastighet", varde: mm ? n / 1000 : n, enhet: "m/s" };
  }
  if (/(^|_)takt|cykler|slag_per/i.test(id)) return { objektId: "aktuator", egenskap: "takt", text: v };
  if (/tryck|pressure/i.test(id) && Number.isFinite(n)) return { objektId: "matning", egenskap: "tryck", varde: n, enhet: "bar" };
  if (/minsta_?avstand/i.test(id) && Number.isFinite(n)) return { objektId: "produkt", egenskap: "minsta_avstand", varde: n, enhet: "mm" };
  if (/produktavstand/i.test(id)) return { objektId: "produkt", egenskap: "avstand", text: v };
  if (/utskjutningstid|forflyttningstid/i.test(id) && Number.isFinite(n)) return { objektId: "aktuator", egenskap: "cykeltid", varde: n, enhet: "s" };
  if (/band_vid_utskjutning/i.test(id)) return { objektId: "transportband", egenskap: "vid_utskjutning", text: v };
  if (/utsorteringar_i_foljd/i.test(id)) return { objektId: "produkt", egenskap: "utsorteringar_i_foljd", text: v };
  if (/rorlig_massa/i.test(id) && Number.isFinite(n)) return { objektId: "aktuator", egenskap: "rorlig_massa", varde: n, enhet: "kg" };
  return null;
}

/**
 * Det som behövs för nästa beslut och som beskrivningen inte säger. Fylls
 * ALDRIG med ett påhittat värde; listan är vad användaren eller ingenjören
 * ska ta ställning till.
 */
function saknadeUppgifter(tillampning: Tillampning, krav: Krav[], objekt: KravObjekt[], svar: Record<string, string>): SaknadUppgift[] {
  const finns = (obj: string, eg: string) => krav.some((k) => k.objektId === obj && k.egenskap === eg && k.bekraftelse !== "avvisat");
  const besvarad = (re: RegExp) => Object.entries(svar).some(([id, v]) => re.test(id) && !/^(?:vet inte|don't know|lämnas öppen|öppen)$/i.test(String(v).trim()));
  const ut: SaknadUppgift[] = [];
  const s = (u: SaknadUppgift) => { if (!ut.some((x) => x.id === u.id)) ut.push(u); };
  const harObjekt = (t: ObjektTyp) => objekt.some((o) => o.typ === t);

  if (tillampning === "sortering_utskjutning") {
    if (!finns("aktuator", "hastighet") && !besvarad(/utskjutningstid|hastighet/i)) s({
      id: "saknas-utskjutarhastighet", objektId: "aktuator", egenskap: "hastighet",
      sv: "Utskjutarens hastighet eller utskjutningstid", en: "Pusher speed or push time",
      varfor: { sv: "Bandets hastighet säger hur fort lådan kommer, inte hur fort utskjutaren måste röra sig. Tiden avgör kraften, dämpningen och om lådan hinner ut innan nästa kommer.", en: "The conveyor speed says how fast the box arrives, not how fast the pusher must move. The time decides force, cushioning and whether the box clears before the next one." },
    });
    if (!besvarad(/aterg|återg|cykeltid|utskjutningstid/i)) s({
      id: "saknas-cykeltid", objektId: "aktuator", egenskap: "cykeltid",
      sv: "Tillgänglig tid för utskjutning och återgång", en: "Time available for push and return",
      varfor: { sv: "Utskjutaren måste vara tillbaka innan nästa låda når den. 15 passerande lådor per minut är inte samma sak som 15 utsorteringar per minut.", en: "The pusher must be back before the next box arrives. 15 passing boxes per minute is not 15 rejects per minute." },
    });
    if (!besvarad(/rorelseprofil|profil/i)) s({
      id: "saknas-rorelseprofil", objektId: "aktuator", egenskap: "rorelseprofil",
      sv: "Rörelseprofil (mjukstart, dämpning i ändläge)", en: "Motion profile (soft start, end cushioning)",
      varfor: { sv: "Lådan får inte välta. Hur hårt utskjutaren accelererar och bromsar avgör det mer än kraften.", en: "The box must not tip over. How hard the pusher accelerates and brakes decides that more than the force." },
    });
    if (!besvarad(/minsta_?avstand|produktavstand/i)) s({
      id: "saknas-minsta-avstand", objektId: "produkt", egenskap: "minsta_avstand",
      sv: "Minsta avstånd mellan lådorna", en: "Minimum gap between boxes",
      varfor: { sv: "Med varierande avstånd är det minsta avståndet som bestämmer hur snabbt utskjutaren måste vara tillbaka.", en: "With varying gaps, the smallest gap decides how fast the pusher must return." },
    });
    if (!besvarad(/i_?foljd|följd/i)) s({
      id: "saknas-utsorteringar-i-foljd", objektId: "produkt", egenskap: "utsorteringar_i_foljd",
      sv: "Antal utsorteringar i följd", en: "Number of consecutive rejects",
      varfor: { sv: "Två utsorteringar efter varandra med minsta avstånd är det dimensionerande fallet för cykeltiden.", en: "Two consecutive rejects at the minimum gap is the sizing case for the cycle time." },
    });
    if (!besvarad(/produktidentifiering|detektering|givare_vid/i)) s({
      id: "saknas-produktdetektering", objektId: "aktuator", egenskap: "produktdetektering",
      sv: "Hur lådan detekteras vid utskjutaren", en: "How the box is detected at the pusher",
      varfor: { sv: "Signalen kommer från kontrollstationen, men utskjutaren måste veta när just den lådan står framför den.", en: "The signal comes from the inspection station, but the pusher must know when that particular box is in front of it." },
    });
    if (harObjekt("mottagning") && !besvarad(/blockerad/i)) s({
      id: "saknas-blockerad-mottagning", objektId: "mottagning", egenskap: "blockerad",
      sv: "Vad som händer när mottagningen är full eller blockerad", en: "What happens when the receiving side is full or blocked",
      varfor: { sv: "Blir rullbordet fullt kan utskjutaren inte göra sitt jobb. Det avgör både en givare och ett larm.", en: "If the roller table fills up, the pusher cannot do its job. That decides both a sensor and an alarm." },
    });
  }
  if (harObjekt("styrsystem") && !finns("styrsystem", "modell")) s({
    id: "saknas-plc-modell", objektId: "styrsystem", egenskap: "modell",
    sv: "PLC-modell och programmeringsmiljö", en: "PLC model and programming environment",
    varfor: { sv: "Avgör adressformat och vilka exportformat som är möjliga i programmeringsunderlaget.", en: "Decides the address format and the export formats possible in the programming documentation." },
  });
  if (harObjekt("styrsystem")) s({
    id: "saknas-signaladresser", objektId: "styrsystem", egenskap: "adresser",
    sv: "Signaladresser", en: "Signal addresses",
    varfor: { sv: "Adresserna är kända först när hårdvaran är konfigurerad; de hittas aldrig på.", en: "Addresses are known only once the hardware is configured; they are never invented." },
  });
  if (!finns("produkt", "massa") && !finns("aktuator", "kraft")) s({
    id: "saknas-massa", objektId: "produkt", egenskap: "massa",
    sv: "Lastens massa", en: "Load mass",
    varfor: { sv: "Massan avgör kraften och därmed storleken på aktuatorn.", en: "The mass decides the force and therefore the actuator size." },
  });
  return ut;
}

// ── Text för gränssnitt och sammanfattning ──────────────────────────────────

export const EGENSKAPSNAMN: Record<string, [string, string]> = {
  hastighet: ["Hastighet", "Speed"],
  massa: ["Massa", "Mass"],
  dimensionerande_massa: ["Dimensionerande massa", "Design mass"],
  matt: ["Mått", "Dimensions"],
  flode: ["Flöde", "Throughput"],
  slaglangd: ["Slaglängd", "Stroke"],
  sidoforflyttning: ["Önskad sidoförflyttning", "Required sideways travel"],
  kraft: ["Kraft", "Force"],
  tryck: ["Tryckluft", "Air pressure"],
  spanning: ["Spänning", "Voltage"],
  befintlig: ["Styrsystem", "Control system"],
  io: ["I/O", "I/O"],
  modell: ["PLC-modell", "PLC model"],
  drifttid: ["Drifttid", "Operating time"],
  miljo: ["Miljö", "Environment"],
  hantering: ["Hantering", "Handling"],
  avstand: ["Produktavstånd", "Product spacing"],
  signal: ["Signal", "Signal"],
  takt: ["Takt", "Rate"],
  cykeltid: ["Tid", "Time"],
  noggrannhet: ["Noggrannhet", "Accuracy"],
  temperatur: ["Temperatur", "Temperature"],
  minsta_avstand: ["Minsta avstånd", "Minimum gap"],
  vid_utskjutning: ["Vid utskjutning", "During the push"],
  utsorteringar_i_foljd: ["Utsorteringar i följd", "Consecutive rejects"],
  rorlig_massa: ["Rörlig massa", "Moving mass"],
  riktning: ["Rörelseriktning", "Direction"],
  sakerhet: ["Säkerhet", "Safety"],
  svar: ["Svar", "Answer"],
};

export const OBJEKTNAMN: Record<ObjektTyp, [string, string]> = {
  maskin: ["Maskinen", "The machine"],
  produkt: ["Produkten", "The product"],
  transportband: ["Transportbandet", "The conveyor"],
  aktuator: ["Aktuatorn", "The actuator"],
  kontrollstation: ["Kontrollstationen", "The inspection station"],
  mottagning: ["Mottagningen", "The receiving side"],
  styrsystem: ["Styrsystemet", "The control system"],
  matning: ["Matningen", "The supply"],
};

/** Värdet som det ska läsas, med enhet, gräns och intervall bevarade. */
export function kravetsVarde(k: Krav, locale = "sv"): string {
  const sv = locale === "sv";
  const n = (x: number) => (sv ? formatTal(x) : String(Math.round(x * 1000) / 1000));
  const grans = k.egenskap === "noggrannhet" ? "±"
    : k.grans === "max" ? (sv ? "upp till " : "up to ") : k.grans === "minst" ? (sv ? "minst " : "at least ") : "";
  const enhet = k.enhet ? ` ${k.enhet}` : "";
  if (k.intervall) return `${n(k.intervall.min)}–${n(k.intervall.max)}${enhet}`;
  if (k.varde != null) return `${grans}${n(k.varde)}${enhet}`;
  return `${grans}${k.text ?? ""}${k.text && k.enhet && !k.text.endsWith(k.enhet) ? enhet : ""}`.trim();
}

/** Aktuatorns hastighet enligt kravbilden, eller 0 om den inte är angiven. */
export function aktuatorensHastighet(kb: Kravbild): number {
  const k = kb.krav.find((x) => x.objektId === "aktuator" && x.egenskap === "hastighet" && x.bekraftelse !== "avvisat");
  return k?.varde ?? 0;
}

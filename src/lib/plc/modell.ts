/**
 * PLC & programmering: programmeringsunderlagets datamodell.
 *
 * Samma form som databasen kontrollerar i plc_kontrollera_data (migration
 * 20261012180000_plc_underlag.sql): okända fält och fel typer stoppas där,
 * och statusar som bara ett verktyg eller en granskning får sätta kan inte
 * sparas som utförda av en klient.
 *
 * Fas 1 fyller omfattning, plattform, antaganden och öppna frågor. Driftlägen,
 * signaler, parametrar, steg, larm och testfall kommer i fas 2 och 3 och har
 * redan sina platser, så att ett sparat underlag inte behöver flyttas.
 */

export const SCHEMA_VERSION = 1 as const;

/** Varifrån en post kommer. AI-förslag (fas 4) är aldrig bekräftade från början. */
export type Ursprung = "importerad" | "stycklista" | "manuell" | "ai";

/** Föreslagen tills en människa bekräftar; inaktuell när det den bygger på ändrats. */
export type Bekraftelse = "foreslagen" | "bekraftad" | "inaktuell";

/**
 * Ett krav hämtat ur maskinprojektets kravbild, med föremål, ursprung och
 * bekräftelse (supabase/functions/groq-advisor/kravbild.ts). Tolkas aldrig om.
 *
 * Underlag sparade före 2026-10-13 har bara id, värde och källa ("massa",
 * "hastighet" ...), utan föremål. De visas som de är och märks för granskning
 * -- en äldre "hastighet" kan ha varit transportbandets.
 */
export interface ImporteratKrav {
  /** Stabilt id: "krav-produkt-massa" (äldre: "massa"). */
  id: string;
  /** Värdet som det står i projektet, formaterat för läsning. */
  varde: string;
  /** Var i projektet värdet står. */
  kalla: "beskrivning" | "svar" | "stycklista" | "harlett";
  /** Svarets fråge-id, när värdet kommer från en följdfråga. */
  kallaDetalj?: string;
  /** Föremålet kravet gäller: "produkt", "transportband", "aktuator" ... */
  objekt?: string;
  /** Egenskapen: "massa", "hastighet" ... */
  egenskap?: string;
  /** Ursprung (användare, beräkning ...) skilt från bekräftelsen. */
  ursprung?: string;
  bekraftelse?: "ej_bekraftat" | "bekraftat" | "avvisat" | "inaktuellt";
  /** För ett härlett krav: hur värdet togs fram (lastfallet). */
  metod?: string;
}

/** En uppgift maskinprojektet saknar, eller en tolkning som inte är avgjord. */
export interface ImporteradLucka {
  id: string;
  sv: string;
  en: string;
}

export interface ImporteradKomponent {
  sku: string;
  roll: string;
  antal: number;
  namn?: string;
}

export interface Importerat {
  /** Maskinprojektets revision när kraven hämtades. */
  kallrevision: number;
  hamtat: string;
  krav: ImporteratKrav[];
  komponenter: ImporteradKomponent[];
  /** Uppgifter som saknas i maskinprojektet (blir öppna frågor här). */
  saknas?: ImporteradLucka[];
  /** Tolkningar användaren inte avgjort i maskinbyggaren. */
  osakra?: ImporteradLucka[];
  /** Processbeskrivningen som den står i projektet, hel. */
  processbeskrivning?: string;
}

/** Ett underlag vars krav hämtades före kravbilden (utan föremål). */
export function arAldreImport(i: Importerat): boolean {
  return i.krav.length > 0 && i.krav.some((k) => !k.objekt);
}

export type Leverans = "underlag" | "programforslag" | "ingenjor";
export type Arbete = "ny" | "andring" | "vet_inte";

/** Det underlaget kan omfatta. Användaren väljer; inget är förvalt utan grund. */
export const LEVERANSINNEHALL = [
  "funktionsbeskrivning", "driftlagen", "io_lista", "parametrar", "sekvens", "larm", "testplan",
] as const;
export type Leveransinnehall = (typeof LEVERANSINNEHALL)[number];

export interface Omfattning {
  leverans: Leverans | null;
  /** Vilken station eller vilka axlar som omfattas, med användarens ord. */
  omfattar: string;
  arbete: Arbete | null;
  /** Vad som ändras, när det är en ändring av ett befintligt program. */
  andring: string;
  innehall: Leveransinnehall[];
}

export type PlattformsVal = "befintlig" | "senare" | "hjalp";

/**
 * PLC (hårdvaran), programmeringsmiljön (verktyget) och språket hålls isär:
 * en S7-1500 programmeras i TIA Portal, i till exempel SCL eller GRAPH.
 */
export interface Plattform {
  val: PlattformsVal | null;
  /** Id i capability-registret, eller "annan". Tomt när okänt. */
  tillverkare: string;
  plcModell: string;
  miljo: string;
  miljoVersion: string;
  sprak: string[];
  kommunikation: string[];
  drivsteg: string;
  bibliotek: string;
  standard: string;
  dokumentation: string;
  /** Det som styr valet när plattformen inte är bestämd: fabrikens standard, service, reservdelar. */
  kravPaVal: string;
}

export interface TextPost {
  id: string;
  text: string;
  ursprung: Ursprung;
  status: Bekraftelse;
  andrad: string;
}

/**
 * Sju separata statusar i stället för ett "verifierat". Bara
 * uppgifterKompletta räknas fram av klienten; de övriga sätts av ett verktyg
 * med spårbart resultat eller av en granskningspost, och databasen vägrar ta
 * emot dem som utförda från en klient.
 */
export const STATUSNAMN = [
  "uppgifterKompletta", "dokumentGranskat", "kodGenererad", "statiskKontroll",
  "kompilering", "simulering", "tekniskGranskning",
] as const;
export type StatusNamn = (typeof STATUSNAMN)[number];

export interface StatusPost {
  status: "inte_utfort" | "utfort";
  av?: string;
  datum?: string;
  kalla?: string;
}

export type Statusar = Record<StatusNamn, StatusPost>;

// ── Steg 3–7 (fas B) ────────────────────────────────────────────────────────

/** Det alla poster i steg 4–7 har gemensamt: spårbarhet och status. */
export interface Post {
  id: string;
  ursprung: Ursprung;
  /** Föreslagen tills en människa bekräftar; inaktuell när underlaget ändrats. */
  status: Bekraftelse;
  /** Vad posten härleddes ur: en artikel (sku), ett krav (krav-id), en signal … */
  kalla: string;
  /** Varför posten blivit inaktuell, i klartext. */
  inaktuellOrsak?: string;
  andrad: string;
}

/** Driftlägen enligt PackML (ISA-TR88.00.02): automatiskt, underhåll, manuellt. */
export type Driftlage = "produktion" | "underhall" | "manuell";

/** De fyra poster som alltid skrivs av en människa (planen: AI får fråga, inte fylla i). */
export interface ObligatoriskaPoster {
  spanningsbortfall: string;
  kommunikationsbortfall: string;
  forloradProdukt: string;
  aterstart: string;
}

export interface Funktion {
  beskrivning: string;
  startvillkor: string;
  slutvillkor: string;
  samverkan: string;
  operator: string;
  varianter: string;
  lagen: Driftlage[];
  lagesbyte: string;
  obligatoriska: ObligatoriskaPoster;
}

/** Fysisk I/O, kommunikationssignaler och interna variabler hålls isär. */
export type Signaltyp = "DI" | "DO" | "AI" | "AO" | "kommunikation" | "intern";
export type Datatyp = "BOOL" | "INT" | "DINT" | "REAL" | "WORD" | "TIME" | "";

export interface Signal extends Post {
  /** Beteckning enligt IEC 81346, t.ex. "-QM1.Y1" eller "-BG1". */
  tagg: string;
  namn: string;
  beskrivning: string;
  typ: Signaltyp;
  datatyp: Datatyp;
  /** Tom = okänd. Adresser hittas aldrig på; de är kända först med hårdvaran. */
  adress: string;
  /** Varifrån signalen kommer och vart den går, med ord. */
  kallaText: string;
  mottagare: string;
  /** För utgångar: läget vid spänningsbortfall. Fylls i av en människa. */
  felsakert: string;
}

export interface Parameter extends Post {
  namn: string;
  betydelse: string;
  datatyp: Datatyp;
  enhet: string;
  /** Gränser och standardvärde bara när de är dokumenterade; annars tomma. */
  min: string;
  max: string;
  standard: string;
  behorighet: "operator" | "underhall" | "ingenjor" | "";
}

export interface Steg extends Post {
  nummer: string;
  namn: string;
  startvillkor: string;
  atgard: string;
  slutvillkor: string;
  nasta: string;
  /** Parameterns id för stegets tidsgräns, eller tomt. */
  tidsgrans: string;
  felhantering: string;
  /** Signalernas id som steget använder. */
  signaler: string[];
}

export interface Larm extends Post {
  nummer: string;
  villkor: string;
  funktion: string;
  operatorstext: string;
  reaktion: string;
  aterstallning: string;
  fortsattDrift: string;
  /** En säkerhetsrelaterad granskningspunkt är ingen processlarmslogik. */
  typ: "process" | "sakerhetsgranskning";
  signaler: string[];
  steg: string;
}

/** Testmetoderna hålls isär (IEC 62381 och planen). */
export type Testmetod = "dokumentgranskning" | "statisk_kontroll" | "kompilering" | "simulering" | "verklig_utrustning";

export interface Testfall extends Post {
  nummer: string;
  kravRef: string;
  forutsattningar: string;
  atgard: string;
  forvantat: string;
  metod: Testmetod;
  faktiskt: string;
  ansvarig: string;
  datum: string;
  /** Genererade testfall börjar som ej utförda; ett utfall kräver ansvarig och datum. */
  utfall: "ej_utfort" | "godkant" | "ej_godkant";
  /** Signalerna, stegen eller larmen testfallet prövar. */
  avser: string[];
}

export interface Underlag {
  schemaVersion: typeof SCHEMA_VERSION;
  importerat: Importerat;
  omfattning: Omfattning;
  plattform: Plattform;
  funktion: Funktion;
  signaler: Signal[];
  parametrar: Parameter[];
  steg: Steg[];
  larm: Larm[];
  testfall: Testfall[];
  antaganden: TextPost[];
  oppnaFragor: TextPost[];
  statusar: Statusar;
}

export function tomFunktion(): Funktion {
  return {
    beskrivning: "", startvillkor: "", slutvillkor: "", samverkan: "", operator: "", varianter: "",
    lagen: [], lagesbyte: "",
    obligatoriska: { spanningsbortfall: "", kommunikationsbortfall: "", forloradProdukt: "", aterstart: "" },
  };
}

/** En rad i plc_underlag, som klienten läser den. */
export interface UnderlagRad {
  id: string;
  project_id: string;
  revision: number;
  kallrevision: number;
  data: Underlag;
  updated_at: string;
}

export function tommaStatusar(): Statusar {
  const s = {} as Statusar;
  for (const n of STATUSNAMN) s[n] = { status: "inte_utfort" };
  return s;
}

export function tomtUnderlag(importerat: Importerat): Underlag {
  return {
    schemaVersion: SCHEMA_VERSION,
    importerat,
    omfattning: { leverans: null, omfattar: "", arbete: null, andring: "", innehall: [] },
    plattform: {
      val: null, tillverkare: "", plcModell: "", miljo: "", miljoVersion: "", sprak: [], kommunikation: [],
      drivsteg: "", bibliotek: "", standard: "", dokumentation: "", kravPaVal: "",
    },
    funktion: tomFunktion(),
    signaler: [],
    parametrar: [],
    steg: [],
    larm: [],
    testfall: [],
    antaganden: [],
    oppnaFragor: [],
    statusar: tommaStatusar(),
  };
}

/** Ett stabilt, kort id för en post. Ändras aldrig när posten redigeras. */
export function nyttId(prefix: string): string {
  const slump = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
    : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${slump}`;
}

/**
 * Läser ett sparat underlag. Saknade delar (ett underlag sparat av en äldre
 * version) fylls med tomma värden i stället för att sidan kraschar; ett
 * underlag med okänd schemaversion kastas, så att det aldrig tolkas fel.
 */
export function lasUnderlag(data: unknown): Underlag {
  const d = (data ?? {}) as Partial<Underlag>;
  if (d.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Okänd schemaversion för underlaget: ${String(d.schemaVersion)}`);
  }
  const tomt = tomtUnderlag(d.importerat ?? { kallrevision: 0, hamtat: "", krav: [], komponenter: [] });
  return {
    ...tomt,
    ...d,
    omfattning: { ...tomt.omfattning, ...(d.omfattning ?? {}) },
    plattform: { ...tomt.plattform, ...(d.plattform ?? {}) },
    funktion: {
      ...tomt.funktion, ...(d.funktion ?? {}),
      obligatoriska: { ...tomt.funktion.obligatoriska, ...(d.funktion?.obligatoriska ?? {}) },
    },
    signaler: d.signaler ?? [],
    parametrar: d.parametrar ?? [],
    steg: d.steg ?? [],
    larm: d.larm ?? [],
    testfall: d.testfall ?? [],
    statusar: { ...tomt.statusar, ...(d.statusar ?? {}) },
    antaganden: d.antaganden ?? [],
    oppnaFragor: d.oppnaFragor ?? [],
  };
}

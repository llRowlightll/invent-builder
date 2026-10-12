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

/** Ett krav hämtat ur maskinprojektet, med ursprung. Tolkas aldrig om. */
export interface ImporteratKrav {
  /** Stabil nyckel: "massa", "slag", "drift" … */
  id: string;
  /** Värdet som det står i projektet, formaterat för läsning. */
  varde: string;
  /** Var i projektet värdet står. */
  kalla: "beskrivning" | "svar" | "stycklista";
  /** Svarets fråge-id, när värdet kommer från en följdfråga. */
  kallaDetalj?: string;
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

export interface Underlag {
  schemaVersion: typeof SCHEMA_VERSION;
  importerat: Importerat;
  omfattning: Omfattning;
  plattform: Plattform;
  antaganden: TextPost[];
  oppnaFragor: TextPost[];
  statusar: Statusar;
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
    statusar: { ...tomt.statusar, ...(d.statusar ?? {}) },
    antaganden: d.antaganden ?? [],
    oppnaFragor: d.oppnaFragor ?? [],
  };
}

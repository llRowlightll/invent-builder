/**
 * Resultatets sammanfattning, byggd ur data -- aldrig skriven av en modell.
 *
 * Till 2026-10-13 skrev språkmodellen titel och förklaring ("system type, key
 * specs, safety approach"). I lådsorteringstestet påstod texten en intern
 * linjär transducer och vridskydd som ingen rad i stycklistan hade, lovade
 * exakt 350 mm rörelse med en cylinder på 400 mm, och skrev att säkerheten
 * säkerställs. Texten var friare än underlaget den sammanfattade.
 *
 * Här beskrivs bara det som finns: kravbilden med sin bekräftelse, raderna,
 * deras kontroller, beräkningarna med sin status och det som saknas.
 * Säkerhet beskrivs aldrig som uppfylld; den hanteras av ansvariga personer.
 */
import type { BomRow } from "./bom-builder.ts";
import { EGENSKAPSNAMN, kravetsVarde, OBJEKTNAMN, type Krav, type Kravbild } from "./kravbild.ts";
import type { Kraftkrav } from "./signals.ts";

export type Berakningsstatus = "ej_utford" | "preliminar" | "underlag_otillrackligt" | "utford" | "inaktuell";

export interface Berakning {
  id: string;
  namn: string;
  status: Berakningsstatus;
  resultat: string | null;
  metod: string;
  saknas: string[];
}

export interface Resultatstatus {
  /** Kravbilden har inga saknade uppgifter och inga öppna tolkningar. */
  underlagKomplett: boolean;
  /** Dimensioneringen bygger på angivna värden, inte en uppskattning. */
  dimensioneringUtford: boolean;
  /** Varje tillämplig kontroll kunde göras och höll. */
  kompatibilitetKontrollerad: boolean;
  /** Ingen platshållare och ingen familj som återstår att konfigurera. */
  bestallningskoderKompletta: boolean;
}

export interface Resultat {
  titel: string;
  princip: string;
  text: string;
  berakningar: Berakning[];
  oppnaPunkter: string[];
  konfiguration: Array<{ sku: string; roll: string; text: string }>;
  status: Resultatstatus;
}

export const SAKERHETSTEXT = {
  sv: "Förslaget omfattar komponent- och funktionsunderlag. Riskbedömning, säkerhetsfunktioner och validering hanteras separat av ansvariga personer.",
  en: "The proposal covers component and function documentation. Risk assessment, safety functions and validation are handled separately by the responsible persons.",
};

type Dom = {
  bestallningsklar: boolean;
  blockerande: Array<{ sku: string; role: string; skal: string }>;
  kontrollerat: {
    verifierade: number; blockerande: number; rader: number; underlag_saknas: number;
    stods_inte: number; ej_tillampligt: number; konfiguration: number; med_luckor: number;
  };
};

const VIKTIGA: Array<[string, string]> = [
  ["produkt", "massa"], ["produkt", "dimensionerande_massa"], ["produkt", "matt"], ["produkt", "flode"],
  ["produkt", "sidoforflyttning"], ["produkt", "avstand"], ["produkt", "hantering"],
  ["transportband", "hastighet"], ["aktuator", "hastighet"], ["aktuator", "slaglangd"], ["aktuator", "kraft"],
  ["aktuator", "noggrannhet"], ["aktuator", "takt"], ["kontrollstation", "signal"],
  ["matning", "tryck"], ["matning", "spanning"], ["styrsystem", "befintlig"], ["styrsystem", "io"],
  ["styrsystem", "modell"], ["maskin", "drifttid"], ["maskin", "miljo"],
];

function kravrad(k: Krav, sv: boolean): string {
  const varde = kravetsVarde(k, sv ? "sv" : "en");
  // "Styrsystemet: befintligt styrsystem" -- egenskapens namn upprepar bara föremålet.
  if (k.egenskap === "befintlig") return varde.charAt(0).toLowerCase() + varde.slice(1);
  const namn = EGENSKAPSNAMN[k.egenskap]?.[sv ? 0 : 1] ?? k.egenskap;
  const text = k.text && !k.enhet ? varde.charAt(0).toLowerCase() + varde.slice(1) : varde;
  // "signal signal för utsortering": värdet säger redan vad det är.
  if (text.toLowerCase().includes(namn.toLowerCase())) return text;
  return `${namn.toLowerCase()} ${text}`;
}

export function byggResultat(o: {
  locale: string;
  kravbild: Kravbild;
  rows: BomRow[];
  primarySku: string;
  primaryName?: string;
  isElectric: boolean;
  kraftkrav?: Kraftkrav;
  dom: Dom;
  /** Primärens kategori (slug). Ett gripdon eller en sugkopp som primär är
   *  ingen cylinder, och principen ska inte kalla den det. */
  primaryCategory?: string;
}): Resultat {
  const sv = o.locale === "sv";
  const kb = o.kravbild;
  const komponenter = o.rows.filter((r) => r.kind !== "warning");
  const harVentil = komponenter.some((r) => r.kind === "valve" || r.kind === "valve_terminal");
  const harBeredning = komponenter.some((r) => r.kind === "frl");
  const sortering = kb.tillampning === "sortering_utskjutning";
  const greppPrimar = o.primaryCategory === "gripper" ? "gripper" : o.primaryCategory === "vacuum" ? "vacuum" : null;

  const tillbehor = sv
    ? `${harVentil ? " med styrventil" : ""}${harBeredning ? " och luftberedning" : ""}`
    : `${harVentil ? " with control valve" : ""}${harBeredning ? " and air preparation" : ""}`;
  const princip = greppPrimar === "gripper"
    ? (sv ? `Pneumatiskt gripdon${tillbehor}` : `Pneumatic gripper${tillbehor}`)
    : greppPrimar === "vacuum"
    ? (sv ? "Vakuumgrepp med sugkoppar" : "Vacuum grip with suction cups")
    : (o.isElectric
      ? (sv ? "Elektrisk axel med drivsteg och motor" : "Electric axis with drive and motor")
      : (sv ? `Pneumatisk cylinder${tillbehor}` : `Pneumatic cylinder${tillbehor}`));
  const titel = greppPrimar
    ? (sv ? `${greppPrimar === "gripper" ? "Pneumatiskt grepp" : "Vakuumgrepp"} — ${o.primarySku}` : `${greppPrimar === "gripper" ? "Pneumatic grip" : "Vacuum grip"} — ${o.primarySku}`)
    : sv
    ? `${o.isElectric ? "Elektrisk" : "Pneumatisk"} ${sortering ? "utskjutare för utsortering" : "rörelse"} — ${o.primarySku}`
    : `${o.isElectric ? "Electric" : "Pneumatic"} ${sortering ? "reject pusher" : "motion"} — ${o.primarySku}`;

  // Kravbilden, per föremål, med bekräftelsen utskriven.
  const perObjekt = new Map<string, string[]>();
  for (const [obj, eg] of VIKTIGA) {
    for (const k of kb.krav.filter((x) => x.objektId === obj && x.egenskap === eg && x.bekraftelse !== "avvisat")) {
      const lista = perObjekt.get(obj) ?? [];
      lista.push(kravrad(k, sv));
      perObjekt.set(obj, lista);
    }
  }
  const allaBekraftade = kb.krav.length > 0 && kb.krav.every((k) => k.bekraftelse === "bekraftat" || k.bekraftelse === "avvisat");
  const kravtext = [...perObjekt.entries()]
    .map(([obj, lista]) => `${OBJEKTNAMN[obj as keyof typeof OBJEKTNAMN]?.[sv ? 0 : 1] ?? obj}: ${lista.join("; ")}`)
    .join(". ");

  // Beräkningar.
  const berakningar: Berakning[] = [];
  const kk = o.kraftkrav;
  if (kk && kk.metod !== "ingen" && kk.forceN > 0) {
    berakningar.push({
      id: "berakning-kraft",
      namn: sv ? "Kraft" : "Force",
      status: kk.metod === "angiven" ? "utford" : "preliminar",
      resultat: `${kk.forceN} N`,
      metod: kk.forklaring,
      saknas: kk.saknas ?? [],
    });
  } else {
    berakningar.push({
      id: "berakning-kraft", namn: sv ? "Kraft" : "Force", status: "underlag_otillrackligt", resultat: null,
      metod: sv ? "Ingen last eller kraft angiven." : "No load or force stated.", saknas: [sv ? "lastens massa eller kraften" : "load mass or force"],
    });
  }
  if (sortering) {
    berakningar.push({
      id: "berakning-cykeltid", namn: sv ? "Cykeltid för utskjutning och återgång" : "Push and return cycle time",
      status: "underlag_otillrackligt", resultat: null,
      metod: sv ? "Kräver minsta produktavstånd, bandhastighet och tillgänglig tid." : "Requires minimum gap, conveyor speed and available time.",
      saknas: kb.saknas.filter((s) => /avstand|cykeltid|utskjutarhastighet|i-foljd/.test(s.id)).map((s) => (sv ? s.sv : s.en)),
    });
  }

  // Konfiguration och avvikelser som är öppna.
  const konfiguration = komponenter
    .filter((r) => r.verifiering === "avvikelse" || r.verifiering === "kraver_konfiguration")
    .map((r) => ({ sku: r.sku, roll: r.role, text: r.verifieringsskal ?? "" }));
  const platshallare = komponenter.filter((r) => r.sku === "SPECIFY");

  const k = o.dom.kontrollerat;
  const kontrolltext = sv
    ? `Kontroller: ${k.verifierade} av ${k.rader} rader kontrollerade mot angivna krav` +
      `${k.med_luckor ? `, ${k.med_luckor} med krav som inte kunde prövas (underlag saknas eller automatisk kontroll stöds inte)` : ""}` +
      `${k.ej_tillampligt ? `, ${k.ej_tillampligt} där inget angivet krav gäller` : ""}` +
      `${k.blockerande ? `, ${k.blockerande} som måste åtgärdas före beställning` : ""}.`
    : `Checks: ${k.verifierade} of ${k.rader} rows checked against stated requirements` +
      `${k.med_luckor ? `, ${k.med_luckor} with requirements that could not be checked (data missing or no automatic check)` : ""}` +
      `${k.ej_tillampligt ? `, ${k.ej_tillampligt} where no stated requirement applies` : ""}` +
      `${k.blockerande ? `, ${k.blockerande} that must be resolved before ordering` : ""}.`;

  const oppnaPunkter = [
    ...kb.osakra.map((t) => (sv ? t.fraga.sv : t.fraga.en)),
    ...kb.saknas.map((s) => (sv ? s.sv : s.en)),
  ];

  const stycken: string[] = [];
  stycken.push(`${sv ? "Lösningsprincip" : "Solution principle"}: ${princip}. ${sv ? "Primär komponent" : "Primary component"}: ${o.primarySku}${o.primaryName ? ` (${o.primaryName})` : ""}.`);
  if (kravtext) {
    stycken.push(`${sv ? (allaBekraftade ? "Kravbild (bekräftad)" : "Kravbild (tolkad ur beskrivningen, ej bekräftad)") : (allaBekraftade ? "Requirements (confirmed)" : "Requirements (interpreted from the description, not confirmed)")} — ${kravtext}.`);
  }
  for (const b of berakningar) {
    const status = b.status === "preliminar" ? (sv ? "preliminär uppskattning" : "preliminary estimate")
      : b.status === "utford" ? (sv ? "angiven" : "stated")
      : (sv ? "underlag otillräckligt" : "insufficient data");
    stycken.push(`${b.namn}: ${b.resultat ?? "—"} (${status}).${b.saknas.length ? ` ${sv ? "Saknas" : "Missing"}: ${b.saknas.join(", ")}.` : ""}`);
  }
  if (konfiguration.length) {
    stycken.push(`${sv ? "Öppen konfiguration" : "Open configuration"}: ${konfiguration.map((x) => `${x.roll} — ${x.text}`).join(" ")}`);
  }
  if (platshallare.length) {
    stycken.push(`${sv ? "Platshållare utan artikel" : "Placeholders without an item"}: ${platshallare.map((r) => r.role).join("; ")}.`);
  }
  stycken.push(kontrolltext);
  if (oppnaPunkter.length) {
    stycken.push(`${sv ? "Öppna frågor" : "Open questions"}: ${oppnaPunkter.join("; ")}.`);
  }
  stycken.push(sv ? SAKERHETSTEXT.sv : SAKERHETSTEXT.en);

  const status: Resultatstatus = {
    underlagKomplett: kb.saknas.length === 0 && kb.osakra.length === 0,
    dimensioneringUtford: berakningar.every((b) => b.status === "utford"),
    kompatibilitetKontrollerad: k.med_luckor === 0 && k.blockerande === 0 && k.underlag_saknas === 0 && k.verifierade > 0,
    bestallningskoderKompletta: platshallare.length === 0 && !komponenter.some((r) => r.verifiering === "kraver_konfiguration"),
  };

  return { titel, princip, text: stycken.join("\n\n"), berakningar, oppnaPunkter, konfiguration, status };
}

/**
 * Meningar i modellskriven prosa som påstår säkerhet. Modellen skriver
 * fortfarande alternativens motivering; ett påstående om att säkerheten är
 * säkerställd får aldrig nå kunden (manualens punkt 5.5).
 */
const SAKERHETSPASTAENDE = /säkerhet\w*\s+(?:säkerställ|garanter|uppfyll)\w*|säkerställ\w*\s+(?:säkerhet|säker drift)|garanter\w*\s+(?:säkerhet|säker)|\bsafety\s+is\s+(?:ensured|guaranteed)|ensur\w*\s+safety|guarantee\w*\s+safety|\bsafe\s+operation\s+is\s+ensured/i;

export function utanSakerhetspastaenden(text: string): string {
  if (!text) return text;
  const meningar = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  return meningar.filter((m) => !SAKERHETSPASTAENDE.test(m)).join("").trim();
}

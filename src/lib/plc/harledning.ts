/**
 * Programmeringsunderlagets förslag i steg 4–7, härledda ur maskinprojektets
 * stycklista och kravbild -- deterministiskt, utan språkmodell, så att samma
 * projekt alltid ger samma förslag (planen: "Från stycklista till I/O-lista").
 *
 * Varje förslag börjar som "föreslagen" och bär sin källa (artikel, krav,
 * signal). Inget hittas på: adresser, tider, gränsvärden och felsäkra lägen
 * lämnas tomma och blir öppna frågor; en signal som ingen komponent i
 * stycklistan ger finns inte, även om den behövs -- då blir den en lucka.
 *
 * Beteckningar enligt IEC 81346-2: -QM ventil (styr ett flöde av fluid),
 * -BG givare för läge, -TA drivsteg (omvandlar elenergi), -MA motor.
 */
import type {
  ImporteradKomponent, Importerat, Larm, Parameter, Signal, Steg, Testfall, Underlag,
} from "./modell.ts";

const NU = () => new Date().toISOString();

type Komponentsort =
  | "cylinder" | "ventil52" | "ventil53" | "ventil_bistabil" | "ventilterminal" | "givare" | "drivsteg"
  | "motor" | "vakuum" | "tryckvakt" | "stangbroms" | "sakerhetsventil" | "ovrig";

/** Komponentens sort ur roll och namn (stycklistans visningstext). */
export function komponentsort(k: ImporteradKomponent): Komponentsort {
  const t = `${k.roll} ${k.namn ?? ""}`.toLowerCase();
  if (/säkerhet|sil\b|\bpl[de]\b|safety/.test(t)) return "sakerhetsventil";
  if (/ventilterminal|valve terminal|\bcpx\b|vtug|vtem|\bmpa\b|ex600/.test(t)) return "ventilterminal";
  if (/stångbroms|rod lock|låsenhet|mekaniskt lås/.test(t)) return "stangbroms";
  if (/tryckvakt|pressure switch/.test(t)) return "tryckvakt";
  if (/servodriv|drivsteg|motorstyrning|servo drive|frekvensomriktare/.test(t)) return "drivsteg";
  if (/servomotor|stegmotor|\bmotor\b/.test(t) && !/motorkabel|motor cable/.test(t)) return "motor";
  if (/ejektor|vakuum|vacuum/.test(t) && !/sugkopp|suction cup/.test(t)) return "vakuum";
  if (/givare|sensor/.test(t)) return "givare";
  if (/5\/3/.test(t) && /ventil|valve/.test(t)) return "ventil53";
  if (/bistabil|impuls|dubbelspol/.test(t) && /ventil|valve/.test(t)) return "ventil_bistabil";
  if (/magnetventil|styrventil|5\/2|solenoid valve/.test(t)) return "ventil52";
  if (/primär aktuator|primary actuator|cylinder|aktuator/.test(t) && !/servo|elektrisk|electric/.test(t)) return "cylinder";
  return "ovrig";
}

function signal(p: Omit<Signal, "status" | "andrad" | "adress" | "felsakert"> & { felsakert?: string }): Signal {
  return { status: "foreslagen", andrad: NU(), adress: "", felsakert: "", ...p };
}

/**
 * I/O-listan ur stycklistan (planens tabell). Signalernas id är stabila och
 * byggda på källan, så att ett nytt förslag känner igen en signal som redan
 * finns -- och användarens ändringar i den aldrig skrivs över.
 */
export function foreslaSignaler(imp: Importerat): Signal[] {
  const ut: Signal[] = [];
  const raknare: Record<string, number> = {};
  const nasta = (klass: string) => (raknare[klass] = (raknare[klass] ?? 0) + 1);
  const krav = (objekt: string, egenskap: string) => imp.krav.find((k) => k.objekt === objekt && k.egenskap === egenskap && k.bekraftelse !== "avvisat");

  for (const k of imp.komponenter) {
    const sort = komponentsort(k);
    const kalla = `stycklista:${k.sku}:${k.roll}`;
    const kallaText = `${k.roll}${k.namn ? ` (${k.namn})` : ""}${k.sku !== "SPECIFY" ? `, ${k.sku}` : ""}`;
    if (sort === "ventil52") {
      const n = nasta("QM");
      ut.push(signal({
        id: `sig-qm${n}-y1`, tagg: `-QM${n}.Y1`, namn: "Rörelse ut", typ: "DO", datatyp: "BOOL",
        beskrivning: "Spole på 5/2-ventilen. Monostabil antas: strömlös ventil går tillbaka med fjäder -- kontrollera ventiltypen.",
        ursprung: "stycklista", kalla, kallaText, mottagare: "Ventilspole",
      }));
    } else if (sort === "ventil_bistabil" || sort === "ventil53") {
      const n = nasta("QM");
      for (const [y, namn] of [["Y1", "Rörelse ut"], ["Y2", "Rörelse in"]] as const) {
        ut.push(signal({
          id: `sig-qm${n}-${y.toLowerCase()}`, tagg: `-QM${n}.${y}`, namn, typ: "DO", datatyp: "BOOL",
          beskrivning: sort === "ventil53"
            ? "Spole på 5/3-ventilen. Strömlös: mittläget -- avgör vad rörelsen gör vid spänningsbortfall."
            : "Spole på bistabil ventil. Behåller läget vid spänningsbortfall; återstarten måste definieras.",
          ursprung: "stycklista", kalla, kallaText, mottagare: "Ventilspole",
        }));
      }
    } else if (sort === "givare") {
      // Två givare i samma rad = båda ändlägena. En givare: vilket läge är en öppen fråga.
      const lagen = k.antal >= 2 ? [["Ute", "Utskjutet läge"], ["Inne", "Indraget läge (grundläge)"]] : [["Ändläge", "Ändläge -- vilket läge givaren sitter i är inte känt"]];
      lagen.forEach(([namn, beskr], i) => {
        const n = nasta("BG");
        ut.push(signal({
          id: `sig-bg${n}`, tagg: `-BG${n}`, namn, typ: "DI", datatyp: "BOOL",
          beskrivning: `${beskr}. Lägesgivare på cylindern; PNP/NO antas, kontrollera mot givarens datablad.`,
          ursprung: "stycklista", kalla: `${kalla}:${i}`, kallaText, mottagare: "PLC",
        }));
      });
    } else if (sort === "drivsteg") {
      const n = nasta("TA");
      const sig = (suffix: string, namn: string, typ: Signal["typ"], datatyp: Signal["datatyp"], beskr: string) =>
        ut.push(signal({ id: `sig-ta${n}-${suffix}`, tagg: `-TA${n}.${namn.replace(/\s+/g, "")}`, namn, typ, datatyp, beskrivning: beskr, ursprung: "stycklista", kalla: `${kalla}:${suffix}`, kallaText, mottagare: suffix.startsWith("ut") ? "Drivsteg" : "PLC" }));
      sig("ut-styrord", "Styrord", "kommunikation", "WORD", "Styrord till drivsteget (PROFIdrive eller CiA 402 beroende på plattform).");
      sig("in-statusord", "Statusord", "kommunikation", "WORD", "Statusord från drivsteget.");
      sig("ut-borposition", "Börposition", "kommunikation", "DINT", "Målposition till drivsteget.");
      sig("in-arposition", "Ärposition", "kommunikation", "DINT", "Aktuell position från drivsteget.");
      sig("in-referens", "Referens klar", "kommunikation", "BOOL", "Referenskörning utförd.");
      sig("in-fel", "Fel", "kommunikation", "BOOL", "Samlat fel från drivsteget.");
    } else if (sort === "vakuum") {
      const n = nasta("QM");
      ut.push(signal({ id: `sig-qm${n}-vakuum`, tagg: `-QM${n}.Y1`, namn: "Vakuum på", typ: "DO", datatyp: "BOOL", beskrivning: "Ejektorns vakuumventil.", ursprung: "stycklista", kalla: `${kalla}:pa`, kallaText, mottagare: "Ejektor" }));
      ut.push(signal({ id: `sig-qm${n}-avblas`, tagg: `-QM${n}.Y2`, namn: "Avblåsning", typ: "DO", datatyp: "BOOL", beskrivning: "Avblåsning för att släppa detaljen.", ursprung: "stycklista", kalla: `${kalla}:av`, kallaText, mottagare: "Ejektor" }));
      const b = nasta("BG");
      ut.push(signal({ id: `sig-bg${b}-vakuum`, tagg: `-BG${b}`, namn: "Vakuum OK", typ: "DI", datatyp: "BOOL", beskrivning: "Vakuumvakt: detaljen sitter fast.", ursprung: "stycklista", kalla: `${kalla}:ok`, kallaText, mottagare: "PLC" }));
    } else if (sort === "tryckvakt") {
      const b = nasta("BG");
      ut.push(signal({ id: `sig-bg${b}-tryck`, tagg: `-BG${b}`, namn: "Tryck OK", typ: "DI", datatyp: "BOOL", beskrivning: "Tryckvakt på matningen.", ursprung: "stycklista", kalla, kallaText, mottagare: "PLC" }));
    } else if (sort === "stangbroms") {
      const n = nasta("QM");
      ut.push(signal({ id: `sig-qm${n}-frigor`, tagg: `-QM${n}.Y1`, namn: "Frigör broms", typ: "DO", datatyp: "BOOL", beskrivning: "Släpper stångbromsen. Lyft: säkerhetsrelevant -- granskas.", ursprung: "stycklista", kalla, kallaText, mottagare: "Stångbroms" }));
    } else if (sort === "ventilterminal") {
      const n = nasta("QM");
      ut.push(signal({ id: `sig-qm${n}-diagnos`, tagg: `-QM${n}.Diagnos`, namn: "Diagnos ventilterminal", typ: "kommunikation", datatyp: "WORD", beskrivning: "Matning, kortslutning och modulfel via bussen. Adressen är modulens plats i processavbilden, känd först med hårdvarukonfigurationen.", ursprung: "stycklista", kalla, kallaText, mottagare: "PLC" }));
    }
  }

  // Signaler ur kravbilden: det kunden sagt om omgivningen.
  const kontroll = krav("kontrollstation", "signal");
  if (kontroll) {
    const digital = !!krav("styrsystem", "io");
    ut.push(signal({
      id: "sig-utsorteringssignal", tagg: "-KF1.Utsortering", namn: "Utsortering begärd",
      typ: digital ? "DI" : "kommunikation", datatyp: "BOOL",
      beskrivning: digital
        ? "Signal från kontrollstationen. DI antas eftersom styrsystemet har digitala I/O -- bekräfta."
        : "Signal från kontrollstationen. Hur den överförs är inte känt.",
      ursprung: "importerad", kalla: kontroll.id, kallaText: "Kravbilden: kontrollstationen", mottagare: "PLC",
    }));
  }
  const band = krav("transportband", "vid_utskjutning");
  if (band && /stannar|stop/i.test(band.varde)) {
    ut.push(signal({
      id: "sig-band-stopp", tagg: "-KF1.BandStopp", namn: "Stoppa bandet", typ: "DO", datatyp: "BOOL",
      beskrivning: "Bandet stannar vid utskjutning. Styrningen av bandet finns inte i stycklistan -- hur signalen når bandet är en öppen fråga.",
      ursprung: "importerad", kalla: band.id, kallaText: "Kravbilden: bandet vid utskjutning", mottagare: "Transportbandets styrning",
    }));
  }
  return ut;
}

function parameter(p: Omit<Parameter, "status" | "andrad" | "min" | "max" | "standard">): Parameter {
  return { status: "foreslagen", andrad: NU(), min: "", max: "", standard: "", ...p };
}

/** Tidsgränser för stegen. Värdena är okända tills någon anger dem. */
export function foreslaParametrar(steg: Steg[]): Parameter[] {
  return steg.filter((s) => s.tidsgrans).map((s) => parameter({
    id: s.tidsgrans, namn: `Tidsgräns ${s.namn.toLowerCase()}`,
    betydelse: `Längsta tillåtna tid för steg ${s.nummer} innan larm.`,
    datatyp: "TIME", enhet: "ms", behorighet: "ingenjor",
    ursprung: "stycklista", kalla: s.id,
  }));
}

function steg(p: Omit<Steg, "status" | "andrad" | "ursprung"> & { ursprung?: Steg["ursprung"] }): Steg {
  return { status: "foreslagen", andrad: NU(), ursprung: "stycklista", ...p };
}

/**
 * Sekvensen som stegkedja (GRAFCET, IEC 60848). Förslaget följer
 * tillämpningen; villkor som beror på något som inte finns i stycklistan
 * står som öppna, inte som påhittade signaler.
 */
export function foreslaSekvens(imp: Importerat, signaler: Signal[]): Steg[] {
  const ut = signaler.find((s) => s.tagg.endsWith(".Y1") && s.namn === "Rörelse ut");
  const in2 = signaler.find((s) => s.tagg.endsWith(".Y2") && s.namn === "Rörelse in");
  const ute = signaler.find((s) => s.typ === "DI" && s.namn === "Ute");
  const inne = signaler.find((s) => s.typ === "DI" && s.namn === "Inne");
  const begard = signaler.find((s) => s.id === "sig-utsorteringssignal");
  const bandStopp = signaler.find((s) => s.id === "sig-band-stopp");
  const drivsteg = signaler.find((s) => s.tagg.includes("Styrord"));
  const sortering = imp.krav.some((k) => k.objekt === "transportband") && imp.krav.some((k) => k.objekt === "kontrollstation");
  const ref = (s?: Signal) => (s ? s.tagg : "");
  const sigIds = (...s: Array<Signal | undefined>) => s.filter(Boolean).map((x) => x!.id);

  if (drivsteg) {
    return [
      steg({ id: "steg-s0", nummer: "S0", namn: "Grundläge", startvillkor: "Inga aktiva larm; drivsteget redo", atgard: "Ingen rörelse", slutvillkor: "Referens klar", nasta: "S1", tidsgrans: "", felhantering: "Saknas referensen: referenskörning i S1.", signaler: sigIds(drivsteg), kalla: "tillampning:elaxel" }),
      steg({ id: "steg-s1", nummer: "S1", namn: "Referenskörning", startvillkor: "Referens saknas", atgard: "Starta referenskörning i drivsteget", slutvillkor: "Referens klar", nasta: "S2", tidsgrans: "par-steg-s1", felhantering: "Larm vid tidsgräns.", signaler: sigIds(drivsteg), kalla: "tillampning:elaxel" }),
      steg({ id: "steg-s2", nummer: "S2", namn: "Vänta på start", startvillkor: "S1 klart", atgard: "–", slutvillkor: "Startvillkor uppfyllt (definieras i steg 3)", nasta: "S3", tidsgrans: "", felhantering: "–", signaler: [], kalla: "tillampning:elaxel" }),
      steg({ id: "steg-s3", nummer: "S3", namn: "Positionera", startvillkor: "S2 klart", atgard: "Börposition till drivsteget, starta rörelse", slutvillkor: "Ärposition inom tolerans", nasta: "S2", tidsgrans: "par-steg-s3", felhantering: "Larm vid tidsgräns eller fel i drivsteget.", signaler: sigIds(drivsteg), kalla: "tillampning:elaxel" }),
    ];
  }
  if (!ut) return [];
  const ut2 = ute ? `${ref(ute)} Ute = 1` : "Ändläge ute (ingen givare i stycklistan -- öppen fråga)";
  const in2v = inne ? `${ref(inne)} Inne = 1` : "Ändläge inne (ingen givare i stycklistan -- öppen fråga)";
  const kedja: Steg[] = [
    steg({ id: "steg-s0", nummer: "S0", namn: "Grundläge", startvillkor: "Inga aktiva larm; tryckluft på", atgard: `${ref(ut)} = 0${in2 ? `, ${ref(in2)} = 1` : ""}`, slutvillkor: in2v, nasta: "S1", tidsgrans: "par-steg-s0", felhantering: "Larm om grundläget inte nås.", signaler: sigIds(ut, in2, inne), kalla: "tillampning" }),
  ];
  if (sortering) {
    kedja.push(steg({ id: "steg-s1", nummer: "S1", namn: "Vänta på utsorteringsbeslut", startvillkor: "S0 klart", atgard: "–", slutvillkor: begard ? `${ref(begard)} = 1` : "Utsorteringssignal (överföring okänd)", nasta: "S2", tidsgrans: "", felhantering: "–", signaler: sigIds(begard), kalla: "tillampning:sortering" }));
    kedja.push(steg({ id: "steg-s2", nummer: "S2", namn: "Vänta på lådan vid utskjutaren", startvillkor: "S1 klart", atgard: bandStopp ? `${ref(bandStopp)} = 1 när lådan står framför utskjutaren` : "–", slutvillkor: "Lådan står framför utskjutaren (hur den detekteras är en öppen fråga)", nasta: "S3", tidsgrans: "", felhantering: "Förlorad produkt: se de obligatoriska posterna.", signaler: sigIds(bandStopp), kalla: "tillampning:sortering" }));
  } else {
    kedja.push(steg({ id: "steg-s1", nummer: "S1", namn: "Vänta på start", startvillkor: "S0 klart", atgard: "–", slutvillkor: "Startvillkor uppfyllt (definieras i steg 3)", nasta: "S2", tidsgrans: "", felhantering: "–", signaler: [], kalla: "tillampning" }));
  }
  const forst = sortering ? 3 : 2;
  kedja.push(steg({ id: `steg-s${forst}`, nummer: `S${forst}`, namn: sortering ? "Skjut ut" : "Rörelse ut", startvillkor: `S${forst - 1} klart`, atgard: `${ref(ut)} = 1${in2 ? `, ${ref(in2)} = 0` : ""}`, slutvillkor: ut2, nasta: `S${forst + 1}`, tidsgrans: `par-steg-s${forst}`, felhantering: "Larm vid tidsgräns; vad rörelsen gör då bestäms i steg 6.", signaler: sigIds(ut, in2, ute), kalla: "tillampning" }));
  kedja.push(steg({ id: `steg-s${forst + 1}`, nummer: `S${forst + 1}`, namn: sortering ? "Återgång" : "Rörelse in", startvillkor: `S${forst} klart`, atgard: `${ref(ut)} = 0${in2 ? `, ${ref(in2)} = 1` : ""}${bandStopp ? `, ${ref(bandStopp)} = 0` : ""}`, slutvillkor: in2v, nasta: "S1", tidsgrans: `par-steg-s${forst + 1}`, felhantering: "Larm vid tidsgräns.", signaler: sigIds(ut, in2, inne, bandStopp), kalla: "tillampning" }));
  return kedja;
}

function larm(p: Omit<Larm, "status" | "andrad" | "ursprung"> & { ursprung?: Larm["ursprung"] }): Larm {
  return { status: "foreslagen", andrad: NU(), ursprung: "stycklista", ...p };
}

/** Larm ur sekvensens tidsgränser och givare, och granskningspunkter för säkerhet. */
export function foreslaLarm(imp: Importerat, signaler: Signal[], kedja: Steg[]): Larm[] {
  const ut: Larm[] = [];
  let n = 0;
  for (const s of kedja.filter((x) => x.tidsgrans)) {
    n++;
    ut.push(larm({
      id: `larm-${s.id}`, nummer: `L${n}`, villkor: `Steg ${s.nummer} aktivt längre än tidsgränsen utan att slutvillkoret (${s.slutvillkor}) uppfylls`,
      funktion: s.namn, operatorstext: `${s.namn}: slutläget nåddes inte i tid`,
      reaktion: "Sekvensen stoppas. Vad utgångarna gör bestäms och skrivs här.", aterstallning: "Kvittering efter åtgärd",
      fortsattDrift: "Från grundläget efter kvittering", typ: "process", signaler: s.signaler, steg: s.id, kalla: s.id,
    }));
  }
  const ute = signaler.find((s) => s.typ === "DI" && s.namn === "Ute");
  const inne = signaler.find((s) => s.typ === "DI" && s.namn === "Inne");
  if (ute && inne) {
    n++;
    ut.push(larm({ id: "larm-givare-bada", nummer: `L${n}`, villkor: `${ute.tagg} och ${inne.tagg} aktiva samtidigt`, funktion: "Lägesavkänning", operatorstext: "Båda ändlägesgivarna aktiva -- givarfel", reaktion: "Sekvensen stoppas", aterstallning: "Kvittering när givarna visar ett läge", fortsattDrift: "Efter kontroll av givarna", typ: "process", signaler: [ute.id, inne.id], steg: "", kalla: `${ute.id}+${inne.id}` }));
  }
  for (const d of signaler.filter((s) => s.tagg.endsWith(".Fel"))) {
    n++;
    ut.push(larm({ id: `larm-${d.id}`, nummer: `L${n}`, villkor: `${d.tagg} = 1`, funktion: "Drivsteg", operatorstext: "Fel i drivsteget", reaktion: "Rörelsen stoppas", aterstallning: "Kvittering i drivsteget och i PLC:n", fortsattDrift: "Efter ny referenskörning om den förlorats", typ: "process", signaler: [d.id], steg: "", kalla: d.id }));
  }
  if (imp.krav.some((k) => k.objekt === "mottagning") || imp.komponenter.length === 0 || imp.krav.some((k) => k.objekt === "transportband")) {
    if (imp.krav.some((k) => k.objekt === "transportband")) {
      n++;
      ut.push(larm({ id: "larm-mottagning", nummer: `L${n}`, villkor: "Mottagningen full eller blockerad (givare saknas i stycklistan -- öppen fråga)", funktion: "Mottagning", operatorstext: "Mottagningen är full", reaktion: "Utsortering pausas; vad som händer med lådor som ska sorteras ut bestäms här", aterstallning: "När mottagningen är tömd", fortsattDrift: "Automatiskt när mottagningen är fri, eller efter kvittering -- bestäms", typ: "process", signaler: [], steg: "", kalla: "kravbild:mottagning", ursprung: "importerad" }));
    }
  }
  // Säkerhet: en granskningspunkt, aldrig logik (planen: SRS-förteckning).
  n++;
  ut.push(larm({
    id: "granskning-sakerhet", nummer: `G1`, villkor: "Säkerhetsfunktioner enligt maskinens riskbedömning (nödstopp, skydd, STO, lasthållning)",
    funktion: "Säkerhet", operatorstext: "", reaktion: "Hanteras i säkerhetskretsen; standard-PLC:n läser bara status",
    aterstallning: "Återställning är inte start (ISO 13850, IEC 60204-1)", fortsattDrift: "Separat startkommando efter återställning",
    typ: "sakerhetsgranskning", signaler: [], steg: "", kalla: "plan:sakerhet", ursprung: "manuell",
  }));
  return ut;
}

function testfall(p: Omit<Testfall, "status" | "andrad" | "faktiskt" | "ansvarig" | "datum" | "utfall">): Testfall {
  return { status: "foreslagen", andrad: NU(), faktiskt: "", ansvarig: "", datum: "", utfall: "ej_utfort", ...p };
}

/** Testplan som FAT/SAT-protokoll (IEC 62381): I/O först, sedan steg, larm och felfall. */
export function foreslaTestfall(signaler: Signal[], kedja: Steg[], larmlista: Larm[]): Testfall[] {
  const ut: Testfall[] = [];
  let n = 0;
  for (const s of signaler.filter((x) => x.typ !== "intern")) {
    n++;
    ut.push(testfall({
      id: `test-io-${s.id}`, nummer: `T${n}`, kravRef: s.kalla, ursprung: "stycklista", kalla: s.id,
      forutsattningar: "Spänning och tryckluft på; maskinen i underhållsläge",
      atgard: s.typ === "DO" ? `Aktivera ${s.tagg} från PLC:n` : `Påverka ${s.tagg} (${s.namn}) på plats`,
      forvantat: s.typ === "DO" ? `${s.mottagare} reagerar; inget annat rör sig` : `${s.tagg} syns i PLC:n med rätt polaritet`,
      metod: "verklig_utrustning", avser: [s.id],
    }));
  }
  for (const st of kedja) {
    n++;
    ut.push(testfall({ id: `test-steg-${st.id}`, nummer: `T${n}`, kravRef: st.kalla, ursprung: "stycklista", kalla: st.id, forutsattningar: `Sekvensen i ${st.startvillkor.toLowerCase()}`, atgard: `Kör steg ${st.nummer} ${st.namn}`, forvantat: st.slutvillkor, metod: "verklig_utrustning", avser: [st.id] }));
  }
  for (const l of larmlista.filter((x) => x.typ === "process")) {
    n++;
    ut.push(testfall({ id: `test-larm-${l.id}`, nummer: `T${n}`, kravRef: l.kalla, ursprung: "stycklista", kalla: l.id, forutsattningar: "Maskinen i drift", atgard: `Framkalla: ${l.villkor}`, forvantat: `Larm ${l.nummer} "${l.operatorstext}"; ${l.reaktion.toLowerCase()}`, metod: "verklig_utrustning", avser: [l.id] }));
  }
  const felfall: Array<[string, string, string]> = [
    ["spanningsbortfall", "Bryt matningsspänningen under rörelse", "Beteendet enligt den obligatoriska posten om spänningsbortfall"],
    ["kommunikationsbortfall", "Bryt kommunikationen till fältenheter", "Beteendet enligt den obligatoriska posten om kommunikationsbortfall"],
    ["forloradProdukt", "Ta bort produkten mitt i sekvensen", "Beteendet enligt den obligatoriska posten om förlorad produkt"],
    ["aterstart", "Återställ efter ett fel", "Ingen rörelse förrän ett separat startkommando ges"],
  ];
  for (const [id, atgard, forvantat] of felfall) {
    n++;
    ut.push(testfall({ id: `test-felfall-${id}`, nummer: `T${n}`, kravRef: `obligatorisk:${id}`, ursprung: "manuell", kalla: `obligatorisk:${id}`, forutsattningar: "Maskinen i automatisk drift", atgard, forvantat, metod: "verklig_utrustning", avser: [] }));
  }
  return ut;
}

/** Lägger till förslag som inte redan finns (samma id). Befintliga poster rörs aldrig. */
export function sammanfoga<T extends { id: string }>(befintliga: T[], forslag: T[]): { lista: T[]; nya: number } {
  const finns = new Set(befintliga.map((x) => x.id));
  const nya = forslag.filter((x) => !finns.has(x.id));
  return { lista: [...befintliga, ...nya], nya: nya.length };
}

/**
 * Ändringar fortplantar sig i en riktning (planen): en signal vars artikel
 * försvunnit eller ändrats blir inaktuell; stegen och larmen som använder den
 * blir inaktuella; testfallen som prövar något inaktuellt blir inaktuella.
 * Manuella poster markeras också -- men raderas aldrig.
 */
export function markeraInaktuella(u: Underlag, andradeSkuer: string[], orsak: string): Underlag {
  if (andradeSkuer.length === 0) return u;
  const andrad = new Set(andradeSkuer);
  const signaler = u.signaler.map((s) => {
    const sku = s.kalla.startsWith("stycklista:") ? s.kalla.split(":")[1] : null;
    return sku && andrad.has(sku) && s.status !== "inaktuell" ? { ...s, status: "inaktuell" as const, inaktuellOrsak: orsak } : s;
  });
  const dodaSignaler = new Set(signaler.filter((s) => s.status === "inaktuell").map((s) => s.id));
  const steg = u.steg.map((s) => s.signaler.some((id) => dodaSignaler.has(id)) && s.status !== "inaktuell" ? { ...s, status: "inaktuell" as const, inaktuellOrsak: orsak } : s);
  const dodaSteg = new Set(steg.filter((s) => s.status === "inaktuell").map((s) => s.id));
  const larm = u.larm.map((l) => (l.signaler.some((id) => dodaSignaler.has(id)) || (l.steg && dodaSteg.has(l.steg))) && l.status !== "inaktuell" ? { ...l, status: "inaktuell" as const, inaktuellOrsak: orsak } : l);
  const dodaLarm = new Set(larm.filter((l) => l.status === "inaktuell").map((l) => l.id));
  const testfall = u.testfall.map((t) => t.avser.some((id) => dodaSignaler.has(id) || dodaSteg.has(id) || dodaLarm.has(id)) && t.status !== "inaktuell" ? { ...t, status: "inaktuell" as const, inaktuellOrsak: orsak } : t);
  return { ...u, signaler, steg, larm, testfall };
}

export interface Signalfel {
  signalId: string;
  kod: "dubbel_tagg" | "dubbel_adress" | "datatyp";
  text: string;
}

/** Kontroller på I/O-listan: unika taggar, inga dubbla adresser, datatyp mot signaltyp. */
export function kontrolleraSignaler(signaler: Signal[]): Signalfel[] {
  const fel: Signalfel[] = [];
  const aktiva = signaler.filter((s) => s.status !== "inaktuell");
  const taggar = new Map<string, string>();
  const adresser = new Map<string, string>();
  for (const s of aktiva) {
    const t = s.tagg.trim().toLowerCase();
    if (t && taggar.has(t)) fel.push({ signalId: s.id, kod: "dubbel_tagg", text: `Taggen ${s.tagg} används två gånger` });
    else if (t) taggar.set(t, s.id);
    const a = s.adress.trim().toLowerCase();
    if (a && adresser.has(a)) fel.push({ signalId: s.id, kod: "dubbel_adress", text: `Adressen ${s.adress} används två gånger` });
    else if (a) adresser.set(a, s.id);
    if ((s.typ === "DI" || s.typ === "DO") && s.datatyp && s.datatyp !== "BOOL") {
      fel.push({ signalId: s.id, kod: "datatyp", text: `${s.tagg}: en digital signal ska vara BOOL, inte ${s.datatyp}` });
    }
    if ((s.typ === "AI" || s.typ === "AO") && s.datatyp === "BOOL") {
      fel.push({ signalId: s.id, kod: "datatyp", text: `${s.tagg}: en analog signal kan inte vara BOOL` });
    }
  }
  return fel;
}

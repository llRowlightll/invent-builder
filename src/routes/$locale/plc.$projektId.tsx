import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { harleddaFragor, saknas, skillnader, type HarleddFraga, type SaknasKod, type Skillnad } from "@/lib/plc/kontroll";
import { importeraKrav, jamforKomponenter, jamforKrav, type KomponentAndring, type KravAndring } from "@/lib/plc/krav";
import {
  hamtaProjekt, hamtaUnderlag, Revisionskonflikt, skapaUnderlag, sparaUnderlag, type ProjektRad,
} from "@/lib/plc/lagring";
import {
  LEVERANSINNEHALL, nyttId, tomtUnderlag,
  type Arbete, type ImporteratKrav, type Leverans, type Leveransinnehall, type Omfattning, type Plattform,
  type PlattformsVal, type TextPost, type Underlag, type UnderlagRad,
} from "@/lib/plc/modell";
import { hittaPlattform, mojligheter, PLATTFORMAR } from "@/lib/plc/plattformar";

/**
 * Ett projekts programmeringsunderlag, i åtta steg (planen "Plan för
 * PLC-modulen"). Fas 1: steg 1 Omfattning och steg 2 Plattform. Steg 3–8
 * syns i stegväljaren men öppnas i senare faser.
 *
 * Varje steg har en egen adress (?steg=2), så att tillbaka-knappen och
 * direktlänkar fungerar. Underlaget sparas när man går vidare eller avslutar,
 * som en ny revision; en sparning som bygger på en gammal revision visar
 * skillnaderna i stället för att skriva över.
 */
export const Route = createFileRoute("/$locale/plc/$projektId")({
  validateSearch: (s: Record<string, unknown>): { steg?: number } => {
    const n = Number(s.steg);
    return Number.isInteger(n) && n >= 1 && n <= 8 ? { steg: n } : {};
  },
  head: () => ({
    meta: [
      { title: "Styrning & programmering — Maskinval" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlcProjekt,
});

type Tx = (sv: string, en: string) => string;

const STEG: Array<{ nr: number; sv: string; en: string; finns: boolean; innehallSv: string; innehallEn: string }> = [
  { nr: 1, sv: "Omfattning", en: "Scope", finns: true, innehallSv: "", innehallEn: "" },
  { nr: 2, sv: "Plattform", en: "Platform", finns: true, innehallSv: "", innehallEn: "" },
  { nr: 3, sv: "Funktion och driftlägen", en: "Function and modes", finns: false,
    innehallSv: "Funktionen med egna ord, start- och slutvillkor och operatörens uppgifter. Driftlägen och tillstånd enligt PackML (ISA-TR88.00.02).",
    innehallEn: "The function in plain words, start and end conditions and the operator's tasks. Modes and states per PackML (ISA-TR88.00.02)." },
  { nr: 4, sv: "Signaler och parametrar", en: "Signals and parameters", finns: false,
    innehallSv: "I/O-listan härleds ur stycklistan, med beteckningar enligt IEC 81346 (t.ex. -BG1, -QM1). Parametrar med enhet och gränser.",
    innehallEn: "The I/O list is derived from the bill of materials, with designations per IEC 81346 (e.g. -BG1, -QM1). Parameters with units and limits." },
  { nr: 5, sv: "Sekvens", en: "Sequence", finns: false,
    innehallSv: "Steg och övergångar som lista och GRAFCET-vy (IEC 60848), med poster för spänningsbortfall, kommunikationsbortfall och återstart.",
    innehallEn: "Steps and transitions as a list and a GRAFCET view (IEC 60848), with entries for power loss, communication loss and restart." },
  { nr: 6, sv: "Larm", en: "Alarms", finns: false,
    innehallSv: "Larm med orsak, konsekvens, åtgärd och tid att agera, prioriterade enligt ISA-18.2.",
    innehallEn: "Alarms with cause, consequence, action and time to respond, prioritised per ISA-18.2." },
  { nr: 7, sv: "Test", en: "Test", finns: false,
    innehallSv: "FAT/SAT-protokoll (IEC 62381): I/O-kontroll per signal, test per sekvenssteg och larmtest. Allt står som Ej utfört tills det provats på riktig utrustning.",
    innehallEn: "FAT/SAT protocol (IEC 62381): I/O check per signal, test per sequence step and alarm test. Everything stays Not performed until tested on real equipment." },
  { nr: 8, sv: "Leverans", en: "Delivery", finns: false,
    innehallSv: "Statustavla, export som Markdown, CSV och JSON, och förfrågan om hjälp av automationsingenjör.",
    innehallEn: "Status board, export as Markdown, CSV and JSON, and a request for help from an automation engineer." },
];

// ── Text för koder ───────────────────────────────────────────────────────────

const KRAVNAMN: Record<string, [string, string]> = {
  massa: ["Last", "Load"],
  slag: ["Slaglängd", "Stroke"],
  hastighet: ["Hastighet", "Speed"],
  noggrannhet: ["Noggrannhet", "Accuracy"],
  kraft: ["Kraft", "Force"],
  vridmoment: ["Vridmoment", "Torque"],
  vinkel: ["Vridvinkel", "Rotation angle"],
  riktning: ["Rörelse", "Motion"],
  drift: ["Drifttid", "Operating time"],
  cykeltid: ["Cykeltid", "Cycle time"],
  takt: ["Takt", "Rate"],
  sakerhet: ["Säkerhet", "Safety"],
  teknik: ["Teknik", "Technology"],
};

const KODVARDEN: Record<string, [string, string]> = {
  lodrat: ["Lodrät, lyft", "Vertical, lifting"],
  sidled: ["Vågrät", "Horizontal"],
  "24_7": ["Dygnet runt (24/7)", "Around the clock (24/7)"],
  damm: ["Damm", "Dust"],
  spolning: ["Spolning och tvätt", "Washdown"],
  livsmedel: ["Livsmedel", "Food"],
  atex: ["Explosionsfarlig miljö (ATEX)", "Explosive atmosphere (ATEX)"],
  utomhus: ["Utomhus", "Outdoors"],
  kyla: ["Kyla", "Cold"],
  varme: ["Värme", "Heat"],
  sakerhetskrav: ["Säkerhetskrav angivna", "Safety requirements stated"],
  elaxel: ["Elektrisk axel", "Electric axis"],
};

const KALLA: Record<ImporteratKrav["kalla"], [string, string]> = {
  beskrivning: ["Beskrivningen", "Description"],
  svar: ["Följdfråga", "Follow-up answer"],
  stycklista: ["Stycklistan", "Bill of materials"],
};

const LEVERANSER: Array<{ id: Leverans; sv: string; en: string; textSv: string; textEn: string }> = [
  { id: "underlag", sv: "Programmeringsunderlag", en: "Programming documentation",
    textSv: "Funktionsbeskrivning, I/O-lista, sekvens, larm, parametrar och testplan till den som programmerar.",
    textEn: "Functional description, I/O list, sequence, alarms, parameters and test plan for whoever programs the machine." },
  { id: "programforslag", sv: "Programförslag (kod)", en: "Program proposal (code)",
    textSv: "Inte tillgängligt ännu: inget styrsystem har ett provat kodstöd.",
    textEn: "Not available yet: no control system has tested code support." },
  { id: "ingenjor", sv: "Hjälp av automationsingenjör", en: "Help from an automation engineer",
    textSv: "Du tar fram underlaget här, och en automationsingenjör programmerar eller granskar. Förfrågan skickas i steg 8.",
    textEn: "You prepare the documentation here, and an automation engineer programs or reviews it. The request is sent in step 8." },
];

const ARBETEN: Array<{ id: Arbete; sv: string; en: string }> = [
  { id: "ny", sv: "Ny programmering", en: "New program" },
  { id: "andring", sv: "Ändring av ett befintligt program", en: "Change to an existing program" },
  { id: "vet_inte", sv: "Vet inte", en: "Don't know" },
];

const INNEHALL: Record<Leveransinnehall, { sv: string; en: string; textSv: string; textEn: string }> = {
  funktionsbeskrivning: { sv: "Funktionsbeskrivning", en: "Functional description", textSv: "Vad maskinen gör, start- och slutvillkor", textEn: "What the machine does, start and end conditions" },
  driftlagen: { sv: "Driftlägen och tillstånd", en: "Modes and states", textSv: "PackML: produktion, underhåll, manuell", textEn: "PackML: production, maintenance, manual" },
  io_lista: { sv: "I/O-lista", en: "I/O list", textSv: "Signaler med beteckningar enligt IEC 81346", textEn: "Signals designated per IEC 81346" },
  parametrar: { sv: "Parametrar", en: "Parameters", textSv: "Tider, lägen och gränser med enhet", textEn: "Times, positions and limits with units" },
  sekvens: { sv: "Sekvens", en: "Sequence", textSv: "Steg och övergångar enligt GRAFCET", textEn: "Steps and transitions per GRAFCET" },
  larm: { sv: "Larmlista", en: "Alarm list", textSv: "Orsak, konsekvens och åtgärd enligt ISA-18.2", textEn: "Cause, consequence and action per ISA-18.2" },
  testplan: { sv: "Testplan", en: "Test plan", textSv: "FAT/SAT-protokoll enligt IEC 62381", textEn: "FAT/SAT protocol per IEC 62381" },
};

const PLATTFORMSVAL: Array<{ id: PlattformsVal; sv: string; en: string }> = [
  { id: "befintlig", sv: "Jag vet vilket styrsystem det blir", en: "I know which control system it will be" },
  { id: "senare", sv: "Bestäms senare", en: "To be decided later" },
  { id: "hjalp", sv: "Jag vill ha hjälp att välja", en: "I want help choosing" },
];

// För en tillverkare utanför registret: IEC 61131-3-språken och de vanligaste bussarna.
const ALLMANNA_SPRAK = ["ST", "LD", "FBD", "SFC"];
const ALLMAN_KOMMUNIKATION = ["PROFINET", "EtherCAT", "EtherNet/IP", "Modbus TCP", "IO-Link"];

const SAKNAS_TEXT: Record<SaknasKod, [string, string]> = {
  leverans: ["Vad som ska levereras", "What is to be delivered"],
  omfattar: ["Vilken station eller vilka axlar som ingår", "Which station or axes are included"],
  arbete: ["Ny programmering eller ändring", "New program or change"],
  andring: ["Vad som ändras, och varför", "What changes, and why"],
  innehall: ["Vad underlaget ska innehålla", "What the documentation should contain"],
  plattformsval: ["Styrsystem", "Control system"],
  tillverkare: ["Tillverkare av styrsystemet", "Control system manufacturer"],
  plcModell: ["PLC-modell", "PLC model"],
  miljo: ["Programmeringsmiljö", "Programming environment"],
};

const HARLEDD_TEXT: Record<HarleddFraga, [string, string]> = {
  arbete_okant: ["Är det en ny programmering eller en ändring av ett befintligt program?", "Is this a new program or a change to an existing one?"],
  plattform_senare: ["Vilket styrsystem blir det? Plattformsexport och kod kräver att det är bestämt.", "Which control system will it be? Platform export and code require it to be decided."],
  plattform_hjalp: ["Vilket styrsystem passar? Välj med hänsyn till fabrikens standard, service och reservdelar.", "Which control system fits? Choose with the plant standard, service and spare parts in mind."],
  plattform_utanfor_registret: ["Styrsystemet finns inte i registret: underlaget tas fram plattformsneutralt.", "The control system is not in the register: the documentation is platform-neutral."],
};

const FALTNAMN: Record<string, [string, string]> = {
  "omfattning.leverans": ["Leverans", "Delivery"],
  "omfattning.omfattar": ["Omfattar", "Covers"],
  "omfattning.arbete": ["Ny eller ändring", "New or change"],
  "omfattning.andring": ["Ändringen", "The change"],
  "omfattning.innehall": ["Innehåll", "Contents"],
  "plattform.val": ["Styrsystem", "Control system"],
  "plattform.tillverkare": ["Tillverkare", "Manufacturer"],
  "plattform.plcModell": ["PLC-modell", "PLC model"],
  "plattform.miljo": ["Programmeringsmiljö", "Programming environment"],
  "plattform.miljoVersion": ["Version", "Version"],
  "plattform.sprak": ["Språk", "Languages"],
  "plattform.kommunikation": ["Kommunikation", "Communication"],
  "plattform.drivsteg": ["Drivsteg", "Drives"],
  "plattform.bibliotek": ["Bibliotek", "Libraries"],
  "plattform.standard": ["Programmeringsstandard", "Programming standard"],
  "plattform.dokumentation": ["Befintlig dokumentation", "Existing documentation"],
  "plattform.kravPaVal": ["Det som styr valet", "What drives the choice"],
  "importerat.kallrevision": ["Kravens revision", "Requirements revision"],
  antaganden: ["Antaganden", "Assumptions"],
  oppnaFragor: ["Öppna frågor", "Open questions"],
};

function kravNamn(id: string, tx: Tx): string {
  if (id.startsWith("miljo_")) return tx("Miljö", "Environment");
  const n = KRAVNAMN[id];
  return n ? tx(n[0], n[1]) : id;
}

function kravVarde(k: { id: string; varde: string }, tx: Tx, locale: string): string {
  const kod = KODVARDEN[k.varde];
  if (kod) return tx(kod[0], kod[1]);
  // Värdena lagras med decimalkomma; på engelska visas decimalpunkt.
  return locale === "sv" ? k.varde : k.varde.replace(/(\d),(\d)/g, "$1.$2");
}

function kodText(v: string, tx: Tx): string {
  const kandaListor: Array<Array<{ id: string; sv: string; en: string }>> = [LEVERANSER, ARBETEN, PLATTFORMSVAL];
  for (const lista of kandaListor) {
    const hit = lista.find((x) => x.id === v);
    if (hit) return tx(hit.sv, hit.en);
  }
  const innehall = INNEHALL[v as Leveransinnehall];
  if (innehall) return tx(innehall.sv, innehall.en);
  const plattform = hittaPlattform(v);
  if (plattform) return plattform.tillverkare;
  if (v === "annan") return tx("Annan", "Other");
  return v;
}

function visaSkillnad(s: Skillnad, tx: Tx): { falt: string; sparad: string; din: string } {
  const namn = FALTNAMN[s.falt];
  const kod = (v: string) => v.split(", ").filter(Boolean).map((x) => kodText(x, tx)).join(", ");
  const tom = tx("(tomt)", "(empty)");
  return { falt: namn ? tx(namn[0], namn[1]) : s.falt, sparad: kod(s.sparad) || tom, din: kod(s.din) || tom };
}

const DRIVSTEG_RE = /drivsteg|servodriv|motorstyrning|frekvensomriktare|servo drive|\bdrive\b/i;
const VENTILTERMINAL_RE = /ventilterminal|valve terminal|\bCPX\b|VTUG|VTEM|\bMPA\b|EX600|AV03|VTSA/i;

type Laddning = "laddar" | "klar" | "saknas" | "fel";
type Sparstatus = "sparat" | "sparar" | "fel";

interface Kravandringar {
  fran: number;
  till: number;
  krav: KravAndring[];
  komponenter: KomponentAndring[];
}

function PlcProjekt() {
  const { locale, projektId } = Route.useParams();
  const { steg: stegParam } = Route.useSearch();
  const steg = stegParam ?? 1;
  const tx: Tx = (sv, en) => (locale === "sv" ? sv : en);
  const { user, loading: authLaddar } = useAuth();
  const navigate = useNavigate();

  const [laddning, setLaddning] = useState<Laddning>("laddar");
  const [projekt, setProjekt] = useState<ProjektRad | null>(null);
  const [rad, setRad] = useState<UnderlagRad | null>(null);
  const [utkast, setUtkast] = useState<Underlag | null>(null);
  const [sparatJson, setSparatJson] = useState("");
  const [sparstatus, setSparstatus] = useState<Sparstatus>("sparat");
  const [konflikt, setKonflikt] = useState<{ rad: UnderlagRad; skillnader: Skillnad[] } | null>(null);
  const [kravandringar, setKravandringar] = useState<Kravandringar | null>(null);
  const [hamtarKrav, setHamtarKrav] = useState(false);
  const [oversiktOppen, setOversiktOppen] = useState(false);
  const rubrikRef = useRef<HTMLHeadingElement>(null);

  const andrat = utkast !== null && JSON.stringify(utkast) !== sparatJson;
  const andratRef = useRef(false);
  andratRef.current = andrat;

  // ── Läs projektet och underlaget; skapa underlaget första gången ──────────
  useEffect(() => {
    if (!user) return;
    let avbruten = false;
    setLaddning("laddar");
    (async () => {
      try {
        const p = await hamtaProjekt(projektId);
        if (!p) { if (!avbruten) setLaddning("saknas"); return; }
        let r = await hamtaUnderlag(projektId);
        if (!r) {
          try {
            r = await skapaUnderlag(projektId, tomtUnderlag(importeraKrav(p)));
          } catch (e) {
            // Två flikar som skapar samtidigt: den ena vinner, den andra läser dess rad.
            r = await hamtaUnderlag(projektId);
            if (!r) throw e;
          }
        }
        if (avbruten) return;
        setProjekt(p);
        setRad(r);
        setUtkast(r.data);
        setSparatJson(JSON.stringify(r.data));
        setLaddning("klar");
      } catch {
        if (!avbruten) setLaddning("fel");
      }
    })();
    return () => { avbruten = true; };
  }, [projektId, user]);

  // Fokus till stegets rubrik när steget byts, för skärmläsare och tangentbord.
  const forstaRendering = useRef(true);
  useEffect(() => {
    if (forstaRendering.current) { forstaRendering.current = false; return; }
    rubrikRef.current?.focus();
  }, [steg]);

  // Osparade ändringar: fråga innan sidan lämnas. Byte av steg inom projektet
  // behåller ändringarna och spärras inte.
  useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (!andratRef.current || current.pathname === next.pathname) return false;
      return !window.confirm(tx("Du har osparade ändringar. Lämna sidan ändå?", "You have unsaved changes. Leave anyway?"));
    },
    enableBeforeUnload: () => andratRef.current,
  });

  function andraOmfattning(del: Partial<Omfattning>) {
    setUtkast((u) => (u ? { ...u, omfattning: { ...u.omfattning, ...del } } : u));
  }
  function andraPlattform(del: Partial<Plattform>) {
    setUtkast((u) => (u ? { ...u, plattform: { ...u.plattform, ...del } } : u));
  }
  function andraLista(lista: "antaganden" | "oppnaFragor", ny: TextPost[]) {
    setUtkast((u) => (u ? { ...u, [lista]: ny } : u));
  }

  /** Sparar en ny revision om något ändrats. Returnerar true när underlaget är sparat. */
  async function spara(): Promise<boolean> {
    if (!rad || !utkast) return false;
    if (!andrat) return true;
    setSparstatus("sparar");
    const data = utkast;
    try {
      const ny = await sparaUnderlag(rad.id, rad.revision, data);
      const json = JSON.stringify(data);
      andratRef.current = false;
      setRad({ ...rad, revision: ny, kallrevision: data.importerat.kallrevision, data });
      setSparatJson(json);
      setKravandringar(null);
      setSparstatus("sparat");
      return true;
    } catch (e) {
      if (e instanceof Revisionskonflikt) {
        const senaste = await hamtaUnderlag(projektId).catch(() => null);
        if (senaste) setKonflikt({ rad: senaste, skillnader: skillnader(senaste.data, data) });
        setSparstatus("sparat");
      } else {
        setSparstatus("fel");
      }
      return false;
    }
  }

  function gaTillSteg(n: number) {
    navigate({ to: "/$locale/plc/$projektId", params: { locale, projektId }, search: { steg: n } });
  }

  async function fortsatt() {
    if (await spara()) gaTillSteg(steg + 1);
  }

  async function sparaOchAvsluta() {
    if (await spara()) navigate({ to: "/$locale/plc", params: { locale } });
  }

  function anvandSparad() {
    if (!konflikt) return;
    setRad(konflikt.rad);
    setUtkast(konflikt.rad.data);
    setSparatJson(JSON.stringify(konflikt.rad.data));
    setKonflikt(null);
  }

  async function sparaMinOvanpa() {
    if (!konflikt || !utkast) return;
    // Bygg vidare på den senaste revisionen; den sparade finns kvar i historiken.
    const bas = konflikt.rad;
    setKonflikt(null);
    setRad(bas);
    setSparstatus("sparar");
    try {
      const ny = await sparaUnderlag(bas.id, bas.revision, utkast);
      andratRef.current = false;
      setRad({ ...bas, revision: ny, kallrevision: utkast.importerat.kallrevision, data: utkast });
      setSparatJson(JSON.stringify(utkast));
      setSparstatus("sparat");
    } catch (e) {
      if (e instanceof Revisionskonflikt) {
        const senaste = await hamtaUnderlag(projektId).catch(() => null);
        if (senaste) setKonflikt({ rad: senaste, skillnader: skillnader(senaste.data, utkast) });
        setSparstatus("sparat");
      } else {
        setSparstatus("fel");
      }
    }
  }

  async function hamtaKravIgen() {
    if (!utkast) return;
    setHamtarKrav(true);
    try {
      const p = await hamtaProjekt(projektId);
      if (!p) return;
      const nytt = importeraKrav(p);
      setProjekt(p);
      setKravandringar({
        fran: utkast.importerat.kallrevision,
        till: nytt.kallrevision,
        krav: jamforKrav(utkast.importerat.krav, nytt.krav),
        komponenter: jamforKomponenter(utkast.importerat.komponenter, nytt.komponenter),
      });
      setUtkast({ ...utkast, importerat: nytt });
    } finally {
      setHamtarKrav(false);
    }
  }

  function visaMaskinprojekt() {
    if (!projekt) return;
    try {
      sessionStorage.setItem("mv_load_project", JSON.stringify({
        id: projekt.id, name: projekt.name, description: projekt.description,
        answers: projekt.answers, bom_lines: projekt.bom_lines, locale: projekt.locale,
      }));
    } catch {
      // sessionStorage kan vara blockerat i privat läge
    }
    navigate({ to: "/$locale/machine-builder", params: { locale } });
  }

  // ── Tillstånd före underlaget ──────────────────────────────────────────────
  if (authLaddar || (user && laddning === "laddar")) {
    return (
      <div className="container-page py-10 max-w-6xl" aria-busy="true">
        <div className="h-8 w-64 bg-muted rounded animate-pulse mb-4" />
        <div className="h-4 w-96 max-w-full bg-muted rounded animate-pulse mb-8" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-page py-20 text-center max-w-xl">
        <h1 className="text-2xl font-semibold text-foreground mb-3">{tx("Styrning & programmering", "Control & programming")}</h1>
        <p className="text-muted-foreground mb-6">{tx("Logga in för att öppna projektets underlag.", "Sign in to open the project's documentation.")}</p>
        <Link
          to="/$locale/login"
          params={{ locale }}
          search={{ redirect: `/${locale}/plc/${projektId}${stegParam ? `?steg=${stegParam}` : ""}` }}
          className="inline-block px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
        >
          {tx("Logga in", "Sign in")}
        </Link>
      </div>
    );
  }

  if (laddning === "saknas" || laddning === "fel" || !projekt || !rad || !utkast) {
    return (
      <div className="container-page py-20 text-center max-w-xl">
        <h1 className="text-xl font-semibold text-foreground mb-3">
          {laddning === "saknas"
            ? tx("Projektet finns inte", "The project does not exist")
            : tx("Underlaget kunde inte öppnas", "The documentation could not be opened")}
        </h1>
        <p className="text-muted-foreground mb-6">
          {laddning === "saknas"
            ? tx("Det kan ha tagits bort, eller tillhöra ett annat konto.", "It may have been deleted, or belong to another account.")
            : tx("Ladda om sidan och försök igen.", "Reload the page and try again.")}
        </p>
        <Link to="/$locale/plc" params={{ locale }} className="text-sm text-info underline">
          {tx("Till Styrning & programmering", "To Control & programming")}
        </Link>
      </div>
    );
  }

  const stegInfo = STEG[steg - 1];
  const kravInaktuella = projekt.revision > utkast.importerat.kallrevision;

  return (
    <div className="container-page py-6 sm:py-8 max-w-6xl">
      {/* ── Sidhuvud ── */}
      <nav aria-label={tx("Brödsmulor", "Breadcrumb")} className="text-xs text-muted-foreground mb-2">
        <Link to="/$locale/plc" params={{ locale }} className="hover:text-info">{tx("Styrning & programmering", "Control & programming")}</Link>
        <span aria-hidden> / </span>
        <span className="text-foreground">{projekt.name}</span>
      </nav>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground break-words">{projekt.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{projekt.typ === "befintlig_maskin" ? tx("Befintlig maskin", "Existing machine") : tx("Från maskinbyggaren", "From the machine builder")}</span>
            <span>{tx("Underlag rev.", "Documentation rev.")} {rad.revision}</span>
            <span>{tx("Krav ur maskinprojektets rev.", "Requirements from machine project rev.")} {utkast.importerat.kallrevision}</span>
          </div>
        </div>
        <p className="text-sm shrink-0" aria-live="polite">
          {sparstatus === "sparar" && <span className="text-muted-foreground">{tx("Sparar …", "Saving …")}</span>}
          {sparstatus === "fel" && (
            <span className="text-destructive">
              {tx("Kunde inte sparas.", "Could not be saved.")}{" "}
              <button type="button" onClick={() => void spara()} className="underline">{tx("Försök igen", "Try again")}</button>
            </span>
          )}
          {sparstatus === "sparat" && (andrat
            ? <span className="text-warning-deep">{tx("Osparade ändringar", "Unsaved changes")}</span>
            : <span className="text-muted-foreground">✓ {tx("Sparat", "Saved")}</span>)}
        </p>
      </div>

      {/* Varningen döljs aldrig: underlaget är ett utkast att granska. */}
      <p className="mt-4 rounded-md border border-warning/40 bg-warning-surface px-3 py-2 text-xs text-warning-deep">
        ⚠️ {tx(
          "Underlag. Inte godkänt för maskindrift. Riskbedömning, säkerhetsfunktioner och validering ligger hos maskintillverkaren.",
          "Documentation only. Not approved for machine operation. Risk assessment, safety functions and validation remain with the machine manufacturer.",
        )}
      </p>

      {konflikt && (
        <KonfliktRuta tx={tx} konflikt={konflikt} onAnvandSparad={anvandSparad} onSparaMin={() => void sparaMinOvanpa()} />
      )}

      {kravInaktuella && !kravandringar && (
        <div role="status" className="mt-4 rounded-lg border border-info/40 bg-info-surface px-4 py-3 text-sm">
          <p className="text-foreground">
            {tx(
              `Maskinprojektet har ändrats sedan kraven hämtades. Kraven här kommer från revision ${utkast.importerat.kallrevision}; projektet är nu på revision ${projekt.revision}.`,
              `The machine project has changed since the requirements were fetched. The requirements here come from revision ${utkast.importerat.kallrevision}; the project is now at revision ${projekt.revision}.`,
            )}
          </p>
          <button
            type="button"
            onClick={() => void hamtaKravIgen()}
            disabled={hamtarKrav}
            className="mt-2 px-3 py-1.5 rounded-md border border-info text-info text-xs font-medium hover:bg-info hover:text-primary-foreground transition disabled:opacity-50"
          >
            {hamtarKrav ? tx("Hämtar …", "Fetching …") : tx("Hämta kraven igen", "Fetch the requirements again")}
          </button>
        </div>
      )}

      {kravandringar && <KravandringRuta tx={tx} locale={locale} andringar={kravandringar} />}

      {/* ── Stegväljare ── */}
      <p className="md:hidden mt-6 text-sm font-medium text-foreground">
        {tx(`Steg ${steg} av 8`, `Step ${steg} of 8`)} · {tx(stegInfo.sv, stegInfo.en)}
      </p>
      <ol className="hidden md:grid grid-cols-8 gap-1 mt-6" aria-label={tx("Steg", "Steps")}>
        {STEG.map((s) => {
          const aktiv = s.nr === steg;
          const innehall = (
            <>
              <span className={`flex items-center justify-center size-6 rounded-full text-[11px] font-semibold ${aktiv ? "bg-primary text-primary-foreground" : s.finns ? "bg-muted text-foreground" : "bg-muted/60 text-muted-foreground"}`}>
                {s.nr}
              </span>
              <span className={`text-[11px] leading-tight text-center ${aktiv ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {tx(s.sv, s.en)}
              </span>
              {!s.finns && <span className="text-[10px] text-muted-foreground/80">{tx("Kommer", "Coming")}</span>}
            </>
          );
          return (
            <li key={s.nr}>
              {s.finns ? (
                <button
                  type="button"
                  onClick={() => gaTillSteg(s.nr)}
                  aria-current={aktiv ? "step" : undefined}
                  className="w-full flex flex-col items-center gap-1 rounded-md px-1 py-2 hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
                >
                  {innehall}
                </button>
              ) : (
                <div aria-disabled="true" aria-current={aktiv ? "step" : undefined} className="w-full flex flex-col items-center gap-1 px-1 py-2 opacity-70">
                  {innehall}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <section className="min-w-0" aria-labelledby="steg-rubrik">
          <h2 id="steg-rubrik" ref={rubrikRef} tabIndex={-1} className="text-lg font-semibold text-foreground focus:outline-none">
            <span className="hidden md:inline">{steg}. </span>{tx(stegInfo.sv, stegInfo.en)}
          </h2>

          {steg === 1 && <StegOmfattning tx={tx} locale={locale} underlag={utkast} kravInaktuella={kravInaktuella} andra={andraOmfattning} />}
          {steg === 2 && <StegPlattform tx={tx} underlag={utkast} andra={andraPlattform} />}
          {steg > 2 && (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-5">
              <p className="text-sm text-foreground">{tx(stegInfo.innehallSv, stegInfo.innehallEn)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {tx(
                  "Steget byggs i nästa fas av modulen. Det du fyller i steg 1 och 2 är sparat och följer med.",
                  "This step is built in the next phase of the module. What you fill in for steps 1 and 2 is saved and carries over.",
                )}
              </p>
            </div>
          )}

          {/* ── Sidfot ── */}
          <div className="mt-8 pt-4 border-t border-border flex flex-wrap items-center gap-2">
            {steg === 1 ? (
              <Link to="/$locale/plc" params={{ locale }} className="flex-1 sm:flex-none text-center px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition">
                {tx("Tillbaka", "Back")}
              </Link>
            ) : (
              <button type="button" onClick={() => gaTillSteg(Math.min(steg - 1, 2))} className="flex-1 sm:flex-none text-center px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition">
                {tx("Tillbaka", "Back")}
              </button>
            )}
            <span className="hidden sm:block flex-1" />
            {steg <= 2 && (
              <button type="button" onClick={() => void sparaOchAvsluta()} disabled={sparstatus === "sparar"} className="flex-1 sm:flex-none px-4 py-2 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50">
                {tx("Spara och avsluta", "Save and exit")}
              </button>
            )}
            {steg === 1 && (
              <button type="button" onClick={() => void fortsatt()} disabled={sparstatus === "sparar"} className="w-full sm:w-auto px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50">
                {tx("Fortsätt", "Continue")}
              </button>
            )}
            {steg === 2 && (
              <button type="button" onClick={() => void spara()} disabled={sparstatus === "sparar" || !andrat} className="w-full sm:w-auto px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50">
                {tx("Spara", "Save")}
              </button>
            )}
          </div>
          {sparstatus === "fel" && (
            <p role="alert" className="mt-2 text-sm text-destructive text-right">
              {tx("Underlaget kunde inte sparas.", "The documentation could not be saved.")}{" "}
              <button type="button" onClick={() => void spara()} className="underline">{tx("Försök igen", "Try again")}</button>
            </p>
          )}
          {steg === 2 && (
            <p className="mt-2 text-xs text-muted-foreground text-right">
              {tx("Steg 3, funktion och driftlägen, öppnas i nästa fas.", "Step 3, function and modes, opens in the next phase.")}
            </p>
          )}
        </section>

        {/* ── Projektöversikt ── */}
        <aside className="lg:sticky lg:top-20 rounded-xl border border-border bg-card" aria-labelledby="oversikt-rubrik">
          <button
            type="button"
            onClick={() => setOversiktOppen((o) => !o)}
            aria-expanded={oversiktOppen}
            aria-controls="oversikt-innehall"
            className="lg:hidden w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
          >
            <span>{tx("Projektöversikt", "Project overview")}</span>
            <span aria-hidden>{oversiktOppen ? "▴" : "▾"}</span>
          </button>
          <h2 id="oversikt-rubrik" className="hidden lg:block px-4 pt-4 text-sm font-semibold text-foreground">{tx("Projektöversikt", "Project overview")}</h2>
          <div id="oversikt-innehall" className={`${oversiktOppen ? "block" : "hidden"} lg:block px-4 pb-4`}>
            <Projektoversikt
              tx={tx}
              locale={locale}
              projekt={projekt}
              underlag={utkast}
              onVisaMaskinprojekt={visaMaskinprojekt}
              andraLista={andraLista}
              gaTillSteg={gaTillSteg}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Steg 1: Omfattning ──────────────────────────────────────────────────────

function VarforBehovs({ tx, sv, en }: { tx: Tx; sv: string; en: string }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-info hover:underline w-fit">{tx("Varför behöver vi detta?", "Why do we need this?")}</summary>
      <p className="mt-2 text-muted-foreground max-w-prose">{tx(sv, en)}</p>
    </details>
  );
}

function StegOmfattning({ tx, locale, underlag, kravInaktuella, andra }: {
  tx: Tx; locale: string; underlag: Underlag; kravInaktuella: boolean; andra: (d: Partial<Omfattning>) => void;
}) {
  const o = underlag.omfattning;
  const kodFinns = PLATTFORMAR.some((p) => p.kodgenerering);
  const krav = underlag.importerat.krav;

  return (
    <div className="mt-2 space-y-8">
      <VarforBehovs
        tx={tx}
        sv="Omfattningen avgör vad underlaget ska innehålla och vem som tar det vidare. En ändring av ett befintligt program beskrivs som ett ändringsärende: vad som ändras och varför, så att den som programmerar kan bedöma vad mer som påverkas."
        en="The scope decides what the documentation contains and who takes it further. A change to an existing program is described as a change request: what changes and why, so that whoever programs it can judge what else is affected."
      />

      {/* Importerade krav */}
      <section aria-labelledby="krav-rubrik">
        <h3 id="krav-rubrik" className="text-sm font-semibold text-foreground">{tx("Krav från maskinprojektet", "Requirements from the machine project")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {tx(
            `Hämtade ur revision ${underlag.importerat.kallrevision}, med ursprung. De ändras i maskinprojektet, inte här.`,
            `Fetched from revision ${underlag.importerat.kallrevision}, with their origin. They are changed in the machine project, not here.`,
          )}
          {kravInaktuella && <span className="text-warning-deep"> {tx("Projektet har ändrats sedan dess.", "The project has changed since.")}</span>}
        </p>
        {krav.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {tx(
              "Inga mått, laster eller miljökrav kunde läsas ur projektet. Beskriv dem i steg 3, eller lägg till dem som antaganden i översikten.",
              "No dimensions, loads or environmental requirements could be read from the project. Describe them in step 3, or add them as assumptions in the overview.",
            )}
          </p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="sr-only sm:not-sr-only">
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th scope="col" className="py-1.5 pr-3 font-medium">{tx("Krav", "Requirement")}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{tx("Värde", "Value")}</th>
                <th scope="col" className="py-1.5 font-medium">{tx("Ursprung", "Origin")}</th>
              </tr>
            </thead>
            <tbody>
              {krav.map((k) => (
                <tr key={k.id} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted-foreground">{kravNamn(k.id, tx)}</th>
                  <td className="py-1.5 pr-3 text-foreground font-medium">{kravVarde(k, tx, locale)}</td>
                  <td className="py-1.5 text-xs text-muted-foreground">
                    {tx(KALLA[k.kalla][0], KALLA[k.kalla][1])} · rev. {underlag.importerat.kallrevision}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Leverans */}
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">{tx("Vad ska levereras?", "What is to be delivered?")}</legend>
        <div className="mt-2 grid sm:grid-cols-3 gap-2">
          {LEVERANSER.map((l) => {
            const sparrad = l.id === "programforslag" && !kodFinns;
            const vald = o.leverans === l.id;
            return (
              <label
                key={l.id}
                className={`relative flex flex-col gap-1 rounded-lg border p-3 text-sm transition ${sparrad ? "border-border bg-muted/30 opacity-70 cursor-not-allowed" : vald ? "border-info bg-info/5 cursor-pointer" : "border-border bg-card hover:border-info/60 cursor-pointer"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="leverans"
                    value={l.id}
                    checked={vald}
                    disabled={sparrad}
                    onChange={() => andra({ leverans: l.id })}
                    className="accent-info"
                  />
                  <span className="font-medium text-foreground">{tx(l.sv, l.en)}</span>
                </span>
                <span className="text-xs text-muted-foreground">{tx(l.textSv, l.textEn)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Omfattar */}
      <div>
        <label htmlFor="omfattar" className="block text-sm font-semibold text-foreground">{tx("Vad omfattas?", "What is covered?")}</label>
        <p id="omfattar-hjalp" className="text-xs text-muted-foreground mt-0.5">{tx("Station, axlar eller delar av maskinen, med era egna namn.", "Station, axes or parts of the machine, in your own names.")}</p>
        <input
          id="omfattar"
          value={o.omfattar}
          onChange={(e) => andra({ omfattar: e.target.value })}
          aria-describedby="omfattar-hjalp"
          maxLength={500}
          placeholder={tx("t.ex. Station 2: lyftaxel och gripdon", "e.g. Station 2: lifting axis and gripper")}
          className="mt-2 w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
        />
      </div>

      {/* Ny eller ändring */}
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">{tx("Ny programmering eller ändring?", "New program or change?")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ARBETEN.map((a) => (
            <label key={a.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition ${o.arbete === a.id ? "border-info bg-info/5" : "border-border hover:border-info/60"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info`}>
              <input type="radio" name="arbete" value={a.id} checked={o.arbete === a.id} onChange={() => andra({ arbete: a.id })} className="accent-info" />
              {tx(a.sv, a.en)}
            </label>
          ))}
        </div>
        {o.arbete === "andring" && (
          <div className="mt-3">
            <label htmlFor="andring" className="block text-sm font-medium text-foreground">{tx("Vad ändras, och varför?", "What changes, and why?")}</label>
            <textarea
              id="andring"
              rows={3}
              value={o.andring}
              onChange={(e) => andra({ andring: e.target.value })}
              maxLength={4000}
              placeholder={tx("t.ex. Ny stoppstation före lyftet, eftersom detaljer ibland kommer snett", "e.g. A new stop station before the lift, because parts sometimes arrive skewed")}
              className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
            />
          </div>
        )}
      </fieldset>

      {/* Innehåll */}
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">{tx("Vad ska underlaget innehålla?", "What should the documentation contain?")}</legend>
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          {LEVERANSINNEHALL.map((id) => {
            const i = INNEHALL[id];
            const vald = o.innehall.includes(id);
            return (
              <label key={id} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition ${vald ? "border-info bg-info/5" : "border-border hover:border-info/60"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info`}>
                <input
                  type="checkbox"
                  checked={vald}
                  onChange={() => andra({ innehall: vald ? o.innehall.filter((x) => x !== id) : LEVERANSINNEHALL.filter((x) => x === id || o.innehall.includes(x)) })}
                  className="mt-0.5 accent-info"
                />
                <span>
                  <span className="block text-foreground">{tx(i.sv, i.en)}</span>
                  <span className="block text-xs text-muted-foreground">{tx(i.textSv, i.textEn)}</span>
                </span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => andra({ innehall: o.innehall.length === LEVERANSINNEHALL.length ? [] : [...LEVERANSINNEHALL] })}
          className="mt-2 text-xs text-info hover:underline"
        >
          {o.innehall.length === LEVERANSINNEHALL.length ? tx("Avmarkera alla", "Clear all") : tx("Välj alla", "Select all")}
        </button>
      </fieldset>
    </div>
  );
}

// ── Steg 2: Plattform ───────────────────────────────────────────────────────

function Kryssgrupp({ id, rubrik, alternativ, valda, onChange }: {
  id: string; rubrik: string; alternativ: string[]; valda: string[]; onChange: (v: string[]) => void;
}) {
  // Värden som sparats men inte finns bland alternativen (annan tillverkare tidigare) visas också.
  const alla = [...alternativ, ...valda.filter((v) => !alternativ.includes(v))];
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-foreground">{rubrik}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {alla.map((a) => {
          const vald = valda.includes(a);
          return (
            <label key={a} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer transition ${vald ? "border-info bg-info/5" : "border-border hover:border-info/60"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info`}>
              <input
                type="checkbox"
                name={id}
                checked={vald}
                onChange={() => onChange(vald ? valda.filter((x) => x !== a) : [...valda, a])}
                className="accent-info"
              />
              {a}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Textfalt({ id, etikett, hjalp, value, onChange, placeholder, flerrader, lista }: {
  id: string; etikett: string; hjalp?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; flerrader?: boolean; lista?: string[];
}) {
  const klass = "mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50";
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{etikett}</label>
      {hjalp && <p id={`${id}-hjalp`} className="text-xs text-muted-foreground mt-0.5">{hjalp}</p>}
      {flerrader ? (
        <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          aria-describedby={hjalp ? `${id}-hjalp` : undefined} maxLength={4000} className={klass} />
      ) : (
        <>
          <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            aria-describedby={hjalp ? `${id}-hjalp` : undefined} maxLength={300} list={lista?.length ? `${id}-lista` : undefined} className={klass} />
          {lista?.length ? (
            <datalist id={`${id}-lista`}>{lista.map((v) => <option key={v} value={v} />)}</datalist>
          ) : null}
        </>
      )}
    </div>
  );
}

function StegPlattform({ tx, underlag, andra }: { tx: Tx; underlag: Underlag; andra: (d: Partial<Plattform>) => void }) {
  const p = underlag.plattform;
  const kand = hittaPlattform(p.tillverkare);
  const formaga = p.tillverkare ? mojligheter(p.tillverkare) : null;
  const drivsteg = underlag.importerat.komponenter.filter((k) => DRIVSTEG_RE.test(`${k.roll} ${k.namn ?? ""}`));
  const ventilterminaler = underlag.importerat.komponenter.filter((k) => VENTILTERMINAL_RE.test(`${k.roll} ${k.namn ?? ""}`));
  const drivstegForslag = drivsteg.map((k) => k.namn ?? k.sku).join(", ");

  function valjTillverkare(id: string) {
    const ny = hittaPlattform(id);
    const gammal = hittaPlattform(p.tillverkare);
    // Programmeringsmiljön som registret fyllde i för förra tillverkaren byts
    // mot den nyas, eller töms när den nya inte finns i registret. En miljö som
    // kunden skrivit själv står kvar.
    const ifylldAvRegistret = !p.miljo || p.miljo === gammal?.miljo;
    andra({
      tillverkare: id,
      miljo: ifylldAvRegistret ? (ny?.miljo ?? "") : p.miljo,
      // Språk och bussar som inte finns hos den nya tillverkaren tas bort.
      sprak: ny ? p.sprak.filter((s) => ny.sprak.includes(s)) : p.sprak,
      kommunikation: ny ? p.kommunikation.filter((k) => ny.kommunikation.includes(k)) : p.kommunikation,
    });
  }

  return (
    <div className="mt-2 space-y-8">
      <VarforBehovs
        tx={tx}
        sv="PLC:n, programmeringsmiljön och språket avgör adressformat, taggnamn och vilka exportformat som är möjliga. Underlaget går alltid att ta fram; plattformsexport och programförslag kräver en känd plattform med ett provat stöd."
        en="The PLC, the programming environment and the language decide the address format, tag names and which export formats are possible. The documentation can always be produced; platform export and program proposals require a known platform with tested support."
      />

      <fieldset>
        <legend className="text-sm font-semibold text-foreground">{tx("Styrsystem", "Control system")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLATTFORMSVAL.map((v) => (
            <label key={v.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition ${p.val === v.id ? "border-info bg-info/5" : "border-border hover:border-info/60"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info`}>
              <input type="radio" name="plattformsval" value={v.id} checked={p.val === v.id} onChange={() => andra({ val: v.id })} className="accent-info" />
              {tx(v.sv, v.en)}
            </label>
          ))}
        </div>
      </fieldset>

      {(p.val === "senare" || p.val === "hjalp") && (
        <div className="space-y-4">
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {tx(
              "Underlaget tas fram plattformsneutralt, med begrepp enligt IEC 61131-3. Plattformsexport och programförslag kräver att styrsystemet är valt.",
              "The documentation is produced platform-neutral, with IEC 61131-3 terms. Platform export and program proposals require the control system to be chosen.",
            )}
          </p>
          <Textfalt
            id="krav-pa-val"
            etikett={tx("Vad styr valet?", "What drives the choice?")}
            hjalp={tx("Fabrikens standard, service, reservdelar, kundens krav.", "Plant standard, service, spare parts, customer requirements.")}
            value={p.kravPaVal}
            onChange={(v) => andra({ kravPaVal: v })}
            placeholder={tx("t.ex. Fabriken kör Siemens; servicen ska kunna göras av egen personal", "e.g. The plant runs Siemens; service must be possible by our own staff")}
            flerrader
          />
        </div>
      )}

      {p.val === "befintlig" && (
        <div className="space-y-5">
          <div>
            <label htmlFor="tillverkare" className="block text-sm font-medium text-foreground">{tx("Tillverkare", "Manufacturer")}</label>
            <select
              id="tillverkare"
              value={p.tillverkare}
              onChange={(e) => valjTillverkare(e.target.value)}
              className="mt-1 w-full sm:w-80 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
            >
              <option value="">{tx("Välj …", "Choose …")}</option>
              {PLATTFORMAR.map((pl) => <option key={pl.id} value={pl.id}>{pl.tillverkare}</option>)}
              <option value="annan">{tx("Annan", "Other")}</option>
            </select>
          </div>

          {formaga && <Formagaruta tx={tx} formaga={formaga} miljo={kand?.miljo ?? p.miljo} />}

          <div className="grid sm:grid-cols-2 gap-4">
            <Textfalt id="plc-modell" etikett={tx("PLC-modell", "PLC model")} value={p.plcModell} onChange={(v) => andra({ plcModell: v })}
              placeholder={kand ? `t.ex. ${kand.plcExempel[0]}` : ""} lista={kand?.plcExempel} />
            <Textfalt id="miljo" etikett={tx("Programmeringsmiljö", "Programming environment")} value={p.miljo} onChange={(v) => andra({ miljo: v })}
              placeholder={kand?.miljo ?? ""} />
            <Textfalt id="miljo-version" etikett={tx("Version av miljön", "Environment version")} value={p.miljoVersion} onChange={(v) => andra({ miljoVersion: v })}
              placeholder={p.tillverkare === "siemens" ? tx("t.ex. V19", "e.g. V19") : ""} />
          </div>

          <Kryssgrupp id="sprak" rubrik={tx("Språk", "Languages")} alternativ={kand?.sprak ?? ALLMANNA_SPRAK} valda={p.sprak} onChange={(v) => andra({ sprak: v })} />
          <Kryssgrupp id="kommunikation" rubrik={tx("Kommunikation", "Communication")} alternativ={kand?.kommunikation ?? ALLMAN_KOMMUNIKATION} valda={p.kommunikation} onChange={(v) => andra({ kommunikation: v })} />

          <div>
            <Textfalt id="drivsteg" etikett={tx("Drivsteg och motorstyrningar", "Drives and motor controllers")} value={p.drivsteg} onChange={(v) => andra({ drivsteg: v })}
              placeholder={tx("t.ex. Festo CMMT-AS, Siemens Sinamics S210", "e.g. Festo CMMT-AS, Siemens Sinamics S210")} />
            {drivsteg.length > 0 && p.drivsteg !== drivstegForslag && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {tx("Stycklistan har:", "The bill of materials has:")} {drivstegForslag}.{" "}
                <button type="button" onClick={() => andra({ drivsteg: drivstegForslag })} className="text-info underline">{tx("Använd", "Use")}</button>
                {" "}{tx("Kontrollera att drivstegets fältbussgränssnitt passar PLC:n.", "Check that the drive's fieldbus interface matches the PLC.")}
              </p>
            )}
            {ventilterminaler.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {tx("Ventilterminal i stycklistan:", "Valve terminal in the bill of materials:")} {ventilterminaler.map((k) => k.namn ?? k.sku).join(", ")}.{" "}
                {tx("Dess bussnod ska passa PLC:ns kommunikation.", "Its bus node must match the PLC's communication.")}
              </p>
            )}
          </div>

          <Textfalt id="bibliotek" etikett={tx("Bibliotek", "Libraries")} value={p.bibliotek} onChange={(v) => andra({ bibliotek: v })}
            hjalp={tx("Bibliotek som ska användas, t.ex. företagets standardbibliotek eller tillverkarens rörelsebibliotek.", "Libraries to use, e.g. the company standard library or the manufacturer's motion library.")} />
          <Textfalt id="standard" etikett={tx("Programmeringsstandard", "Programming standard")} value={p.standard} onChange={(v) => andra({ standard: v })}
            hjalp={tx("Företagets namnregler och struktur, om sådana finns.", "The company's naming rules and structure, if any.")} flerrader />
        </div>
      )}

      {p.val && (
        <Textfalt
          id="dokumentation"
          etikett={tx("Befintlig dokumentation", "Existing documentation")}
          hjalp={tx(
            "Elritning, I/O-lista, tidigare program. Beskriv vad som finns; uppladdning av filer kommer i en senare fas.",
            "Wiring diagram, I/O list, earlier programs. Describe what exists; file upload comes in a later phase.",
          )}
          value={p.dokumentation}
          onChange={(v) => andra({ dokumentation: v })}
          flerrader
        />
      )}
    </div>
  );
}

function Formagaruta({ tx, formaga, miljo }: { tx: Tx; formaga: ReturnType<typeof mojligheter>; miljo: string }) {
  const okand = formaga.orsak === "okand_plattform";
  const rader: Array<{ ja: boolean; namn: string; text: string }> = [
    { ja: true, namn: tx("Programmeringsunderlag", "Programming documentation"), text: tx("Tas fram oavsett plattform.", "Produced for any platform.") },
    {
      ja: formaga.plattformsexport,
      namn: tx("Plattformsexport av taggar", "Platform tag export"),
      text: okand
        ? tx("Plattformen finns inte i registret.", "The platform is not in the register.")
        : tx(`Inget exportformat är provat i ${miljo} ännu.`, `No export format has been tested in ${miljo} yet.`),
    },
    {
      ja: formaga.kod,
      namn: tx("Programförslag (kod)", "Program proposal (code)"),
      text: okand
        ? tx("Kräver en känd plattform.", "Requires a known platform.")
        : tx("Ingen provad kodgenerator finns.", "No tested code generator exists."),
    },
  ];
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold text-foreground mb-2">{tx("Vad Maskinval kan ta fram för det här styrsystemet", "What Maskinval can produce for this control system")}</p>
      <ul className="space-y-1">
        {rader.map((r) => (
          <li key={r.namn} className="flex gap-2 text-sm">
            <span aria-hidden className={r.ja ? "text-success-deep" : "text-muted-foreground"}>{r.ja ? "✓" : "–"}</span>
            <span>
              <span className="text-foreground">{r.namn}</span>
              <span className="sr-only">{r.ja ? tx(": ja", ": yes") : tx(": nej", ": no")}</span>
              <span className="text-muted-foreground"> — {r.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Projektöversikt ─────────────────────────────────────────────────────────

function Projektoversikt({ tx, locale, projekt, underlag, onVisaMaskinprojekt, andraLista, gaTillSteg }: {
  tx: Tx; locale: string; projekt: ProjektRad; underlag: Underlag;
  onVisaMaskinprojekt: () => void;
  andraLista: (lista: "antaganden" | "oppnaFragor", ny: TextPost[]) => void;
  gaTillSteg: (n: number) => void;
}) {
  const luckor = saknas(underlag);
  const harledda = harleddaFragor(underlag);
  const komponenter = underlag.importerat.komponenter;
  const rubrik = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-5 text-sm pt-2">
      <section>
        <h3 className={rubrik}>{tx("Krav", "Requirements")} ({underlag.importerat.krav.length})</h3>
        {underlag.importerat.krav.length === 0 ? (
          <p className="mt-1 text-muted-foreground">{tx("Inga hämtade krav.", "No fetched requirements.")}</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {underlag.importerat.krav.map((k) => (
              <li key={k.id} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{kravNamn(k.id, tx)}</span>
                <span className="text-foreground text-right">{kravVarde(k, tx, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={rubrik}>{tx("Komponenter", "Components")} ({komponenter.length})</h3>
        {komponenter.length === 0 ? (
          <p className="mt-1 text-muted-foreground">
            {projekt.typ === "befintlig_maskin"
              ? tx("Befintlig maskin: ingen stycklista. Signalerna läggs in i steg 4.", "Existing machine: no bill of materials. Signals are entered in step 4.")
              : tx("Stycklistan är tom.", "The bill of materials is empty.")}
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {komponenter.map((k, i) => (
              <li key={`${k.sku}-${i}`} className="leading-snug">
                <span className="text-muted-foreground">{k.antal}×</span>{" "}
                <span className="text-foreground">{k.roll}</span>
                {k.sku === "SPECIFY"
                  ? <span className="block text-xs text-warning-deep">{tx("Att specificera", "To be specified")}</span>
                  : <span className="block text-xs font-mono text-muted-foreground break-all">{k.sku}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={rubrik}>{tx("Saknas", "Missing")} ({luckor.length})</h3>
        {luckor.length === 0 ? (
          <p className="mt-1 text-muted-foreground">{tx("Steg 1 och 2 är ifyllda.", "Steps 1 and 2 are filled in.")}</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {luckor.map((l) => (
              <li key={l.kod}>
                <button type="button" onClick={() => gaTillSteg(l.steg)} className="text-left text-foreground hover:text-info hover:underline">
                  {tx(SAKNAS_TEXT[l.kod][0], SAKNAS_TEXT[l.kod][1])}
                </button>
                <span className="text-xs text-muted-foreground"> · {tx("steg", "step")} {l.steg}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={rubrik}>{tx("Konflikter", "Conflicts")}</h3>
        <p className="mt-1 text-muted-foreground">{tx("Kontrolleras från steg 4, när signalerna finns.", "Checked from step 4, once the signals exist.")}</p>
      </section>

      <Postlista
        tx={tx}
        rubrik={tx("Öppna frågor", "Open questions")}
        harledda={harledda.map((h) => tx(HARLEDD_TEXT[h][0], HARLEDD_TEXT[h][1]))}
        poster={underlag.oppnaFragor}
        prefix="fraga"
        etikett={tx("Ny öppen fråga", "New open question")}
        onChange={(ny) => andraLista("oppnaFragor", ny)}
      />
      <Postlista
        tx={tx}
        rubrik={tx("Antaganden", "Assumptions")}
        harledda={[]}
        poster={underlag.antaganden}
        prefix="antagande"
        etikett={tx("Nytt antagande", "New assumption")}
        onChange={(ny) => andraLista("antaganden", ny)}
      />

      <section className="pt-3 border-t border-border">
        {projekt.typ === "maskinbyggare" ? (
          <button type="button" onClick={onVisaMaskinprojekt} className="text-info hover:underline">
            {tx("Visa maskinprojektet", "Show the machine project")} →
          </button>
        ) : projekt.description ? (
          <>
            <h3 className={rubrik}>{tx("Beskrivning", "Description")}</h3>
            <p className="mt-1 text-muted-foreground whitespace-pre-line">{projekt.description}</p>
          </>
        ) : null}
      </section>
    </div>
  );
}

function Postlista({ tx, rubrik, harledda, poster, prefix, etikett, onChange }: {
  tx: Tx; rubrik: string; harledda: string[]; poster: TextPost[]; prefix: string; etikett: string;
  onChange: (ny: TextPost[]) => void;
}) {
  const [text, setText] = useState("");
  const id = `ny-${prefix}`;
  function laggTill(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onChange([...poster, { id: nyttId(prefix), text: t, ursprung: "manuell", status: "bekraftad", andrad: new Date().toISOString() }]);
    setText("");
  }
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rubrik} ({harledda.length + poster.length})</h3>
      <ul className="mt-1 space-y-1">
        {harledda.map((h) => <li key={h} className="text-foreground">{h}</li>)}
        {poster.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-2">
            <span className="text-foreground break-words min-w-0">{p.text}</span>
            <button
              type="button"
              onClick={() => onChange(poster.filter((x) => x.id !== p.id))}
              aria-label={`${tx("Ta bort", "Remove")}: ${p.text}`}
              className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={laggTill} className="mt-2 flex gap-1.5">
        <label htmlFor={id} className="sr-only">{etikett}</label>
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={etikett}
          maxLength={1000}
          className="min-w-0 flex-1 px-2 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-info/50"
        />
        <button type="submit" disabled={!text.trim()} className="px-2.5 py-1.5 rounded-md border border-border text-xs hover:border-info hover:text-info transition disabled:opacity-40">
          {tx("Lägg till", "Add")}
        </button>
      </form>
    </section>
  );
}

// ── Konflikt och ändrade krav ───────────────────────────────────────────────

function KonfliktRuta({ tx, konflikt, onAnvandSparad, onSparaMin }: {
  tx: Tx; konflikt: { rad: UnderlagRad; skillnader: Skillnad[] }; onAnvandSparad: () => void; onSparaMin: () => void;
}) {
  // Sparknapparna sitter längst ned; utan det här märker den som sparade
  // inte att något hände. Rutan rullas fram och får fokus.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    ref.current?.focus({ preventScroll: true });
  }, [konflikt.rad.revision]);
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm focus:outline-none">
      <p className="font-medium text-foreground">
        {tx(
          `Underlaget har sparats i ett annat fönster eller av någon annan (revision ${konflikt.rad.revision}). Dina ändringar är inte sparade.`,
          `The documentation was saved in another window or by someone else (revision ${konflikt.rad.revision}). Your changes are not saved.`,
        )}
      </p>
      {konflikt.skillnader.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th scope="col" className="py-1 pr-3 font-medium">{tx("Fält", "Field")}</th>
                <th scope="col" className="py-1 pr-3 font-medium">{tx("Sparad version", "Saved version")}</th>
                <th scope="col" className="py-1 font-medium">{tx("Din version", "Your version")}</th>
              </tr>
            </thead>
            <tbody>
              {konflikt.skillnader.map((s) => {
                const v = visaSkillnad(s, tx);
                return (
                  <tr key={s.falt} className="border-b border-border/60 last:border-0 align-top">
                    <th scope="row" className="py-1 pr-3 text-left font-normal text-muted-foreground">{v.falt}</th>
                    <td className="py-1 pr-3 text-foreground break-words">{v.sparad}</td>
                    <td className="py-1 text-foreground break-words">{v.din}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onAnvandSparad} className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:border-foreground/40 transition">
          {tx("Använd den sparade versionen", "Use the saved version")}
        </button>
        <button type="button" onClick={onSparaMin} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition">
          {tx("Spara min version ovanpå", "Save my version on top")}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {tx("Ingen version försvinner: varje sparad revision finns kvar i historiken.", "No version is lost: every saved revision remains in the history.")}
      </p>
    </div>
  );
}

function KravandringRuta({ tx, locale, andringar }: { tx: Tx; locale: string; andringar: Kravandringar }) {
  const inga = andringar.krav.length === 0 && andringar.komponenter.length === 0;
  const v = (id: string, varde: string | null) => (varde === null ? "—" : kravVarde({ id, varde }, tx, locale));
  return (
    <div role="status" className="mt-4 rounded-lg border border-info/40 bg-info-surface px-4 py-3 text-sm">
      <p className="font-medium text-foreground">
        {tx(
          `Kraven är hämtade ur revision ${andringar.till} (förut revision ${andringar.fran}). Spara för att behålla dem.`,
          `The requirements are fetched from revision ${andringar.till} (previously revision ${andringar.fran}). Save to keep them.`,
        )}
      </p>
      {inga ? (
        <p className="mt-1 text-muted-foreground">{tx("Inga krav eller komponenter har ändrats.", "No requirements or components have changed.")}</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {andringar.krav.map((a) => (
            <li key={a.id}>
              <span className="text-muted-foreground">{kravNamn(a.id, tx)}:</span>{" "}
              <span className="line-through text-muted-foreground">{v(a.id, a.fore)}</span>{" → "}
              <span className="text-foreground font-medium">{v(a.id, a.efter)}</span>
            </li>
          ))}
          {andringar.komponenter.map((k) => (
            <li key={`${k.sku}-${k.roll}`}>
              <span className="text-muted-foreground">{k.roll}</span>{" "}
              <span className="font-mono text-xs">{k.sku}</span>:{" "}
              {k.fore === null
                ? tx(`ny, ${k.efter} st`, `new, ${k.efter} pcs`)
                : k.efter === null
                  ? tx("borttagen", "removed")
                  : tx(`${k.fore} → ${k.efter} st`, `${k.fore} → ${k.efter} pcs`)}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {tx("Det du fyllt i själv i steg 1 och 2 påverkas inte.", "What you filled in yourself in steps 1 and 2 is not affected.")}
      </p>
    </div>
  );
}

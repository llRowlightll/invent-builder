import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Machine3DSceneProps } from "@/components/Machine3DScene";
const Machine3DScene = lazy(() =>
  import("@/components/Machine3DScene").then(m => ({ default: m.Machine3DScene }))
);
import { makeT, type Locale } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog";
import { produktnamn } from "@/lib/spec-format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { ProductRow } from "@/lib/types";
import { callAdvisor } from "@/lib/advisor-client";
import { saveBomNormalized, loadBomNormalized } from "@/lib/bom-store";
import { usableForceN, LOAD_SAFETY_FACTOR } from "@/lib/physics";
import { Award, Camera, Cpu, Lock, Package, RefreshCw, Ruler, Save, Settings } from "lucide-react";
import { getProductImage } from "@/lib/product-images";
import { Tolkningspanel } from "@/components/maskin/Tolkningspanel";
import { Resultatstatus, type ResultatData } from "@/components/maskin/Resultatstatus";
import { delaSvar } from "../../../supabase/functions/groq-advisor/kravbild.ts";
import { logga } from "@/lib/matning";
import { Stegnavigering, type StegTillstand } from "@/components/design/Stegnavigering";
import { Projektpanel, type Sparstatus } from "@/components/design/Projektpanel";
import { byggProjektoversikt } from "@/lib/design/projektoversikt";
import { Statusmarke, Statusprick } from "@/components/design/Statusmarke";
import { ALLVAR, allvarligast, radensText, radensTillstand, radStatus, utfalletsText, utfalletsTillstand, type Tillstand } from "@/lib/design/status";
import { categoryName } from "@/lib/categories";

/** Namnet på sidans språk för rader som kan sakna katalogprodukt. */
const visatNamn = (p: ProductRow | null | undefined, locale: string) => (p ? produktnamn(p, locale) : undefined);

export const Route = createFileRoute("/$locale/machine-builder")({
  head: ({ params }) => {
    const t = makeT(params.locale as Locale);
    return {
      meta: [
        { title: `${t("nav.machineBuilder")} — ${t("common.appName")}` },
        { name: "description", content: t("machineBuilder.metaDesc") },
      ],
    };
  },
  component: MachineBuilderPage,
});


// ── Types ──────────────────────────────────────────────────────────────────
interface Question {
  id: string;
  label: string;
  hint?: string;
  /** "Varför behöver vi detta?": vilket beslut svaret påverkar. */
  varfor?: string;
  type: "choice" | "number";
  options?: string[];
  unit?: string;
}

interface ActuatorOption {
  sku: string;
  name: string;
  badge: string;
  bore_mm?: number;
  stroke_mm?: number;
  force_n?: number;
  /** Vridenheter. force_n bar tidigare vridmomentet i Nm — ett fält som heter
   *  newton med newtonmeter i sig. Nu har de egna fält med rätt enhet. */
  torque_nm?: number;
  rotation_deg?: number;
  why: string;
  pros: string[];
  cons: string[];
  product?: ProductRow;
  /** Kraven alternativet prövats mot, deterministiskt (sedan 2026-10-13). */
  kravstatus?: Array<{ krav: string; utfall: string; text: string }>;
  /** Kundlösningen: varför katalogen inte räckte. */
  orsak?: string;
}

/** Server-computed requirement numbers — lets the UI draw a "required vs
 * available" margin visual instead of just prose reasoning. Shared across all
 * options in one response since they all answer the same application. */
interface Requirements {
  load_kg: number | null;
  required_force_n: number | null;
  required_stroke_mm: number | null;
  /** Vridningens storheter. Tillagda 2026-10-02: vridgrenen var den enda väg
   *  som inte skickade kraven alls, så en vridkund fick ingen dimensionering. */
  required_torque_nm?: number | null;
  required_rotation_deg?: number | null;
  safety_factor: number;
  /** Trycket kraften anges vid. null för en elaxel: dess kraft är matningskraft. */
  pressure_bar: number | null;
  /** Hur kraftkravet räknades, i klartext (sedan 2026-10-11). */
  force_basis?: string | null;
  /** Kraften är en uppskattning, inte ett krav (sedan 2026-10-13). */
  force_preliminary?: boolean;
  force_missing?: string[];
  /** Trycket är antaget, inte angivet av kunden. */
  pressure_assumed?: boolean;
}

/** En kant i maskingrafen, som groq-advisor levererar den (se
 *  deriveBomConnections i bom-builder.ts). Index pekar in i bom-arrayen.
 *  Riktning: beroende -> det den beror på. */
export interface BomConnection {
  fromIndex: number;
  toIndex: number;
  relation: string;
}

interface BomLine {
  sku: string;
  quantity: number;
  role: string;
  reason: string;
  /** Stabil, lokaloberoende komponenttyp från servern (actuator, valve, ...).
   *  Skild från `role`, som är lokaliserad visningstext. Schemat grupperar och
   *  placerar på `kind`; `role` är bara det användaren läser. */
  kind?: string;
  /** Delsystemsgruppering från servern. null för varningsrader, som är
   *  annotationer och inte komponenter. */
  subsystem?: string | null;
  /** Serverns verifieringsstatus för raden. "verifierad" betyder att de krav vi
   *  KAN kontrollera har kontrollerats -- inte att allt är kontrollerat. */
  verifiering?: string;
  verifieringsskal?: string;
  /** Kraven raden prövats mot (tryck, spänning, miljö), sedan 2026-10-13. */
  kontroller?: Array<{ krav: string; utfall: string; text: string }>;
  product?: ProductRow;
}

/** Serverns dom över hela lösningen. Räknas INTE om här: `bedomLosning()` äger
 *  vilka statusar som blockerar, och en kopia av den regeln i klienten skulle
 *  driva isär från serverns -- samma fälla som advisor-client.ts beskriver. */
interface Dom {
  bestallningsklar: boolean;
  blockerande: Array<{ sku: string; role: string; verifiering: string; skal: string }>;
  /** Hur mycket som faktiskt prövades. Utan den läses tystnad som godkännande. */
  kontrollerat?: {
    verifierade: number; utan_krav: number; blockerande: number; rader: number;
    underlag_saknas?: number; stods_inte?: number; ej_tillampligt?: number; konfiguration?: number; med_luckor?: number;
  };
}

type Step = "describe" | "q_loading" | "questions" | "o_loading" | "options" | "bom_loading" | "result";

const EXAMPLES: Record<string, string[]> = {
  sv: [
    "Pneumatisk stoppdon på transportband — stoppar kartonger 5 kg",
    "Lyfter en plåtdel 15 kg vertikalt 200 mm i en pressstation",
    "Plockar och placerar kartong 2 kg — vakuumgrepp från magasin",
    "Klamrar fast en detalj under svetsning, horisontell rörelse 80 mm",
    "Vakuumgrepp som lyfter glasskivor 4 kg i monteringscell",
    "Elektrisk linjäraxel för exakt positionering av kamera, 300 mm slag",
  ],
  en: [
    "Pneumatic stop unit on conveyor — stops 5 kg cartons",
    "Lifts a 15 kg metal part vertically 200 mm in a press station",
    "Pick and place 2 kg carton — vacuum grip from magazine",
    "Clamps a part during welding, horizontal movement 80 mm",
    "Vacuum gripper lifting 4 kg glass panels in assembly cell",
    "Electric linear axis for precise camera positioning, 300 mm stroke",
  ],
  de: [
    "Pneumatischer Stopper auf Förderband — hält 5 kg Kartons an",
    "Hebt ein 15 kg Blechteil vertikal 200 mm in einer Pressenstation",
    "Pick-and-Place 2 kg Karton — Vakuumgreifer aus Magazin",
    "Klemmt ein Teil beim Schweißen, horizontale Bewegung 80 mm",
    "Vakuumgreifer für 4 kg Glasscheiben in Montagezelle",
    "Elektrische Linearachse für genaue Kamerapositionierung, 300 mm Hub",
  ],
  es: [
    "Tope neumático en cinta transportadora — detiene cajas de 5 kg",
    "Levanta pieza de metal 15 kg verticalmente 200 mm en prensa",
    "Pick and place cartón 2 kg — pinza de vacío desde almacén",
    "Fija pieza durante soldadura, movimiento horizontal 80 mm",
    "Pinza de vacío para paneles de vidrio 4 kg en célula de montaje",
    "Eje lineal eléctrico para posicionamiento preciso de cámara, 300 mm",
  ],
};

// ── Advisor API calls ───────────────────────────────────────────────────────
const advisorCall = callAdvisor;

// Downscale a customer photo client-side (≤1024 px, JPEG) so the payload stays
// small and under the vision API's 4 MB base64 cap regardless of camera size.
async function fileToJpegDataUrl(file: File, maxDim = 1024): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

// ── Main component ──────────────────────────────────────────────────────────
function MachineBuilderPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const isSv = locale === "sv";
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("describe");
  const [description, setDescription] = useState("");
  const [qSummary, setQSummary] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [optionsSummary, setOptionsSummary] = useState("");
  const [options, setOptions] = useState<ActuatorOption[]>([]);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [selected, setSelected] = useState<ActuatorOption | null>(null);
  const [bom, setBom] = useState<BomLine[]>([]);
  const [bomTitle, setBomTitle] = useState("");
  const [connections, setConnections] = useState<BomConnection[]>([]);
  const [dom, setDom] = useState<Dom | null>(null);
  // Motorns strukturerade resultat (resultat.ts). null för ett öppnat projekt:
  // det räknas fram först när stycklistan byggs om.
  const [resultat, setResultat] = useState<ResultatData | null>(null);
  const [bomExplanation, setBomExplanation] = useState("");
  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const [error, setError] = useState("");
  const [rfqSent, setRfqSent] = useState(false);
  const [rfqId, setRfqId] = useState("");
  const [rfqName, setRfqName] = useState("");
  const [rfqEmail, setRfqEmail] = useState("");
  const [rfqCompany, setRfqCompany] = useState("");
  const [rfqPhone, setRfqPhone] = useState("");
  const [rfqPoNumber, setRfqPoNumber] = useState("");
  const [rfqOrgNumber, setRfqOrgNumber] = useState("");
  const [autoSaved, setAutoSaved] = useState(false);
  // Projektet som resultatet sparats i. PLC-modulen (ingång A) öppnas på det.
  const [projektId, setProjektId] = useState<string | null>(null);
  // Det som senast skrevs till projektet: beskrivning, svar och stycklistans
  // artiklar. Ändras resultatet efter sparningen uppdateras samma projekt.
  const sparatInnehall = useRef("");

  useEffect(() => { loadCatalog().then(setCatalog).catch(() => {}); }, []);

  // Pre-fill RFQ form from company profile when user logs in
  useEffect(() => {
    if (!user) return;
    supabase
      .from("company_profiles")
      .select("display_name,email,company_name,phone,org_number")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.display_name && !rfqName) setRfqName(data.display_name);
        if (data.email && !rfqEmail) setRfqEmail(data.email);
        if (data.company_name && !rfqCompany) setRfqCompany(data.company_name);
        if (data.phone && !rfqPhone) setRfqPhone(data.phone);
        if (data.org_number && !rfqOrgNumber) setRfqOrgNumber(data.org_number);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-save BOM as project when result step is reached (logged-in users only).
  // Väljer användaren sedan ett annat alternativ uppdateras samma projekt i
  // stället för att resultatet och det sparade projektet glider isär. Projektet
  // får då en ny revision, och ett PLC-underlag som bygger på det visar att
  // kraven ändrats.
  useEffect(() => {
    if (step !== "result" || !user || bom.length === 0) return;
    const innehall = projektinnehall(description, answers, bom);
    if (innehall === sparatInnehall.current) return;
    sparatInnehall.current = innehall;
    const bomSnapshot = bom.map(l => ({
      sku: l.sku, role: l.role, qty: l.quantity,
      name: l.product?.name ?? l.sku,
    }));
    // Skriv den normaliserade stycklistan först och koppla projektet till den.
    // Hjälparen kastar aldrig och returnerar null om något gick fel -- projektet
    // sparas då ändå via bom_lines-snapshotten, precis som förut.
    void (async () => {
      const bomId = await saveBomNormalized(user.id, bom, description, connections);
      if (projektId) {
        await supabase.from("projects").update({
          description: description.trim() || null,
          answers,
          bom_lines: bomSnapshot,
          bom_id: bomId,
        }).eq("id", projektId);
      } else {
        const name = bomTitle || `Maskinbyggare — ${new Date().toLocaleDateString("sv-SE")}`;
        const { data } = await supabase.from("projects").insert({
          user_id: user.id,
          name,
          description: description.trim() || null,
          locale,
          answers,
          bom_lines: bomSnapshot,
          bom_id: bomId,
        }).select("id").single();
        if (data) setProjektId(data.id);
      }
      setAutoSaved(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user, bom]);

  // Fix 3: Ladda sparat projekt från sessionStorage (navigering från /projects)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("mv_load_project");
      if (!raw) return;
      sessionStorage.removeItem("mv_load_project"); // rensa direkt
      const proj = JSON.parse(raw) as {
        id: string; name: string; description: string | null;
        answers: Record<string, string>; bom_lines: Array<{ sku: string; role: string; qty: number; unit_price?: number; name?: string }>;
        bom_id?: string | null;
      };
      // Fyll i beskrivning och hoppa till resultatsteget
      setDescription(proj.description ?? proj.name);
      setAnswers(proj.answers ?? {});
      // Ett sparat projekt öppnas som sig självt: autosparningen ska inte
      // skapa en kopia av det. Utan id (en gäst som loggat in mitt i
      // resultatet) sparas det som ett nytt projekt.
      if (proj.id) {
        setProjektId(proj.id);
        setAutoSaved(true);
        sparatInnehall.current = projektinnehall(proj.description ?? proj.name, proj.answers ?? {},
          (proj.bom_lines ?? []).map(l => ({ sku: l.sku, role: l.role, quantity: l.qty })));
      }
      // Rekonstruera BOM-rader
      const loadedBom: BomLine[] = (proj.bom_lines ?? []).map(l => ({
        sku: l.sku,
        role: l.role,
        quantity: l.qty,
        reason: "",
        product: undefined, // fylls i av enrichWithCatalog nedan
      }));
      setBom(loadedBom);
      // Topologin ligger i bom_items/bom_connections, inte i JSON-snapshotten.
      // Utan den här återställningen står detaljraden tom där det borde stå
      // "Sitter på FRL-enhet" -- kopplingarna sätts annars bara av rådgivarens
      // live-svar, som ett återöppnat projekt aldrig får.
      // Bäst-möjligt: misslyckas den ligger JSON-vägen kvar precis som förut.
      if (proj.bom_id) {
        void loadBomNormalized(proj.bom_id).then(saved => {
          if (!saved) return;
          setBom(saved.lines.map(l => ({
            sku: l.sku, role: l.role, quantity: l.quantity,
            reason: l.reason, subsystem: l.subsystem, product: undefined,
          })));
          setConnections(saved.connections);
        });
      }
      setBomTitle(proj.name);
      setBomExplanation((locale === "sv" ? "Laddat från sparat projekt: " : "Loaded from saved project: ") + proj.name);
      setSelected({ id: "loaded", name: proj.name, desc: "", tags: [] } as never);
      setStep("result");
    } catch {
      // JSON-parse-fel eller sessionStorage blockerat — ignorera
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uppdraget från startsidan: läses en gång och startar analysen direkt, så
  // att besökaren inte skriver och trycker två gånger. En bakåtnavigering
  // startar den inte igen (nyckeln tas bort när den lästs).
  useEffect(() => {
    let start: string | null = null;
    try {
      start = sessionStorage.getItem("mv_starta");
      if (start) sessionStorage.removeItem("mv_starta");
    } catch { /* blockerad lagring */ }
    if (start?.trim()) {
      setDescription(start);
      void handleDescribe(start);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enrichWithCatalog<T extends { sku: string; product?: ProductRow }>(items: T[]): T[] {
    return items.map(item => ({
      ...item,
      product: catalog.find(p => p.sku === item.sku),
    }));
  }

  // Step 1 → questions
  async function handleDescribe(text: string = description) {
    if (!text.trim()) return;
    setError("");
    setStep("q_loading");
    try {
      const data = await advisorCall({ action: "questions", description: text, locale });
      // Never advance to the questions step with nothing to answer: `allAnswered`
      // requires questions.length > 0, so an empty list disables the continue
      // button forever and strands the user with no error and no way forward.
      // Throwing instead reuses the existing catch, which shows "something went
      // wrong, try again" and keeps them here with their description intact.
      // The advisor returns 502 for this now (groq-advisor questionsFailed), so
      // this is the belt to that braces -- it also covers a 200 with an empty
      // list from any future/older deployed version of the function.
      if (!data.questions?.length) throw new Error("NO_QUESTIONS");
      setQSummary(data.summary ?? "");
      setQuestions(data.questions ?? []);
      setAnswers({});
      setStep("questions");
    } catch (e) {
      setError(t((e as Error).message === "RATE_LIMITED" ? "machineBuilder.errorRateLimit" : "machineBuilder.errorGeneric"));
      setStep("describe");
    }
  }

  // Step 2 → options
  async function handleAnswers() {
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) return;
    setError("");
    setStep("o_loading");
    try {
      const data = await advisorCall({ action: "options", description, answers, locale });
      const enriched = enrichWithCatalog<ActuatorOption>(data.options ?? []);
      setOptions(enriched);
      setOptionsSummary(data.summary ?? "");
      setRequirements(data.requirements ?? null);
      setStep("options");
    } catch (e) {
      setError(t((e as Error).message === "RATE_LIMITED" ? "machineBuilder.errorRateLimit" : "machineBuilder.errorGeneric"));
      setStep("questions");
    }
  }

  // Step 3 → BOM (or advisor redirect for custom solutions)
  async function handleSelect(opt: ActuatorOption) {
    if (opt.sku === "CUSTOM-SOLUTION") {
      const { svar: kundsvar } = delaSvar(answers);
      const context = [
        description,
        Object.keys(kundsvar).length
          ? "\n\nKrav:\n" + Object.entries(kundsvar).map(([k, v]) => `${k}: ${v}`).join("\n")
          : "",
      ].join("");
      window.location.href = `/${locale}/advisor?q=${encodeURIComponent(context)}`;
      return;
    }
    setSelected(opt);
    setError("");
    setStep("bom_loading");
    try {
      const data = await advisorCall({ action: "bom", description, answers, primarySku: opt.sku, locale });
      const enriched = enrichWithCatalog<BomLine>(data.bom ?? []);
      setBom(enriched);
      logga("stycklista", { rader: enriched.length, primar: opt.sku });
      setConnections(data.connections ?? []);
      // Äldre driftsatta versioner av funktionen svarar utan dom. Då är null
      // rätt: ingen banner alls är ärligare än ett påhittat "klar".
      setDom(typeof data.bestallningsklar === "boolean"
        ? { bestallningsklar: data.bestallningsklar, blockerande: data.blockerande ?? [], kontrollerat: data.kontrollerat }
        : null);
      setBomTitle(data.title ?? "");
      setBomExplanation(data.explanation ?? "");
      setResultat(data.resultat ?? null);
      setStep("result");
    } catch (e) {
      setError(t((e as Error).message === "RATE_LIMITED" ? "machineBuilder.errorRateLimit" : "machineBuilder.errorGeneric"));
      setStep("options");
    }
  }

  function restart() {
    setProjektId(null);
    setAutoSaved(false);
    sparatInnehall.current = "";
    setStep("describe");
    setDescription("");
    setQuestions([]);
    setAnswers({});
    setOptions([]);
    setRequirements(null);
    setSelected(null);
    setBom([]);
    setDom(null);
    setResultat(null);
    setBomTitle("");
    setBomExplanation("");
    setRfqSent(false);
    setRfqId("");
    setRfqName("");
    setRfqEmail("");
    setRfqCompany("");
    setRfqPhone("");
    setError("");
  }

  // ── Projektöversikten och stegen ────────────────────────────────────────
  // Kravbilden räknas i webbläsaren ur samma modul som motorn (kravbild.ts),
  // så panelen visar vad som uppfattats redan medan beskrivningen skrivs.
  const lamnasOppen = isSv ? "Lämnas öppen" : "Left open";
  const vetInte = t("machineBuilder.dontKnow");
  const uppskjuten = useDeferredValue(description);
  const oversikt = useMemo(() => byggProjektoversikt({
    locale, description: uppskjuten, answers,
    fragor: questions.map(q => ({ id: q.id, label: q.label })), lamnasOppen, vetInte,
    requirements: step === "options" || step === "bom_loading" || step === "result" ? requirements : null,
    valt: step === "result" || step === "bom_loading" ? selected : null,
    blockerande: step === "result" ? dom?.blockerande : undefined,
  }), [locale, uppskjuten, answers, questions, lamnasOppen, vetInte, step, requirements, selected, dom]);

  const ORDNING: Record<Step, number> = { describe: 0, q_loading: 0, questions: 1, o_loading: 1, options: 2, bom_loading: 2, result: 3 };
  const nu = ORDNING[step] ?? 0;
  const lage = (i: number, saknas: boolean, konflikt: boolean): StegTillstand =>
    i === nu ? "aktivt" : i > nu ? "last" : konflikt ? "konflikt" : saknas ? "saknas" : "klart";
  const fragorSaknas = questions.some(q => answers[q.id] === lamnasOppen || answers[q.id] === vetInte);
  const valtUppfyllerInte = (selected?.kravstatus ?? []).some(k => k.utfall === "ej_uppfyllt");
  // Ett valt alternativ med krav som avviker eller inte gick att bedöma är
  // valt, men inte klart: steget visar att uppgifter saknas.
  const valtSaknar = (selected?.kravstatus ?? []).some(k => k.utfall === "kan_inte_bedomas" || k.utfall === "avvikelse");
  const stegLista = [
    { id: "describe", namn: t("machineBuilder.stepDescribe"), tillstand: lage(0, false, false) },
    { id: "questions", namn: t("machineBuilder.stepQuestions"), tillstand: lage(1, fragorSaknas, false) },
    { id: "options", namn: t("machineBuilder.stepSelect"), tillstand: lage(2, valtSaknar, valtUppfyllerInte) },
    { id: "result", namn: t("machineBuilder.stepResult"), tillstand: lage(3, false, oversikt.antal.konflikter > 0) },
  ];
  function gaTillSteg(id: string) {
    if (id === "describe") setStep("describe");
    else if (id === "questions" && questions.length) setStep("questions");
    else if (id === "options" && options.length) setStep("options");
  }

  const sparstatus: Sparstatus = !user
    ? {
        lage: "osparat",
        text: isSv ? "Inte sparat. Logga in för att spara projektet." : "Not saved. Sign in to save the project.",
        atgard: <Link to="/$locale/login" params={{ locale }} className="font-medium text-info hover:underline">{t("auth.submitLogin")}</Link>,
      }
    : projektId && autoSaved
    ? { lage: "sparat", text: isSv ? "Sparat i projektet" : "Saved to the project" }
    : step === "result"
    ? { lage: "sparar", text: isSv ? "Sparar …" : "Saving …" }
    : { lage: "osparat", text: isSv ? "Sparas som projekt när resultatet är klart." : "Saved as a project once the result is ready." };

  const panel = {
    rubrik: isSv ? "Projektöversikt" : "Project overview",
    beskrivning: step === "describe" ? undefined : description.trim(),
    sparstatus,
    sektioner: oversikt.sektioner.map(sek => ({ ...sek, poster: sek.poster.map(p => ({ ...p })) })),
    locale,
    sammanfattning: oversikt.sammanfattning,
    tomText: isSv ? "Börja skriva, så visas det maskinbyggaren uppfattar här." : "Start typing and what the machine builder picks up appears here.",
  };

  return (
    <div className="container-page py-6 md:py-8">
      <div className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
          <span className="text-info text-base" aria-hidden>✦</span>
          {t("machineBuilder.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("machineBuilder.subtitle")}</p>
      </div>

      <Stegnavigering steg={stegLista} onValj={gaTillSteg} locale={locale} etikett={isSv ? "Maskinbyggarens steg" : "Machine builder steps"} className="mt-5" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Projektpanel variant="mobil" {...panel} />

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-danger-deep/20 bg-danger-surface px-4 py-3 text-sm text-danger-deep">
              <span aria-hidden className="mt-px font-semibold">!</span>
              <span>{error}</span>
            </div>
          )}

          <div key={step} className="rorelse-fram">
      {/* ── Step: Describe ── */}
      {step === "describe" && (
        <DescribeStep
          t={t}
          locale={locale}
          description={description}
          setDescription={setDescription}
          onSubmit={() => handleDescribe()}
        />
      )}

      {/* ── Step: Loading questions ── */}
      {step === "q_loading" && <LoadingCard message={t("machineBuilder.analysingApp")} form="fragor" locale={locale} />}

      {/* ── Step: Questions ── */}
      {step === "questions" && (
        <QuestionsStep
          t={t}
          locale={locale}
          description={description}
          summary={qSummary}
          questions={questions}
          answers={answers}
          setAnswers={setAnswers}
          onSubmit={handleAnswers}
          onBack={() => setStep("describe")}
        />
      )}

      {/* ── Step: Loading options ── */}
      {step === "o_loading" && <LoadingCard message={t("machineBuilder.searchingComponents")} form="alternativ" locale={locale} />}

      {/* ── Step: Options ── */}
      {step === "options" && (
        <OptionsStep
          t={t}
          locale={locale}
          summary={optionsSummary}
          options={options}
          requirements={requirements}
          onSelect={handleSelect}
          onBack={() => setStep("questions")}
        />
      )}

      {/* ── Step: Loading BOM ── */}
      {step === "bom_loading" && <LoadingCard message={t("machineBuilder.buildingBom")} form="resultat" locale={locale} />}

      {/* ── Step: Result ── */}
      {step === "result" && selected && (
        <ResultStep
          t={t}
          locale={locale}
          title={bomTitle}
          explanation={bomExplanation}
          resultat={resultat}
          selected={selected}
          requirements={requirements}
          bom={bom}
          dom={dom}
          connections={connections}
          catalog={catalog}
          description={description}
          answers={answers}
          rfqName={rfqName}
          rfqEmail={rfqEmail}
          rfqCompany={rfqCompany}
          rfqPhone={rfqPhone}
          rfqPoNumber={rfqPoNumber}
          rfqOrgNumber={rfqOrgNumber}
          rfqSent={rfqSent}
          rfqId={rfqId}
          autoSaved={autoSaved}
          projektId={projektId}
          onProjektSparat={(id) => {
            setProjektId(id);
            setAutoSaved(true);
            sparatInnehall.current = projektinnehall(description, answers, bom);
          }}
          setRfqName={setRfqName}
          setRfqEmail={setRfqEmail}
          setRfqCompany={setRfqCompany}
          setRfqPhone={setRfqPhone}
          setRfqPoNumber={setRfqPoNumber}
          setRfqOrgNumber={setRfqOrgNumber}
          setRfqSent={setRfqSent}
          setRfqId={setRfqId}
          onRestart={restart}
          onBack={() => setStep("options")}
        />
      )}
          </div>
        </div>

        <Projektpanel variant="sida" {...panel} />
      </div>
    </div>
  );
}

// ── Describe Step ───────────────────────────────────────────────────────────
function DescribeStep({ t, locale, description, setDescription, onSubmit }: {
  t: (key: import("@/lib/i18n").TKey) => string; locale: string; description: string; setDescription: (v: string) => void; onSubmit: () => void;
}) {
  const examples = EXAMPLES[locale] ?? EXAMPLES.en;
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState("");
  const [thumbs, setThumbs] = useState<string[]>([]);

  // Photo → vision action → editable TEXT appended to the description. The image
  // itself never reaches options/BOM — only its analysis text does, so the
  // deterministic selection pipeline is untouched and the user can correct it.
  async function onPickImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImgError("");
    const picked = Array.from(files).slice(0, 3 - thumbs.length);
    if (picked.length === 0) return;
    setImgBusy(true);
    try {
      // Accumulate locally — the `description` prop is stale inside the loop, so
      // appending two analyses via the prop would drop the first one.
      let desc = description;
      for (const file of picked) {
        if (!file.type.startsWith("image/") || file.size > 15_000_000) {
          setImgError(t("machineBuilder.imageError")); continue;
        }
        const dataUrl = await fileToJpegDataUrl(file);
        const res = await advisorCall({ action: "vision", image: dataUrl, locale });
        const text = (res?.description ?? "").trim();
        if (!text) { setImgError(t("machineBuilder.imageError")); continue; }
        setThumbs(prev => [...prev, dataUrl]);
        const block = `${t("machineBuilder.imageAnalysisLabel")}: ${text}`;
        desc = desc.trim() ? `${desc.trim()}\n\n${block}` : block;
        setDescription(desc);
      }
    } catch {
      setImgError(t("machineBuilder.imageError"));
    } finally {
      setImgBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="arbetsyta p-2">
        <label htmlFor="mb-beskrivning" className="block px-3 pt-2 text-sm font-medium text-foreground">
          {t("machineBuilder.describeLabel")}
        </label>
        <textarea
          id="mb-beskrivning"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit(); }}
          placeholder={t("machineBuilder.describePlaceholder")}
          rows={5}
          autoFocus
          className="mt-1 block w-full resize-y rounded-xl bg-transparent px-3 py-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 pt-3 pb-1.5">
          <input
            ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            onChange={e => onPickImages(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={imgBusy || thumbs.length >= 3}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:border-cta/40 hover:text-foreground disabled:opacity-40"
          >
            {imgBusy ? t("machineBuilder.analysingImage") : <><Camera className="size-3.5" aria-hidden />{t("machineBuilder.uploadImage")}</>}
          </button>
          {thumbs.map((src, i) => (
            <span key={i} className="relative inline-block">
              <img src={src} alt="" className="h-9 w-9 rounded-md object-cover border border-border" />
              <button
                type="button"
                onClick={() => setThumbs(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-secondary text-secondary-foreground text-[9px] leading-4 text-center border border-border"
                aria-label="×"
              >×</button>
            </span>
          ))}
          {/* Tipset får en egen rad på smal skärm i stället för att pressas
              till en smal spalt mellan knapparna. */}
          <span className="order-last w-full text-[11px] text-muted-foreground sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">{imgError || t("machineBuilder.imageHint")}</span>
          <span className="ml-auto hidden text-[11px] text-muted-foreground [@media(hover:hover)]:sm:inline">{t("machineBuilder.cmdEnterHint")}</span>
          <button
            onClick={onSubmit}
            disabled={!description.trim() || imgBusy}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-cta px-4 text-sm font-semibold text-cta-foreground shadow-xs transition-[background-color,transform] hover:bg-cta-hover active:translate-y-px disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {t("machineBuilder.analyse")}
          </button>
        </div>
      </div>

      {/* Exempel: ett klick fyller fältet, inget skickas förrän användaren vill. */}
      <div>
        <p className="text-xs font-medium text-muted-foreground">{t("machineBuilder.tryExample")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {examples.map(ex => (
            <button
              key={ex}
              type="button"
              onClick={() => setDescription(ex)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-[13px] text-foreground/85 shadow-xs transition-colors hover:border-cta/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Questions Step ──────────────────────────────────────────────────────────
function QuestionsStep({ t, locale, description, summary, questions, answers, setAnswers, onSubmit, onBack }: {
  t: (key: import("@/lib/i18n").TKey) => string; locale: string; description: string; summary: string; questions: Question[]; answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void; onSubmit: () => void; onBack: () => void;
}) {
  const isSv = locale === "sv";
  // All number fields allow 0 — 0 is a valid answer (e.g. "0 mm precision" = no precision req,
  // "0 bar" = no pressure needed). Only reject negative numbers and NaN.

  // En flervalsfråga har aldrig alla svar. Alternativen kommer från modellen
  // och täcker det vanliga fallet; verkligheten har alltid ett fall till --
  // hängande i tak, 30 graders lutning, "roterar OCH lyfter". Utan en väg in
  // för eget svar tvingas kunden välja det närmaste alternativet, och ett
  // närmevärde som skickas vidare som ett faktum är precis det som bygger fel
  // stycklista.
  //
  // Fritexten kostar ingenting i precision: index.ts slår ihop beskrivningen
  // och ALLA svar till en sträng som varje detektor kör sina uttryck på, så
  // ett eget svar väger lika tungt som ett förvalt -- oftast tyngre, eftersom
  // det innehåller just de fraser detektorerna letar efter.
  //
  // Läget initieras ur svaren och inte som tomt, för steg 3 har en väg
  // tillbaka hit. Ett sparat svar som inte finns bland alternativen ÄR ett
  // eget svar, och utan den här härledningen kom det tillbaka osynligt: kvar
  // i `answers` och på väg till servern, men utan något valt på skärmen.
  const [egnaSvar, setEgnaSvar] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const q of questions) {
      const val = answers[q.id];
      if (q.type === "choice" && q.options?.length && val && !q.options.includes(val) && val !== t("machineBuilder.dontKnow")) {
        set.add(q.id);
      }
    }
    return set;
  });

  function valjAlternativ(q: Question, opt: string) {
    setAnswers({ ...answers, [q.id]: opt });
    if (egnaSvar.has(q.id)) {
      const kvar = new Set(egnaSvar);
      kvar.delete(q.id);
      setEgnaSvar(kvar);
    }
  }

  function vaxlaEgetSvar(q: Question) {
    const nytt = new Set(egnaSvar);
    if (nytt.has(q.id)) {
      // Tillbaka till alternativen. Fritexten slängs, annars skickas ett svar
      // som inte längre går att se på skärmen.
      nytt.delete(q.id);
      const utan = { ...answers };
      delete utan[q.id];
      setAnswers(utan);
    } else {
      // Nollas, så att inget alternativ står kvar som valt samtidigt som
      // fältet. Tomt svar håller också Fortsätt avstängd tills något skrivits.
      nytt.add(q.id);
      setAnswers({ ...answers, [q.id]: "" });
    }
    setEgnaSvar(nytt);
  }

  // "Vet inte" är ett fullgott svar. De flesta som använder maskinbyggaren är
  // inte automationsingenjörer, och en gissning som skickas vidare som ett
  // faktum bygger fel stycklista. Svaret går vidare som text; detektorerna i
  // nästa steg hittar inga värden i det och använder sina standardantaganden.
  const vetInte = t("machineBuilder.dontKnow");
  // "Lämnas öppen" (manualen 4.2): frågan besvaras inte nu och följer med som
  // en öppen fråga. Skiljt från "Vet inte", som är ett svar.
  const lamnasOppen = isSv ? "Lämnas öppen" : "Left open";
  function lamnaOppen(q: Question) {
    if (egnaSvar.has(q.id)) {
      const kvar = new Set(egnaSvar);
      kvar.delete(q.id);
      setEgnaSvar(kvar);
    }
    setAnswers({ ...answers, [q.id]: lamnasOppen });
  }
  function valjVetInte(q: Question) {
    if (egnaSvar.has(q.id)) {
      const kvar = new Set(egnaSvar);
      kvar.delete(q.id);
      setEgnaSvar(kvar);
    }
    setAnswers({ ...answers, [q.id]: vetInte });
  }

  const kvar = questions.filter(q => !answers[q.id]).length;
  const allAnswered = questions.length > 0 && questions.every(q => {
    const val = answers[q.id];
    if (val === undefined || val === "") return false;
    if (val === vetInte || val === lamnasOppen) return true;
    if (q.type === "number") {
      const n = parseFloat(val);
      if (isNaN(n)) return false;
      if (n < 0) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {summary && (
        <div className="flex gap-3 rounded-lg bg-surface-alt px-4 py-3 text-sm text-foreground">
          <span className="mt-0.5 shrink-0 text-info" aria-hidden>✦</span>
          <span>{summary}</span>
        </div>
      )}

      <Tolkningspanel locale={locale} description={description} answers={answers} setAnswers={setAnswers} />

      <div className="arbetsyta divide-y divide-line">
        <h2 className="px-5 py-4 text-sm font-semibold text-foreground sm:px-6">
          {t("machineBuilder.answerQuestions")}
        </h2>

        {questions.map((q, i) => (
          <div key={q.id} className="px-5 py-5 sm:px-6">
            <div className="flex items-start gap-2 mb-3">
              <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-semibold">{i + 1}</span>
              <div>
                <div className="text-sm font-medium">{q.label}</div>
                {q.hint && <div className="text-xs text-muted-foreground mt-0.5">{q.hint}</div>}
                {q.varfor && (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-info hover:underline w-fit">{isSv ? "Varför behöver vi detta?" : "Why do we need this?"}</summary>
                    <p className="mt-1 text-muted-foreground max-w-prose">{q.varfor}</p>
                  </details>
                )}
              </div>
            </div>
            {q.type === "choice" && q.options?.length ? (
              <div className="ml-7 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {q.options.map(opt => {
                    // Ett förvalt alternativ får inte se valt ut medan fritexten
                    // är öppen, även om det som skrivits råkar stämma ord för ord.
                    const vald = !egnaSvar.has(q.id) && answers[q.id] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => valjAlternativ(q, opt)}
                        aria-pressed={vald}
                        className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${
                          vald
                            ? "border-primary bg-primary text-primary-foreground font-medium shadow-xs"
                            : "border-border bg-surface text-foreground/80 hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {vald && <span className="mr-1">✓</span>}
                        {opt}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => valjVetInte(q)}
                    aria-pressed={!egnaSvar.has(q.id) && answers[q.id] === vetInte}
                    className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${
                      !egnaSvar.has(q.id) && answers[q.id] === vetInte
                        ? "border-primary bg-primary text-primary-foreground font-medium shadow-xs"
                        : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {!egnaSvar.has(q.id) && answers[q.id] === vetInte && <span className="mr-1">✓</span>}
                    {vetInte}
                  </button>
                  <button
                    onClick={() => vaxlaEgetSvar(q)}
                    aria-expanded={egnaSvar.has(q.id)}
                    className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${
                      egnaSvar.has(q.id)
                        ? "border-primary bg-primary text-primary-foreground font-medium shadow-xs"
                        : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {egnaSvar.has(q.id) && <span className="mr-1">✓</span>}
                    {t("machineBuilder.ownAnswer")}
                  </button>
                  <button
                    onClick={() => lamnaOppen(q)}
                    aria-pressed={!egnaSvar.has(q.id) && answers[q.id] === lamnasOppen}
                    className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${
                      !egnaSvar.has(q.id) && answers[q.id] === lamnasOppen
                        ? "border-primary bg-primary text-primary-foreground font-medium shadow-xs"
                        : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {!egnaSvar.has(q.id) && answers[q.id] === lamnasOppen && <span className="mr-1">✓</span>}
                    {lamnasOppen}
                  </button>
                </div>
                {egnaSvar.has(q.id) && (
                  <input
                    type="text"
                    autoFocus
                    value={answers[q.id] ?? ""}
                    onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder={t("machineBuilder.typeAnswer")}
                    aria-label={q.label}
                    className="w-full max-w-md px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-info/50 bg-background transition"
                  />
                )}
              </div>
            ) : (
              /* Fallback for number, text, or any other type Groq returns */
              (() => {
                const raw = answers[q.id];
                const arVetInte = raw === vetInte || raw === lamnasOppen;
                const numVal = raw !== undefined && raw !== "" && !arVetInte ? parseFloat(raw) : null;
                const isInvalid = q.type === "number" && raw !== undefined && raw !== "" && !arVetInte &&
                  (isNaN(numVal!) || numVal! < 0);
                return (
                  <div className="ml-7 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type={q.type === "number" ? "number" : "text"}
                        min={q.type === "number" ? 0 : undefined}
                        value={arVetInte ? "" : raw ?? ""}
                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                        placeholder={q.type === "number" ? t("machineBuilder.enterValue") : t("machineBuilder.typeAnswer")}
                        className={`w-48 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-background transition ${
                          isInvalid
                            ? "border-destructive focus:ring-destructive/50"
                            : "border-input focus:ring-info/50"
                        }`}
                      />
                      {q.unit && <span className="text-sm text-muted-foreground">{q.unit}</span>}
                      <button
                        onClick={() => valjVetInte(q)}
                        aria-pressed={raw === vetInte}
                        className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${
                          raw === vetInte
                            ? "border-primary bg-primary text-primary-foreground font-medium shadow-xs"
                            : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {raw === vetInte && <span className="mr-1">✓</span>}
                        {vetInte}
                      </button>
                      <button
                        onClick={() => lamnaOppen(q)}
                        aria-pressed={raw === lamnasOppen}
                        className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${
                          raw === lamnasOppen
                            ? "border-primary bg-primary text-primary-foreground font-medium shadow-xs"
                            : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {raw === lamnasOppen && <span className="mr-1">✓</span>}
                        {lamnasOppen}
                      </button>
                    </div>
                    {isInvalid && (
                      <p className="text-xs text-destructive">
                        {t("machineBuilder.invalidPositive")}
                      </p>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← {t("machineBuilder.back")}
        </button>
        <div className="flex items-center gap-3">
          {/* En avstängd knapp säger varför (rorelse-skillen). */}
          {!allAnswered && kvar > 0 && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {isSv ? `${kvar} ${kvar === 1 ? "fråga" : "frågor"} kvar` : `${kvar} ${kvar === 1 ? "question" : "questions"} left`}
            </span>
          )}
          <button
            onClick={onSubmit}
            disabled={!allAnswered}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-cta px-5 text-sm font-semibold text-cta-foreground shadow-xs transition-[background-color,transform] hover:bg-cta-hover active:translate-y-px disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {t("machineBuilder.findComponents")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Options Step ────────────────────────────────────────────────────────────
const KUNDLOSNING_ORSAK: Record<string, [string, string]> = {
  ingen_katalogmatchning: ["Ingen artikel i katalogen matchar kraven.", "No catalogue item matches the requirements."],
  otillrackligt_underlag: ["Underlaget räcker inte för att välja: last eller kraft saknas.", "Not enough data to choose: load or force is missing."],
  kravkonflikt: ["Kraven motsäger varandra; se konflikterna ovan.", "The requirements contradict each other; see the conflicts above."],
  alternativ: ["Ett alternativ om inget av förslagen passar.", "An alternative if none of the proposals fits."],
};

function OptionsStep({ t, locale, summary, options, requirements, onSelect, onBack }: {
  t: (key: import("@/lib/i18n").TKey) => string; locale: string; summary: string; options: ActuatorOption[];
  requirements: Requirements | null; onSelect: (o: ActuatorOption) => void; onBack: () => void;
}) {
  const isSv = locale === "sv";
  const tx = (sv: string, en: string) => (isSv ? sv : en);

  // Ett kravutfall mot en uppskattning är preliminärt, inte grönt (brief punkt 6).
  const kravTillstand = (k: { krav: string; utfall: string }): Tillstand =>
    k.utfall === "uppfyllt" && /preliminär|preliminary/i.test(k.krav) ? "preliminart" : utfalletsTillstand(k.utfall);
  const helhetText: Record<string, [string, string]> = {
    uppfyllerInte: ["Uppfyller inte ett krav", "Does not meet a requirement"],
    komplettering: ["Kräver komplettering", "Needs completion"],
    preliminart: ["Preliminärt uppfyllt", "Preliminarily met"],
    bekraftat: ["Uppfyller prövade krav", "Meets checked requirements"],
  };
  const helhet = (o: ActuatorOption): Tillstand => allvarligast((o.kravstatus ?? []).map(kravTillstand)) ?? "ejProvat";
  // Rekommendationen: första katalogalternativet som inte bryter ett krav.
  const rekommenderad = options.find(o => o.sku !== "CUSTOM-SOLUTION" && helhet(o) !== "uppfyllerInte")?.sku;

  // Det alternativen prövas mot, med enhet och grund.
  const grund: Array<{ text: string; tillstand?: Tillstand; tag?: string }> = [];
  if (requirements?.load_kg) grund.push({ text: `${tx("Last", "Load")} ${requirements.load_kg} kg` });
  if (requirements?.required_force_n) grund.push({ text: `${tx("Kraft", "Force")} ${requirements.required_force_n} N`, ...(requirements.force_preliminary ? { tillstand: "preliminart" as const, tag: tx("uppskattning", "estimate") } : {}) });
  if (requirements?.required_stroke_mm) grund.push({ text: `${tx("Slag", "Stroke")} ${requirements.required_stroke_mm} mm` });
  if (requirements?.required_torque_nm) grund.push({ text: `${tx("Vridmoment", "Torque")} ${requirements.required_torque_nm} Nm` });
  if (requirements?.required_rotation_deg) grund.push({ text: `${tx("Vinkel", "Angle")} ${requirements.required_rotation_deg}°` });
  if (requirements?.pressure_bar) grund.push({ text: `${tx("Tryck", "Pressure")} ${String(requirements.pressure_bar).replace(".", isSv ? "," : ".")} bar`, ...(requirements.pressure_assumed ? { tillstand: "preliminart" as const, tag: tx("antaget", "assumed") } : {}) });

  return (
    <div className="space-y-5">
      {summary && (
        <div className="flex gap-3 rounded-lg bg-surface-alt px-4 py-3 text-sm text-foreground">
          <span className="mt-0.5 shrink-0 text-info" aria-hidden>✦</span>
          <span>{summary}</span>
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-foreground">{t("machineBuilder.selectMain")}</h2>
        {grund.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
            <span>{tx("Prövas mot:", "Checked against:")}</span>
            {grund.map(g => (
              <span key={g.text} className="inline-flex items-center gap-1.5 text-foreground">
                {g.text}
                {g.tillstand && <Statusmarke tillstand={g.tillstand} text={g.tag} locale={locale} />}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {options.map(opt => {
          const isCustom = opt.sku === "CUSTOM-SOLUTION";

          if (isCustom) {
            return (
              <article key="CUSTOM-SOLUTION" className="kort border-dashed p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground">{opt.name}</h3>
                    {opt.orsak && KUNDLOSNING_ORSAK[opt.orsak] && (
                      <p className="mt-0.5 text-[13px] font-medium text-foreground/80">{KUNDLOSNING_ORSAK[opt.orsak][isSv ? 0 : 1]}</p>
                    )}
                  </div>
                  <Statusmarke tillstand="forslag" text={tx("Kundlösning", "Custom solution")} locale={locale} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground/85">{opt.why}</p>
                {(opt.pros?.length || opt.cons?.length) ? (
                  <ul className="mt-3 grid gap-1 text-[13px] text-muted-foreground sm:grid-cols-2">
                    {opt.pros?.map((p, i) => <li key={`p${i}`}>✓ {p}</li>)}
                    {opt.cons?.map((c, i) => <li key={`c${i}`}>· {c}</li>)}
                  </ul>
                ) : null}
                <div className="mt-4 flex justify-end border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={() => onSelect(opt)}
                    className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-xs transition-[background-color,transform] active:translate-y-px ${rekommenderad ? "border border-border bg-surface text-foreground hover:border-cta/40" : "bg-cta text-cta-foreground hover:bg-cta-hover"}`}
                  >
                    {tx("Skicka förfrågan", "Send a request")} →
                  </button>
                </div>
              </article>
            );
          }

          const status = [...(opt.kravstatus ?? [])].sort((x, y) => ALLVAR.indexOf(kravTillstand(x)) - ALLVAR.indexOf(kravTillstand(y)));
          const h = helhet(opt);
          const arRek = opt.sku === rekommenderad;
          const namn = opt.product ? produktnamn(opt.product, locale) : opt.name;
          const funktion = opt.product
            ? [categoryName(opt.product.category.slug, locale, opt.product.category.name), opt.product.brand.name].filter(Boolean).join(" · ")
            : "";

          return (
            <article key={opt.sku} aria-labelledby={`alt-${opt.sku}`} className={`kort p-5 ${arRek ? "ring-1 ring-cta/30" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 id={`alt-${opt.sku}`} className="break-words text-base font-semibold text-foreground">{namn}</h3>
                    {opt.badge && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{opt.badge}</span>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {funktion && <>{funktion} · </>}<span className="font-mono text-xs">{opt.sku}</span>
                  </p>
                </div>
                <Statusmarke tillstand={h} text={helhetText[h] ? helhetText[h][isSv ? 0 : 1] : undefined} locale={locale} />
              </div>

              {/* Kravuppfyllelsen: det som inte håller först. */}
              {status.length > 0 && (
                <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2" aria-label={tx("Krav som prövats", "Requirements checked")}>
                  {status.map((k, i) => {
                    const ts = kravTillstand(k);
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <Statusprick tillstand={ts} className="mt-[7px]" />
                        <span className="min-w-0">
                          <span className="text-foreground">{k.krav}</span>
                          <span className={ts === "uppfyllerInte" ? "font-medium text-danger-deep" : ts === "komplettering" ? "text-warning-deep" : "text-muted-foreground"}>
                            {": "}{utfalletsText(k.utfall, locale)}
                          </span>
                          {k.text && <span className="block text-xs text-muted-foreground">{k.text}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Motiveringen, nära valet. */}
              <p className="mt-4 text-sm leading-relaxed text-foreground/85">{opt.why}</p>

              <details className="group mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-info hover:underline [&::-webkit-details-marker]:hidden">
                  {tx("Tekniska detaljer", "Technical details")}
                  <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="mt-3 space-y-3">
                  {(opt.bore_mm || opt.stroke_mm || opt.force_n) && (
                    <div className="flex flex-wrap gap-2">
                      {opt.bore_mm ? <SpecChip label={tx("Borrning", "Bore")} value={`${opt.bore_mm} mm`} /> : null}
                      {opt.stroke_mm ? <SpecChip label={tx("Slag", "Stroke")} value={`${opt.stroke_mm} mm`} /> : null}
                      {opt.force_n ? <SpecChip label={opt.bore_mm ? tx("Kraft vid 6 bar", "Force at 6 bar") : tx("Kraft", "Force")} value={`${opt.force_n} N`} /> : null}
                    </div>
                  )}
                  <DimensioningPanel locale={locale} requirements={requirements} option={opt} bordered={false} />
                  {(opt.pros?.length || opt.cons?.length) ? (
                    <div className="grid gap-3 text-[13px] sm:grid-cols-2">
                      <ul className="space-y-1">
                        {opt.pros?.map((p, i) => <li key={i} className="text-foreground/85">✓ {p}</li>)}
                      </ul>
                      <ul className="space-y-1">
                        {opt.cons?.map((c, i) => <li key={i} className="text-muted-foreground">· {c}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-xs text-muted-foreground">
                  {arRek ? tx("Rekommenderas: inget prövat krav underkänns.", "Recommended: no checked requirement fails.")
                    : h === "uppfyllerInte" ? tx("Kan väljas, men ett krav uppfylls inte.", "Can be chosen, but a requirement is not met.") : ""}
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(opt)}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-xs transition-[background-color,border-color,transform] active:translate-y-px ${arRek ? "bg-cta text-cta-foreground hover:bg-cta-hover" : "border border-border bg-surface text-foreground hover:border-cta/40"}`}
                >
                  {t("machineBuilder.select")}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex items-center justify-start pt-1">
        <button onClick={onBack} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          ← {t("machineBuilder.back")}
        </button>
      </div>
    </div>
  );
}

function SpecChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground tabular-nums">{value}</span> {label}
    </span>
  );
}

// ── Dimensioning visual — "required vs available", Festo/SMC-style margin bar ──
// Renders nothing when the numbers needed for a given bar aren't available, so it
// degrades silently for options/applications where force or stroke don't apply
// (e.g. electric actuators, torque-based rotary picks, CUSTOM-SOLUTION).
/**
 * Överskott betyder olika saker för olika storheter.
 *
 * För KRAFT är marginal en säkerhetsfaktor: 1,9× är bra, och grönt är rätt.
 *
 * För SLAGLÄNGD är det en AVVIKELSE. En cylinder med 200 mm slag när 150 krävs
 * behöver ett mekaniskt ändstopp, mer monteringsutrymme, mer luft per cykel och
 * ger längre cykeltid -- och risk för kollision om rörelsen inte begränsas.
 * Baren visade tidigare "1,3×" i grönt och punktlistan skrev "Längre slaglängd
 * än krav" som en fördel. Det är inte en fördel, och en maskinbyggare som litar
 * på den gröna bocken bygger in ett fel.
 *
 * `overskottAr` säger vilket av de två som gäller.
 */
function DimensioningBar({ label, required, available, unit, requiredLabel, availableLabel,
                           overskottAr = "marginal", avvikelseNot, preliminar = false }: {
  label: string; required: number; available: number; unit: string;
  requiredLabel: string; availableLabel: string;
  overskottAr?: "marginal" | "avvikelse"; avvikelseNot?: string;
  /** Kravet är en uppskattning: marginalen visas skifferblå, aldrig grön. */
  preliminar?: boolean;
}) {
  const max = Math.max(required, available, 1) * 1.05; // headroom so the bar isn't edge-to-edge
  const availPct = Math.min((available / max) * 100, 100);
  const reqPct = Math.min((required / max) * 100, 100);
  const meets = available >= required;
  const margin = required > 0 ? available / required : null;

  // Ett par procent över är samma standardstorlek, inte en avvikelse.
  const overskott = required > 0 && available > required * 1.02;
  const avviker = overskottAr === "avvikelse" && overskott;

  const ton = !meets ? "fel" : avviker ? "avvikelse" : preliminar ? "preliminar" : "ok";
  const textFarg = ton === "fel" ? "text-danger-deep" : ton === "avvikelse" ? "text-warning-deep" : ton === "preliminar" ? "text-prelim-deep" : "text-success-deep";
  const stapelFarg = ton === "fel" ? "bg-danger-deep/70" : ton === "avvikelse" ? "bg-warning" : ton === "preliminar" ? "bg-prelim" : "bg-success";

  return (
    <div className="min-w-[160px] flex-1">
      <div className="flex items-baseline justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${textFarg}`}>
          {!meets ? "⚠" : avviker ? `+${Math.round((margin! - 1) * 100)}%` : margin != null ? `${margin.toFixed(1)}×` : "✓"}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${stapelFarg}`}
          style={{ width: `${availPct}%` }}
        />
        <div
          className="absolute inset-y-0 w-[2px] bg-foreground/50"
          style={{ left: `${reqPct}%` }}
          title={`${requiredLabel}: ${required} ${unit}`}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>{requiredLabel} {required.toLocaleString()} {unit}</span>
        <span>{availableLabel} {available.toLocaleString()} {unit}</span>
      </div>
      {avviker && avvikelseNot && (
        <p className="mt-1.5 text-[10.5px] leading-snug text-warning-deep">{avvikelseNot}</p>
      )}
    </div>
  );
}

function DimensioningPanel({ locale, requirements, option, bordered = true }: {
  locale: string; requirements: Requirements | null; option: ActuatorOption; bordered?: boolean;
}) {
  const isSv = locale === "sv";
  if (!requirements || option.sku === "CUSTOM-SOLUTION") return null;

  const showForce = requirements.required_force_n != null && option.force_n != null;
  const showStroke = requirements.required_stroke_mm != null && option.stroke_mm != null;
  const showTorque = requirements.required_torque_nm != null && option.torque_nm != null;
  const showRotation = requirements.required_rotation_deg != null && option.rotation_deg != null;
  if (!showForce && !showStroke && !showTorque && !showRotation) return null;

  return (
    <div className={`flex flex-wrap gap-4 ${bordered ? "mt-3 pt-3 border-t border-border/60" : ""}`}>
      {showForce && (
        <div className="space-y-1">
          <DimensioningBar
            label={requirements.pressure_bar
              ? (isSv
                ? `Kraft @ ${requirements.pressure_bar} bar${requirements.pressure_assumed ? " (antaget)" : ""}`
                : `Force @ ${requirements.pressure_bar} bar${requirements.pressure_assumed ? " (assumed)" : ""}`)
              : (isSv ? "Matningskraft" : "Feed force")}
            required={requirements.required_force_n!}
            available={option.force_n!}
            unit="N"
            // En uträknad kraft är en uppskattning, inte ett krav (lådsorteringstestet).
            requiredLabel={requirements.force_preliminary ? (isSv ? "Uppskattning" : "Estimate") : (isSv ? "Krävs" : "Required")}
            availableLabel={isSv ? "Ger" : "Delivers"}
            preliminar={requirements.force_preliminary === true}
          />
          {/* Uträkningen bakom kravet, så att den går att granska. */}
          {requirements.force_basis && (
            <p className="text-xs text-muted-foreground max-w-md">{requirements.force_basis}</p>
          )}
        </div>
      )}
      {showTorque && (
        <DimensioningBar
          label={isSv ? "Vridmoment" : "Torque"}
          required={requirements.required_torque_nm!}
          available={option.torque_nm!}
          unit="Nm"
          requiredLabel={isSv ? "Krävs" : "Required"}
          availableLabel={isSv ? "Ger" : "Delivers"}
        />
      )}
      {showRotation && (
        <DimensioningBar
          label={isSv ? "Rörelseomfång" : "Rotation range"}
          required={requirements.required_rotation_deg!}
          available={option.rotation_deg!}
          unit="°"
          requiredLabel={isSv ? "Krävs" : "Required"}
          availableLabel={isSv ? "Klarar" : "Rated"}
        />
      )}
      {showStroke && (
        <DimensioningBar
          label={isSv ? "Slaglängd" : "Stroke"}
          required={requirements.required_stroke_mm!}
          available={option.stroke_mm!}
          unit="mm"
          requiredLabel={isSv ? "Krävs" : "Required"}
          availableLabel={isSv ? "Klarar" : "Rated"}
          overskottAr="avvikelse"
          avvikelseNot={isSv
            ? "Avviker från önskad slaglängd. Rörelsen måste begränsas mekaniskt eller med justerbart ändstopp."
            : "Deviates from the requested stroke. The motion must be limited mechanically or with an adjustable end stop."}
        />
      )}
    </div>
  );
}

// ── Verifieringsstatus, gemensam presentation ───────────────────────────────
// Texten och nivån för varje status kommer från src/lib/design/status.ts: en
// enda tabell för tabellen, CSV:n och PDF:en, så att en rad inte kan heta tre
// olika saker i de tre artefakter som når samma kund.
const BLOCKERANDE_STATUS = new Set(["kraver_verifiering", "ej_uppfyllt", "ej_godkand"]);

/** PDF:en byggs som HTML-sträng. Allt som stoppas in måste escapas. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Export helpers ──────────────────────────────────────────────────────────
//
// Statusen följer med ut sedan 2026-10-02. Fram till dess bar varken CSV:n
// eller PDF:en den: en stycklista där sju rader krävde verifiering och tre var
// ej uppfyllda lämnade sajten som en ren artikellista. Det är PDF:en som
// cirkulerar hos kundens inköp och konstruktion, alltså precis den artefakt
// där ett utelämnat förbehåll gör mest skada. Att ha kontrollen och inte
// skicka med den är sämre än att inte ha den.
function exportBomCsv(bom: BomLine[], title: string) {
  const header = "SKU,Namn,Antal,Roll,Motivering,Status,Statusskäl";
  const cit = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = bom.map(l =>
    [l.sku, cit(l.product?.name ?? ""), l.quantity, cit(l.role), cit(l.reason),
     cit(radensText(radStatus(l), "sv")), cit(l.verifieringsskal ?? "")].join(",")
  );
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stycklista-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** PDF:ens färgklass per nivå. Delvis prövat är inte grönt (status.ts). */
const PDF_KLASS: Partial<Record<Tillstand, string>> = {
  bekraftat: "status-ok", komplettering: "status-block", uppfyllerInte: "status-fel", ejProvat: "status-neutral",
};

function exportBomPdf(bom: BomLine[], title: string, explanation: string, selected: ActuatorOption, dom: Dom | null) {
  const rows = bom.map(l => {
    const blockerar = l.verifiering ? BLOCKERANDE_STATUS.has(l.verifiering) : false;
    return `
    <tr${blockerar ? ' class="blockerar"' : ""}>
      <td>${esc(l.sku)}</td>
      <td>${l.product?.name ? esc(l.product.name) : (l.sku === "SPECIFY" ? "<em>Specificera variant / kräver offert</em>" : "<em>Ej i katalog</em>")}</td>
      <td style="text-align:center">${esc(l.quantity)}</td>
      <td>${esc(l.role)}</td>
      <td>${esc(l.reason)}</td>
      <td>${l.verifiering ? `<span class="status ${PDF_KLASS[radensTillstand(radStatus(l))] ?? "status-neutral"}">${esc(radensText(radStatus(l), "sv"))}</span>` : ""}${
        l.verifieringsskal ? `<div class="skal">${esc(l.verifieringsskal)}</div>` : ""}</td>
    </tr>`;
  }).join("");

  const domBanner = dom && !dom.bestallningsklar ? `
<div class="dom">
  <strong>Denna stycklista är inte klar att beställa.</strong>
  <ul>${dom.blockerande.map(b =>
    `<li><strong>${esc(b.sku)}</strong> — ${esc(b.role)}: ${esc(b.skal)}</li>`).join("")}</ul>
  <p>Kontakta Maskinval så går vi igenom alternativen tillsammans.</p>
</div>` : "";

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8"/>
<title>Stycklista — ${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 20px; }
  .chip { display:inline-block; background:#f0f0f0; border-radius:4px; padding:2px 8px; font-size:11px; margin-right:6px; }
  table { width:100%; border-collapse:collapse; margin-top:16px; }
  th { background:#1e2a45; color:#fff; text-align:left; padding:8px 10px; font-size:11px; text-transform:uppercase; letter-spacing:.06em; }
  td { padding:7px 10px; border-bottom:1px solid #e5e7eb; vertical-align:top; }
  tr:nth-child(even) td { background:#f9fafb; }
  tr.blockerar td { background:#fff7ed; }
  .status { display:inline-block; font-size:10px; font-weight:bold; padding:1px 6px; border-radius:3px; white-space:nowrap; }
  .status-ok { background:#dcfce7; color:#14532d; }
  .status-block { background:#fed7aa; color:#7c2d12; }
  .status-neutral { background:#f1f5f9; color:#475569; }
  .status-fel { background:#fee2e2; color:#991b1b; }
  .skal { font-size:10px; color:#555; margin-top:3px; }
  .dom { border:2px solid #c2410c; background:#fff7ed; padding:12px 14px; margin:16px 0; }
  .dom strong { color:#7c2d12; }
  .dom ul { margin:8px 0 8px 18px; padding:0; font-size:11px; }
  .dom li { margin-bottom:4px; }
  .dom p { margin:0; font-size:11px; color:#7c2d12; }
  .footer { margin-top:32px; font-size:10px; color:#999; border-top:1px solid #e5e7eb; padding-top:12px; }
  @media print { body { margin: 16px; } }
</style>
</head>
<body>
<h1>Stycklista — ${title}</h1>
<div class="meta">
  Genererad ${new Date().toLocaleDateString("sv-SE")} &nbsp;·&nbsp; Maskinval
</div>
<p style="margin-bottom:16px;font-size:12px;color:#444;">${esc(explanation)}</p>
${domBanner}
<div>
  <span class="chip">Huvudkomponent: ${esc(selected.name)}</span>
  <span class="chip">${esc(selected.sku)}</span>
  ${selected.bore_mm ? `<span class="chip">Kolvdiameter: ${selected.bore_mm} mm</span>` : ""}
  ${selected.stroke_mm ? `<span class="chip">Slag: ${selected.stroke_mm} mm</span>` : ""}
  ${selected.force_n ? `<span class="chip">Kraft: ${selected.force_n} N</span>` : ""}
</div>
<table>
  <thead>
    <tr>
      <th>SKU</th><th>Namn</th><th style="text-align:center">Antal</th><th>Roll</th><th>Motivering</th><th>Status</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  ${bom.length} artiklar totalt &nbsp;·&nbsp; maskinval.se
</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

// ── Economic BOM helpers ────────────────────────────────────────────────────

/** Guess catalog category slug from BOM role text / SKU. Null = skip (hoses, fittings etc.) */
/**
 * Stabil komponenttyp -> katalogkategori.
 *
 * Servern sätter `kind` sedan steg 1 av maskinmodellen, och till skillnad från
 * `role` är den lokaloberoende. "actuator" är medvetet utelämnad: den kan vara
 * cylinder, electric-actuator, linear-module eller rotary-actuator, och det
 * avgörs av produktens egen kategori -- inte av en gissning.
 */
const KIND_TO_CATEGORY: Record<string, string> = {
  motor: "servo-motor", drive: "servo-drive",
  valve: "valve", valve_terminal: "valve-terminal", check_valve: "check-valve",
  flow_control: "flow-control", silencer: "silencer",
  frl: "frl", tubing: "tubing", fitting: "fitting",
  rod_lock: "rod-lock", shock_absorber: "shock-absorber", mount: "mounting",
  sensor: "sensor", cable: "cable",
};

/**
 * Kategorin för en stycklisterad, i fallande tillförlitlighet.
 *
 * Found 2026-09-08: roleToCategory() nedan regex-tolkar `role`, som är
 * LOKALISERAD visningstext, och mönstren täcker i praktiken bara svenska och
 * engelska. För en tysk eller spansk kund returnerade den null för nästan
 * varje rad, och då visades inga alternativ alls -- en hel funktion som tyst
 * försvann på två av fyra språk.
 *
 * Raden bär redan svaret: har SKU:n matchats mot katalogen finns produktens
 * egen kategori på den, och den är per definition rätt. Saknas produkten
 * (SPECIFY, varningsrader) duger serverns `kind`. Texttolkningen är kvar
 * sist, för sparade projekt vars rader skrevs innan `kind` fanns.
 */
function categoryForLine(line: BomLine): string | null {
  const fromProduct = line.product?.category?.slug;
  if (fromProduct) return fromProduct;
  const fromKind = line.kind ? KIND_TO_CATEGORY[line.kind] : undefined;
  if (fromKind) return fromKind;
  if (line.kind === "warning") return null; // annotation, ingen komponent
  return roleToCategory(line.role, line.sku);
}

function roleToCategory(role: string, sku: string): string | null {
  const r = role.toLowerCase();
  const s = sku.toLowerCase();

  // ── Elektrisk aktuator (före pneumatisk cylinder — mer specifik) ──────────
  if (/elektr|electric|servo|stepper|spindle|spindel|kugelgewind|ball.screw|linjär.*driv|linear.*driv|elektrisk.*axel|servo.*axel|elektrisk.*cylinder|electric.*cylinder/.test(r)
    || /dnce|epco|egsk|egsp|ley\b|lesh|lefs|lecp|6e-0|mw-elk/.test(s)) return "electric-actuator";

  // ── Linjärmodul / gantry / toothed-belt-axel ────────────────────────────
  if (/linjärmodul|linear.*modul|linjär.*axel|tandbältsaxel|toothed.belt|ball.screw.axis|gantry|kantilever|elektr.*glid|electrical.*slide|electric.*slide/.test(r)
    || /festo-155|festo-175|festo-530|festo-556|festo-562|festo-802|festo-811|festo-147|mw-s10/.test(s)
    || /festo-egc|festo-elga|parker-hmr|parker-hmrs|parker-hmrb|parker-lbb|parker-hlr|parker-ospe|parker-eth/.test(s)) return "linear-module";

  // ── Pneumatisk cylinder (standard) ──────────────────────────────────────
  if (/cylinder|aktuator|actuator|main act|axel \d/.test(r)
    || /dsbc|advu|cq2|cp96|p1d|advc|dsnu|mb\b|cena/.test(s)) return "cylinder";

  // ── Gripper ──────────────────────────────────────────────────────────────
  if (/gripper|grepp|k[aä]ft|jaw/.test(r) || /hgp|mhz|mhc|pgn/.test(s)) return "gripper";

  // ── Vakuum / ejektor ─────────────────────────────────────────────────────
  if (/vakuum.*gen|ejektor|vacuum.*gen|ejector/.test(r) || /vadmi|zu0|ovem/.test(s)) return "vacuum";

  // ── FRL (filter-regulator-lubricator) ────────────────────────────────────
  if (/frl|filter.*reg|luftbered|air.*prep|tryckreducer/.test(r)
    || /ms4|ms6\b|lf\b|aw\d|ac\d|festo-ms|mc-fr|mc-frl|mx-fr|mw-frl/.test(s)) return "frl";

  // ── Styrventil (solenoid) ────────────────────────────────────────────────
  if (/styrventil|kontrollventil|control.*valve|solenoid|magnetventil/.test(r)
    && !/terminal/.test(r)) return "valve";

  // ── Ventilterminal ───────────────────────────────────────────────────────
  if (/ventilterminal|valve.*terminal/.test(r) || /vtsa|vtug|mpa-s|ex500/.test(s)) return "valve-terminal";

  // ── Sensor / ändlägesgivare ──────────────────────────────────────────────
  if (/givare|sensor|ändl[äa]ge|end.pos|reed|proximity|närhets|tryckvakt|pressure.*switch/.test(r)
    || /smt-|sme-|sies|siet|d-a7|d-a9|d-m9|zse/.test(s)) return "sensor";

  // ── Koppling / push-in fitting ───────────────────────────────────────────
  if (/koppling|fitting|anslut|push.?in|snabbanslut|kd3/.test(r)
    || /^qs-|^qs[lsyt]-|kq2|kd3/.test(s)) return "fitting";

  // ── Slang / tubing ───────────────────────────────────────────────────────
  if (/slang|slange|tub|tube|hose|rör/.test(r) || /^pan-|^tu\d|^pun/.test(s)) return "tubing";

  // ── Ljuddämpare ──────────────────────────────────────────────────────────
  if (/ljuddämp|silencer|muffler|avgasdämp/.test(r) || /^u-1|^u-m|^an[12]|^an5/.test(s)) return "silencer";

  // ── Flödesreglering / hastighetsstyrventil ───────────────────────────────
  if (/stryp|flödesregl|speed.*control|hastighetsstyr|flow.*control|snabbutluft|quick.*exhaust/.test(r)
    || /^grla|^grlz|^as\d|vfoe|vhs/.test(s)) return "flow-control";

  // ── Fäste / monteringstillbehör ──────────────────────────────────────────
  if (/fäst|mount|bracket|konsol|adapter|gaffel|sväng|pivot|flange|foot/.test(r)
    || /^hnc-|^sncs|^fnc-|^crhn|cs16|^la-/.test(s)) return "mounting";

  // ── Sensorkabel ──────────────────────────────────────────────────────────
  if (/kabel|cable|ledning|sensor.*kabel/.test(r) || /nebu|^e2-m/.test(s)) return "cable";

  return null;
}

/** Ett tal ur ett svar ur sifferfältet ("12", "12,5"); 0 för "Vet inte" och tomt. */
function svarTal(v: string | undefined): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Parse minimum technical requirements from the user's question answers. */
function parseRequirements(answers: Record<string, string>) {
  // Min force (N) from weight answer
  const w = answers.weight ?? "";
  let minForce =
    /< 1|under 1/i.test(w)  ? 20  :
    /1.{0,3}5 kg/i.test(w)  ? 75  :
    /5.{0,3}20/i.test(w)    ? 300 :
    /20.{0,3}50/i.test(w)   ? 750 :
    /> 50|50 kg/i.test(w)   ? 1500 : 0;

  // Min stroke (mm) — check stroke, stroke_z, stroke_x
  const s = [answers.stroke, answers.stroke_z, answers.stroke_x].filter(Boolean).join(" ");
  let minStroke =
    /< 50/i.test(s)        ? 0   :
    /50.{0,3}150/i.test(s) ? 50  :
    /150.{0,3}300/i.test(s)? 150 :
    /300.{0,3}500/i.test(s)? 300 :
    /> 500/i.test(s)       ? 500 : 0;

  // Följdfrågorna i fragor.ts svarar med tal under egna nycklar. Fram till
  // 2026-10-11 lästes de inte här, så alternativen filtrerades aldrig mot den
  // vikt, kraft och slaglängd kunden angett. En angiven kraft är kravet; en
  // vikt får samma säkerhetsfaktor som motorn använder.
  const kraft = svarTal(answers.kraft_n);
  const kg = svarTal(answers.last_kg);
  if (kraft > 0) minForce = Math.max(minForce, Math.round(kraft));
  else if (kg > 0) minForce = Math.max(minForce, Math.round(kg * 9.81 * LOAD_SAFETY_FACTOR));
  minStroke = Math.max(minStroke, svarTal(answers.slaglangd_mm), svarTal(answers.slag_z_hojd_mm), svarTal(answers.slag_x_sidled_mm));

  // IP requirement from environment
  const env = `${answers.environment ?? ""} ${answers.miljo ?? ""}`;
  const needsHighIP = /livsmedel|washdown|ip6|högtrycksspolas|tvättas/i.test(env);

  return { minForce, minStroke, needsHighIP };
}

/** Approximate force in N at 6 bar for a bore_mm. */
/**
 * Kraften en borrning kan räknas med vid 6 bar. Använder husets kraftmodell
 * (usableForceN i physics.ts), som räknar in tätningsfriktion.
 *
 * Ändrad 2026-09-09: räknade tidigare TEORETISK kraft och jämförde den mot
 * kundens kraftkrav nedan, vilket släppte igenom cylindrar som inte klarar
 * kravet i verkligheten. En Ø40 ser ut att ge 754 N men levererar 565 N.
 */
const boreForce = (bore: number) => usableForceN(bore);

export interface AltTiers {
  economic: ProductRow[];  // meets requirements, lowest price
  best:     ProductRow[];  // meets requirements, most force/stroke
  compact:  ProductRow[];  // meets requirements, smallest bore
}

/**
 * Find tiered alternatives for one BOM line, filtered by the customer's stated requirements.
 * All alternatives must be a different brand AND meet min force + min stroke from answers.
 */
function findAlternativesTiered(
  line: BomLine,
  catalog: ProductRow[],
  answers: Record<string, string>,
): AltTiers {
  const cat = categoryForLine(line);
  if (!cat) return { economic: [], best: [], compact: [] };

  const { minForce, minStroke, needsHighIP } = parseRequirements(answers);
  const currentBrand = line.product?.brand?.slug ?? "";
  const currentBore  = parseFloat(line.product?.specs["bore_mm"]?.value ?? "0");
  const isCylinder   = cat === "cylinder";
  const isElectric   = cat === "electric-actuator" || cat === "linear-module";

  const candidates = catalog.filter(p => {
    if (p.brand.slug === currentBrand) return false;
    if (!p.category.slug.includes(cat)) return false;

    // Elektriska aktuatorer och linjärmoduler — enkelt filter, ingen bore-logik
    if (isElectric) return true;

    if (isCylinder) {
      const bore   = parseFloat(p.specs["bore_mm"]?.value ?? "0");
      const stroke = parseFloat(p.specs["stroke_max"]?.value ?? p.specs["stroke_mm"]?.value ?? "0");

      if (bore <= 0) return false;
      // Borrningsband. Var ±25 mm ABSOLUT, vilket är oförsvarbart vid små
      // borrningar: för en Ø10 tillät det Ø35, som ger drygt tolv gånger
      // kraften (kraften skalar med arean, alltså med diametern i kvadrat).
      // Ingenting annat i filtret fångade det -- minForce sållar bara bort de
      // för SVAGA, och bara när kunden angett en kraft.
      // Relativt band i stället, med ett golv så listan inte töms vid små
      // borrningar: ±30 % eller ±6 mm, det största av dem. För Ø25 ger det
      // Ø17,5–32,5, alltså de närmaste ISO-storlekarna Ø20/Ø25/Ø32.
      const boreBand = Math.max(currentBore * 0.30, 6);
      if (currentBore > 0 && Math.abs(bore - currentBore) > boreBand) return false;
      // Must deliver enough force
      if (minForce > 0 && boreForce(bore) < minForce) return false;
      // Must have enough stroke
      if (minStroke > 0 && stroke > 0 && stroke < minStroke) return false;
      // IP requirement
      if (needsHighIP) {
        const ip = p.ip_rating ?? "";
        if (ip && !/6[79]/i.test(ip)) return false;
      }
    }
    return true;
  });

  // Deduplicate by sku across tiers
  const used = new Set<string>();
  const pick = (sorted: ProductRow[], n = 2) =>
    sorted.filter(p => !used.has(p.sku)).slice(0, n).map(p => { used.add(p.sku); return p; });

  const byPrice     = [...candidates].sort((a, b) => {
    if (a.purchase_price == null && b.purchase_price != null) return 1;
    if (a.purchase_price != null && b.purchase_price == null) return -1;
    return (a.purchase_price ?? 0) - (b.purchase_price ?? 0);
  });
  const byForce     = [...candidates].sort((a, b) => {
    const bA = parseFloat(a.specs["bore_mm"]?.value ?? "0");
    const bB = parseFloat(b.specs["bore_mm"]?.value ?? "0");
    return isCylinder ? bB - bA : (b.purchase_price ?? 0) - (a.purchase_price ?? 0);
  });
  const byCompact   = [...candidates]
    .filter(p => {
      const bore = parseFloat(p.specs["bore_mm"]?.value ?? "0");
      return !isCylinder || (bore > 0 && bore <= (currentBore || 999));
    })
    .sort((a, b) => {
      const bA = parseFloat(a.specs["bore_mm"]?.value ?? "0");
      const bB = parseFloat(b.specs["bore_mm"]?.value ?? "0");
      return bA - bB;
    });

  const economic = pick(byPrice);
  const best     = pick(byForce);
  const compact  = pick(byCompact);

  return { economic, best, compact };
}

/**
 * Det som avgör om ett sparat projekt behöver skrivas om: beskrivningen,
 * svaren och stycklistans artiklar. Produktnamn och katalogdata ingår inte --
 * de fylls i efter laddning och ska inte ge projektet en ny revision.
 */
function projektinnehall(description: string, answers: Record<string, string>, bom: Array<{ sku: string; role: string; quantity: number }>): string {
  return JSON.stringify({ d: description.trim(), a: answers, b: bom.map(l => [l.sku, l.role, l.quantity]) });
}

// ── Result Step ─────────────────────────────────────────────────────────────
function ResultStep({ t, locale, title, explanation, resultat, selected, requirements, bom, dom, connections, catalog, description, answers,
  rfqName, rfqEmail, rfqCompany, rfqPhone, rfqPoNumber, rfqOrgNumber, rfqSent, rfqId, autoSaved, projektId, onProjektSparat,
  setRfqName, setRfqEmail, setRfqCompany, setRfqPhone, setRfqPoNumber, setRfqOrgNumber, setRfqSent, setRfqId, onRestart, onBack }: {
  t: (key: import("@/lib/i18n").TKey) => string; locale: string; title: string; explanation: string; resultat: ResultatData | null;
  selected: ActuatorOption; requirements: Requirements | null; bom: BomLine[]; dom: Dom | null; connections: BomConnection[]; catalog: ProductRow[]; description: string; answers: Record<string, string>;
  rfqName: string; rfqEmail: string; rfqCompany: string; rfqPhone: string; rfqPoNumber: string; rfqOrgNumber: string;
  rfqSent: boolean; rfqId: string; autoSaved: boolean;
  projektId: string | null; onProjektSparat: (id: string) => void;
  setRfqName: (v: string) => void; setRfqEmail: (v: string) => void;
  setRfqCompany: (v: string) => void; setRfqPhone: (v: string) => void; setRfqPoNumber: (v: string) => void;
  setRfqOrgNumber: (v: string) => void;
  setRfqSent: (v: boolean) => void; setRfqId: (v: string) => void;
  onRestart: () => void; onBack: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [rfqLoading, setRfqLoading] = useState(false);
  const [rfqError, setRfqError] = useState("");
  const [rfqHp, setRfqHp] = useState(""); // honeypot — real users never see or fill this
  // Save project
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectSaved, setProjectSaved] = useState(false);
  const [configFamilies, setConfigFamilies] = useState<Set<string>>(new Set());
  useEffect(() => {
    supabase.from("configurator_families").select("slug")
      .then(({ data }) => setConfigFamilies(new Set((data ?? []).map((r: { slug: string }) => r.slug))));
  }, []);
  const { user } = useAuth();
  // Economic BOM
  const [ecoMode, setEcoMode] = useState(false);
  const [chosenAlt, setChosenAlt] = useState<Record<number, ProductRow | null>>({});
  useEffect(() => setMounted(true), []);

  // Per-line tiered alternatives — respects customer's stated requirements
  const alternatives = useMemo(() =>
    bom.map(line => findAlternativesTiered(line, catalog, answers)),
    [bom, catalog, answers]
  );

  // Active BOM: merge chosen alts
  const activeBom: BomLine[] = useMemo(() =>
    bom.map((line, i) => {
      const alt = chosenAlt[i];
      if (!alt) return line;
      return { ...line, sku: alt.sku, product: alt };
    }),
    [bom, chosenAlt]
  );

  async function saveProject() {
    if (!user || !projectName.trim()) return;
    setProjectSaving(true);
    if (projektId) {
      // "Byt namn" på det autosparade projektet byter namn på det -- förut
      // skapades en kopia med det nya namnet, och anteckningen ersatte
      // maskinens beskrivning i kopian.
      await supabase.from("projects").update({ name: projectName.trim() }).eq("id", projektId);
    } else {
      const bomSnapshot = activeBom.map(l => ({
        sku: l.sku, role: l.role, qty: l.quantity,
        name: l.product?.name ?? l.sku,
      }));
      // Anteckningen följer stycklistan; projektets beskrivning är maskinens,
      // så att projektet öppnas med rätt beskrivning och PLC-modulen läser
      // rätt krav.
      const bomId = await saveBomNormalized(user.id, activeBom, projectDesc, connections);
      const { data } = await supabase.from("projects").insert({
        user_id: user.id,
        name: projectName.trim(),
        description: description.trim() || null,
        locale,
        answers,
        bom_lines: bomSnapshot,
        bom_id: bomId,
      }).select("id").single();
      if (data) onProjektSparat(data.id);
    }
    setProjectSaving(false);
    setProjectSaved(true);
    setShowSaveModal(false);
    setProjectName("");
    setProjectDesc("");
  }

  async function submitRfq() {
    if (!rfqName.trim() || !rfqEmail.trim()) return;
    setRfqLoading(true);
    setRfqError("");
    try {
      // Build message summary from active BOM (may include economic alternatives)
      const bomSummary = activeBom
        .slice(0, 8)
        .map(l => `${l.sku} × ${l.quantity} (${l.role})`)
        .join(", ");
      const message = `${description}\n\nStycklista: ${bomSummary}`;

      // submit_rfq() creates the rfq row + its items atomically, server-side.
      // user_id is derived from auth.uid() inside the function (null if
      // anonymous) — never client-supplied. See migration
      // 20260819163000_submit_rfq_function.sql: rfq_items has no
      // client-facing INSERT policy (this used to silently drop every BOM
      // here, undetected — nothing checked the old insert's error), and an
      // anonymous caller can't satisfy the rfqs SELECT policy to read back a
      // plain insert's result, which is why every real guest submission has
      // been failing at this exact step until now.
      const itemsPayload = activeBom
        .map(l => {
          const product = l.product ?? catalog.find(p => p.sku === l.sku);
          return product ? { product_id: product.id, qty: l.quantity, role: l.role } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const { data: newRfqId, error: rfqErr } = await supabase.rpc("submit_rfq", {
        p_title: title || `Maskinbyggare — ${selected.name}`,
        p_contact_name: rfqName.trim(),
        p_contact_email: rfqEmail.trim(),
        p_contact_phone: rfqPhone.trim(),
        p_company: rfqCompany.trim(),
        p_org_number: rfqOrgNumber.trim(),
        p_po_number: rfqPoNumber.trim(),
        p_message: message,
        p_items: itemsPayload,
        p_hp: rfqHp,
        // Maskinbyggaren frågar efter PRISER på det man ritat; en beställning
        // läggs från inköpslistan. Avsikten anges uttryckligen sedan
        // offert och order skildes åt.
        p_intent: "quote",
      });

      if (rfqErr || !newRfqId) throw rfqErr ?? new Error("No id returned");

      const orderRef = newRfqId.slice(0, 8).toUpperCase();
      setRfqId(orderRef);
      setRfqSent(true);

      // No order is created here — an order only exists once a real quote is
      // accepted (respond_to_quote(), triggered from the customer's offert
      // page), same as the shopping-list.tsx flow. This used to also insert an
      // "orders" row immediately on submission, priced from purchase_price —
      // internal cost, never a customer-facing price — and before anyone had
      // even reviewed the request. Removed rather than fixed in place: the
      // real order-creation path already exists and is the single source of
      // truth for order totals/lifecycle, so this was redundant as well as
      // wrong.

      // Fire-and-forget: admin notification + customer confirmation email.
      // rfq-notify re-reads the rest from the rfq_id row it's given — see that
      // function's own header comment for why it doesn't trust a client payload.
      fetch("https://buqfbcztspswezwyafxo.supabase.co/functions/v1/rfq-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfq_id: newRfqId }),
      }).catch(console.error);
    } catch (e) {
      console.error(e);
      setRfqError(locale === "sv"
        ? "Kunde inte skicka förfrågan. Försök igen."
        : "Could not submit request. Please try again.");
    } finally {
      setRfqLoading(false);
    }
  }

  const compareSkus = activeBom
    .filter(l => l.product)
    .slice(0, 4)
    .map(l => l.sku)
    .join(",");

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="arbetsyta px-5 py-5 sm:px-6">
        <p className="text-xs font-medium text-muted-foreground">{t("machineBuilder.yourSolution")}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-primary">{title}</h2>
        {/* Med strukturerat resultat visas princip och kravbild här och resten
            i statusdelen nedan; ett öppnat projekt har bara texten. */}
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {resultat ? resultat.text.split("\n\n").slice(0, 2).join("\n\n") : explanation}
        </p>
      </div>

      {resultat && <Resultatstatus locale={locale} resultat={resultat} />}

      {/* Calculated dimensioning — required vs available, for the chosen actuator */}
      {requirements && (requirements.required_force_n != null || requirements.required_stroke_mm != null) && (
        <div className="kort px-5 py-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {locale === "sv" ? "Dimensionering: " : "Dimensioning: "}<span className="font-normal text-muted-foreground">{selected.name}</span>
          </h3>
          <DimensioningPanel locale={locale} requirements={requirements} option={selected} bordered={false} />
        </div>
      )}

      {/* System overview — schematic + component cards */}
      <BomSystemView bom={bom} connections={connections} selected={selected} locale={locale} />

      {/* BOM Table */}
      <div className="arbetsyta overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-start sm:items-center justify-between flex-wrap gap-2 sm:px-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm font-semibold">{t("machineBuilder.bomTitle")}</div>
            {/* Alternatives toggle */}
            {alternatives.some(a => a.economic.length + a.best.length + a.compact.length > 0) && (
              <button
                onClick={() => { setEcoMode(v => !v); if (!ecoMode) setChosenAlt({}); }}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition ${
                  ecoMode
                    ? "bg-success-surface text-success-deep border-success"
                    : "border-success text-success-deep hover:bg-success-surface/50"
                }`}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                {ecoMode ? t("machineBuilder.altProductsClose") : t("machineBuilder.altProductsBtn")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {compareSkus && (
              <a
                href={`/${locale}/compare?skus=${encodeURIComponent(compareSkus)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-info transition"
              >
                ⇔ {t("machineBuilder.compareBom")}
              </a>
            )}
            <button
              onClick={() => exportBomCsv(activeBom, title)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-info transition"
            >
              ↓ CSV
            </button>
            <button
              onClick={() => exportBomPdf(activeBom, title, explanation, selected, dom)}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              ↓ PDF
            </button>
          </div>
        </div>
        {/* Serverns dom. Fram till 2026-10-01 räknade servern ut en status per
            rad och en samlad bedömning -- och skickade ingendera vidare, så en
            rad märkt "ej uppfyllt" syntes aldrig för den som skulle beställa.
            Offertknappen längre ned står kvar med flit: när lösningen inte går
            ihop är det att prata med en människa som ÄR nästa steg, inte en
            vägg. */}
        {dom && !dom.bestallningsklar && (
          <div className="mx-4 my-4 rounded-lg border border-warning-deep/20 bg-warning-surface px-4 py-3 sm:mx-5" role="status">
            <div className="flex items-start gap-2">
              <span className="text-warning-deep shrink-0 mt-0.5" aria-hidden>⚠</span>
              <div className="space-y-2 min-w-0">
                <p className="text-sm font-semibold text-warning-deep">
                  {t("machineBuilder.notOrderReady")}
                </p>
                <ul className="space-y-1.5">
                  {dom.blockerande.map((b, i) => (
                    <li key={`${b.sku}-${i}`} className="text-[13px] text-foreground">
                      <span className="tabular font-medium">{b.sku === "SPECIFY" ? "—" : b.sku}</span>
                      <span className="text-muted-foreground"> {b.role}: </span>
                      {b.skal}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {t("machineBuilder.notOrderReadyHelp")}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-alt/60">
                <th className="w-12 px-2 py-2.5" aria-label="Bild" />
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">SKU</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("machineBuilder.nameCol")}</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("machineBuilder.qtyCol")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("machineBuilder.roleCol")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden xl:table-cell">{t("machineBuilder.reasonCol")}</th>
              </tr>
            </thead>
            <tbody>
              {activeBom.map((line, i) => {
                const originalLine = bom[i];
                const isSwapped = !!chosenAlt[i];

                return (
                  <>
                    <tr key={i} className={`border-b border-line last:border-0 align-top transition-colors ${
                      isSwapped ? "bg-success-surface/30" : ""
                    }`}>
                      <td className="px-2 py-2 w-12">
                        {/* Samma ritning som katalogen visar för produkten. Förut fick
                            stycklistan AI-bilder eller en 📦, medan katalogen
                            visade ritningar -- två bilder av samma artikel. */}
                        {line.product ? (
                          <img
                            src={getProductImage(line.product)}
                            alt={produktnamn(line.product, locale)}
                            className="size-10 object-contain rounded border border-border bg-white p-0.5"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-10 rounded border border-border bg-muted flex items-center justify-center text-muted-foreground">
                            <Package className="size-4" aria-hidden />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {line.product ? (
                          <Link
                            to="/$locale/product/$sku"
                            params={{ locale, sku: line.sku } as never}
                            className="font-mono text-xs text-info hover:underline"
                          >{line.sku}</Link>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{line.sku === "SPECIFY" ? "—" : line.sku}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          {visatNamn(line.product, locale) ?? <span className="text-muted-foreground italic">{line.sku === "SPECIFY" ? t("machineBuilder.specifyVariant") : t("machineBuilder.notInCatalog")}</span>}
                          {(() => {
                            const fam = line.product?.family?.toLowerCase().trim();
                            return fam && configFamilies.has(fam) ? (
                              <Link
                                to="/$locale/configurator/$family"
                                params={{ locale, family: fam } as never}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-foreground text-background font-semibold hover:opacity-90 inline-flex items-center gap-1"
                              ><Settings className="size-3 inline -mt-0.5 mr-1" aria-hidden />{t("common.configure")}</Link>
                            ) : null;
                          })()}
                          {isSwapped && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-surface text-success-deep font-semibold">
                              {t("machineBuilder.altSwappedBadge")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center size-6 rounded bg-muted text-xs font-semibold">{line.quantity}</span>
                      </td>
                      {/* Statusen sitter i rollcellen och inte i en egen kolumn: tabellen
                          har redan sex kolumner och döljer motiveringen på mobil, och
                          alternativraden under spänner över ett fast antal celler. Här
                          syns den på alla bredder, bredvid den roll den gäller.

                          Fram till 2026-10-02 visades statusen inte alls. Servern räknade
                          ut den per rad, och kunden såg bara de BLOCKERANDE raderna i en
                          banner ovanför -- ordet "verifierad" nådde aldrig skärmen. */}
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <div>{line.role}</div>
                        {line.reason && (
                          <details className="mt-1 text-xs xl:hidden">
                            <summary className="cursor-pointer text-info hover:underline w-fit">{t("machineBuilder.reasonCol")}</summary>
                            <p className="mt-1 max-w-xs text-muted-foreground">{line.reason}</p>
                          </details>
                        )}
                        {line.verifiering && (
                          <div className="mt-1">
                            <Statusmarke
                              tillstand={radensTillstand(radStatus(line))}
                              text={radensText(radStatus(line), locale)}
                              title={line.verifieringsskal ?? undefined}
                              locale={locale}
                            />
                            {line.verifieringsskal && (
                              <details className="mt-1 text-xs">
                                <summary className="cursor-pointer text-info hover:underline w-fit">{locale === "sv" ? "Vad som prövats" : "What was checked"}</summary>
                                <p className="mt-1 text-muted-foreground max-w-xs">{line.verifieringsskal}</p>
                                {line.kontroller && line.kontroller.length > 0 && (
                                  <ul className="mt-1 space-y-0.5">
                                    {line.kontroller.map((k, i) => (
                                      <li key={i} className="text-muted-foreground">
                                        <span className="text-foreground">{k.krav}</span>: {utfalletsText(k.utfall, locale)}{k.text ? ` (${k.text})` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </details>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">{line.reason}</td>
                    </tr>

                    {/* Tiered alternatives row */}
                    {ecoMode && (() => {
                      const tiers = alternatives[i];
                      const hasAny = tiers.economic.length + tiers.best.length + tiers.compact.length > 0;
                      if (!hasAny) return null;

                      const AltChip = ({ alt, tier }: { alt: ProductRow; tier: string }) => {
                        const isChosen = chosenAlt[i]?.sku === alt.sku;
                        const bore     = alt.specs["bore_mm"]?.value;
                        const stroke   = alt.specs["stroke_max"]?.value ?? alt.specs["stroke_mm"]?.value;
                        return (
                          <button
                            onClick={() => setChosenAlt(prev => ({ ...prev, [i]: isChosen ? null : alt }))}
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                              isChosen
                                ? "border-info bg-info/10 text-info font-semibold"
                                : "border-border bg-card text-foreground hover:border-info/60"
                            }`}
                          >
                            <span className="text-muted-foreground text-[10px]">{alt.brand.name}</span>
                            <span className="font-medium truncate max-w-[140px]">{produktnamn(alt, locale).split(" ").slice(0,4).join(" ")}</span>
                            {bore && <span className="font-mono text-[10px] text-muted-foreground">⌀{bore}</span>}
                            {stroke && <span className="font-mono text-[10px] text-muted-foreground">{stroke}mm</span>}
                            {isChosen && <span className="text-info">✓</span>}
                          </button>
                        );
                      };

                      const TIERS: { key: keyof AltTiers; icon: React.ReactNode; label: string; hint: string }[] = [
                        { key: "economic", icon: <RefreshCw className="size-3.5 inline -mt-0.5" aria-hidden />, label: t("machineBuilder.altTierEconomic"), hint: t("machineBuilder.altHintEconomic") },
                        { key: "best",     icon: <Award className="size-3.5 inline -mt-0.5" aria-hidden />, label: t("machineBuilder.altTierBest"),     hint: t("machineBuilder.altHintBest") },
                        { key: "compact",  icon: <Ruler className="size-3.5 inline -mt-0.5" aria-hidden />, label: t("machineBuilder.altTierCompact"),  hint: t("machineBuilder.altHintCompact") },
                      ];

                      return (
                        <tr key={`eco-${i}`} className="border-b border-border/60 bg-surface-alt/50">
                          <td colSpan={5} className="px-4 py-2.5">
                            <div className="space-y-1.5">
                              <p className="text-[11px] text-muted-foreground mb-1">{t("machineBuilder.altProductsHint")}</p>
                              {TIERS.map(({ key, icon, label, hint }) => {
                                const items = tiers[key];
                                if (!items.length) return null;
                                return (
                                  <div key={key} className="flex items-center gap-2 flex-wrap min-h-[28px]">
                                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0 flex items-center gap-1" title={hint}>
                                      <span>{icon}</span> {label}
                                    </span>
                                    {items.map(alt => <AltChip key={alt.sku} alt={alt} tier={key} />)}
                                  </div>
                                );
                              })}
                              {isSwapped && (
                                <div className="pt-0.5">
                                  <button
                                    onClick={() => setChosenAlt(prev => ({ ...prev, [i]: null }))}
                                    className="text-[11px] text-muted-foreground hover:text-foreground transition"
                                  >
                                    {t("machineBuilder.altResetSwap")}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{bom.length} {t("machineBuilder.articlesTotal")}</span>
          {/* Hur mycket som FAKTISKT prövades. Tillagt 2026-10-02: fyra typfall
              kom tillbaka "beställningsklar" med varenda rad "inga krav" --
              alltså noll kontroller. Ingenting blockerade, vilket är sant, men
              utan den här raden läser kunden tystnaden som ett godkännande. */}
          {dom?.kontrollerat && (
            <span className={dom.kontrollerat.verifierade === 0 ? "text-warning-deep" : ""}>
              · {dom.kontrollerat.verifierade} {t("machineBuilder.ofTotal")} {dom.kontrollerat.rader} {t("machineBuilder.ofRowsChecked")}
              {/* "Inga krav" bara när inget prövades alls: en rad som föll
                  mot ett krav är prövad (granskningen 2026-10-14). */}
              {dom.kontrollerat.verifierade === 0 && dom.kontrollerat.blockerande === 0 &&
                (dom.kontrollerat.med_luckor ?? 0) === 0 && (dom.kontrollerat.underlag_saknas ?? 0) === 0 &&
                ` — ${t("machineBuilder.nothingChecked")}`}
              {(dom.kontrollerat.med_luckor ?? 0) > 0 && (locale === "sv"
                ? ` · ${dom.kontrollerat.med_luckor} med krav som inte kunde prövas`
                : ` · ${dom.kontrollerat.med_luckor} with requirements that could not be checked`)}
            </span>
          )}
        </div>
      </div>

      {/* RFQ */}
      <div className="kort p-5 sm:p-6">
        <h3 className="font-semibold text-foreground mb-1">{t("machineBuilder.sendQuote")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("machineBuilder.sendQuoteBody")}
        </p>
        {rfqSent ? (
          <div className="rounded-lg border border-success/30 bg-success-surface text-success-deep px-4 py-4 space-y-1 rorelse-fram" role="status">
            <div className="font-semibold text-sm">✓ {t("machineBuilder.quoteThankYou")}</div>
            {rfqId && (
              <div className="text-xs opacity-80">
                Referens: <span className="font-mono font-semibold">{rfqId}</span>. Vi återkommer inom 1–2 arbetsdagar.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Synliga etiketter ovanför fälten; platshållaren är bara ett exempel.
                Samma fält i samma ordning som förut. */}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("machineBuilder.yourNamePlaceholder")}</span>
                <input autoComplete="name" value={rfqName} onChange={e => setRfqName(e.target.value)}
                  className="h-11 w-full px-3 rounded-lg border border-input bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-cta/40" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("machineBuilder.emailPlaceholder")}</span>
                <input type="email" autoComplete="email" value={rfqEmail} onChange={e => setRfqEmail(e.target.value)}
                  className="h-11 w-full px-3 rounded-lg border border-input bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-cta/40" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{locale === "sv" ? "Företag (valfritt)" : "Company (optional)"}</span>
                <input autoComplete="organization" value={rfqCompany} onChange={e => setRfqCompany(e.target.value)}
                  className="h-11 w-full px-3 rounded-lg border border-input bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-cta/40" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{locale === "sv" ? "Telefon (valfritt)" : "Phone (optional)"}</span>
                <input type="tel" autoComplete="tel" value={rfqPhone} onChange={e => setRfqPhone(e.target.value)}
                  className="h-11 w-full px-3 rounded-lg border border-input bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-cta/40" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("ordersPage.poNumber")} {locale === "sv" ? "(valfritt)" : "(optional)"}</span>
                <input value={rfqPoNumber} onChange={e => setRfqPoNumber(e.target.value)}
                  placeholder={locale === "sv" ? "t.ex. från SAP eller Ariba" : "e.g. from SAP or Ariba"}
                  className="h-11 w-full px-3 rounded-lg border border-input bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-cta/40 font-mono" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{locale === "sv" ? "Organisationsnummer (valfritt)" : "Company registration number (optional)"}</span>
                <input value={rfqOrgNumber} onChange={e => setRfqOrgNumber(e.target.value)}
                  placeholder="556000-0000"
                  className="h-11 w-full px-3 rounded-lg border border-input bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-cta/40 font-mono" />
              </label>
            </div>
            {/* Honeypot — hidden from real users via CSS, not `type="hidden"`,
                so form-filling bots that read layout still find and fill it. */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={rfqHp}
              onChange={(e) => setRfqHp(e.target.value)}
              className="absolute -left-[9999px] w-px h-px opacity-0"
              aria-hidden="true"
            />
            {rfqError && <p className="text-xs text-destructive">{rfqError}</p>}
            <button
              onClick={submitRfq}
              disabled={!rfqName.trim() || !rfqEmail.trim() || rfqLoading}
              className="w-full sm:w-auto inline-flex h-11 items-center justify-center px-6 rounded-lg bg-cta text-cta-foreground text-sm font-semibold shadow-xs hover:bg-cta-hover active:translate-y-px disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none transition-[background-color,transform]"
            >
              {rfqLoading ? t("shoppingList.sending") : t("machineBuilder.sendButton")}
            </button>
          </div>
        )}
      </div>

      {/* Save project */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        {user ? (
          (projectSaved || autoSaved) ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-success-deep font-medium" role="status">
              ✓ {autoSaved && !projectSaved ? t("projects.autoSaved" as never) : t("projects.saved")}
              <Link to="/$locale/projects" params={{ locale } as never} className="underline text-info">
                → {t("projects.title")}
              </Link>
              {autoSaved && !projectSaved && (
                <button
                  onClick={() => { setProjectName(title || ""); setShowSaveModal(true); }}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {t("projects.rename" as never)}
                </button>
              )}
            </span>
          ) : (
            <button
              onClick={() => setShowSaveModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary hover:text-primary-foreground transition"
            >
              <Save className="size-4 inline -mt-0.5 mr-1" aria-hidden />{t("projects.saveBtn")}
            </button>
          )
        ) : (
          <Link to="/$locale/login" params={{ locale } as never}
            className="text-xs text-muted-foreground hover:text-info">
            <Lock className="size-4 inline -mt-0.5 mr-1" aria-hidden />{t("projects.notLoggedIn")}
          </Link>
        )}
      </div>

      {/* Ingång A till PLC-modulen: kraven och komponenterna följer med projektet. */}
      <div className="kort flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/[0.06] text-primary" aria-hidden>
          <Cpu className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-foreground">
          {locale === "sv" ? "Komplettera maskinen med styrning och programmering" : "Complete the machine with control and programming"}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {locale === "sv"
            ? "Vi återanvänder maskinens krav och komponenter. Du kompletterar endast det som saknas."
            : "We reuse the machine's requirements and components. You only add what is missing."}
        </p>
        <div className="mt-3">
          {user ? (
            projektId ? (
              <Link
                to="/$locale/plc/$projektId"
                params={{ locale: locale as Locale, projektId }}
                className="inline-flex h-10 items-center px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-xs hover:bg-primary/90 active:translate-y-px transition-[background-color,transform]"
              >
                {locale === "sv" ? "Lägg till PLC & programmering" : "Add PLC & programming"}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {locale === "sv" ? "Sparar projektet …" : "Saving the project …"}
              </span>
            )
          ) : (
            <Link
              to="/$locale/login"
              params={{ locale: locale as Locale }}
              search={{ redirect: `/${locale}/machine-builder` }}
              onClick={() => {
                // Resultatet följer med genom inloggningen och sparas sedan
                // som ett nytt projekt (inget id), så att PLC-modulen kan öppnas.
                try {
                  sessionStorage.setItem("mv_load_project", JSON.stringify({
                    id: "", name: title || selected.name, description, answers, locale,
                    bom_lines: activeBom.map(l => ({ sku: l.sku, role: l.role, qty: l.quantity, name: l.product?.name ?? l.sku })),
                  }));
                } catch {
                  // sessionStorage kan vara blockerat i privat läge
                }
              }}
              className="inline-flex h-10 items-center gap-1.5 px-4 rounded-lg border border-primary/30 bg-surface text-primary text-sm font-semibold shadow-xs hover:border-primary/60 transition-colors"
            >
              <Lock className="size-4" aria-hidden />
              {locale === "sv" ? "Logga in och lägg till PLC & programmering" : "Sign in and add PLC & programming"}
            </Link>
          )}
        </div>
        </div>
      </div>

      {/* Save project modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/30 backdrop-blur-sm p-4"
          onClick={() => setShowSaveModal(false)}>
          <div role="dialog" aria-modal="true" className="bg-surface rounded-xl shadow-lg w-full max-w-md p-6 rorelse-fram" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">{projektId ? t("projects.rename" as never) : t("projects.modalTitle")}</h2>
              <button onClick={() => setShowSaveModal(false)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Namn *</label>
                <input
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder={t("projects.namePlaceholder")}
                  autoFocus
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {!projektId && <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Anteckning</label>
                <textarea
                  value={projectDesc}
                  onChange={e => setProjectDesc(e.target.value)}
                  placeholder={t("projects.descPlaceholder")}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition">
                Avbryt
              </button>
              <button onClick={saveProject} disabled={!projectName.trim() || projectSaving}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-40">
                {projectSaving ? t("projects.saving") : t("projects.confirmSave")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition">
            ← {t("machineBuilder.back")}
          </button>
          <button onClick={onRestart} className="text-sm text-muted-foreground hover:text-foreground transition">
            {t("machineBuilder.startOver")}
          </button>
        </div>
        <Link
          to="/$locale/products"
          params={{ locale } as never}
          className="text-sm text-info hover:underline"
        >
          {t("machineBuilder.browseCatalog")}
        </Link>
      </div>
    </div>
  );
}

// ── BOM System View ─────────────────────────────────────────────────────────
// Classifies a BOM line's role into a visual system node type
type NodeType = "supply" | "frl" | "valve" | "check_valve" | "flow_control" | "actuator" | "sensor" | "fitting" | "drive" | "psu" | "cable" | "mount" | "gripper" | "vacuum" | "other";

/**
 * Serverns stabila komponenttyp -> diagrammets nodtyp.
 *
 * Rapporterat 2026-09-09 med skärmbild: schemat visade "U-1/4 ljuddämpare"
 * som LUFTTILLFÖRSEL, först i luftvägen. En ljuddämpare sitter på ventilens
 * AVLUFTNINGSportar -- motsatt ände av luftvägen. Orsaken var att
 * classifyRole() regexar den lokaliserade `role`-strängen, och dess första
 * gren innehåller bara "luft", vilket matchar "av-LUFT-ning". Samma gren
 * fångade "TryckLUFTsslang" och, eftersom den ligger före "luftbered",
 * även "ATEX-LUFTberedning" -- alla tre blev lufttillförsel.
 *
 * Det är samma grundfel som återkommit hela dagen: klassificering ur
 * visningstext i stället för en maskinnyckel. Sedan steg 1 bär varje BOM-rad
 * ett stabilt, lokaloberoende `kind` från servern. Det används nu först;
 * classifyRole() finns kvar som reserv för sparade projekt från tiden före
 * steg 1, som saknar kind.
 */
const KIND_TO_NODE: Record<string, NodeType> = {
  actuator: "actuator", motor: "actuator", drive: "drive",
  // Backslagsventil och strypbackventil är INTE styrventiler och fick inte
  // ritas som sådana. Schemat visade "Pilotmanövrerad backslagsventil" i rutan
  // STYRVENTIL medan den riktiga 5/2-ventilen försvann bakom "+2" -- fyra
  // skilda komponenter kollapsade till en nod. Backslagsventilen är dessutom
  // säkerhetsrelevant vid vertikal last; att rita den som en styrventil döljer
  // vad lösningen faktiskt gör.
  //
  // Ventilterminalen får däremot ligga kvar som "valve": den ÄR en styrventil,
  // bara flera i samma hus.
  valve: "valve", valve_terminal: "valve",
  check_valve: "check_valve", flow_control: "flow_control",
  frl: "frl", silencer: "other", tubing: "fitting", fitting: "fitting",
  rod_lock: "mount", shock_absorber: "mount", mount: "mount",
  sensor: "sensor", cable: "cable", warning: "other",
};

function classifyRole(role: string, sku: string): NodeType {
  const r = role.toLowerCase();
  const s = sku.toLowerCase();
  if (/lufttill|supply|compressor|source|luft/.test(r)) return "supply";
  if (/frl|filter|regulator|lubric|luftbered/.test(r)) return "frl";
  // Före den generella ventilraden: "backslagsventil" innehåller "ventil" och
  // hade annars blivit en styrventil.
  if (/backslag|back.?ventil|check.?valve|non.?return|rückschlag|antirretorno/.test(r)) return "check_valve";
  if (/stryp|flödesregl|hastighetsregl|flow.?control|speed.?control|drossel|regulador de caudal/.test(r)) return "flow_control";
  if (/ventil|valve|direktional|styrventi|solenoid|5\/2|3\/2/.test(r)) return "valve";
  // Drive check BEFORE actuator — "servo motor driver", "drivmodul" etc. contain
  // "motor" which would otherwise hit the actuator branch first.
  if (/servo.*motor|motor.*driv|motor.*kontroll|drivmodul|driv.*enhet|servo.*förstärk|servoförstärk|servo.*driv|drive.*module|drive.*controller|drive.*amplif|frekvensomriktare/.test(r)) return "drive";
  // Cable check BEFORE sensor — "sensorkabel" / "sensor cable" contain the word "sensor"
  if (/kabel|cable|kopplingskabel|ledning/.test(r) || /nebu|^e2-m/.test(s)) return "cable";
  if (/cylinder|aktuator|actuator|linjär|axel|shaft|motor|dnc|dng|dsm/.test(r) || /dnc|dng|dsbc|advu|ley|lef/.test(s)) return "actuator";
  if (/sensor|givare|switch|reed|närhets|proximity|position/.test(r)) return "sensor";
  if (/koppling|fitting|anslut|push-in|snabbanslut/.test(r)) return "fitting";
  if (/slang|slange|tub|tube|hose/.test(r)) return "fitting";
  if (/servo|drive|styrning|kontroller|frekvens/.test(r)) return "drive";
  if (/nät|power|supply|psu|24v|230v|matning/.test(r)) return "psu";
  if (/fäst|mount|bracket|konsol|adapter/.test(r)) return "mount";
  if (/grip|klämm|finger|jaw/.test(r) || /hgp|mhz|mhc|dhvz/.test(s)) return "gripper";
  if (/vakuum|vacuum|sug|ejek|suction/.test(r) || /vn|zse|svs/.test(s)) return "vacuum";
  return "other";
}

const NODE_META: Record<NodeType, { label: string; color: string; fill: string; icon: string }> = {
  supply:   { label: "Lufttillförsel",  color: "#64748b", fill: "#f1f5f9", icon: "◎" },
  frl:      { label: "FRL-enhet",       color: "#0ea5e9", fill: "#e0f2fe", icon: "⧖" },
  valve:    { label: "Styrventil",      color: "#6366f1", fill: "#eef2ff", icon: "⇌" },
  check_valve:  { label: "Backslagsventil",  color: "#b45309", fill: "#fef3c7", icon: "⊣" },
  flow_control: { label: "Strypbackventil",  color: "#0d9488", fill: "#ccfbf1", icon: "⧗" },
  actuator: { label: "Aktuator",        color: "#0284c7", fill: "#dbeafe", icon: "⇒" },
  sensor:   { label: "Sensor",          color: "#16a34a", fill: "#dcfce7", icon: "◈" },
  fitting:  { label: "Anslutning/Slang",color: "#94a3b8", fill: "#f8fafc", icon: "⊕" },
  drive:    { label: "Servostyrning",   color: "#7c3aed", fill: "#f5f3ff", icon: "⟲" },
  psu:      { label: "Nätaggregat",     color: "#d97706", fill: "#fef9c3", icon: "⏚" },
  cable:    { label: "Kabel",           color: "#94a3b8", fill: "#f8fafc", icon: "∿" },
  mount:    { label: "Fäste/Montering", color: "#78716c", fill: "#fafaf9", icon: "⬡" },
  gripper:  { label: "Gripper",         color: "#0891b2", fill: "#e0f9ff", icon: "⋔" },
  vacuum:   { label: "Vakuumsystem",    color: "#7e22ce", fill: "#faf5ff", icon: "○" },
  other:    { label: "Tillbehör",       color: "#94a3b8", fill: "#f8fafc", icon: "·" },
};

function BomSystemView({ bom, connections, selected, locale }: {
  bom: BomLine[]; connections: BomConnection[]; selected: ActuatorOption; locale: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useState<"diagram" | "3d" | "cards">("diagram");

  const isElectric = /DNCE|LEY|LEF|EGC|ELGA|EGSK|EGSP|LESH|LEFS|LECP|HMR|OSPE|LBB|HLR|PARKER-ETH|PARKER-HMR|PARKER-LBB|PARKER-HLR|PARKER-OSPE/i.test(selected.sku);
  const classified = bom.map((line, i) => ({
    ...line,
    // `kind` kommer från servern och är språkoberoende; role är visningstext.
    nodeType: (line.kind ? KIND_TO_NODE[line.kind] : undefined) ?? classifyRole(line.role, line.sku),
    idx: i,
  }));

  /**
   * Vad den valda komponenten hänger ihop med, enligt serverns härledda graf
   * (deriveBomConnections). Tidigare var tillbehören sammanhangslösa -- en
   * snabbkoppling stod bara som "QS-G1/4-10" utan att säga vad den hör till.
   * Grafen vet det redan; det enda som saknades var att visa den.
   *
   * Riktningen i datan är beroende -> det den beror på, så en kant där raden
   * är `fromIndex` läses "den här sitter på/styrs av X".
   */
  const RELATION_TEXT: Record<string, { egen: string; omvänd: string }> = {
    air_supply:    { egen: "Matas från",  omvänd: "Matar" },
    controlled_by: { egen: "Styrs av",    omvänd: "Styr" },
    mounted_on:    { egen: "Sitter på",   omvänd: "Bär" },
    senses:        { egen: "Avkänner",    omvänd: "Avkänns av" },
    accessory:     { egen: "Hör till",    omvänd: "Tillbehör" },
    requires:      { egen: "Kräver",      omvänd: "Krävs av" },
  };
  const namn = (i: number) => visatNamn(bom[i]?.product, locale) ?? bom[i]?.role ?? bom[i]?.sku ?? "";
  const kopplingarFör = (idx: number) => connections.flatMap(c => {
    const t = RELATION_TEXT[c.relation];
    if (!t) return [];
    if (c.fromIndex === idx) return [`${t.egen} ${namn(c.toIndex)}`];
    if (c.toIndex === idx) return [`${t.omvänd} ${namn(c.fromIndex)}`];
    return [];
  });

  // Build pipeline: main flow nodes in order.
  //
  // Givaren ligger INTE i flödet (manualen 7.3, lådsorteringstestet: schemat
  // visade "LUFTFLÖDE → aktuator → givare", som om luften gick vidare in i
  // givaren). En givare känner av aktuatorns läge och skickar en signal till
  // styrningen; den ritas som återkoppling på en egen rad.
  const pipelineOrder: NodeType[] = isElectric
    ? ["psu", "drive", "actuator"]
    : ["supply", "frl", "valve", "actuator", "gripper", "vacuum"];

  // Group bom lines by node type for the diagram
  const byType: Partial<Record<NodeType, typeof classified>> = {};
  classified.forEach(c => {
    if (!byType[c.nodeType]) byType[c.nodeType] = [];
    byType[c.nodeType]!.push(c);
  });

  // Side items: fittings, cables, mounts, other
  const sideTypes: NodeType[] = ["fitting", "cable", "mount", "other"];

  const pipelineItems = pipelineOrder
    .filter(t => byType[t]?.length)
    .map(t => ({ type: t, lines: byType[t]! }));

  const sideItems = sideTypes
    .filter(t => byType[t]?.length)
    .flatMap(t => byType[t]!);

  const feedbackItems = byType.sensor ?? [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header with tab toggle */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-medium flex items-center gap-2">
          <span className="text-info">◈</span>
          Systemöversikt — {bom.length} komponenter
        </div>
        <div className="flex gap-1 bg-surface-alt rounded-md p-0.5">
          {(["diagram", "3d", "cards"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-xs px-3 py-1 rounded transition ${view === v ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {v === "diagram" ? "⎔ Systemschema" : v === "3d" ? "◉ 3D Maskin" : "⊞ Komponentkort"}
            </button>
          ))}
        </div>
      </div>

      {view === "diagram" && (
        <div className="p-4 md:p-6 overflow-x-auto">
          <SystemDiagram
            pipelineItems={pipelineItems}
            sideItems={sideItems}
            feedbackItems={feedbackItems}
            active={active}
            setActive={setActive}
            isElectric={isElectric}
            locale={locale}
          />
        </div>
      )}

      {view === "3d" && (
        <div className="relative">
          <Suspense fallback={
            <div className="flex items-center justify-center" style={{ height: 340 }}>
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="size-2 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            </div>
          }>
            <Machine3DScene
              bore={selected.bore_mm ?? 50}
              stroke={selected.stroke_mm ?? 200}
              isElectric={isElectric}
              hasVacuum={classified.some(c => c.nodeType === "vacuum")}
              hasGripper={classified.some(c => c.nodeType === "gripper")}
              // Fleraxlighet ur serverns `subsystem`, inte ur `role`.
              // Rättat 2026-09-09: mönstret /axel 2|axis 2|X-axel/ matchade
              // LOKALISERAD visningstext och täckte bara svenska och engelska.
              // En tysk ("Achse") eller spansk ("eje") kund med en tvåaxlig
              // maskin fick en enaxlig 3D-modell -- fel antal ventilblock och
              // ingen andra axel.
              // deriveSubsystems() sätter axis_x/axis_y/axis_z endast när
              // maskinen faktiskt har flera axlar, och gör det språkoberoende.
              isMultiAxis={new Set(bom.map(l => l.subsystem).filter(sub => sub?.startsWith("axis_"))).size > 1}
              hasSensors={classified.some(c => c.nodeType === "sensor")}
            />
          </Suspense>
          <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground bg-card/80 backdrop-blur px-2 py-1 rounded-md border border-border">
            Dra för att rotera · Scroll för att zooma
          </div>
        </div>
      )}

      {view === "cards" && (
        <div className="p-4">
          <ComponentCards classified={classified} active={active} setActive={setActive} locale={locale} />
        </div>
      )}

      {/* Active component detail strip */}
      {active !== null && bom[active] && (
        <div className="border-t border-border bg-info/5 px-4 py-3 flex items-start gap-3">
          <span className={`size-6 rounded-full flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0`}
            style={{ background: NODE_META[classified[active]?.nodeType ?? "other"].color }}>
            {active + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{visatNamn(bom[active].product, locale) ?? bom[active].sku}</div>
            <div className="text-xs text-muted-foreground font-mono">{bom[active].sku} · {bom[active].role}</div>
            {kopplingarFör(active).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {kopplingarFör(active).map((k, i) => (
                  <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-info/10 text-info">{k}</span>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{bom[active].reason}</div>
          </div>
          <div className="text-xs text-muted-foreground shrink-0">Antal: <span className="font-semibold text-foreground">{bom[active].quantity}</span></div>
          <button onClick={() => setActive(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0">×</button>
        </div>
      )}
    </div>
  );
}

// ── Pipeline SVG Diagram ────────────────────────────────────────────────────
function SystemDiagram({ pipelineItems, sideItems, feedbackItems, active, setActive, isElectric, locale }: {
  locale: string;
  pipelineItems: { type: NodeType; lines: { idx: number; sku: string; role: string; quantity: number; product?: ProductRow | null; nodeType: NodeType }[] }[];
  sideItems: { idx: number; sku: string; role: string; quantity: number; product?: ProductRow | null; nodeType: NodeType }[];
  feedbackItems: { idx: number; sku: string; role: string; quantity: number; product?: ProductRow | null; nodeType: NodeType }[];
  active: number | null;
  setActive: (i: number | null) => void;
  isElectric: boolean;
}) {
  const BOX_W = 140, BOX_H = 76, GAP = 60;
  const SIDE_W = 120, SIDE_H = 52;
  const pLen = pipelineItems.length;
  const totalW = Math.max(600, pLen * (BOX_W + GAP) - GAP + 80);
  const mainY = 80;
  const sv = locale === "sv";
  // Rader: flödet, givaråterkopplingen (egen rad), tillbehören, förklaringen.
  const feedbackRowY = mainY + BOX_H + 70;
  const sideRowY = (feedbackItems.length > 0 ? feedbackRowY + SIDE_H + 80 : mainY + BOX_H + 80);
  const legendY = (sideItems.length > 0 ? sideRowY + SIDE_H + 36 : feedbackItems.length > 0 ? feedbackRowY + SIDE_H + 36 : mainY + BOX_H + 50);
  const totalH = legendY + 24;
  const arrowColor = isElectric ? "#7c3aed" : "#0ea5e9";
  const feedbackColor = "#16a34a";

  const pipelinePositions = pipelineItems.map((_, i) => ({
    x: 40 + i * (BOX_W + GAP),
    y: mainY,
  }));

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      style={{ width: "100%", minWidth: `${Math.min(totalW, 560)}px`, height: "auto" }}
      aria-label="Systemschema"
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={arrowColor} />
        </marker>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.10" />
        </filter>
      </defs>

      {/* Flow label */}
      <text x="40" y="28" fontSize="10" fill="#94a3b8" fontFamily="system-ui, sans-serif" letterSpacing="0.12em">
        {isElectric
          ? (sv ? "ELEKTRISK MATNING OCH STYRNING →" : "ELECTRIC SUPPLY AND CONTROL →")
          : (sv ? "LUFTFLÖDE (PNEUMATIK) →" : "AIR FLOW (PNEUMATICS) →")}
      </text>

      {/* Connecting arrows between pipeline nodes */}
      {pipelinePositions.slice(0, -1).map((pos, i) => {
        const x1 = pos.x + BOX_W;
        const x2 = pipelinePositions[i + 1].x;
        const cy = mainY + BOX_H / 2;
        return (
          <g key={i}>
            <line
              x1={x1 + 2} y1={cy} x2={x2 - 8} y2={cy}
              stroke={arrowColor} strokeWidth="2"
              markerEnd="url(#arrowhead)"
              strokeDasharray={isElectric ? "6 3" : "0"}
            />
          </g>
        );
      })}

      {/* Pipeline nodes */}
      {pipelineItems.map((item, i) => {
        const pos = pipelinePositions[i];
        const meta = NODE_META[item.type];
        const firstLine = item.lines[0];
        const isActive = active === firstLine.idx;
        const hasMultiple = item.lines.length > 1;

        return (
          <g key={item.type} style={{ cursor: "pointer" }}
            onClick={() => setActive(isActive ? null : firstLine.idx)}>
            {/* Box */}
            <rect
              x={pos.x} y={pos.y} width={BOX_W} height={BOX_H} rx="8"
              fill={isActive ? meta.color : meta.fill}
              stroke={isActive ? meta.color : "#e2e8f0"}
              strokeWidth={isActive ? 2 : 1.5}
              filter="url(#shadow)"
            />
            {/* Number badge */}
            <circle cx={pos.x + 14} cy={pos.y + 14} r={11} fill={meta.color} />
            <text x={pos.x + 14} y={pos.y + 18} textAnchor="middle" fontSize="10"
              fill="white" fontWeight="700" fontFamily="system-ui, sans-serif">
              {firstLine.idx + 1}
            </text>
            {/* Icon */}
            <text x={pos.x + BOX_W - 16} y={pos.y + 20} textAnchor="middle" fontSize="16"
              fill={isActive ? "white" : meta.color} fontFamily="system-ui, sans-serif">
              {meta.icon}
            </text>
            {/* Type label */}
            <text x={pos.x + BOX_W / 2} y={pos.y + 34} textAnchor="middle" fontSize="10"
              fill={isActive ? "white" : "#64748b"} fontFamily="system-ui, sans-serif" letterSpacing="0.06em">
              {meta.label.toUpperCase()}
            </text>
            {/* Product name — truncate */}
            <foreignObject x={pos.x + 6} y={pos.y + 42} width={BOX_W - 12} height={26}>
              <div style={{
                fontSize: "11px",
                color: isActive ? "white" : "#1e293b",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                lineHeight: 1.3,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              } as React.CSSProperties}>
                {visatNamn(firstLine.product, locale) ?? firstLine.sku}
              </div>
            </foreignObject>
            {/* Multiple items badge */}
            {hasMultiple && (
              <g>
                <circle cx={pos.x + BOX_W - 10} cy={pos.y + BOX_H - 10} r={9} fill="#f59e0b" />
                <text x={pos.x + BOX_W - 10} y={pos.y + BOX_H - 6} textAnchor="middle" fontSize="9"
                  fill="white" fontWeight="700" fontFamily="system-ui, sans-serif">
                  +{item.lines.length - 1}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Givaråterkoppling: egen rad, prickad linje till aktuatorn */}
      {feedbackItems.length > 0 && (() => {
        const aktIdx = pipelineItems.findIndex(p => p.type === "actuator");
        const akt = aktIdx >= 0 ? pipelinePositions[aktIdx] : pipelinePositions[pipelinePositions.length - 1];
        return (
          <g>
            {/* Under raden: linjen från aktuatorn korsar annars rubriken. */}
            <text x={40} y={feedbackRowY + SIDE_H + 16} fontSize="9" fill={feedbackColor} fontFamily="system-ui, sans-serif" letterSpacing="0.12em">
              {sv ? "GIVARÅTERKOPPLING (SIGNAL TILL STYRNINGEN)" : "SENSOR FEEDBACK (SIGNAL TO THE CONTROLLER)"}
            </text>
            {akt && feedbackItems.map((item, i) => {
              const x = 40 + i * (SIDE_W + 16);
              return (
                <line key={item.idx}
                  x1={akt.x + BOX_W / 2} y1={mainY + BOX_H + 2} x2={x + SIDE_W / 2} y2={feedbackRowY - 2}
                  stroke={feedbackColor} strokeWidth="1.5" strokeDasharray="2 4" />
              );
            })}
            {feedbackItems.map((item, i) => {
              const x = 40 + i * (SIDE_W + 16);
              const meta = NODE_META[item.nodeType];
              const isActive = active === item.idx;
              return (
                <g key={`fb-${item.idx}`} style={{ cursor: "pointer" }} onClick={() => setActive(isActive ? null : item.idx)}>
                  <rect x={x} y={feedbackRowY} width={SIDE_W} height={SIDE_H} rx="6"
                    fill={isActive ? meta.color : meta.fill} stroke={isActive ? meta.color : feedbackColor}
                    strokeWidth={isActive ? 2 : 1} strokeDasharray={isActive ? "0" : "3 2"} filter="url(#shadow)" />
                  <circle cx={x + 11} cy={feedbackRowY + 11} r={9} fill={meta.color} />
                  <text x={x + 11} y={feedbackRowY + 15} textAnchor="middle" fontSize="9" fill="white" fontWeight="700" fontFamily="system-ui, sans-serif">
                    {item.idx + 1}
                  </text>
                  <text x={x + SIDE_W / 2} y={feedbackRowY + 22} textAnchor="middle" fontSize="9"
                    fill={isActive ? "white" : "#64748b"} fontFamily="system-ui, sans-serif" letterSpacing="0.05em">
                    {meta.label.toUpperCase()}
                  </text>
                  <foreignObject x={x + 4} y={feedbackRowY + 28} width={SIDE_W - 8} height={20}>
                    <div style={{ fontSize: "10px", color: isActive ? "white" : "#1e293b", fontFamily: "system-ui, sans-serif", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {visatNamn(item.product, locale) ?? item.sku}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* Dotted lines from pipeline to side items */}
      {sideItems.length > 0 && (
        <>
          {/* Horizontal shelf line */}
          <line
            x1={40} y1={sideRowY - 20} x2={totalW - 40} y2={sideRowY - 20}
            stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4"
          />
          <text x={40} y={sideRowY - 28} fontSize="9" fill="#94a3b8" fontFamily="system-ui, sans-serif"
            letterSpacing="0.12em">
            TILLBEHÖR &amp; ANSLUTNINGAR
          </text>
        </>
      )}

      {/* Side item boxes */}
      {sideItems.map((item, i) => {
        const x = 40 + i * (SIDE_W + 16);
        const meta = NODE_META[item.nodeType];
        const isActive = active === item.idx;
        return (
          <g key={item.idx} style={{ cursor: "pointer" }}
            onClick={() => setActive(isActive ? null : item.idx)}>
            <rect
              x={x} y={sideRowY} width={SIDE_W} height={SIDE_H} rx="6"
              fill={isActive ? meta.color : meta.fill}
              stroke={isActive ? meta.color : "#e2e8f0"}
              strokeWidth={isActive ? 2 : 1}
              filter="url(#shadow)"
            />
            <circle cx={x + 11} cy={sideRowY + 11} r={9} fill={meta.color} />
            <text x={x + 11} y={sideRowY + 15} textAnchor="middle" fontSize="9"
              fill="white" fontWeight="700" fontFamily="system-ui, sans-serif">
              {item.idx + 1}
            </text>
            <text x={x + SIDE_W / 2} y={sideRowY + 22} textAnchor="middle" fontSize="9"
              fill={isActive ? "white" : "#64748b"} fontFamily="system-ui, sans-serif" letterSpacing="0.05em">
              {meta.label.toUpperCase()}
            </text>
            <foreignObject x={x + 4} y={sideRowY + 28} width={SIDE_W - 8} height={20}>
              <div style={{
                fontSize: "10px", color: isActive ? "white" : "#1e293b",
                fontFamily: "system-ui, sans-serif", fontWeight: 600,
                overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
              }}>
                {visatNamn(item.product, locale) ?? item.sku}
              </div>
            </foreignObject>
          </g>
        );
      })}

      {/* Teckenförklaring: kopplingstyperna skiljs åt (manualen 7.3). */}
      <g fontFamily="system-ui, sans-serif" fontSize="9" fill="#64748b">
        <line x1={40} y1={legendY} x2={64} y2={legendY} stroke={arrowColor} strokeWidth="2" strokeDasharray={isElectric ? "6 3" : "0"} />
        <text x={70} y={legendY + 3}>{isElectric ? (sv ? "Elektrisk matning/styrning" : "Electric supply/control") : (sv ? "Pneumatik (luftflöde)" : "Pneumatics (air flow)")}</text>
        {feedbackItems.length > 0 && (
          <>
            <line x1={220} y1={legendY} x2={244} y2={legendY} stroke={feedbackColor} strokeWidth="1.5" strokeDasharray="2 4" />
            <text x={250} y={legendY + 3}>{sv ? "Givaråterkoppling (signal)" : "Sensor feedback (signal)"}</text>
          </>
        )}
        {sideItems.length > 0 && (
          <>
            <line x1={400} y1={legendY} x2={424} y2={legendY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
            <text x={430} y={legendY + 3}>{sv ? "Tillbehör och mekanik" : "Accessories and mechanics"}</text>
          </>
        )}
      </g>
    </svg>
  );
}

// ── Component Cards ─────────────────────────────────────────────────────────
function ComponentCards({ classified, active, setActive, locale }: {
  locale: string;
  classified: { idx: number; sku: string; role: string; quantity: number; reason: string; product?: ProductRow | null; nodeType: NodeType }[];
  active: number | null;
  setActive: (i: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {classified.map((item) => {
        const meta = NODE_META[item.nodeType];
        const isActive = active === item.idx;
        return (
          <button
            key={item.idx}
            onClick={() => setActive(isActive ? null : item.idx)}
            className={`text-left rounded-xl border-2 p-3 transition ${
              isActive ? "border-info bg-info/5" : "border-border hover:border-info/50 bg-card"
            }`}
          >
            {/* Number + type row */}
            <div className="flex items-center gap-2 mb-2">
              <span className="size-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: meta.color }}>
                {item.idx + 1}
              </span>
              <span className="text-[10px] uppercase tracking-wide font-medium truncate"
                style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground shrink-0">×{item.quantity}</span>
            </div>

            {/* Category icon area */}
            <div className="h-14 rounded-lg flex items-center justify-center mb-2 text-3xl"
              style={{ background: meta.fill }}>
              <span>{meta.icon}</span>
            </div>

            {/* Name */}
            <div className="text-xs font-semibold leading-tight line-clamp-2 text-foreground">
              {visatNamn(item.product, locale) ?? item.sku}
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">{item.sku}</div>

            {/* Role badge */}
            <div className="mt-1.5 text-[10px] text-muted-foreground line-clamp-1 italic">
              {item.role}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── OLD 3D Machine Visualizer (kept for reference, no longer rendered) ───────
function MachineVisualizer({ selected, description, answers }: {
  selected: ActuatorOption; description: string; answers: Record<string, string>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const isElectric = selected.sku.includes("DNCE") || selected.sku.includes("LEY");
  const isGripper = selected.sku.includes("HGP") || selected.sku.includes("MHZ") || selected.sku.includes("MHC") || selected.sku.includes("DHVZ");
  const isVacuum = selected.sku.includes("DHVZ") || selected.sku.includes("VN");
  const bore = selected.bore_mm ?? 50;
  const stroke = Math.min(selected.stroke_mm ?? 200, 300);
  // Mönstret hade bart "upp" utan ordgräns, och en kund skrev "Kartongerna
  // väger UPP TILL 25 kg" om ett horisontellt kartongstopp. Kundens egna ord
  // fick 3D-vyn att rita maskinen stående. Orden är nu ordgränsade, och ett
  // uttryckligt horisontellt val slår alltid detekteringen -- samma regel som
  // needsVerticalLoad i signals.ts.
  const beskrivning = description + " " + JSON.stringify(answers);
  const isVertical = !/\bhorisontell?\b|\bhorizontal\b|\bliggande\b/i.test(beskrivning)
    && /\blyft\w*\b|\bvertikal\w*\b|\buppåt\b|\blift\w*\b|\bvertical\b|\bpress\w*\b/i.test(beskrivning);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    let t = 0;
    let rodExtension = 0;
    let direction = 1;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#f8fafc");
      bg.addColorStop(1, "#f1f5f9");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grid lines (subtle)
      ctx.strokeStyle = "rgba(148,163,184,0.15)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      if (isVertical) {
        drawVerticalSetup(ctx, W, H, bore, rodExtension, stroke, isElectric, isGripper, isVacuum, selected.name ?? "Aktuator");
      } else {
        drawHorizontalSetup(ctx, W, H, bore, rodExtension, stroke, isElectric, isGripper, isVacuum, selected.name ?? "Aktuator");
      }

      // Animate rod
      t += 0.02;
      rodExtension = ((Math.sin(t) + 1) / 2) * stroke * 0.6;

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [selected, isVertical]);

  return (
    <canvas
      ref={canvasRef}
      className="hidden sm:block"
      style={{ width: "100%", height: "260px", display: "block" }}
    />
  );
}

function drawHorizontalSetup(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  bore: number, rodExt: number, maxStroke: number,
  isElectric: boolean, isGripper: boolean, isVacuum: boolean,
  name: string
) {
  const cx = W / 2;
  const cy = H / 2;
  const scale = Math.min(W, H) / 600;
  const bodyLen = 120 * scale;
  const bodyH = Math.max(24, bore * 0.6) * scale;
  const rodLen = (50 + rodExt * 0.8) * scale;
  const rodD = Math.max(8, bore * 0.22) * scale;

  const startX = cx - bodyLen / 2 - 20 * scale;
  const bodyY = cy - bodyH / 2;

  // Mounting bracket
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.roundRect(startX - 18 * scale, cy - bodyH * 0.8, 14 * scale, bodyH * 1.6, 3);
  ctx.fill();
  // Bracket bolts
  for (const dy of [-0.4, 0.4]) {
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(startX - 11 * scale, cy + dy * bodyH, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cylinder body
  const bodyGrad = ctx.createLinearGradient(startX, bodyY, startX, bodyY + bodyH);
  if (isElectric) {
    bodyGrad.addColorStop(0, "#6366f1");
    bodyGrad.addColorStop(0.4, "#818cf8");
    bodyGrad.addColorStop(1, "#4f46e5");
  } else {
    bodyGrad.addColorStop(0, "#94a3b8");
    bodyGrad.addColorStop(0.4, "#cbd5e1");
    bodyGrad.addColorStop(1, "#64748b");
  }
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(startX, bodyY, bodyLen, bodyH, 4 * scale);
  ctx.fill();
  ctx.strokeStyle = isElectric ? "#4f46e5" : "#475569";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // End cap left
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.roundRect(startX - 2 * scale, bodyY - 3 * scale, 10 * scale, bodyH + 6 * scale, 3);
  ctx.fill();

  // End cap right
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.roundRect(startX + bodyLen - 8 * scale, bodyY - 3 * scale, 10 * scale, bodyH + 6 * scale, 3);
  ctx.fill();

  // Port fittings (top of cylinder)
  for (const px of [0.25, 0.75]) {
    ctx.fillStyle = "#6aabcf";
    ctx.beginPath();
    ctx.roundRect(startX + bodyLen * px - 4 * scale, bodyY - 10 * scale, 8 * scale, 12 * scale, 2);
    ctx.fill();
    // Hose
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(startX + bodyLen * px, bodyY - 10 * scale);
    ctx.bezierCurveTo(
      startX + bodyLen * px, bodyY - 35 * scale,
      startX + bodyLen * px + 20 * scale, bodyY - 45 * scale,
      startX + bodyLen * px + 40 * scale, bodyY - 35 * scale,
    );
    ctx.stroke();
  }

  // Piston rod
  const rodGrad = ctx.createLinearGradient(0, cy - rodD / 2, 0, cy + rodD / 2);
  rodGrad.addColorStop(0, "#e2e8f0");
  rodGrad.addColorStop(0.5, "#f8fafc");
  rodGrad.addColorStop(1, "#cbd5e1");
  ctx.fillStyle = rodGrad;
  const rodX = startX + bodyLen + 2 * scale;
  ctx.beginPath();
  ctx.roundRect(rodX, cy - rodD / 2, rodLen, rodD, rodD / 2);
  ctx.fill();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.stroke();

  const payloadX = rodX + rodLen;
  const payloadH = Math.max(40, bore * 1.0) * scale;
  const payloadW = 50 * scale;

  if (isGripper || isVacuum) {
    // Gripper jaws
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.roundRect(payloadX, cy - payloadH * 0.6, 16 * scale, payloadH * 0.4, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(payloadX, cy + payloadH * 0.2, 16 * scale, payloadH * 0.4, 2);
    ctx.fill();
    // Object in gripper
    ctx.fillStyle = "rgba(249,115,22,0.8)";
    ctx.beginPath();
    ctx.arc(payloadX + 30 * scale, cy, 14 * scale, 0, Math.PI * 2);
    ctx.fill();
    labelAt(ctx, payloadX + 30 * scale, cy + 32 * scale, isGripper ? "Objekt" : "Sugyta", scale);
  } else {
    // Payload block
    const payGrad = ctx.createLinearGradient(payloadX, cy - payloadH / 2, payloadX, cy + payloadH / 2);
    payGrad.addColorStop(0, "#fb923c");
    payGrad.addColorStop(1, "#ea580c");
    ctx.fillStyle = payGrad;
    ctx.beginPath();
    ctx.roundRect(payloadX, cy - payloadH / 2, payloadW, payloadH, 4 * scale);
    ctx.fill();
    ctx.strokeStyle = "#c2410c";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    labelAt(ctx, payloadX + payloadW / 2, cy + payloadH / 2 + 18 * scale, "Förflyttat objekt", scale);
  }

  // Ground rail
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.roundRect(startX - 25 * scale, cy + bodyH / 2 + 8 * scale, bodyLen + rodLen + payloadW + 45 * scale, 6 * scale, 2);
  ctx.fill();

  // Labels
  labelAt(ctx, startX + bodyLen / 2, bodyY - 18 * scale, name, scale);
  if (bore) {
    labelAt(ctx, startX + bodyLen / 2, bodyY + bodyH + 22 * scale, `⌀${bore} mm`, scale, true);
  }
}

function drawVerticalSetup(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  bore: number, rodExt: number, maxStroke: number,
  isElectric: boolean, isGripper: boolean, isVacuum: boolean,
  name: string
) {
  const cx = W / 2;
  const scale = Math.min(W, H) / 600;
  const bodyLen = 100 * scale;
  const bodyW = Math.max(24, bore * 0.6) * scale;
  const rodLen = (40 + rodExt * 0.7) * scale;
  const payloadH = 40 * scale;
  const payloadW = 60 * scale;

  const topY = H * 0.12;
  const bodyX = cx - bodyW / 2;

  // Ceiling mount
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.roundRect(cx - 30 * scale, topY - 14 * scale, 60 * scale, 14 * scale, 2);
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(cx + dx * 50 * scale, topY - 7 * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cylinder body
  const bodyGrad = ctx.createLinearGradient(bodyX, topY, bodyX + bodyW, topY);
  if (isElectric) {
    bodyGrad.addColorStop(0, "#4f46e5");
    bodyGrad.addColorStop(0.5, "#818cf8");
    bodyGrad.addColorStop(1, "#4f46e5");
  } else {
    bodyGrad.addColorStop(0, "#64748b");
    bodyGrad.addColorStop(0.5, "#cbd5e1");
    bodyGrad.addColorStop(1, "#64748b");
  }
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(bodyX, topY, bodyW, bodyLen, 4 * scale);
  ctx.fill();
  ctx.strokeStyle = isElectric ? "#4f46e5" : "#475569";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Port fittings
  for (const py of [0.25, 0.75]) {
    ctx.fillStyle = "#6aabcf";
    ctx.beginPath();
    ctx.roundRect(bodyX + bodyW, topY + bodyLen * py - 4 * scale, 12 * scale, 8 * scale, 2);
    ctx.fill();
    // Hose
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(bodyX + bodyW + 12 * scale, topY + bodyLen * py);
    ctx.bezierCurveTo(
      bodyX + bodyW + 35 * scale, topY + bodyLen * py,
      bodyX + bodyW + 45 * scale, topY + bodyLen * py + 20 * scale,
      bodyX + bodyW + 35 * scale, topY + bodyLen * py + 40 * scale,
    );
    ctx.stroke();
  }

  // Rod
  const rodGrad = ctx.createLinearGradient(cx - 4 * scale, 0, cx + 4 * scale, 0);
  rodGrad.addColorStop(0, "#94a3b8");
  rodGrad.addColorStop(0.5, "#f8fafc");
  rodGrad.addColorStop(1, "#94a3b8");
  ctx.fillStyle = rodGrad;
  const rodY = topY + bodyLen;
  ctx.beginPath();
  ctx.roundRect(cx - (bore * 0.11) * scale, rodY, (bore * 0.22) * scale, rodLen, 2);
  ctx.fill();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Payload
  const pY = rodY + rodLen;
  const payGrad = ctx.createLinearGradient(cx - payloadW / 2, pY, cx - payloadW / 2, pY + payloadH);
  payGrad.addColorStop(0, "#fb923c");
  payGrad.addColorStop(1, "#ea580c");
  ctx.fillStyle = payGrad;
  ctx.beginPath();
  ctx.roundRect(cx - payloadW / 2, pY, payloadW, payloadH, 4 * scale);
  ctx.fill();
  ctx.strokeStyle = "#c2410c";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Arrow showing direction
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(cx + bodyW / 2 + 35 * scale, topY);
  ctx.lineTo(cx + bodyW / 2 + 35 * scale, pY + payloadH);
  ctx.stroke();
  ctx.setLineDash([]);
  const arrowY = pY + payloadH;
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(cx + bodyW / 2 + 30 * scale, arrowY - 8 * scale);
  ctx.lineTo(cx + bodyW / 2 + 40 * scale, arrowY - 8 * scale);
  ctx.lineTo(cx + bodyW / 2 + 35 * scale, arrowY);
  ctx.fill();

  // Labels
  labelAt(ctx, cx, topY + bodyLen / 2, name, scale, false, true);
  labelAt(ctx, cx, pY + payloadH + 18 * scale, "Lyft/last", scale);
  if (bore) {
    labelAt(ctx, bodyX - 28 * scale, topY + bodyLen / 2, `⌀${bore}mm`, scale, true);
  }
}

function labelAt(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  scale: number,
  small = false,
  vertical = false
) {
  ctx.save();
  if (vertical) {
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    x = 0; y = 0;
  }
  ctx.font = `${small ? 10 : 11}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const metrics = ctx.measureText(text);
  const pad = 5;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.roundRect(x - metrics.width / 2 - pad, y - 8, metrics.width + pad * 2, 16, 3);
  ctx.fill();
  ctx.fillStyle = small ? "#64748b" : "#1e293b";
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── Loading Card ────────────────────────────────────────────────────────────
/**
 * Laddningsläget har samma form som det som kommer: frågor, alternativ eller
 * resultat. Meddelandet läses upp (aria-live) och säger ungefär hur länge det
 * brukar ta, så att väntan inte ser ut som ett fel. Pulsen stängs av vid
 * reducerad rörelse (styles.css).
 */
function LoadingCard({ message, form = "fragor", locale }: { message: string; form?: "fragor" | "alternativ" | "resultat"; locale: string }) {
  const sv = locale === "sv";
  const rad = (w: string) => <div className={`h-3 rounded-full bg-muted animate-pulse ${w}`} />;
  return (
    <div className="space-y-4" aria-busy="true">
      <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg bg-surface-alt px-4 py-3 text-sm text-foreground">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-cta animate-pulse" />
        <span>{message}</span>
        <span className="ml-auto text-xs text-muted-foreground">{sv ? "brukar ta 5–15 s" : "usually 5–15 s"}</span>
      </div>
      {form === "alternativ" ? (
        [0, 1, 2].map(i => (
          <div key={i} className="kort space-y-3 p-5">
            <div className="flex items-center justify-between gap-4">{rad("w-1/2")}<div className="h-5 w-28 rounded-full bg-muted animate-pulse" /></div>
            <div className="grid gap-2 sm:grid-cols-2">{rad("w-3/4")}{rad("w-2/3")}{rad("w-1/2")}{rad("w-3/5")}</div>
            {rad("w-full")}
          </div>
        ))
      ) : form === "resultat" ? (
        <>
          <div className="arbetsyta space-y-3 p-6">{rad("w-1/3")}{rad("w-2/3")}{rad("w-full")}</div>
          <div className="kort space-y-2 p-5">{[0, 1, 2, 3, 4].map(i => <div key={i}>{rad(i % 2 ? "w-5/6" : "w-full")}</div>)}</div>
        </>
      ) : (
        <div className="arbetsyta divide-y divide-line">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-3 px-6 py-5">
              {rad("w-2/5")}
              <div className="flex gap-2">{[0, 1, 2].map(j => <div key={j} className="h-8 w-28 rounded-full bg-muted animate-pulse" />)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

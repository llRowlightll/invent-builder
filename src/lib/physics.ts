/**
 * physics.ts — Hard engineering rules for pneumatic + electric component selection.
 *
 * These rules are NOT delegated to an LLM. They are deterministic calculations
 * based on standard industrial engineering formulas. The LLM only extracts
 * numbers from the user's text; physics validation happens here.
 */

// Standard pneumatic bore sizes (mm) — ISO / manufacturer standard
export const STANDARD_BORES = [8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200];

// ── Husets kraftmodell ───────────────────────────────────────────────────────
// Samma konstanter och formler finns i supabase/functions/groq-advisor/signals.ts
// för edge-runtimen. De två kan inte dela modul (Vite respektive Deno), så de
// hålls i synk av tester på båda sidor som låser fast samma tal. Ändras något
// här måste signals.ts och dess test ändras likadant.
//
// Bakgrund 2026-09-09: sajten hade fyra oberoende kraftformler, och chatten och
// maskinbyggaren rekommenderade olika borrning för samma last. Den här filen
// hade rätt modell hela tiden -- den var bara inte den enda.

// Working pressure assumption (Pa) — industry standard 6 bar
const WORKING_PRESSURE_PA = 600_000;
/** Tätningsfriktion. 0,75 ligger inom standardpraxis (0,7–0,9). */
export const SEAL_EFFICIENCY = 0.75;
const EFFICIENCY = SEAL_EFFICIENCY;
/** Säkerhetsfaktor på lastens statiska vikt. */
export const LOAD_SAFETY_FACTOR = 2.0;
const SAFETY_FACTOR = LOAD_SAFETY_FACTOR;

/** Kraften man får räkna med efter tätningsfriktion (N). Den som ska jämföras
 *  mot ett kraftkrav — till skillnad från katalogens teoretiska värde. */
export function usableForceN(bore_mm: number, pressure_bar = 6): number {
  return Math.PI / 4 * bore_mm * bore_mm * pressure_bar * 0.1 * SEAL_EFFICIENCY;
}

/**
 * Compute minimum pneumatic bore diameter for a given load.
 * F_available = π/4 × d² × P × η  → d = sqrt(4F / (π × P × η))
 */
export function minBoreForMass(mass_kg: number): number {
  const force_n = mass_kg * 9.81 * SAFETY_FACTOR;
  const d_m = Math.sqrt((4 * force_n) / (Math.PI * WORKING_PRESSURE_PA * EFFICIENCY));
  const d_mm = d_m * 1000;
  // Round up to next standard bore
  return STANDARD_BORES.find((b) => b >= d_mm) ?? 200;
}

/**
 * Teoretisk tryckkraft vid 6 bar för en given borrning (N) — utan
 * verkningsgrad. Det här är talet KATALOGEN anger (piston_force_6bar_N), och
 * det som ska visas när man refererar till en produkts specifikation.
 *
 * Jämför aldrig ett kraftkrav mot det här värdet; använd usableForceN().
 * Rättat 2026-09-09: funktionen multiplicerade tidigare med EFFICIENCY trots
 * namnet, alltså returnerade den användbar kraft under etiketten teoretisk.
 * Den hade noll anropsställen, så inget gick fel i praktiken -- men den var
 * den enda av husets fyra kraftformler som såg auktoritativ ut.
 */
export function theoreticalForce(bore_mm: number): number {
  const d_m = bore_mm / 1000;
  return (Math.PI / 4) * d_m * d_m * WORKING_PRESSURE_PA;
}

export type Precision = "low" | "medium" | "high" | "very_high";
export type Speed = "slow" | "medium" | "fast" | "very_fast";
export type ApplicationType =
  | "linear_move"       // simple A→B movement
  | "pick_and_place"    // full PnP system (gripper + axes)
  | "gripping"          // just gripping
  | "vacuum_grip"       // vacuum gripper
  | "rodless"           // long strokes, no rod
  | "rotary"            // rotary motion
  | "general";

export type Technology = "pneumatic" | "electric" | "either";

export interface PhysicsDimensions {
  mass_kg?: number;
  distance_mm?: number;
  force_n?: number;         // direct force requirement if stated
  speed?: Speed;
  precision?: Precision;
  application?: ApplicationType;
  environment?: "standard" | "outdoor" | "food_grade" | "clean_room" | "atex" | "washdown";
  bore_hint_mm?: number;    // if user specifies bore directly
}

export interface PhysicsResult {
  // Hard constraints to apply to catalog
  minBore_mm: number | null;   // null = no bore constraint
  minStroke_mm: number | null;
  technology: Technology;
  categories: string[];         // category slugs to search, in priority order
  isSystem: boolean;            // true → show multi-component system answer

  // Human-readable reasoning (shown in chat)
  reasoning: string[];

  // Warnings to show the user
  warnings: string[];
}

type Sprak = "sv" | "en" | "de" | "es";

/**
 * Raderna i chattens "Teknisk analys" på fyra språk. De var bara svenska, även
 * under rubriken "Engineering analysis" (kritikerrundan 2026-11-18).
 */
const T = {
  slag: (d: number) => ({ sv: `Kräver slag ≥ ${d} mm`, en: `Requires stroke ≥ ${d} mm`, de: `Erfordert Hub ≥ ${d} mm`, es: `Requiere carrera ≥ ${d} mm` }),
  last: (m: number, f: number, sf: number, b: number) => ({
    sv: `Last ${m} kg → kolvkraft ${f} N krävs (SF ${sf}×) → min borr ${b} mm`,
    en: `Load ${m} kg → piston force ${f} N required (SF ${sf}×) → min bore ${b} mm`,
    de: `Last ${m} kg → Kolbenkraft ${f} N erforderlich (SF ${sf}×) → min. Bohrung ${b} mm`,
    es: `Carga ${m} kg → fuerza de pistón ${f} N necesaria (FS ${sf}×) → diámetro mín. ${b} mm`,
  }),
  mini: () => ({ sv: "Minicylinder / rundcylinder räcker (borr ≤ 16 mm)", en: "A mini / round cylinder is enough (bore ≤ 16 mm)", de: "Mini-/Rundzylinder reicht aus (Bohrung ≤ 16 mm)", es: "Basta un minicilindro / cilindro redondo (diámetro ≤ 16 mm)" }),
  // Stod förut "borr 25–50 mm" direkt efter "min borr 50 mm".
  standard: (b: number) => ({ sv: `Standardprofilcylinder rekommenderas (borr ${b} mm eller större)`, en: `Standard profile cylinder recommended (bore ${b} mm or larger)`, de: `Standard-Profilzylinder empfohlen (Bohrung ${b} mm oder größer)`, es: `Se recomienda un cilindro de perfil estándar (diámetro de ${b} mm o mayor)` }),
  tung: (b: number) => ({ sv: `Tung profilcylinder krävs (borr ${b} mm eller större) — t.ex. DSBC eller CP96`, en: `Heavy profile cylinder required (bore ${b} mm or larger) — e.g. DSBC or CP96`, de: `Schwerer Profilzylinder erforderlich (Bohrung ${b} mm oder größer) — z. B. DSBC oder CP96`, es: `Se requiere un cilindro de perfil pesado (diámetro de ${b} mm o mayor) — p. ej. DSBC o CP96` }),
  angivenBorr: (b: number) => ({ sv: `Angiven borrning: ${b} mm`, en: `Specified bore: ${b} mm`, de: `Angegebene Bohrung: ${b} mm`, es: `Diámetro indicado: ${b} mm` }),
  precision: () => ({
    sv: "Hög precision / repeterbarhet kräver ELEKTRISK axel (servomotor eller stegmotor). Pneumatik är komprimerbar och kan inte hålla exakt positionen mitt i slagets rörelse.",
    en: "High precision / repeatability requires an ELECTRIC axis (servo or stepper motor). Air is compressible and cannot hold an exact position mid-stroke.",
    de: "Hohe Präzision / Wiederholgenauigkeit erfordert eine ELEKTRISCHE Achse (Servo- oder Schrittmotor). Druckluft ist kompressibel und kann keine exakte Position mitten im Hub halten.",
    es: "La alta precisión / repetibilidad requiere un eje ELÉCTRICO (servomotor o motor paso a paso). El aire es compresible y no puede mantener una posición exacta a mitad de carrera.",
  }),
  uteslutsPneumatik: () => ({ sv: "Pneumatiska cylindrar UTESLUTS — de uppnår inte kontrollerad precision mitt i slaget.", en: "Pneumatic cylinders EXCLUDED — they cannot achieve controlled precision mid-stroke.", de: "Pneumatikzylinder AUSGESCHLOSSEN — sie erreichen keine kontrollierte Präzision mitten im Hub.", es: "Cilindros neumáticos EXCLUIDOS — no logran una precisión controlada a mitad de carrera." }),
  pickPlace: () => ({
    sv: "Pick & place = SYSTEM med flera komponenter: (1) Linjäraxel/cylinder för horisontell rörelse, (2) Vertikal cylinder/axel för lyft, (3) Gripdon för att hålla komponenten.",
    en: "Pick & place = SYSTEM with several components: (1) linear axis/cylinder for horizontal movement, (2) vertical cylinder/axis for lifting, (3) gripper to hold the part.",
    de: "Pick & Place = SYSTEM aus mehreren Komponenten: (1) Linearachse/Zylinder für die horizontale Bewegung, (2) vertikaler Zylinder/Achse zum Heben, (3) Greifer zum Halten des Teils.",
    es: "Pick & place = SISTEMA con varios componentes: (1) eje lineal/cilindro para el movimiento horizontal, (2) cilindro/eje vertical para elevar, (3) pinza para sujetar la pieza.",
  }),
  helaSystemet: () => ({ sv: "Visar hela systemet — gripdon och axlar, inte bara gripdonet.", en: "Shows the whole system — gripper and axes, not just the gripper.", de: "Zeigt das ganze System — Greifer und Achsen, nicht nur den Greifer.", es: "Muestra el sistema completo — pinza y ejes, no solo la pinza." }),
  grip: () => ({ sv: "Gripapplikation → pneumatiskt gripdon", en: "Gripping application → pneumatic gripper", de: "Greifanwendung → pneumatischer Greifer", es: "Aplicación de agarre → pinza neumática" }),
  vakuum: () => ({ sv: "Vakuumgrepp → sugkoppar och ejektor", en: "Vacuum grip → suction cups and ejector", de: "Vakuumgreifen → Sauggreifer und Ejektor", es: "Agarre por vacío → ventosas y eyector" }),
  stanglos: () => ({ sv: "Kolvstångslös cylinder rekommenderas för långa slag", en: "Rodless cylinder recommended for long strokes", de: "Kolbenstangenloser Zylinder für lange Hübe empfohlen", es: "Se recomienda un cilindro sin vástago para carreras largas" }),
  fart: () => ({
    sv: "Hög hastighet: överväg kolvstångslös cylinder (DGC, CY1S) eller externa stötdämpare för inbromsning.",
    en: "High speed: consider a rodless cylinder (DGC, CY1S) or external shock absorbers for deceleration.",
    de: "Hohe Geschwindigkeit: kolbenstangenlosen Zylinder (DGC, CY1S) oder externe Stoßdämpfer zum Abbremsen erwägen.",
    es: "Alta velocidad: considere un cilindro sin vástago (DGC, CY1S) o amortiguadores externos para la deceleración.",
  }),
  livsmedel: () => ({
    sv: "Livsmedelsmiljö: välj ett utförande för tvätt – rostfritt, livsmedelsgodkänt fett (NSF H1) och tätningar som tål rengöringsmedlen. Kontrollera det i databladet.",
    en: "Food environment: choose a washdown version – stainless, food-grade grease (NSF H1) and seals that withstand the cleaning agents. Check the datasheet.",
    de: "Lebensmittelumgebung: eine abwaschbare Ausführung wählen – Edelstahl, lebensmitteltaugliches Fett (NSF H1) und Dichtungen, die den Reinigungsmitteln standhalten. Im Datenblatt prüfen.",
    es: "Entorno alimentario: elija una versión apta para lavado – inoxidable, grasa de grado alimentario (NSF H1) y juntas que resistan los productos de limpieza. Compruébelo en la hoja de datos.",
  }),
  atex: () => ({ sv: "ATEX-klassad miljö: produkten måste ha Ex-certifiering (ATEX/UKEX).", en: "ATEX-classified environment: the product must be Ex-certified (ATEX/UKEX).", de: "ATEX-klassifizierte Umgebung: das Produkt muss Ex-zertifiziert sein (ATEX/UKEX).", es: "Entorno con clasificación ATEX: el producto debe tener certificación Ex (ATEX/UKEX)." }),
};

export function computePhysics(dims: PhysicsDimensions, locale = "sv"): PhysicsResult {
  const l: Sprak = (["sv", "en", "de", "es"].includes(locale) ? locale : "en") as Sprak;
  const result: PhysicsResult = {
    minBore_mm: null,
    minStroke_mm: null,
    technology: "either",
    categories: [],
    isSystem: false,
    reasoning: [],
    warnings: [],
  };

  // ─── 1. STROKE ─────────────────────────────────────────────────────────────
  if (dims.distance_mm != null) {
    result.minStroke_mm = dims.distance_mm;
    result.reasoning.push(T.slag(dims.distance_mm)[l]);
  }

  // ─── 2. BORE FROM MASS ─────────────────────────────────────────────────────
  const effectiveMass = dims.mass_kg;
  if (effectiveMass != null) {
    const minBore = minBoreForMass(effectiveMass);
    result.minBore_mm = minBore;
    const force = effectiveMass * 9.81 * SAFETY_FACTOR;
    result.reasoning.push(T.last(effectiveMass, Math.round(force), SAFETY_FACTOR, minBore)[l]);
    if (minBore <= 16) {
      result.reasoning.push(T.mini()[l]);
    } else if (minBore <= 50) {
      result.reasoning.push(T.standard(minBore)[l]);
    } else {
      result.reasoning.push(T.tung(minBore)[l]);
    }
  }

  // Override bore if user explicitly stated bore
  if (dims.bore_hint_mm != null) {
    result.minBore_mm = dims.bore_hint_mm;
    result.reasoning.push(T.angivenBorr(dims.bore_hint_mm)[l]);
  }

  // ─── 3. PRECISION → TECHNOLOGY ─────────────────────────────────────────────
  if (dims.precision === "high" || dims.precision === "very_high") {
    result.technology = "electric";
    // (servo-actuator had no DB row — servo/stepper axes ARE electric-actuators)
    result.categories = ["electric-actuator", "linear-module"];
    result.reasoning.push(T.precision()[l]);
    result.warnings.push(T.uteslutsPneumatik()[l]);
  } else {
    result.technology = "pneumatic";
  }

  // ─── 4. APPLICATION TYPE ───────────────────────────────────────────────────
  switch (dims.application) {
    case "pick_and_place":
      result.isSystem = true;
      result.categories = [
        "cylinder",            // X-axis linear movement
        "cylinder",            // Z-axis (vertical)
        "gripper",             // end effector
        "electric-actuator",   // electric alternative for X
      ];
      result.reasoning.push(T.pickPlace()[l]);
      if (!result.warnings.length) {
        result.warnings.push(T.helaSystemet()[l]);
      }
      break;

    case "gripping":
      result.categories = ["gripper"];
      result.reasoning.push(T.grip()[l]);
      break;

    case "vacuum_grip":
      result.categories = ["vacuum", "gripper"];
      result.reasoning.push(T.vakuum()[l]);
      break;

    case "rodless":
      // (rodless-cylinder had no DB row — rodless cylinders live in 'cylinder')
      result.categories = ["cylinder"];
      result.reasoning.push(T.stanglos()[l]);
      break;

    case "rotary":
      result.categories = ["rotary-actuator", "cylinder"];
      break;

    default:
      if (result.technology === "electric") {
        result.categories = ["electric-actuator"];
      } else {
        result.categories = ["cylinder"];
      }
  }

  // ─── 5. SPEED HINTS ────────────────────────────────────────────────────────
  if (dims.speed === "very_fast" || dims.speed === "fast") {
    if (result.technology !== "electric") {
      result.reasoning.push(T.fart()[l]);
    }
  }

  // ─── 6. ENVIRONMENT ────────────────────────────────────────────────────────
  if (dims.environment === "food_grade") {
    // Nämnde förut "SMC CM2 rostfri serie" som exempel. CM2 är en standardcylinder,
    // ingen tvättserie -- och inget i katalogen styrker exemplet. Kraven räcker.
    result.warnings.push(T.livsmedel()[l]);
  }
  if (dims.environment === "atex") {
    result.warnings.push(T.atex()[l]);
  }

  // Ensure we always have at least one category
  if (!result.categories.length) {
    result.categories = result.technology === "electric" ? ["electric-actuator"] : ["cylinder"];
  }

  return result;
}

/** Parse speed text → Speed enum */
export function parseSpeed(text: string): Speed | undefined {
  const t = text.toLowerCase();
  if (/very fast|mycket snabb|extremt snabb|high speed|snabb{2,}/.test(t)) return "very_fast";
  if (/fast|snabb|quick|rapid|hög hastighet/.test(t)) return "fast";
  if (/slow|långsam|låg hastighet/.test(t)) return "slow";
  if (/medium speed|medel/.test(t)) return "medium";
  return undefined;
}

/** Parse precision text → Precision enum */
export function parsePrecision(text: string): Precision | undefined {
  const t = text.toLowerCase();
  if (/very high precision|sub.?mm|micron|micrometer|mikro/.test(t)) return "very_high";
  if (/high precision|repeatab|repeterbar|exact position|servo|stepper|stegmotor|encoder/.test(t)) return "high";
  if (/low precision|rough|ungefär|approximate|grov/.test(t)) return "low";
  if (/medium precision|standard precision|moderate/.test(t)) return "medium";
  return undefined;
}

/** Parse application type from text */
export function parseApplication(text: string): ApplicationType | undefined {
  const t = text.toLowerCase();
  if (/pick.?and.?place|pnp|pick\s+n\s+place|plocka|grippa och flytta/.test(t)) return "pick_and_place";
  if (/gripper|grip|klämm|pneumatisk grepp|klo/.test(t)) return "gripping";
  if (/vacuum|vakuum|sug/.test(t)) return "vacuum_grip";
  if (/rodless|kolvstångslös|utan kolvstång/.test(t)) return "rodless";
  if (/rotat|svänger|vridning|rotary/.test(t)) return "rotary";
  return "linear_move";
}

/** Parse environment */
export function parseEnvironment(text: string): PhysicsDimensions["environment"] {
  const t = text.toLowerCase();
  if (/atex|explosion/.test(t)) return "atex";
  if (/food|livsmedel|hygienic|hygien|wash.?down/.test(t)) return "food_grade";
  if (/clean.?room|renrum/.test(t)) return "clean_room";
  if (/outdoor|utomhus|ip6[567]|corros/.test(t)) return "outdoor";
  return "standard";
}

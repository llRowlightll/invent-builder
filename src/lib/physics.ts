/**
 * physics.ts — Hard engineering rules for pneumatic + electric component selection.
 *
 * These rules are NOT delegated to an LLM. They are deterministic calculations
 * based on standard industrial engineering formulas. The LLM only extracts
 * numbers from the user's text; physics validation happens here.
 */

// Standard pneumatic bore sizes (mm) — ISO / manufacturer standard
export const STANDARD_BORES = [8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200];

// Working pressure assumption (Pa) — industry standard 6 bar
const WORKING_PRESSURE_PA = 600_000;
// Pneumatic efficiency factor (seals, friction)
const EFFICIENCY = 0.75;
// Safety factor on required force
const SAFETY_FACTOR = 2.0;

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
 * Compute theoretical push force at 6 bar for a given bore (N).
 */
export function theoreticalForce(bore_mm: number): number {
  const d_m = bore_mm / 1000;
  return (Math.PI / 4) * d_m * d_m * WORKING_PRESSURE_PA * EFFICIENCY;
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

export function computePhysics(dims: PhysicsDimensions): PhysicsResult {
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
    result.reasoning.push(`Kräver slag ≥ ${dims.distance_mm} mm`);
  }

  // ─── 2. BORE FROM MASS ─────────────────────────────────────────────────────
  const effectiveMass = dims.mass_kg;
  if (effectiveMass != null) {
    const minBore = minBoreForMass(effectiveMass);
    result.minBore_mm = minBore;
    const force = effectiveMass * 9.81 * SAFETY_FACTOR;
    result.reasoning.push(
      `Last ${effectiveMass} kg → kolvkraft ${Math.round(force)} N krävs (SF ${SAFETY_FACTOR}×) → min borr ${minBore} mm`
    );
    if (minBore <= 16) {
      result.reasoning.push("Minicylinder / rundcylinder räcker (borr ≤ 16 mm)");
    } else if (minBore <= 50) {
      result.reasoning.push("Standardprofilcylinder rekommenderas (borr 25–50 mm)");
    } else {
      result.reasoning.push("Tung profilcylinder krävs (borr 63+ mm) — DSBC, CP96 eller liknande");
    }
  }

  // Override bore if user explicitly stated bore
  if (dims.bore_hint_mm != null) {
    result.minBore_mm = dims.bore_hint_mm;
    result.reasoning.push(`Användarspecificerat borr: ${dims.bore_hint_mm} mm`);
  }

  // ─── 3. PRECISION → TECHNOLOGY ─────────────────────────────────────────────
  if (dims.precision === "high" || dims.precision === "very_high") {
    result.technology = "electric";
    // (servo-actuator had no DB row — servo/stepper axes ARE electric-actuators)
    result.categories = ["electric-actuator", "linear-module"];
    result.reasoning.push(
      "Hög precision / repeterbarhet kräver ELEKTRISK axel (servomotor eller stegmotor). " +
      "Pneumatik är komprimerbar och kan inte hålla exakt positionen mitt i slagets rörelse."
    );
    result.warnings.push(
      "Pneumatiska cylindrar UTESLUTS — de uppnår inte kontrollerad precision mid-stroke."
    );
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
      result.reasoning.push(
        "Pick & place = SYSTEM med flera komponenter: " +
        "(1) Linjäraxel/cylinder för horisontell rörelse, " +
        "(2) Vertikal cylinder/axel för lyft, " +
        "(3) Gripklo för att hålla komponenten."
      );
      if (!result.warnings.length) {
        result.warnings.push("Returnerar hela systemet — gripper + axlar, inte bara gripper.");
      }
      break;

    case "gripping":
      result.categories = ["gripper"];
      result.reasoning.push("Gripper-applikation → pneumatisk gripklo");
      break;

    case "vacuum_grip":
      result.categories = ["vacuum", "gripper"];
      result.reasoning.push("Vakuumgrepp → vakuumkoppar + ejektorer");
      break;

    case "rodless":
      // (rodless-cylinder had no DB row — rodless cylinders live in 'cylinder')
      result.categories = ["cylinder"];
      result.reasoning.push("Kolvstångslös cylinder rekommenderas för långa slag");
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
      result.reasoning.push(
        "Hög hastighet: överväg kolvstångslös cylinder (DGC, CY1R) eller externa stötdämpare för inbromsning."
      );
    }
  }

  // ─── 6. ENVIRONMENT ────────────────────────────────────────────────────────
  if (dims.environment === "food_grade") {
    result.warnings.push("Food-grade miljö: välj cylinder med H1-smörjmedel och rostfritt stål (t.ex. SMC CM2 rostfri serie).");
  }
  if (dims.environment === "atex") {
    result.warnings.push("ATEX-klassad miljö: produkten måste ha Ex-certifiering (ATEX/UKEX).");
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

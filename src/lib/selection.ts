import type {
  BomItem,
  Mode,
  ProductRow,
  SelectionInput,
  SelectionResult,
} from "./types";
import { byCategory, bySku, specNum } from "./catalog";

/** Score an actuator candidate. Lower = better. */
function actuatorScore(p: ProductRow, input: SelectionInput): number {
  const stroke = specNum(p, "stroke") ?? 0;
  const force = specNum(p, "max_force") ?? 0;
  const lead = p.lead_time_days ?? 30;
  const strokeMargin = stroke - input.stroke_mm; // smallest non-negative wins for cheap
  const forceMargin = force - input.force_n;
  if (input.mode === "cheapest") {
    return strokeMargin * 0.05 + forceMargin * 0.01 + lead * 0.5;
  }
  // BEST: penalize undershoot, reward headroom and Festo (well-integrated), absolute capable
  const brandBonus = p.brand.slug === "festo" ? -50 : 0;
  const fb = p.specs["feedback"]?.value;
  const fbBonus = fb === input.feedback ? -20 : 0;
  return -forceMargin * 0.02 - strokeMargin * 0.01 + lead * 0.3 + brandBonus + fbBonus;
}

function pickActuator(catalog: ProductRow[], input: SelectionInput): ProductRow | null {
  const cands = byCategory(catalog, "actuator").filter((p) => {
    const stroke = specNum(p, "stroke");
    const force = specNum(p, "max_force");
    return stroke != null && force != null && stroke >= input.stroke_mm && force >= input.force_n;
  });
  if (!cands.length) return null;
  return [...cands].sort((a, b) => actuatorScore(a, input) - actuatorScore(b, input))[0];
}

function pickDrive(
  catalog: ProductRow[],
  actuator: ProductRow | null,
  input: SelectionInput,
): ProductRow | null {
  const recSku = actuator?.specs["recommended_drive"]?.value;
  if (input.mode === "best" && recSku) {
    const r = bySku(catalog, recSku);
    if (r) return r;
  }
  const drives = byCategory(catalog, "drive").filter((d) => {
    const v = d.voltage ?? d.specs["voltage"]?.value;
    if (input.voltage && v && !v.includes(input.voltage.replace("VAC", ""))) return false;
    if (input.fieldbus !== "none" && d.fieldbus && d.fieldbus !== input.fieldbus) return false;
    if (input.feedback === "absolute") {
      const sf = d.specs["supports_feedback"]?.value;
      if (sf && sf !== "absolute") return false;
    }
    return true;
  });
  if (!drives.length) return null;
  drives.sort((a, b) => {
    const ka = specNum(a, "power") ?? 0;
    const kb = specNum(b, "power") ?? 0;
    if (input.mode === "cheapest") return ka - kb; // cheapest = lowest kW that fits
    return kb - ka; // best = highest kW
  });
  return drives[0];
}

function pickPsu(catalog: ProductRow[], input: SelectionInput): ProductRow | null {
  const psus = byCategory(catalog, "psu");
  if (!psus.length) return null;
  if (input.mode === "best") {
    return psus.find((p) => p.sku === "SIE-SITOP-20A") ?? psus[0];
  }
  return psus.find((p) => p.sku === "PHX-QUINT-10A") ?? psus.find((p) => p.sku === "SIE-SITOP-10A") ?? psus[0];
}

function pickPlcAndIo(catalog: ProductRow[], input: SelectionInput): ProductRow[] {
  const plcs = byCategory(catalog, "plc");
  const ios = byCategory(catalog, "io");
  if (input.mode === "best") {
    const out: ProductRow[] = [];
    const cpu = plcs.find((p) => p.sku === "SIE-S71515") ?? plcs[0];
    if (cpu) out.push(cpu);
    out.push(...ios);
    return out;
  }
  const cpu = plcs.find((p) => p.sku === "SIE-S71214") ?? plcs[0];
  return cpu ? [cpu] : [];
}

function pickFeedback(catalog: ProductRow[], input: SelectionInput): ProductRow | null {
  const fbs = byCategory(catalog, "feedback");
  return (
    fbs.find((f) =>
      input.feedback === "absolute"
        ? f.sku === "SIE-ENC-ABS22"
        : f.sku === "SIE-ENC-INC",
    ) ?? fbs[0] ?? null
  );
}

function pickCables(catalog: ProductRow[]): ProductRow[] {
  const cables = byCategory(catalog, "cable");
  return [
    cables.find((c) => c.sku === "LAPP-MOT-5M"),
    cables.find((c) => c.sku === "LAPP-ENC-5M"),
    cables.find((c) => c.sku === "LAPP-PN-3M"),
  ].filter(Boolean) as ProductRow[];
}

function pickAccessoriesAndSpares(catalog: ProductRow[], mode: Mode): ProductRow[] {
  const acc = byCategory(catalog, "accessory");
  const spare = byCategory(catalog, "spare");
  if (mode === "cheapest") {
    return [acc.find((a) => a.sku === "FE-COUP-50")].filter(Boolean) as ProductRow[];
  }
  return [
    acc.find((a) => a.sku === "FE-COUP-50"),
    acc.find((a) => a.sku === "FE-MOUNT-EGSA"),
    acc.find((a) => a.sku === "SIE-BRAKE-V90"),
    spare.find((s) => s.sku === "SIE-SP-FAN-V90"),
    spare.find((s) => s.sku === "FE-SP-SEAL-50"),
  ].filter(Boolean) as ProductRow[];
}

export function buildOrderCode(input: SelectionInput, actuator: ProductRow | null): string {
  const stroke = specNum(actuator ?? ({} as ProductRow), "stroke") ?? input.stroke_mm;
  const fb = input.feedback === "absolute" ? "ABS" : "INC";
  const bus = input.fieldbus === "PROFINET" ? "PN" : input.fieldbus === "EthernetIP" ? "EIP" : "NONE";
  const v = input.voltage.replace("VAC", "");
  const mode = input.mode === "best" ? "BEST" : "CHEAP";
  return `AX-${mode}-${stroke}-${input.force_n}-${fb}-${bus}-${v}-${input.ip}`;
}

export function runSelection(catalog: ProductRow[], input: SelectionInput): SelectionResult {
  const items: BomItem[] = [];
  const validation: SelectionResult["validation"] = [];
  const notes: string[] = [];

  const actuator = pickActuator(catalog, input);
  if (!actuator) {
    validation.push({
      level: "error",
      message: `No actuator covers stroke ≥ ${input.stroke_mm}mm and force ≥ ${input.force_n}N.`,
    });
  } else {
    const force = specNum(actuator, "max_force") ?? 0;
    const margin = ((force - input.force_n) / Math.max(input.force_n, 1)) * 100;
    if (margin < 15) {
      validation.push({
        level: "warn",
        message: `Force margin only ${margin.toFixed(0)}% — consider next size up.`,
      });
    }
    items.push({
      role: "actuator",
      product: actuator,
      qty: 1,
      why: `Meets stroke ${input.stroke_mm}mm and force ${input.force_n}N (${input.mode}).`,
    });
  }

  const drive = pickDrive(catalog, actuator, input);
  if (!drive) {
    validation.push({ level: "error", message: "No matching servo drive found." });
  } else {
    items.push({
      role: "drive",
      product: drive,
      qty: 1,
      why:
        input.mode === "best"
          ? `Highest-grade drive matching ${input.voltage} / ${input.fieldbus}.`
          : `Lowest-power drive that fits the load.`,
    });
  }

  const psu = pickPsu(catalog, input);
  if (psu)
    items.push({
      role: "psu",
      product: psu,
      qty: 1,
      why: input.mode === "best" ? "Higher headroom 24V supply." : "Cost-optimised 24V supply.",
    });

  for (const m of pickPlcAndIo(catalog, input)) {
    items.push({
      role: m.category.slug === "plc" ? "plc" : "io",
      product: m,
      qty: 1,
      why: input.mode === "best" ? "Mid-range CPU + distributed I/O." : "Compact PLC, no extra I/O.",
    });
  }

  const fb = pickFeedback(catalog, input);
  if (fb)
    items.push({
      role: "feedback",
      product: fb,
      qty: 1,
      why: input.feedback === "absolute" ? "Absolute encoder requested." : "Incremental encoder.",
    });

  for (const c of pickCables(catalog)) {
    items.push({ role: "cable", product: c, qty: 1, why: "Standard pre-assembled cable." });
  }

  for (const a of pickAccessoriesAndSpares(catalog, input.mode)) {
    items.push({
      role: a.category.slug === "spare" ? "spare" : "accessory",
      product: a,
      qty: 1,
      why: input.mode === "best" ? "Recommended in best bundle." : "Minimum required accessory.",
    });
  }

  if (input.fieldbus !== "none" && drive && drive.fieldbus && drive.fieldbus !== input.fieldbus) {
    validation.push({
      level: "warn",
      message: `Selected drive uses ${drive.fieldbus}, you asked for ${input.fieldbus}.`,
    });
  }

  notes.push(
    input.mode === "best"
      ? "BEST: optimised for robustness, lifetime, integrated safety and spares."
      : "CHEAPEST: optimised for lowest part count and shortest lead time.",
  );

  return { items, orderCode: buildOrderCode(input, actuator), validation, notes };
}

/** Convert pneumatic cylinder → required electric force. F = P · π · (d/2)² with safety margin. */
export function pneumaticToForce(pressure_bar: number, bore_mm: number, margin = 1.3): number {
  const P = pressure_bar * 1e5; // Pa
  const r = bore_mm / 2 / 1000; // m
  const F = P * Math.PI * r * r;
  return Math.round(F * margin);
}

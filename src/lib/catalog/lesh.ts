/**
 * SMC LESH — elektriskt slidbord med hög styvhet (linjärstyrning), storlek
 * 8, 16 och 25, stegmotor (inkrementell eller batterilös absolut) eller
 * servomotor 24 V DC, med eller utan styrenhet i samma artikelnummer.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Slide Tables LES/LESH Series" (katalogutdrag, 102 sidor,
 *   katalogsidor 635–735). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-lesh.pdf'. LESH-delen:
 *     - batterilös absolut: How to Order 705, styrenheter 706, data 707
 *     - inkrementell: How to Order 715, styrenheter 716, data 718 (steg)
 *       och 719 (servo)
 *
 * VAD FAMILJEN ÄR. LESH (hög styvhet). LES (kompakt, sida 640–686) är en
 * egen nyckel med egna storlekar och ingår inte; det motorlösa utförandet
 * (LESH□□□N…, "Motorless") ingår inte heller.
 *
 * KODENS FORM (sida 705 och 715):
 *
 *   LESH 25 R E J - 50 B S H - R1 CD17T     absolut, JXC-styrenhet
 *   LESH 8  R   J - 50       - S1 AN1D      inkrementell steg, LECPA
 *   LESH 16 L A K - 100      - R3 6P3       inkrementell servo, LECA6
 *   LESH{storlek}{fäste}{motor}{stigning}-{slag}{lås}{kropp}{hållare}-{kabel}{styrenhet}{I/O-kabel}{montering}{tillbehör}
 *
 * Styrenheten är en nyckel i nyckeln: JXC skrivs C + gränssnitt + antal
 * axlar (1, eller F med STO) + montering (7 skruv, 8 DIN) + tillbehör
 * (S/T kommunikationsplugg för DeviceNet/CC-Link, 1/3/5 I/O-kabel för
 * parallell I/O); LEC skrivs typ (6N/6P LECA6, AN/AP LECPA) + I/O-kabel
 * (1/3/5) + montering (D DIN). Aktuator och styrenhet säljs som ett paket.
 */

import { LE_CABLES, LE_CONTROLLERS, LE_CTRL_ACCS, LE_CTRL_MOUNTS, LE_IO_CABLES, LE_TAIL_REGEX, leTailOk } from "./le-controller";

export const LESH_SOURCE = {
  file: "smc-kat-lesh.pdf",
  edition: "SMC LES/LESH catalogue (catalogue pages 635–735)",
  title: "SMC Slide Tables LES/LESH Series",
  brand: "SMC",
} as const;

export interface LESHValue {
  code: string;
  label_sv: string;
}

/** Data per storlek, stigning och motortyp (sida 707, 718, 719). */
export interface LESHPerformance {
  /** Arbetslast horisontellt/vertikalt [kg]. */
  load_h_kg: number;
  load_v_kg: number;
  /** Tryckkraft [N], min–max. */
  push_n: [number, number];
  /** Hastighet [mm/s], min–max. */
  speed: [number, number];
}
export interface LESHSize extends LESHValue {
  size: number;
  /** Stigning J respektive K [mm] (sida 715). */
  lead_mm: { J: number; K: number };
  strokes: number[];
  /** Låsets hållkraft [N] (sida 718). */
  lock_n: number;
  motor_size: number;
  /** Batterilös absolut E finns (sida 705: bara LESH25). */
  abs_ok: boolean;
  /** Prestanda per motortyp ("" steg, "A" servo, "E" absolut) och stigning. */
  perf: Record<string, { J: LESHPerformance; K: LESHPerformance }>;
}
const P = (h: number, v: number, push: [number, number], speed: [number, number]): LESHPerformance => ({ load_h_kg: h, load_v_kg: v, push_n: push, speed });
export const LESH_SIZES: LESHSize[] = [
  {
    code: "8", size: 8, lead_mm: { J: 8, K: 4 }, strokes: [50, 75], lock_n: 24, motor_size: 20, abs_ok: false, label_sv: "Storlek 8 (motor 20, slag 50 eller 75)",
    perf: { "": { K: P(2, 0.5, [6, 15], [10, 200]), J: P(1, 0.25, [4, 10], [20, 400]) }, A: { K: P(2, 0.5, [7.5, 11], [1, 200]), J: P(1, 0.25, [5, 7.5], [1, 400]) } },
  },
  {
    code: "16", size: 16, lead_mm: { J: 10, K: 5 }, strokes: [50, 100], lock_n: 300, motor_size: 28, abs_ok: false, label_sv: "Storlek 16 (motor 28, slag 50 eller 100)",
    perf: { "": { K: P(8, 2, [23.5, 55], [10, 200]), J: P(5, 1, [15, 35], [20, 400]) }, A: { K: P(5, 2, [17.5, 35], [1, 200]), J: P(2.5, 1, [10, 20], [1, 400]) } },
  },
  {
    code: "25", size: 25, lead_mm: { J: 16, K: 8 }, strokes: [50, 100, 150], lock_n: 500, motor_size: 42, abs_ok: true, label_sv: "Storlek 25 (motor 42, slag 50, 100 eller 150)",
    perf: {
      "": { K: P(12, 4, [77, 180], [10, 150]), J: P(8, 2, [43, 100], [20, 400]) },
      A: { K: P(6, 2.5, [31, 62], [1, 150]), J: P(4, 1.5, [19, 38], [1, 400]) },
      E: { K: P(12, 4, [77, 180], [10, 150]), J: P(8, 2, [43, 100], [20, 400]) },
    },
  },
];
export const LESH_MOUNTS: LESHValue[] = [
  { code: "R", label_sv: "Basutförande: motorn parallellt med bordet (R)" },
  { code: "L", label_sv: "Symmetriskt utförande: motorn parallellt, spegelvänt (L)" },
  { code: "D", label_sv: "Motorn i linje bakom bordet (D)" },
];
export const LESH_MOTORS: LESHValue[] = [
  { code: "A", label_sv: "Servomotor 24 V DC, inkrementell (styrenhet LECA6)" },
  { code: "E", label_sv: "Batterilös absolut stegmotor 24 V DC (bara storlek 25; styrenhet JXC)" },
];
export const LESH_LEADS: LESHValue[] = [
  { code: "J", label_sv: "Hög stigning: 8/10/16 mm för storlek 8/16/25" },
  { code: "K", label_sv: "Låg stigning: 4/5/8 mm för storlek 8/16/25" },
];
/** Etiketterna börjar inte med koden: "50 mm" med koden 50 klipps av stripLeadingCode. */
export const LESH_STROKES: LESHValue[] = [
  { code: "50", label_sv: "Slag 50 mm" },
  { code: "75", label_sv: "Slag 75 mm (storlek 8)" },
  { code: "100", label_sv: "Slag 100 mm (storlek 16 och 25)" },
  { code: "150", label_sv: "Slag 150 mm (storlek 25)" },
];
export const LESH_LOCK: LESHValue = { code: "B", label_sv: "Med lås (omagnetiserande, hållkraft 24/300/500 N)" };
export const LESH_BODY: LESHValue = { code: "S", label_sv: "Dammskyddad: avstrykare på stångkåpan, packningar i ändkåporna (R/L ≈ IP5X)" };
export const LESH_HOLDER: LESHValue = { code: "H", label_sv: "Med sidohållare, 4 st (bara D-typ)" };

export type { LECable as LESHCable, LEController as LESHController } from "./le-controller";
/** Kabel och styrenhet delas med LEY (le-controller.ts); sida 715–716. */
export const LESH_CABLES = LE_CABLES;
export const LESH_CONTROLLERS = LE_CONTROLLERS;
export const LESH_IO_CABLES = LE_IO_CABLES;
export const LESH_CTRL_MOUNTS = LE_CTRL_MOUNTS;
export const LESH_CTRL_ACCS = LE_CTRL_ACCS;

export const LESH_LIMITS = {
  repeatability_mm: 0.05,
  max_accel_mm_s2: 5000,
  temp_c: [5, 40],
  enclosure: "IP30",
  supply_vdc: 24,
} as const;

export interface LESHConfig {
  size: string;
  mount: string;
  lead: string;
  stroke: string;
  motor?: string;
  lock?: string;
  body?: string;
  holder?: string;
  cable?: string;
  ctrl?: string;
  io_cable?: string;
  ctrl_mount?: string;
  ctrl_acc?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

/** Låset B finns inte på R/L-typ i storlek 8 och 16 vid 50 mm slag (sida 715, tabellen). */
export function leshLockOk(size: LESHSize, mount: string, stroke: number): boolean {
  if (mount === "D") return true;
  if (size.size === 25) return true;
  return stroke > 50;
}

export function leshBuildCode(c: LESHConfig): string | null {
  const size = LESH_SIZES.find((s) => s.code === c.size);
  if (!size || !har(LESH_MOUNTS, c.mount) || !har(LESH_LEADS, c.lead)) return null;
  const stroke = Number(c.stroke);
  if (!size.strokes.includes(stroke)) return null;
  const motor = c.motor ?? "";
  if (motor && !har(LESH_MOTORS, motor)) return null;
  if (motor === "E" && !size.abs_ok) return null;
  if (motor === "A" && c.mount === "D" && size.size === 25) return null;
  const lock = c.lock ?? "";
  if (lock && lock !== LESH_LOCK.code) return null;
  if (lock && !leshLockOk(size, c.mount, stroke)) return null;
  const body = c.body ?? "";
  if (body && body !== LESH_BODY.code) return null;
  const holder = c.holder ?? "";
  if (holder && (holder !== LESH_HOLDER.code || c.mount !== "D")) return null;
  const cable = c.cable ?? "";
  const ctrl = c.ctrl ?? "";
  const io = c.io_cable ?? "";
  const cm = c.ctrl_mount ?? "";
  const acc = c.ctrl_acc ?? "";
  if (!leTailOk(motor, cable, ctrl, io, cm, acc)) return null;
  const svans = `${cable}${ctrl}${io}${cm}${acc}`;
  return `LESH${size.code}${c.mount}${motor}${c.lead}-${stroke}${lock}${body}${holder}${svans ? `-${svans}` : ""}`;
}

export function leshParseCode(raw: string): { config: LESHConfig } | null {
  const k = raw.trim().toUpperCase();
  const m = new RegExp(`^LESH(8|16|25)([RLD])([AE]?)([JK])-(50|75|100|150)(B?)(S?)(H?)(?:-${LE_TAIL_REGEX})?$`).exec(k);
  if (!m) return null;
  const [, size, mount, motor, lead, stroke, lock, body, holder, cable, ctrl, io, cm, acc] = m;
  const c: LESHConfig = {
    size, mount, lead, stroke, motor: motor || undefined, lock: lock || undefined, body: body || undefined, holder: holder || undefined,
    cable: cable || undefined, ctrl: ctrl || undefined, io_cable: io || undefined, ctrl_mount: cm || undefined, ctrl_acc: acc || undefined,
  };
  if (leshBuildCode(c) !== k) return null;
  return { config: c };
}

export const LESH_ORDER_CODE_TEMPLATE =
  "LESH{size}{mount}{motor}{lead}-{stroke}{lock}{body}{holder}-{cable}{ctrl}{io_cable}{ctrl_mount}{ctrl_acc}";

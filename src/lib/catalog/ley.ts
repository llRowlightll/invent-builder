/**
 * SMC LEY — elektrisk stångcylinder (kulskruv), storlek 16, 25, 32 och 40,
 * stegmotor eller servomotor 24 V DC, inkrementell, med eller utan
 * styrenhet i samma artikelnummer.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Rod Type LEY Series / Guide Rod Type LEYG Series" (katalogutdrag,
 *   89 sidor, katalogsidor 413–575). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-ley.pdf'. LEY 24 V DC-delen:
 *     - How to Order sida 459, styrenheter och noter 460, data 462 (steg)
 *       och 463 (servo)
 *
 * VAD FAMILJEN ÄR. LEY med stegmotor eller servomotor 24 V DC (sida 459).
 * LEY med AC-servomotor (LEY□□S/T med LECS/LECY, sida 473–497), den
 * dammtäta/vattenstrålsäkra LEY-X5 (sida 903), sekundärbatteri-utförandet,
 * det motorlösa utförandet, den batterilösa absoluta (sida 415–458, inte i
 * utdraget) och styrstångstypen LEYG (sida 545–575) är egna nycklar.
 *
 * KODENS FORM (sida 459):
 *
 *   LEY 16   B - 30      - S1              stegmotor, standardkabel
 *   LEY 25 R A A - 300 B M L - R3 6N1D     servo, lås, hangänga, fot, LECA6
 *   LEY 32 D   C - 500 W   - R1 CD17T      i linje, lås + kåpa, JXCD1
 *   LEY{storlek}{fäste}{motor}{stigning}-{slag}{motortillval}{stångände}{montering}-{kabel}{styrenhet}{I/O-kabel}{montering}{tillbehör}
 *
 * Styrenheten är en nyckel i nyckeln (JXC/LEC), gemensam med LESH —
 * se le-controller.ts.
 */
import { LE_CABLES, LE_CONTROLLERS, LE_CTRL_ACCS, LE_CTRL_MOUNTS, LE_IO_CABLES, LE_TAIL_REGEX, leTailOk } from "./le-controller";

export const LEY_SOURCE = {
  file: "smc-kat-ley.pdf",
  edition: "SMC LEY/LEYG catalogue (catalogue pages 413–575)",
  title: "SMC Electric Actuator Rod Type LEY Series",
  brand: "SMC",
} as const;

export interface LEYValue {
  code: string;
  label_sv: string;
}

/** Data per storlek, stigning och motortyp (sida 462 för JXC□1/JXC□F, sida 463 för servo). */
export interface LEYPerformance {
  load_h_kg: number;
  load_v_kg: number;
  push_n: [number, number];
  speed: [number, number];
  lock_n: number;
}
export interface LEYSize extends LEYValue {
  size: number;
  lead_mm: { A: number; B: number; C: number };
  /** Standardslag (sida 459, tabellen). */
  standard: number[];
  /** Tillverkbart slagområde (sida 459). */
  stroke_range: [number, number];
  motor_size: number;
  /** Servomotor A finns (sida 459: LEY16 och LEY25). */
  servo_ok: boolean;
  /** Huvudfläns G finns (sida 460 *7: inte LEY32/40). */
  head_flange_ok: boolean;
  /** Största slag för dubbelt gaffelfäste D (sida 460 *5). */
  clevis_max_mm: number;
  /** Största slag för horisontell utkragande montering av flänsar/gängade ändar (sida 460 *4); 0 = ingen gräns. */
  cantilever_max_mm: number;
  /** Största tryckhastighet [mm/s] (sida 462). */
  push_speed_max: number;
  perf: Record<string, { A: LEYPerformance; B: LEYPerformance; C: LEYPerformance }>;
}
const P = (h: number, v: number, push: [number, number], speed: [number, number], lock: number): LEYPerformance => ({ load_h_kg: h, load_v_kg: v, push_n: push, speed, lock_n: lock });
const st = (...s: number[]) => s;
export const LEY_SIZES: LEYSize[] = [
  {
    code: "16", size: 16, lead_mm: { A: 10, B: 5, C: 2.5 }, standard: st(30, 50, 100, 150, 200, 250, 300), stroke_range: [10, 300], motor_size: 28,
    servo_ok: true, head_flange_ok: true, clevis_max_mm: 100, cantilever_max_mm: 0, push_speed_max: 50, label_sv: "Storlek 16 (motor 28, slag 30–300)",
    perf: {
      "": { A: P(6, 2, [14, 38], [15, 500], 20), B: P(17, 4, [27, 74], [8, 250], 39), C: P(30, 8, [51, 141], [4, 125], 78) },
      A: { A: P(3, 2, [16, 30], [1, 500], 20), B: P(6, 4, [30, 58], [1, 250], 39), C: P(12, 8, [57, 111], [1, 125], 78) },
    },
  },
  {
    code: "25", size: 25, lead_mm: { A: 12, B: 6, C: 3 }, standard: st(30, 50, 100, 150, 200, 250, 300, 350, 400), stroke_range: [15, 400], motor_size: 42,
    servo_ok: true, head_flange_ok: true, clevis_max_mm: 200, cantilever_max_mm: 200, push_speed_max: 35, label_sv: "Storlek 25 (motor 42, slag 30–400)",
    perf: {
      "": { A: P(20, 8, [63, 122], [18, 500], 78), B: P(40, 16, [126, 238], [9, 250], 157), C: P(60, 30, [232, 452], [5, 125], 294) },
      A: { A: P(7, 3, [18, 35], [2, 500], 78), B: P(15, 6, [37, 72], [1, 250], 157), C: P(30, 12, [66, 130], [1, 125], 294) },
    },
  },
  {
    code: "32", size: 32, lead_mm: { A: 16, B: 8, C: 4 }, standard: st(30, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500), stroke_range: [20, 500], motor_size: 56.4,
    servo_ok: false, head_flange_ok: false, clevis_max_mm: 200, cantilever_max_mm: 100, push_speed_max: 30, label_sv: "Storlek 32 (motor 56,4, slag 30–500)",
    perf: { "": { A: P(30, 11, [80, 189], [24, 500], 108), B: P(45, 22, [156, 370], [12, 300], 216), C: P(60, 43, [296, 707], [6, 150], 421) } },
  },
  {
    code: "40", size: 40, lead_mm: { A: 16, B: 8, C: 4 }, standard: st(30, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500), stroke_range: [20, 500], motor_size: 56.4,
    servo_ok: false, head_flange_ok: false, clevis_max_mm: 200, cantilever_max_mm: 100, push_speed_max: 30, label_sv: "Storlek 40 (motor 56,4, slag 30–500)",
    perf: { "": { A: P(50, 13, [132, 283], [24, 500], 127), B: P(60, 27, [266, 553], [12, 350], 265), C: P(80, 53, [562, 1058], [6, 175], 519) } },
  },
];
export const LEY_MOUNTS: LEYValue[] = [
  { code: "R", label_sv: "Motorn parallellt på höger sida (R; standard är ovansidan)" },
  { code: "L", label_sv: "Motorn parallellt på vänster sida (L)" },
  { code: "D", label_sv: "Motorn i linje bakom cylindern (D)" },
];
export const LEY_MOTOR: LEYValue = { code: "A", label_sv: "Servomotor 24 V DC, inkrementell (storlek 16 och 25; styrenhet LECA6)" };
export const LEY_LEADS: LEYValue[] = [
  { code: "A", label_sv: "Hög stigning: 10/12/16/16 mm för storlek 16/25/32/40" },
  { code: "B", label_sv: "Mellanstigning: 5/6/8/8 mm" },
  { code: "C", label_sv: "Låg stigning: 2,5/3/4/4 mm" },
];
export interface LEYMotorOption extends LEYValue {
  lock: boolean;
  cover: boolean;
}
export const LEY_MOTOR_OPTIONS: LEYMotorOption[] = [
  { code: "C", lock: false, cover: true, label_sv: "Med motorkåpa" },
  { code: "B", lock: true, cover: false, label_sv: "Med lås (omagnetiserande)" },
  { code: "W", lock: true, cover: true, label_sv: "Med lås och motorkåpa" },
];
export const LEY_ROD_END: LEYValue = { code: "M", label_sv: "Hangängad kolvstångsände (en stångändmutter medföljer; standard är hongänga)" };
export interface LEYMounting extends LEYValue {
  /** Bara motorn parallellt (sida 459: ●/— i tabellen). */
  parallel_only: boolean;
}
export const LEY_MOUNTINGS: LEYMounting[] = [
  { code: "L", parallel_only: true, label_sv: "Fotfäste (bara motorn parallellt)" },
  { code: "F", parallel_only: true, label_sv: "Fläns vid kolvstången (bara motorn parallellt)" },
  { code: "G", parallel_only: true, label_sv: "Fläns vid gaveln (bara motorn parallellt, storlek 16 och 25)" },
  { code: "D", parallel_only: true, label_sv: "Dubbelt gaffelfäste (bara motorn parallellt)" },
];
export const LEY_CABLES = LE_CABLES;
export const LEY_CONTROLLERS = LE_CONTROLLERS;
export const LEY_IO_CABLES = LE_IO_CABLES;
export const LEY_CTRL_MOUNTS = LE_CTRL_MOUNTS;
export const LEY_CTRL_ACCS = LE_CTRL_ACCS;

export const LEY_LIMITS = {
  repeatability_mm: 0.02,
  max_accel_mm_s2: 3000,
  temp_c: [5, 40],
  enclosure: "IP40",
  supply_vdc: 24,
} as const;

export interface LEYConfig {
  size: string;
  lead: string;
  stroke_mm: number;
  mount?: string;
  motor?: string;
  motor_opt?: string;
  rod_end?: string;
  mounting?: string;
  cable?: string;
  ctrl?: string;
  io_cable?: string;
  ctrl_mount?: string;
  ctrl_acc?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

export function leyBuildCode(c: LEYConfig): string | null {
  const size = LEY_SIZES.find((s) => s.code === c.size);
  if (!size || !har(LEY_LEADS, c.lead)) return null;
  const mount = c.mount ?? "";
  if (mount && !har(LEY_MOUNTS, mount)) return null;
  const motor = c.motor ?? "";
  if (motor && (motor !== LEY_MOTOR.code || !size.servo_ok)) return null;
  const s = c.stroke_mm;
  if (!Number.isInteger(s) || s < size.stroke_range[0] || s > size.stroke_range[1]) return null;
  const opt = c.motor_opt ?? "";
  const mo = opt ? LEY_MOTOR_OPTIONS.find((x) => x.code === opt) : undefined;
  if (opt && !mo) return null;
  const rod = c.rod_end ?? "";
  if (rod && rod !== LEY_ROD_END.code) return null;
  const mounting = c.mounting ?? "";
  const mt = mounting ? LEY_MOUNTINGS.find((x) => x.code === mounting) : undefined;
  if (mounting && !mt) return null;
  if (mt) {
    if (mt.parallel_only && mount === "D") return null;
    if (mt.code === "G" && !size.head_flange_ok) return null;
    if (mt.code === "F" && mo?.lock && s === 30 && (size.size === 16 || size.size === 40)) return null;
    if (mt.code === "D" && s > size.clevis_max_mm) return null;
  }
  const cable = c.cable ?? "";
  const ctrl = c.ctrl ?? "";
  const io = c.io_cable ?? "";
  const cm = c.ctrl_mount ?? "";
  const acc = c.ctrl_acc ?? "";
  if (!leTailOk(motor, cable, ctrl, io, cm, acc)) return null;
  const svans = `${cable}${ctrl}${io}${cm}${acc}`;
  return `LEY${size.code}${mount}${motor}${c.lead}-${s}${opt}${rod}${mounting}${svans ? `-${svans}` : ""}`;
}

export function leyParseCode(raw: string): { config: LEYConfig } | null {
  const k = raw.trim().toUpperCase();
  const m = new RegExp(`^LEY(16|25|32|40)([RLD]?)(A?)([ABC])-(\\d{1,3})([CBW]?)(M?)([LFGD]?)(?:-${LE_TAIL_REGEX})?$`).exec(k);
  if (!m) return null;
  const [, size, mount, motor, lead, stroke, opt, rod, mounting, cable, ctrl, io, cm, acc] = m;
  const c: LEYConfig = {
    size, lead, stroke_mm: Number(stroke), mount: mount || undefined, motor: motor || undefined, motor_opt: opt || undefined, rod_end: rod || undefined,
    mounting: mounting || undefined, cable: cable || undefined, ctrl: ctrl || undefined, io_cable: io || undefined, ctrl_mount: cm || undefined, ctrl_acc: acc || undefined,
  };
  if (leyBuildCode(c) !== k) return null;
  return { config: c };
}

export const LEY_ORDER_CODE_TEMPLATE =
  "LEY{size}{mount}{motor}{lead}-{stroke_mm}{motor_opt}{rod_end}{mounting}-{cable}{ctrl}{io_cable}{ctrl_mount}{ctrl_acc}";

/**
 * Styrenheten i LE-seriens beställnycklar (LESH sida 716, LEY sida 460):
 * gemensamma värdelistor, giltighetskontroll och regler för JXC/LEC-delen
 * av koden. Aktuatorkabeln (standard/robot) delas också.
 *
 *   JXC:  C + gränssnitt (5/6/E/9/P/D/L/M) + 1 eller F (STO) + 7/8 + tillbehör
 *   LEC:  6N/6P (LECA6, servo) eller AN/AP (LECPA, steg) + I/O-kabel + D
 *
 * Mallpositionerna är {ctrl}{io_cable}{ctrl_mount}{ctrl_acc}: LEC:s I/O-kabel
 * står före monteringen, JXC:s I/O-kabel är ett tillbehör efter den.
 */
import type { DsbcDbRule } from "./dsbc-db-rules";

export interface LEValue {
  code: string;
  label_sv: string;
}

export interface LEController extends LEValue {
  family: "JXC" | "LEC";
  /** Motortyper styrenheten passar: "" steg (inkrementell), "A" servo, "E" batterilös absolut. */
  motors: string[];
  /** Tillbehör som får följa (JXC). */
  acc?: string[];
}
const jxc = (code: string, label: string, acc?: string[]): LEController => ({ code, family: "JXC", motors: ["", "E"], acc, label_sv: label });
export const LE_CONTROLLERS: LEController[] = [
  jxc("C51", "JXC51: parallell I/O NPN, stegdata", ["1", "3", "5"]),
  jxc("C61", "JXC61: parallell I/O PNP, stegdata", ["1", "3", "5"]),
  jxc("CE1", "JXCE1: EtherCAT"),
  jxc("CEF", "JXCEF: EtherCAT med STO"),
  jxc("C91", "JXC91: EtherNet/IP"),
  jxc("C9F", "JXC9F: EtherNet/IP med STO"),
  jxc("CP1", "JXCP1: PROFINET"),
  jxc("CPF", "JXCPF: PROFINET med STO"),
  jxc("CD1", "JXCD1: DeviceNet", ["S", "T"]),
  jxc("CL1", "JXCL1: IO-Link"),
  jxc("CLF", "JXCLF: IO-Link med STO"),
  jxc("CM1", "JXCM1: CC-Link", ["S", "T"]),
  { code: "6N", family: "LEC", motors: ["A"], label_sv: "LECA6 NPN: stegdata, för servomotorn" },
  { code: "6P", family: "LEC", motors: ["A"], label_sv: "LECA6 PNP: stegdata, för servomotorn" },
  { code: "AN", family: "LEC", motors: [""], label_sv: "LECPA NPN: pulsingång, för stegmotorn (inkrementell)" },
  { code: "AP", family: "LEC", motors: [""], label_sv: "LECPA PNP: pulsingång, för stegmotorn (inkrementell)" },
];
export const LE_IO_CABLES: LEValue[] = [
  { code: "1", label_sv: "I/O-kabel 1,5 m (LEC)" },
  { code: "3", label_sv: "I/O-kabel 3 m (LEC)" },
  { code: "5", label_sv: "I/O-kabel 5 m (LEC)" },
];
export const LE_CTRL_MOUNTS: LEValue[] = [
  { code: "7", label_sv: "Skruvmontering (JXC)" },
  { code: "8", label_sv: "DIN-skena (JXC; skenan beställs separat)" },
  { code: "D", label_sv: "DIN-skena (LEC; skenan beställs separat)" },
];
export const LE_CTRL_ACCS: LEValue[] = [
  { code: "S", label_sv: "Rak kommunikationsplugg (DeviceNet, CC-Link)" },
  { code: "T", label_sv: "T-grenad kommunikationsplugg (DeviceNet, CC-Link)" },
  { code: "1", label_sv: "I/O-kabel 1,5 m (JXC51/61)" },
  { code: "3", label_sv: "I/O-kabel 3 m (JXC51/61)" },
  { code: "5", label_sv: "I/O-kabel 5 m (JXC51/61)" },
];

export interface LECable extends LEValue {
  kind: "standard" | "robotic";
  /** Tillverkas på beställning. */
  on_order?: boolean;
}
export const LE_CABLES: LECable[] = [
  { code: "S1", kind: "standard", label_sv: "Standardkabel 1,5 m (bara stegmotor, fast förlagd)" },
  { code: "S3", kind: "standard", label_sv: "Standardkabel 3 m (bara stegmotor, fast förlagd)" },
  { code: "S5", kind: "standard", label_sv: "Standardkabel 5 m (bara stegmotor, fast förlagd)" },
  { code: "R1", kind: "robotic", label_sv: "Robotkabel 1,5 m" },
  { code: "R3", kind: "robotic", label_sv: "Robotkabel 3 m" },
  { code: "R5", kind: "robotic", label_sv: "Robotkabel 5 m" },
  { code: "R8", kind: "robotic", on_order: true, label_sv: "Robotkabel 8 m (på beställning)" },
  { code: "RA", kind: "robotic", on_order: true, label_sv: "Robotkabel 10 m (på beställning)" },
  { code: "RB", kind: "robotic", on_order: true, label_sv: "Robotkabel 15 m (på beställning)" },
  { code: "RC", kind: "robotic", on_order: true, label_sv: "Robotkabel 20 m (på beställning)" },
];

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

/** Kabel och styrenhet giltiga för motortypen; returnerar svansen efter aktuatorkoden eller null. */
export function leTailOk(motor: string, cable: string, ctrl: string, io: string, cm: string, acc: string): boolean {
  const kabel = cable ? LE_CABLES.find((k) => k.code === cable) : undefined;
  if (cable && !kabel) return false;
  if (kabel?.kind === "standard" && motor) return false;
  if (!ctrl) return !(io || cm || acc);
  const st = LE_CONTROLLERS.find((k) => k.code === ctrl);
  if (!st || !st.motors.includes(motor)) return false;
  if (st.family === "JXC") {
    if (io) return false;
    if (cm !== "7" && cm !== "8") return false;
    if (acc && !(st.acc ?? []).includes(acc)) return false;
    return true;
  }
  if (acc) return false;
  if (io && !har(LE_IO_CABLES, io)) return false;
  if (cm && cm !== "D") return false;
  return true;
}

/** Regex-biten för svansen: kabel + styrenhet (alla grupper valfria). */
export const LE_TAIL_REGEX = "(S[135]|R[1358ABC])?(?:(C[569EPDLM][1F]|6[NP]|A[NP])([135]?)([78D]?)([ST135]?))?";

export interface LEControllerRuleOpts {
  steg: (p: string) => string;
  /** Motortyper familjen har: "" steg, "A" servo, "E" absolut. */
  motors: string[];
  /** Sidhänvisning för styrenhet mot motortyp, t.ex. "706 och 716". */
  ctrlPages: string;
  /** Styrenhetssidan och dess noter. */
  page: number;
  notes: { belongs: number; acc: number; pulse: number; din: number; resistor: number };
  /** Sidan där batterilös absolut kräver JXC V3.4/S3.4 (utelämnas om motortypen inte finns). */
  absPage?: number;
  /** Kabelnoterna: sidan för "på beställning"/"fasta delar" och datasidan för 10 % per 5 m. */
  cable: { page: number; onOrder: number; fixed: number; dataPage: number; dataNote: number; stdOnly: { sv: string; en: string } };
}

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
export const LE_MOTORNAMN: Record<string, [string, string]> = {
  "": ["stegmotorn (inkrementell)", "the step motor (incremental)"],
  A: ["servomotorn", "the servo motor"],
  E: ["den batterilösa absoluta stegmotorn", "the battery-less absolute step motor"],
};

/** Kabel- och styrenhetsreglerna, gemensamma för LESH och LEY. */
export function leControllerRules(o: LEControllerRuleOpts): DsbcDbRule[] {
  const rows: DsbcDbRule[] = [];
  const { steg, page, notes } = o;
  const jxc = LE_CONTROLLERS.filter((c) => c.family === "JXC").map((c) => c.code);
  const lec = LE_CONTROLLERS.filter((c) => c.family === "LEC").map((c) => c.code);

  // ── kabeln ─────────────────────────────────────────────────────────────
  const standard = LE_CABLES.filter((k) => k.kind === "standard").map((k) => k.code);
  const c = o.cable;
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "cable" }, standard] }, { "!=": [{ var: "motor" }, ""] }] },
    message_sv: `Standardkabeln S1/S3/S5 finns bara för stegmotorn (inkrementell); ${o.motors.includes("E") ? "servomotorn och den absoluta stegmotorn beställs" : "servomotorn beställs"} med robotkabel R (${c.stdOnly.sv}).`,
    message_en: `The standard cable S1/S3/S5 exists only for the step motor (incremental); ${o.motors.includes("E") ? "the servo motor and the absolute step motor are ordered" : "the servo motor is ordered"} with the robotic cable R (${c.stdOnly.en}).`,
    goto_step: steg("cable"),
  });
  const paBestallning = LE_CABLES.filter((k) => k.on_order).map((k) => k.code);
  rows.push({
    severity: "warn",
    if_json: { in: [{ var: "cable" }, paBestallning] },
    message_sv: `Robotkabel ${paBestallning.join("/")} (8–20 m) tillverkas på beställning; över 5 m sjunker hastighet och kraft med upp till 10 % per 5 m (sida ${c.page}, not ${c.onOrder}, och ${c.dataPage}, not ${c.dataNote}).`,
    message_en: `Robotic cable ${paBestallning.join("/")} (8–20 m) is produced upon receipt of order; above 5 m speed and force drop by up to 10 % per 5 m (page ${c.page}, note ${c.onOrder}, and ${c.dataPage}, note ${c.dataNote}).`,
    goto_step: steg("cable"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "cable" }, standard] },
    message_sv: `Standardkabeln används bara på fasta delar; på rörliga delar väljs robotkabel (sida ${c.page}, not ${c.fixed}).`,
    message_en: `The standard cable is used only on fixed parts; on moving parts choose the robotic cable (page ${c.page}, note ${c.fixed}).`,
    goto_step: steg("cable"),
  });

  // ── styrenheten mot motortypen ─────────────────────────────────────────
  for (const motor of o.motors) {
    const fel = LE_CONTROLLERS.filter((k) => !k.motors.includes(motor)).map((k) => k.code);
    const ok = LE_CONTROLLERS.filter((k) => k.motors.includes(motor)).map((k) => k.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "motor" }, motor] }, { in: [{ var: "ctrl" }, fel] }] },
      message_sv: `Till ${LE_MOTORNAMN[motor][0]} passar styrenheterna ${lista(ok)}, inte ${lista(fel)} (sida ${o.ctrlPages}).`,
      message_en: `For ${LE_MOTORNAMN[motor][1]} the controllers ${lista(ok, "and")} fit, not ${lista(fel, "and")} (pages ${o.ctrlPages.replace(" och ", " and ")}).`,
      goto_step: steg("ctrl"),
    });
  }
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "ctrl" }, ""] }, { or: [{ "!=": [{ var: "io_cable" }, ""] }, { "!=": [{ var: "ctrl_mount" }, ""] }, { "!=": [{ var: "ctrl_acc" }, ""] }] }] },
    message_sv: `I/O-kabel, montering och tillbehör hör till styrenheten — välj en styrenhet först (sida ${page}, not ${notes.belongs}).`,
    message_en: `I/O cable, mounting and accessory belong to the controller — choose a controller first (page ${page}, note ${notes.belongs}).`,
    goto_step: steg("ctrl"),
  });

  // ── JXC: montering 7/8, tillbehör per gränssnitt, ingen I/O-kabel ─────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "ctrl" }, jxc] }, { not: { in: [{ var: "ctrl_mount" }, ["7", "8"]] } }] },
    message_sv: `JXC-styrenheten beställs med montering: 7 skruv eller 8 DIN-skena (sida ${page}).`,
    message_en: `The JXC controller is ordered with a mounting: 7 screw or 8 DIN rail (page ${page}).`,
    goto_step: steg("ctrl_mount"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "ctrl" }, jxc] }, { "!=": [{ var: "io_cable" }, ""] }] },
    message_sv: `JXC:s I/O-kabel skrivs som tillbehör 1/3/5 efter monteringen (bara JXC51/61); positionen I/O-kabel hör till LEC (sida ${page}).`,
    message_en: `The JXC I/O cable is written as the accessory 1/3/5 after the mounting (JXC51/61 only); the I/O cable position belongs to LEC (page ${page}).`,
    goto_step: steg("io_cable"),
  });
  const medAcc = new Map<string, string[]>();
  for (const k of LE_CONTROLLERS) if (k.family === "JXC") for (const a of LE_CTRL_ACCS.map((x) => x.code)) {
    if (!(k.acc ?? []).includes(a)) medAcc.set(a, [...(medAcc.get(a) ?? []), k.code]);
  }
  for (const [a, ctrls] of medAcc) {
    const ok = LE_CONTROLLERS.filter((k) => (k.acc ?? []).includes(a)).map((k) => k.code);
    rows.push({
      severity: "error",
      if_json: { and: [{ in: [{ var: "ctrl" }, ctrls] }, { "==": [{ var: "ctrl_acc" }, a] }] },
      message_sv: `Tillbehöret ${a} finns för ${lista(ok)}, inte för ${lista(ctrls)} (sida ${page}, not ${notes.acc}).`,
      message_en: `The accessory ${a} exists for ${lista(ok, "and")}, not for ${lista(ctrls, "and")} (page ${page}, note ${notes.acc}).`,
      goto_step: steg("ctrl_acc"),
    });
  }

  // ── LEC: montering D, I/O-kabel, inget JXC-tillbehör ──────────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "ctrl" }, lec] }, { in: [{ var: "ctrl_mount" }, ["7", "8"]] }] },
    message_sv: `LEC-styrenheten monteras med skruv (ingen bokstav) eller på DIN-skena D; 7/8 hör till JXC (sida ${page}).`,
    message_en: `The LEC controller is mounted with screws (no letter) or on a DIN rail D; 7/8 belong to JXC (page ${page}).`,
    goto_step: steg("ctrl_mount"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "ctrl" }, lec] }, { "!=": [{ var: "ctrl_acc" }, ""] }] },
    message_sv: `Kommunikationsplugg och JXC-tillbehör finns inte för LEC; LEC:s I/O-kabel väljs i positionen I/O-kabel (sida ${page}).`,
    message_en: `Communication plug and JXC accessories do not exist for LEC; the LEC I/O cable is chosen in the I/O cable position (page ${page}).`,
    goto_step: steg("ctrl_acc"),
  });
  rows.push({
    severity: "warn",
    if_json: { and: [{ in: [{ var: "ctrl" }, ["AN", "AP"]] }, { in: [{ var: "io_cable" }, ["3", "5"]] }] },
    message_sv: `LECPA (pulsingång): 3 och 5 m I/O-kabel bara med differentiella pulssignaler; öppen kollektor bara 1,5 m (sida ${page}, not ${notes.pulse}).`,
    message_en: `LECPA (pulse input): 3 and 5 m I/O cable only with differential pulse signals; open collector only 1.5 m (page ${page}, note ${notes.pulse}).`,
    goto_step: steg("io_cable"),
  });
  rows.push({
    severity: "warn",
    if_json: { in: [{ var: "ctrl_mount" }, ["8", "D"]] },
    message_sv: `DIN-skenan ingår inte — den beställs separat (sida ${page}, not ${notes.din}).`,
    message_en: `The DIN rail is not included — it is ordered separately (page ${page}, note ${notes.din}).`,
    goto_step: steg("ctrl_mount"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "ctrl" }, ["AN", "AP"]] },
    message_sv: `LECPA med öppen kollektor kräver strömbegränsningsmotståndet LEC-PA-R-□, som beställs separat (sida ${page}, not ${notes.resistor}).`,
    message_en: `LECPA with open collector needs the current limiting resistor LEC-PA-R-□, ordered separately (page ${page}, note ${notes.resistor}).`,
    goto_step: steg("ctrl"),
  });
  if (o.absPage) {
    rows.push({
      severity: "info",
      if_json: { and: [{ "==": [{ var: "motor" }, "E"] }, { in: [{ var: "ctrl" }, jxc] }] },
      message_sv: `Batterilös absolut kräver JXC med programversion V3.4/S3.4 eller senare (sida ${o.absPage}).`,
      message_en: `Battery-less absolute needs a JXC controller with firmware V3.4/S3.4 or later (page ${o.absPage}).`,
      goto_step: steg("ctrl"),
    });
  }
  return rows;
}

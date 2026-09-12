/**
 * Festo EPCO — elcylinder med kulskruv och stegmotor.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Festo, "Electric cylinders EPCO, with spindle drive", utgåva 2022/07.
 *   Ligger i knowledge_chunks som source_file = 'festo-EPCO-203027.pdf'.
 *     - typkod                    sida 7-8   (chunk 13-15)
 *     - tekniska data             sida 8-9
 *     - beställdata, 28 artiklar  sida 25
 *     - modulärt system           sida 26-27
 *
 * DOKUMENTET VAR INTE BORTA, DET VAR BARA AVPUBLICERAT. Festo har tagit EPCO
 * ur sortimentet -- deras sökning ger noll produktinformation -- men
 * dokumentnumren löper i bokstavsordning inom en grupp: EPCE är 203026 och
 * EPCS är 203028, alltså måste EPCO vara 203027. Filen låg kvar på servern.
 *
 * SEXTON POSITIONER, modulär typkod av samma slag som DSBC:s och EGC-FA:s --
 * ovalda positioner utelämnas helt:
 *
 *   EPCO - 16 - 50 - 3P - ST - E
 *   └─┬┘   └┬┘  └┬┘  └┬┘  └┬┘  │
 *  serie  storlek slag stigning motor  mätsystem
 *
 * DET STARKASTE FACIT VI HAFT SEDAN KPZ: katalogen trycker 28 FÄRDIGA
 * artikelnummer med sina typkoder bredvid ("50 1476415 EPCO-16-50-3P-ST-E").
 * Modellen behöver alltså inte bara följa nyckeln -- den ska reproducera
 * tjugoåtta koder som Festo själv har skrivit ut. Se `EPCO_ARTICLES`.
 *
 * TVÅ OBEROENDE FYSIKALISKA KRYSS. Tekniska data ger matningskraft och
 * hastighet per storlek OCH stigning. Eftersom det är samma motor i båda
 * varianterna av en storlek måste
 *   kraft x stigning  vara ungefär konstant (det är motorns moment), och
 *   hastighet / stigning  vara ungefär konstant (det är dess varvtal).
 * För storlek 25 stämmer båda på decimalen: 350x3 = 105x10 = 1050, och
 * 150/3 = 500/10 = 50. För 16 och 40 inom sex procent. En felläst siffra i
 * någon av de sex kolumnerna skulle synas direkt.
 *
 * VÅR PRODUKTRAD FESTO-1476415 ÄR ETT RIKTIGT ARTIKELNUMMER -- katalogen
 * parar det med EPCO-16-50-3P-ST-E. Den heter bara "Electric drive" i
 * databasen, utan typkod och utan en enda specifikation ur katalogen.
 */

export const EPCO_SOURCE = {
  file: "festo-EPCO-203027.pdf",
  edition: "2022/07",
  title: "Festo Electric cylinders EPCO, with spindle drive",
  brand: "Festo",
} as const;

export const EPCO_SERIES = "EPCO";

export interface EpcoValue {
  code: string;
  label_sv: string;
}

// ── Position 002: storlek ───────────────────────────────────────────────────

export interface EpcoSize {
  size: number;
  /** Position 003. Katalogen listar DISKRETA slag, inte ett intervall. */
  strokes: number[];
  /** Position 004. Stigningarna är storleksberoende. */
  pitches: string[];
  /** Position 006. Kolvstångsförlängningens tak, mm. */
  extension_max_mm: number;
  rod_thread_male: string;
  rod_thread_female: string;
  /** Största vridvinkel på kolvstången, grader. */
  max_rotation_deg: number;
  /** Stötenergi i ändlägena, joule. */
  impact_energy_j: number;
}

/**
 * De tre storlekarna.
 *
 * KORSKONTROLL: slaglistan här är avskriven ur den modulära beställtabellen
 * (sida 26), och dess ytterpunkter ska stämma med raden "Working stroke" i
 * tekniska data på sida 8 -- 50…200, 50…300 och 50…400 mm. Två tabeller,
 * samma gränser.
 */
export const EPCO_SIZES: EpcoSize[] = [
  {
    size: 16,
    strokes: [50, 75, 100, 125, 150, 175, 200],
    pitches: ["3P", "8P"],
    extension_max_mm: 100,
    rod_thread_male: "M6", rod_thread_female: "M4",
    max_rotation_deg: 2, impact_energy_j: 0.1e-3,
  },
  {
    size: 25,
    strokes: [50, 75, 100, 125, 150, 175, 200, 250, 300],
    pitches: ["3P", "10P"],
    extension_max_mm: 150,
    rod_thread_male: "M8", rod_thread_female: "M6",
    max_rotation_deg: 1.5, impact_energy_j: 0.2e-3,
  },
  {
    size: 40,
    strokes: [50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400],
    pitches: ["5P", "12.7P"],
    extension_max_mm: 200,
    rod_thread_male: "M10x1.25", rod_thread_female: "M8",
    max_rotation_deg: 1, impact_energy_j: 0.4e-3,
  },
];

// ── Position 004: skruvstigning ─────────────────────────────────────────────

export interface EpcoSpindle {
  /** Koden, stigningen i mm följd av P. */
  code: string;
  size: number;
  pitch_mm: number;
  spindle_diameter_mm: number;
  payload_horizontal_kg: number;
  payload_vertical_kg: number;
  /** Största matningskraft Fx, newton. */
  feed_force_n: number;
  /** Största hastighet, mm/s. */
  speed_max_mms: number;
}

/**
 * Skruvarna, en rad per storlek och stigning (sida 8).
 *
 * Det är den här tabellen de två fysikaliska kryssen prövar. Se filens huvud.
 */
export const EPCO_SPINDLES: EpcoSpindle[] = [
  { code: "3P", size: 16, pitch_mm: 3, spindle_diameter_mm: 8, payload_horizontal_kg: 24, payload_vertical_kg: 12, feed_force_n: 125, speed_max_mms: 125 },
  { code: "8P", size: 16, pitch_mm: 8, spindle_diameter_mm: 8, payload_horizontal_kg: 8, payload_vertical_kg: 4, feed_force_n: 50, speed_max_mms: 300 },
  { code: "3P", size: 25, pitch_mm: 3, spindle_diameter_mm: 10, payload_horizontal_kg: 60, payload_vertical_kg: 30, feed_force_n: 350, speed_max_mms: 150 },
  { code: "10P", size: 25, pitch_mm: 10, spindle_diameter_mm: 10, payload_horizontal_kg: 20, payload_vertical_kg: 10, feed_force_n: 105, speed_max_mms: 500 },
  { code: "5P", size: 40, pitch_mm: 5, spindle_diameter_mm: 12, payload_horizontal_kg: 120, payload_vertical_kg: 60, feed_force_n: 650, speed_max_mms: 180 },
  { code: "12.7P", size: 40, pitch_mm: 12.7, spindle_diameter_mm: 12.7, payload_horizontal_kg: 40, payload_vertical_kg: 20, feed_force_n: 250, speed_max_mms: 460 },
];

// ── Positionerna 005-016 ────────────────────────────────────────────────────

/** Position 005. Tom kod = hangänga. */
export const EPCO_ROD_THREADS: EpcoValue[] = [
  { code: "", label_sv: "Hangängad kolvstång" },
  { code: "F", label_sv: "Hongängad kolvstång" },
];

/** Position 007. */
export const EPCO_POSITION_SENSING: EpcoValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "A", label_sv: "För givare" },
];

/** Position 008. Katalogen listar en motortyp. */
export const EPCO_MOTOR = "ST";

/** Position 009. */
export const EPCO_MEASURING: EpcoValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "E", label_sv: "Pulsgivare" },
];

/** Position 010. */
export const EPCO_BRAKES: EpcoValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "B", label_sv: "Med broms" },
];

/** Position 011. */
export const EPCO_CABLE_DIRECTIONS: EpcoValue[] = [
  { code: "", label_sv: "Uppåt (standard)" },
  { code: "D", label_sv: "Nedåt" },
  { code: "L", label_sv: "Vänster" },
  { code: "R", label_sv: "Höger" },
];

/** Position 012. */
export const EPCO_GUIDE_UNITS: EpcoValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "KF", label_sv: "Kullagrad styrning med två styrstänger" },
];

/** Position 013. Kabel till motorstyrningen. */
export const EPCO_CABLES: EpcoValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "1.5E", label_sv: "1,5 m, rak kontakt" },
  { code: "1.5EA", label_sv: "1,5 m, vinklad kontakt" },
  { code: "2.5E", label_sv: "2,5 m, rak kontakt" },
  { code: "2.5EA", label_sv: "2,5 m, vinklad kontakt" },
  { code: "5E", label_sv: "5 m, rak kontakt" },
  { code: "5EA", label_sv: "5 m, vinklad kontakt" },
  { code: "7E", label_sv: "7 m, rak kontakt" },
  { code: "7EA", label_sv: "7 m, vinklad kontakt" },
  { code: "10E", label_sv: "10 m, rak kontakt" },
  { code: "10EA", label_sv: "10 m, vinklad kontakt" },
];

/** Position 014. */
export const EPCO_CONTROLLERS: EpcoValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "C5", label_sv: "CMMO, 5 A" },
];

/** Position 015. */
export const EPCO_BUS: EpcoValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "DIO", label_sv: "Digitalt I/O-gränssnitt" },
  { code: "LK", label_sv: "IO-Link" },
];

/** Position 016. */
export const EPCO_SWITCHING: EpcoValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "P", label_sv: "PNP" },
  { code: "N", label_sv: "NPN" },
];

/** Gemensamma data ur sida 8-9. */
export const EPCO_LIMITS = {
  max_acceleration_ms2: 10,
  reversing_backlash_mm: 0.1,
  repetition_accuracy_mm: 0.02,
  stroke_reserve_mm: 0,
  nominal_voltage_v: 24,
} as const;

// ── Katalogens villkor ──────────────────────────────────────────────────────

/**
 * Fotnoterna på sida 26-27, avskrivna.
 *
 * De är inte pynt: [1] gör positionsavkänning OBLIGATORISK när pulsgivare
 * saknas, och [4] gör bussprotokoll obligatoriskt när styrningen är med. En
 * kod som bryter mot dem går inte att beställa.
 */
export const EPCO_CONDITIONS = {
  /** [1] A måste väljas om pulsgivare E inte är vald. */
  sensing_required_without_encoder: true,
  /** [2] KF går inte ihop med kolvstångsförlängning ...E. */
  guide_excludes_extension: true,
  /** [3] Kablar och C5 finns bara med pulsgivare E. */
  cable_and_controller_need_encoder: true,
  /** [4] DIO, LK, N och P måste väljas om styrningen C5 är vald. */
  bus_required_with_controller: true,
  /** [5] N går inte ihop med IO-Link LK. */
  npn_excludes_iolink: true,
} as const;

// ── Färdiga artiklar ────────────────────────────────────────────────────────

export interface EpcoArticle {
  /** Festos artikelnummer. */
  part_no: string;
  size: number;
  stroke_mm: number;
  pitch: string;
  /** Typkoden som katalogen trycker bredvid artikelnumret. */
  type_code: string;
}

/**
 * De 28 artiklarna på sida 25, avskrivna med sina typkoder.
 *
 * Alla är "with encoder", alltså mätsystem E och ingen positionsavkänning --
 * vilket stämmer med villkor [1]: A krävs bara NÄR pulsgivare saknas.
 */
export const EPCO_ARTICLES: EpcoArticle[] = [
  { part_no: "1476415", size: 16, stroke_mm: 50, pitch: "3P", type_code: "EPCO-16-50-3P-ST-E" },
  { part_no: "1476417", size: 16, stroke_mm: 100, pitch: "3P", type_code: "EPCO-16-100-3P-ST-E" },
  { part_no: "1476419", size: 16, stroke_mm: 150, pitch: "3P", type_code: "EPCO-16-150-3P-ST-E" },
  { part_no: "1476421", size: 16, stroke_mm: 200, pitch: "3P", type_code: "EPCO-16-200-3P-ST-E" },
  { part_no: "1476522", size: 16, stroke_mm: 50, pitch: "8P", type_code: "EPCO-16-50-8P-ST-E" },
  { part_no: "1476524", size: 16, stroke_mm: 100, pitch: "8P", type_code: "EPCO-16-100-8P-ST-E" },
  { part_no: "1476526", size: 16, stroke_mm: 150, pitch: "8P", type_code: "EPCO-16-150-8P-ST-E" },
  { part_no: "1476528", size: 16, stroke_mm: 200, pitch: "8P", type_code: "EPCO-16-200-8P-ST-E" },
  { part_no: "1470698", size: 25, stroke_mm: 50, pitch: "3P", type_code: "EPCO-25-50-3P-ST-E" },
  { part_no: "1470700", size: 25, stroke_mm: 100, pitch: "3P", type_code: "EPCO-25-100-3P-ST-E" },
  { part_no: "1470702", size: 25, stroke_mm: 150, pitch: "3P", type_code: "EPCO-25-150-3P-ST-E" },
  { part_no: "1470704", size: 25, stroke_mm: 200, pitch: "3P", type_code: "EPCO-25-200-3P-ST-E" },
  { part_no: "1470706", size: 25, stroke_mm: 300, pitch: "3P", type_code: "EPCO-25-300-3P-ST-E" },
  { part_no: "1470769", size: 25, stroke_mm: 50, pitch: "10P", type_code: "EPCO-25-50-10P-ST-E" },
  { part_no: "1470771", size: 25, stroke_mm: 100, pitch: "10P", type_code: "EPCO-25-100-10P-ST-E" },
  { part_no: "1470773", size: 25, stroke_mm: 150, pitch: "10P", type_code: "EPCO-25-150-10P-ST-E" },
  { part_no: "1470775", size: 25, stroke_mm: 200, pitch: "10P", type_code: "EPCO-25-200-10P-ST-E" },
  { part_no: "1470777", size: 25, stroke_mm: 300, pitch: "10P", type_code: "EPCO-25-300-10P-ST-E" },
  { part_no: "1472501", size: 40, stroke_mm: 50, pitch: "5P", type_code: "EPCO-40-50-5P-ST-E" },
  { part_no: "1472503", size: 40, stroke_mm: 100, pitch: "5P", type_code: "EPCO-40-100-5P-ST-E" },
  { part_no: "1472505", size: 40, stroke_mm: 150, pitch: "5P", type_code: "EPCO-40-150-5P-ST-E" },
  { part_no: "1472507", size: 40, stroke_mm: 200, pitch: "5P", type_code: "EPCO-40-200-5P-ST-E" },
  { part_no: "1472509", size: 40, stroke_mm: 300, pitch: "5P", type_code: "EPCO-40-300-5P-ST-E" },
  { part_no: "1472617", size: 40, stroke_mm: 50, pitch: "12.7P", type_code: "EPCO-40-50-12.7P-ST-E" },
  { part_no: "1472619", size: 40, stroke_mm: 100, pitch: "12.7P", type_code: "EPCO-40-100-12.7P-ST-E" },
  { part_no: "1472621", size: 40, stroke_mm: 150, pitch: "12.7P", type_code: "EPCO-40-150-12.7P-ST-E" },
  { part_no: "1472623", size: 40, stroke_mm: 200, pitch: "12.7P", type_code: "EPCO-40-200-12.7P-ST-E" },
  { part_no: "1472625", size: 40, stroke_mm: 300, pitch: "12.7P", type_code: "EPCO-40-300-12.7P-ST-E" },
];

/** Festos modulnummer per storlek (sida 26). */
export const EPCO_MODULE_NO: Record<number, string> = {
  16: "1476585", 25: "1470874", 40: "1472887",
};

// ── Bygg och läs ────────────────────────────────────────────────────────────

export interface EpcoConfig {
  size: number;
  stroke_mm: number;
  pitch: string;
  rod_thread?: string;
  /** Kolvstångsförlängning i mm. 0 eller utelämnad = ingen. */
  extension_mm?: number;
  position_sensing?: string;
  measuring?: string;
  brake?: string;
  cable_direction?: string;
  guide_unit?: string;
  cable?: string;
  controller?: string;
  bus?: string;
  switching?: string;
}

function finns(lista: EpcoValue[], kod: string): boolean {
  return lista.some((x) => x.code === kod);
}

/**
 * Bygger en EPCO-typkod. Null när något inte är beställbart.
 *
 * Ovalda positioner utelämnas helt -- samma konvention som DSBC och EGC-FA --
 * så koden får aldrig ett tomt segment eller dubbla bindestreck.
 */
export function epcoBuildCode(c: EpcoConfig): string | null {
  const s = EPCO_SIZES.find((x) => x.size === c.size);
  if (!s) return null;
  if (!s.strokes.includes(c.stroke_mm)) return null;
  if (!s.pitches.includes(c.pitch)) return null;

  const thread = c.rod_thread ?? "";
  const sensing = c.position_sensing ?? "";
  const measuring = c.measuring ?? "";
  const brake = c.brake ?? "";
  const dir = c.cable_direction ?? "";
  const guide = c.guide_unit ?? "";
  const cable = c.cable ?? "";
  const ctrl = c.controller ?? "";
  const bus = c.bus ?? "";
  const sw = c.switching ?? "";

  if (!finns(EPCO_ROD_THREADS, thread)) return null;
  if (!finns(EPCO_POSITION_SENSING, sensing)) return null;
  if (!finns(EPCO_MEASURING, measuring)) return null;
  if (!finns(EPCO_BRAKES, brake)) return null;
  if (!finns(EPCO_CABLE_DIRECTIONS, dir)) return null;
  if (!finns(EPCO_GUIDE_UNITS, guide)) return null;
  if (!finns(EPCO_CABLES, cable)) return null;
  if (!finns(EPCO_CONTROLLERS, ctrl)) return null;
  if (!finns(EPCO_BUS, bus)) return null;
  if (!finns(EPCO_SWITCHING, sw)) return null;

  const ext = c.extension_mm ?? 0;
  if (!Number.isInteger(ext) || ext < 0 || ext > s.extension_max_mm) return null;

  // Katalogens villkor, i tur och ordning.
  if (sensing === "" && measuring === "") return null;              // [1]
  if (guide === "KF" && ext > 0) return null;                        // [2]
  if ((cable !== "" || ctrl !== "") && measuring !== "E") return null; // [3]
  if (ctrl === "C5" && bus === "") return null;                      // [4]
  if (ctrl === "C5" && sw === "") return null;                       // [4]
  if (sw === "N" && bus === "LK") return null;                       // [5]

  const segment = [
    EPCO_SERIES, String(c.size), String(c.stroke_mm), c.pitch,
    thread, ext > 0 ? `${ext}E` : "", sensing, EPCO_MOTOR, measuring,
    brake, dir, guide, cable, ctrl, bus, sw,
  ];
  return segment.filter((x) => x !== "").join("-");
}

export interface EpcoReading {
  size: number;
  stroke_mm: number;
  pitch: string;
  pitch_mm: number;
  /** Segment efter motorkoden ST som inte tolkats. */
  segments: string[];
  has_encoder: boolean;
}

/**
 * Läser en EPCO-typkod.
 *
 * De fyra obligatoriska positionerna tolkas; resten returneras som segment.
 * Att tolka dem alla vore möjligt men skulle kräva en ordningsberoende
 * tolkning av tomma positioner, och koderna är inte entydiga var för sig --
 * "E" är både mätsystem och slutet på en förlängning.
 */
export function epcoParseCode(raw: string): EpcoReading | null {
  const delar = raw.trim().toUpperCase().split("-");
  if (delar.length < 5) return null;
  if (delar[0] !== EPCO_SERIES) return null;

  const size = Number(delar[1]);
  const s = EPCO_SIZES.find((x) => x.size === size);
  if (!s) return null;

  const stroke_mm = Number(delar[2]);
  if (!s.strokes.includes(stroke_mm)) return null;

  const pitch = delar[3];
  if (!s.pitches.includes(pitch)) return null;
  const sp = EPCO_SPINDLES.find((x) => x.size === size && x.code === pitch);
  if (!sp) return null;

  const resten = delar.slice(4);
  if (!resten.includes(EPCO_MOTOR)) return null;
  const efterMotor = resten.slice(resten.indexOf(EPCO_MOTOR) + 1);

  return {
    size, stroke_mm, pitch, pitch_mm: sp.pitch_mm,
    segments: efterMotor,
    has_encoder: efterMotor.includes("E"),
  };
}

/** Slår upp en artikel på Festos artikelnummer. */
export function epcoByPartNo(partNo: string): EpcoArticle | null {
  const n = partNo.trim().replace(/^FESTO-/i, "");
  return EPCO_ARTICLES.find((a) => a.part_no === n) ?? null;
}

/** Skruvdata för en storlek och stigning. */
export function epcoSpindle(size: number, pitch: string): EpcoSpindle | null {
  return EPCO_SPINDLES.find((x) => x.size === size && x.code === pitch) ?? null;
}

/**
 * Motorns moment, uttryckt som kraft gånger stigning.
 *
 * Finns för korskontrollen: samma storlek har samma motor, så produkten ska
 * vara ungefär lika för båda stigningarna. Det är inte ett katalogvärde utan
 * en härledd storhet, och den heter därför inte "moment" utåt.
 */
export function epcoForcePitchProduct(sp: EpcoSpindle): number {
  return sp.feed_force_n * sp.pitch_mm;
}

/** Motorns varvtal, uttryckt som hastighet delad med stigning, varv/s. */
export function epcoSpeedPitchRatio(sp: EpcoSpindle): number {
  return sp.speed_max_mms / sp.pitch_mm;
}

export const EPCO_ORDER_CODE_TEMPLATE =
  "EPCO-{size}-{stroke_mm}-{pitch}-{rod_thread}-{extension_mm:E}-{position_sensing}-ST-" +
  "{measuring}-{brake}-{cable_direction}-{guide_unit}-{cable}-{controller}-{bus}-{switching}";

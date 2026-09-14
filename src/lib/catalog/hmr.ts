/**
 * Parker HMR — ORIGA linjärdrivning, kulskruv eller kuggrem.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Parker Hannifin, "Electric Linear Actuator – HMR Series", katalog
 *   P-A4P024GB. Ligger i knowledge_chunks som
 *   source_file = 'parker-HMR-PA4P024GB.pdf'.
 *     - HMRS (kulskruv) beställnyckel   sida 20-21
 *     - HMRB (kuggrem)  beställnyckel   sida 30-31
 *
 * DOKUMENTET SAKNADES VERKLIGEN. Till skillnad från ELEKTRO och CCIV, som
 * bara var felsökta, hade HMR ingen källa alls i databasen -- bara
 * `parker-electromechanical.pdf`, en översiktsbroschyr där ordet "ordering"
 * inte förekommer en enda gång. Rätt katalog hämtades 2026-09-12.
 *
 * TVÅ VARIANTER MED SAMMA FORM, olika femte position:
 *
 *   HMR S 15 B 05 0 - 0000 - 0 0 0 0 0 00 00   kulskruv: stigning
 *   HMR B 15 B BD 0 - 0000 - 0 0 0 0 0 00 00   kuggrem: motorns monteringsläge
 *
 * Koden skrivs ihop utan mellanslag och med två bindestreck:
 * `HMRS11C160-0500-000000000`. Den formen är bekräftad oberoende av en
 * distributörslistning, inte bara av mallen.
 *
 * VAD KATALOGEN INTE SÄGER. Svansen har fem ensiffriga positioner och två
 * tvåställiga. Pilarna i beställnyckeln pekar ut de TRE FÖRSTA ensiffriga och
 * BÅDA de tvåställiga -- den fjärde och femte ensiffriga positionen har
 * varken pil eller förklaringsruta. De sätts därför till "0", vilket är vad
 * katalogens eget exempel gör.
 *
 * Det är samma gränsdragning som OSP-P fick, och av samma skäl: att gissa
 * vilken option som sitter var vore precis det fel P1D:s position 10 redan
 * gjort en gång i det här projektet.
 */

export const HMR_SOURCE = {
  file: "parker-HMR-PA4P024GB.pdf",
  edition: "P-A4P024GB",
  title: "Parker ORIGA Electric Linear Actuator, HMR Series",
  brand: "Parker",
} as const;

export const HMR_SERIES = "HMR";

export interface HmrValue {
  code: string;
  label_sv: string;
}

/** Position 2: drivningens typ. Den avgör hela resten av nyckeln. */
export const HMR_DRIVE_TYPES: HmrValue[] = [
  { code: "S", label_sv: "Kulskruv" },
  { code: "B", label_sv: "Kuggrem" },
];

/** Position 3: produktstorlek, angiven som profilens bredd. */
export const HMR_SIZES: Array<HmrValue & { width_mm: number }> = [
  { code: "08", width_mm: 85, label_sv: "Profilbredd 85 mm" },
  { code: "11", width_mm: 110, label_sv: "Profilbredd 110 mm" },
  { code: "15", width_mm: 150, label_sv: "Profilbredd 150 mm" },
  { code: "18", width_mm: 180, label_sv: "Profilbredd 180 mm" },
  { code: "24", width_mm: 240, label_sv: "Profilbredd 240 mm" },
];

/** Position 4: profilutförande. Samma fyra för båda drivningarna. */
export const HMR_DESIGNS: Array<HmrValue & { reinforced: boolean; ip54: boolean }> = [
  { code: "B", reinforced: false, ip54: false, label_sv: "Basprofil med kullagrad styrning" },
  { code: "C", reinforced: false, ip54: true, label_sv: "Basprofil med kullagrad styrning och IP54-kåpa" },
  { code: "R", reinforced: true, ip54: false, label_sv: "Förstärkt profil med kullagrad styrning" },
  { code: "S", reinforced: true, ip54: true, label_sv: "Förstärkt profil med kullagrad styrning och IP54-kåpa" },
];

/**
 * Position 5 för KULSKRUV: stigningen, och den är STORLEKSBEROENDE.
 *
 * Varje storlek har exakt två stigningar, och de överlappar inte mellan
 * storlekarna utom för 05 (som finns på 08, 11 och 15) och 10 (18 och 24).
 * Tabellen på sida 20 är en kryssmatris, avskriven rad för rad.
 */
export const HMR_PITCHES: Array<HmrValue & { pitch_mm: number; sizes: string[] }> = [
  { code: "05", pitch_mm: 5, sizes: ["08", "11", "15"], label_sv: "Stigning 5 mm" },
  { code: "10", pitch_mm: 10, sizes: ["18", "24"], label_sv: "Stigning 10 mm" },
  { code: "12", pitch_mm: 12, sizes: ["08"], label_sv: "Stigning 12 mm" },
  { code: "16", pitch_mm: 16, sizes: ["11"], label_sv: "Stigning 16 mm" },
  { code: "20", pitch_mm: 20, sizes: ["15"], label_sv: "Stigning 20 mm" },
  { code: "25", pitch_mm: 25, sizes: ["18"], label_sv: "Stigning 25 mm" },
  { code: "32", pitch_mm: 32, sizes: ["24"], label_sv: "Stigning 32 mm" },
];

/**
 * Position 5 för KUGGREM: motorns monteringsläge och drivaxelns utförande.
 *
 * Två tecken, till skillnad från kulskruvens tvåsiffriga stigning -- samma
 * bredd, annan betydelse.
 */
export const HMR_BELT_MOUNTS: HmrValue[] = [
  { code: "BD", label_sv: "090° fram, dubbel slätaxel" },
  { code: "DD", label_sv: "270° bak, dubbel slätaxel" },
  { code: "AP", label_sv: "000° upp, enkel slätaxel" },
  { code: "CP", label_sv: "180° ner, enkel slätaxel" },
  { code: "AD", label_sv: "000° upp, dubbel slätaxel" },
  { code: "CD", label_sv: "180° ner, dubbel slätaxel" },
];

/**
 * Position 6: vagnen.
 *
 * KULSKRUVEN HAR TVÅ ALTERNATIV, KUGGREMMEN TRE. Delad vagn ("bi-part")
 * finns bara på remdriften, eftersom en skruv inte kan driva två vagnar åt
 * olika håll.
 */
export const HMR_CARRIAGES: Array<HmrValue & { drives: string[] }> = [
  { code: "0", drives: ["S", "B"], label_sv: "Standard" },
  { code: "1", drives: ["S", "B"], label_sv: "Tandem" },
  { code: "2", drives: ["B"], label_sv: "Delad vagn" },
];

/** Positionerna 10 och 11: givare. Samma lista i båda varianterna. */
export const HMR_HOME_SENSORS: HmrValue[] = [
  { code: "0", label_sv: "Utan" },
  { code: "1", label_sv: "Reed, 2-ledare, NO, intern" },
  { code: "A", label_sv: "PNP, 3-ledare, NO, intern" },
  { code: "K", label_sv: "NPN, 3-ledare, NO, intern" },
  { code: "3", label_sv: "Reed, NO, M8-kontakt, 0,3 m kabel" },
  { code: "C", label_sv: "PNP, NO, M8-kontakt, 0,3 m kabel" },
  { code: "M", label_sv: "NPN, NO, M8-kontakt, 0,3 m kabel" },
  { code: "5", label_sv: "Reed, NO, fria ledare, 3 m kabel" },
  { code: "E", label_sv: "PNP, NO, fria ledare, 3 m kabel" },
  { code: "P", label_sv: "NPN, NO, fria ledare, 3 m kabel" },
  { code: "7", label_sv: "Reed, NO, fria ledare, 10 m kabel" },
  { code: "G", label_sv: "PNP, NO, fria ledare, 10 m kabel" },
  { code: "R", label_sv: "NPN, NO, fria ledare, 10 m kabel" },
];

export const HMR_LIMIT_SENSORS: HmrValue[] = [
  { code: "0", label_sv: "Utan" },
  { code: "2", label_sv: "Reed, 2-ledare, NC, intern" },
  { code: "B", label_sv: "PNP, 3-ledare, NC, intern" },
  { code: "L", label_sv: "NPN, 3-ledare, NC, intern" },
  { code: "4", label_sv: "Reed, NC, M8-kontakt, 0,3 m kabel" },
  { code: "D", label_sv: "PNP, NC, M8-kontakt, 0,3 m kabel" },
  { code: "N", label_sv: "NPN, NC, M8-kontakt, 0,3 m kabel" },
  { code: "6", label_sv: "Reed, NC, fria ledare, 3 m kabel" },
  { code: "F", label_sv: "PNP, NC, fria ledare, 3 m kabel" },
  { code: "Q", label_sv: "NPN, NC, fria ledare, 3 m kabel" },
  { code: "8", label_sv: "Reed, NC, fria ledare, 10 m kabel" },
  { code: "H", label_sv: "PNP, NC, fria ledare, 10 m kabel" },
  { code: "S", label_sv: "NPN, NC, fria ledare, 10 m kabel" },
];

/**
 * Position 12: gränslägesgivarens monteringsläge, 0-200 mm i steg om tio.
 *
 * HÄRLEDD UR PILEN, inte utskriven. Beställnyckelns tredje ensiffriga pil
 * pekar nedåt över uppslaget, och på högersidan finns exakt EN oanvänd
 * förklaringsruta -- "Mounting position limit sensor". Det är den enda
 * kandidaten, och mappningen är därför en avläsning snarare än en gissning.
 * Skulle det visa sig fel är förvalet "0" ändå det katalogens exempel har.
 */
export const HMR_SENSOR_POSITIONS: HmrValue[] = [
  { code: "0", label_sv: "Utan givare" },
  ...Array.from({ length: 9 }, (_, i) => ({
    code: String(i + 1), label_sv: `${(i + 1) * 10} mm`,
  })),
  ..."ABCDEFGHJKL".split("").map((c, i) => ({
    code: c, label_sv: `${100 + i * 10} mm`,
  })),
];

/**
 * Position 15: monteringssats. Storleksberoende.
 *
 * "Mounting kit: contains gear housing, motor coupling and flange."
 */
export const HMR_MOUNTING_KITS: Array<HmrValue & { sizes: string[] }> = [
  { code: "00", sizes: ["08", "11", "15", "18", "24"], label_sv: "Utan monteringssats" },
  { code: "A7", sizes: ["15", "18"], label_sv: "Växel PS60" },
  { code: "A8", sizes: ["18"], label_sv: "Växel PS90" },
  { code: "A9", sizes: ["24"], label_sv: "Växel PS115" },
  { code: "C0", sizes: ["08", "11"], label_sv: "Växel LP050" },
  { code: "C1", sizes: ["11", "15", "18"], label_sv: "Växel PV60-TA eller LP070" },
  { code: "C2", sizes: ["18"], label_sv: "Växel PV90-TA eller LP090" },
  { code: "C3", sizes: ["24"], label_sv: "Växel PV115-TA eller LP120" },
];

/**
 * Position 16: växelmontage. Storleksberoende.
 *
 * "Mounting kit: contains gear housing, motor coupling, flange and gear."
 */
export const HMR_GUIDE_MOUNTINGS: Array<HmrValue & { sizes: string[] }> = [
  { code: "00", sizes: ["08", "11", "15", "18", "24"], label_sv: "Utan" },
  { code: "A2", sizes: ["08", "11"], label_sv: "LP050, utväxling 5" },
  { code: "A3", sizes: ["08", "11"], label_sv: "LP050, utväxling 10" },
  { code: "B1", sizes: ["11", "15"], label_sv: "LP070, utväxling 3" },
  { code: "B2", sizes: ["11", "15"], label_sv: "LP070, utväxling 5" },
  { code: "B3", sizes: ["11", "15"], label_sv: "LP070, utväxling 10" },
  { code: "C1", sizes: ["18"], label_sv: "LP090, utväxling 3" },
  { code: "C2", sizes: ["18"], label_sv: "LP090, utväxling 5" },
  { code: "C3", sizes: ["18"], label_sv: "LP090, utväxling 10" },
  { code: "D1", sizes: ["24"], label_sv: "LP120, utväxling 3" },
  { code: "D2", sizes: ["24"], label_sv: "LP120, utväxling 5" },
  { code: "D3", sizes: ["24"], label_sv: "LP120, utväxling 10" },
];

/**
 * Kulskruvens tekniska data, en rad per storlek och stigning (sida 15).
 *
 * ETT KRYSS SOM STÄMMER PÅ ALLA TIO RADERNA: största hastigheten delad med
 * stigningen är exakt 0,05 m/s per mm överallt. Det är motorns varvtal --
 * 3 000 varv/min -- och det är samma tal för hela serien. En felläst siffra i
 * någon av tio hastigheter eller tio stigningar skulle bryta det.
 *
 * Skruvens beteckning bär också sin diameter: storlek 08 har Ø12, 11 har Ø16,
 * 15 har Ø20, 18 har Ø25 och 24 har Ø32. Ett andra kryss, mot samma tabell.
 */
export interface HmrScrew {
  size: string;
  pitch_code: string;
  pitch_mm: number;
  /** Skruvens diameter, mm. */
  screw_diameter_mm: number;
  max_speed_ms: number;
  max_acceleration_ms2: number;
  repeatability_um: number;
  max_stroke_mm: number;
  max_thrust_n: number;
}

export const HMR_SCREWS: HmrScrew[] = [
  { size: "08", pitch_code: "05", pitch_mm: 5, screw_diameter_mm: 12, max_speed_ms: 0.25, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 1200, max_thrust_n: 820 },
  { size: "08", pitch_code: "12", pitch_mm: 12, screw_diameter_mm: 12, max_speed_ms: 0.60, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 1200, max_thrust_n: 820 },
  { size: "11", pitch_code: "05", pitch_mm: 5, screw_diameter_mm: 16, max_speed_ms: 0.25, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 1500, max_thrust_n: 2200 },
  { size: "11", pitch_code: "16", pitch_mm: 16, screw_diameter_mm: 16, max_speed_ms: 0.80, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 1500, max_thrust_n: 2200 },
  { size: "15", pitch_code: "05", pitch_mm: 5, screw_diameter_mm: 20, max_speed_ms: 0.25, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 2500, max_thrust_n: 2600 },
  { size: "15", pitch_code: "20", pitch_mm: 20, screw_diameter_mm: 20, max_speed_ms: 1.00, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 2500, max_thrust_n: 2600 },
  { size: "18", pitch_code: "10", pitch_mm: 10, screw_diameter_mm: 25, max_speed_ms: 0.50, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 3400, max_thrust_n: 4800 },
  { size: "18", pitch_code: "25", pitch_mm: 25, screw_diameter_mm: 25, max_speed_ms: 1.25, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 3400, max_thrust_n: 4800 },
  { size: "24", pitch_code: "10", pitch_mm: 10, screw_diameter_mm: 32, max_speed_ms: 0.50, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 4000, max_thrust_n: 5000 },
  { size: "24", pitch_code: "32", pitch_mm: 32, screw_diameter_mm: 32, max_speed_ms: 1.60, max_acceleration_ms2: 10, repeatability_um: 20, max_stroke_mm: 4000, max_thrust_n: 5000 },
];

/**
 * Motorns varvtal, uttryckt som hastighet delad med stigning.
 *
 * Finns för korskontrollen. 0,05 m/s per mm är 50 varv/s, alltså 3 000 v/min.
 */
export const HMR_SPEED_PER_PITCH = 0.05;

/**
 * Remdriftens tekniska data (sida 28).
 *
 * BARA TRE AV FEM STORLEKAR. Katalogen ger tabellen för HMRB08, 11 och 15;
 * 18 och 24 finns i beställnyckeln och i viktabellen men deras hastighets-
 * och kraftdata står inte på den här sidan. Att fylla i dem med gissningar
 * vore värre än att sakna dem.
 *
 * "Lead constant" är hur långt vagnen går per varv på drivaxeln, och den
 * beror på MOTORNS MONTERINGSLÄGE: storlek 15 går 100 mm/varv i lägena
 * 090°/270° men 125 mm/varv i 000°/180°.
 */
export interface HmrBelt {
  size: string;
  /** Monteringslägen tabellraden gäller. */
  mounts: string[];
  lead_mm_per_rev: number;
  max_speed_ms: number;
  max_acceleration_ms2: number;
  repeatability_um: number;
  max_stroke_mm: number;
  max_thrust_n: number;
  max_torque_nm: number;
}

export const HMR_BELTS: HmrBelt[] = [
  { size: "08", mounts: ["BD", "DD"], lead_mm_per_rev: 66, max_speed_ms: 2, max_acceleration_ms2: 30, repeatability_um: 50, max_stroke_mm: 3000, max_thrust_n: 295, max_torque_nm: 3.1 },
  { size: "08", mounts: ["AP", "CP", "AD", "CD"], lead_mm_per_rev: 66, max_speed_ms: 2, max_acceleration_ms2: 30, repeatability_um: 50, max_stroke_mm: 3000, max_thrust_n: 295, max_torque_nm: 3.1 },
  { size: "11", mounts: ["BD", "DD"], lead_mm_per_rev: 90, max_speed_ms: 2, max_acceleration_ms2: 30, repeatability_um: 50, max_stroke_mm: 4000, max_thrust_n: 630, max_torque_nm: 9.0 },
  { size: "11", mounts: ["AP", "CP", "AD", "CD"], lead_mm_per_rev: 90, max_speed_ms: 2, max_acceleration_ms2: 30, repeatability_um: 50, max_stroke_mm: 4000, max_thrust_n: 630, max_torque_nm: 9.0 },
  { size: "15", mounts: ["BD", "DD"], lead_mm_per_rev: 100, max_speed_ms: 5, max_acceleration_ms2: 50, repeatability_um: 50, max_stroke_mm: 6000, max_thrust_n: 1050, max_torque_nm: 17.0 },
  { size: "15", mounts: ["AP", "CP", "AD", "CD"], lead_mm_per_rev: 125, max_speed_ms: 5, max_acceleration_ms2: 50, repeatability_um: 50, max_stroke_mm: 6000, max_thrust_n: 630, max_torque_nm: 13.0 },
];

/** Skruvdata för en storlek och stigning. */
export function hmrScrew(size: string, pitchCode: string): HmrScrew | null {
  return HMR_SCREWS.find((s) => s.size === size && s.pitch_code === pitchCode) ?? null;
}

/** Remdata för en storlek och monteringsläge. Null när katalogen inte ger den. */
export function hmrBelt(size: string, mount: string): HmrBelt | null {
  return HMR_BELTS.find((b) => b.size === size && b.mounts.includes(mount)) ?? null;
}

/** Största slaglängd för en konfiguration, mm. Null när katalogen inte ger den. */
export function hmrMaxStroke(drive: string, size: string, pitchOrMount: string): number | null {
  if (drive === "S") return hmrScrew(size, pitchOrMount)?.max_stroke_mm ?? null;
  return hmrBelt(size, pitchOrMount)?.max_stroke_mm ?? null;
}

export const HMR_LIMITS = {
  /** Slaglängden skrivs med fyra siffror i mm. */
  stroke_digits: 4,
  stroke_min_mm: 1,
  stroke_max_mm: 9999,
  /** Kodens längd: HMR + typ + storlek(2) + design + pos5(2) + vagn + "-" + slag(4) + "-" + svans(9). */
  code_length: 25,
  /**
   * De två positioner katalogen inte förklarar. Sätts alltid till "0", vilket
   * är vad katalogens eget exempel gör.
   */
  undocumented_positions: 2,
} as const;

export interface HmrConfig {
  /** "S" eller "B". */
  drive: string;
  size: string;
  design: string;
  /** Stigningskod för kulskruv, monteringsläge för kuggrem. */
  pitch_or_mount: string;
  carriage?: string;
  stroke_mm: number;
  home_sensor?: string;
  limit_sensor?: string;
  sensor_position?: string;
  mounting_kit?: string;
  guide_mounting?: string;
}

function har(lista: Array<{ code: string }>, kod: string): boolean {
  return lista.some((x) => x.code === kod);
}

/** Stigningarna som finns för en storlek (bara kulskruv). */
export function hmrPitchesForSize(size: string): string[] {
  return HMR_PITCHES.filter((p) => p.sizes.includes(size)).map((p) => p.code);
}

/** Monteringssatser som finns för en storlek. */
export function hmrKitsForSize(size: string): string[] {
  return HMR_MOUNTING_KITS.filter((k) => k.sizes.includes(size)).map((k) => k.code);
}

/** Växelmontage som finns för en storlek. */
export function hmrGuidesForSize(size: string): string[] {
  return HMR_GUIDE_MOUNTINGS.filter((k) => k.sizes.includes(size)).map((k) => k.code);
}

/** Vagnalternativ som finns för en drivning. */
export function hmrCarriagesForDrive(drive: string): string[] {
  return HMR_CARRIAGES.filter((c) => c.drives.includes(drive)).map((c) => c.code);
}

/**
 * Bygger en HMR-beställkod. Null när något inte är beställbart.
 *
 * De två odokumenterade positionerna sätts till "0". Se filens huvud.
 */
export function hmrBuildCode(c: HmrConfig): string | null {
  if (!har(HMR_DRIVE_TYPES, c.drive)) return null;
  if (!har(HMR_SIZES, c.size)) return null;
  if (!har(HMR_DESIGNS, c.design)) return null;

  // Position 5 betyder olika saker beroende på drivningen.
  if (c.drive === "S") {
    if (!hmrPitchesForSize(c.size).includes(c.pitch_or_mount)) return null;
  } else {
    if (!har(HMR_BELT_MOUNTS, c.pitch_or_mount)) return null;
  }

  const carriage = c.carriage ?? "0";
  if (!hmrCarriagesForDrive(c.drive).includes(carriage)) return null;

  if (!Number.isInteger(c.stroke_mm) ||
      c.stroke_mm < HMR_LIMITS.stroke_min_mm || c.stroke_mm > HMR_LIMITS.stroke_max_mm) {
    return null;
  }

  const home = c.home_sensor ?? "0";
  const limit = c.limit_sensor ?? "0";
  const pos = c.sensor_position ?? "0";
  const kit = c.mounting_kit ?? "00";
  const guide = c.guide_mounting ?? "00";

  if (!har(HMR_HOME_SENSORS, home)) return null;
  if (!har(HMR_LIMIT_SENSORS, limit)) return null;
  if (!har(HMR_SENSOR_POSITIONS, pos)) return null;
  if (!hmrKitsForSize(c.size).includes(kit)) return null;
  if (!hmrGuidesForSize(c.size).includes(guide)) return null;

  const slag = String(c.stroke_mm).padStart(HMR_LIMITS.stroke_digits, "0");
  // De två odokumenterade positionerna: alltid "0".
  const svans = `${home}${limit}${pos}00${kit}${guide}`;
  return `${HMR_SERIES}${c.drive}${c.size}${c.design}${c.pitch_or_mount}${carriage}-${slag}-${svans}`;
}

export interface HmrReading {
  drive: string;
  size: string;
  width_mm: number;
  design: string;
  pitch_or_mount: string;
  /** Stigningen i mm, bara för kulskruv. */
  pitch_mm: number | null;
  carriage: string;
  stroke_mm: number;
  home_sensor: string;
  limit_sensor: string;
  sensor_position: string;
  mounting_kit: string;
  guide_mounting: string;
}

/** Läser en HMR-beställkod. */
export function hmrParseCode(raw: string): HmrReading | null {
  const k = raw.trim().toUpperCase();
  const m = /^HMR([SB])(\d{2})([BCRS])([0-9A-Z]{2})([012])-(\d{4})-([0-9A-Z]{9})$/.exec(k);
  if (!m) return null;
  const [, drive, size, design, pos5, carriage, slag, svans] = m;

  const s = HMR_SIZES.find((x) => x.code === size);
  if (!s) return null;
  if (!hmrCarriagesForDrive(drive).includes(carriage)) return null;

  let pitch_mm: number | null = null;
  if (drive === "S") {
    const p = HMR_PITCHES.find((x) => x.code === pos5 && x.sizes.includes(size));
    if (!p) return null;
    pitch_mm = p.pitch_mm;
  } else {
    if (!har(HMR_BELT_MOUNTS, pos5)) return null;
  }

  const home = svans[0], limit = svans[1], sensorPos = svans[2];
  const kit = svans.slice(5, 7), guide = svans.slice(7, 9);
  if (!har(HMR_HOME_SENSORS, home)) return null;
  if (!har(HMR_LIMIT_SENSORS, limit)) return null;
  if (!har(HMR_SENSOR_POSITIONS, sensorPos)) return null;
  if (!hmrKitsForSize(size).includes(kit)) return null;
  if (!hmrGuidesForSize(size).includes(guide)) return null;

  return {
    drive, size, width_mm: s.width_mm, design, pitch_or_mount: pos5, pitch_mm,
    carriage, stroke_mm: Number(slag),
    home_sensor: home, limit_sensor: limit, sensor_position: sensorPos,
    mounting_kit: kit, guide_mounting: guide,
  };
}

/**
 * Konfiguratorns mall.
 *
 * De två odokumenterade positionerna står som fasta nollor, precis som i
 * `hmrBuildCode`. Att skriva dem som platshållare utan parameter skulle ge en
 * kod som är två tecken för kort -- samma fälla som CCIV redan visat.
 */
export const HMR_ORDER_CODE_TEMPLATE =
  "HMR{drive}{size}{design}{pitch_or_mount}{carriage}-{stroke_mm#4}-" +
  "{home_sensor}{limit_sensor}{sensor_position}00{mounting_kit}{guide_mounting}";

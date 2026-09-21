/**
 * SMC SY3000/5000/7000 — ventilramp (plug-in, "connector connecting base")
 * typ 10 sidoportad, typ 11 bottenportad och typ 12 topportad, med
 * fältbussenheten EX600 (S-kit S6). Det som säljs som "SY valve terminal".
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "5-Port Solenoid Valve SY3000/5000/7000 Series" (katalogkapitlet,
 *   334 sidor, katalogsidor 387–720, SMC:s fil SY.New.pdf, hämtad 2026-09-21
 *   från content2.smcetech.com/pdf/SY.New.pdf). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-sy-new.pdf'.
 *     - variationer (typer, kit, sidhänvisningar)                    sida 398
 *     - rampdata: portar, kapsling, stationer per kit                sida 426
 *     - flöde och vikt per ramp och typ                              sida 427
 *     - EX600, typ 10/11: How to Order Manifolds, portar, exempel    sida 502–503
 *     - EX600, typ 12: How to Order Manifolds, P/E-storlek, exempel   sida 512–513
 *     - EX600-enheternas artikelnummer (SI-enhet, ändplatta, I/O)    sida 600–601
 *     - ventilerna som monteras på rampen                            sida 504 och 513
 *       (egen familj: sy-plugin)
 *     - DIN-skenans fastsättning                                     sida 708
 *
 * VAD FAMILJEN ÄR. Familjen sy hade mallen 'SY-{stations}-{fieldbus}-{voltage}'
 * med påhittade värden. SMC:s rampkod anger serie, typ, SI-enhet, polaritet/
 * ändplatta, antal I/O-enheter, antal ventilplatser, P/E-anslutning, portstorlek
 * och montering; ventilerna beställs med egna koder per station (sida 503).
 * Övriga kit (D-sub, flatkabel, plint, kabel, rundkontakt, EX500/EX245/EX250/
 * EX260/EX126/EX120/EX180), metallbasramperna typ 50/51/52 och blandramperna
 * (sida 574–585) är egna nycklar och ingår inte.
 *
 * KODENS FORM (sida 502 och 512):
 *
 *   SS5Y 3 - 10 S6 Q 2     - 05 U - C6        nyckelns exempel: SY3000 sidoportad,
 *                                              DeviceNet, pluskommun M12 B-kodad,
 *                                              5 stationer, P/E på U-sidan, ø6
 *   SS5Y 3 - 10 S6 Q 7 2   - 05 B - C6        sida 503: minuskommun M12 A-kodad,
 *                                              två I/O-enheter, P/E på båda sidor
 *   SS5Y 3 - 12 S6 Q 7 2   - 05 B             sida 513: topportad (ingen A/B-port
 *                                              på basen; metriska P/E-portar)
 *   SS5Y 3 - 12 S6 Q 2 2   - 05 B - N D0      topportad, tum-P/E, DIN-skena utan skena
 *   SS5Y 3 - 10 S6 0       - 04 B - C6        utan SI-enhet (SMC:s webb-konfigurator)
 *   SS5Y{serie}-{typ}S6{si_unit}{polaritet}{io}-{stationer}{pe}{port}{montering}{skena}
 *
 * Portkoden bär sitt bindestreck ("-C6", "-N"): topportad utan tumportar har
 * ingen portposition alls, och då ska inget bindestreck stå kvar före
 * monteringen ("…-05BD3", inte "…-05B-D3"). Bekräftat i SMC:s konfigurator
 * (smcusa.com, SS5Y3-12S6): "SS5Y3-12S6Q2-05BD3" och "SS5Y3-12S6Q22-05B-ND0".
 */

export const SYM_SOURCE = {
  file: "smc-kat-sy-new.pdf",
  edition: "SMC SY3000/5000/7000 catalogue chapter (catalogue pages 387–720, SY.New 2024-12)",
  title: "SMC 5-Port Solenoid Valve SY3000/5000/7000 Series",
  brand: "SMC",
} as const;

export interface SYMValue {
  code: string;
  label_sv: string;
}

export interface SYMSeries extends SYMValue {
  /** P/E-portens snabbkoppling, metrisk respektive tum (sida 503). */
  pe_metric: string;
  pe_inch: string;
  /** Flöde C [dm³/(s·bar)] 1→4/2 för 2-läges ventil per typ (sida 427, gummitätning). */
  flow_c: Record<string, number>;
  /** Vikt [g] = a·n + b per typ, D-sub-ramp med raka snabbkopplingar (sida 427). */
  weight: Record<string, [number, number]>;
}
export const SYM_SERIES: SYMSeries[] = [
  { code: "3", pe_metric: "ø8", pe_inch: "ø5/16\"", flow_c: { "10": 1.4, "12": 1.2 }, weight: { "10": [28.9, 293], "12": [25.1, 314] }, label_sv: "SY3000 (A/B ø2–ø6, P/E ø8)" },
  { code: "5", pe_metric: "ø10", pe_inch: "ø3/8\"", flow_c: { "10": 3.3, "11": 3.3, "12": 2.8 }, weight: { "10": [74.7, 398], "11": [76.8, 445], "12": [66.3, 417] }, label_sv: "SY5000 (A/B ø4–ø8, P/E ø10)" },
  { code: "7", pe_metric: "ø12", pe_inch: "ø1/2\"", flow_c: { "10": 6.2, "11": 6.2, "12": 5.6 }, weight: { "10": [106.6, 496], "11": [117.9, 532], "12": [84.1, 519] }, label_sv: "SY7000 (A/B ø6–ø12, P/E ø12)" },
];

export interface SYMType extends SYMValue {
  /** Serier som finns i typen (sida 502: bottenportad SY3000 beställs som blandramp på SY5000-bas). */
  series: string[];
  /** Ventilkroppens siffra i ventilkoden (SY3100 respektive SY3130, sida 504 och 513). */
  valve_body: string;
  page: number;
}
export const SYM_TYPES: SYMType[] = [
  { code: "10", series: ["3", "5", "7"], valve_body: "0", page: 502, label_sv: "Typ 10, sidoportad (A/B-portar på basens sida)" },
  { code: "11", series: ["5", "7"], valve_body: "0", page: 502, label_sv: "Typ 11, bottenportad (SY5000/7000; bara direktmontering)" },
  { code: "12", series: ["3", "5", "7"], valve_body: "3", page: 512, label_sv: "Typ 12, topportad (A/B-portar på ventilen)" },
];

export interface SYMSiUnit extends SYMValue {
  protocol_sv: string;
  protocol_en: string;
  /** EX600-enheten, PNP (minuskommun) respektive NPN (pluskommun) (sida 600). */
  unit_pnp: string | null;
  unit_npn: string | null;
  /** Typer där koden finns (sida 502 respektive 512: topportad saknar EB och DA). */
  types: string[];
}
/** "EX600-SDN1A"/"EX600-SDN2A" -> "EX600-SDN□A": tecknet som skiljer PNP från NPN blir en ruta. */
export function symUnitPair(pnp: string, npn: string): string {
  return [...pnp].map((ch, i) => (ch === npn[i] ? ch : "□")).join("");
}
const si = (code: string, sv: string, en: string, pnp: string, npn: string, types = ["10", "11", "12"]): SYMSiUnit =>
  ({ code, protocol_sv: sv, protocol_en: en, unit_pnp: pnp, unit_npn: npn, types, label_sv: `${sv} (${symUnitPair(pnp, npn)})` });
export const SYM_SI_UNITS: SYMSiUnit[] = [
  { code: "0", protocol_sv: "Utan SI-enhet", protocol_en: "Without SI unit", unit_pnp: null, unit_npn: null, types: ["10", "11", "12"], label_sv: "Utan SI-enhet (ventilplattan medföljer omonterad)" },
  si("Q", "DeviceNet", "DeviceNet", "EX600-SDN1A", "EX600-SDN2A"),
  si("N", "PROFIBUS DP", "PROFIBUS DP", "EX600-SPR1A", "EX600-SPR2A"),
  si("V", "CC-Link", "CC-Link", "EX600-SMJ1", "EX600-SMJ2"),
  si("EA", "EtherNet/IP (2 portar)", "EtherNet/IP (2 ports)", "EX600-SEN3", "EX600-SEN4"),
  si("EB", "EtherNet/IP med IO-Link-enhet", "EtherNet/IP (IO-Link unit)", "EX600-SEN7", "EX600-SEN8", ["10", "11"]),
  si("DA", "EtherCAT med IO-Link-enhet", "EtherCAT (IO-Link unit)", "EX600-SEC3", "EX600-SEC4", ["10", "11"]),
  si("F", "PROFINET", "PROFINET", "EX600-SPN1", "EX600-SPN2"),
  si("FA", "PROFINET med IO-Link-enhet", "PROFINET (IO-Link unit)", "EX600-SPN3", "EX600-SPN4"),
  si("WE", "Trådlös bas, EtherNet/IP", "EtherNet/IP compatible wireless base", "EX600-WEN1", "EX600-WEN2"),
  si("WF", "Trådlös bas, PROFINET", "PROFINET compatible wireless base", "EX600-WPN1", "EX600-WPN2"),
  si("WS", "Trådlös remote", "Wireless remote", "EX600-WSV1", "EX600-WSV2"),
];

export interface SYMPolarity extends SYMValue {
  /** Pluskommun (NPN-enhet) eller minuskommun (PNP-enhet). */
  positive: boolean;
  end_plate: string;
  connector_sv: string;
  connector_en: string;
}
/** SI-enhetens polaritet och ändplatta (sida 502): jämna koder pluskommun, udda minuskommun. */
export const SYM_POLARITIES: SYMPolarity[] = [
  { code: "2", positive: true, end_plate: "EX600-ED2", connector_sv: "M12 B-kodad matningskontakt", connector_en: "M12 B-coded power supply connector", label_sv: "Pluskommun, M12 B-kodad matning (EX600-ED2)" },
  { code: "3", positive: true, end_plate: "EX600-ED3", connector_sv: "7/8-tums matningskontakt", connector_en: "7/8 inch power supply connector", label_sv: "Pluskommun, 7/8-tums matning (EX600-ED3)" },
  { code: "6", positive: true, end_plate: "EX600-ED4", connector_sv: "M12 A-kodad IN/OUT, stiftlayout 1", connector_en: "M12 A-coded IN/OUT, pin arrangement 1", label_sv: "Pluskommun, M12 A-kodad IN/OUT stiftlayout 1 (EX600-ED4)" },
  { code: "8", positive: true, end_plate: "EX600-ED5", connector_sv: "M12 A-kodad IN/OUT, stiftlayout 2", connector_en: "M12 A-coded IN/OUT, pin arrangement 2", label_sv: "Pluskommun, M12 A-kodad IN/OUT stiftlayout 2 (EX600-ED5)" },
  { code: "4", positive: false, end_plate: "EX600-ED2", connector_sv: "M12 B-kodad matningskontakt", connector_en: "M12 B-coded power supply connector", label_sv: "Minuskommun, M12 B-kodad matning (EX600-ED2)" },
  { code: "5", positive: false, end_plate: "EX600-ED3", connector_sv: "7/8-tums matningskontakt", connector_en: "7/8 inch power supply connector", label_sv: "Minuskommun, 7/8-tums matning (EX600-ED3)" },
  { code: "7", positive: false, end_plate: "EX600-ED4", connector_sv: "M12 A-kodad IN/OUT, stiftlayout 1", connector_en: "M12 A-coded IN/OUT, pin arrangement 1", label_sv: "Minuskommun, M12 A-kodad IN/OUT stiftlayout 1 (EX600-ED4)" },
  { code: "9", positive: false, end_plate: "EX600-ED5", connector_sv: "M12 A-kodad IN/OUT, stiftlayout 2", connector_en: "M12 A-coded IN/OUT, pin arrangement 2", label_sv: "Minuskommun, M12 A-kodad IN/OUT stiftlayout 2 (EX600-ED5)" },
];

/** Antal I/O-enheter (sida 502): levereras lösa och monteras av kunden. */
/** Etiketterna börjar inte med koden ("1 I/O-enhet" med koden 1 klipps av stripLeadingCode). */
export const SYM_IO_STATIONS: SYMValue[] = Array.from({ length: 9 }, (_, i) => ({ code: String(i + 1), label_sv: `Med ${i + 1} I/O-enhet${i ? "er" : ""} (levereras omonterade)` }));

/** Ventilplatser (sida 502): 2–16 med dubbelkoppling, 17–24 bara med specificerad layout (högst 32 spolar). */
export const SYM_MAX_DOUBLE_WIRING = 16;
export const SYM_MAX_SOLENOIDS = 32;
export const SYM_STATIONS: SYMValue[] = Array.from({ length: 23 }, (_, i) => i + 2).map((n) => ({
  code: String(n).padStart(2, "0"),
  label_sv: `Platser: ${n}${n > SYM_MAX_DOUBLE_WIRING ? " (bara specificerad layout)" : ""}`,
}));

export interface SYMPeEntry extends SYMValue {
  side_sv: string;
  side_en: string;
  external_pilot: boolean;
  silencer: boolean;
  /** U-/D-sidan 2–10 stationer, båda sidor 2–24 (sida 502). */
  max_stations: number;
  types: string[];
}
const pe = (code: string, sv: string, en: string, ext: boolean, sil: boolean, max: number, types = ["10", "11", "12"]): SYMPeEntry =>
  ({ code, side_sv: sv, side_en: en, external_pilot: ext, silencer: sil, max_stations: max, types, label_sv: `P/E på ${sv}${sil ? ", inbyggd ljuddämpare" : ""}${ext ? ", extern pilot" : ", intern pilot"}${max < 24 ? " (2–10 platser)" : ""}` });
/** P/E-portens placering, pilot och ljuddämpare (sida 502 och 512; F finns inte topportad). */
export const SYM_PE_ENTRIES: SYMPeEntry[] = [
  pe("U", "U-sidan", "U side", false, false, 10),
  pe("D", "D-sidan", "D side", false, false, 10),
  pe("B", "båda sidor", "both sides", false, false, 24),
  pe("C", "U-sidan", "U side", false, true, 10),
  pe("E", "D-sidan", "D side", false, true, 10),
  pe("F", "båda sidor", "both sides", false, true, 24, ["10", "11"]),
  pe("G", "U-sidan", "U side", true, false, 10),
  pe("H", "D-sidan", "D side", true, false, 10),
  pe("J", "båda sidor", "both sides", true, false, 24),
];

export interface SYMPort extends SYMValue {
  /** Portens storlek i klartext. */
  size: string;
  inch: boolean;
  style: "straight" | "up" | "down" | "mixed";
  /** Serier per typ där porten finns (sida 503). */
  series: Record<string, string[]>;
}
const port = (code: string, size: string, style: SYMPort["style"], t10: string[], t11: string[], extra = ""): SYMPort => ({
  code: `-${code}`,
  size,
  inch: code.includes("N"),
  style,
  series: { "10": t10, "11": t11 },
  label_sv: `${size}${style === "straight" ? " rak" : style === "up" ? " vinkel uppåt" : style === "down" ? " vinkel nedåt" : ""}${extra}`,
});
/** A/B-portar för typ 10/11 (sida 503) och P/E-storlek för typ 12 (sida 512). */
export const SYM_PORTS: SYMPort[] = [
  port("C2", "ø2", "straight", ["3"], []),
  port("C3", "ø3,2", "straight", ["3"], []),
  port("C4", "ø4", "straight", ["3", "5"], ["5"]),
  port("C6", "ø6", "straight", ["3", "5", "7"], ["5", "7"]),
  port("C8", "ø8", "straight", ["5", "7"], ["5", "7"]),
  port("C10", "ø10", "straight", ["7"], ["7"]),
  port("C12", "ø12", "straight", ["7"], ["7"]),
  port("CM", "Raka portar, blandade storlekar", "mixed", ["3", "5", "7"], ["5", "7"], " (anges på specifikationsbladet)"),
  port("L4", "ø4", "up", ["3", "5"], []),
  port("L6", "ø6", "up", ["3", "5", "7"], []),
  port("L8", "ø8", "up", ["5", "7"], []),
  port("L10", "ø10", "up", ["7"], []),
  port("L12", "ø12", "up", ["7"], []),
  port("B4", "ø4", "down", ["3", "5"], []),
  port("B6", "ø6", "down", ["3", "5", "7"], []),
  port("B8", "ø8", "down", ["5", "7"], []),
  port("B10", "ø10", "down", ["7"], []),
  port("B12", "ø12", "down", ["7"], []),
  port("LM", "Vinkelportar, blandade storlekar", "mixed", ["3", "5", "7"], [], " (anges på specifikationsbladet)"),
  port("N1", "ø1/8\"", "straight", ["3"], []),
  port("N3", "ø5/32\"", "straight", ["3", "5"], ["5"]),
  port("N7", "ø1/4\"", "straight", ["3", "5", "7"], ["5", "7"]),
  port("N9", "ø5/16\"", "straight", ["5", "7"], ["5", "7"]),
  port("N11", "ø3/8\"", "straight", ["7"], ["7"]),
  port("LN3", "ø5/32\"", "up", ["3"], []),
  port("LN7", "ø1/4\"", "up", ["3", "5"], []),
  port("LN9", "ø5/16\"", "up", ["5"], []),
  port("LN11", "ø3/8\"", "up", ["7"], []),
  port("BN3", "ø5/32\"", "down", ["3"], []),
  port("BN7", "ø1/4\"", "down", ["3", "5"], []),
  port("BN9", "ø5/16\"", "down", ["5"], []),
  port("BN11", "ø3/8\"", "down", ["7"], []),
  { code: "", size: "metriska P/E-portar", inch: false, style: "straight", series: { "12": ["3", "5", "7"] }, label_sv: "Topportad: metriska P/E-portar ø8/ø10/ø12 (inga A/B på basen)" },
  { code: "-N", size: "P/E-portar i tum", inch: true, style: "straight", series: { "12": ["3", "5", "7"] }, label_sv: "Topportad: P/E-portar i tum (ø5/16\"/ø3/8\"/ø1/2\")" },
];

export interface SYMMounting extends SYMValue {
  din: boolean;
  name_plate: boolean;
  station_number: boolean;
  types: string[];
}
/** Montering och tillval (sida 503 och 512): typ 11 bara direkt, typ 12 bara Nil/D. */
export const SYM_MOUNTINGS: SYMMounting[] = [
  { code: "AA", din: false, name_plate: true, station_number: true, types: ["10", "11"], label_sv: "Direktmontering med namnskylt och stationsnummer" },
  { code: "BA", din: false, name_plate: true, station_number: false, types: ["10", "11"], label_sv: "Direktmontering med namnskylt" },
  { code: "D", din: true, name_plate: false, station_number: false, types: ["10", "12"], label_sv: "DIN-skena" },
  { code: "A", din: true, name_plate: true, station_number: true, types: ["10"], label_sv: "DIN-skena med namnskylt och stationsnummer" },
  { code: "B", din: true, name_plate: true, station_number: false, types: ["10"], label_sv: "DIN-skena med namnskylt" },
];

/** DIN-skenans tillval (sida 503): 0 utan skena (med fäste), 3–24 längre skena än stationsantalet. */
export const SYM_DIN_RAILS: SYMValue[] = [
  { code: "0", label_sv: "Utan DIN-skena (med fästen)" },
  ...Array.from({ length: 22 }, (_, i) => i + 3).map((n) => ({ code: String(n), label_sv: `Skena för ${n} stationer (längre än standard)` })),
];

export interface SYMConfig {
  series: string;
  type: string;
  si_unit: string;
  polarity?: string;
  io_stations?: string;
  stations: string;
  pe_entry: string;
  port?: string;
  mounting?: string;
  din_rail?: string;
}

export function symAllowedPorts(type: string, series: string): SYMPort[] {
  return SYM_PORTS.filter((p) => (p.series[type] ?? []).includes(series));
}

export function symBuildCode(c: SYMConfig): string | null {
  const s = SYM_SERIES.find((x) => x.code === c.series);
  const t = SYM_TYPES.find((x) => x.code === c.type);
  if (!s || !t || !t.series.includes(s.code)) return null;
  const u = SYM_SI_UNITS.find((x) => x.code === c.si_unit);
  if (!u || !u.types.includes(t.code)) return null;
  const pol = c.polarity ?? "";
  const io = c.io_stations ?? "";
  if (u.code === "0") {
    if (pol || io) return null;
  } else {
    if (!SYM_POLARITIES.some((x) => x.code === pol)) return null;
    if (io && !SYM_IO_STATIONS.some((x) => x.code === io)) return null;
  }
  const st = SYM_STATIONS.find((x) => x.code === c.stations);
  if (!st) return null;
  const n = Number(st.code);
  const e = SYM_PE_ENTRIES.find((x) => x.code === c.pe_entry);
  if (!e || !e.types.includes(t.code) || n > e.max_stations) return null;
  const portCode = c.port ?? "";
  const p = SYM_PORTS.find((x) => x.code === portCode);
  if (!p || !(p.series[t.code] ?? []).includes(s.code)) return null;
  const m = c.mounting ?? "";
  const mo = m ? SYM_MOUNTINGS.find((x) => x.code === m) : undefined;
  if (m && (!mo || !mo.types.includes(t.code))) return null;
  const d = c.din_rail ?? "";
  if (d) {
    if (!mo || !mo.din) return null;
    if (!SYM_DIN_RAILS.some((x) => x.code === d)) return null;
    if (d !== "0" && Number(d) <= n) return null;
  }
  return `SS5Y${s.code}-${t.code}S6${u.code}${pol}${io}-${st.code}${e.code}${p.code}${m}${d}`;
}

export function symParseCode(raw: string): { config: SYMConfig } | null {
  const k = raw.trim().toUpperCase();
  const mm = /^SS5Y([357])-(1[012])S6(0|Q|N|V|EA|EB|DA|F|FA|WE|WF|WS)([2-9]?)([1-9]?)-(\d{2})([UDBCEFGHJ])(-(?:C2|C3|C4|C6|C8|C10|C12|CM|L4|L6|L8|L10|L12|B4|B6|B8|B10|B12|LM|N1|N3|N7|N9|N11|LN3|LN7|LN9|LN11|BN3|BN7|BN9|BN11|N))?(AA|BA|D|A|B)?(0|[3-9]|1\d|2[0-4])?$/.exec(k);
  if (!mm) return null;
  const [, series, type, si_unit, polarity, io_stations, stations, pe_entry, port, mounting, din_rail] = mm;
  const c: SYMConfig = {
    series, type, si_unit, stations, pe_entry,
    polarity: polarity || undefined,
    io_stations: io_stations || undefined,
    port: port || undefined,
    mounting: mounting || undefined,
    din_rail: din_rail || undefined,
  };
  if (symBuildCode(c) !== k) return null;
  return { config: c };
}

export const SYM_ORDER_CODE_TEMPLATE = "SS5Y{series}-{type}S6{si_unit}{polarity}{io_stations}-{stations}{pe_entry}{port}{mounting}{din_rail}";

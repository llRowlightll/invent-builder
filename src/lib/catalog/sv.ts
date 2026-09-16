/**
 * SMC SV1000/2000/3000 — ventilramp (tie-rod base) med seriell enhet
 * EX260, IP67. Familjen sv1000 är rampens bas; ventilerna (SV1100-5FU
 * o.s.v., sida 29) beställs per station under basens artikelnummer.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "5 Port Solenoid Valve SV1000/2000/3000/4000 Series" (katalogutdrag,
 *   124 sidor, katalogsidor 19–142). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-sv1000.pdf'.
 *     - ventildata (tryck, temperatur, effekt)         sida 27
 *     - How to Order Manifold, EX260 tie-rod base      sida 58
 *     - How to Order Manifold Assembly och ventilerna  sida 59
 *     - DIN-skenans artikelnummer                      sida 123
 *
 * VAD FAMILJEN ÄR. EX260-basen. Ramperna för EX500/EX250 (utgår enligt
 * sida 19), EX600, EX126, EX120, rundkontakt, D-sub och flatkabel (sida
 * 28–101), kassettbasen (sida 113) och enkelventilen på underplatta (sida
 * 126) är egna nycklar.
 *
 * KODENS FORM (sida 58; W10S1 och D är fasta tecken):
 *
 *   SS5V 1 - W10S1 NAN D - 05 U   - C6        SV1000, PROFIBUS DP 32 utgångar negativ
 *                                              common, 5 stationer, P/E på U-sidan,
 *                                              direktmontering, ø6 (nyckelns exempel)
 *   SS5V 1 - W10S1 A3N D - 04 B   - C6        EX500-exemplet sida 29 har samma form
 *   SS5V 3 - W10S1 EAN D - 12 B RS - D12 - C10 EtherNet/IP negativ common, båda sidor,
 *                                              extern pilot med ljuddämpare, DIN-skena för
 *                                              12 stationer (utan SI-enhet bara D0, not 1)
 *   SS5V{serie}-W10S1{si}D-{stationer}{pe}{supexh}-{montering}-{port}
 */

export const SV_SOURCE = {
  file: "smc-kat-sv1000.pdf",
  edition: "SMC SV1000/2000/3000/4000 catalogue (catalogue pages 19–142)",
  title: "SMC 5 Port Solenoid Valve SV1000/2000/3000/4000 Series",
  brand: "SMC",
} as const;

export interface SVValue {
  code: string;
  label_sv: string;
}

export interface SVSeries extends SVValue {
  /** A/B-portar metriska och tum, P/E-portens storlek (sida 58). */
  ports_metric: string[];
  ports_inch: string[];
  pe_port: string;
  pe_port_inch: string;
  /** X/PE-port för extern pilot (sida 58, ∗). */
  pilot_port: string;
}
export const SV_SERIES: SVSeries[] = [
  { code: "1", ports_metric: ["C3", "C4", "C6"], ports_inch: ["N1", "N3", "N7"], pe_port: "ø8", pe_port_inch: "ø5/16\"", pilot_port: "ø4 / ø5/32\"", label_sv: "SV1000 (A/B ø3,2–ø6, P/E ø8)" },
  { code: "2", ports_metric: ["C4", "C6", "C8"], ports_inch: ["N3", "N7", "N9"], pe_port: "ø10", pe_port_inch: "ø3/8\"", pilot_port: "ø4 / ø5/32\"", label_sv: "SV2000 (A/B ø4–ø8, P/E ø10)" },
  { code: "3", ports_metric: ["C6", "C8", "C10"], ports_inch: ["N7", "N9", "N11"], pe_port: "ø12", pe_port_inch: "ø3/8\"", pilot_port: "ø6 / ø1/4\"", label_sv: "SV3000 (A/B ø6–ø10, P/E ø12)" },
];
export interface SVSiUnit extends SVValue {
  protocol: string;
  /** Antal utgångar: 32 eller 16; 0 = utan SI-enhet. */
  outputs: number;
  polarity: "" | "+" | "-";
  connector: "" | "M12" | "D-sub";
  /** SI-enhetens eget artikelnummer (sida 58, tabellen). */
  part_no: string;
}
const si = (code: string, protocol: string, outputs: number, polarity: "+" | "-", connector: "M12" | "D-sub", part: string): SVSiUnit =>
  ({ code, protocol, outputs, polarity, connector, part_no: part, label_sv: `${protocol}, ${outputs} utgångar, ${polarity === "+" ? "positiv" : "negativ"} common, ${connector} (${part})` });
export const SV_SI_UNITS: SVSiUnit[] = [
  { code: "0", protocol: "", outputs: 0, polarity: "", connector: "", part_no: "", label_sv: "Utan SI-enhet" },
  si("QA", "DeviceNet", 32, "+", "M12", "EX260-SDN2"), si("QAN", "DeviceNet", 32, "-", "M12", "EX260-SDN1"),
  si("QB", "DeviceNet", 16, "+", "M12", "EX260-SDN4"), si("QBN", "DeviceNet", 16, "-", "M12", "EX260-SDN3"),
  si("NA", "PROFIBUS DP", 32, "+", "M12", "EX260-SPR2"), si("NAN", "PROFIBUS DP", 32, "-", "M12", "EX260-SPR1"),
  si("NB", "PROFIBUS DP", 16, "+", "M12", "EX260-SPR4"), si("NBN", "PROFIBUS DP", 16, "-", "M12", "EX260-SPR3"),
  si("NC", "PROFIBUS DP", 32, "+", "D-sub", "EX260-SPR6"), si("NCN", "PROFIBUS DP", 32, "-", "D-sub", "EX260-SPR5"),
  si("ND", "PROFIBUS DP", 16, "+", "D-sub", "EX260-SPR8"), si("NDN", "PROFIBUS DP", 16, "-", "D-sub", "EX260-SPR7"),
  si("VA", "CC-Link", 32, "+", "M12", "EX260-SMJ2"), si("VAN", "CC-Link", 32, "-", "M12", "EX260-SMJ1"),
  si("VB", "CC-Link", 16, "+", "M12", "EX260-SMJ4"), si("VBN", "CC-Link", 16, "-", "M12", "EX260-SMJ3"),
  si("DA", "EtherCAT", 32, "+", "M12", "EX260-SEC2"), si("DAN", "EtherCAT", 32, "-", "M12", "EX260-SEC1"),
  si("DB", "EtherCAT", 16, "+", "M12", "EX260-SEC4"), si("DBN", "EtherCAT", 16, "-", "M12", "EX260-SEC3"),
  si("FA", "PROFINET", 32, "+", "M12", "EX260-SPN2"), si("FAN", "PROFINET", 32, "-", "M12", "EX260-SPN1"),
  si("FB", "PROFINET", 16, "+", "M12", "EX260-SPN4"), si("FBN", "PROFINET", 16, "-", "M12", "EX260-SPN3"),
  si("EA", "EtherNet/IP", 32, "+", "M12", "EX260-SEN2"), si("EAN", "EtherNet/IP", 32, "-", "M12", "EX260-SEN1"),
  si("EB", "EtherNet/IP", 16, "+", "M12", "EX260-SEN4"), si("EBN", "EtherNet/IP", 16, "-", "M12", "EX260-SEN3"),
  si("GAN", "Ethernet POWERLINK", 32, "-", "M12", "EX260-SPL1"), si("GBN", "Ethernet POWERLINK", 16, "-", "M12", "EX260-SPL3"),
];
export const SV_STATION_MIN = 2;
export const SV_STATION_MAX = 20;
export const SV_STATIONS: SVValue[] = Array.from({ length: SV_STATION_MAX - SV_STATION_MIN + 1 }, (_, i) => {
  const n = i + SV_STATION_MIN;
  return { code: String(n).padStart(2, "0"), label_sv: `Stationer: ${n}` };
});
export interface SVPeLocation extends SVValue {
  max_stations: number;
}
export const SV_PE_LOCATIONS: SVPeLocation[] = [
  { code: "U", max_stations: 10, label_sv: "P/E-portar på U-sidan (2–10 stationer)" },
  { code: "D", max_stations: 10, label_sv: "P/E-portar på D-sidan (2–10 stationer)" },
  { code: "B", max_stations: 20, label_sv: "P/E-portar på båda sidor (2–20 stationer)" },
];
export const SV_SUP_EXH: SVValue[] = [
  { code: "S", label_sv: "Intern pilot med inbyggd ljuddämpare" },
  { code: "R", label_sv: "Extern pilot" },
  { code: "RS", label_sv: "Extern pilot med inbyggd ljuddämpare" },
];
export interface SVMounting extends SVValue {
  /** DIN-skena medföljer; DIN-skenans längd i stationer (0 = standardlängd). */
  din: boolean;
  rail_stations: number;
}
export const SV_MOUNTINGS: SVMounting[] = [
  { code: "D", din: true, rail_stations: 0, label_sv: "DIN-skena, standardlängd (kräver SI-enhet)" },
  { code: "D0", din: true, rail_stations: -1, label_sv: "DIN-fäste utan skena (skenan beställs separat)" },
  ...Array.from({ length: 18 }, (_, i) => {
    const n = i + 3;
    return { code: `D${n}`, din: true, rail_stations: n, label_sv: `DIN-skena för ${n} stationer (längre än rampen; kräver SI-enhet)` };
  }),
];
export interface SVPort extends SVValue {
  kind: "metric" | "inch" | "mixed";
}
export const SV_PORTS: SVPort[] = [
  { code: "C3", kind: "metric", label_sv: "A/B ø3,2 snabbkoppling (SV1000)" },
  { code: "C4", kind: "metric", label_sv: "A/B ø4 snabbkoppling (SV1000/2000)" },
  { code: "C6", kind: "metric", label_sv: "A/B ø6 snabbkoppling (SV1000/2000/3000)" },
  { code: "C8", kind: "metric", label_sv: "A/B ø8 snabbkoppling (SV2000/3000)" },
  { code: "C10", kind: "metric", label_sv: "A/B ø10 snabbkoppling (SV3000)" },
  { code: "N1", kind: "inch", label_sv: "A/B ø1/8\" snabbkoppling (SV1000)" },
  { code: "N3", kind: "inch", label_sv: "A/B ø5/32\" snabbkoppling (SV1000/2000)" },
  { code: "N7", kind: "inch", label_sv: "A/B ø1/4\" snabbkoppling (SV1000/2000/3000)" },
  { code: "N9", kind: "inch", label_sv: "A/B ø5/16\" snabbkoppling (SV2000/3000)" },
  { code: "N11", kind: "inch", label_sv: "A/B ø3/8\" snabbkoppling (SV3000)" },
  { code: "M", kind: "mixed", label_sv: "A/B blandade storlekar (anges på specifikationsbladet)" },
];
export const SV_LIMITS = {
  pressure_mpa: [0.15, 0.7],
  pressure_double_mpa: [0.1, 0.7],
  pressure_3pos_mpa: [0.2, 0.7],
  ext_pilot_kpa: -100,
  temp_c: [-10, 50],
  power_w: 0.6,
  enclosure: "IP67",
} as const;

export interface SVConfig {
  series: string;
  si: string;
  stations: string;
  pe: string;
  supexh?: string;
  mounting?: string;
  port: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

/** Största antal stationer för SI-enheten: dubbelkoppling / specificerad layout (sida 58). */
export function svStationLimits(si: SVSiUnit): [number, number] {
  if (si.outputs === 32) return [16, 20];
  if (si.outputs === 16) return [8, 16];
  return [SV_STATION_MAX, SV_STATION_MAX];
}

export function svBuildCode(c: SVConfig): string | null {
  const s = SV_SERIES.find((x) => x.code === c.series);
  const u = SV_SI_UNITS.find((x) => x.code === c.si);
  const pe = SV_PE_LOCATIONS.find((x) => x.code === c.pe);
  if (!s || !u || !pe || !har(SV_STATIONS, c.stations)) return null;
  const n = Number(c.stations);
  if (n > pe.max_stations) return null;
  if (n > svStationLimits(u)[1]) return null;
  const supexh = c.supexh ?? "";
  if (supexh && !har(SV_SUP_EXH, supexh)) return null;
  const mounting = c.mounting ?? "";
  if (mounting) {
    const m = SV_MOUNTINGS.find((x) => x.code === mounting);
    if (!m) return null;
    if (u.outputs === 0 && m.code !== "D0") return null;
    if (m.rail_stations > 0 && m.rail_stations < n) return null;
  }
  const p = SV_PORTS.find((x) => x.code === c.port);
  if (!p) return null;
  if (p.kind === "metric" && !s.ports_metric.includes(p.code)) return null;
  if (p.kind === "inch" && !s.ports_inch.includes(p.code)) return null;
  return [`SS5V${s.code}`, `W10S1${u.code}D`, `${c.stations}${pe.code}${supexh}`, mounting, p.code].filter((g, i) => i < 3 || g).join("-");
}

export function svParseCode(raw: string): { config: SVConfig } | null {
  const k = raw.trim().toUpperCase();
  const sis = [...SV_SI_UNITS].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const ports = [...SV_PORTS].map((x) => x.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^SS5V([123])-W10S1(${sis})D-(\\d{2})([UDB])(RS|S|R)?(?:-(D\\d{0,2}))?-(${ports})$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, series, si, stations, pe, supexh, mounting, port] = m;
  const c: SVConfig = { series, si, stations, pe, supexh: supexh || undefined, mounting: mounting || undefined, port };
  if (svBuildCode(c) !== k) return null;
  return { config: c };
}

export const SV_ORDER_CODE_TEMPLATE = "SS5V{series}-W10S1{si}D-{stations}{pe}{supexh}-{mounting}-{port}";

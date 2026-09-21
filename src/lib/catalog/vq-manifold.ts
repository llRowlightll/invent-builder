/**
 * SMC VQ1000/2000 — ventilramp (basmonterad plug-in) VV5Q11/VV5Q21 med kit
 * F (D-sub), P (flatkabel), T (plintlåda), L (kabel), S (seriell EX120/124)
 * och M (rundkontakt, VQ2000). Ventilerna per station är familjen vq1000.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "5 Port Solenoid Valve VQ1000/2000 Series" (katalogkapitlet, 71 sidor,
 *   katalogsidor 359–429). Ligger i knowledge_chunks som
 *   source_file = 'smc-kat-vq1000.pdf'.
 *     - VQ1000 How to Order Manifold, tillval, kit                   sida 366
 *     - VQ2000 How to Order Manifold, tillval, kit (även T/S/M)      sida 370
 *     - ventildata: flöde, respons, vikt                             sida 374
 *     - rampdata: portar och stationer per kit, ström                sida 375
 *     - F-kit D-sub (2–24 platser, kabel)                            sida 376–378
 *     - P-kit flatkabel (2–24)                                       sida 380–382
 *     - T-kit plintlåda (2–24 VQ1000, 2–20 VQ2000, IP65)             sida 384–386
 *     - L-kit kabel (1–8, IP65)                                      sida 388–390
 *     - S-kit EX120/124 (2–16; 9–16 via specifikationsblad)          sida 396–398
 *     - M-kit rundkontakt, bara VQ2000 (2–24, IP65)                  sida 400–402
 *     - semistandard: extern pilot, tumkopplingar, DIN-skena         sida 404–406
 *
 * VAD FAMILJEN ÄR. Familjen vq hade mallen 'VQ-{size}-{function}-{voltage}-
 * {connection}' med påhittade värden och en produktrad "VQ – 5-Port Solenoid
 * Valve, 3 sizes (VQ1/2/3000)" — VQ3000 finns inte, och enkelventilen är redan
 * familjen vq1000. Rampen är det som saknades. S-kitet för EX510 (sida 392,
 * "to be discontinued", annan kodform VV5Q11-SB08…) ingår inte.
 *
 * KODENS FORM (sida 366, 370, 404–406):
 *
 *   VV5Q 1 1 - 08 C6 FU1            nyckelns exempel: VQ1000, 8 platser, ø6,
 *                                    D-sub toppanslutning med 1,5 m kabel
 *   VV5Q 2 1 - 08 C8 FU2            VQ2000 (sida 371)
 *   VV5Q 1 1 - 08 C6 T0             plintlåda (sida 385)
 *   VV5Q 1 1 - 06 C6 L2             kabel 3 m (sida 389)
 *   VV5Q 1 1 - 08 C6 SV             EX120 CC-Link (sida 397)
 *   VV5Q 2 1 - 09 C6 M2             rundkontakt (sida 401)
 *   VV5Q 1 1 - 08 C6 FU1 - RS       tillvalen alfabetiskt (sida 404)
 *   VV5Q 1 1 - 08 C6 FU1 - D09S     DIN-skena för nio stationer (sida 406)
 *   VV5Q{serie}1-{platser}{port}{kit}{anslutning}{kabel}{SI-enhet}-{tillval…}-{ce}
 */

export const VQM_SOURCE = {
  file: "smc-kat-vq1000.pdf",
  edition: "SMC VQ1000/2000 catalogue chapter (catalogue pages 359–429)",
  title: "SMC 5 Port Solenoid Valve VQ1000/2000 Series",
  brand: "SMC",
} as const;

export interface VQMValue {
  code: string;
  label_sv: string;
}

export interface VQMSeries extends VQMValue {
  /** P/R-portens snabbkoppling, metrisk respektive tum (sida 375 och 406). */
  pe_metric: string;
  pe_inch: string;
  /** Flöde C [dm³/(s·bar)] 1→2/4 för 2-läges enkel, metall/gummi (sida 374). */
  flow_c: [number, number];
  /** Ventilvikt [g] 2-läges respektive 3-läges (sida 374). */
  valve_weight_g: [number, number];
}
export const VQM_SERIES: VQMSeries[] = [
  { code: "1", pe_metric: "C8 (ø8)", pe_inch: "N9 (ø5/16\")", flow_c: [0.70, 0.85], valve_weight_g: [67, 77], label_sv: "VQ1000 (A/B ø3,2–ø6 eller M5, P/R ø8)" },
  { code: "2", pe_metric: "C10 (ø10)", pe_inch: "N11 (ø3/8\")", flow_c: [2.0, 2.2], valve_weight_g: [95, 105], label_sv: "VQ2000 (A/B ø4–ø8, P/R ø10)" },
];

export interface VQMKit extends VQMValue {
  name_sv: string;
  name_en: string;
  /** Anslutningsriktning U/S (bara F/P), kabellängder (F/P/L/M), SI-enhet (S). */
  entry: boolean;
  cables: string[];
  si_unit: boolean;
  /** Platser per serie [min, max] (sida 375). */
  stations: Record<string, [number, number]>;
  ip65: boolean;
  page: number;
}
export const VQM_KITS: VQMKit[] = [
  { code: "F", name_sv: "D-sub-kontakt 25-polig", name_en: "D-sub connector (25 pins)", entry: true, cables: ["0", "1", "2", "3"], si_unit: false, stations: { "1": [2, 24], "2": [2, 24] }, ip65: false, page: 376, label_sv: "D-sub-kontakt 25-polig (2–24 platser)" },
  { code: "P", name_sv: "flatkabel 26-polig", name_en: "flat ribbon cable (26 pins)", entry: true, cables: ["0", "1", "2", "3"], si_unit: false, stations: { "1": [2, 24], "2": [2, 24] }, ip65: false, page: 380, label_sv: "Flatkabelkontakt 26-polig (2–24 platser)" },
  { code: "T0", name_sv: "plintlåda", name_en: "terminal block box", entry: false, cables: [], si_unit: false, stations: { "1": [2, 24], "2": [2, 20] }, ip65: true, page: 384, label_sv: "Plintlåda, IP65 (2–24 platser VQ1000, 2–20 VQ2000)" },
  { code: "L", name_sv: "kabel per station", name_en: "lead wire per station", entry: false, cables: ["0", "1", "2"], si_unit: false, stations: { "1": [1, 8], "2": [1, 8] }, ip65: true, page: 388, label_sv: "Kabel per station, IP65 (1–8 platser)" },
  { code: "S", name_sv: "seriell EX120/124", name_en: "serial transmission EX120/124", entry: false, cables: [], si_unit: true, stations: { "1": [2, 16], "2": [2, 16] }, ip65: true, page: 396, label_sv: "Seriell EX120/124, IP65 (2–16 platser)" },
  { code: "M", name_sv: "rundkontakt", name_en: "circular connector", entry: false, cables: ["0", "1", "2", "3"], si_unit: false, stations: { "2": [2, 24] }, ip65: true, page: 400, label_sv: "Rundkontakt, IP65 (bara VQ2000, 2–24 platser)" },
];

export const VQM_ENTRIES: VQMValue[] = [
  { code: "U", label_sv: "Anslutning uppåt (toppanslutning)" },
  { code: "S", label_sv: "Anslutning åt sidan" },
];
/** Kabellängd (sida 366, 370): F/P/M 0/1,5/3/5 m; L 0,6/1,5/3 m. */
export const VQM_CABLES: VQMValue[] = [
  { code: "0", label_sv: "Utan kabel (L-kit: 0,6 m kabel)" },
  { code: "1", label_sv: "Kabel 1,5 m" },
  { code: "2", label_sv: "Kabel 3 m" },
  { code: "3", label_sv: "Kabel 5 m (inte L-kit)" },
];
export interface VQMSiUnit extends VQMValue {
  protocol_sv: string;
  protocol_en: string;
}
/** SI-enhet i S-kitet (sida 370 och 397): 16 utgångar. */
export const VQM_SI_UNITS: VQMSiUnit[] = [
  { code: "0", protocol_sv: "utan SI-enhet", protocol_en: "without SI unit", label_sv: "Utan SI-enhet" },
  { code: "Q", protocol_sv: "DeviceNet", protocol_en: "DeviceNet", label_sv: "DeviceNet (EX120, 16 utgångar)" },
  { code: "V", protocol_sv: "CC-Link", protocol_en: "CC-Link", label_sv: "CC-Link (EX120, 16 utgångar)" },
  { code: "ZB", protocol_sv: "CompoNet, pluskommun", protocol_en: "CompoNet, positive common", label_sv: "CompoNet pluskommun (EX124, 16 utgångar)" },
  { code: "ZBN", protocol_sv: "CompoNet, minuskommun", protocol_en: "CompoNet, negative common", label_sv: "CompoNet minuskommun (EX124, 16 utgångar)" },
];

export const VQM_STATIONS: VQMValue[] = Array.from({ length: 24 }, (_, i) => i + 1).map((n) => ({
  code: String(n).padStart(2, "0"),
  label_sv: `Platser: ${n}${n === 1 ? " (bara L-kit)" : n > 16 ? " (inte S-kit)" : ""}`,
}));

export interface VQMPort extends VQMValue {
  size: string;
  style: "straight" | "up" | "down" | "mixed";
  inch: boolean;
  series: string[];
}
const port = (code: string, size: string, style: VQMPort["style"], series: string[], inch = false, note = ""): VQMPort =>
  ({ code, size, style, inch, series, label_sv: `${size}${style === "up" ? ", vinkel uppåt (topportad)" : style === "down" ? ", vinkel nedåt (bottenportad)" : ""}${note}` });
/** Cylinderportar (sida 366, 370 och 406). */
export const VQM_PORTS: VQMPort[] = [
  port("C3", "Snabbkoppling ø3,2", "straight", ["1"]),
  port("C4", "Snabbkoppling ø4", "straight", ["1", "2"]),
  port("C6", "Snabbkoppling ø6", "straight", ["1", "2"]),
  port("C8", "Snabbkoppling ø8", "straight", ["2"]),
  port("M5", "Gänga M5", "straight", ["1"], false, " (kopplingar medföljer lösa)"),
  port("CM", "Blandade storlekar och portpluggar", "mixed", ["1", "2"], false, " (specifikationsblad)"),
  port("L3", "Snabbkoppling ø3,2", "up", ["1"]),
  port("L4", "Snabbkoppling ø4", "up", ["1", "2"]),
  port("L6", "Snabbkoppling ø6", "up", ["1", "2"]),
  port("L8", "Snabbkoppling ø8", "up", ["2"]),
  port("L5", "Gänga M5", "up", ["1"]),
  port("B3", "Snabbkoppling ø3,2", "down", ["1"]),
  port("B4", "Snabbkoppling ø4", "down", ["1", "2"]),
  port("B6", "Snabbkoppling ø6", "down", ["1", "2"]),
  port("B8", "Snabbkoppling ø8", "down", ["2"]),
  port("B5", "Gänga M5", "down", ["1"]),
  port("LM", "Vinkelportar, blandade storlekar", "mixed", ["1", "2"], false, " (specifikationsblad)"),
  port("MM", "Blandade portar med tillval per station", "mixed", ["1", "2"], false, " (specifikationsblad)"),
  port("N1", "Snabbkoppling ø1/8\"", "straight", ["1"], true),
  port("N3", "Snabbkoppling ø5/32\"", "straight", ["1", "2"], true),
  port("N7", "Snabbkoppling ø1/4\"", "straight", ["1", "2"], true),
  port("N9", "Snabbkoppling ø5/16\"", "straight", ["2"], true),
  port("M5T", "Gänga 10-32 UNF", "straight", ["1"], true),
  port("NM", "Blandade tumstorlekar", "mixed", ["1", "2"], true, " (specifikationsblad)"),
];

export interface VQMOption extends VQMValue {
  /** Parametern i mallen. */
  param: string;
  series: string[];
  kits: string[];
  /** Kan inte kombineras med namnskylt N (sida 366, not 5 och 8). */
  not_with_nameplate: boolean;
}
const ALL_KITS = VQM_KITS.map((k) => k.code);
const o = (param: string, code: string, label: string, series = ["1", "2"], kits = ALL_KITS, nn = false): VQMOption =>
  ({ param, code, series, kits, not_with_nameplate: nn, label_sv: label });
/** Tillvalen (sida 366 och 370), i den ordning de skrivs i koden (alfabetiskt). */
export const VQM_OPTIONS: VQMOption[] = [
  o("ac", "2", "Ventiler för 200/220 V AC (bara F- och L-kit)", ["1", "2"], ["F", "L"]),
  o("check", "B", "Backventil mot mottryck på alla platser"),
  o("din", "D", "DIN-skena (ca 30 mm längre än rampen)"),
  o("din", "D0", "DIN-skenefästen utan skena"),
  ...Array.from({ length: 23 }, (_, i) => i + 2).map((n) => o("din", `D${String(n).padStart(2, "0")}`, `DIN-skena för ${n} stationer (längre än rampen)`)),
  o("regulator", "G1", "En regulatorenhet (VQ1000; placering på specifikationsblad)", ["1"], ALL_KITS, true),
  o("regulator", "G2", "Två regulatorenheter (VQ1000)", ["1"], ALL_KITS, true),
  o("regulator", "G3", "Tre regulatorenheter (VQ1000)", ["1"], ALL_KITS, true),
  o("ejector", "J", "Ejektorenhet (VQ1000, sida 418)", ["1"], ALL_KITS, true),
  o("wiring", "K", "Specialkoppling enligt specifikationsblad (inte L-kit)", ["1", "2"], ALL_KITS.filter((k) => k !== "L")),
  o("nameplate", "N", "Namnskylt"),
  o("ext_pilot", "R", "Extern pilot (X-port C4 VQ1000 / C6 VQ2000; ventilerna med R)"),
  o("silencer", "S", "Direkt avluftning med inbyggd ljuddämpare"),
  o("ip65", "W", "Kapsling IP65 (VQ2000, T/L/S/M-kit)", ["2"], ["T0", "L", "S", "M"]),
];
export const VQM_OPTION_PARAMS = ["ac", "check", "din", "regulator", "ejector", "wiring", "nameplate", "ext_pilot", "silencer", "ip65"] as const;
export const VQM_CE: VQMValue = { code: "Q", label_sv: "CE/UKCA-märkt (bara DC-ventiler)" };

export interface VQMConfig {
  series: string;
  stations: string;
  port: string;
  kit: string;
  entry?: string;
  cable?: string;
  si_unit?: string;
  ac?: string;
  check?: string;
  din?: string;
  regulator?: string;
  ejector?: string;
  wiring?: string;
  nameplate?: string;
  ext_pilot?: string;
  silencer?: string;
  ip65?: string;
  ce?: string;
}

export function vqmBuildCode(c: VQMConfig): string | null {
  const s = VQM_SERIES.find((x) => x.code === c.series);
  const k = VQM_KITS.find((x) => x.code === c.kit);
  if (!s || !k) return null;
  const range = k.stations[s.code];
  if (!range) return null;
  const st = VQM_STATIONS.find((x) => x.code === c.stations);
  if (!st) return null;
  const n = Number(st.code);
  if (n < range[0] || n > range[1]) return null;
  const p = VQM_PORTS.find((x) => x.code === c.port);
  if (!p || !p.series.includes(s.code)) return null;
  const entry = c.entry ?? "";
  const cable = c.cable ?? "";
  const si = c.si_unit ?? "";
  if (k.entry) {
    if (!VQM_ENTRIES.some((x) => x.code === entry)) return null;
  } else if (entry) return null;
  if (k.cables.length) {
    if (!k.cables.includes(cable)) return null;
  } else if (cable) return null;
  if (k.si_unit) {
    if (!VQM_SI_UNITS.some((x) => x.code === si)) return null;
  } else if (si) return null;
  const chosen: VQMOption[] = [];
  for (const param of VQM_OPTION_PARAMS) {
    const v = c[param] ?? "";
    if (!v) continue;
    const opt = VQM_OPTIONS.find((x) => x.param === param && x.code === v);
    if (!opt || !opt.series.includes(s.code) || !opt.kits.includes(k.code)) return null;
    chosen.push(opt);
  }
  if (chosen.some((x) => x.not_with_nameplate) && chosen.some((x) => x.param === "nameplate")) return null;
  const din = c.din ?? "";
  if (/^D\d\d$/.test(din) && Number(din.slice(1)) <= n) return null;
  const ce = c.ce ?? "";
  if (ce && ce !== VQM_CE.code) return null;
  // CE/UKCA bara för DC-ventiler (sida 366): inte med 200/220 V AC (2).
  if (ce && chosen.some((x) => x.param === "ac")) return null;
  const tail = chosen.map((x) => x.code).join("");
  return `VV5Q${s.code}1-${st.code}${p.code}${k.code}${entry}${cable}${si}${tail ? `-${tail}` : ""}${ce ? `-${ce}` : ""}`;
}

export function vqmParseCode(raw: string): { config: VQMConfig } | null {
  const k = raw.trim().toUpperCase();
  const mm = /^VV5Q([12])1-(\d{2})(C3|C4|C6|C8|M5T|M5|CM|L3|L4|L6|L8|L5|B3|B4|B6|B8|B5|LM|MM|N1|N3|N7|N9|NM)(F|P|T0|L|S|M)([US]?)([0-3]?)(0|Q|V|ZBN|ZB)?(?:-(2?)(B?)(D\d\d|D0|D)?(G[123])?(J?)(K?)(N?)(R?)(S?)(W?))?(?:-(Q))?$/.exec(k);
  if (!mm) return null;
  const [, series, stations, port, kit, entry, cable, si_unit, ac, check, din, regulator, ejector, wiring, nameplate, ext_pilot, silencer, ip65, ce] = mm;
  // "S0"/"SQ"/"SV": SI-enheten läses ur si_unit; för andra kit får gruppen inte fyllas.
  const c: VQMConfig = {
    series, stations, port, kit,
    entry: entry || undefined,
    cable: kit === "S" ? undefined : cable || undefined,
    si_unit: kit === "S" ? (si_unit || (cable === "0" ? "0" : undefined)) : undefined,
    ac: ac || undefined, check: check || undefined, din: din || undefined, regulator: regulator || undefined, ejector: ejector || undefined,
    wiring: wiring || undefined, nameplate: nameplate || undefined, ext_pilot: ext_pilot || undefined, silencer: silencer || undefined, ip65: ip65 || undefined,
    ce: ce || undefined,
  };
  if (vqmBuildCode(c) !== k) return null;
  return { config: c };
}

export const VQM_ORDER_CODE_TEMPLATE = "VV5Q{series}1-{stations}{port}{kit}{entry}{cable}{si_unit}-{ac}{check}{din}{regulator}{ejector}{wiring}{nameplate}{ext_pilot}{silencer}{ip65}-{ce}";

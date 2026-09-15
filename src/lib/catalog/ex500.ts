/**
 * SMC EX500 — fältbussystem, gateway-decentraliserat system 2 (128 punkter).
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Fieldbus System EX500 Series, Gateway Decentralized System 2
 *   (128 Points)" (katalogutdrag, 22 sidor, katalogsidor 1447–1476). Ligger
 *   i knowledge_chunks som source_file = 'smc-kat-ex500.pdf'.
 *     - systemöversikt, tillämpliga ventiler         sida 1448
 *     - GW-enhet How to Order och data               sida 1449
 *     - SI-enhet How to Order och data               sida 1451
 *     - ingångsenhet How to Order och data           sida 1452
 *     - grenkabel och Y-grenkontakt                  sida 1457
 *
 * VAD FAMILJEN ÄR. EX500 är inte en ventilramp med stationer utan ett
 * system av enheter runt en gateway: GW-enheten (protokollet), SI-enheter
 * (utgångsenhet som sätts på ventilrampen), ingångsenheter, grenkablar och
 * Y-grenkontakter. Varje enhet har sin egen beställnyckel; konfiguratorn
 * bygger EN enhet i taget. Ventilrampen (SY, VQC, S0700, SV, ZK2□A)
 * beställs med sin egen nyckel. Fältbusskablar EX9-AC, matningskablar
 * EX500-AP/EX9-AC, utgångs-/kraftblock EX9-OE/EX9-PE och övriga tillbehör
 * (sida 1454–1461) är egna artikeltabeller och ingår inte.
 *
 * Den gamla familjen hade mallen 'EX500-{stations}-{fieldbus}-{voltage}'
 * med protokoll (EtherCAT, IO-Link, PROFIBUS …) och spänningar (230 V AC)
 * som EX500 inte har, och produktraden SMC-EX500-Q011 "4-stations" finns
 * inte i katalogen.
 *
 * KODENS FORM:
 *
 *   EX500-G EN2            GW-enhet, protokoll EN2/PN2      (sida 1449)
 *   EX500-S103             SI-enhet                         (sida 1451)
 *   EX500-DXP A            ingångsenhet, kontakt A/B        (sida 1452)
 *   EX500-AC 030 - SSPS    grenkabel, längd och kontakter   (sida 1457)
 *   EX500-ACY01-S          Y-grenkontakt                    (sida 1457)
 */

export const EX500_SOURCE = {
  file: "smc-kat-ex500.pdf",
  edition: "SMC EX500 catalogue (catalogue pages 1447–1476)",
  title: "SMC Fieldbus System EX500 Series, Gateway Decentralized System 2 (128 Points)",
  brand: "SMC",
} as const;

export interface EX500Value {
  code: string;
  label_sv: string;
}

export interface EX500Unit extends EX500Value {
  /** Vad nyckeln kräver efter enhetskoden. */
  needs: "protocol" | "connector" | "cable" | null;
  /** Kapslingsklass (sida 1449, 1451, 1452). */
  ip?: string;
  page: number;
}
export const EX500_UNITS: EX500Unit[] = [
  { code: "G", needs: "protocol", ip: "IP65", page: 1449, label_sv: "Gateway-enhet (GW): 4 grenportar, 128 ingångar/128 utgångar, webbserver" },
  { code: "S103", needs: null, ip: "IP67", page: 1451, label_sv: "SI-enhet: utgångsenhet för ventilrampen (SY, VQC, S0700, SV, ZK2□A), 16 eller 32 utgångar PNP" },
  { code: "DXP", needs: "connector", ip: "IP67", page: 1452, label_sv: "Ingångsenhet: 16 PNP-ingångar" },
  { code: "AC", needs: "cable", page: 1457, label_sv: "Grenkabel GW-enhet ↔ SI-/ingångsenhet, M12 8-polig A-kodad" },
  { code: "ACY01-S", needs: null, page: 1457, label_sv: "Y-grenkontakt för separat ventilmatning till SI-enheten" },
];
export const EX500_PROTOCOLS: EX500Value[] = [
  { code: "EN2", label_sv: "EtherNet/IP: 100BASE-TX 10/100 Mbit/s, DLR, QuickConnect, EDS-fil, 20/20 byte I/O" },
  { code: "PN2", label_sv: "PROFINET IO: 100BASE-TX 100 Mbit/s, MRP, Fast Start Up, GSDML-fil, 18/16 byte I/O" },
];
export const EX500_CONNECTORS: EX500Value[] = [
  { code: "A", label_sv: "M8-kontakter, 3-poliga (16 st), 250 g" },
  { code: "B", label_sv: "M12-kontakter, 5-poliga (16 st), 450 g" },
];
/** Grenkabelns längder (sida 1457). */
export const EX500_LENGTHS: EX500Value[] = [
  { code: "003", label_sv: "300 mm" },
  { code: "005", label_sv: "500 mm" },
  { code: "010", label_sv: "1000 mm" },
  { code: "030", label_sv: "3000 mm" },
  { code: "050", label_sv: "5000 mm" },
  { code: "100", label_sv: "10 000 mm" },
];
export const EX500_CABLE_CONNECTORS: EX500Value[] = [
  { code: "SSPS", label_sv: "Rak hylsa och rak plugg" },
  { code: "SAPA", label_sv: "Vinklad hylsa och vinklad plugg" },
];

export const EX500_LIMITS = {
  /** Sida 1448–1449. */
  io_points: 128,
  branch_ports: 4,
  per_branch_io: 32,
  branch_cable_max_m: 20,
  manifolds_max: 8,
  input_units_max: 8,
  per_branch_units_max: 2,
  temp_c: [-10, 50],
  supply_vdc: 24,
} as const;

export interface EX500Config {
  unit: string;
  protocol?: string;
  connector?: string;
  length?: string;
  cable_conn?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string) => lista.some((v) => v.code === kod);

export function ex500BuildCode(c: EX500Config): string | null {
  const unit = EX500_UNITS.find((u) => u.code === c.unit);
  if (!unit) return null;
  const protocol = c.protocol ?? "";
  const connector = c.connector ?? "";
  const length = c.length ?? "";
  const cable = c.cable_conn ?? "";
  if (unit.needs === "protocol" ? !har(EX500_PROTOCOLS, protocol) : protocol) return null;
  if (unit.needs === "connector" ? !har(EX500_CONNECTORS, connector) : connector) return null;
  if (unit.needs === "cable" ? !(har(EX500_LENGTHS, length) && har(EX500_CABLE_CONNECTORS, cable)) : length || cable) return null;
  return `EX500-${unit.code}${protocol}${connector}${length}${cable ? `-${cable}` : ""}`;
}

export function ex500ParseCode(raw: string): { config: EX500Config } | null {
  const k = raw.trim().toUpperCase();
  const m = /^EX500-(?:(G)(EN2|PN2)|(S103)|(DXP)([AB])|(AC)(003|005|010|030|050|100)-(SSPS|SAPA)|(ACY01-S))$/.exec(k);
  if (!m) return null;
  const [, g, protocol, s103, dxp, connector, ac, length, cable, y] = m;
  const c: EX500Config = {
    unit: g ?? s103 ?? dxp ?? ac ?? y,
    protocol: protocol || undefined,
    connector: connector || undefined,
    length: length || undefined,
    cable_conn: cable || undefined,
  };
  if (ex500BuildCode(c) !== k) return null;
  return { config: c };
}

export const EX500_ORDER_CODE_TEMPLATE = "EX500-{unit}{protocol}{connector}{length}-{cable_conn}";

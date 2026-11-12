/**
 * Cylinderräknaren: kraft och luftförbrukning för en pneumatisk cylinder.
 *
 * Samma kraftmodell som maskinbyggaren (physics.ts och motorns signals.ts):
 * teoretisk kraft = π/4 · d² · P, användbar kraft = teoretisk · 0,75, och
 * kraftkravet för en last = massa · 9,81 · 2. Luftförbrukningen följer guiden
 * "Beräkna luftförbrukning": slagvolym · (P + 1,013) / 1,013, båda
 * slagriktningarna. Här räknas kolvstången bort på returslaget, så värdet
 * blir något lägre än guidens överslag som räknar hela kolvarean två gånger.
 */
import { LOAD_SAFETY_FACTOR, SEAL_EFFICIENCY, STANDARD_BORES } from "./physics";

/** Kolvstångens diameter enligt ISO 6432 (Ø8–25) och ISO 15552 (Ø32–320). */
const KOLVSTANG: Record<number, number> = {
  8: 4, 10: 4, 12: 6, 16: 6, 20: 8, 25: 10,
  32: 12, 40: 16, 50: 20, 63: 20, 80: 25, 100: 25, 125: 32, 160: 40, 200: 40, 250: 50, 320: 63,
};

export function standardKolvstang(borrMm: number): number | null {
  return KOLVSTANG[borrMm] ?? null;
}

export interface Indata {
  borrMm: number;
  tryckBar: number;
  slagMm: number;
  cyklerPerMin: number;
  /** 0 = ingen last angiven. */
  lastKg: number;
  /** 0 = ingen kolvstång (eller okänd). */
  kolvstangMm: number;
}

export interface Resultat {
  teoretiskUtN: number;
  teoretiskInN: number;
  anvandbarUtN: number;
  anvandbarInN: number;
  /** Kraftkravet för lasten med säkerhetsfaktor, 0 utan last. */
  kravN: number;
  /** Räcker den användbara kraften ut för kravet? null utan last. */
  racker: boolean | null;
  /** Minsta standardborrning som klarar kravet vid trycket, null utan last eller om ingen räcker. */
  minstaBorrMm: number | null;
  /** Normalliter per dubbelslag (ut och in). */
  nlPerCykel: number;
  nlPerMin: number;
  /** Ungefärlig elenergi för att producera luften, kWh per timme (0,10–0,12 kWh/Nm³). */
  kwhPerTimme: [number, number];
}

const ATM = 1.013;

function area(dMm: number): number {
  return Math.PI / 4 * dMm * dMm; // mm²
}

export function rakna(x: Indata): Resultat {
  const d = Math.max(0, x.borrMm);
  const stang = Math.min(Math.max(0, x.kolvstangMm), d);
  const p = Math.max(0, x.tryckBar);
  const aUt = area(d);
  const aIn = aUt - area(stang);
  const teoretiskUtN = aUt * p * 0.1;
  const teoretiskInN = aIn * p * 0.1;
  const kravN = x.lastKg > 0 ? x.lastKg * 9.81 * LOAD_SAFETY_FACTOR : 0;
  const anvandbarUtN = teoretiskUtN * SEAL_EFFICIENCY;
  const minstaBorrMm = kravN > 0 && p > 0
    ? STANDARD_BORES.find((b) => area(b) * p * 0.1 * SEAL_EFFICIENCY >= kravN) ?? null
    : null;
  const kompression = (p + ATM) / ATM;
  const literUt = aUt * x.slagMm / 1e6;
  const literIn = aIn * x.slagMm / 1e6;
  const nlPerCykel = (literUt + literIn) * kompression;
  const nlPerMin = nlPerCykel * Math.max(0, x.cyklerPerMin);
  const nm3PerTimme = nlPerMin * 60 / 1000;
  return {
    teoretiskUtN, teoretiskInN,
    anvandbarUtN, anvandbarInN: teoretiskInN * SEAL_EFFICIENCY,
    kravN,
    racker: kravN > 0 ? anvandbarUtN >= kravN : null,
    minstaBorrMm,
    nlPerCykel, nlPerMin,
    kwhPerTimme: [nm3PerTimme * 0.10, nm3PerTimme * 0.12],
  };
}

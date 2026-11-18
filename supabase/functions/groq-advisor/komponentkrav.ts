/**
 * Krav per alternativ för komponenter som inte är aktuatorer: stötdämparens
 * energikapacitet, ventilöns fältbuss och dess antal ventilplatser.
 *
 * Provkörningen mot drift 2026-11-17/18 visade att de aldrig prövades:
 * ett pallstopp på ≈ 36 J fick en M8-dämpare på 2,94 J som "Minsta", och en
 * ventilö för 8 cylindrar med PROFINET fick en IO-Link-ö utan förbehåll.
 * Värdena fanns i product_specs (energy_j, fieldbus, stations) men nådde inte
 * motorn förrän katalogfunktionen skickade vidare dem (migration
 * 20261118160000).
 *
 * Ingen nätverks-, Deno.env- eller Supabase-åtkomst här.
 */
import type { CatalogProduct } from "./scoring.ts";

export type Komponentrad = { krav: string; utfall: "uppfyllt" | "ej_uppfyllt" | "kan_inte_bedomas"; text: string };

const tal = (v: unknown): number => {
  const m = String(v ?? "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
};
const visa = (n: number, sv: boolean) => (sv ? String(n).replace(".", ",") : String(n));

// ── Stötdämpare ─────────────────────────────────────────────────────────────

/** Energikapacitet per slag i J ur katalogen (energy_j), 0 när den saknas. */
export function dampenergiJ(p: CatalogProduct): number {
  return tal(p.key_specs?.energy_j);
}

export function provaDampenergi(energiJ: number, p: CatalogProduct, sv: boolean): Komponentrad {
  const e = Math.round(energiJ * 10) / 10;
  const krav = sv ? `energi ≈ ${visa(e, sv)} J per slag` : `energy ≈ ${visa(e, sv)} J per cycle`;
  const kap = dampenergiJ(p);
  if (!(kap > 0)) {
    return { krav, utfall: "kan_inte_bedomas", text: sv ? "katalogen anger ingen energikapacitet för dämparen" : "the catalogue gives no energy capacity for the absorber" };
  }
  return kap >= energiJ
    ? { krav, utfall: "uppfyllt", text: sv ? `dämparen tar upp ${visa(kap, sv)} J per slag` : `the absorber takes ${visa(kap, sv)} J per cycle` }
    : { krav, utfall: "ej_uppfyllt", text: sv ? `dämparen tar bara upp ${visa(kap, sv)} J per slag` : `the absorber only takes ${visa(kap, sv)} J per cycle` };
}

/**
 * Dämparna att visa: de som klarar energin (minsta först), sedan de med okänd
 * kapacitet. Klarar ingen med känd kapacitet energin visas den största av dem
 * ändå, så att skalan syns, och anroparen säger att det behövs en kundlösning.
 */
export function valjDampare(dampare: CatalogProduct[], energiJ: number, antal = 4): { val: CatalogProduct[]; nagonRacker: boolean } {
  const kanda = dampare.filter((p) => dampenergiJ(p) > 0).sort((a, b) => dampenergiJ(a) - dampenergiJ(b));
  const okanda = dampare.filter((p) => !(dampenergiJ(p) > 0));
  const racker = kanda.filter((p) => dampenergiJ(p) >= energiJ);
  if (racker.length) return { val: [...racker, ...okanda].slice(0, antal), nagonRacker: true };
  const storsta = kanda.length ? [kanda[kanda.length - 1]] : [];
  return { val: [...storsta, ...okanda].slice(0, antal), nagonRacker: false };
}

// ── Ventilöar ───────────────────────────────────────────────────────────────

const BUSSAR: Array<[RegExp, string]> = [
  [/profinet/i, "PROFINET"],
  [/ethernet\s*\/?\s*ip\b/i, "EtherNet/IP"],
  [/ethercat/i, "EtherCAT"],
  [/io-?link/i, "IO-Link"],
  [/profibus/i, "PROFIBUS"],
  [/devicenet/i, "DeviceNet"],
  [/cc-?link/i, "CC-Link"],
  [/modbus/i, "Modbus"],
  [/canopen/i, "CANopen"],
  [/\bas-?i\b|as-interface/i, "AS-i"],
];

/** Fältbussen kunden nämner, eller null. */
export function begardFaltbuss(text: string): string | null {
  for (const [re, namn] of BUSSAR) if (re.test(text)) return namn;
  return null;
}

/** Fältbussarna artikeln anges för (fieldbus-specen och namnet). */
export function faltbussar(p: CatalogProduct): string[] {
  const t = `${p.key_specs?.fieldbus ?? ""} ${p.name ?? ""}`;
  return BUSSAR.filter(([re]) => re.test(t)).map(([, namn]) => namn);
}

export function provaFaltbuss(buss: string, p: CatalogProduct, sv: boolean): Komponentrad {
  const krav = sv ? `fältbuss ${buss}` : `fieldbus ${buss}`;
  const har = faltbussar(p);
  if (!har.length) {
    return { krav, utfall: "kan_inte_bedomas", text: sv ? "katalogen anger ingen fältbuss för artikeln" : "the catalogue gives no fieldbus for the item" };
  }
  return har.includes(buss)
    ? { krav, utfall: "uppfyllt", text: sv ? `artikeln finns för ${buss}` : `the item is available for ${buss}` }
    : { krav, utfall: "ej_uppfyllt", text: sv ? `artikeln anges för ${har.join(", ")}` : `the item is specified for ${har.join(", ")}` };
}

/**
 * Antal ventilplatser som behövs: svaret på frågan om antal ventiler går
 * först, annars texten ("8 ventiler", "för 8 dubbelverkande cylindrar" --
 * varje dubbelverkande cylinder styrs av en ventil). 0 när inget anges.
 */
export function begardaVentilplatser(text: string, answers: Record<string, string> = {}): number {
  for (const [k, v] of Object.entries(answers)) {
    if (/ventil_antal|number_of_valves|antal_ventiler|valve_count/i.test(k)) {
      const n = tal(v);
      if (n >= 1 && n <= 64) return Math.round(n);
    }
  }
  const m = text.match(/(\d{1,2})\s*(?:st\.?\s+)?(?:ventiler|ventilplatser|valves|valve stations|stationer|stations|platser|ventile|válvulas)\b/i)
    ?? text.match(/\b(?:för|for|für|para)\s+(\d{1,2})\s+(?:[\wåäöéáíóú-]+\s+){0,2}(?:cylindrar|cylinders|zylinder|cilindros)\b/i);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 64 ? n : 0;
}

/**
 * Högsta antal ventilplatser artikeln kan ha: stations/max_stations, namnet
 * ("8 stations", "12-station", "4 stationer") eller "Up to 16 valve stations".
 * Ett spann ("8 (manifold available with 2–24)") ger spannets största värde --
 * ön byggs med det antal som behövs. 0 när inget anges.
 */
export function ventilplatser(p: CatalogProduct): number {
  const ks = p.key_specs ?? {};
  for (const v of [ks.max_stations, ks.stations]) {
    const s = String(v ?? "");
    const spann = s.match(/(\d+)\s*[–-]\s*(\d+)/);
    if (spann) return Math.max(Number(spann[1]), Number(spann[2]));
    if (tal(s) > 0) return tal(s);
  }
  const t = `${p.name ?? ""} ${ks.special_features ?? ""}`;
  const m = t.match(/(?:up to\s+)?(\d{1,2})[\s-]*(?:valve\s+)?(?:stations?|stationer|station|platser)\b/i);
  return m ? Number(m[1]) : 0;
}

export function provaVentilplatser(behov: number, p: CatalogProduct, sv: boolean): Komponentrad {
  const krav = sv ? `${behov} ventilplatser` : `${behov} valve stations`;
  const har = ventilplatser(p);
  if (!(har > 0)) {
    return { krav, utfall: "kan_inte_bedomas", text: sv ? "katalogen anger inte antalet ventilplatser" : "the catalogue does not give the number of valve stations" };
  }
  return har >= behov
    ? { krav, utfall: "uppfyllt", text: sv ? `ön har upp till ${har} platser` : `the terminal has up to ${har} stations` }
    : { krav, utfall: "ej_uppfyllt", text: sv ? `ön har bara ${har} platser` : `the terminal only has ${har} stations` };
}

/**
 * Hur väl en ventilö passar: fältbussen väger tyngst, sedan platserna. Okänt
 * räknas som hälften, så en ö som säkert uppfyller kravet går före en okänd.
 */
export function ventilpoang(p: CatalogProduct, buss: string | null, behov: number): number {
  let poang = 0;
  if (buss) {
    const har = faltbussar(p);
    poang += har.includes(buss) ? 4 : har.length ? 0 : 2;
  }
  if (behov > 0) {
    const har = ventilplatser(p);
    poang += har >= behov ? 2 : har > 0 ? 0 : 1;
  }
  return poang;
}

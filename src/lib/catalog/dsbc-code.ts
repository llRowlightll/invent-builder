/**
 * Parsning, serialisering och validering av DSBC-orderkoder.
 *
 * Detta är vägen från "kunden skickade DSBC-50-100-PPSA-N3" till en struktur
 * systemet kan räkna på. Utan den kunde sökningen bara mönstermatcha texten,
 * och rådgivaren svarade en gång att "N3-klassningen motsvarar IP67" och
 * föreslog en Ø32 mot ett Ø50-krav -- 41 % av kraften. Båda felen är
 * strukturellt omöjliga när koden slås upp istället för tolkas.
 *
 * KRAFT LAGRAS INTE. theoreticalForceN() reproducerar Festos egen tabell exakt
 * för alla sju borrningar (483/754/1178/1870/3016/4712/7363 N vid 6 bar), så
 * siffrorna hör hemma i en funktion, inte i en databas där de kan drifta.
 */
import { DSBC_POSITIONS, DSBC_RULES, DSBC_SERIES } from "./dsbc";
// Relativ sökväg, inte @-aliaset: filen typkontrolleras och testas av
// `deno test` i CI, och Deno känner inte till Vites aliasupplösning.
import { evalLogic } from "../configurator-engine";

export type DsbcConfig = Record<string, string | number>;

export interface DsbcParseResult {
  ok: boolean;
  config: DsbcConfig;
  /** Segment som inte gick att placera i någon position. */
  unknown: string[];
}

const NUMERIC_KEYS = new Set(
  DSBC_POSITIONS.filter((p) => p.values === null).map((p) => p.key),
);

/** Tom konfiguration med varje position satt till sitt standardvärde. */
export function emptyConfig(): DsbcConfig {
  const c: DsbcConfig = {};
  for (const p of DSBC_POSITIONS) {
    c[p.key] = p.values === null ? 0 : (p.values[0]?.code ?? "");
  }
  return c;
}

/**
 * Delar upp en orderkod i sina positioner.
 *
 * Koden är inte positionell utan nyckelbaserad: bara valda optioner står med,
 * och de står i typkodens ordning. Därför matchas varje segment mot den
 * position som äger koden -- vi kan inte räkna segment.
 *
 * `DSBC-32-20-D3-PPVA-N3` -> bore 32, slag 20, profil D3, dämpning PPV,
 * givare A, standard N3.
 */
export function parseDsbcCode(raw: string): DsbcParseResult {
  const trimmed = raw.trim().toUpperCase();
  const config = emptyConfig();
  const unknown: string[] = [];

  const segments = trimmed.split("-").filter((s) => s.length > 0);
  if (segments[0] !== DSBC_SERIES) {
    return { ok: false, config, unknown: segments };
  }

  // Borrning och slaglängd är de två första numeriska segmenten, i den
  // ordningen. Övriga tal bär alltid ett suffix (500E, 35L) och är därmed
  // skiljbara.
  let numericSeen = 0;
  const codeOwners = new Map<string, string>();
  for (const p of DSBC_POSITIONS) {
    if (p.values === null) continue;
    for (const v of p.values) {
      if (v.code) codeOwners.set(v.code, p.key);
    }
  }

  for (const seg of segments.slice(1)) {
    if (/^\d+$/.test(seg)) {
      if (numericSeen === 0) config.bore_mm = seg;
      else if (numericSeen === 1) config.stroke_mm = Number(seg);
      else unknown.push(seg);
      numericSeen++;
      continue;
    }

    // Numeriskt med suffix: 500E (kolvstångsförlängning), 35L (gängförlängning).
    const suffixed = seg.match(/^(\d+)([A-Z]+)$/);
    if (suffixed) {
      const pos = DSBC_POSITIONS.find((p) => p.numeric_suffix === suffixed[2]);
      if (pos) {
        config[pos.key] = Number(suffixed[1]);
        continue;
      }
    }

    if (codeOwners.has(seg)) {
      config[codeOwners.get(seg)!] = seg;
      continue;
    }

    // Sammansatta segment: PPVA = PPV (dämpning) + A (givare), PPSA likaså.
    // Festo slår ihop position 011 och 012 i den tryckta koden.
    const merged = matchMergedSegment(seg, codeOwners);
    if (merged) {
      Object.assign(config, merged);
      continue;
    }

    unknown.push(seg);
  }

  return { ok: unknown.length === 0 && numericSeen >= 2, config, unknown };
}

/**
 * Löser ett segment som bär flera positioners koder ihopskrivna, t.ex. PPVA.
 * Provar längsta prefix först så att PPV vinner över P.
 */
function matchMergedSegment(
  seg: string,
  codeOwners: Map<string, string>,
): DsbcConfig | null {
  const codes = [...codeOwners.keys()].sort((a, b) => b.length - a.length);
  const out: DsbcConfig = {};
  let rest = seg;
  while (rest.length > 0) {
    const hit = codes.find((c) => rest.startsWith(c));
    if (!hit) return null;
    out[codeOwners.get(hit)!] = hit;
    rest = rest.slice(hit.length);
  }
  return Object.keys(out).length > 1 ? out : null;
}

/**
 * Bygger orderkoden ur en konfiguration.
 *
 * Dämpning och givare skrivs ihop (PPV + A -> PPVA) eftersom det är så Festo
 * trycker dem; alla 455 verifierade lagerkoder ser ut så.
 */
export function buildDsbcCode(config: DsbcConfig): string {
  const parts: string[] = [DSBC_SERIES];

  for (const p of DSBC_POSITIONS) {
    const raw = config[p.key];

    if (p.values === null) {
      const n = Number(raw ?? 0);
      if (p.key === "stroke_mm") {
        parts.push(String(n));
        continue;
      }
      if (n > 0 && p.numeric_suffix) parts.push(`${n}${p.numeric_suffix}`);
      continue;
    }

    const code = String(raw ?? "");
    if (!code) continue;

    if (p.key === "bore_mm") {
      parts.push(code);
      continue;
    }
    // Givaren fogas till dämpningen istället för att bli ett eget segment.
    if (p.key === "sensing") {
      parts[parts.length - 1] += code;
      continue;
    }
    parts.push(code);
  }

  return parts.join("-");
}

export interface DsbcValidation {
  ok: boolean;
  errors: Array<{ note: string; message_sv: string; message_en: string }>;
  warnings: Array<{ note: string; message_sv: string; message_en: string }>;
}

/**
 * Kör katalogens 18 villkor mot en konfiguration.
 *
 * Använder samma evalLogic som configurator-engine redan har -- motorn fanns,
 * den var bara aldrig inkopplad på familjespåret.
 */
export function validateDsbc(config: DsbcConfig): DsbcValidation {
  const errors: DsbcValidation["errors"] = [];
  const warnings: DsbcValidation["warnings"] = [];

  for (const r of DSBC_RULES) {
    if (evalLogic(r.when, config)) {
      const entry = { note: r.note, message_sv: r.message_sv, message_en: r.message_en };
      (r.severity === "error" ? errors : warnings).push(entry);
    }
  }

  // Positionernas egna gränser, utöver kombinationsreglerna.
  for (const p of DSBC_POSITIONS) {
    const v = config[p.key];
    if (p.values === null && p.range) {
      const n = Number(v ?? 0);
      const required = p.key === "stroke_mm";
      if (required && (n < p.range.min || n > p.range.max)) {
        errors.push({
          note: p.pos,
          message_sv: `${p.label_sv} måste vara ${p.range.min}–${p.range.max} ${p.range.unit}.`,
          message_en: `${p.key} must be ${p.range.min}–${p.range.max} ${p.range.unit}.`,
        });
      }
      if (!required && n > p.range.max) {
        errors.push({
          note: p.pos,
          message_sv: `${p.label_sv} är max ${p.range.max} ${p.range.unit}.`,
          message_en: `${p.key} is limited to ${p.range.max} ${p.range.unit}.`,
        });
      }
    } else if (p.values && v !== undefined) {
      const code = String(v);
      if (code && !p.values.some((x) => x.code === code)) {
        errors.push({
          note: p.pos,
          message_sv: `"${code}" är inget giltigt värde för ${p.label_sv}.`,
          message_en: `"${code}" is not a valid value for ${p.key}.`,
        });
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** ISO 15552-kolvstångsdiameter per borrning, ur katalogens måttabell. */
const ROD_DIAMETER_MM: Record<number, number> = {
  32: 12, 40: 16, 50: 20, 63: 20, 80: 25, 100: 25, 125: 32,
};

/**
 * Teoretisk kraft ut vid givet tryck. Reproducerar Festos tabell exakt:
 * Ø32=483, Ø40=754, Ø50=1178, Ø63=1870, Ø80=3016, Ø100=4712, Ø125=7363 N.
 */
export function theoreticalForceN(boreMm: number, pressureBar = 6): number {
  return Math.round((Math.PI / 4) * boreMm * boreMm * pressureBar * 0.1);
}

/**
 * Teoretisk kraft in -- ringytan, alltså minus kolvstångens area.
 * Festo: Ø32=415, Ø40=633, Ø50=990, Ø63=1682, Ø80=2721, Ø100=4418, Ø125=6881 N.
 */
export function theoreticalRetractForceN(boreMm: number, pressureBar = 6): number {
  const rod = ROD_DIAMETER_MM[boreMm];
  if (!rod) return 0;
  const area = (Math.PI / 4) * (boreMm * boreMm - rod * rod);
  return Math.round(area * pressureBar * 0.1);
}

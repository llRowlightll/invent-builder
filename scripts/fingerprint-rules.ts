/**
 * Fingeravtryck av en familjs genererade regler.
 *
 * Finns för att kunna jämföra det som ligger I DATABASEN med det modellen
 * producerar, utan att skicka 17 kB JSON fram och tillbaka. Samma summa i båda
 * ändar betyder att migrationen bär exakt de regler generatorn skrev.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/fingerprint-rules.ts elektro
 *
 * Motsvarande SQL:
 *   select md5(string_agg(severity || message_sv || message_en ||
 *                         coalesce(goto_step, ''), '' order by
 *                         severity || message_sv || message_en ||
 *                         coalesce(goto_step, '')))
 *   from config_rules where schema_id = '<SCHEMA>';
 *
 * if_json ingår INTE i summan: Postgres normaliserar jsonb (nycklar sorterade,
 * inget blanktecken) medan JSON.stringify behåller insättningsordningen, så
 * texterna skiljer sig utan att innehållet gör det. Villkoren kontrolleras i
 * stället av regeltesterna, som kör dem genom samma evalLogic som produktionen.
 */
import { buildElektroDbRules } from "../src/lib/catalog/elektro-db-rules.ts";
import { buildCcivDbRules } from "../src/lib/catalog/cciv-db-rules.ts";
import { buildEpcoDbRules } from "../src/lib/catalog/epco-db-rules.ts";
import { buildMfhDbRules } from "../src/lib/catalog/mfh-db-rules.ts";
import { buildHmrDbRules } from "../src/lib/catalog/hmr-db-rules.ts";
import { buildOspeDbRules } from "../src/lib/catalog/osp-e-db-rules.ts";
import { OSPE_VARIANTS } from "../src/lib/catalog/osp-e.ts";
import { buildCq2DbRules } from "../src/lib/catalog/cq2-db-rules.ts";
import { buildMxsDbRules } from "../src/lib/catalog/mxs-db-rules.ts";
import { buildC85DbRules } from "../src/lib/catalog/c85-db-rules.ts";
import { buildCj2DbRules } from "../src/lib/catalog/cj2-db-rules.ts";
import { buildCjpDbRules } from "../src/lib/catalog/cjp-db-rules.ts";
import { buildZhDbRules } from "../src/lib/catalog/zh-db-rules.ts";
import { buildCm2DbRules } from "../src/lib/catalog/cm2-db-rules.ts";
import { buildCp96DbRules } from "../src/lib/catalog/cp96-db-rules.ts";
import { buildCs1DbRules } from "../src/lib/catalog/cs1-db-rules.ts";
import { buildCy1DbRules } from "../src/lib/catalog/cy1-db-rules.ts";
import { CY1_SERIES_LIST } from "../src/lib/catalog/cy1.ts";
import { buildEx500DbRules } from "../src/lib/catalog/ex500-db-rules.ts";
import { buildLeshDbRules } from "../src/lib/catalog/lesh-db-rules.ts";
import { buildLeyDbRules } from "../src/lib/catalog/ley-db-rules.ts";
import { buildMbDbRules } from "../src/lib/catalog/mb-db-rules.ts";
import { buildMhc2DbRules } from "../src/lib/catalog/mhc2-db-rules.ts";
import { buildMhz2DbRules } from "../src/lib/catalog/mhz2-db-rules.ts";
import { buildVfDbRules } from "../src/lib/catalog/vf-db-rules.ts";

const BYGGARE: Record<string, () => Array<Record<string, unknown>>> = {
  elektro: buildElektroDbRules,
  cciv: buildCcivDbRules,
  epco: buildEpcoDbRules,
  mfh: buildMfhDbRules,
  hmr: buildHmrDbRules,
  // OSP-E är sju familjer ur en modell: osp-e-b, -sb, -st, -sbr, -str, -bhd, -bv.
  ...Object.fromEntries(OSPE_VARIANTS.map((v) => [v.slug, () => buildOspeDbRules(v.slug)])),
  cq2: buildCq2DbRules,
  mxs: buildMxsDbRules,
  c85: buildC85DbRules,
  cj2: buildCj2DbRules,
  cjp: buildCjpDbRules,
  zh: buildZhDbRules,
  cm2: buildCm2DbRules,
  cp96: buildCp96DbRules,
  cs1: buildCs1DbRules,
  // CY1 är fyra familjer ur en modell: cy1s, cy1l, cy1h, cy1f.
  ...Object.fromEntries(CY1_SERIES_LIST.map((k) => [k, () => buildCy1DbRules(k)])),
  ex500: buildEx500DbRules,
  lesh: buildLeshDbRules,
  ley: buildLeyDbRules,
  mb: buildMbDbRules,
  mhc2: buildMhc2DbRules,
  mhz2: buildMhz2DbRules,
  vf3000: buildVfDbRules,
};

const namn = Deno.args[0] ?? "";
const bygg = BYGGARE[namn];
if (!bygg) {
  console.error(`okänd familj: ${namn || "(ingen)"}. Finns: ${Object.keys(BYGGARE).join(", ")}`);
  Deno.exit(1);
}

const regler = bygg();
const rader = regler
  .map((r) => `${r.severity}${r.message_sv}${r.message_en}${r.goto_step ?? ""}`)
  .sort();

// SORTERINGEN FÅR INTE BERO PÅ KOLLATIONERING. Postgres sorterar text efter
// databasens lokal; JavaScript sorterar efter UTF-16-kodenheter. För strängar
// med "Ø" och tankstreck ger de olika ordning, och då skiljer sig summan utan
// att innehållet gör det. Därför hashas VARJE rad för sig, och de sorterade
// hexsummorna -- ren ASCII -- är det som hashas ihop. Den ordningen är
// densamma överallt.
import { createHash } from "node:crypto";

const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");
const perRad = rader.map(md5).sort();

/**
 * Serialiserar som Postgres jsonb gör det, så villkoren går att jämföra.
 *
 * jsonb är inte text utan en normaliserad struktur: objektnycklar sorteras
 * efter LÄNGD först och därefter byte för byte, blanktecken finns inte, och
 * arrayer behåller sin ordning. JSON.stringify behåller i stället
 * insättningsordningen. Utan den här funktionen skiljer sig texterna åt trots
 * att innehållet är detsamma.
 */
function somJsonb(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return `[${v.map(somJsonb).join(", ")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const nycklar = Object.keys(o).sort((a, b) =>
      a.length !== b.length ? a.length - b.length : (a < b ? -1 : a > b ? 1 : 0)
    );
    return `{${nycklar.map((k) => `${JSON.stringify(k)}: ${somJsonb(o[k])}`).join(", ")}}`;
  }
  return JSON.stringify(v);
}

const villkor = regler.map((r) => md5(somJsonb(r.if_json))).sort();

console.log(`familj:  ${namn}`);
console.log(`regler:  ${regler.length}`);
console.log(`fel:     ${regler.filter((r) => r.severity === "error").length}`);
console.log(`varning: ${regler.filter((r) => r.severity === "warn").length}`);
console.log(`tecken:  ${rader.join("").length}`);
console.log(`md5:     ${md5(perRad.join(""))}`);
console.log(`villkor: ${md5(villkor.join(""))}`);

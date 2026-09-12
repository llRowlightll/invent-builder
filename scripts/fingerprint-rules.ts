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

const BYGGARE: Record<string, () => Array<Record<string, unknown>>> = {
  elektro: buildElektroDbRules,
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

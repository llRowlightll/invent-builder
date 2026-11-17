import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  dokumentInomBudget,
  forStorBegaran,
  lasTpmTak,
  STANDARD_TPM_TAK,
  uppskattaTokens,
  UTDRAGSSKILJE,
} from "./tokenbudget.ts";

const utdrag = (langder: number[]) =>
  langder.map((n, i) => `[Metal Work — katalog-${i}.pdf]\n` + "x".repeat(n)).join(UTDRAGSSKILJE);
const delar = (docs: string) => (docs === "" ? [] : docs.split(UTDRAGSSKILJE));
const nummer = (d: string) => Number(d.match(/katalog-(\d+)/)?.[1]);

Deno.test("begäran ryms: dokument + resten + svarsbudget under taket med marginal", () => {
  const ovrigt = "p".repeat(9000);
  const docs = dokumentInomBudget(utdrag([1300, 1300, 1300, 1300, 1300]), ovrigt, 2200, 8000);
  const totalt = uppskattaTokens(ovrigt) + uppskattaTokens(docs) + 2200;
  assert(totalt <= 8000 - 800 + 10, `begäran ${totalt} tokens`);
  assert(delar(docs).length >= 1, "minst ett utdrag ska få plats här");
});

Deno.test("stora utdrag först: de hoppas över och mindre längre ned följer med, i ordning", () => {
  // Så ser drift ut: Metal Works katalogutdrag på 3–4 000 tecken först.
  const docs = dokumentInomBudget(utdrag([4000, 3800, 900, 3900, 700]), "p".repeat(9000), 2200, 8000);
  const valda = delar(docs).map(nummer);
  assert(valda.length > 0, "de små utdragen ska komma med");
  assert(valda.includes(2) && valda.includes(4), `valda: ${valda}`);
  assertEquals([...valda].sort((a, b) => a - b), valda, "ordningen behålls");
});

Deno.test("utdragen är alltid hela", () => {
  const docs = dokumentInomBudget(utdrag([1000, 2000, 500]), "kort", 2200, 8000);
  for (const d of delar(docs)) {
    const n = nummer(d);
    assertEquals(d.length, `[Metal Work — katalog-${n}.pdf]\n`.length + [1000, 2000, 500][n]);
  }
});

Deno.test("för lång prompt: inga dokument; tomt in ger tomt ut", () => {
  assertEquals(dokumentInomBudget(utdrag([1300]), "p".repeat(20000), 2200, 8000), "");
  assertEquals(dokumentInomBudget("", "kort", 2200, 8000), "");
});

Deno.test("högre nivå ger plats för alla utdrag", () => {
  assertEquals(delar(dokumentInomBudget(utdrag([4000, 4000, 4000, 4000, 4000]), "p".repeat(9000), 2200, 250000)).length, 5);
});

Deno.test("GROQ_TPM_TAK läses som människor skriver det", () => {
  assertEquals(lasTpmTak(undefined), STANDARD_TPM_TAK);
  assertEquals(lasTpmTak("   "), STANDARD_TPM_TAK);
  assertEquals(lasTpmTak("8k"), 8000);
  assertEquals(lasTpmTak("8 000"), 8000);
  assertEquals(lasTpmTak("250_000"), 250000);
  assertEquals(lasTpmTak("250k"), 250000);
  assertEquals(lasTpmTak("1.000.000"), 1000000);
  assertEquals(lasTpmTak("1,000,000"), 1000000);
  // Oläsligt eller orimligt: null, så att index.ts loggar och använder standard.
  assertEquals(lasTpmTak("tusen"), null);
  assertEquals(lasTpmTak("5"), null);
  assertEquals(lasTpmTak("1000.5"), null);
});

Deno.test("bara 413 räknas som för stor begäran; 429 är ett vanligt minutstak", () => {
  assert(forStorBegaran(413));
  assert(!forStorBegaran(429));
  assert(!forStorBegaran(400));
});

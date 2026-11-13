/// <reference lib="deno.ns" />
// Körs med: deno test tests/valuta.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { arValuta, lasPaslag, omraknat, valutanot } from "../src/lib/valuta.ts";

Deno.test("kronor räknas om med Riksbankens kurs och påslaget", () => {
  // 1 106,28 kr vid 11,0628 kr/EUR = 100 EUR; med 2 % = 102 EUR.
  assertEquals(omraknat(1106.28, 11.0628, 2), 102);
  assertEquals(omraknat(1106.28, 11.0628, 0), 100);
  // Ingen kurs: priset lämnas orört hellre än att bli fel.
  assertEquals(omraknat(500, 0, 2), 500);
});

Deno.test("påslaget läses säkert ur inställningen", () => {
  assertEquals(lasPaslag("2"), 2);
  assertEquals(lasPaslag("1,5"), 1.5);
  assertEquals(lasPaslag(null), 2);
  assertEquals(lasPaslag("abc"), 2);
  assertEquals(lasPaslag("50"), 2);
});

Deno.test("offerten säger hur priserna räknades om, men inget i kronor", () => {
  const n = valutanot({ valuta: "EUR", kurs: 11.0628, datum: "2026-11-12", paslag: 2 }, "sv");
  assert(n?.includes("Riksbankens kurs 11,0628 kr/EUR (2026-11-12)") && n.includes("2 % valutapåslag"), n ?? "");
  assertEquals(valutanot({ valuta: "SEK", kurs: null, datum: null, paslag: null }, "sv"), null);
  assert(arValuta("EUR") && !arValuta("SEK"));
});

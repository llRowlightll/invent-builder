/// <reference lib="deno.ns" />
// Körs med: deno test tests/valuta.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { arValuta, inkopIOffertvaluta, lasPaslag, omraknat, tillKronor, valutakod, valutanot } from "../src/lib/valuta.ts";

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

Deno.test("leverantörsoffertens valuta tolkas som kod", () => {
  assertEquals(valutakod("EUR"), "EUR");
  assertEquals(valutakod(" eur "), "EUR");
  assertEquals(valutakod("€"), "EUR");
  assertEquals(valutakod("Euro"), "EUR");
  assertEquals(valutakod("EUR exkl. moms"), "EUR");
  assertEquals(valutakod("SEK"), "SEK");
  assertEquals(valutakod("kr"), "SEK");
  assertEquals(valutakod("kronor"), "SEK");
  assertEquals(valutakod("$"), "USD");
  assertEquals(valutakod("£"), "GBP");
  // Danska och norska kronor heter också "kr" -- koden vinner.
  assertEquals(valutakod("DKK"), "DKK");
  assertEquals(valutakod("NOK kr"), "NOK");
  assertEquals(valutakod("CHF"), "CHF");
  // Saknad valuta är null, inte en gissning.
  assertEquals(valutakod(null), null);
  assertEquals(valutakod("  "), null);
});

Deno.test("leverantörens pris räknas till offertens valuta", () => {
  const p = 2;
  // Samma valuta: orört, oavsett kurser.
  assertEquals(inkopIOffertvaluta(100, "EUR", "EUR", { paslag: p }), 100);
  assertEquals(inkopIOffertvaluta(1000, "SEK", "SEK", { paslag: p }), 1000);
  // Tysk leverantör, svensk kund: euro till kronor med kursen rakt av.
  assertEquals(inkopIOffertvaluta(100, "EUR", "SEK", { franKurs: 11.0628, paslag: p }), 1106.28);
  // Svensk leverantör, offert i euro: samma kurs och påslag som offertens egna
  // priser (omraknat), så att raden blir lika dyr som om den lästs in i kronor.
  assertEquals(inkopIOffertvaluta(1106.28, "SEK", "EUR", { tillKurs: 11.0628, paslag: p }), omraknat(1106.28, 11.0628, p));
  assertEquals(inkopIOffertvaluta(1106.28, "SEK", "EUR", { tillKurs: 11.0628, paslag: p }), 102);
  // Dollar till euro går genom kronor.
  assertEquals(inkopIOffertvaluta(100, "USD", "EUR", { franKurs: 10, tillKurs: 11, paslag: 0 }), 90.91);
});

Deno.test("utan kurs blir det inget pris, aldrig ett omärkt", () => {
  assertEquals(inkopIOffertvaluta(100, "EUR", "SEK", { paslag: 2 }), null);
  assertEquals(inkopIOffertvaluta(100, "EUR", "SEK", { franKurs: 0, paslag: 2 }), null);
  assertEquals(inkopIOffertvaluta(1000, "SEK", "EUR", { tillKurs: null, paslag: 2 }), null);
  assertEquals(inkopIOffertvaluta(Number.NaN, "SEK", "SEK", { paslag: 2 }), null);
});

Deno.test("tillbaka till kronor tar bort påslaget med samma kurs", () => {
  assertEquals(tillKronor(102, 11.0628, 2), 1106.28);
  // Offert i euro utan sparad kurs: ingen påslag att ta bort.
  assertEquals(tillKronor(100, 11.0628, 0), 1106.28);
  // Rundresan ger kronorna tillbaka, på centavrundningen när (± 6 öre vid 11 kr/EUR).
  assert(Math.abs((tillKronor(omraknat(749, 11.0628, 2), 11.0628, 2) ?? 0) - 749) <= 0.06);
  assertEquals(tillKronor(100, 0, 2), null);
});

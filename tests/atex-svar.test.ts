/// <reference lib="deno.ns" />
// Körs med: deno test tests/atex-svar.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { arAtexFraga, atexSvar } from "../src/lib/atex-svar.ts";

Deno.test("kundgranskningens ATEX-frågor går till det fasta svaret", () => {
  for (const f of [
    "Vilka magnetventiler har ni för ATEX zon 1?",
    "Behöver lägesgivare märkta II 2G Ex h IIC T4 Gb",
    "Klarar cylindern zon 21 med brännbart damm?",
    "Vad betyder T4 för gasgrupp IIB?",
    "explosionsfarlig miljö, lösningsmedel",
    "Do you have valves for zone 2?",
  ]) assert(arAtexFraga(f), f);
});

Deno.test("vanliga frågor får inte ATEX-svaret", () => {
  for (const f of [
    "Har ni 3D-modell (STEP) för DSBC-50?",
    "Vilken cylinder behövs t ex i en press?",
    "Ø50 slag 200, 6 bar",
    "Vad är skillnaden mellan IP67 och IP69K?",
    "Hur kopplar jag en M12-givare?",
  ]) assert(!arAtexFraga(f), f);
});

Deno.test("följdfråga om givare efter ett ATEX-svar får också det fasta svaret", () => {
  assert(arAtexFraga("vilken givare passar där?", [{ content: "Vi har ATEX zon 1 i fabriken" }]));
  assert(!arAtexFraga("vilken givare passar där?", [{ content: "Ø50 slag 200 i en press" }]));
});

Deno.test("det fasta svaret har rätt T4, rätt grupper och säger att Ex h inte gäller givare", () => {
  for (const l of ["sv", "en"]) {
    const s = atexSvar(l);
    assert(s.includes("T4 135 °C"), l);
    assert(s.includes("T2 300 °C"), l);
    assert(/IIA, IIB, IIC/.test(s), l);
    assert(!/gasgrupp \(A|group \(A/i.test(s), l);
    assert(/Ex h/.test(s) && /Ex ia/.test(s), l);
  }
  assertEquals(atexSvar("de"), atexSvar("en"));
});

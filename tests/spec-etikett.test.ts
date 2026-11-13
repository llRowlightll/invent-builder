/// <reference lib="deno.ns" />
// Körs med: deno test tests/spec-etikett.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { specEtikett } from "../src/lib/spec-format.ts";

Deno.test("specifikationerna har tyska och spanska namn (var 'Bore'/'Stroke' på /de och /es)", () => {
  assertEquals(specEtikett("bore_mm", "de"), "Kolbendurchmesser");
  assertEquals(specEtikett("stroke_mm", "de"), "Hub");
  assertEquals(specEtikett("bore_mm", "es"), "Diámetro del émbolo");
  assertEquals(specEtikett("stroke_mm", "es"), "Carrera");
  assertEquals(specEtikett("bore_mm", "sv"), "Borrning");
  assertEquals(specEtikett("bore_mm", "en"), "Bore");
  // Saknas i listan: engelska, som förut.
  assertEquals(specEtikett("order_code_length", "de"), specEtikett("order_code_length", "en"));
});

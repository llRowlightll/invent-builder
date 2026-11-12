/// <reference lib="deno.ns" />
// Körs med: deno test tests/fortnox.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { fortnoxRad } from "../src/lib/fortnox.ts";

Deno.test("felet från 2026-11-12 pekar på behörigheterna i utvecklarportalen", () => {
  const r = fortnoxRad("Fortnox: An unsupported scope was requested");
  assert(r?.includes("Artikel, Faktura, Företagsinformation, Kund och Order"));
});

Deno.test("licensfel pekar på Köp & Aktivera, inte på behörigheterna", () => {
  const r = fortnoxRad("Fortnox: Not licensed for requested scope");
  assert(r?.includes("Köp & Aktivera"));
  assert(!r?.includes("utvecklarportal"));
});

Deno.test("fel redirect-adress visar den rätta", () => {
  assert(fortnoxRad("Fortnox: redirect_uri mismatch")?.includes("/functions/v1/fortnox-anslut"));
});

Deno.test("okända och tomma fel får ingen gissad förklaring", () => {
  assertEquals(fortnoxRad(null), null);
  assertEquals(fortnoxRad(""), null);
  assertEquals(fortnoxRad("Anslutningen hade gått ut. Tryck på Anslut Fortnox igen."), null);
});

/// <reference lib="deno.ns" />
// Körs med: deno test --no-lock --node-modules-dir=none tests/design-status.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { allvarligast, radensText, radensTillstand, radStatus, utfalletsText, utfalletsTillstand } from "../src/lib/design/status.ts";

Deno.test("grönt bara för det som prövades och höll", () => {
  assertEquals(radensTillstand("verifierad"), "bekraftat");
  for (const s of ["delvis", "underlag_saknas", "stods_inte", "kraver_verifiering", "kraver_konfiguration", "avvikelse"]) {
    assertEquals(radensTillstand(s), "komplettering", s);
  }
  assertEquals(radensTillstand("ej_uppfyllt"), "uppfyllerInte");
  assertEquals(radensTillstand("ej_godkand"), "uppfyllerInte");
  assertEquals(radensTillstand("ej_tillampligt"), "ejProvat");
  assertEquals(radensTillstand(undefined), "ejProvat");
  assertEquals(radensTillstand("okänt-värde"), "ejProvat");
});

Deno.test("en prövad rad med ett krav utan underlag är delvis prövad, inte prövad", () => {
  assertEquals(radStatus({ verifiering: "verifierad", kontroller: [{ utfall: "uppfyllt" }, { utfall: "underlag_saknas" }] }), "delvis");
  assertEquals(radStatus({ verifiering: "verifierad", kontroller: [{ utfall: "uppfyllt" }] }), "verifierad");
  assertEquals(radensTillstand(radStatus({ verifiering: "verifierad", kontroller: [{ utfall: "stods_inte" }] })), "komplettering");
});

Deno.test("texten säger vad statusen betyder, på båda språken", () => {
  assertEquals(radensText("ej_tillampligt", "sv"), "Inget krav att pröva");
  assertEquals(radensText("ej_uppfyllt", "en"), "Does not meet requirement");
  assertEquals(radensText(undefined, "sv"), "Ej prövat");
  assertEquals(utfalletsText("konfigureras", "sv"), "väljs vid order");
});

Deno.test("alternativens kravutfall och den allvarligaste nivån", () => {
  assertEquals(utfalletsTillstand("uppfyllt"), "bekraftat");
  assertEquals(utfalletsTillstand("ej_uppfyllt"), "uppfyllerInte");
  assertEquals(utfalletsTillstand("kan_inte_bedomas"), "komplettering");
  assertEquals(allvarligast(["bekraftat", "komplettering", "preliminart"]), "komplettering");
  assertEquals(allvarligast(["bekraftat", "uppfyllerInte"]), "uppfyllerInte");
  assertEquals(allvarligast([]), null);
});

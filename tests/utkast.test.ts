/// <reference lib="deno.ns" />
// Körs med: deno test tests/utkast.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { lasUtkast, rensaUtkast, sparaUtkast } from "../src/lib/utkast-lagring.ts";

Deno.test("utkast sparas, läses och töms", () => {
  sessionStorage.clear();
  sparaUtkast("korg.namn", "Anna");
  sparaUtkast("korg.meddelande", "Tre cylindrar");
  sparaUtkast("radgivare.epost", "a@b.se");
  assertEquals(lasUtkast<string>("korg.namn"), "Anna");
  // Ett tomt värde tar bort utkastet i stället för att spara "".
  sparaUtkast("korg.namn", "");
  assertEquals(lasUtkast("korg.namn"), null);
  // Prefix med punkt tar bort hela formulärets utkast, inget annat.
  rensaUtkast("korg.");
  assertEquals(lasUtkast("korg.meddelande"), null);
  assertEquals(lasUtkast<string>("radgivare.epost"), "a@b.se");
});

Deno.test("objekt och trasiga värden", () => {
  sessionStorage.clear();
  sparaUtkast("bolag", { name: "Maskinval", vat: "" });
  assertEquals(lasUtkast<{ name: string }>("bolag")?.name, "Maskinval");
  sparaUtkast("bolag", {});
  assertEquals(lasUtkast("bolag"), null);
  // Något annat skrev skräp under nyckeln: inget kast, bara inget utkast.
  sessionStorage.setItem("mv_utkast:trasig", "{inte json");
  assertEquals(lasUtkast("trasig"), null);
});

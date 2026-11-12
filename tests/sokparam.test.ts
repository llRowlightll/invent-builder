/// <reference lib="deno.ns" />
// Körs med: deno test tests/sokparam.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { z } from "npm:zod@^3.24.2";
import { somText } from "../src/lib/sokparam.ts";

const schema = z.object({ q: z.preprocess(somText, z.string().optional()) });

Deno.test("numeriskt artikelnummer i adressen blir text (var serverfel 500)", () => {
  assertEquals(schema.parse({ q: 153305 }), { q: "153305" });
});

Deno.test("text och saknad parameter är oförändrade", () => {
  assertEquals(schema.parse({ q: "DSBC-50-200" }), { q: "DSBC-50-200" });
  assertEquals(schema.parse({}), {});
});

Deno.test("artikelnummer med inledande nolla är redan text", () => {
  // JSON.parse godtar inte inledande nollor, så routern lämnar 0822391005
  // som text; bara rena tal som 153305 behöver göras om.
  assertEquals(schema.parse({ q: "0822391005" }), { q: "0822391005" });
});

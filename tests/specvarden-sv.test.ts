/// <reference lib="deno.ns" />
// Körs med: deno test tests/specvarden-sv.test.ts
import { assertEquals } from "jsr:@std/assert@^1";
import { svensktVarde } from "../src/lib/specvarden-sv.ts";

Deno.test("hela värden översätts, med varje dels versal och koder kvar", () => {
  assertEquals(svensktVarde("Elastic rings; Self-adjusting pneumatic (PPS); Pneumatic adjustable (PPV)"),
    "Elastiska ringar; Självjusterande pneumatisk (PPS); Pneumatisk, justerbar (PPV)");
  assertEquals(svensktVarde("Compressed air, filtered, lubricated or unlubricated"), "Tryckluft, filtrerad, smord eller osmord");
  assertEquals(svensktVarde("Magnetic piston, proximity sensor"), "Magnetkolv, närhetsgivare");
  assertEquals(svensktVarde("Compressed air ISO 8573-1 [7:4:4]"), "Tryckluft ISO 8573-1 [7:4:4]");
  assertEquals(svensktVarde("5/2 monostable; 5/2 bistable (memory); 5/3 exhausted"), "5/2 monostabil; 5/2 bistabil (minne); 5/3 avluftat mittläge");
  assertEquals(svensktVarde("Polyurethane (P); NBR (N); FKM/FPM (V)"), "Polyuretan (P); NBR (N); FKM/FPM (V)");
});

Deno.test("en okänd del: originalet står kvar, inget halvsvenskt", () => {
  assertEquals(svensktVarde("Ball screw (precision class 7), inline or parallel motor"), null);
  assertEquals(svensktVarde("Double-acting rotary vane"), null);
});

Deno.test("koder, serier och tal rörs inte", () => {
  assertEquals(svensktVarde("DSNU"), null);
  assertEquals(svensktVarde("ISO 15552"), null);
  assertEquals(svensktVarde("10"), null);
  assertEquals(svensktVarde("Luftdämpning, effektiv dämpningslängd 5,8 mm"), null);
});

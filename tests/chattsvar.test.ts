/// <reference lib="deno.ns" />
// Körs med: deno test tests/chattsvar.test.ts
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1";
import { avslutaKlipptSvar, skiljKallrad, tillBubbeltext } from "../src/lib/chattsvar.ts";

// Det klippta kunskapssvaret från drift 2026-10-05, förkortat.
const DRIFT = [
  "Förslag på cylinder för daglig högtryckstvätt i livsmedelsindustrin – Ø 32 mm, 100 mm slag",
  "| Parameter | Rekommenderad lösning (exempel) | Kommentar |",
  "|-----------|--------------------------------|-----------|",
  "| Borrdiameter | 32 mm (Ø 32) | Måste stämma med ditt krav. |",
  "| Kraft (vid 6 bar) | ≈ 480 N <br>Kraft (vid 10 bar) | ≈ 800 N | Kontrollera kraften. |",
  "| Standard | ISO 155",
].join("\n");

Deno.test("en tabell blir rader som bubblan kan visa", () => {
  const ut = tillBubbeltext(DRIFT);
  assertEquals(ut.includes("|---"), false);
  assertEquals(ut.includes("Parameter"), false);
  assertStringIncludes(ut, "• **Borrdiameter**: 32 mm (Ø 32) – Måste stämma med ditt krav.");
  // <br> inne i raden håller ihop den
  assertStringIncludes(ut, "• **Kraft (vid 6 bar)**: ≈ 480 N / Kraft (vid 10 bar) – ≈ 800 N – Kontrollera kraften.");
  assertEquals(ut.includes("<br>"), false);
});

Deno.test("rubriker och markdown-punkter blir bubblans egna", () => {
  assertEquals(tillBubbeltext("### Val av tätning\n- PTFE\n* EPDM"), "**Val av tätning**\n• PTFE\n• EPDM");
  assertEquals(tillBubbeltext("Rad ett<br>rad två"), "Rad ett\nrad två");
});

Deno.test("ett klippt svar slutar på en hel rad och säger att det kortades", () => {
  const ut = avslutaKlipptSvar(DRIFT, true);
  assertEquals(ut.includes("ISO 155"), false);
  assertStringIncludes(ut, "| Kraft (vid 6 bar)");
  assertStringIncludes(ut, "(Svaret kortades.");
});

Deno.test("utan radbrytning kapas svaret vid sista hela meningen", () => {
  assertEquals(
    avslutaKlipptSvar("PTFE tål det mesta. EPDM tål ånga men inte mi", true),
    "PTFE tål det mesta.\n\n(Svaret kortades. Ställ en smalare fråga för mer detaljer.)",
  );
});

const KANDIDATER = [
  "SMC — smc-cp96-om_cp96n_om0197qen.pdf",
  "SMC — smc-CQ2-om_cq2x_om0002m-en.pdf",
];

Deno.test("källraden tas bort och bara använda källor visas", () => {
  const r = skiljKallrad("PTFE tål tvätt.\nSOURCES: smc-CQ2-om_cq2x_om0002m-en.pdf", KANDIDATER);
  assertEquals(r.svar, "PTFE tål tvätt.");
  assertEquals(r.kallor, ["SMC — smc-CQ2-om_cq2x_om0002m-en.pdf"]);
});

Deno.test("SOURCES: none betyder att inga källor visas", () => {
  // Fallet från drift: reservdelskit är inget svar på en fråga om tvätt.
  const r = skiljKallrad("Vår dokumentation täcker inte det.\n\n**SOURCES:** none", KANDIDATER);
  assertEquals(r.svar, "Vår dokumentation täcker inte det.");
  assertEquals(r.kallor, []);
});

Deno.test("utan källrad visas källorna som förut", () => {
  const r = skiljKallrad("Ett svar utan källrad.", KANDIDATER);
  assertEquals(r.svar, "Ett svar utan källrad.");
  assertEquals(r.kallor, KANDIDATER);
});

Deno.test("källraden på svenska tolkas likadant", () => {
  const r = skiljKallrad("Svar.\nKällor: smc-cp96-om_cp96n_om0197qen.pdf", KANDIDATER);
  assertEquals(r.svar, "Svar.");
  assertEquals(r.kallor, ["SMC — smc-cp96-om_cp96n_om0197qen.pdf"]);
  assertEquals(skiljKallrad("Svar.\nKÄLLOR: inga", KANDIDATER).kallor, []);
});

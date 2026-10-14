/// <reference lib="deno.ns" />
// Körs med: deno test --no-lock --node-modules-dir=none tests/projektoversikt.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { byggProjektoversikt } from "../src/lib/design/projektoversikt.ts";
import { SORTERING } from "../supabase/functions/groq-advisor/fixtur-sortering.ts";

const sektion = (o: ReturnType<typeof byggProjektoversikt>, id: string) => o.sektioner.find((s) => s.id === id)!;

Deno.test("redan medan beskrivningen skrivs: tolkade krav och det som saknas", () => {
  const o = byggProjektoversikt({ locale: "sv", description: SORTERING, answers: {} });
  assert(o.antal.tolkade > 5, `tolkade: ${o.antal.tolkade}`);
  assertEquals(o.antal.bekraftade, 0, "inget är bekräftat förrän användaren sagt det");
  assert(o.antal.saknas > 0, "lådsorteringen saknar bl.a. utskjutarens hastighet");
  assert(sektion(o, "tolkade").poster.some((p) => p.text.startsWith("Massa: 0,5–3 kg")), JSON.stringify(sektion(o, "tolkade").poster.map((p) => p.text)));
  assertEquals(o.antal.konflikter, 0);
});

Deno.test("en bekräftad tolkning flyttar till bekräftade krav", () => {
  const o = byggProjektoversikt({ locale: "sv", description: SORTERING, answers: { "tolkning:alla": "bekraftat" } });
  assertEquals(o.antal.tolkade, 0);
  assert(o.antal.bekraftade > 5);
  assert(/bekräftade/.test(o.sammanfattning), o.sammanfattning);
});

Deno.test("ett öppet lämnat svar och ett antaget tryck syns", () => {
  const o = byggProjektoversikt({
    locale: "sv", description: "Skjuta paket 5 kg 300 mm", answers: { takt: "Lämnas öppen" },
    fragor: [{ id: "takt", label: "Hur ofta görs rörelsen?" }], lamnasOppen: "Lämnas öppen",
    requirements: { pressure_assumed: true, pressure_bar: 6, force_preliminary: true, required_force_n: 98 },
  });
  assert(sektion(o, "saknas").poster.some((p) => p.text === "Hur ofta görs rörelsen?"));
  const ant = sektion(o, "antaganden").poster.map((p) => p.text);
  assert(ant.includes("Tryckluft 6 bar") && ant.includes("Kraft 98 N"), ant.join(" | "));
});

Deno.test("ett krav som inte uppfylls är en konflikt, och konflikterna står först", () => {
  const o = byggProjektoversikt({
    locale: "sv", description: "Lyfta lådor 50 kg med gripdon", answers: {},
    valt: { name: "MW-P1-32", kravstatus: [{ krav: "gripkraft ≈ 5000 N", utfall: "ej_uppfyllt", text: "artikeln ger ≈ 170 N" }] },
    blockerande: [{ role: "Stångbroms", verifiering: "ej_uppfyllt", skal: "Ingen artikel matchar" }],
  });
  assertEquals(o.sektioner[0].id, "konflikter");
  assertEquals(o.antal.konflikter, 2);
  assert(sektion(o, "konflikter").oppen);
  assert(/^2 konflikter/.test(o.sammanfattning), o.sammanfattning);
});

Deno.test("engelska: samma innehåll, översatta rubriker", () => {
  const o = byggProjektoversikt({ locale: "en", description: SORTERING, answers: {} });
  assertEquals(sektion(o, "saknas").rubrik, "Missing information");
  assert(o.antal.tolkade > 0);
});

Deno.test("ingen beskrivning, inga svar: ingenting att visa", () => {
  const o = byggProjektoversikt({ locale: "sv", description: "  ", answers: {} });
  assertEquals(o.sektioner.length, 0);
  assertEquals(o.sammanfattning, "");
});

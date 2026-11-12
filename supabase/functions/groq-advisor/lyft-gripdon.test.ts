// Körs med: deno test supabase/functions/groq-advisor/lyft-gripdon.test.ts
// Ägarens beslut 2026-11-12: lyft med griporgan -> lyftet är huvudvalet och
// griporganet en egen rad i stycklistan; båda ingår i offerten.
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { buildMandatoryBomRows, type BomCtx } from "./bom-builder.ts";
import { type CatalogProduct, normalizeKeySpecs } from "./scoring.ts";
import { detectHazards, extractStatedForceN, lyftMedGriporgan } from "./signals.ts";

Deno.test("lyft med griporgan känns igen ur beskrivningen", () => {
  assertEquals(lyftMedGriporgan("Lyfta lådor 40 kilo vertikalt 400 mm med gripdon", "Lyfta lådor 40 kilo vertikalt 400 mm med gripdon"), "gripper");
  const t = "Lyfta lådor 40 kilo vertikalt 400 mm";
  assertEquals(lyftMedGriporgan(t, `${t} Med gripdon som klämmer`), "gripper"); // greppet i svaret, lyftet i beskrivningen
  assertEquals(lyftMedGriporgan("Lyfta glasskivor 20 kg 300 mm med sugkoppar", "Lyfta glasskivor 20 kg 300 mm med sugkoppar"), "vacuum");
  // Ingen rörelse i beskrivningen: griporganet leder som förut, även om slagfrågan besvarats.
  assertEquals(lyftMedGriporgan("Gripdon för lådor 40 kg", "Gripdon för lådor 40 kg 400 mm"), null);
  // Ett befintligt lyft: bara griporganet.
  const b = "Gripdon på befintlig lyftanordning, lådor 40 kg, lyft 400 mm";
  assertEquals(lyftMedGriporgan(b, b), null);
  // Ingen greppönskan alls.
  assertEquals(lyftMedGriporgan(t, t), null);
});

Deno.test("en gripkraft dimensionerar aldrig lyftcylindern", () => {
  assertEquals(extractStatedForceN("Lyfta 40 kg 400 mm, gripkraft 500 N", {}), 0);
  assertEquals(extractStatedForceN("greppkraft 800 N", {}), 0);
  assertEquals(extractStatedForceN("klämkraft 900 N", {}), 900);
  assertEquals(extractStatedForceN("pressa med 3000 N", {}), 3000);
});

function p(sku: string, category: string, specs: Record<string, unknown> = {}, name = sku): CatalogProduct {
  return { sku, name, category, brand: "festo", key_specs: normalizeKeySpecs(specs) };
}

function ctx(text: string, griporganTillagg: "gripper" | "vacuum", products: CatalogProduct[]): BomCtx {
  const hz = detectHazards(text, {}, "sv");
  return {
    ...hz, primarySku: "P1D-S050MS-0400", primaryCategory: "cylinder", primaryName: "P1D Ø50", kravTempC: 0, kravTempMinC: NaN,
    primarySpecs: { bore_mm: 50 }, primaryIsFamilyProd: false, isElectric: false, locale: "sv", products, primaryBoreMm: 50,
    primaryBrand: "parker", unitCount: 1, griporganTillagg, griporganText: text,
  } as unknown as BomCtx;
}

const GRIPDON = [
  p("FESTO-DHPS-10", "gripper", { clamping_force: "170", gripper_type: "parallel" }, "DHPS parallellgripdon"),
  p("FESTO-HGPT-B", "gripper", { gripping_force_closing_N: "106–6300 N", sizes: "16,20,25,35,40,50,63,80", gripper_type: "parallel" }, "HGPT-B parallellgripdon"),
  p("FESTO-HGPL-63", "gripper", { clamping_force: "4300", gripper_type: "parallel" }, "HGPL parallellgripdon"),
];

Deno.test("stycklistan: lyftet är primär, gripdonet en egen rad som når gripkraften", () => {
  const text = "Lyfta lådor 40 kilo vertikalt 400 mm med gripdon, personal arbetar under lasten";
  const rows = buildMandatoryBomRows(ctx(text, "gripper", GRIPDON));
  assertEquals(rows[0].sku, "P1D-S050MS-0400");
  const grip = rows.find((r) => r.griporgan === "gripper")!;
  assert(grip, "ingen gripdonsrad");
  // ≈ 4000 N krävs: det minsta som når det, inte 170 N-gripdonet.
  assertEquals(grip.sku, "FESTO-HGPL-63");
  assert(grip.verifiering !== "ej_uppfyllt", grip.verifieringsskal);
  // Lyftet ingår: stångbromsen sitter på lyftcylindern, och ingen rad säger "Lyftet ingår inte".
  assert(rows.some((r) => r.kind === "rod_lock"), "stångbroms saknas");
  assert(!rows.some((r) => /Lyftet ingår inte/.test(r.role)));
  // Greppet ska fortfarande hålla vid tryckfall.
  assert(rows.some((r) => /Greppet ska hålla vid tryckfall/.test(r.role)));
});

Deno.test("stycklistan: räcker inget gripdon blir raden en lucka; vakuum konfigureras", () => {
  const svag = buildMandatoryBomRows(ctx("Lyfta lådor 40 kilo vertikalt 400 mm med gripdon", "gripper", [GRIPDON[0]]));
  const g = svag.find((r) => r.griporgan === "gripper")!;
  assertEquals([g.sku, g.verifiering], ["SPECIFY", "ej_uppfyllt"]);
  const vak = buildMandatoryBomRows(ctx("Lyfta glasskivor 20 kg 300 mm med sugkoppar", "vacuum", []));
  const v = vak.find((r) => r.griporgan === "vacuum")!;
  assertEquals([v.sku, v.verifiering], ["SPECIFY", "kraver_verifiering"]);
});

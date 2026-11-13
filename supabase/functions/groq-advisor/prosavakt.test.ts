import { assertEquals } from "jsr:@std/assert@^1";
import { LANGRE_SLAG_PRO, produktdataText, rensaMotsagelser, rensaPositionsPros, rensaSerieslag } from "./prosavakt.ts";

Deno.test("pneumatik: 'exakt positionering' stryks", () => {
  const pros = [
    "Kraft på 483 N >> 39 N (mycket hög marginal)",
    "Dubbelverkande ger exakt positionering",
    "Dubbelverkande för exakt kontroll",
    "Slaglängd exakt 50 mm enligt krav",
  ];
  assertEquals(rensaPositionsPros(pros, true), [
    "Kraft på 483 N >> 39 N (mycket hög marginal)",
    "Slaglängd exakt 50 mm enligt krav",
  ]);
});

Deno.test("elaxel: 'exakt positionering' är en riktig fördel och står kvar", () => {
  const pros = ["Exakt positionering ±0,02 mm"];
  assertEquals(rensaPositionsPros(pros, false), pros);
});

Deno.test("längre slag än kravet är ingen fördel, oavsett ordval", () => {
  for (const pro of [
    "Långt slag (200 mm) ger möjlighet till större rörelseomfång",
    "Längre slaglängd än krav (200 mm)",
    "Longer stroke than required gives flexibility",
  ]) assertEquals(LANGRE_SLAG_PRO.test(pro), true, pro);
  // Ett slag som MOTSVARAR kravet är ingen avvikelse.
  assertEquals(LANGRE_SLAG_PRO.test("Slaglängd exakt 50 mm enligt krav"), false);
  assertEquals(LANGRE_SLAG_PRO.test("Kraft på 1 178 N >> 39 N"), false);
});

Deno.test("en series maxslag stryks ur fördelar och nackdelar", () => {
  // Texterna från drift 2026-10-06 (SMC-CM2, serien upp till 300 mm, krav 100 mm).
  const r = rensaSerieslag(
    ["Borrdiameter 32 mm ger god styrka", "Slag 300 mm överstiger kravet", "Force 483 N vid 6 bar"],
    ["Ingen IP‑klassning anges, så inte garanterad för washdown", "Slag 300 mm är längre än nödvändigt"],
    300,
  );
  assertEquals(r.pros, ["Borrdiameter 32 mm ger god styrka", "Force 483 N vid 6 bar"]);
  assertEquals(r.cons, ["Ingen IP‑klassning anges, så inte garanterad för washdown"]);
  // MW-HCR-32: "Slag 500 mm" som fördel om en serie som beställs i 100 mm.
  assertEquals(rensaSerieslag(["Slag 500 mm", "IP67‑klassning"], [], 500).pros, ["IP67‑klassning"]);
  // Ett annat tal med mm berörs inte.
  assertEquals(rensaSerieslag(["Borrdiameter 32 mm"], [], 300).pros, ["Borrdiameter 32 mm"]);
});

// Kundgranskningen 2026-11-13: nackdelar som produktens egna specar motsäger.
// Som index.ts skickar in: namnet och specvärdena, inte nycklarna
// ("cushioning_types" i sig är inget belägg för dämpning).
const CAMOZZI_63 = "Serie 63 – ISO 15552 Cylinder Ø50×200 ; Pneumatic, self-adjusting ; Magnetic piston, T-slot sensor";
const AVENTICS_PRA = "AVENTICS PRA Ø50 200mm ISO 15552 Cylinder ; Adjustable cushioning (both ends) ; Optional reed/PNP sensor";
const UTAN = "Mini cylinder Ø16 ; Elastic bumpers";

Deno.test("rensaMotsagelser stryker 'ingen magnetkolv' när specen har magnetkolv", () => {
  assertEquals(rensaMotsagelser(["Ingen magnetkolv", "Tyngre än en kompaktcylinder"], CAMOZZI_63), ["Tyngre än en kompaktcylinder"]);
  assertEquals(rensaMotsagelser(["No magnetic piston"], CAMOZZI_63), []);
  // Givaren säljs separat -- det är sant och står kvar.
  assertEquals(rensaMotsagelser(["Givare ingår inte"], CAMOZZI_63), ["Givare ingår inte"]);
  // Utan magnet i datan står påståendet kvar.
  assertEquals(rensaMotsagelser(["Ingen magnetkolv"], UTAN), ["Ingen magnetkolv"]);
});

Deno.test("rensaMotsagelser stryker 'ingen justerbar dämpning' när specen har justerbar dämpning", () => {
  assertEquals(rensaMotsagelser(["Ingen justerbar dämpning"], AVENTICS_PRA), []);
  assertEquals(rensaMotsagelser(["No adjustable cushioning"], AVENTICS_PRA), []);
  // Självjusterande är inte justerbar: där står påståendet kvar.
  assertEquals(rensaMotsagelser(["Ingen justerbar dämpning"], CAMOZZI_63), ["Ingen justerbar dämpning"]);
  // Med bara gummibuffertar i datan står "ingen dämpning" kvar.
  assertEquals(rensaMotsagelser(["Ingen dämpning"], AVENTICS_PRA), []);
  assertEquals(rensaMotsagelser(["Ingen dämpning"], UTAN), ["Ingen dämpning"]);
});

Deno.test("produktdataText märker dämpningsnyckelns värde, inte andra nycklar", () => {
  const d = produktdataText("Serie 63", { cushioning_types: "Pneumatic, self-adjusting", position_sensing: "Magnetic piston", bore_mm: "50" });
  assertEquals(rensaMotsagelser(["Ingen dämpning", "Ingen magnetkolv", "Dyr"], d), ["Dyr"]);
  assertEquals(rensaMotsagelser(["Ingen dämpning"], produktdataText("Mini", { cushioning_types: "none" })), ["Ingen dämpning"]);
});

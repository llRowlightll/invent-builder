// Griporganets alternativ (griporgan.ts). Fallen kommer ur granskningen
// 2026-10-14, med katalogens verkliga format: krafter som "170 N", serier som
// "106–6300 N" med en storlekslista.
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { angivetKoppantal, byggGripdonsalternativ, byggVakuumalternativ, MAX_KOPPAR, type Kravstatus } from "./griporgan.ts";
import type { CatalogProduct } from "./scoring.ts";
import { detectHazards, extractLoadKg } from "./signals.ts";

const gripdon = (sku: string, specs: Record<string, unknown>, name = sku): CatalogProduct =>
  ({ sku, name, category: "gripper", brand: "", key_specs: specs });

const SVAGT = gripdon("P-170", { clamping_force: "170 N", gripper_type: "Parallel 2-jaw", operating_pressure: "2–8 bar" });
const MELLAN = gripdon("P-1200", { clamping_force: "1200 N", gripper_type: "Parallel 2-jaw", operating_pressure: "2–8 bar" });
const HGPT = gripdon("FESTO-HGPT-B", { sizes: "16, 20, 25, 35, 40, 50, 63, 80", gripping_force_closing_N: "106–6300 N" }, "HGPT-B – High-Force Parallel Gripper");
const RADIAL = gripdon("R-6000", { clamping_force: "6000 N", gripper_type: "Self-centering 3-jaw" });

function forslag(text: string, prods: CatalogProduct[], tryckKrav = 0, locale = "sv") {
  const hazards = detectHazards(text, {}, locale);
  return byggGripdonsalternativ(prods, { text, hazards, loadKg: extractLoadKg(text, {}), locale, tryckKrav });
}
const status = (o: Record<string, unknown>) => (o.kravstatus ?? []) as Kravstatus[];

Deno.test("en serie som når kravet i största storleken är ett alternativ, och påståendet om katalogen stämmer", () => {
  const r = forslag("Lyfta lådor 50 kg med gripdon", [SVAGT, MELLAN, HGPT]);
  assertEquals(r.options[0].sku, "FESTO-HGPT-B");
  assertEquals(r.options[0].badge, "Välj storlek vid order");
  assertEquals(status(r.options[0])[0].utfall, "konfigureras");
  assert(!r.options.some((o) => o.sku === "CUSTOM-SOLUTION"), "en katalogserie räcker");
  assert(!JSON.stringify(r).includes("Inget parallellgripdon i katalogen når"), "påståendet vore falskt");
  assert(/Lyftet ingår inte/.test(r.summary));
});

Deno.test("räcker inget gripdon står kundlösningen först, med det starkaste och de oprövade", () => {
  const utanKraft = gripdon("P-OKAND", { gripper_type: "Parallel 2-jaw" });
  const r = forslag("Lyfta lådor 50 kg med parallellgripare", [SVAGT, MELLAN, utanKraft]);
  assertEquals(r.options[0].sku, "CUSTOM-SOLUTION");
  assertEquals(r.options[0].orsak, "ingen_katalogmatchning");
  const why = String(r.options[0].why);
  assert(/Inget parallellgripdon i katalogen når ≈ 5000 N; det starkaste ger ≈ 1200 N\./.test(why), why);
  assert(/1 saknar gripkraft i katalogen och kunde inte prövas/.test(why), why);
  assertEquals(r.options[1].badge, "Räcker inte: 1200 av ≈ 5000 N");
  assert(!r.options.some((o) => /Rätt storlek|marginal/i.test(String(o.badge))));
});

Deno.test("når en annan typ kravet är kundlösningen ett alternativ, inte 'ingen artikel'", () => {
  const r = forslag("Lyfta lådor 50 kg med parallellgripare", [SVAGT, MELLAN, RADIAL]);
  assertEquals(r.options[0].orsak, "alternativ");
  assert(/R-6000/.test(String(r.options[0].why)));
});

Deno.test("trycket prövas som i stycklistan: max_pressure räknas", () => {
  const max7 = gripdon("P-MAX7", { clamping_force: "800 N", max_pressure: "7 bar" });
  const r = forslag("Gripa detaljer 5 kg med gripdon, 8 bar", [max7], 8);
  const o = r.options.find((x) => x.sku === "P-MAX7")!;
  assertEquals(o.badge, "Uppfyller inte alla krav");
  assert(status(o).some((k) => /tryck/.test(k.krav) && k.utfall === "ej_uppfyllt"));
  assertEquals(r.options[0].sku, "CUSTOM-SOLUTION");
  assert(/uppfyller alla angivna krav/.test(String(r.options[0].why)), String(r.options[0].why));
  // Det som håller visas, med storleksmärket från början: aldrig "Mer marginal" utan "Rätt storlek".
  const blandat = forslag("Gripa detaljer 5 kg med gripdon, 8 bar", [max7, MELLAN], 8);
  assertEquals(blandat.options.map((x) => [x.sku, x.badge]), [["P-1200", "Rätt storlek"]]);
});

Deno.test("ATEX: ett gripdon utan märkning får inget storleksmärke", () => {
  const r = forslag("Gripa detaljer 5 kg med gripdon i ATEX zon 1", [MELLAN]);
  assertEquals(r.options[0].sku, "CUSTOM-SOLUTION");
  const o = r.options.find((x) => x.sku === "P-1200")!;
  assertEquals(o.badge, "Uppfyller inte alla krav");
  assert(status(o).some((k) => k.krav === "ATEX" && k.utfall === "ej_uppfyllt"));
});

Deno.test("en angiven gripkraft i kN prövas, utan ≈", () => {
  const sexhundra = gripdon("P-600", { clamping_force: "600 N" });
  const r = forslag("Gripdon, gripkraft 2 kN, 6 bar", [sexhundra]);
  const o = r.options.find((x) => x.sku === "P-600")!;
  assertEquals(o.badge, "Räcker inte: 600 av 2000 N");
  assertEquals(status(o)[0].utfall, "ej_uppfyllt");
});

Deno.test("utan massa och kraft sägs det ut, och inget märke påstår en storlek", () => {
  const r = forslag("Gripdon för detaljer", [SVAGT, MELLAN]);
  assert(/Varken lastens massa eller gripkraften är angiven/.test(r.summary));
  assert(r.options.every((o) => /^Gripkraft ≈/.test(String(o.badge))));
  assert(r.options.every((o) => status(o)[0].utfall === "kan_inte_bedomas"));
});

Deno.test("har ingen artikel av typen en gripkraft står kundlösningen först", () => {
  const okand = gripdon("R-OKAND", { gripper_type: "Self-centering 3-jaw" });
  const r = forslag("Treback som lyfter axlar 10 kg", [okand, MELLAN]);
  assertEquals(r.options[0].sku, "CUSTOM-SOLUTION");
  assert(/har en angiven gripkraft/.test(String(r.options[0].why)));
});

// ── Sugkoppar ────────────────────────────────────────────────────────────────

const kopp = (sku: string, d: number): CatalogProduct => ({ sku, name: `Sugkopp Ø${d}`, category: "vacuum", brand: "", key_specs: { cup_diameter_mm: `${d} mm` } });

function vakuum(text: string, prods: CatalogProduct[]) {
  const hazards = detectHazards(text, {}, "sv");
  return byggVakuumalternativ(prods, { text, hazards, loadKg: extractLoadKg(text, {}), locale: "sv", tryckKrav: 0 });
}

Deno.test("sugkoppar: små koppar visas med decimal, och 85 koppar är ingen konstruktion", () => {
  const r = vakuum("Sugkoppar lyfter plåt 10 kg", [kopp("C3", 3), kopp("C30", 30), kopp("C80", 80)]);
  const liten = r.options.find((o) => o.sku === "C3")!;
  assert(/≈ 0,3 N/.test(String(liten.why)), String(liten.why));
  assertEquals(status(liten)[0].utfall, "ej_uppfyllt");
  assert(/välj en större kopp/.test(status(liten)[0].text));
  const mellan = r.options.find((o) => o.sku === "C30")!;
  assertEquals(status(mellan)[0].utfall, "konfigureras");
  assert(/Lyftet ingår inte/.test(r.summary), "lyftet ska sägas ut även för sugkoppar");
  assert(MAX_KOPPAR >= 4);
});

Deno.test("sugkoppar: ett angivet antal prövas per kopp", () => {
  assertEquals(angivetKoppantal("4 sugkoppar håller plåten"), 4);
  assertEquals(angivetKoppantal("Sugkopp Ø30 mm, 2 kg"), 0);
  const r = vakuum("4 sugkoppar håller plåt 10 kg", [kopp("C30", 30), kopp("C80", 80)]);
  assertEquals(status(r.options.find((o) => o.sku === "C30")!)[0].utfall, "ej_uppfyllt");
  assertEquals(status(r.options.find((o) => o.sku === "C80")!)[0].utfall, "uppfyllt");
});

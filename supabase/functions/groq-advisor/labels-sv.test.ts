/**
 * Etiketternas svenska översättningar mot databasens faktiska ordförråd.
 *
 * Listorna nedan är en ÖGONBLICKSBILD av configurator_params.label och
 * configurator_param_values.label för de 154 familjer som inte är DSBC eller
 * P1D (de två har svenska etiketter redan, genererade ur katalogen).
 *
 * Poängen: en ny familj vars etiketter inte finns i labels-sv.ts faller
 * tillbaka på engelskan, och det syns inte förrän någon öppnar sidan på
 * svenska. Här failar bygget i stället.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { paramLabel, valueLabel } from "../../../src/lib/catalog/labels-sv.ts";

/** Rubriker ur configurator_params, 2026-09-11. */
const PARAM_LABELS = [
  "Action",
  "Action type",
  "Axis size",
  "Bore diameter",
  "Bore diameter (mm)",
  "Cushioning",
  "Drive type",
  "Electrical connection",
  "End cushioning",
  "Fieldbus / control",
  "Filter grade",
  "Gripping type",
  "Guide",
  "Guide bearing",
  "Guide type",
  "Motor mounting",
  "Mounting style",
  "Number of valve stations",
  "Options",
  "Piston rod thread",
  "Plate style",
  "Port size",
  "Position sensing",
  "Pressure range",
  "Rod type",
  "Rotation angle",
  "Sensing",
  "Size",
  "Special options",
  "Spindle lead",
  "Stroke (mm)",
  "Stroke length",
  "Stroke per jaw (mm)",
  "Thread type",
  "Type",
  "Valve function",
  "Variant",
  "Voltage",
];

/** Värdeetiketter ur configurator_param_values, 2026-09-11. */
const VALUE_LABELS = [
  "0.005–2 bar (precision)",
  "0.01 µm — Coalescing",
  "0.2–4 bar (low pressure)",
  "0.5–10 bar (standard)",
  "146000 — Internal guide",
  "146100 — External adjustable",
  "146200 — Precision roller",
  "360° (continuous)",
  "40 µm — General",
  "5 µm — Fine",
  "5/2 bistable",
  "5/2 monostable",
  "5/3 closed centre",
  "5/3 mid-closed",
  "5/3 mid-pressurized",
  "Active — integrated guide",
  "Adjustable both ends",
  "Adjustable cushioning",
  "Adjustable cushioning + magnetic piston",
  "Angular",
  "Anodised aluminium piston rod",
  "ATEX certified",
  "Ball screw (precise)",
  "Basic variant",
  "Battery production (low Cu/Zn/Ni)",
  "Centric",
  "Centric (3-point)",
  "Connector M12",
  "Connector M8",
  "Constant slow motion",
  "Double acting",
  "Dust protection with scraper",
  "Elastic",
  "Elastic cushioning",
  "EtherCAT",
  "EtherNet/IP",
  "Extended plate",
  "Extended tie rod front",
  "Female thread",
  "Filter",
  "Filter-Regulator",
  "Filter-Regulator-Lubricator",
  "Fixed cushioning",
  "Fixed cushioning (both ends)",
  "Flange mount",
  "Food zone",
  "For proximity sensor",
  "Four-bolt",
  "Front flange",
  "G 1/4 thread",
  "G 1/8 thread",
  "Heat-resistant seals (to 120°C)",
  "Heavy duty seals",
  "High (fast)",
  "High corrosion protection",
  "High force",
  "High temperature",
  "High temperature +120°C",
  "High-flow Filter-Regulator",
  "Hydraulic adjustable (both ends)",
  "In-line (direct)",
  "IO-Link",
  "IP67 sealed",
  "Laser-etched rating plate",
  "Lead screw",
  "Low (high force)",
  "Low friction",
  "Low temperature",
  "Low temperature -40°C",
  "Low temperature (to -40°C)",
  "LP — Standard",
  "LPM — Magnetic",
  "Lubricator",
  "M5 thread",
  "M7 thread",
  "Magnetic (for sensor)",
  "Magnetic piston",
  "Male thread",
  "Manual override",
  "Multi-pin (no bus)",
  "N — No cushioning",
  "No cushioning",
  "No magnet",
  "Non-cushioned",
  "Parallel",
  "Parallel (belt)",
  "Passive — external guide",
  "Passive guide axis",
  "Plain bearing",
  "Plain bearing guide",
  "Plug socket",
  "Pneumatic adjustable",
  "Pneumatic adjustable (self-adj.)",
  "Pneumatic self-adjusting",
  "Position sensor",
  "PPE — Elastic both ends",
  "PPF — Fixed one end",
  "PPV — Adjustable both ends",
  "PROFIBUS",
  "PROFINET",
  "Progressive shock absorber",
  "PROLINE — plain bearing",
  "Quick connector",
  "Radial",
  "Rear flange",
  "Recirculating ball bearing",
  "Recirculating ball bearing guide",
  "Recirculating ball guide",
  "Regulator",
  "Reinforced piston rod",
  "Roller guide",
  "Rotation protection",
  "Round stainless rod",
  "Self-adjusting shock absorber",
  "Shock absorber",
  "Side tapped",
  "Single acting spring return",
  "Size 10",
  "Size 100",
  "Size 14",
  "Size 16",
  "Size 20",
  "Size 25",
  "Size 32",
  "Size 35",
  "Size 40",
  "Size 50",
  "Size 6",
  "Size 63",
  "Size 8",
  "Size 80",
  "SLIDELINE — roller",
  "Square piston rod (anti-rotation)",
  "Square stainless rod",
  "SR — Single acting spring return",
  "SRD — Double acting",
  "SRDM — Double acting magnetic",
  "SRM — Single acting magnetic",
  "Stainless piston rod",
  "Stainless rod",
  "Stainless steel",
  "Standard",
  "Standard plate",
  "Stroke adjustment",
  "Through hollow piston rod",
  "Through piston rod",
  "Toothed belt (fast)",
  "With magnetic piston",
  "With proximity sensor slot",
  "With proximity switch slots",
  "With sensing",
  "Without coil",
  "Without magnet",
  "Without sensing",
];

/**
 * Etiketter som med flit är IDENTISKA på svenska. Protokollnamn är egennamn,
 * och "Filter", "Regulator" och "Standard" stavas likadant på båda språken.
 */
const IDENTISKA = new Set([
  "PROFIBUS", "PROFINET", "EtherNet/IP", "EtherCAT", "IO-Link",
  "Filter", "Regulator", "Standard",
]);

Deno.test("varje parameterrubrik har en svensk översättning", () => {
  const saknas = PARAM_LABELS.filter((l) => paramLabel(l, "sv") === l && !IDENTISKA.has(l));
  assertEquals(saknas, [], `oöversatta rubriker:\n${saknas.join("\n")}`);
});

Deno.test("varje värdeetikett med ord har en svensk översättning", () => {
  const saknas = VALUE_LABELS
    .filter((l) => /[A-Za-z]{3,}/.test(l))
    .filter((l) => valueLabel(l, "sv") === l && !IDENTISKA.has(l));
  assertEquals(saknas, [], `oöversatta etiketter:\n${saknas.join("\n")}`);
});

Deno.test("andra språk än svenska rörs inte", () => {
  for (const l of [...PARAM_LABELS.slice(0, 10), ...VALUE_LABELS.slice(0, 10)]) {
    assertEquals(paramLabel(l, "en"), l);
    assertEquals(valueLabel(l, "de"), l);
    assertEquals(valueLabel(l, "es"), l);
  }
});

Deno.test("okänd etikett faller tillbaka på engelskan", () => {
  // Med flit: en felöversatt komponentbeteckning är värre än en oöversatt.
  assertEquals(valueLabel("Fnurbulator XJ-9", "sv"), "Fnurbulator XJ-9");
  assertEquals(paramLabel("Whatsit size", "sv"), "Whatsit size");
});

Deno.test("mönstren täcker storlekar och gängor utan en rad var", () => {
  assertEquals(valueLabel("Size 25", "sv"), "Storlek 25");
  assertEquals(valueLabel("Size 100", "sv"), "Storlek 100");
  assertEquals(valueLabel("M5 thread", "sv"), "M5-gänga");
  assertEquals(valueLabel("G 1/8 thread", "sv"), "G 1/8-gänga");
  // Protokoll är egennamn och ska INTE översättas.
  assertEquals(valueLabel("PROFINET", "sv"), "PROFINET");
  assertEquals(valueLabel("IO-Link", "sv"), "IO-Link");
});

Deno.test("svenska skrivregler i de översatta etiketterna", () => {
  // Decimalkomma och mellanslag före enhet -- annars ser sidan maskinöversatt ut.
  assert(valueLabel("0.005–2 bar (precision)", "sv").includes("0,005"));
  assert(valueLabel("High temperature +120°C", "sv").includes("120 °C"));
  assert(valueLabel("Low temperature -40°C", "sv").includes("−40 °C"));
});

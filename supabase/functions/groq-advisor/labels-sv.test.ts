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
import { LABEL_MAX, stripLeadingCode } from "../../../src/lib/catalog/order-code-template.ts";

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
  // Blev identisk med engelskan när versalen efter tankstrecket rättades.
  "LP — Standard",
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

/**
 * (kod, etikett) som de står i configurator_param_values, 2026-09-11.
 * Knappen visar koden ovanför och etiketten under -- testet nedan simulerar
 * exakt den renderingen.
 */
const PAR: Array<[string, string]> = [
  ["320", "320 mm"],
  ["53C", "5/3 closed centre"],
  ["MP1", "Extended tie rod front"],
  ["SRD", "SRD — Double acting"],
  ["HT", "High temperature"],
  ["shock", "Shock absorber"],
  ["A", "With proximity sensor slot"],
  ["MN", "Magnetic piston"],
  ["20", "Size 20"],
  ["4", "4 mm"],
  ["24DC", "24 V DC"],
  ["none", "Without sensing"],
  ["1/8", "G 1/8"],
  ["S6", "Heat-resistant seals (to 120°C)"],
  ["3/4", "3/4\""],
  ["G14", "G 1/4 thread"],
  ["standard", "Standard"],
  ["MF4", "Four-bolt"],
  ["Q", "Square piston rod (anti-rotation)"],
  ["yes", "With proximity switch slots"],
  ["1/4", "G 1/4"],
  ["360", "360° (continuous)"],
  ["G18", "G 1/8 thread"],
  ["25", "Size 25"],
  ["G38", "G 3/8"],
  ["ballscrew", "Ball screw (precise)"],
  ["10", "10 mm"],
  ["iolink", "IO-Link"],
  ["PB", "Plain bearing guide"],
  ["C8", "Connector M8"],
  ["LP", "LP — Standard"],
  ["none", "Without magnet"],
  ["32", "32"],
  ["RB", "Recirculating ball bearing"],
  ["TT", "Low temperature (to -40°C)"],
  ["A", "Adjustable cushioning"],
  ["flange", "Flange mount"],
  ["146000", "146000 — Internal guide"],
  ["M7", "M7 thread"],
  ["roller", "Roller guide"],
  ["32", "32 mm"],
  ["40", "Size 40"],
  ["3/8", "G 3/8"],
  ["PPF", "PPF — Fixed one end"],
  ["parallel", "Parallel (belt)"],
  ["M", "Magnetic piston"],
  ["TL", "Laser-etched rating plate"],
  ["PASSIVE", "Passive — external guide"],
  ["multipin", "Multi-pin (no bus)"],
  ["F", "Fixed cushioning"],
  ["profinet", "PROFINET"],
  ["270", "270°"],
  ["100", "100 mm"],
  ["MF2", "Rear flange"],
  ["ACTIVE", "Active — integrated guide"],
  ["0.005-2", "0.005–2 bar (precision)"],
  ["ATEX", "ATEX certified"],
  ["MA", "Male thread"],
  ["SA", "Single acting spring return"],
  ["none", "No magnet"],
  ["200", "200 mm"],
  ["I", "Female thread"],
  ["none", "No cushioning"],
  ["146200", "146200 — Precision roller"],
  ["SRM", "SRM — Single acting magnetic"],
  ["S10", "Constant slow motion"],
  ["25", "25 mm"],
  ["100", "Size 100"],
  ["S20", "Through hollow piston rod"],
  ["80", "80"],
  ["D-G18", "24 VDC"],
  ["C5", "Connector M12"],
  ["LT", "Low temperature -40°C"],
  ["ethernetip", "EtherNet/IP"],
  ["VH", "High temperature +120°C"],
  ["250", "250 mm"],
  ["12DC", "12 V DC"],
  ["16", "Size 16"],
  ["100", "100"],
  ["SA", "Shock absorber"],
  ["G12", "G 1/2"],
  ["SA-SR", "Single acting spring return"],
  ["plain", "Plain bearing"],
  ["8", "8 mm"],
  ["S11", "Low friction"],
  ["PPVA", "Pneumatic adjustable (self-adj.)"],
  ["146100", "146100 — External adjustable"],
  ["B53", "5/3 mid-closed"],
  ["R8", "Dust protection with scraper"],
  ["35", "Size 35"],
  ["DA", "Double acting"],
  ["angular", "Angular"],
  ["high", "High (fast)"],
  ["50", "50"],
  ["12", "12 mm"],
  ["F1A", "Battery production (low Cu/Zn/Ni)"],
  ["FA", "Passive guide axis"],
  ["16", "16 mm"],
  ["KS", "Stainless rod"],
  ["YSR", "Self-adjusting shock absorber"],
  ["35", "35 mm"],
  ["5", "5 µm — Fine"],
  ["PPE", "PPE — Elastic both ends"],
  ["N", "No cushioning"],
  ["belt", "Toothed belt (fast)"],
  ["BFR", "High-flow Filter-Regulator"],
  ["A", "Male thread"],
  ["D-G6", "12 VDC"],
  ["20", "20 mm"],
  ["40", "40 mm"],
  ["leadscrew", "Lead screw"],
  ["70", "70 mm"],
  ["R", "Regulator"],
  ["SRDM", "SRDM — Double acting magnetic"],
  ["9/16", "9/16\""],
  ["52", "5/2 monostable"],
  ["S2", "Through piston rod"],
  ["185", "185 mm"],
  ["90", "90°"],
  ["63", "Size 63"],
  ["G18", "G 1/8"],
  ["centric", "Centric"],
  ["160", "160 mm"],
  ["M", "Magnetic (for sensor)"],
  ["SS-SQ", "Square stainless rod"],
  ["125", "125 mm"],
  ["80", "Size 80"],
  ["TF", "Low temperature -40°C"],
  ["SS", "Stainless steel"],
  ["L", "Lubricator"],
  ["F", "Filter"],
  ["0.01", "0.01 µm — Coalescing"],
  ["2-1/2", "2-1/2\""],
  ["YSRW", "Progressive shock absorber"],
  ["SR", "SR — Single acting spring return"],
  ["A", "Adjustable both ends"],
  ["ethercat", "EtherCAT"],
  ["A-G18", "24 VAC"],
  ["MS1", "Side tapped"],
  ["GF", "Plain bearing guide"],
  ["50", "50 mm"],
  ["SLIDELINE", "SLIDELINE — roller"],
  ["P53", "5/3 mid-pressurized"],
  ["centric", "Centric (3-point)"],
  ["SS-RD", "Round stainless rod"],
  ["10", "Size 10"],
  ["highforce", "High force"],
  ["ball", "Recirculating ball guide"],
  ["3-1/4", "3-1/4\""],
  ["40", "40 µm — General"],
  ["F", "Female thread"],
  ["6", "Size 6"],
  ["HD", "Heavy duty seals"],
  ["0.2-4", "0.2–4 bar (low pressure)"],
  ["14", "Size 14"],
  ["P", "Elastic"],
  ["F1A", "Food zone"],
  ["PPS", "Pneumatic self-adjusting"],
  ["KE", "Stroke adjustment"],
  ["180", "180°"],
  ["32", "Size 32"],
  ["N", "N — No cushioning"],
  ["1-1/2", "1-1/2\""],
  ["230AC", "230 V AC"],
  ["plug", "Plug socket"],
  ["NW", "Without coil"],
  ["1", "G 1"],
  ["PPSA", "Pneumatic self-adjusting"],
  ["FH", "Hydraulic adjustable (both ends)"],
  ["M", "Adjustable cushioning + magnetic piston"],
  ["PPV", "PPV — Adjustable both ends"],
  ["ip67", "IP67 sealed"],
  ["PPV", "Pneumatic adjustable"],
  ["LT", "Low temperature"],
  ["1-1/16", "1-1/16\""],
  ["A", "With sensing"],
  ["40", "40"],
  ["18", "18 mm"],
  ["A", "For proximity sensor"],
  ["R3", "High corrosion protection"],
  ["radial", "Radial"],
  ["sensor", "Position sensor"],
  ["N", "Non-cushioned"],
  ["120", "120 mm"],
  ["3/4", "G 3/4"],
  ["C6", "Connector M8"],
  ["63", "63 mm"],
  ["LPM", "LPM — Magnetic"],
  ["G", "Basic variant"],
  ["1/2", "G 1/2"],
  ["C12", "Connector M12"],
  ["MN", "With magnetic piston"],
  ["PROLINE", "PROLINE — plain bearing"],
  ["32NC", "3/2 NC"],
  ["B", "Extended plate"],
  ["profibus", "PROFIBUS"],
  ["FR", "Filter-Regulator"],
  ["2", "2\""],
  ["8", "Size 8"],
  ["inline", "In-line (direct)"],
  ["K10", "Anodised aluminium piston rod"],
  ["P", "Elastic cushioning"],
  ["G14", "G 1/4"],
  ["MA", "Manual override"],
  ["0.5-10", "0.5–10 bar (standard)"],
  ["N", "Male thread"],
  ["QX", "Quick connector"],
  ["6", "6 mm"],
  ["125", "125"],
  ["F", "Fixed cushioning (both ends)"],
  ["KF", "Recirculating ball bearing guide"],
  ["50", "Size 50"],
  ["B52", "5/2 bistable"],
  ["M5", "M5 thread"],
  ["A", "Standard plate"],
  ["S1", "Reinforced piston rod"],
  ["FE", "Female thread"],
  ["FRL", "Filter-Regulator-Lubricator"],
  ["low", "Low (high force)"],
  ["52B", "5/2 bistable"],
  ["80", "80 mm"],
  ["MF1", "Front flange"],
  ["63", "63"],
  ["parallel", "Parallel"],
  ["KS", "Stainless piston rod"],
  ["SR", "Rotation protection"],
];

Deno.test("varje knapp i konfiguratorn renderar läsbart", () => {
  // Det HÄR är kontrollen som hittade felet.
  //
  // Knappen visar koden på egen rad och etiketten under, och etiketten körs
  // genom stripLeadingCode() som klipper bort kodprefixet. Att bara översätta
  // etiketten räcker alltså inte -- man måste se vad som blir KVAR.
  //
  // Mina första översättningar skrev gemen efter tankstrecket
  // ("PPV — justerbar i båda ändar"), vilket är rätt svenska i en mening men
  // fel här: koden klipps bort och gemenen blev första tecknet kunden ser.
  // Nio etiketter hade det felet och inget test hade fångat det.
  const fel: string[] = [];
  for (const [code, label] of PAR) {
    const sv = valueLabel(label, "sv");
    const visat = stripLeadingCode(sv, code);
    if (!visat.trim()) {
      fel.push(`TOM: code=${code} "${label}"`);
    } else if (/^[-–—:.,]/.test(visat)) {
      fel.push(`AVSKILJARE KVAR: code=${code} "${sv}" -> "${visat}"`);
    } else if (/^[a-zåäö]/.test(visat) && /^[A-ZÅÄÖ]/.test(sv)) {
      fel.push(`GEMEN EFTER KLIPP: code=${code} "${sv}" -> "${visat}"`);
    }
  }
  assertEquals(fel, [], `knappar som renderar fel:\n${fel.join("\n")}`);
});

Deno.test("ingen översatt etikett klipps mitt i ett ord", () => {
  // stripLeadingCode() kapar vid LABEL_MAX tecken. Klipps det mitt i ett ord
  // blir det "Filter-regulator med högt fl" i knappen. Kortare formulering är
  // bättre än en avhuggen.
  //
  // Taket låg på 28 och höjdes till 64 när det visade sig att P1D:s tolv
  // funktionsvärden föll ihop till fyra omöjliga att skilja åt. Testet läser
  // konstanten i stället för att upprepa siffran, så en framtida justering
  // inte lämnar två sanningar efter sig.
  const kapade: string[] = [];
  for (const [code, label] of PAR) {
    const sv = valueLabel(label, "sv");
    if (sv === label) continue; // oöversatt -- inte vårt ansvar här
    const visat = stripLeadingCode(sv, code);
    const helt = visat.length <= LABEL_MAX;
    if (!helt && !/[\s.)»"]$/.test(visat)) kapade.push(`${code}: "${sv}" -> "${visat}"`);
  }
  assertEquals(kapade, [], `avhuggna etiketter:\n${kapade.join("\n")}`);
});

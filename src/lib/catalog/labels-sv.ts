/**
 * Svenska etiketter för konfiguratorns parametrar och värden.
 *
 * VARFÖR FILEN FINNS. `configurator_params.label` och
 * `configurator_param_values.label` är EN kolumn, skriven på engelska. Följden
 * är att varje familjekonfigurator utom DSBC och P1D visar "Bore diameter
 * (mm)", "Cushioning" och "Without sensing" mitt på den svenska sidan -- 154
 * av 156 familjer. Samma sorts fel som schemaspårets rubriker hade, och det
 * märks först när man faktiskt öppnar sidorna.
 *
 * VARFÖR INTE EN DATABASKOLUMN. Översättningar är text, inte katalogdata. Att
 * lägga dem i databasen betyder att de inte kan granskas i en pull request,
 * inte testas i CI, och att nästa familj som läggs till tyst blir engelsk
 * igen. Här ligger de i versionshanteringen med ett test som jämför dem mot
 * databasens faktiska ordförråd.
 *
 * TERMINOLOGI. Orden är de som används i branschen på svenska, inte
 * ordagranna översättningar: "cushioning" är dämpning, "sensing" är
 * lägesavkänning, "bore" är kolvdiameter (inte borrning, som är hålet man
 * borrar). Protokollnamn (PROFINET, IO-Link, EtherCAT) och gängbeteckningar
 * (G 1/8, M5) översätts inte -- de är egennamn.
 *
 * Okända etiketter faller tillbaka på engelskan. Det är med flit: en
 * felöversatt komponentbeteckning är värre än en oöversatt.
 */

/** Parameterrubriker: `configurator_params.label`. */
const PARAM_SV: Record<string, string> = {
  "Action": "Verkningssätt",
  "Action type": "Verkningssätt",
  "Axis size": "Axelstorlek",
  "Bore diameter": "Kolvdiameter",
  "Bore diameter (mm)": "Kolvdiameter (mm)",
  "Cushioning": "Dämpning",
  "Drive type": "Drivtyp",
  "Electrical connection": "Elanslutning",
  "End cushioning": "Ändlägesdämpning",
  "Fieldbus / control": "Fältbuss / styrning",
  "Filter grade": "Filtergrad",
  "Gripping type": "Grepptyp",
  "Guide": "Styrning",
  "Guide bearing": "Styrlager",
  "Guide type": "Styrningstyp",
  "Motor mounting": "Motorfäste",
  "Mounting style": "Infästning",
  "Number of valve stations": "Antal ventilplatser",
  "Options": "Tillval",
  "Piston rod thread": "Kolvstångsgänga",
  "Plate style": "Bordsutförande",
  "Port size": "Anslutningsstorlek",
  "Position sensing": "Lägesavkänning",
  "Pressure range": "Tryckområde",
  "Rod type": "Kolvstångstyp",
  "Rotation angle": "Vridvinkel",
  "Sensing": "Lägesavkänning",
  "Size": "Storlek",
  "Special options": "Specialtillval",
  "Spindle lead": "Spindelstigning",
  "Stroke (mm)": "Slaglängd (mm)",
  "Stroke length": "Slaglängd",
  "Stroke per jaw (mm)": "Slag per back (mm)",
  "Thread type": "Gängtyp",
  "Type": "Typ",
  "Valve function": "Ventilfunktion",
  "Variant": "Utförande",
  "Voltage": "Spänning",
};

/** Värdeetiketter: `configurator_param_values.label`. */
const VALUE_SV: Record<string, string> = {
  "0.005–2 bar (precision)": "0,005–2 bar (precision)",
  "0.01 µm — Coalescing": "0,01 µm — koalescensfilter",
  "0.2–4 bar (low pressure)": "0,2–4 bar (lågtryck)",
  "0.5–10 bar (standard)": "0,5–10 bar (standard)",
  "146000 — Internal guide": "146000 — inbyggd styrning",
  "146100 — External adjustable": "146100 — extern justerbar",
  "146200 — Precision roller": "146200 — precisionsrulle",
  "360° (continuous)": "360° (kontinuerlig)",
  "40 µm — General": "40 µm — allmänt bruk",
  "5 µm — Fine": "5 µm — finfilter",
  "5/2 bistable": "5/2 bistabil",
  "5/2 monostable": "5/2 monostabil",
  "5/3 closed centre": "5/3 stängt mittläge",
  "5/3 mid-closed": "5/3 stängt mittläge",
  "5/3 mid-pressurized": "5/3 trycksatt mittläge",
  "Active — integrated guide": "Aktiv — inbyggd styrning",
  "Adjustable both ends": "Justerbar i båda ändar",
  "Adjustable cushioning": "Justerbar dämpning",
  "Adjustable cushioning + magnetic piston":
    "Justerbar dämpning + magnetkolv",
  "Angular": "Vinkelgrepp",
  "Anodised aluminium piston rod": "Anodiserad aluminiumkolvstång",
  "ATEX certified": "ATEX-certifierad",
  "Ball screw (precise)": "Kulskruv (precis)",
  "Basic variant": "Grundutförande",
  "Battery production (low Cu/Zn/Ni)": "Batteritillverkning (låg Cu/Zn/Ni)",
  "Centric": "Centrerande",
  "Centric (3-point)": "Centrerande (3-punkts)",
  "Connector M12": "M12-kontakt",
  "Connector M8": "M8-kontakt",
  "Constant slow motion": "Jämn, långsam rörelse",
  "Double acting": "Dubbelverkande",
  "Dust protection with scraper": "Dammskydd med avstrykare",
  "Elastic": "Elastisk",
  "Elastic cushioning": "Elastisk dämpning",
  "Extended plate": "Förlängt bord",
  "Extended tie rod front": "Förlängda dragstänger fram",
  "Female thread": "Invändig gänga",
  "Filter": "Filter",
  "Filter-Regulator": "Filter-regulator",
  "Filter-Regulator-Lubricator": "Filter-regulator-smörjare",
  "Fixed cushioning": "Fast dämpning",
  "Fixed cushioning (both ends)": "Fast dämpning (båda ändar)",
  "Flange mount": "Flänsinfästning",
  "Food zone": "Livsmedelszon",
  "For proximity sensor": "För cylindergivare",
  "Four-bolt": "Fyrbultsinfästning",
  "Front flange": "Framfläns",
  "G 1/4 thread": "G 1/4-gänga",
  "G 1/8 thread": "G 1/8-gänga",
  "Heat-resistant seals (to 120°C)": "Värmetåliga tätningar (upp till 120 °C)",
  "Heavy duty seals": "Kraftiga tätningar",
  "High (fast)": "Hög (snabb)",
  "High corrosion protection": "Högt korrosionsskydd",
  "High force": "Hög kraft",
  "High temperature": "Hög temperatur",
  "High temperature +120°C": "Hög temperatur +120 °C",
  "High-flow Filter-Regulator": "Filter-regulator med högt flöde",
  "Hydraulic adjustable (both ends)": "Hydrauliskt justerbar (båda ändar)",
  "In-line (direct)": "I linje (direktdriven)",
  "IP67 sealed": "IP67-tätad",
  "Laser-etched rating plate": "Laseretsad märkskylt",
  "Lead screw": "Trapetsskruv",
  "Low (high force)": "Låg (hög kraft)",
  "Low friction": "Låg friktion",
  "Low temperature": "Låg temperatur",
  "Low temperature -40°C": "Låg temperatur −40 °C",
  "Low temperature (to -40°C)": "Låg temperatur (ned till −40 °C)",
  "LP — Standard": "LP — standard",
  "LPM — Magnetic": "LPM — magnetkolv",
  "Lubricator": "Smörjare",
  "Magnetic (for sensor)": "Magnetkolv (för givare)",
  "Magnetic piston": "Magnetkolv",
  "Male thread": "Utvändig gänga",
  "Manual override": "Manuell manöver",
  "Multi-pin (no bus)": "Multipolanslutning (utan buss)",
  "N — No cushioning": "N — ingen dämpning",
  "No cushioning": "Ingen dämpning",
  "No magnet": "Utan magnet",
  "Non-cushioned": "Odämpad",
  "Parallel": "Parallellgrepp",
  "Parallel (belt)": "Parallell (rem)",
  "Passive — external guide": "Passiv — extern styrning",
  "Passive guide axis": "Passiv styraxel",
  "Plain bearing": "Glidlager",
  "Plain bearing guide": "Glidlagerstyrning",
  "Plug socket": "Kabelkontakt",
  "Pneumatic adjustable": "Pneumatisk, justerbar",
  "Pneumatic adjustable (self-adj.)": "Pneumatisk, justerbar (självjusterande)",
  "Pneumatic self-adjusting": "Pneumatisk, självjusterande",
  "Position sensor": "Lägesgivare",
  "PPE — Elastic both ends": "PPE — elastisk i båda ändar",
  "PPF — Fixed one end": "PPF — fast i ena änden",
  "PPV — Adjustable both ends": "PPV — justerbar i båda ändar",
  "Progressive shock absorber": "Progressiv stötdämpare",
  "PROLINE — plain bearing": "PROLINE — glidlager",
  "Quick connector": "Snabbkoppling",
  "Radial": "Radiellt grepp",
  "Rear flange": "Bakfläns",
  "Recirculating ball bearing": "Kullagerstyrning",
  "Recirculating ball bearing guide": "Kullagerstyrning",
  "Recirculating ball guide": "Kullagerstyrning",
  "Regulator": "Regulator",
  "Reinforced piston rod": "Förstärkt kolvstång",
  "Roller guide": "Rullstyrning",
  "Rotation protection": "Vridskydd",
  "Round stainless rod": "Rund rostfri kolvstång",
  "Self-adjusting shock absorber": "Självjusterande stötdämpare",
  "Shock absorber": "Stötdämpare",
  "Side tapped": "Gängad från sidan",
  "Single acting spring return": "Enkelverkande med fjäderretur",
  "SLIDELINE — roller": "SLIDELINE — rulle",
  "Square piston rod (anti-rotation)": "Fyrkantig kolvstång (vridsäker)",
  "Square stainless rod": "Fyrkantig rostfri kolvstång",
  "SR — Single acting spring return": "SR — enkelverkande med fjäderretur",
  "SRD — Double acting": "SRD — dubbelverkande",
  "SRDM — Double acting magnetic": "SRDM — dubbelverkande med magnetkolv",
  "SRM — Single acting magnetic": "SRM — enkelverkande med magnetkolv",
  "Stainless piston rod": "Rostfri kolvstång",
  "Stainless rod": "Rostfri kolvstång",
  "Stainless steel": "Rostfritt stål",
  "Standard": "Standard",
  "Standard plate": "Standardbord",
  "Stroke adjustment": "Slagjustering",
  "Through hollow piston rod": "Genomgående ihålig kolvstång",
  "Through piston rod": "Genomgående kolvstång",
  "Toothed belt (fast)": "Kuggrem (snabb)",
  "With magnetic piston": "Med magnetkolv",
  "With proximity sensor slot": "Med spår för cylindergivare",
  "With proximity switch slots": "Med spår för cylindergivare",
  "With sensing": "Med lägesavkänning",
  "Without coil": "Utan spole",
  "Without magnet": "Utan magnet",
  "Without sensing": "Utan lägesavkänning",
};

/**
 * Mönster som täcker familjer av etiketter i stället för en rad var.
 * "Size 10" ... "Size 100" är femton rader som säger samma sak.
 */
const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^Size (\d+)$/, (m) => `Storlek ${m[1]}`],
  [/^(M\d+|G ?\d+\/\d+) thread$/, (m) => `${m[1]}-gänga`],
  // Protokoll och spänningar är egennamn respektive enheter: PROFINET,
  // IO-Link, EtherCAT, 24 VDC. De lämnas som de är, och fångas här så att
  // täckningstestet inte kräver en översättning som inte ska finnas.
  [/^(PROFIBUS|PROFINET|EtherNet\/IP|EtherCAT|IO-Link)$/, (m) => m[1]],
  [/^\d+ ?V(DC|AC)$/, (m) => m[0].replace(/V(DC|AC)/, " V $1").replace(/\s+/g, " ").trim()],
];

function slaUpp(karta: Record<string, string>, label: string): string {
  const direkt = karta[label];
  if (direkt) return direkt;
  for (const [re, fn] of PATTERNS) {
    const m = label.match(re);
    if (m) return fn(m);
  }
  return label;
}

/** Parameterrubrik på kundens språk. Okänd etikett -> engelskan. */
export function paramLabel(label: string, locale: string): string {
  return locale === "sv" ? slaUpp(PARAM_SV, label) : label;
}

/** Värdeetikett på kundens språk. Okänd etikett -> engelskan. */
export function valueLabel(label: string, locale: string): string {
  return locale === "sv" ? slaUpp(VALUE_SV, label) : label;
}

/** Exporteras för täckningstestet. */
export const LABELS_SV = { PARAM_SV, VALUE_SV, PATTERNS };

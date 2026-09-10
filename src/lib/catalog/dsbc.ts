/**
 * Festo DSBC — kanonisk beställnyckel, härledd ur tillverkarens katalog.
 *
 * KÄLLA (enda sanningen — ändra aldrig värden här utan att peka på källan):
 *   Festo, "Standards-based cylinders DSBC, to ISO 15552", utgåva 2026/09.
 *   Typkodstabellen (position 001-020) och "Ordering data - Modular product
 *   system" med fotnoterna [1]-[18]. Dokumentet ligger i knowledge_chunks som
 *   source_file = '202904_documentation.pdf'.
 *
 * VARFÖR FILEN FINNS. Katalogen var inläst i kunskapsbanken sedan 2026-05-19,
 * men den strukturerade modellen bredvid den fylldes i för hand. Följden:
 * konfiguratorn erbjöd S2, KP, S6 och TT -- fyra koder som inte förekommer en
 * enda gång i Festos katalog -- och kapade slaglängden vid 2000 mm när
 * katalogen säger 2800. Ingen kunde upptäcka det, för ingenting jämförde
 * modellen mot dokumentet.
 *
 * Den här filen är den jämförelsen. Den är källen; databasen genereras ur den
 * (se scripts/gen-dsbc-migration.ts) och ett CI-test failar om de glider isär.
 * Lägg aldrig till ett värde här som inte står i katalogen.
 *
 * ORDNINGEN på positionerna är inte gissad: den verifieras mot 455 riktiga
 * orderkoder med Festos egna artikelnummer, hämtade ur samma dokument
 * (dsbc-corpus.json). Varje kod måste parsa, valideras ren, och serialiseras
 * tillbaka till sig själv.
 */

/** En position i beställnyckeln. `values: null` = fritt numeriskt värde. */
export interface DsbcPosition {
  /** Festos positionsnummer i typkodstabellen (001-020). */
  pos: string;
  key: string;
  label_sv: string;
  /** Tillåtna koder. Tom sträng = "standard", dvs positionen utelämnas. */
  values: Array<{ code: string; label_sv: string }> | null;
  /** För numeriska positioner. */
  range?: { min: number; max: number; unit: string };
  /** Suffix som fogas till talet i orderkoden, t.ex. 500 + "E" -> "500E". */
  numeric_suffix?: string;
}

export const DSBC_SERIES = "DSBC";

/** Katalogens utgåva. Bumpa när ett nytt dokument läses in. */
export const DSBC_SOURCE = {
  file: "202904_documentation.pdf",
  edition: "2026/09",
  title: "Standards-based cylinders DSBC, to ISO 15552",
} as const;

/**
 * Positionerna i den ordning de förekommer i orderkoden.
 *
 * Ordningen är verifierad mot corpus: alla 455 lagerförda koder
 * (DSBC-<borr>-<slag>[-D3]-PP{V|S}A-N3) faller ut ur exakt den här sekvensen.
 */
export const DSBC_POSITIONS: DsbcPosition[] = [
  {
    pos: "002",
    key: "rotation_lock",
    label_sv: "Vridskydd",
    values: [
      { code: "", label_sv: "Utan" },
      { code: "Q", label_sv: "Med vridskydd" },
    ],
  },
  {
    pos: "003",
    key: "running",
    label_sv: "Gångegenskaper",
    values: [
      { code: "", label_sv: "Standard" },
      { code: "L", label_sv: "Låg friktion" },
      { code: "U", label_sv: "Jämn, långsam rörelse" },
      { code: "L1", label_sv: "Låg friktion för balanserapplikationer" },
    ],
  },
  {
    pos: "004",
    key: "bore_mm",
    label_sv: "Kolvdiameter",
    // Etiketten upprepar inte talet: konfiguratorn visar koden på egen rad
    // ovanför, så "32" + "mm" läser rätt medan "32" + "Ø32 mm" blir dubbelt.
    values: [32, 40, 50, 63, 80, 100, 125].map((n) => ({
      code: String(n),
      label_sv: "mm",
    })),
  },
  {
    pos: "005",
    key: "stroke_mm",
    label_sv: "Slaglängd",
    values: null,
    // Katalogen: "1 ... 2800 mm". Den tidigare modellen sa 2000 -- fel.
    range: { min: 1, max: 2800, unit: "mm" },
  },
  {
    pos: "006",
    key: "clamping",
    label_sv: "Klämenhet",
    values: [
      { code: "", label_sv: "Utan" },
      { code: "C", label_sv: "Påbyggd klämenhet" },
    ],
  },
  {
    pos: "007",
    key: "end_lock",
    label_sv: "Ändlägeslåsning",
    values: [
      { code: "", label_sv: "Utan" },
      { code: "E1", label_sv: "Båda sidor" },
      { code: "E2", label_sv: "Med utskjuten kolvstång" },
      { code: "E3", label_sv: "Med indragen kolvstång" },
    ],
  },
  {
    pos: "008",
    key: "rod_type",
    label_sv: "Kolvstångstyp",
    values: [
      { code: "", label_sv: "Enkelsidig" },
      { code: "T", label_sv: "Genomgående kolvstång" },
    ],
  },
  {
    pos: "009",
    key: "rod_thread",
    label_sv: "Kolvstångsgänga",
    values: [
      { code: "", label_sv: "Utvändig gänga" },
      { code: "F", label_sv: "Invändig gänga" },
    ],
  },
  {
    pos: "010",
    key: "profile",
    label_sv: "Profiltyp",
    values: [
      { code: "", label_sv: "Givarspår på en sida" },
      { code: "D3", label_sv: "Givarspår på tre sidor" },
    ],
  },
  {
    pos: "011",
    key: "cushioning",
    label_sv: "Dämpning",
    values: [
      { code: "P", label_sv: "Elastiska dämpringar i båda ändar" },
      { code: "PPS", label_sv: "Pneumatisk dämpning, självjusterande i båda ändar" },
      { code: "PPV", label_sv: "Pneumatisk dämpning, justerbar i båda ändar" },
    ],
  },
  {
    pos: "012",
    key: "sensing",
    label_sv: "Lägesavkänning",
    values: [
      { code: "", label_sv: "Utan" },
      { code: "A", label_sv: "För cylindergivare" },
    ],
  },
  {
    pos: "N3",
    key: "standard_conformity",
    label_sv: "Standard",
    values: [
      { code: "", label_sv: "Baserad på ISO 15552" },
      // N3 är en STANDARDKONFORMITETSKOD, inte en kapslingsklass. Rådgivaren
      // påstod en gång att "N3 motsvarar IP67" -- rent påhitt, och anledningen
      // till att den här etiketten står ordagrant som i katalogen.
      { code: "N3", label_sv: "Uppfyller ISO 15552" },
    ],
  },
  {
    pos: "013",
    key: "corrosion",
    label_sv: "Korrosionsskydd",
    values: [
      { code: "", label_sv: "Standard" },
      { code: "R3", label_sv: "Högt korrosionsskydd" },
    ],
  },
  {
    pos: "014",
    key: "temperature",
    label_sv: "Temperaturområde",
    values: [
      { code: "", label_sv: "Standard" },
      { code: "T1", label_sv: "Värmetåliga tätningar max 120 °C" },
      { code: "T3", label_sv: "−40 … +80 °C" },
      { code: "T4", label_sv: "0 … +150 °C" },
    ],
  },
  {
    pos: "015",
    key: "particles",
    label_sv: "Partikelskydd",
    values: [
      { code: "", label_sv: "Standard" },
      { code: "P2", label_sv: "Bälg på lagerlocket" },
    ],
  },
  {
    pos: "016",
    key: "scraper",
    label_sv: "Avstrykarvariant",
    values: [
      { code: "", label_sv: "Standard" },
      { code: "A1", label_sv: "Ökad kemikalieresistens" },
      { code: "A2", label_sv: "Hård avstrykare" },
      { code: "A3", label_sv: "För osmord drift" },
      { code: "A6", label_sv: "Metallavstrykare" },
    ],
  },
  {
    pos: "017",
    key: "material",
    label_sv: "Särskilda materialegenskaper",
    values: [
      { code: "", label_sv: "Standard" },
      { code: "F1A", label_sv: "Rekommenderad för tillverkning av litiumjonbatterier" },
    ],
  },
  {
    pos: "018",
    key: "eu_cert",
    label_sv: "EU-certifiering",
    values: [
      { code: "", label_sv: "Utan" },
      { code: "EX4", label_sv: "II 2GD (ATEX)" },
    ],
  },
  {
    pos: "KE",
    key: "stroke_adjust_mm",
    label_sv: "Slagjustering, utgående",
    values: null,
    // Katalogen: 0...25 mm för Ø32, 0...50 mm från Ø40. Storleksberoendet
    // ligger som regel nedan; range är det yttersta spannet.
    range: { min: 0, max: 50, unit: "mm" },
    numeric_suffix: "KE",
  },
  {
    pos: "019",
    key: "rod_extension_mm",
    label_sv: "Kolvstångsförlängning",
    values: null,
    range: { min: 0, max: 500, unit: "mm" },
    numeric_suffix: "E",
  },
  {
    pos: "020",
    key: "rod_thread_extension_mm",
    label_sv: "Gängförlängning på kolvstång",
    values: null,
    // Katalogen: 1...35 för Ø32/40, 1...70 från Ø50. Storleksberoendet ligger
    // som regel nedan, inte här -- range är det yttersta spannet.
    range: { min: 0, max: 70, unit: "mm" },
    numeric_suffix: "L",
  },
];

/** Villkorsregel. `when` är JSON-logik som configurator-engine.evalLogic kör. */
export interface DsbcRule {
  /** Festos fotnotsnummer i beställtabellen, för spårbarhet. */
  note: string;
  severity: "error" | "warning";
  when: Record<string, unknown>;
  message_sv: string;
  message_en: string;
}

const isOneOf = (key: string, codes: string[]) => ({ in: [{ var: key }, codes] });
const eq = (key: string, code: string) => ({ "==": [{ var: key }, code] });
const strokeOver = (mm: number) => ({ ">": [{ var: "stroke_mm" }, mm] });

/**
 * De 18 villkoren ur "Ordering data - Modular product system", fotnot [1]-[18].
 *
 * Varje regel är sann NÄR KOMBINATIONEN ÄR OTILLÅTEN -- samma konvention som
 * configurator-engine.validate() redan använder (den larmar när if_json är
 * sann). Utan de här reglerna kunde konfiguratorn producera orderkoder som
 * Festo inte kan leverera, vilket den kunde fram till nu.
 */
export const DSBC_RULES: DsbcRule[] = [
  {
    note: "1",
    severity: "error",
    when: { and: [eq("rotation_lock", "Q"), strokeOver(1500)] },
    message_sv: "Vridskydd Q går bara upp till 1500 mm slaglängd.",
    message_en: "Protection against rotation Q is only available up to 1500 mm stroke.",
  },
  {
    note: "2",
    severity: "error",
    when: { and: [isOneOf("running", ["L", "U"]), eq("rotation_lock", "Q")] },
    message_sv: "Gångegenskaperna L och U kan inte kombineras med vridskydd Q.",
    message_en: "Running characteristics L and U cannot be combined with Q.",
  },
  {
    note: "3",
    severity: "error",
    when: { and: [eq("running", "L1"), strokeOver(1000)] },
    message_sv: "L1 (balanserapplikationer) går bara upp till 1000 mm slaglängd.",
    message_en: "L1 (balancer applications) is only available up to 1000 mm stroke.",
  },
  {
    note: "4",
    severity: "error",
    when: { and: [eq("rod_type", "T"), isOneOf("running", ["L", "U"])] },
    message_sv: "Genomgående kolvstång T kan inte kombineras med L eller U.",
    message_en: "Through piston rod T cannot be combined with L or U.",
  },
  {
    note: "5",
    severity: "error",
    when: {
      and: [
        { or: [eq("rod_type", "T"), eq("cushioning", "PPV")] },
        eq("running", "L1"),
      ],
    },
    message_sv: "Genomgående kolvstång T och dämpning PPV kan inte kombineras med L1.",
    message_en: "Through piston rod T and PPV cushioning cannot be combined with L1.",
  },
  {
    note: "6a",
    severity: "error",
    when: { and: [eq("rod_thread", "F"), eq("standard_conformity", "N3")] },
    message_sv: "Invändig kolvstångsgänga F kan inte kombineras med N3.",
    message_en: "Female piston rod thread F cannot be combined with N3.",
  },
  {
    note: "6b",
    severity: "error",
    when: {
      and: [
        {
          or: [
            eq("corrosion", "R3"),
            isOneOf("temperature", ["T1", "T3", "T4"]),
            eq("particles", "P2"),
            isOneOf("scraper", ["A1", "A2", "A3", "A6"]),
            eq("eu_cert", "EX4"),
          ],
        },
        isOneOf("running", ["L", "U", "L1"]),
      ],
    },
    message_sv:
      "R3, T1/T3/T4, P2, A1/A2/A3/A6 och EX4 kan inte kombineras med gångegenskaperna L, U eller L1.",
    message_en: "R3, T1/T3/T4, P2, A1/A2/A3/A6 and EX4 cannot be combined with L, U or L1.",
  },
  {
    note: "7",
    severity: "error",
    when: {
      and: [
        { or: [isOneOf("temperature", ["T1", "T3", "T4"]), eq("scraper", "A1")] },
        eq("cushioning", "PPS"),
      ],
    },
    message_sv: "T1/T3/T4 och A1 kan inte kombineras med självjusterande dämpning PPS.",
    message_en: "T1/T3/T4 and A1 cannot be combined with PPS cushioning.",
  },
  {
    note: "8",
    severity: "error",
    when: {
      and: [
        {
          or: [
            isOneOf("temperature", ["T3", "T4"]),
            eq("particles", "P2"),
            isOneOf("scraper", ["A1", "A2", "A3", "A6"]),
          ],
        },
        eq("rotation_lock", "Q"),
      ],
    },
    message_sv: "T3/T4, P2 och A1/A2/A3/A6 kan inte kombineras med vridskydd Q.",
    message_en: "T3/T4, P2 and A1/A2/A3/A6 cannot be combined with Q.",
  },
  {
    note: "9",
    severity: "error",
    when: {
      and: [
        {
          or: [
            eq("particles", "P2"),
            { ">": [{ var: "rod_extension_mm" }, 0] },
            { ">": [{ var: "rod_thread_extension_mm" }, 0] },
          ],
        },
        eq("standard_conformity", "N3"),
      ],
    },
    message_sv: "Bälg P2 och kolvstångsförlängning kan inte kombineras med N3.",
    message_en: "Bellows P2 and piston rod extensions cannot be combined with N3.",
  },
  {
    note: "10",
    severity: "error",
    when: {
      and: [
        {
          or: [
            eq("particles", "P2"),
            isOneOf("scraper", ["A1", "A2", "A3"]),
            eq("eu_cert", "EX4"),
          ],
        },
        isOneOf("temperature", ["T1", "T3", "T4"]),
      ],
    },
    message_sv: "P2, A1/A2/A3 och EX4 kan inte kombineras med T1, T3 eller T4.",
    message_en: "P2, A1/A2/A3 and EX4 cannot be combined with T1, T3 or T4.",
  },
  {
    note: "11",
    severity: "error",
    when: { and: [eq("particles", "P2"), strokeOver(500)] },
    message_sv: "Bälg P2 går bara upp till 500 mm slaglängd.",
    message_en: "Bellows P2 is only available up to 500 mm stroke.",
  },
  {
    note: "12",
    severity: "error",
    when: { and: [eq("scraper", "A1"), eq("cushioning", "P")] },
    message_sv: "Avstrykare A1 kan inte kombineras med elastisk dämpning P.",
    message_en: "Scraper A1 cannot be combined with elastic cushioning P.",
  },
  {
    note: "13",
    severity: "error",
    when: {
      and: [
        { or: [isOneOf("scraper", ["A1", "A2", "A3", "A6"]), eq("eu_cert", "EX4")] },
        eq("particles", "P2"),
      ],
    },
    message_sv: "A1/A2/A3/A6 och EX4 kan inte kombineras med bälg P2.",
    message_en: "A1/A2/A3/A6 and EX4 cannot be combined with bellows P2.",
  },
  {
    note: "14",
    severity: "error",
    when: { and: [isOneOf("scraper", ["A1", "A3", "A6"]), eq("eu_cert", "EX4")] },
    message_sv: "Avstrykare A1, A3 och A6 kan inte kombineras med EX4.",
    message_en: "Scrapers A1, A3 and A6 cannot be combined with EX4.",
  },
  {
    note: "15",
    severity: "error",
    when: { and: [isOneOf("scraper", ["A2", "A6"]), eq("corrosion", "R3")] },
    message_sv: "Avstrykare A2 och A6 kan inte kombineras med korrosionsskydd R3.",
    message_en: "Scrapers A2 and A6 cannot be combined with R3.",
  },
  {
    note: "16",
    severity: "error",
    when: {
      and: [
        {
          or: [
            { ">": [{ var: "rod_extension_mm" }, 0] },
            { ">": [{ var: "rod_thread_extension_mm" }, 0] },
          ],
        },
        strokeOver(2000),
      ],
    },
    message_sv: "Kolvstångsförlängning går bara upp till 2000 mm slaglängd.",
    message_en: "Piston rod extensions are only available up to 2000 mm stroke.",
  },
  {
    note: "17",
    severity: "error",
    when: {
      and: [{ ">": [{ var: "rod_thread_extension_mm" }, 0] }, eq("rod_thread", "F")],
    },
    message_sv: "Gängförlängning kan inte kombineras med invändig gänga F.",
    message_en: "Thread extension cannot be combined with female thread F.",
  },
  {
    note: "18",
    severity: "error",
    // Fotnot [18]: KE bara upp till 1500 mm, inte med kombinationen Q-C, och
    // inte med L, U, L1, N3, T1, T3, T4, A1, A2, A6 eller EX4.
    when: {
      and: [
        { ">": [{ var: "stroke_adjust_mm" }, 0] },
        {
          or: [
            strokeOver(1500),
            { and: [eq("rotation_lock", "Q"), eq("clamping", "C")] },
            isOneOf("running", ["L", "U", "L1"]),
            eq("standard_conformity", "N3"),
            isOneOf("temperature", ["T1", "T3", "T4"]),
            isOneOf("scraper", ["A1", "A2", "A6"]),
            eq("eu_cert", "EX4"),
          ],
        },
      ],
    },
    message_sv:
      "Slagjustering KE går bara upp till 1500 mm och kan inte kombineras med Q+C, L/U/L1, N3, T1/T3/T4, A1/A2/A6 eller EX4.",
    message_en:
      "Stroke adjustment KE is limited to 1500 mm and cannot be combined with Q+C, L/U/L1, N3, T1/T3/T4, A1/A2/A6 or EX4.",
  },
  {
    note: "18b",
    severity: "error",
    when: { and: [{ ">": [{ var: "stroke_adjust_mm" }, 25] }, eq("bore_mm", "32")] },
    message_sv: "Slagjusteringen är max 25 mm för Ø32.",
    message_en: "Stroke adjustment is limited to 25 mm for Ø32.",
  },
  {
    note: "20",
    severity: "error",
    // Katalogen: 1...35 mm för Ø32 och Ø40, 1...70 mm från Ø50 och uppåt.
    when: {
      and: [
        { ">": [{ var: "rod_thread_extension_mm" }, 35] },
        isOneOf("bore_mm", ["32", "40"]),
      ],
    },
    message_sv: "Gängförlängningen är max 35 mm för Ø32 och Ø40.",
    message_en: "Thread extension is limited to 35 mm for Ø32 and Ø40.",
  },
];

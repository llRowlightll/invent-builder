/**
 * Parker P1D — kanonisk beställnyckel, härledd ur tillverkarens katalog.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Parker Hannifin, "P1D Series Pneumatic Cylinders", PDE2570TCUK.
 *   Dokumentet ligger i knowledge_chunks som
 *   source_file = 'Parker P1D ISO cylinder current.pdf'. Beställnyckeln står
 *   under "The simple and complete order code key" (chunk 63-74), med
 *   positionsnumreringen utskriven tecken för tecken i chunk 66 och 73.
 *
 * FAMILJ NUMMER TVÅ efter DSBC, och den skiljer sig på ett sätt som styr hela
 * filen: DSBC:s kod är AVGRÄNSAD (segment mellan bindestreck, ovalda positioner
 * utelämnas helt), medan P1D:s är POSITIONELL — varje tecken har en bestämd
 * plats och inget kan utelämnas:
 *
 *   pos:  1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
 *         P 1 D - S 0 5 0 M  S  -  0  2  0  0
 *
 * Borrningen är tre tecken, slaglängden fyra. Den tidigare modellen hade mallen
 * "P1D-S{bore_mm}M{thread}-{stroke_mm}", som producerar "P1D-S50MS-200" — en
 * kod som inte finns. Nollutfyllnaden saknades, och därmed kunde konfiguratorn
 * inte bygga en enda beställbar P1D.
 *
 * KATALOGENS EGEN GRUNDREGEL (chunk 64), som är värd att citera ordagrant:
 *   "Remember that there are always 15 or 20 positions in the order number
 *    — never any figure in between."
 * 20-teckensformen används när cylindern beställs med fabriksmonterat infäste
 * eller ventil; positionerna 16-20 beskrivs längst ned i filen.
 *
 * OM POSITION 10. Den första läsningen av den här tabellen blev BAKVÄND.
 * Textutvinningen ur PDF:en råkade läsa materialkolumnen i omvänd ordning
 * (chunk 113), vilket gav S = kromad rostfri i stället för S = rostfri. Felet
 * hittades genom att katalogen trycker samma tabell en gång till på en annan
 * sida (chunk 66 och 72), och avgjordes av tre oberoende ställen i samma
 * dokument som alla säger samma sak om standardkoden P1D-S***MS:
 *   - chunk 64: "standard piston rod material (stainless steel) ... P1D-S032MS-0160"
 *   - chunk 70: "P1D-S032MS-0100 ... with stainless steel piston rod (standard)"
 *   - chunk 47: standardutförandets materialspecifikation, "Piston rod:
 *     Stainless steel, X 10 CrNiS 18 9", med de tre övriga som tillval.
 * Lärdomen står kvar här med flit: en tabell som bara lästs en gång är inte
 * verifierad, hur tydlig den än ser ut.
 */
import type { DsbcPosition, DsbcRule } from "./dsbc";

/** Samma form som DSBC:s positioner. Delas när en tredje familj tillkommer. */
export type P1dPosition = DsbcPosition;
export type P1dRule = DsbcRule;

export const P1D_SERIES = "P1D";

export const P1D_SOURCE = {
  file: "Parker P1D ISO cylinder current.pdf",
  edition: "PDE2570TCUK",
  title: "P1D Series Pneumatic Cylinders",
} as const;

/**
 * Antal tecken talen fylls ut till. Skillnaden mellan en kod som går att
 * beställa och en som inte existerar.
 */
export interface P1dNumericPad {
  key: string;
  pad: number;
}

export const P1D_PADDING: P1dNumericPad[] = [
  { key: "bore_mm", pad: 3 },   // 050, inte 50
  { key: "stroke_mm", pad: 4 }, // 0200, inte 200
];

export const P1D_BORES = [32, 40, 50, 63, 80, 100, 125];

export const P1D_POSITIONS: P1dPosition[] = [
  {
    pos: "5",
    key: "version",
    label_sv: "Cylinderutförande",
    label_en: "Cylinder version",
    values: [
      { code: "S", label_sv: "Standard" },
      { code: "C", label_sv: "Ultra Clean eller Pro Clean (avgörs av position 11)" },
      { code: "V", label_sv: "Standard med påbyggd ventil (ger 20-teckenskod)" },
      { code: "L", label_sv: "Med dynamisk kolvstångslåsning" },
      { code: "H", label_sv: "Med statisk kolvstångslåsning" },
    ],
  },
  {
    pos: "6-7-8",
    key: "bore_mm",
    label_sv: "Kolvdiameter",
    label_en: "Cylinder bore",
    // Tre tecken med inledande nolla: 032, inte 32. Samma tre positioner bär
    // förlängd kolvstång i bokstavsform -- se P1D_ROD_EXTENSION_BORE nedan.
    values: P1D_BORES.map((n) => ({ code: String(n).padStart(3, "0"), label_sv: "mm" })),
  },
  {
    pos: "9",
    key: "function",
    label_sv: "Funktion, gavelskruvar och avstrykare",
    label_en: "Function, end cover screws and scraper",
    // Position 9 bär TRE egenskaper samtidigt -- verkningssätt, skruvmaterial
    // och avstrykartyp -- kodade som en bokstav. Sex kombinationer för
    // dubbelverkande, sex för genomgående kolvstång (chunk 74).
    values: [
      { code: "M", label_sv: "Dubbelverkande, std skruvar, std avstrykare" },
      { code: "D", label_sv: "Dubbelverkande, std skruvar, HDPE-avstrykare" },
      { code: "V", label_sv: "Dubbelverkande, std skruvar, FPM-avstrykare" },
      { code: "A", label_sv: "Dubbelverkande, rostfria skruvar, std avstrykare" },
      { code: "H", label_sv: "Dubbelverkande, rostfria skruvar, HDPE-avstrykare" },
      { code: "W", label_sv: "Dubbelverkande, rostfria skruvar, FPM-avstrykare" },
      { code: "F", label_sv: "Genomgående kolvstång, std skruvar, std avstrykare" },
      { code: "E", label_sv: "Genomgående kolvstång, std skruvar, HDPE-avstrykare" },
      { code: "B", label_sv: "Genomgående kolvstång, std skruvar, FPM-avstrykare" },
      { code: "G", label_sv: "Genomgående kolvstång, rostfria skruvar, std avstrykare" },
      { code: "Y", label_sv: "Genomgående kolvstång, rostfria skruvar, HDPE-avstrykare" },
      { code: "Z", label_sv: "Genomgående kolvstång, rostfria skruvar, FPM-avstrykare" },
    ],
  },
  {
    pos: "10",
    key: "rod_material",
    label_sv: "Kolvstångs- och tätningsmaterial",
    label_en: "Piston rod and seal material",
    // Katalogen, ordagrant (chunk 66 och 72):
    //   "Piston rod Seals material / S C M R / Standard -20 °C to +80 °C.
    //    Stainless steel / Chromium-plated steel / Acid-proof steel /
    //    Chrom.-pl. stainless steel"
    // Materialbeteckningarna kommer ur materialspecifikationen (chunk 47).
    values: [
      { code: "S", label_sv: "Rostfritt stål, X 10 CrNiS 18 9 (standard)" },
      { code: "C", label_sv: "Hårdförkromat stål, Fe 490-2 FN" },
      { code: "M", label_sv: "Syrafast stål, X 5 CrNiMo 17 13 3" },
      { code: "R", label_sv: "Hårdförkromat rostfritt stål, X 10 CrNiS 18 9" },
    ],
  },
  {
    pos: "11",
    key: "position_11",
    label_sv: "Ren design",
    label_en: "Clean design",
    // Position 11 SER UT som ett bindestreck i standardkoden men är en
    // valbar position (chunk 73: "* -, N, T, Y, W, V or valve options").
    // Ultra Clean och Pro Clean ryms i 15-teckensformen; ventilvarianterna
    // gör inte det -- de ligger i P1D_VALVE_POS_11 och erbjuds inte här,
    // eftersom konfiguratorn inte kan fylla positionerna 16-20.
    values: [
      { code: "-", label_sv: "Ingen — standardcylinder" },
      { code: "N", label_sv: "Ultra Clean (utan givarfunktion)" },
      { code: "T", label_sv: "Pro Clean, 2 T-spår upptill" },
      { code: "Y", label_sv: "Pro Clean, 2 T-spår till höger" },
      { code: "W", label_sv: "Pro Clean, 2 T-spår nedtill" },
      { code: "V", label_sv: "Pro Clean, 2 T-spår till vänster" },
    ],
  },
  {
    pos: "12-13-14-15",
    key: "stroke_mm",
    label_sv: "Slaglängd",
    label_en: "Stroke",
    values: null,
    // Katalogen (chunk 44): "Standard strokes 25 - 500 mm according to
    // ISO 4393. Max stroke 2800 mm", och (chunk 45) "Special strokes up to
    // 2800 mm". Den tidigare modellen sa 2000 -- samma fel som DSBC hade, och
    // samma orsak: ett handskrivet värde bredvid ett oläst dokument.
    range: { min: 1, max: 2800, unit: "mm" },
  },
  {
    // INGEN KODPOSITION -- en fråga. ATEX är för DSBC en egen position i
    // typkoden (EX2/EX3/EX4), men för P1D är det en NOT: katalogen märker
    // standardcylindern II 2GD c T4 120 °C och säger att märkningen bara
    // gäller den. Frågan måste ändå ställas, annars kan villkoret P4 aldrig
    // bli sant -- en regel som läser ett fält konfiguratorn inte erbjuder är
    // en regel som aldrig larmar. Se testet "varje variabel en regel läser
    // finns som fält".
    pos: "—",
    key: "atex",
    label_sv: "Explosionsfarlig miljö (ATEX)",
    label_en: "Explosive atmosphere (ATEX)",
    values: [
      { code: "", label_sv: "Nej" },
      { code: "ja", label_sv: "Ja — ATEX-zon" },
    ],
  },
];

/**
 * Positionerna i den ordning de står i KODEN.
 *
 * Position 11 ligger MELLAN kolvstångsmaterialet och slaglängden -- det är
 * tecknet som ser ut som ett bindestreck i "P1D-S032MS-0100" men som i själva
 * verket är en valbar position. Därför får det inte hårdkodas som "-" i mallen.
 *
 * Listan är också gränsen mellan kod och frågeformulär: en position i
 * P1D_POSITIONS som INTE står här (atex) ställs som fråga och styr
 * valideringen, men skrivs inte in i orderkoden.
 */
export const P1D_ORDER: string[] = [
  "version",
  "bore_mm",
  "function",
  "rod_material",
  "position_11",
  "stroke_mm",
];

/** Mallen konfiguratorn bygger orderkoder med, härledd ur positionerna. */
export const P1D_ORDER_CODE_TEMPLATE = `${P1D_SERIES}-` +
  P1D_ORDER.map((key) => {
    const pad = P1D_PADDING.find((p) => p.key === key);
    return pad ? `{${key}#${pad.pad}}` : `{${key}}`;
  }).join("");

/**
 * Standardslaglängder enligt ISO 4393, ur katalogens slaglängdstabell (chunk 45).
 * 40 mm står med i tabellen men är markerad "* 40 is not an ISO standard
 * stroke" -- Parker lagerför den ändå, så den räknas som standard här.
 *
 * OBS: tabellen har en kolumn per längd och en rad per borrning, och markerar
 * per ruta om längden är lagervara eller specialbeställning. Den markeringen är
 * grafisk och överlever inte textutvinningen, så den PER BORRNING-uppdelningen
 * går inte att återskapa ur det inlästa dokumentet. Listan nedan är därför
 * unionen: allt katalogen listar som standardlängd för någon borrning.
 */
export const P1D_STANDARD_STROKES = [
  25, 40, 50, 80, 100, 125, 160, 200, 250, 320, 400, 500, 600, 700, 800,
];

/**
 * Ventilvarianterna i position 11 (chunk 114).
 *
 * De står separat från positionen ovan med flit: en siffra i position 11
 * betyder påbyggd ventil, och en sådan cylinder MÅSTE beställas som
 * 20-teckenskod eftersom ventilfunktionen ligger i positionerna 16-20.
 * Konfiguratorn kan inte fylla dem, så den erbjuder dem inte -- men
 * parsern känner igen dem, så en kund som klistrar in en sådan kod får
 * den förklarad i stället för avvisad.
 */
export const P1D_VALVE_POS_11: Array<{ code: string; label_sv: string }> = [
  { code: "0", label_sv: "Påbyggd ventil, luftstyrd" },
  { code: "1", label_sv: "Påbyggd ventil, el 24 V UC, LED+VDR" },
  { code: "2", label_sv: "Påbyggd ventil, el 115 V/50 Hz, 120 V/60 Hz, LED+VDR" },
  { code: "3", label_sv: "Påbyggd ventil, el 230 V/50 Hz, 240 V/60 Hz, LED+VDR" },
  { code: "4", label_sv: "Påbyggd ventil, el 24 V UC, LED+VDR, 5 m fast kabel" },
  { code: "7", label_sv: "Påbyggd ventil, el 24 V UC, LED+VDR, 10 m fast kabel" },
];

/**
 * Förlängd kolvstång: positionerna 6-7-8 byter grammatik.
 *
 * I stället för tre siffror (borrning) skrivs en bokstav för borrningen följd
 * av två tecken som kodar förlängningen i mm (chunk 71 och 113). Katalogens
 * eget exempel: "KR5 = Cylinder bore 32 mm with piston rod extension = 255 mm".
 * Max 339 mm; längre kräver kontakt med Parker.
 */
export const P1D_ROD_EXTENSION_BORE: Record<string, number> = {
  K: 32, L: 40, M: 50, N: 63, P: 80, Q: 100, R: 125,
};

/**
 * Tiotalsbokstäverna för förlängningen. A0-A9 = 100-109, B0-B9 = 110-119 ...
 * Z0-Z9 = 330-339. Sekvensen hoppar över I och O — precis som katalogen.
 */
const EXT_DECADES = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");

/** Kodar en förlängning i mm till katalogens två tecken. Null = utanför nyckeln. */
export function encodeRodExtension(mm: number): string | null {
  if (!Number.isInteger(mm) || mm < 1 || mm > 339) return null;
  if (mm < 100) return String(mm).padStart(2, "0");
  const i = Math.floor((mm - 100) / 10);
  return EXT_DECADES[i] ? `${EXT_DECADES[i]}${mm % 10}` : null;
}

/** Läser katalogens två tecken tillbaka till mm. Null = inte en giltig kod. */
export function decodeRodExtension(code: string): number | null {
  const c = code.trim().toUpperCase();
  if (!/^[0-9A-Z]{2}$/.test(c)) return null;
  if (/^\d{2}$/.test(c)) {
    const n = Number(c);
    return n >= 1 && n <= 99 ? n : null;
  }
  const i = EXT_DECADES.indexOf(c[0]);
  if (i < 0 || !/\d/.test(c[1])) return null;
  return 100 + i * 10 + Number(c[1]);
}

const eq = (key: string, code: string) => ({ "==": [{ var: key }, code] });

export const P1D_RULES: P1dRule[] = [
  {
    note: "P1",
    severity: "error",
    // Fotnot 2 i beställnyckeln: "Only for piston rod material type C and R."
    // gäller låsenheterna. C och R är katalogens två HÅRDFÖRKROMADE stänger --
    // låsenheten klämmer om stången och kräver den hårda ytan.
    when: {
      and: [
        { in: [{ var: "version" }, ["L", "H"]] },
        { not: { in: [{ var: "rod_material" }, ["C", "R"]] } },
      ],
    },
    message_sv:
      "Kolvstångslåsning (utförande L och H) kräver hårdförkromad kolvstång, dvs material C eller R.",
    message_en:
      "Rod locking (versions L and H) requires a hard-chromium plated piston rod, i.e. material C or R.",
  },
  {
    note: "P2",
    severity: "error",
    // Katalogen, ordagrant: "S and M not in combination with rod lock device".
    // Samma sak sedd från andra hållet -- S (rostfri) och M (syrafast) är de
    // oförkromade stängerna. Båda reglerna står i katalogen, båda står här.
    when: {
      and: [
        { in: [{ var: "version" }, ["L", "H"]] },
        { in: [{ var: "rod_material" }, ["S", "M"]] },
      ],
    },
    message_sv:
      "Kolvstångsmaterial S (rostfritt) och M (syrafast) kan inte kombineras med låsenhet.",
    message_en:
      "Piston rod materials S (stainless) and M (acid-proof) cannot be combined with a rod lock device.",
  },
  {
    note: "P3",
    severity: "warn",
    // Katalogen listar ISO 4393-längderna som standard och kallar allt annat
    // "stroke to special order". Koden är giltig, men leveranstiden är en
    // annan -- det ska kunden få veta i stället för att få ett blankt nej.
    when: {
      and: [
        { ">": [{ var: "stroke_mm" }, 0] },
        { not: { in: [{ var: "stroke_mm" }, P1D_STANDARD_STROKES] } },
      ],
    },
    message_sv:
      "Slaglängden är inte en ISO 4393-standardlängd. Cylindern går att beställa men tillverkas som specialmått — räkna med längre leveranstid.",
    message_en:
      "The stroke is not an ISO 4393 standard length. The cylinder is orderable but made to special order — expect a longer lead time.",
  },
  {
    note: "P4",
    severity: "error",
    // ATEX-märkningen i katalogen (chunk 65: "II 2GD c T4 120 °C") gäller
    // uttryckligen bara standardkoden: "Valid only for P1D-S***MS-****".
    when: {
      and: [
        eq("atex", "ja"),
        { or: [{ "!=": [{ var: "version" }, "S"] }, { "!=": [{ var: "function" }, "M"] }] },
      ],
    },
    message_sv:
      "ATEX-märkningen II 2GD c T4 120 °C gäller bara utförandet P1D-S***MS-****. Andra varianter måste kontrolleras mot Parker.",
    message_en:
      "The ATEX marking II 2GD c T4 120 °C applies only to P1D-S***MS-****. Other variants must be verified with Parker.",
  },
  {
    note: "P5",
    severity: "error",
    // Chunk 116, fotnot 6: "Not for the P1D-C Pro Clean version" på
    // genomgående kolvstång, och chunk 68: "Except P1D-C Pro Clean version".
    // Pro Clean känns igen på T/Y/W/V i position 11.
    when: {
      and: [
        eq("version", "C"),
        { in: [{ var: "position_11" }, ["T", "Y", "W", "V"]] },
        { in: [{ var: "function" }, ["F", "E", "B", "G", "Y", "Z"]] },
      ],
    },
    message_sv:
      "Genomgående kolvstång finns inte i Pro Clean-utförandet. Välj Ultra Clean (N i position 11) eller standardcylinder.",
    message_en:
      "A through piston rod is not available in the Pro Clean version. Choose Ultra Clean (N in position 11) or the standard cylinder.",
  },
  {
    note: "P6",
    severity: "warn",
    // Chunk 116, fotnot 6: "P1D-C Ultra Clean in bore sizes 32 to 80 mm and
    // strokes up to 700 mm. Longer stroke length on request."
    when: {
      and: [
        eq("version", "C"),
        {
          // evalLogic kör Number() på båda leden, så "080" jämförs som 80 --
          // den nollutfyllda strängen behöver ingen egen nyckel.
          or: [
            { ">": [{ var: "bore_mm" }, 80] },
            { ">": [{ var: "stroke_mm" }, 700] },
          ],
        },
      ],
    },
    message_sv:
      "Ultra Clean/Pro Clean är katalogfört för Ø32–80 mm och slag upp till 700 mm. Utanför det måste längden bekräftas av Parker.",
    message_en:
      "Ultra Clean/Pro Clean is catalogued for Ø32–80 mm and strokes up to 700 mm. Outside that range the length must be confirmed by Parker.",
  },
  {
    note: "P7",
    severity: "error",
    // Chunk 74, fotnot 23: HDPE-avstrykaren är avsedd för torr kolvstång och
    // gäller "Not for P1D-L and H versions".
    when: {
      and: [
        { in: [{ var: "version" }, ["L", "H"]] },
        { in: [{ var: "function" }, ["D", "H", "E", "Y"]] },
      ],
    },
    message_sv:
      "HDPE-avstrykare (torrgångsutförande) kan inte kombineras med kolvstångslåsning L eller H.",
    message_en:
      "The HDPE scraper (dry-rod design) cannot be combined with rod locking versions L or H.",
  },
];

/**
 * Bygger en P1D-orderkod i 15-teckensform.
 *
 * Positionell, till skillnad från DSBC: varje position måste fyllas, och talen
 * nollutfylls. Utan utfyllnaden blir det "P1D-S50MS-200" -- en kod som inte
 * existerar, vilket är precis vad den tidigare mallen producerade.
 *
 * `rod_extension_mm` byter ut positionerna 6-7-8 mot katalogens bokstavsform.
 */
export function buildP1dCode(
  config: Record<string, string | number | null | undefined>,
): string {
  const num = (key: string) => String(config[key] ?? "").replace(/\D/g, "");
  const ext = Number(config.rod_extension_mm ?? 0);

  let bore = num("bore_mm").padStart(3, "0");
  if (ext > 0) {
    const letter = Object.entries(P1D_ROD_EXTENSION_BORE)
      .find(([, mm]) => mm === Number(num("bore_mm")))?.[0];
    const tail = encodeRodExtension(ext);
    if (letter && tail) bore = `${letter}${tail}`;
  }

  return [
    P1D_SERIES,
    "-",
    String(config.version ?? "S"),
    bore,
    String(config.function ?? "M"),
    String(config.rod_material ?? "S"),
    String(config.position_11 ?? "-"),
    num("stroke_mm").padStart(4, "0"),
  ].join("");
}

/** Vad en avläst P1D-kod består av. */
export interface P1dReading extends Record<string, string | number | null> {
  version: string;
  /** Borrningen i mm. Samma tal oavsett om koden skrevs 032 eller K.. */
  bore_mm: number;
  /** Positionerna 6-7-8 precis som de stod i koden. */
  bore_code: string;
  /** Kolvstångsförlängning i mm, eller null när koden inte bär någon. */
  rod_extension_mm: number | null;
  function: string;
  rod_material: string;
  position_11: string;
  stroke_mm: number;
  /** 15 eller 20 -- katalogen tillåter inget däremellan. */
  digits: number;
  /** Positionerna 16-20, eller null för 15-teckensformen. */
  options: string | null;
}

/**
 * Läser en P1D-kod positionellt. Returnerar null när formen inte stämmer.
 *
 * Accepterar båda längderna katalogen tillåter (15 och 20 tecken) och båda
 * grammatikerna för positionerna 6-7-8 (borrning i siffror, eller borrning +
 * kolvstångsförlängning i bokstavsform).
 */
export function parseP1dCode(raw: string): P1dReading | null {
  const s = raw.trim().toUpperCase();
  const m =
    /^P1D-([SCVLH])(\d{3}|[KLMNPQR][0-9A-Z]{2})([A-Z])([SCMR])([-NTYWV0-9])(\d{4})([A-Z0-9]{5})?$/
      .exec(s);
  if (!m) return null;

  const [, version, boreCode, fn, rodMaterial, pos11, stroke, options] = m;

  let boreMm: number;
  let extension: number | null = null;
  if (/^\d{3}$/.test(boreCode)) {
    boreMm = Number(boreCode);
    if (!P1D_BORES.includes(boreMm)) return null;
  } else {
    boreMm = P1D_ROD_EXTENSION_BORE[boreCode[0]];
    extension = decodeRodExtension(boreCode.slice(1));
    if (!boreMm || extension === null) return null;
  }

  // Katalogen (chunk 64): "there are always 15 or 20 positions in the order
  // number -- never any figure in between." Regexen ovan tillåter bara de två
  // längderna; den här raden är hur vi RAPPORTERAR vilken det blev.
  const digits = options ? 20 : 15;

  // En påbyggd ventil (siffra i position 11) kan bara beställas som
  // 20-teckenskod -- ventilfunktionen ligger i positionerna 16-20.
  if (/\d/.test(pos11) && digits !== 20) return null;

  return {
    version,
    bore_mm: boreMm,
    bore_code: boreCode,
    rod_extension_mm: extension,
    function: fn,
    rod_material: rodMaterial,
    position_11: pos11,
    stroke_mm: Number(stroke),
    digits,
    options: options ?? null,
  };
}

/**
 * Positionerna 16-20, som bara finns i 20-teckensformen.
 *
 * Verifierat ur chunk 67-68: position 16 är cylinderinfästet, position 17 bär
 * mellantappen ("the intermediate trunnion is available among the cylinder
 * mountings in position 17"), och positionerna 18-20 bär XV-måttet:
 *
 *   D eller 6 i position 17  -> mellantappen alltid centrerad, 18-20 = NNN
 *   G eller 7 i position 17  -> XV-måttet i mm i 18-20 (max 999), 000 = lös tapp
 *
 * Katalogens exempel: P1D-S050MS-0250NDNNN — centrerad mellantapp.
 *
 * Den fullständiga infästningstabellen för position 16 är grafisk i katalogen
 * (ritningar per infästningstyp) och finns inte i den inlästa texten. Därför
 * modelleras 16-20 som läsbara men inte valbara: konfiguratorn bygger
 * 15-teckensformen, och 20-teckenskoder kan läsas in och förklaras.
 */
export const P1D_TRUNNION_POS_17: Array<{ code: string; label_sv: string }> = [
  { code: "D", label_sv: "Mellantapp MT4, centrerad (18-20 = NNN)" },
  { code: "6", label_sv: "Mellantapp MT4, centrerad, tapp i linje med portarna" },
  { code: "G", label_sv: "Mellantapp MT4, valfritt läge (XV-mått i 18-20)" },
  { code: "7", label_sv: "Mellantapp MT4, valfritt läge, tapp i linje med portarna" },
];

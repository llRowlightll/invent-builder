/**
 * Metal Work ELEKTRO ISO 15552 — elcylinder med kulskruv.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Metal Work, "ELECTRIC CYLINDER SERIES ELEKTRO ISO 15552", katalogavsnitt
 *   A5.4–A5.33, utgåva EN 0224. Ligger i knowledge_chunks som
 *   source_file = 'metalwork-ELEKTRO.pdf'.
 *     - tekniska data      sida A5.4  (chunk 3)
 *     - motorkoder         sida A5.31 (chunk 101)
 *     - KEY TO CODES       sida A5.32 (chunk 103-104, 109)
 *     - POSSIBLE ORDERING  sida A5.33 (chunk 110-112)
 *
 * DEN HÄR FAMILJEN STOD SOM BLOCKERAD I ETT DYGN på grund av en felmätning:
 * jag sökte på strängen "ELEKTRO", som bara står i sidhuvudet, fick två
 * träffar och skrev av källan som tunn. Nyckeln låg där hela tiden.
 *
 * TVÅ KODFORMER, inte en. Katalogen trycker två nycklar:
 *
 *   UTAN MOTOR, 12 tecken:
 *     37   1    032    0100    1        5
 *     └┬┘  │    └┬┘    └─┬┘    │        │
 *    typ   ISO  storlek slag  stigning version
 *
 *   MED MOTOR, 16 tecken — samma sex positioner plus fyra till:
 *     37 1 032 0100 1 1   1      2       2      0
 *                        motor flänsdon moment drivning
 *
 * DE FYRA SISTA SKRIVS IHOP i beställtabellen. "2200" betyder motor 2,
 * fläns 2, moment 0, drivning 0 -- katalogen listar dem som en enhet per
 * storlek, och det är så de modelleras här.
 *
 * VAD SOM GÖR DEN HÄR NYCKELN SVÅR: inte alla kombinationer finns. Katalogen
 * ägnar en hel sida åt POSSIBLE ORDERING CODES, en tabell per storlek, där
 * stigning, version och drivgrupp är NÄSTADE. Ø32 har till exempel en
 * drivlista för versionerna 1/2/5/6 och en KORTARE för 3/4/7/8. Att bygga en
 * kod som följer nyckeln räcker alltså inte -- den måste också stå i tabellen.
 *
 * ETT OBEROENDE KRYSS SOM HÅLLER. Motorkodstabellen på föregående sida är en
 * HELT ANNAN tabell: den listar Metal Works motornummer (37M1110000 …) och
 * vilka borrningar varje motor passar. Drivgruppens tre första tecken ska
 * finnas bland den storlekens motorer -- efter att växellådsvarianterna 6 och
 * 7 mappats tillbaka på 2 och 4. Det stämmer exakt för alla sex storlekar,
 * och det är den kontrollen som gör att jag vågar lita på avskriften av den
 * nästade tabellen. Se `elektro.test.ts`.
 *
 * VAD JAG INTE PÅSTÅR. Drivgruppens fjärde tecken ("drivning": 0 Bas,
 * 1 Högre varvtal, E Typ "E") går INTE att härleda ur motornumret. Katalogen
 * säger att E "identifierar konfiguration med Delta BRUSHLESS-motorer", men
 * 37M2770000 ÄR en Delta och står ändå som "2770" i tabellen, inte "277E".
 * Regeln stämmer alltså inte, och jag skriver därför av tabellen i stället
 * för att räkna ut den. Det är samma gränsdragning som OSP-P:s optionsfält.
 *
 * VÅRA TVÅ PRODUKTRADER ÄR FEL NIVÅ, inte påhittade: MW-ELK-ISO-32 och
 * MW-ELK-ISO-50 betecknar varsin STORLEK och saknar slaglängd, som är
 * obligatorisk i nyckeln. Samma sak som EGC-FA. Numret i sig följer inte
 * Metal Works form, men raderna fungerar som familjeingångar.
 */

export const ELEKTRO_SOURCE = {
  file: "metalwork-ELEKTRO.pdf",
  edition: "EN 0224",
  title: "Metal Work Electric Cylinder Series ELEKTRO ISO 15552",
  brand: "Metal Work",
  section: "A5.4–A5.33",
} as const;

/** Position 1-2 och 3. Konstanta för hela serien. */
export const ELEKTRO_TYPE = "37";
export const ELEKTRO_STANDARD = "1";

export interface ElektroValue {
  code: string;
  label_sv: string;
}

// ── Position 4-6: storlek ───────────────────────────────────────────────────

export interface ElektroSize {
  /** Koden i artikelnumret, tre tecken. "H63" är inte ett tal. */
  code: string;
  bore_mm: number;
  /** Heavy Duty-utförandet av Ø63. */
  heavy_duty: boolean;
  /** Största slag, mm (sida A5.4). Ø32 slutar tidigare än de övriga. */
  stroke_max_mm: number;
  /**
   * Minsta slag för version UTAN vridningsskydd, mm (sida A5.4):
   * "80 (in order to re-grease the screw)" för Ø32, Ø50 och Ø63/63HD,
   * "125" för Ø80 och Ø100. Kolumnerna är sammanslagna i katalogen och
   * skiljelinjen går efter Ø63 HD — avläst ur sidan, inte ur textutvinningen,
   * som inte skiljer på var en sammanslagen cell börjar och slutar.
   */
  stroke_min_free_mm: number;
  /** Kolvstångsgänga (sida A5.4). */
  rod_thread: string;
  /** Största vridningsvinkel för vridningsskyddad version (sida A5.4). */
  max_twist: string;
}

export const ELEKTRO_SIZES: ElektroSize[] = [
  { code: "032", bore_mm: 32, heavy_duty: false, stroke_max_mm: 1370, stroke_min_free_mm: 80, rod_thread: "M10x1.25", max_twist: "1°30′" },
  { code: "050", bore_mm: 50, heavy_duty: false, stroke_max_mm: 1500, stroke_min_free_mm: 80, rod_thread: "M16x1.5", max_twist: "1°" },
  { code: "063", bore_mm: 63, heavy_duty: false, stroke_max_mm: 1500, stroke_min_free_mm: 80, rod_thread: "M16x1.5", max_twist: "0°45′" },
  { code: "H63", bore_mm: 63, heavy_duty: true, stroke_max_mm: 1500, stroke_min_free_mm: 80, rod_thread: "M16x1.5", max_twist: "0°45′" },
  { code: "080", bore_mm: 80, heavy_duty: false, stroke_max_mm: 1500, stroke_min_free_mm: 125, rod_thread: "M20x1.5", max_twist: "0°35′" },
  { code: "100", bore_mm: 100, heavy_duty: false, stroke_max_mm: 1500, stroke_min_free_mm: 125, rod_thread: "M20x1.5", max_twist: "0°30′" },
];

// ── Position 11: skruvstigning ──────────────────────────────────────────────

export interface ElektroPitch extends ElektroValue {
  /** Stigning i mm. Behövs för minsta slag med vridningsskydd. */
  pitch_mm: number;
}

/**
 * Katalogens åtta stigningar. Lägg märke till att koderna hoppar över 3 --
 * de går 1, 2, 4, 5, 6, 7, 8, 9. Det är inte en felläsning; katalogen har
 * ingen kod 3.
 */
export const ELEKTRO_PITCHES: ElektroPitch[] = [
  { code: "1", pitch_mm: 4, label_sv: "Stigning 4 mm" },
  { code: "2", pitch_mm: 5, label_sv: "Stigning 5 mm" },
  { code: "4", pitch_mm: 10, label_sv: "Stigning 10 mm" },
  { code: "5", pitch_mm: 12, label_sv: "Stigning 12 mm" },
  { code: "6", pitch_mm: 16, label_sv: "Stigning 16 mm" },
  { code: "7", pitch_mm: 20, label_sv: "Stigning 20 mm" },
  { code: "8", pitch_mm: 32, label_sv: "Stigning 32 mm" },
  { code: "9", pitch_mm: 40, label_sv: "Stigning 40 mm" },
];

// ── Position 12: version ────────────────────────────────────────────────────

export interface ElektroVersion extends ElektroValue {
  /** Vridningsskyddad kolvstång. Jämna koder har det, udda inte. */
  non_rotating: boolean;
  /** Kuggremsdriven motor i stället för direktkopplad. */
  geared: boolean;
  ip: string;
}

/**
 * Versionerna i nyckeln MED MOTOR (1-8).
 *
 * De fyra första är direktkopplade ("IN-LINE"), de fyra sista kuggremsdrivna
 * ("GEARED"). Inom varje fyra: utan/med vridningsskydd, IP40/IP20 respektive
 * IP55/IP65.
 */
export const ELEKTRO_VERSIONS: ElektroVersion[] = [
  { code: "1", non_rotating: false, geared: false, ip: "IP40/IP20", label_sv: "Direktkopplad, utan vridningsskydd, IP40/IP20" },
  { code: "2", non_rotating: true, geared: false, ip: "IP40/IP20", label_sv: "Direktkopplad, med vridningsskydd, IP40/IP20" },
  { code: "3", non_rotating: false, geared: false, ip: "IP55/IP65", label_sv: "Direktkopplad, utan vridningsskydd, IP55/IP65" },
  { code: "4", non_rotating: true, geared: false, ip: "IP55/IP65", label_sv: "Direktkopplad, med vridningsskydd, IP55/IP65" },
  { code: "5", non_rotating: false, geared: true, ip: "IP40/IP20", label_sv: "Kuggremsdriven, utan vridningsskydd, IP40/IP20" },
  { code: "6", non_rotating: true, geared: true, ip: "IP40/IP20", label_sv: "Kuggremsdriven, med vridningsskydd, IP40/IP20" },
  { code: "7", non_rotating: false, geared: true, ip: "IP55/IP65", label_sv: "Kuggremsdriven, utan vridningsskydd, IP55/IP65" },
  { code: "8", non_rotating: true, geared: true, ip: "IP55/IP65", label_sv: "Kuggremsdriven, med vridningsskydd, IP55/IP65" },
];

/**
 * Versionerna i nyckeln UTAN MOTOR (5-8).
 *
 * Samma siffror, ANNAN betydelse: här finns ingen motor att koppla, så
 * "geared" är inte en dimension. 5/6 är IP40, 7/8 IP55/IP65.
 * Att återanvända ELEKTRO_VERSIONS här vore fel.
 */
export const ELEKTRO_VERSIONS_NO_MOTOR: ElektroVersion[] = [
  { code: "5", non_rotating: false, geared: false, ip: "IP40", label_sv: "Utan vridningsskydd, IP40" },
  { code: "6", non_rotating: true, geared: false, ip: "IP40", label_sv: "Med vridningsskydd, IP40" },
  { code: "7", non_rotating: false, geared: false, ip: "IP55/IP65", label_sv: "Utan vridningsskydd, IP55/IP65" },
  { code: "8", non_rotating: true, geared: false, ip: "IP55/IP65", label_sv: "Med vridningsskydd, IP55/IP65" },
];

// ── Position 13-16: motor, fläns, moment, drivning ──────────────────────────

export const ELEKTRO_MOTORS: ElektroValue[] = [
  { code: "1", label_sv: "Stegmotor" },
  { code: "2", label_sv: "Borstlös motor" },
  { code: "3", label_sv: "Stegmotor med broms och pulsgivare" },
  { code: "4", label_sv: "Borstlös motor med broms" },
  { code: "5", label_sv: "Stegmotor med broms, utan pulsgivare" },
  { code: "6", label_sv: "Borstlös motor med växellåda" },
  { code: "7", label_sv: "Borstlös motor med broms och växellåda" },
];

export const ELEKTRO_FLANGES: ElektroValue[] = [
  { code: "1", label_sv: "NEMA 23" },
  { code: "2", label_sv: "60" },
  { code: "3", label_sv: "80" },
  { code: "4", label_sv: "NEMA 34" },
  { code: "5", label_sv: "86" },
  { code: "6", label_sv: "100" },
  { code: "7", label_sv: "130" },
  { code: "8", label_sv: "NEMA 42" },
];

/**
 * Momentklasserna, AVSKRIVNA i katalogens ordning.
 *
 * Lägg märke till att 5 och 6 INTE ligger i storleksordning: 5 är 6,21-7 Nm
 * och 6 är 5,01-6,2 Nm. Det ser ut som ett tryckfel, och kanske är det det,
 * men jag har ingen andra källa som säger annat -- och att "rätta" en kod
 * som kunden skriver i en beställning vore långt värre än att återge den.
 * Koden 3 saknas inte; det gör däremot 8.
 */
export const ELEKTRO_TORQUES: ElektroValue[] = [
  { code: "0", label_sv: "0–0,79 Nm" },
  { code: "1", label_sv: "0,8–1,19 Nm" },
  { code: "2", label_sv: "1,2–2,19 Nm" },
  { code: "3", label_sv: "2,2–3 Nm" },
  { code: "4", label_sv: "3,01–5 Nm" },
  { code: "5", label_sv: "6,21–7 Nm" },
  { code: "6", label_sv: "5,01–6,2 Nm" },
  { code: "7", label_sv: "7,01–10 Nm" },
  { code: "9", label_sv: "15,01–25 Nm" },
];

export const ELEKTRO_DRIVES: ElektroValue[] = [
  { code: "0", label_sv: "Bas" },
  { code: "1", label_sv: "Högre varvtal" },
  { code: "E", label_sv: "Typ E" },
];

// ── POSSIBLE ORDERING CODES ─────────────────────────────────────────────────

export interface ElektroDrivePack {
  /** De fyra tecknen: motor, fläns, moment, drivning. */
  code: string;
  /**
   * Standardutväxling. Katalogen: "For sizes Ø80 and Ø100 the standard
   * transmission ratio depends on screw pitch, version and motorization.
   * For the other sizes the standard transmission ratio is 1."
   */
  ratio: string;
}

export interface ElektroCombo {
  /** Stigningskoder gruppen gäller. */
  pitches: string[];
  /** Versionskoder gruppen gäller. */
  versions: string[];
  packs: ElektroDrivePack[];
}

/**
 * Tabellen på sida A5.33, avskriven storlek för storlek.
 *
 * Kolumnerna står som tre nästade nivåer -- stigning, version, drivgrupp --
 * och den nästningen är hela poängen: Ø32:s versioner 3/4/7/8 har ELVA
 * drivgrupper där 1/2/5/6 har fjorton. Skillnaden är inte godtycklig utan
 * följer katalogens egen fotnot: IP55 för Ø32 finns bara för motorkod
 * 37M1120001, vars grupp är "1121" -- och mycket riktigt är 1110, 1120 och
 * 5120 borta ur den kortare listan medan 1121 är kvar.
 *
 * Samma sak för Ø63 HD: fotnoten undantar 37M1470000 från IP55, och "1470"
 * saknas i den andra gruppen. Två oberoende belägg för att avskriften är rätt.
 */
export const ELEKTRO_COMBOS: Record<string, ElektroCombo[]> = {
  "032": [
    {
      pitches: ["1", "5"],
      versions: ["1", "2", "5", "6"],
      packs: ["1110", "1120", "1121", "5120", "2200", "220E", "2220", "222E",
              "3220", "3230", "4200", "420E", "4220", "422E"].map((code) => ({ code, ratio: "1" })),
    },
    {
      pitches: ["1", "5"],
      versions: ["3", "4", "7", "8"],
      packs: ["1121", "2200", "220E", "2220", "222E", "3220", "3230",
              "4200", "420E", "4220", "422E"].map((code) => ({ code, ratio: "1" })),
    },
  ],
  "050": [
    {
      pitches: ["2", "4", "6"],
      versions: ["1", "2", "3", "4", "5", "6", "7", "8"],
      packs: ["1430", "1440", "2220", "222E", "2330", "233E", "3430", "3460",
              "4220", "422E", "4330", "433E"].map((code) => ({ code, ratio: "1" })),
    },
  ],
  "063": [
    {
      pitches: ["2", "4", "7"],
      versions: ["1", "2", "3", "4", "5", "6", "7", "8"],
      packs: ["1450", "2330", "233E", "3450", "3460", "4330", "433E"]
        .map((code) => ({ code, ratio: "1" })),
    },
  ],
  "H63": [
    {
      pitches: ["2", "4"],
      versions: ["1", "2", "5", "6"],
      packs: ["1450", "1470", "2330", "233E", "2540", "264E", "3450", "3460",
              "3470", "4330", "433E", "4540", "464E"].map((code) => ({ code, ratio: "1" })),
    },
    {
      pitches: ["2", "4"],
      versions: ["3", "4", "7", "8"],
      packs: ["1450", "2330", "233E", "2540", "264E", "3450", "3460", "3470",
              "4330", "433E", "4540", "464E"].map((code) => ({ code, ratio: "1" })),
    },
  ],
  "080": [
    {
      pitches: ["2"],
      versions: ["3", "4"],
      packs: [
        { code: "1890", ratio: "1" }, { code: "2540", ratio: "1" },
        { code: "264E", ratio: "1" }, { code: "4540", ratio: "1" },
        { code: "464E", ratio: "1" },
      ],
    },
    {
      pitches: ["2"],
      versions: ["7", "8"],
      packs: [
        { code: "1890", ratio: "1" }, { code: "2540", ratio: "4/5" },
        { code: "264E", ratio: "4/5" }, { code: "4540", ratio: "4/5" },
        { code: "464E", ratio: "4/5" },
      ],
    },
    {
      pitches: ["4", "8"],
      versions: ["3", "4"],
      packs: [
        { code: "1890", ratio: "1" }, { code: "2540", ratio: "1" },
        { code: "264E", ratio: "1" }, { code: "2770", ratio: "1" },
        { code: "4540", ratio: "1" }, { code: "464E", ratio: "1" },
        { code: "4770", ratio: "1" },
      ],
    },
    {
      pitches: ["4", "8"],
      versions: ["7", "8"],
      packs: [
        { code: "1890", ratio: "1" }, { code: "2540", ratio: "4/5" },
        { code: "264E", ratio: "4/5" }, { code: "2770", ratio: "2/3" },
        { code: "4540", ratio: "4/5" }, { code: "464E", ratio: "4/5" },
        { code: "4770", ratio: "2/3" },
      ],
    },
  ],
  "100": [
    {
      pitches: ["4", "9"],
      versions: ["3", "4"],
      packs: [
        { code: "1890", ratio: "1" }, { code: "2770", ratio: "1" },
        { code: "4770", ratio: "1" }, { code: "6770", ratio: "1/3" },
        { code: "7770", ratio: "1/3" },
      ],
    },
    {
      pitches: ["4", "9"],
      versions: ["7", "8"],
      packs: [
        { code: "1890", ratio: "1" }, { code: "2770", ratio: "1/2" },
        { code: "4770", ratio: "1/2" },
      ],
    },
  ],
};

// ── Motorkoderna, sida A5.31 ────────────────────────────────────────────────

export interface ElektroMotor {
  /** Metal Works eget motornummer. */
  part_no: string;
  manufacturer: string;
  model: string;
  /** Effekt i watt för borstlösa; null för stegmotorer, som anges i ström. */
  power_w: number | null;
  /** Storlekskoder motorn är listad för. */
  sizes: string[];
}

/**
 * Motorkodstabellen, avskriven. Används INTE för att bygga koden -- den är
 * det oberoende krysset mot POSSIBLE ORDERING CODES. Se filens huvud.
 */
export const ELEKTRO_MOTORS_TABLE: ElektroMotor[] = [
  // Stegmotorer
  { part_no: "37M1110000", manufacturer: "Sanyo Denki", model: "103-H7123-1749", power_w: null, sizes: ["032"] },
  { part_no: "37M1120000", manufacturer: "Sanyo Denki", model: "103-H7126-1740", power_w: null, sizes: ["032"] },
  { part_no: "37M1120001", manufacturer: "Sanyo Denki", model: "103-H7126-6640", power_w: null, sizes: ["032"] },
  { part_no: "37M1430000", manufacturer: "Sanyo Denki", model: "103-H8221-6241", power_w: null, sizes: ["050"] },
  { part_no: "37M1440000", manufacturer: "Sanyo Denki", model: "103-H8222-6340", power_w: null, sizes: ["050"] },
  { part_no: "37M1450000", manufacturer: "Sanyo Denki", model: "SM-2863-5255", power_w: null, sizes: ["063", "H63"] },
  { part_no: "37M1470000", manufacturer: "B&R", model: "80MPH6.101S000-01", power_w: null, sizes: ["H63"] },
  { part_no: "37M1890000", manufacturer: "Sanyo Denki", model: "103-H89223-6341", power_w: null, sizes: ["080", "100"] },
  // Stegmotor med broms
  { part_no: "37M5120000", manufacturer: "Sanyo Denki", model: "103-H7126-1710B", power_w: null, sizes: ["032"] },
  // Stegmotor med broms och pulsgivare
  { part_no: "37M3220000", manufacturer: "B&R", model: "80MPF3.500D114-01", power_w: null, sizes: ["032"] },
  { part_no: "37M3230000", manufacturer: "B&R", model: "80MPF5.500D114-01", power_w: null, sizes: ["032"] },
  { part_no: "37M3430000", manufacturer: "B&R", model: "80MPH1.600D114-01", power_w: null, sizes: ["050"] },
  { part_no: "37M3460000", manufacturer: "B&R", model: "80MPH3.600D114-01", power_w: null, sizes: ["050", "063", "H63"] },
  { part_no: "37M3450000", manufacturer: "B&R", model: "80MPH4.101D114-01", power_w: null, sizes: ["063", "H63"] },
  { part_no: "37M3470000", manufacturer: "B&R", model: "80MPH6.101D114-01", power_w: null, sizes: ["H63"] },
  // Borstlösa
  { part_no: "37M2200000", manufacturer: "Sanyo Denki", model: "R2AA06020FXH11M", power_w: 200, sizes: ["032"] },
  { part_no: "37M2220000", manufacturer: "Sanyo Denki", model: "R2AA06040FXH11M", power_w: 400, sizes: ["032", "050"] },
  { part_no: "37M2330000", manufacturer: "Sanyo Denki", model: "R2AA08075FXH11M", power_w: 750, sizes: ["050", "063", "H63"] },
  { part_no: "37M2540000", manufacturer: "Sanyo Denki", model: "R2AAB8100HXH29M", power_w: 1000, sizes: ["H63", "080"] },
  { part_no: "37M2200001", manufacturer: "Delta", model: "ECMA-C20602RS", power_w: 200, sizes: ["032"] },
  { part_no: "37M2220001", manufacturer: "Delta", model: "ECMA-C20604RS", power_w: 400, sizes: ["032", "050"] },
  { part_no: "37M2330001", manufacturer: "Delta", model: "ECMA-C20807RS", power_w: 750, sizes: ["050", "063", "H63"] },
  { part_no: "37M2640000", manufacturer: "Delta", model: "ECMA-C21010R9", power_w: 1000, sizes: ["H63", "080"] },
  { part_no: "37M2770000", manufacturer: "Delta", model: "ECMA-J11330R4", power_w: 3000, sizes: ["080", "100"] },
  // Borstlösa med broms
  { part_no: "37M4200000", manufacturer: "Sanyo Denki", model: "R2AA06020FCH11M", power_w: 200, sizes: ["032"] },
  { part_no: "37M4220000", manufacturer: "Sanyo Denki", model: "R2AA06040FCH11M", power_w: 400, sizes: ["032", "050"] },
  { part_no: "37M4330000", manufacturer: "Sanyo Denki", model: "R2AA08075FCH11M", power_w: 750, sizes: ["050", "063", "H63"] },
  { part_no: "37M4540000", manufacturer: "Sanyo Denki", model: "R2AAB8100HCH29M", power_w: 1000, sizes: ["H63", "080"] },
  { part_no: "37M4200001", manufacturer: "Delta", model: "ECMA-C20602SS", power_w: 200, sizes: ["032"] },
  { part_no: "37M4220001", manufacturer: "Delta", model: "ECMA-C20604SS", power_w: 400, sizes: ["032", "050"] },
  { part_no: "37M4330001", manufacturer: "Delta", model: "ECMA-C20807SS", power_w: 750, sizes: ["050", "063", "H63"] },
  { part_no: "37M4640000", manufacturer: "Delta", model: "ECMA-C21010S9", power_w: 1000, sizes: ["H63", "080"] },
  { part_no: "37M4770000", manufacturer: "Delta", model: "ECMA-J11330S4", power_w: 3000, sizes: ["080", "100"] },
];

/** Gemensamma gränser ur sida A5.4. */
export const ELEKTRO_LIMITS = {
  repeatability_mm: 0.02,
  accuracy_mm: 0.2,
  radial_oscillation_per_100mm: 0.4,
  temp_stepping_min_c: -10,
  temp_stepping_max_c: 50,
  temp_brushless_min_c: 0,
  temp_brushless_max_c: 40,
  /** Kodens längd utan respektive med motor. */
  code_length_no_motor: 12,
  code_length_with_motor: 16,
} as const;

// ── Bygg och läs ────────────────────────────────────────────────────────────

export interface ElektroConfig {
  /** Storlekskod: "032", "050", "063", "H63", "080" eller "100". */
  size: string;
  stroke_mm: number;
  /** Stigningskod, position 11. */
  pitch: string;
  /** Versionskod, position 12. */
  version: string;
  /**
   * Drivgruppens fyra tecken. Utelämnad = cylinder utan motor, och då måste
   * versionen vara en av 5-8.
   */
  drive_pack?: string;
}

/** Minsta slag för en konfiguration, mm. Null när storleken inte finns. */
export function elektroMinStroke(
  size: string, version: string, pitch: string,
): number | null {
  const s = ELEKTRO_SIZES.find((x) => x.code === size);
  const p = ELEKTRO_PITCHES.find((x) => x.code === pitch);
  if (!s || !p) return null;
  // Katalogen ger två olika regler, och vilken som gäller styrs av
  // vridningsskyddet: "Minimum stroke for version WITH non-rotating: twice
  // the screw pitch" mot "…WITHOUT non-rotating: 80 / 125 mm".
  const vridskydd = elektroIsNonRotating(version);
  return vridskydd ? 2 * p.pitch_mm : s.stroke_min_free_mm;
}

/**
 * Har versionen vridningsskyddad kolvstång?
 *
 * Jämna koder har det, i BÅDA nycklarna -- 2/4/6/8 med motor, 6/8 utan.
 * Det är inte en härledd regel utan en avläsning: katalogen skriver ut
 * "With non-rotating" på precis de jämna koderna.
 */
export function elektroIsNonRotating(version: string): boolean {
  const n = Number(version);
  return Number.isInteger(n) && n % 2 === 0;
}

/** Största slag för en storlek, mm. */
export function elektroMaxStroke(size: string): number | null {
  return ELEKTRO_SIZES.find((s) => s.code === size)?.stroke_max_mm ?? null;
}

/**
 * Står kombinationen i POSSIBLE ORDERING CODES?
 *
 * Utan drivgrupp prövas bara att stigningen finns för storleken, eftersom
 * cylindern utan motor inte har någon drivgrupp att slå upp.
 */
export function elektroIsOrderable(
  size: string, pitch: string, version: string, drivePack?: string,
): boolean {
  const combos = ELEKTRO_COMBOS[size];
  if (!combos) return false;
  if (drivePack === undefined) {
    // Utan motor: versionerna 5-8, och stigningen ska finnas för storleken.
    if (!ELEKTRO_VERSIONS_NO_MOTOR.some((v) => v.code === version)) return false;
    return combos.some((c) => c.pitches.includes(pitch));
  }
  return combos.some((c) =>
    c.pitches.includes(pitch) &&
    c.versions.includes(version) &&
    c.packs.some((p) => p.code === drivePack)
  );
}

/** Standardutväxling för en kombination, eller null om den inte finns. */
export function elektroTransmissionRatio(
  size: string, pitch: string, version: string, drivePack: string,
): string | null {
  for (const c of ELEKTRO_COMBOS[size] ?? []) {
    if (!c.pitches.includes(pitch) || !c.versions.includes(version)) continue;
    const p = c.packs.find((x) => x.code === drivePack);
    if (p) return p.ratio;
  }
  return null;
}

/**
 * Bygger ett ELEKTRO-artikelnummer. Null när något inte är beställbart.
 *
 * Kontrollerar tre saker i tur och ordning: att varje position har ett värde
 * katalogen känner igen, att slaget ligger inom storlekens gränser, och att
 * kombinationen står i POSSIBLE ORDERING CODES. Den sista är den som fäller
 * flest -- nyckeln tillåter långt mer än tabellen.
 */
export function elektroBuildCode(c: ElektroConfig): string | null {
  const s = ELEKTRO_SIZES.find((x) => x.code === c.size);
  if (!s) return null;
  if (!ELEKTRO_PITCHES.some((p) => p.code === c.pitch)) return null;

  const utanMotor = c.drive_pack === undefined;
  const versioner = utanMotor ? ELEKTRO_VERSIONS_NO_MOTOR : ELEKTRO_VERSIONS;
  if (!versioner.some((v) => v.code === c.version)) return null;

  if (!Number.isInteger(c.stroke_mm) || c.stroke_mm < 0 || c.stroke_mm > 9999) return null;
  const min = elektroMinStroke(c.size, c.version, c.pitch);
  if (min === null || c.stroke_mm < min || c.stroke_mm > s.stroke_max_mm) return null;

  if (!elektroIsOrderable(c.size, c.pitch, c.version, c.drive_pack)) return null;

  const bas = ELEKTRO_TYPE + ELEKTRO_STANDARD + s.code +
    String(c.stroke_mm).padStart(4, "0") + c.pitch + c.version;
  return utanMotor ? bas : bas + c.drive_pack;
}

export interface ElektroReading {
  size: string;
  bore_mm: number;
  stroke_mm: number;
  pitch: string;
  pitch_mm: number;
  version: string;
  non_rotating: boolean;
  /** Null för cylinder utan motor. */
  drive_pack: string | null;
  motor: string | null;
  flange: string | null;
  torque: string | null;
  drive: string | null;
  has_motor: boolean;
}

/**
 * Läser ett ELEKTRO-artikelnummer.
 *
 * Längden avgör vilken nyckel som gäller: 12 tecken utan motor, 16 med.
 * Allt annat är inte en ELEKTRO-kod.
 */
export function elektroParseCode(raw: string): ElektroReading | null {
  const k = raw.trim().toUpperCase();
  if (k.length !== ELEKTRO_LIMITS.code_length_no_motor &&
      k.length !== ELEKTRO_LIMITS.code_length_with_motor) {
    return null;
  }
  if (k.slice(0, 2) !== ELEKTRO_TYPE || k[2] !== ELEKTRO_STANDARD) return null;

  const size = k.slice(3, 6);
  const s = ELEKTRO_SIZES.find((x) => x.code === size);
  if (!s) return null;

  const slag = k.slice(6, 10);
  if (!/^\d{4}$/.test(slag)) return null;
  const stroke_mm = Number(slag);

  const pitch = k[10];
  const p = ELEKTRO_PITCHES.find((x) => x.code === pitch);
  if (!p) return null;

  const version = k[11];
  const harMotor = k.length === ELEKTRO_LIMITS.code_length_with_motor;
  const versioner = harMotor ? ELEKTRO_VERSIONS : ELEKTRO_VERSIONS_NO_MOTOR;
  if (!versioner.some((v) => v.code === version)) return null;

  const drive_pack = harMotor ? k.slice(12, 16) : null;
  if (drive_pack !== null) {
    if (!ELEKTRO_MOTORS.some((m) => m.code === drive_pack[0])) return null;
    if (!ELEKTRO_FLANGES.some((f) => f.code === drive_pack[1])) return null;
    if (!ELEKTRO_TORQUES.some((t) => t.code === drive_pack[2])) return null;
    if (!ELEKTRO_DRIVES.some((d) => d.code === drive_pack[3])) return null;
  }

  return {
    size, bore_mm: s.bore_mm, stroke_mm, pitch, pitch_mm: p.pitch_mm,
    version, non_rotating: elektroIsNonRotating(version),
    drive_pack,
    motor: drive_pack?.[0] ?? null,
    flange: drive_pack?.[1] ?? null,
    torque: drive_pack?.[2] ?? null,
    drive: drive_pack?.[3] ?? null,
    has_motor: harMotor,
  };
}

/**
 * Konfiguratorns mall.
 *
 * Slaget nollutfylls till fyra tecken med `{stroke_mm#4}`, precis som P1D.
 * Drivgruppen är ETT fält i konfiguratorn, inte fyra: kunden väljer en motor
 * ur storlekens lista, och de fyra tecknen följer med. Att låta kunden välja
 * fläns och moment var för sig vore att erbjuda kombinationer katalogen inte
 * har.
 */
export const ELEKTRO_ORDER_CODE_TEMPLATE =
  "371{size}{stroke_mm#4}{pitch}{version}{drive_pack}";

/** Alla beställbara drivgrupper för en storlek, utan dubbletter. */
export function elektroDrivePacks(size: string): string[] {
  const ut = new Set<string>();
  for (const c of ELEKTRO_COMBOS[size] ?? []) {
    for (const p of c.packs) ut.add(p.code);
  }
  return [...ut];
}

/** Alla beställbara stigningar för en storlek. */
export function elektroPitches(size: string): string[] {
  const ut = new Set<string>();
  for (const c of ELEKTRO_COMBOS[size] ?? []) for (const p of c.pitches) ut.add(p);
  return [...ut];
}

/** Alla beställbara versioner för en storlek, i nyckeln MED motor. */
export function elektroVersions(size: string): string[] {
  const ut = new Set<string>();
  for (const c of ELEKTRO_COMBOS[size] ?? []) for (const v of c.versions) ut.add(v);
  return [...ut];
}

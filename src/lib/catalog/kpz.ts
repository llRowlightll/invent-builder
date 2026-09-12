/**
 * AVENTICS KPZ — kompaktcylinder, beställtabell härledd ur tillverkarens katalog.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   AVENTICS S.à r.l., "Piston rod cylinder ► Short-stroke and compact
 *   cylinders, Series KPZ", pneumatikkatalog online-PDF per 2015-08-05.
 *   Dokumentet ligger i knowledge_chunks som
 *   source_file = 'f518f8d2b406b9b6ddf8f2d5e2bb02ac.pdf'.
 *   Beställtabellen står i chunk 9-10, tekniska data i chunk 7-8 (tryckta två
 *   gånger i dokumentet, chunk 17-18 — båda avläsningarna stämmer överens).
 *
 * VARFÖR FILEN FINNS, och varför den skiljer sig från DSBC och P1D.
 *
 * DSBC och P1D har MODULÄRA beställnycklar: en typkod byggs ihop av positioner.
 * KPZ har ingen. AVENTICS säljer kompaktcylindern ur en TABELL — man slår upp
 * borrning och slaglängd och får ett tiosiffrigt artikelnummer. Det finns
 * ingen kod att sätta ihop, och en konfigurator som låtsas att det gör det
 * kommer att producera beställningar som inte går att lägga.
 *
 * Det var precis vad som hände. configurator_families hade mallen
 * "KPZ-{bore_mm}-{stroke_mm}" och products hade sexton rader på formen
 * "KPZ-016-0025-A-0-PPV". Den strängen förekommer inte en enda gång i
 * AVENTICS katalog — den innehåller inte ens "KPZ-" följt av en siffra.
 * Åtta av de sexton raderna var dessutom märkta Camozzi, som inte tillverkar
 * någon KPZ-serie, med slaglängderna 250 och 400 mm när beställtabellen
 * slutar vid 100 mm.
 *
 * Artikelnumret är däremot fullständigt regelbundet, vilket är vad som gör
 * tabellen möjlig att uttrycka i kod i stället för att skrivas av:
 *
 *   0 8 2 2 3 9 B S S S
 *   └───┬───┘ │ └─┬─┘
 *    serien   │   └── slagindex, 000-010
 *             └────── borrindex, 0-8
 *
 * Ø40 med 25 mm slag blir alltså 0822394004. De 93 artiklarna nedan är inte
 * hämtade ur vår egen databas utan RÄKNADE ur katalogens tabell, och testet
 * jämför dem mot de rader tabellen faktiskt trycker.
 */

/** Serieprefixet. Dubbelverkande, invändig kolvstångsgänga — katalogens bastabell. */
export const KPZ_SERIE = "082239";

export const KPZ_SOURCE = {
  file: "f518f8d2b406b9b6ddf8f2d5e2bb02ac.pdf",
  edition: "2015-08-05",
  title: "AVENTICS Series KPZ, short-stroke and compact cylinders",
  brand: "AVENTICS",
} as const;

/** En borrning ur katalogens tabell. `index` är siffran i artikelnumret. */
export interface KpzBore {
  bore_mm: number;
  index: number;
  /** Kolvstångsgänga enligt tabellhuvudet i chunk 9-10. */
  rod_thread: string;
  /** Anslutning enligt samma tabellhuvud. */
  port: string;
  /**
   * Kraft ur chunk 7-8, newton.
   *
   * VID 6,3 BAR, inte 6. Katalogen skriver ut det: "Pressure for determining
   * piston forces 6,3 bar". Jag skrev först "vid 6 bar" i den här kommentaren
   * och lät testet jämföra mot 6 bar med 6 % tolerans -- då passerade det, och
   * toleransen dolde att trycket var fel. Vid rätt tryck stämmer katalogens
   * värden på tiondelen: Ø100 ger 4948 N både i tabellen och ur formeln.
   */
  force_extend_n: number;
  force_retract_n: number;
  /** Största slaglängd enligt tekniska data — inte enligt beställtabellen. */
  stroke_max_mm: number;
}

/**
 * Katalogens nio borrningar.
 *
 * OBS Ø20: den står i katalogen men saknas i vår databas, som listar
 * 16/25/32/40/50/63/80/100. En storlek som inte erbjuds är en förlorad affär,
 * inte bara en lucka i en tabell.
 */
export const KPZ_BORES: KpzBore[] = [
  { bore_mm: 16, index: 0, rod_thread: "M4", port: "M5", force_extend_n: 127, force_retract_n: 95, stroke_max_mm: 300 },
  { bore_mm: 20, index: 1, rod_thread: "M6", port: "M5", force_extend_n: 198, force_retract_n: 148, stroke_max_mm: 300 },
  { bore_mm: 25, index: 2, rod_thread: "M6", port: "M5", force_extend_n: 309, force_retract_n: 260, stroke_max_mm: 300 },
  { bore_mm: 32, index: 3, rod_thread: "M8", port: "G 1/8", force_extend_n: 507, force_retract_n: 435, stroke_max_mm: 300 },
  { bore_mm: 40, index: 4, rod_thread: "M8", port: "G 1/8", force_extend_n: 792, force_retract_n: 720, stroke_max_mm: 300 },
  { bore_mm: 50, index: 5, rod_thread: "M10", port: "G 1/8", force_extend_n: 1237, force_retract_n: 1110, stroke_max_mm: 300 },
  { bore_mm: 63, index: 6, rod_thread: "M10", port: "G 1/8", force_extend_n: 1964, force_retract_n: 1837, stroke_max_mm: 300 },
  { bore_mm: 80, index: 7, rod_thread: "M12", port: "G 1/8", force_extend_n: 3167, force_retract_n: 2969, stroke_max_mm: 500 },
  { bore_mm: 100, index: 8, rod_thread: "M16", port: "G 1/8", force_extend_n: 4948, force_retract_n: 4639, stroke_max_mm: 500 },
];

/**
 * Slaglängderna i beställtabellens ordning. Index är de tre sista siffrorna.
 *
 * Listan slutar vid 100 mm. Tekniska data tillåter 300 mm (500 för Ø80 och
 * Ø100), men det är INTE lagervara -- katalogen hänvisar längre slag till
 * AVENTICS internetkonfigurator. Skillnaden är densamma som P1D:s mellan
 * ISO 4393-standardlängd och specialmått, och den ska kunden få veta.
 */
export const KPZ_STROKES = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];

/**
 * Kombinationer katalogen INTE listar: de tre minsta borrningarna saknar de
 * två längsta slagen (tabellen skriver "-" i de rutorna, chunk 10).
 */
function erbjuds(bore_mm: number, stroke_mm: number): boolean {
  const smaBorr = bore_mm === 16 || bore_mm === 20 || bore_mm === 25;
  return !(smaBorr && (stroke_mm === 80 || stroke_mm === 100));
}

/** Ett artikelnummer ur tabellen. */
export interface KpzArticle {
  part_no: string;
  bore_mm: number;
  stroke_mm: number;
  rod_thread: string;
  port: string;
}

/**
 * Hela beställtabellen, räknad ur katalogens regel i stället för avskriven.
 * 9 borrningar × 11 slaglängder − 6 rutor som tabellen lämnar tomma = 93.
 */
export function kpzCatalogue(): KpzArticle[] {
  const ut: KpzArticle[] = [];
  for (const b of KPZ_BORES) {
    for (let i = 0; i < KPZ_STROKES.length; i++) {
      const stroke_mm = KPZ_STROKES[i];
      if (!erbjuds(b.bore_mm, stroke_mm)) continue;
      ut.push({
        part_no: `${KPZ_SERIE}${b.index}${String(i).padStart(3, "0")}`,
        bore_mm: b.bore_mm,
        stroke_mm,
        rod_thread: b.rod_thread,
        port: b.port,
      });
    }
  }
  return ut;
}

/** Slår upp artikelnumret för en borrning och slaglängd. Null = finns inte. */
export function kpzPartNo(bore_mm: number, stroke_mm: number): string | null {
  const b = KPZ_BORES.find((x) => x.bore_mm === bore_mm);
  const i = KPZ_STROKES.indexOf(stroke_mm);
  if (!b || i < 0 || !erbjuds(bore_mm, stroke_mm)) return null;
  return `${KPZ_SERIE}${b.index}${String(i).padStart(3, "0")}`;
}

/** Läser ett KPZ-artikelnummer tillbaka till borrning och slaglängd. */
export function parseKpzPartNo(raw: string): KpzArticle | null {
  const m = /^082239(\d)(\d{3})$/.exec(raw.trim());
  if (!m) return null;
  const b = KPZ_BORES.find((x) => x.index === Number(m[1]));
  const stroke_mm = KPZ_STROKES[Number(m[2])];
  if (!b || stroke_mm === undefined || !erbjuds(b.bore_mm, stroke_mm)) return null;
  return {
    part_no: raw.trim(),
    bore_mm: b.bore_mm,
    stroke_mm,
    rod_thread: b.rod_thread,
    port: b.port,
  };
}

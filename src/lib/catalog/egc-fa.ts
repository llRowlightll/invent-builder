/**
 * Festo EGC-FA — styraxel utan drivning, modulär beställnyckel.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   Festo, "Guide axes EGC-FA, without drive", utgåva 2026/05. Ligger i
 *   knowledge_chunks som source_file = '202970_documentation.pdf'.
 *   Typkoden står i chunk 7-10, tekniska data i chunk 11.
 *
 * Samma sorts nyckel som DSBC: en MODULÄR typkod där ovalda positioner
 * utelämnas. Minimikoden är serie, storlek, slag, styrning, slagreserv och
 * slid:
 *
 *   EGC - 80 - 500 - FA - 0H - GK
 *   └┬┘   └┬┘  └─┬┘  └┬┘  └┬┘  └┬┘
 *  serie storlek slag  │  slagreserv
 *                      styrning     slid
 *
 * "FA" i familjenamnet är alltså position 004, inte en del av serienamnet.
 *
 * VÅRA FYRA PRODUKTRADER ÄR FAMILJERADER, inte artiklar: FESTO-EGC-FA-70,
 * -80, -120 och -185 betecknar varsin STORLEK, inte en beställbar axel. De
 * saknar slaglängd, som är obligatorisk i nyckeln. Det är inte samma fel som
 * KPZ:s påhittade nummer -- det är rader på fel nivå, och de fungerar som
 * familjeingångar i katalogen. De lämnas därför orörda.
 *
 * Konfiguratorn var däremot fel på tre sätt, och ett av dem är dyrt:
 * slaglängden stod som 1-3000 mm för alla storlekar. Katalogen säger 50-8500,
 * och storlek 70 slutar redan vid 5000.
 */

export const EGC_FA_SOURCE = {
  file: "202970_documentation.pdf",
  edition: "2026/05",
  title: "Festo Guide axes EGC-FA, without drive",
  brand: "Festo",
} as const;

export const EGC_FA_SERIES = "EGC";
/** Position 004 — Guide. "FA" står för styraxel. */
export const EGC_FA_GUIDE = "FA";

export interface EgcFaSize {
  size: number;
  /** Arbetsslag för standardsliden GK/GP (chunk 11). */
  stroke_min_mm: number;
  stroke_max_mm: number;
}

/**
 * Storlekarna och deras arbetsslag.
 *
 * Storlek 70 slutar vid 5000 mm; de tre större går till 8500. Databasen hade
 * ETT intervall, 1-3000 mm, för alla fyra -- alltså både fel undre gräns, fel
 * övre gräns, och ingen skillnad mellan storlekarna.
 */
export const EGC_FA_SIZES: EgcFaSize[] = [
  { size: 70, stroke_min_mm: 50, stroke_max_mm: 5000 },
  { size: 80, stroke_min_mm: 50, stroke_max_mm: 8500 },
  { size: 120, stroke_min_mm: 50, stroke_max_mm: 8500 },
  { size: 185, stroke_min_mm: 50, stroke_max_mm: 8500 },
];

export interface EgcFaValue { code: string; label_sv: string }

/** Position 006 — Slide. */
export const EGC_FA_SLIDES: EgcFaValue[] = [
  { code: "GK", label_sv: "Standardslid" },
  { code: "GP", label_sv: "Standardslid, skyddad" },
  { code: "GV", label_sv: "Förlängd slid" },
  { code: "GQ", label_sv: "Förlängd slid, skyddad" },
];

/** Position 010 — Clamping unit. Tom kod = utan. */
export const EGC_FA_CLAMPING: EgcFaValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "1HL", label_sv: "Hållfunktion, enkanalig, vänster" },
  { code: "1HR", label_sv: "Hållfunktion, enkanalig, höger" },
  { code: "2H", label_sv: "Hållfunktion, tvåkanalig" },
];

/** Position 011 — Actuation type. Gäller klämenheten. */
export const EGC_FA_ACTUATION: EgcFaValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "PN", label_sv: "Pneumatiskt manövrerad" },
];

/** Position 009 — Lubrication function. */
export const EGC_FA_LUBRICATION: EgcFaValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "C", label_sv: "Smörjadapter" },
];

/** Positionerna 007 och 008 — extra slid vänster respektive höger. */
export const EGC_FA_EXTRA_SLIDES: EgcFaValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "KL", label_sv: "Extra standardslid, vänster" },
  { code: "KR", label_sv: "Extra standardslid, höger" },
];

/** Position 013 — Foot mounting. */
export const EGC_FA_FOOT: EgcFaValue[] = [
  { code: "", label_sv: "Utan" },
  { code: "F", label_sv: "Fotfäste" },
];

/** Tekniska gränser ur chunk 11. */
export const EGC_FA_LIMITS = { max_speed_ms: 5, max_accel_ms2: 50 } as const;

export interface EgcFaConfig {
  size: number;
  stroke_mm: number;
  /** Position 005. "0H" = ingen reserv; annars 0-999 mm följt av H. */
  stroke_reserve_mm?: number;
  slide?: string;
  extra_slide?: string;
  lubrication?: string;
  clamping?: string;
  actuation?: string;
  foot?: string;
}

/**
 * Bygger en EGC-FA-typkod.
 *
 * Ovalda positioner utelämnas helt, precis som i DSBC:s nyckel -- därför
 * filtreras tomma segment bort i stället för att bli tomma bindestreck.
 */
export function buildEgcFaCode(c: EgcFaConfig): string | null {
  const s = EGC_FA_SIZES.find((x) => x.size === c.size);
  if (!s) return null;
  if (!Number.isInteger(c.stroke_mm) ||
      c.stroke_mm < s.stroke_min_mm || c.stroke_mm > s.stroke_max_mm) {
    return null;
  }
  const finns = (l: EgcFaValue[], k: string) => l.some((x) => x.code === k);
  const slide = c.slide ?? "GK";
  const extra = c.extra_slide ?? "";
  const lub = c.lubrication ?? "";
  const clamp = c.clamping ?? "";
  const act = c.actuation ?? "";
  const foot = c.foot ?? "";
  if (!finns(EGC_FA_SLIDES, slide) || !finns(EGC_FA_EXTRA_SLIDES, extra)) return null;
  if (!finns(EGC_FA_LUBRICATION, lub) || !finns(EGC_FA_CLAMPING, clamp)) return null;
  if (!finns(EGC_FA_ACTUATION, act) || !finns(EGC_FA_FOOT, foot)) return null;

  const reserv = c.stroke_reserve_mm === undefined || c.stroke_reserve_mm === 0
    ? "0H"
    : (c.stroke_reserve_mm > 999 ? null : `${c.stroke_reserve_mm}H`);
  if (reserv === null) return null;

  return [
    EGC_FA_SERIES, String(c.size), String(c.stroke_mm), EGC_FA_GUIDE,
    reserv, slide, extra, lub, clamp, act, foot,
  ].filter((x) => x !== "").join("-");
}

export interface EgcFaReading {
  size: number;
  stroke_mm: number;
  stroke_reserve_mm: number;
  slide: string;
  segments: string[];
}

/**
 * Läser en EGC-FA-typkod.
 *
 * Bara de sex obligatoriska positionerna tolkas; resten returneras som
 * segment. Positionerna 012 och 014-027 är tillbehör som beställs i ANTAL
 * ("...B 1 ... 50 pieces"), och deras kodform framgår inte av den inlästa
 * texten -- de går att läsa, inte att tolka.
 */
export function parseEgcFaCode(raw: string): EgcFaReading | null {
  const delar = raw.trim().toUpperCase().split("-");
  if (delar.length < 6) return null;
  const [serie, storlek, slag, styrning, reserv, slid, ...resten] = delar;
  if (serie !== EGC_FA_SERIES || styrning !== EGC_FA_GUIDE) return null;

  const s = EGC_FA_SIZES.find((x) => String(x.size) === storlek);
  const stroke_mm = Number(slag);
  if (!s || !Number.isInteger(stroke_mm)) return null;
  if (stroke_mm < s.stroke_min_mm || stroke_mm > s.stroke_max_mm) return null;

  const m = /^(\d{1,3})H$/.exec(reserv);
  if (!m) return null;
  if (!EGC_FA_SLIDES.some((x) => x.code === slid)) return null;

  return {
    size: s.size, stroke_mm, stroke_reserve_mm: Number(m[1]),
    slide: slid, segments: resten,
  };
}

/** Största arbetsslag för en storlek. */
export function egcFaMaxStroke(size: number): number | null {
  return EGC_FA_SIZES.find((s) => s.size === size)?.stroke_max_mm ?? null;
}

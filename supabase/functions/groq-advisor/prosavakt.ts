/**
 * Fördelar som språkmodellen skriver men som inte stämmer för produkten.
 *
 * Modellen skriver pros/cons fritt utifrån specarna. Den har inget sätt att
 * veta att en pneumatisk cylinder bara har två ändlägen, och den belönar
 * gärna "mer" av allt. Reglerna här är deterministiska efterkontroller, i
 * samma anda som STROKE_MISMATCH_CON i index.ts: vi skriver inte om texten,
 * vi stryker det som är fel.
 */

/**
 * "Exakt positionering" om en pneumatisk cylinder.
 *
 * Hittat 2026-10-02 (granskning, livsmedelsfall): "Dubbelverkande ger exakt
 * positionering" och "Dubbelverkande för exakt kontroll" som gröna bockar på
 * tre pneumatiska cylindrar. En pneumatisk cylinder stannar i sina ändlägen;
 * mellanlägen kräver servopneumatik eller en elektrisk axel. För en elektrisk
 * axel är samma mening en riktig fördel, så regeln gäller bara pneumatik.
 */
const EXAKT_POSITIONERING =
  /(exakt|precis|noggrann)\w*\s+(position|kontroll|styrning|stopp)|positioner\w*\s+(exakt|precis)|(exact|precise|accurate)\w*\s+(position|control|stop)|genaue?\s+(position|steuerung)|(posicionamiento|control)\s+precis/i;

export function rensaPositionsPros(pros: string[], pneumatisk: boolean): string[] {
  return pneumatisk ? pros.filter((p) => !EXAKT_POSITIONERING.test(p)) : pros;
}

/**
 * Längre slag än kravet som en FÖRDEL.
 *
 * Mönstret fanns redan i index.ts men kände bara igen "slaglängd": "Långt
 * slag (200 mm) ger möjlighet till större rörelseomfång" passerade, i ett fall
 * där kravet var 50 mm. Överskjutande slag är en avvikelse som kräver
 * mekaniskt ändstopp, inte en fördel.
 */
export const LANGRE_SLAG_PRO =
  /l[äåa]ng\w*\s+slag|\bslag\w*.{0,30}(l[äa]ngre|extra|mer\b|över|större|exceed)|(stroke|\bhub\b|carrera).{0,30}(l[äa]ngre|extra|mer\b|över|exceed|longer|more\b|l[äa]nger|mayor|superior)|long(er)?\s+stroke/i;

/**
 * En SERIE beställs i det slag som krävs. Dess maxslag är varken en fördel
 * eller en nackdel.
 *
 * Hittat i drift 2026-10-06 (livsmedelsfall, Ø32, 100 mm): tre serier fick
 * rätt not -- "exakt slaglängd (100 mm) väljs vid beställning" -- och ändå
 * "Slag 300 mm överstiger kravet" som grön bock, "Slag 300 mm är längre än
 * nödvändigt" som nackdel och "Slag 500 mm" som fördel. Modellen läste
 * seriens maxslag som radens slag. Stryk det som handlar om maxslaget.
 */
export function rensaSerieslag(
  pros: string[],
  cons: string[],
  maxSlagMm: number,
): { pros: string[]; cons: string[] } {
  const omMaxslaget = maxSlagMm > 0
    ? new RegExp(`(slag|stroke|\\bhub\\b|carrera)\\w*\\D{0,12}${maxSlagMm}\\s*mm`, "i")
    : null;
  const stryk = (t: string) => LANGRE_SLAG_PRO.test(t) || (omMaxslaget?.test(t) ?? false);
  return { pros: pros.filter((t) => !stryk(t)), cons: cons.filter((t) => !stryk(t)) };
}

/**
 * Nackdelar som produktens egna data motsäger.
 *
 * Hittat i kundgranskningen 2026-11-13 ("Ø50 slag 200"): Camozzi
 * 63M2A050A200 fick "Ingen magnetkolv" fast specen säger "Magnetic piston,
 * T-slot sensor", och AVENTICS 0822122007 fick "Ingen justerbar dämpning"
 * fast specen säger "Adjustable cushioning (both ends)". Modellen hade
 * specarna framför sig. Stryk påståendet när datan säger motsatsen; en
 * nackdel som saknar stöd är värre än ingen.
 */
const NEG = String.raw`\b(?:ingen|inga|saknar|utan|ej|inte|no|not|without|lacks?|lacking|keine?n?|ohne|sin|carece)\b`;
const MAGNETKOLV = String.raw`(?:magnet(?:kolv|ring)|magnetisk\w*\s+kolv|magnetic\s+(?:piston|ring)|magnetkolben|(?:émbolo|pistón)\s+magnético)`;
const DAMPNING = String.raw`(?:dämpning|cushion\w*|dämpfung|amortigua\w*)`;
const JUSTERBAR = String.raw`(?:justerbar\w*|adjustable|einstellbar\w*|ajustable)`;
const NEJ_MAGNET = new RegExp(`${NEG}[^.;:]{0,30}${MAGNETKOLV}`, "i");
const NEJ_JUSTERBAR = new RegExp(`${NEG}[^.;:]{0,20}${JUSTERBAR}[^.;:]{0,20}${DAMPNING}`, "i");
const NEJ_DAMPNING = new RegExp(`${NEG}[^.;:]{0,20}${DAMPNING}`, "i");

// Groq-provet 2026-11-19: "Ingen positionsavkänning i båda ändlägena (krav på
// andlagesavkanning saknas i katalogen)" om AVENTICS PRA ("Optional reed/PNP
// sensor") och Camozzi 63 ("Magnetic piston, T-slot sensor"). Ändlägena
// avkänns med magnetkolv och separata givare, och givarna står i stycklistan.
const LAGESAVKANNING = String.raw`(?:(?:positions|läges|ändläges)avkänning|givare|position\s+(?:sensing|detection|feedback)|end-position\s+sensing|sensor\w*|positionserfassung|endlagenabfrage|detecci[oó]n\s+de\s+(?:posici[oó]n|fin\s+de\s+carrera))`;
const NEJ_LAGE = new RegExp(`${NEG}[^.;:]{0,30}${LAGESAVKANNING}`, "i");

export function rensaMotsagelser(cons: string[], data: string): string[] {
  const d = String(data ?? "");
  const harMagnet = /magnet/i.test(d) && !/non-?magnetic|without magnet|utan magnet|ingen magnet/i.test(d);
  const harGivare = harMagnet || /\b(?:reed|sensor|position)/i.test(d);
  const harJusterbar = new RegExp(JUSTERBAR, "i").test(d);
  const harDampning = new RegExp(DAMPNING, "i").test(d) && !/no cushion|without cushion|ingen dämpning|utan dämpning/i.test(d);
  return cons.filter((c) => {
    if (harMagnet && NEJ_MAGNET.test(c)) return false;
    if (harGivare && NEJ_LAGE.test(c)) return false;
    if (harJusterbar && NEJ_JUSTERBAR.test(c)) return false;
    if (harDampning && !NEJ_JUSTERBAR.test(c) && NEJ_DAMPNING.test(c)) return false;
    return true;
  });
}

/**
 * Texten rensaMotsagelser läser: namnet och specvärdena. Nyckeln används bara
 * som etikett när den säger vad värdet är -- "cushioning_types: Pneumatic,
 * self-adjusting" är dämpning fast värdet inte säger ordet.
 */
export function produktdataText(namn: string, specar: Record<string, unknown>): string {
  return [namn, ...Object.entries(specar ?? {}).map(([k, v]) => {
    const s = String(v ?? "");
    return /cushion|dämp|damp/i.test(k) && s.trim() && !/^(none|ingen|no|-)$/i.test(s.trim()) ? `cushioning ${s}` : s;
  })].join(" ; ");
}

/**
 * Svarens id ("andlagesavkanning", "slaglangd_mm") är interna nycklar. Modellen
 * fick dem som de var och skrev "krav på andlagesavkanning saknas i katalogen"
 * för en kund (Groq-provet 2026-11-19). Prompten får ämnet i klartext, och en
 * nyckel som ändå slinker igenom byts mot ämnet på kundens språk.
 */
type Fyra = { sv: string; en: string; de: string; es: string };
const SVARSAMNE: Record<string, Fyra> = {
  andlagesavkanning: { sv: "lägesavkänning i ändlägena", en: "end-position sensing", de: "Endlagenabfrage", es: "detección de fin de carrera" },
  takt: { sv: "takt", en: "cycle rate", de: "Taktrate", es: "frecuencia de ciclo" },
  manovrering: { sv: "styrning", en: "how it is controlled", de: "Ansteuerung", es: "mando" },
  miljo: { sv: "miljö", en: "environment", de: "Umgebung", es: "entorno" },
  slaglangd_mm: { sv: "slaglängd (mm)", en: "stroke (mm)", de: "Hub (mm)", es: "carrera (mm)" },
  last_kg: { sv: "last (kg)", en: "load (kg)", de: "Last (kg)", es: "carga (kg)" },
  kraft_n: { sv: "kraft (N)", en: "force (N)", de: "Kraft (N)", es: "fuerza (N)" },
  rorelseriktning: { sv: "rörelseriktning", en: "direction of motion", de: "Bewegungsrichtung", es: "dirección del movimiento" },
  lasthallning: { sv: "lasthållning", en: "load holding", de: "Lasthaltung", es: "retención de la carga" },
  livsmedelskontakt: { sv: "livsmedelskontakt", en: "food contact", de: "Lebensmittelkontakt", es: "contacto con alimentos" },
  korrosion: { sv: "korrosion", en: "corrosion", de: "Korrosion", es: "corrosión" },
  greppsatt: { sv: "greppsätt", en: "grip type", de: "Greifart", es: "tipo de agarre" },
  precision: { sv: "precision", en: "precision", de: "Präzision", es: "precisión" },
};

export function svarsamne(id: string, locale: string): string {
  const t = SVARSAMNE[id];
  if (t) return t[(locale as keyof Fyra)] ?? t.en;
  return id.replace(/_/g, " ");
}

/** Svaren som prompten ser dem: ämne i klartext, aldrig den interna nyckeln. */
export function svarForPrompt(svar: Record<string, string>): string {
  return Object.entries(svar ?? {}).map(([k, v]) => `${svarsamne(k, "en")}: ${v}`).join(", ");
}

export function utanSvarsId(text: string, ids: string[], locale: string): string {
  let t = String(text ?? "");
  for (const id of ids) {
    if (!/^[a-z][a-z0-9_]{4,}$/.test(id) || !t.includes(id)) continue;
    t = t.replace(new RegExp(String.raw`\b${id}\b`, "g"), svarsamne(id, locale));
  }
  return t;
}

/**
 * Böjningsfel modellen gör på svenska: "En dubbelverkande pneumatiskt
 * cylinder" (två gånger i Groq-provet 2026-11-19) och frågan "Sittar
 * komponenten i livsmedelszonen?". Cylinder, ventil, axel och aktuator är
 * n-ord; ett gripdon är t-ord och lämnas.
 */
export function svenskFix(text: string): string {
  return String(text ?? "")
    .replace(/\b(pneumatisk|elektrisk|hydraulisk)t(\s+(?:cylinder|ventil|axel|aktuator|ventilö|linjärenhet)(?![\wåäö]))/gi, "$1$2")
    .replace(/\bSittar\b/g, "Sitter").replace(/\bsittar\b/g, "sitter");
}

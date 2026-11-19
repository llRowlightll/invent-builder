// Gäller förfrågan automation, och är den en ren räknefråga?
//
// Nattestet 2026-11-19: "Vad kostar en kaffebryggare?" fick frågor om
// slaglängd och last och sedan tre cylindrar, och "Hur mycket kraft ger en
// Ø63 cylinder vid 6 bar?" fick ett cylinderval men inget svar på frågan.
// Motorn behandlade varje text som en rörelse.
//
// Bedömningen är medvetet snäll: ett enda ord om rörelse, komponent eller
// maskin, ett mått med enhet, ett fabrikat eller ett artikelnummer räcker för
// att texten ska gälla automation. Bara text utan något av det räknas som
// utanför ämnet, och besökaren kan alltid välja att fortsätta ändå.

import { pick, SEAL_EFFICIENCY } from "./signals.ts";

const AUTOMATIONSORD = new RegExp([
  // Komponenter och teknik
  "cylind", "zylind", "cilindr", "aktuator", "actuat", "aktor", "actuador", "ventil", "valv", "válvul",
  "pneumat", "neumát", "hydraul", "hidrául", "tryckluft", "druckluft", "compressed air", "aire comprimido",
  "luftberedning", "wartungseinheit", "\\bfrl\\b", "regulator", "regler", "regulador", "filter", "filtro",
  "givare", "sensor", "sensoren", "geber", "slang", "schlauch", "\\btub(?:e|o|ing)", "manguera",
  "koppling", "fitting", "verschraubung", "racor", "ljuddämp", "silencer", "schalldämpfer", "silenciador",
  "gripdon", "griper", "gripper", "greifer", "pinza", "sugkopp", "suction", "saug", "ventosa",
  "vakuum", "vacuum", "vacío", "ejektor", "ejector", "eyector", "motor", "servo", "stepper", "steg",
  "axel", "\\baxis\\b", "\\baxes\\b", "achse", "\\beje", "linjär", "linear", "lineal", "slid", "schlitten",
  "kolv", "piston", "kolben", "pistón", "stång", "\\brod\\b", "stange", "vástago", "borrning", "\\bbore\\b",
  "slaglängd", "\\bslag\\b", "stroke", "\\bhub\\b", "carrera", "recorrido",
  "vridcylinder", "vriddon", "rotary", "schwenk", "drehantrieb", "giratori", "rotativ",
  "plc", "sps", "io-link", "profinet", "ethercat", "ethernet/ip", "modbus", "fältbuss", "feldbus", "fieldbus",
  "stötdämp", "shock absorb", "stoßdämpf", "amortiguador", "broms", "brake", "bremse", "freno",
  "ventilö", "ventilinsel", "manifold", "terminal de válvulas", "valve terminal",
  // Maskiner och tillämpningar
  "maskin", "machine", "maschine", "máquina", "robot", "portal", "gantry", "station", "cell\\b", "zelle",
  "transportör", "transportband", "conveyor", "förderband", "cinta", "transportad", "rullbana",
  "automat", "automati", "fixtur", "fixture", "vorrichtung", "verktyg", "werkzeug", "herramienta",
  "press", "prensa", "stans", "punch", "stanz", "troquel", "pall", "pallet", "palette", "palé",
  "lucka", "lucke", "\\bdoor\\b", "\\bpuert", "\\btür", "lock\\b", "\\blid\\b", "deckel", "tapa",
  "förpackning", "packaging", "verpackung", "embalaje", "sortering", "sorting", "sortier", "clasific",
  "montering", "assembly", "montage", "ensamblaje", "svets", "weld", "schweiß", "soldad",
  "atex", "ip6", "ip5", "washdown", "renrum", "cleanroom", "reinraum", "iso 15552", "iso 6432",
  // Rörelser
  "lyft", "\\blift", "hoist", "heb", "levant", "elev", "sänk", "lower", "senk", "baj",
  "skjut", "push", "schieb", "empuj", "\\bdra\\b", "\\bdrar\\b", "\\bpull", "zieh", "tirar",
  "flytta", "\\bmove", "beweg", "mover", "förflytt", "transfer",
  "klämm", "\\bclamp", "spann", "klemm", "sujet", "apret", "pressa", "\\bpress", "drück", "presion",
  "greppa", "\\bgrip", "\\bgrab", "greif", "agarr", "plock", "\\bpick", "pflück", "recog", "placer", "\\bplace\\b",
  "vrid", "\\brotat", "\\bturn", "dreh", "girar", "vänd", "\\bflip", "wend", "voltear", "tipp", "\\btilt", "kipp", "inclin",
  "öppna", "\\bopen", "öffn", "abrir", "stäng", "\\bclose", "schließ", "cerrar",
  "stopp", "\\bstop", "anschlag", "\\bpar(?:ar|e)\\b", "positioner", "position", "posicion", "mata\\b", "\\bfeed", "zuführ", "aliment",
  "hålla", "\\bhold", "halten", "sujetar", "spärr", "\\block", "sperr", "bloque",
  // Storheter, miljö och sammanhang
  "kraft", "\\bforce", "fuerza", "tryck", "pressure", "druck", "presi[oó]n", "hastighet", "\\bspeed", "geschwind", "velocidad",
  "\\bvikt", "\\bväg(?:er|a)\\b", "weigh", "gewicht", "wiegt", "\\bpes[oa]", "\\blast(?:en)?\\b", "\\bload", "\\bcarga",
  "detalj", "\\bparts?\\b", "\\bteil", "\\bpieza", "komponent", "component", "bauteil", "ämne", "werkstück", "workpiece",
  "industri", "fabrik", "factory", "fábrica", "produktion", "production", "producción", "linje", "\\bline\\b", "anlage", "anläggning", "\\bplant\\b",
  "livsmedel", "\\bfood", "lebensmittel", "aliment", "pharma", "läkemedel", "\\bgmp\\b", "\\bfda\\b", "hygien", "hygiene",
  "explos", "\\bzon(?:e)?\\s*\\d", "\\bzona\\s*\\d", "gasgrupp", "gas group", "temperaturklass", "\\bT[1-6]\\b", "\\bex\\b",
  "spol", "tvätt", "\\bwash", "wasch", "lavad", "slakt", "ånga", "steam", "dampf", "vapor", "kemikal", "chemic", "chemik", "qu[ií]mic",
  "damm", "\\bdust", "staub", "polvo", "fukt", "moist", "feucht", "humedad", "salt", "\\bbåt", "\\bboat", "schiff", "barco", "hatch", "klappe", "escotilla", "luk",
  "frys", "kyl", "freez", "kühl", "congel", "\\bcold", "\\bkall", "värme", "\\bheat", "hitze", "\\bcalor", "temperatur", "ugn", "\\boven", "\\bofen", "horno",
  "tätning", "\\bseal", "dichtung", "\\bjunta", "rostfri", "stainless", "edelstahl", "inoxid", "batteri", "battery", "batterie", "batería", "torrkammare", "dry.?room",
  "\\bband(?:et)?\\b", "\\bburk", "\\bcans?\\b", "flask", "bottle", "kartong", "\\bbox", "karton", "\\bcaja", "låda", "glas", "\\bplåt", "\\bsheet", "blech", "chapa",
  "ändläge", "\\bi topp\\b", "\\bi botten\\b", "\\btop\\b", "bottom", "ausgefahren", "eingefahren", "arriba", "abajo",
  "\\brem(?:men)?\\b", "\\bbelt", "riemen", "correa", "skruv", "screw", "spindel", "spindle", "husillo", "verkande", "\\bacting", "wirkend", "efecto",
  "fäste", "\\bmount", "befestig", "montaje", "fläns", "flange", "flansch", "\\bbrida", "\\bM(?:5|8|12)\\b", "connector", "stecker", "conector",
  "styr", "steuer", "\\bcontrol", "l[ií]nea", "limpieza", "ácid", "\\bacid", "korrosion", "corros", "utomhus", "outdoor", "\\bim freien", "exterior",
  "oxygen", "syrgas", "sauerstoff", "oxígeno", "\\bsil\\s*\\d", "\\bpl\\s*[a-e]\\b", "\\bpl[a-e]\\b", "iso\\s*13849", "säkerhet", "safety", "sicherheit", "seguridad",
  "skydd", "grind", "\\bgate", "frekvens", "frequen", "dygnet runt", "24/7", "cykl", "cykeltid", "\\bcycle", "zyklus", "\\bciclo",
  "håll", "grepp", "\\bgrepp", "vinkel", "\\bangle", "winkel", "[aá]ngulo",
  // Fabrikat
  "festo", "\\bsmc\\b", "aventics", "rexroth", "parker", "norgren", "camozzi", "metal work", "univer", "bimba", "schunk", "piab",
].join("|"), "i");

/** Ett mått med enhet som bara en teknisk förfrågan har. */
const TEKNISKT_MATT = /(?:Ø|ø|⌀)\s*\d|\b\d+(?:[.,]\d+)?\s*(?:mm|cm|kg|g|N|kN|Nm|bar|MPa|psi|m\/s|mm\/s|°|grader|Grad|grados|degrees|cykler|cycles|takt|Takte|ciclos|l\/min|Nl\/min|V\s*DC|VDC|VAC|Hz)\b/i;

/** En orderkod: bokstäver och siffror med bindestreck, som DSBC-50-100-PPVA. */
const ORDERKOD = /\b[A-Z]{2,}[A-Z0-9]*-\d+[A-Z0-9-]*\b|\b[A-Z]{1,4}\d{2,}[A-Z0-9-]*\b|\b\d{6,}[A-Z0-9-]*\b/;

export type Amne = "automation" | "utanfor";

export function amnesbedomning(text: string, kodUpplost = false): Amne {
  const t = text.trim();
  if (!t) return "utanfor";
  if (kodUpplost) return "automation";
  if (AUTOMATIONSORD.test(t) || TEKNISKT_MATT.test(t) || ORDERKOD.test(t)) return "automation";
  return "utanfor";
}

export function utanforAmnetText(locale: string): string {
  return pick(locale, {
    sv: "Det här verkar inte gälla en maskin eller en automationslösning. Maskinbyggaren väljer cylindrar, ventiler, axlar, gripdon och det som hör till. Beskriv vad som ska röra sig, hur långt och hur tungt det är, till exempel: \"Skjuta kartonger på 5 kg 300 mm åt sidan på ett transportband.\"",
    en: "This doesn't seem to be about a machine or an automation solution. The machine builder chooses cylinders, valves, axes, grippers and what goes with them. Describe what has to move, how far and how heavy it is, for example: \"Push 5 kg boxes 300 mm sideways off a conveyor.\"",
    de: "Das scheint keine Maschine oder Automatisierungslösung zu betreffen. Der Maschinenbauer wählt Zylinder, Ventile, Achsen, Greifer und das Zubehör. Beschreiben Sie, was sich bewegen soll, wie weit und wie schwer es ist, zum Beispiel: \"Kartons mit 5 kg 300 mm seitlich vom Förderband schieben.\"",
    es: "Esto no parece tratar de una máquina ni de una solución de automatización. El configurador elige cilindros, válvulas, ejes, pinzas y lo que va con ellos. Describa qué debe moverse, cuánto y cuánto pesa, por ejemplo: \"Empujar cajas de 5 kg 300 mm hacia un lado de una cinta.\"",
  });
}

// ── Räknefrågan: kraften en borrning ger ─────────────────────────────────────

const KRAFTFRAGA = /hur\s+(?:mycket|stor)\s+kraft|vilken\s+kraft|how\s+much\s+force|what\s+(?:is\s+the\s+)?force|which\s+force|wie\s+viel\s+kraft|welche\s+kraft|cu[aá]nta\s+fuerza|qu[eé]\s+fuerza/i;

/** Kolvstång enligt ISO 6432 (Ø8–25) och ISO 15552 (Ø32–125). */
const ISO_STANG: Record<number, number> = {
  8: 4, 10: 4, 12: 6, 16: 6, 20: 8, 25: 10, 32: 12, 40: 16, 50: 20, 63: 20, 80: 25, 100: 25, 125: 32,
};

/**
 * Svaret på "hur mycket kraft ger en Ø63 vid 6 bar?", eller null när texten
 * inte är en sådan fråga. Räknat som i resten av motorn: teoretisk kraft
 * p × A, och det man kan räkna med efter tätningsfriktionen (× 0,75).
 */
export function kraftsvar(text: string, locale: string): string | null {
  if (!KRAFTFRAGA.test(text)) return null;
  const borr = text.match(/(?:Ø|ø|⌀|\bD\s*=?\s*)\s*(\d{1,3})\b/)?.[1] ??
    text.match(/\b(\d{1,3})\s*mm\s+(?:cylind|zylind|cilindr|borr|bore|kolv|piston|kolben)/i)?.[1] ??
    text.match(/(?:cylind\w*|zylind\w*|cilindr\w*)\s+(?:Ø\s*)?(\d{1,3})\b(?!\s*(?:mm\s+(?:slag|stroke|hub|carrera)|kg|bar))/i)?.[1];
  const d = borr ? parseInt(borr) : NaN;
  if (!(d >= 6 && d <= 320)) return null;
  const trycket = text.match(/(\d+(?:[.,]\d+)?)\s*bar\b/i)?.[1];
  const p = trycket ? parseFloat(trycket.replace(",", ".")) : 6;
  if (!(p > 0 && p <= 16)) return null;
  const area = Math.PI / 4 * d * d;
  const ut = Math.round(area * p * 0.1);
  const utN = Math.round(ut * SEAL_EFFICIENCY);
  const stang = ISO_STANG[d];
  const in_ = stang ? Math.round((area - Math.PI / 4 * stang * stang) * p * 0.1) : 0;
  const inN = Math.round(in_ * SEAL_EFFICIENCY);
  const kg = Math.round(utN / 9.81 / 2);
  const ps = String(p).replace(".", locale === "en" ? "." : ",");
  const tal = (n: number) => n.toLocaleString(locale === "sv" ? "sv-SE" : locale === "de" ? "de-DE" : locale === "es" ? "es-ES" : "en-GB");
  const norm = d <= 25 ? "ISO 6432" : "ISO 15552";
  return pick(locale, {
    sv: `En Ø${d} vid ${ps} bar ger teoretiskt ${tal(ut)} N utåt (tryckyta ${tal(Math.round(area))} mm²). Räkna med cirka ${tal(utN)} N efter tätningsfriktionen.` +
      (stang ? ` Inåt, med kolvstång Ø${stang} enligt ${norm}, blir det ${tal(in_)} N teoretiskt och cirka ${tal(inN)} N i praktiken.` : " Inåt blir kraften mindre, för kolvstången tar en del av ytan.") +
      ` Ska den lyfta en last, räcker den till ungefär ${tal(kg)} kg med säkerhetsfaktor 2. Svara på frågorna nedan om du vill att vi väljer cylindern och det som hör till.`,
    en: `A Ø${d} at ${ps} bar gives ${tal(ut)} N extending in theory (piston area ${tal(Math.round(area))} mm²). Count on about ${tal(utN)} N after seal friction.` +
      (stang ? ` Retracting, with a Ø${stang} piston rod to ${norm}, it is ${tal(in_)} N in theory and about ${tal(inN)} N in practice.` : " Retracting gives less, because the piston rod takes up part of the area.") +
      ` For lifting a load, it is enough for about ${tal(kg)} kg with a safety factor of 2. Answer the questions below if you want us to choose the cylinder and what goes with it.`,
    de: `Ein Ø${d} bei ${ps} bar liefert theoretisch ${tal(ut)} N beim Ausfahren (Kolbenfläche ${tal(Math.round(area))} mm²). Rechnen Sie nach der Dichtungsreibung mit etwa ${tal(utN)} N.` +
      (stang ? ` Beim Einfahren, mit Kolbenstange Ø${stang} nach ${norm}, sind es theoretisch ${tal(in_)} N und praktisch etwa ${tal(inN)} N.` : " Beim Einfahren ist die Kraft geringer, weil die Kolbenstange einen Teil der Fläche einnimmt.") +
      ` Zum Heben einer Last reicht er für etwa ${tal(kg)} kg mit Sicherheitsfaktor 2. Beantworten Sie die Fragen unten, wenn wir den Zylinder und das Zubehör auswählen sollen.`,
    es: `Un Ø${d} a ${ps} bar da en teoría ${tal(ut)} N al avanzar (área del pistón ${tal(Math.round(area))} mm²). Cuente con unos ${tal(utN)} N tras la fricción de las juntas.` +
      (stang ? ` Al retroceder, con vástago Ø${stang} según ${norm}, son ${tal(in_)} N en teoría y unos ${tal(inN)} N en la práctica.` : " Al retroceder la fuerza es menor, porque el vástago ocupa parte del área.") +
      ` Para levantar una carga, alcanza para unos ${tal(kg)} kg con un factor de seguridad de 2. Responda a las preguntas de abajo si quiere que elijamos el cilindro y lo que va con él.`,
  });
}

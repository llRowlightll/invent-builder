// ─────────────────────────────────────────────────────────────────────────────
// signals.ts — hazard/requirement detection and free-text extraction (pure, no I/O).
//
// Extracted from index.ts (alongside bom-builder.ts) so this logic can be
// unit-tested with `deno test` without starting the Deno.serve HTTP entrypoint,
// mirroring scoring.ts's existing precedent. Nothing here performs network,
// Deno.env, or Supabase access — keep it that way. bom-builder.ts depends on
// this file (pick, isPneumaticByDrive); this file depends on nothing from
// bom-builder.ts or index.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { hastighetensObjekt, hastighetsKravId, type Tolkningsbeslut } from "./kravbild.ts";
import { type CatalogProduct, parseStrokeFromSpecs } from "./scoring.ts";

// Found 2026-08-19: every LLM-facing "write your answer in ${lang}" instruction
// derived its language name from `isSv` (locale === "sv" ? "svenska" : "English"),
// which silently collapsed de/es into English — the site's de/es UI is fully
// translated, but the AI questions/options/BOM text was English-only for those
// two locales. This is the single source of truth for that instruction now.
export const LLM_LANG_NAME: Record<string, string> = { sv: "svenska", en: "English", de: "Deutsch", es: "español" };

export function langName(locale: string): string {
  return LLM_LANG_NAME[locale] ?? LLM_LANG_NAME.en;
}

/**
 * Svenska fackord i modellens text. Hittat i drift 2026-10-06: "Kolonnen
 * är dubbelverkande", "Dubbelaktuell konstruktion", "Dichtung" mitt i en
 * svensk mening, "SMC-greppet GR-S-010" (fett) och engelska "Force 483 N".
 * Emojierna står kvar: ägaren vill ha dem, de gör texten lättare att läsa.
 */
export function sprakregler(locale: string): string {
  return locale === "sv"
    ? ` Swedish terminology: write "cylinder" (never "kolonn"), "dubbelverkande"/"enkelverkande" (never "dubbelaktuell"), "tätning" (never "Dichtung"), "kraft" (not "force"), "slaglängd" (not "stroke"), "kolvdiameter" or "borrning" (not "bore"), "fett" or "smörjmedel" (never "grepp").`
    : "";
}

// Found 2026-08-21: task tracked as "translate the remaining ~75 hardcoded
// isSv ? svenska : English strings" (BOM role/reason text, option pros/cons,
// badges) — everything the langName() fix above doesn't reach because it's
// not LLM-generated, it's fixed text the server writes directly. Closing it
// now: same single-lookup pattern as langName(), just for a whole string set
// per call site instead of one language name.
export function pick<T>(locale: string, t: { sv: T; en: T; de: T; es: T }): T {
  return t[locale as keyof typeof t] ?? t.en;
}

export function balancedSlice(products: CatalogProduct[], maxTotal: number): CatalogProduct[] {
  const byCategory = new Map<string, CatalogProduct[]>();
  for (const p of products) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push(p);
  }
  const numCats = byCategory.size;
  if (numCats === 0) return [];
  const perCat = Math.max(8, Math.ceil(maxTotal / numCats));
  const result: CatalogProduct[] = [];
  for (const ps of byCategory.values()) {
    result.push(...ps.slice(0, perCat));
    if (result.length >= maxTotal * 1.5) break;
  }
  return result.slice(0, maxTotal);
}

/**
 * v24: Sort products so the most requirement-relevant ones appear first.
 * Products with stroke matching requiredStroke go first (ascending overshoot).
 * Products with no stroke spec (accessories, sensors) are appended at the end.
 * Products that DON'T meet the stroke are sorted by descending stroke (closest fallback).
 */
export function sortByStrokeMatch(products: CatalogProduct[], requiredStroke: number): CatalogProduct[] {
  if (requiredStroke === 0) return products;
  return [...products].sort((a, b) => {
    const sA = parseStrokeFromSpecs(a.key_specs ?? {});
    const sB = parseStrokeFromSpecs(b.key_specs ?? {});
    // Accessories (no stroke) — keep at end
    if (sA === 0 && sB === 0) return 0;
    if (sA === 0) return 1;
    if (sB === 0) return -1;
    const aOk = sA >= requiredStroke;
    const bOk = sB >= requiredStroke;
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    if (aOk && bOk) return sA - sB; // both qualify → prefer smallest (least oversized)
    return sB - sA; // both too short → prefer longest (closest to requirement)
  });
}

/**
 * Multi-function / line-level system request: the user is describing a whole
 * production line with several distinct stations (weighing, identification/
 * vision, robot handling, multi-lane sorting) — not a single actuator. We must
 * NOT collapse this to one component (least of all a passive shock absorber),
 * and we must be honest that weighing/vision/PLC/robot are outside our component
 * catalog. Triggers when >=2 of these out-of-catalog functions are requested.
 */
export function isMultiFunctionSystem(text: string): boolean {
  const t = text.toLowerCase();
  let n = 0;
  // weighing / load cells (the weighing FUNCTION, not "the box weighs 5 kg")
  if (/lastcell|load.?cell|\bweigh|vägning|väga\b|\bväg\s+och|registrera\s+vikt/i.test(t)) n++;
  // identification: barcode / label / vision / camera / scanner / object-ID
  if (/streckkod|barcode|\betikett|\blabel\b|\bvision\b|kamera|\bcamera\b|scanner|skanna|\bocr\b|\bqr\b|identifiera\s+(kartong|produkt|objekt|artikel|enhet|paket|låda|del)/i.test(t)) n++;
  // robot handling
  if (/\brobot\b|scara|delta.?robot|plockrobot|industrirobot|cobot/i.test(t)) n++;
  // multi-lane sorting (several lanes — not a single divert cylinder)
  if (/sorteringsban|sorter[a-z]*\b.{0,20}(\d+|tre|flera)\s*(olika\s*)?(ban|väg|lane|fack)|\d+[-\s]*vägs?\s*sorter/i.test(t)) n++;
  return n >= 2;
}

export function detectCategories(text: string): string[] {
  const t = text.toLowerCase();
  const slugs = new Set<string>();
  if (/lyft|press|klämm|stansa|trycka|cylinder|pneumatisk|luft|piston|double.act/i.test(t))
    slugs.add("cylinder");
  if (/elektrisk|servo|stepper|präcis|precis|positioner|linjäraxel|electric|ball.screw|kuggrem|kuggremsaxel|elaxel|eldriven|repeterbar|repeatab|noggrann|accura|mikrometer|µm|\bum\b/i.test(t)) {
    slugs.add("electric-actuator");
    slugs.add("linear-module");
    slugs.add("servo-motor");   // drivetrain: motor for the electric axis
    slugs.add("servo-drive");   // drivetrain: drive/amplifier for the motor
  }
  if (/linjär.*modul|slide|guidning|linear.*module|linear.*axis|linjär.*axel|linjärmodul|egc\b|lefs\b|lesh\b|egsk\b|egsp\b|hmr\b|osp.e|lbb\b|hlr\b|elga\b/i.test(t))
    slugs.add("linear-module");
  if (/roter|rotat|\bvrid|sväng|rotary|svängrör|vridrör|\bNm\b/i.test(t)) slugs.add("rotary-actuator");
  if (/vakuum|sugg|sugkopp|vacuum|suction|plocka|pick.*place|pick.and.place|lyft.*upp|grepp|grip|känslig|inte.*repa|skada.*inte|kretskort|pcb|elektronik|glas|optik/i.test(t))
    slugs.add("vacuum");
  if (/gripper|klämma|jaw|parallel.grip/i.test(t)) slugs.add("gripper");
  if (/ventil(?!terminal)|valve(?!.terminal)|solenoid/i.test(t)) slugs.add("valve");
  if (/ventilterminal|valve.terminal|vtug|vtsa|mpa\b|cpv\b|ventilblock|manifold|fördelare|ventilramp/i.test(t))
    slugs.add("valve-terminal");
  if (/sensor|detek|proximity|reed/i.test(t)) slugs.add("sensor");
  // Cleanroom (actual ISO-class rooms): switch to electric-only
  // Note: use \bclean\b to avoid matching "clean design" product names
  if (/\brenrum\b|\bcleanroom\b|\bclean\s+room\b|programmera|mjukstart|mjukstopp/i.test(t)) {
    slugs.delete("cylinder");
    slugs.add("electric-actuator");
    slugs.add("linear-module");
  }
  // ATEX / EX-zone: electric actuators are FORBIDDEN — strip them from categories
  if (needsAtex(t)) {
    slugs.delete("electric-actuator");
    slugs.delete("linear-module");
    // ATEX bans ALL electric kit, including the drivetrain (motor + drive). Without
    // deleting these too, an ATEX + precision request was left with ONLY servo-
    // motor/servo-drive candidates and ranked a strokeless stepper motor as
    // "Bästa valet" (invariant breach #49) instead of escalating to CUSTOM.
    slugs.delete("servo-motor");
    slugs.delete("servo-drive");
    if (slugs.size === 0) slugs.add("cylinder");
  }
  // Pick & place: cylinders + vacuum + linear-module (electric option)
  if (/pick.and.place|pick.*place|plocka.*placera|plocka.*flytta|plocka.{0,80}\b(ställ|lägg|sätt)(a|er)\b|lyfter.*flytta|flytta.*lyft|transfer.*station|montering|montage/i.test(t)) {
    slugs.add("cylinder");
    slugs.add("vacuum");
    slugs.add("linear-module");
  }
  // Shock absorber: decelerating an EXTERNAL moving mass at end of travel (not a
  // cylinder's own end-cushioning). Needs a braking verb + a velocity/mass context.
  // In a multi-function LINE request, "stoppa" + a velocity is just one station
  // among many — do NOT strip the active actuators and collapse to a passive
  // shock absorber (the carton sort-line bug). handleOptions owns system scope.
  if (!isMultiFunctionSystem(t) &&
      (/stötdämp|shock.?absorb/i.test(t) ||
      (/\bstoppa\b|bromsa|deceler|fånga upp|kollision|anslag|krock/i.test(t)
       && /m\/s|km\/h|rörelseenergi|kinetisk|rörlig massa|\bvagn\b|tung massa/i.test(t)))) {
    slugs.delete("cylinder"); slugs.delete("electric-actuator");
    slugs.delete("linear-module"); slugs.delete("rotary-actuator");
    slugs.add("shock-absorber");
  }
  if (slugs.size === 0) slugs.add("cylinder");
  return Array.from(slugs);
}

/**
 * Parse the maximum operating temperature from a product's key_specs.
 * Handles formats: "5-60", "-10 to 80", "5…60°C", "T: -10...+80°C"
 * Returns 0 if unknown (no spec present).
 */
export interface TempSpann {
  /** Högsta godkända temperatur i °C. NaN när specen inte säger något. */
  max: number;
  /** Lägsta godkända temperatur i °C. NaN när specen inte säger något. */
  min: number;
  /**
   * Specen anger FLERA spann, ett per variant. Då finns ingen enda siffra att
   * påstå, och `max` bär det lägsta av dem -- det enda som är sant oavsett
   * vilken variant kunden får.
   */
  variantberoende: boolean;
  /** Rå text, så ett skäl kan citera den i stället för att sammanfatta den. */
  text: string;
}

const TOM_SPANN: TempSpann = { max: NaN, min: NaN, variantberoende: false, text: "" };

/**
 * Läser ett temperaturspann ur en produktspec.
 *
 * Skriven 2026-10-02 mot katalogens FAKTISKA strängar, inte mot påhittade
 * exempel. De vanligaste formerna är "-20–80 °C", "-10 to +80", "-20…+80" och
 * "5–60". Men dessa finns också, och de är poängen:
 *
 *   "-10…+70 (utan givare), -10…+60 (med givare)"
 *   "-20…+80 (utan givare), -10…+60 (med givare)"
 *   "-10…+60 (med magnet); -10…+70 utan magnet (RQ)"
 *
 * Den gamla tolken tog Math.max över alla tal i fältet och svarade 70 på den
 * första. Systemet lägger SJÄLV till ändlägesgivare i stycklistan -- och
 * verifierade alltså cylindern mot dess gräns UTAN givare. Tio graders falskt
 * godkännande på en rad som kunden läser som kontrollerad.
 *
 * Nu gäller det lägsta av de angivna spannen, och `variantberoende` säger att
 * siffran beror på utförandet. Den som vill påstå något får påstå det som är
 * sant för alla varianter.
 *
 * Teckenhanteringen är också fixad: "-40 – -10" gav tidigare 40, eftersom bara
 * \d+ plockades ut och minustecknen föll bort. En köldartikel såg ut att klara
 * fyrtio graders värme.
 */
export function tolkaTempSpann(specs: Record<string, unknown>): TempSpann {
  for (const key of ["temp_range", "temperature_range", "operating_temp", "temp_max", "temperature_max", "temp_rating", "ambient_temp"]) {
    const v = specs[key];
    if (v == null) continue;
    const text = String(v).trim();
    if (!text) continue;

    // Alla spann i strängen. Separatorn får vara …, –, —, "to", "bis", "till"
    // eller ett vanligt bindestreck; tecknet på talen läses med.
    const par = [...text.matchAll(
      /([+-]?\d+(?:[.,]\d+)?)\s*(?:\u2026|\.{2,}|\u2013|\u2014|\bto\b|\bbis\b|\btill\b|-)\s*([+-]?\d+(?:[.,]\d+)?)/gi,
    )].map(m => ({
      lag: parseFloat(m[1].replace(",", ".")),
      hog: parseFloat(m[2].replace(",", ".")),
    })).filter(x => Number.isFinite(x.lag) && Number.isFinite(x.hog) && x.hog >= x.lag);

    if (par.length > 0) {
      // Lägsta taket och högsta golvet: det som gäller oavsett variant.
      let max = Math.min(...par.map(x => x.hog));
      const min = Math.max(...par.map(x => x.lag));
      let variantberoende = par.length > 1;

      // Kvalificerare som är en ENSAM siffra och inte ett spann:
      //   "-10 to +70 (med givare +60)"
      // Den sänker taket, men bara när den bär ett eget tecken eller en
      // gradmarkering. Utan det kravet hade "(vikt 50 g)" i ett annat fält
      // dragit ned ett fullgott tak till 50.
      const konsumerat = new Set<number>();
      for (const m of text.matchAll(
        /([+-]?\d+(?:[.,]\d+)?)\s*(?:\u2026|\.{2,}|\u2013|\u2014|\bto\b|\bbis\b|\btill\b|-)\s*([+-]?\d+(?:[.,]\d+)?)/gi,
      )) {
        for (let i = m.index ?? 0; i < (m.index ?? 0) + m[0].length; i++) konsumerat.add(i);
      }
      for (const m of text.matchAll(/([+-]\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*°/g)) {
        if (konsumerat.has(m.index ?? 0)) continue;
        const n = parseFloat((m[1] ?? m[2]).replace(",", "."));
        if (!Number.isFinite(n) || n >= max || n < min) continue;
        max = n;
        variantberoende = true;
      }

      return { max, min, variantberoende, text };
    }

    // Ensam siffra. I en *_max-nyckel ÄR den taket. I "ambient_temp: 20" är den
    // lika gärna ett nominellt driftvärde, och att läsa den som en gräns gav
    // falska underkännanden ("katalogen anger max 20 °C").
    const ensam = text.match(/([+-]?\d+(?:[.,]\d+)?)/);
    if (ensam && /_max$/.test(key)) {
      const n = parseFloat(ensam[1].replace(",", "."));
      if (Number.isFinite(n)) return { max: n, min: NaN, variantberoende: false, text };
    }
  }
  return TOM_SPANN;
}

/**
 * Bakåtkompatibel form för RANKNING: ett tal, 0 när inget går att läsa.
 * Urvalet får vara tillåtande -- en produkt utan uppgift ska inte sorteras bort.
 * Verifieringen använder tolkaTempSpann direkt, eftersom den behöver veta
 * skillnaden mellan "okänt" och "beror på variant".
 */
export function parseProductTempMax(specs: Record<string, unknown>): number {
  const spann = tolkaTempSpann(specs);
  return Number.isFinite(spann.max) ? spann.max : 0; // 0 = okänt, blockera inte
}


/**
 * Extract the highest temperature requirement from description + answers.
 * Returns 0 if no temperature mentioned or below standard threshold (80°C).
 * We use 80°C as threshold because standard NBR seals are rated to ~80°C;
 * anything above warrants a spec check.
 */
/**
 * Ord som gör "grader" till en VINKEL i stället för en temperatur.
 *
 * Hittat 2026-10-02 av en adversariell granskning: "Vridbord som roterar 180
 * grader per cykel, rumstemperatur" lästes som ett krav på 180 °C. Felet låg i
 * koden sedan länge men var milt så länge värdet bara var en vink till
 * stycklistan. Sedan #313 driver det satteVerifiering och bedomLosning, och då
 * blir det ett fabricerat skäl som stoppar en beställning: "kravet är 180 °C"
 * till en kund som uttryckligen skrivit rumstemperatur.
 *
 * Vridning i 90/180/270 grader är det normala sättet att beskriva en
 * svängenhet, ett vridbord eller en indexering, så det här träffar en stor del
 * av det pneumatiska sortimentet.
 */
const VINKELORD =
  /vrid|rotat|roter|sväng|svang|vinkel|varv|delning|indexer|\brotate\b|\brotation\b|swivel|\bangle\b|\bturn\b|dreh|schwenk|winkel|giro|rotaci|ángulo|angulo/i;

export function extractRequiredMaxTemp(text: string, answers: Record<string, string>): number {
  const allText = utanIpProvvillkor(text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" "));
  const matches = [...allText.matchAll(/(\d{2,3})\s*°?\s*[cC]\b/gi)].map(m => parseInt(m[1]));

  // "90 grader" är temperatur i "90 grader varmt" och vinkel i "90 graders
  // vridning". Siffran avgör ingenting -- orden runt omkring gör det. Ett
  // missat temperaturkrav fångas nästan alltid av °C-mönstret ovan; ett
  // påhittat stoppar en affär OCH ljuger om varför. Därför tvekar vi hitåt.
  //
  // matchAll och inte match: det gamla uttrycket tog bara FÖRSTA träffen, så
  // "20 grader i lokalen, 400 grader i ugnen" tappade ugnen.
  for (const m of allText.matchAll(/(\d{2,3})\s*grad\w*/gi)) {
    const i = m.index ?? 0;
    const efter = allText.slice(i + m[0].length, i + m[0].length + 14);
    // "90 grader C" och "90 grader varmt" är temperatur även i en vridmaskin.
    const uttalatTemp = /^\s*(c\b|celsius|varm|värme)/i.test(efter);
    if (uttalatTemp) { matches.push(parseInt(m[1])); continue; }

    // En temperatur anges aldrig PER något. "180 grader per cykel", "90 grader
    // per takt", "60 grader per steg" är rörelse, inte värme.
    //
    // Den regeln behövdes utöver ordfönstret nedan, och saknades i första
    // versionen av den här fixen: index.ts slår ihop beskrivningen med ALLA
    // svarsvärden till en sträng, och mitt i den hamnade "Horisontellt 180
    // grader per cykel Vanlig verkstad" -- fyrtio tecken utan ett enda
    // vridord, trots att frågan hette "rotation". Fönstret räcker alltså inte
    // när texten är hopfogad ur fält. Hittat genom att köra ett vridbord mot
    // den driftsatta tjänsten och se "kravet är 180 °C" komma tillbaka.
    if (/^\s*per\b/i.test(efter)) continue;

    if (VINKELORD.test(allText.slice(Math.max(0, i - 40), i + m[0].length + 40))) {
      continue;
    }
    matches.push(parseInt(m[1]));
  }

  const relevant = matches.filter(t => t > 80 && t < 1200);
  return relevant.length > 0 ? Math.max(...relevant) : 0;
}

/**
 * Lägsta temperatur kunden angett, i °C. NaN när ingen minusgrad nämns.
 *
 * Fanns inte alls före 2026-10-02: needsLowTemp kunde säga att miljön är kall,
 * men inget jämförde den mot en artikels undre gräns. "Frysrum, -30 °C" gav
 * därför kravTempC = 0, hela temperaturblocket hoppades över, och varje rad
 * märktes "verifierad" -- trots att standardtätningar hårdnar och
 * polyamidslang blir spröd långt innan dess.
 *
 * Bara uttalade minusgrader räknas. Att gissa "frysrum betyder -25" vore att
 * uppfinna ett krav, vilket är exakt det den här funktionen finns för att
 * förhindra.
 */
export function extractRequiredMinTemp(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  const tal: number[] = [];

  // "-30 °C", "−30 grader", "- 30 C"
  for (const m of allText.matchAll(/[-\u2212]\s*(\d{1,2})\s*(?:°\s*[cC]\b|grad\w*|\bC\b)/gi)) {
    tal.push(-parseInt(m[1]));
  }
  // "minus 30 grader", "minus 30 °C"
  for (const m of allText.matchAll(/\bminus\s*(\d{1,2})\s*(?:°?\s*[cC]\b|grad\w*)?/gi)) {
    tal.push(-parseInt(m[1]));
  }

  return tal.length > 0 ? Math.min(...tal) : NaN;
}

export function strokeLabel(specs: Record<string, unknown>): string {
  for (const key of ["stroke_mm", "stroke_max", "max_stroke_mm", "max_stroke"]) {
    const v = specs[key]; if (v != null) return `${v} mm`;
  }
  if (specs["stroke_range"]) return String(specs["stroke_range"]);
  return "?";
}

export function extractMinStroke(answers: Record<string, string>, description: string): number {
  for (const [k, v] of Object.entries(answers)) {
    if (/stroke|slag|sträcka|avstånd|rörelse|längd|travel|distance/i.test(k)) {
      const digits = v.replace(/[^0-9.]/g, "");
      const n = parseFloat(digits);
      if (!isNaN(n) && n >= 5 && n <= 15000) return n;
    }
  }
  const allText = Object.values(answers).join(" ") + " " + description;
  let maxFound = 0;
  // Match "NNN mm" but NOT "NNN mm/s" (speed), "NNN mm²" (area), "NNN mm³" (volume)
  for (const m of allText.matchAll(/(\d{2,5})\s*mm(?![\s]*(\/|per|²|³|s\b))/gi)) {
    const v = parseInt(m[1]);
    if (v >= 50 && v <= 10000 && v > maxFound) maxFound = v;
  }
  // "2 meter i sidled", "flytta 1,5 m": slaglängd i meter, men bara intill ett
  // rörelseord -- "1 m/s" är en fart och "10 m slang" ingen rörelse.
  const iMeter = slagIMeterMm(allText);
  if (iMeter > maxFound) maxFound = iMeter;
  if (maxFound > 0) return maxFound;
  const rangeMatch = allText.match(/(\d+)[–—\-](\d+)\s*mm/);
  if (rangeMatch) return parseInt(rangeMatch[2]);
  if (/> 500|mer.{0,5}500/i.test(allText)) return 500;
  if (/300.{0,5}500/i.test(allText)) return 300;
  if (/150.{0,5}300/i.test(allText)) return 150;
  if (/50.{0,5}150/i.test(allText)) return 50;
  return 0;
}

const RORELSEORD = "(?:slag\\w*|lyfthöjd|lyft\\w*|höj\\w*|sänk\\w*|flytt\\w*|förflytt\\w*|skjut\\w*|rörelse\\w*|vandring|travel|stroke|sträcka|sidled|längs)";
const METER = "(\\d+(?:[.,]\\d+)?)\\s*(?:m|meter|metre|meters)\\b(?!\\s*[\\/²³])";
const METER_EFTER_ORD = `${RORELSEORD}[^.\\d]{0,25}${METER}`;
const METER_FORE_ORD = `${METER}[^.\\d]{0,20}(?:i\\s+sidled|sidled|uppåt|nedåt|upp\\b|ned\\b|ner\\b|lyft\\w*|slag\\w*|rörelse|förflyttning|framåt|bakåt|längs)`;

/**
 * Slaglängd angiven i meter i en rörelse, i mm. 0 när ingen finns.
 * Hittat 2026-10-11 (Geminis testfall): "flytta … 2 meter i sidled" lästes
 * inte, eftersom bara "mm" räknades -- slaglängden frågades igen och motorn
 * kunde inte räkna på rörelsen.
 */
export function slagIMeterMm(text: string): number {
  let max = 0;
  for (const m of text.matchAll(new RegExp(METER_EFTER_ORD, "gi"))) max = Math.max(max, parseFloat(m[1].replace(",", ".")) * 1000);
  for (const m of text.matchAll(new RegExp(METER_FORE_ORD, "gi"))) max = Math.max(max, parseFloat(m[1].replace(",", ".")) * 1000);
  return max >= 50 && max <= 20000 ? Math.round(max) : 0;
}

export function extractPerAxisStrokes(answers: Record<string, string>): { axis: string; stroke: number }[] {
  const result: { axis: string; stroke: number }[] = [];
  for (const [k, v] of Object.entries(answers)) {
    if (/stroke|slag|sträcka|avstånd|rörelse|längd|travel|distance/i.test(k)) {
      const digits = v.replace(/[^0-9.]/g, "");
      const n = parseFloat(digits);
      if (!isNaN(n) && n >= 5 && n <= 15000) {
        // Match x/y/z anywhere in the key name (e.g. "x_stroke", "stroke_z", "x")
        const axisMatch = k.match(/([xyz])/i);
        result.push({ axis: axisMatch ? axisMatch[1].toUpperCase() : "?", stroke: n });
      }
    }
  }
  return result;
}

export function needsMultiAxis(text: string): boolean {
  // Axis patterns must be WORD-BOUNDED axis tokens (x-axel / XYZ / X-Z), NOT bare
  // letters: the old `x.*y|y.*x|x.*z|z.*x` matched any x/y/z across the whole string,
  // so "Cylinder … exakt" (y…x) was falsely flagged multi-axis — which disabled the
  // precision hard-filter and triggered per-axis BOM logic on single-axis jobs.
  if (/\b[xyz][-_\s]?ax(el|is|e)|\bxyz\b|\b[xyz]\s*[\/-]\s*[xyz]\b|två axl|två rörel|horisontell.*vertikal|vertikal.*horisontell|pick.and.place|pick.*place|plocka.*placera|plocka.*flytta|plocka.{0,80}\b(ställ|lägg|sätt)(a|er)\b|lyfter.*flytta|flytta.*lyft|2-axl|2 axl|multi.*axl|cartesian|portalsystem|lyfter.*flyttar|lyfter.*och.*flyttar/i.test(text)) return true;

  // Adversarial test finding 2026-08-16: "en enda cylinder som SAMTIDIGT lyfter,
  // roterar och griper" fell through every pattern above (none of them anticipate
  // lift+rotate+grip specifically) and landed in isPureRotary — a narrow,
  // non-LLM path that only picks by torque and stayed silent about the missing
  // lift/grip functions entirely. No catalog part does lift+rotate+grip; the
  // honest answer is "separate axis per motion," same as pick-and-place already
  // gets above. Gated on explicit simultaneity language (not just "lift" and
  // "grip" co-occurring) — a plain "gripper that lifts a box" is one ordinary
  // gripper request, not a multi-axis one, and must NOT trip this.
  const isSimultaneous = /\bsamtidigt\b|\bsamma\s+gång\b|\bi\s+en\s+rörelse\b|\ben\s+enda\b.{0,20}\bsom\b|\bsimultaneous(ly)?\b|\bat\s+the\s+same\s+time\b|\bin\s+one\s+motion\b/i.test(text);
  if (isSimultaneous) {
    let motionTypes = 0;
    if (/\blyft(er|a)?\b|\bhissa\b|\blift(s|ing)?\b/i.test(text)) motionTypes++;
    if (/roter|rotat|\bvrid|\bsväng|rotary|\brotate|\brotation\b/i.test(text)) motionTypes++;
    if (/gripdon|gripare|\bgripper\b|klämback|gripa\s|griper\s|\bgrip\b|\bclamp(ing)?\b/i.test(text)) motionTypes++;
    if (motionTypes >= 2) return true;
  }
  return false;
}

export function needsVacuumGrip(text: string): boolean {
  return /kretskort|pcb|elektronik|glas|optik|repas|inte.*repa|skada.*grepp|känslig.*yta|vacuum.grip|sugkopp|suction.cup/i.test(text);
}

export function needsValveTerminal(text: string): boolean {
  return (
    needsMultiAxis(text) ||
    /ventilterminal|valve.terminal|vtug|vtsa|mpa\b|cpv\b|ventilblock|manifold|ventilramp/i.test(text) ||
    /tre.*cylindr|fyra.*cylindr|3\s*cylindr|4\s*cylindr|3\s*cyl|4\s*cyl|several.*actuat|multiple.*actuat|multiple.*cyl|två.*cylindr|två cyl/i.test(text)
  );
}

/**
 * Detects ATEX / explosive-atmosphere requirements (Zone 1 or Zone 2).
 * In these zones ALL standard electrical components (motors, servo axes, 24V sensors)
 * are strictly forbidden unless explicitly ATEX/NAMUR-certified.
 */
export function needsAtex(text: string): boolean {
  return /\batex\b|\bex[.\s-]?zon[e]?\b|\bexplosionsskyddad\b|\bexplosionsfarlig\b|\bflammable[.\s]?gas\b|\bbrännbar[.\s]?gas\b|\bnamur\b|\bzone\s?[12]\b|\bzon\s?[12]\b|\bii\s?[23]\s?[gd]\b|\bii[abc]\b|\bex\s?klass\b|\bex[.\s]?klassad\b|\bexplosionsgeschützt\w*\b|\bexplosionsgefähr\w*\b|\bentzündlich\w*\s?gas\b|\batmósfera\s?explosiva\b|\bzona\s?explosiva\b|\bgas\s?inflamable\b|\bprueba\s?de\s?explosión\b|\bantideflagrante\b/i.test(text);
}

/** Vertical / suspended load: cylinder holds weight against gravity.
 *  On air-pressure loss the load WILL fall unless a lock valve is fitted. */
/**
 * Uttryckligt HORISONTELLT val slår alltid vertikaldetektering.
 *
 * Rapporterat: en kund beskrev ett kartongstopp på ett transportband och valde
 * "Horisontell orientering" i wizarden. Stycklistan motiverade ändå
 * backslagsventilen med "OBLIGATORISK vid pneumatisk vertikal last".
 *
 * Detektorerna är rena textmönster utan negationshantering: de letar efter ord
 * som antyder vertikalitet men vet ingenting om ett svar som säger motsatsen.
 * Ett uttryckligt användarval är starkare bevis än ett ord någonstans i
 * prosan, så det får vinna.
 */
export function sagerHorisontell(text: string): boolean {
  return /\bhorisontell?\b|\bhorisontal\b|\bhorizontal\b|\bliggande\b|\bi\s?plan(et)?\b|\bwaagerecht\b|\bhorizontale?\b/i.test(text);
}

export function needsVerticalLoad(textMedOrientering: string): boolean {
  if (sagerHorisontell(textMedOrientering)) return false;
  // Ord som ser vertikala ut men beskriver något annat (granskningen
  // 2026-10-14): "med ovansidan uppåt" är hur detaljen ligger, och
  // "lyftöglor" är fästpunkter. Sedan lyftet blev en blockerande rad för ett
  // griporgan stoppade de beställningen.
  const text = textMedOrientering.replace(
    /\b(?:ovan|under|fram|bak)?sidan\s+(?:uppåt|nedåt)\b|\b(?:etiketten|locket|öppningen|texten|märkningen)\s+(?:uppåt|nedåt)\b|\blyft(?:ögl|ör|handtag)\w*/gi,
    " ",
  );
  return /\blyft|\bhissa\b|\bhäng.*last\b|\blast.*häng\b|\bvertikal|\bcylinder.*vertikal\b|\bz[.-]?axel\b|\bz[.-]?axis\b|\bpress.*ner\b|\bpress.*ned\b|\bnedåt\b|\buppåt\b|\bvertical.*load\b|\bhanging.*load\b|\bsuspended.*load\b|\blifting.*cyl\b|\bcylinder.*lyft\b|\bz[.-]?achse\b|\bheben\b|\bhebt\b|\bhängende\s?last\b|\bnach\s?unten\b|\bnach\s?oben\b|\belevar\b|\blevantar\b|\bcarga\s?suspendida\b|\bcarga\s?colgante\b|\beje\s?z\b|\bhacia\s?abajo\b|\bhacia\s?arriba\b/i.test(text);
}

/**
 * Kunden har redan lyftet: "befintlig lyftanordning med fallskydd", "på en
 * Z-axel som redan har stångbroms". Då ingår lyftet inte i ett griporgans
 * lösning, men det är inte heller en lucka som stoppar beställningen
 * (granskningen 2026-10-14).
 */
export function harBefintligtLyft(text: string): boolean {
  return /\b(?:befintlig\w*|existerande|redan\s+(?:har|finns|monterad\w*|installerad\w*)|finns\s+redan|existing|already\s+(?:has|have|fitted|installed))\b[^.]{0,60}?(?:\blyft\w*|\bz[.-]?ax\w*|\bhiss\w*|\blift\w*|\bhoist\w*)/i.test(text)
    || /(?:\blyft\w*|\bz[.-]?ax\w*|\bhiss\w*|\blift\w*|\bhoist\w*)[^.]{0,40}?\b(?:som\s+redan|redan\s+har|that\s+already|already\s+has)\b/i.test(text);
}

/**
 * En IP-kods provvillkor inom parentes: "IP69K (högtryckstvätt/kemikalier,
 * 100 bar, 80°C)". Det beskriver hur kapslingen provas, inte miljön maskinen
 * står i.
 *
 * Hittat 2026-10-02 (granskning, livsmedelsfall med daglig skumtvätt):
 * maskinbyggarens svarsalternativ för IP69K bär den texten, svaret fogas in i
 * kravtexten, och "80°C" gjorde needsHighTemp sann. Alla tre alternativ fick
 * nackdelen "applikationen kräver >80 °C" -- ett krav kunden aldrig ställt.
 */
export function utanIpProvvillkor(text: string): string {
  return text.replace(/\bIP\s?\d{2}K?\s*\([^)]*\)/gi, (m) => m.replace(/\(.*\)/, ""));
}

/**
 * High temperature environment (>80°C). Standard NBR seals fail — need PTFE/FKM/HT variants.
 *
 * Strikt ÖVER 80 °C, samma gräns som extractRequiredMaxTemp: standardtätningar
 * klarar +80 °C, så "80 °C" är inget högtemperaturkrav. Mönstret tog förut
 * med 80 genom [89]\d.
 */
export function needsHighTemp(textMedProv: string): boolean {
  const text = utanIpProvvillkor(textMedProv);
  return /\bugn\b|\bfornace\b|\bautoklav\b|\bsteam\b|(?<![\wåäöÅÄÖ])ånga(?![\wåäöÅÄÖ])|\bvulk\b|\bsintr\b|\bsmält\b|\bhög.*temp\b|\bhigh.*temp\b|\bvarm.*milj\b|\bhet.*milj\b|\b(?:8[1-9]|9\d)\s*°?\s*[cC]\b|\b1[0-9]\d\s*°?\s*[cC]\b|\b200\s*°?\s*[cC]\b|\bhögtemperatur\b|\bheat.*treat\b|\bvärmebehandl\b|\bofen\b|\bautoklav\w*\b|\bdampf\b|\bhohe\s?temperatur\b|\bheiße\s?umgebung\b|\bwärmebehandl\w*\b|\bgeschmolzen\b|\bhorno\b|\bvapor\b|\balta\s?temperatura\b|\bambiente\s?caliente\b|\btratamiento\s?térmico\b|\bfundido\b/i.test(text);
}

/** Low temperature environment (<-10°C). Standard seals crack/harden — need LT/FKM variants. */
export function needsLowTemp(text: string): boolean {
  return /\bfrys\b|\bfrysrum\b|\bkylanläggn\b|\bcold.*room\b|\bcold.*stor\b|\bkylrum\b|\bcryogen\b|\bdjupfrys\b|\bfryscell\b|\bkyla.*milj\b|(?<![\w-])[-\u2212]\s*[1-9]\d\s*°?\s*[cC]\b|\bbelow.*freez\b|\bsubzero\b|\bfrost.*milj\b|\bgefrier\w*\b|\btiefkühl\w*\b|\bkühlraum\b|\bkälteanlage\b|\bkryogen\w*\b|\bcongelador\b|\bcámara\s?frigorífica\b|\bsala\s?fría\b|\bcriogénic\w*\b/i.test(text);
}

/** Hydraulic application — entirely different product family (100–350 bar oil). NOT in pneumatic catalog. */
export function isHydraulicApplication(text: string): boolean {
  return /\bhydraulisk\b|\bhydraulic\b|\bhydraul\b|\bolje.*cylinder\b|\bcylinder.*olja\b|\bolje.*tryck\b|\bhydro.*cyl\b|\bhydro.*press\b|\bhydraulisch\w*\b|(?<![\wöäüÖÄÜß])ölzylinder(?![\wöäüÖÄÜß])|(?<![\wöäüÖÄÜß])öldruck(?![\wöäüÖÄÜß])|\bhidráulic\w*\b|\bcilindro\s?hidráulico\b|\bpresión\s?de\s?aceite\b/i.test(text);
}

/** Force requirement that likely exceeds pneumatic capability (>8 000 N at reasonable bore/pressure). */
export function needsVeryHighForce(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  const knMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*kN/i);
  if (knMatch) return parseFloat(knMatch[1].replace(",", ".")) >= 8;
  const nMatch = allText.match(/(\d{5,})\s*[nN]\b/);
  if (nMatch) return parseInt(nMatch[1]) >= 8000;
  return false;
}

/** Oxygen-enriched atmosphere (>25% O2). Standard oil-lubricated pneumatics → fire/explosion risk. */
export function needsOxygenClean(text: string): boolean {
  return /\bsyrgas\b|\boxygen[.\s-]?enrich\b|\boxygen[.\s-]?clean\b|\bo2[.\s-]?ren\b|\bhög.*syrgashal\b|\boxygen.*atmosf\b|\bmedical.*oxygen\b|\boxidations.*milj\b|\breact.*oxygen\b|\boi?l[.\s-]?free.*oxygen\b|\bsauerstoff\w*\b|\bmedizinisch\w*\s?sauerstoff\b|\boxígeno\b|\benriquecid\w*\s?con\s?oxígeno\b|\boxígeno\s?médico\b/i.test(text);
}

/**
 * ESD-safe / antistatic material requested (electronics/PCB handling). Found
 * 2026-08-28 (adversarial test): an explicit "ESD-säkert material krävs"
 * requirement was silently ignored end-to-end for vacuum/gripper end-effector
 * selection — no catalog product has any ESD/antistatic/conductive spec field
 * at all (checked product_specs directly), so there's no way to filter for it,
 * but the response said nothing about that gap either, unlike the analogous
 * washdown-IP69K gap disclaimer that already exists elsewhere.
 */
export function needsEsdSafe(text: string): boolean {
  return /\besd[.\s-]?säker\w*\b|\besd[.\s-]?safe\b|\bantistatisk\w*\b|\bantistatic\b|\bledande\s+material\b|\bconductive\s+material\b|\besd[.\s-]?schutz\w*\b|\bantistatisch\w*\b|\bleitfähig\w*\s+material\w*\b|\bantiestátic\w*\b|\bmaterial\s+conductor\b|\bprotección\s+esd\b/i.test(text);
}

/** High cycle frequency (>60 cycles/min) — thermal and lubrication issues with standard cylinders. */
export function needsHighCycle(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  return /\b[6-9]\d\s*(?:cyk|slag|cykel|cyc|stroke|takt).*(?:min|s)\b|\b1[0-9]\d\s*(?:cyk|slag|cykel|cyc|stroke|takt)\b|\bhög.*frekvens\b|\bhigh.*freq\b|\bhigh.*cycle\b|\bsnabb.*takt\b|\brapid.*cycling\b|\bfastcycl\b|\bhohe\s?frequenz\b|\bschneller?\s?takt\b|\balta\s?frecuencia\b|\bciclo\s?rápido\b/i.test(allText);
}

/** High speed > 1 m/s without deceleration control — end-stop impact damage. */
export function needsHighSpeed(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  // \b[1-9]\d{3,}\s*mm\/s\b catches "1200mm/s", "2000 mm/s" etc (≥1000 mm/s = >1 m/s)
  return /\b[1-9](?:[.,]\d+)?\s*m\/s\b|\b[1-9]\d{3,}\s*mm\/s\b|\bsnabb.*rörelse\b|\bhigh.*speed\b|\bhög.*hastighet\b|\bfast.*actuat\b|\bsnabb.*stans\b|\bslaghastighet.*[1-9]\b|\bschnelle\s?bewegung\b|\bhohe\s?geschwindigkeit\b|\bmovimiento\s?rápido\b|\balta\s?velocidad\b/i.test(allText);
}

/** SIL/functional safety required — safety relay, guard interlock, emergency stop function. */
export function needsSilSafety(text: string): boolean {
  return /\bsil\s*[1-4]\b|\bsäkerhetsfunktion\b|\bsafety.*function\b|\bnödstopp\b|\bemergency.*stop\b|\bguard.*interlock\b|\bskyddsgrind\b|\bplt\b|\biso\s*13849\b|\biec\s*62061\b|\bperformance.*level\b|\bplr\b|\bple\b|\bpld\b|\bsafety.*relay\b|\bsäkerhetsrelä\b|\bPNOZ\b|\bfail.*safe\b|\bsicherheitsfunktion\b|\bnot.?halt\b|\bnotaus\b|\bschutztür\b|\bschutzgitter\b|\bschutzzaun\b|\bsicherheitsrelais\b|\bsicher\s?abgeschaltet\b|\bfunción\s?de\s?seguridad\b|\bparada\s?de\s?emergencia\b|\bpuerta\s?de\s?seguridad\b|\breja\s?de\s?seguridad\b|\brelé\s?de\s?seguridad\b|\bseguro\s?contra\s?fallos\b/i.test(text);
}

/** Outdoor / marine / harsh UV + weather environment. */
export function needsOutdoor(text: string): boolean {
  return /\butomhus\b|\boutdoor\b|\bexterior.*install\b|\bsalt.*milj\b|\bmarin\b|\bmarine\b|\boffshore\b|\bsalt.*spray\b|\bsalt.*dimma\b|\bväder.*skydd\b|\buv.*exponering\b|\bregn.*milj\b|\bkorrosiv.*milj\b|\bim\s?freien\b|\baußenbereich\b|\bmaritim\w*\b|\bsalzsprühnebel\b|\bwetterfest\w*\b|\bexterior\b|\bal\s?aire\s?libre\b|\bambiente\s?marino\b|\bmarítim\w*\b|\bniebla\s?salina\b|\bintemperie\b/i.test(text);
}

/** Pharmaceutical / GMP / FDA — validated materials, no dead-spaces, 316L, PTFE. */
export function needsPharmaGmp(text: string): boolean {
  return /\bgmp\b|\bfda\b|\b21\s*cfr\b|\bläkemedel\b|\bpharma\b|\bpharmaceut\b|\bsterilit\b|\bsteril.*milj\b|\bvalidat\b|\biso\s*14159\b|\behedg\b|\bbioprocess\b|\bapi\b.*\bprodukt\b|\bcip\b|\bsip\b|\barzneimittel\b|\bfarmazeutisch\w*\b|\bfarmacéutic\w*\b|\bmedicamento\b|\bestéril\w*\b|\bvalidación\b/i.test(text);
}

/** Brands the site carries, matched against a customer's explicit request
 *  (e.g. "jag vill ha exempel för festo och smc") so rankActuators() can
 *  prefer them — see scoring.ts ScoringCtx.preferredBrands. Returns
 *  lowercased brand names exactly as stored in the brands table. */
export function detectRequestedBrands(text: string): string[] {
  const found = new Set<string>();
  if (/\bfesto\b/i.test(text)) found.add("festo");
  if (/\bsmc\b/i.test(text)) found.add("smc");
  if (/\bparker\b/i.test(text)) found.add("parker");
  if (/\bbosch\b|\brexroth\b/i.test(text)) found.add("bosch rexroth");
  if (/\bnorgren\b/i.test(text)) found.add("norgren");
  if (/\bmetal\s*work\b/i.test(text)) found.add("metal work");
  if (/\bcamozzi\b/i.test(text)) found.add("camozzi");
  return [...found];
}

/** ATEX Dust (Zone 20/21/22) — combustible dust explosion. Different from gas zones (different group/category). */
export function needsAtexDust(text: string): boolean {
  return /\bzon\s*2[012]\b|\bzone\s*2[012]\b|\bdamm.*explosion\b|\bexplosivt.*damm\b|\bcombustible.*dust\b|\bbrännbart.*damm\b|\bsädes\b.*\bexplos\b|\bmjöl.*explos\b|\bträ.*damm.*explos\b|\bcoal.*dust\b|\bkol.*damm\b|\bii[i]?\s*[23][d]\b|\bdust.*atex\b|\batex.*dust\b|\bstaub.*explosion\b|\bexplosionsfähig\w*\s?staub\b|\bbrennbar\w*\s?staub\b|\bmehlstaub\b|\bholzstaub\b|\bkohlestaub\b|\bexplosión\s?de\s?polvo\b|\bpolvo\s?combustible\b|\bpolvo\s?de\s?harina\b|\bpolvo\s?de\s?madera\b|\bpolvo\s?de\s?carbón\b/i.test(text);
}

/**
 * Battery manufacturing / Dryroom environment.
 * Prohibits copper (Cu), zinc (Zn) and nickel (Ni) in any wetted or moving part.
 * Standard ball screws, zinc-coated guides and most greases are FORBIDDEN.
 * Dew point typically -40 to -60 °C — particle generation is a critical risk.
 */
export function needsBatteryDryroom(text: string): boolean {
  return /\bdryroom\b|\bdry\s*room\b|\btorrkammare\b|\blitiumjon\b|\blithium[-\s]?ion\b|\bli[-\s]?ion\b|\bbatterifabrik\b|\bbattery\s*(?:manufactur|produc|cell|fabrik)\b|\bbatteriproduk\b|\bbattericell\b|\bkatod(?:material)?\w*\b|\banod(?:material)?\w*\b|\belektrod(?:material)?\w*\b|\belectrode\b|\bpouch\s*cell\b|\blitiumbatteri\b|\bcell\s*monter\b|\bcu\/zn\/ni\b|\bkoppar.*zink.*nickel\b|\btrockenraum\b|\blithium[-\s]?ionen\b|\bbatteriefertigung\b|\bbatterieproduktion\b|\bsala\s?seca\b|\blitio[-\s]?ion\b|\bproducción\s?de\s?baterías\b|\bcátodo\w*\b|(?<![\wáéíóúñÁÉÍÓÚÑ])ánodo\w*|\belectrodo\w*\b/i.test(text);
}

/**
 * Aktuatorns hastighet i m/s ur text och svar.
 *
 * Fram till 2026-10-13 var det den FÖRSTA hastigheten i texten, oavsett vad
 * den gällde. "Bandet går med 0,25 m/s" blev därför utskjutarens hastighet i
 * lådsorteringstestet, och rörelseenergin och dämpningsråden räknades på
 * bandet. Nu hoppas en hastighet över som meningen knyter till
 * transportbandet eller mottagningen (hastighetensObjekt i kravbild.ts). Står
 * den vid ett produktord avgör resten av meningen: "Skjuta paket 5 kg med
 * 0,8 m/s" är aktuatorns (den tappades en kort tid efter Fas A). Utan föremål
 * gäller den aktuatorn som förut, men kravbilden visar den då som en osäker
 * tolkning, och användarens beslut (tolkning) avgör.
 */
export function extractSpeedMs(text: string, answers: Record<string, string>, tolkning: Tolkningsbeslut = {}): number {
  const svarText = Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  const all = text + " " + svarText;
  for (const m of all.matchAll(/(\d+(?:[.,]\d+)?)\s*(mm\/s|m\/s)/gi)) {
    const n = parseFloat(m[1].replace(",", "."));
    const varde = m[2].toLowerCase() === "mm/s" ? n / 1000 : n;
    const beslut = tolkning[`tolkning-${hastighetsKravId(varde)}`];
    if (beslut) {
      if (beslut === "aktuator") return varde;
      continue;
    }
    const iText = (m.index ?? 0) < text.length;
    if (iText && hastighetensObjekt(text, m.index ?? 0) !== "aktuator") continue;
    return varde;
  }
  return 0;
}

/**
 * Extract precision requirement (mm) from free text + answers.
 * Handles: "±0.02 mm", "0.1mm precision", "repeterbarhet ±0.003mm", "20µm", "50 mikrometer"
 * Returns 0 if not found (unknown → do not apply precision filter).
 */
export function extractPrecisionMm(text: string, answers: Record<string, string>): number {
  const all = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  // µm / mikrometer → convert to mm
  const umMatch = all.match(/(\d+(?:[.,]\d+)?)\s*(?:µm|um|mikrometer|micrometer)/i);
  if (umMatch) return parseFloat(umMatch[1].replace(",", ".")) / 1000;
  // "±0.02 mm", "0.02mm", "0,02 mm" — look for small decimal numbers near precision keywords
  const precMatch = all.match(/(?:precision|accuracy|repeatability|noggrannhet|repeterbarhet|genomen|toleran)[^\d]{0,10}[±+\-]?\s*(\d+(?:[.,]\d+)?)\s*mm/i)
    || all.match(/[±]\s*(\d+(?:[.,]\d+)?)\s*mm/i)
    || all.match(/(\d+(?:[.,]\d+)?)\s*mm\s*(?:precision|accuracy|repeatability|noggrannhet|repeterbarhet)/i);
  if (precMatch) return parseFloat(precMatch[1].replace(",", "."));
  // A bare sub-0.5 mm value ("0,05 mm", "0.02mm") is virtually always a tolerance /
  // repeatability spec, never a stroke — catch it even without ± or a keyword nearby.
  const subMm = all.match(/(?<![\d.,])(0[.,]\d+)\s*mm\b/i);
  if (subMm) {
    const v = parseFloat(subMm[1].replace(",", "."));
    if (v > 0 && v < 0.5) return v;
  }
  return 0;
}

/**
 * Drive-based pneumatic detector — does NOT trust the category. Some pneumatic
 * slides (Metal Work MW-S, SMC) are miscategorized as "linear-module" (an
 * electric category) yet run on compressed air (operating_pressure in bar) and
 * cannot achieve servo precision. We detect the real drive: a product with an
 * operating_pressure spec and no electric signal (voltage / repeatability_mm)
 * is pneumatic regardless of how it is categorized.
 */
export function isPneumaticByDrive(p: CatalogProduct): boolean {
  const ks = p.key_specs ?? {};
  const hasAirPressure = ks["operating_pressure"] != null;
  const hasElectricSignal = ks["voltage"] != null || ks["repeatability_mm"] != null;
  return hasAirPressure && !hasElectricSignal;
}

/** Mechanical rod lock / holding brake demanded: the load must NOT drop on air
 *  AND power loss (e-stop with corrosive media, etc.). A pilot check valve holds
 *  pressure but not a broken hose — a spring-applied rod lock is the fail-safe. */
export function needsRodLock(text: string): boolean {
  // "extern låsning" saknades och det kostade oss en felaktig lösning.
  //
  // En kund beskrev en vertikal press med EXTERN LÅSNING. Mönstret kände igen
  // "stångbroms" och "mekaniskt lås" men inte den formuleringen, så flaggan
  // sattes aldrig -- stångbromsen lades inte till, och backslagsventilen stod
  // kvar ensam som om kravet var uppfyllt. Den håller trycket, inte lasten.
  //
  // ÄNDLÄGESLÅSNING är medvetet INTE med här. Det är en cylinderoption för att
  // låsa i ändläge, inte en säkerhetsbroms, och att blanda ihop dem skulle ge
  // falska träffar på varenda DSBC-konfiguration.
  return /stångbroms|stång.?lås|rod.?lock|mekaniskt?\s+lås|fallskydd|spring.?applied|hållbroms|broms.*(strömavbrott|nödstopp|luftbortfall)|inte\s+fall(a|er)\s+(ner|ned)|får\s+inte\s+falla|extern[at]?\s+låsning|lastsäkring|lasthållning|håll[a]?\s+lasten|lås[a]?\s+(lasten|kolvstången|cylindern)|kolbenstangenbremse|mechanische\s?verriegelung|mechanisches\s?schloss|absturzsicherung|darf\s?nicht\s?fallen|externe[rnms]?\s?verriegelung|lastsicherung|freno\s?de\s?vástago|bloqueo\s?mecánico|bloqueo\s?extern[oa]|no\s?debe\s?caer|no\s?puede\s?caer|external\s+lock(ing)?|load\s+holding/i.test(text);
}

/**
 * Detects washdown / food-grade / wet-environment requirements.
 * These applications require IP67/IP69K and stainless or food-grade plastic —
 * standard aluminum cylinders will corrode immediately.
 */
export function needsWashdown(text: string): boolean {
  if (needsSpolmiljo(text)) return true;
  return /washdown|wash[-\s]down|livsmedel|food[-\s]grade|food[-\s]safe|mejeri|dairy|slakteri|slakter|livsmedelsgodkänd|livsmedelsgodkand|ip[-\s]?69|högtrycksspolning|högtryck.*spol|spol.*kemik|kemisk.*reng|cip\b|sip\b|hygienic|hygienisk|clean[-\s]design|cleandesign|rostfri|stainless|korrosionsskyddad|vätsk.*milj|blot.*milj|kemikalie|frätande|korrosiv|korrosion|\bsyra\b|syrabeständig|aggressiva?\s+(medier|vätskor|kemikalier)|lebensmittel\w*|molkerei|schlachthof|edelstahl|rostfrei\w*|hochdruckreinig\w*|chemikalie\w*|ätzend\w*|\bsäure\b|säurebeständig\w*|\balimentos?\b|grado\s?alimentici\w*|lácte\w*|matadero|acero\s?inoxidable|limpieza\s?a\s?alta\s?presión|químic\w*|corrosiv\w*|(?<![\wáéíóúñÁÉÍÓÚÑ])ácido(?![\wáéíóúñÁÉÍÓÚÑ])/i.test(text);
}

/**
 * Spolning eller tvätt (högtryck, CIP, skumtvätt) och i sig våta miljöer
 * (slakteri, mejeri). needsWashdown är bredare -- där räknas också rostfritt,
 * korrosion och kemikalier, som kräver korrosionsbeständigt material men inte
 * IP69K. Hittat 2026-10-08: en doseringslinje med "frätande vätskor" fick
 * stycklisteraden "KRAV IP69K".
 */
export function needsSpolmiljo(text: string): boolean {
  return /washdown|wash[-\s]?down|högtryck\w*|spola[rs]?\b|spolning|spolas|tvätta[rs]?\b|tvättas|\btvätt(en|ning)?\b|rengörs|skumtvätt|\bcip\b|\bsip\b|ip\s?69|slakteri|mejeri|dairy|chark/i.test(text);
}

/**
 * Säkerhetsnivån kunden faktiskt angett ("PL d", "PLe", "SIL 2"), annars null.
 * "PLC" är ingen nivå: PL c räknas bara med mellanslag. Hittat 2026-10-08:
 * ordet "nödstopp" gav stycklisteraden "KRAV SIL 2 / PLd" -- en nivå ingen
 * angett. Nivån bestäms i maskinens riskbedömning.
 */
export function angivenSakerhetsniva(text: string): string | null {
  const pl = /\bPL\s?([de])\b|\bPL\s([a-c])\b/i.exec(text);
  if (pl) return `PL ${(pl[1] ?? pl[2]).toLowerCase()}`;
  const sil = /\bSIL\s?([1-4])\b/i.exec(text);
  if (sil) return `SIL ${sil[1]}`;
  return null;
}

/** Returns true if the user requested end-position / stroke-end detection (sensors). */
export function needsEndPositionDetection(text: string): boolean {
  if (/detekt|givare|sensor|ändläge|end.pos|end.stop|stroke.end|reed|proximity|närhets|position.*detect|detect.*position|elektron.*detekt|signalera|signal.*läge|läges.*signal|kontrollera.*läge|läge.*kontroll|home.*detect|detect.*home|smcm|smc.*sensor|piston.*sens/i.test(text)) {
    return true;
  }

  // Hittat 2026-10-01 (eget hårt testfall): kunden skrev "Vi behöver veta när
  // den är i topp och i botten" -- och fick ingen givarrad. Uttrycken ovan är
  // alla FACKORD. En kund som redan säger "ändlägesgivare" behöver sällan
  // hjälp att inse att hen behöver en; den som beskriver behovet på vanlig
  // svenska är precis den som gör det.
  //
  // Konsekvensen var tyst, vilket är det värsta: stycklistan saknade de två
  // givarna utan att någonstans nämna att de uteblev.
  //
  // Verbet måste stå nära lägesordet, annars fastnar "vi behöver veta vad det
  // kostar ... cylindern går till botten" på samma mening. 40 tecken räcker
  // för "veta när den är i " och stoppar vid meningsslut.
  // \b duger inte här. Det är ASCII-baserat i JavaScript, så \b före "å" i
  // "återkoppling" står mellan två tecken som BÅDA är icke-ord enligt \w --
  // ingen gräns, ingen träff, aldrig. Samma sak för ä, ö, ü och é. Det kostade
  // ett rött test innan det syntes, och hade annars tyst tagit bort halva
  // svenskan ur detektorn. (?<!\p{L}) med u-flaggan är gränsen som faktiskt
  // gäller alla bokstäver, i alla fyra språken.
  const verbNaraLage =
    /(?<!\p{L})(veta|se|visa|bekräfta|indikera|avkänn\p{L}*)(?!\p{L})[^.!?]{0,40}(?<!\p{L})(topp|botten|ändläg\p{L}*|utfälld|infälld|ute|inne|framme|tillbaka|hemläge|öppen|stängd)(?!\p{L})/iu;
  const verbNaraLageEn =
    /(?<!\p{L})(know|see|show|confirm|indicate|tell)(?!\p{L})[^.!?]{0,40}(?<!\p{L})(top|bottom|extended|retracted|home position|fully out|fully in)(?!\p{L})/iu;
  const verbNaraLageDe =
    /(?<!\p{L})(wissen|sehen|erkennen|bestätigen|melden)(?!\p{L})[^.!?]{0,40}(?<!\p{L})(oben|unten|ausgefahren|eingefahren|grundstellung)(?!\p{L})/iu;
  const verbNaraLageEs =
    /(?<!\p{L})(saber|ver|confirmar|indicar)(?!\p{L})[^.!?]{0,40}(?<!\p{L})(arriba|abajo|extendido|retraído|posición inicial)(?!\p{L})/iu;

  // Återkoppling till styrsystemet sägs ofta utan att någon position nämns.
  const aterkoppling =
    /(?<!\p{L})(återkoppl\p{L}*|lägesindik\p{L}*|indikering|feedback|rückmeldung|realimentación|retroalimentación)(?!\p{L})/iu;

  return verbNaraLage.test(text) || verbNaraLageEn.test(text) ||
    verbNaraLageDe.test(text) || verbNaraLageEs.test(text) ||
    aterkoppling.test(text);
}

/** Explicitly requested bore (user typed/answered "diameter 50", "Ø63", "borrning 40").
 *  An explicit size must outrank the load-based "smallest adequate" sizing — answering
 *  Ø50 and getting Ø40 back is a trust-breaker even when Ø40 carries the load. */
export function extractExplicitBoreMm(text: string, answers: Record<string, string>): number {
  for (const [k, v] of Object.entries(answers ?? {})) {
    if (/diam|borr|bore|⌀|ø/i.test(k)) {
      const m = String(v).match(/(\d{2,3})/);
      if (m) { const n = Number(m[1]); if (n >= 8 && n <= 320) return n; }
    }
  }
  const m = text.match(/(?:Ø|⌀)\s*(\d{2,3})|(?:diameter|borrning|bore)[^\d]{0,12}(\d{2,3})/i);
  if (m) { const n = Number(m[1] ?? m[2]); if (n >= 8 && n <= 320) return n; }
  return 0;
}

/** Articulated/swivel mounting: the cylinder PIVOTS during the stroke (angled push).
 *  Needs a rear swivel/pivot flange (ledlager/svängfläns) + a rod clevis (gaffelfäste),
 *  and the actuator must be a ROD cylinder — slides/rodless/guided units cannot
 *  articulate and must be excluded from the candidates. */
export function needsArticulatedMount(text: string): boolean {
  return /ledlager|sväng.?fläns|swivel|gaffelfäste|gaffelkoppling|clevis|pivå|trunnion|vinkelbart|vrider sig|vrida sig|vrids under/i.test(text);
}

/** Slides, rodless and guided units cannot take a rear pivot + rod clevis. */
export function isNonArticulatingActuator(p: CatalogProduct): boolean {
  return /slide|linjärslid|linjarslid|rodless|kolvstångslös|kolvstangslos|guide/i.test(`${p.name} ${p.sku}`);
}

/**
 * Kräver applikationen styrning eller vridskydd?
 *
 * Fanns inte alls, och det kostade oss en lösning. En kund valde "Ja, ledning"
 * i wizarden; det fanns ingen flagga att landa i, ingen BOM-rad blev följden,
 * och stycklistan saknade styrning helt. Optionskortet skrev till och med
 * "ingen inbyggd guidning -- extra komponent behövs för anti-rotation" bland
 * nackdelarna, så kunskapen fanns -- den nådde bara aldrig stycklistan.
 *
 * En kolvstångscylinder kan rotera kring sin egen axel och tål dåligt
 * sidokrafter. Ska den bära en pressplatta eller ett verktyg behövs antingen
 * en styrd cylinder eller en separat linjärstyrning.
 */
export function needsGuidance(text: string): boolean {
  return /ledning|guidning|styrning|vridskydd|anti.?rotation|rotationssäkr|får inte rotera|inte vrida sig|sidokraft|sidolast|tvärkraft|pressplatta|guided|anti.?rotat|side.?load|lateral.?load|führung|verdrehsicherung|querkraft|guiado|antigiro|carga.?lateral/i.test(text);
}

/** Returns true if user wants mounting brackets / foot mounts / flanges. */
export function needsMounting(text: string): boolean {
  return /fotfäste|foot.*mount|fot.*fäste|flansfäste|flange.*mount|monteringsfäste|bracket|montering|montage|fäste|befästning|konsol|mounting|swivel.*flange|trunnion/i.test(text);
}

/**
 * Calculate minimum required bore (mm) from load (kg) at given pressure (bar).
 * Uses F = P × A formula with safety factor 2.
 */
// ── Husets kraftmodell ───────────────────────────────────────────────────────
// Samma konstanter och formler finns i src/lib/physics.ts för frontend-runtimen.
// De två kan inte dela modul (Deno respektive Vite), så de hålls i synk av
// tester på båda sidor som låser fast samma tal. Ändras något här måste
// physics.ts och dess test ändras likadant.
//
// Bakgrund 2026-09-09: sajten hade FYRA oberoende kraftformler. För en Ø50 gav
// de 884 N, 1178 N, 1178 N och 1531 N. Chatten dimensionerade med
// verkningsgrad, maskinbyggaren utan -- för 35 kg rekommenderade de Ø50
// respektive Ø40. Båda syntes för kunden.
//
// TVÅ TAL SOM MÅSTE HÅLLAS ISÄR:
//   teoretisk kraft = π/4 · d² · P        -- vad katalogen anger
//   användbar kraft = teoretisk · η       -- vad man får räkna med
// Dimensionering jämför krav mot ANVÄNDBAR. Kataloguppslag visar teoretisk.
// Att blanda ihop dem är hur en Ø40 kan se ut att klara 754 N när den ger 565.

/** Tätningsfriktion. 0,75 ligger inom standardpraxis (0,7–0,9 beroende på
 *  tätningstyp) och är värdet frontendens physics.ts redan använde. */
export const SEAL_EFFICIENCY = 0.75;

/** Säkerhetsfaktor på lastens statiska vikt. */
export const LOAD_SAFETY_FACTOR = 2.0;

/** Kraften en borrning ger i teorin vid givet tryck (N). Det katalogen anger. */
export function theoreticalForceN(boreMm: number, pressureBar = 6): number {
  return Math.PI / 4 * boreMm * boreMm * pressureBar * 0.1; // bar → N/mm²
}

/** Kraften man får räkna med efter tätningsfriktion (N). Den som ska jämföras
 *  mot ett kraftkrav. */
export function usableForceN(boreMm: number, pressureBar = 6): number {
  return theoreticalForceN(boreMm, pressureBar) * SEAL_EFFICIENCY;
}

/**
 * Kraftkravet, i newton.
 *
 * En MASSA får säkerhetsfaktor: lasten accelereras, friktion tillkommer, och
 * faktorn täcker det. En uttryckligen ANGIVEN kraft får det inte -- den är
 * redan ett krav som någon räknat fram.
 *
 * Rättat 2026-09-10 efter en verifieringsomgång: "kräver 900 N klämkraft" gick
 * genom extractLoadKg:s generiska N-fallback, blev 900/9,81 = 91,7 kg, och
 * dubblades sedan till 1 800 N. Rekommendationen blev Ø80 där Ø50 räcker.
 * Systemet visste redan bättre -- extractGripForceN hittade 900 -- men den
 * signalen användes bara i gripdon-grenen, inte för cylinderdimensionering.
 *
 * Skillnaden mot "lasten är 500 N": där är newton en VIKT, inte ett kraftkrav,
 * och säkerhetsfaktorn hör hemma. Den vägen är oförändrad.
 */
export function requiredForceN(loadKg: number, statedForceN = 0): number {
  if (statedForceN > 0) return statedForceN;
  return loadKg <= 0 ? 0 : loadKg * 9.81 * LOAD_SAFETY_FACTOR;
}

/**
 * Minsta borrning som klarar lasten.
 *
 * Ändrad 2026-09-09: räknar nu mot ANVÄNDBAR kraft. Tidigare jämfördes kravet
 * mot teoretisk kraft, vilket underdimensionerade -- för 35 kg gav den Ø39,
 * men en Ø40 levererar bara 565 N mot kravets 687 N när friktionen räknas in.
 * Säkerhetsfaktorn åts alltså upp av förluster modellen inte kände till.
 * Underdimensionering är den farliga riktningen: en cylinder som inte orkar är
 * ett haveri, en överdimensionerad kostar bara mer luft.
 */
export function calcMinBoreMm(loadKg: number, pressureBar = 6, statedForceN = 0): number {
  const needN = requiredForceN(loadKg, statedForceN);
  if (needN <= 0) return 0;
  const areaMm2 = needN / (pressureBar * 0.1 * SEAL_EFFICIENCY);
  return Math.ceil(2 * Math.sqrt(areaMm2 / Math.PI));
}

/** Extract mass/load in kg from free text + answers. */
export function extractLoadKg(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  // Inte "kgf": "gripkraft 50 kgf" är en kraft. Den lästes som en last på 50 kg,
  // och tumregeln gav ett krav på 5000 N i stället för ≈ 490 N (granskningen
  // 2026-10-14).
  const kgMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*kg(?!f)/i);
  if (kgMatch) return parseFloat(kgMatch[1].replace(",", "."));
  // Maskinbyggarens sifferfält skickar talet utan enhet: {last_kg: "12"}.
  // Hittat 2026-10-11: vikten kunden svarat lästes aldrig, eftersom "last_kg 12"
  // har enheten före talet. Nyckeln bär enheten.
  for (const [k, v] of Object.entries(answers)) {
    if (/(^|_)(last|vikt|weight|load|massa?|mass)(_|$)|_kg$/i.test(k)) {
      const n = storstaTal(v);
      if (n > 0) return n;
    }
  }
  // "Pressa med 3000 N" och "900 N klämkraft" är kraftkrav, inga vikter.
  if (extractStatedForceN(text, answers) > 0 || extractGripForceN(text, answers) > 0 || extractHoldingForceN(text, answers) > 0) return 0;
  const nMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*N\b/);
  if (nMatch) return parseFloat(nMatch[1].replace(",", ".")) / 9.81;
  return 0;
}

/** Största talet i ett svar ("5–20 kg" → 20, "12" → 12, "Vet inte" → 0). */
function storstaTal(v: string): number {
  const tal = [...String(v ?? "").matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => parseFloat(m[0].replace(",", ".")));
  return tal.length ? Math.max(...tal) : 0;
}

/**
 * Kraft kunden uttryckligen kräver av en press, ett spänn eller en
 * utskjutning, i newton. Ett kraftkrav ÄR kravet och dubblas inte av
 * säkerhetsfaktorn (se requiredForceN).
 *
 * Hittat 2026-10-11: "behöver 3 kN" lästes inte alls (borrningen blev 0), och
 * "pressa med 3000 N" lästes som en last på 306 kg som sedan dubblades till
 * Ø131. Svaret på maskinbyggarens kraftfråga ({kraft_n: "3000"}) lästes inte
 * heller.
 */
export function extractStatedForceN(text: string, answers: Record<string, string>): number {
  for (const [k, v] of Object.entries(answers)) {
    if (!/kraft|force/i.test(k) || /grepp|grip|håll|hall|hold/i.test(k)) continue;
    const kn = String(v).match(/(\d+(?:[.,]\d+)?)\s*kN\b/i);
    if (kn) return parseFloat(kn[1].replace(",", ".")) * 1000;
    const n = storstaTal(v);
    if (n > 0) return n;
  }
  const kn = text.match(/(\d+(?:[.,]\d+)?)\s*kN\b/i);
  if (kn) return parseFloat(kn[1].replace(",", ".")) * 1000;
  // Inte "trycker upp en last på 500 N": där är newton en vikt, och
  // säkerhetsfaktorn hör hemma (se requiredForceN).
  const m = text.match(/(?:\bpress\w*|\bkläm\w*|\bspänn\w*|\bstans\w*|\bnit\w*|kraft)[^\d.]{0,12}(\d+(?:[.,]\d+)?)\s*N\b/i);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

/** Extract required torque (Nm) for a rotary-actuator request. */
/**
 * Explicitly stated grip force (N) for a gripper request -- e.g. "greppkraft
 * ca 100N", "grip force 100N". Found 2026-08-27 (adversarial test): a stated
 * grip force fell into extractLoadKg's generic "any N value ÷ 9.81 = kg"
 * fallback (treating it as an object's WEIGHT, not the grip-force spec
 * itself), then the gripper-sizing rule of thumb (weight × 100) re-derived a
 * ~10× too-high requirement from that misread "weight" -- silently ignoring
 * the customer's own directly-usable number. Checked BEFORE extractLoadKg in
 * the gripper path so an explicit grip-force statement is used as-is.
 *
 * Found again 2026-09-03 (adversarial test), same symptom via a different
 * mechanism: answers: {"greppkraft": "150N"} still misread as a 15 kg
 * "weight" (150/9.81) and re-inflated ×100 to 1529 N -- because the join
 * below only concatenated answers VALUES, never the KEYS, so "greppkraft"
 * (the keyword this function's own regex requires) was invisible whenever a
 * structured question puts the semantic label in the key rather than inline
 * in the value text. Same root cause affected 11 other extractors/detectors
 * in this file; all fixed identically (join key+value, not value alone),
 * matching extractCycleTimeS's pre-existing, already-correct pattern.
 */
export function extractGripForceN(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  return kraftEfterOrd(allText, GRIPKRAFTSORD, GRIPKRAFTSORD_EFTER);
}

/**
 * Explicitly stated holding force (N) for a vacuum-cup request -- e.g.
 * "hållkraft 50N", "holding force 50N". Same fix as extractGripForceN, for
 * the vacuum branch's ×9.81×2 weight-to-force derivation.
 */
export function extractHoldingForceN(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  return kraftEfterOrd(allText, HALLKRAFTSORD, HALLKRAFTSORD);
}

// Hittat 2026-10-14 (granskningen): "gripkraft 2 kN", "Greifkraft 1,5 kN" och
// "ska klämma med 300 N" lästes inte alls. Gripdonet prövades då mot ingenting,
// och ett gripdon på 600 N blev grönt fast kunden krävt 2000 N.
const GRIPKRAFTSORD = String.raw`(?:greppkraft|gripkraft|klämkraft|klamkraft|grip(?:ping)?\s*force|clamping\s*force|greifkraft|klemmkraft|fuerza\s*de\s*agarre|fuerza\s*de\s*sujeci[oó]n|kläm\w*\s+(?:med|på)|grip(?:a|er|s)?\s+med|greppa?\s+med|clamp(?:s|ing)?\s+with|grip(?:s|ping)?\s+with)`;
const GRIPKRAFTSORD_EFTER = String.raw`(?:greppkraft|gripkraft|klämkraft|klamkraft|grip(?:ping)?\s*force|clamping\s*force|greifkraft|klemmkraft)`;
const HALLKRAFTSORD = String.raw`(?:håll[-\s]?kraft|hallkraft|hold(?:ing)?\s*force|haltekraft|fuerza\s*de\s*(?:sujeci[oó]n|retenci[oó]n))`;
const KRAFTTAL = String.raw`(\d+(?:[.,]\d+)?)\s*(kN|N|kgf|kp)\b`;

/** Kraften efter (eller före) ett kraftord, i newton: kN, N, kgf och kp. */
function kraftEfterOrd(text: string, fore: string, efter: string): number {
  const m = text.match(new RegExp(`${fore}[^\\d]{0,10}${KRAFTTAL}`, "i")) ??
    text.match(new RegExp(`${KRAFTTAL}[^\\d]{0,15}${efter}`, "i"));
  if (!m) return 0;
  const n = parseFloat(m[1].replace(",", "."));
  const enhet = m[2].toLowerCase();
  return enhet === "kn" ? n * 1000 : enhet === "kgf" || enhet === "kp" ? n * 9.81 : n;
}

export function extractTorqueNm(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  const m = allText.match(/(\d+(?:[.,]\d+)?)\s*Nm\b/i);
  if (m) return parseFloat(m[1].replace(",", "."));
  // Sifferfältet: {vridmoment_nm: "5"}.
  for (const [k, v] of Object.entries(answers)) {
    if (/vridmoment|torque/i.test(k)) {
      const n = storstaTal(v);
      if (n > 0) return n;
    }
  }
  return 0;
}

/**
 * Vridmoment uppskattat ur vikt och hävarm när kunden inte vet det: vikten
 * gånger avståndet till tyngdpunkten, gånger två för accelerationen. Gäller
 * fullt ut när delen vänds runt en liggande axel; för ett vridbord ligger det
 * på den säkra sidan vid normala vridtider. 0 när något saknas.
 */
export function uppskattatVridmomentNm(loadKg: number, answers: Record<string, string>): number {
  let armMm = 0;
  for (const [k, v] of Object.entries(answers)) {
    if (/h[aä]varm|lever.?arm/i.test(k)) armMm = storstaTal(v);
  }
  if (!(loadKg > 0 && armMm > 0)) return 0;
  return Math.round(loadKg * 9.81 * (armMm / 1000) * 2 * 10) / 10;
}

/** Extract required rotation angle (degrees) for a rotary-actuator request. */
export function extractRotationDeg(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  // \b efter "°" kräver ett ordtecken efter gradtecknet, så "90°" sist i en
  // text lästes aldrig. Ordgränsen hör bara till orden.
  const m = allText.match(/(\d{2,3})\s*(?:°|grad(?:er)?\b|degrees?\b)/i);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * Största vridvinkel en produkt klarar, i grader. 0 när inget går att läsa.
 *
 * Katalogens nycklar, mätt 2026-10-02: rotation_angle finns på 15 av 18
 * vridenheter och skrivs som ett spann ("0–180"), swivel_angle_max på 3 och
 * skrivs som ett tal ("240"). Spannets ÖVRE ände är det produkten klarar.
 */
export function parseRotationFromSpecs(specs: Record<string, unknown>): number {
  for (const key of ["rotation_angle", "swivel_angle_max", "rotation_deg", "angle_deg"]) {
    const v = specs[key];
    if (v == null) continue;
    const tal = String(v).match(/\d+(?:[.,]\d+)?/g);
    if (tal && tal.length > 0) {
      return Math.max(...tal.map(t => parseFloat(t.replace(",", "."))));
    }
  }
  return 0;
}

export function parseTorqueFromSpecs(specs: Record<string, unknown>): number {
  const v = specs["torque"] ?? specs["torque_nm"];
  if (v == null) return 0;
  const n = parseFloat(String(v).match(/\d+(?:\.\d+)?/)?.[0] ?? "");
  return isNaN(n) ? 0 : n;
}

/** Cycle time in seconds from free text / answers ("1,5 sek cykeltid", "cykeltid 2 s"). */
export function extractCycleTimeS(text: string, answers: Record<string, string>): number {
  const all = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  const m = all.match(/(?:cykeltid|cycle\s*time|takt(?:tid)?)[^\d]{0,12}(\d+(?:[.,]\d+)?)\s*(?:s\b|sek\w*|sec\w*)/i)
    || all.match(/(\d+(?:[.,]\d+)?)\s*(?:s\b|sek\w*|sec\w*)\s*(?:cykel|cycle|takt)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

/**
 * Number of identical stations/units in a multi-station request (e.g. "6
 * identiska cylinderstationer på en sorteringslinje"). Consumed only by the
 * BOM step: buildMandatoryBomRows() scales every row that represents
 * genuinely per-station hardware by this count, while shared infrastructure
 * (a valve terminal, a central FRL) and pure warning rows do not. Returns 1
 * (a no-op multiplier) when no explicit count is stated, matching today's
 * unchanged single-unit behavior. Deliberately requires a counting noun
 * immediately next to the number -- a bare "6" is never enough -- so a
 * bore/pressure/temperature value like "6 mm" or "6 bar" is never misread
 * as a station count.
 */
export function extractUnitCount(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(" ");
  const m = allText.match(/(\d{1,3})\s*(?:st(?:ycken)?|identiska|parallella|stationer|celler|linjer|enheter|maskiner|units?|identical|parallel|stations?|cells?|lines?|machines?)\b/i)
    || allText.match(/\b(?:st(?:ycken)?|identiska|antal)\s*(\d{1,3})\b/i);
  if (!m) return 1;
  const n = parseInt(m[1], 10);
  return n >= 2 && n <= 200 ? n : 1;
}

export function needsLowCost(text: string): boolean {
  return /\blåg\s*kostnad\b|\bbillig\w*\b|\bkostnadseffektiv\w*\b|\bbudget\w*\b|\bbegränsad\w*\s+budget|\bsnål\w*\s+budget|\blimited\s+budget|\blow[\s-]?cost\b|\bcheap\b|\bcost[\s-]?effective\b|\bminimera\s*kostnad/i.test(text);
}

export function needsContinuousDuty(text: string): boolean {
  return /\b24\s*\/?\s*7\b|\bdygnet\s*runt\b|\bkontinuerlig\w*\s*drift\b|\bcontinuous\s*(?:duty|operation)\b|\bnon[\s-]?stop\b|\b3[\s-]?skift\b/i.test(text);
}

export function needsDirtyEnv(text: string): boolean {
  // "damm" även i sammansättningar ("aluminiumdamm", "slipdamm"), men inte
  // "dammfri" eller "dammsugare". Hittat 2026-10-11 (Geminis testfall).
  return /damm(?!fri|sug)\w*|\bdust\w*\b|\bolja\b|\boil\w*\b|\bsmuts\w*\b|\bdirty\b|\bspån\b|\bchips\b|\bkylvätska\b|\bcoolant\b|\bpartik\w*\b|\bcontaminat/i.test(text);
}

/** First-order move dynamics from cycle time + stroke + mass (triangular profile). */
export function computeDynamics(massKg: number, strokeMm: number, cycleTimeS: number, isVertical: boolean):
  { vPeak: number; accel: number; forceN: number } | null {
  if (massKg <= 0 || strokeMm <= 0 || cycleTimeS <= 0) return null;
  const s = strokeMm / 1000;
  const tMove = Math.max(0.3 * cycleTimeS, 0.05);   // assume ~30% of the cycle is the move
  const accel = (4 * s) / (tMove * tMove);           // triangular profile, peak accel
  const vPeak = (2 * s) / tMove;
  const g = 9.81;
  const forceN = massKg * accel + (isVertical ? massKg * g : 0) + 0.1 * massKg * g;
  return { vPeak, accel, forceN };
}

// ─────────────────────────────────────────────────────────────────────────────
// Elaxelspåret och kraftkravet (2026-10-11, Geminis testfall)
//
// "Flytta 80 kg 2 meter i sidled, ±0,1 mm, minst 1 m/s" fick cylinderfrågor
// (ändlägesgivare, kolvstång, slag/min) och kravet "1570 N" -- 80 kg × 9,81 ×
// 2, som om profilen lyftes. I sidled bär styrningen tyngden; axeln behöver
// bara accelerera lasten och övervinna friktionen, ungefär 300–650 N här.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kräver förfrågan en elaxel? Samma gräns som resultatsteget använder
 * (isHighPrecision, ±0,5 mm): en pneumatisk cylinder stannar bara exakt i sina
 * ändlägen. Dessutom fler än två lägen, uttryckligt el/servo och ingen tryckluft.
 */
export function needsElectricAxis(text: string): boolean {
  if (/elcylinder|elektrisk\w*\s+(cylinder|axel|linjär\w*|ställdon|aktuator|drivning)|eldriven|elaxel|\bservo|stegmotor|stepper|kuggrem|kulskruv|ball.?screw|linjärmodul|linear.?axis|electric\s+(actuator|cylinder|axis)/i.test(text)) return true;
  const precision = extractPrecisionMm(text, {});
  if (precision > 0 && precision <= 0.5) return true;
  if (/\b([3-9]|[1-9]\d)\s*(?:st\s+)?(?:positioner|lägen|stopplägen|positions)\b|mellanläg|flera\s+(?:lägen|positioner)|programmerbar\w*\s+(?:lägen|positioner)/i.test(text)) return true;
  return /ingen\s+tryckluft|utan\s+tryckluft|saknar\s+tryckluft|inte\s+tillgång\s+till\s+tryckluft|bara\s+el\b|endast\s+el\b|no\s+compressed\s+air|without\s+compressed\s+air/i.test(text);
}

/** Tiden en förflyttning får ta, i sekunder. 0 när den inte är angiven. */
export function extractMoveTimeS(text: string, answers: Record<string, string>): number {
  for (const [k, v] of Object.entries(answers)) {
    if (/f[oö]rflyttningstid|r[oö]relsetid|utskjutningstid|move.?time|push.?time/i.test(k)) {
      const n = storstaTal(v);
      if (n > 0) return n;
    }
  }
  const m = text.match(/(?:förflyttning\w*|rörelse\w*|flytt\w*|\bmove\w*)[^.\d]{0,30}(?:på|inom|in|under|within)\s*(\d+(?:[.,]\d+)?)\s*(?:s\b|sek\w*|sec\w*)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

/** Antagen acceleration när förflyttningstiden inte är känd: måttligt dynamisk elaxel. */
export const ANTAGEN_ACCELERATION = 3;
/** Friktionstal för en styrd last på kulbussningar eller rullstyrning, med tätningar och täckband. */
export const FRIKTIONSTAL_STYRNING = 0.1;

/**
 * Accelerationen en förflyttning kräver. Med både tid och fart: trapetsprofil
 * (accelerera, åk med farten, bromsa). Utan fart: triangelprofil. Utan tid:
 * antagen acceleration, och det sägs.
 */
export function rorelseprofil(strokeMm: number, tMoveS: number, speedMs: number): { acc: number; vPeak: number; antagen: boolean; forKort: boolean } {
  const s = strokeMm / 1000;
  if (tMoveS > 0 && s > 0) {
    if (speedMs > 0 && tMoveS < 2 * s / speedMs) {
      if (tMoveS > s / speedMs) return { acc: speedMs / (tMoveS - s / speedMs), vPeak: speedMs, antagen: false, forKort: false };
      // Tiden räcker inte ens med full fart hela vägen: farten måste upp.
      return { acc: 4 * s / (tMoveS * tMoveS), vPeak: 2 * s / tMoveS, antagen: false, forKort: true };
    }
    return { acc: 4 * s / (tMoveS * tMoveS), vPeak: 2 * s / tMoveS, antagen: false, forKort: false };
  }
  return { acc: ANTAGEN_ACCELERATION, vPeak: speedMs, antagen: true, forKort: false };
}

export type Kraftkrav = {
  /** Kravet i N, med säkerhetsfaktor där den hör hemma. 0 när inget går att räkna. */
  forceN: number;
  metod: "angiven" | "lyft" | "dynamik" | "tumregel" | "ingen";
  /** Uträkningen i klartext, för dimensioneringspanelen och modellen. */
  forklaring: string;
  /**
   * En uppskattning, inte ett krav eller ett dimensioneringsresultat. Allt
   * utom en kraft kunden angett är det: säkerhetsfaktorn och friktionstalet
   * är antaganden (lådsorteringstestet: "59 N" visades som krav).
   */
  preliminar?: boolean;
  /** Indata som saknas för en riktig dimensionering, i klartext. */
  saknas?: string[];
};

/** Märker en uträknad kraft som preliminär och säger vad som saknas. */
function preliminar(locale: string, k: Kraftkrav, saknas: Array<Record<"sv" | "en" | "de" | "es", string>>): Kraftkrav {
  const lista = saknas.map((x) => pick(locale, x));
  const forst = pick(locale, {
    sv: "Preliminär uppskattning, inte ett dimensioneringsresultat. ",
    en: "Preliminary estimate, not a sizing result. ",
    de: "Vorläufige Schätzung, kein Auslegungsergebnis. ",
    es: "Estimación preliminar, no un resultado de dimensionamiento. ",
  });
  const sist = lista.length ? pick(locale, {
    sv: ` Saknas för dimensionering: ${lista.join(", ")}.`,
    en: ` Missing for sizing: ${lista.join(", ")}.`,
    de: ` Fehlt für die Auslegung: ${lista.join(", ")}.`,
    es: ` Falta para el dimensionamiento: ${lista.join(", ")}.`,
  }) : "";
  return { ...k, preliminar: true, saknas: lista, forklaring: forst + k.forklaring + sist };
}

const SAKNAS_FRIKTION = { sv: "friktionstal mellan produkten och underlaget", en: "friction coefficient between product and surface", de: "Reibwert zwischen Produkt und Unterlage", es: "coeficiente de fricción entre producto y superficie" };
const SAKNAS_TID = { sv: "förflyttnings- eller utskjutningstid", en: "move or push time", de: "Verfahr- oder Ausschubzeit", es: "tiempo de desplazamiento o de empuje" };
const SAKNAS_RORLIG = { sv: "massan hos rörliga delar utöver lasten", en: "mass of moving parts besides the load", de: "Masse bewegter Teile zusätzlich zur Last", es: "masa de las partes móviles además de la carga" };
const SAKNAS_RIKTNING = { sv: "rörelseriktning", en: "direction of motion", de: "Bewegungsrichtung", es: "dirección del movimiento" };
const SAKNAS_STYRNINGSFRIKTION = { sv: "verkligt friktionstal i styrningen (0,1 är antaget)", en: "actual guide friction (0.1 is assumed)", de: "tatsächliche Führungsreibung (0,1 ist angenommen)", es: "fricción real de la guía (0,1 es supuesta)" };

function tal(locale: string, n: number, decimaler = 0): string {
  const t = decimaler > 0 ? n.toFixed(decimaler) : String(Math.round(n));
  return locale === "en" ? t : t.replace(".", ",");
}

/**
 * Kraftkravet och hur det räknades.
 *
 * - Angiven kraft (press, grepp, håll): kravet, utan säkerhetsfaktor.
 * - Lyft, eller okänd riktning: 2 × tyngden. Täcker acceleration och tryckfall,
 *   och ligger på den säkra sidan när riktningen inte är sagd.
 * - Elaxel i sidled: massa × acceleration + friktion, × 2. Tyngden bärs av
 *   styrningen och ska inte räknas som kraft i rörelseriktningen.
 * - Cylinder i sidled: tumregeln 2 × tyngden (oförändrad; en pneumatisk
 *   cylinder är billig att ta en storlek större på, en servoaxel är det inte).
 */
export function kraftkrav(o: {
  locale: string; loadKg: number; statedForceN: number; isVertical: boolean; isHorizontal: boolean;
  elaxel: boolean; strokeMm: number; tMoveS: number; speedMs: number;
}): Kraftkrav {
  const { locale } = o;
  const g = 9.81;
  const sf = LOAD_SAFETY_FACTOR;
  if (o.statedForceN > 0) {
    return { forceN: Math.round(o.statedForceN), metod: "angiven", forklaring: pick(locale, {
      sv: `Angiven kraft ${tal(locale, o.statedForceN)} N — används som den är, utan säkerhetsfaktor.`,
      en: `Stated force ${tal(locale, o.statedForceN)} N — used as is, without a safety factor.`,
      de: `Angegebene Kraft ${tal(locale, o.statedForceN)} N — wird unverändert verwendet, ohne Sicherheitsfaktor.`,
      es: `Fuerza indicada ${tal(locale, o.statedForceN)} N — se usa tal cual, sin factor de seguridad.`,
    }) };
  }
  if (o.loadKg <= 0) return { forceN: 0, metod: "ingen", forklaring: "" };
  const m = o.loadKg;
  const tyngd = m * g;
  if (o.elaxel && o.isHorizontal && !o.isVertical) {
    const prof = rorelseprofil(o.strokeMm, o.tMoveS, o.speedMs);
    const fAcc = m * prof.acc;
    const fFr = FRIKTIONSTAL_STYRNING * tyngd;
    const forceN = Math.round((fAcc + fFr) * sf);
    const topp = !prof.antagen && prof.vPeak > 0 ? pick(locale, {
      sv: ` Topphastigheten blir ${tal(locale, prof.vPeak, 1)} m/s.`,
      en: ` Peak speed becomes ${tal(locale, prof.vPeak, 1)} m/s.`,
      de: ` Die Spitzengeschwindigkeit beträgt ${tal(locale, prof.vPeak, 1)} m/s.`,
      es: ` La velocidad máxima es ${tal(locale, prof.vPeak, 1)} m/s.`,
    }) : "";
    const antagen = prof.antagen ? pick(locale, {
      sv: " (antagen — ange förflyttningstiden för en exakt beräkning)",
      en: " (assumed — give the move time for an exact calculation)",
      de: " (angenommen — Verfahrzeit angeben für eine genaue Berechnung)",
      es: " (supuesta — indique el tiempo de desplazamiento para un cálculo exacto)",
    }) : "";
    return preliminar(locale, { forceN, metod: "dynamik", forklaring: pick(locale, {
      sv: `I sidled bär styrningen tyngden; axeln ska accelerera lasten och övervinna friktionen: ${tal(locale, m)} kg × ${tal(locale, prof.acc, 1)} m/s²${antagen} = ${tal(locale, fAcc)} N, plus friktion ${tal(locale, FRIKTIONSTAL_STYRNING, 1)} × ${tal(locale, m)} kg × 9,81 = ${tal(locale, fFr)} N. Summa ${tal(locale, fAcc + fFr)} N × säkerhetsfaktor ${tal(locale, sf)} = ${tal(locale, forceN)} N.${topp}`,
      en: `Horizontally the guide carries the weight; the axis must accelerate the load and overcome friction: ${tal(locale, m)} kg × ${tal(locale, prof.acc, 1)} m/s²${antagen} = ${tal(locale, fAcc)} N, plus friction ${tal(locale, FRIKTIONSTAL_STYRNING, 1)} × ${tal(locale, m)} kg × 9.81 = ${tal(locale, fFr)} N. Total ${tal(locale, fAcc + fFr)} N × safety factor ${tal(locale, sf)} = ${tal(locale, forceN)} N.${topp}`,
      de: `Horizontal trägt die Führung das Gewicht; die Achse muss die Last beschleunigen und die Reibung überwinden: ${tal(locale, m)} kg × ${tal(locale, prof.acc, 1)} m/s²${antagen} = ${tal(locale, fAcc)} N, plus Reibung ${tal(locale, FRIKTIONSTAL_STYRNING, 1)} × ${tal(locale, m)} kg × 9,81 = ${tal(locale, fFr)} N. Summe ${tal(locale, fAcc + fFr)} N × Sicherheitsfaktor ${tal(locale, sf)} = ${tal(locale, forceN)} N.${topp}`,
      es: `En horizontal la guía soporta el peso; el eje debe acelerar la carga y vencer la fricción: ${tal(locale, m)} kg × ${tal(locale, prof.acc, 1)} m/s²${antagen} = ${tal(locale, fAcc)} N, más fricción ${tal(locale, FRIKTIONSTAL_STYRNING, 1)} × ${tal(locale, m)} kg × 9,81 = ${tal(locale, fFr)} N. Total ${tal(locale, fAcc + fFr)} N × factor de seguridad ${tal(locale, sf)} = ${tal(locale, forceN)} N.${topp}`,
    }) }, prof.antagen ? [SAKNAS_TID, SAKNAS_STYRNINGSFRIKTION] : [SAKNAS_STYRNINGSFRIKTION]);
  }
  const forceN = Math.round(tyngd * sf);
  if (o.isVertical) {
    return preliminar(locale, { forceN, metod: "lyft", forklaring: pick(locale, {
      sv: `Lyft: ${tal(locale, m)} kg × 9,81 = ${tal(locale, tyngd)} N × säkerhetsfaktor ${tal(locale, sf)} = ${tal(locale, forceN)} N (antas räcka för acceleration och tryckfall).`,
      en: `Lift: ${tal(locale, m)} kg × 9.81 = ${tal(locale, tyngd)} N × safety factor ${tal(locale, sf)} = ${tal(locale, forceN)} N (assumed to cover acceleration and pressure drop).`,
      de: `Heben: ${tal(locale, m)} kg × 9,81 = ${tal(locale, tyngd)} N × Sicherheitsfaktor ${tal(locale, sf)} = ${tal(locale, forceN)} N (soll Beschleunigung und Druckabfall abdecken, Annahme).`,
      es: `Elevación: ${tal(locale, m)} kg × 9,81 = ${tal(locale, tyngd)} N × factor de seguridad ${tal(locale, sf)} = ${tal(locale, forceN)} N (se supone que cubre aceleración y caída de presión).`,
    }) }, [SAKNAS_TID, SAKNAS_RORLIG]);
  }
  const okandRiktning = !o.isHorizontal ? pick(locale, {
    sv: " Riktningen är inte angiven, så det räknas som ett lyft för säkerhets skull.",
    en: " The direction is not stated, so it is treated as a lift to be safe.",
    de: " Die Richtung ist nicht angegeben, daher wird sicherheitshalber wie beim Heben gerechnet.",
    es: " La dirección no está indicada, así que se calcula como una elevación por seguridad.",
  }) : "";
  return preliminar(locale, { forceN, metod: "tumregel", forklaring: pick(locale, {
    sv: `Tumregel: ${tal(locale, sf)} × lastens tyngd (${tal(locale, m)} kg × 9,81 × ${tal(locale, sf)} = ${tal(locale, forceN)} N) antas räcka för friktion, acceleration och tryckfall.${okandRiktning}`,
    en: `Rule of thumb: ${tal(locale, sf)} × the load's weight (${tal(locale, m)} kg × 9.81 × ${tal(locale, sf)} = ${tal(locale, forceN)} N) is assumed to cover friction, acceleration and pressure drop.${okandRiktning}`,
    de: `Faustregel: ${tal(locale, sf)} × Gewichtskraft der Last (${tal(locale, m)} kg × 9,81 × ${tal(locale, sf)} = ${tal(locale, forceN)} N) soll Reibung, Beschleunigung und Druckabfall abdecken (Annahme).${okandRiktning}`,
    es: `Regla práctica: ${tal(locale, sf)} × el peso de la carga (${tal(locale, m)} kg × 9,81 × ${tal(locale, sf)} = ${tal(locale, forceN)} N) se supone que cubre fricción, aceleración y caída de presión.${okandRiktning}`,
  }) }, [okandRiktning ? SAKNAS_RIKTNING : null, SAKNAS_FRIKTION, o.tMoveS > 0 ? null : SAKNAS_TID, SAKNAS_RORLIG].filter((x): x is typeof SAKNAS_TID => x !== null));
}

/** Säger kunden att rörelsen är horisontell, utan att den samtidigt lyfter? */
export function arHorisontellRorelse(text: string): boolean {
  return sagerHorisontell(text) ||
    (/\bi\s+sidled\b|\bsidled\w*|\bvågrät\w*|skjut\w*\s+(av|ut|bort|över|in|fram|tillbaka)\b|knuff|sidobana/i.test(text) && !needsVerticalLoad(text));
}

/** Flag conflicting / unrealistic requirement combinations — what a real engineer says. */
export function detectConflicts(f: {
  locale: string; precisionMm: number; isHighPrecision: boolean; speedMs: number;
  isDirtyEnv: boolean; isWashdown: boolean; isAtexDust: boolean; isLowCost: boolean;
  is24x7: boolean; dyn: { vPeak: number; accel: number; forceN: number } | null;
}): string[] {
  const { locale } = f; const out: string[] = [];
  if (f.isHighPrecision && (f.isDirtyEnv || f.isWashdown || f.isAtexDust))
    out.push(pick(locale, {
      sv: `±${f.precisionMm} mm i smutsig/våt miljö krockar — kulskruv kräver tätning/bälg och skydd mot damm/olja, annars degraderar precisionen. Kräver IP-klassad/skyddad axel (fördyrar).`,
      en: `±${f.precisionMm} mm in a dusty/wet environment conflicts — a ball screw needs sealing/bellows and protection or precision degrades. Requires an IP-rated/protected axis (adds cost).`,
      de: `±${f.precisionMm} mm in staubiger/feuchter Umgebung ist ein Widerspruch — eine Kugelumlaufspindel benötigt Abdichtung/Faltenbalg und Schutz, sonst verschlechtert sich die Präzision. Erfordert eine IP-geschützte Achse (verursacht Mehrkosten).`,
      es: `±${f.precisionMm} mm en un entorno sucio/húmedo genera un conflicto — un husillo de bolas necesita sellado/fuelle y protección, o la precisión se degrada. Requiere un eje con protección IP (encarece el coste).`,
    }));
  if (f.isHighPrecision && f.isLowCost)
    out.push(pick(locale, {
      sv: `Hög precision (±${f.precisionMm} mm) och låg kostnad krockar — kulskruvsservo + styrning är dyrare än pneumatik. Prioritera ett av kraven.`,
      en: `High precision (±${f.precisionMm} mm) and low cost conflict — ball-screw servo + control costs more than pneumatics. Prioritise one.`,
      de: `Hohe Präzision (±${f.precisionMm} mm) und niedrige Kosten stehen im Widerspruch — Kugelumlaufspindel-Servo + Steuerung kostet mehr als Pneumatik. Priorisieren Sie eine der beiden Anforderungen.`,
      es: `Alta precisión (±${f.precisionMm} mm) y bajo coste entran en conflicto — el servo de husillo de bolas + control cuesta más que la neumática. Priorice uno de los dos requisitos.`,
    }));
  if (f.isHighPrecision && f.speedMs > 0.8)
    out.push(pick(locale, {
      sv: `Hög hastighet (${f.speedMs} m/s) + ±${f.precisionMm} mm — kulskruv begränsas av varvtal/resonans, kuggrem av backlash. Verifiera axeln; ev. kuggrem + linjärgivare (sluten loop).`,
      en: `High speed (${f.speedMs} m/s) + ±${f.precisionMm} mm — ball screws are rpm/resonance-limited, belts have backlash. Verify the axis; possibly belt + linear encoder (closed loop).`,
      de: `Hohe Geschwindigkeit (${f.speedMs} m/s) + ±${f.precisionMm} mm — Kugelumlaufspindeln sind drehzahl-/resonanzbegrenzt, Zahnriemen haben Spiel (Backlash). Achse prüfen; ggf. Zahnriemen + Linearencoder (geschlossener Regelkreis).`,
      es: `Alta velocidad (${f.speedMs} m/s) + ±${f.precisionMm} mm — los husillos de bolas están limitados por RPM/resonancia, las correas dentadas tienen holgura. Verifique el eje; posiblemente correa + encoder lineal (bucle cerrado).`,
    }));
  if (f.is24x7 && f.dyn)
    out.push(pick(locale, {
      sv: `Kontinuerlig drift (24/7) vid ~${Math.round(f.dyn.forceN)} N — dimensionera för livslängd/duty cycle (L10); kulskruv och lager slits vid hög acceleration.`,
      en: `Continuous duty (24/7) at ~${Math.round(f.dyn.forceN)} N — size for service life/duty cycle (L10); ball screw and bearings wear under high acceleration.`,
      de: `Dauerbetrieb (24/7) bei ~${Math.round(f.dyn.forceN)} N — für Lebensdauer/Duty-Cycle (L10) dimensionieren; Kugelumlaufspindel und Lager verschleißen bei hoher Beschleunigung.`,
      es: `Servicio continuo (24/7) a ~${Math.round(f.dyn.forceN)} N — dimensione para vida útil/ciclo de trabajo (L10); el husillo de bolas y los rodamientos se desgastan con alta aceleración.`,
    }));
  return out;
}

// ── End-effector (gripper / vacuum) helpers ───────────────────────────────────
// A gripping request's PRIMARY part is the gripper / suction cup, NOT a linear
// actuator. The actuator ranker scores bore/stroke/force, so grippers (sized by
// GRIP FORCE) and vacuum cups (sized by HOLDING FORCE) never surfaced — a
// "parallellgripare" request fell through to a guide cylinder or CUSTOM even though
// we stock 50 grippers + 12 vacuum parts. This branch surfaces the right family.
export function detectEndEffectorIntent(text: string): "gripper" | "vacuum" | null {
  const t = text.toLowerCase();
  const vacuumAsk = /vakuumgrepp|vakuumgripare|sugkopp|sugkoppar|suction.?cup|\bsugg\b|ejektor|vakuum.{0,12}(plock|grepp|lyft|hanter)/i.test(t);
  // "parallellgrepp" och "vinkelgrepp" saknades till 2026-10-02: bara
  // -gripare-formerna fanns, trots att -grepp är minst lika vanligt på
  // svenska. "Vi ska gripa en detalj med ett parallellgrepp" gav null.
  // "radialgripare" saknades till 2026-10-14: "parallell-" och "vinkel-" fanns,
  // och en radialbegäran fick ejektorer ur cylindervägen (granskningen).
  const gripperAsk = /gripdon|parallellgrip(are|grepp)?|parallellgrepp|vinkelgrip(are|grepp)?|vinkelgrepp|radialgrip(are|grepp)?|radialgrepp|tregrepp|treback|griparback|\bgripper\b|\bgripare\b|\bgrepp(et|en)?\b|klämback|gripa\s+(och|tag|fast|om)|griper\s+(om|fast|tag|och)/i.test(t);
  // Fragile, flat parts imply vacuum even without the word (glass / PCB / thin sheet).
  const fragileFlat = /\bglas\b|glasskiv|\bwafer\b|kretskort|\bpcb\b|tunn(a|t)?\s*pl(å|a)t|folie|laminat|solcell|\bdisplay\b|\blins(er)?\b/i.test(t)
                      && /plock|lyft|grepp|gripa|hanter|flytta/i.test(t);
  if (vacuumAsk) return "vacuum";
  if (gripperAsk) return "gripper";
  if (fragileFlat) return "vacuum";
  return null;
}

/**
 * Sa kunden UTTRYCKLIGEN hur det ska gripas, eller gissade vi?
 *
 * detectEndEffectorIntent svarar "vacuum" både på "vakuumgrepp" (ett angivet
 * krav) och på "lyfter glasskivor" (en härledning ur att glas är plant och
 * ömtåligt). Skillnaden spelar roll i handleOptions, som hoppar över hela
 * griporganet när rörelsen är flerkaxlig -- rimligt för en portal som råkar ha
 * ett grepp, men fel när kunden själv skrivit vilket grepp hen vill ha.
 *
 * Hittat 2026-10-02: "Plockar och placerar kartong 2 kg — vakuumgrepp från
 * magasin" är ett av de SEX exemplen på startsidan. Det gav en kompaktcylinder
 * med 5 mm slag och inte en enda vakuumkomponent, trots att katalogen har 12.
 * "Plocka och placera" räknas som flerkaxligt, och villkoret slängde det
 * uttalade kravet.
 */
export function endEffectorExplicitlyAsked(text: string): boolean {
  const t = text.toLowerCase();
  return /vakuumgrepp|vakuumgripare|sugkopp|sugkoppar|suction.?cup|ejektor|vakuum.{0,12}(plock|grepp|lyft|hanter)/i.test(t)
    || /gripdon|parallellgrip(are|grepp)?|parallellgrepp|vinkelgrip(are|grepp)?|vinkelgrepp|radialgrip(are|grepp)?|radialgrepp|griparback|\bgripper\b|\bgripare\b|klämback/i.test(t);
}

/**
 * Gripdonstypen texten ber om: parallell (standard), vinkel eller radial (tre
 * backar). En uttalad typ -- ett gripdonsord som "parallellgripare" eller
 * "treback" -- går före en härledd ("runda detaljer"). Står flera uttalade
 * typer gäller den som nämns först. Ett lösryckt "parallellt" är ingen typ:
 * "Radialgripare, detaljerna ligger parallellt" är en radialbegäran.
 * Delas av alternativen och stycklistan.
 *
 * Ett byte vänder ordningen (granskningen 2026-10-14): i "vi har
 * vinkelgripare idag men vill byta till parallellgripare" är det den senare
 * kunden vill ha, och i "parallellgripare i stället för vinkelgripare" den
 * förra.
 */
export function onskadGripdonstyp(text: string): "parallel" | "angular" | "radial" {
  const t = text.toLowerCase();
  const TYPER: Array<{ typ: "parallel" | "angular" | "radial"; re: RegExp }> = [
    { typ: "parallel", re: /parallell(?:grip\w*|grepp\w*)|parallel\s*grip\w*/ },
    { typ: "angular", re: /vinkelgrip\w*|vinkelgrepp\w*|angular\s*grip\w*|angle\s*grip\w*/ },
    { typ: "radial", re: /radialgrip\w*|radial\s*grip\w*|tre[\s-]?back\w*|3[\s-]?back\w*|3[\s-]?jaw|three[\s-]?jaw|tre[\s-]?finger\w*|3[\s-]?finger\w*/ },
  ];
  const forstaTyp = (del: string) => {
    const uttalade = TYPER.map(({ typ, re }) => ({ typ, pos: re.exec(del)?.index ?? -1 })).filter((x) => x.pos >= 0);
    return uttalade.length ? uttalade.sort((a, b) => a.pos - b.pos)[0].typ : null;
  };
  const istallet = /\bi\s?stället\s+för\b|\binstead\s+of\b|\banstatt\b|\ben\s+(?:lugar|vez)\s+de\b/.exec(t);
  if (istallet) {
    const fore = forstaTyp(t.slice(0, istallet.index));
    if (fore) return fore;
  }
  // "byta till X", "byta ut Y mot X", "ersätta Y med X", "vill ha X": X står efter.
  const byte = /\b(?:byt(?:a|as|er)?|ersätt\w*)\s+(?:[^.]{0,40}?\s)?(?:till|mot|med)\b|\bvill\s+ha\b|\bswitch(?:ing)?\s+to\b|\breplac\w*\s+(?:[^.]{0,40}?\s)?with\b|\bwechseln\s+zu\b|\bcambiar\s+a\b/.exec(t);
  if (byte) {
    const efter = forstaTyp(t.slice(byte.index + byte[0].length));
    if (efter) return efter;
  }
  const uttalad = forstaTyp(t);
  if (uttalad) return uttalad;
  return /radial|självcentr|sjalvcentr|centrer|\brunda?\b|cylindrisk/.test(t) ? "radial"
    : /vinkel|angular|\bangle\b|hinged/.test(t) ? "angular" : "parallel";
}

/**
 * Kraften ett griporgan ska klara: den angivna, annars en tumregel ur lastens
 * massa. Delas av alternativen (handleEndEffectorOptions) och stycklistan
 * (griporganets rad och kontrollen av den), så att båda prövar mot samma tal.
 *
 * Gripdon: vikt × 100 N -- friktionsgrepp med två backar, friktionstal runt
 * 0,1–0,2 och marginal för acceleration. Sugkopp: vikt × 9,81 × 2.
 * 0 när varken kraft eller massa är känd.
 *
 * En uttalad GRIPKRAFT på ett gripdon gäller som den är: den är backarnas
 * kraft och kundens val, och ett formgrepp klarar sig med mindre än
 * tumregeln. "Hållkraft" är tvetydigt -- lastens kraft eller griporganets --
 * och med känd massa får den bara höja kravet. "Gripdon för 50 kg låda,
 * hållkraft 200 N" (lådan väger ≈ 490 N) gav annars ett gripdon på 508 N märkt
 * "Rätt storlek" (granskningen 2026-10-14). Samma regel för en sugkopp.
 */
export interface Griporganskrav {
  /** Kraften griporganet prövas mot, i N. 0 när den är okänd. */
  n: number;
  /** Kravet är kundens eget tal, inte tumregeln. */
  angiven: boolean;
  /** Tumregeln ur lastens massa, 0 när massan är okänd. */
  tumregelN: number;
  /** Kraften kunden angav, även när tumregeln vann. 0 om ingen angavs. */
  angivetN: number;
}

export function griporgansKrav(
  typ: "gripper" | "vacuum", h: { gripForceN: number; holdingForceN: number; loadKg: number },
): Griporganskrav {
  const tumregelN = h.loadKg > 0 ? Math.round(typ === "gripper" ? Math.max(h.loadKg * 100, 20) : h.loadKg * 9.81 * 2) : 0;
  if (typ === "gripper" && h.gripForceN > 0) {
    const n = Math.round(h.gripForceN);
    return { n, angiven: true, tumregelN, angivetN: n };
  }
  const angivetN = Math.round(typ === "gripper" ? h.holdingForceN : (h.holdingForceN || h.gripForceN));
  if (angivetN > 0 && angivetN >= tumregelN) return { n: angivetN, angiven: true, tumregelN, angivetN };
  return { n: tumregelN, angiven: false, tumregelN, angivetN };
}

/**
 * Food-grade / food-industry material or lubrication requirement (NSF-H1,
 * EHEDG, direct food contact). Consolidates two regexes that had drifted
 * apart across two call sites in index.ts (handleQuestions vs. handleOptions)
 * -- this is their union, verbatim (the handleQuestions version was already
 * the superset: it additionally matched nsf/h1).
 */
export function needsFoodGrade(text: string): boolean {
  // Produkterna räknas, inte bara branschen. Hittat 2026-10-11: "Doseringsmaskin
  // för sylt … daglig tvätt" fick varken livsmedels- eller tvättfrågor, och
  // modellens egna frågor om dem rensades bort som irrelevanta.
  return /livsmedel|food|slakteri|chark|mejeri|kött|meat|poultry|fjäderfä|dairy|fisk|fish|bageri|brewery|nsf|h1\b/i.test(text) ||
    /\b(sylt|marmelad|juice|saft|läsk|dryck(er)?|bryggeri|choklad|godis|konfektyr|ost(ar)?|bröd|bakverk|frukt|grönsak(er)?|potatis|kaffe|sås|ketchup|majonnäs|dressing|mjölk|yoghurt|smör|ägg|kyckling|korv|barnmat|beverage|bakery|confectionery|chocolate|cheese|candy)\b/i.test(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// HazardFlags / detectHazards -- single source of truth for every hazard flag
// and free-text numeric extraction above.
//
// Found 2026-08-28: five real bugs (ATEX ignored by the pure-rotary options
// path, a battery-dryroom material warning missing from BomCtx entirely, an
// engineering conflict-check wired into only one of several handlers, an
// ESD-safety requirement with no detector at all, and more found on audit)
// all shared one root cause -- index.ts has several independent HTTP-handler
// code paths, and each one independently decided which of the detectors above
// to call and which flags to thread into the object it builds for downstream
// use. It's easy for one path to wire a flag in correctly while a sibling
// forgets it, silently.
//
// detectHazards() computes every flag exactly once. Every field below is a
// direct, unmodified call to one of the exported functions above (e.g.
// `isAtex` really is `needsAtex(text)`, not a re-derivation) -- so it can
// never disagree with calling the detector directly, which is also what
// makes it possible to prove equivalence with a static test once (see
// signals.test.ts) rather than needing a runtime shadow-check.
//
// `conflicts`/`dynamics` are always computed here (cheap, pure) but whether a
// given consumer SURFACES them in customer-facing text is that consumer's own
// decision -- the underlying messages assume a linear ball-screw/belt/
// pneumatic axis, so bolting them onto e.g. a vacuum-cup recommendation would
// be a non-sequitur, not a fix.
// ─────────────────────────────────────────────────────────────────────────────

export interface HazardFlags {
  /** Spolning/tvätt (IP69K-krav), till skillnad från bara korrosiv miljö. */
  isSpolmiljo?: boolean;
  /** Kunden har redan ett lyft (en Z-axel, en lyftanordning) som griporganet
   *  sitter på. Lyftet ingår då inte, men det saknas inte heller. */
  befintligtLyft?: boolean;
  /** Den PL/SIL-nivå kunden angett, eller null. */
  sakerhetsniva?: string | null;
  // Routing / scope
  isSystemScope: boolean;
  isMultiAxis: boolean;
  isVacuum: boolean;
  valveTerminal: boolean;
  // Environment / material / safety hazards
  isAtex: boolean;
  isAtexDust: boolean;
  isVerticalLoad: boolean;
  isHighTemp: boolean;
  isLowTemp: boolean;
  isHydraulic: boolean;
  isVeryHighForce: boolean;
  isOxygenClean: boolean;
  isEsdSafe: boolean;
  isHighCycle: boolean;
  isHighSpeed: boolean;
  isSilSafety: boolean;
  isOutdoor: boolean;
  isPharmaGmp: boolean;
  isFoodGrade: boolean;
  isBatteryDryroom: boolean;
  isRodLock: boolean;
  isWashdown: boolean;
  isEndPosDetect: boolean;
  isArticulated: boolean;
  isMounting: boolean;
  isGuided: boolean;
  isLowCost: boolean;
  is24x7: boolean;
  isDirtyEnv: boolean;
  // Derived (cheap, deterministic)
  isHighPrecision: boolean;
  minBoreMm: number;
  // Numeric / structured extractions
  requiredMaxTempC: number;
  minStrokeMm: number;
  perAxisStrokes: Array<{ axis: string; stroke: number }>;
  requiredStrokeMm: number;
  speedMs: number;
  precisionMm: number;
  explicitBoreMm: number;
  loadKg: number;
  gripForceN: number;
  holdingForceN: number;
  /** Kraft kunden uttryckligen kräver (grepp, håll, press), i N. 0 när ingen anges. */
  statedForceN?: number;
  torqueNm: number;
  /** Vridmomentet är uppskattat ur vikt och hävarm, inte angivet. */
  torqueUppskattat?: boolean;
  /** Förfrågan kräver en elaxel (precision, lägen, el, ingen tryckluft). */
  elaxel?: boolean;
  /** Förflyttningstiden, s. 0 när den inte är angiven. */
  moveTimeS?: number;
  /** Kraftkravet och uträkningen (kraftkrav()). */
  kraftkrav?: Kraftkrav;
  /** Noggrannheten gäller varje läge över hela slaget, inte bara att hitta tillbaka. */
  absolutNoggrannhet?: boolean;
  /** Lasten sticker ut från vagnen och belastar styrningen med ett moment. */
  utskjutandeLast?: boolean;
  rotationDeg: number;
  cycleTimeS: number;
  // Composed -- assume a linear axis, see file-header comment above
  dynamics: { vPeak: number; accel: number; forceN: number } | null;
  conflicts: string[];
}

/**
 * `text` should be the caller's full available text (raw `description` at the
 * questions step, `description + " " + answers` everywhere else -- matches
 * what every existing call site already passed). `locale` affects ONLY the
 * strings inside `conflicts` -- every other field is locale-independent.
 */
export function detectHazards(
  text: string,
  answers: Record<string, string>,
  locale: string,
  tolkning: Tolkningsbeslut = {},
): HazardFlags {
  // Whole-line, multi-station request (weigh + identify + sort + robot/PLC).
  // The catalog can't be a single "solution" here -- consumers should surface
  // motion building blocks and be honest about what needs system integration
  // vs. the catalog's range.
  const isSystemScope = isMultiFunctionSystem(text);
  const isMultiAxis = needsMultiAxis(text);
  const isVacuum = needsVacuumGrip(text);
  const valveTerminal = needsValveTerminal(text);
  const isAtex = needsAtex(text);
  const isAtexDust = needsAtexDust(text);
  const isVerticalLoad = needsVerticalLoad(text);
  const isHighTemp = needsHighTemp(text);
  const isLowTemp = needsLowTemp(text);
  const isHydraulic = isHydraulicApplication(text);
  const isVeryHighForce = needsVeryHighForce(text, answers);
  const isOxygenClean = needsOxygenClean(text);
  const isEsdSafe = needsEsdSafe(text);
  const isHighCycle = needsHighCycle(text, answers);
  const isHighSpeed = needsHighSpeed(text, answers);
  const isSilSafety = needsSilSafety(text);
  const isOutdoor = needsOutdoor(text);
  const isPharmaGmp = needsPharmaGmp(text);
  const isFoodGrade = needsFoodGrade(text) || isPharmaGmp;
  const isBatteryDryroom = needsBatteryDryroom(text);
  const isRodLock = needsRodLock(text) || (isVerticalLoad && isSilSafety);
  const isWashdown = needsWashdown(text);
  const isEndPosDetect = needsEndPositionDetection(text);
  const isArticulated = needsArticulatedMount(text);
  const isMounting = needsMounting(text);
  const isGuided = needsGuidance(text);
  const isLowCost = needsLowCost(text);
  const is24x7 = needsContinuousDuty(text);
  const isDirtyEnv = needsDirtyEnv(text);

  const requiredMaxTempC = extractRequiredMaxTemp(text, answers);
  const minStrokeMm = extractMinStroke(answers, text);
  // Gated on isMultiAxis, matching both call sites this replaced (handleBom's
  // and handleOptions's own pre-refactor locals) -- extractPerAxisStrokes
  // matches ANY answer key containing a stroke-ish term, not just genuinely
  // separate axes, so ungated it can wrongly treat e.g. two independently-
  // keyed stroke answers on a single-axis request as multiple axes and take
  // their max instead of minStrokeMm's single (first-match) value.
  const perAxisStrokes = isMultiAxis ? extractPerAxisStrokes(answers) : [];
  // System scope: a number like "200-500 mm" is carton SIZE, not actuator
  // stroke -- don't treat it as a stroke requirement (it would falsely fail
  // every cylinder).
  const requiredStrokeMm = isSystemScope ? 0
    : perAxisStrokes.length > 0 ? Math.max(...perAxisStrokes.map(a => a.stroke))
    : minStrokeMm;
  const speedMs = extractSpeedMs(text, answers, tolkning);
  const precisionMm = extractPrecisionMm(text, answers);
  // Threshold raised 0.1 -> 0.5 on 2026-09-08 after a user-reported bad answer:
  // a pallet stacker needing "±0,5 mm vid varje stopp" (35 kg, 900 mm vertical,
  // 12 cycles/min, 24/7, dusty) was answered with three PNEUMATIC rodless
  // cylinders as "Bästa valet". precisionMm parsed correctly as 0.5, but 0.5 >
  // 0.1 meant isHighPrecision stayed false, so isAllowedForHighPrecision --
  // which exists precisely to exclude pneumatics -- was never applied.
  //
  // 0.5 comes from this repo's own documented figures (scoring.ts:173):
  // pneumatic repeatability is +-0.1..0.5 mm, belt backlash 0.05..0.3 mm, ball
  // screw 0.003..0.05 mm. A requirement AT 0.5 mm therefore sits at the very
  // worst edge of what the best pneumatic can do -- zero margin, before you
  // add a vertical axis whose load varies, 12 cycles/min and a dusty
  // environment. You do not spec a component at 100% of its best case, so a
  // stated requirement of 0.5 mm or tighter means electric.
  //
  // Deliberately NOT looser than 0.5: a casual "±1 mm" usually describes
  // end-position repeatability, which a cushioned pneumatic cylinder with hard
  // stops genuinely does meet, and excluding pneumatics there would be wrong
  // in the opposite direction.
  const isHighPrecision = precisionMm > 0 && precisionMm <= 0.5;
  const explicitBoreMm = extractExplicitBoreMm(text, answers);
  const loadKg = extractLoadKg(text, answers);
  // Före minBoreMm: en uttryckligen angiven kraft ÄR kravet och ska inte
  // dubblas av säkerhetsfaktorn. Se requiredForceN().
  const gripForceN = extractGripForceN(text, answers);
  const holdingForceN = extractHoldingForceN(text, answers);
  const statedForceN = gripForceN || holdingForceN || extractStatedForceN(text, answers);
  const minBoreMm = calcMinBoreMm(loadKg, 6, statedForceN);
  const elaxel = needsElectricAxis(text);
  const moveTimeS = extractMoveTimeS(text, answers);
  const kraft = kraftkrav({
    locale, loadKg, statedForceN, isVertical: isVerticalLoad, isHorizontal: arHorisontellRorelse(text),
    elaxel, strokeMm: requiredStrokeMm || minStrokeMm, tMoveS: moveTimeS, speedMs,
  });
  const angivetVridmoment = extractTorqueNm(text, answers);
  const torqueNm = angivetVridmoment || uppskattatVridmomentNm(loadKg, answers);
  const torqueUppskattat = angivetVridmoment === 0 && torqueNm > 0;
  const rotationDeg = extractRotationDeg(text, answers);
  const cycleTimeS = extractCycleTimeS(text, answers);

  const dynamics = computeDynamics(loadKg, requiredStrokeMm, cycleTimeS, isVerticalLoad);
  const conflicts = detectConflicts({
    locale, precisionMm, isHighPrecision, speedMs, isDirtyEnv, isWashdown, isAtexDust,
    isLowCost, is24x7, dyn: dynamics,
  });

  return {
    isSystemScope, isMultiAxis, isVacuum, valveTerminal,
    isAtex, isAtexDust, isVerticalLoad, isHighTemp, isLowTemp, isHydraulic, isVeryHighForce,
    isOxygenClean, isEsdSafe, isHighCycle, isHighSpeed, isSilSafety, isOutdoor, isPharmaGmp,
    isSpolmiljo: needsSpolmiljo(text), sakerhetsniva: angivenSakerhetsniva(text),
    befintligtLyft: harBefintligtLyft(text),
    isFoodGrade, isBatteryDryroom, isRodLock, isWashdown, isEndPosDetect, isArticulated,
    isMounting, isGuided, isLowCost, is24x7, isDirtyEnv, isHighPrecision, minBoreMm,
    requiredMaxTempC, minStrokeMm, perAxisStrokes, requiredStrokeMm, speedMs, precisionMm,
    explicitBoreMm, loadKg, gripForceN, holdingForceN, statedForceN, torqueNm, torqueUppskattat, rotationDeg, cycleTimeS,
    elaxel, moveTimeS, kraftkrav: kraft,
    absolutNoggrannhet: /absolut\w*\s+(?:positions)?noggrann|exakt rätt över hela slaget|absolute\s+(?:positioning\s+)?accuracy/i.test(text),
    utskjutandeLast: /utskjutande|överhäng\w*|sticker ut|hävarm|overhang\w*|cantilever\w*/i.test(text) && !/centrerad på vagnen/i.test(text),
    dynamics, conflicts,
  };
}

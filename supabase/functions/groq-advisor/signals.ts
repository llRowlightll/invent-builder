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
  if (/pick.and.place|pick.*place|plocka.*placera|plocka.*flytta|lyfter.*flytta|flytta.*lyft|transfer.*station|montering|montage/i.test(t)) {
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
export function parseProductTempMax(specs: Record<string, unknown>): number {
  for (const key of ["temp_max", "temp_range", "operating_temp", "temperature_range", "temperature_max", "temp_rating", "ambient_temp"]) {
    const v = specs[key];
    if (v == null) continue;
    const s = String(v).replace(/[°Cc]/g, "").trim();
    // Split on range separators (dash/en-dash/to/bis) then extract all positive integers.
    // "5-60"   → ["5","60"]  → max 60   ✓
    // "-10-80" → ["-10","80"] split → keep 10,80 → max 80  ✓
    // "-10 to 80" → same → max 80  ✓
    const parts = s.split(/(?:\s+to\s+|\s+bis\s+|[–—]|\s*-\s*(?=\d))/i);
    const positiveNums = parts.flatMap(p => (p.match(/\d+(?:\.\d+)?/g) ?? [])).map(parseFloat);
    if (positiveNums.length > 0) return Math.max(...positiveNums);
  }
  return 0; // unknown — do not block
}

/**
 * Extract the highest temperature requirement from description + answers.
 * Returns 0 if no temperature mentioned or below standard threshold (80°C).
 * We use 80°C as threshold because standard NBR seals are rated to ~80°C;
 * anything above warrants a spec check.
 */
export function extractRequiredMaxTemp(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const matches = [...allText.matchAll(/(\d{2,3})\s*°?\s*[cC]\b/gi)].map(m => parseInt(m[1]));
  const grad = allText.match(/(\d{2,3})\s*grad/i);
  if (grad) matches.push(parseInt(grad[1]));
  const relevant = matches.filter(t => t > 80 && t < 1200);
  return relevant.length > 0 ? Math.max(...relevant) : 0;
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
  if (maxFound > 0) return maxFound;
  const rangeMatch = allText.match(/(\d+)[–—\-](\d+)\s*mm/);
  if (rangeMatch) return parseInt(rangeMatch[2]);
  if (/> 500|mer.{0,5}500/i.test(allText)) return 500;
  if (/300.{0,5}500/i.test(allText)) return 300;
  if (/150.{0,5}300/i.test(allText)) return 150;
  if (/50.{0,5}150/i.test(allText)) return 50;
  return 0;
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
  if (/\b[xyz][-_\s]?ax(el|is|e)|\bxyz\b|\b[xyz]\s*[\/-]\s*[xyz]\b|två axl|två rörel|horisontell.*vertikal|vertikal.*horisontell|pick.and.place|pick.*place|plocka.*placera|plocka.*flytta|lyfter.*flytta|flytta.*lyft|2-axl|2 axl|multi.*axl|cartesian|portalsystem|lyfter.*flyttar|lyfter.*och.*flyttar/i.test(text)) return true;

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
export function needsVerticalLoad(text: string): boolean {
  return /\blyft|\bhissa\b|\bhäng.*last\b|\blast.*häng\b|\bvertikal|\bcylinder.*vertikal\b|\bz[.-]?axel\b|\bz[.-]?axis\b|\bpress.*ner\b|\bpress.*ned\b|\bnedåt\b|\buppåt\b|\bvertical.*load\b|\bhanging.*load\b|\bsuspended.*load\b|\blifting.*cyl\b|\bcylinder.*lyft\b|\bz[.-]?achse\b|\bheben\b|\bhebt\b|\bhängende\s?last\b|\bnach\s?unten\b|\bnach\s?oben\b|\belevar\b|\blevantar\b|\bcarga\s?suspendida\b|\bcarga\s?colgante\b|\beje\s?z\b|\bhacia\s?abajo\b|\bhacia\s?arriba\b/i.test(text);
}

/** High temperature environment (>80°C). Standard NBR seals fail — need PTFE/FKM/HT variants. */
export function needsHighTemp(text: string): boolean {
  return /\bugn\b|\bfornace\b|\bautoklav\b|\bsteam\b|\bånga\b|\bvulk\b|\bsintr\b|\bsmält\b|\bhög.*temp\b|\bhigh.*temp\b|\bvarm.*milj\b|\bhet.*milj\b|\b[89]\d\s*°?\s*[cC]\b|\b1[0-9]\d\s*°?\s*[cC]\b|\b200\s*°?\s*[cC]\b|\bhögtemperatur\b|\bheat.*treat\b|\bvärmebehandl\b|\bofen\b|\bautoklav\w*\b|\bdampf\b|\bhohe\s?temperatur\b|\bheiße\s?umgebung\b|\bwärmebehandl\w*\b|\bgeschmolzen\b|\bhorno\b|\bvapor\b|\balta\s?temperatura\b|\bambiente\s?caliente\b|\btratamiento\s?térmico\b|\bfundido\b/i.test(text);
}

/** Low temperature environment (<-10°C). Standard seals crack/harden — need LT/FKM variants. */
export function needsLowTemp(text: string): boolean {
  return /\bfrys\b|\bfrysrum\b|\bkylanläggn\b|\bcold.*room\b|\bcold.*stor\b|\bkylrum\b|\bcryogen\b|\bdjupfrys\b|\bfryscell\b|\bkyla.*milj\b|\b-[1-9]\d\s*°?\s*[cC]\b|\b-\s*[1-9]\d\s*°?\s*[cC]\b|\bbelow.*freez\b|\bsubzero\b|\bfrost.*milj\b|\bgefrier\w*\b|\btiefkühl\w*\b|\bkühlraum\b|\bkälteanlage\b|\bkryogen\w*\b|\bcongelador\b|\bcámara\s?frigorífica\b|\bsala\s?fría\b|\bcriogénic\w*\b/i.test(text);
}

/** Hydraulic application — entirely different product family (100–350 bar oil). NOT in pneumatic catalog. */
export function isHydraulicApplication(text: string): boolean {
  return /\bhydraulisk\b|\bhydraulic\b|\bhydraul\b|\bolje.*cylinder\b|\bcylinder.*olja\b|\bolje.*tryck\b|\bhydro.*cyl\b|\bhydro.*press\b|\bhydraulisch\w*\b|\bölzylinder\b|\böldruck\b|\bhidráulic\w*\b|\bcilindro\s?hidráulico\b|\bpresión\s?de\s?aceite\b/i.test(text);
}

/** Force requirement that likely exceeds pneumatic capability (>8 000 N at reasonable bore/pressure). */
export function needsVeryHighForce(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.values(answers).join(" ");
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
  const allText = text + " " + Object.values(answers).join(" ");
  return /\b[6-9]\d\s*(?:cyk|slag|cykel|cyc|stroke|takt).*(?:min|s)\b|\b1[0-9]\d\s*(?:cyk|slag|cykel|cyc|stroke|takt)\b|\bhög.*frekvens\b|\bhigh.*freq\b|\bhigh.*cycle\b|\bsnabb.*takt\b|\brapid.*cycling\b|\bfastcycl\b|\bhohe\s?frequenz\b|\bschneller?\s?takt\b|\balta\s?frecuencia\b|\bciclo\s?rápido\b/i.test(allText);
}

/** High speed > 1 m/s without deceleration control — end-stop impact damage. */
export function needsHighSpeed(text: string, answers: Record<string, string>): boolean {
  const allText = text + " " + Object.values(answers).join(" ");
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
  return /\bdryroom\b|\bdry\s*room\b|\btorrkammare\b|\blitiumjon\b|\blithium[-\s]?ion\b|\bli[-\s]?ion\b|\bbatterifabrik\b|\bbattery\s*(?:manufactur|produc|cell|fabrik)\b|\bbatteriproduk\b|\bbattericell\b|\bkatod(?:material)?\w*\b|\banod(?:material)?\w*\b|\belektrod(?:material)?\w*\b|\belectrode\b|\bpouch\s*cell\b|\blitiumbatteri\b|\bcell\s*monter\b|\bcu\/zn\/ni\b|\bkoppar.*zink.*nickel\b|\btrockenraum\b|\blithium[-\s]?ionen\b|\bbatteriefertigung\b|\bbatterieproduktion\b|\bsala\s?seca\b|\blitio[-\s]?ion\b|\bproducción\s?de\s?baterías\b|\bcátodo\w*\b|\bánodo\w*\b|\belectrodo\w*\b/i.test(text);
}

/** Extract numeric speed in m/s from free text + answers (for mechanism compatibility check). */
export function extractSpeedMs(text: string, answers: Record<string, string>): number {
  const all = text + " " + Object.values(answers).join(" ");
  // Match e.g. "1.2 m/s", "0,8m/s", "800 mm/s"
  const msMatch = all.match(/(\d+(?:[.,]\d+)?)\s*m\/s/i);
  if (msMatch) return parseFloat(msMatch[1].replace(",", "."));
  const mmMatch = all.match(/(\d+(?:[.,]\d+)?)\s*mm\/s/i);
  if (mmMatch) return parseFloat(mmMatch[1].replace(",", ".")) / 1000;
  return 0;
}

/**
 * Extract precision requirement (mm) from free text + answers.
 * Handles: "±0.02 mm", "0.1mm precision", "repeterbarhet ±0.003mm", "20µm", "50 mikrometer"
 * Returns 0 if not found (unknown → do not apply precision filter).
 */
export function extractPrecisionMm(text: string, answers: Record<string, string>): number {
  const all = text + " " + Object.values(answers).join(" ");
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
  return /stångbroms|stång.?lås|rod.?lock|mekaniskt?\s+lås|fallskydd|spring.?applied|hållbroms|broms.*(strömavbrott|nödstopp|luftbortfall)|inte\s+fall(a|er)\s+(ner|ned)|får\s+inte\s+falla|kolbenstangenbremse|mechanische\s?verriegelung|mechanisches\s?schloss|absturzsicherung|darf\s?nicht\s?fallen|freno\s?de\s?vástago|bloqueo\s?mecánico|no\s?debe\s?caer|no\s?puede\s?caer/i.test(text);
}

/**
 * Detects washdown / food-grade / wet-environment requirements.
 * These applications require IP67/IP69K and stainless or food-grade plastic —
 * standard aluminum cylinders will corrode immediately.
 */
export function needsWashdown(text: string): boolean {
  return /washdown|wash[-\s]down|livsmedel|food[-\s]grade|food[-\s]safe|mejeri|dairy|slakteri|slakter|livsmedelsgodkänd|livsmedelsgodkand|ip[-\s]?69|högtrycksspolning|högtryck.*spol|spol.*kemik|kemisk.*reng|cip\b|sip\b|hygienic|hygienisk|clean[-\s]design|cleandesign|rostfri|stainless|korrosionsskyddad|vätsk.*milj|blot.*milj|kemikalie|frätande|korrosiv|korrosion|\bsyra\b|syrabeständig|aggressiva?\s+(medier|vätskor|kemikalier)|lebensmittel\w*|molkerei|schlachthof|edelstahl|rostfrei\w*|hochdruckreinig\w*|chemikalie\w*|ätzend\w*|\bsäure\b|säurebeständig\w*|\balimentos?\b|grado\s?alimentici\w*|lácte\w*|matadero|acero\s?inoxidable|limpieza\s?a\s?alta\s?presión|químic\w*|corrosiv\w*|\bácido\b/i.test(text);
}

/** Returns true if the user requested end-position / stroke-end detection (sensors). */
export function needsEndPositionDetection(text: string): boolean {
  return /detekt|givare|sensor|ändläge|end.pos|end.stop|stroke.end|reed|proximity|närhets|position.*detect|detect.*position|elektron.*detekt|signalera|signal.*läge|läges.*signal|kontrollera.*läge|läge.*kontroll|home.*detect|detect.*home|smcm|smc.*sensor|piston.*sens/i.test(text);
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

/** Returns true if user wants mounting brackets / foot mounts / flanges. */
export function needsMounting(text: string): boolean {
  return /fotfäste|foot.*mount|fot.*fäste|flansfäste|flange.*mount|monteringsfäste|bracket|montering|montage|fäste|befästning|konsol|mounting|swivel.*flange|trunnion/i.test(text);
}

/**
 * Calculate minimum required bore (mm) from load (kg) at given pressure (bar).
 * Uses F = P × A formula with safety factor 2.
 */
export function calcMinBoreMm(loadKg: number, pressureBar = 6): number {
  if (loadKg <= 0) return 0;
  const forceN = loadKg * 9.81 * 2; // safety factor 2
  const areaMm2 = (forceN / (pressureBar * 0.1)); // bar→N/mm²
  return Math.ceil(2 * Math.sqrt(areaMm2 / Math.PI));
}

/** Extract mass/load in kg from free text + answers. */
export function extractLoadKg(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const kgMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kgMatch) return parseFloat(kgMatch[1].replace(",", "."));
  const nMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*N\b/);
  if (nMatch) return parseFloat(nMatch[1].replace(",", ".")) / 9.81;
  return 0;
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
 */
export function extractGripForceN(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const m = allText.match(/(?:greppkraft|gripkraft|klämkraft|klamkraft|grip(?:ping)?\s*force|clamping\s*force|greifkraft|klemmkraft|fuerza\s*de\s*agarre|fuerza\s*de\s*sujeci[oó]n)[^\d]{0,10}(\d+(?:[.,]\d+)?)\s*N\b/i)
    || allText.match(/(\d+(?:[.,]\d+)?)\s*N\b[^\d]{0,15}(?:greppkraft|gripkraft|klämkraft|klamkraft|grip(?:ping)?\s*force|clamping\s*force|greifkraft|klemmkraft)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

/**
 * Explicitly stated holding force (N) for a vacuum-cup request -- e.g.
 * "hållkraft 50N", "holding force 50N". Same fix as extractGripForceN, for
 * the vacuum branch's ×9.81×2 weight-to-force derivation.
 */
export function extractHoldingForceN(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const m = allText.match(/(?:håll[-\s]?kraft|hallkraft|hold(?:ing)?\s*force|haltekraft|fuerza\s*de\s*(?:sujeci[oó]n|retenci[oó]n))[^\d]{0,10}(\d+(?:[.,]\d+)?)\s*N\b/i)
    || allText.match(/(\d+(?:[.,]\d+)?)\s*N\b[^\d]{0,15}(?:håll[-\s]?kraft|hallkraft|hold(?:ing)?\s*force|haltekraft)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

export function extractTorqueNm(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const m = allText.match(/(\d+(?:[.,]\d+)?)\s*Nm\b/i);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

/** Extract required rotation angle (degrees) for a rotary-actuator request. */
export function extractRotationDeg(text: string, answers: Record<string, string>): number {
  const allText = text + " " + Object.values(answers).join(" ");
  const m = allText.match(/(\d{2,3})\s*(?:°|grad(?:er)?|degrees?)\b/i);
  return m ? parseFloat(m[1]) : 0;
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

export function needsLowCost(text: string): boolean {
  return /\blåg\s*kostnad\b|\bbillig\w*\b|\bkostnadseffektiv\w*\b|\bbudget\b|\blow[\s-]?cost\b|\bcheap\b|\bcost[\s-]?effective\b|\bminimera\s*kostnad/i.test(text);
}

export function needsContinuousDuty(text: string): boolean {
  return /\b24\s*\/?\s*7\b|\bdygnet\s*runt\b|\bkontinuerlig\w*\s*drift\b|\bcontinuous\s*(?:duty|operation)\b|\bnon[\s-]?stop\b|\b3[\s-]?skift\b/i.test(text);
}

export function needsDirtyEnv(text: string): boolean {
  return /\bdamm\w*\b|\bdust\w*\b|\bolja\b|\boil\w*\b|\bsmuts\w*\b|\bdirty\b|\bspån\b|\bchips\b|\bkylvätska\b|\bcoolant\b|\bpartik\w*\b|\bcontaminat/i.test(text);
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
  const gripperAsk = /gripdon|parallellgripare|vinkelgripare|griparback|\bgripper\b|\bgripare\b|klämback|gripa\s+(och|tag|fast|om)|griper\s+(om|fast|tag|och)/i.test(t);
  // Fragile, flat parts imply vacuum even without the word (glass / PCB / thin sheet).
  const fragileFlat = /\bglas\b|glasskiv|\bwafer\b|kretskort|\bpcb\b|tunn(a|t)?\s*pl(å|a)t|folie|laminat|solcell|\bdisplay\b|\blins(er)?\b/i.test(t)
                      && /plock|lyft|grepp|gripa|hanter|flytta/i.test(t);
  if (vacuumAsk) return "vacuum";
  if (gripperAsk) return "gripper";
  if (fragileFlat) return "vacuum";
  return null;
}

/**
 * Food-grade / food-industry material or lubrication requirement (NSF-H1,
 * EHEDG, direct food contact). Consolidates two regexes that had drifted
 * apart across two call sites in index.ts (handleQuestions vs. handleOptions)
 * -- this is their union, verbatim (the handleQuestions version was already
 * the superset: it additionally matched nsf/h1).
 */
export function needsFoodGrade(text: string): boolean {
  return /livsmedel|food|slakteri|chark|mejeri|kött|meat|poultry|fjäderfä|dairy|fisk|fish|bageri|brewery|nsf|h1\b/i.test(text);
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
  torqueNm: number;
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
  const speedMs = extractSpeedMs(text, answers);
  const precisionMm = extractPrecisionMm(text, answers);
  const isHighPrecision = precisionMm > 0 && precisionMm <= 0.1;
  const explicitBoreMm = extractExplicitBoreMm(text, answers);
  const loadKg = extractLoadKg(text, answers);
  const minBoreMm = calcMinBoreMm(loadKg);
  const gripForceN = extractGripForceN(text, answers);
  const holdingForceN = extractHoldingForceN(text, answers);
  const torqueNm = extractTorqueNm(text, answers);
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
    isFoodGrade, isBatteryDryroom, isRodLock, isWashdown, isEndPosDetect, isArticulated,
    isMounting, isLowCost, is24x7, isDirtyEnv, isHighPrecision, minBoreMm,
    requiredMaxTempC, minStrokeMm, perAxisStrokes, requiredStrokeMm, speedMs, precisionMm,
    explicitBoreMm, loadKg, gripForceN, holdingForceN, torqueNm, rotationDeg, cycleTimeS,
    dynamics, conflicts,
  };
}

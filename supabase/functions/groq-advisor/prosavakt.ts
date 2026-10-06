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

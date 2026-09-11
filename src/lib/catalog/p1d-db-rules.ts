/**
 * P1D-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Samma uppdelning som DSBC fick, och av samma skäl: en översättning av
 * modellen till JSON-logik kan vara fel oberoende av att källan är rätt, så
 * översättningen måste gå att testa. p1d.test.ts kör de här raderna genom
 * samma evalLogic som produktionen och jämför utfallet mot P1D_RULES.
 *
 * P1D har inga varianter i DSBC:s mening -- det finns en enda beställnyckel --
 * så reglerna behöver ingen variantvakt. Det som skiljer utförandena åt
 * (låsenhet, ren design) står i positionerna och därmed i villkoren.
 */
import { P1D_BORES, P1D_POSITIONS, P1D_RULES } from "./p1d";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type P1dDbRule = DsbcDbRule;

export function buildP1dDbRules(): P1dDbRule[] {
  const rows: P1dDbRule[] = P1D_RULES.map((r) => ({
    severity: r.severity,
    if_json: r.when,
    message_sv: r.message_sv,
    message_en: r.message_en,
    goto_step: r.note,
  }));

  // Slagintervallet. Katalogen: 1-2800 mm.
  const stroke = P1D_POSITIONS.find((p) => p.key === "stroke_mm")!.range!;
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { ">": [{ var: "stroke_mm" }, 0] },
        {
          or: [
            { "<": [{ var: "stroke_mm" }, stroke.min] },
            { ">": [{ var: "stroke_mm" }, stroke.max] },
          ],
        },
      ],
    },
    message_sv: `Slaglängden måste vara ${stroke.min}–${stroke.max} mm.`,
    message_en: `Stroke must be ${stroke.min}–${stroke.max} mm.`,
    goto_step: "p1d-slag",
  });

  // Borrningen. Listan är sluten -- Parker bygger inga mellanstorlekar.
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { "!=": [{ var: "bore_mm" }, ""] },
        { not: { in: [{ var: "bore_mm" }, P1D_BORES.map((n) => String(n).padStart(3, "0"))] } },
      ],
    },
    message_sv: `P1D finns i Ø${P1D_BORES.join(", ")} mm.`,
    message_en: `P1D is available in Ø${P1D_BORES.join(", ")} mm.`,
    goto_step: "p1d-storlek",
  });

  return rows;
}

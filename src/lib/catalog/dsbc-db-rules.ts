/**
 * Reglerna som skrivs till config_rules, byggda ur variantmodellen.
 *
 * Bruten ur generatorskriptet för att kunna TESTAS. Reglerna är en
 * översättning av modellen till den JSON-logik configurator-engine kör, och en
 * översättning kan vara fel oberoende av att källan är rätt -- mallen i PR #190
 * var korrekt härledd och tappade ändå 15 av 21 positioner.
 *
 * dsbc.test.ts kör de här reglerna genom samma evalLogic som produktionen och
 * jämför utfallet mot validateDsbc() för hela facit. Går de isär failar bygget.
 */
import { DSBC_POSITIONS, DSBC_VARIANTS } from "./dsbc";

export interface DsbcDbRule {
  severity: string;
  if_json: Record<string, unknown>;
  message_sv: string;
  message_en: string;
  goto_step: string | null;
}

export function buildDsbcDbRules(): DsbcDbRule[] {
  // Reglerna för databasen byggs ur ALLA fyra varianterna, var och en vaktad av
  // den position som definierar tabellen. Det matchar hur den riktiga
  // beställnyckeln fungerar: varianten framgår av vilka optioner som valts, inte
  // av ett eget fält.
  //
  // Utan vakterna skulle bastabellens villkor köras på en klämenhetskonfiguration
  // och tvärtom -- vilket var precis läget innan varianterna modellerades.

  /**
 * Villkoret som identifierar varianten.
 *
 * Konfiguratorn räknar ut `variant` en gång med variantOf() och skickar den i
 * kontexten. Alternativet -- att upprepa "clamping != C och end_lock inte i
 * [E1,E2,E3] och material != F1A" i var och en av de 63 reglerna -- gjorde
 * halva regeldatan till samma villkor om och om igen, och var oläsbart för den
 * som ska granska en regel.
 */
function guardFor(id: string): Record<string, unknown> {
  return { "==": [{ var: "variant" }, id] };
}

const withGuard = (id: string, when: Record<string, unknown>) => {
    const g = guardFor(id);
    return g ? { and: [g, when] } : when;
  };

  /** Sant när positionen har ett värde -- olika för tal och koder. */
  const isSet = (key: string, numeric: boolean) =>
    numeric ? { ">": [{ var: key }, 0] } : { "!=": [{ var: key }, ""] };

  const ruleRows: DsbcDbRule[] = [];

  for (const v of DSBC_VARIANTS) {
    const offered = new Map(v.positions.map((p) => [p.key, p]));

    // Tabellens egna fotnoter.
    for (const r of v.rules) {
      ruleRows.push({
        severity: r.severity,
        if_json: withGuard(v.id, r.when),
        message_sv: r.message_sv,
        message_en: r.message_en,
        goto_step: r.note,
      });
    }

    // Slagintervallet skiljer sig mellan tabellerna (1-2800 mot 10-2000).
    ruleRows.push({
      severity: "error",
      if_json: withGuard(v.id, {
        and: [
          isSet("stroke_mm", true),
          { or: [{ "<": [{ var: "stroke_mm" }, v.stroke.min] }, { ">": [{ var: "stroke_mm" }, v.stroke.max] }] },
        ],
      }),
      message_sv: `Slaglängden måste vara ${v.stroke.min}–${v.stroke.max} mm i utförandet "${v.label_sv}".`,
      message_en: `Stroke must be ${v.stroke.min}–${v.stroke.max} mm for "${v.label_en}".`,
      goto_step: `${v.id}-slag`,
    });

    // Storlekar tabellen inte listar (ändlägeslåsning saknar t.ex. Ø125).
    const missingBores = DSBC_POSITIONS.find((p) => p.key === "bore_mm")!
      .values!.map((x) => x.code).filter((b) => !v.bores.includes(b));
    if (missingBores.length > 0) {
      ruleRows.push({
        severity: "error",
        if_json: withGuard(v.id, { in: [{ var: "bore_mm" }, missingBores] }),
        message_sv: `Utförandet "${v.label_sv}" finns bara i Ø${v.bores.join(", ")} mm.`,
        message_en: `"${v.label_en}" is only available in Ø${v.bores.join(", ")} mm.`,
        goto_step: `${v.id}-storlek`,
      });
    }

    for (const pos of DSBC_POSITIONS) {
      const spec = offered.get(pos.key);
      const numeric = pos.values === null;

      // Positioner tabellen inte erbjuder. De tre som definierar en ANNAN
      // variant hoppas över -- de byter tabell i stället för att vara fel.
      if (!spec) {
        if (["clamping", "end_lock", "material", "bore_mm", "stroke_mm"].includes(pos.key)) continue;
        ruleRows.push({
          severity: "error",
          if_json: withGuard(v.id, isSet(pos.key, numeric)),
          message_sv: `${pos.label_sv} erbjuds inte i utförandet "${v.label_sv}".`,
          message_en: `${pos.label_en} is not offered for "${v.label_en}".`,
          goto_step: `${v.id}-${pos.key}`,
        });
        continue;
      }

      // Tabeller som erbjuder färre värden än ordlistan (ändlägeslåsning har
      // bara P och PPV, inte självjusterande PPS).
      if (spec.values && pos.values) {
        const disallowed = pos.values.map((x) => x.code).filter((c) => c && !spec.values!.includes(c));
        if (disallowed.length > 0) {
          ruleRows.push({
            severity: "error",
            if_json: withGuard(v.id, { in: [{ var: pos.key }, disallowed] }),
            message_sv: `${pos.label_sv} i utförandet "${v.label_sv}" kan bara vara ${spec.values.join(" eller ")}.`,
            message_en: `${pos.label_en} for "${v.label_en}" can only be ${spec.values.join(" or ")}.`,
            goto_step: `${v.id}-${pos.key}-varden`,
          });
        }
      }
    }
  }

  // De två bevarade råden ur den gamla regeluppsättningen, omskrivna till
  // körbar JSON-logik.
  ruleRows.push({
    severity: "warn",
    if_json: { and: [{ "==": [{ var: "cushioning" }, "P"] }, { ">": [{ var: "speed_ms" }, 0.3] }] },
    message_sv: "Elastisk dämpning P är avsedd för låga hastigheter (<0,3 m/s). Välj PPV eller PPS.",
    message_en: "Elastic cushioning P is intended for low speeds (<0.3 m/s). Choose PPV or PPS.",
    goto_step: null,
  });
  ruleRows.push({
    severity: "info",
    if_json: { ">=": [{ var: "bore_mm" }, 80] },
    message_sv: "Ø80 mm och uppåt: kontrollera portdimension G3/4 och flödesventilernas dimensionering.",
    message_en: "Ø80 mm and above: check port size G3/4 and flow valve sizing.",
    goto_step: null,
  });


  return ruleRows;
}

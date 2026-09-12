/**
 * CCIV-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Samma uppdelning som DSBC, P1D och ELEKTRO: översättningen till JSON-logik
 * kan vara fel oberoende av att källan är rätt, så den måste gå att testa.
 * `cciv-db-rules.test.ts` kör raderna genom samma evalLogic som produktionen
 * och jämför utfallet mot `ccivBuildCode`.
 *
 * CCIV:s nyckel har inga nästade tabeller som ELEKTRO:s. Begränsningarna är
 * tre fotnoter, och två av dem pekar åt samma håll: de små borrningarna har
 * rostfri kolvstång och tar inte ISO-centrumavstånd.
 */
import {
  CCIV_BORES,
  CCIV_DEFAULT_MAGNET,
  CCIV_LIMITS,
  CCIV_STROKE_MIN_MM,
  CCIV_TYPES,
  ccivMaterialsForBore,
  ccivTypesForBore,
} from "./cciv";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type CcivDbRule = DsbcDbRule;

/** Borrningskoder som tar ISO-centrumavstånd och kolvstång i C45. */
const STORA = CCIV_BORES.filter((b) => b.bore_mm >= 32).map((b) => b.code);
const SMA = CCIV_BORES.filter((b) => b.bore_mm < 32).map((b) => b.code);

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}

export function buildCcivDbRules(): CcivDbRule[] {
  const rows: CcivDbRule[] = [];
  const isoTyper = CCIV_TYPES.filter((t) => t.only_large_bores).map((t) => t.code);
  const storaMm = CCIV_BORES.filter((b) => b.bore_mm >= 32).map((b) => `Ø${b.bore_mm}`);
  const smaMm = CCIV_BORES.filter((b) => b.bore_mm < 32).map((b) => `Ø${b.bore_mm}`);

  // ── ISO-centrumavstånd bara på de stora ────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { in: [{ var: "type" }, isoTyper] },
        { in: [{ var: "bore" }, SMA] },
      ],
    },
    message_sv: `ISO-centrumavstånd (typ ${lista(isoTyper)}) finns bara för ` +
      `${lista(storaMm)}. ${lista(smaMm)} har UNITOP-centrumavstånd.`,
    message_en: `ISO centre distances (type ${lista(isoTyper, "and")}) are only ` +
      `available for ${lista(storaMm, "and")}. ${lista(smaMm, "and")} use UNITOP.`,
    goto_step: "cciv-typ",
  });

  // ── Kolvstång i C45 bara på de stora ──────────────────────────────────────
  //
  // Två fotnoter säger samma sak från var sitt håll: ■ på materialet C
  // ("endast Ø32 och 40") och ▲ på borrningarna 20 och 25 ("rostfri
  // kolvstång"). De små borrningarna byggs helt enkelt med rostfri stång.
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { "==": [{ var: "material" }, "C"] },
        { in: [{ var: "bore" }, SMA] },
      ],
    },
    message_sv: `${lista(smaMm)} har alltid rostfri kolvstång. Hårdförkromat ` +
      `C45 finns bara för ${lista(storaMm)}.`,
    message_en: `${lista(smaMm, "and")} always come with a stainless piston rod. ` +
      `Chromium-plated C45 is only available for ${lista(storaMm, "and")}.`,
    goto_step: "cciv-material",
  });

  // ── Slaglängd per borrning ────────────────────────────────────────────────
  for (const b of CCIV_BORES) {
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "bore" }, b.code] },
          { ">": [{ var: "stroke_mm" }, b.stroke_max_mm] },
        ],
      },
      message_sv: `Ø${b.bore_mm} går till ${b.stroke_max_mm} mm slaglängd.`,
      message_en: `Ø${b.bore_mm} goes up to ${b.stroke_max_mm} mm stroke.`,
      goto_step: "cciv-slag",
    });

    // Utanför standardsortimentet är inte ett fel -- men det är en
    // leveranstid, och den bör kunden få veta om innan hen beställer.
    rows.push({
      severity: "warn",
      if_json: {
        and: [
          { "==": [{ var: "bore" }, b.code] },
          { ">": [{ var: "stroke_mm" }, b.stroke_standard_max_mm] },
          { "<=": [{ var: "stroke_mm" }, b.stroke_max_mm] },
        ],
      },
      message_sv: `Standardslagen för Ø${b.bore_mm} är ${CCIV_STROKE_MIN_MM}–` +
        `${b.stroke_standard_max_mm} mm. Längre slag går att beställa upp till ` +
        `${b.stroke_max_mm} mm men är inte lagervara.`,
      message_en: `Standard strokes for Ø${b.bore_mm} are ${CCIV_STROKE_MIN_MM}–` +
        `${b.stroke_standard_max_mm} mm. Longer strokes can be ordered up to ` +
        `${b.stroke_max_mm} mm but are not stocked.`,
      goto_step: "cciv-slag",
    });
  }

  rows.push({
    severity: "error",
    if_json: {
      and: [
        { ">": [{ var: "stroke_mm" }, 0] },
        { "<": [{ var: "stroke_mm" }, CCIV_STROKE_MIN_MM] },
      ],
    },
    message_sv: `Minsta slaglängd är ${CCIV_STROKE_MIN_MM} mm.`,
    message_en: `Minimum stroke is ${CCIV_STROKE_MIN_MM} mm.`,
    goto_step: "cciv-slag",
  });

  // ── Stick-slip ────────────────────────────────────────────────────────────
  //
  // Katalogens not: "For speeds lower than 0.2 m/s to prevent surging, use the
  // version No stick-slip and non-lubricated air." Det är ett råd som är värt
  // pengar -- en cylinder som rycker vid låg hastighet ser ut som ett fel i
  // maskinen, inte som ett felval i beställningen.
  for (const b of CCIV_BORES.filter((x) => CCIV_DEFAULT_MAGNET[x.code] === "G")) {
    rows.push({
      severity: "warn",
      if_json: {
        and: [
          { "==": [{ var: "bore" }, b.code] },
          { "!=": [{ var: "magnet" }, ""] },
          { "!=": [{ var: "magnet" }, "G"] },
        ],
      },
      message_sv: `För Ø${b.bore_mm} är utförandet utan stick-slip standard. ` +
        `Under ${CCIV_LIMITS.stick_slip_speed_ms} m/s rycker cylindern annars.`,
      message_en: `For Ø${b.bore_mm} the no-stick-slip version is standard. ` +
        `Below ${CCIV_LIMITS.stick_slip_speed_ms} m/s the cylinder will otherwise surge.`,
      goto_step: "cciv-magnet",
    });
  }

  // ── Kapslingsklassen ──────────────────────────────────────────────────────
  //
  // Plug-in ger IP51. Det räcker inte i våt miljö, och skillnaden syns inte i
  // kodens tecken -- den står i en helt annan tabell.
  rows.push({
    severity: "warn",
    if_json: { "==": [{ var: "connection" }, "2"] },
    message_sv: "Plug-in-kontakten ger IP51. Behövs mer, välj M8-kontakt, " +
      "som ger IP65.",
    message_en: "The plug-in connector gives IP51. If more is needed, choose " +
      "the M8 connector, which gives IP65.",
    goto_step: "cciv-kontakt",
  });

  return rows;
}

/** Vilka typer respektive material som går för en borrning — för migrationen. */
export const ccivAllowed = { types: ccivTypesForBore, materials: ccivMaterialsForBore };

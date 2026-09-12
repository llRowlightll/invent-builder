/**
 * ELEKTRO-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Samma uppdelning som DSBC och P1D fick: en översättning av modellen till
 * JSON-logik kan vara fel oberoende av att källan är rätt, så översättningen
 * måste gå att testa. `elektro-db-rules.test.ts` kör raderna genom samma
 * evalLogic som produktionen och jämför utfallet mot `elektroBuildCode`.
 *
 * DEN VIKTIGA REGELN ÄR KOMBINATIONSREGELN. ELEKTRO:s nyckel tillåter
 * 6 storlekar × 8 stigningar × 8 versioner × många drivgrupper, men
 * POSSIBLE ORDERING CODES listar bara en bråkdel. En kod som följer nyckeln
 * är alltså inte nödvändigtvis beställbar, och det är just den skillnaden
 * kunden inte kan se själv.
 *
 * Reglerna är avsiktligt uppdelade så att EN felaktig valkombination ger EN
 * begriplig rad, inte tre överlappande. Kombinationsregeln vaktas därför av
 * att stigning och version var för sig redan är giltiga för storleken.
 */
import {
  ELEKTRO_COMBOS,
  ELEKTRO_PITCHES,
  ELEKTRO_SIZES,
  elektroDrivePacks,
  elektroPitches,
  elektroVersions,
} from "./elektro";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type ElektroDbRule = DsbcDbRule;

/** Versionskoder med vridningsskyddad kolvstång. */
const VRIDSKYDD = ["2", "4", "6", "8"];

/** "4 eller 12", "5, 10 eller 16". En lista med komma ända ut läser illa. */
function lista(delar: Array<string | number>, sista = "eller"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}

function listaEn(delar: Array<string | number>, sista = "or"): string {
  return lista(delar, sista);
}

function stigningsText(koder: string[]): string {
  const mm = koder
    .map((k) => ELEKTRO_PITCHES.find((p) => p.code === k)!.pitch_mm)
    .sort((a, b) => a - b);
  return lista(mm);
}

function stigningsTextEn(koder: string[]): string {
  const mm = koder
    .map((k) => ELEKTRO_PITCHES.find((p) => p.code === k)!.pitch_mm)
    .sort((a, b) => a - b);
  return listaEn(mm);
}

function storleksText(s: { bore_mm: number; heavy_duty: boolean }): string {
  return `Ø${s.bore_mm}${s.heavy_duty ? " HD" : ""}`;
}

export function buildElektroDbRules(): ElektroDbRule[] {
  const rows: ElektroDbRule[] = [];

  for (const s of ELEKTRO_SIZES) {
    const stigningar = elektroPitches(s.code);
    const versioner = elektroVersions(s.code);
    const paket = elektroDrivePacks(s.code);
    const namn = storleksText(s);

    // ── stigningen ──────────────────────────────────────────────────────────
    // Varje storlek har sin egen uppsättning. Ø63 HD är den snävaste: bara
    // stigning 5 och 10 mm, enligt nyckelns ◆-fotnot.
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, s.code] },
          { "!=": [{ var: "pitch" }, ""] },
          { not: { in: [{ var: "pitch" }, stigningar] } },
        ],
      },
      message_sv: `${namn} finns bara med skruvstigning ${stigningsText(stigningar)} mm.`,
      message_en: `${namn} is only available with screw pitch ${stigningsTextEn(stigningar)} mm.`,
      goto_step: "elektro-stigning",
    });

    // ── versionen ───────────────────────────────────────────────────────────
    // Bara Ø80 och Ø100 är begränsade; de övriga tar alla åtta. En regel som
    // aldrig kan falla är brus, så den skrivs bara där den betyder något.
    if (versioner.length < 8) {
      rows.push({
        severity: "error",
        if_json: {
          and: [
            { "==": [{ var: "size" }, s.code] },
            { "!=": [{ var: "version" }, "" ] },
            { not: { in: [{ var: "version" }, versioner] } },
          ],
        },
        message_sv: `${namn} med motor finns bara i version ${lista(versioner)} ` +
          `— alltså alltid med kapslingsklass IP55/IP65.`,
        message_en: `${namn} with motor is only available in version ${listaEn(versioner)} ` +
          `— that is, always IP55/IP65.`,
        goto_step: "elektro-version",
      });
    }

    // ── drivgruppen ─────────────────────────────────────────────────────────
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, s.code] },
          { "!=": [{ var: "drive_pack" }, ""] },
          { not: { in: [{ var: "drive_pack" }, paket] } },
        ],
      },
      message_sv: `${namn} har inte den motorkombinationen. Katalogen listar ` +
        `${paket.length} stycken för den storleken.`,
      message_en: `${namn} does not offer that motor combination. The catalogue ` +
        `lists ${paket.length} for that size.`,
      goto_step: "elektro-motor",
    });

    // ── den nästade kombinationen ───────────────────────────────────────────
    //
    // Stigning, version och drivgrupp kan var för sig vara giltiga för
    // storleken och ändå inte gå ihop. Ø32:s versioner 3/4/7/8 saknar
    // motorerna 1110, 1120 och 5120, som 1/2/5/6 har. Den skillnaden finns
    // inte i någon enskild lista -- bara i tabellens nästning.
    //
    // Villkoret är vaktat av att stigning och version redan är giltiga, så
    // ett felval där ger EN rad och inte tre.
    const combos = ELEKTRO_COMBOS[s.code];
    const grenar = combos.map((c) => ({
      and: [
        { in: [{ var: "pitch" }, c.pitches] },
        { in: [{ var: "version" }, c.versions] },
        { in: [{ var: "drive_pack" }, c.packs.map((p) => p.code)] },
      ],
    }));
    // Ø50 och Ø63 har EN grupp som täcker hela sin storlek. Då är grenen
    // identisk med vakten och regeln kan aldrig falla. En regel som inte kan
    // larma är brus i tabellen och en lögn för den som läser den.
    const nastad = combos.length > 1;
    if (nastad) rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, s.code] },
          { "!=": [{ var: "drive_pack" }, ""] },
          { in: [{ var: "pitch" }, stigningar] },
          { in: [{ var: "version" }, versioner] },
          { in: [{ var: "drive_pack" }, paket] },
          { not: { or: grenar } },
        ],
      },
      message_sv: `Den kombinationen av stigning, version och motor står inte i ` +
        `katalogens beställtabell för ${namn}. Varje del finns, men inte tillsammans.`,
      message_en: `That combination of pitch, version and motor is not in the ` +
        `catalogue's ordering table for ${namn}. Each part exists, but not together.`,
      goto_step: "elektro-motor",
    });

    // ── slaglängdens tak ────────────────────────────────────────────────────
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, s.code] },
          { ">": [{ var: "stroke_mm" }, s.stroke_max_mm] },
        ],
      },
      message_sv: `${namn} går till ${s.stroke_max_mm} mm slaglängd.`,
      message_en: `${namn} goes up to ${s.stroke_max_mm} mm stroke.`,
      goto_step: "elektro-slag",
    });

    // ── slaglängdens golv utan vridningsskydd ───────────────────────────────
    //
    // Katalogen anger skälet, och det är värt att skicka med: under den
    // längden går skruven inte att smörja om.
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, s.code] },
          { ">": [{ var: "stroke_mm" }, 0] },
          { "<": [{ var: "stroke_mm" }, s.stroke_min_free_mm] },
          { not: { in: [{ var: "version" }, VRIDSKYDD] } },
        ],
      },
      message_sv: `Utan vridningsskydd kräver ${namn} minst ${s.stroke_min_free_mm} mm ` +
        `slaglängd, för att skruven ska gå att smörja om.`,
      message_en: `Without the anti-rotation system ${namn} requires at least ` +
        `${s.stroke_min_free_mm} mm stroke, so the screw can be re-greased.`,
      goto_step: "elektro-slag",
    });
  }

  // ── slaglängdens golv MED vridningsskydd ──────────────────────────────────
  //
  // "Twice the screw pitch (to guarantee ball lubrication)" -- gäller alla
  // storlekar och beror bara på stigningen, så en regel per stigning räcker.
  for (const p of ELEKTRO_PITCHES) {
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "pitch" }, p.code] },
          { in: [{ var: "version" }, VRIDSKYDD] },
          { ">": [{ var: "stroke_mm" }, 0] },
          { "<": [{ var: "stroke_mm" }, 2 * p.pitch_mm] },
        ],
      },
      message_sv: `Med vridningsskydd och stigning ${p.pitch_mm} mm krävs minst ` +
        `${2 * p.pitch_mm} mm slaglängd, så kulorna hinner smörjas.`,
      message_en: `With the anti-rotation system and ${p.pitch_mm} mm pitch the ` +
        `stroke must be at least ${2 * p.pitch_mm} mm, to keep the balls lubricated.`,
      goto_step: "elektro-slag",
    });
  }

  // ── kolvstångens vridning ─────────────────────────────────────────────────
  //
  // Ett råd, inte ett fel. Katalogens N.B. är kategorisk: utan vridningsskydd
  // MÅSTE kolvstången hindras från att rotera av något annat. Det är den sorts
  // sak som kostar en cylinder om ingen säger det.
  rows.push({
    severity: "warn",
    if_json: {
      and: [
        { "!=": [{ var: "version" }, ""] },
        { not: { in: [{ var: "version" }, VRIDSKYDD] } },
      ],
    },
    message_sv: "Utan inbyggt vridningsskydd måste kolvstången hindras från att " +
      "rotera av konstruktionen — en fläns, ett fäste eller lasten själv. " +
      "Roterar den fritt förstörs skruven.",
    message_en: "Without the built-in anti-rotation system the piston rod must be " +
      "prevented from rotating by the design — a flange, a mounting or the load " +
      "itself. If it turns freely the screw is destroyed.",
    goto_step: "elektro-version",
  });

  return rows;
}

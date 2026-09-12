/**
 * EPCO-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Katalogens fem fotnoter är det mesta av innehållet, och de är av ett slag
 * som är lätt att missa: de säger inte "det här finns inte" utan "det här
 * MÅSTE väljas med". En EPCO utan pulsgivare och utan positionsavkänning är
 * inte en billigare EPCO -- den går inte att beställa.
 *
 * `epco-db-rules.test.ts` kör raderna genom samma evalLogic som produktionen
 * och jämför utfallet mot `epcoBuildCode`.
 */
import { EPCO_SIZES, EPCO_SPINDLES } from "./epco";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type EpcoDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}

export function buildEpcoDbRules(): EpcoDbRule[] {
  const rows: EpcoDbRule[] = [];

  for (const s of EPCO_SIZES) {
    // TALEN SKA VARA TAL. buildRuleContext gör om stroke_mm till ett Number,
    // och evalLogics `in` använder Array.includes -- alltså strikt jämförelse.
    // Med strängar i listan är 100 aldrig lika med "100", och regeln larmar
    // för varje giltigt slag. Exakt samma fälla som P1D:s borrning, där
    // regeln jämförde mot "80" medan konfiguratorn skickade "080".
    const slag = s.strokes;
    const stigningar = s.pitches;

    // ── slaglängden är en lista, inte ett intervall ──────────────────────────
    //
    // Databasen tillät 1-3000 mm. Katalogen har elva diskreta värden, och
    // 110 mm är inte ett av dem hur rimligt det än låter.
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, String(s.size)] },
          // Vakten är "> 0", inte "!= tomt". Fältet är numeriskt, så en tom
          // ruta blir Number("") = 0 -- och 0 är inte lika med "", vilket
          // betyder att en tom-sträng-vakt släpper igenom och larmar på en
          // halvifylld sida.
          { ">": [{ var: "stroke_mm" }, 0] },
          { not: { in: [{ var: "stroke_mm" }, slag] } },
        ],
      },
      message_sv: `Storlek ${s.size} finns i slaglängderna ${lista(s.strokes)} mm. ` +
        `Mellanlängder tillverkas inte.`,
      message_en: `Size ${s.size} is available in strokes ${lista(s.strokes, "and")} mm. ` +
        `Intermediate lengths are not made.`,
      goto_step: "epco-slag",
    });

    // ── stigningen är storleksberoende ──────────────────────────────────────
    const mm = stigningar.map((p) => EPCO_SPINDLES.find((x) => x.size === s.size && x.code === p)!.pitch_mm);
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, String(s.size)] },
          { "!=": [{ var: "pitch" }, ""] },
          { not: { in: [{ var: "pitch" }, stigningar] } },
        ],
      },
      message_sv: `Storlek ${s.size} finns med skruvstigning ${lista(mm)} mm.`,
      message_en: `Size ${s.size} is available with spindle pitch ${lista(mm, "and")} mm.`,
      goto_step: "epco-stigning",
    });

    // ── kolvstångsförlängningen ─────────────────────────────────────────────
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, String(s.size)] },
          { ">": [{ var: "extension_mm" }, s.extension_max_mm] },
        ],
      },
      message_sv: `Kolvstångsförlängningen för storlek ${s.size} går till ` +
        `${s.extension_max_mm} mm.`,
      message_en: `The piston rod extension for size ${s.size} goes up to ` +
        `${s.extension_max_mm} mm.`,
      goto_step: "epco-forlangning",
    });

    // ── ett råd om nyttolast ────────────────────────────────────────────────
    //
    // Den snabba skruven bär en bråkdel av vad den långsamma gör, och
    // skillnaden är stor nog att överraska: storlek 16 går från 24 till 8 kg
    // horisontellt när man byter till 8 mm stigning.
    const langsam = EPCO_SPINDLES.filter((x) => x.size === s.size)
      .reduce((a, b) => (a.pitch_mm < b.pitch_mm ? a : b));
    const snabb = EPCO_SPINDLES.filter((x) => x.size === s.size)
      .reduce((a, b) => (a.pitch_mm > b.pitch_mm ? a : b));
    rows.push({
      severity: "info",
      if_json: {
        and: [
          { "==": [{ var: "size" }, String(s.size)] },
          { "==": [{ var: "pitch" }, snabb.code] },
        ],
      },
      message_sv: `Med ${snabb.pitch_mm} mm stigning går storlek ${s.size} ` +
        `${snabb.speed_max_mms} mm/s men bär ${snabb.payload_horizontal_kg} kg ` +
        `horisontellt och ${snabb.payload_vertical_kg} kg vertikalt. ` +
        `Med ${langsam.pitch_mm} mm blir det ${langsam.payload_horizontal_kg} kg ` +
        `respektive ${langsam.payload_vertical_kg} kg, vid ${langsam.speed_max_mms} mm/s.`,
      message_en: `With ${snabb.pitch_mm} mm pitch size ${s.size} runs at ` +
        `${snabb.speed_max_mms} mm/s but carries ${snabb.payload_horizontal_kg} kg ` +
        `horizontally and ${snabb.payload_vertical_kg} kg vertically. ` +
        `With ${langsam.pitch_mm} mm it is ${langsam.payload_horizontal_kg} and ` +
        `${langsam.payload_vertical_kg} kg, at ${langsam.speed_max_mms} mm/s.`,
      goto_step: "epco-stigning",
    });
  }

  // ── katalogens fem villkor ────────────────────────────────────────────────

  // [1] A måste väljas om pulsgivare E inte är vald.
  rows.push({
    severity: "error",
    if_json: {
      and: [
        // Vaktad på att cylindern faktiskt är specificerad. Utan
        // slagvillkoret larmar regeln så fort storlek och stigning är valda
        // -- alltså innan kunden ens hunnit till mätsystemsteget -- och en
        // röd rad om något man ännu inte fått välja är bara i vägen.
        { "!=": [{ var: "size" }, ""] },
        { "!=": [{ var: "pitch" }, ""] },
        { ">": [{ var: "stroke_mm" }, 0] },
        { "!=": [{ var: "measuring" }, "E"] },
        { "!=": [{ var: "position_sensing" }, "A"] },
      ],
    },
    message_sv: "En EPCO måste veta var kolvstången är. Välj antingen " +
      "pulsgivare eller förberedelse för givare — utan endera går cylindern " +
      "inte att beställa.",
    message_en: "An EPCO must know where the piston rod is. Choose either the " +
      "encoder or the preparation for proximity switches — without one of them " +
      "the cylinder cannot be ordered.",
    goto_step: "epco-matning",
  });

  // [2] KF går inte ihop med kolvstångsförlängning.
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { "==": [{ var: "guide_unit" }, "KF"] },
        { ">": [{ var: "extension_mm" }, 0] },
      ],
    },
    message_sv: "Den kullagrade styrningen och en förlängd kolvstång går inte " +
      "ihop — styrstängerna sitter där förlängningen skulle sitta.",
    message_en: "The recirculating ball bearing guide and an extended piston rod " +
      "are mutually exclusive — the guide rods occupy the space.",
    goto_step: "epco-styrning",
  });

  // [3] Kablar och styrning finns bara med pulsgivare.
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { or: [{ "!=": [{ var: "cable" }, ""] }, { "!=": [{ var: "controller" }, ""] }] },
        { "!=": [{ var: "measuring" }, "E"] },
      ],
    },
    message_sv: "Motorkabel och styrning finns bara tillsammans med pulsgivare. " +
      "Utan den vet styrningen ingenting om läget.",
    message_en: "The motor cable and the controller are only available together " +
      "with the encoder. Without it the controller knows nothing about position.",
    goto_step: "epco-matning",
  });

  // [4] Styrningen kräver bussprotokoll OCH in-/utgång.
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { "==": [{ var: "controller" }, "C5"] },
        { or: [{ "==": [{ var: "bus" }, ""] }, { "==": [{ var: "switching" }, ""] }] },
      ],
    },
    message_sv: "Väljs styrningen CMMO måste både bussprotokoll och " +
      "in-/utgångstyp anges. Styrningen levereras konfigurerad.",
    message_en: "If the CMMO controller is selected, both the bus protocol and " +
      "the switching input/output must be specified. The controller ships configured.",
    goto_step: "epco-buss",
  });

  // [5] NPN går inte ihop med IO-Link.
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { "==": [{ var: "switching" }, "N"] },
        { "==": [{ var: "bus" }, "LK"] },
      ],
    },
    message_sv: "NPN går inte ihop med IO-Link. Välj PNP, eller byt " +
      "bussprotokoll till digitalt I/O.",
    message_en: "NPN is not available with IO-Link. Choose PNP, or switch the " +
      "bus protocol to digital I/O.",
    goto_step: "epco-buss",
  });

  return rows;
}

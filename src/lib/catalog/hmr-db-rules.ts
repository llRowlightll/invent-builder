/**
 * HMR-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * HMR:s svårighet är att DRIVNINGEN styr allt annat. Position fem är en
 * stigning om det är en kulskruv och ett monteringsläge om det är en rem;
 * vagnen har två alternativ i det ena fallet och tre i det andra; och
 * slaglängdens tak skiljer sig med en faktor tre mellan dem.
 *
 * Reglerna är därför vaktade på `drive` nästan överallt. Det är samma mönster
 * som DSBC:s varianter, men här behövs ingen variantfunktion -- drivningen är
 * ett eget fält som kunden väljer först.
 */
import {
  HMR_BELTS,
  HMR_BELT_MOUNTS,
  HMR_CARRIAGES,
  HMR_PITCHES,
  HMR_SCREWS,
  HMR_SIZES,
  hmrGuidesForSize,
  hmrKitsForSize,
  hmrPitchesForSize,
} from "./hmr";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type HmrDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}

export function buildHmrDbRules(): HmrDbRule[] {
  const rows: HmrDbRule[] = [];
  const remlagen = HMR_BELT_MOUNTS.map((m) => m.code);
  const stigningar = HMR_PITCHES.map((p) => p.code);

  // ── position fem betyder olika saker ────────────────────────────────────
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { "==": [{ var: "drive" }, "S"] },
        { in: [{ var: "pitch_or_mount" }, remlagen] },
      ],
    },
    message_sv: "Kulskruven har en skruvstigning på den positionen, inte ett " +
      "monteringsläge. Monteringslägena hör till remdriften.",
    message_en: "The ball screw has a spindle pitch in that position, not a " +
      "mounting orientation. Those belong to the belt drive.",
    goto_step: "hmr-stigning",
  });
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { "==": [{ var: "drive" }, "B"] },
        { in: [{ var: "pitch_or_mount" }, stigningar] },
      ],
    },
    message_sv: "Remdriften har inget stigningsval — remmens utväxling är " +
      "given av motorns monteringsläge.",
    message_en: "The belt drive has no pitch selection — the belt ratio " +
      "follows from the motor mounting orientation.",
    goto_step: "hmr-stigning",
  });

  // ── stigningen per storlek ──────────────────────────────────────────────
  for (const s of HMR_SIZES) {
    const mina = hmrPitchesForSize(s.code);
    const mm = mina.map((c) => HMR_PITCHES.find((p) => p.code === c)!.pitch_mm).sort((a, b) => a - b);
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "drive" }, "S"] },
          { "==": [{ var: "size" }, s.code] },
          { in: [{ var: "pitch_or_mount" }, stigningar] },
          { not: { in: [{ var: "pitch_or_mount" }, mina] } },
        ],
      },
      message_sv: `Storlek ${s.code} (profilbredd ${s.width_mm} mm) finns med ` +
        `skruvstigning ${lista(mm)} mm.`,
      message_en: `Size ${s.code} (profile width ${s.width_mm} mm) is available ` +
        `with spindle pitch ${lista(mm, "and")} mm.`,
      goto_step: "hmr-stigning",
    });

    // ── monteringssats och växelmontage ───────────────────────────────────
    const kits = hmrKitsForSize(s.code);
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, s.code] },
          { "!=": [{ var: "mounting_kit" }, ""] },
          { not: { in: [{ var: "mounting_kit" }, kits] } },
        ],
      },
      message_sv: `Storlek ${s.code} tar monteringssats ${lista(kits)}.`,
      message_en: `Size ${s.code} takes mounting kit ${lista(kits, "or")}.`,
      goto_step: "hmr-monteringssats",
    });

    const guides = hmrGuidesForSize(s.code);
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "size" }, s.code] },
          { "!=": [{ var: "guide_mounting" }, ""] },
          { not: { in: [{ var: "guide_mounting" }, guides] } },
        ],
      },
      message_sv: `Storlek ${s.code} tar växelmontage ${lista(guides)}.`,
      message_en: `Size ${s.code} takes gear mounting ${lista(guides, "or")}.`,
      goto_step: "hmr-vaxel",
    });
  }

  // ── vagnen ──────────────────────────────────────────────────────────────
  const baraRem = HMR_CARRIAGES.filter((c) => !c.drives.includes("S")).map((c) => c.code);
  rows.push({
    severity: "error",
    if_json: {
      and: [
        { "==": [{ var: "drive" }, "S"] },
        { in: [{ var: "carriage" }, baraRem] },
      ],
    },
    message_sv: "Delad vagn finns bara på remdriften. En skruv kan inte driva " +
      "två vagnar åt olika håll.",
    message_en: "The bi-part carriage is only available on the belt drive. " +
      "A screw cannot drive two carriages in opposite directions.",
    goto_step: "hmr-vagn",
  });

  // ── slaglängdens tak ────────────────────────────────────────────────────
  //
  // Per storlek OCH drivning. Databasen hade 3 000 mm för allt; kulskruven i
  // storlek 08 går bara till 1 200, och remmen i 15 till 6 000.
  // EN regel per storlek, inte per rad. Skruvtabellen har två rader per storlek
  // (en per stigning) med samma slagtak, och en loop över raderna gav samma
  // regel två gånger -- som hade visats två gånger för kunden.
  const settaStorlekar = new Set<string>();
  for (const sc of HMR_SCREWS) {
    if (settaStorlekar.has(sc.size)) continue;
    settaStorlekar.add(sc.size);
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "drive" }, "S"] },
          { "==": [{ var: "size" }, sc.size] },
          { ">": [{ var: "stroke_mm" }, sc.max_stroke_mm] },
        ],
      },
      message_sv: `Kulskruv i storlek ${sc.size} går till ${sc.max_stroke_mm} mm slaglängd.`,
      message_en: `The ball screw in size ${sc.size} goes up to ${sc.max_stroke_mm} mm stroke.`,
      goto_step: "hmr-slag",
    });
  }
  for (const b of HMR_BELTS.filter((x) => x.mounts.includes("BD"))) {
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "drive" }, "B"] },
          { "==": [{ var: "size" }, b.size] },
          { ">": [{ var: "stroke_mm" }, b.max_stroke_mm] },
        ],
      },
      message_sv: `Remdrift i storlek ${b.size} går till ${b.max_stroke_mm} mm slaglängd.`,
      message_en: `The belt drive in size ${b.size} goes up to ${b.max_stroke_mm} mm stroke.`,
      goto_step: "hmr-slag",
    });
  }

  // ── råd om stigningen ───────────────────────────────────────────────────
  //
  // Den snabba skruven ger samma kraft men mycket högre hastighet -- och
  // omvänt kostar den låga stigningen i cykeltid. Parkers tabell säger att
  // hastigheten är exakt proportionell mot stigningen, så valet är
  // odramatiskt men värt att se.
  for (const s of HMR_SIZES) {
    const mina = HMR_SCREWS.filter((x) => x.size === s.code);
    if (mina.length !== 2) continue;
    const [lang, kort] = [...mina].sort((a, b) => b.pitch_mm - a.pitch_mm);
    rows.push({
      severity: "info",
      if_json: {
        and: [
          { "==": [{ var: "drive" }, "S"] },
          { "==": [{ var: "size" }, s.code] },
          { "==": [{ var: "pitch_or_mount" }, lang.pitch_code] },
        ],
      },
      message_sv: `Med ${lang.pitch_mm} mm stigning går storlek ${s.code} ` +
        `${lang.max_speed_ms} m/s. Med ${kort.pitch_mm} mm blir det ` +
        `${kort.max_speed_ms} m/s — samma tryckkraft, ${lang.max_thrust_n} N, ` +
        `men motorn behöver mer moment vid den grova stigningen.`,
      message_en: `With ${lang.pitch_mm} mm pitch size ${s.code} runs at ` +
        `${lang.max_speed_ms} m/s. With ${kort.pitch_mm} mm it is ` +
        `${kort.max_speed_ms} m/s — the same thrust, ${lang.max_thrust_n} N, ` +
        `but the motor needs more torque at the coarse pitch.`,
      goto_step: "hmr-stigning",
    });
  }

  // ── remmens monteringsläge påverkar kraften ─────────────────────────────
  //
  // Storlek 15 tappar från 1 050 till 630 N när motorn sitter i 000°/180°.
  // Det är inte uppenbart, och det är en tredjedels kraft.
  const s15hog = HMR_BELTS.find((b) => b.size === "15" && b.mounts.includes("BD"))!;
  const s15lag = HMR_BELTS.find((b) => b.size === "15" && b.mounts.includes("AP"))!;
  rows.push({
    severity: "warn",
    if_json: {
      and: [
        { "==": [{ var: "drive" }, "B"] },
        { "==": [{ var: "size" }, "15"] },
        { in: [{ var: "pitch_or_mount" }, s15lag.mounts] },
      ],
    },
    message_sv: `I lägena ${lista(s15lag.mounts)} ger storlek 15 ` +
      `${s15lag.max_thrust_n} N och ${s15lag.lead_mm_per_rev} mm per varv. ` +
      `I ${lista(s15hog.mounts)} blir det ${s15hog.max_thrust_n} N och ` +
      `${s15hog.lead_mm_per_rev} mm per varv — remmen läggs om.`,
    message_en: `In orientations ${lista(s15lag.mounts, "and")} size 15 gives ` +
      `${s15lag.max_thrust_n} N and ${s15lag.lead_mm_per_rev} mm per rev. ` +
      `In ${lista(s15hog.mounts, "and")} it is ${s15hog.max_thrust_n} N and ` +
      `${s15hog.lead_mm_per_rev} mm per rev — the belt is routed differently.`,
    goto_step: "hmr-stigning",
  });

  // ── remdrift i storlek 18 och 24 ────────────────────────────────────────
  //
  // Beställnyckeln har dem; den tekniska tabellen har dem inte. Kunden ska
  // veta att vi inte kan räkna på dem.
  const remUtanData = HMR_SIZES
    .filter((s) => !HMR_BELTS.some((b) => b.size === s.code))
    .map((s) => s.code);
  if (remUtanData.length > 0) {
    rows.push({
      severity: "warn",
      if_json: {
        and: [
          { "==": [{ var: "drive" }, "B"] },
          { in: [{ var: "size" }, remUtanData] },
        ],
      },
      message_sv: `Katalogen ger beställkoden för remdrift i storlek ` +
        `${lista(remUtanData)} men inte hastighets- och kraftdata. Kontrollera ` +
        `med Parker innan konstruktionen låses.`,
      message_en: `The catalogue gives the order code for the belt drive in size ` +
        `${lista(remUtanData, "and")} but not its speed and force data. Check with ` +
        `Parker before freezing the design.`,
      goto_step: "hmr-storlek",
    });
  }

  return rows;
}

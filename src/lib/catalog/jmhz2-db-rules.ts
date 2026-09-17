/**
 * JMHZ2-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: givaren mot -X50 och -X6900, antalet
 * mot -X7460, kabellängden mot givartypen.
 */
import { JMHZ2_ACTIONS, JMHZ2_BORES, JMHZ2_COUNTS, JMHZ2_LEAD_INDEX, JMHZ2_LEADS, JMHZ2_LIMITS, JMHZ2_MTO, JMHZ2_SWITCHES } from "./jmhz2";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type JMHZ2DbRule = DsbcDbRule;

const sv = (n: number) => String(n).replace(".", ",");
const LEAD_NAMN: Record<string, [string, string]> = {
  "": ["0,5 m (ingen bokstav)", "0.5 m (no letter)"],
  M: ["1 m (M)", "1 m (M)"],
  L: ["3 m (L)", "3 m (L)"],
  Z: ["5 m (Z)", "5 m (Z)"],
};
const basnamn = (koder: string[]) => [...new Set(koder.map((k) => k.replace(/^(M9[NPB][WA]?)V$/, "$1")))].join("/");

export function buildJmhz2DbRules(): JMHZ2DbRule[] {
  const rows: JMHZ2DbRule[] = [];
  const steg = (p: string) => `jmhz2-${p}`;

  // ── givaren mot specialutförandena ─────────────────────────────────────
  const utanMagnet = JMHZ2_MTO.filter((x) => x.no_magnet).map((x) => x.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { in: [{ var: "mto" }, utanMagnet] }] },
    message_sv: "-X50 är utan magnet — givare kan inte användas (sida 10).",
    message_en: "-X50 is without a magnet — auto switches cannot be used (page 10).",
    goto_step: steg("mto"),
  });
  const utanGivare = JMHZ2_MTO.filter((x) => x.no_switch).map((x) => x.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ "!=": [{ var: "switch" }, ""] }, { in: [{ var: "mto" }, utanGivare] }] },
    message_sv: "Nyckeln för -X6900 (styrpinnar) har ingen givarposition: JMHZ2-□□-X6900A/B (sida 20).",
    message_en: "The -X6900 key (positioning pins) has no auto switch position: JMHZ2-□□-X6900A/B (page 20).",
    goto_step: steg("mto"),
  });
  const hogstTva = JMHZ2_MTO.filter((x) => x.max_two_switches).map((x) => x.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "count" }, JMHZ2_COUNTS.filter((n) => n.n).map((n) => n.code)] }, { in: [{ var: "mto" }, hogstTva] }] },
    message_sv: "-X7460 beställs med en (S) eller två givare; tre eller fler efter förfrågan hos SMC (sida 21).",
    message_en: "-X7460 is ordered with one (S) or two auto switches; three or more on request from SMC (page 21).",
    goto_step: steg("count"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "switch" }, ""] }, { or: [{ "!=": [{ var: "lead" }, ""] }, { "!=": [{ var: "count" }, ""] }] }] },
    message_sv: "Kabellängd och antal hör till givaren — välj en givare först.",
    message_en: "Lead wire length and quantity belong to the auto switch — choose a switch first.",
    goto_step: steg("switch"),
  });
  for (const lead of ["", ...JMHZ2_LEADS.map((l) => l.code)]) {
    const i = JMHZ2_LEAD_INDEX[lead];
    const pa = JMHZ2_SWITCHES.filter((g) => g.leads[i] === "O").map((g) => g.code);
    if (pa.length) {
      rows.push({
        severity: "warn",
        if_json: { and: [{ "==": [{ var: "lead" }, lead] }, { in: [{ var: "switch" }, pa] }] },
        message_sv: `Kabellängd ${LEAD_NAMN[lead][0]} tillverkas på beställning för D-${basnamn(pa)} (även V-typerna) (sida 9, ○).`,
        message_en: `Lead wire length ${LEAD_NAMN[lead][1]} is produced upon receipt of order for D-${basnamn(pa)} (V types too) (page 9, ○).`,
        goto_step: steg("lead"),
      });
    }
  }
  const vatten = JMHZ2_SWITCHES.filter((g) => g.water_resistant).map((g) => g.code);
  rows.push({
    severity: "warn",
    if_json: { in: [{ var: "switch" }, vatten] },
    message_sv: `De vattentäta givarna D-${basnamn(vatten)} går att montera, men SMC garanterar inte vattentätheten (sida 9, ∗2).`,
    message_en: `The water-resistant switches D-${basnamn(vatten)} can be mounted, but SMC cannot guarantee water resistance (page 9, ∗2).`,
    goto_step: steg("switch"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "switch" }, JMHZ2_SWITCHES.filter((g) => /W/.test(g.code)).map((g) => g.code)] },
    message_sv: "Tvåfärgsindikering: ställ in givaren så att den lyser rött i rätt läge för säker detektering (sida 9). Givare med kortare längd finns på beställning.",
    message_en: "Two-colour indication: set the switch so that it lights red at the proper position for reliable detection (page 9). A shorter switch is available on request.",
    goto_step: steg("switch"),
  });

  // ── råd ────────────────────────────────────────────────────────────────
  for (const b of JMHZ2_BORES) {
    for (const a of JMHZ2_ACTIONS) {
      const kraft = a.code === "D" ? `${sv(b.force_d[0])} N yttre/${sv(b.force_d[1])} N inre grepp` : a.code === "S" ? `${sv(b.force_no)} N yttre grepp` : `${sv(b.force_nc)} N inre grepp`;
      const force = a.code === "D" ? `${b.force_d[0]} N external/${b.force_d[1]} N internal grip` : a.code === "S" ? `${b.force_no} N external grip` : `${b.force_nc} N internal grip`;
      const p = a.code === "D" ? b.pressure_d : b.pressure_s;
      const w = a.code === "D" ? b.weight_g[0] : b.weight_g[1];
      rows.push({
        severity: "info",
        if_json: { and: [{ "==": [{ var: "bore" }, b.code] }, { "==": [{ var: "action" }, a.code] }] },
        message_sv: `JMHZ2-${b.code}${a.code}: gripkraft per finger ${kraft} vid 0,5 MPa (L = 20 mm), slag ${b.stroke_mm} mm båda sidor, ${sv(p[0])}–${sv(p[1])} MPa, vikt ${w} g utan givare; motsvarar MHZ2-${b.mhz2} (sida 4 och 10).`,
        message_en: `JMHZ2-${b.code}${a.code}: gripping force per finger ${force} at 0.5 MPa (L = 20 mm), stroke ${b.stroke_mm} mm both sides, ${p[0]}–${p[1]} MPa, weight ${w} g without switches; equivalent to MHZ2-${b.mhz2} (pages 4 and 10).`,
        goto_step: steg("action"),
      });
    }
  }
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "bore" }, ""] },
    message_sv: `JMHZ2: ${JMHZ2_LIMITS.temp_c[0]}…${JMHZ2_LIMITS.temp_c[1]} °C, repeterbarhet ±${sv(JMHZ2_LIMITS.repeatability_mm)} mm, högst ${JMHZ2_LIMITS.max_frequency_cpm} slag/min, smörjfri, inbyggd magnet (utan magnet: -X50); vid hög frekvens och korta slag kan kondens bildas — fukthanteringsröret IDK rekommenderas (sida 9–10).`,
    message_en: `JMHZ2: ${JMHZ2_LIMITS.temp_c[0]}…${JMHZ2_LIMITS.temp_c[1]} °C, repeatability ±${JMHZ2_LIMITS.repeatability_mm} mm, max. ${JMHZ2_LIMITS.max_frequency_cpm} cycles/min, non-lube, built-in magnet (without magnet: -X50); at high frequency and short strokes dew may condense — the IDK moisture control tube is recommended (pages 9–10).`,
    goto_step: steg("bore"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "mto" }, utanGivare] },
    message_sv: "-X6900: leverspindeln förlängs som styrpinne (2 st) på sidomonteringsytan; övriga data som standardtypen (sida 20).",
    message_en: "-X6900: the lever shaft is extended as a positioning pin (2 pcs) on the lateral mounting surface; other specifications as the standard type (page 20).",
    goto_step: steg("mto"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "mto" }, hogstTva] },
    message_sv: "-X7460: givaren sitter i en plåt på sidoytan och kan bytas även när gaveln är blockerad; egen kropp (sida 21).",
    message_en: "-X7460: the auto switch sits in a plate on the lateral surface and can be replaced even when the head side is blocked; exclusive body (page 21).",
    goto_step: steg("mto"),
  });
  return rows;
}

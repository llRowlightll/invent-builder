/**
 * MFH-reglerna som skrivs till config_rules, byggda ur artikellistan.
 *
 * MFH är en TABELLFAMILJ, men konfiguratorn komponerar ändå namnet ur delarna
 * -- serie, funktion, gänga, pilotluft och ATEX -- eftersom `mfh.test.ts`
 * bevisar att kompositionen ger exakt katalogens namn för alla 76 artiklar.
 * En rullgardin med 76 alternativ är en vägg; fem korta listor är ett val.
 *
 * Priset för det är att kompositionen kan producera kombinationer katalogen
 * inte har, och det är vad reglerna nedan stoppar. De är HÄRLEDDA ur
 * artikellistan, inte handskrivna: en rad som tillkommer i katalogen ger nya
 * regler automatiskt.
 */
import { MFH_ARTICLES, MFH_SERIES, MFH_THREADS } from "./mfh";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type MfhDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}

/** Gängans läsbara form, G1/8 i stället för 1/8. */
function g(t: string): string {
  return MFH_THREADS.find((x) => x.code === t)?.label_sv ?? t;
}

export function buildMfhDbRules(): MfhDbRule[] {
  const rows: MfhDbRule[] = [];

  for (const s of MFH_SERIES) {
    const mina = MFH_ARTICLES.filter((a) => a.series === s.code);
    const funktioner = [...new Set(mina.map((a) => a.fn))];

    // ── vilken ventilfunktion serien finns i ────────────────────────────────
    //
    // De bistabila serierna finns bara som 5/2, MOFH och VL/O bara som 3/2.
    // Det är inte godtyckligt: en bistabil 3/2-ventil har ingen mening när
    // återställningen är just det som saknas.
    if (funktioner.length < 2) {
      rows.push({
        severity: "error",
        if_json: {
          and: [
            { "==": [{ var: "series" }, s.code] },
            { "!=": [{ var: "fn" }, ""] },
            { not: { in: [{ var: "fn" }, funktioner] } },
          ],
        },
        message_sv: `${s.code} finns bara som ${funktioner[0]}/2-vägsventil.`,
        message_en: `${s.code} is only available as a ${funktioner[0]}/2-way valve.`,
        goto_step: "mfh-funktion",
      });
    }

    for (const fn of funktioner) {
      const denna = mina.filter((a) => a.fn === fn);
      const gangor = [...new Set(denna.map((a) => a.thread))];
      const alla = MFH_THREADS.map((t) => t.code);

      // ── vilka gängor som finns ────────────────────────────────────────────
      if (gangor.length < alla.length) {
        rows.push({
          severity: "error",
          if_json: {
            and: [
              { "==": [{ var: "series" }, s.code] },
              { "==": [{ var: "fn" }, fn] },
              { "!=": [{ var: "thread" }, ""] },
              { not: { in: [{ var: "thread" }, gangor] } },
            ],
          },
          message_sv: `${s.code}-${fn} finns i ${lista(gangor.map(g))}.`,
          message_en: `${s.code}-${fn} is available in ${lista(gangor.map(g), "and")}.`,
          goto_step: "mfh-ganga",
        });
      }

      // ── extern pilotluft ──────────────────────────────────────────────────
      //
      // Finns inte för alla serier. MOFH har till exempel ingen -S-variant
      // alls, och den som väljer den får en artikel som inte finns.
      const medS = denna.some((a) => a.ext_pilot);
      if (!medS) {
        rows.push({
          severity: "error",
          if_json: {
            and: [
              { "==": [{ var: "series" }, s.code] },
              { "==": [{ var: "fn" }, fn] },
              { "==": [{ var: "ext_pilot" }, "S"] },
            ],
          },
          message_sv: `${s.code}-${fn} finns bara med intern pilotluft.`,
          message_en: `${s.code}-${fn} is only available with internal pilot air.`,
          goto_step: "mfh-pilot",
        });
      } else {
        // Finns -S, men kanske inte för varje gänga.
        const medSGangor = [...new Set(denna.filter((a) => a.ext_pilot).map((a) => a.thread))];
        if (medSGangor.length < gangor.length) {
          rows.push({
            severity: "error",
            if_json: {
              and: [
                { "==": [{ var: "series" }, s.code] },
                { "==": [{ var: "fn" }, fn] },
                { "==": [{ var: "ext_pilot" }, "S"] },
                { not: { in: [{ var: "thread" }, medSGangor] } },
              ],
            },
            message_sv: `${s.code}-${fn} med extern pilotluft finns i ` +
              `${lista(medSGangor.map(g))}.`,
            message_en: `${s.code}-${fn} with external pilot air is available in ` +
              `${lista(medSGangor.map(g), "and")}.`,
            goto_step: "mfh-pilot",
          });
        }
      }
    }
  }

  // ── B-varianten ───────────────────────────────────────────────────────────
  //
  // Finns bara på VL/O i G1/8. Vad B betyder framgår inte av katalogen, och
  // regeln säger därför bara var den finns -- inte vad den är.
  const bArtiklar = MFH_ARTICLES.filter((a) => a.b_variant);
  if (bArtiklar.length > 0) {
    const serie = bArtiklar[0].series;
    const ganga = bArtiklar[0].thread;
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "b_variant" }, "B"] },
          {
            or: [
              { "!=": [{ var: "series" }, serie] },
              { "!=": [{ var: "thread" }, ganga] },
            ],
          },
        ],
      },
      message_sv: `B-utförandet finns bara som ${serie} i ${g(ganga)}.`,
      message_en: `The B version only exists as ${serie} in ${g(ganga)}.`,
      goto_step: "mfh-utforande",
    });
    // Och omvänt: VL/O i G1/8 FINNS bara som B.
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "series" }, serie] },
          { "==": [{ var: "thread" }, ganga] },
          { "!=": [{ var: "b_variant" }, "B"] },
          { "!=": [{ var: "thread" }, ""] },
        ],
      },
      message_sv: `${serie} i ${g(ganga)} finns bara i B-utförande.`,
      message_en: `${serie} in ${g(ganga)} only exists in the B version.`,
      goto_step: "mfh-utforande",
    });
  }

  // ── tryckgränsen som är lätt att missa ────────────────────────────────────
  rows.push({
    severity: "warn",
    if_json: {
      and: [
        { "==": [{ var: "fn" }, "5"] },
        { "==": [{ var: "thread" }, "1/4"] },
      ],
    },
    message_sv: "5/2-ventilen i G1/4 tål 8 bar. De övriga storlekarna tål 10.",
    message_en: "The 5/2 valve in G1/4 is rated for 8 bar. The other sizes take 10.",
    goto_step: "mfh-ganga",
  });

  // ── ATEX-temperaturen ─────────────────────────────────────────────────────
  rows.push({
    severity: "warn",
    if_json: { "==": [{ var: "atex" }, "EX"] },
    message_sv: "ATEX-utförandet är godkänt för -5 till +40 °C omgivning " +
      "(II 2G Ex h IIC T4 Gb, II 2D Ex h IIIC T130 °C Db). Utanför det " +
      "intervallet gäller inte godkännandet.",
    message_en: "The ATEX version is approved for -5 to +40 °C ambient " +
      "(II 2G Ex h IIC T4 Gb, II 2D Ex h IIIC T130 °C Db). Outside that range " +
      "the approval does not apply.",
    goto_step: "mfh-atex",
  });

  return rows;
}

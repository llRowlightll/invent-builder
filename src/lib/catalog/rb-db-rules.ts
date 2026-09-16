/**
 * RB-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på två val samtidigt: storleken mot serien, kåpan/bufferten
 * och tillvalen mot M6 (RB0604).
 */
import { RB_LIMITS, RB_MODELS, RB_OPTIONS, RB_SERIES, RB_SIZES, RB_TYPE_C } from "./rb";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type RBDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const sv = (n: number) => String(n).replace(".", ",");

export function buildRbDbRules(): RBDbRule[] {
  const rows: RBDbRule[] = [];
  const steg = (p: string) => `rb-${p}`;

  // ── storleken mot serien ───────────────────────────────────────────────
  for (const s of RB_SERIES) {
    const finns = RB_MODELS.filter((x) => x.series === s.code).map((x) => x.size);
    const saknas = RB_SIZES.map((x) => x.code).filter((k) => !finns.includes(k));
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "series" }, s.code] }, { in: [{ var: "size" }, saknas] }] },
      message_sv: `${s.code} tillverkas i storlekarna ${lista(finns)}; ${saknas.length > 6 ? "de övriga storlekarna" : lista(saknas)} hör till ${s.code === "RBQ" ? "RB/RBL" : s.code === "RB" ? "RBQ" : "RB (0604–0806) eller RBQ"} (sida ${s.page}).`,
      message_en: `${s.code} is made in the sizes ${lista(finns, "and")}; ${saknas.length > 6 ? "the other sizes" : lista(saknas, "and")} belong to ${s.code === "RBQ" ? "RB/RBL" : s.code === "RB" ? "RBQ" : "RB (0604–0806) or RBQ"} (page ${s.page}).`,
      goto_step: steg("size"),
    });
  }

  // ── M6 ─────────────────────────────────────────────────────────────────
  const utanC = RB_MODELS.filter((x) => !x.c_ok);
  for (const x of utanC) {
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "series" }, x.series] }, { "==": [{ var: "size" }, x.size] }, { "==": [{ var: "type" }, RB_TYPE_C.code] }] },
      message_sv: `${x.series}${x.size} finns inte med kåpa (sida 1299, not).`,
      message_en: `${x.series}${x.size} is not available with the cap (page 1299, note).`,
      goto_step: steg("type"),
    });
  }
  const utanTillval = RB_MODELS.filter((x) => !x.options_ok);
  for (const x of utanTillval) {
    rows.push({
      severity: "error",
      if_json: { and: [{ "==": [{ var: "series" }, x.series] }, { "==": [{ var: "size" }, x.size] }, { in: [{ var: "option" }, RB_OPTIONS.map((o) => o.code)] }] },
      message_sv: `Tillvalen finns inte för M6 (${x.series}${x.size}): ingen stoppmutter och inga muttertillval (sida 1295 och 1302).`,
      message_en: `The options are not available for M6 (${x.series}${x.size}): no stopper nut and no nut options (pages 1295 and 1302).`,
      goto_step: steg("option"),
    });
  }

  // ── råd per modell ─────────────────────────────────────────────────────
  for (const x of RB_MODELS) {
    const s = RB_SERIES.find((y) => y.code === x.series)!;
    const speed = x.size === "0604" ? [0.3, 1.0] : s.speed_m_s;
    const delar = [
      x.foot_part ? `fotfäste ${x.foot_part} beställs separat` : null,
      x.stopper_part ? `stoppmutter ${x.stopper_part}` : null,
      x.cap_part ? `reserv${s.c_sv === "kåpa" ? "kåpa" : "buffert"} ${x.cap_part}` : null,
    ].filter((d) => d);
    const parts = [
      x.foot_part ? `foot bracket ${x.foot_part} ordered separately` : null,
      x.stopper_part ? `stopper nut ${x.stopper_part}` : null,
      x.cap_part ? `replacement ${s.c_en} ${x.cap_part}` : null,
    ].filter((d) => d);
    rows.push({
      severity: "info",
      if_json: { and: [{ "==": [{ var: "series" }, x.series] }, { "==": [{ var: "size" }, x.size] }] },
      message_sv: `${x.series}${x.size}: ${x.thread}, slag ${sv(x.stroke_mm)} mm, högst ${sv(x.energy_j)} J per slag och ${x.freq_per_min} slag/min vid 20–25 °C, kollisionshastighet ${sv(speed[0])}–${sv(speed[1])} m/s, största axialkraft ${x.thrust_n} N, returfjäder ${sv(x.spring_ext_n)}/${sv(x.spring_ret_n)} N (ut/in), vikt ${sv(x.weight_g)} g${x.weight_c_g !== null && x.weight_c_g !== x.weight_g ? ` (${sv(x.weight_c_g)} g med ${s.c_sv})` : ""}${delar.length ? `; ${delar.join(", ")}` : ""} (sida ${s.page} och ${s.parts_page}).`,
      message_en: `${x.series}${x.size}: ${x.thread.replace(",", ".")}, stroke ${x.stroke_mm} mm, max. ${x.energy_j} J per cycle and ${x.freq_per_min} cycles/min at 20–25 °C, collision speed ${speed[0]}–${speed[1]} m/s, max. allowable thrust ${x.thrust_n} N, return spring ${x.spring_ext_n}/${x.spring_ret_n} N (extended/retracted), weight ${x.weight_g} g${x.weight_c_g !== null && x.weight_c_g !== x.weight_g ? ` (${x.weight_c_g} g with ${s.c_en})` : ""}${parts.length ? `; ${parts.join(", ")}` : ""} (pages ${s.page} and ${s.parts_page}).`,
      goto_step: steg("size"),
    });
  }

  // ── råd per serie, typ och tillval ─────────────────────────────────────
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "series" }, "RB"] },
    message_sv: `RB: ${RB_LIMITS.temp_c[0]}…${RB_LIMITS.temp_c[1]} °C (frostfritt), två sexkantmuttrar medföljer; välj storlek efter energi per slag, energi per minut och ekvivalent massa enligt urvalet på sida 1296–1298.`,
    message_en: `RB: ${RB_LIMITS.temp_c[0]}…${RB_LIMITS.temp_c[1]} °C (no freezing), two hexagon nuts included; select the size by energy per cycle, energy per minute and equivalent mass per the selection on pages 1296–1298.`,
    goto_step: steg("series"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "series" }, "RBL"] },
    message_sv: `RBL: avstrykare och stångtätning bildar en dubbel tätning mot icke vattenlöslig skärolja (JIS klass 1); ${RB_LIMITS.temp_c[0]}…${RB_LIMITS.temp_c[1]} °C, två sexkantmuttrar medföljer (sida 1306).`,
    message_en: `RBL: the scraper and rod seal form a double seal against non-water-soluble cutting oil (JIS class 1); ${RB_LIMITS.temp_c[0]}…${RB_LIMITS.temp_c[1]} °C, two hexagon nuts included (page 1306).`,
    goto_step: steg("series"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "series" }, "RBQ"] },
    message_sv: `RBQ: kort typ för rotationsenergi, tillåten excentricitet 5°, kollisionshastighet 0,05–3 m/s, ${RB_LIMITS.temp_c[0]}…${RB_LIMITS.temp_c[1]} °C, två sexkantmuttrar medföljer; urval på sida 1312–1314 (sida 1310).`,
    message_en: `RBQ: short type for rotating energy, allowable eccentric angle 5°, collision speed 0.05–3 m/s, ${RB_LIMITS.temp_c[0]}…${RB_LIMITS.temp_c[1]} °C, two hexagon nuts included; selection on pages 1312–1314 (page 1310).`,
    goto_step: steg("series"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "type" }, RB_TYPE_C.code] },
    message_sv: "Kåpan (RB/RBL) respektive gummibufferten (RBQ) kan inte monteras på bastypen i efterhand — beställ C från början; reservdelen är bara plast-/gummidelen (sida 1299, 1306, 1310).",
    message_en: "The cap (RB/RBL) or rubber bumper (RBQ) cannot be mounted on the basic type afterwards — order C from the beginning; the replacement part is only the resin/rubber part (pages 1299, 1306, 1310).",
    goto_step: steg("type"),
  });
  for (const o of RB_OPTIONS) {
    rows.push({
      severity: "info",
      if_json: { "==": [{ var: "option" }, o.code] },
      message_sv: `Tillval ${o.code}: ${o.hex_nuts === 0 ? "inga sexkantmuttrar" : `${o.hex_nuts} sexkantmuttrar`}${o.stopper_nut ? " och en stoppmutter (kåptypen har egen stoppmutter RBC□□S)" : ""} (sida 1299, 1306, 1310).`,
      message_en: `Option ${o.code}: ${o.hex_nuts === 0 ? "no hexagon nuts" : `${o.hex_nuts} hexagon nuts`}${o.stopper_nut ? " and one stopper nut (the cap type has its own stopper nut RBC□□S)" : ""} (pages 1299, 1306, 1310).`,
      goto_step: steg("option"),
    });
  }
  return rows;
}

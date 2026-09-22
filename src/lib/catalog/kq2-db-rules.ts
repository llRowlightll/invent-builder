/**
 * KQ2-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på flera val samtidigt: slangen mot typen och knappen,
 * porten mot typ, slang och knapp (måttabellerna), materialet mot porten,
 * tätningen mot gängan och typen.
 */
import { KQ2_BUTTON, KQ2_CLEAN, KQ2_FEMALE_TYPES, KQ2_INCH_TUBES, KQ2_KJE, KQ2_KJE_TUBES, KQ2_LIMITS, KQ2_MATERIALS, KQ2_MTO, KQ2_NIPPLE_03, KQ2_PORTS, KQ2_Q, KQ2_Q_PORT, KQ2_Q_TUBE, KQ2_Q_TYPES, KQ2_SEALS, KQ2_TUBES, KQ2_TYPES, kq2Allowed } from "./kq2";
import { KQ2_MODELS } from "./kq2-models";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type KQ2DbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const tubeSv = (code: string) => KQ2_TUBES.find((t) => t.code === code)!.label_sv;
const tubeEn = (code: string) => tubeSv(code).replace(",", ".").replace("(tum)", "(inch)");
/** Slangmåttet i portkoderna 06A/03A (reducering) och 06/05 (reducernippel). */
const slangI = (code: string, en: boolean) => {
  const t = KQ2_TUBES.find((x) => x.code === code.slice(0, 2));
  return t ? (en ? tubeEn(t.code) : tubeSv(t.code)).replace(" mm", "").replace(" (tum)", "").replace(" (inch)", "") : `ø${Number(code.slice(0, 2))}`;
};
const PORT_KORT: Record<string, [string, string]> = {
  M3: ["M3", "M3"], M5: ["M5", "M5"], M6: ["M6", "M6"],
  "01": ["01 (R/Rc 1/8)", "01 (R/Rc 1/8)"], "02": ["02 (R/Rc 1/4)", "02 (R/Rc 1/4)"], "03": ["03 (R/Rc 3/8)", "03 (R/Rc 3/8)"], "04": ["04 (R/Rc 1/2)", "04 (R/Rc 1/2)"],
  G01: ["G01 (G1/8)", "G01 (G1/8)"], G02: ["G02 (G1/4)", "G02 (G1/4)"], G03: ["G03 (G3/8)", "G03 (G3/8)"], G04: ["G04 (G1/2)", "G04 (G1/2)"],
  U01: ["U01 (Uni 1/8)", "U01 (Uni 1/8)"], U02: ["U02 (Uni 1/4)", "U02 (Uni 1/4)"], U03: ["U03 (Uni 3/8)", "U03 (Uni 3/8)"], U04: ["U04 (Uni 1/2)", "U04 (Uni 1/2)"],
  "32": ["32 (10-32 UNF)", "32 (10-32 UNF)"], "33": ["33 (NPT1/16)", "33 (NPT1/16)"], "34": ["34 (NPT1/8)", "34 (NPT1/8)"], "35": ["35 (NPT1/4)", "35 (NPT1/4)"], "36": ["36 (NPT3/8)", "36 (NPT3/8)"], "37": ["37 (NPT1/2)", "37 (NPT1/2)"],
  "00A": ["00A (skarv)", "00A (union)"], "99A": ["99A (instick)", "99A (plug-in)"], "00": ["00 (skottgenomföring)", "00 (bulkhead)"], "99": ["99 (nippel)", "99 (nipple)"],
};
const portNamn = (code: string, en: boolean) => PORT_KORT[code]?.[en ? 1 : 0] ?? (code.endsWith("A") ? `${code} (${slangI(code, en)}${en ? " tube" : " slang"})` : `${code} (${en ? "reducer nipple to " : "reducernippel till "}${slangI(code, en)})`);
/** Nippeln N med tumslang och porten 03 är reducernippeln till ø5/32", inte R3/8 (KQ2N01-03, sida 152). */
const nippel03 = { and: [{ "==": [{ var: "type" }, "N"] }, { in: [{ var: "tube" }, KQ2_INCH_TUBES] }, { "==": [{ var: "port" }, KQ2_NIPPLE_03] }] };
const knappSv = (b: "round" | "oval") => (b === "oval" ? "oval knapp" : "rund knapp");
const knappEn = (b: "round" | "oval") => (b === "oval" ? "the oval button" : "the round button");

export function buildKq2DbRules(): KQ2DbRule[] {
  const rows: KQ2DbRule[] = [];
  const steg = (p: string) => `kq2-${p}`;
  const knappVillkor = (b: "round" | "oval") => ({ "==": [{ var: "button" }, b === "oval" ? KQ2_BUTTON.code : ""] });

  // ── slangen och porten mot typen och knappen (måttabellerna) ───────────
  for (const b of ["round", "oval"] as const) {
    // måttabellerna: oval sida 9–27, 60–64, 68–72, 90–94; rund sida 105–132, 168–172, 176–184, 204–208
    const sida = b === "oval" ? "måttabellerna sida 9–27 m.fl." : "måttabellerna sida 105–132 m.fl.";
    const pages = b === "oval" ? "dimension tables pages 9–27 etc." : "dimension tables pages 105–132 etc.";
    for (const t of KQ2_TYPES) {
      const allowed = kq2Allowed(b, t.code);
      const tubes = KQ2_TUBES.map((x) => x.code).filter((x) => x in allowed);
      if (tubes.length === 0) {
        rows.push({
          severity: "error",
          if_json: { and: [knappVillkor(b), { "==": [{ var: "type" }, t.code] }] },
          message_sv: `KQ2${t.code} finns bara med rund frigöringsknapp (${sida}).`,
          message_en: `KQ2${t.code} exists only with the round release button (${pages}).`,
          goto_step: steg("button"),
        });
        continue;
      }
      rows.push({
        severity: "error",
        if_json: { and: [knappVillkor(b), { "==": [{ var: "type" }, t.code] }, { not: { in: [{ var: "tube" }, tubes] } }] },
        message_sv: `KQ2${t.code} med ${knappSv(b)} finns för ${lista(tubes.map(tubeSv))} (${sida}).`,
        message_en: `KQ2${t.code} with ${knappEn(b)} exists for ${lista(tubes.map(tubeEn), "and")} (${pages}).`,
        goto_step: steg("tube"),
      });
      // slangar med samma portmängd i en regel
      const grupper = new Map<string, string[]>();
      for (const tube of tubes) {
        const k = [...allowed[tube]].sort().join(",");
        grupper.set(k, [...(grupper.get(k) ?? []), tube]);
      }
      for (const [k, tubesI] of grupper) {
        const ports = k.split(",");
        const ordnade = KQ2_PORTS.filter((p) => ports.includes(p.code)).map((p) => p.code);
        rows.push({
          severity: "error",
          if_json: { and: [knappVillkor(b), { "==": [{ var: "type" }, t.code] }, { in: [{ var: "tube" }, tubesI] }, { "!=": [{ var: "port" }, ""] }, { not: { in: [{ var: "port" }, ordnade] } }] },
          message_sv: `KQ2${t.code} ${lista(tubesI.map(tubeSv))} med ${knappSv(b)} finns med portarna ${lista(ordnade.map((p) => portNamn(p, false)))} (${sida}).`,
          message_en: `KQ2${t.code} ${lista(tubesI.map(tubeEn), "and")} with ${knappEn(b)} exists with the ports ${lista(ordnade.map((p) => portNamn(p, true)), "and")} (${pages}).`,
          goto_step: steg("port"),
        });
      }
    }
  }

  // ── materialet mot porten ──────────────────────────────────────────────
  // M3: hankopplingarna bara i rostfritt (KQ2H23-M3G), honkopplingen KQ2F i A/N (sida 106).
  const m3Rostfritt = KQ2_TYPES.map((t) => t.code).filter((t) => Object.values(KQ2_MODELS).some((tab) => Object.values(tab[t] ?? {}).some((ports) => ports.includes("M3G"))));
  const gängor = KQ2_PORTS.filter((p) => p.kind === "thread" && p.code !== "M3").map((p) => p.code);
  const utanMaterial = KQ2_PORTS.filter((p) => p.kind === "tube" || p.kind === "nipple").map((p) => p.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ or: [{ in: [{ var: "port" }, gängor] }, { and: [{ "==": [{ var: "port" }, "M3"] }, { not: { in: [{ var: "type" }, m3Rostfritt] } }] }] }, { not: nippel03 }, { not: { in: [{ var: "material" }, ["A", "N"]] } }] },
    message_sv: "Gängade kopplingar beställs med materialet A (mässing) eller N (förnicklad mässing); rostfritt G finns bara för hankopplingarnas M3 (sida 6 och 31).",
    message_en: "Threaded fittings are ordered with the material A (brass) or N (nickel-plated brass); stainless G exists only for the male fittings' M3 (pages 6 and 31).",
    goto_step: steg("material"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [nippel03, { or: [{ "!=": [{ var: "material" }, ""] }, { "!=": [{ var: "seal" }, ""] }] }] },
    message_sv: "Nippeln N med tumslang och porten 03 är reducernippeln till ø5/32\" och skrivs utan material- och tätningsbokstav (KQ2N01-03, sida 152).",
    message_en: "The nipple N with inch tubing and port 03 is the reducer nipple to ø5/32\" and is written without a material or seal letter (KQ2N01-03, page 152).",
    goto_step: steg("material"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "port" }, "M3"] }, { in: [{ var: "type" }, m3Rostfritt] }, { "!=": [{ var: "material" }, "G"] }] },
    message_sv: `M3 x 0,5 finns bara i rostfritt stål 303 (G) för KQ2${m3Rostfritt.join("/")} (sida 6 och måttabellerna, t.ex. KQ2H23-M3G); honkopplingen KQ2F har M3 i mässing.`,
    message_en: `M3 x 0.5 exists only in stainless steel 303 (G) for KQ2${m3Rostfritt.join("/")} (page 6 and the dimension tables, e.g. KQ2H23-M3G); the female connector KQ2F has M3 in brass.`,
    goto_step: steg("material"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "port" }, "00"] }, { not: { in: [{ var: "material" }, ["A", "N"]] } }] },
    message_sv: "Skottgenomföringens skarv beställs med materialet A eller N (sida 102, KQ2E□□-00□).",
    message_en: "The bulkhead union is ordered with the material A or N (page 102, KQ2E□□-00□).",
    goto_step: steg("material"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "port" }, utanMaterial] }, { "!=": [{ var: "material" }, ""] }] },
    message_sv: "Slangkopplingar och nipplar har inget materialval: A ingår i portkoden (00A, 06A …) och nipplarna skrivs utan bokstav (KQ2N04-99) (sida 6 och 129).",
    message_en: "Tube fittings and nipples have no material choice: A is part of the port code (00A, 06A …) and the nipples are written without a letter (KQ2N04-99) (pages 6 and 129).",
    goto_step: steg("material"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "port" }, utanMaterial] }, { "!=": [{ var: "seal" }, ""] }] },
    message_sv: "Tätningsmedel och plantätning hör till R-gängan — slangkopplingar och nipplar har ingen tätningsposition (sida 6).",
    message_en: "Thread sealant and face seal belong to the R thread — tube fittings and nipples have no seal position (page 6).",
    goto_step: steg("seal"),
  });

  // ── tätningen mot gängan och typen ─────────────────────────────────────
  const rGängor = KQ2_PORTS.filter((p) => p.r_thread).map((p) => p.code);
  const gängorUtanR = KQ2_PORTS.filter((p) => p.kind !== "tube" && p.kind !== "nipple" && !p.r_thread).map((p) => p.code);
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "seal" }, KQ2_SEALS.map((s) => s.code)] }, { in: [{ var: "port" }, gängorUtanR] }] },
    message_sv: "Tätningsmedel (S) och plantätning (P) finns bara på R-gängorna 01–04 och NPT-gängorna 33–37; M-gängan och 10-32 UNF tätar med gasket, G-gängan har plantätning inbyggd och Uni-gängan har gasket (sida 6, 31, 58 och 88).",
    message_en: "Thread sealant (S) and face seal (P) exist only on the R threads 01–04 and the NPT threads 33–37; the M thread and 10-32 UNF seal with a gasket, the G thread has the face seal built in and the Uni thread has a gasket (pages 6, 31, 58 and 88).",
    goto_step: steg("seal"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ in: [{ var: "seal" }, KQ2_SEALS.map((s) => s.code)] }, { in: [{ var: "type" }, KQ2_FEMALE_TYPES] }] },
    message_sv: `Honkopplingarna KQ2${KQ2_FEMALE_TYPES.join("/KQ2")} har Rc-gänga utan tätning (måttabellerna sida 9–27).`,
    message_en: `The female fittings KQ2${KQ2_FEMALE_TYPES.join("/KQ2")} have an Rc thread without a seal (dimension tables pages 9–27).`,
    goto_step: steg("seal"),
  });

  // ── råd ────────────────────────────────────────────────────────────────
  rows.push({
    severity: "info",
    if_json: { and: [{ in: [{ var: "port" }, rGängor] }, { "==": [{ var: "seal" }, ""] }, { not: { in: [{ var: "type" }, KQ2_FEMALE_TYPES] } }, { not: nippel03 }] },
    message_sv: "R- eller NPT-gänga utan tätning (Nil): måttabellerna visar utförandet med tätningsmedel (S); välj S för färdig gängtätning eller P för plantätning (sida 6, 31, 66 och 75).",
    message_en: "R or NPT thread without a seal (Nil): the dimension tables show the version with thread sealant (S); choose S for a ready thread seal or P for the face seal (pages 6, 31, 66 and 75).",
    goto_step: steg("seal"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "port" }, ["33", "34", "35", "36", "37"]] },
    message_sv: "NPT-gänga (ANSI/ASME B1.20.1) för tumslang: tätningsmedel S (sida 31) eller plantätning P (sida 75); NPT1/16 (33) finns bara på de små slangmåtten.",
    message_en: "NPT thread (ANSI/ASME B1.20.1) for inch tubing: thread sealant S (page 31) or face seal P (page 75); NPT1/16 (33) exists only on the small tube sizes.",
    goto_step: steg("port"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "port" }, "32"] },
    message_sv: "10-32 UNF tätar med gasket; reservgasket M-5G2 (sida 31).",
    message_en: "10-32 UNF seals with a gasket; spare gasket M-5G2 (page 31).",
    goto_step: steg("port"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "tube" }, KQ2_INCH_TUBES] },
    message_sv: "Tumslang (ø1/8\"–ø1/2\") av FEP, PFA, nylon, mjuk nylon eller polyuretan; kopplingarna finns i mässing (A) eller förnicklad mässing (N), inte rostfritt; slangreduceringar och nipplar anger den andra sidans tummått (sida 30–31 och 134).",
    message_en: "Inch tubing (ø1/8\"–ø1/2\") of FEP, PFA, nylon, soft nylon or polyurethane; the fittings come in brass (A) or nickel-plated brass (N), not stainless; tube reducers and nipples state the other side's inch size (pages 30–31 and 134).",
    goto_step: steg("tube"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "seal" }, "S"] },
    message_sv: "Tätningsmedlet är den enda tätningsmetoden som får användas med kylvätska; kontrollera medlet mot listan över verifierade kylvätskor (sida 4, not 4–7).",
    message_en: "The sealant is the only seal method allowed with coolant; check the coolant against the list of verified coolants (page 4, notes 4–7).",
    goto_step: steg("seal"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "port" }, ["M3", "M5", "M6"]] },
    message_sv: "M-gängan tätar med gasket; reservgasket M-3G2 (M3), M-5G2 (M5) och M-6G (M6) (sida 6).",
    message_en: "The M thread seals with a gasket; spare gaskets M-3G2 (M3), M-5G2 (M5) and M-6G (M6) (page 6).",
    goto_step: steg("port"),
  });
  rows.push({
    severity: "info",
    if_json: { in: [{ var: "port" }, ["U01", "U02", "U03", "U04"]] },
    message_sv: "Uni-gängan passar Rc, G, NPT och NPTF och tätar med gasket; reservgasket KQG U01–U04 (sida 88).",
    message_en: "The Uni thread fits Rc, G, NPT and NPTF and seals with a gasket; spare gasket KQG U01–U04 (page 88).",
    goto_step: steg("port"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "button" }, KQ2_BUTTON.code] },
    message_sv: "Oval frigöringsknapp: samma kroppar som den runda för ø3,2–ø6, lägre höjd och kortare längd (sida 1–2).",
    message_en: "Oval release button: the same bodies as the round one for ø3.2–ø6, lower height and shorter length (pages 1–2).",
    goto_step: steg("button"),
  });
  rows.push({
    severity: "info",
    if_json: { "!=": [{ var: "type" }, ""] },
    message_sv: `KQ2: ${KQ2_LIMITS.pressure_kpa[0]} kPa till ${KQ2_LIMITS.pressure_kpa[1] / 1000} MPa (provtryck ${KQ2_LIMITS.proof_mpa} MPa), ${KQ2_LIMITS.temp_c[0]}…${KQ2_LIMITS.temp_c[1]} °C (vatten/kylvätska ${KQ2_LIMITS.temp_water_c[0]}…${KQ2_LIMITS.temp_water_c[1]} °C), luft, vatten och kylvätska; slang av nylon, mjuk nylon, polyuretan, FEP eller PFA; kopplingar utan gänga och med helt resinkropp är kopparfria; Clean-serien beställs med prefixet 10- (sida 4 och 131).`,
    message_en: `KQ2: ${KQ2_LIMITS.pressure_kpa[0]} kPa to ${KQ2_LIMITS.pressure_kpa[1] / 1000} MPa (proof pressure ${KQ2_LIMITS.proof_mpa} MPa), ${KQ2_LIMITS.temp_c[0]}…${KQ2_LIMITS.temp_c[1]} °C (water/coolant ${KQ2_LIMITS.temp_water_c[0]}…${KQ2_LIMITS.temp_water_c[1]} °C), air, water and coolant; nylon, soft nylon, polyurethane, FEP or PFA tubing; fittings without a thread and with an all-resin body are copper free; the Clean series is ordered with the prefix 10- (pages 4 and 131).`,
    goto_step: steg("type"),
  });
  // ── Clean-serien, Q-utförandet, KJE och specialutföranden ──────────────
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "clean" }, KQ2_CLEAN.code] }, { "==": [{ var: "material" }, "A"] }] },
    message_sv: "Clean-serien (10-) har förnicklade mässingsdelar: gängade kopplingar och skottgenomföringar beställs med N, inte A (sida 28, t.ex. 10-KQ2H06-02NS1).",
    message_en: "The Clean series (10-) has nickel-plated brass parts: threaded fittings and bulkheads are ordered with N, not A (page 28, e.g. 10-KQ2H06-02NS1).",
    goto_step: steg("material"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "clean" }, KQ2_CLEAN.code] },
    message_sv: "Clean-serien: mässingsdelarna förnicklade, fluorfett, luftblåst i renrum, dubbelförpackad, vit resinkropp och knapp; slangkopplingar skrivs med A som vanligt (10-KQ2H06-00A1) (sida 28 och 49).",
    message_en: "Clean series: nickel-plated brass parts, fluorine grease, air blown in a clean room, double packaging, white resin body and button; tube fittings are written with A as usual (10-KQ2H06-00A1) (pages 28 and 49).",
    goto_step: steg("clean"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "q" }, KQ2_Q.code] }, { or: [{ not: { in: [{ var: "type" }, KQ2_Q_TYPES] } }, { "!=": [{ var: "tube" }, KQ2_Q_TUBE] }, { "!=": [{ var: "port" }, KQ2_Q_PORT] }] }] },
    message_sv: `Q-utförandet finns bara för ø8 med R1/8 (port 01) och typerna KQ2${KQ2_Q_TYPES.join("/")} (sida 132, t.ex. KQ2L08-01AQS).`,
    message_en: `The Q type exists only for ø8 with R1/8 (port 01) and the types KQ2${KQ2_Q_TYPES.join("/")} (page 132, e.g. KQ2L08-01AQS).`,
    goto_step: steg("q"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "q" }, KQ2_Q.code] },
    message_sv: "Q: effektiv area utbytbar med KQ-serien (den äldre serien) — för utbyte i befintliga anläggningar; material A eller N (sida 132).",
    message_en: "Q: effective area interchangeable with the KQ series (the previous series) — for replacement in existing installations; material A or N (page 132).",
    goto_step: steg("q"),
  });
  rows.push({
    severity: "error",
    if_json: { and: [{ "==": [{ var: "kje" }, KQ2_KJE.code] }, { or: [{ "!=": [{ var: "type" }, "E"] }, { "!=": [{ var: "port" }, "00"] }, { not: { in: [{ var: "tube" }, KQ2_KJE_TUBES] } }, { "==": [{ var: "button" }, KQ2_BUTTON.code] }] }] },
    message_sv: `KJE-utbytbar (J) finns bara för skottgenomföringens skarv KQ2E□□-00□ med rund knapp i ${lista(KQ2_KJE_TUBES.map(tubeSv))} (sida 129 och 154).`,
    message_en: `KJE-interchangeable (J) exists only for the bulkhead union KQ2E□□-00□ with the round button in ${lista(KQ2_KJE_TUBES.map(tubeEn), "and")} (pages 129 and 154).`,
    goto_step: steg("kje"),
  });
  rows.push({
    severity: "info",
    if_json: { "==": [{ var: "kje" }, KQ2_KJE.code] },
    message_sv: "J: skottgenomföringen får KJE-seriens gänga (M7–M11 x 0,75) och passar KJE:s hål och muttrar (sida 129).",
    message_en: "J: the bulkhead union gets the KJE series thread (M7–M11 x 0.75) and fits KJE holes and nuts (page 129).",
    goto_step: steg("kje"),
  });
  for (const m of KQ2_MTO) {
    if (m.not_types.length) {
      rows.push({
        severity: "error",
        if_json: { and: [{ "==": [{ var: "mto" }, m.code] }, { in: [{ var: "type" }, m.not_types] }] },
        message_sv: `${m.code} finns inte för KQ2${m.not_types.join("/")} (insexkoppling, skottgenomföring, nippel, rak han-/honkoppling, slanglock) (sida 28, not 1).`,
        message_en: `${m.code} is not available for KQ2${m.not_types.join("/")} (hexagon socket head connector, bulkhead, nipple, straight male/female connector, colour cap) (page 28, note 1).`,
        goto_step: steg("mto"),
      });
    }
    rows.push({
      severity: m.contact ? "warn" : "info",
      if_json: { "==": [{ var: "mto" }, m.code] },
      message_sv: `${m.label_sv.replace(/^-X\d+: /, `${m.code}: `)}${m.contact ? " — ∗2 fråga SMC om tillgänglighet, mått och leveranstid" : " — fråga SMC om mått och leveranstid"} (sida 28 och 132).`,
      message_en: `${m.code}: ${m.code === "-X12" ? "white release button, white vaseline lubricant" : m.code === "-X35" ? "black body, light grey/orange release button" : "fixed orifice"}${m.contact ? " — ∗2 contact SMC for availability, dimensions and lead time" : " — contact SMC for dimensions and lead time"} (pages 28 and 132).`,
      goto_step: steg("mto"),
    });
  }
  void KQ2_MATERIALS;
  return rows;
}

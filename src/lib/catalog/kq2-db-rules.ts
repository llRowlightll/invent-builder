/**
 * KQ2-reglerna som skrivs till config_rules, byggda ur modellen.
 *
 * Det som beror på flera val samtidigt: slangen mot typen och knappen,
 * porten mot typ, slang och knapp (måttabellerna), materialet mot porten,
 * tätningen mot gängan och typen.
 */
import { KQ2_BUTTON, KQ2_FEMALE_TYPES, KQ2_LIMITS, KQ2_MATERIALS, KQ2_PORTS, KQ2_SEALS, KQ2_TUBES, KQ2_TYPES, kq2Allowed } from "./kq2";
import { KQ2_MODELS } from "./kq2-models";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type KQ2DbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}
const tubeSv = (code: string) => KQ2_TUBES.find((t) => t.code === code)!.label_sv;
const tubeEn = (code: string) => tubeSv(code).replace(",", ".");
const PORT_KORT: Record<string, [string, string]> = {
  M3: ["M3", "M3"], M5: ["M5", "M5"], M6: ["M6", "M6"],
  "01": ["01 (R/Rc 1/8)", "01 (R/Rc 1/8)"], "02": ["02 (R/Rc 1/4)", "02 (R/Rc 1/4)"], "03": ["03 (R/Rc 3/8)", "03 (R/Rc 3/8)"], "04": ["04 (R/Rc 1/2)", "04 (R/Rc 1/2)"],
  G01: ["G01 (G1/8)", "G01 (G1/8)"], G02: ["G02 (G1/4)", "G02 (G1/4)"], G03: ["G03 (G3/8)", "G03 (G3/8)"], G04: ["G04 (G1/2)", "G04 (G1/2)"],
  U01: ["U01 (Uni 1/8)", "U01 (Uni 1/8)"], U02: ["U02 (Uni 1/4)", "U02 (Uni 1/4)"], U03: ["U03 (Uni 3/8)", "U03 (Uni 3/8)"], U04: ["U04 (Uni 1/2)", "U04 (Uni 1/2)"],
  "00A": ["00A (skarv)", "00A (union)"], "99A": ["99A (instick)", "99A (plug-in)"], "00": ["00 (skottgenomföring)", "00 (bulkhead)"], "99": ["99 (nippel)", "99 (nipple)"],
};
const portNamn = (code: string, en: boolean) => PORT_KORT[code]?.[en ? 1 : 0] ?? (code.endsWith("A") ? `${code} (ø${code.slice(0, 2) === "23" ? (en ? "3.2" : "3,2") : Number(code.slice(0, 2))}${en ? " tube" : " slang"})` : `${code} (${en ? "reducer nipple to ø" : "reducernippel till ø"}${Number(code)})`);
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
    if_json: { and: [{ or: [{ in: [{ var: "port" }, gängor] }, { and: [{ "==": [{ var: "port" }, "M3"] }, { not: { in: [{ var: "type" }, m3Rostfritt] } }] }] }, { not: { in: [{ var: "material" }, ["A", "N"]] } }] },
    message_sv: "Gängade kopplingar beställs med materialet A (mässing) eller N (förnicklad mässing); rostfritt G finns bara för hankopplingarnas M3 (sida 6).",
    message_en: "Threaded fittings are ordered with the material A (brass) or N (nickel-plated brass); stainless G exists only for the male fittings' M3 (page 6).",
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
    message_sv: "Tätningsmedel (S) och plantätning (P) finns bara på R-gängorna 01–04; M-gängan tätar med gasket, G-gängan har plantätning inbyggd och Uni-gängan har gasket (sida 6, 58 och 88).",
    message_en: "Thread sealant (S) and face seal (P) exist only on the R threads 01–04; the M thread seals with a gasket, the G thread has the face seal built in and the Uni thread has a gasket (pages 6, 58 and 88).",
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
    if_json: { and: [{ in: [{ var: "port" }, rGängor] }, { "==": [{ var: "seal" }, ""] }, { not: { in: [{ var: "type" }, KQ2_FEMALE_TYPES] } }] },
    message_sv: "R-gänga utan tätning (Nil): måttabellerna visar utförandet med tätningsmedel (S); välj S för färdig gängtätning eller P för plantätning (sida 6 och 66).",
    message_en: "R thread without a seal (Nil): the dimension tables show the version with thread sealant (S); choose S for a ready thread seal or P for the face seal (pages 6 and 66).",
    goto_step: steg("seal"),
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
  void KQ2_MATERIALS;
  return rows;
}

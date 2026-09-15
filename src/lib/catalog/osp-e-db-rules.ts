/**
 * OSP-E-reglerna som skrivs till config_rules, byggda ur modellen -- en
 * regeluppsättning per variant, eftersom varje variant är en egen familj.
 *
 * Samma mönster som HMR: en kombination modellen vägrar bygga ska ge minst
 * ett fel, och en den bygger får inte ge något. Testet i
 * osp-e-db-rules.test.ts räknar upp kombinationerna och kontrollerar det.
 *
 * Vad som INTE är regler: storlekarna per variant (BV finns bara i 20 och 25)
 * ligger i varje familjs egen värdelista, så kunden kan inte välja fel där.
 * Reglerna täcker det som beror på TVÅ val samtidigt.
 */
import {
  OSPE_BHD_DIRECTIONS,
  OSPE_BHD_TYPES,
  OSPE_END_CAPS_STD,
  OSPE_GEARKIT_NONE,
  OSPE_GEARS,
  OSPE_KIT_NONE,
  OSPE_SHAFTS_BHD,
  OSPE_TECH,
  type OspeSlug,
  type OspeTech,
  ospeGearKitsFor,
  ospeGuides,
  ospeKitsForLayout,
  ospePitches,
  ospePitchesForSize,
  ospeShafts2,
  ospeVariant,
} from "./osp-e";
import type { DsbcDbRule } from "./dsbc-db-rules";

export type OspeDbRule = DsbcDbRule;

function lista(delar: Array<string | number>, sista = "och"): string {
  if (delar.length <= 1) return String(delar[0] ?? "");
  return `${delar.slice(0, -1).join(", ")} ${sista} ${delar[delar.length - 1]}`;
}

const sv = (n: number) => String(n).replace(".", ",");

export function buildOspeDbRules(slug: OspeSlug): OspeDbRule[] {
  const v = ospeVariant(slug);
  if (!v) throw new Error(`okänd OSP-E-variant: ${slug}`);
  const rows: OspeDbRule[] = [];
  const steg = (p: string) => `ospe-${p}`;

  const harSkruv = v.layout === "SCREW" || v.layout === "ROD";
  const harVaxel = v.layout === "B" || harSkruv;

  // ── stigningen per storlek ─────────────────────────────────────────────
  if (harSkruv) {
    for (const size of v.sizes) {
      const mina = ospePitchesForSize(slug, size);
      const alla = ospePitches(slug).map((p) => p.code);
      if (mina.length === alla.length) continue;
      const mm = ospePitches(slug).filter((p) => mina.includes(p.code)).map((p) => p.pitch_mm);
      rows.push({
        severity: "error",
        if_json: {
          and: [
            { "==": [{ var: "size" }, size] },
            { "!=": [{ var: "pitch" }, ""] },
            { not: { in: [{ var: "pitch" }, mina] } },
          ],
        },
        message_sv: `${v.name} i storlek ${size} finns med stigning ${lista(mm)} mm.`,
        message_en: `${v.name} size ${size} is available with pitch ${lista(mm, "and")} mm.`,
        goto_step: steg("pitch"),
      });
    }
  }

  // ── växeln per storlek, och växelns krav på sats ───────────────────────
  if (harVaxel) {
    for (const size of v.sizes) {
      const mina = OSPE_GEARS.filter((g) => g.sizes.includes(size)).map((g) => g.code);
      if (mina.length === OSPE_GEARS.length) continue;
      // "LP050 (i = 5 eller 10)", inte "LP050, i = 5 eller LP050, i = 10".
      const familjer = new Map<string, number[]>();
      for (const g of OSPE_GEARS) {
        if (g.code === "0" || !mina.includes(g.code)) continue;
        const [fam, ratio] = g.label_sv.split(", i = ");
        familjer.set(fam, [...(familjer.get(fam) ?? []), Number.parseInt(ratio, 10)]);
      }
      const namn = [...familjer].map(([fam, ratios]) => `${fam} (i = ${lista(ratios, "eller")})`);
      const namnEn = [...familjer].map(([fam, ratios]) => `${fam} (i = ${lista(ratios, "or")})`);
      rows.push({
        severity: "error",
        if_json: {
          and: [
            { "==": [{ var: "size" }, size] },
            { "!=": [{ var: "gear" }, ""] },
            { not: { in: [{ var: "gear" }, mina] } },
          ],
        },
        message_sv: `Storlek ${size} tar växel ${lista(namn, "eller")}.`,
        message_en: `Size ${size} takes gearbox ${lista(namnEn, "or")}.`,
        goto_step: steg("gear"),
      });
    }
    // "For gears the mounting kit of the motor must be specified.
    //  LP050: A0, A1, A2   LP070: A1, A2, A3"
    const grupper = new Map<string, string[]>();
    for (const g of OSPE_GEARS) {
      if (g.kits.length === 0) continue;
      const nyckel = g.kits.join(",");
      grupper.set(nyckel, [...(grupper.get(nyckel) ?? []), g.code]);
    }
    for (const [kits, gears] of grupper) {
      const satser = kits.split(",");
      const namn = OSPE_GEARS.find((g) => g.code === gears[0])!.label_sv.split(",")[0];
      rows.push({
        severity: "error",
        if_json: {
          and: [
            { in: [{ var: "gear" }, gears] },
            { "!=": [{ var: "kit" }, ""] },
            { not: { in: [{ var: "kit" }, satser] } },
          ],
        },
        message_sv: `Växeln ${namn} levereras monterad, och då måste motorns ` +
          `monteringssats anges: ${lista(satser, "eller")}.`,
        message_en: `The ${namn} gearbox comes mounted, so the motor mounting ` +
          `kit must be specified: ${lista(satser, "or")}.`,
        goto_step: steg("kit"),
      });
    }
    // ── satsen per storlek ────────────────────────────────────────────
    const satser = ospeKitsForLayout(v.layout);
    for (const size of v.sizes) {
      const mina = satser.filter((k) => k.sizes.includes(size)).map((k) => k.code);
      const fria = v.layout === "B" ? [OSPE_KIT_NONE] : [OSPE_KIT_NONE, "3-", "4-"];
      rows.push({
        severity: "error",
        if_json: {
          and: [
            { "==": [{ var: "size" }, size] },
            { "!=": [{ var: "kit" }, ""] },
            { not: { in: [{ var: "kit" }, [...fria, ...mina]] } },
          ],
        },
        message_sv: `Storlek ${size} tar monteringssats ${lista(mina, "eller")}.`,
        message_en: `Size ${size} takes mounting kit ${lista(mina, "or")}.`,
        goto_step: steg("kit"),
      });
    }
  }

  // ── yttre styrning per storlek (B, SB, ST) ─────────────────────────────
  const styrningar = ospeGuides(slug);
  if (styrningar.length > 0) {
    for (const size of v.sizes) {
      const mina = styrningar.filter((g) => !g.sizes || g.sizes.includes(size)).map((g) => g.code);
      const ps = styrningar.filter((g) => g.sizes && g.sizes.includes(size) && g.code >= "E" && g.code <= "I").map((g) => g.code);
      rows.push({
        severity: "error",
        if_json: {
          and: [
            { "==": [{ var: "size" }, size] },
            { "!=": [{ var: "ext_guide" }, ""] },
            { not: { in: [{ var: "ext_guide" }, mina] } },
          ],
        },
        message_sv: `Powerslide-styrningen är storleksbunden: storlek ${size} tar ${lista(ps, "eller")}.`,
        message_en: `The Powerslide guide is size-specific: size ${size} takes ${lista(ps, "or")}.`,
        goto_step: steg("ext_guide"),
      });
    }
  }

  // ── ändlocksfäste B4 bara i 25 och 32 ─────────────────────────────────
  if (v.layout === "B" || v.layout === "SCREW") {
    for (const e of OSPE_END_CAPS_STD) {
      if (!e.sizes) continue;
      rows.push({
        severity: "error",
        if_json: {
          and: [
            { "==": [{ var: "end_cap" }, e.code] },
            { "!=": [{ var: "size" }, ""] },
            { not: { in: [{ var: "size" }, e.sizes] } },
          ],
        },
        message_sv: `Ändlocksfäste typ B4 finns bara för storlek ${lista(e.sizes)}.`,
        message_en: `End cap mounting type B4 only exists for size ${lista(e.sizes, "and")}.`,
        goto_step: steg("end_cap"),
      });
    }
  }

  // ── BHD: typ, riktning, integrerad växel ───────────────────────────────
  if (v.layout === "BHD") {
    for (const t of OSPE_BHD_TYPES) {
      const saknas = v.sizes.filter((s) => !t.sizes.includes(s));
      if (saknas.length === 0) continue;
      rows.push({
        severity: "error",
        if_json: {
          and: [
            { "==": [{ var: "type" }, t.code] },
            { in: [{ var: "size" }, saknas] },
          ],
        },
        message_sv: `Rullstyrningen (typ ${t.code}) finns i storlek ${lista(t.sizes)}. ` +
          `Storlek ${lista(saknas)} har bara den kullagrade styrningen (typ 6).`,
        message_en: `The roller guide (type ${t.code}) exists in size ${lista(t.sizes, "and")}. ` +
          `Size ${lista(saknas, "and")} only has the ball bearing guide (type 6).`,
        goto_step: steg("type"),
      });
    }
    const delade = OSPE_BHD_DIRECTIONS.filter((d) => d.biparting).map((d) => d.code);
    const enkla = OSPE_BHD_DIRECTIONS.filter((d) => !d.biparting).map((d) => d.code);
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "!=": [{ var: "carriage" }, ""] },
          { "!=": [{ var: "carriage" }, "2"] },
          { in: [{ var: "op_direction" }, delade] },
        ],
      },
      message_sv: `Rörelseriktning ${lista(delade)} är den delade vagnens. Med en ` +
        `standard- eller tandemvagn är riktningen ${lista(enkla, "eller")}.`,
      message_en: `Operating direction ${lista(delade, "and")} belongs to the bi-parting ` +
        `carriage. With a standard or tandem carriage the direction is ${lista(enkla, "or")}.`,
      goto_step: steg("op_direction"),
    });
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { "==": [{ var: "carriage" }, "2"] },
          { in: [{ var: "op_direction" }, enkla] },
        ],
      },
      message_sv: `Den delade vagnen rör sig åt två håll; dess riktning är ${lista(delade, "eller")}.`,
      message_en: `The bi-parting carriage moves in two directions; its direction is ${lista(delade, "or")}.`,
      goto_step: steg("op_direction"),
    });
    const vaxlar = OSPE_SHAFTS_BHD.filter((s) => s.kind === "gear");
    const vaxelStorlekar = vaxlar[0].sizes!;
    const utan = v.sizes.filter((s) => !vaxelStorlekar.includes(s));
    rows.push({
      severity: "error",
      if_json: {
        and: [
          { in: [{ var: "size" }, utan] },
          { in: [{ var: "drive_shaft" }, vaxlar.map((s) => s.code)] },
        ],
      },
      message_sv: `Den integrerade planetväxeln finns för storlek ${lista(vaxelStorlekar)}, inte ${lista(utan)}.`,
      message_en: `The integrated planetary gearbox exists for size ${lista(vaxelStorlekar, "and")}, not ${lista(utan, "and")}.`,
      goto_step: steg("drive_shaft"),
    });
  }

  // ── BHD och BV: satsen följer storlek OCH axeltyp ──────────────────────
  if (v.layout === "BHD" || v.layout === "BV") {
    const axlar = ospeShafts2(slug);
    for (const size of v.sizes) {
      for (const kind of ["plain", "clamp", "hollow", "gear"] as const) {
        const mina = axlar.filter((s) => s.kind === kind && (!s.sizes || s.sizes.includes(size)));
        if (mina.length === 0) continue;
        const koder = mina.map((s) => s.code);
        const satser = ospeGearKitsFor(slug, size, koder[0]);
        const namnAxel = kind === "plain" ? "slät axel" : kind === "clamp" ? "klämaxel" : kind === "hollow" ? "hålaxel" : "integrerad växel";
        const namnAxelEn = kind === "plain" ? "plain shaft" : kind === "clamp" ? "clamp shaft" : kind === "hollow" ? "hollow shaft" : "integrated gearbox";
        rows.push({
          severity: "error",
          if_json: {
            and: [
              { "==": [{ var: "size" }, size] },
              { in: [{ var: "drive_shaft" }, koder] },
              { "!=": [{ var: "kit" }, ""] },
              { not: { in: [{ var: "kit" }, [OSPE_GEARKIT_NONE, ...satser]] } },
            ],
          },
          message_sv: satser.length > 0
            ? `Storlek ${size} med ${namnAxel} (${lista(koder, "eller")}) tar monteringssats ${lista(satser, "eller")}.`
            : `Katalogen har ingen monteringssats för storlek ${size} med ${namnAxel} (${lista(koder, "eller")}).`,
          message_en: satser.length > 0
            ? `Size ${size} with ${namnAxelEn} (${lista(koder, "or")}) takes mounting kit ${lista(satser, "or")}.`
            : `The catalogue has no mounting kit for size ${size} with ${namnAxelEn} (${lista(koder, "or")}).`,
          goto_step: steg("kit"),
        });
      }
    }
  }

  // ── slaglängdens tak ────────────────────────────────────────────────────
  //
  // "Max. Standard Stroke Length". Längre finns på begäran, men inte i
  // nyckeln. Skruvarnas tak är per storlek; BHD:s per styrning och storlek.
  const unika = new Map<string, OspeTech>();
  for (const t of OSPE_TECH.filter((x) => x.slug === slug)) unika.set(`${t.type ?? ""}|${t.size}`, t);
  const perTak = new Map<number, OspeTech[]>();
  for (const t of unika.values()) perTak.set(t.max_stroke_mm, [...(perTak.get(t.max_stroke_mm) ?? []), t]);
  for (const [max, grupp] of perTak) {
    const villkor: unknown[] = [{ ">": [{ var: "stroke_mm" }, max] }];
    let text_sv: string;
    let text_en: string;
    if (v.layout === "BHD") {
      villkor.push({
        or: grupp.map((t) => ({ and: [{ "==": [{ var: "type" }, t.type] }, { "==": [{ var: "size" }, t.size] }] })),
      });
      const typer = [...new Set(grupp.map((t) => t.type))];
      const beskriv = (sep: string, i: string, och: string) => typer
        .map((ty) => `${i} ${ty} ${sep} ${lista(grupp.filter((t) => t.type === ty).map((t) => t.size), och)}`)
        .join(och === "och" ? "; " : "; ");
      text_sv = `${beskriv("i storlek", "Typ", "och")} går till ${max} mm standardslag. Längre slag på begäran.`;
      text_en = `${beskriv("in size", "Type", "and")} goes up to ${max} mm standard stroke. Longer strokes on request.`;
    } else if (grupp.length < v.sizes.length) {
      villkor.push({ in: [{ var: "size" }, grupp.map((t) => t.size)] });
      text_sv = `${v.name} i storlek ${lista(grupp.map((t) => t.size))} går till ${max} mm standardslag. Längre slag på begäran.`;
      text_en = `${v.name} size ${lista(grupp.map((t) => t.size), "and")} goes up to ${max} mm standard stroke. Longer strokes on request.`;
    } else {
      text_sv = `${v.name} går till ${max} mm standardslag. Längre slag på begäran.`;
      text_en = `${v.name} goes up to ${max} mm standard stroke. Longer strokes on request.`;
    }
    rows.push({
      severity: "error",
      if_json: { and: villkor },
      message_sv: text_sv,
      message_en: text_en,
      goto_step: steg("stroke_mm"),
    });
  }

  // ── råd: kraft och hastighet ur tabellen ───────────────────────────────
  for (const t of OSPE_TECH.filter((x) => x.slug === slug)) {
    const villkor: unknown[] = [{ "==": [{ var: "size" }, t.size] }];
    if (t.type) villkor.push({ "==": [{ var: "type" }, t.type] });
    if (t.pitch) villkor.push({ "==": [{ var: "pitch" }, t.pitch] });
    const pitch = t.pitch ? ospePitches(slug).find((p) => p.code === t.pitch)! : null;
    const vad_sv = pitch ? `med ${pitch.pitch_mm} mm stigning` : t.type ? `typ ${t.type}` : "";
    const vad_en = pitch ? `with ${pitch.pitch_mm} mm pitch` : t.type ? `type ${t.type}` : "";
    const extra_sv = slug === "osp-e-bhd" && t.type === "6" ? " Upp till 10 m/s på begäran." : "";
    const extra_en = slug === "osp-e-bhd" && t.type === "6" ? " Up to 10 m/s on request." : "";
    rows.push({
      severity: "info",
      if_json: { and: villkor },
      message_sv: `${v.name.replace("..", t.size)}${vad_sv ? ` ${vad_sv}` : ""}: max ${sv(t.max_speed_ms)} m/s och ` +
        `${t.max_force_n} N verkande kraft, standardslag till ${t.max_stroke_mm} mm.${extra_sv}`,
      message_en: `${v.name.replace("..", t.size)}${vad_en ? ` ${vad_en}` : ""}: max ${t.max_speed_ms} m/s and ` +
        `${t.max_force_n} N action force, standard stroke up to ${t.max_stroke_mm} mm.${extra_en}`,
      goto_step: steg("size"),
    });
  }

  // BV är vertikal och bär en rekommenderad maxmassa (sida 33).
  if (slug === "osp-e-bv") {
    for (const [size, kg] of [["20", 10], ["25", 20]] as const) {
      rows.push({
        severity: "info",
        if_json: { "==": [{ var: "size" }, size] },
        message_sv: `Rekommenderad största rörlig massa för OSP-E${size}BV är ${kg} kg (vertikal drift).`,
        message_en: `Recommended maximum moved mass for OSP-E${size}BV is ${kg} kg (vertical operation).`,
        goto_step: steg("size"),
      });
    }
  }

  // Trapetsskruven är självlåsande: det är dess poäng (sida 73, 95).
  if (slug === "osp-e-st" || slug === "osp-e-str") {
    rows.push({
      severity: "info",
      if_json: { "!=": [{ var: "size" }, ""] },
      message_sv: "Trapetsskruven är självlåsande och håller lasten utan ström — " +
        "lämplig för långsam rörelse, pressning och hållning.",
      message_en: "The trapezoidal screw is self-locking and holds the load without power — " +
        "suited to slow motion, pressing and holding.",
      goto_step: steg("size"),
    });
  }

  return rows;
}

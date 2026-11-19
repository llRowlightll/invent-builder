/**
 * Standardartiklar ur de kanoniska katalogmodellerna i src/lib/catalog.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-standardartiklar.ts > supabase/migrations/<tidsstämpel>_standardartiklar.sql
 *
 * Ägaren bad 2026-11-19 om fabrikatens hela sortiment inom våra kategorier.
 * De flesta serierna låg som EN familjerad ("CP96/C96 – ISO 15552 Cylinder")
 * fast katalogmodellen redan kan bygga varje giltig kod. Här blir varje
 * standardstorlek × standardslag en egen artikel:
 *
 *   - Koden byggs av modellens egen kodbyggare och läses tillbaka med dess
 *     tolkare; en kod som inte går fram och tillbaka tas inte med.
 *   - Bara värden ur modellen (som i sin tur citerar katalogsidan). Inget
 *     skrivs för hand här -- det var handskrivna värden som gav de
 *     återkommande datafelen.
 *   - Utförandet är katalogens grundutförande: dubbelverkande, inbyggd
 *     magnet för givare, basfäste, standarddämpning, ingen givare.
 *   - Status 'draft': artiklarna syns inte på sajten förrän ägaren sett över
 *     dem och de slås på per serie.
 */
import { CP96_BORES, CP96_LIMITS, CP96_SOURCE, cp96BuildCode, cp96ParseCode } from "../src/lib/catalog/cp96.ts";
import { CQ2_BORES, CQ2_LIMITS, CQ2_SOURCE, cq2BuildCode, cq2ParseCode } from "../src/lib/catalog/cq2.ts";
import { CJ2_BORES, CJ2_LIMITS, CJ2_SOURCE, cj2BuildCode, cj2ParseCode } from "../src/lib/catalog/cj2.ts";
import { C85_BORES, C85_LIMITS, C85_SOURCE, c85BuildCode, c85ParseCode } from "../src/lib/catalog/c85.ts";
import { MHZ2_BORES, MHZ2_LIMITS, MHZ2_SOURCE, mhz2BuildCode, mhz2ParseCode } from "../src/lib/catalog/mhz2.ts";

type Text4 = { sv: string; en: string; de: string; es: string };
/**
 * En serie: en rad per artikel med de värden som varierar, och mallar med
 * {kolumn} för namn, beskrivning och specar. Texterna byggs i databasen ur
 * mallarna, så migrationen bär inte fyra språks text per rad.
 */
type Serie = {
  familj: string;
  fabrikat: string; // brands.slug
  kategori: string; // categories.slug
  ledtid: number;
  rader: Array<Record<string, string | number>>; // måste ha "sku"
  namn: Text4;
  beskrivning: Text4;
  specar: Array<[string, string]>;
};

const mpaTillBar = (mpa: number) => `${Math.round(mpa * 100) / 10} bar`;
const temp = (t: readonly number[]) => `${t[0]}…+${t[1]} °C`;

// ── SMC CP96 (ISO 15552) ─────────────────────────────────────────────────────
function cp96(): Serie {
  const rader: Serie["rader"] = [];
  for (const b of CP96_BORES) {
    // ø125 har inga standardslag (allt på beställning), så alla rader här har dämpning C.
    if (!b.cushion_c) continue;
    for (const slag of b.standard_strokes) {
      const kod = cp96BuildCode({ bore: b.code, mounting: "B", stroke_mm: slag, magnet: true, cushion: true });
      if (!kod || cp96ParseCode(kod) === null) continue;
      rader.push({ sku: kod, bore: b.bore_mm, slag, port: b.port, vmax: b.max_speed_mm_s });
    }
  }
  return {
    familj: "CP96", fabrikat: "smc", kategori: "cylinder", ledtid: 28, rader,
    namn: {
      sv: "SMC CP96 Ø{bore} ISO 15552-cylinder, {slag} mm slag",
      en: "SMC CP96 Ø{bore} ISO 15552 cylinder, {slag} mm stroke",
      de: "SMC CP96 Ø{bore} ISO-15552-Zylinder, {slag} mm Hub",
      es: "SMC CP96 Ø{bore} cilindro ISO 15552, carrera {slag} mm",
    },
    beskrivning: {
      sv: "ISO 15552-cylinder ur SMC serie CP96, borrning Ø{bore} mm, slaglängd {slag} mm, anslutning {port}. Dubbelverkande, inbyggd magnet för givare, basutförande, luftdämpning i båda ändar plus gummidämpning.",
      en: "ISO 15552 cylinder from SMC series CP96, bore Ø{bore} mm, stroke {slag} mm, port {port}. Double-acting, built-in magnet for sensors, basic mounting, air cushion at both ends plus rubber bumper.",
      de: "ISO-15552-Zylinder der SMC-Serie CP96, Kolbendurchmesser Ø{bore} mm, Hub {slag} mm, Anschluss {port}. Doppeltwirkend, integrierter Magnet für Sensoren, Grundausführung, Luftdämpfung an beiden Enden plus Gummipuffer.",
      es: "Cilindro ISO 15552 de la serie SMC CP96, diámetro Ø{bore} mm, carrera {slag} mm, conexión {port}. Doble efecto, imán incorporado para sensores, ejecución básica, amortiguación neumática en ambos extremos más amortiguador de goma.",
    },
    specar: [
      ["bore_mm", "{bore}"],
      ["stroke_mm", "{slag}"],
      ["standard", "ISO 15552"],
      ["mode_of_operation", "Double-acting"],
      ["position_sensing", "Magnetic piston"],
      ["cushioning_types", "Air cushion both ends + rubber bumper"],
      ["port", "{port}"],
      ["max_pressure", mpaTillBar(CP96_LIMITS.max_pressure_mpa)],
      ["min_pressure_mpa", String(CP96_LIMITS.min_pressure_mpa)],
      ["temp_range", `${temp(CP96_LIMITS.temp_c.without_switch)} (utan givare), ${temp(CP96_LIMITS.temp_c.with_switch)} (med givare)`],
      ["max_speed_mm_s", "{vmax}"],
      ["series", "CP96"],
      ["standard_kalla", `${CP96_SOURCE.title}, ${CP96_SOURCE.edition}: How to Order s. 129, standardslag och data s. 130. knowledge_chunks ${CP96_SOURCE.file}`],
    ],
  };
}

// ── SMC CQ2 (kompaktcylinder) ────────────────────────────────────────────────
function cq2(): Serie {
  const rader: Serie["rader"] = [];
  for (const b of CQ2_BORES) {
    for (const slag of b.da_standard_strokes) {
      // Z-spåret följer magneten för ø12–25 och finns alltid för ø32–100 (sida 11).
      const kod = cq2BuildCode({ bore: b.code, action: "D", stroke_mm: slag, mounting: "B", magnet: true, groove: true });
      if (!kod || cq2ParseCode(kod) === null) continue;
      rader.push({ sku: kod, bore: b.bore_mm, slag, kraft: b.force_out_n_05mpa, pmin: b.da_min_pressure_mpa });
    }
  }
  return {
    familj: "CQ2", fabrikat: "smc", kategori: "cylinder", ledtid: 7, rader,
    namn: {
      sv: "SMC CQ2 Ø{bore} kompaktcylinder, {slag} mm slag",
      en: "SMC CQ2 Ø{bore} compact cylinder, {slag} mm stroke",
      de: "SMC CQ2 Ø{bore} Kompaktzylinder, {slag} mm Hub",
      es: "SMC CQ2 Ø{bore} cilindro compacto, carrera {slag} mm",
    },
    beskrivning: {
      sv: "Kompaktcylinder ur SMC serie CQ2, borrning Ø{bore} mm, slaglängd {slag} mm. Dubbelverkande, inbyggd magnet för givare, genomgående hål för montering. Teoretisk kraft utåt {kraft} N vid 0,5 MPa.",
      en: "Compact cylinder from SMC series CQ2, bore Ø{bore} mm, stroke {slag} mm. Double-acting, built-in magnet for sensors, through-hole mounting. Theoretical output force {kraft} N at 0.5 MPa.",
      de: "Kompaktzylinder der SMC-Serie CQ2, Kolbendurchmesser Ø{bore} mm, Hub {slag} mm. Doppeltwirkend, integrierter Magnet für Sensoren, Durchgangsbohrungen zur Befestigung. Theoretische Kraft ausfahrend {kraft} N bei 0,5 MPa.",
      es: "Cilindro compacto de la serie SMC CQ2, diámetro Ø{bore} mm, carrera {slag} mm. Doble efecto, imán incorporado para sensores, montaje con taladros pasantes. Fuerza teórica de avance {kraft} N a 0,5 MPa.",
    },
    specar: [
      ["bore_mm", "{bore}"],
      ["stroke_mm", "{slag}"],
      ["mode_of_operation", "Double-acting"],
      ["position_sensing", "Magnetic piston"],
      ["cylinder_type", "Compact cylinder"],
      ["force_out_n_05mpa", "{kraft}"],
      ["min_pressure_mpa", "{pmin}"],
      ["max_pressure", mpaTillBar(CQ2_LIMITS.max_pressure_mpa)],
      ["temp_range", `${temp(CQ2_LIMITS.temp_c.without_switch)} (utan givare), ${temp(CQ2_LIMITS.temp_c.with_switch)} (med givare)`],
      ["max_speed_mm_s", String(CQ2_LIMITS.speed_mm_s.pneumatic[1])],
      ["series", "CQ2"],
      ["standard_kalla", `${CQ2_SOURCE.title}, ${CQ2_SOURCE.edition}: How to Order s. 785, standardslag s. 786, kraft s. 789. knowledge_chunks ${CQ2_SOURCE.file}`],
    ],
  };
}

// ── SMC CJ2 (rundcylinder ø6–16) ─────────────────────────────────────────────
// Magnet kräver givarfäste i koden: band (B) passar alla borrningar, skena (A)
// bara ø10–16 (sida 9). Grundutförande med gummidämpning, ingen luftdämpning.
function cj2(): Serie {
  const rader: Serie["rader"] = [];
  for (const b of CJ2_BORES) {
    for (const slag of b.standard_strokes) {
      const kod = cj2BuildCode({ bore: b.code, mounting: "B", stroke_mm: slag, magnet: true, switch_mount: "B" });
      if (!kod || cj2ParseCode(kod) === null) continue;
      rader.push({ sku: kod, bore: b.bore_mm, slag, pmin: b.min_pressure_rubber_mpa });
    }
  }
  return {
    familj: "CJ2", fabrikat: "smc", kategori: "cylinder", ledtid: 7, rader,
    namn: {
      sv: "SMC CJ2 Ø{bore} rundcylinder, {slag} mm slag",
      en: "SMC CJ2 Ø{bore} round cylinder, {slag} mm stroke",
      de: "SMC CJ2 Ø{bore} Rundzylinder, {slag} mm Hub",
      es: "SMC CJ2 Ø{bore} cilindro redondo, carrera {slag} mm",
    },
    beskrivning: {
      sv: "Rundcylinder ur SMC serie CJ2 med cylinderrör och kolvstång i rostfritt stål, borrning Ø{bore} mm, slaglängd {slag} mm. Dubbelverkande, inbyggd magnet för givare med givarfäste för band, gummidämpning, basutförande.",
      en: "Round cylinder from SMC series CJ2 with stainless steel cylinder tube and piston rod, bore Ø{bore} mm, stroke {slag} mm. Double-acting, built-in magnet for sensors with band mounting for the sensor, rubber bumper, basic mounting.",
      de: "Rundzylinder der SMC-Serie CJ2 mit Zylinderrohr und Kolbenstange aus Edelstahl, Kolbendurchmesser Ø{bore} mm, Hub {slag} mm. Doppeltwirkend, integrierter Magnet für Sensoren mit Bandbefestigung für den Sensor, Gummipuffer, Grundausführung.",
      es: "Cilindro redondo de la serie SMC CJ2 con tubo y vástago de acero inoxidable, diámetro Ø{bore} mm, carrera {slag} mm. Doble efecto, imán incorporado para sensores con fijación por banda para el sensor, amortiguador de goma, ejecución básica.",
    },
    specar: [
      ["bore_mm", "{bore}"],
      ["stroke_mm", "{slag}"],
      ["mode_of_operation", "Double-acting"],
      ["position_sensing", "Magnetic piston, band-mounted sensor"],
      ["cylinder_type", "Round cylinder"],
      ["cushioning_types", "Rubber bumper"],
      // Materiallistan i katalogen (knowledge_chunks smc-kat-cj2.pdf, chunk 51).
      ["material", "Cylinder tube and piston rod stainless steel, head cover aluminium alloy"],
      ["min_pressure_mpa", "{pmin}"],
      ["max_pressure", mpaTillBar(CJ2_LIMITS.max_pressure_mpa)],
      ["temp_range", `${temp(CJ2_LIMITS.temp_c.without_switch)} (utan givare), ${temp(CJ2_LIMITS.temp_c.with_switch)} (med givare)`],
      ["max_speed_mm_s", String(CJ2_LIMITS.speed_mm_s.rubber[1])],
      ["series", "CJ2"],
      ["standard_kalla", `${CJ2_SOURCE.title}, ${CJ2_SOURCE.edition}: How to Order och standardslag. knowledge_chunks ${CJ2_SOURCE.file}`],
    ],
  };
}

// ── SMC C85 (ISO 6432, ø8–25) ────────────────────────────────────────────────
function c85(): Serie {
  const rader: Serie["rader"] = [];
  for (const b of C85_BORES) {
    for (const slag of b.standard_strokes) {
      const kod = c85BuildCode({ bore: b.code, cover: "N", stroke_mm: slag, magnet: true, switch_mount: "B" });
      if (!kod || c85ParseCode(kod) === null) continue;
      rader.push({ sku: kod, bore: b.bore_mm, slag, pmin: b.min_pressure_rubber_mpa });
    }
  }
  return {
    familj: "C85", fabrikat: "smc", kategori: "cylinder", ledtid: 7, rader,
    namn: {
      sv: "SMC C85 Ø{bore} ISO 6432-cylinder, {slag} mm slag",
      en: "SMC C85 Ø{bore} ISO 6432 cylinder, {slag} mm stroke",
      de: "SMC C85 Ø{bore} ISO-6432-Zylinder, {slag} mm Hub",
      es: "SMC C85 Ø{bore} cilindro ISO 6432, carrera {slag} mm",
    },
    beskrivning: {
      sv: "Minicylinder enligt ISO 6432 ur SMC serie C85, borrning Ø{bore} mm, slaglängd {slag} mm. Dubbelverkande, inbyggd magnet för givare med givarfäste för band, gummidämpning, basgavel med integrerat gaffelfäste.",
      en: "ISO 6432 mini cylinder from SMC series C85, bore Ø{bore} mm, stroke {slag} mm. Double-acting, built-in magnet for sensors with band mounting for the sensor, rubber bumper, basic end cover with integrated clevis.",
      de: "Minizylinder nach ISO 6432 der SMC-Serie C85, Kolbendurchmesser Ø{bore} mm, Hub {slag} mm. Doppeltwirkend, integrierter Magnet für Sensoren mit Bandbefestigung für den Sensor, Gummipuffer, Grunddeckel mit integriertem Gabelanschluss.",
      es: "Minicilindro ISO 6432 de la serie SMC C85, diámetro Ø{bore} mm, carrera {slag} mm. Doble efecto, imán incorporado para sensores con fijación por banda para el sensor, amortiguador de goma, tapa básica con horquilla integrada.",
    },
    specar: [
      ["bore_mm", "{bore}"],
      ["stroke_mm", "{slag}"],
      ["standard", "ISO 6432"],
      ["mode_of_operation", "Double-acting"],
      ["position_sensing", "Magnetic piston, band-mounted sensor"],
      ["cushioning_types", "Rubber bumper"],
      ["min_pressure_mpa", "{pmin}"],
      ["max_pressure", mpaTillBar(C85_LIMITS.max_pressure_mpa)],
      ["temp_range", `${temp(C85_LIMITS.temp_c.without_switch)} (utan givare), ${temp(C85_LIMITS.temp_c.with_switch)} (med givare)`],
      ["max_speed_mm_s", String(C85_LIMITS.speed_mm_s[1])],
      ["series", "C85"],
      ["standard_kalla", `${C85_SOURCE.title}, ${C85_SOURCE.edition}: How to Order och standardslag. knowledge_chunks ${C85_SOURCE.file}`],
    ],
  };
}

// ── SMC MHZ2 (parallellgripdon) ──────────────────────────────────────────────
// Katalogen anger gripkraft PER FINGER vid 0,5 MPa (sida 499). Motorn läser
// grip_force_5bar_N som gripdonets totala kraft, som Festos rader (DHPS anger
// summan för båda backarna), så totalen är två fingrar × katalogvärdet. Normalt
// stängd (C) griper inåt: den inre kraften får en egen nyckel, som motorn inte
// prövar som yttre grepp.
function mhz2(): Serie {
  const rader: Serie["rader"] = [];
  for (const b of MHZ2_BORES) {
    for (const verkan of ["D", "S", "C"]) {
      const kod = mhz2BuildCode({ bore: b.code, action: verkan });
      if (!kod || mhz2ParseCode(kod) === null) continue;
      const perFinger = verkan === "D" ? b.force_d[0] : verkan === "S" ? b.force_no : b.force_nc;
      const tryck = verkan === "D" ? b.pressure_d : b.pressure_s;
      rader.push({
        sku: kod, bore: b.bore_mm, slag: b.stroke_mm, port: b.port,
        verkan_sv: verkan === "D" ? "dubbelverkande" : verkan === "S" ? "enkelverkande, normalt öppen (yttre grepp)" : "enkelverkande, normalt stängd (inre grepp)",
        verkan_en: verkan === "D" ? "double-acting" : verkan === "S" ? "single-acting, normally open (external grip)" : "single-acting, normally closed (internal grip)",
        verkan_de: verkan === "D" ? "doppeltwirkend" : verkan === "S" ? "einfachwirkend, normal offen (Außengreifen)" : "einfachwirkend, normal geschlossen (Innengreifen)",
        verkan_es: verkan === "D" ? "doble efecto" : verkan === "S" ? "simple efecto, normalmente abierta (agarre exterior)" : "simple efecto, normalmente cerrada (agarre interior)",
        mode: verkan === "D" ? "Double-acting" : verkan === "S" ? "Single-acting, normally open" : "Single-acting, normally closed",
        finger: perFinger,
        yttre_total: verkan === "C" ? "" : String(Math.round(perFinger * 2 * 10) / 10),
        inre_total: verkan === "C" ? String(Math.round(perFinger * 2 * 10) / 10) : "",
        inre_finger_d: verkan === "D" ? String(b.force_d[1]) : "",
        pmin: tryck[0], pmax: tryck[1],
        vikt: verkan === "D" ? b.weight_g[0] : b.weight_g[1],
        rep: b.repeatability_mm, cpm: b.max_frequency_cpm,
      });
    }
  }
  return {
    familj: "MHZ2", fabrikat: "smc", kategori: "gripper", ledtid: 7, rader,
    namn: {
      sv: "SMC MHZ2 Ø{bore} parallellgripdon, {verkan_sv}",
      en: "SMC MHZ2 Ø{bore} parallel gripper, {verkan_en}",
      de: "SMC MHZ2 Ø{bore} Parallelgreifer, {verkan_de}",
      es: "SMC MHZ2 Ø{bore} pinza paralela, {verkan_es}",
    },
    beskrivning: {
      sv: "Parallellgripdon med två fingrar ur SMC serie MHZ2, kolvdiameter Ø{bore} mm, {verkan_sv}. Slag {slag} mm (öppning och stängning, båda sidor), gripkraft {finger} N per finger vid 0,5 MPa, repeterbarhet ±{rep} mm, anslutning {port}.",
      en: "Two-finger parallel gripper from SMC series MHZ2, bore Ø{bore} mm, {verkan_en}. Stroke {slag} mm (opening and closing, both sides), gripping force {finger} N per finger at 0.5 MPa, repeatability ±{rep} mm, port {port}.",
      de: "Zweifinger-Parallelgreifer der SMC-Serie MHZ2, Kolbendurchmesser Ø{bore} mm, {verkan_de}. Hub {slag} mm (Öffnen und Schließen, beide Seiten), Greifkraft {finger} N pro Finger bei 0,5 MPa, Wiederholgenauigkeit ±{rep} mm, Anschluss {port}.",
      es: "Pinza paralela de dos dedos de la serie SMC MHZ2, diámetro Ø{bore} mm, {verkan_es}. Carrera {slag} mm (apertura y cierre, ambos lados), fuerza de agarre {finger} N por dedo a 0,5 MPa, repetibilidad ±{rep} mm, conexión {port}.",
    },
    specar: [
      ["bore_mm", "{bore}"],
      ["gripper_type", "Parallel gripper, 2 fingers"],
      ["mode_of_operation", "{mode}"],
      ["stroke_mm", "{slag}"],
      ["gripping_force_per_finger_05mpa_N", "{finger}"],
      ["grip_force_5bar_N", "{yttre_total}"],
      ["grip_force_internal_5bar_N", "{inre_total}"],
      ["gripping_force_internal_per_finger_05mpa_N", "{inre_finger_d}"],
      ["repeatability_mm", "{rep}"],
      ["max_frequency_cpm", "{cpm}"],
      ["weight_g", "{vikt}"],
      ["port", "{port}"],
      ["min_pressure_mpa", "{pmin}"],
      ["max_pressure", mpaTillBar(MHZ2_LIMITS.max_pressure_mpa)],
      ["temp_range", temp(MHZ2_LIMITS.temp_c)],
      ["position_sensing", "Magnetic piston (sensor bracket " + MHZ2_LIMITS.switch_bracket + ")"],
      ["series", "MHZ2"],
      ["standard_kalla", `${MHZ2_SOURCE.title}, ${MHZ2_SOURCE.edition}: specifikationer och gripkraft s. 499. knowledge_chunks ${MHZ2_SOURCE.file}`],
    ],
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────────
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** "Ø{bore} mm" -> 'Ø' || t.bore::text || ' mm'. Okänd kolumn är ett fel, inte tom text. */
function mall(m: string, kolumner: string[]): string {
  const delar = m.split(/\{(\w+)\}/);
  return delar.map((d, i) => {
    if (i % 2 === 0) return d ? q(d) : "";
    if (!kolumner.includes(d)) throw new Error(`Okänd kolumn {${d}} i mallen "${m}"`);
    return `t.${d}::text`;
  }).filter(Boolean).join(" || ") || "''";
}

// CP96, CQ2 (20261119180000), CJ2 och C85 (20261119183000) ligger redan i databasen; --alla tar med dem.
const serier = (Deno.args.includes("--alla") ? [cp96(), cq2(), cj2(), c85()] : []).concat([mhz2()]);
const allaKoder = serier.flatMap((s) => s.rader.map((r) => String(r.sku)));
const dubbletter = allaKoder.filter((s, i, l) => l.indexOf(s) !== i);
if (dubbletter.length) throw new Error(`Samma kod två gånger: ${dubbletter.join(", ")}`);

const ut: string[] = [];
ut.push(`-- Standardartiklar ur katalogmodellerna, som utkast (status 'draft').
-- GENERERAD av scripts/gen-standardartiklar.ts -- redigera inte för hand.
-- ${serier.map((s) => `${s.familj}: ${s.rader.length}`).join(", ")}; totalt ${allaKoder.length}.
--
-- Utkasten syns inte på sajten (alla publika frågor kräver status 'active').
-- Ägaren slår på dem per serie efter genomgång. En befintlig artikel med
-- samma kod rörs inte (on conflict do nothing) -- den kan redan vara aktiv.

begin;
`);
for (const s of serier) {
  const kolumner = Object.keys(s.rader[0]);
  const tabell = `t(${kolumner.join(", ")})`;
  const varden = s.rader.map((r) => `  (${kolumner.map((k) => typeof r[k] === "number" ? String(r[k]) : q(String(r[k]))).join(", ")})`).join(",\n");
  const tmp = `std_${s.familj.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
  ut.push(`-- ${s.familj}: ${s.rader.length} artiklar
create temporary table ${tmp} on commit drop as
select * from (values
${varden}
) as ${tabell};

insert into products (sku, name, name_en, description, description_en, description_de, description_es, family, brand_id, category_id, availability, lead_time_days, status)
select t.sku, ${mall(s.namn.sv, kolumner)}, ${mall(s.namn.en, kolumner)},
  ${mall(s.beskrivning.sv, kolumner)},
  ${mall(s.beskrivning.en, kolumner)},
  ${mall(s.beskrivning.de, kolumner)},
  ${mall(s.beskrivning.es, kolumner)},
  ${q(s.familj)}, (select id from brands where slug = ${q(s.fabrikat)}), (select id from categories where slug = ${q(s.kategori)}),
  'order', ${s.ledtid}, 'draft'
from ${tmp} t
on conflict (sku) do nothing;

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from ${tmp} t
join products p on p.sku = t.sku and p.status = 'draft'
cross join lateral (values
${s.specar.map(([k, v]) => `  (${q(k)}, ${mall(v, kolumner)})`).join(",\n")}
) as s(key, value)
where s.value <> '' and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);
`);
}
ut.push("commit;");
console.log(ut.join("\n"));

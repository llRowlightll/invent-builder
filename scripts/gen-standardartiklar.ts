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

const serier = [cp96(), cq2()];
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
where not exists (select 1 from product_specs x where x.product_id = p.id and x.key = s.key);
`);
}
ut.push("commit;");
console.log(ut.join("\n"));

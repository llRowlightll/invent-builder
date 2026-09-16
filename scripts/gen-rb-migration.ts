/**
 * Genererar migrationen för RB (SMC stötdämpare RB/RBL/RBQ) ur den kanoniska
 * modellen — en ny familj; produkterna "RBQ0806W" m.fl. döps om till de
 * RB-koder deras data beskriver.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-rb-migration.ts > supabase/migrations/<tidsstämpel>_rb.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel RBC1412, RBLC1412 och RBQC2007
 * (sida 1299, 1306, 1310), datatabellerna, noten om RB0604, M6 utan tillval
 * (sida 1295, 1302), och alla 504 kombinationer regler↔modell.
 */
import { RB_MODELS, RB_OPTIONS, RB_ORDER_CODE_TEMPLATE, RB_SERIES, RB_SIZES, RB_SOURCE, RB_TYPE_C, rbBuildCode, rbModel } from "../src/lib/catalog/rb.ts";
import { buildRbDbRules } from "../src/lib/catalog/rb-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "series", step: 1, title_sv: "Serie", title_en: "Series", required: true, type: "single_select", options: opt(RB_SERIES) },
  { id: "type", step: 2, title_sv: "Kåpa eller gummibuffert (standard är bastypen)", title_en: "Cap or bumper (the basic type is standard)", required: false, type: "single_select", options: opt([RB_TYPE_C]) },
  { id: "size", step: 3, title_sv: "Storlek: yttergänga och slag", title_en: "Size: O.D. thread and stroke", required: true, type: "single_select", options: opt(RB_SIZES) },
  { id: "option", step: 4, title_sv: "Muttrar (standard är två sexkantmuttrar)", title_en: "Nuts (two hexagon nuts are standard)", required: false, type: "single_select", options: opt(RB_OPTIONS) },
];

const preamble = `
insert into configurator_families (slug, name, title, description, category_slug)
values ('rb', 'RB', 'RB', '', 'shock-absorber')
on conflict (slug) do update set name = excluded.name;
`;

// ── produktraderna ──────────────────────────────────────────────────────
//
// SMC-RBQ0806W, -RBQ1006W, -RBQ1412W och -RBQ2025W finns inte i katalogen:
// RBQ har storlekarna 1604–3213 (sida 1310) och W finns inte i nyckeln.
// Gänga och slag i raderna är RB-storlekarna 0806, 1006 och 1412 (sida 1299);
// "M20, slag 25" finns inte (M20 har 15 mm, M27 har 25) — raden blir RB2015.
// Ingen tabell pekar på raderna. "Justerbar", "med låsmutter" och "givar-
// kompatibel" stryks: RB ställer in sig själv via porös strypning, muttrarna
// är sexkantmuttrar, givare finns inte (sida 1295, 1299).
const produkt = (gammal: string, series: string, size: string) => {
  const x = rbModel(series, size)!;
  const s = RB_SERIES.find((y) => y.code === series)!;
  const kod = rbBuildCode({ series, size })!;
  const c = rbBuildCode({ series, size, type: "C" });
  return `
update products set
  sku = ${q(`SMC-${kod}`)},
  family = ${q(series)},
  name = ${q(`${kod} Hydraulic Shock Absorber ${x.thread.replace(",", ".")}, stroke ${x.stroke_mm} mm`)},
  description = ${q(`SMC ${kod} hydraulic shock absorber, ${x.thread.replace(",", ".")}, stroke ${x.stroke_mm} mm, max. ${x.energy_j} J per cycle, ${x.freq_per_min} cycles/min, collision speed ${s.speed_m_s[0]}–${s.speed_m_s[1]} m/s, max. allowable thrust ${x.thrust_n} N, −10…80 °C. Self-adjusting porous orifice (no manual adjustment), two hexagon nuts included${c ? `; with cap: ${c}` : ""}${x.foot_part ? `; foot bracket ${x.foot_part}` : ""}. Catalogue page ${s.page}.`)}
where sku = ${q(gammal)};

update product_specs s set value = x.value
from products p, (values
  ('sizes', ${q(x.thread)}),
  ('stroke_mm', ${q(String(x.stroke_mm))}),
  ('temp_range', '-10…+80')
) as x(key, value)
where s.product_id = p.id and p.sku = ${q(`SMC-${kod}`)} and s.key = x.key;

delete from product_specs s using products p
where s.product_id = p.id and p.sku = ${q(`SMC-${kod}`)} and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', ${q(series)}),
  ('thread', ${q(x.thread)}),
  ('energy_j', ${q(String(x.energy_j))}),
  ('max_freq_per_min', ${q(String(x.freq_per_min))}),
  ('max_thrust_n', ${q(String(x.thrust_n))}),
  ('collision_speed_m_s', ${q(`${s.speed_m_s[0]}–${s.speed_m_s[1]}`)}),
  ('order_code_example', ${q(kod)}),
  ('catalogue', ${q(`SMC RB, How to Order och data sida ${s.page}, delar sida ${s.parts_page}`)})
) as x(key, value)
where p.sku = ${q(`SMC-${kod}`)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;
};
const extra = [
  produkt("SMC-RBQ0806W", "RB", "0806"),
  produkt("SMC-RBQ1006W", "RB", "1006"),
  produkt("SMC-RBQ1412W", "RB", "1412"),
  produkt("SMC-RBQ2025W", "RB", "2015"),
].join("\n");

console.log(familyMigrationSql({
  slug: "rb",
  schemaId: "SCHEMA-RB-V1",
  backupDate: "20260916",
  steps,
  template: RB_ORDER_CODE_TEMPLATE,
  title_sv: "SMC RB/RBL/RBQ stötdämpare",
  title_en: "SMC RB/RBL/RBQ shock absorber",
  family_title: "Stötdämpare RB (M6–M27), RBL kylvätsketålig (M10–M27) och RBQ kort typ (M16–M32)",
  family_description: "SMC hydraulic shock absorbers with self-adjusting porous orifice: RB standard (M6–M27, 0.5–147 J), RBL coolant resistant (M10–M27) and RBQ short type for rotating energy (M16–M32, 5° eccentric angle); with cap or rubber bumper (C) and nut options J/N/S/SJ/SN; foot brackets and stopper nuts as separate parts.",
  category_slug: "shock-absorber",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildRbDbRules(),
  doc: { source_file: RB_SOURCE.file, title: `SMC — ${RB_SOURCE.title}` },
  header: `RB: beställnyckeln enligt ${RB_SOURCE.title} (sida 1299, 1306, 1310).
GENERERAD ur src/lib/catalog/rb.ts -- redigera inte för hand.

Ny familj rb i kategorin shock-absorber: {serie}{typ}{storlek}{tillval},
t.ex. RBC1412 (nyckelns exempel sida 1299), RBLC1412 (sida 1306) och
RBQC2007 (sida 1310). Tre serier, 20 modeller, kåpa/buffert och sex
muttertillval; RB0604 utan kåpa och utan tillval.

Produkterna SMC-RBQ0806W/1006W/1412W/2025W (påhittade koder) döps om till
SMC-RB0806, SMC-RB1006, SMC-RB1412 och SMC-RB2015 och får katalogens data;
"max_pressure" stryks (en stötdämpare har inget arbetstryck).`,
  preamble,
  extra,
}));

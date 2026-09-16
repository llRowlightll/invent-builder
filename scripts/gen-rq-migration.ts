/**
 * Genererar migrationen för RQ (SMC kompaktcylinder med luftdämpning) ur den
 * kanoniska modellen — och ersätter familjen 'rdqb', som bara var en av
 * kombinationerna (magnet + genomgående hål) med påhittad mall.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-rq-migration.ts > supabase/migrations/<tidsstämpel>_rq.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel RQB32-50, RDQB32-50-M9BW och
 * RDQL40-50 (sida 1039), RQA32-300C/RDQA40-200C (sida 1053-2), viktexemplet
 * RDQF32-200CM (sida 1053-3), mellanslagen RQB32-47 (sida 1040) och
 * RQA32-115C (sida 1053-3), not 2 om ø20/25 (sida 1039), givartabellen, och
 * 36 000+ kombinationer regler↔modell.
 */
import {
  RQ_BORES,
  RQ_BUMPER,
  RQ_COUNTS,
  RQ_LEADS,
  RQ_MAGNET,
  RQ_MOUNTINGS,
  RQ_MTO,
  RQ_ORDER_CODE_TEMPLATE,
  RQ_ROD_END,
  RQ_SOURCE,
  RQ_SWITCHES,
  RQ_THREADS,
  rqBuildCode,
  rqLongMax,
  rqStandardMax,
} from "../src/lib/catalog/rq.ts";
import { buildRqDbRules } from "../src/lib/catalog/rq-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "magnet", step: 1, title_sv: "Magnet för givare (RQ utan, RDQ med)", title_en: "Auto switch magnet (RQ without, RDQ with)", required: false, type: "single_select", options: opt([RQ_MAGNET]) },
  { id: "mounting", step: 2, title_sv: "Fäste", title_en: "Mounting", required: true, type: "single_select", options: opt(RQ_MOUNTINGS) },
  { id: "bore", step: 3, title_sv: "Borrning", title_en: "Bore size", required: true, type: "single_select", options: opt(RQ_BORES) },
  { id: "thread", step: 4, title_sv: "Portgänga (standard är M5 för ø20/25, Rc för ø32–100)", title_en: "Port thread (M5 for ø20/25 and Rc for ø32–100 are standard)", required: false, type: "single_select", options: opt(RQ_THREADS) },
  { id: "stroke_mm", step: 5, title_sv: "Slag (mm)", title_en: "Stroke (mm)", required: true, type: "numeric", min: 15, max: 300, unit: "mm" },
  { id: "bumper", step: 6, title_sv: "Långslagstyp med gummibuffert", title_en: "Long stroke type with rubber bumper", required: false, type: "single_select", options: opt([RQ_BUMPER]) },
  { id: "rod_end", step: 7, title_sv: "Kolvstångsände (standard är hongänga)", title_en: "Rod end (female thread is standard)", required: false, type: "single_select", options: opt([RQ_ROD_END]) },
  { id: "switch", step: 8, title_sv: "Givare (kräver magnet)", title_en: "Auto switch (needs the magnet)", required: false, type: "single_select", options: opt(RQ_SWITCHES) },
  { id: "lead", step: 9, title_sv: "Givarens kabellängd (standard är 0,5 m)", title_en: "Auto switch lead wire length (0.5 m is standard)", required: false, type: "single_select", options: opt(RQ_LEADS) },
  { id: "count", step: 10, title_sv: "Antal givare (standard är två)", title_en: "Number of auto switches (two is standard)", required: false, type: "single_select", options: opt(RQ_COUNTS) },
  { id: "mto", step: 11, title_sv: "Specialutförande (standardtypen)", title_en: "Made to order (standard type)", required: false, type: "single_select", options: opt(RQ_MTO) },
];

// ── familjen rdqb ersätts av rq ────────────────────────────────────────
//
// 'rdqb' hade fyra påhittade parametrar (borrning, slag, "cushioning",
// "sensing") och mallen 'RDQB-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'.
// Ingen tabell pekar på familjen (product_accessories, knowledge_doc_families
// tomma), och inga produkter pekar på slugen — de fyra produktraderna har
// family = 'RDQB' och flyttas till 'RQ' nedan.
const preamble = `
create schema if not exists backup;
create table if not exists backup.rdqb_before_20260916 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'rdqb'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'rdqb'
  union all
  select 'family', f.id::text, f.slug, coalesce(f.order_code_template, '')
  from configurator_families f where f.slug = 'rdqb'
  union all
  select 'product', p.id::text, p.sku, p.name || ' | ' || coalesce(p.description, '')
  from products p where p.family = 'RDQB'
  union all
  select 'spec', s.id::text, p.sku || '|' || s.key, s.value
  from product_specs s join products p on p.id = s.product_id where p.family = 'RDQB';

delete from configurator_families where slug = 'rdqb';

insert into configurator_families (slug, name, title, description, category_slug)
values ('rq', 'RQ', 'RQ', '', 'cylinder')
on conflict (slug) do update set name = excluded.name;
`;

// ── produktraderna ──────────────────────────────────────────────────────
//
// SMC-RDQB20/25/32/50 är borrningsrader (som SMC-CQ2B12): koden behålls,
// men slaget "150 mm" stämmer för ingen av dem (standardtypen slutar vid
// 50 respektive 100 mm, sida 1040), ø50 har Rc 1/4 och inte G 1/8, och
// temperaturen med magnet är −10…60 °C (sida 1040).
const produkt = (code: string) => {
  const b = RQ_BORES.find((x) => x.code === code)!;
  const ex = rqBuildCode({ bore: code, mounting: "B", stroke_mm: b.standard[b.standard.length - 1], magnet: true })!;
  const sku = `SMC-RDQB${code}`;
  return `
update products set
  family = 'RQ',
  name = ${q(`SMC RQ Compact Cylinder with Air Cushion Ø${code} (RDQB)`)},
  description = ${q(`RQ compact cylinder with air cushion, bore ${code} mm, with auto switch magnet and through-hole mounting (RDQB). Standard strokes ${b.standard.join(", ")} mm, intermediate strokes in 1 mm steps, long stroke type up to ${rqLongMax(b)} mm (rubber bumper C). Port ${b.port.replace(",", ".")}, 0.05–1.0 MPa, −10…60 °C with magnet, 50–500 mm/s. Order code example ${ex} (catalogue page 1039).`)}
where sku = ${q(sku)};

update product_specs s set value = x.value
from products p, (values
  ('series', 'RQ (RDQB: med magnet, genomgående hål)'),
  ('stroke_mm', ${q(`${rqStandardMax(b)} mm (standardtyp, max); långslagstyp med gummibuffert upp till ${rqLongMax(b)} mm`)}),
  ('temp_range', '-10…+60 (med magnet); -10…+70 utan magnet (RQ)')
) as x(key, value)
where s.product_id = p.id and p.sku = ${q(sku)} and s.key = x.key;

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.05'),
  ('port_size', ${q(b.port)}),
  ('cushioning', ${q(`Luftdämpning, effektiv dämpningslängd ${String(b.cushion_mm).replace(".", ",")} mm`)}),
  ('force_out_n_05mpa', ${q(String(b.force_out_n))}),
  ('standard_strokes_mm', ${q(`${b.standard.join(", ")} (standardtyp); ${b.long.join(", ")} (långslagstyp C)`)}),
  ('order_code_example', ${q(ex)}),
  ('catalogue', 'SMC RQ, How to Order sida 1039, data sida 1040, långslagstyp sida 1053-2')
) as x(key, value)
where p.sku = ${q(sku)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;
};
const extra = ["20", "25", "32", "50"].map(produkt).join("\n");

console.log(familyMigrationSql({
  slug: "rq",
  schemaId: "SCHEMA-RQ-V1",
  backupDate: "20260916",
  steps,
  template: RQ_ORDER_CODE_TEMPLATE,
  title_sv: "SMC RQ kompaktcylinder med luftdämpning",
  title_en: "SMC RQ compact cylinder with air cushion",
  family_title: "Kompaktcylinder med luftdämpning RQ/RDQ ø20–100, standardtyp och långslagstyp",
  family_description: "SMC RQ compact cylinder with air cushion (no cushion ring, needle-adjustable): ø20–100, through-hole or both-ends-tapped body, foot, compact foot, flange and double clevis brackets, NPT/G port threads for ø32–100, standard type 15–100 mm and long stroke type with rubber bumper up to 300 mm, intermediate strokes in 1 mm steps, built-in magnet (RDQ) with D-M9/A9/P3DWA auto switches, -XA/-XC4/-XC35 made to order.",
  category_slug: "cylinder",
  stroke_min_mm: 15,
  stroke_max_mm: 300,
  rules: buildRqDbRules(),
  doc: { source_file: RQ_SOURCE.file, title: `SMC — ${RQ_SOURCE.title}` },
  header: `RQ: beställnyckeln enligt ${RQ_SOURCE.title} (sida 1039 och 1053-2).
GENERERAD ur src/lib/catalog/rq.ts -- redigera inte för hand.

Ersätter familjen rdqb (mallen 'RDQB-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
med påhittade värden) med familjen rq. RDQB är bara en kombination i RQ-nyckeln
(magnet D + genomgående hål B): SMC:s kod är
R{magnet}Q{fäste}{ø}{gänga}-{slag}{buffert}{stångände}-{givare}{kabel}{antal}-{special},
t.ex. RQB32-50 och RDQB32-50-M9BW (nyckelns exempel sida 1039) och RQA32-300C
(långslagstypen, sida 1053-2). Fästena, gängorna, långslagstypen, givarna och
specialutförandena fanns inte alls.

Produkterna SMC-RDQB20/25/32/50 flyttas till family = 'RQ' och får rätt slag,
port och temperatur.`,
  preamble,
  extra,
}));

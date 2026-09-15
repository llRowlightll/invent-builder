/**
 * Genererar migrationen för CS1 ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-cs1-migration.ts > supabase/migrations/<tidsstämpel>_cs1.sql
 *
 * VERIFIERINGENS STYRKA: nyckel, maxslag per rör/fäste/magnet, tryckkärls-
 * gränserna, 50 000+ kombinationer regler↔modell och katalogens egna koder
 * CS1L160-500, CDS1L160-300-M9BW och CDS1B125-200.
 */
import {
  CS1_BORES,
  CS1_COUNTS,
  CS1_LEADS,
  CS1_MAGNET,
  CS1_MOUNTINGS,
  CS1_MTO,
  CS1_ORDER_CODE_TEMPLATE,
  CS1_PORTS,
  CS1_SOURCE,
  CS1_SUFFIXES,
  CS1_SWITCHES,
  CS1_TUBING,
  CS1_TYPES,
  CS1_VESSEL,
  cs1BuildCode,
} from "../src/lib/catalog/cs1.ts";
import { buildCs1DbRules } from "../src/lib/catalog/cs1-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const strokeMax = Math.max(...CS1_BORES.map((b) => b.max_foot_mm));
const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(CS1_BORES) },
  { id: "mounting", step: 2, title_sv: "Fäste", title_en: "Mounting", required: true, type: "single_select", options: opt(CS1_MOUNTINGS) },
  { id: "stroke_mm", step: 3, title_sv: "Slaglängd", title_en: "Cylinder stroke", required: true, type: "numeric", min: 1, max: strokeMax, unit: "mm" },
  { id: "magnet", step: 4, title_sv: "Inbyggd magnet", title_en: "Built-in magnet", required: false, type: "single_select", options: opt([CS1_MAGNET]) },
  { id: "tubing", step: 5, title_sv: "Rörmaterial", title_en: "Tubing material", required: false, type: "single_select", options: opt([CS1_TUBING]) },
  { id: "type", step: 6, title_sv: "Typ (standard är smord)", title_en: "Type (lube is standard)", required: false, type: "single_select", options: opt(CS1_TYPES) },
  { id: "port", step: 7, title_sv: "Portgänga", title_en: "Port thread type", required: false, type: "single_select", options: opt(CS1_PORTS) },
  { id: "suffix", step: 8, title_sv: "Tillägg: bälg och dämpning (standard är dämpning i båda ändar)", title_en: "Suffix: rod boot and cushion (cushion both ends is standard)", required: false, type: "single_select", options: opt(CS1_SUFFIXES) },
  { id: "switch", step: 9, title_sv: "Magnetgivare", title_en: "Auto switch", required: false, type: "single_select", options: opt(CS1_SWITCHES) },
  { id: "lead", step: 10, title_sv: "Givarens kabellängd", title_en: "Lead wire length", required: false, type: "single_select", options: opt(CS1_LEADS) },
  { id: "count", step: 11, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(CS1_COUNTS) },
  { id: "mto", step: 12, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(CS1_MTO) },
  { id: "vessel", step: 13, title_sv: "Tryckkärlslagen (Japan)", title_en: "Pressure Vessel Act (Japan)", required: false, type: "single_select", options: opt([CS1_VESSEL]) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-CS1 (seriens samlingsrad) hade borrningarna "125,160,200,250,300"
// (ø140 och ø180 saknades), "stroke_mm = 1200 mm", temperatur -10…+60
// (katalogen: 0…70 °C), max_pressure 10 (katalogen 0,97 MPa) och
// material "Aluminium" (katalogen: aluminiumrör bara för ø125–160 upp till
// 1000/1200 mm slag, stålrör därutöver, sida 620 och 630).
const exempel = cs1BuildCode({ bore: "160", mounting: "L", stroke_mm: 500 })!;
const extra = `
update product_specs s set value = '125, 140, 160, 180, 200, 250, 300'
from products p where s.product_id = p.id and p.sku = 'SMC-CS1' and s.key = 'bore_mm';

update product_specs s set value = 'upp till 1000–1200 mm (fot/kolvstångsfläns 1600–2400) beroende på borrning'
from products p where s.product_id = p.id and p.sku = 'SMC-CS1' and s.key = 'stroke_mm';

update product_specs s set value = '0…+70 (lufthydraul 5…+60)'
from products p where s.product_id = p.id and p.sku = 'SMC-CS1' and s.key = 'temp_range';

update product_specs s set value = '9.7'
from products p where s.product_id = p.id and p.sku = 'SMC-CS1' and s.key = 'max_pressure';

update product_specs s set value = 'Aluminiumrör ø125–140 t.o.m. 1000 mm och ø160 t.o.m. 1200 mm slag, stålrör därutöver och för ø180–300; magnetcylindern CDS1 ø180/200 har hårdanodiserat aluminiumrör'
from products p where s.product_id = p.id and p.sku = 'SMC-CS1' and s.key = 'material';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.05'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC CS1, How to Order sida 620, data sida 621, tryckkärlslagen sida 622')
) as x(key, value)
where p.sku = 'SMC-CS1'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "cs1",
  schemaId: "SCHEMA-CS1-V1",
  backupDate: "20260915",
  steps,
  template: CS1_ORDER_CODE_TEMPLATE,
  title_sv: "SMC CS1 dragstångscylinder ø125–300",
  title_en: "SMC CS1 large-bore tie-rod cylinder",
  family_title: "Dragstångscylinder ø125–300, dubbelverkande enkel kolvstång",
  family_description: "SMC CS1 large-bore tie-rod cylinder, double acting single rod, ø125–300 mm, lube/non-lube/air-hydro, aluminium or steel tube, strokes up to 2400 mm.",
  category_slug: "cylinder",
  stroke_min_mm: 1,
  stroke_max_mm: strokeMax,
  rules: buildCs1DbRules(),
  doc: { source_file: CS1_SOURCE.file, title: `SMC — ${CS1_SOURCE.title}` },
  header: `CS1: beställnyckeln enligt ${CS1_SOURCE.title}.
GENERERAD ur src/lib/catalog/cs1.ts -- redigera inte för hand.

Rättar familjen cs1, som hade mallen 'CS1-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'.
SMC:s kod är C{magnet}S1{fäste}{rör}{typ}{ø}{gänga}-{slag}{tillägg}-{givare}{kabel}{antal}-{special}-{tryckkärl},
t.ex. CDS1L160-300-M9BW (sida 625) och CS1L160-500 (sida 622). Fäste,
rörmaterial, typ, portgänga, tillägg och tryckkärlssymbolen fanns inte alls.

SMC-CS1 får katalogens borrningar, slag, temperatur och tryck.`,
  extra,
}));

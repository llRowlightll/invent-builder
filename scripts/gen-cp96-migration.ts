/**
 * Genererar migrationen för CP96 ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-cp96-migration.ts > supabase/migrations/<tidsstämpel>_cp96.sql
 *
 * VERIFIERINGENS STYRKA: nyckel, tre uttömmande korsningar regler↔modell
 * och katalogens egna koder CP96SB32-100CJW och CP96SDB32-100CJW-M9BWS.
 */
import {
  CP96_BOOTS,
  CP96_BORES,
  CP96_COUNTS,
  CP96_CUSHION,
  CP96_LEADS,
  CP96_MAGNET,
  CP96_MOUNTINGS,
  CP96_MTO,
  CP96_ORDER_CODE_TEMPLATE,
  CP96_ROD,
  CP96_SOURCE,
  CP96_SWITCHES,
  cp96BuildCode,
} from "../src/lib/catalog/cp96.ts";
import { buildCp96DbRules } from "../src/lib/catalog/cp96-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const strokeMax = Math.max(...CP96_BORES.map((b) => b.max_stroke_mm));
const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(CP96_BORES) },
  { id: "mounting", step: 2, title_sv: "Fäste", title_en: "Mounting", required: true, type: "single_select", options: opt(CP96_MOUNTINGS) },
  { id: "stroke_mm", step: 3, title_sv: "Slaglängd", title_en: "Cylinder stroke", required: true, type: "numeric", min: 1, max: strokeMax, unit: "mm" },
  { id: "magnet", step: 4, title_sv: "Inbyggd magnet", title_en: "Built-in magnet", required: false, type: "single_select", options: opt([CP96_MAGNET]) },
  { id: "cushion", step: 5, title_sv: "Dämpning", title_en: "Cushion", required: false, type: "single_select", options: opt([CP96_CUSHION]) },
  { id: "boot", step: 6, title_sv: "Kolvstångsbälg", title_en: "Rod boot", required: false, type: "single_select", options: opt(CP96_BOOTS) },
  { id: "rod", step: 7, title_sv: "Kolvstång", title_en: "Rod", required: false, type: "single_select", options: opt([CP96_ROD]) },
  { id: "switch", step: 8, title_sv: "Magnetgivare", title_en: "Auto switch", required: false, type: "single_select", options: opt(CP96_SWITCHES) },
  { id: "lead", step: 9, title_sv: "Givarens kabellängd", title_en: "Lead wire length", required: false, type: "single_select", options: opt(CP96_LEADS) },
  { id: "count", step: 10, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(CP96_COUNTS) },
  { id: "mto", step: 11, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(CP96_MTO) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-CP96 (seriens samlingsrad) hade "stroke_mm = 1000 mm" och temperatur
// -10…+60; katalogen: standardslag 25–800 (ø125 bara på beställning),
// tillverkas upp till 2000, -20…70 °C utan givare. max_pressure 10 bar stämmer.
const exempel = cp96BuildCode({ bore: "32", mounting: "B", stroke_mm: 100, cushion: true, boot: "J", rod: "W" })!;
const extra = `
update product_specs s set value = '25–800 mm (standard, ø125 på beställning); tillverkas upp till 2000 mm (dubbel kolvstång 1000)'
from products p where s.product_id = p.id and p.sku = 'SMC-CP96' and s.key = 'stroke_mm';

update product_specs s set value = '-20…+70 (utan givare), -10…+60 (med givare)'
from products p where s.product_id = p.id and p.sku = 'SMC-CP96' and s.key = 'temp_range';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.05'),
  ('port_size', 'G1/8 (ø32), G1/4 (ø40–50), G3/8 (ø63–80), G1/2 (ø100–125)'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC CP96, How to Order sida 129, data sida 130')
) as x(key, value)
where p.sku = 'SMC-CP96'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "cp96",
  schemaId: "SCHEMA-CP96-V1",
  backupDate: "20260915",
  steps,
  template: CP96_ORDER_CODE_TEMPLATE,
  title_sv: "SMC CP96 ISO 15552-cylinder",
  title_en: "SMC CP96 ISO 15552 cylinder",
  family_title: "ISO 15552-cylinder ø32–125, dubbelverkande enkel/dubbel kolvstång",
  family_description: "SMC CP96 ISO 15552 profile cylinder, double acting single or double rod, ø32–125 mm, air cushion (plus bumper on ø32–100), strokes up to 2000 mm.",
  category_slug: "cylinder",
  stroke_min_mm: 1,
  stroke_max_mm: strokeMax,
  rules: buildCp96DbRules(),
  doc: { source_file: CP96_SOURCE.file, title: `SMC — ${CP96_SOURCE.title}` },
  header: `CP96: beställnyckeln enligt ${CP96_SOURCE.title}.
GENERERAD ur src/lib/catalog/cp96.ts -- redigera inte för hand.

Rättar familjen cp96, som hade mallen 'CP96-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'.
SMC:s kod är CP96S{magnet}{fäste}{ø}-{slag}{dämpning}{bälg}{stång}-{givare}{kabel}{antal}-{special},
t.ex. CP96SDB32-100CJW-M9BWS (sida 129). Fäste, bälg och dubbel kolvstång
fanns inte alls; dämpningskoden C hör till ø32–100 och saknas för ø125.

SMC-CP96 får katalogens slag, temperatur och portar.`,
  extra,
}));

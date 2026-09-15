/**
 * Genererar migrationen för C85 ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-c85-migration.ts > supabase/migrations/<tidsstämpel>_c85.sql
 *
 * VERIFIERINGENS STYRKA: nyckel, kryssmatriser (fäste × gavel, givare ×
 * fäste × borrning) och katalogens egna koder CD85N20-40CJLV-B-M9BWS och
 * CD85N20-50CNW-B-M9BW. Nivån är CQ2:s.
 */
import {
  C85_ACCESSORIES,
  C85_BOOTS,
  C85_BORES,
  C85_BRACKETS,
  C85_COUNTS,
  C85_COVERS,
  C85_CUSHION,
  C85_LEADS,
  C85_MAGNET,
  C85_MTO,
  C85_ORDER_CODE_TEMPLATE,
  C85_SOURCE,
  C85_SWITCHES,
  C85_SWITCH_MOUNTS,
  c85BuildCode,
} from "../src/lib/catalog/c85.ts";
import { buildC85DbRules } from "../src/lib/catalog/c85-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const strokeMax = Math.max(...C85_BORES.map((b) => b.max_stroke_mm));
const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(C85_BORES) },
  { id: "cover", step: 2, title_sv: "Gaveltyp", title_en: "Head cover type", required: true, type: "single_select", options: opt(C85_COVERS) },
  { id: "stroke_mm", step: 3, title_sv: "Slaglängd", title_en: "Cylinder stroke", required: true, type: "numeric", min: 1, max: strokeMax, unit: "mm" },
  { id: "magnet", step: 4, title_sv: "Inbyggd magnet", title_en: "Built-in magnet", required: false, type: "single_select", options: opt([C85_MAGNET]) },
  { id: "cushion", step: 5, title_sv: "Dämpning", title_en: "Cushion", required: false, type: "single_select", options: opt([C85_CUSHION]) },
  { id: "boot", step: 6, title_sv: "Kolvstångsbälg", title_en: "Rod boot", required: false, type: "single_select", options: opt(C85_BOOTS) },
  { id: "bracket", step: 7, title_sv: "Fäste", title_en: "Mounting bracket", required: false, type: "single_select", options: opt(C85_BRACKETS) },
  { id: "accessory", step: 8, title_sv: "Tillbehör på kolvstången", title_en: "Accessory", required: false, type: "single_select", options: opt(C85_ACCESSORIES) },
  { id: "switch_mount", step: 9, title_sv: "Givarfäste", title_en: "Auto switch mounting type", required: false, type: "single_select", options: opt(C85_SWITCH_MOUNTS) },
  { id: "switch", step: 10, title_sv: "Magnetgivare", title_en: "Auto switch", required: false, type: "single_select", options: opt(C85_SWITCHES) },
  { id: "lead", step: 11, title_sv: "Givarens kabellängd", title_en: "Lead wire length", required: false, type: "single_select", options: opt(C85_LEADS) },
  { id: "count", step: 12, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(C85_COUNTS) },
  { id: "mto", step: 13, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(C85_MTO) },
];

// ── produktraderna ──────────────────────────────────────────────────────────
//
// SMC-C85N16…N25 hade "stroke_mm = 300 mm" och temp -10…+70; katalogen
// säger standardslag upp till 200/300 mm (max 400/1000) och -20…80 °C utan
// givare. SMC-C85N32 och SMC-C85N40 finns inte: ISO 6432 slutar vid ø25.
const produkter = C85_BORES.filter((b) => ["16", "20", "25"].includes(b.code)).map((b) => {
  const std = b.standard_strokes[b.standard_strokes.length - 1];
  const exempel = c85BuildCode({ bore: b.code, cover: "N", stroke_mm: std })!;
  return `
update product_specs s set value = '${std} mm (standard); upp till ${b.max_stroke_mm} mm på begäran'
from products p where s.product_id = p.id and p.sku = ${q(`SMC-C85N${b.code}`)} and s.key = 'stroke_mm';

update product_specs s set value = '-20…+80 (utan givare), -10…+60 (med givare)'
from products p where s.product_id = p.id and p.sku = ${q(`SMC-C85N${b.code}`)} and s.key = 'temp_range';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '${b.standard_strokes.join(", ")}'),
  ('min_pressure_mpa', '${b.min_pressure_rubber_mpa}'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC C85/C75, How to Order sida 6, data sida 7')
) as x(key, value)
where p.sku = ${q(`SMC-C85N${b.code}`)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;
}).join("\n") + `
-- ø32 och ø40 finns inte i C85 (ISO 6432 slutar vid ø25; katalogen är ø8–25).
-- Raderna hänvisar till ingenting och avaktiveras; ingen BOM, offert eller
-- relation pekar på dem (kontrollerat 2026-09-15).
update products set status = 'discontinued' where sku in ('SMC-C85N32', 'SMC-C85N40') and status = 'active';
`;

console.log(familyMigrationSql({
  slug: "c85",
  schemaId: "SCHEMA-C85-V1",
  backupDate: "20260915",
  steps,
  template: C85_ORDER_CODE_TEMPLATE,
  title_sv: "SMC C85 rundcylinder ISO 6432",
  title_en: "SMC C85 ISO 6432 round cylinder",
  family_title: "Rundcylinder ISO 6432 ø8–25, dubbelverkande enkel kolvstång",
  family_description: "SMC C85 ISO 6432 round cylinder, double acting single rod, ø8–25 mm, standard strokes up to 300 mm.",
  category_slug: "cylinder",
  stroke_min_mm: 1,
  stroke_max_mm: strokeMax,
  rules: buildC85DbRules(),
  doc: { source_file: C85_SOURCE.file, title: `SMC — ${C85_SOURCE.title}` },
  header: `C85: beställnyckeln enligt ${C85_SOURCE.title}.
GENERERAD ur src/lib/catalog/c85.ts -- redigera inte för hand.

Rättar familjen c85, som hade mallen 'C85-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'.
SMC:s kod är C{magnet}85{gavel}{ø}-{slag}{dämpning}{bälg}{fäste}{tillbehör}-{givarfäste}-{givare}…,
t.ex. CD85N20-40CJLV-B-M9BWS (sida 6). Gaveltyp, bälg, fäste, tillbehör
och givarfäste fanns inte alls.

SMC-C85N32 och SMC-C85N40 finns inte (ISO 6432 slutar vid ø25) och
avaktiveras. SMC-C85N16–N25 får katalogens slag och temperatur.`,
  extra: produkter,
}));

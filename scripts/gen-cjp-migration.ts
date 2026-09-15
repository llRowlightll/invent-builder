/**
 * Genererar migrationen för CJP ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-cjp-migration.ts > supabase/migrations/<tidsstämpel>_cjp.sql
 *
 * VERIFIERINGENS STYRKA: nyckel, alla 2 160 kombinationer regler↔modell och
 * katalogens egen kod CJPB16-15H4Z-T.
 */
import {
  CJP_BORES,
  CJP_CAPS,
  CJP_MOUNTINGS,
  CJP_MTO,
  CJP_NIPPLES,
  CJP_ORDER_CODE_TEMPLATE,
  CJP_ROD_THREAD,
  CJP_SOURCE,
  CJP_STROKES,
  cjpBuildCode,
} from "../src/lib/catalog/cjp.ts";
import { buildCjpDbRules } from "../src/lib/catalog/cjp-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const strokeMin = Math.min(...CJP_STROKES);
const strokeMax = Math.max(...CJP_STROKES);
const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(CJP_BORES) },
  { id: "mounting", step: 2, title_sv: "Montage", title_en: "Mounting", required: true, type: "single_select", options: opt(CJP_MOUNTINGS) },
  { id: "stroke_mm", step: 3, title_sv: "Slaglängd (5, 10 eller 15)", title_en: "Stroke (5, 10 or 15)", required: true, type: "numeric", min: strokeMin, max: strokeMax, unit: "mm" },
  { id: "nipple", step: 4, title_sv: "Slangnippel", title_en: "Hose nipple", required: false, type: "single_select", options: opt(CJP_NIPPLES) },
  { id: "rod_thread", step: 5, title_sv: "Kolvstångsände", title_en: "Rod end thread", required: false, type: "single_select", options: opt([CJP_ROD_THREAD]) },
  { id: "cap", step: 6, title_sv: "Kolvstångskåpa", title_en: "Rod end cap", required: false, type: "single_select", options: opt(CJP_CAPS) },
  { id: "mto", step: 7, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(CJP_MTO) },
];

// ── produktraderna ──────────────────────────────────────────────────────────
//
// SMC-CJPB4/B6/B10 hade slag "10 mm"/"15 mm"/"20 mm" och max_pressure 10
// (bar); katalogen har slag 5, 10 och 15 mm för alla borrningar och största
// arbetstryck 0,7 MPa (7 bar; 1 MPa är provtrycket).
const produkter = CJP_BORES.filter((b) => ["4", "6", "10"].includes(b.code)).map((b) => {
  const sku = `SMC-CJPB${b.code}`;
  const exempel = cjpBuildCode({ bore: b.code, mounting: "B", stroke_mm: strokeMax })!;
  return `
update product_specs s set value = '${CJP_STROKES.join(", ")} mm'
from products p where s.product_id = p.id and p.sku = ${q(sku)} and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = ${q(sku)} and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '${b.min_pressure_mpa}'),
  ('force_out_n_at_0_5_mpa', '${b.force_out_05_n}'),
  ('spring_return_force_n', '${b.force_in_n}'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC CJP, How to Order och specifikationer sida 1, kraft sida 2')
) as x(key, value)
where p.sku = ${q(sku)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;
}).join("\n");

console.log(familyMigrationSql({
  slug: "cjp",
  schemaId: "SCHEMA-CJP-V1",
  backupDate: "20260915",
  steps,
  template: CJP_ORDER_CODE_TEMPLATE,
  title_sv: "SMC CJP stiftcylinder",
  title_en: "SMC CJP pin cylinder",
  family_title: "Stiftcylinder ø4–16, enkelverkande fjäderretur, slag 5/10/15",
  family_description: "SMC CJP pin cylinder, single acting spring return, ø4/6/10/16 mm, strokes 5, 10 and 15 mm, panel mount or embedded.",
  category_slug: "cylinder",
  stroke_min_mm: strokeMin,
  stroke_max_mm: strokeMax,
  rules: buildCjpDbRules(),
  doc: { source_file: CJP_SOURCE.file, title: `SMC — ${CJP_SOURCE.title}` },
  header: `CJP: beställnyckeln enligt ${CJP_SOURCE.title}.
GENERERAD ur src/lib/catalog/cjp.ts -- redigera inte för hand.

Rättar familjen cjp, som hade mallen 'CJP-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
(CJP har varken dämpning eller givare). SMC:s kod är
CJP{montage}{ø}-{slag}{slangnippel}Z-{gänga}{kåpa}-{special}, t.ex. CJPB16-15H4Z-T
(sida 1). Montage, slangnippel, gänga och kåpa fanns inte alls.

SMC-CJPB4/B6/B10 får katalogens slag (5, 10, 15) och tryck.`,
  extra: produkter,
}));

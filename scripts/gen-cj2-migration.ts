/**
 * Genererar migrationen för CJ2 ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-cj2-migration.ts > supabase/migrations/<tidsstämpel>_cj2.sql
 *
 * VERIFIERINGENS STYRKA: nyckel, kryssmatriser (fäste × borrning × port ×
 * pivot × kolvstångsände; givare × fäste × kabel; special × dämpning ×
 * givare) och katalogens egna koder CDJ2D16-60Z-NW-M9BW-B och
 * CDJ2D10-60Z-N-M9BW-B-X2838. Nivån är C85:s.
 */
import {
  CJ2_BORES,
  CJ2_COUNTS,
  CJ2_CUSHION,
  CJ2_LEADS,
  CJ2_MAGNET,
  CJ2_MOUNTINGS,
  CJ2_MTO,
  CJ2_ORDER_CODE_TEMPLATE,
  CJ2_PIVOT,
  CJ2_PORT,
  CJ2_ROD_ENDS,
  CJ2_SOURCE,
  CJ2_SWITCHES,
  CJ2_SWITCH_MOUNTS,
  cj2BuildCode,
} from "../src/lib/catalog/cj2.ts";
import { buildCj2DbRules } from "../src/lib/catalog/cj2-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const strokeMax = Math.max(...CJ2_BORES.map((b) => b.max_stroke_mm));
const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(CJ2_BORES) },
  { id: "mounting", step: 2, title_sv: "Fäste", title_en: "Mounting", required: true, type: "single_select", options: opt(CJ2_MOUNTINGS) },
  { id: "stroke_mm", step: 3, title_sv: "Slaglängd", title_en: "Cylinder stroke", required: true, type: "numeric", min: 1, max: strokeMax, unit: "mm" },
  { id: "magnet", step: 4, title_sv: "Inbyggd magnet", title_en: "Built-in magnet", required: false, type: "single_select", options: opt([CJ2_MAGNET]) },
  { id: "cushion", step: 5, title_sv: "Dämpning", title_en: "Cushion", required: false, type: "single_select", options: opt([CJ2_CUSHION]) },
  { id: "port", step: 6, title_sv: "Portens läge i gaveln", title_en: "Head cover port location", required: false, type: "single_select", options: opt([CJ2_PORT]) },
  { id: "pivot", step: 7, title_sv: "Pivotfäste", title_en: "Pivot bracket", required: false, type: "single_select", options: opt([CJ2_PIVOT]) },
  { id: "rod_end", step: 8, title_sv: "Kolvstångstillbehör", title_en: "Rod end bracket", required: false, type: "single_select", options: opt(CJ2_ROD_ENDS) },
  { id: "switch_mount", step: 9, title_sv: "Givarfäste", title_en: "Auto switch mounting type", required: false, type: "single_select", options: opt(CJ2_SWITCH_MOUNTS) },
  { id: "switch", step: 10, title_sv: "Magnetgivare", title_en: "Auto switch", required: false, type: "single_select", options: opt(CJ2_SWITCHES) },
  { id: "lead", step: 11, title_sv: "Givarens kabellängd", title_en: "Lead wire length", required: false, type: "single_select", options: opt(CJ2_LEADS) },
  { id: "count", step: 12, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(CJ2_COUNTS) },
  { id: "mto", step: 13, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(CJ2_MTO) },
];

// ── produktraderna ──────────────────────────────────────────────────────────
//
// SMC-CJ2B10/B16 hade "stroke_mm = 200 mm" och max_pressure 10 (bar); katalogen
// säger standardslag upp till 150/200 mm (tillverkas upp till 400), största
// arbetstryck 0,7 MPa (7 bar; 1 MPa är provtrycket) och -10…70 °C utan
// givare. SMC-CJ2 (seriens samlingsrad) hade "bore_mm = 6,8,10,12,16";
// CJ2 är ø6, 10 och 16. SMC-CJ2B20 finns inte: CJ2 slutar vid ø16.
const specar = (sku: string, b: { code: string; standard_strokes: number[]; max_stroke_mm: number; min_pressure_rubber_mpa: number }) => {
  const std = b.standard_strokes[b.standard_strokes.length - 1];
  const exempel = cj2BuildCode({ bore: b.code, mounting: "B", stroke_mm: std })!;
  return `
update product_specs s set value = '${std} mm (standard); tillverkas upp till ${b.max_stroke_mm} mm'
from products p where s.product_id = p.id and p.sku = ${q(sku)} and s.key = 'stroke_mm';

update product_specs s set value = '-10…+70 (utan givare), -10…+60 (med givare)'
from products p where s.product_id = p.id and p.sku = ${q(sku)} and s.key = 'temp_range';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = ${q(sku)} and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '${b.standard_strokes.join(", ")}'),
  ('min_pressure_mpa', '${b.min_pressure_rubber_mpa}'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC CJ2-Z, How to Order sida 74, data sida 75')
) as x(key, value)
where p.sku = ${q(sku)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;
};
const produkter = CJ2_BORES.filter((b) => ["10", "16"].includes(b.code)).map((b) => specar(`SMC-CJ2B${b.code}`, b)).join("\n") + `
-- seriens samlingsrad
update product_specs s set value = '6, 10, 16'
from products p where s.product_id = p.id and p.sku = 'SMC-CJ2' and s.key = 'bore_mm';

update product_specs s set value = '15–200 mm (standard); tillverkas upp till 400 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-CJ2' and s.key = 'stroke_mm';

update product_specs s set value = '-10…+70 (utan givare), -10…+60 (med givare)'
from products p where s.product_id = p.id and p.sku = 'SMC-CJ2' and s.key = 'temp_range';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-CJ2' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('order_code_example', '${cj2BuildCode({ bore: "16", mounting: "B", stroke_mm: 60 })!}'),
  ('catalogue', 'SMC CJ2-Z, How to Order sida 74, data sida 75')
) as x(key, value)
where p.sku = 'SMC-CJ2'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);

-- ø20 finns inte i CJ2 (katalogen är ø6, 10 och 16). Raden hänvisar till
-- ingenting och avaktiveras; ingen BOM, offert, relation eller
-- konkurrentkarta pekar på den (kontrollerat 2026-09-15).
update products set status = 'discontinued' where sku = 'SMC-CJ2B20' and status = 'active';
`;

console.log(familyMigrationSql({
  slug: "cj2",
  schemaId: "SCHEMA-CJ2-V1",
  backupDate: "20260915",
  steps,
  template: CJ2_ORDER_CODE_TEMPLATE,
  title_sv: "SMC CJ2 rund minicylinder",
  title_en: "SMC CJ2 round mini cylinder",
  family_title: "Rund minicylinder ø6–16, dubbelverkande enkel kolvstång",
  family_description: "SMC CJ2 round mini air cylinder, double acting single rod, ø6/10/16 mm, standard strokes 15–200 mm.",
  category_slug: "cylinder",
  stroke_min_mm: 1,
  stroke_max_mm: strokeMax,
  rules: buildCj2DbRules(),
  doc: { source_file: CJ2_SOURCE.file, title: `SMC — ${CJ2_SOURCE.title}` },
  header: `CJ2: beställnyckeln enligt ${CJ2_SOURCE.title}.
GENERERAD ur src/lib/catalog/cj2.ts -- redigera inte för hand.

Rättar familjen cj2, som hade mallen 'CJ2-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'.
SMC:s kod är C{magnet}J2{fäste}{ø}-{slag}{dämpning}{port}Z-{pivot}{kolvstångsände}-{givare}{kabel}{antal}-{givarfäste}-{special},
t.ex. CDJ2D16-60Z-NW-M9BW-B (sida 75). Fäste, port, pivotfäste,
kolvstångstillbehör och givarfäste fanns inte alls.

SMC-CJ2B20 finns inte (CJ2 slutar vid ø16) och avaktiveras. SMC-CJ2,
SMC-CJ2B10 och SMC-CJ2B16 får katalogens borrningar, slag, tryck och
temperatur.`,
  extra: produkter,
}));

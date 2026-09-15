/**
 * Genererar migrationen för MXS ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-mxs-migration.ts > supabase/migrations/<tidsstämpel>_mxs.sql
 *
 * VERIFIERINGENS STYRKA: nyckel, kombinationsmatris och tekniska tabeller,
 * plus katalogens egna koder (MXS12-50ASFR-M9BW, MXS6L-10 …). Kraften
 * kontrollerad mot kolvarean. Nivån är CQ2:s.
 */
import {
  MXS_ADJUSTERS,
  MXS_BORES,
  MXS_COUNTS,
  MXS_FUNCTIONALS,
  MXS_LEADS,
  MXS_MTO,
  MXS_ORDER_CODE_TEMPLATE,
  MXS_PORTS,
  MXS_SOURCE,
  MXS_SWITCHES,
  MXS_SYMMETRIC,
  mxsBuildCode,
} from "../src/lib/catalog/mxs.ts";
import { buildMxsDbRules } from "../src/lib/catalog/mxs-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const strokeMax = Math.max(...MXS_BORES.flatMap((b) => b.strokes));
const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Storlek", title_en: "Bore size", required: true, type: "single_select", options: opt(MXS_BORES) },
  { id: "stroke_mm", step: 2, title_sv: "Slaglängd", title_en: "Stroke", required: true, type: "numeric", min: 10, max: strokeMax, unit: "mm" },
  { id: "port", step: 3, title_sv: "Gängtyp", title_en: "Port thread type", required: false, type: "single_select", options: opt(MXS_PORTS) },
  { id: "symmetric", step: 4, title_sv: "Symmetriskt utförande", title_en: "Symmetric type", required: false, type: "single_select", options: opt([MXS_SYMMETRIC]) },
  { id: "adjuster", step: 5, title_sv: "Slagjustering", title_en: "Adjuster option", required: false, type: "single_select", options: opt(MXS_ADJUSTERS) },
  { id: "functional", step: 6, title_sv: "Funktionsoption", title_en: "Functional option", required: false, type: "single_select", options: opt(MXS_FUNCTIONALS) },
  { id: "switch", step: 7, title_sv: "Magnetgivare", title_en: "Auto switch", required: false, type: "single_select", options: opt(MXS_SWITCHES) },
  { id: "lead", step: 8, title_sv: "Givarens kabellängd", title_en: "Lead wire length", required: false, type: "single_select", options: opt(MXS_LEADS) },
  { id: "count", step: 9, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(MXS_COUNTS) },
  { id: "mto", step: 10, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(MXS_MTO) },
];

// ── produktraderna ──────────────────────────────────────────────────────────
//
// SMC-MXS6…MXS25 hade max_pressure 8 (katalogen: 0,7 MPa) och slag 100/100/
// 150/150/200/200 mm (katalogen: 50/75/100/125/150/150). Båda rättas.
const produkter = MXS_BORES.map((b) => {
  const max = b.strokes[b.strokes.length - 1];
  const exempel = mxsBuildCode({ bore: b.code, stroke_mm: max })!;
  return `
update product_specs s set value = '${max} mm'
from products p where s.product_id = p.id and p.sku = ${q(`SMC-MXS${b.code}`)} and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = ${q(`SMC-MXS${b.code}`)} and s.key = 'max_pressure' and s.value = '8';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '${b.strokes.join(", ")}'),
  ('force_out_n_05mpa', '${b.force_out_n_05mpa}'),
  ('pressure_range_mpa', '0.15–0.7'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC MXS, How to Order sida 64, data sida 65')
) as x(key, value)
where p.sku = ${q(`SMC-MXS${b.code}`)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;
}).join("\n");

console.log(familyMigrationSql({
  slug: "mxs",
  schemaId: "SCHEMA-MXS-V1",
  backupDate: "20260915",
  steps,
  template: MXS_ORDER_CODE_TEMPLATE,
  title_sv: "SMC MXS slidbord",
  title_en: "SMC MXS air slide table",
  family_title: "Luftdrivet slidbord ø6–25, standard och symmetriskt",
  family_description: "SMC MXS air slide table, dual rod, ø6–25 mm, strokes 10–150 mm; symmetric type MXS□L.",
  category_slug: "linear-module",
  stroke_min_mm: 10,
  stroke_max_mm: strokeMax,
  rules: buildMxsDbRules(),
  doc: { source_file: MXS_SOURCE.file, title: `SMC — ${MXS_SOURCE.title}` },
  header: `MXS: beställnyckeln enligt ${MXS_SOURCE.title}.
GENERERAD ur src/lib/catalog/mxs.ts -- redigera inte för hand.

Rättar familjen mxs, som hade mallen 'MXS-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
med påhittade positioner. SMC:s kod är MXS{ø}{gänga}{L}-{slag}{justering}{funktion}-{givare}…,
t.ex. MXS12-50ASFR-M9BW (sida 64). Justering (9 val), funktion (5 val) och
deras kombinationsmatris fanns inte alls.

Produkterna SMC-MXS6–MXS25 hade max_pressure 8 (katalogen: 0,7 MPa) och
slag 100–200 mm (katalogen: 50–150 beroende på storlek). Rättas.`,
  extra: produkter,
}));

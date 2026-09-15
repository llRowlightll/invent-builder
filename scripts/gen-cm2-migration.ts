/**
 * Genererar migrationen för CM2 (Z1) ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-cm2-migration.ts > supabase/migrations/<tidsstämpel>_cm2.sql
 *
 * VERIFIERINGENS STYRKA: nyckel, tre uttömmande korsningar regler↔modell
 * och katalogens egna koder CM2B40-150AZ1, CDM2C20-50Z1-NV-M9BW och
 * CDM2B20-50AZ1-W-M9BWS-XC6A.
 */
import {
  CM2_BOOTS,
  CM2_BORES,
  CM2_COUNTS,
  CM2_CUSHION,
  CM2_LEADS,
  CM2_MAGNET,
  CM2_MOUNTINGS,
  CM2_MTO,
  CM2_ORDER_CODE_TEMPLATE,
  CM2_PIVOT,
  CM2_PORTS,
  CM2_ROD_ENDS,
  CM2_ROD_THREAD,
  CM2_SOURCE,
  CM2_STANDARD_STROKES,
  CM2_SWITCHES,
  cm2BuildCode,
} from "../src/lib/catalog/cm2.ts";
import { buildCm2DbRules } from "../src/lib/catalog/cm2-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const strokeMax = Math.max(...CM2_BORES.map((b) => b.max_stroke_mm));
const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(CM2_BORES) },
  { id: "mounting", step: 2, title_sv: "Fäste", title_en: "Mounting", required: true, type: "single_select", options: opt(CM2_MOUNTINGS) },
  { id: "stroke_mm", step: 3, title_sv: "Slaglängd", title_en: "Cylinder stroke", required: true, type: "numeric", min: 5, max: strokeMax, unit: "mm" },
  { id: "magnet", step: 4, title_sv: "Inbyggd magnet", title_en: "Built-in magnet", required: false, type: "single_select", options: opt([CM2_MAGNET]) },
  { id: "port", step: 5, title_sv: "Portgänga", title_en: "Port thread type", required: false, type: "single_select", options: opt(CM2_PORTS) },
  { id: "cushion", step: 6, title_sv: "Dämpning", title_en: "Cushion", required: false, type: "single_select", options: opt([CM2_CUSHION]) },
  { id: "rod_thread", step: 7, title_sv: "Kolvstångsände", title_en: "Rod end thread", required: false, type: "single_select", options: opt([CM2_ROD_THREAD]) },
  { id: "boot", step: 8, title_sv: "Kolvstångsbälg", title_en: "Rod boot", required: false, type: "single_select", options: opt(CM2_BOOTS) },
  { id: "pivot", step: 9, title_sv: "Pivotfäste", title_en: "Pivot bracket", required: false, type: "single_select", options: opt([CM2_PIVOT]) },
  { id: "rod_end", step: 10, title_sv: "Kolvstångstillbehör", title_en: "Rod end bracket", required: false, type: "single_select", options: opt(CM2_ROD_ENDS) },
  { id: "switch", step: 11, title_sv: "Magnetgivare", title_en: "Auto switch", required: false, type: "single_select", options: opt(CM2_SWITCHES) },
  { id: "lead", step: 12, title_sv: "Givarens kabellängd", title_en: "Lead wire length", required: false, type: "single_select", options: opt(CM2_LEADS) },
  { id: "count", step: 13, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(CM2_COUNTS) },
  { id: "mto", step: 14, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(CM2_MTO) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-CM2 (seriens samlingsrad) hade "stroke_mm = 300 mm" och en IP-klass
// (IP65) som ingen katalogsida anger -- kapslingsklass gäller elutrustning,
// inte en pneumatikcylinder. Slaget rättas, katalogens data läggs till och
// den obelagda IP-raden tas bort. max_pressure 10 bar (1,0 MPa) stämmer.
const exempel = cm2BuildCode({ bore: "40", mounting: "B", stroke_mm: 150, cushion: true })!;
const extra = `
update product_specs s set value = '${CM2_STANDARD_STROKES[0]}–${CM2_STANDARD_STROKES[CM2_STANDARD_STROKES.length - 1]} mm (standard); tillverkas 5–1000/1500/2000 mm (ø20/ø25/ø32–40)'
from products p where s.product_id = p.id and p.sku = 'SMC-CM2' and s.key = 'stroke_mm';

update product_specs s set value = '-10…+70 (utan givare), -10…+60 (med givare)'
from products p where s.product_id = p.id and p.sku = 'SMC-CM2' and s.key = 'temp_range';

-- ingen katalogsida anger en IP-klass; raden var påhittad
delete from product_specs s using products p where s.product_id = p.id and p.sku = 'SMC-CM2' and s.key = 'ip_rating';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '${CM2_STANDARD_STROKES.join(", ")}'),
  ('min_pressure_mpa', '0.05'),
  ('order_code_example', '${exempel}'),
  ('series_note', 'CM2-Z1 (CM2-Z standard DA utgick november 2025)'),
  ('catalogue', 'SMC CM2-Z1, How to Order sida 5, data sida 6')
) as x(key, value)
where p.sku = 'SMC-CM2'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "cm2",
  schemaId: "SCHEMA-CM2-V1",
  backupDate: "20260915",
  steps,
  template: CM2_ORDER_CODE_TEMPLATE,
  title_sv: "SMC CM2 rundcylinder (Z1)",
  title_en: "SMC CM2 round cylinder (Z1)",
  family_title: "Rundcylinder ø20–40, dubbelverkande enkel kolvstång (CM2-Z1)",
  family_description: "SMC CM2-Z1 round air cylinder, double acting single rod, ø20/25/32/40 mm, standard strokes 25–300 mm, 13 mounting styles.",
  category_slug: "cylinder",
  stroke_min_mm: 5,
  stroke_max_mm: strokeMax,
  rules: buildCm2DbRules(),
  doc: { source_file: CM2_SOURCE.file, title: `SMC — ${CM2_SOURCE.title}` },
  header: `CM2: beställnyckeln enligt ${CM2_SOURCE.title}.
GENERERAD ur src/lib/catalog/cm2.ts -- redigera inte för hand.

Rättar familjen cm2, som hade mallen 'CM2-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'.
SMC:s kod (Z1, sida 5) är
C{magnet}M2{fäste}{ø}{gänga}-{slag}{dämpning}{stångände}{bälg}Z1-{pivot}{tillbehör}-{givare}{kabel}{antal}-{special},
t.ex. CDM2C20-50Z1-NV-M9BW (sida 6). Fäste, portgänga, honstång, bälg,
pivotfäste och kolvstångstillbehör fanns inte alls.

Modellen är CM2-Z1: CM2-Z:s standardcylinder utgick i november 2025
(smc-kat-cm2.pdf sida 234). Katalogen smc-kat-cm2-z1.pdf hämtades och
lästes in 2026-09-15 (502 stycken).`,
  extra,
}));

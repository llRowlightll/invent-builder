/**
 * Genererar migrationen för MB ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-mb-migration.ts > supabase/migrations/<tidsstämpel>_mb.sql
 *
 * VERIFIERINGENS STYRKA: nyckel och beställexempel (MDBD32-50Z-NW-M9BW),
 * slagområden per borrning, givartabellens ●/○/—, minsta slag per givare,
 * antal och fäste (egen tabell för tappfästet), kombinationstabellen, och
 * 100 000+ kombinationer regler↔modell.
 */
import {
  MB_BOOTS,
  MB_BORES,
  MB_COUNTS,
  MB_CUSHION,
  MB_KNUCKLES,
  MB_LEADS,
  MB_MAGNET,
  MB_MOUNTINGS,
  MB_MTO,
  MB_ORDER_CODE_TEMPLATE,
  MB_PIVOT,
  MB_PORTS,
  MB_SOURCE,
  MB_SWITCHES,
  mbBuildCode,
} from "../src/lib/catalog/mb.ts";
import { buildMbDbRules } from "../src/lib/catalog/mb-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const strokeMax = Math.max(...MB_BORES.map((b) => b.max_mm));
const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(MB_BORES) },
  { id: "mounting", step: 2, title_sv: "Fäste", title_en: "Mounting", required: true, type: "single_select", options: opt(MB_MOUNTINGS) },
  { id: "stroke_mm", step: 3, title_sv: "Slaglängd", title_en: "Cylinder stroke", required: true, type: "numeric", min: 1, max: strokeMax, unit: "mm" },
  { id: "magnet", step: 4, title_sv: "Inbyggd magnet", title_en: "Built-in magnet", required: false, type: "single_select", options: opt([MB_MAGNET]) },
  { id: "port", step: 5, title_sv: "Portgänga", title_en: "Port thread type", required: false, type: "single_select", options: opt(MB_PORTS) },
  { id: "cushion", step: 6, title_sv: "Dämpning (standard är luftdämpning)", title_en: "Cushion (air cushion is standard)", required: false, type: "single_select", options: opt([MB_CUSHION]) },
  { id: "boot", step: 7, title_sv: "Bälg", title_en: "Rod boot", required: false, type: "single_select", options: opt(MB_BOOTS) },
  { id: "pivot", step: 8, title_sv: "Tillbehör 1: pivotfäste", title_en: "Accessory 1: pivot bracket", required: false, type: "single_select", options: opt([MB_PIVOT]) },
  { id: "knuckle", step: 9, title_sv: "Tillbehör 2: knäled", title_en: "Accessory 2: knuckle joint", required: false, type: "single_select", options: opt(MB_KNUCKLES) },
  { id: "switch", step: 10, title_sv: "Magnetgivare", title_en: "Auto switch", required: false, type: "single_select", options: opt(MB_SWITCHES) },
  { id: "lead", step: 11, title_sv: "Givarens kabellängd (standard 0,5 m)", title_en: "Lead wire length (0.5 m is standard)", required: false, type: "single_select", options: opt(MB_LEADS) },
  { id: "count", step: 12, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(MB_COUNTS) },
  { id: "mto", step: 13, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(MB_MTO) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-MB: kontrolleras och rättas mot katalogen (sida 483): tryck 0,05–1,0
// MPa, slag upp till 2700 (standard till 1000), −10…70 °C. Specen
// "standard = ISO 15552" saknar källa (katalogen nämner inte ISO alls; MB är
// SMC:s egen dragstångskonstruktion) och tas bort; "material = Aluminium"
// får konstruktionstabellens material (sida 484).
const exempel = mbBuildCode({ bore: "32", mounting: "D", stroke_mm: 50, magnet: true, pivot: "N", knuckle: "W", switch: "M9BW" })!;
const extra = `
update product_specs s set value = '32, 40, 50, 63, 80, 100, 125'
from products p where s.product_id = p.id and p.sku = 'SMC-MB' and s.key = 'bore_mm';

update product_specs s set value = 'standard 25–1000 mm beroende på borrning, upp till 2700 mm på förfrågan'
from products p where s.product_id = p.id and p.sku = 'SMC-MB' and s.key = 'stroke_mm';

update product_specs s set value = '-10 to +70 (med givare +60)'
from products p where s.product_id = p.id and p.sku = 'SMC-MB' and s.key = 'temp_range';

update product_specs s set value = '10'
from products p where s.product_id = p.id and p.sku = 'SMC-MB' and s.key = 'max_pressure';

update product_specs s set value = 'Cylindertub aluminiumlegering (hårdanodiserad), gavlar pressgjuten aluminium, kolvstång kolstål (hårdkromad), dragstänger kolstål'
from products p where s.product_id = p.id and p.sku = 'SMC-MB' and s.key = 'material';

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-MB' and s.key = 'standard';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.05'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC MB, How to Order sida 482, data och beställexempel sida 483, kombinationstabell sida 480')
) as x(key, value)
where p.sku = 'SMC-MB'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "mb",
  schemaId: "SCHEMA-MB-V1",
  backupDate: "20260915",
  steps,
  template: MB_ORDER_CODE_TEMPLATE,
  title_sv: "SMC MB dragstångscylinder ø32–125",
  title_en: "SMC MB tie-rod cylinder ø32–125",
  family_title: "Dragstångscylinder ø32–125, dubbelverkande enkel kolvstång",
  family_description: "SMC MB tie-rod cylinder, double acting single rod, ø32–125 mm, air cushion or rubber bumper, seven mountings, strokes up to 2700 mm.",
  category_slug: "cylinder",
  stroke_min_mm: 1,
  stroke_max_mm: strokeMax,
  rules: buildMbDbRules(),
  doc: { source_file: MB_SOURCE.file, title: `SMC — ${MB_SOURCE.title}` },
  header: `MB: beställnyckeln enligt ${MB_SOURCE.title} (sida 482–483).
GENERERAD ur src/lib/catalog/mb.ts -- redigera inte för hand.

Rättar familjen mb, som hade mallen 'MB-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
med Festos dämpningskoder. SMC:s kod är
M{magnet}B{fäste}{ø}{gänga}-{slag}{dämpning}{bälg}Z-{pivot}{knäled}-{givare}{kabel}{antal}-{special},
t.ex. MDBD32-50Z-NW-M9BW (beställexemplet sida 483). Fäste, gänga, bälg,
pivotfäste, knäled, givare och specialutföranden fanns inte alls.

SMC-MB får katalogens borrningar, slag, temperatur, tryck och material;
den källösa specen 'standard = ISO 15552' tas bort.`,
  extra,
}));

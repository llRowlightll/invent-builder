/**
 * Genererar migrationen för MHC2 ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-mhc2-migration.ts > supabase/migrations/<tidsstämpel>_mhc2.sql
 *
 * VERIFIERINGENS STYRKA: nyckel och exempel (MHC2-20D-M9BW), modelltabellen
 * sida 808, givartabellens ●/○, specialutförandena, och alla 14 256
 * kombinationer regler↔modell.
 */
import {
  MHC2_ACTIONS,
  MHC2_BORES,
  MHC2_COUNT,
  MHC2_LEADS,
  MHC2_MTO,
  MHC2_ORDER_CODE_TEMPLATE,
  MHC2_SOURCE,
  MHC2_SWITCHES,
  mhc2BuildCode,
} from "../src/lib/catalog/mhc2.ts";
import { buildMhc2DbRules } from "../src/lib/catalog/mhc2-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(MHC2_BORES) },
  { id: "action", step: 2, title_sv: "Verkan", title_en: "Action", required: true, type: "single_select", options: opt(MHC2_ACTIONS) },
  { id: "switch", step: 3, title_sv: "Magnetgivare (kroppen har inbyggd magnet)", title_en: "Auto switch (the body has a built-in magnet)", required: false, type: "single_select", options: opt(MHC2_SWITCHES) },
  { id: "lead", step: 4, title_sv: "Givarens kabellängd (standard 0,5 m)", title_en: "Lead wire length (0.5 m is standard)", required: false, type: "single_select", options: opt(MHC2_LEADS) },
  { id: "count", step: 5, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt([MHC2_COUNT]) },
  { id: "mto", step: 6, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(MHC2_MTO) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-MHC2 hette "3-Finger Radial Gripper" med "3-jaw radial gripper.
// Angular opening 14–34°" — det är MHS3, inte MHC2. MHC2 är tvåfingrigt
// vinkelgripdon med öppningsvinkel 30° till −10° (sida 807–808); högsta
// tryck är 0,6 MPa (specen sade 7 bar).
const exempel = mhc2BuildCode({ bore: "20", action: "D", switch: "M9BW" })!;
const extra = `
update products set
  name = 'MHC2 – Angular Gripper ø10–25',
  description = 'Angular type air gripper, two fingers, opening/closing angle 30° to -10°, ø10/16/20/25, double or single acting, gripping moment 0.10–1.36 N·m, ±0.01 mm repeatability, solid state auto switches. The 3-finger radial gripper is the MHS3, a separate key.'
where sku = 'SMC-MHC2';

update product_specs s set value = '2-finger angular gripper, 30° to -10°'
from products p where s.product_id = p.id and p.sku = 'SMC-MHC2' and s.key = 'type';

update product_specs s set value = '6'
from products p where s.product_id = p.id and p.sku = 'SMC-MHC2' and s.key = 'max_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('bore_mm', '10, 16, 20, 25'),
  ('min_pressure_mpa', '0.1 (enkelverkande 0.25)'),
  ('gripping_moment_nm', '0.10/0.39/0.70/1.36 dubbelverkande, 0.070/0.31/0.54/1.08 enkelverkande (0.5 MPa)'),
  ('repeatability_mm', '0.01'),
  ('material', 'Kropp aluminiumlegering (hårdanodiserad), fingrar martensitiskt rostfritt stål'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC MHC2, How to Order sida 807, data och specialutförande sida 808')
) as x(key, value)
where p.sku = 'SMC-MHC2'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "mhc2",
  schemaId: "SCHEMA-MHC2-V1",
  backupDate: "20260916",
  steps,
  template: MHC2_ORDER_CODE_TEMPLATE,
  title_sv: "SMC MHC2 vinkelgripdon ø10–25",
  title_en: "SMC MHC2 angular gripper ø10–25",
  family_title: "Vinkelgripdon ø10–25, två fingrar, dubbel- eller enkelverkande",
  family_description: "SMC MHC2 angular type air gripper, two fingers, opening/closing angle 30° to -10°, ø10/16/20/25, double or single acting, with solid state auto switches.",
  category_slug: "gripper",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildMhc2DbRules(),
  doc: { source_file: MHC2_SOURCE.file, title: `SMC — ${MHC2_SOURCE.title}` },
  header: `MHC2: beställnyckeln enligt ${MHC2_SOURCE.title} (sida 807–808).
GENERERAD ur src/lib/catalog/mhc2.ts -- redigera inte för hand.

Rättar familjen mhc2, som hade mallen 'MHC2-{size}-{grip_type}{options}'
med flerval och ett slag per käft som MHC2 inte har. SMC:s kod är
MHC2-{ø}{verkan}-{givare}{kabel}{antal}-{special}, t.ex. MHC2-20D-M9BW
(nyckelns exempel sida 807). Verkan, givare med kabellängd och antal och
specialutförandena fanns inte alls.

SMC-MHC2 var beskriven som treffingrigt radialgripdon (det är MHS3);
raden får katalogens namn, typ, tryck och data.`,
  extra,
}));

/**
 * Genererar migrationen för ZH ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-zh-migration.ts > supabase/migrations/<tidsstämpel>_zh.sql
 *
 * VERIFIERINGENS STYRKA: nyckel, tabell 1 och 2 rad för rad, alla port- och
 * tillbehörskombinationer regler↔modell, katalogens egna koder
 * ZH10DSA-06-06-08, ZH10BSA-06-06 och ZH10DSA-06-06-08N.
 */
import {
  ZH_ACCESSORIES,
  ZH_BODIES,
  ZH_NOZZLES,
  ZH_ORDER_CODE_TEMPLATE,
  ZH_PORT_CODES,
  ZH_SOURCE,
  ZH_VACUUMS,
  zhBuildCode,
} from "../src/lib/catalog/zh.ts";
import { buildZhDbRules } from "../src/lib/catalog/zh-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "nozzle", step: 1, title_sv: "Munstycke", title_en: "Nozzle size", required: true, type: "single_select", options: opt(ZH_NOZZLES) },
  { id: "body", step: 2, title_sv: "Kroppstyp", title_en: "Body type", required: true, type: "single_select", options: opt(ZH_BODIES) },
  { id: "vacuum", step: 3, title_sv: "Vakuumtyp", title_en: "Vacuum pressure reached", required: true, type: "single_select", options: opt(ZH_VACUUMS) },
  { id: "sup", step: 4, title_sv: "Matningsport (SUP)", title_en: "SUP port", required: true, type: "single_select", options: opt(ZH_PORT_CODES) },
  { id: "vac", step: 5, title_sv: "Vakuumport (VAC)", title_en: "VAC port", required: true, type: "single_select", options: opt(ZH_PORT_CODES) },
  { id: "exh", step: 6, title_sv: "Utblåsport (EXH), bara kroppsmonterad", title_en: "EXH port, body ported only", required: false, type: "single_select", options: opt(ZH_PORT_CODES) },
  { id: "accessory", step: 7, title_sv: "Tillbehör, bara kroppsmonterad", title_en: "Accessories, body ported only", required: false, type: "single_select", options: opt(ZH_ACCESSORIES) },
];

// ── familjen och produktraderna ─────────────────────────────────────────
//
// Familjen stod som "ZH Valve" i kategorin valve med ventilparametrar
// (spänning, elanslutning); ZH är en vakuumejektor och produkten SMC-ZH
// ligger redan i kategorin vacuum. SMC-ZH05DS-06-06-06 bär den äldre
// koden utan A (katalogen: "existing model ZH05D-06-06-06", sida 745);
// max_pressure 7 bar och vakuum -88 rättas till katalogens 0,6 MPa och
// -90 kPa. SMC-ZH hade vakuum -85 och matning 0,2–0,6.
const exempel = zhBuildCode({ nozzle: "05", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "06" })!;
const extra = `
update configurator_families set category_slug = 'vacuum' where slug = 'zh';

update product_specs s set value = '6'
from products p where s.product_id = p.id and p.sku = 'SMC-ZH05DS-06-06-06' and s.key = 'max_pressure';

update product_specs s set value = '-90'
from products p where s.product_id = p.id and p.sku = 'SMC-ZH05DS-06-06-06' and s.key = 'vacuum_level';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('order_code_example', '${exempel}'),
  ('order_code_note', 'ZH05DS-06-06-06 är den äldre koden; katalogens nya kod är ${exempel} (sida 745)'),
  ('suction_flow_l_min', '6'),
  ('air_consumption_l_min', '13'),
  ('supply_pressure_mpa', '0.1–0.6 (standard 0.45)'),
  ('catalogue', 'SMC ZH, How to Order sida 749–750, data sida 752')
) as x(key, value)
where p.sku = 'SMC-ZH05DS-06-06-06'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);

update product_specs s set value = '-90 (typ S), -48…-66 (typ L)'
from products p where s.product_id = p.id and p.sku = 'SMC-ZH' and s.key = 'vacuum_level';

update product_specs s set value = '0.1…0.6 MPa (standard 0.45)'
from products p where s.product_id = p.id and p.sku = 'SMC-ZH' and s.key = 'supply_pressure';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('nozzle_mm', '0.5, 0.7, 1.0, 1.3, 1.5, 1.8, 2.0'),
  ('order_code_example', '${zhBuildCode({ nozzle: "10", body: "D", vacuum: "S", sup: "06", vac: "06", exh: "08" })!}'),
  ('catalogue', 'SMC ZH, How to Order sida 749–750, data sida 752')
) as x(key, value)
where p.sku = 'SMC-ZH'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "zh",
  schemaId: "SCHEMA-ZH-V1",
  backupDate: "20260915",
  steps,
  template: ZH_ORDER_CODE_TEMPLATE,
  title_sv: "SMC ZH vakuumejektor",
  title_en: "SMC ZH vacuum ejector",
  family_title: "Vakuumejektor ø0,5–2,0, kroppsmonterad eller boxtyp",
  family_description: "SMC ZH vacuum ejector, body ported (SUP/VAC/EXH) or box type with built-in silencer (SUP/VAC), nozzle 0.5–2.0 mm, One-touch or threaded ports.",
  category_slug: "vacuum",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildZhDbRules(),
  doc: { source_file: ZH_SOURCE.file, title: `SMC — ${ZH_SOURCE.title}` },
  header: `ZH: beställnyckeln enligt ${ZH_SOURCE.title}.
GENERERAD ur src/lib/catalog/zh.ts -- redigera inte för hand.

Rättar familjen zh, som hette "ZH Valve", låg i kategorin valve och hade
mallen 'ZH-{size}-{function}-{voltage}-{connection}' med ventilparametrar.
ZH är en vakuumejektor. SMC:s kod är
ZH{munstycke}{kropp}{vakuum}A-{sup}-{vac}-{exh}{tillbehör}, t.ex.
ZH10DSA-06-06-08 (sida 749) och ZH10BSA-06-06 (sida 750).

Katalogen hämtades 2026-09-15 (smc-kat-zh-a.pdf, 126 stycken i
knowledge_chunks); smc-kat-zh.pdf är helrostfria ZH-X267, en egen nyckel.`,
  extra,
}));

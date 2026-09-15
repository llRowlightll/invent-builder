/**
 * Genererar migrationen för LESH ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-lesh-migration.ts > supabase/migrations/<tidsstämpel>_lesh.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel LESH25REJ-50-R1CD17T, styrenhets-
 * nycklarna CD17T och AN1, låstabellen, data per storlek/stigning/motor och
 * 10 000+ kombinationer regler↔modell.
 */
import {
  LESH_BODY,
  LESH_CABLES,
  LESH_CONTROLLERS,
  LESH_CTRL_ACCS,
  LESH_CTRL_MOUNTS,
  LESH_HOLDER,
  LESH_IO_CABLES,
  LESH_LEADS,
  LESH_LOCK,
  LESH_MOTORS,
  LESH_MOUNTS,
  LESH_ORDER_CODE_TEMPLATE,
  LESH_SIZES,
  LESH_SOURCE,
  LESH_STROKES,
  leshBuildCode,
} from "../src/lib/catalog/lesh.ts";
import { buildLeshDbRules } from "../src/lib/catalog/lesh-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "size", step: 1, title_sv: "Storlek", title_en: "Size", required: true, type: "single_select", options: opt(LESH_SIZES) },
  { id: "mount", step: 2, title_sv: "Motorns placering", title_en: "Motor mounting position", required: true, type: "single_select", options: opt(LESH_MOUNTS) },
  { id: "motor", step: 3, title_sv: "Motortyp (standard är stegmotor 24 V DC, inkrementell)", title_en: "Motor type (incremental step motor 24 VDC is standard)", required: false, type: "single_select", options: opt(LESH_MOTORS) },
  { id: "lead", step: 4, title_sv: "Stigning", title_en: "Lead", required: true, type: "single_select", options: opt(LESH_LEADS) },
  { id: "stroke", step: 5, title_sv: "Slaglängd", title_en: "Stroke", required: true, type: "single_select", options: opt(LESH_STROKES) },
  { id: "lock", step: 6, title_sv: "Motortillval", title_en: "Motor option", required: false, type: "single_select", options: opt([LESH_LOCK]) },
  { id: "body", step: 7, title_sv: "Kroppstillval", title_en: "Body option", required: false, type: "single_select", options: opt([LESH_BODY]) },
  { id: "holder", step: 8, title_sv: "Montering", title_en: "Mounting", required: false, type: "single_select", options: opt([LESH_HOLDER]) },
  { id: "cable", step: 9, title_sv: "Aktuatorkabel", title_en: "Actuator cable type/length", required: false, type: "single_select", options: opt(LESH_CABLES) },
  { id: "ctrl", step: 10, title_sv: "Styrenhet (aktuator och styrenhet säljs som ett paket)", title_en: "Controller (actuator and controller are sold as a package)", required: false, type: "single_select", options: opt(LESH_CONTROLLERS) },
  { id: "io_cable", step: 11, title_sv: "I/O-kabel (LEC)", title_en: "I/O cable (LEC)", required: false, type: "single_select", options: opt(LESH_IO_CABLES) },
  { id: "ctrl_mount", step: 12, title_sv: "Styrenhetens montering", title_en: "Controller mounting", required: false, type: "single_select", options: opt(LESH_CTRL_MOUNTS) },
  { id: "ctrl_acc", step: 13, title_sv: "Styrenhetens tillbehör (JXC)", title_en: "Controller accessory (JXC)", required: false, type: "single_select", options: opt(LESH_CTRL_ACCS) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-LESH hade "Stroke 30–300mm" och stroke_mm "400 mm" (katalogen: 50–150
// beroende på storlek) och repeternoggrannhet ±0,01 (katalogen: ±0,05).
const exempel = leshBuildCode({ size: "25", mount: "R", motor: "E", lead: "J", stroke: "50", cable: "R1", ctrl: "CD1", ctrl_mount: "7", ctrl_acc: "T" })!;
const extra = `
update products set
  description = 'Electric slide table, high rigidity type with linear guide. Sizes 8/16/25, strokes 50–150 mm, ±0.05 mm, step motor (incremental or battery-less absolute) or servo motor 24 VDC, JXC/LEC controllers.'
where sku = 'SMC-LESH';

update product_specs s set value = '50–150 (storlek 8: 50/75, 16: 50/100, 25: 50/100/150)'
from products p where s.product_id = p.id and p.sku = 'SMC-LESH' and s.key = 'stroke_mm';

update product_specs s set value = '±0.05'
from products p where s.product_id = p.id and p.sku = 'SMC-LESH' and s.key = 'repeatability_mm';

update product_specs s set value = 'Stegmotor 24 V DC (inkrementell eller batterilös absolut) eller servomotor 24 V DC'
from products p where s.product_id = p.id and p.sku = 'SMC-LESH' and s.key = 'drive';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('size', '8, 16, 25'),
  ('lead_mm', '4/8, 5/10, 8/16'),
  ('max_speed_mm_s', '400'),
  ('ip_rating', 'IP30'),
  ('temp_range', '5 to 40'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC LES/LESH, How to Order sida 705 (absolut) och 715 (inkrementell), styrenheter 706/716, data 707/718/719')
) as x(key, value)
where p.sku = 'SMC-LESH'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "lesh",
  schemaId: "SCHEMA-LESH-V1",
  backupDate: "20260915",
  steps,
  template: LESH_ORDER_CODE_TEMPLATE,
  title_sv: "SMC LESH elektriskt slidbord med hög styvhet",
  title_en: "SMC LESH electric slide table, high rigidity type",
  family_title: "Elektriskt slidbord med hög styvhet, storlek 8–25, med styrenhet",
  family_description: "SMC LESH electric slide table, high rigidity type: sizes 8, 16 and 25, strokes 50–150 mm, step motor (incremental or battery-less absolute) or servo motor 24 VDC, JXC or LEC controller in the same part number.",
  category_slug: "electric-actuator",
  stroke_min_mm: 50,
  stroke_max_mm: 150,
  rules: buildLeshDbRules(),
  doc: { source_file: LESH_SOURCE.file, title: `SMC — ${LESH_SOURCE.title}` },
  header: `LESH: beställnyckeln enligt ${LESH_SOURCE.title} (sida 705 och 715).
GENERERAD ur src/lib/catalog/lesh.ts -- redigera inte för hand.

Rättar familjen lesh, som hade mallen 'LESH-{size}-{stroke_mm}-{motor_mount}'
med fritext (inline/parallel, low/standard/high). SMC:s kod är
LESH{storlek}{fäste}{motor}{stigning}-{slag}{lås}{kropp}{hållare}-{kabel}{styrenhet}{I/O-kabel}{montering}{tillbehör},
t.ex. LESH25REJ-50-R1CD17T (sida 705). Motortyp, lås, dammskydd, sidohållare,
kabel och styrenhet (JXC/LEC, en nyckel i nyckeln) fanns inte alls.

SMC-LESH får katalogens slag, repeternoggrannhet och motorer.`,
  extra,
}));

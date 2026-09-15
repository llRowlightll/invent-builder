/**
 * Genererar migrationen för LEY ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-ley-migration.ts > supabase/migrations/<tidsstämpel>_ley.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel LEY16□□B-30-S1 och styrenhetsnycklarna
 * CD17T/AN1, slagtabellen, noterna 1–16, data per storlek/stigning/motor och
 * 40 000+ kombinationer regler↔modell.
 */
import {
  LEY_CABLES,
  LEY_CONTROLLERS,
  LEY_CTRL_ACCS,
  LEY_CTRL_MOUNTS,
  LEY_IO_CABLES,
  LEY_LEADS,
  LEY_MOTOR,
  LEY_MOTOR_OPTIONS,
  LEY_MOUNTINGS,
  LEY_MOUNTS,
  LEY_ORDER_CODE_TEMPLATE,
  LEY_ROD_END,
  LEY_SIZES,
  LEY_SOURCE,
  leyBuildCode,
} from "../src/lib/catalog/ley.ts";
import { buildLeyDbRules } from "../src/lib/catalog/ley-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const strokeMin = Math.min(...LEY_SIZES.map((s) => s.stroke_range[0]));
const strokeMax = Math.max(...LEY_SIZES.map((s) => s.stroke_range[1]));
const steps: Step[] = [
  { id: "size", step: 1, title_sv: "Storlek", title_en: "Size", required: true, type: "single_select", options: opt(LEY_SIZES) },
  { id: "mount", step: 2, title_sv: "Motorns placering (standard är parallellt på ovansidan)", title_en: "Motor mounting position (top side parallel is standard)", required: false, type: "single_select", options: opt(LEY_MOUNTS) },
  { id: "motor", step: 3, title_sv: "Motortyp (standard är stegmotor 24 V DC)", title_en: "Motor type (step motor 24 VDC is standard)", required: false, type: "single_select", options: opt([LEY_MOTOR]) },
  { id: "lead", step: 4, title_sv: "Stigning", title_en: "Lead", required: true, type: "single_select", options: opt(LEY_LEADS) },
  { id: "stroke_mm", step: 5, title_sv: "Slaglängd", title_en: "Stroke", required: true, type: "numeric", min: strokeMin, max: strokeMax, unit: "mm" },
  { id: "motor_opt", step: 6, title_sv: "Motortillval", title_en: "Motor option", required: false, type: "single_select", options: opt(LEY_MOTOR_OPTIONS) },
  { id: "rod_end", step: 7, title_sv: "Kolvstångsände", title_en: "Rod end thread", required: false, type: "single_select", options: opt([LEY_ROD_END]) },
  { id: "mounting", step: 8, title_sv: "Fäste (standard är gängade ändar och gängad botten)", title_en: "Mounting (ends tapped/body bottom tapped is standard)", required: false, type: "single_select", options: opt(LEY_MOUNTINGS) },
  { id: "cable", step: 9, title_sv: "Aktuatorkabel", title_en: "Actuator cable type/length", required: false, type: "single_select", options: opt(LEY_CABLES) },
  { id: "ctrl", step: 10, title_sv: "Styrenhet (aktuator och styrenhet säljs som ett paket)", title_en: "Controller (actuator and controller are sold as a package)", required: false, type: "single_select", options: opt(LEY_CONTROLLERS) },
  { id: "io_cable", step: 11, title_sv: "I/O-kabel (LEC)", title_en: "I/O cable (LEC)", required: false, type: "single_select", options: opt(LEY_IO_CABLES) },
  { id: "ctrl_mount", step: 12, title_sv: "Styrenhetens montering", title_en: "Controller mounting", required: false, type: "single_select", options: opt(LEY_CTRL_MOUNTS) },
  { id: "ctrl_acc", step: 13, title_sv: "Styrenhetens tillbehör (JXC)", title_en: "Controller accessory (JXC)", required: false, type: "single_select", options: opt(LEY_CTRL_ACCS) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-LEY hade "Stroke 50–600mm. Force up to 1500N" och stroke_mm "1000 mm"
// (katalogen 24 V DC: 30–500 standard, tillverkbart 10–500; tryckkraft upp
// till 1058 N) och storlek 63 (finns bara med AC-servomotor, egen nyckel).
const exempel = leyBuildCode({ size: "16", lead: "B", stroke_mm: 30, cable: "S1" })!;
const extra = `
update products set
  description = 'Electric rod actuator (ball screw). Sizes 16/25/32/40 with step motor or servo motor 24 VDC, strokes 30–500 mm (10–500 to order), pushing force up to 1058 N, ±0.02 mm, JXC/LEC controllers. Sizes 25–63 with AC servo motor (LECS/LECY) are a separate key.'
where sku = 'SMC-LEY';

update product_specs s set value = '30–500 standard (storlek 16: 10–300, 25: 15–400, 32/40: 20–500 tillverkbart)'
from products p where s.product_id = p.id and p.sku = 'SMC-LEY' and s.key = 'stroke_mm';

update product_specs s set value = '±0.02'
from products p where s.product_id = p.id and p.sku = 'SMC-LEY' and s.key = 'repeatability_mm';

update product_specs s set value = 'Stegmotor 24 V DC eller servomotor 24 V DC (storlek 16/25), inkrementell'
from products p where s.product_id = p.id and p.sku = 'SMC-LEY' and s.key = 'drive';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('size', '16, 25, 32, 40'),
  ('lead_mm', '10/5/2.5, 12/6/3, 16/8/4, 16/8/4'),
  ('max_force_n', '1058'),
  ('max_speed_mm_s', '500'),
  ('ip_rating', 'IP40'),
  ('temp_range', '5 to 40'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC LEY, How to Order sida 459, styrenheter och noter 460, data 462 (steg) och 463 (servo)')
) as x(key, value)
where p.sku = 'SMC-LEY'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "ley",
  schemaId: "SCHEMA-LEY-V1",
  backupDate: "20260915",
  steps,
  template: LEY_ORDER_CODE_TEMPLATE,
  title_sv: "SMC LEY elektrisk stångcylinder 24 V DC",
  title_en: "SMC LEY electric rod actuator 24 VDC",
  family_title: "Elektrisk stångcylinder, storlek 16–40, stegmotor eller servomotor 24 V DC, med styrenhet",
  family_description: "SMC LEY electric rod actuator (ball screw): sizes 16, 25, 32 and 40, step motor or servo motor 24 VDC, strokes 30–500 mm, lock/motor cover, foot/flange/clevis mountings, JXC or LEC controller in the same part number.",
  category_slug: "electric-actuator",
  stroke_min_mm: strokeMin,
  stroke_max_mm: strokeMax,
  rules: buildLeyDbRules(),
  doc: { source_file: LEY_SOURCE.file, title: `SMC — ${LEY_SOURCE.title}` },
  header: `LEY: beställnyckeln enligt ${LEY_SOURCE.title} (sida 459–460).
GENERERAD ur src/lib/catalog/ley.ts -- redigera inte för hand.

Rättar familjen ley, som hade mallen 'LEY-{size}-{stroke_mm}-{motor_mount}'
med fritext (inline/parallel, low/standard/high), storlek 63 (bara AC-servo)
och slag 1–1500. SMC:s kod är
LEY{storlek}{fäste}{motor}{stigning}-{slag}{motortillval}{stångände}{montering}-{kabel}{styrenhet}{I/O-kabel}{montering}{tillbehör},
t.ex. LEY16B-30-S1 (sida 459). Motortyp, lås/kåpa, stångände, fästen, kabel och
styrenhet (JXC/LEC, en nyckel i nyckeln, gemensam med LESH) fanns inte alls.

SMC-LEY får katalogens slag, tryckkraft, repeternoggrannhet och motorer.`,
  extra,
}));

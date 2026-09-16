/**
 * Genererar migrationen för MHZ2 ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-mhz2-migration.ts > supabase/migrations/<tidsstämpel>_mhz2.sql
 *
 * VERIFIERINGENS STYRKA: nyckel och exempel (MHZ2-16D-M9BW), modelltabellen
 * sida 499, givartabellens ●/○/— och D-F8:s borrningar, kroppsalternativens
 * tabell, -X46/-X51, och 25 000+ kombinationer regler↔modell.
 */
import {
  MHZ2_ACTIONS,
  MHZ2_BODIES,
  MHZ2_BORES,
  MHZ2_COUNTS,
  MHZ2_FINGERS,
  MHZ2_LEADS,
  MHZ2_MTO,
  MHZ2_ORDER_CODE_TEMPLATE,
  MHZ2_SOURCE,
  MHZ2_SWITCHES,
  mhz2BuildCode,
} from "../src/lib/catalog/mhz2.ts";
import { buildMhz2DbRules } from "../src/lib/catalog/mhz2-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(MHZ2_BORES) },
  { id: "action", step: 2, title_sv: "Verkan", title_en: "Action", required: true, type: "single_select", options: opt(MHZ2_ACTIONS) },
  { id: "finger", step: 3, title_sv: "Fingerläge/-alternativ (standard är basutförande)", title_en: "Finger position/option (basic type is standard)", required: false, type: "single_select", options: opt(MHZ2_FINGERS) },
  { id: "body", step: 4, title_sv: "Kroppsalternativ, ändtapp (ø10–25)", title_en: "Body option, end boss type (ø10–25)", required: false, type: "single_select", options: opt(MHZ2_BODIES) },
  { id: "switch", step: 5, title_sv: "Magnetgivare (kroppen har inbyggd magnet)", title_en: "Auto switch (the body has a built-in magnet)", required: false, type: "single_select", options: opt(MHZ2_SWITCHES) },
  { id: "lead", step: 6, title_sv: "Givarens kabellängd (standard 0,5 m)", title_en: "Lead wire length (0.5 m is standard)", required: false, type: "single_select", options: opt(MHZ2_LEADS) },
  { id: "count", step: 7, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(MHZ2_COUNTS) },
  { id: "mto", step: 8, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(MHZ2_MTO) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-MHZ2 sade "Jaw width 6–40mm" (det är borrningen) och "gripping force
// up to 265N" (katalogen: per finger 254 N yttre/318 N inre grepp för ø40
// vid 0,5 MPa, sida 499). Specen jaw_width_mm ersätts av bore_mm och
// mode_of_operation får även enkelverkande NO/NC.
const exempel = mhz2BuildCode({ bore: "16", action: "D", switch: "M9BW" })!;
const extra = `
update products set
  description = 'Parallel type air gripper, two fingers, ø6/10/16/20/25/32/40, double acting or single acting (normally open/closed). Opening/closing stroke 4–30 mm, gripping force per finger up to 254 N external/318 N internal (ø40, 0.5 MPa), ±0.01 mm repeatability (ø32/40: ±0.02), solid state auto switches, end boss body options and narrow fingers for ø10–25. MHZL2 (long stroke), MHZJ2 (dust cover) and JMHZ2 (compact) are separate keys.'
where sku = 'SMC-MHZ2';

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-MHZ2' and s.key = 'jaw_width_mm';

update product_specs s set value = 'Double-acting or single-acting (normally open/normally closed)'
from products p where s.product_id = p.id and p.sku = 'SMC-MHZ2' and s.key = 'mode_of_operation';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('bore_mm', '6, 10, 16, 20, 25, 32, 40'),
  ('stroke_mm', '4/4/6/10/14/22/30 (öppning/stängning, båda sidor)'),
  ('gripping_force_n', 'per finger vid 0,5 MPa: 3.3–254 yttre, 6.1–318 inre grepp (dubbelverkande)'),
  ('min_pressure_mpa', '0.1 (ø10: 0.2, ø6: 0.15; enkelverkande 0.25–0.35)'),
  ('repeatability_mm', '0.01 (ø32/40: 0.02)'),
  ('material', 'Kropp hårdanodiserad aluminiumlegering, fingrar och styrning härdat rostfritt stål'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC MHZ2, How to Order sida 496–498, data och kroppsalternativ sida 499, specialutförande sida 547–548')
) as x(key, value)
where p.sku = 'SMC-MHZ2'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "mhz2",
  schemaId: "SCHEMA-MHZ2-V1",
  backupDate: "20260916",
  steps,
  template: MHZ2_ORDER_CODE_TEMPLATE,
  title_sv: "SMC MHZ2 parallellgripdon ø6–40",
  title_en: "SMC MHZ2 parallel gripper ø6–40",
  family_title: "Parallellgripdon ø6–40, två fingrar, dubbel- eller enkelverkande",
  family_description: "SMC MHZ2 parallel type air gripper, two fingers, ø6–40, double acting or single acting (normally open/closed), narrow fingers and end boss body options for ø10–25, solid state auto switches.",
  category_slug: "gripper",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildMhz2DbRules(),
  doc: { source_file: MHZ2_SOURCE.file, title: `SMC — ${MHZ2_SOURCE.title}` },
  header: `MHZ2: beställnyckeln enligt ${MHZ2_SOURCE.title} (sida 496–499).
GENERERAD ur src/lib/catalog/mhz2.ts -- redigera inte för hand.

Rättar familjen mhz2, som hade mallen 'MHZ2-{size}-{grip_type}{options}'
med flerval och ett slag per käft som MHZ2 inte har. SMC:s kod är
MHZ2-{ø}{verkan}{finger}{kropp}-{givare}{kabel}{antal}-{special}, t.ex.
MHZ2-16D-M9BW (nyckelns exempel sida 497). Verkan, fingerläge,
kroppsalternativ, givare med kabellängd och antal och specialutförandena
fanns inte alls. Katalogen smc-kat-mhz2.pdf var kompaktserien JMHZ2;
standardseriens kapitel hämtades 2026-09-16 (smc-kat-mhz2-std.pdf).

SMC-MHZ2 får katalogens beskrivning, borrningar, slag, gripkraft och data.`,
  extra,
}));

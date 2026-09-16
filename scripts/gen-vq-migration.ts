/**
 * Genererar migrationen för VQ (familjen vq1000: VQ1000/2000 plug-in-ventil
 * och VQ2000 på underplatta) ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-vq-migration.ts > supabase/migrations/<tidsstämpel>_vq.sql
 *
 * VERIFIERINGENS STYRKA: exemplen VQ1100-51, VQ1200-51 (sida 367) och
 * VQ2100-5W1-02 (sida 403), tabellerna för tätning, tillval, spänning, ljus,
 * manöver och kapsling, och 73 000+ kombinationer regler↔modell.
 */
import {
  VQ_ACTUATIONS,
  VQ_CE,
  VQ_ENCLOSURE,
  VQ_FUNCTIONS,
  VQ_LIGHT,
  VQ_ORDER_CODE_TEMPLATE,
  VQ_OVERRIDES,
  VQ_PORT,
  VQ_SEALS,
  VQ_SERIES,
  VQ_SOURCE,
  VQ_THREADS,
  VQ_VOLTAGES,
  vqBuildCode,
} from "../src/lib/catalog/vq.ts";
import { buildVqDbRules } from "../src/lib/catalog/vq-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "series", step: 1, title_sv: "Serie", title_en: "Series", required: true, type: "single_select", options: opt(VQ_SERIES) },
  { id: "actuation", step: 2, title_sv: "Funktion", title_en: "Type of actuation", required: true, type: "single_select", options: opt(VQ_ACTUATIONS) },
  { id: "seal", step: 3, title_sv: "Tätning", title_en: "Seal", required: true, type: "single_select", options: opt(VQ_SEALS) },
  { id: "func", step: 4, title_sv: "Tillval (standard är 0,4 W utan tillval)", title_en: "Function (standard 0.4 W without options is default)", required: false, type: "single_select", options: opt(VQ_FUNCTIONS) },
  { id: "voltage", step: 5, title_sv: "Spolspänning", title_en: "Coil voltage", required: true, type: "single_select", options: opt(VQ_VOLTAGES) },
  { id: "light", step: 6, title_sv: "Ljus/spärrdiod (standard är med)", title_en: "Light/surge voltage suppressor (with is standard)", required: false, type: "single_select", options: opt([VQ_LIGHT]) },
  { id: "override", step: 7, title_sv: "Manuell manöver (standard är olåst tryckknapp, verktyg)", title_en: "Manual override (non-locking push type is standard)", required: false, type: "single_select", options: opt(VQ_OVERRIDES) },
  { id: "enclosure", step: 8, title_sv: "Kapsling (standard är dammskyddad)", title_en: "Enclosure (dust-protected is standard)", required: false, type: "single_select", options: opt([VQ_ENCLOSURE]) },
  { id: "port", step: 9, title_sv: "Underplatta (enkelventil)", title_en: "Sub-plate (single unit)", required: false, type: "single_select", options: opt([VQ_PORT]) },
  { id: "thread", step: 10, title_sv: "Underplattans gänga (standard är Rc)", title_en: "Sub-plate thread (Rc is standard)", required: false, type: "single_select", options: opt(VQ_THREADS) },
  { id: "ce", step: 11, title_sv: "CE/UKCA-märkning", title_en: "CE/UKCA marking", required: false, type: "single_select", options: opt([VQ_CE]) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-VQ1101N-5G "VQ1101N 5/2 monostabil G1/8, direkt styrd": plug-in-
// ventilen har ingen egen port (rampen har C3/C4/C6/M5, sida 366), ingen
// grommet G (elanslutningen sitter i rampens kit) och är pilotstyrd.
// Koden VQ1101 är gummitätning, 2-läges enkel; med 24 V DC blir den
// VQ1101-51 (sida 367). Raden döps om i stället för att raderas (ingen
// tabell pekar på den); max_pressure 10 var provtrycket, temperaturen
// -10…60 ska vara -10…50 (sida 375).
const exempel = vqBuildCode({ series: "1", actuation: "1", seal: "1", voltage: "5" })!;
const extra = `
update products set
  sku = 'SMC-${exempel}',
  name = 'VQ1101 5/2 monostabil, plug-in (gummitätning)',
  description = 'Base mounted plug-in 5 port solenoid valve VQ1000, 2-position single (monostable), rubber seal, 24 V DC, with light/surge voltage suppressor, non-locking push override. Ordered for the VV5Q11 manifold (cylinder ports on the manifold: ø3.2/ø4/ø6 One-touch or M5). Order code ${exempel} (catalogue page 367).'
where sku = 'SMC-VQ1101N-5G';

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'port_size';

update product_specs s set value = '5/2 monostabil (2-läges enkel magnet), gummitätning'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'function';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'max_pressure';

update product_specs s set value = '-10 to +50'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'temp_range';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'VQ1000'),
  ('mounting', 'Plug-in i ventilramp VV5Q11 (kit F/P/T/L/S/M); cylinderportar på rampen C3/C4/C6/M5'),
  ('min_pressure_mpa', '0.15'),
  ('power_w', '0.4'),
  ('flow_c', '0.85 dm³/(s·bar) 1→4/2 (gummitätning)'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC VQ1000/2000, How to Order Valves sida 367 (VQ1000) och 371 (VQ2000), underplatta sida 403, data sida 375')
) as x(key, value)
where p.sku = 'SMC-${exempel}'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "vq1000",
  schemaId: "SCHEMA-VQ1000-V1",
  backupDate: "20260916",
  steps,
  template: VQ_ORDER_CODE_TEMPLATE,
  title_sv: "SMC VQ1000/2000 5-portsventil, plug-in eller på underplatta",
  title_en: "SMC VQ1000/2000 5 port solenoid valve, plug-in or on sub-plate",
  family_title: "5-portsventil VQ1000/2000, basmonterad plug-in för ventilramp (VQ2000 även på underplatta)",
  family_description: "SMC VQ1000/2000 base mounted plug-in 5 port solenoid valve for the VV5Q11/VV5Q21 manifolds: 2-position single/double, 3-position and 4-position dual 3-port, metal or rubber seal, high-speed/high-pressure/negative common/external pilot options, DC or AC, IP65 and sub-plate single unit for VQ2000.",
  category_slug: "valve",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildVqDbRules(),
  doc: { source_file: VQ_SOURCE.file, title: `SMC — ${VQ_SOURCE.title}` },
  header: `VQ: beställnyckeln enligt ${VQ_SOURCE.title} (sida 367, 371 och 403).
GENERERAD ur src/lib/catalog/vq.ts -- redigera inte för hand.

Rättar familjen vq1000, som hade mallen 'VQ1000-{size}-{function}-{voltage}-{connection}'
med påhittade värden. SMC:s kod är
VQ{serie}{funktion}0{tätning}{tillval}-{spänning}{ljus}{manöver}{kapsling}1-{port}{gänga}-{ce},
t.ex. VQ1100-51 och VQ1200-51 (sida 367) och VQ2100-5W1-02 på underplatta
(sida 403); nollan efter funktionen och ettan efter manövern är fasta.
Serien VQ2000, tätning, tillvalen B/K/N/R i bokstavsordning, sex spänningar,
ljus, manöver, kapsling, underplatta och CE-märkning fanns inte alls.

SMC-VQ1101N-5G döps om till SMC-${exempel} (plug-in-ventilen har varken
port eller grommet och är pilotstyrd).`,
  extra,
}));

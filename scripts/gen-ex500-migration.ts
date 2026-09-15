/**
 * Genererar migrationen för EX500 ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-ex500-migration.ts > supabase/migrations/<tidsstämpel>_ex500.sql
 *
 * VERIFIERINGENS STYRKA: katalogen trycker de färdiga artikelnumren
 * EX500-GEN2, EX500-GPN2, EX500-S103, EX500-DXPA, EX500-DXPB, EX500-ACY01-S
 * och grenkabelns nyckel EX500-AC□□□-SSPS/SAPA — alla reproducerade.
 */
import {
  EX500_CABLE_CONNECTORS,
  EX500_CONNECTORS,
  EX500_LENGTHS,
  EX500_ORDER_CODE_TEMPLATE,
  EX500_PROTOCOLS,
  EX500_SOURCE,
  EX500_UNITS,
  ex500BuildCode,
} from "../src/lib/catalog/ex500.ts";
import { buildEx500DbRules } from "../src/lib/catalog/ex500-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "unit", step: 1, title_sv: "Enhet", title_en: "Unit", required: true, type: "single_select", options: opt(EX500_UNITS) },
  { id: "protocol", step: 2, title_sv: "Protokoll (gateway-enheten)", title_en: "Protocol (gateway unit)", required: false, type: "single_select", options: opt(EX500_PROTOCOLS) },
  { id: "connector", step: 3, title_sv: "Kontakttyp (ingångsenheten)", title_en: "Connector type (input unit)", required: false, type: "single_select", options: opt(EX500_CONNECTORS) },
  { id: "length", step: 4, title_sv: "Kabellängd (grenkabeln)", title_en: "Cable length (branch cable)", required: false, type: "single_select", options: opt(EX500_LENGTHS) },
  { id: "cable_conn", step: 5, title_sv: "Kontaktutförande (grenkabeln)", title_en: "Connector specification (branch cable)", required: false, type: "single_select", options: opt(EX500_CABLE_CONNECTORS) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-EX500-Q011 "EX500 4-stations EtherNet/IP" finns inte i katalogen:
// EX500 har inga stationer, och Q011 är inget artikelnummer. Raden döps om
// till gateway-enheten EX500-GEN2 (samma id), som är det EtherNet/IP-
// artikelnummer raden syftade på. Specarna stations/valve_standard var
// påhittade.
const exempel = ex500BuildCode({ unit: "G", protocol: "EN2" })!;
const extra = `
update products set
  sku = 'SMC-${exempel}',
  name = '${exempel} – Gateway Unit, EtherNet/IP (Gateway Decentralized System 2)',
  family = 'EX500',
  description = 'Gateway unit for the EX500 decentralized fieldbus system: EtherNet/IP, 128 inputs/128 outputs, 4 branch ports for SI units (valve manifolds) and input units, web server, IP65.',
  fieldbus = 'EtherNet/IP',
  voltage = '24 VDC',
  ip_rating = 'IP65'
where sku = 'SMC-EX500-Q011';

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key in ('stations', 'valve_standard');

update product_specs s set value = 'EtherNet/IP'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'fieldbus';

update product_specs s set value = '24 VDC'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'solenoid_voltage';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'EX500'),
  ('io_points', '128 ingångar/128 utgångar'),
  ('branch_ports', '4 (32 in/32 ut per gren, grenkabel max 20 m)'),
  ('ip_rating', 'IP65'),
  ('temp_range', '-10 to +50'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC EX500, How to Order sida 1449 (GW), 1451 (SI), 1452 (ingång), 1457 (grenkabel)')
) as x(key, value)
where p.sku = 'SMC-${exempel}'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "ex500",
  schemaId: "SCHEMA-EX500-V1",
  backupDate: "20260915",
  steps,
  template: EX500_ORDER_CODE_TEMPLATE,
  title_sv: "SMC EX500 fältbussystem, gateway-decentraliserat (128 punkter)",
  title_en: "SMC EX500 fieldbus system, gateway decentralized (128 points)",
  family_title: "Fältbussystem: gateway-enhet, SI-enhet, ingångsenhet, grenkabel",
  family_description: "SMC EX500 Gateway Decentralized System 2: gateway unit (EtherNet/IP or PROFINET, 128/128 points), SI units for SY/VQC/S0700/SV manifolds, 16-input units, branch cables and Y branch connectors.",
  category_slug: "valve-terminal",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildEx500DbRules(),
  doc: { source_file: EX500_SOURCE.file, title: `SMC — ${EX500_SOURCE.title}` },
  header: `EX500: beställnycklarna enligt ${EX500_SOURCE.title}.
GENERERAD ur src/lib/catalog/ex500.ts -- redigera inte för hand.

Rättar familjen ex500, som hade mallen 'EX500-{stations}-{fieldbus}-{voltage}'
med protokoll (EtherCAT, IO-Link, PROFIBUS, multipin) och spänningar (230 V AC)
som systemet inte har. EX500 typ 2 är enheter runt en gateway, var och en med
egen nyckel: EX500-G{EN2|PN2}, EX500-S103, EX500-DXP{A|B}, EX500-AC{längd}-{kontakter},
EX500-ACY01-S (sida 1449–1457). Konfiguratorn bygger en enhet i taget.

SMC-EX500-Q011 (påhittat, "4 stationer") döps om till SMC-EX500-GEN2.`,
  extra,
}));

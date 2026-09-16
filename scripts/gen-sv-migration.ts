/**
 * Genererar migrationen för SV (familjen sv1000: EX260-rampens bas för
 * SV1000/2000/3000) ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-sv-migration.ts > supabase/migrations/<tidsstämpel>_sv.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel SS5V1-W10S1NAND-05U-C6 (sida 58),
 * SI-enhetstabellen med artikelnummer, stationsgränserna per P/E-läge och
 * SI-enhet, DIN-noterna, portarna per serie, och 135 000+ kombinationer
 * regler↔modell.
 */
import {
  SV_MOUNTINGS,
  SV_ORDER_CODE_TEMPLATE,
  SV_PE_LOCATIONS,
  SV_PORTS,
  SV_SERIES,
  SV_SI_UNITS,
  SV_SOURCE,
  SV_STATIONS,
  SV_SUP_EXH,
  svBuildCode,
} from "../src/lib/catalog/sv.ts";
import { buildSvDbRules } from "../src/lib/catalog/sv-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "series", step: 1, title_sv: "Serie", title_en: "Series", required: true, type: "single_select", options: opt(SV_SERIES) },
  { id: "si", step: 2, title_sv: "SI-enhet (EX260: protokoll, utgångar, polaritet, kontakt)", title_en: "SI unit (EX260: protocol, outputs, polarity, connector)", required: true, type: "single_select", options: opt(SV_SI_UNITS) },
  { id: "stations", step: 3, title_sv: "Antal ventilstationer", title_en: "Valve stations", required: true, type: "single_select", options: opt(SV_STATIONS) },
  { id: "pe", step: 4, title_sv: "P/E-portarnas läge", title_en: "P, E port location", required: true, type: "single_select", options: opt(SV_PE_LOCATIONS) },
  { id: "supexh", step: 5, title_sv: "SUP/EXH-block (standard är intern pilot utan ljuddämpare)", title_en: "SUP/EXH block assembly (internal pilot without silencer is standard)", required: false, type: "single_select", options: opt(SV_SUP_EXH) },
  { id: "mounting", step: 6, title_sv: "Montering (standard är direktmontering)", title_en: "Mounting (direct mounting is standard)", required: false, type: "single_select", options: opt(SV_MOUNTINGS) },
  { id: "port", step: 7, title_sv: "A/B-portar", title_en: "A, B port size", required: true, type: "single_select", options: opt(SV_PORTS) },
];

// ── produktraden ────────────────────────────────────────────────────────
//
// SMC-SS5V1-W10S1-04 "SV1000 4-stations terminal, G1/8": koden är bara
// början på en ramp (SI-enhet, P/E-läge och portar saknas) och rampen har
// snabbkopplingar ø3,2–ø6, inte G 1/8 (sida 58). Raden döps om till basen
// utan SI-enhet (ingen fältbuss stod i raden), 4 stationer, P/E på
// U-sidan, ø6: SS5V1-W10S10D-04U-C6. Ingen tabell pekar på raden.
const exempel = svBuildCode({ series: "1", si: "0", stations: "04", pe: "U", port: "C6" })!;
const extra = `
update products set
  sku = 'SMC-${exempel}',
  name = 'SV1000 ventilramp 4 stationer, EX260-bas utan SI-enhet, ø6',
  description = 'SV1000 tie-rod manifold base for the EX260 serial system (IP67), 4 stations, without SI unit (add the SI unit by symbol, e.g. NAN for PROFIBUS DP), P/E ports on the U side (ø8), A/B ports ø6 One-touch, internal pilot, direct mounting. Valves SV1100-5FU etc. are ordered per station. Order code ${exempel} (catalogue page 58).'
where sku = 'SMC-SS5V1-W10S1-04';

update product_specs s set value = 'A/B ø6 snabbkoppling, P/E ø8 snabbkoppling'
from products p where s.product_id = p.id and p.sku = 'SMC-${exempel}' and s.key = 'port_size';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'SV1000'),
  ('si_unit', 'Utan (0); EX260-enheter per symbol, sida 58'),
  ('max_pressure', '7'),
  ('min_pressure_mpa', '0.15 (dubbel 0.1, 3-läges 0.2)'),
  ('temp_range', '-10 to +50'),
  ('ip_rating', 'IP67'),
  ('power_w', '0.6 per ventil'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC SV1000/2000/3000/4000, How to Order Manifold (EX260) sida 58, ventilerna sida 59, data sida 27')
) as x(key, value)
where p.sku = 'SMC-${exempel}'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;

console.log(familyMigrationSql({
  slug: "sv1000",
  schemaId: "SCHEMA-SV1000-V1",
  backupDate: "20260916",
  steps,
  template: SV_ORDER_CODE_TEMPLATE,
  title_sv: "SMC SV1000/2000/3000 ventilramp, EX260-bas",
  title_en: "SMC SV1000/2000/3000 manifold, EX260 base",
  family_title: "Ventilramp SV1000/2000/3000 med seriell enhet EX260 (IP67) — basen; ventilerna beställs per station",
  family_description: "SMC SV1000/2000/3000 tie-rod manifold base for the EX260 serial transmission system (IP67): 2–20 stations, SI unit by protocol (DeviceNet, PROFIBUS DP, CC-Link, EtherCAT, PROFINET, EtherNet/IP, POWERLINK) with 32 or 16 outputs, P/E port location, SUP/EXH block, DIN rail mounting and One-touch port sizes. The valves SV□□00-5□□ are ordered per station.",
  category_slug: "valve-terminal",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildSvDbRules(),
  doc: { source_file: SV_SOURCE.file, title: `SMC — ${SV_SOURCE.title}` },
  header: `SV: rampens beställnyckel enligt ${SV_SOURCE.title} (EX260, sida 58).
GENERERAD ur src/lib/catalog/sv.ts -- redigera inte för hand.

Rättar familjen sv1000, som hade mallen 'SV1000-{stations}-{fieldbus}-{voltage}'
med påhittade värden. SMC:s kod för EX260-basen är
SS5V{serie}-W10S1{SI-enhet}D-{stationer}{P/E-läge}{SUP/EXH}-{montering}-{port},
t.ex. SS5V1-W10S1NAND-05U-C6 (nyckelns exempel sida 58). Serierna SV2000/3000,
de trettio SI-enheterna med artikelnummer, stationsgränserna, SUP/EXH-blocket,
DIN-monteringen och portarna fanns inte alls. EX500/EX250-ramperna utgår
(sida 19); EX600, EX126, EX120, rundkontakt, D-sub, flatkabel och kassettbasen
är egna nycklar.

SMC-SS5V1-W10S1-04 döps om till SMC-${exempel}.`,
  extra,
}));

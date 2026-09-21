/**
 * Genererar migrationen för SY plug-in-ventilen (ny familj sy-plugin: SMC
 * SY3000/5000/7000 basmonterad/topportad ventil för ramperna typ 10/11/12)
 * ur den kanoniska modellen — utan produktrader.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-sy-plugin-migration.ts > supabase/migrations/<tidsstämpel>_sy_plugin.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel SY3100-5U1 (sida 432 och 504) och
 * SY3130-5U1-C6 (sida 513), distributörskoderna SY5100R-5UF1/SY3100H-5U1/
 * SY5200-5NZ1, ventildata (sida 404–406) och två uttömmande korskontroller
 * regler↔modell (32 256 + 1 536 kombinationer).
 */
import {
  SYP_ACTUATIONS,
  SYP_BODIES,
  SYP_CHECK_H,
  SYP_COIL_T,
  SYP_LIGHTS,
  SYP_OPTIONS,
  SYP_ORDER_CODE_TEMPLATE,
  SYP_OVERRIDES,
  SYP_PILOT_R,
  SYP_PORTS,
  SYP_SCREWS,
  SYP_SEALS,
  SYP_SERIES,
  SYP_SOURCE,
  SYP_THREADS,
  SYP_VOLTAGES,
} from "../src/lib/catalog/sy-plugin.ts";
import { buildSyPluginDbRules } from "../src/lib/catalog/sy-plugin-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "series", step: 1, title_sv: "Serie", title_en: "Series", required: true, type: "single_select", options: opt(SYP_SERIES) },
  { id: "actuation", step: 2, title_sv: "Funktion", title_en: "Type of actuation", required: true, type: "single_select", options: opt(SYP_ACTUATIONS) },
  { id: "body", step: 3, title_sv: "Kropp (rampens typ)", title_en: "Body (manifold type)", required: true, type: "single_select", options: opt(SYP_BODIES) },
  { id: "seal", step: 4, title_sv: "Tätning", title_en: "Seal type", required: true, type: "single_select", options: opt(SYP_SEALS) },
  { id: "pilot", step: 5, title_sv: "Pilot (standard är intern)", title_en: "Pilot type (internal is standard)", required: false, type: "single_select", options: opt([SYP_PILOT_R]) },
  { id: "check", step: 6, title_sv: "Inbyggd backventil (standard är ingen)", title_en: "Built-in back pressure check valve (none is standard)", required: false, type: "single_select", options: opt([SYP_CHECK_H]) },
  { id: "option", step: 7, title_sv: "Pilotventil (standard är 0,7 MPa)", title_en: "Pilot valve option (0.7 MPa is standard)", required: false, type: "single_select", options: opt(SYP_OPTIONS) },
  { id: "coil", step: 8, title_sv: "Spole (standard är utan strömsparkrets)", title_en: "Coil type (without power saving circuit is standard)", required: false, type: "single_select", options: opt([SYP_COIL_T]) },
  { id: "voltage", step: 9, title_sv: "Märkspänning", title_en: "Rated voltage", required: true, type: "single_select", options: opt(SYP_VOLTAGES) },
  { id: "light", step: 10, title_sv: "Ljus och skyddsdiod (standard är utan)", title_en: "Light/surge voltage suppressor (none is standard)", required: false, type: "single_select", options: opt(SYP_LIGHTS) },
  { id: "override", step: 11, title_sv: "Manöverdon (standard är tryckknapp utan lås)", title_en: "Manual override (non-locking push type is standard)", required: false, type: "single_select", options: opt(SYP_OVERRIDES) },
  { id: "port", step: 12, title_sv: "A/B-port (bara topportad ventil)", title_en: "A/B port (top ported valve only)", required: false, type: "single_select", options: opt(SYP_PORTS) },
  { id: "thread", step: 13, title_sv: "Gängtyp (standard är Rc; bara gängade portar 1/8 och 1/4)", title_en: "Thread type (Rc is standard; threaded ports 1/8 and 1/4 only)", required: false, type: "single_select", options: opt(SYP_THREADS) },
  { id: "screw", step: 14, title_sv: "Monteringsskruv (standard är kombiskruv med rundat huvud)", title_en: "Mounting screw (round head combination screw is standard)", required: false, type: "single_select", options: opt(SYP_SCREWS) },
];

const preamble = `
insert into configurator_families (slug, name, title, description, category_slug)
values ('sy-plugin', 'SY plug-in', 'SY plug-in', '', 'valve')
on conflict (slug) do update set name = excluded.name;
`;

console.log(familyMigrationSql({
  slug: "sy-plugin",
  schemaId: "SCHEMA-SY-PLUGIN-V1",
  backupDate: "20260921",
  steps,
  template: SYP_ORDER_CODE_TEMPLATE,
  title_sv: "SMC SY plug-in-ventil för ventilramp",
  title_en: "SMC SY plug-in valve for manifold",
  family_title: "Plug-in-ventil SY3000/5000/7000 för ventilramp typ 10/11 (basmonterad) och 12 (topportad)",
  family_description: "SMC SY3000/5000/7000 plug-in valve for the connector connecting base manifolds (family sy) and metal base manifolds: 2-position single/double, 3-position closed/exhaust/pressure center or 4-position dual 3-port, rubber or metal seal, internal or external pilot, built-in back pressure check valve, quick response or 1.0 MPa high pressure pilot valve, power saving circuit, 24 or 12 V DC, light/surge suppressor non-polar or positive/negative common, locking manual overrides, top ported version with M5/1/8/1/4 thread or One-touch fittings ø2–ø12 and inch, mounting screw options.",
  category_slug: "valve",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildSyPluginDbRules(),
  doc: { source_file: SYP_SOURCE.file, title: `SMC — ${SYP_SOURCE.title}` },
  header: `SY plug-in-ventil: beställnyckeln enligt ${SYP_SOURCE.title} (sida 432, 504 och 513).
GENERERAD ur src/lib/catalog/sy-plugin.ts -- redigera inte för hand.

Ny familj sy-plugin i kategorin valve:
SY{serie}{funktion}{kropp}{tätning}{pilot}{backventil}{tillval}{spole}-{spänning}{ljus}{manöver}1-{port}{gänga}{skruv},
t.ex. SY3100-5U1 (nyckelns exempel sida 432 och 504) och SY3130-5U1-C6
(topportad, sida 513). Ettan efter manöverdonet ligger fast; tredje tecknet är
kroppen (0 basmonterad, 3 topportad) och fjärde tätningen.

Rampen (SS5Y…) är familjen sy; ventilerna beställs per station.`,
  preamble,
}));

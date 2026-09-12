/**
 * Genererar migrationen för EPCO ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-epco-migration.ts > supabase/migrations/<tidsstämpel>_epco.sql
 *
 * VERIFIERINGENS STYRKA: den högsta sedan KPZ. Festo trycker 28 FÄRDIGA
 * artikelnummer med sina typkoder bredvid, så garantin är inte bara "koden
 * följer nyckeln" utan "modellen reproducerar tjugoåtta koder Festo själv har
 * skrivit ut". Se `epco.test.ts`.
 */
import {
  EPCO_ARTICLES,
  EPCO_BRAKES,
  EPCO_BUS,
  EPCO_CABLES,
  EPCO_CABLE_DIRECTIONS,
  EPCO_CONTROLLERS,
  EPCO_GUIDE_UNITS,
  EPCO_LIMITS,
  EPCO_MEASURING,
  EPCO_ORDER_CODE_TEMPLATE,
  EPCO_POSITION_SENSING,
  EPCO_ROD_THREADS,
  EPCO_SIZES,
  EPCO_SOURCE,
  EPCO_SPINDLES,
  EPCO_SWITCHING,
  epcoSpindle,
} from "../src/lib/catalog/epco.ts";
import { buildEpcoDbRules } from "../src/lib/catalog/epco-db-rules.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMA_ID = "SCHEMA-EPCO-V1";
const out: string[] = [];

const allaSlag = [...new Set(EPCO_SIZES.flatMap((s) => s.strokes))].sort((a, b) => a - b);
const strokeMin = Math.min(...allaSlag);
const strokeMax = Math.max(...allaSlag);
const extMax = Math.max(...EPCO_SIZES.map((s) => s.extension_max_mm));

/** Ett val, med tom kod utskriven som "utan". */
const opt = (rows: Array<{ code: string; label_sv: string }>) =>
  rows.filter((r) => r.code !== "").map((r) => ({ v: r.code, label: r.label_sv }));

/** Stigningarna, sammanslagna över storlekarna med sin stigning i mm. */
const pitchOpts = [...new Set(EPCO_SPINDLES.map((s) => s.code))]
  .sort((a, b) => EPCO_SPINDLES.find((x) => x.code === a)!.pitch_mm -
    EPCO_SPINDLES.find((x) => x.code === b)!.pitch_mm)
  .map((code) => {
    const sp = EPCO_SPINDLES.find((x) => x.code === code)!;
    const storlekar = EPCO_SPINDLES.filter((x) => x.code === code).map((x) => x.size);
    return { v: code, label: `${sp.pitch_mm} mm/varv (storlek ${storlekar.join(", ")})` };
  });

out.push(`-- EPCO: typkoden enligt ${EPCO_SOURCE.title}, utgåva ${EPCO_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/epco.ts -- redigera inte för hand.
--
-- DOKUMENTET VAR INTE BORTA, DET VAR AVPUBLICERAT. Festo har tagit EPCO ur
-- sortimentet och deras sökning ger noll produktinformation, men
-- dokumentnumren löper i bokstavsordning inom en grupp: EPCE är 203026 och
-- EPCS 203028, alltså EPCO 203027. Filen låg kvar på servern.
--
-- Rättar fem fel:
--   1. order_code_template var 'EPCO-{size}-{stroke_mm}-{drive}', som ger
--      "EPCO-16-100-ballscrew". Festos typkod är modulär och ser ut så här:
--      "EPCO-16-50-3P-ST-E".
--   2. 'drive' erbjöd kuggrem, kulskruv och trapetsskruv. EPCO finns BARA med
--      kulskruv -- katalogen, sida 8: "Design: Electric cylinder with ball
--      screw and motor". Positionen efter slaget är SKRUVSTIGNINGEN.
--   3. 'guide' erbjöd glidlager, rullager och kullager. Katalogens position
--      012 har ETT värde: KF, kullagrad styrning med två styrstänger.
--   4. stroke var 1-3000 mm. Katalogen har ELVA DISKRETA slag, 50 till 400,
--      och vilka som finns beror på storleken. 110 mm tillverkas inte.
--   5. Skruvstigningen saknades helt, trots att den är obligatorisk -- och
--      trots att den avgör om cylindern bär 8 eller 24 kg.
--
-- Elva positioner till saknades: kolvstångsgänga, förlängning,
-- positionsavkänning, motortyp, mätsystem, broms, kabelriktning, styrenhet,
-- kabel, styrning, bussprotokoll och in-/utgång.
--
-- KATALOGENS FEM VILLKOR är kravfulla, inte förbjudande, och det är det som
-- gör dem farliga att utelämna: "A måste väljas om E inte är vald" betyder
-- att en EPCO utan pulsgivare och utan givarförberedelse inte är en billigare
-- EPCO -- den går inte att beställa.

begin;

create schema if not exists backup;
create table if not exists backup.epco_before_20260912 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'epco'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'epco'
  union all
  select 'spec', s.id::text, s.key, s.value
  from product_specs s join products p on p.id = s.product_id
  where lower(p.family) = 'epco';
`);

const steps = [
  { id: "size", step: 1, title_sv: "Storlek", title_en: "Size", required: true, type: "single_select", options: EPCO_SIZES.map((s) => ({ v: String(s.size), label: `Storlek ${s.size}` })) },
  { id: "stroke_mm", step: 2, title_sv: "Slaglängd", title_en: "Stroke", required: true, type: "numeric", min: strokeMin, max: strokeMax, unit: "mm" },
  { id: "pitch", step: 3, title_sv: "Skruvstigning", title_en: "Spindle pitch", required: true, type: "single_select", options: pitchOpts },
  { id: "rod_thread", step: 4, title_sv: "Kolvstångsgänga", title_en: "Piston rod thread", required: false, type: "single_select", options: opt(EPCO_ROD_THREADS) },
  { id: "extension_mm", step: 5, title_sv: "Kolvstångsförlängning", title_en: "Piston rod extension", required: false, type: "numeric", min: 1, max: extMax, unit: "mm" },
  { id: "position_sensing", step: 6, title_sv: "Positionsavkänning", title_en: "Position sensing", required: false, type: "single_select", options: opt(EPCO_POSITION_SENSING) },
  { id: "measuring", step: 7, title_sv: "Mätsystem", title_en: "Measuring unit", required: false, type: "single_select", options: opt(EPCO_MEASURING) },
  { id: "brake", step: 8, title_sv: "Broms", title_en: "Brake", required: false, type: "single_select", options: opt(EPCO_BRAKES) },
  { id: "cable_direction", step: 9, title_sv: "Kabelutgång", title_en: "Cable outlet", required: false, type: "single_select", options: opt(EPCO_CABLE_DIRECTIONS) },
  { id: "guide_unit", step: 10, title_sv: "Styrenhet", title_en: "Guide unit", required: false, type: "single_select", options: opt(EPCO_GUIDE_UNITS) },
  { id: "cable", step: 11, title_sv: "Motorkabel", title_en: "Motor cable", required: false, type: "single_select", options: opt(EPCO_CABLES) },
  { id: "controller", step: 12, title_sv: "Styrning", title_en: "Controller", required: false, type: "single_select", options: opt(EPCO_CONTROLLERS) },
  { id: "bus", step: 13, title_sv: "Bussprotokoll", title_en: "Bus protocol", required: false, type: "single_select", options: opt(EPCO_BUS) },
  { id: "switching", step: 14, title_sv: "In-/utgång", title_en: "Switching I/O", required: false, type: "single_select", options: opt(EPCO_SWITCHING) },
];

out.push(`
insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(SCHEMA_ID)}, ${q(JSON.stringify({ version: "1.0", steps }))}::jsonb,
        'Festo EPCO elcylinder med kulskruv',
        'Festo EPCO electric cylinder with ball screw', 'electric-actuator')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  stroke_min_mm = ${strokeMin},
  stroke_max_mm = ${strokeMax},
  order_code_template = ${q(EPCO_ORDER_CODE_TEMPLATE)},
  rules_schema_id = ${q(SCHEMA_ID)}
where slug = 'epco';
`);

const paramRows = steps.map((s) => ({
  param_key: s.id,
  label: s.title_sv,
  param_type: s.type === "numeric" ? "number" : "select",
  sort_order: s.step,
  required: s.required,
  min_value: s.type === "numeric" ? (s.min ?? null) : null,
  max_value: s.type === "numeric" ? (s.max ?? null) : null,
}));

const valueRows = steps
  .filter((s) => s.options)
  .flatMap((s) => s.options!.map((o, i) => ({
    param_key: s.id, code: o.v, label: o.label, sort_order: i,
  })));

out.push(`
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'epco';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'epco';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'epco';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'epco';

delete from config_rules where schema_id = ${q(SCHEMA_ID)};

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(SCHEMA_ID)}, r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements(${q(JSON.stringify(buildEpcoDbRules()))}::jsonb) r;
`);

// ── produktraden ────────────────────────────────────────────────────────────
//
// FESTO-1476415 är ett RIKTIGT Festo-artikelnummer: katalogen parar det med
// EPCO-16-50-3P-ST-E. Raden heter bara "Electric drive" i databasen, utan
// typkod och utan en enda specifikation ur katalogen. Den får dem nu.
const a = EPCO_ARTICLES.find((x) => x.part_no === "1476415")!;
const sp = epcoSpindle(a.size, a.pitch)!;
const storlek = EPCO_SIZES.find((s) => s.size === a.size)!;

out.push(`
update products set
  name = 'Festo EPCO-16 elcylinder, 50 mm slag, kulskruv 3 mm/varv',
  description = 'Elcylinder med kulskruv och stegmotor. Typkod ${a.type_code}. '
    || 'Matningskraft ${sp.feed_force_n} N, ${sp.speed_max_mms} mm/s, nyttolast '
    || '${sp.payload_horizontal_kg} kg horisontellt och ${sp.payload_vertical_kg} kg vertikalt. '
    || 'Upprepningsnoggrannhet ±${EPCO_LIMITS.repetition_accuracy_mm} mm.',
  updated_at = now()
where sku = 'FESTO-1476415';

delete from product_specs
where product_id = (select id from products where sku = 'FESTO-1476415')
  and key in ('type_code','bore_mm','stroke_mm','spindle_pitch_mm','feed_force_n',
              'max_speed_mms','payload_horizontal_kg','payload_vertical_kg',
              'repetition_accuracy_mm','reversing_backlash_mm','max_acceleration_ms2',
              'nominal_voltage','motor_type','piston_rod_thread');

insert into product_specs (product_id, key, value)
select p.id, v.key, v.value
from products p
cross join lateral (values
  ('type_code', '${a.type_code}'),
  ('size', '${a.size}'),
  ('stroke_mm', '${a.stroke_mm}'),
  ('spindle_pitch_mm', '${sp.pitch_mm}'),
  ('spindle_diameter_mm', '${sp.spindle_diameter_mm}'),
  ('feed_force_n', '${sp.feed_force_n}'),
  ('max_speed_mms', '${sp.speed_max_mms}'),
  ('payload_horizontal_kg', '${sp.payload_horizontal_kg}'),
  ('payload_vertical_kg', '${sp.payload_vertical_kg}'),
  ('repetition_accuracy_mm', '±${EPCO_LIMITS.repetition_accuracy_mm}'),
  ('reversing_backlash_mm', '${EPCO_LIMITS.reversing_backlash_mm}'),
  ('max_acceleration_ms2', '${EPCO_LIMITS.max_acceleration_ms2}'),
  ('nominal_voltage', '${EPCO_LIMITS.nominal_voltage_v} V DC'),
  ('motor_type', 'Stegmotor'),
  ('drive', 'Ball screw'),
  ('piston_rod_thread', '${storlek.rod_thread_male}')
) as v(key, value)
where p.sku = 'FESTO-1476415';

commit;
`);

console.log(out.join("\n"));

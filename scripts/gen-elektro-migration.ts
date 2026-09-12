/**
 * Genererar migrationen för ELEKTRO ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-elektro-migration.ts > supabase/migrations/<tidsstämpel>_elektro.sql
 *
 * VERIFIERINGENS STYRKA, kallad vid sitt namn: Metal Work trycker en
 * beställNYCKEL och en tabell över TILLÅTNA KOMBINATIONER, men ingen lista på
 * färdiga artikelnummer. Garantin blir därför "koden följer nyckeln OCH står i
 * kombinationstabellen" -- starkare än P1D:s och OSP-P:s, där bara nyckeln
 * fanns, men svagare än KPZ:s, där varje nummer gick att slå upp.
 */
import {
  ELEKTRO_DRIVES,
  ELEKTRO_FLANGES,
  ELEKTRO_LIMITS,
  ELEKTRO_MOTORS,
  ELEKTRO_ORDER_CODE_TEMPLATE,
  ELEKTRO_PITCHES,
  ELEKTRO_SIZES,
  ELEKTRO_SOURCE,
  ELEKTRO_TORQUES,
  ELEKTRO_VERSIONS,
  elektroDrivePacks,
} from "../src/lib/catalog/elektro.ts";
import { buildElektroDbRules } from "../src/lib/catalog/elektro-db-rules.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMA_ID = "SCHEMA-ELEKTRO-V1";
const out: string[] = [];

const strokeMin = Math.min(...ELEKTRO_PITCHES.map((p) => 2 * p.pitch_mm));
const strokeMax = Math.max(...ELEKTRO_SIZES.map((s) => s.stroke_max_mm));

/**
 * Drivgruppens etikett, hopsatt ur nyckelns fyra positioner.
 *
 * "2220" blir "Borstlös motor, fläns 60, 1,2–2,19 Nm". Kunden behöver inte
 * kunna nyckeln utantill för att välja, men koden står kvar eftersom den är
 * det hen skriver i beställningen.
 */
function drivePackLabel(pack: string): string {
  const m = ELEKTRO_MOTORS.find((x) => x.code === pack[0])!.label_sv;
  const f = ELEKTRO_FLANGES.find((x) => x.code === pack[1])!.label_sv;
  const t = ELEKTRO_TORQUES.find((x) => x.code === pack[2])!.label_sv;
  const d = ELEKTRO_DRIVES.find((x) => x.code === pack[3])!.label_sv;
  // "Bas" är standardläget och behöver inte nämnas. De andra två gör det --
  // men "Typ E" får INTE gemenas: E är en kodbokstav ur nyckeln, inte ett ord.
  const svans = d === "Bas" ? "" : `, ${d === "Typ E" ? "typ E" : d.toLowerCase()}`;
  return `${m}, fläns ${f}, ${t}${svans}`;
}

/** Alla drivgrupper som förekommer någonstans, sorterade. */
const allaPaket = [...new Set(ELEKTRO_SIZES.flatMap((s) => elektroDrivePacks(s.code)))].sort();

out.push(`-- ELEKTRO ISO 15552: beställnyckeln enligt ${ELEKTRO_SOURCE.title},
-- ${ELEKTRO_SOURCE.file} avsnitt ${ELEKTRO_SOURCE.section}, utgåva ${ELEKTRO_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/elektro.ts -- redigera inte för hand.
--
-- DEN HÄR FAMILJEN STOD SOM BLOCKERAD. Den var det aldrig: jag hade sökt på
-- strängen "ELEKTRO", som bara står i sidhuvudet, fått två träffar och skrivit
-- av källan som tunn. Nyckeln låg i stycke 101-109 hela tiden.
--
-- Rättar sex fel:
--   1. order_code_template var 'Elektro-{size}-{stroke_mm}-{motor_mount}', som
--      ger "Elektro-32-500-inline". Metal Works kod är POSITIONELL:
--      "371032050015" -- tolv tecken utan motor, sexton med.
--   2. Storlekslistan hade 32, 40, 50, 63, 80, 100. Ø40 FINNS INTE i serien,
--      och Ø63 Heavy Duty -- som har en egen storlekskod, H63 -- saknades.
--   3. 'lead' hade koderna low/standard/high. Katalogen har åtta NUMRERADE
--      stigningar: 4, 5, 10, 12, 16, 20, 32 och 40 mm, med koderna 1, 2, 4, 5,
--      6, 7, 8, 9. Ingen av de tre gamla koderna finns i nyckeln.
--   4. 'motor_mount' hade inline/parallel. Direktkopplad och kuggremsdriven är
--      inte ett eget fält utan en del av VERSIONEN (1-4 mot 5-8), tillsammans
--      med vridningsskydd och kapslingsklass.
--   5. stroke_min_mm var 1 och stroke_max_mm 1500 för alla storlekar. Ø32
--      slutar vid 1370. Och undre gränsen är inte 1 utan antingen 80/125 mm
--      (utan vridningsskydd, "in order to re-grease the screw") eller två
--      gånger skruvstigningen (med).
--   6. Nyckelns fyra motorpositioner -- motor, fläns, moment, drivning --
--      saknades helt. Utan dem går det inte att beställa en cylinder med motor.
--
-- VAD SOM INTE GÅR ATT HÄRLEDA: drivgruppens fjärde tecken. Katalogen säger
-- att E "identifierar konfiguration med Delta BRUSHLESS-motorer", men
-- 37M2770000 ÄR en Delta och står ändå som "2770". Regeln stämmer inte, så
-- tabellen skrivs av i stället för att räknas ut.

begin;

create schema if not exists backup;
create table if not exists backup.elektro_before_20260912 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'elektro'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'elektro'
  union all
  select 'spec', s.id::text, s.key, s.value
  from product_specs s join products p on p.id = s.product_id
  where lower(p.family) = 'elektro';
`);

// ── schemat ─────────────────────────────────────────────────────────────────
const sizeOpts = ELEKTRO_SIZES.map((s) => ({
  v: s.code,
  label: s.heavy_duty ? `Ø${s.bore_mm} mm Heavy Duty` : `Ø${s.bore_mm} mm`,
}));
const pitchOpts = ELEKTRO_PITCHES.map((p) => ({ v: p.code, label: p.label_sv }));
const versionOpts = ELEKTRO_VERSIONS.map((v) => ({ v: v.code, label: v.label_sv }));
const packOpts = allaPaket.map((p) => ({ v: p, label: drivePackLabel(p) }));

const steps = [
  { id: "size", step: 1, title: "Bore", title_sv: "Borrning", title_en: "Bore", required: true, type: "single_select", options: sizeOpts },
  { id: "stroke_mm", step: 2, title: "Stroke", title_sv: "Slaglängd", title_en: "Stroke", required: true, type: "numeric", min: strokeMin, max: strokeMax, unit: "mm" },
  { id: "pitch", step: 3, title: "Screw pitch", title_sv: "Skruvstigning", title_en: "Screw pitch", required: true, type: "single_select", options: pitchOpts },
  { id: "version", step: 4, title: "Version", title_sv: "Utförande", title_en: "Version", required: true, type: "single_select", options: versionOpts },
  // Drivgruppen är inte obligatorisk: katalogen har en egen nyckel för
  // cylinder UTAN motor, och den koden är tolv tecken i stället för sexton.
  { id: "drive_pack", step: 5, title: "Motor", title_sv: "Motor", title_en: "Motor", required: false, type: "single_select", options: packOpts },
];

out.push(`
insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(SCHEMA_ID)}, ${q(JSON.stringify({ version: "1.0", steps }))}::jsonb,
        'Metal Work ELEKTRO elcylinder ISO 15552',
        'Metal Work ELEKTRO electric cylinder ISO 15552', 'electric-actuator')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  stroke_min_mm = ${strokeMin},
  stroke_max_mm = ${strokeMax},
  order_code_template = ${q(ELEKTRO_ORDER_CODE_TEMPLATE)},
  rules_schema_id = ${q(SCHEMA_ID)}
where slug = 'elektro';
`);

// ── parametrar ──────────────────────────────────────────────────────────────
const paramRows = [
  { param_key: "size", label: "Borrning", param_type: "select", sort_order: 1, required: true, min_value: null, max_value: null },
  { param_key: "stroke_mm", label: "Slaglängd", param_type: "number", sort_order: 2, required: true, min_value: strokeMin, max_value: strokeMax },
  { param_key: "pitch", label: "Skruvstigning", param_type: "select", sort_order: 3, required: true, min_value: null, max_value: null },
  { param_key: "version", label: "Utförande", param_type: "select", sort_order: 4, required: true, min_value: null, max_value: null },
  { param_key: "drive_pack", label: "Motor", param_type: "select", sort_order: 5, required: false, min_value: null, max_value: null },
];

const valueRows = [
  ...sizeOpts.map((o, i) => ({ param_key: "size", code: o.v, label: o.label, sort_order: i })),
  ...pitchOpts.map((o, i) => ({ param_key: "pitch", code: o.v, label: o.label, sort_order: i })),
  ...versionOpts.map((o, i) => ({ param_key: "version", code: o.v, label: o.label, sort_order: i })),
  ...packOpts.map((o, i) => ({ param_key: "drive_pack", code: o.v, label: o.label, sort_order: i })),
];

out.push(`
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'elektro';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'elektro';

-- show_code = true: för ELEKTRO ÄR koden det kunden skriver i beställningen.
insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'elektro';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'elektro';
`);

// ── reglerna ────────────────────────────────────────────────────────────────
const ruleRows = buildElektroDbRules();
out.push(`
delete from config_rules where schema_id = ${q(SCHEMA_ID)};

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(SCHEMA_ID)}, r.severity, r.if_json, r.message_sv, r.message_en, r.goto_step
from jsonb_to_recordset(${q(JSON.stringify(ruleRows))}::jsonb)
       as r(severity text, if_json jsonb, message_sv text, message_en text, goto_step text);
`);

// ── produktraderna ──────────────────────────────────────────────────────────
//
// MW-ELK-ISO-32 och MW-ELK-ISO-50 är FAMILJERADER, inte artiklar: de saknar
// slaglängd, som är obligatorisk i nyckeln. Samma sak som EGC-FA, och samma
// beslut -- de lämnas orörda, för de fungerar som ingång till familjen.
//
// Två SPECIFIKATIONER är däremot fel, och båda är av det slag rådgivaren
// räknar på:
//
//   drive = "acme screw". Katalogen: "a system with a hardened screw and
//   RECIRCULATING BALL SCREW NUT". En trapetsskruv och en kulskruv är olika
//   saker -- verkningsgraden skiljer ungefär en faktor två, och en
//   trapetsskruv är självhämmande medan en kulskruv inte är det. Att
//   rekommendera fel drivning för en vertikal last är inte en detalj.
//
//   ip_rating = "IP65" rakt av. Katalogen ger klassen som ett VAL: stegmotor
//   IP20/IP40 eller IP55, borstlös IP40 eller IP65 -- och bara Ø80/Ø100 är
//   låsta till IP55/IP65. En Ø32 med stegmotor kan vara IP20.
const specRows = ELEKTRO_SIZES
  .filter((s) => ["032", "050"].includes(s.code))
  .map((s) => ({
    sku: `MW-ELK-ISO-${s.bore_mm}`,
    stroke_max_mm: s.stroke_max_mm,
    stroke_min_free_mm: s.stroke_min_free_mm,
    rod_thread: s.rod_thread,
    max_twist: s.max_twist,
  }));

out.push(`
update product_specs s set value = 'Ball screw (recirculating nut)'
where s.key = 'drive'
  and s.product_id in (select id from products where lower(family) = 'elektro');

update product_specs s set value = 'IP20/IP40/IP55 (stepping) or IP40/IP65 (brushless)'
where s.key = 'ip_rating'
  and s.product_id in (select id from products where lower(family) = 'elektro');

-- Specifikationer ur katalogens tekniska tabell (sida A5.4) som raderna saknade.
insert into product_specs (product_id, key, value)
select p.id, v.key, v.value
from jsonb_to_recordset(${q(JSON.stringify(specRows))}::jsonb)
       as r(sku text, stroke_max_mm int, stroke_min_free_mm int, rod_thread text, max_twist text)
join products p on p.sku = r.sku
cross join lateral (values
  ('stroke_max_mm', r.stroke_max_mm::text),
  ('stroke_min_mm', r.stroke_min_free_mm::text),
  ('piston_rod_thread', r.rod_thread),
  ('max_rod_twist', r.max_twist),
  ('repeatability_mm', '±${ELEKTRO_LIMITS.repeatability_mm}'),
  ('positioning_accuracy_mm', '±${ELEKTRO_LIMITS.accuracy_mm}'),
  ('order_code_length', '${ELEKTRO_LIMITS.code_length_no_motor} (utan motor) / ${ELEKTRO_LIMITS.code_length_with_motor} (med motor)')
) as v(key, value)
where not exists (
  select 1 from product_specs x where x.product_id = p.id and x.key = v.key
);

commit;
`);

console.log(out.join("\n"));

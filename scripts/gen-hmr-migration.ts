/**
 * Genererar migrationen för HMR ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-hmr-migration.ts > supabase/migrations/<tidsstämpel>_hmr.sql
 *
 * VERIFIERINGENS STYRKA: nyckel plus kryssmatriser plus en oberoende
 * distributörskod. Parker trycker ingen artikellista, så garantin är "koden
 * följer nyckeln och dess matriser" -- samma nivå som ELEKTRO. Två av
 * svansens positioner förklaras inte i katalogen och står som nollor.
 */
import {
  HMR_BELTS,
  HMR_BELT_MOUNTS,
  HMR_CARRIAGES,
  HMR_DESIGNS,
  HMR_DRIVE_TYPES,
  HMR_GUIDE_MOUNTINGS,
  HMR_HOME_SENSORS,
  HMR_LIMITS,
  HMR_LIMIT_SENSORS,
  HMR_MOUNTING_KITS,
  HMR_ORDER_CODE_TEMPLATE,
  HMR_PITCHES,
  HMR_SCREWS,
  HMR_SENSOR_POSITIONS,
  HMR_SIZES,
  HMR_SOURCE,
} from "../src/lib/catalog/hmr.ts";
import { buildHmrDbRules } from "../src/lib/catalog/hmr-db-rules.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMA_ID = "SCHEMA-HMR-V1";
const out: string[] = [];

const strokeMax = Math.max(...HMR_SCREWS.map((s) => s.max_stroke_mm), ...HMR_BELTS.map((b) => b.max_stroke_mm));

const opt = (rows: Array<{ code: string; label_sv: string }>) =>
  rows.map((r) => ({ v: r.code, label: r.label_sv }));

/**
 * Position fem rymmer BÅDE stigningar och monteringslägen. Etiketten säger
 * vilken drivning värdet hör till, så kunden inte väljer en stigning för en
 * rem -- reglerna stoppar det, men det är bättre att det syns i listan.
 */
const pos5Opts = [
  ...HMR_PITCHES.map((p) => ({
    v: p.code, label: `Kulskruv, ${p.label_sv.toLowerCase()} (storlek ${p.sizes.join(", ")})`,
  })),
  ...HMR_BELT_MOUNTS.map((m) => ({ v: m.code, label: `Kuggrem, motor ${m.label_sv}` })),
];

out.push(`-- HMR: beställnyckeln enligt ${HMR_SOURCE.title}, katalog ${HMR_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/hmr.ts -- redigera inte för hand.
--
-- DOKUMENTET SAKNADES VERKLIGEN. Familjen hade bara en översiktsbroschyr där
-- ordet "ordering" inte förekommer. Rätt katalog hämtades 2026-09-12.
--
-- Rättar fem fel:
--   1. order_code_template var 'HMR-{size}-{stroke_mm}-{drive}', som ger
--      "HMR-40-500-ballscrew". Parkers kod är positionell, 25 tecken:
--      "HMRS15B050-0500-000000000".
--   2. Storlekslistan hade 40, 50, 63, 80, 100 och 125. INGEN AV DEM FINNS.
--      HMR:s storlekar är 08, 11, 15, 18 och 24 -- profilbredder 85 till
--      240 mm. Listan ser ut att vara kopierad från en pneumatikcylinder.
--   3. 'drive' erbjöd trapetsskruv. HMR finns med kulskruv och kuggrem.
--   4. 'guide' erbjöd glid- och rullager. HMR har kullagrad styrning i alla
--      fyra profilutföranden; det som varierar är profil och IP54-kåpa.
--   5. stroke var 1-3000 mm för allt. Kulskruven i storlek 08 slutar vid
--      1 200; remmen i storlek 15 går till 6 000.
--
-- TVÅ AV SVANSENS POSITIONER FÖRKLARAS INTE I KATALOGEN. Beställnyckelns pilar
-- pekar ut tre av de fem ensiffriga och båda de tvåställiga; den fjärde och
-- femte ensiffriga har varken pil eller ruta. De står som fasta nollor i
-- mallen, precis som i katalogens eget exempel.

begin;

create schema if not exists backup;
create table if not exists backup.hmr_before_20260914 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'hmr'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'hmr';
`);

const steps = [
  { id: "drive", step: 1, title_sv: "Drivning", title_en: "Drive", required: true, type: "single_select", options: opt(HMR_DRIVE_TYPES) },
  { id: "size", step: 2, title_sv: "Storlek", title_en: "Size", required: true, type: "single_select", options: HMR_SIZES.map((s) => ({ v: s.code, label: s.label_sv })) },
  { id: "design", step: 3, title_sv: "Profil", title_en: "Profile", required: true, type: "single_select", options: opt(HMR_DESIGNS) },
  { id: "pitch_or_mount", step: 4, title_sv: "Stigning / motorläge", title_en: "Pitch / motor mounting", required: true, type: "single_select", options: pos5Opts },
  { id: "carriage", step: 5, title_sv: "Vagn", title_en: "Carriage", required: true, type: "single_select", options: opt(HMR_CARRIAGES) },
  { id: "stroke_mm", step: 6, title_sv: "Slaglängd", title_en: "Order stroke", required: true, type: "numeric", min: HMR_LIMITS.stroke_min_mm, max: strokeMax, unit: "mm" },
  // ALLA POSITIONER ÄR OBLIGATORISKA, även de som oftast är "utan". En
  // positionell kod tål inga tomrum: skickar konfiguratorn tomt för ett ovalt
  // fält blir koden ett tecken för kort och ser nästan rätt ut. Det är exakt
  // fällan CCIV visade. Därför står "Utan" med som ETT VAL i varje lista, och
  // kunden måste välja det -- orderkoden visar "..." tills alla elva är satta.
  { id: "home_sensor", step: 7, title_sv: "Hemgivare", title_en: "Home sensor", required: true, type: "single_select", options: opt(HMR_HOME_SENSORS) },
  { id: "limit_sensor", step: 8, title_sv: "Gränslägesgivare", title_en: "Limit sensor", required: true, type: "single_select", options: opt(HMR_LIMIT_SENSORS) },
  { id: "sensor_position", step: 9, title_sv: "Gränslägesgivarens läge", title_en: "Limit sensor position", required: true, type: "single_select", options: opt(HMR_SENSOR_POSITIONS) },
  { id: "mounting_kit", step: 10, title_sv: "Monteringssats", title_en: "Mounting kit", required: true, type: "single_select", options: HMR_MOUNTING_KITS.map((k) => ({ v: k.code, label: k.code === "00" ? k.label_sv : `${k.label_sv} (storlek ${k.sizes.join(", ")})` })) },
  { id: "guide_mounting", step: 11, title_sv: "Växelmontage", title_en: "Gear mounting", required: true, type: "single_select", options: HMR_GUIDE_MOUNTINGS.map((g) => ({ v: g.code, label: g.code === "00" ? g.label_sv : `${g.label_sv} (storlek ${g.sizes.join(", ")})` })) },
];
out.push(`
insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(SCHEMA_ID)}, ${q(JSON.stringify({ version: "1.0", steps }))}::jsonb,
        'Parker HMR linjärdrivning', 'Parker HMR linear drive', 'linear-module')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  stroke_min_mm = ${HMR_LIMITS.stroke_min_mm},
  stroke_max_mm = ${strokeMax},
  order_code_template = ${q(HMR_ORDER_CODE_TEMPLATE)},
  rules_schema_id = ${q(SCHEMA_ID)}
where slug = 'hmr';
`);

const paramRows = steps.map((s) => ({
  param_key: s.id, label: s.title_sv,
  param_type: s.type === "numeric" ? "number" : "select",
  sort_order: s.step, required: s.required,
  min_value: s.type === "numeric" ? (s.min ?? null) : null,
  max_value: s.type === "numeric" ? (s.max ?? null) : null,
}));
const valueRows = steps.filter((s) => s.options).flatMap((s) =>
  s.options!.map((o, i) => ({ param_key: s.id, code: o.v, label: o.label, sort_order: i }))
);

out.push(`
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'hmr';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'hmr';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'hmr';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'hmr';

delete from config_rules where schema_id = ${q(SCHEMA_ID)};

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(SCHEMA_ID)}, r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements(${q(JSON.stringify(buildHmrDbRules()))}::jsonb) r;
`);

// ── produktraderna ──────────────────────────────────────────────────────────
//
// PARKER-HMRS och PARKER-HMRB är familjerader per drivning, utan storlek och
// slag. Samma sak som EGC-FA, ELEKTRO och CCIV: de lämnas orörda, men får
// katalogens tekniska data som specifikationer.
const skruv = HMR_SCREWS;
const rem = HMR_BELTS;

out.push(`
insert into product_specs (product_id, key, value)
select p.id, v.key, v.value
from products p
cross join lateral (values
  ('drive', 'Ball screw'),
  ('sizes', '${HMR_SIZES.map((s) => `${s.code} (${s.width_mm} mm)`).join(", ")}'),
  ('stroke_max_mm', '${Math.min(...skruv.map((s) => s.max_stroke_mm))}–${Math.max(...skruv.map((s) => s.max_stroke_mm))} beroende på storlek'),
  ('max_speed_ms', '${Math.min(...skruv.map((s) => s.max_speed_ms))}–${Math.max(...skruv.map((s) => s.max_speed_ms))} beroende på stigning'),
  ('max_acceleration_ms2', '${skruv[0].max_acceleration_ms2}'),
  ('repeatability_um', '±${skruv[0].repeatability_um}'),
  ('max_thrust_n', '${Math.min(...skruv.map((s) => s.max_thrust_n))}–${Math.max(...skruv.map((s) => s.max_thrust_n))} beroende på storlek'),
  ('order_code_length', '${HMR_LIMITS.code_length}'),
  ('order_code_example', 'HMRS15B050-0500-000000000')
) as v(key, value)
where p.sku = 'PARKER-HMRS'
  and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = v.key);

insert into product_specs (product_id, key, value)
select p.id, v.key, v.value
from products p
cross join lateral (values
  ('drive', 'Toothed belt'),
  ('sizes', '${HMR_SIZES.map((s) => `${s.code} (${s.width_mm} mm)`).join(", ")}'),
  ('stroke_max_mm', '${Math.min(...rem.map((b) => b.max_stroke_mm))}–${Math.max(...rem.map((b) => b.max_stroke_mm))} för storlek 08–15; 18 och 24 ej angivna i katalogen'),
  ('max_speed_ms', '${Math.min(...rem.map((b) => b.max_speed_ms))}–${Math.max(...rem.map((b) => b.max_speed_ms))} för storlek 08–15'),
  ('max_acceleration_ms2', '${Math.min(...rem.map((b) => b.max_acceleration_ms2))}–${Math.max(...rem.map((b) => b.max_acceleration_ms2))}'),
  ('repeatability_um', '±${rem[0].repeatability_um}'),
  ('max_thrust_n', '${Math.min(...rem.map((b) => b.max_thrust_n))}–${Math.max(...rem.map((b) => b.max_thrust_n))} för storlek 08–15'),
  ('order_code_length', '${HMR_LIMITS.code_length}'),
  ('order_code_example', 'HMRB15BBD0-0500-000000000')
) as v(key, value)
where p.sku = 'PARKER-HMRB'
  and not exists (select 1 from product_specs x where x.product_id = p.id and x.key = v.key);

commit;
`);

console.log(out.join("\n"));

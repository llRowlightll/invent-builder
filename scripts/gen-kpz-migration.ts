/**
 * Genererar migrationen för KPZ ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-kpz-migration.ts > supabase/migrations/<tidsstämpel>_kpz.sql
 *
 * KPZ har ingen modulär beställnyckel -- artikeln slås upp i en tabell. Men
 * tabellen är regelbunden, och det gör att den ÄNDÅ går att uttrycka som en
 * mall: låt parameterns `code` bära INDEX i stället för millimetertalet, så
 * blir "082239{bore_mm}{stroke_mm}" ett riktigt AVENTICS-artikelnummer.
 *
 *   bore_mm.code  = 0..8    label "Ø16 mm".."Ø100 mm"
 *   stroke_mm.code = 000..010  label "5 mm".."100 mm"
 *
 * Den gamla mallen var "KPZ-{bore_mm}-{stroke_mm}" och producerade
 * "KPZ-40-50" -- ett artikelnummer som inte finns hos någon tillverkare.
 */
import { KPZ_BORES, KPZ_SERIE, KPZ_SOURCE, KPZ_STROKES, kpzPartNo } from "../src/lib/catalog/kpz.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMA_ID = "SCHEMA-KPZ-V1";
const out: string[] = [];

out.push(`-- KPZ: beställtabellen enligt ${KPZ_SOURCE.title}, ${KPZ_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/kpz.ts -- redigera inte för hand.
--
-- Rättar fyra fel:
--   1. order_code_template var 'KPZ-{bore_mm}-{stroke_mm}', som ger "KPZ-40-50".
--      AVENTICS artikelnummer har formen 0822394004. Strängen "KPZ-" följd av
--      en siffra förekommer inte en enda gång i tillverkarens katalog.
--   2. Ø20 saknades. Katalogen har nio borrningar, databasen listade åtta.
--   3. Slaglängden var ett fritt tal. Beställtabellen säljer elva längder,
--      5-100 mm, och inget däremellan.
--   4. Inga villkor fanns. Tabellen lämnar sex rutor tomma: de tre minsta
--      borrningarna saknar 80 och 100 mm.
--
-- Parametrarnas code-kolumn bär INDEX, inte millimeter -- det är vad som gör att
-- mallen kan producera ett riktigt artikelnummer.

begin;

create schema if not exists backup;
create table if not exists backup.kpz_before_20260911 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'kpz'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'kpz';
`);

// ── schemat ─────────────────────────────────────────────────────────────────
const boreOpts = KPZ_BORES.map((b) => ({ v: String(b.index), label: `Ø${b.bore_mm} mm` }));
const strokeOpts = KPZ_STROKES.map((mm, i) => ({ v: String(i).padStart(3, "0"), label: `${mm} mm` }));

const steps = [
  { id: "bore_mm", step: 1, title: "Piston diameter", title_sv: "Kolvdiameter", title_en: "Piston diameter", required: true, type: "single_select", options: boreOpts },
  { id: "stroke_mm", step: 2, title: "Stroke", title_sv: "Slaglängd", title_en: "Stroke", required: true, type: "single_select", options: strokeOpts },
];

out.push(`
insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(SCHEMA_ID)}, ${q(JSON.stringify({ version: "1.0", steps }))}::jsonb,
        'AVENTICS KPZ kompaktcylinder', 'AVENTICS KPZ compact cylinder', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;
`);

// ── familjen ────────────────────────────────────────────────────────────────
out.push(`
-- Slagintervallet är beställtabellens, inte teknikens: 5-100 mm. Tekniska data
-- tillåter 300 mm (500 för Ø80 och Ø100), men de längderna går genom AVENTICS
-- egen konfigurator och är inte lagervara.
update configurator_families set
  stroke_min_mm = ${KPZ_STROKES[0]},
  stroke_max_mm = ${KPZ_STROKES[KPZ_STROKES.length - 1]},
  order_code_template = ${q(`${KPZ_SERIE}{bore_mm}{stroke_mm}`)},
  rules_schema_id = ${q(SCHEMA_ID)}
where slug = 'kpz';
`);

// ── parametrar ──────────────────────────────────────────────────────────────
out.push(`
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'kpz';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'kpz';
`);

const paramRows = [
  { param_key: "bore_mm", label: "Kolvdiameter", param_type: "select", sort_order: 1, required: true, min_value: null, max_value: null },
  { param_key: "stroke_mm", label: "Slaglängd", param_type: "select", sort_order: 2, required: true, min_value: null, max_value: null },
];
const valueRows = [
  ...boreOpts.map((o, i) => ({ param_key: "bore_mm", code: o.v, label: o.label, sort_order: i })),
  ...strokeOpts.map((o, i) => ({ param_key: "stroke_mm", code: o.v, label: o.label, sort_order: i })),
];

out.push(`
insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'kpz';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'kpz';
`);

// ── reglerna ────────────────────────────────────────────────────────────────
//
// De sex tomma rutorna. En regel per ruta vore sex nästan identiska rader; i
// stället en regel som fångar alla: de tre minsta borrningarna mot de två
// längsta slagen.
const smaBorr = KPZ_BORES.filter((b) => kpzPartNo(b.bore_mm, 100) === null).map((b) => String(b.index));
const langaSlag = KPZ_STROKES
  .map((mm, i) => [mm, String(i).padStart(3, "0")] as const)
  .filter(([mm]) => KPZ_BORES.some((b) => kpzPartNo(b.bore_mm, mm) === null))
  .map(([, kod]) => kod);

const regel = {
  severity: "error",
  if_json: { and: [{ in: [{ var: "bore_mm" }, smaBorr] }, { in: [{ var: "stroke_mm" }, langaSlag] }] },
  message_sv: `Katalogen listar inte den kombinationen. Ø16, Ø20 och Ø25 finns i slaglängder upp till 60 mm; 80 och 100 mm börjar vid Ø32.`,
  message_en: `The catalogue does not list that combination. Ø16, Ø20 and Ø25 are available up to 60 mm stroke; 80 and 100 mm start at Ø32.`,
  goto_step: "kpz-tom-ruta",
};

out.push(`
delete from config_rules where schema_id = ${q(SCHEMA_ID)};

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(SCHEMA_ID)}, r.severity, r.if_json, r.message_sv, r.message_en, r.goto_step
from jsonb_to_recordset(${q(JSON.stringify([regel]))}::jsonb)
       as r(severity text, if_json jsonb, message_sv text, message_en text, goto_step text);

commit;
`);

console.log(out.join("\n"));

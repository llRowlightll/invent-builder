/**
 * Genererar migrationen för P1D ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-p1d-migration.ts > supabase/migrations/<tidsstämpel>_p1d.sql
 *
 * Samma princip som gen-dsbc-migration.ts: inga värden skrivs för hand in i
 * SQL. Det var handskrivandet som gav P1D en maxslaglängd på 2000 mm när
 * katalogen säger 2800, och en orderkodsmall som producerade "P1D-S50MS-200" --
 * en kod som inte finns, vilket gällde varenda en av de 25 P1D-artiklar vi
 * säljer. Ändras modellen kör man om det här; ändras SQL:en direkt failar
 * p1d.test.ts, som jämför mallen och reglerna mot modellen.
 */
import {
  P1D_ORDER,
  P1D_ORDER_CODE_TEMPLATE,
  P1D_POSITIONS,
  P1D_SOURCE,
} from "../src/lib/catalog/p1d.ts";
import { buildP1dDbRules } from "../src/lib/catalog/p1d-db-rules.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMA_ID = "SCHEMA-P1D-V1";
const out: string[] = [];

out.push(`-- P1D: beställnyckeln enligt ${P1D_SOURCE.title}, ${P1D_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/p1d.ts -- redigera inte för hand.
--
-- Rättar fyra fel som legat i produktion:
--   1. order_code_template var 'P1D-S{bore_mm}M{thread}-{stroke_mm}', som ger
--      "P1D-S50MS-200". Parkers koder är POSITIONELLA med nollutfyllnad --
--      "P1D-S050MS-0200". Mallen kunde inte bygga en enda beställbar artikel.
--   2. stroke_max_mm var 2000; katalogen säger "Max stroke 2800 mm".
--   3. Beställnyckeln modellerades med parametrarna bore/stroke/thread/
--      cushioning/sensing/options. Fyra av dem finns inte i nyckeln, och tre
--      positioner som DO finns (utförande, funktion, ren design) saknades.
--   4. Familjen hade inget rules_schema_id, alltså inga villkor alls -- varken
--      låsenhetens materialkrav eller ATEX-notens begränsning.

begin;

create schema if not exists backup;
create table if not exists backup.p1d_before_20260911 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'p1d'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'p1d';
`);

// ── schemat ─────────────────────────────────────────────────────────────────
//
// Steg-id:na ÄR parameternycklarna. normalizeSchema() sätter field.key =
// step.id, så ett schema vars steg heter något annat än reglerna läser ger
// villkor som aldrig kan bli sanna. Det är exakt vad som hänt SCHEMA-DSBC-V1,
// vars steg heter bore/stroke medan reglerna läser bore_mm/stroke_mm.
const steps = P1D_POSITIONS.map((pos, i) => {
  const base = { id: pos.key, step: i + 1, title: pos.label_sv };
  if (pos.values === null) {
    return { ...base, type: "numeric", min: pos.range!.min, max: pos.range!.max, unit: pos.range!.unit };
  }
  return {
    ...base,
    type: "single_select",
    options: pos.values.map((v) => ({
      v: v.code,
      // Schemaspåret visar inte koden på egen rad som familjespåret gör, så
      // etiketten får bära den. Men bara när koden ÄR ett tecken i
      // orderkoden: "-" och "ja" är inga koder kunden ska se upprepade, och
      // borrningen bär bara "mm" i modellen.
      label: pos.key === "bore_mm"
        ? `Ø${Number(v.code)} mm`
        : P1D_ORDER.includes(pos.key) && /^[A-Z0-9]$/.test(v.code)
          ? `${v.code} – ${v.label_sv}`
          : v.label_sv,
    })),
  };
});

out.push(`
-- Schemat måste finnas innan familjen kan peka på det (främmande nyckel).
insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(SCHEMA_ID)}, ${q(JSON.stringify({ version: "1.0", steps }))}::jsonb,
        'Parker P1D ISO-cylinder', 'Parker P1D ISO cylinder', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;
`);

// ── familjen ────────────────────────────────────────────────────────────────
const stroke = P1D_POSITIONS.find((p) => p.key === "stroke_mm")!.range!;
out.push(`
-- Rätt slagintervall, och en mall som speglar kodens positioner.
-- {key#N} nollutfyller till N tecken -- utan det blir koden obeställbar.
update configurator_families set
  stroke_min_mm = ${stroke.min},
  stroke_max_mm = ${stroke.max},
  order_code_template = ${q(P1D_ORDER_CODE_TEMPLATE)},
  standard = ${q("ISO 15552")},
  rules_schema_id = ${q(SCHEMA_ID)}
where slug = 'p1d';
`);

// ── parametrar ──────────────────────────────────────────────────────────────
out.push(`
-- Ut med den handskrivna modellen, in med katalogens positioner.
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'p1d';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'p1d';
`);

const paramRows = P1D_POSITIONS.map((pos, i) => ({
  param_key: pos.key,
  label: pos.label_sv,
  param_type: pos.values === null ? "number" : "select",
  sort_order: i + 1,
  // Varje position i KODEN måste fyllas -- den är positionell, till skillnad
  // från DSBC:s, där ovalda positioner utelämnas helt.
  required: P1D_ORDER.includes(pos.key),
  min_value: pos.range?.min ?? null,
  max_value: pos.range?.max ?? null,
}));

const valueRows = P1D_POSITIONS.flatMap((pos) =>
  (pos.values ?? []).map((v, j) => ({
    param_key: pos.key,
    code: v.code,
    label: v.label_sv,
    sort_order: j,
  })),
);

out.push(`
alter table configurator_params
  add column if not exists min_value numeric,
  add column if not exists max_value numeric;

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'p1d';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'p1d';
`);

// ── reglerna ────────────────────────────────────────────────────────────────
const ruleRows = buildP1dDbRules();
out.push(`
-- Katalogens villkor. P1/P2 är låsenhetens materialkrav ("S and M not in
-- combination with rod lock device" / "Only for piston rod material type C and
-- R"), P4 är ATEX-notens begränsning till P1D-S***MS-****, P5-P7 är Ultra/Pro
-- Clean-gränserna och torrgångsavstrykaren. P3 varnar för slaglängder utanför
-- ISO 4393 utan att blockera dem -- de går att beställa, de tar längre tid.
delete from config_rules where schema_id = ${q(SCHEMA_ID)};

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(SCHEMA_ID)}, r.severity, r.if_json, r.message_sv, r.message_en, r.goto_step
from jsonb_to_recordset(${q(JSON.stringify(ruleRows))}::jsonb)
       as r(severity text, if_json jsonb, message_sv text, message_en text, goto_step text);

commit;
`);

console.log(out.join("\n"));

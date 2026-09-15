/**
 * Genererar migrationen för CQ2 ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-cq2-migration.ts > supabase/migrations/<tidsstämpel>_cq2.sql
 *
 * VERIFIERINGENS STYRKA: nyckel, kryssmatriser och tekniska tabeller, plus
 * ett tjugotal av katalogens EGNA kompletta koder (CDQ2B32-30DMZ-LW-M9BW,
 * CQ2B32-57DZ-XB10A, CDQ2L32-10SZ …) som modellen bygger tecken för tecken.
 * Kraften är kontrollerad mot kolvarean. Nivån är EPCO:s (riktiga koder).
 */
import {
  CQ2_ACTIONS,
  CQ2_BODY_OPTIONS,
  CQ2_BOLT,
  CQ2_BORES,
  CQ2_COUNTS,
  CQ2_GROOVE,
  CQ2_LEADS,
  CQ2_MAGNET,
  CQ2_MOUNTINGS,
  CQ2_MTO,
  CQ2_ORDER_CODE_TEMPLATE,
  CQ2_PORTS,
  CQ2_ROD_BRACKETS,
  CQ2_SOURCE,
  CQ2_SWITCHES,
  CQ2_TYPES,
  cq2BuildCode,
} from "../src/lib/catalog/cq2.ts";
import { buildCq2DbRules } from "../src/lib/catalog/cq2-db-rules.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMA_ID = "SCHEMA-CQ2-V1";
const out: string[] = [];
const opt = (rows: ReadonlyArray<{ code: string; label_sv: string }>) => rows.map((r) => ({ v: r.code, label: r.label_sv }));
const strokeMax = Math.max(...CQ2_BORES.map((b) => b.da_stroke_max_mm));

type Step = {
  id: string; step: number; title_sv: string; title_en: string; required: boolean;
  type: "single_select" | "numeric"; options?: Array<{ v: string; label: string }>; min?: number; max?: number; unit?: string;
};
// SMC:s "Nil" är ingenting i koden. De positionerna är valfria: ovald =
// utelämnad, och mallmotorn städar bindestrecken. Borrning, verkan, fäste
// och slag är obligatoriska -- de finns i varje kod.
const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(CQ2_BORES) },
  { id: "action", step: 2, title_sv: "Verkningssätt", title_en: "Action", required: true, type: "single_select", options: opt(CQ2_ACTIONS) },
  { id: "mounting", step: 3, title_sv: "Fäste", title_en: "Mounting", required: true, type: "single_select", options: opt(CQ2_MOUNTINGS) },
  { id: "stroke_mm", step: 4, title_sv: "Slaglängd", title_en: "Cylinder stroke", required: true, type: "numeric", min: 1, max: strokeMax, unit: "mm" },
  { id: "air_hydro", step: 5, title_sv: "Luft-hydraulik", title_en: "Air-hydro type", required: false, type: "single_select", options: opt(CQ2_TYPES) },
  { id: "port", step: 6, title_sv: "Gängtyp", title_en: "Port thread type", required: false, type: "single_select", options: opt(CQ2_PORTS) },
  { id: "body", step: 7, title_sv: "Kroppsoption", title_en: "Body option", required: false, type: "single_select", options: opt(CQ2_BODY_OPTIONS) },
  { id: "magnet", step: 8, title_sv: "Inbyggd magnet", title_en: "Built-in magnet", required: false, type: "single_select", options: opt([CQ2_MAGNET]) },
  { id: "groove", step: 9, title_sv: "Givarspår", title_en: "Auto switch mounting groove", required: false, type: "single_select", options: opt([CQ2_GROOVE]) },
  { id: "bolt", step: 10, title_sv: "Fästbultar", title_en: "Mounting bolt", required: false, type: "single_select", options: opt([CQ2_BOLT]) },
  { id: "bracket", step: 11, title_sv: "Kolvstångsfäste", title_en: "Rod end bracket", required: false, type: "single_select", options: opt(CQ2_ROD_BRACKETS) },
  { id: "switch", step: 12, title_sv: "Magnetgivare", title_en: "Auto switch", required: false, type: "single_select", options: opt(CQ2_SWITCHES) },
  { id: "lead", step: 13, title_sv: "Givarens kabellängd", title_en: "Lead wire length", required: false, type: "single_select", options: opt(CQ2_LEADS) },
  { id: "count", step: 14, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(CQ2_COUNTS) },
  { id: "mto", step: 15, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(CQ2_MTO) },
];

out.push(`-- CQ2: beställnyckeln enligt ${CQ2_SOURCE.title}.
-- GENERERAD ur src/lib/catalog/cq2.ts -- redigera inte för hand.
--
-- Rättar familjen cq2, som hade mallen 'CQ2-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
-- med påhittade positioner: SMC:s kod är C[D]Q2{fäste}{ø}-{slag}{verkan}{kropp}Z-…,
-- t.ex. CDQ2B32-30DMZ-LW-M9BW (sida 785). Sju positioner fanns inte alls
-- (fäste, gängtyp, kroppsoption, magnet, givarspår, stångfäste, special).
--
-- Produkterna SMC-CQ2B12–B63 hade "stroke_mm = 300 mm" för alla borrningar.
-- Standardkroppen går till 30 mm (ø12, 16), 50 mm (ø20, 25) och 100 mm
-- (ø32–100); 300 mm finns bara i långslagsserien ø32–100, som är en egen
-- nyckel. ø12–25 rättas; ø32–63 får standardvärdet och en hänvisning.

begin;

create schema if not exists backup;
create table if not exists backup.cq2_before_20260915 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'cq2'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'cq2'
  union all
  select 'spec', s.id::text, p.sku || '|' || s.key, s.value
  from product_specs s join products p on p.id = s.product_id
  where p.sku like 'SMC-CQ2%';

insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(SCHEMA_ID)}, ${q(JSON.stringify({ version: "1.0", steps }))}::jsonb,
        'SMC CQ2 kompaktcylinder', 'SMC CQ2 compact cylinder', 'cylinder')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  title = 'Kompaktcylinder ø12–100, dubbel- eller enkelverkande',
  description = 'SMC CQ2 compact cylinder, standard double or single acting, single rod, ø12–100 mm.',
  stroke_min_mm = 1,
  stroke_max_mm = ${strokeMax},
  order_code_template = ${q(CQ2_ORDER_CODE_TEMPLATE)},
  rules_schema_id = ${q(SCHEMA_ID)}
where slug = 'cq2';
`);

/** Reglerna i satser om 20, så att ingen enskild sats blir för stor för verktyget som tillämpar den. */
function regelSatser(): string {
  const regler = buildCq2DbRules();
  const satser: string[] = [];
  for (let i = 0; i < regler.length; i += 20) {
    satser.push(`insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(SCHEMA_ID)}, r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements(${q(JSON.stringify(regler.slice(i, i + 20)))}::jsonb) r;`);
  }
  return satser.join("\n\n");
}

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
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'cq2';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'cq2';

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = 'cq2';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'cq2';

delete from config_rules where schema_id = ${q(SCHEMA_ID)};

${regelSatser()}

insert into knowledge_doc_families (source_file, family_slug, doc_title)
values (${q(CQ2_SOURCE.file)}, 'cq2', ${q(`SMC — ${CQ2_SOURCE.title}`)})
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;
`);

// ── produktraderna ──────────────────────────────────────────────────────────
for (const b of CQ2_BORES.filter((x) => ["12", "16", "20", "25", "32", "40", "50", "63"].includes(x.code))) {
  const exempel = cq2BuildCode({ bore: b.code, action: "D", stroke_mm: b.da_standard_strokes[b.da_standard_strokes.length - 1], mounting: "B", groove: b.bore_mm >= 32 })!;
  const slagText = b.bore_mm >= 32
    ? `${b.da_stroke_max_mm} mm (standardkropp); upp till 300 mm i långslagsserien`
    : `${b.da_stroke_max_mm} mm`;
  out.push(`
update product_specs s set value = ${q(slagText)}
from products p where s.product_id = p.id and p.sku = ${q(`SMC-CQ2B${b.code}`)} and s.key = 'stroke_mm' and s.value = '300 mm';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('standard_strokes_mm', '${b.da_standard_strokes.join(", ")}'),
  ('force_out_n_05mpa', '${b.force_out_n_05mpa}'),
  ('min_pressure_mpa', '${b.da_min_pressure_mpa}'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC CQ2, How to Order sida 785, data sida 786')
) as x(key, value)
where p.sku = ${q(`SMC-CQ2B${b.code}`)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`);
}

out.push(`
commit;
`);

console.log(out.join("\n"));

/**
 * Gemensam SQL-byggare för familjemigrationer som skrivs ur en katalogmodell.
 *
 * Varje familj har samma skelett: säkerhetskopia, config_schemas, familjens
 * rad, parametrar, värdelistor, regler (i satser om 20 så att ingen enskild
 * sats blir för stor för verktyget som tillämpar den) och dokumentkartan.
 * Det som skiljer är innehållet. Generatorerna för OSP-E, CQ2 och HMR skrev
 * skelettet var för sig; från MXS och framåt kommer det härifrån.
 */

export type Opt = { v: string; label: string };
export type Step = {
  id: string;
  step: number;
  title_sv: string;
  title_en: string;
  required: boolean;
  type: "single_select" | "numeric";
  options?: Opt[];
  min?: number;
  max?: number;
  unit?: string;
};

export const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export const opt = (rows: ReadonlyArray<{ code: string; label_sv: string }>): Opt[] =>
  rows.map((r) => ({ v: r.code, label: r.label_sv }));

export interface FamilyMigration {
  slug: string;
  schemaId: string;
  /** Datumstämpel för backup-tabellen, t.ex. "20260915". */
  backupDate: string;
  steps: Step[];
  template: string;
  title_sv: string;
  title_en: string;
  /** configurator_families.title */
  family_title: string;
  family_description: string;
  category_slug: string;
  stroke_min_mm: number | null;
  stroke_max_mm: number | null;
  rules: Array<Record<string, unknown>>;
  /** knowledge_doc_families: fil och titel. */
  doc: { source_file: string; title: string };
  /** Kommentar överst i filen (utan inledande "-- "). */
  header: string;
  /** SQL som läggs sist, inne i transaktionen (t.ex. produktrader). */
  extra?: string;
  /**
   * SQL som körs först i transaktionen, före säkerhetskopian — för en familj
   * som inte finns än (insert av raden) eller som ersätter en felnamngiven.
   */
  preamble?: string;
}

export function familyMigrationSql(m: FamilyMigration): string {
  const out: string[] = [];
  out.push(m.header.split("\n").map((l) => (l ? `-- ${l}` : "--")).join("\n"));
  out.push(`
begin;
`);
  if (m.preamble) out.push(m.preamble);
  out.push(`
create schema if not exists backup;
create table if not exists backup.${m.slug.replace(/-/g, "_")}_before_${m.backupDate} as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = ${q(m.slug)}
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = ${q(m.slug)}
  union all
  select 'family', f.id::text, f.slug, coalesce(f.order_code_template, '')
  from configurator_families f where f.slug = ${q(m.slug)};

insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(m.schemaId)}, ${q(JSON.stringify({ version: "1.0", steps: m.steps }))}::jsonb,
        ${q(m.title_sv)}, ${q(m.title_en)}, ${q(m.category_slug)})
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

update configurator_families set
  title = ${q(m.family_title)},
  description = ${q(m.family_description)},
  stroke_min_mm = ${m.stroke_min_mm ?? "null"},
  stroke_max_mm = ${m.stroke_max_mm ?? "null"},
  order_code_template = ${q(m.template)},
  rules_schema_id = ${q(m.schemaId)}
where slug = ${q(m.slug)};
`);

  const paramRows = m.steps.map((s) => ({
    param_key: s.id,
    label: s.title_sv,
    param_type: s.type === "numeric" ? "number" : "select",
    sort_order: s.step,
    required: s.required,
    min_value: s.type === "numeric" ? (s.min ?? null) : null,
    max_value: s.type === "numeric" ? (s.max ?? null) : null,
  }));
  const valueRows = m.steps.filter((s) => s.options).flatMap((s) =>
    s.options!.map((o, i) => ({ param_key: s.id, code: o.v, label: o.label, sort_order: i }))
  );

  out.push(`
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = ${q(m.slug)};
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = ${q(m.slug)};

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = ${q(m.slug)};

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = ${q(m.slug)};

delete from config_rules where schema_id = ${q(m.schemaId)};
`);

  for (let i = 0; i < m.rules.length; i += 20) {
    out.push(`
insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(m.schemaId)}, r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements(${q(JSON.stringify(m.rules.slice(i, i + 20)))}::jsonb) r;`);
  }

  out.push(`
insert into knowledge_doc_families (source_file, family_slug, doc_title)
values (${q(m.doc.source_file)}, ${q(m.slug)}, ${q(m.doc.title)})
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;
`);
  if (m.extra) out.push(m.extra);
  out.push(`
commit;
`);
  return out.join("\n");
}

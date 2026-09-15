/**
 * Genererar migrationen för OSP-E ur den kanoniska modellen: sju familjer.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-osp-e-migration.ts > supabase/migrations/<tidsstämpel>_osp_e.sql
 *
 * VERIFIERINGENS STYRKA: nyckel plus kryssmatriser, plus Parkers egen
 * konfigurator (som bygger exakt samma artikelnummer för grundutförandet av
 * B och BHD) och fyra distributörskoder. Parker trycker ingen artikellista.
 * Nivån är HMR:s, med konfiguratorn som extra facit.
 */
import {
  OSPE_BHD_DIRECTIONS,
  OSPE_BHD_TYPES,
  OSPE_GEARS,
  OSPE_GUIDE_POSITIONS_B,
  OSPE_LIMITS,
  OSPE_NIRO,
  OSPE_ORDER_CODE_TEMPLATES,
  OSPE_ROD_MOUNTINGS,
  OSPE_SHAFTS_B,
  OSPE_SIZES,
  OSPE_SOURCE,
  OSPE_TECH,
  OSPE_VARIANTS,
  type OspeVariant,
  ospeCarriages,
  ospeEndCaps,
  ospeGearKitOptions,
  ospeGuides,
  ospeBuildCode,
  ospeMotorKitOptions,
  ospePitches,
  ospeProfiles,
  ospeSensors,
  ospeShaftOrKitOptions,
  ospeShafts2,
} from "../src/lib/catalog/osp-e.ts";
import { buildOspeDbRules } from "../src/lib/catalog/osp-e-db-rules.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const schemaId = (v: OspeVariant) => `SCHEMA-${v.slug.toUpperCase()}-V1`;
const out: string[] = [];

type Opt = { v: string; label: string };
type Step = {
  id: string; step: number; title_sv: string; title_en: string; required: true;
  type: "single_select" | "numeric"; options?: Opt[]; min?: number; max?: number; unit?: string;
};

const opt = (rows: ReadonlyArray<{ code: string; label_sv: string }>): Opt[] =>
  rows.map((r) => ({ v: r.code, label: r.label_sv }));

function steps(v: OspeVariant): Step[] {
  const s: Step[] = [];
  let n = 0;
  const add = (x: Omit<Step, "step" | "required">) => s.push({ ...x, step: ++n, required: true });
  const storlekar = OSPE_SIZES.filter((x) => v.sizes.includes(x.code));
  const strokeMax = Math.max(...OSPE_TECH.filter((t) => t.slug === v.slug).map((t) => t.max_stroke_mm));

  if (v.layout === "BHD") {
    add({ id: "type", title_sv: "Styrning", title_en: "Guide type", type: "single_select", options: opt(OSPE_BHD_TYPES) });
  }
  add({ id: "size", title_sv: "Storlek", title_en: "Size", type: "single_select", options: opt(storlekar) });
  if (v.layout !== "ROD") {
    add({
      id: "carriage", title_sv: v.layout === "BV" ? "Aktuatorhuvud" : "Vagn", title_en: v.layout === "BV" ? "Actuator head" : "Carriage",
      type: "single_select", options: opt(ospeCarriages(v.slug)),
    });
  }
  if (v.layout === "BHD") {
    add({ id: "op_direction", title_sv: "Rörelseriktning", title_en: "Operating direction", type: "single_select", options: opt(OSPE_BHD_DIRECTIONS) });
  }
  if (v.layout === "B") {
    add({ id: "drive_shaft", title_sv: "Drivaxel och motorläge", title_en: "Drive shaft and motor position", type: "single_select", options: opt(OSPE_SHAFTS_B) });
  }
  if (v.layout === "BHD" || v.layout === "BV") {
    add({
      id: "drive_shaft", title_sv: "Drivaxel och motorläge", title_en: "Drive shaft and motor position", type: "single_select",
      options: ospeShafts2(v.slug).map((x) => ({ v: x.code, label: x.sizes ? `${x.label_sv} (storlek ${x.sizes.join(", ")})` : x.label_sv })),
    });
  }
  if (v.layout === "SCREW" || v.layout === "ROD") {
    add({ id: "pitch", title_sv: "Skruvstigning", title_en: "Screw pitch", type: "single_select", options: opt(ospePitches(v.slug)) });
  }
  if (v.layout === "B" || v.layout === "SCREW" || v.layout === "ROD") {
    add({ id: "gear", title_sv: "Växel", title_en: "Gearbox", type: "single_select", options: opt(OSPE_GEARS) });
    const satser = v.layout === "B" ? ospeMotorKitOptions() : ospeShaftOrKitOptions(v.slug);
    add({
      id: "kit",
      title_sv: v.layout === "B" ? "Monteringssats för motor och växel" : "Drivaxel eller monteringssats",
      title_en: v.layout === "B" ? "Mounting kit for motor and gear" : "Drive shaft or mounting kit",
      type: "single_select",
      options: satser.map((k) => "sizes" in k ? { v: k.code, label: `${k.label_sv} (storlek ${(k as { sizes: string[] }).sizes.join(", ")})` } : { v: k.code, label: k.label_sv }),
    });
  }
  add({ id: "stroke_mm", title_sv: "Slaglängd", title_en: "Order stroke", type: "numeric", min: OSPE_LIMITS.stroke_min_mm, max: strokeMax, unit: "mm" });
  // ALLA POSITIONER ÄR OBLIGATORISKA, även de som oftast är "utan". Koden är
  // positionell och tål inga tomrum -- samma lärdom som CCIV och HMR. "Utan"
  // står som ett val i varje lista, och kunden måste välja det.
  add({ id: "niro", title_sv: "Skruvmaterial", title_en: "Screw material", type: "single_select", options: opt(OSPE_NIRO) });
  if (v.layout === "BHD" || v.layout === "BV") {
    add({
      id: "kit", title_sv: "Monteringssats för motor och växel", title_en: "Mounting kit for motor and gear", type: "single_select",
      options: ospeGearKitOptions(v.slug).map((k) => "fits" in k
        ? { v: k.code, label: `${k.label_sv} (storlek ${Object.keys((k as { fits: Record<string, string> }).fits).join(", ")})` }
        : { v: k.code, label: k.label_sv }),
    });
  }
  if (v.layout === "B" || v.layout === "SCREW") {
    add({ id: "ext_guide", title_sv: "Yttre styrning / vagnmontage", title_en: "External guide / carriage mounting", type: "single_select", options: opt(ospeGuides(v.slug)) });
  }
  if (v.layout === "B") {
    add({ id: "guide_position", title_sv: "Styrningens läge", title_en: "Guide position", type: "single_select", options: opt(OSPE_GUIDE_POSITIONS_B) });
  }
  if (v.layout === "ROD") {
    add({ id: "rod_mounting", title_sv: "Kolvstångsfäste", title_en: "Piston rod mounting", type: "single_select", options: opt(OSPE_ROD_MOUNTINGS) });
  }
  if (v.layout !== "BV") {
    add({ id: "end_cap", title_sv: "Ändlocksfäste", title_en: "End cap mounting", type: "single_select", options: opt(ospeEndCaps(v.slug)) });
    add({ id: "profile_mounting", title_sv: "Profilfäste", title_en: "Profile mounting", type: "single_select", options: opt(ospeProfiles(v.slug)) });
  }
  add({ id: "sensors", title_sv: "Magnetgivare", title_en: "Magnetic sensors", type: "single_select", options: opt(ospeSensors(v.slug)) });
  return s;
}

out.push(`-- OSP-E: beställnycklarna enligt ${OSPE_SOURCE.title}, katalog ${OSPE_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/osp-e.ts -- redigera inte för hand.
--
-- SJU FAMILJER I STÄLLET FÖR EN. Familjen 'osp-e' hade storlekarna 40-125
-- (finns inte; OSP-E är 20, 25, 32 och 50), drivningarna belt/ballscrew/
-- leadscrew som fritext och mallen 'OSP-E-{size}-{stroke_mm}-{drive}' som gav
-- "OSP-E-63-500-belt". Katalogen har sju beställnycklar med olika betydelse
-- på samma position, och Parkers sajt har en konfigurator per variant.
-- Därför ersätts familjen av sju: osp-e-b, -sb, -st, -sbr, -str, -bhd, -bv.
--
-- KODENS FORM är bekräftad mot Parkers konfigurator (econfig.parker.com,
-- 2026-09-14): OSPE2500000-00500000000 för B och OSPE256000A00500000000 för
-- BHD. Inga bindestreck utom det i satsen "0-", som är två tecken.
--
-- De fyra produktraderna PARKER-OSPE-B/BHD/SB/ST pekas om från familjen
-- 'OSP-E' till sin variant, så "Konfigurera"-knappen leder rätt. Deras
-- handskrivna specifikationer stämmer med katalogen utom en: ST:s
-- repeterbarhet stod som ±0,5 mm; katalogen (sida 73) säger ±0,05.
--
-- DOKUMENTKARTAN rättas samtidigt: epco pekade på EPCE-katalogen, mfh på
-- MH1 och hmr på översiktsbroschyren. Alla fyra familjer får sin riktiga
-- katalog, som redan är inläst.

begin;

create schema if not exists backup;
create table if not exists backup.osp_e_before_20260914 as
  select 'family' as sort, f.id::text as id, f.slug as k,
         coalesce(f.order_code_template, '') || ' | ' || coalesce(f.title, '') as v
  from configurator_families f where f.slug = 'osp-e'
  union all
  select 'param', p.id::text, p.param_key, p.label
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'osp-e'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'osp-e'
  union all
  select 'doc', d.source_file, d.family_slug, coalesce(d.doc_title, '')
  from knowledge_doc_families d where d.family_slug in ('osp-e', 'epco', 'mfh', 'hmr');

-- Den gamla familjen. knowledge_doc_families kaskaderar. Produkter och
-- tillbehör pekar inte på den (kontrollerat 2026-09-14).
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'osp-e';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'osp-e';
delete from configurator_families where slug = 'osp-e';
`);

for (const v of OSPE_VARIANTS) {
  const st = steps(v);
  const strokeMax = st.find((s) => s.id === "stroke_mm")!.max!;
  const sid = schemaId(v);
  const paramRows = st.map((s) => ({
    param_key: s.id, label: s.title_sv,
    param_type: s.type === "numeric" ? "number" : "select",
    sort_order: s.step, required: true,
    min_value: s.type === "numeric" ? (s.min ?? null) : null,
    max_value: s.type === "numeric" ? (s.max ?? null) : null,
  }));
  const valueRows = st.filter((s) => s.options).flatMap((s) =>
    s.options!.map((o, i) => ({ param_key: s.id, code: o.v, label: o.label, sort_order: i }))
  );

  out.push(`
-- ── ${v.name} (typ ${v.types.join("/")}, beställnyckel sida ${v.page_key}) ─────────────
insert into config_schemas (schema_id, schema_json, title_sv, title_en, category_slug)
values (${q(sid)}, ${q(JSON.stringify({ version: "1.0", steps: st }))}::jsonb,
        ${q(`Parker ${v.name} — ${v.title_sv.toLowerCase()}`)}, ${q(`Parker ${v.name} — ${v.title_en.toLowerCase()}`)}, 'linear-module')
on conflict (schema_id) do update set
  schema_json = excluded.schema_json,
  title_sv = excluded.title_sv,
  title_en = excluded.title_en;

insert into configurator_families (slug, name, title, category_slug, order_code_template, description, standard, stroke_min_mm, stroke_max_mm, rules_schema_id)
values (${q(v.slug)}, ${q(v.name)}, ${q(v.title_sv)}, 'linear-module', ${q(OSPE_ORDER_CODE_TEMPLATES[v.slug])},
        ${q(`Parker ORIGA ${v.name}: ${v.title_en.toLowerCase()}. Sizes ${v.sizes.join(", ")}.`)}, null,
        ${OSPE_LIMITS.stroke_min_mm}, ${strokeMax}, ${q(sid)})
on conflict (slug) do update set
  name = excluded.name, title = excluded.title, category_slug = excluded.category_slug,
  order_code_template = excluded.order_code_template, description = excluded.description,
  stroke_min_mm = excluded.stroke_min_mm, stroke_max_mm = excluded.stroke_max_mm,
  rules_schema_id = excluded.rules_schema_id;

delete from configurator_param_values x using configurator_params p, configurator_families f
  where x.param_id = p.id and p.family_id = f.id and f.slug = ${q(v.slug)};
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = ${q(v.slug)};

insert into configurator_params (family_id, param_key, label, param_type, sort_order, required, min_value, max_value, show_code)
select f.id, r.param_key, r.label, r.param_type, r.sort_order, r.required, r.min_value, r.max_value, true
from configurator_families f,
     jsonb_to_recordset(${q(JSON.stringify(paramRows))}::jsonb)
       as r(param_key text, label text, param_type text, sort_order int, required boolean,
            min_value numeric, max_value numeric)
where f.slug = ${q(v.slug)};

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = ${q(v.slug)};

delete from config_rules where schema_id = ${q(sid)};

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select ${q(sid)}, r->>'severity', r->'if_json',
       r->>'message_sv', r->>'message_en', r->>'goto_step'
from jsonb_array_elements(${q(JSON.stringify(buildOspeDbRules(v.slug)))}::jsonb) r;
`);
}

// ── dokumentkartan ─────────────────────────────────────────────────────────
out.push(`
insert into knowledge_doc_families (source_file, family_slug, doc_title) values
${OSPE_VARIANTS.map((v) => `  (${q(OSPE_SOURCE.file)}, ${q(v.slug)}, ${q(`${OSPE_SOURCE.title} (${OSPE_SOURCE.edition})`)})`).join(",\n")},
  ('festo-EPCO-203027.pdf', 'epco', 'Festo — Electric cylinder EPCO (203027)'),
  ('festo-MFH-203756.pdf', 'mfh', 'Festo — Solenoid valves MFH (203756)'),
  ('parker-HMR-PA4P024GB.pdf', 'hmr', 'Parker — Electric Linear Actuator HMR (P-A4P024GB)')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;

-- Fel dokument för rätt familj: EPCE är inte EPCO, MH1 är inte MFH.
delete from knowledge_doc_families where (source_file, family_slug) in
  (('festo-EPCE-203026.pdf', 'epco'), ('festo-MH1-203291.pdf', 'mfh'), ('parker-electromechanical.pdf', 'hmr'));
`);

// ── produktraderna ─────────────────────────────────────────────────────────
//
// Familjerader per variant, utan storlek och slag. De pekas om till sin
// variant och får katalogens data som specifikationer där sådana saknas.
for (const v of OSPE_VARIANTS.filter((x) => x.product_sku)) {
  const rader = OSPE_TECH.filter((t) => t.slug === v.slug);
  const maxKraft = Math.max(...rader.map((r) => r.max_force_n));
  const maxFart = Math.max(...rader.map((r) => r.max_speed_ms));
  const maxSlag = Math.max(...rader.map((r) => r.max_stroke_mm));
  // Grundutförandet i storlek 25 med 500 mm slag -- samma kod som Parkers
  // konfigurator bygger för B och BHD.
  const exempel = ospeBuildCode({
    slug: v.slug, size: "25", stroke_mm: 500,
    type: v.layout === "BHD" ? "6" : undefined,
    drive_shaft: v.layout === "BHD" ? "0A" : undefined,
    pitch: ospePitches(v.slug).find((p) => p.sizes.includes("25"))?.code,
  });
  out.push(`
update products set family = ${q(v.slug.toUpperCase())} where sku = ${q(v.product_sku!)};

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('sizes', '${v.sizes.join(", ")}'),
  ('stroke_max_mm_catalogue', '${Math.min(...rader.map((r) => r.max_stroke_mm))}–${maxSlag} beroende på storlek${v.layout === "BHD" ? " och styrning" : ""}'),
  ('max_speed_ms_catalogue', '${Math.min(...rader.map((r) => r.max_speed_ms))}–${maxFart} beroende på storlek${v.layout === "SCREW" ? " och stigning" : v.layout === "BHD" ? " och styrning" : ""}'),
  ('max_thrust_n_catalogue', '${Math.min(...rader.map((r) => r.max_force_n))}–${maxKraft} beroende på storlek'),
  ('order_code_length', '${v.layout === "BHD" || v.layout === "BV" ? 22 : 23}'),
  ('order_code_example', '${exempel}'),
  ('catalogue', '${OSPE_SOURCE.edition}, ${v.name} beställnyckel sida ${v.page_key}')
) as x(key, value)
where p.sku = ${q(v.product_sku!)}
  and not exists (select 1 from product_specs s where s.product_id = p.id and s.key = x.key);
`);
}

out.push(`
-- ST:s repeterbarhet: katalogen (sida 73) säger ±0,05 mm, inte ±0,5.
update product_specs s set value = '±0.05'
from products p
where s.product_id = p.id and p.sku = 'PARKER-OSPE-ST' and s.key = 'repeatability_mm' and s.value = '±0.5';

commit;
`);

console.log(out.join("\n"));

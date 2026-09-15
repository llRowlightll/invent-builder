/**
 * Genererar migrationen för CY1-serierna (CY1S, CY1L, CY1H, CY1F) ur den
 * kanoniska modellen — fyra familjer ur en modell, som OSP-E.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-cy1-migration.ts > supabase/migrations/<tidsstämpel>_cy1.sql
 *
 * VERIFIERINGENS STYRKA: fyra nycklar med exempel, standardslag och maxslag
 * per borrning, givartabellernas ●/○/—, minsta slag per givarantal,
 * specialutförandenas borrningar; 50 000+ kombinationer regler↔modell och
 * katalogernas egna koder CY1S25-300Z-M9BW, CY1SG25-500Z, CY1L25H-300-J79W,
 * CY1L32H-500, CY1H25-300-Y7BW och CY1F10R-300-M9BW.
 */
import {
  CY1_COUNTS,
  CY1_PORTS,
  CY1_SERIES,
  CY1_SERIES_LIST,
  type CY1Series,
  cy1BuildCode,
} from "../src/lib/catalog/cy1.ts";
import { buildCy1DbRules } from "../src/lib/catalog/cy1-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const DATUM = "20260915";

function steps(series: CY1Series): Step[] {
  const s = CY1_SERIES[series];
  const strokeMax = Math.max(...s.bores.map((b) => Math.max(b.max_mm, b.two_axis?.max_mm ?? 0)));
  const out: Step[] = [];
  let n = 1;
  if (s.guide) out.push({ id: "guide", step: n++, title_sv: "Styrning (standard är enaxlig)", title_en: "Guide (single axis is standard)", required: false, type: "single_select", options: opt([s.guide]) });
  out.push({ id: "bore", step: n++, title_sv: "Kolvdiameter", title_en: "Bore size", required: true, type: "single_select", options: opt(s.bores) });
  if (s.piping) out.push({ id: "piping", step: n++, title_sv: "Anslutning (standard är en port per plåt)", title_en: "Piping (bilateral is standard)", required: false, type: "single_select", options: opt([s.piping]) });
  out.push({ id: "port", step: n++, title_sv: "Portgänga", title_en: "Port thread type", required: false, type: "single_select", options: opt(CY1_PORTS) });
  if (s.holding) out.push({ id: "holding", step: n++, title_sv: "Magnetisk hållkraft", title_en: "Magnetic holding force", required: true, type: "single_select", options: opt(s.holding) });
  if (s.dirs) out.push({ id: "dir", step: n++, title_sv: "Anslutningssida", title_en: "Piping direction", required: true, type: "single_select", options: opt(s.dirs) });
  out.push({ id: "stroke_mm", step: n++, title_sv: "Slaglängd", title_en: "Cylinder stroke", required: true, type: "numeric", min: s.min_stroke_mm, max: strokeMax, unit: "mm" });
  out.push({ id: "adjust", step: n++, title_sv: s.adjust_title_sv, title_en: s.adjust_title_en, required: false, type: "single_select", options: opt(s.adjust) });
  out.push({ id: "switch", step: n++, title_sv: "Magnetgivare", title_en: "Auto switch", required: false, type: "single_select", options: opt(s.switches) });
  out.push({ id: "lead", step: n++, title_sv: "Givarens kabellängd (standard 0,5 m)", title_en: "Lead wire length (0.5 m is standard)", required: false, type: "single_select", options: opt(s.leads) });
  out.push({ id: "count", step: n++, title_sv: "Antal givare", title_en: "Number of auto switches", required: false, type: "single_select", options: opt(CY1_COUNTS) });
  out.push({ id: "mto", step: n++, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(s.mto) });
  return out;
}

// ── den påhittade familjen och dess produktrad ──────────────────────────
//
// 'cy1r' hade mallen 'CY1R-{bore_mm}-{stroke_mm}-{cushioning}{sensing}' med
// borrningen 10 och Festos dämpningskoder P/PPV/PPSA. SMC-CY1R:s rad hade
// "Ø10–40mm, stroke up to 3000mm" (CY1S: ø6–40, max 1500) och tryck 8 bar
// (0,7 MPa). Raden döps om till SMC-CY1S (samma id — competitor_map pekar
// på den), inte raderas. CY1L/CY1H/CY1F får inga produktrader: vilka serier
// som ska säljas är användarens beslut.
const exempel = cy1BuildCode("cy1s", { bore: "25", stroke_mm: 300, switch: "M9BW" })!;
const forspel = `-- CY1: fyra familjer (CY1S, CY1L, CY1H, CY1F) ersätter den påhittade 'cy1r'.
-- GENERERAD ur src/lib/catalog/cy1.ts -- redigera inte för hand.
--
-- Serien CY1R finns inte i SMC:s kataloger (strängen förekommer 0 gånger i
-- de tre CY1-katalogerna); slidtyperna CY1S, CY1L, CY1H och CY1F har var sin
-- beställnyckel med olika positioner. Produktraden SMC-CY1R döps om till
-- SMC-CY1S med katalogens data; CY1L/CY1H/CY1F får inga produktrader.

begin;

create schema if not exists backup;
create table if not exists backup.cy1r_before_${DATUM} as
  select 'family' as sort, f.id::text as id, f.slug as k,
         coalesce(f.order_code_template, '') || ' | ' || coalesce(f.title, '') as v
  from configurator_families f where f.slug = 'cy1r'
  union all
  select 'param', p.id::text, p.param_key, p.label
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'cy1r'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'cy1r'
  union all
  select 'doc', d.source_file, d.family_slug, coalesce(d.doc_title, '')
  from knowledge_doc_families d where d.family_slug = 'cy1r'
  union all
  select 'product', p.id::text, p.sku, p.name || ' | ' || coalesce(p.description, '')
  from products p where p.sku = 'SMC-CY1R'
  union all
  select 'spec', s.id::text, s.key, s.value
  from product_specs s join products p on p.id = s.product_id where p.sku = 'SMC-CY1R';

-- Den påhittade familjen. knowledge_doc_families kaskaderar; produktraden
-- pekas om nedan.
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'cy1r';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'cy1r';
delete from configurator_families where slug = 'cy1r';

-- De fyra familjerna (raderna fylls på av respektive familjs migration).
${CY1_SERIES_LIST.map((k) => {
  const s = CY1_SERIES[k];
  return `insert into configurator_families (slug, name, title, category_slug)
values (${q(s.slug)}, ${q(s.name)}, ${q(s.title_sv)}, 'cylinder')
on conflict (slug) do update set name = excluded.name;`;
}).join("\n")}

commit;
`;

const produktrad = `
update products set
  sku = 'SMC-CY1S',
  name = 'CY1S – Magnetically Coupled Rodless Cylinder, Slider Type',
  family = 'CY1S',
  description = 'Magnetically coupled rodless cylinder, slider type with slide bearing. Ø6–40mm, standard strokes 50–1000mm, up to 1500mm.'
where sku = 'SMC-CY1R';

update product_specs s set value = 'CY1S'
from products p where s.product_id = p.id and p.sku = 'SMC-CY1S' and s.key = 'series';

update product_specs s set value = '6, 10, 15, 20, 25, 32, 40'
from products p where s.product_id = p.id and p.sku = 'SMC-CY1S' and s.key = 'bore_mm';

update product_specs s set value = 'standardslag 50–1000 mm beroende på borrning, mellanslag på beställning; max 300–1500 mm'
from products p where s.product_id = p.id and p.sku = 'SMC-CY1S' and s.key = 'stroke_mm';

update product_specs s set value = '7'
from products p where s.product_id = p.id and p.sku = 'SMC-CY1S' and s.key = 'max_pressure';

update product_specs s set value = 'Cylinderrör rostfritt stål; slid, plåtar och yttre slid i aluminiumlegering'
from products p where s.product_id = p.id and p.sku = 'SMC-CY1S' and s.key = 'material';

update product_specs s set value = 'Magnetkopplad kolvstångslös, dubbelverkande, slidtyp med glidlager'
from products p where s.product_id = p.id and p.sku = 'SMC-CY1S' and s.key = 'mode_of_operation';

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('min_pressure_mpa', '0.18'),
  ('order_code_example', '${exempel}'),
  ('catalogue', 'SMC CY1S, How to Order sida 1214, data sida 1215, konstruktion sida 1216')
) as x(key, value)
where p.sku = 'SMC-CY1S'
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);

-- Bruksanvisningarna som låg på 'cy1r' pekas på sin serie.
insert into knowledge_doc_families (source_file, family_slug, doc_title) values
  ('smc-cy1r-om_cy1s-z_om0078p_en.pdf', 'cy1s', 'SMC — CY1S-Z bruksanvisning'),
  ('smc-cy1r-om_cy1l_om0002c_en.pdf', 'cy1l', 'SMC — CY1L bruksanvisning'),
  ('smc-cy1r-om_cy1f_om0002f_en.pdf', 'cy1f', 'SMC — CY1F bruksanvisning')
on conflict (source_file, family_slug) do update set doc_title = excluded.doc_title;
`;

const HEADER: Record<CY1Series, string> = {
  cy1s: `CY1S: beställnyckeln enligt SMC Magnetically Coupled Rodless Cylinder CY1S Series (sida 1214).
GENERERAD ur src/lib/catalog/cy1.ts -- redigera inte för hand.

Slidtyp med glidlager. Kod CY1S{anslutning}{ø}{gänga}-{slag}{ändstopp}Z-{givare}{kabel}{antal}-{special},
t.ex. CY1S25-300Z-M9BW (sida 1214) och CY1SG25-500Z (sida 1215).`,
  cy1l: `CY1L: beställnyckeln enligt SMC Magnetically Coupled Rodless Cylinder CY1L Series (sida 1230).
GENERERAD ur src/lib/catalog/cy1.ts -- redigera inte för hand.

Slidtyp med kulbussning. Kod CY1L{ø}{gänga}{hållkraft}-{slag}{justering}-{givare}{kabel}{antal}-{special},
t.ex. CY1L25H-300-J79W (sida 1230) och CY1L32H-500 (sida 1231).`,
  cy1h: `CY1H: beställnyckeln enligt SMC Magnetically Coupled Rodless Cylinder CY1H Series (sida 1242).
GENERERAD ur src/lib/catalog/cy1.ts -- redigera inte för hand.

Linjärstyrd typ. Kod CY1H{styrning}{ø}{gänga}-{slag}{justering}-{givare}{kabel}{antal}-{special},
t.ex. CY1H25-300-Y7BW (sida 1242). Mellanslag beställs med -XB10, långa slag med -XB11 (sida 1243).`,
  cy1f: `CY1F: beställnyckeln enligt SMC Magnetically Coupled Rodless Cylinder CY1F Series (sida 1265).
GENERERAD ur src/lib/catalog/cy1.ts -- redigera inte för hand.

Låg styrd typ. Kod CY1F{ø}{gänga}{sida}-{slag}{justerbult}-{givare}{kabel}{antal}-{special},
t.ex. CY1F10R-300-M9BW (sida 1265). Mellanslag beställs med -XB10, långa slag med -XB11 (sida 1266).`,
};

const delar = [forspel];
for (const k of CY1_SERIES_LIST) {
  const s = CY1_SERIES[k];
  const strokeMax = Math.max(...s.bores.map((b) => Math.max(b.max_mm, b.two_axis?.max_mm ?? 0)));
  delar.push(familyMigrationSql({
    slug: s.slug,
    schemaId: `SCHEMA-${s.prefix}-V1`,
    backupDate: DATUM,
    steps: steps(k),
    template: s.template,
    title_sv: `SMC ${s.prefix} ${s.title_sv[0].toLowerCase()}${s.title_sv.slice(1)}`,
    title_en: `SMC ${s.prefix} ${s.title_en[0].toLowerCase()}${s.title_en.slice(1)}`,
    family_title: s.title_sv,
    family_description: s.description_en,
    category_slug: "cylinder",
    stroke_min_mm: s.min_stroke_mm,
    stroke_max_mm: strokeMax,
    rules: buildCy1DbRules(k),
    doc: { source_file: s.source.file, title: `SMC — ${s.source.title}` },
    header: HEADER[k],
    extra: k === "cy1s" ? produktrad : undefined,
  }));
}
console.log(delar.join("\n\n"));

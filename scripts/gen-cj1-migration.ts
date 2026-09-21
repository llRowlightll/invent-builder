/**
 * Genererar migrationen för CJ1 (SMC stiftcylinder ø2,5/ø4) ur den kanoniska
 * modellen — ersätter familjens påhittade mall och döper om de två
 * produktraderna till koder som finns.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-cj1-migration.ts > supabase/migrations/<tidsstämpel>_cj1.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel CJ1B4-5U4 och CJ1B4-10SU4 (sida 16
 * och 18), datatabellerna, "ø2,5 bara enkelverkande" (sida 15) och alla
 * kombinationer regler↔modell.
 */
import { CJ1_ACTION_S, CJ1_BORES, CJ1_MODELS, CJ1_ORDER_CODE_TEMPLATE, CJ1_SOURCE, CJ1_STROKES, cj1BuildCode, cj1Model } from "../src/lib/catalog/cj1.ts";
import { buildCj1DbRules } from "../src/lib/catalog/cj1-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Borrning", title_en: "Bore size", required: true, type: "single_select", options: opt(CJ1_BORES) },
  { id: "action", step: 2, title_sv: "Funktion (standard är dubbelverkande)", title_en: "Action (double acting is standard)", required: false, type: "single_select", options: opt([CJ1_ACTION_S]) },
  { id: "stroke", step: 3, title_sv: "Standardslag", title_en: "Standard stroke", required: true, type: "single_select", options: opt(CJ1_STROKES) },
];

// ── produktraderna ──────────────────────────────────────────────────────
//
// SMC-CJ1B4 ("ø4, dubbelverkande, slag 20") är CJ1B4-20U4 (sida 16).
// SMC-CJ1B6 ("ø6, dubbelverkande, slag 30") finns inte: CJ1 tillverkas i ø2,5
// och ø4 (sida 15), ø6 är CJ2/CJP. Raden blir ø2,5-utförandet CJ1B2-10SU4
// (sida 18) så att båda utförandena finns som produkt. Ingen tabell pekar på
// raderna. "max_pressure 10 bar" är fel: 0,7 MPa (sida 16 och 18).
const produkt = (gammal: string, bore: string, action: string, stroke: number) => {
  const x = cj1Model(bore, action)!;
  const b = CJ1_BORES.find((y) => y.code === bore)!;
  const i = x.strokes.indexOf(stroke);
  const kod = cj1BuildCode({ bore, action: action || undefined, stroke: String(stroke) })!;
  const fn = action ? "single acting, spring return" : "double acting";
  const page = action ? 18 : 16;
  return `
update products set
  sku = ${q(`SMC-${kod}`)},
  family = 'CJ1',
  name = ${q(`${kod} Pin Cylinder ø${b.bore_mm}, ${fn}, stroke ${stroke} mm`)},
  description = ${q(`SMC CJ1 pin cylinder ${kod}, bore ${b.bore_mm} mm, piston rod ø${b.rod_mm} mm, ${fn}, stroke ${stroke} mm, basic style, ${action ? "0.3" : "0.2"}–0.7 MPa, −10…70 °C, no cushion, no auto switch, non-lube. Theoretical output at 0.5 MPa ${x.force_out_05_n} N out${action ? ` (spring force ${x.spring_ret_n} N retracted / ${x.spring_ext_n} N extended)` : ` and ${x.force_in_05_n} N in`}; weight ${x.weight_g[i]} g. Connection for ø4/ø2.5 polyurethane (TU0425) or soft nylon (TS0425) tubing. Catalogue page ${page}.`)}
where sku = ${q(gammal)};

update product_specs s set value = x.value, unit = x.unit
from products p, (values
  ('bore_mm', ${q(String(b.bore_mm))}, 'mm'),
  ('stroke_mm', ${q(String(stroke))}, 'mm'),
  ('max_pressure', '7', 'bar'),
  ('temp_range', '-10…+70', '°C')
) as x(key, value, unit)
where s.product_id = p.id and p.sku = ${q(`SMC-${kod}`)} and s.key = x.key;

insert into product_specs (product_id, key, value, unit)
select p.id, x.key, x.value, x.unit
from products p
cross join lateral (values
  ('mode_of_operation', ${q(action ? "Single-acting, spring return" : "Double-acting")}, null),
  ('min_pressure_mpa', ${q(action ? "0.3" : "0.2")}, null),
  ('rod_mm', ${q(String(b.rod_mm))}, 'mm'),
  ('force_n', ${q(String(x.force_out_05_n))}, 'N'),
  ('standard_strokes_mm', ${q(x.strokes.join(", "))}, 'mm'),
  ('order_code_example', ${q(kod)}, null),
  ('catalogue', ${q(`SMC CJ1, How to Order och data sida ${page}, mått sida ${page + 1}`)}, null)
) as x(key, value, unit)
where p.sku = ${q(`SMC-${kod}`)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;
};
const extra = [
  produkt("SMC-CJ1B4", "4", "", 20),
  produkt("SMC-CJ1B6", "2", "S", 10),
].join("\n");

console.log(familyMigrationSql({
  slug: "cj1",
  schemaId: "SCHEMA-CJ1-V1",
  backupDate: "20260921",
  steps,
  template: CJ1_ORDER_CODE_TEMPLATE,
  title_sv: "SMC CJ1 stiftcylinder",
  title_en: "SMC CJ1 pin cylinder",
  family_title: "Stiftcylinder CJ1 ø2,5/ø4, dubbelverkande eller enkelverkande med fjäderretur, slag 5–20 mm",
  family_description: "SMC CJ1 pin cylinder, basic style: double acting ø4 (stroke 5–20 mm) or single acting spring return ø2.5 (5–10 mm) and ø4 (5–20 mm), 0.2/0.3–0.7 MPa, no cushion, no auto switch, non-lube; connection for ø4/ø2.5 tubing (U4).",
  category_slug: "cylinder",
  stroke_min_mm: 5,
  stroke_max_mm: 20,
  rules: buildCj1DbRules(),
  doc: { source_file: CJ1_SOURCE.file, title: `SMC — ${CJ1_SOURCE.title}` },
  header: `CJ1: beställnyckeln enligt ${CJ1_SOURCE.title} (sida 16 och 18).
GENERERAD ur src/lib/catalog/cj1.ts -- redigera inte för hand.

Rättar familjen cj1, som hade mallen 'CJ1-{bore_mm}-{stroke_mm}-{cushioning}{sensing}'
med ø4/ø6, dämpning och givare -- inget av det finns i katalogen. SMC:s kod är
CJ1B{borrning}-{slag}{funktion}U4, t.ex. CJ1B4-5U4 (dubbelverkande, sida 16)
och CJ1B4-10SU4 (enkelverkande fjäderretur, sida 18); ø2,5 (kod 2) finns bara
enkelverkande, standardslag 5–20 mm.

SMC-CJ1B4 döps om till SMC-CJ1B4-20U4; SMC-CJ1B6 (ø6 finns inte i CJ1) blir
SMC-CJ1B2-10SU4 med katalogens data.`,
  extra,
}));

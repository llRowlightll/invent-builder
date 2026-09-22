/**
 * Genererar migrationen för KQ2 (SMC snabbkopplingar, metrisk slang och tum)
 * ur den kanoniska modellen. Första körningen (2026-09-16) skapade familjen
 * och rättade de nio produktraderna; andra körningen (2026-09-21) lade till
 * tumslangens kapitel, Clean-serien (10-), Q-utförandet, KJE-varianten (J)
 * och specialutförandena -X12/-X35/-X41. Produktdelen är idempotent.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-kq2-migration.ts > supabase/migrations/<tidsstämpel>_kq2.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel KQ2H06-01AS1/KQ2H06-01AS (sida 6,
 * 102), G-, plantätnings- och Uni-nycklarna (sida 58, 66, 88), tumnycklarna
 * (sida 31, 51, 75, 83, 97), 2 846 modellnummer ur måttabellerna, M3 bara i
 * rostfritt, honkopplingarna utan S, S- och P-kapitlens identiska poster,
 * och 60 000+ kombinationer regler↔modell.
 */
import { KQ2_BUTTON, KQ2_CLEAN, KQ2_KJE, KQ2_MATERIALS, KQ2_MTO, KQ2_ORDER_CODE_TEMPLATE, KQ2_PORTS, KQ2_Q, KQ2_SEALS, KQ2_SOURCE, KQ2_TUBES, KQ2_TYPES, kq2BuildCode, kq2ParseCode } from "../src/lib/catalog/kq2.ts";
import { buildKq2DbRules } from "../src/lib/catalog/kq2-db-rules.ts";
import { familyMigrationSql, opt, q, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "type", step: 1, title_sv: "Kopplingstyp", title_en: "Fitting type", required: true, type: "single_select", options: opt(KQ2_TYPES) },
  { id: "tube", step: 2, title_sv: "Slangens ytterdiameter", title_en: "Tubing O.D.", required: true, type: "single_select", options: opt(KQ2_TUBES) },
  { id: "port", step: 3, title_sv: "Port: gänga, slang på andra sidan, skottgenomföring eller nippel", title_en: "Port: thread, tubing on the other side, bulkhead or nipple", required: true, type: "single_select", options: opt(KQ2_PORTS) },
  { id: "material", step: 4, title_sv: "Gängmaterial (gängade kopplingar och skottgenomföringar)", title_en: "Thread material (threaded fittings and bulkheads)", required: false, type: "single_select", options: opt(KQ2_MATERIALS) },
  { id: "seal", step: 5, title_sv: "Tätning på R-gängan (standard är utan)", title_en: "Seal on the R thread (none is standard)", required: false, type: "single_select", options: opt(KQ2_SEALS) },
  { id: "button", step: 6, title_sv: "Frigöringsknapp (standard är rund)", title_en: "Release button (round is standard)", required: false, type: "single_select", options: opt([KQ2_BUTTON]) },
  { id: "q", step: 7, title_sv: "Q-utförande (ø8/R1/8, KQ-seriens area)", title_en: "Q type (ø8/R1/8, KQ series effective area)", required: false, type: "single_select", options: opt([KQ2_Q]) },
  { id: "kje", step: 8, title_sv: "KJE-utbytbar skottgenomföring", title_en: "KJE-interchangeable bulkhead union", required: false, type: "single_select", options: opt([KQ2_KJE]) },
  { id: "clean", step: 9, title_sv: "Clean-serien (prefix 10-)", title_en: "Clean series (prefix 10-)", required: false, type: "single_select", options: opt([KQ2_CLEAN]) },
  { id: "mto", step: 10, title_sv: "Specialutförande (-X)", title_en: "Made to order (-X)", required: false, type: "single_select", options: opt(KQ2_MTO) },
];

const preamble = `
insert into configurator_families (slug, name, title, description, category_slug)
values ('kq2', 'KQ2', 'KQ2', '', 'fitting')
on conflict (slug) do update set name = excluded.name;
`;

// ── produktraderna ──────────────────────────────────────────────────────
//
// Nio rader med blandade konventioner: fyra utan SMC-prefix, fyra med den
// gamla nyckelns kod utan materialbokstav (KQ2H06-01S är i CAT.ES50-37D
// KQ2H06-01AS) och slangkopplingen KQ2T06-00 utan A. "G1/8" i namn och
// specar är fel: portkoden 01 är R1/8 (han) / Rc1/8 (hon), G-gängan heter
// G01 (sida 6 och 58). Raderna pekas på av product_relations via id, som
// inte ändras.
const gänga: Record<string, string> = { "01": "R1/8", "02": "R1/4", "03": "R3/8", "04": "R1/2", M5: "M5" };
const namn = (kod: string): [string, string, string] => {
  const c = kq2ParseCode(kod)!.config;
  const tube = KQ2_TUBES.find((t) => t.code === c.tube)!.mm;
  const port = KQ2_PORTS.find((p) => p.code === c.port)!;
  const g = gänga[c.port];
  const typ = c.type === "H" ? (port.kind === "thread" ? "rak hankoppling" : "rak skarv") : c.type === "L" ? "vinkelkoppling, han" : "T-skarv";
  const typEn = c.type === "H" ? (port.kind === "thread" ? "male connector" : "straight union") : c.type === "L" ? "male elbow" : "union tee";
  const mat = c.material === "A" ? ", mässing" : c.material === "N" ? ", förnicklad mässing" : "";
  const seal = c.seal === "S" ? ", med tätningsmedel" : "";
  const sv = `SMC ${kod} ${typ} ${g ? `${g} × ` : ""}ø${tube} mm${mat}${seal}`;
  const en = `SMC KQ2 One-touch ${typEn}, ${g ? `${g} thread (port code ${c.port}) × ` : ""}ø${tube} mm tubing${c.material === "A" ? ", brass thread" : c.material === "N" ? ", nickel-plated brass thread" : ""}${c.seal === "S" ? ", with thread sealant" : ""}, round release button. −100 kPa to 1 MPa, −5…60 °C. Order code ${kod} (catalogue page 102).`;
  return [sv, en, g ?? ""];
};
const produkt = (gammal: string, kod: string) => {
  const [sv, en, g] = namn(kod);
  const c = kq2ParseCode(kod)!.config;
  return `
update products set
  sku = ${q(`SMC-${kod}`)},
  name = ${q(sv)},
  description = ${q(en)}
where sku = ${q(gammal)};

update product_specs s set value = x.value
from products p, (values
  ('thread', ${q(g)}),
  ('material', 'Kropp PBT/PP och mässing C3604 (gängdel), chuck och styrning rostfritt 304, tätning NBR'),
  ('max_pressure', '10'),
  ('temp_range', '-5…+60 (vatten 0…+40)')
) as x(key, value)
where s.product_id = p.id and p.sku = ${q(`SMC-${kod}`)} and s.key = x.key${g ? "" : " and s.key <> 'thread'"};

insert into product_specs (product_id, key, value)
select p.id, x.key, x.value
from products p
cross join lateral (values
  ('series', 'KQ2'),
  ('tube_od_mm', ${q(String(KQ2_TUBES.find((t) => t.code === c.tube)!.mm))}),
  ${g ? `('thread', ${q(g)}),` : "('port', 'Slang på andra sidan'),"}
  ('material', 'Kropp PBT/PP och mässing C3604 (gängdel), chuck och styrning rostfritt 304, tätning NBR'),
  ('max_pressure', '10'),
  ('min_pressure_kpa', '-100'),
  ('temp_range', '-5…+60 (vatten 0…+40)'),
  ('order_code_example', ${q(kod)}),
  ('catalogue', 'SMC KQ2 CAT.ES50-37D, How to Order sida 102, data sida 4')
) as x(key, value)
where p.sku = ${q(`SMC-${kod}`)}
  and not exists (select 1 from product_specs y where y.product_id = p.id and y.key = x.key);
`;
};
const rader: Array<[string, string]> = [
  ["KQ2H06-00A", "KQ2H06-00A"],
  ["KQ2H08-00A", "KQ2H08-00A"],
  ["KQ2L06-01A", "KQ2L06-01A"],
  ["KQ2L08-02A", "KQ2L08-02A"],
  ["SMC-KQ2H04-M5A", "KQ2H04-M5A"],
  ["SMC-KQ2H06-01S", "KQ2H06-01AS"],
  ["SMC-KQ2H08-02S", "KQ2H08-02AS"],
  ["SMC-KQ2L06-01S", "KQ2L06-01AS"],
  ["SMC-KQ2T06-00", "KQ2T06-00A"],
];
for (const [, kod] of rader) if (kq2BuildCode(kq2ParseCode(kod)!.config) !== kod) throw new Error(`ogiltig kod ${kod}`);
const extra = rader.map(([gammal, kod]) => produkt(gammal, kod)).join("\n") + `
delete from product_specs s using products p
where s.product_id = p.id and p.family = 'KQ2' and s.key = 'max_pressure_bar';
`;

console.log(familyMigrationSql({
  slug: "kq2",
  schemaId: "SCHEMA-KQ2-V1",
  backupDate: "20260921",
  steps,
  template: KQ2_ORDER_CODE_TEMPLATE,
  title_sv: "SMC KQ2 snabbkoppling, metrisk slang och tum",
  title_en: "SMC KQ2 One-touch fitting, metric and inch tubing",
  family_title: "Snabbkopplingar KQ2 för slang ø2–ø16 och ø1/8\"–ø1/2\": gängade (M, R/Rc, G, Uni, UNF, NPT), skarvar, instick, reduceringar, nipplar och slanglock",
  family_description: "SMC KQ2 One-touch fittings for metric tubing ø2–ø16 and inch tubing ø1/8\"–ø1/2\": 32 body types (male/female connectors, elbows, universal elbows, tees, run tees, Y, delta, cross, bulkheads, reducers, nipples, tube caps), threads M3/M5/M6 with gasket, R/Rc 1/8–1/2 and NPT 1/16–1/2 with sealant (S) or face seal (P), G 1/8–1/2 with face seal, Uni 1/8–1/2 and 10-32 UNF with gasket, brass (A), nickel-plated brass (N) or stainless 303 (G, M3 only), round or oval (1) release button, Clean series (10-), Q type (ø8/R1/8), KJE-interchangeable bulkhead (J) and made-to-order -X12/-X35/-X41. −100 kPa to 1 MPa, −5…60 °C. The plug KQ2P is not included.",
  category_slug: "fitting",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildKq2DbRules(),
  doc: { source_file: KQ2_SOURCE.file, title: `SMC — ${KQ2_SOURCE.title}` },
  header: `KQ2: beställnyckeln enligt ${KQ2_SOURCE.title} (CAT.ES50-37D, sida 6 och 102).
GENERERAD ur src/lib/catalog/kq2.ts och kq2-models.ts -- redigera inte för hand.

Familjen kq2 i kategorin fitting: {clean}KQ2{typ}{slang}-{port}{material}{q}{tätning}{kje}{knapp}{special},
t.ex. KQ2H06-01AS1 (nyckelns exempel sida 6), KQ2H06-01AS (sida 102),
KQ2H05-34AS1 (tumslang med NPT1/8, sida 31), 10-KQ2H06-02NS1 (Clean, sida 28),
KQ2L08-01AQS (Q, sida 132) och KQ2E04-00AJ (KJE, sida 129). 32 kopplingstyper,
åtta metriska och sju tumslangmått, 49 portar, tre material, två tätningar,
oval knapp, Q, J, Clean och tre specialutföranden; 2 846 modellnummer ur
måttabellerna styr vilka kombinationer som finns. Pluggen KQ2P-□□ har egen
kodform och är inte med.

De nio produktraderna får SMC-prefix, den nya nyckelns materialbokstav
(KQ2H06-01S -> KQ2H06-01AS, KQ2T06-00 -> KQ2T06-00A) och rätt gänga
(portkoden 01 är R1/8, inte G1/8).`,
  preamble,
  extra,
  rulesPerBatch: 8,
}));

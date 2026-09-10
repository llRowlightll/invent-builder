/**
 * Genererar migrationen för DSBC ur den kanoniska modellen.
 *
 * Kör:  deno run --allow-read --allow-write --no-lock --node-modules-dir=none \
 *         scripts/gen-dsbc-migration.ts > supabase/migrations/<tidsstämpel>_dsbc.sql
 *
 * Poängen: inga värden skrivs för hand in i SQL. Det var handskrivandet som
 * gav konfiguratorn fyra påhittade optionskoder och en maxslaglängd på 2000 mm
 * när katalogen sa 2800. Ändras modellen kör man om det här; ändras SQL:en
 * direkt failar CI-testet som jämför databasen mot modellen.
 */
import { DSBC_POSITIONS, DSBC_SOURCE } from "../src/lib/catalog/dsbc.ts";
import { buildDsbcDbRules } from "../src/lib/catalog/dsbc-db-rules.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const out: string[] = [];

out.push(`-- DSBC: beställnyckeln enligt ${DSBC_SOURCE.title}, utgåva ${DSBC_SOURCE.edition}.
-- GENERERAD ur src/lib/catalog/dsbc.ts -- redigera inte för hand.
--
-- Rättar tre fel som legat i produktion sedan katalogen lästes in 2026-05-19:
--   1. Optionerna S2, KP, S6 och TT fanns valbara men förekommer inte i Festos
--      katalog -- en kund kunde konfigurera en obeställbar orderkod.
--   2. stroke_max_mm var 2000; katalogen säger 2800.
--   3. Beställnyckeln modellerades med 5 parametrar; den har 20 positioner.
--
-- Lägger dessutom in katalogens 18 villkor i config_rules, som den befintliga
-- configurator-engine redan kan köra men aldrig fick några regler för.

begin;

create table if not exists backup.dsbc_before_20260910 as
  select 'param' as sort, p.id::text as id, p.param_key as k, p.label as v
  from configurator_params p join configurator_families f on f.id = p.family_id
  where f.slug = 'dsbc'
  union all
  select 'value', v.id::text, v.code, v.label
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'dsbc';
`);

// Mallen byggs ur positionerna i stället för att skrivas som en sträng, så
// den kan aldrig tappa en position. Den tidigare handskrivna mallen täckte 6
// av 21 -- en kund som valde R3 eller EX4 fick en orderkod utan dem.
//
// {key:SUFFIX} används för de numeriska positionerna, som bär sin bokstav i
// koden (25 -> "25KE"). Lägesavkänningen fogas till dämpningen utan bindestreck
// eftersom Festo trycker dem ihop: PPV + A -> PPVA.
const orderCodeTemplate = "DSBC" + DSBC_POSITIONS.map((p) => {
  const ph = p.numeric_suffix ? `{${p.key}:${p.numeric_suffix}}` : `{${p.key}}`;
  return p.key === "sensing" ? ph : `-${ph}`;
}).join("");

// ── familjen ────────────────────────────────────────────────────────────────
const strokePos = DSBC_POSITIONS.find((p) => p.key === "stroke_mm")!;
out.push(`
-- Familjen: rätt slagintervall och en mall som faktiskt speglar positionerna.
update configurator_families set
  stroke_min_mm = ${strokePos.range!.min},
  stroke_max_mm = ${strokePos.range!.max},
  order_code_template = ${q(orderCodeTemplate)},
  standard = ${q("ISO 15552")}
where slug = 'dsbc';
`);

// ── parametrar ──────────────────────────────────────────────────────────────
out.push(`
-- Ut med den handskrivna modellen, in med katalogens positioner.
delete from configurator_param_values v using configurator_params p, configurator_families f
  where v.param_id = p.id and p.family_id = f.id and f.slug = 'dsbc';
delete from configurator_params p using configurator_families f
  where p.family_id = f.id and f.slug = 'dsbc';
`);

const paramRows = DSBC_POSITIONS.map((pos, i) => ({
  param_key: pos.key,
  label: pos.label_sv,
  param_type: pos.values === null ? "number" : "select",
  sort_order: i + 1,
  required: pos.key === "bore_mm" || pos.key === "stroke_mm" || pos.key === "cushioning",
  // Varje numerisk position bär sitt eget spann. Utan dem ärvde
  // kolvstångsförlängningen slaglängdens 2800 mm i formuläret.
  min_value: pos.range?.min ?? null,
  max_value: pos.range?.max ?? null,
}));

const valueRows = DSBC_POSITIONS.flatMap((pos) =>
  (pos.values ?? [])
    .filter((v) => v.code) // "standard" = positionen utelämnas, inget val att lagra
    .map((v, j) => ({ param_key: pos.key, code: v.code, label: v.label_sv, sort_order: j })),
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
where f.slug = 'dsbc';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, r.code, r.label, r.sort_order
from jsonb_to_recordset(${q(JSON.stringify(valueRows))}::jsonb)
       as r(param_key text, code text, label text, sort_order int)
join configurator_params p on p.param_key = r.param_key
join configurator_families f on f.id = p.family_id and f.slug = 'dsbc';
`);

// ── reglerna ────────────────────────────────────────────────────────────────
//
// De läggs under det BEFINTLIGA SCHEMA-DSBC-V1, inte under ett nytt id. DSBC
// fanns redan i båda konfiguratorspåren, och att lägga till ett tredje
// regelställe vore att göra om precis det misstag vi håller på att rätta.
//
// De tre gamla reglerna ersätts. En av dem sa "DSBC max slag är 2000mm" --
// samma felaktiga siffra som i configurator_families, handskriven på två
// ställen. De andra två var vettiga råd och skrivs om, inte bort.
//
// Alla tre låg dessutom i formatet {"step":..., "condition":"stroke > 2000"},
// som evalLogic inte kan tolka: den returnerar objektet när det har fler än en
// nyckel, och ett objekt är sant. Reglerna larmade alltså ALLTID, oavsett
// konfiguration. Här skrivs de i den JSON-logik motorn faktiskt kör.
const ruleRows = buildDsbcDbRules();

out.push(`
delete from config_rules where schema_id = 'SCHEMA-DSBC-V1';

insert into config_rules (schema_id, severity, if_json, message_sv, message_en, goto_step)
select 'SCHEMA-DSBC-V1', r.severity, r.if_json, r.message_sv, r.message_en, r.goto_step
from jsonb_to_recordset(${q(JSON.stringify(ruleRows))}::jsonb)
       as r(severity text, if_json jsonb, message_sv text, message_en text, goto_step text);
`);

// Databasen har lagrat severity 'warning' medan både typen ConfigRule och
// ValidationList i Bom.tsx jämför mot 'warn'. Varningar har därför aldrig
// matchat och renderats som info. En stavning får gälla, och koden äger den.
out.push(`
update config_rules set severity = 'warn' where severity = 'warning';`);

// Familjespåret måste kunna hitta reglerna. Utan den här kopplingen läser
// configurator.$family.tsx inga regler alls -- vilket var precis läget förut.
out.push(`
alter table configurator_families
  add column if not exists rules_schema_id text references config_schemas(schema_id);
update configurator_families set rules_schema_id = 'SCHEMA-DSBC-V1' where slug = 'dsbc';`);

// ── produktraderna ──────────────────────────────────────────────────────────
out.push(`
-- Produktkatalogens DSBC-rader. FESTO-1463250 är enligt katalogens
-- "Module no."-rad modulnumret för Ø32 -- inte hela familjen. Den låg med
-- bore "32-100", alltså familjens intervall på en rad som betecknar en storlek.
update product_specs s set value = '32'
where s.key = 'bore_mm'
  and s.product_id = (select id from products where sku = 'FESTO-1463250');

-- Familjeraden saknade Ø125 (katalogen har sju storlekar, inte sex).
update product_specs s set value = '32,40,50,63,80,100,125'
where s.key = 'bore_mm'
  and s.product_id = (select id from products where sku = 'FESTO-DSBC');

commit;
`);

console.log(out.join("\n"));

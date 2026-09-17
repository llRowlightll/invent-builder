/**
 * Genererar migrationen för JMHZ2 (SMC kompakt parallellgripdon) ur den
 * kanoniska modellen — en ny familj utan produktrader.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-jmhz2-migration.ts > supabase/migrations/<tidsstämpel>_jmhz2.sql
 *
 * VERIFIERINGENS STYRKA: nyckelns exempel JMHZ2-16D-M9BW (sida 9),
 * modelltabellen (sida 10), -X6900 utan givarposition (sida 20), -X7460 med
 * högst två givare (sida 21), och alla 54 720 kombinationer regler↔modell.
 */
import { JMHZ2_ACTIONS, JMHZ2_BORES, JMHZ2_COUNTS, JMHZ2_FINGERS, JMHZ2_LEADS, JMHZ2_MTO, JMHZ2_ORDER_CODE_TEMPLATE, JMHZ2_SOURCE, JMHZ2_SWITCHES } from "../src/lib/catalog/jmhz2.ts";
import { buildJmhz2DbRules } from "../src/lib/catalog/jmhz2-db-rules.ts";
import { familyMigrationSql, opt, type Step } from "./lib/family-migration.ts";

const steps: Step[] = [
  { id: "bore", step: 1, title_sv: "Storlek", title_en: "Bore size", required: true, type: "single_select", options: opt(JMHZ2_BORES) },
  { id: "action", step: 2, title_sv: "Verkan", title_en: "Action", required: true, type: "single_select", options: opt(JMHZ2_ACTIONS) },
  { id: "finger", step: 3, title_sv: "Fingeralternativ (standard är basfingrar)", title_en: "Finger option (basic fingers are standard)", required: false, type: "single_select", options: opt(JMHZ2_FINGERS) },
  { id: "switch", step: 4, title_sv: "Givare (magneten är inbyggd)", title_en: "Auto switch (the magnet is built in)", required: false, type: "single_select", options: opt(JMHZ2_SWITCHES) },
  { id: "lead", step: 5, title_sv: "Givarens kabellängd (standard är 0,5 m)", title_en: "Auto switch lead wire length (0.5 m is standard)", required: false, type: "single_select", options: opt(JMHZ2_LEADS) },
  { id: "count", step: 6, title_sv: "Antal givare (standard är två)", title_en: "Number of auto switches (two is standard)", required: false, type: "single_select", options: opt(JMHZ2_COUNTS) },
  { id: "mto", step: 7, title_sv: "Specialutförande", title_en: "Made to order", required: false, type: "single_select", options: opt(JMHZ2_MTO) },
];

const preamble = `
insert into configurator_families (slug, name, title, description, category_slug)
values ('jmhz2', 'JMHZ2', 'JMHZ2', '', 'gripper')
on conflict (slug) do update set name = excluded.name;
`;

// Filen smc-kat-mhz2.pdf är JMHZ2-kapitlet; dess stycken pekade inte på
// någon familj (mhz2 pekar på smc-kat-mhz2-std.pdf).
const extra = ``;

console.log(familyMigrationSql({
  slug: "jmhz2",
  schemaId: "SCHEMA-JMHZ2-V1",
  backupDate: "20260916",
  steps,
  template: JMHZ2_ORDER_CODE_TEMPLATE,
  title_sv: "SMC JMHZ2 kompakt parallellgripdon",
  title_en: "SMC JMHZ2 compact parallel gripper",
  family_title: "Kompakt parallellgripdon JMHZ2 ø8–20, dubbel- eller enkelverkande, med inbyggd magnet",
  family_description: "SMC JMHZ2 compact type parallel style air gripper: ø8, 12, 16 and 20 (equivalent to MHZ2-10/16/20/25 with a smaller body), double acting or single acting (normally open/closed), 4–14 mm stroke, gripping force 4.5–72 N per finger at 0.5 MPa, finger options with side tapped mounting or through-holes, built-in magnet with D-M9 auto switches, -X50 without magnet, -X6900 positioning pins, -X7460 lateral auto switch mounting.",
  category_slug: "gripper",
  stroke_min_mm: null,
  stroke_max_mm: null,
  rules: buildJmhz2DbRules(),
  doc: { source_file: JMHZ2_SOURCE.file, title: `SMC — ${JMHZ2_SOURCE.title}` },
  header: `JMHZ2: beställnyckeln enligt ${JMHZ2_SOURCE.title} (sida 9).
GENERERAD ur src/lib/catalog/jmhz2.ts -- redigera inte för hand.

Ny familj jmhz2 i kategorin gripper: JMHZ2-{ø}{verkan}{finger}-{givare}{kabel}{antal}-{special},
t.ex. JMHZ2-16D-M9BW (nyckelns exempel sida 9). Fyra storlekar, tre
verkningssätt, två fingeralternativ, 18 givare, -X50/-X6900A/-X6900B/-X7460.
Katalogfilen smc-kat-mhz2.pdf (hämtad som MHZ2) är detta kapitel; den
kopplas nu till jmhz2 i knowledge_doc_families. Inga produktrader finns.`,
  preamble,
  extra,
}));

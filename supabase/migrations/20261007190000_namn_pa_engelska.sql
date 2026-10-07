-- Produktnamnet på engelska.
--
-- `name` är katalognamnet som motorn (groq-advisor) och sökningen matchar på:
-- ungefär 330 av 800 är svenska ("kompaktcylinder, 50 mm slag", "fotfäste"),
-- resten engelska eller bara typkod. De svenska namnen syntes oöversatta på
-- de engelska sidorna. Det engelska namnet läggs här och visas på sajtens
-- andra språk (produktnamn() i src/lib/spec-format.ts); tom kolumn = `name`
-- överallt, som förut. `name` ändras inte, så motorns matchning är orörd.
alter table public.products add column if not exists name_en text;

-- Läsrätten på products är satt per kolumn, se 20261006220000.
grant select (name_en) on public.products to anon, authenticated;

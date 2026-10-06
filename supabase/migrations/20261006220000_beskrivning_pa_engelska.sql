-- Produktbeskrivningen på två språk.
--
-- 193 av 841 beskrivningar var engelska på en svensk sajt. De översätts till
-- svenska i description; det engelska originalet flyttas hit och visas på
-- sajtens andra språk (beskrivning() i src/lib/spec-format.ts). Kolumnen kan
-- vara tom -- då visas description överallt, som förut.
alter table public.products add column if not exists description_en text;

-- Läsrätten på products är satt per kolumn (restrict_anon_from_reading_cost_
-- and_margin_columns), så en ny kolumn är oläslig tills den läggs till här.
-- Utan raden föll katalogfrågan (select ...,description_en,...) för alla.
grant select (description_en) on public.products to anon, authenticated;

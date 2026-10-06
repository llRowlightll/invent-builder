-- Produktbeskrivningen på två språk.
--
-- 193 av 841 beskrivningar var engelska på en svensk sajt. De översätts till
-- svenska i description; det engelska originalet flyttas hit och visas på
-- sajtens andra språk (beskrivning() i src/lib/spec-format.ts). Kolumnen kan
-- vara tom -- då visas description överallt, som förut.
alter table public.products add column if not exists description_en text;

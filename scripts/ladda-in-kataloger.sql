-- Tillfällig skrivrätt för scripts/ingest-catalogues.py.
--
-- VARFÖR DEN BEHÖVS. knowledge_chunks har en läspolicy för alla och en
-- skrivpolicy som kräver admin-roll: det finns ingen skrivväg med den publika
-- nyckeln, och det ska det inte finnas. Inläsningen är däremot ett engångsjobb
-- per katalogfil som körs från en laptop med pdftotext. Lösningen är en smal,
-- hemlighetsskyddad insert-policy som gäller under körningen och SLÄPPS direkt
-- efteråt.
--
-- VARFÖR EN POLICY OCH INTE EN FUNKTION. Fram till 2026-09-23 gick skrivningen
-- via två tillfälliga security definer-funktioner. De fungerade felfritt i SQL
-- men gav 404 över REST tre körningar i rad: PostgREST känner bara till de
-- funktioner som fanns när dess schemacache senast laddades, och notisen
-- "reload schema" kom inte fram. Tabellen ligger redan i cachen, så
-- tabellvägen har inte problemet -- och kräver varken security definer eller
-- nya objekt. Skriptet läser numera de redan inlästa filerna med ett vanligt
-- GET mot tabellen (läspolicyn räcker) och skriver med POST.
--
-- KÖR SÅ HÄR
--
--   1. generera en hemlighet och sätt den på HEMLIGHET-raden nedan:
--        export INGEST_SECRET=$(uuidgen); echo $INGEST_SECRET
--   2. SQL-editorn: kör AVSNITT 1.
--   3. skalet:  python3 scripts/ingest-catalogues.py
--   4. SQL-editorn: kör AVSNITT 2 (släpper policyn).
--   5. kontrollera att inget ligger kvar:
--        select polname from pg_policy
--        where polrelid = 'public.knowledge_chunks'::regclass;
--      Bara "public read knowledge" och "admins write knowledge" ska finnas.
--
-- HEMLIGHETEN är inte ett lösenord till något annat -- den finns bara för att
-- skrivvägen står öppen för anon under körningen. GENERERA EN NY VARJE GÅNG
-- och checka aldrig in den: repot är publikt, och medan policyn finns är
-- hemligheten det enda som skiljer den från en öppen skrivväg till
-- knowledge_chunks -- tabellen vars innehåll går rakt in i rådgivarens prompt.
-- Skriptet vägrar starta utan INGEST_SECRET.
--
-- Det viktigaste är ändå inte vilken sträng det är, utan att AVSNITT 2 körs
-- direkt efteråt.


-- ── AVSNITT 1: öppna skrivvägen ─────────────────────────────────────────────

-- request.headers sätts av PostgREST per förfrågan och är NULL när satsen körs
-- från SQL-editorn eller en migration -- då blir uttrycket NULL och policyn
-- nekar. Rubriknamn är gemener.
create policy tmp_ingest_insert on knowledge_chunks
  for insert to anon
  with check (
    current_setting('request.headers', true)::json ->> 'x-ingest-secret'
      = 'SÄTT-EN-NY-HEMLIGHET-HÄR'   -- HEMLIGHET
  );


-- ── AVSNITT 2: stäng den igen (kör direkt efter inläsningen) ────────────────
--
-- drop policy if exists tmp_ingest_insert on knowledge_chunks;
